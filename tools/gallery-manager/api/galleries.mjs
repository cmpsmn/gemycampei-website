/**
 * ============================================================================
 * GALLERIES  (tools/gallery-manager/api/galleries.mjs)
 * ============================================================================
 *
 * Everything about a gallery folder:
 *
 *   galleries/<main category>/<slug>/
 *     gallery.md            settings + story text
 *     <slug>-001.jpg ...    photos
 *
 * - readGallery / listGalleries   → data for the manager
 * - createGallery                 → new folder + gallery.md
 * - saveGallery                   → writes the form; moves/renames the folder when the
 *                                   main category or the folder name changed
 * - deleteGallery                 → moves the folder to the trash
 * - renumberPhotos                → renames photos to <slug>-001.jpg, -002 ... in a given order
 *
 * When a gallery gets a new id ("<category>/<slug>"), every reference is
 * updated: category order lists, testimonial links, and the old web address is
 * added to `legacyUrls` so visitors and Google are redirected.
 * ============================================================================
 */

import { mkdir, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  GALLERIES,
  UserError,
  assertPhotoName,
  assertSlug,
  exists,
  galleryDir,
  isDirectory,
  parseGalleryId,
} from './paths.mjs';
import { applyChanges, parseMarkdown, readMarkdown, toPlain, writeMarkdown } from './frontmatter.mjs';
import { assertCategory, listCategories, positionsOf, renameInOrders, restorePositions, syncGalleryInOrders, updateOrders } from './categories.mjs';
import { detachGallery, reattachGallery, renameGalleryRefs, renamePhotoRefs } from './testimonials.mjs';
import { moveFile, moveToTrash } from './trash.mjs';
import { isGalleryPhoto, naturalSort, optimisePhoto, photoName, slugify } from '../../../scripts/lib/photos.mjs';
import { readAlts, renameAlts } from './alts.mjs';

const REGIONS = ['vienna', 'dolomites', 'austria', 'destination'];

/** "lago-di-braies" → "Lago Di Braies" (same default as the website) */
const titleFromFolder = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Photo dimensions, remembered per file version so each photo is only measured once. */
const sizeCache = new Map();
async function photoInfo(file) {
  const info = await stat(file);
  const key = `${file}|${info.mtimeMs}`;
  if (!sizeCache.has(key)) {
    const meta = await sharp(file).metadata();
    const rotated = (meta.orientation ?? 1) >= 5;
    sizeCache.set(key, { width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height });
  }
  return { ...sizeCache.get(key), size: info.size, version: Math.round(info.mtimeMs) };
}

/**
 * Gives files a new, unique modification time.
 *
 * The manager recognises a photo version by file name + modification time
 * (thumbnail URLs and the thumbnail cache). Photos imported together often
 * share the same time to the millisecond, so after renaming, a different photo
 * could get a name AND time that an old thumbnail already used, and the old
 * picture showed up twice. Called for every photo that is renamed or moved.
 * @param {string[]} files absolute paths
 */
let lastStamp = 0;
export async function markChanged(files) {
  for (const file of files) {
    lastStamp = Math.max(Date.now(), lastStamp + 1);
    const time = new Date(lastStamp);
    await utimes(file, time, time);
  }
}

/** Photo file names in a gallery folder, in website order (file name order). */
export async function photoNames(category, slug) {
  const dir = galleryDir(category, slug);
  return (await readdir(dir)).filter(isGalleryPhoto).sort(naturalSort);
}

/** All gallery folders: [{ category, slug }] */
async function galleryFolders() {
  const folders = [];
  for (const category of await listCategories()) {
    const dir = path.join(GALLERIES, category.id);
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) folders.push({ category: category.id, slug: entry.name });
    }
  }
  return folders;
}

/** Everything the editor needs about one gallery. */
export async function readGallery(id) {
  const { category, slug } = parseGalleryId(id);
  const dir = galleryDir(category, slug);
  if (!(await isDirectory(dir))) throw new UserError(`The gallery "${id}" does not exist.`, 404);

  const { doc, body } = await readMarkdown(path.join(dir, 'gallery.md'));
  const data = toPlain(doc);
  const names = await photoNames(category, slug);
  const alts = await readAlts(dir);
  const photos = await Promise.all(
    names.map(async (name) => ({
      name,
      ...(await photoInfo(path.join(dir, name))),
      alt: { en: alts[name]?.en ?? '', de: alts[name]?.de ?? '' },
    })),
  );

  // Same cover rule as the website: cover setting → a file called cover.* → first photo
  const coverPhoto =
    (data.cover && names.includes(data.cover) && data.cover) || names.find((n) => /^cover\./i.test(n)) || names[0] || '';

  // German texts from gallery.de.md (optional; empty strings when missing)
  const german = await readGerman(dir);

  // Dates come back from YAML as Date objects or strings: always send "YYYY-MM-DD"
  const date = data.date instanceof Date ? data.date.toISOString().slice(0, 10) : (data.date ?? '');

  return {
    id,
    category,
    slug,
    url: `/${category}/${slug}/`,
    fields: {
      title: data.title ?? '',
      type: data.type ?? '',
      couple: data.couple ?? '',
      location: data.location ?? '',
      region: data.region ?? '',
      date: String(date),
      cover: data.cover ?? '',
      coverFocus: data.coverFocus ?? '',
      seoTitle: data.seoTitle ?? '',
      seoDescription: data.seoDescription ?? '',
      draft: data.draft === true,
      legacyUrls: Array.isArray(data.legacyUrls) ? data.legacyUrls : [],
    },
    story: body.trim(),
    videos: readVideos(data.videos),
    posters: await posterNames(dir),
    de: german,
    categories: [category, ...(Array.isArray(data.alsoIn) ? data.alsoIn : []).filter((c) => c !== category)],
    photos,
    coverPhoto,
    displayTitle: data.title || titleFromFolder(slug),
  };
}

/** Vimeo videos of a gallery (gallery.md → videos), always as plain strings */
function readVideos(list) {
  if (!Array.isArray(list)) return [];
  return list.map((v) => ({ vimeoId: String(v?.vimeoId ?? ''), title: String(v?.title ?? ''), poster: String(v?.poster ?? '') }));
}

/** Preview images of the videos: files in the gallery's posters/ folder */
async function posterNames(dir) {
  const posters = path.join(dir, 'posters');
  return (await isDirectory(posters)) ? (await readdir(posters)).filter(isGalleryPhoto).sort(naturalSort) : [];
}

/**
 * Saves a video preview image in posters/ (optimised like photos).
 * @returns {{ name: string }} the file name to use as `poster`
 */
export async function uploadPoster(id, originalName, buffer) {
  const { category, slug } = parseGalleryId(id);
  const dir = galleryDir(category, slug);
  if (!(await isDirectory(dir))) throw new UserError(`The gallery "${id}" does not exist.`, 404);
  let photo;
  try {
    photo = await optimisePhoto(buffer);
  } catch {
    throw new UserError('This file could not be read as a photo.');
  }
  const name = `${slugify(String(originalName).replace(/\.[^.]+$/, '')) || 'poster'}.jpg`;
  await mkdir(path.join(dir, 'posters'), { recursive: true });
  await writeFile(path.join(dir, 'posters', name), photo.buffer);
  return { name };
}

/** The German fields of gallery.de.md, as strings (empty when the file is missing). */
const GERMAN_FIELDS = ['title', 'type', 'location', 'seoTitle', 'seoDescription'];

async function readGerman(dir) {
  const file = path.join(dir, 'gallery.de.md');
  const empty = { title: '', type: '', location: '', seoTitle: '', seoDescription: '', story: '', videoTitles: [] };
  if (!(await exists(file))) return empty;
  const { doc, body } = await readMarkdown(file);
  const data = toPlain(doc);
  return {
    ...empty,
    ...Object.fromEntries(GERMAN_FIELDS.map((key) => [key, String(data[key] ?? '')])),
    videoTitles: Array.isArray(data.videoTitles) ? data.videoTitles.map(String) : [],
    story: body.trim(),
  };
}

/**
 * Writes gallery.de.md. The German page of a gallery is only shown to Google
 * once this file exists; with all fields empty the file is removed again.
 */
async function writeGerman(dir, german = {}) {
  const file = path.join(dir, 'gallery.de.md');
  const values = Object.fromEntries(GERMAN_FIELDS.map((key) => [key, String(german[key] ?? '').trim()]));
  const story = String(german.story ?? '').trim();
  // Video titles in the order of the videos; trailing empty ones are left out
  const videoTitles = (Array.isArray(german.videoTitles) ? german.videoTitles : []).map((t) => String(t ?? '').trim());
  while (videoTitles.length && !videoTitles.at(-1)) videoTitles.pop();
  if (!story && !videoTitles.length && Object.values(values).every((v) => !v)) {
    if (await exists(file)) await rm(file);
    return;
  }
  const { doc } = (await exists(file)) ? await readMarkdown(file) : parseMarkdown(NEW_GERMAN_TEMPLATE);
  applyChanges(doc, { ...values, videoTitles });
  await writeMarkdown(file, doc, story);
}

/** Short summaries of all galleries for the sidebar. */
export async function listGalleries() {
  const list = [];
  for (const { category, slug } of await galleryFolders()) {
    const gallery = await readGallery(`${category}/${slug}`);
    const cover = gallery.photos.find((p) => p.name === gallery.coverPhoto);
    list.push({
      id: gallery.id,
      category,
      slug,
      title: gallery.displayTitle,
      couple: gallery.fields.couple,
      draft: gallery.fields.draft,
      photoCount: gallery.photos.length,
      // A gallery of videos only shows its first preview image
      coverPhoto: gallery.coverPhoto || (gallery.videos[0]?.poster ? `posters/${gallery.videos[0].poster}` : ''),
      coverVersion: cover?.version ?? 0,
      videoCount: gallery.videos.length,
      categories: gallery.categories,
    });
  }
  return list;
}

/** Template for new galleries: comments help when the file is opened by hand. */
const NEW_GALLERY_TEMPLATE = `---
# Gallery settings. Edit with the gallery manager (npm run manage) or by hand.
# Every field is explained in src/content.config.ts
title: ""
# Hidden on the live site until you publish it in the manager
draft: true
---
`;

/** Template for German texts (gallery.de.md) */
const NEW_GERMAN_TEMPLATE = `---
# German texts of this gallery. Photos and settings come from gallery.md.
# The text below the settings block is the German story.
---
`;

/** Creates a new gallery folder and returns its id. */
export async function createGallery({ category, title, type, couple, place }) {
  assertSlug(category, 'Category');
  await assertCategory(category);
  if (!title?.trim()) throw new UserError('Please enter a title (usually the venue or place).');

  const base = slugify([title, type, place, couple].filter(Boolean).join(' ')) || 'new-gallery';
  let slug = base;
  for (let n = 2; await exists(galleryDir(category, slug)); n++) slug = `${base}-${n}`;

  const dir = galleryDir(category, slug);
  await mkdir(dir, { recursive: true });
  const { doc } = parseMarkdown(NEW_GALLERY_TEMPLATE);
  applyChanges(doc, { title: title.trim(), type: type?.trim(), couple: couple?.trim(), location: place?.trim() });
  await writeMarkdown(path.join(dir, 'gallery.md'), doc, '');

  const id = `${category}/${slug}`;
  await syncGalleryInOrders(id, [category]);
  return id;
}

/**
 * Renames photos to <slug>-001.jpg, -002 ... in the given order.
 * Two steps (temporary names first) so no file overwrites another.
 * Updates the cover setting and testimonial photo links.
 * @returns {Promise<Record<string, string>>} old name → new name
 */
export async function renumberPhotos(id, orderedNames) {
  const { category, slug } = parseGalleryId(id);
  const dir = galleryDir(category, slug);
  const current = await photoNames(category, slug);
  orderedNames.forEach(assertPhotoName);
  const same = orderedNames.length === current.length && orderedNames.every((n) => current.includes(n));
  if (!same) throw new UserError('The photo list changed in the meantime. Please reload.', 409);

  const map = {};
  const temporary = [];
  for (const [index, name] of orderedNames.entries()) {
    const temp = `.renumber-${index}${path.extname(name)}`;
    await rename(path.join(dir, name), path.join(dir, temp));
    temporary.push({ name, temp });
  }
  for (const [index, { name, temp }] of temporary.entries()) {
    const ext = path.extname(name).toLowerCase().replace('.jpeg', '.jpg');
    const target = photoName(slug, index + 1).replace(/\.jpg$/, ext);
    await rename(path.join(dir, temp), path.join(dir, target));
    if (target !== name) map[name] = target;
  }
  // Renamed photos get a new version, so no old thumbnail is shown for them
  await markChanged(Object.values(map).map((name) => path.join(dir, name)));

  if (Object.keys(map).length) {
    // Photo descriptions are keyed by file name: rename them too
    await renameAlts(dir, map);
    const file = path.join(dir, 'gallery.md');
    const { doc, body } = await readMarkdown(file);
    const cover = toPlain(doc).cover;
    if (cover && map[cover]) {
      doc.set('cover', map[cover]);
      await writeMarkdown(file, doc, body);
    }
    await renamePhotoRefs(id, map);
  }
  return map;
}

/** Checks the form data from the editor before anything is written. */
async function validate(payload, photos, posters = []) {
  const { fields, categories, mainCategory, slug } = payload;
  assertSlug(slug, 'Folder name');
  if (!Array.isArray(categories) || categories.length === 0) throw new UserError('Tick at least one category.');
  for (const c of categories) {
    assertSlug(c, 'Category');
    await assertCategory(c);
  }
  if (!categories.includes(mainCategory)) throw new UserError('The main category must be one of the ticked categories.');
  if (fields.region && !REGIONS.includes(fields.region)) throw new UserError('Unknown region.');
  if (fields.date && !/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) throw new UserError('The date must look like 2026-06-14.');
  if (fields.coverFocus && !/^\d{1,3}% \d{1,3}%$/.test(fields.coverFocus)) throw new UserError('Invalid cover focus point.');
  if (fields.cover && !photos.includes(fields.cover)) throw new UserError(`The cover "${fields.cover}" is not in this gallery.`);
  for (const video of payload.videos ?? []) {
    if (!/^\d+$/.test(String(video.vimeoId ?? ''))) {
      throw new UserError('Each video needs the number from its Vimeo address (vimeo.com/1226323019 → 1226323019).');
    }
    if (!String(video.title ?? '').trim()) throw new UserError('Each video needs a title.');
    if (!video.poster || !posters.includes(video.poster)) throw new UserError(`Choose or upload a preview image for "${video.title}".`);
  }
  for (const url of fields.legacyUrls ?? []) {
    if (!/^\/[\w\-./]*$/.test(url)) throw new UserError(`Old address "${url}" must start with / (e.g. /PalaisDaunKinsky/).`);
  }
}

/**
 * Saves the editor form.
 * @param {string} id current id
 * @param {{ fields: object, story: string, categories: string[], mainCategory: string, slug: string }} payload
 * @returns the saved gallery (with its possibly new id)
 */
export async function saveGallery(id, payload) {
  const current = await readGallery(id);
  await validate(payload, current.photos.map((p) => p.name), current.posters);
  const { fields, story, categories, mainCategory, slug } = payload;

  const newId = `${mainCategory}/${slug}`;
  const legacyUrls = [...new Set(fields.legacyUrls ?? [])];
  let renamed = {}; // old photo name → new photo name, if the photos were renumbered

  // Main category or folder name changed → move the folder, keep the old address working
  if (newId !== id) {
    const target = galleryDir(mainCategory, slug);
    if (await exists(target)) throw new UserError(`A gallery "${newId}" already exists. Choose another folder name.`, 409);
    await moveFile(galleryDir(current.category, current.slug), target);
    if (!current.fields.draft && !legacyUrls.includes(current.url)) legacyUrls.push(current.url);
    await renameInOrders(id, newId);
    await renameGalleryRefs(id, newId);
    // Photo names follow the folder name (descriptive file names help Google Images)
    if (slug !== current.slug) renamed = await renumberPhotos(newId, current.photos.map((p) => p.name));
  }

  const file = path.join(galleryDir(mainCategory, slug), 'gallery.md');
  const { doc } = await readMarkdown(file);
  // The cover chosen in the form uses the old file names: translate it if photos were renamed
  const cover = fields.cover ? (renamed[fields.cover] ?? fields.cover) : '';
  applyChanges(doc, {
    title: fields.title?.trim(),
    type: fields.type?.trim(),
    couple: fields.couple?.trim(),
    location: fields.location?.trim(),
    region: fields.region,
    date: fields.date,
    cover,
    coverFocus: fields.coverFocus,
    alsoIn: categories.filter((c) => c !== mainCategory),
    seoTitle: fields.seoTitle?.trim(),
    seoDescription: fields.seoDescription?.trim(),
    draft: fields.draft ? true : undefined, // only written when true
    legacyUrls,
    // Only touched when the form sends videos (older forms don't)
    ...(Array.isArray(payload.videos)
      ? { videos: payload.videos.map((v) => ({ vimeoId: String(v.vimeoId), title: String(v.title).trim(), poster: v.poster })) }
      : {}),
  });
  await writeMarkdown(file, doc, story ?? '');
  if (payload.de) await writeGerman(galleryDir(mainCategory, slug), payload.de);

  await syncGalleryInOrders(newId, categories);
  return readGallery(newId);
}

/** Moves a gallery to the trash. Returns the trash entry id (for Undo). */
export async function deleteGallery(id) {
  const gallery = await readGallery(id);
  const positions = await positionsOf(id);
  const detached = await detachGallery(id);
  const entry = await moveToTrash({
    kind: 'gallery',
    label: `Gallery "${gallery.displayTitle}" (${gallery.photos.length} photos)`,
    paths: [galleryDir(gallery.category, gallery.slug)],
    extra: { galleryId: id, positions, detached },
  });
  await updateOrders((ids) => ids.filter((x) => x !== id));
  return entry;
}

/** Called after a gallery came back from the trash: order positions and review links. */
export async function afterGalleryRestored(manifest) {
  const { galleryId, positions, detached } = manifest.extra ?? {};
  if (!galleryId) return;
  await restorePositions(galleryId, positions ?? {});
  await reattachGallery(detached);
}

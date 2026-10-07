/**
 * ============================================================================
 * PHOTOS  (tools/gallery-manager/api/photos.mjs)
 * ============================================================================
 *
 * Photo operations inside gallery folders. They are applied to the files
 * immediately (no Save button needed):
 *
 * - uploadPhoto   optimise (2400 px, rotate, remove GPS) and add as next number;
 *                 skips exact duplicates and warns about small originals
 * - reorderPhotos rename to <slug>-001, -002 ... in the dragged order
 * - deletePhotos  move to the trash (can be restored)
 * - movePhotos    move to another gallery (added at its end)
 *
 * Photos used by a testimonial can't be deleted or moved until the review
 * uses another photo, so the website never breaks.
 *
 * Photo descriptions (photos.yaml, see alts.mjs) travel with their photo:
 * they are renamed, moved, put in the trash and restored together with it.
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';
import { UserError, assertPhotoName, exists, galleryDir, parseGalleryId, ROOT } from './paths.mjs';
import { readMarkdown, toPlain, writeMarkdown } from './frontmatter.mjs';
import { markChanged, photoNames, readGallery, renumberPhotos } from './galleries.mjs';
import { reviewsUsingPhotos } from './testimonials.mjs';
import { moveFile, moveToTrash } from './trash.mjs';
import { addAlts, setAlt, takeAlts } from './alts.mjs';
import { JPEG_QUALITY, optimisePhoto, photoName } from '../../../scripts/lib/photos.mjs';

/** Photos with a long side below this are flagged: they may look soft on big screens. */
export const MIN_LONG_EDGE = 1500;

/** Fingerprints of existing photos, remembered per file version (for duplicate detection). */
const hashCache = new Map();
async function fileHash(file) {
  const { mtimeMs, size } = await stat(file);
  const key = `${file}|${mtimeMs}|${size}`;
  if (!hashCache.has(key)) hashCache.set(key, createHash('sha1').update(await readFile(file)).digest('hex'));
  return hashCache.get(key);
}

/** The next free "<slug>-NNN.jpg" name in a folder. */
async function nextPhotoName(category, slug) {
  const names = await photoNames(category, slug);
  let number = names.length + 1;
  while (await exists(path.join(galleryDir(category, slug), photoName(slug, number)))) number++;
  return photoName(slug, number);
}

async function assertNotUsedByReviews(galleryId, names, action) {
  const used = await reviewsUsingPhotos(galleryId, names);
  if (used.length) {
    const who = used.map((r) => `${r.names} (${r.galleryPhoto})`).join(', ');
    throw new UserError(`Can't ${action}: used as the review photo of ${who}. Choose another photo in Testimonials first.`, 409);
  }
}

/**
 * Adds one uploaded photo.
 * @returns {Promise<{ name?: string, skipped?: 'duplicate', duplicateOf?: string, warnings: string[] }>}
 */
export async function uploadPhoto(galleryId, originalName, buffer) {
  const { category, slug } = parseGalleryId(galleryId);
  const dir = galleryDir(category, slug);
  if (!(await exists(dir))) throw new UserError('This gallery no longer exists.', 404);

  let photo;
  try {
    photo = await optimisePhoto(buffer);
  } catch {
    throw new UserError(`"${originalName}" could not be read as a photo.`);
  }

  // Exact duplicate? Optimising the same original always gives identical bytes.
  for (const name of await photoNames(category, slug)) {
    if ((await fileHash(path.join(dir, name))) === photo.hash) {
      return { skipped: 'duplicate', duplicateOf: name, warnings: [`"${originalName}" is already in this gallery (${name}).`] };
    }
  }

  const name = await nextPhotoName(category, slug);
  await writeFile(path.join(dir, name), photo.buffer);

  const warnings = [];
  const longEdge = Math.max(photo.originalWidth, photo.originalHeight);
  if (longEdge < MIN_LONG_EDGE) {
    warnings.push(`"${originalName}" is only ${longEdge} px on the long side and may look soft. Export at least ${MIN_LONG_EDGE} px.`);
  }
  return { name, warnings };
}

/** Saves a new photo order. `names` = all photo names from first to last. */
export async function reorderPhotos(galleryId, names) {
  return renumberPhotos(galleryId, names);
}

/** Moves photos to the trash. Returns the trash entry id (for Undo). */
export async function deletePhotos(galleryId, names) {
  names.forEach(assertPhotoName);
  const gallery = await readGallery(galleryId);
  const dir = galleryDir(gallery.category, gallery.slug);
  for (const name of names) {
    if (!gallery.photos.some((p) => p.name === name)) throw new UserError(`"${name}" is not in this gallery.`, 404);
  }
  await assertNotUsedByReviews(galleryId, names, 'delete');

  // If the chosen cover is deleted, the website falls back to the first photo
  const coverDeleted = names.includes(gallery.fields.cover);
  if (coverDeleted) await setCover(galleryId, undefined);

  // The descriptions go into the trash entry too, so Undo brings them back
  const alts = await takeAlts(dir, names);

  return moveToTrash({
    kind: 'photos',
    label: `${names.length} photo${names.length > 1 ? 's' : ''} from "${gallery.displayTitle}"`,
    paths: names.map((name) => path.join(dir, name)),
    extra: { galleryId, cover: coverDeleted ? gallery.fields.cover : null, alts },
  });
}

/** Moves photos into another gallery (they are added at its end). */
export async function movePhotos(fromId, toId, names) {
  names.forEach(assertPhotoName);
  if (fromId === toId) throw new UserError('Choose a different gallery.');
  const from = await readGallery(fromId);
  const to = await readGallery(toId);
  await assertNotUsedByReviews(fromId, names, 'move');

  const moved = {};
  for (const name of names) {
    if (!from.photos.some((p) => p.name === name)) throw new UserError(`"${name}" is not in this gallery.`, 404);
    const target = await nextPhotoName(to.category, to.slug);
    await moveFile(path.join(galleryDir(from.category, from.slug), name), path.join(galleryDir(to.category, to.slug), target));
    moved[name] = target;
  }
  // New name in the other gallery: a new version, so no old thumbnail is shown
  await markChanged(Object.values(moved).map((name) => path.join(galleryDir(to.category, to.slug), name)));
  if (names.includes(from.fields.cover)) await setCover(fromId, undefined);

  // Descriptions follow their photos under the new names
  const alts = await takeAlts(galleryDir(from.category, from.slug), names);
  await addAlts(
    galleryDir(to.category, to.slug),
    Object.fromEntries(Object.entries(alts).map(([name, alt]) => [moved[name], alt])),
  );
  return moved;
}

/**
 * Turns photos by 90° (right = clockwise) or 180°. The file keeps its name, so
 * descriptions, cover and review links stay as they are. The cover focus point
 * is turned along with the photo.
 * @param {number} degrees 90, -90 (left) or 180
 */
export async function rotatePhotos(galleryId, names, degrees) {
  names.forEach(assertPhotoName);
  if (![90, -90, 180].includes(degrees)) throw new UserError('Choose left, right or upside down.');
  const gallery = await readGallery(galleryId);
  const dir = galleryDir(gallery.category, gallery.slug);
  for (const name of names) {
    if (!gallery.photos.some((p) => p.name === name)) throw new UserError(`"${name}" is not in this gallery.`, 404);
  }

  const files = [];
  for (const name of names) {
    const file = path.join(dir, name);
    // .rotate() first applies a camera orientation tag, then the wanted turn.
    // Saved like an uploaded photo (same JPEG quality, no camera data).
    const buffer = await sharp(file)
      .rotate()
      .rotate((degrees + 360) % 360)
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    // Write next to it first, then replace: a half-written photo is never left behind
    const temporary = path.join(dir, `.rotate-${name}`);
    await writeFile(temporary, buffer);
    await rename(temporary, file);
    files.push(file);
  }
  // New version, so the manager and the preview show the turned photo right away
  await markChanged(files);

  // The cover's focus point ("left% top%") turns with the photo
  const focus = /^(\d{1,3})% (\d{1,3})%$/.exec(gallery.fields.coverFocus ?? '');
  if (focus && names.includes(gallery.coverPhoto)) {
    const [x, y] = [Number(focus[1]), Number(focus[2])];
    const turned = degrees === 90 ? [100 - y, x] : degrees === -90 ? [y, 100 - x] : [100 - x, 100 - y];
    const file = path.join(dir, 'gallery.md');
    const { doc, body } = await readMarkdown(file);
    doc.set('coverFocus', `${turned[0]}% ${turned[1]}%`);
    await writeMarkdown(file, doc, body);
  }
  return { rotated: names.length };
}

/** Writes (or removes) the cover setting directly. */
async function setCover(galleryId, cover) {
  const { category, slug } = parseGalleryId(galleryId);
  const file = path.join(galleryDir(category, slug), 'gallery.md');
  const { doc, body } = await readMarkdown(file);
  if (cover) doc.set('cover', cover);
  else doc.delete('cover');
  await writeMarkdown(file, doc, body);
}

/** Saves the description of one photo in both languages (from the editor). */
export async function savePhotoAlt(galleryId, name, alt) {
  assertPhotoName(name);
  const gallery = await readGallery(galleryId);
  if (!gallery.photos.some((p) => p.name === name)) throw new UserError(`"${name}" is not in this gallery.`, 404);
  const clip = (text) => (typeof text === 'string' ? text.slice(0, 300) : undefined);
  await setAlt(galleryDir(gallery.category, gallery.slug), name, { en: clip(alt?.en), de: clip(alt?.de) });
}

/** Called after photos came back from the trash: restore the cover and the descriptions. */
export async function afterPhotosRestored(manifest, restoredPaths) {
  const { galleryId, cover, alts } = manifest.extra ?? {};
  if (!galleryId) return;
  // Restored photos may take a name that another photo had in the meantime
  await markChanged(restoredPaths.map((p) => path.join(ROOT, p)).filter((p) => /\.(jpe?g|png|webp|avif)$/i.test(p)));

  // Descriptions, under the name each photo was restored as (maybe "-restored")
  if (alts && Object.keys(alts).length) {
    const { category, slug } = parseGalleryId(galleryId);
    const dir = galleryDir(category, slug);
    const entries = {};
    for (const [index, item] of manifest.items.entries()) {
      const original = path.basename(item.original);
      if (alts[original]) entries[path.basename(restoredPaths[index])] = alts[original];
    }
    if (await exists(dir)) await addAlts(dir, entries);
  }

  if (!cover) return;
  const index = manifest.items.findIndex((item) => path.basename(item.original) === cover);
  if (index < 0) return;
  const { category, slug } = parseGalleryId(galleryId);
  const file = path.join(galleryDir(category, slug), 'gallery.md');
  if (!(await exists(file)) || toPlain((await readMarkdown(file)).doc).cover) return;
  await setCover(galleryId, path.basename(path.join(ROOT, restoredPaths[index])));
}

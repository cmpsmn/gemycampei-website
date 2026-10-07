/**
 * ============================================================================
 * TESTIMONIALS  (tools/gallery-manager/api/testimonials.mjs)
 * ============================================================================
 *
 * Reads and writes the reviews in src/content/testimonials/<id>.md:
 *
 *   ---
 *   names: "Annie & Huong"
 *   gallery: dolomites-elopement-photographer/val-di-funes-couple-session-a-and-h    (optional)
 *   galleryPhoto: val-di-funes-couple-session-a-and-h-001.jpg (optional)
 *   image: ./annie-and-huong.jpg                              (optional)
 *   order: 1
 *   ---
 *   The review text ...
 *
 * It also keeps links valid when galleries or photos are renamed, moved or
 * deleted (the functions at the bottom are used by galleries.mjs / photos.mjs).
 * ============================================================================
 */

import { copyFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { TESTIMONIALS, UserError, assertSlug, exists, galleryDir, parseGalleryId, rel } from './paths.mjs';
import { applyChanges, readMarkdown, toPlain, writeMarkdown } from './frontmatter.mjs';
import { moveToTrash } from './trash.mjs';
import { optimisePhoto, slugify } from '../../../scripts/lib/photos.mjs';

const fileOf = (id) => path.join(TESTIMONIALS, `${assertSlug(id, 'Testimonial')}.md`);

/** "./annie-and-huong.jpg" → absolute path of the photo next to the Markdown file */
const ownImagePath = (image) => (typeof image === 'string' && image ? path.join(TESTIMONIALS, path.basename(image)) : null);

async function readTestimonial(id) {
  const { doc, body } = await readMarkdown(fileOf(id));
  const data = toPlain(doc);
  const image = ownImagePath(data.image);
  return {
    id,
    names: data.names ?? '',
    text: body.trim(),
    gallery: data.gallery ?? '',
    galleryPhoto: data.galleryPhoto ?? '',
    image: image && (await exists(image)) ? rel(image) : '',
    order: data.order ?? 100,
  };
}

/** All reviews in page order. */
export async function listTestimonials() {
  const ids = (await readdir(TESTIMONIALS)).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  const list = await Promise.all(ids.map(readTestimonial));
  return list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Creates a new review file and returns its id. */
export async function createTestimonial({ names }) {
  if (!names?.trim()) throw new UserError('Please enter the names.');
  const base = slugify(names) || 'review';
  let id = base;
  for (let n = 2; await exists(fileOf(id)); n++) id = `${base}-${n}`;
  const order = Math.max(0, ...(await listTestimonials()).map((t) => t.order)) + 1;
  const doc = new YAML.Document({ names: names.trim(), order });
  await writeMarkdown(fileOf(id), doc, '');
  return id;
}

/** Saves names, text, gallery link and gallery photo. */
export async function saveTestimonial(id, { names, text, gallery, galleryPhoto }) {
  if (!(await exists(fileOf(id)))) throw new UserError('This review no longer exists.', 404);
  if (!names?.trim()) throw new UserError('Please enter the names.');

  if (gallery) {
    const { category, slug } = parseGalleryId(gallery);
    if (!(await exists(galleryDir(category, slug)))) throw new UserError(`The gallery "${gallery}" does not exist.`);
    if (galleryPhoto && !(await exists(path.join(galleryDir(category, slug), path.basename(galleryPhoto))))) {
      throw new UserError(`"${galleryPhoto}" is not a photo in that gallery.`);
    }
  } else if (galleryPhoto) {
    throw new UserError('Choose a gallery before picking a photo from it.');
  }

  const { doc } = await readMarkdown(fileOf(id));
  const hasOwnImage = ownImagePath(toPlain(doc).image) && (await exists(ownImagePath(toPlain(doc).image)));
  if (!galleryPhoto && !hasOwnImage) {
    throw new UserError('Choose a photo from the linked gallery or upload one for this review.');
  }
  applyChanges(doc, { names: names.trim(), gallery: gallery || undefined, galleryPhoto: galleryPhoto || undefined });
  await writeMarkdown(fileOf(id), doc, text ?? '');
  return readTestimonial(id);
}

/** Uploads an own photo for the review (replaces a gallery photo choice). */
export async function uploadTestimonialImage(id, buffer) {
  if (!(await exists(fileOf(id)))) throw new UserError('This review no longer exists.', 404);
  const photo = await optimisePhoto(buffer).catch(() => {
    throw new UserError('This file could not be read as a photo.');
  });
  await writeFile(path.join(TESTIMONIALS, `${id}.jpg`), photo.buffer);
  const { doc, body } = await readMarkdown(fileOf(id));
  applyChanges(doc, { image: `./${id}.jpg`, galleryPhoto: undefined });
  await writeMarkdown(fileOf(id), doc, body);
  return readTestimonial(id);
}

/** Moves the review (and its own photo) to the trash. */
export async function deleteTestimonial(id) {
  const review = await readTestimonial(id);
  const paths = [fileOf(id)];
  if (review.image) paths.push(path.join(TESTIMONIALS, path.basename(review.image)));
  return moveToTrash({ kind: 'testimonial', label: `Review of ${review.names}`, paths });
}

/** Saves a new order (ids from top to bottom). */
export async function reorderTestimonials(ids) {
  for (const [index, id] of ids.entries()) {
    const { doc, body } = await readMarkdown(fileOf(id));
    doc.set('order', index + 1);
    await writeMarkdown(fileOf(id), doc, body);
  }
}

// ---------------------------------------------------------------------------
// Keeping links valid when galleries and photos change
// ---------------------------------------------------------------------------

/** Applies a change to every review that links to `galleryId`. */
async function forEachLinked(galleryId, change) {
  for (const review of await listTestimonials()) {
    if (review.gallery !== galleryId) continue;
    const { doc, body } = await readMarkdown(fileOf(review.id));
    if ((await change(doc, review)) !== false) await writeMarkdown(fileOf(review.id), doc, body);
  }
}

/** A gallery was moved or renamed. */
export async function renameGalleryRefs(oldId, newId) {
  await forEachLinked(oldId, (doc) => doc.set('gallery', newId));
}

/** Photos of a gallery were renamed. `map` = { oldName: newName } */
export async function renamePhotoRefs(galleryId, map) {
  await forEachLinked(galleryId, (doc, review) => {
    if (!review.galleryPhoto || !map[review.galleryPhoto]) return false;
    doc.set('galleryPhoto', map[review.galleryPhoto]);
  });
}

/** Reviews that use one of these photos (deleting/moving them would break the review). */
export async function reviewsUsingPhotos(galleryId, names) {
  return (await listTestimonials()).filter((r) => r.gallery === galleryId && names.includes(r.galleryPhoto));
}

/**
 * A gallery is deleted: reviews linked to it keep working. A photo taken from
 * the gallery is copied next to the review first. Returns what is needed to
 * link them again when the gallery is restored.
 */
export async function detachGallery(galleryId) {
  const detached = [];
  const { category, slug } = parseGalleryId(galleryId);
  await forEachLinked(galleryId, async (doc, review) => {
    let copiedImage = false;
    if (review.galleryPhoto && !review.image) {
      await copyFile(path.join(galleryDir(category, slug), review.galleryPhoto), path.join(TESTIMONIALS, `${review.id}.jpg`));
      doc.set('image', `./${review.id}.jpg`);
      copiedImage = true;
    }
    doc.delete('gallery');
    doc.delete('galleryPhoto');
    detached.push({ id: review.id, gallery: galleryId, galleryPhoto: review.galleryPhoto, copiedImage });
  });
  return detached;
}

/** Undo detachGallery() after restoring a gallery from the trash. */
export async function reattachGallery(detached = []) {
  for (const link of detached) {
    if (!(await exists(fileOf(link.id)))) continue;
    const { doc, body } = await readMarkdown(fileOf(link.id));
    applyChanges(doc, { gallery: link.gallery, galleryPhoto: link.galleryPhoto || undefined });
    if (link.copiedImage) {
      doc.delete('image');
      await rm(path.join(TESTIMONIALS, `${link.id}.jpg`), { force: true });
    }
    await writeMarkdown(fileOf(link.id), doc, body);
  }
}

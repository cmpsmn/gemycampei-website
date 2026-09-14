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
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UserError, assertPhotoName, exists, galleryDir, parseGalleryId, ROOT } from './paths.mjs';
import { readMarkdown, toPlain, writeMarkdown } from './frontmatter.mjs';
import { photoNames, readGallery, renumberPhotos } from './galleries.mjs';
import { reviewsUsingPhotos } from './testimonials.mjs';
import { moveFile, moveToTrash } from './trash.mjs';
import { optimisePhoto, photoName } from '../../../scripts/lib/photos.mjs';

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

  return moveToTrash({
    kind: 'photos',
    label: `${names.length} photo${names.length > 1 ? 's' : ''} from "${gallery.displayTitle}"`,
    paths: names.map((name) => path.join(dir, name)),
    extra: { galleryId, cover: coverDeleted ? gallery.fields.cover : null },
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
  if (names.includes(from.fields.cover)) await setCover(fromId, undefined);
  return moved;
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

/** Called after photos came back from the trash: restore the cover if it was deleted. */
export async function afterPhotosRestored(manifest, restoredPaths) {
  const { galleryId, cover } = manifest.extra ?? {};
  if (!galleryId || !cover) return;
  const index = manifest.items.findIndex((item) => path.basename(item.original) === cover);
  if (index < 0) return;
  const { category, slug } = parseGalleryId(galleryId);
  const file = path.join(galleryDir(category, slug), 'gallery.md');
  if (!(await exists(file)) || toPlain((await readMarkdown(file)).doc).cover) return;
  await setCover(galleryId, path.basename(path.join(ROOT, restoredPaths[index])));
}

/**
 * ============================================================================
 * CATEGORIES & GALLERY ORDER  (tools/gallery-manager/api/categories.mjs)
 * ============================================================================
 *
 * Reads the category folders in galleries/ (each has a _category.md) and
 * manages the `galleryOrder` list in each _category.md:
 *
 *   galleryOrder:
 *     - weddings/palais-daun-kinsky-wedding-vienna
 *     - weddings/schloss-hernstein-wedding-austria
 *
 * The website shows the galleries of a category page in this order
 * (see byCategoryOrder in src/lib/galleries.ts).
 * ============================================================================
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { GALLERIES, UserError, exists } from './paths.mjs';
import { readMarkdown, toPlain, writeMarkdown } from './frontmatter.mjs';

const categoryFile = (id) => path.join(GALLERIES, id, '_category.md');

/** All categories in menu order, with the settings the manager needs. */
export async function listCategories() {
  const categories = [];
  for (const entry of await readdir(GALLERIES, { withFileTypes: true })) {
    if (!entry.isDirectory() || !(await exists(categoryFile(entry.name)))) continue;
    const data = toPlain((await readMarkdown(categoryFile(entry.name))).doc);
    categories.push({
      id: entry.name,
      label: data.menuLabel ?? entry.name,
      singular: data.singular ?? '',
      display: data.display ?? 'cards',
      region: data.region ?? 'destination',
      menuOrder: data.order ?? 100,
      galleryOrder: Array.isArray(data.galleryOrder) ? data.galleryOrder : [],
    });
  }
  return categories.sort((a, b) => a.menuOrder - b.menuOrder || a.id.localeCompare(b.id));
}

export async function assertCategory(id) {
  if (!(await exists(categoryFile(id)))) throw new UserError(`Category "${id}" does not exist.`);
}

/** Replaces the galleryOrder list of one category. */
export async function writeGalleryOrder(categoryId, ids) {
  await assertCategory(categoryId);
  const file = categoryFile(categoryId);
  const { doc, body } = await readMarkdown(file);
  if (doc.has('galleryOrder')) doc.set('galleryOrder', ids);
  else {
    const pair = doc.createPair('galleryOrder', ids);
    pair.key.commentBefore =
      ' Order of the galleries on this page (managed by npm run manage).\n Galleries not listed here follow, newest first.';
    doc.contents.items.push(pair);
  }
  await writeMarkdown(file, doc, body);
}

/**
 * Changes the order lists of all categories at once.
 * @param {(ids: string[], categoryId: string) => string[]} change returns the new list
 */
export async function updateOrders(change) {
  for (const category of await listCategories()) {
    const next = change([...category.galleryOrder], category.id);
    const changed = next.length !== category.galleryOrder.length || next.some((id, i) => id !== category.galleryOrder[i]);
    if (changed) await writeGalleryOrder(category.id, next);
  }
}

/**
 * Makes the order lists match a gallery's categories:
 * - ticked categories that don't list it yet → added at the top (new galleries show first)
 * - unticked categories → removed
 */
export async function syncGalleryInOrders(galleryId, categoryIds) {
  await updateOrders((ids, categoryId) => {
    const listed = ids.includes(galleryId);
    const wanted = categoryIds.includes(categoryId);
    if (wanted && !listed) return [galleryId, ...ids];
    if (!wanted && listed) return ids.filter((id) => id !== galleryId);
    return ids;
  });
}

/** A gallery got a new id (moved or renamed): update it everywhere. */
export async function renameInOrders(oldId, newId) {
  await updateOrders((ids) => ids.map((id) => (id === oldId ? newId : id)));
}

/** Where a gallery appears in which list (stored in the trash to restore positions). */
export async function positionsOf(galleryId) {
  const positions = {};
  for (const category of await listCategories()) {
    const index = category.galleryOrder.indexOf(galleryId);
    if (index >= 0) positions[category.id] = index;
  }
  return positions;
}

/** Puts a gallery back at stored positions (after restoring from the trash). */
export async function restorePositions(galleryId, positions) {
  await updateOrders((ids, categoryId) => {
    if (!(categoryId in positions) || ids.includes(galleryId)) return ids;
    ids.splice(Math.min(positions[categoryId], ids.length), 0, galleryId);
    return ids;
  });
}

/**
 * ============================================================================
 * PATHS & SAFETY CHECKS  (tools/gallery-manager/api/paths.mjs)
 * ============================================================================
 *
 * Every folder the manager works with, plus checks for names that come from
 * the browser. The manager deletes, moves and renames files, so names like
 * "../../Windows" must never reach the file system. All names are checked
 * against strict patterns before they are used in a path.
 * ============================================================================
 */

import { access, stat } from 'node:fs/promises';
import path from 'node:path';

/** Project root (two folders up from tools/gallery-manager/api) */
export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const GALLERIES = path.join(ROOT, 'galleries');
export const TESTIMONIALS = path.join(ROOT, 'src', 'content', 'testimonials');
/** Packages pages keep their own photos next to the Markdown */
export const PACKAGES = path.join(ROOT, 'src', 'content', 'packages');
/** Deleted items go here and can be restored. Ignored by Git, never uploaded. */
export const TRASH = path.join(ROOT, '.trash');
/** Generated thumbnails for the manager (inside node_modules, so never committed) */
export const CACHE = path.join(ROOT, 'node_modules', '.cache', 'gallery-manager');

/** An error with an HTTP status, shown as a message in the manager. */
export class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Folder and file base names: lowercase letters, numbers and single dashes. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Photo file names: no folders, only safe characters, image extension. */
const PHOTO_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._ -]*\.(jpe?g|png|webp|avif)$/i;

export function assertSlug(value, what = 'Name') {
  if (typeof value !== 'string' || !SLUG.test(value) || value.length > 120) {
    throw new UserError(`${what} may only contain lowercase letters, numbers and dashes (e.g. "lago-di-braies").`);
  }
  return value;
}

export function assertPhotoName(value) {
  if (typeof value !== 'string' || !PHOTO_FILE.test(value) || value.includes('..')) {
    throw new UserError(`"${value}" is not a valid photo file name.`);
  }
  return value;
}

/** "vienna-wedding-photographer/palais-kinsky" → { category, slug } (both checked) */
export function parseGalleryId(id) {
  const [category, slug, extra] = String(id).split('/');
  if (extra !== undefined) throw new UserError(`Invalid gallery id "${id}".`);
  return { category: assertSlug(category, 'Category'), slug: assertSlug(slug, 'Gallery folder') };
}

export const galleryDir = (category, slug) => path.join(GALLERIES, category, slug);

/** Project-relative path with forward slashes, for messages and the browser. */
export const rel = (absolute) => path.relative(ROOT, absolute).split(path.sep).join('/');

/**
 * Turns a project-relative path from the browser back into an absolute path,
 * but only if it lies inside one of the allowed folders.
 */
export function resolveInside(relative, allowedRoots = [GALLERIES, TESTIMONIALS, PACKAGES]) {
  const absolute = path.resolve(ROOT, String(relative));
  const allowed = allowedRoots.some((root) => absolute === root || absolute.startsWith(root + path.sep));
  if (!allowed) throw new UserError('Access to this file is not allowed.', 403);
  return absolute;
}

export async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(file) {
  try {
    return (await stat(file)).isDirectory();
  } catch {
    return false;
  }
}

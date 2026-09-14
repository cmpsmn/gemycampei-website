/**
 * ============================================================================
 * TRASH  (tools/gallery-manager/api/trash.mjs)
 * ============================================================================
 *
 * Nothing the manager deletes is gone immediately. Deleted galleries, photos
 * and testimonials are MOVED into the project's `.trash/` folder:
 *
 *   .trash/
 *     2026-09-14_18-42-07_k3f9/        ← one entry per delete action
 *       manifest.json                  ← what was deleted, where it came from
 *       items/0-lago-di-braies-001.jpg ← the files themselves
 *
 * An entry can be restored (files go back to where they were) or deleted for
 * good. `.trash/` is listed in .gitignore, so it is never uploaded.
 * ============================================================================
 */

import { cp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ROOT, TRASH, UserError, exists, rel } from './paths.mjs';

/**
 * Moves a file or folder. `rename` is instant but only works on the same
 * drive; otherwise copy + delete (error code EXDEV = "cross-device").
 */
export async function moveFile(from, to) {
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await rename(from, to);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await cp(from, to, { recursive: true });
    await rm(from, { recursive: true, force: true });
  }
}

/** "2026-09-14_18-42-07_k3f9": sortable by time, unique thanks to the random part */
function newEntryId() {
  const stamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  return `${stamp}_${randomBytes(2).toString('hex')}`;
}

/**
 * Moves files/folders into a new trash entry.
 * @param {{ kind: 'gallery' | 'photos' | 'testimonial', label: string, paths: string[], extra?: object }} options
 *   `extra` stores information needed to undo side effects (order positions, links ...)
 * @returns {Promise<string>} the entry id (used for "Undo")
 */
export async function moveToTrash({ kind, label, paths, extra = {} }) {
  const id = newEntryId();
  const entryDir = path.join(TRASH, id);
  const items = [];
  for (const [index, source] of paths.entries()) {
    const stored = `items/${index}-${path.basename(source)}`;
    await moveFile(source, path.join(entryDir, stored));
    items.push({ original: rel(source), stored });
  }
  const manifest = { id, kind, label, createdAt: new Date().toISOString(), items, extra };
  await writeFile(path.join(entryDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return id;
}

async function readManifest(id) {
  if (!/^[\w-]+$/.test(id)) throw new UserError('Invalid trash entry.');
  const file = path.join(TRASH, id, 'manifest.json');
  if (!(await exists(file))) throw new UserError('This item is no longer in the trash.', 404);
  return JSON.parse(await readFile(file, 'utf8'));
}

/** All entries, newest first. */
export async function listTrash() {
  if (!(await exists(TRASH))) return [];
  const entries = [];
  for (const id of await readdir(TRASH)) {
    try {
      const manifest = await readManifest(id);
      entries.push({
        id,
        kind: manifest.kind,
        label: manifest.label,
        createdAt: manifest.createdAt,
        count: manifest.items.length,
      });
    } catch {
      // ignore folders that are not trash entries
    }
  }
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Moves the files of an entry back. If a photo with the same name exists in
 * the meantime, the restored file gets "-restored" added to its name.
 * @returns {Promise<{ manifest: object, restored: string[] }>} restored = project-relative paths
 */
export async function restoreFromTrash(id) {
  const manifest = await readManifest(id);
  const restored = [];
  for (const item of manifest.items) {
    let target = path.join(ROOT, item.original);
    if (await exists(target)) {
      if (manifest.kind === 'gallery') {
        throw new UserError(`Cannot restore: "${item.original}" exists again. Rename or delete that gallery first.`, 409);
      }
      const { dir, name, ext } = path.parse(target);
      let n = 1;
      do target = path.join(dir, `${name}-restored${n > 1 ? `-${n}` : ''}${ext}`);
      while (await exists(target) && ++n);
    }
    await moveFile(path.join(TRASH, id, item.stored), target);
    restored.push(rel(target));
  }
  await rm(path.join(TRASH, id), { recursive: true, force: true });
  return { manifest, restored };
}

export async function deleteTrashEntry(id) {
  await readManifest(id); // validates the id
  await rm(path.join(TRASH, id), { recursive: true, force: true });
}

export async function emptyTrash() {
  await rm(TRASH, { recursive: true, force: true });
}

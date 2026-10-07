/**
 * ============================================================================
 * PHOTO DESCRIPTIONS  (tools/gallery-manager/api/alts.mjs)
 * ============================================================================
 *
 * Each gallery folder may contain `photos.yaml` with a description (alt text)
 * per photo, in English and German:
 *
 *   lago-di-braies-elopement-s-and-j-001.jpg:
 *     en: Couple on the boathouse terrace at Lago di Braies
 *     de: Paar auf der Terrasse des Bootshauses am Pragser Wildsee
 *
 * The website reads it in src/lib/galleries.ts. The descriptions are keyed by
 * file name, so every photo operation that renames, moves or deletes photos
 * calls one of the helpers below to keep the file in step.
 * ============================================================================
 */

import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { exists } from './paths.mjs';

const FILE = 'photos.yaml';

const HEADER = `# Photo descriptions (alt texts) for this gallery: what is in each photo.
# Read by search engines, Google Images and screen readers.
# Keep them short and natural (about 125 characters). The gallery manager
# (npm run manage) keeps this file in step when photos are renamed,
# moved or deleted. Photos without an entry get a generic description.
`;

/** @typedef {{ en?: string, de?: string }} Alt */

/** All descriptions of a gallery folder: { "<file>": { en, de } } */
export async function readAlts(dir) {
  const file = path.join(dir, FILE);
  if (!(await exists(file))) return {};
  const data = YAML.parse(await readFile(file, 'utf8'));
  return data && typeof data === 'object' ? data : {};
}

/** Writes the descriptions in file-name order (removes the file when empty). */
async function writeAlts(dir, alts) {
  const file = path.join(dir, FILE);
  const names = Object.keys(alts)
    .filter((name) => alts[name] && (alts[name].en || alts[name].de))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (names.length === 0) {
    if (await exists(file)) await rm(file);
    return;
  }
  const clean = Object.fromEntries(
    names.map((name) => {
      const { en, de } = alts[name];
      return [name, { ...(en ? { en } : {}), ...(de ? { de } : {}) }];
    }),
  );
  await writeFile(file, `${HEADER}\n${YAML.stringify(clean, { lineWidth: 0 })}`, 'utf8');
}

/** Photos were renamed: { old name: new name } (photos not in the map keep their entry). */
export async function renameAlts(dir, map) {
  const alts = await readAlts(dir);
  if (Object.keys(alts).length === 0) return;
  const renamed = {};
  for (const [name, alt] of Object.entries(alts)) renamed[map[name] ?? name] = alt;
  await writeAlts(dir, renamed);
}

/**
 * Removes the entries of some photos (deleted or moved away).
 * @returns {Promise<Record<string, Alt>>} the removed entries, to restore or move them
 */
export async function takeAlts(dir, names) {
  const alts = await readAlts(dir);
  const taken = {};
  for (const name of names) {
    if (alts[name]) {
      taken[name] = alts[name];
      delete alts[name];
    }
  }
  if (Object.keys(taken).length) await writeAlts(dir, alts);
  return taken;
}

/** Adds entries under (possibly new) names: entries = { "<file>": { en, de } } */
export async function addAlts(dir, entries) {
  if (!entries || Object.keys(entries).length === 0) return;
  await writeAlts(dir, { ...(await readAlts(dir)), ...entries });
}

/** Sets or clears the description of one photo (from the editor). */
export async function setAlt(dir, name, alt) {
  const alts = await readAlts(dir);
  alts[name] = { en: alt.en?.trim() || undefined, de: alt.de?.trim() || undefined };
  await writeAlts(dir, alts);
}

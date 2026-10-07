#!/usr/bin/env node
/**
 * ============================================================================
 * IMPORT GALLERIES FROM THE OLD PIXIESET SITE  (scripts/import-pixieset.mjs)
 * ============================================================================
 *
 * Downloads every photo of the Weddings and The Alps galleries from
 * www.gemycampei.com (Pixieset) into the matching gallery folders.
 *
 *   npm run import-pixieset                         all galleries of both categories
 *   npm run import-pixieset -- --dry-run            only show what would happen
 *   npm run import-pixieset -- --only LagoDiBraies  one gallery (old Pixieset address)
 *
 * How it works:
 * 1. The category pages (/THEWEDDING/, /THEALPS/) link to their galleries.
 * 2. Each gallery is matched to its local folder through `legacyUrls` in
 *    gallery.md (e.g. "/LagoDiBraies/"). Galleries without a folder get a new
 *    draft gallery in the category they were found in.
 * 3. From every photo Pixieset offers several sizes; the largest (2500 px) is
 *    downloaded and optimised exactly like uploads in the gallery manager
 *    (2400 px, rotated, metadata removed), in the order of the Pixieset page.
 * 4. The old photos of the folder are moved to `.trash/`. You can restore them
 *    in the gallery manager (npm run manage → Trash).
 * 5. The cover and photos used by testimonials are found again among the new
 *    photos by comparing tiny thumbnails, so your choices are kept. A cover
 *    that isn't part of the Pixieset gallery stays as the first photo.
 *
 * Running it again is safe: galleries whose photos are unchanged are skipped.
 * Drafts stay drafts. Publish them in the manager once the story is written.
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { optimisePhoto, photoName } from './lib/photos.mjs';
import { galleryDir, rel } from '../tools/gallery-manager/api/paths.mjs';
import { applyChanges, readMarkdown, writeMarkdown } from '../tools/gallery-manager/api/frontmatter.mjs';
import { createGallery, listGalleries, readGallery } from '../tools/gallery-manager/api/galleries.mjs';
import { moveToTrash } from '../tools/gallery-manager/api/trash.mjs';
import { renamePhotoRefs, reviewsUsingPhotos } from '../tools/gallery-manager/api/testimonials.mjs';

const SITE = 'https://www.gemycampei.com';

/** Pixieset category page → local category folder */
const SOURCES = [
  { page: '/THEWEDDING/', category: 'vienna-wedding-photographer' },
  { page: '/THEALPS/', category: 'dolomites-elopement-photographer' },
];

/** Photos downloaded at the same time (kind to the server, still fast) */
const PARALLEL_DOWNLOADS = 4;

/**
 * Two photos count as "the same picture" when their 24×24 grey thumbnails
 * differ by less than this on average (0 = identical, 255 = black vs white).
 * Resized or recompressed copies of one photo stay far below it.
 */
const SAME_PHOTO_DISTANCE = 12;

const HEADERS = { 'User-Agent': 'gemycampei-import/1.0 (own website migration)' };

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

const { values: options } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    only: { type: 'string', multiple: true, default: [] },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (options.help) {
  console.log(`Usage: npm run import-pixieset -- [--dry-run] [--only <PixiesetAddress> ...]`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** "/LagoDiBraies/", "lagodibraies" and "https://…/LagoDiBraies" all give "lagodibraies" */
const addressKey = (url) => url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+|\/+$/g, '').toLowerCase();

/** Fetch with a few retries (networks hiccup, downloads shouldn't fail because of it). */
async function download(url, as = 'buffer') {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return as === 'text' ? await response.text() : Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= 3) throw new Error(`Download failed: ${url} (${error.message})`);
      await sleep(1500 * attempt);
    }
  }
}

/** Runs `worker` for all items, at most `limit` at a time; results keep the item order. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

const sha1 = (buffer) => createHash('sha1').update(buffer).digest('hex');

/** Tiny grey thumbnail used to recognise the same picture in another size. */
const fingerprint = (input) => sharp(input).rotate().resize(24, 24, { fit: 'fill' }).greyscale().raw().toBuffer();

function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

// ---------------------------------------------------------------------------
// Reading Pixieset pages (plain text search, no browser needed)
// ---------------------------------------------------------------------------

const decodeEntities = (text) =>
  text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

/** Value of an attribute inside one HTML tag */
function attribute(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 's').exec(tag);
  return match ? decodeEntities(match[2]) : undefined;
}

const tagsOf = (html, tagName) => [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'g'))].map((m) => m[0]);

const metaContent = (html, property) =>
  tagsOf(html, 'meta').map((tag) => (attribute(tag, 'property') === property ? attribute(tag, 'content') : undefined)).find(Boolean);

/** "url 300w, url 2500w" → the url with the biggest width */
function largestInSrcset(srcset = '') {
  return srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .filter(([url, width]) => url && width?.endsWith('w'))
    .sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0]?.[0];
}

/** Gallery links on a category page: the image cards ("fb-element-type-image--anchor") */
function galleryLinks(html) {
  const links = tagsOf(html, 'a')
    .filter((tag) => (attribute(tag, 'class') ?? '').includes('fb-element-type-image--anchor'))
    .map((tag) => attribute(tag, 'href') ?? '')
    .map((href) => href.replace(SITE, '').replace('https://gemycampei.com', ''))
    .filter((href) => /^\/[^/]+\/$/.test(href));
  return [...new Set(links)];
}

/** Title, description and photo URLs (largest size, page order) of a gallery page */
function readGalleryPage(html) {
  const photos = [];
  const seen = new Set();
  for (const tag of tagsOf(html, 'img')) {
    if (!(attribute(tag, 'class') ?? '').includes('image-grid__image')) continue;
    let url = largestInSrcset(attribute(tag, 'srcset')) ?? attribute(tag, 'src');
    if (!url?.includes('pixieset.com/site/')) continue;
    if (url.startsWith('//')) url = `https:${url}`;
    // ".../site/<account>/<photo id>/<file>": the id is the same for every size of one photo
    const id = /\/site\/[^/]+\/([^/]+)\//.exec(url)?.[1] ?? url;
    if (seen.has(id)) continue;
    seen.add(id);
    photos.push(url);
  }
  const title = (metaContent(html, 'og:title') ?? '').replace(/\s*-\s*GEMYCAMPEI\s*$/i, '');
  return { title, description: metaContent(html, 'og:description') ?? '', photos };
}

// ---------------------------------------------------------------------------
// Importing one gallery
// ---------------------------------------------------------------------------

/**
 * @param {string} address  old Pixieset address, e.g. "/LagoDiBraies/"
 * @param {string} category local category for galleries that don't exist yet
 * @param {Map<string, string>} localByAddress addressKey → local gallery id
 */
async function importGallery(address, category, localByAddress) {
  const page = readGalleryPage(await download(SITE + address, 'text'));
  let galleryId = localByAddress.get(addressKey(address));
  const target = galleryId ? `galleries/${galleryId}/` : `new gallery in galleries/${category}/`;
  console.log(`\n${address}  →  ${target}  (${page.photos.length} photos, "${page.title}")`);

  if (page.photos.length === 0) {
    console.log('  No photos found on this page, skipped.');
    return { status: 'skipped' };
  }
  if (options['dry-run']) return { status: 'dry-run' };

  // 1. Download + optimise, keeping the Pixieset order
  let done = 0;
  const warnings = [];
  const photos = await mapLimit(page.photos, PARALLEL_DOWNLOADS, async (url) => {
    const photo = await optimisePhoto(await download(url));
    done++;
    // "\r" rewrites the same line in a terminal; in logs only the final count is printed
    if (process.stdout.isTTY) process.stdout.write(`\r  Downloading ${done}/${page.photos.length}`);
    else if (done === page.photos.length) process.stdout.write(`  Downloaded ${done} photos`);
    if (Math.max(photo.originalWidth, photo.originalHeight) < 1500) {
      warnings.push(`${path.basename(url)} is only ${Math.max(photo.originalWidth, photo.originalHeight)} px on the long side.`);
    }
    return photo;
  });
  process.stdout.write('\n');

  // 2. A gallery that doesn't exist locally yet: create it as a draft
  if (!galleryId) {
    galleryId = await createGallery({ category, title: page.title || addressKey(address) });
    const file = path.join(galleryDir(...galleryId.split('/')), 'gallery.md');
    const { doc } = await readMarkdown(file);
    applyChanges(doc, { legacyUrls: [address] });
    await writeMarkdown(file, doc, page.description ? `${page.description}\n` : '');
    localByAddress.set(addressKey(address), galleryId);
    console.log(`  Created galleries/${galleryId}/ (draft)`);
  }

  const gallery = await readGallery(galleryId);
  const dir = galleryDir(gallery.category, gallery.slug);
  const oldNames = gallery.photos.map((p) => p.name);

  // 3. Find the cover and review photos again among the downloaded photos
  const newPrints = await Promise.all(photos.map((p) => fingerprint(p.buffer)));
  const reviews = await reviewsUsingPhotos(galleryId, oldNames);
  const keep = [...new Set([gallery.coverPhoto, ...reviews.map((r) => r.galleryPhoto)].filter(Boolean))];
  const foundIndex = {};
  for (const name of keep) {
    const print = await fingerprint(path.join(dir, name));
    const best = newPrints.map((p, i) => ({ i, d: distance(print, p) })).sort((a, b) => a.d - b.d)[0];
    if (best && best.d <= SAME_PHOTO_DISTANCE) foundIndex[name] = best.i;
  }

  // A cover that is not part of the Pixieset gallery (often the separate card
  // image of the category page) stays in the gallery as the first photo, so
  // the title image you chose doesn't disappear.
  let keptCover = false;
  if (gallery.coverPhoto && foundIndex[gallery.coverPhoto] === undefined) {
    const buffer = await readFile(path.join(dir, gallery.coverPhoto));
    photos.unshift({ buffer, hash: sha1(buffer) });
    for (const name of Object.keys(foundIndex)) foundIndex[name]++;
    foundIndex[gallery.coverPhoto] = 0;
    keptCover = true;
  }
  const newNames = photos.map((_, i) => photoName(gallery.slug, i + 1));
  const found = Object.fromEntries(Object.entries(foundIndex).map(([name, i]) => [name, newNames[i]]));

  // 4. Nothing changed since the last import?
  const oldHashes = await Promise.all(oldNames.map(async (name) => sha1(await readFile(path.join(dir, name)))));
  if (oldHashes.length === photos.length && oldHashes.every((hash, i) => hash === photos[i].hash)) {
    console.log('  Already up to date.');
    return { status: 'unchanged' };
  }

  const lostReview = reviews.find((r) => !found[r.galleryPhoto]);
  if (lostReview) {
    console.log(`  Skipped: the review of ${lostReview.names} uses ${lostReview.galleryPhoto}, which is not on Pixieset.`);
    console.log('  Choose another review photo in the manager (Testimonials) and run the import again.');
    return { status: 'skipped' };
  }

  // 5. Old photos → trash, new photos in
  if (oldNames.length) {
    await moveToTrash({
      kind: 'photos',
      label: `${oldNames.length} old photo${oldNames.length > 1 ? 's' : ''} of "${gallery.displayTitle}" (replaced by Pixieset import)`,
      paths: oldNames.map((name) => path.join(dir, name)),
      extra: { galleryId },
    });
  }
  await Promise.all(photos.map((photo, i) => writeFile(path.join(dir, newNames[i]), photo.buffer)));

  // 6. Cover: the same picture as before (the first photo needs no setting)
  const file = path.join(dir, 'gallery.md');
  const { doc, body } = await readMarkdown(file);
  const cover = found[gallery.coverPhoto];
  applyChanges(doc, { cover: cover && cover !== newNames[0] ? cover : undefined });
  if (!cover) applyChanges(doc, { coverFocus: undefined });
  await writeMarkdown(file, doc, body);
  if (keptCover) {
    warnings.push(`Your cover is not part of the Pixieset gallery, so it was kept as the first photo (${newNames[0]}). Delete it in the manager if you don't want it in the gallery.`);
  }

  // 7. Reviews linked to photos of this gallery
  if (reviews.length) await renamePhotoRefs(galleryId, Object.fromEntries(reviews.map((r) => [r.galleryPhoto, found[r.galleryPhoto]])));

  console.log(`  Saved ${photos.length} photos to ${rel(dir)}/ (replaced ${oldNames.length}, old ones in .trash/)`);
  if (cover) console.log(`  Cover: ${cover}`);
  if (gallery.fields.draft) console.log('  Still a draft: publish it in the manager (npm run manage) when it is ready.');
  for (const warning of warnings) console.log(`  ! ${warning}`);
  return { status: 'imported' };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Local galleries by their old Pixieset addresses
const localByAddress = new Map();
for (const summary of await listGalleries()) {
  const gallery = await readGallery(summary.id);
  for (const url of gallery.fields.legacyUrls) localByAddress.set(addressKey(url), summary.id);
}

// Gallery addresses per category page (a gallery listed twice is imported once)
const queue = new Map();
for (const { page, category } of SOURCES) {
  const links = galleryLinks(await download(SITE + page, 'text'));
  console.log(`${page}: ${links.length} galleries`);
  for (const link of links) if (!queue.has(addressKey(link))) queue.set(addressKey(link), { address: link, category });
}

const only = new Set(options.only.map(addressKey));
const jobs = [...queue.values()].filter((job) => only.size === 0 || only.has(addressKey(job.address)));
if (only.size && jobs.length === 0) {
  console.error(`\nNone of these addresses is linked from the category pages: ${options.only.join(', ')}`);
  process.exit(1);
}

const counts = {};
let failed = false;
for (const job of jobs) {
  try {
    const { status } = await importGallery(job.address, job.category, localByAddress);
    counts[status] = (counts[status] ?? 0) + 1;
  } catch (error) {
    failed = true;
    counts.failed = (counts.failed ?? 0) + 1;
    console.log(`\n  ✗ ${job.address}: ${error.message}`);
  }
}

console.log(`\nDone: ${Object.entries(counts).map(([status, n]) => `${n} ${status}`).join(', ') || 'nothing to do'}.`);
if (!options['dry-run'] && counts.imported) {
  console.log('Check the galleries with `npm run manage` or `npm run dev`, then commit and push.');
}
process.exit(failed ? 1 : 0);

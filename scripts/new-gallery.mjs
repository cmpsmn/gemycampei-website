/**
 * ============================================================================
 * NEW GALLERY SCRIPT  (scripts/new-gallery.mjs)
 * ============================================================================
 *
 * Creates a gallery folder with optimised photos and a gallery.md file.
 * You can also just create a folder and copy photos in by hand. This script
 * saves a few steps and makes the photos web-ready.
 *
 * USAGE (in the terminal, from the project folder)
 *   npm run new-gallery -- --category the-alps --type Elopement --title "Lago di Braies" --couple "S & J" --place "Dolomites" --photos "C:\Export\Braies"
 *
 * OPTIONS
 *   --category  category folder in galleries/ (required): weddings, the-alps, maternity, 35mm-super-8-film
 *   --title     venue or place, becomes the big title (required)
 *   --type      kind of shoot, e.g. Elopement, "Couple Session", Proposal (optional,
 *               default: the category's `singular`)
 *   --couple    names or initials shown above the title (optional)
 *   --place     extra words for the folder name / URL, e.g. "Vienna" or "Dolomites" (optional)
 *   --also-in   more categories, comma separated, e.g. "35mm-super-8-film" (optional)
 *   --photos    folder with exported photos (optional)
 *
 * WHAT HAPPENS WITH THE PHOTOS
 * - resized to max. 2400 px on the long side (plenty for the web, small repository)
 * - rotated according to the camera orientation
 * - ALL metadata removed, including GPS location (privacy of your couples)
 * - renamed to "<folder-name>-001.jpg", "-002.jpg" ... in the original order.
 *   Descriptive file names help Google Images.
 *
 * The first photo becomes the cover. Change `cover:` in gallery.md to use another.
 *
 * TIP: the gallery manager (npm run manage) does all of this with drag & drop.
 * ============================================================================
 */

import { mkdir, readdir, writeFile, access } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
// Shared with the gallery manager, so both prepare photos the same way
import { optimisePhoto, slugify, photoName, naturalSort, PHOTO_EXTENSIONS } from './lib/photos.mjs';

const root = path.resolve(import.meta.dirname, '..');
const galleriesDir = path.join(root, 'galleries');

// parseArgs reads "--category weddings" style options from the command line
const { values: args } = parseArgs({
  options: {
    category: { type: 'string' },
    title: { type: 'string' },
    type: { type: 'string' },
    couple: { type: 'string' },
    place: { type: 'string' },
    'also-in': { type: 'string' },
    photos: { type: 'string' },
  },
});

// Category folders = folders in galleries/ that contain a _category.md
const categories = [];
for (const entry of await readdir(galleriesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    await access(path.join(galleriesDir, entry.name, '_category.md'));
    categories.push(entry.name);
  } catch {
    // not a category folder
  }
}

if (!args.category || !args.title) {
  console.error(
    'Usage: npm run new-gallery -- --category <category> --title "Venue" [--type "Elopement"] [--couple "S & J"] [--place "Dolomites"] [--also-in "35mm-super-8-film"] [--photos "C:\\path"]',
  );
  console.error(`Categories: ${categories.join(', ')}`);
  process.exit(1);
}

// Check the main category and the extra ones
const alsoIn = (args['also-in'] ?? '')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);
for (const category of [args.category, ...alsoIn]) {
  if (!categories.includes(category)) {
    console.error(`Unknown category "${category}". Available: ${categories.join(', ')}`);
    process.exit(1);
  }
}

// Folder name: title + type + place + couple, e.g. "lago-di-braies-elopement-dolomites-s-and-j"
const slug = slugify([args.title, args.type, args.place, args.couple].filter(Boolean).join(' '));
const galleryDir = path.join(galleriesDir, args.category, slug);

try {
  await access(galleryDir);
  console.error(`This gallery folder already exists: ${path.relative(root, galleryDir)}`);
  process.exit(1);
} catch {
  // does not exist yet: good
}

await mkdir(galleryDir, { recursive: true });

// Optimise and copy the photos
let count = 0;
if (args.photos) {
  const files = (await readdir(args.photos))
    .filter((file) => PHOTO_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort(naturalSort);

  if (files.length === 0) console.warn(`No photos found in ${args.photos}`);

  for (const file of files) {
    count++;
    // resize to 2400 px, rotate, remove GPS/camera data (see scripts/lib/photos.mjs)
    const { buffer } = await optimisePhoto(path.join(args.photos, file));
    await writeFile(path.join(galleryDir, photoName(slug, count)), buffer);
    process.stdout.write(`\rProcessed ${count}/${files.length} photos`);
  }
  if (count) process.stdout.write('\n');
}

// Write gallery.md with helpful comments
const quote = (text) => `"${text.replace(/"/g, '\\"')}"`;
const galleryMd = `---
# Gallery settings. Every field is optional and explained in src/content.config.ts
title: ${quote(args.title)}
# Kind of shoot, e.g. "Elopement", "Couple Session", "Proposal" (default: from the category)
${args.type ? `type: ${quote(args.type)}` : '# type: "Elopement"'}
${args.couple ? `couple: ${quote(args.couple)}` : '# couple: "S & J"'}
# Readable place for page titles and Google, e.g. "Vienna, Austria" or "Lago di Braies, Dolomites, Italy"
location: ${quote(args.place ?? '')}
# vienna | dolomites | austria | destination   (default: from the category)
# region: dolomites
# More categories this gallery also appears in (folder names)
alsoIn: [${alsoIn.join(', ')}]
date: ${new Date().toISOString().slice(0, 10)}
# The title image: file name of a photo in this folder
${count ? `cover: ${slug}-001.jpg` : `# cover: ${slug}-001.jpg`}
# true = only visible with npm run dev
draft: ${count === 0}
# Old addresses that should redirect here
legacyUrls: []
---

Write the story of this gallery here: the place, the mood, what made the day special.
Mention the location by name, it helps people find this gallery on Google.
`;

await writeFile(path.join(galleryDir, 'gallery.md'), galleryMd);

console.log(`\nCreated ${path.relative(root, galleryDir)}`);
console.log(`URL after the next build: /${args.category}/${slug}/`);
if (count === 0) console.log('\nNext: copy photos into the folder, then set draft: false in gallery.md.');
console.log('Then write the story in gallery.md and preview with: npm run dev');

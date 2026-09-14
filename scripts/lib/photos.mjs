/**
 * ============================================================================
 * PHOTO HELPERS  (scripts/lib/photos.mjs)
 * ============================================================================
 *
 * Shared by the gallery manager (tools/gallery-manager) and the command line
 * script scripts/new-gallery.mjs, so both prepare photos exactly the same way.
 *
 * optimisePhoto() makes a photo web-ready:
 * - resized to max. 2400 px on the long side (plenty for the website, keeps
 *   the Git repository small; Astro creates the smaller sizes during the build)
 * - rotated according to the camera orientation
 * - ALL metadata removed, including GPS location (privacy of your couples)
 * - saved as JPEG with the mozjpeg encoder (smaller files at the same quality)
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import sharp from 'sharp';

/** Longest side after optimising, in pixels */
export const MAX_EDGE = 2400;

/** JPEG quality (0–100). 85 looks identical to the original on screen. */
export const JPEG_QUALITY = 85;

/** File types accepted as photos (sharp can read all of them) */
export const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.heic']);

/** File names that count as photos inside a gallery folder */
export const isGalleryPhoto = (name) => /\.(jpe?g|png|webp|avif)$/i.test(name);

/** Sort file names like a human: "2.jpg" before "10.jpg" */
export const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Makes text safe for folder and file names and URLs.
 * "Lago di Braies & Co" → "lago-di-braies-and-co"
 */
export function slugify(text) {
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // é → e
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "palais-kinsky" + 7 → "palais-kinsky-007.jpg" */
export const photoName = (slug, number) => `${slug}-${String(number).padStart(3, '0')}.jpg`;

/**
 * Optimises one photo.
 * @param {string | Buffer} input file path or file content
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, originalWidth: number, originalHeight: number, hash: string }>}
 *   `hash` is a fingerprint of the result, used to detect duplicate uploads.
 */
export async function optimisePhoto(input) {
  const source = sharp(input, { failOn: 'error' });
  const meta = await source.metadata();

  // Width/height as the photo is displayed (orientation 5–8 = rotated by 90°)
  const rotated = (meta.orientation ?? 1) >= 5;
  const originalWidth = rotated ? meta.height : meta.width;
  const originalHeight = rotated ? meta.width : meta.height;

  const { data, info } = await source
    .rotate() // apply camera orientation; metadata is dropped by default
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    originalWidth,
    originalHeight,
    hash: createHash('sha1').update(data).digest('hex'),
  };
}

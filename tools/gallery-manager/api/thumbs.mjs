/**
 * ============================================================================
 * THUMBNAILS  (tools/gallery-manager/api/thumbs.mjs)
 * ============================================================================
 *
 * The manager shows many photos at once. Sending the 2400 px originals would
 * be slow, so this creates small WebP versions on demand and keeps them in
 * node_modules/.cache/gallery-manager (never committed, safe to delete).
 *
 * URL: /api/file?path=galleries/vienna-wedding-photographer/x/x-001.jpg&w=400&v=<version>&t=<token>
 * `v` changes when the file changes, so the browser never shows an old image.
 * ============================================================================
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { CACHE, UserError, exists, resolveInside } from './paths.mjs';

/** Allowed thumbnail widths (a few fixed sizes = fewer cached files) */
const WIDTHS = [160, 400, 800, 1400];

/**
 * Sends a resized version of a gallery or testimonial photo.
 * @param {URLSearchParams} params
 * @param {import('node:http').ServerResponse} res
 */
export async function sendThumbnail(params, res) {
  const file = resolveInside(params.get('path') ?? '');
  if (!/\.(jpe?g|png|webp|avif)$/i.test(file) || !(await exists(file))) throw new UserError('Photo not found.', 404);

  const requested = Number(params.get('w')) || 400;
  const width = WIDTHS.find((w) => w >= requested) ?? WIDTHS.at(-1);

  const { mtimeMs, size } = await stat(file);
  const key = createHash('sha1').update(`${file}|${mtimeMs}|${size}|${width}`).digest('hex');
  const cached = path.join(CACHE, `${key}.webp`);

  if (!(await exists(cached))) {
    await mkdir(CACHE, { recursive: true });
    await sharp(file)
      .rotate()
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(cached);
  }

  res.writeHead(200, {
    'Content-Type': 'image/webp',
    // The URL contains the file version, so the browser may keep it for a long time
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  createReadStream(cached).pipe(res);
}

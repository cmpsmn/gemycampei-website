/**
 * ============================================================================
 * FRESH PREVIEW IMAGES  (src/lib/freshImages.ts)
 * ============================================================================
 *
 * Only for the preview (npm run dev / the gallery manager's Preview button).
 *
 * In the preview, a photo's address is made from its file name. When the
 * gallery manager reorders photos it renames the files, so "…-034.jpg" may
 * suddenly contain a different photo. A browser that saw the old "…-034.jpg"
 * keeps showing it, and a photo appears twice. Adding the file's modification
 * time to the address gives every changed photo a new address.
 *
 * The built website needs none of this: there every image address contains a
 * fingerprint of the image content.
 * ============================================================================
 */
import type { ImageMetadata } from 'astro';
import { statSync } from 'node:fs';
import path from 'node:path';

/**
 * Adds "&v=<modification time>" to the preview address of each image.
 * @param files the result of an eager import.meta.glob of images, keyed by "/galleries/…"
 */
export function freshInPreview<T extends Record<string, ImageMetadata>>(files: T): T {
  if (!import.meta.env.DEV) return files;
  for (const [key, image] of Object.entries(files)) {
    try {
      const version = Math.round(statSync(path.join(process.cwd(), key)).mtimeMs);
      // The objects are shared between page loads: replace an older version mark
      image.src = `${image.src.replace(/[&?]v=\d+$/, '')}${image.src.includes('?') ? '&' : '?'}v=${version}`;
    } catch {
      // File just removed: Vite reloads this module in a moment anyway
    }
  }
  return files;
}

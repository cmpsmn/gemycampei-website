/**
 * ============================================================================
 * PREVIEW  (tools/gallery-manager/api/preview.mjs)
 * ============================================================================
 *
 * The "Preview" button shows a page exactly as the website will look.
 * It uses Astro's dev server (the same as `npm run dev`), started in the
 * background the first time and reused afterwards. Drafts are visible there.
 *
 * The dev server keeps running after the manager is closed; stop it with
 * `npx astro dev stop` (the manager stops it on exit if it started it).
 * ============================================================================
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { ROOT, UserError } from './paths.mjs';

const run = promisify(execFile);
const ASTRO = path.join(ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
export const PREVIEW_PORT = 4321;

let startedByManager = false;

/** Runs `astro dev <args>` with the same Node.js that runs the manager. */
const astroDev = (...args) => run(process.execPath, [ASTRO, 'dev', ...args], { cwd: ROOT, timeout: 120_000 });

/** The address of a running dev server, or null */
async function runningUrl() {
  try {
    const { stdout } = await astroDev('status');
    const match = /(https?:\/\/[^\s"\\]+)/.exec(stdout);
    return /running/i.test(stdout) && match ? match[1].replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

/**
 * Makes sure the dev server runs and returns the full URL for a page.
 * @param {string} pagePath e.g. "/vienna-wedding-photographer/palais-daun-kinsky-wedding-vienna/"
 */
export async function previewUrl(pagePath = '/') {
  if (!/^\/[a-z0-9/-]*$/.test(pagePath)) throw new UserError('Invalid page address.');
  let base = await runningUrl();
  if (!base) {
    await astroDev('--background', '--port', String(PREVIEW_PORT));
    startedByManager = true;
    // Wait until it answers (the first start can take a few seconds)
    for (let i = 0; i < 60 && !base; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      base = await runningUrl();
    }
    if (!base) throw new UserError('The preview server did not start. Try `npm run dev` in a terminal.', 500);
  }
  return `${base}${pagePath}`;
}

/** Stops the dev server again if the manager started it. */
export async function stopPreview() {
  if (startedByManager) await astroDev('stop').catch(() => {});
}

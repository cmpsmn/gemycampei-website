/**
 * ============================================================================
 * CHANGE LIST  (tools/gallery-manager/api/changes.mjs)
 * ============================================================================
 *
 * Asks Git which content files changed since the last commit and groups them
 * so the manager can show "3 photos added to Lago di Braies" instead of a list
 * of file names. Nothing is committed or pushed here: you do that yourself
 * when you are happy (git add . → git commit → git push).
 * ============================================================================
 */

import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { ROOT, exists } from './paths.mjs';

const run = promisify(execFile);

/** Runs a git command in the project folder and returns its output. */
async function git(...args) {
  const { stdout } = await run('git', args, { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

const STATUS = { '??': 'added', A: 'added', M: 'modified', D: 'deleted', R: 'renamed' };

export async function getChanges() {
  if (!(await exists(path.join(ROOT, '.git')))) {
    return { available: false, groups: [], total: 0, lastCommit: null };
  }

  // --porcelain = stable, machine-readable output; -uall = list every new file
  const output = await git('status', '--porcelain=v1', '-uall', '--', 'galleries', 'src/content');
  const groups = new Map();

  for (const line of output.split('\n').filter(Boolean)) {
    const code = line.slice(0, 2).trim();
    let file = line.slice(3).replace(/^"|"$/g, '');
    if (file.includes(' -> ')) file = file.split(' -> ')[1]; // renamed: "old -> new"
    const status = STATUS[code] ?? STATUS[code[0]] ?? 'modified';

    const parts = file.split('/');
    let key;
    let kind;
    let label;
    if (parts[0] === 'galleries' && parts.length >= 4) {
      key = `gallery:${parts[1]}/${parts[2]}`;
      kind = 'gallery';
      label = `${parts[1]} / ${parts[2]}`;
    } else if (parts[0] === 'galleries' && parts[2] === '_category.md') {
      key = `category:${parts[1]}`;
      kind = 'category';
      label = `${parts[1]} (gallery order)`;
    } else if (parts[1] === 'content' && parts[2] === 'testimonials') {
      key = `testimonial:${path.parse(parts[3] ?? '').name}`;
      kind = 'testimonial';
      label = `Review: ${path.parse(parts[3] ?? '').name}`;
    } else {
      key = 'other';
      kind = 'other';
      label = 'Other content files';
    }
    if (!groups.has(key)) groups.set(key, { key, kind, label, files: [] });
    groups.get(key).files.push({ status, path: file });
  }

  let lastCommit = null;
  try {
    const [subject, when] = (await git('log', '-1', '--format=%s%x1f%cr')).trim().split('\x1f');
    lastCommit = { subject, when };
  } catch {
    // no commits yet
  }

  const list = [...groups.values()];
  return { available: true, groups: list, total: list.reduce((sum, g) => sum + g.files.length, 0), lastCommit };
}

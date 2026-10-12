/**
 * ============================================================================
 * PUBLISH  (tools/gallery-manager/api/publish.mjs)
 * ============================================================================
 *
 * The "Publish to the website" button (Publish tab). After the confirmation
 * in the manager it does what you would otherwise type in a terminal:
 *
 *   1. git add     galleries/ and src/content/ only (what the manager edits;
 *                  code changes in other folders are never published by it)
 *   2. git commit  with a message listing the changed galleries
 *   3. git pull    --rebase, in case someone else published in the meantime
 *   4. git push    to master → GitHub builds the site and uploads it to
 *                  Hostinger (.github/workflows/deploy.yml), a few minutes
 *
 * It only publishes from the `master` branch. If anything goes wrong, nothing
 * is lost: the changes stay on this computer and the message says what to do.
 * ============================================================================
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT, UserError } from './paths.mjs';
import { CONTENT_PATHS, getChanges } from './changes.mjs';

const run = promisify(execFile);

/** No password prompts in the background: fail with a message instead of waiting forever */
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=20' };

async function git(...args) {
  const { stdout } = await run('git', args, { cwd: ROOT, env: GIT_ENV, timeout: 180_000, maxBuffer: 20 * 1024 * 1024 });
  return stdout.trim();
}

/** "git@github.com:user/repo.git" or "https://github.com/user/repo.git" → the GitHub Actions page */
async function actionsUrl() {
  try {
    const remote = await git('remote', 'get-url', 'origin');
    const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote);
    return match ? `https://github.com/${match[1]}/actions` : null;
  } catch {
    return null;
  }
}

/** A readable commit message: "Gallery manager: lago-di-braies, seceda (+2 more)" */
function commitMessage(changes, text) {
  if (text?.trim()) return text.trim().slice(0, 200);
  const names = changes.groups.map((g) => (g.kind === 'gallery' ? g.label.split(' / ')[1] : g.label));
  const shown = names.slice(0, 3).join(', ');
  return `Gallery manager: ${shown}${names.length > 3 ? ` (+${names.length - 3} more)` : ''}`;
}

let busy = false;

/**
 * @param {{ message?: string }} options
 * @returns {Promise<{ commit: string, actionsUrl: string | null }>}
 */
export async function publish({ message } = {}) {
  if (busy) throw new UserError('Publishing is already running. Please wait a moment.', 409);
  busy = true;
  try {
    const branch = await git('rev-parse', '--abbrev-ref', 'HEAD');
    if (branch !== 'master') {
      throw new UserError(`The project is on the branch "${branch}", not "master". Publishing from here would not update the website. Please ask Simon.`);
    }

    // 1 + 2: commit the content changes (if there are any)
    const changes = await getChanges();
    if (changes.total > 0) {
      try {
        await git('add', '--all', '--', ...CONTENT_PATHS);
        await git('commit', '--quiet', '-m', commitMessage(changes, message), '--', ...CONTENT_PATHS);
      } catch (error) {
        console.error(error);
        throw new UserError('Saving the changes for publishing failed (details in the Terminal window). Nothing was published. Please ask Simon.', 500);
      }
    }

    // Anything to send at all? (also covers an earlier commit whose push failed)
    await git('fetch', '--quiet', 'origin', 'master').catch(() => {
      throw new UserError('GitHub is not reachable. Check the internet connection and try again. Your changes are saved on this computer.', 502);
    });
    const ahead = Number(await git('rev-list', '--count', 'origin/master..HEAD'));
    if (ahead === 0) throw new UserError('Nothing to publish: the website is already up to date.');

    // 3: someone else published in the meantime → put our commit on top of theirs
    const behind = Number(await git('rev-list', '--count', 'HEAD..origin/master'));
    if (behind > 0) {
      try {
        await git('pull', '--rebase', '--autostash', '--quiet', 'origin', 'master');
      } catch {
        await git('rebase', '--abort').catch(() => {});
        throw new UserError(
          'The website was changed from another computer and the changes overlap with yours. Nothing was published; your changes are saved on this computer. Please ask Simon.',
          409,
        );
      }
    }

    // 4: push → GitHub publishes
    try {
      await git('push', '--quiet', 'origin', 'master');
    } catch (error) {
      console.error(error);
      throw new UserError('Uploading to GitHub failed. Your changes are saved on this computer; try again later or ask Simon.', 502);
    }

    return { commit: await git('log', '-1', '--format=%h %s'), actionsUrl: await actionsUrl() };
  } finally {
    busy = false;
  }
}

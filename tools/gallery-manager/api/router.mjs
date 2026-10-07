/**
 * ============================================================================
 * API ROUTER  (tools/gallery-manager/api/router.mjs)
 * ============================================================================
 *
 * The browser part of the manager talks to this local server with HTTP
 * requests like
 *
 *   GET  /api/state                           everything for the start screen
 *   PUT  /api/galleries/vienna-wedding-photographer/palais/…     save a gallery
 *
 * Each route below connects a method + URL pattern to a function. Values in
 * the URL (":category", ":slug" ...) are passed to the function in `params`.
 *
 * SECURITY
 * The server only listens on this computer (127.0.0.1). On top of that every
 * request must carry a secret token that is created when the manager starts
 * and is only known to the manager page. This stops other websites open in the
 * browser from sending requests to the manager.
 * ============================================================================
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { ROOT, UserError } from './paths.mjs';
import { listCategories, writeGalleryOrder } from './categories.mjs';
import {
  afterGalleryRestored,
  createGallery,
  deleteGallery,
  listGalleries,
  readGallery,
  saveGallery,
  uploadPoster,
} from './galleries.mjs';
import { afterPhotosRestored, deletePhotos, movePhotos, reorderPhotos, savePhotoAlt, uploadPhoto } from './photos.mjs';
import {
  createTestimonial,
  deleteTestimonial,
  listTestimonials,
  reorderTestimonials,
  saveTestimonial,
  uploadTestimonialImage,
} from './testimonials.mjs';
import {
  createJournalEntry,
  deleteJournalEntry,
  listDocuments,
  readDocument,
  saveDocument,
  uploadDocumentImage,
} from './documents.mjs';
import { deleteTrashEntry, emptyTrash, listTrash, restoreFromTrash } from './trash.mjs';
import { galleryChecks } from './checks.mjs';
import { getChanges } from './changes.mjs';
import { previewUrl } from './preview.mjs';
import { sendThumbnail } from './thumbs.mjs';

/** Largest accepted upload (camera JPEGs are usually 10–30 MB) */
const MAX_UPLOAD = 80 * 1024 * 1024;

/** Reads the request body into a Buffer. */
function readBody(req, limit = MAX_UPLOAD) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new UserError('The file is too large (max. 80 MB).', 413));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const body = await readBody(req, 5 * 1024 * 1024);
  try {
    return body.length ? JSON.parse(body.toString('utf8')) : {};
  } catch {
    throw new UserError('Invalid request.');
  }
}

/** Is the German version switched on? (src/content/settings.yaml → german) */
async function germanSwitchedOn() {
  try {
    return YAML.parse(await readFile(path.join(ROOT, 'src', 'content', 'settings.yaml'), 'utf8'))?.german === true;
  } catch {
    return false;
  }
}

/** A gallery with its checks, as the editor expects it. */
async function galleryWithChecks(id) {
  const gallery = await readGallery(id);
  return { ...gallery, checks: galleryChecks(gallery, await listCategories()) };
}

const galleryId = (params) => `${params.category}/${params.slug}`;

// ---------------------------------------------------------------------------
// Route table: [method, pattern, handler]
// A handler returns data (sent as JSON) or `undefined` if it answered itself.
// ---------------------------------------------------------------------------
const routes = [
  ['GET', '/api/state', async () => ({
    categories: await listCategories(),
    galleries: await listGalleries(),
    trashCount: (await listTrash()).length,
    german: await germanSwitchedOn(),
  })],

  // ---- Galleries ----------------------------------------------------------
  ['POST', '/api/galleries', async ({ req }) => ({ id: await createGallery(await readJson(req)) })],
  ['GET', '/api/galleries/:category/:slug', ({ params }) => galleryWithChecks(galleryId(params))],
  ['PUT', '/api/galleries/:category/:slug', async ({ req, params }) => {
    const saved = await saveGallery(galleryId(params), await readJson(req));
    return galleryWithChecks(saved.id);
  }],
  ['DELETE', '/api/galleries/:category/:slug', async ({ params }) => ({ trashEntry: await deleteGallery(galleryId(params)) })],

  // ---- Photos -------------------------------------------------------------
  // One request per file: the file content is the request body, the name is in ?name=
  ['PUT', '/api/galleries/:category/:slug/photos', async ({ req, params, query }) =>
    uploadPhoto(galleryId(params), query.get('name') ?? 'photo', await readBody(req))],
  ['POST', '/api/galleries/:category/:slug/photos/order', async ({ req, params }) =>
    ({ renamed: await reorderPhotos(galleryId(params), (await readJson(req)).names ?? []) })],
  ['POST', '/api/galleries/:category/:slug/photos/delete', async ({ req, params }) =>
    ({ trashEntry: await deletePhotos(galleryId(params), (await readJson(req)).names ?? []) })],
  // The description (alt text) of one photo, in English and German
  ['POST', '/api/galleries/:category/:slug/photos/alt', async ({ req, params }) => {
    const { name, alt } = await readJson(req);
    await savePhotoAlt(galleryId(params), name, alt ?? {});
    return { ok: true };
  }],
  // A video preview image (into the gallery's posters/ folder)
  ['PUT', '/api/galleries/:category/:slug/posters', async ({ req, params, query }) =>
    uploadPoster(galleryId(params), query.get('name') ?? 'poster', await readBody(req))],
  ['POST', '/api/galleries/:category/:slug/photos/move', async ({ req, params }) => {
    const { names = [], to } = await readJson(req);
    return { moved: await movePhotos(galleryId(params), to, names) };
  }],

  // ---- Gallery order per category -----------------------------------------
  ['PUT', '/api/categories/:category/order', async ({ req, params }) => {
    await writeGalleryOrder(params.category, (await readJson(req)).ids ?? []);
    return { ok: true };
  }],

  // ---- Testimonials -------------------------------------------------------
  ['GET', '/api/testimonials', () => listTestimonials()],
  ['POST', '/api/testimonials', async ({ req }) => ({ id: await createTestimonial(await readJson(req)) })],
  ['POST', '/api/testimonials/order', async ({ req }) => {
    await reorderTestimonials((await readJson(req)).ids ?? []);
    return { ok: true };
  }],
  ['PUT', '/api/testimonials/:id', async ({ req, params }) => saveTestimonial(params.id, await readJson(req))],
  ['PUT', '/api/testimonials/:id/image', async ({ req, params }) => uploadTestimonialImage(params.id, await readBody(req))],
  ['DELETE', '/api/testimonials/:id', async ({ params }) => ({ trashEntry: await deleteTestimonial(params.id) })],

  // ---- Other texts: categories, packages, journal, pages, settings ----------
  // (see documents.mjs; ":kind" is one of those five words)
  ['GET', '/api/docs/:kind', ({ params }) => listDocuments(params.kind)],
  ['POST', '/api/docs/journal', async ({ req }) => ({ id: await createJournalEntry(await readJson(req)) })],
  ['GET', '/api/docs/:kind/:id', ({ params }) => readDocument(params.kind, params.id)],
  ['PUT', '/api/docs/:kind/:id', async ({ req, params }) => saveDocument(params.kind, params.id, await readJson(req))],
  ['PUT', '/api/docs/:kind/:id/file', async ({ req, params, query }) =>
    uploadDocumentImage(params.kind, params.id, query.get('name'), await readBody(req))],
  ['DELETE', '/api/docs/journal/:id', async ({ params }) => ({ trashEntry: await deleteJournalEntry(params.id) })],

  // ---- Trash ----------------------------------------------------------------
  ['GET', '/api/trash', () => listTrash()],
  ['POST', '/api/trash/:entry/restore', async ({ params }) => {
    const { manifest, restored } = await restoreFromTrash(params.entry);
    if (manifest.kind === 'gallery') await afterGalleryRestored(manifest);
    if (manifest.kind === 'photos') await afterPhotosRestored(manifest, restored);
    return { kind: manifest.kind, galleryId: manifest.extra?.galleryId ?? null };
  }],
  ['DELETE', '/api/trash/:entry', async ({ params }) => {
    await deleteTrashEntry(params.entry);
    return { ok: true };
  }],
  ['DELETE', '/api/trash', async () => {
    await emptyTrash();
    return { ok: true };
  }],

  // ---- Change list, preview, images -----------------------------------------
  ['GET', '/api/changes', () => getChanges()],
  ['POST', '/api/preview', async ({ req }) => ({ url: await previewUrl((await readJson(req)).path) })],
  ['GET', '/api/file', async ({ res, query }) => {
    await sendThumbnail(query, res);
    return undefined;
  }],
];

/** Turns "/api/galleries/:category/:slug" into a regular expression with named groups. */
const compiled = routes.map(([method, pattern, handler]) => ({
  method,
  handler,
  regex: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
}));

/**
 * Handles one /api request.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ token: string, origins: string[] }} security
 */
export async function handleApi(req, res, { token, origins }) {
  const url = new URL(req.url, 'http://localhost');
  const send = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };

  try {
    // 1. Requests from other websites carry their own Origin: reject them
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin)) throw new UserError('Forbidden origin.', 403);

    // 2. The secret token: in a header for normal requests, in ?t= for <img> tags
    const given = req.headers['x-manager-token'] ?? url.searchParams.get('t');
    if (given !== token) throw new UserError('Missing or wrong manager token. Reload the page.', 403);

    // 3. Find the matching route
    const route = compiled.find((r) => r.method === req.method && r.regex.test(url.pathname));
    if (!route) throw new UserError('Unknown request.', 404);
    const params = Object.fromEntries(
      Object.entries(route.regex.exec(url.pathname).groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]),
    );

    const result = await route.handler({ req, res, params, query: url.searchParams });
    if (result !== undefined) send(200, result);
  } catch (error) {
    const status = error instanceof UserError ? error.status : 500;
    if (status === 500) console.error(error);
    if (!res.headersSent) send(status, { error: error instanceof UserError ? error.message : `Unexpected error: ${error.message}` });
    else res.end();
  }
}

/**
 * ============================================================================
 * API CLIENT  (tools/gallery-manager/app/api.ts)
 * ============================================================================
 *
 * Small functions for every request the app makes to the local server.
 * Components call e.g. `api.saveGallery(id, form)` instead of writing fetch()
 * code themselves.
 *
 * Every request carries the secret token from index.html. Errors from the
 * server (e.g. "Tick at least one category.") are thrown as ApiError, so the
 * components can show the message.
 * ============================================================================
 */
import type {
  AppState,
  Changes,
  GalleryDetail,
  GalleryForm,
  Testimonial,
  TrashEntry,
  UploadResult,
} from './types';

/** The secret the server wrote into index.html */
const token = document.querySelector<HTMLMetaElement>('meta[name="manager-token"]')?.content ?? '';

export class ApiError extends Error {}

/**
 * Sends one request and returns the JSON answer.
 * @param body  JSON data, or a File/Blob that is sent as it is (uploads)
 */
async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Manager-Token': token };
  let payload: BodyInit | undefined;
  if (body instanceof Blob) {
    payload = body;
    headers['Content-Type'] = 'application/octet-stream';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError('The manager server is not reachable. Is `npm run manage` still running?');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error ?? `Request failed (${response.status})`);
  return data as T;
}

export const api = {
  state: () => request<AppState>('GET', '/api/state'),

  // Galleries (an id looks like "weddings/palais-daun-kinsky-wedding-vienna")
  gallery: (id: string) => request<GalleryDetail>('GET', `/api/galleries/${id}`),
  createGallery: (data: { category: string; title: string; type?: string; couple?: string; place?: string }) =>
    request<{ id: string }>('POST', '/api/galleries', data),
  saveGallery: (id: string, form: GalleryForm) => request<GalleryDetail>('PUT', `/api/galleries/${id}`, form),
  deleteGallery: (id: string) => request<{ trashEntry: string }>('DELETE', `/api/galleries/${id}`),

  // Photos
  uploadPhoto: (id: string, file: File) =>
    request<UploadResult>('PUT', `/api/galleries/${id}/photos?name=${encodeURIComponent(file.name)}`, file),
  reorderPhotos: (id: string, names: string[]) =>
    request<{ renamed: Record<string, string> }>('POST', `/api/galleries/${id}/photos/order`, { names }),
  deletePhotos: (id: string, names: string[]) =>
    request<{ trashEntry: string }>('POST', `/api/galleries/${id}/photos/delete`, { names }),
  movePhotos: (id: string, names: string[], to: string) =>
    request<{ moved: Record<string, string> }>('POST', `/api/galleries/${id}/photos/move`, { names, to }),

  // Gallery order on a category page
  saveOrder: (category: string, ids: string[]) => request<{ ok: true }>('PUT', `/api/categories/${category}/order`, { ids }),

  // Testimonials
  testimonials: () => request<Testimonial[]>('GET', '/api/testimonials'),
  createTestimonial: (names: string) => request<{ id: string }>('POST', '/api/testimonials', { names }),
  saveTestimonial: (id: string, data: Pick<Testimonial, 'names' | 'text' | 'gallery' | 'galleryPhoto'>) =>
    request<Testimonial>('PUT', `/api/testimonials/${id}`, data),
  uploadTestimonialImage: (id: string, file: File) => request<Testimonial>('PUT', `/api/testimonials/${id}/image`, file),
  deleteTestimonial: (id: string) => request<{ trashEntry: string }>('DELETE', `/api/testimonials/${id}`),
  reorderTestimonials: (ids: string[]) => request<{ ok: true }>('POST', '/api/testimonials/order', { ids }),

  // Trash
  trash: () => request<TrashEntry[]>('GET', '/api/trash'),
  restore: (entry: string) => request<{ kind: string; galleryId: string | null }>('POST', `/api/trash/${entry}/restore`),
  deleteTrashEntry: (entry: string) => request<{ ok: true }>('DELETE', `/api/trash/${entry}`),
  emptyTrash: () => request<{ ok: true }>('DELETE', '/api/trash'),

  // Publishing helpers
  changes: () => request<Changes>('GET', '/api/changes'),
  preview: (path: string) => request<{ url: string }>('POST', '/api/preview', { path }),
};

/**
 * URL of a small version of a photo (created and cached by the server).
 * @param path project-relative, e.g. "galleries/weddings/x/x-001.jpg"
 * @param width 160, 400, 800 or 1400
 * @param version changes when the file changes, so the browser reloads it
 */
export const fileUrl = (path: string, width: number, version = 0) =>
  `/api/file?path=${encodeURIComponent(path)}&w=${width}&v=${version}&t=${token}`;

export const photoUrl = (galleryId: string, name: string, width: number, version = 0) =>
  fileUrl(`galleries/${galleryId}/${name}`, width, version);

/** Same rules as scripts/lib/photos.mjs, for showing the future folder name while typing */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

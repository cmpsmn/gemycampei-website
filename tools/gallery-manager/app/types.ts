/**
 * ============================================================================
 * DATA TYPES  (tools/gallery-manager/app/types.ts)
 * ============================================================================
 *
 * The shapes of the data the server sends (see tools/gallery-manager/api/).
 * TypeScript uses them to warn about typos like `gallery.titel` while you edit.
 * ============================================================================
 */

export type Display = 'cards' | 'slider' | 'carousel';

export interface Category {
  id: string;
  label: string;
  singular: string;
  display: Display;
  region: string;
  menuOrder: number;
  /** "<category>/<slug>" ids in page order */
  galleryOrder: string[];
}

/** Short info for the sidebar and order lists */
export interface GallerySummary {
  id: string;
  category: string;
  slug: string;
  title: string;
  couple: string;
  draft: boolean;
  photoCount: number;
  coverPhoto: string;
  coverVersion: number;
  categories: string[];
}

export interface Photo {
  name: string;
  width: number;
  height: number;
  size: number;
  /** changes when the file changes (used to refresh thumbnails) */
  version: number;
}

export interface GalleryFields {
  title: string;
  type: string;
  couple: string;
  location: string;
  region: string;
  date: string;
  cover: string;
  coverFocus: string;
  seoTitle: string;
  seoDescription: string;
  draft: boolean;
  legacyUrls: string[];
}

export interface Check {
  level: 'warning' | 'info';
  message: string;
}

export interface GalleryDetail {
  id: string;
  category: string;
  slug: string;
  url: string;
  fields: GalleryFields;
  story: string;
  categories: string[];
  photos: Photo[];
  coverPhoto: string;
  displayTitle: string;
  checks: Check[];
}

/** What the editor form sends when saving */
export interface GalleryForm {
  fields: GalleryFields;
  story: string;
  categories: string[];
  mainCategory: string;
  slug: string;
}

export interface UploadResult {
  name?: string;
  skipped?: 'duplicate';
  duplicateOf?: string;
  warnings: string[];
}

export interface Testimonial {
  id: string;
  names: string;
  text: string;
  gallery: string;
  galleryPhoto: string;
  /** project-relative path of the own photo, or "" */
  image: string;
  order: number;
}

export interface TrashEntry {
  id: string;
  kind: 'gallery' | 'photos' | 'testimonial';
  label: string;
  createdAt: string;
  count: number;
}

export interface Changes {
  available: boolean;
  total: number;
  lastCommit: { subject: string; when: string } | null;
  groups: { key: string; kind: string; label: string; files: { status: string; path: string }[] }[];
}

export interface AppState {
  categories: Category[];
  galleries: GallerySummary[];
  trashCount: number;
}

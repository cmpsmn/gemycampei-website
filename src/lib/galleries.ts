/**
 * ============================================================================
 * GALLERY LOADER  (src/lib/galleries.ts)
 * ============================================================================
 *
 * WHAT THIS FILE DOES
 * It turns the folder structure in `galleries/` into data the pages can use:
 *
 *   galleries/
 *     weddings/                      ← a CATEGORY  (needs _category.md)
 *       _category.md
 *       hero.jpg
 *       palais-daun-kinsky-.../      ← a GALLERY   (gallery.md is optional)
 *         gallery.md
 *         palais-...-001.jpg         ← PHOTOS, sorted by file name
 *
 * HOW IT WORKS
 * 1. `import.meta.glob` (a Vite feature) finds every image file at build time
 *    and imports it. An imported image is an `ImageMetadata` object with
 *    src, width and height, which Astro can resize and convert.
 * 2. From the file paths we know which galleries exist, e.g.
 *    "/galleries/weddings/palais/001.jpg" → category "weddings", gallery "palais".
 * 3. The optional `gallery.md` settings are read from the content collection
 *    "galleryMeta" (see src/content.config.ts) and merged with the photos.
 *
 * MULTIPLE CATEGORIES
 * A gallery's folder is its MAIN category (it decides the URL). With
 * `alsoIn: [the-alps]` in gallery.md it is listed in more categories too.
 *
 * WHO USES IT
 * Pages in src/pages/ call getCategories(), getGalleries() ... and pass the
 * results to components. All functions run ONLY during the build, never in
 * the visitor's browser.
 * ============================================================================
 */

import type { ImageMetadata } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';

// ---------------------------------------------------------------------------
// 1. Collect image files
// ---------------------------------------------------------------------------

/**
 * Every photo in every gallery folder.
 * Accepted file types: jpg, jpeg, png, webp, avif (also in upper case, as cameras export them).
 * `eager: true` imports them immediately, `import: 'default'` gives us the
 * ImageMetadata directly. Result: { "/galleries/weddings/x/001.jpg": ImageMetadata, ... }
 *
 * Note: the pattern must be written literally here. Vite reads it before the
 * code runs, so it cannot be built from variables.
 */
const photoFiles = import.meta.glob<ImageMetadata>(
  '/galleries/*/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' },
);

/** Images directly inside a category folder, e.g. galleries/weddings/hero.jpg */
const categoryFiles = import.meta.glob<ImageMetadata>(
  '/galleries/*/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' },
);

/** Home page photos, two grids with the statement text in between. */
const homeGrid1 = import.meta.glob<ImageMetadata>(
  '/src/assets/home/grid-1/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' },
);
const homeGrid2 = import.meta.glob<ImageMetadata>(
  '/src/assets/home/grid-2/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' },
);

/** Sort file names like a human: "2.jpg" before "10.jpg". */
const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Turns a glob result into a sorted list of images. */
function sortedImages(files: Record<string, ImageMetadata>): ImageMetadata[] {
  return Object.keys(files)
    .sort(naturalSort)
    .map((path) => files[path]);
}

export const getHomeGrid1 = () => sortedImages(homeGrid1);
export const getHomeGrid2 = () => sortedImages(homeGrid2);

// ---------------------------------------------------------------------------
// 2. Types used by pages and components
// ---------------------------------------------------------------------------

export type Region = 'vienna' | 'dolomites' | 'austria' | 'destination';

/** A photo file inside a gallery folder. */
export interface Photo {
  /** File name, e.g. "palais-daun-kinsky-wedding-vienna-006.jpg" */
  name: string;
  image: ImageMetadata;
}

/** A category = one folder in galleries/ with a _category.md file. */
export interface Category {
  /** Folder name and URL segment, e.g. "weddings" */
  id: string;
  href: string;
  data: CollectionEntry<'categories'>['data'];
  /** The _category.md entry, rendered later by the page (intro text) */
  entry: CollectionEntry<'categories'>;
  hero: ImageMetadata;
}

/** A gallery = one folder inside a category folder. */
export interface Gallery {
  /** Folder name, e.g. "palais-daun-kinsky-wedding-vienna" */
  slug: string;
  /** "<category>/<slug>", unique across the site */
  id: string;
  /** Main category = the folder the gallery lives in */
  categoryId: string;
  /** Main category + every category from `alsoIn` */
  categoryIds: string[];
  href: string;
  title: string;
  /** Kind of shoot: gallery.md `type`, or `singular` of the main category */
  typeLabel: string;
  couple?: string;
  location?: string;
  region: Region;
  date?: Date;
  /** Important spot of the cover for the card crop, e.g. "50% 30%" */
  coverFocus?: string;
  draft: boolean;
  seoTitle?: string;
  seoDescription?: string;
  legacyUrls: string[];
  photos: Photo[];
  cover: ImageMetadata;
  /**
   * true = the gallery gets its own page. That is the case when it appears as a
   * card somewhere: its main category shows cards, or `alsoIn` names a cards category.
   */
  hasPage: boolean;
  /** The gallery.md entry (for rendering the story text), if the file exists */
  entry?: CollectionEntry<'galleryMeta'>;
}

// ---------------------------------------------------------------------------
// 3. Reading categories and galleries
// ---------------------------------------------------------------------------

/**
 * Drafts are visible while you work locally (`npm run dev`) and hidden in the
 * real build (`npm run build`). `import.meta.env.DEV` is true only in dev mode.
 */
const showDrafts = import.meta.env.DEV;

/** Makes a readable title from a folder name: "lago-di-braies" → "Lago Di Braies" */
function titleFromFolder(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const categoryHref = (categoryId: string) => `/${categoryId}/`;

/** Newest date first, then by folder name. Used for galleries not in a galleryOrder list. */
const byNewest = (a: Gallery, b: Gallery) =>
  (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0) || naturalSort(a.slug, b.slug);

/**
 * Sort function for one category: galleries listed in its `galleryOrder` come
 * first, in that order; all others follow, newest first.
 */
function byCategoryOrder(galleryOrder: string[]) {
  const position = new Map(galleryOrder.map((id, index) => [id, index]));
  return (a: Gallery, b: Gallery) =>
    (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || byNewest(a, b);
}
export const galleryHref = (categoryId: string, slug: string) => `/${categoryId}/${slug}/`;

/**
 * All galleries of the whole site, built once and then reused (cached),
 * because many pages ask for them.
 */
let galleryCache: Promise<Gallery[]> | undefined;

function loadAllGalleries(): Promise<Gallery[]> {
  galleryCache ??= (async () => {
    // Settings from the optional gallery.md files, looked up by "<category>/<slug>"
    const metaEntries = await getCollection('galleryMeta');
    const metaById = new Map(metaEntries.map((entry) => [entry.id, entry]));
    const categoryEntries = await getCollection('categories');
    const categoryById = new Map(categoryEntries.map((c) => [c.id, c]));

    // Group photo files by gallery folder
    const photosByGallery = new Map<string, Photo[]>();
    for (const [path, image] of Object.entries(photoFiles)) {
      // path looks like "/galleries/weddings/palais-daun-kinsky-wedding-vienna/x-001.jpg"
      const [, , categoryId, slug, name] = path.split('/');
      const id = `${categoryId}/${slug}`;
      if (!photosByGallery.has(id)) photosByGallery.set(id, []);
      photosByGallery.get(id)!.push({ name, image });
    }

    const galleries: Gallery[] = [];
    for (const [id, photos] of photosByGallery) {
      const [categoryId, slug] = id.split('/');
      const category = categoryById.get(categoryId);

      // A gallery folder inside a folder without _category.md is almost always a mistake.
      if (!category) {
        throw new Error(
          `The folder "galleries/${categoryId}/" has no _category.md file. ` +
            `Copy one from another category folder (e.g. galleries/weddings/_category.md) and adjust it.`,
        );
      }

      photos.sort((a, b) => naturalSort(a.name, b.name));
      const entry = metaById.get(id);
      const meta = entry?.data;

      // Check the extra categories exist, so a typo gives a clear message
      const alsoIn = (meta?.alsoIn ?? []).filter((c) => c !== categoryId);
      for (const extra of alsoIn) {
        if (!categoryById.has(extra)) {
          throw new Error(
            `galleries/${id}/gallery.md: alsoIn contains "${extra}", but there is no folder galleries/${extra}/ with a _category.md. ` +
              `Available: ${[...categoryById.keys()].join(', ')}`,
          );
        }
      }
      const categoryIds = [categoryId, ...alsoIn];

      // Cover: 1) the file named in gallery.md, 2) a file called cover.*, 3) the first photo
      let cover = photos[0].image;
      if (meta?.cover) {
        const found = photos.find((p) => p.name === meta.cover);
        if (!found) {
          throw new Error(
            `galleries/${id}/gallery.md: the cover "${meta.cover}" does not exist in this folder. ` +
              `Available files start with: ${photos.slice(0, 3).map((p) => p.name).join(', ')} ...`,
          );
        }
        cover = found.image;
      } else {
        const coverFile = photos.find((p) => /^cover\./i.test(p.name));
        if (coverFile) cover = coverFile.image;
      }

      galleries.push({
        slug,
        id,
        categoryId,
        categoryIds,
        href: galleryHref(categoryId, slug),
        title: meta?.title ?? titleFromFolder(slug),
        typeLabel: meta?.type ?? category.data.singular,
        couple: meta?.couple,
        location: meta?.location,
        region: meta?.region ?? category.data.region,
        date: meta?.date,
        coverFocus: meta?.coverFocus,
        draft: meta?.draft ?? false,
        seoTitle: meta?.seoTitle,
        seoDescription: meta?.seoDescription,
        legacyUrls: meta?.legacyUrls ?? [],
        photos,
        cover,
        hasPage: categoryIds.some((c) => categoryById.get(c)!.data.display === 'cards'),
        entry,
      });
    }

    // Base order: newest date first, then by name. Category pages re-sort with their galleryOrder.
    return galleries.sort(byNewest);
  })();
  return galleryCache;
}

/**
 * Galleries that should appear on the site.
 * @param categoryId only galleries listed in this category (main folder OR alsoIn)
 * @param options.includeDrafts true = also return drafts (used for redirects)
 * @param options.mainOnly true = only galleries whose folder is inside this category
 */
export async function getGalleries(
  categoryId?: string,
  options: { includeDrafts?: boolean; mainOnly?: boolean } = {},
): Promise<Gallery[]> {
  const all = await loadAllGalleries();
  const entries = await getCollection('categories');
  const selected = all.filter((g) => {
    if (!options.includeDrafts && !showDrafts && g.draft) return false;
    if (!categoryId) return true;
    return options.mainOnly ? g.categoryId === categoryId : g.categoryIds.includes(categoryId);
  });

  // One category: use its own order (set by dragging in the gallery manager)
  if (categoryId) {
    const order = entries.find((c) => c.id === categoryId)?.data.galleryOrder ?? [];
    return selected.sort(byCategoryOrder(order));
  }

  // All galleries: grouped by main category in menu order, each group in its own order
  const categoryRank = new Map(
    [...entries].sort((a, b) => a.data.order - b.data.order).map((c, index) => [c.id, index]),
  );
  const orderOf = new Map(entries.map((c) => [c.id, byCategoryOrder(c.data.galleryOrder)]));
  return selected.sort(
    (a, b) =>
      (categoryRank.get(a.categoryId) ?? 0) - (categoryRank.get(b.categoryId) ?? 0) ||
      orderOf.get(a.categoryId)!(a, b),
  );
}

/** One gallery by its id ("<category>/<slug>"), including drafts. */
export async function getGalleryById(id: string): Promise<Gallery | undefined> {
  return (await loadAllGalleries()).find((g) => g.id === id);
}

/** true when a gallery is shown on the site being built (drafts only appear in dev mode). */
export const isVisible = (gallery: Gallery) => showDrafts || !gallery.draft;

/**
 * Categories in menu order.
 * @param options.onlyWithGalleries true = skip categories that have nothing to show yet
 *   (so the live menu never links to an empty page)
 */
export async function getCategories(options: { onlyWithGalleries?: boolean } = {}): Promise<Category[]> {
  const entries = await getCollection('categories');
  const visible = await getGalleries();

  const categories: Category[] = entries.map((entry) => {
    const heroPath = `/galleries/${entry.id}/${entry.data.hero}`;
    const hero = categoryFiles[heroPath];
    if (!hero) {
      throw new Error(`galleries/${entry.id}/_category.md: the hero image "${entry.data.hero}" was not found in galleries/${entry.id}/.`);
    }
    return { id: entry.id, href: categoryHref(entry.id), data: entry.data, entry, hero };
  });

  return categories
    .filter((c) => !options.onlyWithGalleries || visible.some((g) => g.categoryIds.includes(c.id)))
    .sort((a, b) => a.data.order - b.data.order || naturalSort(a.id, b.id));
}

// ---------------------------------------------------------------------------
// 4. Text helpers
// ---------------------------------------------------------------------------

/** Readable region names for Google data. */
export const regionLabel: Record<Region, string> = {
  vienna: 'Vienna, Austria',
  dolomites: 'Dolomites, Italy',
  austria: 'Austria',
  destination: 'Europe',
};

/** "Elopement at Lago di Braies, Dolomites, Italy": used for alt texts and descriptions. */
export function describeGallery(gallery: Gallery): string {
  const place = gallery.location ?? regionLabel[gallery.region];
  return `${gallery.typeLabel} at ${gallery.title}, ${place}`;
}

// ---------------------------------------------------------------------------
// 5. Image data for the React components
// ---------------------------------------------------------------------------
// React components receive plain data (strings and numbers), not ImageMetadata.
// These helpers run Astro's image optimiser (getImage) and return the URLs of
// the generated WebP files together with their sizes.
//
// SPEED: every image is generated in several widths ("srcset"). The browser
// downloads only the smallest one that is sharp enough for the space the image
// takes on screen. The components tell the browser that space with `sizes`.

export interface ResponsiveImage {
  /** URL of a default size (used by old browsers) */
  src: string;
  /** "file-320.webp 320w, file-640.webp 640w, ..." so the browser can pick a size */
  srcSet: string;
  width: number;
  height: number;
}

/** Everything a gallery card needs. */
export interface CardData {
  id: string;
  href: string;
  title: string;
  couple?: string;
  /** Every category the gallery is listed in (used by the filter) */
  categoryIds: string[];
  categoryLabel: string;
  alt: string;
  cover: ResponsiveImage;
}

/** One photo in a grid, slider or carousel, plus the large version for the lightbox. */
export interface PhotoData {
  thumb: ResponsiveImage;
  full: ResponsiveImage;
  alt: string;
}

/**
 * Widths for photos in grids, sliders and carousels.
 * Small steps at the low end matter most: phones and grid thumbnails.
 * 160 px is for the slider thumbnails (a few KB each).
 */
const PHOTO_WIDTHS = [160, 320, 480, 640, 960, 1280, 1600];

/** Widths for the fullscreen lightbox. Phones get 1200, big screens 2400. */
const FULL_WIDTHS = [1200, 1800, 2400];

/**
 * WebP quality (0–100). 72 looks the same as 85 on screen for photos, but the
 * files are about 30% smaller. The lightbox uses a bit more.
 */
const PHOTO_QUALITY = 72;
const FULL_QUALITY = 80;

/**
 * Turns a focus point ("50% 30%") into a crop anchor the image tool understands.
 *
 * Cropping a photo to a different shape only cuts away one direction: the top
 * and bottom of a portrait photo, or the sides of a landscape photo. sharp can
 * keep the start, the middle or the end of that direction ("top", "centre",
 * "bottom"). We pick the one whose visible part is centred closest to the focus
 * point, so the important spot is always visible.
 *
 * The gallery manager's preview uses the same rule (FocusPicker.tsx).
 */
export function focusToPosition(focus: string | undefined, imageRatio: number, cropRatio: number): string | undefined {
  const match = focus && /^(\d{1,3})% (\d{1,3})%$/.exec(focus);
  if (!match) return undefined;
  const portraitCut = imageRatio < cropRatio; // photo is taller than the crop → top/bottom are cut
  const point = Number(portraitCut ? match[2] : match[1]) / 100;
  // Size of the visible part, as a share of the photo (0–1)
  const visible = portraitCut ? imageRatio / cropRatio : cropRatio / imageRatio;
  const options = [
    { position: portraitCut ? 'top' : 'left', center: visible / 2 },
    { position: 'centre', center: 0.5 },
    { position: portraitCut ? 'bottom' : 'right', center: 1 - visible / 2 },
  ];
  return options.reduce((best, o) => (Math.abs(o.center - point) < Math.abs(best.center - point) ? o : best)).position;
}

/**
 * Cover image for cards: cropped to almost square, like the original site.
 * @param focus the spot that must stay visible when cropping, e.g. "50% 30%" (default: centre)
 */
export async function coverImage(image: ImageMetadata, focus?: string): Promise<ResponsiveImage> {
  const width = 1200;
  const height = 1160;
  const position = focusToPosition(focus, image.width / image.height, width / height);
  const result = await getImage({
    src: image,
    width,
    height,
    fit: 'cover', // crop instead of squeezing
    position, // which part of the photo to keep when cropping (from the focus point)
    widths: [320, 480, 640, 960, 1200],
    format: 'webp',
    quality: 75,
  });
  return { src: result.src, srcSet: result.srcSet.attribute, width, height };
}

export async function toCardData(gallery: Gallery, categoryLabel: string): Promise<CardData> {
  return {
    id: gallery.id,
    href: gallery.href,
    title: gallery.title,
    couple: gallery.couple,
    categoryIds: gallery.categoryIds,
    categoryLabel,
    alt: describeGallery(gallery),
    cover: await coverImage(gallery.cover, gallery.coverFocus),
  };
}

/**
 * A responsive version for the page and a large version for the fullscreen
 * lightbox. Widths larger than the original photo are skipped automatically.
 */
export async function toPhotoData(image: ImageMetadata, alt: string): Promise<PhotoData> {
  const fit = (widths: number[]) => {
    const smaller = widths.filter((w) => w < image.width);
    return smaller.length ? [...smaller, Math.min(image.width, widths[widths.length - 1])] : [image.width];
  };

  const thumb = await getImage({ src: image, widths: fit(PHOTO_WIDTHS), format: 'webp', quality: PHOTO_QUALITY });
  const fullWidths = fit(FULL_WIDTHS);
  const full = await getImage({ src: image, widths: fullWidths, format: 'webp', quality: FULL_QUALITY });

  const largest = fullWidths[fullWidths.length - 1];
  return {
    thumb: { src: thumb.src, srcSet: thumb.srcSet.attribute, width: image.width, height: image.height },
    full: {
      src: full.src,
      srcSet: full.srcSet.attribute,
      width: largest,
      height: Math.round((image.height / image.width) * largest),
    },
    alt,
  };
}

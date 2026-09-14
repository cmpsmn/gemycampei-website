/**
 * ============================================================================
 * CONTENT CONFIGURATION
 * ============================================================================
 *
 * WHAT THIS FILE DOES
 * Astro "content collections" turn Markdown files into typed data that pages
 * can read. This file tells Astro:
 *   1. WHERE the Markdown files are      → the `loader`
 *   2. WHICH fields they may contain     → the `schema`
 *
 * WHY A SCHEMA?
 * The schema is written with "zod", a validation library. When you build the
 * site, every Markdown file is checked against it. A typo like `ordr: 1` or a
 * missing title stops the build with a clear error message, instead of
 * silently producing a broken page.
 *
 * HOW TO READ A SCHEMA LINE
 *   title: z.string()                → required text
 *   couple: z.string().optional()    → text, may be left out
 *   order: z.number().default(100)   → number, 100 if left out
 *   display: z.enum(['a', 'b'])      → must be exactly one of these words
 *
 * THE COLLECTIONS
 *   categories   galleries/<category>/_category.md      (weddings, the-alps, maternity, 35mm-super-8-film)
 *   galleryMeta  galleries/<category>/<gallery>/gallery.md  (optional per gallery)
 *   packages     src/content/packages/<page>/index.md   (packages + FAQ pages)
 *   testimonials src/content/testimonials/<name>.md
 *
 * The photos themselves are NOT listed here. They are collected directly from
 * the folders in src/lib/galleries.ts, so a folder with photos is enough.
 * ============================================================================
 */

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * A question + answer pair. Used by categories and packages pages.
 * The answer may contain **bold**, *italic* and ***bold italic*** text.
 */
const faqItem = z.object({
  question: z.string(),
  answer: z.string(),
});

/**
 * Where a gallery took place. Used for search engine data and alt texts.
 * Add a new word here if you ever need another region.
 */
const region = z.enum(['vienna', 'dolomites', 'austria', 'destination']);

/**
 * Old Pixieset addresses like "/PalaisDaunKinsky/".
 * During the build they become permanent (301) redirects to the new address,
 * so Google rankings and old links keep working. See src/pages/redirects.json.ts.
 */
const legacyUrls = z.array(z.string().startsWith('/')).default([]);

// ---------------------------------------------------------------------------
// CATEGORIES: galleries/<category>/_category.md
// ---------------------------------------------------------------------------
const categories = defineCollection({
  // glob() finds files by pattern. "*" matches exactly one folder name.
  loader: glob({
    pattern: '*/_category.md',
    base: './galleries',
    // The ID is the folder name ("weddings"), which is also the URL: /weddings/
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    /** Text in the GALLERIES dropdown menu, e.g. "Weddings" */
    menuLabel: z.string(),
    /** Default kind of shoot for galleries in this folder, used in headings and alt texts, e.g. "Wedding" */
    singular: z.string(),
    /** Big decorative title on the hero image, e.g. "The Wedding" */
    heroTitle: z.string(),
    heroSubtitle: z.string().optional(),
    /** File name of the hero image inside the category folder, e.g. "hero.jpg" */
    hero: z.string(),
    /** The single H1 heading of the page. Put the search phrase in here. */
    h1: z.string(),
    /** Title shown in Google and the browser tab (about 60 characters max) */
    seoTitle: z.string(),
    /** Text shown under the title in Google (about 155 characters max) */
    seoDescription: z.string(),
    /** Region used for galleries in this folder that don't set their own */
    region: region.default('destination'),
    /** Folder name of the packages page to link to, e.g. "wedding-photography-packages" */
    packages: z.string().optional(),
    /**
     * How the category page shows its galleries:
     * cards    = grid of gallery cards, every gallery gets its own page (weddings, the alps)
     * carousel = the photos of this folder's galleries in a full-width row that moves
     *            on by itself (maternity, 35mm & Super 8)
     * slider   = the photos one at a time with counter and thumbnails (available, not used)
     * Galleries that are only listed here via `alsoIn` always appear as cards.
     */
    display: z.enum(['cards', 'slider', 'carousel']).default('cards'),
    /** Position in the menu, lower numbers first */
    order: z.number().default(100),
    /**
     * Order of the galleries on this category page, as "<category>/<gallery>" ids.
     * Set by dragging in the gallery manager (npm run manage). Galleries that are
     * not listed follow after the listed ones, newest first.
     */
    galleryOrder: z.array(z.string()).default([]),
    faq: z.array(faqItem).default([]),
    legacyUrls,
  }),
});

// ---------------------------------------------------------------------------
// GALLERY SETTINGS: galleries/<category>/<gallery>/gallery.md  (optional file)
// ---------------------------------------------------------------------------
const galleryMeta = defineCollection({
  loader: glob({
    pattern: '*/*/gallery.md',
    base: './galleries',
    // ID = "<category>/<gallery>", e.g. "weddings/palais-daun-kinsky-wedding-vienna"
    generateId: ({ entry }) => entry.split('/').slice(0, 2).join('/'),
  }),
  schema: z.object({
    /** Venue or place, e.g. "Palais Daun-Kinsky". Default: made from the folder name. */
    title: z.string().optional(),
    /**
     * Kind of shoot, e.g. "Elopement", "Couple Session", "Proposal".
     * Shown in the heading and used for Google. Default: `singular` of the category.
     */
    type: z.string().optional(),
    /**
     * Extra categories this gallery also appears in (folder names), e.g. [35mm-super-8-film].
     * The gallery's own folder stays its main category and decides the URL.
     */
    alsoIn: z.array(z.string()).default([]),
    /** Names or initials shown above the title, e.g. "Eda & Karim" */
    couple: z.string().optional(),
    /** Readable place for titles, alt texts and Google, e.g. "Vienna, Austria" */
    location: z.string().optional(),
    region: region.optional(),
    /** When the shoot happened. Optional, used for sorting. */
    date: z.coerce.date().optional(),
    /** File name of the title image in this folder. Default: cover.jpg or the first photo. */
    cover: z.string().optional(),
    /**
     * The important spot of the cover photo as "left% top%", e.g. "50% 30%"
     * (set by clicking in the gallery manager). The card crop keeps this spot visible. Default: centre.
     */
    coverFocus: z
      .string()
      .regex(/^\d{1,3}% \d{1,3}%$/, 'coverFocus must look like "50% 30%"')
      .optional(),
    /** Optional overrides for the Google result */
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    /** true = only visible with `npm run dev`, hidden on the live site */
    draft: z.boolean().default(false),
    legacyUrls,
  }),
});

// ---------------------------------------------------------------------------
// PACKAGES PAGES: src/content/packages/<page>/index.md
// ---------------------------------------------------------------------------
const packages = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/packages' }),
  // `image()` is a helper from Astro: it checks that the file exists and
  // prepares it for optimisation. It only works for files next to the Markdown.
  schema: ({ image }) =>
    z.object({
      menuLabel: z.string(),
      seoTitle: z.string(),
      seoDescription: z.string(),
      h1: z.string(),
      tagline: z.string(),
      buttonLabel: z.string().default('Request pricing'),
      order: z.number().default(100),
      packages: z
        .array(
          z.object({
            eyebrow: z.string().optional(),
            title: z.string(),
            image: image(),
            text: z.string(),
            included: z.array(z.string()).default([]),
          }),
        )
        .default([]),
      faqTitle: z.string().default('FAQ'),
      faq: z.array(faqItem).default([]),
      legacyUrls,
    }),
});

// ---------------------------------------------------------------------------
// TESTIMONIALS: src/content/testimonials/<name>.md  (the text body is the quote)
// ---------------------------------------------------------------------------
const testimonials = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/testimonials' }),
  schema: ({ image }) =>
    z.object({
      names: z.string(),
      /** A photo file next to the Markdown file. Optional when `galleryPhoto` is used. */
      image: image().optional(),
      /** The couple's gallery as "<category>/<gallery>": adds "View their gallery" + shows the review there */
      gallery: z.string().optional(),
      /** File name of a photo in the linked gallery, used instead of `image` */
      galleryPhoto: z.string().optional(),
      /** Lower numbers first on the testimonials page */
      order: z.number().default(100),
    }),
});

// Astro reads this export to know which collections exist.
export const collections = { categories, galleryMeta, packages, testimonials };

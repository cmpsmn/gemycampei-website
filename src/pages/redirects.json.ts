/**
 * ============================================================================
 * REDIRECT LIST  (src/pages/redirects.json.ts)  →  built as dist/redirects.json
 * ============================================================================
 *
 * WHY
 * The old Pixieset site used addresses like /THEWEDDING/ or /PalaisDaunKinsky/.
 * Google has them indexed and other websites link to them. A permanent (301)
 * redirect sends visitors AND search engines to the new address and passes the
 * ranking on, so nothing is lost when switching to the new site.
 *
 * HOW
 * 1. This "endpoint" (a .ts file in src/pages that exports GET) creates a JSON
 *    file at build time with pairs of { from, to }.
 * 2. The small integration in astro.config.mjs reads that file after the
 *    build, writes Apache rewrite rules into dist/.htaccess and deletes the JSON.
 *
 * WHERE THE OLD ADDRESSES COME FROM
 * - `legacyUrls` in each _category.md, gallery.md and packages index.md
 * - the fixed list below for normal pages
 *
 * Because the old address is stored inside the gallery folder, moving a
 * gallery to another category automatically updates its redirect target.
 * If you rename a gallery folder that is already live, add its previous
 * address (e.g. /weddings/old-folder-name/) to `legacyUrls` in its gallery.md.
 * ============================================================================
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getCategories, getGalleries, categoryHref } from '../lib/galleries';

/** Old page addresses that are not stored in content files. */
const staticRedirects: { from: string; to: string }[] = [
  { from: '/ABOUT/', to: '/about/' },
];

export const GET: APIRoute = async () => {
  const redirects = [...staticRedirects];

  // Categories that have a page. Others fall back to the galleries overview.
  const liveCategories = new Set((await getCategories({ onlyWithGalleries: true })).map((c) => c.id));
  const categories = await getCategories();
  for (const category of categories) {
    const target = liveCategories.has(category.id) ? category.href : '/galleries/';
    for (const from of category.data.legacyUrls) redirects.push({ from, to: target });
  }

  // Galleries: live galleries redirect to their page. Drafts (not built yet)
  // redirect to their category page, or the overview if that is empty too.
  const visibleIds = new Set((await getGalleries()).map((g) => g.id));
  for (const gallery of await getGalleries(undefined, { includeDrafts: true })) {
    const hasOwnPage = visibleIds.has(gallery.id) && gallery.hasPage;
    const target = hasOwnPage
      ? gallery.href
      : liveCategories.has(gallery.categoryId)
        ? categoryHref(gallery.categoryId)
        : '/galleries/';
    for (const from of gallery.legacyUrls) redirects.push({ from, to: target });
  }

  // Packages pages
  for (const page of await getCollection('packages')) {
    for (const from of page.data.legacyUrls) redirects.push({ from, to: `/${page.id}/` });
  }

  // Never redirect a page to itself (would create an endless loop)
  const clean = redirects.filter((r) => r.from.replace(/\/+$/, '') !== r.to.replace(/\/+$/, ''));

  return new Response(JSON.stringify(clean, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
};

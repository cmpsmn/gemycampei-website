/**
 * ============================================================================
 * SITEMAP  (integrations/sitemap.mjs)  →  dist/sitemap-index.xml (also as sitemap.xml) + dist/sitemap-pages.xml
 * ============================================================================
 *
 * A sitemap is the list of pages a search engine should know about. This one
 * is built AFTER the pages, by reading the finished HTML files in dist/, so it
 * always matches what visitors see:
 *
 *   - every page, except those marked `noindex` (thank-you page, untranslated
 *     German pages ...)
 *   - its language versions (<xhtml:link hreflang>), taken from the
 *     <link rel="alternate" hreflang> tags in the page head (see Base.astro)
 *   - the photos on the page with their descriptions (<image:image>), which
 *     helps Google Images find and understand the photos
 *
 * robots.txt points search engines to sitemap-index.xml.
 * ============================================================================
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Google reads at most 1,000 images per page */
const MAX_IMAGES = 1000;

const escapeXml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Turns HTML entities in attribute values back into characters (&amp; → &) */
const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** Every index.html below a folder */
async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name === 'index.html') found.push(full);
  }
  return found;
}

const attr = (tag, name) => {
  const match = new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(tag);
  return match ? decode(match[1]) : undefined;
};

/**
 * @param {{ site: string }} options
 * @returns {import('astro').AstroIntegration}
 */
export default function seoSitemap({ site }) {
  return {
    name: 'seo-sitemap',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const entries = [];

        for (const file of await htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          // Pages that ask not to be listed stay out of the sitemap
          if (/<meta name="robots" content="[^"]*noindex/i.test(html)) continue;

          const canonical = /<link rel="canonical" href="([^"]+)"/i.exec(html)?.[1];
          if (!canonical) continue;

          const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/gi)].map(
            ([, lang, href]) => ({ lang, href: decode(href) }),
          );

          // Photos inside <main>: their address and description
          const main = /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ?? '';
          const seen = new Set();
          const images = [];
          for (const [tag] of main.matchAll(/<img\b[^>]*>/gi)) {
            const src = attr(tag, 'src');
            if (!src || seen.has(src) || src.startsWith('data:')) continue;
            seen.add(src);
            images.push({ loc: new URL(src, site).toString(), caption: attr(tag, 'alt') ?? '' });
            if (images.length >= MAX_IMAGES) break;
          }

          entries.push({ loc: decode(canonical), alternates, images });
        }

        entries.sort((a, b) => a.loc.localeCompare(b.loc));

        const urls = entries
          .map(({ loc, alternates, images }) =>
            [
              '  <url>',
              `    <loc>${escapeXml(loc)}</loc>`,
              ...alternates.map(
                (a) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(a.lang)}" href="${escapeXml(a.href)}"/>`,
              ),
              ...images.map((image) =>
                [
                  '    <image:image>',
                  `      <image:loc>${escapeXml(image.loc)}</image:loc>`,
                  ...(image.caption ? [`      <image:caption>${escapeXml(image.caption)}</image:caption>`] : []),
                  '    </image:image>',
                ].join('\n'),
              ),
              '  </url>',
            ].join('\n'),
          )
          .join('\n');

        const pages = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>
`;
        const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${escapeXml(new URL('/sitemap-pages.xml', site).toString())}</loc></sitemap>
</sitemapindex>
`;
        await writeFile(path.join(root, 'sitemap-pages.xml'), pages);
        await writeFile(path.join(root, 'sitemap-index.xml'), index);
        // The same index under the usual name: many people (and some tools) type
        // /sitemap.xml into Google Search Console
        await writeFile(path.join(root, 'sitemap.xml'), index);
        const imageCount = entries.reduce((sum, e) => sum + e.images.length, 0);
        logger.info(`Sitemap: ${entries.length} pages, ${imageCount} images`);
      },
    },
  };
}

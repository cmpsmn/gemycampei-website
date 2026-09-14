// @ts-check
/**
 * ============================================================================
 * ASTRO CONFIGURATION  (astro.config.mjs)
 * ============================================================================
 *
 * The main settings file of the project. Astro reads it when you run
 * `npm run dev` or `npm run build`.
 *
 *   site          the final address, used for canonical URLs and the sitemap
 *   output        'static' = every page becomes a plain HTML file (no server needed)
 *   integrations  plugins: React support, sitemap, and our redirect writer
 *   image         which image sizes Astro generates
 *
 * Reference: https://docs.astro.build/en/reference/configuration-reference/
 * ============================================================================
 */
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * A tiny custom integration ("plugin") that runs after the build.
 * It turns dist/redirects.json (see src/pages/redirects.json.ts) into Apache
 * rewrite rules inside dist/.htaccess, then deletes the JSON file.
 *
 * Example rule it writes:
 *   RewriteRule ^PalaisDaunKinsky/?$ /weddings/palais-daun-kinsky-wedding-vienna/ [R=301,L]
 *
 * @returns {import('astro').AstroIntegration}
 */
function legacyRedirects() {
  return {
    name: 'legacy-redirects',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const jsonFile = fileURLToPath(new URL('redirects.json', dir));
        const htaccessFile = fileURLToPath(new URL('.htaccess', dir));

        /** @type {{from: string, to: string}[]} */
        const redirects = JSON.parse(await readFile(jsonFile, 'utf8'));
        // Escape characters that have a special meaning in regular expressions
        const escape = (/** @type {string} */ s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const rules = redirects
          .map(({ from, to }) => {
            const path = from.replace(/^\/+|\/+$/g, ''); // "/PalaisDaunKinsky/" → "PalaisDaunKinsky"
            return `RewriteRule ^${escape(path)}/?$ ${to} [R=301,L]`;
          })
          .join('\n  ');

        const htaccess = await readFile(htaccessFile, 'utf8');
        const marker = '# @@LEGACY_REDIRECTS@@';
        if (!htaccess.includes(marker)) throw new Error(`public/.htaccess is missing the line "${marker}"`);
        await writeFile(htaccessFile, htaccess.replace(marker, `# Old Pixieset addresses (generated)\n  ${rules}`));
        await rm(jsonFile);
        logger.info(`Wrote ${redirects.length} redirects into .htaccess`);
      },
    },
  };
}

export default defineConfig({
  site: 'https://gemycampei.com',
  output: 'static',
  // All internal links end with "/" (e.g. /about/). The server adds it if missing.
  trailingSlash: 'ignore',
  integrations: [
    // Lets .astro pages use React components (.tsx files)
    react(),
    // Creates sitemap-index.xml: a list of all pages for search engines
    sitemap({
      filter: (page) => !/\/(thank-you|message-error)\/?$/.test(page),
    }),
    legacyRedirects(),
  ],
  image: {
    // Widths Astro may generate for responsive images.
    // Fewer sizes = faster builds, more sizes = slightly smaller downloads.
    breakpoints: [480, 800, 1200, 1600, 2400],
  },
});

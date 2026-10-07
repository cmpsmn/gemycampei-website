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
 *   i18n          the two languages: English at /, German at /de/
 *   integrations  plugins: React support, our sitemap and redirect writers
 *   image         which image sizes Astro generates
 *
 * Reference: https://docs.astro.build/en/reference/configuration-reference/
 * ============================================================================
 */
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import seoSitemap from './integrations/sitemap.mjs';
import { parse as parseYaml } from 'yaml';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * A tiny custom integration ("plugin") that runs after the build.
 * It turns dist/redirects.json (see src/pages/redirects.json.ts) into Apache
 * rewrite rules inside dist/.htaccess, then deletes the JSON file.
 *
 * Example rule it writes:
 *   RewriteRule ^PalaisDaunKinsky/?$ /vienna-wedding-photographer/palais-daun-kinsky-wedding-vienna/ [R=301,L]
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

/** Site settings (src/content/settings.yaml): `german` switches the German version on or off */
const settings = parseYaml(readFileSync(new URL('./src/content/settings.yaml', import.meta.url), 'utf8'));

/**
 * The German pages live in src/routes/de/ (not in src/pages/), so they are only
 * built when `german: true` in the settings. This integration adds them as
 * routes then: src/routes/de/ueber-mich.astro → /de/ueber-mich/ and so on,
 * including the dynamic ones ([category], [gallery], journal/[slug]).
 *
 * @returns {import('astro').AstroIntegration}
 */
function germanPages() {
  return {
    name: 'german-pages',
    hooks: {
      'astro:config:setup': ({ injectRoute, logger }) => {
        if (settings.german !== true) {
          logger.info('German version is switched off (src/content/settings.yaml → german: false)');
          return;
        }
        const root = fileURLToPath(new URL('./src/routes/', import.meta.url));
        /** @param {string} dir @returns {string[]} */
        const walk = (dir) =>
          readdirSync(dir).flatMap((name) => {
            const full = path.join(dir, name);
            return statSync(full).isDirectory() ? walk(full) : full.endsWith('.astro') ? [full] : [];
          });
        for (const file of walk(root)) {
          const route = path
            .relative(root, file)
            .split(path.sep)
            .join('/')
            .replace(/\.astro$/, '')
            .replace(/(^|\/)index$/, '');
          injectRoute({ pattern: `/${route}`, entrypoint: file });
        }
      },
    },
  };
}

/**
 * Preview only (npm run dev / the manager's Preview button): photos are served
 * under addresses made from their file name, and Astro tells the browser to
 * keep them for a year. After the gallery manager reordered (renamed) photos,
 * the browser then showed the old picture under the new name, so a photo
 * appeared twice. Here the browser must ask each time (it gets a quick
 * "unchanged" answer when nothing changed). The built website is not affected:
 * there every photo address contains a fingerprint of its content.
 * @returns {import('astro').AstroIntegration}
 */
function freshPreviewPhotos() {
  return {
    name: 'fresh-preview-photos',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'fresh-preview-photos',
                configureServer(server) {
                  server.middlewares.use(
                    /**
                     * @param {import('node:http').IncomingMessage} req
                     * @param {import('node:http').ServerResponse} res
                     * @param {() => void} next
                     */
                    (req, res, next) => {
                      if (req.url?.startsWith('/_image')) {
                        const setHeader = res.setHeader.bind(res);
                        res.setHeader = (/** @type {string} */ name, /** @type {any} */ value) =>
                          setHeader(name, name.toLowerCase() === 'cache-control' ? 'no-cache' : value);
                      }
                      next();
                    },
                  );
                },
              },
            ],
          },
        });
      },
    },
  };
}

export default defineConfig({
  site: 'https://gemycampei.com',
  output: 'static',
  // All internal links end with "/" (e.g. /about/). The server adds it if missing.
  trailingSlash: 'ignore',
  // English is the main language and has no prefix (/about/); German pages live
  // under /de/ (/de/ueber-mich/). Pages read the language with Astro.currentLocale.
  // German addresses use German words, see src/i18n/index.ts.
  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    // Lets .astro pages use React components (.tsx files)
    react(),
    // Creates sitemap-index.xml from the built pages: both languages, their
    // language pairs and the photos with descriptions (integrations/sitemap.mjs)
    seoSitemap({ site: 'https://gemycampei.com' }),
    legacyRedirects(),
    germanPages(),
    freshPreviewPhotos(),
  ],
  build: {
    // The CSS of each page is small (about 25 KB), so it is put straight into
    // the HTML: the browser can draw the page without waiting for extra CSS
    // files (faster first paint, measured with Lighthouse).
    inlineStylesheets: 'always',
  },
  image: {
    // Widths Astro may generate for responsive images.
    // Fewer sizes = faster builds, more sizes = slightly smaller downloads.
    breakpoints: [480, 800, 1200, 1600, 2400],
  },
});

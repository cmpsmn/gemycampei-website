/**
 * ============================================================================
 * QUALITY & SEO CHECKS  (tools/gallery-manager/api/checks.mjs)
 * ============================================================================
 *
 * Friendly hints shown above the gallery editor. They never block saving.
 *
 *   warning = something that hurts how the gallery looks or ranks on Google
 *   info    = good to know
 * ============================================================================
 */

import { MIN_LONG_EDGE } from './photos.mjs';

/** Google shows about this many characters of a title / description */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 155;

/**
 * @param {Awaited<ReturnType<import('./galleries.mjs').readGallery>>} gallery
 * @param {{ id: string, label: string, display: string }[]} categories
 * @returns {{ level: 'warning' | 'info', message: string }[]}
 */
export function galleryChecks(gallery, categories) {
  const checks = [];
  const warn = (message) => checks.push({ level: 'warning', message });
  const info = (message) => checks.push({ level: 'info', message });
  const { fields, photos, story } = gallery;

  if (fields.draft) info('Draft: hidden on the live website. Visible in the preview. Untick "Draft" to publish.');

  if (photos.length === 0) warn('No photos yet: the gallery does not appear on the website until it has photos.');
  else if (photos.length < 10) info(`Only ${photos.length} photos. Galleries with 15 or more photos tell the story better.`);

  const small = photos.filter((p) => Math.max(p.width, p.height) < MIN_LONG_EDGE);
  if (small.length) {
    warn(`${small.length} photo${small.length > 1 ? 's are' : ' is'} smaller than ${MIN_LONG_EDGE} px and may look soft: ${small.map((p) => p.name).slice(0, 4).join(', ')}${small.length > 4 ? ' …' : ''}`);
  }

  if (!fields.title) info('No title: the folder name is used as the title.');
  if (!fields.location) warn('Add a location (e.g. "Lago di Braies, Dolomites, Italy"). It is used in the page title and helps Google.');

  if (!story || /\bTODO\b/.test(story)) {
    warn('Write a short story (80–200 words): the place, the mood, what made the day special. Unique text helps the gallery rank on Google.');
  }

  if (fields.seoTitle.length > SEO_TITLE_MAX) warn(`The SEO title has ${fields.seoTitle.length} characters. Google shows about ${SEO_TITLE_MAX}.`);
  if (fields.seoDescription.length > SEO_DESCRIPTION_MAX) {
    warn(`The SEO description has ${fields.seoDescription.length} characters. Google shows about ${SEO_DESCRIPTION_MAX}.`);
  }

  // A gallery only gets its own page when it is in a category that shows cards
  const byId = new Map(categories.map((c) => [c.id, c]));
  const hasCardsCategory = gallery.categories.some((id) => byId.get(id)?.display === 'cards');
  if (!hasCardsCategory) {
    info('This gallery is only in carousel categories: its photos appear in the carousel, but it has no page or card of its own.');
  }
  return checks;
}

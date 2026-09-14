/**
 * ============================================================================
 * SEO HELPERS  (src/lib/seo.ts)
 * ============================================================================
 *
 * WHAT IS THIS FOR?
 * Search engines read two kinds of information from a page:
 *
 * 1. META TAGS in the <head>: title, description, canonical URL, preview image.
 *    Built in src/layouts/Base.astro with the helpers below.
 *
 * 2. STRUCTURED DATA ("JSON-LD"): a small block of JSON that describes the page
 *    in a machine-readable way, using the vocabulary of https://schema.org.
 *    For example: "this is a photography business in Vienna that serves the
 *    Dolomites", "this page is a list of questions and answers", "this page is
 *    inside the Weddings section". Google uses it to understand the site and
 *    sometimes to show richer results.
 *
 * Test the result of any page at https://search.google.com/test/rich-results
 * ============================================================================
 */

import { site, legal } from '../site.config';
import { inlineMarkdownToText } from './markdown';

/** Any JSON-LD object. `Record<string, unknown>` means "an object with any keys". */
export type Schema = Record<string, unknown>;

/**
 * Full page title: "Page title | Gemy Campei".
 * Google shows about 60 characters, so the brand is only added when it fits.
 */
export function pageTitle(title?: string): string {
  if (!title) return `${site.defaultTitle} | ${site.name}`;
  if (title.includes(site.name)) return title;
  const withBrand = `${title} | ${site.name}`;
  return withBrand.length <= 70 ? withBrand : title;
}

/** Makes an absolute URL ("https://gemycampei.com/about/") from a path ("/about/"). */
export const absoluteUrl = (path: string) => new URL(path, site.url).toString();

/**
 * The business itself. Added to every page (see Base.astro).
 * "ProfessionalService" is the closest schema.org type for a photographer.
 */
export function businessSchema(logoUrl?: string): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${site.url}/#business`,
    name: site.name,
    description: site.description,
    url: site.url,
    email: site.email,
    ...(logoUrl ? { image: logoUrl } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: legal.city,
      addressCountry: 'AT',
    },
    areaServed: site.areaServed.map((name) => ({ '@type': 'Place', name })),
    knowsAbout: [
      'Wedding photography',
      'Elopement photography',
      'Couple photography',
      'Proposal photography',
      'Maternity photography',
      '35mm film photography',
      'Super 8 film',
    ],
    sameAs: Object.values(site.social),
  };
}

/**
 * "Breadcrumbs" describe where a page sits in the site:
 * Home › Weddings › Palais Daun-Kinsky. Google may show this path in results.
 */
export function breadcrumbSchema(items: { name: string; path: string }[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Questions and answers. Answers are converted from Markdown to plain text. */
export function faqSchema(faq: { question: string; answer: string }[]): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: inlineMarkdownToText(item.answer) },
    })),
  };
}

/** A photo gallery page with a few of its images. */
export function imageGallerySchema(options: {
  name: string;
  description?: string;
  path: string;
  imageUrls: string[];
  location?: string;
}): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    url: absoluteUrl(options.path),
    ...(options.location ? { contentLocation: { '@type': 'Place', name: options.location } } : {}),
    // Only the first images: enough for Google, keeps the page small
    image: options.imageUrls.slice(0, 10).map((url) => absoluteUrl(url)),
    author: { '@id': `${site.url}/#business` },
  };
}

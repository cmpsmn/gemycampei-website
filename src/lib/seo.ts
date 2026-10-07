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
 *    Dolomites", "Gemy Campei is the photographer behind it", "this page is a
 *    guide written by Gemy Campei". Google and AI assistants (Gemini, ChatGPT,
 *    Perplexity) use it to understand who you are, where you work and what the
 *    page is about, and to quote the site correctly.
 *
 * Test the result of any page at https://search.google.com/test/rich-results
 * or https://validator.schema.org
 * ============================================================================
 */

import { site, legal } from '../site.config';
import { inlineMarkdownToText } from './markdown';
import type { Lang } from '../i18n';

/** Any JSON-LD object. `Record<string, unknown>` means "an object with any keys". */
export type Schema = Record<string, unknown>;

/** Google shows about 60 characters of a title. */
const TITLE_MAX = 60;

/**
 * Full page title: "Page title | Gemy Campei".
 * The brand is only added when the whole title still fits in 60 characters,
 * so the search phrase at the start is never cut off.
 */
export function pageTitle(title: string | undefined, lang: Lang = 'en'): string {
  const base = title ?? site.seo[lang].title;
  if (base.includes(site.name)) return base;
  const withBrand = `${base} | ${site.name}`;
  return withBrand.length <= TITLE_MAX ? withBrand : base;
}

/** Makes an absolute URL ("https://gemycampei.com/about/") from a path ("/about/"). */
export const absoluteUrl = (path: string) => new URL(path, site.url).toString();

const businessId = `${site.url}/#business`;
const personId = `${site.url}/#gemy`;
const websiteId = `${site.url}/#website`;

/** The photographer as a person. Linked from the business and from articles. */
function personSchema(): Schema {
  return {
    '@type': 'Person',
    '@id': personId,
    name: site.person.name,
    jobTitle: site.person.jobTitle,
    knowsLanguage: site.person.languages,
    worksFor: { '@id': businessId },
    url: `${site.url}/about/`,
    sameAs: Object.values(site.social),
  };
}

/**
 * The business itself. Added to every page (see Base.astro).
 * "ProfessionalService" is the closest schema.org type for a photographer.
 * No prices are published anywhere on the site, so none are listed here.
 */
export function businessSchema(lang: Lang = 'en', logoUrl?: string): Schema {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        '@id': businessId,
        name: site.name,
        description: site.seo[lang].description,
        url: site.url,
        email: site.email,
        ...(logoUrl ? { image: logoUrl } : {}),
        address: {
          '@type': 'PostalAddress',
          addressLocality: legal.city,
          addressCountry: 'AT',
        },
        areaServed: site.areaServed.map((name) => ({ '@type': 'Place', name })),
        founder: { '@id': personId },
        knowsLanguage: site.person.languages,
        knowsAbout: [
          'Wedding photography',
          'Elopement photography',
          'Destination weddings',
          'Couple photography',
          'Proposal photography',
          'Maternity photography',
          '35mm film photography',
          'Super 8 film',
          'Dolomites',
          'Vienna',
        ],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Photography services',
          itemListElement: site.services.map((name) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name },
          })),
        },
        sameAs: Object.values(site.social),
      },
      personSchema(),
    ],
  };
}

/** The website as a whole, with its languages. Shown on the home pages. */
export function websiteSchema(): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId,
    name: site.name,
    url: site.url,
    inLanguage: ['en', 'de'],
    publisher: { '@id': businessId },
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

/**
 * Questions and answers. Answers are converted from Markdown to plain text.
 * Google only shows FAQ rich results for a few sites today, but the data helps
 * search engines and AI answers find the answer to a precise question.
 */
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

/** A photo gallery page with its photos and their descriptions. */
export function imageGallerySchema(options: {
  name: string;
  description?: string;
  path: string;
  images: { url: string; caption: string }[];
  location?: string;
  lang?: Lang;
}): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: options.name,
    ...(options.description ? { description: options.description } : {}),
    url: absoluteUrl(options.path),
    inLanguage: options.lang ?? 'en',
    ...(options.location ? { contentLocation: { '@type': 'Place', name: options.location } } : {}),
    // The first photos are enough for Google and keep the page small
    image: options.images.slice(0, 12).map((image) => ({
      '@type': 'ImageObject',
      contentUrl: absoluteUrl(image.url),
      caption: image.caption,
      creator: { '@id': personId },
      copyrightHolder: { '@id': businessId },
    })),
    author: { '@id': personId },
    publisher: { '@id': businessId },
  };
}

/** A journal article (guide). The author is a real person: a trust signal. */
export function articleSchema(options: {
  title: string;
  description: string;
  path: string;
  image?: string;
  datePublished: Date;
  dateModified?: Date;
  lang: Lang;
}): Schema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: options.title,
    description: options.description,
    url: absoluteUrl(options.path),
    mainEntityOfPage: absoluteUrl(options.path),
    inLanguage: options.lang,
    ...(options.image ? { image: absoluteUrl(options.image) } : {}),
    datePublished: options.datePublished.toISOString().slice(0, 10),
    dateModified: (options.dateModified ?? options.datePublished).toISOString().slice(0, 10),
    author: { '@id': personId, '@type': 'Person', name: site.person.name, url: `${site.url}/about/` },
    publisher: { '@id': businessId },
  };
}

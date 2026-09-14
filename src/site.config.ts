/**
 * ============================================================================
 * SITE SETTINGS  (src/site.config.ts)
 * ============================================================================
 *
 * One central place for business details that appear on many pages:
 * name, email, social media links, and the legal details for the imprint.
 *
 * Change a value here and it updates everywhere (header, footer, contact page,
 * imprint, privacy policy and the data sent to Google).
 *
 * `as const` at the end tells TypeScript these values never change, which
 * gives better autocompletion in the editor.
 * ============================================================================
 */

export const site = {
  /** Business name, shown as the logo and in every page title */
  name: 'Gemy Campei',

  /** Short brand line, shown on the home page and in the footer */
  tagline: 'Candid souls × quiet elegance',

  /**
   * Default page title and description for search engines.
   * Pages without their own SEO text use these.
   * The title targets the two main searches: Dolomites elopements and Vienna weddings.
   */
  defaultTitle: 'Dolomites Elopement & Vienna Wedding Photographer',
  // Keep descriptions under about 155 characters, Google cuts longer ones off.
  description:
    'Wedding and elopement photographer based in Vienna and the Dolomites: documentary weddings, intimate elopements and couple sessions across Europe.',

  /** Main address of the website, without trailing slash */
  url: 'https://gemycampei.com',

  /** Public contact email (also used in the contact form messages) */
  email: 'info@gemycampei.com',

  /** Social media profiles. Shown in the footer and sent to Google as "sameAs". */
  social: {
    instagram: 'https://www.instagram.com/gemycampei/',
    tiktok: 'https://www.tiktok.com/@gemycampei',
    pinterest: 'https://www.pinterest.com/gemysvisuals0261/',
  },

  /**
   * Places you work in. Sent to Google in the structured business data
   * ("areaServed"), which helps local search results.
   */
  areaServed: ['Vienna', 'Austria', 'Dolomites', 'South Tyrol', 'Trentino', 'Italy', 'Europe'],
} as const;

/**
 * Legal details for the imprint (Impressum) and privacy policy.
 * Required by § 5 ECG, § 25 MedienG and the GDPR.
 * Fill in every TODO before going live. The address is also used in the
 * business data for Google, so it should be the real business address.
 */
export const legal = {
  ownerName: 'TODO Full legal name',
  businessDescription: 'Photography services (wedding, elopement and couple photography)',
  street: 'TODO Street and number',
  postalCode: 'TODO',
  city: 'Vienna',
  country: 'Austria',
  phone: 'TODO +43 ...',
  email: 'info@gemycampei.com',
  // Leave empty strings for items that do not apply to you.
  vatId: '', // e.g. ATU12345678, only if you have one
  tradeLicence: 'TODO e.g. Berufsfotograf (reglementiertes Gewerbe) or free trade',
  tradeAuthority: 'TODO e.g. Magistrat der Stadt Wien',
  chamberMembership: 'TODO e.g. Wirtschaftskammer Österreich, Landesinnung der Berufsfotografen',
  lastUpdated: '2026-09-13',
} as const;

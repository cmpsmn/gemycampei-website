/**
 * ============================================================================
 * FIELD LISTS  (tools/gallery-manager/app/schemas.ts)
 * ============================================================================
 *
 * Which fields the Categories, Packages, Journal and Settings tabs show, and
 * what kind of input each one gets. DocumentEditor.tsx builds the forms from
 * these lists, so adding a field to the website usually means: add it to
 * src/content.config.ts and add one line here.
 *
 *   key        name in the file; dots go deeper ("social.instagram");
 *              "$body" = the text below the settings block of a Markdown file
 *   de         true = the field also exists in the German file
 *   required   the website build fails without it, so it can't be emptied
 *
 * The Pages tab (home, about, contact) needs no list: its fields are made from
 * the file itself (see fieldsFromData below).
 * ============================================================================
 */

export type FieldType =
  | 'text' // one line
  | 'textarea' // a few lines, no formatting
  | 'markdown' // longer text with **bold**, *italic*, ## headings, [links](/address/)
  | 'lines' // list of short texts, one per line
  | 'paragraphs' // list of paragraphs, separated by an empty line
  | 'number'
  | 'date'
  | 'bool'
  | 'select'
  | 'category' // a category (folder name)
  | 'packagesPage' // a packages page (folder name)
  | 'gallery' // one gallery ("<category>/<gallery>")
  | 'galleries' // several galleries
  | 'photo' // one gallery photo ("<category>/<gallery>/<file>")
  | 'photos' // several gallery photos
  | 'image' // a photo file next to the text file (upload replaces it)
  | 'objects' // a list of items with their own fields (FAQ, packages …)
  | 'readonly';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  /** Character limit shown as a counter (Google texts) */
  max?: number;
  rows?: number;
  required?: boolean;
  /** Also in the German file */
  de?: boolean;
  /** Only in the German file */
  deOnly?: boolean;
  /** Value the website uses when the field is missing */
  defaultValue?: unknown;
  /** bool: the checkbox means the opposite ("Published" for draft: false) */
  invert?: boolean;
  /** bool: text next to the checkbox */
  onText?: string;
  offText?: string;
  options?: { value: string; label: string }[];
  /** objects: the fields of one item, and its name for "+ Add …" */
  fields?: Field[];
  item?: string;
}

export interface Section {
  title: string;
  help?: string;
  fields: Field[];
}

export type DocKind = 'category' | 'packages' | 'journal' | 'page' | 'settings';

const GOOGLE_TITLE = 60;
const GOOGLE_DESCRIPTION = 155;

const faq = (de = true): Field => ({
  key: 'faq',
  label: 'Questions & answers',
  type: 'objects',
  item: 'question',
  de,
  help: 'Shown as an FAQ and sent to Google. Answers may use **bold** and *italic*.',
  fields: [
    { key: 'question', label: 'Question', type: 'text', required: true },
    { key: 'answer', label: 'Answer', type: 'textarea', rows: 4, required: true },
  ],
});

const legacyUrls: Field = {
  key: 'legacyUrls',
  label: 'Old addresses',
  type: 'lines',
  help: 'One per line, e.g. /DolomitesPackages/. Visitors and Google are redirected to this page.',
};

const germanSlug: Field = {
  key: 'slug',
  label: 'German address',
  type: 'readonly',
  deOnly: true,
  help: 'Changing it later would need a redirect, so it is set once, when the German version is created.',
};

const REGIONS = [
  { value: 'vienna', label: 'Vienna' },
  { value: 'dolomites', label: 'Dolomites' },
  { value: 'austria', label: 'Austria' },
  { value: 'destination', label: 'Destination' },
];

// ---------------------------------------------------------------------------
// CATEGORIES: galleries/<category>/_category.md
// ---------------------------------------------------------------------------
const category: Section[] = [
  {
    title: 'Page',
    fields: [
      germanSlug,
      { key: 'menuLabel', label: 'Name in the menu', type: 'text', required: true, de: true },
      { key: 'heroTitle', label: 'Big title on the photo', type: 'text', required: true, de: true },
      { key: 'heroSubtitle', label: 'Small line under the big title', type: 'text', de: true },
      { key: 'hero', label: 'Title photo', type: 'image', required: true, help: 'A landscape photo; uploading replaces it.' },
      { key: 'h1', label: 'Main heading (H1)', type: 'text', required: true, de: true, help: 'Put the search phrase here, e.g. "Vienna Wedding Photographer".' },
      { key: '$body', label: 'Introduction', type: 'markdown', rows: 8, de: true },
    ],
  },
  {
    title: 'Google (SEO)',
    fields: [
      { key: 'seoTitle', label: 'Title in Google', type: 'text', required: true, max: GOOGLE_TITLE, de: true },
      { key: 'seoDescription', label: 'Description in Google', type: 'textarea', rows: 3, required: true, max: GOOGLE_DESCRIPTION, de: true },
    ],
  },
  {
    title: 'How it works',
    fields: [
      { key: 'stepsTitle', label: 'Heading', type: 'text', de: true },
      {
        key: 'steps',
        label: 'Steps',
        type: 'objects',
        item: 'step',
        de: true,
        fields: [
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'text', label: 'Text', type: 'textarea', rows: 3, required: true },
        ],
      },
    ],
  },
  {
    title: 'FAQ',
    fields: [{ key: 'faqTitle', label: 'Heading', type: 'text', de: true }, faq()],
  },
  {
    title: 'Settings',
    fields: [
      { key: 'singular', label: 'Kind of shoot (default for its galleries)', type: 'text', required: true, de: true, placeholder: 'Wedding' },
      {
        key: 'display',
        label: 'Galleries are shown as',
        type: 'select',
        options: [
          { value: 'cards', label: 'Cards, each gallery has its own page' },
          { value: 'carousel', label: 'One moving row of photos' },
          { value: 'slider', label: 'Slider with thumbnails' },
        ],
      },
      {
        key: 'galleryPages',
        label: 'Gallery pages',
        type: 'bool',
        onText: 'Each gallery also gets its own page and a card on /galleries/',
        offText: 'No own pages (only for the moving row or slider)',
        help: 'Only matters when the galleries are shown as a moving row or slider.',
      },
      { key: 'videosTitle', label: 'Heading above the videos', type: 'text', de: true, placeholder: 'Films' },
      { key: 'region', label: 'Region of its galleries', type: 'select', options: REGIONS },
      { key: 'packages', label: 'Packages page to link to', type: 'packagesPage' },
      { key: 'order', label: 'Position in the menu', type: 'number', help: 'Lower numbers first.' },
      legacyUrls,
    ],
  },
];

// ---------------------------------------------------------------------------
// PACKAGES: src/content/packages/<page>/index.md
// ---------------------------------------------------------------------------
const packages: Section[] = [
  {
    title: 'Page',
    fields: [
      germanSlug,
      { key: 'menuLabel', label: 'Name in the menu', type: 'text', required: true, de: true },
      { key: 'h1', label: 'Main heading (H1)', type: 'text', required: true, de: true },
      { key: 'tagline', label: 'Line under the heading', type: 'text', required: true, de: true },
      { key: '$body', label: 'Introduction', type: 'markdown', rows: 6, de: true },
      { key: 'intro', label: 'Small line above the packages', type: 'text', de: true },
      { key: 'buttonLabel', label: 'Button text', type: 'text', de: true, placeholder: 'Request the packages' },
    ],
  },
  {
    title: 'Google (SEO)',
    fields: [
      { key: 'seoTitle', label: 'Title in Google', type: 'text', required: true, max: GOOGLE_TITLE, de: true },
      { key: 'seoDescription', label: 'Description in Google', type: 'textarea', rows: 3, required: true, max: GOOGLE_DESCRIPTION, de: true },
    ],
  },
  {
    title: 'Packages',
    help: 'No prices on the website: couples request them with the button.',
    fields: [
      {
        key: 'packages',
        label: 'Packages',
        type: 'objects',
        item: 'package',
        de: true,
        fields: [
          { key: 'eyebrow', label: 'Small line above the name', type: 'text' },
          { key: 'title', label: 'Name', type: 'text', required: true },
          { key: 'image', label: 'Photo', type: 'image', required: true },
          { key: 'text', label: 'Text', type: 'textarea', rows: 4, required: true },
          { key: 'included', label: "What's included (one per line)", type: 'lines' },
        ],
      },
    ],
  },
  {
    title: 'FAQ',
    fields: [
      { key: 'faqHeadline', label: 'Heading next to the questions', type: 'text', de: true },
      { key: 'faqTitle', label: 'Small heading', type: 'text', de: true, placeholder: 'FAQ' },
      faq(),
    ],
  },
  {
    title: 'Settings',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        type: 'select',
        options: [
          { value: 'rows', label: 'Rows of photo + text' },
          { value: 'cards', label: 'Cards with "included" lists' },
        ],
      },
      { key: 'heroCategory', label: 'Big photo at the top from category', type: 'category' },
      { key: 'order', label: 'Position in the menu', type: 'number', help: 'Lower numbers first.' },
      legacyUrls,
    ],
  },
];

// ---------------------------------------------------------------------------
// JOURNAL: src/content/journal/<article>/index.md
// ---------------------------------------------------------------------------
const journal: Section[] = [
  {
    title: 'Article',
    fields: [
      germanSlug,
      { key: 'draft', label: 'Publishing', type: 'bool', invert: true, onText: 'Published on the website', offText: 'Draft: hidden on the website' },
      { key: 'title', label: 'Title (H1)', type: 'text', required: true, de: true },
      { key: 'description', label: 'Summary', type: 'textarea', rows: 3, required: true, max: GOOGLE_DESCRIPTION, de: true, help: 'Shown on the journal page and in Google.' },
      {
        key: '$body',
        label: 'Text',
        type: 'markdown',
        rows: 22,
        de: true,
        help: '## for headings, **bold**, *italic*, [link text](/dolomites-elopement-photographer/) for links.',
      },
    ],
  },
  {
    title: 'Photos',
    fields: [
      { key: 'cover', label: 'Cover photo', type: 'photo', required: true },
      { key: 'photos', label: 'Row of photos in the article', type: 'photos' },
      { key: 'galleries', label: 'Galleries shown at the end', type: 'galleries' },
    ],
  },
  { title: 'FAQ', fields: [faq()] },
  {
    title: 'Google & dates',
    fields: [
      { key: 'seoTitle', label: 'Title in Google', type: 'text', max: GOOGLE_TITLE, de: true, help: 'Empty = the title.' },
      { key: 'date', label: 'Published on', type: 'date', required: true },
      { key: 'updated', label: 'Last updated', type: 'date', help: 'Set it when you check or change a guide.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// SETTINGS: src/content/settings.yaml
// ---------------------------------------------------------------------------
const settings: Section[] = [
  {
    title: 'Website',
    fields: [
      {
        key: 'german',
        label: 'German version',
        type: 'bool',
        onText: 'On: the German pages (/de/…) are built',
        offText: 'Off: English only',
        help: 'The German texts stay in their files either way. Restart "npm run dev" after changing it.',
      },
      { key: 'tagline', label: 'Brand line', type: 'text' },
      { key: 'email', label: 'Contact email', type: 'text', required: true },
    ],
  },
  {
    title: 'Google: default texts',
    help: 'For pages without their own title and description.',
    fields: [
      { key: 'seo.en.title', label: 'Title', type: 'text', required: true, max: GOOGLE_TITLE },
      { key: 'seo.en.description', label: 'Description', type: 'textarea', rows: 3, required: true, max: GOOGLE_DESCRIPTION },
      { key: 'seo.de.title', label: 'Titel (Deutsch)', type: 'text', max: GOOGLE_TITLE, deOnly: true },
      { key: 'seo.de.description', label: 'Beschreibung (Deutsch)', type: 'textarea', rows: 3, max: GOOGLE_DESCRIPTION, deOnly: true },
    ],
  },
  {
    title: 'Social media',
    fields: [
      { key: 'social.instagram', label: 'Instagram', type: 'text' },
      { key: 'social.tiktok', label: 'TikTok', type: 'text' },
      { key: 'social.pinterest', label: 'Pinterest', type: 'text' },
    ],
  },
  {
    title: 'For Google and AI answers',
    fields: [
      { key: 'person.name', label: 'Name', type: 'text', required: true },
      { key: 'person.jobTitle', label: 'Job title', type: 'text' },
      { key: 'person.languages', label: 'Languages you offer shoots in (one per line)', type: 'lines' },
      { key: 'areaServed', label: 'Places you work in (one per line)', type: 'lines' },
      { key: 'services', label: 'Kinds of shoot you offer (one per line)', type: 'lines', help: 'No prices.' },
    ],
  },
  {
    title: 'Imprint & privacy policy',
    help: 'Required by Austrian law. Both pages are in German, so write these in German. An empty field is left out of the imprint.',
    fields: [
      { key: 'legal.ownerName', label: 'Full legal name', type: 'text', required: true },
      { key: 'legal.businessForm', label: 'Business form', type: 'text', placeholder: 'Einzelunternehmen' },
      { key: 'legal.businessDescription', label: 'Business', type: 'text' },
      { key: 'legal.street', label: 'Street and number', type: 'text' },
      { key: 'legal.postalCode', label: 'Postal code', type: 'text' },
      { key: 'legal.city', label: 'City', type: 'text' },
      { key: 'legal.country', label: 'Country', type: 'text' },
      { key: 'legal.phone', label: 'Phone', type: 'text', help: 'Empty = not shown.' },
      { key: 'legal.email', label: 'Email', type: 'text' },
      { key: 'legal.vatId', label: 'VAT number (UID)', type: 'text' },
      { key: 'legal.tradeLicence', label: 'Trade licence', type: 'text' },
      { key: 'legal.tradeAuthority', label: 'Trade authority', type: 'text' },
      { key: 'legal.chamberMembership', label: 'Chamber membership', type: 'text' },
      { key: 'legal.hosting', label: 'Web host (company and address)', type: 'text' },
      { key: 'legal.hostingLocation', label: 'Server location', type: 'text', placeholder: 'Deutschland (EU)' },
      { key: 'legal.lastUpdated', label: 'Last updated ("Stand")', type: 'text', placeholder: 'Oktober 2026' },
    ],
  },
];

export const SCHEMAS: Record<Exclude<DocKind, 'page'>, Section[]> = { category, packages, journal, settings };

// ---------------------------------------------------------------------------
// PAGES: fields made from the file (home.yaml, about.yaml, contact.yaml)
// ---------------------------------------------------------------------------

/** "viewGalleries" → "View galleries" */
const labelOf = (key: string) => {
  const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

function fieldOf(key: string, value: unknown): Field {
  if (key === 'category') return { key, label: 'Links to category', type: 'category', required: true };
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) {
      const long = (value as string[]).some((v) => v.length > 100);
      return { key, label: labelOf(key), type: long ? 'paragraphs' : 'lines', de: true, rows: long ? 10 : 4 };
    }
    const first = (value.find((v) => v && typeof v === 'object') ?? {}) as Record<string, unknown>;
    return {
      key,
      label: labelOf(key),
      type: 'objects',
      item: 'item',
      de: true,
      fields: Object.entries(first).map(([k, v]) => ({ ...fieldOf(k, v), de: undefined, required: true })),
    };
  }
  const text = String(value ?? '');
  return { key, label: labelOf(key), type: text.length > 90 ? 'textarea' : 'text', rows: Math.min(8, Math.ceil(text.length / 90) + 1), de: true };
}

/** The form of a page text file, built from its English part. */
export function fieldsFromData(data: Record<string, unknown>): Section[] {
  return [
    {
      title: 'Texts',
      help: '*italic* and **bold** work in most texts. Layout and photos are set in the code (src/views/).',
      fields: Object.entries(data).map(([key, value]) => fieldOf(key, value)),
    },
  ];
}

/**
 * ============================================================================
 * LANGUAGES  (src/i18n/index.ts)
 * ============================================================================
 *
 * The site exists in two languages:
 *   English  (main language)  https://gemycampei.com/about/
 *   German                    https://gemycampei.com/de/ueber-mich/
 *
 * WHERE THE GERMAN TEXT LIVES
 * - Texts used on many pages (menu, buttons, footer, form): `ui` below.
 * - Page texts: next to the English text in each page view (src/views/).
 * - Content: German "sidecar" files next to the English ones:
 *     galleries/<category>/_category.de.md
 *     galleries/<category>/<gallery>/gallery.de.md
 *     src/content/packages/<page>/index.de.md
 *     src/content/journal/<article>/index.de.md
 *   A missing German file never breaks the build: the German page then shows
 *   the English text and is hidden from Google until the translation exists.
 *
 * WHICH LANGUAGE A PAGE HAS
 * Astro knows it from the address (`Astro.currentLocale`, see astro.config.mjs):
 * everything under /de/ is German, everything else English.
 * ============================================================================
 */

export const languages = ['en', 'de'] as const;
export type Lang = (typeof languages)[number];
export const defaultLang: Lang = 'en';

/** For <html lang>, Open Graph and hreflang */
export const locale: Record<Lang, { html: string; og: string; name: string }> = {
  en: { html: 'en', og: 'en_GB', name: 'English' },
  de: { html: 'de-AT', og: 'de_AT', name: 'Deutsch' },
};

/** The language of the current page, from Astro.currentLocale ("de" or undefined/"en"). */
export const langOf = (currentLocale: string | undefined): Lang => (currentLocale === 'de' ? 'de' : 'en');

/**
 * Addresses of the fixed pages in both languages. The German addresses use
 * German words, because that is what German-speaking couples search for.
 */
export const routes = {
  home: { en: '/', de: '/de/' },
  about: { en: '/about/', de: '/de/ueber-mich/' },
  contact: { en: '/contact/', de: '/de/kontakt/' },
  galleries: { en: '/galleries/', de: '/de/galerien/' },
  testimonials: { en: '/testimonials/', de: '/de/erfahrungen/' },
  journal: { en: '/journal/', de: '/de/journal/' },
  imprint: { en: '/imprint/', de: '/de/impressum/' },
  privacy: { en: '/privacy/', de: '/de/datenschutz/' },
  thankYou: { en: '/thank-you/', de: '/de/danke/' },
  messageError: { en: '/message-error/', de: '/de/nachricht-nicht-gesendet/' },
} as const satisfies Record<string, Record<Lang, string>>;

export type RouteName = keyof typeof routes;

/** Both addresses of a page, used for the language switch and hreflang tags. */
export type Alternates = Partial<Record<Lang, string>>;

/** `/de` + path for German, the path itself for English. */
export const prefixed = (lang: Lang, path: string) => (lang === 'de' ? `/de${path}` : path);

// ---------------------------------------------------------------------------
// Texts shared by many pages
// ---------------------------------------------------------------------------
export const ui = {
  en: {
    home: 'Home',
    about: 'About',
    info: 'Info',
    galleries: 'Galleries',
    testimonials: 'Testimonials',
    journal: 'Journal',
    contact: 'Contact',
    menu: 'Menu',
    close: 'Close',
    menuToggle: 'Open or close the menu',
    mainNav: 'Main',
    skip: 'Skip to content',
    languageSwitch: 'Deutsch',
    languageSwitchLabel: 'Diese Seite auf Deutsch',
    imprint: 'Imprint',
    privacy: 'Privacy Policy',
    footerLine: 'Wedding & elopement photographer based in Vienna and the Dolomites',
    ctaEyebrow: "I can't wait to hear yours",
    ctaTitle: 'Every story deserves to be remembered beautifully',
    enquire: 'Enquire about your date',
    viewGallery: 'View gallery →',
    all: 'All',
    filterLabel: 'Filter galleries by type',
    comingSoon: 'New galleries coming soon.',
    faq: 'FAQ',
    kindWords: 'Kind words',
    moreStories: 'More stories',
    readMore: 'Read more →',
    photographedBy: 'photographed by',
    playVideo: 'Play video',
    playsOnVimeo: 'Plays on Vimeo',
    privacyShort: 'privacy',
    breadcrumbHome: 'Home',
    previousPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    previousPhotos: 'Previous photos',
    nextPhotos: 'Next photos',
    showPhoto: 'Show photo',
    of: 'of',
    closeLightbox: 'Close (Esc)',
    zoom: 'Zoom',
    photoError: 'The photo could not be loaded.',
    photos: 'photos',
  },
  de: {
    home: 'Start',
    about: 'Über mich',
    info: 'Info',
    galleries: 'Galerien',
    testimonials: 'Erfahrungen',
    journal: 'Journal',
    contact: 'Kontakt',
    menu: 'Menü',
    close: 'Schließen',
    menuToggle: 'Menü öffnen oder schließen',
    mainNav: 'Hauptmenü',
    skip: 'Zum Inhalt springen',
    languageSwitch: 'English',
    languageSwitchLabel: 'This page in English',
    imprint: 'Impressum',
    privacy: 'Datenschutz',
    footerLine: 'Hochzeits- & Elopement-Fotograf mit Sitz in Wien und den Dolomiten',
    ctaEyebrow: 'Ich freue mich auf eure Geschichte',
    ctaTitle: 'Jede Geschichte verdient es, wunderschön erinnert zu werden',
    enquire: 'Euren Termin anfragen',
    viewGallery: 'Galerie ansehen →',
    all: 'Alle',
    filterLabel: 'Galerien nach Art filtern',
    comingSoon: 'Neue Galerien folgen bald.',
    faq: 'FAQ',
    kindWords: 'Liebe Worte',
    moreStories: 'Weitere Geschichten',
    readMore: 'Weiterlesen →',
    photographedBy: 'fotografiert von',
    playVideo: 'Video abspielen',
    playsOnVimeo: 'Wird auf Vimeo abgespielt',
    privacyShort: 'Datenschutz',
    breadcrumbHome: 'Start',
    previousPhoto: 'Vorheriges Foto',
    nextPhoto: 'Nächstes Foto',
    previousPhotos: 'Vorherige Fotos',
    nextPhotos: 'Nächste Fotos',
    showPhoto: 'Foto zeigen',
    of: 'von',
    closeLightbox: 'Schließen (Esc)',
    zoom: 'Zoomen',
    photoError: 'Das Foto konnte nicht geladen werden.',
    photos: 'Fotos',
  },
} as const;

export type UiKey = keyof (typeof ui)['en'];

/** The shared texts of one language: `const t = useUi(lang); t.contact` */
export const useUi = (lang: Lang) => ui[lang];

/**
 * Pick the text of the current language from an object with both:
 *   pick(lang, { en: 'Hello', de: 'Hallo' })
 */
export const pick = <T>(lang: Lang, texts: Record<Lang, T>): T => texts[lang];

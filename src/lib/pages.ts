/**
 * ============================================================================
 * PAGE TEXTS  (src/lib/pages.ts)
 * ============================================================================
 *
 * The texts of the home, about and contact pages live in
 * src/content/pages/<page>.yaml (editable in the gallery manager → Pages),
 * with an `en` and a `de` part. The views in src/views/ read them here; the
 * layout and the photos stay in the views.
 *
 * Texts may contain *italic* and **bold** (rendered with inlineMarkdown()).
 * ============================================================================
 */
import { parse } from 'yaml';
import type { Lang } from '../i18n';

/** The YAML files as raw text, bundled at build time */
const files = import.meta.glob<string>('/src/content/pages/*.yaml', { eager: true, query: '?raw', import: 'default' });

interface LinkCard {
  title: string;
  text: string;
  link: string;
  /** Folder name of the category the card links to */
  category: string;
}

export interface HomeTexts {
  description: string;
  h1: string;
  intro: string;
  viewGalleries: string;
  heroAlt: string;
  statement: string;
  answerEyebrow: string;
  answerTitle: string;
  answer: string;
  destinations: LinkCard[];
  portfolio: string;
  galleries: string;
  allGalleries: string;
  portraitAlt: string;
  aboutEyebrow: string;
  aboutTitle: string;
  about: string[];
  aboutLink: string;
  packagesEyebrow: string;
  packagesTitle: string;
  seePackages: string;
  eloping: string;
  elopementLink: string;
  filmTitle: string;
  filmText: string;
  filmLink: string;
  journalEyebrow: string;
  journalTitle: string;
  allArticles: string;
}

export interface AboutTexts {
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  storyTitle: string;
  story: string[];
  portraitAlt: string;
  approachEyebrow: string;
  approach: string;
  points: { title: string; text: string }[];
  whereEyebrow: string;
  whereTitle: string;
  where: LinkCard[];
  togetherEyebrow: string;
  togetherTitle: string;
  together: string[];
  contactLink: string;
  stripAlt: string;
}

export interface ContactTexts {
  title: string;
  description: string;
  display: string;
  lede: string;
  reply: string;
  replyText: string;
  email: string;
  elsewhere: string;
  photoAlt: string;
}

interface Pages {
  home: HomeTexts;
  about: AboutTexts;
  contact: ContactTexts;
}

/** The texts of one page in one language (German falls back to English per text). */
export function getPage<P extends keyof Pages>(page: P, lang: Lang): Pages[P] {
  const raw = files[`/src/content/pages/${page}.yaml`];
  if (!raw) throw new Error(`src/content/pages/${page}.yaml is missing.`);
  const data = parse(raw) as Record<Lang, Pages[P]>;
  return lang === 'de' ? { ...data.en, ...(data.de ?? {}) } : data.en;
}

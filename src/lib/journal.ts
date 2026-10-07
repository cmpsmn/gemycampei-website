/**
 * ============================================================================
 * JOURNAL  (src/lib/journal.ts)
 * ============================================================================
 *
 * The guides in src/content/journal/<folder>/, in both languages:
 *   English  /journal/<folder>/          index.md
 *   German   /de/journal/<slug>/         index.de.md (its `slug`)
 *
 * An article without index.de.md only exists in English. Drafts (`draft: true`)
 * are shown with `npm run dev` only, like galleries.
 * ============================================================================
 */
import type { ImageMetadata } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { galleryPhoto, getGalleryById, photoAlt } from './galleries';
import type { Lang } from '../i18n';

export interface JournalArticle {
  id: string;
  entry: CollectionEntry<'journal'>;
  de?: CollectionEntry<'journalDe'>;
  href: string;
  /** Undefined when there is no German version */
  hrefDe?: string;
  cover: ImageMetadata;
  /** The ref of the cover ("<category>/<gallery>/<file>") to find its description */
  coverRef: string;
  photos: { ref: string; image: ImageMetadata }[];
}

const showDrafts = import.meta.env.DEV;
let cache: Promise<JournalArticle[]> | undefined;

function loadArticles(): Promise<JournalArticle[]> {
  cache ??= (async () => {
    const german = new Map((await getCollection('journalDe')).map((entry) => [entry.id, entry]));
    return (await getCollection('journal'))
      .filter((entry) => showDrafts || !entry.data.draft)
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((entry) => {
        const de = german.get(entry.id);
        return {
          id: entry.id,
          entry,
          de,
          href: `/journal/${entry.id}/`,
          hrefDe: de ? `/de/journal/${de.data.slug}/` : undefined,
          cover: galleryPhoto(entry.data.cover),
          coverRef: entry.data.cover,
          photos: entry.data.photos.map((ref) => ({ ref, image: galleryPhoto(ref) })),
        };
      });
  })();
  return cache;
}

/** Articles available in a language, newest first */
export async function getJournalArticles(lang: Lang): Promise<JournalArticle[]> {
  const all = await loadArticles();
  return lang === 'de' ? all.filter((a) => a.de) : all;
}

/**
 * The description (alt text) of a gallery photo named as "<category>/<gallery>/<file>",
 * taken from that gallery's photos.yaml.
 */
export async function describePhotoRef(ref: string, lang: Lang): Promise<string> {
  const [category, slug, name] = ref.split('/');
  const gallery = await getGalleryById(`${category}/${slug}`);
  const photo = gallery?.photos.find((p) => p.name === name);
  return gallery && photo ? photoAlt(gallery, photo, lang) : '';
}

/** Title, description and FAQ of an article in one language */
export function articleText(article: JournalArticle, lang: Lang) {
  const en = article.entry.data;
  const de = lang === 'de' ? article.de?.data : undefined;
  return {
    title: de?.title ?? en.title,
    seoTitle: de?.seoTitle ?? de?.title ?? en.seoTitle ?? en.title,
    description: de?.description ?? en.description,
    faq: de ? de.faq : en.faq,
  };
}

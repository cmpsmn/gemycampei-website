/**
 * ============================================================================
 * PACKAGES PAGES  (src/lib/packages.ts)
 * ============================================================================
 *
 * The packages pages in src/content/packages/ in both languages:
 *   English  /wedding-photography-packages/        index.md
 *   German   /de/hochzeitsfotografie-pakete/        index.de.md (its `slug`)
 *
 * Used by the header, the footer and every page that links to a packages page.
 * ============================================================================
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n';

export interface PackagesPageInfo {
  id: string;
  entry: CollectionEntry<'packages'>;
  de?: CollectionEntry<'packagesDe'>;
  href: string;
  hrefDe: string;
  /** Menu label in each language */
  label: Record<Lang, string>;
}

let cache: Promise<PackagesPageInfo[]> | undefined;

/** All packages pages, in menu order */
export function getPackagesPages(): Promise<PackagesPageInfo[]> {
  cache ??= (async () => {
    const german = new Map((await getCollection('packagesDe')).map((entry) => [entry.id, entry]));
    return (await getCollection('packages'))
      .sort((a, b) => a.data.order - b.data.order)
      .map((entry) => {
        const de = german.get(entry.id);
        return {
          id: entry.id,
          entry,
          de,
          href: `/${entry.id}/`,
          hrefDe: `/de/${de?.data.slug ?? entry.id}/`,
          label: { en: entry.data.menuLabel, de: de?.data.menuLabel ?? entry.data.menuLabel },
        };
      });
  })();
  return cache;
}

/** One packages page by its folder name */
export async function getPackagesPage(id: string): Promise<PackagesPageInfo | undefined> {
  return (await getPackagesPages()).find((page) => page.id === id);
}

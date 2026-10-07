/**
 * The list of gallery pages for getStaticPaths(), in one language.
 * Shared by src/pages/[category]/[gallery].astro and its German twin.
 */
import { getCategories, getGalleries } from './galleries';
import type { Lang } from '../i18n';

export async function galleryPaths(lang: Lang) {
  const categories = await getCategories();
  const paths = [];
  for (const category of categories) {
    // Galleries whose folder is in this category and that need their own page
    const galleries = (await getGalleries(category.id, { mainOnly: true })).filter((g) => g.hasPage);
    for (const [i, gallery] of galleries.entries()) {
      paths.push({
        params: {
          category: lang === 'de' ? (category.de?.data.slug ?? category.id) : category.id,
          gallery: gallery.slug,
        },
        // prev / next let visitors browse through the galleries of this category,
        // in a circle: after the last gallery comes the first again. With only two
        // galleries, previous and next would be the same one: then only "next".
        props: {
          gallery,
          category,
          prev: galleries.length > 2 ? galleries[(i - 1 + galleries.length) % galleries.length] : null,
          next: galleries.length > 1 ? galleries[(i + 1) % galleries.length] : null,
        },
      });
    }
  }
  return paths;
}

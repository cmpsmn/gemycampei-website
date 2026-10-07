/**
 * ============================================================================
 * TESTIMONIALS LOADER  (src/lib/testimonials.ts)
 * ============================================================================
 *
 * Reads the reviews in src/content/testimonials/ and connects them to galleries:
 *
 *   ---
 *   names: "Annie & Huong"
 *   gallery: dolomites-elopement-photographer/val-di-funes-couple-session-a-and-h   ← optional link
 *   galleryPhoto: val-di-funes-couple-session-a-and-h-001.jpg ← optional photo from that gallery
 *   image: ./annie-and-huong.jpg                             ← or a photo next to the file
 *   ---
 *
 * Used by:
 *   src/pages/testimonials.astro                  all reviews + "View their gallery"
 *   src/pages/[category]/[gallery].astro          the review(s) of that gallery
 *
 * Mistakes (missing photo, unknown gallery) stop the build with a clear message.
 * ============================================================================
 */
import type { ImageMetadata } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { getGalleryById, isVisible, type Gallery } from './galleries';

export interface Testimonial {
  entry: CollectionEntry<'testimonials'>;
  names: string;
  /** The photo to show: galleryPhoto from the linked gallery, or the own image */
  image: ImageMetadata;
  /** The linked gallery, only if it is visible on the site and has its own page */
  gallery?: Gallery;
}

let cache: Promise<Testimonial[]> | undefined;

/** All reviews in page order (lower `order` first). */
export function getTestimonials(): Promise<Testimonial[]> {
  cache ??= (async () => {
    const entries = (await getCollection('testimonials')).sort(
      (a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id),
    );

    const result: Testimonial[] = [];
    for (const entry of entries) {
      const where = `src/content/testimonials/${entry.id}.md`;
      const { data } = entry;

      // The linked gallery (may be a draft: then the link is hidden on the live site)
      const linked = data.gallery ? await getGalleryById(data.gallery) : undefined;
      if (data.gallery && !linked) {
        throw new Error(`${where}: gallery "${data.gallery}" does not exist. Use "<category>/<gallery folder>".`);
      }

      // Photo: from the gallery if galleryPhoto is set, otherwise the own image
      let image = data.image;
      if (data.galleryPhoto) {
        if (!linked) throw new Error(`${where}: galleryPhoto needs a gallery to take the photo from.`);
        const photo = linked.photos.find((p) => p.name === data.galleryPhoto);
        if (!photo) throw new Error(`${where}: "${data.galleryPhoto}" is not a photo in galleries/${linked.id}/.`);
        image = photo.image;
      }
      if (!image) throw new Error(`${where}: add an image or choose a galleryPhoto.`);

      result.push({
        entry,
        names: data.names,
        image,
        gallery: linked && isVisible(linked) && linked.hasPage ? linked : undefined,
      });
    }
    return result;
  })();
  return cache;
}

/** The reviews linked to one gallery. */
export async function getTestimonialsFor(galleryId: string): Promise<Testimonial[]> {
  return (await getTestimonials()).filter((t) => t.entry.data.gallery === galleryId);
}

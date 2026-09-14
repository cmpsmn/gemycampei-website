/**
 * ============================================================================
 * CAROUSEL HELPERS  (src/components/carousel.ts)
 * ============================================================================
 *
 * Small functions shared by PhotoSlider.tsx and PhotoCarousel.tsx.
 *
 * Both components are built on a normal horizontally scrolling element with
 * CSS "scroll snap". The browser handles swiping, momentum and snapping by
 * itself, which is smooth on phones and needs no library. These helpers only
 * find out which slide is in the middle and scroll to a given slide.
 * ============================================================================
 */

/** All slide elements inside a track (its direct children). */
const slidesOf = (track: HTMLElement) => Array.from(track.children) as HTMLElement[];

/** Index of the slide whose centre is closest to the centre of the visible area. */
export function closestSlide(track: HTMLElement): number {
  const center = track.scrollLeft + track.clientWidth / 2;
  let best = 0;
  let bestDistance = Infinity;
  slidesOf(track).forEach((slide, index) => {
    const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/**
 * Scrolls the track so that slide `index` is centred.
 * Only the track scrolls, never the whole page.
 */
export function scrollToSlide(track: HTMLElement, index: number, smooth = true): void {
  const slides = slidesOf(track);
  const slide = slides[Math.max(0, Math.min(index, slides.length - 1))];
  if (!slide) return;
  const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  track.scrollTo({ left, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
}

/** true when the track is scrolled to the very end. */
export const atEnd = (track: HTMLElement) => track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;

/**
 * ============================================================================
 * LIGHTBOX HOOK  (src/components/useLightbox.ts)  ·  custom React hook
 * ============================================================================
 *
 * Opens photos fullscreen with PhotoSwipe. Used by PhotoGallery, PhotoSlider
 * and PhotoCarousel, so the setup code exists only once.
 *
 * WHAT IS A CUSTOM HOOK?
 * A normal function whose name starts with "use" and that calls other hooks
 * (useEffect, useRef ...). It lets several components share the same logic.
 *
 * Usage inside a component:
 *   const openLightbox = useLightbox(photos);
 *   <a onClick={(event) => openLightbox(event, index)}>
 *
 * SPEED
 * - The main PhotoSwipe code is only downloaded when a photo is opened.
 * - Each slide gets a `srcset`, so phones load the 1200 px file, not 2400 px.
 * ============================================================================
 */
import { useCallback, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';
import type { PhotoData } from '../lib/galleries';
import { ui, type Lang } from '../i18n';

export function useLightbox(photos: PhotoData[], lang: Lang = 'en') {
  // useRef keeps the PhotoSwipe object between renders without re-rendering
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);

  // useEffect runs in the browser after the component appears
  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      dataSource: photos.map((p) => ({
        src: p.full.src,
        srcset: p.full.srcSet, // PhotoSwipe picks the right size for the screen
        width: p.full.width,
        height: p.full.height,
        alt: p.alt,
      })),
      pswpModule: () => import('photoswipe'),
      bgOpacity: 0.96,
      showHideAnimationType: 'fade',
      loop: false,
      preload: [1, 1], // only preload one photo before and after the current one
      // Button labels in the language of the page
      closeTitle: ui[lang].closeLightbox,
      zoomTitle: ui[lang].zoom,
      arrowPrevTitle: ui[lang].previousPhoto,
      arrowNextTitle: ui[lang].nextPhoto,
      errorMsg: ui[lang].photoError,
      indexIndicatorSep: ` ${ui[lang].of} `,
    });
    lightbox.init();
    lightboxRef.current = lightbox;

    // Cleanup when the component disappears
    return () => {
      lightbox.destroy();
      lightboxRef.current = null;
    };
  }, [photos, lang]);

  /**
   * Opens the lightbox at a photo. If PhotoSwipe isn't ready yet, the click
   * simply follows the link to the large image.
   * useCallback keeps the same function between renders.
   */
  return useCallback((event: MouseEvent<HTMLElement>, index: number) => {
    if (!lightboxRef.current) return;
    event.preventDefault();
    lightboxRef.current.loadAndOpen(index);
  }, []);
}

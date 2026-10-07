/**
 * ============================================================================
 * PHOTO CAROUSEL  (src/components/PhotoCarousel.tsx)  ·  React component
 * ============================================================================
 *
 * A full-width row of photos, all the same height, that moves on by itself
 * every few seconds, like the 35mm & Super 8 page of the original site.
 * Used by categories with `display: carousel` in their _category.md
 * (currently maternity and 35mm & Super 8).
 *
 * INTERACTION
 * - swipe or scroll sideways, or use the arrows below
 * - click a photo to open it fullscreen
 *
 * AUTOPLAY RULES (so it never gets in the way)
 * It pauses while the mouse is over it, while it has keyboard focus, while it
 * is scrolled out of view, while the browser tab is in the background, and for
 * a while after the visitor swipes or clicks. It is switched off completely for
 * people who turned on "reduce motion" in their system settings.
 * At the last photo it returns to the first.
 *
 * REACT CONCEPTS USED HERE
 * - useEffect with a cleanup function for the timer and the observers
 * - useRef for values that change without needing a re-render (pause flags)
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react';
import type { PhotoData } from '../lib/galleries';
import { useLightbox } from './useLightbox';
import { ui, type Lang } from '../i18n';
import { atEnd, closestSlide, scrollToSlide } from './carousel';
import './PhotoCarousel.css';

interface Props {
  photos: PhotoData[];
  label: string;
  /** Seconds between automatic moves. 0 = no autoplay. */
  interval?: number;
  lang?: Lang;
}

/** Slide heights from PhotoCarousel.css, used to calculate `sizes` */
const HEIGHT_DESKTOP = 618;
const HEIGHT_PHONE = 300;

export default function PhotoCarousel({ photos, label, interval = 3, lang = 'en' }: Props) {
  const t = ui[lang];
  const trackRef = useRef<HTMLDivElement>(null);
  const openLightbox = useLightbox(photos, lang);
  const [playing, setPlaying] = useState(interval > 0);

  // Reasons to pause. Refs, because changing them must not re-render the component.
  const hovered = useRef(false);
  const visible = useRef(false);
  const pausedUntil = useRef(0);

  function move(step: number) {
    const track = trackRef.current;
    if (!track) return;
    // After the last photo, jump back to the first
    const next = step > 0 && atEnd(track) ? 0 : closestSlide(track) + step;
    scrollToSlide(track, next);
  }

  /** A visitor action pauses autoplay for 8 seconds */
  function userMove(step: number) {
    pausedUntil.current = Date.now() + 8000;
    move(step);
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track || interval <= 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPlaying(false);
      return;
    }

    // IntersectionObserver tells us whether the carousel is on screen
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    observer.observe(track);

    const timer = window.setInterval(() => {
      const focused = track.contains(document.activeElement);
      const shouldMove =
        visible.current && !hovered.current && !focused && !document.hidden && Date.now() > pausedUntil.current;
      if (shouldMove) move(1);
    }, interval * 1000);

    // Cleanup: stop the timer and the observer when the component disappears
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, [interval]);

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={label}>
      <div
        className="carousel-track"
        ref={trackRef}
        onMouseEnter={() => (hovered.current = true)}
        onMouseLeave={() => (hovered.current = false)}
        onPointerDown={() => (pausedUntil.current = Date.now() + 8000)}
        // While autoplaying, screen readers should not announce every move
        aria-live={playing ? 'off' : 'polite'}
      >
        {photos.map((photo, index) => {
          const ratio = photo.thumb.width / photo.thumb.height;
          return (
            <div
              key={photo.full.src}
              className="carousel-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} ${t.of} ${photos.length}`}
            >
              <a href={photo.full.src} onClick={(event) => openLightbox(event, index)}>
                <img
                  src={photo.thumb.src}
                  srcSet={photo.thumb.srcSet}
                  // All slides have a fixed height, so width = height × ratio.
                  // Phones: × 0.67 caps high-density screens at ~2× (sharp, but much smaller files).
                  sizes={`(max-width: 700px) ${Math.round(HEIGHT_PHONE * ratio * 0.67)}px, ${Math.round(HEIGHT_DESKTOP * ratio)}px`}
                  width={photo.thumb.width}
                  height={photo.thumb.height}
                  alt={photo.alt}
                  // The first few are visible immediately, the rest load when they come close
                  loading={index < 3 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </a>
            </div>
          );
        })}
      </div>

      <div className="carousel-controls">
        <button type="button" className="carousel-arrow" onClick={() => userMove(-1)} aria-label={t.previousPhotos}>
          ←
        </button>
        <button type="button" className="carousel-arrow" onClick={() => userMove(1)} aria-label={t.nextPhotos}>
          →
        </button>
      </div>
    </section>
  );
}

/**
 * ============================================================================
 * PHOTO SLIDER  (src/components/PhotoSlider.tsx)  ·  React component
 * ============================================================================
 *
 * One large photo at a time, a counter ("4 / 38"), previous/next arrows and a
 * row of thumbnails below, like the original Pixieset maternity page.
 * Used by categories with `display: slider` in their _category.md.
 * Currently no category uses it (maternity switched to the carousel), but it
 * stays available: set `display: slider` in any _category.md to use it.
 *
 * INTERACTION
 * - swipe or scroll the large photo, click the arrows, or use ← → on the keyboard
 * - click a thumbnail to jump to that photo
 * - click the large photo to open it fullscreen
 *
 * REACT CONCEPTS USED HERE
 * - useState for the active photo index
 * - useRef to reach the real DOM elements (the scrolling tracks)
 * - useEffect to keep the active thumbnail visible when the index changes
 *
 * SPEED
 * Only the first photo loads immediately. The others use loading="lazy", so the
 * browser fetches them just before they scroll into view. Thumbnails use the
 * smallest generated file (160 px).
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { PhotoData } from '../lib/galleries';
import { useLightbox } from './useLightbox';
import { ui, type Lang } from '../i18n';
import { closestSlide, scrollToSlide } from './carousel';
import './PhotoSlider.css';

interface Props {
  photos: PhotoData[];
  /** Name for screen readers, e.g. "Maternity photos" */
  label: string;
  lang?: Lang;
}

/** Tallest the large photo gets on desktop (matches .slider-slide img in the CSS) */
const STAGE_HEIGHT = 760;
const STAGE_MAX_WIDTH = 1100;

export default function PhotoSlider({ photos, label, lang = 'en' }: Props) {
  const t = ui[lang];
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  /**
   * While an arrow or thumbnail click scrolls smoothly to a photo, the scroll
   * position passes the photos in between. `target` remembers where we are
   * going, so those in-between positions don't reset the counter.
   */
  const target = useRef<number | null>(null);
  const openLightbox = useLightbox(photos, lang);

  /** Update the counter while swiping. requestAnimationFrame limits it to once per screen refresh. */
  function handleScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!trackRef.current) return;
      const current = closestSlide(trackRef.current);
      if (target.current !== null) {
        if (current !== target.current) return; // still on the way
        target.current = null; // arrived
      }
      setActive(current);
    });
  }

  const settleTimer = useRef(0);

  /** Jump to a photo number (thumbnails). */
  function goTo(index: number) {
    const next = Math.max(0, Math.min(index, photos.length - 1));
    target.current = next;
    setActive(next);
    if (trackRef.current) scrollToSlide(trackRef.current, next);
    // Safety net: if no scrolling happens (already there), stop waiting after a moment
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => (target.current = null), 1000);
  }

  /** Move forward or back (arrows, keyboard). Starts from where a running move is heading,
   *  so quick repeated clicks add up. */
  function step(delta: number) {
    goTo((target.current ?? active) + delta);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  }

  // Keep the active thumbnail in view (scrolls only the thumbnail row)
  useEffect(() => {
    if (thumbsRef.current) scrollToSlide(thumbsRef.current, active);
  }, [active]);

  return (
    <section className="slider" aria-roledescription="carousel" aria-label={label}>
      <div
        className="slider-track"
        ref={trackRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0} // makes the track focusable, so the arrow keys work
      >
        {photos.map((photo, index) => {
          const ratio = photo.thumb.width / photo.thumb.height;
          return (
            <div
              key={photo.full.src}
              className="slider-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} ${t.of} ${photos.length}`}
            >
              <a href={photo.full.src} onClick={(event) => openLightbox(event, index)}>
                <img
                  src={photo.thumb.src}
                  srcSet={photo.thumb.srcSet}
                  // Width on screen = height × ratio, capped by the stage width. Phones: 2× density cap.
                  sizes={`(max-width: 700px) 67vw, ${Math.round(Math.min(STAGE_MAX_WIDTH, STAGE_HEIGHT * ratio))}px`}
                  width={photo.thumb.width}
                  height={photo.thumb.height}
                  alt={photo.alt}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </a>
            </div>
          );
        })}
      </div>

      <div className="slider-controls">
        <button type="button" className="slider-arrow" onClick={() => step(-1)} disabled={active === 0} aria-label={t.previousPhoto}>
          ←
        </button>
        {/* aria-live announces the new number to screen readers */}
        <p className="slider-counter" aria-live="polite">
          {active + 1} / {photos.length}
        </p>
        <button
          type="button"
          className="slider-arrow"
          onClick={() => step(1)}
          disabled={active === photos.length - 1}
          aria-label={t.nextPhoto}
        >
          →
        </button>
      </div>

      <div className="slider-thumbs" ref={thumbsRef}>
        {photos.map((photo, index) => (
          <button
            key={photo.full.src}
            type="button"
            className="slider-thumb"
            aria-current={index === active}
            aria-label={`${t.showPhoto} ${index + 1}`}
            onClick={() => goTo(index)}
          >
            <img
              src={photo.thumb.src}
              srcSet={photo.thumb.srcSet}
              sizes={`${Math.round(72 * (photo.thumb.width / photo.thumb.height))}px`}
              width={photo.thumb.width}
              height={photo.thumb.height}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
      </div>
    </section>
  );
}

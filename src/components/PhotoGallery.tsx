/**
 * ============================================================================
 * PHOTO GALLERY  (src/components/PhotoGallery.tsx)  ·  React component
 * ============================================================================
 *
 * A grid of photos in "justified rows" (used on gallery pages). Clicking a
 * photo opens it fullscreen (see useLightbox.ts).
 *
 * HOW IT WORKS
 * 1. At build time Astro renders the grid to HTML (so Google sees all images).
 * 2. In the browser React "hydrates" it and attaches the click handlers.
 *    The page loads it with `client:visible`, so this happens when the grid
 *    scrolls into view.
 * 3. Until then every photo is a normal link to the large image.
 *
 * SPEED: EXACT `sizes`
 * Rows are about 340 px high on desktop (240 px on tablets). A photo's width
 * is therefore roughly height × aspect ratio. We tell the browser exactly that,
 * so a portrait photo in a row loads a ~480 px file instead of a 1200 px one.
 * ============================================================================
 */
import type { CSSProperties } from 'react';
import type { PhotoData } from '../lib/galleries';
import { useLightbox } from './useLightbox';
import './PhotoGallery.css';

interface Props {
  photos: PhotoData[];
  /** How many photos load immediately; the rest load while scrolling */
  eagerCount?: number;
}

/** Row heights from PhotoGallery.css, plus room for rows that stretch to fill the width */
const ROW_DESKTOP = 340 * 1.3;
const ROW_TABLET = 240 * 1.3;

/**
 * The `sizes` attribute for one photo.
 * Phones (one photo per row) use 67vw instead of 100vw: on high-density phone
 * screens this downloads a file about 2× the screen width instead of 3×, which
 * looks just as sharp but is less than half the size.
 */
export function sizesForRatio(ratio: number): string {
  return [
    '(max-width: 560px) 67vw',
    `(max-width: 900px) ${Math.round(ROW_TABLET * ratio)}px`,
    `${Math.round(ROW_DESKTOP * ratio)}px`,
  ].join(', ');
}

export default function PhotoGallery({ photos, eagerCount = 3 }: Props) {
  const openLightbox = useLightbox(photos);

  return (
    <div className="photo-grid">
      {photos.map((photo, index) => {
        // Width divided by height, e.g. 1.5 for landscape, 0.67 for portrait.
        // The CSS uses it so every photo keeps its shape in the justified rows.
        const ratio = photo.thumb.width / photo.thumb.height;
        return (
          <a
            key={photo.full.src}
            href={photo.full.src}
            className="photo"
            style={{ '--ratio': ratio } as CSSProperties}
            onClick={(event) => openLightbox(event, index)}
          >
            <img
              src={photo.thumb.src}
              srcSet={photo.thumb.srcSet}
              sizes={sizesForRatio(ratio)}
              width={photo.thumb.width}
              height={photo.thumb.height}
              alt={photo.alt}
              loading={index < eagerCount ? 'eager' : 'lazy'}
              // The very first photo is usually the biggest thing on screen: load it first
              fetchPriority={index === 0 ? 'high' : 'auto'}
              decoding="async"
            />
          </a>
        );
      })}
    </div>
  );
}

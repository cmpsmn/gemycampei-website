/**
 * ============================================================================
 * PHOTO GALLERY  (src/components/PhotoGallery.tsx)  ·  React component
 * ============================================================================
 *
 * The photos of a gallery page, in their original order, paced like a book:
 *
 *   ┌────┬──────┬────┐   rows of 2–4 photos, every row about the same height
 *   ├──────┬─────────┤
 *   │ review of the couple │  ← after the first ~9 photos (passed in as `review`)
 *   ├────┬────┬──────┤
 *   │   one landscape photo, full width   │  ← a pause every ~9 photos
 *   └──────────────────┘
 *
 * Clicking a photo opens it fullscreen (see useLightbox.ts).
 *
 * HOW THE ROWS STAY ONE HEIGHT
 * Every photo in a row gets a width proportional to its shape (width ÷ height,
 * its "ratio"), so all photos in a row come out exactly as tall and none is
 * cropped. Photos are added to a row until it would be about TARGET_HEIGHT
 * tall: three portraits side by side no longer make a row taller than the
 * screen, three landscapes no longer a flat strip.
 *
 * SCREEN SIZES
 * The grouping depends on the width: on phones two portraits share a row and
 * a landscape gets the full width. The HTML is built for a desktop width; in
 * the browser the component measures the real width and regroups if needed.
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { PhotoData } from '../lib/galleries';
import { useLightbox } from './useLightbox';
import type { Lang } from '../i18n';
import './PhotoGallery.css';

interface Props {
  photos: PhotoData[];
  /** Shown as the first pause in the photos (the couple's review) */
  review?: ReactNode;
  /** true when `review` has content (an empty slot must not become a pause) */
  hasReview?: boolean;
  /**
   * How many photos load immediately; the rest load while scrolling.
   * 0 by default: the gallery starts below the cover photo, so loading its
   * photos early would only compete with the cover (the largest element).
   */
  eagerCount?: number;
  lang?: Lang;
}

/** A pause (the review, then a full-width photo) comes after this many photos */
const PHOTOS_PER_CHAPTER = 9;
/** A photo at least this much wider than tall can stand alone as a full-width pause */
const LANDSCAPE = 1.3;

interface Placed {
  photo: PhotoData;
  index: number;
  ratio: number;
}

type Block =
  | { kind: 'row'; items: Placed[]; spacers: number; rowRatio: number }
  | { kind: 'feature'; item: Placed }
  | { kind: 'review' };

/** Row height, photos per row and so on for a container width */
function settingsFor(width: number) {
  if (width < 600) return { width, target: 260, maxPerRow: 2, features: false };
  if (width < 1000) return { width, target: 340, maxPerRow: 3, features: true };
  return { width, target: 480, maxPerRow: 3, features: true };
}

/**
 * Groups the photos into rows (in order) and places the pauses.
 * A row is closed as soon as its photos would be no taller than the target.
 */
function layout(photos: PhotoData[], width: number, withReview: boolean): Block[] {
  const { target, maxPerRow, features } = settingsFor(width);
  const fullRow = width / target; // total ratio of a row that is exactly `target` tall
  const blocks: Block[] = [];
  let row: Placed[] = [];
  let sinceBreak = 0;
  let reviewPlaced = !withReview;

  const closeRow = (last = false) => {
    if (!row.length) return;
    const sum = row.reduce((s, p) => s + p.ratio, 0);
    // A short last row gets invisible spacers, so it keeps about the same height
    const missing = last ? Math.max(0, fullRow - sum) : 0;
    const spacers = last ? Math.min(Math.ceil(missing), maxPerRow) : 0;
    blocks.push({ kind: 'row', items: row, spacers, rowRatio: sum + spacers });
    row = [];
  };

  photos.forEach((photo, index) => {
    const placed = { photo, index, ratio: photo.thumb.width / photo.thumb.height };

    // At a row boundary after a chapter: first the review, later a full-width landscape
    if (!row.length && sinceBreak >= PHOTOS_PER_CHAPTER) {
      if (!reviewPlaced) {
        blocks.push({ kind: 'review' });
        reviewPlaced = true;
        sinceBreak = 0;
      } else if (features && placed.ratio >= LANDSCAPE) {
        blocks.push({ kind: 'feature', item: placed });
        sinceBreak = 0;
        return;
      }
    }

    row.push(placed);
    sinceBreak++;
    const sum = row.reduce((s, p) => s + p.ratio, 0);
    // Close the row once it is (nearly) as wide as a row at the target height
    if (sum >= fullRow * 0.9 || row.length >= maxPerRow) closeRow();
  });
  closeRow(true);
  // A short gallery still shows its review, after the photos
  if (!reviewPlaced) blocks.push({ kind: 'review' });
  return blocks;
}

/** The width the HTML is built for (a 1440px screen minus the side margins) */
const BUILD_WIDTH = 1360;

export default function PhotoGallery({ photos, review, hasReview = false, eagerCount = 0, lang = 'en' }: Props) {
  const openLightbox = useLightbox(photos, lang);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(BUILD_WIDTH);

  // Measure the real width in the browser and regroup when it changes a lot
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth || BUILD_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const blocks = layout(photos, width, hasReview);

  const image = (placed: Placed, share: number) => (
    <a
      key={placed.photo.full.src}
      href={placed.photo.full.src}
      className="photo"
      style={{ '--ratio': placed.ratio } as CSSProperties}
      onClick={(event) => openLightbox(event, placed.index)}
    >
      <img
        src={placed.photo.thumb.src}
        srcSet={placed.photo.thumb.srcSet}
        // This photo's share of the page width, so the browser picks a file that is just sharp enough
        sizes={`${Math.ceil(share * 100)}vw`}
        width={placed.photo.thumb.width}
        height={placed.photo.thumb.height}
        alt={placed.photo.alt}
        loading={placed.index < eagerCount ? 'eager' : 'lazy'}
        decoding="async"
      />
    </a>
  );

  return (
    <div className="photo-grid" ref={container}>
      {blocks.map((block, i) => {
        if (block.kind === 'review') {
          return (
            <div className="photo-pause" key={`review-${i}`}>
              {review}
            </div>
          );
        }
        if (block.kind === 'feature') {
          return (
            <div className="photo-feature" key={`feature-${i}`}>
              {image(block.item, 1)}
            </div>
          );
        }
        return (
          <div className="photo-row" key={`row-${i}`}>
            {block.items.map((placed) => image(placed, placed.ratio / block.rowRatio))}
            {Array.from({ length: block.spacers }, (_, s) => (
              <span className="photo-spacer" key={`spacer-${s}`} aria-hidden="true" />
            ))}
          </div>
        );
      })}
    </div>
  );
}


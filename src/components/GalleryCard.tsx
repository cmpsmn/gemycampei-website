/**
 * ============================================================================
 * GALLERY CARD  (src/components/GalleryCard.tsx)  ·  React component
 * ============================================================================
 *
 * One card in a gallery grid, in the shape of the v3 design:
 *
 *   ┌───────────────┐
 *   │  cover photo  │   (3:4, zooms slightly on hover)
 *   └───────────────┘
 *   Couple · Title              01     ← hairline above this row
 *   ELOPEMENT · LAGO DI BRAIES
 *   VIEW GALLERY →
 *
 * WHAT IS A REACT COMPONENT?
 * A function that receives "props" (an object with data) and returns JSX:
 * HTML-like markup inside JavaScript. `{gallery.title}` inserts a value.
 * Differences to HTML: `className` instead of `class`, `srcSet` instead of `srcset`.
 *
 * WHERE IT RUNS
 * - On category pages it is used WITHOUT a client directive. Astro renders it to
 *   plain HTML at build time and sends no JavaScript for it.
 * - Inside <GalleryFilter> on /galleries/ it runs in the browser too, because
 *   the filter needs to re-render the list when a button is clicked.
 * ============================================================================
 */
import type { CardData } from '../lib/galleries';
import { ui, type Lang } from '../i18n';
import './GalleryCard.css';

/** The props this component accepts. TypeScript checks every place that uses it. */
interface Props {
  gallery: CardData;
  /** Position label shown next to the title, e.g. "03" */
  number?: string;
  /** true = load the image immediately (use for the first cards on a page) */
  eager?: boolean;
  /** true = show the category name instead of the type (used on the overview page) */
  showCategory?: boolean;
  lang?: Lang;
}

// `{ gallery, eager = false, ... }` unpacks the props object and sets defaults.
export default function GalleryCard({ gallery, number, eager = false, showCategory = false, lang = 'en' }: Props) {
  const { cover } = gallery;
  const meta = showCategory ? gallery.categoryLabel : gallery.meta;

  return (
    /* The whole card is one link: photo and title are both clickable */
    <a href={gallery.href} className="card">
      <div className="card-image">
        <img
          src={cover.src}
          srcSet={cover.srcSet}
          // Tells the browser how wide the image will be shown, so it can pick
          // the smallest file from srcSet that still looks sharp.
          // Cards: 3 per row up to about 470px wide, 2 per row on tablets, 1 on phones.
          sizes="(max-width: 560px) 92vw, (max-width: 900px) 46vw, 470px"
          width={cover.width}
          height={cover.height}
          alt={gallery.alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      </div>

      <div className="card-row">
        <div className="card-names">
          {/* `condition && <element>` renders the element only when the condition is true */}
          {gallery.couple && <span className="card-couple">{gallery.couple}</span>}
          <span className="card-title">{gallery.title}</span>
          {meta && <span className="card-meta">{meta}</span>}
        </div>
        {number && <span className="card-number">{number}</span>}
      </div>

      <span className="card-cta">{ui[lang].viewGallery}</span>
    </a>
  );
}

/**
 * ============================================================================
 * GALLERY CARD  (src/components/GalleryCard.tsx)  ·  React component
 * ============================================================================
 *
 * One card in a gallery grid: cover photo, couple names, title, "View Gallery".
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
import './GalleryCard.css';

/** The props this component accepts. TypeScript checks every place that uses it. */
interface Props {
  gallery: CardData;
  /** true = load the image immediately (use for the first cards on a page) */
  eager?: boolean;
  /** true = show the category name above the title (used on the overview page) */
  showCategory?: boolean;
}

// `{ gallery, eager = false, ... }` unpacks the props object and sets defaults.
export default function GalleryCard({ gallery, eager = false, showCategory = false }: Props) {
  const { cover } = gallery;

  return (
    <article className="card">
      {/* The whole card is one link: photo and title are both clickable */}
      <a href={gallery.href} className="card-link">
        <div className="card-image">
          <img
            src={cover.src}
            srcSet={cover.srcSet}
            // Tells the browser how wide the image will be shown, so it can pick
            // the smallest file from srcSet that still looks sharp.
            // Cards are at most 560px wide. Phones: 67vw caps high-density screens at ~2×.
            sizes="(max-width: 700px) 67vw, 560px"
            width={cover.width}
            height={cover.height}
            alt={gallery.alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
          />
        </div>
        <div className="card-body">
          {/* `condition && <element>` renders the element only when the condition is true */}
          {showCategory && <p className="card-category">{gallery.categoryLabel}</p>}
          {gallery.couple && <p className="card-couple">{gallery.couple}</p>}
          <h2 className="card-title">{gallery.title}</h2>
          <span className="card-cta">View Gallery</span>
        </div>
      </a>
    </article>
  );
}

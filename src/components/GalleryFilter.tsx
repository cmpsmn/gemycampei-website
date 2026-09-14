/**
 * ============================================================================
 * GALLERY FILTER  (src/components/GalleryFilter.tsx)  ·  React component
 * ============================================================================
 *
 * The overview page /galleries/ shows every gallery with filter buttons
 * (All · Weddings · Elopements · ...). Clicking a button shows only that type.
 *
 * REACT CONCEPTS USED HERE
 * - useState: a variable that React remembers between renders. Calling its
 *   setter (setActive) stores the new value AND re-renders the component,
 *   so the list updates automatically.
 * - .map(): turns an array of data into an array of elements.
 * - key: every element in a list needs a unique `key` so React can tell
 *   the items apart when the list changes.
 *
 * The page loads it with <GalleryFilter client:load ... />. `client:load`
 * tells Astro to send this component's JavaScript to the browser.
 * ============================================================================
 */
import { useState } from 'react';
import GalleryCard from './GalleryCard';
import type { CardData } from '../lib/galleries';
import './GalleryFilter.css';

interface Props {
  galleries: CardData[];
  categories: { id: string; label: string }[];
}

export default function GalleryFilter({ galleries, categories }: Props) {
  // `active` holds the selected category id, or 'all'. It starts as 'all'.
  const [active, setActive] = useState<string>('all');

  // Derived data: recalculated on every render from the current state.
  // A gallery can belong to several categories, so we check its whole list.
  const visible = active === 'all' ? galleries : galleries.filter((g) => g.categoryIds.includes(active));
  const options = [{ id: 'all', label: 'All' }, ...categories];

  return (
    <div>
      <div className="filter" role="group" aria-label="Filter galleries by type">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="filter-button"
            // aria-pressed tells screen readers which button is selected (also used for styling)
            aria-pressed={active === option.id}
            onClick={() => setActive(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="card-grid">
        {visible.map((gallery, index) => (
          <GalleryCard key={gallery.id} gallery={gallery} eager={index < 2} showCategory={active === 'all'} />
        ))}
      </div>

      {visible.length === 0 && <p className="center">New galleries coming soon.</p>}
    </div>
  );
}

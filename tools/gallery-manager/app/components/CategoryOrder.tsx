/**
 * ============================================================================
 * GALLERY ORDER PER CATEGORY  (app/components/CategoryOrder.tsx)
 * ============================================================================
 *
 * Pick a category and drag its galleries into the order they should appear on
 * that category page. Every category has its own order, so a gallery can be
 * first in "35mm & Super 8" and last in "Weddings". The order is saved
 * immediately into the category's _category.md (galleryOrder).
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import { api, photoUrl } from '../api';
import type { AppState, GallerySummary } from '../types';
import { useDragReorder } from '../hooks';
import type { Notify } from '../App';

interface Props {
  state: AppState;
  notify: Notify;
  onChanged: () => Promise<void>;
}

export default function CategoryOrder({ state, notify, onChanged }: Props) {
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id ?? '');
  const category = state.categories.find((c) => c.id === categoryId);

  /** Galleries of this category in the saved order; unlisted ones at the end */
  const sorted = (): GallerySummary[] => {
    if (!category) return [];
    const position = new Map(category.galleryOrder.map((id, index) => [id, index]));
    return state.galleries
      .filter((g) => g.categories.includes(category.id))
      .sort((a, b) => (position.get(a.id) ?? 1e9) - (position.get(b.id) ?? 1e9) || a.title.localeCompare(b.title));
  };

  const [items, setItems] = useState<GallerySummary[]>(sorted);
  // Show the new list when the category or the data changes
  useEffect(() => setItems(sorted()), [categoryId, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const { itemProps } = useDragReorder(items, (g) => g.id, async (next) => {
    setItems(next);
    try {
      await api.saveOrder(categoryId, next.map((g) => g.id));
      await onChanged();
      notify('Order saved.');
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  });

  return (
    <section className="page">
      <h2>Order of galleries on each category page</h2>
      <p className="muted">Drag the galleries into place. The first one appears top left on the website.</p>

      <div className="segmented">
        {state.categories.map((c) => (
          <button key={c.id} className={c.id === categoryId ? 'active' : ''} onClick={() => setCategoryId(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {category?.display !== 'cards' && (
        <p className="note">
          {category?.label} shows photos in a carousel. The order below applies to galleries shown there as cards (ticked via
          "Show in") and to the order of photos in the carousel.
        </p>
      )}

      {items.length === 0 ? (
        <p className="muted">No galleries in this category yet.</p>
      ) : (
        <ol className="order-list">
          {items.map((g, index) => (
            <li key={g.id} {...itemProps(g)} className="order-item">
              <span className="handle" aria-hidden="true">⋮⋮</span>
              <span className="order-number">{index + 1}</span>
              {g.coverPhoto && <img src={photoUrl(g.id, g.coverPhoto, 160, g.coverVersion)} alt="" />}
              <span className="order-text">
                {g.couple && <small>{g.couple}</small>}
                <strong>{g.title}</strong>
                <small>
                  {g.photoCount} {g.photoCount === 1 ? 'photo' : 'photos'} {g.category !== categoryId && `· main category: ${state.categories.find((c) => c.id === g.category)?.label}`}
                </small>
              </span>
              {g.draft && <em className="tag draft">Draft</em>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

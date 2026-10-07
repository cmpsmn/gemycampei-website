/**
 * ============================================================================
 * GALLERY LIST  (app/components/GalleryList.tsx)
 * ============================================================================
 *
 * The sidebar: all galleries grouped by their MAIN category, with cover
 * thumbnail, photo count and a "Draft" badge. A gallery that is also ticked
 * in other categories shows small tags for them.
 * ============================================================================
 */
import { useState } from 'react';
import { photoUrl } from '../api';
import type { AppState } from '../types';

interface Props {
  state: AppState;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function GalleryList({ state, selectedId, onSelect }: Props) {
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const labelOf = (id: string) => state.categories.find((c) => c.id === id)?.label ?? id;

  const visible = state.galleries.filter((g) => filter === 'all' || (filter === 'draft' ? g.draft : !g.draft));

  return (
    <aside className="sidebar">
      <div className="segmented" role="group" aria-label="Show">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button key={f} className={f === filter ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'published' ? 'Published' : 'Drafts'}
          </button>
        ))}
      </div>

      {state.categories.map((category) => {
        // Sidebar groups follow the order on the website
        const position = new Map(category.galleryOrder.map((id, index) => [id, index]));
        const galleries = visible
          .filter((g) => g.category === category.id)
          .sort((a, b) => (position.get(a.id) ?? 1e9) - (position.get(b.id) ?? 1e9) || a.title.localeCompare(b.title));
        return (
          <section key={category.id} className="group">
            <h2>
              {category.label} <span>{galleries.length}</span>
            </h2>
            {galleries.length === 0 && <p className="muted small">No galleries.</p>}
            <ul>
              {galleries.map((g) => (
                <li key={g.id}>
                  <button className={g.id === selectedId ? 'gallery-item selected' : 'gallery-item'} onClick={() => onSelect(g.id)}>
                    {g.coverPhoto ? (
                      <img src={photoUrl(g.id, g.coverPhoto, 160, g.coverVersion)} alt="" loading="lazy" />
                    ) : (
                      <span className="no-photo">no photos</span>
                    )}
                    <span className="gallery-item-text">
                      {g.couple && <small>{g.couple}</small>}
                      <strong>{g.title}</strong>
                      <small>
                        {g.videoCount && !g.photoCount ? `${g.videoCount} ${g.videoCount === 1 ? 'video' : 'videos'}` : `${g.photoCount} ${g.photoCount === 1 ? 'photo' : 'photos'}`}
                        {g.draft && <em className="tag draft">Draft</em>}
                        {g.categories.slice(1).map((c) => (
                          <em key={c} className="tag">
                            + {labelOf(c)}
                          </em>
                        ))}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </aside>
  );
}

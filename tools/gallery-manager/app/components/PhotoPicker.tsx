/**
 * ============================================================================
 * PHOTO PICKER  (app/components/PhotoPicker.tsx)
 * ============================================================================
 *
 * Choose a photo from any gallery, e.g. the cover of a journal article.
 * The result is "<category>/<gallery>/<file>", the format the website uses.
 * Hovering a photo shows its description, to help pick the right one.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import { api, photoUrl } from '../api';
import type { GalleryDetail, GallerySummary } from '../types';

interface Props {
  galleries: GallerySummary[];
  /** The current photo ("<category>/<gallery>/<file>"), opens its gallery */
  current?: string;
  onPick: (ref: string) => void;
  onClose: () => void;
}

export default function PhotoPicker({ galleries, current, onPick, onClose }: Props) {
  const withPhotos = galleries.filter((g) => g.photoCount > 0);
  const start = current ? current.split('/').slice(0, 2).join('/') : '';
  const [galleryId, setGalleryId] = useState(withPhotos.some((g) => g.id === start) ? start : (withPhotos[0]?.id ?? ''));
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);

  useEffect(() => {
    setGallery(null);
    if (galleryId) api.gallery(galleryId).then(setGallery).catch(() => setGallery(null));
  }, [galleryId]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog-wide card form" onClick={(e) => e.stopPropagation()}>
        <h2>Choose a photo</h2>
        <label>
          Gallery
          <select value={galleryId} onChange={(e) => setGalleryId(e.target.value)}>
            {withPhotos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.couple ? `${g.couple} · ` : ''}
                {g.title} ({g.photoCount})
              </option>
            ))}
          </select>
        </label>
        {gallery ? (
          <ul className="mini-grid picker-grid">
            {gallery.photos.map((p) => {
              const ref = `${gallery.id}/${p.name}`;
              return (
                <li key={p.name}>
                  <button className={ref === current ? 'selected' : ''} title={p.alt.en || p.name} onClick={() => onPick(ref)}>
                    <img src={photoUrl(gallery.id, p.name, 400, p.version)} alt={p.alt.en || p.name} loading="lazy" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">Loading photos …</p>
        )}
        <div className="actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

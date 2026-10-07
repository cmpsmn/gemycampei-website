/**
 * ============================================================================
 * PHOTO GRID  (app/components/PhotoGrid.tsx)
 * ============================================================================
 *
 * All photos of a gallery, in website order.
 *
 * - Drop photos from Explorer onto the grid (or use "Add photos") to upload.
 *   The server optimises them and skips exact duplicates.
 * - Drag a photo onto another position to reorder (saved immediately).
 * - Click photos to select them (Shift+click selects a range), then delete
 *   them or move them to another gallery.
 * - "★" makes a photo the cover (saved with the Save button, like all fields).
 * - With one photo selected, its description (alt text, English and German)
 *   can be edited below the toolbar. It is saved to photos.yaml right away.
 *   Photos without a description show a small "no text" mark.
 *
 * File operations are saved immediately; deleted photos can be restored from
 * the trash (or with Undo).
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, MouseEvent } from 'react';
import { api, photoUrl } from '../api';
import type { GallerySummary, Photo } from '../types';
import { useDragReorder } from '../hooks';
import type { Notify } from '../App';

interface Props {
  galleryId: string;
  photos: Photo[];
  /** the cover as currently shown (form value or default) */
  cover: string;
  galleries: GallerySummary[];
  onSetCover: (name: string) => void;
  /** reload the gallery; `renamed` maps old → new photo names after renumbering */
  onChanged: (renamed?: Record<string, string>) => Promise<void>;
  notify: Notify;
  /** German version switched on: show the German description too */
  german: boolean;
}

/** Photos smaller than this on the long side get a warning mark */
const MIN_LONG_EDGE = 1500;

const kb = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

export default function PhotoGrid({ galleryId, photos, cover, galleries, onSetCover, onChanged, notify, german }: Props) {
  // Local copy of the order, so a dragged photo jumps to its place immediately
  const [order, setOrder] = useState(photos);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<number | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');
  /** Description being edited for the single selected photo */
  const [altDraft, setAltDraft] = useState<{ name: string; en: string; de: string } | null>(null);
  const singleSelected = selected.size === 1 ? order.find((p) => selected.has(p.name)) : undefined;
  useEffect(() => {
    setAltDraft(singleSelected ? { name: singleSelected.name, ...singleSelected.alt } : null);
    // Only when the selected photo changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleSelected?.name, singleSelected?.alt.en, singleSelected?.alt.de]);

  async function saveAlt() {
    if (!altDraft) return;
    try {
      await api.savePhotoAlt(galleryId, altDraft.name, { en: altDraft.en, de: altDraft.de });
      notify('Description saved.');
      await onChanged();
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }
  const fileInput = useRef<HTMLInputElement>(null);

  // When the server sends new photos, show them and forget selections of removed photos
  useEffect(() => {
    setOrder(photos);
    setSelected((current) => new Set([...current].filter((name) => photos.some((p) => p.name === name))));
  }, [photos]);

  const { itemProps } = useDragReorder(order, (p) => p.name, async (next) => {
    setOrder(next);
    try {
      const { renamed } = await api.reorderPhotos(galleryId, next.map((p) => p.name));
      setSelected(new Set());
      await onChanged(renamed);
    } catch (error) {
      setOrder(photos);
      notify((error as Error).message, { level: 'error' });
    }
  });

  // ---- Selection -----------------------------------------------------------
  function toggle(event: MouseEvent, index: number) {
    const name = order[index].name;
    const next = new Set(selected);
    if (event.shiftKey && lastClicked !== null) {
      const [from, to] = [Math.min(lastClicked, index), Math.max(lastClicked, index)];
      order.slice(from, to + 1).forEach((p) => next.add(p.name));
    } else if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
    setLastClicked(index);
  }

  // ---- Upload --------------------------------------------------------------
  async function uploadFiles(files: File[]) {
    const images = files.filter((f) => /\.(jpe?g|png|webp|avif|tiff?|heic)$/i.test(f.name));
    if (images.length === 0) {
      notify('No photos found in what you dropped (JPG, PNG, WebP, AVIF, TIFF, HEIC).', { level: 'warning' });
      return;
    }
    let added = 0;
    const warnings: string[] = [];
    setUpload({ done: 0, total: images.length });
    // One after another: gentle on the computer and shows real progress
    for (const [index, file] of images.entries()) {
      try {
        const result = await api.uploadPhoto(galleryId, file);
        if (result.name) added++;
        warnings.push(...result.warnings);
      } catch (error) {
        warnings.push((error as Error).message);
      }
      setUpload({ done: index + 1, total: images.length });
    }
    setUpload(null);
    await onChanged();
    notify(`${added} photo${added === 1 ? '' : 's'} added.`);
    warnings.slice(0, 3).forEach((w) => notify(w, { level: 'warning' }));
    if (warnings.length > 3) notify(`… and ${warnings.length - 3} more notes.`, { level: 'warning' });
  }

  function onDragOver(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return; // a photo is being reordered
    event.preventDefault();
    setDropActive(true);
  }

  function onDrop(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDropActive(false);
    uploadFiles([...event.dataTransfer.files]);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    uploadFiles([...(event.target.files ?? [])]);
    event.target.value = ''; // allows picking the same files again
  }

  // ---- Bulk actions --------------------------------------------------------
  const names = [...selected];

  async function deleteSelected() {
    if (!window.confirm(`Move ${names.length} photo${names.length > 1 ? 's' : ''} to the trash?`)) return;
    try {
      const { trashEntry } = await api.deletePhotos(galleryId, names);
      setSelected(new Set());
      await onChanged();
      notify(`${names.length} photo${names.length > 1 ? 's' : ''} moved to the trash.`, { undo: trashEntry });
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  async function moveSelected() {
    if (!moveTarget) return;
    try {
      await api.movePhotos(galleryId, names, moveTarget);
      setSelected(new Set());
      await onChanged();
      const target = galleries.find((g) => g.id === moveTarget)?.title ?? moveTarget;
      notify(`${names.length} photo${names.length > 1 ? 's' : ''} moved to "${target}".`);
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  return (
    <div
      className={dropActive ? 'photo-area drop-active' : 'photo-area'}
      onDragOver={onDragOver}
      onDragLeave={() => setDropActive(false)}
      onDrop={onDrop}
    >
      <div className="photo-toolbar">
        <button onClick={() => fileInput.current?.click()} disabled={!!upload}>
          + Add photos
        </button>
        <input ref={fileInput} type="file" accept="image/*,.heic" multiple hidden onChange={onPick} />
        {upload && (
          <span className="progress">
            Uploading {upload.done} / {upload.total}
            <progress value={upload.done} max={upload.total} />
          </span>
        )}
        <span className="spacer" />
        {selected.size > 0 ? (
          <>
            <strong>{selected.size} selected</strong>
            <button className="link" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <select value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} aria-label="Move to gallery">
              <option value="">Move to …</option>
              {galleries
                .filter((g) => g.id !== galleryId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title} ({g.category})
                  </option>
                ))}
            </select>
            <button onClick={moveSelected} disabled={!moveTarget}>
              Move
            </button>
            <button className="danger" onClick={deleteSelected}>
              Delete
            </button>
          </>
        ) : (
          order.length > 0 && (
            <button className="link" onClick={() => setSelected(new Set(order.map((p) => p.name)))}>
              Select all
            </button>
          )
        )}
      </div>

      {altDraft && (
        <div className="alt-editor form">
          <strong>Description of {altDraft.name}</strong>
          <p className="muted small">
            What is in the photo, in a short natural sentence, e.g. "Bride and groom on a rowing boat at Lago di Braies at
            dawn". Used by Google Images and screen readers.
          </p>
          <label>
            English
            <input value={altDraft.en} maxLength={300} onChange={(e) => setAltDraft({ ...altDraft, en: e.target.value })} />
          </label>
          {german && (
            <label>
              Deutsch
              <input value={altDraft.de} maxLength={300} onChange={(e) => setAltDraft({ ...altDraft, de: e.target.value })} />
            </label>
          )}
          <div>
            <button onClick={saveAlt}>Save description</button>
          </div>
        </div>
      )}

      {order.length === 0 ? (
        <div className="drop-hint" onClick={() => fileInput.current?.click()}>
          <strong>Drop photos here</strong>
          <span>or click to choose files. They are resized to 2400 px and stripped of GPS data automatically.</span>
        </div>
      ) : (
        <>
          <p className="muted small">Drag photos to change the order. Click to select, Shift+click to select a range. Drop new photos anywhere here.</p>
          <ul className="photo-grid">
            {order.map((photo, index) => {
              const isCover = photo.name === cover;
              const small = Math.max(photo.width, photo.height) < MIN_LONG_EDGE;
              return (
                <li
                  key={photo.name}
                  {...itemProps(photo)}
                  className={selected.has(photo.name) ? 'photo selected' : 'photo'}
                  onClick={(event) => toggle(event, index)}
                  title={`${photo.name} · ${photo.width}×${photo.height} · ${kb(photo.size)}`}
                >
                  <img src={photoUrl(galleryId, photo.name, 400, photo.version)} alt={photo.name} loading="lazy" draggable={false} />
                  <span className="photo-number">{index + 1}</span>
                  <button
                    className={isCover ? 'cover-star active' : 'cover-star'}
                    title={isCover ? 'Cover photo' : 'Make this the cover'}
                    onClick={(event) => {
                      event.stopPropagation(); // don't toggle the selection
                      onSetCover(photo.name);
                    }}
                  >
                    ★
                  </button>
                  {small && (
                    <span className="photo-warning" title={`Only ${Math.max(photo.width, photo.height)} px: may look soft`}>
                      !
                    </span>
                  )}
                  {selected.has(photo.name) && <span className="photo-check">✓</span>}
                  {!photo.alt.en && (
                    <span className="photo-noalt" title="No description yet: select the photo to add one">
                      no text
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

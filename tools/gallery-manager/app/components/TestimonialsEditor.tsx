/**
 * ============================================================================
 * TESTIMONIALS  (app/components/TestimonialsEditor.tsx)
 * ============================================================================
 *
 * Left: all reviews, drag to change their order on the testimonials page.
 * Right: the selected review:
 *   names · text · linked gallery ("View their gallery" + review on that page)
 *   · photo: pick one from the linked gallery, or upload an own photo
 *
 * Text and link are saved with "Save changes". Uploading an own photo and
 * reordering are saved immediately.
 * ============================================================================
 */
import { useEffect, useRef, useState } from 'react';
import { api, fileUrl, photoUrl } from '../api';
import type { AppState, GalleryDetail, Testimonial } from '../types';
import { useDragReorder } from '../hooks';
import type { Notify } from '../App';

interface Props {
  state: AppState;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
}

type Draft = Pick<Testimonial, 'names' | 'text' | 'gallery' | 'galleryPhoto'>;
const toDraft = (t: Testimonial): Draft => ({ names: t.names, text: t.text, gallery: t.gallery, galleryPhoto: t.galleryPhoto });

export default function TestimonialsEditor({ state, notify, onDirtyChange }: Props) {
  const [list, setList] = useState<Testimonial[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [linkedGallery, setLinkedGallery] = useState<GalleryDetail | null>(null);
  const [newNames, setNewNames] = useState('');
  /** Increases after each upload, so the browser shows the new photo instead of a cached one */
  const [imageVersion, setImageVersion] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = list.find((t) => t.id === selectedId) ?? null;
  const dirty = !!selected && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(selected));

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]); // leaving the tab

  async function load(select?: string) {
    try {
      const reviews = await api.testimonials();
      setList(reviews);
      const id = select ?? selectedId ?? reviews[0]?.id ?? null;
      setSelectedId(id);
      const review = reviews.find((r) => r.id === id);
      setDraft(review ? toDraft(review) : null);
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the photos of the linked gallery for the photo picker
  useEffect(() => {
    if (!draft?.gallery) {
      setLinkedGallery(null);
      return;
    }
    api.gallery(draft.gallery).then(setLinkedGallery).catch(() => setLinkedGallery(null));
  }, [draft?.gallery]);

  function select(id: string) {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    const review = list.find((r) => r.id === id);
    setSelectedId(id);
    setDraft(review ? toDraft(review) : null);
  }

  const { itemProps } = useDragReorder(list, (t) => t.id, async (next) => {
    setList(next);
    try {
      await api.reorderTestimonials(next.map((t) => t.id));
      notify('Order saved.');
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  });

  async function create() {
    if (!newNames.trim()) return;
    try {
      const { id } = await api.createTestimonial(newNames);
      setNewNames('');
      await load(id);
      notify('Review created. Add the text and choose a photo.');
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  async function save() {
    if (!selected || !draft) return;
    try {
      const saved = await api.saveTestimonial(selected.id, draft);
      await load(saved.id);
      notify('Saved.');
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  async function uploadImage(file: File | undefined) {
    if (!selected || !file) return;
    try {
      await api.uploadTestimonialImage(selected.id, file);
      setImageVersion((v) => v + 1);
      await load(selected.id);
      notify('Photo uploaded.');
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  async function remove() {
    if (!selected || !window.confirm(`Move the review of ${selected.names} to the trash?`)) return;
    try {
      const { trashEntry } = await api.deleteTestimonial(selected.id);
      setSelectedId(null);
      await load('');
      notify(`Review of ${selected.names} moved to the trash.`, { undo: trashEntry });
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  // Which photo the website will show: gallery photo first, then the own photo
  const shownPhoto =
    draft?.gallery && draft.galleryPhoto && linkedGallery
      ? photoUrl(linkedGallery.id, draft.galleryPhoto, 800, linkedGallery.photos.find((p) => p.name === draft.galleryPhoto)?.version)
      : selected?.image
        ? fileUrl(selected.image, 800, imageVersion)
        : null;

  return (
    <div className="split">
      <aside className="sidebar">
        <form
          className="new-review"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input value={newNames} onChange={(e) => setNewNames(e.target.value)} placeholder="Names, e.g. Anna & Max" />
          <button className="primary" disabled={!newNames.trim()}>
            + Add
          </button>
        </form>
        <p className="muted small">Drag to change the order on the testimonials page.</p>
        <ol className="order-list compact">
          {list.map((t) => (
            <li key={t.id} {...itemProps(t)} className={t.id === selectedId ? 'order-item selected' : 'order-item'} onClick={() => select(t.id)}>
              <span className="handle" aria-hidden="true">⋮⋮</span>
              <span className="order-text">
                <strong>{t.names}</strong>
                <small>{t.gallery ? `Linked: ${t.gallery.split('/')[1]}` : 'No gallery linked'}</small>
              </span>
            </li>
          ))}
        </ol>
      </aside>

      {selected && draft ? (
        <section className="editor">
          <div className="editor-head">
            <h2>Review of {selected.names}</h2>
            <div className="actions">
              <button className="danger-outline" onClick={remove}>
                Delete review
              </button>
              <button className="primary" onClick={save} disabled={!dirty}>
                {dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </div>

          <div className="editor-grid">
            <div className="col-main card form">
              <label>
                Names
                <input value={draft.names} onChange={(e) => setDraft({ ...draft, names: e.target.value })} />
              </label>
              <label>
                Review text
                <textarea rows={12} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
              </label>
              <label>
                Their gallery
                <select value={draft.gallery} onChange={(e) => setDraft({ ...draft, gallery: e.target.value, galleryPhoto: '' })}>
                  <option value="">No gallery</option>
                  {state.galleries.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.couple ? `${g.couple} · ` : ''}
                      {g.title} ({state.categories.find((c) => c.id === g.category)?.label})
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted small">
                A linked review gets a "View their gallery" link and is also shown on that gallery page.
              </p>
            </div>

            <div className="col-side card">
              <h3>Photo</h3>
              {shownPhoto ? <img className="review-preview" src={shownPhoto} alt="" /> : <p className="note">No photo chosen yet.</p>}

              {linkedGallery && linkedGallery.photos.length > 0 && (
                <>
                  <p className="small">Pick a photo from their gallery:</p>
                  <ul className="mini-grid">
                    {linkedGallery.photos.map((p) => (
                      <li key={p.name}>
                        <button
                          className={p.name === draft.galleryPhoto ? 'selected' : ''}
                          onClick={() => setDraft({ ...draft, galleryPhoto: p.name === draft.galleryPhoto ? '' : p.name })}
                          title={p.name}
                        >
                          <img src={photoUrl(linkedGallery.id, p.name, 160, p.version)} alt={p.name} loading="lazy" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <p className="small">{linkedGallery ? 'Or upload an own photo:' : 'Upload a photo:'}</p>
              <button onClick={() => fileInput.current?.click()}>Upload photo …</button>
              <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => uploadImage(e.target.files?.[0])} />
              <p className="muted small">Landscape photos fit the frame best.</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="empty">Add a review on the left or select one.</div>
      )}
    </div>
  );
}

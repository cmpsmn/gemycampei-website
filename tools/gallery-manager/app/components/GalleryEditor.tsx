/**
 * ============================================================================
 * GALLERY EDITOR  (app/components/GalleryEditor.tsx)
 * ============================================================================
 *
 * Everything about one gallery:
 *   photos (upload, order, select, delete, move) · cover + focus point
 *   · published/draft · categories + main category · title, couple, place ...
 *   · story text · Google title/description · folder name and old addresses
 *
 * HOW SAVING WORKS
 * - Photo operations are written to disk immediately.
 * - All text fields, the cover and the categories are kept in `form` until
 *   you click "Save changes" (or press Ctrl+S). `dirty` compares the form with
 *   the last saved version, so the app can warn about unsaved changes.
 * ============================================================================
 */
import { useCallback, useEffect, useState } from 'react';
import { api, photoUrl, slugify } from '../api';
import type { AppState, GalleryDetail, GalleryFields, GalleryForm } from '../types';
import type { Notify } from '../App';
import PhotoGrid from './PhotoGrid';
import FocusPicker from './FocusPicker';

interface Props {
  id: string;
  state: AppState;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
  /** refresh the sidebar */
  onChanged: () => Promise<void>;
  /** the gallery got a new id (moved to another main category or renamed) */
  onIdChanged: (id: string) => void;
  onDeleted: (trashEntry: string, label: string) => void;
}

/** Kinds of shoots offered as suggestions (any text is allowed) */
const TYPE_SUGGESTIONS = ['Wedding', 'Elopement', 'Couple Session', 'Proposal', 'Pre Wedding', 'Honeymoon', 'Maternity Session', 'Film Photography'];
const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 155;

/** The editable part of a gallery, as a fresh copy */
const toForm = (d: GalleryDetail): GalleryForm => ({
  fields: { ...d.fields, legacyUrls: [...d.fields.legacyUrls] },
  story: d.story,
  categories: [...d.categories],
  mainCategory: d.category,
  slug: d.slug,
});

export default function GalleryEditor({ id, state, notify, onDirtyChange, onChanged, onIdChanged, onDeleted }: Props) {
  const [detail, setDetail] = useState<GalleryDetail | null>(null);
  const [form, setForm] = useState<GalleryForm | null>(null);
  /** JSON of the last saved form, to detect unsaved changes */
  const [savedJson, setSavedJson] = useState('');
  const [saving, setSaving] = useState(false);

  const dirty = form !== null && JSON.stringify(form) !== savedJson;

  const load = useCallback(async () => {
    try {
      const d = await api.gallery(id);
      const f = toForm(d);
      setDetail(d);
      setForm(f);
      setSavedJson(JSON.stringify(f));
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }, [id, notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  /**
   * After photo operations: take the new photos from the server but keep
   * unsaved text edits. Photo renames (reordering) are applied to the cover.
   */
  async function reloadPhotos(renamed: Record<string, string> = {}) {
    try {
      const d = await api.gallery(id);
      setDetail(d);
      const exists = (name: string) => d.photos.some((p) => p.name === name);
      setForm((prev) => {
        if (!prev) return toForm(d);
        const mapped = prev.fields.cover ? (renamed[prev.fields.cover] ?? prev.fields.cover) : '';
        return { ...prev, fields: { ...prev.fields, cover: exists(mapped) ? mapped : d.fields.cover } };
      });
      // The saved version on disk may also have a renamed cover now
      setSavedJson((json) => {
        const saved = JSON.parse(json) as GalleryForm;
        saved.fields.cover = d.fields.cover;
        return JSON.stringify(saved);
      });
      await onChanged();
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  const update = (patch: Partial<GalleryFields>) => setForm((f) => (f ? { ...f, fields: { ...f.fields, ...patch } } : f));

  async function save() {
    if (!form || saving) return;
    setSaving(true);
    try {
      const d = await api.saveGallery(id, form);
      notify('Saved.');
      if (d.id !== id) {
        await onChanged();
        onIdChanged(d.id); // App opens the gallery under its new id
        return;
      }
      const f = toForm(d);
      setDetail(d);
      setForm(f);
      setSavedJson(JSON.stringify(f));
      await onChanged();
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S / Cmd+S saves
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!detail || !form) return <div className="editor loading">Loading …</div>;

  const categoryById = new Map(state.categories.map((c) => [c.id, c]));
  const hasPage = form.categories.some((c) => categoryById.get(c)?.display === 'cards');
  const pageUrl = hasPage ? `/${form.mainCategory}/${form.slug}/` : `/${form.mainCategory}/`;
  const coverName = form.fields.cover || detail.coverPhoto;
  const coverPhoto = detail.photos.find((p) => p.name === coverName);

  async function preview() {
    if (dirty) notify('Showing the last saved version. Save to see your latest changes.', { level: 'warning' });
    // Open the tab right away (browsers block pop-ups opened later), then load the page
    const tab = window.open('', '_blank');
    if (tab) tab.document.body.textContent = 'Starting the preview … the first time can take a few seconds.';
    try {
      const { url } = await api.preview(hasPage ? detail!.url : `/${detail!.category}/`);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
    } catch (error) {
      tab?.close();
      notify((error as Error).message, { level: 'error' });
    }
  }

  async function remove() {
    const label = `Gallery "${detail!.displayTitle}"`;
    if (!window.confirm(`Move ${label} with ${detail!.photos.length} photos to the trash?`)) return;
    try {
      const { trashEntry } = await api.deleteGallery(id);
      onDeleted(trashEntry, label);
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  function toggleCategory(categoryId: string, checked: boolean) {
    setForm((f) => {
      if (!f) return f;
      const categories = checked ? [...f.categories, categoryId] : f.categories.filter((c) => c !== categoryId);
      const mainCategory = categories.includes(f.mainCategory) ? f.mainCategory : (categories[0] ?? '');
      return { ...f, categories, mainCategory };
    });
  }

  return (
    <section className="editor">
      {/* ---- Header with actions ---- */}
      <div className="editor-head">
        <div>
          <p className="muted small">gemycampei.com{pageUrl}</p>
          <h2>
            {form.fields.couple && <small>{form.fields.couple}</small>}
            {form.fields.title || detail.displayTitle}
          </h2>
        </div>
        <div className="actions">
          <button onClick={preview}>Preview</button>
          <button className="danger-outline" onClick={remove}>
            Delete gallery
          </button>
          <button className="primary" onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving …' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* ---- Quality & SEO hints ---- */}
      {detail.checks.length > 0 && (
        <ul className="checks">
          {detail.checks.map((check) => (
            <li key={check.message} className={check.level}>
              {check.message}
            </li>
          ))}
        </ul>
      )}

      <div className="editor-grid">
        <div className="col-main">
          <div className="card">
            <h3>Photos ({detail.photos.length})</h3>
            <PhotoGrid
              galleryId={id}
              photos={detail.photos}
              cover={coverName}
              galleries={state.galleries}
              onSetCover={(name) => update({ cover: name })}
              onChanged={reloadPhotos}
              notify={notify}
            />
          </div>

          <div className="card">
            <h3>Story</h3>
            <p className="muted small">
              80–200 words about the place, the mood and what made the day special. Mention the location by name. Use **bold** and *italic*.
            </p>
            <textarea rows={9} value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} />
          </div>
        </div>

        <div className="col-side">
          <div className="card">
            <h3>Publishing</h3>
            <label className="switch">
              <input type="checkbox" checked={!form.fields.draft} onChange={(e) => update({ draft: !e.target.checked })} />
              <span>{form.fields.draft ? 'Draft: hidden on the website' : 'Published on the website'}</span>
            </label>
          </div>

          <div className="card">
            <h3>Categories</h3>
            <p className="muted small">Tick every category this gallery fits. The main category decides the address.</p>
            <table className="category-table">
              <thead>
                <tr>
                  <th>Show in</th>
                  <th>Main</th>
                </tr>
              </thead>
              <tbody>
                {state.categories.map((c) => {
                  const ticked = form.categories.includes(c.id);
                  return (
                    <tr key={c.id}>
                      <td>
                        <label>
                          <input type="checkbox" checked={ticked} onChange={(e) => toggleCategory(c.id, e.target.checked)} /> {c.label}
                          {c.display !== 'cards' && <small className="muted"> (carousel)</small>}
                        </label>
                      </td>
                      <td>
                        <input
                          type="radio"
                          name="main-category"
                          aria-label={`${c.label} as main category`}
                          disabled={!ticked}
                          checked={form.mainCategory === c.id}
                          onChange={() => setForm({ ...form, mainCategory: c.id })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Cover</h3>
            <p className="muted small">Choose the cover with ★ on a photo, then click the most important spot.</p>
            <FocusPicker
              src={coverPhoto ? photoUrl(id, coverPhoto.name, 800, coverPhoto.version) : null}
              width={coverPhoto?.width ?? 1}
              height={coverPhoto?.height ?? 1}
              focus={form.fields.coverFocus}
              onChange={(coverFocus) => update({ coverFocus })}
            />
          </div>

          <div className="card form">
            <h3>Details</h3>
            <label>
              Title <small className="muted">(venue or place)</small>
              <input value={form.fields.title} onChange={(e) => update({ title: e.target.value })} placeholder={detail.displayTitle} />
            </label>
            <label>
              Couple
              <input value={form.fields.couple} onChange={(e) => update({ couple: e.target.value })} placeholder="S & J" />
            </label>
            <label>
              Kind of shoot
              <input
                list="type-suggestions"
                value={form.fields.type}
                onChange={(e) => update({ type: e.target.value })}
                placeholder={categoryById.get(form.mainCategory)?.singular}
              />
              <datalist id="type-suggestions">
                {TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
            <label>
              Location
              <input value={form.fields.location} onChange={(e) => update({ location: e.target.value })} placeholder="Lago di Braies, Dolomites, Italy" />
            </label>
            <div className="row">
              <label>
                Region
                <select value={form.fields.region} onChange={(e) => update({ region: e.target.value })}>
                  <option value="">From category ({categoryById.get(form.mainCategory)?.region})</option>
                  <option value="vienna">Vienna</option>
                  <option value="dolomites">Dolomites</option>
                  <option value="austria">Austria</option>
                  <option value="destination">Destination</option>
                </select>
              </label>
              <label>
                Date
                <input type="date" value={form.fields.date} onChange={(e) => update({ date: e.target.value })} />
              </label>
            </div>
          </div>

          <div className="card form">
            <h3>Google (SEO)</h3>
            <label>
              <span className="label-row">
                Title in Google
                <Counter value={form.fields.seoTitle} max={SEO_TITLE_MAX} />
              </span>
              <input value={form.fields.seoTitle} onChange={(e) => update({ seoTitle: e.target.value })} placeholder="Automatic from couple, title and place" />
            </label>
            <label>
              <span className="label-row">
                Description in Google
                <Counter value={form.fields.seoDescription} max={SEO_DESCRIPTION_MAX} />
              </span>
              <textarea
                rows={3}
                value={form.fields.seoDescription}
                onChange={(e) => update({ seoDescription: e.target.value })}
                placeholder="Automatic from the kind of shoot and place"
              />
            </label>
          </div>

          <div className="card form">
            <h3>Address</h3>
            <label>
              Folder name
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
            </label>
            {form.fields.title && (
              <button className="link small" onClick={() => setForm({ ...form, slug: slugify([form.fields.title, form.fields.type, form.fields.couple].filter(Boolean).join(' ')) })}>
                Suggest from title
              </button>
            )}
            {(form.slug !== detail.slug || form.mainCategory !== detail.category) && (
              <p className="note small">
                The folder moves to galleries/{form.mainCategory}/{form.slug}/ when you save.
                {!detail.fields.draft && ' The old address is redirected automatically.'}
              </p>
            )}
            <label>
              Old addresses <small className="muted">(one per line, redirected here)</small>
              <textarea
                rows={2}
                value={form.fields.legacyUrls.join('\n')}
                onChange={(e) => update({ legacyUrls: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                placeholder="/PalaisDaunKinsky/"
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "42 / 60" character counter, red when too long */
function Counter({ value, max }: { value: string; max: number }) {
  return <small className={value.length > max ? 'counter over' : 'counter'}>{value.length} / {max}</small>;
}

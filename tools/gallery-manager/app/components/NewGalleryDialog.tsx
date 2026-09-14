/**
 * ============================================================================
 * NEW GALLERY DIALOG  (app/components/NewGalleryDialog.tsx)
 * ============================================================================
 *
 * Asks for the few things needed to create the folder. The folder name (and
 * the web address) is built from title, kind of shoot, place and couple, and
 * shown while typing. Everything can be changed later in the editor.
 * New galleries start as drafts, so nothing half-finished goes live.
 * ============================================================================
 */
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { api, slugify } from '../api';
import type { Category } from '../types';
import type { Notify } from '../App';

interface Props {
  categories: Category[];
  onClose: () => void;
  onCreated: (id: string) => void;
  notify: Notify;
}

export default function NewGalleryDialog({ categories, onClose, onCreated, notify }: Props) {
  const [category, setCategory] = useState(categories[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [couple, setCouple] = useState('');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);

  const slug = slugify([title, type, place, couple].filter(Boolean).join(' '));

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const { id } = await api.createGallery({ category, title, type, couple, place });
      onCreated(id);
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      {/* stopPropagation: clicks inside the dialog don't close it */}
      <form className="dialog card form" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2>New gallery</h2>
        <label>
          Main category
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title <small className="muted">(venue or place, e.g. "Seceda")</small>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="row">
          <label>
            Kind of shoot
            <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Elopement" />
          </label>
          <label>
            Couple
            <input value={couple} onChange={(e) => setCouple(e.target.value)} placeholder="A & B" />
          </label>
        </div>
        <label>
          Place <small className="muted">(added to the address, e.g. "Dolomites")</small>
          <input value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
        <p className="muted small">Address: gemycampei.com/{category}/{slug || '…'}/</p>
        <div className="actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!title.trim() || busy}>
            {busy ? 'Creating …' : 'Create gallery'}
          </button>
        </div>
      </form>
    </div>
  );
}

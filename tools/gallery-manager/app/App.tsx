/**
 * ============================================================================
 * APP  (tools/gallery-manager/app/App.tsx)
 * ============================================================================
 *
 * The frame of the manager:
 *
 *   ┌ Gallery Manager ─ [Galleries] [Categories] [Packages] [Journal] [Testimonials] [Pages]
 *   │                   [Settings] [Order] [Trash] [Changes] ─ [+ New gallery] ┐
 *   │ sidebar list │ editor of the selected gallery                                           │
 *   └────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * It keeps the shared state (categories, gallery list, selected gallery),
 * shows short notifications ("toasts") with an Undo button after deleting,
 * and asks before leaving a form with unsaved changes.
 * ============================================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import type { AppState } from './types';
import { useUnsavedGuard } from './hooks';
import GalleryList from './components/GalleryList';
import GalleryEditor from './components/GalleryEditor';
import CategoryOrder from './components/CategoryOrder';
import TestimonialsEditor from './components/TestimonialsEditor';
import TrashView from './components/TrashView';
import ChangesPanel from './components/ChangesPanel';
import NewGalleryDialog from './components/NewGalleryDialog';
import DocumentEditor from './components/DocumentEditor';
import type { DocKind } from './schemas';

type Tab = 'galleries' | DocKind | 'order' | 'testimonials' | 'trash' | 'changes';

/** Tabs that use the shared DocumentEditor */
const DOCUMENT_TABS: DocKind[] = ['category', 'packages', 'journal', 'page', 'settings'];

export interface Toast {
  id: number;
  message: string;
  level: 'success' | 'error' | 'warning';
  /** trash entry id: shows an "Undo" button */
  undo?: string;
}

/** Signature of the notify() function passed to all components */
export type Notify = (message: string, options?: { level?: Toast['level']; undo?: string }) => void;

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>('galleries');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(1);

  useUnsavedGuard(dirty);

  const notify: Notify = useCallback((message, { level = 'success', undo } = {}) => {
    const id = nextToastId.current++;
    setToasts((list) => [...list, { id, message, level, undo }]);
    // Messages disappear by themselves; errors and undo offers stay a bit longer
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), level === 'success' && !undo ? 4000 : 10000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await api.state());
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }, [notify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Select the first gallery once the list is loaded
  useEffect(() => {
    if (state && !selectedId && state.galleries.length) setSelectedId(state.galleries[0].id);
  }, [state, selectedId]);

  /** Returns false if the user wants to stay because of unsaved changes */
  function confirmLeave() {
    if (!dirty) return true;
    if (!window.confirm('You have unsaved changes. Leave without saving?')) return false;
    setDirty(false);
    return true;
  }

  function switchTab(next: Tab) {
    if (next !== tab && confirmLeave()) setTab(next);
  }

  function selectGallery(id: string) {
    if (id !== selectedId && confirmLeave()) setSelectedId(id);
  }

  async function undo(toast: Toast) {
    if (!toast.undo) return;
    try {
      const result = await api.restore(toast.undo);
      setToasts((list) => list.filter((t) => t.id !== toast.id));
      await refresh();
      if (result.galleryId) setSelectedId(result.galleryId);
      notify('Restored.');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : String(error), { level: 'error' });
    }
  }

  if (!state) return <div className="loading">Loading galleries …</div>;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'galleries', label: 'Galleries', badge: state.galleries.length },
    { id: 'category', label: 'Categories' },
    { id: 'packages', label: 'Packages' },
    { id: 'journal', label: 'Journal' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'page', label: 'Pages' },
    { id: 'settings', label: 'Settings' },
    { id: 'order', label: 'Order on pages' },
    { id: 'trash', label: 'Trash', badge: state.trashCount || undefined },
    { id: 'changes', label: 'Changes' },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          Gallery Manager <span>Gemy Campei</span>
        </h1>
        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t.id} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => switchTab(t.id)}>
              {t.label}
              {t.badge !== undefined && <span className="badge">{t.badge}</span>}
            </button>
          ))}
        </nav>
        <button className="primary" onClick={() => confirmLeave() && setCreating(true)}>
          + New gallery
        </button>
      </header>

      <main className="content">
        {tab === 'galleries' && (
          <div className="split">
            <GalleryList state={state} selectedId={selectedId} onSelect={selectGallery} />
            {selectedId && state.galleries.some((g) => g.id === selectedId) ? (
              <GalleryEditor
                key={selectedId} // a new editor (fresh form) for every gallery
                id={selectedId}
                state={state}
                notify={notify}
                onDirtyChange={setDirty}
                onChanged={refresh}
                onIdChanged={(id) => {
                  setDirty(false);
                  setSelectedId(id);
                }}
                onDeleted={async (trashEntry, label) => {
                  setDirty(false);
                  setSelectedId(null);
                  await refresh();
                  notify(`${label} moved to the trash.`, { undo: trashEntry });
                }}
              />
            ) : (
              <div className="empty">Select a gallery on the left or create a new one.</div>
            )}
          </div>
        )}
        {DOCUMENT_TABS.map(
          (kind) =>
            tab === kind && (
              <DocumentEditor key={kind} kind={kind} state={state} notify={notify} onDirtyChange={setDirty} onChanged={refresh} />
            ),
        )}
        {tab === 'order' && <CategoryOrder state={state} notify={notify} onChanged={refresh} />}
        {tab === 'testimonials' && <TestimonialsEditor state={state} notify={notify} onDirtyChange={setDirty} />}
        {tab === 'trash' && <TrashView notify={notify} onChanged={refresh} />}
        {tab === 'changes' && <ChangesPanel />}
      </main>

      {creating && (
        <NewGalleryDialog
          categories={state.categories}
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false);
            await refresh();
            setTab('galleries');
            setSelectedId(id);
            notify('Gallery created. Drop photos into it to get started.');
          }}
          notify={notify}
        />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.level}`}>
            <span>{t.message}</span>
            {t.undo && (
              <button className="link" onClick={() => undo(t)}>
                Undo
              </button>
            )}
            <button className="close" aria-label="Close" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

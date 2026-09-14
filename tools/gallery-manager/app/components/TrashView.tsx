/**
 * ============================================================================
 * TRASH  (app/components/TrashView.tsx)
 * ============================================================================
 *
 * Everything deleted in the manager waits here (in the project's .trash/
 * folder, which is never uploaded). Restore puts it back exactly where it was,
 * "Delete forever" removes it from the computer.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TrashEntry } from '../types';
import type { Notify } from '../App';

interface Props {
  notify: Notify;
  onChanged: () => Promise<void>;
}

const KIND_LABEL: Record<TrashEntry['kind'], string> = { gallery: 'Gallery', photos: 'Photos', testimonial: 'Review' };

export default function TrashView({ notify, onChanged }: Props) {
  const [entries, setEntries] = useState<TrashEntry[] | null>(null);

  async function load() {
    try {
      setEntries(await api.trash());
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs an action, then reloads the trash and the gallery list */
  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await load();
      await onChanged();
      notify(message);
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  if (!entries) return <div className="page">Loading …</div>;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Trash</h2>
          <p className="muted">Deleted galleries, photos and reviews. Nothing here is on the website.</p>
        </div>
        {entries.length > 0 && (
          <button
            className="danger"
            onClick={() => window.confirm('Delete everything in the trash forever? This cannot be undone.') && run(() => api.emptyTrash(), 'Trash emptied.')}
          >
            Empty trash
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="empty">The trash is empty.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>What</th>
              <th>Deleted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <em className="tag">{KIND_LABEL[entry.kind]}</em> {entry.label}
                </td>
                <td className="muted">{new Date(entry.createdAt).toLocaleString()}</td>
                <td className="actions">
                  <button onClick={() => run(() => api.restore(entry.id), `Restored: ${entry.label}`)}>Restore</button>
                  <button
                    className="danger-outline"
                    onClick={() => window.confirm(`Delete "${entry.label}" forever?`) && run(() => api.deleteTrashEntry(entry.id), 'Deleted forever.')}
                  >
                    Delete forever
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

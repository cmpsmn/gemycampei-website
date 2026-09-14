/**
 * ============================================================================
 * CHANGE LIST  (app/components/ChangesPanel.tsx)
 * ============================================================================
 *
 * Shows which galleries, photos, category orders and reviews changed since the
 * last Git commit, plus the three commands to publish them. The manager never
 * publishes by itself.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Changes } from '../types';

const STATUS_LABEL: Record<string, string> = { added: 'added', modified: 'changed', deleted: 'removed', renamed: 'renamed' };

export default function ChangesPanel() {
  const [changes, setChanges] = useState<Changes | null>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setChanges(await api.changes());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <section className="page"><p className="note error">{error}</p></section>;
  if (!changes) return <section className="page">Loading …</section>;

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Changes to publish</h2>
          <p className="muted">
            {changes.lastCommit ? `Since your last commit “${changes.lastCommit.subject}” (${changes.lastCommit.when}).` : 'Since the last commit.'}
          </p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {!changes.available ? (
        <p className="note">This project is not a Git repository yet. See docs/DEPLOYMENT.md to set it up.</p>
      ) : changes.total === 0 ? (
        <p className="empty">Nothing changed. Everything is committed.</p>
      ) : (
        <>
          <ul className="changes">
            {changes.groups.map((group) => {
              // Count files per status, e.g. "3 added, 1 changed"
              const counts = group.files.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.status]: (acc[f.status] ?? 0) + 1 }), {});
              return (
                <li key={group.key}>
                  <details>
                    <summary>
                      <em className="tag">{group.kind}</em> <strong>{group.label}</strong>{' '}
                      <span className="muted">
                        {Object.entries(counts)
                          .map(([status, n]) => `${n} ${STATUS_LABEL[status] ?? status}`)
                          .join(', ')}
                      </span>
                    </summary>
                    <ul className="files">
                      {group.files.map((f) => (
                        <li key={f.path} className={f.status}>
                          {STATUS_LABEL[f.status] ?? f.status}: {f.path}
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>

          <div className="card">
            <h3>Publish</h3>
            <p className="small">Happy with everything? Run these in a terminal in the project folder. GitHub then updates the website.</p>
            <pre className="commands">
              {`git add .\ngit commit -m "Update galleries"\ngit push`}
            </pre>
          </div>
        </>
      )}
    </section>
  );
}

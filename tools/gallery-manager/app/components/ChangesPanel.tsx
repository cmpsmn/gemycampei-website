/**
 * ============================================================================
 * PUBLISH TAB  (app/components/ChangesPanel.tsx)
 * ============================================================================
 *
 * Shows which galleries, photos, category orders and reviews changed since the
 * last publication, and the "Publish to the website" button. The button first
 * opens a confirmation window (what goes live, drafts that stay hidden); only
 * "Yes, publish" commits and pushes (api/publish.mjs). GitHub then updates the
 * website within a few minutes.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AppState, Changes } from '../types';
import type { Notify } from '../App';

const STATUS_LABEL: Record<string, string> = { added: 'added', modified: 'changed', deleted: 'removed', renamed: 'renamed' };

interface Props {
  state: AppState;
  notify: Notify;
  /** Reloads the shared state (the badge on the tab) */
  onChanged: () => void;
}

type Step = 'closed' | 'confirm' | 'working' | 'done';

export default function ChangesPanel({ state, notify, onChanged }: Props) {
  const [changes, setChanges] = useState<Changes | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('closed');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ commit: string; actionsUrl: string | null } | null>(null);
  const [publishError, setPublishError] = useState('');

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

  async function publish() {
    setStep('working');
    setPublishError('');
    try {
      setResult(await api.publish(message));
      setMessage('');
      setStep('done');
    } catch (e) {
      setPublishError((e as Error).message);
      setStep('confirm');
    } finally {
      await load();
      onChanged();
    }
  }

  if (error) return <section className="page"><p className="note error">{error}</p></section>;
  if (!changes) return <section className="page">Loading …</section>;

  const canPublish = changes.available && changes.branch === 'master' && (changes.total > 0 || changes.unpublished > 0);

  // Changed galleries that are still drafts: they stay hidden on the website
  const changedIds = new Set(changes.groups.filter((g) => g.kind === 'gallery').map((g) => g.key.replace(/^gallery:/, '')));
  const drafts = state.galleries.filter((g) => g.draft && changedIds.has(g.id));

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Publish to the website</h2>
          <p className="muted">
            {changes.lastCommit ? `Last saved version: “${changes.lastCommit.subject}” (${changes.lastCommit.when}).` : ''}
          </p>
        </div>
        <button onClick={load}>Refresh</button>
      </div>

      {!changes.available ? (
        <p className="note">This project is not a Git repository yet. See docs/DEPLOYMENT.md to set it up.</p>
      ) : changes.branch !== 'master' ? (
        <p className="note">
          The project is on the branch “{changes.branch}”, not “master”, so the button is switched off. Please ask Simon.
        </p>
      ) : changes.total === 0 && changes.unpublished === 0 ? (
        <p className="empty">Nothing to publish. The website is up to date.</p>
      ) : (
        <>
          {changes.total > 0 && (
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
          )}
          {changes.unpublished > 0 && (
            <p className="note">
              {changes.unpublished === 1 ? 'One earlier change was' : `${changes.unpublished} earlier changes were`} saved but not
              uploaded yet (maybe there was no internet). Publishing sends {changes.unpublished === 1 ? 'it' : 'them'} too.
            </p>
          )}

          <div className="card publish-card">
            <p className="small">Happy with everything? Check it first with the Preview button in the gallery, then:</p>
            <button className="primary publish-button" disabled={!canPublish} onClick={() => { setPublishError(''); setStep('confirm'); }}>
              Publish to the website …
            </button>
          </div>
        </>
      )}

      {step !== 'closed' && (
        <div className="dialog-backdrop" onClick={() => step === 'confirm' && setStep('closed')}>
          <div className="dialog card form" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {step === 'done' && result ? (
              <>
                <h2>Published</h2>
                <p>The website updates in a few minutes. Reload gemycampei.com then to see the changes.</p>
                {result.actionsUrl && (
                  <p className="small">
                    Progress (a green tick means it is live):{' '}
                    <a href={result.actionsUrl} target="_blank" rel="noreferrer">
                      GitHub › Actions
                    </a>
                  </p>
                )}
                <div className="actions">
                  <button className="primary" autoFocus onClick={() => { setStep('closed'); notify('Published. The website updates in a few minutes.'); }}>
                    OK
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Publish to the website?</h2>
                <p>
                  {changes.total > 0
                    ? `${changes.groups.length === 1 ? 'This change goes' : `These ${changes.groups.length} changes go`} live on gemycampei.com:`
                    : 'The saved changes go live on gemycampei.com.'}
                </p>
                {changes.total > 0 && (
                  <ul className="publish-list">
                    {changes.groups.map((g) => (
                      <li key={g.key}>{g.label}</li>
                    ))}
                  </ul>
                )}
                {drafts.length > 0 && (
                  <p className="note">
                    Still a draft, so <strong>not visible</strong> on the website: {drafts.map((g) => g.title || g.slug).join(', ')}.
                    To show {drafts.length === 1 ? 'it' : 'them'}, cancel, untick “Draft” in the gallery and save.
                  </p>
                )}
                <label>
                  What did you change? <small className="muted">(optional, e.g. “New gallery Seceda”)</small>
                  <input value={message} onChange={(e) => setMessage(e.target.value)} disabled={step === 'working'} maxLength={200} />
                </label>
                {publishError && <p className="note error">{publishError}</p>}
                <div className="actions">
                  <button onClick={() => setStep('closed')} disabled={step === 'working'}>
                    Cancel
                  </button>
                  <button className="primary" onClick={publish} disabled={step === 'working'} autoFocus>
                    {step === 'working' ? 'Publishing … (up to a minute)' : 'Yes, publish'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

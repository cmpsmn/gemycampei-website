/**
 * ============================================================================
 * DOCUMENT EDITOR  (app/components/DocumentEditor.tsx)
 * ============================================================================
 *
 * One editor for the Categories, Packages, Journal, Pages and Settings tabs:
 *
 *   ┌ list of items ┐ ┌ [English | Deutsch]                 [Preview] [Save] ┐
 *   │ Weddings      │ │ card per section, fields from app/schemas.ts           │
 *   │ The Alps …    │ │                                                        │
 *
 * The fields come from app/schemas.ts. Changes stay in the form until "Save
 * changes" (or Ctrl+S); only the fields that changed are sent, so comments and
 * unknown fields in the files stay as they are. "Deutsch" only appears while
 * the German version is switched on (Settings tab).
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, fileUrl, slugify } from '../api';
import type { AppState, DocChange, DocDetail, DocPayload, DocSummary } from '../types';
import type { Notify } from '../App';
import { SCHEMAS, fieldsFromData } from '../schemas';
import type { DocKind, Field, Section } from '../schemas';
import Counter from './Counter';
import PhotoPicker from './PhotoPicker';

interface Props {
  kind: DocKind;
  state: AppState;
  notify: Notify;
  onDirtyChange: (dirty: boolean) => void;
  /** Something the rest of the app shows may have changed (menu labels, German switch) */
  onChanged: () => Promise<void>;
}

type Lang = 'en' | 'de';
type Data = Record<string, unknown>;
type Form = Record<Lang, Data>;

// ---------------------------------------------------------------------------
// Small helpers for "social.instagram"-style keys
// ---------------------------------------------------------------------------
function getIn(data: Data, key: string): unknown {
  return key.split('.').reduce<unknown>((value, part) => (value && typeof value === 'object' ? (value as Data)[part] : undefined), data);
}

function setIn(data: Data, key: string, value: unknown): Data {
  const [first, ...rest] = key.split('.');
  if (rest.length === 0) return { ...data, [first]: value };
  const inner = data[first] && typeof data[first] === 'object' ? (data[first] as Data) : {};
  return { ...data, [first]: setIn(inner, rest.join('.'), value) };
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

/** Removes empty optional values inside list items, so the files stay tidy */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(clean)
      .filter((v) => !isEmpty(v) && !(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Data).map(([k, v]) => [k, clean(v)]).filter(([, v]) => !isEmpty(v)));
  }
  return typeof value === 'string' ? value.trim() : value;
}

/** Every field of a form, including the fields inside the sections */
const allFields = (sections: Section[]) => sections.flatMap((s) => s.fields);

/** Fields shown for one language */
function fieldsFor(field: Field, lang: Lang, kind: DocKind, german: boolean) {
  if (kind === 'settings') return !field.deOnly || german; // one file, German defaults only when switched on
  if (lang === 'en') return !field.deOnly;
  return !!field.de || !!field.deOnly;
}

/** Turns the server answer into the form (body under "$body") */
const toForm = (doc: DocDetail): Form => ({
  en: { ...doc.en.data, $body: doc.en.body },
  de: { ...doc.de.data, $body: doc.de.body },
});

export default function DocumentEditor({ kind, state, notify, onDirtyChange, onChanged }: Props) {
  const [list, setList] = useState<DocSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [lang, setLang] = useState<Lang>('en');
  const [saving, setSaving] = useState(false);
  /** Increases after uploads, so thumbnails reload */
  const [imageVersion, setImageVersion] = useState(0);
  const [picker, setPicker] = useState<{ current?: string; onPick: (ref: string) => void } | null>(null);
  const [packagePages, setPackagePages] = useState<DocSummary[]>([]);
  const [newTitle, setNewTitle] = useState('');

  const dirty = form !== null && JSON.stringify(form) !== savedJson;
  const hasGerman = state.german && kind !== 'settings';
  const activeLang: Lang = hasGerman ? lang : 'en';

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]); // leaving the tab

  const loadList = useCallback(async () => {
    try {
      const items = await api.docs(kind);
      setList(items);
      setSelectedId((current) => (current && items.some((i) => i.id === current) ? current : (items[0]?.id ?? null)));
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }, [kind, notify]);

  // Reload the list when the trash changes (a restored journal entry comes back)
  useEffect(() => {
    loadList();
  }, [loadList, state.trashCount]);

  useEffect(() => {
    if (kind === 'category') api.docs('packages').then(setPackagePages).catch(() => setPackagePages([]));
  }, [kind]);

  const loadDoc = useCallback(
    async (id: string) => {
      try {
        const d = await api.doc(kind, id);
        const f = toForm(d);
        setDoc(d);
        setForm(f);
        setSavedJson(JSON.stringify(f));
      } catch (error) {
        notify((error as Error).message, { level: 'error' });
      }
    },
    [kind, notify],
  );

  useEffect(() => {
    if (selectedId) loadDoc(selectedId);
    else {
      setDoc(null);
      setForm(null);
    }
  }, [selectedId, loadDoc]);

  const sections: Section[] = useMemo(() => {
    if (kind !== 'page') return SCHEMAS[kind];
    return doc ? fieldsFromData(doc.en.data) : [];
  }, [kind, doc]);

  function select(id: string) {
    if (id === selectedId) return;
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setSelectedId(id);
  }

  const setValue = (key: string, value: unknown) =>
    setForm((f) => (f ? { ...f, [activeLang]: setIn(f[activeLang], key, value) } : f));

  /** What changed compared with the last saved version, per language */
  function payload(): { payload: DocPayload; missing: string[] } {
    const saved = JSON.parse(savedJson) as Form;
    const result: DocPayload = {};
    const missing: string[] = [];
    const langs: Lang[] = hasGerman ? ['en', 'de'] : ['en'];
    for (const l of langs) {
      const changes: DocChange[] = [];
      let body: string | undefined;
      for (const field of allFields(sections)) {
        if (field.type === 'readonly' || !fieldsFor(field, l, kind, state.german)) continue;
        const now = getIn(form![l], field.key);
        const before = getIn(saved[l], field.key);
        if (JSON.stringify(now) === JSON.stringify(before)) continue;
        if (field.key === '$body') body = String(now ?? '');
        else changes.push({ path: field.key.split('.'), value: clean(now) });
      }
      if (changes.length || body !== undefined) result[l] = { changes, ...(body !== undefined ? { body } : {}) };
    }
    // Required fields: English always, German when German texts are saved
    // (German page texts fall back to English one by one, so they are never required)
    for (const l of langs) {
      if (l === 'de' && (!result.de || kind === 'page')) continue;
      for (const field of allFields(sections)) {
        if (!field.required || field.type === 'readonly' || !fieldsFor(field, l, kind, state.german)) continue;
        if (isEmpty(clean(getIn(form![l], field.key)))) missing.push(`${field.label}${l === 'de' ? ' (Deutsch)' : ''}`);
      }
    }
    return { payload: result, missing };
  }

  async function save() {
    if (!form || !doc || saving || !dirty) return;
    const { payload: data, missing } = payload();
    if (missing.length) {
      notify(`Please fill in: ${missing.join(', ')}.`, { level: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const d = await api.saveDoc(kind, doc.id, data);
      const f = toForm(d);
      setDoc(d);
      setForm(f);
      setSavedJson(JSON.stringify(f));
      const switched = kind === 'settings' && !!data.en?.changes.some((c) => c.path[0] === 'german');
      notify(switched ? 'Saved. Restart "npm run dev" (and the preview) so the German switch takes effect.' : 'Saved.');
      await loadList();
      await onChanged();
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S / Cmd+S saves
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function preview() {
    if (!doc) return;
    if (dirty) notify('Showing the last saved version. Save to see your latest changes.', { level: 'warning' });
    const tab = window.open('', '_blank');
    if (tab) tab.document.body.textContent = 'Starting the preview … the first time can take a few seconds.';
    try {
      const { url } = await api.preview(doc.url);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
    } catch (error) {
      tab?.close();
      notify((error as Error).message, { level: 'error' });
    }
  }

  function createJournalEntry() {
    const title = newTitle.trim();
    if (!title) return;
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setPicker({
      onPick: async (cover) => {
        setPicker(null);
        try {
          const { id } = await api.createJournalEntry(title, cover);
          setNewTitle('');
          await loadList();
          setSelectedId(id);
          notify('Draft created. Write the text, then switch it to "Published".');
        } catch (error) {
          notify((error as Error).message, { level: 'error' });
        }
      },
    });
  }

  async function removeJournalEntry() {
    if (!doc || !window.confirm(`Move "${String(doc.en.data.title ?? doc.id)}" to the trash?`)) return;
    try {
      const { trashEntry } = await api.deleteJournalEntry(doc.id);
      setSavedJson(JSON.stringify(form)); // nothing left to save
      setSelectedId(null);
      await loadList();
      await onChanged();
      notify('Journal entry moved to the trash.', { undo: trashEntry });
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
    }
  }

  /** Uploads a photo next to the text file and returns the value to store */
  async function uploadImage(file: File, current: string, nameHint: string) {
    if (!doc) return current;
    const existing = current.replace(/^\.\//, '');
    const name = existing || `${slugify(nameHint) || 'photo'}.jpg`;
    try {
      await api.uploadDocImage(kind, doc.id, name, file);
      setImageVersion((v) => v + 1);
      notify(existing ? 'Photo replaced (saved right away).' : 'Photo uploaded. Save to keep the change.');
      return kind === 'packages' ? `./${name}` : name;
    } catch (error) {
      notify((error as Error).message, { level: 'error' });
      return current;
    }
  }

  const tabTitle = { category: 'Categories', packages: 'Packages pages', journal: 'Journal', page: 'Pages', settings: 'Settings' }[kind];

  return (
    <div className="split">
      <aside className="sidebar">
        {kind === 'journal' && (
          <form
            className="new-review"
            onSubmit={(e) => {
              e.preventDefault();
              createJournalEntry();
            }}
          >
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title of a new article" />
            <button className="primary" disabled={!newTitle.trim()}>
              + New
            </button>
          </form>
        )}
        <section className="group">
          <h2>{tabTitle}</h2>
          <ul>
            {list.map((item) => (
              <li key={item.id}>
                <button className={item.id === selectedId ? 'gallery-item selected' : 'gallery-item'} onClick={() => select(item.id)}>
                  <span className="gallery-item-text">
                    <strong>{item.title}</strong>
                    <small>
                      {item.draft && <span className="draft-badge">Draft</span>}
                      {item.date || (kind === 'settings' ? 'src/content/settings.yaml' : item.id)}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      {doc && form ? (
        <section className="editor">
          <div className="editor-head">
            <div>
              <p className="muted small">{kind === 'settings' ? 'src/content/settings.yaml' : `gemycampei.com${doc.url}`}</p>
              <h2>{list.find((i) => i.id === doc.id)?.title ?? doc.id}</h2>
            </div>
            <div className="actions">
              {kind !== 'settings' && <button onClick={preview}>Preview</button>}
              {kind === 'journal' && (
                <button className="danger-outline" onClick={removeJournalEntry}>
                  Delete
                </button>
              )}
              <button className="primary" onClick={save} disabled={!dirty || saving}>
                {saving ? 'Saving …' : dirty ? 'Save changes' : 'Saved'}
              </button>
            </div>
          </div>

          {hasGerman && (
            <div className="segmented" role="group" aria-label="Language">
              <button className={activeLang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
                English
              </button>
              <button className={activeLang === 'de' ? 'active' : ''} onClick={() => setLang('de')}>
                Deutsch
              </button>
            </div>
          )}
          {activeLang === 'de' && !doc.de.exists && kind !== 'page' && (
            <p className="note small">
              No German version yet. Filling in the fields and saving creates it; the German address is made from the title.
            </p>
          )}

          <div className="doc-sections">
            {sections.map((section) => {
              const fields = section.fields.filter((f) => fieldsFor(f, activeLang, kind, state.german));
              if (fields.length === 0) return null;
              return (
                <div className="card form" key={section.title}>
                  <h3>{section.title}</h3>
                  {section.help && <p className="muted small">{section.help}</p>}
                  {fields.map((field) => (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={getIn(form[activeLang], field.key)}
                      english={activeLang === 'de' ? getIn(form.en, field.key) : undefined}
                      lang={activeLang}
                      onChange={(value) => setValue(field.key, value)}
                      ctx={{ state, doc, kind, imageVersion, packagePages, setPicker, uploadImage }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="empty">{list.length ? 'Select an item on the left.' : 'Nothing here yet.'}</div>
      )}

      {picker && <PhotoPicker galleries={state.galleries} current={picker.current} onPick={picker.onPick} onClose={() => setPicker(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One input, chosen by the field type
// ---------------------------------------------------------------------------
interface Context {
  state: AppState;
  doc: DocDetail;
  kind: DocKind;
  imageVersion: number;
  packagePages: DocSummary[];
  setPicker: (picker: { current?: string; onPick: (ref: string) => void } | null) => void;
  uploadImage: (file: File, current: string, nameHint: string) => Promise<string>;
}

interface FieldProps {
  field: Field;
  value: unknown;
  /** The English value, shown as a hint while editing German */
  english?: unknown;
  lang: Lang;
  onChange: (value: unknown) => void;
  ctx: Context;
  /** Text used to name new uploads (e.g. the package title) */
  nameHint?: string;
}

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value));
const hint = (english: unknown) => (typeof english === 'string' && english ? english : undefined);

function FieldInput({ field, value, english, lang, onChange, ctx, nameHint }: FieldProps) {
  const label = (
    <span className="label-row">
      <span>
        {field.label}
        {field.required && <span className="required" aria-label="required"> *</span>}
      </span>
      {field.max && <Counter value={text(value)} max={field.max} />}
    </span>
  );
  const help = field.help && <small className="muted field-help">{field.help}</small>;
  const { state, doc } = ctx;

  switch (field.type) {
    case 'readonly':
      return (
        <div className="field">
          {label}
          <code className="readonly">{text(value) || '(made from the title when you save)'}</code>
          {help}
        </div>
      );

    case 'text':
      return (
        <label>
          {label}
          <input value={text(value)} placeholder={hint(english) ?? field.placeholder} onChange={(e) => onChange(e.target.value)} />
          {help}
        </label>
      );

    case 'textarea':
    case 'markdown':
      return (
        <label>
          {label}
          <textarea
            className={field.type === 'markdown' ? 'markdown' : undefined}
            rows={field.rows ?? 3}
            value={text(value)}
            placeholder={hint(english) ?? field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          {help}
        </label>
      );

    case 'lines':
    case 'paragraphs': {
      const separator = field.type === 'lines' ? '\n' : '\n\n';
      const items = Array.isArray(value) ? (value as unknown[]).map(text) : [];
      return (
        <label>
          {label}
          <textarea
            rows={field.rows ?? Math.max(3, items.length + 1)}
            value={items.join(separator)}
            placeholder={Array.isArray(english) ? (english as string[]).join(separator) : field.placeholder}
            // Keep the text as typed (empty lines while typing); empty items are dropped when saving
            onChange={(e) => onChange(field.type === 'lines' ? e.target.value.split('\n') : e.target.value.split(/\n\s*\n/))}
          />
          <small className="muted field-help">
            {field.help ?? (field.type === 'lines' ? 'One per line.' : 'Separate paragraphs with an empty line.')}
          </small>
        </label>
      );
    }

    case 'number':
      return (
        <label>
          {label}
          <input
            type="number"
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
          {help}
        </label>
      );

    case 'date':
      return (
        <label>
          {label}
          <input type="date" value={text(value).slice(0, 10)} onChange={(e) => onChange(e.target.value || undefined)} />
          {help}
        </label>
      );

    case 'bool': {
      const actual = value === undefined ? (field.defaultValue ?? false) : value === true;
      const checked = field.invert ? !actual : !!actual;
      return (
        <div className="field">
          {label}
          <label className="switch">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(field.invert ? !e.target.checked : e.target.checked)} />
            <span>{checked ? (field.onText ?? 'Yes') : (field.offText ?? 'No')}</span>
          </label>
          {help}
        </div>
      );
    }

    case 'select':
    case 'category':
    case 'packagesPage':
    case 'gallery': {
      const options =
        field.type === 'select'
          ? (field.options ?? [])
          : field.type === 'category'
            ? state.categories.map((c) => ({ value: c.id, label: c.label }))
            : field.type === 'packagesPage'
              ? ctx.packagePages.map((p) => ({ value: p.id, label: p.title }))
              : state.galleries.map((g) => ({ value: g.id, label: `${g.couple ? `${g.couple} · ` : ''}${g.title}` }));
      const current = text(value);
      return (
        <label>
          {label}
          <select value={current} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">{field.required ? 'Choose …' : '(none)'}</option>
            {current && !options.some((o) => o.value === current) && <option value={current}>{current} (not found)</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {help}
        </label>
      );
    }

    case 'galleries': {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      const titleOf = (id: string) => {
        const g = state.galleries.find((x) => x.id === id);
        return g ? `${g.couple ? `${g.couple} · ` : ''}${g.title}` : `${id} (not found)`;
      };
      return (
        <div className="field">
          {label}
          <ul className="chip-list">
            {ids.map((id, i) => (
              <li key={id}>
                <span>{titleOf(id)}</span>
                <MoveButtons index={i} length={ids.length} onMove={(to) => onChange(moveItem(ids, i, to))} />
                <button className="small danger-outline" onClick={() => onChange(ids.filter((x) => x !== id))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <select value="" onChange={(e) => e.target.value && onChange([...ids, e.target.value])}>
            <option value="">+ Add a gallery …</option>
            {state.galleries
              .filter((g) => !ids.includes(g.id))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {titleOf(g.id)}
                </option>
              ))}
          </select>
          {help}
        </div>
      );
    }

    case 'photo': {
      const ref = text(value);
      return (
        <div className="field">
          {label}
          {ref ? <img className="doc-photo" src={fileUrl(`galleries/${ref}`, 400)} alt="" /> : <p className="note small">No photo chosen.</p>}
          <div>
            <button onClick={() => ctx.setPicker({ current: ref, onPick: (picked) => (ctx.setPicker(null), onChange(picked)) })}>
              {ref ? 'Change photo …' : 'Choose photo …'}
            </button>
          </div>
          {help}
        </div>
      );
    }

    case 'photos': {
      const refs = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="field">
          {label}
          <ul className="photo-row">
            {refs.map((ref, i) => (
              <li key={`${ref}-${i}`}>
                <img src={fileUrl(`galleries/${ref}`, 160)} alt="" title={ref} />
                <div className="list-actions">
                  <MoveButtons index={i} length={refs.length} onMove={(to) => onChange(moveItem(refs, i, to))} horizontal />
                  <button className="small danger-outline" aria-label="Remove" onClick={() => onChange(refs.filter((_, x) => x !== i))}>
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div>
            <button onClick={() => ctx.setPicker({ onPick: (picked) => (ctx.setPicker(null), onChange([...refs, picked])) })}>
              + Add photo …
            </button>
          </div>
          {help}
        </div>
      );
    }

    case 'image': {
      const current = text(value);
      const file = current.replace(/^\.\//, '');
      return <ImageField label={label} help={help} file={file} current={current} folder={doc.folder} version={ctx.imageVersion} onUpload={async (f) => onChange(await ctx.uploadImage(f, current, nameHint ?? field.key))} />;
    }

    case 'objects': {
      const items = Array.isArray(value) ? (value as Data[]) : [];
      // German files hold texts only: photos come from the English file
      const fields = (field.fields ?? []).filter((f) => !(lang === 'de' && f.type === 'image'));
      const englishItems = Array.isArray(english) ? (english as Data[]) : [];
      const summaryOf = (item: Data, i: number) => {
        const first = fields.find((f) => f.type === 'text');
        return text(first ? item[first.key] : '') || `${field.item ?? 'item'} ${i + 1}`;
      };
      return (
        <div className="field objects">
          {label}
          {help}
          {items.map((item, i) => (
            <details key={i} className="object-item" open={items.length <= 1 || isEmpty(summaryOf(item, i).trim())}>
              <summary>
                <span>{summaryOf(item, i)}</span>
                <span className="list-actions" onClick={(e) => e.preventDefault()}>
                  <MoveButtons index={i} length={items.length} onMove={(to) => onChange(moveItem(items, i, to))} />
                  <button
                    className="small danger-outline"
                    onClick={() => window.confirm(`Remove "${summaryOf(item, i)}"?`) && onChange(items.filter((_, x) => x !== i))}
                  >
                    Remove
                  </button>
                </span>
              </summary>
              {fields.map((sub) => (
                <FieldInput
                  key={sub.key}
                  field={sub}
                  value={item[sub.key]}
                  english={englishItems[i]?.[sub.key]}
                  lang={lang}
                  ctx={ctx}
                  nameHint={text(item.title) || text(item.name)}
                  onChange={(v) => onChange(items.map((it, x) => (x === i ? { ...it, [sub.key]: v } : it)))}
                />
              ))}
            </details>
          ))}
          <div>
            <button onClick={() => onChange([...items, {}])}>+ Add {field.item ?? 'item'}</button>
          </div>
        </div>
      );
    }
  }
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function MoveButtons({ index, length, onMove, horizontal }: { index: number; length: number; onMove: (to: number) => void; horizontal?: boolean }) {
  return (
    <>
      <button className="small" disabled={index === 0} aria-label="Move up" onClick={() => onMove(index - 1)}>
        {horizontal ? '←' : '↑'}
      </button>
      <button className="small" disabled={index === length - 1} aria-label="Move down" onClick={() => onMove(index + 1)}>
        {horizontal ? '→' : '↓'}
      </button>
    </>
  );
}

function ImageField(props: {
  label: ReactNode;
  help: ReactNode;
  file: string;
  current: string;
  folder: string;
  version: number;
  onUpload: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      {props.label}
      {props.file ? (
        <img className="doc-photo" src={fileUrl(`${props.folder}/${props.file}`, 400, props.version)} alt="" />
      ) : (
        <p className="note small">No photo yet.</p>
      )}
      <div>
        <button onClick={() => input.current?.click()}>{props.file ? 'Replace photo …' : 'Upload photo …'}</button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) props.onUpload(f);
          }}
        />
      </div>
      {props.help}
    </div>
  );
}

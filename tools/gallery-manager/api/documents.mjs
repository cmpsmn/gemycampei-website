/**
 * ============================================================================
 * DOCUMENTS  (tools/gallery-manager/api/documents.mjs)
 * ============================================================================
 *
 * Reading and writing every text the website shows, apart from galleries and
 * testimonials (they have their own modules). One "document" per item:
 *
 *   kind       English file                                  German file
 *   category   galleries/<id>/_category.md                   _category.de.md
 *   packages   src/content/packages/<id>/index.md            index.de.md
 *   journal    src/content/journal/<id>/index.md             index.de.md
 *   page       src/content/pages/<id>.yaml                   (same file, `de:` part)
 *   settings   src/content/settings.yaml                     (no German part)
 *
 * The browser sends a list of changes: { path: ["faq"], value: [...] }.
 * They are applied to the YAML document, so comments and fields the form does
 * not know about stay as they are. An empty value removes the field.
 * ============================================================================
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { GALLERIES, PACKAGES, ROOT, UserError, assertSlug, exists, rel } from './paths.mjs';
import { parseMarkdown, readMarkdown, stringifyMarkdown, toPlain, updateIn } from './frontmatter.mjs';
import { moveToTrash } from './trash.mjs';
import { optimisePhoto, slugify } from '../../../scripts/lib/photos.mjs';

const CONTENT = path.join(ROOT, 'src', 'content');
const JOURNAL = path.join(CONTENT, 'journal');
const PAGES = path.join(CONTENT, 'pages');
const SETTINGS = path.join(CONTENT, 'settings.yaml');

/** Where each kind keeps its files */
const KINDS = {
  category: {
    format: 'markdown',
    list: async () => listDirs(GALLERIES, '_category.md'),
    dir: (id) => path.join(GALLERIES, id),
    en: (id) => path.join(GALLERIES, id, '_category.md'),
    de: (id) => path.join(GALLERIES, id, '_category.de.md'),
    title: (data) => data.menuLabel,
    url: (id) => `/${id}/`,
  },
  packages: {
    format: 'markdown',
    list: async () => listDirs(PACKAGES, 'index.md'),
    dir: (id) => path.join(PACKAGES, id),
    en: (id) => path.join(PACKAGES, id, 'index.md'),
    de: (id) => path.join(PACKAGES, id, 'index.de.md'),
    title: (data) => data.menuLabel,
    url: (id) => `/${id}/`,
  },
  journal: {
    format: 'markdown',
    list: async () => listDirs(JOURNAL, 'index.md'),
    dir: (id) => path.join(JOURNAL, id),
    en: (id) => path.join(JOURNAL, id, 'index.md'),
    de: (id) => path.join(JOURNAL, id, 'index.de.md'),
    title: (data) => data.title,
    url: (id) => `/journal/${id}/`,
  },
  page: {
    format: 'languages',
    list: async () =>
      (await exists(PAGES)) ? (await readdir(PAGES)).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5)) : [],
    dir: () => PAGES,
    file: (id) => path.join(PAGES, `${id}.yaml`),
    title: (_data, id) => ({ home: 'Home page', about: 'About page', contact: 'Contact page' })[id] ?? id,
    url: (id) => ({ home: '/', about: '/about/', contact: '/contact/' })[id] ?? '/',
  },
  settings: {
    format: 'yaml',
    list: async () => ['settings'],
    dir: () => CONTENT,
    file: () => SETTINGS,
    title: () => 'Site settings',
    url: () => '/',
  },
};

function kindOf(kind) {
  const config = KINDS[kind];
  if (!config) throw new UserError(`Unknown kind "${kind}".`, 404);
  return config;
}

async function listDirs(root, file) {
  if (!(await exists(root))) return [];
  const ids = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && (await exists(path.join(root, entry.name, file)))) ids.push(entry.name);
  }
  return ids.sort();
}

async function assertDocument(kind, id) {
  const config = kindOf(kind);
  if (kind !== 'settings') assertSlug(id, 'Name');
  if (!(await config.list()).includes(id)) throw new UserError(`"${id}" does not exist.`, 404);
  return config;
}

async function readYamlDocument(file) {
  const doc = YAML.parseDocument(await readFile(file, 'utf8'));
  if (doc.errors.length) throw new UserError(`${rel(file)}: ${doc.errors[0].message}`);
  if (doc.contents === null) doc.contents = doc.createNode({});
  return doc;
}

/** Is this value "empty" (then the field is removed from the file)? */
const isEmpty = (value) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

/** Applies [{ path, value }] changes to a YAML document. */
function applyPathChanges(doc, changes = [], prefix = []) {
  for (const { path: keys, value } of changes) {
    if (!Array.isArray(keys) || keys.length === 0 || keys.some((k) => typeof k !== 'string' || !/^[\w.-]+$/.test(k))) {
      throw new UserError('Invalid field.');
    }
    const full = [...prefix, ...keys];
    if (isEmpty(value)) {
      if (doc.hasIn(full)) doc.deleteIn(full);
    } else {
      updateIn(doc, full, value);
    }
  }
}

/** All documents of one kind, for the list on the left. */
export async function listDocuments(kind) {
  const config = kindOf(kind);
  const items = [];
  for (const id of await config.list()) {
    const { en } = await readDocument(kind, id);
    items.push({
      id,
      title: config.title(en.data, id) || id,
      draft: en.data.draft === true,
      date: en.data.date ? String(en.data.date instanceof Date ? en.data.date.toISOString().slice(0, 10) : en.data.date) : '',
    });
  }
  return kind === 'journal' ? items.sort((a, b) => b.date.localeCompare(a.date)) : items;
}

/**
 * One document: English and German settings + texts.
 * @returns {{ id, url, folder, en: { data, body }, de: { data, body, exists } }}
 */
export async function readDocument(kind, id) {
  const config = kindOf(kind);
  const result = { id, url: config.url(id), folder: rel(config.dir(id)) };

  if (config.format === 'markdown') {
    const en = await readMarkdown(config.en(id));
    const deExists = await exists(config.de(id));
    const de = deExists ? await readMarkdown(config.de(id)) : { doc: new YAML.Document({}), body: '' };
    return {
      ...result,
      en: { data: plainDates(toPlain(en.doc)), body: en.body.trim() },
      de: { data: plainDates(toPlain(de.doc)), body: de.body.trim(), exists: deExists },
    };
  }

  const data = plainDates((await readYamlDocument(config.file(id))).toJS() ?? {});
  if (config.format === 'languages') {
    return { ...result, en: { data: data.en ?? {}, body: '' }, de: { data: data.de ?? {}, body: '', exists: !!data.de } };
  }
  return { ...result, en: { data, body: '' }, de: { data: {}, body: '', exists: false } };
}

/** YAML dates become Date objects: send them as "YYYY-MM-DD" */
function plainDates(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(plainDates);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plainDates(v)]));
  return value;
}

/**
 * Saves changes.
 * @param {{ en?: { changes?: Array<{path: string[], value: unknown}>, body?: string },
 *           de?: { changes?: Array<{path: string[], value: unknown}>, body?: string } }} payload
 */
export async function saveDocument(kind, id, payload) {
  const config = await assertDocument(kind, id);

  if (config.format === 'markdown') {
    for (const lang of ['en', 'de']) {
      const part = payload[lang];
      if (!part || (!part.changes?.length && part.body === undefined)) continue;
      const file = config[lang](id);
      let { doc, body } = await readMarkdown(file);
      if (lang === 'de' && !(await exists(file))) {
        // A new German file: start with a short explanation and a German address (slug)
        ({ doc } = parseMarkdown(`---\n# German texts. Photos and settings come from the English file next to this one.\n---\n`));
        const title = part.changes?.find((c) => c.path[0] === 'title' || c.path[0] === 'menuLabel')?.value;
        if (kind !== 'category' || title) doc.set('slug', slugify(String(title || id)));
      }
      applyPathChanges(doc, part.changes);
      if (part.body !== undefined) body = String(part.body);
      await writeFile(file, stringifyMarkdown(doc, body), 'utf8');
    }
    return readDocument(kind, id);
  }

  const file = config.file(id);
  const doc = await readYamlDocument(file);
  if (config.format === 'languages') {
    for (const lang of ['en', 'de']) applyPathChanges(doc, payload[lang]?.changes, [lang]);
  } else {
    applyPathChanges(doc, payload.en?.changes);
  }
  await writeFile(file, doc.toString({ lineWidth: 0 }), 'utf8');
  return readDocument(kind, id);
}

/** New journal entry (a draft), returns its id (= folder name = address). */
export async function createJournalEntry({ title, cover }) {
  if (!title?.trim()) throw new UserError('Please enter a title.');
  if (!cover || !/^[\w-]+\/[\w-]+\/[^/]+\.(jpe?g|png|webp|avif)$/i.test(cover)) {
    throw new UserError('Please choose a cover photo from a gallery.');
  }
  const base = slugify(title) || 'new-article';
  let id = base;
  for (let n = 2; await exists(path.join(JOURNAL, id)); n++) id = `${base}-${n}`;
  await mkdir(path.join(JOURNAL, id), { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const { doc } = parseMarkdown(`---
# Journal article. Edit with the gallery manager (npm run manage → Journal) or by hand.
# Fields are explained in src/content.config.ts
---
`);
  doc.set('title', title.trim());
  doc.set('description', 'TODO: one or two sentences for Google and the journal overview (about 155 characters).');
  doc.set('date', today);
  doc.set('cover', cover);
  doc.set('draft', true);
  await writeFile(path.join(JOURNAL, id, 'index.md'), stringifyMarkdown(doc, 'Write the article here. Use ## for headings.\n'), 'utf8');
  return id;
}

/** Moves a journal entry to the trash (can be restored). */
export async function deleteJournalEntry(id) {
  await assertDocument('journal', id);
  const { en } = await readDocument('journal', id);
  return moveToTrash({ kind: 'journal', label: `Journal entry "${en.data.title ?? id}"`, paths: [path.join(JOURNAL, id)] });
}

/**
 * Replaces or adds a photo that belongs to a document (category hero, package
 * photo). The file keeps the given name, so the texts don't change.
 */
export async function uploadDocumentImage(kind, id, name, buffer) {
  const config = await assertDocument(kind, id);
  if (!['category', 'packages'].includes(kind)) throw new UserError('This kind has no own photos.');
  const clean = String(name ?? '').replace(/^\.\//, '');
  if (!/^[\w.-]+\.jpe?g$/i.test(clean)) throw new UserError('Invalid file name (use .jpg).');
  let photo;
  try {
    photo = await optimisePhoto(buffer);
  } catch {
    throw new UserError('This file could not be read as a photo.');
  }
  await writeFile(path.join(config.dir(id), clean), photo.buffer);
  return { name: clean, path: `${rel(config.dir(id))}/${clean}` };
}

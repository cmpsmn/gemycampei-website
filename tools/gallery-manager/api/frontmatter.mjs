/**
 * ============================================================================
 * FRONTMATTER READ / WRITE  (tools/gallery-manager/api/frontmatter.mjs)
 * ============================================================================
 *
 * The content files of the website (gallery.md, _category.md, testimonials)
 * look like this:
 *
 *   ---
 *   # a comment
 *   title: "Lago di Braies"      ← settings block ("frontmatter", YAML format)
 *   ---
 *
 *   The story text ...             ← body (Markdown)
 *
 * These helpers split a file into settings + body, change settings, and write
 * it back. They use the `yaml` package's "Document" API, which KEEPS COMMENTS
 * and the order of the lines, so the files stay readable after the manager
 * saved them.
 * ============================================================================
 */

import { readFile, writeFile } from 'node:fs/promises';
import YAML, { isMap, isScalar, isSeq } from 'yaml';

/**
 * Matches "---\n<settings>\n---\n<body>" at the very start of a file.
 * The closing --- must stand on a line of its own (as Astro reads it), so a
 * "---" inside a comment or a text never ends the settings block early.
 */
const FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

/**
 * Splits Markdown text into a YAML document and the body.
 * @param {string} text
 * @returns {{ doc: import('yaml').Document, body: string }}
 */
export function parseMarkdown(text) {
  const match = FRONTMATTER.exec(text);
  if (!match) return { doc: new YAML.Document({}), body: text };
  const doc = YAML.parseDocument(match[1] ?? '');
  if (doc.errors.length) throw new Error(`Invalid settings block: ${doc.errors[0].message}`);
  // An empty settings block parses to null: start with an empty object instead
  if (doc.contents === null) doc.contents = doc.createNode({});
  return { doc, body: match[2].replace(/^\r?\n/, '') };
}

/**
 * Turns a YAML document and a body back into Markdown text.
 * @param {import('yaml').Document} doc
 * @param {string} body
 */
export function stringifyMarkdown(doc, body) {
  // lineWidth 0 = never wrap long texts (descriptions stay on one line)
  const settings = doc.toString({ lineWidth: 0 }).trimEnd();
  const text = body.trim();
  return `---\n${settings}\n---\n${text ? `\n${text}\n` : ''}`;
}

/** Reads a Markdown file. Missing file → empty settings and body. */
export async function readMarkdown(file) {
  try {
    return parseMarkdown(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { doc: new YAML.Document({}), body: '' };
    throw error;
  }
}

export async function writeMarkdown(file, doc, body) {
  await writeFile(file, stringifyMarkdown(doc, body), 'utf8');
}

/**
 * Applies a plain object of changes to a document.
 * - `undefined`, `null`, empty string or empty array → the key is removed
 *   (so optional fields don't clutter the file)
 * - anything else → set (existing comments above the key are kept)
 * @param {import('yaml').Document} doc
 * @param {Record<string, unknown>} changes
 */
export function applyChanges(doc, changes) {
  for (const [key, value] of Object.entries(changes)) {
    if (isEmpty(value)) doc.delete(key);
    else updateIn(doc, [key], value);
  }
}

const isEmpty = (value) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Sets a value at a path (e.g. ["social", "instagram"] or ["faq"]).
 * Lists and maps that already exist are updated item by item instead of being
 * replaced, so unchanged lines keep their quotes, comments and layout, and a
 * saved file only differs where something really changed.
 * @param {import('yaml').Document} doc
 * @param {(string|number)[]} path
 */
export function updateIn(doc, path, value) {
  const node = doc.getIn(path, true);
  if (node === undefined || !updateNode(doc, node, value)) doc.setIn(path, value);
}

/** Updates a YAML node in place. Returns false if it has to be replaced. */
function updateNode(doc, node, value) {
  if (isScalar(node)) {
    if (value === null || typeof value === 'object' || typeof value !== typeof node.value) return false;
    if (node.value !== value) node.value = value;
    return true;
  }
  if (isSeq(node) && Array.isArray(value)) {
    value.forEach((item, i) => {
      if (i >= node.items.length || !updateNode(doc, node.items[i], item)) node.items[i] = doc.createNode(item);
    });
    node.items.length = value.length;
    return true;
  }
  if (isMap(node) && value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (isEmpty(item)) node.delete(key);
      else {
        const child = node.get(key, true);
        if (child === undefined || !updateNode(doc, child, item)) node.set(key, doc.createNode(item));
      }
    }
    // Keys that are no longer in the value are removed
    for (const pair of [...node.items]) {
      const key = isScalar(pair.key) ? pair.key.value : pair.key;
      if (!(String(key) in value)) node.delete(key);
    }
    return true;
  }
  return false;
}

/** Plain JavaScript object of the settings (for sending to the browser). */
export const toPlain = (doc) => doc.toJS() ?? {};

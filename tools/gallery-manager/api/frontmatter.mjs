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
import YAML from 'yaml';

/** Matches "---\n<settings>\n---\n<body>" at the very start of a file. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n?---\r?\n?([\s\S]*)$/;

/**
 * Splits Markdown text into a YAML document and the body.
 * @param {string} text
 * @returns {{ doc: import('yaml').Document, body: string }}
 */
export function parseMarkdown(text) {
  const match = FRONTMATTER.exec(text);
  if (!match) return { doc: new YAML.Document({}), body: text };
  const doc = YAML.parseDocument(match[1]);
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
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (empty) doc.delete(key);
    else doc.set(key, value);
  }
}

/** Plain JavaScript object of the settings (for sending to the browser). */
export const toPlain = (doc) => doc.toJS() ?? {};

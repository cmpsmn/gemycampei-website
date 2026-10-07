/**
 * ============================================================================
 * MINI MARKDOWN  (src/lib/markdown.ts)
 * ============================================================================
 *
 * Longer texts (the body of a Markdown file) are rendered by Astro itself.
 * But short texts inside the settings block (package descriptions, FAQ
 * answers) are plain strings. These two helpers support the three styles
 * used on the site:
 *
 *   ***bold italic***    **bold**    *italic*    [link text](/journal/…/)
 *
 * Everything else is escaped, so a "<" in a text can never break the page.
 * ============================================================================
 */

/** Replaces characters that have a special meaning in HTML. */
const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Markdown → HTML for short texts.
 * Use the result with Astro's `set:html` attribute: <p set:html={inlineMarkdown(text)} />
 */
export function inlineMarkdown(text: string): string {
  return escapeHtml(text)
    // The order matters: *** must be handled before ** and *
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links: only addresses on this site ("/…") or https
    .replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

/** Markdown → plain text (removes the stars). Used for data sent to Google. */
export function inlineMarkdownToText(text: string): string {
  return text.replace(/\*{1,3}(.+?)\*{1,3}/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

/**
 * The first words of a Markdown text as plain text, cut at a word and ended
 * with "…" when it is longer than `length` characters (review excerpts).
 */
export function excerpt(markdown: string, length = 220): string {
  const text = inlineMarkdownToText(markdown).replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  return text.slice(0, text.lastIndexOf(' ', length)).replace(/[,.;:!?]$/, '') + '…';
}

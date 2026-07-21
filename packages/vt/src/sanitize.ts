/**
 * HTML-escape untrusted MUD text if ever injected into DOM.
 * Canvas path still uses this for any HTML fallback chrome.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reject/neutralize attempts to break out of text context when building HTML spans.
 * SGR is already parsed separately — this is for raw string insertion safety.
 */
export function sanitizeMudTextForHtml(text: string): string {
  // Strip NULs and other C0 except tab/lf/cr
  const cleaned = [...text]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c === 0) return "";
      if (c < 32 && c !== 9 && c !== 10 && c !== 13) return "";
      return ch;
    })
    .join("");
  return escapeHtml(cleaned);
}

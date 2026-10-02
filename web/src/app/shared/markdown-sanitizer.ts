import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Pure markdown → sanitized-HTML chokepoint (S4-F5).
 *
 * Pipeline: `marked` parses markdown to HTML, then DOMPurify strips every
 * XSS vector (script/iframe tags, event handlers, javascript: URLs, …).
 * Presentation is applied in a DOMPurify hook rather than a custom marked
 * Renderer so the code survives marked's Renderer API churn: each allowed
 * element gets the `md-*` class the app's CSS targets, and links are
 * hardened with target="_blank" rel="noopener noreferrer".
 *
 * Framework-free by design: testable in Node (against a jsdom window) and
 * usable from any Angular pipe/component. Consumers must only ever bind
 * the RETURN VALUE of sanitizeMarkdown() to [innerHTML].
 */

marked.use({ gfm: true, breaks: true });

/** Tag → presentational class expected by the app's markdown CSS. */
const TAG_CLASS: Record<string, string> = {
  H1: 'md-h1',
  H2: 'md-h2',
  H3: 'md-h3',
  H4: 'md-h4',
  P: 'md-p',
  UL: 'md-ul',
  OL: 'md-ol',
  PRE: 'md-code-block',
  TABLE: 'md-table',
  HR: 'md-hr',
  A: 'md-link',
};

if (DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeType !== 1) return; // elements only
    const el = node as Element;
    const cls = TAG_CLASS[el.tagName];
    if (cls) {
      el.classList.add(cls);
    }
    if (el.tagName === 'CODE' && el.parentElement?.tagName !== 'PRE') {
      el.classList.add('md-inline-code');
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * Convert untrusted markdown to sanitized HTML safe for [innerHTML].
 * Fails closed: returns '' when no DOM is available for sanitization.
 *
 * After DOMPurify sanitizes, each <table> is wrapped in a keyboard-reachable
 * horizontal scroll region (div.md-table-scroll) so overflow doesn't clip
 * content and keyboard-only users can scroll it (tabindex="0", role="region").
 */
export function sanitizeMarkdown(markdown: string): string {
  if (!markdown) return '';
  if (!DOMPurify.isSupported) return '';
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  const cleanHtml = DOMPurify.sanitize(rawHtml);

  // Decorate pass: wrap every <table> in a scroll region.
  // Use a temporary container in the same document DOMPurify used.
  const doc: Document = (DOMPurify as any).currentDoc ?? document;
  const container = doc.createElement('div');
  container.innerHTML = cleanHtml;

  const tables = Array.from(container.querySelectorAll('table'));
  if (tables.length === 0) return cleanHtml; // fast-path: no tables → byte-identical

  for (const table of tables) {
    // Guard: already wrapped (shouldn't happen, but be idempotent).
    if (
      table.parentElement &&
      table.parentElement.classList.contains('md-table-scroll')
    ) {
      continue;
    }
    const wrapper = doc.createElement('div');
    wrapper.className = 'md-table-scroll';
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Scrollable table');
    table.parentNode!.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }

  return container.innerHTML;
}

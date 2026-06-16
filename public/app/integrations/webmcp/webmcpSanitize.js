/**
 * WebMCP rich-HTML sanitizer.
 *
 * Agent-supplied HTML (from set_rich_html / set_html / append_rich_html and the
 * underlying setComponentHtml / setTextIdeviceRichHtml / appendTextIdeviceRichHtml
 * setters) is untrusted: an MCP client could push a payload such as
 * `<img src=x onerror=alert(1)>` or `<script>…</script>` that would otherwise be
 * persisted verbatim into the Y.Doc and later rendered. This module is the single
 * choke-point that scrubs that HTML before it is stored.
 *
 * Strategy (single source of truth):
 *   1. In the browser, delegate to the vendored DOMPurify global
 *      (public/libs/dompurify/purify.min.js), the same library the rich editors
 *      (slide, edicuatex) sanitize with. This keeps WebMCP aligned with the
 *      editor's sanitisation policy.
 *   2. When DOMPurify is not present (e.g. the happy-dom test environment, or a
 *      build where the global has not loaded yet), fall back to a DOM-based
 *      scrubber that parses the HTML into an inert document and removes
 *      dangerous nodes/attributes. We deliberately use DOM traversal rather than
 *      regex HTML scrubbing — regex scrubbing is bypassable and re-triggers the
 *      CodeQL "bad HTML filtering" alert.
 */

// Attributes that can execute script or load active content. Removed outright.
const DANGEROUS_ATTR_PREFIX = 'on'; // onclick, onerror, onload, ...
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'data', 'background'];

// URL schemes that must never survive sanitisation.
const DANGEROUS_URL_SCHEME = /^\s*(?:javascript|vbscript):/i;

// Elements that are removed wholesale (along with their contents for <script>).
const FORBIDDEN_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'LINK', 'META', 'BASE']);

/**
 * Returns the active DOMPurify instance, or null when none is available.
 *
 * @returns {{ sanitize: (html: string, config?: object) => string } | null}
 */
function getDomPurify() {
    const candidate =
        (typeof window !== 'undefined' && window.DOMPurify) ||
        (typeof globalThis !== 'undefined' && globalThis.DOMPurify) ||
        null;
    if (candidate && typeof candidate.sanitize === 'function') {
        return candidate;
    }
    return null;
}

/**
 * DOM-based fallback scrubber. Parses HTML into an inert document and strips
 * forbidden elements, inline event handlers and dangerous URL schemes.
 *
 * @param {string} html
 * @returns {string}
 */
function sanitizeWithDom(html) {
    if (typeof DOMParser === 'undefined') {
        // No DOM available at all (should not happen in browser or happy-dom).
        // Return an empty string rather than persisting unsanitised markup.
        return '';
    }

    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const body = doc.body;
    if (!body) {
        return '';
    }

    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
    const toRemove = [];

    let node = walker.nextNode();
    while (node) {
        const tag = node.tagName ? node.tagName.toUpperCase() : '';
        if (FORBIDDEN_TAGS.has(tag)) {
            toRemove.push(node);
        } else {
            scrubElementAttributes(node);
        }
        node = walker.nextNode();
    }

    for (const el of toRemove) {
        el.remove();
    }

    return body.innerHTML;
}

/**
 * Removes event-handler attributes and dangerous URL schemes from a single
 * element.
 *
 * @param {Element} el
 */
function scrubElementAttributes(el) {
    if (!el.attributes) {
        return;
    }
    // Snapshot first: removing attributes mutates the live NamedNodeMap.
    const attrs = Array.from(el.attributes);
    for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        if (name.startsWith(DANGEROUS_ATTR_PREFIX)) {
            el.removeAttribute(attr.name);
            continue;
        }
        if (URL_ATTRS.includes(name) && DANGEROUS_URL_SCHEME.test(attr.value)) {
            el.removeAttribute(attr.name);
        }
    }
}

/**
 * Sanitises agent-supplied rich HTML before it is persisted to the Y.Doc.
 *
 * @param {unknown} html
 * @returns {string} Sanitised HTML (empty string for nullish / non-string input)
 */
export function sanitizeRichHtml(html) {
    if (typeof html !== 'string' || html.length === 0) {
        return '';
    }

    const purify = getDomPurify();
    if (purify) {
        return purify.sanitize(html);
    }

    return sanitizeWithDom(html);
}

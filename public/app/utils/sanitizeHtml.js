/**
 * HTML Sanitization Utilities - XSS protection for untrusted HTML
 *
 * Used to neutralize active content (scripts, inline event handlers,
 * javascript: URLs) in HTML that originates from an untrusted source —
 * notably iDevice content pushed by a REMOTE collaborator over Yjs.
 *
 * A malicious collaborator could otherwise inject payloads such as
 * `<img src=x onerror=...>` that would execute, zero-click, in every other
 * collaborator's authenticated session when the remote update is rendered.
 *
 * Strategy:
 * - Primary: DOMPurify (vendored at /libs/dompurify/purify.min.js, exposed
 *   as the global `window.DOMPurify`). DOMPurify's defaults already strip
 *   <script>, on* handler attributes and javascript: URLs while keeping
 *   benign structural markup. We extend the allow-list so that legitimate
 *   educational media (iframes/embeds) keeps rendering.
 * - Fail-safe fallback: if DOMPurify is unavailable for any reason, do NOT
 *   return the raw string. Parse the markup with the DOM (an inert document,
 *   so nothing executes or loads) and strip <script> elements, on* handler
 *   attributes and any URL whose scheme is not on a safe allow-list
 *   (javascript:, vbscript:, data:, … are removed). Using the real HTML parser
 *   avoids the tokenizer-boundary bypasses that defeat regex
 *   scrubbers. If no DOM is available at all (non-browser env), escape the
 *   whole fragment to inert text — failing open would re-introduce the
 *   vulnerability.
 */

/**
 * DOMPurify configuration for collaborative iDevice content.
 *
 * Educational iDevices legitimately embed media (YouTube, H5P, maps, ...)
 * via <iframe>, so iframes and their common embedding attributes are
 * explicitly allowed. Everything dangerous (scripts, on* handlers,
 * javascript:/data:script URLs) is still stripped by DOMPurify defaults.
 *
 * Note: interactive iDevice behavior is re-attached afterwards by
 * loadInitScriptIdevice('export') from the iDevice's own JS modules, so
 * stripping inline scripts/handlers here does NOT remove legitimate
 * interactivity.
 */
export const COLLABORATIVE_HTML_CONFIG = {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'frameborder', 'scrolling'],
};

let fallbackWarningShown = false;

/**
 * Escape every HTML-significant character so the string can only ever render
 * as inert text. Used as the last-resort fallback when neither DOMPurify nor a
 * DOM is available (e.g. a non-browser worker). This is complete escaping, not
 * partial token removal, so there is nothing left to bypass.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlText(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * URL-bearing attributes whose value must not carry a script-executing scheme.
 */
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster']);

/**
 * Schemes that are safe to keep on a URL-bearing attribute. This is an
 * allow-list rather than a deny-list: relative URLs and fragments (which have
 * no scheme) are always allowed, and anything with an unrecognised scheme -
 * including javascript:, vbscript: and data: (a data:image/svg+xml payload can
 * itself contain a script) - is treated as unsafe and removed.
 */
const SAFE_URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'ftp', 'sms', 'blob']);

/**
 * Returns true if an attribute value carries a scheme that is not on the
 * safe-scheme allow-list. Whitespace and control characters are stripped first
 * because browsers ignore them inside a URL scheme (e.g. "java\tscript:" still
 * executes).
 *
 * @param {string} value
 * @returns {boolean}
 */
function hasUnsafeUrlScheme(value) {
    const normalized = value.replace(/[\u0000-\u0020]+/g, '');
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(normalized);
    if (!match) {
        // No scheme: relative URL, absolute path or fragment - safe.
        return false;
    }
    return !SAFE_URL_SCHEMES.has(match[1].toLowerCase());
}

/**
 * Strip active content from an HTML fragment using the DOM rather than regex.
 *
 * The fragment is parsed into an INERT document (created via
 * `createHTMLDocument`, which is not attached to any browsing context), so
 * setting innerHTML neither executes scripts nor loads resources. Because the
 * real HTML parser normalizes the markup first, this is immune to the
 * tokenizer-boundary bypasses that defeat regex scrubbers (e.g. `/`-separated
 * or quote-adjacent handlers like `<a href="x"onerror=...>`). We then remove
 * <script> elements, every on* event-handler attribute and any
 * non-allow-listed URL scheme (javascript:, vbscript:, data:, ...),
 * and return the cleaned markup.
 *
 * @param {string} html
 * @param {Document} doc - A document providing `implementation.createHTMLDocument`.
 * @returns {string}
 */
function domSanitize(html, doc) {
    const inert = doc.implementation.createHTMLDocument('');
    const root = inert.body;
    root.innerHTML = html;

    // Remove scripts (and noscript, whose contents become live if scripting is
    // later enabled) entirely, including any nested ones.
    for (const el of Array.from(root.querySelectorAll('script, noscript'))) {
        el.remove();
    }

    for (const el of Array.from(root.querySelectorAll('*'))) {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on')) {
                // No standard non-event attribute starts with "on".
                el.removeAttribute(attr.name);
                continue;
            }
            if (URL_ATTRIBUTES.has(name) && hasUnsafeUrlScheme(attr.value)) {
                el.removeAttribute(attr.name);
            }
        }
    }

    return root.innerHTML;
}

/**
 * Fail-safe sanitizer used only when DOMPurify is unavailable. Prefers a
 * DOM-based scrub (robust, parser-accurate); when no DOM is available at all it
 * falls back to escaping the whole fragment to inert text. Never returns the
 * raw string — failing safe is preferred over failing open.
 *
 * @param {string} html
 * @returns {string}
 */
function fallbackSanitize(html) {
    if (!fallbackWarningShown && typeof console !== 'undefined' && typeof console.warn === 'function') {
        fallbackWarningShown = true;
        console.warn(
            '[sanitizeHtml] DOMPurify is not available; using conservative fallback ' +
                'sanitizer for collaborative HTML. Active content will be stripped.',
        );
    }

    const doc = typeof document !== 'undefined' ? document : undefined;
    if (doc && doc.implementation && typeof doc.implementation.createHTMLDocument === 'function') {
        try {
            return domSanitize(html, doc);
        } catch {
            // Fall through to text escaping if DOM parsing fails for any reason.
        }
    }

    // No DOM available: escape everything so the result is inert text.
    return escapeHtmlText(html);
}

/**
 * Sanitize HTML coming from an untrusted collaborator before injecting it
 * into the DOM via innerHTML.
 *
 * @param {string} html - Raw HTML (typically componentData.htmlContent).
 * @returns {string} Sanitized HTML safe for innerHTML assignment.
 */
export function sanitizeCollaborativeHtml(html) {
    if (html === null || html === undefined) return '';

    const input = typeof html === 'string' ? html : String(html);

    if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
        return window.DOMPurify.sanitize(input, COLLABORATIVE_HTML_CONFIG);
    }

    return fallbackSanitize(input);
}

// Also expose globally for non-ES-module consumers (mirrors AvatarUtils).
if (typeof window !== 'undefined') {
    window.SanitizeHtml = {
        sanitizeCollaborativeHtml,
        COLLABORATIVE_HTML_CONFIG,
    };
}

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
 * - <script> blocks are never left executable, but their text is kept: data
 *   blocks iDevices read back keep their type, anything else becomes
 *   type="text/plain" (see encodeScripts/decodeScripts).
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
    // <embed>/<object> carry inline PDFs; their src/data still has to pass the URI check.
    ADD_TAGS: ['iframe', 'embed', 'object'],
    // `referrerpolicy` must be preserved: YouTube's embedded player needs the HTTP
    // Referer header to identify the page; stripping it causes "Error 153"
    // (embedder.identity.missing.referrer) when the host page's Referrer-Policy is
    // restrictive. See doc/development/embedding.md. `sandbox` only ever restricts.
    ADD_ATTR: [
        'target',
        'allow',
        'allowfullscreen',
        'frameborder',
        'scrolling',
        'referrerpolicy',
        'sandbox',
        'loading',
        'data',
    ],
    // DOMPurify's default URI allow-list plus the app-internal schemes stored
    // content uses (asset://, exe-node:, exe-package:) and the blob: URLs that
    // asset resolution produces. None of them can execute script.
    ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob|asset|exe-node|exe-package):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Without it DOMPurify drops a <style> block at the very start of the fragment.
    FORCE_BODY: true,
    // The 3D viewer iDevice renders a <model-viewer> custom element.
    CUSTOM_ELEMENT_HANDLING: {
        tagNameCheck: /^model-viewer$/,
        attributeNameCheck: (name) => !/^on/i.test(name),
        allowCustomizedBuiltInElements: false,
    },
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
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster', 'data']);

/**
 * Schemes that are safe to keep on a URL-bearing attribute. This is an
 * allow-list rather than a deny-list: relative URLs and fragments (which have
 * no scheme) are always allowed, and anything with an unrecognised scheme -
 * including javascript:, vbscript: and data: (a data:image/svg+xml payload can
 * itself contain a script) - is treated as unsafe and removed.
 */
const SAFE_URL_SCHEMES = new Set([
    'http',
    'https',
    'mailto',
    'tel',
    'ftp',
    'sms',
    'blob',
    'asset',
    'exe-node',
    'exe-package',
]);

/**
 * Elements removed outright by the fallback: they run script (script), turn
 * live later (noscript, template) or rewrite how the page resolves and
 * navigates (base, meta).
 */
const REMOVED_ELEMENTS = 'script, noscript, template, base, meta';

/**
 * iDevices store data in <script> blocks that the editor reads back
 * (Interactive Video's JSON, the TikZ source of a circuit). Browsers never run
 * a script of these types, so they survive sanitizing as they are. Any other
 * script survives only as inert text: type="text/plain", with its original
 * type kept in data-exe-inert-script so a reader can still find it.
 */
const DATA_SCRIPT_TYPES = new Set([
    'application/json',
    'application/ld+json',
    'text/tikz',
    'text/plain',
    'text/template',
    'text/x-template',
]);
const SCRIPT_CARRIER_ATTR = 'data-exe-script-carrier';
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

/**
 * Neither sanitizer can keep a data <script> (DOMPurify removes any script, and
 * any raw-text element whose text looks like markup), so each HTML script
 * travels through them as a hidden <textarea>, whose text is escaped markup.
 * SVG/MathML scripts, and any script whose text could close the element on
 * re-parse, are dropped.
 *
 * @param {HTMLElement} root - Body of an inert document.
 */
function encodeScripts(root) {
    for (const forged of Array.from(root.querySelectorAll(`[${SCRIPT_CARRIER_ATTR}]`))) {
        forged.removeAttribute(SCRIPT_CARRIER_ATTR);
    }
    for (const script of Array.from(root.querySelectorAll('script'))) {
        if (script.namespaceURI !== HTML_NAMESPACE || /<\/script/i.test(script.textContent)) {
            script.remove();
            continue;
        }
        const carrier = root.ownerDocument.createElement('textarea');
        carrier.setAttribute('hidden', '');
        carrier.setAttribute(SCRIPT_CARRIER_ATTR, scriptType(script) || 'text/javascript');
        if (script.id) carrier.id = script.id;
        carrier.textContent = script.textContent;
        script.replaceWith(carrier);
    }
}

/**
 * Turn the carriers back into scripts, only ever with a type browsers do not run.
 *
 * @param {HTMLElement} root - Body of an inert document.
 */
function decodeScripts(root) {
    for (const carrier of Array.from(root.querySelectorAll(`textarea[${SCRIPT_CARRIER_ATTR}]`))) {
        const originalType = carrier.getAttribute(SCRIPT_CARRIER_ATTR);
        const text = carrier.textContent;
        if (/<\/script/i.test(text)) {
            carrier.remove();
            continue;
        }
        const script = root.ownerDocument.createElement('script');
        if (DATA_SCRIPT_TYPES.has(originalType)) {
            script.setAttribute('type', originalType);
        } else {
            script.setAttribute('type', 'text/plain');
            script.setAttribute('data-exe-inert-script', originalType);
        }
        if (carrier.id) script.id = carrier.id;
        script.textContent = text;
        carrier.replaceWith(script);
    }
}

function scriptType(script) {
    return (script.getAttribute('type') || '').split(';')[0].trim().toLowerCase();
}

/**
 * Parse a fragment into the body of a fresh inert document (no scripts run, nothing loads).
 *
 * @param {string} html
 * @returns {HTMLElement|null} null when no DOM is available.
 */
function parseInert(html) {
    const doc = typeof document !== 'undefined' ? document : undefined;
    if (!doc?.implementation || typeof doc.implementation.createHTMLDocument !== 'function') return null;
    const body = doc.implementation.createHTMLDocument('').body;
    body.innerHTML = html;
    return body;
}

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

    for (const el of Array.from(root.querySelectorAll(REMOVED_ELEMENTS))) {
        el.remove();
    }

    for (const el of Array.from(root.querySelectorAll('*'))) {
        // An SVG <animate>/<set> can rewrite href at runtime; drop it when it targets one.
        const animated = (el.getAttribute('attributeName') || el.getAttribute('attributename') || '').toLowerCase();
        if (/^(animate|set)$/i.test(el.localName) && URL_ATTRIBUTES.has(animated)) {
            el.remove();
            continue;
        }
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || name === 'srcdoc') {
                // No standard non-event attribute starts with "on"; srcdoc is a whole document.
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

    let input = typeof html === 'string' ? html : String(html);

    const encoded = /<script/i.test(input) ? parseInert(input) : null;
    if (encoded) {
        encodeScripts(encoded);
        input = encoded.innerHTML;
    }

    const output =
        typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function'
            ? window.DOMPurify.sanitize(input, COLLABORATIVE_HTML_CONFIG)
            : fallbackSanitize(input);

    if (!encoded) return output;
    const decoded = parseInert(output);
    decodeScripts(decoded);
    return decoded.innerHTML;
}

// Also expose globally for non-ES-module consumers (mirrors AvatarUtils).
if (typeof window !== 'undefined') {
    window.SanitizeHtml = {
        sanitizeCollaborativeHtml,
        COLLABORATIVE_HTML_CONFIG,
    };
}

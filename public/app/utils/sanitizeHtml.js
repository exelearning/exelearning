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
 *   return the raw string. Apply a conservative regex-based scrub that
 *   removes <script> blocks, on* handler attributes and javascript: URLs.
 *   This is intentionally aggressive (it may over-strip) because failing
 *   open would re-introduce the vulnerability.
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
 * Conservative regex-based scrub used only when DOMPurify is unavailable.
 * Removes <script> blocks, inline on* handler attributes and javascript:
 * URLs. Aggressive by design — failing safe is preferred over failing open.
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

    let output = html;
    let previous;
    // Apply the scrubbing repeatedly until the string stops changing. A single
    // pass is bypassable because removing one token can splice the surrounding
    // halves back into a new dangerous token (e.g. "<scr<script>ipt>" collapses
    // to "<script>", and "javajavascript:script:" collapses to "javascript:").
    // Iterating to a fixpoint defeats that reconstruction. Each pass only deletes
    // characters, so the string is strictly shortened until it stabilises and the
    // loop is guaranteed to terminate (CodeQL js/incomplete-multi-character-sanitization).
    do {
        previous = output;
        output = output
            // Drop entire <script>...</script> blocks (including unclosed ones).
            // The end tag uses [^>]* so trailing junk like "</script foo>" is
            // matched the way browsers actually close the tag (js/bad-tag-filter).
            .replace(/<script\b[^>]*>[\s\S]*?<\/script[^>]*>/gi, '')
            // Drop any remaining <script ...> open tag. The closing '>' is
            // optional ('>?') so an unterminated tag at end-of-input
            // (e.g. "<script src=x") cannot survive the scrub.
            .replace(/<script\b[^>]*>?/gi, '')
            // Drop inline event-handler attributes: on*="..." / on*='...' / on*=value.
            // The name may be preceded by whitespace OR '/', both of which separate
            // attributes inside a tag, so payloads like `<svg/onload=alert(1)>`
            // (no whitespace before the handler) are scrubbed too.
            .replace(/[\s/]on[a-z0-9_-]+\s*=\s*"[^"]*"/gi, '')
            .replace(/[\s/]on[a-z0-9_-]+\s*=\s*'[^']*'/gi, '')
            .replace(/[\s/]on[a-z0-9_-]+\s*=\s*[^\s>]+/gi, '')
            // Neutralize javascript: URLs (e.g. href/src) by blanking the scheme.
            .replace(/javascript\s*:/gi, '');
    } while (output !== previous);

    return output;
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

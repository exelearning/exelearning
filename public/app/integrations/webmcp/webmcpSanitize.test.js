import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// The real library shipped to production. Loading it here (instead of a stub)
// exercises the exact sanitisation policy the browser applies.
import DOMPurify from '../../../libs/dompurify/purify.min.js';
import { sanitizeRichHtml } from './webmcpSanitize.js';

/**
 * Tests for the WebMCP rich-HTML sanitizer.
 *
 * The sanitizer is the single choke-point for agent-supplied HTML before it is
 * written into the Y.Doc. It must:
 *   - strip <script> elements
 *   - strip inline event-handler attributes (onerror, onclick, ...)
 *   - strip javascript: URLs
 *   - keep legitimate formatting / structural markup intact
 *
 * In the browser the real DOMPurify global (public/libs/dompurify/purify.min.js)
 * is used; under happy-dom the DOM-based fallback runs. Both paths are exercised
 * here so the security guarantee holds regardless of environment.
 */
describe('sanitizeRichHtml (DOM fallback path)', () => {
    beforeEach(() => {
        // Ensure the DOMPurify global is absent so the fallback path runs.
        if (typeof window !== 'undefined') {
            delete window.DOMPurify;
        }
        delete globalThis.DOMPurify;
    });

    it('strips <script> tags', () => {
        const out = sanitizeRichHtml('<p>Hello</p><script>alert(1)</script>');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('alert(1)');
        expect(out).toContain('Hello');
    });

    it('strips inline event-handler attributes from <img>', () => {
        const out = sanitizeRichHtml('<img src=x onerror=alert(1)>');
        expect(out.toLowerCase()).not.toContain('onerror');
        expect(out).not.toContain('alert(1)');
    });

    it('strips onclick handlers from any element', () => {
        const out = sanitizeRichHtml('<div onclick="steal()">click</div>');
        expect(out.toLowerCase()).not.toContain('onclick');
        expect(out).not.toContain('steal()');
        expect(out).toContain('click');
    });

    it('strips javascript: URLs from anchors', () => {
        const out = sanitizeRichHtml('<a href="javascript:alert(1)">x</a>');
        expect(out.toLowerCase()).not.toContain('javascript:');
    });

    it('keeps legitimate rich HTML intact', () => {
        const input =
            '<p>A <strong>bold</strong> and <em>italic</em> sentence.</p>' +
            '<ul><li>one</li><li>two</li></ul>' +
            '<a href="https://example.com">link</a>' +
            '<img src="asset://abc.png" alt="pic">';
        const out = sanitizeRichHtml(input);
        expect(out).toContain('<strong>bold</strong>');
        expect(out).toContain('<em>italic</em>');
        expect(out).toContain('<li>one</li>');
        expect(out).toContain('href="https://example.com"');
        expect(out).toContain('src="asset://abc.png"');
        expect(out).toContain('alt="pic"');
    });

    it('returns an empty string for nullish / non-string input', () => {
        expect(sanitizeRichHtml(null)).toBe('');
        expect(sanitizeRichHtml(undefined)).toBe('');
        expect(sanitizeRichHtml(123)).toBe('');
    });

    it('removes nested script smuggled inside otherwise valid markup', () => {
        const out = sanitizeRichHtml(
            '<div><p>ok</p><img src=x onerror="fetch(`/steal`)"><script>evil()</script></div>',
        );
        expect(out).toContain('ok');
        expect(out.toLowerCase()).not.toContain('onerror');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('evil()');
    });
});

describe('sanitizeRichHtml (DOMPurify global path)', () => {
    let originalDOMPurify;

    beforeEach(() => {
        originalDOMPurify = globalThis.DOMPurify;
    });

    afterEach(() => {
        if (originalDOMPurify === undefined) {
            delete globalThis.DOMPurify;
            if (typeof window !== 'undefined') {
                delete window.DOMPurify;
            }
        } else {
            globalThis.DOMPurify = originalDOMPurify;
        }
    });

    it('delegates to window.DOMPurify.sanitize when available', () => {
        const calls = [];
        const fakePurify = {
            sanitize: (html) => {
                calls.push(html);
                return 'PURIFIED';
            },
            addHook: () => {},
            removeHook: () => {},
        };
        globalThis.DOMPurify = fakePurify;
        if (typeof window !== 'undefined') {
            window.DOMPurify = fakePurify;
        }

        const out = sanitizeRichHtml('<img src=x onerror=alert(1)>');
        expect(out).toBe('PURIFIED');
        expect(calls).toHaveLength(1);
        expect(calls[0]).toContain('onerror');
    });
});

describe('sanitizeRichHtml (real vendored DOMPurify path)', () => {
    let originalDOMPurify;

    beforeEach(() => {
        // Drive the sanitizer through the exact library production loads, so the
        // test reflects real browser behaviour rather than the DOM fallback.
        originalDOMPurify = globalThis.DOMPurify;
        globalThis.DOMPurify = DOMPurify;
        if (typeof window !== 'undefined') {
            window.DOMPurify = DOMPurify;
        }
    });

    afterEach(() => {
        if (originalDOMPurify === undefined) {
            delete globalThis.DOMPurify;
            if (typeof window !== 'undefined') {
                delete window.DOMPurify;
            }
        } else {
            globalThis.DOMPurify = originalDOMPurify;
        }
    });

    it('preserves asset:// image sources (no data loss on persisted images)', () => {
        const out = sanitizeRichHtml('<figure><img src="asset://abc123/pic.png" alt="pic"></figure>');
        expect(out).toContain('src="asset://abc123/pic.png"');
        expect(out).toContain('alt="pic"');
    });

    it('preserves blob: image sources', () => {
        const out = sanitizeRichHtml('<img src="blob:https://exe.local/9f1c-2b">');
        expect(out).toContain('src="blob:https://exe.local/9f1c-2b"');
    });

    it('still strips <script> and onerror while keeping the asset:// src', () => {
        const out = sanitizeRichHtml(
            '<img src="asset://a1.png" onerror="alert(1)"><script>steal()</script>',
        );
        // Security guarantee is intact...
        expect(out.toLowerCase()).not.toContain('onerror');
        expect(out).not.toContain('<script');
        expect(out).not.toContain('steal()');
        expect(out).not.toContain('alert(1)');
        // ...and the legitimate asset source survived the same pass.
        expect(out).toContain('src="asset://a1.png"');
    });

    it('does not extend the safe schemes to anchors (blob: href is still dropped)', () => {
        const out = sanitizeRichHtml('<a href="blob:https://exe.local/evil">x</a>');
        expect(out).not.toContain('blob:');
        expect(out).toContain('>x<');
    });

    it('still strips javascript: URLs from anchors', () => {
        const out = sanitizeRichHtml('<a href="javascript:alert(1)">x</a>');
        expect(out.toLowerCase()).not.toContain('javascript:');
    });

    it('does not leak the scoped hook to subsequent sanitize calls', () => {
        // First call registers + removes the media-scheme hook. A following call
        // for a non-media element must not inherit asset:// permissiveness.
        sanitizeRichHtml('<img src="asset://keep.png">');
        const out = sanitizeRichHtml('<a href="asset://should-drop">x</a>');
        expect(out).not.toContain('asset://');
    });
});

/**
 * sanitizeHtml Tests
 *
 * Unit tests for the collaborative HTML sanitizer used to prevent stored
 * DOM-XSS when rendering iDevice content received from a remote collaborator
 * over Yjs.
 *
 * Run with: make test-frontend
 */

import { COLLABORATIVE_HTML_CONFIG, sanitizeCollaborativeHtml } from './sanitizeHtml.js';

// Load the real vendored DOMPurify (UMD) so the primary path is exercised
// exactly as in production. The UMD wrapper attaches to globalThis.DOMPurify.
import createDOMPurify from '../../libs/dompurify/purify.min.js';

describe('sanitizeHtml', () => {
    describe('with real DOMPurify (primary path)', () => {
        beforeEach(() => {
            // The vendored UMD build either returns a factory or an instance.
            const dp = typeof createDOMPurify === 'function' ? createDOMPurify(window) : createDOMPurify;
            window.DOMPurify = dp;
        });

        afterEach(() => {
            delete window.DOMPurify;
        });

        it('exposes DOMPurify for the test (sanity check)', () => {
            expect(window.DOMPurify).toBeTruthy();
            expect(typeof window.DOMPurify.sanitize).toBe('function');
        });

        it('neutralizes <img onerror=...> XSS payloads', () => {
            const out = sanitizeCollaborativeHtml('<img src=x onerror="window.__xss=1">');
            expect(out).not.toMatch(/onerror/i);
            expect(out).not.toMatch(/__xss/);
            // The benign <img> element itself is preserved.
            expect(out).toMatch(/<img/i);
        });

        it('removes <script> tags entirely', () => {
            const out = sanitizeCollaborativeHtml('<p>hi</p><script>window.__xss=1</script>');
            expect(out).not.toMatch(/<script/i);
            expect(out).not.toMatch(/__xss/);
            expect(out).toMatch(/<p>hi<\/p>/);
        });

        it('strips javascript: URLs', () => {
            const out = sanitizeCollaborativeHtml('<a href="javascript:window.__xss=1">x</a>');
            expect(out.toLowerCase()).not.toContain('javascript:');
        });

        it('preserves benign structural markup', () => {
            const out = sanitizeCollaborativeHtml('<p><strong>ok</strong></p>');
            expect(out).toBe('<p><strong>ok</strong></p>');
        });

        it('preserves educational iframe embeds and embed attributes', () => {
            const html =
                '<iframe src="https://www.youtube.com/embed/abc" allow="fullscreen" ' +
                'allowfullscreen frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
            const out = sanitizeCollaborativeHtml(html);
            expect(out).toMatch(/<iframe/i);
            expect(out).toMatch(/src="https:\/\/www\.youtube\.com\/embed\/abc"/);
            expect(out).toMatch(/allowfullscreen/);
            expect(out).toMatch(/frameborder="0"/);
            // referrerpolicy must survive — stripping it causes YouTube Error 153.
            expect(out).toMatch(/referrerpolicy="strict-origin-when-cross-origin"/);
        });

        it('returns empty string for null/undefined', () => {
            expect(sanitizeCollaborativeHtml(null)).toBe('');
            expect(sanitizeCollaborativeHtml(undefined)).toBe('');
        });

        it('exports a config that allows iframes and embed attributes', () => {
            expect(COLLABORATIVE_HTML_CONFIG.ADD_TAGS).toContain('iframe');
            expect(COLLABORATIVE_HTML_CONFIG.ADD_ATTR).toEqual(
                expect.arrayContaining([
                    'allow',
                    'allowfullscreen',
                    'frameborder',
                    'scrolling',
                    'target',
                    'referrerpolicy',
                ]),
            );
        });
    });

    describe('fallback path (DOMPurify unavailable)', () => {
        let warnSpy;

        beforeEach(() => {
            delete window.DOMPurify;
            warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => {
            warnSpy.mockRestore();
            vi.resetModules();
        });

        it('still neutralizes onerror handlers without DOMPurify', async () => {
            // Fresh module instance so the one-time warning fires.
            const mod = await import('./sanitizeHtml.js?fallback-1');
            const out = mod.sanitizeCollaborativeHtml('<img src=x onerror="window.__xss=1">');
            expect(out).not.toMatch(/onerror/i);
            expect(out).not.toMatch(/__xss/);
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });

        it('removes <script> blocks in the fallback', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-2');
            const out = mod.sanitizeCollaborativeHtml('<p>hi</p><script>window.__xss=1</script>');
            expect(out).not.toMatch(/<script/i);
            expect(out).not.toMatch(/__xss/);
            expect(out).toContain('<p>hi</p>');
        });

        it('strips javascript: URLs in the fallback', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-3');
            const out = mod.sanitizeCollaborativeHtml('<a href="javascript:alert(1)">x</a>');
            expect(out.toLowerCase()).not.toContain('javascript:');
        });

        it('removes non-allow-listed URL schemes (vbscript:, data:) but keeps safe/relative URLs', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-3b');
            const probe = document.implementation.createHTMLDocument('');

            // Dangerous schemes are dropped (allow-list, so data: incl. svg is covered).
            for (const danger of [
                '<a href="vbscript:msgbox(1)">x</a>',
                '<img src="data:text/html;base64,PHNjcmlwdD4=">',
                '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
            ]) {
                probe.body.innerHTML = mod.sanitizeCollaborativeHtml(danger);
                const el = probe.body.querySelector('a, img');
                expect(el && (el.getAttribute('href') || el.getAttribute('src'))).toBeFalsy();
            }

            // Safe schemes and relative/fragment URLs are preserved.
            const safe = mod.sanitizeCollaborativeHtml(
                '<a href="https://exelearning.net">a</a><a href="/page">b</a><a href="#top">c</a><img src="img.png">',
            );
            expect(safe).toContain('https://exelearning.net');
            expect(safe).toContain('/page');
            expect(safe).toContain('#top');
            expect(safe).toContain('img.png');
        });

        it('does not return the raw dangerous string (fail safe, not open)', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-4');
            const raw = '<img src=x onerror="steal()">';
            const out = mod.sanitizeCollaborativeHtml(raw);
            expect(out).not.toBe(raw);
        });

        it('returns empty string for null/undefined in the fallback', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-5');
            expect(mod.sanitizeCollaborativeHtml(null)).toBe('');
            expect(mod.sanitizeCollaborativeHtml(undefined)).toBe('');
        });

        it('only warns once per module instance', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-6');
            mod.sanitizeCollaborativeHtml('<b>a</b>');
            mod.sanitizeCollaborativeHtml('<b>b</b>');
            expect(warnSpy).toHaveBeenCalledTimes(1);
        });

        it('leaves no executable <script> element for nested/reconstructed markup', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-7');
            // Parser-based sanitization cannot be defeated by the splice trick
            // ("<scr" + "ipt>") that bypasses single-pass regex scrubbers. The
            // sanitized output may still contain the *text* "<script" (a bogus
            // element name), but re-parsing it the way the consumer will (via
            // innerHTML) must yield zero real <script> elements.
            const out = mod.sanitizeCollaborativeHtml('<scr<script>ipt>alert(1)</scr<script>ipt>');
            const probe = document.implementation.createHTMLDocument('');
            probe.body.innerHTML = out;
            expect(probe.body.querySelectorAll('script').length).toBe(0);
        });

        it('removes script blocks whose end tag carries trailing junk', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-8');
            // Browsers close the tag at "</script foo>"; the end-tag regex must
            // too, otherwise the whole block survives (CodeQL js/bad-tag-filter).
            const out = mod.sanitizeCollaborativeHtml('<script>window.__xss=1</script foo>');
            expect(out).not.toMatch(/<script/i);
            expect(out).not.toMatch(/__xss/);
        });

        it('strips event handlers placed directly after a quoted attribute value', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-9');
            // HTML parsers recover from the missing space and treat `onerror`
            // here as a real attribute, so `<a href="x"onerror=...>` executes.
            // Regex scrubbers that key on a whitespace/"/" separator miss it;
            // the DOM parser normalizes the attribute so it is removed.
            for (const payload of [
                '<a href="x"onerror=alert(1)>link</a>',
                "<img src='x'onerror=alert(1)>",
                '<a title="a"onpointerenter=alert(1)>x</a>',
            ]) {
                const out = mod.sanitizeCollaborativeHtml(payload);
                const probe = document.implementation.createHTMLDocument('');
                probe.body.innerHTML = out;
                for (const el of probe.body.querySelectorAll('*')) {
                    for (const attr of Array.from(el.attributes)) {
                        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
                    }
                }
            }
        });

        it('strips event handlers separated by "/" (e.g. <svg/onload=...>)', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-10');
            // The handler name is preceded by '/', not whitespace; HTML still
            // parses it as an attribute, so the scrub must match it too.
            for (const payload of [
                '<svg/onload=alert(1)>',
                '<svg/onload="alert(1)">',
                "<body/onload='alert(1)'>",
                '<input/onfocus=alert(1) autofocus>',
            ]) {
                const out = mod.sanitizeCollaborativeHtml(payload);
                expect(out).not.toMatch(/\bon[a-z]+\s*=/i);
            }
        });

        it('strips an unterminated <script tag with no closing ">"', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-11');
            const out = mod.sanitizeCollaborativeHtml('<script src=//evil.example/x');
            expect(out).not.toMatch(/<script/i);
        });

        it('preserves benign words that merely start with "on"', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-12');
            // The handler regex requires "=", so plain prose is not over-stripped.
            const out = mod.sanitizeCollaborativeHtml('<p>onset of the lesson, online</p>');
            expect(out).toContain('onset of the lesson, online');
        });
    });
});

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
                'allowfullscreen frameborder="0"></iframe>';
            const out = sanitizeCollaborativeHtml(html);
            expect(out).toMatch(/<iframe/i);
            expect(out).toMatch(/src="https:\/\/www\.youtube\.com\/embed\/abc"/);
            expect(out).toMatch(/allowfullscreen/);
            expect(out).toMatch(/frameborder="0"/);
        });

        it('returns empty string for null/undefined', () => {
            expect(sanitizeCollaborativeHtml(null)).toBe('');
            expect(sanitizeCollaborativeHtml(undefined)).toBe('');
        });

        it('exports a config that allows iframes and embed attributes', () => {
            expect(COLLABORATIVE_HTML_CONFIG.ADD_TAGS).toContain('iframe');
            expect(COLLABORATIVE_HTML_CONFIG.ADD_ATTR).toEqual(
                expect.arrayContaining(['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target']),
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

        it('defeats <script> tags reconstructed by a single-pass removal', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-7');
            // Removing the inner "<script>" splices "<scr" + "ipt>" back into a
            // fresh "<script>"; a single pass would leave that tag behind, only
            // iterating to a fixpoint strips every reconstructed tag.
            const out = mod.sanitizeCollaborativeHtml('<scr<script>ipt>alert(1)</scr<script>ipt>');
            expect(out).not.toMatch(/<script/i);
        });

        it('removes script blocks whose end tag carries trailing junk', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-8');
            // Browsers close the tag at "</script foo>"; the end-tag regex must
            // too, otherwise the whole block survives (CodeQL js/bad-tag-filter).
            const out = mod.sanitizeCollaborativeHtml('<script>window.__xss=1</script foo>');
            expect(out).not.toMatch(/<script/i);
            expect(out).not.toMatch(/__xss/);
        });

        it('defeats javascript: schemes reconstructed by a single-pass removal', async () => {
            const mod = await import('./sanitizeHtml.js?fallback-9');
            const out = mod.sanitizeCollaborativeHtml('javajavascript:script:alert(1)');
            expect(out.toLowerCase()).not.toContain('javascript:');
        });
    });
});

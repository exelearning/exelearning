import { describe, it, expect } from 'vitest';
import { decorateForHttp, INJECTED_MARKER } from './previewContentDecorators.js';

/** Extract the body of every injected <script> and assert it parses as JS. */
function assertInjectedScriptsParse(html) {
    const scripts = [...html.matchAll(/<script[^>]*data-injected-by="eXeLearning-Preview"[^>]*>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, body] of scripts) {
        expect(() => new Function(body)).not.toThrow();
    }
    return scripts.length;
}

const PAGE = '<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>';

describe('previewContentDecorators', () => {
    describe('decorateForHttp', () => {
        it('injects syntactically valid marker scripts before the last </body>', () => {
            const withNestedBody = PAGE.replace('<h1>Hi</h1>', '<script>var s="</body>";</script><h1>Hi</h1>');
            const result = decorateForHttp(withNestedBody, { pdfjsBase: '/preview/abc/' });
            assertInjectedScriptsParse(result);
            const markerIndex = result.indexOf(INJECTED_MARKER);
            const lastBodyIndex = result.lastIndexOf('</body>');
            expect(markerIndex).toBeGreaterThan(-1);
            expect(markerIndex).toBeLessThan(lastBodyIndex);
            expect(result.endsWith('</body></html>')).toBe(true);
        });

        it('appends scripts when there is no </body>', () => {
            const result = decorateForHttp('<p>fragment</p>', { pdfjsBase: '/p/x/' });
            expect(result.startsWith('<p>fragment</p>')).toBe(true);
            expect(result).toContain(INJECTED_MARKER);
        });

        it('is idempotent', () => {
            const once = decorateForHttp(PAGE, { pdfjsBase: '/p/x/' });
            const twice = decorateForHttp(once, { pdfjsBase: '/p/x/' });
            expect(twice).toBe(once);
        });

        it('bakes the PDF.js base and reports navigation from the URL path', () => {
            const result = decorateForHttp(PAGE, { pdfjsBase: '/preview/abc123/' });
            expect(result).toContain('window.__EXE_PDFJS_BASE__ = "/preview/abc123/"');
            expect(result).toContain('exe-preview-nav');
            // The nav reporter derives the page from the pathname after /preview/{id}/.
            expect(result).toContain('\\/preview\\/[^/]+\\/(.*)$');
        });

        it('routes non-HTML documents to the parent and externalizes external links', () => {
            const result = decorateForHttp(PAGE, { pdfjsBase: '/p/x/' });
            expect(result).toContain('exe-preview-open-document');
            expect(result).toContain("target', '_blank'");
        });

        it('injects the embed shim as a same-origin <script src> in <head> when a URL is given', () => {
            const result = decorateForHttp(PAGE, {
                pdfjsBase: '/p/x/',
                embedShimUrl: '/app/common/exe_embed_bridge/exe_embed_shim.js',
            });
            const shimIndex = result.indexOf('src="/app/common/exe_embed_bridge/exe_embed_shim.js"');
            const headOpen = result.indexOf('<head>');
            const bodyOpen = result.indexOf('<body>');
            expect(shimIndex).toBeGreaterThan(headOpen);
            expect(shimIndex).toBeLessThan(bodyOpen);
        });

        it('attribute-encodes the embed shim URL so it cannot break out of src="…"', () => {
            const result = decorateForHttp(PAGE, {
                pdfjsBase: '/p/x/',
                embedShimUrl: '/app/shim.js"></script><script>alert(1)</script>',
            });
            // The injected shim must not introduce a second, unescaped <script>.
            expect(result).not.toContain('"></script><script>alert(1)</script>');
            expect(result).toContain('&quot;&gt;&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
        });

        it('omits the shim script when no URL is configured', () => {
            const result = decorateForHttp(PAGE, { pdfjsBase: '/p/x/' });
            expect(result).not.toContain('exe_embed_shim.js');
        });

        it('does not carry the removed srcdoc-only artifacts', () => {
            const result = decorateForHttp(PAGE, { pdfjsBase: '/p/x/' });
            // srcdoc's teacher-mode global, per-page navigate message and the
            // runtime asset resolver are gone with the srcdoc transport.
            expect(result).not.toContain('__EXE_TEACHER_MODE__');
            expect(result).not.toContain('exe-preview-navigate');
            expect(result).not.toContain("Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src')");
        });
    });
});

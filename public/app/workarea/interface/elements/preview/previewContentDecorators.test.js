import { describe, it, expect } from 'vitest';
import { decorateForHttp, decorateForSrcdoc, INJECTED_MARKER } from './previewContentDecorators.js';

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
    });

    describe('decorateForSrcdoc', () => {
        it('injects syntactically valid marker scripts with the baked page path', () => {
            const result = decorateForSrcdoc(PAGE, { pagePath: 'html/page2.html' });
            assertInjectedScriptsParse(result);
            expect(result).toContain('"html/page2.html"');
            expect(result).toContain('exe-preview-nav');
        });

        it('requests page navigation and document opening via postMessage', () => {
            const result = decorateForSrcdoc(PAGE, { pagePath: 'index.html' });
            expect(result).toContain('exe-preview-navigate');
            expect(result).toContain('exe-preview-open-document');
        });

        it('is idempotent', () => {
            const once = decorateForSrcdoc(PAGE, { pagePath: 'index.html' });
            const twice = decorateForSrcdoc(once, { pagePath: 'index.html' });
            expect(twice).toBe(once);
        });

        it('sets the teacher-mode flag in <head> before exe_export.js runs', () => {
            const withHead = '<!DOCTYPE html><html><head><script src="libs/exe_export.js"></script></head><body>x</body></html>';
            const result = decorateForSrcdoc(withHead, { pagePath: 'index.html' });
            const flagIndex = result.indexOf('window.__EXE_TEACHER_MODE__ = true');
            const exportIndex = result.indexOf('libs/exe_export.js');
            const headOpen = result.indexOf('<head>');
            expect(flagIndex).toBeGreaterThan(headOpen);
            // Flag must precede the exe_export.js script tag so it is set first.
            expect(flagIndex).toBeLessThan(exportIndex);
        });

        it('escapes closing script sequences in the baked page path', () => {
            const hostile = 'a</script><script>alert(1)</script>.html';
            const result = decorateForSrcdoc(PAGE, { pagePath: hostile });
            // The baked value must never terminate the injected script block.
            const scripts = [...result.matchAll(/<script[^>]*data-injected-by[^>]*>([\s\S]*?)<\/script>/g)];
            for (const [, body] of scripts) {
                expect(body).not.toContain('</script>');
            }
        });
    });
});

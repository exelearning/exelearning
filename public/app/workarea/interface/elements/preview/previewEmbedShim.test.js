import { describe, expect, it } from 'vitest';
import { applyPreviewEmbedShim, injectEmbedShimIntoHtml } from './previewEmbedShim.js';

const SHIM = 'window.__shim__ = 1;';

describe('injectEmbedShimIntoHtml', () => {
    it('injects at the very top of <head> so it runs before the page scripts', () => {
        const out = injectEmbedShimIntoHtml('<html><head><script src="a.js"></script></head><body>x</body></html>', SHIM);
        expect(out.indexOf('data-exe-embed-shim')).toBeLessThan(out.indexOf('a.js'));
        expect(out).toContain(SHIM);
    });

    it('falls back to before <body> when the document has no head', () => {
        const out = injectEmbedShimIntoHtml('<html><body>x</body></html>', SHIM);
        expect(out.indexOf('data-exe-embed-shim')).toBeLessThan(out.indexOf('<body'));
    });

    it('is idempotent — a page already carrying the shim is left alone', () => {
        const once = injectEmbedShimIntoHtml('<html><head></head><body></body></html>', SHIM);
        expect(injectEmbedShimIntoHtml(once, SHIM)).toBeNull();
    });

    it('returns null without a shim source', () => {
        expect(injectEmbedShimIntoHtml('<html><head></head></html>', '')).toBeNull();
    });

    it('neutralizes a </script> inside the source so it cannot close the tag early', () => {
        const out = injectEmbedShimIntoHtml('<html><head></head></html>', 'var a = "</script>";');
        expect(out).not.toContain('"</script>"');
        expect(out).toContain('<\\/script');
    });
});

describe('applyPreviewEmbedShim', () => {
    const html = '<html><head></head><body><iframe src="https://www.youtube.com/embed/x"></iframe></body></html>';

    it('injects into every HTML page and reports the count', () => {
        const { files, injected } = applyPreviewEmbedShim(
            { 'index.html': html, 'html/page-2.html': html },
            SHIM,
        );
        expect(injected).toBe(2);
        for (const path of ['index.html', 'html/page-2.html']) {
            expect(new TextDecoder().decode(files[path])).toContain('data-exe-embed-shim');
        }
    });

    it('keeps the provider iframe so the shim can promote it', () => {
        const { files } = applyPreviewEmbedShim({ 'index.html': html }, SHIM);
        expect(new TextDecoder().decode(files['index.html'])).toContain('youtube.com/embed/x');
    });

    it('passes non-HTML entries through by reference (author bytes untouched)', () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const { files } = applyPreviewEmbedShim({ 'media/clip.mp4': bytes, 'index.html': html }, SHIM);
        expect(files['media/clip.mp4']).toBe(bytes);
    });

    it('accepts string, Uint8Array and ArrayBuffer page content', () => {
        const encoded = new TextEncoder().encode(html);
        const { injected } = applyPreviewEmbedShim(
            { 'a.html': html, 'b.html': encoded, 'c.html': encoded.buffer.slice(0) },
            SHIM,
        );
        expect(injected).toBe(3);
    });

    it('returns the map untouched when no shim source is available', () => {
        const input = { 'index.html': html };
        const { files, injected } = applyPreviewEmbedShim(input, null);
        expect(files).toBe(input);
        expect(injected).toBe(0);
    });
});

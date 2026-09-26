import { describe, expect, it } from 'vitest';
import {
    applyPreviewEmbedShim,
    EMBED_CHILD_SCRIPT_PATH,
    EMBED_SHIM_FILENAME,
    injectEmbedShimIntoHtml,
} from './previewEmbedShim.js';

const SHIM = 'window.__shim__ = 1;';
const SRC = EMBED_SHIM_FILENAME;

describe('injectEmbedShimIntoHtml', () => {
    it('injects at the very top of <head> so it runs before the page scripts', () => {
        const out = injectEmbedShimIntoHtml(
            '<html><head><script src="a.js"></script></head><body>x</body></html>',
            SRC
        );
        expect(out.indexOf('data-exe-embed-shim')).toBeLessThan(out.indexOf('a.js'));
        expect(out).toContain(`src="${SRC}"`);
    });

    it('falls back to before <body> when the document has no head', () => {
        const out = injectEmbedShimIntoHtml('<html><body>x</body></html>', SRC);
        expect(out.indexOf('data-exe-embed-shim')).toBeLessThan(out.indexOf('<body'));
    });

    it('declines a document with neither head nor body', () => {
        expect(injectEmbedShimIntoHtml('<p>fragment</p>', SRC)).toBeNull();
    });

    it('is idempotent — a page already carrying the shim is left alone', () => {
        const once = injectEmbedShimIntoHtml('<html><head></head><body></body></html>', SRC);
        expect(injectEmbedShimIntoHtml(once, SRC)).toBeNull();
    });

    it('returns null without a src', () => {
        expect(injectEmbedShimIntoHtml('<html><head></head></html>', '')).toBeNull();
    });
});

describe('applyPreviewEmbedShim', () => {
    const html = '<html><head></head><body><iframe src="https://www.youtube.com/embed/x"></iframe></body></html>';

    it('ships ONE copy of the source and links it from every page', () => {
        const { files, injected } = applyPreviewEmbedShim(
            { 'index.html': html, 'html/page-2.html': html },
            SHIM
        );
        expect(injected).toBe(2);
        // A single shared copy, not one inlined per page.
        expect(files[EMBED_SHIM_FILENAME]).toBe(SHIM);
        const decode = path => new TextDecoder().decode(files[path]);
        expect(decode('index.html')).not.toContain(SHIM);
        expect(decode('index.html')).toContain(`src="${EMBED_SHIM_FILENAME}"`);
        // Pages one level deep have to climb back to the snapshot root.
        expect(decode('html/page-2.html')).toContain(`src="../${EMBED_SHIM_FILENAME}"`);
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
            SHIM
        );
        expect(injected).toBe(3);
    });

    it('adds no shim file when no page could take it', () => {
        const { files, injected } = applyPreviewEmbedShim({ 'media/clip.mp4': new Uint8Array([1]) }, SHIM);
        expect(injected).toBe(0);
        expect(files[EMBED_SHIM_FILENAME]).toBeUndefined();
    });

    it('returns the map untouched when no shim source is available', () => {
        const input = { 'index.html': html };
        const { files, injected } = applyPreviewEmbedShim(input, null);
        expect(files).toBe(input);
        expect(injected).toBe(0);
    });
});

describe('EMBED_CHILD_SCRIPT_PATH', () => {
    /**
     * The preview injects the built CHILD ARTIFACT, not a raw source file
     * (ADR-2199-11 step 3). The artifact is versioned and hash-verified, and is the
     * same thing host plugins vendor — so what authors get in the preview is what
     * ships inside their exported packages.
     */
    it('points at the built child artifact, not a source file', () => {
        expect(EMBED_CHILD_SCRIPT_PATH).toBe(
            'app/common/exe_external_media/dist/exe-external-media-child.min.js'
        );
    });

    it('is a relative path, so it composes with any base path', () => {
        expect(EMBED_CHILD_SCRIPT_PATH.startsWith('/')).toBe(false);
    });

    /**
     * The injected filename stays stable: every page links it relatively, and the
     * snapshot carries exactly one copy at its root.
     */
    it('keeps the snapshot-root filename independent of where the source came from', () => {
        expect(EMBED_SHIM_FILENAME).toBe('exe-embed-shim.js');
    });
});

import { describe, expect, it } from 'vitest';
import {
    applyPreviewExternalMediaFallback,
    replaceExternalMediaInHtml,
} from './previewExternalMediaFallback.js';

describe('replaceExternalMediaInHtml', () => {
    it('replaces a YouTube iframe with an accessible open-in-new-tab placeholder', () => {
        const html =
            '<!DOCTYPE html><html><head><title>t</title></head><body>' +
            '<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>' +
            '</body></html>';
        const result = replaceExternalMediaInHtml(html);
        expect(result).not.toBeNull();
        expect(result.replaced).toBe(1);
        expect(result.html).not.toContain('youtube.com/embed/abc"></iframe>');
        expect(result.html).toContain('exe-external-media-fallback');
        expect(result.html).toContain('href="https://www.youtube.com/embed/abc"');
        expect(result.html).toContain('target="_blank"');
        expect(result.html).toContain('rel="noopener noreferrer"');
        expect(result.html).toContain('role="group"');
        expect(result.html.startsWith('<!DOCTYPE html>')).toBe(true);
    });

    it('replaces multiple providers and leaves non-provider iframes intact', () => {
        const html =
            '<body><iframe src="https://player.vimeo.com/video/1"></iframe>' +
            '<iframe src="https://youtu.be/x"></iframe>' +
            '<iframe src="https://h5p.org/embed/2"></iframe></body>';
        const result = replaceExternalMediaInHtml(html);
        expect(result.replaced).toBe(2);
        expect(result.html).toContain('h5p.org/embed/2');
        expect(result.html.match(/exe-external-media-fallback/g)).toHaveLength(2);
    });

    it('returns null when there is nothing to replace', () => {
        expect(replaceExternalMediaInHtml('<p>no iframes</p>')).toBeNull();
        expect(replaceExternalMediaInHtml('<iframe src="https://example.com/x"></iframe>')).toBeNull();
        expect(replaceExternalMediaInHtml('<iframe srcdoc="x"></iframe>')).toBeNull();
    });
});

describe('applyPreviewExternalMediaFallback', () => {
    const YT = '<html><body><iframe src="https://www.youtube.com/embed/abc"></iframe></body></html>';

    it('rewrites only HTML entries containing provider iframes', () => {
        const cssBytes = new TextEncoder().encode('body{}');
        const plainHtml = new TextEncoder().encode('<html><body><p>plain</p></body></html>');
        const files = {
            'index.html': new TextEncoder().encode(YT),
            'html/other.html': plainHtml,
            'theme/style.css': cssBytes,
        };
        const { files: output, replaced } = applyPreviewExternalMediaFallback(files);
        expect(replaced).toBe(1);
        // Untouched entries are passed through BY REFERENCE (byte-identical).
        expect(output['theme/style.css']).toBe(cssBytes);
        expect(output['html/other.html']).toBe(plainHtml);
        const rewritten = new TextDecoder().decode(output['index.html']);
        expect(rewritten).toContain('exe-external-media-fallback');
    });

    it('accepts ArrayBuffer and string entries', () => {
        const buffer = new TextEncoder().encode(YT).buffer;
        const { files: output, replaced } = applyPreviewExternalMediaFallback({
            'a.html': buffer,
            'b.xhtml': YT,
        });
        expect(replaced).toBe(2);
        expect(new TextDecoder().decode(output['a.html'])).toContain('exe-external-media-fallback');
        expect(new TextDecoder().decode(output['b.xhtml'])).toContain('exe-external-media-fallback');
    });

    it('returns zero replacements for a provider-free snapshot', () => {
        const files = { 'index.html': new TextEncoder().encode('<p>hello</p>') };
        const { files: output, replaced } = applyPreviewExternalMediaFallback(files);
        expect(replaced).toBe(0);
        expect(output['index.html']).toBe(files['index.html']);
    });
});

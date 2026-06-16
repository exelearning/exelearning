import { describe, it, expect } from 'bun:test';
import { bakeFigureCaptions } from './figure-caption';
import type { AssetExportMetadata } from './interfaces';

function mapOf(entries: Record<string, AssetExportMetadata>): Map<string, AssetExportMetadata> {
    return new Map(Object.entries(entries));
}

describe('bakeFigureCaptions', () => {
    it('returns the html unchanged when there are no centralized figures', () => {
        const html = '<p>Hello <img src="x.jpg"></p>';
        expect(bakeFigureCaptions(html, mapOf({}))).toBe(html);
    });

    it('rebuilds the figcaption from the centralized metadata map', () => {
        const html =
            '<figure class="exe-figure position-center" data-asset-id="u1"><img src="content/resources/u1.jpg" alt="a cat"><figcaption class="figcaption">STALE</figcaption></figure>';
        const out = bakeFigureCaptions(
            html,
            mapOf({ u1: { title: 'Sunset', author: 'Ada', license: 'Creative Commons BY' } }),
        );
        expect(out).not.toContain('STALE');
        expect(out).toContain('<span class="title"><em>Sunset</em></span>');
        expect(out).toContain('<span class="author">Ada</span>');
        expect(out).toContain('rel="license noopener"');
        // The image (with its per-instance alt) and figure attributes are preserved.
        expect(out).toContain('<img src="content/resources/u1.jpg" alt="a cat">');
        expect(out).toContain('class="exe-figure position-center"');
    });

    it('honors the per-instance heading / notes / hidden data attributes', () => {
        const heading = bakeFigureCaptions(
            '<figure data-asset-id="u1" data-caption-heading="Figure 1"><img src="r/u1.jpg"></figure>',
            mapOf({ u1: { title: 'X' } }),
        );
        expect(heading).toContain('<div class="figcaption header"><strong>Figure 1</strong></div>');

        const hidden = bakeFigureCaptions(
            '<figure data-asset-id="u1" data-caption-hidden="true"><img src="r/u1.jpg"><figcaption class="figcaption">old</figcaption></figure>',
            mapOf({ u1: { title: 'X', license: 'Creative Commons BY' } }),
        );
        expect(hidden).not.toContain('figcaption');
        expect(hidden).toContain('<img src="r/u1.jpg">');
    });

    it('decodes HTML-encoded data-attribute values before re-escaping them', () => {
        const out = bakeFigureCaptions(
            '<figure data-asset-id="u1" data-caption-notes="A &amp; B &lt;x&gt;"><img src="r/u1.jpg"></figure>',
            mapOf({ u1: { title: 'X' } }),
        );
        expect(out).toContain('<span class="notes">A &amp; B &lt;x&gt;</span>');
    });

    it('leaves a figure without a data-asset-id untouched', () => {
        const html =
            '<figure class="image"><img src="x.jpg" data-asset-id="not-on-figure"><figcaption>keep</figcaption></figure>';
        expect(bakeFigureCaptions(html, mapOf({}))).toBe(html);
    });

    it('bakes multiple figures independently', () => {
        const html =
            '<figure data-asset-id="u1"><img src="r/u1.jpg"></figure><figure data-asset-id="u2"><img src="r/u2.jpg"></figure>';
        const out = bakeFigureCaptions(html, mapOf({ u1: { title: 'One' }, u2: { title: 'Two' } }));
        expect(out).toContain('<em>One</em>');
        expect(out).toContain('<em>Two</em>');
    });
});

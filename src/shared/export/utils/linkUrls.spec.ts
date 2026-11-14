import { describe, expect, it } from 'bun:test';
import { LINK_URLS_CSS, markLinksShowingTheirUrl } from './linkUrls';

/** A whole document around this body, as both the preview and the worksheet hand one over. */
const page = (body: string) => `<!DOCTYPE html><html><head></head><body>${body}</body></html>`;

describe('markLinksShowingTheirUrl', () => {
    it('marks a link whose text already is its address, where the link starts', () => {
        const html = page('<p>Intro <a href="https://example.org/">https://example.org/</a> and more.</p>');

        expect(markLinksShowingTheirUrl(html)).toBe(
            page('<p>Intro <a data-exe-text-is-url href="https://example.org/">https://example.org/</a> and more.</p>'),
        );
    });

    it('leaves a link with words of its own, whose address print writes after it', () => {
        const html = page('<a href="https://example.org/">Example</a>');

        expect(markLinksShowingTheirUrl(html)).toBe(html);
    });

    it('leaves a link that does not lead to the web, which print writes nothing after', () => {
        const html = page('<a href="#top">#top</a><a href="mailto:a@b.c">mailto:a@b.c</a>');

        expect(markLinksShowingTheirUrl(html)).toBe(html);
    });

    it('marks every such link, and only those', () => {
        const html = page(
            '<a href="https://a.org">a.org</a><a href="https://b.org">B</a><a href="http://c.org/x">c.org/x</a>',
        );

        expect(markLinksShowingTheirUrl(html)).toBe(
            page(
                '<a data-exe-text-is-url href="https://a.org">a.org</a><a href="https://b.org">B</a>' +
                    '<a data-exe-text-is-url href="http://c.org/x">c.org/x</a>',
            ),
        );
    });

    it('returns a document without links as it was', () => {
        const html = page('<p>No links</p>');

        expect(markLinksShowingTheirUrl(html)).toBe(html);
    });

    it('marks a link holding only pictures, however they are wrapped', () => {
        const html = page(
            '<a href="https://cc.org"><img src="by.png"></a>' +
                '<a href="https://x.org"> <span><img src="a.png"></span> <img src="b.png"> </a>',
        );

        expect(markLinksShowingTheirUrl(html)).toBe(
            page(
                '<a data-exe-image-link href="https://cc.org"><img src="by.png"></a>' +
                    '<a data-exe-image-link href="https://x.org"> <span><img src="a.png"></span> <img src="b.png"> </a>',
            ),
        );
    });

    it('leaves a link with words beside its picture, whose address print writes after it', () => {
        const html = page('<a href="https://mapa.es">Consulta el mapa <img src="icon.png"></a>');

        expect(markLinksShowingTheirUrl(html)).toBe(html);
    });
});

describe('LINK_URLS_CSS', () => {
    it('writes the address after each link to the web, but not after those marked as needing none', () => {
        expect(LINK_URLS_CSS).toContain('a[href^="http"]::after {\n    content: " [" attr(href) "]";');
        expect(LINK_URLS_CSS).toMatch(
            /a\[href\^="http"\]\[data-exe-text-is-url\]::after,\s*a\[href\^="http"\]\[data-exe-image-link\]::after \{\s*content: none;/,
        );
    });

    it('does not tell a picture-only link by its elements, which would miss the words beside a picture', () => {
        expect(LINK_URLS_CSS).not.toContain(':only-child');
    });
});

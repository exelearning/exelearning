import { describe, expect, it } from 'bun:test';
import { markLinksShowingTheirUrl } from './linkUrls';

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
});

import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableCard, WorksheetModel } from './types';

function modelWith(cards: PrintableCard[]): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [
                    {
                        ideviceType: 'select-media-files',
                        title: 'Select multimedia',
                        items: [{ prompt: '¿Cuáles son carnívoros?', answer: { kind: 'mediaOptions', cards } }],
                    },
                ],
            },
        ],
        unsupported: [],
    };
}

/** The document without its stylesheet, so a class name found is one that was drawn. */
function render(cards: PrintableCard[]): string {
    const html = renderWorksheet(modelWith(cards), {});

    return html.slice(html.indexOf('<body>'));
}

const picture: PrintableCard = { media: { kind: 'image', src: 'pato.png', alt: 'Un pato' }, text: 'Pato' };

describe('renderWorksheet with pictures to choose between', () => {
    it('gives each option a box beside its picture', () => {
        const body = render([picture]);

        expect(body).toContain('<span class="worksheet-media-option-box"></span>');
        expect(body).toContain('<img src="pato.png" alt="Un pato" />');
        // The box and the picture share a line; the words come after them.
        expect(body.indexOf('worksheet-media-option-box')).toBeLessThan(body.indexOf('pato.png'));
    });

    it('puts the card own words under the picture they belong to', () => {
        const body = render([picture]);

        expect(body).toContain('<span class="worksheet-media-option-text">Pato</span>');
        expect(body.indexOf('pato.png')).toBeLessThan(body.indexOf('worksheet-media-option-text'));
    });

    it('lays them out as one list, so they run across the sheet and wrap', () => {
        const body = render([picture, picture, picture]);

        expect(body).toContain('<ul class="worksheet-media-options">');
        expect(body.match(/class="worksheet-media-option"/g)).toHaveLength(3);
    });

    it('draws an option that is only a picture, and one that is only words', () => {
        const body = render([{ media: { kind: 'image', src: 'solo.png' } }, { text: 'Sólo texto' }]);

        expect(body).toContain('<img src="solo.png" alt="" />');
        expect(body).toContain('<span class="worksheet-media-option-text">Sólo texto</span>');
        // Both still get a box: either can be the one to choose.
        expect(body.match(/worksheet-media-option-box/g)).toHaveLength(2);
    });

    it('draws the author colour as an outline rather than a fill', () => {
        const body = render([{ ...picture, accentColor: '#a40000', textColor: '#333333' }]);

        expect(body).toContain('class="worksheet-media-option worksheet-media-option-marked"');
        expect(body).toContain('style="border-color: #a40000"');
        expect(body).toContain('<span class="worksheet-media-option-text" style="color: #333333">Pato</span>');
    });

    it('leaves an unmarked option without a border', () => {
        expect(render([picture])).toContain('<li class="worksheet-media-option">');
    });

    it('escapes what goes into a picture source and its description', () => {
        const body = render([{ media: { kind: 'image', src: 'a"b.png', alt: 'x"y' } }]);

        expect(body).toContain('src="a&quot;b.png"');
        expect(body).toContain('alt="x&quot;y"');
    });
});

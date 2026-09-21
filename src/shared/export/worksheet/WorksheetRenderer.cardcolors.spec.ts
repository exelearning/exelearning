import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableCard, WorksheetModel } from './types';

function modelWith(left: PrintableCard[], right: PrintableCard[] = [{ text: 'Horse' }]): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [
                    {
                        ideviceType: 'relate',
                        title: 'Relate',
                        board: { kind: 'pairColumns', groups: [{ left, right }] },
                        items: [],
                    },
                ],
            },
        ],
        unsupported: [],
    };
}

/** The document without its stylesheet, so a colour found is one that was drawn. */
function render(left: PrintableCard[], right?: PrintableCard[]): string {
    const html = renderWorksheet(modelWith(left, right));

    return html.slice(html.indexOf('<body>'));
}

describe('renderWorksheet with coloured cards', () => {
    it('draws the card plainly when the author coloured nothing', () => {
        const body = render([{ text: 'El caballo' }]);

        expect(body).toContain('<li class="worksheet-card"><span class="worksheet-card-text">El caballo</span></li>');
        expect(body).not.toContain('worksheet-card-band');
    });

    it('marks a coloured card with a band across its top', () => {
        const body = render([{ text: 'El caballo', accentColor: '#ffd95c' }]);

        expect(body).toContain('<span class="worksheet-card-band" style="background: #ffd95c"></span>');
    });

    it('opens the card with the band, above the picture and the words', () => {
        const body = render([
            { text: 'El caballo', media: { kind: 'image', src: 'files/a.png' }, accentColor: '#ffd95c' },
        ]);
        const card = body.slice(body.indexOf('worksheet-card-band'));

        expect(card.indexOf('<img')).toBeLessThan(card.indexOf('worksheet-card-text'));
    });

    it('outlines the card in its own colour when that colour can be seen', () => {
        const body = render([{ text: 'El caballo', accentColor: '#0d5aa7' }]);

        expect(body).toContain('<li class="worksheet-card worksheet-card-marked" style="border-color: #0d5aa7">');
    });

    it('keeps a black outline when the colour is too pale to be one', () => {
        // The band still shows the colour; the edge stays visible, which is what separates one
        // answer from the next.
        const body = render([{ text: 'El caballo', accentColor: '#fff9c4' }]);

        expect(body).toContain('<li class="worksheet-card worksheet-card-marked" style="border-color: #1a1a1a">');
        expect(body).toContain('style="background: #fff9c4"');
    });

    it('writes the words in the colour the author chose', () => {
        const body = render([{ text: 'El caballo', textColor: '#a30000' }]);

        expect(body).toContain('<span class="worksheet-card-text" style="color: #a30000">El caballo</span>');
    });

    it('colours each column on its own', () => {
        const body = render(
            [{ text: 'El caballo', accentColor: '#0d5aa7' }],
            [{ text: 'Horse', accentColor: '#a30000' }],
        );

        expect(body).toContain('style="background: #0d5aa7"');
        expect(body).toContain('style="background: #a30000"');
    });

    it('never fills the card, whatever the author chose', () => {
        // A filled card is a block of toner on every copy of a class set, and it puts the words on
        // a background picked for a backlit screen.
        const body = render([{ text: 'El caballo', accentColor: '#0d5aa7', textColor: '#ffffff' }]);
        const card = body.slice(body.indexOf('<li class="worksheet-card"'));

        expect(card.slice(0, card.indexOf('</li>'))).not.toContain('background-color');
    });
});

import { describe, expect, it } from 'bun:test';
import { columnGap, renderWorksheet } from './WorksheetRenderer';
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
                        board: { kind: 'groupColumns', groups: [{ columns: [left, right] }] },
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

describe('columnGap', () => {
    it('gives two columns a generous channel to draw lines in', () => {
        expect(columnGap(2)).toBe(30);
    });

    it('closes the gap as the columns multiply, so a quartet still fits the sheet', () => {
        // 34mm a card against 170mm of measure: four columns leave 34mm of air in total.
        expect(columnGap(3)).toBe(30);
        expect(columnGap(4)).toBeCloseTo(11.3, 1);
    });

    it('never lets a row run past the printable measure', () => {
        for (const columns of [2, 3, 4]) {
            expect(columns * 34 + (columns - 1) * columnGap(columns)).toBeLessThanOrEqual(170);
        }
    });

    it('gives a single column nothing to space', () => {
        expect(columnGap(1)).toBe(0);
        expect(columnGap(0)).toBe(0);
    });
});

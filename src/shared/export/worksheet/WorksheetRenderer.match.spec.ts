import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableCard, PrintableContainer, WorksheetModel } from './types';

function modelWith(cards: PrintableCard[], containers: PrintableContainer[]): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [
                    {
                        ideviceType: 'classify',
                        title: 'Classify',
                        board: { kind: 'matchColumns', cards, containers },
                        items: [],
                    },
                ],
            },
        ],
        unsupported: [],
    };
}

const CONTAINERS: PrintableContainer[] = [
    { name: 'Mamíferos', color: '#c0392b' },
    { name: 'Aves', color: '#2980b9' },
];

describe('renderWorksheet with matching columns', () => {
    it('draws a card per card and a container per container', () => {
        const html = renderWorksheet(modelWith([{ text: 'Perro' }, { text: 'Águila' }], CONTAINERS));

        expect(html.match(/class="worksheet-card"/g)).toHaveLength(2);
        expect(html.match(/class="worksheet-container"/g)).toHaveLength(2);
    });

    it('puts the cards on the left and the containers on the right', () => {
        const html = renderWorksheet(modelWith([{ text: 'Perro' }], CONTAINERS));
        const body = html.slice(html.indexOf('<body>'));

        expect(body).toContain('<div class="worksheet-match">');
        expect(body.indexOf('worksheet-cards')).toBeLessThan(body.indexOf('worksheet-containers'));
    });

    it('outlines each container in its colour, with the name inside', () => {
        const html = renderWorksheet(modelWith([{ text: 'Perro' }], CONTAINERS));

        // Outline, not fill: a solid block eats ink and buries the name.
        expect(html).toContain('<li class="worksheet-container" style="border-color: #c0392b">Mamíferos</li>');
        expect(html).not.toContain('style="background: #c0392b"');
    });

    it('escapes a container name rather than letting it become markup', () => {
        const html = renderWorksheet(modelWith([{ text: 'x' }], [{ name: '<b>A</b>', color: '#000' }]));

        expect(html).toContain('&lt;b&gt;A&lt;/b&gt;');
    });

    it('draws a picture card', () => {
        const html = renderWorksheet(
            modelWith([{ media: { kind: 'image', src: 'dog.png', alt: 'Un perro' } }], CONTAINERS),
        );

        expect(html).toContain('<img src="dog.png" alt="Un perro" />');
    });

    it('puts the text of a card below its picture', () => {
        const html = renderWorksheet(
            modelWith([{ text: 'Perro', media: { kind: 'image', src: 'dog.png' } }], CONTAINERS),
        );

        expect(html).toContain(
            '<li class="worksheet-card"><img src="dog.png" alt="" /><span class="worksheet-card-text">Perro</span></li>',
        );
    });

    it('prints no question list when the exercise is the columns', () => {
        const html = renderWorksheet(modelWith([{ text: 'Perro' }], CONTAINERS));
        const body = html.slice(html.indexOf('<body>'));

        expect(body).not.toContain('<ol class="worksheet-items');
    });
});

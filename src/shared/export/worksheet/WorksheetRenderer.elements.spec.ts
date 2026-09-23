import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { PrintableElementCard, WorksheetModel } from './types';

function card(overrides: Partial<PrintableElementCard> = {}): PrintableElementCard {
    return {
        groupLabel: 'Grupo',
        group: 'Metal alcalino',
        number: '3',
        symbol: 'Li',
        name: 'Litio',
        asks: 'Símbolo',
        mass: '6.941',
        electronegativity: '0.98',
        oxidation: ['+1'],
        configuration: '1s2 2s1',
        ...overrides,
    };
}

function modelWith(cards: PrintableElementCard[]): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [
            {
                pageId: 'p1',
                title: 'Página',
                activities: [
                    {
                        ideviceType: 'periodic-table',
                        title: 'Periodic table',
                        board: { kind: 'elementCards', cards },
                        items: [],
                    },
                ],
            },
        ],
        unsupported: [],
    };
}

/** The document without its stylesheet, so a class name found is one that was drawn. */
function render(cards: PrintableElementCard[]): string {
    const html = renderWorksheet(modelWith(cards), {});

    return html.slice(html.indexOf('<body>'));
}

describe('renderWorksheet with element cards', () => {
    it('lays them out as one list, so they run across the sheet and wrap', () => {
        const body = render([card(), card(), card()]);

        expect(body).toContain('<ul class="worksheet-element-cards">');
        expect(body.match(/class="worksheet-element-card"/g)).toHaveLength(3);
    });

    it('labels the group, which is the only labelled row on the activity own card', () => {
        expect(render([card()])).toContain('<span class="worksheet-element-group">Grupo: Metal alcalino</span>');
    });

    it('draws the chemistry in the order the activity draws it', () => {
        const body = render([card()]);
        const order = [
            'element-number',
            'element-symbol',
            'element-name',
            'element-mass',
            'element-negativity',
            'element-oxidation',
            'element-configuration',
        ];
        const positions = order.map(name => body.indexOf(`worksheet-${name}`));

        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(positions.every(position => position > 0)).toBe(true);
    });

    it('gives the field being asked a rule and the activity own word for it', () => {
        const body = render([card({ symbol: null })]);

        expect(body).toContain(
            '<span class="worksheet-element-symbol worksheet-element-ask">' +
                '<span class="worksheet-line"></span><small>Símbolo</small></span>',
        );
        // The other two are printed, being what the student works from.
        expect(body).toContain('<span class="worksheet-element-number">3</span>');
        expect(body).toContain('<span class="worksheet-element-name">Litio</span>');
    });

    it('asks for the number or the name just as readily', () => {
        expect(render([card({ number: null, asks: 'Número' })])).toContain('<small>Número</small>');
        expect(render([card({ name: null, asks: 'Nombre' })])).toContain('<small>Nombre</small>');
    });

    it('draws each oxidation state on its own, as the activity boxes them', () => {
        const body = render([card({ oxidation: ['+4', '-4'] })]);

        expect(body).toContain('<span class="worksheet-element-oxidation"><span>+4</span><span>-4</span></span>');
    });

    it('leaves out a row the activity records nothing for', () => {
        // An empty cell must not read as a measured value.
        const body = render([card({ electronegativity: undefined, oxidation: [] })]);

        expect(body).not.toContain('worksheet-element-negativity');
        expect(body).not.toContain('worksheet-element-oxidation');
    });

    it('escapes what an activity own wording puts on the card', () => {
        const body = render([card({ group: 'Metal <b>alcalino', asks: 'S<b>ímbolo', symbol: null })]);

        expect(body).toContain('Metal &lt;b&gt;alcalino');
        expect(body).toContain('<small>S&lt;b&gt;ímbolo</small>');
    });
});

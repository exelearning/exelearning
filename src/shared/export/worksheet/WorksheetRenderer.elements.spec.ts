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
        color: '#dfa5d2',
        mass: '6.941',
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

    it('labels the group above the card, the only labelled value on the activity own card', () => {
        const body = render([card()]);

        expect(body).toContain('<span class="worksheet-element-group">Grupo: Metal alcalino</span>');
        expect(body.indexOf('worksheet-element-group')).toBeLessThan(body.indexOf('worksheet-element-box'));
    });

    it('paints the card in the colour of its group', () => {
        expect(render([card()])).toContain('<div class="worksheet-element-box" style="background-color:#dfa5d2">');
    });

    it('never lets a colour that is not one into the style attribute', () => {
        const body = render([card({ color: 'red;background-image:url(x)' })]);

        expect(body).toContain('<div class="worksheet-element-box">');
        expect(body).not.toContain('background-image');
    });

    it('draws on the card what the activity card shows, in the order it writes it', () => {
        const body = render([card({ symbol: null })]);
        const box = body.slice(
            body.indexOf('worksheet-element-box'),
            body.indexOf('</div>', body.indexOf('worksheet-element-box')),
        );
        const order = ['number', 'name', 'mass', 'oxidation', 'configuration'];
        const positions = order.map(name => box.indexOf(`worksheet-element-${name}`));

        expect(positions.every(position => position > 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(box).toContain('<span class="worksheet-element-number">3</span>');
        expect(box).toContain('<span class="worksheet-element-name">Litio</span>');
        expect(box).toContain('<span class="worksheet-element-mass">6.941</span>');
        expect(box).toContain('<span class="worksheet-element-configuration">1s2 2s1</span>');
    });

    it('leaves a gap on the card where the value asked for goes, and nothing to write on outside it', () => {
        const body = render([card({ symbol: null })]);

        expect(body).not.toContain('worksheet-element-symbol');
        // The card closes the entry: the student writes on the card itself.
        expect(body).toContain('</div></li>');
        expect(body).not.toContain('worksheet-line');
    });

    it.each([
        ['number', { number: null }],
        ['name', { name: null }],
    ] as const)('leaves the %s out just as readily', (field, overrides) => {
        const body = render([card(overrides)]);

        expect(body).not.toContain(`worksheet-element-${field}"`);
        expect(body).toContain('<span class="worksheet-element-symbol">Li</span>');
    });

    it('leaves several out at once, as the activity does when cards are completed', () => {
        const body = render([card({ number: null, name: null, configuration: null })]);

        for (const field of ['number', 'name', 'configuration'])
            expect(body).not.toContain(`worksheet-element-${field}"`);
        expect(body).toContain('<span class="worksheet-element-symbol">Li</span>');
        expect(body).toContain('<span class="worksheet-element-mass">6.941</span>');
    });

    it('gives the group a line after its label when it is asked, being above the card', () => {
        const body = render([card({ group: null })]);

        expect(body).toContain(
            '<span class="worksheet-element-group">Grupo: <span class="worksheet-element-group-blank"></span></span>',
        );
        expect(body).not.toContain('Metal alcalino');
    });

    it('stacks each oxidation state on its own, as the activity does', () => {
        const body = render([card({ oxidation: ['+4', '-4'] })]);

        expect(body).toContain('<span class="worksheet-element-oxidation"><span>+4</span><span>-4</span></span>');
    });

    it('leaves out the oxidation states where the activity records none', () => {
        expect(render([card({ oxidation: [] })])).not.toContain('worksheet-element-oxidation');
    });

    it('prints the colour rather than letting the browser drop it', () => {
        const html = renderWorksheet(modelWith([card()]), {});

        expect(html).toMatch(/\.worksheet-element-box \{[^}]*print-color-adjust: exact;/);
    });

    it('escapes what an activity own wording puts on the card', () => {
        const body = render([card({ group: 'Metal <b>alcalino', name: 'Li<i>tio' })]);

        expect(body).toContain('Metal &lt;b&gt;alcalino');
        expect(body).toContain('Li&lt;i&gt;tio');
    });
});

import { describe, expect, it } from 'bun:test';
import { renderWorksheet } from './WorksheetRenderer';
import type { CrosswordCell, PrintableActivity, WorksheetModel } from './types';

/** Build a grid from text: '.' is a gap, '_' an empty box, a letter a hint. */
function gridFrom(...rows: string[]): CrosswordCell[][] {
    return rows.map(row =>
        [...row].map<CrosswordCell>(character => {
            if (character === '.') return null;
            return { letter: character === '_' ? null : character };
        }),
    );
}

function crosswordActivity(overrides: Partial<PrintableActivity> = {}): PrintableActivity {
    return {
        ideviceType: 'crossword',
        title: 'Crossword',
        board: { kind: 'crosswordGrid', rows: gridFrom('C__', '.A.', '.S.') },
        items: [
            { prompt: 'Vivienda', number: 1 },
            { prompt: 'Estancia', number: 2 },
        ],
        ...overrides,
    };
}

function modelWith(activity: PrintableActivity): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [{ pageId: 'p1', title: 'Página', activities: [activity] }],
        unsupported: [],
    };
}

describe('renderWorksheet with a crossword board', () => {
    it('draws a cell per playable square and a gap per blocked one', () => {
        const html = renderWorksheet(modelWith(crosswordActivity()));

        expect(html.match(/class="worksheet-grid-cell"/g)).toHaveLength(5);
        expect(html.match(/class="worksheet-grid-gap"/g)).toHaveLength(4);
    });

    it('gives a bare board a fixed cell size', () => {
        const html = renderWorksheet(modelWith(crosswordActivity()));

        // Cropped to the words, so sharing the page width out would blow the cells up.
        expect(html).toContain('grid-template-columns: repeat(3, 9mm);');
    });

    it('shares the picture out between the tracks of a backed board', () => {
        const html = renderWorksheet(
            modelWith(
                crosswordActivity({
                    board: {
                        kind: 'crosswordGrid',
                        rows: gridFrom('C__', '.A.', '.S.'),
                        background: { src: 'a.png' },
                    },
                }),
            ),
        );

        // Full-size board, so every cell stays over the part of the picture it belongs to.
        expect(html).toContain('grid-template-columns: repeat(3, 1fr);');
    });

    describe('background picture', () => {
        it('draws the picture behind the board', () => {
            const html = renderWorksheet(
                modelWith(
                    crosswordActivity({
                        board: {
                            kind: 'crosswordGrid',
                            rows: gridFrom('C__', '.A.', '.S.'),
                            background: { src: 'blob:http://localhost/animals' },
                        },
                    }),
                ),
            );

            expect(html).toContain('<div class="worksheet-grid-frame">');
            // An <img>, not a CSS background: browsers omit background graphics from printouts.
            expect(html).toContain(
                '<img class="worksheet-grid-background" src="blob:http://localhost/animals" alt="" />',
            );
        });

        it('credits the picture when the activity names an author', () => {
            const html = renderWorksheet(
                modelWith(
                    crosswordActivity({
                        board: {
                            kind: 'crosswordGrid',
                            rows: gridFrom('C__'),
                            background: { src: 'a.png', author: 'INTEF' },
                        },
                    }),
                ),
            );

            expect(html).toContain('<p class="worksheet-grid-credit">INTEF</p>');
        });

        it('keeps a hostile picture source inside its attribute', () => {
            const html = renderWorksheet(
                modelWith(
                    crosswordActivity({
                        board: {
                            kind: 'crosswordGrid',
                            rows: gridFrom('C__'),
                            background: { src: 'a.png"); background: red; --x: url("' },
                        },
                    }),
                ),
            );

            // The payload is a CSS injection: it only bites in a style attribute, which the
            // browser entity-decodes before parsing the CSS. Rendering the picture as an img src
            // defuses it, since there escaping the quotes is enough to contain it.
            expect(html).toContain('src="a.png&quot;); background: red; --x: url(&quot;" alt=""');
            expect(html).not.toMatch(/style="[^"]*background/);
            expect(html.match(/<img class="worksheet-grid-background"/g)).toHaveLength(1);
        });

        it('leaves the board plain when there is no picture', () => {
            const html = renderWorksheet(modelWith(crosswordActivity()));

            // Matched on the markup: the class names also appear in the inlined stylesheet.
            expect(html).not.toContain('<div class="worksheet-grid-frame">');
            expect(html).not.toContain('<img class="worksheet-grid-background"');
            expect(html).not.toContain('<p class="worksheet-grid-credit">');
        });
    });

    it('renders nothing for a board with no columns', () => {
        const html = renderWorksheet(modelWith(crosswordActivity({ board: { kind: 'crosswordGrid', rows: [] } })));
        const body = html.slice(html.indexOf('<body>'));

        expect(body).not.toContain('worksheet-grid"');
    });

    it('puts the grid above the clues', () => {
        const html = renderWorksheet(modelWith(crosswordActivity()));
        // Measured on the body: the class names also appear in the inlined stylesheet.
        const body = html.slice(html.indexOf('<body>'));

        expect(body.indexOf('worksheet-grid"')).toBeLessThan(body.indexOf('worksheet-items'));
    });

    it('prints the letters it is given and leaves the rest empty', () => {
        const html = renderWorksheet(modelWith(crosswordActivity()));

        expect(html).toContain('<span class="worksheet-grid-cell">C</span>');
        expect(html.match(/<span class="worksheet-grid-cell"><\/span>/g)).toHaveLength(2);
    });

    it('prints the clue number in the cell a word starts in', () => {
        const rows = gridFrom('C_', '._');
        rows[0][0] = { letter: 'C', number: 1 };
        const html = renderWorksheet(modelWith(crosswordActivity({ board: { kind: 'crosswordGrid', rows } })));

        expect(html).toContain('<span class="worksheet-grid-number">1</span>C');
    });

    it('numbers the clues explicitly so they match the grid', () => {
        const html = renderWorksheet(modelWith(crosswordActivity()));

        expect(html).toContain('<li class="worksheet-item" value="1">');
        expect(html).toContain('<li class="worksheet-item" value="2">');
    });

    it('escapes a letter that would otherwise be markup', () => {
        const html = renderWorksheet(
            modelWith(crosswordActivity({ board: { kind: 'crosswordGrid', rows: gridFrom('<_') } })),
        );

        expect(html).toContain('>&lt;</span>');
    });

    it('renders a clue illustration small', () => {
        const html = renderWorksheet(
            modelWith(
                crosswordActivity({
                    items: [{ prompt: 'Vivienda', number: 1, media: { kind: 'image', src: 'a.png', size: 'small' } }],
                }),
            ),
        );

        expect(html).toContain('<figure class="worksheet-media worksheet-media-small">');
    });

    it('renders a normal picture without the small modifier', () => {
        const html = renderWorksheet(
            modelWith(
                crosswordActivity({
                    items: [{ prompt: 'Vivienda', number: 1, media: { kind: 'image', src: 'a.png' } }],
                }),
            ),
        );

        expect(html).toContain('<figure class="worksheet-media">');
    });

    it('omits the board when an activity has none', () => {
        const html = renderWorksheet(modelWith(crosswordActivity({ board: undefined })));
        const body = html.slice(html.indexOf('<body>'));

        expect(body).not.toContain('worksheet-grid"');
    });
});

describe('renderWorksheet with crossword clues by direction', () => {
    const clues = crosswordActivity({
        items: [
            { prompt: 'Nutria', number: 3, direction: 'down' },
            { prompt: 'Tortuga', number: 4, direction: 'across' },
            { prompt: 'Tigre', number: 1, direction: 'down' },
            { prompt: 'Cabra', number: 2, direction: 'across' },
        ],
    });

    function bodyOf(activity: PrintableActivity): string {
        const html = renderWorksheet(modelWith(activity), { across: 'Horizontal', down: 'Vertical' });

        return html.slice(html.indexOf('<body>'));
    }

    it('sets them in two columns, across on the left and down on the right', () => {
        const body = bodyOf(clues);

        expect(body.match(/class="worksheet-clue-column"/g)).toHaveLength(2);
        expect(body.indexOf('>Horizontal</h4>')).toBeLessThan(body.indexOf('>Vertical</h4>'));
        expect(body.indexOf('Cabra')).toBeLessThan(body.indexOf('>Vertical</h4>'));
        expect(body.indexOf('Tigre')).toBeGreaterThan(body.indexOf('>Vertical</h4>'));
    });

    it('keeps each clue its grid number and runs each column in number order', () => {
        const body = bodyOf(clues);

        expect(body.indexOf('value="2"')).toBeLessThan(body.indexOf('value="4"'));
        expect(body.indexOf('value="1"')).toBeLessThan(body.indexOf('value="3"'));
        expect(body).toContain('<li class="worksheet-item" value="1"><div class="worksheet-prompt">Tigre</div>');
    });

    it('names the direction once, in the heading, rather than on every clue', () => {
        const body = bodyOf(clues);

        expect(body.match(/Horizontal/g)).toHaveLength(1);
        expect(body.match(/Vertical/g)).toHaveLength(1);
    });

    it('takes the whole width with one column when every word runs one way', () => {
        const body = bodyOf(crosswordActivity({ items: [{ prompt: 'Tigre', number: 1, direction: 'down' }] }));

        expect(body.match(/class="worksheet-clue-column"/g)).toHaveLength(1);
        expect(body).not.toContain('Horizontal');
    });

    it('lists clues with no direction as before', () => {
        const body = bodyOf(crosswordActivity());

        expect(body).not.toContain('worksheet-clue-columns');
        expect(body).toContain('<ol class="worksheet-items">');
    });

    it('divides the columns with a faint rule and prints the grid numbers large enough to read', () => {
        const html = renderWorksheet(modelWith(clues));

        expect(html).toMatch(/\.worksheet-clue-column \+ \.worksheet-clue-column \{[^}]*border-left: 1px solid #ccc;/);
        expect(html).toMatch(/\.worksheet-grid-number \{[^}]*font-size: 9pt;/);
    });
});

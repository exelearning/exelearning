import { describe, expect, it } from 'bun:test';
import { WORKSHEET_ACTIVITY_STYLES, renderActivityFragment, renderWorksheet } from './WorksheetRenderer';
import type { CharacterBoxGroup, PrintableActivity, WorksheetModel } from './types';

/** Boxes with nothing given away: one group per size. */
function emptyBoxes(...sizes: number[]): CharacterBoxGroup[] {
    return sizes.map(size => Array.from({ length: size }, () => null));
}

/** Boxes spelling the given words, with '.' marking a box left empty. */
function boxesFor(...words: string[]): CharacterBoxGroup[] {
    return words.map(word => [...word].map(character => (character === '.' ? null : character)));
}

function activity(overrides: Partial<PrintableActivity> = {}): PrintableActivity {
    return {
        ideviceType: 'guess',
        title: 'Guess',
        items: [{ prompt: 'Ciudad conquistada', answer: { kind: 'characterBoxes', groups: emptyBoxes(8) } }],
        ...overrides,
    };
}

function model(overrides: Partial<WorksheetModel> = {}): WorksheetModel {
    return {
        projectTitle: 'Un héroe medieval',
        language: 'es',
        pages: [{ pageId: 'p1', title: 'El Poema de Mio Cid', activities: [activity()] }],
        unsupported: [],
        ...overrides,
    };
}

describe('renderWorksheet', () => {
    it('produces a standalone document with the project title and language', () => {
        const html = renderWorksheet(model());

        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html).toContain('<html lang="es">');
        expect(html).toContain('<title>Un héroe medieval</title>');
        expect(html).toContain('<style>');
        expect(html.trimEnd().endsWith('</html>')).toBe(true);
    });

    it('falls back to english when the project declares no language', () => {
        expect(renderWorksheet(model({ language: '' }))).toContain('<html lang="en">');
    });

    it('marks each activity with the iDevice it came from', () => {
        const html = renderWorksheet(model());

        expect(html).toContain('<article class="worksheet-activity" data-idevice="guess">');
    });

    it('groups activities under their page title', () => {
        const html = renderWorksheet(model());

        expect(html).toContain('<h2 class="worksheet-page-title">El Poema de Mio Cid</h2>');
        expect(html).toContain('<h3 class="worksheet-activity-title">Guess</h3>');
    });

    it('skips pages that hold no activities', () => {
        const html = renderWorksheet(
            model({
                pages: [
                    { pageId: 'p1', title: 'Con actividad', activities: [activity()] },
                    { pageId: 'p2', title: 'Vacía', activities: [] },
                ],
            }),
        );

        expect(html).toContain('Con actividad');
        expect(html).not.toContain('Vacía');
    });

    it('numbers questions through an ordered list', () => {
        const html = renderWorksheet(
            model({
                pages: [
                    {
                        pageId: 'p1',
                        title: 'Página',
                        activities: [
                            activity({
                                items: [
                                    { prompt: 'Primera', answer: { kind: 'characterBoxes', groups: emptyBoxes(3) } },
                                    { prompt: 'Segunda', answer: { kind: 'characterBoxes', groups: emptyBoxes(4) } },
                                ],
                            }),
                        ],
                    },
                ],
            }),
        );

        expect(html).toContain('<ol class="worksheet-items">');
        expect(html.match(/class="worksheet-item"/g)).toHaveLength(2);
    });

    describe('answer boxes', () => {
        it('draws one box per character', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    items: [{ prompt: 'x', answer: { kind: 'characterBoxes', groups: emptyBoxes(3) } }],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html.match(/class="worksheet-box"/g)).toHaveLength(3);
        });

        it('draws a separate block per word of the solution', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    items: [
                                        { prompt: 'x', answer: { kind: 'characterBoxes', groups: emptyBoxes(3, 3) } },
                                    ],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html.match(/class="worksheet-box-group"/g)).toHaveLength(2);
            expect(html.match(/class="worksheet-box"/g)).toHaveLength(6);
        });

        it('prints the letters the activity gives away and leaves the rest blank', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    items: [
                                        {
                                            prompt: 'x',
                                            answer: { kind: 'characterBoxes', groups: boxesFor('M..', '..D') },
                                        },
                                    ],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html).toContain('<span class="worksheet-box worksheet-box-filled">M</span>');
            expect(html).toContain('<span class="worksheet-box worksheet-box-filled">D</span>');
            // Four of the six boxes stay empty for the student.
            expect(html.match(/<span class="worksheet-box"><\/span>/g)).toHaveLength(4);
            // Matched on the markup, since the class name also appears in the inlined stylesheet.
            expect(html.match(/<span class="worksheet-box worksheet-box-filled">/g)).toHaveLength(2);
        });

        it('escapes a revealed character instead of letting it become markup', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    items: [{ prompt: 'x', answer: { kind: 'characterBoxes', groups: [['<', null]] } }],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html).toContain('>&lt;</span>');
        });

        it('keeps accented letters intact when revealed', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    items: [
                                        { prompt: 'x', answer: { kind: 'characterBoxes', groups: boxesFor('Ñ.É') } },
                                    ],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html).toContain('>Ñ</span>');
            expect(html).toContain('>É</span>');
        });

        it('omits the answer space for questions answered on a shared board', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [activity({ items: [{ prompt: 'Vivienda', number: 1 }] })],
                        },
                    ],
                }),
            );

            expect(html).toContain('<div class="worksheet-prompt">Vivienda</div>');
            expect(html).not.toContain('<div class="worksheet-answer">');
        });

        it('throws for answer kinds that have no renderer yet', () => {
            const broken = model({
                pages: [
                    {
                        pageId: 'p1',
                        title: 'Página',
                        activities: [activity({ items: [{ prompt: 'x', answer: { kind: 'lines', count: 3 } }] })],
                    },
                ],
            });

            expect(() => renderWorksheet(broken)).toThrow('not implemented yet');
        });
    });

    describe('optional parts', () => {
        it('renders instructions, pictures, extra text and closing text', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    instructions: '<p>Observe las letras</p>',
                                    textAfter: '<p>El Cantar</p>',
                                    items: [
                                        {
                                            prompt: 'Arma',
                                            media: {
                                                kind: 'image',
                                                src: 'blob:http://x/a',
                                                alt: 'Tizona',
                                                author: 'INTEF',
                                            },
                                            extraText: '<p>Lee esto</p>',
                                            answer: { kind: 'characterBoxes', groups: emptyBoxes(6) },
                                        },
                                    ],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html).toContain('<p>Observe las letras</p>');
            expect(html).toContain('<img src="blob:http://x/a" alt="Tizona" />');
            expect(html).toContain('<figcaption>INTEF</figcaption>');
            expect(html).toContain('<p>Lee esto</p>');
            expect(html).toContain('<p>El Cantar</p>');
        });

        it('omits the optional parts when they are absent', () => {
            const html = renderWorksheet(model());

            // Asserted on the markup rather than the bare class name, which also appears in the
            // inlined stylesheet.
            expect(html).not.toContain('<div class="worksheet-instructions">');
            expect(html).not.toContain('<figure class="worksheet-media">');
            expect(html).not.toContain('<div class="worksheet-extra">');
            expect(html).not.toContain('<div class="worksheet-after">');
        });

        it('renders an empty alt when a picture has no description', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    items: [
                                        {
                                            prompt: 'x',
                                            media: { kind: 'image', src: 'a.png' },
                                            answer: { kind: 'characterBoxes', groups: emptyBoxes(1) },
                                        },
                                    ],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html).toContain('<img src="a.png" alt="" />');
        });
    });

    describe('nothing to print', () => {
        it('explains itself instead of rendering a blank sheet', () => {
            const html = renderWorksheet(model({ pages: [] }));

            expect(html).toContain('worksheet-empty');
            expect(html).toContain('This project has no printable activities yet.');
        });

        it('lists activities that have no adapter yet', () => {
            const html = renderWorksheet(
                model({ unsupported: [{ ideviceType: 'crossword', pageTitle: 'La Edad Media' }] }),
            );

            expect(html).toContain('Activities that cannot be printed yet');
            expect(html).toContain('crossword — La Edad Media');
        });

        it('omits the unsupported note when everything was printable', () => {
            expect(renderWorksheet(model())).not.toContain('<aside class="worksheet-unsupported">');
        });
    });

    describe('translated labels', () => {
        it('uses the supplied strings', () => {
            const html = renderWorksheet(model({ pages: [] }), {
                studentName: 'Nombre',
                date: 'Fecha',
                empty: 'Sin actividades imprimibles.',
            });

            expect(html).toContain('Nombre:');
            expect(html).toContain('Fecha:');
            expect(html).toContain('Sin actividades imprimibles.');
        });

        it('falls back to english for the strings not supplied', () => {
            const html = renderWorksheet(model(), { studentName: 'Nombre' });

            expect(html).toContain('Nombre:');
            expect(html).toContain('Date:');
        });
    });

    describe('escaping', () => {
        it('escapes titles rather than letting them inject markup', () => {
            const html = renderWorksheet(
                model({
                    projectTitle: '<script>alert(1)</script>',
                    pages: [{ pageId: 'p1', title: '<b>Page</b>', activities: [activity({ title: '<i>Act</i>' })] }],
                }),
            );

            expect(html).not.toContain('<script>alert(1)</script>');
            expect(html).toContain('&lt;script&gt;');
            expect(html).toContain('&lt;b&gt;Page&lt;/b&gt;');
            expect(html).toContain('&lt;i&gt;Act&lt;/i&gt;');
        });

        it('escapes image sources and captions', () => {
            const html = renderWorksheet(
                model({
                    pages: [
                        {
                            pageId: 'p1',
                            title: 'Página',
                            activities: [
                                activity({
                                    items: [
                                        {
                                            prompt: 'x',
                                            media: { kind: 'image', src: 'a.png" onerror="alert(1)', alt: 'b"c' },
                                            answer: { kind: 'characterBoxes', groups: emptyBoxes(1) },
                                        },
                                    ],
                                }),
                            ],
                        },
                    ],
                }),
            );

            expect(html).not.toContain('onerror="alert(1)"');
            expect(html).toContain('&quot;');
        });
    });
});

describe('renderActivityFragment', () => {
    it('renders the activity without a document around it', () => {
        const html = renderActivityFragment(activity());

        expect(html.startsWith('<article class="worksheet-activity"')).toBe(true);
        expect(html.endsWith('</article>')).toBe(true);
        expect(html).not.toContain('<!DOCTYPE');
        expect(html).not.toContain('<html');
        expect(html).not.toContain('<style');
        expect(html).not.toContain('<div class="worksheet">');
    });

    it('renders the same markup the worksheet document uses', () => {
        // The two paths must not drift: a fix to one has to reach the other.
        expect(renderWorksheet(model())).toContain(renderActivityFragment(activity()));
    });

    it('uses the labels it is given', () => {
        const html = renderActivityFragment(
            activity({
                ideviceType: 'crossword',
                items: [{ prompt: 'Ciudad', direction: 'across', number: 1 }],
            }),
            { across: 'Horizontal' },
        );

        expect(html).toContain('Horizontal');
        expect(html).not.toContain('Across');
    });

    it('falls back to the english labels when given none', () => {
        const html = renderActivityFragment(
            activity({ ideviceType: 'crossword', items: [{ prompt: 'Ciudad', direction: 'down', number: 1 }] }),
        );

        expect(html).toContain('Down');
    });
});

describe('WORKSHEET_ACTIVITY_STYLES', () => {
    // The fragment is injected into a document this renderer did not build, so a rule reaching
    // outside the activity would restyle the user's own content.
    it('touches nothing the host document owns', () => {
        expect(WORKSHEET_ACTIVITY_STYLES).not.toContain('@page');
        expect(WORKSHEET_ACTIVITY_STYLES).not.toMatch(/(^|\})\s*body\s*\{/);
        expect(WORKSHEET_ACTIVITY_STYLES).not.toMatch(/(^|\})\s*\*\s*\{/);
        expect(WORKSHEET_ACTIVITY_STYLES).not.toMatch(/(^|\})\s*\.worksheet\s*\{/);
    });

    it('carries the rules the fragment relies on', () => {
        for (const rule of ['.worksheet-activity', '.worksheet-box', '.worksheet-grid-cell', '.worksheet-gap'])
            expect(WORKSHEET_ACTIVITY_STYLES).toContain(`${rule} {`);
    });

    it('is part of the worksheet document, so the two never diverge', () => {
        expect(renderWorksheet(model())).toContain(WORKSHEET_ACTIVITY_STYLES);
    });

    describe('the two-column boards', () => {
        /** The declarations of one rule, by property. */
        const rule = (selector: string) => {
            const body = WORKSHEET_ACTIVITY_STYLES.split(`${selector} {`)[1].split('}')[0];
            return Object.fromEntries(
                body
                    .split(';')
                    .map(line => line.split(':').map(part => part.trim()))
                    .filter(parts => parts.length === 2),
            );
        };

        it('gives a card the same width as the box it faces', () => {
            // A card holding a word and one holding a picture are the same size, so a column of
            // words does not straggle beside a column of pictures.
            expect(rule('.worksheet-card').width).toBe(rule('.worksheet-container').width);
            expect(rule('.worksheet-card')['min-height']).toBe(rule('.worksheet-container').height);
        });

        it('lets a card grow rather than clipping what the author wrote', () => {
            const card = rule('.worksheet-card');

            expect(card['min-height']).toBeDefined();
            expect(card.height).toBeUndefined();
            expect(card.overflow).toBeUndefined();
        });

        it('centres the two columns against each other', () => {
            expect(rule('.worksheet-match')['align-items']).toBe('center');
        });
    });
});

describe('pairColumns board', () => {
    const pairs = (left: unknown[], right: unknown[]) =>
        renderActivityFragment(
            activity({
                ideviceType: 'dragdrop',
                title: 'Drag and drop',
                board: { kind: 'pairColumns', left, right } as never,
                items: [],
            }),
        );

    it('draws two columns of cards', () => {
        const html = pairs([{ text: '<p>Perro</p>' }], [{ media: { kind: 'image', src: 'dog.png' } }]);

        expect(html).toContain('<div class="worksheet-match worksheet-pairs">');
        expect(html.match(/<ul class="worksheet-cards">/g)).toHaveLength(2);
        expect(html.match(/<li class="worksheet-card">/g)).toHaveLength(2);
    });

    it('keeps each side in the order the adapter chose', () => {
        const html = pairs([{ text: 'izquierda' }], [{ text: 'derecha' }]);

        expect(html.indexOf('izquierda')).toBeLessThan(html.indexOf('derecha'));
    });

    it('draws a card the same way the matching board does', () => {
        const html = pairs([{ media: { kind: 'image', src: 'dog.png', alt: 'Un perro' }, text: 'Perro' }], []);

        // Picture first, text underneath — one renderer for both boards, so they cannot drift.
        expect(html).toContain('<img src="dog.png" alt="Un perro" />');
        expect(html).toContain('<span class="worksheet-card-text">Perro</span>');
        expect(html.indexOf('<img')).toBeLessThan(html.indexOf('worksheet-card-text'));
    });

    it('escapes a card picture instead of letting it become markup', () => {
        const html = pairs([], [{ media: { kind: 'image', src: 'a.png" onerror="alert(1)', alt: 'b"c' } }]);

        expect(html).not.toContain('onerror="alert(1)"');
        expect(html).toContain('&quot;');
    });

    it('draws an empty column without failing', () => {
        expect(pairs([], [])).toContain('worksheet-pairs');
    });
});

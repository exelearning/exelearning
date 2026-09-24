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
        // The iDevice's own name is not printed: the author's heading already says what it is.
        // Matched on the markup, since the class name also appears in the inlined stylesheet.
        expect(html).not.toContain('<h3 class="worksheet-activity-title">');
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

        it('throws for an answer kind that has no renderer yet', () => {
            // Every kind in the model is rendered today, so this reaches the guard with one that
            // is not. It is there so the next kind added fails loudly rather than printing an
            // answer space with nothing in it.
            const broken = model({
                pages: [
                    {
                        pageId: 'p1',
                        title: 'Página',
                        activities: [
                            activity({ items: [{ prompt: 'x', answer: { kind: 'something-new' } as never }] }),
                        ],
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

        it('says which of them are not waiting for anything', () => {
            // The heading reads as a promise, so an activity that is never getting a printed form
            // has to say so on its own line.
            const html = renderWorksheet(
                model({
                    unsupported: [
                        { ideviceType: 'map', pageTitle: 'Geografía' },
                        { ideviceType: 'trivial', pageTitle: 'Repaso', reason: 'not-printable' },
                    ],
                }),
            );

            expect(html).toContain('map — Geografía</li>');
            expect(html).toContain('trivial — Repaso: Not available in print');
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
            // The activity's own name never reaches the page, escaped or otherwise.
            expect(html).not.toContain('Act');
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
                board: { kind: 'groupColumns', groups: [{ columns: [left, right] }] } as never,
                items: [],
            }),
        );

    it('draws two columns of cards', () => {
        const html = pairs([{ text: '<p>Perro</p>' }], [{ media: { kind: 'image', src: 'dog.png' } }]);

        expect(html).toContain('<div class="worksheet-match worksheet-pairs" style="gap: 30mm">');
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

describe('two-column boards and the page break', () => {
    const cards = (count: number) => Array.from({ length: count }, (_, index) => ({ text: `c${index}` }));

    const matchBoard = (cardCount: number, containerCount: number) =>
        renderActivityFragment(
            activity({
                ideviceType: 'classify',
                board: {
                    kind: 'matchColumns',
                    cards: cards(cardCount),
                    containers: Array.from({ length: containerCount }, (_, index) => ({
                        name: `G${index}`,
                        color: '#000',
                    })),
                } as never,
                items: [],
            }),
        );

    it('splits a long list of cards into blocks', () => {
        // Sixteen cards in one column ran off the sheet, stranding cards on pages with no
        // containers to match them to.
        const html = matchBoard(16, 2);

        expect(html.match(/<div class="worksheet-match">/g)?.length).toBeGreaterThan(1);
    });

    it('repeats the containers beside every block', () => {
        const html = matchBoard(16, 2);
        const blocks = html.match(/<div class="worksheet-match">/g)?.length ?? 0;

        // Any card can go in any container, so each block carries its own copy of all of them.
        expect(html.match(/class="worksheet-container"/g)).toHaveLength(blocks * 2);
    });

    it('keeps a short list in a single block', () => {
        expect(matchBoard(2, 2).match(/<div class="worksheet-match">/g)).toHaveLength(1);
    });

    it.each([2, 3, 4, 5, 6, 7, 8, 9])(
        'keeps every destination beside each group of cards with %i categories',
        count => {
            const html = matchBoard(6, count);
            const blocks = html.split(/<div class="worksheet-match[^"]*">/).slice(1);

            expect(blocks).toHaveLength(2);
            expect(blocks[0].match(/class="worksheet-card"/g)).toHaveLength(5);
            expect(blocks[1].match(/class="worksheet-card"/g)).toHaveLength(1);
            for (const block of blocks) {
                expect(block.match(/class="worksheet-container"/g)).toHaveLength(count);
                for (let index = 0; index < count; index++) expect(block).toContain(`>G${index}</li>`);
            }
            expect(html.includes('worksheet-match-compact')).toBe(count > 5);
        },
    );

    it('compacts nine categories even when there is only one card', () => {
        const html = matchBoard(1, 9);

        expect(html.match(/class="worksheet-match worksheet-match-compact"/g)).toHaveLength(1);
        expect(html.match(/class="worksheet-card"/g)).toHaveLength(1);
        expect(html.match(/class="worksheet-container"/g)).toHaveLength(9);
    });

    it('gives a block to every group of pairs it is handed', () => {
        const html = renderActivityFragment(
            activity({
                ideviceType: 'dragdrop',
                board: {
                    kind: 'groupColumns',
                    groups: [{ columns: [cards(5), cards(5)] }, { columns: [cards(3), cards(3)] }],
                } as never,
                items: [],
            }),
        );

        expect(html.match(/worksheet-pairs/g)).toHaveLength(2);
    });

    it('asks the browser to keep each block on one sheet', () => {
        // Without this the two columns split and a pairing becomes impossible to draw.
        const rule = WORKSHEET_ACTIVITY_STYLES.split('.worksheet-match {')[1].split('}')[0];

        expect(rule).toContain('break-inside: avoid');
    });
});

describe('the letter ring', () => {
    const ring = (letters: { letter: string; active: boolean }[], overrides = {}) =>
        renderActivityFragment(
            activity({
                ideviceType: 'az-quiz-game',
                board: { kind: 'letterRing', letters } as never,
                items: [],
                ...overrides,
            }),
        );

    const all = (letters: string) => [...letters].map(letter => ({ letter, active: true }));

    it('draws every letter of the ring', () => {
        const html = ring(all('ABC'));

        expect(html).toContain('<ul class="worksheet-ring">');
        expect(html.match(/class="worksheet-ring-letter/g)).toHaveLength(3);
    });

    it('marks only the letters that carry a question', () => {
        const html = ring([
            { letter: 'A', active: true },
            { letter: 'B', active: false },
        ]);

        expect(html.match(/worksheet-ring-letter worksheet-ring-active/g)).toHaveLength(1);
        expect(html).toContain('<li class="worksheet-ring-letter" ');
    });

    it('places the letters round the ring rather than in a row', () => {
        // First at the top, the rest spread clockwise: a row would put them all on one line.
        const html = ring(all('ABCD'));
        const positions = [...html.matchAll(/left: ([\d.]+)%; top: ([\d.]+)%/g)].map(match => [
            Number(match[1]),
            Number(match[2]),
        ]);

        expect(positions).toHaveLength(4);
        expect(positions[0][1]).toBeLessThan(positions[2][1]);
        expect(new Set(positions.map(([left]) => left)).size).toBeGreaterThan(1);
    });

    it('spaces the letters evenly, whatever their number', () => {
        for (const count of [1, 5, 27]) {
            const html = ring(all('X'.repeat(count)));

            expect(html.match(/class="worksheet-ring-letter/g)).toHaveLength(count);
        }
    });

    it('draws nothing for an empty ring', () => {
        expect(ring([])).not.toContain('worksheet-ring');
    });

    it('escapes a letter instead of letting it become markup', () => {
        expect(ring([{ letter: '<b>', active: true }])).toContain('&lt;b&gt;');
    });

    it('keeps the ring whole on one sheet', () => {
        const rule = WORKSHEET_ACTIVITY_STYLES.split('.worksheet-ring {')[1].split('}')[0];

        expect(rule).toContain('break-inside: avoid');
    });
});

describe('questions that carry their own label', () => {
    const lettered = () =>
        renderActivityFragment(
            activity({
                ideviceType: 'az-quiz-game',
                unnumbered: true,
                items: [
                    { prompt: 'A. Starts with A', answer: { kind: 'characterBoxes', groups: emptyBoxes(3) } },
                    { prompt: 'B. Starts with B', answer: { kind: 'characterBoxes', groups: emptyBoxes(3) } },
                ],
            }),
        );

    it('are not numbered on top of their label', () => {
        expect(lettered()).toContain('<ol class="worksheet-items worksheet-items-plain">');
    });

    it('still numbers an activity that carries no label of its own', () => {
        const html = renderActivityFragment(
            activity({
                items: [
                    { prompt: 'Primera', answer: { kind: 'characterBoxes', groups: emptyBoxes(3) } },
                    { prompt: 'Segunda', answer: { kind: 'characterBoxes', groups: emptyBoxes(3) } },
                ],
            }),
        );

        expect(html).toContain('<ol class="worksheet-items">');
    });
});

describe('questions set in two columns', () => {
    const items = [
        { prompt: 'A. Starts with A', answer: { kind: 'characterBoxes' as const, groups: emptyBoxes(3) } },
        { prompt: 'B. Starts with B', answer: { kind: 'characterBoxes' as const, groups: emptyBoxes(3) } },
    ];

    it('are one list, so they keep their order, in two columns', () => {
        const html = renderActivityFragment(activity({ unnumbered: true, twoColumns: true, items }));

        expect(html).toContain('<ol class="worksheet-items worksheet-items-plain worksheet-items-columns">');
        expect(html.indexOf('Starts with A')).toBeLessThan(html.indexOf('Starts with B'));
    });

    it('keep their numbers when the activity numbers them', () => {
        expect(renderActivityFragment(activity({ twoColumns: true, items }))).toContain(
            '<ol class="worksheet-items worksheet-items-columns">',
        );
    });

    it('are left in one column unless the activity asks for two', () => {
        expect(renderActivityFragment(activity({ items }))).not.toContain('worksheet-items-columns');
    });

    it('run down the first column and on into the second, parted by a faint rule', () => {
        const rule = WORKSHEET_ACTIVITY_STYLES.split('.worksheet-items-columns {')[1].split('}')[0];

        expect(rule).toContain('column-count: 2');
        expect(rule).toContain('column-rule: 1px solid #ccc');
    });

    it('let a long answer carry its boxes on to the next line rather than run off the column', () => {
        const rule = WORKSHEET_ACTIVITY_STYLES.split('.worksheet-items-columns .worksheet-box-group {')[1].split(
            '}',
        )[0];

        expect(rule).toContain('flex-wrap: wrap');
    });
});

describe('writing lines and cards to be ordered', () => {
    const answered = (answer: unknown) =>
        renderActivityFragment(activity({ ideviceType: 'sort', items: [{ prompt: 'x', answer } as never] }));

    it('leaves blank room to write an answer in, with nothing ruled', () => {
        const html = answered({ kind: 'writingSpace', lines: 1 });

        expect(html).toContain('class="worksheet-writing-space"');
        expect(html).not.toContain('class="worksheet-line"');
    });

    it('makes the room as tall as the lines it is asked for', () => {
        const one = answered({ kind: 'writingSpace', lines: 1 });
        const three = answered({ kind: 'writingSpace', lines: 3 });

        expect(one).toContain('height: 7mm');
        expect(three).toContain('height: 21mm');
    });

    it('leaves a line of room at least, whatever it is asked for', () => {
        // Zero would print an answer space with nowhere to write.
        for (const lines of [0, -2]) {
            expect(answered({ kind: 'writingSpace', lines })).toContain('height: 7mm');
        }
    });

    it('gives every card its own line to be numbered on', () => {
        const html = answered({
            kind: 'orderCards',
            cards: [{ text: 'Uno' }, { text: 'Dos' }, { text: 'Tres' }],
        });

        expect(html).toContain('<ul class="worksheet-order">');
        expect(html.match(/class="worksheet-order-card"/g)).toHaveLength(3);
        expect(html.match(/class="worksheet-line"/g)).toHaveLength(3);
    });

    it('draws a card the same way the other boards do', () => {
        const html = answered({
            kind: 'orderCards',
            cards: [{ media: { kind: 'image', src: 'dog.png', alt: 'Un perro' }, text: 'Perro' }],
        });

        expect(html).toContain('<img src="dog.png" alt="Un perro" />');
        expect(html).toContain('<span class="worksheet-card-text">Perro</span>');
    });

    it('nests no list inside a list item', () => {
        // The card renderer returns an <li> for the column boards; reusing it here would have
        // put one inside another.
        const html = answered({ kind: 'orderCards', cards: [{ text: 'Uno' }] });

        expect(html).not.toContain('<li class="worksheet-card">');
        expect(html).toContain('<div class="worksheet-card">');
    });

    it('escapes a card picture instead of letting it become markup', () => {
        const html = answered({
            kind: 'orderCards',
            cards: [{ media: { kind: 'image', src: 'a.png" onerror="alert(1)' } }],
        });

        expect(html).not.toContain('onerror="alert(1)"');
    });
});

describe('cards with fixed headings', () => {
    const ordered = (extra: Record<string, unknown>) =>
        renderActivityFragment(
            activity({
                ideviceType: 'sort',
                items: [
                    {
                        prompt: 'x',
                        answer: {
                            kind: 'orderCards',
                            cards: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
                            ...extra,
                        },
                    } as never,
                ],
            }),
        );

    it('gives a heading no line, since it is given rather than asked', () => {
        const html = ordered({ headers: 2 });

        expect(html.match(/class="worksheet-order-card worksheet-order-heading"/g)).toHaveLength(2);
        expect(html.match(/class="worksheet-line"/g)).toHaveLength(2);
    });

    it('gives every card a line when none is a heading', () => {
        expect(ordered({}).match(/class="worksheet-line"/g)).toHaveLength(4);
    });

    it('lays the cards out in the columns it is given, so a heading stands over its own', () => {
        expect(ordered({ columns: 2, headers: 2 })).toContain('grid-template-columns: repeat(2, minmax(0, 34mm))');
    });

    it('leaves the layout alone when the activity has no columns to speak of', () => {
        expect(ordered({})).not.toContain('grid-template-columns');
        expect(ordered({ columns: 1 })).not.toContain('grid-template-columns');
    });
});

describe('the word search grid', () => {
    const grid = (rows: string[][]) =>
        renderActivityFragment(
            activity({ ideviceType: 'word-search', board: { kind: 'wordGrid', rows } as never, items: [] }),
        );

    it('draws every letter of the grid', () => {
        const html = grid([
            ['C', 'A'],
            ['S', 'A'],
        ]);

        expect(html).toContain('class="worksheet-word-grid"');
        expect(html.match(/class="worksheet-word-cell"/g)).toHaveLength(4);
    });

    it('lays it out in as many columns as the grid has', () => {
        expect(grid([['A', 'B', 'C']])).toContain('grid-template-columns: repeat(3, 7mm)');
    });

    it('draws nothing for an empty grid', () => {
        expect(grid([])).not.toContain('worksheet-word-grid');
        expect(grid([[]])).not.toContain('worksheet-word-grid');
    });

    it('escapes a letter instead of letting it become markup', () => {
        expect(grid([['<']])).toContain('&lt;');
    });

    it('keeps the grid whole on one sheet', () => {
        const rule = WORKSHEET_ACTIVITY_STYLES.split('.worksheet-word-grid {')[1].split('}')[0];

        expect(rule).toContain('break-inside: avoid');
    });
});

describe('the printing context in the worksheet document', () => {
    const html = renderWorksheet({ projectTitle: 'Demo', language: 'es', pages: [], unsupported: [] });

    it('tells a script that this document is a worksheet', () => {
        expect(html).toContain('"kind":"worksheet"');
        expect(html).toContain('runtime.printing =');
    });

    it('sets it in the head, before anything in the body can run', () => {
        expect(html.indexOf('runtime.printing')).toBeLessThan(html.indexOf('</head>'));
    });
});

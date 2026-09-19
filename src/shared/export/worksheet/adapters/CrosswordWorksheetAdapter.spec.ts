import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { CrosswordWorksheetAdapter } from './CrosswordWorksheetAdapter';
import type { PrintableActivity } from '../types';

interface CrosswordFixtureOptions {
    instructions?: string;
    wordsGame?: Record<string, unknown>[];
    imageLinks?: Record<number, string>;
    textAfter?: string;
    percentajeQuestions?: number;
    /** 0-100; the share of letters given away is its complement. */
    difficulty?: number;
    caseSensitive?: boolean;
    tilde?: boolean;
    hasBack?: boolean;
    authorBackImage?: string;
}

const FOUR_WORDS = [
    { word: 'CASA', definition: 'Vivienda' },
    { word: 'SALA', definition: 'Estancia' },
    { word: 'MESA', definition: 'Mueble' },
    { word: 'AMOR', definition: 'Sentimiento' },
];

/** Build component HTML the way the Crossword editor writes it. */
function crosswordHtml(options: CrosswordFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Crucigrama',
        instructions: options.instructions ?? '',
        // 100 gives no letters away, so tests that are not about hints read cleanly.
        difficulty: options.difficulty ?? 100,
        percentajeQuestions: options.percentajeQuestions,
        caseSensitive: options.caseSensitive,
        tilde: options.tilde,
        hasBack: options.hasBack,
        authorBackImage: options.authorBackImage,
        wordsGame: options.wordsGame ?? FOUR_WORDS,
    });

    let html = '<div class="crucigrama-IDevice">';
    html += '<div class="crucigrama-version js-hidden">2</div>';
    html += `<div class="crucigrama-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden crucigrama-LinkImages">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="crucigrama-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

/** The grid of an activity, as text: '.' for a gap, the letter, or '_' for an empty box. */
function grid(activity: PrintableActivity | null): string {
    const board = activity?.board;
    if (board?.kind !== 'crosswordGrid') return '';

    return board.rows.map(row => row.map(cell => (cell === null ? '.' : (cell.letter ?? '_'))).join('')).join('\n');
}

describe('CrosswordWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(CrosswordWorksheetAdapter.ideviceType).toBe('crossword');
    });

    it('builds a grid and a clue for every placed word', () => {
        const activity = CrosswordWorksheetAdapter.build(crosswordHtml(), {});

        expect(activity).not.toBeNull();
        expect(activity?.board?.kind).toBe('crosswordGrid');
        expect(activity?.items.length).toBeGreaterThan(1);
        expect(grid(activity)).toContain('_');
    });

    it('numbers the clues to match the grid', () => {
        const activity = CrosswordWorksheetAdapter.build(crosswordHtml(), {});

        const numbers = activity?.items.map(item => item.number) ?? [];
        expect(numbers).toEqual(numbers.map((_, index) => index + 1));
    });

    it('leaves the clues without their own answer boxes', () => {
        // The grid is where the student writes, so a clue must not print a box row of its own.
        const activity = CrosswordWorksheetAdapter.build(crosswordHtml(), {});

        for (const item of activity?.items ?? []) {
            expect(item.answer).toBeUndefined();
        }
    });

    it('carries the definition as the clue text', () => {
        const activity = CrosswordWorksheetAdapter.build(crosswordHtml(), {});
        const prompts = activity?.items.map(item => item.prompt) ?? [];

        for (const prompt of prompts) {
            expect(['Vivienda', 'Estancia', 'Mueble', 'Sentimiento']).toContain(prompt);
        }
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(CrosswordWorksheetAdapter.build(crosswordHtml(), { title: 'Crucigrama' })?.title).toBe('Crucigrama');
        expect(CrosswordWorksheetAdapter.build(crosswordHtml(), {})?.title).toBe('Crossword');
    });

    it('carries over instructions and closing text', () => {
        const activity = CrosswordWorksheetAdapter.build(
            crosswordHtml({ instructions: '<p>Complete el crucigrama</p>', textAfter: '<p>Buen trabajo</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Complete el crucigrama</p>');
        expect(activity?.textAfter).toBe('<p>Buen trabajo</p>');
    });

    describe('clue illustrations', () => {
        it('takes the picture from the sidecar link and marks it small', () => {
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({
                    wordsGame: [
                        { word: 'CASA', definition: 'Vivienda', url: 'asset://stale', alt: 'Una casa' },
                        { word: 'SALA', definition: 'Estancia' },
                    ],
                    imageLinks: { 0: 'blob:http://localhost/house' },
                }),
                {},
            );

            const withPicture = activity?.items.filter(item => item.media) ?? [];
            expect(withPicture).toHaveLength(1);
            expect(withPicture[0].media?.src).toBe('blob:http://localhost/house');
            expect(withPicture[0].media?.alt).toBe('Una casa');
            expect(withPicture[0].media?.size).toBe('small');
        });

        it('keeps each picture matched to its own clue despite the random draw', () => {
            // The sidecars are keyed by stored position, which both the draw and the solver reorder.
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({
                    wordsGame: [
                        { word: 'CASA', definition: 'Vivienda' },
                        { word: 'SALA', definition: 'Estancia' },
                        { word: 'MESA', definition: 'Mueble', url: 'x' },
                    ],
                    imageLinks: { 2: 'blob:http://localhost/table' },
                }),
                {},
            );

            const withPicture = activity?.items.filter(item => item.media) ?? [];
            expect(withPicture).toHaveLength(1);
            expect(withPicture[0].prompt).toBe('Mueble');
            expect(withPicture[0].media?.src).toBe('blob:http://localhost/table');
        });

        it('drops a picture whose href is too short to be real', () => {
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: FOUR_WORDS, imageLinks: { 0: '#' } }),
                {},
            );

            expect(activity?.items.every(item => item.media === undefined)).toBe(true);
        });
    });

    describe('background picture', () => {
        /** Add the background sidecar the editor writes, which is keyed by class, not by index. */
        function withBackground(href: string, extra: CrosswordFixtureOptions = {}): string {
            const html = crosswordHtml({ ...extra, hasBack: true });
            return html.replace(
                '</div>',
                `<a href="${href}" class="js-hidden crucigrama-LinkBack">Background</a></div>`,
            );
        }

        it('takes the picture from the sidecar link', () => {
            const activity = CrosswordWorksheetAdapter.build(withBackground('blob:http://localhost/animals'), {});

            expect(activity?.board?.background?.src).toBe('blob:http://localhost/animals');
        });

        it('keeps the board uncropped so the cells stay over the picture', () => {
            const backed = CrosswordWorksheetAdapter.build(withBackground('blob:http://localhost/animals'), {});
            const plain = CrosswordWorksheetAdapter.build(crosswordHtml(), {});

            // The activity solves in a 16x16 board, which a backed grid must keep whole.
            expect(backed?.board?.rows).toHaveLength(16);
            expect(backed?.board?.rows[0]).toHaveLength(16);
            // Without a picture the empty margin is trimmed, so the grid fits the page.
            expect(plain?.board?.rows.length ?? 99).toBeLessThan(16);
        });

        it('credits the picture when the activity names an author', () => {
            const activity = CrosswordWorksheetAdapter.build(
                withBackground('blob:http://localhost/animals', { authorBackImage: 'INTEF' }),
                {},
            );

            expect(activity?.board?.background?.author).toBe('INTEF');
        });

        it('goes without a picture when the activity has none', () => {
            expect(CrosswordWorksheetAdapter.build(crosswordHtml(), {})?.board?.background).toBeUndefined();
        });

        it('goes without a picture when the activity disabled it', () => {
            const html = crosswordHtml().replace(
                '</div>',
                '<a href="blob:http://localhost/x" class="js-hidden crucigrama-LinkBack">Background</a></div>',
            );

            // hasBack is false, so the stored reference is ignored.
            expect(CrosswordWorksheetAdapter.build(html, {})?.board?.background).toBeUndefined();
        });

        it('falls back to the picture shipped with the iDevice', () => {
            // No stored background, so the activity uses its own — which the worksheet can reach
            // only if the caller said where iDevice files are served from.
            const activity = CrosswordWorksheetAdapter.build(crosswordHtml({ hasBack: true }), {
                ideviceBasePath: 'http://localhost:8080/files/perm/idevices/base/',
            });

            expect(activity?.board?.background?.src).toBe(
                'http://localhost:8080/files/perm/idevices/base/crossword/export/ccgmbackground.jpg',
            );
        });

        it('prefers a stored picture over the one shipped with the iDevice', () => {
            const activity = CrosswordWorksheetAdapter.build(withBackground('blob:http://localhost/animals'), {
                ideviceBasePath: 'http://localhost:8080/files/perm/idevices/base/',
            });

            expect(activity?.board?.background?.src).toBe('blob:http://localhost/animals');
        });

        it('goes without a picture when the caller gave no iDevice base path', () => {
            // The CLI has no server to serve those files from, so there is nothing to point at.
            expect(CrosswordWorksheetAdapter.build(withBackground('#'), {})?.board?.background).toBeUndefined();
        });
    });

    describe('activity options', () => {
        it('gives away letters according to the difficulty', () => {
            const easy = CrosswordWorksheetAdapter.build(crosswordHtml({ difficulty: 0 }), {});
            const hard = CrosswordWorksheetAdapter.build(crosswordHtml({ difficulty: 100 }), {});

            // Difficulty 0 gives every letter away; 100 gives none.
            expect(grid(easy)).not.toContain('_');
            expect(grid(hard)).not.toMatch(/[A-Z]/);
        });

        it('gives away part of the letters at an intermediate difficulty', () => {
            // The common case: neither extreme. 50 of a 4-letter word gives away two letters.
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'CASA', definition: 'A' }], difficulty: 50 }),
                {},
            );

            const rendered = grid(activity);
            expect(rendered).toMatch(/[A-Z]/);
            expect(rendered).toContain('_');
            expect(rendered.replace(/[._\n]/g, '')).toHaveLength(2);
        });

        it('truncates rather than rounds the number of hints', () => {
            // 35 of a 4-letter word is 1.4, so one letter is given away.
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'CASA', definition: 'A' }], difficulty: 65 }),
                {},
            );

            expect(grid(activity).replace(/[._\n]/g, '')).toHaveLength(1);
        });

        it('stays exact when the randomness source keeps repeating itself', () => {
            // The iDevice retries forever here; a constant source would hang it.
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'CASA', definition: 'A' }], difficulty: 50 }),
                { random: () => 0 },
            );

            expect(grid(activity).replace(/[._\n]/g, '')).toHaveLength(2);
        });

        it('prints only the share of words the activity asks', () => {
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({
                    wordsGame: [
                        { word: 'CASA', definition: 'A' },
                        { word: 'SALA', definition: 'B' },
                        { word: 'MESA', definition: 'C' },
                        { word: 'AMOR', definition: 'D' },
                        { word: 'LOSA', definition: 'E' },
                        { word: 'RAMA', definition: 'F' },
                    ],
                    percentajeQuestions: 50,
                }),
                {},
            );

            // Three of six are drawn; some may fail to cross, so three is the ceiling.
            expect(activity?.items.length).toBeLessThanOrEqual(3);
            expect(activity?.items.length).toBeGreaterThan(0);
        });

        it('upper-cases the grid unless the activity is case sensitive', () => {
            const insensitive = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'Casa', definition: 'A' }], difficulty: 0 }),
                {},
            );
            const sensitive = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'Casa', definition: 'A' }], difficulty: 0, caseSensitive: true }),
                {},
            );

            expect(grid(insensitive)).toBe('CASA');
            expect(grid(sensitive)).toBe('Casa');
        });

        it('strips accents from the grid when the activity ignores them', () => {
            const stripped = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'ÁRBOL', definition: 'A' }], difficulty: 0, tilde: false }),
                {},
            );
            const kept = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'ÁRBOL', definition: 'A' }], difficulty: 0, tilde: true }),
                {},
            );

            expect(grid(stripped)).toBe('ARBOL');
            expect(grid(kept)).toBe('ÁRBOL');
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(CrosswordWorksheetAdapter.build(crosswordHtml({ wordsGame: [] }), {})).toBeNull();
            expect(CrosswordWorksheetAdapter.build('<div class="crucigrama-IDevice"></div>', {})).toBeNull();
            expect(CrosswordWorksheetAdapter.build('<div class="crucigrama-DataGame">not json</div>', {})).toBeNull();
            expect(CrosswordWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when no word can be placed', () => {
            // Single letters cannot anchor a crossword.
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({ wordsGame: [{ word: 'A', definition: 'x' }] }),
                {},
            );

            expect(activity).toBeNull();
        });

        it('returns null when wordsGame is not an array', () => {
            const html = `<div class="crucigrama-DataGame js-hidden">${encryptDataGame('{"wordsGame":"nope"}')}</div>`;

            expect(CrosswordWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('ignores a word the solver cannot cross into the grid', () => {
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({
                    wordsGame: [
                        { word: 'CASAS', definition: 'Viviendas' },
                        { word: 'XYZW', definition: 'Imposible' },
                    ],
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].prompt).toBe('Viviendas');
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into the instructions', () => {
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({ instructions: '<p>Hola</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Hola</p>');
        });

        it('escapes markup typed into a definition', () => {
            const activity = CrosswordWorksheetAdapter.build(
                crosswordHtml({
                    wordsGame: [
                        { word: 'CASA', definition: '<img src=x onerror=alert(1)>' },
                        { word: 'SALA', definition: 'Estancia' },
                    ],
                }),
                {},
            );

            for (const item of activity?.items ?? []) {
                expect(item.prompt).not.toContain('onerror');
                expect(item.prompt).not.toContain('<img');
            }
        });
    });
});

import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { WordSearchWorksheetAdapter } from './WordSearchWorksheetAdapter';
import type { PrintableActivity } from '../types';

interface SearchFixtureOptions {
    instructions?: string;
    wordsGame?: Record<string, unknown>[];
    percentajeQuestions?: number;
    reverses?: boolean;
    diagonals?: boolean;
    imageLinks?: Record<number, string>;
    textAfter?: string;
}

/** One clue with its hidden answer. */
function word(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { word: 'CASA', definition: 'Vivienda', url: '', audio: '', ...overrides };
}

/** Build component HTML the way the Word search editor writes it. */
function searchHtml(options: SearchFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Sopa',
        instructions: options.instructions ?? '',
        percentajeQuestions: options.percentajeQuestions,
        reverses: options.reverses,
        diagonals: options.diagonals,
        wordsGame: options.wordsGame ?? [word(), word({ word: 'SOL', definition: 'Astro' })],
    });

    let html = '<div class="sopa-IDevice">';
    html += `<div class="sopa-DataGame js-hidden">${encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden sopa-LinkImages">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="sopa-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

function gridOf(activity: PrintableActivity | null): string[][] {
    const board = activity?.board;
    return board?.kind === 'wordGrid' ? board.rows : [];
}

describe('WordSearchWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(WordSearchWorksheetAdapter.ideviceType).toBe('word-search');
    });

    it('puts the grid above the clues', () => {
        const activity = WordSearchWorksheetAdapter.build(searchHtml(), {});

        expect(activity?.board?.kind).toBe('wordGrid');
        expect(gridOf(activity).length).toBeGreaterThan(0);
        expect(activity?.items).toHaveLength(2);
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(WordSearchWorksheetAdapter.build(searchHtml(), { title: 'Sopa' })?.title).toBe('Sopa');
        expect(WordSearchWorksheetAdapter.build(searchHtml(), {})?.title).toBe('Word search');
    });

    it('carries over instructions and closing text', () => {
        const activity = WordSearchWorksheetAdapter.build(
            searchHtml({ instructions: '<p>Busca</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Busca</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    describe('the grid', () => {
        it('hides the answers in it', () => {
            const rows = gridOf(WordSearchWorksheetAdapter.build(searchHtml(), {}));
            const acrossAndDown = [
                ...rows.map(row => row.join('')),
                ...rows[0].map((_, column) => rows.map(row => row[column]).join('')),
            ].join(' ');

            // Both answers run in one of the two directions this activity allows.
            expect(acrossAndDown).toContain('CASA');
            expect(acrossAndDown).toContain('SOL');
        });

        it('is square and filled to the edges', () => {
            const rows = gridOf(WordSearchWorksheetAdapter.build(searchHtml(), {}));

            for (const row of rows) {
                expect(row).toHaveLength(rows.length);
                for (const cell of row) expect(cell).not.toBe('');
            }
        });

        it('never prints where the answers are', () => {
            const activity = WordSearchWorksheetAdapter.build(searchHtml(), {});

            expect(JSON.stringify(activity?.board)).not.toContain('orientation');
            expect(JSON.stringify(activity?.items)).not.toContain('CASA');
        });
    });

    describe('the clues', () => {
        it('numbers them as they are listed', () => {
            const activity = WordSearchWorksheetAdapter.build(searchHtml(), {});

            expect(activity?.items.map(item => item.number)).toEqual([1, 2]);
            expect(activity?.items.map(item => item.prompt)).toEqual(['Vivienda', 'Astro']);
        });

        it('leaves no writing space, since the answer is found in the grid', () => {
            expect(WordSearchWorksheetAdapter.build(searchHtml(), {})?.items[0].answer).toBeUndefined();
        });

        it('takes a picture from the sidecar link, not from the payload', () => {
            const activity = WordSearchWorksheetAdapter.build(
                searchHtml({
                    wordsGame: [word({ url: 'asset://stale', alt: 'Una casa' })],
                    imageLinks: { 0: 'blob:http://localhost/house' },
                }),
                {},
            );

            expect(activity?.items[0].media?.src).toBe('blob:http://localhost/house');
            expect(activity?.items[0].media?.alt).toBe('Una casa');
            expect(activity?.items[0].media?.size).toBe('small');
        });

        it('keeps each picture matched to its own clue', () => {
            const activity = WordSearchWorksheetAdapter.build(
                searchHtml({ imageLinks: { 1: 'blob:http://localhost/sun' } }),
                {},
            );

            expect(activity?.items[0].media).toBeUndefined();
            expect(activity?.items[1].media?.src).toBe('blob:http://localhost/sun');
        });

        it('reads a clue as text, whatever markup it was written with', () => {
            const activity = WordSearchWorksheetAdapter.build(
                searchHtml({ wordsGame: [word({ definition: '<p>Una <b>vivienda</b></p>' })] }),
                {},
            );

            expect(activity?.items[0].prompt).toBe('Una vivienda');
        });
    });

    describe('what the activity allows', () => {
        it('runs the words across and down when it allows nothing else', () => {
            const rows = gridOf(
                WordSearchWorksheetAdapter.build(searchHtml({ reverses: false, diagonals: false }), {}),
            );
            const acrossAndDown = [
                ...rows.map(row => row.join('')),
                ...rows[0].map((_, column) => rows.map(row => row[column]).join('')),
            ].join(' ');

            expect(acrossAndDown).toContain('CASA');
        });

        it('still hides every answer when it allows every direction', () => {
            const activity = WordSearchWorksheetAdapter.build(searchHtml({ reverses: true, diagonals: true }), {
                random: () => 0.5,
            });

            expect(activity?.items).toHaveLength(2);
            expect(gridOf(activity).length).toBeGreaterThan(0);
        });
    });

    describe('the share of words', () => {
        const four = () =>
            ['CASA', 'SOL', 'MESA', 'LUNA'].map(text => word({ word: text, definition: `Pista ${text}` }));

        it('asks only the share the activity uses, in stored order', () => {
            // Unlike its siblings, this runtime asks for no random draw.
            const activity = WordSearchWorksheetAdapter.build(
                searchHtml({ wordsGame: four(), percentajeQuestions: 50 }),
                {},
            );

            expect(activity?.items.map(item => item.prompt)).toEqual(['Pista CASA', 'Pista SOL']);
        });

        it('asks every word when the activity sets no share', () => {
            expect(WordSearchWorksheetAdapter.build(searchHtml({ wordsGame: four() }), {})?.items).toHaveLength(4);
        });
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(WordSearchWorksheetAdapter.build(searchHtml({ wordsGame: [] }), {})).toBeNull();
            expect(WordSearchWorksheetAdapter.build('<div class="sopa-IDevice"></div>', {})).toBeNull();
            expect(WordSearchWorksheetAdapter.build('<div class="sopa-DataGame">no</div>', {})).toBeNull();
            expect(WordSearchWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when wordsGame is not an array', () => {
            const html = `<div class="sopa-DataGame js-hidden">${encryptDataGame('{"wordsGame":"no"}')}</div>`;

            expect(WordSearchWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('reports a word with no answer to hide', () => {
            const omissions: string[] = [];
            const activity = WordSearchWorksheetAdapter.build(
                searchHtml({ wordsGame: [word(), word({ word: '  ', definition: 'Sin respuesta' })] }),
                { onOmission: reason => omissions.push(reason) },
            );

            expect(activity?.items).toHaveLength(1);
            expect(omissions).toEqual(['invalid-data']);
        });

        it('returns null when no word can be hidden at all', () => {
            expect(WordSearchWorksheetAdapter.build(searchHtml({ wordsGame: [word({ word: '' })] }), {})).toBeNull();
        });
    });

    describe('untrusted content', () => {
        it('strips markup smuggled into a clue', () => {
            const activity = WordSearchWorksheetAdapter.build(
                searchHtml({ wordsGame: [word({ definition: 'Hola<script>alert(1)</script>' })] }),
                {},
            );

            expect(activity?.items[0].prompt).not.toContain('<script>');
        });

        it('strips a script smuggled into the instructions', () => {
            const activity = WordSearchWorksheetAdapter.build(
                searchHtml({ instructions: '<p>Hi</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Hi</p>');
        });
    });
});

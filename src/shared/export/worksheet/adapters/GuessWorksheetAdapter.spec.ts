import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { GuessWorksheetAdapter } from './GuessWorksheetAdapter';

import type { PrintableActivity } from '../types';

interface GuessFixtureOptions {
    instructions?: string;
    wordsGame?: Record<string, unknown>[];
    imageLinks?: Record<number, string>;
    textAfter?: string;
    /** Store the payload unobfuscated, the way pre-cipher activities did. */
    plain?: boolean;
    /** Share of the stored questions the activity asks. */
    percentajeQuestions?: number;
    /** Whether questions are drawn and ordered at random. */
    optionsRamdon?: boolean;
    /** Activity-wide fallback for the share of letters given away. */
    percentageShow?: number;
    caseSensitive?: boolean;
}

/**
 * Render one item's answer boxes readably: letters as-is, empty boxes as '.', words separated
 * by a space. Returns '' when the item or the answer kind is not there, so a failing assertion
 * points at the missing value rather than at a thrown TypeError.
 */
function answerOf(activity: PrintableActivity | null, index = 0): string {
    const answer = activity?.items[index]?.answer;
    if (answer?.kind !== 'characterBoxes') return '';

    return answer.groups.map(group => group.map(box => box ?? '.').join('')).join(' ');
}

/** Build component HTML the way the Guess editor writes it. */
function guessHtml(options: GuessFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Adivina',
        instructions: options.instructions ?? '',
        // Default to giving nothing away, so tests that are not about hints read cleanly.
        percentageShow: options.percentageShow ?? 0,
        percentajeQuestions: options.percentajeQuestions,
        optionsRamdon: options.optionsRamdon,
        caseSensitive: options.caseSensitive,
        wordsGame: options.wordsGame ?? [{ word: 'Valencia', definition: 'Ciudad conquistada', type: 0 }],
    });

    let html = '<div class="adivina-IDevice">';
    html += '<div class="adivina-version js-hidden">2</div>';
    html += `<div class="adivina-DataGame js-hidden">${options.plain ? payload : encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden adivina-LinkImages">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="adivina-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

describe('GuessWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(GuessWorksheetAdapter.ideviceType).toBe('guess');
    });

    it('builds one item per question with character boxes from the solution', () => {
        const activity = GuessWorksheetAdapter.build(
            guessHtml({
                wordsGame: [
                    { word: 'Valencia', definition: 'Ciudad conquistada', type: 0 },
                    { word: 'Mio Cid', definition: 'Nombre del héroe', type: 0 },
                ],
            }),
            {},
        );

        expect(activity).not.toBeNull();
        expect(activity?.items).toHaveLength(2);
        expect(activity?.items[0].prompt).toBe('Ciudad conquistada');
        expect(answerOf(activity, 0)).toBe('........');
        expect(answerOf(activity, 1)).toBe('... ...');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(GuessWorksheetAdapter.build(guessHtml(), { title: 'Adivina' })?.title).toBe('Adivina');
        expect(GuessWorksheetAdapter.build(guessHtml(), {})?.title).toBe('Guess');
    });

    it('carries over instructions and closing text', () => {
        const activity = GuessWorksheetAdapter.build(
            guessHtml({
                instructions: '<p>Observe las letras</p>',
                textAfter: '<p>El Cantar de Mio Cid</p>',
            }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Observe las letras</p>');
        expect(activity?.textAfter).toBe('<p>El Cantar de Mio Cid</p>');
    });

    it('omits instructions and closing text when the author left them empty', () => {
        const activity = GuessWorksheetAdapter.build(guessHtml(), {});

        expect(activity?.instructions).toBeUndefined();
        expect(activity?.textAfter).toBeUndefined();
    });

    describe('activity options', () => {
        const fourQuestions = [
            { word: 'Uno', definition: 'A', type: 0 },
            { word: 'Dos', definition: 'B', type: 0 },
            { word: 'Tres', definition: 'C', type: 0 },
            { word: 'Cuatro', definition: 'D', type: 0 },
        ];

        it('prints only the share of questions the activity asks', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({ wordsGame: fourQuestions, percentajeQuestions: 50 }),
                {},
            );

            expect(activity?.items).toHaveLength(2);
            expect(activity?.items.map(item => item.prompt)).toEqual(['A', 'B']);
        });

        it('prints every question when the activity asks for all of them', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({ wordsGame: fourQuestions, percentajeQuestions: 100 }),
                {},
            );

            expect(activity?.items.map(item => item.prompt)).toEqual(['A', 'B', 'C', 'D']);
        });

        it('prints every question when the activity sets no share', () => {
            const activity = GuessWorksheetAdapter.build(guessHtml({ wordsGame: fourQuestions }), {});

            expect(activity?.items).toHaveLength(4);
        });

        it('keeps the stored order when questions are not random', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({ wordsGame: fourQuestions, optionsRamdon: false }),
                { random: () => 0 },
            );

            expect(activity?.items.map(item => item.prompt)).toEqual(['A', 'B', 'C', 'D']);
        });

        it('reorders the questions when the activity asks for random ones', () => {
            const activity = GuessWorksheetAdapter.build(guessHtml({ wordsGame: fourQuestions, optionsRamdon: true }), {
                random: () => 0,
            });

            const prompts = activity?.items.map(item => item.prompt) ?? [];
            expect(prompts).toHaveLength(4);
            expect([...prompts].sort()).toEqual(['A', 'B', 'C', 'D']);
            expect(prompts).not.toEqual(['A', 'B', 'C', 'D']);
        });

        it('combines a random draw with a partial share', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({ wordsGame: fourQuestions, percentajeQuestions: 50, optionsRamdon: true }),
                { random: () => 0 },
            );

            expect(activity?.items).toHaveLength(2);
        });

        it('keeps each picture matched to its own question after a random draw', () => {
            // The sidecars are keyed by stored position, so selection must not renumber them.
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [
                        { word: 'Uno', definition: 'A', type: 0 },
                        { word: 'Dos', definition: 'B', type: 1 },
                    ],
                    imageLinks: { 1: 'blob:http://localhost/second' },
                    optionsRamdon: true,
                }),
                { random: () => 0 },
            );

            const withPicture = activity?.items.filter(item => item.media);
            expect(withPicture).toHaveLength(1);
            expect(withPicture?.[0].prompt).toBe('B');
            expect(withPicture?.[0].media?.src).toBe('blob:http://localhost/second');
        });

        it('gives away the share of letters the question asks for', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Valencia', definition: 'Ciudad', type: 0, percentageShow: 100 }],
                }),
                {},
            );

            expect(answerOf(activity, 0)).toBe('VALENCIA');
        });

        it('falls back to the activity share when a question sets none', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Valencia', definition: 'Ciudad', type: 0 }],
                    percentageShow: 100,
                }),
                {},
            );

            expect(answerOf(activity, 0)).toBe('VALENCIA');
        });

        it('lets a question override the activity share', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Valencia', definition: 'Ciudad', type: 0, percentageShow: 0 }],
                    percentageShow: 100,
                }),
                {},
            );

            expect(answerOf(activity, 0)).toBe('........');
        });

        it('keeps the author casing when the activity is case sensitive', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Mio Cid', definition: 'x', type: 0, percentageShow: 100 }],
                    caseSensitive: true,
                }),
                {},
            );

            expect(answerOf(activity, 0)).toBe('Mio Cid');
        });
    });

    describe('question types', () => {
        it('takes the picture URL from the sidecar link, not from the payload', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Espada', definition: 'Arma', type: 1, url: 'asset://stale', alt: 'Tizona' }],
                    imageLinks: { 0: 'blob:http://localhost/fresh' },
                }),
                {},
            );

            expect(activity?.items[0].media).toEqual({
                kind: 'image',
                src: 'blob:http://localhost/fresh',
                alt: 'Tizona',
                author: undefined,
            });
        });

        it('matches sidecar links to their own question index', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [
                        { word: 'Uno', definition: 'A', type: 0 },
                        { word: 'Dos', definition: 'B', type: 1 },
                    ],
                    imageLinks: { 1: 'blob:http://localhost/second' },
                }),
                {},
            );

            expect(activity?.items[0].media).toBeUndefined();
            expect(activity?.items[1].media?.src).toBe('blob:http://localhost/second');
        });

        it('drops a picture whose href is too short to be real', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Espada', definition: 'Arma', type: 1 }],
                    imageLinks: { 0: '#' },
                }),
                {},
            );

            expect(activity?.items[0].media).toBeUndefined();
        });

        it('ignores pictures on questions that are not image questions', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Espada', definition: 'Arma', type: 0, url: 'blob:http://localhost/x' }],
                    imageLinks: { 0: 'blob:http://localhost/x' },
                }),
                {},
            );

            expect(activity?.items[0].media).toBeUndefined();
        });

        it('unescapes and sanitises the rich text of a type 3 question', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [
                        { word: 'Cid', definition: 'Apodo', type: 3, eText: escape('<p>Lee el <b>texto</b></p>') },
                    ],
                }),
                {},
            );

            expect(activity?.items[0].extraText).toBe('<p>Lee el <b>texto</b></p>');
        });

        it('reads rich text that was stored without escaping', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Cid', definition: 'Apodo', type: 3, eText: '<p>Texto plano</p>' }],
                }),
                {},
            );

            expect(activity?.items[0].extraText).toBe('<p>Texto plano</p>');
        });

        it('carries a video question as a plain prompt, since video cannot be printed', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Batalla', definition: 'Mira el vídeo', type: 2, url: 'https://youtu.be/x' }],
                }),
                {},
            );

            expect(activity?.items[0].media).toBeUndefined();
            expect(activity?.items[0].prompt).toBe('Mira el vídeo');
        });
    });

    describe('robustness', () => {
        it('reads activities stored before the payload was obfuscated', () => {
            const activity = GuessWorksheetAdapter.build(guessHtml({ plain: true }), {});

            expect(activity?.items).toHaveLength(1);
        });

        it('skips questions with no solution but keeps the rest', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [
                        { word: '', definition: 'Sin solución', type: 0 },
                        { word: 'Valencia', definition: 'Ciudad', type: 0 },
                    ],
                }),
                {},
            );

            expect(activity?.items).toHaveLength(1);
            expect(activity?.items[0].prompt).toBe('Ciudad');
        });

        it('keeps an image question whose clue is empty', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Espada', definition: '', type: 1 }],
                    imageLinks: { 0: 'blob:http://localhost/pic' },
                }),
                {},
            );

            expect(activity?.items[0].prompt).toBe('');
            expect(activity?.items[0].media?.src).toBe('blob:http://localhost/pic');
        });

        it('returns null when no question has a solution', () => {
            expect(
                GuessWorksheetAdapter.build(guessHtml({ wordsGame: [{ word: '', definition: 'x', type: 0 }] }), {}),
            ).toBeNull();
        });

        it('returns null for an empty, missing or corrupt payload', () => {
            expect(GuessWorksheetAdapter.build(guessHtml({ wordsGame: [] }), {})).toBeNull();
            expect(GuessWorksheetAdapter.build('<div class="adivina-IDevice"></div>', {})).toBeNull();
            expect(GuessWorksheetAdapter.build('<div class="adivina-DataGame">not json</div>', {})).toBeNull();
            expect(GuessWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when wordsGame is not an array', () => {
            const html = `<div class="adivina-DataGame js-hidden">${encryptDataGame('{"wordsGame":"nope"}')}</div>`;

            expect(GuessWorksheetAdapter.build(html, {})).toBeNull();
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into the instructions', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({ instructions: '<p>Hola</p><script>alert(1)</script>' }),
                {},
            );

            expect(activity?.instructions).toBe('<p>Hola</p>');
        });

        it('escapes markup typed into a clue instead of rendering it', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Cid', definition: '<img src=x onerror=alert(1)>', type: 0 }],
                }),
                {},
            );

            expect(activity?.items[0].prompt).not.toContain('onerror');
            expect(activity?.items[0].prompt).not.toContain('<img');
        });

        it('strips an event handler from the rich text of a question', () => {
            const activity = GuessWorksheetAdapter.build(
                guessHtml({
                    wordsGame: [{ word: 'Cid', definition: 'x', type: 3, eText: escape('<p onclick="x()">Hi</p>') }],
                }),
                {},
            );

            expect(activity?.items[0].extraText).toBe('<p>Hi</p>');
        });
    });
});

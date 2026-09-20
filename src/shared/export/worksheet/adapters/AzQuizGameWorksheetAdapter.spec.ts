import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import { AzQuizGameWorksheetAdapter } from './AzQuizGameWorksheetAdapter';
import type { PrintableActivity, PrintableRingLetter } from '../types';

interface RoscoFixtureOptions {
    instructions?: string;
    letters?: string;
    wordsGame?: Record<string, unknown>[];
    msgs?: Record<string, string>;
    caseSensitive?: boolean;
    imageLinks?: Record<number, string>;
    textAfter?: string;
    /** Store the payload as plain JSON, the way older versions of this iDevice saved it. */
    plain?: boolean;
}

/** One letter in play. */
function word(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return { word: 'DOG', definition: 'Perro en inglés', type: 0, ...overrides };
}

/** A letter with no question on it. */
const blank = () => ({ word: '', definition: '' });

/** Build component HTML the way the A-Z quiz game editor writes it. */
function roscoHtml(options: RoscoFixtureOptions = {}): string {
    const payload = JSON.stringify({
        typeGame: 'Rosco',
        instructions: options.instructions ?? '',
        letters: options.letters ?? 'D',
        caseSensitive: options.caseSensitive,
        msgs: options.msgs,
        wordsGame: options.wordsGame ?? [word()],
    });

    let html = '<div class="rosco-IDevice">';
    html += `<div class="rosco-DataGame js-hidden">${options.plain ? payload : encryptDataGame(payload)}</div>`;

    for (const [index, href] of Object.entries(options.imageLinks ?? {})) {
        html += `<a href="${href}" class="js-hidden rosco-LinkImages">${index}</a>`;
    }
    if (options.textAfter) {
        html += `<div class="rosco-extra-content">${options.textAfter}</div>`;
    }
    html += '</div>';

    return html;
}

function ringOf(activity: PrintableActivity | null): PrintableRingLetter[] {
    const board = activity?.board;
    return board?.kind === 'letterRing' ? board.letters : [];
}

describe('AzQuizGameWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(AzQuizGameWorksheetAdapter.ideviceType).toBe('az-quiz-game');
    });

    it('draws the ring above the clues', () => {
        const activity = AzQuizGameWorksheetAdapter.build(roscoHtml(), {});

        expect(activity?.board?.kind).toBe('letterRing');
        expect(ringOf(activity)).toEqual([{ letter: 'D', active: true }]);
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(AzQuizGameWorksheetAdapter.build(roscoHtml(), { title: 'Rosco' })?.title).toBe('Rosco');
        expect(AzQuizGameWorksheetAdapter.build(roscoHtml(), {})?.title).toBe('A-Z quiz game');
    });

    it('carries over instructions and closing text', () => {
        const activity = AzQuizGameWorksheetAdapter.build(
            roscoHtml({ instructions: '<p>Juega</p>', textAfter: '<p>Fin</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Juega</p>');
        expect(activity?.textAfter).toBe('<p>Fin</p>');
    });

    it('reads a payload an older version stored as plain JSON', () => {
        // This iDevice only encrypts from version 1 onwards, unlike its siblings.
        expect(AzQuizGameWorksheetAdapter.build(roscoHtml({ plain: true }), {})?.items).toHaveLength(1);
    });

    describe('the ring', () => {
        it('shows the whole alphabet, marking which letters are in play', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ letters: 'ABC', wordsGame: [word(), blank(), word({ word: 'CAT' })] }),
                {},
            );

            expect(ringOf(activity)).toEqual([
                { letter: 'A', active: true },
                { letter: 'B', active: false },
                { letter: 'C', active: true },
            ]);
        });

        it('treats a letter whose word is only spaces as out of play', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ letters: 'AB', wordsGame: [word(), word({ word: '   ' })] }),
                {},
            );

            expect(ringOf(activity)[1].active).toBe(false);
            expect(activity?.items).toHaveLength(1);
        });

        it('spells a digraph the way it is read', () => {
            // The activity stores L·L as '0' and SS as '1'.
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ letters: '01', wordsGame: [word({ word: 'PARAL·LEL' }), word({ word: 'CLASSE' })] }),
                {},
            );

            expect(ringOf(activity).map(entry => entry.letter)).toEqual(['L·L', 'SS']);
            expect(activity?.items[0].prompt).toContain('Starts with L·L');
        });
    });

    describe('each clue', () => {
        it('opens with how the answer relates to its letter, said once', () => {
            const activity = AzQuizGameWorksheetAdapter.build(roscoHtml(), {});

            expect(activity?.items[0].prompt).toContain('Starts with D');
            expect(activity?.items[0].prompt).toContain('Perro en inglés');
        });

        it('says the answer only contains the letter when that is the question', () => {
            const activity = AzQuizGameWorksheetAdapter.build(roscoHtml({ wordsGame: [word({ type: 1 })] }), {});

            expect(activity?.items[0].prompt).toContain('Contains letter D');
        });

        it("uses the author's own wording when they changed it", () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ msgs: { msgStartWith: 'Empieza por %1', msgContaint: 'Contiene la %1' } }),
                {},
            );

            expect(activity?.items[0].prompt).toContain('Empieza por D');
        });

        it('leaves room to answer, one blank box per letter', () => {
            const activity = AzQuizGameWorksheetAdapter.build(roscoHtml(), {});

            expect(activity?.items[0].answer).toEqual({
                kind: 'characterBoxes',
                groups: [[null, null, null]],
            });
        });

        it('gives no letters away, however long the answer', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ wordsGame: [word({ word: 'DROMEDARIO' })] }),
                {},
            );
            const answer = activity?.items[0].answer;

            expect(answer?.kind === 'characterBoxes' && answer.groups[0].every(box => box === null)).toBe(true);
        });

        it('sizes the boxes from the first accepted spelling', () => {
            // Any of them is right at play; the boxes follow the author's own.
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ wordsGame: [word({ word: 'DOG|HOUND' })] }),
                {},
            );
            const answer = activity?.items[0].answer;

            expect(answer?.kind === 'characterBoxes' && answer.groups[0]).toHaveLength(3);
        });

        it('takes the picture from the sidecar link, not from the payload', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({
                    wordsGame: [word({ url: 'asset://stale', alt: 'Un perro' })],
                    imageLinks: { 0: 'blob:http://localhost/dog' },
                }),
                {},
            );

            expect(activity?.items[0].media?.src).toBe('blob:http://localhost/dog');
            expect(activity?.items[0].media?.alt).toBe('Un perro');
        });

        it('keeps each picture matched to its own letter', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({
                    letters: 'AB',
                    wordsGame: [word({ word: 'ANT' }), word({ word: 'BEE' })],
                    imageLinks: { 1: 'blob:http://localhost/bee' },
                }),
                {},
            );

            expect(activity?.items[0].media).toBeUndefined();
            expect(activity?.items[1].media?.src).toBe('blob:http://localhost/bee');
        });
    });

    describe('clues with several wordings', () => {
        it('prints one, as the activity shows one per play', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ wordsGame: [word({ definition: 'Perro en inglés|El mejor amigo del hombre' })] }),
                { random: () => 0 },
            );

            expect(activity?.items[0].prompt).toContain('Perro en inglés');
            expect(activity?.items[0].prompt).not.toContain('El mejor amigo del hombre');
        });

        it('can print either of them', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ wordsGame: [word({ definition: 'Perro en inglés|El mejor amigo del hombre' })] }),
                { random: () => 0.99 },
            );

            expect(activity?.items[0].prompt).toContain('El mejor amigo del hombre');
        });

        it('leaves a lone wording alone, separator or not', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ wordsGame: [word({ definition: 'Perro en inglés' })] }),
                {},
            );

            expect(activity?.items[0].prompt).toContain('Perro en inglés');
        });
    });

    it('never numbers the clues, since each carries its letter', () => {
        const activity = AzQuizGameWorksheetAdapter.build(
            roscoHtml({ letters: 'AB', wordsGame: [word({ word: 'ANT' }), word({ word: 'BEE' })] }),
            {},
        );

        expect(activity?.unnumbered).toBe(true);
    });

    describe('robustness', () => {
        it('returns null for an empty, missing or corrupt payload', () => {
            expect(AzQuizGameWorksheetAdapter.build(roscoHtml({ wordsGame: [] }), {})).toBeNull();
            expect(AzQuizGameWorksheetAdapter.build('<div class="rosco-IDevice"></div>', {})).toBeNull();
            expect(AzQuizGameWorksheetAdapter.build('<div class="rosco-DataGame">no</div>', {})).toBeNull();
            expect(AzQuizGameWorksheetAdapter.build('', {})).toBeNull();
        });

        it('returns null when the alphabet is missing', () => {
            const html = `<div class="rosco-DataGame js-hidden">${encryptDataGame('{"wordsGame":[]}')}</div>`;

            expect(AzQuizGameWorksheetAdapter.build(html, {})).toBeNull();
        });

        it('returns null when no letter is in play', () => {
            expect(
                AzQuizGameWorksheetAdapter.build(roscoHtml({ letters: 'AB', wordsGame: [blank(), blank()] }), {}),
            ).toBeNull();
        });

        it('survives an alphabet longer than the questions stored for it', () => {
            const activity = AzQuizGameWorksheetAdapter.build(roscoHtml({ letters: 'ABC', wordsGame: [word()] }), {});

            expect(ringOf(activity)).toHaveLength(3);
            expect(activity?.items).toHaveLength(1);
        });
    });

    describe('untrusted content', () => {
        it('strips a script smuggled into a clue', () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ wordsGame: [word({ definition: '<p>Hi</p><script>alert(1)</script>' })] }),
                {},
            );

            expect(activity?.items[0].prompt).not.toContain('<script>');
            expect(activity?.items[0].prompt).toContain('<p>Hi</p>');
        });

        it("escapes the author's own wording before putting it in markup", () => {
            const activity = AzQuizGameWorksheetAdapter.build(
                roscoHtml({ msgs: { msgStartWith: '<img src=x onerror=alert(1)> %1' } }),
                {},
            );

            expect(activity?.items[0].prompt).not.toContain('<img');
            expect(activity?.items[0].prompt).toContain('&lt;img');
        });
    });
});

describe('AzQuizGameWorksheetAdapter says the letter once', () => {
    it('does not put the letter in front of wording that already names it', () => {
        const activity = AzQuizGameWorksheetAdapter.build(
            roscoHtml({ msgs: { msgContaint: 'Contiene la letra %1' }, wordsGame: [word({ type: 1 })] }),
            {},
        );
        const prompt = activity?.items[0].prompt ?? '';

        expect(prompt).toContain('Contiene la letra D');
        expect(prompt).not.toContain('D. Contiene');
        // Once in the cue, and nowhere else before the clue itself.
        expect(prompt.indexOf('Contiene')).toBeLessThan(prompt.indexOf('Perro'));
    });
});

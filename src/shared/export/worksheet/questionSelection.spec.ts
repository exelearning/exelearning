import { describe, expect, it } from 'bun:test';
import { buildAnswerBoxes, selectCards, selectQuestions } from './questionSelection';

/** A randomness source that walks a fixed list, so outcomes are pinned. */
function sequence(values: number[]): () => number {
    let index = 0;
    return () => values[index++ % values.length];
}

/** Flatten boxes to a readable string: letters as-is, empty boxes as '.', words split by ' '. */
function render(groups: (string | null)[][]): string {
    return groups.map(group => group.map(box => box ?? '.').join('')).join(' ');
}

describe('selectQuestions', () => {
    const questions = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

    it('keeps every question in order at 100% without randomisation', () => {
        expect(selectQuestions(questions, 100, false)).toEqual(questions);
        expect(selectQuestions(questions, undefined, undefined)).toEqual(questions);
    });

    it('takes the leading share in stored order', () => {
        expect(selectQuestions(questions, 50, false)).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(selectQuestions(questions, 30, false)).toEqual(['a', 'b', 'c']);
    });

    it('rounds the share to the nearest question', () => {
        // 25% of 10 is 2.5, which rounds up to 3.
        expect(selectQuestions(questions, 25, false)).toHaveLength(3);
        // 24% of 10 is 2.4, which rounds down to 2.
        expect(selectQuestions(questions, 24, false)).toHaveLength(2);
    });

    it('always keeps at least one question', () => {
        expect(selectQuestions(questions, 0, false)).toHaveLength(1);
        expect(selectQuestions(['only'], 1, false)).toEqual(['only']);
    });

    it('never asks for more than it stores', () => {
        expect(selectQuestions(questions, 150, false)).toEqual(questions);
    });

    it('reorders every question when randomising at 100%', () => {
        // Fisher-Yates walks i from 9 down to 1; a source of 0 sends each item to the front.
        const shuffled = selectQuestions(questions, 100, true, () => 0);

        expect(shuffled).toHaveLength(questions.length);
        expect([...shuffled].sort()).toEqual([...questions].sort());
        expect(shuffled).not.toEqual(questions);
    });

    it('draws a random subset when randomising below 100%', () => {
        const drawn = selectQuestions(questions, 30, true, () => 0);

        expect(drawn).toHaveLength(3);
        expect(new Set(drawn).size).toBe(3);
        for (const item of drawn) expect(questions).toContain(item);
    });

    it('treats a non-array as no questions', () => {
        expect(selectQuestions(undefined as unknown as string[], 100, false)).toEqual([]);
    });

    it('returns nothing for an empty activity', () => {
        expect(selectQuestions([], 50, false)).toEqual([]);
        expect(selectQuestions([], 50, true)).toEqual([]);
    });
});

describe('buildAnswerBoxes', () => {
    describe('grouping', () => {
        it('draws one group per word', () => {
            expect(render(buildAnswerBoxes('Valencia', 0))).toBe('........');
            expect(render(buildAnswerBoxes('Mio Cid', 0))).toBe('... ...');
        });

        it('collapses repeated separators and trims', () => {
            expect(render(buildAnswerBoxes('  Mio   Cid  ', 0))).toBe('... ...');
        });

        it('gives an astral character a single box', () => {
            expect(render(buildAnswerBoxes('🎓🎓', 0))).toBe('..');
        });

        it('returns nothing for an empty or blank solution', () => {
            expect(buildAnswerBoxes('', 50)).toEqual([]);
            expect(buildAnswerBoxes('   ', 50)).toEqual([]);
            expect(buildAnswerBoxes(undefined, 50)).toEqual([]);
        });
    });

    describe('letter hints', () => {
        it('gives nothing away at 0%', () => {
            expect(render(buildAnswerBoxes('Valencia', 0))).toBe('........');
        });

        it('gives the whole solution away at 100%', () => {
            expect(render(buildAnswerBoxes('Mio Cid', 100))).toBe('MIO CID');
        });

        it('gives away the share the activity asks for', () => {
            // 50% of 8 characters is 4 letters; the source picks positions 0, 2, 4 and 6.
            const boxes = buildAnswerBoxes('Valencia', 50, false, sequence([0, 0.25, 0.5, 0.75]));

            expect(render(boxes)).toBe('V.L.N.I.');
        });

        it('truncates rather than rounds the number of hints', () => {
            // 35% of 8 is 2.8, so two letters are given away.
            const boxes = buildAnswerBoxes('Valencia', 35, false, sequence([0, 0.125]));

            expect(render(boxes).replace(/\./g, '')).toHaveLength(2);
        });

        it('spends a draw that lands on a space, matching the on-screen behaviour', () => {
            // 'MIO CID' is 7 characters including the space, so 50% asks for 3 positions. The
            // source picks index 3, which is the space, so only two letters actually show.
            const boxes = buildAnswerBoxes('Mio Cid', 50, false, sequence([0, 3 / 7, 6 / 7]));

            expect(render(boxes)).toBe('M.. ..D');
        });

        it('treats a missing percentage as no hints', () => {
            expect(render(buildAnswerBoxes('Valencia', undefined))).toBe('........');
        });

        it('stays exact when the randomness source keeps repeating itself', () => {
            // The runtime retries forever here; a constant source would hang it.
            const boxes = buildAnswerBoxes('Valencia', 50, false, () => 0);

            expect(render(boxes).replace(/\./g, '')).toHaveLength(4);
        });
    });

    describe('case sensitivity', () => {
        it('upper-cases the solution when the activity ignores case', () => {
            expect(render(buildAnswerBoxes('Mio Cid', 100, false))).toBe('MIO CID');
        });

        it('keeps the author casing when the activity is case sensitive', () => {
            expect(render(buildAnswerBoxes('Mio Cid', 100, true))).toBe('Mio Cid');
        });

        it('keeps accents either way', () => {
            expect(render(buildAnswerBoxes('Montañés', 100, true))).toBe('Montañés');
            expect(render(buildAnswerBoxes('Montañés', 100, false))).toBe('MONTAÑÉS');
        });
    });
});

describe('selectCards', () => {
    const cards = ['a', 'b', 'c', 'd', 'e'];

    it('keeps every card when the cap is the editor maximum', () => {
        // Thirty is the highest the editor offers, and means no cap at all.
        expect(selectCards(cards, '30')).toEqual(cards);
        expect(selectCards(cards, 31)).toEqual(cards);
    });

    it('keeps every card when the activity never had the setting', () => {
        expect(selectCards(cards, undefined)).toEqual(cards);
        expect(selectCards(cards, '')).toEqual(cards);
    });

    it('keeps every card when the cap is not below their number', () => {
        expect(selectCards(cards, '5')).toEqual(cards);
        expect(selectCards(cards, '9')).toEqual(cards);
    });

    it('takes as many as the cap allows', () => {
        expect(selectCards(cards, '3', () => 0.5)).toHaveLength(3);
    });

    it('returns them in stored order, a cap not being a reshuffle', () => {
        const taken = selectCards(cards, '3', () => 0.5);

        expect([...taken].sort()).toEqual(taken);
    });

    it('keeps one card at least, whatever the cap says', () => {
        expect(selectCards(cards, '0', () => 0.5)).toHaveLength(1);
        expect(selectCards(cards, '-4', () => 0.5)).toHaveLength(1);
    });

    it('draws a different set as the randomness changes', () => {
        const first = selectCards(cards, '2', () => 0.1);
        const second = selectCards(cards, '2', () => 0.9);

        expect(first).not.toEqual(second);
    });

    it('takes nothing from something that is not a list of cards', () => {
        expect(selectCards(undefined as unknown as string[], '3')).toEqual([]);
    });
});

import { describe, expect, it } from 'vitest';
import {
    aggregateScore,
    computeCompletion,
    gradeCloze,
    gradeDropdown,
    gradeMatchElements,
    gradeMultipleChoice,
    gradeSingleChoice,
    gradeSortableList,
    gradeTrueFalse,
} from './scoring';
import type { CompletionMode, Interaction } from './types';

describe('gradeSingleChoice', () => {
    const answers = [
        ['a', 0],
        ['b', 1],
        ['c', 0],
    ];
    it('scores 1 when the correct option is chosen', () => {
        expect(gradeSingleChoice(answers, 1)).toBe(1);
    });
    it('scores 0 for a wrong or invalid choice', () => {
        expect(gradeSingleChoice(answers, 0)).toBe(0);
        expect(gradeSingleChoice(answers, 9)).toBe(0);
        expect(gradeSingleChoice(answers, null as unknown as number)).toBe(0);
    });
});

describe('gradeMultipleChoice', () => {
    const answers = [
        ['a', 1],
        ['b', 0],
        ['c', 1],
    ];
    it('scores 1 when exactly the correct options are chosen', () => {
        expect(gradeMultipleChoice(answers, [0, 2])).toBe(1);
    });
    it('gives partial credit for a subset of correct options', () => {
        expect(gradeMultipleChoice(answers, [0])).toBe(0.5);
    });
    it('penalizes wrong selections', () => {
        expect(gradeMultipleChoice(answers, [0, 1])).toBe(0);
    });
    it('never returns below zero and handles empty selection', () => {
        expect(gradeMultipleChoice(answers, [1])).toBe(0);
        expect(gradeMultipleChoice(answers, [])).toBe(0);
    });
});

describe('gradeTrueFalse', () => {
    it('scores 1 only when the selected boolean equals the solution', () => {
        expect(gradeTrueFalse(1, 1)).toBe(1);
        expect(gradeTrueFalse(0, 0)).toBe(1);
        expect(gradeTrueFalse(1, 0)).toBe(0);
        expect(gradeTrueFalse(0, 1)).toBe(0);
    });
    it('coerces numeric-string selections', () => {
        expect(gradeTrueFalse(1, '1')).toBe(1);
        expect(gradeTrueFalse(0, '0')).toBe(1);
    });
    it('treats an invalid or missing selection as wrong (never throws)', () => {
        expect(gradeTrueFalse(1, -1)).toBe(0);
        expect(gradeTrueFalse(1, null)).toBe(0);
        expect(gradeTrueFalse(0, undefined)).toBe(0);
        expect(gradeTrueFalse(1, 'x')).toBe(0);
    });
});

describe('gradeDropdown', () => {
    it('scores 1 when every blank matches its correct word', () => {
        expect(gradeDropdown(['Paris', 'Madrid'], ['Paris', 'Madrid'])).toBe(1);
    });

    it('gives correct/total partial credit', () => {
        expect(gradeDropdown(['Paris', 'Madrid'], ['Paris', 'Rome'])).toBe(0.5);
        expect(gradeDropdown(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'x'])).toBe(0.5);
    });

    it('trims both sides but stays case-sensitive', () => {
        expect(gradeDropdown([' Paris '], ['Paris'])).toBe(1);
        expect(gradeDropdown(['Paris'], ['paris'])).toBe(0);
    });

    it('treats missing or empty selections as wrong (no negative score)', () => {
        expect(gradeDropdown(['Paris', 'Madrid'], ['Paris'])).toBe(0.5);
        expect(gradeDropdown(['Paris'], [])).toBe(0);
        expect(gradeDropdown(['Paris'], [''])).toBe(0);
    });

    it('returns 0 when there are no blanks or the input is not an array', () => {
        expect(gradeDropdown([], ['x'])).toBe(0);
        expect(gradeDropdown(null, ['x'])).toBe(0);
        expect(gradeDropdown(['Paris'], null)).toBe(0);
    });
});

describe('gradeCloze', () => {
    it('scores 1 when every blank matches (case-insensitive, trimmed)', () => {
        expect(gradeCloze(['Paris', 'Seine'], ['  paris ', 'SEINE'])).toBe(1);
    });

    it('gives the fraction of blanks answered correctly', () => {
        expect(gradeCloze(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'y'])).toBe(0.5);
    });

    it('collapses internal whitespace before comparing', () => {
        expect(gradeCloze(['New York'], ['new   york'])).toBe(1);
    });

    it('accepts any |-separated variant', () => {
        expect(gradeCloze(['colour|color'], ['Color'])).toBe(1);
        expect(gradeCloze(['colour|color'], ['colour'])).toBe(1);
    });

    it('scores 0 for a wrong or empty answer', () => {
        expect(gradeCloze(['Paris'], ['London'])).toBe(0);
        expect(gradeCloze(['Paris'], [''])).toBe(0);
    });

    it('treats missing learner entries as unanswered', () => {
        expect(gradeCloze(['a', 'b'], ['a'])).toBe(0.5);
        expect(gradeCloze(['a', 'b'], [])).toBe(0);
    });

    it('returns 0 for no blanks or invalid input', () => {
        expect(gradeCloze([], [])).toBe(0);
        expect(gradeCloze(null, ['a'])).toBe(0);
        expect(gradeCloze(['a'], null)).toBe(0);
    });
});

describe('gradeMatchElements', () => {
    const pairs = [
        ['France', 'Paris'],
        ['Spain', 'Madrid'],
        ['Italy', 'Rome'],
    ];

    it('scores 1 when every left is matched to its correct right', () => {
        expect(gradeMatchElements(pairs, ['Paris', 'Madrid', 'Rome'])).toBe(1);
    });

    it('gives partial credit for correct matches over total pairs', () => {
        expect(gradeMatchElements(pairs, ['Paris', 'Rome', 'Madrid'])).toBeCloseTo(1 / 3, 5);
        expect(gradeMatchElements(pairs, ['Paris', 'Madrid', 'Lisbon'])).toBeCloseTo(2 / 3, 5);
    });

    it('scores 0 when nothing matches', () => {
        expect(gradeMatchElements(pairs, ['Rome', 'Paris', 'Madrid'])).toBe(0);
    });

    it('treats blank or missing responses as wrong (denominator stays total pairs)', () => {
        expect(gradeMatchElements(pairs, ['Paris', '', 'Rome'])).toBeCloseTo(2 / 3, 5);
        expect(gradeMatchElements(pairs, ['Paris'])).toBeCloseTo(1 / 3, 5);
        expect(gradeMatchElements(pairs, [])).toBe(0);
    });

    it('treats duplicate right values as interchangeable (matches by text)', () => {
        const dup = [
            ['A', 'same'],
            ['B', 'same'],
        ];
        expect(gradeMatchElements(dup, ['same', 'same'])).toBe(1);
    });

    it('never counts an empty correct answer as satisfied by a blank response', () => {
        const malformed = [
            ['A', ''],
            ['B', 'b'],
        ];
        expect(gradeMatchElements(malformed, ['', 'b'])).toBe(0.5);
    });

    it('coerces non-string pair/response values before comparing', () => {
        expect(
            gradeMatchElements(
                [
                    [1, 2],
                    [3, 4],
                ],
                [2, 4],
            ),
        ).toBe(1);
        expect(
            gradeMatchElements(
                [
                    [1, 2],
                    [3, 4],
                ],
                ['2', '9'],
            ),
        ).toBe(0.5);
    });

    it('returns 0 for empty or non-array pairs', () => {
        expect(gradeMatchElements([], ['x'])).toBe(0);
        expect(gradeMatchElements(null, ['x'])).toBe(0);
        expect(gradeMatchElements(undefined, [])).toBe(0);
    });

    it('tolerates a non-array responses argument', () => {
        expect(gradeMatchElements(pairs, null)).toBe(0);
        expect(gradeMatchElements(pairs, undefined)).toBe(0);
    });
});

describe('gradeSortableList', () => {
    // Correct order is the stored `items` array; the response is the original
    // index of the item at each display position, so position p is correct iff
    // response[p] === p.
    const items = ['a', 'b', 'c', 'd'];

    it('scores 1 when every item is in its correct position', () => {
        expect(gradeSortableList(items, [0, 1, 2, 3])).toBe(1);
    });

    it('scores 0 for a full derangement (no item in place)', () => {
        expect(gradeSortableList(items, [1, 2, 3, 0])).toBe(0);
    });

    it('gives partial credit for a partial ordering', () => {
        expect(gradeSortableList(items, [0, 1, 3, 2])).toBe(0.5);
    });

    it('tolerates string indices from the DOM', () => {
        expect(gradeSortableList(['a', 'b', 'c'], ['0', '1', '2'])).toBe(1);
    });

    it('counts missing trailing positions as wrong (short response)', () => {
        expect(gradeSortableList(['a', 'b', 'c'], [0, 1])).toBeCloseTo(2 / 3, 5);
    });

    it('does not let a null entry falsely match position 0', () => {
        // parseInt(String(null), 10) === NaN, not 0 -> pos0 wrong, pos1 right.
        expect(gradeSortableList(['a', 'b'], [null, 1])).toBe(0.5);
    });

    it('grades duplicate labels by index, not by text', () => {
        expect(gradeSortableList(['x', 'x', 'y'], [1, 0, 2])).toBeCloseTo(1 / 3, 5);
    });

    it('returns 0 for empty, missing or invalid input (never throws)', () => {
        expect(gradeSortableList([], [0, 1])).toBe(0);
        expect(gradeSortableList(null, [0])).toBe(0);
        expect(gradeSortableList(items, null)).toBe(0);
        expect(gradeSortableList(items, 'nonsense')).toBe(0);
    });
});

describe('aggregateScore', () => {
    const question = (id: string): Interaction => ({
        id,
        type: 'question',
        time: 0,
        duration: null,
        pause: true,
        question: { kind: 'singleChoice', prompt: '', answers: [], score: 1, retry: true },
    });
    const note = (id: string): Interaction => ({ id, type: 'note', time: 0, duration: null, pause: true, body: '' });
    const interactions = [question('q1'), question('q2'), question('q3'), note('n1'), note('n2')];

    it('averages achieved fractions over the gradable questions', () => {
        const score = aggregateScore(interactions, { q1: 1, q2: 0.5 });
        expect(score).toMatchObject({ raw: 1.5, max: 3, fraction: 0.5, scaled10: 5, percent: 50 });
    });

    it('counts every interaction in the denominator when scoreNIA is on', () => {
        const score = aggregateScore(interactions, { q1: 1, q2: 0.5 }, true);
        expect(score.max).toBe(5);
        expect(score.fraction).toBeCloseTo(0.3, 5);
    });

    it('returns a zero score when there is nothing gradable', () => {
        expect(aggregateScore([], {})).toMatchObject({ raw: 0, max: 0, fraction: 0, scaled10: 0, percent: 0 });
    });
});

describe('computeCompletion', () => {
    const doc = (mode: string, requiredScore?: number) => ({
        completion: { mode: mode as CompletionMode, requiredScore: requiredScore ?? null },
        interactions: [
            {
                id: 'q1',
                type: 'question',
                time: 0,
                duration: null,
                pause: true,
                question: { kind: 'singleChoice', prompt: '', answers: [], score: 1, retry: true },
            },
            {
                id: 'q2',
                type: 'question',
                time: 1,
                duration: null,
                pause: true,
                question: { kind: 'singleChoice', prompt: '', answers: [], score: 1, retry: true },
            },
        ] as Interaction[],
    });

    it('never auto-completes in none/unknown modes', () => {
        expect(computeCompletion(doc('none'), { watched: true })).toBe(false);
        expect(computeCompletion(doc('manual'), { watched: true })).toBe(false);
    });

    it('completes on watch when the video has been watched', () => {
        expect(computeCompletion(doc('watch'), { watched: false })).toBe(false);
        expect(computeCompletion(doc('watch'), { watched: true })).toBe(true);
    });

    it('requires every question answered in answerRequired mode', () => {
        expect(computeCompletion(doc('answerRequired'), { answeredIds: ['q1'] })).toBe(false);
        expect(computeCompletion(doc('answerRequired'), { answeredIds: ['q1', 'q2'] })).toBe(true);
    });

    it('completes on score threshold', () => {
        const score = { raw: 0, max: 0, fraction: 0, scaled10: 0, percent: 50 };
        expect(computeCompletion(doc('scoreThreshold', 80), { score })).toBe(false);
        expect(computeCompletion(doc('scoreThreshold', 80), { score: { ...score, percent: 90 } })).toBe(true);
    });
});

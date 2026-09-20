import { describe, expect, it } from 'bun:test';
import { indexedQuestions, readPrintableOptions } from './questionSelection';
import type { WorksheetOmissionReason } from './types';

describe('indexedQuestions', () => {
    it('pairs each question with the index the sidecars are keyed by', () => {
        const questions = [{ a: 1 }, { a: 2 }];

        expect(indexedQuestions(questions, {})).toEqual([
            { question: { a: 1 }, index: 0 },
            { question: { a: 2 }, index: 1 },
        ]);
    });

    it('drops an entry that is not a question, keeping the indices of the rest', () => {
        // An imported payload can carry junk where an object belongs; one bad entry must not cost
        // the others their sidecar index.
        const questions = [{ a: 1 }, 'broken', null, { a: 2 }] as unknown[];

        expect(indexedQuestions(questions, {})).toEqual([
            { question: { a: 1 }, index: 0 },
            { question: { a: 2 }, index: 3 },
        ]);
    });

    it('drops an array, which is an object but not a question', () => {
        expect(indexedQuestions([[]] as unknown[], {})).toEqual([]);
    });

    it('reports what it dropped when the caller asks', () => {
        const reasons: WorksheetOmissionReason[] = [];

        indexedQuestions(['broken', { a: 1 }] as unknown[], { onOmission: reason => reasons.push(reason) });

        expect(reasons).toEqual(['invalid-data']);
    });

    it('says nothing when the caller passes no reporter', () => {
        expect(() => indexedQuestions(['broken'] as unknown[], {})).not.toThrow();
    });
});

describe('readPrintableOptions', () => {
    it('offers only as many options as the question declares', () => {
        expect(readPrintableOptions(['A', 'B', 'C', 'D'], 2, false, Math.random)).toEqual(['A', 'B']);
    });

    it('drops the blank padding the editor leaves behind', () => {
        expect(readPrintableOptions(['A', '', '  ', 'B'], 4, false, Math.random)).toEqual(['A', 'B']);
    });

    it('keeps an option whose only content is a picture', () => {
        const options = readPrintableOptions(['<img src="a.png">'], 1, false, Math.random);

        expect(options).toHaveLength(1);
    });

    it('sanitises each option', () => {
        expect(readPrintableOptions(['<b onclick="x()">A</b>'], 1, false, Math.random)).toEqual(['<b>A</b>']);
    });

    it('shuffles when asked', () => {
        const options = readPrintableOptions(['A', 'B', 'C', 'D'], 4, true, () => 0);

        expect([...options].sort()).toEqual(['A', 'B', 'C', 'D']);
        expect(options).not.toEqual(['A', 'B', 'C', 'D']);
    });

    it('falls back to the stored length when the question declares none', () => {
        expect(readPrintableOptions(['A', 'B'], undefined, false, Math.random)).toEqual(['A', 'B']);
    });

    it('returns nothing for a missing options array', () => {
        expect(readPrintableOptions(undefined, 4, false, Math.random)).toEqual([]);
    });
});

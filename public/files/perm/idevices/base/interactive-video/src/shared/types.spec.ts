import { describe, expect, it } from 'vitest';
import { asKnownQuestion, isKnownQuestionKind, isRecord, newDocument } from './types';

describe('newDocument', () => {
    it('returns a fully-defaulted schema-v2 document', () => {
        const doc = newDocument();
        expect(doc.schemaVersion).toBe(2);
        expect(doc.interactions).toEqual([]);
        expect(doc.video.provider).toBe('local');
        expect(doc.completion).toEqual({ mode: 'none', requiredScore: null });
        expect(doc.scorm).toEqual({ enabled: false, weight: 100, repeatActivity: true, showResults: true });
        expect(doc.meta.legacy).toEqual({});
        expect(doc.customTexts).toEqual({});
    });

    it('returns a fresh object every time', () => {
        expect(newDocument()).not.toBe(newDocument());
    });
});

describe('question-kind guards', () => {
    it('recognizes the seven supported kinds and nothing else', () => {
        for (const kind of [
            'singleChoice',
            'multipleChoice',
            'trueFalse',
            'dropdown',
            'cloze',
            'matchElements',
            'sortableList',
        ]) {
            expect(isKnownQuestionKind(kind)).toBe(true);
        }
        expect(isKnownQuestionKind('essay')).toBe(false);
        expect(isKnownQuestionKind('')).toBe(false);
    });

    it('asKnownQuestion narrows only supported kinds', () => {
        const known = { kind: 'cloze' as const, prompt: '', score: 1, retry: true, segments: [] };
        expect(asKnownQuestion(known)).toBe(known);
        expect(asKnownQuestion({ kind: 'essay', prompt: '', score: 1, retry: true })).toBeNull();
    });
});

describe('isRecord', () => {
    it('accepts plain objects only', () => {
        expect(isRecord({})).toBe(true);
        expect(isRecord({ a: 1 })).toBe(true);
        expect(isRecord([])).toBe(false);
        expect(isRecord(null)).toBe(false);
        expect(isRecord('x')).toBe(false);
        expect(isRecord(42)).toBe(false);
    });
});

import { describe, expect, it } from 'bun:test';
import { getSupportedIdeviceTypes, getWorksheetAdapter } from './registry';

describe('worksheet adapter registry', () => {
    it('resolves the adapters it ships', () => {
        expect(getWorksheetAdapter('guess')?.ideviceType).toBe('guess');
        expect(getWorksheetAdapter('crossword')?.ideviceType).toBe('crossword');
        expect(getWorksheetAdapter('quick-questions')?.ideviceType).toBe('quick-questions');
        expect(getWorksheetAdapter('classify')?.ideviceType).toBe('classify');
        expect(getWorksheetAdapter('complete')?.ideviceType).toBe('complete');
        expect(getWorksheetAdapter('quick-questions-multiple-choice')?.ideviceType).toBe(
            'quick-questions-multiple-choice',
        );
    });

    it('returns undefined for iDevices that are not printable yet', () => {
        expect(getWorksheetAdapter('text')).toBeUndefined();
        expect(getWorksheetAdapter('')).toBeUndefined();
    });

    it('lists the supported types', () => {
        expect(getSupportedIdeviceTypes()).toEqual([
            '3dmol',
            'az-quiz-game',
            'beforeafter',
            'classify',
            'complete',
            'crossword',
            'discover',
            'dragdrop',
            'electrical-circuits',
            'flipcards',
            'guess',
            'hidden-image',
            'mathematicaloperations',
            'mathproblems',
            'quick-questions',
            'quick-questions-multiple-choice',
            'relate',
            'sort',
            'word-search',
        ]);
    });

    it('registers every adapter under its own declared type', () => {
        for (const type of getSupportedIdeviceTypes()) {
            expect(getWorksheetAdapter(type)?.ideviceType).toBe(type);
        }
    });
});

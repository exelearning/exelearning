import { describe, expect, it } from 'bun:test';
import { getSupportedIdeviceTypes, getWorksheetAdapter } from './registry';

describe('worksheet adapter registry', () => {
    it('resolves the adapters it ships', () => {
        expect(getWorksheetAdapter('guess')?.ideviceType).toBe('guess');
        expect(getWorksheetAdapter('crossword')?.ideviceType).toBe('crossword');
    });

    it('returns undefined for iDevices that are not printable yet', () => {
        expect(getWorksheetAdapter('quick-questions')).toBeUndefined();
        expect(getWorksheetAdapter('text')).toBeUndefined();
        expect(getWorksheetAdapter('')).toBeUndefined();
    });

    it('lists the supported types', () => {
        expect(getSupportedIdeviceTypes()).toEqual(['crossword', 'guess']);
    });

    it('registers every adapter under its own declared type', () => {
        for (const type of getSupportedIdeviceTypes()) {
            expect(getWorksheetAdapter(type)?.ideviceType).toBe(type);
        }
    });
});

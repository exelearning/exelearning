import { describe, expect, it } from 'bun:test';
import { getSupportedIdeviceTypes, getWorksheetAdapter } from './registry';

describe('worksheet adapter registry', () => {
    it('resolves the guess adapter', () => {
        expect(getWorksheetAdapter('guess')?.ideviceType).toBe('guess');
    });

    it('returns undefined for iDevices that are not printable yet', () => {
        expect(getWorksheetAdapter('quick-questions')).toBeUndefined();
        expect(getWorksheetAdapter('text')).toBeUndefined();
        expect(getWorksheetAdapter('')).toBeUndefined();
    });

    it('lists the supported types', () => {
        expect(getSupportedIdeviceTypes()).toEqual(['guess']);
    });

    it('registers every adapter under its own declared type', () => {
        for (const type of getSupportedIdeviceTypes()) {
            expect(getWorksheetAdapter(type)?.ideviceType).toBe(type);
        }
    });
});

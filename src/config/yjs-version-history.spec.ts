import { describe, expect, it } from 'bun:test';
import {
    DEFAULT_YJS_VERSION_HISTORY_LIMIT,
    getYjsVersionHistoryLimit,
    parseYjsVersionHistoryLimit,
} from './yjs-version-history';

describe('Yjs version history configuration', () => {
    it('uses five versions by default', () => {
        expect(parseYjsVersionHistoryLimit(undefined)).toBe(DEFAULT_YJS_VERSION_HISTORY_LIMIT);
        expect(parseYjsVersionHistoryLimit('')).toBe(DEFAULT_YJS_VERSION_HISTORY_LIMIT);
        expect(parseYjsVersionHistoryLimit('   ')).toBe(DEFAULT_YJS_VERSION_HISTORY_LIMIT);
    });

    it('reads the supplied environment value', () => {
        expect(getYjsVersionHistoryLimit('8')).toBe(8);
    });

    it('accepts zero to disable automatic history creation', () => {
        expect(parseYjsVersionHistoryLimit('0')).toBe(0);
    });

    it('accepts non-negative safe integers', () => {
        expect(parseYjsVersionHistoryLimit('5')).toBe(5);
        expect(parseYjsVersionHistoryLimit(' 12 ')).toBe(12);
    });

    it('rejects invalid values', () => {
        expect(parseYjsVersionHistoryLimit('-1')).toBe(DEFAULT_YJS_VERSION_HISTORY_LIMIT);
        expect(parseYjsVersionHistoryLimit('1.5')).toBe(DEFAULT_YJS_VERSION_HISTORY_LIMIT);
        expect(parseYjsVersionHistoryLimit('five')).toBe(DEFAULT_YJS_VERSION_HISTORY_LIMIT);
        expect(parseYjsVersionHistoryLimit('9007199254740992')).toBe(DEFAULT_YJS_VERSION_HISTORY_LIMIT);
    });
});

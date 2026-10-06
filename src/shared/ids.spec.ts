/**
 * Tests for canonical ID generator (src/shared/ids.ts).
 *
 * Single source of truth for navigation entity IDs — see issue
 * exelearning/exelearning#1782.
 */
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { generateId } from './ids';

describe('generateId', () => {
    it('returns an ID matching the canonical page format', () => {
        const id = generateId('page');
        expect(id).toMatch(/^page-[a-z0-9]{8,}-[a-z0-9]{9}$/);
    });

    it('returns an ID starting with block- for block prefix', () => {
        const id = generateId('block');
        expect(id.startsWith('block-')).toBe(true);
        expect(id).toMatch(/^block-[a-z0-9]{8,}-[a-z0-9]{9}$/);
    });

    it('returns an ID starting with idevice- for idevice prefix', () => {
        const id = generateId('idevice');
        expect(id.startsWith('idevice-')).toBe(true);
        expect(id).toMatch(/^idevice-[a-z0-9]{8,}-[a-z0-9]{9}$/);
    });

    it('produces distinct IDs on consecutive calls', () => {
        const a = generateId('page');
        const b = generateId('page');
        expect(a).not.toBe(b);
    });

    it('throws when the prefix is empty', () => {
        expect(() => generateId('')).toThrow();
    });

    it('throws on a missing prefix argument', () => {
        // Defensive: the runtime guard catches `undefined` too, not only ''.
        expect(() => generateId(undefined as unknown as string)).toThrow();
    });

    describe('random suffix is always exactly 9 chars (#1782)', () => {
        afterEach(() => {
            mock.restore();
        });

        // `Math.random().toString(36)` yields a variable-length tail: a value
        // whose base36 expansion is short (or has dropped trailing chars) leaves
        // fewer than 9 chars after the "0." prefix. Before padding, the suffix
        // was occasionally 8 chars and the {9} assertions above flaked ~1/36.
        for (const value of [0.5, 0.123, 0.000001, 0.9999999999]) {
            it(`pads a short tail from Math.random()=${value} to 9 chars`, () => {
                spyOn(Math, 'random').mockReturnValue(value);
                const id = generateId('page');
                const suffix = id.split('-')[2];
                expect(suffix).toHaveLength(9);
                expect(id).toMatch(/^page-[a-z0-9]{8,}-[a-z0-9]{9}$/);
            });
        }
    });
});

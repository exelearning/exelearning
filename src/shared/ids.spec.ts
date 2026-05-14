/**
 * Tests for canonical ID generator (src/shared/ids.ts).
 *
 * Single source of truth for navigation entity IDs — see issue
 * exelearning/exelearning#1782.
 */
import { describe, it, expect } from 'bun:test';
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
});

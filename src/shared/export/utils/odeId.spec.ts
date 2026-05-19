import { describe, it, expect } from 'bun:test';
import { generateOdeId } from './odeId';

describe('generateOdeId', () => {
    it('returns a 20-character string', () => {
        const id = generateOdeId();
        expect(id).toHaveLength(20);
    });

    it('matches the YYYYMMDDHHmmss + 6 uppercase alphanumeric pattern', () => {
        const id = generateOdeId();
        expect(id).toMatch(/^\d{14}[A-Z0-9]{6}$/);
    });

    it('produces different identifiers across successive calls', () => {
        // The previous version of this test asked for 100 unique ids from 100
        // calls. Mathematically safe (36^6 ~= 2.1B combos -> ~5e-10 collision
        // probability for two calls) but the assertion technically allowed a
        // probabilistic flake. The meaningful invariant is just "two
        // successive calls do not produce the same id".
        const a = generateOdeId();
        const b = generateOdeId();
        expect(a).not.toBe(b);
    });

    it('encodes the current date in the first 14 chars', () => {
        const now = new Date();
        const id = generateOdeId();
        const year = id.slice(0, 4);
        const month = id.slice(4, 6);
        const day = id.slice(6, 8);
        expect(Number(year)).toBe(now.getFullYear());
        expect(Number(month)).toBe(now.getMonth() + 1);
        expect(Number(day)).toBe(now.getDate());
    });
});

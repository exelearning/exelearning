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
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            ids.add(generateOdeId());
        }
        expect(ids.size).toBe(100);
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

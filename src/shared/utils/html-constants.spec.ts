import { describe, expect, it } from 'bun:test';
import { VOID_ELEMENTS } from './html-constants';

describe('VOID_ELEMENTS', () => {
    it('should contain all 14 standard HTML void elements', () => {
        expect(VOID_ELEMENTS).toHaveLength(14);
    });

    it('should include common void elements', () => {
        for (const el of ['input', 'img', 'br', 'hr', 'link', 'meta']) {
            expect(VOID_ELEMENTS).toContain(el);
        }
    });

    it('should be sorted alphabetically', () => {
        const sorted = [...VOID_ELEMENTS].sort();
        expect([...VOID_ELEMENTS]).toEqual(sorted);
    });
});

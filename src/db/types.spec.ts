/**
 * Tests for database type helpers
 */
import { describe, it, expect } from 'bun:test';
import { parseRoles, stringifyRoles, now } from './types';

describe('db types helpers', () => {
    describe('parseRoles', () => {
        it('should parse valid JSON roles array', () => {
            const result = parseRoles('["ROLE_USER", "ROLE_ADMIN"]');
            expect(result).toEqual(['ROLE_USER', 'ROLE_ADMIN']);
        });

        it('should parse empty array', () => {
            const result = parseRoles('[]');
            expect(result).toEqual([]);
        });

        it('should parse single role', () => {
            const result = parseRoles('["ROLE_USER"]');
            expect(result).toEqual(['ROLE_USER']);
        });

        it('should return empty array for invalid JSON', () => {
            const result = parseRoles('{invalid json}');
            expect(result).toEqual([]);
        });

        it('should return empty array for empty string', () => {
            const result = parseRoles('');
            expect(result).toEqual([]);
        });

        it('should return empty array for malformed JSON', () => {
            const result = parseRoles('["ROLE_USER"');
            expect(result).toEqual([]);
        });

        it('should handle non-array JSON by returning parsed value', () => {
            // Note: JSON.parse of a string returns the string, not an array
            const result = parseRoles('"ROLE_USER"');
            expect(result).toBe('ROLE_USER');
        });
    });

    describe('stringifyRoles', () => {
        it('should stringify roles array', () => {
            const result = stringifyRoles(['ROLE_USER', 'ROLE_ADMIN']);
            expect(result).toBe('["ROLE_USER","ROLE_ADMIN"]');
        });

        it('should handle empty array', () => {
            const result = stringifyRoles([]);
            expect(result).toBe('[]');
        });

        it('should handle single role', () => {
            const result = stringifyRoles(['ROLE_USER']);
            expect(result).toBe('["ROLE_USER"]');
        });
    });

    describe('now', () => {
        it('should return Unix timestamp in milliseconds', () => {
            const result = now();
            expect(typeof result).toBe('number');
            // Should be a reasonable timestamp (after 2020)
            expect(result).toBeGreaterThan(1577836800000); // 2020-01-01
        });

        it('should return current time (within 1 second)', () => {
            const before = Date.now();
            const result = now();
            const after = Date.now();
            expect(result).toBeGreaterThanOrEqual(before);
            expect(result).toBeLessThanOrEqual(after);
        });
    });

    describe('parseRoles and stringifyRoles roundtrip', () => {
        it('should roundtrip correctly', () => {
            const original = ['ROLE_USER', 'ROLE_ADMIN', 'ROLE_EDITOR'];
            const stringified = stringifyRoles(original);
            const parsed = parseRoles(stringified);
            expect(parsed).toEqual(original);
        });
    });
});

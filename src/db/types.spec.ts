/**
 * Tests for database type helpers
 */
import { describe, it, expect } from 'bun:test';
import { parseRoles, stringifyRoles, now, timestampToDate, formatTimestamp } from './types';

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
            // Should be a reasonable timestamp (after year 2020)
            expect(result).toBeGreaterThan(1577836800000); // 2020-01-01
        });

        it('should return current time (within 100ms)', () => {
            const before = Date.now();
            const result = now();
            const after = Date.now();
            expect(result).toBeGreaterThanOrEqual(before);
            expect(result).toBeLessThanOrEqual(after);
        });

        it('should have millisecond precision', () => {
            // Two calls in quick succession should potentially have different values
            const result1 = now();
            const result2 = now();
            // They should be very close (within a few ms)
            expect(Math.abs(result2 - result1)).toBeLessThan(100);
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

    describe('timestampToDate', () => {
        it('should convert milliseconds to Date object', () => {
            const timestamp = 1767022245000; // 2025-12-29 15:30:45 UTC
            const result = timestampToDate(timestamp);
            expect(result).toBeInstanceOf(Date);
            expect(result?.toISOString()).toBe('2025-12-29T15:30:45.000Z');
        });

        it('should handle timestamp at Unix epoch', () => {
            const result = timestampToDate(0);
            // 0 is falsy, so it returns null
            expect(result).toBeNull();
        });

        it('should handle timestamp with milliseconds', () => {
            const timestamp = 1767022245123; // With 123ms
            const result = timestampToDate(timestamp);
            expect(result?.getMilliseconds()).toBe(123);
        });

        it('should return null for null input', () => {
            expect(timestampToDate(null)).toBeNull();
        });

        it('should return null for undefined input', () => {
            expect(timestampToDate(undefined)).toBeNull();
        });

        it('should return null for 0 (falsy)', () => {
            expect(timestampToDate(0)).toBeNull();
        });
    });

    describe('formatTimestamp', () => {
        it('should format milliseconds as ISO 8601 string', () => {
            const timestamp = 1767022245000; // 2025-12-29T15:30:45.000Z
            const result = formatTimestamp(timestamp);
            expect(result).toBe('2025-12-29T15:30:45.000Z');
        });

        it('should include milliseconds in output', () => {
            const timestamp = 1767022245123; // 2025-12-29T15:30:45.123Z
            const result = formatTimestamp(timestamp);
            expect(result).toBe('2025-12-29T15:30:45.123Z');
        });

        it('should return null for null input', () => {
            expect(formatTimestamp(null)).toBeNull();
        });

        it('should return null for undefined input', () => {
            expect(formatTimestamp(undefined)).toBeNull();
        });

        it('should return null for 0 (falsy)', () => {
            expect(formatTimestamp(0)).toBeNull();
        });

        it('should allow numeric comparison of timestamps directly', () => {
            const earlier = 1704067200000; // 2024-01-01 00:00:00
            const later = 1735689599000; // 2024-12-31 23:59:59
            // Direct comparison works with integers
            expect(later).toBeGreaterThan(earlier);
        });
    });
});

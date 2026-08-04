/**
 * importResult Tests
 *
 * Unit tests for the import result contract helper.
 *
 * Run with: make test-frontend
 */

import { describe, it, expect } from 'vitest';
import { isImportCancelled } from './importResult.js';

describe('isImportCancelled', () => {
    it('returns true for a cancelled import result', () => {
        expect(isImportCancelled({ cancelled: true })).toBe(true);
    });

    it('returns true for a rejected (zip-limit) import result', () => {
        expect(isImportCancelled({ cancelled: true, error: 'zip-limit' })).toBe(true);
    });

    it('returns false for a successful import statistics object', () => {
        expect(isImportCancelled({ pages: 3, blocks: 5, components: 8 })).toBe(false);
    });

    it('returns false when cancelled is not strictly true', () => {
        expect(isImportCancelled({ cancelled: false })).toBe(false);
        expect(isImportCancelled({ cancelled: 'yes' })).toBe(false);
    });

    it('returns false for null or undefined results', () => {
        expect(isImportCancelled(null)).toBe(false);
        expect(isImportCancelled(undefined)).toBe(false);
    });
});

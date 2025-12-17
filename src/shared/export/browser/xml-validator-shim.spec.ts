import { describe, it, expect } from 'bun:test';
import { validateXml, formatValidationErrors, type ValidationResult } from './xml-validator-shim';

describe('xml-validator-shim (browser)', () => {
    describe('validateXml', () => {
        it('should always return valid result', () => {
            const result = validateXml('<xml></xml>');
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should return valid even for malformed XML (no-op in browser)', () => {
            const result = validateXml('not xml at all');
            expect(result.valid).toBe(true);
        });
    });

    describe('formatValidationErrors', () => {
        it('should return empty string', () => {
            const result: ValidationResult = { valid: false, errors: ['test'], warnings: [] };
            expect(formatValidationErrors(result)).toBe('');
        });
    });
});

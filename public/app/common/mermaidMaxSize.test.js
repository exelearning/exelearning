/**
 * Unit tests for Mermaid max-size utility functions.
 */
import {
    normalizeDimension,
    isValidDimension,
    getStyleValue,
    buildMaxSizeStyle,
    validateMaxSizeFields,
} from './mermaidMaxSize.js';

describe('normalizeDimension', () => {
    it('trims leading and trailing whitespace', () => {
        expect(normalizeDimension(' 800px ')).toBe('800px');
        expect(normalizeDimension('  40em  ')).toBe('40em');
    });

    it('returns empty string for non-string input', () => {
        expect(normalizeDimension(null)).toBe('');
        expect(normalizeDimension(undefined)).toBe('');
        expect(normalizeDimension(800)).toBe('');
    });

    it('returns empty string for empty input', () => {
        expect(normalizeDimension('')).toBe('');
    });

    it('leaves already-trimmed values unchanged', () => {
        expect(normalizeDimension('50%')).toBe('50%');
    });
});

describe('isValidDimension', () => {
    it('accepts empty string (optional field)', () => {
        expect(isValidDimension('')).toBe(true);
    });

    it('accepts valid px value', () => {
        expect(isValidDimension('800px')).toBe(true);
    });

    it('accepts valid percentage value', () => {
        expect(isValidDimension('50%')).toBe(true);
    });

    it('accepts valid em value', () => {
        expect(isValidDimension('40em')).toBe(true);
    });

    it('accepts valid rem value', () => {
        expect(isValidDimension('30rem')).toBe(true);
    });

    it('accepts decimal values', () => {
        expect(isValidDimension('12.5em')).toBe(true);
        expect(isValidDimension('33.3%')).toBe(true);
    });

    it('rejects zero values', () => {
        expect(isValidDimension('0px')).toBe(false);
        expect(isValidDimension('0.0em')).toBe(false);
        expect(isValidDimension('0%')).toBe(false);
    });

    it('rejects unsupported units', () => {
        expect(isValidDimension('200vh')).toBe(false);
        expect(isValidDimension('100vw')).toBe(false);
        expect(isValidDimension('50dvw')).toBe(false);
    });

    it('rejects bare numbers without units', () => {
        expect(isValidDimension('800')).toBe(false);
    });

    it('rejects CSS injection attempts', () => {
        expect(isValidDimension('800px;color:red')).toBe(false);
    });
});

describe('getStyleValue', () => {
    it('returns normalized value for valid input', () => {
        expect(getStyleValue(' 800px ')).toBe('800px');
        expect(getStyleValue('50%')).toBe('50%');
    });

    it('returns empty string for invalid input', () => {
        expect(getStyleValue('800')).toBe('');
        expect(getStyleValue('200vh')).toBe('');
        expect(getStyleValue('0px')).toBe('');
    });

    it('returns empty string for empty input', () => {
        expect(getStyleValue('')).toBe('');
    });
});

describe('buildMaxSizeStyle', () => {
    it('generates both max-width and max-height', () => {
        expect(buildMaxSizeStyle('800px', '60%')).toBe('max-width:800px;max-height:60%');
    });

    it('supports em units', () => {
        expect(buildMaxSizeStyle('40em', '25em')).toBe('max-width:40em;max-height:25em');
    });

    it('supports rem units', () => {
        expect(buildMaxSizeStyle('30rem', '20rem')).toBe('max-width:30rem;max-height:20rem');
    });

    it('trims values before generating style', () => {
        expect(buildMaxSizeStyle(' 800px ', ' 60% ')).toBe('max-width:800px;max-height:60%');
    });

    it('ignores invalid units', () => {
        expect(buildMaxSizeStyle('800', '200vh')).toBe('');
    });

    it('ignores CSS injection attempts', () => {
        expect(buildMaxSizeStyle('800px;color:red', '50%')).toBe('max-height:50%');
    });

    it('allows decimal values', () => {
        expect(buildMaxSizeStyle('12.5em', '33.3%')).toBe('max-width:12.5em;max-height:33.3%');
    });

    it('returns only max-width when max-height is empty', () => {
        expect(buildMaxSizeStyle('800px', '')).toBe('max-width:800px');
    });

    it('returns only max-height when max-width is empty', () => {
        expect(buildMaxSizeStyle('', '60%')).toBe('max-height:60%');
    });

    it('returns empty string when both values are empty', () => {
        expect(buildMaxSizeStyle('', '')).toBe('');
    });

    it('ignores zero values', () => {
        expect(buildMaxSizeStyle('0px', '0%')).toBe('');
        expect(buildMaxSizeStyle('0.0em', '50%')).toBe('max-height:50%');
    });
});

describe('validateMaxSizeFields', () => {
    it('accepts valid values', () => {
        const result = validateMaxSizeFields('800px', '50%');
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('trims values and returns normalized result', () => {
        const result = validateMaxSizeFields(' 40em ', ' 33.3% ');
        expect(result.isValid).toBe(true);
        expect(result.maxWidth).toBe('40em');
        expect(result.maxHeight).toBe('33.3%');
    });

    it('accepts rem values', () => {
        const result = validateMaxSizeFields('30rem', '20rem');
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('accepts empty values (both fields are optional)', () => {
        const result = validateMaxSizeFields('', '');
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects invalid max-width', () => {
        const result = validateMaxSizeFields('800', '50%');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('invalid-max-width');
    });

    it('rejects invalid max-height', () => {
        const result = validateMaxSizeFields('800px', '10vh');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('invalid-max-height');
    });

    it('rejects both invalid values', () => {
        const result = validateMaxSizeFields('abc', 'def');
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(['invalid-max-width', 'invalid-max-height']);
    });

    it('rejects zero values', () => {
        const result = validateMaxSizeFields('0px', '0%');
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(['invalid-max-width', 'invalid-max-height']);
    });
});

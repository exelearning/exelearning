import { describe, it, expect } from 'bun:test';
import { trans } from './translation-shim';

describe('translation-shim (browser)', () => {
    it('should return the input string unchanged', () => {
        expect(trans('Proprietary license')).toBe('Proprietary license');
    });

    it('should ignore parameters and locale', () => {
        expect(trans('Hello %name%', { '%name%': 'World' }, 'es')).toBe('Hello %name%');
    });

    it('should handle empty string', () => {
        expect(trans('')).toBe('');
    });
});

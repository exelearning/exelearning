import { describe, it, expect } from 'vitest';
import { escapeCssAttributeValue } from './webmcpDomUtils.js';

describe('escapeCssAttributeValue', () => {
    it('returns plain values unchanged', () => {
        expect(escapeCssAttributeValue('page-1')).toBe('page-1');
    });

    it('escapes double quotes', () => {
        expect(escapeCssAttributeValue('a"b')).toBe('a\\"b');
    });

    it('escapes backslashes before quotes so escaping cannot be broken out of', () => {
        // A lone backslash followed by a quote must not collapse into an
        // unescaped quote. Backslash -> \\ and quote -> \" independently.
        expect(escapeCssAttributeValue('a\\"b')).toBe('a\\\\\\"b');
    });

    it('escapes a standalone backslash', () => {
        expect(escapeCssAttributeValue('a\\b')).toBe('a\\\\b');
    });

    it('coerces non-string input', () => {
        expect(escapeCssAttributeValue(42)).toBe('42');
    });
});

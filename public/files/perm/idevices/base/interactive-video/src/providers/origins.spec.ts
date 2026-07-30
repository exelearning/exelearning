import { describe, expect, it } from 'vitest';
import { isHttpOrigin, locationOrigin, originOf } from './origins';

describe('isHttpOrigin', () => {
    it('accepts only real http(s) origins', () => {
        expect(isHttpOrigin('https://example.com')).toBe(true);
        expect(isHttpOrigin('http://localhost:3001')).toBe(true);
        expect(isHttpOrigin('null')).toBe(false);
        expect(isHttpOrigin('file:///x')).toBe(false);
        expect(isHttpOrigin(undefined)).toBe(false);
    });
});

describe('locationOrigin', () => {
    it('returns the page origin defensively', () => {
        // vitest.setup.js pins window.location.origin to http://localhost:3001
        expect(locationOrigin()).toBe('http://localhost:3001');
    });
});

describe('originOf', () => {
    it('extracts the origin of an absolute URL', () => {
        expect(originOf('https://www.youtube-nocookie.com/embed/x?a=1')).toBe('https://www.youtube-nocookie.com');
    });

    it('resolves relative URLs against the page origin', () => {
        expect(originOf('/embed/x')).toBe('http://localhost:3001');
    });

    it('returns an empty string for unparseable input', () => {
        expect(originOf('')).not.toBeUndefined();
        expect(typeof originOf(null)).toBe('string');
    });
});

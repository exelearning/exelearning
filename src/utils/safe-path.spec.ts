import * as nodePath from 'path';
import {
    assertSafePathSegment,
    isSafePathSegment,
    isWithinBase,
    safeJoin,
    sanitizeFileExtension,
    UnsafePathError,
} from './safe-path';

describe('safe-path', () => {
    describe('isSafePathSegment', () => {
        it('accepts plain identifiers (UUIDs, slugs, timestamps)', () => {
            expect(isSafePathSegment('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
            expect(isSafePathSegment('my_theme-01')).toBe(true);
            expect(isSafePathSegment('20240131120000abcDEF')).toBe(true);
        });

        it('rejects non-string input', () => {
            expect(isSafePathSegment(undefined)).toBe(false);
            expect(isSafePathSegment(null)).toBe(false);
            expect(isSafePathSegment(123 as unknown)).toBe(false);
        });

        it('rejects empty and over-long segments', () => {
            expect(isSafePathSegment('')).toBe(false);
            expect(isSafePathSegment('a'.repeat(256))).toBe(false);
            expect(isSafePathSegment('a'.repeat(255))).toBe(true);
            expect(isSafePathSegment('abc', { maxLength: 2 })).toBe(false);
        });

        it('rejects traversal tokens', () => {
            expect(isSafePathSegment('.')).toBe(false);
            expect(isSafePathSegment('..')).toBe(false);
        });

        it('rejects path separators (forward and back slash)', () => {
            expect(isSafePathSegment('../etc')).toBe(false);
            expect(isSafePathSegment('a/b')).toBe(false);
            expect(isSafePathSegment('a\\b')).toBe(false);
            expect(isSafePathSegment('..\\..\\windows')).toBe(false);
        });

        it('rejects NUL and control characters', () => {
            const nul = String.fromCharCode(0);
            const unit = String.fromCharCode(31);
            const del = String.fromCharCode(127);
            expect(isSafePathSegment(`file${nul}.png`)).toBe(false);
            expect(isSafePathSegment('a\tb')).toBe(false);
            expect(isSafePathSegment(`a${unit}b`)).toBe(false);
            expect(isSafePathSegment(`a${del}b`)).toBe(false);
        });

        it('rejects dots unless allowDots is set', () => {
            expect(isSafePathSegment('name.ext')).toBe(false);
            expect(isSafePathSegment('name.ext', { allowDots: true })).toBe(true);
        });

        it('still rejects "." and ".." even with allowDots', () => {
            expect(isSafePathSegment('..', { allowDots: true })).toBe(false);
            expect(isSafePathSegment('.', { allowDots: true })).toBe(false);
        });
    });

    describe('assertSafePathSegment', () => {
        it('returns the segment when valid', () => {
            expect(assertSafePathSegment('valid-id')).toBe('valid-id');
        });

        it('throws UnsafePathError with the provided label', () => {
            expect(() => assertSafePathSegment('../x', { label: 'clientId' })).toThrow(UnsafePathError);
            try {
                assertSafePathSegment('../x', { label: 'clientId' });
            } catch (e) {
                expect((e as Error).message).toBe('Invalid clientId');
            }
        });
    });

    describe('isWithinBase', () => {
        it('accepts paths inside the base', () => {
            expect(isWithinBase('/data/assets', 'uuid.png')).toBe(true);
            expect(isWithinBase('/data/assets', 'sub/uuid.png')).toBe(true);
        });

        it('accepts the base itself', () => {
            expect(isWithinBase('/data/assets', '.')).toBe(true);
        });

        it('rejects traversal escaping the base', () => {
            expect(isWithinBase('/data/assets', '../../etc/passwd')).toBe(false);
            expect(isWithinBase('/data/assets', '../secret')).toBe(false);
        });

        it('rejects sibling directories that share a name prefix (no naive startsWith bypass)', () => {
            // The classic bug: /data/assets-evil should NOT count as inside /data/assets
            expect(isWithinBase('/data/assets', '../assets-evil/x')).toBe(false);
        });
    });

    describe('safeJoin', () => {
        const base = nodePath.join(nodePath.sep, 'data', 'assets');

        it('joins valid segments inside the base', () => {
            const result = safeJoin(base, 'project-uuid', 'asset-id.png');
            expect(result).toBe(nodePath.join(base, 'project-uuid', 'asset-id.png'));
        });

        it('throws on a traversal segment instead of escaping the base', () => {
            expect(() => safeJoin(base, '..', '..', 'tmp', 'pwned')).toThrow(UnsafePathError);
            expect(() => safeJoin(base, '../../../../tmp/pwned')).toThrow(UnsafePathError);
        });

        it('throws on separators embedded in a segment', () => {
            expect(() => safeJoin(base, 'a/b')).toThrow(UnsafePathError);
        });
    });

    describe('sanitizeFileExtension', () => {
        it('returns a safe lowercased extension', () => {
            expect(sanitizeFileExtension('image.PNG')).toBe('.png');
            expect(sanitizeFileExtension('archive.tar')).toBe('.tar');
        });

        it('returns empty string when there is no extension', () => {
            expect(sanitizeFileExtension('noext')).toBe('');
            expect(sanitizeFileExtension('')).toBe('');
        });

        it('rejects extensions with unsafe characters or excessive length', () => {
            expect(sanitizeFileExtension('evil.php/../x')).toBe('');
            expect(sanitizeFileExtension(`x.${'a'.repeat(20)}`)).toBe('');
        });

        it('returns empty string for non-string input', () => {
            expect(sanitizeFileExtension(undefined)).toBe('');
            expect(sanitizeFileExtension(null)).toBe('');
        });
    });
});

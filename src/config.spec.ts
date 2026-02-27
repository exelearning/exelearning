import { describe, it, expect } from 'bun:test';
import { ALLOWED_EXTENSIONS, deriveFilenameFromMime, getExtensionFromMimeType } from './config';

describe('config', () => {
    describe('ALLOWED_EXTENSIONS', () => {
        it('contains expected common extensions', () => {
            expect(ALLOWED_EXTENSIONS).toContain('jpg');
            expect(ALLOWED_EXTENSIONS).toContain('png');
            expect(ALLOWED_EXTENSIONS).toContain('svg');
            expect(ALLOWED_EXTENSIONS).toContain('mp3');
            expect(ALLOWED_EXTENSIONS).toContain('mp4');
            expect(ALLOWED_EXTENSIONS).toContain('pdf');
            expect(ALLOWED_EXTENSIONS).toContain('json');
            expect(ALLOWED_EXTENSIONS).toContain('woff2');
        });

        it('contains unique extension entries', () => {
            const unique = new Set(ALLOWED_EXTENSIONS);
            expect(unique.size).toBe(ALLOWED_EXTENSIONS.length);
        });
    });

    describe('getExtensionFromMimeType', () => {
        it('returns extension without dot by default', () => {
            expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg');
            expect(getExtensionFromMimeType('audio/mp4')).toBe('m4a');
            expect(getExtensionFromMimeType('application/json')).toBe('json');
        });

        it('returns extension with dot when requested', () => {
            expect(getExtensionFromMimeType('image/jpeg', true)).toBe('.jpg');
            expect(getExtensionFromMimeType('application/pdf', true)).toBe('.pdf');
        });

        it('is case-insensitive and handles aliases', () => {
            expect(getExtensionFromMimeType('IMAGE/JPEG')).toBe('jpg');
            expect(getExtensionFromMimeType('image/jpg')).toBe('jpg');
        });

        it('returns bin for unknown or empty MIME type', () => {
            expect(getExtensionFromMimeType('unknown/type')).toBe('bin');
            expect(getExtensionFromMimeType('')).toBe('bin');
            expect(getExtensionFromMimeType('', true)).toBe('.bin');
        });
    });

    describe('deriveFilenameFromMime', () => {
        it('builds deterministic fallback filename from asset id and mime', () => {
            expect(deriveFilenameFromMime('1234567890abcdef', 'image/png')).toBe('asset-12345678.png');
        });

        it('falls back to bin extension for unknown mime', () => {
            expect(deriveFilenameFromMime('abcdef123456', 'unknown/type')).toBe('asset-abcdef12.bin');
        });
    });
});

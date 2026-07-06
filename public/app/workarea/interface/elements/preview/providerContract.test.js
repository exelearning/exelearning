import { describe, it, expect } from 'vitest';
import {
    MSG,
    PreviewProviderError,
    PreviewSessionExpiredError,
    sanitizePagePath,
} from './providerContract.js';

describe('providerContract', () => {
    describe('MSG constants', () => {
        it('defines the preview message types', () => {
            expect(MSG.NAV_REPORT).toBe('exe-preview-nav');
            expect(MSG.NAVIGATE).toBe('exe-preview-navigate');
            expect(MSG.OPEN_DOC).toBe('exe-preview-open-document');
            expect(MSG.DOWNLOAD_ELPX).toBe('exe-download-elpx');
            expect(MSG.PRINT).toBe('exe-print');
        });
    });

    describe('error classes', () => {
        it('are Error subclasses with names', () => {
            const expired = new PreviewSessionExpiredError('gone');
            const generic = new PreviewProviderError('boom');
            expect(expired).toBeInstanceOf(Error);
            expect(expired.name).toBe('PreviewSessionExpiredError');
            expect(generic).toBeInstanceOf(Error);
            expect(generic.name).toBe('PreviewProviderError');
            expect(generic.message).toBe('boom');
        });
    });

    describe('sanitizePagePath', () => {
        it('accepts and normalizes relative page paths', () => {
            expect(sanitizePagePath('index.html')).toBe('index.html');
            expect(sanitizePagePath('html/page2.html')).toBe('html/page2.html');
            expect(sanitizePagePath('html/../index.html')).toBe('index.html');
        });

        it('rejects non-strings', () => {
            expect(sanitizePagePath(null)).toBeNull();
            expect(sanitizePagePath(42)).toBeNull();
            expect(sanitizePagePath({})).toBeNull();
        });

        it('rejects oversized values', () => {
            expect(sanitizePagePath('a'.repeat(2049))).toBeNull();
        });

        it('rejects protocol URLs and protocol-relative URLs', () => {
            expect(sanitizePagePath('javascript:alert(1)')).toBeNull();
            expect(sanitizePagePath('https://evil.example/x.html')).toBeNull();
            expect(sanitizePagePath('//evil.example/x.html')).toBeNull();
        });

        it('rejects paths that escape the root', () => {
            expect(sanitizePagePath('../../secret.html')).toBeNull();
            expect(sanitizePagePath('html/../../secret.html')).toBeNull();
        });

        it('rejects empty results', () => {
            expect(sanitizePagePath('')).toBeNull();
            expect(sanitizePagePath('./')).toBeNull();
        });
    });
});

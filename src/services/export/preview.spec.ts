/**
 * Tests for Preview Service Helper
 * Tests pure functions directly - no mock.module needed
 */
import { describe, it, expect } from 'bun:test';

import {
    generateRandomTempPath,
    buildPreviewUrl,
    buildFilePath,
    buildFallbackFilePath,
    getMimeType,
    validateUrlParams,
    extractSessionPathComponents,
} from './preview';

describe('Preview Service Helper', () => {
    describe('generateRandomTempPath', () => {
        it('should generate a 6-character hex string with trailing slash', () => {
            const result = generateRandomTempPath();
            expect(result).toMatch(/^[0-9a-f]{6}\/$/);
        });

        it('should generate different values on each call', () => {
            const results = new Set<string>();
            for (let i = 0; i < 100; i++) {
                results.add(generateRandomTempPath());
            }
            // With 3 bytes (6 hex chars), collision probability is very low
            expect(results.size).toBeGreaterThan(95);
        });
    });

    describe('buildPreviewUrl', () => {
        it('should build date-based URL for session IDs starting with 8 digits', () => {
            const result = buildPreviewUrl('20250116abc123', 'a3f5d2/', 'index.html');
            expect(result).toBe('/files/tmp/2025/01/16/20250116abc123/export/a3f5d2/index.html');
        });

        it('should build URL with nested file path', () => {
            const result = buildPreviewUrl('20250116abc123', 'temp/', 'pages/page1.html');
            expect(result).toBe('/files/tmp/2025/01/16/20250116abc123/export/temp/pages/page1.html');
        });

        it('should build fallback URL for non-date session IDs', () => {
            const result = buildPreviewUrl('simple-session-id', 'temp/', 'index.html');
            expect(result).toBe('/files/tmp/simple-session-id/export/temp/index.html');
        });

        it('should build fallback URL for short session IDs', () => {
            const result = buildPreviewUrl('short', 'x/', 'file.html');
            expect(result).toBe('/files/tmp/short/export/x/file.html');
        });

        it('should handle empty temp path', () => {
            const result = buildPreviewUrl('20250116abc123', '', 'index.html');
            expect(result).toBe('/files/tmp/2025/01/16/20250116abc123/export/index.html');
        });
    });

    describe('buildFilePath', () => {
        it('should build file path from components', () => {
            const result = buildFilePath('/data/files', '2025', '01', '16', 'random123', 'export', 'index.html');
            expect(result).toBe('/data/files/2025/01/16/random123/export/index.html');
        });

        it('should handle nested subdirectories', () => {
            const result = buildFilePath('/tmp', '2025', '06', '01', 'sess123', 'pages', 'page1.html');
            expect(result).toBe('/tmp/2025/06/01/sess123/pages/page1.html');
        });
    });

    describe('buildFallbackFilePath', () => {
        it('should build fallback path with tmp subdirectory', () => {
            const result = buildFallbackFilePath(
                '/data/files',
                '2025',
                '01',
                '16',
                'random123',
                'export',
                'index.html',
            );
            expect(result).toBe('/data/files/tmp/2025/01/16/random123/export/index.html');
        });
    });

    describe('getMimeType', () => {
        it('should detect HTML mime type', () => {
            expect(getMimeType('index.html')).toBe('text/html');
        });

        it('should detect CSS mime type', () => {
            expect(getMimeType('styles/main.css')).toBe('text/css');
        });

        it('should detect JavaScript mime type', () => {
            // mime-types returns 'text/javascript' which is also valid
            expect(getMimeType('scripts/app.js')).toBe('text/javascript');
        });

        it('should detect image mime types', () => {
            expect(getMimeType('image.png')).toBe('image/png');
            expect(getMimeType('photo.jpg')).toBe('image/jpeg');
            expect(getMimeType('icon.gif')).toBe('image/gif');
            expect(getMimeType('logo.svg')).toBe('image/svg+xml');
        });

        it('should detect font mime types', () => {
            expect(getMimeType('font.woff')).toBe('font/woff');
            expect(getMimeType('font.woff2')).toBe('font/woff2');
            expect(getMimeType('font.ttf')).toBe('font/ttf');
        });

        it('should detect JSON mime type', () => {
            expect(getMimeType('data.json')).toBe('application/json');
        });

        it('should return octet-stream for unknown extensions', () => {
            // .xyz is actually a known mime type (chemical/x-xyz), use truly unknown extension
            expect(getMimeType('file.unknownext12345')).toBe('application/octet-stream');
            expect(getMimeType('noextension')).toBe('application/octet-stream');
        });

        it('should handle paths with directories', () => {
            expect(getMimeType('/path/to/file.html')).toBe('text/html');
            expect(getMimeType('some/deep/path/style.css')).toBe('text/css');
        });
    });

    describe('validateUrlParams', () => {
        it('should validate correct date parameters', () => {
            expect(validateUrlParams('2025', '01', '16')).toBe(true);
            expect(validateUrlParams('2024', '12', '31')).toBe(true);
            expect(validateUrlParams('1999', '06', '01')).toBe(true);
        });

        it('should reject invalid year format', () => {
            expect(validateUrlParams('25', '01', '16')).toBe(false);
            expect(validateUrlParams('20250', '01', '16')).toBe(false);
            expect(validateUrlParams('abcd', '01', '16')).toBe(false);
            expect(validateUrlParams('', '01', '16')).toBe(false);
        });

        it('should reject invalid month format', () => {
            expect(validateUrlParams('2025', '1', '16')).toBe(false);
            expect(validateUrlParams('2025', '123', '16')).toBe(false);
            expect(validateUrlParams('2025', 'ab', '16')).toBe(false);
            expect(validateUrlParams('2025', '', '16')).toBe(false);
        });

        it('should reject invalid day format', () => {
            expect(validateUrlParams('2025', '01', '6')).toBe(false);
            expect(validateUrlParams('2025', '01', '160')).toBe(false);
            expect(validateUrlParams('2025', '01', 'xy')).toBe(false);
            expect(validateUrlParams('2025', '01', '')).toBe(false);
        });
    });

    describe('extractSessionPathComponents', () => {
        it('should extract components from date-based path', () => {
            const result = extractSessionPathComponents('/data/files/tmp/2025/01/16/session123');
            expect(result).toEqual({
                year: '2025',
                month: '01',
                day: '16',
                sessionId: 'session123',
            });
        });

        it('should extract components from Windows-style path', () => {
            const result = extractSessionPathComponents('C:\\data\\files\\tmp\\2025\\01\\16\\session123');
            expect(result).toEqual({
                year: '2025',
                month: '01',
                day: '16',
                sessionId: 'session123',
            });
        });

        it('should extract components from deep nested path', () => {
            const result = extractSessionPathComponents('/very/deep/nested/path/2024/12/31/mysession');
            expect(result).toEqual({
                year: '2024',
                month: '12',
                day: '31',
                sessionId: 'mysession',
            });
        });

        it('should return fallback structure for tmp-based paths', () => {
            const result = extractSessionPathComponents('/data/files/tmp/simple-session');
            expect(result).toEqual({
                sessionId: 'simple-session',
                isFallback: true,
            });
        });

        it('should return null for invalid paths', () => {
            expect(extractSessionPathComponents('/short')).toBeNull();
            expect(extractSessionPathComponents('')).toBeNull();
            expect(extractSessionPathComponents('/')).toBeNull();
        });

        it('should return null for paths without valid date structure', () => {
            // Path too short and no tmp parent
            expect(extractSessionPathComponents('/invalid/path')).toBeNull();
        });

        it('should handle path with only session and tmp', () => {
            const result = extractSessionPathComponents('tmp/session123');
            expect(result).toEqual({
                sessionId: 'session123',
                isFallback: true,
            });
        });

        it('should handle trailing slashes', () => {
            const result = extractSessionPathComponents('/data/tmp/2025/01/16/session123/');
            // Trailing slash creates empty segment which is filtered out
            expect(result).toEqual({
                year: '2025',
                month: '01',
                day: '16',
                sessionId: 'session123',
            });
        });
    });
});

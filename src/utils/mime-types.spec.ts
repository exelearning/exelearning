/**
 * MIME Types Utility Tests
 * Tests for static file MIME type mappings
 */
import { describe, it, expect } from 'bun:test';
import { MIME_TYPES, getMimeType } from './mime-types';

describe('MIME Types Utility', () => {
    describe('MIME_TYPES constant', () => {
        it('should have correct MIME type for JavaScript files', () => {
            expect(MIME_TYPES['.js']).toBe('application/javascript');
            expect(MIME_TYPES['.mjs']).toBe('application/javascript');
        });

        it('should have correct MIME type for CSS files', () => {
            expect(MIME_TYPES['.css']).toBe('text/css');
        });

        it('should have correct MIME type for JSON files', () => {
            expect(MIME_TYPES['.json']).toBe('application/json');
        });

        it('should have correct MIME type for HTML files', () => {
            expect(MIME_TYPES['.html']).toBe('text/html');
            expect(MIME_TYPES['.htm']).toBe('text/html');
        });

        it('should have correct MIME type for SVG files', () => {
            expect(MIME_TYPES['.svg']).toBe('image/svg+xml');
        });

        it('should have correct MIME type for PNG files', () => {
            expect(MIME_TYPES['.png']).toBe('image/png');
        });

        it('should have correct MIME type for JPEG files', () => {
            expect(MIME_TYPES['.jpg']).toBe('image/jpeg');
            expect(MIME_TYPES['.jpeg']).toBe('image/jpeg');
        });

        it('should have correct MIME type for GIF files', () => {
            expect(MIME_TYPES['.gif']).toBe('image/gif');
        });

        it('should have correct MIME type for WebP files', () => {
            expect(MIME_TYPES['.webp']).toBe('image/webp');
        });

        it('should have correct MIME type for ICO files', () => {
            expect(MIME_TYPES['.ico']).toBe('image/x-icon');
        });

        it('should have correct MIME type for font files', () => {
            expect(MIME_TYPES['.woff']).toBe('font/woff');
            expect(MIME_TYPES['.woff2']).toBe('font/woff2');
            expect(MIME_TYPES['.ttf']).toBe('font/ttf');
            expect(MIME_TYPES['.eot']).toBe('application/vnd.ms-fontobject');
        });

        it('should have correct MIME type for audio files', () => {
            expect(MIME_TYPES['.mp3']).toBe('audio/mpeg');
            expect(MIME_TYPES['.ogg']).toBe('audio/ogg');
        });

        it('should have correct MIME type for video files', () => {
            expect(MIME_TYPES['.mp4']).toBe('video/mp4');
            expect(MIME_TYPES['.webm']).toBe('video/webm');
        });

        it('should have correct MIME type for document files', () => {
            expect(MIME_TYPES['.pdf']).toBe('application/pdf');
            expect(MIME_TYPES['.xml']).toBe('application/xml');
            expect(MIME_TYPES['.txt']).toBe('text/plain');
        });

        it('should have correct MIME type for archive files', () => {
            expect(MIME_TYPES['.zip']).toBe('application/zip');
        });
    });

    describe('getMimeType function', () => {
        it('should return correct MIME type for known extensions', () => {
            expect(getMimeType('.svg')).toBe('image/svg+xml');
            expect(getMimeType('.png')).toBe('image/png');
            expect(getMimeType('.js')).toBe('application/javascript');
            expect(getMimeType('.css')).toBe('text/css');
        });

        it('should handle uppercase extensions', () => {
            expect(getMimeType('.SVG')).toBe('image/svg+xml');
            expect(getMimeType('.PNG')).toBe('image/png');
            expect(getMimeType('.JS')).toBe('application/javascript');
        });

        it('should handle mixed case extensions', () => {
            expect(getMimeType('.Svg')).toBe('image/svg+xml');
            expect(getMimeType('.JpG')).toBe('image/jpeg');
        });

        it('should return application/octet-stream for unknown extensions', () => {
            expect(getMimeType('.unknown')).toBe('application/octet-stream');
            expect(getMimeType('.xyz')).toBe('application/octet-stream');
            expect(getMimeType('.abc123')).toBe('application/octet-stream');
        });

        it('should return application/octet-stream for empty extension', () => {
            expect(getMimeType('')).toBe('application/octet-stream');
        });

        it('should handle extension without dot', () => {
            // Extension should include dot, but function handles both
            expect(getMimeType('svg')).toBe('application/octet-stream');
        });
    });

    describe('Theme icon use case', () => {
        // This test specifically validates the fix for broken theme icons
        it('should correctly serve SVG theme icons with image/svg+xml', () => {
            // Theme icons are served from URLs like:
            // /v0.0.0-alpha/files/perm/themes/base/flux/icons/search.svg
            const iconExtension = '.svg';
            const mimeType = getMimeType(iconExtension);

            expect(mimeType).toBe('image/svg+xml');
            expect(mimeType).not.toBe('text/plain'); // This was the bug!
        });

        it('should correctly serve PNG theme icons', () => {
            expect(getMimeType('.png')).toBe('image/png');
        });

        it('should correctly serve GIF theme icons', () => {
            expect(getMimeType('.gif')).toBe('image/gif');
        });

        it('should correctly serve JPEG theme icons', () => {
            expect(getMimeType('.jpg')).toBe('image/jpeg');
            expect(getMimeType('.jpeg')).toBe('image/jpeg');
        });
    });
});

import { describe, it, expect } from 'vitest';
import {
    decodeFileContent,
    findFileContent,
    resolveRelativePath,
    documentMimeFor,
    toUint8Array,
} from './previewFileMap.js';

describe('previewFileMap', () => {
    describe('decodeFileContent', () => {
        it('returns strings unchanged', () => {
            expect(decodeFileContent('hello')).toBe('hello');
        });

        it('decodes Uint8Array as UTF-8', () => {
            const bytes = new TextEncoder().encode('canción');
            expect(decodeFileContent(bytes)).toBe('canción');
        });

        it('decodes ArrayBuffer as UTF-8', () => {
            const bytes = new TextEncoder().encode('<html></html>');
            expect(decodeFileContent(bytes.buffer)).toBe('<html></html>');
        });

        it('returns null for empty content', () => {
            expect(decodeFileContent(null)).toBeNull();
            expect(decodeFileContent(undefined)).toBeNull();
        });
    });

    describe('toUint8Array', () => {
        it('wraps ArrayBuffer', () => {
            const bytes = new TextEncoder().encode('x');
            const result = toUint8Array(bytes.buffer);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result[0]).toBe('x'.charCodeAt(0));
        });

        it('returns Uint8Array as-is', () => {
            const bytes = new Uint8Array([1, 2]);
            expect(toUint8Array(bytes)).toBe(bytes);
        });

        it('encodes strings as UTF-8', () => {
            const result = toUint8Array('ab');
            expect(Array.from(result)).toEqual([97, 98]);
        });

        it('returns null for unsupported content', () => {
            expect(toUint8Array(null)).toBeNull();
            expect(toUint8Array(42)).toBeNull();
        });
    });

    describe('resolveRelativePath', () => {
        it('resolves ../ segments', () => {
            expect(resolveRelativePath('html/../index.html')).toBe('index.html');
        });

        it('resolves ./ and empty segments', () => {
            expect(resolveRelativePath('a/./b//c')).toBe('a/b/c');
        });

        it('keeps plain paths unchanged', () => {
            expect(resolveRelativePath('content/css/base.css')).toBe('content/css/base.css');
        });
    });

    describe('findFileContent', () => {
        const files = {
            'index.html': '<html>',
            'content/css/base.css': 'body{}',
            'content/resources/img/logo.png': new Uint8Array([1]),
            'content/resources/report.pdf': new Uint8Array([2]),
        };

        it('finds direct matches', () => {
            expect(findFileContent(files, 'index.html')).toBe('<html>');
        });

        it('strips leading ../ segments', () => {
            expect(findFileContent(files, '../../content/css/base.css')).toBe('body{}');
        });

        it('extracts content/resources paths from absolute URLs', () => {
            expect(findFileContent(files, 'http://localhost/x/content/resources/img/logo.png')).toEqual(
                new Uint8Array([1]),
            );
        });

        it('falls back to filename match within content/resources', () => {
            expect(findFileContent(files, 'content/resources/missing-dir/logo.png')).toEqual(new Uint8Array([1]));
        });

        it('returns undefined for unknown paths', () => {
            expect(findFileContent(files, 'nope.js')).toBeUndefined();
        });
    });

    describe('documentMimeFor', () => {
        it('maps common document and media extensions', () => {
            expect(documentMimeFor('report.pdf')).toBe('application/pdf');
            expect(documentMimeFor('a/b/pres.pptx')).toBe(
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            );
            expect(documentMimeFor('song.mp3')).toBe('audio/mpeg');
        });

        it('defaults to octet-stream for unknown extensions', () => {
            expect(documentMimeFor('file.xyz')).toBe('application/octet-stream');
            expect(documentMimeFor('noextension')).toBe('application/octet-stream');
        });
    });
});

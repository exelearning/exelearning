/**
 * Tests for path browser shim
 */
import { describe, it, expect } from 'bun:test';
import { dirname, basename, join, resolve, extname, sep, delimiter } from './path-shim';

describe('path-shim', () => {
    describe('dirname', () => {
        it('should return parent directory', () => {
            expect(dirname('/foo/bar/baz.txt')).toBe('/foo/bar');
        });

        it('should handle paths without extension', () => {
            expect(dirname('/foo/bar')).toBe('/foo');
        });

        it('should return / for root level files', () => {
            expect(dirname('/file.txt')).toBe('/');
        });

        it('should return / for files without path', () => {
            expect(dirname('file.txt')).toBe('/');
        });
    });

    describe('basename', () => {
        it('should return filename', () => {
            expect(basename('/foo/bar/baz.txt')).toBe('baz.txt');
        });

        it('should strip extension when provided', () => {
            expect(basename('/foo/bar/baz.txt', '.txt')).toBe('baz');
        });

        it('should handle paths without extension', () => {
            expect(basename('/foo/bar')).toBe('bar');
        });

        it('should return filename for relative paths', () => {
            expect(basename('file.txt')).toBe('file.txt');
        });
    });

    describe('join', () => {
        it('should join path segments', () => {
            expect(join('foo', 'bar', 'baz')).toBe('foo/bar/baz');
        });

        it('should handle absolute paths', () => {
            expect(join('/foo', 'bar')).toBe('/foo/bar');
        });

        it('should remove duplicate slashes', () => {
            expect(join('foo/', '/bar')).toBe('foo/bar');
        });

        it('should filter empty segments', () => {
            expect(join('foo', '', 'bar')).toBe('foo/bar');
        });
    });

    describe('resolve', () => {
        it('should join path segments', () => {
            expect(resolve('foo', 'bar')).toBe('foo/bar');
        });
    });

    describe('extname', () => {
        it('should return file extension', () => {
            expect(extname('file.txt')).toBe('.txt');
        });

        it('should return extension from full path', () => {
            expect(extname('/foo/bar/file.js')).toBe('.js');
        });

        it('should return empty string for no extension', () => {
            expect(extname('file')).toBe('');
        });

        it('should handle hidden files', () => {
            expect(extname('.gitignore')).toBe('');
        });

        it('should return last extension for multiple dots', () => {
            expect(extname('file.test.ts')).toBe('.ts');
        });
    });

    describe('constants', () => {
        it('should export sep as /', () => {
            expect(sep).toBe('/');
        });

        it('should export delimiter as :', () => {
            expect(delimiter).toBe(':');
        });
    });
});

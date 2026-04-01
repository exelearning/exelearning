/**
 * FflateZipProvider Tests
 *
 * Tests for the unified ZIP provider using fflate.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
    FflateZipProvider,
    unzipSync,
    zipSync,
    unzip,
    zip,
    listZipContents,
    readFileFromZip,
    fileExistsInZip,
} from './FflateZipProvider';

describe('FflateZipProvider', () => {
    let provider: FflateZipProvider;

    beforeEach(() => {
        provider = new FflateZipProvider();
    });

    describe('createZip', () => {
        it('should create a new ZipArchive instance', () => {
            const archive = provider.createZip();
            expect(archive).toBeDefined();
            expect(archive.addFile).toBeDefined();
            expect(archive.generate).toBeDefined();
        });
    });

    describe('FflateZipArchive', () => {
        describe('addFile', () => {
            it('should add a string file', () => {
                const archive = provider.createZip();
                archive.addFile('test.txt', 'Hello, World!');
                expect(archive.hasFile('test.txt')).toBe(true);
                expect(archive.getFileCount()).toBe(1);
            });

            it('should add a Uint8Array file', () => {
                const archive = provider.createZip();
                const content = new TextEncoder().encode('Binary content');
                archive.addFile('binary.bin', content);
                expect(archive.hasFile('binary.bin')).toBe(true);
            });

            it('should add a Buffer file', () => {
                const archive = provider.createZip();
                const content = Buffer.from('Buffer content');
                archive.addFile('buffer.txt', content);
                expect(archive.hasFile('buffer.txt')).toBe(true);
            });

            it('should add files with nested paths', () => {
                const archive = provider.createZip();
                archive.addFile('folder/subfolder/file.txt', 'Nested content');
                expect(archive.hasFile('folder/subfolder/file.txt')).toBe(true);
            });
        });

        describe('addFiles', () => {
            it('should add multiple files from a Map', () => {
                const archive = provider.createZip();
                const files = new Map<string, string | Uint8Array>();
                files.set('file1.txt', 'Content 1');
                files.set('file2.txt', 'Content 2');
                files.set('file3.txt', new TextEncoder().encode('Content 3'));

                archive.addFiles(files);

                expect(archive.getFileCount()).toBe(3);
                expect(archive.hasFile('file1.txt')).toBe(true);
                expect(archive.hasFile('file2.txt')).toBe(true);
                expect(archive.hasFile('file3.txt')).toBe(true);
            });
        });

        describe('getFile', () => {
            it('should retrieve file content as Uint8Array', () => {
                const archive = provider.createZip();
                const content = 'Test content';
                archive.addFile('test.txt', content);

                const retrieved = archive.getFile('test.txt');
                expect(retrieved).toBeInstanceOf(Uint8Array);
                expect(new TextDecoder().decode(retrieved!)).toBe(content);
            });

            it('should return undefined for non-existent files', () => {
                const archive = provider.createZip();
                expect(archive.getFile('nonexistent.txt')).toBeUndefined();
            });
        });

        describe('getFileAsString', () => {
            it('should retrieve file content as string', () => {
                const archive = provider.createZip();
                const content = 'Test content';
                archive.addFile('test.txt', content);

                expect(archive.getFileAsString('test.txt')).toBe(content);
            });

            it('should return undefined for non-existent files', () => {
                const archive = provider.createZip();
                expect(archive.getFileAsString('nonexistent.txt')).toBeUndefined();
            });
        });

        describe('generate', () => {
            it('should generate a valid ZIP buffer', async () => {
                const archive = provider.createZip();
                archive.addFile('test.txt', 'Hello, World!');

                const zipBuffer = await archive.generate();

                expect(zipBuffer).toBeInstanceOf(Uint8Array);
                expect(zipBuffer.length).toBeGreaterThan(0);

                // Verify it's a valid ZIP (starts with PK signature)
                expect(zipBuffer[0]).toBe(0x50); // 'P'
                expect(zipBuffer[1]).toBe(0x4b); // 'K'
            });

            it('should generate a ZIP that can be unzipped', async () => {
                const archive = provider.createZip();
                archive.addFile('test.txt', 'Test content');
                archive.addFile('folder/nested.txt', 'Nested content');

                const zipBuffer = await archive.generate();
                const unzipped = unzipSync(zipBuffer);

                expect(Object.keys(unzipped)).toContain('test.txt');
                expect(Object.keys(unzipped)).toContain('folder/nested.txt');
                expect(new TextDecoder().decode(unzipped['test.txt'])).toBe('Test content');
            });

            it('should generate empty ZIP for empty archive', async () => {
                const archive = provider.createZip();
                const zipBuffer = await archive.generate();

                expect(zipBuffer).toBeInstanceOf(Uint8Array);
                // Even empty ZIP has header
                expect(zipBuffer.length).toBeGreaterThan(0);
            });

            it('preserves content and records text vs binary compression stats', async () => {
                const archive = provider.createZip();
                archive.addFile('content/page.html', '<html><body>Hello</body></html>');
                archive.addFile('content/image.png', new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]));

                const zipBuffer = await archive.generate();
                const extracted = unzipSync(zipBuffer);

                expect(new TextDecoder().decode(extracted['content/page.html'])).toBe(
                    '<html><body>Hello</body></html>',
                );
                expect(Array.from(extracted['content/image.png'])).toEqual([137, 80, 78, 71, 1, 2, 3, 4]);
                expect(provider.getLastGenerateStats()).toEqual({
                    deflatedFiles: 1,
                    storedFiles: 1,
                    deflatedBytes: 31,
                    storedBytes: 8,
                });
            });

            it('tracks compression stats for the last generated ZIP', async () => {
                const archive = provider.createZip();
                archive.addFile('content/page.html', '<html><body>Hello</body></html>');
                archive.addFile('content/image.png', new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]));

                await archive.generate();

                expect(provider.getLastGenerateStats()).toEqual({
                    deflatedFiles: 1,
                    storedFiles: 1,
                    deflatedBytes: 31,
                    storedBytes: 8,
                });
            });
        });

        describe('reset', () => {
            it('should clear all files from the archive', () => {
                const archive = provider.createZip();
                archive.addFile('test.txt', 'Content');
                expect(archive.getFileCount()).toBe(1);

                archive.reset();
                expect(archive.getFileCount()).toBe(0);
            });
        });
    });
});

describe('Utility Functions', () => {
    describe('unzipSync', () => {
        it('should extract files from a ZIP buffer', async () => {
            // Create a ZIP first
            const zipBuffer = zipSync({
                'file1.txt': 'Content 1',
                'file2.txt': 'Content 2',
            });

            const result = unzipSync(zipBuffer);

            expect(Object.keys(result)).toContain('file1.txt');
            expect(Object.keys(result)).toContain('file2.txt');
            expect(new TextDecoder().decode(result['file1.txt'])).toBe('Content 1');
        });

        it('should handle Buffer input', async () => {
            const zipBuffer = zipSync({ 'test.txt': 'Test' });
            const buffer = Buffer.from(zipBuffer);

            const result = unzipSync(buffer);
            expect(Object.keys(result)).toContain('test.txt');
        });
    });

    describe('zipSync', () => {
        it('should create a valid ZIP buffer from files', () => {
            const zipBuffer = zipSync({
                'test.txt': 'Hello',
                'binary.bin': new Uint8Array([1, 2, 3, 4]),
            });

            expect(zipBuffer).toBeInstanceOf(Uint8Array);
            expect(zipBuffer[0]).toBe(0x50); // 'P'
            expect(zipBuffer[1]).toBe(0x4b); // 'K'
        });

        it('should accept compression level option', () => {
            const files = { 'test.txt': 'Test content' };

            const zipLevel0 = zipSync(files, { level: 0 });
            const zipLevel9 = zipSync(files, { level: 9 });

            // Both should be valid ZIPs
            expect(zipLevel0[0]).toBe(0x50);
            expect(zipLevel9[0]).toBe(0x50);
        });
    });

    describe('unzip (async)', () => {
        it('should extract files asynchronously', async () => {
            const zipBuffer = zipSync({
                'async.txt': 'Async content',
            });

            const result = await unzip(zipBuffer);
            expect(new TextDecoder().decode(result['async.txt'])).toBe('Async content');
        });
    });

    describe('zip (async)', () => {
        it('should create ZIP asynchronously', async () => {
            const result = await zip({
                'async.txt': 'Async content',
            });

            expect(result).toBeInstanceOf(Uint8Array);

            // Verify contents
            const unzipped = unzipSync(result);
            expect(new TextDecoder().decode(unzipped['async.txt'])).toBe('Async content');
        });

        it('should accept compression level option', async () => {
            const result = await zip({ 'test.txt': 'Test' }, { level: 9 });
            expect(result[0]).toBe(0x50);
        });
    });

    describe('listZipContents', () => {
        it('should list all files in a ZIP', () => {
            const zipBuffer = zipSync({
                'file1.txt': 'Content 1',
                'folder/file2.txt': 'Content 2',
                'folder/subfolder/file3.txt': 'Content 3',
            });

            const contents = listZipContents(zipBuffer);

            expect(contents).toContain('file1.txt');
            expect(contents).toContain('folder/file2.txt');
            expect(contents).toContain('folder/subfolder/file3.txt');
            expect(contents.length).toBe(3);
        });

        it('should return empty array for empty ZIP', () => {
            const zipBuffer = zipSync({});
            const contents = listZipContents(zipBuffer);
            expect(contents).toEqual([]);
        });
    });

    describe('readFileFromZip', () => {
        it('should read a file from ZIP', () => {
            const content = 'File content';
            const zipBuffer = zipSync({ 'test.txt': content });

            const result = readFileFromZip(zipBuffer, 'test.txt');

            expect(result).not.toBeNull();
            expect(new TextDecoder().decode(result!)).toBe(content);
        });

        it('should return null for non-existent file', () => {
            const zipBuffer = zipSync({ 'test.txt': 'Content' });

            const result = readFileFromZip(zipBuffer, 'nonexistent.txt');
            expect(result).toBeNull();
        });

        it('should read nested files', () => {
            const zipBuffer = zipSync({
                'folder/nested/file.txt': 'Nested content',
            });

            const result = readFileFromZip(zipBuffer, 'folder/nested/file.txt');
            expect(result).not.toBeNull();
            expect(new TextDecoder().decode(result!)).toBe('Nested content');
        });
    });

    describe('fileExistsInZip', () => {
        it('should return true for existing file', () => {
            const zipBuffer = zipSync({ 'test.txt': 'Content' });
            expect(fileExistsInZip(zipBuffer, 'test.txt')).toBe(true);
        });

        it('should return false for non-existent file', () => {
            const zipBuffer = zipSync({ 'test.txt': 'Content' });
            expect(fileExistsInZip(zipBuffer, 'other.txt')).toBe(false);
        });

        it('should work with nested paths', () => {
            const zipBuffer = zipSync({
                'folder/file.txt': 'Content',
            });

            expect(fileExistsInZip(zipBuffer, 'folder/file.txt')).toBe(true);
            expect(fileExistsInZip(zipBuffer, 'folder/other.txt')).toBe(false);
        });
    });
});

describe('Integration Tests', () => {
    it('should round-trip ZIP data correctly', async () => {
        const provider = new FflateZipProvider();
        const archive = provider.createZip();

        // Add various file types
        archive.addFile('text.txt', 'Plain text content');
        archive.addFile('utf8.txt', 'UTF-8: ñ á é í ó ú 中文 日本語');
        archive.addFile('binary.bin', new Uint8Array([0, 1, 2, 255, 254, 253]));
        archive.addFile('nested/path/to/file.txt', 'Deeply nested');

        // Generate ZIP
        const zipBuffer = await archive.generate();

        // Extract and verify
        const extracted = unzipSync(zipBuffer);

        expect(new TextDecoder().decode(extracted['text.txt'])).toBe('Plain text content');
        expect(new TextDecoder().decode(extracted['utf8.txt'])).toBe('UTF-8: ñ á é í ó ú 中文 日本語');
        expect(Array.from(extracted['binary.bin'])).toEqual([0, 1, 2, 255, 254, 253]);
        expect(new TextDecoder().decode(extracted['nested/path/to/file.txt'])).toBe('Deeply nested');
    });

    it('should handle large files efficiently', async () => {
        const provider = new FflateZipProvider();
        const archive = provider.createZip();

        // Create a large file (1MB of repeated content)
        const largeContent = 'x'.repeat(1024 * 1024);
        archive.addFile('large.txt', largeContent);

        const zipBuffer = await archive.generate();

        // ZIP should be compressed (much smaller than original)
        expect(zipBuffer.length).toBeLessThan(largeContent.length);

        // Verify extraction
        const extracted = unzipSync(zipBuffer);
        expect(new TextDecoder().decode(extracted['large.txt'])).toBe(largeContent);
    });
});

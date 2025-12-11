/**
 * ArchiverZipProvider tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { ArchiverZipProvider } from './ArchiverZipProvider';
import JSZip from 'jszip';

describe('ArchiverZipProvider', () => {
    let provider: ArchiverZipProvider;

    beforeEach(() => {
        provider = new ArchiverZipProvider();
    });

    describe('addFile', () => {
        it('should add string content', () => {
            provider.addFile('test.txt', 'Hello World');
            expect(provider.hasFile('test.txt')).toBe(true);
            expect(provider.getFileCount()).toBe(1);
        });

        it('should add buffer content', () => {
            const buffer = Buffer.from('Binary content');
            provider.addFile('test.bin', buffer);
            expect(provider.hasFile('test.bin')).toBe(true);
        });

        it('should add Uint8Array content', () => {
            const uint8 = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
            provider.addFile('test.dat', uint8);
            expect(provider.hasFile('test.dat')).toBe(true);
        });

        it('should handle nested paths', () => {
            provider.addFile('folder/subfolder/file.txt', 'Nested content');
            expect(provider.hasFile('folder/subfolder/file.txt')).toBe(true);
        });

        it('should overwrite existing files', () => {
            provider.addFile('test.txt', 'Original');
            provider.addFile('test.txt', 'Updated');
            expect(provider.getFileCount()).toBe(1);
            expect(provider.getFile('test.txt')).toBe('Updated');
        });
    });

    describe('generateAsync', () => {
        it('should generate valid ZIP buffer', async () => {
            provider.addFile('test.txt', 'Test content');
            provider.addFile('folder/nested.txt', 'Nested content');

            const buffer = await provider.generateAsync();

            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);

            // Verify the ZIP is valid by loading it with JSZip
            const zip = await JSZip.loadAsync(buffer);
            const files = Object.keys(zip.files);
            expect(files).toContain('test.txt');
            expect(files).toContain('folder/nested.txt');
        });

        it('should compress content', async () => {
            // Add large repetitive content that should compress well
            const largeContent = 'A'.repeat(10000);
            provider.addFile('large.txt', largeContent);

            const buffer = await provider.generateAsync();

            // Compressed size should be much smaller than original
            expect(buffer.length).toBeLessThan(largeContent.length);
        });

        it('should preserve binary content', async () => {
            const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
            provider.addFile('binary.bin', binaryData);

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);
            const extracted = await zip.file('binary.bin')?.async('nodebuffer');

            expect(extracted).toEqual(binaryData);
        });

        it('should handle empty archive', async () => {
            const buffer = await provider.generateAsync();

            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);

            const zip = await JSZip.loadAsync(buffer);
            expect(Object.keys(zip.files).length).toBe(0);
        });
    });

    describe('reset', () => {
        it('should clear all files', () => {
            provider.addFile('file1.txt', 'Content 1');
            provider.addFile('file2.txt', 'Content 2');
            expect(provider.getFileCount()).toBe(2);

            provider.reset();

            expect(provider.getFileCount()).toBe(0);
            expect(provider.hasFile('file1.txt')).toBe(false);
        });
    });

    describe('getFile', () => {
        it('should return string content', () => {
            provider.addFile('test.txt', 'Hello');
            const content = provider.getFile('test.txt');
            expect(content).toBe('Hello');
        });

        it('should return buffer content', () => {
            const buffer = Buffer.from('Binary');
            provider.addFile('test.bin', buffer);
            const content = provider.getFile('test.bin');
            expect(content).toEqual(buffer);
        });

        it('should return undefined for non-existent files', () => {
            const content = provider.getFile('nonexistent.txt');
            expect(content).toBeUndefined();
        });
    });

    describe('integration', () => {
        it('should handle typical export scenario', async () => {
            // Simulate adding export files
            provider.addFile('index.html', '<!DOCTYPE html><html></html>');
            provider.addFile('content.xml', '<?xml version="1.0"?><ode/>');
            provider.addFile('content/css/base.css', '.exe-content { color: black; }');
            provider.addFile('theme/content.css', 'body { margin: 0; }');
            provider.addFile(
                'libs/jquery/jquery.min.js',
                '/* jQuery minified */'
            );
            provider.addFile(
                'content/resources/abc123/image.png',
                Buffer.from([0x89, 0x50, 0x4e, 0x47])
            ); // PNG header

            expect(provider.getFileCount()).toBe(6);

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);

            expect(zip.file('index.html')).toBeTruthy();
            expect(zip.file('content.xml')).toBeTruthy();
            expect(zip.file('content/css/base.css')).toBeTruthy();
            expect(zip.file('theme/content.css')).toBeTruthy();
            expect(zip.file('libs/jquery/jquery.min.js')).toBeTruthy();
            expect(zip.file('content/resources/abc123/image.png')).toBeTruthy();
        });
    });
});

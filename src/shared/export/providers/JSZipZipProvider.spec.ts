/**
 * JSZipZipProvider tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { JSZipZipProvider } from './JSZipZipProvider';
import JSZip from 'jszip';

describe('JSZipZipProvider', () => {
    let provider: JSZipZipProvider;

    beforeEach(() => {
        provider = new JSZipZipProvider();
    });

    describe('Constructor', () => {
        it('should create instance successfully', () => {
            expect(provider).toBeDefined();
        });
    });

    describe('addFile', () => {
        it('should add string content file', () => {
            provider.addFile('test.txt', 'Hello World');

            expect(provider.hasFile('test.txt')).toBe(true);
        });

        it('should add buffer content file', () => {
            const buffer = Buffer.from('Binary content');
            provider.addFile('test.bin', buffer);

            expect(provider.hasFile('test.bin')).toBe(true);
        });

        it('should add Uint8Array content file', () => {
            const uint8 = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
            provider.addFile('test.dat', uint8);

            expect(provider.hasFile('test.dat')).toBe(true);
        });

        it('should add file with path', () => {
            provider.addFile('path/to/file.txt', 'Content');

            expect(provider.hasFile('path/to/file.txt')).toBe(true);
        });

        it('should overwrite existing file', () => {
            provider.addFile('test.txt', 'First');
            provider.addFile('test.txt', 'Second');

            const content = provider.getFile('test.txt');
            expect(content).toBe('Second');
        });
    });

    describe('hasFile', () => {
        it('should return true for existing file', () => {
            provider.addFile('exists.txt', 'Content');

            expect(provider.hasFile('exists.txt')).toBe(true);
        });

        it('should return false for non-existing file', () => {
            expect(provider.hasFile('not-exists.txt')).toBe(false);
        });
    });

    describe('getFile', () => {
        it('should return file content for existing file', () => {
            provider.addFile('test.txt', 'Hello');

            expect(provider.getFile('test.txt')).toBe('Hello');
        });

        it('should return buffer content', () => {
            const buffer = Buffer.from('Binary');
            provider.addFile('test.bin', buffer);

            const result = provider.getFile('test.bin');
            expect(result).toBeInstanceOf(Buffer);
        });

        it('should return undefined for non-existing file', () => {
            expect(provider.getFile('not-exists.txt')).toBeUndefined();
        });
    });

    describe('getFileCount', () => {
        it('should return 0 for empty archive', () => {
            expect(provider.getFileCount()).toBe(0);
        });

        it('should return correct count', () => {
            provider.addFile('file1.txt', 'Content 1');
            provider.addFile('file2.txt', 'Content 2');
            provider.addFile('file3.txt', 'Content 3');

            expect(provider.getFileCount()).toBe(3);
        });
    });

    describe('reset', () => {
        it('should clear all files', () => {
            provider.addFile('file1.txt', 'Content 1');
            provider.addFile('file2.txt', 'Content 2');

            provider.reset();

            expect(provider.getFileCount()).toBe(0);
            expect(provider.hasFile('file1.txt')).toBe(false);
        });
    });

    describe('generateAsync', () => {
        it('should generate valid ZIP buffer', async () => {
            provider.addFile('test.txt', 'Hello World');

            const buffer = await provider.generateAsync();

            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);

            // Verify it's a valid ZIP by loading with JSZip
            const zip = await JSZip.loadAsync(buffer);
            expect(zip.files['test.txt']).toBeDefined();
        });

        it('should generate ZIP with correct content', async () => {
            const testContent = 'Test file content';
            provider.addFile('test.txt', testContent);

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);
            const content = await zip.files['test.txt'].async('string');

            expect(content).toBe(testContent);
        });

        it('should handle multiple files', async () => {
            provider.addFile('file1.txt', 'Content 1');
            provider.addFile('file2.txt', 'Content 2');
            provider.addFile('subdir/file3.txt', 'Content 3');

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);

            expect(zip.files['file1.txt']).toBeDefined();
            expect(zip.files['file2.txt']).toBeDefined();
            expect(zip.files['subdir/file3.txt']).toBeDefined();
        });

        it('should handle binary content', async () => {
            const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header
            provider.addFile('image.png', binaryData);

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);
            const content = await zip.files['image.png'].async('uint8array');

            expect(content[0]).toBe(0x89);
            expect(content[1]).toBe(0x50);
            expect(content[2]).toBe(0x4e);
            expect(content[3]).toBe(0x47);
        });

        it('should generate empty ZIP for no files', async () => {
            const buffer = await provider.generateAsync();

            expect(buffer).toBeInstanceOf(Buffer);
            // Empty ZIP still has central directory
            expect(buffer.length).toBeGreaterThan(0);
        });

        it('should use DEFLATE compression', async () => {
            // Create content that compresses well
            const content = 'A'.repeat(1000);
            provider.addFile('compressible.txt', content);

            const buffer = await provider.generateAsync();

            // Compressed should be smaller than original
            expect(buffer.length).toBeLessThan(content.length);
        });
    });

    describe('ZIP format validation', () => {
        it('should produce ZIP with correct signature', async () => {
            provider.addFile('test.txt', 'Test');

            const buffer = await provider.generateAsync();

            // ZIP signature: PK (0x50 0x4B)
            expect(buffer[0]).toBe(0x50);
            expect(buffer[1]).toBe(0x4b);
        });

        it('should preserve directory structure', async () => {
            provider.addFile('root.txt', 'Root');
            provider.addFile('dir1/file1.txt', 'File 1');
            provider.addFile('dir1/dir2/file2.txt', 'File 2');

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);

            expect(zip.files['root.txt']).toBeDefined();
            expect(zip.files['dir1/file1.txt']).toBeDefined();
            expect(zip.files['dir1/dir2/file2.txt']).toBeDefined();
        });
    });

    describe('Large file handling', () => {
        it('should handle large text files', async () => {
            const largeContent = 'X'.repeat(100000); // 100KB
            provider.addFile('large.txt', largeContent);

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);
            const content = await zip.files['large.txt'].async('string');

            expect(content.length).toBe(100000);
        });
    });

    describe('Special characters in paths', () => {
        it('should handle spaces in filenames', async () => {
            provider.addFile('my file.txt', 'Content');

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);

            expect(zip.files['my file.txt']).toBeDefined();
        });

        it('should handle unicode in filenames', async () => {
            provider.addFile('archivo_español.txt', 'Contenido');

            const buffer = await provider.generateAsync();
            const zip = await JSZip.loadAsync(buffer);

            expect(zip.files['archivo_español.txt']).toBeDefined();
        });
    });

    describe('generateAsBlob', () => {
        it('should generate a Blob', async () => {
            provider.addFile('test.txt', 'Hello World');

            const blob = await provider.generateAsBlob();

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.size).toBeGreaterThan(0);
        });

        it('should generate Blob with correct content', async () => {
            const testContent = 'Test content for blob';
            provider.addFile('test.txt', testContent);

            const blob = await provider.generateAsBlob();
            const arrayBuffer = await blob.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            const content = await zip.files['test.txt'].async('string');

            expect(content).toBe(testContent);
        });

        it('should handle empty archive', async () => {
            const blob = await provider.generateAsBlob();

            expect(blob).toBeInstanceOf(Blob);
            expect(blob.size).toBeGreaterThan(0);
        });

        it('should handle multiple files', async () => {
            provider.addFile('file1.txt', 'Content 1');
            provider.addFile('dir/file2.txt', 'Content 2');

            const blob = await provider.generateAsBlob();
            const arrayBuffer = await blob.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);

            expect(zip.files['file1.txt']).toBeDefined();
            expect(zip.files['dir/file2.txt']).toBeDefined();
        });
    });

    describe('downloadAs', () => {
        it('should trigger download with correct filename', async () => {
            provider.addFile('test.txt', 'Hello');

            // Mock DOM APIs
            const mockLink = {
                href: '',
                download: '',
                click: () => {},
            };
            const mockCreateObjectURL = (blob: Blob) =>
                'blob:mock-url-' + blob.size;
            const mockRevokeObjectURL = (_url: string) => {};

            const originalDocument =
                globalThis.document as unknown as Document;
            const originalURL = globalThis.URL;

            // Create mock document
            const mockDocument = {
                createElement: (tag: string) => {
                    if (tag === 'a') return mockLink;
                    return {};
                },
                body: {
                    appendChild: () => {},
                    removeChild: () => {},
                },
            };

            // Install mocks
            (globalThis as unknown as Record<string, unknown>).document =
                mockDocument;
            (globalThis.URL as unknown as Record<string, unknown>) = {
                ...originalURL,
                createObjectURL: mockCreateObjectURL,
                revokeObjectURL: mockRevokeObjectURL,
            };

            await provider.downloadAs('export.zip');

            expect(mockLink.download).toBe('export.zip');
            expect(mockLink.href).toContain('blob:mock-url-');

            // Restore
            (globalThis as unknown as Record<string, unknown>).document =
                originalDocument;
            globalThis.URL = originalURL;
        });

        it('should create and click download link', async () => {
            provider.addFile('test.txt', 'Content');

            let clickCalled = false;
            let appendCalled = false;
            let removeCalled = false;
            let revokeUrlCalled = false;
            let createdUrl = '';

            const mockLink = {
                href: '',
                download: '',
                click: () => {
                    clickCalled = true;
                },
            };

            const originalDocument =
                globalThis.document as unknown as Document;
            const originalURL = globalThis.URL;

            const mockDocument = {
                createElement: () => mockLink,
                body: {
                    appendChild: () => {
                        appendCalled = true;
                    },
                    removeChild: () => {
                        removeCalled = true;
                    },
                },
            };

            (globalThis as unknown as Record<string, unknown>).document =
                mockDocument;
            (globalThis.URL as unknown as Record<string, unknown>) = {
                ...originalURL,
                createObjectURL: (blob: Blob) => {
                    createdUrl = 'blob:test-' + blob.size;
                    return createdUrl;
                },
                revokeObjectURL: (url: string) => {
                    if (url === createdUrl) {
                        revokeUrlCalled = true;
                    }
                },
            };

            await provider.downloadAs('test.zip');

            expect(clickCalled).toBe(true);
            expect(appendCalled).toBe(true);
            expect(removeCalled).toBe(true);
            expect(revokeUrlCalled).toBe(true);

            // Restore
            (globalThis as unknown as Record<string, unknown>).document =
                originalDocument;
            globalThis.URL = originalURL;
        });
    });
});

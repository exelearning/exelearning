/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebFileSystem } from './WebFileSystem.js';

describe('WebFileSystem', () => {
    let adapter;

    beforeEach(() => {
        adapter = new WebFileSystem();
    });

    describe('saveAs', () => {
        it('should trigger download with Uint8Array', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const createObjectURL = vi.fn().mockReturnValue('blob:test');
            const revokeObjectURL = vi.fn();
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = revokeObjectURL;

            const link = { click: vi.fn(), style: {} };
            const createElement = vi.spyOn(document, 'createElement').mockReturnValue(link);
            const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            const result = await adapter.saveAs(data, 'test.txt');

            expect(result.success).toBe(true);
            expect(createObjectURL).toHaveBeenCalled();
            expect(link.download).toBe('test.txt');
            expect(link.click).toHaveBeenCalled();

            createElement.mockRestore();
            appendChild.mockRestore();
            removeChild.mockRestore();
        });

        it('should trigger download with Blob', async () => {
            const blob = new Blob(['test'], { type: 'text/plain' });
            const createObjectURL = vi.fn().mockReturnValue('blob:test');
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = vi.fn();

            const link = { click: vi.fn(), style: {} };
            vi.spyOn(document, 'createElement').mockReturnValue(link);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            const result = await adapter.saveAs(blob, 'test.txt');

            expect(result.success).toBe(true);
        });

        it('should handle errors', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const createObjectURL = vi.fn().mockImplementation(() => {
                throw new Error('URL creation failed');
            });
            window.URL.createObjectURL = createObjectURL;

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const result = await adapter.saveAs(data, 'test.txt');

            expect(result.success).toBe(false);
            expect(result.error).toBe('URL creation failed');
            consoleSpy.mockRestore();
        });
    });

    describe('save', () => {
        it('should behave same as saveAs (web cannot save to path)', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const createObjectURL = vi.fn().mockReturnValue('blob:test');
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = vi.fn();

            const link = { click: vi.fn(), style: {} };
            vi.spyOn(document, 'createElement').mockReturnValue(link);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            const result = await adapter.save(data, 'project-123', 'test.txt');

            expect(result.success).toBe(true);
            expect(link.download).toBe('test.txt');
        });
    });

    describe('readFile', () => {
        it('should return error (not supported in web)', async () => {
            const result = await adapter.readFile('/some/path');

            expect(result.success).toBe(false);
            expect(result.error).toContain('not supported');
        });
    });

    describe('exportToFolder', () => {
        it('should download ZIP instead of extracting (web cannot extract)', async () => {
            const zipData = new Uint8Array([1, 2, 3]);
            const createObjectURL = vi.fn().mockReturnValue('blob:test');
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = vi.fn();

            const link = { click: vi.fn(), style: {} };
            vi.spyOn(document, 'createElement').mockReturnValue(link);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            const result = await adapter.exportToFolder(zipData, 'project');

            expect(result.success).toBe(true);
            expect(link.download).toBe('project.zip');
        });

        it('should keep .zip extension if provided', async () => {
            const zipData = new Uint8Array([1, 2, 3]);
            const createObjectURL = vi.fn().mockReturnValue('blob:test');
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = vi.fn();

            const link = { click: vi.fn(), style: {} };
            vi.spyOn(document, 'createElement').mockReturnValue(link);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            const result = await adapter.exportToFolder(zipData, 'project.zip');

            expect(result.success).toBe(true);
            expect(link.download).toBe('project.zip');
        });
    });

    describe('supports', () => {
        it('should return false for saveToPath', () => {
            expect(adapter.supports('saveToPath')).toBe(false);
        });

        it('should return false for exportToFolder', () => {
            expect(adapter.supports('exportToFolder')).toBe(false);
        });

        it('should return false for readFile', () => {
            expect(adapter.supports('readFile')).toBe(false);
        });

        it('should return false for nativeDialogs', () => {
            expect(adapter.supports('nativeDialogs')).toBe(false);
        });

        it('should return false for unknown capability', () => {
            expect(adapter.supports('unknownCapability')).toBe(false);
        });
    });

    describe('_toBlob', () => {
        it('should return Blob unchanged', async () => {
            const blob = new Blob(['test']);
            const result = await adapter._toBlob(blob);
            expect(result).toBe(blob);
        });

        it('should convert Uint8Array to Blob', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter._toBlob(data);
            expect(result).toBeInstanceOf(Blob);
            expect(result.size).toBe(3);
        });

        it('should convert ArrayBuffer to Blob', async () => {
            const buffer = new ArrayBuffer(3);
            const result = await adapter._toBlob(buffer);
            expect(result).toBeInstanceOf(Blob);
            expect(result.size).toBe(3);
        });

        it('should throw for unsupported type', async () => {
            await expect(adapter._toBlob('string')).rejects.toThrow('Unsupported data type');
        });

        it('should use custom mimeType when provided', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter._toBlob(data, 'application/zip');
            expect(result).toBeInstanceOf(Blob);
            expect(result.type).toBe('application/zip');
        });

        it('should use default mimeType when not provided', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter._toBlob(data);
            expect(result.type).toBe('application/octet-stream');
        });

        it('should throw for null data', async () => {
            await expect(adapter._toBlob(null)).rejects.toThrow('Unsupported data type');
        });

        it('should throw for number data', async () => {
            await expect(adapter._toBlob(123)).rejects.toThrow('Unsupported data type');
        });
    });

    describe('open', () => {
        let createElement;
        let mockInput;

        beforeEach(() => {
            mockInput = {
                type: '',
                accept: '',
                onchange: null,
                oncancel: null,
                click: vi.fn(),
            };
            createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockInput);
        });

        afterEach(() => {
            createElement.mockRestore();
        });

        it('should create file input and trigger click', async () => {
            // Start the open() promise but don't await it yet
            const openPromise = adapter.open(['.elp', '.elpx']);

            // File input should have been created and clicked
            expect(createElement).toHaveBeenCalledWith('input');
            expect(mockInput.type).toBe('file');
            expect(mockInput.accept).toBe('.elp,.elpx');
            expect(mockInput.click).toHaveBeenCalled();

            // Simulate file selection
            const mockFile = new File([new Uint8Array([1, 2, 3])], 'test.elp', { type: 'application/octet-stream' });
            mockInput.onchange({
                target: { files: [mockFile] },
            });

            const result = await openPromise;
            expect(result.success).toBe(true);
            expect(result.name).toBe('test.elp');
            expect(result.data).toBeInstanceOf(Uint8Array);
        });

        it('should add dots to extensions without them', async () => {
            const openPromise = adapter.open(['elp', 'elpx']);

            expect(mockInput.accept).toBe('.elp,.elpx');

            // Cancel to complete the promise
            mockInput.oncancel();
            await openPromise;
        });

        it('should handle cancel event', async () => {
            const openPromise = adapter.open(['.elp']);

            mockInput.oncancel();

            const result = await openPromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('Canceled by user');
        });

        it('should handle no file selected', async () => {
            const openPromise = adapter.open(['.elp']);

            mockInput.onchange({
                target: { files: [] },
            });

            const result = await openPromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('No file selected');
        });

        it('should handle null files array', async () => {
            const openPromise = adapter.open(['.elp']);

            mockInput.onchange({
                target: { files: null },
            });

            const result = await openPromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('No file selected');
        });

        it('should handle file read error', async () => {
            const openPromise = adapter.open(['.elp']);

            const mockFile = {
                name: 'test.elp',
                arrayBuffer: vi.fn().mockRejectedValue(new Error('Read error')),
            };
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            mockInput.onchange({
                target: { files: [mockFile] },
            });

            const result = await openPromise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('Read error');
            consoleSpy.mockRestore();
        });

        it('should not set accept if no extensions provided', async () => {
            const openPromise = adapter.open([]);

            // Empty array - should not set accept
            expect(mockInput.accept).toBe('');

            mockInput.oncancel();
            await openPromise;
        });

        it('should not set accept if extensions is null', async () => {
            const openPromise = adapter.open(null);

            expect(mockInput.accept).toBe('');

            mockInput.oncancel();
            await openPromise;
        });
    });

    describe('_download', () => {
        it('should revoke blob URL after delay', async () => {
            vi.useFakeTimers();

            const data = new Uint8Array([1, 2, 3]);
            const blobUrl = 'blob:test-url';
            const createObjectURL = vi.fn().mockReturnValue(blobUrl);
            const revokeObjectURL = vi.fn();
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = revokeObjectURL;

            const link = { click: vi.fn(), style: {} };
            vi.spyOn(document, 'createElement').mockReturnValue(link);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            await adapter._download(data, 'test.txt');

            expect(revokeObjectURL).not.toHaveBeenCalled();

            vi.advanceTimersByTime(10000);

            expect(revokeObjectURL).toHaveBeenCalledWith(blobUrl);

            vi.useRealTimers();
        });

        it('should handle mimeType option', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const createObjectURL = vi.fn().mockReturnValue('blob:test');
            window.URL.createObjectURL = createObjectURL;
            window.URL.revokeObjectURL = vi.fn();

            const link = { click: vi.fn(), style: {} };
            vi.spyOn(document, 'createElement').mockReturnValue(link);
            vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
            vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

            const toBlobSpy = vi.spyOn(adapter, '_toBlob');

            await adapter._download(data, 'test.zip', { mimeType: 'application/zip' });

            expect(toBlobSpy).toHaveBeenCalledWith(data, 'application/zip');

            toBlobSpy.mockRestore();
        });
    });
});

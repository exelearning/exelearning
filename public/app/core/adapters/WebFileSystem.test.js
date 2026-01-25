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
    });
});

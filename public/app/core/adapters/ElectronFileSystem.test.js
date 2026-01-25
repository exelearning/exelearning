/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ElectronFileSystem } from './ElectronFileSystem.js';

describe('ElectronFileSystem', () => {
    let adapter;
    let mockElectronAPI;

    beforeEach(() => {
        mockElectronAPI = {
            saveBuffer: vi.fn(),
            saveBufferAs: vi.fn(),
            openElp: vi.fn(),
            readFile: vi.fn(),
            exportBufferToFolder: vi.fn(),
        };
        window.electronAPI = mockElectronAPI;
        adapter = new ElectronFileSystem();
    });

    afterEach(() => {
        delete window.electronAPI;
    });

    describe('constructor', () => {
        it('should throw if electronAPI not available', () => {
            delete window.electronAPI;
            expect(() => new ElectronFileSystem()).toThrow('requires window.electronAPI');
        });
    });

    describe('saveAs', () => {
        it('should call saveBufferAs with data', async () => {
            mockElectronAPI.saveBufferAs.mockResolvedValue({
                filePath: '/path/to/file.elpx',
            });

            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter.saveAs(data, 'file.elpx');

            expect(mockElectronAPI.saveBufferAs).toHaveBeenCalledWith(
                expect.any(Uint8Array),
                'file.elpx'
            );
            expect(result.success).toBe(true);
            expect(result.path).toBe('/path/to/file.elpx');
        });

        it('should handle canceled dialog', async () => {
            mockElectronAPI.saveBufferAs.mockResolvedValue({ canceled: true });

            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter.saveAs(data, 'file.elpx');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Canceled by user');
        });

        it('should handle errors', async () => {
            mockElectronAPI.saveBufferAs.mockRejectedValue(new Error('Save failed'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter.saveAs(data, 'file.elpx');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Save failed');
            consoleSpy.mockRestore();
        });
    });

    describe('save', () => {
        it('should call saveBuffer with project key', async () => {
            mockElectronAPI.saveBuffer.mockResolvedValue({
                filePath: '/path/to/file.elpx',
            });

            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter.save(data, 'project-123', 'file.elpx');

            expect(mockElectronAPI.saveBuffer).toHaveBeenCalledWith(
                expect.any(Uint8Array),
                'project-123',
                'file.elpx'
            );
            expect(result.success).toBe(true);
            expect(result.path).toBe('/path/to/file.elpx');
        });

        it('should handle canceled dialog', async () => {
            mockElectronAPI.saveBuffer.mockResolvedValue({ canceled: true });

            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter.save(data, 'project-123', 'file.elpx');

            expect(result.success).toBe(false);
        });
    });

    describe('open', () => {
        it('should return file data on success', async () => {
            const fileData = new Uint8Array([1, 2, 3]);
            mockElectronAPI.openElp.mockResolvedValue({
                data: fileData.buffer,
                name: 'test.elpx',
                path: '/path/to/test.elpx',
            });

            const result = await adapter.open(['elpx']);

            expect(result.success).toBe(true);
            expect(result.data).toBeInstanceOf(Uint8Array);
            expect(result.name).toBe('test.elpx');
            expect(result.path).toBe('/path/to/test.elpx');
        });

        it('should handle canceled dialog', async () => {
            mockElectronAPI.openElp.mockResolvedValue({ canceled: true });

            const result = await adapter.open(['elpx']);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Canceled by user');
        });

        it('should handle null result', async () => {
            mockElectronAPI.openElp.mockResolvedValue(null);

            const result = await adapter.open(['elpx']);

            expect(result.success).toBe(false);
        });
    });

    describe('readFile', () => {
        it('should read file by path', async () => {
            const fileData = new Uint8Array([1, 2, 3]);
            mockElectronAPI.readFile.mockResolvedValue({
                data: fileData.buffer,
                name: 'test.elpx',
            });

            const result = await adapter.readFile('/path/to/test.elpx');

            expect(mockElectronAPI.readFile).toHaveBeenCalledWith('/path/to/test.elpx');
            expect(result.success).toBe(true);
            expect(result.data).toBeInstanceOf(Uint8Array);
        });

        it('should handle missing data', async () => {
            mockElectronAPI.readFile.mockResolvedValue({});

            const result = await adapter.readFile('/path/to/test.elpx');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Failed to read file');
        });
    });

    describe('exportToFolder', () => {
        it('should call exportBufferToFolder', async () => {
            mockElectronAPI.exportBufferToFolder.mockResolvedValue({
                folderPath: '/path/to/export',
            });

            const zipData = new Uint8Array([1, 2, 3]);
            const result = await adapter.exportToFolder(zipData, 'project');

            expect(mockElectronAPI.exportBufferToFolder).toHaveBeenCalledWith(
                expect.any(Uint8Array),
                'project'
            );
            expect(result.success).toBe(true);
            expect(result.path).toBe('/path/to/export');
        });

        it('should handle canceled dialog', async () => {
            mockElectronAPI.exportBufferToFolder.mockResolvedValue({ canceled: true });

            const zipData = new Uint8Array([1, 2, 3]);
            const result = await adapter.exportToFolder(zipData, 'project');

            expect(result.success).toBe(false);
        });
    });

    describe('supports', () => {
        it('should return true for saveToPath', () => {
            expect(adapter.supports('saveToPath')).toBe(true);
        });

        it('should return true for exportToFolder', () => {
            expect(adapter.supports('exportToFolder')).toBe(true);
        });

        it('should return true for readFile', () => {
            expect(adapter.supports('readFile')).toBe(true);
        });

        it('should return true for nativeDialogs', () => {
            expect(adapter.supports('nativeDialogs')).toBe(true);
        });

        it('should return false for unknown capability', () => {
            expect(adapter.supports('unknownCapability')).toBe(false);
        });
    });

    describe('_toBuffer', () => {
        it('should return Uint8Array unchanged', async () => {
            const data = new Uint8Array([1, 2, 3]);
            const result = await adapter._toBuffer(data);
            expect(result).toBe(data);
        });

        it('should convert Blob to Uint8Array', async () => {
            const blob = new Blob(['test']);
            const result = await adapter._toBuffer(blob);
            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should convert ArrayBuffer to Uint8Array', async () => {
            const buffer = new ArrayBuffer(3);
            const result = await adapter._toBuffer(buffer);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(3);
        });

        it('should throw for unsupported type', async () => {
            await expect(adapter._toBuffer('string')).rejects.toThrow('Unsupported data type');
        });
    });
});

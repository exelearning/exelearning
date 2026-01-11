import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerAssetAdapter } from './ServerAssetAdapter.js';

describe('ServerAssetAdapter', () => {
    let adapter;
    let mockHttpClient;

    beforeEach(() => {
        mockHttpClient = {
            baseUrl: 'http://localhost:8083',
            get: vi.fn(),
            post: vi.fn(),
            delete: vi.fn(),
            upload: vi.fn(),
            downloadBlob: vi.fn(),
        };

        adapter = new ServerAssetAdapter(mockHttpClient, '/test');
    });

    describe('constructor', () => {
        it('should store httpClient and basePath', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.basePath).toBe('/test');
        });

        it('should default basePath to empty string', () => {
            const adapterWithoutPath = new ServerAssetAdapter(mockHttpClient);
            expect(adapterWithoutPath.basePath).toBe('');
        });
    });

    describe('upload', () => {
        it('should upload file with FormData', async () => {
            mockHttpClient.upload.mockResolvedValue({ path: 'images/test.png' });

            const file = new File(['content'], 'test.png', { type: 'image/png' });
            const result = await adapter.upload('project-123', file, 'images/test.png');

            expect(mockHttpClient.upload).toHaveBeenCalledWith(
                '/test/api/assets/project-123/upload',
                expect.any(FormData),
            );
            expect(result).toEqual({ path: 'images/test.png' });
        });
    });

    describe('getUrl', () => {
        it('should return asset URL', async () => {
            const url = await adapter.getUrl('project-123', 'images/test.png');

            expect(url).toBe('http://localhost:8083/test/api/assets/project-123/images%2Ftest.png');
        });

        it('should encode special characters in path', async () => {
            const url = await adapter.getUrl('project-123', 'images/my file.png');

            expect(url).toBe('http://localhost:8083/test/api/assets/project-123/images%2Fmy%20file.png');
        });
    });

    describe('getBlob', () => {
        it('should download blob from server', async () => {
            const mockBlob = new Blob(['content']);
            mockHttpClient.downloadBlob.mockResolvedValue(mockBlob);

            const result = await adapter.getBlob('project-123', 'images/test.png');

            expect(mockHttpClient.downloadBlob).toHaveBeenCalledWith(
                '/test/api/assets/project-123/images%2Ftest.png',
            );
            expect(result).toBe(mockBlob);
        });
    });

    describe('delete', () => {
        it('should delete asset', async () => {
            mockHttpClient.delete.mockResolvedValue({ success: true });

            const result = await adapter.delete('project-123', 'images/test.png');

            expect(mockHttpClient.delete).toHaveBeenCalledWith(
                '/test/api/assets/project-123/images%2Ftest.png',
            );
            expect(result).toEqual({ success: true });
        });
    });

    describe('list', () => {
        it('should list assets without directory', async () => {
            mockHttpClient.get.mockResolvedValue([{ path: 'file1.png' }]);

            const result = await adapter.list('project-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/test/api/assets/project-123/list');
            expect(result).toEqual([{ path: 'file1.png' }]);
        });

        it('should list assets with directory filter', async () => {
            mockHttpClient.get.mockResolvedValue([{ path: 'images/file1.png' }]);

            const result = await adapter.list('project-123', 'images');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/test/api/assets/project-123/list?directory=images',
            );
            expect(result).toEqual([{ path: 'images/file1.png' }]);
        });
    });

    describe('exists', () => {
        it('should return true if asset exists', async () => {
            mockHttpClient.get.mockResolvedValue({ exists: true });

            const result = await adapter.exists('project-123', 'images/test.png');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/test/api/assets/project-123/images%2Ftest.png/exists',
            );
            expect(result).toBe(true);
        });

        it('should return false if asset does not exist', async () => {
            mockHttpClient.get.mockResolvedValue({ exists: false });

            const result = await adapter.exists('project-123', 'nonexistent.png');

            expect(result).toBe(false);
        });

        it('should return false on 404 error', async () => {
            const { NetworkError } = await import('../../errors.js');
            const error = new NetworkError('Not found', 404);
            mockHttpClient.get.mockRejectedValue(error);

            const result = await adapter.exists('project-123', 'nonexistent.png');

            expect(result).toBe(false);
        });

        it('should throw on other errors', async () => {
            const { NetworkError } = await import('../../errors.js');
            const error = new NetworkError('Server error', 500);
            mockHttpClient.get.mockRejectedValue(error);

            await expect(adapter.exists('project-123', 'test.png')).rejects.toThrow();
        });
    });

    describe('copy', () => {
        it('should copy asset', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.copy('project-123', 'src.png', 'dest.png');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/assets/project-123/copy',
                { src: 'src.png', dest: 'dest.png' },
            );
            expect(result).toEqual({ success: true });
        });
    });

    describe('move', () => {
        it('should move asset', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.move('project-123', 'old.png', 'new.png');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/assets/project-123/move',
                { src: 'old.png', dest: 'new.png' },
            );
            expect(result).toEqual({ success: true });
        });
    });

    describe('uploadViaFileManager', () => {
        it('should upload via file manager', async () => {
            mockHttpClient.upload.mockResolvedValue({ path: 'test.png' });

            const file = new File(['content'], 'test.png');
            const result = await adapter.uploadViaFileManager('project-123', file, 'images');

            expect(mockHttpClient.upload).toHaveBeenCalledWith(
                '/test/api/filemanager/project-123/upload',
                expect.any(FormData),
            );
            expect(result).toEqual({ path: 'test.png' });
        });

        it('should upload without directory', async () => {
            mockHttpClient.upload.mockResolvedValue({ path: 'test.png' });

            const file = new File(['content'], 'test.png');
            await adapter.uploadViaFileManager('project-123', file);

            expect(mockHttpClient.upload).toHaveBeenCalled();
        });
    });

    describe('listFiles', () => {
        it('should list files without directory', async () => {
            mockHttpClient.get.mockResolvedValue([{ name: 'file1.png' }]);

            const result = await adapter.listFiles('project-123');

            expect(mockHttpClient.get).toHaveBeenCalledWith('/test/api/filemanager/project-123/list');
            expect(result).toEqual([{ name: 'file1.png' }]);
        });

        it('should list files with directory', async () => {
            mockHttpClient.get.mockResolvedValue([{ name: 'file1.png' }]);

            const result = await adapter.listFiles('project-123', 'images');

            expect(mockHttpClient.get).toHaveBeenCalledWith(
                '/test/api/filemanager/project-123/list?directory=images',
            );
            expect(result).toEqual([{ name: 'file1.png' }]);
        });
    });

    describe('createDirectory', () => {
        it('should create directory', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.createDirectory('project-123', 'new-folder');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/filemanager/project-123/mkdir',
                { path: 'new-folder' },
            );
            expect(result).toEqual({ success: true });
        });
    });

    describe('deleteFile', () => {
        it('should delete file', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.deleteFile('project-123', 'images/test.png');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/filemanager/project-123/delete',
                { path: 'images/test.png' },
            );
            expect(result).toEqual({ success: true });
        });
    });

    describe('rename', () => {
        it('should rename file', async () => {
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.rename('project-123', 'old.png', 'new.png');

            expect(mockHttpClient.post).toHaveBeenCalledWith(
                '/test/api/filemanager/project-123/rename',
                { oldPath: 'old.png', newPath: 'new.png' },
            );
            expect(result).toEqual({ success: true });
        });
    });
});

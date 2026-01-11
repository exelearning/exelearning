import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerCloudStorageAdapter } from './ServerCloudStorageAdapter.js';

describe('ServerCloudStorageAdapter', () => {
    let adapter;
    let mockHttpClient;
    let mockEndpoints;

    beforeEach(() => {
        mockHttpClient = {
            get: vi.fn(),
            post: vi.fn(),
        };

        mockEndpoints = {
            api_google_oauth_login_url_get: { path: '/api/google/oauth/login' },
            api_google_drive_folders_list: { path: '/api/google/drive/folders' },
            api_google_drive_file_upload: { path: '/api/google/drive/upload' },
            api_dropbox_oauth_login_url_get: { path: '/api/dropbox/oauth/login' },
            api_dropbox_folders_list: { path: '/api/dropbox/folders' },
            api_dropbox_file_upload: { path: '/api/dropbox/upload' },
        };

        adapter = new ServerCloudStorageAdapter(mockHttpClient, mockEndpoints);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should store httpClient and endpoints', () => {
            expect(adapter.http).toBe(mockHttpClient);
            expect(adapter.endpoints).toBe(mockEndpoints);
        });

        it('should default endpoints to empty object', () => {
            const adapterWithoutEndpoints = new ServerCloudStorageAdapter(mockHttpClient);
            expect(adapterWithoutEndpoints.endpoints).toEqual({});
        });
    });

    describe('_getEndpoint', () => {
        it('should return endpoint path if exists', () => {
            expect(adapter._getEndpoint('api_google_oauth_login_url_get'))
                .toBe('/api/google/oauth/login');
        });

        it('should return null if endpoint not found', () => {
            expect(adapter._getEndpoint('nonexistent')).toBeNull();
        });
    });

    describe('getGoogleDriveLoginUrl', () => {
        it('should call http.get with correct endpoint', async () => {
            mockHttpClient.get.mockResolvedValue({ url: 'https://google.com/oauth' });

            const result = await adapter.getGoogleDriveLoginUrl();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/google/oauth/login');
            expect(result.url).toBe('https://google.com/oauth');
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerCloudStorageAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.getGoogleDriveLoginUrl();

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED', url: null });
            expect(mockHttpClient.get).not.toHaveBeenCalled();
        });
    });

    describe('getGoogleDriveFolders', () => {
        it('should call http.get with correct endpoint', async () => {
            const folders = [{ id: '1', name: 'Folder 1' }];
            mockHttpClient.get.mockResolvedValue({ folders });

            const result = await adapter.getGoogleDriveFolders();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/google/drive/folders');
            expect(result.folders).toEqual(folders);
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerCloudStorageAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.getGoogleDriveFolders();

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED', folders: [] });
        });
    });

    describe('uploadToGoogleDrive', () => {
        it('should call http.post with correct endpoint and params', async () => {
            const params = { folderId: '123', fileData: 'base64data' };
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.uploadToGoogleDrive(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/google/drive/upload', params);
            expect(result.success).toBe(true);
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerCloudStorageAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.uploadToGoogleDrive({});

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED' });
        });
    });

    describe('getDropboxLoginUrl', () => {
        it('should call http.get with correct endpoint', async () => {
            mockHttpClient.get.mockResolvedValue({ url: 'https://dropbox.com/oauth' });

            const result = await adapter.getDropboxLoginUrl();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/dropbox/oauth/login');
            expect(result.url).toBe('https://dropbox.com/oauth');
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerCloudStorageAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.getDropboxLoginUrl();

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED', url: null });
        });
    });

    describe('getDropboxFolders', () => {
        it('should call http.get with correct endpoint', async () => {
            const folders = [{ id: '1', name: 'Dropbox Folder' }];
            mockHttpClient.get.mockResolvedValue({ folders });

            const result = await adapter.getDropboxFolders();

            expect(mockHttpClient.get).toHaveBeenCalledWith('/api/dropbox/folders');
            expect(result.folders).toEqual(folders);
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerCloudStorageAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.getDropboxFolders();

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED', folders: [] });
        });
    });

    describe('uploadToDropbox', () => {
        it('should call http.post with correct endpoint and params', async () => {
            const params = { path: '/folder', fileData: 'base64data' };
            mockHttpClient.post.mockResolvedValue({ success: true });

            const result = await adapter.uploadToDropbox(params);

            expect(mockHttpClient.post).toHaveBeenCalledWith('/api/dropbox/upload', params);
            expect(result.success).toBe(true);
        });

        it('should return ENDPOINT_NOT_CONFIGURED if no endpoint', async () => {
            const adapterWithoutEndpoints = new ServerCloudStorageAdapter(mockHttpClient, {});

            const result = await adapterWithoutEndpoints.uploadToDropbox({});

            expect(result).toEqual({ responseMessage: 'ENDPOINT_NOT_CONFIGURED' });
        });
    });

    describe('isSupported', () => {
        it('should return true', () => {
            expect(adapter.isSupported()).toBe(true);
        });
    });
});

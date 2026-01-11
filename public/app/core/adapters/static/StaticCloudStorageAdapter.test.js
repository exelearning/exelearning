import { describe, it, expect, beforeEach } from 'vitest';
import { StaticCloudStorageAdapter } from './StaticCloudStorageAdapter.js';

describe('StaticCloudStorageAdapter', () => {
    let adapter;

    beforeEach(() => {
        adapter = new StaticCloudStorageAdapter();
    });

    describe('getGoogleDriveLoginUrl', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.getGoogleDriveLoginUrl();

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED', url: null });
        });
    });

    describe('getGoogleDriveFolders', () => {
        it('should return NOT_SUPPORTED with empty folders', async () => {
            const result = await adapter.getGoogleDriveFolders();

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED', folders: [] });
        });
    });

    describe('uploadToGoogleDrive', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.uploadToGoogleDrive({ folderId: '123' });

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('getDropboxLoginUrl', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.getDropboxLoginUrl();

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED', url: null });
        });
    });

    describe('getDropboxFolders', () => {
        it('should return NOT_SUPPORTED with empty folders', async () => {
            const result = await adapter.getDropboxFolders();

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED', folders: [] });
        });
    });

    describe('uploadToDropbox', () => {
        it('should return NOT_SUPPORTED', async () => {
            const result = await adapter.uploadToDropbox({ path: '/folder' });

            expect(result).toEqual({ responseMessage: 'NOT_SUPPORTED' });
        });
    });

    describe('isSupported', () => {
        it('should return false', () => {
            expect(adapter.isSupported()).toBe(false);
        });
    });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { CloudStoragePort } from './CloudStoragePort.js';

describe('CloudStoragePort', () => {
    let port;

    beforeEach(() => {
        port = new CloudStoragePort();
    });

    describe('interface definition', () => {
        it('should be a class', () => {
            expect(typeof CloudStoragePort).toBe('function');
            expect(new CloudStoragePort()).toBeInstanceOf(CloudStoragePort);
        });

        it('should have all required methods', () => {
            expect(typeof port.getGoogleDriveLoginUrl).toBe('function');
            expect(typeof port.getGoogleDriveFolders).toBe('function');
            expect(typeof port.uploadToGoogleDrive).toBe('function');
            expect(typeof port.getDropboxLoginUrl).toBe('function');
            expect(typeof port.getDropboxFolders).toBe('function');
            expect(typeof port.uploadToDropbox).toBe('function');
            expect(typeof port.isSupported).toBe('function');
        });
    });

    describe('abstract methods throw not implemented errors', () => {
        it('getGoogleDriveLoginUrl() should throw not implemented error', async () => {
            await expect(port.getGoogleDriveLoginUrl()).rejects.toThrow(
                'CloudStoragePort.getGoogleDriveLoginUrl() not implemented',
            );
        });

        it('getGoogleDriveFolders() should throw not implemented error', async () => {
            await expect(port.getGoogleDriveFolders()).rejects.toThrow(
                'CloudStoragePort.getGoogleDriveFolders() not implemented',
            );
        });

        it('uploadToGoogleDrive() should throw not implemented error', async () => {
            await expect(port.uploadToGoogleDrive({})).rejects.toThrow(
                'CloudStoragePort.uploadToGoogleDrive() not implemented',
            );
        });

        it('getDropboxLoginUrl() should throw not implemented error', async () => {
            await expect(port.getDropboxLoginUrl()).rejects.toThrow(
                'CloudStoragePort.getDropboxLoginUrl() not implemented',
            );
        });

        it('getDropboxFolders() should throw not implemented error', async () => {
            await expect(port.getDropboxFolders()).rejects.toThrow(
                'CloudStoragePort.getDropboxFolders() not implemented',
            );
        });

        it('uploadToDropbox() should throw not implemented error', async () => {
            await expect(port.uploadToDropbox({})).rejects.toThrow(
                'CloudStoragePort.uploadToDropbox() not implemented',
            );
        });
    });

    describe('default implementation methods', () => {
        it('isSupported() should return true by default', () => {
            expect(port.isSupported()).toBe(true);
        });
    });

    describe('default export', () => {
        it('should export CloudStoragePort as default', async () => {
            const module = await import('./CloudStoragePort.js');
            expect(module.default).toBe(CloudStoragePort);
        });
    });
});

/**
 * CloudStoragePort - Domain interface for cloud storage operations.
 * Handles integration with cloud storage providers (Google Drive, Dropbox, etc.).
 * Implemented by ServerCloudStorageAdapter and StaticCloudStorageAdapter.
 */
export class CloudStoragePort {
    /**
     * Get the OAuth login URL for Google Drive.
     * @returns {Promise<{responseMessage: string, url: string|null}>}
     */
    async getGoogleDriveLoginUrl() {
        throw new Error('CloudStoragePort.getGoogleDriveLoginUrl() not implemented');
    }

    /**
     * Get folders from Google Drive account.
     * @returns {Promise<{responseMessage: string, folders: Array}>}
     */
    async getGoogleDriveFolders() {
        throw new Error('CloudStoragePort.getGoogleDriveFolders() not implemented');
    }

    /**
     * Upload a file to Google Drive.
     * @param {Object} params - Upload parameters
     * @param {string} params.folderId - Target folder ID
     * @param {string} params.fileName - File name
     * @param {Blob|File} params.file - File content
     * @returns {Promise<{responseMessage: string}>}
     */
    async uploadToGoogleDrive(params) {
        throw new Error('CloudStoragePort.uploadToGoogleDrive() not implemented');
    }

    /**
     * Get the OAuth login URL for Dropbox.
     * @returns {Promise<{responseMessage: string, url: string|null}>}
     */
    async getDropboxLoginUrl() {
        throw new Error('CloudStoragePort.getDropboxLoginUrl() not implemented');
    }

    /**
     * Get folders from Dropbox account.
     * @returns {Promise<{responseMessage: string, folders: Array}>}
     */
    async getDropboxFolders() {
        throw new Error('CloudStoragePort.getDropboxFolders() not implemented');
    }

    /**
     * Upload a file to Dropbox.
     * @param {Object} params - Upload parameters
     * @param {string} params.path - Target path
     * @param {string} params.fileName - File name
     * @param {Blob|File} params.file - File content
     * @returns {Promise<{responseMessage: string}>}
     */
    async uploadToDropbox(params) {
        throw new Error('CloudStoragePort.uploadToDropbox() not implemented');
    }

    /**
     * Check if cloud storage is supported in current mode.
     * @returns {boolean}
     */
    isSupported() {
        return true;
    }
}

export default CloudStoragePort;

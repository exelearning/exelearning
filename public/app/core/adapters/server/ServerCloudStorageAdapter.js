/**
 * ServerCloudStorageAdapter - Server-side implementation of CloudStoragePort.
 * Handles cloud storage operations via HTTP API.
 */
import { CloudStoragePort } from '../../ports/CloudStoragePort.js';

export class ServerCloudStorageAdapter extends CloudStoragePort {
    /**
     * @param {import('../../HttpClient').HttpClient} httpClient
     * @param {Object} endpoints - API endpoints from parameters
     */
    constructor(httpClient, endpoints = {}) {
        super();
        this.http = httpClient;
        this.endpoints = endpoints;
    }

    /**
     * Get endpoint URL by name.
     * @private
     */
    _getEndpoint(name) {
        return this.endpoints[name]?.path || null;
    }

    /**
     * @inheritdoc
     */
    async getGoogleDriveLoginUrl() {
        const url = this._getEndpoint('api_google_oauth_login_url_get');
        if (!url) {
            return { responseMessage: 'ENDPOINT_NOT_CONFIGURED', url: null };
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async getGoogleDriveFolders() {
        const url = this._getEndpoint('api_google_drive_folders_list');
        if (!url) {
            return { responseMessage: 'ENDPOINT_NOT_CONFIGURED', folders: [] };
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async uploadToGoogleDrive(params) {
        const url = this._getEndpoint('api_google_drive_file_upload');
        if (!url) {
            return { responseMessage: 'ENDPOINT_NOT_CONFIGURED' };
        }
        return this.http.post(url, params);
    }

    /**
     * @inheritdoc
     */
    async getDropboxLoginUrl() {
        const url = this._getEndpoint('api_dropbox_oauth_login_url_get');
        if (!url) {
            return { responseMessage: 'ENDPOINT_NOT_CONFIGURED', url: null };
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async getDropboxFolders() {
        const url = this._getEndpoint('api_dropbox_folders_list');
        if (!url) {
            return { responseMessage: 'ENDPOINT_NOT_CONFIGURED', folders: [] };
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async uploadToDropbox(params) {
        const url = this._getEndpoint('api_dropbox_file_upload');
        if (!url) {
            return { responseMessage: 'ENDPOINT_NOT_CONFIGURED' };
        }
        return this.http.post(url, params);
    }

    /**
     * @inheritdoc
     */
    isSupported() {
        return true;
    }
}

export default ServerCloudStorageAdapter;

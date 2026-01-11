/**
 * ServerAssetAdapter - Server-side implementation of AssetPort.
 * Handles asset upload/download via HTTP API.
 */
import { AssetPort } from '../../ports/AssetPort.js';
import { NetworkError } from '../../errors.js';

export class ServerAssetAdapter extends AssetPort {
    /**
     * @param {import('../../HttpClient').HttpClient} httpClient
     * @param {string} basePath - API base path
     */
    constructor(httpClient, basePath = '') {
        super();
        this.http = httpClient;
        this.basePath = basePath;
    }

    /**
     * @inheritdoc
     */
    async upload(projectId, file, path) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        const url = `${this.basePath}/api/assets/${projectId}/upload`;
        return this.http.upload(url, formData);
    }

    /**
     * @inheritdoc
     */
    async getUrl(projectId, path) {
        // Return the URL that can be used to access the asset
        return `${this.http.baseUrl}${this.basePath}/api/assets/${projectId}/${encodeURIComponent(path)}`;
    }

    /**
     * @inheritdoc
     */
    async getBlob(projectId, path) {
        const url = `${this.basePath}/api/assets/${projectId}/${encodeURIComponent(path)}`;
        return this.http.downloadBlob(url);
    }

    /**
     * @inheritdoc
     */
    async delete(projectId, path) {
        const url = `${this.basePath}/api/assets/${projectId}/${encodeURIComponent(path)}`;
        return this.http.delete(url);
    }

    /**
     * @inheritdoc
     */
    async list(projectId, directory = '') {
        const url = `${this.basePath}/api/assets/${projectId}/list`;
        const params = directory ? `?directory=${encodeURIComponent(directory)}` : '';
        return this.http.get(`${url}${params}`);
    }

    /**
     * @inheritdoc
     */
    async exists(projectId, path) {
        try {
            const url = `${this.basePath}/api/assets/${projectId}/${encodeURIComponent(path)}/exists`;
            const result = await this.http.get(url);
            return result?.exists ?? false;
        } catch (error) {
            if (error instanceof NetworkError && error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async copy(projectId, srcPath, destPath) {
        const url = `${this.basePath}/api/assets/${projectId}/copy`;
        return this.http.post(url, { src: srcPath, dest: destPath });
    }

    /**
     * @inheritdoc
     */
    async move(projectId, srcPath, destPath) {
        const url = `${this.basePath}/api/assets/${projectId}/move`;
        return this.http.post(url, { src: srcPath, dest: destPath });
    }

    /**
     * Upload file via file manager.
     * @param {string} projectId
     * @param {File} file
     * @param {string} directory
     * @returns {Promise<Object>}
     */
    async uploadViaFileManager(projectId, file, directory = '') {
        const formData = new FormData();
        formData.append('file', file);
        if (directory) {
            formData.append('directory', directory);
        }

        const url = `${this.basePath}/api/filemanager/${projectId}/upload`;
        return this.http.upload(url, formData);
    }

    /**
     * List files in file manager.
     * @param {string} projectId
     * @param {string} directory
     * @returns {Promise<Array>}
     */
    async listFiles(projectId, directory = '') {
        const url = `${this.basePath}/api/filemanager/${projectId}/list`;
        const params = directory ? `?directory=${encodeURIComponent(directory)}` : '';
        return this.http.get(`${url}${params}`);
    }

    /**
     * Create directory in file manager.
     * @param {string} projectId
     * @param {string} path
     * @returns {Promise<Object>}
     */
    async createDirectory(projectId, path) {
        const url = `${this.basePath}/api/filemanager/${projectId}/mkdir`;
        return this.http.post(url, { path });
    }

    /**
     * Delete file or directory in file manager.
     * @param {string} projectId
     * @param {string} path
     * @returns {Promise<void>}
     */
    async deleteFile(projectId, path) {
        const url = `${this.basePath}/api/filemanager/${projectId}/delete`;
        return this.http.post(url, { path });
    }

    /**
     * Rename file or directory in file manager.
     * @param {string} projectId
     * @param {string} oldPath
     * @param {string} newPath
     * @returns {Promise<Object>}
     */
    async rename(projectId, oldPath, newPath) {
        const url = `${this.basePath}/api/filemanager/${projectId}/rename`;
        return this.http.post(url, { oldPath, newPath });
    }
}

export default ServerAssetAdapter;

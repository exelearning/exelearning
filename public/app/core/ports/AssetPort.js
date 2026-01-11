/**
 * AssetPort - Domain interface for asset management.
 * Implemented by ServerAssetAdapter and StaticAssetAdapter.
 */
export class AssetPort {
    /**
     * Upload an asset.
     * @param {string} projectId - Project UUID
     * @param {File|Blob} file - File to upload
     * @param {string} path - Destination path within project
     * @returns {Promise<{url: string, path: string}>}
     */
    async upload(projectId, file, path) {
        throw new Error('AssetPort.upload() not implemented');
    }

    /**
     * Get an asset URL.
     * @param {string} projectId - Project UUID
     * @param {string} path - Asset path within project
     * @returns {Promise<string>} - URL to access the asset
     */
    async getUrl(projectId, path) {
        throw new Error('AssetPort.getUrl() not implemented');
    }

    /**
     * Get asset content as blob.
     * @param {string} projectId - Project UUID
     * @param {string} path - Asset path within project
     * @returns {Promise<Blob>}
     */
    async getBlob(projectId, path) {
        throw new Error('AssetPort.getBlob() not implemented');
    }

    /**
     * Delete an asset.
     * @param {string} projectId - Project UUID
     * @param {string} path - Asset path within project
     * @returns {Promise<void>}
     */
    async delete(projectId, path) {
        throw new Error('AssetPort.delete() not implemented');
    }

    /**
     * List assets in a project.
     * @param {string} projectId - Project UUID
     * @param {string} [directory] - Optional subdirectory
     * @returns {Promise<Array<{path: string, name: string, size: number, type: string}>>}
     */
    async list(projectId, directory) {
        throw new Error('AssetPort.list() not implemented');
    }

    /**
     * Check if an asset exists.
     * @param {string} projectId - Project UUID
     * @param {string} path - Asset path within project
     * @returns {Promise<boolean>}
     */
    async exists(projectId, path) {
        throw new Error('AssetPort.exists() not implemented');
    }

    /**
     * Copy an asset.
     * @param {string} projectId - Project UUID
     * @param {string} srcPath - Source path
     * @param {string} destPath - Destination path
     * @returns {Promise<void>}
     */
    async copy(projectId, srcPath, destPath) {
        throw new Error('AssetPort.copy() not implemented');
    }

    /**
     * Move an asset.
     * @param {string} projectId - Project UUID
     * @param {string} srcPath - Source path
     * @param {string} destPath - Destination path
     * @returns {Promise<void>}
     */
    async move(projectId, srcPath, destPath) {
        throw new Error('AssetPort.move() not implemented');
    }
}

export default AssetPort;

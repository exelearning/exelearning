/**
 * StaticAssetAdapter - Static/offline implementation of AssetPort.
 * Uses IndexedDB for asset storage.
 */
import { AssetPort } from '../../ports/AssetPort.js';
import { StorageError, NotFoundError } from '../../errors.js';

export class StaticAssetAdapter extends AssetPort {
    /**
     * @param {Object} [options]
     * @param {string} [options.dbPrefix] - Prefix for IndexedDB database names
     * @param {string} [options.storeName] - Object store name for assets
     */
    constructor(options = {}) {
        super();
        this.dbPrefix = options.dbPrefix || 'exelearning-assets-';
        this.storeName = options.storeName || 'assets';
    }

    /**
     * Open project's asset database.
     * @private
     */
    async _openDatabase(projectId) {
        const dbName = `${this.dbPrefix}${projectId}`;

        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbName, 1);

            request.onerror = () => {
                reject(new StorageError(`Failed to open asset database: ${dbName}`));
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'path' });
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    }

    /**
     * @inheritdoc
     */
    async upload(projectId, file, path) {
        const db = await this._openDatabase(projectId);

        try {
            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();

            const asset = {
                path,
                name: file.name,
                type: file.type,
                size: file.size,
                data: arrayBuffer,
                createdAt: new Date().toISOString(),
            };

            await new Promise((resolve, reject) => {
                const tx = db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                store.put(asset);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(new StorageError('Failed to store asset'));
            });

            return {
                path,
                url: await this.getUrl(projectId, path),
            };
        } finally {
            db.close();
        }
    }

    /**
     * @inheritdoc
     */
    async getUrl(projectId, path) {
        // In static mode, create a blob URL
        const blob = await this.getBlob(projectId, path);
        return URL.createObjectURL(blob);
    }

    /**
     * @inheritdoc
     */
    async getBlob(projectId, path) {
        const db = await this._openDatabase(projectId);

        try {
            const asset = await new Promise((resolve, reject) => {
                const tx = db.transaction([this.storeName], 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.get(path);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new StorageError('Failed to read asset'));
            });

            if (!asset) {
                throw new NotFoundError('asset', path);
            }

            return new Blob([asset.data], { type: asset.type });
        } finally {
            db.close();
        }
    }

    /**
     * @inheritdoc
     */
    async delete(projectId, path) {
        const db = await this._openDatabase(projectId);

        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                store.delete(path);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(new StorageError('Failed to delete asset'));
            });
        } finally {
            db.close();
        }
    }

    /**
     * @inheritdoc
     */
    async list(projectId, directory = '') {
        const db = await this._openDatabase(projectId);

        try {
            const assets = await new Promise((resolve, reject) => {
                const tx = db.transaction([this.storeName], 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(new StorageError('Failed to list assets'));
            });

            // Filter by directory if specified
            let filtered = assets;
            if (directory) {
                const prefix = directory.endsWith('/') ? directory : `${directory}/`;
                filtered = assets.filter((a) => a.path.startsWith(prefix));
            }

            return filtered.map((a) => ({
                path: a.path,
                name: a.name,
                size: a.size,
                type: a.type,
            }));
        } finally {
            db.close();
        }
    }

    /**
     * @inheritdoc
     */
    async exists(projectId, path) {
        const db = await this._openDatabase(projectId);

        try {
            const asset = await new Promise((resolve) => {
                const tx = db.transaction([this.storeName], 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.get(path);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });

            return asset !== null && asset !== undefined;
        } finally {
            db.close();
        }
    }

    /**
     * @inheritdoc
     */
    async copy(projectId, srcPath, destPath) {
        const blob = await this.getBlob(projectId, srcPath);
        const file = new File([blob], destPath.split('/').pop(), { type: blob.type });
        await this.upload(projectId, file, destPath);
    }

    /**
     * @inheritdoc
     */
    async move(projectId, srcPath, destPath) {
        await this.copy(projectId, srcPath, destPath);
        await this.delete(projectId, srcPath);
    }

    /**
     * Clear all assets for a project.
     * @param {string} projectId
     * @returns {Promise<void>}
     */
    async clearAll(projectId) {
        const dbName = `${this.dbPrefix}${projectId}`;

        return new Promise((resolve, reject) => {
            const request = window.indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => resolve();
            request.onerror = () =>
                reject(new StorageError(`Failed to delete asset database: ${dbName}`));
            request.onblocked = () => {
                console.warn(`[StaticAssetAdapter] Database deletion blocked: ${dbName}`);
                resolve();
            };
        });
    }
}

export default StaticAssetAdapter;

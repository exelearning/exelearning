/**
 * StaticProjectRepository - Static/offline implementation of ProjectRepositoryPort.
 * Uses IndexedDB for project persistence.
 */
import { ProjectRepositoryPort } from '../../ports/ProjectRepositoryPort.js';
import { StorageError, NotFoundError } from '../../errors.js';

export class StaticProjectRepository extends ProjectRepositoryPort {
    /**
     * @param {Object} [options]
     * @param {string} [options.dbPrefix] - Prefix for IndexedDB database names
     */
    constructor(options = {}) {
        super();
        this.dbPrefix = options.dbPrefix || 'exelearning-project-';
    }

    /**
     * @inheritdoc
     */
    async list() {
        try {
            // Check if indexedDB.databases() is supported
            if (!window.indexedDB?.databases) {
                console.log(
                    '[StaticProjectRepository] indexedDB.databases() not supported'
                );
                return [];
            }

            const databases = await window.indexedDB.databases();
            const projectDatabases = databases.filter((db) =>
                db.name?.startsWith(this.dbPrefix)
            );

            const projects = await Promise.all(
                projectDatabases.map(async (db) => {
                    const uuid = db.name.replace(this.dbPrefix, '');
                    const metadata = await this._getProjectMetadata(uuid);
                    return {
                        uuid,
                        id: uuid,
                        title:
                            metadata?.title ||
                            `Local Project (${uuid.substring(0, 8)}...)`,
                        updatedAt:
                            metadata?.updatedAt || new Date().toISOString(),
                        isLocal: true,
                    };
                })
            );

            // Sort by updatedAt descending
            return projects.sort(
                (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
            );
        } catch (error) {
            console.error('[StaticProjectRepository] list error:', error);
            return [];
        }
    }

    /**
     * @inheritdoc
     */
    async get(id) {
        try {
            const metadata = await this._getProjectMetadata(id);
            if (!metadata) {
                return null;
            }
            return {
                uuid: id,
                id,
                ...metadata,
                isLocal: true,
            };
        } catch (error) {
            console.error('[StaticProjectRepository] get error:', error);
            return null;
        }
    }

    /**
     * @inheritdoc
     */
    async create(data) {
        const uuid = data.uuid || crypto.randomUUID();
        const now = new Date().toISOString();

        const metadata = {
            uuid,
            title: data.title || 'Untitled Project',
            createdAt: now,
            updatedAt: now,
        };

        await this._saveProjectMetadata(uuid, metadata);

        return {
            uuid,
            id: uuid,
            ...metadata,
            isLocal: true,
        };
    }

    /**
     * @inheritdoc
     */
    async update(id, data) {
        const existing = await this.get(id);
        if (!existing) {
            throw new NotFoundError('project', id);
        }

        const metadata = {
            ...existing,
            ...data,
            updatedAt: new Date().toISOString(),
        };

        await this._saveProjectMetadata(id, metadata);

        return {
            uuid: id,
            id,
            ...metadata,
            isLocal: true,
        };
    }

    /**
     * @inheritdoc
     */
    async delete(id) {
        try {
            const dbName = `${this.dbPrefix}${id}`;
            // Delete the IndexedDB database
            await new Promise((resolve, reject) => {
                const request = window.indexedDB.deleteDatabase(dbName);
                request.onsuccess = () => resolve();
                request.onerror = () =>
                    reject(new StorageError(`Failed to delete database: ${dbName}`));
                request.onblocked = () => {
                    console.warn(`[StaticProjectRepository] Database deletion blocked: ${dbName}`);
                    resolve(); // Continue anyway
                };
            });
        } catch (error) {
            console.error('[StaticProjectRepository] delete error:', error);
            throw new StorageError(`Failed to delete project: ${error.message}`);
        }
    }

    /**
     * @inheritdoc
     */
    async getRecent(limit = 3) {
        const projects = await this.list();
        return projects.slice(0, limit);
    }

    /**
     * @inheritdoc
     */
    async exists(id) {
        const project = await this.get(id);
        return project !== null;
    }

    /**
     * Get project metadata from Yjs IndexedDB.
     * @private
     */
    async _getProjectMetadata(uuid) {
        try {
            const dbName = `${this.dbPrefix}${uuid}`;
            const db = await this._openDatabase(dbName);
            if (!db) {
                return null;
            }

            // Try to get metadata from the updates store
            const metadata = await this._getFromStore(db, 'metadata', 'project');
            db.close();

            return metadata;
        } catch (error) {
            console.error('[StaticProjectRepository] _getProjectMetadata error:', error);
            return null;
        }
    }

    /**
     * Save project metadata to Yjs IndexedDB.
     * @private
     */
    async _saveProjectMetadata(uuid, metadata) {
        const dbName = `${this.dbPrefix}${uuid}`;

        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(dbName, 1);

            request.onerror = () => {
                reject(new StorageError(`Failed to open database: ${dbName}`));
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                const db = event.target.result;
                try {
                    const tx = db.transaction(['metadata'], 'readwrite');
                    const store = tx.objectStore('metadata');
                    store.put({ key: 'project', ...metadata });
                    tx.oncomplete = () => {
                        db.close();
                        resolve();
                    };
                    tx.onerror = () => {
                        db.close();
                        reject(new StorageError('Transaction failed'));
                    };
                } catch (error) {
                    db.close();
                    reject(error);
                }
            };
        });
    }

    /**
     * Open an IndexedDB database.
     * @private
     */
    async _openDatabase(dbName) {
        return new Promise((resolve) => {
            const request = window.indexedDB.open(dbName);

            request.onerror = () => {
                resolve(null);
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
        });
    }

    /**
     * Get value from object store.
     * @private
     */
    async _getFromStore(db, storeName, key) {
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) {
                    resolve(null);
                    return;
                }

                const tx = db.transaction([storeName], 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => {
                    resolve(request.result || null);
                };

                request.onerror = () => {
                    resolve(null);
                };
            } catch {
                resolve(null);
            }
        });
    }

    /**
     * Save a project - handled by Yjs/IndexedDB in static mode.
     * @inheritdoc
     */
    async save(sessionId, params) {
        console.log('[StaticProjectRepository] save handled by Yjs/IndexedDB');
        return { responseMessage: 'OK', staticMode: true };
    }

    /**
     * Autosave - handled by Yjs persistence in static mode.
     * @inheritdoc
     */
    async autoSave(sessionId, params) {
        console.log('[StaticProjectRepository] autosave handled by Yjs persistence');
        // No-op - Yjs handles persistence automatically
    }

    /**
     * Save as new project - handled client-side in static mode.
     * @inheritdoc
     */
    async saveAs(sessionId, params) {
        console.log('[StaticProjectRepository] saveAs handled client-side');
        return { responseMessage: 'OK', staticMode: true };
    }

    /**
     * Duplicate project - not supported in static mode.
     * @inheritdoc
     */
    async duplicate(id) {
        console.warn('[StaticProjectRepository] duplicate not supported in static mode');
        return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
    }

    /**
     * Get last updated - returns metadata from IndexedDB.
     * @inheritdoc
     */
    async getLastUpdated(id) {
        try {
            const metadata = await this._getProjectMetadata(id);
            return {
                lastUpdated: metadata?.updatedAt || null,
                staticMode: true,
            };
        } catch (error) {
            console.error('[StaticProjectRepository] getLastUpdated error:', error);
            return { lastUpdated: null };
        }
    }

    /**
     * Get concurrent users - always empty in static mode (no collaboration).
     * @inheritdoc
     */
    async getConcurrentUsers(id, versionId, sessionId) {
        return { users: [], staticMode: true };
    }

    /**
     * Close session - no-op in static mode.
     * @inheritdoc
     */
    async closeSession(params) {
        console.log('[StaticProjectRepository] closeSession - no-op in static mode');
        return { responseMessage: 'OK', staticMode: true };
    }

    /**
     * Join session - always available in static mode (single user).
     * @inheritdoc
     */
    async joinSession(sessionId) {
        return { available: true, staticMode: true };
    }

    /**
     * Check current users - always 0 in static mode.
     * @inheritdoc
     */
    async checkCurrentUsers(params) {
        return { responseMessage: 'OK', currentUsers: 0, staticMode: true };
    }

    /**
     * Open file - handled client-side via JSZip in static mode.
     * @inheritdoc
     */
    async openFile(fileName) {
        // In static mode, file operations are handled client-side
        return { responseMessage: 'OK', odeSessionId: window.eXeLearning?.projectId };
    }

    /**
     * Open local file - handled client-side in static mode.
     * @inheritdoc
     */
    async openLocalFile(data) {
        return { responseMessage: 'OK', odeSessionId: window.eXeLearning?.projectId };
    }

    /**
     * Open large local file - handled client-side in static mode.
     * @inheritdoc
     */
    async openLargeLocalFile(data) {
        return { responseMessage: 'OK', odeSessionId: window.eXeLearning?.projectId };
    }

    /**
     * Get local properties - returns empty in static mode.
     * @inheritdoc
     */
    async getLocalProperties(data) {
        return { responseMessage: 'OK', properties: {} };
    }

    /**
     * Get local components - returns empty in static mode.
     * @inheritdoc
     */
    async getLocalComponents(data) {
        return { responseMessage: 'OK', components: [] };
    }

    /**
     * Import to root - handled client-side via JSZip in static mode.
     * @inheritdoc
     */
    async importToRoot(data) {
        return { responseMessage: 'OK' };
    }

    /**
     * Import to root from local - not supported in static mode.
     * @inheritdoc
     */
    async importToRootFromLocal(payload) {
        return { responseMessage: 'OK' };
    }

    /**
     * Import as child - not supported in static mode.
     * @inheritdoc
     */
    async importAsChild(navId, payload) {
        return { responseMessage: 'OK' };
    }

    /**
     * Open multiple local files - not supported in static mode.
     * @inheritdoc
     */
    async openMultipleLocalFiles(data) {
        return { responseMessage: 'OK' };
    }

    /**
     * Delete by date - not applicable in static mode.
     * @inheritdoc
     */
    async deleteByDate(params) {
        return { responseMessage: 'OK' };
    }

    /**
     * Clean autosaves - not applicable in static mode.
     * @inheritdoc
     */
    async cleanAutosaves(params) {
        return { responseMessage: 'OK' };
    }

    /**
     * Get structure - managed by Yjs locally in static mode.
     * @inheritdoc
     */
    async getStructure(versionId, sessionId) {
        // In static mode, structure is managed by Yjs locally
        return { structure: null };
    }

    /**
     * Get properties - returns bundled config in static mode.
     * @inheritdoc
     */
    async getProperties(sessionId) {
        // Properties come from bundled config in static mode
        const config = window.eXeLearning?.app?.apiCallManager?.parameters;
        return {
            responseMessage: 'OK',
            properties: config?.odeProjectSyncPropertiesConfig || {},
        };
    }

    /**
     * Save properties - handled by Yjs locally in static mode.
     * @inheritdoc
     */
    async saveProperties(params) {
        // In static mode, properties are saved via Yjs
        return { responseMessage: 'OK' };
    }

    /**
     * Get used files - not supported in static mode.
     * @inheritdoc
     */
    async getUsedFiles(params) {
        return { responseMessage: 'OK', usedFiles: [] };
    }
}

export default StaticProjectRepository;

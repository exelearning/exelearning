/**
 * ServerProjectRepository - Server-side implementation of ProjectRepositoryPort.
 * Handles project CRUD operations via HTTP API.
 */
import { ProjectRepositoryPort } from '../../ports/ProjectRepositoryPort.js';
import { NetworkError, NotFoundError } from '../../errors.js';

export class ServerProjectRepository extends ProjectRepositoryPort {
    /**
     * @param {import('../../HttpClient').HttpClient} httpClient
     * @param {string} basePath - API base path (e.g., '/web/exelearning')
     */
    constructor(httpClient, basePath = '') {
        super();
        this.http = httpClient;
        this.basePath = basePath;
    }

    /**
     * Get auth token from available sources.
     * @private
     */
    _getAuthToken() {
        return (
            window.eXeLearning?.app?.project?._yjsBridge?.authToken ||
            window.eXeLearning?.app?.auth?.getToken?.() ||
            window.eXeLearning?.config?.token ||
            localStorage.getItem('authToken')
        );
    }

    /**
     * Make authenticated request.
     * @private
     */
    async _authFetch(url, options = {}) {
        const token = this._getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new NotFoundError('project', url);
            }
            throw new NetworkError(
                `Request failed: ${response.statusText}`,
                response.status
            );
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    /**
     * @inheritdoc
     */
    async list() {
        const url = `${this.http.baseUrl}${this.basePath}/api/projects/user/list`;

        try {
            const result = await this._authFetch(url, { method: 'GET' });
            // Transform response to consistent format
            return result?.odeFiles?.odeFilesSync || [];
        } catch (error) {
            console.error('[ServerProjectRepository] list error:', error);
            return [];
        }
    }

    /**
     * @inheritdoc
     */
    async get(id) {
        const url = `${this.http.baseUrl}${this.basePath}/api/projects/${id}`;

        try {
            return await this._authFetch(url, { method: 'GET' });
        } catch (error) {
            if (error instanceof NotFoundError) {
                return null;
            }
            throw error;
        }
    }

    /**
     * @inheritdoc
     */
    async create(data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/project/create-quick`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * @inheritdoc
     */
    async update(id, data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/projects/${id}`;
        return this._authFetch(url, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * @inheritdoc
     */
    async delete(id) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/remove-file`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify({ odeFileId: id }),
        });
    }

    /**
     * @inheritdoc
     */
    async getRecent(limit = 3) {
        const url = `${this.http.baseUrl}${this.basePath}/api/projects/user/recent`;

        try {
            return await this._authFetch(url, { method: 'GET' });
        } catch (error) {
            console.error('[ServerProjectRepository] getRecent error:', error);
            return [];
        }
    }

    /**
     * @inheritdoc
     */
    async exists(id) {
        try {
            const project = await this.get(id);
            return project !== null;
        } catch {
            return false;
        }
    }

    /**
     * Join a project session.
     * @param {string} sessionId
     * @returns {Promise<{available: boolean}>}
     */
    async joinSession(sessionId) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/current-users/check-ode-session-id`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify({ odeSessionId: sessionId }),
        });
    }

    /**
     * Check current users in a session.
     * @param {Object} params
     * @returns {Promise<{currentUsers: number}>}
     */
    async checkCurrentUsers(params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/check-before-leave-ode-session`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * @inheritdoc
     */
    async save(sessionId, params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/${sessionId}/save/manual`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * @inheritdoc
     */
    async autoSave(sessionId, params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/${sessionId}/save/auto`;
        // Fire and forget for autosave
        this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
        }).catch((error) => {
            console.warn('[ServerProjectRepository] autoSave error:', error);
        });
    }

    /**
     * @inheritdoc
     */
    async saveAs(sessionId, params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/${sessionId}/save-as`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * @inheritdoc
     */
    async duplicate(id) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/duplicate`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify({ odeFileId: id }),
        });
    }

    /**
     * @inheritdoc
     */
    async getLastUpdated(id) {
        // Use the endpoint without project ID - server returns current timestamp
        const url = `${this.http.baseUrl}${this.basePath}/api/odes/last-updated`;
        try {
            return await this._authFetch(url, { method: 'GET' });
        } catch (error) {
            console.error('[ServerProjectRepository] getLastUpdated error:', error);
            return { lastUpdated: null };
        }
    }

    /**
     * @inheritdoc
     */
    async getConcurrentUsers(id, versionId, sessionId) {
        const url = `${this.http.baseUrl}${this.basePath}/api/odes/current-users?odeSessionId=${encodeURIComponent(sessionId)}`;
        try {
            const result = await this._authFetch(url);
            // Map backend response to expected format
            return { users: result.currentUsers || [] };
        } catch (error) {
            console.error('[ServerProjectRepository] getConcurrentUsers error:', error);
            return { users: [] };
        }
    }

    /**
     * @inheritdoc
     */
    async closeSession(params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/close-session`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * @inheritdoc
     */
    async openFile(fileName) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/elp/open`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(fileName),
        });
    }

    /**
     * @inheritdoc
     */
    async openLocalFile(data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/local/elp/open`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * @inheritdoc
     */
    async openLargeLocalFile(data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/local/large-elp/open`;
        // Large file uploads use FormData
        const token = this._getAuthToken();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            body: data, // FormData
        });

        if (!response.ok) {
            throw new NetworkError(
                `Request failed: ${response.statusText}`,
                response.status
            );
        }
        return response.json();
    }

    /**
     * @inheritdoc
     */
    async getLocalProperties(data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/local/xml/properties/open`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * @inheritdoc
     */
    async getLocalComponents(data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/local/idevices/open`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * @inheritdoc
     */
    async importToRoot(data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/local/elp/import/root`;
        const token = this._getAuthToken();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            body: data, // FormData
        });

        if (!response.ok) {
            throw new NetworkError(
                `Request failed: ${response.statusText}`,
                response.status
            );
        }
        return response.json();
    }

    /**
     * @inheritdoc
     */
    async importToRootFromLocal(payload) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/import/local/root`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    /**
     * @inheritdoc
     */
    async importAsChild(navId, payload) {
        const url = `${this.http.baseUrl}${this.basePath}/api/nav-structure-management/nav-structures/${navId}/import-elp`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    /**
     * @inheritdoc
     */
    async openMultipleLocalFiles(data) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/ode/multiple/local/elp/open`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * @inheritdoc
     */
    async deleteByDate(params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/remove-date-files`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }

    /**
     * @inheritdoc
     */
    async cleanAutosaves(params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/odes/clean-init-autosave`;
        try {
            return await this._authFetch(url, {
                method: 'POST',
                body: JSON.stringify(params),
            });
        } catch (error) {
            // Autosave cleanup is not critical - fail silently
            console.warn('[ServerProjectRepository] cleanAutosaves error:', error);
            return { success: true, message: 'Cleanup skipped' };
        }
    }

    /**
     * @inheritdoc
     */
    async getStructure(versionId, sessionId) {
        const url = `${this.http.baseUrl}${this.basePath}/api/nav-structure-management/nav-structures/${versionId}/${sessionId}`;
        return this._authFetch(url, { method: 'GET' });
    }

    /**
     * @inheritdoc
     */
    async getProperties(sessionId) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/properties/${sessionId}`;
        return this._authFetch(url, { method: 'GET' });
    }

    /**
     * @inheritdoc
     */
    async saveProperties(params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/properties/save`;
        return this._authFetch(url, {
            method: 'PUT',
            body: JSON.stringify(params),
        });
    }

    /**
     * @inheritdoc
     */
    async getUsedFiles(params) {
        const url = `${this.http.baseUrl}${this.basePath}/api/ode-management/odes/session/used-files`;
        return this._authFetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
        });
    }
}

export default ServerProjectRepository;

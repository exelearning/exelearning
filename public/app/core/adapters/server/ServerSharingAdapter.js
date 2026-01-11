/**
 * ServerSharingAdapter - Server-side implementation of SharingPort.
 * Handles project sharing operations via HTTP API.
 */
import { SharingPort } from '../../ports/SharingPort.js';

export class ServerSharingAdapter extends SharingPort {
    /**
     * @param {import('../../HttpClient').HttpClient} httpClient
     * @param {Object} endpoints - API endpoints from parameters
     * @param {string} basePath - API base path
     */
    constructor(httpClient, endpoints = {}, basePath = '') {
        super();
        this.http = httpClient;
        this.endpoints = endpoints;
        this.basePath = basePath;
    }

    /**
     * Get endpoint URL by name.
     * @private
     */
    _getEndpoint(name) {
        return this.endpoints[name]?.path || null;
    }

    /**
     * Build URL with base path fallback.
     * @private
     */
    _buildUrl(path) {
        const baseUrl = window.eXeLearning?.config?.baseURL || '';
        return `${baseUrl}${this.basePath}${path}`;
    }

    /**
     * Check if the ID is a UUID (vs numeric ID).
     * @private
     */
    _isUuid(id) {
        return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    }

    /**
     * Build the project path based on ID type.
     * @private
     */
    _getProjectPath(projectId) {
        if (this._isUuid(projectId)) {
            return `/api/projects/uuid/${projectId}`;
        }
        return `/api/projects/${projectId}`;
    }

    /**
     * @inheritdoc
     */
    async getProject(projectId) {
        const url = this._getEndpoint('api_project_get');
        if (url) {
            const finalUrl = url.replace('{id}', projectId);
            return this.http.get(finalUrl);
        }
        return this.http.get(this._buildUrl(`${this._getProjectPath(projectId)}/sharing`));
    }

    /**
     * @inheritdoc
     */
    async updateVisibility(projectId, visibility) {
        const url = this._getEndpoint('api_project_visibility_update');
        if (url) {
            const finalUrl = url.replace('{id}', projectId);
            return this.http.put(finalUrl, { visibility });
        }
        return this.http.patch(
            this._buildUrl(`${this._getProjectPath(projectId)}/visibility`),
            { visibility }
        );
    }

    /**
     * @inheritdoc
     */
    async addCollaborator(projectId, email, role = 'editor') {
        const url = this._getEndpoint('api_project_collaborator_add');
        if (url) {
            const finalUrl = url.replace('{id}', projectId);
            return this.http.post(finalUrl, { email, role });
        }
        return this.http.post(
            this._buildUrl(`${this._getProjectPath(projectId)}/collaborators`),
            { email, role }
        );
    }

    /**
     * @inheritdoc
     */
    async removeCollaborator(projectId, userId) {
        const url = this._getEndpoint('api_project_collaborator_remove');
        if (url) {
            const finalUrl = url
                .replace('{id}', projectId)
                .replace('{userId}', userId);
            return this.http.delete(finalUrl);
        }
        return this.http.delete(
            this._buildUrl(`${this._getProjectPath(projectId)}/collaborators/${userId}`)
        );
    }

    /**
     * @inheritdoc
     */
    async transferOwnership(projectId, newOwnerId) {
        const url = this._getEndpoint('api_project_transfer_ownership');
        if (url) {
            const finalUrl = url.replace('{id}', projectId);
            return this.http.post(finalUrl, { newOwnerId });
        }
        return this.http.patch(
            this._buildUrl(`${this._getProjectPath(projectId)}/owner`),
            { newOwnerId }
        );
    }

    /**
     * @inheritdoc
     */
    isSupported() {
        return true;
    }
}

export default ServerSharingAdapter;

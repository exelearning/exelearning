/**
 * ServerContentAdapter - Server-side implementation of ContentPort.
 * Handles content structure operations via HTTP API.
 */
import { ContentPort } from '../../ports/ContentPort.js';

export class ServerContentAdapter extends ContentPort {
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
    async savePage(params) {
        const url = this._getEndpoint('api_ode_page_edit');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.put(`${basePath}/api/page`, params);
        }
        return this.http.put(url, params);
    }

    /**
     * @inheritdoc
     */
    async reorderPage(params) {
        const url = this._getEndpoint('api_ode_page_reorder');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.put(`${basePath}/api/page/reorder`, params);
        }
        return this.http.put(url, params);
    }

    /**
     * @inheritdoc
     */
    async clonePage(params) {
        const url = this._getEndpoint('api_ode_page_clone');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.post(`${basePath}/api/page/clone`, params);
        }
        return this.http.post(url, params);
    }

    /**
     * @inheritdoc
     */
    async deletePage(pageId) {
        const url = this._getEndpoint('api_ode_page_delete');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.delete(`${basePath}/api/page/${pageId}`);
        }
        const deleteUrl = url.replace('{odeNavStructureSyncId}', pageId);
        return this.http.delete(deleteUrl);
    }

    /**
     * @inheritdoc
     */
    async reorderBlock(params) {
        const url = this._getEndpoint('api_ode_block_reorder');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.put(`${basePath}/api/block/reorder`, params);
        }
        return this.http.put(url, params);
    }

    /**
     * @inheritdoc
     */
    async deleteBlock(blockId) {
        const url = this._getEndpoint('api_ode_block_delete');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.delete(`${basePath}/api/block/${blockId}`);
        }
        const deleteUrl = url.replace('{odeBlockSyncId}', blockId);
        return this.http.delete(deleteUrl);
    }

    /**
     * @inheritdoc
     */
    async reorderIdevice(params) {
        const url = this._getEndpoint('api_idevices_idevice_reorder');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.put(`${basePath}/api/idevice/reorder`, params);
        }
        return this.http.put(url, params);
    }

    /**
     * @inheritdoc
     */
    async saveIdevice(params) {
        const url = this._getEndpoint('api_idevices_idevice_data_save');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.put(`${basePath}/api/idevice/save`, params);
        }
        return this.http.put(url, params);
    }

    /**
     * @inheritdoc
     */
    async cloneIdevice(params) {
        const url = this._getEndpoint('api_idevices_idevice_clone');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.post(`${basePath}/api/idevice/clone`, params);
        }
        return this.http.post(url, params);
    }

    /**
     * @inheritdoc
     */
    async deleteIdevice(ideviceId) {
        const url = this._getEndpoint('api_idevices_idevice_delete');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.delete(`${basePath}/api/idevice/${ideviceId}`);
        }
        const deleteUrl = url.replace('{odeComponentsSyncId}', ideviceId);
        return this.http.delete(deleteUrl);
    }

    /**
     * @inheritdoc
     */
    async send(endpointId, params) {
        const endpoint = this.endpoints[endpointId];
        if (!endpoint) {
            throw new Error(`Endpoint not found: ${endpointId}`);
        }
        const method = (endpoint.method || endpoint.methods?.[0] || 'GET').toLowerCase();
        const url = endpoint.path;

        switch (method) {
            case 'get':
                return this.http.get(url);
            case 'post':
                return this.http.post(url, params);
            case 'put':
                return this.http.put(url, params);
            case 'delete':
                return this.http.delete(url);
            default:
                return this.http.post(url, params);
        }
    }
}

export default ServerContentAdapter;

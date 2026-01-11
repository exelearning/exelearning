/**
 * ServerLinkValidationAdapter - Server-side implementation of LinkValidationPort.
 * Handles link validation via HTTP API.
 */
import { LinkValidationPort } from '../../ports/LinkValidationPort.js';

export class ServerLinkValidationAdapter extends LinkValidationPort {
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
     * @inheritdoc
     */
    async getSessionBrokenLinks(params) {
        const url = this._getEndpoint('api_odes_session_get_broken_links');
        if (!url) {
            const baseUrl = window.eXeLearning?.config?.baseURL || '';
            return this.http.post(
                `${baseUrl}${this.basePath}/api/ode-management/odes/session/brokenlinks`,
                params
            );
        }
        return this.http.post(url, params);
    }

    /**
     * @inheritdoc
     */
    async extractLinks(params) {
        const baseUrl = window.eXeLearning?.config?.baseURL || '';
        const url = `${baseUrl}${this.basePath}/api/ode-management/odes/session/brokenlinks/extract`;
        return this.http.post(url, params);
    }

    /**
     * @inheritdoc
     */
    getValidationStreamUrl() {
        const baseUrl = window.eXeLearning?.config?.baseURL || '';
        return `${baseUrl}${this.basePath}/api/ode-management/odes/session/brokenlinks/validate-stream`;
    }

    /**
     * @inheritdoc
     */
    async getPageBrokenLinks(pageId) {
        const url = this._getEndpoint('api_odes_pag_get_broken_links');
        if (!url) {
            const baseUrl = window.eXeLearning?.config?.baseURL || '';
            return this.http.get(
                `${baseUrl}${this.basePath}/api/ode-management/odes/page/${pageId}/brokenlinks`
            );
        }
        const pageUrl = url.replace('{odePageId}', pageId);
        return this.http.get(pageUrl);
    }

    /**
     * @inheritdoc
     */
    async getBlockBrokenLinks(blockId) {
        const url = this._getEndpoint('api_odes_block_get_broken_links');
        if (!url) {
            const baseUrl = window.eXeLearning?.config?.baseURL || '';
            return this.http.get(
                `${baseUrl}${this.basePath}/api/ode-management/odes/block/${blockId}/brokenlinks`
            );
        }
        const blockUrl = url.replace('{odeBlockId}', blockId);
        return this.http.get(blockUrl);
    }

    /**
     * @inheritdoc
     */
    async getIdeviceBrokenLinks(ideviceId) {
        const url = this._getEndpoint('api_odes_idevice_get_broken_links');
        if (!url) {
            const baseUrl = window.eXeLearning?.config?.baseURL || '';
            return this.http.get(
                `${baseUrl}${this.basePath}/api/ode-management/odes/idevice/${ideviceId}/brokenlinks`
            );
        }
        const ideviceUrl = url.replace('{odeIdeviceId}', ideviceId);
        return this.http.get(ideviceUrl);
    }

    /**
     * @inheritdoc
     */
    isSupported() {
        return true;
    }
}

export default ServerLinkValidationAdapter;

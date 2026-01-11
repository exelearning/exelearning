/**
 * ServerPlatformIntegrationAdapter - Server-side implementation of PlatformIntegrationPort.
 * Handles LMS platform integration via HTTP API.
 */
import { PlatformIntegrationPort } from '../../ports/PlatformIntegrationPort.js';

export class ServerPlatformIntegrationAdapter extends PlatformIntegrationPort {
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
    async uploadElp(params) {
        const url = this._getEndpoint('set_platform_new_ode');
        if (!url) {
            return { responseMessage: 'ENDPOINT_NOT_CONFIGURED' };
        }
        return this.http.post(url, params);
    }

    /**
     * @inheritdoc
     */
    async openElp(params) {
        const url = this._getEndpoint('open_platform_elp');
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

export default ServerPlatformIntegrationAdapter;

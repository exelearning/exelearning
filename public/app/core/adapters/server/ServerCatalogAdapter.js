/**
 * ServerCatalogAdapter - Server-side implementation of CatalogPort.
 * Handles catalog data (iDevices, themes, locales) via HTTP API.
 */
import { CatalogPort } from '../../ports/CatalogPort.js';

export class ServerCatalogAdapter extends CatalogPort {
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
    async getIDevices() {
        const url = this._getEndpoint('api_idevices_installed');
        if (!url) {
            console.warn('[ServerCatalogAdapter] api_idevices_installed endpoint not found');
            return [];
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async getThemes() {
        const url = this._getEndpoint('api_themes_installed');
        if (!url) {
            console.warn('[ServerCatalogAdapter] api_themes_installed endpoint not found');
            return [];
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async getLocales() {
        const url = this._getEndpoint('api_locales');
        if (!url) {
            // Fallback to constructed URL
            return this.http.get('/api/locales');
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async getTranslations(locale) {
        const url = this._getEndpoint('api_translations');
        if (!url) {
            // Fallback to constructed URL
            return this.http.get(`/api/translations/${locale}`);
        }
        const translationsUrl = url.replace('{locale}', locale);
        return this.http.get(translationsUrl);
    }

    /**
     * @inheritdoc
     */
    async getIDevice(id) {
        const idevices = await this.getIDevices();
        return idevices.find(idev => idev.id === id || idev.name === id) || null;
    }

    /**
     * @inheritdoc
     */
    async getTheme(id) {
        const themes = await this.getThemes();
        return themes.find(theme => theme.id === id || theme.name === id) || null;
    }

    /**
     * @inheritdoc
     */
    async getLicenses() {
        const url = this._getEndpoint('api_licenses');
        if (!url) {
            return this.http.get('/api/licenses');
        }
        return this.http.get(url);
    }

    /**
     * @inheritdoc
     */
    async getExportFormats() {
        const url = this._getEndpoint('api_export_formats');
        if (!url) {
            return this.http.get('/api/export/formats');
        }
        return this.http.get(url);
    }

    /**
     * Get API parameters/routes configuration.
     * @returns {Promise<Object>}
     */
    async getApiParameters() {
        const basePath = window.eXeLearning?.config?.basePath || '';
        const url = `/api/parameter-management/parameters/data/list`;
        return this.http.get(`${basePath}${url}`);
    }

    /**
     * Get upload limits configuration.
     * @returns {Promise<Object>}
     */
    async getUploadLimits() {
        const basePath = window.eXeLearning?.config?.basePath || '';
        return this.http.get(`${basePath}/api/config/upload-limits`);
    }

    /**
     * Get templates for a locale.
     * @param {string} locale
     * @returns {Promise<Array>}
     */
    async getTemplates(locale) {
        const basePath = window.eXeLearning?.config?.basePath || '';
        return this.http.get(`${basePath}/api/templates?locale=${locale}`);
    }

    /**
     * Get changelog text.
     * @returns {Promise<string>}
     */
    async getChangelog() {
        const url = window.eXeLearning?.config?.changelogURL;
        if (!url) {
            return '';
        }
        const version = window.eXeLearning?.app?.common?.getVersionTimeStamp?.() || Date.now();
        try {
            const response = await fetch(`${url}?version=${version}`);
            return response.ok ? response.text() : '';
        } catch {
            return '';
        }
    }

    /**
     * Get third-party code info.
     * @returns {Promise<string>}
     */
    async getThirdPartyCode() {
        const basePath = window.eXeLearning?.config?.basePath || '';
        const baseUrl = window.eXeLearning?.config?.baseURL || '';
        const version = window.eXeLearning?.version || 'v1.0.0';
        const url = `${baseUrl}${basePath}/${version}/libs/README.md`;
        try {
            const response = await fetch(url);
            return response.ok ? response.text() : '';
        } catch {
            return '';
        }
    }

    /**
     * Get licenses list.
     * @returns {Promise<string>}
     */
    async getLicensesList() {
        const basePath = window.eXeLearning?.config?.basePath || '';
        const baseUrl = window.eXeLearning?.config?.baseURL || '';
        const version = window.eXeLearning?.version || 'v1.0.0';
        const url = `${baseUrl}${basePath}/${version}/libs/LICENSES`;
        try {
            const response = await fetch(url);
            return response.ok ? response.text() : '';
        } catch {
            return '';
        }
    }

    /**
     * Get HTML template for a component.
     * @param {string} componentId - Component sync ID
     * @returns {Promise<{htmlTemplate: string, responseMessage: string}>}
     */
    async getComponentHtmlTemplate(componentId) {
        const url = this._getEndpoint('api_idevices_html_template_get');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.get(`${basePath}/api/idevices/${componentId}/template`);
        }
        const templateUrl = url.replace('{odeComponentsSyncId}', componentId);
        return this.http.get(templateUrl);
    }

    /**
     * Create a new theme.
     * @param {Object} params - Theme creation parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async createTheme(params) {
        const url = this._getEndpoint('api_themes_new');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.post(`${basePath}/api/themes/new`, params);
        }
        return this.http.post(url, params);
    }

    /**
     * Update/edit an existing theme.
     * @param {string} themeDir - Theme directory name
     * @param {Object} params - Theme update parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async updateTheme(themeDir, params) {
        const url = this._getEndpoint('api_themes_edit');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.put(`${basePath}/api/themes/${themeDir}`, params);
        }
        const editUrl = url.replace('{themeId}', themeDir);
        return this.http.put(editUrl, params);
    }

    /**
     * Get saved HTML view for a component.
     * @param {string} componentId - Component sync ID
     * @returns {Promise<{responseMessage: string, htmlView: string}>}
     */
    async getSaveHtmlView(componentId) {
        const url = this._getEndpoint('api_idevices_html_view_get');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.get(`${basePath}/api/idevices/${componentId}/htmlview`);
        }
        const viewUrl = url.replace('{odeComponentsSyncId}', componentId);
        return this.http.get(viewUrl);
    }

    /**
     * Get iDevices by session ID (games API).
     * @param {string} sessionId - ODE session ID
     * @returns {Promise<{responseMessage: string, idevices: Array}>}
     */
    async getIdevicesBySessionId(sessionId) {
        const url = this._getEndpoint('api_games_session_idevices');
        if (!url) {
            const basePath = window.eXeLearning?.config?.basePath || '';
            return this.http.get(`${basePath}/api/games/session/${sessionId}/idevices`);
        }
        const gamesUrl = url.replace('{odeSessionId}', sessionId);
        return this.http.get(gamesUrl);
    }
}

export default ServerCatalogAdapter;

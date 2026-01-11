/**
 * StaticCatalogAdapter - Static/offline implementation of CatalogPort.
 * Uses pre-bundled data from bundle.json or DataProvider.
 */
import { CatalogPort } from '../../ports/CatalogPort.js';

export class StaticCatalogAdapter extends CatalogPort {
    /**
     * @param {Object} bundleData - Pre-loaded bundle data
     * @param {Object} [dataProvider] - Optional DataProvider instance for additional data
     */
    constructor(bundleData = {}, dataProvider = null) {
        super();
        this.bundle = bundleData;
        this.dataProvider = dataProvider;
        this._cache = new Map();
    }

    /**
     * Get data from bundle or DataProvider.
     * @private
     */
    async _getData(key, fallback = null) {
        // Check cache
        if (this._cache.has(key)) {
            return this._cache.get(key);
        }

        // Try bundle first
        if (this.bundle[key]) {
            this._cache.set(key, this.bundle[key]);
            return this.bundle[key];
        }

        // Try DataProvider
        if (this.dataProvider) {
            const methodName = `get${key.charAt(0).toUpperCase() + key.slice(1)}`;
            if (typeof this.dataProvider[methodName] === 'function') {
                const data = await this.dataProvider[methodName]();
                this._cache.set(key, data);
                return data;
            }
        }

        return fallback;
    }

    /**
     * @inheritdoc
     */
    async getIDevices() {
        // Try bundle.idevices first
        let idevices = await this._getData('idevices');
        if (idevices) {
            return idevices;
        }

        // Fallback to DataProvider method name
        if (this.dataProvider?.getInstalledIdevices) {
            return this.dataProvider.getInstalledIdevices();
        }

        return [];
    }

    /**
     * @inheritdoc
     */
    async getThemes() {
        // Try bundle.themes first
        let themes = await this._getData('themes');
        if (themes) {
            return themes;
        }

        // Fallback to DataProvider method name
        if (this.dataProvider?.getInstalledThemes) {
            return this.dataProvider.getInstalledThemes();
        }

        return [];
    }

    /**
     * @inheritdoc
     */
    async getLocales() {
        const locales = await this._getData('locales');
        if (locales) {
            return locales;
        }

        // Default locales
        return [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Español' },
            { code: 'ca', name: 'Català' },
            { code: 'eu', name: 'Euskara' },
            { code: 'gl', name: 'Galego' },
            { code: 'pt', name: 'Português' },
        ];
    }

    /**
     * @inheritdoc
     */
    async getTranslations(locale) {
        // Check bundle.translations[locale]
        if (this.bundle.translations?.[locale]) {
            return this.bundle.translations[locale];
        }

        // Try loading from file
        try {
            const response = await fetch(`./translations/${locale}.json`);
            if (response.ok) {
                const translations = await response.json();
                // Cache for future use
                if (!this.bundle.translations) {
                    this.bundle.translations = {};
                }
                this.bundle.translations[locale] = translations;
                return translations;
            }
        } catch {
            // Ignore fetch errors
        }

        return {};
    }

    /**
     * @inheritdoc
     */
    async getIDevice(id) {
        const idevices = await this.getIDevices();
        return idevices.find((idev) => idev.id === id || idev.name === id) || null;
    }

    /**
     * @inheritdoc
     */
    async getTheme(id) {
        const themes = await this.getThemes();
        return themes.find((theme) => theme.id === id || theme.name === id) || null;
    }

    /**
     * @inheritdoc
     */
    async getLicenses() {
        const licenses = await this._getData('licenses');
        if (licenses) {
            return licenses;
        }

        // Default Creative Commons licenses
        return [
            { id: 'cc-by', name: 'CC BY 4.0' },
            { id: 'cc-by-sa', name: 'CC BY-SA 4.0' },
            { id: 'cc-by-nc', name: 'CC BY-NC 4.0' },
            { id: 'cc-by-nc-sa', name: 'CC BY-NC-SA 4.0' },
            { id: 'cc-by-nd', name: 'CC BY-ND 4.0' },
            { id: 'cc-by-nc-nd', name: 'CC BY-NC-ND 4.0' },
            { id: 'public-domain', name: 'Public Domain' },
        ];
    }

    /**
     * @inheritdoc
     */
    async getExportFormats() {
        // In static mode, all exports are client-side
        return [
            { id: 'html5', name: 'Website (HTML5)', extension: 'zip' },
            { id: 'scorm12', name: 'SCORM 1.2', extension: 'zip' },
            { id: 'scorm2004', name: 'SCORM 2004', extension: 'zip' },
            { id: 'ims', name: 'IMS Content Package', extension: 'zip' },
            { id: 'epub3', name: 'ePub 3', extension: 'epub' },
        ];
    }

    /**
     * Get API parameters (from bundle).
     * @returns {Promise<Object>}
     */
    async getApiParameters() {
        if (this.dataProvider?.getApiParameters) {
            return this.dataProvider.getApiParameters();
        }
        return this.bundle.apiParameters || { routes: {} };
    }

    /**
     * Get upload limits (sensible defaults for static mode).
     * @returns {Promise<Object>}
     */
    async getUploadLimits() {
        if (this.dataProvider?.getUploadLimits) {
            return this.dataProvider.getUploadLimits();
        }

        // Static mode: no server-imposed limits, use reasonable defaults
        return {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            maxFileSizeFormatted: '100 MB',
            limitingFactor: 'none',
        };
    }

    /**
     * Get templates (not available in static mode).
     * @returns {Promise<Object>}
     */
    async getTemplates() {
        return { templates: [], locale: 'en' };
    }

    /**
     * Get changelog (load from local file).
     * @returns {Promise<string>}
     */
    async getChangelog() {
        try {
            const response = await fetch('./CHANGELOG.md');
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
        try {
            const response = await fetch('./libs/README.md');
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
        try {
            const response = await fetch('./libs/LICENSES');
            return response.ok ? response.text() : '';
        } catch {
            return '';
        }
    }

    /**
     * Get HTML template for a component.
     * In static mode, templates are bundled in iDevices data.
     * @param {string} componentId - Component sync ID
     * @returns {Promise<{htmlTemplate: string, responseMessage: string}>}
     */
    async getComponentHtmlTemplate(componentId) {
        // In static mode, templates are bundled in iDevice data
        // Return empty template - the actual template comes from iDevice definition
        return { responseMessage: 'OK', htmlTemplate: '' };
    }

    /**
     * Create a new theme - not supported in static mode.
     * @returns {Promise<{responseMessage: string}>}
     */
    async createTheme() {
        console.warn('[StaticCatalogAdapter] Theme creation not supported in offline mode');
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * Update/edit a theme - not supported in static mode.
     * @returns {Promise<{responseMessage: string}>}
     */
    async updateTheme() {
        console.warn('[StaticCatalogAdapter] Theme editing not supported in offline mode');
        return { responseMessage: 'NOT_SUPPORTED' };
    }

    /**
     * Get saved HTML view for a component.
     * In static mode, HTML views are generated client-side.
     * @param {string} componentId - Component sync ID
     * @returns {Promise<{responseMessage: string, htmlView: string}>}
     */
    async getSaveHtmlView(componentId) {
        // In static mode, HTML views are managed client-side via Yjs
        return { responseMessage: 'OK', htmlView: '' };
    }

    /**
     * Get iDevices by session ID (games API).
     * In static mode, games API is not available.
     * @param {string} sessionId - ODE session ID
     * @returns {Promise<{responseMessage: string, idevices: Array}>}
     */
    async getIdevicesBySessionId(sessionId) {
        console.warn('[StaticCatalogAdapter] Games API not available in offline mode');
        return { responseMessage: 'NOT_SUPPORTED', idevices: [] };
    }
}

export default StaticCatalogAdapter;

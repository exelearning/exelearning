/**
 * CatalogPort - Domain interface for accessing catalog data.
 * (iDevices, themes, locales, translations)
 * Implemented by ServerCatalogAdapter and StaticCatalogAdapter.
 */
export class CatalogPort {
    /**
     * Get all available iDevices.
     * @returns {Promise<Array<{id: string, name: string, category: string, ...}>>}
     */
    async getIDevices() {
        throw new Error('CatalogPort.getIDevices() not implemented');
    }

    /**
     * Get all available themes.
     * @returns {Promise<Array<{id: string, name: string, ...}>>}
     */
    async getThemes() {
        throw new Error('CatalogPort.getThemes() not implemented');
    }

    /**
     * Get all available locales.
     * @returns {Promise<Array<{code: string, name: string}>>}
     */
    async getLocales() {
        throw new Error('CatalogPort.getLocales() not implemented');
    }

    /**
     * Get translations for a specific locale.
     * @param {string} locale - Locale code (e.g., 'es', 'en')
     * @returns {Promise<Object>} - Translation key-value pairs
     */
    async getTranslations(locale) {
        throw new Error('CatalogPort.getTranslations() not implemented');
    }

    /**
     * Get iDevice by ID.
     * @param {string} id - iDevice ID
     * @returns {Promise<Object|null>}
     */
    async getIDevice(id) {
        throw new Error('CatalogPort.getIDevice() not implemented');
    }

    /**
     * Get theme by ID.
     * @param {string} id - Theme ID
     * @returns {Promise<Object|null>}
     */
    async getTheme(id) {
        throw new Error('CatalogPort.getTheme() not implemented');
    }

    /**
     * Get licenses.
     * @returns {Promise<Array>}
     */
    async getLicenses() {
        throw new Error('CatalogPort.getLicenses() not implemented');
    }

    /**
     * Get export formats.
     * @returns {Promise<Array>}
     */
    async getExportFormats() {
        throw new Error('CatalogPort.getExportFormats() not implemented');
    }

    /**
     * Get templates for a locale.
     * @param {string} locale - Locale code (e.g., 'es', 'en')
     * @returns {Promise<{templates: Array, locale: string}>}
     */
    async getTemplates(locale) {
        throw new Error('CatalogPort.getTemplates() not implemented');
    }

    /**
     * Get HTML template for a component.
     * @param {string} componentId - Component sync ID
     * @returns {Promise<{htmlTemplate: string}>}
     */
    async getComponentHtmlTemplate(componentId) {
        throw new Error('CatalogPort.getComponentHtmlTemplate() not implemented');
    }

    /**
     * Create a new theme (admin operation).
     * @param {Object} params - Theme creation parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async createTheme(params) {
        throw new Error('CatalogPort.createTheme() not implemented');
    }

    /**
     * Update/edit an existing theme (admin operation).
     * @param {string} themeDir - Theme directory name
     * @param {Object} params - Theme update parameters
     * @returns {Promise<{responseMessage: string}>}
     */
    async updateTheme(themeDir, params) {
        throw new Error('CatalogPort.updateTheme() not implemented');
    }

    /**
     * Get API parameters (endpoints, configuration).
     * @returns {Promise<Object>}
     */
    async getApiParameters() {
        throw new Error('CatalogPort.getApiParameters() not implemented');
    }

    /**
     * Get changelog text.
     * @returns {Promise<string>}
     */
    async getChangelog() {
        throw new Error('CatalogPort.getChangelog() not implemented');
    }

    /**
     * Get upload limits configuration.
     * @returns {Promise<{maxFileSize: number, maxFileSizeFormatted: string}>}
     */
    async getUploadLimits() {
        throw new Error('CatalogPort.getUploadLimits() not implemented');
    }

    /**
     * Get third-party code information.
     * @returns {Promise<string>}
     */
    async getThirdPartyCode() {
        throw new Error('CatalogPort.getThirdPartyCode() not implemented');
    }

    /**
     * Get licenses list text.
     * @returns {Promise<string>}
     */
    async getLicensesList() {
        throw new Error('CatalogPort.getLicensesList() not implemented');
    }

    /**
     * Get saved HTML view for a component.
     * @param {string} componentId - Component sync ID
     * @returns {Promise<{responseMessage: string, htmlView: string}>}
     */
    async getSaveHtmlView(componentId) {
        throw new Error('CatalogPort.getSaveHtmlView() not implemented');
    }

    /**
     * Get iDevices by session ID (games API).
     * @param {string} sessionId - ODE session ID
     * @returns {Promise<{responseMessage: string, idevices: Array}>}
     */
    async getIdevicesBySessionId(sessionId) {
        throw new Error('CatalogPort.getIdevicesBySessionId() not implemented');
    }
}

export default CatalogPort;

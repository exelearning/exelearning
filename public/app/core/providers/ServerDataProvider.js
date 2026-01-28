/**
 * ServerDataProvider - Fetches data from backend API endpoints.
 *
 * Used when running in server/online mode where backend API is available.
 *
 * @extends DataProvider
 */

import { DataProvider } from './DataProvider.js';

export class ServerDataProvider extends DataProvider {
    /**
     * @param {Object} baseFunctions - ApiCallBaseFunctions instance for HTTP requests
     * @param {Object} endpoints - API endpoint configurations
     */
    constructor(baseFunctions, endpoints) {
        super();
        this.func = baseFunctions;
        this.endpoints = endpoints;
    }

    /**
     * Get installed languages from server
     * @returns {Promise<{languages: Array}>}
     */
    async getLanguages() {
        const url = this.endpoints.api_languages_installed?.path;
        if (!url) {
            console.warn('[ServerDataProvider] No endpoint for api_languages_installed');
            return { languages: [] };
        }
        return await this.func.get(url);
    }

    /**
     * Get installed themes from server
     * @returns {Promise<{themes: Array}>}
     */
    async getThemes() {
        const url = this.endpoints.api_themes_installed?.path;
        if (!url) {
            console.warn('[ServerDataProvider] No endpoint for api_themes_installed');
            return { themes: [] };
        }
        return await this.func.get(url);
    }

    /**
     * Get installed iDevices from server
     * @returns {Promise<{idevices: Array}>}
     */
    async getIdevices() {
        const url = this.endpoints.api_idevices_installed?.path;
        if (!url) {
            console.warn('[ServerDataProvider] No endpoint for api_idevices_installed');
            return { idevices: [] };
        }
        return await this.func.get(url);
    }

    /**
     * Get API parameters from server
     * @param {string} apiUrlParameters - Parameters endpoint URL
     * @returns {Promise<{routes: Object, userPreferencesConfig?: Object}>}
     */
    async getParameters(apiUrlParameters) {
        return await this.func.get(apiUrlParameters);
    }

    /**
     * Get translations for a locale from server
     * @param {string} locale - Language code
     * @returns {Promise<{translations: Object}>}
     */
    async getTranslations(locale) {
        let url = this.endpoints.api_translations_list_by_locale?.path;
        if (!url) {
            console.warn('[ServerDataProvider] No endpoint for api_translations_list_by_locale');
            return { translations: {} };
        }
        url = url.replace('{locale}', locale);
        return await this.func.get(url);
    }

    /**
     * Get upload limits from server
     * @param {string} url - Upload limits endpoint URL
     * @returns {Promise<{maxFileSize: number, maxFileSizeFormatted: string, limitingFactor: string}>}
     */
    async getUploadLimits(url) {
        return await this.func.get(url);
    }
}

export default ServerDataProvider;

/**
 * StaticDataProvider - Uses bundled/embedded data for offline mode.
 *
 * Used when running in static mode (Electron/PWA) where no backend API is available.
 * Data comes from:
 * 1. window.__EXE_STATIC_DATA__ (injected by build)
 * 2. Loaded bundle.json file
 *
 * @extends DataProvider
 */

import { DataProvider } from './DataProvider.js';

export class StaticDataProvider extends DataProvider {
    /**
     * @param {Object} staticData - Bundled static data (from bundle.json or __EXE_STATIC_DATA__)
     */
    constructor(staticData = null) {
        super();
        this.staticData = staticData;
    }

    /**
     * Update static data (e.g., after loading bundle.json)
     * @param {Object} data - New static data
     */
    setStaticData(data) {
        this.staticData = data;
    }

    /**
     * Get data from static sources
     * Priority: window.__EXE_STATIC_DATA__ > internal cache
     * @private
     * @param {string} key - Data key ('idevices', 'themes', etc.)
     * @returns {Object|null}
     */
    _getData(key) {
        return window.__EXE_STATIC_DATA__?.[key] ||
               this.staticData?.[key] ||
               null;
    }

    /**
     * Get installed languages from static data
     * @returns {Promise<{languages: Array}>}
     */
    async getLanguages() {
        return this._getData('languages') || { languages: [] };
    }

    /**
     * Get installed themes from static data
     * @returns {Promise<{themes: Array}>}
     */
    async getThemes() {
        return this._getData('themes') || { themes: [] };
    }

    /**
     * Get installed iDevices from static data
     * @returns {Promise<{idevices: Array}>}
     */
    async getIdevices() {
        return this._getData('idevices') || { idevices: [] };
    }

    /**
     * Get API parameters from static data
     * @returns {Promise<{routes: Object, userPreferencesConfig?: Object}>}
     */
    async getParameters() {
        return this._getData('parameters') || { routes: {} };
    }

    /**
     * Get translations for a locale from static data
     * @param {string} locale - Language code
     * @returns {Promise<{translations: Object}>}
     */
    async getTranslations(locale) {
        const data = window.__EXE_STATIC_DATA__?.translations ||
                     this.staticData?.translations;

        if (!data) {
            return { translations: {} };
        }

        // Try exact locale, then base language, then 'en'
        const baseLocale = locale.split('-')[0];
        return data[locale] || data[baseLocale] || data.en || { translations: {} };
    }

    /**
     * Get upload limits (static mode defaults - no server limits)
     * @returns {Promise<{maxFileSize: number, maxFileSizeFormatted: string, limitingFactor: string}>}
     */
    async getUploadLimits() {
        return {
            maxFileSize: 100 * 1024 * 1024, // 100MB default
            maxFileSizeFormatted: '100 MB',
            limitingFactor: 'none',
            details: {
                isStatic: true,
            },
        };
    }
}

export default StaticDataProvider;

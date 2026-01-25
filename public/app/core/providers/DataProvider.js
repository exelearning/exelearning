/**
 * DataProvider - Abstract interface for data loading.
 *
 * This abstraction allows ApiCallManager to work with different data sources:
 * - ServerDataProvider: Fetches from backend API endpoints
 * - StaticDataProvider: Uses bundled/embedded data for offline mode
 *
 * All data providers implement the same interface, allowing consumer code
 * to use api.X() calls regardless of mode (static vs server).
 *
 * Usage:
 *   // Server mode
 *   const provider = new ServerDataProvider(baseFunctions, endpoints);
 *
 *   // Static mode
 *   const provider = new StaticDataProvider(staticData);
 *
 *   // Use same interface
 *   const languages = await provider.getLanguages();
 *   const themes = await provider.getThemes();
 */

export class DataProvider {
    /**
     * Get installed languages
     * @returns {Promise<{languages: Array}>}
     */
    async getLanguages() {
        throw new Error('DataProvider.getLanguages() must be implemented by subclass');
    }

    /**
     * Get installed themes
     * @returns {Promise<{themes: Array}>}
     */
    async getThemes() {
        throw new Error('DataProvider.getThemes() must be implemented by subclass');
    }

    /**
     * Get installed iDevices
     * @returns {Promise<{idevices: Array}>}
     */
    async getIdevices() {
        throw new Error('DataProvider.getIdevices() must be implemented by subclass');
    }

    /**
     * Get API parameters (routes, config)
     * @returns {Promise<{routes: Object, userPreferencesConfig?: Object}>}
     */
    async getParameters() {
        throw new Error('DataProvider.getParameters() must be implemented by subclass');
    }

    /**
     * Get translations for a locale
     * @param {string} locale - Language code (e.g., 'en', 'es')
     * @returns {Promise<{translations: Object}>}
     */
    async getTranslations(locale) {
        throw new Error('DataProvider.getTranslations() must be implemented by subclass');
    }

    /**
     * Get upload limits (file size limits)
     * @returns {Promise<{maxFileSize: number, maxFileSizeFormatted: string, limitingFactor: string}>}
     */
    async getUploadLimits() {
        throw new Error('DataProvider.getUploadLimits() must be implemented by subclass');
    }
}

export default DataProvider;

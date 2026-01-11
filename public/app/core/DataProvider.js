/**
 * DataProvider
 * Unified data access abstraction for eXeLearning.
 * Switches between server API calls and pre-bundled static data.
 *
 * Usage:
 *   const provider = new DataProvider('static'); // or 'server'
 *   await provider.init();
 *   const translations = await provider.getTranslations('en');
 */

// Use global AppLogger for debug-controlled logging
const getLogger = () => window.AppLogger || console;

export default class DataProvider {
    /**
     * @param {'server' | 'static'} mode - Data access mode
     * @param {Object} options - Configuration options
     * @param {string} [options.basePath=''] - Base path for API URLs
     * @param {Object} [options.staticData=null] - Pre-bundled static data (if not in window.__EXE_STATIC_DATA__)
     */
    constructor(mode = 'server', options = {}) {
        this.mode = mode;
        this.basePath = options.basePath || '';
        this.staticData = options.staticData || null;
        this.initialized = false;

        // Cache for loaded data (both modes)
        this.cache = {
            parameters: null,
            translations: {},
            idevices: null,
            themes: null,
            bundleManifest: null,
        };

        getLogger().log(`[DataProvider] Created in ${mode} mode`);
    }

    /**
     * Initialize the data provider
     * In static mode, loads data from window.__EXE_STATIC_DATA__ or fetches bundle.json
     */
    async init() {
        if (this.initialized) {
            return;
        }

        if (this.mode === 'static') {
            await this._initStaticData();
        }

        this.initialized = true;
        getLogger().log('[DataProvider] Initialized');
    }

    /**
     * Load static data from embedded or external source
     * @private
     */
    async _initStaticData() {
        // Priority 1: Constructor-provided data
        if (this.staticData) {
            getLogger().log('[DataProvider] Using constructor-provided static data');
            return;
        }

        // Priority 2: Embedded in window
        if (window.__EXE_STATIC_DATA__) {
            this.staticData = window.__EXE_STATIC_DATA__;
            getLogger().log('[DataProvider] Using window.__EXE_STATIC_DATA__');
            return;
        }

        // Priority 3: Fetch from bundle.json
        try {
            const bundleUrl = `${this.basePath}/data/bundle.json`;
            getLogger().log(`[DataProvider] Fetching static data from ${bundleUrl}`);
            const response = await fetch(bundleUrl);
            if (response.ok) {
                this.staticData = await response.json();
                getLogger().log('[DataProvider] Loaded static data from bundle.json');
                return;
            }
        } catch (e) {
            getLogger().warn('[DataProvider] Failed to fetch bundle.json:', e.message);
        }

        // Fallback: Create empty structure
        getLogger().warn('[DataProvider] No static data source found, using empty defaults');
        this.staticData = {
            parameters: { routes: {} },
            translations: { en: { translations: {} } },
            idevices: { idevices: [] },
            themes: { themes: [] },
            bundleManifest: null,
        };
    }

    /**
     * Check if running in static (offline) mode
     * @returns {boolean}
     */
    isStaticMode() {
        return this.mode === 'static';
    }

    /**
     * Check if running in server (online) mode
     * @returns {boolean}
     */
    isServerMode() {
        return this.mode === 'server';
    }

    /**
     * Get API parameters (route definitions)
     * @returns {Promise<{routes: Object}>}
     */
    async getApiParameters() {
        if (this.cache.parameters) {
            return this.cache.parameters;
        }

        if (this.mode === 'static') {
            this.cache.parameters = this.staticData?.parameters || { routes: {} };
            return this.cache.parameters;
        }

        // Server mode: fetch from API
        const url = `${this.basePath}/api/parameter-management/parameters/data/list`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.cache.parameters = await response.json();
            return this.cache.parameters;
        } catch (e) {
            getLogger().error('[DataProvider] Failed to fetch API parameters:', e);
            throw e;
        }
    }

    /**
     * Get translations for a locale
     * @param {string} locale - Language code (e.g., 'en', 'es')
     * @returns {Promise<{translations: Object}>}
     */
    async getTranslations(locale) {
        // Default to 'en' if locale is null/undefined
        const safeLocale = locale || 'en';

        if (this.cache.translations[safeLocale]) {
            return this.cache.translations[safeLocale];
        }

        if (this.mode === 'static') {
            // Try exact locale, then fall back to base language, then 'en'
            const baseLocale = safeLocale.split('-')[0];
            const translations =
                this.staticData?.translations?.[safeLocale] ||
                this.staticData?.translations?.[baseLocale] ||
                this.staticData?.translations?.en ||
                { translations: {} };

            this.cache.translations[safeLocale] = translations;
            return translations;
        }

        // Server mode: fetch from API
        const url = `${this.basePath}/api/translations/${safeLocale}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            this.cache.translations[safeLocale] = await response.json();
            return this.cache.translations[safeLocale];
        } catch (e) {
            getLogger().error(`[DataProvider] Failed to fetch translations for ${safeLocale}:`, e);
            // Return empty translations to avoid breaking the app
            return { translations: {} };
        }
    }

    /**
     * Get installed iDevices list
     * @returns {Promise<{idevices: Array}>}
     */
    async getInstalledIdevices() {
        if (this.cache.idevices) {
            return this.cache.idevices;
        }

        if (this.mode === 'static') {
            this.cache.idevices = this.staticData?.idevices || { idevices: [] };
            return this.cache.idevices;
        }

        // Server mode: will be fetched via apiCallManager
        // This method provides a fallback
        return { idevices: [] };
    }

    /**
     * Get installed themes list
     * @returns {Promise<{themes: Array}>}
     */
    async getInstalledThemes() {
        if (this.cache.themes) {
            return this.cache.themes;
        }

        if (this.mode === 'static') {
            this.cache.themes = this.staticData?.themes || { themes: [] };
            return this.cache.themes;
        }

        // Server mode: will be fetched via apiCallManager
        // This method provides a fallback
        return { themes: [] };
    }

    /**
     * Get bundle manifest (for resource fetching)
     * @returns {Promise<Object|null>}
     */
    async getBundleManifest() {
        if (this.cache.bundleManifest !== null) {
            return this.cache.bundleManifest;
        }

        if (this.mode === 'static') {
            this.cache.bundleManifest = this.staticData?.bundleManifest || null;
            return this.cache.bundleManifest;
        }

        // Server mode: ResourceFetcher handles this
        return null;
    }

    /**
     * Get upload limits configuration
     * In static mode, returns sensible defaults (no server-imposed limits)
     * @returns {Promise<Object>}
     */
    async getUploadLimits() {
        if (this.mode === 'static') {
            return {
                maxFileSize: 100 * 1024 * 1024, // 100MB default
                maxFileSizeFormatted: '100 MB',
                limitingFactor: 'none',
                details: {
                    isStatic: true,
                },
            };
        }

        // Server mode: fetch from API
        const url = `${this.basePath}/api/config/upload-limits`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (e) {
            getLogger().warn('[DataProvider] Failed to fetch upload limits, using defaults:', e);
            return {
                maxFileSize: 100 * 1024 * 1024,
                maxFileSizeFormatted: '100 MB',
                limitingFactor: 'unknown',
            };
        }
    }

    /**
     * Get user preferences
     * In static mode, returns default preferences
     * @returns {Promise<Object>}
     */
    async getUserPreferences() {
        if (this.mode === 'static') {
            return {
                locale: navigator.language?.split('-')[0] || 'en',
                theme: 'light',
                // Add other default preferences as needed
            };
        }

        // Server mode: will be fetched via user manager
        return {};
    }

    /**
     * Clear the cache (useful for testing or mode switching)
     */
    clearCache() {
        this.cache = {
            parameters: null,
            translations: {},
            idevices: null,
            themes: null,
            bundleManifest: null,
        };
    }

    /**
     * Get all static data (for debugging)
     * @returns {Object|null}
     */
    getStaticData() {
        return this.staticData;
    }
}

// Static helper to detect if static mode should be used
// Prefer using RuntimeConfig.fromEnvironment() or app.capabilities instead
DataProvider.detectMode = function () {
    // Prefer capabilities check if app is initialized
    const capabilities = window.eXeLearning?.app?.capabilities;
    if (capabilities) {
        return capabilities.storage.remote ? 'server' : 'static';
    }

    // Fallback to direct detection for early initialization
    // Explicit flag takes priority
    if (window.__EXE_STATIC_MODE__ === true) {
        return 'static';
    }

    // File protocol indicates static mode
    if (window.location.protocol === 'file:') {
        return 'static';
    }

    // No server URL configured indicates static mode
    if (!window.eXeLearning?.config?.fullURL) {
        return 'static';
    }

    // Default to server mode
    return 'server';
};

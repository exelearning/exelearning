/**
 * StaticDataProvider - Uses bundled/embedded data for offline mode.
 *
 * Used when running in static mode (Electron/PWA) where no backend API is available.
 * Data comes from:
 * 1. window.__EXE_STATIC_DATA__ (injected by build)
 * 2. Loaded bundle.json file
 *
 * Host integrations (WordPress, Moodle, Omeka-S) may inject an approved
 * theme registry via `window.eXeLearning.config.themeRegistryOverride`
 * before the editor boots. See {@link applyThemeRegistryOverride}.
 *
 * @extends DataProvider
 */

import { DataProvider } from './DataProvider.js';

/**
 * Merge a bundle themes payload with a host-supplied override.
 *
 * The override lets an embedding plugin:
 *  - hide specific built-in themes by id/name (`disabledBuiltins`)
 *  - append admin-approved uploaded themes (`uploaded`)
 * It does NOT mutate the bundle — the result is a fresh object so the
 * underlying static data can still be consulted as-is by other callers.
 *
 * When no override is present, or the override is malformed, the original
 * payload is returned unchanged. This keeps every existing consumer working.
 *
 * @param {{themes?: Array}|null} payload - Original themes payload.
 * @param {Object} [override] - Optional runtime override.
 * @param {string[]} [override.disabledBuiltins] - Theme ids/names to hide.
 * @param {Array}   [override.uploaded] - Admin-approved themes to append.
 * @returns {{themes: Array}}
 */
export function applyThemeRegistryOverride(payload, override) {
    const base = payload && Array.isArray(payload.themes) ? payload : { themes: [] };
    if (!override || typeof override !== 'object') {
        return base;
    }
    const disabled = new Set(
        Array.isArray(override.disabledBuiltins) ? override.disabledBuiltins : []
    );
    const uploaded = Array.isArray(override.uploaded) ? override.uploaded : [];
    const filtered = base.themes.filter((t) => {
        if (!t) return false;
        return !disabled.has(t.name) && !disabled.has(t.id);
    });
    // Uploaded themes win on id/name collision so an admin-approved override
    // can shadow a disabled built-in that a stale project still references.
    const uploadedKeys = new Set(uploaded.map((t) => t && (t.name || t.id)).filter(Boolean));
    const deduped = filtered.filter((t) => !uploadedKeys.has(t.name) && !uploadedKeys.has(t.id));
    return { ...base, themes: [...deduped, ...uploaded] };
}

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
     * Get installed themes from static data, merged with any host override.
     * @returns {Promise<{themes: Array}>}
     */
    async getThemes() {
        const payload = this._getData('themes') || { themes: [] };
        const override = window.eXeLearning?.config?.themeRegistryOverride;
        return applyThemeRegistryOverride(payload, override);
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

/**
 * StaticUserPreferenceAdapter - Static/offline implementation of UserPreferencePort.
 * Uses localStorage for preference persistence.
 */
import { UserPreferencePort } from '../../ports/UserPreferencePort.js';

export class StaticUserPreferenceAdapter extends UserPreferencePort {
    /**
     * @param {Object} [options]
     * @param {Object} [options.defaultPreferences] - Default preferences config
     * @param {string} [options.storageKey] - localStorage key prefix
     */
    constructor(options = {}) {
        super();
        this.defaultPreferences = options.defaultPreferences || {};
        this.storageKey = options.storageKey || 'exelearning_user_preferences';
        this.lopdKey = 'exelearning_lopd_accepted';
    }

    /**
     * Get default preferences from bundled config.
     * @private
     */
    _getDefaultPreferences() {
        // Minimal fallback defaults to prevent crashes
        const FALLBACK_DEFAULTS = {
            locale: { title: 'Language', value: 'en', type: 'select' },
            advancedMode: { title: 'Advanced Mode', value: 'false', type: 'checkbox' },
            versionControl: { title: 'Version Control', value: 'false', type: 'checkbox' },
        };

        // Try to get from bundled parameters first (multiple possible locations)
        const bundled =
            window.eXeLearning?.app?.apiCall?.parameters?.userPreferencesConfig ||
            window.eXeLearning?.app?.api?.parameters?.userPreferencesConfig;

        if (bundled) {
            const result = JSON.parse(JSON.stringify(bundled));
            // Ensure required fields have valid values (not null)
            for (const key of Object.keys(FALLBACK_DEFAULTS)) {
                if (!result[key] || result[key].value === null || result[key].value === undefined) {
                    result[key] = { ...FALLBACK_DEFAULTS[key] };
                }
            }
            return result;
        }

        // Return default preferences if available
        if (Object.keys(this.defaultPreferences).length > 0) {
            const result = JSON.parse(JSON.stringify(this.defaultPreferences));
            // Ensure required fields have valid values
            for (const key of Object.keys(FALLBACK_DEFAULTS)) {
                if (!result[key] || result[key].value === null || result[key].value === undefined) {
                    result[key] = { ...FALLBACK_DEFAULTS[key] };
                }
            }
            return result;
        }

        // Return fallback defaults
        return { ...FALLBACK_DEFAULTS };
    }

    /**
     * Load stored preferences from localStorage.
     * @private
     */
    _loadStoredPreferences() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('[StaticUserPreferenceAdapter] Failed to load preferences:', error);
            return {};
        }
    }

    /**
     * Save preferences to localStorage.
     * @private
     */
    _saveStoredPreferences(prefs) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(prefs));
            return true;
        } catch (error) {
            console.warn('[StaticUserPreferenceAdapter] Failed to save preferences:', error);
            return false;
        }
    }

    /**
     * @inheritdoc
     */
    async getPreferences() {
        const defaultPrefs = this._getDefaultPreferences();
        const stored = this._loadStoredPreferences();

        // Merge stored values into defaults
        for (const [key, value] of Object.entries(stored)) {
            if (defaultPrefs[key]) {
                defaultPrefs[key].value = value;
            }
        }

        return {
            userPreferences: defaultPrefs,
        };
    }

    /**
     * @inheritdoc
     */
    async savePreferences(params) {
        const stored = this._loadStoredPreferences();
        Object.assign(stored, params);
        const success = this._saveStoredPreferences(stored);
        return { success };
    }

    /**
     * @inheritdoc
     */
    async acceptLopd() {
        try {
            localStorage.setItem(this.lopdKey, 'true');
            return { success: true };
        } catch (error) {
            console.warn('[StaticUserPreferenceAdapter] Failed to save LOPD acceptance:', error);
            return { success: false };
        }
    }

    /**
     * @inheritdoc
     */
    async isLopdAccepted() {
        try {
            return localStorage.getItem(this.lopdKey) === 'true';
        } catch {
            return false;
        }
    }

    /**
     * @inheritdoc
     */
    async getPreference(key, defaultValue = null) {
        const stored = this._loadStoredPreferences();
        return stored[key] !== undefined ? stored[key] : defaultValue;
    }

    /**
     * @inheritdoc
     */
    async setPreference(key, value) {
        const stored = this._loadStoredPreferences();
        stored[key] = value;
        const success = this._saveStoredPreferences(stored);
        return { success };
    }
}

export default StaticUserPreferenceAdapter;

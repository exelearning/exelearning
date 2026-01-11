/**
 * ServerUserPreferenceAdapter - Server-side implementation of UserPreferencePort.
 * Handles user preference operations via HTTP API.
 */
import { UserPreferencePort } from '../../ports/UserPreferencePort.js';

/**
 * Default preferences structure expected by the frontend.
 * Used as fallback when server returns empty preferences (e.g., for unauthenticated users).
 */
const DEFAULT_PREFERENCES = {
    locale: { title: 'Language', value: 'en', type: 'select' },
    advancedMode: { title: 'Advanced Mode', value: 'false', type: 'checkbox' },
    versionControl: { title: 'Version Control', value: 'false', type: 'checkbox' },
    theme: { title: 'Theme', value: 'base', type: 'select' },
    defaultLicense: { title: 'Default License', value: 'creative commons: attribution - share alike 4.0', type: 'select' },
};

export class ServerUserPreferenceAdapter extends UserPreferencePort {
    /**
     * @param {import('../../HttpClient').HttpClient} httpClient
     * @param {Object} endpoints - API endpoints
     * @param {string} basePath - API base path
     */
    constructor(httpClient, endpoints = {}, basePath = '') {
        super();
        this.http = httpClient;
        this.endpoints = endpoints;
        this.basePath = basePath;
    }

    /**
     * Get endpoint URL by name.
     * @private
     */
    _getEndpoint(name) {
        return this.endpoints[name]?.path || null;
    }

    /**
     * Get auth token from available sources.
     * @private
     */
    _getAuthToken() {
        return (
            window.eXeLearning?.app?.project?._yjsBridge?.authToken ||
            window.eXeLearning?.app?.auth?.getToken?.() ||
            window.eXeLearning?.config?.token ||
            localStorage.getItem('authToken')
        );
    }

    /**
     * Make authenticated request.
     * @private
     */
    async _authFetch(url, options = {}) {
        const token = this._getAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include',
        });

        if (!response.ok) {
            throw new Error(`Request failed: ${response.statusText}`);
        }

        if (response.status === 204) {
            return { success: true };
        }

        return response.json();
    }

    /**
     * @inheritdoc
     */
    async getPreferences() {
        let url = this._getEndpoint('api_user_preferences_get');
        if (!url) {
            url = `${this.basePath}/api/user/preferences`;
        }

        try {
            const response = await this._authFetch(url, { method: 'GET' });

            // Ensure we have the expected structure with defaults
            const userPreferences = response?.userPreferences || {};

            // Merge with defaults to ensure all required fields exist
            const mergedPreferences = { ...DEFAULT_PREFERENCES };
            for (const [key, value] of Object.entries(userPreferences)) {
                if (value && typeof value === 'object') {
                    mergedPreferences[key] = { ...DEFAULT_PREFERENCES[key], ...value };
                }
            }

            return { userPreferences: mergedPreferences };
        } catch (error) {
            console.warn('[ServerUserPreferenceAdapter] getPreferences error:', error);
            // Return defaults on error
            return { userPreferences: { ...DEFAULT_PREFERENCES } };
        }
    }

    /**
     * @inheritdoc
     */
    async savePreferences(params) {
        let url = this._getEndpoint('api_user_preferences_save');
        if (!url) {
            url = `${this.basePath}/api/user/preferences`;
        }
        return this._authFetch(url, {
            method: 'PUT',
            body: JSON.stringify(params),
        });
    }

    /**
     * @inheritdoc
     */
    async acceptLopd() {
        let url = this._getEndpoint('api_user_set_lopd_accepted');
        if (!url) {
            url = `${this.basePath}/api/user/lopd/accept`;
        }
        return this._authFetch(url, { method: 'POST' });
    }

    /**
     * @inheritdoc
     */
    async isLopdAccepted() {
        try {
            const prefs = await this.getPreferences();
            return prefs?.userPreferences?.lopdAccepted?.value === true;
        } catch {
            return false;
        }
    }

    /**
     * @inheritdoc
     */
    async getPreference(key, defaultValue = null) {
        try {
            const prefs = await this.getPreferences();
            const pref = prefs?.userPreferences?.[key];
            return pref?.value !== undefined ? pref.value : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    /**
     * @inheritdoc
     */
    async setPreference(key, value) {
        return this.savePreferences({ [key]: value });
    }
}

export default ServerUserPreferenceAdapter;

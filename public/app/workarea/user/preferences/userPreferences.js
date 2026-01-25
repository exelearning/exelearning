export default class UserPreferences {
    constructor(manager) {
        this.manager = manager;
    }

    preferenceTemplate = {
        title: '',
        category: '',
        heritable: false,
        value: '',
        type: 'text',
        hide: true,
    };

    /**
     * Load user preferences
     *
     */
    async load() {
        const app = eXeLearning.app;
        const isStaticMode = app.capabilities?.storage?.remote === false;

        // Get preferences config - try multiple sources
        let preferencesConfig = null;

        if (isStaticMode) {
            // Static mode: get from API (uses internal static data cache)
            const apiParams = await app.api.getApiParameters();
            preferencesConfig = apiParams?.userPreferencesConfig;
        } else {
            // Server mode: use api.parameters (loaded earlier)
            preferencesConfig = app.api?.parameters?.userPreferencesConfig;
        }

        // Final fallback to minimal defaults
        // Note: advancedMode defaults to 'true' in static mode so all features are visible
        if (!preferencesConfig) {
            preferencesConfig = {
                locale: { title: 'Language', value: 'en', type: 'select' },
                advancedMode: { title: 'Advanced Mode', value: isStaticMode ? 'true' : 'false', type: 'checkbox' },
                versionControl: { title: 'Version Control', value: 'false', type: 'checkbox' },
            };
        }

        this.preferences = JSON.parse(JSON.stringify(preferencesConfig));

        // Load user's saved preferences (only if server available)
        if (!isStaticMode) {
            await this.apiLoadPreferences();
        } else {
            // Static mode: load from localStorage via adapter
            await this.loadStaticPreferences();
        }
    }

    /**
     * Set values of api preferences
     *
     * @param {Array} preferences
     */
    setPreferences(preferences) {
        for (let [key, value] of Object.entries(preferences)) {
            if (preferences[key]) {
                if (this.preferences[key]) {
                    this.preferences[key].value = preferences[key].value;
                } else {
                    this.preferences[key] = JSON.parse(
                        JSON.stringify(this.preferenceTemplate)
                    );
                    this.preferences[key].title = key;
                    this.preferences[key].value = preferences[key].value;
                }
            }
        }
    }

    /**
     * Show preferences modal
     *
     */
    showModalPreferences() {
        this.manager.app.modals.properties.show({
            node: this,
            title: _('Preferences'),
            contentId: 'preferences',
            properties: this.preferences,
        });
    }

    /**
     * Get user preferences from server
     *
     */
    async apiLoadPreferences() {
        let preferences = await eXeLearning.app.api.getUserPreferences();
        this.setPreferences(preferences.userPreferences);
        this.manager.reloadMode(preferences.userPreferences.advancedMode.value);
        this.manager.reloadVersionControl(
            preferences.userPreferences.versionControl.value
        );
        this.manager.reloadLang(preferences.userPreferences.locale.value);
    }

    /**
     * Load user preferences in static mode (from localStorage)
     *
     */
    async loadStaticPreferences() {
        try {
            // Load from localStorage
            const stored = localStorage.getItem('exe_user_preferences');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.userPreferences) {
                    this.setPreferences(parsed.userPreferences);
                }
            }

            // If no saved locale preference, use the app's current locale (validated in initStaticMode)
            if (this.preferences.locale && !this.preferences.locale.value) {
                // Config may be string (before app.js parses) or object (after)
                let appConfig = window.eXeLearning?.config;
                if (typeof appConfig === 'string') {
                    try {
                        appConfig = JSON.parse(appConfig);
                    } catch (e) {
                        appConfig = {};
                    }
                }
                if (appConfig?.locale) {
                    this.preferences.locale.value = appConfig.locale;
                }
            }

            // Apply preferences to UI
            if (this.preferences.advancedMode) {
                this.manager.reloadMode(this.preferences.advancedMode.value);
            }
            if (this.preferences.versionControl) {
                this.manager.reloadVersionControl(this.preferences.versionControl.value);
            }
            if (this.preferences.locale) {
                this.manager.reloadLang(this.preferences.locale.value);
            }
        } catch (error) {
            console.warn('[UserPreferences] Error loading static preferences:', error);
        }
    }

    /**
     * Save user preferences
     *
     */
    async apiSaveProperties(preferences) {
        // Update array of preferences
        for (let [key, value] of Object.entries(preferences)) {
            this.preferences[key].value = value;
        }

        // Generate params array
        let params = {};
        for (let [key, value] of Object.entries(preferences)) {
            params[key] = value;
        }

        // Save based on mode
        const isStaticMode = eXeLearning.app.capabilities?.storage?.remote === false;
        if (isStaticMode) {
            // Static mode: save to localStorage
            const toStore = { userPreferences: {} };
            for (const [key, value] of Object.entries(params)) {
                toStore.userPreferences[key] = { value };
            }
            localStorage.setItem('exe_user_preferences', JSON.stringify(toStore));
        } else {
            // Server mode: save via API
            await eXeLearning.app.api.putSaveUserPreferences(params);
        }

        // Update interface advanced class
        if (preferences.advancedMode)
            this.manager.reloadMode(preferences.advancedMode);
        // Update interface versionControl class
        if (preferences.versionControl)
            this.manager.reloadVersionControl(preferences.versionControl);
        // Update interface lang
        if (preferences.locale) await this.manager.reloadLang(preferences.locale);

        // Reloading of the page so that it takes a possible change of language in the user preferences
        if (params['locale'] !== undefined) {
            window.onbeforeunload = null;
            window.location.reload();
        }
    }
}

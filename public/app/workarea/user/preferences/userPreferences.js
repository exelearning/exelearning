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
        this.preferences = JSON.parse(
            JSON.stringify(eXeLearning.app.api.parameters.userPreferencesConfig)
        );
        await this.apiLoadPreferences();
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
     * Get user preferences
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
        // Save in database/localStorage
        await eXeLearning.app.api.putSaveUserPreferences(params);

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

import UserPreferences from './preferences/userPreferences.js';

export default class UserManager {
    constructor(app) {
        this.app = app;
        this.name = eXeLearning.user.username;
        this.mode = this.modeValues.default;
        this.versionControl = null;
        this.preferences = new UserPreferences(this);
    }

    versionValues = { active: 'active', inactive: 'inactive' };
    modeValues = { default: 'default', advanced: 'advanced' };

    /**
     *
     */
    async loadUserPreferences() {
        await this.preferences.load();
    }

    /**
     * Reload interface class
     *
     * @param {*} modeAdvanced
     */
    reloadMode(modeAdvanced) {
        if (modeAdvanced == 'true') {
            this.mode = this.modeValues.advanced;
        } else {
            this.mode = this.modeValues.default;
        }
        this.setModeAttribute();
    }

    /**
     * Set mode attribute to body
     *
     */
    setModeAttribute() {
        document.querySelector('body').setAttribute('mode', this.mode);
    }

    /**
     * Reload class
     *
     */
    reloadVersionControl(versionControl) {
        versionControl = this.versionValues.active;
        this.versionControl = versionControl;
    }

    /**
     *
     */
    async deleteOdeFilesByDate() {
        let msDate = Date.now();
        let params = { date: msDate };
        await eXeLearning.app.api.postDeleteOdeFilesByDate(params);
    }

    /**
     * Reload interface lang
     *
     * @param {*} lang
     */
    reloadLang(lang) {
        eXeLearning.app.locale.setLocaleLang(lang);
    }
}

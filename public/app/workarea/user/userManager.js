import UserPreferences from './preferences/userPreferences.js';

export default class UserManager {
    constructor(app) {
        this.app = app;
        this._userData = eXeLearning.user; // Reference to backend user data
        this.mode = this.modeValues.default;
        this.versionControl = null;
        this.preferences = new UserPreferences(this);
    }

    versionValues = { active: 'active', inactive: 'inactive' };
    modeValues = { default: 'default', advanced: 'advanced' };

    // Getters for unified access to user data from backend
    get id() { return this._userData?.id; }
    get email() { return this._userData?.username; } // username IS the email
    get username() { return this._userData?.username; }
    get name() { return this._userData?.username; }
    get gravatarUrl() { return this._userData?.gravatarUrl; }
    get usernameFirsLetter() { return this._userData?.usernameFirsLetter; }
    get acceptedLopd() { return this._userData?.acceptedLopd; }
    get isGuest() {
        return this._userData?.username?.toLowerCase().endsWith('@guest.local');
    }

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
        if (
            versionControl == 'false' &&
            eXeLearning.config.isOfflineInstallation === true
        ) {
            versionControl = this.versionValues.inactive;
            this.versionControl = versionControl;
            this.deleteOdeFilesByDate();
        } else {
            versionControl = this.versionValues.active;
            this.versionControl = versionControl;
        }
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
    async reloadLang(lang) {
        await eXeLearning.app.locale.setLocaleLang(lang);
        await eXeLearning.app.locale.loadTranslationsStrings();
    }
}

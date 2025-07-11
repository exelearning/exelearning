import Theme from './theme.js';

export default class ThemeList {
    constructor(manager) {
        this.manager = manager;
        this.installed = {};
    }

    /**
     * Load themes
     *
     */
    async load() {
        await this.loadThemesInstalled();
    }

    /**
     * Load themes from api
     *
     * @returns {Array}
     */
    async loadThemesInstalled() {
        this.installed = {};
        let installedThemesJSON =
            await this.manager.app.api.getThemesInstalled();
        if (installedThemesJSON && installedThemesJSON.themes) {
            installedThemesJSON.themes.forEach((themeData) => {
                this.loadTheme(themeData);
            });
        }
        this.orderThemesInstalled();
        return this.installed;
    }

    /**
     * Load theme from api
     *
     * @param {*} themeId
     * @returns {Array}
     */
    async loadThemeInstalled(themeId) {
        let installedThemesJSON =
            await this.manager.app.api.getThemesInstalled();
        if (installedThemesJSON && installedThemesJSON.themes) {
            installedThemesJSON.themes.forEach((themeData) => {
                if (themeId) {
                    // Load only themeId
                    if (themeId == themeData.name) {
                        let theme = new Theme(this.manager, themeData);
                        this.installed[themeData.name] = theme;
                    }
                }
            });
        }
        this.orderThemesInstalled();
        return this.installed;
    }

    /**
     * Load array of themes
     *
     * @param {*} themesData
     */
    loadThemes(themesData) {
        this.installed = {};
        themesData.forEach((themeData) => {
            let theme = this.newTheme(themeData);
            this.installed[themeData.name] = theme;
        });
        this.orderThemesInstalled();
    }

    /**
     * Load theme in client
     *
     * @param {*} themeData
     * @returns {Theme}
     */
    loadTheme(themeData) {
        let theme = this.newTheme(themeData);
        this.installed[themeData.name] = theme;
    }

    /**
     * Create theme class
     *
     * @param {*} themeData
     */
    newTheme(themeData) {
        let theme = new Theme(this.manager, themeData);
        return theme;
    }

    /**
     * Get theme by id
     *
     * @returns {Array}
     */
    getThemeInstalled(idWanted) {
        for (let [id, theme] of Object.entries(this.installed)) {
            if (id == idWanted) {
                return theme;
            }
        }
        return null;
    }

    /**
     * Sort themes installed alphabetically
     *
     */
    orderThemesInstalled() {
        let newInstalledDict = {};
        var items = Object.keys(this.installed).map((key) => {
            return key;
        });
        items.sort();
        items.forEach((key) => {
            newInstalledDict[key] = this.installed[key];
        });
        this.installed = newInstalledDict;
    }

    /**
     * Remove theme
     *
     * @param {*} id
     */
    async removeTheme(id) {
        if (this.manager.selected.id == id) {
            await this.manager.selectTheme(
                eXeLearning.config.defaultTheme,
                true
            );
        }
        delete this.installed[id];
    }
}

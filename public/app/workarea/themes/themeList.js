import Theme from './theme.js';

export default class ThemeList {
    constructor(manager) {
        this.manager = manager;
        this.installed = {};
    }

    /**
     * Load themes
     * Loads both server themes (base/site) and user themes from IndexedDB
     */
    async load() {
        await this.loadThemesInstalled();
        await this.loadUserThemesFromIndexedDB();
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
     * Load user themes from IndexedDB (persistent local storage)
     * These are themes imported from .elpx files that persist across sessions.
     * @param {ResourceCache} [providedCache] - Optional ResourceCache to use (passed from YjsProjectBridge during init)
     */
    async loadUserThemesFromIndexedDB(providedCache = null) {
        try {
            // Use provided cache, or try to get from YjsProjectBridge
            let resourceCache = providedCache;
            if (!resourceCache) {
                resourceCache = this.manager.app?.project?._yjsBridge?.resourceCache;
            }
            if (!resourceCache) {
                return;
            }

            // List all user themes in IndexedDB
            const userThemes = await resourceCache.listUserThemes();
            if (!userThemes || userThemes.length === 0) {
                return;
            }

            Logger.log(`[ThemeList] Loading ${userThemes.length} user theme(s) from IndexedDB...`);

            for (const { name, config } of userThemes) {
                // Skip if already loaded
                if (this.installed[name]) {
                    continue;
                }

                // Add to installed list
                this.addUserTheme(config);
            }

            this.orderThemesInstalled();
            Logger.log('[ThemeList] User themes loaded from IndexedDB');
        } catch (error) {
            console.error('[ThemeList] Error loading user themes from IndexedDB:', error);
        }
    }

    /**
     * Add a user theme (imported from .elpx, stored in IndexedDB)
     * User themes are stored client-side in IndexedDB for persistence
     * and synced via Yjs for collaboration.
     *
     * @param {Object} themeConfig - Theme configuration from parsed config.xml
     * @param {string} themeConfig.name - Theme name
     * @param {string} themeConfig.dirName - Theme directory name
     * @param {string} themeConfig.displayName - Display name
     * @param {string} themeConfig.type - Should be 'user'
     * @param {string[]} themeConfig.cssFiles - CSS file names
     * @param {boolean} themeConfig.isUserTheme - Flag indicating user theme
     * @returns {Theme} The created Theme instance
     */
    addUserTheme(themeConfig) {
        // User themes need special URL handling since they're served from IndexedDB/Yjs
        // Use a special prefix that the Theme class will recognize
        const userThemeUrl = `user-theme://${themeConfig.dirName}`;

        const themeData = {
            ...themeConfig,
            url: userThemeUrl,
            preview: '', // No preview for user themes
            valid: true,
        };

        const theme = this.newTheme(themeData);
        theme.isUserTheme = true; // Mark as user theme
        this.installed[themeConfig.name] = theme;
        this.orderThemesInstalled();

        console.log(`[ThemeList] Added user theme '${themeConfig.name}'`);
        return theme;
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

import ThemeList from './themeList.js';

// Use global AppLogger for debug-controlled logging
const getLogger = () => window.AppLogger || console;

export default class ThemesManager {
    constructor(app) {
        this.app = app;
        this.list = new ThemeList(this);
        this.symfonyURL = this.app.eXeLearning.config.basePath;
        this.selected = null;

        // Yjs binding for theme sync
        this.metadataObserver = null;
        this.isApplyingRemoteTheme = false;
    }

    /**
     * Initialize Yjs binding for real-time theme sync
     */
    initYjsBinding() {
        const project = this.app.project;
        if (project?._yjsBridge) {
            const documentManager = project._yjsBridge.getDocumentManager();
            if (documentManager) {
                const metadata = documentManager.getMetadata();

                // Load initial theme from Yjs
                const initialTheme = metadata.get('theme');
                if (initialTheme && initialTheme !== this.selected?.id) {
                    this.selectTheme(initialTheme, false, false, false);
                    getLogger().log('[ThemesManager] Loaded initial theme from Yjs:', initialTheme);
                }

                // Observe metadata changes for remote theme updates
                this.metadataObserver = (event) => {
                    // Only react to remote changes (not our own)
                    if (event.transaction.origin === 'user') return;

                    event.changes.keys.forEach((change, key) => {
                        if (key === 'theme' && (change.action === 'add' || change.action === 'update')) {
                            const newTheme = metadata.get('theme');
                            if (newTheme && newTheme !== this.selected?.id) {
                                this.onRemoteThemeChange(newTheme);
                            }
                        }
                    });
                };

                metadata.observe(this.metadataObserver);
                getLogger().log('[ThemesManager] Yjs theme binding initialized');
            }
        }
    }

    /**
     * Handle remote theme change from Yjs
     * @param {string} themeId - The new theme ID
     */
    async onRemoteThemeChange(themeId) {
        getLogger().log('[ThemesManager] Remote theme change:', themeId);
        this.isApplyingRemoteTheme = true;
        try {
            await this.selectTheme(themeId, false, false, true);
            // Update UI in navbarStyles if available
            if (this.app.menus?.navbar?.styles?.updateSelectedTheme) {
                this.app.menus.navbar.styles.updateSelectedTheme(themeId);
            }
        } finally {
            this.isApplyingRemoteTheme = false;
        }
    }

    /**
     * Save theme to Yjs metadata
     * @param {string} themeId - The theme ID to save
     */
    saveThemeToYjs(themeId) {
        const project = this.app.project;
        if (project?._yjsBridge) {
            const documentManager = project._yjsBridge.getDocumentManager();
            if (documentManager) {
                const metadata = documentManager.getMetadata();
                const ydoc = documentManager.getDoc();

                ydoc.transact(() => {
                    metadata.set('theme', themeId);
                    metadata.set('modifiedAt', Date.now());
                }, ydoc.clientID);

                getLogger().log('[ThemesManager] Saved theme to Yjs:', themeId);
            }
        }
    }

    /**
     * Select a theme
     * @param {string} id - Theme ID
     * @param {boolean} save - Save to Yjs
     * @param {boolean} forceReload - Force reload even if same theme
     * @param {boolean} isSync - Is this a sync action (skip page reload)
     */
    async selectTheme(id, save, forceReload, isSync = false) {
        let themeSelected = this.getTheme(id);
        // Try to load the default theme if can't get the selected theme
        if (!themeSelected) {
            themeSelected = this.getTheme(eXeLearning.config.defaultTheme);
        }
        // Select the theme and apply it
        if (themeSelected) {
            let prevThemeSelected = this.selected;
            this.selected = themeSelected;
            if (
                !prevThemeSelected ||
                forceReload ||
                prevThemeSelected.id != this.selected.id
            ) {
                // In case of syncAction don't reload page
                if (isSync == false) {
                    await this.selected.select();
                } else {
                    await this.selected.select(true);
                }
            }
            // Save to Yjs instead of userPreferences
            if (save) {
                this.saveThemeToYjs(id);
            }
        }
    }

    /**
     *
     */
    getThemeIcons() {
        if (this.selected.icons) {
            return this.selected.icons;
        } else {
            //return this.iconsDefault;
            return {};
        }
    }

    /**
     *
     * @param {*} id
     * @returns
     */
    getTheme(id) {
        return this.list.getThemeInstalled(id);
    }

    /**
     *
     */
    async loadThemesFromAPI() {
        await this.list.load();
    }
}

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
     * Ensure user theme is copied to Yjs themeFiles for collaboration/export
     * Only copies if the theme is not already in Yjs
     * @param {string} themeId - Theme ID
     * @param {Object} theme - Theme instance
     * @private
     */
    async _ensureUserThemeInYjs(themeId, theme) {
        const project = this.app.project;
        if (!project?._yjsBridge) return;

        const documentManager = project._yjsBridge.getDocumentManager();
        if (!documentManager) return;

        // Check if theme already exists in Yjs themeFiles
        const themeFilesMap = documentManager.getThemeFiles();
        if (themeFilesMap.has(themeId)) {
            getLogger().log(`[ThemesManager] User theme '${themeId}' already in Yjs`);
            return;
        }

        // Get theme files from ResourceCache (IndexedDB)
        const resourceCache = project._yjsBridge.resourceCache;
        if (!resourceCache) {
            console.warn('[ThemesManager] ResourceCache not available for copying theme to Yjs');
            return;
        }

        try {
            // Get raw compressed data from IndexedDB
            const rawTheme = await resourceCache.getUserThemeRaw(themeId);
            if (!rawTheme) {
                console.warn(`[ThemesManager] Theme '${themeId}' not found in IndexedDB`);
                return;
            }

            // Convert compressed Uint8Array to base64 for Yjs storage
            const base64Compressed = project._yjsBridge._uint8ArrayToBase64(rawTheme.compressedFiles);

            // Store compressed theme in Yjs (single string, not Y.Map)
            themeFilesMap.set(themeId, base64Compressed);
            getLogger().log(`[ThemesManager] Copied user theme '${themeId}' to Yjs for collaboration`);
        } catch (error) {
            console.error(`[ThemesManager] Error copying theme '${themeId}' to Yjs:`, error);
        }
    }

    /**
     * Remove user theme from Yjs themeFiles (but keep in IndexedDB)
     * Called when user selects a different theme.
     * The theme remains in IndexedDB for the user to use in other projects.
     * @param {string} themeId - Theme ID to remove from Yjs
     * @private
     */
    async _removeUserThemeFromYjs(themeId) {
        const project = this.app.project;
        if (!project?._yjsBridge) return;

        const documentManager = project._yjsBridge.getDocumentManager();
        if (!documentManager) return;

        const themeFilesMap = documentManager.getThemeFiles();
        if (themeFilesMap.has(themeId)) {
            themeFilesMap.delete(themeId);
            getLogger().log(`[ThemesManager] Removed user theme '${themeId}' from Yjs (kept in IndexedDB)`);
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

            // If previous theme was a user theme and we're selecting a different theme,
            // remove the previous theme from Yjs (but keep in IndexedDB)
            if (save && prevThemeSelected && prevThemeSelected.id !== id) {
                if (prevThemeSelected.isUserTheme || prevThemeSelected.type === 'user') {
                    await this._removeUserThemeFromYjs(prevThemeSelected.id);
                }
            }

            // If saving and this is a user theme, ensure it's in Yjs for collaboration
            if (save && (themeSelected.isUserTheme || themeSelected.type === 'user')) {
                await this._ensureUserThemeInYjs(themeSelected.id, themeSelected);
            }

            // Save to Yjs metadata
            if (save) {
                this.saveThemeToYjs(id);
            }
        }
    }

    /**
     *
     */
    getThemeIcons() {
        if (this.selected?.icons) {
            return this.selected.icons;
        }
        return {};
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

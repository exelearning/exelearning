import ApiCallBaseFunctions from './apiCallBaseFunctions.js';
import { ServerDataProvider, StaticDataProvider } from '../core/providers/index.js';

export default class ApiCallManager {
    constructor(app) {
        this.app = app;
        this.apiUrlBase = `${app.eXeLearning.config.baseURL}`;
        this.apiUrlBasePath = `${app.eXeLearning.config.basePath}`;
        this.apiUrlParameters = `${this.apiUrlBase}${this.apiUrlBasePath}/api/parameter-management/parameters/data/list`;
        this.func = new ApiCallBaseFunctions();
        this.endpoints = {};
        this.adapters = null;
        this.staticData = null; // Internal cache for static mode data
        this._dataProvider = null; // DataProvider instance (set during init)
    }

    /**
     * Initialize API. In static mode, loads bundle.json and creates StaticDataProvider.
     * In server mode, creates ServerDataProvider after endpoints are loaded.
     * Must be called before using API methods in static mode.
     */
    async init() {
        if (this._isStaticMode() && !this.staticData) {
            await this._loadStaticBundle();
            // Create StaticDataProvider with loaded data
            this._dataProvider = new StaticDataProvider(this.staticData);
            // Populate this.parameters from static data so UI code can use api.parameters consistently
            this.parameters = this.staticData?.parameters || { routes: {} };
        }
    }

    /**
     * Initialize the ServerDataProvider after endpoints are loaded.
     * Called from loadApiParameters() after server endpoints are available.
     * @private
     */
    _initServerDataProvider() {
        if (!this._isStaticMode() && !this._dataProvider) {
            this._dataProvider = new ServerDataProvider(this.func, this.endpoints);
        }
    }

    /**
     * Load static bundle data from embedded or external source
     * @private
     */
    async _loadStaticBundle() {
        // Priority 1: window.__EXE_STATIC_DATA__ (injected by build)
        if (window.__EXE_STATIC_DATA__) {
            this.staticData = window.__EXE_STATIC_DATA__;
            console.log('[ApiCallManager] Using window.__EXE_STATIC_DATA__');
            return;
        }

        // Priority 2: fetch bundle.json (for dev)
        // In static mode, bundle.json is always relative to the current HTML file
        // Don't use basePath here as it may include subdirectory paths that cause double-path issues
        try {
            const bundleUrl = './data/bundle.json';
            console.log(`[ApiCallManager] Fetching static data from ${bundleUrl}`);
            const response = await fetch(bundleUrl);
            if (response.ok) {
                this.staticData = await response.json();
                console.log('[ApiCallManager] Loaded static data from bundle.json');
                return;
            }
        } catch (e) {
            console.warn('[ApiCallManager] Error loading static bundle:', e);
        }

        // Fallback: empty defaults
        console.warn('[ApiCallManager] No static data source found, using empty defaults');
        this.staticData = {
            parameters: { routes: {} },
            translations: { en: { translations: {} } },
            idevices: { idevices: [] },
            themes: { themes: [] },
        };
    }

    /**
     * Set adapters for the API call manager
     * Used by the hexagonal architecture adapter pattern
     * @param {Object} adapters - Map of adapter instances
     */
    setAdapters(adapters) {
        this.adapters = adapters;
    }

    /**
     * Get an adapter by name
     * @param {string} name - Adapter name
     * @returns {Object|null} The adapter or null
     */
    getAdapter(name) {
        return this.adapters?.[name] || null;
    }

    /**
     * Load symfony api endpoints routes
     *
     */
    async loadApiParameters() {
        // Get locale from config (set by server from user preference)
        const locale = this.app?.eXeLearning?.config?.locale;
        this.parameters = await this.getApiParameters(locale);
        for (var [key, data] of Object.entries(this.parameters.routes)) {
            this.endpoints[key] = {};
            this.endpoints[key].path = this.apiUrlBase + data.path;
            this.endpoints[key].methods = data.methods;
        }
        // Initialize ServerDataProvider now that endpoints are available
        this._initServerDataProvider();
    }

    /**
     * Get API parameters (mode-aware)
     * In static mode, returns data from bundled static data.
     * In server mode, fetches from API endpoint.
     *
     * @returns {Promise<{routes: Object, userPreferencesConfig?: Object, odeProjectSyncPropertiesConfig?: Object}>}
     */
    async getApiParameters(locale) {
        // Check static mode - return bundled data
        if (this._isStaticMode()) {
            return this._getStaticData('parameters') || { routes: {} };
        }

        // Server mode - fetch from API with locale
        let url = this.apiUrlParameters;
        if (locale) {
            url += `?locale=${encodeURIComponent(locale)}`;
        }
        return await this.func.get(url);
    }

    /**
     * Get app changelog text (mode-aware)
     * In static mode, fetches CHANGELOG.md from the static build.
     * In server mode, fetches from the configured changelog URL.
     *
     * @returns {Promise<string>}
     */
    async getChangelogText() {
        // Static mode - fetch CHANGELOG.md using composeUrl for correct base path
        if (this._isStaticMode()) {
            try {
                const response = await fetch(this.app.composeUrl('/CHANGELOG.md'));
                return response.ok ? await response.text() : _('Changelog not available');
            } catch (e) {
                return _('Changelog not available');
            }
        }

        // Server mode - fetch from configured URL
        let url = this.app.eXeLearning.config.changelogURL;
        url += '?version=' + eXeLearning.app.common.getVersionTimeStamp();
        return await this.func.getText(url);
    }

    /**
     * Get upload limits configuration (mode-aware)
     * In static mode, returns sensible defaults (no server-imposed limits).
     * In server mode, fetches from API endpoint.
     *
     * Returns the effective file upload size limit considering both
     * PHP limits and application configuration.
     *
     * @returns {Promise<{maxFileSize: number, maxFileSizeFormatted: string, limitingFactor: string, details?: object}>}
     */
    async getUploadLimits() {
        // Use DataProvider if available
        if (this._dataProvider) {
            if (this._isStaticMode()) {
                return this._dataProvider.getUploadLimits();
            }
            const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/config/upload-limits`;
            return this._dataProvider.getUploadLimits(url);
        }

        // Fallback for initialization phase (before DataProvider is set up)
        if (this._isStaticMode()) {
            return {
                maxFileSize: 100 * 1024 * 1024, // 100MB default
                maxFileSizeFormatted: '100 MB',
                limitingFactor: 'none',
                details: {
                    isStatic: true,
                },
            };
        }

        // Server mode - fetch from API
        const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/config/upload-limits`;
        return await this.func.get(url);
    }

    /**
     * Get the third party code information (mode-aware)
     * In static mode, fetches libs/README.md from the static build.
     * In server mode, fetches from the versioned URL path.
     *
     * @returns {Promise<string>}
     */
    async getThirdPartyCodeText() {
        // Static mode - fetch libs/README.md using composeUrl for correct base path
        if (this._isStaticMode()) {
            try {
                const response = await fetch(this.app.composeUrl('/libs/README.md'));
                return response.ok ? await response.text() : _('Information not available');
            } catch (e) {
                return _('Information not available');
            }
        }

        // Server mode - use basePath + version for proper cache busting
        // URL pattern: {basePath}/{version}/path (e.g., /web/exelearning/v0.0.0-alpha/libs/README.md)
        const version = eXeLearning?.version || 'v1.0.0';
        let url = this.apiUrlBase + this.apiUrlBasePath + '/' + version + '/libs/README.md';
        return await this.func.getText(url);
    }

    /**
     * Get the list of licenses (mode-aware)
     * In static mode, fetches libs/LICENSES.md from the static build.
     * In server mode, fetches from the versioned URL path.
     *
     * @returns {Promise<string>}
     */
    async getLicensesList() {
        // Static mode - fetch libs/LICENSES.md using composeUrl for correct base path
        if (this._isStaticMode()) {
            try {
                const response = await fetch(this.app.composeUrl('/libs/LICENSES.md'));
                return response.ok ? await response.text() : _('Information not available');
            } catch (e) {
                return _('Information not available');
            }
        }

        // Server mode - use basePath + version for proper cache busting
        // URL pattern: {basePath}/{version}/path (e.g., /web/exelearning/v0.0.0-alpha/libs/LICENSES.md)
        const version = eXeLearning?.version || 'v1.0.0';
        let url = this.apiUrlBase + this.apiUrlBasePath + '/' + version + '/libs/LICENSES.md';
        return await this.func.getText(url);
    }

    /**
     * Get idevices installed (mode-aware)
     * Uses DataProvider abstraction for consistent mode handling.
     * In static mode, returns data from bundled static data.
     * In server mode, fetches from API endpoint.
     *
     * @returns {Promise<{idevices: Array}>}
     */
    async getIdevicesInstalled() {
        // Use DataProvider if available
        if (this._dataProvider) {
            return this._dataProvider.getIdevices();
        }

        // Fallback for initialization phase
        if (this._isStaticMode()) {
            return this._getStaticData('idevices') || { idevices: [] };
        }

        // Server mode - fetch from API
        let url = this.endpoints.api_idevices_installed.path;
        return await this.func.get(url);
    }

    /**
     * Get themes installed (mode-aware)
     * Uses DataProvider abstraction for consistent mode handling.
     * In static mode, returns data from bundled static data.
     * In server mode, fetches from API endpoint.
     *
     * @returns {Promise<{themes: Array}>}
     */
    async getThemesInstalled() {
        // Use DataProvider if available
        if (this._dataProvider) {
            return this._dataProvider.getThemes();
        }

        // Fallback for initialization phase
        if (this._isStaticMode()) {
            return this._getStaticData('themes') || { themes: [] };
        }

        // Server mode - fetch from API
        let url = this.endpoints.api_themes_installed.path;
        return await this.func.get(url);
    }

    /**
     * Get user odefiles (projects)
     * Uses NestJS endpoint for Yjs-based projects
     *
     * @returns {Promise<Object>} Response with odeFiles containing odeFilesSync array
     */
    async getUserOdeFiles() {
        // Use NestJS endpoint for Yjs projects
        const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/projects/user/list`;

        // Get auth token from available sources
        const authToken = eXeLearning?.app?.project?._yjsBridge?.authToken ||
                          eXeLearning?.app?.auth?.getToken?.() ||
                          eXeLearning?.config?.token ||
                          localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
            });

            if (!response.ok) {
                console.error('[API] getUserOdeFiles failed:', response.status);
                return { odeFiles: { odeFilesSync: [] } };
            }

            return await response.json();
        } catch (error) {
            console.error('[API] getUserOdeFiles error:', error);
            return { odeFiles: { odeFilesSync: [] } };
        }
    }

    /**
     * Get recent user odefiles (projects)
     * Uses NestJS endpoint for Yjs-based projects
     * Returns the 3 most recently updated projects
     *
     * @returns {Promise<Array>} Array of recent project objects
     */
    async getRecentUserOdeFiles() {
        const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/projects/user/recent`;

        // Get auth token from available sources
        const authToken =
            eXeLearning?.app?.project?._yjsBridge?.authToken ||
            eXeLearning?.app?.auth?.getToken?.() ||
            eXeLearning?.config?.token ||
            localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
            });

            if (!response.ok) {
                console.error('[API] getRecentUserOdeFiles failed:', response.status);
                return [];
            }

            return await response.json();
        } catch (error) {
            console.error('[API] getRecentUserOdeFiles error:', error);
            return [];
        }
    }

    /**
     * Get currentUser odeSessionId
     *
     * @deprecated With Yjs, session ID comes from URL or Yjs document
     * @returns {Object} Stub response with session ID from URL
     */
    async getCurrentUserOdeSessionId() {
        // NOTE: CurrentOdeUsers API has been removed.
        // Session ID is now obtained from URL parameter or Yjs document.
        console.warn('[apiCallManager] getCurrentUserOdeSessionId() is deprecated - use URL param or YjsProjectBridge');

        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('project') || 'default';

        return {
            responseMessage: 'OK',
            odeSessionId: projectId,
        };
    }

    /**
     * Get available templates for a given locale
     *
     * @param {string} locale - The locale code (e.g., 'en', 'es')
     * @returns {Promise<Array>} - Array of template objects
     */
    async getTemplates(locale) {
        let url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/templates?locale=${locale}`;
        return await this.func.get(url);
    }

    /**
     * Post odeSessionId and check availability
     *
     * @param {*} params
     * @returns
     */
    async postJoinCurrentOdeSessionId(params) {
        let url = this.endpoints.check_current_users_ode_session_id.path;
        return await this.func.post(url, params);
    }

    /**
     * Post selected odefile
     *
     * @param {*} odeFileName
     * @returns
     */
    async postSelectedOdeFile(odeFileName) {
        let url = this.endpoints.api_odes_ode_elp_open.path;
        return await this.func.post(url, odeFileName);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalLargeOdeFile(data) {
        let url = this.endpoints.api_odes_ode_local_large_elp_open.path;
        return await this.func.fileSendPost(url, data);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalOdeFile(data) {
        let url = this.endpoints.api_odes_ode_local_elp_open.path;
        return await this.func.post(url, data);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalXmlPropertiesFile(data) {
        let url = this.endpoints.api_odes_ode_local_xml_properties_open.path;
        return await this.func.post(url, data);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postImportElpToRoot(data) {
        let url = this.endpoints.api_odes_ode_local_elp_import_root.path;
        return await this.func.fileSendPost(url, data);
    }

    /**
     * Import a previously uploaded file into the root by server local path.
     * Payload: { odeSessionId, odeFileName, odeFilePath }
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async postImportElpToRootFromLocal(payload = {}) {
        let url =
            this.endpoints.api_odes_ode_local_elp_import_root_from_local?.path;
        if (!url) {
            // Fallback if route not yet defined
            url =
                this.apiUrlBase +
                this.apiUrlBasePath +
                '/api/ode-management/odes/ode/import/local/root';
        }
        return await this.func.post(url, payload);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalOdeComponents(data) {
        let url = this.endpoints.api_odes_ode_local_idevices_open.path;
        return await this.func.post(url, data);
    }

    /**
     * @param {*} data
     * @returns
     *
     */
    async postMultipleLocalOdeFiles(data) {
        let url = this.endpoints.api_odes_ode_multiple_local_elp_open.path;
        return await this.func.post(url, data);
    }

    /**
     *
     * @param {String} navId
     * @param {Object} payload
     * @returns
     */
    async postImportElpAsChildFromLocal(navId, payload = {}) {
        let url = this.endpoints.api_nav_structures_import_elp_child?.path;
        if (!url) {
            url =
                this.apiUrlBase +
                this.apiUrlBasePath +
                '/api/nav-structure-management/nav-structures/{odeNavStructureSyncId}/import-elp';
        }
        url = url.replace('{odeNavStructureSyncId}', navId);
        return await this.func.post(url, payload);
    }

    // Backwards compatibility wrapper
    async postImportElpAsChild(navId, payload = {}) {
        return await this.postImportElpAsChildFromLocal(navId, payload);
    }

    /**
     * Post ode file to remove
     *
     * @param {*} odeFileId
     * @returns
     */
    async postDeleteOdeFile(odeFileId) {
        let url = this.endpoints.api_odes_remove_ode_file.path;
        return await this.func.post(url, odeFileId);
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postDeleteOdeFilesByDate(params) {
        let url = this.endpoints.api_odes_remove_date_ode_files.path;
        return await this.func.post(url, params);
    }

    /**
     * Post to check number of current ode users
     *
     * @param {*} params
     * @returns
     *
     */
    async postCheckCurrentOdeUsers(params) {
        let url = this.endpoints.api_odes_check_before_leave_ode_session.path;
        return await this.func.post(url, params);
    }

    /**
     * clean autosaves
     *
     * @param {*} params
     * @returns
     *
     */
    async postCleanAutosavesByUser(params) {
        let url = this.endpoints.api_odes_clean_init_autosave_elp.path;
        return await this.func.post(url, params);
    }

    /**
     * Post session to close
     *
     * @param {*} params
     * @returns
     *
     */
    async postCloseSession(params) {
        let url = this.endpoints.api_odes_ode_session_close.path;
        return await this.func.post(url, params);
    }

    /**
     * Import theme
     *
     * @param {*} params
     * @returns
     */
    async postUploadTheme(params) {
        let url = this.endpoints.api_themes_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Import theme from ELP file
     *
     * Uploads a packaged theme ZIP to the server for installation.
     * The caller must package the theme files before calling this method.
     *
     * @param {Object} params
     * @param {string} params.themeDirname - Directory name of the theme
     * @param {Blob|File} params.themeZip - Packaged theme ZIP file (required)
     * @returns {Promise<Object>} Response with updated theme list
     */
    async postOdeImportTheme(params) {
        const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/themes/import`;

        // Theme ZIP is required - callers must package theme before calling
        if (!params.themeZip) {
            console.error('[API] postOdeImportTheme: themeZip parameter is required');
            return {
                responseMessage: 'ERROR',
                error: 'Theme import requires the theme files. Please package the theme before calling this method.',
            };
        }

        if (!params.themeDirname) {
            console.error('[API] postOdeImportTheme: themeDirname parameter is required');
            return {
                responseMessage: 'ERROR',
                error: 'Theme directory name is required.',
            };
        }

        // Get auth token
        const authToken =
            eXeLearning?.app?.project?._yjsBridge?.authToken ||
            eXeLearning?.app?.auth?.getToken?.() ||
            eXeLearning?.config?.token ||
            localStorage.getItem('authToken');

        // Create FormData
        const formData = new FormData();
        formData.append('themeDirname', params.themeDirname);
        formData.append('themeZip', params.themeZip, `${params.themeDirname}.zip`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    responseMessage: 'ERROR',
                    error: errorData.error || `HTTP ${response.status}`,
                };
            }

            return await response.json();
        } catch (error) {
            console.error('[API] postOdeImportTheme error:', error);
            return { responseMessage: 'ERROR', error: error.message };
        }
    }

    /**
     * Delete style
     *
     * @param {*} params
     * @returns
     */
    async deleteTheme(params) {
        let url = this.endpoints.api_themes_installed_delete.path;
        return await this.func.delete(url, params);
    }

    /**
     * Get installed theme zip
     *
     * @param {string} themeId - The theme directory name
     * @returns {Promise<{zipFileName: string, zipBase64: string}>}
     */
    async getThemeZip(themeId) {
        let url = this.endpoints.api_themes_download.path;
        url = url.replace('{themeId}', themeId);
        return await this.func.get(url);
    }

    /**
     *
     * @param {*} themeConfig
     * @param {*} themeRules
     */
    async postNewTheme(params) {
        let url = this.endpoints.api_themes_new.path;
        return await this.func.post(url, params);
    }

    /**
     *
     * @param {*} themeDir
     * @param {*} themeConfig
     * @param {*} themeRules
     */
    async putEditTheme(themeDir, params) {
        let url = this.endpoints.api_themes_edit.path;
        url = url.replace('{themeId}', themeDir);
        return await this.func.put(url, params);
    }

    /**
     * Import idevice
     *
     * @param {*} params
     * @returns
     */
    async postUploadIdevice(params) {
        let url = this.endpoints.api_idevices_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete idevice installed
     *
     * @param {*} params
     * @returns
     */
    async deleteIdeviceInstalled(params) {
        let url = this.endpoints.api_idevices_installed_delete.path;
        return await this.func.delete(url, params);
    }

    /**
     * Get installed idevice zip
     *
     * @param {*} odeSessionId
     * @param {*} $ideviceDirName
     * @returns
     */
    async getIdeviceInstalledZip(odeSessionId, ideviceDirName) {
        let url = this.endpoints.api_idevices_installed_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{ideviceDirName}', ideviceDirName);
        return await this.func.get(url);
    }

    /**
     * Accept LOPD
     *
     * @returns
     */
    async postUserSetLopdAccepted() {
        let url = this.endpoints.api_user_set_lopd_accepted.path;
        return await this.func.post(url);
    }

    /**
     * Get user preferences
     *
     * @returns
     */
    async getUserPreferences() {
        let url = this.endpoints.api_user_preferences_get.path;
        return await this.func.get(url);
    }

    /**
     * Save user preferences
     *
     * @param {*} params
     * @returns
     */
    async putSaveUserPreferences(params) {
        let url = this.endpoints.api_user_preferences_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Get ode last update
     *
     * @param {*} odeId
     * @returns
     */
    async getOdeLastUpdated(odeId) {
        let url = this.endpoints.api_odes_last_updated.path;
        url = url.replace('{odeId}', odeId);
        return await this.func.get(url);
    }

    /**
     * get ode concurrent users
     *
     * @param {*} odeId
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeConcurrentUsers(odeId, versionId, sessionId) {
        let url = this.endpoints.api_odes_current_users.path;
        url = url.replace('{odeId}', odeId);
        url = url.replace('{odeVersionId}', versionId);
        url = url.replace('{odeSessionId}', sessionId);
        return await this.func.get(url, null, false);
    }

    /**
     * get ode structure
     *
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeStructure(versionId, sessionId) {
        let url = this.endpoints.api_nav_structures_nav_structure_get.path;
        url = url.replace('{odeVersionId}', versionId);
        url = url.replace('{odeSessionId}', sessionId);
        return await this.func.get(url);
    }

    /**
     * Get ode broken links
     *
     * @param {*} params
     * @returns
     */
    async getOdeSessionBrokenLinks(params) {
        let url = this.endpoints.api_odes_session_get_broken_links.path;
        return await this.func.postJson(url, params);
    }

    /**
     * Extract links from idevices for validation (fast, no validation)
     *
     * @param {Object} params - { odeSessionId, idevices }
     * @returns {Promise<Object>} - { responseMessage, links, totalLinks }
     */
    async extractLinksForValidation(params) {
        // Use adapter if available (supports static mode)
        const adapter = this.getAdapter('linkValidation');
        if (adapter) {
            return adapter.extractLinks(params);
        }
        // Fallback to direct API call (server mode)
        const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/ode-management/odes/session/brokenlinks/extract`;
        return await this.func.postJson(url, params);
    }

    /**
     * Get the URL for the link validation stream endpoint
     *
     * @returns {string|null}
     */
    getLinkValidationStreamUrl() {
        // Use adapter if available (supports static mode)
        const adapter = this.getAdapter('linkValidation');
        if (adapter) {
            return adapter.getValidationStreamUrl();
        }
        // Fallback to direct URL (server mode)
        return `${this.apiUrlBase}${this.apiUrlBasePath}/api/ode-management/odes/session/brokenlinks/validate-stream`;
    }

    /**
     * Get page broken links
     *
     * @param {*} pageId
     * @returns
     */
    async getOdePageBrokenLinks(pageId) {
        let url = this.endpoints.api_odes_pag_get_broken_links.path;
        url = url.replace('{odePageId}', pageId);
        return await this.func.get(url);
    }

    /**
     * Get block broken links
     *
     * @param {*} BlockId
     * @returns
     */
    async getOdeBlockBrokenLinks(blockId) {
        let url = this.endpoints.api_odes_block_get_broken_links.path;
        url = url.replace('{odeBlockId}', blockId);
        return await this.func.get(url);
    }

    /**
     * Get idevice broken links
     *
     * @param {*} IdeviceId
     * @returns
     */
    async getOdeIdeviceBrokenLinks(ideviceId) {
        let url = this.endpoints.api_odes_idevice_get_broken_links.path;
        url = url.replace('{odeIdeviceId}', ideviceId);
        return await this.func.get(url);
    }

    /**
     *
     * @param {*} odeSessionId
     * @returns
     */
    async getOdeProperties(odeSessionId) {
        let url = this.endpoints.api_odes_properties_get.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        return await this.func.get(url);
    }

    /**
     *
     * @param {*} odeId
     * @returns
     */
    async putSaveOdeProperties(params) {
        let url = this.endpoints.api_odes_properties_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Get ode used files
     * In static mode, extracts from Yjs document
     *
     * @param {*} params
     * @returns
     */
    async getOdeSessionUsedFiles(params) {
        // Use Yjs-based implementation in static mode
        const isStaticMode = this.app?.capabilities?.storage?.remote === false;
        if (isStaticMode) {
            return this._getUsedFilesFromYjs();
        }
        // Server mode: use API
        let url = this.endpoints.api_odes_session_get_used_files.path;
        return await this.func.postJson(url, params);
    }

    /**
     * Extract used files from Yjs document by scanning all content.
     * @private
     * @returns {Promise<{responseMessage: string, usedFiles: Array}>}
     */
    async _getUsedFilesFromYjs() {
        const projectManager = this.app?.project;
        const bridge = projectManager?._yjsBridge;
        const structureBinding = bridge?.structureBinding;
        const assetManager = bridge?.assetManager;

        if (!structureBinding) {
            console.warn('[apiCallManager] _getUsedFilesFromYjs: No structureBinding available');
            return { responseMessage: 'OK', usedFiles: [] };
        }

        const usedFiles = [];
        const seenAssets = new Set();
        const assetUsageMap = new Map();
        const assetRegex = /asset:\/\/([a-f0-9-]+)/gi;

        // Scan all content to find where each asset is used
        const pages = structureBinding.getPages() || [];

        for (const page of pages) {
            const pageId = page.id;
            const pageName = page.pageName || 'Page';
            const blocks = structureBinding.getBlocks(pageId) || [];

            for (const block of blocks) {
                const blockName = block.blockName || '';
                const components = structureBinding.getComponents(pageId, block.id) || [];

                for (const component of components) {
                    const ideviceType = component.ideviceType || '';
                    const order = component.order || 0;

                    let rawHtmlContent = '';
                    let rawJsonProperties = '';

                    if (component._ymap) {
                        const rawHtml = component._ymap.get('htmlContent');
                        if (rawHtml && typeof rawHtml.toString === 'function') {
                            rawHtmlContent = rawHtml.toString();
                        } else if (typeof rawHtml === 'string') {
                            rawHtmlContent = rawHtml;
                        }
                        if (!rawHtmlContent) {
                            const htmlView = component._ymap.get('htmlView');
                            if (typeof htmlView === 'string') {
                                rawHtmlContent = htmlView;
                            }
                        }
                        const jsonProps = component._ymap.get('jsonProperties');
                        if (typeof jsonProps === 'string') {
                            rawJsonProperties = jsonProps;
                        }
                    }

                    const contentToScan = rawHtmlContent + ' ' + rawJsonProperties;

                    let match;
                    while ((match = assetRegex.exec(contentToScan)) !== null) {
                        const assetId = match[1];
                        if (!assetUsageMap.has(assetId)) {
                            assetUsageMap.set(assetId, {
                                pageName,
                                blockName,
                                ideviceType: ideviceType.replace('Idevice', ''),
                                order,
                            });
                        }
                    }
                    assetRegex.lastIndex = 0;
                }
            }
        }

        // Get all assets from AssetManager
        if (assetManager) {
            try {
                const allAssets = assetManager.getAllAssetsMetadata?.() || [];

                for (const asset of allAssets) {
                    const assetId = asset.id || asset.uuid;
                    if (!assetId) continue;

                    const assetUrl = `asset://${assetId}`;
                    if (seenAssets.has(assetUrl)) continue;
                    seenAssets.add(assetUrl);

                    const fileName = asset.name || asset.filename || assetId.substring(0, 8) + '...';
                    const fileSize = asset.size ? this._formatFileSize(asset.size) : '';
                    const usage = assetUsageMap.get(assetId);

                    usedFiles.push({
                        usedFiles: fileName,
                        usedFilesPath: assetUrl,
                        usedFilesSize: fileSize,
                        pageNamesUsedFiles: usage?.pageName || '-',
                        blockNamesUsedFiles: usage?.blockName || '-',
                        typeComponentSyncUsedFiles: usage?.ideviceType || '-',
                        orderComponentSyncUsedFiles: usage?.order || 0,
                    });
                }
            } catch (e) {
                console.debug('[apiCallManager] Could not get assets from AssetManager:', e);
            }
        }

        return { responseMessage: 'OK', usedFiles };
    }

    /**
     * Format file size in human-readable format.
     * @private
     */
    _formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        let unitIndex = 0;
        let size = bytes;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Download ode
     *
     * @param {*} params
     * @returns
     */
    async getOdeDownload(odeSessionId) {
        return await this.getOdeExportDownload(
            odeSessionId,
            eXeLearning.extension
        );
    }

    /**
     * Download ode export
     *
     * @param {*} params
     * @returns
     */
    async getOdeExportDownload(odeSessionId, exportType) {
        let url = this.endpoints.api_ode_export_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{exportType}', exportType);

        // Check if this is a Yjs session - send structure via POST
        if (odeSessionId && odeSessionId.startsWith('yjs-')) {
            const structure = this.buildStructureFromYjs();
            if (structure) {
                return await this.func.post(url, { structure });
            }
        }

        return await this.func.get(url);
    }


    /**
     * Download ode page export
     *
     * @param {string} odeSessionId
     * @param {string} pageId
     * @returns
     */
    async getOdePageExportDownload(odeSessionId, pageId) {
        let url = this.endpoints.api_ode_export_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{exportType}', 'elpx-page');

        const structure = this.buildStructureFromYjs();
        const payload = {
            rootPageId: pageId
        };
        
        if (structure) {
            payload.structure = structure;
        }

        const authToken = eXeLearning?.app?.project?._yjsBridge?.authToken ||
                          eXeLearning?.app?.auth?.getToken?.() ||
                          eXeLearning?.config?.token ||
                          localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                 const errText = await response.text();
                 try {
                     const errJson = JSON.parse(errText);
                     throw new Error(errJson.error || response.statusText);
                 } catch (e) {
                     throw new Error(errText || response.statusText);
                 }
            }
            
            return await response.blob();
        } catch (error) {
            console.error('[ApiCallManager] getOdePageExportDownload error:', error);
            throw error;
        }
    }

    /**
     * Build ParsedOdeStructure from Yjs document for export
     * @returns {Object|null} Structure object or null if Yjs not available
     */
    buildStructureFromYjs() {
        try {
            const project = this.app?.project;
            const bridge = project?._yjsBridge;
            const manager = bridge?.getDocumentManager?.();

            if (!manager) {
                console.warn('[ApiCallManager] Yjs document manager not available');
                return null;
            }

            const metadata = manager.getMetadata();
            const navigation = manager.getNavigation();

            // Build structure matching ParsedOdeStructure format
            const structure = {
                meta: {
                    title: metadata?.get('title') || 'Untitled',
                    author: metadata?.get('author') || '',
                    language: metadata?.get('language') || 'en',
                    description: metadata?.get('description') || '',
                    license: metadata?.get('license') || '',
                    theme: metadata?.get('theme') || 'base',
                },
                pages: [],
                navigation: [],
            };

            // Build pages and navigation from Yjs navigation array
            for (let i = 0; i < navigation.length; i++) {
                const pageMap = navigation.get(i);
                if (!pageMap) continue;

                const pageId = pageMap.get('id') || pageMap.get('pageId');
                const pageName = pageMap.get('pageName') || 'Page';
                const parentId = pageMap.get('parentId') || null;

                // Navigation entry
                structure.navigation.push({
                    id: pageId,
                    navText: pageName,
                    parentId: parentId,
                });

                // Page entry with blocks
                const page = {
                    id: pageId,
                    pageName: pageName,
                    parentId: parentId,
                    blocks: [],
                };

                // Get blocks for this page
                const blocks = pageMap.get('blocks');
                if (blocks) {
                    for (let j = 0; j < blocks.length; j++) {
                        const blockMap = blocks.get(j);
                        if (!blockMap) continue;

                        const block = {
                            id: blockMap.get('id') || blockMap.get('blockId'),
                            blockName: blockMap.get('blockName') || '',
                            iconName: blockMap.get('iconName') || '',
                            components: [],
                        };

                        // Extract block properties
                        const blockPropsMap = blockMap.get('properties');
                        if (blockPropsMap && typeof blockPropsMap.toJSON === 'function') {
                            block.properties = blockPropsMap.toJSON();
                        }

                        // Get components (iDevices)
                        const components = blockMap.get('components');
                        if (components) {
                            for (let k = 0; k < components.length; k++) {
                                const compMap = components.get(k);
                                if (!compMap) continue;

                                const compId = compMap.get('id') || compMap.get('ideviceId');
                                const type = compMap.get('ideviceType') || compMap.get('type');

                                // Get content from various possible keys
                                let htmlContent = 
                                    compMap.get('htmlContent') || 
                                    compMap.get('content') || 
                                    compMap.get('htmlView') || 
                                    '';
                                
                                // Handle Y.Text objects
                                if (htmlContent && typeof htmlContent.toString === 'function') {
                                    htmlContent = htmlContent.toString();
                                }

                                const component = {
                                    id: compId,
                                    ideviceType: type,
                                    htmlContent: htmlContent || '',
                                };

                                // Get properties if available
                                const propsMap = compMap.get('properties');
                                if (propsMap && typeof propsMap.toJSON === 'function') {
                                    component.properties = propsMap.toJSON();
                                }

                                // Get jsonProperties (content data) if available
                                // This is CRITICAL for JSON-based iDevices (TrueFalse, Form, etc.)
                                const jsonProps = compMap.get('jsonProperties');
                                if (jsonProps) {
                                    try {
                                        const parsed = typeof jsonProps === 'string' ? JSON.parse(jsonProps) : jsonProps;
                                        // Merge into properties, prioritizing content data
                                        component.properties = { ...(component.properties || {}), ...parsed };
                                    } catch (e) {
                                        console.warn('[ApiCallManager] Failed to parse jsonProperties for export:', e);
                                    }
                                }

                                block.components.push(component);
                            }
                        }

                        page.blocks.push(block);
                    }
                }

                structure.pages.push(page);
            }

            return structure;
        } catch (error) {
            console.error('[ApiCallManager] Failed to build structure from Yjs:', error);
            return null;
        }
    }

    /**
     * download idevice/block content
     *
     * @param {*} params
     * @returns
     */
    async getOdeIdevicesDownload(odeSessionId, odeBlockId, odeIdeviceId) {
        let downloadResponse = [];
        let url = this.endpoints.api_idevices_download_ode_components.path;

        downloadResponse['url'] = url.replace('{odeSessionId}', odeSessionId);
        downloadResponse['url'] = downloadResponse['url'].replace(
            '{odeBlockId}',
            odeBlockId
        );
        downloadResponse['url'] = downloadResponse['url'].replace(
            '{odeIdeviceId}',
            odeIdeviceId
        );
        downloadResponse['response'] = await this.func.getText(
            downloadResponse['url']
        );

        return downloadResponse;
    }

    /**
     * Force to download file resources (case xml)
     * Only gets url
     *
     * @param {*} resource
     * @returns
     */
    async getFileResourcesForceDownload(resource) {
        let downloadResponse = [];
        let url =
            this.endpoints.api_idevices_force_download_file_resources.path;
        downloadResponse['url'] = url + '?resource=' + resource;
        return downloadResponse;
    }

    /**
     * Save ode
     *
     * @param {*} params
     * @returns
     */
    async postOdeSave(params) {
        let url = this.endpoints.api_odes_ode_save_manual.path;
        return await this.func.post(url, params);
    }

    /**
     * Autosave ode
     *
     * @param {*} params
     * @returns
     */
    async postOdeAutosave(params) {
        let url = this.endpoints.api_odes_ode_save_auto.path;
        this.func.post(url, params);
    }

    /**
     * Save as ode
     *
     * @param {*} params
     * @returns
     */
    async postOdeSaveAs(params) {
        let url = this.endpoints.api_odes_ode_save_as.path;
        return await this.func.post(url, params);
    }

    /**
     * Upload new elp to first type platform
     *
     * @param {*} params
     * @returns
     */
    async postFirstTypePlatformIntegrationElpUpload(params) {
        let url = this.endpoints.set_platform_new_ode.path;
        return await this.func.post(url, params);
    }

    /**
     * Open elp from platform
     *
     * @param {*} params
     * @returns
     */
    async platformIntegrationOpenElp(params) {
        let url = this.endpoints.open_platform_elp.path;
        return await this.func.post(url, params);
    }

    /**
     * @deprecated - Removed: Yjs handles real-time sync automatically
     * @param {*} params
     * @returns {Object} Stub response for backward compatibility
     */
    async postCheckUserOdeUpdates(params) {
        // NOTE: CurrentOdeUsers sync API has been removed.
        // Yjs provides real-time synchronization automatically.
        return {
            responseMessage: 'OK',
            hasUpdates: false,
            syncNavStructureFlag: false,
            syncPagStructureFlag: false,
            syncComponentsFlag: false,
        };
    }

    /**
     * @deprecated - Removed: Yjs awareness handles user presence on pages
     * @param {*} params
     * @returns {Object} Stub response for backward compatibility
     */
    async postCheckUsersOdePage(params) {
        // NOTE: CurrentOdeUsers API has been removed.
        // Use Yjs awareness for user presence tracking.
        console.warn('[apiCallManager] postCheckUsersOdePage() is deprecated - use Yjs awareness instead');
        return {
            responseMessage: 'OK',
            usersOnPage: [],
        };
    }

    /**
     * @deprecated - Removed: Yjs handles synchronization
     */
    async postActivateCurrentOdeUsersUpdateFlag(params) {
        return { responseMessage: 'OK' };
    }

    /**
     * @deprecated - Removed: Yjs handles synchronization
     */
    async checkCurrentOdeUsersComponentFlag(params) {
        return { responseMessage: 'OK', isAvailable: true };
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postObtainOdeBlockSync(params) {
        let url = this.endpoints.get_current_block_update.path;
        return await this.func.post(url, params);
    }

    /**
     * Get all translations
     *
     * @param {*} locale
     * @returns
     */
    async getTranslationsAll() {
        let url = this.endpoints.api_translations_lists.path;
        return await this.func.get(url);
    }

    /**
     * Get translations (mode-aware)
     * Uses DataProvider abstraction for consistent mode handling.
     * In static mode, returns data from bundled static data.
     * In server mode, fetches from API endpoint.
     *
     * @param {string} locale - Language code (e.g., 'en', 'es')
     * @returns {Promise<{translations: Object}>}
     */
    async getTranslations(locale) {
        const safeLocale = locale || 'en';

        // Use DataProvider if available
        if (this._dataProvider) {
            return this._dataProvider.getTranslations(safeLocale);
        }

        // Fallback for initialization phase
        if (this._isStaticMode()) {
            return this._getStaticTranslations(safeLocale);
        }

        // Server mode - fetch from API
        let url = this.endpoints.api_translations_list_by_locale.path;
        url = url.replace('{locale}', safeLocale);
        return await this.func.get(url);
    }

    /**
     * Get login url of Google Drive
     *
     * @returns
     */
    async getUrlLoginGoogleDrive() {
        let url = this.endpoints.api_google_oauth_login_url_get.path;
        return await this.func.get(url);
    }

    /**
     * Get folders of Google Drive account
     *
     * @returns
     */
    async getFoldersGoogleDrive() {
        let url = this.endpoints.api_google_drive_folders_list.path;
        return await this.func.get(url);
    }

    /**
     * Upload file to Google Drive
     *
     * @param {*} params
     * @returns
     */
    async uploadFileGoogleDrive(params) {
        let url = this.endpoints.api_google_drive_file_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Get login url of Dropbox
     *
     * @returns
     */
    async getUrlLoginDropbox() {
        let url = this.endpoints.api_dropbox_oauth_login_url_get.path;
        return await this.func.get(url);
    }

    /**
     * Get folders of Dropbox account
     *
     * @returns
     */
    async getFoldersDropbox() {
        let url = this.endpoints.api_dropbox_folders_list.path;
        return await this.func.get(url);
    }

    /**
     * Upload file to Dropbox
     *
     * @param {*} params
     * @returns
     */
    async uploadFileDropbox(params) {
        let url = this.endpoints.api_dropbox_file_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Get page components
     *
     * @param {*} odeNavStructureSyncId
     * @returns
     */
    async getComponentsByPage(odeNavStructureSyncId) {
        // Collaborative Init
        const existingOverlay = document.querySelector('.user-editing-overlay');

        if (existingOverlay) {
            // Search elements with classes to remove
            const elementsWithEditingClass = document.querySelectorAll(
                '.editing-article, .article-disabled'
            );

            elementsWithEditingClass.forEach((element) => {
                element.classList.remove('editing-article', 'article-disabled');
            });

            existingOverlay.remove();
        }
        // Collaborative End

        // Check if Yjs mode is active and we should load from Yjs
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            console.log('[apiCallManager] getComponentsByPage: Loading from Yjs for page', odeNavStructureSyncId);
            return this._getComponentsByPageFromYjs(odeNavStructureSyncId);
        }

        let url = this.endpoints.api_idevices_list_by_page.path;
        url = url.replace('{odeNavStructureSyncId}', odeNavStructureSyncId);
        return await this.func.get(url);
    }

    /**
     * Get page components from Yjs document (when Yjs mode is active)
     * Returns data in Symfony-compatible format expected by idevicesEngine.js
     *
     * @param {string} pageId - Page ID (Yjs UUID or "root")
     * @returns {Object} Page structure with blocks and components
     */
    _getComponentsByPageFromYjs(pageId) {
        const projectManager = eXeLearning?.app?.project;
        const bridge = projectManager?._yjsBridge;
        const structureBinding = bridge?.structureBinding;

        if (!structureBinding) {
            console.warn('[apiCallManager] _getComponentsByPageFromYjs: No structureBinding available');
            return { responseMessage: 'ERROR', error: 'Yjs not initialized' };
        }

        // Handle "root" as special case - get the first page
        let actualPageId = pageId;
        if (pageId === 'root') {
            const pages = structureBinding.getPages();
            if (pages && pages.length > 0) {
                actualPageId = pages[0].id;
                console.log('[apiCallManager] _getComponentsByPageFromYjs: "root" resolved to first page:', actualPageId);
            } else {
                // No pages exist yet, return empty structure
                return {
                    id: 'root',
                    odePageId: 'root',
                    pageName: 'Root',
                    odePagStructureSyncs: []
                };
            }
        }

        // Get page from Yjs
        const pageMap = structureBinding.getPageMap(actualPageId);
        if (!pageMap) {
            // Page not found, return empty structure
            console.warn('[apiCallManager] _getComponentsByPageFromYjs: Page not found:', pageId);
            return {
                id: pageId,
                odePageId: pageId,
                pageName: 'Page',
                odePagStructureSyncs: []
            };
        }

        // Build Symfony-compatible response structure
        const blocks = structureBinding.getBlocks(actualPageId);
        const odePagStructureSyncs = blocks.map(block => {
            const components = structureBinding.getComponents(actualPageId, block.id);

            // Convert properties Y.Map to plain object, or use defaults
            let blockProperties = block.properties;
            if (blockProperties && typeof blockProperties.toJSON === 'function') {
                blockProperties = blockProperties.toJSON();
            } else if (!blockProperties || typeof blockProperties !== 'object') {
                blockProperties = {};
            }

            // Build odePagStructureSyncProperties object with {value} structure (expected by setProperties)
            // Convert booleans to strings since YjsStructureBinding stores checkboxes as booleans
            // but modalProperties.js compares with string 'true'/'false'
            const odePagStructureSyncProperties = {};
            Object.entries(blockProperties).forEach(([key, value]) => {
                const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
                odePagStructureSyncProperties[key] = { value: stringValue };
            });

            return {
                id: block.id,
                blockId: block.id,  // Pass blockId for blockNode constructor
                odePagId: block.blockId,
                blockName: block.blockName || '',
                iconName: block.iconName || '',
                order: block.order,
                odeNavStructureSyncId: pageId,
                odeComponentsSyncs: components.map(comp => {
                    let htmlView = comp.htmlContent || '';
                    console.debug(`[apiCallManager] _getComponentsByPageFromYjs: Component ${comp.id} htmlView length: ${htmlView.length}`);

                    // Resolve asset:// URLs to blob:// URLs for display
                    // This ensures assets are immediately visible after import
                    const assetManager = bridge?.assetManager;
                    if (assetManager && htmlView.includes('asset://')) {
                        htmlView = assetManager.resolveHTMLAssetsSync(htmlView, {
                            usePlaceholder: true,
                            addTracking: true
                        });
                    }

                    // Build odeComponentsSyncProperties from Yjs component properties
                    // Convert booleans to strings since ideviceNode.setProperties compares with string 'true'/'false'
                    const compProperties = comp.properties || {};
                    const odeComponentsSyncProperties = {};
                    Object.entries(compProperties).forEach(([key, value]) => {
                        const stringValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
                        odeComponentsSyncProperties[key] = { value: stringValue };
                    });

                    return {
                        id: comp.id,
                        odeId: comp.id,
                        odeIdeviceId: comp.id,
                        ideviceType: comp.ideviceType,
                        // Use the idevice type as the odeIdeviceTypeName for proper lookup
                        odeIdeviceTypeName: comp.ideviceType,
                        ideviceName: comp.ideviceType?.replace('Idevice', '') || 'FreeText',
                        order: comp.order,
                        htmlView: htmlView,
                        htmlViewName: htmlView,
                        jsonProperties: comp.jsonProperties || '{}',
                        odePagStructureSyncId: block.id,
                        odeComponentsSyncProperties: odeComponentsSyncProperties,
                        // Mark as coming from Yjs to prevent re-sync
                        fromYjs: true,
                        yjsComponentId: comp.id
                    };
                }),
                odePagStructureSyncProperties: odePagStructureSyncProperties
            };
        });

        return {
            id: pageId,
            odePageId: pageMap.get('id') || pageId,
            pageName: pageMap.get('pageName') || 'Page',
            order: pageMap.get('order') || 0,
            odePagStructureSyncs
        };
    }

    /**
     * Get html template of idevice
     *
     * @param {*} odeNavStructureSyncId
     * @returns
     */
    async getComponentHtmlTemplate(odeNavStructureSyncId) {
        let url = this.endpoints.api_idevices_html_template_get.path;
        url = url.replace('{odeComponentsSyncId}', odeNavStructureSyncId);
        return await this.func.get(url);
    }

    /**
     * Get idevice html saved
     *
     * @param {*} params
     * @returns
     */
    async getSaveHtmlView(odeComponentsSyncId) {
        let url = this.endpoints.api_idevices_html_view_get.path;
        url.replace('{odeComponentsSyncId}', odeComponentsSyncId);
        return await this.func.get(url);
    }

    /**
     * Set idevice html saved
     *
     * @param {*} params
     * @returns
     */
    async putSaveHtmlView(params) {
        // Check if Yjs mode is active - save to Yjs instead of API
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            console.log('[apiCallManager] putSaveHtmlView: Saving to Yjs', params);
            const componentId = params.odeComponentsSyncId || params.id;
            if (componentId && params.htmlView !== undefined) {
                try {
                    // CRITICAL: Convert blob URLs to asset URLs before saving
                    // blob:// URLs are ephemeral and don't persist across page reloads
                    // asset:// URLs are persistent and resolved to blob:// on load
                    const assetManager = projectManager._yjsBridge?.assetManager;
                    let htmlContent = params.htmlView;
                    if (assetManager && htmlContent && typeof htmlContent === 'string') {
                        const hasBlobUrls = htmlContent.includes('blob:');
                        const converted = assetManager.convertBlobURLsToAssetRefs(htmlContent);
                        if (converted !== htmlContent) {
                            console.log('[apiCallManager] ✅ Converted blob URLs to asset URLs');
                            console.log('[apiCallManager] BEFORE:', htmlContent.substring(0, 200));
                            console.log('[apiCallManager] AFTER:', converted.substring(0, 200));
                        } else if (hasBlobUrls) {
                            console.warn('[apiCallManager] ⚠️ HTML had blob: URLs but conversion returned unchanged!');
                            console.warn('[apiCallManager] HTML preview:', htmlContent.substring(0, 300));
                        }
                        htmlContent = converted;
                    }

                    projectManager._yjsBridge.structureBinding.updateComponent(componentId, {
                        htmlContent: htmlContent
                    });
                    console.log('[apiCallManager] Saved htmlView to Yjs:', componentId);
                } catch (e) {
                    console.error('[apiCallManager] Error saving htmlView to Yjs:', e);
                }
            }
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_idevices_html_view_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save idevice
     *
     * @param {*} params
     * @returns
     */
    async putSaveIdevice(params) {
        // Check if Yjs mode is active - save to Yjs instead of API
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            return this._saveIdeviceToYjs(params);
        }

        let url = this.endpoints.api_idevices_idevice_data_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save iDevice data to Yjs document (when Yjs mode is active)
     *
     * @param {Object} params - iDevice parameters
     * @returns {Object} Response with OK status
     */
    _saveIdeviceToYjs(params) {
        const projectManager = eXeLearning?.app?.project;
        const bridge = projectManager?._yjsBridge;
        const structureBinding = bridge?.structureBinding;

        if (!structureBinding) {
            console.warn('[apiCallManager] _saveIdeviceToYjs: No structureBinding available');
            return { responseMessage: 'ERROR', error: 'Yjs not initialized' };
        }

        // Helper to convert blob URLs to asset URLs before saving
        const convertHtmlContent = (html) => {
            if (!html || typeof html !== 'string') return html;
            const assetManager = bridge?.assetManager;
            if (assetManager?.convertBlobURLsToAssetRefs) {
                const hasBlobUrls = html.includes('blob:');
                const converted = assetManager.convertBlobURLsToAssetRefs(html);
                if (converted !== html) {
                    console.log('[apiCallManager] _saveIdeviceToYjs: ✅ Converted blob URLs to asset URLs');
                    console.log('[apiCallManager] _saveIdeviceToYjs BEFORE:', html.substring(0, 200));
                    console.log('[apiCallManager] _saveIdeviceToYjs AFTER:', converted.substring(0, 200));
                } else if (hasBlobUrls) {
                    console.warn('[apiCallManager] _saveIdeviceToYjs: ⚠️ HTML had blob: URLs but conversion returned unchanged!');
                    console.warn('[apiCallManager] _saveIdeviceToYjs HTML:', html.substring(0, 300));
                }
                return converted;
            }
            return html;
        };

        // Helper to convert blob URLs inside jsonProperties (for JSON-type iDevices like text)
        // The jsonProperties contains fields like textTextarea which store the actual content
        const convertJsonProperties = (jsonPropsStr) => {
            if (!jsonPropsStr || typeof jsonPropsStr !== 'string') return jsonPropsStr;
            if (!jsonPropsStr.includes('blob:')) return jsonPropsStr; // Skip if no blob URLs

            try {
                const props = JSON.parse(jsonPropsStr);
                let converted = false;

                // Convert blob URLs in all string values
                for (const key of Object.keys(props)) {
                    const value = props[key];
                    if (typeof value === 'string' && value.includes('blob:')) {
                        const newValue = convertHtmlContent(value);
                        if (newValue !== value) {
                            props[key] = newValue;
                            converted = true;
                            console.log(`[apiCallManager] _saveIdeviceToYjs: ✅ Converted blob URLs in jsonProperties.${key}`);
                        }
                    }
                }

                if (converted) {
                    return JSON.stringify(props);
                }
            } catch (e) {
                console.warn('[apiCallManager] _saveIdeviceToYjs: Failed to parse jsonProperties:', e);
            }
            return jsonPropsStr;
        };

        const pageId = params.odeNavStructureSyncId || params.odePageId;
        const blockId = params.odePagStructureSyncId || params.odeBlockId;
        const componentId = params.odeComponentsSyncId || params.odeIdeviceId || params.id;

        console.log('[apiCallManager] _saveIdeviceToYjs:', { pageId, blockId, componentId, params });

        // Helper to build Symfony-compatible response
        const buildResponse = (compId, isNew = false) => ({
            responseMessage: 'OK',
            odeComponentsSyncId: compId,
            id: compId,
            odeComponentsSync: {
                id: compId,
                odeId: compId,
                ideviceType: params.odeIdeviceTypeName,
                odeComponentsSyncProperties: []  // Empty array - Yjs doesn't use DB properties
            },
            newOdePagStructureSync: isNew,
            odePagStructureSync: {
                id: blockId,
                odePagId: blockId,
                odePagStructureSyncProperties: []
            }
        });

        // Check if component already exists in Yjs
        const existingComponent = componentId ? structureBinding.getComponentMap(componentId) : null;

        // If component doesn't exist and we have the required info, create it
        if (!existingComponent && pageId && blockId && (params.odeIdeviceTypeName || componentId)) {
            // Ensure block exists - create if "new"
            let actualBlockId = blockId;
            if (blockId === 'new' || !structureBinding.getBlockMap(pageId, blockId)) {
                actualBlockId = structureBinding.createBlock(pageId, params.blockName || '');
                console.log('[apiCallManager] Created new block in Yjs:', actualBlockId);
            }

            const newComponentId = structureBinding.createComponent(
                pageId,
                actualBlockId,
                params.odeIdeviceTypeName || 'FreeTextIdevice',
                {
                    id: componentId, // Preserve the original ID if provided
                    htmlContent: convertHtmlContent(params.htmlView) || '',
                    iconName: params.iconName,
                    jsonProperties: params.jsonProperties ? convertJsonProperties(params.jsonProperties) : undefined,
                }
            );
            console.log('[apiCallManager] Created new iDevice in Yjs:', newComponentId);
            return buildResponse(newComponentId || componentId, true);
        }

        // Update existing component
        if (existingComponent && componentId) {
            const updateData = {};
            if (params.htmlView !== undefined) {
                updateData.htmlContent = convertHtmlContent(params.htmlView);
            }
            if (params.jsonProperties !== undefined) {
                updateData.jsonProperties = convertJsonProperties(params.jsonProperties);
            }
            if (params.order !== undefined) {
                updateData.order = params.order;
            }

            try {
                structureBinding.updateComponent(componentId, updateData);
                console.log('[apiCallManager] Updated iDevice in Yjs:', componentId);
            } catch (e) {
                console.error('[apiCallManager] Error updating iDevice in Yjs:', e);
            }

            return buildResponse(componentId, false);
        }

        console.warn('[apiCallManager] _saveIdeviceToYjs: Missing required IDs or component not found');
        return buildResponse(componentId, false);
    }

    /**
     * Save idevice properties
     *
     * @param {*} params
     * @returns
     */
    async putSavePropertiesIdevice(params) {
        // Check if Yjs mode is active - save to Yjs instead of API
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            console.log('[apiCallManager] putSavePropertiesIdevice: Saving to Yjs', params);
            const componentId = params.odeComponentsSyncId;
            if (componentId) {
                try {
                    // Extract property fields from params (exclude odeComponentsSyncId)
                    // These are the known iDevice property keys
                    const propertyKeys = ['visibility', 'teacherOnly', 'identifier', 'cssClass'];
                    const properties = {};
                    for (const key of propertyKeys) {
                        if (params[key] !== undefined) {
                            properties[key] = params[key];
                        }
                    }
                    projectManager._yjsBridge.structureBinding.updateComponent(componentId, {
                        properties: properties
                    });
                    console.log('[apiCallManager] Saved properties to Yjs:', componentId, properties);
                } catch (e) {
                    console.error('[apiCallManager] Error saving properties to Yjs:', e);
                }
            }
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_idevices_idevice_properties_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Edit idevice action
     *
     * @param {*} params
     * @retuns
     *
     */
    async postEditIdevice(params) {
        // NOTE: CurrentOdeUsers flags API has been removed.
        // Yjs awareness handles editing state.
        return { responseMessage: 'OK' };
    }

    /**
     * Reorder idevice
     *
     * @param {*} params
     * @returns
     */
    async putReorderIdevice(params) {
        let url = this.endpoints.api_idevices_idevice_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Delete idevice
     *
     * @param {*} ideviceId
     * @returns
     */
    async deleteIdevice(ideviceId) {
        // Check if Yjs mode is active - delete from Yjs instead of API
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            console.log('[apiCallManager] deleteIdevice: Deleting from Yjs', ideviceId);
            try {
                projectManager._yjsBridge.structureBinding.deleteComponent(ideviceId);
                console.log('[apiCallManager] Deleted iDevice from Yjs:', ideviceId);
                return { responseMessage: 'OK' };
            } catch (e) {
                console.error('[apiCallManager] Error deleting iDevice from Yjs:', e);
                return { responseMessage: 'ERROR', error: e.message };
            }
        }

        let url = this.endpoints.api_idevices_idevice_delete.path;
        url = url.replace('{odeComponentsSyncId}', ideviceId);
        return await this.func.delete(url);
    }

    /**
     * Save block
     *
     * @param {*} params
     * @returns
     */
    async putSaveBlock(params) {
        // Check if Yjs mode is active
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            console.log('[apiCallManager] putSaveBlock: Saving block in Yjs', params);
            try {
                const blockId = params.odePagStructureSyncId;
                const binding = projectManager._yjsBridge.structureBinding;

                // Get current block data from Yjs to compare
                // This prevents duplicate undo entries when real-time sync already updated the value
                const currentBlock = binding.getBlock(blockId);

                const updates = {};
                // Only include values that have actually changed from Yjs
                if (params.blockName !== undefined && params.blockName !== currentBlock?.blockName) {
                    updates.blockName = params.blockName;
                }
                if (params.iconName !== undefined && params.iconName !== currentBlock?.iconName) {
                    updates.iconName = params.iconName;
                }
                if (params.order !== undefined && params.order !== currentBlock?.order) {
                    updates.order = params.order;
                }

                if (Object.keys(updates).length > 0) {
                    console.log('[apiCallManager] putSaveBlock: Syncing changed values to Yjs', updates);
                    binding.updateBlock(blockId, updates);
                } else {
                    console.log('[apiCallManager] putSaveBlock: No changes to sync (values already in Yjs)');
                }
                return {
                    responseMessage: 'OK',
                    odePagStructureSyncs: [],
                    odePagStructureSync: {
                        id: blockId,
                        odePagId: blockId,
                        blockName: params.blockName,
                        iconName: params.iconName,
                        order: params.order
                    }
                };
            } catch (e) {
                console.error('[apiCallManager] Error saving block in Yjs:', e);
                return { responseMessage: 'OK', odePagStructureSyncs: [] };
            }
        }
        let url =
            this.endpoints.api_pag_structures_pag_structure_data_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save block properties
     *
     * @param {*} params
     * @returns
     */
    async putSavePropertiesBlock(params) {
        // Check if Yjs mode is active
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            try {
                console.log('[apiCallManager] putSavePropertiesBlock: Saving block properties in Yjs', params);
                const blockId = params.odePagStructureSyncId;

                // Build properties object from params
                const properties = {};
                const propertyKeys = ['visibility', 'teacherOnly', 'allowToggle', 'minimized', 'identifier', 'cssClass'];
                propertyKeys.forEach(key => {
                    if (params[key] !== undefined) {
                        properties[key] = params[key];
                    }
                });

                // Update block properties in Yjs
                if (Object.keys(properties).length > 0) {
                    projectManager._yjsBridge.structureBinding.updateBlock(blockId, { properties });
                }

                // Also sync top-level block attributes if present
                // Each attribute change is a separate undo entry
                if (params.blockName !== undefined) {
                    projectManager._yjsBridge.structureBinding.updateBlock(blockId, { blockName: params.blockName });
                    // Stop capturing to ensure this is a separate undo entry
                    projectManager._yjsBridge.documentManager?.stopCapturing();
                }
                if (params.iconName !== undefined) {
                    projectManager._yjsBridge.structureBinding.updateBlock(blockId, { iconName: params.iconName });
                    // Stop capturing to ensure this is a separate undo entry
                    projectManager._yjsBridge.documentManager?.stopCapturing();
                }

                return {
                    responseMessage: 'OK',
                    odePagStructureSyncs: []
                };
            } catch (e) {
                console.error('[apiCallManager] Error saving block properties in Yjs:', e);
                return { responseMessage: 'OK', odePagStructureSyncs: [] };
            }
        }
        let url =
            this.endpoints.api_pag_structures_pag_structure_properties_save
                .path;
        return await this.func.put(url, params);
    }

    /**
     * Reorder block
     *
     * @param {*} params
     * @returns
     */
    async putReorderBlock(params) {
        // Note: Yjs reordering is handled by blockNode.reorderViaYjs() before this is called
        // This method is only used for legacy API mode
        let url = this.endpoints.api_pag_structures_pag_structure_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Delete block
     *
     * @param {*} blockId
     * @returns
     */
    async deleteBlock(blockId) {
        let url = this.endpoints.api_pag_structures_pag_structure_delete.path;
        url = url.replace('{odePagStructureSyncId}', blockId);
        return await this.func.delete(url);
    }

    /**
     * Save page node
     *
     * @param {*} params
     * @returns
     */
    async putSavePage(params) {
        let url =
            this.endpoints.api_nav_structures_nav_structure_data_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save page node properties
     *
     * @param {*} params
     * @returns
     */
    async putSavePropertiesPage(params) {
        // Check if Yjs mode is active
        const projectManager = eXeLearning?.app?.project;
        if (projectManager?._yjsEnabled && projectManager._yjsBridge?.structureBinding) {
            console.log('[apiCallManager] putSavePropertiesPage: Saving page properties in Yjs', params);
            try {
                const pageId = params.odeNavStructureSyncId;
                const updates = {};
                // Map API property names to Yjs property names
                if (params.titleNode !== undefined) updates.pageName = params.titleNode;
                if (params.order !== undefined) updates.order = params.order;

                // Store page properties in a properties map
                const propsToStore = {};
                for (const [key, value] of Object.entries(params)) {
                    if (key !== 'odeNavStructureSyncId' && key !== 'updateChildsProperties') {
                        propsToStore[key] = value;
                    }
                }
                if (Object.keys(propsToStore).length > 0) {
                    updates.properties = propsToStore;
                }

                if (Object.keys(updates).length > 0) {
                    projectManager._yjsBridge.structureBinding.updatePage(pageId, updates);
                }
                return {
                    responseMessage: 'OK',
                    odeNavStructureSync: {
                        id: pageId,
                        odePageId: pageId,
                        pageName: params.titleNode,
                        odeNavStructureSyncProperties: propsToStore
                    }
                };
            } catch (e) {
                console.error('[apiCallManager] Error saving page properties in Yjs:', e);
                return { responseMessage: 'OK' };
            }
        }
        let url =
            this.endpoints.api_nav_structures_nav_structure_properties_save
                .path;
        return await this.func.put(url, params);
    }

    /**
     * Reorder page node
     *
     * @param {*} params
     * @returns
     */
    async putReorderPage(params) {
        let url = this.endpoints.api_nav_structures_nav_structure_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Duplicate page
     *
     * @param {*} params
     * @returns
     */
    async postClonePage(params) {
        let url =
            this.endpoints.api_nav_structures_nav_structure_duplicate.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete page node
     *
     * @param {*} blockId
     * @returns
     */
    async deletePage(pageId) {
        let url = this.endpoints.api_nav_structures_nav_structure_delete.path;
        url = url.replace('{odeNavStructureSyncId}', pageId);
        return await this.func.delete(url);
    }

    /**
     * Upload file
     *
     * @param {*} params
     * @returns
     */
    async postUploadFileResource(params) {
        // Static mode - no server upload, return mock response for AssetManager handling
        if (this._isStaticMode()) {
            return {
                savedPath: 'static-mode', // Truthy to trigger AssetManager logic
                savedFilename: '',
                savedThumbnailName: '',
            };
        }
        let url = this.endpoints.api_idevices_upload_file_resources.path;
        return await this.func.post(url, params);
    }

    /**
     * Upload large file
     *
     * @param {*} params
     * @returns
     */
    async postUploadLargeFileResource(params) {
        // Static mode - no server upload, return mock response for AssetManager handling
        if (this._isStaticMode()) {
            return {
                savedPath: 'static-mode', // Truthy to trigger AssetManager logic
                savedFilename: '',
                savedThumbnailName: '',
            };
        }
        let url = this.endpoints.api_idevices_upload_large_file_resources.path;
        return await this.func.fileSendPost(url, params);
    }

    /**
     * Base api func call
     *
     * @param {*} endpointId
     * @param {*} params
     */
    async send(endpointId, params) {
        let url = this.endpoints[endpointId].path;
        let method = this.endpoints[endpointId].method;
        return await this.func.do(method, url, params);
    }

    /**
     * Games get idevices by session ID
     *
     * @param {string} odeSessionId
     * @returns {Promise<any>}
     */
    async getIdevicesBySessionId(odeSessionId) {
        let url = this.endpoints.api_games_session_idevices.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        return await this.func.get(url);
    }

    /**
     * Get the resource lock timeout duration in seconds
     *
     * @returns
     */
    async getResourceLockTimeout() {
        // Return 15 minutes (900000ms) as default lock timeout
        // This was a legacy Symfony endpoint, now handled client-side
        return 900000;
    }

    /*******************************************************************************
     * PROJECT SHARING API METHODS
     *******************************************************************************/

    /**
     * Helper to build project URL with UUID or numeric ID support
     * @param {number|string} projectId - The project ID or UUID
     * @param {string} suffix - The URL suffix (e.g., '/sharing', '/visibility')
     * @returns {string} The full URL
     */
    _buildProjectUrl(projectId, suffix = '') {
        const isUuid = String(projectId).includes('-');
        const basePath = isUuid
            ? `${this.apiUrlBase}${this.apiUrlBasePath}/api/projects/uuid/${projectId}`
            : `${this.apiUrlBase}${this.apiUrlBasePath}/api/projects/${projectId}`;
        return basePath + suffix;
    }

    /**
     * Get project sharing information (owner, collaborators, visibility)
     * Accepts both numeric ID and UUID
     *
     * @param {number|string} projectId - The project ID or UUID
     * @returns {Promise<Object>} Response with project sharing info
     */
    async getProject(projectId) {
        // Static mode - return default private visibility (no server available)
        if (this._isStaticMode()) {
            return {
                responseMessage: 'OK',
                project: { visibility: 'private' },
            };
        }

        const url = this._buildProjectUrl(projectId, '/sharing');

        const authToken =
            eXeLearning?.app?.project?._yjsBridge?.authToken ||
            eXeLearning?.app?.auth?.getToken?.() ||
            localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    responseMessage: 'ERROR',
                    detail: errorData.message || `HTTP ${response.status}`,
                };
            }

            return await response.json();
        } catch (error) {
            console.error('[API] getProject error:', error);
            return { responseMessage: 'ERROR', detail: error.message };
        }
    }

    /**
     * Update project visibility
     * Accepts both numeric ID and UUID
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {string} visibility - 'public' or 'private'
     * @returns {Promise<Object>} Response with updated project
     */
    async updateProjectVisibility(projectId, visibility) {
        const url = this._buildProjectUrl(projectId, '/visibility');

        const authToken =
            eXeLearning?.app?.project?._yjsBridge?.authToken ||
            eXeLearning?.app?.auth?.getToken?.() ||
            localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ visibility }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    responseMessage: 'ERROR',
                    detail: errorData.message || `HTTP ${response.status}`,
                };
            }

            return await response.json();
        } catch (error) {
            console.error('[API] updateProjectVisibility error:', error);
            return { responseMessage: 'ERROR', detail: error.message };
        }
    }

    /**
     * Add a collaborator to a project
     * Accepts both numeric ID and UUID
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {string} email - The collaborator's email
     * @param {string} role - The role (optional, default 'editor')
     * @returns {Promise<Object>} Response
     */
    async addProjectCollaborator(projectId, email, role = 'editor') {
        const url = this._buildProjectUrl(projectId, '/collaborators');

        const authToken =
            eXeLearning?.app?.project?._yjsBridge?.authToken ||
            eXeLearning?.app?.auth?.getToken?.() ||
            localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ email, role }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                // Map common error codes
                if (response.status === 404) {
                    return { responseMessage: 'USER_NOT_FOUND', detail: errorData.message };
                }
                if (response.status === 400 && errorData.message?.includes('already')) {
                    return { responseMessage: 'ALREADY_COLLABORATOR', detail: errorData.message };
                }
                return {
                    responseMessage: 'ERROR',
                    detail: errorData.message || `HTTP ${response.status}`,
                };
            }

            return await response.json();
        } catch (error) {
            console.error('[API] addProjectCollaborator error:', error);
            return { responseMessage: 'ERROR', detail: error.message };
        }
    }

    /**
     * Remove a collaborator from a project
     * Accepts both numeric ID and UUID
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {number} userId - The collaborator's user ID
     * @returns {Promise<Object>} Response
     */
    async removeProjectCollaborator(projectId, userId) {
        const url = this._buildProjectUrl(projectId, `/collaborators/${userId}`);

        const authToken =
            eXeLearning?.app?.project?._yjsBridge?.authToken ||
            eXeLearning?.app?.auth?.getToken?.() ||
            localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    responseMessage: 'ERROR',
                    detail: errorData.message || `HTTP ${response.status}`,
                };
            }

            return await response.json();
        } catch (error) {
            console.error('[API] removeProjectCollaborator error:', error);
            return { responseMessage: 'ERROR', detail: error.message };
        }
    }

    /**
     * Transfer project ownership to another user
     * Accepts both numeric ID and UUID
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {number} newOwnerId - The new owner's user ID
     * @returns {Promise<Object>} Response with updated project
     */
    async transferProjectOwnership(projectId, newOwnerId) {
        const url = this._buildProjectUrl(projectId, '/owner');

        const authToken =
            eXeLearning?.app?.project?._yjsBridge?.authToken ||
            eXeLearning?.app?.auth?.getToken?.() ||
            localStorage.getItem('authToken');

        try {
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ newOwnerId }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    responseMessage: 'ERROR',
                    detail: errorData.message || `HTTP ${response.status}`,
                };
            }

            return await response.json();
        } catch (error) {
            console.error('[API] transferProjectOwnership error:', error);
            return { responseMessage: 'ERROR', detail: error.message };
        }
    }

    /*******************************************************************************
     * STATIC MODE HELPERS
     * These methods enable ApiCallManager to work in both server and static modes.
     * Consumer code uses the same api.X() calls regardless of mode.
     *
     * Mode detection uses app.capabilities (derived from RuntimeConfig) as single
     * source of truth. Do NOT add fallbacks to window.__EXE_STATIC_MODE__ here.
     *******************************************************************************/

    /**
     * Check if running in static (offline) mode.
     * Uses app.capabilities as single source of truth (derived from RuntimeConfig).
     * @private
     * @returns {boolean}
     */
    _isStaticMode() {
        return this.app?.capabilities?.storage?.remote === false;
    }

    /**
     * Get static data by key
     * Priority: window.__EXE_STATIC_DATA__ > internal cache
     * @private
     * @param {string} key - Data key ('idevices', 'themes', etc.)
     * @returns {Object|null}
     */
    _getStaticData(key) {
        return window.__EXE_STATIC_DATA__?.[key] ||
               this.staticData?.[key] ||
               null;
    }

    /**
     * Get translations from static data
     * @private
     * @param {string} locale - Language code
     * @returns {{translations: Object}}
     */
    _getStaticTranslations(locale) {
        const data = window.__EXE_STATIC_DATA__?.translations ||
                     this.staticData?.translations;

        if (!data) {
            return { translations: {} };
        }

        // Try exact locale, then base language, then 'en'
        const baseLocale = locale.split('-')[0];
        return data[locale] || data[baseLocale] || data.en || { translations: {} };
    }
}

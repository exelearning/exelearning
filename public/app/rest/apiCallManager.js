import ApiCallBaseFunctions from './apiCallBaseFunctions.js';

export default class ApiCallManager {
    constructor(app) {
        this.app = app;
        this.apiUrlBase = `${app.eXeLearning.config.baseURL}`;
        this.apiUrlBasePath = `${app.eXeLearning.config.basePath}`;
        this.apiUrlParameters = `${this.apiUrlBase}${this.apiUrlBasePath}/api/parameter-management/parameters/data/list`;
        this.func = new ApiCallBaseFunctions();
        this.endpoints = {};
    }

    /**
     * Safely get endpoint URL
     * Returns null if endpoint doesn't exist (common in static mode)
     * @param {string} endpointName - Name of the endpoint
     * @returns {string|null} - URL or null if not available
     */
    _getEndpointUrl(endpointName) {
        const endpoint = this.endpoints[endpointName];
        if (!endpoint || !endpoint.path) {
            if (this.app.isStaticMode()) {
                // Silently return null in static mode - many endpoints aren't available
                return null;
            }
            console.warn(
                `[apiCallManager] Endpoint not found: ${endpointName}`
            );
            return null;
        }
        return endpoint.path;
    }

    /**
     * Load symfony api endpoints routes
     * In static mode, loads from DataProvider instead of server
     */
    async loadApiParameters() {
        this.parameters = await this.getApiParameters();
        for (var [key, data] of Object.entries(this.parameters.routes || {})) {
            this.endpoints[key] = {};
            this.endpoints[key].path = this.apiUrlBase + data.path;
            this.endpoints[key].methods = data.methods;
        }
    }

    /**
     * Get symfony api endpoints parameters
     * In static mode, uses DataProvider for pre-bundled data
     *
     * @returns
     */
    async getApiParameters() {
        // Static mode: use DataProvider
        if (this.app.isStaticMode()) {
            return await this.app.dataProvider.getApiParameters();
        }

        // Server mode: fetch from API
        let url = this.apiUrlParameters;
        return await this.func.get(url);
    }

    /**
     * Get app changelog text
     * In static mode, returns an empty string (no changelog available)
     *
     * @returns
     */
    async getChangelogText() {
        // Static mode: no changelog available
        if (this.app.isStaticMode()) {
            return '';
        }

        let url = this.app.eXeLearning.config.changelogURL;
        if (!url) {
            console.warn('[apiCallManager] changelogURL not configured');
            return '';
        }
        url += '?version=' + eXeLearning.app.common.getVersionTimeStamp();
        return await this.func.getText(url);
    }

    /**
     * Get upload limits configuration
     * In static mode, returns sensible defaults (no server-imposed limits)
     *
     * Returns the effective file upload size limit considering both
     * PHP limits and application configuration.
     *
     * @returns {Promise<{maxFileSize: number, maxFileSizeFormatted: string, limitingFactor: string, details: object}>}
     */
    async getUploadLimits() {
        // Static mode: use DataProvider
        if (this.app.isStaticMode()) {
            return await this.app.dataProvider.getUploadLimits();
        }

        // Server mode: fetch from API
        const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/config/upload-limits`;
        return await this.func.get(url);
    }

    /**
     * Get the third party code information
     * In static mode, files are in libs/ without version prefix
     *
     * @returns
     */
    async getThirdPartyCodeText() {
        // Static mode: use direct path without version prefix
        if (this.app.isStaticMode()) {
            return await this.func.getText('./libs/README.md');
        }

        // Use basePath + version for proper cache busting
        // URL pattern: {basePath}/{version}/path (e.g., /web/exelearning/v0.0.0-alpha/libs/README.md)
        const version = eXeLearning?.version || 'v1.0.0';
        let url = this.apiUrlBase + this.apiUrlBasePath + '/' + version + '/libs/README.md';
        return await this.func.getText(url);
    }

    /**
     * Get the list of licenses
     * In static mode, files are in libs/ without version prefix
     *
     * @returns
     */
    async getLicensesList() {
        // Static mode: use direct path without version prefix
        if (this.app.isStaticMode()) {
            return await this.func.getText('./libs/LICENSES');
        }

        // Use basePath + version for proper cache busting
        // URL pattern: {basePath}/{version}/path (e.g., /web/exelearning/v0.0.0-alpha/libs/LICENSES)
        const version = eXeLearning?.version || 'v1.0.0';
        let url = this.apiUrlBase + this.apiUrlBasePath + '/' + version + '/libs/LICENSES';
        return await this.func.getText(url);
    }

    /**
     * Get idevices installed
     * In static mode, uses DataProvider for pre-bundled data
     *
     * @returns
     */
    async getIdevicesInstalled() {
        // Static mode: use DataProvider
        if (this.app.isStaticMode()) {
            return await this.app.dataProvider.getInstalledIdevices();
        }

        // Server mode: fetch from API
        let url = this.endpoints.api_idevices_installed.path;
        return await this.func.get(url);
    }

    /**
     * Get themes installed
     * In static mode, uses DataProvider for pre-bundled data
     *
     * @returns
     */
    async getThemesInstalled() {
        // Static mode: use DataProvider
        if (this.app.isStaticMode()) {
            return await this.app.dataProvider.getInstalledThemes();
        }

        // Server mode: fetch from API
        let url = this.endpoints.api_themes_installed.path;
        return await this.func.get(url);
    }

    /**
     * Get user odefiles (projects)
     * Uses NestJS endpoint for Yjs-based projects
     * In static mode, returns projects from IndexedDB
     *
     * @returns {Promise<Object>} Response with odeFiles containing odeFilesSync array
     */
    async getUserOdeFiles() {
        // Static mode: return projects from local storage (IndexedDB)
        if (this.app.isStaticMode()) {
            return await this._getLocalProjects();
        }

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
     * Get local projects from IndexedDB (for static mode)
     * Scans IndexedDB for exelearning-project-* databases
     * @private
     */
    async _getLocalProjects() {
        try {
            // Get list of IndexedDB databases (if supported)
            if (!window.indexedDB?.databases) {
                console.log('[API] indexedDB.databases() not supported, returning empty list');
                return { odeFiles: { odeFilesSync: [] } };
            }

            const databases = await window.indexedDB.databases();
            const projectDatabases = databases.filter(
                db => db.name?.startsWith('exelearning-project-')
            );

            const projects = projectDatabases.map(db => {
                const uuid = db.name.replace('exelearning-project-', '');
                return {
                    uuid: uuid,
                    title: `Local Project (${uuid.substring(0, 8)}...)`,
                    updatedAt: new Date().toISOString(),
                    isLocal: true,
                };
            });

            return {
                odeFiles: {
                    odeFilesSync: projects,
                },
            };
        } catch (error) {
            console.error('[API] _getLocalProjects error:', error);
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
     * In static mode, returns empty array (no server templates)
     *
     * @param {string} locale - The locale code (e.g., 'en', 'es')
     * @returns {Promise<Array>} - Array of template objects
     */
    async getTemplates(locale) {
        // Static mode: no templates available from server
        if (this.app.isStaticMode()) {
            return { templates: [], locale };
        }

        let url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/templates?locale=${locale}`;
        return await this.func.get(url);
    }

    /**
     * Post odeSessionId and check availability
     * In static mode, always returns OK (single user, no conflicts)
     *
     * @param {*} params
     * @returns
     */
    async postJoinCurrentOdeSessionId(params) {
        // Static mode: always available (single user)
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', available: true };
        }

        let url = this.endpoints.check_current_users_ode_session_id.path;
        return await this.func.post(url, params);
    }

    /**
     * Post selected odefile
     * In static mode, file handling is done client-side
     *
     * @param {*} odeFileName
     * @returns
     */
    async postSelectedOdeFile(odeFileName) {
        // Static mode: file operations handled client-side
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', odeSessionId: window.eXeLearning?.projectId };
        }

        let url = this.endpoints.api_odes_ode_elp_open.path;
        return await this.func.post(url, odeFileName);
    }

    /**
     * In static mode, file operations handled client-side
     * @param {*} data
     * @returns
     */
    async postLocalLargeOdeFile(data) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', odeSessionId: window.eXeLearning?.projectId };
        }

        let url = this.endpoints.api_odes_ode_local_large_elp_open.path;
        return await this.func.fileSendPost(url, data);
    }

    /**
     * In static mode, file operations handled client-side
     * @param {*} data
     * @returns
     */
    async postLocalOdeFile(data) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', odeSessionId: window.eXeLearning?.projectId };
        }

        let url = this.endpoints.api_odes_ode_local_elp_open.path;
        return await this.func.post(url, data);
    }

    /**
     * In static mode, returns empty properties
     * @param {*} data
     * @returns
     */
    async postLocalXmlPropertiesFile(data) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', properties: {} };
        }

        let url = this.endpoints.api_odes_ode_local_xml_properties_open.path;
        return await this.func.post(url, data);
    }

    /**
     * In static mode, import handled client-side via JSZip
     * @param {*} data
     * @returns
     */
    async postImportElpToRoot(data) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_odes_ode_local_elp_import_root.path;
        return await this.func.fileSendPost(url, data);
    }

    /**
     * Import a previously uploaded file into the root by server local path.
     * In static mode, not supported
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async postImportElpToRootFromLocal(payload = {}) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        let url =
            this.endpoints.api_odes_ode_local_elp_import_root_from_local?.path;
        if (!url) {
            url =
                this.apiUrlBase +
                this.apiUrlBasePath +
                '/api/ode-management/odes/ode/import/local/root';
        }
        return await this.func.post(url, payload);
    }

    /**
     * In static mode, returns empty components
     * @param {*} data
     * @returns
     */
    async postLocalOdeComponents(data) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', components: [] };
        }

        let url = this.endpoints.api_odes_ode_local_idevices_open.path;
        return await this.func.post(url, data);
    }

    /**
     * In static mode, not supported
     * @param {*} data
     * @returns
     */
    async postMultipleLocalOdeFiles(data) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_odes_ode_multiple_local_elp_open.path;
        return await this.func.post(url, data);
    }

    /**
     * In static mode, not supported
     * @param {String} navId
     * @param {Object} payload
     * @returns
     */
    async postImportElpAsChildFromLocal(navId, payload = {}) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

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
     * Delete ode file - In static mode, handled via IndexedDB
     * @param {*} odeFileId
     * @returns
     */
    async postDeleteOdeFile(odeFileId) {
        if (this.app.isStaticMode()) {
            // In static mode, deletion is handled via IndexedDB directly
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_odes_remove_ode_file.path;
        return await this.func.post(url, odeFileId);
    }

    /**
     * In static mode, not applicable
     * @param {*} params
     * @returns
     */
    async postDeleteOdeFilesByDate(params) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_odes_remove_date_ode_files.path;
        return await this.func.post(url, params);
    }

    /**
     * In static mode, always returns 0 users (single user mode)
     * @param {*} params
     * @returns
     */
    async postCheckCurrentOdeUsers(params) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', currentUsers: 0 };
        }

        let url = this.endpoints.api_odes_check_before_leave_ode_session.path;
        return await this.func.post(url, params);
    }

    /**
     * In static mode, not applicable (no autosaves)
     * @param {*} params
     * @returns
     */
    async postCleanAutosavesByUser(params) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_odes_clean_init_autosave_elp.path;
        return await this.func.post(url, params);
    }

    /**
     * In static mode, session close is a no-op
     * @param {*} params
     * @returns
     */
    async postCloseSession(params) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_odes_ode_session_close.path;
        return await this.func.post(url, params);
    }

    /**
     * In static mode, theme upload not supported
     * @param {*} params
     * @returns
     */
    async postUploadTheme(params) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] Theme upload not supported in offline mode');
            return { responseMessage: 'NOT_SUPPORTED', themes: [] };
        }

        let url = this.endpoints.api_themes_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Import theme from ELP file
     * In static mode, not supported
     *
     * @param {Object} params
     * @param {string} params.themeDirname - Directory name of the theme
     * @param {Blob|File} params.themeZip - Packaged theme ZIP file (required)
     * @returns {Promise<Object>} Response with updated theme list
     */
    async postOdeImportTheme(params) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] Theme import not supported in offline mode');
            return { responseMessage: 'NOT_SUPPORTED' };
        }

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
     * Delete style - In static mode, not supported
     * @param {*} params
     * @returns
     */
    async deleteTheme(params) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] Theme deletion not supported in offline mode');
            return { responseMessage: 'NOT_SUPPORTED' };
        }

        let url = this.endpoints.api_themes_installed_delete.path;
        return await this.func.delete(url, params);
    }

    /**
     * Get installed theme zip - In static mode, not supported
     * @param {*} odeSessionId
     * @param {*} $themeDirName
     * @returns
     */
    async getThemeZip(odeSessionId, themeDirName) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] Theme download not supported in offline mode');
            return null;
        }

        let url = this.endpoints.api_themes_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{themeDirName}', themeDirName);
        return await this.func.get(url);
    }

    /**
     * Create new theme - In static mode, not supported
     * @param {*} params
     * @returns
     */
    async postNewTheme(params) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] Theme creation not supported in offline mode');
            return { responseMessage: 'NOT_SUPPORTED' };
        }

        let url = this.endpoints.api_themes_new.path;
        return await this.func.post(url, params);
    }

    /**
     * Edit theme - In static mode, not supported
     * @param {*} themeDir
     * @param {*} params
     * @returns
     */
    async putEditTheme(themeDir, params) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] Theme editing not supported in offline mode');
            return { responseMessage: 'NOT_SUPPORTED' };
        }

        let url = this.endpoints.api_themes_edit.path;
        url = url.replace('{themeDirName}', themeDir);
        return await this.func.put(url, params);
    }

    /**
     * Import idevice - In static mode, not supported
     * @param {*} params
     * @returns
     */
    async postUploadIdevice(params) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] iDevice upload not supported in offline mode');
            return { responseMessage: 'NOT_SUPPORTED' };
        }

        let url = this.endpoints.api_idevices_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete idevice installed - In static mode, not supported
     * @param {*} params
     * @returns
     */
    async deleteIdeviceInstalled(params) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] iDevice deletion not supported in offline mode');
            return { responseMessage: 'NOT_SUPPORTED' };
        }

        let url = this.endpoints.api_idevices_installed_delete.path;
        return await this.func.delete(url, params);
    }

    /**
     * Get installed idevice zip - In static mode, not supported
     * @param {*} odeSessionId
     * @param {*} ideviceDirName
     * @returns
     */
    async getIdeviceInstalledZip(odeSessionId, ideviceDirName) {
        if (this.app.isStaticMode()) {
            console.warn('[Static] iDevice download not supported in offline mode');
            return null;
        }

        let url = this.endpoints.api_idevices_installed_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{ideviceDirName}', ideviceDirName);
        return await this.func.get(url);
    }

    /**
     * Accept LOPD (data protection)
     * In static mode, saves acceptance to localStorage
     *
     * @returns
     */
    async postUserSetLopdAccepted() {
        // Static mode: save LOPD acceptance to localStorage
        if (this.app.isStaticMode()) {
            try {
                localStorage.setItem('exelearning_lopd_accepted', 'true');
                return { success: true };
            } catch (e) {
                console.warn('Failed to save LOPD acceptance:', e);
                return { success: false };
            }
        }

        let url = this.endpoints.api_user_set_lopd_accepted.path;
        return await this.func.post(url);
    }

    /**
     * Get user preferences
     * In static mode, returns preferences from localStorage merged with bundled defaults
     *
     * @returns
     */
    async getUserPreferences() {
        // Static mode: return preferences from bundled config merged with localStorage
        if (this.app.isStaticMode()) {
            const defaultPrefs = JSON.parse(
                JSON.stringify(this.parameters.userPreferencesConfig || {})
            );

            // Load saved preferences from localStorage
            try {
                const stored = JSON.parse(
                    localStorage.getItem('exelearning_user_preferences') || '{}'
                );
                // Merge stored values into defaults
                for (const [key, value] of Object.entries(stored)) {
                    if (defaultPrefs[key]) {
                        defaultPrefs[key].value = value;
                    }
                }
            } catch (e) {
                console.warn(
                    'Failed to load preferences from localStorage:',
                    e
                );
            }

            return {
                userPreferences: defaultPrefs,
            };
        }

        let url = this.endpoints.api_user_preferences_get.path;
        return await this.func.get(url);
    }

    /**
     * Save user preferences
     * In static mode, saves to localStorage
     *
     * @param {*} params
     * @returns
     */
    async putSaveUserPreferences(params) {
        // Static mode: save to localStorage
        if (this.app.isStaticMode()) {
            try {
                const stored =
                    JSON.parse(
                        localStorage.getItem('exelearning_user_preferences')
                    ) || {};
                Object.assign(stored, params);
                localStorage.setItem(
                    'exelearning_user_preferences',
                    JSON.stringify(stored)
                );
                return { success: true };
            } catch (e) {
                console.warn('Failed to save preferences to localStorage:', e);
                return { success: false };
            }
        }

        let url = this.endpoints.api_user_preferences_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Get ode last update - In static mode, returns current time
     * @param {*} odeId
     * @returns
     */
    async getOdeLastUpdated(odeId) {
        if (this.app.isStaticMode()) {
            return { lastUpdated: new Date().toISOString() };
        }

        let url = this.endpoints.api_odes_last_updated.path;
        url = url.replace('{odeId}', odeId);
        return await this.func.get(url);
    }

    /**
     * Get ode concurrent users - In static mode, returns 0 (single user)
     * @param {*} odeId
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeConcurrentUsers(odeId, versionId, sessionId) {
        if (this.app.isStaticMode()) {
            return { currentUsers: 0, users: [] };
        }

        let url = this.endpoints.api_odes_current_users.path;
        url = url.replace('{odeId}', odeId);
        url = url.replace('{odeVersionId}', versionId);
        url = url.replace('{odeSessionId}', sessionId);
        return await this.func.get(url, null, false);
    }

    /**
     * Get ode structure - In static mode, structure comes from Yjs
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeStructure(versionId, sessionId) {
        if (this.app.isStaticMode()) {
            // In static mode, structure is managed by Yjs locally
            return { structure: null };
        }

        let url = this.endpoints.api_nav_structures_nav_structure_get.path;
        url = url.replace('{odeVersionId}', versionId);
        url = url.replace('{odeSessionId}', sessionId);
        return await this.func.get(url);
    }

    /**
     * Get ode broken links - In static mode, not supported
     * @param {*} params
     * @returns
     */
    async getOdeSessionBrokenLinks(params) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', brokenLinks: [] };
        }

        let url = this.endpoints.api_odes_session_get_broken_links.path;
        return await this.func.postJson(url, params);
    }

    /**
     * Extract links from idevices for validation - In static mode, not supported
     * @param {Object} params - { odeSessionId, idevices }
     * @returns {Promise<Object>} - { responseMessage, links, totalLinks }
     */
    async extractLinksForValidation(params) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', links: [], totalLinks: 0 };
        }

        const url = `${this.apiUrlBase}${this.apiUrlBasePath}/api/ode-management/odes/session/brokenlinks/extract`;
        return await this.func.postJson(url, params);
    }

    /**
     * Get the URL for the link validation stream endpoint
     * @returns {string}
     */
    getLinkValidationStreamUrl() {
        return `${this.apiUrlBase}${this.apiUrlBasePath}/api/ode-management/odes/session/brokenlinks/validate-stream`;
    }

    /**
     * Get page broken links - In static mode, not supported
     * @param {*} pageId
     * @returns
     */
    async getOdePageBrokenLinks(pageId) {
        if (this.app.isStaticMode()) {
            return { brokenLinks: [] };
        }

        let url = this.endpoints.api_odes_pag_get_broken_links.path;
        url = url.replace('{odePageId}', pageId);
        return await this.func.get(url);
    }

    /**
     * Get block broken links - In static mode, not supported
     * @param {*} blockId
     * @returns
     */
    async getOdeBlockBrokenLinks(blockId) {
        if (this.app.isStaticMode()) {
            return { brokenLinks: [] };
        }

        let url = this.endpoints.api_odes_block_get_broken_links.path;
        url = url.replace('{odeBlockId}', blockId);
        return await this.func.get(url);
    }

    /**
     * Get idevice broken links - In static mode, not supported
     * @param {*} ideviceId
     * @returns
     */
    async getOdeIdeviceBrokenLinks(ideviceId) {
        if (this.app.isStaticMode()) {
            return { brokenLinks: [] };
        }

        let url = this.endpoints.api_odes_idevice_get_broken_links.path;
        url = url.replace('{odeIdeviceId}', ideviceId);
        return await this.func.get(url);
    }

    /**
     * Get ode properties - In static mode, properties from bundled config
     * @param {*} odeSessionId
     * @returns
     */
    async getOdeProperties(odeSessionId) {
        if (this.app.isStaticMode()) {
            return {
                responseMessage: 'OK',
                properties: this.parameters.odeProjectSyncPropertiesConfig || {},
            };
        }

        let url = this.endpoints.api_odes_properties_get.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        return await this.func.get(url);
    }

    /**
     * Save ode properties - In static mode, handled by Yjs locally
     * @param {*} params
     * @returns
     */
    async putSaveOdeProperties(params) {
        if (this.app.isStaticMode()) {
            // In static mode, properties are saved via Yjs
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_odes_properties_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Get ode used files - In static mode, not supported
     * @param {*} params
     * @returns
     */
    async getOdeSessionUsedFiles(params) {
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', usedFiles: [] };
        }

        let url = this.endpoints.api_odes_session_get_used_files.path;
        return await this.func.postJson(url, params);
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
     * In static mode, exports are handled client-side via Yjs exporters
     *
     * @param {*} params
     * @returns
     */
    async getOdeExportDownload(odeSessionId, exportType) {
        // In static mode, exports are handled client-side
        // The SaveManager and exporters bundle handle all export logic
        if (this.app.isStaticMode()) {
            console.log('[apiCallManager] Static mode: export handled client-side', exportType);
            return {
                responseMessage: 'OK',
                exportType: exportType,
                clientSideExport: true,
            };
        }

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

                        // Get components (iDevices)
                        const components = blockMap.get('components');
                        if (components) {
                            for (let k = 0; k < components.length; k++) {
                                const compMap = components.get(k);
                                if (!compMap) continue;

                                const component = {
                                    id: compMap.get('id'),
                                    ideviceType: compMap.get('ideviceType'),
                                    htmlContent: compMap.get('htmlContent')?.toString?.() || '',
                                };

                                // Get properties if available
                                const propsMap = compMap.get('properties');
                                if (propsMap && typeof propsMap.toJSON === 'function') {
                                    component.properties = propsMap.toJSON();
                                }

                                block.components.push(component);
                            }
                        }

                        page.blocks.push(block);
                    }
                }

                structure.pages.push(page);
            }

            console.log('[ApiCallManager] Built structure from Yjs:', structure);
            return structure;
        } catch (error) {
            console.error('[ApiCallManager] Failed to build structure from Yjs:', error);
            return null;
        }
    }

    /**
     * Preview ode export
     * In static mode, preview is handled client-side
     *
     * @param {*} params
     * @returns
     */
    async getOdePreviewUrl(odeSessionId) {
        // In static mode, preview is generated client-side
        if (this.app.isStaticMode()) {
            return {
                responseMessage: 'OK',
                clientSidePreview: true,
            };
        }

        let url = this.endpoints.api_ode_export_preview.path;
        url = url.replace('{odeSessionId}', odeSessionId);

        return await this.func.get(url);
    }

    /**
     * download idevice/block content
     * In static mode, not supported - use client-side export
     *
     * @param {*} params
     * @returns
     */
    async getOdeIdevicesDownload(odeSessionId, odeBlockId, odeIdeviceId) {
        // In static mode, component downloads are not supported
        if (this.app.isStaticMode()) {
            console.warn('[apiCallManager] Static mode: iDevice download not supported');
            return { url: '', response: '', responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

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
     * In static mode, not supported
     *
     * @param {*} resource
     * @returns
     */
    async getFileResourcesForceDownload(resource) {
        // In static mode, file resources download not supported
        if (this.app.isStaticMode()) {
            console.warn('[apiCallManager] Static mode: file resources download not supported');
            return { url: '', responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

        let downloadResponse = [];
        let url =
            this.endpoints.api_idevices_force_download_file_resources.path;
        downloadResponse['url'] = url + '?resource=' + resource;
        return downloadResponse;
    }

    /**
     * Save ode
     * In static mode, handled by Yjs/IndexedDB - SaveManager.saveToIndexedDB()
     *
     * @param {*} params
     * @returns
     */
    async postOdeSave(params) {
        // In static mode, saving is handled by SaveManager and IndexedDB
        if (this.app.isStaticMode()) {
            console.log('[apiCallManager] Static mode: save handled by Yjs/IndexedDB');
            return { responseMessage: 'OK', staticMode: true };
        }

        let url = this.endpoints.api_odes_ode_save_manual.path;
        return await this.func.post(url, params);
    }

    /**
     * Autosave ode
     * In static mode, handled by Yjs/IndexedDB
     *
     * @param {*} params
     * @returns
     */
    async postOdeAutosave(params) {
        // In static mode, autosave is handled by Yjs persistence
        if (this.app.isStaticMode()) {
            console.log('[apiCallManager] Static mode: autosave handled by Yjs persistence');
            return;
        }

        let url = this.endpoints.api_odes_ode_save_auto.path;
        this.func.post(url, params);
    }

    /**
     * Save as ode
     * In static mode, handled client-side - exports new .elpx file
     *
     * @param {*} params
     * @returns
     */
    async postOdeSaveAs(params) {
        // In static mode, Save As creates a new project via export
        if (this.app.isStaticMode()) {
            console.log('[apiCallManager] Static mode: saveAs handled client-side');
            return { responseMessage: 'OK', staticMode: true };
        }

        let url = this.endpoints.api_odes_ode_save_as.path;
        return await this.func.post(url, params);
    }

    /**
     * Upload new elp to first type platform
     * In static mode, not supported - no server platform integration
     *
     * @param {*} params
     * @returns
     */
    async postFirstTypePlatformIntegrationElpUpload(params) {
        // Platform integration not available in static mode
        if (this.app.isStaticMode()) {
            console.warn('[apiCallManager] Static mode: platform integration not available');
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

        let url = this.endpoints.set_platform_new_ode.path;
        return await this.func.post(url, params);
    }

    /**
     * Open elp from platform
     * In static mode, not supported - no server platform integration
     *
     * @param {*} params
     * @returns
     */
    async platformIntegrationOpenElp(params) {
        // Platform integration not available in static mode
        if (this.app.isStaticMode()) {
            console.warn('[apiCallManager] Static mode: platform integration not available');
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

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
     * Obtain ODE block sync
     * In static mode, Yjs handles all sync
     *
     * @param {*} params
     * @returns
     */
    async postObtainOdeBlockSync(params) {
        // In static mode, Yjs handles all synchronization
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', block: null };
        }

        let url = this.endpoints.get_current_block_update.path;
        return await this.func.post(url, params);
    }

    /**
     * Get all translations
     * In static mode, returns available locales from bundled data
     *
     * @param {*} locale
     * @returns
     */
    async getTranslationsAll() {
        // Static mode: return bundled locale info
        if (this.app.isStaticMode()) {
            return {
                locales: ['ca', 'en', 'eo', 'es', 'eu', 'gl', 'pt', 'ro', 'va'],
                packageLocales: ['ca', 'en', 'eo', 'es', 'eu', 'gl', 'pt', 'ro', 'va'],
                defaultLocale: 'en',
            };
        }

        let url = this.endpoints.api_translations_lists.path;
        return await this.func.get(url);
    }

    /**
     * Get translations
     * In static mode, uses DataProvider for pre-bundled translations
     *
     * @param {*} locale
     * @returns
     */
    async getTranslations(locale) {
        // Static mode: use DataProvider
        if (this.app.isStaticMode()) {
            return await this.app.dataProvider.getTranslations(locale);
        }

        // Server mode: fetch from API
        let url = this.endpoints.api_translations_list_by_locale.path;
        url = url.replace('{locale}', locale);
        return await this.func.get(url);
    }

    /**
     * Get login url of Google Drive
     * In static mode, cloud storage not available
     *
     * @returns
     */
    async getUrlLoginGoogleDrive() {
        // Cloud storage not available in static mode
        if (this.app.isStaticMode()) {
            console.warn('[apiCallManager] Static mode: Google Drive not available');
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE', url: null };
        }

        let url = this.endpoints.api_google_oauth_login_url_get.path;
        return await this.func.get(url);
    }

    /**
     * Get folders of Google Drive account
     * In static mode, cloud storage not available
     *
     * @returns
     */
    async getFoldersGoogleDrive() {
        // Cloud storage not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE', folders: [] };
        }

        let url = this.endpoints.api_google_drive_folders_list.path;
        return await this.func.get(url);
    }

    /**
     * Upload file to Google Drive
     * In static mode, cloud storage not available
     *
     * @param {*} params
     * @returns
     */
    async uploadFileGoogleDrive(params) {
        // Cloud storage not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

        let url = this.endpoints.api_google_drive_file_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Get login url of Dropbox
     * In static mode, cloud storage not available
     *
     * @returns
     */
    async getUrlLoginDropbox() {
        // Cloud storage not available in static mode
        if (this.app.isStaticMode()) {
            console.warn('[apiCallManager] Static mode: Dropbox not available');
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE', url: null };
        }

        let url = this.endpoints.api_dropbox_oauth_login_url_get.path;
        return await this.func.get(url);
    }

    /**
     * Get folders of Dropbox account
     * In static mode, cloud storage not available
     *
     * @returns
     */
    async getFoldersDropbox() {
        // Cloud storage not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE', folders: [] };
        }

        let url = this.endpoints.api_dropbox_folders_list.path;
        return await this.func.get(url);
    }

    /**
     * Upload file to Dropbox
     * In static mode, cloud storage not available
     *
     * @param {*} params
     * @returns
     */
    async uploadFileDropbox(params) {
        // Cloud storage not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

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
                        odeComponentsSyncProperties: [],
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
     * In static mode, templates come from bundled data
     *
     * @param {*} odeNavStructureSyncId
     * @returns
     */
    async getComponentHtmlTemplate(odeNavStructureSyncId) {
        // In static mode, templates are bundled in iDevices data
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', htmlTemplate: '' };
        }

        let url = this.endpoints.api_idevices_html_template_get.path;
        url = url.replace('{odeComponentsSyncId}', odeNavStructureSyncId);
        return await this.func.get(url);
    }

    /**
     * Get idevice html saved
     * In static mode, html view comes from Yjs document
     *
     * @param {*} params
     * @returns
     */
    async getSaveHtmlView(odeComponentsSyncId) {
        // In static mode, html view is stored in Yjs
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', htmlView: '' };
        }

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
     * In static mode, handled by Yjs structure binding
     *
     * @param {*} params
     * @returns
     */
    async putReorderIdevice(params) {
        // In static mode, reordering is handled by Yjs
        if (this.app.isStaticMode()) {
            // Yjs handles reordering via structureBinding
            return { responseMessage: 'OK' };
        }

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
                const updates = {};
                if (params.blockName !== undefined) updates.blockName = params.blockName;
                if (params.iconName !== undefined) updates.iconName = params.iconName;
                if (params.order !== undefined) updates.order = params.order;

                if (Object.keys(updates).length > 0) {
                    projectManager._yjsBridge.structureBinding.updateBlock(blockId, updates);
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
                if (params.blockName !== undefined) {
                    projectManager._yjsBridge.structureBinding.updateBlock(blockId, { blockName: params.blockName });
                }
                if (params.iconName !== undefined) {
                    projectManager._yjsBridge.structureBinding.updateBlock(blockId, { iconName: params.iconName });
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
     * In static mode, handled by Yjs structure binding
     *
     * @param {*} params
     * @returns
     */
    async putReorderBlock(params) {
        // In static mode, reordering is handled by Yjs
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        // Note: Yjs reordering is handled by blockNode.reorderViaYjs() before this is called
        // This method is only used for legacy API mode
        let url = this.endpoints.api_pag_structures_pag_structure_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Delete block
     * In static mode, handled by Yjs structure binding
     *
     * @param {*} blockId
     * @returns
     */
    async deleteBlock(blockId) {
        // In static mode, deletion is handled by Yjs
        if (this.app.isStaticMode()) {
            const projectManager = eXeLearning?.app?.project;
            if (projectManager?._yjsBridge?.structureBinding) {
                try {
                    projectManager._yjsBridge.structureBinding.deleteBlock(blockId);
                    return { responseMessage: 'OK' };
                } catch (e) {
                    console.error('[apiCallManager] Error deleting block from Yjs:', e);
                }
            }
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_pag_structures_pag_structure_delete.path;
        url = url.replace('{odePagStructureSyncId}', blockId);
        return await this.func.delete(url);
    }

    /**
     * Save page node
     * In static mode, handled by Yjs
     *
     * @param {*} params
     * @returns
     */
    async putSavePage(params) {
        // In static mode, page saving is handled by Yjs
        if (this.app.isStaticMode()) {
            const projectManager = eXeLearning?.app?.project;
            if (projectManager?._yjsBridge?.structureBinding) {
                const pageId = params.odeNavStructureSyncId;
                const updates = {};
                if (params.pageName !== undefined) updates.pageName = params.pageName;
                if (params.order !== undefined) updates.order = params.order;
                try {
                    projectManager._yjsBridge.structureBinding.updatePage(pageId, updates);
                } catch (e) {
                    console.error('[apiCallManager] Error saving page in Yjs:', e);
                }
            }
            return { responseMessage: 'OK' };
        }

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
     * In static mode, handled by Yjs
     *
     * @param {*} params
     * @returns
     */
    async putReorderPage(params) {
        // In static mode, reordering is handled by Yjs
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_nav_structures_nav_structure_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Duplicate page
     * In static mode, handled by Yjs structure binding
     *
     * @param {*} params
     * @returns
     */
    async postClonePage(params) {
        // In static mode, page duplication is handled by Yjs
        if (this.app.isStaticMode()) {
            const projectManager = eXeLearning?.app?.project;
            if (projectManager?._yjsBridge?.structureBinding) {
                try {
                    const pageId = params.odeNavStructureSyncId;
                    const newPageId = projectManager._yjsBridge.structureBinding.duplicatePage(pageId);
                    return {
                        responseMessage: 'OK',
                        odeNavStructureSync: { id: newPageId, odePageId: newPageId }
                    };
                } catch (e) {
                    console.error('[apiCallManager] Error duplicating page in Yjs:', e);
                }
            }
            return { responseMessage: 'OK' };
        }

        let url =
            this.endpoints.api_nav_structures_nav_structure_duplicate.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete page node
     * In static mode, handled by Yjs
     *
     * @param {*} blockId
     * @returns
     */
    async deletePage(pageId) {
        // In static mode, deletion is handled by Yjs
        if (this.app.isStaticMode()) {
            const projectManager = eXeLearning?.app?.project;
            if (projectManager?._yjsBridge?.structureBinding) {
                try {
                    projectManager._yjsBridge.structureBinding.deletePage(pageId);
                    return { responseMessage: 'OK' };
                } catch (e) {
                    console.error('[apiCallManager] Error deleting page from Yjs:', e);
                }
            }
            return { responseMessage: 'OK' };
        }

        let url = this.endpoints.api_nav_structures_nav_structure_delete.path;
        url = url.replace('{odeNavStructureSyncId}', pageId);
        return await this.func.delete(url);
    }

    /**
     * Upload file
     * In static mode, files are stored via AssetManager in IndexedDB
     *
     * @param {*} params
     * @returns
     */
    async postUploadFileResource(params) {
        // In static mode, file uploads are handled by AssetManager
        if (this.app.isStaticMode()) {
            console.log('[apiCallManager] Static mode: file upload handled by AssetManager');
            return { responseMessage: 'OK', staticMode: true };
        }

        let url = this.endpoints.api_idevices_upload_file_resources.path;
        return await this.func.post(url, params);
    }

    /**
     * Upload large file
     * In static mode, files are stored via AssetManager in IndexedDB
     *
     * @param {*} params
     * @returns
     */
    async postUploadLargeFileResource(params) {
        // In static mode, file uploads are handled by AssetManager
        if (this.app.isStaticMode()) {
            console.log('[apiCallManager] Static mode: large file upload handled by AssetManager');
            return { responseMessage: 'OK', staticMode: true };
        }

        let url = this.endpoints.api_idevices_upload_large_file_resources.path;
        return await this.func.fileSendPost(url, params);
    }

    /**
     * Base api func call
     * In static mode, returns error since no server is available
     *
     * @param {*} endpointId
     * @param {*} params
     */
    async send(endpointId, params) {
        // In static mode, generic API calls are not supported
        if (this.app.isStaticMode()) {
            console.warn('[apiCallManager] Static mode: generic API call not supported', endpointId);
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

        let url = this.endpoints[endpointId].path;
        let method = this.endpoints[endpointId].method;
        return await this.func.do(method, url, params);
    }

    /**
     * Games get idevices by session ID
     * In static mode, returns empty list
     *
     * @param {string} odeSessionId
     * @returns {Promise<any>}
     */
    async getIdevicesBySessionId(odeSessionId) {
        // In static mode, games API not supported
        if (this.app.isStaticMode()) {
            return { responseMessage: 'OK', idevices: [] };
        }

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
     * In static mode, sharing not available
     *
     * @param {number|string} projectId - The project ID or UUID
     * @returns {Promise<Object>} Response with project sharing info
     */
    async getProject(projectId) {
        // Sharing not available in static mode
        if (this.app.isStaticMode()) {
            return {
                responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE',
                visibility: 'private',
                collaborators: [],
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
     * In static mode, sharing not available
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {string} visibility - 'public' or 'private'
     * @returns {Promise<Object>} Response with updated project
     */
    async updateProjectVisibility(projectId, visibility) {
        // Sharing not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

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
     * In static mode, sharing not available
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {string} email - The collaborator's email
     * @param {string} role - The role (optional, default 'editor')
     * @returns {Promise<Object>} Response
     */
    async addProjectCollaborator(projectId, email, role = 'editor') {
        // Sharing not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

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
     * In static mode, sharing not available
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {number} userId - The collaborator's user ID
     * @returns {Promise<Object>} Response
     */
    async removeProjectCollaborator(projectId, userId) {
        // Sharing not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

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
     * In static mode, sharing not available
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {number} newOwnerId - The new owner's user ID
     * @returns {Promise<Object>} Response with updated project
     */
    async transferProjectOwnership(projectId, newOwnerId) {
        // Sharing not available in static mode
        if (this.app.isStaticMode()) {
            return { responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
        }

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
}

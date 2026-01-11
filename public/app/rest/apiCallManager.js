import ApiCallBaseFunctions from './apiCallBaseFunctions.js';

export default class ApiCallManager {
    /**
     * @param {Object} app - App instance
     * @param {Object} [options] - Optional adapters for dependency injection
     * @param {Object} [options.projectRepo] - Project repository adapter
     * @param {Object} [options.catalog] - Catalog adapter
     * @param {Object} [options.assets] - Asset adapter
     * @param {Object} [options.collaboration] - Collaboration adapter
     * @param {Object} [options.exportAdapter] - Export adapter
     * @param {Object} [options.userPreferences] - User preferences adapter
     * @param {Object} [options.linkValidation] - Link validation adapter
     * @param {Object} [options.cloudStorage] - Cloud storage adapter
     * @param {Object} [options.platformIntegration] - Platform integration adapter
     * @param {Object} [options.sharing] - Sharing adapter
     * @param {Object} [options.content] - Content adapter for page/block operations
     */
    constructor(app, options = {}) {
        this.app = app;
        this.apiUrlBase = `${app.eXeLearning.config.baseURL}`;
        this.apiUrlBasePath = `${app.eXeLearning.config.basePath}`;
        this.apiUrlParameters = `${this.apiUrlBase}${this.apiUrlBasePath}/api/parameter-management/parameters/data/list`;
        this.func = new ApiCallBaseFunctions();
        this.endpoints = {};

        // Injected adapters (optional, for gradual migration)
        // When adapters are provided, methods will use them instead of conditionals
        this._projectRepo = options.projectRepo || null;
        this._catalog = options.catalog || null;
        this._assets = options.assets || null;
        this._collaboration = options.collaboration || null;
        this._exportAdapter = options.exportAdapter || null;
        this._userPreferences = options.userPreferences || null;
        this._linkValidation = options.linkValidation || null;
        this._cloudStorage = options.cloudStorage || null;
        this._platformIntegration = options.platformIntegration || null;
        this._sharing = options.sharing || null;
        this._content = options.content || null;
    }

    /**
     * Check if an adapter is available for use.
     * @param {string} adapterName - Name of the adapter
     * @returns {boolean}
     */
    _hasAdapter(adapterName) {
        return this[`_${adapterName}`] !== null;
    }

    /**
     * Inject adapters after construction.
     * This allows for async adapter creation during app initialization.
     * @param {Object} adapters - Object containing adapter instances
     */
    setAdapters(adapters) {
        if (adapters.projectRepo) this._projectRepo = adapters.projectRepo;
        if (adapters.catalog) this._catalog = adapters.catalog;
        if (adapters.assets) this._assets = adapters.assets;
        if (adapters.collaboration) this._collaboration = adapters.collaboration;
        if (adapters.exportAdapter) this._exportAdapter = adapters.exportAdapter;
        if (adapters.userPreferences) this._userPreferences = adapters.userPreferences;
        if (adapters.linkValidation) this._linkValidation = adapters.linkValidation;
        if (adapters.cloudStorage) this._cloudStorage = adapters.cloudStorage;
        if (adapters.platformIntegration) this._platformIntegration = adapters.platformIntegration;
        if (adapters.sharing) this._sharing = adapters.sharing;
        if (adapters.content) this._content = adapters.content;
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
            // Silently return null if no remote storage (static/offline mode)
            const capabilities = this.app.capabilities;
            if (capabilities && !capabilities.storage.remote) {
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
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns
     */
    async getApiParameters() {
        return this._catalog.getApiParameters();
    }

    /**
     * Get app changelog text
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns
     */
    async getChangelogText() {
        return this._catalog.getChangelog();
    }

    /**
     * Get upload limits configuration
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns {Promise<{maxFileSize: number, maxFileSizeFormatted: string, limitingFactor: string, details: object}>}
     */
    async getUploadLimits() {
        return this._catalog.getUploadLimits();
    }

    /**
     * Get the third party code information
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns
     */
    async getThirdPartyCodeText() {
        return this._catalog.getThirdPartyCode();
    }

    /**
     * Get the list of licenses
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns
     */
    async getLicensesList() {
        return this._catalog.getLicensesList();
    }

    /**
     * Get idevices installed
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns
     */
    async getIdevicesInstalled() {
        return this._catalog.getIDevices();
    }

    /**
     * Get themes installed
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns
     */
    async getThemesInstalled() {
        return this._catalog.getThemes();
    }

    /**
     * Get user odefiles (projects)
     * Uses injected project repository (server or static mode)
     *
     * @returns {Promise<Object>} Response with odeFiles containing odeFilesSync array
     */
    async getUserOdeFiles() {
        try {
            const projects = await this._projectRepo.list();
            return { odeFiles: { odeFilesSync: projects } };
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
     * Uses injected project repository (server or static mode)
     *
     * @returns {Promise<Array>} Array of recent project objects
     */
    async getRecentUserOdeFiles() {
        try {
            return await this._projectRepo.getRecent();
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
     * Uses injected catalog adapter (server or static mode)
     *
     * @param {string} locale - The locale code (e.g., 'en', 'es')
     * @returns {Promise<Array>} - Array of template objects
     */
    async getTemplates(locale) {
        return this._catalog.getTemplates(locale);
    }

    /**
     * Post odeSessionId and check availability
     * Uses injected project repository (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async postJoinCurrentOdeSessionId(params) {
        const result = await this._projectRepo.joinSession(params.odeSessionId);
        return { responseMessage: 'OK', ...result };
    }

    /**
     * Post selected odefile
     * Uses injected project repository (server or static mode)
     *
     * @param {*} odeFileName
     * @returns
     */
    async postSelectedOdeFile(odeFileName) {
        return this._projectRepo.openFile(odeFileName);
    }

    /**
     * Open large local ODE file
     * Uses injected project repository (server or static mode)
     * @param {*} data
     * @returns
     */
    async postLocalLargeOdeFile(data) {
        return this._projectRepo.openLargeLocalFile(data);
    }

    /**
     * Open local ODE file
     * Uses injected project repository (server or static mode)
     * @param {*} data
     * @returns
     */
    async postLocalOdeFile(data) {
        return this._projectRepo.openLocalFile(data);
    }

    /**
     * Get local XML properties file
     * Uses injected project repository (server or static mode)
     * @param {*} data
     * @returns
     */
    async postLocalXmlPropertiesFile(data) {
        return this._projectRepo.getLocalProperties(data);
    }

    /**
     * Import ELP to root
     * Uses injected project repository (server or static mode)
     * @param {*} data
     * @returns
     */
    async postImportElpToRoot(data) {
        return this._projectRepo.importToRoot(data);
    }

    /**
     * Import a previously uploaded file into the root by server local path.
     * Uses injected project repository (server or static mode)
     * @param {Object} payload
     * @returns {Promise<Object>}
     */
    async postImportElpToRootFromLocal(payload = {}) {
        return this._projectRepo.importToRootFromLocal(payload);
    }

    /**
     * Get local ODE components
     * Uses injected project repository (server or static mode)
     * @param {*} data
     * @returns
     */
    async postLocalOdeComponents(data) {
        return this._projectRepo.getLocalComponents(data);
    }

    /**
     * Open multiple local ODE files
     * Uses injected project repository (server or static mode)
     * @param {*} data
     * @returns
     */
    async postMultipleLocalOdeFiles(data) {
        return this._projectRepo.openMultipleLocalFiles(data);
    }

    /**
     * Import ELP as child node
     * Uses injected project repository (server or static mode)
     * @param {String} navId
     * @param {Object} payload
     * @returns
     */
    async postImportElpAsChildFromLocal(navId, payload = {}) {
        return this._projectRepo.importAsChild(navId, payload);
    }

    // Backwards compatibility wrapper
    async postImportElpAsChild(navId, payload = {}) {
        return await this.postImportElpAsChildFromLocal(navId, payload);
    }

    /**
     * Delete ODE file
     * Uses injected project repository (server or static mode)
     * @param {*} odeFileId
     * @returns
     */
    async postDeleteOdeFile(odeFileId) {
        await this._projectRepo.delete(odeFileId);
        return { responseMessage: 'OK' };
    }

    /**
     * Delete ODE files by date
     * Uses injected project repository (server or static mode)
     * @param {*} params
     * @returns
     */
    async postDeleteOdeFilesByDate(params) {
        return this._projectRepo.deleteByDate(params);
    }

    /**
     * Check current ODE users
     * Uses injected project repository (server or static mode)
     * @param {*} params
     * @returns
     */
    async postCheckCurrentOdeUsers(params) {
        return this._projectRepo.checkCurrentUsers(params);
    }

    /**
     * Clean autosaves by user
     * Uses injected project repository (server or static mode)
     * @param {*} params
     * @returns
     */
    async postCleanAutosavesByUser(params) {
        return this._projectRepo.cleanAutosaves(params);
    }

    /**
     * Close session
     * Uses injected project repository (server or static mode)
     * @param {*} params
     * @returns
     */
    async postCloseSession(params) {
        return this._projectRepo.closeSession(params);
    }

    /**
     * Upload theme
     * Uses injected catalog adapter (server or static mode)
     * @param {*} params
     * @returns
     */
    async postUploadTheme(params) {
        return this._catalog.uploadTheme(params);
    }

    /**
     * Import theme from ELP file
     * Uses injected catalog adapter (server or static mode)
     *
     * @param {Object} params
     * @param {string} params.themeDirname - Directory name of the theme
     * @param {Blob|File} params.themeZip - Packaged theme ZIP file (required)
     * @returns {Promise<Object>} Response with updated theme list
     */
    async postOdeImportTheme(params) {
        return this._catalog.importTheme(params);
    }

    /**
     * Delete theme
     * Uses injected catalog adapter (server or static mode)
     * @param {*} params
     * @returns
     */
    async deleteTheme(params) {
        return this._catalog.deleteTheme(params);
    }

    /**
     * Get installed theme zip
     * Uses injected catalog adapter (server or static mode)
     * @param {*} odeSessionId
     * @param {*} themeDirName
     * @returns
     */
    async getThemeZip(odeSessionId, themeDirName) {
        return this._catalog.getThemeZip(odeSessionId, themeDirName);
    }

    /**
     * Create new theme
     * Uses injected catalog adapter (server or static mode)
     * @param {*} params
     * @returns
     */
    async postNewTheme(params) {
        return this._catalog.createTheme(params);
    }

    /**
     * Edit theme
     * Uses injected catalog adapter (server or static mode)
     * @param {*} themeDir
     * @param {*} params
     * @returns
     */
    async putEditTheme(themeDir, params) {
        return this._catalog.updateTheme(themeDir, params);
    }

    /**
     * Upload iDevice
     * Uses injected catalog adapter (server or static mode)
     * @param {*} params
     * @returns
     */
    async postUploadIdevice(params) {
        return this._catalog.uploadIdevice(params);
    }

    /**
     * Delete installed iDevice
     * Uses injected catalog adapter (server or static mode)
     * @param {*} params
     * @returns
     */
    async deleteIdeviceInstalled(params) {
        return this._catalog.deleteIdevice(params);
    }

    /**
     * Get installed iDevice zip
     * Uses injected catalog adapter (server or static mode)
     * @param {*} odeSessionId
     * @param {*} ideviceDirName
     * @returns
     */
    async getIdeviceInstalledZip(odeSessionId, ideviceDirName) {
        return this._catalog.getIdeviceZip(odeSessionId, ideviceDirName);
    }

    /**
     * Accept LOPD (data protection)
     * Uses injected user preferences adapter (server or static mode)
     *
     * @returns
     */
    async postUserSetLopdAccepted() {
        return this._userPreferences.acceptLopd();
    }

    /**
     * Get user preferences
     * Uses injected user preferences adapter (server or static mode)
     *
     * @returns
     */
    async getUserPreferences() {
        return this._userPreferences.getPreferences();
    }

    /**
     * Save user preferences
     * Uses injected user preferences adapter (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async putSaveUserPreferences(params) {
        return this._userPreferences.savePreferences(params);
    }

    /**
     * Get ODE last updated
     * Uses injected project repository (server or static mode)
     * @param {*} odeId
     * @returns
     */
    async getOdeLastUpdated(odeId) {
        return this._projectRepo.getLastUpdated(odeId);
    }

    /**
     * Get ODE concurrent users
     * Uses injected project repository (server or static mode)
     * @param {*} odeId
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeConcurrentUsers(odeId, versionId, sessionId) {
        const result = await this._projectRepo.getConcurrentUsers(odeId, versionId, sessionId);
        return { currentUsers: result.users?.length || 0, users: result.users || [] };
    }

    /**
     * Get ODE structure
     * Uses injected project repository (server or static mode)
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeStructure(versionId, sessionId) {
        return this._projectRepo.getStructure(versionId, sessionId);
    }

    /**
     * Get ODE session broken links
     * Uses injected link validation adapter (server or static mode)
     * @param {*} params
     * @returns
     */
    async getOdeSessionBrokenLinks(params) {
        return this._linkValidation.getSessionBrokenLinks(params);
    }

    /**
     * Extract links from iDevices for validation
     * Extracts links from Yjs content (always available)
     * @param {Object} params - { odeSessionId, idevices }
     * @returns {Promise<Object>} - { responseMessage, links, totalLinks }
     */
    async extractLinksForValidation(params) {
        return this._extractLinksFromYjs();
    }

    /**
     * Extract links from Yjs document by scanning all content.
     * @private
     * @returns {Promise<{responseMessage: string, links: Array, totalLinks: number}>}
     */
    _extractLinksFromYjs() {
        const projectManager = eXeLearning?.app?.project;
        const bridge = projectManager?._yjsBridge;
        const structureBinding = bridge?.structureBinding;

        if (!structureBinding) {
            console.warn('[apiCallManager] _extractLinksFromYjs: No structureBinding available');
            return { responseMessage: 'OK', links: [], totalLinks: 0 };
        }

        const links = [];
        const linkCounts = new Map(); // Track link occurrences by URL

        // Regex to find URLs in HTML content
        const urlRegex = /href=["']([^"']+)["']/gi;

        // Get all pages
        const pages = structureBinding.getPages() || [];

        for (const page of pages) {
            const pageId = page.id;
            const pageName = page.pageName || 'Page';

            // Get blocks for this page
            const blocks = structureBinding.getBlocks(pageId) || [];

            for (const block of blocks) {
                const blockName = block.blockName || '';

                // Get components for this block
                const components = structureBinding.getComponents(pageId, block.id) || [];

                for (const component of components) {
                    const htmlContent = component.htmlContent || '';
                    const ideviceType = component.ideviceType || '';
                    const order = component.order || 0;

                    // Find all href URLs
                    let match;
                    while ((match = urlRegex.exec(htmlContent)) !== null) {
                        const url = match[1];

                        // Skip internal anchors, asset URLs, and internal navigation links
                        if (url.startsWith('#') || url.startsWith('asset://') ||
                            url.startsWith('data:') || url.startsWith('blob:') ||
                            url.startsWith('javascript:') || url.startsWith('exe-node:')) {
                            continue;
                        }

                        // Track count for this URL
                        const count = (linkCounts.get(url) || 0) + 1;
                        linkCounts.set(url, count);

                        // Generate unique ID
                        const linkId = `link-${crypto.randomUUID().substring(0, 8)}`;

                        links.push({
                            id: linkId,
                            url: url,
                            count: count,
                            pageName: pageName,
                            blockName: blockName,
                            ideviceType: ideviceType.replace('Idevice', ''),
                            order: order,
                        });
                    }

                    // Reset regex lastIndex for next iteration
                    urlRegex.lastIndex = 0;
                }
            }
        }

        // Update counts in all links (same URL should show total count)
        for (const link of links) {
            link.count = linkCounts.get(link.url) || 1;
        }

        console.log('[apiCallManager] _extractLinksFromYjs: Found', links.length, 'links');
        return { responseMessage: 'OK', links, totalLinks: links.length };
    }

    /**
     * Get the URL for the link validation stream endpoint
     * Uses injected link validation adapter (server or static mode)
     * @returns {string|null}
     */
    getLinkValidationStreamUrl() {
        return this._linkValidation.getValidationStreamUrl();
    }

    /**
     * Get page broken links
     * Uses injected link validation adapter (server or static mode)
     * @param {*} pageId
     * @returns
     */
    async getOdePageBrokenLinks(pageId) {
        return this._linkValidation.getPageBrokenLinks(pageId);
    }

    /**
     * Get block broken links
     * Uses injected link validation adapter (server or static mode)
     * @param {*} blockId
     * @returns
     */
    async getOdeBlockBrokenLinks(blockId) {
        return this._linkValidation.getBlockBrokenLinks(blockId);
    }

    /**
     * Get iDevice broken links
     * Uses injected link validation adapter (server or static mode)
     * @param {*} ideviceId
     * @returns
     */
    async getOdeIdeviceBrokenLinks(ideviceId) {
        return this._linkValidation.getIdeviceBrokenLinks(ideviceId);
    }

    /**
     * Get ODE properties
     * Uses injected project repository (server or static mode)
     * @param {*} odeSessionId
     * @returns
     */
    async getOdeProperties(odeSessionId) {
        return this._projectRepo.getProperties(odeSessionId);
    }

    /**
     * Save ODE properties
     * Uses injected project repository (server or static mode)
     * @param {*} params
     * @returns
     */
    async putSaveOdeProperties(params) {
        return this._projectRepo.saveProperties(params);
    }

    /**
     * Get ODE session used files
     * Gets assets from Yjs AssetManager (always available)
     * @param {*} params
     * @returns {Promise<{usedFiles: Array}>}
     */
    async getOdeSessionUsedFiles(params) {
        return this._getUsedFilesFromYjs();
    }

    /**
     * Extract used files from Yjs document by scanning all content.
     * @private
     * @returns {Promise<{responseMessage: string, usedFiles: Array}>}
     */
    async _getUsedFilesFromYjs() {
        const projectManager = eXeLearning?.app?.project;
        const bridge = projectManager?._yjsBridge;
        const structureBinding = bridge?.structureBinding;
        const assetManager = bridge?.assetManager;

        if (!structureBinding) {
            console.warn('[apiCallManager] _getUsedFilesFromYjs: No structureBinding available');
            return { responseMessage: 'OK', usedFiles: [] };
        }

        const usedFiles = [];
        const seenAssets = new Set(); // Track unique assets
        const assetUsageMap = new Map(); // Track where each asset is used: assetId -> {pageName, blockName, ideviceType, order}

        // Regex to find asset URLs in HTML content
        const assetRegex = /asset:\/\/([a-f0-9-]+)/gi;

        // Step 1: Scan all content to find where each asset is used
        const pages = structureBinding.getPages() || [];
        console.log('[apiCallManager] _getUsedFilesFromYjs: Scanning', pages.length, 'pages for asset usage');

        for (const page of pages) {
            const pageId = page.id;
            const pageName = page.pageName || 'Page';

            // Get blocks for this page
            const blocks = structureBinding.getBlocks(pageId) || [];

            for (const block of blocks) {
                const blockName = block.blockName || '';

                // Get components for this block
                const components = structureBinding.getComponents(pageId, block.id) || [];

                for (const component of components) {
                    const ideviceType = component.ideviceType || '';
                    const order = component.order || 0;

                    // Access raw HTML content from Y.Map (before URL resolution)
                    // component._ymap contains the original Y.Map with asset:// URLs
                    let rawHtmlContent = '';
                    let rawJsonProperties = '';

                    if (component._ymap) {
                        const rawHtml = component._ymap.get('htmlContent');
                        if (rawHtml && typeof rawHtml.toString === 'function') {
                            rawHtmlContent = rawHtml.toString();
                        } else if (typeof rawHtml === 'string') {
                            rawHtmlContent = rawHtml;
                        }
                        // Also check htmlView as fallback
                        if (!rawHtmlContent) {
                            const htmlView = component._ymap.get('htmlView');
                            if (typeof htmlView === 'string') {
                                rawHtmlContent = htmlView;
                            }
                        }
                        // Check jsonProperties for assets too
                        const jsonProps = component._ymap.get('jsonProperties');
                        if (typeof jsonProps === 'string') {
                            rawJsonProperties = jsonProps;
                        }
                    }

                    // Combine htmlContent and jsonProperties for scanning
                    const contentToScan = rawHtmlContent + ' ' + rawJsonProperties;

                    // Find asset:// URLs and record their location
                    let match;
                    while ((match = assetRegex.exec(contentToScan)) !== null) {
                        const assetId = match[1];
                        // Only store first occurrence location
                        if (!assetUsageMap.has(assetId)) {
                            assetUsageMap.set(assetId, {
                                pageName,
                                blockName,
                                ideviceType: ideviceType.replace('Idevice', ''),
                                order,
                            });
                        }
                    }

                    // Reset regex lastIndex for next iteration
                    assetRegex.lastIndex = 0;
                }
            }
        }

        console.log('[apiCallManager] _getUsedFilesFromYjs: Found', assetUsageMap.size, 'assets referenced in content');

        // Step 2: Get all assets from AssetManager and combine with usage info
        if (assetManager) {
            try {
                const allAssets = assetManager.getAllAssetsMetadata?.() || [];
                console.log('[apiCallManager] _getUsedFilesFromYjs: Found', allAssets.length, 'total assets in AssetManager');

                for (const asset of allAssets) {
                    const assetId = asset.id || asset.uuid;
                    if (!assetId) continue;

                    const assetUrl = `asset://${assetId}`;
                    if (seenAssets.has(assetUrl)) continue;
                    seenAssets.add(assetUrl);

                    const fileName = asset.name || asset.filename || assetId.substring(0, 8) + '...';
                    const fileSize = asset.size ? this._formatFileSize(asset.size) : '';

                    // Get usage location if available
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

        // Step 3: Add any assets found in content but not in AssetManager (shouldn't happen normally)
        for (const [assetId, usage] of assetUsageMap.entries()) {
            const assetUrl = `asset://${assetId}`;
            if (seenAssets.has(assetUrl)) continue;
            seenAssets.add(assetUrl);

            // Try to get metadata from AssetManager
            let fileName = assetId.substring(0, 8) + '...';
            let fileSize = '';

            if (assetManager) {
                try {
                    const asset = await assetManager.getAsset(assetId);
                    if (asset) {
                        fileName = asset.name || asset.filename || fileName;
                        if (asset.blob?.size) {
                            fileSize = this._formatFileSize(asset.blob.size);
                        } else if (asset.size) {
                            fileSize = this._formatFileSize(asset.size);
                        }
                    }
                } catch (e) {
                    console.debug('[apiCallManager] Could not get asset metadata:', assetId, e);
                }
            }

            usedFiles.push({
                usedFiles: fileName,
                usedFilesPath: assetUrl,
                usedFilesSize: fileSize,
                pageNamesUsedFiles: usage.pageName,
                blockNamesUsedFiles: usage.blockName,
                typeComponentSyncUsedFiles: usage.ideviceType,
                orderComponentSyncUsedFiles: usage.order,
            });
        }

        console.log('[apiCallManager] _getUsedFilesFromYjs: Returning', usedFiles.length, 'assets total');
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
     * Download ODE export
     * Uses injected export adapter (server or static mode)
     *
     * @param {*} odeSessionId
     * @param {*} exportType
     * @returns
     */
    async getOdeExportDownload(odeSessionId, exportType) {
        return this._exportAdapter.downloadExport(odeSessionId, exportType);
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
     * Preview ODE export
     * Uses injected export adapter (server or static mode)
     *
     * @param {*} odeSessionId
     * @returns
     */
    async getOdePreviewUrl(odeSessionId) {
        return this._exportAdapter.getPreviewUrl(odeSessionId);
    }

    /**
     * Download iDevice/block content
     * Uses injected export adapter (server or static mode)
     *
     * @param {*} odeSessionId
     * @param {*} odeBlockId
     * @param {*} odeIdeviceId
     * @returns
     */
    async getOdeIdevicesDownload(odeSessionId, odeBlockId, odeIdeviceId) {
        return this._exportAdapter.downloadIDevice(odeSessionId, odeBlockId, odeIdeviceId);
    }

    /**
     * Force download file resources
     * Uses injected assets adapter (server or static mode)
     *
     * @param {*} resource
     * @returns
     */
    async getFileResourcesForceDownload(resource) {
        return this._assets.getDownloadUrl(resource);
    }

    /**
     * Save ODE
     * Uses injected project repository (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async postOdeSave(params) {
        const sessionId = params?.odeSessionId || window.eXeLearning?.odeSessionId;
        return this._projectRepo.save(sessionId, params);
    }

    /**
     * Autosave ODE
     * Uses injected project repository (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async postOdeAutosave(params) {
        const sessionId = params?.odeSessionId || window.eXeLearning?.odeSessionId;
        return this._projectRepo.autoSave(sessionId, params);
    }

    /**
     * Save ODE as new file
     * Uses injected project repository (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async postOdeSaveAs(params) {
        const sessionId = params?.odeSessionId || window.eXeLearning?.odeSessionId;
        return this._projectRepo.saveAs(sessionId, params);
    }

    /**
     * Upload new ELP to first type platform
     * Uses injected platform integration adapter (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async postFirstTypePlatformIntegrationElpUpload(params) {
        return this._platformIntegration.uploadElp(params);
    }

    /**
     * Open ELP from platform
     * Uses injected platform integration adapter (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async platformIntegrationOpenElp(params) {
        return this._platformIntegration.openElp(params);
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
        return this._collaboration.obtainBlockSync(params);
    }

    /**
     * Get all translations
     * Uses injected catalog adapter (server or static mode)
     *
     * @returns
     */
    async getTranslationsAll() {
        const locales = await this._catalog.getLocales();
        const localeCodes = Array.isArray(locales)
            ? locales.map(l => l.code || l)
            : ['en'];
        return {
            locales: localeCodes,
            packageLocales: localeCodes,
            defaultLocale: 'en',
        };
    }

    /**
     * Get translations
     * Uses injected catalog adapter (server or static mode)
     *
     * @param {*} locale
     * @returns
     */
    async getTranslations(locale) {
        return this._catalog.getTranslations(locale);
    }

    /**
     * Get login URL of Google Drive
     * Uses injected cloud storage adapter (server or static mode)
     *
     * @returns
     */
    async getUrlLoginGoogleDrive() {
        return this._cloudStorage.getGoogleDriveLoginUrl();
    }

    /**
     * Get folders of Google Drive account
     * Uses injected cloud storage adapter (server or static mode)
     *
     * @returns
     */
    async getFoldersGoogleDrive() {
        return this._cloudStorage.getGoogleDriveFolders();
    }

    /**
     * Upload file to Google Drive
     * Uses injected cloud storage adapter (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async uploadFileGoogleDrive(params) {
        return this._cloudStorage.uploadToGoogleDrive(params);
    }

    /**
     * Get login URL of Dropbox
     * Uses injected cloud storage adapter (server or static mode)
     *
     * @returns
     */
    async getUrlLoginDropbox() {
        return this._cloudStorage.getDropboxLoginUrl();
    }

    /**
     * Get folders of Dropbox account
     * Uses injected cloud storage adapter (server or static mode)
     *
     * @returns
     */
    async getFoldersDropbox() {
        return this._cloudStorage.getDropboxFolders();
    }

    /**
     * Upload file to Dropbox
     * Uses injected cloud storage adapter (server or static mode)
     *
     * @param {*} params
     * @returns
     */
    async uploadFileDropbox(params) {
        return this._cloudStorage.uploadToDropbox(params);
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

        // Check if endpoint is available
        const endpoint = this.endpoints?.api_idevices_list_by_page;
        if (!endpoint?.path) {
            console.warn('[apiCallManager] getComponentsByPage: Endpoint not available, returning empty structure');
            return {
                id: odeNavStructureSyncId,
                odePageId: odeNavStructureSyncId,
                pageName: 'Page',
                odePagStructureSyncs: []
            };
        }

        let url = endpoint.path;
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
     * Get HTML template of iDevice
     * Uses injected catalog adapter (server or static mode)
     *
     * @param {*} odeNavStructureSyncId
     * @returns
     */
    async getComponentHtmlTemplate(odeNavStructureSyncId) {
        return this._catalog.getComponentHtmlTemplate(odeNavStructureSyncId);
    }

    /**
     * Get iDevice HTML saved
     * Uses injected catalog adapter (server or static mode)
     *
     * @param {*} odeComponentsSyncId
     * @returns
     */
    async getSaveHtmlView(odeComponentsSyncId) {
        return this._catalog.getSaveHtmlView(odeComponentsSyncId);
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
        // Use injected content adapter if available (new pattern)
        if (this._content) {
            try {
                return await this._content.reorderIdevice(params);
            } catch (error) {
                console.error('[API] putReorderIdevice via content adapter error:', error);
            }
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
        // Use injected content adapter if available (new pattern)
        if (this._content) {
            try {
                return await this._content.reorderBlock(params);
            } catch (error) {
                console.error('[API] putReorderBlock via content adapter error:', error);
            }
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
        // Use injected content adapter if available (new pattern)
        if (this._content) {
            try {
                return await this._content.deleteBlock(blockId);
            } catch (error) {
                console.error('[API] deleteBlock via content adapter error:', error);
            }
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
        // Use injected content adapter if available (new pattern)
        if (this._content) {
            try {
                return await this._content.savePage(params);
            } catch (error) {
                console.error('[API] putSavePage via content adapter error:', error);
            }
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
        // Use injected content adapter if available (new pattern)
        if (this._content) {
            try {
                return await this._content.reorderPage(params);
            } catch (error) {
                console.error('[API] putReorderPage via content adapter error:', error);
            }
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
        // Use injected content adapter if available (new pattern)
        if (this._content) {
            try {
                return await this._content.clonePage(params);
            } catch (error) {
                console.error('[API] postClonePage via content adapter error:', error);
            }
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
        // Use injected content adapter if available (new pattern)
        if (this._content) {
            try {
                return await this._content.deletePage(pageId);
            } catch (error) {
                console.error('[API] deletePage via content adapter error:', error);
            }
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
        // Use injected assets adapter if available (new pattern)
        if (this._assets && params.file && params.projectId) {
            try {
                const result = await this._assets.upload(params.projectId, params.file, params.path || '');
                return { responseMessage: 'OK', ...result };
            } catch (error) {
                console.error('[API] postUploadFileResource via adapter error:', error);
                return { responseMessage: 'ERROR', error: error.message };
            }
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
        // Use injected assets adapter if available (new pattern)
        if (this._assets && params.file && params.projectId) {
            try {
                const result = await this._assets.upload(params.projectId, params.file, params.path || '');
                return { responseMessage: 'OK', ...result };
            } catch (error) {
                console.error('[API] postUploadLargeFileResource via adapter error:', error);
                return { responseMessage: 'ERROR', error: error.message };
            }
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
        // Generic API calls are server-only (no adapter pattern for this)
        // In static mode, endpoints won't be available so this will fail gracefully
        if (!this.endpoints[endpointId]) {
            console.warn('[apiCallManager] Endpoint not found:', endpointId);
            return { responseMessage: 'NOT_SUPPORTED' };
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
        // Use injected catalog adapter if available (new pattern)
        if (this._catalog) {
            try {
                return await this._catalog.getIdevicesBySessionId(odeSessionId);
            } catch (error) {
                console.error('[API] getIdevicesBySessionId via catalog adapter error:', error);
            }
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
        // Use injected sharing adapter if available (new pattern)
        if (this._sharing) {
            try {
                return await this._sharing.getProject(projectId);
            } catch (error) {
                console.error('[API] getProject via adapter error:', error);
            }
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
     * Uses injected sharing adapter (server or static mode)
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {string} visibility - 'public' or 'private'
     * @returns {Promise<Object>} Response with updated project
     */
    async updateProjectVisibility(projectId, visibility) {
        return this._sharing.updateVisibility(projectId, visibility);
    }

    /**
     * Add a collaborator to a project
     * Uses injected sharing adapter (server or static mode)
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {string} email - The collaborator's email
     * @param {string} role - The role (optional, default 'editor')
     * @returns {Promise<Object>} Response
     */
    async addProjectCollaborator(projectId, email, role = 'editor') {
        return this._sharing.addCollaborator(projectId, email, role);
    }

    /**
     * Remove a collaborator from a project
     * Uses injected sharing adapter (server or static mode)
     *
     * @param {number|string} projectId - The project ID or UUID
     * @param {number} userId - The collaborator's user ID
     * @returns {Promise<Object>} Response
     */
    async removeProjectCollaborator(projectId, userId) {
        return this._sharing.removeCollaborator(projectId, userId);
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
        // Use injected sharing adapter if available (new pattern)
        if (this._sharing) {
            try {
                return await this._sharing.transferOwnership(projectId, newOwnerId);
            } catch (error) {
                console.error(
                    '[API] transferProjectOwnership via adapter error:',
                    error
                );
            }
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

import ProjectProperties from './properties/projectProperties.js';
import IdevicesEngine from './idevices/idevicesEngine.js';
import StructureEngine from './structure/structureEngine.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class projectManager {
    constructor(app) {
        this.app = app;
        this.properties = new ProjectProperties(this);
        this.idevices = new IdevicesEngine(this);
        this.structure = new StructureEngine(this);
        this.offlineInstallation = eXeLearning.config.isOfflineInstallation;
        this.clientIntervalUpdate = eXeLearning.config.clientIntervalUpdate;
        this.syncIntervalTime = 250;

        // Collaborative
        this.activeLocks = new Map(); // Map<pageId, { user, gravatar }>

        // Yjs collaborative editing
        this._yjsEnabled = false;
        this._yjsBridge = null;
        this._yjsBindings = new Map(); // TinyMCE bindings by componentId
    }

    /**
     *
     */
    async load() {
        Logger.log('public/app/workarea/project/projectManager.js: load');
        // Api params
        await this.loadCurrentProject();
        // Load project properties
        await this.loadProjectProperties();
        this.app.locale.loadContentTranslationsStrings(
            this.properties.properties.pp_lang.value
        );
        // Compose and initialized interface
        await this.loadInterface();

        // Initialize Yjs collaborative editing BEFORE loading structure
        // This ensures Yjs is the source of truth for document structure
        await this.initializeYjs();

        // Load project visibility for share button
        if (this.app.interface?.shareButton) {
            this.app.interface.shareButton.loadVisibilityFromProject();
        }

        // Load structure data (from Yjs if enabled, otherwise from API)
        await this.loadStructureData();

        // Subscribe structure to Yjs changes if enabled
        if (this._yjsEnabled && this.structure) {
            this.structure.subscribeToYjsChanges();
        }

        // Initialized menus
        await this.loadMenus();
        // Load modals content
        await this.loadModalsContent();
        // Behaviour of idevices in menu and content
        this.ideviceEngineBehaviour();
        // Legacy idevice functions
        this.compatibilityLegacy();
        // Initialize
        await this.initialiceProject();
        // Show workarea of app
        this.showScreen();

        // Static mode: check for pending file import
        const capabilities = this.app?.capabilities;
        if (!capabilities?.storage?.remote && window.__pendingImportFile) {
            Logger.log('[ProjectManager] Found pending import file, importing...');
            const file = window.__pendingImportFile;
            window.__pendingImportFile = null; // Clear it
            this.importElp(file).catch(err => {
                console.error('[ProjectManager] Failed to import pending file:', err);
            });
        }

        // Call the function to execute sorting and reordering
        //this.sortBlocksById(true);
        // Set offline atributtes
        this.setInstallationTypeAttribute();
        // Run autosave (disabled when Yjs is enabled - it auto-saves)
        if (!this._yjsEnabled) {
            this.generateIntervalAutosave();
        }
        // Run check ode updates
        //this.generateIntervalCheckOdeUpdates();
        //Remove previous autosaves
        this.cleanPreviousAutosaves();

        if (!this.offlineInstallation) {
            await this.subscribeToSessionAndNotify();
        }
    }

    /**
     * Initialize Yjs collaborative editing system
     * This enables real-time collaboration when Yjs modules are loaded
     * Project ID comes from URL (?project=<id>) set by backend
     */
    async initializeYjs() {
        // Check if Yjs modules are available
        if (!window.YjsLoader && !window.YjsModules) {
            Logger.log('[ProjectManager] Yjs not available, using legacy mode');
            return;
        }

        try {
            // Load Yjs modules if loader is available
            if (window.YjsLoader && !window.YjsModules?.YjsProjectBridge) {
                Logger.log('[ProjectManager] Loading Yjs modules...');
                await window.YjsLoader.load();
            }

            // Apply mixin if not already applied
            if (window.YjsProjectManagerMixin && !this.enableYjsMode) {
                window.YjsProjectManagerMixin.applyMixin(this);
            }

            // Get auth token (optional - enables collaborative mode)
            const authToken = this.app?.auth?.getToken?.() ||
                              eXeLearning?.config?.token ||
                              localStorage.getItem('authToken');

            // Determine if we should use local-only mode (no WebSocket sync)
            // Note: WebSocket works without auth in development - offline mode only for explicit offline installations
            const localOnlyMode = this.offlineInstallation === true;

            if (localOnlyMode) {
                Logger.log('[ProjectManager] Yjs local-only mode (offline installation)');
            } else {
                Logger.log('[ProjectManager] Yjs collaborative mode (WebSocket + IndexedDB)');
            }

            // Get project ID - should already be set by loadCurrentProject()
            // from URL parameter (?project=<id>)
            const projectId = this.yjsProjectId || window.eXeLearning?.projectId;

            if (!projectId) {
                console.error('[ProjectManager] No project ID available - this should not happen');
                console.error('[ProjectManager] Make sure to access workarea via /workarea?project=<id>');
                return;
            }

            // Store project ID for reference
            this.yjsProjectId = projectId;

            // Detect if this is a newly created project (from URL parameter &new=1)
            const urlParams = new URLSearchParams(window.location.search);
            const isNewProject = urlParams.get('new') === '1';

            // Enable Yjs mode
            if (this.enableYjsMode) {
                Logger.log('[ProjectManager] Enabling Yjs mode for project:', projectId, isNewProject ? '(new)' : '(existing)');
                await this.enableYjsMode(projectId, authToken, {
                    treeContainerId: 'structure-menu-nav',
                    enableWebSocket: !localOnlyMode,  // Only enable WebSocket with auth
                    enableIndexedDB: true,
                    offline: localOnlyMode,
                    isNewProject: isNewProject,  // Skip server load for new projects
                });
                Logger.log('[ProjectManager] Yjs collaborative editing enabled');

                // Clean up URL parameter after use (cleaner URL, but preserve jwt_token for platform integration)
                if (isNewProject) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const jwtToken = urlParams.get('jwt_token');
                    let cleanUrl = window.location.pathname + '?project=' + projectId;
                    if (jwtToken) {
                        cleanUrl += '&jwt_token=' + encodeURIComponent(jwtToken);
                    }
                    window.history.replaceState({}, '', cleanUrl);
                }

                // Check if we need to import an ELP file
                await this.checkAndImportElp();
            }
        } catch (error) {
            console.warn('[ProjectManager] Failed to initialize Yjs:', error);
            // Continue with legacy mode
        }
    }

    /**
     * Reinitialize Yjs with a new project (without page reload)
     * Used when opening a new ELP file to switch to a different project
     * @param {string} projectUuid - The new project UUID
     * @param {Object} options - Options
     * @param {boolean} options.isNewProject - Skip server load for new projects
     */
    async reinitializeWithProject(projectUuid, options = {}) {
        Logger.log('[ProjectManager] Reinitializing with new project:', projectUuid);

        // Disconnect existing Yjs connection if present
        if (this._yjsBridge) {
            Logger.log('[ProjectManager] Disconnecting existing Yjs bridge...');
            try {
                await this._yjsBridge.disconnect();
            } catch (err) {
                console.warn('[ProjectManager] Error disconnecting Yjs:', err);
            }
            this._yjsBridge = null;
        }

        // Clear existing Yjs bindings
        this._yjsBindings.clear();

        // Update project ID FIRST (before resetProject which may trigger observers)
        this.yjsProjectId = projectUuid;
        window.eXeLearning.projectId = projectUuid;
        this.odeId = projectUuid;

        // Reinitialize Yjs BEFORE resetProject (so Yjs bindings work)
        const YjsProjectBridge = window.YjsModules?.YjsProjectBridge;
        if (!YjsProjectBridge) {
            throw new Error('YjsProjectBridge not available');
        }

        // Get auth token
        const authToken = this.app?.auth?.getToken?.() ||
                          eXeLearning?.config?.token ||
                          localStorage.getItem('authToken');

        // Determine mode
        const localOnlyMode = this.offlineInstallation === true;

        // Create new bridge (constructor takes app, not projectId)
        this._yjsBridge = new YjsProjectBridge(this.app);

        // Initialize the bridge with projectUuid
        await this._yjsBridge.initialize(projectUuid, authToken, {
            enableWebSocket: !localOnlyMode,
            enableIndexedDB: true,
            offline: localOnlyMode,
            isNewProject: options.isNewProject,
            skipSyncWait: options.skipSyncWait ?? false,
        });

        this._yjsEnabled = true;
        Logger.log('[ProjectManager] Yjs reinitialized for project:', projectUuid);

        // Reset project state AFTER Yjs is initialized (structure loading needs Yjs)
        Logger.log('[ProjectManager] About to call resetProject...');
        this.resetProject();
        Logger.log('[ProjectManager] resetProject completed, reinitializeWithProject returning');
    }

    /**
     * Import an ELP file directly (file already in memory)
     * @param {File} file - The ELP file to import
     * @param {Object} options - Import options
     * @param {Function} options.onProgress - Progress callback function
     * @returns {Promise<Object>} - Import statistics
     */
    async importElpDirectly(file, options = {}) {
        Logger.log('[ProjectManager] Importing ELP directly from memory:', file.name);

        if (!this._yjsBridge) {
            throw new Error('Yjs bridge not initialized');
        }

        // Use centralized import method (handles asset announcement)
        // Pass options through to allow onProgress callback
        const stats = await this.importFromElpxViaYjs(file, options);

        Logger.log('[ProjectManager] Direct import complete:', stats);

        // Save to server
        try {
            await this._yjsBridge.documentManager.saveToServer();
            Logger.log('[ProjectManager] Document saved to server after direct import');
        } catch (saveError) {
            console.warn('[ProjectManager] Failed to save to server:', saveError);
        }

        return stats;
    }

    /**
     * Refresh UI after a direct ELP import or new project creation
     * This is a lightweight refresh that doesn't clear Yjs data
     * Used instead of openLoad() to preserve imported content
     */
    async refreshAfterDirectImport() {
        Logger.log('[ProjectManager] Refreshing UI after direct import...');

        // Close any open modals
        eXeLearning.app.modals.openuserodefiles.close();

        // Reload structure menu from Yjs (without API call)
        // Structure is already in Yjs, just need to render it
        if (this.structure) {
            // Get fresh data from Yjs and reload the menu
            if (this.structure.isYjsEnabled && this.structure.isYjsEnabled()) {
                const structureData = this.structure.getStructureFromYjs();
                Logger.log('[ProjectManager] Structure data from Yjs:', structureData?.length, 'pages');
                this.structure.processStructureData(structureData);
            }
            await this.structure.reloadStructureMenu();
        }

        // Update title from properties in Yjs
        if (this.app?.interface?.odeTitleElement) {
            this.app.interface.odeTitleElement.setTitle();
        }

        // Reload properties form if open
        if (this.properties) {
            this.properties.loadPropertiesFromYjs();
        }

        // Select first page and load its content
        await this.initialiceProject();

        // Show workarea
        this.showScreen();

        Logger.log('[ProjectManager] UI refreshed after direct import');
    }

    /**
     * Check URL for import parameter and import ELP file if present
     * Uses ElpxImporter to import the ELP content into the Yjs document
     *
     * Server-side mode: &import=/path/to/file.elp - fetches file from server
     * (Client-side import now uses direct in-memory processing via reinitializeWithProject)
     */
    async checkAndImportElp() {
        const urlParams = new URLSearchParams(window.location.search);
        const importPath = urlParams.get('import');

        if (!importPath) {
            Logger.log('[ProjectManager] No import parameter found');
            return;
        }

        Logger.log('[ProjectManager] Import parameter detected:', importPath);

        try {
            // Show loading indicator
            if (this.app?.modals?.loader) {
                this.app.modals.loader.show({ message: _('Importing project...') });
            }

            // Add basePath to import path if it starts with / (relative server path)
            const basePath = window.eXeLearning?.config?.basePath || '';
            const fetchPath = importPath.startsWith('/') && basePath && !importPath.startsWith(basePath)
                ? `${basePath}${importPath}`
                : importPath;

            // Fetch the ELP file from the server
            const response = await fetch(fetchPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch ELP file: ${response.statusText}`);
            }

            const blob = await response.blob();
            const fileName = importPath.split('/').pop() || 'imported.elp';
            const file = new File([blob], fileName, { type: 'application/octet-stream' });

            Logger.log('[ProjectManager] ELP file fetched, size:', file.size);

            // Use centralized import method (handles asset announcement)
            const stats = await this.importFromElpxViaYjs(file);

            Logger.log('[ProjectManager] ELP import complete:', stats);

            // Save to server so other users can access the document
            try {
                await this._yjsBridge.documentManager.saveToServer();
                Logger.log('[ProjectManager] Document saved to server after import');
            } catch (saveError) {
                console.warn('[ProjectManager] Failed to save to server after import:', saveError);
                // Continue anyway - data is at least saved locally
            }

            // Remove import parameter from URL (keep project parameter)
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('import');
            window.history.replaceState({}, '', newUrl);

            // Cleanup: Request server to delete temp file
            try {
                await fetch(`${basePath}/api/project/cleanup-import?path=${encodeURIComponent(importPath)}`, {
                    method: 'DELETE'
                });
            } catch (cleanupError) {
                console.warn('[ProjectManager] Failed to cleanup temp file:', cleanupError);
            }

            // Hide loading indicator
            if (this.app?.modals?.loader) {
                this.app.modals.loader.hide();
            }

            // Show success message
            if (stats.pages > 0) {
                Logger.log(`[ProjectManager] Successfully imported ${stats.pages} pages, ${stats.blocks} blocks, ${stats.components} components`);
            }
        } catch (error) {
            console.error('[ProjectManager] Failed to import ELP:', error);

            // Hide loading indicator
            if (this.app?.modals?.loader) {
                this.app.modals.loader.hide();
            }

            // Show error message
            if (this.app?.modals?.alert) {
                this.app.modals.alert.show({
                    title: _('Import Error'),
                    body: _('Failed to import the project: ') + error.message,
                    contentId: 'error',
                });
            }
        }
    }

    /**
     * Generate a new unique project ID
     * @returns {string}
     */
    generateProjectId() {
        // Generate a UUID-like ID
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Update the URL with the project ID without reloading
     * @param {string} projectId
     */
    updateUrlWithProjectId(projectId) {
        const url = new URL(window.location);
        url.searchParams.set('project', projectId);
        window.history.replaceState({}, '', url);
    }

    /**
     * Generate a numeric project ID from session string
     * @returns {number|null}
     */
    getNumericProjectId() {
        if (!this.odeSession) return null;
        // Hash the session string to get a numeric ID
        let hash = 0;
        for (let i = 0; i < this.odeSession.length; i++) {
            const char = this.odeSession.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    /**
     * Reset project state and clear DOM before loading new content
     * This ensures a clean slate when creating new projects or opening files
     */
    resetProject() {
        Logger.log('[ProjectManager] Resetting project - clearing all previous state');

        // IMPORTANT: Flag to force structure import from API on next load
        // This ensures Yjs gets fresh data instead of stale cached data
        this._forceStructureImport = true;

        // Clear Yjs navigation if bridge exists (remove stale data)
        if (this._yjsBridge?.clearNavigation) {
            Logger.log('[ProjectManager] Clearing Yjs navigation...');
            this._yjsBridge.clearNavigation();
        }

        // Reset project state (dirty flag, session IDs)
        Logger.log('[ProjectManager] Resetting projectState...');
        if (window.eXeLearning?.app?.projectState) {
            window.eXeLearning.app.projectState.reset();
        }
        Logger.log('[ProjectManager] ProjectState reset done');

        // CRITICAL: Clear navigation tree DOM first
        // This ensures old nodes are removed even if the structure engine fails
        const navTree = document.querySelector('#structure-menu-nav');
        if (navTree) {
            Logger.log('[ProjectManager] Clearing navigation tree DOM...');
            navTree.innerHTML = '';
        }

        // Clear structure menu (navigation tree) via engine
        if (this.app.menus?.menuStructure?.menuStructureCompose?.structureEngine) {
            try {
                this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetDataAndStructureData(
                    'reset'
                );
            } catch (error) {
                console.warn('[ProjectManager] Error resetting structure menu:', error);
            }
        }

        // Clear selected node
        if (this.app.menus?.menuStructure?.menuStructureBehaviour) {
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = false;
        }

        // Clear content area iDevices
        const contentArea = document.querySelector('#exe-content-area');
        if (contentArea) {
            Logger.log('[ProjectManager] Clearing content area...');
            contentArea.innerHTML = '';
        }

        // Clear iDevice panels area
        const idevicePanels = document.querySelector('#exe-idevice-panels');
        if (idevicePanels) {
            Logger.log('[ProjectManager] Clearing iDevice panels...');
            idevicePanels.innerHTML = '';
        }

        // Clear project properties form if open
        if (this.properties?.formProperties) {
            this.properties.formProperties.remove();
        }

        Logger.log('[ProjectManager] ✓ Project reset complete - ready for new content');
    }

    /**
     * Open and load project
     * Now calls resetProject() first to ensure clean state
     */
    async openLoad() {
        Logger.log('public/app/workarea/project/projectManager.js:openLoad');

        // IMPORTANT: Reset project first to clear all previous state
        this.resetProject();

        // Close window open elp in case of new elp
        eXeLearning.app.modals.openuserodefiles.close();
        // Load user data
        await this.loadUser();
        // Show loading screen
        this.app.interface.loadingScreen.show();
        // Load project properties
        await this.loadProjectProperties();
        // Load structure data
        await this.loadStructureData();
        // Load title
        this.app.interface.odeTitleElement.setTitle();
        // Initialized menus
        this.properties.formProperties.remove();
        this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = false;
        await this.structure.reloadStructureMenu();
        // Load modals content
        await this.loadModalsContent();
        // Initialize
        await this.initialiceProject();
        // Show workarea of app
        this.showScreen();
        // Set offline atributtes
        this.setInstallationTypeAttribute();
        // Run autosave
        this.generateIntervalAutosave(true);

        if (!this.offlineInstallation) {
            await this.subscribeToSessionAndNotify();
        }
    }

    /**
     *
     * @param {*} pageid
     */
    async updateUserPage(pageid, forceLoad = false) {
        // Collaborative
        // Get page position
        let scroll = document.querySelector('.template-page');
        let scrollPos;
        if (scroll !== null) {
            scrollPos = document.querySelector('.template-page').scrollTop;
        } else {
            scrollPos = document.querySelector(
                '#node-content-container'
            ).scrollTop;
        }
        // Collaborative Init
        // Load structure data
        await this.loadStructureData();
        // Load modals content
        await this.loadModalsContent();
        if (forceLoad)
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected = false;
        await this.structure.reloadStructureMenu(pageid);
        await this.initialiceProject();
        // Collaborative End
        // Move to page location
        if (scroll !== null) {
            document.querySelector('.template-page').scrollTo(0, scrollPos);
        } else {
            document
                .querySelector('#node-content-container')
                .scrollTo(0, scrollPos);
        }
    }

    cleanupCurrentIdeviceTimer() {
        if (this.idevices?.cleanupCurrentIdeviceTimer) {
            return this.idevices.cleanupCurrentIdeviceTimer();
        }
    }

    getTimeIdeviceEditing() {
        if (this.idevices?.getTimeIdeviceEditing) {
            return this.idevices.getTimeIdeviceEditing();
        }
    }

    getEditUnlockDevice() {
        if (this.idevices?.getEditUnlockDevice) {
            return this.idevices.getEditUnlockDevice();
        }
    }

    lockPageContent(user, pageId, timeIdeviceEditing) {
        const targetBlock = document.querySelector(
            `[node-selected="${pageId}"]`
        );
        if (!targetBlock) return false;

        // Relative position
        if (getComputedStyle(targetBlock).position === 'static') {
            targetBlock.style.position = 'relative';
        }

        // Locking overlay
        const overlay = document.createElement('div');
        const messageBox = document.createElement('div');
        const description = document.createElement('div');
        const emailElement = document.createElement('div');
        const lockTime = document.createElement('div');

        overlay.className = 'user-editing-overlay';
        messageBox.className = 'user-editing-message';
        description.className = 'user-editing-description';
        emailElement.className = 'user-editing-email';
        lockTime.className = 'user-editing-time';

        description.textContent = _('This page is being edited by:');
        emailElement.textContent = user;

        const dateMilis = new Date(Number(timeIdeviceEditing));
        const hours = String(dateMilis.getHours()).padStart(2, '0');
        const minutes = String(dateMilis.getMinutes()).padStart(2, '0');
        const seconds = String(dateMilis.getSeconds()).padStart(2, '0');

        lockTime.textContent = `${_('at')} ${hours}:${minutes}:${seconds}`;

        messageBox.appendChild(description);
        messageBox.appendChild(emailElement);
        messageBox.appendChild(lockTime);

        overlay.appendChild(messageBox);
        targetBlock.prepend(overlay);
        targetBlock.classList.add('editing-article', 'article-disabled');
        this.lockIdevices();

        return true;
    }

    collaborativePageLock(
        user,
        pageId,
        collaborativeMode,
        timeIdeviceEditing = null
    ) {
        this.clearUserLocks(user); // Clear previous state

        let lockTime = timeIdeviceEditing;

        if (!lockTime) {
            const existingLock = this.activeLocks.get(pageId);
            // Locktime same as user
            if (existingLock && existingLock.user === user) {
                lockTime = existingLock.lockTime;
            }
        }

        const pageLocked = document.querySelector(`[page-id="${pageId}"]`);

        if (!pageLocked) return;

        const buttons = pageLocked.querySelectorAll(
            ':scope > button, :scope > .nav-element-text'
        );

        if (collaborativeMode === 'page') {
            buttons.forEach((button) => {
                button.disabled = true;
                button.style.cursor = 'not-allowed';
                button.style.opacity = '0.5';
                button.setAttribute(
                    'title',
                    _('This page is being edited by:') + ' ' + `${user}`
                );
                let settingButton = button.querySelector('.node-menu-button');
                settingButton.style.cursor = 'not-allowed';
                settingButton.style.pointerEvents = 'none';
            });
        }

        const concurrentUsers =
            eXeLearning.app.interface.concurrentUsers.getConcurrentUsersElementsList();
        const dragOverBorder = pageLocked.querySelector('.drag-over-border');
        const userGravatar = Array.from(concurrentUsers).find(
            (e) => e.dataset.username.toLowerCase() === user.toLowerCase()
        );
        userGravatar.classList.add('user-inpage');
        userGravatar.querySelector('.username').remove();

        if (dragOverBorder && userGravatar) {
            // Clone Gravatar to avoid duplicate DOM issues
            const gravatarClone = userGravatar.cloneNode(true);
            gravatarClone
                .querySelector('.exe-gravatar')
                .setAttribute('height', '30px');
            gravatarClone
                .querySelector('.exe-gravatar')
                .setAttribute('width', '30px');
            dragOverBorder.appendChild(gravatarClone);

            // Save blocking by page and user
            this.activeLocks.set(pageId, {
                user,
                gravatar: gravatarClone,
                originalGravatar: userGravatar,
                lockTime: timeIdeviceEditing,
            });
        }
        if (collaborativeMode === 'page') {
            this.lockPageContent(user, pageId, timeIdeviceEditing);
        }
    }

    clearUserLocks(user) {
        this.unlockIdevices();

        // Find all pages blocked by this user
        for (let [pageId, lockInfo] of this.activeLocks.entries()) {
            if (lockInfo.user === user) {
                this.clearPageLock(pageId);
            }
        }
    }

    lockIdevices() {
        const idevicesMenu = document.querySelector('#idevices-bottom');
        idevicesMenu.classList.add('disabled');
        idevicesMenu.querySelectorAll('.idevice_item').forEach((el) => {
            el.setAttribute('tabindex', '-1');
            el.addEventListener('keydown', (e) => e.preventDefault());
        });
        const listMenuIdevices = document.querySelector('#list_menu_idevices');
        listMenuIdevices.classList.add('disabled');
        idevicesMenu.querySelectorAll('.idevice_category').forEach((el) => {
            el.setAttribute('tabindex', '-1');
            el.addEventListener('keydown', (e) => e.preventDefault());
        });
    }

    unlockIdevices() {
        const idevicesMenu = document.querySelector('#idevices-bottom');
        idevicesMenu.classList.remove('disabled');
        idevicesMenu.querySelectorAll('.idevice_item').forEach((el) => {
            el.removeAttribute('tabindex');
            el.removeEventListener('keydown', (e) => e.preventDefault());
        });
        const listMenuIdevices = document.querySelector('#list_menu_idevices');
        listMenuIdevices.classList.remove('disabled');
        idevicesMenu.querySelectorAll('.idevice_category').forEach((el) => {
            el.removeAttribute('tabindex');
            el.removeEventListener('keydown', (e) => e.preventDefault());
        });
    }

    clearPageLock(pageId) {
        this.unlockIdevices();
        const lockInfo = this.activeLocks.get(pageId);
        if (!lockInfo) return;

        const { user, gravatar } = lockInfo;

        // Find previously blocked page
        const pageElement = document.querySelector(`[page-id="${pageId}"]`);

        if (pageElement) {
            pageElement.removeAttribute('title'); // Remove tooltip

            // Re-enable buttons
            const buttons = pageElement.querySelectorAll(
                ':scope > button, :scope > .nav-element-text'
            );
            buttons.forEach((button) => {
                button.disabled = false;
                button.style.cursor = 'inherit';
                button.style.opacity = '1';
                button.setAttribute(
                    'title',
                    button.querySelector('.node-text-span').textContent
                );
                let settingButton = button.querySelector('.node-menu-button');
                settingButton.style.cursor = 'inherit';
                settingButton.style.pointerEvents = 'auto';
            });

            // Remove gravatar
            const dragOverBorder =
                pageElement.querySelector('.drag-over-border');
            if (
                dragOverBorder &&
                gravatar &&
                dragOverBorder.contains(gravatar)
            ) {
                dragOverBorder.removeChild(gravatar);
            }
        }

        this.activeLocks.delete(pageId); // Clear record
    }

    /*
    // Clear all locks (useful for reset)
    clearAllLocks() {
        for (let [pageId] of this.activeLocks.entries()) {
            this.clearPageLock(pageId);
        }
    }

    // Method when user disconnects
    userDisconnected(user) {
        this.clearUserLocks(user);
    }

    // Get active lock information
    getActiveLocks() {
        return Array.from(this.activeLocks.entries());
    }
    */

    /**
     * Handles the editing overlay for blocks with countdown
     * @param {string} messageContent - Raw message content from server
     * @param {string} currentUser - Email of the current user
     */
    handleBlockEditingOverlay(messageContent, currentUser) {
        // Parse all message parameters
        const params = {};
        messageContent.split(',').forEach((pair) => {
            const [key, value] = pair.split(':');
            params[key] = value;
        });

        const user = params['user'];
        const isNotSameEmail = (user && user !== currentUser) ?? false;

        const pageId = params['pageId'] ?? ''; // Collaborative
        const actionType = params['actionType'] ?? '';
        const collaborativeMode = params['collaborativeMode'] ?? '';

        const unlockKeywords = ['FORCE_UNLOCK', 'HIDE_UNLOCK_BUTTON'];

        const isOdeComponentFlag = params['odeComponentFlag'] === 'true';
        const shouldUnlock = unlockKeywords.some((keyword) =>
            actionType?.includes(keyword)
        );
        const isEditingOrInactive =
            actionType?.includes('EDIT') || shouldUnlock || isOdeComponentFlag;

        if (!pageId) return;

        const blockId = params['blockId'];
        let targetBlock;
        if (collaborativeMode === 'page') {
            targetBlock = document.getElementById(blockId)?.parentElement;
        } else {
            targetBlock = document.getElementById(blockId);
        }

        const existingOverlay =
            targetBlock?.querySelector('.user-editing-overlay') ?? null;

        if (isEditingOrInactive && isNotSameEmail) {
            const timeIdevice =
                this.idevices?.ideviceActive?.timeIdeviceEditing;
            const timeIdeviceEditing =
                timeIdevice ?? this.getTimeIdeviceEditing();
            this.collaborativePageLock(
                user,
                pageId,
                collaborativeMode,
                timeIdeviceEditing
            );
        } else if (actionType === 'UNDO_IDEVICE') {
            this.clearPageLock(pageId);

            if (existingOverlay) {
                targetBlock.classList.remove(
                    'editing-article',
                    'article-disabled'
                );
                existingOverlay.remove();
            }
        }

        if (
            actionType === 'collaborative-page-lock' &&
            collaborativeMode === 'page'
        ) {
            if (user && user !== currentUser) {
                this.collaborativePageLock(user, pageId, collaborativeMode);
            }
            return;
        }

        if (actionType === 'SAVE_BLOCK') {
            this.clearPageLock(pageId);
        }

        if (
            !blockId ||
            blockId === 'none' ||
            !targetBlock ||
            user === currentUser
        )
            return;

        const elementId = params['elementId'];
        const odeIdeviceId = params['odeIdeviceId'];
        const timeIdeviceEditing = params['timeIdeviceEditing'] ?? 0;

        const odeElementSave =
            document.getElementById('saveIdevice' + odeIdeviceId) ?? null;
        const disabledElements = document.querySelectorAll(
            '[class*="article-disabled"]'
        );

        if (existingOverlay) {
            targetBlock.classList.remove('editing-article', 'article-disabled');
            existingOverlay.remove();
        }

        // Collaborative Init
        if (
            !disabledElements.length &&
            actionType === 'DELETE' &&
            isNotSameEmail &&
            pageId
        ) {
            this.updateUserPage(pageId, true);
        }

        if (actionType === 'SAVE_STOP' && pageId) {
            this.updateUserPage(pageId, true);
            return;
        }

        if (
            !document.querySelectorAll('[id^="saveIdevice"]').length > 0 &&
            disabledElements.length === 1 &&
            actionType === 'SAVE_BLOCK' &&
            isNotSameEmail &&
            pageId
        ) {
            Logger.log(`
                odeElementSave: ${odeElementSave}
                disabledElements.length; ${disabledElements.length}
                isOdeComponentFlag: ${isOdeComponentFlag}
                isNotSameEmail: ${isNotSameEmail}
                odeIdeviceId: ${odeIdeviceId}
                actionType: ${actionType}
                pageId: ${pageId}
            `);

            this.updateUserPage(pageId, true);
            return;
        }
        // Collaborative End

        if (actionType === 'UNLOCK_RESOURCE' && isNotSameEmail) {
            this.cleanupCurrentIdeviceTimer();
            odeElementSave.click();
        }

        if (actionType === 'LOADING' && isNotSameEmail && odeElementSave) {
            const timeIdevice =
                this.idevices?.ideviceActive?.timeIdeviceEditing;
            const getTimeIdeviceEditing =
                timeIdevice ?? this.getTimeIdeviceEditing();

            const editUnlock = this.idevices?.ideviceActive?.editUnlockDevice;
            const editUnlockDevice = editUnlock ?? 'EDIT';

            setTimeout(() => {
                this.app.api.postEditIdevice({
                    odeSessionId: this.odeSession,
                    odeNavStructureSyncId:
                        this.app.project.structure.nodeSelected.getAttribute(
                            'nav-id'
                        ),
                    blockId: blockId,
                    odeIdeviceId: odeIdeviceId,
                    actionType: editUnlockDevice,
                    odeComponentFlag: true,
                    timeIdeviceEditing: getTimeIdeviceEditing,
                });
            }, 1000);
        }

        if (isEditingOrInactive && isNotSameEmail) {
            // TODO Uncomment for user edit notice on idevice (iDevice mode).
            /* if (collaborativeMode !== 'page') {
                const overlay = document.createElement('div');
                const messageBox = document.createElement('div');
                const description = document.createElement('div');
                const emailElement = document.createElement('div');
                const lockTime = document.createElement('div');

                overlay.className = 'user-editing-overlay';
                messageBox.className = 'user-editing-message';
                description.className = 'user-editing-description';
                emailElement.className = 'user-editing-email';
                lockTime.className = 'user-editing-time';

                description.textContent = _(
                    'This resource is being edited by:'
                );
                emailElement.textContent = user;

                const dateMilis = new Date(Number(timeIdeviceEditing));

                const hours = String(dateMilis.getHours()).padStart(2, '0');
                const minutes = String(dateMilis.getMinutes()).padStart(2, '0');
                const seconds = String(dateMilis.getSeconds()).padStart(2, '0');

                lockTime.textContent = `${_('at')} ${hours}:${minutes}:${seconds}`;

                messageBox.appendChild(description);
                messageBox.appendChild(emailElement);
                messageBox.appendChild(lockTime);

                overlay.appendChild(messageBox);
                targetBlock.prepend(overlay);
                targetBlock.classList.add(
                    'editing-article',
                    'article-disabled'
                );
            } */
            if (shouldUnlock) {
                const unlockBtn = document.createElement('button');

                unlockBtn.id = `unlock-btn-${elementId}`;
                unlockBtn.className = 'user-editing-unlock-btn';
                unlockBtn.textContent = _('Force Unlock');
                unlockBtn.style.display = 'block';

                messageBox.appendChild(unlockBtn);

                unlockBtn.onclick = () =>
                    this.unlockResource(blockId, odeIdeviceId);
            }
        }

        if (actionType?.includes('HIDE_UNLOCK_BUTTON')) {
            const buttonId = `unlock-btn-${elementId}`;
            const existingBtn = document.getElementById(buttonId);

            if (existingBtn) {
                existingBtn.remove(); // Remove the unlock button
            }
        }
    }

    /**
     * Unlocks the resource
     */
    unlockResource(blockId, odeIdeviceId) {
        this.app.api
            .postEditIdevice({
                odeSessionId: this.odeSession,
                odeNavStructureSyncId:
                    this.app.project.structure.nodeSelected.getAttribute(
                        'nav-id'
                    ),
                blockId: blockId,
                odeIdeviceId: odeIdeviceId,
                actionType: 'UNLOCK_RESOURCE',
                odeComponentFlag: false,
                timeIdeviceEditing: null,
            })
            .then((response) => {
                if (response.responseMessage === 'OK') {
                    this.showUnlockSuccess();
                }
            })
            .catch((error) => {
                if (error.status === 423 && error.data.forceUnlockAvailable) {
                    this.showForceUnlockOption();
                }
            });
    }

    // Placeholder - kept for API compatibility
    async subscribeToSessionAndNotify() {
        // No-op: Real-time collaboration uses Yjs WebSocket
    }

    async saveMenuHeadButton(disableButton) {
        const saveMenuHeadButton = document.querySelector(
            '#head-top-save-button'
        );

        if (!saveMenuHeadButton) return;

        saveMenuHeadButton.disabled = disableButton;
    }

    async reloadStructure() {
        let nodeId = this.structure.getSelectNodeNavId();
        let pageId = await this.structure.resetDataAndStructureData(nodeId);
        return await this.checkUserUpdateFlag(pageId);
    }

    /**
     *
     */
    async loadCurrentProject() {
        Logger.log(
            'public/app/workarea/project/projectManager.js:loadCurrentProject'
        );

        // Yjs-based flow: project ID comes from URL via backend
        const urlProjectId = window.eXeLearning?.projectId;

        if (!urlProjectId) {
            throw new Error('[ProjectManager] No project ID in URL. Backend should always provide a project ID.');
        }

        Logger.log(`[ProjectManager] Using project ID from URL: ${urlProjectId}`);
        this.yjsProjectId = urlProjectId;
        // For backwards compatibility, generate a pseudo-session ID
        this.odeSession = `yjs-${urlProjectId}`;
        this.odeId = urlProjectId;
        this.odeVersion = '1';
    }

    /**
     * Open elp from platform
     *
     * @param {*} odeSessionId
     */
    async loadPlatformProject(odeSessionId) {
        // Check odeSessionId and set on bbdd
        let odePlatformId = eXeLearning.user.odePlatformId;

        const urlParams = new URLSearchParams(window.location.search);
        let jwtToken = urlParams.get('jwt_token');
        let params = {
            odePlatformId,
            odeSessionId: odeSessionId,
            platformUrlGet: eXeLearning.config.platformUrlGet,
            jwt_token: jwtToken,
        };
        let response;

        response = await this.app.api.platformIntegrationOpenElp(params);

        if (response.responseMessage == 'OK') {
            let params = {
                odeFileName: response.elpFileName,
                odeFilePath: response.elpFilePath,
                forceCloseOdeUserPreviousSession:
                    response.forceCloseOdeUserPreviousSession,
            };
            response = await this.app.api.postLocalOdeFile(params);
            if (response.responseMessage == 'OK') {
                this.app.project.odeSession = response.odeSessionId;
                this.app.project.odeVersion = response.odeVersionId;
                this.app.project.odeId = response.odeId;
                // Load project
                this.odeSession = response.odeSessionId;
                window.location.replace('workarea' + '?jwt_token=' + jwtToken);
            }
        }
    }

    /**
     * newSession
     *
     * @param {*} odeSessionId
     */
    async newSession(odeSessionId) {
        let params = { odeSessionId: odeSessionId };
        this.createSession(params);
    }

    /**
     * createSession
     *
     */
    async createSession(params) {
        await this.app.api.postCloseSession(params).then((response) => {
            if (response.responseMessage == 'OK') {
                // Reload project
                this.app.project.loadCurrentProject();
                this.app.project.openLoad();
            }
        });
    }

    /**
     *
     */
    async loadProjectProperties() {
        await this.properties.load();
    }

    /**
     *
     */
    async loadInterface() {
        await this.app.interface.load();
    }

    /**
     *
     */
    async loadUser() {
        await this.app.user.loadUserPreferences();
    }

    /**
     *
     */
    async loadStructureData() {
        // Reset list of idevices and blocks
        this.idevices.components = { blocks: [], idevices: [] };
        // Load structure data
        await this.structure.loadData();
    }

    /**
     *
     */
    async loadMenus() {
        await this.app.menus.load();
    }

    /**
     *
     */
    async loadModalsContent() {
        // Release notes
        await this.app.modals.releasenotes.load();
        // Third party code information and licenses
        await this.app.modals.legalnotes.load();
    }

    /**
     *
     */
    async ideviceEngineBehaviour() {
        this.idevices.behaviour();
    }

    /**
     * To maintain compatibility with eXe Legacy
     *
     */
    async compatibilityLegacy() {
        // eXe
        window.eXe = {};
        window.eXe.app = {};
        // Inside eXe app
        window.eXe.app.isInExe = () => {
            return true;
        };
        // Project properties
        window.eXe.app.getProjectProperties = () => {
            // Sync from Yjs to ensure current values
            this.properties.loadPropertiesFromYjs();
            return this.properties.properties;
        };
        // Idevice with editing active
        window.eXe.app.getIdeviceActive = () =>
            this.idevices.getIdeviceActive();
        // Idevice by id
        window.eXe.app.getIdeviceById = (id) =>
            this.idevices.getIdeviceById(id);
        // Get idevice installed by name
        window.eXe.app.getIdeviceInstalled = (name) =>
            this.app.idevices.getIdeviceInstalled(name);
        // Get idevice installed edition path
        window.eXe.app.getIdeviceInstalledEditionPath = (name) =>
            this.app.idevices.getIdeviceInstalledEditionPath(name);
        // Get idevice installed export path
        window.eXe.app.getIdeviceInstalledExportPath = (name) =>
            this.app.idevices.getIdeviceInstalledExportPath(name);
        // Alert modal used in idevices
        window.eXe.app.alert = (body, t) =>
            this.app.modals.alert.show({
                body: body,
                title: t ? t : _('Alert'),
            });
        // Confirm modal used in idevices
        window.eXe.app.confirm = (t, b, ce) =>
            this.app.modals.confirm.show({
                title: t,
                body: b,
                confirmExec: ce,
            });
        // Load JS or CSS file
        window.eXe.app.loadScript = (url, callback) =>
            this.idevices.loadScript(url, callback);
        // Idevice active -> Upload file (base64)
        window.eXe.app.uploadFile = (base64, name) =>
            this.idevices.ideviceActive.apiUploadFile(base64, name);
        // Idevice active -> Upload file (form data with values: file, filename, odeSessionId)
        window.eXe.app.uploadLargeFile = (formData) =>
            this.idevices.ideviceActive.apiUploadLargeFile(formData);
    }

    /**
     * Select node and theme
     *
     */
    async initialiceProject() {
        // Select theme - Yjs takes precedence
        // If Yjs mode is enabled and a theme was already set from Yjs metadata,
        // don't override it with user preferences or default
        if (!this._yjsEnabled || !this.app.themes.selected) {
            let theme = eXeLearning.config.defaultTheme;
            if (this.app.user.preferences.preferences.theme) {
                theme = this.app.user.preferences.preferences.theme.value;
            }
            await this.app.themes.selectTheme(theme, false);
        }
        // Select node and load idevices in page
        await this.lastNodeSelected();
    }

    /**
     * Select first node in structure
     * (Legacy lastNodeSelected - with Yjs we don't track server-side selection state)
     */
    async lastNodeSelected() {
        await this.app.selectFirstNodeStructure();
    }

    /**
     * Hide workarea loading screen
     *
     */
    async showScreen() {
        setTimeout(() => {
            this.app.interface.loadingScreen.hide();
        }, 250);
    }

    /**
     * Set installation type attribute to body and elements
     * Uses RuntimeConfig to differentiate between 'static', 'electron', and 'server' modes
     */
    setInstallationTypeAttribute() {
        const runtimeConfig = this.app.runtimeConfig;
        let installationType;

        if (runtimeConfig?.isStaticMode()) {
            installationType = 'static';
        } else if (runtimeConfig?.isElectronMode()) {
            installationType = 'electron';
        } else if (this.offlineInstallation === true) {
            // Fallback for legacy offline detection (shouldn't reach here normally)
            installationType = 'electron';
        } else {
            installationType = 'online';
        }

        document.querySelector('body').setAttribute('installation-type', installationType);

        // Offline/Static mode UI adjustments (save button label)
        if (installationType === 'electron' || installationType === 'static') {
            document.querySelector('#head-top-download-button').innerHTML =
                'save';
            document
                .querySelector('#head-top-download-button')
                .setAttribute('title', _('Save'));

            // Expose a stable project key for Electron (per-project save path)
            if (installationType === 'electron') {
                try {
                    window.__currentProjectId = this.odeId || 'default';
                } catch (e) {
                    // Intentional: Electron global assignment may fail in browser
                }
            }
        }
    }

    /**
     * Save project
     * When Yjs is enabled, saves the Yjs document to the server.
     * Otherwise uses the legacy API.
     */
    async save() {
        // Show message
        let toastData = {
            title: _('Save'),
            body: _('Saving the project...'),
            icon: 'downloading',
        };
        let toast = this.app.toasts.createToast(toastData);

        try {
            // Yjs mode: save Yjs document to server
            if (this._yjsEnabled && this._yjsBridge) {
                const documentManager = this._yjsBridge.getDocumentManager();
                if (documentManager) {
                    const result = await documentManager.save();
                    if (result.success) {
                        this.app.interface.connectionTime.loadLasUpdatedInInterface();
                        toast.toastBody.innerHTML = _('Project saved.');
                        Logger.log('[ProjectManager] Yjs document saved:', result.message);
                    } else {
                        toast.toastBody.innerHTML = _('An error occurred while saving the project.');
                        toast.toastBody.classList.add('error');
                        console.error('[ProjectManager] Yjs save failed:', result.message);
                    }
                } else {
                    toast.toastBody.innerHTML = _('An error occurred while saving the project.');
                    toast.toastBody.classList.add('error');
                    console.error('[ProjectManager] Yjs document manager not available');
                }
            }
            // Legacy mode: use the old API
            else {
                let data = {
                    odeSessionId: this.odeSession,
                    odeVersion: this.odeVersion,
                    odeId: this.odeId,
                };
                let response = await this.app.api.postOdeSave(data);
                if (response && response.responseMessage == 'OK') {
                    this.app.interface.connectionTime.loadLasUpdatedInInterface();
                    toast.toastBody.innerHTML = _('Project saved.');
                } else {
                    this.showModalSaveError(response);
                    toast.toastBody.innerHTML = _(
                        'An error occurred while saving the project.'
                    );
                    toast.toastBody.classList.add('error');
                }
            }
        } catch (error) {
            console.error('[ProjectManager] Save error:', error);
            toast.toastBody.innerHTML = _('An error occurred while saving the project.');
            toast.toastBody.classList.add('error');
        }

        // Remove message after delay
        setTimeout(() => {
            toast.remove();
        }, 1500);
    }

    /**
     * Show modal project save ok
     *
     */
    showModalSaveOk(data) {
        this.app.modals.alert.show({
            title: _('Saved'),
            body: _('The project has been saved.'),
        });
    }

    /**
     * Show modal project save error
     *
     * @param {*} data
     */
    showModalSaveError(data) {
        let errorTextMessage = _(
            'Error while saving: ${response.responseMessage}'
        );
        errorTextMessage = errorTextMessage.replace(
            '${response.responseMessage}',
            data.responseMessage
        );
        this.app.modals.alert.show({
            title: _('Error'),
            body: _(errorTextMessage),
            contentId: 'error',
        });
    }

    /**
     *
     * @param {*} removePrev
     */
    async generateIntervalAutosave(removePrev) {
        if (this.app.api.parameters.autosaveOdeFilesFunction) {
            if (removePrev) clearInterval(this.intervalSaveOde);
            let data = {
                odeSessionId: this.odeSession,
                odeVersion: this.odeVersion,
                odeId: this.odeId,
            };
            this.intervalSaveOde = setInterval(() => {
                this.app.api.postOdeAutosave(data);
            }, this.app.api.parameters.autosaveIntervalTime * 1000);
        }
    }

    /**
     *
     * @param {*} removePrev
     */
    async generateIntervalSessionExpiration(removePrev) {
        if (this.app.api.parameters.autosaveOdeFilesFunction) {
            if (removePrev) clearInterval(this.intervalSaveOde);
            let data = {
                odeSessionId: this.odeSession,
                odeVersion: this.odeVersion,
                odeId: this.odeId,
            };
            this.intervalSaveOde = setInterval(() => {
                this.app.api.renewSession();
            }, 10000);
        }
    }

    /*********************************************************************************************/
    /*  SYNCHRONIZATION (UPDATE CURRENT USERS CHANGES)
    /*********************************************************************************************/

    /**
     *
     */
    async generateIntervalCheckOdeUpdates() {
        // Check online version
        if (this.offlineInstallation !== true) {
            setInterval(() => {
                // Params
                let odeId = this.odeId;
                let odeVersion = this.odeVersion;
                let odeSession = this.odeSession;
                let isCheckUpdate = true;
                let elementsPage = document.querySelectorAll(
                    '.idevice-element-in-content'
                );
                let elementsDragging = document.querySelectorAll('.dragging');
                let pageId = this.structure.getSelectNodeNavId();
                // Check users in session
                isCheckUpdate = this.checkUsersInSession(
                    odeId,
                    odeVersion,
                    odeSession,
                    isCheckUpdate
                );
                // Check if any element is in mode edition
                isCheckUpdate = this.checkModeEdition(
                    elementsPage,
                    isCheckUpdate
                );
                // Check if any element is dragging
                isCheckUpdate = this.checkDraggingElement(
                    elementsDragging,
                    isCheckUpdate
                );
                if (isCheckUpdate) {
                    // Check if the user has an update and action type
                    this.checkUserUpdateFlag(pageId);
                }
            }, this.clientIntervalUpdate);
        }
    }

    /**
     *
     * @param {*} newOdeComponentSync
     */
    async replaceOdeComponent(newOdeComponentSync, isUndoMoveTo = false) {
        let cloneIdeviceNode, blockContent, oldOdeComponentSibling;
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container'
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']"
        );
        // Delete old idevice
        let oldOdeComponent = document.getElementById(
            newOdeComponentSync.odeIdeviceId
        );
        if (oldOdeComponent) {
            oldOdeComponentSibling = oldOdeComponent.nextElementSibling;
            oldOdeComponent.remove();
        }
        // Get new idevice and place in the respective container
        let blockNode = this.idevices.getBlockById(newOdeComponentSync.blockId);

        if (blockNode) {
            blockContent = blockNode.blockContent;
            newOdeComponentSync.isSync = true;
            newOdeComponentSync.mode = 'export';
            cloneIdeviceNode = await this.idevices.createIdeviceInContent(
                newOdeComponentSync,
                blockContent,
                elementOnModeEdition
            );
        } else {
            let odeNavStructureSyncId = document
                .querySelector('.nav-element .selected')
                .getAttribute('nav-id');
            let workareaElement = document.querySelector('#main #workarea');
            let nodeContainerElement = workareaElement.querySelector(
                '#node-content-container'
            );
            let nodeContentElement =
                nodeContainerElement.querySelector('#node-content');

            newOdeComponentSync.isSync = true;
            newOdeComponentSync.mode = 'export';
            // Create new idevice
            let newIdevice = await this.idevices.createIdeviceInContent(
                newOdeComponentSync,
                nodeContentElement,
                elementOnModeEdition
            );
            newIdevice.odeNavStructureSyncId = odeNavStructureSyncId;
        }

        if (oldOdeComponent || isUndoMoveTo) {
            if (isUndoMoveTo) {
                blockContent.insertBefore(
                    cloneIdeviceNode.ideviceContent,
                    blockContent.children[cloneIdeviceNode.order]
                );
            } else {
                blockContent.insertBefore(
                    cloneIdeviceNode.ideviceContent,
                    oldOdeComponentSibling
                );
            }
        }

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id'
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} odeId
     * @param {*} odeVersion
     * @param {*} odeSession
     * @param {*} isCheckUpdate
     * @returns
     */
    async checkUsersInSession(odeId, odeVersion, odeSession, isCheckUpdate) {
        this.app.api
            .getOdeConcurrentUsers(odeId, odeVersion, odeSession)
            .then((response) => {
                let currentUsers = response.currentUsers;
                if (!currentUsers || currentUsers.length <= 1) {
                    isCheckUpdate = false;
                }
            });
        return isCheckUpdate;
    }

    /**
     *
     * @param {*} elementsPage
     * @param {*} isCheckUpdate
     * @returns
     */
    async checkModeEdition(elementsPage, isCheckUpdate) {
        elementsPage.forEach((elementPage) => {
            let elementPageMode = elementPage.getAttribute('mode');
            if (elementPageMode == 'edition') {
                isCheckUpdate = false;
            }
        });
        return isCheckUpdate;
    }

    /**
     *
     * @param {*} elementsDragging
     * @param {*} isCheckUpdate
     * @returns
     */
    async checkDraggingElement(elementsDragging, isCheckUpdate) {
        if (elementsDragging.length > 0) {
            isCheckUpdate = false;
        }
        return isCheckUpdate;
    }

    /**
     *
     * @param {*} response
     */
    async updateEditedElement(response) {
        if (response.odeComponentSyncId) {
            // Update idevice
            this.replaceOdeComponent(response.odeComponentSync);
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id'
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
            }
        } else if (response.odeBlockId) {
            // Update block
            this.replaceOdeBlock(response.odeBlockSync);

            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id'
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
            }
        } else {
            // Update page
            this.replaceOdePage(response.odePageSync);
            // Apply page title from properties if same page
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id'
                );
            if (selectedOdePageId == response.odePageSync.pageId) {
                eXeLearning.app.project.idevices.setNodeContentPageTitle(
                    response.odePageSync.odeNavStructureSyncProperties
                );
            }
        }
    }

    /**
     *
     * @param {*} response
     */
    async updateDeletedElement(response) {
        if (response.odeComponentSyncId) {
            // Delete idevice
            this.deleteOdeComponent(response.odeComponentSyncId);
        } else if (response.odeBlockId) {
            // Delete block
            this.deleteOdeBlock(response.odeBlockId);
        } else {
            // Delete page
            this.deleteOdePage(response.odePageId);
        }
    }

    /**
     *
     * @param {*} response
     */
    async updateAddedElement(response) {
        if (response.odeComponentSyncId) {
            // Add idevice
            this.addOdeComponent(response.odeComponentSync);
        } else if (response.odeBlockSync) {
            // Add block
            this.addOdeBlock(response.odeBlockSync);
        } else {
            // Add Page
            this.addOdePage(response.odePageSync);
            // Force reload structure
            this.reloadStructure();
        }
    }

    /**
     *
     */
    async updateOrderNavMap(syncChange) {
        let navId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );
        this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetDataAndStructureData(
            navId
        );

        // Sync theme if neccesary
        let userTheme =
            eXeLearning.app.user.preferences.preferences.theme.value;
        if (userTheme !== syncChange.styleThemeValueId) {
            this.app.modals.confirm.show({
                title: _('Style changed'),
                body: _(
                    'Your style has changed. Reload the page to apply changes?'
                ),
                confirmButtonText: _('Yes'),
                confirmExec: () => {
                    eXeLearning.app.themes.selectTheme(
                        syncChange.styleThemeValueId,
                        true
                    );
                },
            });
        }
    }

    /**
     *
     * @param {*} response
     */
    async updateMovedElement(response) {
        if (response.odeComponentSyncId) {
            // Move idevice
            this.moveOdeComponent(response.odeComponentSync);
        } else {
            // Move block
            this.moveOdeBlock(response.odeBlockSync);
        }

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id'
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} response
     */
    async updateMovedElementOnSamePage(response) {
        if (response.odeComponentSyncId) {
            // Move idevice
            this.moveOdeComponentOnSamePage(response.odeComponentSync);
        } else {
            // Move block
            this.moveOdeBlockOnSamePage(response.odeBlockSync);
        }

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id'
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} pageId
     */
    async checkUserUpdateFlag(pageId) {
        if (!pageId) {
            return false;
        }
        // Check if the user has an update
        this.app.api.postCheckUserOdeUpdates(pageId).then((response) => {
            if (response.responseMessage == 'OK') {
                for (let syncChange of response.syncChanges) {
                    setTimeout(() => {
                        if (syncChange.actionType == 'EDIT') {
                            // Update page, idevice or block
                            setTimeout(() => {
                                this.updateEditedElement(syncChange);
                            }, this.syncIntervalTime);
                        } else if (syncChange.actionType == 'DELETE') {
                            // Delete page, idevice or block
                            this.updateDeletedElement(syncChange);
                        } else if (syncChange.actionType == 'ADD') {
                            // Add page, idevice or block
                            this.updateAddedElement(syncChange);
                        } else if (syncChange.actionType == 'RELOAD_NAV_MAP') {
                            // Reload nav map when changes order
                            this.updateOrderNavMap(syncChange);
                        } else if (syncChange.actionType == 'MOVE_TO_PAGE') {
                            this.updateMovedElement(syncChange);
                        } else if (syncChange.actionType == 'MOVE_ON_PAGE') {
                            // Move block/idevice on page
                            this.updateMovedElementOnSamePage(syncChange);
                        } else {
                            // Update page
                            this.updateUserPage(pageId);
                        }
                    }, this.syncIntervalTime);
                }
            }
        });
    }

    /**
     *
     * @param {*} newOdeBlockSync
     */
    async replaceOdeBlock(newOdeBlockSync) {
        let oldOdeComponentSibling;
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container'
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']"
        );
        // Delete old idevice
        let oldOdeComponent = document.getElementById(newOdeBlockSync.blockId);
        if (oldOdeComponent) {
            oldOdeComponentSibling = oldOdeComponent.nextElementSibling;
            oldOdeComponent.remove();
        }

        // Get new block and place in the respective container
        newOdeBlockSync.mode = 'export';
        let cloneBlockNode = await this.idevices.newBlockNode(
            newOdeBlockSync,
            true
        );
        nodeContentElement.insertBefore(
            cloneBlockNode.blockContent,
            nodeContentElement.children[cloneBlockNode.order]
        );
        // Load Idevices in block
        newOdeBlockSync.odeComponentsSyncs.forEach(async (idevice) => {
            idevice.mode = 'export';
            await this.idevices.createIdeviceInContent(
                idevice,
                cloneBlockNode.blockContent,
                elementOnModeEdition
            );
        });
    }

    /**
     *
     * @param {*} odeBlockSync
     */
    async moveOdeBlockOnSamePage(odeBlockSync) {
        // Delete old idevice
        let oldOdeComponent = document.getElementById(odeBlockSync.blockId);
        if (oldOdeComponent) {
            oldOdeComponent.remove();
        }

        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container'
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']"
        );
        let cloneBlockNode = await this.idevices.newBlockNode(
            odeBlockSync,
            true
        );
        // Fix the order of blocks when creating a new content block
        let blockPosition = nodeContentElement.children.length - 1;

        nodeContentElement.insertBefore(
            cloneBlockNode.blockContent,
            nodeContentElement.children[blockPosition] //nodeContentElement.children[cloneBlockNode.order],
        );

        // Load Idevices in block if node-content is on mode "view"
        var loadIdevicesOnBlock = setInterval(() => {
            if (nodeContentElement.getAttribute('mode') == 'view') {
                odeBlockSync.odeComponentsSyncs.forEach(async (idevice) => {
                    // Exclude empty idevices
                    if (idevice.htmlView !== null) {
                        idevice.mode = 'export';
                        await this.idevices.createIdeviceInContent(
                            idevice,
                            cloneBlockNode.blockContent,
                            elementOnModeEdition
                        );
                    }
                });
                clearInterval(loadIdevicesOnBlock);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} odeIdeviceSync
     */
    async moveOdeComponentOnSamePage(odeIdeviceSync) {
        let cloneIdeviceNode, blockContent, oldOdeComponentSibling;
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container'
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']"
        );
        // Delete old idevice
        let oldOdeComponent = document.getElementById(
            odeIdeviceSync.odeIdeviceId
        );
        if (oldOdeComponent) {
            oldOdeComponentSibling = oldOdeComponent.nextElementSibling;
            oldOdeComponent.remove();
        }
        // Get new idevice and place in the respective container
        let blockNode = this.idevices.getBlockById(odeIdeviceSync.blockId);

        if (blockNode) {
            blockContent = blockNode.blockContent;
            odeIdeviceSync.mode = 'export';
            cloneIdeviceNode = await this.idevices.createIdeviceInContent(
                odeIdeviceSync,
                blockContent,
                elementOnModeEdition
            );
        } else {
            odeIdeviceSync.mode = 'export';
            // Create new idevice
            let params = { odeBlockId: odeIdeviceSync.blockId };
            let newOdeBlockSync =
                await this.app.api.postObtainOdeBlockSync(params);
            odeIdeviceSync.mode = 'export';
            let cloneBlockNode = await this.idevices.newBlockNode(
                newOdeBlockSync,
                true
            );
            blockContent = cloneBlockNode.blockContent;
            cloneIdeviceNode = await this.idevices.createIdeviceInContent(
                odeIdeviceSync,
                blockContent,
                elementOnModeEdition
            );
            // Move
            nodeContentElement.insertBefore(
                blockContent,
                nodeContentElement.children[cloneBlockNode.order]
            );
        }
        if (blockNode) {
            // Move
            blockContent.insertBefore(
                cloneIdeviceNode.ideviceContent,
                blockContent.children[cloneIdeviceNode.order]
            );
        }
    }

    /**
     * Updates the pageElement to apply the sync changes
     *
     * @param {*} newOdePage
     *
     * Exceptional cases included: properties changes
     */
    async replaceOdePage(newOdePage) {
        let navId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );
        // Check if the ode page is empty (only case "root")
        if (!newOdePage) {
            // Delete page
            let properties = newOdePage.odeNavStructureSyncProperties;
            // Remove node in structure list
            this.structure.data = this.structure.data.filter(
                (node, index, arr) => {
                    return node.id != newOdePage.id;
                }
            );
            //
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.cloneNodeNav(
                newOdePage
            );

            // Set title in node page
            if (newOdePage.id == navId) {
                this.idevices.setNodeContentPageTitle(properties);
            }
        }

        // Synchronize properties from Yjs
        this.app.project.properties.loadPropertiesFromYjs();
        this.app.project.properties.formProperties.reloadValues();

        this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetDataAndStructureData(
            navId
        );

        let odeTitleMenuHeadElement = document.querySelector(
            '#exe-title > .exe-title.content'
        );
        odeTitleMenuHeadElement.innerHTML =
            this.app.project.properties.properties.pp_title.value;
        odeTitleMenuHeadElement.dataset.originalTitle =
            this.app.project.properties.properties.pp_title.value;
        if (typeof $exe !== 'undefined' && $exe.math && $exe.math.refresh) {
            $exe.math.refresh(odeTitleMenuHeadElement);
        }
    }

    /**
     *
     * @param {*} odeComponentSyncId
     */
    async deleteOdeComponent(odeComponentSyncId) {
        // Delete idevice
        let oldOdeComponent = document.getElementById(odeComponentSyncId);
        oldOdeComponent?.remove?.(); // Collaborative Init
    }

    /**
     *
     * @param {*} odeBlockId
     */
    async deleteOdeBlock(odeBlockId) {
        // Delete block
        let oldOdeComponent = document.getElementById(odeBlockId);
        oldOdeComponent?.remove?.(); // Collaborative Init
    }

    /**
     *
     * @param {*} odePageId
     */
    async deleteOdePage(odePageId) {
        // Delete page
        let selectedNavId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );
        let selectedPageId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'page-id'
            );
        // Remove node in structure list
        this.structure.data = this.structure.data.filter((node, index, arr) => {
            return node.pageId != odePageId;
        });

        if (odePageId == selectedPageId) {
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                false
            );
        } else {
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                selectedNavId
            );
        }
    }

    /**
     *
     * @param {*} newOdeComponentSync
     */
    async addOdeComponent(newOdeComponentSync) {
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container'
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']"
        );
        // Get new idevice and place in the respective container
        let blockNode = this.idevices.getBlockById(newOdeComponentSync.blockId);
        let blockContent = blockNode.blockContent;
        newOdeComponentSync.mode = 'export';
        let cloneIdeviceNode = await this.idevices.createIdeviceInContent(
            newOdeComponentSync,
            blockContent,
            elementOnModeEdition
        );
        // Move
        blockContent.insertBefore(
            cloneIdeviceNode.ideviceContent,
            blockContent.children[cloneIdeviceNode.order]
        );
    }

    /**
     *
     * @param {*} newOdeBlockSync
     */
    async addOdeBlock(newOdeBlockSync, isUndoMoveTo = false) {
        // Get new block and place in the respective container
        let odeNavStructureSyncId = document
            .querySelector('.nav-element .selected')
            .getAttribute('nav-id');
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container'
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');
        let elementOnModeEdition = nodeContentElement.querySelector(
            ".idevice_node[mode='edition']"
        );
        newOdeBlockSync.mode = 'export';
        let cloneBlockNode = await this.idevices.newBlockNode(
            newOdeBlockSync,
            true
        );
        if (isUndoMoveTo) {
            nodeContentElement.insertBefore(
                cloneBlockNode.blockContent,
                nodeContentElement.children[cloneBlockNode.order]
            );
        } else {
            nodeContentElement.insertBefore(
                cloneBlockNode.blockContent,
                nodeContentElement.children[cloneBlockNode.order]
            );
        }

        // Load Idevices in block
        newOdeBlockSync.odeComponentsSyncs.forEach(async (idevice) => {
            idevice.mode = 'export';
            let ideviceNode = await this.idevices.createIdeviceInContent(
                idevice,
                cloneBlockNode.blockContent,
                elementOnModeEdition
            );
        });

        // Reset view of idevices to load plugins
        var loadIdevicesExportVIew = setInterval(() => {
            // Check edition mode or view mode
            let selectedOdePageId =
                eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                    'page-id'
                );
            let selectedNodeMode = document
                .querySelector('[node-selected="' + selectedOdePageId + '"]')
                .getAttribute('mode');
            if (selectedNodeMode == 'view') {
                this.idevices.resetCurrentIdevicesExportView([]);
                clearInterval(loadIdevicesExportVIew);
            }
        }, this.syncIntervalTime);
    }

    /**
     *
     * @param {*} newOdePageSync
     */
    async addOdePage(newOdePageSync) {
        await this.app.menus.menuStructure.menuStructureCompose.structureEngine.cloneNodeNav(
            newOdePageSync
        );
        let navId =
            this.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );

        // In case of first page reset structure must be the new navId
        let lengthNavElements =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.menuNavList.getElementsByClassName(
                'nav-element'
            ).length;
        if (navId == 'root' && lengthNavElements <= 1) {
            await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
                newOdePageSync.id
            );
        }

        // Reset structure and stay on selected nav
        await this.app.menus.menuStructure.menuStructureCompose.structureEngine.resetStructureData(
            navId
        );
    }

    /**
     *
     * @param {*} OdeBlockSync
     */
    async moveOdeBlock(OdeBlockSync, isUndoMoveTo = false) {
        let elementsPage = document.querySelectorAll(
            '.idevice-element-in-content'
        );
        let isAddElement = false;
        if (elementsPage.length <= 0) {
            isAddElement = true;
        }
        for (let elementPage of elementsPage) {
            let blockId = elementPage.getAttribute('block-id');
            if (OdeBlockSync.blockId == blockId) {
                this.deleteOdeBlock(OdeBlockSync.blockId);
                isAddElement = false;
                return;
            } else if (OdeBlockSync.id !== blockId) {
                isAddElement = true;
            }
        }
        if (isAddElement) {
            this.addOdeBlock(OdeBlockSync, isUndoMoveTo);
        }
    }

    /**
     *
     * @param {*} odeComponentSync
     */
    async moveOdeComponent(odeComponentSync, isUndoMoveTo = false) {
        let elementsPage = document.querySelectorAll(
            '.idevice_node .idevice-element-in-content'
        );
        let isAddElement = false;
        if (elementsPage.length <= 0) {
            isAddElement = true;
        }
        for (let elementPage of elementsPage) {
            let componentId = elementPage.getAttribute('idevice-id');
            if (odeComponentSync.odeIdeviceId == componentId) {
                if (isUndoMoveTo) {
                    this.deleteOdeBlock(odeComponentSync.previousBlockId);
                } else {
                    this.deleteOdeComponent(odeComponentSync.odeIdeviceId);
                }
                isAddElement = false;
                return;
            } else if (odeComponentSync.odeIdeviceId !== componentId) {
                isAddElement = true;
            }
        }
        if (isAddElement) {
            this.replaceOdeComponent(odeComponentSync, isUndoMoveTo);
        }
    }

    /**
     *
     */
    async cleanPreviousAutosaves() {
        let params = { odeSessionId: this.odeSession };
        await this.app.api.postCleanAutosavesByUser(params);
    }

    /**
     *
     * @param {*} odeComponentFlag
     * @param {*} odeNavStructureSyncId
     * @param {*} blockId
     * @param {*} odeIdeviceId
     * @returns
     */
    async changeUserFlagOnEdit(
        odeComponentFlag,
        odeNavStructureSyncId,
        blockId,
        odeIdeviceId,
        isIdeviceRemove = false,
        timeIdeviceEditing = null,
        actionType,
        pageId = null
    ) {
        let params = {
            odeSessionId: this.odeSession,
            odeIdeviceId: odeIdeviceId,
            blockId: blockId,
            odeNavStructureSyncId: odeNavStructureSyncId,
            odeComponentFlag: odeComponentFlag,
            timeIdeviceEditing: timeIdeviceEditing,
            actionType: actionType,
            pageId: pageId,
        };

        // In case of multiple session and odeComponentFlag set to false wait for the clientIntervalUpdate
        if (this.offlineInstallation !== true && odeComponentFlag == false) {
            // Params
            let odeId = this.odeId;
            let odeVersion = this.odeVersion;
            let odeSession = this.odeSession;
            let isMultipleSession = true;
            // Check users in session
            isMultipleSession = await this.checkUsersInSession(
                odeId,
                odeVersion,
                odeSession,
                isMultipleSession
            );

            if (isMultipleSession && isIdeviceRemove == false) {
                setTimeout(() => {
                    // In case user does not edit again the idevice
                    let e = document.getElementById(params.odeIdeviceId);
                    if (e && e.getAttribute('mode') !== 'edition') {
                        let response = this.app.api.postEditIdevice(params);
                        return response;
                    }
                }, this.clientIntervalUpdate);
            } else {
                let response = await this.app.api.postEditIdevice(params);
                return response;
            }
        } else {
            let response = await this.app.api.postEditIdevice(params);
            return response;
        }
    }

    /**
     *
     * @param {*} blockId
     * @param {*} odeIdeviceId
     * @returns
     */
    async isAvalaibleOdeComponent(blockId, odeIdeviceId) {
        let params = {
            odeSessionId: this.odeSession,
            odeIdeviceId: odeIdeviceId,
            blockId: blockId,
        };
        let response =
            await this.app.api.checkCurrentOdeUsersComponentFlag(params);
        return response;
    }

    /**
     *
     * @return {boolean} - True if at least one iDevice is in edition mode, false otherwise.
     */
    checkOpenIdevice() {
        const container = document.getElementById('node-content');
        if (!container) {
            return false;
        }
        const element = container.querySelector(
            'div.idevice_node[mode="edition"]'
        );
        if (element !== null) {
            eXeLearning.app.modals.alert.show({
                title: _('Info'),
                body: _(
                    'You are editing an iDevice. Please close it before continuing'
                ),
            });
            return true;
        }
    }

    // TODO It cannot be implemented to cover all the causes, it requires real persistence.
    checkPageCollaborativeEditing() {
        let pageId = document
            .getElementById('node-content')
            .getAttribute('node-selected');
        if (this.activeLocks.get(pageId) === false) {
            return false;
        }
        eXeLearning.app.modals.alert.show({
            title: _('Info'),
            body: _(
                'Someone else is editing this page. Please wait until they finish before adding new iDevices.'
            ),
        });
        return true;
    }

    /**
     * Sorts <article> elements inside #node-content by their IDs
     * and reorders them visually in the DOM.
     *
     * @param {boolean} ascending - If true, sorts ascending (a → b); if false, descending (b → a)
     */
    sortBlocksById(ascending = true) {
        // Get the main container elements
        let workareaElement = document.querySelector('#main #workarea');
        let nodeContainerElement = workareaElement.querySelector(
            '#node-content-container'
        );
        let nodeContentElement =
            nodeContainerElement.querySelector('#node-content');

        // Get and sort <article> elements by ID
        let sortedArticles = Array.from(nodeContentElement.children)
            .filter((el) => el.tagName.toLowerCase() === 'article')
            .sort((a, b) => {
                return ascending
                    ? a.id.localeCompare(b.id)
                    : b.id.localeCompare(a.id);
            });

        // Loop through sorted elements
        sortedArticles.forEach((el) => {
            const text = el.querySelector('.exe-text-activity p');
            const udl = el.querySelector('.exe-udlContent-content > div');

            // Get the content from the <article>, fallback to placeholder
            const content = text
                ? text.innerText
                : udl?.innerText || '[No content]';

            // Shorten long content strings for display
            const shortened =
                content.length > 50 ? content.slice(0, 50) + '…' : content;

            // Log the ID and shortened content
            Logger.log('id: ' + el.id + ' content: ' + shortened);

            // Re-append the element to reorder it in the DOM
            nodeContentElement.appendChild(el);
        });
    }
}

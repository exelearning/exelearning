/**
 * YjsProjectBridge
 * Bridges the legacy projectManager with the new Yjs-based system.
 * Provides backward-compatible API while using Yjs underneath.
 *
 * Usage:
 *   // Initialize once after project load
 *   const bridge = new YjsProjectBridge(eXeLearning.app);
 *   await bridge.initialize(projectId, authToken);
 *
 *   // Now all save operations go through Yjs
 *   bridge.enableAutoSync();
 */
class YjsProjectBridge {
  /**
   * @param {Object} app - The eXeLearning app instance
   */
  constructor(app) {
    this.app = app;
    this.projectId = null;
    this.authToken = null;
    this.documentManager = null;
    this.structureBinding = null;
    this.lockManager = null;
    this.assetCache = null;  // Legacy - kept for backward compatibility
    this.assetManager = null; // New asset manager with asset:// URLs
    this.resourceFetcher = null; // ResourceFetcher for fetching themes, libs, iDevices
    this.resourceCache = null; // ResourceCache for persistent IndexedDB storage (themes, libs, iDevices)
    this.assetWebSocketHandler = null; // WebSocket handler for peer-to-peer asset sync
    this.saveManager = null; // SaveManager for saving to server with progress
    this.connectionMonitor = null; // ConnectionMonitor for connection failure handling
    this.initialized = false;
    this.autoSyncEnabled = false;
    this.isNewProject = false; // Track if this is a new project (never saved)

    // Event handlers
    this.structureObservers = [];
    this.saveStatusCallbacks = [];

    // UI state
    this.saveIndicator = null;
    this.undoButton = null;
    this.redoButton = null;

    // Track pending metadata changes (before debounce commits to Yjs)
    // This allows immediate UI feedback even before undoStack is populated
    this.hasPendingMetadataChanges = false;

    // Flag to prevent form recreation cascade during undo/redo operations
    this.isUndoRedoInProgress = false;
  }

  /**
   * Initialize the Yjs bridge for a project
   * @param {number} projectId - Project ID
   * @param {string} authToken - JWT authentication token
   * @param {Object} options - Configuration options
   * @param {boolean} options.isNewProject - Skip server load for new projects
   */
  async initialize(projectId, authToken, options = {}) {
    Logger.log(`[YjsProjectBridge] Initializing for project ${projectId}...`);

    this.projectId = projectId;
    this.authToken = authToken;
    this.isNewProject = options.isNewProject || false;

    const config = {
      wsUrl: options.wsUrl || this.getWebSocketUrl(),
      apiUrl: options.apiUrl || this.getApiUrl(),
      token: authToken,
      enableIndexedDB: options.enableIndexedDB !== false,
      enableWebSocket: options.enableWebSocket !== false,
      offline: options.offline || options.enableWebSocket === false,
      // Sync optimization: skip sync wait in Electron/offline mode
      skipSyncWait: options.skipSyncWait ?? this._shouldSkipSyncWait(),
      awarenessCheckTimeout: options.awarenessCheckTimeout,
      fullSyncTimeout: options.fullSyncTimeout,
    };

    // Create document manager
    this.documentManager = new window.YjsDocumentManager(projectId, config);
    await this.documentManager.initialize({ isNewProject: options.isNewProject });

    // Create structure binding
    this.structureBinding = new window.YjsStructureBinding(this.documentManager);

    // Use the lock manager created by document manager (already has the correct Y.Doc reference)
    this.lockManager = this.documentManager.lockManager;

    // Create new AssetManager (with asset:// URLs, Yjs metadata)
    let preloadedAssetCount = 0;
    if (window.AssetManager) {
      this.assetManager = new window.AssetManager(projectId);
      // Connect AssetManager to Yjs bridge for metadata storage
      this.assetManager.setYjsBridge(this);
      await this.assetManager.init();
      // Preload all assets from IndexedDB into memory cache
      preloadedAssetCount = await this.assetManager.preloadAllAssets();
      Logger.log(`[YjsProjectBridge] AssetManager initialized with Yjs metadata, preloaded ${preloadedAssetCount} assets`);
    }

    // Create legacy asset cache (for backward compatibility)
    this.assetCache = new window.AssetCacheManager(projectId);

    // Create ResourceCache for persistent caching of themes, libraries, iDevices
    if (window.ResourceCache) {
      this.resourceCache = new window.ResourceCache();
      try {
        await this.resourceCache.init();
        Logger.log('[YjsProjectBridge] ResourceCache initialized');

        // Clean old version entries on startup
        const currentVersion = window.eXeLearning?.version || 'v0.0.0';
        await this.resourceCache.clearOldVersions(currentVersion);
      } catch (e) {
        console.warn('[YjsProjectBridge] ResourceCache initialization failed:', e);
        this.resourceCache = null;
      }
    }

    // Create ResourceFetcher for fetching themes, libraries, iDevices for exports
    if (window.ResourceFetcher) {
      this.resourceFetcher = new window.ResourceFetcher();
      // Initialize with ResourceCache for persistent caching
      await this.resourceFetcher.init(this.resourceCache);
      // Also expose on eXeLearning.app for access from Theme class
      if (this.app) {
        this.app.resourceFetcher = this.resourceFetcher;
      }
      Logger.log('[YjsProjectBridge] ResourceFetcher initialized with bundle support');
    }

    // Create AssetWebSocketHandler for peer-to-peer asset synchronization
    if (window.AssetWebSocketHandler && this.assetManager && this.documentManager?.wsProvider) {
      this.assetWebSocketHandler = new window.AssetWebSocketHandler(
        this.assetManager,
        this.documentManager.wsProvider,
        {
          projectId: projectId,
          apiUrl: config.apiUrl,
          token: authToken,
        }
      );
      await this.assetWebSocketHandler.initialize();

      // Connect AssetManager to the WebSocket handler for rename sync
      this.assetManager.setWebSocketHandler(this.assetWebSocketHandler);

      // Listen for asset received events to update DOM
      this.assetWebSocketHandler.on('assetReceived', async ({ assetId }) => {
        Logger.log('[YjsProjectBridge] Asset received from peer:', assetId.substring(0, 8) + '...');
        // Update any DOM images waiting for this asset
        await this.assetManager.updateDomImagesForAsset(assetId);
        // Also preload into cache for future use
        await this.assetManager.preloadAllAssets();
      });

      Logger.log('[YjsProjectBridge] AssetWebSocketHandler initialized');
    }

    // NOW start the WebSocket connection - AFTER AssetWebSocketHandler is ready
    // This ensures JSON messages are properly intercepted and not sent to y-websocket
    if (!config.offline && this.documentManager?.wsProvider) {
      Logger.log('[YjsProjectBridge] Starting WebSocket connection...');
      this.documentManager.startWebSocketConnection();

      // Wait for connection and sync
      await this.documentManager.waitForWebSocketSync();

      // IMPORTANT: Create blank structure AFTER sync to prevent duplicate pages
      // When multiple clients join an unsaved project simultaneously, each would
      // create a blank page before syncing, resulting in duplicates after Yjs merge.
      // By deferring to after sync, we ensure only the first client creates the page.
      this.documentManager.ensureBlankStructureIfEmpty();

      // Announce assets after WebSocket is connected
      if (this.assetWebSocketHandler && preloadedAssetCount > 0) {
        Logger.log(`[YjsProjectBridge] Announcing ${preloadedAssetCount} assets to server...`);
        await this.assetWebSocketHandler.announceAssetAvailability();
      }

      // Create ConnectionMonitor for connection failure handling
      if (window.ConnectionMonitor) {
        this.connectionMonitor = new window.ConnectionMonitor({
          wsProvider: this.documentManager.wsProvider,
          toastsManager: this.app.toasts,
          sessionMonitor: window.eXeSessionMonitor,
          maxReconnectAttempts: 5,
        });
        this.connectionMonitor.start();
        Logger.log('[YjsProjectBridge] ConnectionMonitor initialized');
      }
    }

    // Create SaveManager for saving to server with progress modal
    if (window.SaveManager) {
      this.saveManager = new window.SaveManager(this, {
        apiUrl: config.apiUrl,
        token: authToken,
      });
      Logger.log('[YjsProjectBridge] SaveManager initialized');
    }

    // Set up observers
    this.setupStructureObserver();
    this.setupMetadataObserver();
    this.setupUndoRedoHandlers();

    // Inject save status indicator
    this.injectSaveStatusUI();

    this.initialized = true;
    Logger.log(`[YjsProjectBridge] Initialized successfully`);

    // Trigger initial structure load for observers (in case blank structure was created)
    this.triggerInitialStructureLoad();

    // Load user themes from Yjs (for collaborator sync and project re-open)
    await this.loadUserThemesFromYjs();

    // Load user themes from IndexedDB (global themes that persist across projects)
    // Pass resourceCache directly since _yjsBridge may not be set on the project yet
    if (eXeLearning.app?.themes?.list?.loadUserThemesFromIndexedDB) {
      try {
        // Pass this.resourceCache directly to avoid timing issues with _yjsBridge reference
        await eXeLearning.app.themes.list.loadUserThemesFromIndexedDB(this.resourceCache);
      } catch (err) {
        console.error('[YjsProjectBridge] loadUserThemesFromIndexedDB error:', err);
      }
      // Refresh NavbarStyles UI to show loaded themes
      if (eXeLearning.app.menus?.navbar?.styles) {
        eXeLearning.app.menus.navbar.styles.updateThemes();
      }
    }

    // Set up observer for theme files changes (collaborator theme sync)
    this.setupThemeFilesObserver();

    return this;
  }

  /**
   * Get the Yjs document manager
   * Used for direct access to save/load operations
   * @returns {YjsDocumentManager|null}
   */
  getDocumentManager() {
    return this.documentManager;
  }

  /**
   * Get WebSocket URL based on current location
   * WebSocket server runs on the same port as NestJS with /yjs/ path
   */
  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const port = window.location.port || (protocol === 'wss:' ? '443' : '80');
    // Include basePath from eXeLearning config (set by pages.controller.ts)
    const basePath = window.eXeLearning?.config?.basePath || '';
    // WebSocket server runs on the same port with {basePath}/yjs/ prefix
    return `${protocol}//${hostname}:${port}${basePath}/yjs`;
  }

  /**
   * Get API URL based on current location
   */
  getApiUrl() {
    // Include basePath from eXeLearning config (set by pages.controller.ts)
    const basePath = window.eXeLearning?.config?.basePath || '';
    return `${window.location.origin}${basePath}/api`;
  }

  /**
   * Determine if sync wait should be skipped
   * Returns true for Electron/offline installations where collaboration is rare
   * @returns {boolean}
   * @private
   */
  _shouldSkipSyncWait() {
    // Check if running in Electron
    const isElectron = !!(
      window.electronAPI ||
      window.process?.versions?.electron ||
      navigator.userAgent.toLowerCase().includes('electron')
    );

    // Check if offline installation (from server config)
    const isOffline = window.eXeLearning?.config?.isOfflineInstallation === true;

    // Skip sync wait in Electron/offline mode
    return isElectron || isOffline;
  }

  /**
   * Set up observer for structure changes (pages/blocks/components)
   */
  setupStructureObserver() {
    const navigation = this.documentManager.getNavigation();
    let debounceTimer = null;

    navigation.observeDeep((events, transaction) => {
      try {
        // Check if this change came from remote (another client)
        // In Yjs, transaction.local is true for local changes, false for remote
        const isRemote = transaction.local === false;
        Logger.log('[YjsProjectBridge] Structure changed:', events.length, 'events, remote:', isRemote);

        // Handle remote component additions (new iDevices from other clients)
        if (isRemote) {
          this.handleRemoteStructureChanges(events);
        }

        // Notify all registered observers
        for (const observer of this.structureObservers) {
          try {
            observer(events, isRemote);
          } catch (e) {
            console.error('[YjsProjectBridge] Observer error:', e);
          }
        }

        // Debounce UI updates to avoid too many refreshes
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          try {
            // Update legacy structure engine if available
            if (this.app?.project?.structure) {
              this.syncStructureToLegacy();
            }

            // Update undo/redo button states
            this.updateUndoRedoButtons();
          } catch (e) {
            console.error('[YjsProjectBridge] Error in debounced sync:', e);
          }
        }, 50); // Small debounce to batch rapid changes
      } catch (e) {
        console.error('[YjsProjectBridge] Error in structure observer:', e);
      }
    });
  }

  /**
   * Handle remote structure changes - detect new blocks/components from other clients
   * Also handles updates to existing components (e.g., when content is saved)
   * @param {Array} events - Yjs events
   */
  handleRemoteStructureChanges(events) {
    for (const event of events) {
      try {
        const path = event.path;

        // Check for added items in Y.Array (components array)
        if (event.changes && event.changes.added && event.changes.added.size > 0) {
          // Check if this is a component addition (path like [pageIndex, 'blocks', blockIndex, 'components'])
          if (path.length >= 4 && path[1] === 'blocks' && path[3] === 'components') {
            const pageIndex = path[0];
            const blockIndex = path[2];

            // Get page and block info
            const navigation = this.documentManager.getNavigation();
            const pageMap = navigation.get(pageIndex);
            if (!pageMap) continue;

            const pageId = pageMap.get('id');
            const blocks = pageMap.get('blocks');
            if (!blocks) continue;

            const blockMap = blocks.get(blockIndex);
            if (!blockMap) continue;

            const blockId = blockMap.get('id');

            // Process added components
            for (const item of event.changes.added) {
              const compMap = item.content?.getContent()?.[0];
              if (compMap && compMap.get) {
                const componentData = {
                  id: compMap.get('id'),
                  ideviceType: compMap.get('ideviceType'),
                  htmlContent: compMap.get('htmlContent')?.toString?.() || '',
                  lockedBy: compMap.get('lockedBy'),
                  lockUserName: compMap.get('lockUserName'),
                  lockUserColor: compMap.get('lockUserColor'),
                };

                Logger.log('[YjsProjectBridge] Remote component added:', componentData.id);

                // Render the remote iDevice
                this.renderRemoteComponent(componentData, pageId, blockId);
              }
            }
          }

          // Check if this is a block addition (path like [pageIndex, 'blocks'])
          if (path.length >= 2 && path[1] === 'blocks' && path.length === 2) {
            const pageIndex = path[0];
            const navigation = this.documentManager.getNavigation();
            const pageMap = navigation.get(pageIndex);
            if (pageMap) {
              const pageId = pageMap.get('id') || pageMap.get('pageId');
              Logger.log('[YjsProjectBridge] Remote block added to page:', pageId);
              // If we're currently viewing this page, reload it
              this.schedulePageReloadIfCurrent(pageId);
            }
          }
        }

        // Check for component property updates (Y.Map changes)
        // Path like [pageIndex, 'blocks', blockIndex, 'components', compIndex]
        if (event.changes && event.changes.keys && event.changes.keys.size > 0 &&
            path.length >= 5 && path[1] === 'blocks' && path[3] === 'components') {

          // Check if htmlContent, lockedBy, or other relevant keys changed
          const changedKeys = Array.from(event.changes.keys.keys());
          const relevantKeys = ['htmlContent', 'lockedBy', 'lockUserName', 'lockUserColor'];

          if (changedKeys.some(key => relevantKeys.includes(key))) {
            const pageIndex = path[0];
            const blockIndex = path[2];
            const compIndex = path[4];

            const navigation = this.documentManager.getNavigation();
            const pageMap = navigation.get(pageIndex);
            if (!pageMap) continue;

            const pageId = pageMap.get('id');
            const blocks = pageMap.get('blocks');
            if (!blocks) continue;

            const blockMap = blocks.get(blockIndex);
            if (!blockMap) continue;

            const components = blockMap.get('components');
            if (!components) continue;

            const compMap = components.get(compIndex);
            if (!compMap) continue;

            const componentData = {
              id: compMap.get('id'),
              ideviceType: compMap.get('ideviceType'),
              htmlContent: compMap.get('htmlContent')?.toString?.() || '',
              lockedBy: compMap.get('lockedBy'),
              lockUserName: compMap.get('lockUserName'),
              lockUserColor: compMap.get('lockUserColor'),
            };

            Logger.log('[YjsProjectBridge] Remote component updated:', componentData.id, 'changed keys:', changedKeys);

            // Update the remote component
            this.updateRemoteComponent(componentData, pageId);
          }
        }

        // Check for Y.Text content updates on htmlContent
        // Path like [pageIndex, 'blocks', blockIndex, 'components', compIndex, 'htmlContent']
        if (event.delta && path.length >= 6 && path[1] === 'blocks' && path[3] === 'components' && path[5] === 'htmlContent') {
          const pageIndex = path[0];
          const blockIndex = path[2];
          const compIndex = path[4];

          const navigation = this.documentManager.getNavigation();
          const pageMap = navigation.get(pageIndex);
          if (!pageMap) continue;

          const pageId = pageMap.get('id');
          const blocks = pageMap.get('blocks');
          if (!blocks) continue;

          const blockMap = blocks.get(blockIndex);
          if (!blockMap) continue;

          const components = blockMap.get('components');
          if (!components) continue;

          const compMap = components.get(compIndex);
          if (!compMap) continue;

          const componentData = {
            id: compMap.get('id'),
            ideviceType: compMap.get('ideviceType'),
            htmlContent: compMap.get('htmlContent')?.toString?.() || '',
            lockedBy: compMap.get('lockedBy'),
            lockUserName: compMap.get('lockUserName'),
            lockUserColor: compMap.get('lockUserColor'),
          };

          Logger.log('[YjsProjectBridge] Remote component content updated (Y.Text):', componentData.id);

          // Update the remote component
          this.updateRemoteComponent(componentData, pageId);
        }

        // Check for block property updates (blockName, iconName, properties)
        // Path like [pageIndex, 'blocks', blockIndex]
        if (event.changes && event.changes.keys && event.changes.keys.size > 0 &&
            path.length >= 3 && path[1] === 'blocks' && typeof path[2] === 'number' && path.length === 3) {

          const changedKeys = Array.from(event.changes.keys.keys());
          const relevantKeys = ['blockName', 'iconName', 'properties'];

          if (changedKeys.some(key => relevantKeys.includes(key))) {
            const pageIndex = path[0];
            const blockIndex = path[2];

            const navigation = this.documentManager.getNavigation();
            const pageMap = navigation.get(pageIndex);
            if (!pageMap) continue;

            const pageId = pageMap.get('id');
            const blocks = pageMap.get('blocks');
            if (!blocks) continue;

            const blockMap = blocks.get(blockIndex);
            if (!blockMap) continue;

            const blockData = {
              id: blockMap.get('id'),
              blockId: blockMap.get('blockId'),
              blockName: blockMap.get('blockName'),
              iconName: blockMap.get('iconName'),
            };

            // Get properties if present
            const propsMap = blockMap.get('properties');
            if (propsMap && typeof propsMap.toJSON === 'function') {
              blockData.properties = propsMap.toJSON();
            } else if (propsMap && typeof propsMap === 'object') {
              blockData.properties = { ...propsMap };
            }

            Logger.log('[YjsProjectBridge] Remote block updated:', blockData.id, 'changed keys:', changedKeys);

            // Update the remote block UI
            this.updateRemoteBlock(blockData, pageId);
          }
        }

        // Check for block properties Y.Map updates
        // Path like [pageIndex, 'blocks', blockIndex, 'properties']
        if (event.changes && event.changes.keys && event.changes.keys.size > 0 &&
            path.length >= 4 && path[1] === 'blocks' && path[3] === 'properties') {

          const pageIndex = path[0];
          const blockIndex = path[2];

          const navigation = this.documentManager.getNavigation();
          const pageMap = navigation.get(pageIndex);
          if (!pageMap) continue;

          const pageId = pageMap.get('id');
          const blocks = pageMap.get('blocks');
          if (!blocks) continue;

          const blockMap = blocks.get(blockIndex);
          if (!blockMap) continue;

          const blockData = {
            id: blockMap.get('id'),
            blockId: blockMap.get('blockId'),
            blockName: blockMap.get('blockName'),
            iconName: blockMap.get('iconName'),
          };

          const propsMap = blockMap.get('properties');
          if (propsMap && typeof propsMap.toJSON === 'function') {
            blockData.properties = propsMap.toJSON();
          } else if (propsMap && typeof propsMap === 'object') {
            blockData.properties = { ...propsMap };
          }

          Logger.log('[YjsProjectBridge] Remote block properties updated:', blockData.id);

          this.updateRemoteBlock(blockData, pageId);
        }

        // Check for deleted blocks or components (happens during moves)
        if (event.changes && event.changes.deleted && event.changes.deleted.size > 0) {
          // Check if this deletion affects blocks or components
          if (path.length >= 2 && (path[1] === 'blocks' || path.includes('components'))) {
            // Get the page that was affected
            if (typeof path[0] === 'number') {
              const pageIndex = path[0];
              const navigation = this.documentManager.getNavigation();
              const pageMap = navigation.get(pageIndex);
              if (pageMap) {
                const pageId = pageMap.get('id') || pageMap.get('pageId');
                Logger.log('[YjsProjectBridge] Remote block/component deleted from page:', pageId);

                // If we're currently viewing this page, reload it
                this.schedulePageReloadIfCurrent(pageId);
              }
            }
          }
        }
      } catch (e) {
        console.error('[YjsProjectBridge] Error processing remote change:', e);
      }
    }
  }

  /**
   * Schedule a page reload if the affected page is the one currently being viewed
   * Uses debouncing to avoid multiple reloads for batched changes
   * @param {string} pageId - The page ID that was affected
   */
  schedulePageReloadIfCurrent(pageId) {
    // Get current page ID
    const currentPageId = this.app?.project?.structure?.menuStructureBehaviour?.nodeSelected?.getAttribute('nav-id');

    if (currentPageId === pageId) {
      // Debounce to avoid multiple reloads
      if (this._pageReloadTimer) {
        clearTimeout(this._pageReloadTimer);
      }

      this._pageReloadTimer = setTimeout(async () => {
        Logger.log('[YjsProjectBridge] Reloading current page due to remote block/component changes');
        const pageElement = this.app?.project?.structure?.menuStructureBehaviour?.menuNav?.querySelector(
          `.nav-element[nav-id="${pageId}"]`
        );
        if (pageElement) {
          await this.app?.project?.idevices?.loadApiIdevicesInPage(false, pageElement);
          // Check if the page is now empty and show empty_articles message
          this.app?.menus?.menuStructure?.menuStructureBehaviour?.checkIfEmptyNode();
        }
      }, 100); // Small debounce
    }
  }

  /**
   * Called when user navigates to a page
   * Boosts priority for assets in that page for P2P synchronization
   * @param {string} pageId - ID of the page being navigated to
   */
  async onPageNavigation(pageId) {
    if (!this.assetManager || !pageId) return;

    try {
      // Get page HTML content from Yjs
      const pageContent = this.getPageContent(pageId);
      if (!pageContent) {
        Logger.log(`[YjsProjectBridge] No content found for page ${pageId}`);
        return;
      }

      // Scan for assets and boost their priority
      await this.assetManager.boostAssetsInHTML(pageContent, pageId);

      Logger.log(`[YjsProjectBridge] Navigation to page ${pageId} - assets priority boosted`);
    } catch (error) {
      console.warn('[YjsProjectBridge] Error boosting assets on navigation:', error);
    }
  }

  /**
   * Get page content from Yjs structure
   * Collects HTML content from all iDevices in the page
   * @param {string} pageId
   * @returns {string|null} HTML content
   */
  getPageContent(pageId) {
    if (!this.documentManager) return null;

    try {
      const navigation = this.documentManager.getNavigation();
      if (!navigation) return null;

      // Find page by ID in the navigation array
      let pageMap = null;
      for (let i = 0; i < navigation.length; i++) {
        const page = navigation.get(i);
        if (page && page.get('id') === pageId) {
          pageMap = page;
          break;
        }
      }

      if (!pageMap) return null;

      // Collect HTML from all iDevices in the page
      const blocks = pageMap.get('blocks');
      if (!blocks) return null;

      let html = '';

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks.get(i);
        if (!block) continue;

        const components = block.get('components');
        if (!components) continue;

        for (let j = 0; j < components.length; j++) {
          const component = components.get(j);
          if (!component) continue;

          const content = component.get('htmlContent');
          if (content) {
            html += typeof content === 'string' ? content : content.toString();
          }
        }
      }

      return html || null;
    } catch (error) {
      console.warn('[YjsProjectBridge] Error getting page content:', error);
      return null;
    }
  }

  /**
   * Render a remote component (iDevice) from another client
   * @param {Object} componentData - Component data from Yjs
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   */
  async renderRemoteComponent(componentData, pageId, blockId) {
    try {
      const idevicesEngine = this.app?.project?.idevices;
      if (!idevicesEngine) {
        console.warn('[YjsProjectBridge] IdevicesEngine not available');
        return;
      }

      await idevicesEngine.renderRemoteIdevice(componentData, pageId, blockId);
    } catch (e) {
      console.error('[YjsProjectBridge] Error rendering remote component:', e);
    }
  }

  /**
   * Update an existing remote component (when content changes from another client)
   * @param {Object} componentData - Updated component data from Yjs
   * @param {string} pageId - Page ID
   */
  async updateRemoteComponent(componentData, pageId) {
    try {
      // Only update if we're on the same page
      const currentPageId = this.app?.project?.structure?.nodeSelected?.getAttribute('nav-id');
      if (currentPageId !== pageId) {
        console.debug('[YjsProjectBridge] Remote component update is on different page, skipping');
        return;
      }

      const idevicesEngine = this.app?.project?.idevices;
      if (!idevicesEngine) {
        console.warn('[YjsProjectBridge] IdevicesEngine not available');
        return;
      }

      await idevicesEngine.updateRemoteIdeviceContent(componentData);
    } catch (e) {
      console.error('[YjsProjectBridge] Error updating remote component:', e);
    }
  }

  /**
   * Update a remote block (box) from another client
   * Updates the block's title, icon, and properties in the UI
   * @param {Object} blockData - Block data from Yjs
   * @param {string} pageId - Page ID where the block is located
   */
  async updateRemoteBlock(blockData, pageId) {
    try {
      // Only update if we're on the same page
      const currentPageId = this.app?.project?.structure?.nodeSelected?.getAttribute('nav-id');
      if (currentPageId !== pageId) {
        console.debug('[YjsProjectBridge] Remote block update is on different page, skipping');
        return;
      }

      const idevicesEngine = this.app?.project?.idevices;
      if (!idevicesEngine) {
        console.warn('[YjsProjectBridge] IdevicesEngine not available');
        return;
      }

      // Find the block node - try by blockId first
      let blockNode = idevicesEngine.getBlockById(blockData.id || blockData.blockId);

      // Fallback: search by sym-id attribute (for blocks with different local IDs)
      if (!blockNode) {
        const yjsBlockId = blockData.id || blockData.blockId;
        const blockElement = document.querySelector(`article[sym-id="${yjsBlockId}"]`);
        if (blockElement) {
          // Found by sym-id, now get the blockNode by its local DOM id
          blockNode = idevicesEngine.getBlockById(blockElement.id);
        }
      }

      if (!blockNode) {
        console.debug('[YjsProjectBridge] Block not found for remote update:', blockData.id);
        return;
      }

      // Update block title if changed
      if (blockData.blockName !== undefined && blockNode.blockName !== blockData.blockName) {
        blockNode.blockName = blockData.blockName;
        if (blockNode.blockNameElementText) {
          blockNode.blockNameElementText.innerHTML = blockData.blockName;
        }
      }

      // Update icon if changed
      if (blockData.iconName !== undefined && blockNode.iconName !== blockData.iconName) {
        blockNode.iconName = blockData.iconName;
        blockNode.makeIconNameElement();
      }

      // Update properties if changed
      if (blockData.properties) {
        Object.entries(blockData.properties).forEach(([key, value]) => {
          if (blockNode.properties && blockNode.properties[key]) {
            blockNode.properties[key].value = value;
          }
        });
        // Regenerate block content to apply property changes (e.g., visibility, minimized)
        blockNode.generateBlockContentNode(false);
      }

      Logger.log('[YjsProjectBridge] Remote block updated:', blockData.id);
    } catch (e) {
      console.error('[YjsProjectBridge] Error updating remote block:', e);
    }
  }

  /**
   * Set up observer for metadata changes
   */
  setupMetadataObserver() {
    const metadata = this.documentManager.getMetadata();

    metadata.observe((event, transaction) => {
      const isRemote = transaction.origin === 'remote';
      Logger.log('[YjsProjectBridge] Metadata changed, remote:', isRemote);

      // During undo/redo, skip structure updates to prevent form recreation cascade
      // The undo/redo methods handle UI sync directly via forceTitleSync()
      if (this.isUndoRedoInProgress) {
        Logger.log('[YjsProjectBridge] Skipping structure updates during undo/redo');
        this.updateUndoRedoButtons();
        return;
      }

      // Update legacy project properties if available
      if (this.app?.project?.properties) {
        this.syncMetadataToLegacy();
      }

      // Update document title in UI if title changed
      if (event.keysChanged.has('title')) {
        const newTitle = metadata.get('title');
        this.updateDocumentTitle(newTitle);
      }

      // Update undo/redo button states after metadata changes
      this.updateUndoRedoButtons();
    });
  }

  /**
   * Trigger initial structure load after initialization
   * This ensures the UI shows any structure created during initialization
   * (e.g., blank project structure) that was created before observers were set up
   */
  triggerInitialStructureLoad() {
    const navigation = this.documentManager.getNavigation();
    if (navigation && navigation.length > 0) {
      Logger.log(`[YjsProjectBridge] Triggering initial structure load with ${navigation.length} pages`);
      // Notify all registered observers with the initial state
      for (const observer of this.structureObservers) {
        try {
          observer([], false); // Empty events array, not remote
        } catch (e) {
          console.error('[YjsProjectBridge] Initial load observer error:', e);
        }
      }
    } else {
      Logger.log('[YjsProjectBridge] No initial structure to load');
    }
  }

  /**
   * Update document title in UI
   * @param {string} title
   */
  updateDocumentTitle(title) {
    // Update the title display in structure menu (root node)
    // Only if structure data is already loaded
    if (this.app?.project?.structure?.data) {
      this.app.project.structure.setTitleToNodeRoot();
    }

    // Update browser tab title
    if (title) {
      document.title = `${title} - eXeLearning`;
    }
  }

  /**
   * Observe a specific component's content for real-time collaboration
   * @param {string} componentId - Component ID
   * @param {Function} callback - Called when content changes
   * @returns {Function} Unsubscribe function
   */
  observeComponentContent(componentId, callback) {
    const compMap = this.structureBinding.getComponentMap(componentId);
    if (!compMap) {
      console.warn('[YjsProjectBridge] Component not found:', componentId);
      return () => {};
    }

    const htmlContent = compMap.get('htmlContent');
    if (htmlContent && htmlContent.observe) {
      const observer = (event, transaction) => {
        const isRemote = transaction.origin === 'remote';
        callback(htmlContent.toString(), isRemote);
      };
      htmlContent.observe(observer);
      return () => htmlContent.unobserve(observer);
    }

    return () => {};
  }

  /**
   * Set up undo/redo keyboard shortcuts and buttons
   */
  setupUndoRedoHandlers() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.initialized) return;

      // Skip if focus is in an input that handles its own undo (like contenteditable in TinyMCE)
      const activeEl = document.activeElement;
      const isContentEditable = activeEl?.getAttribute('contenteditable') === 'true';
      const isInTinyMCE = activeEl?.closest('.tox-tinymce, .mce-content-body');
      if (isContentEditable || isInTinyMCE) return;

      // Ctrl+Z / Cmd+Z - Undo (without Shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.redo();
        return;
      }

      // Ctrl+Y / Cmd+Y - Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !e.shiftKey) {
        e.preventDefault();
        this.redo();
        return;
      }
    });
  }

  /**
   * Inject undo/redo buttons into the toolbar
   * Save status is integrated into the existing #head-top-save-button
   */
  injectSaveStatusUI() {
    // Remove any existing undo/redo UI to prevent duplicates
    const existing = document.getElementById('yjs-undo-redo');
    if (existing) {
      existing.remove();
    }

    // Find the navbar for undo/redo buttons
    const navbar = document.querySelector('.navbar-nav, .toolbar, #toolbar');
    if (!navbar) {
      console.warn('[YjsProjectBridge] Could not find navbar for undo/redo buttons');
      return;
    }

    // Create undo/redo buttons container (no save indicator - it's in the save button)
    const undoRedoContainer = document.createElement('div');
    undoRedoContainer.id = 'yjs-undo-redo';
    undoRedoContainer.className = 'yjs-undo-redo';
    undoRedoContainer.innerHTML = `
      <button class="btn btn-sm btn-undo" title="${_('Undo')} (Ctrl+Z)" disabled>
        <span class="auto-icon" aria-hidden="true">undo</span>
      </button>
      <button class="btn btn-sm btn-redo" title="${_('Redo')} (Ctrl+Shift+Z)" disabled>
        <span class="auto-icon" aria-hidden="true">redo</span>
      </button>
    `;

    // Insert after existing elements
    navbar.appendChild(undoRedoContainer);

    // Store references (saveIndicator is now the save button)
    this.saveButton = document.getElementById('head-top-save-button');
    this.undoButton = undoRedoContainer.querySelector('.btn-undo');
    this.redoButton = undoRedoContainer.querySelector('.btn-redo');

    // Bind button events
    this.undoButton.addEventListener('click', () => this.undo());
    this.redoButton.addEventListener('click', () => this.redo());

    // Update undo/redo button states
    this.updateUndoRedoButtons();

    // Set initial save status based on document state
    // New projects or dirty documents should show 'unsaved'
    if (this.documentManager?.isDirty || this.isNewProject) {
      this.updateSaveStatus('unsaved');
    } else {
      this.updateSaveStatus('saved');
    }
  }

  /**
   * Update save status on the save button
   * Uses classes 'saved' (green dot) and 'unsaved' (red dot)
   * @param {'saving'|'saved'|'error'|'offline'} status
   * @param {string} message - Optional message
   */
  updateSaveStatus(status, message = null) {
    // Get the save button if not already cached
    if (!this.saveButton) {
      this.saveButton = document.getElementById('head-top-save-button');
    }

    if (this.saveButton) {
      // Remove all status classes
      this.saveButton.classList.remove('saved', 'unsaved', 'saving');

      // Apply appropriate class based on status
      switch (status) {
        case 'saved':
          this.saveButton.classList.add('saved');
          break;
        case 'saving':
          this.saveButton.classList.add('saving');
          break;
        case 'error':
        case 'offline':
        default:
          this.saveButton.classList.add('unsaved');
          break;
      }
    }

    // Notify callbacks
    for (const callback of this.saveStatusCallbacks) {
      try {
        callback(status, message);
      } catch (e) {
        console.error('[YjsProjectBridge] Save status callback error:', e);
      }
    }
  }

  /**
   * Update undo/redo button states
   * Considers both the undoStack and pending metadata changes
   */
  updateUndoRedoButtons() {
    if (!this.documentManager || !this.undoButton || !this.redoButton) return;

    const undoManager = this.documentManager.undoManager;
    if (undoManager) {
      // Enable undo if there are items in undoStack OR pending metadata changes
      const canUndo = undoManager.undoStack.length > 0 || this.hasPendingMetadataChanges;
      this.undoButton.disabled = !canUndo;
      this.redoButton.disabled = undoManager.redoStack.length === 0;
    }
  }

  /**
   * Called when there are pending metadata changes (user typing, before debounce)
   * Enables immediate UI feedback for undo availability
   */
  onPendingMetadataChange() {
    this.hasPendingMetadataChanges = true;
    this.updateUndoRedoButtons();
    Logger.log('[YjsProjectBridge] Pending metadata change detected');
  }

  /**
   * Clear pending metadata changes flag
   * Called after changes are committed to Yjs
   */
  clearPendingMetadataChanges() {
    this.hasPendingMetadataChanges = false;
  }

  /**
   * Get a callback function for pending change notifications
   * This can be passed to YjsPropertiesBinding.setOnPendingChangeCallback()
   * @returns {Function} Callback function
   */
  getPendingChangeCallback() {
    return () => this.onPendingMetadataChange();
  }

  /**
   * Force synchronization of metadata from Yjs to UI elements
   * Call this after undo/redo to ensure all form inputs and header are in sync
   */
  forceTitleSync() {
    const metadata = this.documentManager?.getMetadata();
    if (!metadata) return;

    const title = metadata.get('title') || '';

    // Update header title element
    const headerTitle = document.querySelector('#exe-title > .exe-title.content');
    if (headerTitle) {
      headerTitle.textContent = title || _('Untitled document');
      Logger.log('[YjsProjectBridge] Forced title sync to header:', title);

      // Trigger line count check if available
      if (window.eXeLearning?.app?.interface?.odeTitleElement?.checkTitleLineCount) {
        window.eXeLearning.app.interface.odeTitleElement.checkTitleLineCount();
      }
    }

    // Update all form inputs if properties panel is open
    const propertiesForm = document.querySelector('.properties-modal form, #properties-panel form, .property-value');
    if (propertiesForm || document.querySelector('.property-value')) {
      this.forceAllFormInputsSync();
    }
  }

  /**
   * Force synchronization of all metadata form inputs from Yjs
   * Updates all property-value inputs with current Yjs metadata values
   */
  forceAllFormInputsSync() {
    const metadata = this.documentManager?.getMetadata();
    if (!metadata) return;

    // Property key mapping (from YjsPropertiesBinding)
    const propertyKeyMap = {
      'pp_title': 'title',
      'pp_subtitle': 'subtitle',
      'pp_author': 'author',
      'pp_description': 'description',
      'pp_lang': 'language',
      'pp_license': 'license',
      'pp_addExeLink': 'addExeLink',
      'pp_addPagination': 'addPagination',
      'pp_addSearchBox': 'addSearchBox',
      'pp_addAccessibilityToolbar': 'addAccessibilityToolbar',
      'pp_extraHeadContent': 'extraHeadContent',
      'exportSource': 'exportSource',
      'footer': 'footer',
    };

    // Find and update all property inputs
    const inputs = document.querySelectorAll('.property-value');
    inputs.forEach(input => {
      const propertyKey = input.getAttribute('property');
      if (!propertyKey) return;

      const metadataKey = propertyKeyMap[propertyKey] || propertyKey;
      const value = metadata.get(metadataKey);
      if (value === undefined) return;

      const inputType = input.getAttribute('data-type') || input.type;

      switch (inputType) {
        case 'checkbox':
          input.checked = value === 'true' || value === true;
          break;
        case 'select':
        case 'text':
        case 'textarea':
        case 'date':
        default:
          input.value = value;
          break;
      }
    });

    Logger.log('[YjsProjectBridge] Forced all form inputs sync from Yjs');
  }

  /**
   * Undo last action
   */
  undo() {
    if (!this.documentManager?.undoManager) return;

    const undoManager = this.documentManager.undoManager;

    // If there are pending metadata changes but nothing in undoStack yet,
    // flush the pending changes first so they can be undone
    if (this.hasPendingMetadataChanges && undoManager.undoStack.length === 0) {
      this.flushPendingMetadataChanges();
    }

    // Clear pending changes flag
    this.hasPendingMetadataChanges = false;

    // Set flag to prevent form recreation cascade during undo
    this.isUndoRedoInProgress = true;

    try {
      // Perform undo if there's something to undo
      if (undoManager.undoStack.length > 0) {
        undoManager.undo();
      }

      this.updateUndoRedoButtons();

      // Force sync all UI elements (title header, form inputs) from Yjs
      this.forceTitleSync();

      Logger.log('[YjsProjectBridge] Undo performed');
    } finally {
      this.isUndoRedoInProgress = false;
    }

    // NOTE: reloadCurrentPage() removed - not needed for metadata changes
    // and it was causing form recreation cascade
  }

  /**
   * Redo last undone action
   */
  redo() {
    if (!this.documentManager?.undoManager) return;

    // Clear pending changes flag
    this.hasPendingMetadataChanges = false;

    // Set flag to prevent form recreation cascade during redo
    this.isUndoRedoInProgress = true;

    try {
      this.documentManager.undoManager.redo();
      this.updateUndoRedoButtons();

      // Force sync all UI elements (title header, form inputs) from Yjs
      this.forceTitleSync();

      Logger.log('[YjsProjectBridge] Redo performed');
    } finally {
      this.isUndoRedoInProgress = false;
    }

    // NOTE: reloadCurrentPage() removed - not needed for metadata changes
    // and it was causing form recreation cascade
  }

  /**
   * Flush pending metadata changes from form inputs
   * This commits any debounced changes immediately to Yjs
   */
  flushPendingMetadataChanges() {
    // Find all property inputs and trigger their blur to flush debounced changes
    const inputs = document.querySelectorAll('.property-value');
    inputs.forEach(input => {
      // Dispatch blur event to trigger the blur listener which flushes pending changes
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    Logger.log('[YjsProjectBridge] Flushed pending metadata changes');
  }

  /**
   * Reload the current page content after undo/redo operations
   * Uses debouncing to avoid multiple reloads
   */
  async reloadCurrentPage() {
    const currentPageId = this.app?.project?.structure?.menuStructureBehaviour?.nodeSelected?.getAttribute('nav-id');
    if (!currentPageId) return;

    // Debounce to avoid multiple reloads
    if (this._undoRedoReloadTimer) {
      clearTimeout(this._undoRedoReloadTimer);
    }

    this._undoRedoReloadTimer = setTimeout(async () => {
      Logger.log('[YjsProjectBridge] Reloading current page after undo/redo');
      const pageElement = this.app?.project?.structure?.menuStructureBehaviour?.menuNav?.querySelector(
        `.nav-element[nav-id="${currentPageId}"]`
      );
      if (pageElement) {
        await this.app?.project?.idevices?.loadApiIdevicesInPage(false, pageElement);
        // Check if the page is now empty and show empty_articles message
        this.app?.menus?.menuStructure?.menuStructureBehaviour?.checkIfEmptyNode();
      }
    }, 50); // Small debounce
  }

  /**
   * Enable auto-sync mode (replaces explicit save)
   */
  enableAutoSync() {
    this.autoSyncEnabled = true;

    // Disable legacy autosave
    if (this.app?.project?.intervalSaveOde) {
      clearInterval(this.app.project.intervalSaveOde);
      this.app.project.intervalSaveOde = null;
    }

    // Set up connection status updates
    this.documentManager.onSyncStatus = (connected) => {
      if (!connected) {
        this.updateSaveStatus('offline');
      }
    };

    // Listen for save status changes (dirty/saved/saving/error)
    this.documentManager.on('saveStatus', (data) => {
      if (data.status === 'dirty') {
        this.updateSaveStatus('unsaved');
      } else if (data.status === 'saved') {
        this.updateSaveStatus('saved');
      } else if (data.status === 'saving') {
        this.updateSaveStatus('saving');
      } else if (data.status === 'error') {
        this.updateSaveStatus('error', data.error);
      }
    });

    // Set initial status based on document dirty state
    if (this.documentManager.isDirty) {
      this.updateSaveStatus('unsaved');
    }

    Logger.log('[YjsProjectBridge] Auto-sync enabled');
  }

  /**
   * Sync Yjs structure to legacy structure engine
   */
  syncStructureToLegacy() {
    const pages = this.structureBinding.getPages();
    const legacyData = [];

    for (const page of pages) {
      legacyData.push({
        id: page.id,
        pageId: page.id,
        pageName: page.pageName,
        parent: page.parentId || 'root',
        order: page.order,
        icon: 'edit_note',
      });
    }

    // Update legacy structure if method exists
    if (this.app?.project?.structure?.setDataFromYjs) {
      this.app.project.structure.setDataFromYjs(legacyData);
    }
  }

  /**
   * Sync Yjs metadata to legacy project properties
   */
  syncMetadataToLegacy() {
    const metadata = this.documentManager.getMetadata();

    const props = {
      title: metadata.get('title'),
      author: metadata.get('author'),
      language: metadata.get('language'),
      description: metadata.get('description'),
      license: metadata.get('license'),
    };

    // Update legacy properties if method exists
    if (this.app?.project?.properties?.setFromYjs) {
      this.app.project.properties.setFromYjs(props);
    }
  }

  // ==========================================
  // Backward-compatible API methods
  // These replace the old REST API calls
  // ==========================================

  /**
   * Save project to server
   * Uses SaveManager for full save with progress modal,
   * or falls back to simple Yjs flush if SaveManager unavailable.
   * @param {Object} options - Save options
   * @param {boolean} options.showProgress - Show progress modal (default: true for SaveManager)
   * @returns {Promise<Object>}
   */
  async save(options = {}) {
    Logger.log('[YjsProjectBridge] Save requested');
    this.updateSaveStatus('saving');

    try {
      // Use SaveManager if available for full save with progress
      if (this.saveManager) {
        const result = await this.saveManager.save({
          showProgress: options.showProgress !== false,
        });
        if (result.success) {
          this.updateSaveStatus('saved');
        } else {
          this.updateSaveStatus('error', result.error);
        }
        return result;
      }

      // Fallback: Yjs flush only (no assets sync)
      Logger.log('[YjsProjectBridge] SaveManager not available, using flush only');
      await this.documentManager.flush();
      this.updateSaveStatus('saved');
      return { success: true, message: _('Project saved') };
    } catch (e) {
      console.error('[YjsProjectBridge] Save error:', e);
      this.updateSaveStatus('error', e.message);
      throw e;
    }
  }

  /**
   * Save project to server with progress modal
   * Explicit method for UI-triggered saves
   * @returns {Promise<Object>}
   */
  async saveToServer() {
    return this.save({ showProgress: true });
  }

  /**
   * Add a new page
   * @param {string} pageName - Page name
   * @param {string} parentId - Parent page ID (null for root)
   * @returns {Object} Created page
   */
  addPage(pageName, parentId = null) {
    const page = this.structureBinding.addPage(pageName, parentId);
    this.updateUndoRedoButtons();
    return page;
  }

  /**
   * Get a page by ID
   * @param {string} pageId - Page ID
   * @returns {Y.Map|null} Page Y.Map or null
   */
  getPage(pageId) {
    if (!this.structureBinding) return null;
    return this.structureBinding.getPage(pageId);
  }

  /**
   * Update page properties
   * @param {string} pageId - Page ID
   * @param {Object} props - Properties to update
   */
  updatePage(pageId, props) {
    this.structureBinding.updatePage(pageId, props);
    this.updateUndoRedoButtons();
  }

  /**
   * Delete a page and all its descendants
   * @param {string} pageId - Page ID
   * @returns {boolean} true if deleted successfully
   */
  deletePage(pageId) {
    const success = this.structureBinding.deletePage(pageId);
    this.updateUndoRedoButtons();
    return success;
  }

  /**
   * Move page to new position
   * @param {string} pageId - Page ID
   * @param {string} newParentId - New parent ID (null for root)
   * @param {number} newIndex - New position index
   */
  movePage(pageId, newParentId = null, newIndex = null) {
    this.structureBinding.movePage(pageId, newParentId, newIndex);
    this.updateUndoRedoButtons();
  }

  /**
   * Clone a page with all its blocks and components
   * @param {string} pageId - Page to clone
   * @param {string} newName - Name for the cloned page (optional)
   * @returns {Object} The cloned page object
   */
  clonePage(pageId, newName = null) {
    const clonedPage = this.structureBinding.clonePage(pageId, newName);
    this.updateUndoRedoButtons();
    return clonedPage;
  }

  /**
   * Add a block to a page
   * @param {string} pageId - Page ID
   * @param {string} blockName - Block name
   * @param {string} existingBlockId - Optional existing block ID to use (for syncing with frontend)
   * @param {number} order - Optional order position (defaults to end)
   * @returns {string} Created block ID
   */
  addBlock(pageId, blockName = 'Block', existingBlockId = null, order = null) {
    const blockId = this.structureBinding.createBlock(pageId, blockName, existingBlockId, order);
    this.updateUndoRedoButtons();
    return blockId;
  }

  /**
   * Update block properties
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   * @param {Object} props - Properties to update
   */
  updateBlock(pageId, blockId, props) {
    // Note: updateBlock method needs to be added to structureBinding
    // For now, we can get the block map and update directly
    const blockMap = this.structureBinding.getBlockMap(pageId, blockId);
    if (blockMap) {
      Object.entries(props).forEach(([key, value]) => {
        blockMap.set(key, value);
      });
    }
    this.updateUndoRedoButtons();
  }

  /**
   * Delete a block
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   */
  deleteBlock(pageId, blockId) {
    this.structureBinding.deleteBlock(pageId, blockId);
    this.updateUndoRedoButtons();
  }

  /**
   * Clone a block within the same page
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID to clone
   * @returns {Object} The cloned block object
   */
  cloneBlock(pageId, blockId) {
    const clonedBlock = this.structureBinding.cloneBlock(pageId, blockId);
    this.updateUndoRedoButtons();
    return clonedBlock;
  }

  /**
   * Add a component (iDevice) to a block
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   * @param {string} ideviceType - iDevice type
   * @param {Object} initialData - Initial properties (optional)
   * @returns {string} Created component ID
   */
  addComponent(pageId, blockId, ideviceType, initialData = {}) {
    const componentId = this.structureBinding.createComponent(pageId, blockId, ideviceType, initialData);

    // Request lock for the creator (so they can edit immediately)
    if (componentId && this.lockManager) {
      this.lockManager.requestLock(componentId);
    }

    this.updateUndoRedoButtons();
    return componentId;
  }

  /**
   * Update component properties
   * @param {string} componentId - Component ID
   * @param {Object} props - Properties to update
   */
  updateComponent(componentId, props) {
    this.structureBinding.updateComponent(componentId, props);
    this.updateUndoRedoButtons();
  }

  /**
   * Delete a component
   * @param {string} componentId - Component ID
   * @returns {boolean} true if deleted successfully
   */
  deleteComponent(componentId) {
    try {
      const result = this.structureBinding.deleteComponent(componentId);
      this.updateUndoRedoButtons();
      return result;
    } catch (error) {
      console.error('[YjsProjectBridge] Error deleting component:', error);
      return false;
    }
  }

  /**
   * Clone a component within the same block
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   * @param {string} componentId - Component ID to clone
   * @returns {Object} The cloned component object
   */
  cloneComponent(pageId, blockId, componentId) {
    const clonedComponent = this.structureBinding.cloneComponent(pageId, blockId, componentId);
    this.updateUndoRedoButtons();
    return clonedComponent;
  }

  /**
   * Get HTML content for a component
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   * @param {string} componentId - Component ID
   * @returns {string|null} HTML content
   */
  getComponentHtml(pageId, blockId, componentId) {
    const component = this.structureBinding.getComponent(pageId, blockId, componentId);
    if (!component) return null;

    // Try htmlContent (Y.Text) first, then fall back to htmlView (plain string)
    const htmlContent = component.get('htmlContent');
    if (htmlContent) {
      return htmlContent?.toString?.() || '';
    }

    // Fallback to htmlView (used during import when Y.Text is not created)
    const htmlView = component.get('htmlView');
    return (typeof htmlView === 'string') ? htmlView : '';
  }

  /**
   * Set HTML content for a component
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   * @param {string} componentId - Component ID
   * @param {string} html - HTML content
   */
  setComponentHtml(pageId, blockId, componentId, html) {
    const component = this.structureBinding.getComponent(pageId, blockId, componentId);
    if (!component) return;

    let htmlContent = component.get('htmlContent');

    // Handle case where htmlContent doesn't exist or is a plain string (from import)
    if (!htmlContent || typeof htmlContent === 'string') {
      // Check htmlContent first, then htmlView (from import) for existing content
      let existingContent = '';
      if (typeof htmlContent === 'string' && htmlContent) {
        existingContent = htmlContent;
      } else {
        const htmlView = component.get('htmlView');
        if (typeof htmlView === 'string' && htmlView) {
          existingContent = htmlView;
        }
      }

      htmlContent = new (window.Y.Text)();
      // IMPORTANT: Insert content BEFORE setting on component to avoid Yjs integration errors
      htmlContent.insert(0, existingContent);
      component.set('htmlContent', htmlContent);
    }

    // Prepare HTML for sync: convert blob:// and data-asset-url to asset:// refs
    let safeHtml = (html != null && typeof html === 'string') ? html : '';
    if (this.assetManager && safeHtml) {
      safeHtml = this.assetManager.prepareHtmlForSync(safeHtml);
    }

    // Replace content
    htmlContent.delete(0, htmlContent.length);
    htmlContent.insert(0, safeHtml);
    this.updateUndoRedoButtons();
  }

  /**
   * Acquire lock on a component
   * @param {string} componentId - Component ID
   * @returns {boolean} Whether lock was acquired
   */
  acquireLock(componentId) {
    const userEmail = this.app?.user?.email || 'unknown';
    return this.lockManager.acquireLock(componentId, userEmail);
  }

  /**
   * Release lock on a component
   * @param {string} componentId - Component ID
   */
  releaseLock(componentId) {
    this.lockManager.releaseLock(componentId);
  }

  /**
   * Check if component is locked by another user
   * @param {string} componentId - Component ID
   * @returns {Object|null} Lock info or null
   */
  getLockInfo(componentId) {
    return this.lockManager.getLock(componentId);
  }

  /**
   * Update project metadata
   * @param {Object} props - Metadata properties
   */
  updateMetadata(props) {
    const metadata = this.documentManager.getMetadata();
    for (const [key, value] of Object.entries(props)) {
      metadata.set(key, value);
    }
    this.updateUndoRedoButtons();
  }

  /**
   * Get project metadata
   * @returns {Object} Metadata object
   */
  getMetadata() {
    const metadata = this.documentManager.getMetadata();
    return {
      title: metadata.get('title'),
      author: metadata.get('author'),
      language: metadata.get('language'),
      description: metadata.get('description'),
      license: metadata.get('license'),
      createdAt: metadata.get('createdAt'),
      modifiedAt: metadata.get('modifiedAt'),
    };
  }

  /**
   * Get assets Y.Map for instant sync of asset metadata
   * Structure: Map<uuid, {filename, folderPath, mime, size, hash, uploaded, createdAt}>
   * @returns {Y.Map} The Yjs Map containing all asset metadata
   */
  getAssetsMap() {
    if (!this.documentManager) {
      throw new Error('[YjsProjectBridge] Not initialized');
    }
    return this.documentManager.getAssets();
  }

  /**
   * Export project to .elpx file
   * Uses SharedExporters (TypeScript unified pipeline) when available
   * Filename is automatically generated from project title (sanitized: lowercase, no accents, no special chars)
   * @param {Object} options - Export options
   * @param {boolean} options.saveAs - If true, always prompt for save location (Save As behavior)
   */
  async exportToElpx(options = {}) {
    // Ensure exelearning_version is set in metadata before export
    if (this.documentManager?._updateVersionMetadata) {
      await this.documentManager._updateVersionMetadata();
    }

    // Use SharedExporters if available (preferred - includes theme, idevices, DTD)
    if (window.SharedExporters?.createExporter) {
      try {
        const exporter = window.SharedExporters.createExporter(
          'elpx',
          this.documentManager,
          this.assetCache,
          this.resourceFetcher,
          this.assetManager
        );
        const result = await exporter.export();
        if (result.success && result.data) {
          // Use sanitized filename from exporter (lowercase, no accents, no special chars)
          const exportFilename = result.filename || 'export.elpx';

          // Check if Electron mode - use Electron save API for desktop behavior
          // eslint-disable-next-line no-undef
          if (eXeLearning?.config?.isOfflineInstallation && window.electronAPI?.saveBuffer) {
            // Convert ArrayBuffer to base64 for IPC transfer
            const uint8Array = new Uint8Array(result.data);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const base64Data = btoa(binary);
            const key = window.__currentProjectId || 'default';

            if (options.saveAs) {
              // Save As: always prompt for new location
              await window.electronAPI.saveBufferAs(base64Data, key, exportFilename);
            } else {
              // Save: use remembered path or prompt first time
              // If opened from legacy .elp, main.js will prompt for new .elpx location
              await window.electronAPI.saveBuffer(base64Data, key, exportFilename);
            }
            Logger.log('[YjsProjectBridge] ELPX exported via Electron:', exportFilename);
          } else {
            // Browser mode: direct download
            const blob = new Blob([result.data], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = exportFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            Logger.log('[YjsProjectBridge] ELPX exported via SharedExporters:', exportFilename);
          }
        } else {
          throw new Error(result.error || 'Export failed');
        }
      } catch (error) {
        console.error('[YjsProjectBridge] SharedExporters ELPX export failed:', error);
        throw error; // Don't hide errors - let them bubble up for debugging
      }
    } else {
      throw new Error('SharedExporters not available - ELPX export requires exporters.bundle.js');
    }
  }

  /**
   * Import project from .elpx file
   * @param {File} file - The .elpx file
   * @param {Object} options - Import options
   * @param {boolean} options.clearExisting - If true, clears existing structure before import (default: true)
   * @returns {Promise<Object>} Import statistics
   */
  async importFromElpx(file, options = {}) {
    // Use new AssetManager if available, otherwise fall back to legacy assetCache
    const assetHandler = this.assetManager || this.assetCache;
    const importer = new window.ElpxImporter(this.documentManager, assetHandler);
    const stats = await importer.importFromFile(file, options);

    // Announce imported assets to server for peer-to-peer collaboration
    // Skip only when collaboration is explicitly disabled (capabilities available and disabled)
    const capabilities = window.eXeLearning?.app?.capabilities;
    const collaborationEnabled = !capabilities || capabilities.collaboration?.enabled;
    if (stats && stats.assets > 0 && collaborationEnabled) {
      Logger.log(`[YjsProjectBridge] Announcing ${stats.assets} imported assets to peers...`);
      await this.announceAssets();
    }

    // Check and handle theme from imported package
    // Only import theme when opening a file (clearExisting=true), not when importing into existing project
    // Skip only when remote storage is explicitly disabled (capabilities available and disabled)
    const clearExisting = options.clearExisting !== false; // default is true
    const hasRemoteStorage = !capabilities || capabilities.storage?.remote;
    if (stats && stats.theme && clearExisting && hasRemoteStorage) {
      await this._checkAndImportTheme(stats.theme, file);
    }

    return stats;
  }

  /**
   * Check if imported theme is installed and offer to import it
   *
   * SECURITY NOTE: This feature allows users to import custom themes from ELP files.
   * Themes can contain JavaScript code that will be executed in the exported content.
   * This is controlled by the ONLINE_THEMES_INSTALL setting (config.userStyles).
   * When disabled, themes will NOT be imported from ELP files - only the default
   * theme will be used. Administrators should be aware that enabling this feature
   * allows users to run custom JavaScript in exported content.
   *
   * Priority for finding themes:
   * 1. Server themes (base/site) - always available
   * 2. IndexedDB user themes - persistent local storage
   * 3. Package theme folder - requires user confirmation
   *
   * @param {string} themeName - Name of the theme from the package
   * @param {File} file - The original .elpx file to check for /theme/ folder
   * @private
   */
  async _checkAndImportTheme(themeName, file) {
    if (!themeName) return;

    Logger.log(`[YjsProjectBridge] Checking theme: ${themeName}`);

    // Check if theme import is allowed (ONLINE_THEMES_INSTALL setting)
    // In offline installations (Electron/desktop), always allow theme import
    const isOfflineInstallation = eXeLearning.config?.isOfflineInstallation || false;
    const userStylesEnabled = eXeLearning.config?.userStyles === 1 || eXeLearning.config?.userStyles === true;

    if (!isOfflineInstallation && !userStylesEnabled) {
      Logger.log('[YjsProjectBridge] Theme import disabled (ONLINE_THEMES_INSTALL=0), using default theme');
      // Save=true to update Yjs metadata with default theme (replacing imported theme)
      eXeLearning.app.themes.selectTheme(eXeLearning.config.defaultTheme, true);
      return;
    }

    // 1. Check if theme is installed on server (base/site themes)
    const installedThemes = eXeLearning.app.themes?.list?.installed || {};
    if (Object.keys(installedThemes).includes(themeName)) {
      Logger.log(`[YjsProjectBridge] Theme "${themeName}" already installed (server), selecting it`);
      await eXeLearning.app.themes.selectTheme(themeName, true);
      return;
    }

    // 2. Check if theme exists in IndexedDB (persistent user themes)
    if (this.resourceCache) {
      try {
        const hasUserTheme = await this.resourceCache.hasUserTheme(themeName);
        if (hasUserTheme) {
          Logger.log(`[YjsProjectBridge] Theme "${themeName}" found in IndexedDB, loading it`);
          // Load theme from IndexedDB and register
          await this._loadUserThemeFromIndexedDB(themeName);
          await eXeLearning.app.themes.selectTheme(themeName, true);
          return;
        }
      } catch (e) {
        console.warn('[YjsProjectBridge] Error checking IndexedDB for theme:', e);
      }
    }

    // Theme not installed - check if package has /theme/ folder
    try {
      const fflateLib = window.fflate;
      if (!fflateLib) {
        throw new Error('fflate library not loaded');
      }
      const arrayBuffer = await file.arrayBuffer();
      const uint8Data = new Uint8Array(arrayBuffer);
      const zip = fflateLib.unzipSync(uint8Data);
      const themeConfig = zip['theme/config.xml'];

      if (!themeConfig) {
        Logger.log(`[YjsProjectBridge] No theme folder in package, using default`);
        // Save=true to update Yjs metadata with default theme (replacing imported theme)
        eXeLearning.app.themes.selectTheme(eXeLearning.config.defaultTheme, true);
        return;
      }

      // Store file reference for later extraction
      this._pendingThemeFile = file;
      this._pendingThemeZip = zip;

      // Show confirmation modal to import theme
      this._showThemeImportModal(themeName);
    } catch (error) {
      console.error('[YjsProjectBridge] Error checking theme in package:', error);
      // Save=true to update Yjs metadata with default theme (replacing imported theme)
      eXeLearning.app.themes.selectTheme(eXeLearning.config.defaultTheme, true);
    }
  }

  /**
   * Show modal to confirm theme import
   * User themes from .elpx files are stored:
   * 1. IndexedDB (persistent local storage, available across all projects)
   * 2. Yjs (compressed ZIP, for collaboration and export)
   * @param {string} themeName - Name of the theme to import
   * @private
   */
  _showThemeImportModal(themeName) {
    const _ = window._ || ((s) => s);
    const text = '<p>' + _("You don't have the style used by this project.") + '</p>' +
                 '<p>' + _('Do you want to install it?') + '</p>';

    eXeLearning.app.modals.confirm.show({
      title: _('Import style'),
      body: text,
      confirmExec: async () => {
        try {
          // Extract theme files from the stored ZIP
          const themeFilesData = this._extractThemeFilesFromZip();
          if (!themeFilesData || Object.keys(themeFilesData.files).length === 0) {
            throw new Error('Could not extract theme files from package');
          }

          Logger.log('[YjsProjectBridge] Importing theme:', themeName);

          // Parse config.xml to create theme configuration
          const themeConfig = this._parseThemeConfigFromFiles(themeName, themeFilesData);
          if (!themeConfig) {
            throw new Error('Could not parse theme configuration');
          }

          // 1. Compress theme files and save to IndexedDB (persistent local storage)
          if (this.resourceCache) {
            const compressedFiles = this._compressThemeFiles(themeFilesData.files);
            await this.resourceCache.setUserTheme(themeName, compressedFiles, themeConfig);
            Logger.log(`[YjsProjectBridge] Saved theme to IndexedDB: ${themeName}`);
          }

          // 2. Copy compressed theme to Yjs for collaboration/export
          await this._copyThemeToYjs(themeName, themeFilesData.files);

          // 3. Register theme files with ResourceFetcher for export and preview
          if (this.resourceFetcher) {
            await this.resourceFetcher.setUserThemeFiles(themeName, themeFilesData.files);
          }

          // 4. Add theme to local installed list
          eXeLearning.app.themes.list.addUserTheme(themeConfig);

          // 5. Refresh NavbarStyles UI to show the new theme immediately
          if (eXeLearning.app.menus?.navbar?.styles) {
            eXeLearning.app.menus.navbar.styles.updateThemes();
            // If styles panel is open, rebuild the list
            const stylesPanel = document.getElementById('stylessidenav');
            if (stylesPanel?.classList.contains('active')) {
              eXeLearning.app.menus.navbar.styles.buildUserListThemes();
            }
          }

          // Clean up stored references
          this._pendingThemeFile = null;
          this._pendingThemeZip = null;

          // Select the theme and save to metadata
          await eXeLearning.app.themes.selectTheme(themeName, true);
          Logger.log(`[YjsProjectBridge] Theme "${themeName}" imported successfully`);
        } catch (error) {
          console.error('[YjsProjectBridge] Theme import error:', error);
          // Clean up stored references
          this._pendingThemeFile = null;
          this._pendingThemeZip = null;
          eXeLearning.app.modals.alert.show({
            title: _('Error'),
            body: _('Failed to import style'),
          });
        }
      },
      cancelExec: () => {
        // Clean up stored references
        this._pendingThemeFile = null;
        this._pendingThemeZip = null;
        // Use default theme and save to Yjs (replacing imported theme in metadata)
        eXeLearning.app.themes.selectTheme(eXeLearning.config.defaultTheme, true);
      },
    });
  }

  /**
   * Extract theme files from stored ZIP
   * @returns {{files: Object<string, Uint8Array>, configXml: string|null}|null}
   * @private
   */
  _extractThemeFilesFromZip() {
    try {
      const zip = this._pendingThemeZip;
      if (!zip) {
        console.error('[YjsProjectBridge] No pending theme ZIP available');
        return null;
      }

      // Extract all files from theme/ folder
      const files = {};
      let configXml = null;

      for (const [filePath, fileData] of Object.entries(zip)) {
        if (filePath.startsWith('theme/') && !filePath.endsWith('/')) {
          // Remove 'theme/' prefix to get relative path
          const relativePath = filePath.substring(6); // 'theme/'.length = 6
          if (relativePath) {
            files[relativePath] = fileData;
            // Capture config.xml content
            if (relativePath === 'config.xml') {
              configXml = new TextDecoder().decode(fileData);
            }
          }
        }
      }

      if (Object.keys(files).length === 0) {
        console.error('[YjsProjectBridge] No theme files found in package');
        return null;
      }

      Logger.log(`[YjsProjectBridge] Extracted ${Object.keys(files).length} theme files`);
      return { files, configXml };
    } catch (error) {
      console.error('[YjsProjectBridge] Error extracting theme:', error);
      return null;
    }
  }

  /**
   * Parse theme configuration from extracted files
   * @param {string} themeName - Theme name/directory
   * @param {{files: Object, configXml: string|null}} themeFilesData
   * @returns {Object|null} Theme configuration object
   * @private
   */
  _parseThemeConfigFromFiles(themeName, themeFilesData) {
    try {
      const { files, configXml } = themeFilesData;

      // Default config values
      const config = {
        name: themeName,
        dirName: themeName,
        displayName: themeName,
        title: themeName,
        type: 'user', // User themes from .elpx
        version: '1.0',
        author: '',
        license: '',
        description: '',
        cssFiles: [],
        js: [],
        icons: {},
        valid: true,
        isUserTheme: true, // Flag to indicate this is a client-side theme
      };

      // Parse config.xml if available
      if (configXml) {
        const getValue = (tag) => {
          const match = configXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
          return match ? match[1].trim() : '';
        };

        config.name = getValue('name') || themeName;
        config.displayName = getValue('name') || themeName;
        config.title = getValue('name') || themeName;
        config.version = getValue('version') || '1.0';
        config.author = getValue('author') || '';
        config.license = getValue('license') || '';
        config.description = getValue('description') || '';
      }

      // Scan for CSS files
      for (const filePath of Object.keys(files)) {
        if (filePath.endsWith('.css') && !filePath.includes('/')) {
          config.cssFiles.push(filePath);
        }
      }
      if (config.cssFiles.length === 0) {
        config.cssFiles.push('style.css');
      }

      // Scan for JS files
      for (const filePath of Object.keys(files)) {
        if (filePath.endsWith('.js') && !filePath.includes('/')) {
          config.js.push(filePath);
        }
      }

      // Scan for icons
      for (const filePath of Object.keys(files)) {
        if (filePath.startsWith('icons/') && (filePath.endsWith('.png') || filePath.endsWith('.svg'))) {
          const iconName = filePath.replace('icons/', '').replace(/\.(png|svg)$/, '');
          config.icons[iconName] = filePath;
        }
      }

      return config;
    } catch (error) {
      console.error('[YjsProjectBridge] Error parsing theme config:', error);
      return null;
    }
  }

  /**
   * Convert Uint8Array to base64 string
   * @param {Uint8Array} uint8Array
   * @returns {string}
   * @private
   */
  _uint8ArrayToBase64(uint8Array) {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to Uint8Array
   * @param {string} base64
   * @returns {Uint8Array}
   * @private
   */
  _base64ToUint8Array(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Compress theme files to ZIP format using fflate
   * @param {Object<string, Uint8Array>} files - Map of relativePath -> file content
   * @returns {Uint8Array} Compressed ZIP data
   * @private
   */
  _compressThemeFiles(files) {
    if (!window.fflate) {
      throw new Error('fflate library not loaded');
    }

    // fflate.zipSync expects {filename: Uint8Array} format
    const toCompress = {};
    for (const [path, uint8Array] of Object.entries(files)) {
      toCompress[path] = uint8Array;
    }

    return window.fflate.zipSync(toCompress, { level: 6 });
  }

  /**
   * Copy theme to Yjs for collaboration and export
   * Stores the theme as a compressed ZIP in base64
   * @param {string} themeName - Theme name
   * @param {Object<string, Uint8Array>} files - Map of relativePath -> file content
   * @private
   */
  async _copyThemeToYjs(themeName, files) {
    try {
      const themeFilesMap = this.documentManager.getThemeFiles();

      // Compress files to ZIP
      const compressed = this._compressThemeFiles(files);

      // Convert to base64 for Yjs storage
      const base64Compressed = this._uint8ArrayToBase64(compressed);

      // Store as single compressed string in Yjs (NOT a Y.Map with individual files)
      themeFilesMap.set(themeName, base64Compressed);

      Logger.log(`[YjsProjectBridge] Copied theme '${themeName}' to Yjs (${Math.round(compressed.length / 1024)}KB compressed)`);
    } catch (error) {
      console.error(`[YjsProjectBridge] Error copying theme to Yjs:`, error);
      throw error;
    }
  }

  /**
   * Load a user theme from IndexedDB and register it
   * @param {string} themeName - Theme name
   * @private
   */
  async _loadUserThemeFromIndexedDB(themeName) {
    try {
      if (!this.resourceCache) {
        throw new Error('ResourceCache not initialized');
      }

      const userTheme = await this.resourceCache.getUserTheme(themeName);
      if (!userTheme) {
        throw new Error(`Theme '${themeName}' not found in IndexedDB`);
      }

      const { files, config } = userTheme;

      // Convert Map<string, Blob> to Object<string, Uint8Array> for ResourceFetcher
      const filesObject = {};
      for (const [path, blob] of files) {
        const arrayBuffer = await blob.arrayBuffer();
        filesObject[path] = new Uint8Array(arrayBuffer);
      }

      // Register with ResourceFetcher
      if (this.resourceFetcher) {
        await this.resourceFetcher.setUserThemeFiles(themeName, filesObject);
      }

      // Add to installed themes if not already there
      if (eXeLearning.app?.themes?.list?.installed && !eXeLearning.app.themes.list.installed[themeName]) {
        eXeLearning.app.themes.list.addUserTheme(config);
      }

      Logger.log(`[YjsProjectBridge] Loaded user theme '${themeName}' from IndexedDB`);
    } catch (error) {
      console.error(`[YjsProjectBridge] Error loading theme from IndexedDB:`, error);
      throw error;
    }
  }

  /**
   * Load user themes from Yjs into ResourceFetcher and theme list
   * This is called on initialization to restore user themes for:
   * - Reopening a project with user themes
   * - Joining a collaborative session where another user imported a theme
   *
   * Priority:
   * 1. Check if theme exists in local IndexedDB - use that if available
   * 2. If not in IndexedDB, decompress from Yjs and save to IndexedDB
   */
  async loadUserThemesFromYjs() {
    try {
      const themeFilesMap = this.documentManager.getThemeFiles();
      if (!themeFilesMap || themeFilesMap.size === 0) {
        Logger.log('[YjsProjectBridge] No user themes in Yjs to load');
        return;
      }

      Logger.log(`[YjsProjectBridge] Loading ${themeFilesMap.size} user theme(s) from Yjs...`);

      // Iterate over each theme in the themeFiles map
      for (const [themeName, themeData] of themeFilesMap.entries()) {
        await this._loadUserThemeFromYjs(themeName, themeData);
      }
    } catch (error) {
      console.error('[YjsProjectBridge] Error loading user themes from Yjs:', error);
    }
  }

  /**
   * Load a single user theme from Yjs
   * Handles both new compressed format (base64 ZIP) and legacy format (Y.Map)
   *
   * @param {string} themeName - Theme name
   * @param {string|Y.Map} themeData - Either base64 compressed ZIP (new) or Y.Map (legacy)
   * @private
   */
  async _loadUserThemeFromYjs(themeName, themeData) {
    try {
      // 1. Check if theme is already loaded in ResourceFetcher (memory)
      if (this.resourceFetcher?.hasUserTheme(themeName)) {
        Logger.log(`[YjsProjectBridge] User theme '${themeName}' already loaded in memory`);
        return;
      }

      // 2. Check if theme exists in IndexedDB - load from there if available
      if (this.resourceCache) {
        try {
          const hasInIndexedDB = await this.resourceCache.hasUserTheme(themeName);
          if (hasInIndexedDB) {
            Logger.log(`[YjsProjectBridge] User theme '${themeName}' found in IndexedDB, loading from there`);
            await this._loadUserThemeFromIndexedDB(themeName);
            return;
          }
        } catch (e) {
          console.warn(`[YjsProjectBridge] Error checking IndexedDB for theme '${themeName}':`, e);
        }
      }

      // 3. Theme not in IndexedDB - extract from Yjs
      let files = {};
      let configXml = null;

      // Check if new compressed format (base64 string) or legacy format (Y.Map)
      if (typeof themeData === 'string') {
        // New compressed format - decompress ZIP
        const decompressed = this._decompressThemeFromYjs(themeData);
        files = decompressed.files;
        configXml = decompressed.configXml;
      } else if (themeData && typeof themeData.entries === 'function') {
        // Legacy format - Y.Map with individual base64 files
        for (const [relativePath, base64Content] of themeData.entries()) {
          const uint8Array = this._base64ToUint8Array(base64Content);
          files[relativePath] = uint8Array;
          if (relativePath === 'config.xml') {
            configXml = new TextDecoder().decode(uint8Array);
          }
        }
      } else {
        Logger.log(`[YjsProjectBridge] Unknown theme data format for '${themeName}', skipping`);
        return;
      }

      if (Object.keys(files).length === 0) {
        Logger.log(`[YjsProjectBridge] User theme '${themeName}' has no files, skipping`);
        return;
      }

      Logger.log(`[YjsProjectBridge] Extracted ${Object.keys(files).length} files for user theme '${themeName}' from Yjs`);

      // Parse theme configuration
      const themeConfig = this._parseThemeConfigFromFiles(themeName, { files, configXml });
      if (!themeConfig) {
        console.warn(`[YjsProjectBridge] Could not parse config for theme '${themeName}'`);
        return;
      }

      // 4. Save to IndexedDB for persistence (so we don't need to extract from Yjs again)
      if (this.resourceCache) {
        try {
          const compressedFiles = this._compressThemeFiles(files);
          await this.resourceCache.setUserTheme(themeName, compressedFiles, themeConfig);
          Logger.log(`[YjsProjectBridge] Saved theme '${themeName}' to IndexedDB`);
        } catch (e) {
          console.warn(`[YjsProjectBridge] Could not save theme '${themeName}' to IndexedDB:`, e);
        }
      }

      // 5. Register with ResourceFetcher
      if (this.resourceFetcher) {
        await this.resourceFetcher.setUserThemeFiles(themeName, files);
      }

      // 6. Add to installed themes if not already there
      if (eXeLearning.app?.themes?.list?.installed && !eXeLearning.app.themes.list.installed[themeName]) {
        eXeLearning.app.themes.list.addUserTheme(themeConfig);
        Logger.log(`[YjsProjectBridge] Added user theme '${themeName}' to installed themes`);
      }
    } catch (error) {
      console.error(`[YjsProjectBridge] Error loading user theme '${themeName}':`, error);
    }
  }

  /**
   * Decompress theme files from Yjs (base64 ZIP format)
   * @param {string} base64Compressed - Base64 encoded ZIP data
   * @returns {{files: Object<string, Uint8Array>, configXml: string|null}}
   * @private
   */
  _decompressThemeFromYjs(base64Compressed) {
    if (!window.fflate) {
      throw new Error('fflate library not loaded');
    }

    // Decode base64 to Uint8Array
    const compressed = this._base64ToUint8Array(base64Compressed);

    // Decompress ZIP
    const decompressed = window.fflate.unzipSync(compressed);

    const files = {};
    let configXml = null;

    for (const [path, data] of Object.entries(decompressed)) {
      files[path] = data;
      if (path === 'config.xml') {
        configXml = new TextDecoder().decode(data);
      }
    }

    return { files, configXml };
  }

  /**
   * Set up observer for theme files changes (for collaborator sync)
   * When a collaborator imports a theme, this observer will load it locally
   * and save it to IndexedDB for persistence
   */
  setupThemeFilesObserver() {
    try {
      const themeFilesMap = this.documentManager.getThemeFiles();

      themeFilesMap.observe(async (event) => {
        // Process added themes
        for (const [themeName, change] of event.changes.keys) {
          if (change.action === 'add') {
            const themeData = themeFilesMap.get(themeName);
            if (themeData) {
              Logger.log(`[YjsProjectBridge] Collaborator added theme '${themeName}', loading...`);
              await this._loadUserThemeFromYjs(themeName, themeData);
            }
          } else if (change.action === 'delete') {
            Logger.log(`[YjsProjectBridge] Theme '${themeName}' removed from Yjs`);
            // Theme was removed - we leave it in IndexedDB (user may want to keep it)
            // But we should remove it from ResourceFetcher cache
            if (this.resourceFetcher?.userThemeFiles) {
              this.resourceFetcher.userThemeFiles.delete(themeName);
              this.resourceFetcher.cache.delete(`theme:${themeName}`);
            }
          }
        }
      });

      Logger.log('[YjsProjectBridge] Theme files observer set up');
    } catch (error) {
      console.error('[YjsProjectBridge] Error setting up theme files observer:', error);
    }
  }

  /**
   * Get the AssetManager instance
   * @returns {AssetManager|null}
   */
  getAssetManager() {
    return this.assetManager;
  }

  /**
   * Get the AssetWebSocketHandler instance
   * @returns {AssetWebSocketHandler|null}
   */
  getAssetWebSocketHandler() {
    return this.assetWebSocketHandler;
  }

  /**
   * Request missing assets that are referenced in HTML content.
   * This will coordinate with peers to fetch any assets we don't have locally.
   * @param {string} html - HTML content with asset:// references
   * @returns {Promise<string[]>} List of asset IDs that were requested
   */
  async requestMissingAssets(html) {
    if (!this.assetWebSocketHandler) {
      return [];
    }
    return this.assetWebSocketHandler.requestMissingAssetsFromHTML(html);
  }

  /**
   * Announce our asset availability to peers.
   * Call this after importing new assets to notify peers they're available.
   */
  async announceAssets() {
    if (this.assetWebSocketHandler) {
      await this.assetWebSocketHandler.announceAssetAvailability();
    }
  }

  /**
   * Import structure from API response into Yjs document.
   * Used when opening .elp or .elpx files to load the parsed structure
   * from the backend API into the Yjs collaborative document.
   * @param {Array} apiStructure - Array of pages from API response
   */
  importStructure(apiStructure) {
    if (!this.structureBinding) {
      console.error('[YjsProjectBridge] Cannot import structure: not initialized');
      return;
    }
    Logger.log('[YjsProjectBridge] Importing structure from API:', apiStructure?.length || 0, 'pages');
    this.structureBinding.importFromApiStructure(apiStructure);
    this.updateUndoRedoButtons();
  }

  /**
   * Clear all navigation data from Yjs document
   */
  clearNavigation() {
    if (!this.structureBinding) {
      console.error('[YjsProjectBridge] Cannot clear navigation: not initialized');
      return;
    }
    Logger.log('[YjsProjectBridge] Clearing navigation');
    this.structureBinding.clearNavigation();
  }

  /**
   * Register a structure change observer
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onStructureChange(callback) {
    this.structureObservers.push(callback);
    return () => {
      const idx = this.structureObservers.indexOf(callback);
      if (idx >= 0) this.structureObservers.splice(idx, 1);
    };
  }

  /**
   * Register a save status callback
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onSaveStatus(callback) {
    this.saveStatusCallbacks.push(callback);
    return () => {
      const idx = this.saveStatusCallbacks.indexOf(callback);
      if (idx >= 0) this.saveStatusCallbacks.splice(idx, 1);
    };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    Logger.log('[YjsProjectBridge] Disconnecting...');

    if (this.documentManager) {
      await this.documentManager.destroy();
    }

    // Cleanup AssetWebSocketHandler
    if (this.assetWebSocketHandler) {
      this.assetWebSocketHandler.destroy();
    }

    // Cleanup new AssetManager
    if (this.assetManager) {
      this.assetManager.cleanup();
    }

    // Cleanup legacy asset cache
    if (this.assetCache && typeof this.assetCache.destroy === 'function') {
      this.assetCache.destroy();
    }

    // Cleanup SaveManager (no explicit cleanup needed, just null reference)
    this.saveManager = null;

    // Cleanup ConnectionMonitor
    if (this.connectionMonitor) {
      this.connectionMonitor.destroy();
      this.connectionMonitor = null;
    }

    this.initialized = false;
    this.documentManager = null;
    this.structureBinding = null;
    this.lockManager = null;
    this.assetCache = null;
    this.assetManager = null;
    this.assetWebSocketHandler = null;

    Logger.log('[YjsProjectBridge] Disconnected');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YjsProjectBridge;
} else {
  window.YjsProjectBridge = YjsProjectBridge;
}

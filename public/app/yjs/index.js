/**
 * eXeLearning Yjs Module Index
 * Exports all Yjs-related classes for use in the application.
 *
 * Usage:
 *   // Load Yjs dependencies first (from CDN or bundled)
 *   // Then load these modules
 *
 *   // Quick start with bridge (recommended):
 *   const bridge = await YjsModules.initializeProject(projectId, authToken);
 *   bridge.enableAutoSync();
 *
 *   // Or manual setup:
 *   const manager = new YjsDocumentManager(projectId, config);
 *   await manager.initialize();
 *
 *   const binding = new YjsStructureBinding(manager);
 *   const pages = binding.getPages();
 *
 *   const assetCache = new AssetCacheManager(projectId);
 *   await assetCache.fetchAndCache(assetId, apiUrl, token);
 *
 *   // Import .elpx
 *   const importer = new ElpxImporter(manager, assetCache);
 *   await importer.importFromFile(file);
 *
 *   // Export .elpx
 *   const exporter = new ElpxExporter(manager, assetCache);
 *   await exporter.exportToFile('project.elpx');
 */

// Module exports for browser
window.YjsModules = {
  // Core modules
  YjsDocumentManager: window.YjsDocumentManager,
  YjsLockManager: window.YjsLockManager,
  YjsStructureBinding: window.YjsStructureBinding,
  AssetCacheManager: window.AssetCacheManager,

  // Import/Export
  ElpxImporter: window.ElpxImporter,
  ElpxExporter: window.ElpxExporter,
  ComponentImporter: window.ComponentImporter,

  // UI Integration
  YjsProjectBridge: window.YjsProjectBridge,
  YjsTinyMCEBinding: window.YjsTinyMCEBinding,
  YjsStructureTreeAdapter: window.YjsStructureTreeAdapter,
  YjsProjectManagerMixin: window.YjsProjectManagerMixin,
  YjsPropertiesBinding: window.YjsPropertiesBinding,

  // Active instances (populated at runtime)
  _bridge: null,
  _treeAdapter: null,

  /**
   * Initialize Yjs for a project (high-level API)
   * @param {number} projectId - Project ID
   * @param {string} authToken - JWT auth token
   * @param {Object} options - Optional configuration
   * @returns {Promise<YjsProjectBridge>}
   */
  async initializeProject(projectId, authToken, options = {}) {
    Logger.log('[YjsModules] Initializing project:', projectId);

    // Clean up previous instance if exists
    if (this._bridge) {
      await this._bridge.disconnect();
      this._bridge = null;
    }

    // Create and initialize bridge
    const app = window.eXeLearning?.app || null;
    const bridge = new window.YjsProjectBridge(app);
    await bridge.initialize(projectId, authToken, options);

    // Initialize tree adapter if container exists
    const treeContainerId = options.treeContainerId || 'structure-tree';
    if (document.getElementById(treeContainerId)) {
      this._treeAdapter = new window.YjsStructureTreeAdapter(
        bridge.structureBinding,
        treeContainerId
      );
      this._treeAdapter.addStyles();
      this._treeAdapter.initialize();
    }

    // Enable auto-sync by default
    if (options.autoSync !== false) {
      bridge.enableAutoSync();
    }

    this._bridge = bridge;
    Logger.log('[YjsModules] Project initialized successfully');

    return bridge;
  },

  /**
   * Get the current bridge instance
   * @returns {YjsProjectBridge|null}
   */
  getBridge() {
    return this._bridge;
  },

  /**
   * Get the tree adapter instance
   * @returns {YjsStructureTreeAdapter|null}
   */
  getTreeAdapter() {
    return this._treeAdapter;
  },

  /**
   * Disconnect and clean up all instances
   */
  async cleanup() {
    if (this._treeAdapter) {
      this._treeAdapter.destroy();
      this._treeAdapter = null;
    }

    if (this._bridge) {
      await this._bridge.disconnect();
      this._bridge = null;
    }

    Logger.log('[YjsModules] Cleanup complete');
  },

  /**
   * Check if Yjs is initialized for a project
   * @returns {boolean}
   */
  isInitialized() {
    return this._bridge !== null && this._bridge.initialized;
  },

  /**
   * Create a TinyMCE binding for an editor
   * @param {TinyMCE.Editor} editor - TinyMCE editor instance
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   * @param {string} componentId - Component ID
   * @returns {YjsTinyMCEBinding|null}
   */
  bindTinyMCE(editor, pageId, blockId, componentId) {
    if (!this._bridge) {
      console.warn('[YjsModules] Bridge not initialized');
      return null;
    }

    const component = this._bridge.structureBinding.getComponent(pageId, blockId, componentId);
    if (!component) {
      console.warn('[YjsModules] Component not found:', componentId);
      return null;
    }

    // Get or create Y.Text for HTML content
    let yText = component.get('htmlContent');

    // Handle case where htmlContent is a plain string (from import) or doesn't exist
    if (!yText || typeof yText === 'string') {
      // Check htmlContent first, then htmlView (from import) for existing content
      let existingContent = '';
      if (typeof yText === 'string' && yText) {
        existingContent = yText;
      } else {
        const htmlView = component.get('htmlView');
        if (typeof htmlView === 'string' && htmlView) {
          existingContent = htmlView;
        }
      }

      yText = new window.Y.Text();
      // IMPORTANT: Insert content BEFORE setting on component to avoid Yjs integration errors
      yText.insert(0, existingContent);
      component.set('htmlContent', yText);
    }

    // Create binding
    const binding = new window.YjsTinyMCEBinding(editor, yText, {
      awareness: this._bridge.documentManager?.awareness,
      userId: this._bridge.app?.user?.id || 'unknown',
      userName: this._bridge.app?.user?.name || 'User',
    });

    return binding;
  },
};

// Log availability
Logger.log('[eXeLearning] Yjs modules loaded:', Object.keys(window.YjsModules).filter(k => !k.startsWith('_')));

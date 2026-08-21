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
 *   // Import .elpx
 *   const importer = new ElpxImporter(manager, assetManager);
 *   await importer.importFromFile(file);
 *
 *   // Export .elpx
 *   const exporter = new ElpxExporter(manager, assetManager);
 *   await exporter.exportToFile('project.elpx');
 */

// Module exports for browser
window.YjsModules = {
  // Core modules
  ProjectTabTracker: window.ProjectTabTracker,
  YjsDocumentManager: window.YjsDocumentManager,
  YjsLockManager: window.YjsLockManager,
  YjsStructureBinding: window.YjsStructureBinding,

  // Import/Export
  ElpxImporter: window.ElpxImporter,
  ElpxExporter: window.ElpxExporter,
  ComponentImporter: window.ComponentImporter,

  // UI Integration
  YjsProjectBridge: window.YjsProjectBridge,
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
      // Clear asset resolver cache before cleanup (blobs will be revoked)
      if (window.eXeLearningAssetResolver?.clearCache) {
        window.eXeLearningAssetResolver.clearCache();
      }
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
    // Clear asset resolver cache BEFORE disconnecting (blobs will be revoked)
    if (window.eXeLearningAssetResolver?.clearCache) {
      window.eXeLearningAssetResolver.clearCache();
    }

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
};

// Log availability
Logger.log('[eXeLearning] Yjs modules loaded:', Object.keys(window.YjsModules).filter(k => !k.startsWith('_')));

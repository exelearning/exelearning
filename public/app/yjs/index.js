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
  YjsTinyMCEBinding: window.YjsTinyMCEBinding,
  YjsProseMirrorBinding: window.YjsProseMirrorBinding,
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

  /**
   * Create a ProseMirror binding for an editor
   * @param {ProseMirrorEditor} editor - ProseMirror editor instance
   * @param {string} pageId - Page ID
   * @param {string} blockId - Block ID
   * @param {string} componentId - Component ID
   * @param {string} [fieldName='htmlContent'] - Field name in component for content
   * @returns {YjsProseMirrorBinding|null}
   */
  bindProseMirror(editor, pageId, blockId, componentId, fieldName = 'htmlContent') {
    if (!this._bridge) {
      console.warn('[YjsModules] Bridge not initialized');
      return null;
    }

    if (!window.YjsProseMirrorBinding) {
      console.warn('[YjsModules] YjsProseMirrorBinding not loaded. Call YjsLoader.loadProseMirror() first.');
      return null;
    }

    const component = this._bridge.structureBinding.getComponent(pageId, blockId, componentId);
    if (!component) {
      console.warn('[YjsModules] Component not found:', componentId);
      return null;
    }

    // Get or create Y.XmlFragment for ProseMirror content
    // Note: y-prosemirror uses XmlFragment, not Text like TinyMCE
    let yXmlFragment = component.get(fieldName);

    // Handle case where field is a plain string (from import) or doesn't exist
    if (!yXmlFragment || typeof yXmlFragment === 'string' || !(yXmlFragment instanceof window.Y.XmlFragment)) {
      // Check for existing HTML content to migrate
      let existingContent = '';
      if (typeof yXmlFragment === 'string' && yXmlFragment) {
        existingContent = yXmlFragment;
      } else {
        // Try htmlView (from import)
        const htmlView = component.get('htmlView');
        if (typeof htmlView === 'string' && htmlView) {
          existingContent = htmlView;
        }
      }

      // Create new XmlFragment
      yXmlFragment = new window.Y.XmlFragment();
      component.set(fieldName, yXmlFragment);

      // If there's existing HTML, set it via the editor after binding
      if (existingContent && editor) {
        // Defer setting content until binding is complete
        setTimeout(() => {
          if (!editor.isDestroyed()) {
            editor.setHTML(existingContent);
          }
        }, 0);
      }
    }

    // Create binding
    const binding = new window.YjsProseMirrorBinding(editor, yXmlFragment, {
      awareness: this._bridge.documentManager?.awareness,
      userId: this._bridge.app?.user?.id || 'unknown',
      userName: this._bridge.app?.user?.name || 'User',
    });

    Logger.log('[YjsModules] ProseMirror binding created for', componentId, fieldName);

    return binding;
  },

  /**
   * Bind a Lexical editor to Yjs for collaborative editing
   * Uses @lexical/yjs API which requires (editor, provider, id, doc, docMap)
   * @param {LexicalEditor} editor - LexicalEditor wrapper instance
   * @param {string} pageId - Page ID (unused, kept for API compatibility)
   * @param {string} blockId - Block ID (unused, kept for API compatibility)
   * @param {string} componentId - Component ID
   * @param {string} [fieldName='htmlContent'] - Field name to bind
   * @returns {YjsLexicalBinding|null}
   */
  bindLexical(editor, pageId, blockId, componentId, fieldName = 'htmlContent') {
    // Try YjsModules._bridge first, then fall back to project bridge
    const bridge = this._bridge || window.eXeLearning?.app?.project?._yjsBridge;
    if (!bridge) {
      console.warn('[YjsModules] Bridge not initialized');
      return null;
    }

    if (!window.YjsLexicalBinding) {
      console.warn('[YjsModules] YjsLexicalBinding not loaded. Call YjsLoader.loadLexical() first.');
      return null;
    }

    // YjsDocumentManager stores the doc as 'ydoc', not 'doc'
    const ydoc = bridge.documentManager?.ydoc || bridge.documentManager?.getDoc?.();
    if (!ydoc) {
      console.warn('[YjsModules] Y.Doc not available');
      return null;
    }

    // Create a unique binding ID for this editor instance
    const bindingId = `${componentId}-${fieldName}`;

    // Check for existing HTML content to migrate
    const component = bridge.structureBinding?.getComponent(componentId);
    if (component) {
      let existingContent = '';
      const currentValue = component[fieldName];
      if (typeof currentValue === 'string' && currentValue) {
        existingContent = currentValue;
      } else {
        // Try htmlView (from import)
        const htmlView = component.htmlView;
        if (typeof htmlView === 'string' && htmlView) {
          existingContent = htmlView;
        }
      }

      // If there's existing HTML, set it via the editor after binding
      if (existingContent && editor) {
        setTimeout(() => {
          if (!editor.isDestroyed()) {
            editor.setHTML(existingContent);
          }
        }, 100);
      }
    }

    // Create binding using @lexical/yjs API
    // Note: YjsDocumentManager uses 'wsProvider', not 'provider'
    const wsProvider = bridge.documentManager?.wsProvider;
    Logger.log('[YjsModules] bindLexical - Provider state:', {
      hasProvider: !!wsProvider,
      hasAwareness: !!wsProvider?.awareness,
      wsconnected: wsProvider?.wsconnected,
      ydocClientId: ydoc?.clientID,
    });

    const binding = new window.YjsLexicalBinding(editor, bindingId, {
      ydoc: ydoc,
      provider: wsProvider,
      assetManager: bridge.assetManager,
      userId: bridge.app?.user?.id || 'unknown',
      userName: bridge.app?.user?.name || 'User',
    });

    Logger.log('[YjsModules] Lexical binding created for', componentId, fieldName);

    return binding;
  },
};

// Log availability
Logger.log('[eXeLearning] Yjs modules loaded:', Object.keys(window.YjsModules).filter(k => !k.startsWith('_')));

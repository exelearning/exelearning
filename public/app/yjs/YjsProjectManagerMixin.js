/**
 * YjsProjectManagerMixin
 * Mixin that adds Yjs capabilities to the existing projectManager.
 * Call applyMixin() to enhance an existing projectManager instance.
 *
 * Usage:
 *   // After projectManager is created:
 *   YjsProjectManagerMixin.applyMixin(eXeLearning.app.project);
 *
 *   // Then enable Yjs mode for a project:
 *   await eXeLearning.app.project.enableYjsMode(projectId, authToken);
 */
const YjsProjectManagerMixin = {
  /**
   * Apply the mixin to a projectManager instance
   * @param {Object} projectManager - The projectManager instance to enhance
   */
  applyMixin(projectManager) {
    // Store original methods for fallback
    const originalSave = projectManager.save?.bind(projectManager);
    const originalGenerateIntervalAutosave = projectManager.generateIntervalAutosave?.bind(projectManager);

    // Add Yjs properties
    projectManager._yjsEnabled = false;
    projectManager._yjsBridge = null;
    projectManager._yjsBindings = new Map(); // TinyMCE bindings

    /**
     * Enable Yjs mode for the current project
     * @param {number} projectId - Project ID
     * @param {string} authToken - JWT authentication token
     * @param {Object} options - Configuration options
     * @returns {Promise<YjsProjectBridge>}
     */
    projectManager.enableYjsMode = async function (projectId, authToken, options = {}) {
      Logger.log('[ProjectManager] Enabling Yjs mode for project:', projectId);

      // Ensure Yjs modules are loaded
      if (!window.YjsModules) {
        if (window.YjsLoader) {
          await window.YjsLoader.load();
        } else {
          throw new Error('Yjs modules not loaded. Include yjs-loader.js first.');
        }
      }

      // Initialize bridge
      this._yjsBridge = await window.YjsModules.initializeProject(projectId, authToken, {
        treeContainerId: options.treeContainerId || 'structure-menu-nav',
        ...options,
      });

      // Disable legacy autosave
      if (this.intervalSaveOde) {
        clearInterval(this.intervalSaveOde);
        this.intervalSaveOde = null;
      }

      this._yjsEnabled = true;

      // Set up TinyMCE editor hook for auto-binding to Yjs
      this._setupTinyMCEHook();

      Logger.log('[ProjectManager] Yjs mode enabled');

      // Update title element now that Yjs is ready
      if (this.app?.interface?.odeTitleElement) {
        this.app.interface.odeTitleElement.setTitle();
        this.app.interface.odeTitleElement.initYjsBinding();
        Logger.log('[ProjectManager] Title element updated from Yjs');
      }

      // Initialize theme binding now that Yjs is ready
      if (this.app?.themes) {
        this.app.themes.initYjsBinding();
        Logger.log('[ProjectManager] Theme binding initialized from Yjs');
      }

      return this._yjsBridge;
    };

    /**
     * Set up TinyMCE hook for automatic Yjs binding
     * @private
     */
    projectManager._setupTinyMCEHook = function () {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      // Store original hook if exists
      const originalHook = window.$exeTinyMCE?.onEditorInit;

      // Set up the hook for TinyMCE editor initialization
      if (window.$exeTinyMCE) {
        window.$exeTinyMCE.onEditorInit = function (editor) {
          // Call original hook if exists
          if (originalHook) {
            originalHook(editor);
          }

          // Skip if Yjs is not enabled
          if (!self._yjsEnabled || !self._yjsBridge) {
            return;
          }

          // Try to extract page/block/component IDs from the editor context
          const ids = self._extractIdsFromEditor(editor);
          if (ids) {
            Logger.log('[YjsHook] Binding editor to Yjs:', ids);
            self.bindEditorToYjs(editor, ids.pageId, ids.blockId, ids.componentId);
          } else {
            Logger.log('[YjsHook] Could not extract IDs for editor:', editor.id);
          }
        };
      }
    };

    /**
     * Extract page, block, and component IDs from TinyMCE editor context
     * @private
     */
    projectManager._extractIdsFromEditor = function (editor) {
      try {
        // Try to get IDs from the editor container's data attributes or parent elements
        const container = editor.getContainer();
        if (!container) return null;

        // Walk up to find idevice container with data attributes
        let element = container;
        let ideviceEl = null;
        let blockEl = null;

        while (element && element !== document.body) {
          if (element.classList?.contains('idevice-node') || element.dataset?.odeIdeviceId) {
            ideviceEl = element;
          }
          if (element.classList?.contains('block-node') || element.dataset?.odeBlockId) {
            blockEl = element;
          }
          element = element.parentElement;
        }

        // Get active page ID from structure
        const activePageId = this.structure?.nodeSelected?.id ||
                            this.structure?.nodeSelected?.pageId ||
                            document.querySelector('.structure-node.selected')?.dataset?.pageId;

        if (!activePageId) {
          Logger.log('[YjsHook] No active page ID found');
          return null;
        }

        // Get block ID
        const blockId = blockEl?.dataset?.odeBlockId ||
                       ideviceEl?.closest('[data-ode-block-id]')?.dataset?.odeBlockId ||
                       'default-block';

        // Get component/iDevice ID
        const componentId = ideviceEl?.dataset?.odeIdeviceId ||
                           container.closest('[data-ode-idevice-id]')?.dataset?.odeIdeviceId;

        if (!componentId) {
          Logger.log('[YjsHook] No component ID found');
          return null;
        }

        return {
          pageId: activePageId,
          blockId: blockId,
          componentId: componentId,
        };
      } catch (error) {
        console.error('[YjsHook] Error extracting IDs:', error);
        return null;
      }
    };

    /**
     * Disable Yjs mode and revert to legacy behavior
     */
    projectManager.disableYjsMode = async function () {
      if (!this._yjsEnabled) return;

      Logger.log('[ProjectManager] Disabling Yjs mode');

      // Clean up bindings
      for (const binding of this._yjsBindings.values()) {
        binding.destroy?.();
      }
      this._yjsBindings.clear();

      // Clean up Yjs
      if (window.YjsModules) {
        await window.YjsModules.cleanup();
      }

      this._yjsBridge = null;
      this._yjsEnabled = false;

      // Re-enable legacy autosave
      if (originalGenerateIntervalAutosave) {
        originalGenerateIntervalAutosave();
      }

      Logger.log('[ProjectManager] Yjs mode disabled');
    };

    /**
     * Check if Yjs mode is enabled
     * @returns {boolean}
     */
    projectManager.isYjsEnabled = function () {
      return this._yjsEnabled && this._yjsBridge !== null;
    };

    /**
     * Get the Yjs bridge instance
     * @returns {YjsProjectBridge|null}
     */
    projectManager.getYjsBridge = function () {
      return this._yjsBridge;
    };

    /**
     * Override save to use Yjs when enabled
     */
    projectManager.save = async function (...args) {
      if (this._yjsEnabled && this._yjsBridge) {
        Logger.log('[ProjectManager] Saving via Yjs...');
        return await this._yjsBridge.save();
      }

      // Fallback to original save
      if (originalSave) {
        return originalSave(...args);
      }
    };

    /**
     * Override autosave generation to skip when Yjs is enabled
     */
    projectManager.generateIntervalAutosave = function (...args) {
      if (this._yjsEnabled) {
        Logger.log('[ProjectManager] Autosave skipped - using Yjs auto-sync');
        return;
      }

      // Fallback to original
      if (originalGenerateIntervalAutosave) {
        return originalGenerateIntervalAutosave(...args);
      }
    };

    /**
     * Bind a TinyMCE editor to Yjs for collaborative editing
     * @param {TinyMCE.Editor} editor - TinyMCE editor instance
     * @param {string} pageId - Page ID
     * @param {string} blockId - Block ID
     * @param {string} componentId - Component ID (iDevice ID)
     * @returns {Object|null} The binding object or null
     */
    projectManager.bindEditorToYjs = function (editor, pageId, blockId, componentId) {
      if (!this._yjsEnabled || !window.YjsModules) {
        return null;
      }

      // Clean up existing binding for this component
      const existingBinding = this._yjsBindings.get(componentId);
      if (existingBinding) {
        existingBinding.destroy?.();
        this._yjsBindings.delete(componentId);
      }

      // Create new binding
      const binding = window.YjsModules.bindTinyMCE(editor, pageId, blockId, componentId);
      if (binding) {
        this._yjsBindings.set(componentId, binding);
      }

      return binding;
    };

    /**
     * Unbind a TinyMCE editor from Yjs
     * @param {string} componentId - Component ID
     */
    projectManager.unbindEditorFromYjs = function (componentId) {
      const binding = this._yjsBindings.get(componentId);
      if (binding) {
        binding.destroy?.();
        this._yjsBindings.delete(componentId);
      }
    };

    /**
     * Acquire lock on an iDevice for editing
     * @param {string} componentId - Component/iDevice ID
     * @returns {boolean} Whether lock was acquired
     */
    projectManager.acquireIdeviceLock = function (componentId) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return true; // Always allow in non-Yjs mode
      }
      return this._yjsBridge.acquireLock(componentId);
    };

    /**
     * Release lock on an iDevice
     * @param {string} componentId - Component/iDevice ID
     */
    projectManager.releaseIdeviceLock = function (componentId) {
      if (this._yjsEnabled && this._yjsBridge) {
        this._yjsBridge.releaseLock(componentId);
      }
    };

    /**
     * Check if an iDevice is locked by another user
     * @param {string} componentId - Component/iDevice ID
     * @returns {Object|null} Lock info or null
     */
    projectManager.getIdeviceLockInfo = function (componentId) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return null;
      }
      return this._yjsBridge.getLockInfo(componentId);
    };

    /**
     * Add a page via Yjs (when enabled)
     * @param {string} pageName - Page name
     * @param {string} parentId - Parent page ID (optional)
     * @returns {Object|null} Created page or null
     */
    projectManager.addPageViaYjs = function (pageName, parentId = null) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return null;
      }
      return this._yjsBridge.addPage(pageName, parentId);
    };

    /**
     * Delete a page via Yjs (when enabled)
     * @param {string} pageId - Page ID
     * @returns {boolean} Success status (true if page was found and deleted)
     */
    projectManager.deletePageViaYjs = function (pageId) {
      if (this._yjsEnabled && this._yjsBridge) {
        const success = this._yjsBridge.deletePage(pageId);
        if (!success) {
          console.error(`[YjsProjectManager] Failed to delete page: ${pageId}`);
        }
        return success;
      }
      return false;
    };

    /**
     * Rename a page via Yjs (when enabled)
     * @param {string} pageId - Page ID
     * @param {string} newName - New page name
     * @returns {boolean} Success status
     */
    projectManager.renamePageViaYjs = function (pageId, newName) {
      if (this._yjsEnabled && this._yjsBridge) {
        // Update both pageName and title to ensure Preview and exports show the new name
        // ELPX imports set both fields, and YjsDocumentAdapter.convertPage() prioritizes 'title'
        this._yjsBridge.updatePage(pageId, { pageName: newName, title: newName });
        Logger.log('[YjsProjectManager] Renamed page via Yjs:', pageId, newName);
        return true;
      }
      return false;
    };

    /**
     * Clone a page via Yjs (when enabled)
     * @param {string} pageId - Page ID to clone
     * @param {string} newName - Name for the cloned page (optional)
     * @returns {Object|null} The cloned page or null
     */
    projectManager.clonePageViaYjs = function (pageId, newName = null) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return null;
      }
      return this._yjsBridge.clonePage(pageId, newName);
    };

    /**
     * Move a page via Yjs (when enabled)
     * @param {string} pageId - Page ID to move
     * @param {string} newParentId - New parent page ID (null for root)
     * @param {number} newIndex - New position index
     * @returns {boolean} Success status
     */
    projectManager.movePageViaYjs = function (pageId, newParentId = null, newIndex = null) {
      if (this._yjsEnabled && this._yjsBridge) {
        const result = this._yjsBridge.movePage(pageId, newParentId, newIndex);
        if (!result) {
          console.warn(`[YjsProjectManager] movePageViaYjs failed for page ${pageId}`);
        }
        return result;
      }
      return false;
    };

    /**
     * Add a block via Yjs (when enabled)
     * @param {string} pageId - Page ID
     * @param {string} blockName - Block name
     * @returns {string|null} Created block ID or null
     */
    projectManager.addBlockViaYjs = function (pageId, blockName = 'Block') {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return null;
      }
      return this._yjsBridge.addBlock(pageId, blockName);
    };

    /**
     * Delete a block via Yjs (when enabled)
     * @param {string} pageId - Page ID
     * @param {string} blockId - Block ID to delete
     * @returns {boolean} Success status
     */
    projectManager.deleteBlockViaYjs = function (pageId, blockId) {
      if (this._yjsEnabled && this._yjsBridge) {
        this._yjsBridge.deleteBlock(pageId, blockId);
        return true;
      }
      return false;
    };

    /**
     * Clone a block via Yjs (when enabled)
     * @param {string} pageId - Page ID
     * @param {string} blockId - Block ID to clone
     * @returns {Object|null} The cloned block or null
     */
    projectManager.cloneBlockViaYjs = function (pageId, blockId) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return null;
      }
      return this._yjsBridge.cloneBlock(pageId, blockId);
    };

    /**
     * Add a component (iDevice) via Yjs (when enabled)
     * @param {string} pageId - Page ID
     * @param {string} blockId - Block ID
     * @param {string} ideviceType - iDevice type
     * @param {Object} initialData - Initial properties (optional)
     * @returns {string|null} Created component ID or null
     */
    projectManager.addComponentViaYjs = function (pageId, blockId, ideviceType, initialData = {}) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return null;
      }
      return this._yjsBridge.addComponent(pageId, blockId, ideviceType, initialData);
    };

    /**
     * Delete a component via Yjs (when enabled)
     * @param {string} componentId - Component ID to delete
     * @returns {boolean} Success status
     */
    projectManager.deleteComponentViaYjs = function (componentId) {
      if (this._yjsEnabled && this._yjsBridge) {
        this._yjsBridge.deleteComponent(componentId);
        return true;
      }
      return false;
    };

    /**
     * Clone a component via Yjs (when enabled)
     * @param {string} pageId - Page ID
     * @param {string} blockId - Block ID
     * @param {string} componentId - Component ID to clone
     * @returns {Object|null} The cloned component or null
     */
    projectManager.cloneComponentViaYjs = function (pageId, blockId, componentId) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        return null;
      }
      return this._yjsBridge.cloneComponent(pageId, blockId, componentId);
    };

    /**
     * Update component properties via Yjs
     * @param {string} componentId - Component ID
     * @param {Object} props - Properties to update
     */
    projectManager.updateComponentViaYjs = function (componentId, props) {
      if (this._yjsEnabled && this._yjsBridge) {
        this._yjsBridge.updateComponent(componentId, props);
      }
    };

    /**
     * Update component HTML content via Yjs
     * @param {string} pageId - Page ID
     * @param {string} blockId - Block ID
     * @param {string} componentId - Component ID
     * @param {string} html - HTML content
     */
    projectManager.updateComponentHtmlViaYjs = function (pageId, blockId, componentId, html) {
      if (this._yjsEnabled && this._yjsBridge) {
        this._yjsBridge.setComponentHtml(pageId, blockId, componentId, html);
      }
    };

    /**
     * Export project to .elpx file via Yjs
     * Filename is auto-generated from project title (sanitized: lowercase, no accents, no special chars)
     * @param {Object} options - Export options
     * @param {boolean} options.saveAs - If true, always prompt for save location (Save As behavior)
     */
    projectManager.exportToElpxViaYjs = async function (options = {}) {
      if (this._yjsEnabled && this._yjsBridge) {
        await this._yjsBridge.exportToElpx(options);
      }
    };

    /**
     * Import project from .elpx file via Yjs
     * @param {File} file - The .elpx file
     * @param {Object} options - Import options
     * @param {boolean} options.clearExisting - If true, clears existing structure before import (default: true)
     * @returns {Promise<Object>} Import statistics
     */
    projectManager.importFromElpxViaYjs = async function (file, options = {}) {
      if (this._yjsEnabled && this._yjsBridge) {
        return await this._yjsBridge.importFromElpx(file, options);
      }
      return null;
    };

    /**
     * Import converted legacy structure from backend into Yjs
     * Used for legacy .elp files with contentv3.xml (Python pickle format)
     * @param {Object} structure - Parsed structure from backend
     * @param {Array} assets - Base64-encoded assets from backend
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import statistics
     */
    projectManager.importConvertedStructure = async function (structure, assets, options = {}) {
      if (!this._yjsEnabled || !this._yjsBridge) {
        console.warn('[ProjectManager] Cannot import: Yjs not enabled');
        return null;
      }

      const { clearExisting = false } = options;
      Logger.log(`[ProjectManager] Importing converted structure: ${structure?.pages?.length || 0} pages, ${assets?.length || 0} assets`);

      const stats = { pages: 0, blocks: 0, components: 0, assets: 0 };
      const assetManager = this._yjsBridge.getAssetManager();
      const assetMap = new Map();

      // 1. Import assets first (convert base64 to blobs and store in IndexedDB)
      if (assetManager && assets && assets.length > 0) {
        for (const asset of assets) {
          try {
            // Convert base64 to blob
            const binary = atob(asset.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: asset.mime });

            // Create a File object for insertImage
            const fileName = asset.path.split('/').pop() || 'asset';
            const file = new File([blob], fileName, { type: asset.mime });

            // Store in AssetManager
            const assetUrl = await assetManager.insertImage(file);
            // Extract just the UUID from the asset:// URL (format: asset://uuid/filename)
            const assetUrlPath = assetUrl.replace('asset://', '');
            const assetId = assetUrlPath.split('/')[0]; // Just the UUID
            const assetFileName = assetUrlPath.split('/').slice(1).join('/') || fileName;
            // Store mapping: originalPath -> {id, filename} for proper URL generation
            assetMap.set(asset.path, { id: assetId, filename: assetFileName });

            stats.assets++;
          } catch (e) {
            console.warn(`[ProjectManager] Failed to import asset ${asset.path}:`, e);
          }
        }
        Logger.log(`[ProjectManager] Imported ${stats.assets} assets`);
      }

      // Helper to replace asset paths in strings
      // Always returns a string (empty string if input is invalid)
      const replaceAssetPaths = (str) => {
        if (str == null || typeof str !== 'string') return '';
        for (const [originalPath, assetInfo] of assetMap.entries()) {
          const { id: assetId, filename: assetFileName } = assetInfo;
          const assetUrl = `asset://${assetId}/${assetFileName}`;
          const fileName = originalPath.split('/').pop();
          str = str.split(`{{context_path}}/${originalPath}`).join(assetUrl);
          str = str.split(originalPath).join(assetUrl);
          if (fileName) {
            // Only replace bare filename references in src/href attributes to avoid
            // corrupting existing asset:// URLs that already contain the filename
            const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            str = str.replace(
              new RegExp(`(src|href)=["']${escapedFileName}["']`, 'g'),
              `$1="${assetUrl}"`
            );
          }
        }
        return str;
      };

      // 2. Import structure into Yjs
      const documentManager = this._yjsBridge.getDocumentManager();
      const navigation = documentManager.getNavigation();
      const Y = window.Y;

      if (clearExisting) {
        while (navigation.length > 0) {
          navigation.delete(0);
        }
      }

      // Helper: Flatten hierarchical structure to flat array with parentId
      // Backend returns pages with children[] arrays, but Yjs expects flat with parentId
      const flattenPages = (pages, parentId = null, result = []) => {
        if (!pages || !Array.isArray(pages)) return result;
        for (const page of pages) {
          // Add page with correct parentId
          const flatPage = { ...page, parent_id: parentId };
          result.push(flatPage);
          // Recursively flatten children
          if (page.children && Array.isArray(page.children)) {
            flattenPages(page.children, page.id, result);
          }
        }
        return result;
      };

      // Flatten the structure - ALL pages go into navigation array
      let flatPages = [];
      if (structure.pages && Array.isArray(structure.pages)) {
        // Check if structure is already flat (has parent_id) or hierarchical (has children)
        const hasChildren = structure.pages.some(p => p.children && p.children.length > 0);
        if (hasChildren) {
          // Hierarchical structure from backend - flatten it
          const rootPages = structure.pages.filter(p => !p.parent_id);
          flatPages = flattenPages(rootPages, null);
          Logger.log(`[ProjectManager] Flattened ${structure.pages.length} pages to ${flatPages.length} flat pages`);
        } else {
          // Already flat structure
          flatPages = structure.pages;
        }
      }

      // Import each page as a flat entry in navigation (NO nested children arrays)
      const importPage = (pageData) => {
        const pageMap = new Y.Map();
        const pageId = pageData.id || `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        pageMap.set('id', pageId);
        pageMap.set('pageId', pageId);
        pageMap.set('pageName', pageData.title || pageData.pageName || 'Untitled');
        pageMap.set('title', pageData.title || pageData.pageName || 'Untitled');
        pageMap.set('parentId', pageData.parent_id || null);
        pageMap.set('order', pageData.position || 0);
        pageMap.set('createdAt', new Date().toISOString());

        const blocksArray = new Y.Array();
        if (pageData.blocks && Array.isArray(pageData.blocks)) {
          for (const blockData of pageData.blocks) {
            const blockMap = new Y.Map();
            const blockId = blockData.id || `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            blockMap.set('id', blockId);
            blockMap.set('blockId', blockId);
            blockMap.set('blockName', blockData.name ?? '');  // Preserve empty string for legacy imports
            blockMap.set('order', blockData.position || 0);

            const componentsArray = new Y.Array();
            if (blockData.idevices && Array.isArray(blockData.idevices)) {
              for (const ideviceData of blockData.idevices) {
                const compMap = new Y.Map();
                const compId = ideviceData.id || `idevice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                compMap.set('id', compId);
                compMap.set('ideviceId', compId);
                compMap.set('ideviceType', ideviceData.type || 'FreeTextIdevice');
                compMap.set('type', ideviceData.type || 'FreeTextIdevice');
                compMap.set('order', ideviceData.position || 0);

                if (ideviceData.htmlView) {
                  const transformedHtml = replaceAssetPaths(ideviceData.htmlView);
                  // Store as plain string - Y.Text will be created on-demand when TinyMCE binds
                  compMap.set('htmlView', transformedHtml || '');
                }

                componentsArray.push([compMap]);
                stats.components++;
              }
            }

            blockMap.set('components', componentsArray);
            blockMap.set('idevices', componentsArray);
            blocksArray.push([blockMap]);
            stats.blocks++;
          }
        }
        pageMap.set('blocks', blocksArray);

        return pageMap;
      };

      // Import ALL pages flat into navigation (tree is reconstructed by parentId on read)
      for (const pageData of flatPages) {
        const pageMap = importPage(pageData);
        navigation.push([pageMap]);
        stats.pages++;
      }

      if (assetManager) {
        await assetManager.preloadAllAssets();
      }

      Logger.log(`[ProjectManager] Import complete:`, stats);
      return stats;
    };

    /**
     * Undo last action (Yjs mode only)
     */
    projectManager.undo = function () {
      if (this._yjsEnabled && this._yjsBridge) {
        this._yjsBridge.undo();
      }
    };

    /**
     * Redo last undone action (Yjs mode only)
     */
    projectManager.redo = function () {
      if (this._yjsEnabled && this._yjsBridge) {
        this._yjsBridge.redo();
      }
    };

    /**
     * Register a callback for structure changes
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    projectManager.onStructureChange = function (callback) {
      if (this._yjsEnabled && this._yjsBridge) {
        return this._yjsBridge.onStructureChange(callback);
      }
      return () => {}; // No-op unsubscribe
    };

    /**
     * Register a callback for save status changes
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    projectManager.onSaveStatus = function (callback) {
      if (this._yjsEnabled && this._yjsBridge) {
        return this._yjsBridge.onSaveStatus(callback);
      }
      return () => {}; // No-op unsubscribe
    };

    /**
     * Observe component content changes for real-time collaboration
     * @param {string} componentId - Component ID
     * @param {Function} callback - Called with (content, isRemote)
     * @returns {Function} Unsubscribe function
     */
    projectManager.observeComponentContent = function (componentId, callback) {
      if (this._yjsEnabled && this._yjsBridge) {
        return this._yjsBridge.observeComponentContent(componentId, callback);
      }
      return () => {}; // No-op unsubscribe
    };

    /**
     * Get all pages from Yjs
     * @returns {Array} Array of page objects
     */
    projectManager.getPagesFromYjs = function () {
      if (this._yjsEnabled && this._yjsBridge && this._yjsBridge.structureBinding) {
        return this._yjsBridge.structureBinding.getPages();
      }
      return [];
    };

    /**
     * Get all blocks for a page from Yjs
     * @param {string} pageId - Page ID
     * @returns {Array} Array of block objects
     */
    projectManager.getBlocksFromYjs = function (pageId) {
      if (this._yjsEnabled && this._yjsBridge && this._yjsBridge.structureBinding) {
        return this._yjsBridge.structureBinding.getBlocks(pageId);
      }
      return [];
    };

    /**
     * Get all components for a block from Yjs
     * @param {string} pageId - Page ID
     * @param {string} blockId - Block ID
     * @returns {Array} Array of component objects
     */
    projectManager.getComponentsFromYjs = function (pageId, blockId) {
      if (this._yjsEnabled && this._yjsBridge && this._yjsBridge.structureBinding) {
        return this._yjsBridge.structureBinding.getComponents(pageId, blockId);
      }
      return [];
    };

    Logger.log('[YjsProjectManagerMixin] Mixin applied to projectManager');
  },

  /**
   * Check if mixin has been applied
   * @param {Object} projectManager - The projectManager instance
   * @returns {boolean}
   */
  isApplied(projectManager) {
    return typeof projectManager.enableYjsMode === 'function';
  },
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YjsProjectManagerMixin;
} else {
  window.YjsProjectManagerMixin = YjsProjectManagerMixin;
}

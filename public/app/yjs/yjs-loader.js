/**
 * Yjs Module Loader
 * Dynamically loads all Yjs modules in the correct order.
 * Include this script to bootstrap the Yjs system.
 *
 * Usage in HTML:
 *   <script src="/app/yjs/yjs-loader.js"></script>
 *   <script>
 *     YjsLoader.load().then(() => {
 *       // All modules ready
 *       YjsModules.initializeProject(projectId, authToken);
 *     });
 *   </script>
 */
(function () {
  'use strict';

  // Global Logger for Yjs modules - respects APP_DEBUG setting
  // Must be defined before loading modules that use it
  if (!window.AppLogger) {
    const isDebug = () => window.__APP_DEBUG__ === '1' || window.__APP_DEBUG__ === true;
    window.AppLogger = {
      log: (...args) => isDebug() && console.log(...args),
      debug: (...args) => isDebug() && console.debug(...args),
      info: (...args) => isDebug() && console.info(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
    };
  }
  // Expose Logger globally for all Yjs modules loaded as scripts
  window.Logger = window.AppLogger;
  const Logger = window.Logger;

  // Get basePath and version from eXeLearning (set by pages.controller.ts)
  const getBasePath = () => window.eXeLearning?.config?.basePath || '';
  const getVersion = () => window.eXeLearning?.version || 'v1.0.0';
  // Note: Direct __EXE_STATIC_MODE__ check required here because this runs very early,
  // before App is initialized and capabilities are available
  const isStaticMode = () => window.__EXE_STATIC_MODE__ === true;
  // URL pattern: {basePath}/{version}/path (e.g., /web/exelearning/v0.0.0-alpha/libs/yjs/yjs.min.js)
  // In static mode, use relative paths without version prefix
  const assetPath = (path) => {
    if (isStaticMode()) {
      return `.${path.startsWith('/') ? path : '/' + path}`;
    }
    return `${getBasePath()}/${getVersion()}${path.startsWith('/') ? path : '/' + path}`;
  };

  // Paths are computed lazily to ensure eXeLearning globals are available
  const getLIBS_PATH = () => assetPath('/libs/yjs');
  const getBASE_PATH = () => assetPath('/app/yjs');
  const getFflate_DEPENDENCY = () => assetPath('/libs/fflate/fflate.umd.js');

  // Local Yjs dependencies (bundled with esbuild) - computed lazily
  const getYJS_DEPENDENCIES = () => [
    `${getLIBS_PATH()}/yjs.min.js`,                  // Core Yjs library (exports window.Y)
    `${getLIBS_PATH()}/y-indexeddb.min.js`,          // IndexedDB persistence (exports window.IndexeddbPersistence)
    `${getLIBS_PATH()}/y-websocket.min.js`,          // y-websocket provider (exports window.WebsocketProvider)
  ];

  // Local modules organized in parallel-loadable groups
  // Each group is loaded in parallel, groups are loaded sequentially
  const LOCAL_MODULE_GROUPS = [
    // Group 0: Legacy iDevice handlers (must load BEFORE LegacyXmlParser)
    // BaseLegacyHandler must load first, then handlers, then registry
    [
      'legacy/BaseLegacyHandler.js',  // Base class for all handlers
    ],
    // Group 0.5: Individual handlers (all depend on BaseLegacyHandler)
    [
      'legacy/handlers/MultichoiceHandler.js',
      'legacy/handlers/TrueFalseHandler.js',
      'legacy/handlers/FillHandler.js',
      'legacy/handlers/DropdownHandler.js',
      'legacy/handlers/ScormTestHandler.js',
      'legacy/handlers/CaseStudyHandler.js',
      'legacy/handlers/GalleryHandler.js',
      'legacy/handlers/ExternalUrlHandler.js',
      'legacy/handlers/FileAttachHandler.js',
      'legacy/handlers/ImageMagnifierHandler.js',
      'legacy/handlers/GeogebraHandler.js',
      'legacy/handlers/InteractiveVideoHandler.js',
      'legacy/handlers/GameIdeviceHandler.js',
      'legacy/handlers/FpdSolvedExerciseHandler.js',
      'legacy/handlers/WikipediaHandler.js',
      'legacy/handlers/RssHandler.js',
      'legacy/handlers/NotaHandler.js',
      'legacy/handlers/FreeTextHandler.js',
      'legacy/handlers/DefaultHandler.js',
    ],
    // Group 0.75: Handler registry (depends on all handlers)
    [
      'legacy/handlerRegistry.js',  // Initializes LegacyHandlerRegistry with all handlers
    ],
    // Group 1: Core managers (no dependencies between them)
    [
      'YjsDocumentManager.js',
      'YjsLockManager.js',
      'YjsStructureBinding.js',
      'AssetCacheManager.js',
      'AssetManager.js',
      'AssetWebSocketHandler.js',
      'LegacyXmlParser.js',  // Now can use LegacyHandlerRegistry
      'ResourceCache.js',    // IndexedDB cache for ResourceFetcher
    ],
    // Group 2: Importers/Exporters and ResourceFetcher (depend on Group 1)
    [
      'ElpxImporter.js',
      'ElpxExporter.js',
      'ComponentImporter.js',  // Imports .idevice/.block files
      'ResourceFetcher.js',  // Fetches themes, libraries, iDevices for exports (uses ResourceCache)
    ],
    // Group 3: Shared exporters bundle (TypeScript from src/shared/export/)
    // Contains all export functionality: Html5, SCORM, IMS, EPUB3, Preview
    [
      'exporters.bundle.js',  // Compiled from src/shared/export/browser/index.ts
    ],
    // Group 4: Bridge components (depend on exporters)
    [
      'SaveManager.js',
      'YjsTinyMCEBinding.js',
      'YjsStructureTreeAdapter.js',
      'YjsPropertiesBinding.js',
    ],
    // Group 5: Final integration (must be sequential)
    [
      'YjsProjectBridge.js',  // depends on SaveManager
      'YjsProjectManagerMixin.js',  // depends on YjsProjectBridge
      'index.js',  // must be last
    ],
  ];

  // Flatten for backwards compatibility (if needed elsewhere)
  const LOCAL_MODULES = LOCAL_MODULE_GROUPS.flat();

  /**
   * Load a script dynamically
   * @param {string} src - Script URL
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Load scripts sequentially
   * @param {string[]} scripts - Array of script URLs
   * @returns {Promise<void>}
   */
  async function loadScriptsSequentially(scripts) {
    for (const script of scripts) {
      await loadScript(script);
    }
  }

  /**
   * Load scripts in parallel
   * @param {string[]} scripts - Array of script URLs
   * @returns {Promise<void>}
   */
  async function loadScriptsParallel(scripts) {
    await Promise.all(scripts.map(loadScript));
  }

  /**
   * Check if Yjs core is already loaded
   * @returns {boolean}
   */
  function isYjsLoaded() {
    return typeof window.Y !== 'undefined';
  }

  /**
   * Check if all local modules are loaded
   * @returns {boolean}
   */
  function areModulesLoaded() {
    return typeof window.YjsModules !== 'undefined' && window.YjsModules.YjsDocumentManager;
  }

  /**
   * Main loader object
   */
  window.YjsLoader = {
    loaded: false,
    loading: false,
    _loadPromise: null,

    /**
     * Load all Yjs dependencies and modules
     * @param {Object} options - Load options
     * @returns {Promise<void>}
     */
    async load(options = {}) {
      // Return existing promise if already loading
      if (this._loadPromise) {
        return this._loadPromise;
      }

      // Already loaded
      if (this.loaded && areModulesLoaded()) {
        Logger.log('[YjsLoader] Already loaded');
        return Promise.resolve();
      }

      this.loading = true;
      Logger.log('[YjsLoader] Starting load...');

      this._loadPromise = this._doLoad(options);
      return this._loadPromise;
    },

    /**
     * Internal load implementation
     * @private
     */
    async _doLoad(options) {
      try {
        // Get paths lazily (eXeLearning globals should be available now)
        const basePath = options.basePath || getBASE_PATH();

        // Load Yjs dependencies if not already present
        if (!isYjsLoaded()) {
          Logger.log('[YjsLoader] Loading Yjs from local libs...');
          await loadScriptsSequentially(getYJS_DEPENDENCIES());
        } else {
          Logger.log('[YjsLoader] Yjs already loaded');
        }

        // Load fflate if not already present (needed for .elpx import/export)
        if (!window.fflate) {
          Logger.log('[YjsLoader] Loading fflate...');
          await loadScript(getFflate_DEPENDENCY());
        }

        // Verify Y is available
        if (!window.Y) {
          throw new Error('Yjs core failed to load');
        }

        // Load local modules in parallel groups (faster than sequential)
        Logger.log('[YjsLoader] Loading local modules (parallel groups)...');
        for (let i = 0; i < LOCAL_MODULE_GROUPS.length; i++) {
          const group = LOCAL_MODULE_GROUPS[i];
          const groupUrls = group.map((m) => `${basePath}/${m}`);
          // Last group (index.js etc) must be sequential for correct initialization
          if (i === LOCAL_MODULE_GROUPS.length - 1) {
            await loadScriptsSequentially(groupUrls);
          } else {
            await loadScriptsParallel(groupUrls);
          }
        }

        // Verify modules loaded
        if (!areModulesLoaded()) {
          throw new Error('Local modules failed to load');
        }

        this.loaded = true;
        this.loading = false;
        Logger.log('[YjsLoader] All modules loaded successfully');

        // Fire custom event
        document.dispatchEvent(new CustomEvent('yjs-ready'));

        return window.YjsModules;
      } catch (error) {
        this.loading = false;
        console.error('[YjsLoader] Load failed:', error);
        throw error;
      }
    },

    /**
     * Initialize for a project (convenience method)
     * @param {number} projectId - Project ID
     * @param {string} authToken - Auth token
     * @param {Object} options - Options
     * @returns {Promise<YjsProjectBridge>}
     */
    async initProject(projectId, authToken, options = {}) {
      await this.load(options);
      return window.YjsModules.initializeProject(projectId, authToken, options);
    },

    /**
     * Get load status
     * @returns {Object}
     */
    getStatus() {
      return {
        loaded: this.loaded,
        loading: this.loading,
        yjsAvailable: isYjsLoaded(),
        modulesAvailable: areModulesLoaded(),
      };
    },
  };

  // Auto-load if data attribute is present
  if (document.currentScript?.dataset.autoload !== undefined) {
    window.YjsLoader.load();
  }
})();

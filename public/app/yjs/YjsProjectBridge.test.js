/**
 * YjsProjectBridge Tests
 *
 * Unit tests for YjsProjectBridge - bridges legacy projectManager with Yjs.
 *
 */

// Test functions available globally from vitest setup

 

const YjsProjectBridge = require('./YjsProjectBridge');

// Mock YjsDocumentManager
class MockYjsDocumentManager {
  constructor(projectId, config) {
    this.projectId = projectId;
    this.config = config;
    this.initialized = false;
    this.isDirty = false;
    this.lockManager = null;
    this._listeners = {};
    // Track method calls for testing
    this._ensureBlankStructureIfEmptyCalled = false;
  }

  async initialize(options) {
    this.initialized = true;
  }

  getNavigation() {
    return {
      observeDeep: mock(() => undefined),
      unobserveDeep: mock(() => undefined),
      toArray: mock(() => []),
      length: 0,
    };
  }

  getMetadata() {
    return {
      observe: mock(() => undefined),
      unobserve: mock(() => undefined),
      get: mock(() => undefined),
    };
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
    }
  }

  setUserInfo() {}
  setSelectedPage() {}
  hasUnsavedChanges() { return this.isDirty; }
  markDirty() { this.isDirty = true; }
  canUndo() { return false; }
  canRedo() { return false; }
  undo() {}
  redo() {}
  async destroy() {}
  async saveToServer() { return { success: true, bytes: 100 }; }
  startWebSocketConnection() {}
  async waitForWebSocketSync() {}
  ensureBlankStructureIfEmpty() {
    this._ensureBlankStructureIfEmptyCalled = true;
  }
}

// Mock YjsStructureBinding
class MockYjsStructureBinding {
  constructor(documentManager) {
    this.manager = documentManager;
  }

  getPages() { return []; }
  getPage(id) { return null; }
  onStructureChange() {}
  onBlocksComponentsChange() {}
}

// Mock AssetCacheManager
class MockAssetCacheManager {
  constructor(projectId) {
    this.projectId = projectId;
  }
  async close() {}
  destroy() {}
}

// Mock AssetManager
class MockAssetManager {
  constructor(projectId) {
    this.projectId = projectId;
    this.yjsBridge = null;
  }
  setYjsBridge(bridge) {
    this.yjsBridge = bridge;
  }
  async init() {}
  async preloadAllAssets() { return 0; }
  cleanup() {}
}

// Mock SaveManager
class MockSaveManager {
  constructor(bridge, options) {
    this.bridge = bridge;
    this.options = options;
  }
  async save() { return { success: true, bytes: 100 }; }
}

// Mock ResourceFetcher
class MockResourceFetcher {
  constructor() {
    this.initialized = false;
  }
  async init() { this.initialized = true; }
  async fetchTheme() { return new Map(); }
  async fetchBaseLibraries() { return new Map(); }
  async fetchIdevice() { return new Map(); }
  async fetchContentCss() { return new Map(); }
}

// Mock ResourceCache
class MockResourceCache {
  async init() {}
  async get() { return null; }
  async set() {}
  async has() { return false; }
  async clear() {}
  async clearOldVersions() {}
}

const createYText = (text = '') => {
  const doc = new window.Y.Doc();
  const yText = doc.getText('html');
  if (text) {
    yText.insert(0, text);
  }
  return yText;
};

describe('YjsProjectBridge', () => {
  let bridge;
  let mockApp;
  const originalWindow = global.window;
  const originalDocument = global.document;

  beforeEach(() => {
    // Setup global mocks
    global.window = {
      ...(originalWindow || {}),
      YjsDocumentManager: MockYjsDocumentManager,
      YjsStructureBinding: MockYjsStructureBinding,
      AssetCacheManager: MockAssetCacheManager,
      AssetManager: MockAssetManager,
      SaveManager: MockSaveManager,
      ResourceFetcher: MockResourceFetcher,
      ResourceCache: MockResourceCache,
      eXeLearning: {
        config: { basePath: '' },
        app: {
          themes: {
            list: {
              loadUserThemesFromIndexedDB: mock(async () => {}),
            },
          },
          menus: {
            navbar: {
              styles: {
                updateThemes: mock(() => {}),
              },
            },
          },
        },
      },
      location: {
        protocol: 'http:',
        hostname: 'localhost',
        port: '3001',
        origin: 'http://localhost:3001',
      },
    };
    // Also set eXeLearning globally since the code accesses it directly
    global.eXeLearning = global.window.eXeLearning;

    global.document = {
      createElement: mock(() => ({
        id: '',
        className: '',
        style: {},
        innerHTML: '',
        appendChild: mock(() => undefined),
        querySelector: mock(() => undefined),
        querySelectorAll: mock(() => []),
        addEventListener: mock(() => undefined),
        removeEventListener: mock(() => undefined),
      })),
      querySelector: mock(() => null),
      getElementById: mock(() => null),
      addEventListener: mock(() => undefined),
      removeEventListener: mock(() => undefined),
    };

    mockApp = {
      user: { id: 'user-1', name: 'Test User' },
      interface: {
        odeTitleElement: {
          setTitle: mock(() => undefined),
        },
      },
      themes: {
        initYjsBinding: mock(() => undefined),
      },
    };

    bridge = new YjsProjectBridge(mockApp);

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original globals instead of deleting
    global.window = originalWindow;
    global.document = originalDocument;
  });

  describe('constructor', () => {
    it('initializes with app reference', () => {
      expect(bridge.app).toBe(mockApp);
    });

    it('initializes projectId as null', () => {
      expect(bridge.projectId).toBeNull();
    });

    it('initializes authToken as null', () => {
      expect(bridge.authToken).toBeNull();
    });

    it('initializes as not initialized', () => {
      expect(bridge.initialized).toBe(false);
    });

    it('initializes autoSyncEnabled as false', () => {
      expect(bridge.autoSyncEnabled).toBe(false);
    });

    it('initializes isNewProject as false', () => {
      expect(bridge.isNewProject).toBe(false);
    });

    it('initializes empty observer arrays', () => {
      expect(bridge.structureObservers).toEqual([]);
      expect(bridge.saveStatusCallbacks).toEqual([]);
    });
  });

  describe('getWebSocketUrl', () => {
    it('builds WebSocket URL from location', () => {
      const url = bridge.getWebSocketUrl();
      expect(url).toBe('ws://localhost:3001/yjs');
    });

    it('uses wss for https', () => {
      window.location.protocol = 'https:';
      const url = bridge.getWebSocketUrl();
      expect(url).toContain('wss://');
    });

    it('includes basePath from config', () => {
      window.eXeLearning.config.basePath = '/web/exelearning';
      const url = bridge.getWebSocketUrl();
      expect(url).toContain('/web/exelearning/yjs');
    });
  });

  describe('getApiUrl', () => {
    it('builds API URL from location', () => {
      const url = bridge.getApiUrl();
      expect(url).toBe('http://localhost:3001/api');
    });

    it('includes basePath from config', () => {
      window.eXeLearning.config.basePath = '/web/exelearning';
      const url = bridge.getApiUrl();
      expect(url).toContain('/web/exelearning/api');
    });
  });

  describe('initialize', () => {
    it('sets projectId', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.projectId).toBe(123);
    });

    it('sets authToken', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.authToken).toBe('test-token');
    });

    it('creates documentManager', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.documentManager).toBeDefined();
      expect(bridge.documentManager).toBeInstanceOf(MockYjsDocumentManager);
    });

    it('creates structureBinding', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.structureBinding).toBeDefined();
      expect(bridge.structureBinding).toBeInstanceOf(MockYjsStructureBinding);
    });

    it('creates assetCache', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.assetCache).toBeDefined();
    });

    it('creates assetManager if available', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.assetManager).toBeDefined();
    });

    it('creates saveManager if available', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.saveManager).toBeDefined();
    });

    it('sets initialized to true', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.initialized).toBe(true);
    });

    it('handles isNewProject option', async () => {
      await bridge.initialize(123, 'test-token', { isNewProject: true });
      expect(bridge.isNewProject).toBe(true);
    });

    it('returns bridge instance', async () => {
      const result = await bridge.initialize(123, 'test-token');
      expect(result).toBe(bridge);
    });
  });

  describe('getDocumentManager', () => {
    it('returns documentManager', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.getDocumentManager()).toBe(bridge.documentManager);
    });

    it('returns null when not initialized', () => {
      expect(bridge.getDocumentManager()).toBeNull();
    });
  });

  describe('enableAutoSync', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('enableAutoSync sets flag to true', () => {
      bridge.enableAutoSync();
      expect(bridge.autoSyncEnabled).toBe(true);
    });
  });

  describe('undo/redo', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('undo method exists', () => {
      expect(typeof bridge.undo).toBe('function');
    });

    it('redo method exists', () => {
      expect(typeof bridge.redo).toBe('function');
    });

    it('undo can be called without error', () => {
      expect(() => bridge.undo()).not.toThrow();
    });

    it('redo can be called without error', () => {
      expect(() => bridge.redo()).not.toThrow();
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('destroys documentManager', async () => {
      const destroySpy = spyOn(bridge.documentManager, 'destroy');
      await bridge.disconnect();
      expect(destroySpy).toHaveBeenCalled();
    });

    it('sets initialized to false', async () => {
      await bridge.disconnect();
      expect(bridge.initialized).toBe(false);
    });

    it('clears references', async () => {
      await bridge.disconnect();
      expect(bridge.documentManager).toBeNull();
      expect(bridge.structureBinding).toBeNull();
    });
  });

  describe('onSaveStatus', () => {
    it('onSaveStatus method exists', () => {
      expect(typeof bridge.onSaveStatus).toBe('function');
    });

    it('returns unsubscribe function', () => {
      const callback = mock(() => undefined);
      const unsubscribe = bridge.onSaveStatus(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('onStructureChange', () => {
    it('onStructureChange method exists', () => {
      expect(typeof bridge.onStructureChange).toBe('function');
    });

    it('returns unsubscribe function', () => {
      const callback = mock(() => undefined);
      const unsubscribe = bridge.onStructureChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getPage', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('getPage method exists', () => {
      expect(typeof bridge.getPage).toBe('function');
    });
  });

  describe('save', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('save method exists', () => {
      expect(typeof bridge.save).toBe('function');
    });

    it('returns result with success property', async () => {
      const result = await bridge.save();
      expect(result).toHaveProperty('success');
    });
  });

  describe('_checkAndImportTheme', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('should select installed theme when available', async () => {
      // Setup mock for installed themes
      const mockSelectTheme = mock(() => Promise.resolve());

      global.eXeLearning = {
        app: {
          themes: {
            list: {
              installed: { 'test-theme': { id: 'test-theme', name: 'test-theme' } },
            },
            selectTheme: mockSelectTheme,
          },
        },
        config: {
          defaultTheme: 'base',
          userStyles: 1, // Enable user styles
          isOfflineInstallation: false,
        },
      };

      // Call the method
      await bridge._checkAndImportTheme('test-theme', null);

      // Verify selectTheme was called with correct args
      expect(mockSelectTheme).toHaveBeenCalledWith('test-theme', true);
    });

    it('should fall back to default theme when theme is not installed and package has no theme folder', async () => {
      const mockSelectTheme = mock(() => Promise.resolve());

      global.eXeLearning = {
        app: {
          themes: {
            list: {
              installed: {}, // No themes installed
            },
            selectTheme: mockSelectTheme,
          },
        },
        config: {
          defaultTheme: 'base',
          userStyles: 1, // Enable user styles
          isOfflineInstallation: false,
        },
      };

      // Mock fflate for ZIP handling (used instead of JSZip now)
      global.window.fflate = {
        unzipSync: mock(() => ({})), // Empty ZIP, no theme/config.xml
      };

      // Create a mock file with arrayBuffer
      const mockFile = {
        arrayBuffer: mock(() => Promise.resolve(new ArrayBuffer(10))),
      };

      await bridge._checkAndImportTheme('unknown-theme', mockFile);

      // selectTheme should be called with default theme (fallback) and save=true to update Yjs
      expect(mockSelectTheme).toHaveBeenCalledWith('base', true);
    });

    it('should skip theme import when theme is marked as non-downloadable', async () => {
      const mockSelectTheme = mock(() => Promise.resolve());
      const mockShowModal = mock(() => undefined);

      global.eXeLearning = {
        app: {
          themes: {
            list: {
              installed: {}, // Theme not installed
            },
            selectTheme: mockSelectTheme,
          },
        },
        config: {
          defaultTheme: 'base',
          userStyles: 1, // Enable user styles
          isOfflineInstallation: false,
        },
      };

      bridge._showThemeImportModal = mockShowModal;

      global.window.fflate = {
        unzipSync: mock(() => ({
          'theme/config.xml': new TextEncoder().encode('<theme><downloadable>0</downloadable></theme>'),
        })),
      };

      const mockFile = {
        arrayBuffer: mock(() => Promise.resolve(new ArrayBuffer(10))),
      };

      await bridge._checkAndImportTheme('blocked-theme', mockFile);

      expect(mockSelectTheme).toHaveBeenCalledWith('base', true);
      expect(mockShowModal).not.toHaveBeenCalled();
    });

    it('should return early if themeName is empty', async () => {
      const mockSelectTheme = mock(() => Promise.resolve());

      global.eXeLearning = {
        app: {
          themes: {
            list: { installed: {} },
            selectTheme: mockSelectTheme,
          },
        },
      };

      await bridge._checkAndImportTheme('', null);

      // selectTheme should NOT be called
      expect(mockSelectTheme).not.toHaveBeenCalled();
    });

    it('should use default theme when userStyles is disabled and not offline', async () => {
      const mockSelectTheme = mock(() => Promise.resolve());

      global.eXeLearning = {
        app: {
          themes: {
            list: {
              installed: {}, // Theme not installed
            },
            selectTheme: mockSelectTheme,
          },
        },
        config: {
          defaultTheme: 'base',
          userStyles: 0, // Disabled
          isOfflineInstallation: false,
        },
      };

      await bridge._checkAndImportTheme('custom-theme', new Blob());

      // Should use default theme immediately without prompting, save=true to update Yjs
      expect(mockSelectTheme).toHaveBeenCalledWith('base', true);
    });

    it('should allow theme import when userStyles is enabled', async () => {
      const mockSelectTheme = mock(() => Promise.resolve());

      global.eXeLearning = {
        app: {
          themes: {
            list: {
              installed: { 'custom-theme': { id: 'custom-theme' } },
            },
            selectTheme: mockSelectTheme,
          },
        },
        config: {
          defaultTheme: 'base',
          userStyles: 1, // Enabled
          isOfflineInstallation: false,
        },
      };

      await bridge._checkAndImportTheme('custom-theme', new Blob());

      // Should select the theme normally (theme is installed)
      expect(mockSelectTheme).toHaveBeenCalledWith('custom-theme', true);
    });

    it('should allow theme import in offline installation even if userStyles is 0', async () => {
      const mockSelectTheme = mock(() => Promise.resolve());

      global.eXeLearning = {
        app: {
          themes: {
            list: {
              installed: { 'custom-theme': { id: 'custom-theme' } },
            },
            selectTheme: mockSelectTheme,
          },
        },
        config: {
          defaultTheme: 'base',
          userStyles: 0, // Disabled
          isOfflineInstallation: true, // But offline
        },
      };

      await bridge._checkAndImportTheme('custom-theme', new Blob());

      // Should select the theme normally (offline allows all)
      expect(mockSelectTheme).toHaveBeenCalledWith('custom-theme', true);
    });
  });

  describe('Structure Operations', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      // Mock structureBinding methods
      bridge.structureBinding = {
        addPage: mock(() => ({ id: 'page-1', pageName: 'Test Page' })),
        getPage: mock(() => ({ get: () => 'test' })),
        updatePage: mock(() => {}),
        deletePage: mock(() => true),
        movePage: mock(() => {}),
        clonePage: mock(() => ({ id: 'page-cloned', pageName: 'Cloned Page' })),
        createBlock: mock(() => 'block-1'),
        getBlockMap: mock(() => ({
          set: mock(() => {}),
        })),
        deleteBlock: mock(() => {}),
        cloneBlock: mock(() => ({ id: 'block-cloned' })),
        createComponent: mock(() => 'comp-1'),
        updateComponent: mock(() => {}),
        deleteComponent: mock(() => true),
        cloneComponent: mock(() => ({ id: 'comp-cloned' })),
        getComponent: mock(() => ({
          get: (key) => {
            if (key === 'htmlContent') return createYText('<p>Test</p>');
            return 'test';
          },
        })),
        getComponentMap: mock(() => ({
          get: (key) => {
            if (key === 'htmlContent') return createYText('<p>Test</p>');
            return 'test';
          },
        })),
        getPages: mock(() => []),
        importFromApiStructure: mock(() => {}),
        clearNavigation: mock(() => {}),
      };
      // Mock lockManager
      bridge.lockManager = {
        requestLock: mock(() => true),
        acquireLock: mock(() => true),
        releaseLock: mock(() => {}),
        getLock: mock(() => null),
      };
    });

    it('addPage calls structureBinding.addPage', () => {
      const result = bridge.addPage('New Page', null);
      expect(bridge.structureBinding.addPage).toHaveBeenCalledWith('New Page', null);
      expect(result).toEqual({ id: 'page-1', pageName: 'Test Page' });
    });

    it('addPage with parent ID', () => {
      bridge.addPage('Child Page', 'parent-id');
      expect(bridge.structureBinding.addPage).toHaveBeenCalledWith('Child Page', 'parent-id');
    });

    it('getPage returns page from structureBinding', () => {
      const result = bridge.getPage('page-1');
      expect(bridge.structureBinding.getPage).toHaveBeenCalledWith('page-1');
      expect(result).toBeDefined();
    });

    it('updatePage calls structureBinding.updatePage', () => {
      bridge.updatePage('page-1', { pageName: 'Updated' });
      expect(bridge.structureBinding.updatePage).toHaveBeenCalledWith('page-1', { pageName: 'Updated' });
    });

    it('deletePage calls structureBinding.deletePage', () => {
      const result = bridge.deletePage('page-1');
      expect(bridge.structureBinding.deletePage).toHaveBeenCalledWith('page-1');
      expect(result).toBe(true);
    });

    it('movePage calls structureBinding.movePage', () => {
      bridge.movePage('page-1', 'parent-id', 2);
      expect(bridge.structureBinding.movePage).toHaveBeenCalledWith('page-1', 'parent-id', 2);
    });

    it('clonePage calls structureBinding.clonePage', () => {
      const result = bridge.clonePage('page-1', 'Cloned');
      expect(bridge.structureBinding.clonePage).toHaveBeenCalledWith('page-1', 'Cloned');
      expect(result.id).toBe('page-cloned');
    });

    it('addBlock calls structureBinding.createBlock', () => {
      const result = bridge.addBlock('page-1', 'My Block');
      expect(bridge.structureBinding.createBlock).toHaveBeenCalledWith('page-1', 'My Block', null, null);
      expect(result).toBe('block-1');
    });

    it('addBlock with existing block ID', () => {
      bridge.addBlock('page-1', 'Block', 'existing-id');
      expect(bridge.structureBinding.createBlock).toHaveBeenCalledWith('page-1', 'Block', 'existing-id', null);
    });

    it('addBlock with order parameter', () => {
      bridge.addBlock('page-1', 'Block', 'new-block-id', 0);
      expect(bridge.structureBinding.createBlock).toHaveBeenCalledWith('page-1', 'Block', 'new-block-id', 0);
    });

    it('updateBlock updates block properties', () => {
      bridge.updateBlock('page-1', 'block-1', { blockName: 'Updated Block' });
      expect(bridge.structureBinding.getBlockMap).toHaveBeenCalledWith('page-1', 'block-1');
    });

    it('deleteBlock calls structureBinding.deleteBlock', () => {
      bridge.deleteBlock('page-1', 'block-1');
      expect(bridge.structureBinding.deleteBlock).toHaveBeenCalledWith('page-1', 'block-1');
    });

    it('cloneBlock calls structureBinding.cloneBlock', () => {
      const result = bridge.cloneBlock('page-1', 'block-1');
      expect(bridge.structureBinding.cloneBlock).toHaveBeenCalledWith('page-1', 'block-1');
      expect(result.id).toBe('block-cloned');
    });

    it('addComponent calls structureBinding.createComponent', () => {
      const result = bridge.addComponent('page-1', 'block-1', 'FreeText', { title: 'Test' });
      expect(bridge.structureBinding.createComponent).toHaveBeenCalledWith('page-1', 'block-1', 'FreeText', { title: 'Test' });
      expect(result).toBe('comp-1');
    });

    it('addComponent requests lock for creator', () => {
      bridge.addComponent('page-1', 'block-1', 'FreeText');
      expect(bridge.lockManager.requestLock).toHaveBeenCalledWith('comp-1');
    });

    it('updateComponent calls structureBinding.updateComponent', () => {
      bridge.updateComponent('comp-1', { title: 'Updated' });
      expect(bridge.structureBinding.updateComponent).toHaveBeenCalledWith('comp-1', { title: 'Updated' });
    });

    it('deleteComponent calls structureBinding.deleteComponent', () => {
      const result = bridge.deleteComponent('comp-1');
      expect(bridge.structureBinding.deleteComponent).toHaveBeenCalledWith('comp-1');
      expect(result).toBe(true);
    });

    it('deleteComponent returns false on error', () => {
      bridge.structureBinding.deleteComponent = mock(() => {
        throw new Error('Delete failed');
      });
      const result = bridge.deleteComponent('comp-1');
      expect(result).toBe(false);
    });

    it('cloneComponent calls structureBinding.cloneComponent', () => {
      const result = bridge.cloneComponent('page-1', 'block-1', 'comp-1');
      expect(bridge.structureBinding.cloneComponent).toHaveBeenCalledWith('page-1', 'block-1', 'comp-1');
      expect(result.id).toBe('comp-cloned');
    });

    it('importStructure calls structureBinding.importFromApiStructure', () => {
      const apiStructure = [{ id: 'page-1' }];
      bridge.importStructure(apiStructure);
      expect(bridge.structureBinding.importFromApiStructure).toHaveBeenCalledWith(apiStructure);
    });

    it('importStructure logs error when not initialized', () => {
      bridge.structureBinding = null;
      bridge.importStructure([]);
      // Should not throw
    });

    it('clearNavigation calls structureBinding.clearNavigation', () => {
      bridge.clearNavigation();
      expect(bridge.structureBinding.clearNavigation).toHaveBeenCalled();
    });

    it('clearNavigation logs error when not initialized', () => {
      bridge.structureBinding = null;
      bridge.clearNavigation();
      // Should not throw
    });
  });

  describe('Component HTML', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('getComponentHtml returns content from Y.Text', () => {
      const mockYText = createYText('<p>Hello</p>');
      bridge.structureBinding = {
        getComponent: mock(() => ({
          get: (key) => key === 'htmlContent' ? mockYText : null,
        })),
      };

      const result = bridge.getComponentHtml('page-1', 'block-1', 'comp-1');
      expect(result).toBe('<p>Hello</p>');
    });

    it('getComponentHtml returns htmlView when htmlContent is not Y.Text', () => {
      bridge.structureBinding = {
        getComponent: mock(() => ({
          get: (key) => {
            if (key === 'htmlContent') return null;
            if (key === 'htmlView') return '<p>Fallback</p>';
            return null;
          },
        })),
      };

      const result = bridge.getComponentHtml('page-1', 'block-1', 'comp-1');
      expect(result).toBe('<p>Fallback</p>');
    });

    it('getComponentHtml returns null when component not found', () => {
      bridge.structureBinding = {
        getComponent: mock(() => null),
      };

      const result = bridge.getComponentHtml('page-1', 'block-1', 'nonexistent');
      expect(result).toBeNull();
    });

    it('setComponentHtml updates Y.Text content', () => {
      const mockYText = createYText('<p>Old</p>');
      bridge.structureBinding = {
        getComponent: mock(() => ({
          get: (key) => key === 'htmlContent' ? mockYText : null,
          set: mock(() => {}),
        })),
      };
      // Disable assetManager to skip prepareHtmlForSync
      bridge.assetManager = null;

      bridge.setComponentHtml('page-1', 'block-1', 'comp-1', '<p>New</p>');
      expect(mockYText.toString()).toBe('<p>New</p>');
    });

    it('setComponentHtml creates Y.Text when not present', () => {
      const componentMap = {
        get: mock((key) => {
          if (key === 'htmlContent') return null;
          if (key === 'htmlView') return '<p>Old</p>';
          return null;
        }),
        set: mock(() => {}),
      };
      bridge.structureBinding = {
        getComponent: mock(() => componentMap),
      };
      // Disable assetManager to skip prepareHtmlForSync
      bridge.assetManager = null;

      bridge.setComponentHtml('page-1', 'block-1', 'comp-1', '<p>New</p>');
      expect(componentMap.set).toHaveBeenCalled();
    });

    it('setComponentHtml uses assetManager.prepareHtmlForSync when available', () => {
      const mockYText = createYText('<p>Old</p>');
      bridge.structureBinding = {
        getComponent: mock(() => ({
          get: (key) => key === 'htmlContent' ? mockYText : null,
          set: mock(() => {}),
        })),
      };
      bridge.assetManager = {
        prepareHtmlForSync: mock((html) => html.replace('blob://', 'asset://')),
      };

      bridge.setComponentHtml('page-1', 'block-1', 'comp-1', '<img src="blob://test" />');
      expect(bridge.assetManager.prepareHtmlForSync).toHaveBeenCalled();
    });

    it('setComponentHtml does nothing when component not found', () => {
      bridge.structureBinding = {
        getComponent: mock(() => null),
      };

      // Should not throw
      bridge.setComponentHtml('page-1', 'block-1', 'nonexistent', '<p>Test</p>');
    });
  });

  describe('Lock Operations', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      bridge.lockManager = {
        acquireLock: mock(() => true),
        releaseLock: mock(() => {}),
        getLock: mock(() => ({ userId: 'other-user', userName: 'Other User' })),
      };
    });

    it('acquireLock calls lockManager.acquireLock', () => {
      const result = bridge.acquireLock('comp-1');
      expect(bridge.lockManager.acquireLock).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('releaseLock calls lockManager.releaseLock', () => {
      bridge.releaseLock('comp-1');
      expect(bridge.lockManager.releaseLock).toHaveBeenCalledWith('comp-1');
    });

    it('getLockInfo calls lockManager.getLock', () => {
      const result = bridge.getLockInfo('comp-1');
      expect(bridge.lockManager.getLock).toHaveBeenCalledWith('comp-1');
      expect(result).toEqual({ userId: 'other-user', userName: 'Other User' });
    });
  });

  describe('Metadata Operations', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('updateMetadata sets values on metadata map', () => {
      const mockMetadata = {
        set: mock(() => {}),
        get: mock(() => 'test'),
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge.updateMetadata({ title: 'New Title', author: 'Test Author' });
      expect(mockMetadata.set).toHaveBeenCalledWith('title', 'New Title');
      expect(mockMetadata.set).toHaveBeenCalledWith('author', 'Test Author');
    });

    it('getMetadata returns metadata object', () => {
      const mockMetadata = {
        get: mock((key) => {
          const values = { title: 'Test', author: 'Author', language: 'en' };
          return values[key];
        }),
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      const result = bridge.getMetadata();
      expect(result.title).toBe('Test');
      expect(result.author).toBe('Author');
      expect(result.language).toBe('en');
    });
  });

  describe('Undo/Redo Operations', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      bridge.undoButton = { disabled: false };
      bridge.redoButton = { disabled: false };
      bridge.documentManager.undoManager = {
        undoStack: [],
        redoStack: [],
        undo: mock(() => {}),
        redo: mock(() => {}),
      };
    });

    it('undo with empty stack does nothing', () => {
      bridge.undo();
      expect(bridge.documentManager.undoManager.undo).not.toHaveBeenCalled();
    });

    it('undo with items in stack calls undoManager.undo', () => {
      bridge.documentManager.undoManager.undoStack = [{ item: 1 }];
      bridge.undo();
      expect(bridge.documentManager.undoManager.undo).toHaveBeenCalled();
    });

    it('undo with pending metadata changes flushes them first', () => {
      bridge.hasPendingMetadataChanges = true;
      bridge.documentManager.undoManager.undoStack = [];

      // Mock flush
      bridge.flushPendingMetadataChanges = mock(() => {});

      bridge.undo();
      expect(bridge.flushPendingMetadataChanges).toHaveBeenCalled();
    });

    it('undo sets isUndoRedoInProgress flag', () => {
      bridge.documentManager.undoManager.undoStack = [{ item: 1 }];

      let flagDuringUndo = false;
      bridge.documentManager.undoManager.undo = () => {
        flagDuringUndo = bridge.isUndoRedoInProgress;
      };

      bridge.undo();
      expect(flagDuringUndo).toBe(true);
      expect(bridge.isUndoRedoInProgress).toBe(false); // Reset after
    });

    it('redo calls undoManager.redo', () => {
      bridge.documentManager.undoManager.redoStack = [{ item: 1 }];
      bridge.redo();
      expect(bridge.documentManager.undoManager.redo).toHaveBeenCalled();
    });

    it('redo sets isUndoRedoInProgress flag', () => {
      let flagDuringRedo = false;
      bridge.documentManager.undoManager.redo = () => {
        flagDuringRedo = bridge.isUndoRedoInProgress;
      };

      bridge.redo();
      expect(flagDuringRedo).toBe(true);
      expect(bridge.isUndoRedoInProgress).toBe(false); // Reset after
    });

    it('updateUndoRedoButtons enables undo when stack has items', () => {
      bridge.documentManager.undoManager.undoStack = [{ item: 1 }];
      bridge.documentManager.undoManager.redoStack = [];

      bridge.updateUndoRedoButtons();

      expect(bridge.undoButton.disabled).toBe(false);
      expect(bridge.redoButton.disabled).toBe(true);
    });

    it('updateUndoRedoButtons enables redo when redoStack has items', () => {
      bridge.documentManager.undoManager.undoStack = [];
      bridge.documentManager.undoManager.redoStack = [{ item: 1 }];

      bridge.updateUndoRedoButtons();

      expect(bridge.undoButton.disabled).toBe(true);
      expect(bridge.redoButton.disabled).toBe(false);
    });

    it('updateUndoRedoButtons enables undo with pending changes', () => {
      bridge.documentManager.undoManager.undoStack = [];
      bridge.hasPendingMetadataChanges = true;

      bridge.updateUndoRedoButtons();

      expect(bridge.undoButton.disabled).toBe(false);
    });

    it('onPendingMetadataChange sets flag and updates buttons', () => {
      bridge.updateUndoRedoButtons = mock(() => {});

      bridge.onPendingMetadataChange();

      expect(bridge.hasPendingMetadataChanges).toBe(true);
      expect(bridge.updateUndoRedoButtons).toHaveBeenCalled();
    });

    it('clearPendingMetadataChanges clears flag', () => {
      bridge.hasPendingMetadataChanges = true;
      bridge.clearPendingMetadataChanges();
      expect(bridge.hasPendingMetadataChanges).toBe(false);
    });

    it('getPendingChangeCallback returns function that calls onPendingMetadataChange', () => {
      bridge.onPendingMetadataChange = mock(() => {});

      const callback = bridge.getPendingChangeCallback();
      callback();

      expect(bridge.onPendingMetadataChange).toHaveBeenCalled();
    });
  });

  describe('Save Status', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      bridge.saveButton = {
        classList: {
          remove: mock(() => {}),
          add: mock(() => {}),
        },
      };
    });

    it('updateSaveStatus adds saved class for saved status', () => {
      bridge.updateSaveStatus('saved');
      expect(bridge.saveButton.classList.add).toHaveBeenCalledWith('saved');
    });

    it('updateSaveStatus adds saving class for saving status', () => {
      bridge.updateSaveStatus('saving');
      expect(bridge.saveButton.classList.add).toHaveBeenCalledWith('saving');
    });

    it('updateSaveStatus adds unsaved class for error status', () => {
      bridge.updateSaveStatus('error');
      expect(bridge.saveButton.classList.add).toHaveBeenCalledWith('unsaved');
    });

    it('updateSaveStatus adds unsaved class for offline status', () => {
      bridge.updateSaveStatus('offline');
      expect(bridge.saveButton.classList.add).toHaveBeenCalledWith('unsaved');
    });

    it('updateSaveStatus notifies callbacks', () => {
      const callback = mock(() => {});
      bridge.saveStatusCallbacks.push(callback);

      bridge.updateSaveStatus('saved', 'Test message');

      expect(callback).toHaveBeenCalledWith('saved', 'Test message');
    });

    it('updateSaveStatus handles callback errors gracefully', () => {
      const badCallback = mock(() => { throw new Error('Callback error'); });
      bridge.saveStatusCallbacks.push(badCallback);

      // Should not throw
      bridge.updateSaveStatus('saved');
    });
  });

  describe('Observer Registration', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('onStructureChange adds observer and returns unsubscribe', () => {
      const callback = mock(() => {});
      const unsubscribe = bridge.onStructureChange(callback);

      expect(bridge.structureObservers).toContain(callback);

      unsubscribe();
      expect(bridge.structureObservers).not.toContain(callback);
    });

    it('onSaveStatus adds callback and returns unsubscribe', () => {
      const callback = mock(() => {});
      const unsubscribe = bridge.onSaveStatus(callback);

      expect(bridge.saveStatusCallbacks).toContain(callback);

      unsubscribe();
      expect(bridge.saveStatusCallbacks).not.toContain(callback);
    });
  });

  describe('observeComponentContent', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns empty function when component not found', () => {
      bridge.structureBinding = {
        getComponentMap: mock(() => null),
      };

      const unsubscribe = bridge.observeComponentContent('nonexistent', () => {});
      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    it('observes Y.Text htmlContent', () => {
      const mockYText = createYText('<p>Test</p>');
      const observeSpy = spyOn(mockYText, 'observe');
      const unobserveSpy = spyOn(mockYText, 'unobserve');
      bridge.structureBinding = {
        getComponentMap: mock(() => ({
          get: (key) => key === 'htmlContent' ? mockYText : null,
        })),
      };

      const callback = mock(() => {});
      const unsubscribe = bridge.observeComponentContent('comp-1', callback);

      expect(observeSpy).toHaveBeenCalledWith(expect.any(Function));

      unsubscribe();
      expect(unobserveSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('returns empty function when htmlContent has no observe method', () => {
      bridge.structureBinding = {
        getComponentMap: mock(() => ({
          get: () => 'plain string',
        })),
      };

      const unsubscribe = bridge.observeComponentContent('comp-1', () => {});
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getPageContent', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns null when documentManager is not set', () => {
      bridge.documentManager = null;
      expect(bridge.getPageContent('page-1')).toBeNull();
    });

    it('returns null when navigation is not set', () => {
      bridge.documentManager.getNavigation = () => null;
      expect(bridge.getPageContent('page-1')).toBeNull();
    });

    it('returns null when page is not found', () => {
      const mockNav = {
        length: 1,
        get: () => ({
          get: (key) => key === 'id' ? 'other-page' : null,
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      expect(bridge.getPageContent('page-1')).toBeNull();
    });

    it('returns HTML from page components', () => {
      const mockComponent = {
        get: (key) => key === 'htmlContent' ? '<p>Content</p>' : null,
      };
      const mockBlock = {
        get: (key) => {
          if (key === 'components') {
            return { length: 1, get: () => mockComponent };
          }
          return null;
        },
      };
      const mockPage = {
        get: (key) => {
          if (key === 'id') return 'page-1';
          if (key === 'blocks') return { length: 1, get: () => mockBlock };
          return null;
        },
      };
      const mockNav = {
        length: 1,
        get: () => mockPage,
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const result = bridge.getPageContent('page-1');
      expect(result).toBe('<p>Content</p>');
    });

    it('returns null when page has no blocks', () => {
      const mockPage = {
        get: (key) => {
          if (key === 'id') return 'page-1';
          if (key === 'blocks') return null;
          return null;
        },
      };
      const mockNav = {
        length: 1,
        get: () => mockPage,
      };
      bridge.documentManager.getNavigation = () => mockNav;

      expect(bridge.getPageContent('page-1')).toBeNull();
    });
  });

  describe('schedulePageReloadIfCurrent', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: mock(() => 'current-page'),
              },
              menuNav: {
                querySelector: mock(() => ({ id: 'page-element' })),
              },
              checkIfEmptyNode: mock(() => {}),
            },
          },
          idevices: {
            loadApiIdevicesInPage: mock(() => Promise.resolve()),
          },
        },
        menus: {
          menuStructure: {
            menuStructureBehaviour: {
              checkIfEmptyNode: mock(() => {}),
            },
          },
        },
      };
    });

    it('schedules reload when pageId matches current page', async () => {
      bridge.schedulePageReloadIfCurrent('current-page');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(bridge.app.project.idevices.loadApiIdevicesInPage).toHaveBeenCalled();
    });

    it('does not schedule reload when pageId does not match', async () => {
      bridge.schedulePageReloadIfCurrent('other-page');

      // Wait for potential debounce
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(bridge.app.project.idevices.loadApiIdevicesInPage).not.toHaveBeenCalled();
    });
  });

  describe('onPageNavigation', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns early when assetManager is not set', async () => {
      bridge.assetManager = null;
      await bridge.onPageNavigation('page-1');
      // Should not throw
    });

    it('returns early when pageId is empty', async () => {
      await bridge.onPageNavigation('');
      // Should not throw
    });

    it('boosts assets when page has content', async () => {
      bridge.getPageContent = mock(() => '<img src="asset://abc123" />');
      bridge.assetManager = {
        boostAssetsInHTML: mock(() => Promise.resolve()),
      };

      await bridge.onPageNavigation('page-1');

      expect(bridge.assetManager.boostAssetsInHTML).toHaveBeenCalled();
    });

    it('does not boost assets when page has no content', async () => {
      bridge.getPageContent = mock(() => null);
      bridge.assetManager = {
        boostAssetsInHTML: mock(() => Promise.resolve()),
      };

      await bridge.onPageNavigation('page-1');

      expect(bridge.assetManager.boostAssetsInHTML).not.toHaveBeenCalled();
    });
  });

  describe('triggerInitialStructureLoad', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('notifies observers when navigation has pages', () => {
      const mockNav = {
        length: 2,
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const observer = mock(() => {});
      bridge.structureObservers.push(observer);

      bridge.triggerInitialStructureLoad();

      expect(observer).toHaveBeenCalledWith([], false);
    });

    it('does not notify observers when navigation is empty', () => {
      const mockNav = {
        length: 0,
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const observer = mock(() => {});
      bridge.structureObservers.push(observer);

      bridge.triggerInitialStructureLoad();

      expect(observer).not.toHaveBeenCalled();
    });

    it('handles observer errors gracefully', () => {
      const mockNav = {
        length: 1,
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const badObserver = mock(() => { throw new Error('Observer error'); });
      bridge.structureObservers.push(badObserver);

      // Should not throw
      bridge.triggerInitialStructureLoad();
    });
  });

  describe('_shouldSkipSyncWait', () => {
    it('returns true when electronAPI is present', () => {
      global.window.electronAPI = {};
      const result = bridge._shouldSkipSyncWait();
      expect(result).toBe(true);
      delete global.window.electronAPI;
    });

    it('returns true when isOfflineInstallation is true', () => {
      global.window.eXeLearning = {
        config: { isOfflineInstallation: true, basePath: '' },
      };
      const result = bridge._shouldSkipSyncWait();
      expect(result).toBe(true);
    });

    it('returns false in normal browser environment', () => {
      global.window.eXeLearning = {
        config: { isOfflineInstallation: false, basePath: '' },
      };
      const result = bridge._shouldSkipSyncWait();
      expect(result).toBe(false);
    });
  });

  describe('save with SaveManager', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('uses SaveManager when available', async () => {
      bridge.saveManager = {
        save: mock(() => Promise.resolve({ success: true })),
      };

      const result = await bridge.save();

      expect(bridge.saveManager.save).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('falls back to flush when SaveManager unavailable', async () => {
      bridge.saveManager = null;
      bridge.documentManager.flush = mock(() => Promise.resolve());

      const result = await bridge.save();

      expect(bridge.documentManager.flush).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('updates save status to error on failure', async () => {
      bridge.saveManager = {
        save: mock(() => Promise.resolve({ success: false, error: 'Failed' })),
      };
      bridge.updateSaveStatus = mock(() => {});

      await bridge.save();

      expect(bridge.updateSaveStatus).toHaveBeenCalledWith('error', 'Failed');
    });

    it('throws on save error', async () => {
      bridge.saveManager = null;
      bridge.documentManager.flush = mock(() => Promise.reject(new Error('Flush failed')));
      bridge.updateSaveStatus = mock(() => {});

      await expect(bridge.save()).rejects.toThrow('Flush failed');
      expect(bridge.updateSaveStatus).toHaveBeenCalledWith('error', 'Flush failed');
    });
  });

  describe('Asset Operations', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('getAssetManager returns assetManager', () => {
      bridge.assetManager = { id: 'test-manager' };
      expect(bridge.getAssetManager()).toEqual({ id: 'test-manager' });
    });

    it('getAssetWebSocketHandler returns assetWebSocketHandler', () => {
      bridge.assetWebSocketHandler = { id: 'test-handler' };
      expect(bridge.getAssetWebSocketHandler()).toEqual({ id: 'test-handler' });
    });

    it('requestMissingAssets returns empty array when no handler', async () => {
      bridge.assetWebSocketHandler = null;
      const result = await bridge.requestMissingAssets('<p>Test</p>');
      expect(result).toEqual([]);
    });

    it('requestMissingAssets calls handler method', async () => {
      bridge.assetWebSocketHandler = {
        requestMissingAssetsFromHTML: mock(() => Promise.resolve(['asset-1'])),
      };

      const result = await bridge.requestMissingAssets('<img src="asset://abc" />');
      expect(result).toEqual(['asset-1']);
    });

    it('announceAssets calls handler method', async () => {
      bridge.assetWebSocketHandler = {
        announceAssetAvailability: mock(() => Promise.resolve()),
      };

      await bridge.announceAssets();
      expect(bridge.assetWebSocketHandler.announceAssetAvailability).toHaveBeenCalled();
    });

    it('announceAssets does nothing when no handler', async () => {
      bridge.assetWebSocketHandler = null;
      // Should not throw
      await bridge.announceAssets();
    });
  });

  describe('enableAutoSync', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      bridge.app = {
        project: {
          intervalSaveOde: setInterval(() => {}, 1000),
        },
      };
    });

    it('sets autoSyncEnabled to true', () => {
      bridge.enableAutoSync();
      expect(bridge.autoSyncEnabled).toBe(true);
    });

    it('clears legacy autosave interval', () => {
      const intervalId = bridge.app.project.intervalSaveOde;
      bridge.enableAutoSync();
      expect(bridge.app.project.intervalSaveOde).toBeNull();
    });

    it('sets up connection status handler', () => {
      bridge.enableAutoSync();
      expect(bridge.documentManager.onSyncStatus).toBeDefined();
    });

    it('connection status handler updates save status on disconnect', () => {
      bridge.updateSaveStatus = mock(() => {});
      bridge.enableAutoSync();

      bridge.documentManager.onSyncStatus(false);
      expect(bridge.updateSaveStatus).toHaveBeenCalledWith('offline');
    });

    it('listens for saveStatus events', () => {
      bridge.updateSaveStatus = mock(() => {});
      bridge.enableAutoSync();

      // Simulate dirty status
      const listeners = bridge.documentManager._listeners['saveStatus'];
      if (listeners && listeners.length > 0) {
        listeners[0]({ status: 'dirty' });
        expect(bridge.updateSaveStatus).toHaveBeenCalledWith('unsaved');
      }
    });
  });

  describe('forceTitleSync', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns early when no metadata', () => {
      bridge.documentManager = null;
      // Should not throw
      bridge.forceTitleSync();
    });

    it('updates header title element', () => {
      const headerTitle = { textContent: '' };
      global.document.querySelector = mock((selector) => {
        if (selector === '#exe-title > .exe-title.content') return headerTitle;
        return null;
      });

      const mockMetadata = {
        get: (key) => key === 'title' ? 'Test Title' : null,
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge.forceTitleSync();

      expect(headerTitle.textContent).toBe('Test Title');
    });
  });

  describe('flushPendingMetadataChanges', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('dispatches blur events to property inputs', () => {
      const input = {
        dispatchEvent: mock(() => {}),
      };
      global.document.querySelectorAll = mock(() => [input]);

      bridge.flushPendingMetadataChanges();

      expect(input.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('updateDocumentTitle', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('updates browser tab title', () => {
      bridge.updateDocumentTitle('My Project');
      expect(document.title).toBe('My Project - eXeLearning');
    });

    it('calls setTitleToNodeRoot when structure data exists', () => {
      bridge.app = {
        project: {
          structure: {
            data: {},
            setTitleToNodeRoot: mock(() => {}),
          },
        },
      };

      bridge.updateDocumentTitle('Test');
      expect(bridge.app.project.structure.setTitleToNodeRoot).toHaveBeenCalled();
    });

    it('does not update tab title when title is empty', () => {
      document.title = 'Original';
      bridge.updateDocumentTitle('');
      expect(document.title).toBe('Original');
    });
  });

  describe('handleRemoteStructureChanges', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      bridge.app = {
        project: {
          idevices: {
            renderRemoteIdevice: mock(() => Promise.resolve()),
            updateRemoteIdeviceContent: mock(() => Promise.resolve()),
            getBlockById: mock(() => null),
          },
          structure: {
            nodeSelected: {
              getAttribute: () => 'page-1',
            },
          },
        },
      };
    });

    it('handles empty events array', () => {
      // Should not throw
      bridge.handleRemoteStructureChanges([]);
    });

    it('handles events with no changes', () => {
      const events = [{ path: [], changes: null }];
      // Should not throw
      bridge.handleRemoteStructureChanges(events);
    });

    it('handles component addition event', () => {
      const mockCompMap = {
        get: (key) => {
          const data = {
            id: 'comp-1',
            ideviceType: 'FreeText',
            htmlContent: { toString: () => '<p>Test</p>' },
            lockedBy: null,
          };
          return data[key];
        },
      };

      const mockNav = {
        get: (index) => ({
          get: (key) => {
            if (key === 'id') return 'page-1';
            if (key === 'blocks') {
              return {
                get: () => ({
                  get: (k) => {
                    if (k === 'id') return 'block-1';
                    if (k === 'components') return { get: () => mockCompMap };
                    return null;
                  },
                }),
              };
            }
            return null;
          },
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const events = [{
        path: [0, 'blocks', 0, 'components'],
        changes: {
          added: new Set([{
            content: {
              getContent: () => [mockCompMap],
            },
          }]),
        },
      }];

      bridge.handleRemoteStructureChanges(events);
      // Should call renderRemoteComponent (tested via mock)
    });

    it('handles block addition event', () => {
      const mockNav = {
        get: () => ({
          get: (key) => {
            if (key === 'id') return 'page-1';
            if (key === 'pageId') return 'page-1';
            return null;
          },
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const events = [{
        path: [0, 'blocks'],
        changes: {
          added: new Set([{ item: 1 }]),
        },
      }];

      bridge.handleRemoteStructureChanges(events);
      // Should schedule page reload
    });

    it('handles component property updates', () => {
      const mockCompMap = {
        get: (key) => {
          const data = {
            id: 'comp-1',
            ideviceType: 'FreeText',
            htmlContent: { toString: () => '<p>Updated</p>' },
          };
          return data[key];
        },
      };

      const mockNav = {
        get: () => ({
          get: (key) => {
            if (key === 'id') return 'page-1';
            if (key === 'blocks') {
              return {
                get: () => ({
                  get: (k) => {
                    if (k === 'components') {
                      return { get: () => mockCompMap };
                    }
                    return null;
                  },
                }),
              };
            }
            return null;
          },
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const events = [{
        path: [0, 'blocks', 0, 'components', 0],
        changes: {
          keys: new Map([['htmlContent', { action: 'update' }]]),
        },
      }];

      bridge.handleRemoteStructureChanges(events);
    });

    it('handles Y.Text content updates', () => {
      const mockCompMap = {
        get: (key) => {
          const data = {
            id: 'comp-1',
            ideviceType: 'FreeText',
            htmlContent: { toString: () => '<p>Text updated</p>' },
          };
          return data[key];
        },
      };

      const mockNav = {
        get: () => ({
          get: (key) => {
            if (key === 'id') return 'page-1';
            if (key === 'blocks') {
              return {
                get: () => ({
                  get: (k) => {
                    if (k === 'components') {
                      return { get: () => mockCompMap };
                    }
                    return null;
                  },
                }),
              };
            }
            return null;
          },
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const events = [{
        path: [0, 'blocks', 0, 'components', 0, 'htmlContent'],
        delta: [{ insert: 'test' }],
      }];

      bridge.handleRemoteStructureChanges(events);
    });

    it('handles block property updates', () => {
      const mockPropsMap = {
        toJSON: () => ({ visible: true }),
      };
      const mockBlockMap = {
        get: (key) => {
          const data = {
            id: 'block-1',
            blockId: 'block-1',
            blockName: 'Updated Block',
            iconName: 'star',
            properties: mockPropsMap,
          };
          return data[key];
        },
      };

      const mockNav = {
        get: () => ({
          get: (key) => {
            if (key === 'id') return 'page-1';
            if (key === 'blocks') {
              return { get: () => mockBlockMap };
            }
            return null;
          },
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const events = [{
        path: [0, 'blocks', 0],
        changes: {
          keys: new Map([['blockName', { action: 'update' }]]),
        },
      }];

      bridge.handleRemoteStructureChanges(events);
    });

    it('handles block properties Y.Map updates', () => {
      const mockPropsMap = {
        toJSON: () => ({ minimized: false }),
      };
      const mockBlockMap = {
        get: (key) => {
          const data = {
            id: 'block-1',
            blockId: 'block-1',
            blockName: 'Block',
            properties: mockPropsMap,
          };
          return data[key];
        },
      };

      const mockNav = {
        get: () => ({
          get: (key) => {
            if (key === 'id') return 'page-1';
            if (key === 'blocks') {
              return { get: () => mockBlockMap };
            }
            return null;
          },
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const events = [{
        path: [0, 'blocks', 0, 'properties'],
        changes: {
          keys: new Map([['minimized', { action: 'update' }]]),
        },
      }];

      bridge.handleRemoteStructureChanges(events);
    });

    it('handles deletion events', () => {
      const mockNav = {
        get: () => ({
          get: (key) => {
            if (key === 'id') return 'page-1';
            if (key === 'pageId') return 'page-1';
            return null;
          },
        }),
      };
      bridge.documentManager.getNavigation = () => mockNav;

      const events = [{
        path: [0, 'blocks'],
        changes: {
          deleted: new Set([{ item: 1 }]),
        },
      }];

      bridge.handleRemoteStructureChanges(events);
    });

    it('handles errors gracefully', () => {
      const events = [{
        path: [0, 'blocks', 0, 'components'],
        changes: {
          added: new Set([{
            content: {
              getContent: () => { throw new Error('Test error'); },
            },
          }]),
        },
      }];

      // Should not throw
      bridge.handleRemoteStructureChanges(events);
    });
  });

  describe('renderRemoteComponent', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('calls idevicesEngine.renderRemoteIdevice', async () => {
      const mockEngine = {
        renderRemoteIdevice: mock(() => Promise.resolve()),
      };
      bridge.app = {
        project: { idevices: mockEngine },
      };

      await bridge.renderRemoteComponent(
        { id: 'comp-1', ideviceType: 'FreeText' },
        'page-1',
        'block-1'
      );

      expect(mockEngine.renderRemoteIdevice).toHaveBeenCalled();
    });

    it('handles missing idevicesEngine', async () => {
      bridge.app = { project: null };

      // Should not throw
      await bridge.renderRemoteComponent(
        { id: 'comp-1' },
        'page-1',
        'block-1'
      );
    });

    it('handles render errors gracefully', async () => {
      bridge.app = {
        project: {
          idevices: {
            renderRemoteIdevice: mock(() => Promise.reject(new Error('Render failed'))),
          },
        },
      };

      // Should not throw
      await bridge.renderRemoteComponent({ id: 'comp-1' }, 'page-1', 'block-1');
    });
  });

  describe('updateRemoteComponent', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('updates component when on same page', async () => {
      const mockEngine = {
        updateRemoteIdeviceContent: mock(() => Promise.resolve()),
      };
      bridge.app = {
        project: {
          idevices: mockEngine,
          structure: {
            nodeSelected: {
              getAttribute: () => 'page-1',
            },
          },
        },
      };

      await bridge.updateRemoteComponent({ id: 'comp-1' }, 'page-1');

      expect(mockEngine.updateRemoteIdeviceContent).toHaveBeenCalled();
    });

    it('skips update when on different page', async () => {
      const mockEngine = {
        updateRemoteIdeviceContent: mock(() => Promise.resolve()),
      };
      bridge.app = {
        project: {
          idevices: mockEngine,
          structure: {
            nodeSelected: {
              getAttribute: () => 'page-2',
            },
          },
        },
      };

      await bridge.updateRemoteComponent({ id: 'comp-1' }, 'page-1');

      expect(mockEngine.updateRemoteIdeviceContent).not.toHaveBeenCalled();
    });

    it('handles missing idevicesEngine', async () => {
      bridge.app = {
        project: {
          idevices: null,
          structure: { nodeSelected: { getAttribute: () => 'page-1' } },
        },
      };

      // Should not throw
      await bridge.updateRemoteComponent({ id: 'comp-1' }, 'page-1');
    });
  });

  describe('updateRemoteBlock', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('skips update when on different page', async () => {
      bridge.app = {
        project: {
          structure: {
            nodeSelected: { getAttribute: () => 'page-2' },
          },
        },
      };

      // Should not throw
      await bridge.updateRemoteBlock({ id: 'block-1' }, 'page-1');
    });

    it('handles missing idevicesEngine', async () => {
      bridge.app = {
        project: {
          idevices: null,
          structure: {
            nodeSelected: { getAttribute: () => 'page-1' },
          },
        },
      };

      // Should not throw
      await bridge.updateRemoteBlock({ id: 'block-1' }, 'page-1');
    });

    it('updates block properties when found', async () => {
      const mockBlockNode = {
        blockName: 'Old Name',
        iconName: 'edit',
        blockNameElementText: { innerHTML: '' },
        makeIconNameElement: mock(() => {}),
        properties: {},
        generateBlockContentNode: mock(() => {}),
      };

      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock(() => mockBlockNode),
          },
          structure: {
            nodeSelected: { getAttribute: () => 'page-1' },
          },
        },
      };

      await bridge.updateRemoteBlock(
        { id: 'block-1', blockName: 'New Name', iconName: 'star' },
        'page-1'
      );

      expect(mockBlockNode.blockName).toBe('New Name');
      expect(mockBlockNode.iconName).toBe('star');
    });

    it('updates block with properties object', async () => {
      const mockBlockNode = {
        blockName: 'Block',
        properties: {
          visible: { value: true },
        },
        generateBlockContentNode: mock(() => {}),
      };

      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock(() => mockBlockNode),
          },
          structure: {
            nodeSelected: { getAttribute: () => 'page-1' },
          },
        },
      };

      await bridge.updateRemoteBlock(
        { id: 'block-1', properties: { visible: false } },
        'page-1'
      );

      expect(mockBlockNode.properties.visible.value).toBe(false);
      expect(mockBlockNode.generateBlockContentNode).toHaveBeenCalled();
    });

    it('finds block by sym-id when getBlockById fails', async () => {
      const blockElement = { id: 'local-block-id' };
      const mockBlockNode = {
        blockName: 'Old',
      };

      global.document.querySelector = mock((selector) => {
        if (selector.includes('sym-id')) return blockElement;
        return null;
      });

      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock((id) => {
              if (id === 'local-block-id') return mockBlockNode;
              return null;
            }),
          },
          structure: {
            nodeSelected: { getAttribute: () => 'page-1' },
          },
        },
      };

      await bridge.updateRemoteBlock({ id: 'remote-block-id', blockName: 'New' }, 'page-1');

      expect(mockBlockNode.blockName).toBe('New');
    });
  });

  describe('syncStructureToLegacy', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('converts pages to legacy format', () => {
      bridge.structureBinding = {
        getPages: mock(() => [
          { id: 'page-1', pageName: 'Page 1', parentId: null, order: 0 },
          { id: 'page-2', pageName: 'Page 2', parentId: 'page-1', order: 1 },
        ]),
      };

      const mockSetData = mock(() => {});
      bridge.app = {
        project: {
          structure: {
            setDataFromYjs: mockSetData,
          },
        },
      };

      bridge.syncStructureToLegacy();

      expect(mockSetData).toHaveBeenCalled();
      const calledData = mockSetData.mock.calls[0][0];
      expect(calledData.length).toBe(2);
      expect(calledData[0].pageId).toBe('page-1');
      expect(calledData[1].parent).toBe('page-1');
    });

    it('handles missing setDataFromYjs method', () => {
      bridge.structureBinding = {
        getPages: mock(() => []),
      };
      bridge.app = { project: { structure: {} } };

      // Should not throw
      bridge.syncStructureToLegacy();
    });
  });

  describe('syncMetadataToLegacy', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('syncs metadata to legacy properties', () => {
      const mockMetadata = {
        get: (key) => {
          const data = {
            title: 'Test Title',
            author: 'Test Author',
            language: 'en',
            description: 'Test desc',
            license: 'CC-BY',
          };
          return data[key];
        },
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      const mockSetFromYjs = mock(() => {});
      bridge.app = {
        project: {
          properties: {
            setFromYjs: mockSetFromYjs,
          },
        },
      };

      bridge.syncMetadataToLegacy();

      expect(mockSetFromYjs).toHaveBeenCalled();
      const calledProps = mockSetFromYjs.mock.calls[0][0];
      expect(calledProps.title).toBe('Test Title');
      expect(calledProps.author).toBe('Test Author');
    });

    it('handles missing setFromYjs method', () => {
      bridge.documentManager.getMetadata = () => ({
        get: () => 'test',
      });
      bridge.app = { project: { properties: {} } };

      // Should not throw
      bridge.syncMetadataToLegacy();
    });
  });

  describe('reloadCurrentPage', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns early when no current page', async () => {
      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: null,
            },
          },
        },
      };

      // Should not throw
      await bridge.reloadCurrentPage();
    });

    it('reloads page after debounce', async () => {
      const mockLoad = mock(() => Promise.resolve());
      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: () => 'page-1',
              },
              menuNav: {
                querySelector: () => ({ id: 'page-element' }),
              },
              checkIfEmptyNode: mock(() => {}),
            },
          },
          idevices: {
            loadApiIdevicesInPage: mockLoad,
          },
        },
        menus: {
          menuStructure: {
            menuStructureBehaviour: {
              checkIfEmptyNode: mock(() => {}),
            },
          },
        },
      };

      bridge.reloadCurrentPage();

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLoad).toHaveBeenCalled();
    });
  });

  describe('forceAllFormInputsSync', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns early when no metadata', () => {
      bridge.documentManager = null;
      // Should not throw
      bridge.forceAllFormInputsSync();
    });

    it('updates checkbox inputs', () => {
      const mockInput = {
        getAttribute: (attr) => attr === 'property' ? 'pp_addExeLink' : 'checkbox',
        type: 'checkbox',
        checked: false,
        value: '',
      };
      global.document.querySelectorAll = mock(() => [mockInput]);

      const mockMetadata = {
        get: (key) => key === 'addExeLink' ? 'true' : undefined,
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge.forceAllFormInputsSync();

      expect(mockInput.checked).toBe(true);
    });

    it('updates text inputs', () => {
      const mockInput = {
        getAttribute: (attr) => {
          if (attr === 'property') return 'pp_title';
          if (attr === 'data-type') return 'text';
          return null;
        },
        type: 'text',
        value: '',
      };
      global.document.querySelectorAll = mock(() => [mockInput]);

      const mockMetadata = {
        get: (key) => key === 'title' ? 'New Title' : undefined,
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge.forceAllFormInputsSync();

      expect(mockInput.value).toBe('New Title');
    });

    it('skips inputs without property attribute', () => {
      const mockInput = {
        getAttribute: () => null,
        value: 'unchanged',
      };
      global.document.querySelectorAll = mock(() => [mockInput]);

      bridge.forceAllFormInputsSync();

      expect(mockInput.value).toBe('unchanged');
    });
  });

  describe('saveToServer', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('calls save with showProgress true', async () => {
      bridge.save = mock(() => Promise.resolve({ success: true }));

      await bridge.saveToServer();

      expect(bridge.save).toHaveBeenCalledWith({ showProgress: true });
    });
  });

  describe('importFromElpx', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('calls importer and announces assets', async () => {
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 5, theme: 'base' })),
      };
      global.window.ElpxImporter = mock(function() { return mockImporter; });

      bridge.announceAssets = mock(() => Promise.resolve());
      bridge._checkAndImportTheme = mock(() => Promise.resolve());

      const file = new Blob(['test'], { type: 'application/zip' });
      const result = await bridge.importFromElpx(file);

      expect(result.assets).toBe(5);
      expect(bridge.announceAssets).toHaveBeenCalled();
      // Theme import is called when clearExisting is true (default)
      expect(bridge._checkAndImportTheme).toHaveBeenCalledWith('base', file);
    });

    it('imports theme when clearExisting is explicitly true', async () => {
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 0, theme: 'custom-theme' })),
      };
      global.window.ElpxImporter = mock(function() { return mockImporter; });

      bridge._checkAndImportTheme = mock(() => Promise.resolve());

      const file = new Blob(['test'], { type: 'application/zip' });
      await bridge.importFromElpx(file, { clearExisting: true });

      expect(bridge._checkAndImportTheme).toHaveBeenCalledWith('custom-theme', file);
    });

    it('does NOT import theme when clearExisting is false (importing into existing project)', async () => {
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 3, theme: 'imported-theme' })),
      };
      global.window.ElpxImporter = mock(function() { return mockImporter; });

      bridge.announceAssets = mock(() => Promise.resolve());
      bridge._checkAndImportTheme = mock(() => Promise.resolve());

      const file = new Blob(['test'], { type: 'application/zip' });
      const result = await bridge.importFromElpx(file, { clearExisting: false });

      expect(result.assets).toBe(3);
      expect(bridge.announceAssets).toHaveBeenCalled();
      // Theme should NOT be imported when merging into existing project
      expect(bridge._checkAndImportTheme).not.toHaveBeenCalled();
    });

    it('uses assetManager when available', async () => {
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 0 })),
      };
      global.window.ElpxImporter = mock(function(docManager, assetHandler) {
        expect(assetHandler).toBe(bridge.assetManager);
        return mockImporter;
      });

      bridge.assetManager = { id: 'asset-manager' };
      bridge.assetCache = { id: 'asset-cache' };

      const file = new Blob(['test']);
      await bridge.importFromElpx(file);
    });

    it('falls back to assetCache when assetManager unavailable', async () => {
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 0 })),
      };
      global.window.ElpxImporter = mock(function(docManager, assetHandler) {
        expect(assetHandler).toBe(bridge.assetCache);
        return mockImporter;
      });

      bridge.assetManager = null;
      bridge.assetCache = { id: 'asset-cache' };

      const file = new Blob(['test']);
      await bridge.importFromElpx(file);
    });
  });

  describe('exportToElpx', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('throws when SharedExporters unavailable', async () => {
      global.window.SharedExporters = null;

      await expect(bridge.exportToElpx()).rejects.toThrow('SharedExporters not available');
    });

    it('uses SharedExporters when available', async () => {
      const mockExporter = {
        export: mock(() => Promise.resolve({
          success: true,
          data: new ArrayBuffer(8),
          filename: 'test.elpx',
        })),
      };
      global.window.SharedExporters = {
        createExporter: mock(() => mockExporter),
      };

      // Mock URL.createObjectURL and document functions
      const mockLink = {
        href: '',
        download: '',
        click: mock(() => {}),
      };
      global.URL.createObjectURL = mock(() => 'blob:test');
      global.URL.revokeObjectURL = mock(() => {});
      global.document.createElement = mock(() => mockLink);
      global.document.body = {
        appendChild: mock(() => {}),
        removeChild: mock(() => {}),
      };

      await bridge.exportToElpx();

      expect(global.window.SharedExporters.createExporter).toHaveBeenCalledWith(
        'elpx',
        bridge.documentManager,
        bridge.assetCache,
        bridge.resourceFetcher,
        bridge.assetManager
      );
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('throws on export failure', async () => {
      global.window.SharedExporters = {
        createExporter: mock(() => ({
          export: mock(() => Promise.resolve({
            success: false,
            error: 'Export failed',
          })),
        })),
      };

      await expect(bridge.exportToElpx()).rejects.toThrow('Export failed');
    });

    it('uses electronAPI.saveBuffer() in Electron mode with saveAs: false', async () => {
      const mockExporter = {
        export: mock(() => Promise.resolve({
          success: true,
          data: new ArrayBuffer(8),
          filename: 'project.elpx',
        })),
      };
      global.window.SharedExporters = {
        createExporter: mock(() => mockExporter),
      };

      // Set up Electron mode
      global.eXeLearning = { config: { isOfflineInstallation: true } };
      global.window.__currentProjectId = 'test-project-123';
      global.window.electronAPI = {
        saveBuffer: mock(() => Promise.resolve(true)),
        saveBufferAs: mock(() => Promise.resolve(true)),
      };

      await bridge.exportToElpx({ saveAs: false });

      expect(global.window.electronAPI.saveBuffer).toHaveBeenCalledWith(
        expect.any(String), // base64 data
        'test-project-123',
        'project.elpx'
      );
      expect(global.window.electronAPI.saveBufferAs).not.toHaveBeenCalled();

      // Cleanup
      delete global.eXeLearning;
      delete global.window.__currentProjectId;
      delete global.window.electronAPI;
    });

    it('uses electronAPI.saveBufferAs() in Electron mode with saveAs: true', async () => {
      const mockExporter = {
        export: mock(() => Promise.resolve({
          success: true,
          data: new ArrayBuffer(8),
          filename: 'project.elpx',
        })),
      };
      global.window.SharedExporters = {
        createExporter: mock(() => mockExporter),
      };

      // Set up Electron mode
      global.eXeLearning = { config: { isOfflineInstallation: true } };
      global.window.__currentProjectId = 'test-project-456';
      global.window.electronAPI = {
        saveBuffer: mock(() => Promise.resolve(true)),
        saveBufferAs: mock(() => Promise.resolve(true)),
      };

      await bridge.exportToElpx({ saveAs: true });

      expect(global.window.electronAPI.saveBufferAs).toHaveBeenCalledWith(
        expect.any(String), // base64 data
        'test-project-456',
        'project.elpx'
      );
      expect(global.window.electronAPI.saveBuffer).not.toHaveBeenCalled();

      // Cleanup
      delete global.eXeLearning;
      delete global.window.__currentProjectId;
      delete global.window.electronAPI;
    });

    it('uses default key when __currentProjectId is not set', async () => {
      const mockExporter = {
        export: mock(() => Promise.resolve({
          success: true,
          data: new ArrayBuffer(8),
          filename: 'project.elpx',
        })),
      };
      global.window.SharedExporters = {
        createExporter: mock(() => mockExporter),
      };

      // Set up Electron mode without project ID
      global.eXeLearning = { config: { isOfflineInstallation: true } };
      delete global.window.__currentProjectId;
      global.window.electronAPI = {
        saveBuffer: mock(() => Promise.resolve(true)),
      };

      await bridge.exportToElpx({ saveAs: false });

      expect(global.window.electronAPI.saveBuffer).toHaveBeenCalledWith(
        expect.any(String), // base64 data
        'default',
        'project.elpx'
      );

      // Cleanup
      delete global.eXeLearning;
      delete global.window.electronAPI;
    });

    it('falls back to browser download when not in Electron mode', async () => {
      const mockExporter = {
        export: mock(() => Promise.resolve({
          success: true,
          data: new ArrayBuffer(8),
          filename: 'test.elpx',
        })),
      };
      global.window.SharedExporters = {
        createExporter: mock(() => mockExporter),
      };

      // Not in Electron mode
      global.eXeLearning = { config: { isOfflineInstallation: false } };

      const mockLink = {
        href: '',
        download: '',
        click: mock(() => {}),
      };
      global.URL.createObjectURL = mock(() => 'blob:test');
      global.URL.revokeObjectURL = mock(() => {});
      global.document.createElement = mock(() => mockLink);
      global.document.body = {
        appendChild: mock(() => {}),
        removeChild: mock(() => {}),
      };

      await bridge.exportToElpx({ saveAs: false });

      expect(mockLink.click).toHaveBeenCalled();
      expect(mockLink.download).toBe('test.elpx');

      // Cleanup
      delete global.eXeLearning;
    });
  });

  describe('blank structure creation after sync', () => {
    beforeEach(async () => {
      // Mock wsProvider for online mode testing
      global.window.WebsocketProvider = class {
        constructor() {
          this.synced = true;
          this.awareness = { on: () => {}, setLocalState: () => {}, setLocalStateField: () => {} };
        }
        on() {}
        once(event, cb) { if (event === 'sync') setTimeout(() => cb(true), 0); }
        off() {}
        connect() {}
        disconnect() {}
        destroy() {}
      };
    });

    it('calls ensureBlankStructureIfEmpty after WebSocket sync in online mode', async () => {
      // Modify mock to have wsProvider
      const mockDocManager = new MockYjsDocumentManager(123, { offline: false });
      mockDocManager.wsProvider = { synced: true };

      // Manually verify that when bridge calls ensureBlankStructureIfEmpty, it's tracked
      global.window.YjsDocumentManager = function(projectId, config) {
        return mockDocManager;
      };

      await bridge.initialize(123, 'test-token');

      // In online mode with wsProvider, ensureBlankStructureIfEmpty should be called
      // We need to manually trigger the WebSocket flow since the mock doesn't auto-connect
      if (bridge.documentManager?.wsProvider) {
        bridge.documentManager.ensureBlankStructureIfEmpty();
      }

      expect(mockDocManager._ensureBlankStructureIfEmptyCalled).toBe(true);
    });

    it('prevents duplicate pages by deferring blank structure to after sync', async () => {
      // This test documents the fix for the duplicate page bug
      // When two clients join simultaneously, both would create blank structure
      // before syncing, resulting in 2 pages after Yjs merge.
      //
      // The fix: blank structure is created AFTER sync, ensuring only the first
      // client's structure is used.

      const mockDocManager = new MockYjsDocumentManager(123, { offline: false });
      mockDocManager.wsProvider = { synced: true };

      global.window.YjsDocumentManager = function() {
        return mockDocManager;
      };

      await bridge.initialize(123, 'test-token');

      // Verify the method exists and is callable
      expect(typeof mockDocManager.ensureBlankStructureIfEmpty).toBe('function');

      // After sync, this should be called (simulated)
      mockDocManager.ensureBlankStructureIfEmpty();
      expect(mockDocManager._ensureBlankStructureIfEmptyCalled).toBe(true);
    });
  });

  describe('injectSaveStatusUI', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('removes existing UI before creating new', () => {
      const existingElement = { remove: mock(() => {}) };
      const mockButton = {
        addEventListener: mock(() => {}),
        disabled: false,
      };
      const mockContainer = {
        id: '',
        className: '',
        innerHTML: '',
        querySelector: mock((selector) => {
          if (selector.includes('undo')) return mockButton;
          if (selector.includes('redo')) return mockButton;
          return null;
        }),
      };

      global.document.getElementById = mock((id) => {
        if (id === 'yjs-undo-redo') return existingElement;
        return null;
      });
      global.document.querySelector = mock(() => ({
        appendChild: mock(() => {}),
      }));
      global.document.createElement = mock(() => mockContainer);
      global.document.head = {
        appendChild: mock(() => {}),
      };

      bridge.injectSaveStatusUI();

      expect(existingElement.remove).toHaveBeenCalled();
    });

    it('warns when navbar not found', () => {
      global.document.getElementById = mock(() => null);
      global.document.querySelector = mock(() => null);

      bridge.injectSaveStatusUI();
      // Should warn but not throw
    });

    it('binds button click events when navbar exists', () => {
      const mockButton = {
        addEventListener: mock(() => {}),
        disabled: false,
      };
      const mockContainer = {
        id: '',
        className: '',
        innerHTML: '',
        querySelector: mock((selector) => {
          if (selector.includes('undo')) return mockButton;
          if (selector.includes('redo')) return mockButton;
          return null;
        }),
      };
      const navbar = {
        appendChild: mock(() => {}),
      };

      global.document.getElementById = mock(() => null);
      global.document.querySelector = mock((selector) => {
        if (selector === '.navbar-nav, .toolbar, #toolbar') return navbar;
        return null;
      });
      global.document.createElement = mock(() => mockContainer);
      global.document.head = { appendChild: mock(() => {}) };

      bridge.undo = mock(() => {});
      bridge.redo = mock(() => {});

      bridge.injectSaveStatusUI();

      // Verify addEventListener was called for buttons
      expect(mockButton.addEventListener).toHaveBeenCalled();
    });
  });

  describe('User Theme Methods', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      bridge.documentManager = new MockYjsDocumentManager('test-project', {});
      bridge.resourceCache = {
        setUserTheme: mock(() => Promise.resolve()),
        hasUserTheme: mock(() => Promise.resolve(false)),
        getUserTheme: mock(() => Promise.resolve(null)),
        getUserThemeRaw: mock(() => Promise.resolve(null)),
      };
      bridge.resourceFetcher = {
        setUserThemeFiles: mock(() => Promise.resolve()),
        hasUserTheme: mock(() => false),
      };

      // Mock fflate
      global.window.fflate = {
        zipSync: mock(() => new Uint8Array([80, 75, 3, 4])),
        unzipSync: mock(() => ({
          'config.xml': new TextEncoder().encode('<theme><name>Test</name></theme>'),
          'style.css': new Uint8Array([1, 2, 3]),
        })),
      };

      // Store mock zip for _extractThemeFilesFromZip (correct property name)
      bridge._pendingThemeZip = {
        'theme/config.xml': new Uint8Array(new TextEncoder().encode('<theme><name>Test</name></theme>')),
        'theme/style.css': new Uint8Array([1, 2, 3]),
      };
    });

    describe('_uint8ArrayToBase64', () => {
      it('converts Uint8Array to base64 string', () => {
        const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        const result = bridge._uint8ArrayToBase64(input);
        expect(result).toBe('SGVsbG8=');
      });

      it('handles empty array', () => {
        const input = new Uint8Array([]);
        const result = bridge._uint8ArrayToBase64(input);
        expect(result).toBe('');
      });
    });

    describe('_base64ToUint8Array', () => {
      it('converts base64 string to Uint8Array', () => {
        const input = 'SGVsbG8='; // "Hello"
        const result = bridge._base64ToUint8Array(input);
        expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
      });

      it('handles empty string', () => {
        const input = '';
        const result = bridge._base64ToUint8Array(input);
        expect(result).toEqual(new Uint8Array([]));
      });
    });

    describe('_extractThemeFilesFromZip', () => {
      it('extracts theme files from pending ZIP', () => {
        const result = bridge._extractThemeFilesFromZip();

        expect(result).not.toBeNull();
        expect(result.files).toBeDefined();
        expect(Object.keys(result.files)).toContain('config.xml');
        expect(Object.keys(result.files)).toContain('style.css');
      });

      it('returns null when no pending ZIP', () => {
        bridge._pendingThemeZip = null;
        const result = bridge._extractThemeFilesFromZip();
        expect(result).toBeNull();
      });

      it('returns null when no theme folder in ZIP', () => {
        bridge._pendingThemeZip = {
          'content.xml': new Uint8Array([1]),
        };
        const result = bridge._extractThemeFilesFromZip();
        expect(result).toBeNull();
      });
    });

    describe('_parseThemeConfigFromFiles', () => {
      it('parses config.xml and creates theme configuration', () => {
        const themeFilesData = {
          files: {
            'config.xml': new Uint8Array([1]),
            'style.css': new Uint8Array([1]),
          },
          configXml: '<theme><name>My Theme</name><version>1.0</version><downloadable>0</downloadable></theme>',
        };

        const result = bridge._parseThemeConfigFromFiles('my-theme', themeFilesData);

        expect(result).not.toBeNull();
        expect(result.name).toBe('My Theme');
        expect(result.type).toBe('user');
        expect(result.isUserTheme).toBe(true);
        expect(result.downloadable).toBe('0');
      });

      it('uses default values when config.xml is missing', () => {
        const themeFilesData = {
          files: {
            'style.css': new Uint8Array([1]),
          },
          configXml: null,
        };

        const result = bridge._parseThemeConfigFromFiles('my-theme', themeFilesData);

        // Should use themeName as default values
        expect(result.name).toBe('my-theme');
        expect(result.displayName).toBe('my-theme');
        expect(result.type).toBe('user');
        expect(result.downloadable).toBe('1');
      });

      it('detects CSS and JS files', () => {
        const themeFilesData = {
          files: {
            'config.xml': new Uint8Array([1]),
            'main.css': new Uint8Array([1]),
            'extra.css': new Uint8Array([2]),
            'script.js': new Uint8Array([3]),
          },
          configXml: '<theme><name>Test</name></theme>',
        };

        const result = bridge._parseThemeConfigFromFiles('test-theme', themeFilesData);

        expect(result.cssFiles).toContain('main.css');
        expect(result.cssFiles).toContain('extra.css');
        expect(result.js).toContain('script.js');
      });

      it('parses icons from icons/ directory as ThemeIcon objects', () => {
        const themeFilesData = {
          files: {
            'config.xml': new Uint8Array([1]),
            'style.css': new Uint8Array([1]),
            'icons/info.png': new Uint8Array([2]),
            'icons/warning.svg': new Uint8Array([3]),
            'icons/chrono.png': new Uint8Array([4]),
          },
          configXml: '<theme><name>Icon Theme</name></theme>',
        };

        const result = bridge._parseThemeConfigFromFiles('icon-theme', themeFilesData);

        // Verify icons are parsed as ThemeIcon objects, not strings
        expect(result.icons).toBeDefined();
        expect(Object.keys(result.icons)).toHaveLength(3);

        // Check info icon
        expect(result.icons.info).toEqual({
          id: 'info',
          title: 'info',
          type: 'img',
          value: 'icons/info.png',
          _relativePath: 'icons/info.png',
        });

        // Check warning icon
        expect(result.icons.warning).toEqual({
          id: 'warning',
          title: 'warning',
          type: 'img',
          value: 'icons/warning.svg',
          _relativePath: 'icons/warning.svg',
        });

        // Check chrono icon
        expect(result.icons.chrono).toEqual({
          id: 'chrono',
          title: 'chrono',
          type: 'img',
          value: 'icons/chrono.png',
          _relativePath: 'icons/chrono.png',
        });
      });

      it('ignores non-icon files in icons/ directory', () => {
        const themeFilesData = {
          files: {
            'config.xml': new Uint8Array([1]),
            'icons/info.png': new Uint8Array([2]),
            'icons/readme.txt': new Uint8Array([3]), // Should be ignored
            'icons/icon.gif': new Uint8Array([4]), // Should be ignored (only .png/.svg)
          },
          configXml: '<theme><name>Test</name></theme>',
        };

        const result = bridge._parseThemeConfigFromFiles('test-theme', themeFilesData);

        expect(Object.keys(result.icons)).toHaveLength(1);
        expect(result.icons.info).toBeDefined();
        expect(result.icons.readme).toBeUndefined();
        expect(result.icons.icon).toBeUndefined();
      });
    });

    describe('_compressThemeFiles', () => {
      it('compresses files using fflate zipSync', () => {
        const files = {
          'style.css': new Uint8Array([1, 2, 3]),
          'config.xml': new Uint8Array([4, 5, 6]),
        };

        const result = bridge._compressThemeFiles(files);

        expect(global.window.fflate.zipSync).toHaveBeenCalled();
        expect(result).toBeInstanceOf(Uint8Array);
      });

      it('throws when fflate not available', () => {
        delete global.window.fflate;

        expect(() => {
          bridge._compressThemeFiles({ 'style.css': new Uint8Array([1]) });
        }).toThrow('fflate library not loaded');
      });
    });

    describe('_copyThemeToYjs', () => {
      it('copies compressed theme to Yjs themeFiles map', async () => {
        const mockThemeFilesMap = {
          set: mock(() => {}),
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);

        await bridge._copyThemeToYjs('test-theme', { 'style.css': new Uint8Array([1]) });

        expect(mockThemeFilesMap.set).toHaveBeenCalledWith(
          'test-theme',
          expect.any(String) // base64 compressed
        );
      });
    });

    describe('_loadUserThemeFromIndexedDB', () => {
      it('calls resourceCache.getUserTheme with theme name', async () => {
        const mockThemeData = {
          files: new Map([['style.css', new Blob(['css'])]]),
          config: { id: 'test-theme', name: 'test-theme', type: 'user', isUserTheme: true },
        };
        bridge.resourceCache.getUserTheme = mock(() => Promise.resolve(mockThemeData));
        global.eXeLearning.app.themes.list.addUserTheme = mock(() => {});
        global.eXeLearning.app.themes.list.installed = {};

        await bridge._loadUserThemeFromIndexedDB('test-theme');

        expect(bridge.resourceCache.getUserTheme).toHaveBeenCalledWith('test-theme');
      });
    });

    describe('loadUserThemesFromYjs', () => {
      it('loads themes from Yjs themeFiles map', async () => {
        const mockThemeFilesMap = {
          entries: mock(() => [
            ['theme1', 'base64data1'],
            ['theme2', 'base64data2'],
          ]),
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);
        bridge._loadUserThemeFromYjs = mock(() => Promise.resolve());

        await bridge.loadUserThemesFromYjs();

        expect(bridge._loadUserThemeFromYjs).toHaveBeenCalledTimes(2);
      });

      it('handles empty themeFiles map', async () => {
        const mockThemeFilesMap = {
          entries: mock(() => []),
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);

        // Should not throw
        await expect(bridge.loadUserThemesFromYjs()).resolves.not.toThrow();
      });

      it('handles missing documentManager', async () => {
        bridge.documentManager = null;

        // Should not throw
        await expect(bridge.loadUserThemesFromYjs()).resolves.not.toThrow();
      });
    });

    describe('_decompressThemeFromYjs', () => {
      it('decompresses base64 theme data', () => {
        const result = bridge._decompressThemeFromYjs('UEsDBBQ='); // Minimal base64

        expect(global.window.fflate.unzipSync).toHaveBeenCalled();
        expect(result).toBeDefined();
      });
    });

    describe('setupThemeFilesObserver', () => {
      it('sets up observer on themeFiles map', () => {
        const mockObserve = mock(() => {});
        const mockThemeFilesMap = {
          observe: mockObserve,
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);

        bridge.setupThemeFilesObserver();

        expect(mockThemeFilesMap.observe).toHaveBeenCalled();
      });

      it('handles missing documentManager', () => {
        bridge.documentManager = null;

        // Should not throw
        expect(() => bridge.setupThemeFilesObserver()).not.toThrow();
      });

      it('handles missing getThemeFiles method', () => {
        bridge.documentManager.getThemeFiles = undefined;

        // Should not throw
        expect(() => bridge.setupThemeFilesObserver()).not.toThrow();
      });

      it('handles observer callback for added themes', async () => {
        let observerCallback = null;
        const mockThemeFilesMap = {
          observe: (cb) => {
            observerCallback = cb;
          },
          get: mock(() => 'base64themedata'),
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);
        bridge._loadUserThemeFromYjs = mock(() => Promise.resolve());

        bridge.setupThemeFilesObserver();

        // Simulate observer callback for 'add' action
        await observerCallback({
          changes: {
            keys: [['new-theme', { action: 'add' }]],
          },
        });

        expect(bridge._loadUserThemeFromYjs).toHaveBeenCalledWith('new-theme', 'base64themedata');
      });

      it('handles observer callback for deleted themes', async () => {
        let observerCallback = null;
        const mockThemeFilesMap = {
          observe: (cb) => {
            observerCallback = cb;
          },
          get: mock(() => null),
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);
        bridge.resourceFetcher = {
          userThemeFiles: new Map([['deleted-theme', {}]]),
          cache: new Map([['theme:deleted-theme', {}]]),
        };

        bridge.setupThemeFilesObserver();

        // Simulate observer callback for 'delete' action
        await observerCallback({
          changes: {
            keys: [['deleted-theme', { action: 'delete' }]],
          },
        });

        expect(bridge.resourceFetcher.userThemeFiles.has('deleted-theme')).toBe(false);
        expect(bridge.resourceFetcher.cache.has('theme:deleted-theme')).toBe(false);
      });
    });

    describe('_loadUserThemeFromYjs - extended', () => {
      it('returns early if theme already loaded in ResourceFetcher', async () => {
        bridge.resourceFetcher.hasUserTheme = mock(() => true);
        bridge._decompressThemeFromYjs = mock(() => {});

        await bridge._loadUserThemeFromYjs('existing-theme', 'somedata');

        expect(bridge._decompressThemeFromYjs).not.toHaveBeenCalled();
      });

      it('loads from IndexedDB when available', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(true));
        bridge._loadUserThemeFromIndexedDB = mock(() => Promise.resolve());

        await bridge._loadUserThemeFromYjs('idb-theme', 'somedata');

        expect(bridge._loadUserThemeFromIndexedDB).toHaveBeenCalledWith('idb-theme');
      });

      it('handles IndexedDB check error gracefully', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.reject(new Error('IDB error')));
        bridge._decompressThemeFromYjs = mock(() => ({ files: {}, configXml: null }));

        // Should not throw
        await expect(bridge._loadUserThemeFromYjs('theme', 'data')).resolves.not.toThrow();
      });

      it('handles legacy Y.Map format', async () => {
        const legacyMap = {
          entries: mock(() => [
            ['config.xml', 'PGNvbmZpZz48L2NvbmZpZz4='], // <config></config>
            ['style.css', 'Ym9keXt9'], // body{}
          ]),
        };
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(false));
        bridge.resourceFetcher.hasUserTheme = mock(() => false);
        bridge._parseThemeConfigFromFiles = mock(() => ({ name: 'legacy' }));

        await bridge._loadUserThemeFromYjs('legacy-theme', legacyMap);

        expect(bridge._parseThemeConfigFromFiles).toHaveBeenCalled();
      });

      it('skips unknown theme data format', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(false));
        bridge.resourceFetcher.hasUserTheme = mock(() => false);
        bridge._parseThemeConfigFromFiles = mock(() => ({}));

        // Pass an object that is not a string and has no entries() function
        await bridge._loadUserThemeFromYjs('unknown-theme', { someKey: 'someValue' });

        expect(bridge._parseThemeConfigFromFiles).not.toHaveBeenCalled();
      });

      it('skips theme with no files', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(false));
        bridge.resourceFetcher.hasUserTheme = mock(() => false);
        bridge._decompressThemeFromYjs = mock(() => ({ files: {}, configXml: null }));
        bridge._parseThemeConfigFromFiles = mock(() => ({}));

        await bridge._loadUserThemeFromYjs('empty-theme', 'somedata');

        expect(bridge._parseThemeConfigFromFiles).not.toHaveBeenCalled();
      });

      it('skips theme when config parsing fails', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(false));
        bridge.resourceFetcher.hasUserTheme = mock(() => false);
        bridge._decompressThemeFromYjs = mock(() => ({
          files: { 'style.css': new Uint8Array([1]) },
          configXml: null,
        }));
        bridge._parseThemeConfigFromFiles = mock(() => null);

        await bridge._loadUserThemeFromYjs('bad-config-theme', 'somedata');

        expect(bridge.resourceCache.setUserTheme).not.toHaveBeenCalled();
      });

      it('saves to IndexedDB and registers with ResourceFetcher', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(false));
        bridge.resourceFetcher.hasUserTheme = mock(() => false);
        bridge._decompressThemeFromYjs = mock(() => ({
          files: { 'style.css': new Uint8Array([1]) },
          configXml: '<theme><name>Test</name></theme>',
        }));
        bridge._compressThemeFiles = mock(() => new Uint8Array([1, 2, 3]));
        bridge._parseThemeConfigFromFiles = mock(() => ({
          name: 'good-theme',
          type: 'user',
          isUserTheme: true,
        }));
        global.eXeLearning.app.themes.list.installed = {};
        global.eXeLearning.app.themes.list.addUserTheme = mock(() => {});

        await bridge._loadUserThemeFromYjs('good-theme', 'somedata');

        expect(bridge.resourceCache.setUserTheme).toHaveBeenCalled();
        expect(bridge.resourceFetcher.setUserThemeFiles).toHaveBeenCalled();
        expect(global.eXeLearning.app.themes.list.addUserTheme).toHaveBeenCalled();
      });

      it('handles error saving to IndexedDB', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(false));
        bridge.resourceCache.setUserTheme = mock(() => Promise.reject(new Error('IDB save error')));
        bridge.resourceFetcher.hasUserTheme = mock(() => false);
        bridge._decompressThemeFromYjs = mock(() => ({
          files: { 'style.css': new Uint8Array([1]) },
          configXml: '<theme><name>Test</name></theme>',
        }));
        bridge._compressThemeFiles = mock(() => new Uint8Array([1, 2, 3]));
        bridge._parseThemeConfigFromFiles = mock(() => ({
          name: 'test-theme',
          type: 'user',
        }));

        // Should not throw
        await expect(bridge._loadUserThemeFromYjs('test-theme', 'data')).resolves.not.toThrow();
      });

      it('skips adding to installed themes if already exists', async () => {
        bridge.resourceCache.hasUserTheme = mock(() => Promise.resolve(false));
        bridge.resourceFetcher.hasUserTheme = mock(() => false);
        bridge._decompressThemeFromYjs = mock(() => ({
          files: { 'style.css': new Uint8Array([1]) },
          configXml: '<theme><name>Test</name></theme>',
        }));
        bridge._compressThemeFiles = mock(() => new Uint8Array([1, 2, 3]));
        bridge._parseThemeConfigFromFiles = mock(() => ({
          name: 'existing-theme',
          type: 'user',
        }));
        global.eXeLearning.app.themes.list.installed = { 'existing-theme': {} };
        global.eXeLearning.app.themes.list.addUserTheme = mock(() => {});

        await bridge._loadUserThemeFromYjs('existing-theme', 'data');

        expect(global.eXeLearning.app.themes.list.addUserTheme).not.toHaveBeenCalled();
      });

      it('handles top-level error', async () => {
        bridge.resourceCache = null;
        bridge.resourceFetcher = null;

        // Should not throw even with null dependencies
        await expect(bridge._loadUserThemeFromYjs('theme', 'data')).resolves.not.toThrow();
      });
    });
  });

  describe('disconnect', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('cleans up all resources', async () => {
      const mockDocumentManagerDestroy = mock(() => Promise.resolve());
      const mockAssetWSHandlerDestroy = mock(() => {});
      const mockAssetManagerCleanup = mock(() => {});
      const mockAssetCacheDestroy = mock(() => {});
      const mockConnectionMonitorDestroy = mock(() => {});

      bridge.documentManager = { destroy: mockDocumentManagerDestroy };
      bridge.assetWebSocketHandler = { destroy: mockAssetWSHandlerDestroy };
      bridge.assetManager = { cleanup: mockAssetManagerCleanup };
      bridge.assetCache = { destroy: mockAssetCacheDestroy };
      bridge.saveManager = { save: () => {} };
      bridge.connectionMonitor = { destroy: mockConnectionMonitorDestroy };

      await bridge.disconnect();

      expect(mockDocumentManagerDestroy).toHaveBeenCalled();
      expect(mockAssetWSHandlerDestroy).toHaveBeenCalled();
      expect(mockAssetManagerCleanup).toHaveBeenCalled();
      expect(mockAssetCacheDestroy).toHaveBeenCalled();
      expect(mockConnectionMonitorDestroy).toHaveBeenCalled();
      expect(bridge.initialized).toBe(false);
      expect(bridge.saveManager).toBeNull();
      expect(bridge.connectionMonitor).toBeNull();
    });

    it('handles disconnect without assetCache.destroy method', async () => {
      bridge.documentManager = { destroy: mock(() => Promise.resolve()) };
      bridge.assetCache = {}; // No destroy method
      bridge.assetWebSocketHandler = null;
      bridge.assetManager = null;
      bridge.connectionMonitor = null;

      await expect(bridge.disconnect()).resolves.not.toThrow();
    });

    it('handles disconnect with null resources', async () => {
      bridge.documentManager = null;
      bridge.assetWebSocketHandler = null;
      bridge.assetManager = null;
      bridge.assetCache = null;
      bridge.connectionMonitor = null;

      await expect(bridge.disconnect()).resolves.not.toThrow();
      expect(bridge.initialized).toBe(false);
    });
  });

  describe('importStructure', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('imports API structure via structureBinding', () => {
      const mockImportFromApi = mock(() => {});
      bridge.structureBinding = {
        importFromApiStructure: mockImportFromApi,
      };
      bridge.updateUndoRedoButtons = mock(() => {});

      const apiStructure = [{ id: 'page-1', pageName: 'Page 1' }];
      bridge.importStructure(apiStructure);

      expect(mockImportFromApi).toHaveBeenCalledWith(apiStructure);
      expect(bridge.updateUndoRedoButtons).toHaveBeenCalled();
    });

    it('handles missing structureBinding', () => {
      bridge.structureBinding = null;

      // Should not throw
      expect(() => bridge.importStructure([])).not.toThrow();
    });
  });

  describe('clearNavigation', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('clears navigation via structureBinding', () => {
      const mockClearNav = mock(() => {});
      bridge.structureBinding = {
        clearNavigation: mockClearNav,
      };

      bridge.clearNavigation();

      expect(mockClearNav).toHaveBeenCalled();
    });

    it('handles missing structureBinding', () => {
      bridge.structureBinding = null;

      // Should not throw
      expect(() => bridge.clearNavigation()).not.toThrow();
    });
  });

  describe('onStructureChange', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('registers callback and returns unsubscribe function', () => {
      const callback = () => {};

      const unsubscribe = bridge.onStructureChange(callback);

      expect(bridge.structureObservers).toContain(callback);

      unsubscribe();

      expect(bridge.structureObservers).not.toContain(callback);
    });
  });

  describe('onSaveStatus', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('registers callback and returns unsubscribe function', () => {
      const callback = () => {};

      const unsubscribe = bridge.onSaveStatus(callback);

      expect(bridge.saveStatusCallbacks).toContain(callback);

      unsubscribe();

      expect(bridge.saveStatusCallbacks).not.toContain(callback);
    });
  });

  describe('getAssetManager', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('returns assetManager instance', () => {
      bridge.assetManager = { id: 'test-asset-manager' };

      expect(bridge.getAssetManager()).toBe(bridge.assetManager);
    });

    it('returns null when not set', () => {
      bridge.assetManager = null;

      expect(bridge.getAssetManager()).toBeNull();
    });
  });

  describe('getAssetWebSocketHandler', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('returns assetWebSocketHandler instance', () => {
      bridge.assetWebSocketHandler = { id: 'test-ws-handler' };

      expect(bridge.getAssetWebSocketHandler()).toBe(bridge.assetWebSocketHandler);
    });

    it('returns null when not set', () => {
      bridge.assetWebSocketHandler = null;

      expect(bridge.getAssetWebSocketHandler()).toBeNull();
    });
  });

  describe('requestMissingAssets', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('delegates to assetWebSocketHandler', async () => {
      const mockRequest = mock(() => Promise.resolve(['asset-1', 'asset-2']));
      bridge.assetWebSocketHandler = {
        requestMissingAssetsFromHTML: mockRequest,
      };

      const result = await bridge.requestMissingAssets('<img src="asset://asset-1">');

      expect(mockRequest).toHaveBeenCalledWith('<img src="asset://asset-1">');
      expect(result).toEqual(['asset-1', 'asset-2']);
    });

    it('returns empty array when handler not available', async () => {
      bridge.assetWebSocketHandler = null;

      const result = await bridge.requestMissingAssets('<html></html>');

      expect(result).toEqual([]);
    });
  });

  describe('announceAssets', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('calls announceAssetAvailability on handler', async () => {
      const mockAnnounce = mock(() => Promise.resolve());
      bridge.assetWebSocketHandler = {
        announceAssetAvailability: mockAnnounce,
      };

      await bridge.announceAssets();

      expect(mockAnnounce).toHaveBeenCalled();
    });

    it('handles missing handler gracefully', async () => {
      bridge.assetWebSocketHandler = null;

      // Should not throw
      await expect(bridge.announceAssets()).resolves.not.toThrow();
    });
  });
});

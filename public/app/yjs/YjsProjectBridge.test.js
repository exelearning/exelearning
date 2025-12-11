/**
 * YjsProjectBridge Tests
 *
 * Unit tests for YjsProjectBridge - bridges legacy projectManager with Yjs.
 *
 */

// Test functions available globally from vitest setup

/* eslint-disable no-undef */

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
  }

  async initialize(options) {
    this.initialized = true;
  }

  getNavigation() {
    return {
      observeDeep: mock(() => undefined),
      unobserveDeep: mock(() => undefined),
      toArray: mock(() => []),
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

describe('YjsProjectBridge', () => {
  let bridge;
  let mockApp;
  const originalWindow = global.window;
  const originalDocument = global.document;

  beforeEach(() => {
    // Setup global mocks
    global.window = {
      YjsDocumentManager: MockYjsDocumentManager,
      YjsStructureBinding: MockYjsStructureBinding,
      AssetCacheManager: MockAssetCacheManager,
      AssetManager: MockAssetManager,
      SaveManager: MockSaveManager,
      eXeLearning: {
        symfony: { basePath: '' },
      },
      location: {
        protocol: 'http:',
        hostname: 'localhost',
        port: '3001',
        origin: 'http://localhost:3001',
      },
    };

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
      window.eXeLearning.symfony.basePath = '/web/exelearning';
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
      window.eXeLearning.symfony.basePath = '/web/exelearning';
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
});

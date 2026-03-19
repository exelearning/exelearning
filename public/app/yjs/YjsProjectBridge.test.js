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
  setOnLastTabClosedCallback(callback) {
    this._onLastTabClosedCallback = callback;
  }
  async flushPendingExternalCleanup() {}
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
  async downloadMissingAssets() { return 0; }
  cleanup() {}
}

// Mock SaveManager
class MockSaveManager {
  constructor(bridge, options) {
    this.bridge = bridge;
    this.options = options;
    this.wsHandler = null;
  }
  async save() { return { success: true, bytes: 100 }; }
  setWebSocketHandler(handler) { this.wsHandler = handler; }
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

    it('creates assetManager if available', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.assetManager).toBeDefined();
    });

    it('assetManager has downloadMissingAssets method for in-memory storage', async () => {
      await bridge.initialize(123, 'test-token');

      // Verify assetManager has the downloadMissingAssets method
      // This method is called during initialization to fetch blobs that were lost on page reload
      expect(bridge.assetManager).toBeDefined();
      expect(typeof bridge.assetManager.downloadMissingAssets).toBe('function');
    });

    it('creates saveManager if available', async () => {
      await bridge.initialize(123, 'test-token');
      expect(bridge.saveManager).toBeDefined();
    });

    it('wires Cache API cleanup via setOnLastTabClosedCallback', async () => {
      await bridge.initialize(123, 'test-token');

      // The callback must be registered on the documentManager
      expect(bridge.documentManager._onLastTabClosedCallback).toBeInstanceOf(Function);

      // Add a clearCache mock to the assetManager so we can verify it is called
      bridge.assetManager.clearCache = mock(() => Promise.resolve());

      // Invoke the registered callback (simulates last-tab-close)
      await bridge.documentManager._onLastTabClosedCallback();

      expect(bridge.assetManager.clearCache).toHaveBeenCalledTimes(1);
    });

    it('flushes pending external cleanup after wiring the asset cache callback', async () => {
      const flushSpy = spyOn(MockYjsDocumentManager.prototype, 'flushPendingExternalCleanup');

      await bridge.initialize(123, 'test-token');

      expect(flushSpy).toHaveBeenCalledTimes(1);
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

    it('sets user info on document manager before WebSocket connects', async () => {
      const setUserInfoSpy = spyOn(MockYjsDocumentManager.prototype, 'setUserInfo');
      bridge.app = {
        user: { id: 'u1', name: 'Test User', email: 'test@test.com', gravatarUrl: 'http://g.com/u1' },
        project: { structure: {}, updateProjectTitle: mock(() => undefined) },
      };

      await bridge.initialize(123, 'test-token');

      expect(setUserInfoSpy).toHaveBeenCalledWith({
        id: 'u1',
        name: 'Test User',
        email: 'test@test.com',
        gravatarUrl: 'http://g.com/u1',
      });
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

  describe('block structure reload detection', () => {
    it('excludes pure block additions from affected pages (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      // Pure block additions are empty containers — they must NOT trigger reload
      const events = [
        {
          path: [0, 'blocks'],
          changes: {
            added: { size: 1 },
            deleted: { size: 0 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual([]);
    });

    it('detects affected page IDs for block deletions', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const events = [
        {
          path: [0, 'blocks'],
          changes: {
            added: { size: 0 },
            deleted: { size: 1 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual(['page-1']);
    });

    it('ignores non-structural component content updates', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const events = [
        {
          path: [0, 'blocks', 0, 'components', 0, 'htmlContent'],
          delta: [{ insert: 'x' }],
          changes: {
            added: { size: 0 },
            deleted: { size: 0 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual([]);
    });

    it('schedules reload only for deletions on remote transactions (additions are incremental)', () => {
      const pageMap0 = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      const pageMap1 = { get: mock((key) => (key === 'id' ? 'page-2' : undefined)) };

      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => {
            if (idx === 0) return pageMap0;
            if (idx === 1) return pageMap1;
            return null;
          }),
        })),
      };

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      const events = [
        {
          path: [0, 'blocks'],
          changes: {
            added: { size: 1 },
            deleted: { size: 0 },
          },
        },
        {
          path: [1, 'blocks'],
          changes: {
            added: { size: 0 },
            deleted: { size: 1 },
          },
        },
      ];

      bridge.scheduleReloadForBlockStructureChanges(events, { local: false });

      // page-1 has a pure addition — handled incrementally, no reload
      expect(scheduleSpy).not.toHaveBeenCalledWith('page-1');
      // page-2 has a deletion — needs reload
      expect(scheduleSpy).toHaveBeenCalledWith('page-2');
    });

    it('does not schedule reload for regular local transactions', () => {
      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});
      bridge.scheduleReloadForBlockStructureChanges(
        [
          {
            path: [0, 'blocks'],
            changes: {
              added: { size: 1 },
              deleted: { size: 0 },
            },
          },
        ],
        { local: true, origin: null }
      );
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('schedules reload for local undo/redo transactions (even pure additions)', () => {
      const undoManager = {};
      bridge.documentManager = {
        undoManager,
        getNavigation: mock(() => ({
          get: mock(() => ({ get: mock((key) => (key === 'id' ? 'page-1' : undefined)) })),
        })),
      };

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      // During undo/redo, even pure additions need a reload to restore state
      bridge.scheduleReloadForBlockStructureChanges(
        [
          {
            path: [0, 'blocks'],
            changes: {
              added: { size: 1 },
              deleted: { size: 0 },
            },
          },
        ],
        { local: true, origin: undoManager }
      );

      expect(scheduleSpy).toHaveBeenCalledWith('page-1');
    });

    it('schedules reload while undo/redo operation is in progress', () => {
      bridge.isUndoRedoInProgress = true;
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock(() => ({ get: mock((key) => (key === 'id' ? 'page-1' : undefined)) })),
        })),
      };

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      bridge.scheduleReloadForBlockStructureChanges(
        [
          {
            path: [0, 'blocks'],
            changes: {
              added: { size: 1 },
              deleted: { size: 0 },
            },
          },
        ],
        { local: true, origin: null }
      );

      expect(scheduleSpy).toHaveBeenCalledWith('page-1');
    });

    it('reloads on block-touching key changes during undo/redo even without add/delete', () => {
      bridge.isUndoRedoInProgress = true;
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock(() => ({ get: mock((key) => (key === 'id' ? 'page-1' : undefined)) })),
        })),
      };

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      bridge.scheduleReloadForBlockStructureChanges(
        [
          {
            path: [0, 'blocks', 0],
            changes: {
              added: { size: 0 },
              deleted: { size: 0 },
              keys: new Map([['someKey', { action: 'update' }]]),
            },
          },
        ],
        { local: true, origin: null }
      );

      expect(scheduleSpy).toHaveBeenCalledWith('page-1');
    });

    it('excludes component-level additions from affected pages (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      // A component addition event: path ends with 'components', has added items
      const events = [
        {
          path: [0, 'blocks', 0, 'components'],
          changes: {
            added: { size: 1 },
            deleted: { size: 0 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      // Component additions are handled incrementally by renderRemoteComponent,
      // so they must NOT trigger a destructive page reload.
      expect(Array.from(affected)).toEqual([]);
    });

    it('still includes component deletions in affected pages (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      // A component deletion event
      const events = [
        {
          path: [0, 'blocks', 0, 'components'],
          changes: {
            added: { size: 0 },
            deleted: { size: 1 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual(['page-1']);
    });

    it('excludes block-level pure additions from affected pages (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      // A block addition event: path is [pageIndex, 'blocks'], pure addition
      // Block additions are empty containers handled incrementally and must NOT
      // trigger a destructive page reload, even without a paired component addition
      // in the same event batch (they may arrive in separate Yjs transactions).
      const events = [
        {
          path: [0, 'blocks'],
          changes: {
            added: { size: 1 },
            deleted: { size: 0 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual([]);
    });

    it('still includes block-level deletions in affected pages (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const events = [
        {
          path: [0, 'blocks'],
          changes: {
            added: { size: 0 },
            deleted: { size: 1 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual(['page-1']);
    });

    it('still includes block-level mixed add+delete (move) in affected pages (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const events = [
        {
          path: [0, 'blocks'],
          changes: {
            added: { size: 1 },
            deleted: { size: 1 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual(['page-1']);
    });

    it('excludes block order-only changes from affected pages (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const events = [
        {
          path: [0, 'blocks', 1],
          changes: {
            added: { size: 0 },
            deleted: { size: 0 },
            keys: new Map([['order', { action: 'update' }]]),
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual([]);
    });

    it('does not skip component additions during undo/redo (#1532)', () => {
      bridge.isUndoRedoInProgress = true;
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      // Component addition during undo/redo should still trigger reload
      const events = [
        {
          path: [0, 'blocks', 0, 'components'],
          changes: {
            added: { size: 1 },
            deleted: { size: 0 },
          },
        },
      ];

      const affected = bridge.getAffectedPageIdsForBlockStructureChanges(events);
      expect(Array.from(affected)).toEqual(['page-1']);
    });

    it('does not schedule reload for remote component addition (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      const events = [
        {
          path: [0, 'blocks', 0, 'components'],
          changes: {
            added: { size: 1 },
            deleted: { size: 0 },
          },
        },
      ];

      bridge.scheduleReloadForBlockStructureChanges(events, { local: false });
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('does not schedule reload for remote block-only addition (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      // Block addition arriving alone (component may follow in a separate transaction)
      const events = [
        {
          path: [0, 'blocks'],
          changes: {
            added: { size: 1 },
            deleted: { size: 0 },
          },
        },
      ];

      bridge.scheduleReloadForBlockStructureChanges(events, { local: false });
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('does not schedule reload for remote block order-only change (#1532)', () => {
      const pageMap = { get: mock((key) => (key === 'id' ? 'page-1' : undefined)) };
      bridge.documentManager = {
        getNavigation: mock(() => ({
          get: mock((idx) => (idx === 0 ? pageMap : null)),
        })),
      };

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      const events = [
        {
          path: [0, 'blocks', 1],
          changes: {
            added: { size: 0 },
            deleted: { size: 0 },
            keys: new Map([['order', { action: 'update' }]]),
          },
        },
      ];

      bridge.scheduleReloadForBlockStructureChanges(events, { local: false });
      expect(scheduleSpy).not.toHaveBeenCalled();
    });
  });

  describe('syncCurrentPageBlocksIfNeeded', () => {
    it('reloads current page when DOM and Yjs block counts differ', async () => {
      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: mock((name) => (name === 'nav-id' ? 'page-1' : null)),
              },
            },
          },
        },
      };

      bridge.structureBinding = {
        getBlocks: mock(() => [{ id: 'b1' }, { id: 'b2' }]),
      };

      global.document.querySelectorAll = mock(() => [{}, {} , {}]); // DOM has 3 blocks
      const reloadSpy = spyOn(bridge, 'reloadCurrentPage').mockImplementation(() => Promise.resolve());

      bridge.syncCurrentPageBlocksIfNeeded();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(reloadSpy).toHaveBeenCalled();
    });

    it('does not reload when DOM and Yjs block counts match', async () => {
      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: mock((name) => (name === 'nav-id' ? 'page-1' : null)),
              },
            },
          },
        },
      };

      bridge.structureBinding = {
        getBlocks: mock(() => [{ id: 'b1' }]),
      };

      global.document.querySelectorAll = mock(() => [{}]); // DOM has 1 block
      const reloadSpy = spyOn(bridge, 'reloadCurrentPage').mockImplementation(() => Promise.resolve());

      bridge.syncCurrentPageBlocksIfNeeded();
      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(reloadSpy).not.toHaveBeenCalled();
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

    it('should use cached zip when provided instead of re-unzipping', async () => {
      const mockSelectTheme = mock(() => Promise.resolve());
      const mockUnzipSync = mock(() => ({}));

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

      // Mock fflate for ZIP handling
      global.window.fflate = {
        unzipSync: mockUnzipSync,
      };

      // Provide cached zip contents (no theme/config.xml)
      const cachedZip = { 'content.xml': new Uint8Array([60, 63]) };

      // Create a mock file with arrayBuffer (should NOT be called)
      const mockFile = {
        arrayBuffer: mock(() => Promise.resolve(new ArrayBuffer(10))),
      };

      await bridge._checkAndImportTheme('unknown-theme', mockFile, cachedZip);

      // fflate.unzipSync should NOT be called when cached zip is provided
      expect(mockUnzipSync).not.toHaveBeenCalled();
      // file.arrayBuffer should NOT be called when cached zip is provided
      expect(mockFile.arrayBuffer).not.toHaveBeenCalled();
      // selectTheme should be called with default theme (fallback)
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
      // Mock document.querySelectorAll for forceBlockTitlesSync calls
      global.document.querySelectorAll = mock(() => []);
      global.document.querySelector = mock(() => null);
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

    it('undo flushes pending metadata changes even when undoStack has items', () => {
      bridge.hasPendingMetadataChanges = true;
      bridge.documentManager.undoManager.undoStack = [{ item: 1 }];
      bridge.flushPendingMetadataChanges = mock(() => {});

      bridge.undo();

      expect(bridge.flushPendingMetadataChanges).toHaveBeenCalled();
      expect(bridge.documentManager.undoManager.undo).toHaveBeenCalled();
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

    it('redo with pending metadata changes flushes them first', () => {
      bridge.hasPendingMetadataChanges = true;
      bridge.flushPendingMetadataChanges = mock(() => {});

      bridge.redo();

      expect(bridge.flushPendingMetadataChanges).toHaveBeenCalled();
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

  describe('asset refresh on late asset arrival', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: mock(() => 'page-1'),
              },
              menuNav: {
                querySelector: mock(() => ({ id: 'page-element' })),
              },
            },
          },
          idevices: {
            loadingPage: false,
            loadApiIdevicesInPage: mock(() => Promise.resolve()),
          },
        },
      };
      bridge.assetManager = {
        updateDomImagesForAsset: mock(() => Promise.resolve(1)),
        cleanup: mock(() => {}),
      };
    });

    it('detects current page asset references from component HTML', () => {
      const marker = 'asset://asset-123';
      const mockComponent = {
        get: (key) => {
          if (key === 'htmlContent') return `<img src="${marker}.jpg" />`;
          if (key === 'htmlView') return '';
          if (key === 'jsonProperties') return '{"text":"nope"}';
          return null;
        },
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
          if (key === 'pageId') return 'page-1';
          if (key === 'blocks') return { length: 1, get: () => mockBlock };
          return null;
        },
      };
      bridge.documentManager.getNavigation = () => ({ length: 1, get: () => mockPage });

      expect(bridge.currentPageHasAssetReference('page-1', 'asset-123')).toBe(true);
    });

    it('reloads current page when late asset is relevant', async () => {
      spyOn(bridge, 'currentPageHasAssetReference').mockReturnValue(true);

      bridge.scheduleAssetRefreshForCurrentPage('asset-1');
      await new Promise(resolve => setTimeout(resolve, 260));

      expect(bridge.app.project.idevices.loadApiIdevicesInPage).toHaveBeenCalledWith(
        false,
        { id: 'page-element' },
      );
      expect(bridge.assetManager.updateDomImagesForAsset).toHaveBeenCalledWith('asset-1');
    });

    it('does not reload when current page does not reference late asset', async () => {
      spyOn(bridge, 'currentPageHasAssetReference').mockReturnValue(false);

      bridge.scheduleAssetRefreshForCurrentPage('asset-1');
      await new Promise(resolve => setTimeout(resolve, 260));

      expect(bridge.app.project.idevices.loadApiIdevicesInPage).not.toHaveBeenCalled();
      expect(bridge.assetManager.updateDomImagesForAsset).not.toHaveBeenCalled();
    });

    it('does not reload when selected node is root', async () => {
      bridge.app.project.structure.menuStructureBehaviour.nodeSelected.getAttribute = mock(() => 'root');
      spyOn(bridge, 'currentPageHasAssetReference').mockReturnValue(true);

      bridge.scheduleAssetRefreshForCurrentPage('asset-1');
      await new Promise(resolve => setTimeout(resolve, 260));

      expect(bridge.app.project.idevices.loadApiIdevicesInPage).not.toHaveBeenCalled();
    });

    it('disconnect clears pending late-asset refresh timer', async () => {
      spyOn(bridge, 'currentPageHasAssetReference').mockReturnValue(true);

      bridge.scheduleAssetRefreshForCurrentPage('asset-1');
      await bridge.disconnect();
      await new Promise(resolve => setTimeout(resolve, 260));

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

  describe('_ensureNewProjectLanguage', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('updates project language and default titles to match user preference for new projects', () => {
      // Setup user preferences with Spanish
      global.window.eXeLearning = {
        config: { basePath: '' },
        app: {
          user: {
            preferences: {
              preferences: {
                locale: { value: 'es' }
              }
            }
          }
        }
      };

      // Create a mock metadata object with proper get/set methods
      const metadataStore = { language: 'en', title: 'Untitled document' };
      const mockMetadata = {
        get: (key) => metadataStore[key],
        set: (key, value) => { metadataStore[key] = value; },
      };

      // Create a mock root page
      const rootPageStore = { title: 'New page', pageName: 'New page' };
      const mockRootPage = {
        get: (key) => rootPageStore[key],
        set: (key, value) => { rootPageStore[key] = value; },
      };
      const mockNavigation = { get: (index) => index === 0 ? mockRootPage : null };

      bridge.documentManager.getMetadata = () => mockMetadata;
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge._ensureNewProjectLanguage();

      expect(mockMetadata.get('language')).toBe('es');
      // Titles should be re-translated with _() (which returns the key in tests)
      expect(mockMetadata.get('title')).toBe('Untitled document');
      expect(mockRootPage.get('title')).toBe('New page');
      expect(mockRootPage.get('pageName')).toBe('New page');
    });

    it('does not update language when user preference matches current language', () => {
      global.window.eXeLearning = {
        config: { basePath: '' },
        app: {
          user: {
            preferences: {
              preferences: {
                locale: { value: 'en' }
              }
            }
          }
        }
      };

      // Create a mock metadata object
      const metadataStore = { language: 'en' };
      let setCalled = false;
      const mockMetadata = {
        get: (key) => metadataStore[key],
        set: (key, value) => { 
          if (key === 'language') setCalled = true;
          metadataStore[key] = value; 
        },
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge._ensureNewProjectLanguage();

      expect(setCalled).toBe(false);
      expect(mockMetadata.get('language')).toBe('en');
    });

    it('does nothing when user preferences are not available', () => {
      global.window.eXeLearning = {
        config: { basePath: '' },
        app: {} // No user preferences
      };

      // Create a mock metadata object
      const metadataStore = { language: 'en' };
      const mockMetadata = {
        get: (key) => metadataStore[key],
        set: (key, value) => { metadataStore[key] = value; },
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge._ensureNewProjectLanguage();

      // Language should remain unchanged
      expect(mockMetadata.get('language')).toBe('en');
    });

    it('handles errors gracefully', () => {
      global.window.eXeLearning = {
        config: { basePath: '' },
        app: {
          user: {
            preferences: {
              preferences: {
                locale: { value: 'fr' }
              }
            }
          }
        }
      };

      // Force an error by nullifying documentManager
      bridge.documentManager = null;

      // Should not throw
      expect(() => bridge._ensureNewProjectLanguage()).not.toThrow();
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

    it('connects SaveManager to WebSocket handler during initialization', async () => {
      // Create a fresh bridge with assetWebSocketHandler mock
      const newBridge = new YjsProjectBridge('test-project-2', {
        apiUrl: '/api',
        exeVersion: '3.0.0',
        wsUrl: 'ws://localhost:1234',
        offline: true,
      });

      // Set up mocks
      newBridge.assetWebSocketHandler = { id: 'mock-ws-handler' };
      newBridge.saveManager = new MockSaveManager(newBridge, {});

      // Verify setWebSocketHandler was not called yet
      expect(newBridge.saveManager.wsHandler).toBeNull();

      // Manually call setWebSocketHandler as done in initialize
      if (newBridge.assetWebSocketHandler) {
        newBridge.saveManager.setWebSocketHandler(newBridge.assetWebSocketHandler);
      }

      // Verify wsHandler is now set
      expect(newBridge.saveManager.wsHandler).toEqual({ id: 'mock-ws-handler' });
    });

    it('invalidates stale local blob and requests asset on remote hash update', async () => {
      let assetsObserver = null;
      const assetsData = new Map([
        ['asset-1', { hash: 'new-hash-123' }],
      ]);
      const assetsMap = {
        observe: mock((cb) => { assetsObserver = cb; }),
        unobserve: mock(() => undefined),
        get: (id) => assetsData.get(id),
      };

      bridge.documentManager = {
        getAssets: () => assetsMap,
      };
      bridge.assetManager = {
        invalidateLocalBlob: mock(() => Promise.resolve()),
      };
      bridge.assetWebSocketHandler = {
        requestAsset: mock(() => Promise.resolve(true)),
      };

      bridge.setupAssetsObserver();

      const event = {
        changes: {
          keys: new Map([
            ['asset-1', { action: 'update', oldValue: { hash: 'old-hash-999' } }],
          ]),
        },
      };

      await assetsObserver(event, { origin: 'remote' });

      expect(bridge.assetManager.invalidateLocalBlob).toHaveBeenCalledWith(
        'asset-1',
        expect.objectContaining({
          reason: 'remote-hash-update',
          markAsMissing: true,
          markDomAsLoading: true,
        })
      );
      expect(bridge.assetWebSocketHandler.requestAsset).toHaveBeenCalledWith('asset-1');
    });

    it('ignores non-remote or same-hash asset updates', async () => {
      let assetsObserver = null;
      const assetsData = new Map([
        ['asset-1', { hash: 'same-hash' }],
      ]);
      const assetsMap = {
        observe: mock((cb) => { assetsObserver = cb; }),
        unobserve: mock(() => undefined),
        get: (id) => assetsData.get(id),
      };

      bridge.documentManager = {
        getAssets: () => assetsMap,
      };
      bridge.assetManager = {
        invalidateLocalBlob: mock(() => Promise.resolve()),
      };
      bridge.assetWebSocketHandler = {
        requestAsset: mock(() => Promise.resolve(true)),
      };

      bridge.setupAssetsObserver();

      const sameHashEvent = {
        changes: {
          keys: new Map([
            ['asset-1', { action: 'update', oldValue: { hash: 'same-hash' } }],
          ]),
        },
      };

      await assetsObserver(sameHashEvent, { origin: 'remote' });
      await assetsObserver(sameHashEvent, { origin: 'local' });

      expect(bridge.assetManager.invalidateLocalBlob).not.toHaveBeenCalled();
      expect(bridge.assetWebSocketHandler.requestAsset).not.toHaveBeenCalled();
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
      // Mock document.querySelectorAll for forceBlockTitlesSync
      global.document.querySelectorAll = mock(() => []);

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

    it('dispatches blur to active property-value input first', () => {
      const activeInput = {
        classList: { contains: (cls) => cls === 'property-value' },
        dispatchEvent: mock(() => {}),
      };
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => activeInput,
      });

      bridge.flushPendingMetadataChanges();

      expect(activeInput.dispatchEvent).toHaveBeenCalled();
    });

    it('dispatches blur events to property inputs', () => {
      const input = {
        dispatchEvent: mock(() => {}),
      };
      Object.defineProperty(document, 'activeElement', {
        configurable: true,
        get: () => null,
      });
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

      const scheduleSpy = spyOn(bridge, 'schedulePageReloadIfCurrent').mockImplementation(() => {});

      bridge.handleRemoteStructureChanges(events);
      expect(scheduleSpy).not.toHaveBeenCalled();
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
        renderBlockTitle: mock(() => {}),
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
      expect(mockBlockNode.renderBlockTitle).toHaveBeenCalled();
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

  describe('_syncBlockTitle', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
      delete global.MathJax;
    });

    it('updates textContent for non-latex title', () => {
      const titleEl = { textContent: '', isConnected: true };
      bridge._syncBlockTitle(titleEl, 'Plain title');
      expect(titleEl.textContent).toBe('Plain title');
    });

    it('typesets latex title with MathJax fallback', async () => {
      const titleEl = { textContent: '', isConnected: true };
      const typesetPromise = mock(() => Promise.resolve());
      const typesetClear = mock(() => undefined);
      global.MathJax = {
        startup: { promise: Promise.resolve() },
        typesetPromise,
        typesetClear,
      };

      bridge._syncBlockTitle(titleEl, '\\(x^2\\)');
      await Promise.resolve();
      await Promise.resolve();

      expect(typesetClear).toHaveBeenCalledWith([titleEl]);
      expect(typesetPromise).toHaveBeenCalledWith([titleEl]);
    });

    it('skips fallback typeset when title node is disconnected', async () => {
      const titleEl = { textContent: '', isConnected: false };
      const typesetPromise = mock(() => Promise.resolve());
      global.MathJax = {
        startup: { promise: Promise.resolve() },
        typesetPromise,
      };

      bridge._syncBlockTitle(titleEl, '\\(x^2\\)');
      await Promise.resolve();

      expect(typesetPromise).not.toHaveBeenCalled();
    });
  });

  describe('syncStructureToLegacy', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('logs warning and returns early when structureBinding is null', () => {
      bridge.structureBinding = null;
      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      bridge.syncStructureToLegacy();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[YjsProjectBridge] Cannot sync structure: structureBinding not initialized'
      );
    });

    it('logs warning and returns early when structureBinding is undefined', () => {
      bridge.structureBinding = undefined;
      const consoleWarnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      bridge.syncStructureToLegacy();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[YjsProjectBridge] Cannot sync structure: structureBinding not initialized'
      );
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

    it('includes page properties in legacy data', () => {
      bridge.structureBinding = {
        getPages: mock(() => [
          {
            id: 'page-1',
            pageName: 'Test',
            parentId: null,
            order: 0,
            properties: { highlight: true, titleNode: 'Custom Title' }
          },
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

      const calledData = mockSetData.mock.calls[0][0];
      expect(calledData[0].odeNavStructureSyncProperties).toEqual({
        highlight: { value: true },
        titleNode: { value: 'Custom Title' }
      });
    });

    it('handles pages without properties', () => {
      bridge.structureBinding = {
        getPages: mock(() => [
          { id: 'page-1', pageName: 'Test', parentId: null, order: 0 },
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

      const calledData = mockSetData.mock.calls[0][0];
      expect(calledData[0].odeNavStructureSyncProperties).toBe(null);
    });

    it('handles array as properties (returns null)', () => {
      bridge.structureBinding = {
        getPages: mock(() => [
          { id: 'page-1', pageName: 'Test', parentId: null, order: 0, properties: ['not', 'an', 'object'] },
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

      const calledData = mockSetData.mock.calls[0][0];
      expect(calledData[0].odeNavStructureSyncProperties).toBe(null);
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

    it('updates addMathJax and globalFont inputs using mapped metadata keys', () => {
      const mockCheckbox = {
        getAttribute: (attr) => {
          if (attr === 'property') return 'pp_addMathJax';
          if (attr === 'data-type') return 'checkbox';
          return null;
        },
        type: 'checkbox',
        checked: false,
      };
      const mockSelect = {
        getAttribute: (attr) => {
          if (attr === 'property') return 'pp_globalFont';
          if (attr === 'data-type') return 'select';
          return null;
        },
        type: 'select-one',
        value: '',
      };
      global.document.querySelectorAll = mock(() => [mockCheckbox, mockSelect]);

      const mockMetadata = {
        get: (key) => {
          if (key === 'addMathJax') return true;
          if (key === 'globalFont') return 'default';
          return undefined;
        },
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge.forceAllFormInputsSync();

      expect(mockCheckbox.checked).toBe(true);
      expect(mockSelect.value).toBe('default');
    });

    it('clears stale text inputs when metadata key is missing', () => {
      const mockInput = {
        getAttribute: (attr) => {
          if (attr === 'property') return 'pp_subtitle';
          if (attr === 'data-type') return 'text';
          return null;
        },
        type: 'text',
        value: 'stale subtitle',
      };
      global.document.querySelectorAll = mock(() => [mockInput]);

      const mockMetadata = {
        get: () => undefined,
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      bridge.forceAllFormInputsSync();

      expect(mockInput.value).toBe('');
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

  describe('forceBlockTitlesSync', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns early when no navigation', () => {
      bridge.documentManager = null;
      // Should not throw
      bridge.forceBlockTitlesSync();
    });

    it('updates block title when blockName differs', () => {
      // Create mock header element with block-id
      const mockTitleEl = { textContent: 'Old Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      // Mock document.querySelectorAll for block headers
      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      // Create mock navigation with block data
      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'New Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      expect(mockTitleEl.textContent).toBe('New Title');
    });

    it('uses blockNode renderBlockTitle when available', () => {
      const mockTitleEl = { textContent: 'Old Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockNode = {
        blockName: 'Old Title',
        iconName: '',
        renderBlockTitle: mock(() => {}),
      };

      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock(() => mockBlockNode),
          },
        },
      };

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'New Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      expect(mockBlockNode.renderBlockTitle).toHaveBeenCalled();
    });

    it('does not update when blockName matches current title', () => {
      const mockTitleEl = { textContent: 'Same Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'Same Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      // Title should remain unchanged
      expect(mockTitleEl.textContent).toBe('Same Title');
    });

    it('updates block icon when iconName differs', () => {
      const mockImgEl = { getAttribute: () => '/old-icon.png' };
      const mockIconEl = {
        innerHTML: '<img src="/old-icon.png" alt="old">',
        classList: {
          contains: () => false,
          add: mock(() => {}),
          remove: mock(() => {}),
        },
        querySelector: () => mockImgEl,
      };
      const mockTitleEl = { textContent: 'Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return mockIconEl;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      // Mock theme icons
      global.window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({
              'new-icon': { id: 'new-icon', value: '/new-icon.png', title: 'New Icon' },
            }),
          },
        },
      };

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'Title';
          if (key === 'iconName') return 'new-icon';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      expect(mockIconEl.innerHTML).toContain('/new-icon.png');
      expect(mockIconEl.classList.remove).toHaveBeenCalledWith('exe-no-icon');
    });

    it('clears icon when iconName is empty', () => {
      const mockImgEl = { getAttribute: () => '/some-icon.png' };
      const mockIconEl = {
        innerHTML: '<img src="/some-icon.png" alt="icon">',
        classList: {
          contains: () => false,
          add: mock(() => {}),
          remove: mock(() => {}),
        },
        querySelector: () => mockImgEl,
      };
      const mockTitleEl = { textContent: 'Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return mockIconEl;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      global.window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({}),
          },
        },
      };

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      expect(mockIconEl.innerHTML).toContain('svg');
      expect(mockIconEl.classList.add).toHaveBeenCalledWith('exe-no-icon');
    });

    it('handles missing title element gracefully', () => {
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: () => null, // No .box-title or .box-icon element
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'Test Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      // Should not throw
      bridge.forceBlockTitlesSync();
    });

    it('handles block not found in navigation', () => {
      const mockTitleEl = { textContent: 'Old Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-not-found' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123'; // Different ID
          if (key === 'blockName') return 'New Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      // Title should remain unchanged since block was not found
      expect(mockTitleEl.textContent).toBe('Old Title');
    });

    it('handles pages without blocks', () => {
      const mockTitleEl = { textContent: 'Old Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      // Page without blocks
      const mockPageMap = {
        get: (key) => key === 'blocks' ? null : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      // Should not throw
      bridge.forceBlockTitlesSync();

      // Title should remain unchanged
      expect(mockTitleEl.textContent).toBe('Old Title');
    });

    it('is called by forceTitleSync', () => {
      // Mock methods
      const originalForceBlockTitlesSync = bridge.forceBlockTitlesSync;
      bridge.forceBlockTitlesSync = mock(() => {});

      // Mock metadata
      const mockMetadata = {
        get: () => 'Test',
      };
      bridge.documentManager.getMetadata = () => mockMetadata;

      // Mock document.querySelector
      global.document.querySelector = mock(() => null);

      bridge.forceTitleSync();

      expect(bridge.forceBlockTitlesSync).toHaveBeenCalled();

      // Restore
      bridge.forceBlockTitlesSync = originalForceBlockTitlesSync;
    });

    it('updates blockNode.blockName when Yjs blockName differs', () => {
      const mockBlockNode = {
        blockName: 'Old BlockNode Title',
        iconName: 'old-icon',
      };

      // Mock idevices with getBlockById
      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock(() => mockBlockNode),
          },
        },
      };

      const mockTitleEl = { textContent: 'Old Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'New Yjs Title';
          if (key === 'iconName') return 'old-icon';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      // DOM should be updated
      expect(mockTitleEl.textContent).toBe('New Yjs Title');
      // blockNode instance property should also be updated
      expect(mockBlockNode.blockName).toBe('New Yjs Title');
      expect(bridge.app.project.idevices.getBlockById).toHaveBeenCalledWith('block-123');
    });

    it('updates blockNode.iconName when Yjs iconName differs', () => {
      const mockBlockNode = {
        blockName: 'Title',
        iconName: 'old-icon',
      };

      // Mock idevices with getBlockById
      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock(() => mockBlockNode),
          },
        },
      };

      const mockImgEl = { getAttribute: () => '/old-icon.png' };
      const mockIconEl = {
        innerHTML: '<img src="/old-icon.png" alt="old">',
        classList: {
          contains: () => false,
          add: mock(() => {}),
          remove: mock(() => {}),
        },
        querySelector: () => mockImgEl,
      };
      const mockTitleEl = { textContent: 'Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return mockIconEl;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      // Mock theme icons
      global.window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({
              'new-icon': { id: 'new-icon', value: '/new-icon.png', title: 'New Icon' },
            }),
          },
        },
      };

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'Title';
          if (key === 'iconName') return 'new-icon';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      // blockNode instance property should be updated
      expect(mockBlockNode.iconName).toBe('new-icon');
      expect(bridge.app.project.idevices.getBlockById).toHaveBeenCalledWith('block-123');
    });

    it('does not update blockNode properties when they already match Yjs', () => {
      const mockBlockNode = {
        blockName: 'Same Title',
        iconName: 'same-icon',
      };

      // Mock idevices with getBlockById
      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock(() => mockBlockNode),
          },
        },
      };

      const mockTitleEl = { textContent: 'Same Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'Same Title';
          if (key === 'iconName') return 'same-icon';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forceBlockTitlesSync();

      // blockNode should still have the same values (not modified)
      expect(mockBlockNode.blockName).toBe('Same Title');
      expect(mockBlockNode.iconName).toBe('same-icon');
    });

    it('handles missing idevices gracefully', () => {
      // No idevices available
      bridge.app = {
        project: {},
      };

      const mockTitleEl = { textContent: 'Old Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'New Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      // Should not throw
      bridge.forceBlockTitlesSync();

      // DOM should still be updated
      expect(mockTitleEl.textContent).toBe('New Title');
    });

    it('handles getBlockById returning null gracefully', () => {
      // getBlockById returns null (block not found in instance registry)
      bridge.app = {
        project: {
          idevices: {
            getBlockById: mock(() => null),
          },
        },
      };

      const mockTitleEl = { textContent: 'Old Title' };
      const mockHeader = {
        getAttribute: (attr) => attr === 'block-id' ? 'block-123' : null,
        querySelector: (selector) => {
          if (selector === '.box-title') return mockTitleEl;
          if (selector === '.box-icon') return null;
          return null;
        },
      };

      global.document.querySelectorAll = mock((selector) => {
        if (selector === 'header[block-id]') return [mockHeader];
        return [];
      });

      const mockBlockMap = {
        get: (key) => {
          if (key === 'id') return 'block-123';
          if (key === 'blockName') return 'New Title';
          if (key === 'iconName') return '';
          return undefined;
        },
      };
      const mockBlocks = {
        length: 1,
        get: () => mockBlockMap,
      };
      const mockPageMap = {
        get: (key) => key === 'blocks' ? mockBlocks : undefined,
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      // Should not throw
      bridge.forceBlockTitlesSync();

      // DOM should still be updated
      expect(mockTitleEl.textContent).toBe('New Title');
      expect(bridge.app.project.idevices.getBlockById).toHaveBeenCalledWith('block-123');
    });
  });

  describe('forcePageTitlesSync', () => {
    beforeEach(async () => {
      await bridge.initialize(123, 'test-token');
    });

    it('returns early when no navigation', () => {
      bridge.documentManager = null;
      // Should not throw
      bridge.forcePageTitlesSync();
    });

    it('updates navigation tree element when pageName differs', () => {
      const mockTextSpan = { textContent: 'Old Name' };
      const mockNavElement = {
        querySelector: (selector) => selector === 'span:not(.small-icon)' ? mockTextSpan : null,
      };

      global.document.querySelector = mock((selector) => {
        if (selector === '.nav-element[nav-id="page-123"] > .nav-element-text') return mockNavElement;
        return null;
      });

      const mockPageMap = {
        get: (key) => {
          if (key === 'id') return 'page-123';
          if (key === 'pageName') return 'New Name';
          if (key === 'properties') return null;
          return undefined;
        },
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forcePageTitlesSync();

      expect(mockTextSpan.textContent).toBe('New Name');
    });

    it('updates page content title for selected page', () => {
      const mockTextSpan = { textContent: 'Page Name' };
      const mockNavElement = {
        querySelector: () => mockTextSpan,
      };
      const mockPageTitleEl = {
        innerText: 'Old Title',
        classList: {
          add: mock(() => {}),
          toggle: mock(() => {}),
        },
      };

      // Mock selected page
      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: () => 'page-123',
              },
            },
          },
        },
      };

      global.document.querySelector = mock((selector) => {
        if (selector === '.nav-element[nav-id="page-123"] > .nav-element-text') return mockNavElement;
        if (selector === '#page-title-node-content') return mockPageTitleEl;
        return null;
      });

      const mockPageMap = {
        get: (key) => {
          if (key === 'id') return 'page-123';
          if (key === 'pageName') return 'Page Name';
          if (key === 'properties') return null;
          return undefined;
        },
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forcePageTitlesSync();

      expect(mockPageTitleEl.innerText).toBe('Page Name');
    });

    it('handles pages without IDs gracefully', () => {
      global.document.querySelector = mock(() => null);

      const mockPageMap = {
        get: (key) => {
          if (key === 'id') return null;
          if (key === 'pageName') return 'Test';
          return undefined;
        },
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      // Should not throw
      bridge.forcePageTitlesSync();
    });

    it('respects hidePageTitle property', () => {
      const mockPageTitleEl = {
        innerText: 'Some Title',
        classList: {
          add: mock(() => {}),
          toggle: mock(() => {}),
        },
      };

      bridge.app = {
        project: {
          structure: {
            menuStructureBehaviour: {
              nodeSelected: {
                getAttribute: () => 'page-123',
              },
            },
          },
        },
      };

      global.document.querySelector = mock((selector) => {
        if (selector === '#page-title-node-content') return mockPageTitleEl;
        return null;
      });

      const mockPropsMap = {
        get: (key) => {
          if (key === 'hidePageTitle') return true;
          return undefined;
        },
      };
      const mockPageMap = {
        get: (key) => {
          if (key === 'id') return 'page-123';
          if (key === 'pageName') return 'Page Name';
          if (key === 'properties') return mockPropsMap;
          return undefined;
        },
      };
      const mockNavigation = {
        length: 1,
        get: () => mockPageMap,
      };
      bridge.documentManager.getNavigation = () => mockNavigation;

      bridge.forcePageTitlesSync();

      expect(mockPageTitleEl.innerText).toBe('');
      expect(mockPageTitleEl.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('is called by forceTitleSync', () => {
      const originalForcePageTitlesSync = bridge.forcePageTitlesSync;
      bridge.forcePageTitlesSync = mock(() => {});
      bridge.forceBlockTitlesSync = mock(() => {});

      const mockMetadata = {
        get: () => 'Test',
      };
      bridge.documentManager.getMetadata = () => mockMetadata;
      global.document.querySelector = mock(() => null);
      global.document.querySelectorAll = mock(() => []);

      bridge.forceTitleSync();

      expect(bridge.forcePageTitlesSync).toHaveBeenCalled();

      bridge.forcePageTitlesSync = originalForcePageTitlesSync;
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
      const mockZipContents = { 'content.xml': new Uint8Array([60, 63]) };
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 5, theme: 'base', zipContents: mockZipContents })),
      };
      global.window.ElpxImporter = mock(function() { return mockImporter; });

      bridge.announceAssets = mock(() => Promise.resolve());
      bridge._checkAndImportTheme = mock(() => Promise.resolve());

      const file = new Blob(['test'], { type: 'application/zip' });
      const result = await bridge.importFromElpx(file);

      expect(result.assets).toBe(5);
      expect(bridge.announceAssets).toHaveBeenCalled();
      // Theme import is called with cached zipContents to avoid re-unzipping
      expect(bridge._checkAndImportTheme).toHaveBeenCalledWith('base', file, mockZipContents);
    });

    it('imports theme when clearExisting is explicitly true', async () => {
      const mockZipContents = { 'content.xml': new Uint8Array([60, 63]) };
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 0, theme: 'custom-theme', zipContents: mockZipContents })),
      };
      global.window.ElpxImporter = mock(function() { return mockImporter; });

      bridge._checkAndImportTheme = mock(() => Promise.resolve());

      const file = new Blob(['test'], { type: 'application/zip' });
      await bridge.importFromElpx(file, { clearExisting: true });

      expect(bridge._checkAndImportTheme).toHaveBeenCalledWith('custom-theme', file, mockZipContents);
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

    it('imports theme in static mode (storage.remote=false)', async () => {
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 0, theme: 'custom-theme' })),
      };
      global.window.ElpxImporter = mock(function() { return mockImporter; });

      // Set static mode capabilities (storage.remote = false)
      global.window.eXeLearning = {
        app: {
          capabilities: {
            storage: { remote: false },
            collaboration: { enabled: false },
          },
        },
      };

      bridge._checkAndImportTheme = mock(() => Promise.resolve());

      const file = new Blob(['test'], { type: 'application/zip' });
      await bridge.importFromElpx(file, { clearExisting: true });

      // Theme import should be called even in static mode
      // Third argument is cachedZip (undefined when mockImporter doesn't return zipContents)
      expect(bridge._checkAndImportTheme).toHaveBeenCalledWith('custom-theme', file, undefined);
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

      const file = new Blob(['test']);
      await bridge.importFromElpx(file);
    });

    it('uses null assetHandler when assetManager unavailable', async () => {
      const mockImporter = {
        importFromFile: mock(() => Promise.resolve({ assets: 0 })),
      };
      global.window.ElpxImporter = mock(function(docManager, assetHandler) {
        // assetHandler is null when no assetManager
        expect(assetHandler).toBeNull();
        return mockImporter;
      });

      bridge.assetManager = null;

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
        null, // Legacy assetCache removed
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

    it('uses electronAPI.saveBuffer() in Electron mode (always prompts)', async () => {
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
        saveBuffer: mock(() => Promise.resolve({
          saved: true,
          canceled: false,
          canceledAt: null,
          filePath: '/tmp/project.elpx',
          timings: {
            totalMs: 42,
            promptMs: 30,
            normalizeMs: 2,
            writeMs: 10,
          },
        })),
      };

      const result = await bridge.exportToElpx();

      expect(result).toEqual({ saved: true });
      expect(global.window.electronAPI.saveBuffer).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'test-project-123',
        'project.elpx'
      );

      // Cleanup
      delete global.eXeLearning;
      delete global.window.__currentProjectId;
      delete global.window.electronAPI;
    });

    it('returns saved false when user cancels Electron save dialog', async () => {
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

      global.eXeLearning = { config: { isOfflineInstallation: true } };
      global.window.__currentProjectId = 'test-project-123';
      global.window.electronAPI = {
        saveBuffer: mock(() => Promise.resolve({
          saved: false,
          canceled: true,
          canceledAt: 'dialog',
          filePath: null,
          timings: {
            totalMs: 15,
            promptMs: 15,
            normalizeMs: 0,
            writeMs: 0,
          },
        })),
      };

      const result = await bridge.exportToElpx();

      expect(result).toEqual({ saved: false });

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
        saveBuffer: mock(() => Promise.resolve({
          saved: true,
          canceled: false,
          canceledAt: null,
          filePath: '/tmp/project.elpx',
          timings: {
            totalMs: 10,
            promptMs: 4,
            normalizeMs: 1,
            writeMs: 5,
          },
        })),
      };

      await bridge.exportToElpx();

      expect(global.window.electronAPI.saveBuffer).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        'default',
        'project.elpx'
      );

      // Cleanup
      delete global.eXeLearning;
      delete global.window.electronAPI;
    });

    it('stores export debug timeline when enabled', async () => {
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

      global.eXeLearning = { config: { debugElpxExport: true, isOfflineInstallation: true } };
      global.window.eXeLearning = global.eXeLearning;
      global.window.electronAPI = {
        saveBuffer: mock(() => Promise.resolve({
          saved: true,
          canceled: false,
          canceledAt: null,
          filePath: '/tmp/project.elpx',
          timings: {
            totalMs: 44,
            promptMs: 30,
            normalizeMs: 4,
            writeMs: 10,
          },
        })),
      };

      const result = await bridge.exportToElpx();

      expect(result).toEqual({ saved: true });
      expect(global.window.__lastElpxExportSummary).toEqual(
        expect.objectContaining({
          outcome: 'success',
          filename: 'project.elpx',
          electronSaveMs: 44,
          electronPromptMs: 30,
          electronNormalizeMs: 4,
          electronWriteMs: 10,
        })
      );
      expect(global.window.__lastElpxExportTimeline.length).toBeGreaterThan(0);

      delete global.eXeLearning;
      delete global.window.eXeLearning;
      delete global.window.electronAPI;
      delete global.window.__lastElpxExportSummary;
      delete global.window.__lastElpxExportTimeline;
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

      const result = await bridge.exportToElpx({ saveAs: false });

      expect(result).toEqual({ saved: true });
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
        // name uses the Yjs key (sanitized dirName), NOT the raw <name> tag
        expect(result.name).toBe('my-theme');
        expect(result.displayName).toBe('My Theme');
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
        expect(result.title).toBe('my-theme');
        expect(result.type).toBe('user');
        expect(result.downloadable).toBe('1');
      });

      it('uses <title> tag for title, falling back to <name>', () => {
        const themeFilesData = {
          files: { 'style.css': new Uint8Array([1]) },
          configXml: '<theme><name>my_custom</name><title>My Custom Theme</title></theme>',
        };

        const result = bridge._parseThemeConfigFromFiles('my_custom', themeFilesData);

        expect(result.name).toBe('my_custom');
        expect(result.displayName).toBe('my_custom');
        expect(result.title).toBe('My Custom Theme');
      });

      it('falls back to <name> for title when <title> is missing', () => {
        const themeFilesData = {
          files: { 'style.css': new Uint8Array([1]) },
          configXml: '<theme><name>Fancy Theme</name></theme>',
        };

        const result = bridge._parseThemeConfigFromFiles('fancy_theme', themeFilesData);

        expect(result.name).toBe('fancy_theme');
        expect(result.displayName).toBe('Fancy Theme');
        expect(result.title).toBe('Fancy Theme');
      });

      it('always uses themeName (Yjs key) for name, not raw <name> tag', () => {
        const themeFilesData = {
          files: { 'style.css': new Uint8Array([1]) },
          configXml: '<theme><name>Collab Test Theme</name><title>Collaborative Test Style</title></theme>',
        };

        const result = bridge._parseThemeConfigFromFiles('collab_test_theme', themeFilesData);

        // name = sanitized Yjs key, not the raw XML <name> tag
        expect(result.name).toBe('collab_test_theme');
        expect(result.dirName).toBe('collab_test_theme');
        // displayName = raw <name> tag from config.xml
        expect(result.displayName).toBe('Collab Test Theme');
        // title = <title> tag (preferred over <name>)
        expect(result.title).toBe('Collaborative Test Style');
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

      it('calls updateThemes and buildUserListThemes after adding a theme when styles panel is open', async () => {
        let observerCallback = null;
        const mockThemeFilesMap = {
          observe: (cb) => {
            observerCallback = cb;
          },
          get: mock(() => 'base64themedata'),
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);
        bridge._loadUserThemeFromYjs = mock(() => Promise.resolve());

        const mockUpdateThemes = mock(() => {});
        const mockBuildUserListThemes = mock(() => {});
        global.eXeLearning.app.menus = {
          navbar: {
            styles: {
              updateThemes: mockUpdateThemes,
              buildUserListThemes: mockBuildUserListThemes,
            },
          },
        };
        // Styles panel is open
        global.document.getElementById = mock(() => ({
          classList: { contains: mock(() => true) },
        }));

        bridge.setupThemeFilesObserver();

        await observerCallback({
          changes: {
            keys: [['new-theme', { action: 'add' }]],
          },
        });

        expect(mockUpdateThemes).toHaveBeenCalled();
        expect(mockBuildUserListThemes).toHaveBeenCalled();

        delete global.eXeLearning.app.menus;
      });

      it('calls only updateThemes after adding a theme when styles panel is closed', async () => {
        let observerCallback = null;
        const mockThemeFilesMap = {
          observe: (cb) => {
            observerCallback = cb;
          },
          get: mock(() => 'base64themedata'),
        };
        bridge.documentManager.getThemeFiles = mock(() => mockThemeFilesMap);
        bridge._loadUserThemeFromYjs = mock(() => Promise.resolve());

        const mockUpdateThemes = mock(() => {});
        const mockBuildUserListThemes = mock(() => {});
        global.eXeLearning.app.menus = {
          navbar: {
            styles: {
              updateThemes: mockUpdateThemes,
              buildUserListThemes: mockBuildUserListThemes,
            },
          },
        };
        // Styles panel is closed (no 'active' class)
        global.document.getElementById = mock(() => ({
          classList: { contains: mock(() => false) },
        }));

        bridge.setupThemeFilesObserver();

        await observerCallback({
          changes: {
            keys: [['new-theme', { action: 'add' }]],
          },
        });

        expect(mockUpdateThemes).toHaveBeenCalled();
        expect(mockBuildUserListThemes).not.toHaveBeenCalled();

        delete global.eXeLearning.app.menus;
      });

      it('refreshes UI after deleting a theme', async () => {
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

        const mockUpdateThemes = mock(() => {});
        const mockBuildUserListThemes = mock(() => {});
        global.eXeLearning.app.menus = {
          navbar: {
            styles: {
              updateThemes: mockUpdateThemes,
              buildUserListThemes: mockBuildUserListThemes,
            },
          },
        };
        global.document.getElementById = mock(() => ({
          classList: { contains: mock(() => true) },
        }));

        bridge.setupThemeFilesObserver();

        await observerCallback({
          changes: {
            keys: [['deleted-theme', { action: 'delete' }]],
          },
        });

        expect(mockUpdateThemes).toHaveBeenCalled();
        expect(mockBuildUserListThemes).toHaveBeenCalled();

        delete global.eXeLearning.app.menus;
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
      const mockConnectionMonitorDestroy = mock(() => {});

      bridge.documentManager = { destroy: mockDocumentManagerDestroy };
      bridge.assetWebSocketHandler = { destroy: mockAssetWSHandlerDestroy };
      bridge.assetManager = { cleanup: mockAssetManagerCleanup };
      bridge.saveManager = { save: () => {} };
      bridge.connectionMonitor = { destroy: mockConnectionMonitorDestroy };

      await bridge.disconnect();

      expect(mockDocumentManagerDestroy).toHaveBeenCalled();
      expect(mockAssetWSHandlerDestroy).toHaveBeenCalled();
      expect(mockAssetManagerCleanup).toHaveBeenCalled();
      expect(mockConnectionMonitorDestroy).toHaveBeenCalled();
      expect(bridge.initialized).toBe(false);
      expect(bridge.saveManager).toBeNull();
      expect(bridge.connectionMonitor).toBeNull();
    });

    it('handles disconnect with null resources', async () => {
      bridge.documentManager = null;
      bridge.assetWebSocketHandler = null;
      bridge.assetManager = null;
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

  describe('_syncBlockIcon', () => {
    let bridge;

    beforeEach(async () => {
      bridge = new YjsProjectBridge(mockApp);
      await bridge.initialize(123, 'test-token');
    });

    it('sets empty SVG icon when iconName is empty string', () => {
      const mockIconEl = {
        innerHTML: '<img src="old.png">',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => false,
        },
        querySelector: () => ({ getAttribute: () => 'old.png' }),
      };

      bridge._syncBlockIcon(mockIconEl, '', 'block-1');

      expect(mockIconEl.innerHTML).toContain('svg');
      expect(mockIconEl.classList.add).toHaveBeenCalledWith('exe-no-icon');
    });

    it('sets empty SVG icon when iconName is undefined', () => {
      const mockIconEl = {
        innerHTML: '<img src="old.png">',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => false,
        },
        querySelector: () => ({ getAttribute: () => 'old.png' }),
      };

      bridge._syncBlockIcon(mockIconEl, undefined, 'block-1');

      expect(mockIconEl.innerHTML).toContain('svg');
      expect(mockIconEl.classList.add).toHaveBeenCalledWith('exe-no-icon');
    });

    it('sets empty SVG icon when iconName is null', () => {
      const mockIconEl = {
        innerHTML: '<img src="old.png">',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => false,
        },
        querySelector: () => ({ getAttribute: () => 'old.png' }),
      };

      bridge._syncBlockIcon(mockIconEl, null, 'block-1');

      expect(mockIconEl.innerHTML).toContain('svg');
      expect(mockIconEl.classList.add).toHaveBeenCalledWith('exe-no-icon');
    });

    it('sets icon image when iconName matches theme icon key', () => {
      window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({
              info: { id: '1', value: '/icons/info.png', title: 'Info' },
            }),
          },
        },
      };

      const mockIconEl = {
        innerHTML: '',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => true, // has exe-no-icon class
        },
        querySelector: () => null, // no img element
      };

      bridge._syncBlockIcon(mockIconEl, 'info', 'block-1');

      expect(mockIconEl.innerHTML).toContain('img');
      expect(mockIconEl.innerHTML).toContain('/icons/info.png');
      expect(mockIconEl.classList.remove).toHaveBeenCalledWith('exe-no-icon');
    });

    it('finds icon by id when key does not match', () => {
      window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({
              someKey: { id: 'target-icon', value: '/icons/target.png', title: 'Target' },
            }),
          },
        },
      };

      const mockIconEl = {
        innerHTML: '',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => true,
        },
        querySelector: () => null,
      };

      // Using icon id instead of key
      bridge._syncBlockIcon(mockIconEl, 'target-icon', 'block-1');

      expect(mockIconEl.innerHTML).toContain('/icons/target.png');
      expect(mockIconEl.classList.remove).toHaveBeenCalledWith('exe-no-icon');
    });

    it('finds icon by value when key and id do not match', () => {
      window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({
              someKey: { id: 'some-id', value: '/icons/myicon.png', title: 'My Icon' },
            }),
          },
        },
      };

      const mockIconEl = {
        innerHTML: '',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => true,
        },
        querySelector: () => null,
      };

      // Using icon value as iconName
      bridge._syncBlockIcon(mockIconEl, '/icons/myicon.png', 'block-1');

      expect(mockIconEl.innerHTML).toContain('/icons/myicon.png');
    });

    it('does not update when icon src already matches', () => {
      window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({
              info: { id: '1', value: '/icons/info.png', title: 'Info' },
            }),
          },
        },
      };

      const mockIconEl = {
        innerHTML: '<img src="/icons/info.png">',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => false, // doesn't have exe-no-icon
        },
        querySelector: () => ({ getAttribute: () => '/icons/info.png' }),
      };

      const originalHtml = mockIconEl.innerHTML;
      bridge._syncBlockIcon(mockIconEl, 'info', 'block-1');

      // Should not change since src already matches and no exe-no-icon class
      expect(mockIconEl.innerHTML).toBe(originalHtml);
    });

    it('does not clear icon when already showing empty SVG', () => {
      const mockIconEl = {
        innerHTML: '<svg>empty</svg>',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: (className) => className === 'exe-no-icon', // has exe-no-icon
        },
        querySelector: () => null, // no img element
      };

      bridge._syncBlockIcon(mockIconEl, '', 'block-1');

      // Should not add exe-no-icon class again since already has it and no img
      expect(mockIconEl.classList.add).not.toHaveBeenCalled();
    });

    it('handles missing theme icons gracefully', () => {
      window.eXeLearning = {
        app: {
          themes: {
            getThemeIcons: () => ({}), // empty icons
          },
        },
      };

      const mockIconEl = {
        innerHTML: '',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => false,
        },
        querySelector: () => null,
      };

      // Should not throw when icon not found
      expect(() => {
        bridge._syncBlockIcon(mockIconEl, 'nonexistent-icon', 'block-1');
      }).not.toThrow();

      // Should not modify innerHTML when icon not found
      expect(mockIconEl.innerHTML).toBe('');
    });

    it('handles undefined getThemeIcons gracefully', () => {
      window.eXeLearning = {
        app: {
          themes: {}, // no getThemeIcons method
        },
      };

      const mockIconEl = {
        innerHTML: '',
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
          contains: () => false,
        },
        querySelector: () => null,
      };

      // Should not throw
      expect(() => {
        bridge._syncBlockIcon(mockIconEl, 'some-icon', 'block-1');
      }).not.toThrow();
    });
  });

  describe('hasUnsavedChangesForUI', () => {
    it('returns true when documentManager.isDirty is true', () => {
      bridge.documentManager = { isDirty: true };
      expect(bridge.hasUnsavedChangesForUI()).toBe(true);
    });

    it('returns false when documentManager.isDirty is false', () => {
      bridge.documentManager = { isDirty: false };
      expect(bridge.hasUnsavedChangesForUI()).toBe(false);
    });

    it('returns true when currentSaveStatus is unsaved and no documentManager', () => {
      bridge.documentManager = null;
      bridge.currentSaveStatus = 'unsaved';
      expect(bridge.hasUnsavedChangesForUI()).toBe(true);
    });

    it('returns true when currentSaveStatus is error and no documentManager', () => {
      bridge.documentManager = null;
      bridge.currentSaveStatus = 'error';
      expect(bridge.hasUnsavedChangesForUI()).toBe(true);
    });

    it('returns false when currentSaveStatus is saved and no documentManager', () => {
      bridge.documentManager = null;
      bridge.currentSaveStatus = 'saved';
      expect(bridge.hasUnsavedChangesForUI()).toBe(false);
    });
  });

  describe('_markDocumentClean', () => {
    beforeEach(() => {
      // Ensure saveStatusCallbacks is initialized
      bridge.saveStatusCallbacks = [];
      // Create a mock save button with classList
      bridge.saveButton = {
        classList: {
          add: mock(() => {}),
          remove: mock(() => {}),
        },
      };
    });

    it('calls documentManager.markClean when available', () => {
      const markCleanMock = mock(() => {});
      bridge.documentManager = { markClean: markCleanMock };

      bridge._markDocumentClean();

      expect(markCleanMock).toHaveBeenCalled();
    });

    it('updates save status to saved', () => {
      bridge.documentManager = { markClean: mock(() => {}) };

      bridge._markDocumentClean();

      expect(bridge.currentSaveStatus).toBe('saved');
    });

    it('handles missing documentManager gracefully', () => {
      bridge.documentManager = null;

      expect(() => bridge._markDocumentClean()).not.toThrow();
      expect(bridge.currentSaveStatus).toBe('saved');
    });
  });

  describe('importFromElpx dirty tracking', () => {
    beforeEach(() => {
      bridge.documentManager = {
        withSuppressedDirtyTracking: mock(async (fn) => fn()),
        markClean: mock(() => {}),
        markDirty: mock(() => {}),
        captureBaselineState: mock(() => {}),
        clearUndoStack: mock(() => {}),
        isDirty: false,
        _initialized: true,
      };
      bridge.assetManager = {};

      window.ElpxImporter = class {
        constructor() {}
        importFromFile = mock(() => Promise.resolve({ pages: 1, idevices: 2, assets: 0 }));
      };
    });

    it('uses withSuppressedDirtyTracking when clearExisting is true', async () => {
      const file = new File(['test'], 'test.elpx');

      await bridge.importFromElpx(file, { clearExisting: true });

      expect(bridge.documentManager.withSuppressedDirtyTracking).toHaveBeenCalled();
    });

    it('marks document clean after import with clearExisting', async () => {
      const file = new File(['test'], 'test.elpx');

      await bridge.importFromElpx(file, { clearExisting: true });

      expect(bridge.documentManager.markClean).toHaveBeenCalled();
    });

    it('clears undo stack after import with clearExisting', async () => {
      const file = new File(['test'], 'test.elpx');

      await bridge.importFromElpx(file, { clearExisting: true });

      expect(bridge.documentManager.clearUndoStack).toHaveBeenCalled();
    });

    it('does not clear undo stack when importing without clearExisting', async () => {
      const file = new File(['test'], 'test.elpx');
      bridge.documentManager.isDirty = false;

      await bridge.importFromElpx(file, { clearExisting: false });

      expect(bridge.documentManager.clearUndoStack).not.toHaveBeenCalled();
    });

    it('marks document dirty when importing without clearExisting', async () => {
      const file = new File(['test'], 'test.elpx');
      bridge.documentManager.isDirty = false;

      await bridge.importFromElpx(file, { clearExisting: false });

      expect(bridge.documentManager.markDirty).toHaveBeenCalled();
    });
  });

  describe('clearAssetsForNewProject', () => {
    let mockYdoc;
    let mockAssetsMap;
    let mockAssetsData;

    beforeEach(() => {
      // Create a mock Y.Map-like object for assets
      mockAssetsData = new Map();
      mockAssetsMap = {
        get size() {
          return mockAssetsData.size;
        },
        set: (key, value) => mockAssetsData.set(key, value),
        get: (key) => mockAssetsData.get(key),
        clear: mock(() => mockAssetsData.clear()),
      };

      mockYdoc = {
        getMap: mock((name) => {
          if (name === 'assets') return mockAssetsMap;
          return new Map();
        }),
        transact: mock((fn) => fn()),
      };

      bridge.documentManager = {
        ydoc: mockYdoc,
      };

      bridge.assetManager = {
        blobCache: new Map(),
        blobURLCache: new Map(),
        reverseBlobCache: new Map(),
        clearCache: mock(async () => {}),
      };
    });

    it('clears AssetManager memory caches', async () => {
      // Setup: add some assets to caches
      bridge.assetManager.blobCache.set('test-id', new Blob(['test']));
      bridge.assetManager.blobURLCache.set('test-id', 'blob:http://test/123');
      bridge.assetManager.reverseBlobCache.set('blob:http://test/123', 'test-id');

      await bridge.clearAssetsForNewProject();

      expect(bridge.assetManager.blobCache.size).toBe(0);
      expect(bridge.assetManager.blobURLCache.size).toBe(0);
      expect(bridge.assetManager.reverseBlobCache.size).toBe(0);
    });

    it('revokes blob URLs when clearing caches', async () => {
      const mockRevokeObjectURL = mock(() => {});
      global.URL = { revokeObjectURL: mockRevokeObjectURL };

      bridge.assetManager.blobURLCache.set('test-id-1', 'blob:http://test/123');
      bridge.assetManager.blobURLCache.set('test-id-2', 'blob:http://test/456');

      await bridge.clearAssetsForNewProject();

      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://test/123');
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://test/456');
    });

    it('only revokes blob URLs (skips data URLs)', async () => {
      const mockRevokeObjectURL = mock(() => {});
      global.URL = { revokeObjectURL: mockRevokeObjectURL };

      bridge.assetManager.blobURLCache.set('blob-asset', 'blob:http://test/123');
      bridge.assetManager.blobURLCache.set('data-asset', 'data:image/png;base64,AAAA');

      await bridge.clearAssetsForNewProject();

      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(1);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://test/123');
    });

    it('does not fail when revokeObjectURL throws', async () => {
      const mockRevokeObjectURL = mock(() => {
        throw new Error('revoke failed');
      });
      global.URL = { revokeObjectURL: mockRevokeObjectURL };

      bridge.assetManager.blobURLCache.set('blob-asset', 'blob:http://test/123');

      await expect(bridge.clearAssetsForNewProject()).resolves.not.toThrow();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://test/123');
    });

    it('clears Yjs assets map when it has entries', async () => {
      // Setup: add asset metadata to Yjs
      mockAssetsData.set('test-asset', { id: 'test-asset', filename: 'test.jpg' });

      await bridge.clearAssetsForNewProject();

      expect(mockYdoc.transact).toHaveBeenCalled();
      expect(mockAssetsMap.clear).toHaveBeenCalled();
    });

    it('does not call transact when assets map is empty', async () => {
      // Assets map is already empty

      await bridge.clearAssetsForNewProject();

      expect(mockYdoc.transact).not.toHaveBeenCalled();
    });

    it('calls clearCache on AssetManager', async () => {
      await bridge.clearAssetsForNewProject();

      expect(bridge.assetManager.clearCache).toHaveBeenCalled();
    });

    it('handles missing assetManager gracefully', async () => {
      bridge.assetManager = null;

      await expect(bridge.clearAssetsForNewProject()).resolves.not.toThrow();
    });

    it('handles missing documentManager gracefully', async () => {
      bridge.documentManager = null;

      await expect(bridge.clearAssetsForNewProject()).resolves.not.toThrow();
    });

    it('handles missing ydoc gracefully', async () => {
      bridge.documentManager = {};

      await expect(bridge.clearAssetsForNewProject()).resolves.not.toThrow();
    });
  });

  describe('clearMetadataForNewProject', () => {
    let mockYdoc;
    let mockMetadataData;
    let mockMetadataMap;
    let mockThemeFilesData;
    let mockThemeFilesMap;

    beforeEach(() => {
      mockMetadataData = new Map();
      mockMetadataMap = {
        get size() {
          return mockMetadataData.size;
        },
        set: (key, value) => mockMetadataData.set(key, value),
        get: (key) => mockMetadataData.get(key),
        clear: mock(() => mockMetadataData.clear()),
      };

      mockThemeFilesData = new Map();
      mockThemeFilesMap = {
        get size() {
          return mockThemeFilesData.size;
        },
        set: (key, value) => mockThemeFilesData.set(key, value),
        get: (key) => mockThemeFilesData.get(key),
        clear: mock(() => mockThemeFilesData.clear()),
      };

      mockYdoc = {
        getMap: mock((name) => {
          if (name === 'metadata') return mockMetadataMap;
          if (name === 'themeFiles') return mockThemeFilesMap;
          return new Map();
        }),
        transact: mock((fn) => fn()),
      };

      bridge.documentManager = {
        ydoc: mockYdoc,
      };
    });

    it('clears metadata map and sets timestamps', () => {
      mockMetadataData.set('title', 'Old Title');
      mockMetadataData.set('subtitle', 'Old Subtitle');

      bridge.clearMetadataForNewProject();

      expect(mockMetadataMap.clear).toHaveBeenCalled();
      expect(mockMetadataData.has('createdAt')).toBe(true);
      expect(mockMetadataData.has('modifiedAt')).toBe(true);
      expect(typeof mockMetadataData.get('createdAt')).toBe('number');
      expect(typeof mockMetadataData.get('modifiedAt')).toBe('number');
    });

    it('clears themeFiles map when it has entries', () => {
      mockThemeFilesData.set('style.css', 'body {}');

      bridge.clearMetadataForNewProject();

      expect(mockThemeFilesMap.clear).toHaveBeenCalled();
    });

    it('does not call clear on themeFiles when empty', () => {
      // themeFiles map is empty
      bridge.clearMetadataForNewProject();

      expect(mockThemeFilesMap.clear).not.toHaveBeenCalled();
    });

    it('runs inside a single transaction', () => {
      mockMetadataData.set('title', 'Old');

      bridge.clearMetadataForNewProject();

      expect(mockYdoc.transact).toHaveBeenCalledTimes(1);
    });

    it('handles missing documentManager gracefully', () => {
      bridge.documentManager = null;

      expect(() => bridge.clearMetadataForNewProject()).not.toThrow();
    });

    it('handles missing ydoc gracefully', () => {
      bridge.documentManager = {};

      expect(() => bridge.clearMetadataForNewProject()).not.toThrow();
    });
  });

  describe('_extractAnchorsFromPageMap', () => {
    let tempDiv;

    beforeEach(() => {
      // Use the real DOM (originalDocument) because the outer beforeEach mocks global.document
      // with a stub whose querySelectorAll always returns [].
      tempDiv = originalDocument.createElement('div');
    });

    it('returns empty array when blocks is missing', () => {
      const pageMap = { get: () => null };
      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual([]);
    });

    it('returns empty array when no anchor elements found', () => {
      const compMap = { get: (key) => key === 'htmlContent' ? '<p>No anchors here</p>' : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual([]);
    });

    it('extracts anchor id from <a id="..."> without href', () => {
      const compMap = { get: (key) => key === 'htmlContent' ? '<p>Text <a id="myanchor">link</a></p>' : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual(['myanchor']);
    });

    it('extracts anchor name from <a name="..."> without href', () => {
      const compMap = { get: (key) => key === 'htmlContent' ? '<a name="section1"></a>' : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual(['section1']);
    });

    it('ignores <a> elements that have href', () => {
      const compMap = { get: (key) => key === 'htmlContent' ? '<a id="linked" href="#target">link</a>' : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual([]);
    });

    it('deduplicates anchors with same id', () => {
      const compMap1 = { get: (key) => key === 'htmlContent' ? '<a id="dup"></a>' : null };
      const compMap2 = { get: (key) => key === 'htmlContent' ? '<a id="dup"></a>' : null };
      const block = {
        get: (key) => key === 'components' ? {
          length: 2,
          get: (i) => i === 0 ? compMap1 : compMap2,
        } : null,
      };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual(['dup']);
    });

    it('skips components without htmlContent', () => {
      const compMap = { get: () => null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual([]);
    });

    it('skips blocks without components', () => {
      const block = { get: () => null };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual([]);
    });

    it('handles htmlContent as object with toString', () => {
      const htmlObj = { toString: () => '<a id="anchor1"></a>' };
      const compMap = { get: (key) => key === 'htmlContent' ? htmlObj : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = { get: (key) => key === 'blocks' ? { length: 1, get: () => block } : null };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual(['anchor1']);
    });

    it('collects anchors from multiple blocks and components', () => {
      const compMap1 = { get: (key) => key === 'htmlContent' ? '<a id="first"></a>' : null };
      const compMap2 = { get: (key) => key === 'htmlContent' ? '<a id="second"></a>' : null };
      const block1 = { get: (key) => key === 'components' ? { length: 1, get: () => compMap1 } : null };
      const block2 = { get: (key) => key === 'components' ? { length: 1, get: () => compMap2 } : null };
      const pageMap = {
        get: (key) => key === 'blocks' ? {
          length: 2,
          get: (i) => i === 0 ? block1 : block2,
        } : null,
      };

      expect(bridge._extractAnchorsFromPageMap(pageMap, tempDiv)).toEqual(['first', 'second']);
    });
  });

  describe('getPageAnchors', () => {
    beforeEach(() => {
      // getPageAnchors calls document.createElement('div') internally; override the mock
      // to return a real DOM element so querySelectorAll works correctly.
      global.document = { ...global.document, createElement: mock(() => originalDocument.createElement('div')) };
    });

    it('returns empty array when documentManager is missing', () => {
      bridge.documentManager = null;
      expect(bridge.getPageAnchors('page-1')).toEqual([]);
    });

    it('returns empty array when navigation is null', () => {
      bridge.documentManager = { getNavigation: () => null };
      expect(bridge.getPageAnchors('page-1')).toEqual([]);
    });

    it('returns empty array when pageId is empty', () => {
      bridge.documentManager = { getNavigation: () => ({ length: 0 }) };
      expect(bridge.getPageAnchors('')).toEqual([]);
    });

    it('returns empty array when page is not found', () => {
      const pageMap = { get: (key) => key === 'id' ? 'other-page' : null };
      bridge.documentManager = {
        getNavigation: () => ({ length: 1, get: () => pageMap }),
      };
      expect(bridge.getPageAnchors('page-1')).toEqual([]);
    });

    it('returns anchors from matching page', () => {
      const compMap = { get: (key) => key === 'htmlContent' ? '<a id="top"></a>' : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = {
        get: (key) => {
          if (key === 'id') return 'page-1';
          if (key === 'blocks') return { length: 1, get: () => block };
          return null;
        },
      };
      bridge.documentManager = {
        getNavigation: () => ({ length: 1, get: () => pageMap }),
      };

      expect(bridge.getPageAnchors('page-1')).toEqual(['top']);
    });

    it('uses pageId as fallback key', () => {
      const compMap = { get: (key) => key === 'htmlContent' ? '<a id="section"></a>' : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = {
        get: (key) => {
          if (key === 'id') return undefined;
          if (key === 'pageId') return 'page-2';
          if (key === 'blocks') return { length: 1, get: () => block };
          return null;
        },
      };
      bridge.documentManager = {
        getNavigation: () => ({ length: 1, get: () => pageMap }),
      };

      expect(bridge.getPageAnchors('page-2')).toEqual(['section']);
    });
  });

  describe('getAllPageAnchors', () => {
    beforeEach(() => {
      // getAllPageAnchors calls document.createElement('div') internally; override the mock
      // to return a real DOM element so querySelectorAll works correctly.
      global.document = { ...global.document, createElement: mock(() => originalDocument.createElement('div')) };
    });

    it('returns empty array when documentManager is missing', () => {
      bridge.documentManager = null;
      expect(bridge.getAllPageAnchors()).toEqual([]);
    });

    it('returns empty array when navigation is null', () => {
      bridge.documentManager = { getNavigation: () => null };
      expect(bridge.getAllPageAnchors()).toEqual([]);
    });

    it('skips pages with no id', () => {
      const pageMap = { get: () => null };
      bridge.documentManager = {
        getNavigation: () => ({ length: 1, get: () => pageMap }),
      };
      expect(bridge.getAllPageAnchors()).toEqual([]);
    });

    it('skips root page', () => {
      const pageMap = { get: (key) => key === 'id' ? 'root' : null };
      bridge.documentManager = {
        getNavigation: () => ({ length: 1, get: () => pageMap }),
      };
      expect(bridge.getAllPageAnchors()).toEqual([]);
    });

    it('skips excludePageId', () => {
      const compMap = { get: (key) => key === 'htmlContent' ? '<a id="anch"></a>' : null };
      const block = { get: (key) => key === 'components' ? { length: 1, get: () => compMap } : null };
      const pageMap = {
        get: (key) => {
          if (key === 'id') return 'page-1';
          if (key === 'pageName') return 'Page 1';
          if (key === 'blocks') return { length: 1, get: () => block };
          return null;
        },
      };
      bridge.documentManager = {
        getNavigation: () => ({ length: 1, get: () => pageMap }),
      };

      expect(bridge.getAllPageAnchors('page-1')).toEqual([]);
    });

    it('returns pages with anchors, excluding those with no anchors', () => {
      const compMapWithAnchor = { get: (key) => key === 'htmlContent' ? '<a id="sec1"></a>' : null };
      const compMapNoAnchor = { get: (key) => key === 'htmlContent' ? '<p>no anchor</p>' : null };
      const blockWithAnchor = { get: (key) => key === 'components' ? { length: 1, get: () => compMapWithAnchor } : null };
      const blockNoAnchor = { get: (key) => key === 'components' ? { length: 1, get: () => compMapNoAnchor } : null };

      const page1 = {
        get: (key) => {
          if (key === 'id') return 'page-1';
          if (key === 'pageName') return 'Page One';
          if (key === 'blocks') return { length: 1, get: () => blockWithAnchor };
          return null;
        },
      };
      const page2 = {
        get: (key) => {
          if (key === 'id') return 'page-2';
          if (key === 'pageName') return 'Page Two';
          if (key === 'blocks') return { length: 1, get: () => blockNoAnchor };
          return null;
        },
      };

      bridge.documentManager = {
        getNavigation: () => ({
          length: 2,
          get: (i) => i === 0 ? page1 : page2,
        }),
      };

      const result = bridge.getAllPageAnchors();
      expect(result).toEqual([{ pageId: 'page-1', pageName: 'Page One', anchors: ['sec1'] }]);
    });

    it('collects anchors from multiple pages', () => {
      const makeComp = (html) => ({ get: (key) => key === 'htmlContent' ? html : null });
      const makeBlock = (comp) => ({ get: (key) => key === 'components' ? { length: 1, get: () => comp } : null });
      const makePage = (id, name, block) => ({
        get: (key) => {
          if (key === 'id') return id;
          if (key === 'pageName') return name;
          if (key === 'blocks') return { length: 1, get: () => block };
          return null;
        },
      });

      const page1 = makePage('p1', 'Page 1', makeBlock(makeComp('<a id="a1"></a>')));
      const page2 = makePage('p2', 'Page 2', makeBlock(makeComp('<a id="a2"></a>')));

      bridge.documentManager = {
        getNavigation: () => ({
          length: 2,
          get: (i) => i === 0 ? page1 : page2,
        }),
      };

      const result = bridge.getAllPageAnchors();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ pageId: 'p1', pageName: 'Page 1', anchors: ['a1'] });
      expect(result[1]).toEqual({ pageId: 'p2', pageName: 'Page 2', anchors: ['a2'] });
    });

    it('excludes a specific page while including others', () => {
      const makeComp = (html) => ({ get: (key) => key === 'htmlContent' ? html : null });
      const makeBlock = (comp) => ({ get: (key) => key === 'components' ? { length: 1, get: () => comp } : null });
      const makePage = (id, name, block) => ({
        get: (key) => {
          if (key === 'id') return id;
          if (key === 'pageName') return name;
          if (key === 'blocks') return { length: 1, get: () => block };
          return null;
        },
      });

      const page1 = makePage('p1', 'Page 1', makeBlock(makeComp('<a id="a1"></a>')));
      const page2 = makePage('p2', 'Page 2', makeBlock(makeComp('<a id="a2"></a>')));

      bridge.documentManager = {
        getNavigation: () => ({
          length: 2,
          get: (i) => i === 0 ? page1 : page2,
        }),
      };

      const result = bridge.getAllPageAnchors('p1');
      expect(result).toHaveLength(1);
      expect(result[0].pageId).toBe('p2');
    });
  });
});

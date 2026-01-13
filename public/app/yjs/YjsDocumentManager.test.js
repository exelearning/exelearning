/**
 * YjsDocumentManager Tests
 *
 * Unit tests for YjsDocumentManager - the central manager for Yjs documents.
 *
 */

 

// Test functions available globally from vitest setup

const YjsDocumentManager = require('./YjsDocumentManager');

class MockIndexeddbPersistence {
  constructor(dbName, ydoc) {
    this.dbName = dbName;
    this.ydoc = ydoc;
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    // Auto-fire synced event
    if (event === 'synced') {
      setTimeout(() => callback(), 0);
    }
  }

  destroy() {}
}

class MockWebsocketProvider {
  constructor(url, roomName, ydoc, options) {
    this.url = url;
    this.roomName = roomName;
    this.ydoc = ydoc;
    this.options = options;
    this.synced = true;
    this._listeners = {};
    this.awareness = new MockAwareness();
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  once(event, callback) {
    this.on(event, callback);
    if (event === 'sync') {
      setTimeout(() => callback(true), 0);
    }
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter((cb) => cb !== callback);
    }
  }

  disconnect() {}
  destroy() {}
}

class MockAwareness {
  constructor() {
    this.clientID = 12345;
    this._localState = {};
    this._states = new Map();
    this._listeners = {};
  }

  getLocalState() {
    return this._localState;
  }

  setLocalState(state) {
    this._localState = state;
  }

  setLocalStateField(field, value) {
    if (!this._localState) this._localState = {};
    this._localState[field] = value;
  }

  getStates() {
    return this._states;
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
}

describe('YjsDocumentManager', () => {
  let manager;
  const originalWindow = global.window;
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(global, 'navigator');
  const originalFetch = global.fetch;
  const originalTranslate = global._;
  let originalWindowY;
  let originalIndexeddbPersistence;
  let originalWebsocketProvider;
  let originalYjsLockManager;
  let originalExeLearning;
  let originalLocation;
  let originalAddEventListener;
  let originalRemoveEventListener;

  beforeEach(() => {
    originalWindowY = global.window.Y;
    originalIndexeddbPersistence = global.window.IndexeddbPersistence;
    originalWebsocketProvider = global.window.WebsocketProvider;
    originalYjsLockManager = global.window.YjsLockManager;
    originalExeLearning = global.window.eXeLearning;
    originalLocation = global.window.location;
    originalAddEventListener = global.window.addEventListener;
    originalRemoveEventListener = global.window.removeEventListener;

    // Setup global mocks
    global.window.Y = global.window.Y || global.Y;
    global.window.IndexeddbPersistence = MockIndexeddbPersistence;
    global.window.WebsocketProvider = MockWebsocketProvider;
    global.window.YjsLockManager = null;
    global.window.eXeLearning = {
      config: { basePath: '' },
    };
    global.window.location = {
      protocol: 'http:',
      hostname: 'localhost',
      port: '3001',
    };
    global.window.addEventListener = mock(() => undefined);
    global.window.removeEventListener = mock(() => undefined);

    global._ = mock((key) => key);
    Object.defineProperty(global, 'navigator', {
      value: { sendBeacon: mock(() => true) },
      writable: true,
      configurable: true,
    });
    global.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      })
    );

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});

    manager = new YjsDocumentManager('test-project-123', {
      wsUrl: 'ws://localhost:3001/yjs',
      apiUrl: '/api',
      token: 'test-token',
      offline: true, // Offline for most tests
    });
  });

  afterEach(async () => {
    // Cleanup manager to prevent memory leaks
    if (manager && typeof manager.destroy === 'function') {
      await manager.destroy();
    }
    manager = null;

    // Restore original globals instead of deleting
    global.window = originalWindow;
    global.window.Y = originalWindowY;
    global.window.IndexeddbPersistence = originalIndexeddbPersistence;
    global.window.WebsocketProvider = originalWebsocketProvider;
    global.window.YjsLockManager = originalYjsLockManager;
    global.window.eXeLearning = originalExeLearning;
    global.window.location = originalLocation;
    global.window.addEventListener = originalAddEventListener;
    global.window.removeEventListener = originalRemoveEventListener;
    global._ = originalTranslate;
    if (originalNavigatorDescriptor) {
      Object.defineProperty(global, 'navigator', originalNavigatorDescriptor);
    }
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('initializes with project ID', () => {
      expect(manager.projectId).toBe('test-project-123');
    });

    it('initializes with default config', () => {
      expect(manager.config.apiUrl).toBe('/api');
      expect(manager.config.token).toBe('test-token');
      expect(manager.config.offline).toBe(true);
    });

    it('initializes in not-initialized state', () => {
      expect(manager.initialized).toBe(false);
      expect(manager.ydoc).toBeNull();
    });

    it('initializes dirty state as false', () => {
      expect(manager.isDirty).toBe(false);
      expect(manager.lastSavedAt).toBeNull();
      expect(manager.saveInProgress).toBe(false);
    });

    it('initializes event listeners', () => {
      expect(manager.listeners).toHaveProperty('sync');
      expect(manager.listeners).toHaveProperty('update');
      expect(manager.listeners).toHaveProperty('awareness');
      expect(manager.listeners).toHaveProperty('connectionChange');
      expect(manager.listeners).toHaveProperty('saveStatus');
      expect(manager.listeners).toHaveProperty('usersChange');
    });
  });

  describe('_buildDefaultWsUrl', () => {
    it('builds WebSocket URL from location', () => {
      const url = manager._buildDefaultWsUrl();
      expect(url).toBe('ws://localhost:3001/yjs');
    });

    it('uses wss for https', () => {
      global.window.location.protocol = 'https:';
      const url = manager._buildDefaultWsUrl();
      expect(url).toContain('wss://');
    });
  });

  describe('initialize', () => {
    it('throws error if Y is not loaded', async () => {
      global.window.Y = undefined;
      await expect(manager.initialize()).rejects.toThrow('Yjs (window.Y) not loaded');
    });

    it('throws error if IndexeddbPersistence is not loaded', async () => {
      global.window.IndexeddbPersistence = undefined;
      await expect(manager.initialize()).rejects.toThrow('IndexeddbPersistence not loaded');
    });

    it('initializes successfully in offline mode', async () => {
      await manager.initialize();
      expect(manager.initialized).toBe(true);
      expect(manager.ydoc).toBeDefined();
    });

    it('creates blank project structure for new project', async () => {
      await manager.initialize({ isNewProject: true });

      const metadata = manager.getMetadata();
      expect(metadata.get('title')).toBe('Untitled document');
    });

    it('sets initialized flag after initialization', async () => {
      await manager.initialize();
      expect(manager.initialized).toBe(true);
    });

    it('emits sync event after initialization', async () => {
      const syncCallback = mock(() => undefined);
      manager.on('sync', syncCallback);

      await manager.initialize();

      expect(syncCallback).toHaveBeenCalledWith({ synced: true });
    });

    it('does not reinitialize if already initialized', async () => {
      await manager.initialize();
      await manager.initialize(); // Should warn but not throw

      expect(console.warn).toHaveBeenCalledWith('YjsDocumentManager already initialized');
    });
  });

  describe('generateId', () => {
    it('generates unique UUIDs', () => {
      const id1 = manager.generateId();
      const id2 = manager.generateId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('generates valid UUID v4 format', () => {
      const id = manager.generateId();
      const parts = id.split('-');

      expect(parts).toHaveLength(5);
      expect(parts[0]).toHaveLength(8);
      expect(parts[1]).toHaveLength(4);
      expect(parts[2]).toHaveLength(4);
      expect(parts[3]).toHaveLength(4);
      expect(parts[4]).toHaveLength(12);
    });
  });

  describe('generateUserColor', () => {
    it('returns a hex color', () => {
      const color = manager.generateUserColor();
      expect(color).toMatch(/^#[a-f0-9]{6}$/i);
    });

    it('returns colors from predefined palette', () => {
      const validColors = [
        '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
        '#2196f3', '#03a9f4', '#00bcd4', '#009688',
        '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
        '#ffc107', '#ff9800', '#ff5722',
      ];

      const color = manager.generateUserColor();
      expect(validColors).toContain(color);
    });
  });

  describe('getNavigation / getMetadata / getLocks / getDoc / getThemeFiles', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('getNavigation returns Y.Array', () => {
      const navigation = manager.getNavigation();
      expect(navigation).toBeDefined();
      expect(navigation).toBeInstanceOf(global.window.Y.Array);
    });

    it('getMetadata returns Y.Map', () => {
      const metadata = manager.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata).toBeInstanceOf(global.window.Y.Map);
    });

    it('getLocks returns Y.Map', () => {
      const locks = manager.getLocks();
      expect(locks).toBeDefined();
      expect(locks).toBeInstanceOf(global.window.Y.Map);
    });

    it('getDoc returns Y.Doc', () => {
      const doc = manager.getDoc();
      expect(doc).toBeDefined();
      expect(doc).toBeInstanceOf(global.window.Y.Doc);
    });

    it('getThemeFiles returns Y.Map for user themes', () => {
      const themeFiles = manager.getThemeFiles();
      expect(themeFiles).toBeDefined();
      expect(themeFiles).toBeInstanceOf(global.window.Y.Map);
    });

    it('getThemeFiles throws when not initialized', () => {
      const uninitManager = new YjsDocumentManager('uninitialized-project', {
        wsUrl: 'ws://localhost:3001/yjs',
        apiUrl: '/api',
        token: 'test-token',
        offline: true,
      });

      expect(() => uninitManager.getThemeFiles()).toThrow('YjsDocumentManager not initialized');
    });
  });

  describe('dirty state management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('markDirty sets isDirty to true', () => {
      expect(manager.isDirty).toBe(false);
      manager.markDirty();
      expect(manager.isDirty).toBe(true);
    });

    it('markDirty emits saveStatus event', () => {
      const callback = mock(() => undefined);
      manager.on('saveStatus', callback);

      manager.markDirty();

      expect(callback).toHaveBeenCalledWith({ status: 'dirty', isDirty: true });
    });

    it('markDirty only emits once for multiple calls', () => {
      const callback = mock(() => undefined);
      manager.on('saveStatus', callback);

      manager.markDirty();
      manager.markDirty();
      manager.markDirty();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('markClean resets dirty state', () => {
      manager.markDirty();
      expect(manager.isDirty).toBe(true);

      manager.markClean();

      expect(manager.isDirty).toBe(false);
      expect(manager.lastSavedAt).toBeInstanceOf(Date);
    });

    it('hasUnsavedChanges returns isDirty', () => {
      expect(manager.hasUnsavedChanges()).toBe(false);
      manager.markDirty();
      expect(manager.hasUnsavedChanges()).toBe(true);
    });

    it('getSaveStatus returns status object', () => {
      const status = manager.getSaveStatus();

      expect(status).toHaveProperty('isDirty');
      expect(status).toHaveProperty('lastSavedAt');
      expect(status).toHaveProperty('saveInProgress');
    });
  });

  describe('undo/redo', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('canUndo returns false when no undo stack', () => {
      expect(manager.canUndo()).toBe(false);
    });

    it('canRedo returns false when no redo stack', () => {
      expect(manager.canRedo()).toBe(false);
    });

    it('undo does nothing when canUndo is false', () => {
      // Should not throw
      manager.undo();
    });

    it('redo does nothing when canRedo is false', () => {
      // Should not throw
      manager.redo();
    });
  });

  describe('locking', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('requestLock returns undefined when lockManager is null', () => {
      const result = manager.requestLock('component-123');
      expect(result).toBeUndefined();
    });

    it('releaseLock does nothing when lockManager is null', () => {
      // Should not throw
      manager.releaseLock('component-123');
    });

    it('isLocked returns undefined when lockManager is null', () => {
      const result = manager.isLocked('component-123');
      expect(result).toBeUndefined();
    });

    it('getLockInfo returns undefined when lockManager is null', () => {
      const result = manager.getLockInfo('component-123');
      expect(result).toBeUndefined();
    });
  });

  describe('event system', () => {
    it('on adds callback to listeners', () => {
      const callback = mock(() => undefined);
      manager.on('sync', callback);

      expect(manager.listeners.sync).toContain(callback);
    });

    it('off removes callback from listeners', () => {
      const callback = mock(() => undefined);
      manager.on('sync', callback);
      manager.off('sync', callback);

      expect(manager.listeners.sync).not.toContain(callback);
    });

    it('emit calls all listeners for event', () => {
      const callback1 = mock(() => undefined);
      const callback2 = mock(() => undefined);
      manager.on('sync', callback1);
      manager.on('sync', callback2);

      manager.emit('sync', { data: 'test' });

      expect(callback1).toHaveBeenCalledWith({ data: 'test' });
      expect(callback2).toHaveBeenCalledWith({ data: 'test' });
    });

    it('emit does nothing for unknown event', () => {
      // Should not throw
      manager.emit('unknownEvent', { data: 'test' });
    });
  });

  describe('user presence', () => {
    beforeEach(async () => {
      manager.config.offline = false;
      await manager.initialize();
    });

    it('setUserInfo updates awareness', () => {
      manager.setUserInfo({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      });

      expect(manager.userInfo.id).toBe('user-123');
    });

    it('getOnlineUsers returns empty array when no awareness', async () => {
      manager.awareness = null;
      const users = manager.getOnlineUsers();
      expect(users).toEqual([]);
    });

    it('getUsersOnPage filters by page ID', async () => {
      manager.awareness = new MockAwareness();
      manager.awareness._states.set(1, { user: { selectedPageId: 'page-1' } });
      manager.awareness._states.set(2, { user: { selectedPageId: 'page-2' } });

      const users = manager.getUsersOnPage('page-1');
      expect(users).toHaveLength(1);
      expect(users[0].selectedPageId).toBe('page-1');
    });

    it('getUsersEditingComponent filters by component ID', async () => {
      manager.awareness = new MockAwareness();
      manager.awareness._states.set(1, { user: { editingComponentId: 'comp-1' } });
      manager.awareness._states.set(2, { user: { editingComponentId: 'comp-2' } });

      const users = manager.getUsersEditingComponent('comp-1');
      // Excludes local user
      expect(users).toHaveLength(1);
    });

    it('setSelectedPage updates awareness', () => {
      manager.awareness = new MockAwareness();
      manager.setSelectedPage('page-123');

      const state = manager.awareness.getLocalState();
      expect(state.user.selectedPageId).toBe('page-123');
    });

    it('setEditingComponent updates awareness', () => {
      manager.awareness = new MockAwareness();
      manager.setEditingComponent('comp-123');

      const state = manager.awareness.getLocalState();
      expect(state.user.editingComponentId).toBe('comp-123');
    });
  });

  describe('simpleHash', () => {
    it('generates hash string', () => {
      const hash = manager.simpleHash('test@example.com');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(32);
    });

    it('generates consistent hash for same input', () => {
      const hash1 = manager.simpleHash('test@example.com');
      const hash2 = manager.simpleHash('test@example.com');
      expect(hash1).toBe(hash2);
    });

    it('generates different hash for different input', () => {
      const hash1 = manager.simpleHash('test1@example.com');
      const hash2 = manager.simpleHash('test2@example.com');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('_fallbackGetInitials', () => {
    it('returns initials from name', () => {
      expect(manager._fallbackGetInitials('John Doe')).toBe('JD');
      expect(manager._fallbackGetInitials('Jane Smith')).toBe('JS');
    });

    it('returns initials from single name', () => {
      expect(manager._fallbackGetInitials('John')).toBe('JO');
    });

    it('returns initials from email', () => {
      expect(manager._fallbackGetInitials('john.doe@example.com')).toBe('JD');
    });

    it('returns ? for empty input', () => {
      expect(manager._fallbackGetInitials('')).toBe('?');
      expect(manager._fallbackGetInitials(null)).toBe('?');
    });
  });

  describe('getDescendantPageIds', () => {
    it('returns empty array for page with no children', () => {
      const structureData = {
        'page-1': { pageId: 'page-1', parent: null },
        'page-2': { pageId: 'page-2', parent: null },
      };

      const descendants = manager.getDescendantPageIds('page-1', structureData);
      expect(descendants).toEqual([]);
    });

    it('returns child page IDs', () => {
      const structureData = {
        'page-1': { pageId: 'page-1', parent: null },
        'page-2': { pageId: 'page-2', parent: 'page-1' },
        'page-3': { pageId: 'page-3', parent: 'page-1' },
      };

      const descendants = manager.getDescendantPageIds('page-1', structureData);
      expect(descendants).toContain('page-2');
      expect(descendants).toContain('page-3');
    });

    it('returns grandchild page IDs recursively', () => {
      const structureData = {
        'page-1': { pageId: 'page-1', parent: null },
        'page-2': { pageId: 'page-2', parent: 'page-1' },
        'page-3': { pageId: 'page-3', parent: 'page-2' },
      };

      const descendants = manager.getDescendantPageIds('page-1', structureData);
      expect(descendants).toContain('page-2');
      expect(descendants).toContain('page-3');
    });
  });

  describe('destroy', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('removes event listeners', async () => {
      await manager.destroy();
      expect(global.window.removeEventListener).toHaveBeenCalled();
    });

    it('resets state', async () => {
      await manager.destroy();

      expect(manager.initialized).toBe(false);
      expect(manager.isDirty).toBe(false);
      expect(manager.ydoc).toBeNull();
    });

    it('clears listeners', async () => {
      manager.on('sync', mock(() => undefined));
      await manager.destroy();

      expect(manager.listeners.sync).toEqual([]);
    });
  });

  describe('flush', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('resolves successfully', async () => {
      await expect(manager.flush()).resolves.toBeUndefined();
    });
  });

  describe('onUsersChange', () => {
    it('subscribes to usersChange event', () => {
      const callback = mock(() => undefined);
      const unsubscribe = manager.onUsersChange(callback);

      manager.emit('usersChange', { users: [] });
      expect(callback).toHaveBeenCalled();

      unsubscribe();
      callback.mockClear();
      manager.emit('usersChange', { users: [] });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('static clearProjectIndexedDB', () => {
    beforeEach(() => {
      global.indexedDB = {
        deleteDatabase: mock(() => ({
          onsuccess: null,
          onerror: null,
          onblocked: null,
        })),
      };
    });

    afterEach(() => {
      delete global.indexedDB;
    });

    it('calls deleteDatabase with correct name', async () => {
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      global.indexedDB.deleteDatabase = mock(() => mockRequest);

      const promise = YjsDocumentManager.clearProjectIndexedDB('project-123');

      // Simulate success
      mockRequest.onsuccess();

      await promise;
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledWith('exelearning-project-project-123');
    });

    it('handles onblocked event', async () => {
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      global.indexedDB.deleteDatabase = mock(() => mockRequest);

      const promise = YjsDocumentManager.clearProjectIndexedDB('project-456');

      // Simulate blocked (still resolves)
      mockRequest.onblocked();

      await promise;
    });

    it('handles onerror event', async () => {
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        error: new Error('DB delete failed'),
      };
      global.indexedDB.deleteDatabase = mock(() => mockRequest);

      const promise = YjsDocumentManager.clearProjectIndexedDB('project-789');

      // Simulate error
      mockRequest.onerror();

      await expect(promise).rejects.toThrow();
    });
  });

  describe('waitForWebSocketSync', () => {
    beforeEach(async () => {
      manager.config.offline = false;
      await manager.initialize();
    });

    it('returns immediately if skipSyncWait is true', async () => {
      manager.config.skipSyncWait = true;
      await manager.waitForWebSocketSync();
      // Should complete quickly without errors
    });

    it('returns immediately if wsProvider is already synced', async () => {
      manager.wsProvider = { synced: true, disconnect: () => {}, destroy: () => {} };
      await manager.waitForWebSocketSync();
    });

    it('skips full sync if no other users present', async () => {
      manager.config.skipSyncWait = false;
      manager.wsProvider = { synced: false, disconnect: () => {}, destroy: () => {} };
      manager.awareness = new MockAwareness();
      manager.config.awarenessCheckTimeout = 10;

      await manager.waitForWebSocketSync();
      // Should complete without waiting for full sync
    });
  });

  describe('_checkForOtherUsers', () => {
    beforeEach(async () => {
      manager.config.offline = false;
      await manager.initialize();
    });

    it('returns false when no wsProvider', async () => {
      manager.wsProvider = null;
      manager.awareness = null;

      const result = await manager._checkForOtherUsers();
      expect(result).toBe(false);
    });

    it('returns false when no other users found', async () => {
      manager.awareness = new MockAwareness();
      manager.config.awarenessCheckTimeout = 10;

      const result = await manager._checkForOtherUsers();
      expect(result).toBe(false);
    });

    it('returns true when other users found immediately', async () => {
      manager.awareness = new MockAwareness();
      manager.awareness._states.set(1, { user: { id: 'other-user' } });
      manager.awareness._states.set(2, { user: { id: 'another-user' } });
      manager.config.awarenessCheckTimeout = 100;

      const result = await manager._checkForOtherUsers();
      expect(result).toBe(true);
    });
  });

  describe('_waitForFullSync', () => {
    beforeEach(async () => {
      manager.config.offline = false;
      await manager.initialize();
    });

    it('resolves immediately if already synced', async () => {
      manager.wsProvider = { synced: true, disconnect: () => {}, destroy: () => {} };

      await manager._waitForFullSync();
    });

    it('resolves on sync event', async () => {
      const mockProvider = {
        synced: false,
        once: mock((event, callback) => {
          if (event === 'sync') {
            setTimeout(() => callback(true), 10);
          }
        }),
        disconnect: () => {},
        destroy: () => {},
      };
      manager.wsProvider = mockProvider;
      manager.config.fullSyncTimeout = 1000;

      await manager._waitForFullSync();
    });

    it('resolves on timeout when no sync event', async () => {
      manager.wsProvider = {
        synced: false,
        once: mock(() => {}),
        disconnect: () => {},
        destroy: () => {},
      };
      manager.config.fullSyncTimeout = 10;

      await manager._waitForFullSync();
    });

    it('resolves immediately when no wsProvider', async () => {
      manager.wsProvider = null;
      manager.config.fullSyncTimeout = 10;

      await manager._waitForFullSync();
    });
  });

  describe('loadFromServer', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('applies server state on successful response', async () => {
      const mockUpdate = new Uint8Array([1, 2, 3, 4]);
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(mockUpdate.buffer),
        })
      );

      const applyUpdateSpy = mock(() => undefined);
      manager.Y = { applyUpdate: applyUpdateSpy };
      await manager.loadFromServer();

      expect(applyUpdateSpy).toHaveBeenCalled();
    });

    it('handles 404 response (new project)', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        })
      );

      // Should not throw
      await manager.loadFromServer();
    });

    it('throws on non-404 error response', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      );

      // Should warn but not throw (graceful degradation)
      await manager.loadFromServer();
      expect(console.warn).toHaveBeenCalled();
    });

    it('handles network errors gracefully', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      await manager.loadFromServer();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('connectWebSocket', () => {
    it('logs error when WebsocketProvider not loaded', async () => {
      global.window.WebsocketProvider = undefined;
      await manager.initialize();

      await manager.connectWebSocket();

      expect(console.error).toHaveBeenCalledWith('[YjsDocumentManager] WebsocketProvider not loaded');
    });

    it('creates wsProvider with correct config', async () => {
      manager.config.offline = false;
      await manager.initialize();

      expect(manager.wsProvider).toBeDefined();
      expect(manager.awareness).toBeDefined();
    });
  });

  describe('startWebSocketConnection', () => {
    beforeEach(async () => {
      manager.config.offline = false;
      await manager.initialize();
    });

    it('warns when wsProvider is not initialized', () => {
      manager.wsProvider = null;

      manager.startWebSocketConnection();

      expect(console.warn).toHaveBeenCalledWith('[YjsDocumentManager] Cannot start connection: wsProvider not initialized');
    });

    it('does nothing when already connected', () => {
      manager.wsProvider = {
        wsconnected: true,
        connect: mock(() => {}),
        disconnect: () => {},
        destroy: () => {},
      };

      manager.startWebSocketConnection();

      expect(manager.wsProvider.connect).not.toHaveBeenCalled();
    });

    it('calls connect when not connected', () => {
      manager.wsProvider = {
        wsconnected: false,
        connect: mock(() => {}),
        disconnect: () => {},
        destroy: () => {},
      };

      manager.startWebSocketConnection();

      expect(manager.wsProvider.connect).toHaveBeenCalled();
    });
  });

  describe('stopCapturing', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('calls undoManager.stopCapturing', () => {
      manager.undoManager = {
        stopCapturing: mock(() => {}),
        destroy: () => {},
      };

      manager.stopCapturing();

      expect(manager.undoManager.stopCapturing).toHaveBeenCalled();
    });

    it('does nothing when undoManager is null', () => {
      manager.undoManager = null;

      // Should not throw
      manager.stopCapturing();
    });
  });

  describe('clearUndoStack', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('calls undoManager.clear', () => {
      manager.undoManager = {
        clear: mock(() => {}),
        destroy: () => {},
      };

      manager.clearUndoStack();

      expect(manager.undoManager.clear).toHaveBeenCalled();
    });

    it('does nothing when undoManager is null', () => {
      manager.undoManager = null;

      // Should not throw
      manager.clearUndoStack();
    });
  });

  describe('generateGravatarUrl', () => {
    it('returns null for empty email', () => {
      expect(manager.generateGravatarUrl('')).toBeNull();
      expect(manager.generateGravatarUrl(null)).toBeNull();
    });

    it('returns gravatar URL for valid email', () => {
      const url = manager.generateGravatarUrl('test@example.com');
      expect(url).toContain('https://www.gravatar.com/avatar/');
      expect(url).toContain('d=identicon');
    });
  });

  describe('getOtherUsersOnPageAndDescendants', () => {
    beforeEach(async () => {
      manager.config.offline = false;
      await manager.initialize();
    });

    it('returns users on target page', () => {
      manager.awareness = new MockAwareness();
      manager.awareness._states.set(1, { user: { id: 'user-1', selectedPageId: 'page-1' } });
      manager.awareness._states.set(2, { user: { id: 'user-2', selectedPageId: 'page-2' } });

      const structureData = {
        'page-1': { pageId: 'page-1', parent: null },
        'page-2': { pageId: 'page-2', parent: null },
      };

      const result = manager.getOtherUsersOnPageAndDescendants('page-1', structureData);

      expect(result.usersOnTarget.length).toBe(1);
      expect(result.usersOnTarget[0].id).toBe('user-1');
    });

    it('returns users on descendant pages', () => {
      manager.awareness = new MockAwareness();
      manager.awareness._states.set(1, { user: { id: 'user-1', selectedPageId: 'page-2' } });
      manager.awareness._states.set(2, { user: { id: 'user-2', selectedPageId: 'page-3' } });

      const structureData = {
        'page-1': { pageId: 'page-1', parent: null },
        'page-2': { pageId: 'page-2', parent: 'page-1' },
        'page-3': { pageId: 'page-3', parent: 'page-1' },
      };

      const result = manager.getOtherUsersOnPageAndDescendants('page-1', structureData);

      expect(result.usersOnDescendants.length).toBe(2);
      expect(result.descendantIds).toContain('page-2');
      expect(result.descendantIds).toContain('page-3');
    });

    it('returns all affected users without duplicates', () => {
      manager.awareness = new MockAwareness();
      manager.awareness._states.set(1, { user: { id: 'user-1', selectedPageId: 'page-1', clientId: 1 } });

      const structureData = {
        'page-1': { pageId: 'page-1', parent: null },
      };

      const result = manager.getOtherUsersOnPageAndDescendants('page-1', structureData);

      expect(result.allAffectedUsers.length).toBe(1);
    });
  });

  describe('_updateVersionMetadata', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('sets exelearning_version on success', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '3.0.0' }),
        })
      );

      await manager._updateVersionMetadata();

      const metadata = manager.getMetadata();
      expect(metadata.get('exelearning_version')).toBe('3.0.0');
    });

    it('handles fetch errors gracefully', async () => {
      global.fetch = mock(() => Promise.reject(new Error('Network error')));

      // Should not throw
      await manager._updateVersionMetadata();
      expect(console.warn).toHaveBeenCalled();
    });

    it('handles non-ok response gracefully', async () => {
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      );

      // Should not throw
      await manager._updateVersionMetadata();
    });
  });

  describe('_handleBeforeUnload', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('clears awareness on unload', () => {
      manager.awareness = new MockAwareness();
      manager._handleBeforeUnload({});

      expect(manager.awareness._localState).toBeNull();
    });

    it('calls _saveSync when dirty and not offline', () => {
      manager.config.offline = false;
      manager.isDirty = true;
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1])) };

      manager._handleBeforeUnload({});

      expect(global.navigator.sendBeacon).toHaveBeenCalled();
    });

    it('does not save when offline', () => {
      manager.config.offline = true;
      manager.isDirty = true;

      manager._handleBeforeUnload({});

      expect(global.navigator.sendBeacon).not.toHaveBeenCalled();
    });

    it('does not save when not dirty', () => {
      manager.config.offline = false;
      manager.isDirty = false;

      manager._handleBeforeUnload({});

      expect(global.navigator.sendBeacon).not.toHaveBeenCalled();
    });
  });

  describe('_clearAwarenessOnUnload', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('sets awareness to null', () => {
      manager.awareness = new MockAwareness();

      manager._clearAwarenessOnUnload();

      expect(manager.awareness._localState).toBeNull();
    });

    it('handles errors gracefully', () => {
      manager.awareness = {
        setLocalState: mock(() => { throw new Error('Test error'); }),
      };

      // Should not throw
      manager._clearAwarenessOnUnload();
      expect(console.warn).toHaveBeenCalled();
    });

    it('does nothing when awareness is null', () => {
      manager.awareness = null;

      // Should not throw
      manager._clearAwarenessOnUnload();
    });
  });

  describe('_saveSync', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('uses sendBeacon when available', () => {
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1, 2, 3])) };

      manager._saveSync();

      expect(global.navigator.sendBeacon).toHaveBeenCalled();
    });

    it('handles errors gracefully', () => {
      manager.Y = {
        encodeStateAsUpdate: mock(() => { throw new Error('Encode error'); }),
      };

      // Should not throw
      manager._saveSync();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('saveToServer', () => {
    beforeEach(async () => {
      await manager.initialize();
      manager.config.offline = false;
    });

    it('returns failure when offline', async () => {
      manager.config.offline = true;

      const result = await manager.saveToServer();

      expect(result.success).toBe(false);
    });

    it('returns failure when save in progress', async () => {
      manager.saveInProgress = true;

      const result = await manager.saveToServer();

      expect(result.success).toBe(false);
    });

    it('saves successfully', async () => {
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1, 2, 3])) };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' }),
        })
      );

      const result = await manager.saveToServer();

      expect(result.success).toBe(true);
      expect(result.bytes).toBe(3);
      expect(manager.isDirty).toBe(false);
    });

    it('emits saveStatus events', async () => {
      const callback = mock(() => undefined);
      manager.on('saveStatus', callback);
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1])) };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' }),
        })
      );

      await manager.saveToServer();

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ status: 'saving' }));
    });

    it('throws on fetch error', async () => {
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1])) };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({ version: '1.0' }),
        })
      );

      await expect(manager.saveToServer()).rejects.toThrow('Failed to save: 500 Internal Server Error');
    });

    it('does not emit events when silent', async () => {
      const callback = mock(() => undefined);
      manager.on('saveStatus', callback);
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1])) };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' }),
        })
      );

      await manager.saveToServer({ silent: true });

      // Should only emit 'saved' status from markClean, not 'saving'
      const savingCalls = callback.mock.calls.filter(c => c[0].status === 'saving');
      expect(savingCalls.length).toBe(0);
    });
  });

  describe('save', () => {
    beforeEach(async () => {
      await manager.initialize();
      manager.config.offline = false;
    });

    it('returns success message on successful save', async () => {
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1, 2, 3])) };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' }),
        })
      );

      const result = await manager.save();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Saved successfully');
    });

    it('returns failure message on error', async () => {
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1])) };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Error',
          json: () => Promise.resolve({ version: '1.0' }),
        })
      );

      const result = await manager.save();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save');
    });
  });

  describe('clearIndexedDB', () => {
    beforeEach(async () => {
      await manager.initialize();
      global.indexedDB = {
        deleteDatabase: mock(() => ({
          onsuccess: null,
          onerror: null,
          onblocked: null,
        })),
      };
    });

    afterEach(() => {
      delete global.indexedDB;
    });

    it('uses provider.clearData when available', async () => {
      manager.indexedDBProvider = {
        clearData: mock(() => Promise.resolve()),
        destroy: () => {},
      };

      await manager.clearIndexedDB();

      expect(manager.indexedDBProvider.clearData).toHaveBeenCalled();
    });

    it('deletes database directly when no provider method', async () => {
      manager.indexedDBProvider = { destroy: () => {} };
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      global.indexedDB.deleteDatabase = mock(() => mockRequest);

      const promise = manager.clearIndexedDB();
      mockRequest.onsuccess();

      await promise;
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalled();
    });

    it('handles blocked event', async () => {
      manager.indexedDBProvider = { destroy: () => {} };
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      global.indexedDB.deleteDatabase = mock(() => mockRequest);

      const promise = manager.clearIndexedDB();
      mockRequest.onblocked();

      await promise;
    });

    it('rejects on error event', async () => {
      manager.indexedDBProvider = { destroy: () => {} };
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        error: new Error('Delete failed'),
      };
      global.indexedDB.deleteDatabase = mock(() => mockRequest);

      const promise = manager.clearIndexedDB();
      mockRequest.onerror();

      await expect(promise).rejects.toThrow();
    });
  });

  describe('ensureBlankStructureIfEmpty', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('creates blank structure when navigation is empty', () => {
      // Clear navigation first
      const navigation = manager.getNavigation();
      while (navigation.length > 0) {
        navigation.delete(0);
      }
      expect(navigation.length).toBe(0);

      manager.ensureBlankStructureIfEmpty();

      expect(navigation.length).toBe(1);
    });

    it('does not create structure when navigation already has pages', () => {
      const navigation = manager.getNavigation();
      const initialLength = navigation.length;
      expect(initialLength).toBeGreaterThan(0);

      manager.ensureBlankStructureIfEmpty();

      expect(navigation.length).toBe(initialLength);
    });

    it('is safe to call multiple times', () => {
      // Clear navigation first
      const navigation = manager.getNavigation();
      while (navigation.length > 0) {
        navigation.delete(0);
      }

      manager.ensureBlankStructureIfEmpty();
      manager.ensureBlankStructureIfEmpty();
      manager.ensureBlankStructureIfEmpty();

      // Should still only have 1 page
      expect(navigation.length).toBe(1);
    });
  });

  describe('initialize blank structure behavior', () => {
    it('creates blank structure immediately in offline mode', async () => {
      manager.config.offline = true;
      await manager.initialize();

      const navigation = manager.getNavigation();
      expect(navigation.length).toBe(1);
    });

    it('does NOT create blank structure in online mode (deferred to bridge)', async () => {
      // Create a new manager for online mode test
      const onlineManager = new YjsDocumentManager('test-online-project', {
        wsUrl: 'ws://localhost:3001/yjs',
        apiUrl: '/api',
        token: 'test-token',
        offline: false, // Online mode
      });

      await onlineManager.initialize({ isNewProject: true });

      // In online mode, blank structure should NOT be created during initialize
      // It will be created by ensureBlankStructureIfEmpty() after WebSocket sync
      const navigation = onlineManager.getNavigation();
      // Navigation should be empty - no blank structure created yet
      expect(navigation.length).toBe(0);

      // Now call ensureBlankStructureIfEmpty (simulating what bridge does after sync)
      onlineManager.ensureBlankStructureIfEmpty();
      expect(navigation.length).toBe(1);

      await onlineManager.destroy();
    });
  });

  describe('destroy with options', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('saves before destroy when saveBeforeDestroy is true and dirty', async () => {
      manager.config.offline = false;
      manager.isDirty = true;
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1])) };
      global.fetch = mock(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '1.0' }),
        })
      );

      await manager.destroy({ saveBeforeDestroy: true });

      // Fetch should have been called for save
      const postCalls = global.fetch.mock.calls.filter(c =>
        c[1]?.method === 'POST'
      );
      expect(postCalls.length).toBeGreaterThan(0);
    });

    it('does not save when not dirty', async () => {
      manager.config.offline = false;
      manager.isDirty = false;
      global.fetch = mock(() => Promise.resolve({ ok: true }));

      await manager.destroy({ saveBeforeDestroy: true });

      // Only version fetch should happen, not save
      const postCalls = global.fetch.mock.calls.filter(c =>
        c[1]?.method === 'POST'
      );
      expect(postCalls.length).toBe(0);
    });

    it('handles save error gracefully', async () => {
      manager.config.offline = false;
      manager.isDirty = true;
      manager.Y = { encodeStateAsUpdate: mock(() => new Uint8Array([1])) };
      global.fetch = mock(() => Promise.reject(new Error('Save failed')));

      // Should not throw
      await manager.destroy({ saveBeforeDestroy: true });
      expect(console.error).toHaveBeenCalled();
    });
  });
});

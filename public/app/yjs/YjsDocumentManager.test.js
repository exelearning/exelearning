/**
 * YjsDocumentManager Tests
 *
 * Unit tests for YjsDocumentManager - the central manager for Yjs documents.
 *
 */

 

// Test functions available globally from vitest setup

const YjsDocumentManager = require('./YjsDocumentManager');

// Mock Y.js types
class MockYDoc {
  constructor() {
    this.clientID = 12345;
    this._arrays = {};
    this._maps = {};
    this._updateListeners = [];
  }

  getArray(name) {
    if (!this._arrays[name]) {
      this._arrays[name] = new MockYArray();
    }
    return this._arrays[name];
  }

  getMap(name) {
    if (!this._maps[name]) {
      this._maps[name] = new MockYMap();
    }
    return this._maps[name];
  }

  transact(fn, origin) {
    fn();
  }

  on(event, callback) {
    if (event === 'update') {
      this._updateListeners.push(callback);
    }
  }

  off(event, callback) {
    if (event === 'update') {
      this._updateListeners = this._updateListeners.filter((cb) => cb !== callback);
    }
  }

  destroy() {}
}

class MockYMap {
  constructor() {
    this._data = new Map();
  }

  get(key) {
    return this._data.get(key);
  }

  set(key, value) {
    this._data.set(key, value);
  }

  has(key) {
    return this._data.has(key);
  }

  delete(key) {
    return this._data.delete(key);
  }
}

class MockYArray {
  constructor() {
    this._items = [];
  }

  get length() {
    return this._items.length;
  }

  get(index) {
    return this._items[index];
  }

  push(items) {
    this._items.push(...items);
  }

  insert(index, items) {
    this._items.splice(index, 0, ...items);
  }

  delete(index, length = 1) {
    this._items.splice(index, length);
  }

  toArray() {
    return [...this._items];
  }
}

class MockUndoManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }

  undo() {}
  redo() {}
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
  destroy() {}
}

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

  beforeEach(() => {
    // Setup global mocks
    global.window = {
      Y: {
        Doc: MockYDoc,
        Map: MockYMap,
        Array: MockYArray,
        UndoManager: MockUndoManager,
        applyUpdate: mock(() => undefined),
        encodeStateAsUpdate: mock(() => new Uint8Array([1, 2, 3])),
      },
      IndexeddbPersistence: MockIndexeddbPersistence,
      WebsocketProvider: MockWebsocketProvider,
      YjsLockManager: null,
      eXeLearning: {
        symfony: { basePath: '' },
      },
      location: {
        protocol: 'http:',
        hostname: 'localhost',
        port: '3001',
      },
      addEventListener: mock(() => undefined),
      removeEventListener: mock(() => undefined),
    };

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

  describe('getNavigation / getMetadata / getLocks / getDoc', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('getNavigation returns Y.Array', () => {
      const navigation = manager.getNavigation();
      expect(navigation).toBeDefined();
      expect(navigation).toBeInstanceOf(MockYArray);
    });

    it('getMetadata returns Y.Map', () => {
      const metadata = manager.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata).toBeInstanceOf(MockYMap);
    });

    it('getLocks returns Y.Map', () => {
      const locks = manager.getLocks();
      expect(locks).toBeDefined();
      expect(locks).toBeInstanceOf(MockYMap);
    });

    it('getDoc returns Y.Doc', () => {
      const doc = manager.getDoc();
      expect(doc).toBeDefined();
      expect(doc).toBeInstanceOf(MockYDoc);
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
  });
});

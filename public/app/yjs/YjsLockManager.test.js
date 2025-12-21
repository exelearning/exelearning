// Test functions available globally from vitest setup
/**
 * YjsLockManager Tests
 *
 * Unit tests for YjsLockManager - handles iDevice-level locking for collaborative editing.
 *
 */

 

const YjsLockManager = require('./YjsLockManager');

// Mock Awareness
class MockAwareness {
  constructor() {
    this._listeners = {};
    this._localState = { user: { name: 'Test User', color: '#ff0000' } };
  }

  getLocalState() {
    return this._localState;
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

  emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach((callback) => callback(data));
    }
  }
}

describe('YjsLockManager', () => {
  let lockManager;
  let mockYDoc;
  let mockAwareness;

  beforeEach(() => {
    vi.useFakeTimers();

    mockYDoc = new window.Y.Doc();
    mockAwareness = new MockAwareness();
    lockManager = new YjsLockManager(mockYDoc, mockAwareness);

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (lockManager) {
      lockManager.destroy();
    }
  });

  describe('constructor', () => {
    test('initializes with ydoc and awareness', () => {
      expect(lockManager.ydoc).toBe(mockYDoc);
      expect(lockManager.awareness).toBe(mockAwareness);
    });

    test('initializes locks map from ydoc', () => {
      expect(lockManager.locks).toBeInstanceOf(window.Y.Map);
    });

    test('initializes empty myLocks set', () => {
      expect(lockManager.myLocks).toBeInstanceOf(Set);
      expect(lockManager.myLocks.size).toBe(0);
    });

    test('sets up cleanup interval', () => {
      expect(lockManager.cleanupInterval).toBeDefined();
    });

    test('works without awareness', () => {
      const manager = new YjsLockManager(mockYDoc, null);
      expect(manager.awareness).toBeNull();
      manager.destroy();
    });
  });

  describe('getClientId', () => {
    test('returns client ID as string', () => {
      const clientId = lockManager.getClientId();
      expect(clientId).toBe(String(mockYDoc.clientID));
      expect(typeof clientId).toBe('string');
    });
  });

  describe('getCurrentUser', () => {
    test('returns user from awareness', () => {
      const user = lockManager.getCurrentUser();
      expect(user.name).toBe('Test User');
      expect(user.color).toBe('#ff0000');
    });

    test('returns default user when no awareness', () => {
      lockManager.awareness = null;
      const user = lockManager.getCurrentUser();
      expect(user.name).toBe('Unknown');
      expect(user.color).toBe('#999');
    });

    test('returns default user when awareness has no state', () => {
      mockAwareness._localState = null;
      const user = lockManager.getCurrentUser();
      expect(user.name).toBe('Unknown');
    });
  });

  describe('requestLock', () => {
    test('acquires lock on unlocked component', () => {
      const result = lockManager.requestLock('component-123');
      expect(result).toBe(true);
    });

    test('stores lock info in locks map', () => {
      lockManager.requestLock('component-123');

      const lock = lockManager.locks.get('component-123');
      expect(lock).toBeDefined();
      expect(lock.componentId).toBe('component-123');
      expect(lock.clientId).toBe(String(mockYDoc.clientID));
      expect(lock.user.name).toBe('Test User');
      expect(lock.timestamp).toBeDefined();
    });

    test('adds component to myLocks', () => {
      lockManager.requestLock('component-123');
      expect(lockManager.myLocks.has('component-123')).toBe(true);
    });

    test('allows acquiring same lock twice', () => {
      lockManager.requestLock('component-123');
      const result = lockManager.requestLock('component-123');
      expect(result).toBe(true);
    });

    test('denies lock when locked by another user', () => {
      // Simulate another user's lock
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999', // Different client
        user: { name: 'Other User' },
        timestamp: Date.now(),
      });

      const result = lockManager.requestLock('component-123');
      expect(result).toBe(false);
    });

    test('overrides stale lock from another user', () => {
      // Simulate a stale lock (older than timeout)
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now() - YjsLockManager.LOCK_TIMEOUT_MS - 1000,
      });

      const result = lockManager.requestLock('component-123');
      expect(result).toBe(true);
    });
  });

  describe('releaseLock', () => {
    test('releases own lock', () => {
      lockManager.requestLock('component-123');
      expect(lockManager.locks.get('component-123')).toBeDefined();

      lockManager.releaseLock('component-123');
      expect(lockManager.locks.get('component-123')).toBeUndefined();
    });

    test('removes from myLocks', () => {
      lockManager.requestLock('component-123');
      lockManager.releaseLock('component-123');
      expect(lockManager.myLocks.has('component-123')).toBe(false);
    });

    test('does not release lock owned by another user', () => {
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now(),
      });

      lockManager.releaseLock('component-123');
      // Lock should still exist
      expect(lockManager.locks.get('component-123')).toBeDefined();
    });

    test('handles releasing non-existent lock', () => {
      // Should not throw
      lockManager.releaseLock('non-existent');
    });
  });

  describe('releaseAllMyLocks', () => {
    test('releases all locks held by this client', () => {
      lockManager.requestLock('component-1');
      lockManager.requestLock('component-2');
      lockManager.requestLock('component-3');

      lockManager.releaseAllMyLocks();

      expect(lockManager.locks.get('component-1')).toBeUndefined();
      expect(lockManager.locks.get('component-2')).toBeUndefined();
      expect(lockManager.locks.get('component-3')).toBeUndefined();
    });

    test('clears myLocks set', () => {
      lockManager.requestLock('component-1');
      lockManager.requestLock('component-2');

      lockManager.releaseAllMyLocks();

      expect(lockManager.myLocks.size).toBe(0);
    });

    test('does not release locks owned by others', () => {
      lockManager.requestLock('component-1');

      // Add lock from another user
      lockManager.locks.set('component-2', {
        componentId: 'component-2',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now(),
      });

      lockManager.releaseAllMyLocks();

      expect(lockManager.locks.get('component-1')).toBeUndefined();
      expect(lockManager.locks.get('component-2')).toBeDefined();
    });
  });

  describe('isLocked', () => {
    test('returns false for unlocked component', () => {
      expect(lockManager.isLocked('component-123')).toBe(false);
    });

    test('returns false for component locked by self', () => {
      lockManager.requestLock('component-123');
      expect(lockManager.isLocked('component-123')).toBe(false);
    });

    test('returns true for component locked by another user', () => {
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now(),
      });

      expect(lockManager.isLocked('component-123')).toBe(true);
    });

    test('returns false for stale lock from another user', () => {
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now() - YjsLockManager.LOCK_TIMEOUT_MS - 1000,
      });

      expect(lockManager.isLocked('component-123')).toBe(false);
    });
  });

  describe('isLockedByMe', () => {
    test('returns falsy for unlocked component', () => {
      expect(lockManager.isLockedByMe('component-123')).toBeFalsy();
    });

    test('returns true for component locked by self', () => {
      lockManager.requestLock('component-123');
      expect(lockManager.isLockedByMe('component-123')).toBe(true);
    });

    test('returns false for component locked by another user', () => {
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now(),
      });

      expect(lockManager.isLockedByMe('component-123')).toBe(false);
    });
  });

  describe('getLockInfo', () => {
    test('returns null for unlocked component', () => {
      expect(lockManager.getLockInfo('component-123')).toBeNull();
    });

    test('returns lock info for locked component', () => {
      lockManager.requestLock('component-123');
      const info = lockManager.getLockInfo('component-123');

      expect(info).toBeDefined();
      expect(info.componentId).toBe('component-123');
      expect(info.clientId).toBe(String(mockYDoc.clientID));
    });

    test('returns null for stale lock', () => {
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now() - YjsLockManager.LOCK_TIMEOUT_MS - 1000,
      });

      expect(lockManager.getLockInfo('component-123')).toBeNull();
    });
  });

  describe('getAllLocks', () => {
    test('returns empty array when no locks', () => {
      expect(lockManager.getAllLocks()).toEqual([]);
    });

    test('returns all active locks', () => {
      lockManager.requestLock('component-1');
      lockManager.requestLock('component-2');

      const locks = lockManager.getAllLocks();
      expect(locks).toHaveLength(2);
    });

    test('excludes stale locks', () => {
      lockManager.requestLock('component-1');

      // Add stale lock
      lockManager.locks.set('component-2', {
        componentId: 'component-2',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now() - YjsLockManager.LOCK_TIMEOUT_MS - 1000,
      });

      const locks = lockManager.getAllLocks();
      expect(locks).toHaveLength(1);
      expect(locks[0].componentId).toBe('component-1');
    });
  });

  describe('isLockStale', () => {
    test('returns true for null lock', () => {
      expect(lockManager.isLockStale(null)).toBe(true);
    });

    test('returns true for lock without timestamp', () => {
      expect(lockManager.isLockStale({})).toBe(true);
    });

    test('returns false for recent lock', () => {
      const lock = { timestamp: Date.now() };
      expect(lockManager.isLockStale(lock)).toBe(false);
    });

    test('returns true for lock older than timeout', () => {
      const lock = { timestamp: Date.now() - YjsLockManager.LOCK_TIMEOUT_MS - 1000 };
      expect(lockManager.isLockStale(lock)).toBe(true);
    });

    test('returns false for lock at exactly timeout', () => {
      const lock = { timestamp: Date.now() - YjsLockManager.LOCK_TIMEOUT_MS };
      // At exactly timeout, not stale yet (uses >)
      expect(lockManager.isLockStale(lock)).toBe(false);
    });
  });

  describe('handleAwarenessChange', () => {
    test('does nothing for empty removed list', () => {
      lockManager.requestLock('component-123');
      lockManager.handleAwarenessChange([]);
      expect(lockManager.locks.get('component-123')).toBeDefined();
    });

    test('does nothing for null removed list', () => {
      lockManager.requestLock('component-123');
      lockManager.handleAwarenessChange(null);
      expect(lockManager.locks.get('component-123')).toBeDefined();
    });

    test('releases locks for disconnected users', () => {
      // Add lock from a user that will disconnect
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now(),
      });

      lockManager.handleAwarenessChange([99999]);

      expect(lockManager.locks.get('component-123')).toBeUndefined();
    });

    test('does not release locks for still-connected users', () => {
      lockManager.requestLock('component-123');
      lockManager.handleAwarenessChange([99999]); // Different client

      expect(lockManager.locks.get('component-123')).toBeDefined();
    });
  });

  describe('cleanupStaleLocks', () => {
    test('removes stale locks', () => {
      // Add stale lock
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: Date.now() - YjsLockManager.LOCK_TIMEOUT_MS - 1000,
      });

      lockManager.cleanupStaleLocks();

      expect(lockManager.locks.get('component-123')).toBeUndefined();
    });

    test('keeps fresh locks', () => {
      lockManager.requestLock('component-123');
      lockManager.cleanupStaleLocks();

      expect(lockManager.locks.get('component-123')).toBeDefined();
    });

    test('removes stale lock from myLocks', () => {
      lockManager.requestLock('component-123');

      // Make it stale by modifying timestamp
      const lock = lockManager.locks.get('component-123');
      lock.timestamp = Date.now() - YjsLockManager.LOCK_TIMEOUT_MS - 1000;
      lockManager.locks.set('component-123', lock);

      lockManager.cleanupStaleLocks();

      expect(lockManager.myLocks.has('component-123')).toBe(false);
    });

    test('is called periodically', () => {
      const cleanupSpy = spyOn(lockManager, 'cleanupStaleLocks');

      // Fast forward 60 seconds to trigger the interval
      vi.advanceTimersByTime(60000);

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('refreshLock', () => {
    test('updates timestamp for own lock', () => {
      lockManager.requestLock('component-123');
      const originalTimestamp = lockManager.locks.get('component-123').timestamp;

      // Advance time so the new timestamp will be different
      vi.advanceTimersByTime(1000);
      lockManager.refreshLock('component-123');

      const newTimestamp = lockManager.locks.get('component-123').timestamp;
      expect(newTimestamp).toBeGreaterThan(originalTimestamp);
    });

    test('does nothing for lock owned by another user', () => {
      lockManager.locks.set('component-123', {
        componentId: 'component-123',
        clientId: '99999',
        user: { name: 'Other User' },
        timestamp: 1000,
      });

      lockManager.refreshLock('component-123');

      expect(lockManager.locks.get('component-123').timestamp).toBe(1000);
    });

    test('does nothing for non-existent lock', () => {
      // Should not throw
      lockManager.refreshLock('non-existent');
    });
  });

  describe('destroy', () => {
    test('releases all locks', () => {
      lockManager.requestLock('component-1');
      lockManager.requestLock('component-2');

      lockManager.destroy();

      expect(lockManager.locks.get('component-1')).toBeUndefined();
      expect(lockManager.locks.get('component-2')).toBeUndefined();
    });

    test('clears cleanup interval', () => {
      const clearIntervalSpy = spyOn(global, 'clearInterval');
      const intervalId = lockManager.cleanupInterval;

      lockManager.destroy();

      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });
  });

  describe('LOCK_TIMEOUT_MS', () => {
    test('is 5 minutes', () => {
      expect(YjsLockManager.LOCK_TIMEOUT_MS).toBe(5 * 60 * 1000);
    });
  });
});

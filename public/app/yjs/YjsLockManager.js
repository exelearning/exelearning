/**
 * YjsLockManager
 * Handles iDevice-level locking for collaborative editing.
 * Uses Yjs document to store locks and Awareness for presence.
 *
 * Lock semantics:
 * - When a user starts editing an iDevice, they acquire a lock
 * - Other users see the component as locked (can view but not edit)
 * - Lock is released when editing stops or user disconnects
 * - Locks auto-expire after LOCK_TIMEOUT_MS (5 minutes)
 */
class YjsLockManager {
  static LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * @param {Y.Doc} ydoc - The Yjs document
   * @param {Awareness} awareness - The Yjs awareness instance (optional)
   */
  constructor(ydoc, awareness = null) {
    this.ydoc = ydoc;
    this.awareness = awareness;
    this.locks = ydoc.getMap('locks');
    this.myLocks = new Set();

    // Setup awareness change handler for auto-releasing locks
    if (awareness) {
      awareness.on('change', ({ removed }) => {
        this.handleAwarenessChange(removed);
      });
    }

    // Cleanup stale locks periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleLocks();
    }, 60000); // Every minute

    Logger.log('[YjsLockManager] Initialized');
  }

  /**
   * Get the current client ID
   */
  getClientId() {
    return this.ydoc.clientID.toString();
  }

  /**
   * Get current user info from awareness
   */
  getCurrentUser() {
    if (!this.awareness) {
      return { name: 'Unknown', color: '#999' };
    }
    const state = this.awareness.getLocalState();
    return state?.user || { name: 'Unknown', color: '#999' };
  }

  /**
   * Request a lock on a component
   * @param {string} componentId
   * @returns {boolean} - true if lock acquired, false if locked by another user
   */
  requestLock(componentId) {
    const existingLock = this.locks.get(componentId);

    // Check if locked by another user
    if (existingLock && existingLock.clientId !== this.getClientId()) {
      // Check if lock is stale
      if (this.isLockStale(existingLock)) {
        Logger.log(`[YjsLockManager] Overriding stale lock on ${componentId}`);
      } else {
        Logger.log(`[YjsLockManager] Cannot lock ${componentId}: locked by ${existingLock.user.name}`);
        return false;
      }
    }

    // Acquire lock
    const lockInfo = {
      componentId,
      clientId: this.getClientId(),
      user: this.getCurrentUser(),
      timestamp: Date.now(),
    };

    this.locks.set(componentId, lockInfo);
    this.myLocks.add(componentId);

    Logger.log(`[YjsLockManager] Acquired lock on ${componentId}`);
    return true;
  }

  /**
   * Release a lock on a component
   * @param {string} componentId
   */
  releaseLock(componentId) {
    const lock = this.locks.get(componentId);

    // Only release if we own the lock
    if (lock && lock.clientId === this.getClientId()) {
      this.locks.delete(componentId);
      this.myLocks.delete(componentId);
      Logger.log(`[YjsLockManager] Released lock on ${componentId}`);
    }
  }

  /**
   * Release all locks held by this client
   */
  releaseAllMyLocks() {
    for (const componentId of this.myLocks) {
      const lock = this.locks.get(componentId);
      if (lock && lock.clientId === this.getClientId()) {
        this.locks.delete(componentId);
      }
    }
    this.myLocks.clear();
    Logger.log('[YjsLockManager] Released all my locks');
  }

  /**
   * Check if a component is locked by another user
   * @param {string} componentId
   * @returns {boolean}
   */
  isLocked(componentId) {
    const lock = this.locks.get(componentId);
    if (!lock) return false;
    if (lock.clientId === this.getClientId()) return false;
    if (this.isLockStale(lock)) return false;
    return true;
  }

  /**
   * Check if a component is locked by the current user
   * @param {string} componentId
   * @returns {boolean}
   */
  isLockedByMe(componentId) {
    const lock = this.locks.get(componentId);
    return lock && lock.clientId === this.getClientId();
  }

  /**
   * Get lock info for a component
   * @param {string} componentId
   * @returns {Object|null}
   */
  getLockInfo(componentId) {
    const lock = this.locks.get(componentId);
    if (!lock) return null;
    if (this.isLockStale(lock)) return null;
    return lock;
  }

  /**
   * Get all currently locked components
   * @returns {Array} - Array of { componentId, lock }
   */
  getAllLocks() {
    const result = [];
    this.locks.forEach((lock, componentId) => {
      if (!this.isLockStale(lock)) {
        result.push({ componentId, lock });
      }
    });
    return result;
  }

  /**
   * Check if a lock is stale (expired)
   * @param {Object} lock
   * @returns {boolean}
   */
  isLockStale(lock) {
    if (!lock || !lock.timestamp) return true;
    return Date.now() - lock.timestamp > YjsLockManager.LOCK_TIMEOUT_MS;
  }

  /**
   * Handle awareness change (user left)
   * Release locks for disconnected users
   * @param {Array} removedClientIds
   */
  handleAwarenessChange(removedClientIds) {
    if (!removedClientIds || removedClientIds.length === 0) return;

    const removedSet = new Set(removedClientIds.map(String));

    this.locks.forEach((lock, componentId) => {
      if (removedSet.has(lock.clientId)) {
        Logger.log(`[YjsLockManager] Auto-releasing lock on ${componentId} (user disconnected)`);
        this.locks.delete(componentId);
      }
    });
  }

  /**
   * Clean up stale locks (expired due to timeout)
   */
  cleanupStaleLocks() {
    const now = Date.now();
    let cleaned = 0;

    this.locks.forEach((lock, componentId) => {
      if (this.isLockStale(lock)) {
        this.locks.delete(componentId);
        this.myLocks.delete(componentId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      Logger.log(`[YjsLockManager] Cleaned up ${cleaned} stale locks`);
    }
  }

  /**
   * Refresh a lock timestamp (keep-alive)
   * @param {string} componentId
   */
  refreshLock(componentId) {
    const lock = this.locks.get(componentId);
    if (lock && lock.clientId === this.getClientId()) {
      lock.timestamp = Date.now();
      this.locks.set(componentId, lock);
    }
  }

  /**
   * Destroy the lock manager
   */
  destroy() {
    this.releaseAllMyLocks();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    Logger.log('[YjsLockManager] Destroyed');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YjsLockManager;
} else {
  window.YjsLockManager = YjsLockManager;
}

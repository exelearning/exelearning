/**
 * ProjectTabTracker
 * Tracks browser tabs for a project and triggers cleanup when last tab closes.
 * Uses BroadcastChannel for real-time communication and localStorage for persistence.
 *
 * Features:
 * - Detects when all tabs for a project are closed
 * - Distinguishes between page refresh (no cleanup) and tab close (cleanup)
 * - Handles browser crashes via stale entry cleanup
 * - Supports multiple projects independently
 *
 * Usage:
 *   const tracker = new ProjectTabTracker(projectId, () => {
 *     // Cleanup IndexedDB and Cache API here
 *   });
 *   tracker.start();
 *   // Later...
 *   tracker.stop();
 */
class ProjectTabTracker {
  /**
   * @param {string} projectId - The project ID to track
   * @param {Function} onLastTabClosed - Callback when last tab closes
   * @param {Object} options - Configuration options
   * @param {number} [options.heartbeatInterval=5000] - Heartbeat interval in ms
   * @param {number} [options.staleThreshold=15000] - Threshold for stale entries in ms
   * @param {string} [options.cleanupFlagKey] - localStorage key the callback sets
   *        when this was the last tab. Other live tabs clear it.
   */
  constructor(projectId, onLastTabClosed, options = {}) {
    this.projectId = projectId;
    this.tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.onLastTabClosed = onLastTabClosed;

    this.channelName = `exe-project-tabs-${projectId}`;
    this.storageKey = `exe-tabs-${projectId}`;

    this.heartbeatInterval = options.heartbeatInterval || 5000; // 5 seconds
    this.staleThreshold = options.staleThreshold || 15000; // 15 seconds
    this.cleanupFlagKey = options.cleanupFlagKey || null;

    this._intervalId = null;
    this._channel = null;
    this._started = false;
    this._cleanupToken = 0;
    this._revokeTimer = null;
    this._boundBeforeUnload = this._handleBeforeUnload.bind(this);
    this._boundPageHide = this._handlePageHide.bind(this);
    this._boundMessage = this._handleMessage.bind(this);
    this._boundStorage = this._handleStorage.bind(this);
  }

  /**
   * Start tracking this tab
   */
  start() {
    if (this._started) {
      return;
    }

    // Create BroadcastChannel if supported
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this._channel = new BroadcastChannel(this.channelName);
        this._channel.onmessage = this._boundMessage;
      } catch (e) {
        console.warn('[ProjectTabTracker] BroadcastChannel not available:', e);
      }
    }

    // Clean stale entries from previous sessions (browser crash recovery)
    this._cleanStaleEntries();

    // Register this tab
    this._sendHeartbeat();

    // Start heartbeat interval
    this._intervalId = setInterval(() => {
      this._sendHeartbeat();
      this._cleanStaleEntries();
    }, this.heartbeatInterval);

    // Listen for tab close
    window.addEventListener('beforeunload', this._boundBeforeUnload);
    window.addEventListener('pagehide', this._boundPageHide);
    if (this.cleanupFlagKey) {
      window.addEventListener('storage', this._boundStorage);
    }

    // Broadcast presence to other tabs
    if (this._channel) {
      this._channel.postMessage({ type: 'TAB_OPENED', tabId: this.tabId });
    }

    this._started = true;
    Logger.log(`[ProjectTabTracker] Started tracking tab ${this.tabId.substring(0, 8)}... for project ${this.projectId}`);
  }

  /**
   * Stop tracking this tab
   */
  stop() {
    if (!this._started) {
      return;
    }

    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }

    this._cleanupToken += 1;
    if (this._revokeTimer) {
      clearTimeout(this._revokeTimer);
      this._revokeTimer = null;
    }

    if (this._channel) {
      try {
        this._channel.postMessage({ type: 'TAB_CLOSING', tabId: this.tabId });
        this._channel.close();
      } catch (e) {
        // Channel might already be closed
      }
      this._channel = null;
    }

    window.removeEventListener('beforeunload', this._boundBeforeUnload);
    window.removeEventListener('pagehide', this._boundPageHide);
    if (this.cleanupFlagKey) {
      window.removeEventListener('storage', this._boundStorage);
    }

    this._removeFromStorage();
    this._started = false;

    Logger.log(`[ProjectTabTracker] Stopped tracking tab ${this.tabId.substring(0, 8)}...`);
  }

  /**
   * Check if this is the last tab for the project
   * @returns {boolean}
   */
  isLastTab() {
    this._cleanStaleEntries();
    const tabs = this._getTabsFromStorage();
    return Object.keys(tabs).length <= 1;
  }

  /**
   * Get the count of active tabs
   * @returns {number}
   */
  getTabCount() {
    this._cleanStaleEntries();
    const tabs = this._getTabsFromStorage();
    return Object.keys(tabs).length;
  }

  /**
   * Send a heartbeat to mark this tab as active
   * @private
   */
  _sendHeartbeat() {
    const tabs = this._getTabsFromStorage();
    tabs[this.tabId] = Date.now();
    this._saveTabsToStorage(tabs);
  }

  /**
   * Clean stale entries that haven't sent heartbeat
   * @private
   */
  _cleanStaleEntries() {
    const tabs = this._getTabsFromStorage();
    const now = Date.now();
    let changed = false;

    for (const [tabId, timestamp] of Object.entries(tabs)) {
      if (now - timestamp > this.staleThreshold) {
        delete tabs[tabId];
        changed = true;
        Logger.log(`[ProjectTabTracker] Cleaned stale tab: ${tabId.substring(0, 8)}...`);
      }
    }

    if (changed) {
      this._saveTabsToStorage(tabs);
    }
  }

  /**
   * Get tabs data from localStorage
   * @returns {Object} Map of tabId -> timestamp
   * @private
   */
  _getTabsFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save tabs data to localStorage
   * @param {Object} tabs - Map of tabId -> timestamp
   * @private
   */
  _saveTabsToStorage(tabs) {
    try {
      if (Object.keys(tabs).length === 0) {
        localStorage.removeItem(this.storageKey);
      } else {
        localStorage.setItem(this.storageKey, JSON.stringify(tabs));
      }
    } catch {
      // localStorage might be full or disabled
    }
  }

  /**
   * Remove this tab from storage
   * @private
   */
  _removeFromStorage() {
    const tabs = this._getTabsFromStorage();
    delete tabs[this.tabId];
    this._saveTabsToStorage(tabs);
  }

  /**
   * Check if current navigation is a page refresh
   * @returns {boolean}
   * @private
   */
  _isRefresh() {
    // Modern Navigation Timing API (PerformanceNavigationTiming)
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const entries = performance.getEntriesByType('navigation');
      if (entries && entries.length > 0 && entries[0].type === 'reload') {
        return true;
      }
    }

    // Legacy Navigation Timing API (deprecated but still supported)
    if (typeof performance !== 'undefined' && performance.navigation) {
      // type 1 = reload
      if (performance.navigation.type === 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Handle beforeunload event
   * @private
   */
  _handleBeforeUnload() {
    // Don't cleanup on refresh - the page will reload with same data
    if (this._isRefresh()) {
      Logger.log('[ProjectTabTracker] Page refresh detected, skipping cleanup');
      return;
    }

    this._triggerCleanupIfLastTab();
  }

  /**
   * Handle pagehide event
   * @param {PageTransitionEvent} event
   * @private
   */
  _handlePageHide(event) {
    // pagehide with persisted=false means page is being discarded
    // persisted=true means page is going into bfcache (back-forward cache)
    if (!event.persisted && !this._isRefresh()) {
      this._triggerCleanupIfLastTab();
    }
  }

  /**
   * Trigger cleanup if this is the last tab
   * @private
   */
  _triggerCleanupIfLastTab() {
    // Remove ourselves first
    this._removeFromStorage();

    // Clean any stale entries
    this._cleanStaleEntries();

    // Check remaining tabs
    const tabs = this._getTabsFromStorage();

    if (Object.keys(tabs).length === 0) {
      // We were the last tab - trigger cleanup
      Logger.log(`[ProjectTabTracker] Last tab closed for project ${this.projectId}, triggering cleanup`);

      if (this.onLastTabClosed) {
        try {
          this.onLastTabClosed();
        } catch (e) {
          console.error('[ProjectTabTracker] Cleanup callback error:', e);
        }
      }
      // Firefox can deliver pagehide to a tab that stays open (another tab in
      // the same window just closed). A real close hides the document first,
      // so a still-visible page must undo the flag and register itself again.
      this._revokeCleanupIfStillVisible();
    } else {
      Logger.log(`[ProjectTabTracker] Tab closed, ${Object.keys(tabs).length} tab(s) remaining`);
    }
  }

  /**
   * Undo a last-tab cleanup when this document is still on screen.
   * No-op unless a cleanup flag key was configured. forceCleanup() does not
   * come through here: an explicit cleanup must keep the flag.
   * @private
   */
  _revokeCleanupIfStillVisible() {
    if (!this.cleanupFlagKey) return;

    const token = ++this._cleanupToken;
    this._revokeTimer = setTimeout(() => {
      this._revokeTimer = null;
      if (token !== this._cleanupToken || !this._started) return;
      const visibility = typeof document !== 'undefined' ? document.visibilityState : 'visible';
      if (visibility && visibility !== 'visible') return;

      try {
        localStorage.removeItem(this.cleanupFlagKey);
      } catch {
        // localStorage might be full or disabled
      }
      this._sendHeartbeat();
      Logger.log(`[ProjectTabTracker] Page still visible after unload, kept project ${this.projectId}`);
    }, 0);
  }

  /**
   * A sibling tab wrote the cleanup flag. This tab is still open, so the
   * project must not be wiped on the next load.
   * @param {StorageEvent} event
   * @private
   */
  _handleStorage(event) {
    if (!this._started || !this.cleanupFlagKey || !event) return;
    if (event.key !== this.cleanupFlagKey || event.newValue !== 'true') return;

    try {
      localStorage.removeItem(this.cleanupFlagKey);
    } catch {
      // localStorage might be full or disabled
    }
    this._sendHeartbeat();
    Logger.log(`[ProjectTabTracker] Cleared cleanup flag for project ${this.projectId}; this tab is still open`);
  }

  /**
   * Handle BroadcastChannel messages
   * @param {MessageEvent} event
   * @private
   */
  _handleMessage(event) {
    const { type, tabId } = event.data || {};

    if (type === 'TAB_CLOSING' && tabId !== this.tabId) {
      // Another tab is closing, clean stale entries after a brief delay
      setTimeout(() => this._cleanStaleEntries(), 100);
    }

    if (type === 'TAB_OPENED' && tabId !== this.tabId) {
      // Another tab opened, send heartbeat to register ourselves
      this._sendHeartbeat();
    }
  }

  /**
   * Force cleanup (for testing or manual cleanup)
   */
  forceCleanup() {
    Logger.log(`[ProjectTabTracker] Force cleanup triggered for project ${this.projectId}`);
    if (this.onLastTabClosed) {
      this.onLastTabClosed();
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProjectTabTracker;
} else {
  window.ProjectTabTracker = ProjectTabTracker;
}

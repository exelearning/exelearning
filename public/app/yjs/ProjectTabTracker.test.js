/**
 * ProjectTabTracker Tests
 *
 * Unit tests for ProjectTabTracker - tracks browser tabs and triggers cleanup
 * when the last tab for a project is closed.
 */

const ProjectTabTracker = require('./ProjectTabTracker');

// Mock localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value;
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

// Mock BroadcastChannel
class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    this._closed = false;
    MockBroadcastChannel._instances.push(this);
  }

  postMessage(data) {
    if (this._closed) return;
    // Deliver to other channels with same name
    for (const channel of MockBroadcastChannel._instances) {
      if (channel !== this && channel.name === this.name && !channel._closed && channel.onmessage) {
        setTimeout(() => {
          channel.onmessage({ data });
        }, 0);
      }
    }
  }

  close() {
    this._closed = true;
    const index = MockBroadcastChannel._instances.indexOf(this);
    if (index > -1) {
      MockBroadcastChannel._instances.splice(index, 1);
    }
  }

  static _instances = [];

  static reset() {
    MockBroadcastChannel._instances = [];
  }
}

// Mock performance API
const mockPerformance = {
  navigation: { type: 0 },
  getEntriesByType: () => [{ type: 'navigate' }],
};

describe('ProjectTabTracker', () => {
  let mockLocalStorage;
  let originalLocalStorage;
  let originalBroadcastChannel;
  let originalPerformance;
  let addEventListenerSpy;
  let removeEventListenerSpy;
  let originalLogger;

  beforeEach(() => {
    // Setup mock localStorage
    mockLocalStorage = new MockLocalStorage();
    originalLocalStorage = global.localStorage;
    global.localStorage = mockLocalStorage;

    // Setup mock BroadcastChannel
    MockBroadcastChannel.reset();
    originalBroadcastChannel = global.BroadcastChannel;
    global.BroadcastChannel = MockBroadcastChannel;

    // Setup mock performance
    originalPerformance = global.performance;
    global.performance = mockPerformance;

    // Setup mock window event listeners
    addEventListenerSpy = vi.fn();
    removeEventListenerSpy = vi.fn();
    global.window = {
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    };

    // Mock Logger
    originalLogger = global.Logger;
    global.Logger = { log: vi.fn() };
  });

  afterEach(() => {
    global.localStorage = originalLocalStorage;
    global.BroadcastChannel = originalBroadcastChannel;
    global.performance = originalPerformance;
    global.Logger = originalLogger;
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create tracker with default options', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      expect(tracker.projectId).toBe('project-123');
      expect(tracker.tabId).toMatch(/^\d+-[a-z0-9]+$/);
      expect(tracker.channelName).toBe('exe-project-tabs-project-123');
      expect(tracker.storageKey).toBe('exe-tabs-project-123');
      expect(tracker.heartbeatInterval).toBe(5000);
      expect(tracker.staleThreshold).toBe(15000);
    });

    it('should accept custom options', () => {
      const tracker = new ProjectTabTracker('project-123', () => {}, {
        heartbeatInterval: 1000,
        staleThreshold: 5000,
      });

      expect(tracker.heartbeatInterval).toBe(1000);
      expect(tracker.staleThreshold).toBe(5000);
    });

    it('should store the callback function', () => {
      const callback = vi.fn();
      const tracker = new ProjectTabTracker('project-123', callback);

      expect(tracker.onLastTabClosed).toBe(callback);
    });
  });

  describe('start()', () => {
    it('should create BroadcastChannel and register tab', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();

      // Should have created BroadcastChannel
      expect(MockBroadcastChannel._instances.length).toBe(1);
      expect(MockBroadcastChannel._instances[0].name).toBe('exe-project-tabs-project-123');

      // Should have registered in localStorage
      const tabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'));
      expect(tabs[tracker.tabId]).toBeDefined();
      expect(typeof tabs[tracker.tabId]).toBe('number');

      tracker.stop();
    });

    it('should add event listeners', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();

      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));

      tracker.stop();
    });

    it('should not start twice', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();
      tracker.start();

      // Should only have one channel
      expect(MockBroadcastChannel._instances.length).toBe(1);

      tracker.stop();
    });

    it('should broadcast TAB_OPENED message', async () => {
      const tracker1 = new ProjectTabTracker('project-123', () => {});
      tracker1.start();

      const messageHandler = vi.fn();
      const tracker2 = new ProjectTabTracker('project-123', () => {});
      tracker2.start();
      tracker2._channel.onmessage = messageHandler;

      // Send message from tracker1
      tracker1._channel.postMessage({ type: 'TAB_OPENED', tabId: tracker1.tabId });

      await new Promise((r) => setTimeout(r, 10));

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { type: 'TAB_OPENED', tabId: tracker1.tabId },
        })
      );

      tracker1.stop();
      tracker2.stop();
    });
  });

  describe('stop()', () => {
    it('should cleanup resources', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();
      tracker.stop();

      // Should have removed event listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));

      // Should have removed from localStorage
      const tabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123') || '{}');
      expect(tabs[tracker.tabId]).toBeUndefined();
    });

    it('should close BroadcastChannel', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();

      const channel = tracker._channel;
      tracker.stop();

      expect(channel._closed).toBe(true);
    });

    it('should not error when stopped without starting', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      expect(() => tracker.stop()).not.toThrow();
    });
  });

  describe('isLastTab()', () => {
    it('should return true when only one tab exists', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();

      expect(tracker.isLastTab()).toBe(true);

      tracker.stop();
    });

    it('should return false when multiple tabs exist', () => {
      const tracker1 = new ProjectTabTracker('project-123', () => {});
      tracker1.start();

      const tracker2 = new ProjectTabTracker('project-123', () => {});
      tracker2.start();

      expect(tracker1.isLastTab()).toBe(false);
      expect(tracker2.isLastTab()).toBe(false);

      tracker1.stop();
      tracker2.stop();
    });

    it('should return true after other tab closes', () => {
      const tracker1 = new ProjectTabTracker('project-123', () => {});
      tracker1.start();

      const tracker2 = new ProjectTabTracker('project-123', () => {});
      tracker2.start();

      expect(tracker1.isLastTab()).toBe(false);

      tracker2.stop();

      expect(tracker1.isLastTab()).toBe(true);

      tracker1.stop();
    });
  });

  describe('getTabCount()', () => {
    it('should return correct count of active tabs', () => {
      const tracker1 = new ProjectTabTracker('project-123', () => {});
      tracker1.start();
      expect(tracker1.getTabCount()).toBe(1);

      const tracker2 = new ProjectTabTracker('project-123', () => {});
      tracker2.start();
      expect(tracker1.getTabCount()).toBe(2);

      tracker2.stop();
      expect(tracker1.getTabCount()).toBe(1);

      tracker1.stop();
    });
  });

  describe('stale entry cleanup', () => {
    it('should clean stale entries on start', () => {
      // Manually add a stale entry
      const staleTime = Date.now() - 20000; // 20 seconds ago
      mockLocalStorage.setItem('exe-tabs-project-123', JSON.stringify({
        'stale-tab-123': staleTime,
      }));

      const tracker = new ProjectTabTracker('project-123', () => {}, {
        staleThreshold: 15000,
      });
      tracker.start();

      const tabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'));
      expect(tabs['stale-tab-123']).toBeUndefined();
      expect(tabs[tracker.tabId]).toBeDefined();

      tracker.stop();
    });

    it('should clean stale entries during heartbeat', () => {
      vi.useFakeTimers();

      const tracker = new ProjectTabTracker('project-123', () => {}, {
        heartbeatInterval: 1000,
        staleThreshold: 2000,
      });
      tracker.start();

      // Add another tab that will become stale
      const tabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'));
      tabs['other-tab'] = Date.now();
      mockLocalStorage.setItem('exe-tabs-project-123', JSON.stringify(tabs));

      // Advance time past stale threshold
      vi.advanceTimersByTime(3000);

      const updatedTabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'));
      expect(updatedTabs['other-tab']).toBeUndefined();
      expect(updatedTabs[tracker.tabId]).toBeDefined();

      tracker.stop();
    });
  });

  describe('refresh detection', () => {
    it('should detect page refresh via Navigation Timing API', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      // Mock reload navigation
      global.performance = {
        navigation: { type: 1 },
        getEntriesByType: () => [{ type: 'reload' }],
      };

      expect(tracker._isRefresh()).toBe(true);
    });

    it('should detect non-refresh navigation', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      global.performance = {
        navigation: { type: 0 },
        getEntriesByType: () => [{ type: 'navigate' }],
      };

      expect(tracker._isRefresh()).toBe(false);
    });

    it('should handle missing performance API', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      global.performance = undefined;

      expect(tracker._isRefresh()).toBe(false);
    });
  });

  describe('onLastTabClosed callback', () => {
    it('should fire callback when last tab closes', () => {
      const callback = vi.fn();
      const tracker = new ProjectTabTracker('project-123', callback);
      tracker.start();

      // Simulate beforeunload (non-refresh)
      global.performance = {
        navigation: { type: 0 },
        getEntriesByType: () => [{ type: 'navigate' }],
      };

      tracker._handleBeforeUnload();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should NOT fire callback on refresh', () => {
      const callback = vi.fn();
      const tracker = new ProjectTabTracker('project-123', callback);
      tracker.start();

      // Simulate refresh
      global.performance = {
        navigation: { type: 1 },
        getEntriesByType: () => [{ type: 'reload' }],
      };

      tracker._handleBeforeUnload();

      expect(callback).not.toHaveBeenCalled();

      tracker.stop();
    });

    it('should NOT fire callback when other tabs exist', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const tracker1 = new ProjectTabTracker('project-123', callback1);
      tracker1.start();

      const tracker2 = new ProjectTabTracker('project-123', callback2);
      tracker2.start();

      // Simulate tracker1 closing (non-refresh)
      global.performance = {
        navigation: { type: 0 },
        getEntriesByType: () => [{ type: 'navigate' }],
      };

      tracker1._handleBeforeUnload();

      // Callback should NOT fire because tracker2 is still open
      expect(callback1).not.toHaveBeenCalled();

      tracker2.stop();
    });

    it('should handle callback errors gracefully', () => {
      const callback = vi.fn().mockImplementation(() => {
        throw new Error('Cleanup failed');
      });

      const tracker = new ProjectTabTracker('project-123', callback);
      tracker.start();

      global.performance = {
        navigation: { type: 0 },
        getEntriesByType: () => [{ type: 'navigate' }],
      };

      // Should not throw
      expect(() => tracker._handleBeforeUnload()).not.toThrow();
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('pagehide event', () => {
    it('should trigger cleanup on pagehide with persisted=false', () => {
      const callback = vi.fn();
      const tracker = new ProjectTabTracker('project-123', callback);
      tracker.start();

      global.performance = {
        navigation: { type: 0 },
        getEntriesByType: () => [{ type: 'navigate' }],
      };

      tracker._handlePageHide({ persisted: false });

      expect(callback).toHaveBeenCalled();
    });

    it('should NOT trigger cleanup on pagehide with persisted=true', () => {
      const callback = vi.fn();
      const tracker = new ProjectTabTracker('project-123', callback);
      tracker.start();

      tracker._handlePageHide({ persisted: true });

      expect(callback).not.toHaveBeenCalled();

      tracker.stop();
    });
  });

  describe('BroadcastChannel messages', () => {
    it('should clean stale entries when TAB_CLOSING message received', async () => {
      vi.useFakeTimers();

      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();

      // Manually add a stale entry
      const tabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'));
      tabs['stale-tab'] = Date.now() - 20000;
      mockLocalStorage.setItem('exe-tabs-project-123', JSON.stringify(tabs));

      // Simulate TAB_CLOSING message
      tracker._handleMessage({ data: { type: 'TAB_CLOSING', tabId: 'other-tab' } });

      // Advance past the setTimeout
      vi.advanceTimersByTime(200);

      const updatedTabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'));
      expect(updatedTabs['stale-tab']).toBeUndefined();

      tracker.stop();
    });

    it('should send heartbeat when TAB_OPENED message received', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});
      tracker.start();

      const oldTimestamp = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'))[tracker.tabId];

      // Small delay to ensure different timestamp
      const now = Date.now() + 100;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      tracker._handleMessage({ data: { type: 'TAB_OPENED', tabId: 'other-tab' } });

      const newTimestamp = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'))[tracker.tabId];
      expect(newTimestamp).toBe(now);

      tracker.stop();
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage getItem errors', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      // Mock localStorage to throw
      mockLocalStorage.getItem = () => {
        throw new Error('Storage error');
      };

      const tabs = tracker._getTabsFromStorage();
      expect(tabs).toEqual({});
    });

    it('should handle localStorage setItem errors', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      mockLocalStorage.setItem = () => {
        throw new Error('Storage full');
      };

      // Should not throw
      expect(() => tracker._saveTabsToStorage({ tab1: Date.now() })).not.toThrow();
    });

    it('should handle invalid JSON in localStorage', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      mockLocalStorage.store['exe-tabs-project-123'] = 'invalid json{';

      const tabs = tracker._getTabsFromStorage();
      expect(tabs).toEqual({});
    });
  });

  describe('forceCleanup()', () => {
    it('should trigger callback immediately', () => {
      const callback = vi.fn();
      const tracker = new ProjectTabTracker('project-123', callback);

      tracker.forceCleanup();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple projects', () => {
    it('should track projects independently', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const tracker1 = new ProjectTabTracker('project-A', callback1);
      tracker1.start();

      const tracker2 = new ProjectTabTracker('project-B', callback2);
      tracker2.start();

      // Each project has its own storage key
      expect(mockLocalStorage.getItem('exe-tabs-project-A')).not.toBeNull();
      expect(mockLocalStorage.getItem('exe-tabs-project-B')).not.toBeNull();

      // Closing tracker1 should only trigger callback1
      global.performance = {
        navigation: { type: 0 },
        getEntriesByType: () => [{ type: 'navigate' }],
      };

      tracker1._handleBeforeUnload();
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      tracker2.stop();
    });
  });

  describe('BroadcastChannel not available', () => {
    it('should work without BroadcastChannel', () => {
      global.BroadcastChannel = undefined;

      const tracker = new ProjectTabTracker('project-123', () => {});
      expect(() => tracker.start()).not.toThrow();

      expect(tracker._channel).toBeNull();

      // Should still track via localStorage
      const tabs = JSON.parse(mockLocalStorage.getItem('exe-tabs-project-123'));
      expect(tabs[tracker.tabId]).toBeDefined();

      tracker.stop();
    });

    it('should not propagate when BroadcastChannel constructor throws', () => {
      // BroadcastChannel is defined but throws on construction
      global.BroadcastChannel = class {
        constructor() { throw new Error('BroadcastChannel unavailable'); }
      };

      const tracker = new ProjectTabTracker('project-123', () => {});
      expect(() => tracker.start()).not.toThrow();

      // Channel creation silently failed — _channel stays null
      expect(tracker._channel).toBeNull();

      tracker.stop();
    });
  });

  describe('_isRefresh — legacy performance.navigation fallback', () => {
    it('returns true when modern API has no entries but legacy navigation.type is 1', () => {
      const tracker = new ProjectTabTracker('project-123', () => {});

      // Modern API returns no entries → falls through to legacy check
      global.performance = {
        getEntriesByType: () => [],
        navigation: { type: 1 }, // legacy reload indicator
      };

      expect(tracker._isRefresh()).toBe(true);
    });
  });
});

import PreviewPanelManager from './previewPanel.js';

/**
 * Create a mock MessageChannel that captures port1.onmessage
 * @param {Function} onPostMessage - Callback when postMessage is called, receives (message, triggerResponse)
 * @returns {{ restore: Function }} Object with restore function for cleanup
 */
function mockMessageChannel(onPostMessage) {
  let capturedHandler = null;
  const mockPort1 = {
    set onmessage(handler) { capturedHandler = handler; },
    get onmessage() { return capturedHandler; },
  };
  const mockPort2 = {};
  const originalMessageChannel = globalThis.MessageChannel;

  globalThis.MessageChannel = function() {
    this.port1 = mockPort1;
    this.port2 = mockPort2;
  };

  const triggerResponse = (data) => {
    setTimeout(() => {
      if (capturedHandler) {
        capturedHandler({ data });
      }
    }, 0);
  };

  // Call onPostMessage with triggerResponse if provided
  if (onPostMessage) {
    onPostMessage(triggerResponse);
  }

  return {
    triggerResponse,
    restore: () => {
      globalThis.MessageChannel = originalMessageChannel;
    },
  };
}

describe('PreviewPanelManager', () => {
  let manager;
  let mockElements;
  let mockProject;
  let mockBridge;
  let mockDocumentManager;
  let mockYdoc;

  beforeEach(() => {
    // Mock DOM elements
    mockElements = {
      previewsidenav: document.createElement('div'),
      'preview-sidenav-overlay': document.createElement('div'),
      previewsidenavclose: document.createElement('button'),
      'preview-extract-button': document.createElement('button'),
      'preview-pin-button': document.createElement('button'),
      'preview-refresh-button': document.createElement('button'),
      'preview-iframe': document.createElement('iframe'),
      'preview-pinned-container': document.createElement('div'),
      'preview-pinned-iframe': document.createElement('iframe'),
      'preview-pinned-extract-button': document.createElement('button'),
      'preview-unpin-button': document.createElement('button'),
      'preview-pinned-refresh-button': document.createElement('button'),
      workarea: document.createElement('div'),
    };

    // Add nested elements for loading states
    const panelBody = document.createElement('div');
    panelBody.className = 'preview-panel-body';
    mockElements.previewsidenav.appendChild(panelBody);

    const pinnedBody = document.createElement('div');
    pinnedBody.className = 'preview-pinned-body';
    mockElements['preview-pinned-container'].appendChild(pinnedBody);

    vi.spyOn(document, 'getElementById').mockImplementation(id => mockElements[id] || null);

    // Mock Yjs
    mockYdoc = {
      on: vi.fn(),
      off: vi.fn(),
    };
    mockDocumentManager = {
      ydoc: mockYdoc,
    };
    mockBridge = {
      documentManager: mockDocumentManager,
      onStructureChange: vi.fn(() => vi.fn()),
    };
    mockProject = {
      _yjsEnabled: true,
      _yjsBridge: mockBridge,
      checkOpenIdevice: vi.fn(() => false),
    };

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        project: mockProject,
        config: {
          basePath: '/test',
          version: 'v3',
        },
      },
    };

    // Mock SharedExporters
    window.SharedExporters = {
      generatePreview: vi.fn().mockResolvedValue({
        success: true,
        html: '<html><body>Preview</body></html>',
      }),
    };

    // Mock ResourceFetcher
    window.ResourceFetcher = vi.fn().mockImplementation(function() {
      return {};
    });

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();

    manager = new PreviewPanelManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with default values and elements', () => {
      expect(manager.isOpen).toBe(false);
      expect(manager.isPinned).toBe(false);
      expect(manager.panel).toBe(mockElements.previewsidenav);
    });
  });

  describe('init', () => {
    it('should bind events and subscribe to changes', () => {
      const bindSpy = vi.spyOn(manager, 'bindEvents');
      const subscribeSpy = vi.spyOn(manager, 'subscribeToChanges');
      const restoreSpy = vi.spyOn(manager, 'restorePinnedState').mockImplementation(() => Promise.resolve());
      const visibilitySpy = vi.spyOn(manager, '_setupVisibilityHandler').mockImplementation(() => {});

      manager.init();

      expect(bindSpy).toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalled();
      expect(restoreSpy).toHaveBeenCalled();
      expect(visibilitySpy).toHaveBeenCalled();
    });
  });

  describe('visibility handler for tab switch recovery', () => {
    describe('_isPreviewVisible', () => {
      it('should return true when open', () => {
        manager.isOpen = true;
        manager.isPinned = false;

        expect(manager._isPreviewVisible()).toBe(true);
      });

      it('should return true when pinned', () => {
        manager.isOpen = false;
        manager.isPinned = true;

        expect(manager._isPreviewVisible()).toBe(true);
      });

      it('should return true when both open and pinned', () => {
        manager.isOpen = true;
        manager.isPinned = true;

        expect(manager._isPreviewVisible()).toBe(true);
      });

      it('should return false when neither open nor pinned', () => {
        manager.isOpen = false;
        manager.isPinned = false;

        expect(manager._isPreviewVisible()).toBe(false);
      });
    });

    describe('_setupVisibilityHandler', () => {
      it('should add visibilitychange event listener', () => {
        const addEventSpy = vi.spyOn(document, 'addEventListener');
        manager._setupVisibilityHandler();

        expect(addEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        expect(manager._visibilityChangeHandler).toBeDefined();
      });

      it('should call _checkAndRecoverPreview when tab becomes visible', async () => {
        const checkRecoverSpy = vi.spyOn(manager, '_checkAndRecoverPreview').mockResolvedValue();
        manager._setupVisibilityHandler();

        // Simulate tab becoming visible
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true,
        });

        await manager._visibilityChangeHandler();

        expect(checkRecoverSpy).toHaveBeenCalled();
      });
    });

    describe('_checkAndRecoverPreview', () => {
      it('should not recover when preview is not open', async () => {
        manager.isOpen = false;
        manager.isPinned = false;
        const checkSWSpy = vi.spyOn(manager, '_checkServiceWorkerContent');

        await manager._checkAndRecoverPreview();

        expect(checkSWSpy).not.toHaveBeenCalled();
      });

      it('should not recover when SW has content', async () => {
        manager.isOpen = true;
        vi.spyOn(manager, '_checkServiceWorkerContent').mockResolvedValue(true);
        const refreshSpy = vi.spyOn(manager, 'refresh');

        await manager._checkAndRecoverPreview();

        expect(refreshSpy).not.toHaveBeenCalled();
      });

      it('should refresh when SW has lost content', async () => {
        manager.isOpen = true;
        vi.spyOn(manager, '_checkServiceWorkerContent').mockResolvedValue(false);
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();

        await manager._checkAndRecoverPreview();

        expect(refreshSpy).toHaveBeenCalled();
      });

      it('should recover when pinned', async () => {
        manager.isOpen = false;
        manager.isPinned = true;
        vi.spyOn(manager, '_checkServiceWorkerContent').mockResolvedValue(false);
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();

        await manager._checkAndRecoverPreview();

        expect(refreshSpy).toHaveBeenCalled();
      });
    });

    describe('_checkServiceWorkerContent', () => {
      it('should return false when no SW available', async () => {
        window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue(null);

        const result = await manager._checkServiceWorkerContent();

        expect(result).toBe(false);
      });

      it('should return true when SW reports ready with files', async () => {
        const channelMock = mockMessageChannel();
        const mockSW = {
          postMessage: vi.fn(() => {
            channelMock.triggerResponse({ ready: true, fileCount: 5 });
          }),
        };
        window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue(mockSW);

        const result = await manager._checkServiceWorkerContent();

        expect(result).toBe(true);
        channelMock.restore();
      });

      it('should return false when SW reports not ready', async () => {
        const channelMock = mockMessageChannel();
        const mockSW = {
          postMessage: vi.fn(() => {
            channelMock.triggerResponse({ ready: false, fileCount: 0 });
          }),
        };
        window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue(mockSW);

        const result = await manager._checkServiceWorkerContent();

        expect(result).toBe(false);
        channelMock.restore();
      });

      it('should return false on timeout', async () => {
        vi.useFakeTimers();
        const mockSW = {
          postMessage: vi.fn(), // Never calls callback
        };
        window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue(mockSW);

        const resultPromise = manager._checkServiceWorkerContent();

        // Exceed the static timeout constant
        vi.advanceTimersByTime(PreviewPanelManager.SW_STATUS_TIMEOUT + 100);

        const result = await resultPromise;
        expect(result).toBe(false);

        vi.useRealTimers();
      });

      it('should return false on error', async () => {
        window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockImplementation(() => {
          throw new Error('SW error');
        });

        const result = await manager._checkServiceWorkerContent();

        expect(result).toBe(false);
      });
    });

    describe('CONTENT_NEEDED message handling', () => {
      it('should refresh when CONTENT_NEEDED received and preview is open', async () => {
        vi.useFakeTimers();
        manager.bindEvents();
        manager.isOpen = true;
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();

        const event = new MessageEvent('message', {
          data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' },
        });
        window.dispatchEvent(event);

        vi.advanceTimersByTime(150); // Debounce timeout

        expect(refreshSpy).toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should not refresh when CONTENT_NEEDED received but preview is closed', async () => {
        vi.useFakeTimers();
        manager.bindEvents();
        manager.isOpen = false;
        manager.isPinned = false;
        const refreshSpy = vi.spyOn(manager, 'refresh');

        const event = new MessageEvent('message', {
          data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' },
        });
        window.dispatchEvent(event);

        vi.advanceTimersByTime(150);

        expect(refreshSpy).not.toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should debounce multiple CONTENT_NEEDED messages', async () => {
        vi.useFakeTimers();
        manager.bindEvents();
        manager.isPinned = true;
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();

        // Send multiple messages rapidly
        for (let i = 0; i < 5; i++) {
          const event = new MessageEvent('message', {
            data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' },
          });
          window.dispatchEvent(event);
        }

        vi.advanceTimersByTime(150);

        // Should only refresh once due to debouncing
        expect(refreshSpy).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
      });
    });
  });

  describe('open/close', () => {
    it('should open the panel and refresh content', async () => {
      const refreshSpy = vi.spyOn(manager, 'refresh').mockImplementation(() => Promise.resolve());
      await manager.open();

      expect(manager.isOpen).toBe(true);
      expect(mockElements.previewsidenav.classList.contains('active')).toBe(true);
      expect(mockElements['preview-sidenav-overlay'].classList.contains('active')).toBe(true);
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should not open if an idevice is open', async () => {
      mockProject.checkOpenIdevice.mockReturnValue(true);
      await manager.open();

      expect(manager.isOpen).toBe(false);
    });

    it('should close the panel', () => {
      manager.isOpen = true;
      manager.close();

      expect(manager.isOpen).toBe(false);
      expect(mockElements.previewsidenav.classList.contains('active')).toBe(false);
    });
  });

  describe('pin/unpin', () => {
    it('should pin the preview to layout', async () => {
      const refreshSpy = vi.spyOn(manager, 'refresh').mockImplementation(() => Promise.resolve());
      await manager.pin();

      expect(manager.isPinned).toBe(true);
      expect(mockElements.workarea.getAttribute('data-preview-pinned')).toBe('true');
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should unpin the preview', () => {
      vi.spyOn(manager, 'refresh').mockImplementation(() => Promise.resolve());
      manager.isPinned = true;
      manager.unpin();

      expect(manager.isPinned).toBe(false);
      expect(mockElements.workarea.getAttribute('data-preview-pinned')).toBe('false');
      expect(mockElements.previewsidenav.classList.contains('active')).toBe(true);
    });
  });

  describe('refresh', () => {
    it('should show error when Service Worker is not available', async () => {
      // Simulate SW not available
      const errorSpy = vi.spyOn(manager, 'showError').mockImplementation(() => {});
      vi.spyOn(manager, 'isServiceWorkerPreviewAvailable').mockReturnValue(false);

      await manager.refresh();

      expect(errorSpy).toHaveBeenCalledWith('Preview Service Worker not available. Please reload the page.');
    });

    it('should use SW-based preview when available', async () => {
      // Mock SW availability and refresh method
      vi.spyOn(manager, 'isServiceWorkerPreviewAvailable').mockReturnValue(true);
      const swRefreshSpy = vi.spyOn(manager, 'refreshWithServiceWorker').mockResolvedValue();

      await manager.refresh();

      expect(swRefreshSpy).toHaveBeenCalled();
    });

    it('should handle SW refresh errors', async () => {
      const error = new Error('SW refresh failed');
      vi.spyOn(manager, 'isServiceWorkerPreviewAvailable').mockReturnValue(true);
      vi.spyOn(manager, 'refreshWithServiceWorker').mockRejectedValue(error);
      const errorSpy = vi.spyOn(manager, 'showError').mockImplementation(() => {});

      await manager.refresh();

      expect(errorSpy).toHaveBeenCalledWith('SW refresh failed');
    });
  });

  // NOTE: generatePreviewHtml tests removed - method replaced by SW-based preview

  describe('extractToNewTab', () => {
    it('should open viewer URL in new tab when SW is available', async () => {
      // Mock SW availability
      manager.isServiceWorkerPreviewAvailable = vi.fn().mockReturnValue(true);
      manager.refreshWithServiceWorker = vi.fn().mockResolvedValue();

      const mockOpen = vi.fn(() => ({ focus: vi.fn() }));
      global.open = mockOpen;

      await manager.extractToNewTab();

      expect(mockOpen).toHaveBeenCalledWith(
        expect.stringContaining('/viewer/index.html'),
        '_blank'
      );
    });

    it('should fallback to link click if popup is blocked', async () => {
      manager.isServiceWorkerPreviewAvailable = vi.fn().mockReturnValue(true);
      manager.refreshWithServiceWorker = vi.fn().mockResolvedValue();
      global.open = vi.fn(() => null);

      const mockClick = vi.fn();
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return { click: mockClick, href: '', target: '' };
        }
        return document.createElement(tag);
      });

      await manager.extractToNewTab();

      expect(mockClick).toHaveBeenCalled();
    });

    it('should not open tab if SW is not available', async () => {
      manager.isServiceWorkerPreviewAvailable = vi.fn().mockReturnValue(false);

      const mockOpen = vi.fn();
      global.open = mockOpen;

      await manager.extractToNewTab();

      // Should not open a new tab when SW is not available
      expect(mockOpen).not.toHaveBeenCalled();
    });
  });

  // NOTE: generateStandalonePreviewHtml tests removed - method no longer needed with SW approach

  describe('utility methods', () => {
    it('should escape HTML', () => {
      const escaped = manager.escapeHtml('<script>alert(1)</script>');
      expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  // NOTE: The following test sections have been removed as part of Phase 4 cleanup:
  // - resolveHtmlIframeAssets (method removed - SW serves content via HTTP)
  // - injectPdfBlobUrlConverter (method removed - SW eliminates blob:// context issues)
  // - postMessage handling for PDF blobs (handlers removed)
  // - injectHtmlLinkHandler (method removed - SW serves content via HTTP)
  // - postMessage handling for HTML link resolution (handlers removed)
  // - resolveHtmlIframeAssetsForStandalone (method removed - SW approach doesn't need it)

  describe('auto-refresh', () => {
    it('should schedule refresh on structure change', () => {
      vi.useFakeTimers();
      manager.subscribeToChanges();
      manager.isOpen = true;
      
      const structureCallback = mockBridge.onStructureChange.mock.calls[0][0];
      structureCallback();

      expect(manager.refreshDebounceTimer).not.toBeNull();
      
      const refreshSpy = vi.spyOn(manager, 'refresh').mockImplementation(() => Promise.resolve());
      vi.advanceTimersByTime(500);
      
      expect(refreshSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should schedule refresh on ydoc update', () => {
      vi.useFakeTimers();
      manager.subscribeToChanges();
      manager.isPinned = true;
      
      const updateCallback = mockYdoc.on.mock.calls.find(call => call[0] === 'update')[1];
      updateCallback(new Uint8Array(), 'user');

      expect(manager.refreshDebounceTimer).not.toBeNull();
      vi.useRealTimers();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      manager.subscribeToChanges();
      const unsubscribeSpy = vi.fn();
      manager._unsubscribeStructure = unsubscribeSpy;

      // Setup blobUrl to test revocation
      mockElements['preview-iframe']._blobUrl = 'blob:test-1';
      mockElements['preview-pinned-iframe']._blobUrl = 'blob:test-2';

      manager.destroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(mockYdoc.off).toHaveBeenCalledWith('update', expect.any(Function));
      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it('should remove visibility change handler', () => {
      const removeEventSpy = vi.spyOn(document, 'removeEventListener');
      manager._visibilityChangeHandler = vi.fn();

      manager.destroy();

      expect(removeEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(manager._visibilityChangeHandler).toBeNull();
    });

    it('should clear content needed refresh timer', () => {
      vi.useFakeTimers();
      manager._contentNeededRefreshTimer = setTimeout(() => {}, 1000);

      manager.destroy();

      expect(manager._contentNeededRefreshTimer).toBeNull();
      vi.useRealTimers();
    });
  });

  // NOTE: Tests for blobToDataUrl and processUserThemeCssUrls have been removed
  // as part of Phase 4 cleanup. These methods were used for the legacy blob URL
  // approach and are no longer needed with the Service Worker-based preview.

  describe('restorePinnedState', () => {
    it('should restore pinned state from localStorage', async () => {
      const mockLocalStorage = {
        getItem: vi.fn(() => 'true'),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      const pinSpy = vi.spyOn(manager, 'pin').mockImplementation(() => Promise.resolve());
      await manager.restorePinnedState();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('exe-preview-pinned');
      expect(pinSpy).toHaveBeenCalled();
    });

    it('should not pin if localStorage value is not true', async () => {
      const mockLocalStorage = {
        getItem: vi.fn(() => 'false'),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      const pinSpy = vi.spyOn(manager, 'pin');
      await manager.restorePinnedState();

      expect(pinSpy).not.toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', async () => {
      const mockLocalStorage = {
        getItem: vi.fn(() => {
          throw new Error('localStorage error');
        }),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      // Should not throw
      await expect(manager.restorePinnedState()).resolves.not.toThrow();
    });
  });

  describe('scheduleRefresh', () => {
    it('should schedule refresh when open', () => {
      vi.useFakeTimers();
      manager.isOpen = true;
      manager.isPinned = false;
      const refreshSpy = vi.spyOn(manager, 'refresh').mockImplementation(() => Promise.resolve());

      manager.scheduleRefresh();

      expect(manager.refreshDebounceTimer).not.toBeNull();
      vi.advanceTimersByTime(500);
      expect(refreshSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should debounce multiple rapid calls', () => {
      vi.useFakeTimers();
      manager.isOpen = true;
      const refreshSpy = vi.spyOn(manager, 'refresh').mockImplementation(() => Promise.resolve());

      manager.scheduleRefresh();
      manager.scheduleRefresh();
      manager.scheduleRefresh();

      vi.advanceTimersByTime(500);

      // Should only call refresh once due to debouncing
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('toggle', () => {
    it('should open when closed', async () => {
      manager.isOpen = false;
      const openSpy = vi.spyOn(manager, 'open').mockImplementation(() => Promise.resolve());

      await manager.toggle();

      expect(openSpy).toHaveBeenCalled();
    });

    it('should close when open', async () => {
      manager.isOpen = true;
      const closeSpy = vi.spyOn(manager, 'close');

      await manager.toggle();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should close on Escape key when open', () => {
      manager.bindEvents();
      manager.isOpen = true;
      const closeSpy = vi.spyOn(manager, 'close');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should not close on Escape when not open', () => {
      manager.bindEvents();
      manager.isOpen = false;
      const closeSpy = vi.spyOn(manager, 'close');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should not close on Escape when pinned', () => {
      manager.bindEvents();
      manager.isOpen = true;
      manager.isPinned = true;
      const closeSpy = vi.spyOn(manager, 'close');

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should toggle on Ctrl+Shift+P', async () => {
      manager.bindEvents();
      const toggleSpy = vi.spyOn(manager, 'toggle').mockResolvedValue();

      const event = new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true });
      document.dispatchEvent(event);

      expect(toggleSpy).toHaveBeenCalled();
    });
  });

  describe('isServiceWorkerPreviewAvailable', () => {
    it('returns falsy when serviceWorker not in navigator', () => {
      const originalSW = navigator.serviceWorker;
      Object.defineProperty(navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(manager.isServiceWorkerPreviewAvailable()).toBeFalsy();

      Object.defineProperty(navigator, 'serviceWorker', {
        value: originalSW,
        writable: true,
        configurable: true,
      });
    });

    it('returns falsy when getPreviewServiceWorker returns null', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        writable: true,
        configurable: true,
      });
      // Mock getPreviewServiceWorker to return null (no SW available)
      window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue(null);

      expect(manager.isServiceWorkerPreviewAvailable()).toBeFalsy();
    });

    it('returns truthy when controller is null but getPreviewServiceWorker returns registration.active', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        writable: true,
        configurable: true,
      });
      // Mock getPreviewServiceWorker to return registration.active (fallback for BASE_PATH)
      window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue({ state: 'activated' });
      window.eXeLearning.app.sendContentToPreviewSW = vi.fn();
      window.SharedExporters.generatePreviewForSW = vi.fn();

      expect(manager.isServiceWorkerPreviewAvailable()).toBeTruthy();
    });

    it('returns falsy when sendContentToPreviewSW not available', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: {} },
        writable: true,
        configurable: true,
      });
      window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue({});
      window.eXeLearning.app.sendContentToPreviewSW = undefined;

      expect(manager.isServiceWorkerPreviewAvailable()).toBeFalsy();
    });

    it('returns falsy when SharedExporters.generatePreviewForSW not available', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: {} },
        writable: true,
        configurable: true,
      });
      window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue({});
      window.eXeLearning.app.sendContentToPreviewSW = vi.fn();
      window.SharedExporters.generatePreviewForSW = undefined;

      expect(manager.isServiceWorkerPreviewAvailable()).toBeFalsy();
    });

    it('returns truthy when all conditions are met', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: {} },
        writable: true,
        configurable: true,
      });
      // Mock getPreviewServiceWorker to return a truthy value (used by isServiceWorkerPreviewAvailable)
      window.eXeLearning.app.getPreviewServiceWorker = vi.fn().mockReturnValue({});
      window.eXeLearning.app.sendContentToPreviewSW = vi.fn();
      window.SharedExporters.generatePreviewForSW = vi.fn();

      expect(manager.isServiceWorkerPreviewAvailable()).toBeTruthy();
    });
  });

  describe('loadPreviewFromServiceWorker', () => {
    it('should revoke previous blob URL if exists', () => {
      mockElements['preview-iframe']._blobUrl = 'blob:test-old-url';
      manager.loadPreviewFromServiceWorker();

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-old-url');
      expect(mockElements['preview-iframe']._blobUrl).toBeNull();
    });

    it('should use pinned iframe when pinned', () => {
      manager.isPinned = true;
      mockElements['preview-pinned-iframe']._blobUrl = 'blob:pinned-url';

      manager.loadPreviewFromServiceWorker();

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:pinned-url');
    });

    it('should set iframe src to viewer URL', () => {
      window.eXeLearning.app.getBasePath = () => '/myapp';

      manager.loadPreviewFromServiceWorker();

      // happy-dom normalizes URLs, so check for the path
      expect(mockElements['preview-iframe'].src).toContain('/myapp/viewer/index.html');
    });

    it('should force reload when src is already viewer URL', async () => {
      vi.useFakeTimers();
      mockElements['preview-iframe'].src = 'http://localhost/viewer/index.html';
      window.eXeLearning.app.getBasePath = () => '';

      manager.loadPreviewFromServiceWorker();

      // First set to about:blank
      expect(mockElements['preview-iframe'].src).toContain('about:blank');

      // After timeout, set to viewer URL
      vi.advanceTimersByTime(60);
      expect(mockElements['preview-iframe'].src).toContain('/viewer/index.html');

      vi.useRealTimers();
    });

    it('should not throw when no iframe available', () => {
      // Create manager with no iframe
      vi.spyOn(document, 'getElementById').mockImplementation(id => {
        if (id === 'preview-iframe' || id === 'preview-pinned-iframe') return null;
        return mockElements[id] || null;
      });

      const newManager = new PreviewPanelManager();

      // Should not throw - just silently return
      expect(() => newManager.loadPreviewFromServiceWorker()).not.toThrow();
    });
  });

  describe('injectHtmlToIframe', () => {
    it('should revoke previous blob URL', () => {
      mockElements['preview-iframe']._blobUrl = 'blob:previous-url';

      manager.injectHtmlToIframe('<html></html>');

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:previous-url');
    });

    it('should create new blob URL and set iframe src', () => {
      manager.injectHtmlToIframe('<html><body>Test</body></html>');

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockElements['preview-iframe'].src).toBe('blob:test-url');
      expect(mockElements['preview-iframe']._blobUrl).toBe('blob:test-url');
    });

    it('should use pinned iframe when pinned', () => {
      manager.isPinned = true;

      manager.injectHtmlToIframe('<html></html>');

      expect(mockElements['preview-pinned-iframe'].src).toBe('blob:test-url');
    });

    it('should not throw when no iframe available', () => {
      vi.spyOn(document, 'getElementById').mockImplementation(id => {
        if (id === 'preview-iframe' || id === 'preview-pinned-iframe') return null;
        return mockElements[id] || null;
      });

      const newManager = new PreviewPanelManager();

      // Should not throw - just silently return
      expect(() => newManager.injectHtmlToIframe('<html></html>')).not.toThrow();
    });
  });

  describe('refreshWithServiceWorker', () => {
    beforeEach(() => {
      // Setup complete mock environment
      window.eXeLearning.app.themes = { selected: { id: 'base' } };
      window.eXeLearning.app.sendContentToPreviewSW = vi.fn().mockResolvedValue();
      window.SharedExporters.generatePreviewForSW = vi.fn().mockResolvedValue({
        success: true,
        files: { 'index.html': new Uint8Array([1, 2, 3]) },
      });
    });

    it('should throw when Yjs document manager not available', async () => {
      window.eXeLearning.app.project._yjsBridge.documentManager = null;

      await expect(manager.refreshWithServiceWorker()).rejects.toThrow('Yjs document manager not available');
    });

    it('should throw when SharedExporters.generatePreviewForSW not available', async () => {
      window.SharedExporters.generatePreviewForSW = undefined;

      await expect(manager.refreshWithServiceWorker()).rejects.toThrow('SharedExporters.generatePreviewForSW not available');
    });

    it('should throw when preview generation fails', async () => {
      window.SharedExporters.generatePreviewForSW = vi.fn().mockResolvedValue({
        success: false,
        error: 'Generation failed',
      });

      await expect(manager.refreshWithServiceWorker()).rejects.toThrow('Generation failed');
    });

    it('should throw with generic message when generation fails without error', async () => {
      window.SharedExporters.generatePreviewForSW = vi.fn().mockResolvedValue({
        success: false,
      });

      await expect(manager.refreshWithServiceWorker()).rejects.toThrow('Failed to generate preview files');
    });

    it('should send files to SW and load preview', async () => {
      const loadSpy = vi.spyOn(manager, 'loadPreviewFromServiceWorker').mockImplementation(() => {});

      await manager.refreshWithServiceWorker();

      expect(window.SharedExporters.generatePreviewForSW).toHaveBeenCalled();
      expect(window.eXeLearning.app.sendContentToPreviewSW).toHaveBeenCalled();
      expect(loadSpy).toHaveBeenCalled();
    });

    it('should use theme from eXeLearning.app.themes.selected', async () => {
      window.eXeLearning.app.themes.selected = { id: 'custom-theme' };
      vi.spyOn(manager, 'loadPreviewFromServiceWorker').mockImplementation(() => {});

      await manager.refreshWithServiceWorker();

      // Verify the last argument contains the theme
      expect(window.SharedExporters.generatePreviewForSW).toHaveBeenCalled();
      const lastCall = window.SharedExporters.generatePreviewForSW.mock.calls[0];
      expect(lastCall[4]).toEqual({ theme: 'custom-theme' });
    });

    it('should use theme name when id not available', async () => {
      window.eXeLearning.app.themes.selected = { name: 'theme-name' };
      vi.spyOn(manager, 'loadPreviewFromServiceWorker').mockImplementation(() => {});

      await manager.refreshWithServiceWorker();

      // Verify the last argument contains the theme
      const lastCall = window.SharedExporters.generatePreviewForSW.mock.calls[0];
      expect(lastCall[4]).toEqual({ theme: 'theme-name' });
    });
  });

  describe('showLoadingState and hideLoadingState', () => {
    it('should add preview-loading class when open', () => {
      manager.isOpen = true;
      manager.showLoadingState();

      const body = mockElements.previewsidenav.querySelector('.preview-panel-body');
      expect(body.classList.contains('preview-loading')).toBe(true);
    });

    it('should add preview-loading class when pinned', () => {
      manager.isPinned = true;
      manager.showLoadingState();

      const body = mockElements['preview-pinned-container'].querySelector('.preview-pinned-body');
      expect(body.classList.contains('preview-loading')).toBe(true);
    });

    it('should remove preview-loading class when open', () => {
      manager.isOpen = true;
      const body = mockElements.previewsidenav.querySelector('.preview-panel-body');
      body.classList.add('preview-loading');

      manager.hideLoadingState();

      expect(body.classList.contains('preview-loading')).toBe(false);
    });
  });

  describe('showError', () => {
    it('should inject error HTML into iframe', () => {
      const injectSpy = vi.spyOn(manager, 'injectHtmlToIframe');

      manager.showError('Test error message');

      expect(injectSpy).toHaveBeenCalled();
      const html = injectSpy.mock.calls[0][0];
      expect(html).toContain('Preview Error');
      expect(html).toContain('Test error message');
    });

    it('should escape HTML in error message', () => {
      const injectSpy = vi.spyOn(manager, 'injectHtmlToIframe');

      manager.showError('<script>alert(1)</script>');

      const html = injectSpy.mock.calls[0][0];
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert(1)</script>');
    });
  });

  describe('savePinnedPreference and loadPinnedPreference', () => {
    it('should save true to localStorage', () => {
      const mockLocalStorage = { setItem: vi.fn() };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      manager.savePinnedPreference(true);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('exe-preview-pinned', 'true');
    });

    it('should save false to localStorage', () => {
      const mockLocalStorage = { setItem: vi.fn() };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      manager.savePinnedPreference(false);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('exe-preview-pinned', 'false');
    });

    it('should handle localStorage error on save gracefully', () => {
      const mockLocalStorage = {
        setItem: vi.fn(() => { throw new Error('localStorage error'); }),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      expect(() => manager.savePinnedPreference(true)).not.toThrow();
    });

    it('should load true from localStorage', () => {
      const mockLocalStorage = { getItem: vi.fn(() => 'true') };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      expect(manager.loadPinnedPreference()).toBe(true);
    });

    it('should return false for non-true values', () => {
      const mockLocalStorage = { getItem: vi.fn(() => 'false') };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      expect(manager.loadPinnedPreference()).toBe(false);
    });

    it('should handle localStorage error on load gracefully', () => {
      const mockLocalStorage = {
        getItem: vi.fn(() => { throw new Error('localStorage error'); }),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      expect(manager.loadPinnedPreference()).toBe(false);
    });
  });

  describe('setAutoRefresh', () => {
    it('should enable auto-refresh', () => {
      manager.autoRefreshEnabled = false;

      manager.setAutoRefresh(true);

      expect(manager.autoRefreshEnabled).toBe(true);
    });

    it('should disable auto-refresh', () => {
      manager.autoRefreshEnabled = true;

      manager.setAutoRefresh(false);

      expect(manager.autoRefreshEnabled).toBe(false);
    });
  });

  describe('scheduleRefresh edge cases', () => {
    it('should not schedule when auto-refresh disabled', () => {
      manager.autoRefreshEnabled = false;
      const refreshSpy = vi.spyOn(manager, 'refresh');

      manager.scheduleRefresh();

      expect(manager.refreshDebounceTimer).toBeNull();
      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToChanges edge cases', () => {
    it('should not subscribe when Yjs not enabled', () => {
      mockProject._yjsEnabled = false;

      manager.subscribeToChanges();

      expect(mockBridge.onStructureChange).not.toHaveBeenCalled();
    });

    it('should not subscribe when bridge not available', () => {
      mockProject._yjsBridge = null;

      manager.subscribeToChanges();

      expect(manager._unsubscribeStructure).toBeNull();
    });

    it('should not refresh on structure change when not open or pinned', () => {
      vi.useFakeTimers();
      manager.subscribeToChanges();
      manager.isOpen = false;
      manager.isPinned = false;

      const structureCallback = mockBridge.onStructureChange.mock.calls[0][0];
      structureCallback();

      expect(manager.refreshDebounceTimer).toBeNull();
      vi.useRealTimers();
    });

    it('should skip system-originated ydoc updates', () => {
      vi.useFakeTimers();
      manager.subscribeToChanges();
      manager.isOpen = true;

      const updateCallback = mockYdoc.on.mock.calls.find(call => call[0] === 'update')[1];
      updateCallback(new Uint8Array(), 'system'); // System origin

      // No refresh should be scheduled
      expect(manager.refreshDebounceTimer).toBeNull();
      vi.useRealTimers();
    });

    it('should skip initial-originated ydoc updates', () => {
      vi.useFakeTimers();
      manager.subscribeToChanges();
      manager.isOpen = true;

      const updateCallback = mockYdoc.on.mock.calls.find(call => call[0] === 'update')[1];
      updateCallback(new Uint8Array(), 'initial'); // Initial origin

      expect(manager.refreshDebounceTimer).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('open edge cases', () => {
    it('should not open when already pinned', async () => {
      manager.isPinned = true;
      const refreshSpy = vi.spyOn(manager, 'refresh');

      await manager.open();

      expect(refreshSpy).not.toHaveBeenCalled();
      expect(manager.isOpen).toBe(false);
    });
  });

  describe('close edge cases', () => {
    it('should not close when pinned', () => {
      manager.isPinned = true;
      manager.isOpen = true;

      manager.close();

      expect(manager.isOpen).toBe(true); // Still open because pinned
    });
  });

  describe('toggle', () => {
    it('should unpin when toggling while pinned', async () => {
      manager.isPinned = true;
      const unpinSpy = vi.spyOn(manager, 'unpin');

      await manager.toggle();

      expect(unpinSpy).toHaveBeenCalled();
    });
  });

  describe('bindEvents edge cases', () => {
    it('should handle close button keyboard events', () => {
      manager.bindEvents();
      const closeSpy = vi.spyOn(manager, 'close');

      // Test Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      mockElements.previewsidenavclose.dispatchEvent(enterEvent);
      expect(closeSpy).toHaveBeenCalled();

      closeSpy.mockClear();

      // Test Space key
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      mockElements.previewsidenavclose.dispatchEvent(spaceEvent);
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle ELPX download request from preview', async () => {
      manager.bindEvents();
      const mockExport = vi.fn().mockResolvedValue();
      window.eXeLearning.app.project.exportToElpxViaYjs = mockExport;

      const event = new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
      });
      window.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockExport).toHaveBeenCalledWith({ saveAs: true });
    });

    it('should show error when exportToElpxViaYjs not available', async () => {
      manager.bindEvents();
      window.eXeLearning.app.project.exportToElpxViaYjs = undefined;

      // Mock alert
      const originalAlert = window.alert;
      window.alert = vi.fn();

      const event = new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
      });
      window.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(window.alert).toHaveBeenCalled();

      window.alert = originalAlert;
    });

    it('should handle ELPX export error', async () => {
      manager.bindEvents();
      window.eXeLearning.app.project.exportToElpxViaYjs = vi.fn().mockRejectedValue(new Error('Export failed'));

      const originalAlert = window.alert;
      window.alert = vi.fn();

      const event = new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
      });
      window.dispatchEvent(event);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Export failed'));

      window.alert = originalAlert;
    });
  });

  describe('refresh with SW wait', () => {
    it('should wait for SW when no controller but waitForPreviewServiceWorker available', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        writable: true,
        configurable: true,
      });

      const waitSpy = vi.fn().mockResolvedValue({});
      window.eXeLearning.app.waitForPreviewServiceWorker = waitSpy;

      vi.spyOn(manager, 'isServiceWorkerPreviewAvailable').mockReturnValue(true);
      vi.spyOn(manager, 'refreshWithServiceWorker').mockResolvedValue();

      await manager.refresh();

      expect(waitSpy).toHaveBeenCalled();
    });

    it('should prevent concurrent refreshes', async () => {
      manager.isLoading = true;
      const swRefreshSpy = vi.spyOn(manager, 'refreshWithServiceWorker');

      await manager.refresh();

      expect(swRefreshSpy).not.toHaveBeenCalled();
    });
  });

});

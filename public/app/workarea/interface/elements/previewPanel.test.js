import PreviewPanelManager from './previewPanel.js';

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

      manager.init();

      expect(bindSpy).toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalled();
      expect(restoreSpy).toHaveBeenCalled();
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
  });

});

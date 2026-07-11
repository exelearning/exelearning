import PreviewPanelManager from './previewPanel.js';
import { PreviewSessionExpiredError } from './preview/providerContract.js';

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

/**
 * Build a fake transport provider matching the PreviewResourceProvider shape.
 * Defaults to an opaque-safe HTTP provider; override `mode`/`opaqueSafe`/methods
 * as needed (e.g. `mode: 'static-service-worker', opaqueSafe: false` for the
 * standalone static/PWA path).
 */
function createFakeProvider(overrides = {}) {
  return {
    mode: 'http',
    opaqueSafe: true,
    prepare: vi.fn().mockResolvedValue({
      id: 'sess-1',
      entryUrl: '/test/preview/sess-1/index.html?exe-teacher=1',
      mode: 'http',
      opaqueSafe: true,
    }),
    update: vi.fn().mockResolvedValue(undefined),
    resolvePage: vi.fn().mockResolvedValue({
      kind: 'url',
      url: '/test/preview/sess-1/index.html?exe-teacher=1&v=0',
    }),
    getFile: vi.fn().mockResolvedValue(null),
    dispose: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PreviewPanelManager', () => {
  let manager;
  let mockElements;
  let mockProject;
  let mockBridge;
  let mockDocumentManager;
  let mockYdoc;
  let previewWin;
  let pinnedWin;

  beforeEach(() => {
    // Mock DOM elements
    mockElements = {
      previewsidenav: document.createElement('div'),
      'preview-sidenav-overlay': document.createElement('div'),
      previewsidenavclose: document.createElement('button'),
      'preview-extract-button': document.createElement('button'),
      'preview-pin-button': document.createElement('button'),
      'preview-refresh-button': document.createElement('button'),
      'preview-mobile-button': document.createElement('button'),
      'preview-iframe': document.createElement('iframe'),
      'preview-pinned-container': document.createElement('div'),
      'preview-pinned-iframe': document.createElement('iframe'),
      'preview-pinned-extract-button': document.createElement('button'),
      'preview-unpin-button': document.createElement('button'),
      'preview-pinned-refresh-button': document.createElement('button'),
      'preview-pinned-mobile-button': document.createElement('button'),
      workarea: document.createElement('div'),
    };

    // Add nested elements for loading states; place the iframes inside the
    // bodies so parentElement matches the real DOM (used by viewport toggling).
    const panelBody = document.createElement('div');
    panelBody.className = 'preview-panel-body';
    panelBody.appendChild(mockElements['preview-iframe']);
    mockElements.previewsidenav.appendChild(panelBody);

    const pinnedBody = document.createElement('div');
    pinnedBody.className = 'preview-pinned-body';
    pinnedBody.appendChild(mockElements['preview-pinned-iframe']);
    mockElements['preview-pinned-container'].appendChild(pinnedBody);

    // Give the iframes stable contentWindow identities so source validation
    // (event.source === iframe.contentWindow) is testable in happy-dom.
    previewWin = { name: 'preview-win' };
    pinnedWin = { name: 'pinned-win' };
    for (const key of ['preview-iframe', 'preview-pinned-iframe']) {
      const win = key === 'preview-iframe' ? previewWin : pinnedWin;
      Object.defineProperty(mockElements[key], 'contentWindow', { value: win, configurable: true });
      // Back `src` with the attribute so setting a real URL does not trigger
      // happy-dom's network navigation (which would fire ECONNREFUSED noise).
      Object.defineProperty(mockElements[key], 'src', {
        configurable: true,
        get() { return this.getAttribute('src') || ''; },
        set(value) { this.setAttribute('src', value); },
      });
    }

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

    // Mock eXeLearning global. Server mode → HTTP (opaque) preview transport.
    window.eXeLearning = {
      app: {
        project: mockProject,
        config: { basePath: '/test', version: 'v3' },
        getBasePath: () => '/test',
        runtimeConfig: { mode: 'server', isEmbedded: false, embeddingConfig: null },
        capabilities: { preview: { transport: 'http', extractToNewTab: true } },
        themes: { selected: { id: 'base' } },
      },
    };

    // Mock SharedExporters (the panel generates files then hands them to the provider).
    window.SharedExporters = {
      generatePreviewForSW: vi.fn().mockResolvedValue({
        success: true,
        files: { 'index.html': new TextEncoder().encode('<!DOCTYPE html><html><body>x</body></html>') },
      }),
      // Layered pipeline used ONLY by the http transport (serving contract v2).
      generatePreviewLayered: vi.fn().mockResolvedValue({
        success: true,
        documents: new Map([['index.html', '<!DOCTYPE html><html><body>x</body></html>']]),
        assetRefs: new Map(),
        fixedRefs: new Map(),
        getAssetBytes: vi.fn(async () => null),
        resolveFixedResource: vi.fn(async () => null),
      }),
      PREVIEW_SANDBOX: 'allow-scripts allow-popups allow-forms',
    };

    // Short-circuit the media-bridge loader so _initProvider does not inject scripts.
    window.exeMediaHost = {
      attach: vi.fn(() => ({ detach: vi.fn() })),
      _youtubeAdapter: vi.fn(),
      _vimeoAdapter: vi.fn(),
    };

    // Mock URL methods
    global.URL.createObjectURL = vi.fn(() => 'blob:test-url');
    global.URL.revokeObjectURL = vi.fn();

    // The panel sets real /preview/... URLs on the iframes; stub fetch so
    // happy-dom's iframe loader does not attempt (and log) real network calls.
    window.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));

    // Mock i18n function
    globalThis._ = vi.fn((key) => key);

    manager = new PreviewPanelManager();
  });

  afterEach(() => {
    // Cancel any embed-reflow timers a test scheduled so a 400/900ms timer can
    // never outlive the test and fire against a torn-down/partial media host.
    manager?._clearEmbedReflowTimers?.();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.exeMediaHost;
  });

  describe('constructor', () => {
    it('should initialize with default values and elements', () => {
      expect(manager.isOpen).toBe(false);
      expect(manager.isPinned).toBe(false);
      expect(manager.panel).toBe(mockElements.previewsidenav);
      expect(manager._provider).toBeNull();
      expect(manager._session).toBeNull();
    });
  });

  describe('viewport toggle', () => {
    beforeEach(() => {
      try {
        window.sessionStorage.clear();
      } catch {
        // ignore
      }
    });

    it('should default to desktop viewport', () => {
      expect(manager.isMobileViewport).toBe(false);
    });

    it('should toggle to mobile and back on toggleViewport()', () => {
      const body = mockElements['preview-iframe'].parentElement;
      const pinnedBody = mockElements['preview-pinned-iframe'].parentElement;

      manager.toggleViewport();
      expect(manager.isMobileViewport).toBe(true);
      expect(body.classList.contains('preview-mobile-viewport')).toBe(true);
      expect(pinnedBody.classList.contains('preview-mobile-viewport')).toBe(true);
      expect(mockElements['preview-mobile-button'].getAttribute('aria-pressed')).toBe('true');
      expect(mockElements['preview-pinned-mobile-button'].getAttribute('aria-pressed')).toBe('true');

      manager.toggleViewport();
      expect(manager.isMobileViewport).toBe(false);
      expect(body.classList.contains('preview-mobile-viewport')).toBe(false);
      expect(mockElements['preview-mobile-button'].getAttribute('aria-pressed')).toBe('false');
    });

    it('should persist the viewport choice to sessionStorage', () => {
      manager.toggleViewport();
      expect(window.sessionStorage.getItem('exe-preview-viewport')).toBe('mobile');
      manager.toggleViewport();
      expect(window.sessionStorage.getItem('exe-preview-viewport')).toBe('desktop');
    });

    it('should restore a persisted mobile choice on construction and apply it', () => {
      window.sessionStorage.setItem('exe-preview-viewport', 'mobile');
      const restored = new PreviewPanelManager();
      expect(restored.isMobileViewport).toBe(true);

      restored.applyViewport();
      expect(mockElements['preview-iframe'].parentElement.classList.contains('preview-mobile-viewport')).toBe(true);
    });

    it('should not throw when sessionStorage is unavailable', () => {
      const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
      Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get() {
          throw new Error('blocked');
        },
      });
      try {
        expect(() => new PreviewPanelManager().toggleViewport()).not.toThrow();
      } finally {
        if (original) {
          Object.defineProperty(window, 'sessionStorage', original);
        }
      }
    });
  });

  describe('init', () => {
    it('should select a provider, bind events, subscribe, and set up the dispose lifecycle', () => {
      const initProviderSpy = vi.spyOn(manager, '_initProvider');
      const bindSpy = vi.spyOn(manager, 'bindEvents');
      const subscribeSpy = vi.spyOn(manager, 'subscribeToChanges');
      const resetSpy = vi.spyOn(manager, 'resetToDefaultState').mockImplementation(() => {});
      const disposeLifecycleSpy = vi.spyOn(manager, '_setupDisposeLifecycle');

      manager.init();

      expect(initProviderSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalled();
      expect(resetSpy).toHaveBeenCalled();
      expect(disposeLifecycleSpy).toHaveBeenCalled();
      // Server mode → HTTP (opaque) transport: no legacy SW recovery machinery.
      expect(manager._provider.mode).toBe('http');
    });

    it('should NOT install SW recovery listeners for an opaque transport', () => {
      const visibilitySpy = vi.spyOn(manager, '_setupVisibilityHandler');
      const broadcastSpy = vi.spyOn(manager, '_setupBroadcastChannelListener');
      const swListenerSpy = vi.spyOn(manager, '_setupServiceWorkerListener');

      manager.init();

      expect(visibilitySpy).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
      expect(swListenerSpy).not.toHaveBeenCalled();
    });

    it('should install SW recovery listeners for the static Service Worker transport', () => {
      window.eXeLearning.app.runtimeConfig.embeddingConfig = { previewTransport: 'static-service-worker' };
      const visibilitySpy = vi.spyOn(manager, '_setupVisibilityHandler');
      const broadcastSpy = vi.spyOn(manager, '_setupBroadcastChannelListener');
      const swListenerSpy = vi.spyOn(manager, '_setupServiceWorkerListener');

      manager.init();

      expect(manager._provider.mode).toBe('static-service-worker');
      expect(visibilitySpy).toHaveBeenCalled();
      expect(broadcastSpy).toHaveBeenCalled();
      expect(swListenerSpy).toHaveBeenCalled();
    });
  });

  describe('_initProvider', () => {
    it('enforces the opaque sandbox on both preview iframes in server mode', () => {
      manager._initProvider();

      expect(mockElements['preview-iframe'].getAttribute('sandbox')).toBe('allow-scripts allow-popups allow-forms');
      expect(mockElements['preview-pinned-iframe'].getAttribute('sandbox')).toBe(
        'allow-scripts allow-popups allow-forms',
      );
    });

    it('attaches the media relay to both iframes for opaque transports', async () => {
      manager._initProvider();

      // Media relay attach is async (lazy bridge load); flush microtasks.
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(manager._mediaHost).not.toBeNull();
      expect(window.exeMediaHost.attach).toHaveBeenCalledTimes(2);
    });

    it('applies the same-origin sandbox (no media relay) for the static Service Worker transport', () => {
      window.eXeLearning.app.runtimeConfig.embeddingConfig = { previewTransport: 'static-service-worker' };

      manager._initProvider();

      expect(mockElements['preview-iframe'].getAttribute('sandbox')).toContain('allow-same-origin');
      expect(manager._mediaHost).toBeNull();
    });

    it('leaves the provider null when selection throws (no silent downgrade)', () => {
      window.eXeLearning.app.runtimeConfig.embeddingConfig = { previewTransport: 'bogus-transport' };

      manager._initProvider();

      expect(manager._provider).toBeNull();
    });

    it('fails closed for an embedded editor without previewHttp (provider null)', () => {
      window.eXeLearning.app.runtimeConfig = { mode: 'embedded', isEmbedded: true, embeddingConfig: {} };

      manager._initProvider();

      expect(manager._provider).toBeNull();
    });

    it('selects the opaque HTTP provider for an embedded editor with a valid previewHttp block', () => {
      window.eXeLearning.app.runtimeConfig = {
        mode: 'embedded',
        isEmbedded: true,
        embeddingConfig: {
          previewHttp: {
            protocolVersion: 2,
            managementBaseUrl: '/mod/exelearning/preview_session.php',
            servingBaseUrl: '/mod/exelearning/preview.php',
          },
        },
      };

      manager._initProvider();

      expect(manager._provider).not.toBeNull();
      expect(manager._provider.mode).toBe('http');
      expect(manager._provider.opaqueSafe).toBe(true);
      // No unsafe banner: HTTP is the opaque-safe embedded transport.
      expect(mockElements.previewsidenav.querySelector('.preview-unsafe-banner')).toBeNull();
    });

    it('fails closed for an embedded editor with a malformed previewHttp block', () => {
      window.eXeLearning.app.runtimeConfig = {
        mode: 'embedded',
        isEmbedded: true,
        embeddingConfig: { previewHttp: { protocolVersion: 1, managementBaseUrl: '/a', servingBaseUrl: '/b' } },
      };

      manager._initProvider();

      expect(manager._provider).toBeNull();
    });

    it('shows the unsafe-transport banner when an embedded editor overrides to the static SW', () => {
      window.eXeLearning.app.runtimeConfig = {
        mode: 'embedded',
        isEmbedded: true,
        embeddingConfig: { previewTransport: 'static-service-worker' },
      };

      manager._initProvider();

      expect(manager._provider.mode).toBe('static-service-worker');
      const banner = mockElements.previewsidenav.querySelector('.preview-unsafe-banner');
      expect(banner).not.toBeNull();
      expect(banner.getAttribute('role')).toBe('alert');
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

      it('should return true when popup is open', () => {
        manager.isOpen = false;
        manager.isPinned = false;
        manager._popupWindow = { closed: false };
        expect(manager._isPreviewVisible()).toBe(true);
      });

      it('should return false when popup is closed', () => {
        manager.isOpen = false;
        manager.isPinned = false;
        manager._popupWindow = { closed: true };
        expect(manager._isPreviewVisible()).toBe(false);
      });

      it('should return false when neither open, pinned, nor popup', () => {
        manager.isOpen = false;
        manager.isPinned = false;
        manager._popupWindow = null;
        expect(manager._isPreviewVisible()).toBe(false);
      });
    });

    describe('_isPopupOpen', () => {
      it('should return true when popup exists and is not closed', () => {
        manager._popupWindow = { closed: false };
        expect(manager._isPopupOpen()).toBe(true);
      });

      it('should return false when popup is null', () => {
        manager._popupWindow = null;
        expect(manager._isPopupOpen()).toBe(false);
      });

      it('should return false when popup is closed', () => {
        manager._popupWindow = { closed: true };
        expect(manager._isPopupOpen()).toBe(false);
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

    describe('CONTENT_NEEDED message handling (static Service Worker transport)', () => {
      beforeEach(() => {
        manager._provider = createFakeProvider({ mode: 'static-service-worker', opaqueSafe: false });
      });

      it('should refresh when CONTENT_NEEDED received and preview is open', () => {
        vi.useFakeTimers();
        manager.bindEvents();
        manager.isOpen = true;
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();

        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' },
          source: previewWin,
        }));

        vi.advanceTimersByTime(150);

        expect(refreshSpy).toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should not refresh when CONTENT_NEEDED received but preview is closed', () => {
        vi.useFakeTimers();
        manager.bindEvents();
        manager.isOpen = false;
        manager.isPinned = false;
        const refreshSpy = vi.spyOn(manager, 'refresh');

        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' },
          source: previewWin,
        }));

        vi.advanceTimersByTime(150);

        expect(refreshSpy).not.toHaveBeenCalled();
        vi.useRealTimers();
      });

      it('should be ignored entirely for an opaque (non-SW) transport', () => {
        vi.useFakeTimers();
        manager._provider = createFakeProvider({ mode: 'http', opaqueSafe: true });
        manager.bindEvents();
        manager.isOpen = true;
        const refreshSpy = vi.spyOn(manager, 'refresh');

        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' },
          source: previewWin,
        }));

        vi.advanceTimersByTime(150);

        expect(refreshSpy).not.toHaveBeenCalled();
        vi.useRealTimers();
      });
    });

    describe('BroadcastChannel recovery', () => {
      it('should setup BroadcastChannel listener', () => {
        const originalBC = globalThis.BroadcastChannel;
        let capturedChannel = null;
        globalThis.BroadcastChannel = class {
          constructor(name) { this.name = name; capturedChannel = this; }
          close() {}
        };

        manager._setupBroadcastChannelListener();

        expect(capturedChannel).not.toBeNull();
        expect(capturedChannel.name).toBe('exe-preview-recovery');
        expect(manager._recoveryChannel).toBe(capturedChannel);

        globalThis.BroadcastChannel = originalBC;
      });

      it('should refresh when PREVIEW_CONTENT_LOST received', async () => {
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();

        const originalBC = globalThis.BroadcastChannel;
        let onMessageHandler = null;
        globalThis.BroadcastChannel = class {
          constructor() {}
          set onmessage(handler) { onMessageHandler = handler; }
          get onmessage() { return onMessageHandler; }
          close() {}
        };

        manager._setupBroadcastChannelListener();
        onMessageHandler({ data: { type: 'PREVIEW_CONTENT_LOST' } });

        await vi.waitFor(() => {
          expect(refreshSpy).toHaveBeenCalled();
        });

        globalThis.BroadcastChannel = originalBC;
      });

      it('should not crash if BroadcastChannel is unavailable', () => {
        const originalBC = globalThis.BroadcastChannel;
        delete globalThis.BroadcastChannel;

        expect(() => manager._setupBroadcastChannelListener()).not.toThrow();
        expect(manager._recoveryChannel).toBeNull();

        globalThis.BroadcastChannel = originalBC;
      });
    });

    describe('SW message listener', () => {
      it('should setup navigator.serviceWorker message listener', () => {
        const addEventSpy = vi.fn();
        const originalSW = navigator.serviceWorker;
        Object.defineProperty(navigator, 'serviceWorker', {
          value: { addEventListener: addEventSpy, removeEventListener: vi.fn() },
          configurable: true,
        });

        manager._setupServiceWorkerListener();

        expect(addEventSpy).toHaveBeenCalledWith('message', expect.any(Function));
        expect(manager._swMessageHandler).toBeDefined();

        Object.defineProperty(navigator, 'serviceWorker', { value: originalSW, configurable: true });
      });

      it('should refresh when CONTENT_NEEDED received and popup open', () => {
        vi.useFakeTimers();
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();
        manager._popupWindow = { closed: false };

        let capturedHandler;
        const originalSW = navigator.serviceWorker;
        Object.defineProperty(navigator, 'serviceWorker', {
          value: {
            addEventListener: (type, handler) => { capturedHandler = handler; },
            removeEventListener: vi.fn(),
          },
          configurable: true,
        });

        manager._setupServiceWorkerListener();
        capturedHandler({ data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' } });
        vi.advanceTimersByTime(150);

        expect(refreshSpy).toHaveBeenCalled();

        Object.defineProperty(navigator, 'serviceWorker', { value: originalSW, configurable: true });
        vi.useRealTimers();
      });

      it('should not refresh when preview is not visible', () => {
        vi.useFakeTimers();
        const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();
        manager.isOpen = false;
        manager.isPinned = false;
        manager._popupWindow = null;

        let capturedHandler;
        const originalSW = navigator.serviceWorker;
        Object.defineProperty(navigator, 'serviceWorker', {
          value: {
            addEventListener: (type, handler) => { capturedHandler = handler; },
            removeEventListener: vi.fn(),
          },
          configurable: true,
        });

        manager._setupServiceWorkerListener();
        capturedHandler({ data: { type: 'CONTENT_NEEDED', reason: 'SW restarted' } });
        vi.advanceTimersByTime(150);

        expect(refreshSpy).not.toHaveBeenCalled();

        Object.defineProperty(navigator, 'serviceWorker', { value: originalSW, configurable: true });
        vi.useRealTimers();
      });
    });

    describe('popup monitor', () => {
      it('should start monitoring on _setupPopupMonitor', () => {
        vi.useFakeTimers();
        manager._popupWindow = { closed: false };

        manager._setupPopupMonitor();

        expect(manager._popupMonitorTimer).not.toBeNull();
        vi.useRealTimers();
      });

      it('should clear popup reference when popup closes', () => {
        vi.useFakeTimers();
        const popup = { closed: false };
        manager._popupWindow = popup;

        manager._setupPopupMonitor();

        popup.closed = true;
        vi.advanceTimersByTime(2500);

        expect(manager._popupWindow).toBeNull();
        expect(manager._popupMonitorTimer).toBeNull();
        vi.useRealTimers();
      });

      it('should not clear popup reference while popup is open', () => {
        vi.useFakeTimers();
        manager._popupWindow = { closed: false };

        manager._setupPopupMonitor();

        vi.advanceTimersByTime(2500);

        expect(manager._popupWindow).not.toBeNull();
        vi.useRealTimers();
      });

      it('should clear monitor on _clearPopupMonitor', () => {
        vi.useFakeTimers();
        manager._popupWindow = { closed: false };
        manager._setupPopupMonitor();

        manager._clearPopupMonitor();

        expect(manager._popupMonitorTimer).toBeNull();
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

    it('close() does NOT dispose the provider (fast reopen; TTL owns cleanup)', () => {
      manager._provider = createFakeProvider();
      manager.isOpen = true;

      manager.close();

      expect(manager._provider.dispose).not.toHaveBeenCalled();
    });

    it('close() tears down the embed overlays so no video lingers over the editor', () => {
      manager._mediaHost = { hideEmbedOverlays: vi.fn() };
      manager.isOpen = true;

      manager.close();

      expect(manager._mediaHost.hideEmbedOverlays).toHaveBeenCalledTimes(1);
    });

    it('open() schedules an embed-overlay reflow (panel slide settles after a transform)', async () => {
      // Mock the scheduler to a no-op so open() does not leak real 400/900ms
      // timers into later tests; the real scheduling behavior is covered below.
      const spy = vi.spyOn(manager, '_scheduleEmbedReflow').mockImplementation(() => {});
      vi.spyOn(manager, 'refresh').mockResolvedValue(undefined);
      await manager.open();
      expect(spy).toHaveBeenCalled();
    });

    it('_scheduleEmbedReflow reflows the overlays via the media host after the transition', () => {
      vi.useFakeTimers();
      manager._mediaHost = { reflowEmbedOverlays: vi.fn() };
      manager._scheduleEmbedReflow();
      vi.advanceTimersByTime(1000);
      expect(manager._mediaHost.reflowEmbedOverlays).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('cancels pending embed-reflow timers on destroy so they never fire after teardown', () => {
      vi.useFakeTimers();
      const reflow = vi.fn();
      manager._mediaHost = { reflowEmbedOverlays: reflow, detachAll: vi.fn() };
      manager._scheduleEmbedReflow();
      expect(manager._embedReflowTimers).not.toBeNull();

      manager.destroy();
      expect(manager._embedReflowTimers).toBeNull();

      vi.advanceTimersByTime(1000);
      expect(reflow).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('does not throw when a reflow timer fires with a media host missing the method', () => {
      vi.useFakeTimers();
      // A partial media host (or one torn down mid-animation): the optional call
      // must no-op rather than throw an unhandled error.
      manager._mediaHost = {};
      manager._scheduleEmbedReflow();
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
      vi.useRealTimers();
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

    it('unpin() and pin() tear down the embed overlays before swapping the active iframe', async () => {
      vi.spyOn(manager, 'refresh').mockImplementation(() => Promise.resolve());
      manager._mediaHost = { hideEmbedOverlays: vi.fn() };

      manager.isPinned = true;
      manager.unpin();
      expect(manager._mediaHost.hideEmbedOverlays).toHaveBeenCalledTimes(1);

      await manager.pin();
      expect(manager._mediaHost.hideEmbedOverlays).toHaveBeenCalledTimes(2);
    });

    it('should reuse the same provider session across pin/unpin', async () => {
      const provider = createFakeProvider();
      manager._provider = provider;
      manager.isOpen = true;

      await manager.refresh();
      const sessionAfterFirst = manager._session;
      await manager.pin();

      expect(provider.prepare).toHaveBeenCalledTimes(1);
      expect(provider.update).toHaveBeenCalled();
      expect(manager._session).toBe(sessionAfterFirst);
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      manager._provider = createFakeProvider();
    });

    it('prepares the session on first run and renders index.html (layered input for http)', async () => {
      await manager.refresh();

      // The http transport uses the layered pipeline, never the full file map.
      expect(window.SharedExporters.generatePreviewLayered).toHaveBeenCalled();
      expect(window.SharedExporters.generatePreviewForSW).not.toHaveBeenCalled();
      expect(manager._provider.prepare).toHaveBeenCalledWith(
        expect.objectContaining({
          documents: expect.any(Map),
          assetRefs: expect.any(Map),
          fixedRefs: expect.any(Map),
          getAssetBytes: expect.any(Function),
        }),
      );
      expect(manager._session).toEqual(expect.objectContaining({ id: 'sess-1' }));
      expect(manager._provider.resolvePage).toHaveBeenCalledWith('index.html');
      expect(mockElements['preview-iframe'].getAttribute('src')).toContain('/test/preview/sess-1/index.html');
      expect(mockElements['preview-iframe'].dataset.previewPage).toBe('index.html');
    });

    it('feeds the previous documents back into the generator for page reuse', async () => {
      const documents = new Map([['index.html', '<html>v1</html>']]);
      window.SharedExporters.generatePreviewLayered.mockResolvedValue({
        success: true,
        documents,
        assetRefs: new Map(),
        fixedRefs: new Map(),
        getAssetBytes: vi.fn(),
      });

      await manager.refresh();
      await manager.refresh();

      const calls = window.SharedExporters.generatePreviewLayered.mock.calls;
      expect(calls[0][4]).toEqual(expect.objectContaining({ previousDocuments: null, dirtyPages: 'all' }));
      expect(calls[1][4]).toEqual(expect.objectContaining({ previousDocuments: documents }));
    });

    it('updates the existing session on subsequent runs', async () => {
      await manager.refresh();
      await manager.refresh();

      expect(manager._provider.prepare).toHaveBeenCalledTimes(1);
      expect(manager._provider.update).toHaveBeenCalledTimes(1);
    });

    it('re-prepares when the session expired mid-update', async () => {
      await manager.refresh();
      manager._provider.update.mockRejectedValueOnce(new PreviewSessionExpiredError('gone'));

      await manager.refresh();

      expect(manager._provider.prepare).toHaveBeenCalledTimes(2);
    });

    it('surfaces provider errors via showError with no fallback transport', async () => {
      manager._provider.prepare.mockRejectedValue(new Error('sync failed'));
      const errorSpy = vi.spyOn(manager, 'showError').mockImplementation(() => {});

      await manager.refresh();

      expect(errorSpy).toHaveBeenCalledWith('sync failed');
    });

    it('shows an error and returns when there is no provider', async () => {
      manager._provider = null;
      const errorSpy = vi.spyOn(manager, 'showError').mockImplementation(() => {});

      await manager.refresh();

      expect(errorSpy).toHaveBeenCalled();
      expect(window.SharedExporters.generatePreviewForSW).not.toHaveBeenCalled();
    });

    it('preserves the current page across auto-refresh', async () => {
      manager._currentPagePath = 'html/p2.html';

      await manager.refresh();

      expect(manager._provider.resolvePage).toHaveBeenCalledWith('html/p2.html');
    });

    it('prevents concurrent refreshes', async () => {
      manager.isLoading = true;

      await manager.refresh();

      expect(manager._provider.prepare).not.toHaveBeenCalled();
    });

    it('waits for the Service Worker on the static SW transport when there is no controller', async () => {
      manager._provider = createFakeProvider({ mode: 'static-service-worker', opaqueSafe: false });
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { controller: null },
        writable: true,
        configurable: true,
      });
      const waitSpy = vi.fn().mockResolvedValue({});
      window.eXeLearning.app.waitForPreviewServiceWorker = waitSpy;

      await manager.refresh();

      expect(waitSpy).toHaveBeenCalled();
    });

    it('keeps the static SW transport on the full generatePreviewForSW path', async () => {
      manager._provider = createFakeProvider({ mode: 'static-service-worker', opaqueSafe: false });

      await manager.refresh();

      expect(window.SharedExporters.generatePreviewForSW).toHaveBeenCalled();
      expect(window.SharedExporters.generatePreviewLayered).not.toHaveBeenCalled();
      // The provider receives the plain file map, not the layered shape.
      expect(manager._provider.prepare).toHaveBeenCalledWith(
        expect.objectContaining({ 'index.html': expect.anything() }),
      );
    });
  });

  describe('refresh queue (single-flight + lossless coalescing)', () => {
    beforeEach(() => {
      manager._provider = createFakeProvider();
    });

    /** Install a tracker fake so scope consumption/merging is observable. */
    function installTracker() {
      const tracker = {
        scopes: [{ pages: new Set(['page-1']), assetIds: new Set() }],
        consumed: [],
        merged: [],
        consume: vi.fn(() => tracker.scopes.shift() || { pages: new Set(), assetIds: new Set() }),
        merge: vi.fn((scope) => tracker.merged.push(scope)),
        markAll: vi.fn(),
        detach: vi.fn(),
      };
      manager._invalidation = tracker;
      return tracker;
    }

    it('coalesces a refresh requested mid-round into exactly one follow-up round', async () => {
      const tracker = installTracker();
      tracker.scopes = [
        { pages: new Set(['page-1']), assetIds: new Set() },
        { pages: new Set(['page-2']), assetIds: new Set() },
      ];

      let resolveFirstSync;
      manager._provider.prepare.mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveFirstSync = () => resolve({ id: 'sess-1', mode: 'http' });
        }),
      );

      const first = manager.refresh();
      await vi.waitFor(() => expect(resolveFirstSync).toBeDefined());

      // Three edits land while the first round is in flight.
      manager.refresh();
      manager.refresh();
      manager.refresh();
      expect(manager._pendingRefresh).toBe(true);

      resolveFirstSync();
      await first;

      // Exactly ONE follow-up round ran, with the scope accumulated meanwhile.
      expect(tracker.consume).toHaveBeenCalledTimes(2);
      const generatorCalls = window.SharedExporters.generatePreviewLayered.mock.calls;
      expect(generatorCalls).toHaveLength(2);
      expect([...generatorCalls[1][4].dirtyPages]).toEqual(['page-2']);
      expect(manager._pendingRefresh).toBe(false);
      expect(manager.isLoading).toBe(false);
    });

    it('coalesces mid-round refreshes into exactly one follow-up round on the static SW transport', async () => {
      // The single-flight loop is transport-agnostic; the static SW path
      // regenerates the full map each round (no dirty scope), so the follow-up
      // round must still run exactly once and pick up the latest content.
      manager._provider = createFakeProvider({ mode: 'static-service-worker', opaqueSafe: false });

      let resolveFirstSync;
      manager._provider.prepare.mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveFirstSync = () => resolve({ id: 'sess-sw', mode: 'static-service-worker' });
        }),
      );

      const first = manager.refresh();
      await vi.waitFor(() => expect(resolveFirstSync).toBeDefined());

      // Several edits land while the first round is in flight.
      manager.refresh();
      manager.refresh();
      expect(manager._pendingRefresh).toBe(true);

      resolveFirstSync();
      await first;

      // Exactly one follow-up round ran on the full-map SW path (never the
      // layered pipeline), and the queue drained.
      expect(window.SharedExporters.generatePreviewForSW).toHaveBeenCalledTimes(2);
      expect(window.SharedExporters.generatePreviewLayered).not.toHaveBeenCalled();
      expect(manager._pendingRefresh).toBe(false);
      expect(manager.isLoading).toBe(false);
    });

    it('merges the consumed scope back when a round fails', async () => {
      const tracker = installTracker();
      const scope = { pages: new Set(['page-1']), assetIds: new Set(['asset-1']) };
      tracker.scopes = [scope];
      manager._provider.prepare.mockRejectedValue(new Error('boom'));
      vi.spyOn(manager, 'showError').mockImplementation(() => {});

      await manager.refresh();

      expect(tracker.merge).toHaveBeenCalledWith(scope);
      expect(manager.showError).toHaveBeenCalledWith('boom');
      expect(manager.isLoading).toBe(false);
    });

    it('merges the scope back when generation itself fails', async () => {
      const tracker = installTracker();
      const scope = { pages: new Set(['page-1']), assetIds: new Set() };
      tracker.scopes = [scope];
      window.SharedExporters.generatePreviewLayered.mockResolvedValueOnce({ success: false, error: 'gen failed' });
      vi.spyOn(manager, 'showError').mockImplementation(() => {});

      await manager.refresh();

      expect(tracker.merge).toHaveBeenCalledWith(scope);
      expect(manager.showError).toHaveBeenCalledWith('gen failed');
    });

    it('reschedules (debounced) a request that arrived during a failed round', async () => {
      vi.useFakeTimers();
      const tracker = installTracker();
      let rejectFirst;
      manager._provider.prepare.mockImplementationOnce(
        () => new Promise((_, reject) => {
          rejectFirst = () => reject(new Error('boom'));
        }),
      );
      vi.spyOn(manager, 'showError').mockImplementation(() => {});

      const first = manager.refresh();
      await vi.waitFor(() => expect(rejectFirst).toBeDefined());
      manager.refresh(); // arrives mid-failure
      rejectFirst();
      await first;

      expect(manager._pendingRefresh).toBe(false);
      expect(manager.refreshDebounceTimer).not.toBeNull();
      vi.useRealTimers();
    });

    it('forceRefresh marks everything dirty and refreshes immediately', async () => {
      const tracker = installTracker();

      await manager.forceRefresh();

      expect(tracker.markAll).toHaveBeenCalled();
      expect(tracker.consume).toHaveBeenCalled();
      expect(manager.refreshDebounceTimer).toBeNull();
    });

    it('extractToNewTab awaits the in-flight refresh instead of starting a concurrent sync', async () => {
      const tracker = installTracker();
      tracker.scopes = [
        { pages: new Set(['page-1']), assetIds: new Set() },
        { pages: new Set(['page-2']), assetIds: new Set() },
      ];
      manager._session = { id: 'sess-1', mode: 'http' };
      window.open = vi.fn(() => ({ closed: false, focus: vi.fn() }));

      // Hold the first refresh round open.
      let resolveFirstSync;
      manager._provider.update.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirstSync = resolve; }),
      );

      const refreshing = manager.refresh();
      await vi.waitFor(() => expect(resolveFirstSync).toBeDefined());
      expect(manager.isLoading).toBe(true);

      // Extract fires mid-refresh: it must NOT open the tab yet, and must NOT run
      // a second concurrent generation (no third generator call appears until the
      // in-flight cycle — plus the coalesced follow-up round — completes).
      const extracting = manager.extractToNewTab();
      expect(window.open).not.toHaveBeenCalled();
      expect(manager._pendingRefresh).toBe(true);

      resolveFirstSync({ id: 'sess-1', mode: 'http' });
      await refreshing;
      await extracting;

      // Exactly the two coalesced rounds ran (no concurrent extra sync), and the
      // tab opened only after the sync settled.
      expect(window.SharedExporters.generatePreviewLayered.mock.calls).toHaveLength(2);
      expect(window.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToChanges (layered classification for http)', () => {
    it('delegates classification to the invalidation tracker for the http transport', () => {
      manager._provider = createFakeProvider({ mode: 'http' });

      manager.subscribeToChanges();

      expect(manager._invalidation).not.toBeNull();
      // No blanket ydoc listener: bookkeeping transactions must not refresh.
      expect(mockYdoc.on).not.toHaveBeenCalled();
      expect(manager._onYdocUpdate).toBeNull();
      expect(manager._unsubscribeStructure).toBeNull();
      // The tracker subscribed through the bridge's structure observer relay.
      expect(mockBridge.onStructureChange).toHaveBeenCalledTimes(1);
    });

    it('schedules a debounced refresh when the tracker reports a change and the panel is visible', () => {
      vi.useFakeTimers();
      manager._provider = createFakeProvider({ mode: 'http' });
      manager.subscribeToChanges();
      manager.isOpen = true;
      const refreshSpy = vi.spyOn(manager, 'refresh').mockResolvedValue();

      const structureCallback = mockBridge.onStructureChange.mock.calls[0][0];
      structureCallback([{ path: [] }]);

      expect(manager.refreshDebounceTimer).not.toBeNull();
      vi.advanceTimersByTime(500);
      expect(refreshSpy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('accumulates scope while hidden without scheduling a refresh', () => {
      vi.useFakeTimers();
      manager._provider = createFakeProvider({ mode: 'http' });
      manager.subscribeToChanges();
      manager.isOpen = false;
      manager.isPinned = false;

      const structureCallback = mockBridge.onStructureChange.mock.calls[0][0];
      structureCallback([{ path: [] }]);

      expect(manager.refreshDebounceTimer).toBeNull();
      expect(manager._invalidation.isEmpty()).toBe(false);
      vi.useRealTimers();
    });

    it('destroy() detaches the tracker and clears the layered cache', () => {
      manager._provider = createFakeProvider({ mode: 'http' });
      manager.subscribeToChanges();
      const tracker = manager._invalidation;
      const detachSpy = vi.spyOn(tracker, 'detach');
      manager._lastLayeredDocuments = new Map();

      manager.destroy();

      expect(detachSpy).toHaveBeenCalled();
      expect(manager._invalidation).toBeNull();
      expect(manager._lastLayeredDocuments).toBeNull();
    });
  });

  describe('_syncProvider', () => {
    it('prepares when there is no session yet', async () => {
      const provider = createFakeProvider();
      manager._provider = provider;

      await manager._syncProvider({ 'index.html': 'x' });

      expect(provider.prepare).toHaveBeenCalled();
      expect(manager._session).toEqual(expect.objectContaining({ id: 'sess-1' }));
    });

    it('updates with the file map when a session exists', async () => {
      const provider = createFakeProvider();
      manager._provider = provider;
      manager._session = { id: 'existing' };

      await manager._syncProvider({ 'index.html': 'x' });

      // The provider already owns its session id; update takes the file map ONLY.
      // Passing (sessionId, files) would make the provider hash the id string as
      // the file map and drop the real files (regression: reopen/auto-refresh 404).
      expect(provider.update).toHaveBeenCalledWith({ 'index.html': 'x' });
      expect(provider.prepare).not.toHaveBeenCalled();
    });

    it('re-prepares on PreviewSessionExpiredError', async () => {
      const provider = createFakeProvider();
      provider.update.mockRejectedValue(new PreviewSessionExpiredError('gone'));
      manager._provider = provider;
      manager._session = { id: 'existing' };

      await manager._syncProvider({ 'index.html': 'x' });

      expect(provider.prepare).toHaveBeenCalled();
    });

    it('rethrows non-expiry errors', async () => {
      const provider = createFakeProvider();
      provider.update.mockRejectedValue(new Error('boom'));
      manager._provider = provider;
      manager._session = { id: 'existing' };

      await expect(manager._syncProvider({ 'index.html': 'x' })).rejects.toThrow('boom');
    });
  });

  describe('_applyRenderTarget', () => {
    beforeEach(() => {
      manager._provider = createFakeProvider();
    });

    it('applies url targets: sets src, clears srcdoc, records page + sandbox', () => {
      const iframe = mockElements['preview-iframe'];
      iframe.srcdoc = 'stale';

      manager._applyRenderTarget(iframe, { kind: 'url', url: '/test/preview/sess-1/html/p.html' }, 'html/p.html');

      expect(iframe.getAttribute('src')).toContain('/test/preview/sess-1/html/p.html');
      expect(iframe.hasAttribute('srcdoc')).toBe(false);
      expect(iframe.dataset.previewPage).toBe('html/p.html');
      expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-popups allow-forms');
    });

    it('does not throw when the iframe is missing', () => {
      expect(() => manager._applyRenderTarget(null, { kind: 'url', url: 'x' }, 'index.html')).not.toThrow();
    });
  });

  describe('extractToNewTab', () => {
    it('opens the same-origin preview-host wrapper (not the raw opaque URL) for the HTTP transport', async () => {
      manager._basePath = '/test';
      manager._provider = createFakeProvider({ mode: 'http' });
      manager._session = { id: 'sess-1', entryUrl: '/test/preview/sess-1/index.html?exe-teacher=1', mode: 'http' };
      const mockOpen = vi.fn(() => ({ closed: false }));
      global.open = mockOpen;

      await manager.extractToNewTab();

      const url = mockOpen.mock.calls[0][0];
      expect(url).toContain('/test/preview-tab.html?session=sess-1');
      // Opening the raw opaque content URL directly would leave the shim parentless → video blocked.
      expect(url).not.toContain('/preview/sess-1/index.html');
      expect(manager._popupWindow).not.toBeNull();
    });

    it('opens the /viewer entry URL directly for the static Service Worker transport', async () => {
      manager._basePath = '';
      manager._provider = createFakeProvider({ mode: 'static-service-worker', opaqueSafe: false });
      manager._session = { id: 'sw-1', entryUrl: '/viewer/index.html?exe-teacher=1', mode: 'static-service-worker' };
      const mockOpen = vi.fn(() => ({ closed: false }));
      global.open = mockOpen;

      await manager.extractToNewTab();

      expect(mockOpen.mock.calls[0][0]).toContain('/viewer/index.html');
    });

    it('falls back to a link click when the popup is blocked', async () => {
      manager._provider = createFakeProvider();
      manager._session = { id: 'sess-1', entryUrl: '/test/preview/sess-1/index.html' };
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
      expect(manager._popupWindow).toBeNull();
    });
  });

  describe('_generatePreviewFiles', () => {
    it('should call SharedExporters.generatePreviewForSW with normalized deps', async () => {
      window.eXeLearning.app.themes = { selected: { name: 'base' } };
      mockBridge.resourceFetcher = null;
      mockBridge.assetManager = null;
      window.SharedExporters.generatePreviewForSW = vi.fn().mockResolvedValue({ success: true, files: {} });

      await manager._generatePreviewFiles();

      expect(window.SharedExporters.generatePreviewForSW).toHaveBeenCalledWith(
        mockDocumentManager,
        null,
        null,
        null,
        { theme: 'base' },
      );
    });

    it('throws when the Yjs document manager is unavailable', async () => {
      window.eXeLearning.app.project._yjsBridge.documentManager = null;

      await expect(manager._generatePreviewFiles()).rejects.toThrow('Yjs document manager not available');
    });

    it('throws when SharedExporters.generatePreviewForSW is unavailable', async () => {
      window.SharedExporters.generatePreviewForSW = undefined;

      await expect(manager._generatePreviewFiles()).rejects.toThrow(
        'SharedExporters.generatePreviewForSW not available',
      );
    });
  });

  describe('_isPreviewIframeSource', () => {
    it('rejects a null or undefined source (untrusted content is not trusted by default)', () => {
      expect(manager._isPreviewIframeSource(null)).toBe(false);
      expect(manager._isPreviewIframeSource(undefined)).toBe(false);
    });

    it('rejects a foreign source window', () => {
      expect(manager._isPreviewIframeSource({})).toBe(false);
    });

    it('accepts the slide-out and pinned iframe windows', () => {
      expect(manager._isPreviewIframeSource(previewWin)).toBe(true);
      expect(manager._isPreviewIframeSource(pinnedWin)).toBe(true);
    });
  });

  describe('preview iframe message contract', () => {
    beforeEach(() => {
      manager._provider = createFakeProvider();
      manager.bindEvents();
    });

    it('updates the current page on a valid exe-preview-nav report', async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'exe-preview-nav', v: 1, page: 'html/page3.html' },
        source: previewWin,
      }));
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(manager._currentPagePath).toBe('html/page3.html');
      expect(mockElements['preview-iframe'].dataset.previewPage).toBe('html/page3.html');
    });

    it('ignores messages from a non-preview source', async () => {
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'exe-preview-nav', v: 1, page: 'html/page3.html' },
        source: { hostile: true },
      }));
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(manager._currentPagePath).toBeNull();
    });

    it('rejects hostile page paths in exe-preview-nav', async () => {
      manager._currentPagePath = 'index.html';
      for (const page of ['../../secret.html', 'javascript:alert(1)', '//evil.example/x']) {
        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'exe-preview-nav', v: 1, page },
          source: previewWin,
        }));
      }
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(manager._currentPagePath).toBe('index.html');
    });

    it('opens a document via the provider on exe-preview-open-document', async () => {
      manager._provider.getFile.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
      const mockOpen = vi.fn();
      global.open = mockOpen;

      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'exe-preview-open-document', v: 1, href: 'content/resources/doc.pdf', page: 'index.html' },
        source: previewWin,
      }));
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(manager._provider.getFile).toHaveBeenCalledWith('content/resources/doc.pdf');
      expect(mockOpen).toHaveBeenCalled();
    });

    it('downloads scriptable documents (SVG/HTML/XML) instead of opening a same-origin blob (XSS guard)', async () => {
      const mockOpen = vi.fn();
      global.open = mockOpen;
      window.open = mockOpen;

      for (const href of ['evil.svg', 'evil.html', 'evil.xml', 'evil.xhtml']) {
        mockOpen.mockClear();
        global.URL.createObjectURL.mockClear();
        manager._provider.getFile.mockResolvedValue(
          new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>parent.__pwned=1</script></svg>'),
        );

        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'exe-preview-open-document', v: 1, href, page: 'index.html' },
          source: previewWin,
        }));
        await new Promise(resolve => setTimeout(resolve, 5));

        // NEVER a same-origin top-level navigation to scriptable author content.
        expect(mockOpen).not.toHaveBeenCalled();
        // Downloaded instead, with the blob coerced to inert
        // application/octet-stream (never image/svg+xml / text/html).
        const blobArg = global.URL.createObjectURL.mock.calls.at(-1)[0];
        expect(blobArg.type).toBe('application/octet-stream');
      }
    });

    it('still opens a non-scriptable document (raster image) as a blob tab', async () => {
      const mockOpen = vi.fn();
      global.open = mockOpen;
      window.open = mockOpen;
      global.URL.createObjectURL.mockClear();
      manager._provider.getFile.mockResolvedValue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));

      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'exe-preview-open-document', v: 1, href: 'content/resources/pic.png', page: 'index.html' },
        source: previewWin,
      }));
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(mockOpen).toHaveBeenCalled();
      const blobArg = global.URL.createObjectURL.mock.calls.at(-1)[0];
      expect(blobArg.type).toBe('image/png');
    });

    it('handles the exe-download-elpx request', async () => {
      const mockExport = vi.fn().mockResolvedValue();
      window.eXeLearning.app.project.exportToElpxViaYjs = mockExport;

      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
        source: previewWin,
      }));
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(mockExport).toHaveBeenCalledWith({ saveAs: true });
    });

    it('alerts when exportToElpxViaYjs is unavailable', async () => {
      window.eXeLearning.app.project.exportToElpxViaYjs = undefined;
      const originalAlert = window.alert;
      window.alert = vi.fn();

      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
        source: previewWin,
      }));
      await new Promise(resolve => setTimeout(resolve, 5));

      expect(window.alert).toHaveBeenCalled();
      window.alert = originalAlert;
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
    beforeEach(() => {
      manager._provider = createFakeProvider();
    });

    it('renders the error via srcdoc (not a blob URL) and enforces the sandbox', () => {
      manager.showError('Test error message');

      const iframe = mockElements['preview-iframe'];
      expect(iframe.srcdoc).toContain('Test error message');
      expect(iframe.hasAttribute('src')).toBe(false);
      expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-popups allow-forms');
      expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('escapes HTML in the error message', () => {
      manager.showError('<script>alert(1)</script>');

      const html = mockElements['preview-iframe'].srcdoc;
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert(1)</script>');
    });
  });

  describe('utility methods', () => {
    it('should escape HTML', () => {
      const escaped = manager.escapeHtml('<script>alert(1)</script>');
      expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

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
    it('should cleanup Yjs subscriptions', () => {
      manager.subscribeToChanges();
      const unsubscribeSpy = vi.fn();
      manager._unsubscribeStructure = unsubscribeSpy;

      manager.destroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(mockYdoc.off).toHaveBeenCalledWith('update', expect.any(Function));
    });

    it('should dispose the provider and detach the media host', () => {
      const provider = createFakeProvider();
      const detachAll = vi.fn();
      manager._provider = provider;
      manager._session = { id: 'sess-1' };
      manager._mediaHost = { detachAll };

      manager.destroy();

      expect(provider.dispose).toHaveBeenCalled();
      expect(detachAll).toHaveBeenCalled();
      expect(manager._mediaHost).toBeNull();
      expect(manager._session).toBeNull();
    });

    it('should remove the pagehide handler', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      manager._setupDisposeLifecycle();

      manager.destroy();

      expect(removeSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
      expect(manager._pageHideHandler).toBeNull();
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

    it('should clean up popup tracking, recovery channel, and SW listener', () => {
      vi.useFakeTimers();
      manager._popupWindow = { closed: false };
      manager._setupPopupMonitor();

      const closeSpy = vi.fn();
      manager._recoveryChannel = { close: closeSpy };

      const removeEventSpy = vi.fn();
      const handler = vi.fn();
      manager._swMessageHandler = handler;
      const originalSW = navigator.serviceWorker;
      Object.defineProperty(navigator, 'serviceWorker', {
        value: { removeEventListener: removeEventSpy },
        configurable: true,
      });

      manager.destroy();

      expect(manager._popupWindow).toBeNull();
      expect(manager._popupMonitorTimer).toBeNull();
      expect(closeSpy).toHaveBeenCalled();
      expect(manager._recoveryChannel).toBeNull();
      expect(removeEventSpy).toHaveBeenCalledWith('message', handler);
      expect(manager._swMessageHandler).toBeNull();

      Object.defineProperty(navigator, 'serviceWorker', { value: originalSW, configurable: true });
      vi.useRealTimers();
    });
  });

  describe('dispose lifecycle', () => {
    it('disposes the session with keepalive on pagehide', () => {
      const provider = createFakeProvider();
      manager._provider = provider;
      manager._setupDisposeLifecycle();

      window.dispatchEvent(new Event('pagehide'));

      expect(provider.dispose).toHaveBeenCalledWith({ keepalive: true });
    });
  });

  describe('resetToDefaultState', () => {
    it('should close preview and clear pinned state', () => {
      manager.isOpen = true;
      manager.isPinned = true;
      mockElements.previewsidenav.classList.add('active');
      mockElements['preview-sidenav-overlay'].classList.add('active');

      manager.resetToDefaultState();

      expect(manager.isOpen).toBe(false);
      expect(manager.isPinned).toBe(false);
      expect(mockElements.previewsidenav.classList.contains('active')).toBe(false);
      expect(mockElements['preview-sidenav-overlay'].classList.contains('active')).toBe(false);
      expect(mockElements.workarea.getAttribute('data-preview-pinned')).toBe('false');
    });

    it('should clear popup tracking state', () => {
      vi.useFakeTimers();
      manager._popupWindow = { closed: false };
      manager._setupPopupMonitor();

      manager.resetToDefaultState();

      expect(manager._popupWindow).toBeNull();
      expect(manager._popupMonitorTimer).toBeNull();
      vi.useRealTimers();
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

      expect(refreshSpy).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
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

    it('should unpin when toggling while pinned', async () => {
      manager.isPinned = true;
      const unpinSpy = vi.spyOn(manager, 'unpin');

      await manager.toggle();

      expect(unpinSpy).toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should close on Escape key when open', () => {
      manager.bindEvents();
      manager.isOpen = true;
      const closeSpy = vi.spyOn(manager, 'close');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should not close on Escape when not open', () => {
      manager.bindEvents();
      manager.isOpen = false;
      const closeSpy = vi.spyOn(manager, 'close');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should not close on Escape when pinned', () => {
      manager.bindEvents();
      manager.isOpen = true;
      manager.isPinned = true;
      const closeSpy = vi.spyOn(manager, 'close');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('should toggle on Ctrl+Shift+P', () => {
      manager.bindEvents();
      const toggleSpy = vi.spyOn(manager, 'toggle').mockResolvedValue();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }));

      expect(toggleSpy).toHaveBeenCalled();
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

    it('subscribes later once the bridge is ready (init runs before Yjs is set up)', () => {
      // init() calls subscribeToChanges() before projectManager.initializeYjs()
      // has assigned the bridge, so the first call must bail WITHOUT marking
      // itself subscribed, then succeed when open()/pin() call it again.
      mockProject._yjsBridge = null;
      manager.subscribeToChanges();
      expect(manager._onYdocUpdate).toBeNull();
      expect(mockBridge.onStructureChange).not.toHaveBeenCalled();

      // Bridge becomes available; a second call (as open()/pin() make) subscribes.
      mockProject._yjsBridge = mockBridge;
      manager.subscribeToChanges();
      expect(mockBridge.onStructureChange).toHaveBeenCalledTimes(1);
      expect(manager._onYdocUpdate).not.toBeNull();
    });

    it('is idempotent: does not double-subscribe once established', () => {
      manager.subscribeToChanges();
      manager.subscribeToChanges();
      expect(mockBridge.onStructureChange).toHaveBeenCalledTimes(1);
      expect(mockYdoc.on).toHaveBeenCalledTimes(1);
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
      updateCallback(new Uint8Array(), 'system');

      expect(manager.refreshDebounceTimer).toBeNull();
      vi.useRealTimers();
    });

    it('should skip initial-originated ydoc updates', () => {
      vi.useFakeTimers();
      manager.subscribeToChanges();
      manager.isOpen = true;

      const updateCallback = mockYdoc.on.mock.calls.find(call => call[0] === 'update')[1];
      updateCallback(new Uint8Array(), 'initial');

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

      expect(manager.isOpen).toBe(true);
    });
  });

  describe('bindEvents edge cases', () => {
    it('should handle close button keyboard events', () => {
      manager.bindEvents();
      const closeSpy = vi.spyOn(manager, 'close');

      mockElements.previewsidenavclose.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(closeSpy).toHaveBeenCalled();

      closeSpy.mockClear();

      mockElements.previewsidenavclose.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('pin state persistence', () => {
    it('should not read or write pin state in localStorage', async () => {
      const mockLocalStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
      vi.spyOn(manager, 'refresh').mockResolvedValue();

      manager.init();
      await manager.pin();
      manager.unpin();

      expect(mockLocalStorage.getItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });
});

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
      'preview-pin-button': document.createElement('button'),
      'preview-refresh-button': document.createElement('button'),
      'preview-iframe': document.createElement('iframe'),
      'preview-pinned-container': document.createElement('div'),
      'preview-pinned-iframe': document.createElement('iframe'),
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
    it('should generate and inject preview HTML via blob URL', async () => {
      await manager.refresh();

      expect(window.SharedExporters.generatePreview).toHaveBeenCalled();
      // Uses blob URL for proper origin (allows popups to access PDF data)
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockElements['preview-iframe'].src).toBe('blob:test-url');
    });

    it('should use pinned iframe blob URL when pinned', async () => {
      manager.isPinned = true;
      await manager.refresh();

      // Uses blob URL for proper origin
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockElements['preview-pinned-iframe'].src).toBe('blob:test-url');
    });

    it('should handle generation errors', async () => {
      const error = new Error('Generation failed');
      window.SharedExporters.generatePreview.mockRejectedValue(error);
      const errorSpy = vi.spyOn(manager, 'showError').mockImplementation(() => {});

      await manager.refresh();

      expect(errorSpy).toHaveBeenCalledWith('Generation failed');
    });
  });

  describe('generatePreviewHtml', () => {
    it('should return null when document manager is missing', async () => {
      window.eXeLearning.app.project._yjsBridge = null;
      const result = await manager.generatePreviewHtml();
      expect(result).toBeNull();
    });

    it('should return null when SharedExporters is missing', async () => {
      delete window.SharedExporters;
      const result = await manager.generatePreviewHtml();
      expect(result).toBeNull();
    });

    it('should keep html when resolveAssetUrlsAsync fails', async () => {
      window.resolveAssetUrlsAsync = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await manager.generatePreviewHtml();
      // The PDF preview card script is always injected
      expect(result).toContain('Preview');
      expect(result).toContain('resolvePdfIframes');
    });
  });

  describe('utility methods', () => {
    it('should escape HTML', () => {
      const escaped = manager.escapeHtml('<script>alert(1)</script>');
      expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('injectPdfBlobUrlConverter', () => {
    it('should inject converter script before </body>', () => {
      const html = '<html><body><p>Content</p></body></html>';
      const result = manager.injectPdfBlobUrlConverter(html);

      expect(result).toContain('resolvePdfIframes');
      expect(result).toContain('</script></body></html>');
    });

    it('should append script if no </body> tag', () => {
      const html = '<p>Content</p>';
      const result = manager.injectPdfBlobUrlConverter(html);

      expect(result).toContain('resolvePdfIframes');
      expect(result).toContain('<p>Content</p>');
    });

    it('should include PDF.js integration for rendering PDFs', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectPdfBlobUrlConverter(html);

      // Should load PDF.js library
      expect(result).toContain('pdf.min.mjs');
      expect(result).toContain('pdf.worker.min.mjs');
      // Should create PDF viewer with controls
      expect(result).toContain('exe-pdf-viewer');
      expect(result).toContain('exe-pdf-toolbar');
      expect(result).toContain('exe-pdf-canvas');
    });

    it('should include fallback card when PDF.js fails', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectPdfBlobUrlConverter(html);

      // Should have fallback card logic
      expect(result).toContain('exe-pdf-preview-card');
      expect(result).toContain('PDF.js not available');
      expect(result).toContain('Click to open');
    });

    it('should use postMessage for asset:// URLs to request blob from parent', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectPdfBlobUrlConverter(html);

      // Should use postMessage to parent for requesting PDF blobs
      expect(result).toContain('postMessage');
      expect(result).toContain('requestPdfBlob');
      expect(result).toContain("type: 'requestPdfBlob'");
      expect(result).toContain('assetId:');
    });

    it('should include navigation and zoom controls', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectPdfBlobUrlConverter(html);

      // Should have navigation controls
      expect(result).toContain('Previous page');
      expect(result).toContain('Next page');
      // Should have zoom controls
      expect(result).toContain('Zoom out');
      expect(result).toContain('Zoom in');
      expect(result).toContain('Fit to width');
      // Should have popup button
      expect(result).toContain('Open in new window');
    });
  });

  describe('postMessage handling for PDF blobs', () => {
    it('should handle requestPdfBlob messages and send blob back', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/pdf' });
      const mockAssetManager = {
        getAsset: vi.fn().mockResolvedValue({
          blob: mockBlob,
        }),
      };
      mockBridge.assetManager = mockAssetManager;

      // Mock postMessage on source
      const mockSource = { postMessage: vi.fn() };

      // Simulate the postMessage event
      manager.bindEvents();
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'requestPdfBlob',
          assetId: 'test-asset-id',
          requestId: 'req_1',
        },
        source: mockSource,
      });
      window.dispatchEvent(messageEvent);

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAssetManager.getAsset).toHaveBeenCalledWith('test-asset-id');
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pdfBlobResponse',
          requestId: 'req_1',
          success: true,
          blob: mockBlob,
        }),
        '*'
      );
    });

    it('should handle openPdfPopup messages for popup fallback', async () => {
      const mockAssetManager = {
        getAsset: vi.fn().mockResolvedValue({
          blob: new Blob(['test'], { type: 'application/pdf' }),
        }),
      };
      mockBridge.assetManager = mockAssetManager;
      global.URL.createObjectURL = vi.fn(() => 'blob:test-pdf-url');
      const mockOpen = vi.fn();
      global.open = mockOpen;

      // Simulate the postMessage event
      manager.bindEvents();
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'openPdfPopup',
          assetId: 'test-asset-id',
          assetUrl: 'asset://test-asset-id/file.pdf',
        },
      });
      window.dispatchEvent(messageEvent);

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAssetManager.getAsset).toHaveBeenCalledWith('test-asset-id');
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockOpen).toHaveBeenCalledWith('blob:test-pdf-url', '_blank', 'width=900,height=700');
    });

    it('should ignore unrelated messages', async () => {
      const mockAssetManager = {
        getAsset: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      manager.bindEvents();
      const messageEvent = new MessageEvent('message', {
        data: { type: 'other-message' },
      });
      window.dispatchEvent(messageEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAssetManager.getAsset).not.toHaveBeenCalled();
    });

    it('should handle exe-download-elpx messages and call exportToElpxViaYjs', async () => {
      const mockExport = vi.fn().mockResolvedValue({ success: true });
      const mockProject = {
        exportToElpxViaYjs: mockExport,
      };

      // Setup global eXeLearning object
      window.eXeLearning = {
        app: {
          project: mockProject,
        },
      };

      manager.bindEvents();

      // Simulate the exe-download-elpx postMessage event
      const messageEvent = new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
      });
      window.dispatchEvent(messageEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockExport).toHaveBeenCalledWith({ saveAs: true });

      // Cleanup
      delete window.eXeLearning;
    });

    it('should show alert if exportToElpxViaYjs is not available', async () => {
      const mockAlert = vi.fn();
      window.alert = mockAlert;

      // Setup global eXeLearning object without exportToElpxViaYjs
      window.eXeLearning = {
        app: {
          project: {},
        },
      };

      manager.bindEvents();

      const messageEvent = new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
      });
      window.dispatchEvent(messageEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockAlert).toHaveBeenCalledWith('ELPX export not available. Please save your project first.');

      // Cleanup
      delete window.eXeLearning;
    });

    it('should show error alert if exportToElpxViaYjs throws', async () => {
      const mockAlert = vi.fn();
      window.alert = mockAlert;

      const mockExport = vi.fn().mockRejectedValue(new Error('Export failed'));
      window.eXeLearning = {
        app: {
          project: {
            exportToElpxViaYjs: mockExport,
          },
        },
      };

      manager.bindEvents();

      const messageEvent = new MessageEvent('message', {
        data: { type: 'exe-download-elpx' },
      });
      window.dispatchEvent(messageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAlert).toHaveBeenCalledWith('Error generating ELPX file: Export failed');

      // Cleanup
      delete window.eXeLearning;
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
});

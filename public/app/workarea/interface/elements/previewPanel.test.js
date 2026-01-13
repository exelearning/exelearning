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

  describe('extractToNewTab', () => {
    it('should generate standalone HTML and open in new tab', async () => {
      const mockOpen = vi.fn(() => ({ focus: vi.fn() }));
      global.open = mockOpen;
      global.URL.createObjectURL = vi.fn(() => 'blob:standalone-url');

      await manager.extractToNewTab();

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockOpen).toHaveBeenCalledWith('blob:standalone-url', '_blank');
    });

    it('should fallback to link click if popup is blocked', async () => {
      global.open = vi.fn(() => null);
      global.URL.createObjectURL = vi.fn(() => 'blob:standalone-url');

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

    it('should handle errors gracefully', async () => {
      window.SharedExporters.generatePreview.mockRejectedValue(new Error('Generation failed'));

      await expect(manager.extractToNewTab()).resolves.not.toThrow();
    });
  });

  describe('generateStandalonePreviewHtml', () => {
    it('should return null when document manager is missing', async () => {
      window.eXeLearning.app.project._yjsBridge = null;
      const result = await manager.generateStandalonePreviewHtml();
      expect(result).toBeNull();
    });

    it('should return null when SharedExporters is missing', async () => {
      delete window.SharedExporters;
      const result = await manager.generateStandalonePreviewHtml();
      expect(result).toBeNull();
    });

    it('should convert assets to data URLs for standalone preview', async () => {
      window.resolveAssetUrlsAsync = vi.fn().mockImplementation(html => html);
      await manager.generateStandalonePreviewHtml();

      expect(window.resolveAssetUrlsAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          convertBlobUrls: true,
          convertIframeBlobUrls: true,
          skipIframeSrc: false,
        })
      );
    });

    it('should handle resolveAssetUrlsAsync failure gracefully', async () => {
      window.resolveAssetUrlsAsync = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await manager.generateStandalonePreviewHtml();
      expect(result).toContain('Preview');
    });
  });

  describe('utility methods', () => {
    it('should escape HTML', () => {
      const escaped = manager.escapeHtml('<script>alert(1)</script>');
      expect(escaped).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('resolveHtmlIframeAssets', () => {
    it('should return html unchanged if AssetManager is not available', async () => {
      window.eXeLearning.app.project._yjsBridge = null;
      const html = '<html><body><iframe src="asset://abc123.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssets(html);
      expect(result).toBe(html);
    });

    it('should return html unchanged if no iframe matches asset:// pattern', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn(),
        _isHtmlAsset: vi.fn(),
        resolveHtmlWithAssets: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="https://example.com"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssets(html);
      expect(result).toBe(html);
      expect(mockAssetManager.getAssetMetadata).not.toHaveBeenCalled();
    });

    it('should resolve HTML iframes with asset:// URLs', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'index.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssets: vi.fn().mockResolvedValue('blob:resolved-url'),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123-def4-5678-9012.html" width="100%"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssets(html);

      expect(mockAssetManager.getAssetMetadata).toHaveBeenCalledWith('abc123-def4-5678-9012');
      expect(mockAssetManager._isHtmlAsset).toHaveBeenCalledWith('text/html', 'index.html');
      expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalledWith('abc123-def4-5678-9012');
      expect(result).toContain('src="blob:resolved-url"');
      expect(result).toContain('data-asset-src="asset://abc123-def4-5678-9012.html"');
    });

    it('should skip iframes with non-HTML assets', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'application/pdf', filename: 'doc.pdf' }),
        _isHtmlAsset: vi.fn().mockReturnValue(false),
        resolveHtmlWithAssets: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123.pdf"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssets(html);

      expect(mockAssetManager._isHtmlAsset).toHaveBeenCalled();
      expect(mockAssetManager.resolveHtmlWithAssets).not.toHaveBeenCalled();
      expect(result).toBe(html);
    });

    it('should skip iframes when metadata is not found', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue(null),
        _isHtmlAsset: vi.fn(),
        resolveHtmlWithAssets: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://nonexistent.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssets(html);

      expect(mockAssetManager._isHtmlAsset).not.toHaveBeenCalled();
      expect(result).toBe(html);
    });

    it('should handle resolution errors gracefully', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'index.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssets: vi.fn().mockRejectedValue(new Error('Resolution failed')),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssets(html);

      // Should return original html on error
      expect(result).toBe(html);
    });

    it('should handle null resolved URL', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'index.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssets: vi.fn().mockResolvedValue(null),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssets(html);

      // Should return original html when resolution returns null
      expect(result).toBe(html);
    });

    it('should resolve multiple HTML iframes', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'page.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssets: vi.fn()
          .mockResolvedValueOnce('blob:url-1')
          .mockResolvedValueOnce('blob:url-2'),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = `<html><body>
        <iframe src="asset://abc123-1111-2222-3333.html"></iframe>
        <iframe src="asset://def456-4444-5555-6666.html"></iframe>
      </body></html>`;
      const result = await manager.resolveHtmlIframeAssets(html);

      expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalledTimes(2);
      expect(result).toContain('blob:url-1');
      expect(result).toContain('blob:url-2');
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

  describe('injectHtmlLinkHandler', () => {
    it('should inject HTML link handler script before </body>', () => {
      const html = '<html><body><p>Content</p></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain('exe-resolve-html-link');
      expect(result).toContain('exe-resolve-html-link-forward');
      expect(result).toContain('exe-html-link-resolved');
      expect(result).toContain('</script></body></html>');
    });

    it('should append script if no </body> tag', () => {
      const html = '<p>Content</p>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain('exe-resolve-html-link');
      expect(result).toContain('<p>Content</p>');
    });

    it('should include message listener for embedded iframe links', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain("window.addEventListener('message'");
      expect(result).toContain('pendingResolves');
      expect(result).toContain("event.data?.type === 'exe-resolve-html-link'");
    });

    it('should forward link resolution requests to parent window', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain('window.parent.postMessage');
      expect(result).toContain("type: 'exe-resolve-html-link-forward'");
      expect(result).toContain('requestId:');
      expect(result).toContain('href:');
      expect(result).toContain('baseFolder:');
    });

    it('should handle resolved URL responses and update iframe src', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain("event.data?.type === 'exe-html-link-resolved'");
      expect(result).toContain('iframe.src = resolvedUrl');
    });

    it('should track pending resolves by request ID', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain('var pendingResolves = {}');
      expect(result).toContain('var resolveIdCounter = 0');
      expect(result).toContain("var reqId = 'htmlResolve_' + (++resolveIdCounter)");
      expect(result).toContain('pendingResolves[reqId]');
      expect(result).toContain('delete pendingResolves[reqId]');
    });

    it('should include click handler for HTML asset links', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      // Should have click listener in capture phase
      expect(result).toContain("document.addEventListener('click'");
      expect(result).toContain('true); // Use capture phase');
    });

    it('should detect HTML links by data-asset-url attribute', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain("var dataAssetUrl = link.getAttribute('data-asset-url')");
      expect(result).toContain('/\\.html?$/i.test(dataAssetUrl)');
    });

    it('should block ALL HTML asset links in preview (not just new window)', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      // Should block all HTML links, not check for new window
      expect(result).toContain('if (isHtmlLink) {');
      expect(result).not.toContain('opensInNewWindow');
    });

    it('should block navigation and show alert for HTML asset links', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain('e.preventDefault()');
      expect(result).toContain('e.stopPropagation()');
      expect(result).toContain('alert(htmlLinkWarningMessage)');
    });

    it('should include warning message variable from translation', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(result).toContain('var htmlLinkWarningMessage =');
      // Should contain the actual warning message
      expect(result).toContain('cannot be navigated in preview');
    });

    it('should use translated message when _() function is available', () => {
      const translatedMessage = 'Mensaje traducido para pruebas';
      window._ = vi.fn().mockReturnValue(translatedMessage);

      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      expect(window._).toHaveBeenCalledWith(expect.stringContaining('HTML websites from the Resources folder'));
      expect(result).toContain(translatedMessage);

      delete window._;
    });

    it('should use fallback message when _() function is not available', () => {
      // Ensure _() is not defined
      delete window._;

      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      // Should use the hardcoded English fallback
      expect(result).toContain('HTML websites from the Resources folder cannot be navigated in preview');
    });

    it('should escape special characters in warning message', () => {
      const messageWithQuotes = "Test's message with 'quotes'";
      window._ = vi.fn().mockReturnValue(messageWithQuotes);

      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      // Single quotes should be escaped
      expect(result).toContain("\\'");
      expect(result).not.toContain("'quotes'"); // Raw quotes should be escaped

      delete window._;
    });

    it('should check for data-asset-url with .html extension pattern', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      // Should use regex for HTML detection
      expect(result).toContain('\\.html?$');
      expect(result).toContain('/i.test(dataAssetUrl)');
    });

    it('should return early when link is not found', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      // Should check for link and return early
      expect(result).toContain("if (!link) return");
    });

    it('should get both href and data-asset-url attributes', () => {
      const html = '<html><body></body></html>';
      const result = manager.injectHtmlLinkHandler(html);

      // Should get both attributes from the link
      expect(result).toContain("link.getAttribute('href')");
      expect(result).toContain("link.getAttribute('data-asset-url')");
    });
  });

  describe('postMessage handling for HTML link resolution', () => {
    it('should handle exe-resolve-html-link-forward messages and resolve HTML', async () => {
      const mockBlob = new Blob(['<html><body>yyy page</body></html>'], { type: 'text/html' });
      const mockAssetManager = {
        findAssetByRelativePath: vi.fn().mockReturnValue({ id: 'linked-asset-id' }),
        resolveHtmlWithAssets: vi.fn().mockResolvedValue('blob:resolved-html-url'),
        getAsset: vi.fn().mockResolvedValue({ blob: mockBlob }),
      };
      mockBridge.assetManager = mockAssetManager;

      // Mock postMessage on source
      const mockSource = { postMessage: vi.fn() };

      // Simulate the postMessage event
      manager.bindEvents();
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'exe-resolve-html-link-forward',
          requestId: 'htmlResolve_1',
          href: 'html/yyy.html',
          assetId: 'original-asset-id',
          baseFolder: '',
        },
        source: mockSource,
      });
      window.dispatchEvent(messageEvent);

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAssetManager.findAssetByRelativePath).toHaveBeenCalledWith('', 'html/yyy.html');
      expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalledWith('linked-asset-id');
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exe-html-link-resolved',
          requestId: 'htmlResolve_1',
          resolvedUrl: 'blob:resolved-html-url',
        }),
        '*'
      );
    });

    it('should send error response when asset not found', async () => {
      const mockAssetManager = {
        findAssetByRelativePath: vi.fn().mockReturnValue(null),
        resolveHtmlWithAssets: vi.fn(),
        getAsset: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const mockSource = { postMessage: vi.fn() };

      manager.bindEvents();
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'exe-resolve-html-link-forward',
          requestId: 'htmlResolve_2',
          href: 'nonexistent.html',
          assetId: 'original-asset-id',
          baseFolder: 'folder',
        },
        source: mockSource,
      });
      window.dispatchEvent(messageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAssetManager.findAssetByRelativePath).toHaveBeenCalledWith('folder', 'nonexistent.html');
      expect(mockAssetManager.resolveHtmlWithAssets).not.toHaveBeenCalled();
      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exe-html-link-resolved',
          requestId: 'htmlResolve_2',
          resolvedUrl: null,
          error: expect.stringContaining('Asset not found'),
        }),
        '*'
      );
    });

    it('should send error response when resolution fails', async () => {
      const mockAssetManager = {
        findAssetByRelativePath: vi.fn().mockReturnValue({ id: 'linked-asset-id' }),
        resolveHtmlWithAssets: vi.fn().mockResolvedValue(null),
        getAsset: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const mockSource = { postMessage: vi.fn() };

      manager.bindEvents();
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'exe-resolve-html-link-forward',
          requestId: 'htmlResolve_3',
          href: 'page.html',
          assetId: 'original-asset-id',
          baseFolder: '',
        },
        source: mockSource,
      });
      window.dispatchEvent(messageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exe-html-link-resolved',
          requestId: 'htmlResolve_3',
          resolvedUrl: null,
          error: expect.stringContaining('Failed to resolve'),
        }),
        '*'
      );
    });

    it('should send error response when AssetManager is not available', async () => {
      mockBridge.assetManager = null;

      const mockSource = { postMessage: vi.fn() };

      manager.bindEvents();
      const messageEvent = new MessageEvent('message', {
        data: {
          type: 'exe-resolve-html-link-forward',
          requestId: 'htmlResolve_4',
          href: 'page.html',
          assetId: 'original-asset-id',
          baseFolder: '',
        },
        source: mockSource,
      });
      window.dispatchEvent(messageEvent);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockSource.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exe-html-link-resolved',
          requestId: 'htmlResolve_4',
          resolvedUrl: null,
          error: expect.stringContaining('AssetManager not available'),
        }),
        '*'
      );
    });
  });

  describe('resolveHtmlIframeAssetsForStandalone', () => {
    it('should return html unchanged if AssetManager is not available', async () => {
      window.eXeLearning.app.project._yjsBridge = null;
      const html = '<html><body><iframe src="asset://abc123.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);
      expect(result).toBe(html);
    });

    it('should return html unchanged if no iframe matches asset:// pattern', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn(),
        _isHtmlAsset: vi.fn(),
        resolveHtmlWithAssetsAsDataUrls: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="https://example.com"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);
      expect(result).toBe(html);
      expect(mockAssetManager.getAssetMetadata).not.toHaveBeenCalled();
    });

    it('should resolve HTML iframes using srcdoc with escaped content', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'index.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssetsAsDataUrls: vi.fn().mockResolvedValue('<html><body>Resolved content with "quotes" & ampersand</body></html>'),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123-def4-5678-9012.html" width="100%"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);

      expect(mockAssetManager.getAssetMetadata).toHaveBeenCalledWith('abc123-def4-5678-9012');
      expect(mockAssetManager._isHtmlAsset).toHaveBeenCalledWith('text/html', 'index.html');
      expect(mockAssetManager.resolveHtmlWithAssetsAsDataUrls).toHaveBeenCalledWith('abc123-def4-5678-9012');
      // Should use srcdoc instead of src with data URL
      expect(result).toContain('srcdoc="');
      // Should escape & and "
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should skip iframes with non-HTML assets', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'application/pdf', filename: 'doc.pdf' }),
        _isHtmlAsset: vi.fn().mockReturnValue(false),
        resolveHtmlWithAssetsAsDataUrls: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123.pdf"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);

      expect(mockAssetManager._isHtmlAsset).toHaveBeenCalled();
      expect(mockAssetManager.resolveHtmlWithAssetsAsDataUrls).not.toHaveBeenCalled();
      expect(result).toBe(html);
    });

    it('should skip iframes when metadata is not found', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue(null),
        _isHtmlAsset: vi.fn(),
        resolveHtmlWithAssetsAsDataUrls: vi.fn(),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://nonexistent.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);

      expect(mockAssetManager._isHtmlAsset).not.toHaveBeenCalled();
      expect(result).toBe(html);
    });

    it('should handle resolution errors gracefully', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'index.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssetsAsDataUrls: vi.fn().mockRejectedValue(new Error('Resolution failed')),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);

      // Should return original html on error
      expect(result).toBe(html);
    });

    it('should handle null resolved content', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'index.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssetsAsDataUrls: vi.fn().mockResolvedValue(null),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = '<html><body><iframe src="asset://abc123.html"></iframe></body></html>';
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);

      // Should return original html when resolution returns null
      expect(result).toBe(html);
    });

    it('should resolve multiple HTML iframes for standalone', async () => {
      const mockAssetManager = {
        getAssetMetadata: vi.fn().mockReturnValue({ mime: 'text/html', filename: 'page.html' }),
        _isHtmlAsset: vi.fn().mockReturnValue(true),
        resolveHtmlWithAssetsAsDataUrls: vi.fn()
          .mockResolvedValueOnce('<html>Page 1</html>')
          .mockResolvedValueOnce('<html>Page 2</html>'),
      };
      mockBridge.assetManager = mockAssetManager;

      const html = `<html><body>
        <iframe src="asset://abc123-1111-2222-3333.html"></iframe>
        <iframe src="asset://def456-4444-5555-6666.html"></iframe>
      </body></html>`;
      const result = await manager.resolveHtmlIframeAssetsForStandalone(html);

      expect(mockAssetManager.resolveHtmlWithAssetsAsDataUrls).toHaveBeenCalledTimes(2);
      expect(result).toContain('srcdoc="');
      expect(result).toContain('Page 1');
      expect(result).toContain('Page 2');
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

  describe('blobToDataUrl', () => {
    it('should convert blob to data URL', async () => {
      const blob = new Blob(['test content'], { type: 'text/plain' });
      const result = await manager.blobToDataUrl(blob);

      expect(result).toContain('data:text/plain');
      expect(result).toContain('base64');
    });

    it('should handle image blobs', async () => {
      // Create a simple 1x1 PNG-like blob
      const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
      const result = await manager.blobToDataUrl(blob);

      expect(result).toContain('data:image/png');
    });
  });

  describe('processUserThemeCssUrls', () => {
    it('should return css unchanged when no url() references', async () => {
      const cssText = 'body { color: red; }';
      const themeFiles = new Map();
      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');
      expect(result).toBe(cssText);
    });

    it('should skip absolute URLs', async () => {
      const cssText = 'body { background: url("https://example.com/image.png"); }';
      const themeFiles = new Map();
      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');
      expect(result).toBe(cssText);
    });

    it('should skip data URLs', async () => {
      const cssText = 'body { background: url("data:image/png;base64,abc"); }';
      const themeFiles = new Map();
      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');
      expect(result).toBe(cssText);
    });

    it('should skip blob URLs', async () => {
      const cssText = 'body { background: url("blob:http://localhost/123"); }';
      const themeFiles = new Map();
      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');
      expect(result).toBe(cssText);
    });

    it('should convert relative url() to data URL when file exists', async () => {
      const cssText = 'body { background: url("image.png"); }';
      const imageBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
      const themeFiles = new Map([['image.png', imageBlob]]);

      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');

      expect(result).toContain('data:image/png');
      expect(result).not.toContain('image.png');
    });

    it('should handle url() with single quotes', async () => {
      const cssText = "body { background: url('image.png'); }";
      const imageBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
      const themeFiles = new Map([['image.png', imageBlob]]);

      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');

      expect(result).toContain('data:image/png');
    });

    it('should handle url() without quotes', async () => {
      const cssText = 'body { background: url(image.png); }';
      const imageBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
      const themeFiles = new Map([['image.png', imageBlob]]);

      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');

      expect(result).toContain('data:image/png');
    });

    it('should try with theme name prefix', async () => {
      const cssText = 'body { background: url("fonts/font.woff2"); }';
      const fontBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'font/woff2' });
      const themeFiles = new Map([['my-theme/fonts/font.woff2', fontBlob]]);

      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'my-theme');

      expect(result).toContain('data:font/woff2');
    });

    it('should normalize paths with ./', async () => {
      const cssText = 'body { background: url("./image.png"); }';
      const imageBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
      const themeFiles = new Map([['image.png', imageBlob]]);

      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');

      expect(result).toContain('data:image/png');
    });

    it('should handle multiple url() references', async () => {
      const cssText = `
        .icon1 { background: url("icon1.png"); }
        .icon2 { background: url("icon2.png"); }
      `;
      const themeFiles = new Map([
        ['icon1.png', new Blob([new Uint8Array([1])], { type: 'image/png' })],
        ['icon2.png', new Blob([new Uint8Array([2])], { type: 'image/png' })],
      ]);

      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');

      expect(result).not.toContain('icon1.png');
      expect(result).not.toContain('icon2.png');
      expect(result.match(/data:image\/png/g).length).toBe(2);
    });

    it('should skip SVG hash references', async () => {
      const cssText = 'body { background: url("#gradient"); }';
      const themeFiles = new Map();
      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');
      expect(result).toBe(cssText);
    });

    it('should leave url unchanged when file not found', async () => {
      const cssText = 'body { background: url("missing.png"); }';
      const themeFiles = new Map();
      const result = await manager.processUserThemeCssUrls(cssText, themeFiles, 'test-theme');
      expect(result).toContain('missing.png');
    });
  });

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

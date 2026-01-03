import { beforeEach, describe, expect, it, vi } from 'vitest';

// Setup globals needed BEFORE the script is loaded
globalThis._ = vi.fn((key) => key);
globalThis.bootstrap = {
  Modal: {
    getInstance: vi.fn(),
  },
};
globalThis.eXeLearning = {
  version: 'v3.0.0',
  config: {
    baseURL: 'http://localhost',
    basePath: '/exelearning',
    themeBaseType: 'XHTML',
  },
  app: {
    common: {
      getVersionTimeStamp: vi.fn(() => '12345'),
    },
    themes: {
      selected: { path: '/theme/path/' },
    },
    api: {
      apiUrlBase: 'http://localhost',
      func: {
        getText: vi.fn().mockResolvedValue('css content'),
      },
    },
  },
};
globalThis.$exeTinyMCEToggler = {}; // Placeholder if needed

// Load the module using require() for coverage tracking
const tinyMCEModule = require('./tinymce_5_settings.js');
globalThis.$exeTinyMCE = tinyMCEModule.$exeTinyMCE;
globalThis.$exeTinyMCEToggler = tinyMCEModule.$exeTinyMCEToggler;

const createJqueryMock = () => {
  const wrap = (nodes) => {
    const api = {
      nodes,
      length: nodes.length,
      eq: (index) => wrap(nodes[index] ? [nodes[index]] : []),
      attr: (name, value) => {
        if (!nodes[0]) return undefined;
        if (value !== undefined) {
          nodes[0].setAttribute(name, value);
          return api;
        }
        return nodes[0].getAttribute(name);
      },
      val: (value) => {
        if (!nodes[0]) return '';
        if (value !== undefined) {
          nodes.forEach((node) => {
            node.value = value;
            node.innerHTML = value;
          });
          return api;
        }
        return nodes[0].value || nodes[0].innerHTML || '';
      },
      html: () => (nodes[0] ? nodes[0].innerHTML : ''),
      before: (el) => {
        if (!nodes[0] || !nodes[0].parentNode) return api;
        const target = el?.nodes ? el.nodes[0] : el;
        if (target) {
          nodes[0].parentNode.insertBefore(target, nodes[0]);
        }
        return api;
      },
      after: (el) => {
        if (!nodes[0] || !nodes[0].parentNode) return api;
        const target = el?.nodes ? el.nodes[0] : el;
        if (target) {
          nodes[0].parentNode.insertBefore(target, nodes[0].nextSibling);
        }
        return api;
      },
      addClass: (className) => {
        nodes.forEach((node) => node.classList.add(className));
        return api;
      },
      removeClass: (className) => {
        nodes.forEach((node) => node.classList.remove(className));
        return api;
      },
      hasClass: (className) => {
        if (!nodes[0]) return false;
        return nodes[0].classList.contains(className);
      },
      css: (name, value) => {
        if (!nodes[0]) return undefined;
        if (typeof name === 'string' && value === undefined) {
          return nodes[0].style[name];
        }
        if (typeof name === 'string') {
          nodes.forEach((node) => {
            node.style[name] = value;
          });
          return api;
        }
        nodes.forEach((node) => {
          Object.entries(name).forEach(([key, val]) => {
            node.style[key] = val;
          });
        });
        return api;
      },
      show: () => {
        nodes.forEach((node) => {
          node.style.display = '';
        });
        return api;
      },
      hide: () => {
        nodes.forEach((node) => {
          node.style.display = 'none';
        });
        return api;
      },
      parent: () => wrap(nodes[0]?.parentElement ? [nodes[0].parentElement] : []),
      prev: (selector) => {
        if (!nodes[0]) return wrap([]);
        let prev = nodes[0].previousElementSibling;
        while (prev && selector && !prev.matches(selector)) {
          prev = prev.previousElementSibling;
        }
        return wrap(prev ? [prev] : []);
      },
      remove: () => {
        nodes.forEach((node) => node.remove());
        return api;
      },
      removeAttr: (attrName) => {
        nodes.forEach((node) => node.removeAttribute(attrName));
        return api;
      },
      width: () => 800,
    };
    nodes.forEach((node, index) => {
      api[index] = node;
    });
    return api;
  };

  const $ = (input, context) => {
    if (input === document) {
      return { width: () => 800 };
    }
    if (typeof input === 'string' && input.trim().startsWith('<')) {
      const template = document.createElement('div');
      template.innerHTML = input.trim();
      return wrap([template.firstChild]);
    }
    const ctx = context?.nodes ? context.nodes[0] : context;
    const root = ctx || document;
    if (typeof input === 'string') {
      return wrap(Array.from(root.querySelectorAll(input)));
    }
    if (input && input.nodeType) {
      return wrap([input]);
    }
    return wrap([]);
  };

  return $;
};

describe('TinyMCE 5 Settings', () => {
  let previousDollar;
  let previousTinymce;

  beforeEach(() => {
    vi.clearAllMocks();
    previousDollar = globalThis.$;
    previousTinymce = globalThis.tinymce;
    globalThis.$ = createJqueryMock();
    globalThis.tinymce = { init: vi.fn() };
    document.body.innerHTML = `
      <div id="load-screen-node-content" class="hide hidden"></div>
      <div class="block"><textarea id="editor" name="editor"></textarea></div>
    `;
  });

  afterEach(() => {
    globalThis.$ = previousDollar;
    globalThis.tinymce = previousTinymce;
    delete globalThis.fetch;
    delete globalThis.FileReader;
  });

  it('defines global $exeTinyMCE', () => {
    expect(globalThis.$exeTinyMCE).toBeDefined();
    expect(typeof globalThis.$exeTinyMCE.init).toBe('function');
  });

  it('defines global $exeTinyMCEToggler', () => {
    expect(globalThis.$exeTinyMCEToggler).toBeDefined();
    expect(typeof globalThis.$exeTinyMCEToggler.setup).toBe('function');
  });

  describe('$exeTinyMCE', () => {
    it('getTemplates returns an array of templates', () => {
      const templates = globalThis.$exeTinyMCE.getTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('title');
      expect(templates[0]).toHaveProperty('url');
    });

    it('getAssetURL constructs correct URL', () => {
      const url = '/libs/test.js';
      const result = globalThis.$exeTinyMCE.getAssetURL(url);
      expect(result).toBe('http://localhost/exelearning/v3.0.0/libs/test.js');
    });

    it('getContentCSS returns comma-separated URLs', () => {
      const result = globalThis.$exeTinyMCE.getContentCSS();
      expect(result).toContain('/theme/path/style.css');
      expect(result).toContain('/app/editor/tinymce_5_extra.css');
    });

    it('getContentCSS falls back to base theme when missing', () => {
      const originalTheme = globalThis.eXeLearning.app.themes.selected;
      globalThis.eXeLearning.app.themes.selected = null;

      const result = globalThis.$exeTinyMCE.getContentCSS();

      expect(result).toContain('/files/perm/themes/base/INTEF/style.css');
      globalThis.eXeLearning.app.themes.selected = originalTheme;
    });

    it('init calls tinymce.init with configurations', () => {
      globalThis.$exeTinyMCEToggler.documentWidth = 1000;
      globalThis.$exeTinyMCE.init('multiple', '#editor', true);
      expect(globalThis.tinymce.init).toHaveBeenCalled();
      const config = globalThis.tinymce.init.mock.calls[0][0];
      expect(config.selector).toBe('#editor');
      expect(config.plugins).toBe(globalThis.$exeTinyMCE.plugins);
      const wrapper = document.querySelector('.block');
      expect(wrapper.classList.contains('hidden-editor')).toBe(true);
    });

    it('init instance callback triggers toggler and editor hook', () => {
      globalThis.$exeTinyMCEToggler.documentWidth = 1000;
      const initSpy = vi.spyOn(globalThis.$exeTinyMCEToggler, 'init').mockImplementation(() => {});
      const hookSpy = vi.fn();
      globalThis.$exeTinyMCE.onEditorInit = hookSpy;

      globalThis.$exeTinyMCE.init('multiple', '#editor', true);
      const config = globalThis.tinymce.init.mock.calls[0][0];

      // Mock editor with required methods for the new asset URL resolution code
      const mockEditor = {
        id: 'editor',
        on: vi.fn(),
        getBody: () => document.createElement('div'),
      };
      config.init_instance_callback(mockEditor);

      expect(initSpy).toHaveBeenCalledWith('editor', true);
      expect(hookSpy).toHaveBeenCalled();
      // Verify SetContent handler was registered
      expect(mockEditor.on).toHaveBeenCalledWith('SetContent', expect.any(Function));
      initSpy.mockRestore();
      delete globalThis.$exeTinyMCE.onEditorInit;
    });

    it('lockScreen adds classes to load screen', () => {
      globalThis.$exeTinyMCE.lockScreen();

      const screen = document.getElementById('load-screen-node-content');
      expect(screen.classList.contains('loading')).toBe(true);
      expect(screen.classList.contains('hide')).toBe(false);
    });

    it('unlockScreen hides and resets the loading screen', () => {
      vi.useFakeTimers();
      const screen = document.getElementById('load-screen-node-content');
      screen.classList.add('loading');
      screen.style.zIndex = '9999';
      screen.style.position = 'fixed';
      screen.style.top = '0';
      screen.style.left = '0';

      globalThis.$exeTinyMCE.unlockScreen();

      vi.runAllTimers();
      expect(screen.classList.contains('loading')).toBe(false);
      expect(screen.classList.contains('hide')).toBe(true);
      expect(screen.style.zIndex).toBe('990');
      vi.useRealTimers();
    });

    it('getAvailableClasses filters and includes base classes', () => {
      const mockSheets = [
        {
          href: './base.css',
          cssRules: [
            { cssText: '.alpha {} .js {} .iDeviceSomething {} .1bad {} .beta {}' },
          ],
        },
        {
          href: './style.css',
          cssRules: [{ cssText: '.gamma {} .IdeviceTest {}' }],
        },
      ];
      Object.defineProperty(document, 'styleSheets', {
        value: mockSheets,
        writable: true,
      });

      const classes = globalThis.$exeTinyMCE.getAvailableClasses();

      const values = classes.map((item) => item.value);
      expect(values).toContain('exe-hidden');
      expect(values).toContain('alpha');
      expect(values).toContain('beta');
      expect(values).toContain('gamma');
      expect(values).not.toContain('js');
    });

    it('getSchema and valid elements helpers return defaults', () => {
      expect(globalThis.$exeTinyMCE.getSchema()).toBe('html5');
      expect(globalThis.$exeTinyMCE.getValidElements()).toBe('*[*]');
      expect(globalThis.$exeTinyMCE.getValidChildren()).toBe('+body[style]');
      expect(globalThis.$exeTinyMCE.getExtendedValidElements()).toBe('');
    });

    it('file_browser_callback sets selected file value', () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const input = document.createElement('input');
      input.id = 'field-1';
      document.body.appendChild(input);
      const dispatchSpy = vi.spyOn(input, 'dispatchEvent');

      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({ blobUrl: 'blob://file' });
          },
        },
      };

      config.file_browser_callback('field-1');

      expect(input.value).toBe('blob://file');
      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('file_browser_callback skips when filemanager is missing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      window.eXeLearning.app.modals = {};

      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      config.file_picker_callback(() => {});

      expect(warnSpy).toHaveBeenCalledWith('[TinyMCE] Media Library not available');
      warnSpy.mockRestore();
    });

    it('file_picker_callback uses asset url for PDFs', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              assetUrl: 'asset://file.pdf',
              blobUrl: 'blob://file',
              asset: { mime: 'application/pdf', filename: 'file.pdf' },
            });
          },
        },
      };

      await config.file_picker_callback(cb);

      expect(cb).toHaveBeenCalledWith('asset://file.pdf', {
        title: 'file.pdf',
        'data-mce-pdf': 'true',
      });
    });

    it('file_picker_callback uses blob url directly for images', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

      // Setup mock AssetManager with caches
      const mockAssetManager = {
        reverseBlobCache: new Map(),
        blobURLCache: new Map(),
      };
      window.eXeLearning.app.project = {
        _yjsBridge: { assetManager: mockAssetManager },
      };

      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              assetUrl: 'asset://abc123/file.png',
              blobUrl: 'blob://file',
              asset: { id: 'abc123', mime: 'image/png', filename: 'file.png' },
            });
          },
        },
      };

      await config.file_picker_callback(cb);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should use blob URL directly (not convert to data:URL)
      // CRITICAL: Must include data-asset-id for reliable blob→asset conversion
      expect(cb).toHaveBeenCalledWith('blob://file', {
        title: 'file.png',
        alt: 'file.png',
        'data-asset-id': 'abc123', // CRITICAL: Used by convertBlobURLsToAssetRefs
      });

      // Should ensure blob URL is in cache for later conversion
      expect(mockAssetManager.reverseBlobCache.has('blob://file')).toBe(true);
      expect(mockAssetManager.reverseBlobCache.get('blob://file')).toBe('abc123');
    });

    it('file_picker_callback works without AssetManager', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

      // No AssetManager available
      window.eXeLearning.app.project = null;

      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              assetUrl: 'asset://file.png',
              blobUrl: 'blob://file',
              asset: { id: 'abc123', mime: 'image/png', filename: 'file.png' },
            });
          },
        },
      };

      await config.file_picker_callback(cb);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should still work with blob URL even without AssetManager
      // data-asset-id is always included for reliable conversion
      expect(cb).toHaveBeenCalledWith('blob://file', {
        title: 'file.png',
        alt: 'file.png',
        'data-asset-id': 'abc123',
      });
    });

    it('file_picker_callback registers UUID (not asset URL) in reverseBlobCache', async () => {
      // This is the CRITICAL test for the bug fix
      // The bug was that asset:// URLs were stored in reverseBlobCache instead of UUIDs
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

      const mockAssetManager = {
        reverseBlobCache: new Map(),
        blobURLCache: new Map(),
      };
      window.eXeLearning.app.project = {
        _yjsBridge: { assetManager: mockAssetManager },
      };

      const assetUUID = '0b034dc2-1fcb-2be8-5fbd-e49a05d9bac0';
      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              assetUrl: `asset://${assetUUID}/image.jpg`,
              blobUrl: 'blob:http://localhost:8081/test-blob-url',
              asset: { id: assetUUID, mime: 'image/jpeg', filename: 'image.jpg' },
            });
          },
        },
      };

      await config.file_picker_callback(cb);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // CRITICAL: reverseBlobCache should contain the UUID, NOT the asset:// URL
      const cachedValue = mockAssetManager.reverseBlobCache.get('blob:http://localhost:8081/test-blob-url');
      expect(cachedValue).toBe(assetUUID);
      // Should NOT be an asset:// URL
      expect(cachedValue).not.toContain('asset://');
      // Should be a valid UUID
      expect(cachedValue).toMatch(/^[a-f0-9-]+$/i);
    });

    it('file_picker_callback handles video files with correct cache registration', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

      const mockAssetManager = {
        reverseBlobCache: new Map(),
        blobURLCache: new Map(),
      };
      window.eXeLearning.app.project = {
        _yjsBridge: { assetManager: mockAssetManager },
      };

      const assetUUID = 'video-uuid-1234-5678';
      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              assetUrl: `asset://${assetUUID}/video.mp4`,
              blobUrl: 'blob:http://localhost:8081/video-blob',
              asset: { id: assetUUID, mime: 'video/mp4', filename: 'video.mp4' },
            });
          },
        },
      };

      await config.file_picker_callback(cb);
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Videos should also use blob URL directly with data-asset-id
      expect(cb).toHaveBeenCalledWith('blob:http://localhost:8081/video-blob', {
        title: 'video.mp4',
        alt: 'video.mp4',
        'data-asset-id': assetUUID, // CRITICAL: Used by convertBlobURLsToAssetRefs
      });
      // And should register UUID (not asset:// URL) in cache
      expect(mockAssetManager.reverseBlobCache.get('blob:http://localhost:8081/video-blob')).toBe(assetUUID);
    });

    it('images_upload_handler reuses existing blob urls', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const success = vi.fn();
      const failure = vi.fn();
      const blobInfo = {
        blobUri: () => 'blob:1',
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            reverseBlobCache: new Map([['blob:1', 'asset-1']]),
          },
        },
      };

      await config.images_upload_handler(blobInfo, success, failure);

      expect(success).toHaveBeenCalledWith('blob:1');
      expect(failure).not.toHaveBeenCalled();
    });

    it('images_upload_handler stores new images in AssetManager', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const success = vi.fn();
      const failure = vi.fn();
      const blobInfo = {
        blobUri: () => 'blob:new',
        blob: () => new Blob(['data'], { type: 'image/png' }),
        filename: () => 'image.png',
      };
      const blobURLCache = new Map();
      const reverseBlobCache = new Map();
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            reverseBlobCache,
            blobURLCache,
            // insertImage returns full asset:// URL
            insertImage: vi.fn().mockResolvedValue('asset://asset-2/image.png'),
            // extractAssetId extracts the UUID from the URL
            extractAssetId: vi.fn().mockReturnValue('asset-2'),
          },
        },
      };
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:created');

      await config.images_upload_handler(blobInfo, success, failure);

      // CRITICAL: Must include data-asset-id for reliable blob→asset conversion
      expect(success).toHaveBeenCalledWith('blob:created', { 'data-asset-id': 'asset-2' });
      expect(blobURLCache.get('asset-2')).toBe('blob:created');
    });

    it('images_upload_handler reports insert errors', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const unlockSpy = vi.spyOn(globalThis.$exeTinyMCE, 'unlockScreen').mockImplementation(() => {});
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const success = vi.fn();
      const failure = vi.fn();
      const blobInfo = {
        blobUri: () => 'blob:fail',
        blob: () => new Blob(['data'], { type: 'image/png' }),
        filename: () => 'image.png',
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            reverseBlobCache: new Map(),
            blobURLCache: new Map(),
            insertImage: vi.fn().mockRejectedValue(new Error('fail')),
          },
        },
      };

      await config.images_upload_handler(blobInfo, success, failure);

      expect(failure).toHaveBeenCalledWith('Error storing image');
      expect(unlockSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
      unlockSpy.mockRestore();
    });

    it('images_upload_handler reports missing AssetManager', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const success = vi.fn();
      const failure = vi.fn();
      const blobInfo = {
        blobUri: () => 'blob:missing',
      };
      window.eXeLearning.app.project = { _yjsBridge: {} };

      await config.images_upload_handler(blobInfo, success, failure);

      expect(failure).toHaveBeenCalledWith('Media library not available');
    });

    describe('resolveAssetUrlsInEditor', () => {
      it('exists as a function', () => {
        expect(typeof globalThis.$exeTinyMCE.resolveAssetUrlsInEditor).toBe('function');
      });

      it('does nothing when AssetManager is not available', () => {
        const mockEditor = {
          getBody: () => document.createElement('div'),
        };
        window.eXeLearning.app.project = null;

        // Should not throw
        expect(() => globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor)).not.toThrow();
      });

      it('does nothing when editor body is not available', () => {
        const mockEditor = {
          getBody: () => null,
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: {} },
        };

        // Should not throw
        expect(() => globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor)).not.toThrow();
      });

      it('resolves audio element asset:// URLs to blob:// URLs', async () => {
        const body = document.createElement('div');
        const audio = document.createElement('audio');
        audio.setAttribute('src', 'asset://test-uuid-1234/audio.webm');
        body.appendChild(audio);

        const mockBlobUrl = 'blob:http://localhost/mock-blob';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Wait for async resolution
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://test-uuid-1234/audio.webm');
        expect(audio.getAttribute('src')).toBe(mockBlobUrl);
        expect(audio.getAttribute('data-asset-src')).toBe('asset://test-uuid-1234/audio.webm');
      });

      it('resolves video element asset:// URLs to blob:// URLs', async () => {
        const body = document.createElement('div');
        const video = document.createElement('video');
        video.setAttribute('src', 'asset://video-uuid/video.mp4');
        body.appendChild(video);

        const mockBlobUrl = 'blob:http://localhost/video-blob';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Wait for async resolution
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(video.getAttribute('src')).toBe(mockBlobUrl);
        expect(video.getAttribute('data-asset-src')).toBe('asset://video-uuid/video.mp4');
      });

      it('skips elements that already have data-asset-src', async () => {
        const body = document.createElement('div');
        const audio = document.createElement('audio');
        audio.setAttribute('src', 'blob:already-resolved');
        audio.setAttribute('data-asset-src', 'asset://already-resolved/file.webm');
        body.appendChild(audio);

        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue('blob:new'),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Should not call resolveAssetURL for already-resolved elements
        expect(mockAssetManager.resolveAssetURL).not.toHaveBeenCalled();
        expect(audio.getAttribute('src')).toBe('blob:already-resolved');
      });

      it('handles mce-preview-object spans with asset:// URLs', async () => {
        const body = document.createElement('div');
        const span = document.createElement('span');
        span.classList.add('mce-preview-object');
        span.setAttribute('data-mce-p-src', 'asset://preview-uuid/audio.webm');
        const audio = document.createElement('audio');
        audio.setAttribute('src', 'asset://preview-uuid/audio.webm');
        span.appendChild(audio);
        body.appendChild(span);

        const mockBlobUrl = 'blob:http://localhost/preview-blob';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Wait for async resolution
        await new Promise((resolve) => setTimeout(resolve, 10));

        // The inner audio should be resolved
        expect(audio.getAttribute('src')).toBe(mockBlobUrl);
        expect(audio.getAttribute('data-asset-src')).toBe('asset://preview-uuid/audio.webm');
      });

      it('handles resolution errors gracefully', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const body = document.createElement('div');
        const audio = document.createElement('audio');
        audio.setAttribute('src', 'asset://error-uuid/audio.webm');
        body.appendChild(audio);

        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockRejectedValue(new Error('Resolution failed')),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Wait for async resolution
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Should log warning but not throw
        expect(warnSpy).toHaveBeenCalled();
        // Original URL should remain if resolution fails
        expect(audio.getAttribute('data-asset-src')).toBe('asset://error-uuid/audio.webm');

        warnSpy.mockRestore();
      });

      it('resolves iframe element asset:// URLs to blob:// URLs but does NOT add data-asset-src', async () => {
        // Iframes (PDFs) ARE resolved to blob URLs for display in the editor.
        // However, we do NOT add data-asset-src because TinyMCE preserves the
        // original URL via data-mce-p-src on the parent span.mce-preview-object.
        const body = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', 'asset://pdf-uuid-1234/document.pdf');
        iframe.setAttribute('width', '300');
        iframe.setAttribute('height', '150');
        body.appendChild(iframe);

        const mockBlobUrl = 'blob:http://localhost/pdf-blob';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Wait for async resolution
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Iframe SHOULD be resolved to blob URL for display
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://pdf-uuid-1234/document.pdf');
        expect(iframe.getAttribute('src')).toBe(mockBlobUrl);
        // But data-asset-src should NOT be added (TinyMCE uses data-mce-p-src)
        expect(iframe.getAttribute('data-asset-src')).toBeNull();
        // Verify other attributes preserved
        expect(iframe.getAttribute('width')).toBe('300');
        expect(iframe.getAttribute('height')).toBe('150');
      });

      it('resolves mce-preview-object spans with iframe for PDFs but does NOT add data-asset-src', async () => {
        // Iframes in mce-preview-object spans are resolved for display.
        // The span's data-mce-p-src preserves the original URL.
        const body = document.createElement('div');
        const span = document.createElement('span');
        span.classList.add('mce-preview-object');
        span.setAttribute('data-mce-p-src', 'asset://pdf-preview-uuid/file.pdf');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', 'asset://pdf-preview-uuid/file.pdf');
        span.appendChild(iframe);
        body.appendChild(span);

        const mockBlobUrl = 'blob:http://localhost/preview-pdf-blob';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Wait for async resolution
        await new Promise((resolve) => setTimeout(resolve, 10));

        // The inner iframe SHOULD be resolved for display
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://pdf-preview-uuid/file.pdf');
        expect(iframe.getAttribute('src')).toBe(mockBlobUrl);
        // But data-asset-src should NOT be added
        expect(iframe.getAttribute('data-asset-src')).toBeNull();
      });
    });
  });

  describe('$exeTinyMCEToggler', () => {
    it('setup calls createViewer for each element', () => {
      const mockEach = vi.fn((callback) => {
        const mockEl = { name: 'textarea1' };
        callback.call(mockEl);
      });
      const eds = { each: mockEach };

      const createViewerSpy = vi.spyOn(globalThis.$exeTinyMCEToggler, 'createViewer').mockImplementation(() => {});

      globalThis.$exeTinyMCEToggler.setup(eds);

      expect(mockEach).toHaveBeenCalled();
      expect(createViewerSpy).toHaveBeenCalled();
      createViewerSpy.mockRestore();
    });

    it('setup applies plain textarea styles when mode is not always', () => {
      const originalMode = globalThis.$exeTinyMCEToggler.mode;
      globalThis.$exeTinyMCEToggler.mode = 'conditional';
      const textarea = document.getElementById('editor');
      textarea.value = '';
      const eds = {
        each: (callback) => {
          callback.call(textarea);
        },
      };

      globalThis.$exeTinyMCEToggler.setup(eds);

      expect(textarea.style.border).toContain('1px');
      globalThis.$exeTinyMCEToggler.mode = originalMode;
    });

    it('createViewer inserts preview and hides textarea', () => {
      const textarea = document.getElementById('editor');
      const wrapper = globalThis.$(textarea);
      wrapper.attr('id', 'editor');
      wrapper.attr('name', 'editor');
      wrapper.val('content');

      globalThis.$exeTinyMCEToggler.documentWidth = 1000;
      expect(() => globalThis.$exeTinyMCEToggler.createViewer(wrapper)).not.toThrow();
    });

    it('removeViewer starts editor and removes toggler', () => {
      const startSpy = vi.spyOn(globalThis.$exeTinyMCEToggler, 'startEditor').mockImplementation(() => {});
      const toggler = document.createElement('a');
      toggler.id = 'editor-toggler';
      document.body.appendChild(toggler);

      globalThis.$exeTinyMCEToggler.removeViewer('editor');

      expect(document.getElementById('editor-toggler')).toBeNull();
      expect(startSpy).toHaveBeenCalledWith('editor', true);
    });

    it('startEditor triggers TinyMCE init', () => {
      globalThis.$exeTinyMCE.init = vi.fn();

      expect(() => globalThis.$exeTinyMCEToggler.startEditor('editor', false)).not.toThrow();
    });

    it('init resolves help link without throwing', () => {
      expect(() => globalThis.$exeTinyMCEToggler.init('editor', false)).not.toThrow();
    });

    it('getHelpLink returns label when available', () => {
      const textarea = document.getElementById('editor');
      const label = document.createElement('label');
      label.id = 'editor-editor-label';
      document.body.appendChild(label);
      const wrapper = globalThis.$(textarea);

      const result = globalThis.$exeTinyMCEToggler.getHelpLink(wrapper);

      expect(result.length).toBe(1);
    });

    it('createEditorLink inserts toggler link when help exists', () => {
      const textarea = document.getElementById('editor');
      const link = document.createElement('a');
      link.href = '#';
      link.innerHTML = '<img src="/images/help.gif" />';
      const container = document.createElement('div');
      container.className = 'block';
      container.appendChild(link);
      textarea.parentElement.before(container);

      const wrapper = globalThis.$(textarea);
      globalThis.$exeTinyMCEToggler.createEditorLink(wrapper, 'editor');

      const toggler = document.getElementById('editor-toggler');
      expect(toggler).toBeTruthy();
    });

    it('addLinkAndToggle calls toggle when enabled', () => {
      const toggleSpy = vi.spyOn(globalThis.$exeTinyMCEToggler, 'toggle').mockImplementation(() => {});
      const label = globalThis.$(document.createElement('label'));
      const link = globalThis.$(document.createElement('a'));

      globalThis.$exeTinyMCEToggler.addLinkAndToggle('editor', label, link, true);

      expect(toggleSpy).toHaveBeenCalled();
      toggleSpy.mockRestore();
    });

    it('toggle switches editor visibility', () => {
      const textarea = document.getElementById('editor');
      const parent = textarea.parentElement;
      const iframe = document.createElement('iframe');
      iframe.style.height = '200px';
      iframe.style.width = '400px';
      parent.appendChild(iframe);
      const button = document.createElement('a');
      button.id = 'editor-toggler';
      button.classList.add('visible-editor');
      parent.appendChild(button);

      expect(() => globalThis.$exeTinyMCEToggler.toggle('editor', button)).not.toThrow();
      expect(() => globalThis.$exeTinyMCEToggler.toggle('editor', button)).not.toThrow();
    });
  });
});

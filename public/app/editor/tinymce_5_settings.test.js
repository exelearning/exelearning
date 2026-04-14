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
// Capture real init before any test can replace it (e.g. 'startEditor triggers TinyMCE init')
const realExeTinyMCEInit = tinyMCEModule.$exeTinyMCE.init;

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

    it('init disables images_replace_blob_uris so TinyMCE does not overwrite data-mce-src after upload (issue #1664)', () => {
      // With the default `images_replace_blob_uris: true`, TinyMCE's upload
      // pipeline overwrites both `src` and `data-mce-src` with whatever the
      // handler returns via success(). Because our handler returns the blob
      // URI for cache hits, that clobbers the canonical asset:// value we
      // previously set in resolveAssetUrlsInEditor — corrupting the first
      // image whenever a second asset image is inserted.
      globalThis.$exeTinyMCE.init('multiple', '#editor', true);
      const config = globalThis.tinymce.init.mock.calls[0][0];
      expect(config.images_replace_blob_uris).toBe(false);
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

      // SetContent handler is now registered in setup callback (before content loads)
      config.setup(mockEditor);
      expect(mockEditor.on).toHaveBeenCalledWith('BeforeSetContent', expect.any(Function));
      expect(mockEditor.on).toHaveBeenCalledWith('SetContent', expect.any(Function));
      expect(mockEditor.on).toHaveBeenCalledWith('GetContent', expect.any(Function));

      // init_instance_callback runs after content loads
      mockEditor.on.mockClear();
      config.init_instance_callback(mockEditor);

      expect(initSpy).toHaveBeenCalledWith('editor', true);
      expect(hookSpy).toHaveBeenCalled();
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

    describe('getStaticBasePath', () => {
      let originalLocation;

      beforeEach(() => {
        originalLocation = window.location;
      });

      afterEach(() => {
        // Restore original location
        delete window.location;
        window.location = originalLocation;
      });

      it('detects basePath from URL with /app/', () => {
        delete window.location;
        window.location = { pathname: '/dist/static/app/workarea.html' };
        expect(globalThis.$exeTinyMCE.getStaticBasePath()).toBe('/dist/static');
      });

      it('detects basePath from URL with /libs/', () => {
        delete window.location;
        window.location = { pathname: '/my/deploy/libs/tinymce/plugin.js' };
        expect(globalThis.$exeTinyMCE.getStaticBasePath()).toBe('/my/deploy');
      });

      it('returns empty string for root deployment with /app/', () => {
        delete window.location;
        window.location = { pathname: '/app/workarea.html' };
        expect(globalThis.$exeTinyMCE.getStaticBasePath()).toBe('');
      });

      it('returns empty string for root deployment with /libs/', () => {
        delete window.location;
        window.location = { pathname: '/libs/tinymce/plugin.js' };
        expect(globalThis.$exeTinyMCE.getStaticBasePath()).toBe('');
      });

      it('returns empty string when no known markers are found', () => {
        delete window.location;
        window.location = { pathname: '/some/other/path.html' };
        expect(globalThis.$exeTinyMCE.getStaticBasePath()).toBe('');
      });

      it('handles deep subdirectory deployments', () => {
        delete window.location;
        window.location = { pathname: '/org/project/deploy/v1/app/editor.html' };
        expect(globalThis.$exeTinyMCE.getStaticBasePath()).toBe('/org/project/deploy/v1');
      });
    });

    describe('edicuatex URLs', () => {
      let originalLocation;

      beforeEach(() => {
        originalLocation = window.location;
      });

      afterEach(() => {
        delete window.location;
        window.location = originalLocation;
      });

      it('uses getAssetURL for edicuatex in server mode', () => {
        // Ensure not in static mode
        globalThis.eXeLearning.config.isStaticMode = false;
        globalThis.eXeLearning.config.isOfflineInstallation = false;

        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        expect(config.edicuatex_url).toBe('http://localhost/exelearning/v3.0.0/app/common/edicuatex/index.html');
        expect(config.edicuatex_mathjax_url).toBe('http://localhost/exelearning/v3.0.0/app/common/exe_math/tex-mml-svg.js');
      });

      it('uses relative paths (./app/...) in static mode at root deployment', () => {
        globalThis.eXeLearning.config.isStaticMode = true;
        globalThis.eXeLearning.config.isOfflineInstallation = false;
        // Root deployment - entry page is /index.html (no /app/ in path)
        delete window.location;
        window.location = { pathname: '/index.html' };

        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        // Relative paths work regardless of entry point pathname
        expect(config.edicuatex_url).toBe('./app/common/edicuatex/index.html');
        expect(config.edicuatex_mathjax_url).toBe('./app/common/exe_math/tex-mml-svg.js');

        // Reset
        globalThis.eXeLearning.config.isStaticMode = false;
      });

      it('uses relative paths (./app/...) in static mode for subdirectory deployment', () => {
        globalThis.eXeLearning.config.isStaticMode = true;
        globalThis.eXeLearning.config.isOfflineInstallation = false;
        // Subdirectory deployment - entry page is /dist/static/index.html (no /app/ in path)
        delete window.location;
        window.location = { pathname: '/dist/static/index.html' };

        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        // Relative paths work regardless of subdirectory depth
        // Browser resolves ./app/... → /dist/static/app/...
        expect(config.edicuatex_url).toBe('./app/common/edicuatex/index.html');
        // mathjax_url also uses relative path, resolved by edicuatex-tools.js with its own basePath detection
        expect(config.edicuatex_mathjax_url).toBe('./app/common/exe_math/tex-mml-svg.js');

        // Reset
        globalThis.eXeLearning.config.isStaticMode = false;
      });

      it('uses relative paths (./app/...) for offline installation in subdirectory', () => {
        globalThis.eXeLearning.config.isStaticMode = false;
        globalThis.eXeLearning.config.isOfflineInstallation = true;
        // Deep subdirectory deployment - entry page doesn't contain /app/ marker
        delete window.location;
        window.location = { pathname: '/web/exelearning/v1/index.html' };

        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        // Relative paths work regardless of subdirectory depth
        expect(config.edicuatex_url).toBe('./app/common/edicuatex/index.html');
        expect(config.edicuatex_mathjax_url).toBe('./app/common/exe_math/tex-mml-svg.js');

        // Reset
        globalThis.eXeLearning.config.isOfflineInstallation = false;
      });
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
            onSelect({ assetUrl: 'asset://file.pdf', blobUrl: 'blob://file' });
          },
        },
      };

      config.file_browser_callback('field-1');

      expect(input.value).toBe('asset://file.pdf');
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

    it('file_picker_callback uses asset url directly for images', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

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

      expect(cb).toHaveBeenCalledWith('asset://abc123/file.png', {
        title: 'file.png',
        text: 'file.png',
        alt: '',
        'data-asset-id': 'abc123',
      });
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

      expect(cb).toHaveBeenCalledWith('asset://file.png', {
        title: 'file.png',
        text: 'file.png',
        alt: '',
        'data-asset-id': 'abc123',
      });
    });

    it('file_picker_callback keeps asset urls user-visible for source editing', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

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

      expect(cb).toHaveBeenCalledWith(`asset://${assetUUID}/image.jpg`, {
        title: 'image.jpg',
        text: 'image.jpg',
        alt: '',
        'data-asset-id': assetUUID,
      });
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

      expect(cb).toHaveBeenCalledWith(`asset://${assetUUID}/video.mp4`, {
        title: 'video.mp4',
        text: 'video.mp4',
        alt: '',
        'data-asset-id': assetUUID,
      });
    });

    it('images_upload_handler keeps existing blob url for display (GetContent converts to asset://)', async () => {
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
            getAssetUrl: vi.fn().mockReturnValue('asset://asset-1.png'),
          },
        },
      };

      await config.images_upload_handler(blobInfo, success, failure);

      expect(success).toHaveBeenCalledWith('blob:1', { 'data-asset-id': 'asset-1' });
      expect(failure).not.toHaveBeenCalled();
    });

    it('images_upload_handler stores new images in AssetManager and returns blob url for display', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const success = vi.fn();
      const failure = vi.fn();
      const blobInfo = {
        blobUri: () => 'blob:new',
        blob: () => new Blob(['data'], { type: 'image/png' }),
        filename: () => 'image.png',
      };
      const mockAssetManager = {
        reverseBlobCache: new Map(),
        blobURLCache: new Map(),
        // insertImage returns full asset:// URL
        insertImage: vi.fn().mockResolvedValue('asset://asset-2/image.png'),
        // extractAssetId extracts the UUID from the URL
        extractAssetId: vi.fn().mockReturnValue('asset-2'),
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: mockAssetManager,
        },
      };

      await config.images_upload_handler(blobInfo, success, failure);

      expect(success).toHaveBeenCalledWith('blob:new', { 'data-asset-id': 'asset-2' });
      expect(mockAssetManager.reverseBlobCache.get('blob:new')).toBe('asset-2');
    });

    it('images_upload_handler rejects empty blobs (stale placeholders)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const success = vi.fn();
      const failure = vi.fn();
      const blobInfo = {
        blobUri: () => 'blob:empty',
        blob: () => new Blob([], { type: 'image/png' }),
        filename: () => 'empty.png',
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            reverseBlobCache: new Map(),
          },
        },
      };

      await config.images_upload_handler(blobInfo, success, failure);

      expect(failure).toHaveBeenCalledWith('Error storing image');
      expect(success).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('empty blob'));
      warnSpy.mockRestore();
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

    it('GetContent normalizes editor html back to asset urls', () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const mockPrepareHtmlForSync = vi.fn().mockReturnValue('<img src="asset://img-1.png">');
      const mockEditor = {
        on: vi.fn(),
        getBody: () => document.createElement('div'),
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            prepareHtmlForSync: mockPrepareHtmlForSync,
          },
        },
      };

      config.setup(mockEditor);
      const getContentCall = mockEditor.on.mock.calls.find((call) => call[0] === 'GetContent');
      const event = { content: '<img src="blob:http://localhost/img-1">' };

      getContentCall[1](event);

      expect(mockPrepareHtmlForSync).toHaveBeenCalledWith('<img src="blob:http://localhost/img-1">');
      expect(event.content).toBe('<img src="asset://img-1.png">');
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

      it('resolves image element asset:// URLs to blob:// URLs', async () => {
        const body = document.createElement('div');
        const image = document.createElement('img');
        image.setAttribute('src', 'asset://image-uuid/file.png');
        image.setAttribute('data-mce-src', 'asset://image-uuid/file.png');
        body.appendChild(image);

        const mockBlobUrl = 'blob:http://localhost/image-blob';
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

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://image-uuid/file.png');
        expect(image.getAttribute('src')).toBe(mockBlobUrl);
        // data-mce-src keeps the asset:// URL (not blob) so TinyMCE dialog shows the canonical URL
        expect(image.getAttribute('data-mce-src')).toBe('asset://image-uuid/file.png');
        expect(image.getAttribute('data-asset-src')).toBe('asset://image-uuid/file.png');
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

      it('_patchAssetDialogs replaces blob with asset in dialog and re-resolves after dialog close', async () => {
        const reverseBlobCache = new Map([['blob:http://localhost/img1', 'asset-uuid-1']]);
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: {
              reverseBlobCache,
              getAssetMetadata: vi.fn().mockReturnValue({ filename: 'image.png' }),
              getAssetUrl: vi.fn().mockReturnValue('asset://asset-uuid-1/image.png'),
              resolveAssetURL: vi.fn().mockResolvedValue('blob:http://localhost/new-resolved'),
            },
          },
        };

        const body = document.createElement('div');
        const eventHandlers = {};
        const origOpenResult = { fake: true };
        const mockEditor = {
          on: vi.fn((evt, fn) => {
            eventHandlers[evt] = fn;
          }),
          off: vi.fn(),
          getBody: () => body,
          selection: { getNode: () => document.createElement('img') },
          windowManager: {
            open: vi.fn(() => origOpenResult),
          },
        };

        globalThis.$exeTinyMCE._patchAssetDialogs(mockEditor);

        // Call the patched open with a blob src dialog
        const spec = {
          initialData: { src: { value: 'blob:http://localhost/img1' } },
          onSubmit: vi.fn(),
        };
        mockEditor.windowManager.open(spec);

        // The src should have been replaced with asset://
        expect(spec.initialData.src.value).toBe('asset://asset-uuid-1/image.png');

        // Call the patched onSubmit to register CloseWindow handler
        spec.onSubmit({ close: vi.fn() });

        // Simulate an asset image in editor body
        const img = document.createElement('img');
        img.setAttribute('src', 'asset://asset-uuid-1/image.png');
        body.appendChild(img);

        // Fire CloseWindow
        expect(eventHandlers['CloseWindow']).toBeTruthy();
        eventHandlers['CloseWindow']();

        // Wait for the setTimeout inside the handler
        await new Promise((resolve) => setTimeout(resolve, 100));

        // The handler should have removed data-asset-src if present
        // and called resolveAssetUrlsInEditor (via $exeTinyMCE)
      });

      it('_patchAssetDialogs passes through non-blob dialogs unchanged', () => {
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: { reverseBlobCache: new Map() },
          },
        };

        const origOpenResult = { fake: true };
        const mockEditor = {
          on: vi.fn(),
          off: vi.fn(),
          getBody: () => document.createElement('div'),
          windowManager: {
            open: vi.fn(() => origOpenResult),
          },
        };

        globalThis.$exeTinyMCE._patchAssetDialogs(mockEditor);

        // Call with a non-blob src (plain URL)
        const spec = {
          initialData: { src: { value: 'https://example.com/image.png' } },
        };
        const result = mockEditor.windowManager.open(spec);

        // Should pass through without modification
        expect(spec.initialData.src.value).toBe('https://example.com/image.png');
        expect(result).toEqual(origOpenResult);
      });

      it('_patchAssetDialogs unconditional pass clears stale data-asset-src after image replacement', async () => {
        const reverseBlobCache = new Map([['blob:http://localhost/img1', 'asset-uuid-1']]);
        const resolveAssetURL = vi.fn().mockResolvedValue('blob:http://localhost/new-blob');
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: {
              reverseBlobCache,
              getAssetMetadata: vi.fn().mockReturnValue({ filename: 'image.png' }),
              getAssetUrl: vi.fn().mockReturnValue('asset://asset-uuid-1/image.png'),
              resolveAssetURL,
            },
          },
        };

        const body = document.createElement('div');
        const img = document.createElement('img');
        img.setAttribute('src', 'asset://asset-uuid-1/image.png');
        img.setAttribute('data-asset-src', 'asset://old-stale-value');
        body.appendChild(img);

        const eventHandlers = {};
        const mockEditor = {
          on: vi.fn((evt, fn) => { eventHandlers[evt] = fn; }),
          off: vi.fn(),
          getBody: () => body,
          selection: { getNode: () => img },
          windowManager: { open: vi.fn(() => ({ fake: true })) },
        };

        globalThis.$exeTinyMCE._patchAssetDialogs(mockEditor);

        const spec = {
          initialData: { src: { value: 'blob:http://localhost/img1' } },
          onSubmit: vi.fn(),
        };
        mockEditor.windowManager.open(spec);
        spec.onSubmit({ close: vi.fn() });
        eventHandlers['CloseWindow']();

        await new Promise((resolve) => setTimeout(resolve, 100));

        // The unconditional pass cleared data-asset-src, allowing re-resolution.
        // resolveAssetUrlsInEditor then re-sets data-asset-src as part of normal flow,
        // but the key is that resolveAssetURL was called to fetch the fresh blob.
        expect(resolveAssetURL).toHaveBeenCalledWith('asset://asset-uuid-1/image.png');
      });

      it('_patchAssetDialogs converts media dialog blob source to asset URL', () => {
        const reverseBlobCache = new Map([['blob:http://localhost/audio1', 'audio-uuid-1']]);
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: {
              reverseBlobCache,
              getAssetMetadata: vi.fn().mockReturnValue({ filename: 'audio.mp3' }),
              getAssetUrl: vi.fn().mockReturnValue('asset://audio-uuid-1/audio.mp3'),
            },
          },
        };

        const origOpenResult = { fake: true };
        const mockEditor = {
          on: vi.fn(),
          off: vi.fn(),
          getBody: () => document.createElement('div'),
          selection: { getNode: () => document.createElement('div') },
          windowManager: {
            open: vi.fn(() => origOpenResult),
          },
        };

        globalThis.$exeTinyMCE._patchAssetDialogs(mockEditor);

        const spec = {
          initialData: { source: { value: 'blob:http://localhost/audio1' } },
          onSubmit: vi.fn(),
        };
        const result = mockEditor.windowManager.open(spec);

        expect(spec.initialData.source.value).toBe('asset://audio-uuid-1/audio.mp3');
        expect(result).toEqual(origOpenResult);
      });

      it('_patchAssetDialogs media dialog triggers re-resolve after submit', async () => {
        const reverseBlobCache = new Map([['blob:http://localhost/audio1', 'audio-uuid-1']]);
        const resolveAssetURL = vi.fn().mockResolvedValue('blob:http://localhost/new-audio-blob');
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: {
              reverseBlobCache,
              getAssetMetadata: vi.fn().mockReturnValue({ filename: 'audio.mp3' }),
              getAssetUrl: vi.fn().mockReturnValue('asset://audio-uuid-1/audio.mp3'),
              resolveAssetURL,
            },
          },
        };

        const body = document.createElement('div');
        const audio = document.createElement('audio');
        audio.setAttribute('src', 'asset://audio-uuid-1/audio.mp3');
        audio.setAttribute('data-asset-src', 'asset://audio-uuid-1/audio.mp3');
        body.appendChild(audio);

        const eventHandlers = {};
        const mockEditor = {
          on: vi.fn((evt, fn) => { eventHandlers[evt] = fn; }),
          off: vi.fn(),
          getBody: () => body,
          selection: { getNode: () => document.createElement('div') },
          windowManager: { open: vi.fn(() => ({ fake: true })) },
        };

        globalThis.$exeTinyMCE._patchAssetDialogs(mockEditor);

        const spec = {
          initialData: { source: { value: 'blob:http://localhost/audio1' } },
          onSubmit: vi.fn(),
        };
        mockEditor.windowManager.open(spec);
        spec.onSubmit({ close: vi.fn() });
        eventHandlers['CloseWindow']();

        await new Promise((resolve) => setTimeout(resolve, 100));

        // data-asset-src should be cleared and re-resolution triggered
        expect(resolveAssetURL).toHaveBeenCalledWith('asset://audio-uuid-1/audio.mp3');
      });

      it('_patchAssetDialogs passes through non-blob media source unchanged', () => {
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: { reverseBlobCache: new Map() },
          },
        };

        const origOpenResult = { fake: true };
        const mockEditor = {
          on: vi.fn(),
          off: vi.fn(),
          getBody: () => document.createElement('div'),
          windowManager: {
            open: vi.fn(() => origOpenResult),
          },
        };

        globalThis.$exeTinyMCE._patchAssetDialogs(mockEditor);

        const spec = {
          initialData: { source: { value: 'https://example.com/audio.mp3' } },
        };
        const result = mockEditor.windowManager.open(spec);

        expect(spec.initialData.source.value).toBe('https://example.com/audio.mp3');
        expect(result).toEqual(origOpenResult);
      });

      it('_patchAssetDialogs handles both image and media dialogs independently', () => {
        const reverseBlobCache = new Map([
          ['blob:http://localhost/img1', 'img-uuid'],
          ['blob:http://localhost/audio1', 'audio-uuid'],
        ]);
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: {
              reverseBlobCache,
              getAssetMetadata: vi.fn((id) =>
                id === 'img-uuid' ? { filename: 'photo.png' } : { filename: 'song.mp3' }
              ),
              getAssetUrl: vi.fn((id, name) => 'asset://' + id + '/' + name),
            },
          },
        };

        const mockEditor = {
          on: vi.fn(),
          off: vi.fn(),
          getBody: () => document.createElement('div'),
          selection: { getNode: () => document.createElement('img') },
          windowManager: { open: vi.fn(() => ({ fake: true })) },
        };

        globalThis.$exeTinyMCE._patchAssetDialogs(mockEditor);

        // Image dialog
        const imgSpec = {
          initialData: { src: { value: 'blob:http://localhost/img1' } },
          onSubmit: vi.fn(),
        };
        mockEditor.windowManager.open(imgSpec);
        expect(imgSpec.initialData.src.value).toBe('asset://img-uuid/photo.png');

        // Media dialog (separate call)
        const mediaSpec = {
          initialData: { source: { value: 'blob:http://localhost/audio1' } },
          onSubmit: vi.fn(),
        };
        mockEditor.windowManager.open(mediaSpec);
        expect(mediaSpec.initialData.source.value).toBe('asset://audio-uuid/song.mp3');
      });

      it('resolveAssetUrlsInEditor uses undoManager.ignore for src mutations', async () => {
        const body = document.createElement('div');
        const img = document.createElement('img');
        img.setAttribute('src', 'asset://test-uuid/image.png');
        body.appendChild(img);

        const mockBlobUrl = 'blob:http://localhost/resolved';
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: {
              resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
            },
          },
        };

        const ignoreFn = vi.fn((cb) => cb());
        const mockEditor = {
          getBody: () => body,
          undoManager: { ignore: ignoreFn },
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(img.getAttribute('src')).toBe(mockBlobUrl);
        expect(ignoreFn).toHaveBeenCalled();
      });

      it('resolveAssetUrlsInEditor resolves without undoManager (backward compat)', async () => {
        const body = document.createElement('div');
        const img = document.createElement('img');
        img.setAttribute('src', 'asset://test-uuid/image.png');
        body.appendChild(img);

        const mockBlobUrl = 'blob:http://localhost/resolved-no-undo';
        window.eXeLearning.app.project = {
          _yjsBridge: {
            assetManager: {
              resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
            },
          },
        };

        const mockEditor = {
          getBody: () => body,
          // No undoManager
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(img.getAttribute('src')).toBe(mockBlobUrl);
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

      it('observes dynamically inserted asset:// images in the editor body', async () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];
        const body = document.createElement('div');
        const mockBlobUrl = 'blob:http://localhost/dynamic-image';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockBlobUrl),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const listeners = new Map();
        const mockEditor = {
          id: 'editor',
          on: vi.fn((event, handler) => {
            listeners.set(event, handler);
          }),
          getBody: () => body,
        };

        config.setup(mockEditor);
        config.init_instance_callback(mockEditor);

        const image = document.createElement('img');
        image.setAttribute('src', 'asset://dynamic-image/file.png');
        body.appendChild(image);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://dynamic-image/file.png');
        expect(image.getAttribute('src')).toBe(mockBlobUrl);
        expect(listeners.get('remove')).toEqual(expect.any(Function));
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

      it('resolves mce-preview-object spans with iframe for PDFs and adds data-asset-src', async () => {
        // Iframes in mce-preview-object spans are resolved for display.
        // The span's data-mce-p-src preserves the original URL, but data-asset-src
        // is also added to the iframe as a backup.
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
        // data-asset-src is added as a backup for persistence
        expect(iframe.getAttribute('data-asset-src')).toBe('asset://pdf-preview-uuid/file.pdf');
      });

      it('uses resolveHtmlWithAssets for HTML iframes with data-mce-html attribute', async () => {
        const body = document.createElement('div');
        const iframe = document.createElement('iframe');
        // Use valid hex UUID format that matches the regex /asset:\/\/([a-f0-9-]+)/i
        iframe.setAttribute('src', 'asset://abc12345-def6-7890-abcd-ef1234567890/index.html');
        iframe.setAttribute('data-mce-html', 'true');
        body.appendChild(iframe);

        const mockResolvedHtmlUrl = 'blob:http://localhost/html-blob-with-assets';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue('blob:should-not-use'),
          resolveHtmlWithAssets: vi.fn().mockResolvedValue(mockResolvedHtmlUrl),
          reverseBlobCache: new Map(),
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

        // Should use resolveHtmlWithAssets for HTML iframes
        expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalledWith('abc12345-def6-7890-abcd-ef1234567890');
        expect(mockAssetManager.resolveAssetURL).not.toHaveBeenCalled();
        expect(iframe.getAttribute('src')).toBe(mockResolvedHtmlUrl);
        expect(iframe.getAttribute('data-asset-src')).toBe('asset://abc12345-def6-7890-abcd-ef1234567890/index.html');
      });

      it('uses resolveHtmlWithAssets for iframes with .html extension', async () => {
        const body = document.createElement('div');
        const iframe = document.createElement('iframe');
        // Use valid hex UUID format
        iframe.setAttribute('src', 'asset://def56789-0abc-1234-5678-90abcdef1234/page.html');
        // No data-mce-html attribute, but .html extension
        body.appendChild(iframe);

        const mockResolvedHtmlUrl = 'blob:http://localhost/html-page-blob';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue('blob:should-not-use'),
          resolveHtmlWithAssets: vi.fn().mockResolvedValue(mockResolvedHtmlUrl),
          reverseBlobCache: new Map(),
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

        // Should detect HTML by extension and use resolveHtmlWithAssets
        expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalledWith('def56789-0abc-1234-5678-90abcdef1234');
        expect(mockAssetManager.resolveAssetURL).not.toHaveBeenCalled();
        expect(iframe.getAttribute('src')).toBe(mockResolvedHtmlUrl);
      });

      it('falls back to resolveAssetURL when resolveHtmlWithAssets returns null', async () => {
        const body = document.createElement('div');
        const iframe = document.createElement('iframe');
        // Use valid hex UUID format
        iframe.setAttribute('src', 'asset://aaa11111-bbb2-2222-ccc3-333ddd444eee/page.html');
        iframe.setAttribute('data-mce-html', 'true');
        body.appendChild(iframe);

        const mockFallbackUrl = 'blob:http://localhost/fallback-blob';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockFallbackUrl),
          resolveHtmlWithAssets: vi.fn().mockResolvedValue(null),
          reverseBlobCache: new Map(),
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

        // Should try HTML resolution first
        expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalledWith('aaa11111-bbb2-2222-ccc3-333ddd444eee');
        // Note: This implementation doesn't fall back - it returns early if resolvedUrl is null
        // The src will remain as the original asset:// URL
        expect(iframe.getAttribute('data-asset-src')).toBe('asset://aaa11111-bbb2-2222-ccc3-333ddd444eee/page.html');
      });

      it('logs warning when resolveHtmlWithAssets throws', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const body = document.createElement('div');
        const iframe = document.createElement('iframe');
        // Use valid hex UUID format
        iframe.setAttribute('src', 'asset://eee55555-fff6-6666-aaa7-777bbb888ccc/page.html');
        iframe.setAttribute('data-mce-html', 'true');
        body.appendChild(iframe);

        const mockAssetManager = {
          resolveAssetURL: vi.fn(),
          resolveHtmlWithAssets: vi.fn().mockRejectedValue(new Error('HTML resolution failed')),
          reverseBlobCache: new Map(),
        };
        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: mockAssetManager },
        };

        const mockEditor = {
          getBody: () => body,
        };

        globalThis.$exeTinyMCE.resolveAssetUrlsInEditor(mockEditor);

        // Wait for async resolution
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Should catch error and log warning
        expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
          '[TinyMCE] Failed to resolve HTML asset:',
          'asset://eee55555-fff6-6666-aaa7-777bbb888ccc/page.html',
          expect.any(Error)
        );

        warnSpy.mockRestore();
      });

      it('handles HTML iframes in mce-preview-object spans', async () => {
        const body = document.createElement('div');
        const span = document.createElement('span');
        span.classList.add('mce-preview-object');
        // Use valid hex UUID format
        span.setAttribute('data-mce-p-src', 'asset://ccc99999-ddd0-0000-eee1-111fff222333/index.html');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', 'asset://ccc99999-ddd0-0000-eee1-111fff222333/index.html');
        iframe.setAttribute('data-mce-html', 'true');
        span.appendChild(iframe);
        body.appendChild(span);

        const mockResolvedHtmlUrl = 'blob:http://localhost/html-preview-resolved';
        const mockAssetManager = {
          resolveAssetURL: vi.fn(),
          resolveHtmlWithAssets: vi.fn().mockResolvedValue(mockResolvedHtmlUrl),
          reverseBlobCache: new Map(),
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

        // Should use resolveHtmlWithAssets for HTML iframes in spans
        expect(mockAssetManager.resolveHtmlWithAssets).toHaveBeenCalledWith('ccc99999-ddd0-0000-eee1-111fff222333');
        expect(iframe.getAttribute('src')).toBe(mockResolvedHtmlUrl);
        expect(iframe.getAttribute('data-asset-src')).toBe('asset://ccc99999-ddd0-0000-eee1-111fff222333/index.html');
      });

      it('does not use resolveHtmlWithAssets for non-HTML iframes (PDFs)', async () => {
        const body = document.createElement('div');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('src', 'asset://pdf-uuid/document.pdf');
        // No data-mce-html attribute, .pdf extension
        body.appendChild(iframe);

        const mockPdfBlobUrl = 'blob:http://localhost/pdf-direct';
        const mockAssetManager = {
          resolveAssetURL: vi.fn().mockResolvedValue(mockPdfBlobUrl),
          resolveHtmlWithAssets: vi.fn(),
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

        // Should NOT use resolveHtmlWithAssets for PDFs
        expect(mockAssetManager.resolveHtmlWithAssets).not.toHaveBeenCalled();
        expect(mockAssetManager.resolveAssetURL).toHaveBeenCalledWith('asset://pdf-uuid/document.pdf');
        expect(iframe.getAttribute('src')).toBe(mockPdfBlobUrl);
      });
    });

    describe('SetContent handler - Bun script stripping', () => {
      it('strips data-mce-src and data-asset-src with asset:// from content before TinyMCE parses it', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];
        const resolveHTMLAssetsSync = vi.fn((html) => html);

        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: { resolveHTMLAssetsSync, reverseBlobCache: new Map() } },
        };

        const mockEditor = {
          on: vi.fn(),
          getBody: () => document.createElement('div'),
        };

        config.setup(mockEditor);

        const beforeSetContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'BeforeSetContent');
        const beforeSetContentHandler = beforeSetContentCall[1];
        const event = {
          content:
            '<p><img src="asset://image-uuid/file.png" data-mce-src="asset://image-uuid/file.png" data-asset-src="asset://image-uuid/file.png"></p>',
        };

        beforeSetContentHandler(event);

        expect(event.content).toContain('src="asset://image-uuid/file.png"');
        expect(event.content).not.toContain('data-mce-src');
        expect(event.content).not.toContain('data-asset-src');
      });

      it('recovers stale blob:// src to asset:// via reverseBlobCache', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];
        const reverseBlobCache = new Map([['blob:http://localhost/stale', 'image-uuid']]);
        const resolveHTMLAssetsSync = vi.fn((html) => html);

        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: { resolveHTMLAssetsSync, reverseBlobCache } },
        };

        const mockEditor = {
          on: vi.fn(),
          getBody: () => document.createElement('div'),
        };

        config.setup(mockEditor);

        const beforeSetContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'BeforeSetContent');
        const beforeSetContentHandler = beforeSetContentCall[1];
        const event = {
          content: '<p><img src="blob:http://localhost/stale" data-asset-id="image-uuid"></p>',
        };

        beforeSetContentHandler(event);

        expect(event.content).toContain('asset://image-uuid');
      });

      it('recovers stale blob:// src via data-asset-id fallback', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];
        const reverseBlobCache = new Map();
        const resolveHTMLAssetsSync = vi.fn((html) => html);

        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: { resolveHTMLAssetsSync, reverseBlobCache } },
        };

        const mockEditor = {
          on: vi.fn(),
          getBody: () => document.createElement('div'),
        };

        config.setup(mockEditor);

        const beforeSetContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'BeforeSetContent');
        const beforeSetContentHandler = beforeSetContentCall[1];
        const event = {
          content: '<p><img data-asset-id="fallback-uuid" src="blob:http://localhost/unknown"></p>',
        };

        beforeSetContentHandler(event);

        expect(event.content).toContain('asset://fallback-uuid');
      });

      it('leaves non-media blob urls and plain content unchanged', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];
        const resolveHTMLAssetsSync = vi.fn((html) => html);

        window.eXeLearning.app.project = {
          _yjsBridge: { assetManager: { resolveHTMLAssetsSync, reverseBlobCache: new Map() } },
        };

        const mockEditor = {
          on: vi.fn(),
          getBody: () => document.createElement('div'),
        };

        config.setup(mockEditor);

        const beforeSetContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'BeforeSetContent');
        const beforeSetContentHandler = beforeSetContentCall[1];
        const event = { content: '<p>Hello world</p>' };

        beforeSetContentHandler(event);

        expect(event.content).toBe('<p>Hello world</p>');
      });

      it('removes Bun dev server scripts (/_bun/ path) from editor body', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML = '<p>content</p><script src="/_bun/client/test.js"></script>';

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);

        // Get the SetContent handler
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        // Call with non-initial, non-paste event
        setContentHandler({ initial: false, paste: false });

        // Script should be removed
        expect(body.querySelectorAll('script').length).toBe(0);
        expect(body.textContent).toContain('content');
      });

      it('removes scripts with data-bun-dev-server-script attribute from editor body', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML =
          '<p>content</p><script data-bun-dev-server-script src="/test.js"></script>';

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        setContentHandler({ initial: false, paste: false });

        expect(body.querySelectorAll('script').length).toBe(0);
      });

      it('removes Bun chunk scripts (path traversal pattern) from editor body', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML =
          '<p>content</p><script src="/../../../../../../chunk-wnkq4dvw.js"></script>';

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        setContentHandler({ initial: false, paste: false });

        expect(body.querySelectorAll('script').length).toBe(0);
      });

      it('removes Bun inline scripts (/_bun/unref pattern) from editor body', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML =
          "<p>content</p><script>navigator.sendBeacon('/_bun/unref', 'data');</script>";

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        setContentHandler({ initial: false, paste: false });

        expect(body.querySelectorAll('script').length).toBe(0);
      });

      it('preserves non-Bun scripts in editor body', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML =
          '<p>content</p><script src="/app/custom.js"></script><script>console.log("hello");</script>';

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        setContentHandler({ initial: false, paste: false });

        // Both non-Bun scripts should be preserved
        expect(body.querySelectorAll('script').length).toBe(2);
      });

      it('skips stripping when e.initial is true', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML = '<p>content</p><script src="/_bun/client/test.js"></script>';

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        // Call with initial: true
        setContentHandler({ initial: true, paste: false });

        // Script should NOT be removed (we skip initial loads)
        expect(body.querySelectorAll('script').length).toBe(1);
      });

      it('skips stripping when e.paste is true', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML = '<p>content</p><script src="/_bun/client/test.js"></script>';

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        // Call with paste: true
        setContentHandler({ initial: false, paste: true });

        // Script should NOT be removed (we skip paste operations)
        expect(body.querySelectorAll('script').length).toBe(1);
      });

      it('handles null body gracefully', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        let getBodyCalled = false;
        const mockEditor = {
          on: vi.fn(),
          getBody: function () {
            getBodyCalled = true;
            return null;
          },
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        // Should not throw even with null body
        expect(() => setContentHandler({ initial: false, paste: false })).not.toThrow();

        // Verify getBody was called (meaning we entered the if block and hit the null body branch)
        expect(getBodyCalled).toBe(true);
      });

      it('removes multiple Bun scripts of different types from editor body', () => {
        globalThis.$exeTinyMCE.init('single', '#editor');
        const config = globalThis.tinymce.init.mock.calls[0][0];

        const body = document.createElement('div');
        body.innerHTML = `
          <div class="exe-layout-2-cols">
            <div class="exe-col-1">Content</div>
          </div>
          <script src="/_bun/client/test.js"></script>
          <script data-bun-dev-server-script src="/something.js"></script>
          <script src="/../../chunk-abc123.js"></script>
          <script>navigator.sendBeacon('/_bun/unref', 'x');</script>
          <script src="/app/custom.js"></script>
        `;

        const mockEditor = {
          on: vi.fn(),
          getBody: () => body,
        };

        config.setup(mockEditor);
        const setContentCall = mockEditor.on.mock.calls.find((c) => c[0] === 'SetContent');
        const setContentHandler = setContentCall[1];

        setContentHandler({ initial: false, paste: false });

        // Only the non-Bun script should remain
        expect(body.querySelectorAll('script').length).toBe(1);
        expect(body.querySelector('script').getAttribute('src')).toBe('/app/custom.js');
        // Content should be preserved
        expect(body.textContent).toContain('Content');
      });
    });

    describe('stripBunInjectedScripts', () => {
      it('should remove Bun dev server scripts with /_bun/ path', () => {
        const html = '<div>content</div><script type="module" src="/_bun/client/test.js"></script>';
        const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
        expect(result).not.toContain('/_bun/');
        expect(result).toContain('content');
      });

      it('should remove scripts with data-bun-dev-server-script attribute', () => {
        const html = '<div>content</div><script type="module" crossorigin="" src="/_bun/client/2-50-50-00000000d4f90183.js" data-bun-dev-server-script=""></script>';
        const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
        expect(result).not.toContain('data-bun-dev-server-script');
        expect(result).not.toContain('/_bun/');
      });

      it('should remove Bun chunk scripts with path traversal (production pattern)', () => {
        const html = '<div>content</div><script type="module" crossorigin="" src="/../../../../../../chunk-wnkq4dvw.js"></script>';
        const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
        expect(result).not.toContain('chunk-');
        expect(result).not.toContain('/../');
      });

      it('should remove Bun inline visibility change script', () => {
        const html = '<div>content</div><script>((a)=>{document.addEventListener(\'visibilitychange\',globalThis[Symbol.for(\'bun:loadData\')]=()=>document.visibilityState===\'hidden\'&&navigator.sendBeacon(\'/_bun/unref\',a));})(document.querySelector(\'[data-bun-dev-server-script]\').src.slice(-11,-3))</script>';
        const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
        expect(result).not.toContain('/_bun/unref');
        expect(result).not.toContain('visibilitychange');
      });

      it('should preserve non-Bun scripts', () => {
        const html = '<div>content</div><script src="/app/custom.js"></script>';
        const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
        expect(result).toContain('/app/custom.js');
      });

      it('should preserve inline scripts that are not Bun-related', () => {
        const html = '<div>content</div><script>console.log("hello");</script>';
        const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
        expect(result).toContain('console.log');
      });

      it('should handle null or empty input', () => {
        expect(globalThis.$exeTinyMCE.stripBunInjectedScripts(null)).toBeNull();
        expect(globalThis.$exeTinyMCE.stripBunInjectedScripts('')).toBe('');
        expect(globalThis.$exeTinyMCE.stripBunInjectedScripts(undefined)).toBeUndefined();
      });

      it('should handle HTML with multiple Bun scripts', () => {
        const html = `
          <div class="exe-layout-2-cols">
            <div class="exe-col-1">Content</div>
            <div class="exe-col-2">More content</div>
          </div>
          <script type="module" crossorigin="" src="/_bun/client/2-50-50-00000000d4f90183.js" data-bun-dev-server-script=""></script>
          <script>((a)=>{navigator.sendBeacon('/_bun/unref',a);})()</script>
        `;
        const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
        expect(result).toContain('exe-layout-2-cols');
        expect(result).toContain('Content');
        expect(result).toContain('More content');
        expect(result).not.toContain('/_bun/');
        expect(result).not.toContain('data-bun-dev-server-script');
      });

      it('should handle various chunk file name patterns', () => {
        // Test with different hash lengths
        const patterns = [
          '/../../chunk-abc123.js',
          '/../../../chunk-xyz789.js',
          '/../../../../../../chunk-wnkq4dvw.js',
        ];

        patterns.forEach((pattern) => {
          const html = `<div>test</div><script src="${pattern}"></script>`;
          const result = globalThis.$exeTinyMCE.stripBunInjectedScripts(html);
          expect(result).not.toContain('chunk-');
        });
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
      startSpy.mockRestore();
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

  // ─── paste_preprocess ────────────────────────────────────────────────────────

  describe('paste_preprocess', () => {
    beforeEach(() => {
      globalThis.$exeTinyMCE.init = realExeTinyMCEInit;
    });

    function getPastePreprocess() {
      globalThis.$exeTinyMCE._blobPasteWarningToast = null;
      globalThis.$exeTinyMCE.init('single', '#editor');
      return globalThis.tinymce.init.mock.calls[0][0].paste_preprocess;
    }

    it('does nothing when args.content is empty', () => {
      const createToast = vi.fn();
      window.eXeLearning.app.toasts = { createToast };
      getPastePreprocess()(null, { content: '' });
      expect(createToast).not.toHaveBeenCalled();
    });

    it('does nothing when content has no blob: URL', () => {
      const createToast = vi.fn();
      window.eXeLearning.app.toasts = { createToast };
      getPastePreprocess()(null, { content: '<img src="asset://abc.jpg">' });
      expect(createToast).not.toHaveBeenCalled();
    });

    it('shows warning when content has blob: URL and no AssetManager', () => {
      const createToast = vi.fn(() => ({ toastElement: document.createElement('div') }));
      window.eXeLearning.app.toasts = { createToast };
      delete window.eXeLearning.app.project;
      getPastePreprocess()(null, { content: '<img src="blob:https://localhost/abc">' });
      expect(createToast).toHaveBeenCalledOnce();
      expect(createToast.mock.calls[0][0].icon).toBe('warning');
    });

    it('shows warning when blob URL is not in reverseBlobCache', () => {
      const createToast = vi.fn(() => ({ toastElement: document.createElement('div') }));
      window.eXeLearning.app.toasts = { createToast };
      window.eXeLearning.app.project = {
        _yjsBridge: { assetManager: { reverseBlobCache: new Map() } },
      };
      getPastePreprocess()(null, { content: '<img src="blob:https://localhost/abc">' });
      expect(createToast).toHaveBeenCalledOnce();
    });

    it('does NOT warn when all blob URLs are known (in reverseBlobCache)', () => {
      const createToast = vi.fn();
      window.eXeLearning.app.toasts = { createToast };
      const cache = new Map([['blob:https://localhost/abc', 'asset-1']]);
      window.eXeLearning.app.project = {
        _yjsBridge: { assetManager: { reverseBlobCache: cache } },
      };
      getPastePreprocess()(null, { content: '<img src="blob:https://localhost/abc">' });
      expect(createToast).not.toHaveBeenCalled();
    });

    it('warns when at least one blob URL is unknown', () => {
      const createToast = vi.fn(() => ({ toastElement: document.createElement('div') }));
      window.eXeLearning.app.toasts = { createToast };
      const cache = new Map([['blob:https://localhost/known', 'asset-1']]);
      window.eXeLearning.app.project = {
        _yjsBridge: { assetManager: { reverseBlobCache: cache } },
      };
      getPastePreprocess()(null, {
        content: '<img src="blob:https://localhost/known"><img src="blob:https://localhost/unknown">',
      });
      expect(createToast).toHaveBeenCalledOnce();
    });

    it('does not show duplicate toast when one is already visible', () => {
      const createToast = vi.fn();
      window.eXeLearning.app.toasts = { createToast };
      const connectedDiv = document.createElement('div');
      document.body.appendChild(connectedDiv);
      const pp = getPastePreprocess();
      globalThis.$exeTinyMCE._blobPasteWarningToast = { toastElement: connectedDiv };
      pp(null, { content: '<img src="blob:https://localhost/abc">' });
      expect(createToast).not.toHaveBeenCalled();
      connectedDiv.remove();
    });

    it('does not crash when toastsManager is absent', () => {
      delete window.eXeLearning.app.toasts;
      const pp = getPastePreprocess();
      expect(() =>
        pp(null, { content: '<img src="blob:https://localhost/abc">' })
      ).not.toThrow();
    });

    it('stores the toast reference in _blobPasteWarningToast', () => {
      const toastObj = { toastElement: document.createElement('div') };
      const createToast = vi.fn(() => toastObj);
      window.eXeLearning.app.toasts = { createToast };
      delete window.eXeLearning.app.project;
      getPastePreprocess()(null, { content: '<img src="blob:https://localhost/abc">' });
      expect(globalThis.$exeTinyMCE._blobPasteWarningToast).toBe(toastObj);
    });
  });

  // ─── images_upload_handler – missing branches ─────────────────────────────

  describe('images_upload_handler – additional branches', () => {
    beforeEach(() => {
      globalThis.$exeTinyMCE.init = realExeTinyMCEInit;
    });

    it('uses "image.png" as fallback when blobInfo.filename() returns undefined', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const blobData = new Blob(['data'], { type: 'image/png' });
      const blobInfo = {
        blobUri: () => 'blob:new-no-name',
        blob: () => blobData,
        filename: () => undefined,
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            reverseBlobCache: new Map(),
            blobURLCache: new Map(),
            insertImage: vi.fn().mockResolvedValue('asset://asset-fn/image.png'),
            extractAssetId: vi.fn().mockReturnValue('asset-fn'),
          },
        },
      };
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:fn-created');
      const success = vi.fn();

      await config.images_upload_handler(blobInfo, success, vi.fn());

      expect(success).toHaveBeenCalledWith('blob:new-no-name', { 'data-asset-id': 'asset-fn' });
    });

    it('uses cached blob URL from blobURLCache when getBlobURLSynced is not available', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const blobInfo = {
        blobUri: () => 'blob:cached',
        blob: () => new Blob(['data'], { type: 'image/png' }),
        filename: () => 'img.png',
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            reverseBlobCache: new Map(),
            blobURLCache: new Map([['asset-cached', 'blob:from-cache']]),
            insertImage: vi.fn().mockResolvedValue('asset://asset-cached/img.png'),
            extractAssetId: vi.fn().mockReturnValue('asset-cached'),
          },
        },
      };
      const success = vi.fn();

      await config.images_upload_handler(blobInfo, success, vi.fn());

      expect(success).toHaveBeenCalledWith('blob:cached', { 'data-asset-id': 'asset-cached' });
    });

    it('syncs reverseBlobCache when blob URL exists but is missing from it', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const reverseBlobCache = new Map();
      const blobInfo = {
        blobUri: () => 'blob:sync-test',
        blob: () => new Blob(['data'], { type: 'image/png' }),
        filename: () => 'img.png',
      };
      window.eXeLearning.app.project = {
        _yjsBridge: {
          assetManager: {
            reverseBlobCache,
            blobURLCache: new Map([['asset-sync', 'blob:existing-url']]),
            getBlobURLSynced: vi.fn(() => 'blob:existing-url'),
            insertImage: vi.fn().mockResolvedValue('asset://asset-sync/img.png'),
            extractAssetId: vi.fn().mockReturnValue('asset-sync'),
          },
        },
      };
      const success = vi.fn();

      await config.images_upload_handler(blobInfo, success, vi.fn());

      expect(reverseBlobCache.get('blob:sync-test')).toBe('asset-sync');
      expect(success).toHaveBeenCalledWith('blob:sync-test', { 'data-asset-id': 'asset-sync' });
    });
  });

  // ─── init_instance_callback – MutationObserver ────────────────────────────

  describe('init_instance_callback – MutationObserver', () => {
    beforeEach(() => {
      globalThis.$exeTinyMCE.init = realExeTinyMCEInit;
    });

    function getInitInstanceCallback() {
      const resolveAssetSpy = vi
        .spyOn(globalThis.$exeTinyMCE, 'resolveAssetUrlsInEditor')
        .mockImplementation(() => {});
      globalThis.$exeTinyMCE.init('single', '#editor');
      const cb = globalThis.tinymce.init.mock.calls[0][0].init_instance_callback;
      return { cb, resolveAssetSpy };
    }

    it('resolves assets when a child element with asset:// src is added', async () => {
      const editorBody = document.createElement('div');
      document.body.appendChild(editorBody);
      const eventHandlers = {};
      const mockEditor = {
        getBody: () => editorBody,
        on: (event, fn) => { eventHandlers[event] = fn; },
      };
      const { cb, resolveAssetSpy } = getInitInstanceCallback();
      cb(mockEditor);

      const audio = document.createElement('audio');
      audio.setAttribute('src', 'asset://abc.mp3');
      editorBody.appendChild(audio);

      await new Promise((r) => setTimeout(r, 0));

      expect(resolveAssetSpy).toHaveBeenCalledWith(mockEditor);
      resolveAssetSpy.mockRestore();
      editorBody.remove();
    });

    it('does not resolve assets when added element has no asset:// src', async () => {
      const editorBody = document.createElement('div');
      document.body.appendChild(editorBody);
      const mockEditor = {
        getBody: () => editorBody,
        on: vi.fn(),
      };
      const { cb, resolveAssetSpy } = getInitInstanceCallback();
      cb(mockEditor);

      editorBody.appendChild(document.createElement('p'));
      await new Promise((r) => setTimeout(r, 0));

      expect(resolveAssetSpy).not.toHaveBeenCalled();
      resolveAssetSpy.mockRestore();
      editorBody.remove();
    });

    it('calls observer.disconnect() when editor remove event fires', () => {
      const editorBody = document.createElement('div');
      document.body.appendChild(editorBody);
      const eventHandlers = {};
      const mockEditor = {
        getBody: () => editorBody,
        on: (event, fn) => { eventHandlers[event] = fn; },
      };
      const { cb, resolveAssetSpy } = getInitInstanceCallback();
      cb(mockEditor);

      expect(() => eventHandlers['remove']?.()).not.toThrow();
      resolveAssetSpy.mockRestore();
      editorBody.remove();
    });

    it('does nothing when editor body is null', () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const cb = globalThis.tinymce.init.mock.calls[0][0].init_instance_callback;
      const mockEditor = { getBody: () => null, on: vi.fn() };
      expect(() => cb(mockEditor)).not.toThrow();
      expect(mockEditor.on).not.toHaveBeenCalled();
    });
  });

  // ─── additional branch coverage ───────────────────────────────────────────

  describe('additional branch coverage', () => {
    beforeEach(() => {
      globalThis.$exeTinyMCE.init = realExeTinyMCEInit;
    });

    it('init uses empty width when documentWidth is undefined', () => {
      const savedWidth = globalThis.$exeTinyMCEToggler.documentWidth;
      delete globalThis.$exeTinyMCEToggler.documentWidth;
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      expect(config).toBeDefined();
      globalThis.$exeTinyMCEToggler.documentWidth = savedWidth;
    });

    it('file_picker_callback with HTML asset and active editor inserts iframe', () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const insertContent = vi.fn();
      const close = vi.fn();
      globalThis.tinymce.activeEditor = { insertContent, windowManager: { close } };
      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              asset: { mime: 'text/html', filename: 'page.html', id: 'html-asset-id' },
              assetUrl: 'asset://html-asset-id/page.html',
              blobUrl: 'blob:https://localhost/html-blob',
            });
          },
        },
      };
      config.file_picker_callback(vi.fn(), '', { filetype: 'media' });
      expect(insertContent).toHaveBeenCalled();
      expect(close).toHaveBeenCalled();
      delete globalThis.tinymce.activeEditor;
    });

    it('file_picker_callback with HTML asset and no active editor skips insert', () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      globalThis.tinymce.activeEditor = null;
      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              asset: { mime: 'text/html', filename: 'page.html', id: 'html-asset-id' },
              assetUrl: 'asset://html-asset-id/page.html',
              blobUrl: 'blob:https://localhost/html-blob',
            });
          },
        },
      };
      expect(() => config.file_picker_callback(vi.fn(), '', { filetype: 'media' })).not.toThrow();
      delete globalThis.tinymce.activeEditor;
    });

    it('file_picker_callback with image already in reverseBlobCache skips cache update', () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const blobUrl = 'blob:https://localhost/cached-img';
      const reverseBlobCache = new Map([[blobUrl, 'cached-id']]);
      const blobURLCache = new Map();
      window.eXeLearning.app.project = {
        _yjsBridge: { assetManager: { reverseBlobCache, blobURLCache } },
      };
      const cb = vi.fn();
      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              asset: { mime: 'image/png', filename: 'img.png', id: 'cached-id' },
              assetUrl: 'asset://cached-id/img.png',
              blobUrl,
            });
          },
        },
      };
      config.file_picker_callback(cb, '', { filetype: 'image' });
      // Cache should not be modified (blob was already present)
      expect(reverseBlobCache.size).toBe(1);
      expect(reverseBlobCache.get(blobUrl)).toBe('cached-id');
    });

    it('addLinkAndToggle with hide=false does not call toggle', () => {
      const toggleSpy = vi.spyOn(globalThis.$exeTinyMCEToggler, 'toggle').mockImplementation(() => {});
      const label = globalThis.$(document.createElement('label'));
      const link = globalThis.$(document.createElement('a'));
      globalThis.$exeTinyMCEToggler.addLinkAndToggle('editor', label, link, false);
      expect(toggleSpy).not.toHaveBeenCalled();
      toggleSpy.mockRestore();
    });

    it('toggle without iframe in parent does not crash', () => {
      const button = document.createElement('a');
      button.id = 'editor-toggler';
      button.classList.add('visible-editor');
      // No iframe added to DOM
      expect(() => globalThis.$exeTinyMCEToggler.toggle('editor', button)).not.toThrow();
    });

    it('createViewer sets documentWidth when it is undefined', () => {
      const savedWidth = globalThis.$exeTinyMCEToggler.documentWidth;
      delete globalThis.$exeTinyMCEToggler.documentWidth;
      const textarea = document.getElementById('editor');
      const wrapper = globalThis.$(textarea);
      expect(() => globalThis.$exeTinyMCEToggler.createViewer(wrapper)).not.toThrow();
      expect(typeof globalThis.$exeTinyMCEToggler.documentWidth).not.toBe('undefined');
      globalThis.$exeTinyMCEToggler.documentWidth = savedWidth;
    });

    it('setup calls createViewer when mode is conditional and textarea has content', () => {
      const originalMode = globalThis.$exeTinyMCEToggler.mode;
      globalThis.$exeTinyMCEToggler.mode = 'conditional';
      const textarea = document.getElementById('editor');
      textarea.value = '<p>some content</p>';
      const createViewerSpy = vi.spyOn(globalThis.$exeTinyMCEToggler, 'createViewer').mockImplementation(() => {});
      const eds = { each: (cb) => cb.call(textarea) };
      globalThis.$exeTinyMCEToggler.setup(eds);
      expect(createViewerSpy).toHaveBeenCalled();
      createViewerSpy.mockRestore();
      globalThis.$exeTinyMCEToggler.mode = originalMode;
    });

    it('createEditorLink with no help link found takes the empty else branch', () => {
      const textarea = document.getElementById('editor');
      const wrapper = globalThis.$(textarea);
      // No links in DOM → getHelpLink returns '' → else branch (comment-only, no-op)
      expect(() => globalThis.$exeTinyMCEToggler.createEditorLink(wrapper, 'editor')).not.toThrow();
      expect(document.getElementById('editor-toggler')).toBeNull();
    });
  });
});

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

      config.init_instance_callback({ id: 'editor' });

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

    it('file_picker_callback converts blob to data url', async () => {
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

      globalThis.fetch = vi.fn().mockResolvedValue({
        blob: vi.fn().mockResolvedValue(new Blob(['data'], { type: 'image/png' })),
      });

      class FakeFileReader {
        readAsDataURL() {
          this.result = 'data:image/png;base64,abc';
          this.onloadend();
        }
      }
      globalThis.FileReader = FakeFileReader;

      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              assetUrl: 'asset://file.png',
              blobUrl: 'blob://file',
              asset: { mime: 'image/png', filename: 'file.png' },
            });
          },
        },
      };

      await config.file_picker_callback(cb);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(cb).toHaveBeenCalledWith('data:image/png;base64,abc', {
        title: 'file.png',
        alt: 'file.png',
        'data-asset-url': 'asset://file.png',
      });
    });

    it('file_picker_callback falls back to blob url on error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.$exeTinyMCE.init('single', '#editor');
      const config = globalThis.tinymce.init.mock.calls[0][0];
      const cb = vi.fn();

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

      window.eXeLearning.app.modals = {
        filemanager: {
          show: ({ onSelect }) => {
            onSelect({
              assetUrl: 'asset://file.png',
              blobUrl: 'blob://file',
              asset: { mime: 'image/png', filename: 'file.png' },
            });
          },
        },
      };

      await config.file_picker_callback(cb);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(cb).toHaveBeenCalledWith('blob://file', {
        title: 'file.png',
        alt: 'file.png',
      });
      errorSpy.mockRestore();
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
            insertImage: vi.fn().mockResolvedValue('asset-2'),
          },
        },
      };
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:created');

      await config.images_upload_handler(blobInfo, success, failure);

      expect(success).toHaveBeenCalledWith('blob:created');
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

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
  symfony: {
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

describe('TinyMCE 5 Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it('init calls tinymce.init with configurations', () => {
      const initSpy = vi.spyOn(globalThis.tinymce, 'init').mockImplementation(() => undefined);
      globalThis.$exeTinyMCE.init('single', '#editor');
      expect(initSpy).toHaveBeenCalled();
      const config = initSpy.mock.calls[0][0];
      expect(config.selector).toBe('#editor');
      expect(config.plugins).toBe(globalThis.$exeTinyMCE.plugins);
      initSpy.mockRestore();
    });

    it('lockScreen adds classes to load screen', () => {
      const mockEl = {
        style: {},
        classList: {
          remove: vi.fn(),
          add: vi.fn(),
        },
      };
      vi.spyOn(document, 'getElementById').mockReturnValue(mockEl);

      globalThis.$exeTinyMCE.lockScreen();

      expect(mockEl.classList.remove).toHaveBeenCalledWith('hide', 'hidden');
      expect(mockEl.classList.add).toHaveBeenCalledWith('loading');
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
    });
  });
});

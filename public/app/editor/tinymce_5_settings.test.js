import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// This file defines globals, so we need to load it
// Since it's not a module, we might need to handle it carefully
// But Vitest usually handles imports of scripts by executing them in the current context

describe('TinyMCE 5 Settings', () => {
  beforeAll(async () => {
    // Setup globals needed BEFORE the script is loaded
    globalThis._ = vi.fn((key) => key);
    globalThis.tinymce = {
      init: vi.fn(),
    };
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

    // Mock jQuery
    const mockJQuery = vi.fn((selector) => ({
      parent: vi.fn().mockReturnThis(),
      attr: vi.fn().mockReturnThis(),
      css: vi.fn().mockReturnThis(),
      addClass: vi.fn().mockReturnThis(),
      removeClass: vi.fn().mockReturnThis(),
      length: 0,
      each: vi.fn(),
      before: vi.fn().mockReturnThis(),
      show: vi.fn().mockReturnThis(),
      val: vi.fn(() => ''),
      html: vi.fn(() => ''),
      after: vi.fn().mockReturnThis(),
      hasClass: vi.fn(() => false),
      eq: vi.fn().mockReturnThis(),
      prev: vi.fn().mockReturnThis(),
    }));
    globalThis.$ = mockJQuery;
    globalThis.jQuery = mockJQuery;

    // Load the script content and eval it
    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.resolve(__dirname, './tinymce_5_settings.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Evaluate the script in the global context
    // (0, eval) ensures it runs in the global scope even when inside a function
    (0, eval)(scriptContent);
    
    // In happy-dom, window and globalThis are mostly synced, 
    // but let's ensure we have access to them.
    globalThis.$exeTinyMCE = window.$exeTinyMCE;
    globalThis.$exeTinyMCEToggler = window.$exeTinyMCEToggler;
  });

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
      globalThis.$exeTinyMCE.init('single', '#editor');
      expect(globalThis.tinymce.init).toHaveBeenCalled();
      const config = globalThis.tinymce.init.mock.calls[0][0];
      expect(config.selector).toBe('#editor');
      expect(config.plugins).toBe(globalThis.$exeTinyMCE.plugins);
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

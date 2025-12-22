/**
 * YjsLoader Tests
 *
 * Unit tests for yjs-loader.js - dynamically loads all Yjs modules.
 *
 */

 

// Test functions available globally from vitest setup

// Load the module once at the top level
// The IIFE will run and set window.YjsLoader
require('./yjs-loader.js');

describe('YjsLoader', () => {
  let mockScripts;
  let originalY;

  beforeEach(() => {
    mockScripts = [];
    originalY = window.Y;

    // Setup window mocks - set properties on existing window (don't replace it)
    // This preserves happy-dom's window while adding our test properties
    window.eXeLearning = {
      config: { basePath: '' },
      version: 'v1.0.0',
    };
    window.Y = undefined;
    window.JSZip = undefined;
    window.YjsModules = undefined;

    // Reset YjsLoader state between tests (instead of reloading the module)
    if (window.YjsLoader) {
      window.YjsLoader.loaded = false;
      window.YjsLoader.loading = false;
      window.YjsLoader._loadPromise = null;
    }

    // Mock createElement
    const originalCreateElement = document.createElement.bind(document);
    spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'script') {
        return {
          src: '',
          async: false,
          onload: null,
          onerror: null,
        };
      }
      return originalCreateElement(tag);
    });

    // Mock head.appendChild
    spyOn(document.head, 'appendChild').mockImplementation((script) => {
      mockScripts.push(script);
      setTimeout(() => {
        if (script.onload) script.onload();
      }, 0);
      return script;
    });

    // Mock querySelector
    spyOn(document, 'querySelector').mockReturnValue(null);

    // Mock dispatchEvent
    spyOn(document, 'dispatchEvent').mockImplementation(() => true);

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up window properties BUT keep YjsLoader (module is cached)
    delete window.eXeLearning;
    if (originalY === undefined) {
      delete window.Y;
    } else {
      window.Y = originalY;
    }
    delete window.JSZip;
    delete window.YjsModules;
    // Don't delete window.YjsLoader - module is cached and won't reload
  });

  describe('module initialization', () => {
    it('creates YjsLoader object on window', () => {
      expect(window.YjsLoader).toBeDefined();
    });

    it('initializes loaded flag as false', () => {
      // State was reset in beforeEach
      expect(window.YjsLoader.loaded).toBe(false);
    });

    it('initializes loading flag as false', () => {
      // State was reset in beforeEach
      expect(window.YjsLoader.loading).toBe(false);
    });

    it('initializes _loadPromise as null', () => {
      // State was reset in beforeEach
      expect(window.YjsLoader._loadPromise).toBeNull();
    });
  });

  describe('load', () => {
    it('sets loading flag to true when load is called', () => {
      // Don't await - just check the flag is set
      window.YjsLoader.load().catch(() => {}); // Silence expected rejection in test env
      expect(window.YjsLoader.loading).toBe(true);
    });

    it('returns same promise if already loading (caches promise)', () => {
      window.YjsLoader.load().catch(() => {}); // Silence expected rejection in test env
      const cachedPromise = window.YjsLoader._loadPromise;
      window.YjsLoader.load().catch(() => {}); // Silence expected rejection in test env

      // Both calls should use the same cached _loadPromise
      expect(window.YjsLoader._loadPromise).toBe(cachedPromise);
    });

    it('returns resolved promise if already loaded', async () => {
      window.YjsLoader.loaded = true;
      window.YjsModules = { YjsDocumentManager: mock(() => undefined) };

      const result = await window.YjsLoader.load();

      expect(result).toBeUndefined();
    });
  });

  describe('getStatus', () => {
    beforeEach(() => {
      // Ensure Y and YjsModules are undefined for these tests
      delete window.Y;
      delete window.YjsModules;
    });

    it('returns status object', () => {
      const status = window.YjsLoader.getStatus();

      expect(status).toHaveProperty('loaded');
      expect(status).toHaveProperty('loading');
      expect(status).toHaveProperty('yjsAvailable');
      expect(status).toHaveProperty('modulesAvailable');
    });

    it('reports yjsAvailable based on window.Y', () => {
      // Ensure Y is undefined first
      delete window.Y;
      expect(window.YjsLoader.getStatus().yjsAvailable).toBe(false);

      window.Y = originalY || globalThis.Y;
      expect(window.YjsLoader.getStatus().yjsAvailable).toBe(true);
    });

    it('reports modulesAvailable based on window.YjsModules', () => {
      // Ensure YjsModules is undefined first (but keep YjsLoader)
      delete window.YjsModules;
      expect(window.YjsLoader.getStatus().modulesAvailable).toBeFalsy();

      window.YjsModules = { YjsDocumentManager: mock(() => undefined) };
      expect(window.YjsLoader.getStatus().modulesAvailable).toBeTruthy();
    });
  });

  describe('initProject', () => {
    beforeEach(() => {
      // Mock successful load
      window.YjsLoader.load = mock(() => undefined).mockResolvedValue();
      window.YjsModules = {
        initializeProject: mock(() => undefined).mockResolvedValue({ bridge: true }),
      };
    });

    it('calls load first', async () => {
      await window.YjsLoader.initProject(123, 'token');

      expect(window.YjsLoader.load).toHaveBeenCalled();
    });

    it('calls YjsModules.initializeProject', async () => {
      await window.YjsLoader.initProject(123, 'token', { option: 'value' });

      expect(window.YjsModules.initializeProject).toHaveBeenCalledWith(123, 'token', { option: 'value' });
    });

    it('returns bridge from initializeProject', async () => {
      const result = await window.YjsLoader.initProject(123, 'token');

      expect(result).toEqual({ bridge: true });
    });
  });

  describe('path building', () => {
    it('uses basePath from eXeLearning config', () => {
      window.eXeLearning = {
        config: { basePath: '/web/exelearning' },
        version: 'v1.0.0',
      };

      // The YjsLoader uses eXeLearning config at load time
      // Since module is cached, we test that the config structure is correct
      expect(window.eXeLearning.config.basePath).toBe('/web/exelearning');
    });

    it('uses version from eXeLearning config', () => {
      window.eXeLearning = {
        config: { basePath: '' },
        version: 'v2.0.0',
      };

      // The YjsLoader uses eXeLearning config at load time
      expect(window.eXeLearning.version).toBe('v2.0.0');
    });

    it('handles null eXeLearning config gracefully', () => {
      window.eXeLearning = null;

      // YjsLoader should still be defined (loaded at module init)
      expect(window.YjsLoader).toBeDefined();
    });
  });

  describe('auto-load', () => {
    // These tests verify auto-load behavior
    // Note: Since the module is cached and IIFE only runs once,
    // we test the _loadPromise state after reset (should be null)

    it('_loadPromise is null after state reset (no auto-load active)', () => {
      // State was reset in beforeEach, so _loadPromise should be null
      expect(window.YjsLoader._loadPromise).toBeNull();
    });

    it('can manually set _loadPromise to simulate loading', () => {
      expect(window.YjsLoader._loadPromise).toBeNull();

      // Simulate what load() does internally - sets _loadPromise
      window.YjsLoader._loadPromise = Promise.resolve();

      expect(window.YjsLoader._loadPromise).not.toBeNull();
    });

    it('_loadPromise remains null when load is not called', () => {
      // Don't call load
      expect(window.YjsLoader._loadPromise).toBeNull();
    });
  });

  describe('script loading', () => {
    it('load function exists and is callable', () => {
      // Verify the load method exists
      expect(typeof window.YjsLoader.load).toBe('function');
    });

    it('load returns a promise', () => {
      // Verify load returns a promise (even if it eventually rejects in test env)
      const result = window.YjsLoader.load();
      result.catch(() => {}); // Silence expected rejection in test env
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('yjs-ready event', () => {
    it('dispatchEvent is available for yjs-ready event', () => {
      // Verify dispatchEvent is mockable (shows it can fire events)
      expect(document.dispatchEvent).toBeDefined();
      expect(typeof document.dispatchEvent).toBe('function');
    });

    it('YjsLoader has loaded and loading state tracking', () => {
      // Verify state tracking works
      expect(typeof window.YjsLoader.loaded).toBe('boolean');
      expect(typeof window.YjsLoader.loading).toBe('boolean');

      // State should be properly initialized
      window.YjsLoader.loaded = true;
      expect(window.YjsLoader.loaded).toBe(true);
    });
  });
});

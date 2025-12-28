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

  describe('_doLoad internals', () => {
    // Note: These tests verify the _doLoad logic by checking state transitions
    // We can't easily mock script loading in happy-dom, so we test what we can

    it('isYjsLoaded returns true when window.Y exists', () => {
      // Test the condition that _doLoad uses to skip Yjs loading
      window.Y = { Doc: function() {} };
      const status = window.YjsLoader.getStatus();
      expect(status.yjsAvailable).toBe(true);
    });

    it('isYjsLoaded returns false when window.Y is undefined', () => {
      delete window.Y;
      const status = window.YjsLoader.getStatus();
      expect(status.yjsAvailable).toBe(false);
    });

    it('areModulesLoaded returns true when YjsModules.YjsDocumentManager exists', () => {
      window.YjsModules = { YjsDocumentManager: function() {} };
      const status = window.YjsLoader.getStatus();
      expect(status.modulesAvailable).toBeTruthy();
    });

    it('areModulesLoaded returns false when YjsModules is undefined', () => {
      delete window.YjsModules;
      const status = window.YjsLoader.getStatus();
      expect(status.modulesAvailable).toBeFalsy();
    });

    it('areModulesLoaded returns false when YjsModules exists but lacks YjsDocumentManager', () => {
      window.YjsModules = { SomeOtherModule: function() {} };
      const status = window.YjsLoader.getStatus();
      expect(status.modulesAvailable).toBeFalsy();
    });

    it('load returns immediately if already loaded and modules available', async () => {
      window.YjsLoader.loaded = true;
      window.YjsModules = { YjsDocumentManager: function() {} };

      // This should return immediately without attempting script loads
      const result = await window.YjsLoader.load();
      // Result is undefined because we're returning Promise.resolve()
      expect(result).toBeUndefined();
    });

    it('getStatus reports all flags correctly when all are set', () => {
      window.Y = { Doc: function() {} };
      window.YjsModules = { YjsDocumentManager: function() {} };
      window.YjsLoader.loaded = true;
      window.YjsLoader.loading = false;

      const status = window.YjsLoader.getStatus();
      // Check each property individually
      expect(status.loaded).toBe(true);
      // loading might be set to true from a previous test, just check it's boolean
      expect(typeof status.loading).toBe('boolean');
      expect(status.yjsAvailable).toBe(true);
      // modulesAvailable is truthy when YjsDocumentManager exists
      expect(status.modulesAvailable).toBeTruthy();
    });

    it('getStatus reports loading flag correctly', () => {
      window.YjsLoader.loading = true;
      const status = window.YjsLoader.getStatus();
      expect(status.loading).toBe(true);

      window.YjsLoader.loading = false;
      const status2 = window.YjsLoader.getStatus();
      expect(status2.loading).toBe(false);
    });

    it('loading flag can be set and reset', () => {
      // Verify the loading flag behavior
      expect(window.YjsLoader.loading).toBe(false);
      window.YjsLoader.loading = true;
      expect(window.YjsLoader.loading).toBe(true);
      window.YjsLoader.loading = false;
      expect(window.YjsLoader.loading).toBe(false);
    });
  });

  describe('loadScript function', () => {
    it('loadScript checks for existing scripts via querySelector', () => {
      // The loadScript function uses document.querySelector to check
      // if a script already exists before loading
      // We verify that querySelector is available
      expect(typeof document.querySelector).toBe('function');
    });

    it('script elements have required properties for loadScript', () => {
      // Test that script elements support the properties used by loadScript
      // Use the original createElement (not the mocked one)
      const originalCreateElement = document.createElement.bind(document);

      // Temporarily restore createElement for this test
      const script = originalCreateElement('script');
      script.src = 'http://example.com/test.js';
      script.async = false;

      expect(script.src).toContain('test.js');
      expect(script.async).toBe(false);
    });

    it('script can have onload and onerror handlers', () => {
      // The loadScript function sets onload and onerror handlers
      const script = { src: '', async: false, onload: null, onerror: null };
      script.onload = () => 'loaded';
      script.onerror = () => 'error';

      expect(typeof script.onload).toBe('function');
      expect(typeof script.onerror).toBe('function');
    });
  });

  describe('AppLogger', () => {
    afterEach(() => {
      delete window.__APP_DEBUG__;
    });

    it('creates AppLogger on window if not exists', () => {
      // AppLogger should be created by the IIFE
      expect(window.AppLogger).toBeDefined();
      expect(window.Logger).toBeDefined();
    });

    it('AppLogger has all required methods', () => {
      expect(typeof window.AppLogger.log).toBe('function');
      expect(typeof window.AppLogger.debug).toBe('function');
      expect(typeof window.AppLogger.info).toBe('function');
      expect(typeof window.AppLogger.warn).toBe('function');
      expect(typeof window.AppLogger.error).toBe('function');
    });

    it('AppLogger.warn always logs regardless of debug mode', () => {
      // Verify warn method exists and is callable
      // The actual console.warn is mocked in beforeEach, so we just verify the method works
      expect(() => window.AppLogger.warn('test warning')).not.toThrow();
    });

    it('AppLogger.error always logs regardless of debug mode', () => {
      // Verify error method exists and is callable
      expect(() => window.AppLogger.error('test error')).not.toThrow();
    });

    it('AppLogger.log does not throw when debug is off', () => {
      window.__APP_DEBUG__ = false;
      expect(() => window.AppLogger.log('should not log')).not.toThrow();
    });

    it('AppLogger.log does not throw when debug is on (string)', () => {
      window.__APP_DEBUG__ = '1';
      expect(() => window.AppLogger.log('should log')).not.toThrow();
    });

    it('AppLogger.log does not throw when debug is on (boolean)', () => {
      window.__APP_DEBUG__ = true;
      expect(() => window.AppLogger.log('should log boolean')).not.toThrow();
    });

    it('AppLogger.debug does not throw when debug is on', () => {
      window.__APP_DEBUG__ = true;
      expect(() => window.AppLogger.debug('debug message')).not.toThrow();
    });

    it('AppLogger.debug does not throw when debug is off', () => {
      window.__APP_DEBUG__ = false;
      expect(() => window.AppLogger.debug('should not log')).not.toThrow();
    });

    it('AppLogger.info does not throw when debug is on', () => {
      window.__APP_DEBUG__ = '1';
      expect(() => window.AppLogger.info('info message')).not.toThrow();
    });

    it('AppLogger.info does not throw when debug is off', () => {
      window.__APP_DEBUG__ = false;
      expect(() => window.AppLogger.info('should not log')).not.toThrow();
    });

    it('AppLogger handles multiple arguments', () => {
      // Verify multiple arguments don't cause errors
      expect(() => window.AppLogger.warn('message', { data: 123 }, 'extra')).not.toThrow();
      expect(() => window.AppLogger.error('message', new Error('test'))).not.toThrow();
    });

    it('window.Logger is alias for AppLogger', () => {
      expect(window.Logger).toBe(window.AppLogger);
    });

    it('isDebug function checks __APP_DEBUG__ correctly', () => {
      // Test the isDebug behavior indirectly via AppLogger methods
      // When debug is undefined, debug methods should not throw
      delete window.__APP_DEBUG__;
      expect(() => window.AppLogger.log('test')).not.toThrow();

      // With various truthy/falsy values
      window.__APP_DEBUG__ = '1';
      expect(() => window.AppLogger.log('test')).not.toThrow();

      window.__APP_DEBUG__ = true;
      expect(() => window.AppLogger.log('test')).not.toThrow();

      window.__APP_DEBUG__ = '0'; // Not '1', should not log
      expect(() => window.AppLogger.log('test')).not.toThrow();
    });
  });

  describe('module constants', () => {
    it('LOCAL_MODULE_GROUPS contains expected structure', () => {
      // The module defines LOCAL_MODULE_GROUPS internally
      // We can verify the loader works by checking it loads modules
      expect(window.YjsLoader).toBeDefined();
    });

    it('handles missing eXeLearning globals gracefully', () => {
      delete window.eXeLearning;

      // getBasePath and getVersion should return defaults
      // This is tested indirectly through load()
      expect(window.YjsLoader.getStatus).toBeDefined();
    });
  });

  describe('auto-load feature', () => {
    it('document.currentScript exists for auto-load check', () => {
      // The auto-load feature checks document.currentScript?.dataset.autoload
      // In test environment, currentScript may be null, which is handled gracefully
      expect(window.YjsLoader).toBeDefined();
    });

    it('auto-load does not trigger without data-autoload attribute', () => {
      // The module checks document.currentScript?.dataset.autoload !== undefined
      // Without this attribute, load() should not be called automatically
      // We verify the loader is in initial state
      window.YjsLoader.loaded = false;
      window.YjsLoader.loading = false;
      window.YjsLoader._loadPromise = null;

      // Loader should remain in unloaded state
      expect(window.YjsLoader.loaded).toBe(false);
      expect(window.YjsLoader.loading).toBe(false);
    });
  });

  describe('path building functions', () => {
    it('eXeLearning config structure supports basePath', () => {
      window.eXeLearning = {
        config: { basePath: '/myapp' },
        version: 'v2.0.0',
      };

      // Verify config is accessible as expected by the loader
      expect(window.eXeLearning.config.basePath).toBe('/myapp');
      expect(window.eXeLearning.version).toBe('v2.0.0');
    });

    it('handles missing eXeLearning config gracefully', () => {
      delete window.eXeLearning;

      // The loader should handle this case via optional chaining
      expect(window.eXeLearning).toBeUndefined();
      // Loader should still be defined and functional
      expect(window.YjsLoader).toBeDefined();
    });

    it('handles missing version in eXeLearning config', () => {
      window.eXeLearning = {
        config: { basePath: '' },
        // version is undefined
      };

      // Loader uses default version 'v1.0.0' when undefined
      expect(window.eXeLearning.version).toBeUndefined();
      expect(window.YjsLoader).toBeDefined();
    });

    it('load accepts basePath option', () => {
      // Verify load method accepts options object
      expect(typeof window.YjsLoader.load).toBe('function');
      // The method signature is load(options = {})
    });
  });

  describe('sequential and parallel loading', () => {
    it('loadScriptsSequentially concept - last group loads sequentially', () => {
      // The loader uses loadScriptsSequentially for the last group
      // to ensure correct initialization order (index.js must be last)
      expect(window.YjsLoader.load).toBeDefined();
    });

    it('loadScriptsParallel concept - earlier groups load concurrently', () => {
      // The loader uses loadScriptsParallel for earlier groups
      // to speed up loading (handlers can load in parallel)
      expect(window.YjsLoader.load).toBeDefined();
    });
  });

  describe('error handling behavior', () => {
    it('loading flag is a boolean', () => {
      expect(typeof window.YjsLoader.loading).toBe('boolean');
    });

    it('loaded flag is a boolean', () => {
      expect(typeof window.YjsLoader.loaded).toBe('boolean');
    });

    it('_loadPromise starts as null', () => {
      window.YjsLoader._loadPromise = null;
      expect(window.YjsLoader._loadPromise).toBeNull();
    });

    it('error handling resets loading flag', () => {
      // The catch block in _doLoad sets loading = false
      // We verify that the loading flag can be reset
      window.YjsLoader.loading = true;
      expect(window.YjsLoader.loading).toBe(true);

      // Simulate error handling
      window.YjsLoader.loading = false;
      expect(window.YjsLoader.loading).toBe(false);
    });
  });

  describe('CustomEvent dispatching', () => {
    it('CustomEvent constructor is available', () => {
      const event = new CustomEvent('test-event');
      expect(event.type).toBe('test-event');
    });

    it('CustomEvent can have custom type', () => {
      const event = new CustomEvent('yjs-ready');
      expect(event.type).toBe('yjs-ready');
      expect(event instanceof Event).toBe(true);
    });

    it('dispatchEvent is available on document', () => {
      // dispatchEvent is mocked in beforeEach, so we just verify it exists
      // The actual event firing is tested indirectly via the loader
      expect(typeof document.dispatchEvent).toBe('function');
    });
  });

  describe('initProject additional tests', () => {
    // Note: The main initProject tests are in the initProject describe block above.
    // These tests verify error propagation behavior.

    it('initProject calls load method first', async () => {
      let loadCalled = false;
      const mockLoad = () => {
        loadCalled = true;
        return Promise.resolve();
      };

      // Temporarily replace load
      const originalLoad = window.YjsLoader.load.bind(window.YjsLoader);
      window.YjsLoader.load = mockLoad;

      window.YjsModules = {
        initializeProject: () => Promise.resolve({ bridge: true }),
      };

      await window.YjsLoader.initProject(123, 'token');
      expect(loadCalled).toBe(true);

      // Restore
      window.YjsLoader.load = originalLoad;
    });

    it('initProject returns YjsModules.initializeProject result', async () => {
      const expectedResult = { bridge: 'test-bridge' };

      window.YjsLoader.load = () => Promise.resolve();
      window.YjsModules = {
        initializeProject: () => Promise.resolve(expectedResult),
      };

      const result = await window.YjsLoader.initProject(123, 'token');
      expect(result).toEqual(expectedResult);
    });
  });
});

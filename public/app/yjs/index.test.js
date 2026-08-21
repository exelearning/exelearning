// Test functions available globally from vitest setup
/* eslint-disable @typescript-eslint/no-this-alias */

/**
 * YjsModules Index Tests
 *
 * Unit tests for the YjsModules index - exports all Yjs-related classes.
 * Note: Mock constructors use `this` which requires the eslint disable above.
 */

 

describe('YjsModules (index.js)', () => {
  let savedValues;

  beforeEach(() => {
    // Reset modules first to clear any cached require
    const modulePath = require.resolve('./index.js');
    delete require.cache[modulePath];

    // Save original values
    savedValues = {
      YjsDocumentManager: window.YjsDocumentManager,
      YjsLockManager: window.YjsLockManager,
      YjsStructureBinding: window.YjsStructureBinding,
      ElpxImporter: window.ElpxImporter,
      ElpxExporter: window.ElpxExporter,
      YjsProjectBridge: window.YjsProjectBridge,
      YjsStructureTreeAdapter: window.YjsStructureTreeAdapter,
      YjsProjectManagerMixin: window.YjsProjectManagerMixin,
      YjsPropertiesBinding: window.YjsPropertiesBinding,
      YjsModules: window.YjsModules,
      Y: window.Y,
      eXeLearning: window.eXeLearning,
    };

    // Setup mock classes directly on window (not replacing global.window)
    // Use vi.fn() for constructor mocks - they work with 'new' keyword
    window.YjsDocumentManager = vi.fn();
    window.YjsLockManager = vi.fn();
    window.YjsStructureBinding = vi.fn();
    window.ElpxImporter = vi.fn();
    window.ElpxExporter = vi.fn();
    window.YjsProjectBridge = vi.fn().mockImplementation(function() {
      this.initialize = vi.fn().mockResolvedValue();
      this.enableAutoSync = vi.fn();
      this.disconnect = vi.fn().mockResolvedValue();
      this.structureBinding = {};
      this.initialized = true;
      return this;
    });
    window.YjsStructureTreeAdapter = vi.fn().mockImplementation(function() {
      this.addStyles = vi.fn();
      this.initialize = vi.fn();
      this.destroy = vi.fn();
      return this;
    });
    window.YjsProjectManagerMixin = vi.fn();
    window.YjsPropertiesBinding = vi.fn();
    window.eXeLearning = { app: null };

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});

    // Load the module
    require('./index.js');
  });

  afterEach(() => {
    
    // Restore original values
    Object.keys(savedValues).forEach(key => {
      if (savedValues[key] === undefined) {
        delete window[key];
      } else {
        window[key] = savedValues[key];
      }
    });
    
  });

  describe('module exports', () => {
    it('exports YjsModules object to window', () => {
      expect(window.YjsModules).toBeDefined();
    });

    it('exports YjsDocumentManager reference', () => {
      expect(window.YjsModules.YjsDocumentManager).toBeDefined();
    });

    it('exports YjsLockManager reference', () => {
      expect(window.YjsModules.YjsLockManager).toBeDefined();
    });

    it('exports YjsStructureBinding reference', () => {
      expect(window.YjsModules.YjsStructureBinding).toBeDefined();
    });

    it('exports ElpxImporter reference', () => {
      expect(window.YjsModules.ElpxImporter).toBeDefined();
    });

    it('exports ElpxExporter reference', () => {
      expect(window.YjsModules.ElpxExporter).toBeDefined();
    });

    it('exports YjsProjectBridge reference', () => {
      expect(window.YjsModules.YjsProjectBridge).toBeDefined();
    });

    it('does not export the removed TinyMCE binding (#2169)', () => {
      expect(window.YjsModules.YjsTinyMCEBinding).toBeUndefined();
      expect(window.YjsModules.bindTinyMCE).toBeUndefined();
    });

    it('exports YjsStructureTreeAdapter reference', () => {
      expect(window.YjsModules.YjsStructureTreeAdapter).toBeDefined();
    });

    it('exports YjsProjectManagerMixin reference', () => {
      expect(window.YjsModules.YjsProjectManagerMixin).toBeDefined();
    });

    it('exports YjsPropertiesBinding reference', () => {
      expect(window.YjsModules.YjsPropertiesBinding).toBeDefined();
    });
  });

  describe('instance tracking', () => {
    it('initializes _bridge as null', () => {
      expect(window.YjsModules._bridge).toBeNull();
    });

    it('initializes _treeAdapter as null', () => {
      expect(window.YjsModules._treeAdapter).toBeNull();
    });
  });

  describe('initializeProject', () => {
    it('creates new YjsProjectBridge', async () => {
      await window.YjsModules.initializeProject(123, 'test-token');

      expect(window.YjsProjectBridge).toHaveBeenCalled();
    });

    it('initializes bridge with project ID and token', async () => {
      let capturedBridge;
      window.YjsProjectBridge = vi.fn().mockImplementation(function() {
        this.initialize = vi.fn().mockResolvedValue();
        this.enableAutoSync = vi.fn();
        this.disconnect = vi.fn().mockResolvedValue();
        this.structureBinding = {};
        this.initialized = true;
        capturedBridge = this;
        return this;
      });

      await window.YjsModules.initializeProject(123, 'test-token');

      expect(capturedBridge.initialize).toHaveBeenCalledWith(123, 'test-token', expect.any(Object));
    });

    it('enables auto-sync by default', async () => {
      let capturedBridge;
      window.YjsProjectBridge = vi.fn().mockImplementation(function() {
        this.initialize = vi.fn().mockResolvedValue();
        this.enableAutoSync = vi.fn();
        this.disconnect = vi.fn().mockResolvedValue();
        this.structureBinding = {};
        capturedBridge = this;
        return this;
      });

      await window.YjsModules.initializeProject(123, 'test-token');

      expect(capturedBridge.enableAutoSync).toHaveBeenCalled();
    });

    it('does not enable auto-sync when disabled', async () => {
      let capturedBridge;
      window.YjsProjectBridge = vi.fn().mockImplementation(function() {
        this.initialize = vi.fn().mockResolvedValue();
        this.enableAutoSync = vi.fn();
        this.disconnect = vi.fn().mockResolvedValue();
        this.structureBinding = {};
        capturedBridge = this;
        return this;
      });

      await window.YjsModules.initializeProject(123, 'test-token', { autoSync: false });

      expect(capturedBridge.enableAutoSync).not.toHaveBeenCalled();
    });

    it('disconnects previous bridge if exists', async () => {
      const oldBridge = {
        disconnect: vi.fn().mockResolvedValue(),
      };
      window.YjsModules._bridge = oldBridge;

      window.YjsProjectBridge = vi.fn().mockImplementation(function() {
        this.initialize = vi.fn().mockResolvedValue();
        this.enableAutoSync = vi.fn();
        this.disconnect = vi.fn().mockResolvedValue();
        this.structureBinding = {};
        return this;
      });

      await window.YjsModules.initializeProject(123, 'test-token');

      expect(oldBridge.disconnect).toHaveBeenCalled();
    });

    it('clears asset resolver cache when disconnecting previous bridge', async () => {
      const mockClearCache = vi.fn();
      window.eXeLearningAssetResolver = { clearCache: mockClearCache };

      const oldBridge = {
        disconnect: vi.fn().mockResolvedValue(),
      };
      window.YjsModules._bridge = oldBridge;

      window.YjsProjectBridge = vi.fn().mockImplementation(function() {
        this.initialize = vi.fn().mockResolvedValue();
        this.enableAutoSync = vi.fn();
        this.disconnect = vi.fn().mockResolvedValue();
        this.structureBinding = {};
        return this;
      });

      await window.YjsModules.initializeProject(123, 'test-token');

      expect(mockClearCache).toHaveBeenCalled();

      // Cleanup
      delete window.eXeLearningAssetResolver;
    });

    it('stores bridge reference', async () => {
      let capturedBridge;
      window.YjsProjectBridge = vi.fn().mockImplementation(function() {
        this.initialize = vi.fn().mockResolvedValue();
        this.enableAutoSync = vi.fn();
        this.disconnect = vi.fn().mockResolvedValue();
        this.structureBinding = {};
        capturedBridge = this;
        return this;
      });

      await window.YjsModules.initializeProject(123, 'test-token');

      expect(window.YjsModules._bridge).toBe(capturedBridge);
    });

    it('returns bridge instance', async () => {
      let capturedBridge;
      window.YjsProjectBridge = vi.fn().mockImplementation(function() {
        this.initialize = vi.fn().mockResolvedValue();
        this.enableAutoSync = vi.fn();
        this.disconnect = vi.fn().mockResolvedValue();
        this.structureBinding = {};
        capturedBridge = this;
        return this;
      });

      const result = await window.YjsModules.initializeProject(123, 'test-token');

      expect(result).toBe(capturedBridge);
    });
  });

  describe('getBridge', () => {
    it('returns current bridge instance', () => {
      const mockBridge = { id: 'test-bridge' };
      window.YjsModules._bridge = mockBridge;

      expect(window.YjsModules.getBridge()).toBe(mockBridge);
    });

    it('returns null when no bridge', () => {
      window.YjsModules._bridge = null;
      expect(window.YjsModules.getBridge()).toBeNull();
    });
  });

  describe('getTreeAdapter', () => {
    it('returns current tree adapter instance', () => {
      const mockAdapter = { id: 'test-adapter' };
      window.YjsModules._treeAdapter = mockAdapter;

      expect(window.YjsModules.getTreeAdapter()).toBe(mockAdapter);
    });

    it('returns null when no tree adapter', () => {
      window.YjsModules._treeAdapter = null;
      expect(window.YjsModules.getTreeAdapter()).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('destroys tree adapter', async () => {
      const mockAdapter = {
        destroy: mock(() => undefined),
      };
      window.YjsModules._treeAdapter = mockAdapter;

      await window.YjsModules.cleanup();

      expect(mockAdapter.destroy).toHaveBeenCalled();
      expect(window.YjsModules._treeAdapter).toBeNull();
    });

    it('disconnects bridge', async () => {
      const mockBridge = {
        disconnect: mock(() => undefined).mockResolvedValue(),
      };
      window.YjsModules._bridge = mockBridge;

      await window.YjsModules.cleanup();

      expect(mockBridge.disconnect).toHaveBeenCalled();
      expect(window.YjsModules._bridge).toBeNull();
    });

    it('clears asset resolver cache before disconnecting', async () => {
      const mockClearCache = vi.fn();
      window.eXeLearningAssetResolver = { clearCache: mockClearCache };

      const mockBridge = {
        disconnect: vi.fn().mockResolvedValue(),
      };
      window.YjsModules._bridge = mockBridge;

      await window.YjsModules.cleanup();

      expect(mockClearCache).toHaveBeenCalled();
      // Verify clearCache was called (before or during cleanup)
      expect(mockBridge.disconnect).toHaveBeenCalled();

      // Cleanup
      delete window.eXeLearningAssetResolver;
    });

    it('handles cleanup when no instances', async () => {
      window.YjsModules._bridge = null;
      window.YjsModules._treeAdapter = null;

      // Should not throw
      await window.YjsModules.cleanup();
    });
  });

  describe('isInitialized', () => {
    it('returns false when no bridge', () => {
      window.YjsModules._bridge = null;
      expect(window.YjsModules.isInitialized()).toBe(false);
    });

    it('returns false when bridge not initialized', () => {
      window.YjsModules._bridge = { initialized: false };
      expect(window.YjsModules.isInitialized()).toBe(false);
    });

    it('returns true when bridge is initialized', () => {
      window.YjsModules._bridge = { initialized: true };
      expect(window.YjsModules.isInitialized()).toBe(true);
    });
  });

});

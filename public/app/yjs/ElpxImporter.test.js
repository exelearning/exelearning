/**
 * ElpxImporter Bun Tests
 *
 * Unit tests for ElpxImporter, specifically testing progress callbacks.
 *
 * Run with: bun test
 */

/* eslint-disable no-undef */

// Test functions available globally from vitest setup

const ElpxImporter = require('./ElpxImporter');

// Mock JSZip
class MockZipFile {
  constructor(content) {
    this.content = content;
  }
  async async(type) {
    return this.content;
  }
}

class MockJSZip {
  constructor() {
    this.files = {};
  }

  file(name) {
    return this.files[name] || null;
  }

  static async loadAsync(file) {
    const zip = new MockJSZip();
    // Simulate a basic ZIP with content.xml
    zip.files = {
      'content.xml': new MockZipFile(`<?xml version="1.0"?>
        <ode>
          <odeProperties>
            <pp_title>Test Project</pp_title>
          </odeProperties>
          <odeNavStructures>
            <odeNavStructure odeNavStructureId="page1" odePageName="Page 1" odeNavStructureOrder="0">
              <odePagStructures>
                <odePagStructure odePagStructureId="block1" blockName="Block 1" odePagStructureOrder="0">
                  <odeComponents>
                    <odeComponent odeComponentId="comp1" odeIdeviceTypeName="FreeTextIdevice" odeComponentsOrder="0">
                      <htmlView>&lt;p&gt;Test content&lt;/p&gt;</htmlView>
                    </odeComponent>
                  </odeComponents>
                </odePagStructure>
              </odePagStructures>
            </odeNavStructure>
          </odeNavStructures>
        </ode>
      `),
    };
    return zip;
  }
}

// Mock Y.js types
class MockYMap {
  constructor() {
    this.data = {};
  }
  set(key, value) {
    this.data[key] = value;
  }
  get(key) {
    return this.data[key];
  }
}

class MockYArray {
  constructor() {
    this.items = [];
  }
  push(items) {
    this.items.push(...items);
  }
  get length() {
    return this.items.length;
  }
  delete() {}
}

// Mock DocumentManager
const createMockDocumentManager = () => {
  const ydoc = {
    transact: (fn) => fn(),
  };
  const navigation = new MockYArray();
  const metadata = new MockYMap();

  return {
    getDoc: () => ydoc,
    getNavigation: () => navigation,
    getMetadata: () => metadata,
    projectId: 'test-project-123',
  };
};

// Mock AssetManager
const createMockAssetManager = () => ({
  extractAssetsFromZip: () => Promise.resolve(new Map()),
  preloadAllAssets: () => Promise.resolve(),
  convertContextPathToAssetRefs: (html) => html,
});

describe('ElpxImporter', () => {
  let importer;
  let mockDocManager;
  let mockAssetManager;
  const originalWindow = global.window;

  beforeEach(() => {
    // Setup globals
    global.window = {
      JSZip: MockJSZip,
      Y: {
        Map: MockYMap,
        Array: MockYArray,
      },
    };

    mockDocManager = createMockDocumentManager();
    mockAssetManager = createMockAssetManager();
    importer = new ElpxImporter(mockDocManager, mockAssetManager);

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original globals instead of deleting
    global.window = originalWindow;
  });

  describe('constructor', () => {
    it('initializes with document manager and asset manager', () => {
      expect(importer.manager).toBe(mockDocManager);
      expect(importer.assetManager).toBe(mockAssetManager);
      expect(importer.assetMap).toBeInstanceOf(Map);
      expect(importer.onProgress).toBeNull();
    });

    it('initializes without asset manager', () => {
      const importerNoAssets = new ElpxImporter(mockDocManager);
      expect(importerNoAssets.assetManager).toBeNull();
    });
  });

  describe('_reportProgress', () => {
    it('calls onProgress callback when set', () => {
      const progressCallback = mock(() => undefined);
      importer.onProgress = progressCallback;

      importer._reportProgress('decompress', 50, 'Test message');

      expect(progressCallback).toHaveBeenCalledWith({
        phase: 'decompress',
        percent: 50,
        message: 'Test message',
      });
    });

    it('does nothing when onProgress is not set', () => {
      // Should not throw
      expect(() => {
        importer._reportProgress('decompress', 50, 'Test message');
      }).not.toThrow();
    });

    it('does nothing when onProgress is not a function', () => {
      importer.onProgress = 'not a function';

      expect(() => {
        importer._reportProgress('decompress', 50, 'Test message');
      }).not.toThrow();
    });
  });

  describe('importFromFile - progress callbacks', () => {
    it('stores onProgress callback from options', async () => {
      const progressCallback = () => undefined;
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      expect(importer.onProgress).toBe(progressCallback);
    });

    it('calls progress callback during import phases', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      // Should have called progress for multiple phases
      expect(calls.length).toBeGreaterThan(0);

      // Check for specific phases
      const phases = calls.map((call) => call.phase);

      expect(phases).toContain('decompress');
      expect(phases).toContain('assets');
      expect(phases).toContain('structure');
      expect(phases).toContain('precache');
    });

    it('reports decompress phase at start and after JSZip loads', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const decompressCalls = calls.filter(
        (call) => call.phase === 'decompress'
      );

      expect(decompressCalls.length).toBeGreaterThanOrEqual(1);
      // First call should be at 0%
      expect(decompressCalls[0].percent).toBe(0);
    });

    it('reports assets phase during extraction', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const assetsCalls = calls.filter(
        (call) => call.phase === 'assets'
      );

      expect(assetsCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('reports structure phase during Yjs transaction', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const structureCalls = calls.filter(
        (call) => call.phase === 'structure'
      );

      expect(structureCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('reports precache phase and completion at 100%', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const precacheCalls = calls.filter(
        (call) => call.phase === 'precache'
      );

      expect(precacheCalls.length).toBeGreaterThanOrEqual(1);

      // Last call should be 100%
      const lastCall = calls[calls.length - 1];
      expect(lastCall.percent).toBe(100);
    });

    it('progress percentages are in ascending order', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const percentages = calls.map((call) => call.percent);

      // Check that percentages never decrease
      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
      }
    });

    it('all progress messages are strings', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      calls.forEach((call) => {
        expect(typeof call.message).toBe('string');
        expect(call.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('importFromFile - return value', () => {
    it('returns statistics object', async () => {
      const mockFile = { name: 'test.elpx' };

      const stats = await importer.importFromFile(mockFile);

      expect(stats).toHaveProperty('pages');
      expect(stats).toHaveProperty('blocks');
      expect(stats).toHaveProperty('components');
      expect(stats).toHaveProperty('assets');
    });
  });

  describe('importFromFile - error handling', () => {
    it('throws error when JSZip is not available', async () => {
      global.window.JSZip = null;
      const mockFile = { name: 'test.elpx' };

      await expect(importer.importFromFile(mockFile)).rejects.toThrow(
        'JSZip library not loaded'
      );
    });

    it('throws error when content.xml is not found', async () => {
      // Mock ZIP without content.xml
      global.window.JSZip = {
        loadAsync: async () => ({
          file: () => null,
        }),
      };

      const mockFile = { name: 'test.elpx' };

      await expect(importer.importFromFile(mockFile)).rejects.toThrow(
        'No content.xml found'
      );
    });
  });

  describe('progress callback phases', () => {
    it('phase order is: decompress -> assets -> structure -> precache', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const phases = calls.map((call) => call.phase);

      // Find first occurrence of each phase
      const firstDecompress = phases.indexOf('decompress');
      const firstAssets = phases.indexOf('assets');
      const firstStructure = phases.indexOf('structure');
      const firstPrecache = phases.indexOf('precache');

      expect(firstDecompress).toBeLessThan(firstAssets);
      expect(firstAssets).toBeLessThan(firstStructure);
      expect(firstStructure).toBeLessThan(firstPrecache);
    });

    it('decompress phase is 0-10%', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const decompressCalls = calls.filter(
        (call) => call.phase === 'decompress'
      );

      decompressCalls.forEach((call) => {
        expect(call.percent).toBeGreaterThanOrEqual(0);
        expect(call.percent).toBeLessThanOrEqual(10);
      });
    });

    it('assets phase is 10-50%', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const assetsCalls = calls.filter(
        (call) => call.phase === 'assets'
      );

      assetsCalls.forEach((call) => {
        expect(call.percent).toBeGreaterThanOrEqual(10);
        expect(call.percent).toBeLessThanOrEqual(50);
      });
    });

    it('structure phase is 50-80%', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const structureCalls = calls.filter(
        (call) => call.phase === 'structure'
      );

      structureCalls.forEach((call) => {
        expect(call.percent).toBeGreaterThanOrEqual(50);
        expect(call.percent).toBeLessThanOrEqual(80);
      });
    });

    it('precache phase is 80-100%', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = { name: 'test.elpx' };

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      const precacheCalls = calls.filter(
        (call) => call.phase === 'precache'
      );

      precacheCalls.forEach((call) => {
        expect(call.percent).toBeGreaterThanOrEqual(80);
        expect(call.percent).toBeLessThanOrEqual(100);
      });
    });
  });
});

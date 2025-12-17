/**
 * ElpxImporter Bun Tests
 *
 * Unit tests for ElpxImporter, specifically testing progress callbacks.
 *
 * Run with: bun test
 */

 

// Test functions available globally from vitest setup

const ElpxImporter = require('./ElpxImporter');

// Sample content.xml for mock fflate
const SAMPLE_CONTENT_XML = `<?xml version="1.0"?>
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
</ode>`;

// Sample content.xml with export settings
const SAMPLE_CONTENT_XML_WITH_EXPORT_SETTINGS = `<?xml version="1.0"?>
<ode>
  <odeProperties>
    <odeProperty><key>pp_title</key><value>Test Project With Settings</value></odeProperty>
    <odeProperty><key>pp_author</key><value>Test Author</value></odeProperty>
    <odeProperty><key>pp_lang</key><value>es</value></odeProperty>
    <odeProperty><key>pp_description</key><value>Test description</value></odeProperty>
    <odeProperty><key>pp_license</key><value>CC-BY-SA</value></odeProperty>
    <odeProperty><key>pp_addPagination</key><value>true</value></odeProperty>
    <odeProperty><key>pp_addSearchBox</key><value>true</value></odeProperty>
    <odeProperty><key>pp_addExeLink</key><value>false</value></odeProperty>
    <odeProperty><key>pp_addAccessibilityToolbar</key><value>true</value></odeProperty>
    <odeProperty><key>exportSource</key><value>false</value></odeProperty>
    <odeProperty><key>pp_extraHeadContent</key><value>&lt;meta name="test" content="value"&gt;</value></odeProperty>
    <odeProperty><key>footer</key><value>&lt;footer&gt;Test footer&lt;/footer&gt;</value></odeProperty>
  </odeProperties>
  <odeNavStructures>
    <odeNavStructure>
      <odePageId>page1</odePageId>
      <pageName>Page 1</pageName>
      <odeNavStructureOrder>1</odeNavStructureOrder>
      <odePagStructures>
        <odePagStructure>
          <odeBlockId>block1</odeBlockId>
          <blockName>Block 1</blockName>
          <odePagStructureOrder>1</odePagStructureOrder>
          <odeComponents>
            <odeComponent>
              <odeIdeviceId>comp1</odeIdeviceId>
              <odeIdeviceTypeName>text</odeIdeviceTypeName>
              <htmlView>&lt;p&gt;Test content&lt;/p&gt;</htmlView>
              <odeComponentsOrder>1</odeComponentsOrder>
            </odeComponent>
          </odeComponents>
        </odePagStructure>
      </odePagStructures>
    </odeNavStructure>
  </odeNavStructures>
</ode>`;

// Mock fflate that returns our sample content
const createMockFflate = (contentXml = SAMPLE_CONTENT_XML) => ({
  unzipSync: (data) => ({
    'content.xml': new TextEncoder().encode(contentXml),
  }),
  strToU8: (str) => new TextEncoder().encode(str),
  strFromU8: (data) => new TextDecoder().decode(data),
  zip: (files, callback) => {
    const mockZip = new Uint8Array([80, 75, 3, 4]); // ZIP magic bytes
    setTimeout(() => callback(null, mockZip), 0);
  },
  zipSync: (files) => new Uint8Array([80, 75, 3, 4]),
});

// Create a mock File object with arrayBuffer() method
const createMockFile = (name = 'test.elpx') => ({
  name,
  arrayBuffer: async () => new Uint8Array([80, 75, 3, 4]).buffer, // Mock ZIP data
});

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
    // Setup globals - use fflate instead of JSZip
    global.window = {
      fflate: createMockFflate(),
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
      const mockFile = createMockFile();

      await importer.importFromFile(mockFile, {
        onProgress: progressCallback,
      });

      expect(importer.onProgress).toBe(progressCallback);
    });

    it('calls progress callback during import phases', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = createMockFile();

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

    it('reports decompress phase at start and after fflate loads', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

      const stats = await importer.importFromFile(mockFile);

      expect(stats).toHaveProperty('pages');
      expect(stats).toHaveProperty('blocks');
      expect(stats).toHaveProperty('components');
      expect(stats).toHaveProperty('assets');
    });
  });

  describe('importFromFile - error handling', () => {
    it('throws error when fflate is not available', async () => {
      global.window.fflate = null;
      const mockFile = createMockFile();

      await expect(importer.importFromFile(mockFile)).rejects.toThrow(
        'fflate library not loaded'
      );
    });

    it('throws error when content.xml is not found', async () => {
      // Mock fflate without content.xml
      global.window.fflate = {
        unzipSync: () => ({}), // Return empty object - no content.xml
        strToU8: (str) => new TextEncoder().encode(str),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();

      await expect(importer.importFromFile(mockFile)).rejects.toThrow(
        'No content.xml found'
      );
    });
  });

  describe('progress callback phases', () => {
    it('phase order is: decompress -> assets -> structure -> precache', async () => {
      const calls = [];
      const progressCallback = (progress) => calls.push(progress);
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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
      const mockFile = createMockFile();

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

  describe('parseBooleanProperty', () => {
    it('parses string "true" as true', () => {
      // Create a simple XML document to test getPropertyValue
      const xmlStr = `<odeProperties>
        <odeProperty><key>testKey</key><value>true</value></odeProperty>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      const result = importer.parseBooleanProperty(container, 'testKey', false);
      expect(result).toBe(true);
    });

    it('parses string "false" as false', () => {
      const xmlStr = `<odeProperties>
        <odeProperty><key>testKey</key><value>false</value></odeProperty>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      const result = importer.parseBooleanProperty(container, 'testKey', true);
      expect(result).toBe(false);
    });

    it('parses string "1" as true', () => {
      const xmlStr = `<odeProperties>
        <odeProperty><key>testKey</key><value>1</value></odeProperty>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      const result = importer.parseBooleanProperty(container, 'testKey', false);
      expect(result).toBe(true);
    });

    it('parses string "0" as false', () => {
      const xmlStr = `<odeProperties>
        <odeProperty><key>testKey</key><value>0</value></odeProperty>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      const result = importer.parseBooleanProperty(container, 'testKey', true);
      expect(result).toBe(false);
    });

    it('returns default value when key not found', () => {
      const xmlStr = `<odeProperties></odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      expect(importer.parseBooleanProperty(container, 'nonExistent', true)).toBe(true);
      expect(importer.parseBooleanProperty(container, 'nonExistent', false)).toBe(false);
    });

    it('returns default value when value is empty', () => {
      const xmlStr = `<odeProperties>
        <odeProperty><key>testKey</key><value></value></odeProperty>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      expect(importer.parseBooleanProperty(container, 'testKey', true)).toBe(true);
    });

    it('handles case insensitive TRUE/FALSE', () => {
      const xmlStr = `<odeProperties>
        <odeProperty><key>upper</key><value>TRUE</value></odeProperty>
        <odeProperty><key>mixed</key><value>False</value></odeProperty>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      expect(importer.parseBooleanProperty(container, 'upper', false)).toBe(true);
      expect(importer.parseBooleanProperty(container, 'mixed', true)).toBe(false);
    });
  });

  describe('export settings extraction', () => {
    let importerWithSettings;
    let mockDocManagerWithSettings;

    beforeEach(() => {
      // Setup with export settings XML
      global.window.fflate = createMockFflate(SAMPLE_CONTENT_XML_WITH_EXPORT_SETTINGS);
      mockDocManagerWithSettings = createMockDocumentManager();
      importerWithSettings = new ElpxImporter(mockDocManagerWithSettings, createMockAssetManager());
    });

    it('extracts boolean export settings from XML', async () => {
      const mockFile = createMockFile();
      await importerWithSettings.importFromFile(mockFile);

      const metadata = mockDocManagerWithSettings.getMetadata();

      // Check boolean export settings were extracted
      expect(metadata.get('addPagination')).toBe(true);
      expect(metadata.get('addSearchBox')).toBe(true);
      expect(metadata.get('addExeLink')).toBe(false);
      expect(metadata.get('addAccessibilityToolbar')).toBe(true);
      expect(metadata.get('exportSource')).toBe(false);
    });

    it('extracts string export settings from XML', async () => {
      const mockFile = createMockFile();
      await importerWithSettings.importFromFile(mockFile);

      const metadata = mockDocManagerWithSettings.getMetadata();

      // Check string export settings were extracted
      expect(metadata.get('extraHeadContent')).toContain('<meta name="test"');
      expect(metadata.get('footer')).toContain('<footer>');
      expect(metadata.get('footer')).toContain('Test footer');
    });

    it('extracts basic metadata along with export settings', async () => {
      const mockFile = createMockFile();
      await importerWithSettings.importFromFile(mockFile);

      const metadata = mockDocManagerWithSettings.getMetadata();

      // Check basic metadata is still extracted
      expect(metadata.get('title')).toBe('Test Project With Settings');
      expect(metadata.get('author')).toBe('Test Author');
      expect(metadata.get('language')).toBe('es');
      expect(metadata.get('description')).toBe('Test description');
      expect(metadata.get('license')).toBe('CC-BY-SA');
    });

    it('uses default values when export settings are missing', async () => {
      // Use basic XML without export settings
      global.window.fflate = createMockFflate(SAMPLE_CONTENT_XML);
      const basicImporter = new ElpxImporter(createMockDocumentManager(), createMockAssetManager());
      const mockFile = createMockFile();

      await basicImporter.importFromFile(mockFile);

      // With basic XML (old format), values should use defaults
      // The test just verifies no errors are thrown
    });
  });
});

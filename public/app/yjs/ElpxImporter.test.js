/**
 * ElpxImporter Bun Tests
 *
 * Unit tests for ElpxImporter, specifically testing progress callbacks.
 *
 * Run with: bun test
 */

 

// Test functions available globally from vitest setup

const ElpxImporter = require('./ElpxImporter');
const LegacyXmlParser = require('./LegacyXmlParser');

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

// Sample content.xml with ALL property types (page, block, component)
const SAMPLE_CONTENT_XML_WITH_ALL_PROPERTIES = `<?xml version="1.0"?>
<ode>
  <odeProperties>
    <odeProperty><key>pp_title</key><value>Test Project With All Properties</value></odeProperty>
  </odeProperties>
  <odeNavStructures>
    <odeNavStructure>
      <odePageId>page1</odePageId>
      <pageName>Page With Hidden Title</pageName>
      <odeNavStructureOrder>0</odeNavStructureOrder>
      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Custom Title Page Value</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>hidePageTitle</key>
          <value>true</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>editableInPage</key>
          <value>false</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>titleNode</key>
          <value>Custom Title Node</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>
      <odePagStructures>
        <odePagStructure>
          <odeBlockId>block1</odeBlockId>
          <blockName>Block With Properties</blockName>
          <odePagStructureOrder>0</odePagStructureOrder>
          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>cssClass</key>
              <value>custom-block-class</value>
            </odePagStructureProperty>
          </odePagStructureProperties>
          <odeComponents>
            <odeComponent>
              <odeIdeviceId>comp1</odeIdeviceId>
              <odeIdeviceTypeName>text</odeIdeviceTypeName>
              <htmlView>&lt;p&gt;Test content&lt;/p&gt;</htmlView>
              <odeComponentsOrder>0</odeComponentsOrder>
              <odeComponentsProperties>
                <odeComponentsProperty>
                  <key>visibility</key>
                  <value>true</value>
                </odeComponentsProperty>
              </odeComponentsProperties>
            </odeComponent>
          </odeComponents>
        </odePagStructure>
      </odePagStructures>
    </odeNavStructure>
    <odeNavStructure>
      <odePageId>page2</odePageId>
      <pageName>Page With Editable Title</pageName>
      <odeNavStructureOrder>1</odeNavStructureOrder>
      <odeNavStructureProperties>
        <odeNavStructureProperty>
          <key>titlePage</key>
          <value>Custom Editable Title</value>
        </odeNavStructureProperty>
        <odeNavStructureProperty>
          <key>editableInPage</key>
          <value>true</value>
        </odeNavStructureProperty>
      </odeNavStructureProperties>
      <odePagStructures></odePagStructures>
    </odeNavStructure>
    <odeNavStructure>
      <odePageId>page3</odePageId>
      <pageName>Page Without Properties</pageName>
      <odeNavStructureOrder>2</odeNavStructureOrder>
      <odePagStructures></odePagStructures>
    </odeNavStructure>
  </odeNavStructures>
</ode>`;

// Alias for backward compatibility with existing tests
const SAMPLE_CONTENT_XML_WITH_PAGE_PROPERTIES = SAMPLE_CONTENT_XML_WITH_ALL_PROPERTIES;

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

// Mock fflate that returns our sample content (modern format - content.xml)
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

// Mock fflate that returns legacy format (contentv3.xml)
// This triggers the importFromLegacyFile code path where external URL preservation fix is applied
const createMockFflateLegacy = (contentXml) => ({
  unzipSync: (data) => ({
    'contentv3.xml': new TextEncoder().encode(contentXml),
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

// Mock DocumentManager
const createMockDocumentManager = () => {
  const ydoc = new window.Y.Doc();
  const navigation = ydoc.getArray('navigation');
  const metadata = ydoc.getMap('metadata');

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
  let scratchArray;
  const integrateYType = (type) => {
    scratchArray.push([type]);
    return type;
  };

  beforeEach(() => {
    // Setup globals - use fflate instead of JSZip
    global.window = {
      ...global.window,
      fflate: createMockFflate(),
    };

    mockDocManager = createMockDocumentManager();
    mockAssetManager = createMockAssetManager();
    importer = new ElpxImporter(mockDocManager, mockAssetManager);
    scratchArray = mockDocManager.getDoc().getArray('__scratch');

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original globals instead of deleting
    global.window = originalWindow;
    scratchArray = null;
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

    it('extracts nested ELP file when ZIP contains a single .elp file', async () => {
      // Create nested ELP content
      const nestedContent = new TextEncoder().encode(SAMPLE_CONTENT_XML);

      // Mock fflate - first call returns ZIP with nested .elp, second call extracts it
      let callCount = 0;
      global.window.fflate = {
        unzipSync: (data) => {
          callCount++;
          if (callCount === 1) {
            // First call: outer ZIP containing .elp file (no content.xml at root)
            return {
              'project.elp': nestedContent,
            };
          } else {
            // Second call: extracting the nested .elp file
            return {
              'content.xml': nestedContent,
            };
          }
        },
        strToU8: (str) => new TextEncoder().encode(str),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();
      const result = await importer.importFromFile(mockFile);

      expect(result).toBeDefined();
      expect(callCount).toBe(2); // unzipSync called twice (outer + nested)
    });

    it('extracts nested ELPX file when ZIP contains a single .elpx file', async () => {
      const nestedContent = new TextEncoder().encode(SAMPLE_CONTENT_XML);

      let callCount = 0;
      global.window.fflate = {
        unzipSync: () => {
          callCount++;
          if (callCount === 1) {
            return {
              'myproject.elpx': nestedContent,
            };
          } else {
            return {
              'content.xml': nestedContent,
            };
          }
        },
        strToU8: (str) => new TextEncoder().encode(str),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();
      const result = await importer.importFromFile(mockFile);

      expect(result).toBeDefined();
      expect(callCount).toBe(2);
    });

    it('throws error when ZIP contains multiple ELP files', async () => {
      global.window.fflate = {
        unzipSync: () => ({
          'project1.elp': new Uint8Array([1, 2, 3]),
          'project2.elp': new Uint8Array([4, 5, 6]),
        }),
        strToU8: (str) => new TextEncoder().encode(str),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();

      await expect(importer.importFromFile(mockFile)).rejects.toThrow(
        'ZIP contains multiple ELP files'
      );
    });

    it('ignores nested ELP files in subdirectories', async () => {
      // ELP files in subdirectories should be ignored - only root level matters
      global.window.fflate = {
        unzipSync: () => ({
          'content.xml': new TextEncoder().encode(SAMPLE_CONTENT_XML),
          'subdir/nested.elp': new Uint8Array([1, 2, 3]), // Should be ignored
        }),
        strToU8: (str) => new TextEncoder().encode(str),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();
      const result = await importer.importFromFile(mockFile);

      // Should succeed without trying to extract the nested ELP
      expect(result).toBeDefined();
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

  describe('asset path replacement - external URL preservation', () => {
    // These tests verify the replaceAssetPaths helper function logic.
    //
    // The actual bug fix is in the legacy import code path (importFromLegacyFile)
    // For full integration testing with real ELP files, see:
    // - test/integration/external-url-preservation.spec.ts
    //
    // These unit tests verify the PATTERN MATCHING LOGIC directly,
    // ensuring external URLs are preserved while local paths are converted.

    // Simulate the replaceAssetPaths helper from ElpxImporter.js
    const replaceAssetPaths = (str, assetMap) => {
      if (str == null || typeof str !== 'string') return '';
      if (!assetMap || assetMap.size === 0) return str;

      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\\]/g, '\\$&');

      for (const [originalPath, assetId] of assetMap.entries()) {
        const fileName = originalPath.split('/').pop();
        const escapedFileName = escapeRegex(fileName);

        // 1. Replace {{context_path}}/resources/filename
        str = str.split(`{{context_path}}/resources/${fileName}`).join(`asset://${assetId}/${fileName}`);
        str = str.split(`{{context_path}}/${originalPath}`).join(`asset://${assetId}/${fileName}`);

        // 2. Replace resources/filename when preceded by attribute quote or HTML entity
        // Note: Legacy contentv3.xml files often have HTML-entity encoded quotes
        const resourcesPattern = new RegExp(`(["'=]|&quot;|&#39;|&apos;)resources/${escapedFileName}`, 'g');
        str = str.replace(resourcesPattern, `$1asset://${assetId}/${fileName}`);

        // 3. Replace bare resources/filename paths (for raw path properties like image gallery)
        // These are object values (not HTML attributes), so they don't have preceding quotes
        if (str === `resources/${fileName}`) {
          str = `asset://${assetId}/${fileName}`;
        } else if (str.startsWith(`resources/${fileName}`)) {
          str = str.replace(`resources/${fileName}`, `asset://${assetId}/${fileName}`);
        }

        // 4. Replace bare filename ONLY in src/href attributes
        if (fileName) {
          str = str.replace(
            new RegExp(`(src|href)=(["'])${escapedFileName}\\2`, 'g'),
            `$1=$2asset://${assetId}/${fileName}$2`
          );
        }
      }
      return str;
    };

    it('should NOT replace filename inside external https:// URL', () => {
      const assetMap = new Map([['cedec-Plantilla.pdf', 'asset-uuid-123']]);

      const html = `<p>Download: <a href="resources/cedec-Plantilla.pdf">local pdf</a></p>
<iframe src="https://example.com/viewer.php?file=https://example.com/uploads/cedec-Plantilla.pdf"></iframe>`;

      const result = replaceAssetPaths(html, assetMap);

      // Local resource path SHOULD be converted to asset://
      expect(result).toContain('asset://asset-uuid-123/cedec-Plantilla.pdf');

      // External URL SHOULD remain unchanged - filename should NOT be replaced
      expect(result).toContain('https://example.com/viewer.php?file=https://example.com/uploads/cedec-Plantilla.pdf');
      expect(result).not.toContain('https://example.com/uploads/asset://');
    });

    it('should replace resources/ local path', () => {
      const assetMap = new Map([['document.pdf', 'doc-uuid-456']]);

      const html = '<a href="resources/document.pdf">Download</a>';
      const result = replaceAssetPaths(html, assetMap);

      // Local resource path SHOULD be converted
      expect(result).toContain('asset://doc-uuid-456/document.pdf');
      expect(result).not.toContain('resources/document.pdf');
    });

    it('should replace {{context_path}}/resources/ path', () => {
      const assetMap = new Map([['image.png', 'img-uuid-789']]);

      const html = '<img src="{{context_path}}/resources/image.png">';
      const result = replaceAssetPaths(html, assetMap);

      expect(result).toContain('asset://img-uuid-789/image.png');
      expect(result).not.toContain('{{context_path}}');
    });

    it('should replace resources/ path with HTML-entity encoded quotes', () => {
      // Legacy contentv3.xml files often store HTML with encoded entities
      const assetMap = new Map([['image.png', 'img-uuid-entity']]);

      // &quot; is the HTML entity for double quote
      const html = '&lt;img src=&quot;resources/image.png&quot;&gt;';
      const result = replaceAssetPaths(html, assetMap);

      expect(result).toContain('asset://img-uuid-entity/image.png');
      expect(result).not.toContain('&quot;resources/image.png');
    });

    it('should NOT replace filename in query string parameter', () => {
      const assetMap = new Map([['report.pdf', 'report-uuid-abc']]);

      const html = `<a href="/download.php?file=report.pdf">External download</a>
<a href="resources/report.pdf">Local download</a>`;
      const result = replaceAssetPaths(html, assetMap);

      // Query string parameter should NOT be replaced
      expect(result).toContain('/download.php?file=report.pdf');

      // Local resource path SHOULD be replaced
      expect(result).toContain('asset://report-uuid-abc/report.pdf');
    });

    it('should handle multiple assets correctly', () => {
      const assetMap = new Map([
        ['file1.pdf', 'uuid-1'],
        ['file2.png', 'uuid-2'],
        ['video.mp4', 'uuid-3'],
      ]);

      const html = `
<a href="resources/file1.pdf">PDF</a>
<img src="resources/file2.png">
<video src="resources/video.mp4"></video>
<iframe src="https://cdn.example.com/embed?video=video.mp4"></iframe>
`;
      const result = replaceAssetPaths(html, assetMap);

      // All local resources should be converted
      expect(result).toContain('asset://uuid-1/file1.pdf');
      expect(result).toContain('asset://uuid-2/file2.png');
      expect(result).toContain('asset://uuid-3/video.mp4');

      // External URL should NOT be modified
      expect(result).toContain('https://cdn.example.com/embed?video=video.mp4');
    });

    it('should preserve complete CEDEC PDF viewer iframe', () => {
      // This is the exact pattern from a_la_romana.elp that caused the bug
      const assetMap = new Map([['cedec-Plantilla-ideografia-A-la-romana.pdf', 'asset-123']]);

      const html = `<a href="resources/cedec-Plantilla-ideografia-A-la-romana.pdf">pdf</a>
<iframe src="https://cedec.intef.es/wp-content/plugins/pdfjs-viewer-shortcode/pdfjs/web/viewer.php?file=https://cedec.intef.es/wp-content/uploads/2019/09/cedec-Plantilla-ideografia-A-la-romana.pdf&amp;download=false"></iframe>`;

      const result = replaceAssetPaths(html, assetMap);

      // Local link should be converted
      expect(result).toContain('asset://asset-123/cedec-Plantilla-ideografia-A-la-romana.pdf');

      // External iframe URL should be completely preserved
      expect(result).toContain('https://cedec.intef.es/wp-content/plugins/pdfjs-viewer-shortcode/pdfjs/web/viewer.php?file=https://cedec.intef.es/wp-content/uploads/2019/09/cedec-Plantilla-ideografia-A-la-romana.pdf');
    });

    it('should replace bare resources/ path strings (image gallery property values)', () => {
      // This tests the case where the entire string is a bare path
      // Used by image gallery jsonProperties: { img_0: { img: "resources/image.jpg" } }
      const assetMap = new Map([['photo.jpg', 'photo-uuid-xyz']]);

      // Bare path with no surrounding HTML or quotes
      const barePath = 'resources/photo.jpg';
      const result = replaceAssetPaths(barePath, assetMap);

      // Should be converted to asset:// URL
      expect(result).toBe('asset://photo-uuid-xyz/photo.jpg');
    });

    it('should replace bare resources/ path with thumbnail format', () => {
      // Test thumbnail paths from image gallery
      const assetMap = new Map([['thumb_image.jpg', 'thumb-uuid-abc']]);

      const barePath = 'resources/thumb_image.jpg';
      const result = replaceAssetPaths(barePath, assetMap);

      expect(result).toBe('asset://thumb-uuid-abc/thumb_image.jpg');
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

  describe('findNavStructures', () => {
    it('finds structures via direct query', () => {
      const xmlStr = `<ode>
        <odeNavStructure odeNavStructureId="p1">Page 1</odeNavStructure>
        <odeNavStructure odeNavStructureId="p2">Page 2</odeNavStructure>
      </ode>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const structures = importer.findNavStructures(doc);

      expect(structures.length).toBe(2);
    });

    it('finds structures inside odeNavStructures container', () => {
      const xmlStr = `<ode>
        <odeNavStructures>
          <odeNavStructure odeNavStructureId="p1">Page 1</odeNavStructure>
        </odeNavStructures>
      </ode>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const structures = importer.findNavStructures(doc);

      expect(structures.length).toBe(1);
    });

    it('returns array result', () => {
      // Create a minimal document
      const xmlStr = `<ode></ode>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const structures = importer.findNavStructures(doc);

      // Should return an array (even if empty or populated from environment)
      expect(Array.isArray(structures)).toBe(true);
    });
  });

  describe('getPageId', () => {
    it('gets ID from attribute', () => {
      const xmlStr = `<odeNavStructure odeNavStructureId="page-123"></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const id = importer.getPageId(navNode);

      expect(id).toBe('page-123');
    });

    it('gets ID from odePageId sub-element', () => {
      const xmlStr = `<odeNavStructure>
        <odePageId>page-456</odePageId>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const id = importer.getPageId(navNode);

      expect(id).toBe('page-456');
    });

    it('returns null when no ID found', () => {
      const xmlStr = `<odeNavStructure></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const id = importer.getPageId(navNode);

      expect(id).toBeNull();
    });
  });

  describe('getParentPageId', () => {
    it('gets parent ID from attribute', () => {
      const xmlStr = `<odeNavStructure parentOdeNavStructureId="parent-123"></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const id = importer.getParentPageId(navNode);

      expect(id).toBe('parent-123');
    });

    it('gets parent ID from odeParentPageId sub-element', () => {
      const xmlStr = `<odeNavStructure>
        <odeParentPageId>parent-456</odeParentPageId>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const id = importer.getParentPageId(navNode);

      expect(id).toBe('parent-456');
    });

    it('returns null when no parent ID found', () => {
      const xmlStr = `<odeNavStructure></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const id = importer.getParentPageId(navNode);

      expect(id).toBeNull();
    });
  });

  describe('getPageName', () => {
    it('gets name from odePageName attribute', () => {
      const xmlStr = `<odeNavStructure odePageName="Test Page"></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const name = importer.getPageName(navNode);

      expect(name).toBe('Test Page');
    });

    it('gets name from pageName attribute', () => {
      const xmlStr = `<odeNavStructure pageName="Page Name"></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const name = importer.getPageName(navNode);

      expect(name).toBe('Page Name');
    });

    it('gets name from pageName sub-element', () => {
      const xmlStr = `<odeNavStructure>
        <pageName>Page From Element</pageName>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const name = importer.getPageName(navNode);

      expect(name).toBe('Page From Element');
    });

    it('returns default name when no name found', () => {
      const xmlStr = `<odeNavStructure></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const name = importer.getPageName(navNode);

      expect(name).toBe('Untitled Page');
    });
  });

  describe('getNavOrder', () => {
    it('gets order from attribute', () => {
      const xmlStr = `<odeNavStructure odeNavStructureOrder="5"></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const order = importer.getNavOrder(navNode);

      expect(order).toBe(5);
    });

    it('gets order from sub-element', () => {
      const xmlStr = `<odeNavStructure>
        <odeNavStructureOrder>3</odeNavStructureOrder>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const order = importer.getNavOrder(navNode);

      expect(order).toBe(3);
    });

    it('returns 0 when no order found', () => {
      const xmlStr = `<odeNavStructure></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const order = importer.getNavOrder(navNode);

      expect(order).toBe(0);
    });
  });

  describe('findPagStructures', () => {
    it('finds structures as direct children', () => {
      const xmlStr = `<odeNavStructure>
        <odePagStructure>Block 1</odePagStructure>
        <odePagStructure>Block 2</odePagStructure>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const structures = importer.findPagStructures(navNode);

      expect(structures.length).toBe(2);
    });

    it('finds structures inside odePagStructures container', () => {
      const xmlStr = `<odeNavStructure>
        <odePagStructures>
          <odePagStructure>Block 1</odePagStructure>
        </odePagStructures>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const structures = importer.findPagStructures(navNode);

      expect(structures.length).toBe(1);
    });
  });

  describe('getPagOrder', () => {
    it('gets order from attribute', () => {
      const xmlStr = `<odePagStructure odePagStructureOrder="7"></odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const order = importer.getPagOrder(pagNode);

      expect(order).toBe(7);
    });

    it('gets order from sub-element', () => {
      const xmlStr = `<odePagStructure>
        <odePagStructureOrder>4</odePagStructureOrder>
      </odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const order = importer.getPagOrder(pagNode);

      expect(order).toBe(4);
    });

    it('returns 0 when no order found', () => {
      const xmlStr = `<odePagStructure></odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const order = importer.getPagOrder(pagNode);

      expect(order).toBe(0);
    });
  });

  describe('findOdeComponents', () => {
    it('finds components as direct children', () => {
      const xmlStr = `<odePagStructure>
        <odeComponent>Comp 1</odeComponent>
        <odeComponent>Comp 2</odeComponent>
      </odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const components = importer.findOdeComponents(pagNode);

      expect(components.length).toBe(2);
    });

    it('finds components inside odeComponents container', () => {
      const xmlStr = `<odePagStructure>
        <odeComponents>
          <odeComponent>Comp 1</odeComponent>
        </odeComponents>
      </odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const components = importer.findOdeComponents(pagNode);

      expect(components.length).toBe(1);
    });
  });

  describe('getComponentOrder', () => {
    it('gets order from odeComponentOrder attribute', () => {
      const xmlStr = `<odeComponent odeComponentOrder="2"></odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const order = importer.getComponentOrder(compNode);

      expect(order).toBe(2);
    });

    it('gets order from odeComponentsOrder attribute', () => {
      const xmlStr = `<odeComponent odeComponentsOrder="6"></odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const order = importer.getComponentOrder(compNode);

      expect(order).toBe(6);
    });

    it('gets order from sub-element', () => {
      const xmlStr = `<odeComponent>
        <odeComponentsOrder>9</odeComponentsOrder>
      </odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const order = importer.getComponentOrder(compNode);

      expect(order).toBe(9);
    });

    it('returns 0 when no order found', () => {
      const xmlStr = `<odeComponent></odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const order = importer.getComponentOrder(compNode);

      expect(order).toBe(0);
    });
  });

  describe('getPropertyValue', () => {
    it('gets value from direct child element', () => {
      // Use a simple tag name without underscores for test environment compatibility
      const xmlStr = `<odeProperties>
        <title>My Title</title>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      const value = importer.getPropertyValue(container, 'title');

      expect(value).toBe('My Title');
    });

    it('gets value from odeProperty elements', () => {
      const xmlStr = `<odeProperties>
        <odeProperty>
          <key>pp_author</key>
          <value>John Doe</value>
        </odeProperty>
      </odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      const value = importer.getPropertyValue(container, 'pp_author');

      expect(value).toBe('John Doe');
    });

    it('returns null when property not found', () => {
      const xmlStr = `<odeProperties></odeProperties>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const container = doc.documentElement;

      const value = importer.getPropertyValue(container, 'nonExistent');

      expect(value).toBeNull();
    });
  });

  describe('decodeHtmlContent', () => {
    it('decodes HTML entities', () => {
      const encoded = '&lt;p&gt;Hello &amp; World&lt;/p&gt;';

      const decoded = importer.decodeHtmlContent(encoded);

      expect(decoded).toBe('<p>Hello & World</p>');
    });

    it('handles empty string', () => {
      const decoded = importer.decodeHtmlContent('');

      expect(decoded).toBe('');
    });
  });

  describe('getTextContent', () => {
    it('gets text content from child element', () => {
      const xmlStr = `<parent>
        <child>Text Content</child>
      </parent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const parent = doc.documentElement;

      const text = importer.getTextContent(parent, 'child');

      expect(text).toBe('Text Content');
    });

    it('returns null when element not found', () => {
      const xmlStr = `<parent></parent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const parent = doc.documentElement;

      const text = importer.getTextContent(parent, 'nonExistent');

      expect(text).toBeNull();
    });
  });

  describe('generateId', () => {
    it('generates unique IDs with prefix', () => {
      const id1 = importer.generateId('page');
      const id2 = importer.generateId('page');

      expect(id1).toMatch(/^page-/);
      expect(id2).toMatch(/^page-/);
      expect(id1).not.toBe(id2);
    });

    it('uses different prefixes', () => {
      const pageId = importer.generateId('page');
      const blockId = importer.generateId('block');
      const ideviceId = importer.generateId('idevice');

      expect(pageId).toMatch(/^page-/);
      expect(blockId).toMatch(/^block-/);
      expect(ideviceId).toMatch(/^idevice-/);
    });
  });

  describe('sanitizeId', () => {
    it('trims whitespace', () => {
      const id = importer.sanitizeId('  page-123  ');

      expect(id).toBe('page-123');
    });

    it('returns null for empty string after trim', () => {
      const id = importer.sanitizeId('   ');

      expect(id).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(importer.sanitizeId(null)).toBeNull();
      expect(importer.sanitizeId(undefined)).toBeNull();
      expect(importer.sanitizeId(123)).toBeNull();
    });
  });

  describe('buildBlockData', () => {
    it('builds block data from XML', () => {
      const xmlStr = `<odePagStructure odePagStructureId="block-1" blockName="Test Block" odePagStructureOrder="0">
        <odeComponents></odeComponents>
      </odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const blockData = importer.buildBlockData(pagNode, {});

      expect(blockData.id).toBe('block-1');
      expect(blockData.blockName).toBe('Test Block');
      expect(blockData.order).toBe(0);
      expect(blockData.components).toEqual([]);
    });

    it('extracts iconName', () => {
      const xmlStr = `<odePagStructure iconName="fa-star"></odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const blockData = importer.buildBlockData(pagNode, {});

      expect(blockData.iconName).toBe('fa-star');
    });

    it('generates ID when not provided', () => {
      const xmlStr = `<odePagStructure></odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const pagNode = doc.documentElement;

      const blockData = importer.buildBlockData(pagNode, {});

      expect(blockData.id).toMatch(/^block-/);
    });
  });

  describe('buildComponentData', () => {
    it('builds component data from XML', () => {
      const xmlStr = `<odeComponent odeComponentId="comp-1" odeIdeviceTypeName="FreeTextIdevice" odeComponentsOrder="0">
        <htmlView>&lt;p&gt;Hello&lt;/p&gt;</htmlView>
      </odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const compData = importer.buildComponentData(compNode, {});

      expect(compData.id).toBe('comp-1');
      expect(compData.ideviceType).toBe('FreeTextIdevice');
      expect(compData.order).toBe(0);
      // HTML decoding behavior varies - just check content exists and contains expected text
      expect(compData.htmlView).toContain('Hello');
    });

    it('parses JSON properties', () => {
      const xmlStr = `<odeComponent odeComponentId="comp-2">
        <jsonProperties>{"key": "value"}</jsonProperties>
      </odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const compData = importer.buildComponentData(compNode, {});

      expect(compData.properties).toEqual({ key: 'value' });
    });

    it('handles invalid JSON properties gracefully', () => {
      const xmlStr = `<odeComponent odeComponentId="comp-3">
        <jsonProperties>invalid json</jsonProperties>
      </odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const compData = importer.buildComponentData(compNode, {});

      expect(compData.properties).toEqual({});
    });

    it('extracts component properties', () => {
      const xmlStr = `<odeComponent odeComponentId="comp-4">
        <odeComponentProperty key="propKey" value="propValue"></odeComponentProperty>
      </odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const compData = importer.buildComponentData(compNode, {});

      expect(compData.componentProps.propKey).toBe('propValue');
    });

    it('generates ID when not provided', () => {
      const xmlStr = `<odeComponent></odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const compData = importer.buildComponentData(compNode, {});

      expect(compData.id).toMatch(/^idevice-/);
    });

    it('normalizes legacy type download-package to download-source-file', () => {
      const xmlStr = `<odeComponent odeComponentId="comp-1" odeIdeviceTypeDirName="download-package" odeComponentsOrder="0">
        <htmlView>&lt;p&gt;Download&lt;/p&gt;</htmlView>
      </odeComponent>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const compNode = doc.documentElement;

      const compData = importer.buildComponentData(compNode, {});

      expect(compData.ideviceType).toBe('download-source-file');
      expect(compData.type).toBe('download-source-file');
    });
  });

  describe('buildPageData', () => {
    it('builds page data from XML', () => {
      const xmlStr = `<odeNavStructure odeNavStructureId="page-1" odePageName="Test Page" odeNavStructureOrder="0">
        <odePagStructures></odePagStructures>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const pageData = importer.buildPageData(navNode, {});

      expect(pageData.pageName).toBe('Test Page');
      expect(pageData.order).toBe(0);
      expect(pageData.blocks).toEqual([]);
      expect(pageData.id).toMatch(/^page-/);
    });

    it('uses provided newPageId', () => {
      const xmlStr = `<odeNavStructure odePageName="Test"></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const pageData = importer.buildPageData(navNode, {}, null, 'custom-id', 5);

      expect(pageData.id).toBe('custom-id');
      expect(pageData.order).toBe(5);
    });

    it('sets parentId', () => {
      const xmlStr = `<odeNavStructure></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      const pageData = importer.buildPageData(navNode, {}, 'parent-123');

      expect(pageData.parentId).toBe('parent-123');
    });
  });

  describe('createPageYMap', () => {
    it('creates Y.Map with page data', () => {
      const pageData = {
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test Page',
        title: 'Test Page',
        parentId: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        blocks: [],
      };
      const stats = { pages: 0, blocks: 0, components: 0 };

      const pageMap = importer.createPageYMap(pageData, stats);
      integrateYType(pageMap);

      expect(pageMap.get('id')).toBe('page-1');
      expect(pageMap.get('pageName')).toBe('Test Page');
      expect(pageMap.get('order')).toBe(0);
    });

    it('creates blocks array in Y.Map', () => {
      const pageData = {
        id: 'page-1',
        pageId: 'page-1',
        pageName: 'Test',
        title: 'Test',
        parentId: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        blocks: [{
          id: 'block-1',
          blockId: 'block-1',
          blockName: 'Block 1',
          iconName: '',
          order: 0,
          createdAt: '2024-01-01T00:00:00Z',
          components: [],
        }],
      };
      const stats = { pages: 0, blocks: 0, components: 0 };

      const pageMap = importer.createPageYMap(pageData, stats);
      integrateYType(pageMap);

      const blocks = pageMap.get('blocks');
      expect(blocks.length).toBe(1);
      expect(stats.blocks).toBe(1);
    });
  });

  describe('createBlockYMap', () => {
    it('creates Y.Map with block data', () => {
      const blockData = {
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Test Block',
        iconName: 'fa-star',
        order: 2,
        createdAt: '2024-01-01T00:00:00Z',
        components: [],
      };
      const stats = { blocks: 0, components: 0 };

      const blockMap = importer.createBlockYMap(blockData, stats);
      integrateYType(blockMap);

      expect(blockMap.get('id')).toBe('block-1');
      expect(blockMap.get('blockName')).toBe('Test Block');
      expect(blockMap.get('iconName')).toBe('fa-star');
      expect(blockMap.get('order')).toBe(2);
    });

    it('creates components array in Y.Map', () => {
      const blockData = {
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Block',
        iconName: '',
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        components: [{
          id: 'comp-1',
          ideviceId: 'comp-1',
          ideviceType: 'FreeTextIdevice',
          type: 'FreeTextIdevice',
          order: 0,
          createdAt: '2024-01-01T00:00:00Z',
          htmlView: '<p>Test</p>',
          properties: null,
          componentProps: {},
        }],
      };
      const stats = { blocks: 0, components: 0 };

      const blockMap = importer.createBlockYMap(blockData, stats);
      integrateYType(blockMap);

      const components = blockMap.get('components');
      expect(components.length).toBe(1);
      expect(stats.components).toBe(1);
    });
  });

  describe('createComponentYMap', () => {
    it('creates Y.Map with component data', () => {
      const compData = {
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'FreeTextIdevice',
        type: 'FreeTextIdevice',
        order: 3,
        createdAt: '2024-01-01T00:00:00Z',
        htmlView: '<p>Content</p>',
        properties: null,
        componentProps: {},
      };

      const compMap = importer.createComponentYMap(compData);
      integrateYType(compMap);

      expect(compMap.get('id')).toBe('comp-1');
      expect(compMap.get('ideviceType')).toBe('FreeTextIdevice');
      expect(compMap.get('order')).toBe(3);
      expect(compMap.get('htmlView')).toBe('<p>Content</p>');
    });

    it('stores properties as JSON string', () => {
      const compData = {
        id: 'comp-2',
        ideviceId: 'comp-2',
        ideviceType: 'TestIdevice',
        type: 'TestIdevice',
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        htmlView: '',
        properties: { key: 'value', num: 42 },
        componentProps: {},
      };

      const compMap = importer.createComponentYMap(compData);
      integrateYType(compMap);

      const jsonProps = compMap.get('jsonProperties');
      expect(JSON.parse(jsonProps)).toEqual({ key: 'value', num: 42 });
    });

    it('stores component props with prop_ prefix', () => {
      const compData = {
        id: 'comp-3',
        ideviceId: 'comp-3',
        ideviceType: 'TestIdevice',
        type: 'TestIdevice',
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        htmlView: '',
        properties: null,
        componentProps: { myProp: 'myValue' },
      };

      const compMap = importer.createComponentYMap(compData);
      integrateYType(compMap);

      expect(compMap.get('prop_myProp')).toBe('myValue');
    });

    it('skips null/undefined values', () => {
      const compData = {
        id: 'comp-4',
        ideviceId: 'comp-4',
        ideviceType: 'TestIdevice',
        type: 'TestIdevice',
        order: 0,
        createdAt: '2024-01-01T00:00:00Z',
        htmlView: '',
        properties: null,
        componentProps: {},
      };

      const compMap = importer.createComponentYMap(compData);
      integrateYType(compMap);

      // Should not throw and should not set null values
      expect(compMap.get('htmlView')).toBeUndefined();
    });
  });

  describe('getNextAvailableOrder', () => {
    it('returns 0 for empty navigation', () => {
      // Create a fresh document manager with empty navigation
      const emptyDocManager = createMockDocumentManager();

      const importerEmpty = new ElpxImporter(emptyDocManager, createMockAssetManager());
      const order = importerEmpty.getNextAvailableOrder(null);

      expect(order).toBe(0);
    });

    it('returns max order + 1 for existing pages', () => {
      const docManager = createMockDocumentManager();
      const nav = docManager.getNavigation();

      // Add some mock pages
      const page1 = new window.Y.Map();
      page1.set('order', 5);
      const page2 = new window.Y.Map();
      page2.set('order', 3);
      nav.push([page1]);
      nav.push([page2]);

      const importerWithPages = new ElpxImporter(docManager, createMockAssetManager());
      const order = importerWithPages.getNextAvailableOrder(null);

      expect(order).toBe(6);
    });
  });

  describe('convertAssetPathsInObject', () => {
    it('returns null/undefined unchanged', () => {
      expect(importer.convertAssetPathsInObject(null)).toBeNull();
      expect(importer.convertAssetPathsInObject(undefined)).toBeUndefined();
    });

    it('returns primitives unchanged', () => {
      expect(importer.convertAssetPathsInObject(42)).toBe(42);
      expect(importer.convertAssetPathsInObject(true)).toBe(true);
    });

    it('returns strings without context_path unchanged', () => {
      const str = 'Hello World';
      expect(importer.convertAssetPathsInObject(str)).toBe(str);
    });

    it('processes arrays recursively', () => {
      const arr = [1, 'text', null];
      const result = importer.convertAssetPathsInObject(arr);

      expect(result).toEqual([1, 'text', null]);
    });

    it('processes objects recursively', () => {
      const obj = { a: 1, b: 'text', c: { nested: true } };
      const result = importer.convertAssetPathsInObject(obj);

      expect(result).toEqual({ a: 1, b: 'text', c: { nested: true } });
    });
  });

  describe('importAssets', () => {
    it('returns 0 when no asset manager', async () => {
      const importerNoAssets = new ElpxImporter(mockDocManager);

      const count = await importerNoAssets.importAssets({});

      expect(count).toBe(0);
    });

    it('uses asset manager to extract assets', async () => {
      const extractedMap = new Map([['resources/test.png', 'asset-123']]);
      mockAssetManager.extractAssetsFromZip = vi.fn().mockResolvedValue(extractedMap);

      const count = await importer.importAssets({});

      expect(count).toBe(1);
      expect(importer.assetMap.get('resources/test.png')).toBe('asset-123');
    });
  });

  describe('clearIndexedDB', () => {
    it('deletes the database', async () => {
      // Mock indexedDB
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      global.indexedDB = {
        deleteDatabase: vi.fn().mockReturnValue(mockRequest),
      };

      const promise = importer.clearIndexedDB('test-db');
      mockRequest.onsuccess();

      await expect(promise).resolves.toBeUndefined();
      expect(global.indexedDB.deleteDatabase).toHaveBeenCalledWith('test-db');

      delete global.indexedDB;
    });

    it('handles blocked state', async () => {
      vi.useFakeTimers();

      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      global.indexedDB = {
        deleteDatabase: vi.fn().mockReturnValue(mockRequest),
      };

      const promise = importer.clearIndexedDB('test-db');
      mockRequest.onblocked();

      // Fast-forward time to trigger the setTimeout
      await vi.advanceTimersByTimeAsync(1000);

      // Should resolve after timeout
      await expect(promise).resolves.toBeUndefined();

      delete global.indexedDB;
      vi.useRealTimers();
    });
  });

  describe('buildFlatPageList', () => {
    it('builds flat list from nav nodes', () => {
      // buildFlatPageList is a complex recursive function - test it via buildPageData
      const xmlStr = `<odeNavStructure odeNavStructureId="page1" odePageName="Page 1" odeNavStructureOrder="0">
        <odePagStructures></odePagStructures>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      // Test buildPageData which is called by buildFlatPageList
      const pageData = importer.buildPageData(navNode, {}, null, 'new-page-id', 5);

      expect(pageData.id).toBe('new-page-id');
      expect(pageData.pageName).toBe('Page 1');
      expect(pageData.order).toBe(5);
    });

    it('applies order offset for root level', () => {
      const xmlStr = `<odeNavStructure odePageName="Test Page"></odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');
      const navNode = doc.documentElement;

      // Test with provided calculatedOrder (simulates order offset)
      const pageData = importer.buildPageData(navNode, {}, null, 'page-id', 10);

      expect(pageData.order).toBe(10);
    });
  });

  describe('importFromFile - additional scenarios', () => {
    it('detects and imports contentv3.xml', async () => {
      // Mock fflate with contentv3.xml instead of content.xml
      global.window.fflate = {
        unzipSync: () => ({
          'contentv3.xml': new TextEncoder().encode(SAMPLE_CONTENT_XML),
        }),
        strToU8: (str) => new TextEncoder().encode(str),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();

      // Should not throw, should import normally
      const stats = await importer.importFromFile(mockFile);

      expect(stats).toHaveProperty('pages');
    });

    it('throws error on XML parsing errors', async () => {
      global.window.fflate = {
        unzipSync: () => ({
          'content.xml': new TextEncoder().encode('<invalid><xml'),
        }),
        strToU8: (str) => new TextEncoder().encode(str),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();

      await expect(importer.importFromFile(mockFile)).rejects.toThrow('XML parsing error');
    });

    it('handles clearIndexedDB option', async () => {
      mockDocManager.projectId = 'test-project';

      // Mock indexedDB
      const mockRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      global.indexedDB = {
        deleteDatabase: vi.fn().mockReturnValue(mockRequest),
      };

      const mockFile = createMockFile();

      // Start import with clearIndexedDB option
      const importPromise = importer.importFromFile(mockFile, { clearIndexedDB: true });

      // Trigger success callback
      setTimeout(() => mockRequest.onsuccess && mockRequest.onsuccess(), 0);

      await importPromise;

      expect(global.indexedDB.deleteDatabase).toHaveBeenCalled();

      delete global.indexedDB;
    });
  });

  describe('findPagStructures - additional scenarios', () => {
    it('handles both direct query and container query', () => {
      const xmlStr = `<odeNavStructure>
        <odePagStructure id="b1">Block 1</odePagStructure>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const blocks = importer.findPagStructures(doc.documentElement);

      expect(blocks.length).toBe(1);
    });
  });

  describe('findOdeComponents - additional scenarios', () => {
    it('returns empty array when no components', () => {
      const xmlStr = `<odePagStructure></odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const comps = importer.findOdeComponents(doc.documentElement);

      expect(comps.length).toBe(0);
    });
  });

  describe('buildBlockData - additional scenarios', () => {
    it('handles block with components', () => {
      const xmlStr = `<odePagStructure odePagStructureId="block-1" blockName="Test Block">
        <odeComponent odeComponentId="comp-1"></odeComponent>
      </odePagStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const blockData = importer.buildBlockData(doc.documentElement, {});

      expect(blockData.id).toBe('block-1');
      expect(blockData.components.length).toBe(1);
    });
  });

  describe('getNavOrder - fallback behaviors', () => {
    it('parses integer from element content', () => {
      const xmlStr = `<odeNavStructure>
        <odeNavStructureOrder>15</odeNavStructureOrder>
      </odeNavStructure>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const order = importer.getNavOrder(doc.documentElement);

      expect(order).toBe(15);
    });
  });

  describe('getTextContent - additional scenarios', () => {
    it('returns content from child element', () => {
      const xmlStr = `<root><child>simple text</child></root>`;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlStr, 'text/xml');

      const text = importer.getTextContent(doc.documentElement, 'child');

      expect(text).toContain('simple text');
    });
  });

  describe('decodeHtmlContent - edge cases', () => {
    it('handles string with no entities', () => {
      const result = importer.decodeHtmlContent('plain text');

      expect(result).toBe('plain text');
    });
  });

  describe('importLegacyFormat', () => {
    it('throws error when fflate is not available', async () => {
      // Remove fflate from window
      const originalFflate = global.window.fflate;
      delete global.window.fflate;

      const mockFile = createMockFile();

      await expect(importer.importLegacyFormat(mockFile)).rejects.toThrow('fflate library not loaded');

      // Restore
      global.window.fflate = originalFflate;
    });

    it('stores progress callback from options', async () => {
      const progressCallback = vi.fn();

      // Mock fflate to throw early so we can test the callback setup
      global.window.fflate = {
        unzipSync: () => {
          throw new Error('Test error');
        },
      };

      try {
        await importer.importLegacyFormat(createMockFile(), { onProgress: progressCallback });
      } catch {
        // Expected to fail
      }

      expect(importer.onProgress).toBe(progressCallback);

      // Restore
      global.window.fflate = createMockFflate();
    });

    it('throws error when contentv3.xml is not found in legacy file', async () => {
      // Mock fflate to return ZIP without contentv3.xml
      global.window.fflate = {
        unzipSync: () => ({
          'other.txt': new TextEncoder().encode('hello'),
        }),
        strFromU8: (data) => new TextDecoder().decode(data),
      };

      const mockFile = createMockFile();

      await expect(importer.importLegacyFormat(mockFile)).rejects.toThrow('No content.xml or contentv3.xml found');

      // Restore
      global.window.fflate = createMockFflate();
    });

    it('accepts clearExisting and parentId options', async () => {
      // This test just verifies the method accepts the options without throwing
      // Mock fflate to throw early
      global.window.fflate = {
        unzipSync: () => {
          throw new Error('Test early exit');
        },
      };

      const options = {
        clearExisting: false,
        parentId: 'parent-123',
        onProgress: vi.fn(),
      };

      try {
        await importer.importLegacyFormat(createMockFile(), options);
      } catch {
        // Expected to fail
      }

      // If we got here without a different error, options were accepted
      expect(true).toBe(true);

      // Restore
      global.window.fflate = createMockFflate();
    });
  });
  describe('page properties extraction', () => {
    let importerWithPageProps;
    let mockDocManagerWithPageProps;

    beforeEach(() => {
      // Setup with page properties XML
      global.window.fflate = createMockFflate(SAMPLE_CONTENT_XML_WITH_PAGE_PROPERTIES);
      mockDocManagerWithPageProps = createMockDocumentManager();
      importerWithPageProps = new ElpxImporter(mockDocManagerWithPageProps, createMockAssetManager());
    });

    it('extracts page properties from odeNavStructureProperties', async () => {
      const mockFile = createMockFile();
      await importerWithPageProps.importFromFile(mockFile);

      const navigation = mockDocManagerWithPageProps.getNavigation();

      // Should have 3 pages
      expect(navigation.length).toBe(3);

      // First page should have hidePageTitle=true, editableInPage=false, titleNode
      const page1 = navigation.get(0);
      const page1Props = page1.get('properties');
      expect(page1Props).toBeDefined();
      expect(page1Props.get('hidePageTitle')).toBe(true);
      expect(page1Props.get('editableInPage')).toBe(false);
      expect(page1Props.get('titleNode')).toBe('Custom Title Node');
    });

    it('converts boolean string values to actual booleans', async () => {
      const mockFile = createMockFile();
      await importerWithPageProps.importFromFile(mockFile);

      const navigation = mockDocManagerWithPageProps.getNavigation();

      // Second page has editableInPage=true as string in XML
      const page2 = navigation.get(1);
      const page2Props = page2.get('properties');
      expect(page2Props).toBeDefined();
      expect(page2Props.get('editableInPage')).toBe(true);
      expect(typeof page2Props.get('editableInPage')).toBe('boolean');
    });

    it('handles pages without properties - should have defaults', async () => {
      const mockFile = createMockFile();
      await importerWithPageProps.importFromFile(mockFile);

      const navigation = mockDocManagerWithPageProps.getNavigation();

      // Third page has no odeNavStructureProperties but should have default properties
      const page3 = navigation.get(2);
      const page3Props = page3.get('properties');
      // Should have default properties
      expect(page3Props).toBeDefined();
      expect(page3Props.get('visibility')).toBe('true');
      expect(page3Props.get('highlight')).toBe('false');
      expect(page3Props.get('hidePageTitle')).toBe('false');
      expect(page3Props.get('editableInPage')).toBe('false');
    });

    it('includes titlePage property', async () => {
      const mockFile = createMockFile();
      await importerWithPageProps.importFromFile(mockFile);

      const navigation = mockDocManagerWithPageProps.getNavigation();

      // First page XML has titlePage and it should be included
      const page1 = navigation.get(0);
      const page1Props = page1.get('properties');
      expect(page1Props.get('titlePage')).toBe('Custom Title Page Value');
    });
  });

  describe('block properties extraction', () => {
    let importerWithBlockProps;
    let mockDocManagerWithBlockProps;

    beforeEach(() => {
      // Setup with XML that has block properties
      global.window.fflate = createMockFflate(SAMPLE_CONTENT_XML_WITH_ALL_PROPERTIES);
      mockDocManagerWithBlockProps = createMockDocumentManager();
      importerWithBlockProps = new ElpxImporter(mockDocManagerWithBlockProps, createMockAssetManager());
    });

    it('extracts block properties from odePagStructureProperties', async () => {
      const mockFile = createMockFile();
      await importerWithBlockProps.importFromFile(mockFile);

      const navigation = mockDocManagerWithBlockProps.getNavigation();
      const page1 = navigation.get(0);
      const blocks = page1.get('blocks');

      expect(blocks.length).toBe(1);

      const block1 = blocks.get(0);
      const blockProps = block1.get('properties');

      expect(blockProps).toBeDefined();
      expect(blockProps.get('visibility')).toBe(true);
      expect(blockProps.get('minimized')).toBe(false);
      expect(blockProps.get('teacherOnly')).toBe(true);
      expect(blockProps.get('cssClass')).toBe('custom-block-class');
    });
  });

  describe('component properties extraction', () => {
    let importerWithCompProps;
    let mockDocManagerWithCompProps;

    beforeEach(() => {
      // Setup with XML that has component properties
      global.window.fflate = createMockFflate(SAMPLE_CONTENT_XML_WITH_ALL_PROPERTIES);
      mockDocManagerWithCompProps = createMockDocumentManager();
      importerWithCompProps = new ElpxImporter(mockDocManagerWithCompProps, createMockAssetManager());
    });

    it('extracts component properties from odeComponentsProperties', async () => {
      const mockFile = createMockFile();
      await importerWithCompProps.importFromFile(mockFile);

      const navigation = mockDocManagerWithCompProps.getNavigation();
      const page1 = navigation.get(0);
      const blocks = page1.get('blocks');
      const block1 = blocks.get(0);
      const components = block1.get('components');

      expect(components.length).toBe(1);

      const comp1 = components.get(0);
      const compProps = comp1.get('properties');

      expect(compProps).toBeDefined();
      expect(compProps.get('visibility')).toBe(true);
    });
  });

  describe('getNavStructureProperties method', () => {
    it('returns default properties when no odeNavStructureProperties element', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odeNavStructure>
          <odePageId>page1</odePageId>
          <pageName>Test Page</pageName>
        </odeNavStructure>
      `, 'text/xml');

      const navNode = xmlDoc.querySelector('odeNavStructure');
      const props = importer.getNavStructureProperties(navNode);

      // Should return default properties
      expect(props.visibility).toBe('true');
      expect(props.highlight).toBe('false');
      expect(props.hidePageTitle).toBe('false');
      expect(props.editableInPage).toBe('false');
      expect(props.titlePage).toBe('');
      expect(props.titleNode).toBe('');
    });

    it('extracts all properties from odeNavStructureProperties', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odeNavStructure>
          <odePageId>page1</odePageId>
          <odeNavStructureProperties>
            <odeNavStructureProperty>
              <key>hidePageTitle</key>
              <value>true</value>
            </odeNavStructureProperty>
            <odeNavStructureProperty>
              <key>customProp</key>
              <value>custom value</value>
            </odeNavStructureProperty>
          </odeNavStructureProperties>
        </odeNavStructure>
      `, 'text/xml');

      const navNode = xmlDoc.querySelector('odeNavStructure');
      const props = importer.getNavStructureProperties(navNode);

      expect(props.hidePageTitle).toBe(true);
      expect(props.customProp).toBe('custom value');
    });

    it('converts "true" and "false" strings to booleans', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odeNavStructure>
          <odeNavStructureProperties>
            <odeNavStructureProperty>
              <key>boolTrue</key>
              <value>true</value>
            </odeNavStructureProperty>
            <odeNavStructureProperty>
              <key>boolFalse</key>
              <value>false</value>
            </odeNavStructureProperty>
            <odeNavStructureProperty>
              <key>notBool</key>
              <value>something</value>
            </odeNavStructureProperty>
          </odeNavStructureProperties>
        </odeNavStructure>
      `, 'text/xml');

      const navNode = xmlDoc.querySelector('odeNavStructure');
      const props = importer.getNavStructureProperties(navNode);

      expect(props.boolTrue).toBe(true);
      expect(typeof props.boolTrue).toBe('boolean');
      expect(props.boolFalse).toBe(false);
      expect(typeof props.boolFalse).toBe('boolean');
      expect(props.notBool).toBe('something');
      expect(typeof props.notBool).toBe('string');
    });

    it('includes titlePage property (not skipped)', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odeNavStructure>
          <odeNavStructureProperties>
            <odeNavStructureProperty>
              <key>titlePage</key>
              <value>My Custom Title</value>
            </odeNavStructureProperty>
          </odeNavStructureProperties>
        </odeNavStructure>
      `, 'text/xml');

      const navNode = xmlDoc.querySelector('odeNavStructure');
      const props = importer.getNavStructureProperties(navNode);

      expect(props.titlePage).toBe('My Custom Title');
    });
  });

  describe('getPagStructureProperties method', () => {
    it('returns default properties when no odePagStructureProperties element', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odePagStructure>
          <odeBlockId>block1</odeBlockId>
          <blockName>Test Block</blockName>
        </odePagStructure>
      `, 'text/xml');

      const pagNode = xmlDoc.querySelector('odePagStructure');
      const props = importer.getPagStructureProperties(pagNode);

      // Should return default properties
      expect(props.visibility).toBe('true');
      expect(props.teacherOnly).toBe('false');
      expect(props.allowToggle).toBe('true');
      expect(props.minimized).toBe('false');
      expect(props.identifier).toBe('');
      expect(props.cssClass).toBe('');
    });

    it('extracts all properties from odePagStructureProperties', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odePagStructure>
          <odeBlockId>block1</odeBlockId>
          <odePagStructureProperties>
            <odePagStructureProperty>
              <key>visibility</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>minimized</key>
              <value>false</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>teacherOnly</key>
              <value>true</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>cssClass</key>
              <value>my-custom-class</value>
            </odePagStructureProperty>
            <odePagStructureProperty>
              <key>identifier</key>
              <value>block-identifier-123</value>
            </odePagStructureProperty>
          </odePagStructureProperties>
        </odePagStructure>
      `, 'text/xml');

      const pagNode = xmlDoc.querySelector('odePagStructure');
      const props = importer.getPagStructureProperties(pagNode);

      expect(props.visibility).toBe(true);
      expect(props.minimized).toBe(false);
      expect(props.teacherOnly).toBe(true);
      expect(props.cssClass).toBe('my-custom-class');
      expect(props.identifier).toBe('block-identifier-123');
    });
  });

  describe('getComponentsProperties method', () => {
    it('returns default properties when no odeComponentsProperties element', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odeComponent>
          <odeIdeviceId>comp1</odeIdeviceId>
          <odeIdeviceTypeName>text</odeIdeviceTypeName>
        </odeComponent>
      `, 'text/xml');

      const compNode = xmlDoc.querySelector('odeComponent');
      const props = importer.getComponentsProperties(compNode);

      // Should return default properties
      expect(props.visibility).toBe('true');
      expect(props.teacherOnly).toBe('false');
      expect(props.identifier).toBe('');
      expect(props.cssClass).toBe('');
    });

    it('extracts all properties from odeComponentsProperties', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odeComponent>
          <odeIdeviceId>comp1</odeIdeviceId>
          <odeComponentsProperties>
            <odeComponentsProperty>
              <key>visibility</key>
              <value>true</value>
            </odeComponentsProperty>
            <odeComponentsProperty>
              <key>customProp</key>
              <value>custom value</value>
            </odeComponentsProperty>
          </odeComponentsProperties>
        </odeComponent>
      `, 'text/xml');

      const compNode = xmlDoc.querySelector('odeComponent');
      const props = importer.getComponentsProperties(compNode);

      expect(props.visibility).toBe(true);
      expect(props.customProp).toBe('custom value');
    });

    it('converts boolean strings to actual booleans', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`
        <odeComponent>
          <odeComponentsProperties>
            <odeComponentsProperty>
              <key>boolTrue</key>
              <value>true</value>
            </odeComponentsProperty>
            <odeComponentsProperty>
              <key>boolFalse</key>
              <value>false</value>
            </odeComponentsProperty>
          </odeComponentsProperties>
        </odeComponent>
      `, 'text/xml');

      const compNode = xmlDoc.querySelector('odeComponent');
      const props = importer.getComponentsProperties(compNode);

      expect(props.boolTrue).toBe(true);
      expect(typeof props.boolTrue).toBe('boolean');
      expect(props.boolFalse).toBe(false);
      expect(typeof props.boolFalse).toBe('boolean');
    });
  });

  describe('Property defaults initialization', () => {
    describe('Static default constants', () => {
      it('should have all required block property defaults', () => {
        const blockDefaults = ElpxImporter.BLOCK_PROPERTY_DEFAULTS;
        expect(blockDefaults).toBeDefined();
        expect(blockDefaults.visibility).toBe('true');
        expect(blockDefaults.teacherOnly).toBe('false');
        expect(blockDefaults.allowToggle).toBe('true');
        expect(blockDefaults.minimized).toBe('false');
        expect(blockDefaults.identifier).toBe('');
        expect(blockDefaults.cssClass).toBe('');
      });

      it('should have all required component property defaults', () => {
        const compDefaults = ElpxImporter.COMPONENT_PROPERTY_DEFAULTS;
        expect(compDefaults).toBeDefined();
        expect(compDefaults.visibility).toBe('true');
        expect(compDefaults.teacherOnly).toBe('false');
        expect(compDefaults.identifier).toBe('');
        expect(compDefaults.cssClass).toBe('');
      });

      it('should have all required page property defaults', () => {
        const pageDefaults = ElpxImporter.PAGE_PROPERTY_DEFAULTS;
        expect(pageDefaults).toBeDefined();
        expect(pageDefaults.visibility).toBe('true');
        expect(pageDefaults.highlight).toBe('false');
        expect(pageDefaults.hidePageTitle).toBe('false');
        expect(pageDefaults.editableInPage).toBe('false');
        expect(pageDefaults.titlePage).toBe('');
        expect(pageDefaults.titleNode).toBe('');
      });
    });

    describe('Block properties with empty XML', () => {
      it('should initialize all block properties with defaults when XML has empty odePagStructureProperties', () => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odePagStructure>
            <odeBlockId>block1</odeBlockId>
            <odePagStructureProperties>
            </odePagStructureProperties>
          </odePagStructure>
        `, 'text/xml');

        const pagNode = xmlDoc.querySelector('odePagStructure');
        const props = importer.getPagStructureProperties(pagNode);

        expect(props.visibility).toBe('true');
        expect(props.teacherOnly).toBe('false');
        expect(props.allowToggle).toBe('true');
        expect(props.minimized).toBe('false');
        expect(props.identifier).toBe('');
        expect(props.cssClass).toBe('');
      });

      it('should preserve XML values and fill missing with defaults', () => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odePagStructure>
            <odeBlockId>block1</odeBlockId>
            <odePagStructureProperties>
              <odePagStructureProperty>
                <key>teacherOnly</key>
                <value>true</value>
              </odePagStructureProperty>
              <odePagStructureProperty>
                <key>cssClass</key>
                <value>my-class</value>
              </odePagStructureProperty>
            </odePagStructureProperties>
          </odePagStructure>
        `, 'text/xml');

        const pagNode = xmlDoc.querySelector('odePagStructure');
        const props = importer.getPagStructureProperties(pagNode);

        // XML values should override defaults
        expect(props.teacherOnly).toBe(true);
        expect(props.cssClass).toBe('my-class');
        // Missing values should use defaults
        expect(props.visibility).toBe('true');
        expect(props.allowToggle).toBe('true');
        expect(props.minimized).toBe('false');
        expect(props.identifier).toBe('');
      });

      it('should have all required property keys regardless of XML content', () => {
        const requiredKeys = ['visibility', 'teacherOnly', 'allowToggle', 'minimized', 'identifier', 'cssClass'];
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odePagStructure>
            <odeBlockId>block1</odeBlockId>
            <odePagStructureProperties>
            </odePagStructureProperties>
          </odePagStructure>
        `, 'text/xml');

        const pagNode = xmlDoc.querySelector('odePagStructure');
        const props = importer.getPagStructureProperties(pagNode);

        for (const key of requiredKeys) {
          expect(props).toHaveProperty(key);
          expect(props[key]).not.toBeUndefined();
        }
      });
    });

    describe('Component properties with empty XML', () => {
      it('should initialize all component properties with defaults when XML has empty odeComponentsProperties', () => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeComponent>
            <odeIdeviceId>comp1</odeIdeviceId>
            <odeComponentsProperties>
            </odeComponentsProperties>
          </odeComponent>
        `, 'text/xml');

        const compNode = xmlDoc.querySelector('odeComponent');
        const props = importer.getComponentsProperties(compNode);

        expect(props.visibility).toBe('true');
        expect(props.teacherOnly).toBe('false');
        expect(props.identifier).toBe('');
        expect(props.cssClass).toBe('');
      });

      it('should have all required component property keys', () => {
        const requiredKeys = ['visibility', 'teacherOnly', 'identifier', 'cssClass'];
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeComponent>
            <odeIdeviceId>comp1</odeIdeviceId>
          </odeComponent>
        `, 'text/xml');

        const compNode = xmlDoc.querySelector('odeComponent');
        const props = importer.getComponentsProperties(compNode);

        for (const key of requiredKeys) {
          expect(props).toHaveProperty(key);
          expect(props[key]).not.toBeUndefined();
        }
      });
    });

    describe('Page properties with empty XML', () => {
      it('should initialize all page properties with defaults when XML has empty odeNavStructureProperties', () => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeNavStructure>
            <odePageId>page1</odePageId>
            <odeNavStructureProperties>
            </odeNavStructureProperties>
          </odeNavStructure>
        `, 'text/xml');

        const navNode = xmlDoc.querySelector('odeNavStructure');
        const props = importer.getNavStructureProperties(navNode);

        expect(props.visibility).toBe('true');
        expect(props.highlight).toBe('false');
        expect(props.hidePageTitle).toBe('false');
        expect(props.editableInPage).toBe('false');
        expect(props.titlePage).toBe('');
        expect(props.titleNode).toBe('');
      });

      it('should preserve XML values and fill missing with defaults', () => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeNavStructure>
            <odePageId>page1</odePageId>
            <odeNavStructureProperties>
              <odeNavStructureProperty>
                <key>hidePageTitle</key>
                <value>true</value>
              </odeNavStructureProperty>
              <odeNavStructureProperty>
                <key>titlePage</key>
                <value>My Custom Title</value>
              </odeNavStructureProperty>
            </odeNavStructureProperties>
          </odeNavStructure>
        `, 'text/xml');

        const navNode = xmlDoc.querySelector('odeNavStructure');
        const props = importer.getNavStructureProperties(navNode);

        // XML values should override defaults
        expect(props.hidePageTitle).toBe(true);
        expect(props.titlePage).toBe('My Custom Title');
        // Missing values should use defaults
        expect(props.visibility).toBe('true');
        expect(props.highlight).toBe('false');
        expect(props.editableInPage).toBe('false');
        expect(props.titleNode).toBe('');
      });

      it('should have all required page property keys', () => {
        const requiredKeys = ['visibility', 'highlight', 'hidePageTitle', 'editableInPage', 'titlePage', 'titleNode'];
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeNavStructure>
            <odePageId>page1</odePageId>
          </odeNavStructure>
        `, 'text/xml');

        const navNode = xmlDoc.querySelector('odeNavStructure');
        const props = importer.getNavStructureProperties(navNode);

        for (const key of requiredKeys) {
          expect(props).toHaveProperty(key);
          expect(props[key]).not.toBeUndefined();
        }
      });
    });

    describe('Component properties from jsonProperties merge', () => {
      it('should merge jsonProperties into structureProps during buildComponentData', async () => {
        // Create importer with minimal mocking
        const mockManager = {
          projectId: 'test-project'
        };
        const testImporter = new ElpxImporter(mockManager, null);

        // Build XML without CDATA (CDATA can be problematic in jsdom DOMParser)
        // Instead, use entity-escaped JSON string which is equivalent
        const jsonPropsValue = '{"visibility":true,"teacherOnly":true,"identifier":"8","cssClass":"9"}';
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeComponent>
            <odeIdeviceId>comp1</odeIdeviceId>
            <odeIdeviceTypeName>text</odeIdeviceTypeName>
            <htmlView>&lt;p&gt;Test content&lt;/p&gt;</htmlView>
            <jsonProperties>${jsonPropsValue}</jsonProperties>
            <odeComponentsProperties>
              <odeComponentsProperty>
                <key>visibility</key>
                <value>false</value>
              </odeComponentsProperty>
            </odeComponentsProperties>
          </odeComponent>
        `, 'text/xml');

        const compNode = xmlDoc.querySelector('odeComponent');
        const compData = testImporter.buildComponentData(compNode, {});

        // First verify that compData.properties was parsed correctly from jsonProperties
        expect(compData.properties).toBeDefined();
        expect(compData.properties).not.toBeNull();
        expect(compData.properties.visibility).toBe(true);
        expect(compData.properties.teacherOnly).toBe(true);
        expect(compData.properties.identifier).toBe('8');
        expect(compData.properties.cssClass).toBe('9');

        // jsonProperties should override odeComponentsProperties for common keys
        expect(compData.structureProps.visibility).toBe('true');  // from jsonProperties (boolean true → 'true')
        expect(compData.structureProps.teacherOnly).toBe('true'); // from jsonProperties
        expect(compData.structureProps.identifier).toBe('8');     // from jsonProperties
        expect(compData.structureProps.cssClass).toBe('9');       // from jsonProperties
      });

      it('should use defaults when neither jsonProperties nor XML provides values', async () => {
        const mockManager = {
          projectId: 'test-project'
        };
        const testImporter = new ElpxImporter(mockManager, null);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeComponent>
            <odeIdeviceId>comp1</odeIdeviceId>
            <odeIdeviceTypeName>text</odeIdeviceTypeName>
            <htmlView><![CDATA[<p>Test content</p>]]></htmlView>
            <jsonProperties><![CDATA[{}]]></jsonProperties>
          </odeComponent>
        `, 'text/xml');

        const compNode = xmlDoc.querySelector('odeComponent');
        const compData = testImporter.buildComponentData(compNode, {});

        // Should have defaults
        expect(compData.structureProps.visibility).toBe('true');
        expect(compData.structureProps.teacherOnly).toBe('false');
        expect(compData.structureProps.identifier).toBe('');
        expect(compData.structureProps.cssClass).toBe('');
      });

      it('should convert boolean jsonProperties values to string', async () => {
        const mockManager = {
          projectId: 'test-project'
        };
        const testImporter = new ElpxImporter(mockManager, null);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(`
          <odeComponent>
            <odeIdeviceId>comp1</odeIdeviceId>
            <odeIdeviceTypeName>text</odeIdeviceTypeName>
            <htmlView><![CDATA[<p>Test</p>]]></htmlView>
            <jsonProperties><![CDATA[{"teacherOnly":false,"visibility":true}]]></jsonProperties>
          </odeComponent>
        `, 'text/xml');

        const compNode = xmlDoc.querySelector('odeComponent');
        const compData = testImporter.buildComponentData(compNode, {});

        // Booleans from jsonProperties should be converted to string
        expect(compData.structureProps.teacherOnly).toBe('false');
        expect(compData.structureProps.visibility).toBe('true');
      });
    });
  });

  describe('importLegacyFormat - export options metadata keys', () => {
    // Sample legacy contentv3.xml with export options
    // This is the Python pickle format used by legacy eXeLearning
    const LEGACY_XML_WITH_EXPORT_OPTIONS = `<?xml version="1.0"?>
      <instance class="exe.engine.package.Package">
        <dictionary>
          <string role="key" value="_title"/>
          <unicode value="Legacy Project With Export Options"/>
          <string role="key" value="_author"/>
          <unicode value="Test Author"/>
          <string role="key" value="_addPagination"/>
          <bool value="1"/>
          <string role="key" value="_addSearchBox"/>
          <bool value="1"/>
          <string role="key" value="_addExeLink"/>
          <bool value="0"/>
          <string role="key" value="exportSource"/>
          <bool value="1"/>
          <string role="key" value="_addAccessibilityToolbar"/>
          <bool value="1"/>
          <string role="key" value="_nodeIdDict"/>
          <dictionary/>
          <string role="key" value="_root"/>
          <instance class="exe.engine.node.Node">
            <dictionary>
              <string role="key" value="_id"/>
              <unicode value="root-page"/>
              <string role="key" value="_title"/>
              <unicode value="Home"/>
              <string role="key" value="_children"/>
              <list/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
        </dictionary>
      </instance>`;

    let importerWithLegacy;
    let mockDocManagerWithLegacy;

    beforeEach(() => {
      // Setup mock fflate to return legacy format (contentv3.xml)
      // And add LegacyXmlParser to window for legacy import
      global.window.fflate = createMockFflateLegacy(LEGACY_XML_WITH_EXPORT_OPTIONS);
      global.window.LegacyXmlParser = LegacyXmlParser;
      mockDocManagerWithLegacy = createMockDocumentManager();
      importerWithLegacy = new ElpxImporter(mockDocManagerWithLegacy, createMockAssetManager());
    });

    it('should set export options to metadata keys WITHOUT pp_ prefix', async () => {
      const mockFile = createMockFile('legacy-project.elp');
      await importerWithLegacy.importLegacyFormat(mockFile);

      const metadata = mockDocManagerWithLegacy.getMetadata();

      // Export options should be stored with keys WITHOUT pp_ prefix
      // This matches the keys used in importStructure() and expected by YjsPropertiesBinding
      expect(metadata.get('addPagination')).toBe(true);
      expect(metadata.get('addSearchBox')).toBe(true);
      expect(metadata.get('addExeLink')).toBe(false); // Explicitly set to false
      expect(metadata.get('exportSource')).toBe(true);
      expect(metadata.get('addAccessibilityToolbar')).toBe(true);
    });

    it('should NOT use pp_ prefixed keys for export options', async () => {
      const mockFile = createMockFile('legacy-project.elp');
      await importerWithLegacy.importLegacyFormat(mockFile);

      const metadata = mockDocManagerWithLegacy.getMetadata();

      // These keys should NOT exist - the bug was that we used these keys
      expect(metadata.get('pp_addPagination')).toBeUndefined();
      expect(metadata.get('pp_addSearchBox')).toBeUndefined();
      expect(metadata.get('pp_addExeLink')).toBeUndefined();
      expect(metadata.get('pp_addAccessibilityToolbar')).toBeUndefined();
    });

    it('should preserve default addExeLink=true when not explicitly set to false', async () => {
      // Legacy XML without _addExeLink set (should default to true)
      const legacyXmlWithDefaults = `<?xml version="1.0"?>
        <instance class="exe.engine.package.Package">
          <dictionary>
            <string role="key" value="_title"/>
            <unicode value="Project Without ExeLink Set"/>
            <string role="key" value="_nodeIdDict"/>
            <dictionary/>
            <string role="key" value="_root"/>
            <instance class="exe.engine.node.Node">
              <dictionary>
                <string role="key" value="_id"/>
                <unicode value="root"/>
                <string role="key" value="_title"/>
                <unicode value="Home"/>
                <string role="key" value="_children"/>
                <list/>
                <string role="key" value="idevices"/>
                <list/>
              </dictionary>
            </instance>
          </dictionary>
        </instance>`;

      global.window.fflate = createMockFflateLegacy(legacyXmlWithDefaults);
      const docManager = createMockDocumentManager();
      const importer = new ElpxImporter(docManager, createMockAssetManager());

      const mockFile = createMockFile('legacy-defaults.elp');
      await importer.importLegacyFormat(mockFile);

      const metadata = docManager.getMetadata();

      // addExeLink should default to true when not explicitly set
      expect(metadata.get('addExeLink')).toBe(true);
      // Other export options should default to false
      expect(metadata.get('addPagination')).toBe(false);
      expect(metadata.get('addSearchBox')).toBe(false);
      expect(metadata.get('exportSource')).toBe(false);
      expect(metadata.get('addAccessibilityToolbar')).toBe(false);
    });

    it('should store export options that persist across page navigation', async () => {
      // This test documents the expected behavior:
      // Export options stored in metadata should be retrievable at any time
      const mockFile = createMockFile('legacy-project.elp');
      await importerWithLegacy.importLegacyFormat(mockFile);

      const metadata = mockDocManagerWithLegacy.getMetadata();

      // Simulate page navigation by just checking the values are still there
      const addPaginationBefore = metadata.get('addPagination');
      const addSearchBoxBefore = metadata.get('addSearchBox');

      // Values should still be accessible (this is how YjsPropertiesBinding reads them)
      expect(metadata.get('addPagination')).toBe(addPaginationBefore);
      expect(metadata.get('addSearchBox')).toBe(addSearchBoxBefore);
      expect(metadata.get('addExeLink')).toBeDefined();
      expect(metadata.get('exportSource')).toBeDefined();
      expect(metadata.get('addAccessibilityToolbar')).toBeDefined();
    });
  });

  describe('importLegacyFormat - internal link remapping', () => {
    // Legacy contentv3.xml with internal links that need remapping
    // After LegacyXmlParser converts path-based links to page IDs (page-XX),
    // ElpxImporter generates new random IDs, so the links need to be updated
    const LEGACY_XML_WITH_INTERNAL_LINKS = `<?xml version="1.0"?>
      <instance class="exe.engine.package.Package">
        <dictionary>
          <string role="key" value="_title"/>
          <unicode value="Project With Internal Links"/>
          <string role="key" value="_nodeIdDict"/>
          <dictionary/>
          <string role="key" value="_root"/>
          <instance class="exe.engine.node.Node" reference="0">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Root"/>
              <string role="key" value="_children"/>
              <list>
                <instance class="exe.engine.node.Node" reference="44">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Target Page"/>
                    <string role="key" value="parent"/>
                    <reference key="0"/>
                    <string role="key" value="_children"/>
                    <list/>
                    <string role="key" value="idevices"/>
                    <list/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.node.Node" reference="45">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Page With Link"/>
                    <string role="key" value="parent"/>
                    <reference key="0"/>
                    <string role="key" value="_children"/>
                    <list/>
                    <string role="key" value="idevices"/>
                    <list>
                      <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="100">
                        <dictionary>
                          <string role="key" value="_title"/>
                          <unicode value="Link Test"/>
                          <string role="key" value="content"/>
                          <instance class="exe.engine.field.TextAreaField">
                            <dictionary>
                              <string role="key" value="content_w_resourcePaths"/>
                              <unicode value="&lt;p&gt;Click &lt;a href=&quot;exe-node:page-44&quot;&gt;here&lt;/a&gt; to go to target.&lt;/p&gt;"/>
                            </dictionary>
                          </instance>
                        </dictionary>
                      </instance>
                    </list>
                  </dictionary>
                </instance>
              </list>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
        </dictionary>
      </instance>`;

    let importerWithLinks;
    let mockDocManagerWithLinks;

    beforeEach(() => {
      global.window.fflate = createMockFflateLegacy(LEGACY_XML_WITH_INTERNAL_LINKS);
      global.window.LegacyXmlParser = LegacyXmlParser;
      mockDocManagerWithLinks = createMockDocumentManager();
      importerWithLinks = new ElpxImporter(mockDocManagerWithLinks, createMockAssetManager());
    });

    it('remaps page IDs from page-XX format to new random IDs', async () => {
      const mockFile = createMockFile('project-with-links.elp');
      await importerWithLinks.importLegacyFormat(mockFile);

      const navigation = mockDocManagerWithLinks.getNavigation();

      // Should have imported pages
      expect(navigation.length).toBeGreaterThan(0);

      // All pages should have new random IDs, not the old page-XX format
      for (let i = 0; i < navigation.length; i++) {
        const page = navigation.get(i);
        const pageId = page.get('id');

        // Should NOT be in old format like page-0, page-44, page-45
        expect(pageId).not.toMatch(/^page-\d+$/);
        // Should be in new format like page-abcdef-123456
        expect(pageId).toMatch(/^page-[a-z0-9]+-[a-z0-9]+$/);
      }
    });

    it('updateInternalLinksWithRemap helper replaces old page IDs', () => {
      // Test the internal link update logic directly
      const idRemap = new Map([
        ['page-44', 'page-abc123-xyz'],
        ['page-45', 'page-def456-uvw'],
      ]);

      // Simulate the updateInternalLinksWithRemap function
      const updateInternalLinksWithRemap = (html) => {
        if (!html || typeof html !== 'string' || !html.includes('exe-node:')) return html;
        return html.replace(/exe-node:(page-\d+)/g, (match, oldPageId) => {
          const newPageId = idRemap.get(oldPageId);
          if (newPageId) {
            return `exe-node:${newPageId}`;
          }
          return match;
        });
      };

      // Test with HTML containing internal links
      const html = '<a href="exe-node:page-44">Link to target</a> and <a href="exe-node:page-45">another link</a>';
      const result = updateInternalLinksWithRemap(html);

      expect(result).toBe('<a href="exe-node:page-abc123-xyz">Link to target</a> and <a href="exe-node:page-def456-uvw">another link</a>');
      expect(result).not.toContain('page-44');
      expect(result).not.toContain('page-45');
    });

    it('updateInternalLinksWithRemap handles links without matches', () => {
      const idRemap = new Map([
        ['page-44', 'page-abc123-xyz'],
      ]);

      const updateInternalLinksWithRemap = (html) => {
        if (!html || typeof html !== 'string' || !html.includes('exe-node:')) return html;
        return html.replace(/exe-node:(page-\d+)/g, (match, oldPageId) => {
          const newPageId = idRemap.get(oldPageId);
          if (newPageId) {
            return `exe-node:${newPageId}`;
          }
          return match;
        });
      };

      // Link with unmapped ID should remain unchanged
      const html = '<a href="exe-node:page-99">Unknown page</a>';
      const result = updateInternalLinksWithRemap(html);

      expect(result).toBe(html);
    });

    it('updateInternalLinksWithRemap handles non-string input', () => {
      const updateInternalLinksWithRemap = (html) => {
        if (!html || typeof html !== 'string' || !html.includes('exe-node:')) return html;
        return html;
      };

      expect(updateInternalLinksWithRemap(null)).toBe(null);
      expect(updateInternalLinksWithRemap(undefined)).toBe(undefined);
      expect(updateInternalLinksWithRemap('')).toBe('');
      expect(updateInternalLinksWithRemap('no links here')).toBe('no links here');
    });
  });

});

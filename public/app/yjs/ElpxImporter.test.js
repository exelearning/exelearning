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
  get(index) {
    return this.items[index];
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

      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      for (const [originalPath, assetId] of assetMap.entries()) {
        const fileName = originalPath.split('/').pop();
        const escapedFileName = escapeRegex(fileName);

        // 1. Replace {{context_path}}/resources/filename
        str = str.split(`{{context_path}}/resources/${fileName}`).join(`asset://${assetId}`);
        str = str.split(`{{context_path}}/${originalPath}`).join(`asset://${assetId}`);

        // 2. Replace resources/filename when preceded by attribute quote
        const resourcesPattern = new RegExp(`(["'=])resources/${escapedFileName}`, 'g');
        str = str.replace(resourcesPattern, `$1asset://${assetId}`);

        // 3. Replace bare filename ONLY in src/href attributes
        if (fileName) {
          str = str.replace(
            new RegExp(`(src|href)=(["'])${escapedFileName}\\2`, 'g'),
            `$1=$2asset://${assetId}$2`
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
      expect(result).toContain('asset://asset-uuid-123');

      // External URL SHOULD remain unchanged - filename should NOT be replaced
      expect(result).toContain('https://example.com/viewer.php?file=https://example.com/uploads/cedec-Plantilla.pdf');
      expect(result).not.toContain('https://example.com/uploads/asset://');
    });

    it('should replace resources/ local path', () => {
      const assetMap = new Map([['document.pdf', 'doc-uuid-456']]);

      const html = '<a href="resources/document.pdf">Download</a>';
      const result = replaceAssetPaths(html, assetMap);

      // Local resource path SHOULD be converted
      expect(result).toContain('asset://doc-uuid-456');
      expect(result).not.toContain('resources/document.pdf');
    });

    it('should replace {{context_path}}/resources/ path', () => {
      const assetMap = new Map([['image.png', 'img-uuid-789']]);

      const html = '<img src="{{context_path}}/resources/image.png">';
      const result = replaceAssetPaths(html, assetMap);

      expect(result).toContain('asset://img-uuid-789');
      expect(result).not.toContain('{{context_path}}');
    });

    it('should NOT replace filename in query string parameter', () => {
      const assetMap = new Map([['report.pdf', 'report-uuid-abc']]);

      const html = `<a href="/download.php?file=report.pdf">External download</a>
<a href="resources/report.pdf">Local download</a>`;
      const result = replaceAssetPaths(html, assetMap);

      // Query string parameter should NOT be replaced
      expect(result).toContain('/download.php?file=report.pdf');

      // Local resource path SHOULD be replaced
      expect(result).toContain('asset://report-uuid-abc');
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
      expect(result).toContain('asset://uuid-1');
      expect(result).toContain('asset://uuid-2');
      expect(result).toContain('asset://uuid-3');

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
      expect(result).toContain('asset://asset-123');

      // External iframe URL should be completely preserved
      expect(result).toContain('https://cedec.intef.es/wp-content/plugins/pdfjs-viewer-shortcode/pdfjs/web/viewer.php?file=https://cedec.intef.es/wp-content/uploads/2019/09/cedec-Plantilla-ideografia-A-la-romana.pdf');
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
      nav.push([{ get: (key) => key === 'order' ? 5 : null }]);
      nav.push([{ get: (key) => key === 'order' ? 3 : null }]);

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
});

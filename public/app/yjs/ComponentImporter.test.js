/**
 * ComponentImporter Unit Tests
 *
 * Tests for importing .idevice and .block files into projects.
 *
 * Run with: bun test public/app/yjs/ComponentImporter.test.js
 *
 * @vitest-environment happy-dom
 */

const ComponentImporter = require('./ComponentImporter');

// Sample component content.xml (exported by ComponentExporter)
// Note: happy-dom has issues with CDATA, so we use HTML-escaped content
const SAMPLE_COMPONENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-original-123</odeBlockId>
    <blockName>Test Block</blockName>
    <iconName></iconName>
    <odePagStructureOrder>0</odePagStructureOrder>
    <odePagStructureProperties>{}</odePagStructureProperties>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-original-456</odeIdeviceId>
        <odePageId>page-1</odePageId>
        <odeBlockId>block-original-123</odeBlockId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <ideviceSrcType>json</ideviceSrcType>
        <userIdevice>0</userIdevice>
        <htmlView>&lt;p&gt;Hello World&lt;/p&gt;</htmlView>
        <jsonProperties>{"textTextarea":"Hello World"}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
        <odeComponentsProperties></odeComponentsProperties>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

// Sample component with asset references
// Note: Using HTML-escaped content instead of CDATA for happy-dom compatibility
const SAMPLE_COMPONENT_WITH_ASSET_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-with-asset</odeBlockId>
    <blockName>Block With Image</blockName>
    <iconName></iconName>
    <odePagStructureOrder>0</odePagStructureOrder>
    <odePagStructureProperties>{}</odePagStructureProperties>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-with-asset</odeIdeviceId>
        <odePageId>page-1</odePageId>
        <odeBlockId>block-with-asset</odeBlockId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <ideviceSrcType>json</ideviceSrcType>
        <userIdevice>0</userIdevice>
        <htmlView>&lt;p&gt;Image: &lt;img src="asset://old-uuid-123/image.jpg"&gt;&lt;/p&gt;</htmlView>
        <jsonProperties>{"textTextarea":"Image with asset"}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
        <odeComponentsProperties></odeComponentsProperties>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

// Invalid XML (missing odeComponentsResources marker)
const INVALID_COMPONENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-1</odeBlockId>
    <blockName>Test Block</blockName>
  </odePagStructure>
</odePagStructures>
</ode>`;

// Mock fflate
const createMockFflate = (contentXml, assets = {}) => ({
  unzipSync: vi.fn((data) => {
    // Simulate ZIP extraction
    const result = {
      'content.xml': new TextEncoder().encode(contentXml),
    };
    // Add assets
    for (const [path, content] of Object.entries(assets)) {
      result[path] = new TextEncoder().encode(content);
    }
    return result;
  }),
});

// Mock Y.js
const createMockY = () => {
  class MockYMap {
    constructor() {
      this._data = new Map();
    }
    set(key, value) {
      this._data.set(key, value);
    }
    get(key) {
      return this._data.get(key);
    }
  }

  class MockYArray {
    constructor() {
      this._items = [];
    }
    get length() {
      return this._items.length;
    }
    get(index) {
      return this._items[index];
    }
    push(items) {
      this._items.push(...items);
    }
  }

  return {
    Map: MockYMap,
    Array: MockYArray,
  };
};

// Mock document manager
const createMockDocumentManager = (pages = []) => {
  const Y = createMockY();
  const navigation = new Y.Array();

  // Add initial pages
  for (const page of pages) {
    const pageMap = new Y.Map();
    pageMap.set('id', page.id);
    pageMap.set('pageId', page.id);
    pageMap.set('pageName', page.name || 'Test Page');
    pageMap.set('blocks', new Y.Array());
    navigation.push([pageMap]);
  }

  const mockDoc = {
    transact: vi.fn((fn) => fn()),
  };

  return {
    getDoc: () => mockDoc,
    getNavigation: () => navigation,
    _navigation: navigation,
    _Y: Y,
  };
};

// Mock asset manager
const createMockAssetManager = (assetMap = new Map()) => ({
  extractAssetsFromZip: vi.fn(async () => assetMap),
  convertContextPathToAssetRefs: vi.fn((content) => content),
});

describe('ComponentImporter', () => {
  let originalWindow;

  beforeEach(() => {
    originalWindow = { ...global.window };

    // Setup global mocks - preserve DOMParser from happy-dom
    const existingDOMParser = global.DOMParser || window.DOMParser;

    global.window = {
      ...global.window,
      Y: createMockY(),
      fflate: createMockFflate(SAMPLE_COMPONENT_XML),
      DOMParser: existingDOMParser,
      Logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    global.Logger = global.window.Logger;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  describe('constructor', () => {
    it('should create instance with documentManager and assetManager', () => {
      const docManager = createMockDocumentManager();
      const assetManager = createMockAssetManager();

      const importer = new ComponentImporter(docManager, assetManager);

      expect(importer.manager).toBe(docManager);
      expect(importer.assetManager).toBe(assetManager);
      expect(importer.assetMap).toBeInstanceOf(Map);
    });

    it('should create instance with null assetManager', () => {
      const docManager = createMockDocumentManager();

      const importer = new ComponentImporter(docManager, null);

      expect(importer.manager).toBe(docManager);
      expect(importer.assetManager).toBeNull();
    });
  });

  describe('importComponent', () => {
    it('should successfully import a valid component file', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager();

      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);

      const importer = new ComponentImporter(docManager, assetManager);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice', {
        type: 'application/octet-stream',
      });

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      expect(result.blockId).toBeDefined();
      expect(result.blockId).toMatch(/^block-/);
    });

    it('should return error when target page not found', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager();

      const importer = new ComponentImporter(docManager, assetManager);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'non-existent-page');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target page not found');
    });

    it('should return error when fflate not loaded', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      global.window.fflate = null;

      const importer = new ComponentImporter(docManager, null);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('fflate library not loaded');
    });

    it('should return error for invalid component file (missing marker)', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      global.window.fflate = createMockFflate(INVALID_COMPONENT_XML);

      const importer = new ComponentImporter(docManager, null);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('missing odeComponentsResources marker');
    });

    it('should return error when content.xml is missing', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      global.window.fflate = {
        unzipSync: () => ({}), // Empty ZIP
      };

      const importer = new ComponentImporter(docManager, null);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No content.xml found in component file');
    });

    it('should generate new IDs for imported block and components', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager();

      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);

      const importer = new ComponentImporter(docManager, assetManager);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      // Block ID should be newly generated, not the original
      expect(result.blockId).not.toBe('block-original-123');
      expect(result.blockId).toMatch(/^block-[a-z0-9]+-[a-z0-9]+$/);
    });

    it('should import assets when assetManager is provided', async () => {
      const assetMap = new Map([
        ['content/resources/old-uuid-123/image.jpg', 'new-asset-uuid-789'],
      ]);
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager(assetMap);

      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_WITH_ASSET_XML, {
        'content/resources/old-uuid-123/image.jpg': 'fake-image-data',
      });

      const importer = new ComponentImporter(docManager, assetManager);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      expect(assetManager.extractAssetsFromZip).toHaveBeenCalled();
    });
  });

  describe('isComponentExport', () => {
    it('should return true for valid component export XML', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(SAMPLE_COMPONENT_XML, 'text/xml');

      expect(importer.isComponentExport(xmlDoc)).toBe(true);
    });

    it('should return false for XML without marker', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(INVALID_COMPONENT_XML, 'text/xml');

      expect(importer.isComponentExport(xmlDoc)).toBe(false);
    });
  });

  describe('parseBlockFromXml', () => {
    it('should parse block data from XML', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(SAMPLE_COMPONENT_XML, 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      expect(blockData).toBeDefined();
      expect(blockData.blockName).toBe('Test Block');
      expect(blockData.components).toHaveLength(1);
      expect(blockData.components[0].ideviceType).toBe('text');
    });

    it('should return null when no odePagStructure found', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString('<ode></ode>', 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      expect(blockData).toBeNull();
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs with prefix', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const id1 = importer.generateId('block');
      const id2 = importer.generateId('block');
      const id3 = importer.generateId('idevice');

      expect(id1).toMatch(/^block-/);
      expect(id2).toMatch(/^block-/);
      expect(id3).toMatch(/^idevice-/);
      expect(id1).not.toBe(id2); // Should be unique
    });
  });

  describe('convertAssetPaths', () => {
    it('should convert asset:// URLs to new asset IDs', () => {
      const assetMap = new Map([
        ['content/resources/old-uuid-123/image.jpg', 'new-uuid-456'],
      ]);

      const docManager = createMockDocumentManager();
      const assetManager = createMockAssetManager(assetMap);

      const importer = new ComponentImporter(docManager, assetManager);
      importer.assetMap = assetMap;

      const content = '<img src="asset://old-uuid-123/image.jpg">';
      const result = importer.convertAssetPaths(content);

      expect(result).toBe('<img src="asset://new-uuid-456/image.jpg">');
    });

    it('should return unchanged content when no assets match', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      importer.assetMap = new Map();

      const content = '<p>No assets here</p>';
      const result = importer.convertAssetPaths(content);

      expect(result).toBe('<p>No assets here</p>');
    });

    it('should handle null/undefined content', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      expect(importer.convertAssetPaths(null)).toBeNull();
      expect(importer.convertAssetPaths(undefined)).toBeUndefined();
    });
  });

  describe('decodeHtmlContent', () => {
    it('should decode CDATA content', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const content = '<![CDATA[<p>Hello World</p>]]>';
      const result = importer.decodeHtmlContent(content);

      expect(result).toBe('<p>Hello World</p>');
    });

    it('should decode HTML entities', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const content = '&lt;p&gt;Test&lt;/p&gt;';
      const result = importer.decodeHtmlContent(content);

      expect(result).toBe('<p>Test</p>');
    });

    it('should handle empty string', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      expect(importer.decodeHtmlContent('')).toBe('');
      expect(importer.decodeHtmlContent(null)).toBe('');
    });
  });
});

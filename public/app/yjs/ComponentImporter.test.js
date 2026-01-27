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

      // New format: asset://uuid.ext (extension from filename in assetMap path)
      expect(result).toBe('<img src="asset://new-uuid-456.jpg">');
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

  describe('error handling', () => {
    it('should return error for invalid ZIP file', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      global.window.fflate = {
        unzipSync: () => {
          throw new Error('Invalid ZIP data');
        },
      };

      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ZIP file');
      expect(result.error).toContain('Invalid ZIP data');
    });

    it('should return error for XML parsing errors', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      // Create XML with parsererror (malformed XML)
      const malformedXml = '<?xml version="1.0"?><unclosed>';
      global.window.fflate = createMockFflate(malformedXml);

      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      // Either parsing error or missing marker error
      expect(result.error).toMatch(/XML parsing error|missing odeComponentsResources marker/);
    });

    it('should handle general exceptions gracefully', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      // Cause an error by making arrayBuffer throw
      const badFile = {
        name: 'test.idevice',
        arrayBuffer: () => Promise.reject(new Error('Read error')),
      };

      const importer = new ComponentImporter(docManager, null);

      const result = await importer.importComponent(badFile, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Read error');
    });

    it('should return error when no block structure found in XML', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      // Valid component file marker but no odePagStructure
      const xmlNoStructure = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
</odePagStructures>
</ode>`;

      global.window.fflate = createMockFflate(xmlNoStructure);

      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No block structure found in component file');
    });
  });

  describe('convertAssetPathsInObject', () => {
    it('should process arrays recursively with {{context_path}} URLs', () => {
      const assetMap = new Map([
        ['old-uuid-123/image.jpg', 'new-uuid-456'],
      ]);

      const docManager = createMockDocumentManager();
      // Create assetManager that converts {{context_path}} to asset://
      const assetManager = {
        convertContextPathToAssetRefs: vi.fn((content, map) => {
          // Simulate conversion of {{context_path}} to asset://
          return content.replace(
            /\{\{context_path\}\}\/([^\s"']+)/g,
            (match, path) => {
              for (const [origPath, newId] of map.entries()) {
                if (path.includes(origPath.split('/')[0])) {
                  return `asset://${newId}/${origPath.split('/').pop()}`;
                }
              }
              return match;
            }
          );
        }),
      };

      const importer = new ComponentImporter(docManager, assetManager);
      importer.assetMap = assetMap;

      const obj = ['{{context_path}}/old-uuid-123/image.jpg', 'plain text'];
      const result = importer.convertAssetPathsInObject(obj);

      expect(assetManager.convertContextPathToAssetRefs).toHaveBeenCalled();
      expect(result[1]).toBe('plain text');
    });

    it('should process nested objects recursively with {{context_path}} URLs', () => {
      const assetMap = new Map([
        ['old-uuid-123/image.jpg', 'new-uuid-456'],
      ]);

      const docManager = createMockDocumentManager();
      const assetManager = {
        convertContextPathToAssetRefs: vi.fn((content, map) => {
          // Simulate conversion
          return content.replace('{{context_path}}/old-uuid-123/image.jpg', 'asset://new-uuid-456/image.jpg');
        }),
      };

      const importer = new ComponentImporter(docManager, assetManager);
      importer.assetMap = assetMap;

      const obj = {
        level1: {
          level2: {
            url: '{{context_path}}/old-uuid-123/image.jpg',
          },
        },
        name: 'test',
      };
      const result = importer.convertAssetPathsInObject(obj);

      expect(result.level1.level2.url).toBe('asset://new-uuid-456/image.jpg');
      expect(result.name).toBe('test');
    });

    it('should return strings without {{context_path}} unchanged', () => {
      const docManager = createMockDocumentManager();
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(docManager, assetManager);
      importer.assetMap = new Map();

      // Strings without {{context_path}} should not be converted
      const result = importer.convertAssetPathsInObject('regular string');
      expect(result).toBe('regular string');
    });

    it('should return primitive values unchanged', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      importer.assetMap = new Map();

      expect(importer.convertAssetPathsInObject(42)).toBe(42);
      expect(importer.convertAssetPathsInObject(true)).toBe(true);
      expect(importer.convertAssetPathsInObject(null)).toBe(null);
      expect(importer.convertAssetPathsInObject(undefined)).toBe(undefined);
    });
  });

  describe('convertAssetPaths edge cases', () => {
    it('should handle asset URL without filename suffix', () => {
      const assetMap = new Map([
        ['content/resources/old-uuid-123/image.jpg', 'new-uuid-456'],
      ]);

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      importer.assetMap = assetMap;

      // Asset URL without suffix - should extract extension from assetMap path
      const content = 'url: asset://old-uuid-123';
      const result = importer.convertAssetPaths(content);

      // New format: asset://uuid.ext
      expect(result).toBe('url: asset://new-uuid-456.jpg');
    });

    it('should handle multiple asset URLs in content', () => {
      const assetMap = new Map([
        ['content/resources/uuid-1/img1.jpg', 'new-1'],
        ['content/resources/uuid-2/img2.png', 'new-2'],
      ]);

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      importer.assetMap = assetMap;

      const content = '<img src="asset://uuid-1/img1.jpg"><img src="asset://uuid-2/img2.png">';
      const result = importer.convertAssetPaths(content);

      // New format: asset://uuid.ext
      expect(result).toBe('<img src="asset://new-1.jpg"><img src="asset://new-2.png">');
    });

    it('should handle non-string content', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      expect(importer.convertAssetPaths(123)).toBe(123);
      expect(importer.convertAssetPaths({})).toEqual({});
    });
  });

  describe('parseBlockFromXml edge cases', () => {
    it('should parse block with valid JSON properties', () => {
      const xmlWithProps = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-1</odeBlockId>
    <blockName>Test Block</blockName>
    <odePagStructureProperties>{"customProp":"value","nested":{"a":1}}</odePagStructureProperties>
    <odeComponents></odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlWithProps, 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      expect(blockData.properties).toEqual({ customProp: 'value', nested: { a: 1 } });
    });

    it('should handle invalid JSON properties gracefully', () => {
      const xmlWithBadProps = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-1</odeBlockId>
    <blockName>Test Block</blockName>
    <odePagStructureProperties>not valid json {</odePagStructureProperties>
    <odeComponents></odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlWithBadProps, 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      // Should not throw, properties should be empty object
      expect(blockData.properties).toEqual({});
    });

    it('should generate IDs when missing from XML', () => {
      const xmlMinimal = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <blockName>Minimal Block</blockName>
    <odeComponents>
      <odeComponent>
        <htmlView>&lt;p&gt;Content&lt;/p&gt;</htmlView>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlMinimal, 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      // Should generate IDs
      expect(blockData.id).toMatch(/^block-/);
      expect(blockData.components[0].id).toMatch(/^idevice-/);
      expect(blockData.components[0].ideviceType).toBe('FreeTextIdevice'); // default
    });
  });

  describe('parseComponentFromXml edge cases', () => {
    it('should handle invalid JSON in jsonProperties gracefully', () => {
      const xmlWithBadJsonProps = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-1</odeBlockId>
    <blockName>Test</blockName>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>comp-1</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;Test&lt;/p&gt;</htmlView>
        <jsonProperties>invalid json {{{</jsonProperties>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlWithBadJsonProps, 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      // Should not throw, properties should be empty
      expect(blockData.components[0].properties).toEqual({});
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should handle component without htmlView', () => {
      const xmlNoHtmlView = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-1</odeBlockId>
    <blockName>Test</blockName>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>comp-1</odeIdeviceId>
        <odeIdeviceTypeName>quiz</odeIdeviceTypeName>
        <jsonProperties>{"question":"What is 2+2?"}</jsonProperties>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlNoHtmlView, 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      expect(blockData.components[0].htmlView).toBe('');
      expect(blockData.components[0].properties.question).toBe('What is 2+2?');
    });
  });

  describe('createBlockYMap edge cases', () => {
    it('should create Y.Map with properties when present', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const blockData = {
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Test',
        iconName: 'icon.png',
        order: 0,
        createdAt: '2025-01-01',
        components: [],
        properties: {
          style: 'default',
          visible: true,
          nullValue: null, // should be skipped
          undefinedValue: undefined, // should be skipped
        },
      };

      const blockMap = importer.createBlockYMap(blockData);

      expect(blockMap.get('properties')).toBeDefined();
      expect(blockMap.get('properties').get('style')).toBe('default');
      expect(blockMap.get('properties').get('visible')).toBe(true);
      // null and undefined should not be set
      expect(blockMap.get('properties').get('nullValue')).toBeUndefined();
      expect(blockMap.get('properties').get('undefinedValue')).toBeUndefined();
    });

    it('should not create properties map when empty', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const blockData = {
        id: 'block-1',
        blockId: 'block-1',
        blockName: 'Test',
        order: 0,
        createdAt: '2025-01-01',
        components: [],
        properties: {},
      };

      const blockMap = importer.createBlockYMap(blockData);

      expect(blockMap.get('properties')).toBeUndefined();
    });
  });

  describe('createComponentYMap edge cases', () => {
    it('should handle component without htmlView', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const compData = {
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'quiz',
        type: 'quiz',
        order: 0,
        createdAt: '2025-01-01',
        htmlView: '', // empty
        properties: { question: 'Test?' },
      };

      const compMap = importer.createComponentYMap(compData);

      // htmlView should not be set when empty
      expect(compMap.get('htmlView')).toBeUndefined();
      expect(compMap.get('jsonProperties')).toBe('{"question":"Test?"}');
    });

    it('should handle component without properties', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const compData = {
        id: 'comp-1',
        ideviceId: 'comp-1',
        ideviceType: 'text',
        type: 'text',
        order: 0,
        createdAt: '2025-01-01',
        htmlView: '<p>Test</p>',
        properties: null,
      };

      const compMap = importer.createComponentYMap(compData);

      expect(compMap.get('htmlView')).toBe('<p>Test</p>');
      expect(compMap.get('jsonProperties')).toBeUndefined();
    });
  });

  describe('getTextContent', () => {
    it('should return null when element not found', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString('<root><child>value</child></root>', 'text/xml');
      const root = xmlDoc.querySelector('root');

      expect(importer.getTextContent(root, 'nonexistent')).toBeNull();
      expect(importer.getTextContent(root, 'child')).toBe('value');
    });
  });

  describe('page without blocks array', () => {
    it('should create blocks array when page does not have one', async () => {
      // Create a page without blocks
      const Y = createMockY();
      const navigation = new Y.Array();

      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('pageId', 'page-1');
      pageMap.set('pageName', 'Test Page');
      // Note: NOT setting 'blocks' array
      navigation.push([pageMap]);

      const mockDoc = {
        transact: vi.fn((fn) => fn()),
      };

      const docManager = {
        getDoc: () => mockDoc,
        getNavigation: () => navigation,
      };

      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);

      const importer = new ComponentImporter(docManager, null);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      // Verify blocks array was created
      expect(pageMap.get('blocks')).toBeDefined();
      expect(pageMap.get('blocks').length).toBe(1);
    });
  });

  describe('findPage', () => {
    it('should find page by pageId fallback', () => {
      const Y = createMockY();
      const navigation = new Y.Array();

      // Create page with only 'pageId' (not 'id')
      const pageMap = new Y.Map();
      pageMap.set('pageId', 'page-by-pageid');
      pageMap.set('pageName', 'Test Page');
      navigation.push([pageMap]);

      const docManager = {
        getNavigation: () => navigation,
      };

      const importer = new ComponentImporter(docManager, null);
      const found = importer.findPage('page-by-pageid');

      expect(found).toBe(pageMap);
    });

    it('should return null when page not found', () => {
      const docManager = createMockDocumentManager([{ id: 'page-1' }]);
      const importer = new ComponentImporter(docManager, null);

      const found = importer.findPage('nonexistent');

      expect(found).toBeNull();
    });
  });
});

/**
 * ComponentImporter Unit Tests
 *
 * Tests for importing .idevice and .block files into projects.
 *
 * Run with: npx vitest run public/app/yjs/ComponentImporter.test.js
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

const createMockFflate = (contentXml, assets = {}) => ({
  unzipSync: vi.fn((data) => {
    const result = {
      'content.xml': new TextEncoder().encode(contentXml),
    };
    for (const [path, content] of Object.entries(assets)) {
      result[path] = new TextEncoder().encode(content);
    }
    return result;
  }),
});

// Faithful fflate simulation: unzipSync only decompresses entries the filter
// accepts, and records which ones were actually inflated.
const createFaithfulFflate = (entries) => {
  const inflated = [];
  return {
    inflated,
    unzipSync: (data, options) => {
      const zip = {};
      for (const entry of entries) {
        const accepted =
          !options || typeof options.filter !== 'function' || options.filter(entry);
        if (accepted) {
          inflated.push(entry.name);
          zip[entry.name] = entry.data;
        }
      }
      return zip;
    },
  };
};

const createMockImportPolicy = ({ totalBytes = 1024, inspectThrows = null, componentLimits = null } = {}) => {
  class MockZipLimitError extends Error {
    constructor(message, details) {
      super(message);
      this.name = 'ZipLimitError';
      this.details = details;
    }
  }
  const policy = {
    ZipLimitError: MockZipLimitError,
    inspectZipArchive: vi.fn(() => {
      if (inspectThrows) throw inspectThrows;
      return {
        entries: [{ name: 'content.xml', size: totalBytes }],
        totalBytes,
        entryCount: 1,
        largestEntry: { name: 'content.xml', size: totalBytes },
      };
    }),
    assertInspectionWithinLimits: vi.fn((inspection, limits) => {
      if (inspection.totalBytes > limits.maxTotalBytes) {
        throw new MockZipLimitError('Component file exceeds the maximum total decompressed size.', {
          kind: 'total-size',
          archiveLabel: 'Component file',
          actualValue: inspection.totalBytes,
          limitValue: limits.maxTotalBytes,
        });
      }
    }),
  };
  if (componentLimits) {
    policy.COMPONENT_IMPORT_LIMITS = componentLimits;
  }
  return policy;
};

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

  return { Map: MockYMap, Array: MockYArray };
};

const createMockDocumentManager = (pages = []) => {
  const Y = createMockY();
  const navigation = new Y.Array();

  for (const page of pages) {
    const pageMap = new Y.Map();
    pageMap.set('id', page.id);
    pageMap.set('pageId', page.id);
    pageMap.set('pageName', page.name || 'Test Page');
    pageMap.set('blocks', new Y.Array());
    navigation.push([pageMap]);
  }

  const mockDoc = {
    clientID: 'test-client-id',
    transact: vi.fn((fn) => fn()),
  };

  return {
    getDoc: () => mockDoc,
    getNavigation: () => navigation,
    _navigation: navigation,
    _Y: Y,
  };
};

const createMockAssetManager = (assetMap = new Map()) => ({
  extractAssetsFromZip: vi.fn(async () => assetMap),
  convertContextPathToAssetRefs: vi.fn((content) => content),
});

describe('ComponentImporter', () => {
  let originalWindow;

  beforeEach(() => {
    originalWindow = { ...global.window };

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

    it('should find the target page when it is not the first in navigation', async () => {
      const docManager = createMockDocumentManager([
        { id: 'page-0', name: 'First' },
        { id: 'page-1', name: 'Target' },
      ]);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      const navigation = docManager._navigation;
      expect(navigation.get(0).get('blocks').length).toBe(0);
      expect(navigation.get(1).get('blocks').length).toBe(1);
    });

    it('still imports a file larger than the component tier compressed cap (no limits on the existing flow, review #2474)', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const importer = new ComponentImporter(docManager, null);

      const file = {
        name: 'huge.idevice',
        size: 60 * 1024 * 1024,
        arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
      };

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      expect(file.arrayBuffer).toHaveBeenCalled();
    });

    it('still imports a ZIP whose decompressed contents exceed the component tier cap (no limits on the existing flow, review #2474)', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      global.window.fflate = {
        unzipSync: () => ({
          'content.xml': new TextEncoder().encode(SAMPLE_COMPONENT_XML),
          'huge.bin': { byteLength: 201 * 1024 * 1024 },
        }),
      };

      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
    });

    it('extracts every entry without a declared-size filter on the existing flow (review #2474)', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

      const entries = [
        { name: 'content.xml', originalSize: 1024, data: new TextEncoder().encode(SAMPLE_COMPONENT_XML) },
        { name: 'huge.bin', originalSize: 201 * 1024 * 1024, data: { byteLength: 0 } },
      ];
      const inflated = [];
      global.window.fflate = {
        unzipSync: (data, options) => {
          const zip = {};
          for (const entry of entries) {
            const accepted = !options || typeof options.filter !== 'function' || options.filter(entry);
            if (accepted) {
              inflated.push(entry.name);
              zip[entry.name] = entry.data;
            }
          }
          return zip;
        },
      };

      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      expect(inflated).toEqual(['content.xml', 'huge.bin']);
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
        unzipSync: () => ({}),
      };

      const importer = new ComponentImporter(docManager, null);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No content.xml found in component file');
    });

    it('should rewrite embedded ideviceId in jsonProperties when component id is regenerated (#1786)', async () => {
      const COMPONENT_WITH_EMBEDDED_ID = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-orig-1</odeBlockId>
    <blockName>Embedded id</blockName>
    <iconName></iconName>
    <odePagStructureOrder>0</odePagStructureOrder>
    <odePagStructureProperties>{}</odePagStructureProperties>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-orig-1</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;hi&lt;/p&gt;</htmlView>
        <jsonProperties>{"ideviceId":"idevice-orig-1","textTextarea":"&lt;p&gt;hi&lt;/p&gt;"}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
        <odeComponentsProperties></odeComponentsProperties>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager();
      global.window.fflate = createMockFflate(COMPONENT_WITH_EMBEDDED_ID);
      const importer = new ComponentImporter(docManager, assetManager);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importComponent(file, 'page-1');
      expect(result.success).toBe(true);

      const navigation = docManager._navigation;
      const pageMap = navigation.get(0);
      const blocks = pageMap.get('blocks');
      const blockMap = blocks.get(blocks.length - 1);
      const components = blockMap.get('components');
      const compMap = components.get(0);
      const newCompId = compMap.get('id');
      const jsonStr = compMap.get('jsonProperties');
      const parsed = JSON.parse(jsonStr);

      expect(newCompId).not.toBe('idevice-orig-1');
      expect(newCompId).toMatch(/^idevice-/);
      expect(parsed.ideviceId).toBe(newCompId);
      expect(parsed.ideviceId).not.toBe('idevice-orig-1');
    });

    it('should generate new IDs for imported block and components', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager();

      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);

      const importer = new ComponentImporter(docManager, assetManager);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
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

    it('should use local clientID as transaction origin for undo tracking', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const importer = new ComponentImporter(docManager, null);

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      expect(docManager.getDoc().transact).toHaveBeenCalled();
      expect(docManager.getDoc().transact.mock.calls[0][1]).toBe(docManager.getDoc().clientID);
    });

    it('does not preflight on the existing flow even when the policy bundle is loaded (review #2474)', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const importer = new ComponentImporter(docManager, null);
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);
      const policy = createMockImportPolicy();
      global.window.ExeImportPolicy = policy;

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(true);
      expect(policy.inspectZipArchive).not.toHaveBeenCalled();
    });

    // ---- Branch coverage ----

    it('finds the target page by pageId when id is absent in the importComponent loop', async () => {
      const Y = createMockY();
      const navigation = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('pageId', 'page-by-pageid');
      pageMap.set('pageName', 'Test Page');
      pageMap.set('blocks', new Y.Array());
      navigation.push([pageMap]);

      const docManager = {
        getDoc: () => ({ clientID: 'c', transact: vi.fn((fn) => fn()) }),
        getNavigation: () => navigation,
      };
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);

      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-by-pageid');

      expect(result.success).toBe(true);
    });

    it('falls back to the generic error message when the import exception has no message', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badFile = {
        name: 'test.idevice',
        arrayBuffer: () => Promise.reject({}),
      };

      const importer = new ComponentImporter(docManager, null);
      const result = await importer.importComponent(badFile, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Import failed');
      errorSpy.mockRestore();
    });
  });

  describe('size limits', () => {
    const importer = () => new ComponentImporter(createMockDocumentManager(), null);

    it('validateCompressedSize returns null for a file within limits', () => {
      expect(importer().validateCompressedSize({ size: 1024 })).toBeNull();
    });

    it('validateCompressedSize tolerates a missing size property', () => {
      expect(importer().validateCompressedSize({ name: 'no-size.idevice' })).toBeNull();
    });

    it('validateUncompressedSize returns null for entries within limits', () => {
      const zip = { a: new Uint8Array([1, 2, 3]), b: new Uint8Array([4, 5]) };
      expect(importer().validateUncompressedSize(zip)).toBeNull();
    });

    it('validateUncompressedSize ignores entries without a numeric byteLength', () => {
      const zip = { a: { notBytes: true }, b: null, c: 'text' };
      expect(importer().validateUncompressedSize(zip)).toBeNull();
    });

    it('validateUncompressedSize returns an error when cumulative size exceeds the limit', () => {
      const zip = {
        first: { byteLength: 200 * 1024 * 1024 },
        second: { byteLength: 1024 },
      };
      expect(importer().validateUncompressedSize(zip)).toContain('uncompressed');
    });

    it('validateUncompressedSize returns null when an entry has no byteLength property', () => {
      const zip = { a: new Uint8Array([1, 2, 3]), b: null, c: undefined };
      expect(importer().validateUncompressedSize(zip)).toBeNull();
    });

    it('createDeclaredSizeFilter accepts entries while the cumulative declared size stays within the limit', () => {
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);
      expect(filter({ name: 'a', originalSize: 100 * 1024 * 1024 })).toBe(true);
      expect(filter({ name: 'b', originalSize: 50 * 1024 * 1024 })).toBe(true);
      expect(violation.error).toBeNull();
    });

    it('createDeclaredSizeFilter rejects the entry that crosses the limit and records the error', () => {
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);
      expect(filter({ name: 'a', originalSize: 150 * 1024 * 1024 })).toBe(true);
      expect(filter({ name: 'b', originalSize: 100 * 1024 * 1024 })).toBe(false);
      expect(violation.error).toContain('uncompressed');
    });

    it('createDeclaredSizeFilter skips every entry after a violation', () => {
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);
      expect(filter({ name: 'bomb.bin', originalSize: 300 * 1024 * 1024 })).toBe(false);
      expect(filter({ name: 'small.txt', originalSize: 1 })).toBe(false);
      expect(filter({ name: 'tiny.txt', originalSize: 1 })).toBe(false);
    });

    it('createDeclaredSizeFilter tolerates entries without a usable declared size', () => {
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);
      expect(filter({ name: 'a' })).toBe(true);
      expect(filter({ name: 'b', originalSize: 'not-a-number' })).toBe(true);
      expect(filter(null)).toBe(true);
      expect(violation.error).toBeNull();
    });

    it('createDeclaredSizeFilter returns false immediately when the violation is already set', () => {
      const violation = { error: 'previous error' };
      const filter = importer().createDeclaredSizeFilter(violation);
      expect(filter({ name: 'x', originalSize: 1 })).toBe(false);
      expect(violation.error).toBe('previous error');
    });

    // ---- Entry-count cap ----

    it('createDeclaredSizeFilter enforces maxEntries in degraded mode (review #2474, point 6)', () => {
      global.window.ExeImportPolicy = undefined;
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);

      for (let i = 0; i < 10000; i++) {
        const accepted = filter({ name: `entry-${i}.txt`, originalSize: 1 });
        if (!accepted) {
          throw new Error(`filter rejected entry ${i} unexpectedly: ${violation.error}`);
        }
      }

      expect(filter({ name: 'entry-10000.txt', originalSize: 1 })).toBe(false);
      expect(violation.error).toContain('too many entries');

      expect(filter({ name: 'entry-10001.txt', originalSize: 1 })).toBe(false);
      expect(filter({ name: 'entry-10002.txt', originalSize: 1 })).toBe(false);
    });

    it('createDeclaredSizeFilter enforces maxEntries even when entries have no usable declared size', () => {
      global.window.ExeImportPolicy = undefined;
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);

      for (let i = 0; i < 10000; i++) {
        expect(filter({ name: `entry-${i}.txt` })).toBe(true);
      }
      expect(filter({ name: 'entry-10000.txt' })).toBe(false);
      expect(violation.error).toContain('too many entries');
    });

    it('createDeclaredSizeFilter does not report an entry-count violation when the archive fits', () => {
      global.window.ExeImportPolicy = undefined;
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);

      expect(filter({ name: 'content.xml', originalSize: 1 })).toBe(true);
      expect(filter({ name: 'asset.png', originalSize: 1024 })).toBe(true);
      expect(violation.error).toBeNull();
    });

    it('createDeclaredSizeFilter honours a lower maxEntries exposed by the shared tier', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: {
          maxFileBytes: 50 * 1024 * 1024,
          maxTotalBytes: 200 * 1024 * 1024,
          maxEntryBytes: 200 * 1024 * 1024,
          maxEntries: 3,
        },
      });
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);

      expect(filter({ name: 'a.txt', originalSize: 1 })).toBe(true);
      expect(filter({ name: 'b.txt', originalSize: 1 })).toBe(true);
      expect(filter({ name: 'c.txt', originalSize: 1 })).toBe(true);
      expect(filter({ name: 'd.txt', originalSize: 1 })).toBe(false);
      expect(violation.error).toContain('too many entries');
    });

    it('createDeclaredSizeFilter keeps the byte-total message when both limits are exceeded', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: {
          maxFileBytes: 50 * 1024 * 1024,
          maxTotalBytes: 10,
          maxEntryBytes: 10,
          maxEntries: 10000,
        },
      });
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);

      expect(filter({ name: 'a.txt', originalSize: 6 })).toBe(true);
      expect(filter({ name: 'b.txt', originalSize: 6 })).toBe(false);
      expect(violation.error).toContain('uncompressed');
      expect(violation.error).not.toContain('too many entries');
    });

    // ---- validateZipPreflight ----

    it('validateZipPreflight returns null when the shared policy bundle is not loaded', () => {
      global.window.ExeImportPolicy = undefined;
      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    it('validateZipPreflight returns null for an inspection within limits', () => {
      global.window.ExeImportPolicy = createMockImportPolicy();
      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    it('validateZipPreflight rejects with the canonical message when the declared total exceeds the limit', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({ totalBytes: 201 * 1024 * 1024 });
      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toContain('uncompressed');
    });

    it('validateZipPreflight also recognises a policy error by instanceof, not only by name', () => {
      const policy = createMockImportPolicy();
      const instance = new policy.ZipLimitError('too large', { kind: 'total-size' });
      instance.name = 'CustomLimitError';
      policy.assertInspectionWithinLimits = vi.fn(() => {
        throw instance;
      });
      global.window.ExeImportPolicy = policy;

      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toContain('uncompressed');
    });

    it('validateZipPreflight passes the shared component tier to the policy', () => {
      const tier = {
        maxFileBytes: 50 * 1024 * 1024,
        maxTotalBytes: 200 * 1024 * 1024,
        maxEntryBytes: 200 * 1024 * 1024,
        maxEntries: 10000,
      };
      const policy = createMockImportPolicy({ componentLimits: tier });
      global.window.ExeImportPolicy = policy;
      importer().validateZipPreflight(new Uint8Array([1, 2, 3]));
      expect(policy.assertInspectionWithinLimits.mock.calls[0][1]).toEqual(tier);
    });

    it('validateZipPreflight rejects an over-count archive via the shared policy (review #2474, point 6)', () => {
      const tier = {
        maxFileBytes: 50 * 1024 * 1024,
        maxTotalBytes: 200 * 1024 * 1024,
        maxEntryBytes: 200 * 1024 * 1024,
        maxEntries: 2,
      };
      class MockZipLimitError extends Error {
        constructor(message, details) {
          super(message);
          this.name = 'ZipLimitError';
          this.details = details;
        }
      }
      global.window.ExeImportPolicy = {
        ZipLimitError: MockZipLimitError,
        COMPONENT_IMPORT_LIMITS: tier,
        inspectZipArchive: vi.fn(() => ({
          entries: [
            { name: 'a.txt', size: 1 },
            { name: 'b.txt', size: 1 },
            { name: 'c.txt', size: 1 },
          ],
          totalBytes: 3,
          entryCount: 3,
          largestEntry: { name: 'a.txt', size: 1 },
        })),
        assertInspectionWithinLimits: (inspection, limits, label) => {
          if (inspection.entryCount > limits.maxEntries) {
            throw new MockZipLimitError(`${label} exceeds the maximum allowed number of entries`, {
              kind: 'entry-count',
              archiveLabel: label,
              actualValue: inspection.entryCount,
              limitValue: limits.maxEntries,
            });
          }
        },
      };

      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toContain('uncompressed');
    });

    it('validateZipPreflight falls back to the name check when policy.ZipLimitError is missing', () => {
      global.window.ExeImportPolicy = {
        inspectZipArchive: vi.fn(() => ({
          entries: [{ name: 'content.xml', size: 1 }],
          totalBytes: 1,
          entryCount: 1,
          largestEntry: { name: 'content.xml', size: 1 },
        })),
        assertInspectionWithinLimits: vi.fn(() => {
          const err = new Error('too large');
          err.name = 'ZipLimitError';
          throw err;
        }),
      };

      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toContain('uncompressed');
    });

    it('validateZipPreflight returns null when the policy bundle lacks inspectZipArchive', () => {
      global.window.ExeImportPolicy = {
        assertInspectionWithinLimits: vi.fn(),
      };

      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    it('validateZipPreflight returns null when the policy bundle lacks assertInspectionWithinLimits', () => {
      global.window.ExeImportPolicy = { inspectZipArchive: vi.fn() };
      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    it('validateZipPreflight returns null when the caught error is neither named nor a ZipLimitError instance', () => {
      const policy = createMockImportPolicy();
      policy.assertInspectionWithinLimits = vi.fn(() => {
        const err = new Error('unexpected');
        err.name = 'SomeOtherError';
        throw err;
      });
      global.window.ExeImportPolicy = policy;

      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    it('validateZipPreflight returns null when the inspection throws a falsy error', () => {
      const policy = createMockImportPolicy();
      policy.inspectZipArchive = vi.fn(() => { throw null; });
      global.window.ExeImportPolicy = policy;
      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    it('validateZipPreflight degrades to null when the inspection throws a non-policy error', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({ inspectThrows: new Error('bad zip') });
      expect(importer().validateZipPreflight(new Uint8Array([1, 2, 3]))).toBeNull();
    });

    // ---- resolveComponentLimits ----

    it('resolveComponentLimits returns the shared tier when the policy bundle exposes it', () => {
      const tier = {
        maxFileBytes: 25 * 1024 * 1024,
        maxTotalBytes: 100 * 1024 * 1024,
        maxEntryBytes: 100 * 1024 * 1024,
        maxEntries: Number.MAX_SAFE_INTEGER,
      };
      global.window.ExeImportPolicy = createMockImportPolicy({ componentLimits: tier });
      expect(importer().resolveComponentLimits()).toEqual(tier);
    });

    it('resolveComponentLimits falls back to the local constants when the tier is not exposed', () => {
      global.window.ExeImportPolicy = createMockImportPolicy();
      expect(importer().resolveComponentLimits()).toEqual({
        maxFileBytes: 50 * 1024 * 1024,
        maxTotalBytes: 200 * 1024 * 1024,
        maxEntryBytes: 200 * 1024 * 1024,
        maxEntries: 10000,
      });
    });

    it('resolveComponentLimits falls back when the policy bundle is not loaded at all', () => {
      global.window.ExeImportPolicy = undefined;
      expect(importer().resolveComponentLimits().maxTotalBytes).toBe(200 * 1024 * 1024);
    });

    it('resolveComponentLimits falls back when the exposed tier is incomplete', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: { maxTotalBytes: 100 * 1024 * 1024 },
      });
      const limits = importer().resolveComponentLimits();
      expect(limits.maxFileBytes).toBe(50 * 1024 * 1024);
      expect(limits.maxTotalBytes).toBe(200 * 1024 * 1024);
      expect(limits.maxEntryBytes).toBe(200 * 1024 * 1024);
    });

    it('validateCompressedSize honours the shared tier when present', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: {
          maxFileBytes: 1 * 1024 * 1024,
          maxTotalBytes: 200 * 1024 * 1024,
          maxEntryBytes: 200 * 1024 * 1024,
          maxEntries: Number.MAX_SAFE_INTEGER,
        },
      });
      expect(importer().validateCompressedSize({ size: 2 * 1024 * 1024 })).toContain('too large');
      expect(importer().validateCompressedSize({ size: 512 * 1024 })).toBeNull();
    });

    it('createDeclaredSizeFilter honours the shared tier when present', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: {
          maxFileBytes: 50 * 1024 * 1024,
          maxTotalBytes: 10 * 1024 * 1024,
          maxEntryBytes: 10 * 1024 * 1024,
          maxEntries: Number.MAX_SAFE_INTEGER,
        },
      });
      const violation = { error: null };
      const filter = importer().createDeclaredSizeFilter(violation);
      expect(filter({ name: 'a', originalSize: 6 * 1024 * 1024 })).toBe(true);
      expect(filter({ name: 'b', originalSize: 6 * 1024 * 1024 })).toBe(false);
      expect(violation.error).toContain('uncompressed');
    });

    it('validateUncompressedSize honours the shared tier when present', () => {
      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: {
          maxFileBytes: 50 * 1024 * 1024,
          maxTotalBytes: 10 * 1024 * 1024,
          maxEntryBytes: 10 * 1024 * 1024,
          maxEntries: Number.MAX_SAFE_INTEGER,
        },
      });
      const zip = { a: { byteLength: 11 * 1024 * 1024 } };
      expect(importer().validateUncompressedSize(zip)).toContain('uncompressed');
    });
  });

  describe('shared helpers (readComponentZip, parseComponentXml, regenerateComponentIds)', () => {
    const makeImporter = () =>
      new ComponentImporter(createMockDocumentManager([{ id: 'page-1' }]), null);

    // ---- readComponentZip ----

    it('readComponentZip unzips without limits by default', async () => {
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);
      const { zip, error } = await makeImporter().readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice')
      );

      expect(error).toBeUndefined();
      expect(zip['content.xml']).toBeDefined();
    });

    it('readComponentZip applies the compressed-size cap only when withLimits is set', async () => {
      const importer = makeImporter();
      const hugeFile = {
        name: 'huge.idevice',
        size: 60 * 1024 * 1024,
        arrayBuffer: vi.fn(),
      };

      const unlimited = await importer.readComponentZip(hugeFile, { withLimits: false });
      expect(unlimited.error).toBeUndefined();
      expect(hugeFile.arrayBuffer).toHaveBeenCalledTimes(1);

      const limited = await importer.readComponentZip(hugeFile, { withLimits: true });
      expect(limited.error).toContain('too large');
      expect(hugeFile.arrayBuffer).toHaveBeenCalledTimes(1);
    });

    it('readComponentZip applies the preflight and the declared-size filter when withLimits is set', async () => {
      const importer = makeImporter();
      const unzipSpy = vi.fn(() => ({
        'content.xml': new TextEncoder().encode(SAMPLE_COMPONENT_XML),
      }));
      global.window.fflate = { unzipSync: unzipSpy };
      global.window.ExeImportPolicy = createMockImportPolicy({ totalBytes: 201 * 1024 * 1024 });

      const { error } = await importer.readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice'),
        { withLimits: true }
      );

      expect(error).toContain('uncompressed');
      expect(unzipSpy).not.toHaveBeenCalled();
    });

    it('readComponentZip propagates the fflate-not-loaded error', async () => {
      global.window.fflate = null;
      const { error } = await makeImporter().readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice')
      );
      expect(error).toBe('fflate library not loaded');
    });

    it('readComponentZip propagates an invalid ZIP error', async () => {
      global.window.fflate = {
        unzipSync: vi.fn(() => {
          throw new Error('Invalid ZIP data');
        }),
      };
      const { error } = await makeImporter().readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice')
      );
      expect(error).toBe('Invalid ZIP file: Invalid ZIP data');
    });

    it('readComponentZip returns the preflight error when withLimits and the preflight rejects', async () => {
      const importer = makeImporter();
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);
      global.window.ExeImportPolicy = createMockImportPolicy({ totalBytes: 201 * 1024 * 1024 });

      const { error } = await importer.readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice'),
        { withLimits: true }
      );
      expect(error).toContain('uncompressed');
    });

    it('readComponentZip returns the declared-size violation when the filter trips', async () => {
      const importer = makeImporter();
      global.window.fflate = {
        unzipSync: (data, options) => {
          options.filter({ name: 'huge.bin', originalSize: 300 * 1024 * 1024 });
          return {};
        },
      };

      const { error } = await importer.readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice'),
        { withLimits: true }
      );
      expect(error).toContain('uncompressed');
    });

    it('readComponentZip returns the uncompressed-size error when the backstop trips', async () => {
      const importer = makeImporter();
      global.window.fflate = {
        unzipSync: () => ({
          'content.xml': new TextEncoder().encode(SAMPLE_COMPONENT_XML),
          'huge.bin': { byteLength: 201 * 1024 * 1024 },
        }),
      };

      const { error } = await importer.readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice'),
        { withLimits: true }
      );
      expect(error).toContain('uncompressed');
    });

    it('readComponentZip returns the invalid-ZIP error inside the withLimits branch', async () => {
      const importer = makeImporter();
      global.window.fflate = {
        unzipSync: () => {
          throw new Error('unexpected end of data');
        },
      };

      const { error } = await importer.readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice'),
        { withLimits: true }
      );
      expect(error).toBe('Invalid ZIP file: unexpected end of data');
    });

    // ---- Branch coverage: happy paths of readComponentZip ----

    it('readComponentZip reaches the final return when withLimits is false (else of every withLimits if)', async () => {
      const importer = makeImporter();
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);

      const { zip, error } = await importer.readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice'),
        { withLimits: false }
      );

      expect(error).toBeUndefined();
      expect(zip['content.xml']).toBeDefined();
    });

    it('readComponentZip reaches the final return when withLimits is true and nothing trips', async () => {
      const importer = makeImporter();
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);
      global.window.ExeImportPolicy = createMockImportPolicy();

      const { zip, error } = await importer.readComponentZip(
        new File([new Uint8Array([1, 2, 3])], 'test.idevice'),
        { withLimits: true }
      );

      expect(error).toBeUndefined();
      expect(zip['content.xml']).toBeDefined();
    });

    // ---- parseComponentXml ----

    it('parseComponentXml returns the parsed document for a valid zip', () => {
      const zip = createMockFflate(SAMPLE_COMPONENT_XML).unzipSync();
      const { xmlDoc, error } = makeImporter().parseComponentXml(zip);

      expect(error).toBeUndefined();
      expect(xmlDoc.querySelector('odePagStructure')).toBeTruthy();
    });

    it('parseComponentXml reports a missing content.xml', () => {
      const { error } = makeImporter().parseComponentXml({ 'other.txt': new Uint8Array([1]) });
      expect(error).toBe('No content.xml found in component file');
    });

    it('parseComponentXml reports a malformed XML and a missing marker', () => {
      const importer = makeImporter();
      const malformed = importer.parseComponentXml(
        createMockFflate('<?xml version="1.0"?><unclosed>').unzipSync()
      );
      expect(malformed.error).toMatch(/XML parsing error/);

      const noMarker = importer.parseComponentXml(
        createMockFflate(INVALID_COMPONENT_XML).unzipSync()
      );
      expect(noMarker.error).toContain('odeComponentsResources');
    });

    // ---- Branch coverage: happy paths of parseComponentXml ----

    it('parseComponentXml returns the parsed document when content.xml exists (else of !contentFile)', () => {
      const zip = createMockFflate(SAMPLE_COMPONENT_XML).unzipSync();
      const { xmlDoc, error } = makeImporter().parseComponentXml(zip);
      expect(error).toBeUndefined();
      expect(xmlDoc).toBeDefined();
      expect(xmlDoc.querySelector('odePagStructure')).toBeTruthy();
    });

    it('parseComponentXml does not report a parse error for well-formed XML (else of if (parseError))', () => {
      const zip = createMockFflate(SAMPLE_COMPONENT_XML).unzipSync();
      const result = makeImporter().parseComponentXml(zip);
      expect(result.error).toBeUndefined();
      expect(result.xmlDoc).toBeDefined();
    });

    // ---- regenerateComponentIds ----

    it('regenerateComponentIds regenerates ids and the embedded ideviceId (#1786)', () => {
      const blockData = {
        id: 'block-orig',
        blockId: 'block-orig',
        components: [
          {
            id: 'idevice-orig',
            ideviceId: 'idevice-orig',
            properties: { ideviceId: 'idevice-orig', textTextarea: 'x' },
          },
          {
            id: 'idevice-other',
            ideviceId: 'idevice-other',
            properties: { ideviceId: 'some-other-id' },
          },
        ],
      };

      const newBlockId = makeImporter().regenerateComponentIds(blockData);

      expect(newBlockId).toBeNull();
      expect(blockData.id).toBe('block-orig');
      for (const comp of blockData.components) {
        expect(comp.id).toMatch(/^idevice-/);
        expect(comp.id).not.toBe('idevice-orig');
        expect(comp.ideviceId).toBe(comp.id);
      }
      expect(blockData.components[0].properties.ideviceId).toBe(blockData.components[0].id);
      expect(blockData.components[1].properties.ideviceId).toBe('some-other-id');
    });

    it('regenerateComponentIds also regenerates the block id when requested', () => {
      const blockData = {
        id: 'block-orig',
        blockId: 'block-orig',
        components: [],
      };

      const newBlockId = makeImporter().regenerateComponentIds(blockData, { withBlockId: true });

      expect(newBlockId).toMatch(/^block-/);
      expect(blockData.id).toBe(newBlockId);
      expect(blockData.blockId).toBe(newBlockId);
    });

    it('regenerateComponentIds leaves block id untouched when withBlockId is false (else branch)', () => {
      const blockData = { id: 'block-orig', blockId: 'block-orig', components: [] };
      const newBlockId = makeImporter().regenerateComponentIds(blockData, { withBlockId: false });
      expect(newBlockId).toBeNull();
      expect(blockData.id).toBe('block-orig');
    });

    // ---- applyAssetReferencesToComponents ----

    it('applyAssetReferencesToComponents is a no-op without an asset manager', () => {
      const importer = makeImporter();
      const components = [{ htmlView: '<p>{{context_path}}/x.png</p>', properties: {} }];
      importer.applyAssetReferencesToComponents(components);
      expect(components[0].htmlView).toContain('{{context_path}}');
    });

    it('applyAssetReferencesToComponents converts htmlView and properties when present', () => {
      const importer = new ComponentImporter(
        createMockDocumentManager([{ id: 'page-1' }]),
        createMockAssetManager(new Map([['x.png', 'uuid']]))
      );
      importer.assetMap = new Map([['x.png', 'uuid']]);
      const components = [
        { htmlView: '<p>{{context_path}}/x.png</p>', properties: { url: '{{context_path}}/x.png' } },
      ];
      importer.applyAssetReferencesToComponents(components);
      expect(importer.assetManager.convertContextPathToAssetRefs).toHaveBeenCalled();
    });

    it('applyAssetReferencesToComponents skips components without htmlView or properties', () => {
      const importer = new ComponentImporter(
        createMockDocumentManager([{ id: 'page-1' }]),
        createMockAssetManager(new Map([['x.png', 'uuid']]))
      );
      importer.assetMap = new Map([['x.png', 'uuid']]);
      const components = [{}, { htmlView: '', properties: null }];
      expect(() => importer.applyAssetReferencesToComponents(components)).not.toThrow();
    });
  });

  describe('real fflate integration (vendored bundle)', () => {
    const realFflate = require('../../libs/fflate/fflate.umd.js');

    it('unzipSync invokes the filter with each entry name and declared size before inflating it', () => {
      const bytes = realFflate.zipSync({ 'a.txt': new TextEncoder().encode('hello') });
      const infos = [];
      const zip = realFflate.unzipSync(bytes, {
        filter: (info) => {
          infos.push(info);
          return true;
        },
      });
      expect(infos.length).toBe(1);
      expect(infos[0].name).toBe('a.txt');
      expect(infos[0].originalSize).toBe(5);
      expect(new TextDecoder().decode(zip['a.txt'])).toBe('hello');
    });

    it('importIdeviceIntoBlock passes a declared-size filter to the real fflate and rejects bomb metadata', async () => {
      const Y = createMockY();
      const navigation = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('pageId', 'page-1');
      pageMap.set('blocks', new Y.Array());
      const blockMap = new Y.Map();
      blockMap.set('blockId', 'block-1');
      blockMap.set('id', 'block-1');
      pageMap.get('blocks').push([blockMap]);
      navigation.push([pageMap]);
      const mockDoc = { clientID: 'test-client-id', transact: vi.fn((fn) => fn()) };
      const docManager = { getDoc: () => mockDoc, getNavigation: () => navigation };
      const importer = new ComponentImporter(docManager, null);

      const zipBytes = new Uint8Array(
        realFflate.zipSync({
          'content.xml': new TextEncoder().encode(SAMPLE_COMPONENT_XML),
          'small.txt': new TextEncoder().encode('x'),
        })
      );

      const forged = new Uint8Array(zipBytes);
      const view = new DataView(forged.buffer);
      const decoder = new TextDecoder();
      for (let i = 0; i < forged.length - 4; i++) {
        if (view.getUint32(i, true) !== 0x02014b50) continue;
        const nameLen = view.getUint16(i + 28, true);
        const name = decoder.decode(forged.subarray(i + 46, i + 46 + nameLen));
        if (name === 'small.txt') {
          view.setUint32(i + 24, 201 * 1024 * 1024, true);
        }
      }

      let passedFilter = null;
      global.window.fflate = {
        unzipSync: (data, options) => {
          passedFilter = options && typeof options.filter === 'function' ? options.filter : null;
          return realFflate.unzipSync(data, options);
        },
      };

      const file = new File([forged], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(typeof passedFilter).toBe('function');
      expect(result.success).toBe(false);
      expect(result.error).toContain('uncompressed');
    });

    it('preflight rejects bomb metadata before the archive is extracted at all (importIdeviceIntoBlock)', async () => {
      const Y = createMockY();
      const navigation = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('pageId', 'page-1');
      pageMap.set('blocks', new Y.Array());
      const blockMap = new Y.Map();
      blockMap.set('blockId', 'block-1');
      blockMap.set('id', 'block-1');
      pageMap.get('blocks').push([blockMap]);
      navigation.push([pageMap]);
      const mockDoc = { clientID: 'test-client-id', transact: vi.fn((fn) => fn()) };
      const docManager = { getDoc: () => mockDoc, getNavigation: () => navigation };
      const importer = new ComponentImporter(docManager, null);

      const zipBytes = new Uint8Array(
        realFflate.zipSync({
          'content.xml': new TextEncoder().encode(SAMPLE_COMPONENT_XML),
          'small.txt': new TextEncoder().encode('x'),
        })
      );
      const forged = new Uint8Array(zipBytes);
      const view = new DataView(forged.buffer);
      const decoder = new TextDecoder();
      for (let i = 0; i < forged.length - 4; i++) {
        if (view.getUint32(i, true) !== 0x02014b50) continue;
        const nameLen = view.getUint16(i + 28, true);
        const name = decoder.decode(forged.subarray(i + 46, i + 46 + nameLen));
        if (name === 'small.txt') {
          view.setUint32(i + 24, 201 * 1024 * 1024, true);
        }
      }

      class MockZipLimitError extends Error {
        constructor(message, details) {
          super(message);
          this.name = 'ZipLimitError';
          this.details = details;
        }
      }
      global.window.ExeImportPolicy = {
        ZipLimitError: MockZipLimitError,
        inspectZipArchive: (buffer) => {
          const entries = [];
          let totalBytes = 0;
          let largestEntry = null;
          realFflate.unzipSync(buffer, {
            filter: (info) => {
              entries.push({ name: info.name, size: info.originalSize });
              totalBytes += info.originalSize;
              if (largestEntry === null || info.originalSize > largestEntry.size) {
                largestEntry = { name: info.name, size: info.originalSize };
              }
              return false;
            },
          });
          return { entries, totalBytes, entryCount: entries.length, largestEntry };
        },
        assertInspectionWithinLimits: (inspection, limits) => {
          if (inspection.totalBytes > limits.maxTotalBytes) {
            throw new MockZipLimitError('Component file exceeds the maximum total decompressed size.', {
              kind: 'total-size',
            });
          }
        },
      };

      const unzipSpy = vi.fn((data, options) => realFflate.unzipSync(data, options));
      global.window.fflate = { unzipSync: unzipSpy };

      const file = new File([forged], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('uncompressed');
      expect(unzipSpy).not.toHaveBeenCalled();
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

    it('returns false when resources do not match', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const XML_OTHER_RESOURCE = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>otherKey</key>
    <value>otherValue</value>
  </odeResource>
</odeResources>
</ode>`;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(XML_OTHER_RESOURCE, 'text/xml');

      expect(importer.isComponentExport(xmlDoc)).toBe(false);
    });

    it('returns false when the key matches but the value is not "true"', () => {
      const XML_KEY_MATCH_VALUE_FALSE = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>false</value>
  </odeResource>
</odeResources>
</ode>`;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(XML_KEY_MATCH_VALUE_FALSE, 'text/xml');
      const importer = new ComponentImporter(createMockDocumentManager(), null);
      expect(importer.isComponentExport(xmlDoc)).toBe(false);
    });

    it('returns true when both key and value match (else of the &&)', () => {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(SAMPLE_COMPONENT_XML, 'text/xml');
      const importer = new ComponentImporter(createMockDocumentManager(), null);
      expect(importer.isComponentExport(xmlDoc)).toBe(true);
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

    it('handles missing odePagStructureProperties without throwing', () => {
      const XML_NO_PROPS = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-noprops</odeBlockId>
    <blockName>No Props</blockName>
    <odeComponents></odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(XML_NO_PROPS, 'text/xml');

      const blockData = importer.parseBlockFromXml(xmlDoc);

      expect(blockData.properties).toEqual({});
    });

    it('covers both branches of propsText and compData', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odePagStructures>
  <odePagStructure>
    <odeBlockId>b</odeBlockId>
    <odePagStructureProperties>{"a":1}</odePagStructureProperties>
    <odeComponents>
      <odeComponent><odeIdeviceId>i</odeIdeviceId><htmlView>x</htmlView></odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      const importer = new ComponentImporter(createMockDocumentManager(), null);
      const blockData = importer.parseBlockFromXml(xmlDoc);
      expect(blockData.properties).toEqual({ a: 1 });
      expect(blockData.components).toHaveLength(1);
    });
  });

  describe('iDevice structure properties (#1991)', () => {
    const COMPONENT_WITH_STRUCTURE_PROPS = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-sp</odeBlockId>
    <blockName>Block With Struct Props</blockName>
    <iconName></iconName>
    <odePagStructureOrder>0</odePagStructureOrder>
    <odePagStructureProperties>{}</odePagStructureProperties>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-sp</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;Hidden teacher content&lt;/p&gt;</htmlView>
        <jsonProperties>{"textTextarea":"Hidden teacher content"}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
        <odeComponentsProperties>
          <odeComponentsProperty>
            <key>visibility</key>
            <value>false</value>
          </odeComponentsProperty>
          <odeComponentsProperty>
            <key>teacherOnly</key>
            <value>true</value>
          </odeComponentsProperty>
          <odeComponentsProperty>
            <key>cssClass</key>
            <value>my-custom-class another-class</value>
          </odeComponentsProperty>
        </odeComponentsProperties>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

    it('parseComponentFromXml should extract structureProperties', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(COMPONENT_WITH_STRUCTURE_PROPS, 'text/xml');
      const compNode = xmlDoc.querySelector('odeComponent');

      const compData = importer.parseComponentFromXml(compNode);

      expect(compData.structureProperties).toEqual({
        visibility: 'false',
        teacherOnly: 'true',
        cssClass: 'my-custom-class another-class',
      });
    });

    it('parseComponentFromXml should omit structureProperties when the block is empty', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(SAMPLE_COMPONENT_XML, 'text/xml');
      const compNode = xmlDoc.querySelector('odeComponent');

      const compData = importer.parseComponentFromXml(compNode);

      expect(compData.structureProperties).toBeUndefined();
    });

    it('parseComponentFromXml should omit structureProperties when the element is absent', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const NO_PROPS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odePagStructures>
  <odePagStructure>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-noprops</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;No props&lt;/p&gt;</htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(NO_PROPS_XML, 'text/xml');
      const compNode = xmlDoc.querySelector('odeComponent');

      const compData = importer.parseComponentFromXml(compNode);

      expect(compData.structureProperties).toBeUndefined();
    });

    it('parseComponentStructureProperties skips properties without a key', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);

      const XML_MISSING_KEY = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odePagStructures>
  <odePagStructure>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-nokey</odeIdeviceId>
        <odeComponentsProperties>
          <odeComponentsProperty>
            <value>orphan-value</value>
          </odeComponentsProperty>
          <odeComponentsProperty>
            <key>validKey</key>
            <value>validValue</value>
          </odeComponentsProperty>
        </odeComponentsProperties>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(XML_MISSING_KEY, 'text/xml');
      const compNode = xmlDoc.querySelector('odeComponent');

      const result = importer.parseComponentStructureProperties(compNode);

      expect(result).toEqual({ validKey: 'validValue' });
    });

    it('should store structure properties in the component properties Y.Map on import', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager();
      global.window.fflate = createMockFflate(COMPONENT_WITH_STRUCTURE_PROPS);

      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.block');

      const result = await importer.importComponent(file, 'page-1');
      expect(result.success).toBe(true);

      const navigation = docManager._navigation;
      const blocks = navigation.get(0).get('blocks');
      const blockMap = blocks.get(blocks.length - 1);
      const compMap = blockMap.get('components').get(0);

      const propsMap = compMap.get('properties');
      expect(propsMap).toBeDefined();
      expect(propsMap.get('visibility')).toBe('false');
      expect(propsMap.get('teacherOnly')).toBe('true');
      expect(propsMap.get('cssClass')).toBe('my-custom-class another-class');
    });

    it('should not create a properties map when component has no structure properties', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);
      const assetManager = createMockAssetManager();
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);

      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.block');

      const result = await importer.importComponent(file, 'page-1');
      expect(result.success).toBe(true);

      const navigation = docManager._navigation;
      const blocks = navigation.get(0).get('blocks');
      const blockMap = blocks.get(blocks.length - 1);
      const compMap = blockMap.get('components').get(0);

      expect(compMap.get('properties')).toBeUndefined();
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
      expect(id1).not.toBe(id2);
    });

    it('should throw on empty prefix (mirrors src/shared/ids.ts)', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      expect(() => importer.generateId('')).toThrow('generateId: prefix is required');
      expect(() => importer.generateId(undefined)).toThrow('generateId: prefix is required');
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

      expect(result).toBe('<img src="asset://new-uuid-456.jpg">');
    });

    it('leaves asset:// URLs unchanged when no matching asset is found', () => {
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      importer.assetMap = new Map([
        ['content/resources/completely-different-uuid/image.jpg', 'new-uuid'],
      ]);

      const content = '<img src="asset://old-uuid-123/image.jpg">';
      const result = importer.convertAssetPaths(content);

      expect(result).toBe(content);
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

    it('falls back to asset://uuid without extension when the filename has no dot', () => {
      const assetMap = new Map([['content/resources/uuid-noext/noext', 'new-uuid']]);
      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      importer.assetMap = assetMap;

      const result = importer.convertAssetPaths('asset://uuid-noext/noext');
      expect(result).toBe('asset://new-uuid');
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

    it('returns the decoded text when the input is non-empty (else branch)', () => {
      const importer = new ComponentImporter(createMockDocumentManager(), null);
      expect(importer.decodeHtmlContent('hello')).toBe('hello');
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

      const malformedXml = '<?xml version="1.0"?><unclosed>';
      global.window.fflate = createMockFflate(malformedXml);

      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importComponent(file, 'page-1');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/XML parsing error|missing odeComponentsResources marker/);
    });

    it('should handle general exceptions gracefully', async () => {
      const docManager = createMockDocumentManager([{ id: 'page-1', name: 'Test Page' }]);

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
      const assetManager = {
        convertContextPathToAssetRefs: vi.fn((content, map) => {
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

    it('returns the original string when it has no {{context_path}} placeholder', () => {
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(createMockDocumentManager(), assetManager);
      importer.assetMap = new Map();
      expect(importer.convertAssetPathsInObject('plain string')).toBe('plain string');
      expect(assetManager.convertContextPathToAssetRefs).not.toHaveBeenCalled();
    });

    it('returns the original string when there is no asset manager', () => {
      const importer = new ComponentImporter(createMockDocumentManager(), null);
      importer.assetMap = new Map();
      expect(importer.convertAssetPathsInObject('{{context_path}}/x.png')).toBe('{{context_path}}/x.png');
    });

    it('converts strings with {{context_path}} when an asset manager is present', () => {
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(createMockDocumentManager(), assetManager);
      importer.assetMap = new Map([['x.png', 'uuid']]);

      importer.convertAssetPathsInObject('{{context_path}}/x.png');

      expect(assetManager.convertContextPathToAssetRefs).toHaveBeenCalledWith(
        '{{context_path}}/x.png',
        importer.assetMap
      );
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

      const content = 'url: asset://old-uuid-123';
      const result = importer.convertAssetPaths(content);

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

      expect(blockData.id).toMatch(/^block-/);
      expect(blockData.components[0].id).toMatch(/^idevice-/);
      expect(blockData.components[0].ideviceType).toBe('FreeTextIdevice');
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

    it('parseComponentFromXml handles missing jsonProperties', () => {
      const XML_NO_JSON = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odePagStructures>
  <odePagStructure>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-nojson</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;No JSON&lt;/p&gt;</htmlView>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createMockDocumentManager();
      const importer = new ComponentImporter(docManager, null);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(XML_NO_JSON, 'text/xml');
      const compNode = xmlDoc.querySelector('odeComponent');

      const compData = importer.parseComponentFromXml(compNode);

      expect(compData.properties).toEqual({});
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
          nullValue: null,
          undefinedValue: undefined,
        },
      };

      const blockMap = importer.createBlockYMap(blockData);

      expect(blockMap.get('properties')).toBeDefined();
      expect(blockMap.get('properties').get('style')).toBe('default');
      expect(blockMap.get('properties').get('visible')).toBe(true);
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
        htmlView: '',
        properties: { question: 'Test?' },
      };

      const compMap = importer.createComponentYMap(compData);

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

    it('skips properties and structureProperties when they are empty', () => {
      const importer = new ComponentImporter(createMockDocumentManager(), null);
      const compMap = importer.createComponentYMap({
        id: 'c',
        ideviceId: 'c',
        ideviceType: 'text',
        type: 'text',
        order: 0,
        createdAt: '2025-01-01',
        htmlView: '<p>x</p>',
        properties: {},
      });
      expect(compMap.get('properties')).toBeUndefined();
      expect(compMap.get('jsonProperties')).toBe('{}');
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
      const Y = createMockY();
      const navigation = new Y.Array();

      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('pageId', 'page-1');
      pageMap.set('pageName', 'Test Page');
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
      expect(pageMap.get('blocks')).toBeDefined();
      expect(pageMap.get('blocks').length).toBe(1);
    });
  });

  describe('findPage', () => {
    it('should find page by pageId fallback', () => {
      const Y = createMockY();
      const navigation = new Y.Array();

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

    it('skips non-matching pages before finding the target', () => {
      const Y = createMockY();
      const navigation = new Y.Array();

      const page1 = new Y.Map();
      page1.set('id', 'page-a');
      page1.set('pageId', 'page-a');
      navigation.push([page1]);

      const page2 = new Y.Map();
      page2.set('id', 'page-b');
      page2.set('pageId', 'page-b');
      navigation.push([page2]);

      const docManager = { getNavigation: () => navigation };
      const importer = new ComponentImporter(docManager, null);

      expect(importer.findPage('page-b')).toBe(page2);
    });
  });

  describe('importIdeviceIntoBlock', () => {
    const createManagerWithBlock = (pageId = 'page-1', blockId = 'block-1') => {
      const Y = createMockY();
      const navigation = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('id', pageId);
      pageMap.set('pageId', pageId);
      pageMap.set('blocks', new Y.Array());

      const blockMap = new Y.Map();
      blockMap.set('blockId', blockId);
      blockMap.set('id', blockId);
      pageMap.get('blocks').push([blockMap]);
      navigation.push([pageMap]);

      const mockDoc = { clientID: 'test-client-id', transact: vi.fn((fn) => fn()) };
      return {
        getDoc: () => mockDoc,
        getNavigation: () => navigation,
        _navigation: navigation,
        _Y: Y,
      };
    };

    it('rejects non-.idevice files', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.block');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('.idevice');
    });

    it('rejects a file larger than the maximum compressed size before reading it', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      const file = {
        name: 'huge.idevice',
        size: 60 * 1024 * 1024,
        arrayBuffer: vi.fn(),
      };

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('too large');
      expect(file.arrayBuffer).not.toHaveBeenCalled();
    });

    it('rejects via the preflight before extracting when the policy bundle is loaded', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      const unzipSpy = vi.fn(() => ({
        'content.xml': new TextEncoder().encode(SAMPLE_COMPONENT_XML),
      }));
      global.window.fflate = { unzipSync: unzipSpy };
      global.window.ExeImportPolicy = createMockImportPolicy({ totalBytes: 201 * 1024 * 1024 });

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('uncompressed');
      expect(unzipSpy).not.toHaveBeenCalled();
    });

    it('imports successfully when the preflight passes with the policy bundle loaded', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);
      const policy = createMockImportPolicy();
      global.window.ExeImportPolicy = policy;

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(policy.inspectZipArchive).toHaveBeenCalledTimes(1);
    });

    it('falls through to unzipSync when the preflight inspection fails on a malformed ZIP', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      const policy = createMockImportPolicy({ inspectThrows: new Error('invalid central directory') });
      global.window.ExeImportPolicy = policy;
      global.window.fflate = {
        unzipSync: () => {
          throw new Error('unexpected end of data');
        },
      };

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ZIP file');
      expect(policy.inspectZipArchive).toHaveBeenCalledTimes(1);
    });

    it('honours the shared tier compressed-file cap end to end', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: {
          maxFileBytes: 1 * 1024 * 1024,
          maxTotalBytes: 200 * 1024 * 1024,
          maxEntryBytes: 200 * 1024 * 1024,
          maxEntries: 10000,
        },
      });

      const file = {
        name: 'tier-limited.idevice',
        size: 2 * 1024 * 1024,
        arrayBuffer: vi.fn(),
      };

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum allowed is 1 MB');
      expect(file.arrayBuffer).not.toHaveBeenCalled();
    });

    it('rejects a ZIP whose decompressed contents exceed the maximum size', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      global.window.fflate = {
        unzipSync: () => ({
          'content.xml': new TextEncoder().encode(SAMPLE_COMPONENT_XML),
          'huge.bin': { byteLength: 201 * 1024 * 1024 },
        }),
      };

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('uncompressed');
    });

    it('rejects a ZIP whose declared uncompressed size exceeds the limit before inflating it', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      const entries = [
        { name: 'content.xml', originalSize: 1024, data: new TextEncoder().encode(SAMPLE_COMPONENT_XML) },
        { name: 'huge.bin', originalSize: 201 * 1024 * 1024, data: { byteLength: 0 } },
      ];
      const inflated = [];
      global.window.fflate = {
        unzipSync: (data, options) => {
          const zip = {};
          for (const entry of entries) {
            const accepted = !options || typeof options.filter !== 'function' || options.filter(entry);
            if (accepted) {
              inflated.push(entry.name);
              zip[entry.name] = entry.data;
            }
          }
          return zip;
        },
      };

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('uncompressed');
      expect(inflated).toEqual(['content.xml']);
    });

    it('rejects an archive with too many entries in degraded mode (review #2474, point 6)', async () => {
      global.window.ExeImportPolicy = undefined;

      const entries = [
        {
          name: 'content.xml',
          originalSize: 1,
          data: new TextEncoder().encode(SAMPLE_COMPONENT_XML),
        },
      ];
      for (let i = 0; i < 10000; i++) {
        entries.push({ name: `tiny-${i}.txt`, originalSize: 1, data: new Uint8Array([1]) });
      }

      const fflate = createFaithfulFflate(entries);
      global.window.fflate = { unzipSync: fflate.unzipSync };

      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'bomb.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('too many entries');
      expect(fflate.inflated).toHaveLength(10000);
      expect(fflate.inflated[0]).toBe('content.xml');
      expect(fflate.inflated).not.toContain('tiny-9999.txt');

      const blockMap = docManager.getNavigation().get(0).get('blocks').get(0);
      expect(blockMap.get('components')).toBeUndefined();
    });

    it('imports successfully when the archive is within maxEntries in degraded mode', async () => {
      global.window.ExeImportPolicy = undefined;

      const fflate = createFaithfulFflate([
        {
          name: 'content.xml',
          originalSize: 1,
          data: new TextEncoder().encode(SAMPLE_COMPONENT_XML),
        },
        { name: 'asset.png', originalSize: 1, data: new Uint8Array([1]) },
      ]);
      global.window.fflate = { unzipSync: fflate.unzipSync };

      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'ok.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(fflate.inflated).toEqual(['content.xml', 'asset.png']);
      const blockMap = docManager.getNavigation().get(0).get('blocks').get(0);
      expect(blockMap.get('components').length).toBe(1);
    });

    it('rejects via the filter when the shared tier lowers maxEntries', async () => {
      global.window.ExeImportPolicy = createMockImportPolicy({
        componentLimits: {
          maxFileBytes: 50 * 1024 * 1024,
          maxTotalBytes: 200 * 1024 * 1024,
          maxEntryBytes: 200 * 1024 * 1024,
          maxEntries: 2,
        },
      });

      const fflate = createFaithfulFflate([
        {
          name: 'content.xml',
          originalSize: 1,
          data: new TextEncoder().encode(SAMPLE_COMPONENT_XML),
        },
        { name: 'a.txt', originalSize: 1, data: new Uint8Array([1]) },
        { name: 'b.txt', originalSize: 1, data: new Uint8Array([1]) },
      ]);
      global.window.fflate = { unzipSync: fflate.unzipSync };

      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'too-many.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('too many entries');
      expect(fflate.inflated).toEqual(['content.xml', 'a.txt']);
    });

    it('appends the parsed component to the target block', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(result.blockId).toBe('block-1');
      expect(result.componentIds).toHaveLength(1);

      const pageMap = docManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const components = blockMap.get('components');
      expect(components.length).toBe(1);
      const compMap = components.get(0);
      expect(compMap.get('ideviceType')).toBe('text');
      expect(compMap.get('order')).toBe(0);
      expect(compMap.get('id')).not.toBe('idevice-original-456');
      expect(compMap.get('id')).toMatch(/^idevice-/);
    });

    it('imports a .idevice into an existing block through the full happy path (else of !blocksArray and !inserted)', async () => {
      // Cubre las ramas "else" de `if (!blocksArray)` y `if (!inserted)`:
      // el bloque se encuentra, la transacción se ejecuta y `inserted` queda
      // en true, así que se llega al return de éxito.
      const docManager = createManagerWithBlock();
      global.window.fflate = createMockFflate(SAMPLE_COMPONENT_XML);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(result.blockId).toBe('block-1');
      const blockMap = docManager.getNavigation().get(0).get('blocks').get(0);
      expect(blockMap.get('components').length).toBe(1);
    });

    it('generates fresh component IDs distinct from the original', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.componentIds[0]).not.toBe('idevice-original-456');
      expect(result.componentIds[0]).toMatch(/^idevice-/);
    });

    it('rewrites embedded ideviceId in jsonProperties when component id is regenerated (#1786)', async () => {
      const COMPONENT_WITH_EMBEDDED_ID = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-orig-1</odeBlockId>
    <blockName>Embedded id</blockName>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>idevice-orig-1</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;hi&lt;/p&gt;</htmlView>
        <jsonProperties>{"ideviceId":"idevice-orig-1","textTextarea":"&lt;p&gt;hi&lt;/p&gt;"}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createManagerWithBlock();
      global.window.fflate = createMockFflate(COMPONENT_WITH_EMBEDDED_ID);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');
      expect(result.success).toBe(true);

      const pageMap = docManager.getNavigation().get(0);
      const blockMap = pageMap.get('blocks').get(0);
      const compMap = blockMap.get('components').get(0);
      const newCompId = compMap.get('id');
      const parsed = JSON.parse(compMap.get('jsonProperties'));

      expect(newCompId).not.toBe('idevice-orig-1');
      expect(parsed.ideviceId).toBe(newCompId);
    });

    it('appends after existing components and preserves their order', async () => {
      const docManager = createManagerWithBlock();
      const Y = docManager._Y;
      const existing = new Y.Map();
      existing.set('id', 'existing-1');
      existing.set('order', 0);
      const existingComp = new Y.Array();
      existingComp.push([existing]);
      docManager.getNavigation().get(0).get('blocks').get(0).set('components', existingComp);

      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      const components = docManager.getNavigation().get(0).get('blocks').get(0).get('components');
      expect(components.length).toBe(2);
      expect(components.get(0).get('id')).toBe('existing-1');
      expect(components.get(1).get('order')).toBe(1);
    });

    it('finds the target block when it is not the first in the array', async () => {
      const Y = createMockY();
      const navigation = new Y.Array();
      const pageMap = new Y.Map();
      pageMap.set('id', 'page-1');
      pageMap.set('pageId', 'page-1');
      pageMap.set('blocks', new Y.Array());

      const block1 = new Y.Map();
      block1.set('blockId', 'block-other');
      block1.set('id', 'block-other');
      pageMap.get('blocks').push([block1]);

      const block2 = new Y.Map();
      block2.set('blockId', 'block-target');
      block2.set('id', 'block-target');
      pageMap.get('blocks').push([block2]);

      navigation.push([pageMap]);

      const mockDoc = { clientID: 'test', transact: vi.fn((fn) => fn()) };
      const docManager = {
        getDoc: () => mockDoc,
        getNavigation: () => navigation,
      };

      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-target');

      expect(result.success).toBe(true);
      expect(result.blockId).toBe('block-target');
    });

    it('returns error when the target block is not in the page', async () => {
      const docManager = createManagerWithBlock('page-1', 'block-other');
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-missing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error when the target page does not exist', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'nonexistent-page', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target page not found');
    });

    it('returns error when the component file has no components', async () => {
      const XML_WITH_NO_COMPONENTS = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeComponentsResources</key><value>true</value></odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-empty</odeBlockId>
    <blockName>Empty</blockName>
    <odeComponents></odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

      const docManager = createManagerWithBlock();
      global.window.fflate = createMockFflate(XML_WITH_NO_COMPONENTS);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No iDevice');
    });

    it('returns error for missing content.xml marker', async () => {
      global.window.fflate = createMockFflate(INVALID_COMPONENT_XML);
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('odeComponentsResources');
    });

    it('extracts assets from the zip when an asset manager is present', async () => {
      const docManager = createManagerWithBlock();
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(assetManager.extractAssetsFromZip).toHaveBeenCalled();
    });

    it('returns error when fflate is not loaded', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());

      global.window.fflate = null;

      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');
      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('fflate library not loaded');
    });

    const wrapComponentsXml = (componentsXml) => `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeComponentsResources</key><value>true</value></odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-orig</odeBlockId>
    <blockName>Wrapper</blockName>
    <odeComponents>${componentsXml}</odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;

    const getTargetBlock = (docManager) =>
      docManager.getNavigation().get(0).get('blocks').get(0);

    it('accepts the .idevice extension case-insensitively', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'TEST.IDEVICE');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
    });

    it('returns error when the ZIP cannot be unzipped', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      global.window.fflate = {
        unzipSync: vi.fn(() => {
          throw new Error('Invalid ZIP data');
        }),
      };
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ZIP file');
      expect(result.error).toContain('Invalid ZIP data');
    });

    it('returns the declared-size violation reported by the unzip filter', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      vi.spyOn(importer, 'createDeclaredSizeFilter').mockImplementation((violation) => () => {
        violation.error = 'declared size violation';
        return false;
      });
      global.window.fflate = {
        unzipSync: (data, options) => {
          options.filter({ name: 'content.xml', originalSize: 1 });
          return {};
        },
      };
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('declared size violation');
    });

    it('returns error when content.xml is missing from the ZIP', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      global.window.fflate = {
        unzipSync: vi.fn(() => ({ 'other.txt': new TextEncoder().encode('x') })),
      };
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No content.xml found in component file');
    });

    it('returns error for malformed XML', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      global.window.fflate = createMockFflate('<?xml version="1.0"?><unclosed>');
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/XML parsing error|missing odeComponentsResources marker/);
    });

    it('returns error when the XML has no odePagStructure', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      global.window.fflate = createMockFflate(`<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeComponentsResources</key><value>true</value></odeResource>
</odeResources>
<odePagStructures></odePagStructures>
</ode>`);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No iDevice found in component file');
    });

    it('works without an asset manager', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, null);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(getTargetBlock(docManager).get('components').length).toBe(1);
    });

    it('converts asset references using the extracted asset map', async () => {
      const docManager = createManagerWithBlock();
      const assetMap = new Map([['img/photo.png', 'uuid-1/photo.png']]);
      const assetManager = createMockAssetManager(assetMap);
      assetManager.convertContextPathToAssetRefs = vi.fn(() => '<p>converted</p>');
      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(assetManager.convertContextPathToAssetRefs).toHaveBeenCalled();
      const compMap = getTargetBlock(docManager).get('components').get(0);
      expect(compMap.get('htmlView')).toBe('<p>converted</p>');
    });

    it('returns error when the page has no blocks array', async () => {
      const docManager = createManagerWithBlock();
      const pageMap = docManager.getNavigation().get(0);
      pageMap._data.delete('blocks');
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target block not found');
    });

    it('creates the components array when the block does not have one', async () => {
      const docManager = createManagerWithBlock();
      const blockMap = getTargetBlock(docManager);
      expect(blockMap.get('components')).toBeUndefined();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(blockMap.get('components')).toBeDefined();
      expect(blockMap.get('components').length).toBe(1);
    });

    it('matches the target block by id when blockId is not set', async () => {
      const docManager = createManagerWithBlock();
      const blockMap = getTargetBlock(docManager);
      blockMap._data.delete('blockId');
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(blockMap.get('components').length).toBe(1);
    });

    it('matches the target block by id when id and blockId diverge (review #2474, point 7)', async () => {
      const docManager = createManagerWithBlock();
      const blockMap = getTargetBlock(docManager);
      blockMap.set('blockId', 'block-other');
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(result.blockId).toBe('block-1');
      expect(blockMap.get('components').length).toBe(1);
    });

    it('matches the target block by blockId when id and blockId diverge (review #2474, point 7)', async () => {
      const docManager = createManagerWithBlock();
      const blockMap = getTargetBlock(docManager);
      blockMap.set('id', 'block-other');
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(blockMap.get('components').length).toBe(1);
    });

    it('finds the target page by pageId when id is not set', async () => {
      const docManager = createManagerWithBlock();
      docManager.getNavigation().get(0)._data.delete('id');
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
    });

    it('imports several components with fresh unique IDs and consecutive order', async () => {
      const xml = wrapComponentsXml(`
      <odeComponent>
        <odeIdeviceId>idevice-a</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;A&lt;/p&gt;</htmlView>
        <jsonProperties>{"a":1}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
      <odeComponent>
        <odeIdeviceId>idevice-b</odeIdeviceId>
        <odeIdeviceTypeName>quiz</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;B&lt;/p&gt;</htmlView>
        <jsonProperties>{"b":2}</jsonProperties>
        <odeComponentsOrder>1</odeComponentsOrder>
      </odeComponent>`);
      const docManager = createManagerWithBlock();
      global.window.fflate = createMockFflate(xml);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      expect(result.componentIds).toHaveLength(2);
      expect(new Set(result.componentIds).size).toBe(2);
      expect(result.componentIds).not.toContain('idevice-a');
      expect(result.componentIds).not.toContain('idevice-b');

      const components = getTargetBlock(docManager).get('components');
      expect(components.length).toBe(2);
      expect(components.get(0).get('ideviceType')).toBe('text');
      expect(components.get(0).get('order')).toBe(0);
      expect(components.get(1).get('ideviceType')).toBe('quiz');
      expect(components.get(1).get('order')).toBe(1);
      expect(components.get(0).get('id')).toBe(result.componentIds[0]);
      expect(components.get(1).get('ideviceId')).toBe(result.componentIds[1]);
    });

    it('keeps an embedded ideviceId that does not match the original component id', async () => {
      const xml = wrapComponentsXml(`
      <odeComponent>
        <odeIdeviceId>idevice-orig</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <jsonProperties>{"ideviceId":"some-other-id"}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>`);
      const docManager = createManagerWithBlock();
      global.window.fflate = createMockFflate(xml);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      const compMap = getTargetBlock(docManager).get('components').get(0);
      expect(JSON.parse(compMap.get('jsonProperties')).ideviceId).toBe('some-other-id');
    });

    it('preserves component structure properties (issue #1991)', async () => {
      const xml = wrapComponentsXml(`
      <odeComponent>
        <odeIdeviceId>idevice-props</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
        <odeComponentsProperties>
          <odeComponentsProperty><key>visibility</key><value>false</value></odeComponentsProperty>
          <odeComponentsProperty><key>cssClass</key><value>my-class</value></odeComponentsProperty>
        </odeComponentsProperties>
      </odeComponent>`);
      const docManager = createManagerWithBlock();
      global.window.fflate = createMockFflate(xml);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      const propsMap = getTargetBlock(docManager).get('components').get(0).get('properties');
      expect(propsMap.get('visibility')).toBe('false');
      expect(propsMap.get('cssClass')).toBe('my-class');
    });

    it('runs the insertion inside a Yjs transaction with the doc clientID', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(docManager.getDoc().transact).toHaveBeenCalledTimes(1);
      expect(docManager.getDoc().transact.mock.calls[0][1]).toBe('test-client-id');
    });

    it('does not modify the block when the target block is missing', async () => {
      const docManager = createManagerWithBlock('page-1', 'block-other');
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      await importer.importIdeviceIntoBlock(file, 'page-1', 'block-missing');

      expect(getTargetBlock(docManager).get('components')).toBeUndefined();
    });

    it('stores no assets when the target page is missing', async () => {
      const docManager = createManagerWithBlock();
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'nonexistent-page', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target page not found');
      expect(assetManager.extractAssetsFromZip).not.toHaveBeenCalled();
    });

    it('stores no assets when the target block is missing', async () => {
      const docManager = createManagerWithBlock('page-1', 'block-other');
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-missing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target block not found');
      expect(assetManager.extractAssetsFromZip).not.toHaveBeenCalled();
    });

    it('stores no assets when the page has no blocks array', async () => {
      const docManager = createManagerWithBlock();
      docManager.getNavigation().get(0)._data.delete('blocks');
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target block not found');
      expect(assetManager.extractAssetsFromZip).not.toHaveBeenCalled();
    });

    it('stores no assets when the component file has no components', async () => {
      const docManager = createManagerWithBlock();
      const assetManager = createMockAssetManager();
      global.window.fflate = createMockFflate(`<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource><key>odeComponentsResources</key><value>true</value></odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>block-empty</odeBlockId>
    <blockName>Empty</blockName>
    <odeComponents></odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`);
      const importer = new ComponentImporter(docManager, assetManager);
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No iDevice found in component file');
      expect(assetManager.extractAssetsFromZip).not.toHaveBeenCalled();
    });

    it('does not reach the transaction when a component Y.Map fails to build', async () => {
      const xml = wrapComponentsXml(`
      <odeComponent>
        <odeIdeviceId>idevice-a</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;A&lt;/p&gt;</htmlView>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
      <odeComponent>
        <odeIdeviceId>idevice-b</odeIdeviceId>
        <odeIdeviceTypeName>quiz</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;B&lt;/p&gt;</htmlView>
        <odeComponentsOrder>1</odeComponentsOrder>
      </odeComponent>`);
      const docManager = createManagerWithBlock();
      global.window.fflate = createMockFflate(xml);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const realCreate = importer.createComponentYMap.bind(importer);
      let buildCalls = 0;
      vi.spyOn(importer, 'createComponentYMap').mockImplementation((compData) => {
        buildCalls += 1;
        if (buildCalls === 2) throw new Error('build failed');
        return realCreate(compData);
      });
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('build failed');
      expect(getTargetBlock(docManager).get('components')).toBeUndefined();
      expect(docManager.getDoc().transact).not.toHaveBeenCalled();
    });

    it('appends after the max existing order, not the array length', async () => {
      const docManager = createManagerWithBlock();
      const Y = docManager._Y;
      const existing = new Y.Array();
      for (const order of [0, 2]) {
        const comp = new Y.Map();
        comp.set('id', `existing-${order}`);
        comp.set('order', order);
        existing.push([comp]);
      }
      getTargetBlock(docManager).set('components', existing);

      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      const components = getTargetBlock(docManager).get('components');
      expect(components.length).toBe(3);
      expect(components.get(2).get('order')).toBe(3);
    });

    it('appends to a block whose existing orders are sparse but not sorted', async () => {
      const docManager = createManagerWithBlock();
      const Y = docManager._Y;
      const existing = new Y.Array();
      for (const order of [5, 2]) {
        const comp = new Y.Map();
        comp.set('id', `existing-${order}`);
        comp.set('order', order);
        existing.push([comp]);
      }
      getTargetBlock(docManager).set('components', existing);

      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      const components = getTargetBlock(docManager).get('components');
      expect(components.get(2).get('order')).toBe(6);
    });

    it('appends several components with consecutive orders after the max order', async () => {
      const docManager = createManagerWithBlock();
      const Y = docManager._Y;
      const existing = new Y.Array();
      const comp = new Y.Map();
      comp.set('id', 'existing-5');
      comp.set('order', 5);
      existing.push([comp]);
      getTargetBlock(docManager).set('components', existing);

      const xml = wrapComponentsXml(`
      <odeComponent>
        <odeIdeviceId>idevice-a</odeIdeviceId>
        <odeIdeviceTypeName>text</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;A&lt;/p&gt;</htmlView>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
      <odeComponent>
        <odeIdeviceId>idevice-b</odeIdeviceId>
        <odeIdeviceTypeName>quiz</odeIdeviceTypeName>
        <htmlView>&lt;p&gt;B&lt;/p&gt;</htmlView>
        <odeComponentsOrder>1</odeComponentsOrder>
      </odeComponent>`);
      global.window.fflate = createMockFflate(xml);
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(true);
      const components = getTargetBlock(docManager).get('components');
      expect(components.get(1).get('order')).toBe(6);
      expect(components.get(2).get('order')).toBe(7);
    });

    it('returns error when the block disappears between validation and insertion', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const blocksArray = docManager.getNavigation().get(0).get('blocks');
      const originalFind = importer.findBlockInArray.bind(importer);
      let findCalls = 0;
      vi.spyOn(importer, 'findBlockInArray').mockImplementation((array, id) => {
        findCalls += 1;
        if (findCalls === 2) {
          blocksArray._items.length = 0;
        }
        return originalFind(array, id);
      });
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target block not found');
    });

    it('returns "Target block not found" when the block is removed inside the transaction', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const blocksArray = docManager.getNavigation().get(0).get('blocks');
      const originalFind = importer.findBlockInArray.bind(importer);
      let findCalls = 0;
      vi.spyOn(importer, 'findBlockInArray').mockImplementation((array, id) => {
        findCalls += 1;
        if (findCalls === 2) {
          blocksArray._items.length = 0;
        }
        return originalFind(array, id);
      });
      const file = new File([new Uint8Array([1, 2, 3])], 'test.idevice');

      const result = await importer.importIdeviceIntoBlock(file, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target block not found');
    });

    it('handles unexpected exceptions gracefully', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badFile = {
        name: 'test.idevice',
        size: 10,
        arrayBuffer: () => Promise.reject(new Error('Read error')),
      };

      const result = await importer.importIdeviceIntoBlock(badFile, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('falls back to a generic error message when the exception has no message', async () => {
      const docManager = createManagerWithBlock();
      const importer = new ComponentImporter(docManager, createMockAssetManager());
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badFile = {
        name: 'test.idevice',
        size: 10,
        arrayBuffer: () => Promise.reject({}),
      };

      const result = await importer.importIdeviceIntoBlock(badFile, 'page-1', 'block-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Import failed');
      errorSpy.mockRestore();
    });
  });
});

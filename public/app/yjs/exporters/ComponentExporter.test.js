/**
 * ComponentExporter Vitest Tests
 *
 * Unit tests for the ComponentExporter class using Vitest framework.
 * Tests the component/iDevice export functionality including XML generation and ZIP creation.
 *
 */

/* eslint-disable no-undef */

// Test functions available globally from vitest setup

// Import BaseExporter first and make it globally available
const BaseExporter = require('./BaseExporter');
global.BaseExporter = BaseExporter;

// Now import ComponentExporter
const ComponentExporter = require('./ComponentExporter');

describe('ComponentExporter', () => {
  // Helper to create a mock document manager with configurable data
  const createMockDocManager = (overrides = {}) => {
    const metadata = new MockYMap({
      title: 'Test Project',
      author: 'Test Author',
      language: 'en',
      description: 'Test description',
      license: 'CC-BY-SA',
      createdAt: '2024-01-01T00:00:00Z',
      ...overrides.metadata,
    });

    const pages = overrides.pages || [
      createMockPage('page-1', 'Home Page', null, 0, [
        createMockBlock('block-1', 'Main Block', 0, [
          createMockComponent('comp-1', 'text', 0, '<p>Hello World</p>'),
        ]),
      ]),
    ];

    const navigation = new MockYArray(pages);

    return {
      getMetadata: mock(() => metadata),
      getNavigation: mock(() => navigation),
    };
  };

  // Helper to create a mock page
  const createMockPage = (id, name, parentId, order, blocks = []) => {
    return new MockYMap({
      id,
      pageId: id,
      pageName: name,
      parentId,
      order,
      blocks: new MockYArray(blocks),
    });
  };

  // Helper to create a mock block
  const createMockBlock = (id, name, order, components = []) => {
    return new MockYMap({
      id,
      blockId: id,
      blockName: name,
      order,
      components: new MockYArray(components),
    });
  };

  // Helper to create a mock component
  const createMockComponent = (id, type, order, htmlContent = '', props = {}) => {
    const data = {
      id,
      ideviceId: id,
      ideviceType: type,
      order,
      htmlContent,
    };
    // Add prop_ prefixed properties
    Object.entries(props).forEach(([key, value]) => {
      data[`prop_${key}`] = value;
    });
    return new MockYMap(data);
  };

  describe('constructor', () => {
    it('creates instance with document manager', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);

      expect(exporter.manager).toBe(mockDoc);
      expect(exporter.assetCache).toBeNull();
    });

    it('accepts optional asset cache manager', () => {
      const mockDoc = createMockDocManager();
      const mockAssetCache = createMockAssetCache();
      const exporter = new ComponentExporter(mockDoc, mockAssetCache);

      expect(exporter.assetCache).toBe(mockAssetCache);
    });
  });

  describe('getFileExtension', () => {
    it('returns .elp extension', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);

      expect(exporter.getFileExtension()).toBe('.elp');
    });
  });

  describe('getFileSuffix', () => {
    it('returns .idevice suffix', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);

      expect(exporter.getFileSuffix()).toBe('.idevice');
    });
  });

  describe('findComponent', () => {
    it('should find block by ID', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('block-1', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Content</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);

      const result = exporter.findComponent('block-1', null);

      expect(result.block).toBeTruthy();
      expect(result.block.id).toBe('block-1');
      expect(result.component).toBeNull();
      expect(result.pageId).toBe('page-1');
    });

    it('should find component by ID within block', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('block-1', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Content 1</p>'),
              createMockComponent('comp-2', 'image', 1, '<img src="test.png">'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);

      const result = exporter.findComponent('block-1', 'comp-2');

      expect(result.block).toBeTruthy();
      expect(result.component).toBeTruthy();
      expect(result.component.id).toBe('comp-2');
      expect(result.pageId).toBe('page-1');
    });

    it('should return null for non-existent block', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);

      const result = exporter.findComponent('nonexistent', null);

      expect(result.block).toBeNull();
      expect(result.component).toBeNull();
      expect(result.pageId).toBeNull();
    });

    it('should return null component for non-existent iDevice ID', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('block-1', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Content</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);

      const result = exporter.findComponent('block-1', 'nonexistent');

      expect(result.block).toBeTruthy();
      expect(result.component).toBeNull();
    });

    it('should treat "null" string as null ideviceId', () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('block-1', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Content</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);

      const result = exporter.findComponent('block-1', 'null');

      expect(result.block).toBeTruthy();
      expect(result.component).toBeNull();
    });
  });

  describe('generateComponentXml', () => {
    it('should generate valid XML for single iDevice', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);
      const block = { id: 'block-1', name: 'Test Block', components: [] };
      const component = {
        id: 'idevice-1',
        type: 'text',
        content: '<p>Hello</p>',
        properties: { title: 'Test' },
        order: 0,
      };

      const xml = exporter.generateComponentXml(block, component, 'page-1');

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">');
      expect(xml).toContain('<key>odeComponentsResources</key>');
      expect(xml).toContain('<value>true</value>');
      expect(xml).toContain('<odeIdeviceId>idevice-1</odeIdeviceId>');
      expect(xml).toContain('<odeIdeviceTypeName>text</odeIdeviceTypeName>');
      expect(xml).toContain('<htmlView><![CDATA[<p>Hello</p>]]></htmlView>');
    });

    it('should generate XML for entire block when no component specified', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);
      const block = {
        id: 'block-1',
        name: 'Test Block',
        components: [
          { id: 'comp-1', type: 'text', content: '<p>First</p>', order: 0 },
          { id: 'comp-2', type: 'image', content: '<img src="img.png">', order: 1 },
        ],
      };

      const xml = exporter.generateComponentXml(block, null, 'page-1');

      expect(xml).toContain('<odeIdeviceId>comp-1</odeIdeviceId>');
      expect(xml).toContain('<odeIdeviceId>comp-2</odeIdeviceId>');
      expect(xml).toContain('<![CDATA[<p>First</p>]]>');
      expect(xml).toContain('<![CDATA[<img src="img.png">]]>');
    });

    it('should escape XML special characters in block name', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);
      const block = { id: 'block-1', name: 'Test & Block <>', components: [] };
      const component = { id: 'idevice-1', type: 'text', content: '', order: 0 };

      const xml = exporter.generateComponentXml(block, component, 'page-1');

      expect(xml).toContain('Test &amp; Block &lt;&gt;');
    });

    it('should include odeBlockId in XML', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);
      const block = { id: 'my-block-123', name: 'Block', components: [] };
      const component = { id: 'comp-1', type: 'text', content: '', order: 0 };

      const xml = exporter.generateComponentXml(block, component, 'page-1');

      expect(xml).toContain('<odeBlockId>my-block-123</odeBlockId>');
    });

    it('should include odePageId in component XML', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);
      const block = { id: 'block-1', name: 'Block', components: [] };
      const component = { id: 'comp-1', type: 'text', content: '', order: 0 };

      const xml = exporter.generateComponentXml(block, component, 'my-page-456');

      expect(xml).toContain('<odePageId>my-page-456</odePageId>');
    });

    it('should include JSON properties in component XML', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);
      const block = { id: 'block-1', name: 'Block', components: [] };
      const component = {
        id: 'comp-1',
        type: 'text',
        content: '',
        properties: { color: 'red', size: 12 },
        order: 0,
      };

      const xml = exporter.generateComponentXml(block, component, 'page-1');

      expect(xml).toContain('<jsonProperties>');
      expect(xml).toContain('"color":"red"');
      expect(xml).toContain('"size":12');
    });

    it('should use default type when ideviceType is missing', () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);
      const block = { id: 'block-1', name: 'Block', components: [] };
      const component = { id: 'comp-1', content: '', order: 0 }; // No type

      const xml = exporter.generateComponentXml(block, component, 'page-1');

      expect(xml).toContain('<odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>');
    });
  });

  describe('addComponentAssetsToZip', () => {
    // Use hex UUIDs that match the regex pattern in the code
    const assetId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const assetId2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    const assetId3 = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

    it('should add only assets referenced in component content', async () => {
      const mockDoc = createMockDocManager();
      const mockZip = { file: vi.fn() };
      const mockAssetManager = createMockAssetManager([
        { id: assetId1, blob: new Blob(['test']), filename: 'image.png' },
        { id: assetId2, blob: new Blob(['test2']), filename: 'unused.png' },
      ]);

      const exporter = new ComponentExporter(mockDoc);
      exporter.setAssetManager(mockAssetManager);

      const block = { id: 'block-1', components: [] };
      const component = {
        id: 'idevice-1',
        content: `<img src="asset://${assetId1}/image.png">`,
      };

      await exporter.addComponentAssetsToZip(mockZip, block, component);

      expect(mockZip.file).toHaveBeenCalledTimes(1);
      expect(mockZip.file).toHaveBeenCalledWith(expect.stringContaining(assetId1), expect.any(Blob));
    });

    it('should handle missing assetManager gracefully', async () => {
      const mockDoc = createMockDocManager();
      const mockZip = { file: vi.fn() };
      const exporter = new ComponentExporter(mockDoc);
      // No setAssetManager called

      await expect(
        exporter.addComponentAssetsToZip(mockZip, { components: [] }, null)
      ).resolves.not.toThrow();

      expect(mockZip.file).not.toHaveBeenCalled();
    });

    it('should add multiple assets from component content', async () => {
      const mockDoc = createMockDocManager();
      const mockZip = { file: vi.fn() };
      const mockAssetManager = createMockAssetManager([
        { id: assetId1, blob: new Blob(['img1']), filename: 'image1.png' },
        { id: assetId2, blob: new Blob(['img2']), filename: 'image2.png' },
        { id: assetId3, blob: new Blob(['unused']), filename: 'unused.png' },
      ]);

      const exporter = new ComponentExporter(mockDoc);
      exporter.setAssetManager(mockAssetManager);

      const block = { id: 'block-1', components: [] };
      const component = {
        id: 'idevice-1',
        content: `<img src="asset://${assetId1}"><img src="asset://${assetId2}">`,
      };

      await exporter.addComponentAssetsToZip(mockZip, block, component);

      expect(mockZip.file).toHaveBeenCalledTimes(2);
    });

    it('should add assets from all components when exporting entire block', async () => {
      const mockDoc = createMockDocManager();
      const mockZip = { file: vi.fn() };
      const mockAssetManager = createMockAssetManager([
        { id: assetId1, blob: new Blob(['img1']), filename: 'image1.png' },
        { id: assetId2, blob: new Blob(['img2']), filename: 'image2.png' },
      ]);

      const exporter = new ComponentExporter(mockDoc);
      exporter.setAssetManager(mockAssetManager);

      const block = {
        id: 'block-1',
        components: [
          { id: 'comp-1', content: `<img src="asset://${assetId1}">` },
          { id: 'comp-2', content: `<img src="asset://${assetId2}">` },
        ],
      };

      await exporter.addComponentAssetsToZip(mockZip, block, null);

      expect(mockZip.file).toHaveBeenCalledTimes(2);
    });
  });

  describe('exportComponent', () => {
    it('should export iDevice and trigger download', async () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('block-1', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Hello</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);

      // Mock downloadBlob to avoid DOM manipulation
      exporter.downloadBlob = vi.fn();

      const result = await exporter.exportComponent('block-1', 'comp-1');

      expect(result.success).toBe(true);
      expect(result.filename).toBe('comp-1.idevice');
      expect(exporter.downloadBlob).toHaveBeenCalled();
    });

    it('should export entire block when ideviceId is null', async () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('my-block', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Hello</p>'),
              createMockComponent('comp-2', 'image', 1, '<img src="test.png">'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);
      exporter.downloadBlob = vi.fn();

      const result = await exporter.exportComponent('my-block', null);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('my-block.block');
    });

    it('should export entire block when ideviceId is "null" string', async () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('my-block', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Hello</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);
      exporter.downloadBlob = vi.fn();

      const result = await exporter.exportComponent('my-block', 'null');

      expect(result.success).toBe(true);
      expect(result.filename).toBe('my-block.block');
    });

    it('should return error when block not found', async () => {
      const mockDoc = createMockDocManager();
      const exporter = new ComponentExporter(mockDoc);

      const result = await exporter.exportComponent('nonexistent', null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Block not found');
    });

    it('should return error when component not found', async () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('block-1', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Hello</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);

      const result = await exporter.exportComponent('block-1', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Component not found');
    });

    it('should include content.xml in the generated ZIP', async () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page-1', 'Page 1', null, 0, [
            createMockBlock('block-1', 'Block 1', 0, [
              createMockComponent('comp-1', 'text', 0, '<p>Hello</p>'),
            ]),
          ]),
        ],
      });
      const exporter = new ComponentExporter(mockDoc);

      let capturedZip = null;
      exporter.createZip = vi.fn(() => {
        const zip = new MockJSZip();
        capturedZip = zip;
        return zip;
      });
      exporter.downloadBlob = vi.fn();

      await exporter.exportComponent('block-1', 'comp-1');

      expect(capturedZip._files['content.xml']).toBeTruthy();
    });
  });

  describe('integration: full export cycle', () => {
    it('generates complete component export structure', async () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('home', 'Home', null, 0, [
            createMockBlock('intro', 'Introduction', 0, [
              createMockComponent('text1', 'FreeTextIdevice', 0, '<h1>Welcome</h1>', { title: 'Welcome' }),
            ]),
          ]),
        ],
      });

      const exporter = new ComponentExporter(mockDoc);
      const { block, component, pageId } = exporter.findComponent('intro', 'text1');
      const xml = exporter.generateComponentXml(block, component, pageId);

      // Verify structure completeness
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');

      // Resource marker (stored as key/value pair, not as element name)
      expect(xml).toContain('<key>odeComponentsResources</key>');
      expect(xml).toContain('<value>true</value>');

      // Block structure
      expect(xml).toContain('<odeBlockId>intro</odeBlockId>');
      expect(xml).toContain('<blockName>Introduction</blockName>');

      // Component structure
      expect(xml).toContain('<odeIdeviceId>text1</odeIdeviceId>');
      expect(xml).toContain('<odePageId>home</odePageId>');
      expect(xml).toContain('<odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>');

      // Content
      expect(xml).toContain('<![CDATA[<h1>Welcome</h1>]]>');
    });

    it('generates valid XML compatible with legacy import', async () => {
      const mockDoc = createMockDocManager({
        pages: [
          createMockPage('page1', 'Test Page', null, 0, [
            createMockBlock('block1', 'Test Block', 0, [
              createMockComponent('comp1', 'text', 0, '<p>Test content</p>'),
            ]),
          ]),
        ],
      });

      const exporter = new ComponentExporter(mockDoc);
      const { block, component, pageId } = exporter.findComponent('block1', 'comp1');
      const xml = exporter.generateComponentXml(block, component, pageId);

      // Required element tags for legacy import compatibility
      const requiredElements = [
        'odeResources',
        'odeResource',
        'key',
        'value',
        'odePagStructures',
        'odePagStructure',
        'odeBlockId',
        'blockName',
        'odeComponents',
        'odeComponent',
        'odeIdeviceId',
        'odePageId',
        'odeIdeviceTypeName',
        'htmlView',
        'jsonProperties',
        'odeComponentsOrder',
      ];

      for (const element of requiredElements) {
        expect(xml).toContain(`<${element}`);
      }

      // odeComponentsResources is stored as content in <key>, not as a tag
      expect(xml).toContain('<key>odeComponentsResources</key>');
    });
  });
});

// Mock class for JSZip when needed
class MockJSZip {
  constructor() {
    this._files = {};
    this._folders = {};
  }

  file(name, content) {
    if (content === undefined) {
      return this._files[name] || null;
    }
    this._files[name] = {
      name,
      content,
      async: (type) => {
        if (type === 'string') return String(content);
        return content;
      },
    };
    return this;
  }

  folder(name) {
    if (!this._folders[name]) {
      this._folders[name] = new MockJSZip();
    }
    return this._folders[name];
  }

  async generateAsync(options = {}) {
    return new Blob([JSON.stringify({ files: Object.keys(this._files) })], {
      type: 'application/zip',
    });
  }
}

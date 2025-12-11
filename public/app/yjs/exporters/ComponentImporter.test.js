/**
 * ComponentImporter Vitest Tests
 *
 * Unit tests for the ComponentImporter class using Vitest framework.
 * Tests the component/iDevice import functionality including XML parsing and Yjs insertion.
 */

/* eslint-disable no-undef */

// Import ComponentImporter
const ComponentImporter = require('./ComponentImporter');

describe('ComponentImporter', () => {
  // Helper to create a mock document manager
  const createMockDocManager = (pages = []) => {
    const navigation = new MockYArray(pages.length > 0 ? pages : [
      new MockYMap({
        id: 'page-test',
        pageId: 'page-test',
        blocks: new MockYArray([]),
      }),
    ]);

    const doc = {
      clientID: 12345,
      transact: (fn) => fn(),
    };

    return {
      getNavigation: mock(() => navigation),
      getDoc: mock(() => doc),
    };
  };

  // Helper to create a mock asset manager
  const createMockAssetManager = () => {
    const assets = new Map();
    return {
      insertAsset: mock(async (file, metadata) => {
        const id = `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        assets.set(id, { file, metadata });
        return `asset://${id}`;
      }),
      getAssets: () => assets,
    };
  };

  // Helper to create valid component XML
  const createValidComponentXml = (options = {}) => {
    const {
      blockId = 'block-1234',
      blockName = 'Example Block',
      components = [
        {
          id: 'idevice-5678',
          type: 'FreeTextIdevice',
          content: '<p>This is sample content</p>',
          properties: { title: 'Sample Title', showTitle: true },
          order: 0,
          pageId: 'page-9012',
        },
      ],
    } = options;

    const componentsXml = components
      .map(
        (c) => `
      <odeComponent>
        <odeIdeviceId>${c.id}</odeIdeviceId>
        <odePageId>${c.pageId || 'page-1'}</odePageId>
        <odeBlockId>${blockId}</odeBlockId>
        <odeIdeviceTypeName>${c.type}</odeIdeviceTypeName>
        <ideviceSrcType>json</ideviceSrcType>
        <userIdevice>0</userIdevice>
        <htmlView><![CDATA[${c.content}]]></htmlView>
        <jsonProperties><![CDATA[${JSON.stringify(c.properties || {})}]]></jsonProperties>
        <odeComponentsOrder>${c.order || 0}</odeComponentsOrder>
        <odeComponentsProperties></odeComponentsProperties>
      </odeComponent>`,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources>
  <odeResource>
    <key>odeComponentsResources</key>
    <value>true</value>
  </odeResource>
</odeResources>
<odePagStructures>
  <odePagStructure>
    <odeBlockId>${blockId}</odeBlockId>
    <blockName>${blockName}</blockName>
    <iconName></iconName>
    <odePagStructureOrder>0</odePagStructureOrder>
    <odePagStructureProperties>{}</odePagStructureProperties>
    <odeComponents>${componentsXml}
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;
  };

  // Helper to create invalid XML (missing marker)
  const createInvalidXml = () => `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<odeResources></odeResources>
</ode>`;

  describe('constructor', () => {
    it('should create an instance with document manager', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      expect(importer.manager).toBe(manager);
      expect(importer.assetManager).toBeNull();
    });

    it('should create an instance with document manager and asset manager', () => {
      const manager = createMockDocManager();
      const assetManager = createMockAssetManager();
      const importer = new ComponentImporter(manager, assetManager);

      expect(importer.manager).toBe(manager);
      expect(importer.assetManager).toBe(assetManager);
    });
  });

  describe('validateComponentFile', () => {
    it('should return true for valid component XML with odeComponentsResources marker', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      const xml = createValidComponentXml();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const result = importer.validateComponentFile(xmlDoc);
      expect(result).toBe(true);
    });

    it('should return false for XML without odeComponentsResources marker', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      const xml = createInvalidXml();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const result = importer.validateComponentFile(xmlDoc);
      expect(result).toBe(false);
    });
  });

  describe('parseBlocks', () => {
    it('should parse blocks from valid XML', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      const xml = createValidComponentXml({
        blockId: 'block-123',
        blockName: 'Test Block',
        components: [
          { id: 'comp-1', type: 'FreeTextIdevice', content: '<p>Test</p>', order: 0 },
        ],
      });
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const blocks = importer.parseBlocks(xmlDoc);

      expect(blocks.length).toBe(1);
      expect(blocks[0].blockName).toBe('Test Block');
      expect(blocks[0].components.length).toBe(1);
      expect(blocks[0].components[0].ideviceType).toBe('FreeTextIdevice');
    });

    it('should handle multiple components in a block', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      // Use plain XML without CDATA for JSDOM compatibility
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <blockName>Multi Block</blockName>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>comp-1</odeIdeviceId>
        <odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>
        <htmlView>First</htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
      <odeComponent>
        <odeIdeviceId>comp-2</odeIdeviceId>
        <odeIdeviceTypeName>ImageIdevice</odeIdeviceTypeName>
        <htmlView>Second</htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>1</odeComponentsOrder>
      </odeComponent>
      <odeComponent>
        <odeIdeviceId>comp-3</odeIdeviceId>
        <odeIdeviceTypeName>QuestionIdevice</odeIdeviceTypeName>
        <htmlView>Third</htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>2</odeComponentsOrder>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const blocks = importer.parseBlocks(xmlDoc);

      expect(blocks[0].components.length).toBe(3);
    });

    it('should sort components by order', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      // Use plain XML without CDATA for JSDOM compatibility
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <blockName>Sort Test Block</blockName>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>comp-3</odeIdeviceId>
        <odeIdeviceTypeName>T</odeIdeviceTypeName>
        <htmlView></htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>2</odeComponentsOrder>
      </odeComponent>
      <odeComponent>
        <odeIdeviceId>comp-1</odeIdeviceId>
        <odeIdeviceTypeName>T</odeIdeviceTypeName>
        <htmlView></htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
      <odeComponent>
        <odeIdeviceId>comp-2</odeIdeviceId>
        <odeIdeviceTypeName>T</odeIdeviceTypeName>
        <htmlView></htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>1</odeComponentsOrder>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const blocks = importer.parseBlocks(xmlDoc);

      // Should be sorted by order
      expect(blocks[0].components[0].order).toBe(0);
      expect(blocks[0].components[1].order).toBe(1);
      expect(blocks[0].components[2].order).toBe(2);
    });
  });

  describe('parseComponent', () => {
    it('should parse JSON properties from plain text (non-CDATA)', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      // Use plain text instead of CDATA for JSDOM compatibility
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <blockName>Block</blockName>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>comp-1</odeIdeviceId>
        <odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>
        <htmlView>test content</htmlView>
        <jsonProperties>{"title":"Test Title","showTitle":true,"count":42}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const blocks = importer.parseBlocks(xmlDoc);
      const props = blocks[0].components[0].jsonProperties;

      expect(props.title).toBe('Test Title');
      expect(props.showTitle).toBe(true);
      expect(props.count).toBe(42);
    });

    it('should handle plain text HTML content', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      // Use plain text content (no encoding) for JSDOM compatibility
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
    <blockName>Block</blockName>
    <odeComponents>
      <odeComponent>
        <odeIdeviceId>comp-1</odeIdeviceId>
        <odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>
        <htmlView>Test plain content</htmlView>
        <jsonProperties>{}</jsonProperties>
        <odeComponentsOrder>0</odeComponentsOrder>
      </odeComponent>
    </odeComponents>
  </odePagStructure>
</odePagStructures>
</ode>`;
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      const blocks = importer.parseBlocks(xmlDoc);

      expect(blocks[0].components[0].htmlView).toBe('Test plain content');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs with prefix', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      const id1 = importer.generateId('block');
      const id2 = importer.generateId('block');

      expect(id1.startsWith('block-')).toBe(true);
      expect(id2.startsWith('block-')).toBe(true);
      expect(id1).not.toBe(id2);
    });

    it('should support different prefixes', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      const blockId = importer.generateId('block');
      const ideviceId = importer.generateId('idevice');

      expect(blockId.startsWith('block-')).toBe(true);
      expect(ideviceId.startsWith('idevice-')).toBe(true);
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types for image files', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      expect(importer.getMimeType('image.png')).toBe('image/png');
      expect(importer.getMimeType('image.jpg')).toBe('image/jpeg');
      expect(importer.getMimeType('image.jpeg')).toBe('image/jpeg');
      expect(importer.getMimeType('image.gif')).toBe('image/gif');
      expect(importer.getMimeType('image.svg')).toBe('image/svg+xml');
      expect(importer.getMimeType('image.webp')).toBe('image/webp');
    });

    it('should return correct MIME types for media files', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      expect(importer.getMimeType('video.mp4')).toBe('video/mp4');
      expect(importer.getMimeType('video.webm')).toBe('video/webm');
      expect(importer.getMimeType('audio.mp3')).toBe('audio/mpeg');
      expect(importer.getMimeType('audio.ogg')).toBe('audio/ogg');
      expect(importer.getMimeType('audio.wav')).toBe('audio/wav');
    });

    it('should return correct MIME types for document files', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      expect(importer.getMimeType('document.pdf')).toBe('application/pdf');
      expect(importer.getMimeType('archive.zip')).toBe('application/zip');
      expect(importer.getMimeType('data.json')).toBe('application/json');
    });

    it('should return application/octet-stream for unknown extensions', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      expect(importer.getMimeType('file.xyz')).toBe('application/octet-stream');
      expect(importer.getMimeType('file.unknown')).toBe('application/octet-stream');
    });
  });

  describe('decodeHtmlContent', () => {
    it('should decode HTML entities', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      expect(importer.decodeHtmlContent('&lt;p&gt;Test&lt;/p&gt;')).toBe('<p>Test</p>');
      expect(importer.decodeHtmlContent('&amp;')).toBe('&');
      expect(importer.decodeHtmlContent('&quot;')).toBe('"');
    });

    it('should handle empty input', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      expect(importer.decodeHtmlContent('')).toBe('');
      expect(importer.decodeHtmlContent(null)).toBe('');
      expect(importer.decodeHtmlContent(undefined)).toBe('');
    });
  });

  describe('getTextContent', () => {
    it('should get text content from child element', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      const parser = new DOMParser();
      const doc = parser.parseFromString('<root><child>Test Value</child></root>', 'text/xml');
      const root = doc.documentElement;

      expect(importer.getTextContent(root, 'child')).toBe('Test Value');
    });

    it('should return null for missing element', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      const parser = new DOMParser();
      const doc = parser.parseFromString('<root></root>', 'text/xml');
      const root = doc.documentElement;

      expect(importer.getTextContent(root, 'missing')).toBeNull();
    });
  });

  describe('convertAssetPaths', () => {
    it('should convert asset paths to asset:// URLs', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);

      // Simulate imported assets
      importer.assetMap = new Map([
        ['content/resources/asset-1/image.png', 'uuid-123'],
      ]);

      const html = '<img src="content/resources/asset-1/image.png">';
      const result = importer.convertAssetPaths(html);

      expect(result).toContain('asset://uuid-123');
    });

    it('should return original HTML when no assets mapped', () => {
      const manager = createMockDocManager();
      const importer = new ComponentImporter(manager);
      importer.assetMap = new Map();

      const html = '<img src="image.png">';
      const result = importer.convertAssetPaths(html);

      expect(result).toBe(html);
    });
  });
});

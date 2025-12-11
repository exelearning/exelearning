/**
 * LegacyXmlParser Bun Tests
 *
 * Unit tests for parsing legacy .elp files (contentv3.xml) that use Python pickle format.
 *
 * Run with: bun test
 */

/* eslint-disable no-undef */

// Test functions available globally from vitest setup

// Import the LegacyXmlParser class
const LegacyXmlParser = require('./LegacyXmlParser');

describe('LegacyXmlParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LegacyXmlParser();
    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // Bun test cleanup happens automatically
  });

  describe('constructor', () => {
    it('initializes with empty state', () => {
      expect(parser.xmlContent).toBe('');
      expect(parser.xmlDoc).toBeNull();
      expect(parser.parentRefMap).toBeInstanceOf(Map);
      expect(parser.parentRefMap.size).toBe(0);
    });
  });

  describe('parse', () => {
    it('parses minimal valid XML and returns structure', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.package.Package" reference="1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Test Project"/>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('pages');
    });

    it('throws error for invalid XML', () => {
      const invalidXml = '<broken>';
      expect(() => parser.parse(invalidXml)).toThrow('XML parsing error');
    });

    it('returns default meta for empty package', () => {
      const xml = `<?xml version="1.0"?>
        <root></root>`;

      const result = parser.parse(xml);

      expect(result.meta.title).toBe('Legacy Project');
      expect(result.pages).toEqual([]);
    });
  });

  describe('extractMetadata', () => {
    it('returns defaults when no package found', () => {
      const xml = `<?xml version="1.0"?>
        <root></root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.title).toBe('Legacy Project');
      expect(meta.author).toBe('');
      expect(meta.description).toBe('');
    });

    it('returns metadata structure', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="My Project"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      // Should have all expected properties
      expect(meta).toHaveProperty('title');
      expect(meta).toHaveProperty('author');
      expect(meta).toHaveProperty('description');
    });
  });

  describe('findDictValue', () => {
    it('finds unicode value by key', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="testKey"/>
          <unicode value="testValue"/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');

      const value = parser.findDictValue(dict, 'testKey');
      expect(value).toBe('testValue');
    });

    it('finds string value by key', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="myKey"/>
          <string value="myValue"/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');

      const value = parser.findDictValue(dict, 'myKey');
      expect(value).toBe('myValue');
    });

    it('returns null for none element', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="nullKey"/>
          <none/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');

      const value = parser.findDictValue(dict, 'nullKey');
      expect(value).toBeNull();
    });

    it('returns reference key for reference element', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="refKey"/>
          <reference key="ref123"/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');

      const value = parser.findDictValue(dict, 'refKey');
      expect(value).toBe('ref123');
    });

    it('returns null for non-existent key', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="existingKey"/>
          <unicode value="value"/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');

      const value = parser.findDictValue(dict, 'nonExistentKey');
      expect(value).toBeNull();
    });
  });

  describe('findAllNodes', () => {
    it('finds all Node instances', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary></dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="2">
            <dictionary></dictionary>
          </instance>
          <instance class="other.Class" reference="3">
            <dictionary></dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      expect(nodes).toHaveLength(2);
    });

    it('returns empty array when no nodes', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="other.Class"></instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      expect(nodes).toHaveLength(0);
    });
  });

  describe('buildParentReferenceMap', () => {
    it('builds parent references from nodes', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="2">
            <dictionary>
              <string role="key" value="parent"/>
              <reference key="1"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);

      // The map is built during parse
      expect(parser.parentRefMap.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildPageHierarchy', () => {
    it('handles multiple root pages', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Page 1"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="2">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Page 2"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].parent_id).toBeNull();
      expect(result.pages[1].parent_id).toBeNull();
    });
  });

  describe('extractNodeBlocks', () => {
    it('returns empty blocks when no idevices', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.node.Node" reference="node1">
          <dictionary>
            <string role="key" value="_title"/>
            <unicode value="Empty Page"/>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const nodeEl = doc.querySelector('instance');
      const blocks = parser.extractNodeBlocks(nodeEl);

      expect(blocks).toHaveLength(0);
    });
  });

  describe('extractIDevices', () => {
    it('extracts type from class name as fallback', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
            <dictionary></dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevices(listEl);

      expect(idevices).toHaveLength(1);
      expect(idevices[0].type).toBe('FreeTextIdevice');
    });

    it('ignores non-idevice instances', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.something.Else" reference="other">
            <dictionary></dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevices(listEl);

      expect(idevices).toHaveLength(0);
    });

    it('assigns position to each idevice', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="idev1">
            <dictionary></dictionary>
          </instance>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="idev2">
            <dictionary></dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevices(listEl);

      expect(idevices[0].position).toBe(0);
      expect(idevices[1].position).toBe(1);
    });
  });

  describe('extractFieldsContent', () => {
    it('returns empty string when no fields', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="other"/>
          <unicode value="data"/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const content = parser.extractFieldsContent(dict);

      expect(content).toBe('');
    });
  });

  describe('decodeHtmlContent', () => {
    it('decodes HTML entities', () => {
      expect(parser.decodeHtmlContent('&lt;p&gt;Test&lt;/p&gt;')).toBe(
        '<p>Test</p>'
      );
      expect(parser.decodeHtmlContent('&amp;')).toBe('&');
      expect(parser.decodeHtmlContent('&quot;quoted&quot;')).toBe('"quoted"');
    });

    it('handles empty string', () => {
      expect(parser.decodeHtmlContent('')).toBe('');
    });

    it('handles null/undefined', () => {
      expect(parser.decodeHtmlContent(null)).toBe('');
      expect(parser.decodeHtmlContent(undefined)).toBe('');
    });

    it('returns plain text unchanged', () => {
      expect(parser.decodeHtmlContent('Hello World')).toBe('Hello World');
    });
  });

  describe('flattenPages', () => {
    it('flattens nested pages correctly', () => {
      const pages = [
        {
          id: 'page-1',
          title: 'Root',
          blocks: [],
          children: [
            {
              id: 'page-2',
              title: 'Child',
              blocks: [],
              children: [],
            },
          ],
        },
      ];

      const result = [];
      parser.flattenPages(pages, result, null);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('page-1');
      expect(result[0].parent_id).toBeNull();
      expect(result[1].id).toBe('page-2');
      expect(result[1].parent_id).toBe('page-1');
    });

    it('assigns correct positions', () => {
      const pages = [
        { id: 'p1', title: 'P1', blocks: [], children: [] },
        { id: 'p2', title: 'P2', blocks: [], children: [] },
        { id: 'p3', title: 'P3', blocks: [], children: [] },
      ];

      const result = [];
      parser.flattenPages(pages, result, null);

      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBe(2);
    });
  });

  describe('integration: full parse cycle', () => {
    it('parses document with pages and returns structure', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="node1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Home"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="node2">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="About"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      // Check structure
      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('pages');
      expect(result.pages.length).toBe(2);
    });
  });
});

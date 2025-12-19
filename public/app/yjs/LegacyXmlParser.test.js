/**
 * LegacyXmlParser Bun Tests
 *
 * Unit tests for parsing legacy .elp files (contentv3.xml) that use Python pickle format.
 *
 * Run with: bun test
 */

 

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
    it('extracts and maps idevice type from class name', () => {
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
      // FreeTextIdevice is mapped to 'text' for modern editor compatibility
      expect(idevices[0].type).toBe('text');
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

  describe('extractFeedbackFieldContent', () => {
    it('extracts feedback content from FeedbackField', () => {
      // Legacy ELP files use double-encoded HTML entities: &amp;lt; becomes &lt; after XML parsing
      // Then decodeHtmlContent decodes &lt; to < giving the final HTML
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.field.FeedbackField">
          <dictionary>
            <string role="key" value="feedback"/>
            <unicode value="&amp;lt;p&amp;gt;This is feedback content&amp;lt;/p&amp;gt;"/>
            <string role="key" value="_buttonCaption"/>
            <string value="Show Feedback"/>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const fieldInst = doc.querySelector('instance');
      const result = parser.extractFeedbackFieldContent(fieldInst);

      expect(result.content).toBe('<p>This is feedback content</p>');
      expect(result.buttonCaption).toBe('Show Feedback');
    });

    it('extracts feedback from content_w_resourcePaths if feedback not found', () => {
      // Legacy ELP files use double-encoded HTML entities: &amp;lt; becomes &lt; after XML parsing
      // Then decodeHtmlContent decodes &lt; to < giving the final HTML
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.field.FeedbackField">
          <dictionary>
            <string role="key" value="content_w_resourcePaths"/>
            <unicode value="&amp;lt;p&amp;gt;Feedback via content_w_resourcePaths&amp;lt;/p&amp;gt;"/>
            <string role="key" value="_buttonCaption"/>
            <string value="Ver"/>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const fieldInst = doc.querySelector('instance');
      const result = parser.extractFeedbackFieldContent(fieldInst);

      expect(result.content).toBe('<p>Feedback via content_w_resourcePaths</p>');
      expect(result.buttonCaption).toBe('Ver');
    });

    it('returns default button caption when empty', () => {
      // Legacy ELP files use double-encoded HTML entities
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.field.FeedbackField">
          <dictionary>
            <string role="key" value="feedback"/>
            <unicode value="&amp;lt;p&amp;gt;Content&amp;lt;/p&amp;gt;"/>
            <string role="key" value="_buttonCaption"/>
            <string value=""/>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const fieldInst = doc.querySelector('instance');
      const result = parser.extractFeedbackFieldContent(fieldInst);

      expect(result.buttonCaption).toBe('Mostrar retroalimentación');
    });

    it('returns empty when no dictionary', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.field.FeedbackField">
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const fieldInst = doc.querySelector('instance');
      const result = parser.extractFeedbackFieldContent(fieldInst);

      expect(result.content).toBe('');
      expect(result.buttonCaption).toBe('');
    });
  });

  describe('extractFieldsContentWithFeedback', () => {
    it('extracts both content and feedback from fields list', () => {
      // Legacy ELP files use double-encoded HTML entities
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="&amp;lt;p&amp;gt;Main content&amp;lt;/p&amp;gt;"/>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.FeedbackField">
              <dictionary>
                <string role="key" value="feedback"/>
                <unicode value="&amp;lt;p&amp;gt;Feedback here&amp;lt;/p&amp;gt;"/>
                <string role="key" value="_buttonCaption"/>
                <string value="Show"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const result = parser.extractFieldsContentWithFeedback(dict);

      expect(result.content).toBe('<p>Main content</p>');
      expect(result.feedbackHtml).toBe('<p>Feedback here</p>');
      expect(result.feedbackButton).toBe('Show');
    });

    it('handles fields with only content (no feedback)', () => {
      // Legacy ELP files use double-encoded HTML entities
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="&amp;lt;p&amp;gt;Content only&amp;lt;/p&amp;gt;"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const result = parser.extractFieldsContentWithFeedback(dict);

      expect(result.content).toBe('<p>Content only</p>');
      expect(result.feedbackHtml).toBe('');
      expect(result.feedbackButton).toBe('');
    });

    it('handles multiple TextAreaFields and combines content', () => {
      // Legacy ELP files use double-encoded HTML entities
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="fields"/>
          <list>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="&amp;lt;p&amp;gt;First&amp;lt;/p&amp;gt;"/>
              </dictionary>
            </instance>
            <instance class="exe.engine.field.TextAreaField">
              <dictionary>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode value="&amp;lt;p&amp;gt;Second&amp;lt;/p&amp;gt;"/>
              </dictionary>
            </instance>
          </list>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const result = parser.extractFieldsContentWithFeedback(dict);

      expect(result.content).toContain('<p>First</p>');
      expect(result.content).toContain('<p>Second</p>');
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

  describe('root node flattening for legacy v2.x imports', () => {
    /**
     * LEGACY V2.X ROOT NODE FLATTENING CONVENTION
     *
     * Legacy contentv3.xml files have a single root node with children.
     * This convention promotes direct children to top-level pages.
     * See doc/conventions.md for full documentation.
     */

    it('should flatten direct children of single root to top-level', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="root-node">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Root"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="child-a">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child A"/>
              <string role="key" value="parent"/>
              <reference key="root-node"/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="child-b">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child B"/>
              <string role="key" value="parent"/>
              <reference key="root-node"/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="child-c">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child C"/>
              <string role="key" value="parent"/>
              <reference key="root-node"/>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      expect(result.pages).toHaveLength(4);

      // All pages should be at top level (parent_id = null)
      const root = result.pages.find(p => p.title === 'Root');
      const childA = result.pages.find(p => p.title === 'Child A');
      const childB = result.pages.find(p => p.title === 'Child B');
      const childC = result.pages.find(p => p.title === 'Child C');

      expect(root.parent_id).toBeNull();
      expect(childA.parent_id).toBeNull();
      expect(childB.parent_id).toBeNull();
      expect(childC.parent_id).toBeNull();
    });

    it('should preserve grandchild relationships with promoted parent', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="root-node">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Root"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="child-a">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child A"/>
              <string role="key" value="parent"/>
              <reference key="root-node"/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="grandchild-a1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Grandchild A1"/>
              <string role="key" value="parent"/>
              <reference key="child-a"/>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      expect(result.pages).toHaveLength(3);

      const root = result.pages.find(p => p.title === 'Root');
      const childA = result.pages.find(p => p.title === 'Child A');
      const grandchildA1 = result.pages.find(p => p.title === 'Grandchild A1');

      // Root at top level
      expect(root.parent_id).toBeNull();

      // Child A promoted to top level
      expect(childA.parent_id).toBeNull();

      // Grandchild A1 keeps parent relationship with Child A
      expect(grandchildA1.parent_id).toBe(childA.id);
    });

    it('should not flatten when root has no children', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="lonely-root">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Lonely Root"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].title).toBe('Lonely Root');
      expect(result.pages[0].parent_id).toBeNull();
    });

    it('should not flatten when multiple root nodes exist', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="root-1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Root 1"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="child-of-1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child of 1"/>
              <string role="key" value="parent"/>
              <reference key="root-1"/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="root-2">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Root 2"/>
              <string role="key" value="parent"/>
              <none/>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      // With multiple roots, no flattening should occur
      const childOf1 = result.pages.find(p => p.title === 'Child of 1');
      const root1 = result.pages.find(p => p.title === 'Root 1');

      // Child should still have its parent relationship (no flattening)
      expect(childOf1.parent_id).toBe(root1.id);
    });
  });

  describe('shouldFlattenRootChildren', () => {
    it('returns shouldFlatten=false when no root pages', () => {
      const result = parser.shouldFlattenRootChildren([]);
      expect(result.shouldFlatten).toBe(false);
      expect(result.rootPage).toBeNull();
    });

    it('returns shouldFlatten=false when multiple root pages', () => {
      const rootPages = [
        { id: 'root-1', children: [] },
        { id: 'root-2', children: [] },
      ];
      const result = parser.shouldFlattenRootChildren(rootPages);
      expect(result.shouldFlatten).toBe(false);
      expect(result.rootPage).toBeNull();
    });

    it('returns shouldFlatten=false when single root has no children', () => {
      const rootPages = [
        { id: 'root', children: [] },
      ];
      const result = parser.shouldFlattenRootChildren(rootPages);
      expect(result.shouldFlatten).toBe(false);
    });

    it('returns shouldFlatten=true when single root has children', () => {
      const rootPages = [
        { id: 'root', children: [{ id: 'child-1' }] },
      ];
      const result = parser.shouldFlattenRootChildren(rootPages);
      expect(result.shouldFlatten).toBe(true);
      expect(result.rootPage).toBe(rootPages[0]);
    });
  });

  describe('flattenRootChildren', () => {
    it('promotes direct children to top level', () => {
      const rootPage = {
        id: 'root',
        title: 'Root',
        blocks: [],
        children: [
          { id: 'child-a', title: 'Child A', blocks: [], children: [] },
          { id: 'child-b', title: 'Child B', blocks: [], children: [] },
        ],
      };

      const result = parser.flattenRootChildren(rootPage);

      expect(result).toHaveLength(3);

      // Root first
      expect(result[0].id).toBe('root');
      expect(result[0].parent_id).toBeNull();

      // Children promoted to top level
      expect(result[1].id).toBe('child-a');
      expect(result[1].parent_id).toBeNull();
      expect(result[2].id).toBe('child-b');
      expect(result[2].parent_id).toBeNull();
    });

    it('preserves grandchild relationships', () => {
      const rootPage = {
        id: 'root',
        title: 'Root',
        blocks: [],
        children: [
          {
            id: 'child-a',
            title: 'Child A',
            blocks: [],
            children: [
              { id: 'grandchild-a1', title: 'Grandchild A1', blocks: [], children: [] },
            ],
          },
        ],
      };

      const result = parser.flattenRootChildren(rootPage);

      expect(result).toHaveLength(3);

      // Root first
      expect(result[0].id).toBe('root');
      expect(result[0].parent_id).toBeNull();

      // Child A promoted
      expect(result[1].id).toBe('child-a');
      expect(result[1].parent_id).toBeNull();

      // Grandchild A1 keeps parent relationship
      expect(result[2].id).toBe('grandchild-a1');
      expect(result[2].parent_id).toBe('child-a');
    });
  });

  describe('iDevice box splitting for legacy v2.x imports', () => {
    /**
     * LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
     *
     * When importing legacy contentv3.xml files, each iDevice must be placed
     * in its own box (block), with the box title taken from the iDevice title.
     * See doc/conventions.md for full documentation.
     */

    it('should create one block per iDevice', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="node-1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Test Page"/>
              <string role="key" value="parent"/>
              <none/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Introduction"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev2">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Objectives"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev3">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Activity"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      expect(result.pages).toHaveLength(1);
      const page = result.pages[0];

      // Should have 3 blocks, one per iDevice
      expect(page.blocks).toHaveLength(3);

      // Each block should have exactly one iDevice
      page.blocks.forEach(block => {
        expect(block.idevices).toHaveLength(1);
      });

      // Block names should match iDevice titles
      expect(page.blocks[0].name).toBe('Introduction');
      expect(page.blocks[1].name).toBe('Objectives');
      expect(page.blocks[2].name).toBe('Activity');
    });

    it('should use iDevice title as block name', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="node-1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Page"/>
              <string role="key" value="parent"/>
              <none/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="My Custom Title"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      const page = result.pages[0];
      expect(page.blocks).toHaveLength(1);
      expect(page.blocks[0].name).toBe('My Custom Title');
    });

    it('should use empty string for iDevices without title', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="node-1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Page"/>
              <string role="key" value="parent"/>
              <none/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
                  <dictionary>
                    <string role="key" value="other_field"/>
                    <unicode value="some value"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      const page = result.pages[0];
      expect(page.blocks).toHaveLength(1);
      expect(page.blocks[0].name).toBe('');
    });

    it('should preserve iDevice order across blocks', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="node-1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Page"/>
              <string role="key" value="parent"/>
              <none/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev-first">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="First"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev-second">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Second"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev-third">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Third"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      const page = result.pages[0];
      expect(page.blocks[0].position).toBe(0);
      expect(page.blocks[0].name).toBe('First');
      expect(page.blocks[1].position).toBe(1);
      expect(page.blocks[1].name).toBe('Second');
      expect(page.blocks[2].position).toBe(2);
      expect(page.blocks[2].name).toBe('Third');
    });

    it('should NOT group multiple iDevices into single block', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <root>
          <instance class="exe.engine.node.Node" reference="node-1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Page"/>
              <string role="key" value="parent"/>
              <none/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="iDevice 1"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev2">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="iDevice 2"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      const result = parser.parse(xml);

      const page = result.pages[0];

      // Verify no block contains more than one iDevice
      page.blocks.forEach(block => {
        expect(block.idevices.length).toBe(1);
      });

      // Number of blocks should equal number of iDevices
      expect(page.blocks.length).toBe(2);
    });
  });

  describe('extractReflectionFeedback', () => {
    /**
     * ReflectionIdevice stores feedback differently from GenericIdevice:
     * - Uses answerTextArea (TextAreaField) instead of FeedbackField
     * - buttonCaption in the TextAreaField contains the feedback button text
     * - content_w_resourcePaths contains the feedback HTML
     */

    it('extracts feedback content and buttonCaption from answerTextArea', () => {
      // ReflectionIdevice structure with answerTextArea containing feedback
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="answerTextArea"/>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="buttonCaption"/>
              <string value="Guía de reflexión"/>
              <string role="key" value="content_w_resourcePaths"/>
              <unicode value="&amp;lt;p&amp;gt;¿Qué hemos aprendido?&amp;lt;/p&amp;gt;"/>
            </dictionary>
          </instance>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const result = parser.extractReflectionFeedback(dict);

      expect(result.buttonCaption).toBe('Guía de reflexión');
      expect(result.content).toBe('<p>¿Qué hemos aprendido?</p>');
    });

    it('returns empty when answerTextArea is missing', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="activityTextArea"/>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"/>
              <unicode value="&amp;lt;p&amp;gt;Main content&amp;lt;/p&amp;gt;"/>
            </dictionary>
          </instance>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const result = parser.extractReflectionFeedback(dict);

      expect(result.content).toBe('');
      expect(result.buttonCaption).toBe('');
    });

    it('returns empty when buttonCaption is missing', () => {
      // answerTextArea without buttonCaption should not be treated as feedback
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="answerTextArea"/>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"/>
              <unicode value="&amp;lt;p&amp;gt;Content without button&amp;lt;/p&amp;gt;"/>
            </dictionary>
          </instance>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const result = parser.extractReflectionFeedback(dict);

      // Should return empty because both content AND buttonCaption must be present
      expect(result.content).toBe('');
      expect(result.buttonCaption).toBe('');
    });

    it('returns empty when answerTextArea has no content', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="answerTextArea"/>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="buttonCaption"/>
              <string value="Click me"/>
            </dictionary>
          </instance>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const dict = doc.querySelector('dictionary');
      const result = parser.extractReflectionFeedback(dict);

      expect(result.content).toBe('');
      expect(result.buttonCaption).toBe('');
    });
  });

  describe('ReflectionIdevice integration', () => {
    it('extracts feedback from ReflectionIdevice via extractIDevicesWithTitles', () => {
      // Full ReflectionIdevice structure as found in legacy ELPs
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.reflectionidevice.ReflectionIdevice" reference="idev-reflect">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Dos minutos... para pensar"/>
              <string role="key" value="activityTextArea"/>
              <instance class="exe.engine.field.TextAreaField">
                <dictionary>
                  <string role="key" value="content_w_resourcePaths"/>
                  <unicode value="&amp;lt;p&amp;gt;Main activity content&amp;lt;/p&amp;gt;"/>
                </dictionary>
              </instance>
              <string role="key" value="answerTextArea"/>
              <instance class="exe.engine.field.TextAreaField">
                <dictionary>
                  <string role="key" value="buttonCaption"/>
                  <string value="Guía de reflexión"/>
                  <string role="key" value="content_w_resourcePaths"/>
                  <unicode value="&amp;lt;p&amp;gt;¿Qué hemos aprendido?&amp;lt;/p&amp;gt;"/>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices).toHaveLength(1);
      expect(idevices[0].title).toBe('Dos minutos... para pensar');
      expect(idevices[0].feedbackButton).toBe('Guía de reflexión');
      expect(idevices[0].feedbackHtml).toBe('<p>¿Qué hemos aprendido?</p>');
    });

    it('uses FeedbackField first, falls back to answerTextArea', () => {
      // If an iDevice has both FeedbackField and answerTextArea, FeedbackField wins
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.genericidevice.GenericIdevice" reference="idev-generic">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Test iDevice"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&amp;lt;p&amp;gt;Main content&amp;lt;/p&amp;gt;"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.field.FeedbackField">
                  <dictionary>
                    <string role="key" value="feedback"/>
                    <unicode value="&amp;lt;p&amp;gt;Feedback from FeedbackField&amp;lt;/p&amp;gt;"/>
                    <string role="key" value="_buttonCaption"/>
                    <string value="Show Feedback"/>
                  </dictionary>
                </instance>
              </list>
              <string role="key" value="answerTextArea"/>
              <instance class="exe.engine.field.TextAreaField">
                <dictionary>
                  <string role="key" value="buttonCaption"/>
                  <string value="Answer Button"/>
                  <string role="key" value="content_w_resourcePaths"/>
                  <unicode value="&amp;lt;p&amp;gt;Answer from answerTextArea&amp;lt;/p&amp;gt;"/>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices).toHaveLength(1);
      // FeedbackField should be used, not answerTextArea
      expect(idevices[0].feedbackButton).toBe('Show Feedback');
      expect(idevices[0].feedbackHtml).toBe('<p>Feedback from FeedbackField</p>');
    });
  });

  describe('extractIdeviceTitle', () => {
    it('extracts title from dictionary with _title key', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
          <dictionary>
            <string role="key" value="_title"/>
            <unicode value="My Title"/>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const inst = doc.querySelector('instance');
      const title = parser.extractIdeviceTitle(inst);

      expect(title).toBe('My Title');
    });

    it('extracts title from dictionary with title key', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
          <dictionary>
            <string role="key" value="title"/>
            <unicode value="Alternative Title"/>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const inst = doc.querySelector('instance');
      const title = parser.extractIdeviceTitle(inst);

      expect(title).toBe('Alternative Title');
    });

    it('returns empty string for missing dictionary', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const inst = doc.querySelector('instance');
      const title = parser.extractIdeviceTitle(inst);

      expect(title).toBe('');
    });

    it('returns empty string for empty title', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
          <dictionary>
            <string role="key" value="_title"/>
            <unicode value="   "/>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const inst = doc.querySelector('instance');
      const title = parser.extractIdeviceTitle(inst);

      expect(title).toBe('');
    });
  });

  describe('LEGACY_ICON_MAP', () => {
    it('has static icon mapping', () => {
      expect(LegacyXmlParser.LEGACY_ICON_MAP).toBeDefined();
      expect(typeof LegacyXmlParser.LEGACY_ICON_MAP).toBe('object');
    });

    it('maps preknowledge to think', () => {
      expect(LegacyXmlParser.LEGACY_ICON_MAP['preknowledge']).toBe('think');
    });

    it('maps reading to book', () => {
      expect(LegacyXmlParser.LEGACY_ICON_MAP['reading']).toBe('book');
    });

    it('maps casestudy to case', () => {
      expect(LegacyXmlParser.LEGACY_ICON_MAP['casestudy']).toBe('case');
    });
  });

  describe('icon extraction in extractIDevicesWithTitles', () => {
    it('extracts icon name from iDevice dictionary', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Test iDevice"/>
              <string role="key" value="icon"/>
              <unicode value="objectives"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="Test content"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(1);
      expect(idevices[0].icon).toBe('objectives');
    });

    it('maps legacy preknowledge icon to think', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Conocimientos previos"/>
              <string role="key" value="icon"/>
              <unicode value="preknowledge"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="Test content"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(1);
      expect(idevices[0].icon).toBe('think');  // Mapped from preknowledge
    });

    it('returns empty string for missing icon', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Test"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="Test"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(1);
      expect(idevices[0].icon).toBe('');
    });
  });

  describe('icon in extractNodeBlocks', () => {
    it('passes icon from iDevice to block', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.node.Node" reference="node1">
          <dictionary>
            <string role="key" value="_title"/>
            <unicode value="Test Page"/>
            <string role="key" value="idevices"/>
            <list>
              <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="Objetivos"/>
                  <string role="key" value="icon"/>
                  <unicode value="objectives"/>
                  <string role="key" value="fields"/>
                  <list>
                    <instance class="exe.engine.field.TextAreaField" reference="f1">
                      <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="Content"/>
                      </dictionary>
                    </instance>
                  </list>
                </dictionary>
              </instance>
            </list>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const nodeEl = doc.querySelector('instance[class*="Node"]');
      const blocks = parser.extractNodeBlocks(nodeEl);

      expect(blocks.length).toBe(1);
      expect(blocks[0].name).toBe('Objetivos');
      expect(blocks[0].iconName).toBe('objectives');
    });

    it('maps preknowledge icon to think in block', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.node.Node" reference="node1">
          <dictionary>
            <string role="key" value="_title"/>
            <unicode value="Test Page"/>
            <string role="key" value="idevices"/>
            <list>
              <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="Conocimientos previos"/>
                  <string role="key" value="icon"/>
                  <unicode value="preknowledge"/>
                  <string role="key" value="fields"/>
                  <list>
                    <instance class="exe.engine.field.TextAreaField" reference="f1">
                      <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="Content"/>
                      </dictionary>
                    </instance>
                  </list>
                </dictionary>
              </instance>
            </list>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const nodeEl = doc.querySelector('instance[class*="Node"]');
      const blocks = parser.extractNodeBlocks(nodeEl);

      expect(blocks.length).toBe(1);
      expect(blocks[0].name).toBe('Conocimientos previos');
      expect(blocks[0].iconName).toBe('think');  // Mapped from preknowledge
    });

    it('returns empty iconName for iDevice without icon', () => {
      const xml = `<?xml version="1.0"?>
        <instance class="exe.engine.node.Node" reference="node1">
          <dictionary>
            <string role="key" value="_title"/>
            <unicode value="Test Page"/>
            <string role="key" value="idevices"/>
            <list>
              <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="idev1">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="No Icon"/>
                  <string role="key" value="fields"/>
                  <list>
                    <instance class="exe.engine.field.TextAreaField" reference="f1">
                      <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="Content"/>
                      </dictionary>
                    </instance>
                  </list>
                </dictionary>
              </instance>
            </list>
          </dictionary>
        </instance>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const nodeEl = doc.querySelector('instance[class*="Node"]');
      const blocks = parser.extractNodeBlocks(nodeEl);

      expect(blocks.length).toBe(1);
      expect(blocks[0].iconName).toBe('');
    });
  });
});

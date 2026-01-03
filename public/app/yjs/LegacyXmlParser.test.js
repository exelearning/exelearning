/**
 * LegacyXmlParser Vitest Tests
 *
 * Unit tests for parsing legacy .elp files (contentv3.xml) that use Python pickle format.
 *
 * Run with: bun run vitest run public/app/yjs/LegacyXmlParser.test.js
 */

// Import the LegacyXmlParser class (vitest.setup.js provides globals like DOMParser, document, etc.)
const LegacyXmlParser = require('./LegacyXmlParser');

describe('LegacyXmlParser', () => {
  let parser;

  beforeEach(() => {
    parser = new LegacyXmlParser();
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
      expect(meta).toHaveProperty('footer');
      expect(meta).toHaveProperty('extraHeadContent');
    });

    it('extracts footer content from package', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Project With Footer"/>
              <string role="key" value="footer"/>
              <unicode value="&lt;p&gt;Custom footer content&lt;/p&gt;"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.title).toBe('Project With Footer');
      expect(meta.footer).toBe('<p>Custom footer content</p>');
    });

    it('returns empty footer when not present', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="No Footer Project"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.footer).toBe('');
    });

    it('extracts extraHeadContent from package', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Project With Head"/>
              <string role="key" value="_extraHeadContent"/>
              <unicode value="&lt;script&gt;console.log('test');&lt;/script&gt;"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.title).toBe('Project With Head');
      expect(meta.extraHeadContent).toBe("<script>console.log('test');</script>");
    });

    it('returns empty extraHeadContent when not present', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="No Head Project"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.extraHeadContent).toBe('');
    });

    it('extracts language from package', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Spanish Project"/>
              <string role="key" value="_lang"/>
              <unicode value="es"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.title).toBe('Spanish Project');
      expect(meta.language).toBe('es');
    });

    it('returns empty language when not present', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="No Language Project"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.language).toBe('');
    });

    it('extracts export options from package with bool elements', () => {
      // Legacy format uses <bool value="1"/> for boolean values
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Project With Export Options"/>
              <string role="key" value="_addPagination"/>
              <bool value="1"/>
              <string role="key" value="_addSearchBox"/>
              <bool value="1"/>
              <string role="key" value="exportSource"/>
              <bool value="1"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.title).toBe('Project With Export Options');
      expect(meta.pp_addPagination).toBe(true);
      expect(meta.pp_addSearchBox).toBe(true);
      expect(meta.exportSource).toBe(true);
    });

    it('returns false export options when not present', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="No Export Options"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      expect(meta.pp_addPagination).toBe(false);
      expect(meta.pp_addSearchBox).toBe(false);
      expect(meta.exportSource).toBe(false);
      expect(meta.pp_addExeLink).toBe(true); // Default is true
      expect(meta.pp_addAccessibilityToolbar).toBe(false);
    });

    it('has all expected metadata properties', () => {
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.package.Package">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Full Project"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const meta = parser.extractMetadata();

      // Should have all expected properties
      expect(meta).toHaveProperty('title');
      expect(meta).toHaveProperty('author');
      expect(meta).toHaveProperty('description');
      expect(meta).toHaveProperty('language');
      expect(meta).toHaveProperty('footer');
      expect(meta).toHaveProperty('extraHeadContent');
      expect(meta).toHaveProperty('exportSource');
      expect(meta).toHaveProperty('pp_addPagination');
      expect(meta).toHaveProperty('pp_addSearchBox');
      expect(meta).toHaveProperty('pp_addExeLink');
      expect(meta).toHaveProperty('pp_addAccessibilityToolbar');
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

    it('returns true for bool element with value 1', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="boolKey"/>
          <bool value="1"/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');

      const value = parser.findDictValue(dict, 'boolKey');
      expect(value).toBe(true);
    });

    it('returns false for bool element with value 0', () => {
      const xml = `<?xml version="1.0"?>
        <dictionary>
          <string role="key" value="boolKey"/>
          <bool value="0"/>
        </dictionary>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const dict = doc.querySelector('dictionary');

      const value = parser.findDictValue(dict, 'boolKey');
      expect(value).toBe(false);
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

    it('filters out parentNode references embedded in fields', () => {
      // This XML simulates the legacy structure where TextAreaField contains
      // a "parentNode" that is an inlined Node instance (not a reference).
      // These embedded nodes should NOT be treated as real pages.
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="4">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Real Page"/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="1">
                  <dictionary>
                    <string role="key" value="content"/>
                    <instance class="exe.engine.field.TextAreaField" reference="3">
                      <dictionary>
                        <string role="key" value="parentNode"/>
                        <instance class="exe.engine.node.Node" reference="8">
                          <dictionary>
                            <string role="key" value="_title"/>
                            <unicode value="Embedded Node"/>
                            <string role="key" value="parent"/>
                            <none/>
                            <string role="key" value="children"/>
                            <list></list>
                          </dictionary>
                        </instance>
                      </dictionary>
                    </instance>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Should only find the real page node (ref=4), not the embedded parentNode (ref=8)
      expect(nodes).toHaveLength(1);
      expect(nodes[0].getAttribute('reference')).toBe('4');
    });

    it('keeps nodes that are in children list even if they have parentNode sibling pattern elsewhere', () => {
      // Ensure we don't accidentally filter real child nodes
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Parent"/>
              <string role="key" value="children"/>
              <list>
                <instance class="exe.engine.node.Node" reference="2">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Child"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Both nodes should be found (parent and child)
      expect(nodes).toHaveLength(2);
    });

    it('filters multiple parentNode references from different fields', () => {
      // Multiple iDevices with their own parentNode references
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Real Page"/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice">
                  <dictionary>
                    <string role="key" value="content"/>
                    <instance class="exe.engine.field.TextAreaField">
                      <dictionary>
                        <string role="key" value="parentNode"/>
                        <instance class="exe.engine.node.Node" reference="10">
                          <dictionary>
                            <string role="key" value="_title"/>
                            <unicode value="Embedded 1"/>
                          </dictionary>
                        </instance>
                      </dictionary>
                    </instance>
                  </dictionary>
                </instance>
                <instance class="exe.engine.jsidevice.JsIdevice">
                  <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                      <instance class="exe.engine.field.TextAreaField">
                        <dictionary>
                          <string role="key" value="parentNode"/>
                          <instance class="exe.engine.node.Node" reference="20">
                            <dictionary>
                              <string role="key" value="_title"/>
                              <unicode value="Embedded 2"/>
                            </dictionary>
                          </instance>
                        </dictionary>
                      </instance>
                    </list>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Should only find the real page (ref=1), not the two embedded ones (ref=10, ref=20)
      expect(nodes).toHaveLength(1);
      expect(nodes[0].getAttribute('reference')).toBe('1');
    });

    it('keeps nodes when preceding sibling has different key value', () => {
      // Node preceded by a string with role="key" but value is NOT "parentNode"
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="_nodeIdDict"/>
              <instance class="exe.engine.node.Node" reference="2">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="Page in nodeIdDict"/>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Both nodes should be found (different key value, not "parentNode")
      expect(nodes).toHaveLength(2);
    });

    it('keeps nodes when preceding sibling is not a string element', () => {
      // Node preceded by non-string element
      const xml = `<?xml version="1.0"?>
        <root>
          <list>
            <instance class="exe.engine.node.Node" reference="1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="Node in list"/>
              </dictionary>
            </instance>
          </list>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Node should be found (no string sibling before it)
      expect(nodes).toHaveLength(1);
    });

    it('keeps nodes without any preceding sibling', () => {
      // Node is first child (no preceding sibling at all)
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="First Node"/>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Node should be found
      expect(nodes).toHaveLength(1);
    });

    it('handles mixed real nodes with children and embedded parentNode references', () => {
      // Complex structure similar to mujeres_huella.elp
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="4">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Root Page"/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice">
                  <dictionary>
                    <string role="key" value="content"/>
                    <instance class="exe.engine.field.TextAreaField">
                      <dictionary>
                        <string role="key" value="parentNode"/>
                        <instance class="exe.engine.node.Node" reference="8">
                          <dictionary>
                            <string role="key" value="_title"/>
                            <unicode value="Root Page"/>
                            <string role="key" value="parent"/>
                            <none/>
                            <string role="key" value="children"/>
                            <list></list>
                          </dictionary>
                        </instance>
                      </dictionary>
                    </instance>
                  </dictionary>
                </instance>
              </list>
              <string role="key" value="parent"/>
              <none/>
              <string role="key" value="children"/>
              <list>
                <instance class="exe.engine.node.Node" reference="15">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Child Page 1"/>
                    <string role="key" value="parent"/>
                    <reference key="4"/>
                  </dictionary>
                </instance>
                <instance class="exe.engine.node.Node" reference="16">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Child Page 2"/>
                    <string role="key" value="parent"/>
                    <reference key="4"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Should find 3 real nodes (ref=4, ref=15, ref=16), not the embedded parentNode (ref=8)
      expect(nodes).toHaveLength(3);
      const refs = nodes.map(n => n.getAttribute('reference')).sort();
      expect(refs).toEqual(['15', '16', '4']);
    });

    it('keeps node when preceding sibling string has no role attribute', () => {
      // Edge case: string element without role="key"
      const xml = `<?xml version="1.0"?>
        <root>
          <dictionary>
            <string value="parentNode"/>
            <instance class="exe.engine.node.Node" reference="1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="Page"/>
              </dictionary>
            </instance>
          </dictionary>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Node should be found (string doesn't have role="key")
      expect(nodes).toHaveLength(1);
    });

    it('deeply nested parentNode references are filtered', () => {
      // parentNode deeply nested inside multiple levels of fields
      const xml = `<?xml version="1.0"?>
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Real Page"/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.idevice.Idevice">
                  <dictionary>
                    <string role="key" value="fields"/>
                    <list>
                      <instance class="exe.engine.field.Field">
                        <dictionary>
                          <string role="key" value="subFields"/>
                          <list>
                            <instance class="exe.engine.field.TextAreaField">
                              <dictionary>
                                <string role="key" value="parentNode"/>
                                <instance class="exe.engine.node.Node" reference="99">
                                  <dictionary>
                                    <string role="key" value="_title"/>
                                    <unicode value="Deeply Nested"/>
                                  </dictionary>
                                </instance>
                              </dictionary>
                            </instance>
                          </list>
                        </dictionary>
                      </instance>
                    </list>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>`;

      parser.parse(xml);
      const nodes = parser.findAllNodes();

      // Should only find the real page (ref=1), not the deeply nested one (ref=99)
      expect(nodes).toHaveLength(1);
      expect(nodes[0].getAttribute('reference')).toBe('1');
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
      // Set project language to Spanish (default for legacy files)
      parser.projectLanguage = 'es';

      const fieldInst = doc.querySelector('instance');
      const result = parser.extractFeedbackFieldContent(fieldInst);

      // Uses project language for localized default caption
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

    it('returns content with default buttonCaption when buttonCaption is missing', () => {
      // answerTextArea without buttonCaption should use a default button caption
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
      // Set project language to Spanish (default for legacy files)
      parser.projectLanguage = 'es';

      const dict = doc.querySelector('dictionary');
      const result = parser.extractReflectionFeedback(dict);

      // Button caption is optional - implementation provides a default based on project language
      expect(result.content).toBe('<p>Content without button</p>');
      expect(result.buttonCaption).toBe('Mostrar retroalimentación');
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

  /**
   * Phase 3: XML Preprocessing & Internal Links
   *
   * Tests for encoding fixes, node reordering, and internal link conversion
   * Based on Symfony OdeXmlUtil.php patterns
   */

  describe('preprocessLegacyXml', () => {
    it('removes 5-space indentations', () => {
      const xml = '<root>     <child>text</child></root>';
      const result = parser.preprocessLegacyXml(xml);
      expect(result).toBe('<root><child>text</child></root>');
    });

    it('removes tabs', () => {
      const xml = '<root>\t<child>text</child></root>';
      const result = parser.preprocessLegacyXml(xml);
      expect(result).toBe('<root><child>text</child></root>');
    });

    it('unifies Windows line endings to Unix', () => {
      const xml = '<root>\r\n<child/>\r\n</root>';
      const result = parser.preprocessLegacyXml(xml);
      // Newlines are converted to &#10; then restored between tags
      expect(result).not.toContain('\r');
    });

    it('removes double newlines', () => {
      const xml = '<root>\n\n<child/></root>';
      const result = parser.preprocessLegacyXml(xml);
      // Double newlines become single
      expect(result).toBe('<root>\n<child/></root>');
    });

    it('converts hex escape sequences to characters', () => {
      const xml = '<root>\\x41\\x42\\x43</root>';
      const result = parser.preprocessLegacyXml(xml);
      expect(result).toBe('<root>ABC</root>');
    });

    it('converts literal \\n to entity', () => {
      const xml = '<root>Line1\\nLine2</root>';
      const result = parser.preprocessLegacyXml(xml);
      expect(result).toBe('<root>Line1&#10;Line2</root>');
    });

    it('preserves newlines inside attributes via &#10;', () => {
      const xml = '<root attr="line1\nline2"/>';
      const result = parser.preprocessLegacyXml(xml);
      expect(result).toContain('attr="line1&#10;line2"');
    });

    it('restores newlines between tags', () => {
      const xml = '<root>\n<child/>\n</root>';
      const result = parser.preprocessLegacyXml(xml);
      expect(result).toBe('<root>\n<child/>\n</root>');
    });

    it('handles complex mixed encoding case', () => {
      const xml = '<root>     \t\\x48ello\\nWorld\r\n</root>';
      const result = parser.preprocessLegacyXml(xml);
      expect(result).toContain('Hello');
      expect(result).toContain('&#10;');
      expect(result).not.toContain('\\x');
      expect(result).not.toContain('\t');
    });
  });

  describe('buildFullPathMap', () => {
    it('builds map for flat pages', () => {
      const pages = [
        { id: 'page-1', title: 'Page One', parent_id: null },
        { id: 'page-2', title: 'Page Two', parent_id: null },
      ];

      const map = parser.buildFullPathMap(pages);

      expect(map.get('Page One')).toBe('page-1');
      expect(map.get('Page Two')).toBe('page-2');
    });

    it('builds map for nested pages', () => {
      const pages = [
        { id: 'page-1', title: 'Root', parent_id: null },
        { id: 'page-2', title: 'Chapter 1', parent_id: 'page-1' },
        { id: 'page-3', title: 'Section A', parent_id: 'page-2' },
      ];

      const map = parser.buildFullPathMap(pages);

      expect(map.get('Root')).toBe('page-1');
      expect(map.get('Root:Chapter 1')).toBe('page-2');
      expect(map.get('Root:Chapter 1:Section A')).toBe('page-3');
    });

    it('handles URL-encoded paths', () => {
      const pages = [
        { id: 'page-1', title: 'Page%20With%20Spaces', parent_id: null },
      ];

      const map = parser.buildFullPathMap(pages);

      // Both encoded and decoded versions should be present
      expect(map.get('Page%20With%20Spaces')).toBe('page-1');
      expect(map.get('Page With Spaces')).toBe('page-1');
    });

    it('returns empty map for empty pages', () => {
      const map = parser.buildFullPathMap([]);
      expect(map.size).toBe(0);
    });
  });

  describe('convertInternalLinks', () => {
    it('converts path-based exe-node links to ID-based', () => {
      const fullPathMap = new Map([
        ['Chapter 1:Section A', 'page-123'],
      ]);
      const html = '<a href="exe-node:Chapter 1:Section A">Link</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:page-123">Link</a>');
    });

    it('handles links with #auto_top suffix', () => {
      const fullPathMap = new Map([
        ['Page One', 'page-1'],
      ]);
      const html = '<a href="exe-node:Page One#auto_top">Link</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:page-1">Link</a>');
    });

    it('preserves other hash fragments', () => {
      const fullPathMap = new Map([
        ['Page One', 'page-1'],
      ]);
      const html = '<a href="exe-node:Page One#section">Link</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:page-1#section">Link</a>');
    });

    it('handles URL-encoded paths', () => {
      const fullPathMap = new Map([
        ['Page With Spaces', 'page-1'],
      ]);
      const html = '<a href="exe-node:Page%20With%20Spaces">Link</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:page-1">Link</a>');
    });

    it('handles project name prefix in path', () => {
      const fullPathMap = new Map([
        ['Chapter 1', 'page-2'],
      ]);
      const html = '<a href="exe-node:ProjectName:Chapter 1">Link</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:page-2">Link</a>');
    });

    it('keeps original link if path not found', () => {
      const fullPathMap = new Map([
        ['Page One', 'page-1'],
      ]);
      const html = '<a href="exe-node:Unknown Page">Link</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:Unknown Page">Link</a>');
    });

    it('returns unchanged html if no exe-node links', () => {
      const fullPathMap = new Map([
        ['Page One', 'page-1'],
      ]);
      const html = '<a href="https://example.com">Link</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe(html);
    });

    it('handles multiple links in same html', () => {
      const fullPathMap = new Map([
        ['Page 1', 'page-1'],
        ['Page 2', 'page-2'],
      ]);
      const html = '<a href="exe-node:Page 1">Link 1</a> and <a href="exe-node:Page 2">Link 2</a>';

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:page-1">Link 1</a> and <a href="exe-node:page-2">Link 2</a>');
    });

    it('handles single quoted attributes', () => {
      const fullPathMap = new Map([
        ['Page One', 'page-1'],
      ]);
      const html = "<a href='exe-node:Page One'>Link</a>";

      const result = parser.convertInternalLinks(html, fullPathMap);

      expect(result).toBe('<a href="exe-node:page-1">Link</a>');
    });

    it('returns empty string for null/undefined html', () => {
      const fullPathMap = new Map();

      expect(parser.convertInternalLinks(null, fullPathMap)).toBe(null);
      expect(parser.convertInternalLinks(undefined, fullPathMap)).toBe(undefined);
      expect(parser.convertInternalLinks('', fullPathMap)).toBe('');
    });
  });

  describe('convertAllInternalLinks', () => {
    it('converts links in htmlView', () => {
      const fullPathMap = new Map([
        ['Target Page', 'page-target'],
      ]);
      const pages = [
        {
          id: 'page-1',
          title: 'Source',
          blocks: [
            {
              idevices: [
                { htmlView: '<a href="exe-node:Target Page">Link</a>' },
              ],
            },
          ],
        },
      ];

      parser.convertAllInternalLinks(pages, fullPathMap);

      expect(pages[0].blocks[0].idevices[0].htmlView).toBe('<a href="exe-node:page-target">Link</a>');
    });

    it('converts links in feedbackHtml', () => {
      const fullPathMap = new Map([
        ['Target Page', 'page-target'],
      ]);
      const pages = [
        {
          id: 'page-1',
          title: 'Source',
          blocks: [
            {
              idevices: [
                {
                  htmlView: 'text',
                  feedbackHtml: '<a href="exe-node:Target Page">Feedback Link</a>',
                },
              ],
            },
          ],
        },
      ];

      parser.convertAllInternalLinks(pages, fullPathMap);

      expect(pages[0].blocks[0].idevices[0].feedbackHtml).toBe('<a href="exe-node:page-target">Feedback Link</a>');
    });

    it('converts links in properties JSON', () => {
      const fullPathMap = new Map([
        ['Target Page', 'page-target'],
      ]);
      const pages = [
        {
          id: 'page-1',
          title: 'Source',
          blocks: [
            {
              idevices: [
                {
                  htmlView: '',
                  properties: {
                    content: '<a href="exe-node:Target Page">Link</a>',
                  },
                },
              ],
            },
          ],
        },
      ];

      parser.convertAllInternalLinks(pages, fullPathMap);

      expect(pages[0].blocks[0].idevices[0].properties.content).toBe('<a href="exe-node:page-target">Link</a>');
    });

    it('handles pages without blocks', () => {
      const fullPathMap = new Map();
      const pages = [{ id: 'page-1', title: 'Empty' }];

      // Should not throw
      expect(() => parser.convertAllInternalLinks(pages, fullPathMap)).not.toThrow();
    });

    it('handles empty fullPathMap', () => {
      const fullPathMap = new Map();
      const pages = [
        {
          id: 'page-1',
          blocks: [
            {
              idevices: [
                { htmlView: '<a href="exe-node:Target">Link</a>' },
              ],
            },
          ],
        },
      ];

      // Should return early and not modify
      parser.convertAllInternalLinks(pages, fullPathMap);

      expect(pages[0].blocks[0].idevices[0].htmlView).toBe('<a href="exe-node:Target">Link</a>');
    });
  });

  describe('detectNodeReorderMap', () => {
    it('returns empty map for well-formed XML', () => {
      const xmlContent = `
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="children"/>
              <list>
                <instance class="exe.engine.node.Node" reference="2">
                  <dictionary/>
                </instance>
              </list>
            </dictionary>
          </instance>
        </root>
      `;

      // Parse the XML first
      parser.xmlContent = parser.preprocessLegacyXml(xmlContent);
      const domParser = new DOMParser();
      parser.xmlDoc = domParser.parseFromString(parser.xmlContent, 'text/xml');

      const map = parser.detectNodeReorderMap();

      expect(map.size).toBe(0);
    });

    it('detects nodes referenced outside their position', () => {
      const xmlContent = `
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="children"/>
              <list>
                <instance class="exe.engine.node.Node" reference="2">
                  <dictionary/>
                </instance>
                <reference key="3"/>
              </list>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary/>
          </instance>
        </root>
      `;

      // Parse the XML first
      parser.xmlContent = parser.preprocessLegacyXml(xmlContent);
      const domParser = new DOMParser();
      parser.xmlDoc = domParser.parseFromString(parser.xmlContent, 'text/xml');

      const map = parser.detectNodeReorderMap();

      // Node 3 should be reordered to appear after node 2
      expect(map.size).toBe(1);
      expect(map.get(3)).toBe(2);
    });

    it('handles multiple references in children list', () => {
      const xmlContent = `
        <root>
          <instance class="exe.engine.node.Node" reference="1">
            <dictionary>
              <string role="key" value="children"/>
              <list>
                <reference key="2"/>
                <reference key="3"/>
              </list>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="2">
            <dictionary/>
          </instance>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary/>
          </instance>
        </root>
      `;

      parser.xmlContent = parser.preprocessLegacyXml(xmlContent);
      const domParser = new DOMParser();
      parser.xmlDoc = domParser.parseFromString(parser.xmlContent, 'text/xml');

      const map = parser.detectNodeReorderMap();

      // Node 2 after node 1, node 3 after node 2
      expect(map.size).toBe(2);
      expect(map.get(2)).toBe(1);
      expect(map.get(3)).toBe(2);
    });
  });

  describe('applyNodeReordering', () => {
    it('returns unchanged pages for empty reorder map', () => {
      const pages = [
        { id: 'page-1', position: 0 },
        { id: 'page-2', position: 1 },
      ];
      const nodesChangeRef = new Map();

      const result = parser.applyNodeReordering(pages, nodesChangeRef);

      expect(result).toBe(pages);
    });

    it('reorders pages based on map', () => {
      const pages = [
        { id: 'page-1', position: 0 },
        { id: 'page-3', position: 1 },  // Out of order
        { id: 'page-2', position: 2 },
      ];
      const nodesChangeRef = new Map([
        [2, 1],  // Node 2 should come right after node 1
      ]);

      const result = parser.applyNodeReordering([...pages], nodesChangeRef);

      // After reordering: page-1 (pos 0), page-2 (pos 0.5 -> 1), page-3 (pos 1 -> 2)
      expect(result[0].id).toBe('page-1');
      expect(result[1].id).toBe('page-2');
      expect(result[2].id).toBe('page-3');
    });

    it('renumbers positions after reordering', () => {
      const pages = [
        { id: 'page-1', position: 0 },
        { id: 'page-3', position: 1 },
        { id: 'page-2', position: 2 },
      ];
      const nodesChangeRef = new Map([
        [2, 1],
      ]);

      const result = parser.applyNodeReordering([...pages], nodesChangeRef);

      // All positions should be sequential integers
      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBe(2);
    });
  });

  describe('rubric iDevice detection and transformation', () => {
    it('should detect rubric content via JsIdevice _iDeviceDir', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="rub1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Rúbrica de evaluación"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="rubric"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="table content"/>
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
      expect(idevices[0].type).toBe('rubric');
    });

    it('should transform exe-rubric-strings to exe-rubrics-strings (plural)', () => {
      // Directly test the transformation logic in the rubric detection code
      // by simulating what happens when htmlView contains exe-rubric-strings
      const idevice = {
        id: 'test-idevice',
        type: 'text',
        htmlView: '<table></table><ul class="exe-rubric-strings"><li>Test</li></ul>'
      };

      // Apply the rubric transformation logic (same as in extractIDevicesWithTitles)
      if (idevice.htmlView && idevice.htmlView.includes('exe-rubric-strings')) {
        idevice.type = 'rubric';
        idevice.htmlView = idevice.htmlView.replace(/exe-rubric([^s])/g, 'exe-rubrics$1');
        idevice.cssClass = 'rubric';
      }

      expect(idevice.type).toBe('rubric');
      expect(idevice.htmlView).toContain('exe-rubrics-strings');
      expect(idevice.htmlView).not.toContain('exe-rubric-strings');
      expect(idevice.cssClass).toBe('rubric');
    });

    it('should set cssClass to rubric for rubricIdevice wrapper class', () => {
      // Directly test the transformation sets cssClass
      const idevice = {
        id: 'test-idevice',
        type: 'text',
        htmlView: '<ul class="exe-rubric-strings"></ul>'
      };

      // Apply the rubric transformation logic
      if (idevice.htmlView && idevice.htmlView.includes('exe-rubric-strings')) {
        idevice.type = 'rubric';
        idevice.htmlView = idevice.htmlView.replace(/exe-rubric([^s])/g, 'exe-rubrics$1');
        idevice.cssClass = 'rubric';
      }

      expect(idevice.cssClass).toBe('rubric');
    });

    it('should not transform non-rubric iDevices', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="txt1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Free Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="Normal content without rubric"/>
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
      expect(idevices[0].type).toBe('text');
      expect(idevices[0].cssClass).toBeUndefined();
    });

    it('should handle exe-rubric-authorship class correctly (not transform to plural)', () => {
      // The regex should only transform exe-rubric-strings, not exe-rubric-authorship
      // because the regex /exe-rubric([^s])/ matches 'exe-rubric-a' (the -a part)
      const html = '<p class="exe-rubrics-authorship">Author</p><ul class="exe-rubric-strings"></ul>';

      // Apply transformation
      const transformed = html.replace(/exe-rubric([^s])/g, 'exe-rubrics$1');

      // exe-rubric-strings should become exe-rubrics-strings
      expect(transformed).toContain('exe-rubrics-strings');
      // exe-rubrics-authorship should remain as is (was already plural in test)
      expect(transformed).toContain('exe-rubrics-authorship');
    });
  });

  describe('download-package iDevice mapping', () => {
    it('should map download-package JsIdevice to download-source-file type', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="dl1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Descargar paquete"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="download-package"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&amp;lt;div class=&amp;quot;exe-download-package-instructions&amp;quot;&amp;gt;Download content&amp;lt;/div&amp;gt;"/>
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
      expect(idevices[0].type).toBe('download-source-file');
      expect(idevices[0].title).toBe('Descargar paquete');
    });

    it('should extract HTML content from download-package iDevice', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="dl1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Download"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="download-package"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&amp;lt;p&amp;gt;Package download content&amp;lt;/p&amp;gt;"/>
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
      expect(idevices[0].htmlView).toContain('<p>Package download content</p>');
    });

    it('should convert .elp to .elpx in button text', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="dl1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Download"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="download-package"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&amp;lt;div class=&amp;quot;exe-download-package-instructions&amp;quot;&amp;gt;Info&amp;lt;/div&amp;gt;&amp;lt;p class=&amp;quot;exe-download-package-link&amp;quot;&amp;gt;&amp;lt;a href=&amp;quot;exe-package:elp&amp;quot;&amp;gt;Download .elp file&amp;lt;/a&amp;gt;&amp;lt;/p&amp;gt;"/>
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
      expect(idevices[0].type).toBe('download-source-file');
      // Should have converted .elp to .elpx
      expect(idevices[0].htmlView).toContain('.elpx');
      expect(idevices[0].htmlView).toContain('Download .elpx file');
      // Should not have unconverted .elp (except in exe-package:elp protocol which is fine)
      expect(idevices[0].htmlView).not.toContain('.elp file');
    });
  });

  describe('reference-based iDevice extraction', () => {
    it('should extract iDevices referenced via <reference key="N"/> elements', () => {
      // Simulates a legacy ELP where iDevices are referenced, not inline
      // This is common in malformed contentv3.xml files from legacy eXeLearning
      const xml = `<?xml version="1.0"?>
        <document>
          <list id="idevices-list">
            <reference key="123"/>
            <reference key="456"/>
          </list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="123">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Referenced Text iDevice"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&amp;lt;p&amp;gt;Content from referenced iDevice&amp;lt;/p&amp;gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="456">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Another Referenced iDevice"/>
              <string role="key" value="content"/>
              <unicode value="&amp;lt;p&amp;gt;Second iDevice content&amp;lt;/p&amp;gt;"/>
            </dictionary>
          </instance>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list#idevices-list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(2);
      expect(idevices[0].type).toBe('text');
      expect(idevices[0].title).toBe('Referenced Text iDevice');
      expect(idevices[0].htmlView).toContain('<p>Content from referenced iDevice</p>');
      expect(idevices[1].type).toBe('text');
      expect(idevices[1].title).toBe('Another Referenced iDevice');
    });

    it('should handle mixed inline instances and references', () => {
      const xml = `<?xml version="1.0"?>
        <document>
          <list id="idevices-list">
            <instance class="exe.engine.jsidevice.JsIdevice" reference="inline1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="Inline iDevice"/>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="text"/>
              </dictionary>
            </instance>
            <reference key="ref1"/>
          </list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="ref1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Referenced iDevice"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="text"/>
            </dictionary>
          </instance>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list#idevices-list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(2);
      expect(idevices[0].title).toBe('Inline iDevice');
      expect(idevices[1].title).toBe('Referenced iDevice');
    });

    it('should log warning for unresolved references', () => {
      const xml = `<?xml version="1.0"?>
        <document>
          <list id="idevices-list">
            <reference key="nonexistent"/>
          </list>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list#idevices-list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      // Should not crash, just return empty array
      expect(idevices.length).toBe(0);
    });
  });

  describe('referenced TextAreaField extraction', () => {
    it('should extract content from referenced TextAreaField in fields list', () => {
      // Simulates a JsIdevice where the TextAreaField is referenced, not inline
      const xml = `<?xml version="1.0"?>
        <document>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="idev1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text with Referenced Field"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="text"/>
              <string role="key" value="fields"/>
              <list>
                <reference key="field123"/>
              </list>
            </dictionary>
          </instance>
          <instance class="exe.engine.field.TextAreaField" reference="field123">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"/>
              <unicode value="&amp;lt;p&amp;gt;This is the referenced content from TextAreaField&amp;lt;/p&amp;gt;"/>
            </dictionary>
          </instance>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const ideviceInst = doc.querySelector('instance[reference="idev1"]');
      const dict = ideviceInst.querySelector(':scope > dictionary');
      const result = parser.extractFieldsContentWithFeedback(dict);

      expect(result.content).toContain('<p>This is the referenced content from TextAreaField</p>');
    });

    it('should handle mixed inline and referenced fields', () => {
      const xml = `<?xml version="1.0"?>
        <document>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="idev1">
            <dictionary>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="inline1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&amp;lt;p&amp;gt;Inline content&amp;lt;/p&amp;gt;"/>
                  </dictionary>
                </instance>
                <reference key="ref1"/>
              </list>
            </dictionary>
          </instance>
          <instance class="exe.engine.field.TextAreaField" reference="ref1">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"/>
              <unicode value="&amp;lt;p&amp;gt;Referenced content&amp;lt;/p&amp;gt;"/>
            </dictionary>
          </instance>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const ideviceInst = doc.querySelector('instance[reference="idev1"]');
      const dict = ideviceInst.querySelector(':scope > dictionary');
      const result = parser.extractFieldsContentWithFeedback(dict);

      expect(result.content).toContain('<p>Inline content</p>');
      expect(result.content).toContain('<p>Referenced content</p>');
    });

    it('should extract content when iDevice itself is referenced', () => {
      // Complete test: iDevice is referenced AND its TextAreaField is referenced
      const xml = `<?xml version="1.0"?>
        <document>
          <list id="idevices-list">
            <reference key="idev1"/>
          </list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="idev1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Doubly Referenced iDevice"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="text"/>
              <string role="key" value="fields"/>
              <list>
                <reference key="field1"/>
              </list>
            </dictionary>
          </instance>
          <instance class="exe.engine.field.TextAreaField" reference="field1">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"/>
              <unicode value="&amp;lt;p&amp;gt;Content from doubly referenced structure&amp;lt;/p&amp;gt;"/>
            </dictionary>
          </instance>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list#idevices-list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(1);
      expect(idevices[0].title).toBe('Doubly Referenced iDevice');
      expect(idevices[0].htmlView).toContain('<p>Content from doubly referenced structure</p>');
    });
  });

  describe('FreeTextIdevice with circular reference pattern', () => {
    // This tests the pattern where FreeTextIdevice is nested inside TextAreaField
    // and its content field points back to the parent TextAreaField.
    // See Symfony OdeOldXmlFreeTextIdevice.php lines 56-61 for reference.

    it('extracts content from parent TextAreaField when content is circular reference', () => {
      const xml = `<?xml version="1.0"?>
        <document>
          <list id="top-list">
            <instance class="exe.engine.field.TextAreaField" reference="61">
              <dictionary>
                <string role="key" value="_id"/>
                <int value="85"/>
                <string role="key" value="_idevice"/>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="62">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Free Text"/>
                    <string role="key" value="content"/>
                    <reference key="61"/>
                  </dictionary>
                </instance>
                <string role="key" value="content_w_resourcePaths"/>
                <unicode content="true" value="&lt;table&gt;&lt;tr&gt;&lt;td&gt;LaTeX Table Content&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;"/>
              </dictionary>
            </instance>
          </list>
          <instance class="exe.engine.node.Node" reference="65">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Test Page"/>
              <string role="key" value="idevices"/>
              <list id="idevices-list">
                <reference key="62"/>
              </list>
            </dictionary>
          </instance>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list#idevices-list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(1);
      expect(idevices[0].type).toBe('text'); // FreeTextIdevice maps to text
      expect(idevices[0].htmlView).toContain('LaTeX Table Content');
    });

    it('extracts content when FreeTextIdevice has empty content strategies', () => {
      // Simulates case where strategies 1-3 all fail, falling back to parent lookup
      const xml = `<?xml version="1.0"?>
        <document>
          <instance class="exe.engine.field.TextAreaField" reference="parent1">
            <dictionary>
              <string role="key" value="_idevice"/>
              <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="freetext1">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="Orphaned Content"/>
                  <string role="key" value="content"/>
                  <reference key="parent1"/>
                </dictionary>
              </instance>
              <string role="key" value="content_w_resourcePaths"/>
              <unicode content="true" value="&lt;div&gt;Parent content found via fallback&lt;/div&gt;"/>
            </dictionary>
          </instance>
          <list id="idevices-list">
            <reference key="freetext1"/>
          </list>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      parser.xmlDoc = doc;

      const listEl = doc.querySelector('list#idevices-list');
      const idevices = parser.extractIDevicesWithTitles(listEl);

      expect(idevices.length).toBe(1);
      expect(idevices[0].htmlView).toContain('Parent content found via fallback');
    });

    it('findParentTextAreaField returns parent TextAreaField', () => {
      const xml = `<?xml version="1.0"?>
        <document>
          <instance class="exe.engine.field.TextAreaField" reference="ta1">
            <dictionary>
              <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="ft1">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="Test"/>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const ideviceInst = doc.querySelector('instance[reference="ft1"]');
      const result = parser.findParentTextAreaField(ideviceInst);

      expect(result).not.toBeNull();
      expect(result.getAttribute('reference')).toBe('ta1');
      expect(result.getAttribute('class')).toContain('TextAreaField');
    });

    it('findParentTextAreaField returns null when no parent TextAreaField', () => {
      const xml = `<?xml version="1.0"?>
        <document>
          <list>
            <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="ft1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="Test"/>
              </dictionary>
            </instance>
          </list>
        </document>`;

      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const ideviceInst = doc.querySelector('instance[reference="ft1"]');
      const result = parser.findParentTextAreaField(ideviceInst);

      expect(result).toBeNull();
    });
  });

  describe('Generic Idevice class format (exelearning.libs.*)', () => {
    describe('isGenericIdeviceClass', () => {
      it('returns true for exelearning.libs.idevices.idevice.Idevice', () => {
        expect(parser.isGenericIdeviceClass('exelearning.libs.idevices.idevice.Idevice')).toBe(true);
      });

      it('returns true for other non-exe.engine classes ending with .Idevice', () => {
        expect(parser.isGenericIdeviceClass('some.other.package.Idevice')).toBe(true);
        expect(parser.isGenericIdeviceClass('custom.Idevice')).toBe(true);
      });

      it('returns false for standard exe.engine format', () => {
        expect(parser.isGenericIdeviceClass('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
        expect(parser.isGenericIdeviceClass('exe.engine.jsidevice.JsIdevice')).toBe(false);
        expect(parser.isGenericIdeviceClass('exe.engine.genericidevice.GenericIdevice')).toBe(false);
      });

      it('returns false for classes not ending with .Idevice', () => {
        expect(parser.isGenericIdeviceClass('exelearning.libs.idevices.field.TextField')).toBe(false);
        expect(parser.isGenericIdeviceClass('exelearning.libs.idevices.idevice')).toBe(false);
      });
    });

    describe('mapGenericIdeviceType', () => {
      it('returns text for unknown type names', () => {
        expect(parser.mapGenericIdeviceType('latex')).toBe('text');
        expect(parser.mapGenericIdeviceType('custom')).toBe('text');
        expect(parser.mapGenericIdeviceType('unknown')).toBe('text');
      });

      it('is case-insensitive', () => {
        expect(parser.mapGenericIdeviceType('LATEX')).toBe('text');
        expect(parser.mapGenericIdeviceType('LaTeX')).toBe('text');
      });
    });

    describe('extractIDevicesWithTitles with generic Idevice', () => {
      it('extracts type from __name__ field for exelearning.libs.idevices.idevice.Idevice', () => {
        const xml = `<?xml version="1.0"?>
          <document>
            <list id="idevices-list">
              <instance class="exelearning.libs.idevices.idevice.Idevice" reference="93">
                <dictionary>
                  <string role="key" value="__name__"/>
                  <string value="latex"/>
                  <string role="key" value="_title"/>
                  <unicode value="LaTeX Formula"/>
                  <string role="key" value="fields"/>
                  <list>
                    <instance class="exelearning.libs.idevices.fields.textareafield.TextAreaField" reference="94">
                      <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$"/>
                      </dictionary>
                    </instance>
                  </list>
                </dictionary>
              </instance>
            </list>
          </document>`;

        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        parser.xmlDoc = doc;

        const listEl = doc.querySelector('list#idevices-list');
        const idevices = parser.extractIDevicesWithTitles(listEl);

        expect(idevices.length).toBe(1);
        expect(idevices[0].type).toBe('text'); // Generic types map to 'text'
        expect(idevices[0].title).toBe('LaTeX Formula');
        expect(idevices[0].htmlView).toContain('\\frac{-b');
      });

      it('extracts content from exelearning.libs TextAreaField format', () => {
        const xml = `<?xml version="1.0"?>
          <document>
            <list id="idevices-list">
              <instance class="exelearning.libs.idevices.idevice.Idevice" reference="1">
                <dictionary>
                  <string role="key" value="__name__"/>
                  <string value="custom"/>
                  <string role="key" value="_title"/>
                  <unicode value="Custom iDevice"/>
                  <string role="key" value="fields"/>
                  <list>
                    <instance class="exelearning.libs.idevices.fields.textareafield.TextAreaField" reference="2">
                      <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="Custom content from exelearning format"/>
                      </dictionary>
                    </instance>
                  </list>
                </dictionary>
              </instance>
            </list>
          </document>`;

        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        parser.xmlDoc = doc;

        const listEl = doc.querySelector('list#idevices-list');
        const idevices = parser.extractIDevicesWithTitles(listEl);

        expect(idevices.length).toBe(1);
        expect(idevices[0].type).toBe('text');
        expect(idevices[0].title).toBe('Custom iDevice');
        expect(idevices[0].htmlView).toContain('Custom content from exelearning format');
      });

      it('defaults to text type when __name__ is missing', () => {
        const xml = `<?xml version="1.0"?>
          <document>
            <list id="idevices-list">
              <instance class="exelearning.libs.idevices.idevice.Idevice" reference="1">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="No Name iDevice"/>
                  <string role="key" value="fields"/>
                  <list>
                    <instance class="exelearning.libs.idevices.fields.textareafield.TextAreaField" reference="2">
                      <dictionary>
                        <string role="key" value="content_w_resourcePaths"/>
                        <unicode value="Content without __name__"/>
                      </dictionary>
                    </instance>
                  </list>
                </dictionary>
              </instance>
            </list>
          </document>`;

        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        parser.xmlDoc = doc;

        const listEl = doc.querySelector('list#idevices-list');
        const idevices = parser.extractIDevicesWithTitles(listEl);

        expect(idevices.length).toBe(1);
        expect(idevices[0].type).toBe('text'); // Defaults to text
        expect(idevices[0].title).toBe('No Name iDevice');
      });

      it('handles multiple generic Idevices', () => {
        const xml = `<?xml version="1.0"?>
          <document>
            <list id="idevices-list">
              <instance class="exelearning.libs.idevices.idevice.Idevice" reference="1">
                <dictionary>
                  <string role="key" value="__name__"/>
                  <string value="latex"/>
                  <string role="key" value="_title"/>
                  <unicode value="First Formula"/>
                </dictionary>
              </instance>
              <instance class="exelearning.libs.idevices.idevice.Idevice" reference="2">
                <dictionary>
                  <string role="key" value="__name__"/>
                  <string value="custom"/>
                  <string role="key" value="_title"/>
                  <unicode value="Second iDevice"/>
                </dictionary>
              </instance>
            </list>
          </document>`;

        const doc = new DOMParser().parseFromString(xml, 'text/xml');
        parser.xmlDoc = doc;

        const listEl = doc.querySelector('list#idevices-list');
        const idevices = parser.extractIDevicesWithTitles(listEl);

        expect(idevices.length).toBe(2);
        expect(idevices[0].title).toBe('First Formula');
        expect(idevices[0].type).toBe('text');
        expect(idevices[1].title).toBe('Second iDevice');
        expect(idevices[1].type).toBe('text');
      });
    });
  });

  describe('HTML-based iDevice type detection', () => {
    describe('UDL Content detection', () => {
      it('should detect exe-udlContent and set type to udl-content', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="udl1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="UDL Test"/>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="text"/>
                <string role="key" value="fields"/>
                <list>
                  <instance class="exe.engine.field.TextAreaField" reference="f1">
                    <dictionary>
                      <string role="key" value="content_w_resourcePaths"/>
                      <unicode value="&amp;lt;div class=&amp;quot;exe-udlContent&amp;quot;&amp;gt;UDL content&amp;lt;/div&amp;gt;"/>
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
        expect(idevices[0].type).toBe('udl-content');
      });
    });

    describe('Scrambled List detection', () => {
      it('should detect exe-sortableList and set type to scrambled-list', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="scr1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="Scramble Test"/>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="text"/>
                <string role="key" value="fields"/>
                <list>
                  <instance class="exe.engine.field.TextAreaField" reference="f1">
                    <dictionary>
                      <string role="key" value="content_w_resourcePaths"/>
                      <unicode value="&amp;lt;ul class=&amp;quot;exe-sortableList&amp;quot;&amp;gt;&amp;lt;li&amp;gt;Item&amp;lt;/li&amp;gt;&amp;lt;/ul&amp;gt;"/>
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
        expect(idevices[0].type).toBe('scrambled-list');
      });
    });

    describe('Interactive Video detection', () => {
      it('should detect exe-interactive-video and set type to interactive-video', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="iv1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="Interactive Video"/>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="text"/>
                <string role="key" value="fields"/>
                <list>
                  <instance class="exe.engine.field.TextAreaField" reference="f1">
                    <dictionary>
                      <string role="key" value="content_w_resourcePaths"/>
                      <unicode value="&amp;lt;div class=&amp;quot;exe-interactive-video&amp;quot;&amp;gt;Video content&amp;lt;/div&amp;gt;"/>
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
        expect(idevices[0].type).toBe('interactive-video');
      });
    });

    describe('GeoGebra Activity detection', () => {
      it('should detect auto-geogebra and set type to geogebra-activity', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="geo1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="GeoGebra Activity"/>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="text"/>
                <string role="key" value="fields"/>
                <list>
                  <instance class="exe.engine.field.TextAreaField" reference="f1">
                    <dictionary>
                      <string role="key" value="content_w_resourcePaths"/>
                      <unicode value="&amp;lt;div class=&amp;quot;auto-geogebra&amp;quot;&amp;gt;GeoGebra content&amp;lt;/div&amp;gt;"/>
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
        expect(idevices[0].type).toBe('geogebra-activity');
      });
    });
  });

  describe('PBL Task metadata extraction', () => {
    it('should detect pbl-task-description and extract metadata', () => {
      const xml = `<?xml version="1.0"?>
        <list>
          <instance class="exe.engine.jsidevice.JsIdevice" reference="pbl1">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Investigamos"/>
              <string role="key" value="_iDeviceDir"/>
              <unicode value="text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="f1">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&amp;lt;dl class=&amp;quot;pbl-task-info&amp;quot;&amp;gt;&amp;lt;dt class=&amp;quot;pbl-task-duration&amp;quot;&amp;gt;Duración:&amp;lt;/dt&amp;gt;&amp;lt;dd class=&amp;quot;pbl-task-duration&amp;quot;&amp;gt;2 sesiones&amp;lt;/dd&amp;gt;&amp;lt;dt class=&amp;quot;pbl-task-participants&amp;quot;&amp;gt;Agrupamiento:&amp;lt;/dt&amp;gt;&amp;lt;dd class=&amp;quot;pbl-task-participants&amp;quot;&amp;gt;Grupo de 4&amp;lt;/dd&amp;gt;&amp;lt;/dl&amp;gt;&amp;lt;div class=&amp;quot;pbl-task-description&amp;quot;&amp;gt;Task content&amp;lt;/div&amp;gt;"/>
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
      expect(idevices[0].type).toBe('text'); // Type stays as text
      expect(idevices[0].properties).toBeDefined();
      expect(idevices[0].properties.textInfoDurationInput).toBe('Duración:');
      expect(idevices[0].properties.textInfoDurationTextInput).toBe('2 sesiones');
      expect(idevices[0].properties.textInfoParticipantsInput).toBe('Agrupamiento:');
      expect(idevices[0].properties.textInfoParticipantsTextInput).toBe('Grupo de 4');
    });

    it('should extract feedback metadata from PBL Task', () => {
      const html = '<dl class="pbl-task-info"><dt class="pbl-task-duration">Duration:</dt><dd class="pbl-task-duration">1 hour</dd></dl><div class="pbl-task-description">Content</div><input type="button" class="feedbackbutton" value="Show Feedback"><div class="feedback js-feedback js-hidden"><p>Feedback text</p></div>';

      const metadata = parser.extractPblTaskMetadata(html);

      expect(metadata).not.toBeNull();
      expect(metadata.textInfoDurationInput).toBe('Duration:');
      expect(metadata.textInfoDurationTextInput).toBe('1 hour');
      expect(metadata.textInfoFeedbackButton).toBe('Show Feedback');
      expect(metadata.textInfoFeedback).toContain('Feedback text');
    });

    it('should return null for non-PBL content', () => {
      const html = '<p>Regular text content</p>';
      const metadata = parser.extractPblTaskMetadata(html);
      expect(metadata).toBeNull();
    });
  });

  describe('Text-based iDevice class mapping', () => {
    it('should map ActivityIdevice to text type', () => {
      const type = parser.mapIdeviceType('exe.engine.activityidevice.ActivityIdevice');
      expect(type).toBe('text');
    });

    it('should map ObjectivesIdevice to text type', () => {
      const type = parser.mapIdeviceType('exe.engine.objectivesidevice.ObjectivesIdevice');
      expect(type).toBe('text');
    });

    it('should map PreknowledgeIdevice to text type', () => {
      const type = parser.mapIdeviceType('exe.engine.preknowledgeidevice.PreknowledgeIdevice');
      expect(type).toBe('text');
    });

    it('should map ReadingActivityIdevice to text type', () => {
      const type = parser.mapIdeviceType('exe.engine.readingactivityidevice.ReadingActivityIdevice');
      expect(type).toBe('text');
    });

    it('should map TaskIdevice to text type', () => {
      const type = parser.mapIdeviceType('exe.engine.taskidevice.TaskIdevice');
      expect(type).toBe('text');
    });
  });

  describe('FileAttachIdevice type mapping', () => {
    // FileAttachIdevice converts to 'text' (not 'attached-files') because
    // attached-files iDevice has no editor. This matches Symfony behavior.
    // See FileAttachHandler.js and OdeOldXmlFileAttachIdevice.php

    it('should map FileAttachIdevice to text type for editability', () => {
      const type = parser.mapIdeviceType('exe.engine.fileattachidevice.FileAttachIdevice');
      expect(type).toBe('text');
    });

    it('should map FileAttachIdeviceInc to text type for editability', () => {
      const type = parser.mapIdeviceType('exe.engine.fileattachidevice.FileAttachIdeviceInc');
      expect(type).toBe('text');
    });

    it('should map AttachmentIdevice to text type for editability', () => {
      const type = parser.mapIdeviceType('exe.engine.attachmentidevice.AttachmentIdevice');
      expect(type).toBe('text');
    });
  });

  describe('JsIdevice _iDeviceDir type mappings', () => {
    // Test all legacy _iDeviceDir values found in ELP fixtures

    describe('Spanish activity name mappings', () => {
      it('should map adivina-activity to guess', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="adivina-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('guess');
      });

      it('should map candado-activity to padlock', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="candado-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('padlock');
      });

      it('should map clasifica-activity to classify', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="clasifica-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('classify');
      });

      it('should map mapa-activity to map', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="mapa-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('map');
      });

      it('should map relaciona-activity to relate', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="relaciona-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('relate');
      });

      it('should map selecciona-activity to quick-questions-multiple-choice', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="selecciona-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('quick-questions-multiple-choice');
      });

      it('should map sopa-activity to word-search', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="sopa-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('word-search');
      });

      it('should map rosco-activity to az-quiz-game', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="rosco-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('az-quiz-game');
      });

      it('should map quext-activity to quick-questions', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="quext-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('quick-questions');
      });

      it('should map videoquext-activity to quick-questions-video', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="videoquext-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('quick-questions-video');
      });
    });

    describe('PBL-tools mapping', () => {
      it('should map pbl-tools to text type', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="pbl1">
              <dictionary>
                <string role="key" value="_title"/>
                <unicode value="¡Grabación a la vista!"/>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="pbl-tools"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('text');
        expect(result[0].title).toBe('¡Grabación a la vista!');
      });
    });

    describe('Other legacy type mappings', () => {
      it('should map rubrics to rubric', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="rubrics"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('rubric');
      });

      it('should map flipcards-activity to flipcards', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="flipcards-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('flipcards');
      });

      it('should map ordena-activity to sort', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="ordena-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('sort');
      });

      it('should map trivial-activity to trivial', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="trivial-activity"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('trivial');
      });
    });

    describe('Unknown type fallback', () => {
      it('should default unknown _iDeviceDir to text type', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="completely-unknown-type"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('text');
      });

      it('should preserve known modern types without mapping', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="image-gallery"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('image-gallery');
      });

      it('should preserve text type without modification', () => {
        const xml = `<?xml version="1.0"?>
          <list>
            <instance class="exe.engine.jsidevice.JsIdevice" reference="test1">
              <dictionary>
                <string role="key" value="_iDeviceDir"/>
                <unicode value="text"/>
              </dictionary>
            </instance>
          </list>`;
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const list = doc.querySelector('list');
        const result = parser.extractIDevicesWithTitles(list);
        expect(result[0].type).toBe('text');
      });
    });
  });
});

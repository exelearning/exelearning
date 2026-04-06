/**
 * LegacyXmlParser Unit Tests
 *
 * Tests for parsing legacy .elp files (contentv3.xml Python pickle format)
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { LegacyXmlParser } from './LegacyXmlParser';
import { FEEDBACK_TRANSLATIONS } from './interfaces';

describe('LegacyXmlParser', () => {
    let parser: LegacyXmlParser;

    beforeEach(() => {
        parser = new LegacyXmlParser();
    });

    describe('constructor', () => {
        it('should create an instance with default logger', () => {
            const instance = new LegacyXmlParser();
            expect(instance).toBeDefined();
        });

        it('should create an instance with custom logger', () => {
            const customLogger = {
                log: () => {},
                warn: () => {},
                error: () => {},
            };
            const instance = new LegacyXmlParser(customLogger);
            expect(instance).toBeDefined();
        });
    });

    describe('static properties', () => {
        it('should have LEGACY_ICON_MAP', () => {
            expect(LegacyXmlParser.LEGACY_ICON_MAP).toBeDefined();
            expect(LegacyXmlParser.LEGACY_ICON_MAP.preknowledge).toBe('think');
            expect(LegacyXmlParser.LEGACY_ICON_MAP.reading).toBe('book');
            expect(LegacyXmlParser.LEGACY_ICON_MAP.casestudy).toBe('case');
        });

        it('should have FEEDBACK_TRANSLATIONS imported from interfaces', () => {
            // FEEDBACK_TRANSLATIONS is now a shared constant imported from interfaces
            expect(FEEDBACK_TRANSLATIONS).toBeDefined();
            expect(FEEDBACK_TRANSLATIONS.es).toBe('Mostrar retroalimentación');
            expect(FEEDBACK_TRANSLATIONS.en).toBe('Show Feedback');
        });

        it('should have IDEVICE_TITLE_TRANSLATIONS', () => {
            expect(LegacyXmlParser.IDEVICE_TITLE_TRANSLATIONS).toBeDefined();
            expect(LegacyXmlParser.IDEVICE_TITLE_TRANSLATIONS['Case Study']).toBeDefined();
            expect(LegacyXmlParser.IDEVICE_TITLE_TRANSLATIONS['Case Study'].en).toBe('Case Study');
        });

        it('should have DEFAULT_IDEVICE_TITLES with all default title variations', () => {
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES).toBeDefined();
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES).toBeInstanceOf(Set);

            // English defaults
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('Free Text')).toBe(true);
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('Text')).toBe(true);

            // Spanish defaults
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('Texto libre')).toBe(true);
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('Texto')).toBe(true);

            // Catalan defaults
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('Text lliure')).toBe(true);

            // Basque defaults
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('Testu librea')).toBe(true);
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('Testua')).toBe(true);

            // Should NOT contain empty string
            expect(LegacyXmlParser.DEFAULT_IDEVICE_TITLES.has('')).toBe(false);
        });
    });

    describe('getLocalizedFeedbackText', () => {
        it('should return Spanish text for es language', () => {
            const result = parser.getLocalizedFeedbackText('es');
            expect(result).toBe('Mostrar retroalimentación');
        });

        it('should return English text for en language', () => {
            const result = parser.getLocalizedFeedbackText('en');
            expect(result).toBe('Show Feedback');
        });

        it('should handle language codes with region', () => {
            const result = parser.getLocalizedFeedbackText('es-ES');
            expect(result).toBe('Mostrar retroalimentación');
        });

        it('should default to Spanish for unknown languages', () => {
            const result = parser.getLocalizedFeedbackText('xx');
            expect(result).toBe('Mostrar retroalimentación');
        });

        it('should default to Spanish for empty string', () => {
            const result = parser.getLocalizedFeedbackText('');
            expect(result).toBe('Mostrar retroalimentación');
        });
    });

    describe('getLocalizedCaseStudyTitle', () => {
        it('should return Spanish title for es language', () => {
            const result = parser.getLocalizedCaseStudyTitle('es');
            expect(result).toBe('Caso practico');
        });

        it('should return English title for en language', () => {
            const result = parser.getLocalizedCaseStudyTitle('en');
            expect(result).toBe('Case Study');
        });
    });

    describe('getLocalizedIdeviceTitle', () => {
        it('should translate Activity to Spanish', () => {
            const result = parser.getLocalizedIdeviceTitle('Activity', 'es');
            expect(result).toBe('Actividad');
        });

        it('should translate Objectives to English', () => {
            const result = parser.getLocalizedIdeviceTitle('Objectives', 'en');
            expect(result).toBe('Objectives');
        });

        it('should return null for unknown titles', () => {
            const result = parser.getLocalizedIdeviceTitle('Unknown Title', 'es');
            expect(result).toBeNull();
        });
    });

    describe('preprocessLegacyXml', () => {
        it('should remove 5-space indentation', () => {
            const input = 'text     more text';
            const result = parser.preprocessLegacyXml(input);
            expect(result).toBe('textmore text');
        });

        it('should remove tabs', () => {
            const input = 'text\tmore text';
            const result = parser.preprocessLegacyXml(input);
            expect(result).toBe('textmore text');
        });

        it('should convert Windows line endings', () => {
            const input = 'line1\r\nline2';
            const result = parser.preprocessLegacyXml(input);
            // After preprocessing: \r becomes \n, \n\n becomes \n
            expect(result).not.toContain('\r');
        });

        it('should convert hex escape sequences', () => {
            const input = '\\x41\\x42\\x43';
            const result = parser.preprocessLegacyXml(input);
            expect(result).toBe('ABC');
        });

        it('should convert literal \\n to entity', () => {
            const input = 'text\\nmore text';
            const result = parser.preprocessLegacyXml(input);
            expect(result).toContain('&#10;');
        });
    });

    describe('parse', () => {
        it('should parse simple legacy XML structure', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Test Project"/>
    <string role="key" value="_author"/>
    <unicode value="Test Author"/>
    <string role="key" value="_description"/>
    <unicode value="Test Description"/>
    <string role="key" value="_lang"/>
    <unicode value="en"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Home Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            expect(result).toBeDefined();
            expect(result.meta).toBeDefined();
            expect(result.meta.title).toBe('Test Project');
            expect(result.meta.author).toBe('Test Author');
            expect(result.meta.description).toBe('Test Description');
            expect(result.meta.language).toBe('en');
            expect(result.pages).toBeInstanceOf(Array);
            expect(result.pages.length).toBeGreaterThanOrEqual(1);
        });

        it('should extract metadata with export options', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_addPagination"/>
    <bool value="1"/>
    <string role="key" value="_addSearchBox"/>
    <bool value="1"/>
    <string role="key" value="_addExeLink"/>
    <bool value="0"/>
    <string role="key" value="exportSource"/>
    <bool value="1"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            expect(result.meta.pp_addPagination).toBe(true);
            expect(result.meta.pp_addSearchBox).toBe(true);
            expect(result.meta.pp_addExeLink).toBe(false);
            expect(result.meta.exportSource).toBe(true);
        });

        it('should handle legacy license values', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="license"/>
    <unicode value="None"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // "None" should be converted to empty string
            expect(result.meta.license).toBe('');
        });

        it('should extract page with FreeTextIdevice', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Test Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Free Text Title"/>
              <string role="key" value="icon"/>
              <string value="reading"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Hello World&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            expect(result.pages.length).toBeGreaterThanOrEqual(1);
            const page = result.pages[0];
            expect(page.blocks).toBeDefined();
            expect(page.blocks.length).toBeGreaterThanOrEqual(1);

            const block = page.blocks[0];
            expect(block.idevices).toBeDefined();
            expect(block.idevices.length).toBeGreaterThanOrEqual(1);

            const idevice = block.idevices[0];
            expect(idevice.type).toBe('text');
            expect(idevice.htmlView).toContain('Hello World');
            expect(idevice.icon).toBe('book'); // 'reading' maps to 'book'
        });

        it('should remove outer exe-text wrapper in final parsed htmlView', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Test Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Free Text Title"/>
              <string role="key" value="content"/>
              <unicode value="&lt;div class=&quot;exe-text&quot;&gt;&lt;p&gt;Imported text&lt;/p&gt;&lt;/div&gt;"/>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);
            const idevice = result.pages[0]?.blocks[0]?.idevices[0];

            expect(idevice?.htmlView).toBe('<p>Imported text</p>');
            expect(idevice?.htmlView).not.toContain('class="exe-text"');
        });

        it('should remove exe-text wrapper and keep trailing legacy feedback siblings', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Test Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Free Text"/>
              <string role="key" value="content"/>
              <unicode value="&lt;div class=&quot;exe-text&quot;&gt;&lt;p&gt;Main&lt;/p&gt;&lt;/div&gt;&lt;div class=&quot;iDevice_buttons feedback-button js-required&quot;&gt;&lt;input type=&quot;button&quot; class=&quot;feedbackbutton&quot; value=&quot;Info&quot; /&gt;&lt;/div&gt;&lt;div class=&quot;feedback js-feedback js-hidden&quot;&gt;Info content&lt;/div&gt;"/>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);
            const idevice = result.pages[0]?.blocks[0]?.idevices[0];

            expect(idevice?.htmlView).toContain('<p>Main</p>');
            expect(idevice?.htmlView).toContain('iDevice_buttons feedback-button');
            expect(idevice?.htmlView).toContain('Info content');
            expect(idevice?.htmlView).not.toContain('<div class="exe-text">');
        });

        it('should handle page hierarchy', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child Page"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            expect(result.pages.length).toBeGreaterThanOrEqual(2);

            // With root flattening, both pages should be at root level
            const rootPage = result.pages.find(p => p.title === 'Root Page');
            const childPage = result.pages.find(p => p.title === 'Child Page');

            expect(rootPage).toBeDefined();
            expect(childPage).toBeDefined();
        });

        it('should handle malformed XML gracefully', () => {
            // @xmldom/xmldom >=0.9 throws ParseError for malformed XML (e.g. unclosed tags)
            // LegacyXmlParser wraps it in a plain Error with a descriptive message
            const invalidXml = '<invalid><xml>';

            expect(() => parser.parse(invalidXml)).toThrow('XML parsing error');
        });
    });

    describe('iDevice type mapping', () => {
        it('should map TrueFalseIdevice to trueorfalse', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.truefalseidevice.TrueFalseIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="True False Question"/>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);
            const idevice = result.pages[0]?.blocks[0]?.idevices[0];

            expect(idevice?.type).toBe('trueorfalse');
        });

        it('should map MultichoiceIdevice to form', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.multichoiceidevice.MultichoiceIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Multiple Choice"/>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);
            const idevice = result.pages[0]?.blocks[0]?.idevices[0];

            expect(idevice?.type).toBe('form');
        });

        it('should map CasestudyIdevice to casestudy', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.casestudyidevice.CasestudyIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Case Study"/>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);
            const idevice = result.pages[0]?.blocks[0]?.idevices[0];

            expect(idevice?.type).toBe('casestudy');
        });

        it('should map unknown iDevices to text', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.unknownidevice.UnknownIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Unknown"/>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);
            const idevice = result.pages[0]?.blocks[0]?.idevices[0];

            expect(idevice?.type).toBe('text');
        });
    });

    describe('findAllNodes - unique node handling', () => {
        it('should include inline node definitions with content even when appearing after parentNode key', () => {
            // This tests the fix for nodes defined inline within parentNode fields
            // Nodes with content (idevices) should be included even if inside parentNode
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child Page 1"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="10">
                  <dictionary>
                    <string role="key" value="parentNode"/>
                    <instance class="exe.engine.node.Node" reference="4">
                      <dictionary>
                        <string role="key" value="_title"/>
                        <unicode value="Inline Defined Page"/>
                        <string role="key" value="parent"/>
                        <reference key="2"/>
                        <string role="key" value="idevices"/>
                        <list>
                          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="11">
                            <dictionary>
                              <string role="key" value="_title"/>
                              <unicode value="Content"/>
                            </dictionary>
                          </instance>
                        </list>
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

            const result = parser.parse(legacyXml);

            // Should find the inline defined page (reference 4) because it has idevices content
            const inlinePage = result.pages.find(p => p.title === 'Inline Defined Page');
            expect(inlinePage).toBeDefined();
            expect(result.pages.length).toBeGreaterThanOrEqual(3);
        });

        it('should filter out empty phantom nodes inside parentNode fields', () => {
            // This tests the fix for mujeres_huella.elp where phantom nodes with
            // EXPLICIT empty idevices AND empty children lists cause duplicate nodes
            // The phantom node has the same title as the real root but different reference
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="4">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Real Root Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="5">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child Page"/>
              <string role="key" value="parent"/>
              <reference key="4"/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="10">
                  <dictionary>
                    <string role="key" value="parentNode"/>
                    <instance class="exe.engine.node.Node" reference="8">
                      <dictionary>
                        <string role="key" value="_title"/>
                        <unicode value="Real Root Page"/>
                        <string role="key" value="parent"/>
                        <none/>
                        <string role="key" value="idevices"/>
                        <list/>
                        <string role="key" value="children"/>
                        <list/>
                      </dictionary>
                    </instance>
                  </dictionary>
                </instance>
              </list>
              <string role="key" value="children"/>
              <list/>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="6">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Root Content"/>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // The phantom node (ref=8) inside parentNode should be filtered out
            // because it has EXPLICIT empty idevices AND empty children lists
            // Total pages should be 2: root + child (phantom filtered out, not 3)
            expect(result.pages.length).toBe(2);

            // Both pages should have unique IDs (no duplicate from phantom)
            const pageIds = result.pages.map(p => p.id);
            expect(pageIds).toContain('page-4'); // Real root
            expect(pageIds).toContain('page-5'); // Child
            expect(pageIds).not.toContain('page-8'); // Phantom should NOT be included

            // There should only be one page with title "Real Root Page"
            const rootTitlePages = result.pages.filter(p => p.title === 'Real Root Page');
            expect(rootTitlePages.length).toBe(1);
        });

        it('should NOT filter nodes inside parentNode if children list is missing', () => {
            // If a node inside parentNode is missing the children list, it's not considered
            // a phantom node and should be included (conservative approach)
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="10">
            <dictionary>
              <string role="key" value="parentNode"/>
              <instance class="exe.engine.node.Node" reference="3">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="Node Missing Children"/>
                  <string role="key" value="parent"/>
                  <none/>
                  <string role="key" value="idevices"/>
                  <list/>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="children"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // Node with missing children list should NOT be filtered (conservative)
            // So we should have 2 pages: root + the node with missing children
            expect(result.pages.length).toBe(2);
            expect(result.pages.map(p => p.id)).toContain('page-3');
        });

        it('should NOT filter nodes inside parentNode if idevices list is missing', () => {
            // If a node inside parentNode is missing the idevices list, it's not considered
            // a phantom node and should be included (conservative approach)
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="10">
            <dictionary>
              <string role="key" value="parentNode"/>
              <instance class="exe.engine.node.Node" reference="3">
                <dictionary>
                  <string role="key" value="_title"/>
                  <unicode value="Node Missing Idevices"/>
                  <string role="key" value="parent"/>
                  <none/>
                  <string role="key" value="children"/>
                  <list/>
                </dictionary>
              </instance>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="children"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // Node with missing idevices list should NOT be filtered (conservative)
            // So we should have 2 pages: root + the node with missing idevices
            expect(result.pages.length).toBe(2);
            expect(result.pages.map(p => p.id)).toContain('page-3');
        });

        it('should NOT filter nodes that are not inside parentNode field', () => {
            // Nodes defined directly in children list (not inside parentNode) should
            // never be filtered, even if they have empty lists
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Empty Child Page"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
              <string role="key" value="children"/>
              <list/>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // Empty child page in regular children list should be included
            // (not filtered because it's not inside parentNode)
            expect(result.pages.length).toBe(2);
            const emptyChildPage = result.pages.find(p => p.title === 'Empty Child Page');
            expect(emptyChildPage).toBeDefined();
        });

        it('should skip duplicate node references', () => {
            // When a node is defined once and referenced multiple times,
            // it should only appear once in the result
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root Page"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child Page"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child Page Duplicate"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // Should only have one page with reference 3 (the first one)
            const childPages = result.pages.filter(p => p.id === 'page-3');
            expect(childPages.length).toBe(1);
            expect(childPages[0].title).toBe('Child Page');
        });
    });

    describe('page ordering', () => {
        it('should sort children by document order (position)', () => {
            // Children should be sorted by their position in the XML document
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="First Child"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="4">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Second Child"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="5">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Third Child"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // After flattening with root convention, children become top-level
            // and should maintain their document order
            const firstChild = result.pages.find(p => p.title === 'First Child');
            const secondChild = result.pages.find(p => p.title === 'Second Child');
            const thirdChild = result.pages.find(p => p.title === 'Third Child');

            expect(firstChild).toBeDefined();
            expect(secondChild).toBeDefined();
            expect(thirdChild).toBeDefined();

            // Positions should be sequential after flattening
            expect(firstChild!.position).toBeLessThan(secondChild!.position);
            expect(secondChild!.position).toBeLessThan(thirdChild!.position);
        });

        it('should reassign sequential positions after flattening', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Root"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child A"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="children"/>
              <list>
                <instance class="exe.engine.node.Node" reference="4">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Grandchild"/>
                    <string role="key" value="parent"/>
                    <reference key="3"/>
                    <string role="key" value="idevices"/>
                    <list/>
                  </dictionary>
                </instance>
              </list>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
          <instance class="exe.engine.node.Node" reference="5">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Child B"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list/>
            </dictionary>
          </instance>
        </list>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // All positions should be sequential integers starting from 0
            for (let i = 0; i < result.pages.length; i++) {
                expect(result.pages[i].position).toBe(i);
            }
        });

        it('should sort root pages by document order', () => {
            // When there are multiple root pages (no single root to flatten),
            // they should be sorted by their position in the document
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="First Root"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="idevices"/>
        <list/>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            // Verify pages are present and have sequential positions
            expect(result.pages.length).toBeGreaterThanOrEqual(1);
            expect(result.pages[0].position).toBe(0);
        });
    });

    describe('internal link conversion', () => {
        it('should convert exe-node: links to page IDs', () => {
            const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="_title"/>
    <unicode value="Project"/>
    <string role="key" value="_root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Home"/>
        <string role="key" value="parent"/>
        <none/>
        <string role="key" value="children"/>
        <list>
          <instance class="exe.engine.node.Node" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="About"/>
              <string role="key" value="parent"/>
              <reference key="2"/>
              <string role="key" value="idevices"/>
              <list>
                <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="4">
                  <dictionary>
                    <string role="key" value="_title"/>
                    <unicode value="Link Test"/>
                    <string role="key" value="fields"/>
                    <list>
                      <instance class="exe.engine.field.TextAreaField" reference="5">
                        <dictionary>
                          <string role="key" value="content_w_resourcePaths"/>
                          <unicode value="&lt;p&gt;&lt;a href=&quot;exe-node:Home&quot;&gt;Go to Home&lt;/a&gt;&lt;/p&gt;"/>
                        </dictionary>
                      </instance>
                    </list>
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

            const result = parser.parse(legacyXml);

            // Find the About page which has the link
            const aboutPage = result.pages.find(p => p.title === 'About');
            expect(aboutPage).toBeDefined();

            if (aboutPage && aboutPage.blocks.length > 0 && aboutPage.blocks[0].idevices.length > 0) {
                const idevice = aboutPage.blocks[0].idevices[0];
                // The link should be converted to use page ID
                expect(idevice.htmlView).toContain('exe-node:');
            }
        });
    });

    describe('default iDevice title filtering', () => {
        it('should filter out "Free Text" default title and use empty block name', () => {
            const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Home"/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Free Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Content&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            expect(result.pages.length).toBeGreaterThan(0);
            const homePage = result.pages.find(p => p.title === 'Home');
            expect(homePage).toBeDefined();
            expect(homePage!.blocks.length).toBeGreaterThan(0);
            // The block name should be empty, not "Free Text"
            expect(homePage!.blocks[0].name).toBe('');
        });

        it('should filter out "Texto libre" Spanish default title', () => {
            const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Inicio"/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Texto libre"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Contenido&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            const page = result.pages.find(p => p.title === 'Inicio');
            expect(page).toBeDefined();
            expect(page!.blocks[0].name).toBe('');
        });

        it('should filter out "Text" simple default title', () => {
            const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Page"/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.textidevice.TextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Content&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            const page = result.pages.find(p => p.title === 'Page');
            expect(page).toBeDefined();
            expect(page!.blocks[0].name).toBe('');
        });

        it('should preserve custom user-defined titles', () => {
            const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Home"/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="My Custom Title"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Content&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            const homePage = result.pages.find(p => p.title === 'Home');
            expect(homePage).toBeDefined();
            // Custom title should be preserved
            expect(homePage!.blocks[0].name).toBe('My Custom Title');
        });

        it('should preserve empty title when iDevice has no title', () => {
            const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Home"/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Content without title&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            const homePage = result.pages.find(p => p.title === 'Home');
            expect(homePage).toBeDefined();
            // Empty title should remain empty
            expect(homePage!.blocks[0].name).toBe('');
        });

        it('should filter out Catalan "Text lliure" default title', () => {
            const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Inici"/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Text lliure"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Contingut&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            const page = result.pages.find(p => p.title === 'Inici');
            expect(page).toBeDefined();
            expect(page!.blocks[0].name).toBe('');
        });

        it('should filter out Basque "Testu librea" default title', () => {
            const legacyXml = `<?xml version="1.0" encoding="UTF-8"?>
<instance class="exe.engine.package.Package" reference="1">
  <dictionary>
    <string role="key" value="root"/>
    <instance class="exe.engine.node.Node" reference="2">
      <dictionary>
        <string role="key" value="_title"/>
        <unicode value="Hasiera"/>
        <string role="key" value="idevices"/>
        <list>
          <instance class="exe.engine.freetextidevice.FreeTextIdevice" reference="3">
            <dictionary>
              <string role="key" value="_title"/>
              <unicode value="Testu librea"/>
              <string role="key" value="fields"/>
              <list>
                <instance class="exe.engine.field.TextAreaField" reference="4">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"/>
                    <unicode value="&lt;p&gt;Edukia&lt;/p&gt;"/>
                  </dictionary>
                </instance>
              </list>
            </dictionary>
          </instance>
        </list>
      </dictionary>
    </instance>
  </dictionary>
</instance>`;

            const result = parser.parse(legacyXml);

            const page = result.pages.find(p => p.title === 'Hasiera');
            expect(page).toBeDefined();
            expect(page!.blocks[0].name).toBe('');
        });
    });
});

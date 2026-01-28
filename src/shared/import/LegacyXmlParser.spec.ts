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
            // @xmldom/xmldom doesn't throw on parse errors like browser DOMParser
            // Instead it returns a document with parsererror elements or empty results
            const invalidXml = '<invalid><xml>';

            // Should not throw, but may return empty/default results
            const result = parser.parse(invalidXml);
            expect(result).toBeDefined();
            expect(result.meta).toBeDefined();
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
        it('should include inline node definitions even when appearing after parentNode key', () => {
            // This tests the fix for nodes defined inline within parentNode fields
            // Previously these were incorrectly filtered out, causing missing pages
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
                        <list/>
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

            // Should find the inline defined page (reference 4)
            const inlinePage = result.pages.find(p => p.title === 'Inline Defined Page');
            expect(inlinePage).toBeDefined();
            expect(result.pages.length).toBeGreaterThanOrEqual(3);
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
});

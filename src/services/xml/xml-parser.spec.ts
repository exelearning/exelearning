/**
 * Tests for XML Parser Service
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { parseFromFile, parseFromString, parseRawXml, buildXml } from './xml-parser';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../idevice-config';

// Path to real iDevices for integration testing
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

describe('xml-parser', () => {
    let tempDir: string;

    // Load real iDevice configs before all tests
    beforeAll(() => {
        if (fs.existsSync(REAL_IDEVICES_PATH)) {
            loadIdeviceConfigs(REAL_IDEVICES_PATH);
        }
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    beforeEach(async () => {
        tempDir = path.join(__dirname, '..', '..', '..', 'test', 'temp', `xml-test-${Date.now()}`);
        await fs.ensureDir(tempDir);
    });

    afterEach(async () => {
        if (tempDir && (await fs.pathExists(tempDir))) {
            await fs.remove(tempDir);
        }
    });

    describe('parseFromFile', () => {
        it('should throw error for non-existent file', async () => {
            await expect(parseFromFile('/nonexistent/file.xml')).rejects.toThrow('XML file not found');
        });

        it('should parse valid ODE XML file', async () => {
            const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_title</key>
                            <value>Test Title</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const xmlPath = path.join(tempDir, 'test.xml');
            await fs.writeFile(xmlPath, xmlContent);

            const result = await parseFromFile(xmlPath);
            expect(result).toBeDefined();
            expect(result.pages).toBeDefined();
            expect(result.meta.title).toBe('Test Title');
        });
    });

    describe('parseFromString', () => {
        it('should throw error for invalid XML root element', () => {
            const invalidXml = '<invalid><content>test</content></invalid>';
            expect(() => parseFromString(invalidXml)).toThrow(
                'Invalid ODE XML: Missing ode or exe_document root element',
            );
        });

        it('should detect and parse real ODE format', () => {
            const odeXml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_title</key>
                            <value>ODE Document</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page-1</odePageId>
                            <pageName>First Page</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(odeXml);
            expect(result.meta.title).toBe('ODE Document');
            expect(result.pages.length).toBe(1);
            expect(result.pages[0].title).toBe('First Page');
        });

        it('should detect and parse exe_document format', () => {
            const exeXml = `
                <exe_document>
                    <meta>
                        <title>Exe Document</title>
                        <author>Test Author</author>
                    </meta>
                    <navigation>
                        <page id="p1" title="Page 1">
                            <component id="c1" type="text">
                                <content>Hello</content>
                            </component>
                        </page>
                    </navigation>
                </exe_document>`;

            const result = parseFromString(exeXml);
            expect(result.meta.title).toBe('Exe Document');
            expect(result.meta.author).toBe('Test Author');
            expect(result.pages.length).toBe(1);
        });

        it('should detect and parse legacy instance format', () => {
            const legacyXml = `
                <instance class="exe.engine.package.Package">
                    <dictionary>
                        <string>_title</string>
                        <unicode value="Legacy Title"/>
                    </dictionary>
                </instance>`;

            const result = parseFromString(legacyXml, 'test-session');
            expect(result).toBeDefined();
            expect(result.pages).toBeDefined();
        });
    });

    describe('extractMetadataFromOdeProperties', () => {
        // Note: These tests use skipValidation because the XML is intentionally minimal
        // to test specific parsing functionality, not DTD validation
        it('should handle empty properties array', () => {
            const xml = `
                <ode>
                    <odeProperties></odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // Default title comes from centralized metadata-properties config
            expect(result.meta.title).toBe('eXeLearning');
            expect(result.meta.author).toBe('');
        });

        it('should handle single property (non-array)', () => {
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_title</key>
                            <value>Single Property</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.meta.title).toBe('Single Property');
        });

        it('should extract all metadata keys', () => {
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_title</key>
                            <value>My Title</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_subtitle</key>
                            <value>My Subtitle</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_author</key>
                            <value>John Doe</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_description</key>
                            <value>A description</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_license</key>
                            <value>MIT</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_locale</key>
                            <value>es</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_style</key>
                            <value>modern</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.meta.title).toBe('My Title');
            expect(result.meta.subtitle).toBe('My Subtitle');
            expect(result.meta.author).toBe('John Doe');
            expect(result.meta.description).toBe('A description');
            expect(result.meta.license).toBe('MIT');
            expect(result.meta.language).toBe('es');
            expect(result.meta.theme).toBe('modern');
        });

        it('should handle missing propertyValue', () => {
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_title</key>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // When property has no value, falls back to centralized default
            expect(result.meta.title).toBe('eXeLearning');
        });

        it('should handle null/undefined properties', () => {
            const xml = `
                <ode>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // Default title comes from centralized metadata-properties config
            expect(result.meta.title).toBe('eXeLearning');
        });

        it('should extract theme from userPreferences', () => {
            const xml = `
                <ode>
                    <odeProperties></odeProperties>
                    <odeNavStructures></odeNavStructures>
                    <userPreferences>
                        <userPreference>
                            <key>theme</key>
                            <value>base</value>
                        </userPreference>
                    </userPreferences>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.meta.theme).toBe('base');
        });

        it('should use userPreferences theme over default', () => {
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_style</key>
                            <value>intef</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                    <userPreferences>
                        <userPreference>
                            <key>theme</key>
                            <value>base</value>
                        </userPreference>
                    </userPreferences>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // userPreferences should override odeProperties
            expect(result.meta.theme).toBe('base');
        });

        it('should handle multiple userPreferences', () => {
            const xml = `
                <ode>
                    <odeProperties></odeProperties>
                    <odeNavStructures></odeNavStructures>
                    <userPreferences>
                        <userPreference>
                            <key>other</key>
                            <value>something</value>
                        </userPreference>
                        <userPreference>
                            <key>theme</key>
                            <value>modern</value>
                        </userPreference>
                    </userPreferences>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.meta.theme).toBe('modern');
        });
    });

    describe('normalizePagesFromNavigation (exe_document format)', () => {
        it('should handle pages without components', () => {
            const xml = `
                <exe_document>
                    <meta><title>Test</title></meta>
                    <navigation>
                        <page id="p1" title="Empty Page"></page>
                    </navigation>
                </exe_document>`;

            const result = parseFromString(xml);
            expect(result.pages.length).toBe(1);
            expect(result.pages[0].components.length).toBe(0);
        });

        it('should handle nested pages (child pages)', () => {
            const xml = `
                <exe_document>
                    <meta><title>Test</title></meta>
                    <navigation>
                        <page id="p1" title="Parent">
                            <page id="p2" title="Child 1"></page>
                            <page id="p3" title="Child 2"></page>
                        </page>
                    </navigation>
                </exe_document>`;

            const result = parseFromString(xml);
            expect(result.pages.length).toBe(3);

            const parent = result.pages.find(p => p.id === 'p1');
            const child1 = result.pages.find(p => p.id === 'p2');
            const child2 = result.pages.find(p => p.id === 'p3');

            expect(parent?.level).toBe(0);
            expect(child1?.level).toBe(1);
            expect(child1?.parent_id).toBe('p1');
            expect(child2?.level).toBe(1);
            expect(child2?.parent_id).toBe('p1');
        });

        it('should handle multiple components per page', () => {
            const xml = `
                <exe_document>
                    <meta><title>Test</title></meta>
                    <navigation>
                        <page id="p1" title="Page 1">
                            <component id="c1" type="text"><content>Hello</content></component>
                            <component id="c2" type="image"><content>image.png</content></component>
                        </page>
                    </navigation>
                </exe_document>`;

            const result = parseFromString(xml);
            expect(result.pages[0].components.length).toBe(2);
            expect(result.pages[0].components[0].type).toBe('text');
            expect(result.pages[0].components[1].type).toBe('image');
        });

        it('should handle empty navigation', () => {
            const xml = `
                <exe_document>
                    <meta><title>Test</title></meta>
                    <navigation></navigation>
                </exe_document>`;

            const result = parseFromString(xml);
            expect(result.pages.length).toBe(0);
        });
    });

    describe('normalizePagesFromOdeNavStructures', () => {
        it('should build parent-child relationships', () => {
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>parent</odePageId>
                            <pageName>Parent Page</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                        </odeNavStructure>
                        <odeNavStructure>
                            <odePageId>child</odePageId>
                            <odeParentPageId>parent</odeParentPageId>
                            <pageName>Child Page</pageName>
                            <odeNavStructureOrder>1</odeNavStructureOrder>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            const parent = result.pages.find(p => p.id === 'parent');
            const child = result.pages.find(p => p.id === 'child');

            expect(parent?.level).toBe(0);
            expect(parent?.parent_id).toBeNull();
            expect(child?.level).toBe(1);
            expect(child?.parent_id).toBe('parent');
        });

        it('should calculate levels correctly for deep hierarchies', () => {
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>level0</odePageId>
                            <pageName>Level 0</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                        </odeNavStructure>
                        <odeNavStructure>
                            <odePageId>level1</odePageId>
                            <odeParentPageId>level0</odeParentPageId>
                            <pageName>Level 1</pageName>
                            <odeNavStructureOrder>1</odeNavStructureOrder>
                        </odeNavStructure>
                        <odeNavStructure>
                            <odePageId>level2</odePageId>
                            <odeParentPageId>level1</odeParentPageId>
                            <pageName>Level 2</pageName>
                            <odeNavStructureOrder>2</odeNavStructureOrder>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.pages.find(p => p.id === 'level0')?.level).toBe(0);
            expect(result.pages.find(p => p.id === 'level1')?.level).toBe(1);
            expect(result.pages.find(p => p.id === 'level2')?.level).toBe(2);
        });

        it('should handle pages with components', () => {
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures>
                                <odePagStructure>
                                    <odeComponents>
                                        <odeComponent>
                                            <odeIdeviceId>comp1</odeIdeviceId>
                                            <odeIdeviceTypeName>text</odeIdeviceTypeName>
                                            <htmlView>&lt;p&gt;Hello&lt;/p&gt;</htmlView>
                                            <odeComponentsOrder>0</odeComponentsOrder>
                                        </odeComponent>
                                    </odeComponents>
                                </odePagStructure>
                            </odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.pages[0].components.length).toBe(1);
            expect(result.pages[0].components[0].id).toBe('comp1');
            expect(result.pages[0].components[0].type).toBe('text');
        });

        it('should parse JSON properties in JSON iDevice components', () => {
            // Use 'form' which is a JSON iDevice type
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures>
                                <odePagStructure>
                                    <odeComponents>
                                        <odeComponent>
                                            <odeIdeviceId>comp1</odeIdeviceId>
                                            <odeIdeviceTypeName>form</odeIdeviceTypeName>
                                            <jsonProperties>{"question": "What is 2+2?", "answer": 4}</jsonProperties>
                                            <odeComponentsOrder>0</odeComponentsOrder>
                                        </odeComponent>
                                    </odeComponents>
                                </odePagStructure>
                            </odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.pages[0].components[0].data).toEqual({ question: 'What is 2+2?', answer: 4 });
        });

        it('should use htmlView for HTML iDevice components', () => {
            // Use 'crossword' which is an HTML iDevice type
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures>
                                <odePagStructure>
                                    <odeComponents>
                                        <odeComponent>
                                            <odeIdeviceId>comp1</odeIdeviceId>
                                            <odeIdeviceTypeName>crossword</odeIdeviceTypeName>
                                            <htmlView>&lt;div class="crossword-game"&gt;Game content&lt;/div&gt;</htmlView>
                                            <jsonProperties>{"ignored": true}</jsonProperties>
                                            <odeComponentsOrder>0</odeComponentsOrder>
                                        </odeComponent>
                                    </odeComponents>
                                </odePagStructure>
                            </odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // HTML iDevices should use content (htmlView) and have empty data
            expect(result.pages[0].components[0].content).toBe('<div class="crossword-game">Game content</div>');
            expect(result.pages[0].components[0].data).toEqual({});
        });

        it('should handle single navStructure (non-array)', () => {
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>single</odePageId>
                            <pageName>Single Page</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.pages.length).toBe(1);
            expect(result.pages[0].title).toBe('Single Page');
        });
    });

    describe('parseRawXml', () => {
        it('should parse any XML to JavaScript object', () => {
            const xml = '<root><item>value</item><number>42</number></root>';
            const result = parseRawXml(xml);

            expect(result.root.item).toBe('value');
            expect(result.root.number).toBe(42);
        });

        it('should handle XML with attributes', () => {
            const xml = '<root attr="test"><item id="1">value</item></root>';
            const result = parseRawXml(xml);

            expect(result.root['@_attr']).toBe('test');
            expect(result.root.item['@_id']).toBe(1);
        });
    });

    describe('buildXml', () => {
        it('should build XML from JavaScript object', () => {
            const obj = {
                root: {
                    item: 'value',
                    nested: {
                        child: 'data',
                    },
                },
            };

            const xml = buildXml(obj);
            expect(xml).toContain('<root>');
            expect(xml).toContain('<item>value</item>');
            expect(xml).toContain('<nested>');
            expect(xml).toContain('<child>data</child>');
        });

        it('should include attributes in output', () => {
            const obj = {
                root: {
                    '@_attr': 'test',
                    item: 'value',
                },
            };

            const xml = buildXml(obj);
            expect(xml).toContain('attr="test"');
        });

        it('should format output with indentation', () => {
            const obj = {
                root: {
                    nested: {
                        deep: 'value',
                    },
                },
            };

            const xml = buildXml(obj);
            // Should have newlines for formatting
            expect(xml.split('\n').length).toBeGreaterThan(1);
        });
    });

    describe('roundtrip: parseRawXml and buildXml', () => {
        it('should roundtrip simple XML', () => {
            const original = '<root><item>value</item></root>';
            const parsed = parseRawXml(original);
            const rebuilt = buildXml(parsed);

            expect(rebuilt).toContain('<item>value</item>');
        });
    });

    describe('XML validation', () => {
        it('should throw error when validation fails', () => {
            // Create XML that has validation errors (missing required elements)
            const invalidXml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <!-- Missing required odePageId -->
                            <pageName>Page without ID</pageName>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            expect(() => parseFromString(invalidXml)).toThrow('Invalid ODE XML structure');
        });

        it('should throw error with strictValidation when warnings exist', () => {
            // Create XML that has warnings but is technically valid
            const xmlWithWarnings = `
                <ode>
                    <odeProperties></odeProperties>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <!-- Missing odeParentPageId triggers warning -->
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            // With strictValidation, warnings should cause error
            expect(() => parseFromString(xmlWithWarnings, undefined, { strictValidation: true })).toThrow(
                'ODE XML has validation warnings',
            );
        });
    });

    describe('validateXml function', () => {
        it('should validate XML without parsing structure', async () => {
            // Import validateXml function
            const { validateXml } = await import('./xml-parser');

            const validXml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_title</key>
                            <value>Test</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <odeParentPageId></odeParentPageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures></odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = validateXml(validXml);
            expect(result.valid).toBe(true);
        });

        it('should return validation errors for invalid XML', async () => {
            const { validateXml } = await import('./xml-parser');

            const invalidXml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <!-- Missing odePageId -->
                            <pageName>Page</pageName>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = validateXml(invalidXml);
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('legacy key patterns in metadata', () => {
        it('should handle legacy key patterns without pp_ prefix', () => {
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>mytitle</key>
                            <value>Legacy Title</value>
                        </odeProperty>
                        <odeProperty>
                            <key>mysubtitle</key>
                            <value>Legacy Subtitle</value>
                        </odeProperty>
                        <odeProperty>
                            <key>myauthor</key>
                            <value>Legacy Author</value>
                        </odeProperty>
                        <odeProperty>
                            <key>mydescription</key>
                            <value>Legacy Description</value>
                        </odeProperty>
                        <odeProperty>
                            <key>mylicense</key>
                            <value>Legacy License</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.meta.title).toBe('Legacy Title');
            expect(result.meta.subtitle).toBe('Legacy Subtitle');
            expect(result.meta.author).toBe('Legacy Author');
            expect(result.meta.description).toBe('Legacy Description');
            expect(result.meta.license).toBe('Legacy License');
        });

        it('should handle license_url key (not matching license)', () => {
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_license_url</key>
                            <value>https://example.com/license</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_license</key>
                            <value>MIT</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // license_url should not override license
            expect(result.meta.license).toBe('MIT');
        });
    });

    describe('block properties parsing', () => {
        it('should parse block properties with boolean values', () => {
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures>
                                <odePagStructure>
                                    <odePagStructureId>block1</odePagStructureId>
                                    <odePagStructureName>Block 1</odePagStructureName>
                                    <odePagStructureProperties>
                                        <odeProperty>
                                            <key>minimized</key>
                                            <value>true</value>
                                        </odeProperty>
                                        <odeProperty>
                                            <key>teacherOnly</key>
                                            <value>false</value>
                                        </odeProperty>
                                        <odeProperty>
                                            <key>cssClass</key>
                                            <value>custom-class</value>
                                        </odeProperty>
                                    </odePagStructureProperties>
                                    <odeComponents>
                                        <odeComponent>
                                            <odeIdeviceId>comp1</odeIdeviceId>
                                            <odeIdeviceTypeName>text</odeIdeviceTypeName>
                                            <htmlView>&lt;p&gt;Content&lt;/p&gt;</htmlView>
                                            <odeComponentsOrder>0</odeComponentsOrder>
                                        </odeComponent>
                                    </odeComponents>
                                </odePagStructure>
                            </odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // Block properties are stored in component's blockProperties
            const component = result.pages[0].components[0];
            expect(component?.blockProperties?.minimized).toBe(true);
            expect(component?.blockProperties?.teacherOnly).toBe(false);
            expect(component?.blockProperties?.cssClass).toBe('custom-class');
        });

        it('should handle single block property (non-array)', () => {
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures>
                                <odePagStructure>
                                    <odePagStructureId>block1</odePagStructureId>
                                    <odePagStructureName>Block 1</odePagStructureName>
                                    <odePagStructureProperties>
                                        <odeProperty>
                                            <key>visibility</key>
                                            <value>hidden</value>
                                        </odeProperty>
                                    </odePagStructureProperties>
                                    <odeComponents>
                                        <odeComponent>
                                            <odeIdeviceId>comp1</odeIdeviceId>
                                            <odeIdeviceTypeName>text</odeIdeviceTypeName>
                                            <htmlView>&lt;p&gt;Content&lt;/p&gt;</htmlView>
                                            <odeComponentsOrder>0</odeComponentsOrder>
                                        </odeComponent>
                                    </odeComponents>
                                </odePagStructure>
                            </odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            const component = result.pages[0].components[0];
            expect(component?.blockProperties?.visibility).toBe('hidden');
        });
    });

    describe('CDATA content extraction', () => {
        it('should handle CDATA content in htmlView', () => {
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures>
                                <odePagStructure>
                                    <odeComponents>
                                        <odeComponent>
                                            <odeIdeviceId>comp1</odeIdeviceId>
                                            <odeIdeviceTypeName>text</odeIdeviceTypeName>
                                            <htmlView><![CDATA[<p>CDATA Content</p>]]></htmlView>
                                            <odeComponentsOrder>0</odeComponentsOrder>
                                        </odeComponent>
                                    </odeComponents>
                                </odePagStructure>
                            </odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.pages[0].components[0].content).toContain('CDATA Content');
        });

        it('should handle number values in CDATA fields', () => {
            // In some edge cases, xml parsers might return numbers
            const xml = `
                <ode>
                    <odeNavStructures>
                        <odeNavStructure>
                            <odePageId>page1</odePageId>
                            <pageName>Page 1</pageName>
                            <odeNavStructureOrder>0</odeNavStructureOrder>
                            <odePagStructures>
                                <odePagStructure>
                                    <odeComponents>
                                        <odeComponent>
                                            <odeIdeviceId>comp1</odeIdeviceId>
                                            <odeIdeviceTypeName>text</odeIdeviceTypeName>
                                            <htmlView>12345</htmlView>
                                            <odeComponentsOrder>0</odeComponentsOrder>
                                        </odeComponent>
                                    </odeComponents>
                                </odePagStructure>
                            </odePagStructures>
                        </odeNavStructure>
                    </odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            // Should handle numeric content
            expect(result.pages[0].components[0].content).toBeDefined();
        });
    });

    describe('boolean property parsing', () => {
        it('should parse boolean export settings', () => {
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_addPagination</key>
                            <value>true</value>
                        </odeProperty>
                        <odeProperty>
                            <key>pp_addSearchBox</key>
                            <value>false</value>
                        </odeProperty>
                        <odeProperty>
                            <key>exportSource</key>
                            <value>false</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.meta.addPagination).toBe(true);
            expect(result.meta.addSearchBox).toBe(false);
            expect(result.meta.exportSource).toBe(false);
        });

        it('should handle boolean values parsed by xml parser', () => {
            // fast-xml-parser may parse "true"/"false" as actual booleans
            const xml = `
                <ode>
                    <odeProperties>
                        <odeProperty>
                            <key>pp_addExeLink</key>
                            <value>true</value>
                        </odeProperty>
                    </odeProperties>
                    <odeNavStructures></odeNavStructures>
                </ode>`;

            const result = parseFromString(xml, undefined, { skipValidation: true });
            expect(result.meta.addExeLink).toBe(true);
        });
    });
});

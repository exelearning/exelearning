/**
 * Tests for XML Builder Service
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as fs from 'fs-extra';
import { ParsedOdeStructure } from './interfaces';

// Test output directory
const TEST_OUTPUT_DIR = '/tmp/xml-builder-test';

import { buildFromStructure, writeToFile, createDefaultMetadata, createSimpleStructure, buildRaw } from './xml-builder';

describe('XML Builder Service', () => {
    beforeEach(async () => {
        // Clean up test directory
        await fs.ensureDir(TEST_OUTPUT_DIR);
    });

    afterEach(async () => {
        // Clean up test output
        await fs.remove(TEST_OUTPUT_DIR);
    });

    describe('createDefaultMetadata', () => {
        it('should create metadata with title', () => {
            const meta = createDefaultMetadata('Test Document');

            expect(meta.title).toBe('Test Document');
            expect(meta.author).toBe('');
            expect(meta.language).toBe('en');
            expect(meta.version).toBe('3.0');
        });

        it('should create metadata with title and author', () => {
            const meta = createDefaultMetadata('My Document', 'John Doe');

            expect(meta.title).toBe('My Document');
            expect(meta.author).toBe('John Doe');
        });

        it('should include creation timestamp', () => {
            const before = new Date().toISOString();
            const meta = createDefaultMetadata('Test');
            const after = new Date().toISOString();

            expect(meta.created).toBeDefined();
            expect(meta.created! >= before).toBe(true);
            expect(meta.created! <= after).toBe(true);
        });

        it('should include modification timestamp', () => {
            const meta = createDefaultMetadata('Test');

            expect(meta.modified).toBeDefined();
        });

        it('should set default learning metadata', () => {
            const meta = createDefaultMetadata('Test');

            expect(meta.aggregationLevel).toBe('2');
            expect(meta.structure).toBe('hierarchical');
            expect(meta.semanticDensity).toBe('medium');
            expect(meta.difficulty).toBe('medium');
            expect(meta.interactivityType).toBe('mixed');
            expect(meta.interactivityLevel).toBe('medium');
        });

        it('should set exelearning version', () => {
            const meta = createDefaultMetadata('Test');

            expect(meta.exelearning_version).toBe('3.0');
        });
    });

    describe('createSimpleStructure', () => {
        it('should create structure with title only', () => {
            const structure = createSimpleStructure('Simple Page');

            expect(structure.meta.title).toBe('Simple Page');
            expect(structure.pages.length).toBe(1);
            expect(structure.pages[0].title).toBe('Simple Page');
        });

        it('should create structure with title and content', () => {
            const structure = createSimpleStructure('My Page', '<p>Hello World</p>');

            expect(structure.pages[0].components![0].content).toBe('<p>Hello World</p>');
        });

        it('should create root page at level 0', () => {
            const structure = createSimpleStructure('Root');

            expect(structure.pages[0].level).toBe(0);
            expect(structure.pages[0].parent_id).toBeNull();
        });

        it('should create single TextComponent', () => {
            const structure = createSimpleStructure('Test', 'Content');

            expect(structure.pages[0].components!.length).toBe(1);
            expect(structure.pages[0].components![0].type).toBe('TextComponent');
        });

        it('should include navigation structure', () => {
            const structure = createSimpleStructure('Nav Test');

            expect(structure.navigation).toBeDefined();
            expect(structure.navigation.page).toBeDefined();
        });

        it('should include raw ODE structure', () => {
            const structure = createSimpleStructure('Raw Test');

            expect(structure.raw).toBeDefined();
            expect(structure.raw.ode).toBeDefined();
        });
    });

    describe('buildFromStructure', () => {
        it('should build XML from simple structure', () => {
            const structure = createSimpleStructure('Test');

            const xml = buildFromStructure(structure);

            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('exe_document');
            expect(xml).toContain('meta');
            expect(xml).toContain('navigation');
        });

        it('should include metadata in output', () => {
            const structure = createSimpleStructure('Meta Test');
            structure.meta.author = 'Test Author';
            structure.meta.description = 'Test Description';

            const xml = buildFromStructure(structure);

            expect(xml).toContain('author');
            expect(xml).toContain('Test Author');
        });

        it('should include page structure', () => {
            const structure = createSimpleStructure('Page Test', 'Page Content');

            const xml = buildFromStructure(structure);

            expect(xml).toContain('page');
            expect(xml).toContain('Page Test');
        });

        it('should handle multiple root pages', () => {
            const structure = createSimpleStructure('First Page');
            structure.pages.push({
                id: '1',
                title: 'Second Page',
                level: 0,
                parent_id: null,
                position: 1,
                components: [],
            });

            const xml = buildFromStructure(structure);

            expect(xml).toContain('First Page');
            expect(xml).toContain('Second Page');
        });

        it('should handle nested pages', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('Nested Test'),
                pages: [
                    {
                        id: 'root',
                        title: 'Root Page',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        components: [],
                    },
                    {
                        id: 'child1',
                        title: 'Child Page 1',
                        level: 1,
                        parent_id: 'root',
                        position: 0,
                        components: [],
                    },
                    {
                        id: 'child2',
                        title: 'Child Page 2',
                        level: 1,
                        parent_id: 'root',
                        position: 1,
                        components: [],
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            const xml = buildFromStructure(structure);

            expect(xml).toContain('Root Page');
            expect(xml).toContain('Child Page 1');
            expect(xml).toContain('Child Page 2');
        });

        it('should handle deeply nested pages', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('Deep Nested'),
                pages: [
                    {
                        id: 'level0',
                        title: 'Level 0',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        components: [],
                    },
                    {
                        id: 'level1',
                        title: 'Level 1',
                        level: 1,
                        parent_id: 'level0',
                        position: 0,
                        components: [],
                    },
                    {
                        id: 'level2',
                        title: 'Level 2',
                        level: 2,
                        parent_id: 'level1',
                        position: 0,
                        components: [],
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            const xml = buildFromStructure(structure);

            expect(xml).toContain('Level 0');
            expect(xml).toContain('Level 1');
            expect(xml).toContain('Level 2');
        });

        it('should include components in pages', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('Components Test'),
                pages: [
                    {
                        id: 'page1',
                        title: 'Page with Components',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        components: [
                            {
                                id: 'comp1',
                                type: 'TextComponent',
                                order: 0,
                                content: 'Text content here',
                                data: null,
                            },
                            {
                                id: 'comp2',
                                type: 'ImageComponent',
                                order: 1,
                                content: null,
                                data: { src: 'image.jpg' },
                            },
                        ],
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            const xml = buildFromStructure(structure);

            expect(xml).toContain('component');
            expect(xml).toContain('TextComponent');
            expect(xml).toContain('ImageComponent');
        });

        it('should throw error when no root pages', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('No Root'),
                pages: [
                    {
                        id: 'orphan',
                        title: 'Orphan Page',
                        level: 2, // Not a root level
                        parent_id: 'non-existent',
                        position: 0,
                        components: [],
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            expect(() => buildFromStructure(structure)).toThrow('No root pages found');
        });

        it('should sort child pages by position', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('Sort Test'),
                pages: [
                    {
                        id: 'root',
                        title: 'Root',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        components: [],
                    },
                    {
                        id: 'child3',
                        title: 'Third',
                        level: 1,
                        parent_id: 'root',
                        position: 2,
                        components: [],
                    },
                    {
                        id: 'child1',
                        title: 'First',
                        level: 1,
                        parent_id: 'root',
                        position: 0,
                        components: [],
                    },
                    {
                        id: 'child2',
                        title: 'Second',
                        level: 1,
                        parent_id: 'root',
                        position: 1,
                        components: [],
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            const xml = buildFromStructure(structure);

            // Check order in XML (First should appear before Second, Second before Third)
            const firstIndex = xml.indexOf('First');
            const secondIndex = xml.indexOf('Second');
            const thirdIndex = xml.indexOf('Third');

            expect(firstIndex).toBeLessThan(secondIndex);
            expect(secondIndex).toBeLessThan(thirdIndex);
        });
    });

    describe('writeToFile', () => {
        it('should write XML to file', async () => {
            const structure = createSimpleStructure('Write Test');
            const outputPath = path.join(TEST_OUTPUT_DIR, 'test.xml');

            const result = await writeToFile(structure, outputPath);

            expect(result).toBe(outputPath);
            expect(await fs.pathExists(outputPath)).toBe(true);
        });

        it('should create parent directories', async () => {
            const structure = createSimpleStructure('Nested Dir Test');
            const outputPath = path.join(TEST_OUTPUT_DIR, 'deep', 'nested', 'dir', 'test.xml');

            await writeToFile(structure, outputPath);

            expect(await fs.pathExists(outputPath)).toBe(true);
        });

        it('should write valid XML content', async () => {
            const structure = createSimpleStructure('Valid XML', 'Content here');
            const outputPath = path.join(TEST_OUTPUT_DIR, 'valid.xml');

            await writeToFile(structure, outputPath);

            const content = await fs.readFile(outputPath, 'utf-8');
            expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(content).toContain('exe_document');
        });

        it('should overwrite existing file', async () => {
            const outputPath = path.join(TEST_OUTPUT_DIR, 'overwrite.xml');

            // Write first file
            const structure1 = createSimpleStructure('First');
            await writeToFile(structure1, outputPath);

            // Write second file (overwrite)
            const structure2 = createSimpleStructure('Second');
            await writeToFile(structure2, outputPath);

            const content = await fs.readFile(outputPath, 'utf-8');
            expect(content).toContain('Second');
            expect(content).not.toContain('First');
        });

        it('should handle UTF-8 content', async () => {
            const structure = createSimpleStructure('UTF-8 Test', '<p>Español: ñ, 日本語, العربية</p>');
            const outputPath = path.join(TEST_OUTPUT_DIR, 'utf8.xml');

            await writeToFile(structure, outputPath);

            const content = await fs.readFile(outputPath, 'utf-8');
            expect(content).toContain('ñ');
            expect(content).toContain('日本語');
        });
    });

    describe('buildRaw', () => {
        it('should build XML from raw object', () => {
            const obj = {
                root: {
                    child: 'value',
                },
            };

            const xml = buildRaw(obj);

            expect(xml).toContain('<root>');
            expect(xml).toContain('<child>value</child>');
            expect(xml).toContain('</root>');
        });

        it('should handle attributes', () => {
            const obj = {
                element: {
                    '@_id': '123',
                    '@_class': 'test',
                    '#text': 'content',
                },
            };

            const xml = buildRaw(obj);

            expect(xml).toContain('id="123"');
            expect(xml).toContain('class="test"');
            expect(xml).toContain('content');
        });

        it('should handle arrays', () => {
            const obj = {
                list: {
                    item: ['first', 'second', 'third'],
                },
            };

            const xml = buildRaw(obj);

            expect(xml).toContain('<item>first</item>');
            expect(xml).toContain('<item>second</item>');
            expect(xml).toContain('<item>third</item>');
        });

        it('should handle nested structures', () => {
            const obj = {
                root: {
                    level1: {
                        level2: {
                            level3: 'deep value',
                        },
                    },
                },
            };

            const xml = buildRaw(obj);

            expect(xml).toContain('<level1>');
            expect(xml).toContain('<level2>');
            expect(xml).toContain('<level3>deep value</level3>');
        });

        it('should suppress empty nodes', () => {
            const obj = {
                root: {
                    empty: '',
                    notEmpty: 'value',
                },
            };

            const xml = buildRaw(obj);

            // Empty node should be suppressed
            expect(xml).toContain('notEmpty');
        });

        it('should handle boolean attributes', () => {
            const obj = {
                element: {
                    '@_enabled': true,
                    '@_disabled': false,
                },
            };

            const xml = buildRaw(obj);

            expect(xml).toContain('enabled');
            expect(xml).toContain('disabled');
        });

        it('should handle numeric values', () => {
            const obj = {
                data: {
                    count: 42,
                    price: 19.99,
                },
            };

            const xml = buildRaw(obj);

            expect(xml).toContain('<count>42</count>');
            expect(xml).toContain('<price>19.99</price>');
        });
    });

    describe('XML Output Format', () => {
        it('should produce formatted output', () => {
            const structure = createSimpleStructure('Format Test');

            const xml = buildFromStructure(structure);

            // Should have newlines and indentation
            expect(xml).toContain('\n');
            expect(xml.split('\n').length).toBeGreaterThan(1);
        });

        it('should use proper indentation', () => {
            const structure = createSimpleStructure('Indent Test');

            const xml = buildFromStructure(structure);

            // Should have spaces for indentation
            expect(xml).toMatch(/^\s+</m); // Lines starting with whitespace followed by <
        });

        it('should have XML declaration', () => {
            const structure = createSimpleStructure('Declaration Test');

            const xml = buildFromStructure(structure);

            expect(xml.startsWith('<?xml')).toBe(true);
            expect(xml).toContain('encoding="UTF-8"');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty components array', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('Empty Components'),
                pages: [
                    {
                        id: '0',
                        title: 'Empty Page',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        components: [],
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            const xml = buildFromStructure(structure);

            expect(xml).toContain('Empty Page');
            // Should not have component element
        });

        it('should handle undefined components', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('No Components'),
                pages: [
                    {
                        id: '0',
                        title: 'No Components Page',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        // components is undefined
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            const xml = buildFromStructure(structure);

            expect(xml).toContain('No Components Page');
        });

        it('should handle special characters in content', () => {
            const structure = createSimpleStructure('Special', '<p>Test &amp; "quotes" &lt;brackets&gt;</p>');

            const xml = buildFromStructure(structure);

            // Content should be properly escaped or in CDATA
            expect(xml).toContain('Special');
        });

        it('should handle very long titles', () => {
            const longTitle = 'A'.repeat(1000);
            const structure = createSimpleStructure(longTitle);

            const xml = buildFromStructure(structure);

            expect(xml).toContain(longTitle);
        });

        it('should handle pages with null parent_id at non-zero level', () => {
            const structure: ParsedOdeStructure = {
                meta: createDefaultMetadata('Mixed Levels'),
                pages: [
                    {
                        id: 'page1',
                        title: 'Orphan at Level 1',
                        level: 1, // Non-zero but no parent
                        parent_id: null,
                        position: 0,
                        components: [],
                    },
                ],
                navigation: { page: {} },
                raw: {},
            };

            // Should treat as root since parent_id is null
            const xml = buildFromStructure(structure);
            expect(xml).toContain('Orphan at Level 1');
        });
    });
});

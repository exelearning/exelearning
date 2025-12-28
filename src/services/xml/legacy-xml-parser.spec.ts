/**
 * Tests for Legacy XML Parser
 * Tests for contentv3.xml (eXe 2.x format) parsing
 */
import { describe, it, expect } from 'bun:test';
import { parse } from './legacy-xml-parser';
import type { LegacyInstanceXmlDocument } from './interfaces';

describe('legacy-xml-parser', () => {
    describe('parse', () => {
        it('should parse empty instance document', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                },
            };

            const result = parse(parsed);

            expect(result).toBeDefined();
            expect(result.meta).toBeDefined();
            expect(result.pages).toBeDefined();
            expect(Array.isArray(result.pages)).toBe(true);
        });

        it('should extract metadata from instance', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    dictionary: {
                        string: ['_title', '_author'],
                        unicode: [{ '@_value': 'Test Title' }, { '@_value': 'Test Author' }],
                    },
                },
            };

            const result = parse(parsed);

            expect(result.meta.title).toBe('Test Title');
            expect(result.meta.author).toBe('Test Author');
        });

        it('should find and parse nodes', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    children: {
                        instance: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'node-1',
                            dictionary: {
                                unicode: { '@_value': 'Page 1' },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.pages.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle nested node hierarchy with root flattening', () => {
            // LEGACY V2.X ROOT NODE FLATTENING CONVENTION
            // When a single root has children, those direct children are promoted to top-level.
            // See doc/conventions.md for full documentation.
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    nested: {
                        instance: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'parent-node',
                            dictionary: {
                                unicode: { '@_value': 'Parent Page' },
                            },
                            children: {
                                instance: {
                                    '@_class': 'exe.engine.node.Node',
                                    '@_reference': 'child-node',
                                    dictionary: {
                                        unicode: { '@_value': 'Child Page' },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.pages.length).toBe(2);
            // After root flattening: both pages are now at level 0 (top-level)
            const parentPage = result.pages.find(p => p.id === 'parent-node');
            const childPage = result.pages.find(p => p.id === 'child-node');

            // Root stays at level 0
            expect(parentPage?.level).toBe(0);
            expect(parentPage?.parent_id).toBe(null);

            // Direct child of root is promoted to level 0 (no parent)
            expect(childPage?.level).toBe(0);
            expect(childPage?.parent_id).toBe(null);
        });

        it('should handle CDATA content in iDevices', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page with CDATA' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                    '@_reference': 'idevice-1',
                                    content: {
                                        __cdata: '<p>This is CDATA content</p>',
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.pages.length).toBeGreaterThanOrEqual(1);
            // The CDATA content should be extracted
            const page = result.pages.find(p => p.id === 'node-1');
            if (page && page.components.length > 0) {
                expect(page.components[0].content).toContain('CDATA content');
            }
        });

        it('should extract resource paths from content', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page with resources' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                    '@_reference': 'idevice-1',
                                    htmlContent: '<img src="resources/image.jpg"/>',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.srcRoutes).toBeDefined();
            // Resource paths should be collected
        });

        it('should handle session ID parameter', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                },
            };

            const result = parse(parsed, '', 'test-session-id');

            expect(result).toBeDefined();
        });

        it('should handle raw XML content parameter', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                },
            };

            const rawXml = '<instance class="exe.engine.package.Package"></instance>';
            const result = parse(parsed, rawXml);

            expect(result).toBeDefined();
        });

        it('should map iDevice types correctly', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: [
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'free-text-1',
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.MultichoiceIdevice',
                                        '@_reference': 'multichoice-1',
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.TrueFalseIdevice',
                                        '@_reference': 'true-false-1',
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const page = result.pages.find(p => p.id === 'node-1');
            if (page && page.components.length > 0) {
                const types = page.components.map(c => c.type);
                // LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
                // FreeTextIdevice is converted to 'text' for editability
                expect(types).toContain('text');
            }
        });

        it('should convert pages to RealOdeNavStructures format', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.raw).toBeDefined();
            expect(result.raw.ode).toBeDefined();
            expect(result.raw.ode.odeNavStructures).toBeDefined();
        });
    });

    describe('extractMetadata', () => {
        it('should return default values for empty metadata', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                },
            };

            const result = parse(parsed);

            expect(result.meta.title).toBe('Untitled');
            expect(result.meta.author).toBe('');
            expect(result.meta.locale).toBe('en');
            expect(result.meta.version).toBe('1.0');
        });

        it('should extract title from different formats', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    dictionary: {
                        string: 'title',
                        unicode: { '@_value': 'My Document Title' },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.meta.title).toBe('My Document Title');
        });
    });

    describe('buildPageHierarchy', () => {
        it('should calculate page levels correctly with root flattening', () => {
            // LEGACY V2.X ROOT NODE FLATTENING CONVENTION
            // Root's direct children are promoted to level 0, grandchildren are at level 1.
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    root: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'root',
                        dictionary: { unicode: { '@_value': 'Root' } },
                        child: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'level1',
                            dictionary: { unicode: { '@_value': 'Level 1' } },
                            child: {
                                '@_class': 'exe.engine.node.Node',
                                '@_reference': 'level2',
                                dictionary: { unicode: { '@_value': 'Level 2' } },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const root = result.pages.find(p => p.id === 'root');
            const level1 = result.pages.find(p => p.id === 'level1');
            const level2 = result.pages.find(p => p.id === 'level2');

            // After flattening: root stays at 0, level1 (direct child) promoted to 0, level2 at 1
            expect(root?.level).toBe(0);
            expect(root?.parent_id).toBe(null);
            expect(level1?.level).toBe(0); // Promoted from level 1
            expect(level1?.parent_id).toBe(null); // No longer child of root
            expect(level2?.level).toBe(1); // Adjusted from level 2
            expect(level2?.parent_id).toBe('level1'); // Parent relationship preserved
        });

        it('should assign positions to pages', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    nodes: [
                        {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'node-0',
                            dictionary: { unicode: { '@_value': 'Page 0' } },
                        },
                        {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'node-1',
                            dictionary: { unicode: { '@_value': 'Page 1' } },
                        },
                    ],
                },
            };

            const result = parse(parsed);

            expect(result.pages.every(p => typeof p.position === 'number')).toBe(true);
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
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    content: {
                        instance: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'root-node',
                            dictionary: { unicode: { '@_value': 'Root' } },
                            children: {
                                instance: [
                                    {
                                        '@_class': 'exe.engine.node.Node',
                                        '@_reference': 'child-a',
                                        dictionary: { unicode: { '@_value': 'Child A' } },
                                    },
                                    {
                                        '@_class': 'exe.engine.node.Node',
                                        '@_reference': 'child-b',
                                        dictionary: { unicode: { '@_value': 'Child B' } },
                                    },
                                    {
                                        '@_class': 'exe.engine.node.Node',
                                        '@_reference': 'child-c',
                                        dictionary: { unicode: { '@_value': 'Child C' } },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.pages.length).toBe(4);

            // All pages should be at level 0 with no parent
            const root = result.pages.find(p => p.id === 'root-node');
            const childA = result.pages.find(p => p.id === 'child-a');
            const childB = result.pages.find(p => p.id === 'child-b');
            const childC = result.pages.find(p => p.id === 'child-c');

            expect(root?.level).toBe(0);
            expect(root?.parent_id).toBe(null);

            expect(childA?.level).toBe(0);
            expect(childA?.parent_id).toBe(null);

            expect(childB?.level).toBe(0);
            expect(childB?.parent_id).toBe(null);

            expect(childC?.level).toBe(0);
            expect(childC?.parent_id).toBe(null);
        });

        it('should preserve grandchild relationships with adjusted levels', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    content: {
                        instance: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'root-node',
                            dictionary: { unicode: { '@_value': 'Root' } },
                            children: {
                                instance: {
                                    '@_class': 'exe.engine.node.Node',
                                    '@_reference': 'child-a',
                                    dictionary: { unicode: { '@_value': 'Child A' } },
                                    children: {
                                        instance: {
                                            '@_class': 'exe.engine.node.Node',
                                            '@_reference': 'grandchild-a1',
                                            dictionary: { unicode: { '@_value': 'Grandchild A1' } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.pages.length).toBe(3);

            const root = result.pages.find(p => p.id === 'root-node');
            const childA = result.pages.find(p => p.id === 'child-a');
            const grandchildA1 = result.pages.find(p => p.id === 'grandchild-a1');

            // Root at level 0
            expect(root?.level).toBe(0);
            expect(root?.parent_id).toBe(null);

            // Child A promoted to level 0
            expect(childA?.level).toBe(0);
            expect(childA?.parent_id).toBe(null);

            // Grandchild A1 keeps parent relationship, but level is recalculated
            expect(grandchildA1?.level).toBe(1);
            expect(grandchildA1?.parent_id).toBe('child-a');
        });

        it('should not flatten when root has no children', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    content: {
                        instance: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'lonely-root',
                            dictionary: { unicode: { '@_value': 'Lonely Root' } },
                            // No children
                        },
                    },
                },
            };

            const result = parse(parsed);

            expect(result.pages.length).toBe(1);
            const lonelyRoot = result.pages.find(p => p.id === 'lonely-root');
            expect(lonelyRoot?.level).toBe(0);
            expect(lonelyRoot?.parent_id).toBe(null);
        });

        it('should not flatten when multiple root nodes exist', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    content: {
                        instance: [
                            {
                                '@_class': 'exe.engine.node.Node',
                                '@_reference': 'root-1',
                                dictionary: { unicode: { '@_value': 'Root 1' } },
                                children: {
                                    instance: {
                                        '@_class': 'exe.engine.node.Node',
                                        '@_reference': 'child-of-1',
                                        dictionary: { unicode: { '@_value': 'Child of 1' } },
                                    },
                                },
                            },
                            {
                                '@_class': 'exe.engine.node.Node',
                                '@_reference': 'root-2',
                                dictionary: { unicode: { '@_value': 'Root 2' } },
                            },
                        ],
                    },
                },
            };

            const result = parse(parsed);

            // With multiple roots, no flattening should occur
            const childOf1 = result.pages.find(p => p.id === 'child-of-1');

            // Child should still have its parent relationship (no flattening)
            expect(childOf1?.parent_id).toBe('root-1');
            expect(childOf1?.level).toBe(1);
        });

        it('should preserve content and metadata after flattening', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    dictionary: {
                        string: '_title',
                        unicode: { '@_value': 'Test Document' },
                    },
                    content: {
                        instance: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'root-node',
                            dictionary: { unicode: { '@_value': 'Root' } },
                            children: {
                                instance: {
                                    '@_class': 'exe.engine.node.Node',
                                    '@_reference': 'child-node',
                                    dictionary: {
                                        unicode: { '@_value': 'Child With Content' },
                                        list: {
                                            instance: {
                                                '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                                '@_reference': 'idevice-1',
                                                content: {
                                                    __cdata: '<p>Important content</p>',
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            // Metadata should be preserved
            expect(result.meta.title).toBe('Test Document');

            // Components should be preserved after flattening
            const childNode = result.pages.find(p => p.id === 'child-node');
            expect(childNode?.title).toBe('Child With Content');
            expect(childNode?.components.length).toBe(1);
            expect(childNode?.components[0].content).toContain('Important content');

            // Flattening should have occurred
            expect(childNode?.level).toBe(0);
            expect(childNode?.parent_id).toBe(null);
        });
    });

    describe('extractIdeviceContent', () => {
        it('should extract content from unicode array with @_content=true (boolean)', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.jsidevice.JsIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        unicode: [
                                            { '@_value': 'title' },
                                            {
                                                '@_content': true, // boolean, not string
                                                '@_value': '<p>Content with boolean true</p>',
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.content).toBe('<p>Content with boolean true</p>');
        });

        it('should extract content from unicode array with @_content="true" (string)', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.jsidevice.JsIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        unicode: [
                                            { '@_value': 'info' },
                                            {
                                                '@_content': 'true', // string
                                                '@_value': '<div>Content with string true</div>',
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.content).toBe('<div>Content with string true</div>');
        });

        it('should extract content from single unicode object', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.multichoiceidevice.MultichoiceIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        unicode: {
                                            '@_value': '<p>Single object content</p>',
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.content).toBe('<p>Single object content</p>');
        });

        it('should skip unicode without HTML tags in array', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.jsidevice.JsIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        unicode: [
                                            {
                                                '@_content': true,
                                                '@_value': 'Plain text without HTML tags',
                                            },
                                            {
                                                '@_content': true,
                                                '@_value': '<p>Real HTML content</p>',
                                            },
                                        ],
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.content).toBe('<p>Real HTML content</p>');
        });
    });

    describe('extractResourcePaths', () => {
        it('should handle nested arrays when extracting resource paths', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.galleryidevice.GalleryIdevice',
                                    '@_reference': 'idevice-1',
                                    imageList: [
                                        'resources/image1.jpg',
                                        'resources/image2.png',
                                        ['resources/nested1.gif', 'resources/nested2.webp'],
                                    ],
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            expect(result.srcRoutes).toContain('resources/image1.jpg');
            expect(result.srcRoutes).toContain('resources/image2.png');
            expect(result.srcRoutes).toContain('resources/nested1.gif');
            expect(result.srcRoutes).toContain('resources/nested2.webp');
        });
    });

    describe('mapIdeviceType', () => {
        /**
         * LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
         *
         * Tests for the iDevice type conversion that ensures all legacy iDevices
         * become editable in modern eXeLearning.
         *
         * See doc/conventions.md section "Legacy .elp (v2.x) Import – Editable iDevice Conversion"
         */

        it('should convert unknown iDevice type to text for editability', () => {
            // LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
            // Unknown iDevices are converted to 'text' to ensure editability
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.custom.MyCustomIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            // Unknown iDevices are now converted to 'text' for editability
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should convert unrecognized iDevice class to text for editability', () => {
            // LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
            // Any iDevice class that doesn't match a known pattern is converted to 'text'
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: {
                                    // "Idevice" after dot - no preceding word char
                                    '@_class': 'exe.engine.base.Idevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            // Fallback now converts to 'text' for editability
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should map interactive iDevice types to modern equivalents', () => {
            // LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
            // Interactive iDevices map to their modern equivalents
            const testCases = [
                { className: 'exe.engine.cloze.ClozeIdevice', expected: 'complete' },
                { className: 'exe.engine.imagemagnifier.ImageMagnifierIdevice', expected: 'magnifier' },
                { className: 'exe.engine.multiselect.MultiSelectIdevice', expected: 'quick-questions-multiple-choice' },
                { className: 'exe.engine.truefalse.TrueFalseIdevice', expected: 'trueorfalse' },
                { className: 'exe.engine.gallery.GalleryIdevice', expected: 'image-gallery' },
                { className: 'exe.engine.casestudy.CasestudyIdevice', expected: 'casestudy' },
            ];

            for (const { className, expected } of testCases) {
                const parsed: LegacyInstanceXmlDocument = {
                    instance: {
                        '@_class': 'exe.engine.package.Package',
                        node: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': `node-${expected}`,
                            dictionary: {
                                unicode: { '@_value': 'Test Page' },
                                list: {
                                    instance: {
                                        '@_class': className,
                                        '@_reference': 'idevice-1',
                                    },
                                },
                            },
                        },
                    },
                };

                const result = parse(parsed);
                const page = result.pages.find(p => p.id === `node-${expected}`);
                expect(page?.components[0]?.type).toBe(expected);
            }
        });
    });

    describe('legacy iDevice type conversion for editability', () => {
        /**
         * LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
         *
         * These tests verify that legacy text-based iDevices are properly converted
         * to the modern 'text' iDevice type to ensure editability.
         *
         * Historical context: In eXeLearning 2.x, many iDevices were essentially
         * text containers with different icons/styling. Without conversion, they
         * would render but be READ-ONLY in modern eXeLearning.
         *
         * See doc/conventions.md section "Legacy .elp (v2.x) Import – Editable iDevice Conversion"
         */

        it('should convert FreeTextIdevice to text', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.freetextidevice.FreeTextIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should convert GenericIdevice to text', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.genericidevice.GenericIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should convert ReflectionIdevice to text', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.reflectionidevice.ReflectionIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should convert all Spanish FPD iDevice variants to text', () => {
            // Spanish FPD (Formación Profesional a Distancia) iDevices
            const fpdIdevices = [
                'exe.engine.tareasidevice.TareasIdevice',
                'exe.engine.comillasidevice.ComillasIdevice',
                'exe.engine.notainformacionidevice.NotaInformacionIdevice',
                'exe.engine.casopracticofpdidevice.CasopracticofpdIdevice',
                'exe.engine.citasparapensarfpdidevice.CitasparapensarfpdIdevice',
                'exe.engine.debesconocerfpdidevice.DebesconocerfpdIdevice',
                'exe.engine.destacadofpdidevice.DestacadofpdIdevice',
                'exe.engine.orientacionestutoriafpdidevice.OrientacionestutoriafpdIdevice',
                'exe.engine.orientacionesalumnadofpdidevice.OrientacionesalumnadofpdIdevice',
                'exe.engine.parasabermasfpdidevice.ParasabermasfpdIdevice',
                'exe.engine.recomendacionfpdidevice.RecomendacionfpdIdevice',
            ];

            for (const className of fpdIdevices) {
                const parsed: LegacyInstanceXmlDocument = {
                    instance: {
                        '@_class': 'exe.engine.package.Package',
                        node: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'node-1',
                            dictionary: {
                                unicode: { '@_value': 'Page' },
                                list: {
                                    instance: {
                                        '@_class': className,
                                        '@_reference': 'idevice-1',
                                    },
                                },
                            },
                        },
                    },
                };

                const result = parse(parsed);
                const page = result.pages.find(p => p.id === 'node-1');
                expect(page?.components[0]?.type).toBe('text');
            }
        });

        it('should convert obsolete external content iDevices to text', () => {
            // These iDevices have no modern equivalent but content can be preserved as text
            const obsoleteIdevices = [
                'exe.engine.wikipediaidevice.WikipediaIdevice',
                'exe.engine.rssidevice.RssIdevice',
                'exe.engine.appletidevice.AppletIdevice',
            ];

            for (const className of obsoleteIdevices) {
                const parsed: LegacyInstanceXmlDocument = {
                    instance: {
                        '@_class': 'exe.engine.package.Package',
                        node: {
                            '@_class': 'exe.engine.node.Node',
                            '@_reference': 'node-1',
                            dictionary: {
                                unicode: { '@_value': 'Page' },
                                list: {
                                    instance: {
                                        '@_class': className,
                                        '@_reference': 'idevice-1',
                                    },
                                },
                            },
                        },
                    },
                };

                const result = parse(parsed);
                const page = result.pages.find(p => p.id === 'node-1');
                expect(page?.components[0]?.type).toBe('text');
            }
        });

        it('should convert FileAttachIdevice to text for editability', () => {
            // FileAttachIdevice converted to text (not attached-files) because
            // attached-files iDevice has no editor. This matches Symfony behavior.
            // See FileAttachHandler.js and OdeOldXmlFileAttachIdevice.php
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.fileattachidevice.FileAttachIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should convert FileAttachIdeviceInc to text for editability', () => {
            // FileAttachIdeviceInc is a variant that also converts to text
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.fileattachidevice.FileAttachIdeviceInc',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should convert AttachmentIdevice to text for editability', () => {
            // AttachmentIdevice is another file attachment variant → text
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.attachmentidevice.AttachmentIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('text');
        });

        it('should preserve content when converting to text', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.reflectionidevice.ReflectionIdevice',
                                    '@_reference': 'idevice-1',
                                    content: {
                                        __cdata: '<p>Important reflection content that must be preserved</p>',
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');

            // Type should be 'text' for editability
            expect(page?.components[0]?.type).toBe('text');
            // Content should be preserved exactly
            expect(page?.components[0]?.content).toContain('Important reflection content that must be preserved');
        });

        it('should preserve title when converting to text', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.genericidevice.GenericIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        string: '_title',
                                        unicode: { '@_value': 'My Important Objectives' },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');

            // Type should be 'text' for editability
            expect(page?.components[0]?.type).toBe('text');
            // Title should be preserved
            expect(page?.components[0]?.title).toBe('My Important Objectives');
        });

        it('should detect JsIdevice as modern format', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.jsidevice.JsIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            // JsIdevice is detected as modern format
            expect(page?.components[0]?.type).toBe('js');
        });

        it('should map TrueFalseIdevice to trueorfalse (interactive)', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.truefalseidevice.TrueFalseIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('trueorfalse');
        });

        it('should map ClozeIdevice to complete (fill-in-blanks)', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.clozeidevice.ClozeIdevice',
                                    '@_reference': 'idevice-1',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0]?.type).toBe('complete');
        });

        it('should convert mixed iDevice types in a single page correctly', () => {
            // This test simulates a real legacy ELP with multiple iDevice types
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: [
                                    {
                                        '@_class': 'exe.engine.freetextidevice.FreeTextIdevice',
                                        '@_reference': 'idevice-freetext',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Introduction' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.genericidevice.GenericIdevice',
                                        '@_reference': 'idevice-generic',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Activity' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.reflectionidevice.ReflectionIdevice',
                                        '@_reference': 'idevice-reflection',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Reflection' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.truefalseidevice.TrueFalseIdevice',
                                        '@_reference': 'idevice-truefalse',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Quiz' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.jsidevice.JsIdevice',
                                        '@_reference': 'idevice-js',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Modern iDevice' },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components.length).toBe(5);

            // Text-based iDevices converted to 'text'
            expect(page?.components[0]?.type).toBe('text');
            expect(page?.components[1]?.type).toBe('text');
            expect(page?.components[2]?.type).toBe('text');

            // Interactive iDevice mapped to modern equivalent
            expect(page?.components[3]?.type).toBe('trueorfalse');

            // Modern JsIdevice detected
            expect(page?.components[4]?.type).toBe('js');

            // All titles preserved
            expect(page?.components[0]?.title).toBe('Introduction');
            expect(page?.components[1]?.title).toBe('Activity');
            expect(page?.components[2]?.title).toBe('Reflection');
            expect(page?.components[3]?.title).toBe('Quiz');
            expect(page?.components[4]?.title).toBe('Modern iDevice');
        });

        it('should ensure converted iDevices have valid identifiers', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.reflectionidevice.ReflectionIdevice',
                                    '@_reference': 'reflection-123',
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);
            const page = result.pages.find(p => p.id === 'node-1');

            // ID should be preserved and not undefined
            expect(page?.components[0]?.id).toBe('reflection-123');
            expect(page?.components[0]?.id).not.toBe('undefined');
            expect(page?.components[0]?.id).not.toBeUndefined();
        });
    });

    describe('extractMetadata edge cases', () => {
        it('should handle non-object unicode values in metadata', () => {
            // This tests the String(unicodeItem) fallback at line 176
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    dictionary: {
                        string: ['_title'],
                        unicode: ['Plain String Title'],
                    },
                },
            };

            const result = parse(parsed);
            expect(result.meta.title).toBe('Plain String Title');
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
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Test Page' },
                            list: {
                                instance: [
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-1',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Introduction' },
                                        },
                                        content: { __cdata: '<p>Intro content</p>' },
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-2',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Objectives' },
                                        },
                                        content: { __cdata: '<p>Objectives content</p>' },
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-3',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Activity' },
                                        },
                                        content: { __cdata: '<p>Activity content</p>' },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const page = result.pages.find(p => p.id === 'node-1');
            expect(page).toBeDefined();

            // Each iDevice should create its own block (component with unique blockName)
            expect(page?.components.length).toBe(3);

            // Each component should have a blockName matching its title
            expect(page?.components[0].blockName).toBe('Introduction');
            expect(page?.components[1].blockName).toBe('Objectives');
            expect(page?.components[2].blockName).toBe('Activity');
        });

        it('should use iDevice title as block title', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        string: '_title',
                                        unicode: { '@_value': 'My Custom Title' },
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0].blockName).toBe('My Custom Title');
            expect(page?.components[0].title).toBe('My Custom Title');
        });

        it('should use empty string for iDevices without title', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                    '@_reference': 'idevice-1',
                                    // No dictionary with title
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0].blockName).toBe('');
        });

        it('should filter out default "Free Text" title and use empty block name', () => {
            /**
             * LEGACY V2.X DEFAULT IDEVICE TITLE FILTERING
             * The default title "Free Text" from legacy FreeTextIdevice should NOT
             * be shown as the block name. Only custom, user-defined titles should
             * appear as block names.
             */
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.freetextidevice.FreeTextIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        string: '_title',
                                        unicode: { '@_value': 'Free Text' }, // Default title
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const page = result.pages.find(p => p.id === 'node-1');
            // blockName should be empty for default "Free Text" title
            expect(page?.components[0].blockName).toBe('');
            // But the title should still be preserved
            expect(page?.components[0].title).toBe('Free Text');
        });

        it('should preserve custom title even if similar to default', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: {
                                    '@_class': 'exe.engine.freetextidevice.FreeTextIdevice',
                                    '@_reference': 'idevice-1',
                                    dictionary: {
                                        string: '_title',
                                        unicode: { '@_value': 'Free Text Activity' }, // Custom title
                                    },
                                },
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const page = result.pages.find(p => p.id === 'node-1');
            // Custom title should be preserved as block name
            expect(page?.components[0].blockName).toBe('Free Text Activity');
            expect(page?.components[0].title).toBe('Free Text Activity');
        });

        it('should preserve iDevice order', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: [
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-first',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'First' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-second',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Second' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-third',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Third' },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            const page = result.pages.find(p => p.id === 'node-1');
            expect(page?.components[0].order).toBe(0);
            expect(page?.components[0].blockName).toBe('First');
            expect(page?.components[1].order).toBe(1);
            expect(page?.components[1].blockName).toBe('Second');
            expect(page?.components[2].order).toBe(2);
            expect(page?.components[2].blockName).toBe('Third');
        });

        it('should create separate blocks in RealOdeNavStructures output', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: [
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-1',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Block A' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-2',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'Block B' },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            // Check raw structure has separate blocks
            const navStructures = result.raw?.ode?.odeNavStructures?.odeNavStructure;
            expect(navStructures).toBeDefined();

            const pageNav = Array.isArray(navStructures) ? navStructures[0] : navStructures;

            // Should have 2 blocks (odePagStructure entries)
            const pagStructures = pageNav.odePagStructures?.odePagStructure;
            expect(Array.isArray(pagStructures)).toBe(true);
            expect(pagStructures.length).toBe(2);

            // Each block should have exactly one iDevice
            expect(pagStructures[0].blockName).toBe('Block A');
            const componentsA = pagStructures[0].odeComponents?.odeComponent;
            expect(Array.isArray(componentsA) ? componentsA.length : 1).toBe(1);

            expect(pagStructures[1].blockName).toBe('Block B');
            const componentsB = pagStructures[1].odeComponents?.odeComponent;
            expect(Array.isArray(componentsB) ? componentsB.length : 1).toBe(1);
        });

        it('should NOT group multiple iDevices into single block', () => {
            const parsed: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'exe.engine.package.Package',
                    node: {
                        '@_class': 'exe.engine.node.Node',
                        '@_reference': 'node-1',
                        dictionary: {
                            unicode: { '@_value': 'Page' },
                            list: {
                                instance: [
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-1',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'iDevice 1' },
                                        },
                                    },
                                    {
                                        '@_class': 'exe.engine.idevice.FreeTextIdevice',
                                        '@_reference': 'idevice-2',
                                        dictionary: {
                                            string: '_title',
                                            unicode: { '@_value': 'iDevice 2' },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            };

            const result = parse(parsed);

            // Get the raw structure
            const navStructures = result.raw?.ode?.odeNavStructures?.odeNavStructure;
            const pageNav = Array.isArray(navStructures) ? navStructures[0] : navStructures;
            const pagStructures = pageNav.odePagStructures?.odePagStructure;

            // Verify no block contains more than one iDevice
            const blocks = Array.isArray(pagStructures) ? pagStructures : [pagStructures];
            for (const block of blocks) {
                const components = block.odeComponents?.odeComponent;
                const componentCount = Array.isArray(components) ? components.length : 1;
                expect(componentCount).toBe(1);
            }
        });
    });
});

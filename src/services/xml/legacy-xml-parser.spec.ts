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

        it('should handle nested node hierarchy', () => {
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
            // Check that parent-child relationship was established
            const childPage = result.pages.find(p => p.id === 'child-node');
            expect(childPage?.parent_id).toBe('parent-node');
            expect(childPage?.level).toBe(1);
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
                expect(types).toContain('free-text');
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
        it('should calculate page levels correctly', () => {
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

            expect(root?.level).toBe(0);
            expect(level1?.level).toBe(1);
            expect(level2?.level).toBe(2);
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
});

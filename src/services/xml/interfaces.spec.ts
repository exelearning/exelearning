/**
 * Tests for XML Interfaces
 * Validates interface type definitions work correctly
 */
import { describe, it, expect } from 'bun:test';
import type {
    OdeXmlDocument,
    OdeXmlMeta,
    OdeXmlNavigation,
    OdeXmlPage,
    OdeXmlComponent,
    NormalizedPage,
    NormalizedComponent,
    ParsedOdeStructure,
    LegacyXmlFormat,
    RealOdeXmlDocument,
    RealOdeNavStructure,
    RealOdeComponent,
    LegacyInstanceXmlDocument,
    LegacyValueNode,
    LegacyListNode,
} from './interfaces';

describe('XML Interfaces', () => {
    describe('OdeXmlMeta', () => {
        it('should accept valid metadata object', () => {
            const meta: OdeXmlMeta = {
                author: 'Test Author',
                title: 'Test Title',
                description: 'Test Description',
                language: 'en',
                version: '3.0',
            };

            expect(meta.author).toBe('Test Author');
            expect(meta.title).toBe('Test Title');
            expect(meta.language).toBe('en');
        });

        it('should accept all optional fields', () => {
            const meta: OdeXmlMeta = {
                author: 'Author',
                title: 'Title',
                description: 'Description',
                language: 'es',
                license: 'CC-BY-SA',
                keywords: 'test,keywords',
                taxonomy: 'taxonomy',
                aggregationLevel: '2',
                structure: 'hierarchical',
                semanticDensity: 'medium',
                difficulty: 'easy',
                typicalLearningTime: 'PT30M',
                context: 'school',
                endUser: 'student',
                interactivityType: 'active',
                interactivityLevel: 'high',
                cognitiveProcess: 'understand',
                intendedEducationalUse: 'assessment',
                version: '3.0',
                exelearning_version: '3.0.0',
                created: '2025-01-01',
                modified: '2025-01-02',
                theme: 'base',
            };

            expect(meta.license).toBe('CC-BY-SA');
            expect(meta.theme).toBe('base');
        });

        it('should accept empty object', () => {
            const meta: OdeXmlMeta = {};

            expect(meta.title).toBeUndefined();
        });
    });

    describe('OdeXmlPage', () => {
        it('should accept minimal page structure', () => {
            const page: OdeXmlPage = {
                id: 'page-1',
                title: 'Test Page',
            };

            expect(page.id).toBe('page-1');
            expect(page.title).toBe('Test Page');
        });

        it('should accept page with single component', () => {
            const page: OdeXmlPage = {
                id: 'page-1',
                title: 'Test Page',
                component: {
                    type: 'TextComponent',
                    content: '<p>Hello</p>',
                },
            };

            expect((page.component as OdeXmlComponent).type).toBe('TextComponent');
        });

        it('should accept page with multiple components', () => {
            const page: OdeXmlPage = {
                id: 'page-1',
                title: 'Test Page',
                component: [
                    { type: 'TextComponent', content: 'Text 1' },
                    { type: 'ImageComponent', content: 'image.jpg' },
                ],
            };

            expect(Array.isArray(page.component)).toBe(true);
            expect((page.component as OdeXmlComponent[]).length).toBe(2);
        });

        it('should accept nested pages', () => {
            const page: OdeXmlPage = {
                id: 'parent',
                title: 'Parent Page',
                page: [
                    { id: 'child-1', title: 'Child 1' },
                    { id: 'child-2', title: 'Child 2' },
                ],
            };

            expect(Array.isArray(page.page)).toBe(true);
            expect((page.page as OdeXmlPage[]).length).toBe(2);
        });
    });

    describe('OdeXmlNavigation', () => {
        it('should accept single page', () => {
            const nav: OdeXmlNavigation = {
                page: { id: 'root', title: 'Root' },
            };

            expect((nav.page as OdeXmlPage).id).toBe('root');
        });

        it('should accept multiple pages', () => {
            const nav: OdeXmlNavigation = {
                page: [
                    { id: 'page-1', title: 'Page 1' },
                    { id: 'page-2', title: 'Page 2' },
                ],
            };

            expect(Array.isArray(nav.page)).toBe(true);
        });
    });

    describe('OdeXmlDocument', () => {
        it('should accept complete document structure', () => {
            const doc: OdeXmlDocument = {
                exe_document: {
                    meta: { title: 'Test Document' },
                    navigation: {
                        page: { id: 'root', title: 'Root' },
                    },
                },
            };

            expect(doc.exe_document.meta.title).toBe('Test Document');
            expect((doc.exe_document.navigation.page as OdeXmlPage).id).toBe('root');
        });
    });

    describe('NormalizedComponent', () => {
        it('should accept minimal component', () => {
            const comp: NormalizedComponent = {
                id: 'comp-1',
                type: 'TextComponent',
                content: '<p>Content</p>',
            };

            expect(comp.id).toBe('comp-1');
            expect(comp.type).toBe('TextComponent');
        });

        it('should accept component with all fields', () => {
            const comp: NormalizedComponent = {
                id: 'comp-1',
                title: 'My Component',
                type: 'TextComponent',
                content: '<p>Content</p>',
                blockName: 'block-1',
                order: 0,
                position: 1,
                properties: { key: 'value' },
                data: { extra: 'data' },
            };

            expect(comp.title).toBe('My Component');
            expect(comp.blockName).toBe('block-1');
            expect(comp.properties?.key).toBe('value');
        });
    });

    describe('NormalizedPage', () => {
        it('should accept page with components', () => {
            const page: NormalizedPage = {
                id: 'page-1',
                title: 'Test Page',
                level: 0,
                parent_id: null,
                position: 0,
                components: [{ id: 'c1', type: 'Text', content: 'Hello' }],
            };

            expect(page.components.length).toBe(1);
            expect(page.parent_id).toBeNull();
        });

        it('should accept nested page structure', () => {
            const page: NormalizedPage = {
                id: 'parent',
                title: 'Parent',
                level: 0,
                parent_id: null,
                position: 0,
                components: [],
                children: [
                    {
                        id: 'child',
                        title: 'Child',
                        level: 1,
                        parent_id: 'parent',
                        position: 0,
                        components: [],
                    },
                ],
            };

            expect(page.children?.length).toBe(1);
            expect(page.children?.[0].parent_id).toBe('parent');
        });
    });

    describe('ParsedOdeStructure', () => {
        it('should accept complete parsed structure', () => {
            const structure: ParsedOdeStructure = {
                meta: { title: 'Test' },
                pages: [
                    {
                        id: '0',
                        title: 'Home',
                        level: 0,
                        parent_id: null,
                        position: 0,
                        components: [],
                    },
                ],
                navigation: {
                    page: { id: '0', title: 'Home' },
                },
                raw: {
                    ode: {},
                },
            };

            expect(structure.pages.length).toBe(1);
            expect(structure.meta.title).toBe('Test');
        });

        it('should accept srcRoutes array', () => {
            const structure: ParsedOdeStructure = {
                meta: {},
                pages: [],
                navigation: { page: { id: '0', title: 'Root' } },
                raw: { ode: {} },
                srcRoutes: ['resources/image.png', 'resources/video.mp4'],
            };

            expect(structure.srcRoutes?.length).toBe(2);
        });
    });

    describe('LegacyXmlFormat', () => {
        it('should accept ODE format', () => {
            const format: LegacyXmlFormat = {
                version: '3.0',
                format: 'ode',
                requiresConversion: false,
            };

            expect(format.format).toBe('ode');
            expect(format.requiresConversion).toBe(false);
        });

        it('should accept exe_old format', () => {
            const format: LegacyXmlFormat = {
                version: '2.0',
                format: 'exe_old',
                requiresConversion: true,
            };

            expect(format.format).toBe('exe_old');
            expect(format.requiresConversion).toBe(true);
        });
    });

    describe('RealOdeXmlDocument', () => {
        it('should accept real ODE structure', () => {
            const doc: RealOdeXmlDocument = {
                ode: {
                    odeProperties: {
                        odeProperty: [
                            { key: 'pp_title', value: 'Test' },
                            { key: 'pp_author', value: 'Author' },
                        ],
                    },
                },
            };

            expect(doc.ode.odeProperties?.odeProperty.length).toBe(2);
        });

        it('should accept nav structures', () => {
            const doc: RealOdeXmlDocument = {
                ode: {
                    odeNavStructures: {
                        odeNavStructure: {
                            odePageId: 'page-0',
                            pageName: 'Home',
                        },
                    },
                },
            };

            const nav = doc.ode.odeNavStructures?.odeNavStructure as RealOdeNavStructure;
            expect(nav.pageName).toBe('Home');
        });
    });

    describe('RealOdeNavStructure', () => {
        it('should accept complete nav structure', () => {
            const nav: RealOdeNavStructure = {
                odePageId: 'page-1',
                odeParentPageId: 'page-0',
                pageName: 'Chapter 1',
                odeNavStructureOrder: 1,
                odeNavStructureProperties: {
                    odeNavStructureProperty: [{ key: 'visible', value: 'true' }],
                },
                odePagStructures: {
                    odePagStructure: {
                        odePageId: 'page-1',
                        odeBlockId: 'block-1',
                        blockName: 'Block 1',
                    },
                },
            };

            expect(nav.odeNavStructureOrder).toBe(1);
            expect(nav.odeParentPageId).toBe('page-0');
        });
    });

    describe('RealOdeComponent', () => {
        it('should accept component with HTML view', () => {
            const comp: RealOdeComponent = {
                odePageId: 'page-1',
                odeBlockId: 'block-1',
                odeIdeviceId: 'idevice-1',
                odeIdeviceTypeName: 'TextIdevice',
                htmlView: '<p>Content</p>',
                jsonProperties: '{"key":"value"}',
                odeComponentsOrder: 0,
            };

            expect(comp.htmlView).toBe('<p>Content</p>');
            expect(comp.odeIdeviceTypeName).toBe('TextIdevice');
        });
    });

    describe('LegacyInstanceXmlDocument', () => {
        it('should accept legacy instance structure', () => {
            const doc: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'Package',
                    dictionary: {
                        string: { '@_value': 'test' },
                    },
                },
            };

            expect(doc.instance['@_class']).toBe('Package');
        });

        it('should accept reference instance', () => {
            const doc: LegacyInstanceXmlDocument = {
                instance: {
                    '@_class': 'Node',
                    '@_reference': '1',
                },
            };

            expect(doc.instance['@_reference']).toBe('1');
        });
    });

    describe('LegacyValueNode', () => {
        it('should accept value with role', () => {
            const node: LegacyValueNode = {
                '@_value': 'test value',
                '@_role': 'title',
            };

            expect(node['@_value']).toBe('test value');
            expect(node['@_role']).toBe('title');
        });
    });

    describe('LegacyListNode', () => {
        it('should accept list of instances', () => {
            const list: LegacyListNode = {
                instance: [{ '@_class': 'Item1' }, { '@_class': 'Item2' }],
            };

            expect(Array.isArray(list.instance)).toBe(true);
            expect((list.instance as LegacyInstanceNode[]).length).toBe(2);
        });
    });
});

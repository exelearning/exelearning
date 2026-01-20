/**
 * Tests for ElpDocumentAdapter
 */

import { describe, it, expect } from 'bun:test';
import { ElpDocumentAdapter, ParsedOdeStructure, NormalizedPage, NormalizedComponent } from './ElpDocumentAdapter';

describe('ElpDocumentAdapter', () => {
    // Helper to create test parsed structure
    function createTestStructure(overrides: Partial<ParsedOdeStructure> = {}): ParsedOdeStructure {
        return {
            meta: {
                title: 'Test Project',
                author: 'Test Author',
                description: 'A test description',
                language: 'en',
                license: 'CC-BY-SA',
                keywords: 'test, export',
                theme: 'base',
                exelearning_version: '4.0',
                created: '2024-01-01T00:00:00Z',
                modified: '2024-01-02T00:00:00Z',
            },
            pages: [],
            navigation: {},
            raw: {},
            srcRoutes: [],
            ...overrides,
        };
    }

    function createTestPage(overrides: Partial<NormalizedPage> = {}): NormalizedPage {
        return {
            id: 'page-1',
            title: 'Test Page',
            components: [],
            level: 0,
            parent_id: null,
            position: 0,
            ...overrides,
        };
    }

    function createTestComponent(overrides: Partial<NormalizedComponent> = {}): NormalizedComponent {
        return {
            id: 'comp-1',
            type: 'FreeTextIdevice',
            content: '<p>Test content</p>',
            blockName: 'Block 1',
            order: 0,
            position: 0,
            properties: {},
            ...overrides,
        };
    }

    describe('getMetadata', () => {
        it('should return metadata from parsed structure', () => {
            const parsed = createTestStructure();
            const adapter = new ElpDocumentAdapter(parsed);

            const metadata = adapter.getMetadata();

            expect(metadata.title).toBe('Test Project');
            expect(metadata.author).toBe('Test Author');
            expect(metadata.description).toBe('A test description');
            expect(metadata.language).toBe('en');
            expect(metadata.license).toBe('CC-BY-SA');
            expect(metadata.keywords).toBe('test, export');
            expect(metadata.theme).toBe('base');
            expect(metadata.exelearningVersion).toBe('4.0');
        });

        it('should use default values for missing metadata', () => {
            const parsed = createTestStructure({ meta: {} });
            const adapter = new ElpDocumentAdapter(parsed);

            const metadata = adapter.getMetadata();

            expect(metadata.title).toBe('eXeLearning');
            expect(metadata.author).toBe('');
            expect(metadata.language).toBe('en');
            expect(metadata.theme).toBe('base');
        });
    });

    describe('getNavigation', () => {
        it('should return empty array for empty pages', () => {
            const parsed = createTestStructure({ pages: [] });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            expect(pages).toEqual([]);
        });

        it('should convert single page', () => {
            const parsed = createTestStructure({
                pages: [createTestPage()],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(1);
            expect(pages[0].id).toBe('page-1');
            expect(pages[0].title).toBe('Test Page');
            expect(pages[0].parentId).toBeNull();
            expect(pages[0].order).toBe(0);
        });

        it('should flatten nested pages', () => {
            const childPage = createTestPage({
                id: 'page-2',
                title: 'Child Page',
                parent_id: 'page-1',
                position: 0,
            });

            const parentPage = createTestPage({
                id: 'page-1',
                title: 'Parent Page',
                children: [childPage],
            });

            const parsed = createTestStructure({
                pages: [parentPage],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(2);
            expect(pages[0].id).toBe('page-1');
            expect(pages[1].id).toBe('page-2');
            expect(pages[1].parentId).toBe('page-1');
        });

        it('should convert multiple root pages', () => {
            const parsed = createTestStructure({
                pages: [
                    createTestPage({ id: 'page-1', title: 'First', position: 0 }),
                    createTestPage({ id: 'page-2', title: 'Second', position: 1 }),
                ],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(2);
            expect(pages[0].title).toBe('First');
            expect(pages[1].title).toBe('Second');
        });
    });

    describe('block grouping', () => {
        it('should group components into blocks by blockName', () => {
            const parsed = createTestStructure({
                pages: [
                    createTestPage({
                        components: [
                            createTestComponent({ id: 'c1', blockName: 'Block A', order: 0 }),
                            createTestComponent({ id: 'c2', blockName: 'Block A', order: 1 }),
                            createTestComponent({ id: 'c3', blockName: 'Block B', order: 0 }),
                        ],
                    }),
                ],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks).toHaveLength(2);
            expect(pages[0].blocks[0].name).toBe('Block A');
            expect(pages[0].blocks[0].components).toHaveLength(2);
            expect(pages[0].blocks[1].name).toBe('Block B');
            expect(pages[0].blocks[1].components).toHaveLength(1);
        });

        it('should use default block for components without blockName', () => {
            const parsed = createTestStructure({
                pages: [
                    createTestPage({
                        components: [createTestComponent({ id: 'c1', blockName: undefined })],
                    }),
                ],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks).toHaveLength(1);
            expect(pages[0].blocks[0].id).toBe('default-block');
        });
    });

    describe('component conversion', () => {
        it('should convert component properties correctly', () => {
            const parsed = createTestStructure({
                pages: [
                    createTestPage({
                        components: [
                            createTestComponent({
                                id: 'comp-1',
                                type: 'QuizIdevice',
                                content: '<div>Quiz content</div>',
                                order: 5,
                                properties: { showFeedback: true },
                            }),
                        ],
                    }),
                ],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();
            const component = pages[0].blocks[0].components[0];

            expect(component.id).toBe('comp-1');
            expect(component.type).toBe('QuizIdevice');
            expect(component.content).toBe('<div>Quiz content</div>');
            expect(component.order).toBe(5);
            expect(component.properties).toEqual({ showFeedback: true });
        });

        it('should handle non-string content', () => {
            const parsed = createTestStructure({
                pages: [
                    createTestPage({
                        components: [
                            createTestComponent({
                                content: { html: '<p>Structured</p>' } as unknown as string,
                            }),
                        ],
                    }),
                ],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();
            const component = pages[0].blocks[0].components[0];

            expect(component.content).toBe('');
        });
    });

    describe('getUsedIdeviceTypes', () => {
        it('should return unique iDevice types', () => {
            const parsed = createTestStructure({
                pages: [
                    createTestPage({
                        components: [
                            createTestComponent({ type: 'FreeTextIdevice' }),
                            createTestComponent({ type: 'QuizIdevice' }),
                            createTestComponent({ type: 'FreeTextIdevice' }), // Duplicate
                        ],
                    }),
                ],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const types = adapter.getUsedIdeviceTypes();

            expect(types).toHaveLength(2);
            expect(types).toContain('FreeTextIdevice');
            expect(types).toContain('QuizIdevice');
        });

        it('should return empty array for no components', () => {
            const parsed = createTestStructure({ pages: [] });
            const adapter = new ElpDocumentAdapter(parsed);

            const types = adapter.getUsedIdeviceTypes();

            expect(types).toEqual([]);
        });
    });

    describe('getAllHtmlContent', () => {
        it('should combine all HTML content from components', () => {
            const parsed = createTestStructure({
                pages: [
                    createTestPage({
                        components: [
                            createTestComponent({ content: '<p>First</p>' }),
                            createTestComponent({ content: '<p>Second</p>' }),
                        ],
                    }),
                    createTestPage({
                        id: 'page-2',
                        components: [createTestComponent({ content: '<p>Third</p>' })],
                    }),
                ],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const html = adapter.getAllHtmlContent();

            expect(html).toContain('<p>First</p>');
            expect(html).toContain('<p>Second</p>');
            expect(html).toContain('<p>Third</p>');
        });
    });

    describe('getResourcePaths', () => {
        it('should return srcRoutes from parsed structure', () => {
            const parsed = createTestStructure({
                srcRoutes: ['images/photo.jpg', 'files/doc.pdf'],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const paths = adapter.getResourcePaths();

            expect(paths).toEqual(['images/photo.jpg', 'files/doc.pdf']);
        });

        it('should return empty array when no srcRoutes', () => {
            const parsed = createTestStructure({ srcRoutes: undefined });
            const adapter = new ElpDocumentAdapter(parsed);

            const paths = adapter.getResourcePaths();

            expect(paths).toEqual([]);
        });
    });

    describe('getRawStructure', () => {
        it('should return the original parsed structure', () => {
            const parsed = createTestStructure();
            const adapter = new ElpDocumentAdapter(parsed);

            const raw = adapter.getRawStructure();

            expect(raw).toBe(parsed);
        });
    });

    describe('complex hierarchy', () => {
        it('should handle deep nesting', () => {
            const grandchild = createTestPage({
                id: 'grandchild',
                title: 'Grandchild',
                parent_id: 'child',
                position: 0,
            });

            const child = createTestPage({
                id: 'child',
                title: 'Child',
                parent_id: 'root',
                position: 0,
                children: [grandchild],
            });

            const root = createTestPage({
                id: 'root',
                title: 'Root',
                children: [child],
            });

            const parsed = createTestStructure({
                pages: [root],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(3);
            expect(pages[0].id).toBe('root');
            expect(pages[1].id).toBe('child');
            expect(pages[1].parentId).toBe('root');
            expect(pages[2].id).toBe('grandchild');
            expect(pages[2].parentId).toBe('child');
        });
    });

    describe('pagination hierarchy (sortPagesHierarchically)', () => {
        it('should sort pages in DFS reading order - children immediately after parent', () => {
            // Simulates the structure from tema-8-exe-3.elpx:
            // - Inicio (root, order 1)
            // - 1. El contrato (root, order 2)
            //   - 1.1 Qué es (child of 1, order 1)
            //   - 1.2 Contenido (child of 1, order 2)
            // - 2. Tipos de contrato (root, order 3)
            //   - 2.1 Por duración (child of 2, order 1)
            // Without sorting, navigation would go: Inicio → 1. El contrato → 2. Tipos
            // With sorting, navigation should go: Inicio → 1. El contrato → 1.1 Qué es → 1.2 Contenido → 2. Tipos → 2.1 Por duración

            const child11 = createTestPage({
                id: 'child-1-1',
                title: '1.1 Qué es',
                parent_id: 'section-1',
                position: 1,
            });

            const child12 = createTestPage({
                id: 'child-1-2',
                title: '1.2 Contenido',
                parent_id: 'section-1',
                position: 2,
            });

            const child21 = createTestPage({
                id: 'child-2-1',
                title: '2.1 Por duración',
                parent_id: 'section-2',
                position: 1,
            });

            const inicio = createTestPage({
                id: 'inicio',
                title: 'Inicio',
                parent_id: null,
                position: 1,
            });

            const section1 = createTestPage({
                id: 'section-1',
                title: '1. El contrato',
                parent_id: null,
                position: 2,
                children: [child11, child12],
            });

            const section2 = createTestPage({
                id: 'section-2',
                title: '2. Tipos de contrato',
                parent_id: null,
                position: 3,
                children: [child21],
            });

            const parsed = createTestStructure({
                pages: [inicio, section1, section2],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            // Verify the order is DFS reading order:
            // Inicio, 1. El contrato, 1.1 Qué es, 1.2 Contenido, 2. Tipos, 2.1 Por duración
            expect(pages).toHaveLength(6);
            expect(pages[0].id).toBe('inicio');
            expect(pages[0].title).toBe('Inicio');

            expect(pages[1].id).toBe('section-1');
            expect(pages[1].title).toBe('1. El contrato');

            expect(pages[2].id).toBe('child-1-1');
            expect(pages[2].title).toBe('1.1 Qué es');
            expect(pages[2].parentId).toBe('section-1');

            expect(pages[3].id).toBe('child-1-2');
            expect(pages[3].title).toBe('1.2 Contenido');
            expect(pages[3].parentId).toBe('section-1');

            expect(pages[4].id).toBe('section-2');
            expect(pages[4].title).toBe('2. Tipos de contrato');

            expect(pages[5].id).toBe('child-2-1');
            expect(pages[5].title).toBe('2.1 Por duración');
            expect(pages[5].parentId).toBe('section-2');
        });

        it('should handle pages with incorrect XML document order', () => {
            // This simulates a case where pages in the XML are not in parent-child order
            // but by XML document order (all root pages first, then all children)

            // Create a flat structure where children come AFTER all root pages in XML order
            const rootPage1 = createTestPage({
                id: 'root-1',
                title: 'Root 1',
                parent_id: null,
                position: 1,
            });

            const rootPage2 = createTestPage({
                id: 'root-2',
                title: 'Root 2',
                parent_id: null,
                position: 2,
            });

            // Children of root-1 added later in XML (children array simulates nested XML)
            const childOfRoot1 = createTestPage({
                id: 'child-of-1',
                title: 'Child of Root 1',
                parent_id: 'root-1',
                position: 1,
            });

            // Add child to root-1
            rootPage1.children = [childOfRoot1];

            const parsed = createTestStructure({
                pages: [rootPage1, rootPage2],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            // Expected order: Root 1, Child of Root 1, Root 2
            expect(pages).toHaveLength(3);
            expect(pages[0].id).toBe('root-1');
            expect(pages[1].id).toBe('child-of-1');
            expect(pages[2].id).toBe('root-2');
        });

        it('should sort children by order within each level', () => {
            // Children added in wrong order
            const child3 = createTestPage({
                id: 'child-3',
                title: 'Third Child',
                parent_id: 'root',
                position: 3,
            });

            const child1 = createTestPage({
                id: 'child-1',
                title: 'First Child',
                parent_id: 'root',
                position: 1,
            });

            const child2 = createTestPage({
                id: 'child-2',
                title: 'Second Child',
                parent_id: 'root',
                position: 2,
            });

            const root = createTestPage({
                id: 'root',
                title: 'Root',
                parent_id: null,
                position: 1,
                // Children in wrong order
                children: [child3, child1, child2],
            });

            const parsed = createTestStructure({
                pages: [root],
            });
            const adapter = new ElpDocumentAdapter(parsed);

            const pages = adapter.getNavigation();

            // Should be sorted by position
            expect(pages).toHaveLength(4);
            expect(pages[0].id).toBe('root');
            expect(pages[1].id).toBe('child-1');
            expect(pages[1].order).toBe(1);
            expect(pages[2].id).toBe('child-2');
            expect(pages[2].order).toBe(2);
            expect(pages[3].id).toBe('child-3');
            expect(pages[3].order).toBe(3);
        });
    });
});

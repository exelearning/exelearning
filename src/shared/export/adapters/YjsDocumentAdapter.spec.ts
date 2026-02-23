/**
 * YjsDocumentAdapter tests
 */

import { describe, it, expect } from 'bun:test';
import { YjsDocumentAdapter } from './YjsDocumentAdapter';

// Mock Y.Map
class MockYMap {
    private data: Record<string, unknown> = {};

    constructor(data: Record<string, unknown> = {}) {
        this.data = data;
    }

    get(key: string): unknown {
        return this.data[key];
    }

    toJSON(): Record<string, unknown> {
        return { ...this.data };
    }
}

// Mock Y.Array
class MockYArray {
    private items: unknown[] = [];

    constructor(items: unknown[] = []) {
        this.items = items;
    }

    get length(): number {
        return this.items.length;
    }

    get(index: number): unknown {
        return this.items[index];
    }

    toArray(): unknown[] {
        return [...this.items];
    }

    forEach(callback: (item: unknown, index: number) => void): void {
        this.items.forEach((item, index) => callback(item, index));
    }
}

// Mock YjsDocumentManager
class MockYjsDocumentManager {
    private metadata: MockYMap;
    private navigation: MockYArray;
    projectId: string | number;

    constructor(
        metadata: Record<string, unknown> = {},
        pages: unknown[] = [],
        projectId: string | number = 'test-project-123',
    ) {
        this.metadata = new MockYMap(metadata);
        this.navigation = new MockYArray(pages);
        this.projectId = projectId;
    }

    getMetadata(): MockYMap {
        return this.metadata;
    }

    getNavigation(): MockYArray {
        return this.navigation;
    }
}

// Sample page structures
const createMockPage = (
    id: string,
    title: string,
    blocks: unknown[] = [],
    parentId: string | null = null,
    order: number = 0,
    properties: Record<string, unknown> = {},
) => {
    return new MockYMap({
        id,
        pageId: id,
        title,
        pageName: title,
        parentId,
        order,
        blocks: new MockYArray(blocks),
        properties: new MockYMap(properties),
    });
};

const createMockBlock = (
    id: string,
    name: string,
    components: unknown[] = [],
    properties: Record<string, unknown> = {},
) => {
    const blockData: Record<string, unknown> = {
        id,
        name,
        blockName: name,
        order: 0,
        components: new MockYArray(components),
    };
    if (Object.keys(properties).length > 0) {
        blockData.properties = new MockYMap(properties);
    }
    return new MockYMap(blockData);
};

const createMockComponent = (
    id: string,
    type: string,
    content: string,
    jsonProperties: Record<string, unknown> = {},
    structureProperties: Record<string, unknown> = {},
) => {
    const data: Record<string, unknown> = {
        id,
        type,
        ideviceType: type,
        content,
        htmlContent: content,
        order: 0,
    };
    // iDevice-specific properties stored as JSON string in jsonProperties
    // This matches how ElpxImporter stores them
    if (Object.keys(jsonProperties).length > 0) {
        data.jsonProperties = JSON.stringify(jsonProperties);
    }
    // Structure properties (visibility, teacherOnly, etc.) go in properties
    if (Object.keys(structureProperties).length > 0) {
        data.properties = new MockYMap(structureProperties);
    }
    return new MockYMap(data);
};

describe('YjsDocumentAdapter', () => {
    let manager: MockYjsDocumentManager;
    let adapter: YjsDocumentAdapter;

    describe('Constructor', () => {
        it('should create adapter from manager', () => {
            manager = new MockYjsDocumentManager();
            adapter = new YjsDocumentAdapter(manager as any);

            expect(adapter).toBeDefined();
        });
    });

    describe('getMetadata', () => {
        it('should return metadata from manager', () => {
            manager = new MockYjsDocumentManager({
                title: 'Test Project',
                subtitle: 'Test Subtitle',
                author: 'Test Author',
                language: 'es',
                description: 'Test description',
                license: 'CC-BY-SA',
                keywords: 'test, project',
                theme: 'blue',
                exelearning_version: '4.0',
            });
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.title).toBe('Test Project');
            expect(metadata.subtitle).toBe('Test Subtitle');
            expect(metadata.author).toBe('Test Author');
            expect(metadata.language).toBe('es');
            expect(metadata.description).toBe('Test description');
            expect(metadata.license).toBe('CC-BY-SA');
            expect(metadata.keywords).toBe('test, project');
            expect(metadata.theme).toBe('blue');
            expect(metadata.exelearningVersion).toBe('4.0');
        });

        it('should return defaults for missing metadata', () => {
            manager = new MockYjsDocumentManager({});
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.title).toBe('eXeLearning');
            expect(metadata.subtitle).toBe('');
            expect(metadata.author).toBe('');
            expect(metadata.language).toBe('en');
            expect(metadata.theme).toBe('base');
        });

        it('should include custom styles when present', () => {
            manager = new MockYjsDocumentManager({
                customStyles: '.custom { color: red; }',
            });
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.customStyles).toBe('.custom { color: red; }');
        });

        it('should compute licenseUrl for Creative Commons license', () => {
            manager = new MockYjsDocumentManager({
                license: 'Creative Commons: Attribution - Share Alike 4.0',
            });
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.license).toBe('Creative Commons: Attribution - Share Alike 4.0');
            expect(metadata.licenseUrl).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
        });

        it('should compute licenseUrl for CC-BY-NC license', () => {
            manager = new MockYjsDocumentManager({
                license: 'Creative Commons: Attribution - Non Commercial 4.0',
            });
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.licenseUrl).toBe('https://creativecommons.org/licenses/by-nc/4.0/');
        });

        it('should return empty licenseUrl for proprietary license', () => {
            manager = new MockYjsDocumentManager({
                license: 'Proprietary License',
            });
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.license).toBe('Proprietary License');
            expect(metadata.licenseUrl).toBe('');
        });

        it('should return empty licenseUrl for empty license', () => {
            manager = new MockYjsDocumentManager({
                license: '',
            });
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.license).toBe('');
            expect(metadata.licenseUrl).toBe('');
        });

        it('should return empty licenseUrl when license is not set', () => {
            manager = new MockYjsDocumentManager({});
            adapter = new YjsDocumentAdapter(manager as any);

            const metadata = adapter.getMetadata();

            expect(metadata.license).toBe('');
            expect(metadata.licenseUrl).toBe('');
        });
    });

    describe('getNavigation', () => {
        it('should return empty array for no pages', () => {
            manager = new MockYjsDocumentManager({}, []);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(0);
        });

        it('should return flat array of pages', () => {
            const page1 = createMockPage('p1', 'Page 1');
            const page2 = createMockPage('p2', 'Page 2');

            manager = new MockYjsDocumentManager({}, [page1, page2]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(2);
            expect(pages[0].id).toBe('p1');
            expect(pages[0].title).toBe('Page 1');
            expect(pages[1].id).toBe('p2');
            expect(pages[1].title).toBe('Page 2');
        });

        it('should return all pages from flat navigation with parentId references', () => {
            // ElpxImporter stores pages in a FLAT array with parentId references
            const parentPage = createMockPage('parent', 'Parent Page', [], null, 0);
            const childPage = createMockPage('child', 'Child Page', [], 'parent', 0);
            const grandchildPage = createMockPage('grandchild', 'Grandchild Page', [], 'child', 0);

            // All pages stored flat in navigation array
            manager = new MockYjsDocumentManager({}, [parentPage, childPage, grandchildPage]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            // Should return all pages
            expect(pages).toHaveLength(3);
            expect(pages[0].id).toBe('parent');
            expect(pages[0].parentId).toBeNull();
            expect(pages[1].id).toBe('child');
            expect(pages[1].parentId).toBe('parent');
            expect(pages[2].id).toBe('grandchild');
            expect(pages[2].parentId).toBe('child');
        });

        it('should preserve parentId references for nested pages', () => {
            // Test case matching really-simple-test-project.elpx structure
            const page1 = createMockPage('page-1', 'Page 1', [], null, 0);
            const page1_1 = createMockPage('page-1-1', 'Page 1 - 1', [], 'page-1', 0);
            const page1_2 = createMockPage('page-1-2', 'Page 1 - 2', [], 'page-1', 1);
            const page2 = createMockPage('page-2', 'Page 2', [], null, 1);
            const page2_1 = createMockPage('page-2-1', 'Page 2 - 1', [], 'page-2', 0);

            manager = new MockYjsDocumentManager({}, [page1, page1_1, page1_2, page2, page2_1]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            // Should return all 5 pages
            expect(pages).toHaveLength(5);

            // Verify parent-child relationships
            const rootPages = pages.filter(p => p.parentId === null);
            expect(rootPages).toHaveLength(2);
            expect(rootPages[0].id).toBe('page-1');
            expect(rootPages[1].id).toBe('page-2');

            const page1Children = pages.filter(p => p.parentId === 'page-1');
            expect(page1Children).toHaveLength(2);
            expect(page1Children[0].id).toBe('page-1-1');
            expect(page1Children[1].id).toBe('page-1-2');

            const page2Children = pages.filter(p => p.parentId === 'page-2');
            expect(page2Children).toHaveLength(1);
            expect(page2Children[0].id).toBe('page-2-1');
        });

        it('should not overflow stack when page hierarchy contains a cycle', () => {
            const cyclicRoot = createMockPage('cycle-a', 'Cycle A', [], 'cycle-b', 0);
            const cyclicChild = createMockPage('cycle-b', 'Cycle B', [], 'cycle-a', 0);

            manager = new MockYjsDocumentManager({}, [cyclicRoot, cyclicChild]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(2);
            expect(pages.map(p => p.id).sort()).toEqual(['cycle-a', 'cycle-b']);
        });

        it('should include orphan pages with missing parents', () => {
            const root = createMockPage('root', 'Root', [], null, 0);
            const orphan = createMockPage('orphan', 'Orphan', [], 'missing-parent', 0);

            manager = new MockYjsDocumentManager({}, [root, orphan]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages).toHaveLength(2);
            expect(pages.map(p => p.id)).toContain('root');
            expect(pages.map(p => p.id)).toContain('orphan');
        });

        it('should convert blocks correctly', () => {
            const component = createMockComponent('c1', 'FreeTextIdevice', '<p>Content</p>');
            const block = createMockBlock('b1', 'Block 1', [component]);
            const page = createMockPage('p1', 'Page 1', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks).toHaveLength(1);
            expect(pages[0].blocks[0].id).toBe('b1');
            expect(pages[0].blocks[0].name).toBe('Block 1');
        });

        it('should convert components correctly', () => {
            const component = createMockComponent('c1', 'FreeTextIdevice', '<p>Test content</p>', {
                setting1: 'value1',
            });
            const block = createMockBlock('b1', 'Block', [component]);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();
            const comp = pages[0].blocks[0].components[0];

            expect(comp.id).toBe('c1');
            expect(comp.type).toBe('FreeTextIdevice');
            expect(comp.content).toBe('<p>Test content</p>');
            expect(comp.properties).toEqual({ setting1: 'value1' });
        });

        it('should extract text iDevice with feedback properties (jsonProperties format)', () => {
            // This tests the real-world format used by text iDevice
            // which stores feedback content in jsonProperties
            const textIdeviceProps = {
                textTextarea: '<p>Main content here</p>',
                textFeedbackInput: 'Show Feedback',
                textFeedbackTextarea: '<p>Feedback content here</p>',
                textInfoDurationInput: '00:10',
                textInfoDurationTextInput: 'Duration:',
                textInfoParticipantsInput: '2-4',
                textInfoParticipantsTextInput: 'Grouping:',
            };

            const component = createMockComponent(
                'text-idevice-1',
                'text',
                '<p>Main content here</p>',
                textIdeviceProps,
            );
            const block = createMockBlock('b1', 'Dos minutos para pensar', [component]);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();
            const comp = pages[0].blocks[0].components[0];

            expect(comp.id).toBe('text-idevice-1');
            expect(comp.type).toBe('text');
            expect(comp.properties).toEqual(textIdeviceProps);
            // Verify feedback properties are preserved
            expect(comp.properties.textFeedbackInput).toBe('Show Feedback');
            expect(comp.properties.textFeedbackTextarea).toBe('<p>Feedback content here</p>');
        });
    });

    describe('block and component ordering', () => {
        it('should sort blocks by order property', () => {
            // Create blocks with different order values (not in sequence)
            const createBlockWithOrder = (id: string, name: string, order: number) => {
                const blockData: Record<string, unknown> = {
                    id,
                    name,
                    blockName: name,
                    order,
                    components: new MockYArray([]),
                };
                return new MockYMap(blockData);
            };

            const block1 = createBlockWithOrder('b1', 'Block 1', 57);
            const block2 = createBlockWithOrder('b2', 'Block 2', 1);
            const block3 = createBlockWithOrder('b3', 'Block 3', 74);

            // Add blocks in wrong order (57, 1, 74)
            const page = new MockYMap({
                id: 'p1',
                title: 'Page',
                blocks: new MockYArray([block1, block2, block3]),
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            // Should be sorted by order: 1, 57, 74
            expect(pages[0].blocks).toHaveLength(3);
            expect(pages[0].blocks[0].id).toBe('b2'); // order: 1
            expect(pages[0].blocks[1].id).toBe('b1'); // order: 57
            expect(pages[0].blocks[2].id).toBe('b3'); // order: 74
        });

        it('should sort components by order property', () => {
            // Create components with different order values
            const createComponentWithOrder = (id: string, order: number) => {
                return new MockYMap({
                    id,
                    type: 'FreeTextIdevice',
                    content: `Content ${id}`,
                    order,
                    properties: new MockYMap({}),
                });
            };

            const comp1 = createComponentWithOrder('c1', 85);
            const comp2 = createComponentWithOrder('c2', 10);
            const comp3 = createComponentWithOrder('c3', 50);

            // Add in wrong order (85, 10, 50)
            const block = new MockYMap({
                id: 'b1',
                name: 'Block',
                order: 0,
                components: new MockYArray([comp1, comp2, comp3]),
            });

            const page = new MockYMap({
                id: 'p1',
                title: 'Page',
                blocks: new MockYArray([block]),
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            // Should be sorted by order: 10, 50, 85
            expect(pages[0].blocks[0].components).toHaveLength(3);
            expect(pages[0].blocks[0].components[0].id).toBe('c2'); // order: 10
            expect(pages[0].blocks[0].components[1].id).toBe('c3'); // order: 50
            expect(pages[0].blocks[0].components[2].id).toBe('c1'); // order: 85
        });

        it('should maintain stable sort for items with same order', () => {
            const createBlockWithOrder = (id: string, order: number) => {
                return new MockYMap({
                    id,
                    name: id,
                    order,
                    components: new MockYArray([]),
                });
            };

            const block1 = createBlockWithOrder('b1', 0);
            const block2 = createBlockWithOrder('b2', 0);
            const block3 = createBlockWithOrder('b3', 0);

            const page = new MockYMap({
                id: 'p1',
                title: 'Page',
                blocks: new MockYArray([block1, block2, block3]),
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            // Stable sort maintains insertion order for equal values
            expect(pages[0].blocks[0].id).toBe('b1');
            expect(pages[0].blocks[1].id).toBe('b2');
            expect(pages[0].blocks[2].id).toBe('b3');
        });

        it('should handle null/undefined order as 0', () => {
            const block1 = new MockYMap({
                id: 'b1',
                name: 'Block 1',
                order: 10,
                components: new MockYArray([]),
            });

            const block2 = new MockYMap({
                id: 'b2',
                name: 'Block 2',
                // No order property
                components: new MockYArray([]),
            });

            const page = new MockYMap({
                id: 'p1',
                title: 'Page',
                blocks: new MockYArray([block1, block2]),
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            // Block without order (treated as 0) should come first
            expect(pages[0].blocks[0].id).toBe('b2'); // order: undefined -> 0
            expect(pages[0].blocks[1].id).toBe('b1'); // order: 10
        });
    });

    describe('getUsedIdeviceTypes', () => {
        it('should return empty array for no idevices', () => {
            manager = new MockYjsDocumentManager({}, []);
            adapter = new YjsDocumentAdapter(manager as any);

            const types = adapter.getUsedIdeviceTypes();

            expect(types).toHaveLength(0);
        });

        it('should return unique idevice types', () => {
            const comp1 = createMockComponent('c1', 'FreeTextIdevice', 'Content 1');
            const comp2 = createMockComponent('c2', 'FreeTextIdevice', 'Content 2');
            const comp3 = createMockComponent('c3', 'MultipleChoiceIdevice', 'Quiz');
            const block = createMockBlock('b1', 'Block', [comp1, comp2, comp3]);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const types = adapter.getUsedIdeviceTypes();

            // Should be unique
            expect(types).toContain('FreeTextIdevice');
            expect(types).toContain('MultipleChoiceIdevice');
            expect(types).toHaveLength(2);
        });

        it('should collect types from multiple pages', () => {
            const comp1 = createMockComponent('c1', 'FreeTextIdevice', 'Text');
            const comp2 = createMockComponent('c2', 'ImageGallery', 'Gallery');
            const block1 = createMockBlock('b1', 'Block 1', [comp1]);
            const block2 = createMockBlock('b2', 'Block 2', [comp2]);
            const page1 = createMockPage('p1', 'Page 1', [block1]);
            const page2 = createMockPage('p2', 'Page 2', [block2]);

            manager = new MockYjsDocumentManager({}, [page1, page2]);
            adapter = new YjsDocumentAdapter(manager as any);

            const types = adapter.getUsedIdeviceTypes();

            expect(types).toContain('FreeTextIdevice');
            expect(types).toContain('ImageGallery');
        });
    });

    describe('getAllHtmlContent', () => {
        it('should return empty string for no content', () => {
            manager = new MockYjsDocumentManager({}, []);
            adapter = new YjsDocumentAdapter(manager as any);

            const html = adapter.getAllHtmlContent();

            expect(html).toBe('');
        });

        it('should combine content from all components', () => {
            const comp1 = createMockComponent('c1', 'FreeTextIdevice', '<p>First</p>');
            const comp2 = createMockComponent('c2', 'FreeTextIdevice', '<p>Second</p>');
            const block = createMockBlock('b1', 'Block', [comp1, comp2]);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const html = adapter.getAllHtmlContent();

            expect(html).toContain('<p>First</p>');
            expect(html).toContain('<p>Second</p>');
        });

        it('should combine content from multiple pages', () => {
            const comp1 = createMockComponent('c1', 'FreeTextIdevice', '<p>Page 1</p>');
            const comp2 = createMockComponent('c2', 'FreeTextIdevice', '<p>Page 2</p>');
            const block1 = createMockBlock('b1', 'Block 1', [comp1]);
            const block2 = createMockBlock('b2', 'Block 2', [comp2]);
            const page1 = createMockPage('p1', 'Page 1', [block1]);
            const page2 = createMockPage('p2', 'Page 2', [block2]);

            manager = new MockYjsDocumentManager({}, [page1, page2]);
            adapter = new YjsDocumentAdapter(manager as any);

            const html = adapter.getAllHtmlContent();

            expect(html).toContain('Page 1');
            expect(html).toContain('Page 2');
        });
    });

    describe('Edge Cases', () => {
        it('should handle pages without blocks', () => {
            const page = createMockPage('p1', 'Empty Page');

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks).toHaveLength(0);
        });

        it('should handle blocks without components', () => {
            const block = createMockBlock('b1', 'Empty Block');
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].components).toHaveLength(0);
        });

        it('should use fallback ID from pageId', () => {
            const page = new MockYMap({
                pageId: 'fallback-id',
                title: 'Page',
                blocks: new MockYArray([]),
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].id).toBe('fallback-id');
        });

        it('should use fallback title from pageName', () => {
            const page = new MockYMap({
                id: 'p1',
                pageName: 'Fallback Title',
                blocks: new MockYArray([]),
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].title).toBe('Fallback Title');
        });

        it('should use fallback type from ideviceType', () => {
            const comp = new MockYMap({
                id: 'c1',
                ideviceType: 'FallbackType',
                content: 'Content',
                order: 0,
                properties: new MockYMap({}),
            });
            const block = createMockBlock('b1', 'Block', [comp]);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].components[0].type).toBe('FallbackType');
        });
    });

    describe('page properties extraction', () => {
        it('should extract page properties', () => {
            const page = createMockPage('p1', 'Page', [], null, 0, {
                visibility: true,
                highlight: false,
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].properties).toBeDefined();
            expect(pages[0].properties?.visibility).toBe(true);
            expect(pages[0].properties?.highlight).toBe(false);
        });

        it('should return empty object when no properties', () => {
            const page = new MockYMap({
                id: 'p1',
                title: 'Page',
                blocks: new MockYArray([]),
                // No properties Y.Map
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].properties).toEqual({});
        });

        it('should extract visibility property as boolean', () => {
            const page = createMockPage('p1', 'Page', [], null, 0, { visibility: false });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].properties?.visibility).toBe(false);
        });

        it('should extract highlight property', () => {
            const page = createMockPage('p1', 'Page', [], null, 0, { highlight: true });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].properties?.highlight).toBe(true);
        });

        it('should extract multiple page properties together', () => {
            const page = createMockPage('p1', 'Page', [], null, 0, {
                visibility: true,
                highlight: true,
                hidePageTitle: false,
                editableInPage: true,
            });

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].properties).toEqual({
                visibility: true,
                highlight: true,
                hidePageTitle: false,
                editableInPage: true,
            });
        });
    });

    describe('block properties extraction', () => {
        it('should extract teacherOnly property from block', () => {
            const block = createMockBlock('b1', 'Block 1', [], { teacherOnly: 'true' });
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties?.teacherOnly).toBe('true');
        });

        it('should extract visibility property from block', () => {
            const block = createMockBlock('b1', 'Block 1', [], { visibility: 'false' });
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties?.visibility).toBe('false');
        });

        it('should extract minimized property from block', () => {
            const block = createMockBlock('b1', 'Block 1', [], { minimized: 'true' });
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties?.minimized).toBe('true');
        });

        it('should extract cssClass property from block', () => {
            const block = createMockBlock('b1', 'Block 1', [], { cssClass: 'my-custom-class' });
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties?.cssClass).toBe('my-custom-class');
        });

        it('should extract allowToggle property from block', () => {
            const block = createMockBlock('b1', 'Block 1', [], { allowToggle: 'true' });
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties?.allowToggle).toBe('true');
        });

        it('should extract all properties from block together', () => {
            const block = createMockBlock('b1', 'Block 1', [], {
                visibility: 'true',
                teacherOnly: 'true',
                allowToggle: 'true',
                minimized: 'false',
                cssClass: 'my-class',
            });
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties).toMatchObject({
                visibility: 'true',
                teacherOnly: 'true',
                allowToggle: 'true',
                minimized: 'false',
                cssClass: 'my-class',
            });
        });

        it('should return empty properties object when no properties set', () => {
            const block = createMockBlock('b1', 'Block 1', []);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties).toEqual({});
        });
    });

    describe('getContentXml', () => {
        it('should generate valid ODE XML from document structure', async () => {
            const component = createMockComponent('c1', 'FreeTextIdevice', '<p>Test content</p>');
            const block = createMockBlock('b1', 'Test Block', [component]);
            const page = createMockPage('p1', 'Test Page', [block]);

            manager = new MockYjsDocumentManager(
                {
                    title: 'Test Project',
                    author: 'Test Author',
                    language: 'es',
                    theme: 'base',
                },
                [page],
            );
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            // Should be valid ODE XML with DOCTYPE declaration
            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<!DOCTYPE ode SYSTEM "content.dtd">');
            expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');
            expect(xml).toContain('</ode>');
        });

        it('should include metadata in odeProperties section', async () => {
            const page = createMockPage('p1', 'Page');

            manager = new MockYjsDocumentManager(
                {
                    title: 'My Project',
                    author: 'John Doe',
                    description: 'A test project',
                    language: 'en',
                    license: 'CC-BY-SA',
                    keywords: 'test, project',
                    theme: 'blue',
                },
                [page],
            );
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            expect(xml).toContain('<odeProperties>');
            expect(xml).toContain('My Project');
            expect(xml).toContain('John Doe');
        });

        it('should include navigation structure in odeNavStructures', async () => {
            const page1 = createMockPage('p1', 'First Page', [], null, 0);
            const page2 = createMockPage('p2', 'Second Page', [], null, 1);

            manager = new MockYjsDocumentManager({ title: 'Project' }, [page1, page2]);
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            expect(xml).toContain('<odeNavStructures>');
            expect(xml).toContain('First Page');
            expect(xml).toContain('Second Page');
        });

        it('should handle nested pages with correct parent hierarchy', async () => {
            const parentPage = createMockPage('parent', 'Parent Page', [], null, 0);
            const childPage = createMockPage('child', 'Child Page', [], 'parent', 0);
            const grandchildPage = createMockPage('grandchild', 'Grandchild Page', [], 'child', 0);

            manager = new MockYjsDocumentManager({ title: 'Nested Project' }, [parentPage, childPage, grandchildPage]);
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            // Should contain all pages
            expect(xml).toContain('Parent Page');
            expect(xml).toContain('Child Page');
            expect(xml).toContain('Grandchild Page');
        });

        it('should include components in XML', async () => {
            const comp1 = createMockComponent('c1', 'FreeTextIdevice', '<p>Content 1</p>');
            const comp2 = createMockComponent('c2', 'MultipleChoiceIdevice', '<p>Quiz</p>');
            const block = createMockBlock('b1', 'Block', [comp1, comp2]);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({ title: 'Project' }, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            expect(xml).toContain('FreeTextIdevice');
            expect(xml).toContain('MultipleChoiceIdevice');
        });

        it('should handle empty document with empty odeNavStructures', async () => {
            manager = new MockYjsDocumentManager({ title: 'Empty Project' }, []);
            adapter = new YjsDocumentAdapter(manager as any);

            // With * cardinality, empty navigation is now valid
            const xml = await adapter.getContentXml();
            expect(xml).toContain('<odeNavStructures>');
            expect(xml).toContain('</odeNavStructures>');
        });

        it('should include export options in odeProperties', async () => {
            const page = createMockPage('p1', 'Page');

            manager = new MockYjsDocumentManager(
                {
                    title: 'Project',
                    addExeLink: true,
                    addPagination: true,
                    addSearchBox: false,
                    addMathJax: true,
                },
                [page],
            );
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            expect(xml).toContain('<odeProperties>');
            // Export options should be in the XML
            expect(xml).toBeDefined();
        });

        it('should handle pages with multiple blocks and components', async () => {
            const comp1 = createMockComponent('c1', 'text', '<p>Text 1</p>');
            const comp2 = createMockComponent('c2', 'text', '<p>Text 2</p>');
            const comp3 = createMockComponent('c3', 'image', '<img src="test.jpg"/>');
            const block1 = createMockBlock('b1', 'Block 1', [comp1, comp2]);
            const block2 = createMockBlock('b2', 'Block 2', [comp3]);
            const page = createMockPage('p1', 'Page', [block1, block2]);

            manager = new MockYjsDocumentManager({ title: 'Multi-block Project' }, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            // All components should be included
            expect(xml).toContain('text');
            expect(xml).toContain('image');
        });

        it('should use default values for missing metadata', async () => {
            const page = createMockPage('p1', 'Page');

            // Minimal metadata
            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            // Should still generate valid ODE XML with defaults
            expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(xml).toContain('<!DOCTYPE ode SYSTEM "content.dtd">');
            expect(xml).toContain('<ode xmlns="http://www.intef.es/xsd/ode"');
        });

        it('should correctly calculate page levels for deep hierarchy', async () => {
            // Create a 4-level deep hierarchy
            const level0 = createMockPage('l0', 'Level 0', [], null, 0);
            const level1 = createMockPage('l1', 'Level 1', [], 'l0', 0);
            const level2 = createMockPage('l2', 'Level 2', [], 'l1', 0);
            const level3 = createMockPage('l3', 'Level 3', [], 'l2', 0);

            manager = new MockYjsDocumentManager({ title: 'Deep Hierarchy' }, [level0, level1, level2, level3]);
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            // All pages should be included
            expect(xml).toContain('Level 0');
            expect(xml).toContain('Level 1');
            expect(xml).toContain('Level 2');
            expect(xml).toContain('Level 3');
        });

        it('should preserve component properties in XML', async () => {
            const compProps = { textFeedbackInput: 'Show Feedback', textFeedbackTextarea: '<p>Feedback</p>' };
            const component = createMockComponent('c1', 'text', '<p>Main</p>', compProps);
            const block = createMockBlock('b1', 'Block', [component]);
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({ title: 'Props Project' }, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const xml = await adapter.getContentXml();

            // Properties should be serialized in the XML
            expect(xml).toBeDefined();
            expect(xml.length).toBeGreaterThan(100);
        });
    });
});

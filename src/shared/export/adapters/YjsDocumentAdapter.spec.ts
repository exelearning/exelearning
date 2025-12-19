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

const createMockComponent = (id: string, type: string, content: string, properties: Record<string, unknown> = {}) => {
    return new MockYMap({
        id,
        type,
        ideviceType: type,
        content,
        htmlContent: content,
        order: 0,
        properties: new MockYMap(properties),
    });
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

        it('should extract identifier property from block', () => {
            const block = createMockBlock('b1', 'Block 1', [], { identifier: 'custom-block-id' });
            const page = createMockPage('p1', 'Page', [block]);

            manager = new MockYjsDocumentManager({}, [page]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            expect(pages[0].blocks[0].properties?.identifier).toBe('custom-block-id');
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
                identifier: 'my-id',
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
                identifier: 'my-id',
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
});

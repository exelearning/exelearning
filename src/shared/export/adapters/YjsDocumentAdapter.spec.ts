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
const createMockPage = (id: string, title: string, blocks: unknown[] = [], children: unknown[] = []) => {
    return new MockYMap({
        id,
        pageId: id,
        title,
        pageName: title,
        parentId: null,
        order: 0,
        blocks: new MockYArray(blocks),
        children: new MockYArray(children),
    });
};

const createMockBlock = (id: string, name: string, components: unknown[] = []) => {
    return new MockYMap({
        id,
        name,
        blockName: name,
        order: 0,
        components: new MockYArray(components),
    });
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
                version: '4.0',
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
            expect(metadata.version).toBe('4.0');
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

        it('should flatten hierarchical navigation', () => {
            const childPage = createMockPage('child', 'Child Page');
            const parentPage = createMockPage('parent', 'Parent Page', [], [childPage]);

            manager = new MockYjsDocumentManager({}, [parentPage]);
            adapter = new YjsDocumentAdapter(manager as any);

            const pages = adapter.getNavigation();

            // Should include both parent and child
            expect(pages).toHaveLength(2);
            expect(pages[0].id).toBe('parent');
            expect(pages[1].id).toBe('child');
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
});

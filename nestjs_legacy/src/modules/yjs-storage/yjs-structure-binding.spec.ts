/**
 * Tests for YjsStructureBinding
 * These tests verify the Yjs document structure binding logic.
 * Since YjsStructureBinding is a browser JavaScript class, we test the core logic.
 */

import * as Y from 'yjs';

/**
 * Minimal implementation of YjsStructureBinding for testing
 * This mirrors the actual implementation in public/app/yjs/YjsStructureBinding.js
 */
class YjsStructureBindingTestable {
    private ydoc: Y.Doc;
    private Y: typeof Y;

    constructor(ydoc: Y.Doc) {
        this.ydoc = ydoc;
        this.Y = Y;
    }

    generateId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    getNavigation(): Y.Array<unknown> {
        return this.ydoc.getArray('navigation');
    }

    getPages(): Array<{
        id: string;
        pageId: string;
        pageName: string;
        parentId: string | null;
        order: number;
    }> {
        const navigation = this.getNavigation();
        const pages: Array<{
            id: string;
            pageId: string;
            pageName: string;
            parentId: string | null;
            order: number;
        }> = [];

        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            if (pageMap && pageMap.get) {
                pages.push({
                    id: pageMap.get('id') as string,
                    pageId: pageMap.get('id') as string,
                    pageName:
                        (pageMap.get('title') as string) || (pageMap.get('pageName') as string),
                    parentId: pageMap.get('parentId') as string | null,
                    order: (pageMap.get('order') as number) || i,
                });
            }
        }

        return pages;
    }

    createPage(
        title: string,
        parentId: string | null = null,
    ): { id: string; pageId: string; pageName: string; parentId: string | null; order: number } {
        const navigation = this.getNavigation();
        const pageId = this.generateId();

        const pageMap = new Y.Map();
        pageMap.set('id', pageId);
        pageMap.set('title', title);
        pageMap.set('pageName', title);
        pageMap.set('parentId', parentId);
        pageMap.set('order', navigation.length);
        pageMap.set('blocks', new Y.Array());
        pageMap.set('children', new Y.Array());

        navigation.push([pageMap]);

        return {
            id: pageId,
            pageId: pageId,
            pageName: title,
            parentId: parentId,
            order: navigation.length - 1,
        };
    }

    getPage(pageId: string): Y.Map<unknown> | null {
        const navigation = this.getNavigation();
        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            if (pageMap && pageMap.get && pageMap.get('id') === pageId) {
                return pageMap;
            }
        }
        return null;
    }

    updatePage(pageId: string, updates: { pageName?: string }): boolean {
        const pageMap = this.getPage(pageId);
        if (!pageMap) return false;

        if (updates.pageName !== undefined) {
            pageMap.set('title', updates.pageName);
            pageMap.set('pageName', updates.pageName);
        }

        return true;
    }

    deletePage(pageId: string): boolean {
        const navigation = this.getNavigation();
        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            if (pageMap && pageMap.get && pageMap.get('id') === pageId) {
                navigation.delete(i, 1);
                return true;
            }
        }
        return false;
    }

    createBlock(pageId: string, blockName: string = 'Block'): string | null {
        const pageMap = this.getPage(pageId);
        if (!pageMap) return null;

        const blocksArray = pageMap.get('blocks') as Y.Array<unknown>;
        if (!blocksArray) return null;

        const blockId = this.generateId();
        const blockMap = new Y.Map();
        blockMap.set('id', blockId);
        blockMap.set('name', blockName);
        blockMap.set('order', blocksArray.length);
        blockMap.set('components', new Y.Array());

        blocksArray.push([blockMap]);
        return blockId;
    }

    getBlocks(
        pageId: string,
    ): Array<{ id: string; name: string; blockName?: string; order: number }> {
        const pageMap = this.getPage(pageId);
        if (!pageMap) return [];

        const blocksArray = pageMap.get('blocks') as Y.Array<unknown>;
        if (!blocksArray) return [];

        const blocks: Array<{ id: string; name: string; blockName?: string; order: number }> = [];
        for (let i = 0; i < blocksArray.length; i++) {
            const blockMap = blocksArray.get(i) as Y.Map<unknown>;
            if (blockMap && blockMap.get) {
                const name =
                    (blockMap.get('name') as string) || (blockMap.get('blockName') as string);
                blocks.push({
                    id: blockMap.get('id') as string,
                    name: name,
                    blockName: name,
                    order: (blockMap.get('order') as number) || i,
                });
            }
        }

        return blocks;
    }

    getComponents(
        pageId: string,
        blockId: string,
    ): Array<{ id: string; ideviceType?: string; type?: string; order: number }> {
        const pageMap = this.getPage(pageId);
        if (!pageMap) return [];

        const blocksArray = pageMap.get('blocks') as Y.Array<unknown>;
        if (!blocksArray) return [];

        for (let i = 0; i < blocksArray.length; i++) {
            const blockMap = blocksArray.get(i) as Y.Map<unknown>;
            if (blockMap && blockMap.get && blockMap.get('id') === blockId) {
                const componentsArray = blockMap.get('components') as Y.Array<unknown>;
                if (!componentsArray) return [];

                const components: Array<{
                    id: string;
                    ideviceType?: string;
                    type?: string;
                    order: number;
                }> = [];
                for (let j = 0; j < componentsArray.length; j++) {
                    const compMap = componentsArray.get(j) as Y.Map<unknown>;
                    if (compMap && compMap.get) {
                        components.push({
                            id: compMap.get('id') as string,
                            ideviceType: compMap.get('ideviceType') as string,
                            type: compMap.get('ideviceType') as string,
                            order: (compMap.get('order') as number) || j,
                        });
                    }
                }
                return components;
            }
        }
        return [];
    }

    clearNavigation(): void {
        const navigation = this.getNavigation();
        const length = navigation.length;
        if (length > 0) {
            navigation.delete(0, length);
        }
    }

    importFromApiStructure(
        apiStructure: Array<{
            pageId: string;
            pageName: string;
            parent: string | null;
            order: number;
            odePagStructureSyncs: Array<{
                blockId: string;
                blockName: string;
                order: number;
                odeComponentsSyncs: Array<{
                    odeComponentSyncId: string;
                    odeIdeviceTypeName: string;
                    htmlView: string;
                    order: number;
                }>;
            }>;
        }>,
    ): void {
        if (!apiStructure || !Array.isArray(apiStructure)) {
            return;
        }

        const navigation = this.getNavigation();

        // Use a transaction for atomic operations
        this.ydoc.transact(() => {
            // Clear existing
            if (navigation.length > 0) {
                navigation.delete(0, navigation.length);
            }

            // Import each page
            for (const apiPage of apiStructure) {
                const pageMap = new Y.Map();
                pageMap.set('id', apiPage.pageId);
                pageMap.set('pageId', apiPage.pageId);
                pageMap.set('pageName', apiPage.pageName);
                pageMap.set('title', apiPage.pageName);
                pageMap.set('parentId', apiPage.parent);
                pageMap.set('order', apiPage.order);

                // Create blocks array
                const blocksArray = new Y.Array();
                if (apiPage.odePagStructureSyncs && apiPage.odePagStructureSyncs.length > 0) {
                    for (const apiBlock of apiPage.odePagStructureSyncs) {
                        const blockMap = new Y.Map();
                        blockMap.set('id', apiBlock.blockId);
                        blockMap.set('blockId', apiBlock.blockId);
                        blockMap.set('name', apiBlock.blockName);
                        blockMap.set('blockName', apiBlock.blockName);
                        blockMap.set('order', apiBlock.order);

                        // Create components array
                        const componentsArray = new Y.Array();
                        if (apiBlock.odeComponentsSyncs && apiBlock.odeComponentsSyncs.length > 0) {
                            for (const apiComp of apiBlock.odeComponentsSyncs) {
                                const compMap = new Y.Map();
                                compMap.set('id', apiComp.odeComponentSyncId);
                                compMap.set('ideviceType', apiComp.odeIdeviceTypeName);
                                compMap.set('order', apiComp.order);

                                // Store HTML content as Y.Text
                                const htmlText = new Y.Text();
                                if (apiComp.htmlView) {
                                    htmlText.insert(0, apiComp.htmlView);
                                }
                                compMap.set('htmlContent', htmlText);

                                componentsArray.push([compMap]);
                            }
                        }
                        blockMap.set('components', componentsArray);

                        blocksArray.push([blockMap]);
                    }
                }
                pageMap.set('blocks', blocksArray);

                navigation.push([pageMap]);
            }
        }, 'import');
    }

    /**
     * Update a block's properties
     * Mirrors YjsStructureBinding.updateBlock from the frontend
     */
    updateBlock(blockId: string, updates: { properties?: Record<string, unknown> }): boolean {
        const navigation = this.getNavigation();

        // Search all pages for the block
        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            const blocks = pageMap.get('blocks') as Y.Array<unknown>;
            if (!blocks) continue;

            for (let j = 0; j < blocks.length; j++) {
                const blockMap = blocks.get(j) as Y.Map<unknown>;
                if (
                    blockMap.get('id') === blockId ||
                    blockMap.get('blockId') === blockId
                ) {
                    this.ydoc.transact(() => {
                        if (updates.properties && typeof updates.properties === 'object') {
                            let propsMap = blockMap.get('properties') as Y.Map<unknown>;
                            if (!propsMap || typeof (propsMap as Y.Map<unknown>).set !== 'function') {
                                propsMap = new Y.Map();
                                blockMap.set('properties', propsMap);
                            }
                            Object.entries(updates.properties).forEach(([key, value]) => {
                                (propsMap as Y.Map<unknown>).set(key, value);
                            });
                        }
                    });
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Get properties for a block
     * Mirrors YjsStructureBinding.getBlockProperties from the frontend
     */
    getBlockProperties(blockId: string): Record<string, unknown> | null {
        const navigation = this.getNavigation();

        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            const blocks = pageMap.get('blocks') as Y.Array<unknown>;
            if (!blocks) continue;

            for (let j = 0; j < blocks.length; j++) {
                const blockMap = blocks.get(j) as Y.Map<unknown>;
                // Search by both id and blockId (same as frontend fix)
                if (
                    blockMap.get('id') === blockId ||
                    blockMap.get('blockId') === blockId
                ) {
                    const propsMap = blockMap.get('properties') as Y.Map<unknown>;
                    if (propsMap && typeof (propsMap as Y.Map<unknown>).toJSON === 'function') {
                        return (propsMap as Y.Map<unknown>).toJSON() as Record<string, unknown>;
                    } else if (propsMap && typeof propsMap === 'object') {
                        return { ...propsMap } as Record<string, unknown>;
                    }
                    return {};
                }
            }
        }
        return null;
    }

    /**
     * Create a component in a block
     * Mirrors YjsStructureBinding.createComponent from the frontend
     */
    createComponent(pageId: string, blockId: string, ideviceType: string): string | null {
        const pageMap = this.getPage(pageId);
        if (!pageMap) return null;

        const blocksArray = pageMap.get('blocks') as Y.Array<unknown>;
        if (!blocksArray) return null;

        for (let i = 0; i < blocksArray.length; i++) {
            const blockMap = blocksArray.get(i) as Y.Map<unknown>;
            if (blockMap && blockMap.get('id') === blockId) {
                const componentsArray = blockMap.get('components') as Y.Array<unknown>;
                if (!componentsArray) return null;

                const componentId = this.generateId();
                const compMap = new Y.Map();
                compMap.set('id', componentId);
                compMap.set('ideviceType', ideviceType);
                compMap.set('order', componentsArray.length);

                componentsArray.push([compMap]);
                return componentId;
            }
        }
        return null;
    }

    /**
     * Get a component Y.Map by ID
     * Mirrors YjsStructureBinding.getComponentMap from the frontend
     */
    getComponentMap(componentId: string): Y.Map<unknown> | null {
        const navigation = this.getNavigation();

        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            const blocks = pageMap.get('blocks') as Y.Array<unknown>;
            if (!blocks) continue;

            for (let j = 0; j < blocks.length; j++) {
                const blockMap = blocks.get(j) as Y.Map<unknown>;
                const components = blockMap.get('components') as Y.Array<unknown>;
                if (!components) continue;

                for (let k = 0; k < components.length; k++) {
                    const compMap = components.get(k) as Y.Map<unknown>;
                    if (
                        compMap.get('id') === componentId ||
                        compMap.get('ideviceId') === componentId
                    ) {
                        return compMap;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Update a component's properties
     * Mirrors YjsStructureBinding.updateComponent from the frontend
     */
    updateComponent(
        componentId: string,
        updates: { properties?: Record<string, unknown> },
    ): boolean {
        const compMap = this.getComponentMap(componentId);
        if (!compMap) return false;

        // Checkbox fields that should be converted to boolean for iDevices
        // visibility and teacherOnly are checkbox fields from ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG
        const checkboxFields = ['visibility', 'teacherOnly'];

        this.ydoc.transact(() => {
            if (updates.properties && typeof updates.properties === 'object') {
                let propsMap = compMap.get('properties') as Y.Map<unknown>;
                if (!propsMap || typeof (propsMap as Y.Map<unknown>).set !== 'function') {
                    propsMap = new Y.Map();
                    compMap.set('properties', propsMap);
                }
                // Update each property, converting checkbox values properly
                Object.entries(updates.properties).forEach(([key, value]) => {
                    let finalValue = value;
                    if (checkboxFields.includes(key)) {
                        finalValue = value === true || value === 'true' || value === '1';
                    }
                    (propsMap as Y.Map<unknown>).set(key, finalValue);
                });
            }
        });
        return true;
    }

    /**
     * Get properties for a component (iDevice)
     * Mirrors YjsStructureBinding.getComponentProperties from the frontend
     */
    getComponentProperties(componentId: string): Record<string, unknown> | null {
        const navigation = this.getNavigation();

        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            const blocks = pageMap.get('blocks') as Y.Array<unknown>;
            if (!blocks) continue;

            for (let j = 0; j < blocks.length; j++) {
                const blockMap = blocks.get(j) as Y.Map<unknown>;
                const components = blockMap.get('components') as Y.Array<unknown>;
                if (!components) continue;

                for (let k = 0; k < components.length; k++) {
                    const compMap = components.get(k) as Y.Map<unknown>;
                    // Search by both id and ideviceId (same as frontend)
                    if (
                        compMap.get('id') === componentId ||
                        compMap.get('ideviceId') === componentId
                    ) {
                        const propsMap = compMap.get('properties') as Y.Map<unknown>;
                        if (propsMap && typeof (propsMap as Y.Map<unknown>).toJSON === 'function') {
                            return (propsMap as Y.Map<unknown>).toJSON() as Record<string, unknown>;
                        } else if (propsMap && typeof propsMap === 'object') {
                            return { ...propsMap } as Record<string, unknown>;
                        }
                        return {};
                    }
                }
            }
        }
        return null;
    }
}

describe('YjsStructureBinding', () => {
    let ydoc: Y.Doc;
    let binding: YjsStructureBindingTestable;

    beforeEach(() => {
        ydoc = new Y.Doc();
        binding = new YjsStructureBindingTestable(ydoc);
    });

    afterEach(() => {
        ydoc.destroy();
    });

    describe('createPage', () => {
        it('should create a page with the given title', () => {
            const page = binding.createPage('Test Page');

            expect(page).not.toBeNull();
            expect(page.pageName).toBe('Test Page');
            expect(page.id).toBeDefined();
            expect(page.parentId).toBeNull();
        });

        it('should create a page with a parent', () => {
            const parentPage = binding.createPage('Parent Page');
            const childPage = binding.createPage('Child Page', parentPage.id);

            expect(childPage.parentId).toBe(parentPage.id);
        });

        it('should add page to navigation array', () => {
            binding.createPage('Page 1');
            binding.createPage('Page 2');

            const pages = binding.getPages();
            expect(pages.length).toBe(2);
        });

        it('should generate unique IDs', () => {
            const page1 = binding.createPage('Page 1');
            const page2 = binding.createPage('Page 2');

            expect(page1.id).not.toBe(page2.id);
        });
    });

    describe('getPages', () => {
        it('should return empty array for empty document', () => {
            const pages = binding.getPages();
            expect(pages).toEqual([]);
        });

        it('should return all pages', () => {
            binding.createPage('Page 1');
            binding.createPage('Page 2');
            binding.createPage('Page 3');

            const pages = binding.getPages();
            expect(pages.length).toBe(3);
            expect(pages.map((p) => p.pageName)).toContain('Page 1');
            expect(pages.map((p) => p.pageName)).toContain('Page 2');
            expect(pages.map((p) => p.pageName)).toContain('Page 3');
        });
    });

    describe('getPage', () => {
        it('should return null for non-existent page', () => {
            const page = binding.getPage('non-existent');
            expect(page).toBeNull();
        });

        it('should return page by ID', () => {
            const createdPage = binding.createPage('Test Page');
            const retrievedPage = binding.getPage(createdPage.id);

            expect(retrievedPage).not.toBeNull();
            expect(retrievedPage?.get('id')).toBe(createdPage.id);
        });
    });

    describe('updatePage', () => {
        it('should update page name', () => {
            const page = binding.createPage('Original Name');
            const success = binding.updatePage(page.id, { pageName: 'Updated Name' });

            expect(success).toBe(true);

            const pages = binding.getPages();
            expect(pages[0].pageName).toBe('Updated Name');
        });

        it('should return false for non-existent page', () => {
            const success = binding.updatePage('non-existent', { pageName: 'Test' });
            expect(success).toBe(false);
        });
    });

    describe('deletePage', () => {
        it('should delete page by ID', () => {
            const page = binding.createPage('To Delete');
            expect(binding.getPages().length).toBe(1);

            const success = binding.deletePage(page.id);

            expect(success).toBe(true);
            expect(binding.getPages().length).toBe(0);
        });

        it('should return false for non-existent page', () => {
            const success = binding.deletePage('non-existent');
            expect(success).toBe(false);
        });
    });

    describe('createBlock', () => {
        it('should create block in a page', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');

            expect(blockId).not.toBeNull();

            const blocks = binding.getBlocks(page.id);
            expect(blocks.length).toBe(1);
            expect(blocks[0].name).toBe('Test Block');
        });

        it('should return null for non-existent page', () => {
            const blockId = binding.createBlock('non-existent', 'Test Block');
            expect(blockId).toBeNull();
        });
    });

    describe('getBlocks', () => {
        it('should return empty array for page with no blocks', () => {
            const page = binding.createPage('Test Page');
            const blocks = binding.getBlocks(page.id);
            expect(blocks).toEqual([]);
        });

        it('should return all blocks for a page', () => {
            const page = binding.createPage('Test Page');
            binding.createBlock(page.id, 'Block 1');
            binding.createBlock(page.id, 'Block 2');

            const blocks = binding.getBlocks(page.id);
            expect(blocks.length).toBe(2);
        });

        it('should return empty array for non-existent page', () => {
            const blocks = binding.getBlocks('non-existent');
            expect(blocks).toEqual([]);
        });
    });

    describe('Yjs sync', () => {
        it('should sync changes between two documents', () => {
            // Create a page in the first doc
            binding.createPage('Synced Page');

            // Get state from first doc
            const state = Y.encodeStateAsUpdate(ydoc);

            // Apply to a second doc
            const ydoc2 = new Y.Doc();
            Y.applyUpdate(ydoc2, state);

            const binding2 = new YjsStructureBindingTestable(ydoc2);
            const pages = binding2.getPages();

            expect(pages.length).toBe(1);
            expect(pages[0].pageName).toBe('Synced Page');

            ydoc2.destroy();
        });

        it('should merge concurrent changes', () => {
            // Doc 1 creates a page
            binding.createPage('Page from Doc 1');

            // Doc 2 (initially empty) creates a different page
            const ydoc2 = new Y.Doc();
            const binding2 = new YjsStructureBindingTestable(ydoc2);
            binding2.createPage('Page from Doc 2');

            // Sync both ways
            const state1 = Y.encodeStateAsUpdate(ydoc);
            const state2 = Y.encodeStateAsUpdate(ydoc2);

            Y.applyUpdate(ydoc, state2);
            Y.applyUpdate(ydoc2, state1);

            // Both should now have both pages
            const pages1 = binding.getPages();
            const pages2 = binding2.getPages();

            expect(pages1.length).toBe(2);
            expect(pages2.length).toBe(2);

            ydoc2.destroy();
        });
    });

    describe('generateId', () => {
        it('should generate valid UUID-like IDs', () => {
            const id = binding.generateId();

            // UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            expect(id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
            );
        });

        it('should generate unique IDs', () => {
            const ids = new Set<string>();
            for (let i = 0; i < 100; i++) {
                ids.add(binding.generateId());
            }
            expect(ids.size).toBe(100);
        });
    });

    describe('clearNavigation', () => {
        it('should clear all pages from navigation', () => {
            binding.createPage('Page 1');
            binding.createPage('Page 2');
            binding.createPage('Page 3');
            expect(binding.getPages().length).toBe(3);

            binding.clearNavigation();

            expect(binding.getPages().length).toBe(0);
        });

        it('should not throw on empty navigation', () => {
            expect(() => binding.clearNavigation()).not.toThrow();
            expect(binding.getPages().length).toBe(0);
        });
    });

    describe('importFromApiStructure', () => {
        it('should import pages from API structure', () => {
            const apiStructure = [
                {
                    pageId: 'page-1',
                    pageName: 'Introduction',
                    parent: null,
                    order: 0,
                    odePagStructureSyncs: [],
                },
                {
                    pageId: 'page-2',
                    pageName: 'Chapter 1',
                    parent: null,
                    order: 1,
                    odePagStructureSyncs: [],
                },
            ];

            binding.importFromApiStructure(apiStructure);

            const pages = binding.getPages();
            expect(pages.length).toBe(2);
            expect(pages[0].pageName).toBe('Introduction');
            expect(pages[1].pageName).toBe('Chapter 1');
        });

        it('should clear existing pages before import', () => {
            binding.createPage('Old Page');
            expect(binding.getPages().length).toBe(1);

            const apiStructure = [
                {
                    pageId: 'new-page-1',
                    pageName: 'New Page',
                    parent: null,
                    order: 0,
                    odePagStructureSyncs: [],
                },
            ];

            binding.importFromApiStructure(apiStructure);

            const pages = binding.getPages();
            expect(pages.length).toBe(1);
            expect(pages[0].pageName).toBe('New Page');
        });

        it('should import pages with parent relationships', () => {
            const apiStructure = [
                {
                    pageId: 'parent-page',
                    pageName: 'Parent',
                    parent: null,
                    order: 0,
                    odePagStructureSyncs: [],
                },
                {
                    pageId: 'child-page',
                    pageName: 'Child',
                    parent: 'parent-page',
                    order: 0,
                    odePagStructureSyncs: [],
                },
            ];

            binding.importFromApiStructure(apiStructure);

            const pages = binding.getPages();
            expect(pages.length).toBe(2);
            const childPage = pages.find((p) => p.pageName === 'Child');
            expect(childPage?.parentId).toBe('parent-page');
        });

        it('should import pages with blocks', () => {
            const apiStructure = [
                {
                    pageId: 'page-with-block',
                    pageName: 'Page with Block',
                    parent: null,
                    order: 0,
                    odePagStructureSyncs: [
                        {
                            blockId: 'block-1',
                            blockName: 'Main Block',
                            order: 0,
                            odeComponentsSyncs: [],
                        },
                    ],
                },
            ];

            binding.importFromApiStructure(apiStructure);

            const pages = binding.getPages();
            expect(pages.length).toBe(1);
            const blocks = binding.getBlocks(pages[0].id);
            expect(blocks.length).toBe(1);
            expect(blocks[0].name || blocks[0].blockName).toBe('Main Block');
        });

        it('should import pages with blocks and components', () => {
            const apiStructure = [
                {
                    pageId: 'page-with-content',
                    pageName: 'Page with Content',
                    parent: null,
                    order: 0,
                    odePagStructureSyncs: [
                        {
                            blockId: 'block-1',
                            blockName: 'Content Block',
                            order: 0,
                            odeComponentsSyncs: [
                                {
                                    odeComponentSyncId: 'comp-1',
                                    odeIdeviceTypeName: 'FreeTextIdevice',
                                    htmlView: '<p>Hello World</p>',
                                    order: 0,
                                },
                            ],
                        },
                    ],
                },
            ];

            binding.importFromApiStructure(apiStructure);

            const pages = binding.getPages();
            expect(pages.length).toBe(1);

            const blocks = binding.getBlocks(pages[0].id);
            expect(blocks.length).toBe(1);

            const components = binding.getComponents(pages[0].id, blocks[0].id);
            expect(components.length).toBe(1);
            expect(components[0].ideviceType || components[0].type).toBe('FreeTextIdevice');
        });

        it('should handle null or undefined API structure', () => {
            binding.importFromApiStructure(null as unknown as never[]);
            expect(binding.getPages().length).toBe(0);

            binding.importFromApiStructure(undefined as unknown as never[]);
            expect(binding.getPages().length).toBe(0);
        });

        it('should handle empty API structure', () => {
            binding.importFromApiStructure([]);
            expect(binding.getPages().length).toBe(0);
        });
    });

    describe('Block Properties', () => {
        /**
         * Tests for block properties persistence
         * These tests validate the flow:
         * 1. Properties are stored in Y.Map
         * 2. Properties are retrieved correctly
         * 3. Boolean values are handled properly
         */

        it('should create block with properties Y.Map', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');

            expect(blockId).not.toBeNull();

            // Get the block Y.Map directly
            const pageMap = binding.getPage(page.id);
            const blocksArray = pageMap?.get('blocks') as Y.Array<unknown>;
            const blockMap = blocksArray?.get(0) as Y.Map<unknown>;

            // Verify block exists
            expect(blockMap).toBeDefined();
            expect(blockMap.get('id')).toBe(blockId);
        });

        it('should store and retrieve block properties', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');

            // Get the block Y.Map
            const pageMap = binding.getPage(page.id);
            const blocksArray = pageMap?.get('blocks') as Y.Array<unknown>;
            const blockMap = blocksArray?.get(0) as Y.Map<unknown>;

            // Create properties Y.Map
            const propsMap = new Y.Map();
            propsMap.set('visibility', true);
            propsMap.set('teacherOnly', false);
            propsMap.set('identifier', 'test-id');
            blockMap.set('properties', propsMap);

            // Retrieve and verify
            const retrievedProps = blockMap.get('properties') as Y.Map<unknown>;
            expect(retrievedProps).toBeDefined();
            expect(retrievedProps.get('visibility')).toBe(true);
            expect(retrievedProps.get('teacherOnly')).toBe(false);
            expect(retrievedProps.get('identifier')).toBe('test-id');
        });

        it('should convert Y.Map properties to JSON', () => {
            const page = binding.createPage('Test Page');
            binding.createBlock(page.id, 'Test Block');

            // Get the block Y.Map
            const pageMap = binding.getPage(page.id);
            const blocksArray = pageMap?.get('blocks') as Y.Array<unknown>;
            const blockMap = blocksArray?.get(0) as Y.Map<unknown>;

            // Create properties Y.Map with boolean values (as Yjs stores them)
            const propsMap = new Y.Map();
            propsMap.set('visibility', true);
            propsMap.set('teacherOnly', true);
            propsMap.set('allowToggle', false);
            propsMap.set('minimized', false);
            propsMap.set('identifier', 'my-block');
            propsMap.set('cssClass', 'custom-class');
            blockMap.set('properties', propsMap);

            // Convert to JSON (simulating what apiCallManager does)
            const jsonProps = propsMap.toJSON();

            expect(jsonProps).toEqual({
                visibility: true,
                teacherOnly: true,
                allowToggle: false,
                minimized: false,
                identifier: 'my-block',
                cssClass: 'custom-class',
            });
        });

        it('should convert boolean properties to strings for frontend compatibility', () => {
            // This test simulates the conversion in apiCallManager._getComponentsByPageFromYjs
            const blockProperties = {
                visibility: true,
                teacherOnly: true,
                allowToggle: false,
                minimized: false,
                identifier: 'my-block',
                cssClass: 'custom-class',
            };

            // Conversion logic from apiCallManager.js
            const odePagStructureSyncProperties: Record<string, { value: string }> = {};
            Object.entries(blockProperties).forEach(([key, value]) => {
                const stringValue =
                    typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
                odePagStructureSyncProperties[key] = { value: stringValue };
            });

            // Verify format is correct for setProperties()
            expect(odePagStructureSyncProperties).toEqual({
                visibility: { value: 'true' },
                teacherOnly: { value: 'true' },
                allowToggle: { value: 'false' },
                minimized: { value: 'false' },
                identifier: { value: 'my-block' },
                cssClass: { value: 'custom-class' },
            });

            // Verify that setProperties can access the values correctly
            expect(odePagStructureSyncProperties['visibility'].value).toBe('true');
            expect(odePagStructureSyncProperties['teacherOnly'].value).toBe('true');
            expect(odePagStructureSyncProperties['allowToggle'].value).toBe('false');

            // Verify string comparison works (this is what modalProperties.js does)
            expect(odePagStructureSyncProperties['visibility'].value === 'true').toBe(true);
            expect(odePagStructureSyncProperties['teacherOnly'].value === 'true').toBe(true);
            expect(odePagStructureSyncProperties['allowToggle'].value === 'true').toBe(false);
        });

        it('should demonstrate JavaScript boolean to string comparison issue', () => {
            // This test documents the core issue we fixed
            // In JavaScript, true == 'true' is FALSE

            // Using type coercion to demonstrate the bug
            const boolTrue: unknown = true;
            const boolFalse: unknown = false;
            const strTrue: unknown = 'true';
            const strFalse: unknown = 'false';

            // Boolean comparison (the bug) - these fail because JS coerces differently
            // eslint-disable-next-line eqeqeq
            expect(boolTrue == strTrue).toBe(false);
            // eslint-disable-next-line eqeqeq
            expect(boolFalse == strFalse).toBe(false);

            // String comparison (correct behavior after fix)
            // eslint-disable-next-line eqeqeq
            expect(strTrue == 'true').toBe(true);
            // eslint-disable-next-line eqeqeq
            expect(strFalse == 'true').toBe(false);

            // This is why we must convert booleans to strings
            const boolValue = true;
            const stringValue = boolValue ? 'true' : 'false';
            expect(stringValue).toBe('true');
        });

        it('should handle properties sync between documents', () => {
            // Create page and block in doc1
            binding.createPage('Test Page');
            const pages = binding.getPages();
            const pageId = pages[0].id;
            binding.createBlock(pageId, 'Test Block');

            // Set properties
            const pageMap = binding.getPage(pageId);
            const blocksArray = pageMap?.get('blocks') as Y.Array<unknown>;
            const blockMap = blocksArray?.get(0) as Y.Map<unknown>;
            const propsMap = new Y.Map();
            propsMap.set('visibility', true);
            propsMap.set('identifier', 'synced-block');
            blockMap.set('properties', propsMap);

            // Sync to second doc
            const state = Y.encodeStateAsUpdate(ydoc);
            const ydoc2 = new Y.Doc();
            Y.applyUpdate(ydoc2, state);

            // Verify properties synced
            const binding2 = new YjsStructureBindingTestable(ydoc2);
            const pages2 = binding2.getPages();
            const pageMap2 = binding2.getPage(pages2[0].id);
            const blocksArray2 = pageMap2?.get('blocks') as Y.Array<unknown>;
            const blockMap2 = blocksArray2?.get(0) as Y.Map<unknown>;
            const propsMap2 = blockMap2.get('properties') as Y.Map<unknown>;

            expect(propsMap2).toBeDefined();
            expect(propsMap2.get('visibility')).toBe(true);
            expect(propsMap2.get('identifier')).toBe('synced-block');

            ydoc2.destroy();
        });

        it('should find block properties by id field using getBlockProperties()', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');

            // Set properties using updateBlock
            binding.updateBlock(blockId as string, {
                properties: { visibility: true, identifier: 'test-id' },
            });

            // Search by id using getBlockProperties
            const props = binding.getBlockProperties(blockId as string);
            expect(props).not.toBeNull();
            expect(props?.visibility).toBe(true);
            expect(props?.identifier).toBe('test-id');
        });

        it('should find block properties by blockId field (fallback)', () => {
            // Simulates scenario where blockId in Y.Map differs from id
            const page = binding.createPage('Test Page');
            binding.createBlock(page.id, 'Test Block');

            // Manually set a different blockId in the Y.Map
            const pageMap = binding.getPage(page.id);
            const blocksArray = pageMap?.get('blocks') as Y.Array<unknown>;
            const blockMap = blocksArray?.get(0) as Y.Map<unknown>;
            const originalId = blockMap.get('id') as string;
            blockMap.set('blockId', 'alternate-block-id'); // Set alternate blockId

            // Set properties
            const propsMap = new Y.Map();
            propsMap.set('visibility', true);
            propsMap.set('teacherOnly', false);
            blockMap.set('properties', propsMap);

            // Should find by alternate blockId
            const props = binding.getBlockProperties('alternate-block-id');
            expect(props).not.toBeNull();
            expect(props?.visibility).toBe(true);

            // Should also find by original id
            const propsById = binding.getBlockProperties(originalId);
            expect(propsById).not.toBeNull();
            expect(propsById?.visibility).toBe(true);
        });
    });

    describe('Component Properties', () => {
        it('should update component properties as Y.Map', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');
            const componentId = binding.createComponent(page.id, blockId as string, 'FreeTextIdevice');

            binding.updateComponent(componentId as string, {
                properties: { visibility: true, teacherOnly: false },
            });

            const props = binding.getComponentProperties(componentId as string);
            expect(props).not.toBeNull();
            expect(props?.visibility).toBe(true);
            expect(props?.teacherOnly).toBe(false);
        });

        it('should convert checkbox string values to booleans', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');
            const componentId = binding.createComponent(page.id, blockId as string, 'FreeTextIdevice');

            binding.updateComponent(componentId as string, {
                properties: { visibility: 'true', teacherOnly: '1', identifier: 'my-id' },
            });

            const props = binding.getComponentProperties(componentId as string);
            expect(props?.visibility).toBe(true);
            expect(props?.teacherOnly).toBe(true);
            // identifier is not a checkbox field, so it should remain as string
            expect(props?.identifier).toBe('my-id');
        });

        it('should find component properties by ideviceId fallback', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');
            const componentId = binding.createComponent(page.id, blockId as string, 'FreeTextIdevice');

            // Get the component map and set alternate ideviceId
            const compMap = binding.getComponentMap(componentId as string);
            expect(compMap).not.toBeNull();
            compMap?.set('ideviceId', 'alternate-idevice-id');

            // Set properties directly on the Y.Map
            const propsMap = new Y.Map();
            propsMap.set('visibility', true);
            propsMap.set('teacherOnly', false);
            compMap?.set('properties', propsMap);

            // Should find by alternate ideviceId
            const props = binding.getComponentProperties('alternate-idevice-id');
            expect(props).not.toBeNull();
            expect(props?.visibility).toBe(true);
            expect(props?.teacherOnly).toBe(false);

            // Should also find by original id
            const propsById = binding.getComponentProperties(componentId as string);
            expect(propsById).not.toBeNull();
            expect(propsById?.visibility).toBe(true);
        });

        it('should return empty object when component has no properties', () => {
            const page = binding.createPage('Test Page');
            const blockId = binding.createBlock(page.id, 'Test Block');
            const componentId = binding.createComponent(page.id, blockId as string, 'FreeTextIdevice');

            const props = binding.getComponentProperties(componentId as string);
            expect(props).toEqual({});
        });

        it('should return null for non-existent component', () => {
            const props = binding.getComponentProperties('non-existent-id');
            expect(props).toBeNull();
        });
    });
});

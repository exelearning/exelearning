/**
 * Structure Binding Tests
 *
 * Tests for CRUD operations on Y.Doc structure:
 * - Pages (navigation)
 * - Blocks (containers within pages)
 * - Components (iDevices within blocks)
 * - Metadata
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import * as Y from 'yjs';
import {
    generateId,
    getNavigation,
    getMetadata,
    getAssets,
    getAssetMetadata,
    setAssetMetadata,
    deleteAssetMetadata,
    getAllAssetsMetadata,
    findPageMap,
    findBlockMap,
    findBlockMapInPage,
    findComponentMap,
    getPages,
    getPage,
    addPage,
    updatePage,
    deletePage,
    movePage,
    getBlocks,
    getBlock,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    getComponents,
    getComponent,
    createComponent,
    updateComponent,
    setComponentHtml,
    deleteComponent,
    getMetadataData,
    updateMetadataData,
} from './structure-binding';

describe('structure-binding', () => {
    let ydoc: Y.Doc;

    beforeEach(() => {
        ydoc = new Y.Doc();
    });

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    describe('generateId', () => {
        it('should generate unique IDs with prefix', () => {
            const id1 = generateId('page');
            const id2 = generateId('page');

            expect(id1).toMatch(/^page-[a-z0-9]+-[a-z0-9]+$/);
            expect(id2).toMatch(/^page-[a-z0-9]+-[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should support different prefixes', () => {
            expect(generateId('block')).toMatch(/^block-/);
            expect(generateId('idevice')).toMatch(/^idevice-/);
        });
    });

    describe('getNavigation', () => {
        it('should return the navigation Y.Array', () => {
            const nav = getNavigation(ydoc);
            expect(nav).toBeInstanceOf(Y.Array);
        });

        it('should return same array on multiple calls', () => {
            const nav1 = getNavigation(ydoc);
            const nav2 = getNavigation(ydoc);
            expect(nav1).toBe(nav2);
        });
    });

    describe('getMetadata', () => {
        it('should return the metadata Y.Map', () => {
            const meta = getMetadata(ydoc);
            expect(meta).toBeInstanceOf(Y.Map);
        });
    });

    describe('getAssets', () => {
        it('should return the assets Y.Map', () => {
            const assets = getAssets(ydoc);
            expect(assets).toBeInstanceOf(Y.Map);
        });
    });

    // =========================================================================
    // ASSET OPERATIONS
    // =========================================================================

    describe('Asset Operations', () => {
        describe('getAssetMetadata', () => {
            it('should return null for non-existent asset', () => {
                const result = getAssetMetadata(ydoc, 'non-existent-id');
                expect(result).toBeNull();
            });

            it('should return asset metadata when it exists', () => {
                const metadata = {
                    filename: 'test.jpg',
                    folderPath: 'images',
                    mime: 'image/jpeg',
                    size: 1024,
                    uploaded: true,
                    createdAt: '2024-01-01T00:00:00Z',
                };
                setAssetMetadata(ydoc, 'test-asset-id', metadata);

                const result = getAssetMetadata(ydoc, 'test-asset-id');
                expect(result).not.toBeNull();
                expect(result?.filename).toBe('test.jpg');
                expect(result?.folderPath).toBe('images');
                expect(result?.mime).toBe('image/jpeg');
                expect(result?.size).toBe(1024);
                expect(result?.uploaded).toBe(true);
            });
        });

        describe('setAssetMetadata', () => {
            it('should set asset metadata successfully', () => {
                const metadata = {
                    filename: 'document.pdf',
                    folderPath: 'docs',
                    mime: 'application/pdf',
                    size: 2048,
                    uploaded: false,
                    createdAt: '2024-01-15T10:30:00Z',
                };

                const result = setAssetMetadata(ydoc, 'new-asset-id', metadata);

                expect(result.success).toBe(true);
                expect(result.data).toEqual(metadata);

                // Verify it was actually stored
                const stored = getAssetMetadata(ydoc, 'new-asset-id');
                expect(stored?.filename).toBe('document.pdf');
            });

            it('should update existing asset metadata', () => {
                const initialMetadata = {
                    filename: 'old.txt',
                    folderPath: '',
                    mime: 'text/plain',
                    size: 100,
                    uploaded: false,
                    createdAt: '2024-01-01T00:00:00Z',
                };
                setAssetMetadata(ydoc, 'update-asset-id', initialMetadata);

                const updatedMetadata = {
                    filename: 'new.txt',
                    folderPath: 'files',
                    mime: 'text/plain',
                    size: 200,
                    uploaded: true,
                    createdAt: '2024-01-01T00:00:00Z',
                };
                const result = setAssetMetadata(ydoc, 'update-asset-id', updatedMetadata);

                expect(result.success).toBe(true);
                const stored = getAssetMetadata(ydoc, 'update-asset-id');
                expect(stored?.filename).toBe('new.txt');
                expect(stored?.size).toBe(200);
                expect(stored?.uploaded).toBe(true);
            });

            it('should store optional hash field', () => {
                const metadata = {
                    filename: 'hashed.bin',
                    folderPath: '',
                    mime: 'application/octet-stream',
                    size: 512,
                    hash: 'sha256-abc123',
                    uploaded: true,
                    createdAt: '2024-01-20T12:00:00Z',
                };

                setAssetMetadata(ydoc, 'hashed-asset-id', metadata);
                const stored = getAssetMetadata(ydoc, 'hashed-asset-id');
                expect(stored?.hash).toBe('sha256-abc123');
            });
        });

        describe('deleteAssetMetadata', () => {
            it('should delete existing asset metadata', () => {
                const metadata = {
                    filename: 'to-delete.txt',
                    folderPath: '',
                    mime: 'text/plain',
                    size: 50,
                    uploaded: true,
                    createdAt: '2024-01-01T00:00:00Z',
                };
                setAssetMetadata(ydoc, 'delete-me-id', metadata);

                // Verify it exists
                expect(getAssetMetadata(ydoc, 'delete-me-id')).not.toBeNull();

                // Delete it
                const result = deleteAssetMetadata(ydoc, 'delete-me-id');
                expect(result.success).toBe(true);
                expect(result.data.deleted).toBe(true);

                // Verify it's gone
                expect(getAssetMetadata(ydoc, 'delete-me-id')).toBeNull();
            });

            it('should return deleted: false for non-existent asset', () => {
                const result = deleteAssetMetadata(ydoc, 'never-existed-id');
                expect(result.success).toBe(true);
                expect(result.data.deleted).toBe(false);
            });
        });

        describe('getAllAssetsMetadata', () => {
            it('should return empty array when no assets', () => {
                // Create a fresh ydoc for this test
                const freshYdoc = new Y.Doc();
                const result = getAllAssetsMetadata(freshYdoc);
                expect(result).toEqual([]);
                freshYdoc.destroy();
            });

            it('should return all assets with their IDs', () => {
                // Create a fresh ydoc for this test
                const freshYdoc = new Y.Doc();

                const asset1 = {
                    filename: 'image1.jpg',
                    folderPath: 'images',
                    mime: 'image/jpeg',
                    size: 1000,
                    uploaded: true,
                    createdAt: '2024-01-01T00:00:00Z',
                };
                const asset2 = {
                    filename: 'doc.pdf',
                    folderPath: 'docs',
                    mime: 'application/pdf',
                    size: 2000,
                    uploaded: false,
                    createdAt: '2024-01-02T00:00:00Z',
                };

                setAssetMetadata(freshYdoc, 'asset-1', asset1);
                setAssetMetadata(freshYdoc, 'asset-2', asset2);

                const result = getAllAssetsMetadata(freshYdoc);

                expect(result.length).toBe(2);

                const ids = result.map(a => a.id);
                expect(ids).toContain('asset-1');
                expect(ids).toContain('asset-2');

                const img = result.find(a => a.id === 'asset-1');
                expect(img?.filename).toBe('image1.jpg');
                expect(img?.folderPath).toBe('images');

                freshYdoc.destroy();
            });
        });
    });

    // =========================================================================
    // PAGE OPERATIONS
    // =========================================================================

    describe('Page Operations', () => {
        describe('addPage', () => {
            it('should create a new page', () => {
                const result = addPage(ydoc, { name: 'Test Page' });

                expect(result.success).toBe(true);
                expect(result.data).toBeDefined();
                expect(result.data?.pageName).toBe('Test Page');
                expect(result.data?.id).toMatch(/^page-/);
                expect(result.data?.order).toBe(0);
                expect(result.data?.parentId).toBeNull();
                expect(result.data?.blockCount).toBe(0);
            });

            it('should create page with parentId', () => {
                const parent = addPage(ydoc, { name: 'Parent' });
                const child = addPage(ydoc, { name: 'Child', parentId: parent.data!.id });

                expect(child.data?.parentId).toBe(parent.data!.id);
            });

            it('should increment order for each new page', () => {
                const page1 = addPage(ydoc, { name: 'Page 1' });
                const page2 = addPage(ydoc, { name: 'Page 2' });
                const page3 = addPage(ydoc, { name: 'Page 3' });

                expect(page1.data?.order).toBe(0);
                expect(page2.data?.order).toBe(1);
                expect(page3.data?.order).toBe(2);
            });

            it('should respect custom order', () => {
                const result = addPage(ydoc, { name: 'Test', order: 5 });
                expect(result.data?.order).toBe(5);
            });
        });

        describe('getPages', () => {
            it('should return empty array when no pages', () => {
                const pages = getPages(ydoc);
                expect(pages).toEqual([]);
            });

            it('should return all pages sorted by order', () => {
                addPage(ydoc, { name: 'Page 1' });
                addPage(ydoc, { name: 'Page 2' });
                addPage(ydoc, { name: 'Page 3' });

                const pages = getPages(ydoc);

                expect(pages.length).toBe(3);
                expect(pages[0].pageName).toBe('Page 1');
                expect(pages[1].pageName).toBe('Page 2');
                expect(pages[2].pageName).toBe('Page 3');
            });
        });

        describe('getPage', () => {
            it('should return null for non-existent page', () => {
                const page = getPage(ydoc, 'non-existent');
                expect(page).toBeNull();
            });

            it('should find page by id', () => {
                const created = addPage(ydoc, { name: 'Test Page' });
                const found = getPage(ydoc, created.data!.id);

                expect(found).not.toBeNull();
                expect(found?.pageName).toBe('Test Page');
            });
        });

        describe('findPageMap', () => {
            it('should return null for non-existent page', () => {
                const map = findPageMap(ydoc, 'non-existent');
                expect(map).toBeNull();
            });

            it('should find page Y.Map', () => {
                const created = addPage(ydoc, { name: 'Test' });
                const map = findPageMap(ydoc, created.data!.id);

                expect(map).toBeInstanceOf(Y.Map);
                expect(map?.get('pageName')).toBe('Test');
            });
        });

        describe('updatePage', () => {
            it('should update page name', () => {
                const created = addPage(ydoc, { name: 'Original' });
                const result = updatePage(ydoc, created.data!.id, { name: 'Updated' });

                expect(result.success).toBe(true);

                const page = getPage(ydoc, created.data!.id);
                expect(page?.pageName).toBe('Updated');
                expect(page?.updatedAt).toBeDefined();
            });

            it('should update page properties', () => {
                const created = addPage(ydoc, { name: 'Test' });
                updatePage(ydoc, created.data!.id, {
                    properties: { key1: 'value1', key2: 42 },
                });

                const page = getPage(ydoc, created.data!.id);
                expect(page?.properties?.key1).toBe('value1');
                expect(page?.properties?.key2).toBe(42);
            });

            it('should return error for non-existent page', () => {
                const result = updatePage(ydoc, 'non-existent', { name: 'Test' });
                expect(result.success).toBe(false);
                expect(result.error).toContain('not found');
            });
        });

        describe('deletePage', () => {
            it('should delete a page', () => {
                const created = addPage(ydoc, { name: 'Test' });
                const result = deletePage(ydoc, created.data!.id);

                expect(result.success).toBe(true);
                expect(getPage(ydoc, created.data!.id)).toBeNull();
            });

            it('should delete descendants recursively', () => {
                const parent = addPage(ydoc, { name: 'Parent' });
                const child = addPage(ydoc, { name: 'Child', parentId: parent.data!.id });
                const grandchild = addPage(ydoc, { name: 'Grandchild', parentId: child.data!.id });

                deletePage(ydoc, parent.data!.id);

                expect(getPage(ydoc, parent.data!.id)).toBeNull();
                expect(getPage(ydoc, child.data!.id)).toBeNull();
                expect(getPage(ydoc, grandchild.data!.id)).toBeNull();
            });

            it('should return error for non-existent page', () => {
                const result = deletePage(ydoc, 'non-existent');
                expect(result.success).toBe(false);
            });
        });

        describe('movePage', () => {
            it('should change page parent', () => {
                const page1 = addPage(ydoc, { name: 'Page 1' });
                const page2 = addPage(ydoc, { name: 'Page 2' });

                movePage(ydoc, page2.data!.id, page1.data!.id);

                const moved = getPage(ydoc, page2.data!.id);
                expect(moved?.parentId).toBe(page1.data!.id);
            });

            it('should move page to root', () => {
                const parent = addPage(ydoc, { name: 'Parent' });
                const child = addPage(ydoc, { name: 'Child', parentId: parent.data!.id });

                movePage(ydoc, child.data!.id, 'root');

                const moved = getPage(ydoc, child.data!.id);
                expect(moved?.parentId).toBeNull();
            });

            it('should update order when moving up', () => {
                addPage(ydoc, { name: 'Page 1' });
                const page2 = addPage(ydoc, { name: 'Page 2' });
                addPage(ydoc, { name: 'Page 3' });

                movePage(ydoc, page2.data!.id, null, 0);

                const moved = getPage(ydoc, page2.data!.id);
                expect(moved?.order).toBe(0);
            });

            it('should update order when moving down', () => {
                const page1 = addPage(ydoc, { name: 'Page 1' });
                addPage(ydoc, { name: 'Page 2' });
                addPage(ydoc, { name: 'Page 3' });

                // Move page 1 to position 2 (moving down)
                movePage(ydoc, page1.data!.id, null, 2);

                const moved = getPage(ydoc, page1.data!.id);
                expect(moved?.order).toBe(2);
            });

            it('should return error for non-existent page', () => {
                const result = movePage(ydoc, 'non-existent', null);
                expect(result.success).toBe(false);
            });
        });
    });

    // =========================================================================
    // BLOCK OPERATIONS
    // =========================================================================

    describe('Block Operations', () => {
        let pageId: string;

        beforeEach(() => {
            const page = addPage(ydoc, { name: 'Test Page' });
            pageId = page.data!.id;
        });

        describe('createBlock', () => {
            it('should create a block in a page', () => {
                const result = createBlock(ydoc, { pageId, name: 'Test Block' });

                expect(result.success).toBe(true);
                expect(result.data?.blockName).toBe('Test Block');
                expect(result.data?.id).toMatch(/^block-/);
                expect(result.data?.order).toBe(0);
            });

            it('should create block with default name', () => {
                const result = createBlock(ydoc, { pageId });
                expect(result.data?.blockName).toBe('Block');
            });

            it('should return error for non-existent page', () => {
                const result = createBlock(ydoc, { pageId: 'non-existent' });
                expect(result.success).toBe(false);
            });

            it('should initialize block properties', () => {
                createBlock(ydoc, { pageId });
                const blocks = getBlocks(ydoc, pageId);

                expect(blocks[0].properties).toBeDefined();
                expect(blocks[0].properties?.visibility).toBe('true');
            });

            it('should create blocks array if page has none', () => {
                // Manually create a page without blocks array
                const navigation = getNavigation(ydoc);
                const pageMap = new Y.Map();
                pageMap.set('id', 'manual-page');
                pageMap.set('pageName', 'Manual Page');
                navigation.push([pageMap]);

                // Create block in page that had no blocks array
                const result = createBlock(ydoc, { pageId: 'manual-page', name: 'New Block' });

                expect(result.success).toBe(true);
                expect(result.data?.blockName).toBe('New Block');
            });

            it('should insert block at specific position and shift existing', () => {
                createBlock(ydoc, { pageId, name: 'Block 1' });
                createBlock(ydoc, { pageId, name: 'Block 2' });
                createBlock(ydoc, { pageId, name: 'Block 3' });

                // Insert at position 1 (between Block 1 and Block 2)
                createBlock(ydoc, { pageId, name: 'Inserted Block', order: 1 });

                const blocks = getBlocks(ydoc, pageId);
                expect(blocks.length).toBe(4);
                expect(blocks[0].blockName).toBe('Block 1');
                expect(blocks[1].blockName).toBe('Inserted Block');
                // Block 2 and Block 3 should have shifted
            });
        });

        describe('getBlocks', () => {
            it('should return empty array when no blocks', () => {
                const blocks = getBlocks(ydoc, pageId);
                expect(blocks).toEqual([]);
            });

            it('should return blocks sorted by order', () => {
                createBlock(ydoc, { pageId, name: 'Block 1' });
                createBlock(ydoc, { pageId, name: 'Block 2' });

                const blocks = getBlocks(ydoc, pageId);

                expect(blocks.length).toBe(2);
                expect(blocks[0].blockName).toBe('Block 1');
                expect(blocks[1].blockName).toBe('Block 2');
            });
        });

        describe('getBlock', () => {
            it('should return null for non-existent block', () => {
                expect(getBlock(ydoc, 'non-existent')).toBeNull();
            });

            it('should find block by id', () => {
                const created = createBlock(ydoc, { pageId, name: 'Test' });
                const found = getBlock(ydoc, created.data!.id);

                expect(found?.blockName).toBe('Test');
            });
        });

        describe('findBlockMap', () => {
            it('should find block across all pages', () => {
                const block = createBlock(ydoc, { pageId, name: 'Test' });
                const map = findBlockMap(ydoc, block.data!.id);

                expect(map).toBeInstanceOf(Y.Map);
            });

            it('should find block by blockId key', () => {
                // Manually create a block with only blockId (not id)
                const navigation = getNavigation(ydoc);
                const pageMap = navigation.get(0);
                const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>>;

                const blockMap = new Y.Map();
                blockMap.set('blockId', 'custom-block-id');
                blockMap.set('blockName', 'Custom Block');
                blocks.push([blockMap]);

                const found = findBlockMap(ydoc, 'custom-block-id');
                expect(found).toBeInstanceOf(Y.Map);
                expect(found?.get('blockName')).toBe('Custom Block');
            });
        });

        describe('findBlockMapInPage', () => {
            it('should find block within specific page', () => {
                const block = createBlock(ydoc, { pageId, name: 'Test' });
                const map = findBlockMapInPage(ydoc, pageId, block.data!.id);

                expect(map).toBeInstanceOf(Y.Map);
            });

            it('should return null if block not in page', () => {
                const page2 = addPage(ydoc, { name: 'Page 2' });
                const block = createBlock(ydoc, { pageId, name: 'Test' });

                const map = findBlockMapInPage(ydoc, page2.data!.id, block.data!.id);
                expect(map).toBeNull();
            });
        });

        describe('updateBlock', () => {
            it('should update block name', () => {
                const created = createBlock(ydoc, { pageId, name: 'Original' });
                updateBlock(ydoc, created.data!.id, { name: 'Updated' });

                const block = getBlock(ydoc, created.data!.id);
                expect(block?.blockName).toBe('Updated');
            });

            it('should update block iconName', () => {
                const created = createBlock(ydoc, { pageId });
                updateBlock(ydoc, created.data!.id, { iconName: 'icon-test' });

                const block = getBlock(ydoc, created.data!.id);
                expect(block?.iconName).toBe('icon-test');
            });

            it('should update block properties', () => {
                const created = createBlock(ydoc, { pageId });
                updateBlock(ydoc, created.data!.id, {
                    properties: { visibility: 'false' },
                });

                const block = getBlock(ydoc, created.data!.id);
                expect(block?.properties?.visibility).toBe('false');
            });

            it('should create properties map if none exists', () => {
                // Manually create a block without properties map
                const pageMap = findPageMap(ydoc, pageId);
                const blocks = pageMap?.get('blocks') as Y.Array<Y.Map<unknown>>;

                const blockMap = new Y.Map();
                blockMap.set('id', 'block-no-props');
                blockMap.set('blockName', 'Block No Props');
                blocks.push([blockMap]);

                // Update properties should create the map
                updateBlock(ydoc, 'block-no-props', {
                    properties: { customProp: 'value' },
                });

                const block = getBlock(ydoc, 'block-no-props');
                expect(block?.properties?.customProp).toBe('value');
            });

            it('should return error for non-existent block', () => {
                const result = updateBlock(ydoc, 'non-existent', { name: 'Test' });
                expect(result.success).toBe(false);
            });
        });

        describe('deleteBlock', () => {
            it('should delete a block', () => {
                const created = createBlock(ydoc, { pageId });
                const result = deleteBlock(ydoc, created.data!.id);

                expect(result.success).toBe(true);
                expect(getBlock(ydoc, created.data!.id)).toBeNull();
            });

            it('should update remaining block orders', () => {
                const block1 = createBlock(ydoc, { pageId, name: 'Block 1' });
                createBlock(ydoc, { pageId, name: 'Block 2' });

                deleteBlock(ydoc, block1.data!.id);

                const blocks = getBlocks(ydoc, pageId);
                expect(blocks[0].order).toBe(0);
            });

            it('should return error for non-existent block', () => {
                const result = deleteBlock(ydoc, 'non-existent');
                expect(result.success).toBe(false);
            });
        });

        describe('moveBlock', () => {
            it('should move block to different page', () => {
                const page2 = addPage(ydoc, { name: 'Page 2' });
                const block = createBlock(ydoc, { pageId, name: 'Test' });

                moveBlock(ydoc, block.data!.id, page2.data!.id);

                expect(getBlocks(ydoc, pageId).length).toBe(0);
                expect(getBlocks(ydoc, page2.data!.id).length).toBe(1);
            });

            it('should preserve block data after move', () => {
                const page2 = addPage(ydoc, { name: 'Page 2' });
                const block = createBlock(ydoc, { pageId, name: 'Test Block' });

                moveBlock(ydoc, block.data!.id, page2.data!.id);

                const movedBlocks = getBlocks(ydoc, page2.data!.id);
                expect(movedBlocks[0].blockName).toBe('Test Block');
            });

            it('should move block with components and preserve them', () => {
                const page2 = addPage(ydoc, { name: 'Page 2' });
                const block = createBlock(ydoc, { pageId, name: 'Test Block' });

                // Add components to the block
                createComponent(ydoc, {
                    pageId,
                    blockId: block.data!.id,
                    ideviceType: 'text',
                    initialData: { title: 'Component 1', htmlContent: '<p>Content 1</p>' },
                });
                createComponent(ydoc, {
                    pageId,
                    blockId: block.data!.id,
                    ideviceType: 'quiz',
                    initialData: { title: 'Component 2' },
                });

                // Move block to page2
                moveBlock(ydoc, block.data!.id, page2.data!.id);

                // Components should be preserved
                const movedBlocks = getBlocks(ydoc, page2.data!.id);
                expect(movedBlocks[0].componentCount).toBe(2);
            });

            it('should move block to page without blocks array', () => {
                // Create a page without blocks array
                const navigation = getNavigation(ydoc);
                const page2Map = new Y.Map();
                page2Map.set('id', 'page-no-blocks');
                page2Map.set('pageName', 'Page No Blocks');
                navigation.push([page2Map]);

                const block = createBlock(ydoc, { pageId, name: 'Test' });

                moveBlock(ydoc, block.data!.id, 'page-no-blocks');

                const movedBlocks = getBlocks(ydoc, 'page-no-blocks');
                expect(movedBlocks.length).toBe(1);
            });

            it('should update orders when moving to existing blocks', () => {
                const page2 = addPage(ydoc, { name: 'Page 2' });
                createBlock(ydoc, { pageId: page2.data!.id, name: 'Existing 1' });
                createBlock(ydoc, { pageId: page2.data!.id, name: 'Existing 2' });

                const block = createBlock(ydoc, { pageId, name: 'Moving Block' });

                // Move to position 1 in page2
                moveBlock(ydoc, block.data!.id, page2.data!.id, 1);

                const blocks = getBlocks(ydoc, page2.data!.id);
                expect(blocks.length).toBe(3);
                expect(blocks[1].blockName).toBe('Moving Block');
            });

            it('should return error for non-existent block', () => {
                const result = moveBlock(ydoc, 'non-existent', pageId);
                expect(result.success).toBe(false);
            });

            it('should return error for non-existent target page', () => {
                const block = createBlock(ydoc, { pageId });
                const result = moveBlock(ydoc, block.data!.id, 'non-existent');
                expect(result.success).toBe(false);
            });
        });
    });

    // =========================================================================
    // COMPONENT OPERATIONS
    // =========================================================================

    describe('Component Operations', () => {
        let pageId: string;
        let blockId: string;

        beforeEach(() => {
            const page = addPage(ydoc, { name: 'Test Page' });
            pageId = page.data!.id;
            const block = createBlock(ydoc, { pageId });
            blockId = block.data!.id;
        });

        describe('createComponent', () => {
            it('should create a component', () => {
                const result = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                });

                expect(result.success).toBe(true);
                expect(result.data?.ideviceType).toBe('text');
                expect(result.data?.id).toMatch(/^idevice-/);
            });

            it('should accept initial data', () => {
                const result = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                    initialData: {
                        title: 'My Title',
                        htmlContent: '<p>Hello</p>',
                    },
                });

                const comp = getComponent(ydoc, result.data!.id);
                expect(comp?.title).toBe('My Title');
            });

            it('should accept object initial data and convert to Y.Map', () => {
                const result = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                    initialData: {
                        properties: { key1: 'value1', key2: 'value2' },
                    },
                });

                const comp = getComponent(ydoc, result.data!.id);
                expect(comp?.properties?.key1).toBe('value1');
                expect(comp?.properties?.key2).toBe('value2');
            });

            it('should create components array if block has none', () => {
                // Manually create a block without components array
                const pageMap = findPageMap(ydoc, pageId);
                const blocks = pageMap?.get('blocks') as Y.Array<Y.Map<unknown>>;

                const blockMap = new Y.Map();
                blockMap.set('id', 'block-no-comps');
                blockMap.set('blockName', 'Block No Components');
                blocks.push([blockMap]);

                // Create component in block that had no components array
                const result = createComponent(ydoc, {
                    pageId,
                    blockId: 'block-no-comps',
                    ideviceType: 'text',
                });

                expect(result.success).toBe(true);
                expect(getComponents(ydoc, 'block-no-comps').length).toBe(1);
            });

            it('should insert component at specific position and shift existing', () => {
                createComponent(ydoc, { pageId, blockId, ideviceType: 'text' });
                createComponent(ydoc, { pageId, blockId, ideviceType: 'quiz' });
                createComponent(ydoc, { pageId, blockId, ideviceType: 'image' });

                // Insert at position 1
                createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'video',
                    order: 1,
                });

                const components = getComponents(ydoc, blockId);
                expect(components.length).toBe(4);
                expect(components[1].ideviceType).toBe('video');
            });

            it('should return error for non-existent block', () => {
                const result = createComponent(ydoc, {
                    pageId,
                    blockId: 'non-existent',
                    ideviceType: 'text',
                });
                expect(result.success).toBe(false);
            });
        });

        describe('getComponents', () => {
            it('should return empty array when no components', () => {
                const components = getComponents(ydoc, blockId);
                expect(components).toEqual([]);
            });

            it('should return components sorted by order', () => {
                createComponent(ydoc, { pageId, blockId, ideviceType: 'text' });
                createComponent(ydoc, { pageId, blockId, ideviceType: 'quiz' });

                const components = getComponents(ydoc, blockId);

                expect(components.length).toBe(2);
                expect(components[0].order).toBe(0);
                expect(components[1].order).toBe(1);
            });
        });

        describe('getComponent', () => {
            it('should return null for non-existent component', () => {
                expect(getComponent(ydoc, 'non-existent')).toBeNull();
            });

            it('should find component by id', () => {
                const created = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                });
                const found = getComponent(ydoc, created.data!.id);

                expect(found?.ideviceType).toBe('text');
            });
        });

        describe('findComponentMap', () => {
            it('should find component across all pages and blocks', () => {
                const comp = createComponent(ydoc, { pageId, blockId, ideviceType: 'text' });
                const map = findComponentMap(ydoc, comp.data!.id);

                expect(map).toBeInstanceOf(Y.Map);
            });

            it('should find component by ideviceId key', () => {
                // Manually create a component with only ideviceId (not id)
                const blockMap = findBlockMap(ydoc, blockId);
                const components = blockMap?.get('components') as Y.Array<Y.Map<unknown>>;

                const compMap = new Y.Map();
                compMap.set('ideviceId', 'custom-idevice-id');
                compMap.set('ideviceType', 'text');
                components.push([compMap]);

                const found = findComponentMap(ydoc, 'custom-idevice-id');
                expect(found).toBeInstanceOf(Y.Map);
                expect(found?.get('ideviceType')).toBe('text');
            });
        });

        describe('updateComponent', () => {
            it('should update component properties', () => {
                const created = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                });

                updateComponent(ydoc, created.data!.id, {
                    title: 'Updated Title',
                });

                const comp = getComponent(ydoc, created.data!.id);
                expect(comp?.title).toBe('Updated Title');
            });

            it('should update htmlContent as Y.Text', () => {
                const created = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                });

                updateComponent(ydoc, created.data!.id, {
                    htmlContent: '<p>New content</p>',
                });

                const comp = getComponent(ydoc, created.data!.id);
                expect(comp?.htmlContent).toBe('<p>New content</p>');
            });

            it('should replace existing Y.Text content', () => {
                // Create component with initial htmlContent
                const created = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                    initialData: {
                        htmlContent: '<p>Initial</p>',
                    },
                });

                // Update the htmlContent (should replace existing Y.Text)
                updateComponent(ydoc, created.data!.id, {
                    htmlContent: '<p>Replaced</p>',
                });

                const comp = getComponent(ydoc, created.data!.id);
                expect(comp?.htmlContent).toBe('<p>Replaced</p>');
            });

            it('should update properties map', () => {
                const created = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                });

                updateComponent(ydoc, created.data!.id, {
                    properties: { customKey: 'customValue', anotherKey: 123 },
                });

                const comp = getComponent(ydoc, created.data!.id);
                expect(comp?.properties?.customKey).toBe('customValue');
                expect(comp?.properties?.anotherKey).toBe(123);
            });

            it('should create properties map if none exists', () => {
                // Manually create a component without properties
                const blockMap = findBlockMap(ydoc, blockId);
                const components = blockMap?.get('components') as Y.Array<Y.Map<unknown>>;

                const compMap = new Y.Map();
                compMap.set('id', 'comp-no-props');
                compMap.set('ideviceType', 'text');
                components.push([compMap]);

                // Update properties should create the map
                updateComponent(ydoc, 'comp-no-props', {
                    properties: { newProp: 'newValue' },
                });

                const comp = getComponent(ydoc, 'comp-no-props');
                expect(comp?.properties?.newProp).toBe('newValue');
            });

            it('should return error for non-existent component', () => {
                const result = updateComponent(ydoc, 'non-existent', { title: 'Test' });
                expect(result.success).toBe(false);
            });
        });

        describe('setComponentHtml', () => {
            it('should set HTML content', () => {
                const created = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                });

                setComponentHtml(ydoc, created.data!.id, '<h1>Hello</h1>');

                const comp = getComponent(ydoc, created.data!.id);
                expect(comp?.htmlContent).toBe('<h1>Hello</h1>');
            });
        });

        describe('deleteComponent', () => {
            it('should delete a component', () => {
                const created = createComponent(ydoc, {
                    pageId,
                    blockId,
                    ideviceType: 'text',
                });

                const result = deleteComponent(ydoc, created.data!.id);

                expect(result.success).toBe(true);
                expect(getComponent(ydoc, created.data!.id)).toBeNull();
            });

            it('should update remaining component orders', () => {
                const comp1 = createComponent(ydoc, { pageId, blockId, ideviceType: 'text' });
                createComponent(ydoc, { pageId, blockId, ideviceType: 'quiz' });

                deleteComponent(ydoc, comp1.data!.id);

                const components = getComponents(ydoc, blockId);
                expect(components[0].order).toBe(0);
            });

            it('should return error for non-existent component', () => {
                const result = deleteComponent(ydoc, 'non-existent');
                expect(result.success).toBe(false);
            });
        });
    });

    // =========================================================================
    // METADATA OPERATIONS
    // =========================================================================

    describe('Metadata Operations', () => {
        describe('getMetadataData', () => {
            it('should return empty object when no metadata', () => {
                const meta = getMetadataData(ydoc);
                expect(meta).toEqual({});
            });

            it('should return all metadata', () => {
                const metadata = getMetadata(ydoc);
                metadata.set('title', 'Test Project');
                metadata.set('author', 'Test Author');

                const data = getMetadataData(ydoc);

                expect(data.title).toBe('Test Project');
                expect(data.author).toBe('Test Author');
            });
        });

        describe('updateMetadataData', () => {
            it('should update metadata', () => {
                updateMetadataData(ydoc, {
                    title: 'New Title',
                    author: 'New Author',
                });

                const data = getMetadataData(ydoc);
                expect(data.title).toBe('New Title');
                expect(data.author).toBe('New Author');
            });

            it('should preserve existing metadata', () => {
                updateMetadataData(ydoc, { title: 'Title' });
                updateMetadataData(ydoc, { author: 'Author' });

                const data = getMetadataData(ydoc);
                expect(data.title).toBe('Title');
                expect(data.author).toBe('Author');
            });

            it('should ignore undefined values', () => {
                updateMetadataData(ydoc, { title: 'Title' });
                updateMetadataData(ydoc, { title: undefined, author: 'Author' });

                const data = getMetadataData(ydoc);
                expect(data.title).toBe('Title');
            });
        });
    });
});

/**
 * Server-Side Yjs Structure Binding
 *
 * Port of the client-side YjsStructureBinding.js to TypeScript.
 * Provides CRUD operations for the Yjs document structure:
 * - Pages (navigation)
 * - Blocks (containers within pages)
 * - Components (iDevices within blocks)
 * - Metadata
 *
 * All operations work directly on Y.Doc instances and are meant to be
 * called within a transaction (via doc-manager.withDocument).
 */
import * as Y from 'yjs';
import type {
    PageData,
    CreatePageInput,
    UpdatePageInput,
    BlockData,
    CreateBlockInput,
    UpdateBlockInput,
    ComponentData,
    CreateComponentInput,
    UpdateComponentInput,
    MetadataData,
    UpdateMetadataInput,
    OperationResult,
} from './types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID with prefix
 * Same algorithm as client-side for consistency
 */
export function generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Get the navigation array from a Y.Doc
 */
export function getNavigation(ydoc: Y.Doc): Y.Array<Y.Map<unknown>> {
    return ydoc.getArray('navigation');
}

/**
 * Get the metadata map from a Y.Doc
 */
export function getMetadata(ydoc: Y.Doc): Y.Map<unknown> {
    return ydoc.getMap('metadata');
}

/**
 * Get the assets map from a Y.Doc
 */
export function getAssets(ydoc: Y.Doc): Y.Map<unknown> {
    return ydoc.getMap('assets');
}

/**
 * Asset metadata stored in Y.Doc
 */
export interface AssetMetadata {
    filename: string;
    folderPath: string;
    mime: string;
    size: number;
    hash?: string;
    uploaded: boolean;
    createdAt: string;
}

/**
 * Get asset metadata from Y.Doc
 */
export function getAssetMetadata(ydoc: Y.Doc, assetId: string): AssetMetadata | null {
    const assetsMap = getAssets(ydoc);
    const meta = assetsMap.get(assetId) as AssetMetadata | undefined;
    return meta || null;
}

/**
 * Set asset metadata in Y.Doc
 */
export function setAssetMetadata(
    ydoc: Y.Doc,
    assetId: string,
    metadata: AssetMetadata,
): OperationResult<AssetMetadata> {
    const assetsMap = getAssets(ydoc);
    assetsMap.set(assetId, metadata);
    return { success: true, data: metadata };
}

/**
 * Delete asset metadata from Y.Doc
 */
export function deleteAssetMetadata(ydoc: Y.Doc, assetId: string): OperationResult<{ deleted: boolean }> {
    const assetsMap = getAssets(ydoc);
    const existed = assetsMap.has(assetId);
    if (existed) {
        assetsMap.delete(assetId);
    }
    return { success: true, data: { deleted: existed } };
}

/**
 * Get all assets metadata from Y.Doc
 */
export function getAllAssetsMetadata(ydoc: Y.Doc): Array<AssetMetadata & { id: string }> {
    const assetsMap = getAssets(ydoc);
    const result: Array<AssetMetadata & { id: string }> = [];
    assetsMap.forEach((meta, id) => {
        result.push({ ...(meta as AssetMetadata), id: id as string });
    });
    return result;
}

/**
 * Find a page Y.Map by ID
 */
export function findPageMap(ydoc: Y.Doc, pageId: string): Y.Map<unknown> | null {
    const navigation = getNavigation(ydoc);
    for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        if (pageMap.get('id') === pageId || pageMap.get('pageId') === pageId) {
            return pageMap;
        }
    }
    return null;
}

/**
 * Find a block Y.Map by ID (searches all pages)
 */
export function findBlockMap(ydoc: Y.Doc, blockId: string): Y.Map<unknown> | null {
    const navigation = getNavigation(ydoc);

    for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
            const blockMap = blocks.get(j);
            if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
                return blockMap;
            }
        }
    }
    return null;
}

/**
 * Find a block Y.Map within a specific page
 */
export function findBlockMapInPage(ydoc: Y.Doc, pageId: string, blockId: string): Y.Map<unknown> | null {
    const pageMap = findPageMap(ydoc, pageId);
    if (!pageMap) return null;

    const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
    if (!blocks) return null;

    for (let i = 0; i < blocks.length; i++) {
        const blockMap = blocks.get(i);
        if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
            return blockMap;
        }
    }
    return null;
}

/**
 * Find a component Y.Map by ID (searches all pages and blocks)
 */
export function findComponentMap(ydoc: Y.Doc, componentId: string): Y.Map<unknown> | null {
    const navigation = getNavigation(ydoc);

    for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
            const blockMap = blocks.get(j);
            const components = blockMap.get('components') as Y.Array<Y.Map<unknown>> | undefined;
            if (!components) continue;

            for (let k = 0; k < components.length; k++) {
                const compMap = components.get(k);
                if (compMap.get('id') === componentId || compMap.get('ideviceId') === componentId) {
                    return compMap;
                }
            }
        }
    }
    return null;
}

/**
 * Collect all descendant page IDs recursively
 */
function collectDescendantIds(navigation: Y.Array<Y.Map<unknown>>, parentId: string): string[] {
    const descendants: string[] = [];

    for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        if (pageMap.get('parentId') === parentId) {
            const childId = pageMap.get('id') as string;
            descendants.push(childId);
            descendants.push(...collectDescendantIds(navigation, childId));
        }
    }

    return descendants;
}

/**
 * Convert a Y.Map to PageData object
 */
function mapToPageData(pageMap: Y.Map<unknown>): PageData {
    const blocks = pageMap.get('blocks') as Y.Array<unknown> | undefined;
    const propsMap = pageMap.get('properties') as Y.Map<unknown> | undefined;

    return {
        id: pageMap.get('id') as string,
        pageId: (pageMap.get('pageId') as string) || (pageMap.get('id') as string),
        pageName: (pageMap.get('pageName') as string) || '',
        parentId: pageMap.get('parentId') as string | null,
        order: (pageMap.get('order') as number) ?? 0,
        blockCount: blocks?.length ?? 0,
        createdAt: (pageMap.get('createdAt') as string) || new Date().toISOString(),
        updatedAt: pageMap.get('updatedAt') as string | undefined,
        properties: propsMap ? (propsMap.toJSON() as Record<string, unknown>) : undefined,
    };
}

/**
 * Convert a Y.Map to BlockData object
 */
function mapToBlockData(blockMap: Y.Map<unknown>): BlockData {
    const components = blockMap.get('components') as Y.Array<unknown> | undefined;
    const propsMap = blockMap.get('properties') as Y.Map<unknown> | undefined;

    return {
        id: blockMap.get('id') as string,
        blockId: (blockMap.get('blockId') as string) || (blockMap.get('id') as string),
        blockName: (blockMap.get('blockName') as string) || 'Block',
        iconName: (blockMap.get('iconName') as string) || '',
        blockType: (blockMap.get('blockType') as string) || 'default',
        order: (blockMap.get('order') as number) ?? 0,
        componentCount: components?.length ?? 0,
        createdAt: (blockMap.get('createdAt') as string) || new Date().toISOString(),
        updatedAt: blockMap.get('updatedAt') as string | undefined,
        properties: propsMap ? (propsMap.toJSON() as Record<string, unknown>) : undefined,
    };
}

/**
 * Convert a Y.Map to ComponentData object
 */
function mapToComponentData(compMap: Y.Map<unknown>): ComponentData {
    const propsMap = compMap.get('properties') as Y.Map<unknown> | undefined;
    const htmlContent = compMap.get('htmlContent');

    return {
        id: compMap.get('id') as string,
        ideviceId: (compMap.get('ideviceId') as string) || (compMap.get('id') as string),
        ideviceType: (compMap.get('ideviceType') as string) || '',
        order: (compMap.get('order') as number) ?? 0,
        createdAt: (compMap.get('createdAt') as string) || new Date().toISOString(),
        updatedAt: compMap.get('updatedAt') as string | undefined,
        htmlContent: htmlContent instanceof Y.Text ? htmlContent.toString() : (htmlContent as string | undefined),
        htmlView: compMap.get('htmlView') as string | undefined,
        properties: propsMap ? (propsMap.toJSON() as Record<string, unknown>) : undefined,
        jsonProperties: compMap.get('jsonProperties') as string | Record<string, unknown> | undefined,
        title: compMap.get('title') as string | undefined,
        subtitle: compMap.get('subtitle') as string | undefined,
        instructions: compMap.get('instructions') as string | undefined,
        feedback: compMap.get('feedback') as string | undefined,
        lockedBy: compMap.get('lockedBy') as string | undefined,
        lockUserName: compMap.get('lockUserName') as string | undefined,
        lockUserColor: compMap.get('lockUserColor') as string | undefined,
    };
}

// ============================================================================
// PAGE OPERATIONS
// ============================================================================

/**
 * Get all pages
 */
export function getPages(ydoc: Y.Doc): PageData[] {
    const navigation = getNavigation(ydoc);
    const pages: PageData[] = [];

    for (let i = 0; i < navigation.length; i++) {
        pages.push(mapToPageData(navigation.get(i)));
    }

    return pages.sort((a, b) => a.order - b.order);
}

/**
 * Get a page by ID
 */
export function getPage(ydoc: Y.Doc, pageId: string): PageData | null {
    const pageMap = findPageMap(ydoc, pageId);
    return pageMap ? mapToPageData(pageMap) : null;
}

/**
 * Create a new page
 */
export function addPage(ydoc: Y.Doc, input: CreatePageInput): OperationResult<PageData> {
    const navigation = getNavigation(ydoc);
    const pageId = generateId('page');
    const order = input.order ?? navigation.length;
    const createdAt = new Date().toISOString();

    const pageMap = new Y.Map();
    pageMap.set('id', pageId);
    pageMap.set('pageId', pageId);
    pageMap.set('pageName', input.name);
    pageMap.set('parentId', input.parentId ?? null);
    pageMap.set('order', order);
    pageMap.set('blocks', new Y.Array());
    pageMap.set('createdAt', createdAt);

    navigation.push([pageMap]);

    return {
        success: true,
        data: {
            id: pageId,
            pageId,
            pageName: input.name,
            parentId: input.parentId ?? null,
            order,
            blockCount: 0,
            createdAt,
        },
    };
}

/**
 * Update a page
 */
export function updatePage(ydoc: Y.Doc, pageId: string, updates: UpdatePageInput): OperationResult {
    const pageMap = findPageMap(ydoc, pageId);
    if (!pageMap) {
        return { success: false, error: `Page ${pageId} not found` };
    }

    if (updates.name !== undefined) {
        pageMap.set('pageName', updates.name);
    }

    if (updates.properties !== undefined) {
        let propsMap = pageMap.get('properties') as Y.Map<unknown> | undefined;
        if (!propsMap || !(propsMap instanceof Y.Map)) {
            propsMap = new Y.Map();
            pageMap.set('properties', propsMap);
        }
        for (const [key, value] of Object.entries(updates.properties)) {
            propsMap.set(key, value);
        }
    }

    pageMap.set('updatedAt', new Date().toISOString());

    return { success: true };
}

/**
 * Delete a page and all its descendants
 */
export function deletePage(ydoc: Y.Doc, pageId: string): OperationResult {
    const navigation = getNavigation(ydoc);

    // Collect all page IDs to delete (this page and all descendants)
    const pageIdsToDelete = collectDescendantIds(navigation, pageId);
    pageIdsToDelete.push(pageId);

    let deleted = false;

    // Delete in reverse order (children first)
    for (const idToDelete of pageIdsToDelete) {
        for (let i = navigation.length - 1; i >= 0; i--) {
            const pageMap = navigation.get(i);
            if (pageMap.get('id') === idToDelete) {
                navigation.delete(i, 1);
                if (idToDelete === pageId) {
                    deleted = true;
                }
                break;
            }
        }
    }

    if (!deleted) {
        return { success: false, error: `Page ${pageId} not found` };
    }

    return { success: true };
}

/**
 * Move a page to a new parent or position
 */
export function movePage(ydoc: Y.Doc, pageId: string, newParentId: string | null, newIndex?: number): OperationResult {
    const navigation = getNavigation(ydoc);
    const pageMap = findPageMap(ydoc, pageId);

    if (!pageMap) {
        return { success: false, error: `Page ${pageId} not found` };
    }

    // Normalize parent ID
    const normalizedParentId = newParentId === 'root' ? null : newParentId;

    // Update parent
    pageMap.set('parentId', normalizedParentId);

    // Update order if specified
    if (newIndex !== undefined && newIndex >= 0) {
        const currentOrder = (pageMap.get('order') as number) ?? 0;

        if (newIndex !== currentOrder) {
            // Update order fields for affected pages within the same parent group
            for (let i = 0; i < navigation.length; i++) {
                const page = navigation.get(i);
                const pageParentId = page.get('parentId') as string | null;

                // Skip pages that are not siblings (different parent)
                if (pageParentId !== normalizedParentId) {
                    continue;
                }

                const pageOrder = (page.get('order') as number) ?? i;

                if (page === pageMap) {
                    page.set('order', newIndex);
                } else if (newIndex < currentOrder) {
                    // Moving up: increment orders of pages between newIndex and currentOrder
                    if (pageOrder >= newIndex && pageOrder < currentOrder) {
                        page.set('order', pageOrder + 1);
                    }
                } else {
                    // Moving down: decrement orders of pages between currentOrder and newIndex
                    if (pageOrder > currentOrder && pageOrder <= newIndex) {
                        page.set('order', pageOrder - 1);
                    }
                }
            }
        }
    }

    return { success: true };
}

// ============================================================================
// BLOCK OPERATIONS
// ============================================================================

/**
 * Get all blocks for a page
 */
export function getBlocks(ydoc: Y.Doc, pageId: string): BlockData[] {
    const pageMap = findPageMap(ydoc, pageId);
    if (!pageMap) return [];

    const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
    if (!blocks) return [];

    const result: BlockData[] = [];
    for (let i = 0; i < blocks.length; i++) {
        result.push(mapToBlockData(blocks.get(i)));
    }

    return result.sort((a, b) => a.order - b.order);
}

/**
 * Get a block by ID
 */
export function getBlock(ydoc: Y.Doc, blockId: string): BlockData | null {
    const blockMap = findBlockMap(ydoc, blockId);
    return blockMap ? mapToBlockData(blockMap) : null;
}

/**
 * Create a new block in a page
 */
export function createBlock(ydoc: Y.Doc, input: CreateBlockInput): OperationResult<BlockData> {
    const pageMap = findPageMap(ydoc, input.pageId);
    if (!pageMap) {
        return { success: false, error: `Page ${input.pageId} not found` };
    }

    let blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
    if (!blocks) {
        blocks = new Y.Array();
        pageMap.set('blocks', blocks);
    }

    const blockId = generateId('block');
    const targetOrder = input.order ?? blocks.length;
    const createdAt = new Date().toISOString();

    const blockMap = new Y.Map();
    blockMap.set('id', blockId);
    blockMap.set('blockId', blockId);
    blockMap.set('blockName', input.name ?? 'Block');
    blockMap.set('iconName', '');
    blockMap.set('blockType', 'default');
    blockMap.set('order', targetOrder);
    blockMap.set('components', new Y.Array());
    blockMap.set('createdAt', createdAt);

    // Initialize properties with defaults
    const propsMap = new Y.Map();
    propsMap.set('visibility', 'true');
    propsMap.set('teacherOnly', 'false');
    propsMap.set('allowToggle', 'true');
    propsMap.set('minimized', 'false');
    propsMap.set('identifier', '');
    propsMap.set('cssClass', '');
    blockMap.set('properties', propsMap);

    // Insert at correct position and shift existing blocks' order
    const insertIndex = Math.min(Math.max(0, targetOrder), blocks.length);

    for (let i = insertIndex; i < blocks.length; i++) {
        const existingBlock = blocks.get(i);
        const currentOrder = (existingBlock.get('order') as number) ?? i;
        existingBlock.set('order', currentOrder + 1);
    }

    blocks.insert(insertIndex, [blockMap]);

    return {
        success: true,
        data: {
            id: blockId,
            blockId,
            blockName: input.name ?? 'Block',
            iconName: '',
            blockType: 'default',
            order: targetOrder,
            componentCount: 0,
            createdAt,
        },
    };
}

/**
 * Update a block
 */
export function updateBlock(ydoc: Y.Doc, blockId: string, updates: UpdateBlockInput): OperationResult {
    const blockMap = findBlockMap(ydoc, blockId);
    if (!blockMap) {
        return { success: false, error: `Block ${blockId} not found` };
    }

    if (updates.name !== undefined) {
        blockMap.set('blockName', updates.name);
    }

    if (updates.iconName !== undefined) {
        blockMap.set('iconName', updates.iconName);
    }

    if (updates.properties !== undefined) {
        let propsMap = blockMap.get('properties') as Y.Map<unknown> | undefined;
        if (!propsMap || !(propsMap instanceof Y.Map)) {
            propsMap = new Y.Map();
            blockMap.set('properties', propsMap);
        }
        for (const [key, value] of Object.entries(updates.properties)) {
            propsMap.set(key, value);
        }
    }

    blockMap.set('updatedAt', new Date().toISOString());

    return { success: true };
}

/**
 * Delete a block
 */
export function deleteBlock(ydoc: Y.Doc, blockId: string): OperationResult {
    const navigation = getNavigation(ydoc);

    for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
            const blockMap = blocks.get(j);
            if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
                blocks.delete(j, 1);

                // Update order of remaining blocks
                for (let k = 0; k < blocks.length; k++) {
                    blocks.get(k).set('order', k);
                }

                return { success: true };
            }
        }
    }

    return { success: false, error: `Block ${blockId} not found` };
}

/**
 * Move a block to a different page
 */
export function moveBlock(ydoc: Y.Doc, blockId: string, targetPageId: string, newIndex?: number): OperationResult {
    const navigation = getNavigation(ydoc);
    let sourceBlocks: Y.Array<Y.Map<unknown>> | null = null;
    let sourceIndex = -1;
    let blockMap: Y.Map<unknown> | null = null;

    // Find the block
    for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
            const bm = blocks.get(j);
            if (bm.get('id') === blockId || bm.get('blockId') === blockId) {
                sourceBlocks = blocks;
                sourceIndex = j;
                blockMap = bm;
                break;
            }
        }
        if (blockMap) break;
    }

    if (!blockMap || !sourceBlocks || sourceIndex < 0) {
        return { success: false, error: `Block ${blockId} not found` };
    }

    // Find target page
    const targetPageMap = findPageMap(ydoc, targetPageId);
    if (!targetPageMap) {
        return { success: false, error: `Target page ${targetPageId} not found` };
    }

    let targetBlocks = targetPageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
    if (!targetBlocks) {
        targetBlocks = new Y.Array();
        targetPageMap.set('blocks', targetBlocks);
    }

    // Clone the block for the move (Y.Maps become invalid after deletion)
    const clonedBlock = cloneBlockMap(blockMap);

    // Remove from source
    sourceBlocks.delete(sourceIndex, 1);

    // Update source block orders
    for (let i = 0; i < sourceBlocks.length; i++) {
        sourceBlocks.get(i).set('order', i);
    }

    // Insert into target
    const insertIndex = Math.min(Math.max(0, newIndex ?? targetBlocks.length), targetBlocks.length);
    clonedBlock.set('order', insertIndex);

    // Shift existing blocks in target
    for (let i = insertIndex; i < targetBlocks.length; i++) {
        const existingBlock = targetBlocks.get(i);
        const currentOrder = (existingBlock.get('order') as number) ?? i;
        existingBlock.set('order', currentOrder + 1);
    }

    targetBlocks.insert(insertIndex, [clonedBlock]);

    return { success: true };
}

/**
 * Clone a block Y.Map (preserves IDs for move operations)
 */
function cloneBlockMap(sourceBlock: Y.Map<unknown>): Y.Map<unknown> {
    const newBlock = new Y.Map();

    // Copy all properties
    sourceBlock.forEach((value, key) => {
        if (key === 'components') {
            // Clone components separately
        } else if (key === 'properties' && value instanceof Y.Map) {
            const newProps = new Y.Map();
            value.forEach((v, k) => newProps.set(k, v));
            newBlock.set(key, newProps);
        } else if (value !== null && value !== undefined) {
            newBlock.set(key, value);
        }
    });

    // Clone components
    const sourceComponents = sourceBlock.get('components') as Y.Array<Y.Map<unknown>> | undefined;
    const newComponents = new Y.Array();

    if (sourceComponents && sourceComponents.length > 0) {
        for (let i = 0; i < sourceComponents.length; i++) {
            const clonedComp = cloneComponentMap(sourceComponents.get(i));
            newComponents.push([clonedComp]);
        }
    }

    newBlock.set('components', newComponents);
    return newBlock;
}

// ============================================================================
// COMPONENT OPERATIONS
// ============================================================================

/**
 * Get all components for a block
 */
export function getComponents(ydoc: Y.Doc, blockId: string): ComponentData[] {
    const blockMap = findBlockMap(ydoc, blockId);
    if (!blockMap) return [];

    const components = blockMap.get('components') as Y.Array<Y.Map<unknown>> | undefined;
    if (!components) return [];

    const result: ComponentData[] = [];
    for (let i = 0; i < components.length; i++) {
        result.push(mapToComponentData(components.get(i)));
    }

    return result.sort((a, b) => a.order - b.order);
}

/**
 * Get a component by ID
 */
export function getComponent(ydoc: Y.Doc, componentId: string): ComponentData | null {
    const compMap = findComponentMap(ydoc, componentId);
    return compMap ? mapToComponentData(compMap) : null;
}

/**
 * Create a new component in a block
 */
export function createComponent(ydoc: Y.Doc, input: CreateComponentInput): OperationResult<ComponentData> {
    const blockMap = findBlockMapInPage(ydoc, input.pageId, input.blockId);
    if (!blockMap) {
        return { success: false, error: `Block ${input.blockId} not found in page ${input.pageId}` };
    }

    let components = blockMap.get('components') as Y.Array<Y.Map<unknown>> | undefined;
    if (!components) {
        components = new Y.Array();
        blockMap.set('components', components);
    }

    const componentId = (input.initialData?.id as string) || generateId('idevice');
    const targetOrder = input.order ?? components.length;
    const createdAt = new Date().toISOString();

    const compMap = new Y.Map();
    compMap.set('id', componentId);
    compMap.set('ideviceId', componentId);
    compMap.set('ideviceType', input.ideviceType);
    compMap.set('order', targetOrder);
    compMap.set('createdAt', createdAt);

    // Set initial data
    if (input.initialData) {
        for (const [key, value] of Object.entries(input.initialData)) {
            if (key === 'id' || key === 'order') continue; // Already handled

            if (key === 'htmlContent' || key === 'content') {
                const ytext = new Y.Text();
                const safeValue = typeof value === 'string' ? value : '';
                ytext.insert(0, safeValue);
                compMap.set(key, ytext);
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const ymap = new Y.Map();
                for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                    ymap.set(k, v);
                }
                compMap.set(key, ymap);
            } else {
                compMap.set(key, value);
            }
        }
    }

    // Insert at correct position
    const insertIndex = Math.min(Math.max(0, targetOrder), components.length);

    // Shift existing components' order
    for (let i = insertIndex; i < components.length; i++) {
        const existingComp = components.get(i);
        const currentOrder = (existingComp.get('order') as number) ?? i;
        existingComp.set('order', currentOrder + 1);
    }

    components.insert(insertIndex, [compMap]);

    return {
        success: true,
        data: {
            id: componentId,
            ideviceId: componentId,
            ideviceType: input.ideviceType,
            order: targetOrder,
            createdAt,
        },
    };
}

/**
 * Update a component
 */
export function updateComponent(ydoc: Y.Doc, componentId: string, updates: UpdateComponentInput): OperationResult {
    const compMap = findComponentMap(ydoc, componentId);
    if (!compMap) {
        return { success: false, error: `Component ${componentId} not found` };
    }

    for (const [key, value] of Object.entries(updates)) {
        if (key === 'htmlContent' || key === 'content') {
            let ytext = compMap.get(key) as Y.Text | undefined;
            const safeValue = typeof value === 'string' ? value : '';

            if (!(ytext instanceof Y.Text)) {
                ytext = new Y.Text();
                ytext.insert(0, safeValue);
                compMap.set(key, ytext);
            } else {
                ytext.delete(0, ytext.length);
                ytext.insert(0, safeValue);
            }
        } else if (key === 'properties' && typeof value === 'object' && value !== null) {
            let propsMap = compMap.get('properties') as Y.Map<unknown> | undefined;
            if (!propsMap || !(propsMap instanceof Y.Map)) {
                propsMap = new Y.Map();
                compMap.set('properties', propsMap);
            }
            for (const [propKey, propValue] of Object.entries(value as Record<string, unknown>)) {
                propsMap.set(propKey, propValue);
            }
        } else {
            compMap.set(key, value);
        }
    }

    compMap.set('updatedAt', new Date().toISOString());

    return { success: true };
}

/**
 * Set component HTML content
 */
export function setComponentHtml(ydoc: Y.Doc, componentId: string, html: string): OperationResult {
    return updateComponent(ydoc, componentId, { htmlContent: html });
}

/**
 * Delete a component
 */
export function deleteComponent(ydoc: Y.Doc, componentId: string): OperationResult {
    const navigation = getNavigation(ydoc);

    for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks') as Y.Array<Y.Map<unknown>> | undefined;
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
            const blockMap = blocks.get(j);
            const components = blockMap.get('components') as Y.Array<Y.Map<unknown>> | undefined;
            if (!components) continue;

            for (let k = 0; k < components.length; k++) {
                const compMap = components.get(k);
                if (compMap.get('id') === componentId || compMap.get('ideviceId') === componentId) {
                    components.delete(k, 1);

                    // Update order of remaining components
                    for (let m = 0; m < components.length; m++) {
                        components.get(m).set('order', m);
                    }

                    return { success: true };
                }
            }
        }
    }

    return { success: false, error: `Component ${componentId} not found` };
}

/**
 * Clone a component Y.Map (preserves IDs for move operations)
 */
function cloneComponentMap(sourceComp: Y.Map<unknown>): Y.Map<unknown> {
    const newComp = new Y.Map();

    // Copy all properties
    sourceComp.forEach((value, key) => {
        if (key === 'htmlContent' && value instanceof Y.Text) {
            const newHtml = new Y.Text();
            newHtml.insert(0, value.toString());
            newComp.set(key, newHtml);
        } else if (key === 'properties' && value instanceof Y.Map) {
            const newProps = new Y.Map();
            value.forEach((v, k) => newProps.set(k, v));
            newComp.set(key, newProps);
        } else if (key === 'jsonProperties' && value instanceof Y.Map) {
            const newJsonProps = new Y.Map();
            value.forEach((v, k) => newJsonProps.set(k, v));
            newComp.set(key, newJsonProps);
        } else if (value !== null && value !== undefined) {
            newComp.set(key, value);
        }
    });

    return newComp;
}

// ============================================================================
// METADATA OPERATIONS
// ============================================================================

/**
 * Get project metadata
 */
export function getMetadataData(ydoc: Y.Doc): MetadataData {
    const metadata = getMetadata(ydoc);
    return metadata.toJSON() as MetadataData;
}

/**
 * Update project metadata
 */
export function updateMetadataData(ydoc: Y.Doc, updates: UpdateMetadataInput): OperationResult {
    const metadata = getMetadata(ydoc);

    for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
            metadata.set(key, value);
        }
    }

    return { success: true };
}

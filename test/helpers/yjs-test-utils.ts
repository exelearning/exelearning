/**
 * Yjs Test Utilities
 * Helper functions for testing Yjs document operations
 */

import * as Y from 'yjs';
import { OdeXmlMeta, NormalizedPage, ParsedOdeStructure } from '../../src/services/xml/interfaces';

// ============================================================================
// Type Definitions for Yjs Extracted Data
// ============================================================================

export interface YjsPageData {
    id: string;
    pageId: string;
    title: string;
    pageName: string;
    parentId: string | null;
    order: number;
    level?: number;
    blocks: YjsBlockData[];
    children: YjsPageData[];
}

export interface YjsBlockData {
    id: string;
    blockId: string;
    pageId: string;
    type: string;
    blockName: string;
    order: number;
    title?: string;
    content: string;
    properties: Record<string, any>;
    data?: any;
    ideviceId?: string;
    iconName?: string;
}

export interface YjsMetadataData {
    title: string;
    author: string;
    description: string;
    language: string;
    license: string;
    keywords: string;
    theme: string;
    version: string;
    exelearningVersion: string;
    createdAt: number;
    modifiedAt: number;
}

export interface TestYjsDocumentOptions {
    title?: string;
    author?: string;
    language?: string;
    pageCount?: number;
    blocksPerPage?: number;
    nestedLevels?: number;
}

// ============================================================================
// Yjs Document Extraction Functions
// ============================================================================

/**
 * Extract metadata from a Yjs document
 */
export function extractMetadataFromYjs(ydoc: Y.Doc): YjsMetadataData | null {
    const metadata = ydoc.getMap('metadata');
    if (!metadata || metadata.size === 0) {
        return null;
    }

    return {
        title: (metadata.get('title') as string) || '',
        author: (metadata.get('author') as string) || '',
        description: (metadata.get('description') as string) || '',
        language: (metadata.get('language') as string) || 'en',
        license: (metadata.get('license') as string) || '',
        keywords: (metadata.get('keywords') as string) || '',
        theme: (metadata.get('theme') as string) || 'base',
        version: (metadata.get('version') as string) || '',
        exelearningVersion: (metadata.get('exelearningVersion') as string) || '',
        createdAt: (metadata.get('createdAt') as number) || 0,
        modifiedAt: (metadata.get('modifiedAt') as number) || 0,
    };
}

/**
 * Extract all pages from Yjs navigation array (flattened)
 */
export function extractAllPagesFromYjs(ydoc: Y.Doc): YjsPageData[] {
    const navigation = ydoc.getArray('navigation');
    const pages: YjsPageData[] = [];

    for (let i = 0; i < navigation.length; i++) {
        const yPage = navigation.get(i) as Y.Map<any>;
        const pageData = extractPageData(yPage);
        pages.push(pageData);
        // Recursively extract children
        pages.push(...extractChildrenFlat(pageData.children));
    }

    return pages;
}

/**
 * Extract pages preserving hierarchy (only root pages with nested children)
 */
export function extractNavigationFromYjs(ydoc: Y.Doc): YjsPageData[] {
    const navigation = ydoc.getArray('navigation');
    const pages: YjsPageData[] = [];

    for (let i = 0; i < navigation.length; i++) {
        const yPage = navigation.get(i) as Y.Map<any>;
        pages.push(extractPageData(yPage));
    }

    return pages;
}

/**
 * Extract page data from Y.Map
 */
function extractPageData(yPage: Y.Map<any>): YjsPageData {
    const blocks = extractBlocksFromYArray(yPage.get('blocks') as Y.Array<any>);
    const children = extractChildrenFromYArray(yPage.get('children') as Y.Array<any>);

    return {
        id: yPage.get('id') as string,
        pageId: yPage.get('pageId') as string,
        title: yPage.get('title') as string,
        pageName: yPage.get('pageName') as string,
        parentId: yPage.get('parentId') as string | null,
        order: (yPage.get('order') as number) || 0,
        level: yPage.get('level') as number,
        blocks,
        children,
    };
}

/**
 * Extract blocks from Y.Array
 */
function extractBlocksFromYArray(yBlocks: Y.Array<any>): YjsBlockData[] {
    if (!yBlocks) return [];

    const blocks: YjsBlockData[] = [];
    for (let i = 0; i < yBlocks.length; i++) {
        const yBlock = yBlocks.get(i) as Y.Map<any>;
        blocks.push(extractBlockData(yBlock));
    }
    return blocks;
}

/**
 * Extract block data from Y.Map
 */
function extractBlockData(yBlock: Y.Map<any>): YjsBlockData {
    const content = yBlock.get('content');
    const contentStr = content instanceof Y.Text ? content.toString() : (content as string) || '';

    const propertiesMap = yBlock.get('properties') as Y.Map<any>;
    const properties: Record<string, any> = {};
    if (propertiesMap && propertiesMap instanceof Y.Map) {
        propertiesMap.forEach((value, key) => {
            properties[key] = value;
        });
    }

    let data: any;
    const dataStr = yBlock.get('data') as string;
    if (dataStr) {
        try {
            data = JSON.parse(dataStr);
        } catch {
            data = dataStr;
        }
    }

    return {
        id: yBlock.get('id') as string,
        blockId: yBlock.get('blockId') as string,
        pageId: yBlock.get('pageId') as string,
        type: yBlock.get('type') as string,
        blockName: (yBlock.get('blockName') as string) || '',
        order: (yBlock.get('order') as number) || 0,
        title: yBlock.get('title') as string,
        content: contentStr,
        properties,
        data,
        ideviceId: yBlock.get('ideviceId') as string,
        iconName: yBlock.get('iconName') as string,
    };
}

/**
 * Extract children from Y.Array
 */
function extractChildrenFromYArray(yChildren: Y.Array<any>): YjsPageData[] {
    if (!yChildren) return [];

    const children: YjsPageData[] = [];
    for (let i = 0; i < yChildren.length; i++) {
        const yChild = yChildren.get(i) as Y.Map<any>;
        children.push(extractPageData(yChild));
    }
    return children;
}

/**
 * Flatten children array recursively
 */
function extractChildrenFlat(children: YjsPageData[]): YjsPageData[] {
    const flat: YjsPageData[] = [];
    for (const child of children) {
        flat.push(child);
        flat.push(...extractChildrenFlat(child.children));
    }
    return flat;
}

/**
 * Extract all blocks from all pages in Yjs document
 */
export function extractAllBlocksFromYjs(ydoc: Y.Doc): YjsBlockData[] {
    const pages = extractAllPagesFromYjs(ydoc);
    const blocks: YjsBlockData[] = [];
    for (const page of pages) {
        blocks.push(...page.blocks);
    }
    return blocks;
}

/**
 * Count total pages in Yjs document (including nested)
 */
export function countTotalPages(ydoc: Y.Doc): number {
    return extractAllPagesFromYjs(ydoc).length;
}

/**
 * Count total blocks/components in Yjs document
 */
export function countTotalBlocks(ydoc: Y.Doc): number {
    return extractAllBlocksFromYjs(ydoc).length;
}

/**
 * Count root pages (pages without parent)
 */
export function countRootPages(ydoc: Y.Doc): number {
    const navigation = ydoc.getArray('navigation');
    return navigation.length;
}

// ============================================================================
// Comparison Functions
// ============================================================================

/**
 * Compare two Yjs documents for structural equality
 */
export function compareYjsDocuments(doc1: Y.Doc, doc2: Y.Doc): boolean {
    const meta1 = extractMetadataFromYjs(doc1);
    const meta2 = extractMetadataFromYjs(doc2);

    if (!compareMetadata(meta1, meta2)) {
        return false;
    }

    const pages1 = extractNavigationFromYjs(doc1);
    const pages2 = extractNavigationFromYjs(doc2);

    return comparePagesDeep(pages1, pages2);
}

/**
 * Compare metadata objects
 */
function compareMetadata(meta1: YjsMetadataData | null, meta2: YjsMetadataData | null): boolean {
    if (!meta1 && !meta2) return true;
    if (!meta1 || !meta2) return false;

    return (
        meta1.title === meta2.title &&
        meta1.author === meta2.author &&
        meta1.language === meta2.language &&
        meta1.theme === meta2.theme
    );
}

/**
 * Deep compare pages arrays
 */
function comparePagesDeep(pages1: YjsPageData[], pages2: YjsPageData[]): boolean {
    if (pages1.length !== pages2.length) return false;

    for (let i = 0; i < pages1.length; i++) {
        if (!comparePageDeep(pages1[i], pages2[i])) {
            return false;
        }
    }

    return true;
}

/**
 * Deep compare single page
 */
function comparePageDeep(page1: YjsPageData, page2: YjsPageData): boolean {
    if (
        page1.id !== page2.id ||
        page1.title !== page2.title ||
        page1.parentId !== page2.parentId ||
        page1.blocks.length !== page2.blocks.length
    ) {
        return false;
    }

    // Compare blocks
    for (let i = 0; i < page1.blocks.length; i++) {
        if (!compareBlock(page1.blocks[i], page2.blocks[i])) {
            return false;
        }
    }

    // Compare children recursively
    return comparePagesDeep(page1.children, page2.children);
}

/**
 * Compare two blocks
 */
function compareBlock(block1: YjsBlockData, block2: YjsBlockData): boolean {
    return block1.id === block2.id && block1.type === block2.type && block1.content === block2.content;
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verify Yjs metadata matches OdeXmlMeta
 */
export function verifyMetadataEquality(meta: OdeXmlMeta, ydoc: Y.Doc): boolean {
    const yjsMeta = extractMetadataFromYjs(ydoc);
    if (!yjsMeta) return false;

    return (
        yjsMeta.title === (meta.title || 'Untitled') &&
        yjsMeta.author === (meta.author || '') &&
        yjsMeta.language === (meta.language || 'en')
    );
}

/**
 * Verify Yjs navigation matches parsed pages
 */
export function verifyPageHierarchy(pages: NormalizedPage[], ydoc: Y.Doc): boolean {
    const rootPages = pages.filter(p => p.parent_id === null);
    const yjsRootPages = extractNavigationFromYjs(ydoc);

    if (rootPages.length !== yjsRootPages.length) {
        return false;
    }

    for (let i = 0; i < rootPages.length; i++) {
        if (!verifyPageMatch(rootPages[i], yjsRootPages[i])) {
            return false;
        }
    }

    return true;
}

/**
 * Verify single page matches
 */
function verifyPageMatch(normalizedPage: NormalizedPage, yjsPage: YjsPageData): boolean {
    if (normalizedPage.id !== yjsPage.id) return false;
    if (normalizedPage.title !== yjsPage.title) return false;
    if (normalizedPage.components.length !== yjsPage.blocks.length) return false;

    // Verify children if present
    if (normalizedPage.children && normalizedPage.children.length > 0) {
        if (normalizedPage.children.length !== yjsPage.children.length) {
            return false;
        }
        for (let i = 0; i < normalizedPage.children.length; i++) {
            if (!verifyPageMatch(normalizedPage.children[i], yjsPage.children[i])) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Verify complete parsed structure matches Yjs document
 */
export function verifyParsedStructureMatchesYjs(
    parsed: ParsedOdeStructure,
    ydoc: Y.Doc,
): {
    isEqual: boolean;
    differences: string[];
} {
    const differences: string[] = [];

    // Check metadata
    const yjsMeta = extractMetadataFromYjs(ydoc);
    if (yjsMeta?.title !== (parsed.meta.title || 'Untitled')) {
        differences.push(`Title mismatch: "${yjsMeta?.title}" vs "${parsed.meta.title}"`);
    }

    // Check page count
    const totalPages = countTotalPages(ydoc);
    if (totalPages !== parsed.pages.length) {
        differences.push(`Page count mismatch: ${totalPages} vs ${parsed.pages.length}`);
    }

    // Check block count
    const totalBlocks = countTotalBlocks(ydoc);
    const expectedBlocks = parsed.pages.reduce((sum, p) => sum + p.components.length, 0);
    if (totalBlocks !== expectedBlocks) {
        differences.push(`Block count mismatch: ${totalBlocks} vs ${expectedBlocks}`);
    }

    return {
        isEqual: differences.length === 0,
        differences,
    };
}

// ============================================================================
// Test Document Factory
// ============================================================================

/**
 * Create a test Yjs document with predictable content
 */
export function createTestYjsDocument(options: TestYjsDocumentOptions = {}): Y.Doc {
    const {
        title = 'Test Document',
        author = 'Test Author',
        language = 'en',
        pageCount = 1,
        blocksPerPage = 1,
        nestedLevels = 0,
    } = options;

    const ydoc = new Y.Doc();

    // Create metadata
    const metadata = ydoc.getMap('metadata');
    metadata.set('title', title);
    metadata.set('author', author);
    metadata.set('description', '');
    metadata.set('language', language);
    metadata.set('license', '');
    metadata.set('keywords', '');
    metadata.set('theme', 'base');
    metadata.set('version', '1.0');
    metadata.set('exelearningVersion', '4.0');
    metadata.set('createdAt', Date.now());
    metadata.set('modifiedAt', Date.now());

    // Create navigation
    const navigation = ydoc.getArray('navigation');

    for (let i = 0; i < pageCount; i++) {
        const page = createTestPage(ydoc, `page-${i}`, `Page ${i + 1}`, null, blocksPerPage, nestedLevels);
        navigation.push([page]);
    }

    return ydoc;
}

/**
 * Create a test page Y.Map
 */
function createTestPage(
    ydoc: Y.Doc,
    id: string,
    title: string,
    parentId: string | null,
    blocksCount: number,
    nestedLevels: number,
): Y.Map<any> {
    const page = new Y.Map();

    page.set('id', id);
    page.set('pageId', id);
    page.set('title', title);
    page.set('pageName', title);
    page.set('parentId', parentId);
    page.set('order', 0);
    page.set('level', 0);

    // Create blocks
    const blocks = new Y.Array();
    for (let i = 0; i < blocksCount; i++) {
        const block = createTestBlock(ydoc, `${id}-block-${i}`, id);
        blocks.push([block]);
    }
    page.set('blocks', blocks);

    // Create children if nested levels requested
    const children = new Y.Array();
    if (nestedLevels > 0) {
        const childPage = createTestPage(ydoc, `${id}-child`, `${title} Child`, id, blocksCount, nestedLevels - 1);
        children.push([childPage]);
    }
    page.set('children', children);

    return page;
}

/**
 * Create a test block Y.Map
 */
function createTestBlock(ydoc: Y.Doc, id: string, pageId: string): Y.Map<any> {
    const block = new Y.Map();

    block.set('id', id);
    block.set('blockId', id);
    block.set('pageId', pageId);
    block.set('type', 'FreeTextIdevice');
    block.set('blockName', 'Test Block');
    block.set('order', 0);
    block.set('title', 'Test Block Title');

    const content = new Y.Text();
    content.insert(0, '<p>Test content for block</p>');
    block.set('content', content);

    const properties = new Y.Map();
    properties.set('testProp', 'testValue');
    block.set('properties', properties);

    return block;
}

// ============================================================================
// Yjs Binary State Utilities
// ============================================================================

/**
 * Create Yjs state from document
 */
export function encodeYjsDocument(ydoc: Y.Doc): Uint8Array {
    return Y.encodeStateAsUpdate(ydoc);
}

/**
 * Restore Yjs document from state
 */
export function decodeYjsDocument(state: Uint8Array): Y.Doc {
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, state);
    return ydoc;
}

/**
 * Compare two Yjs states for binary equality
 */
export function compareYjsStates(state1: Uint8Array, state2: Uint8Array): boolean {
    const doc1 = decodeYjsDocument(state1);
    const doc2 = decodeYjsDocument(state2);
    return compareYjsDocuments(doc1, doc2);
}

/**
 * Create a deep clone of a Yjs document via encode/decode
 */
export function cloneYjsDocument(ydoc: Y.Doc): Y.Doc {
    const state = encodeYjsDocument(ydoc);
    return decodeYjsDocument(state);
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Print Yjs document structure for debugging
 */
export function printYjsStructure(ydoc: Y.Doc): string {
    const meta = extractMetadataFromYjs(ydoc);
    const pages = extractNavigationFromYjs(ydoc);

    let output = '=== Yjs Document Structure ===\n';
    output += `Metadata: ${JSON.stringify(meta, null, 2)}\n`;
    output += `Pages (${pages.length}):\n`;

    function printPage(page: YjsPageData, indent: string = ''): string {
        let result = `${indent}- ${page.title} (${page.id})\n`;
        result += `${indent}  Blocks: ${page.blocks.length}\n`;
        for (const block of page.blocks) {
            result += `${indent}    - ${block.type}: "${block.content.substring(0, 50)}..."\n`;
        }
        for (const child of page.children) {
            result += printPage(child, indent + '  ');
        }
        return result;
    }

    for (const page of pages) {
        output += printPage(page, '  ');
    }

    return output;
}

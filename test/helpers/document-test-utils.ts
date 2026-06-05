/**
 * Test Helper: Document Creation Utilities
 *
 * Provides helpers to create ExportDocument instances for testing.
 * Replaces the deleted ElpDocumentAdapter with ElpxImporter + YjsDocumentAdapter.
 *
 * Usage:
 * ```typescript
 * // From ELP file
 * const { document, extractedPath } = await createDocumentFromElpFile(elpPath);
 * // ... use document for export ...
 * await cleanupExtractedPath(extractedPath); // Clean up
 *
 * // From parsed structure
 * const document = createDocumentFromStructure(parsedStructure, extractedPath);
 * ```
 */

import * as Y from 'yjs';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ElpxImporter, FileSystemAssetHandler } from '../../src/shared/import';
import { ServerYjsDocumentWrapper, YjsDocumentAdapter } from '../../src/shared/export';
import type { ExportDocument } from '../../src/shared/export';
import type { ParsedOdeStructure } from '../../src/services/xml/xml-parser';

/**
 * Result from createDocumentFromElpFile
 */
export interface DocumentFromElpResult {
    document: ExportDocument;
    extractedPath: string;
    ydoc: Y.Doc;
    cleanup: () => Promise<void>;
}

/**
 * Create ExportDocument from an ELP/ELPX file
 *
 * Uses ElpxImporter to load the ELP into a Y.Doc, then wraps with YjsDocumentAdapter.
 *
 * @param elpPath - Path to ELP/ELPX file
 * @returns Document, extracted path, and cleanup function
 */
export async function createDocumentFromElpFile(elpPath: string): Promise<DocumentFromElpResult> {
    // Create temp directory for extraction
    const extractedPath = path.join('/tmp', `elp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.ensureDir(extractedPath);

    // Read ELP file
    const elpBuffer = await fs.readFile(elpPath);

    // Create Y.Doc and import ELP
    const ydoc = new Y.Doc();
    const assetHandler = new FileSystemAssetHandler(extractedPath);
    const importer = new ElpxImporter(ydoc, assetHandler);
    await importer.importFromBuffer(new Uint8Array(elpBuffer));

    // Create document adapter
    const wrapper = new ServerYjsDocumentWrapper(ydoc, 'test-export');
    const document = new YjsDocumentAdapter(wrapper);

    // Cleanup function
    const cleanup = async (): Promise<void> => {
        ydoc.destroy();
        if (extractedPath.startsWith('/tmp/')) {
            await fs.remove(extractedPath).catch(() => {});
        }
    };

    return { document, extractedPath, ydoc, cleanup };
}

/**
 * Create ExportDocument from a ParsedOdeStructure
 *
 * Populates a Y.Doc with the structure and wraps with YjsDocumentAdapter.
 * This is useful for unit-level testing with sample structures.
 *
 * @param structure - Parsed ODE structure
 * @param extractedPath - Path to extracted content (for asset resolution)
 * @returns ExportDocument adapter
 */
export function createDocumentFromStructure(structure: ParsedOdeStructure, extractedPath: string): ExportDocument {
    const ydoc = new Y.Doc();
    populateYDocFromStructure(ydoc, structure);

    const wrapper = new ServerYjsDocumentWrapper(ydoc, 'test-export');
    return new YjsDocumentAdapter(wrapper);
}

/**
 * Populate a Y.Doc with ParsedOdeStructure data
 *
 * Converts the legacy ParsedOdeStructure format to Y.Doc format
 * expected by YjsDocumentAdapter.
 *
 * @param ydoc - Y.Doc to populate
 * @param structure - Parsed structure data
 */
export function populateYDocFromStructure(ydoc: Y.Doc, structure: ParsedOdeStructure): void {
    const meta = structure.meta;

    // Populate metadata
    const metadata = ydoc.getMap('metadata');
    metadata.set('title', meta.title || 'Untitled');
    metadata.set('author', meta.author || '');
    metadata.set('description', meta.description || '');
    metadata.set('language', meta.language || 'en');
    metadata.set('license', meta.license || '');
    metadata.set('theme', meta.theme || 'base');
    metadata.set('keywords', meta.keywords || '');

    // Export options from meta
    if (meta.addSearchBox !== undefined) metadata.set('addSearchBox', String(meta.addSearchBox));
    if (meta.addPagination !== undefined) metadata.set('addPagination', String(meta.addPagination));
    if (meta.addAccessibilityToolbar !== undefined)
        metadata.set('addAccessibilityToolbar', String(meta.addAccessibilityToolbar));
    if (meta.addMathJax !== undefined) metadata.set('addMathJax', String(meta.addMathJax));
    if (meta.addExeLink !== undefined) metadata.set('addExeLink', String(meta.addExeLink));
    if (meta.exportSource !== undefined) metadata.set('exportSource', String(meta.exportSource));

    // Custom content
    if (meta.extraHeadContent) metadata.set('extraHeadContent', meta.extraHeadContent);
    if (meta.footer) metadata.set('footer', meta.footer);
    if (meta.customStyles) metadata.set('customStyles', meta.customStyles);

    // Populate navigation
    const navigation = ydoc.getArray('navigation');

    for (const page of structure.pages) {
        const pageMap = new Y.Map();
        pageMap.set('id', page.id);
        pageMap.set('title', page.title);
        pageMap.set('parentId', page.parent_id || null);
        pageMap.set('order', page.position ?? 0);

        // Page properties
        if (page.properties) {
            const propsMap = new Y.Map();
            for (const [key, value] of Object.entries(page.properties)) {
                propsMap.set(key, value);
            }
            pageMap.set('properties', propsMap);
        }

        // Convert components to blocks structure
        // In Yjs structure, pages have blocks, and blocks have components
        // In ParsedOdeStructure, pages have components directly
        // We create a default block to hold the components
        const blocksArray = new Y.Array();

        if (page.components && page.components.length > 0) {
            const blockMap = new Y.Map();
            blockMap.set('id', `block-${page.id}`);
            blockMap.set('name', '');
            blockMap.set('order', 0);

            const componentsArray = new Y.Array();
            for (const comp of page.components) {
                const compMap = new Y.Map();
                compMap.set('id', comp.id);
                compMap.set('type', comp.type);
                compMap.set('order', comp.order ?? comp.position ?? 0);
                compMap.set('content', comp.content || '');

                // JSON properties for iDevice
                if (comp.jsonProperties) {
                    compMap.set(
                        'jsonProperties',
                        typeof comp.jsonProperties === 'string'
                            ? comp.jsonProperties
                            : JSON.stringify(comp.jsonProperties),
                    );
                }

                // Structure properties
                if (comp.properties) {
                    const structPropsMap = new Y.Map();
                    for (const [key, value] of Object.entries(comp.properties)) {
                        structPropsMap.set(key, value);
                    }
                    compMap.set('properties', structPropsMap);
                }

                componentsArray.push([compMap]);
            }
            blockMap.set('components', componentsArray);
            blocksArray.push([blockMap]);
        }

        pageMap.set('blocks', blocksArray);
        navigation.push([pageMap]);
    }
}

/**
 * Clean up extracted path if it's in /tmp
 *
 * @param extractedPath - Path to clean up
 */
export async function cleanupExtractedPath(extractedPath: string): Promise<void> {
    if (extractedPath.startsWith('/tmp/')) {
        await fs.remove(extractedPath).catch(() => {});
    }
}

/**
 * Legacy compatibility: Extended document interface with extractedPath
 *
 * Some tests access document.extractedPath directly.
 * This interface and wrapper provide that compatibility.
 */
export interface ExportDocumentWithPath extends ExportDocument {
    extractedPath: string;
}

/**
 * Create document with extractedPath property for legacy test compatibility
 */
export function createDocumentWithPath(structure: ParsedOdeStructure, extractedPath: string): ExportDocumentWithPath {
    const document = createDocumentFromStructure(structure, extractedPath);
    return Object.assign(document, { extractedPath });
}

/**
 * YjsDocumentAdapter
 *
 * Adapts YjsDocumentManager (browser/Yjs) to the unified ExportDocument interface.
 * This allows browser-based exports to use the same export code as the backend.
 *
 * Usage:
 * ```typescript
 * import { YjsDocumentAdapter } from './adapters/YjsDocumentAdapter';
 *
 * // In browser with active YjsDocumentManager
 * const doc = new YjsDocumentAdapter(documentManager);
 * const metadata = doc.getMetadata();
 * const pages = doc.getNavigation();
 * ```
 */

import type { ExportDocument, ExportMetadata, ExportPage, ExportBlock, ExportComponent } from '../interfaces';

/**
 * Type definitions for Yjs structures used by YjsDocumentManager
 * These match the structure used in public/app/yjs/
 */
interface YMap {
    get(key: string): unknown;
    toJSON(): Record<string, unknown>;
}

interface YArray {
    length: number;
    get(index: number): unknown;
    toArray(): unknown[];
    forEach(callback: (item: unknown, index: number) => void): void;
}

interface YjsDocumentManagerInterface {
    getMetadata(): YMap;
    getNavigation(): YArray;
    projectId: string | number;
}

/**
 * YjsDocumentAdapter class
 * Implements ExportDocument interface for Yjs documents in the browser
 */
export class YjsDocumentAdapter implements ExportDocument {
    private manager: YjsDocumentManagerInterface;

    /**
     * Create adapter from YjsDocumentManager
     * @param manager - Active YjsDocumentManager instance
     */
    constructor(manager: YjsDocumentManagerInterface) {
        this.manager = manager;
    }

    /**
     * Get export metadata from Y.Map
     * @returns Export metadata
     */
    getMetadata(): ExportMetadata {
        const meta = this.manager.getMetadata();

        return {
            title: (meta.get('title') as string) || 'eXeLearning',
            author: (meta.get('author') as string) || '',
            description: (meta.get('description') as string) || '',
            language: (meta.get('language') as string) || 'en',
            license: (meta.get('license') as string) || '',
            keywords: (meta.get('keywords') as string) || '',
            theme: (meta.get('theme') as string) || 'base',
            exelearningVersion: (meta.get('exelearning_version') as string) || undefined,
            createdAt: (meta.get('createdAt') as string) || new Date().toISOString(),
            modified: (meta.get('modifiedAt') as string) || new Date().toISOString(),
            // Custom styles support
            customStyles: (meta.get('customStyles') as string) || undefined,

            // Export options (values stored as strings 'true'/'false' in Yjs)
            addExeLink: this.parseBoolean(meta.get('addExeLink'), true), // Default: true
            addPagination: this.parseBoolean(meta.get('addPagination'), false),
            addSearchBox: this.parseBoolean(meta.get('addSearchBox'), false),
            addAccessibilityToolbar: this.parseBoolean(meta.get('addAccessibilityToolbar'), false),
            exportSource: this.parseBoolean(meta.get('exportSource'), true), // Default: true

            // Custom content
            extraHeadContent: (meta.get('extraHeadContent') as string) || undefined,
            footer: (meta.get('footer') as string) || undefined,
        };
    }

    /**
     * Parse boolean value from Yjs storage
     * Values may be stored as strings 'true'/'false' or actual booleans
     * @param value - Value to parse
     * @param defaultValue - Default value if not found
     * @returns Boolean value
     */
    private parseBoolean(value: unknown, defaultValue: boolean): boolean {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return defaultValue;
    }

    /**
     * Get navigation structure as flat array of pages
     *
     * Note: The Yjs navigation stores pages in a FLAT structure where each page
     * has a `parentId` attribute referencing its parent (not nested `children` arrays).
     * This matches how ElpxImporter.js stores pages in the browser.
     *
     * @returns Array of export pages with parentId references
     */
    getNavigation(): ExportPage[] {
        const navigation = this.manager.getNavigation();
        const pages: ExportPage[] = [];

        // Iterate all pages in the flat navigation array
        // Each page has parentId set to reference its parent (null for root pages)
        navigation.forEach(pageMap => {
            const page = this.convertPage(pageMap as YMap);
            pages.push(page);
        });

        return pages;
    }

    /**
     * Convert a Y.Map page to ExportPage format
     * @param pageMap - Y.Map representing a page
     * @returns Export page
     */
    private convertPage(pageMap: YMap): ExportPage {
        const blocksArray = pageMap.get('blocks') as YArray | undefined;
        const blocks: ExportBlock[] = [];

        if (blocksArray) {
            blocksArray.forEach((blockMap, index) => {
                blocks.push(this.convertBlock(blockMap as YMap, index));
            });
        }

        return {
            id: (pageMap.get('id') as string) || (pageMap.get('pageId') as string) || '',
            title: (pageMap.get('title') as string) || (pageMap.get('pageName') as string) || 'Page',
            parentId: (pageMap.get('parentId') as string | null) || null,
            order: (pageMap.get('order') as number) || 0,
            blocks,
        };
    }

    /**
     * Convert a Y.Map block to ExportBlock format
     * @param blockMap - Y.Map representing a block
     * @param index - Block index for ordering
     * @returns Export block
     */
    private convertBlock(blockMap: YMap, index: number): ExportBlock {
        const componentsArray = blockMap.get('components') as YArray | undefined;
        const components: ExportComponent[] = [];

        if (componentsArray) {
            componentsArray.forEach((compMap, compIndex) => {
                components.push(this.convertComponent(compMap as YMap, compIndex));
            });
        }

        return {
            id: (blockMap.get('id') as string) || `block-${index}`,
            name: (blockMap.get('name') as string) || (blockMap.get('blockName') as string) || '',
            order: (blockMap.get('order') as number) || index,
            components,
        };
    }

    /**
     * Convert a Y.Map component to ExportComponent format
     * @param compMap - Y.Map representing a component (iDevice)
     * @param index - Component index for ordering
     * @returns Export component
     */
    private convertComponent(compMap: YMap, index: number): ExportComponent {
        // Get HTML content - could be in 'content', 'htmlContent', or 'htmlView'
        let content =
            (compMap.get('content') as string) ||
            (compMap.get('htmlContent') as string) ||
            (compMap.get('htmlView') as string) ||
            '';

        // Handle Y.Text objects (convert to string if needed)
        if (content && typeof content === 'object' && 'toString' in content) {
            content = content.toString();
        }

        // Get properties as plain object
        const propsMap = compMap.get('properties') as YMap | undefined;
        const properties: Record<string, unknown> = propsMap ? propsMap.toJSON() : {};

        return {
            id: (compMap.get('id') as string) || `comp-${index}`,
            type: (compMap.get('type') as string) || (compMap.get('ideviceType') as string) || 'FreeTextIdevice',
            order: (compMap.get('order') as number) || index,
            content,
            properties,
        };
    }

    /**
     * Get all unique iDevice types used in the document
     * @returns Array of iDevice type names
     */
    getUsedIdeviceTypes(): string[] {
        const types = new Set<string>();
        const pages = this.getNavigation();

        for (const page of pages) {
            for (const block of page.blocks) {
                for (const comp of block.components) {
                    if (comp.type) {
                        types.add(comp.type);
                    }
                }
            }
        }

        return Array.from(types);
    }

    /**
     * Get combined HTML content from all pages (for library detection)
     * @returns Combined HTML string
     */
    getAllHtmlContent(): string {
        const htmlParts: string[] = [];
        const pages = this.getNavigation();

        for (const page of pages) {
            for (const block of page.blocks) {
                for (const comp of block.components) {
                    if (comp.content) {
                        htmlParts.push(comp.content);
                    }
                }
            }
        }

        return htmlParts.join('\n');
    }
}

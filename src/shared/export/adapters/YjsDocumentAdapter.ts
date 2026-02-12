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

import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ExportBlock,
    ExportComponent,
    ExportBlockProperties,
    ExportComponentProperties,
} from '../interfaces';

import { generateOdeXml } from '../generators/OdeXmlGenerator';
import { getLicenseUrl } from '../constants';

// Declare the global eXeLearning object for browser context
declare global {
    interface Window {
        eXeLearning?: {
            version?: string;
            [key: string]: unknown;
        };
    }
}

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
            subtitle: (meta.get('subtitle') as string) || '',
            author: (meta.get('author') as string) || '',
            description: (meta.get('description') as string) || '',
            language: (meta.get('language') as string) || 'en',
            license: (meta.get('license') as string) || '',
            licenseUrl: getLicenseUrl((meta.get('license') as string) || ''),
            keywords: (meta.get('keywords') as string) || '',
            theme: (meta.get('theme') as string) || 'base',
            exelearningVersion:
                (meta.get('exelearning_version') as string) ||
                (typeof window !== 'undefined' ? window.eXeLearning?.version : undefined),
            createdAt: (meta.get('createdAt') as string) || new Date().toISOString(),
            modified: (meta.get('modifiedAt') as string) || new Date().toISOString(),
            // Custom styles support
            customStyles: (meta.get('customStyles') as string) || undefined,

            // Export options (values stored as strings 'true'/'false' in Yjs)
            addExeLink: this.parseBoolean(meta.get('addExeLink'), true), // Default: true
            addPagination: this.parseBoolean(meta.get('addPagination'), false),
            addSearchBox: this.parseBoolean(meta.get('addSearchBox'), false),
            addAccessibilityToolbar: this.parseBoolean(meta.get('addAccessibilityToolbar'), false),
            addMathJax: this.parseBoolean(meta.get('addMathJax'), false),
            exportSource: this.parseBoolean(meta.get('exportSource'), true), // Default: true
            globalFont: (meta.get('globalFont') as string) || 'default',

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

        // Sort pages in hierarchical "reading order":
        // Root pages first (sorted by order), then each parent's children immediately after
        // This ensures prev/next navigation and page counter work correctly
        return this.sortPagesHierarchically(pages);
    }

    /**
     * Sort pages in hierarchical reading order
     * Root pages come first (sorted by order), children follow their parent (also sorted by order)
     * @param pages - Flat array of pages with parentId references
     * @returns Pages sorted in reading order
     */
    private sortPagesHierarchically(pages: ExportPage[]): ExportPage[] {
        // Build children map: parentId -> children[]
        const childrenMap = new Map<string | null, ExportPage[]>();
        const pageIds = new Set<string>();

        for (const page of pages) {
            pageIds.add(page.id);
            const parentId = page.parentId;
            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, []);
            }
            childrenMap.get(parentId)!.push(page);
        }

        // Sort children arrays by order
        for (const children of childrenMap.values()) {
            children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        // Build result in reading order using DFS
        const result: ExportPage[] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const addPageAndChildren = (parentId: string | null, path: string[] = []): void => {
            const children = childrenMap.get(parentId) || [];
            for (const child of children) {
                // Avoid duplicate visits from malformed structures
                if (visited.has(child.id)) {
                    continue;
                }

                // Detect cyclic parent-child references and skip problematic branch
                if (recursionStack.has(child.id)) {
                    console.warn(
                        `[YjsDocumentAdapter] Detected cycle in page hierarchy: ${[...path, child.id].join(' -> ')}`,
                    );
                    continue;
                }

                recursionStack.add(child.id);
                result.push(child);
                visited.add(child.id);
                addPageAndChildren(child.id, [...path, child.id]);
                recursionStack.delete(child.id);
            }
        };

        // Start with root pages (parentId = null)
        addPageAndChildren(null);

        // Include pages that were unreachable from root (orphaned/cyclic structures)
        for (const page of pages) {
            if (visited.has(page.id)) {
                continue;
            }

            if (!page.parentId || !pageIds.has(page.parentId)) {
                console.warn(
                    `[YjsDocumentAdapter] Found orphan page "${page.id}" (parentId: ${String(page.parentId)}), adding as root`,
                );
                addPageAndChildren(page.parentId ?? null, [page.id]);
                if (!visited.has(page.id)) {
                    result.push(page);
                    visited.add(page.id);
                }
                continue;
            }

            console.warn(`[YjsDocumentAdapter] Found unreachable page "${page.id}", adding directly`);
            result.push(page);
            visited.add(page.id);
        }

        return result;
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
            // Sort blocks by order property to ensure correct rendering order
            blocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        // Extract page-level properties (visibility, highlight, etc.)
        const propsMap = pageMap.get('properties') as YMap | undefined;
        const properties: Record<string, unknown> = propsMap ? propsMap.toJSON() : {};

        return {
            id: (pageMap.get('id') as string) || (pageMap.get('pageId') as string) || '',
            title: (pageMap.get('title') as string) || (pageMap.get('pageName') as string) || 'Page',
            parentId: (pageMap.get('parentId') as string | null) || null,
            order: (pageMap.get('order') as number) || 0,
            blocks,
            properties,
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
            // Sort components by order property to ensure correct rendering order
            components.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }

        // Extract block properties (teacherOnly, visibility, minimized, cssClass, identifier, allowToggle)
        const propsMap = blockMap.get('properties') as YMap | undefined;
        const rawProps: Record<string, unknown> = propsMap ? propsMap.toJSON() : {};

        // Type the properties correctly
        const properties: ExportBlockProperties = {
            visibility: rawProps.visibility as string | undefined,
            teacherOnly: rawProps.teacherOnly as string | undefined,
            allowToggle: rawProps.allowToggle as string | undefined,
            minimized: rawProps.minimized as string | undefined,
            identifier: rawProps.identifier as string | undefined,
            cssClass: rawProps.cssClass as string | undefined,
        };

        // Extract iconName from block
        const iconName = (blockMap.get('iconName') as string) || '';

        return {
            id: (blockMap.get('id') as string) || (blockMap.get('blockId') as string) || `block-${index}`,
            name: (blockMap.get('name') as string) || (blockMap.get('blockName') as string) || '',
            order: (blockMap.get('order') as number) || index,
            components,
            iconName,
            properties,
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

        // Get iDevice-specific properties (jsonProperties) as plain object
        // jsonProperties can be stored as:
        // 1. JSON string (from ElpxImporter, most common)
        // 2. Y.Map (from some code paths)
        // 3. Plain object
        const rawJsonProps = compMap.get('jsonProperties');
        let properties: Record<string, unknown> = {};

        if (rawJsonProps) {
            if (typeof rawJsonProps === 'string') {
                // Parse JSON string
                try {
                    properties = JSON.parse(rawJsonProps) as Record<string, unknown>;
                } catch {
                    // Invalid JSON, leave as empty object
                }
            } else if (typeof rawJsonProps === 'object' && 'toJSON' in rawJsonProps) {
                // Y.Map - convert to plain object
                properties = (rawJsonProps as YMap).toJSON();
            } else if (typeof rawJsonProps === 'object') {
                // Plain object
                properties = rawJsonProps as Record<string, unknown>;
            }
        }

        // Get structure properties (visibility, teacherOnly, identifier, cssClass)
        // These are stored in the component's 'properties' Y.Map
        const structPropsMap = compMap.get('properties') as YMap | undefined;
        const rawStructProps: Record<string, unknown> = structPropsMap ? structPropsMap.toJSON() : {};

        const structureProperties: ExportComponentProperties = {
            visibility: rawStructProps.visibility as string | undefined,
            teacherOnly: rawStructProps.teacherOnly as string | undefined,
            identifier: rawStructProps.identifier as string | undefined,
            cssClass: rawStructProps.cssClass as string | undefined,
        };

        return {
            id: (compMap.get('id') as string) || (compMap.get('ideviceId') as string) || `comp-${index}`,
            type: (compMap.get('type') as string) || (compMap.get('ideviceType') as string) || 'FreeTextIdevice',
            order: (compMap.get('order') as number) || index,
            content,
            properties,
            structureProperties,
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

    /**
     * Generate content.xml from Yjs document structure
     * This enables SCORM exports to include the ODE XML for re-editing
     * @returns ODE-format XML string with DOCTYPE declaration
     */
    async getContentXml(): Promise<string> {
        const metadata = this.getMetadata();
        const pages = this.getNavigation();

        // Use unified ODE XML generator
        return generateOdeXml(metadata, pages);
    }
}

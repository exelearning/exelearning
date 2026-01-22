/**
 * ElpDocumentAdapter
 *
 * Adapts ParsedOdeStructure from ELP files to the unified ExportDocument interface.
 * This allows the backend CLI to use the same export code as the frontend.
 *
 * Usage:
 * ```typescript
 * import { ElpDocumentAdapter } from './adapters/ElpDocumentAdapter';
 *
 * const doc = await ElpDocumentAdapter.fromElpFile('project.elp');
 * const metadata = doc.getMetadata();
 * const pages = doc.getNavigation();
 * ```
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import * as fflate from 'fflate';

import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ExportBlock,
    ExportComponent,
    ExportBlockProperties,
} from '../interfaces';

// Import the correct XML parser and types
import { parseFromString } from '../../../services/xml/xml-parser';
import type { ParsedOdeStructure, NormalizedPage, NormalizedComponent } from '../../../services/xml/interfaces';
import { getLicenseUrl } from '../constants';
import { getAppVersion } from '../../../utils/version';

// Re-export interfaces for backwards compatibility
export type {
    ParsedOdeStructure,
    OdeXmlMeta,
    NormalizedPage,
    NormalizedComponent,
} from '../../../services/xml/interfaces';

/**
 * ElpDocumentAdapter class
 * Implements ExportDocument interface for ELP files loaded on the backend
 */
export class ElpDocumentAdapter implements ExportDocument {
    private parsed: ParsedOdeStructure;
    public readonly extractedPath: string;

    /**
     * Create adapter from parsed ODE structure
     * @param parsed - Parsed ODE structure from xml-parser
     * @param extractedPath - Path where ELP was extracted (for asset access)
     */
    constructor(parsed: ParsedOdeStructure, extractedPath = '') {
        this.parsed = parsed;
        this.extractedPath = extractedPath;
    }

    /**
     * Create adapter from ELP file path
     * Extracts the ELP, parses content.xml, and returns adapter
     * @param elpPath - Path to the .elp file
     * @returns Promise<ElpDocumentAdapter>
     */
    static async fromElpFile(elpPath: string): Promise<ElpDocumentAdapter> {
        // Read the ELP file
        const elpBuffer = await fs.readFile(elpPath);
        const uint8Data = new Uint8Array(elpBuffer);
        const unzipped = fflate.unzipSync(uint8Data);

        // Create extraction directory
        const extractDir = path.join('/tmp', `elp-extract-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        if (!existsSync(extractDir)) {
            mkdirSync(extractDir, { recursive: true });
        }

        // Extract all files
        for (const [relativePath, content] of Object.entries(unzipped)) {
            // Skip directories (they end with /)
            if (relativePath.endsWith('/')) {
                continue;
            }

            const filePath = path.join(extractDir, relativePath);
            const fileDir = path.dirname(filePath);
            if (!existsSync(fileDir)) {
                mkdirSync(fileDir, { recursive: true });
            }
            await fs.writeFile(filePath, Buffer.from(content));
        }

        // Find content.xml (try both v2 and v3 formats)
        let contentXmlPath = path.join(extractDir, 'content.xml');
        if (!existsSync(contentXmlPath)) {
            contentXmlPath = path.join(extractDir, 'contentv3.xml');
        }

        if (!existsSync(contentXmlPath)) {
            throw new Error('No content.xml or contentv3.xml found in ELP file');
        }

        // Parse content.xml using the correct XML parser
        const xmlContent = await fs.readFile(contentXmlPath, 'utf-8');
        const parsed = parseFromString(xmlContent);

        return new ElpDocumentAdapter(parsed, extractDir);
    }

    /**
     * Get export metadata
     * @returns Export metadata
     */
    getMetadata(): ExportMetadata {
        const meta = this.parsed.meta;

        // Access extended metadata properties that may be set by the XML parser
        const extMeta = meta as typeof meta & {
            addExeLink?: boolean;
            addPagination?: boolean;
            addSearchBox?: boolean;
            addAccessibilityToolbar?: boolean;
            exportSource?: boolean;
            extraHeadContent?: string;
            footer?: string;
        };

        return {
            title: meta.title || 'eXeLearning',
            author: meta.author || '',
            description: meta.description || '',
            language: meta.language || 'en',
            license: meta.license || '',
            licenseUrl: getLicenseUrl(meta.license || ''),
            keywords: meta.keywords || '',
            theme: meta.theme || 'base',
            exelearningVersion: meta.exelearning_version || getAppVersion(),
            createdAt: meta.created || new Date().toISOString(),
            modifiedAt: meta.modified || new Date().toISOString(),

            // Export options (with defaults)
            addExeLink: extMeta.addExeLink ?? true,
            addPagination: extMeta.addPagination ?? false,
            addSearchBox: extMeta.addSearchBox ?? false,
            addAccessibilityToolbar: extMeta.addAccessibilityToolbar ?? false,
            exportSource: extMeta.exportSource ?? true,

            // Custom content
            extraHeadContent: extMeta.extraHeadContent,
            footer: extMeta.footer,
        };
    }

    /**
     * Get navigation structure as flat array of pages
     * Pages are sorted in hierarchical "reading order":
     * Root pages first (sorted by order), then each parent's children immediately after
     * This ensures prev/next navigation and page counter work correctly
     * @returns Array of export pages
     */
    getNavigation(): ExportPage[] {
        const pages: ExportPage[] = [];
        this.flattenPages(this.parsed.pages, pages);
        // Sort pages in hierarchical reading order for proper pagination
        return this.sortPagesHierarchically(pages);
    }

    /**
     * Sort pages in hierarchical reading order
     * Root pages come first (sorted by order), children follow their parent (also sorted by order)
     * @param pages - Flat array of pages with parentId references
     * @returns Pages sorted in reading order (DFS traversal)
     */
    private sortPagesHierarchically(pages: ExportPage[]): ExportPage[] {
        // Build children map: parentId -> children[]
        const childrenMap = new Map<string | null, ExportPage[]>();

        for (const page of pages) {
            const parentId = page.parentId ?? null;
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

        const addPageAndChildren = (parentId: string | null): void => {
            const children = childrenMap.get(parentId) || [];
            for (const child of children) {
                result.push(child);
                addPageAndChildren(child.id);
            }
        };

        // Start with root pages (parentId = null)
        addPageAndChildren(null);

        return result;
    }

    /**
     * Flatten hierarchical page structure to flat array
     * @param normalizedPages - Hierarchical pages from parser
     * @param result - Result array to populate
     */
    private flattenPages(normalizedPages: NormalizedPage[], result: ExportPage[]): void {
        for (const page of normalizedPages) {
            result.push(this.convertPage(page));

            // Recursively process children
            if (page.children && page.children.length > 0) {
                this.flattenPages(page.children, result);
            }
        }
    }

    /**
     * Convert a normalized page to export page format
     * @param page - Normalized page
     * @returns Export page
     */
    private convertPage(page: NormalizedPage): ExportPage {
        // Group components into blocks
        const blocks = this.groupComponentsIntoBlocks(page.components);

        return {
            id: page.id,
            title: page.title || 'Page',
            parentId: page.parent_id,
            order: page.position,
            blocks,
            properties: page.properties || {},
        };
    }

    /**
     * Group components into blocks based on blockName
     * @param components - Normalized components
     * @returns Array of export blocks
     */
    private groupComponentsIntoBlocks(components: NormalizedComponent[]): ExportBlock[] {
        const blockMap = new Map<string, ExportBlock>();

        for (const comp of components) {
            // Use blockId if available (preferred), otherwise fall back to blockName or default
            const blockId = comp.blockId || comp.blockName || 'default-block';

            if (!blockMap.has(blockId)) {
                blockMap.set(blockId, {
                    id: blockId,
                    name: comp.blockName || '',
                    order: comp.position || 0,
                    iconName: comp.blockIconName,
                    properties: comp.blockProperties as ExportBlockProperties,
                    components: [],
                });
            }

            const block = blockMap.get(blockId)!;
            block.components.push(this.convertComponent(comp));
        }

        // Sort blocks by order and return
        return Array.from(blockMap.values()).sort((a, b) => a.order - b.order);
    }

    /**
     * Convert a normalized component to export component format
     * @param comp - Normalized component
     * @returns Export component
     */
    private convertComponent(comp: NormalizedComponent): ExportComponent {
        return {
            id: comp.id,
            type: comp.type,
            order: comp.order || comp.position || 0,
            content: typeof comp.content === 'string' ? comp.content : '',
            properties: (comp.properties as Record<string, unknown>) || {},
        };
    }

    /**
     * Get raw parsed structure (for debugging or advanced use)
     * @returns Raw parsed ODE structure
     */
    getRawStructure(): ParsedOdeStructure {
        return this.parsed;
    }

    /**
     * Get list of resource paths from the ELP file
     * @returns Array of resource paths
     */
    getResourcePaths(): string[] {
        return this.parsed.srcRoutes || [];
    }

    /**
     * Get all unique iDevice types used in the document
     * @returns Array of iDevice type names
     */
    getUsedIdeviceTypes(): string[] {
        const types = new Set<string>();

        for (const page of this.parsed.pages) {
            for (const comp of page.components) {
                if (comp.type) {
                    types.add(comp.type);
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

        for (const page of this.parsed.pages) {
            for (const comp of page.components) {
                if (typeof comp.content === 'string') {
                    htmlParts.push(comp.content);
                }
            }
        }

        return htmlParts.join('\n');
    }

    /**
     * Get content.xml content for inclusion in export packages
     * This allows packages to be re-edited in eXeLearning
     * @returns content.xml as string, or null if not available
     */
    async getContentXml(): Promise<string | null> {
        if (!this.extractedPath) {
            return null;
        }

        // Try to read content.xml from the extracted path
        const contentXmlPath = path.join(this.extractedPath, 'content.xml');
        const contentV3XmlPath = path.join(this.extractedPath, 'contentv3.xml');

        try {
            if (existsSync(contentXmlPath)) {
                return await fs.readFile(contentXmlPath, 'utf-8');
            } else if (existsSync(contentV3XmlPath)) {
                return await fs.readFile(contentV3XmlPath, 'utf-8');
            }
        } catch {
            // Could not read content.xml
        }

        return null;
    }
}

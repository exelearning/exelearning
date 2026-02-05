/**
 * ElpxImporter
 *
 * Unified ELP/ELPX importer that works in both browser and server environments.
 * Parses .elp/.elpx files and populates a Yjs document with the project structure.
 *
 * This is a TypeScript conversion of public/app/yjs/ElpxImporter.js
 * designed to work in both browser (via bundle) and server (via direct import).
 *
 * Usage (Server/CLI):
 * ```typescript
 * import * as Y from 'yjs';
 * import { ElpxImporter, FileSystemAssetHandler } from './shared/import';
 *
 * const ydoc = new Y.Doc();
 * const assetHandler = new FileSystemAssetHandler('/tmp/extract');
 * const importer = new ElpxImporter(ydoc, assetHandler);
 * await importer.importFromBuffer(elpBuffer);
 * ```
 *
 * Usage (Browser):
 * The browser version is bundled and uses the existing AssetManager.
 */

import * as Y from 'yjs';
import * as fflate from 'fflate';
import { DOMParser } from '@xmldom/xmldom';

import type {
    AssetHandler,
    ElpxImportOptions,
    ElpxImportResult,
    ImportProgress,
    PageData,
    BlockData,
    ComponentData,
    OdeMetadata,
    Logger,
} from './interfaces';

import {
    BLOCK_PROPERTY_DEFAULTS,
    COMPONENT_PROPERTY_DEFAULTS,
    PAGE_PROPERTY_DEFAULTS,
    LEGACY_TYPE_ALIASES,
    defaultLogger,
} from './interfaces';

import { LegacyXmlParser } from './LegacyXmlParser';
import type { LegacyParseResult, LegacyPage, LegacyBlock, LegacyIdevice, LegacyMetadata } from './LegacyXmlParser';

/**
 * ElpxImporter class
 * Imports ELP/ELPX files into a Yjs document
 */
export class ElpxImporter {
    private ydoc: Y.Doc;
    private assetHandler: AssetHandler | null;
    private assetMap: Map<string, string> = new Map();
    private onProgress: ((progress: ImportProgress) => void) | null = null;
    private logger: Logger;

    /**
     * Create a new ElpxImporter
     * @param ydoc - Yjs document to populate
     * @param assetHandler - Asset handler for storing assets (optional)
     * @param logger - Logger for debug output (optional)
     */
    constructor(ydoc: Y.Doc, assetHandler: AssetHandler | null = null, logger: Logger = defaultLogger) {
        this.ydoc = ydoc;
        this.assetHandler = assetHandler;
        this.logger = logger;
    }

    // =========================================================================
    // DOM Query Helpers (compatible with @xmldom/xmldom)
    // Note: @xmldom/xmldom doesn't support querySelector/querySelectorAll
    // =========================================================================

    /**
     * Get all elements by tag name (compatible with @xmldom/xmldom)
     */
    private getElements(parent: Document | Element, tagName: string): Element[] {
        const elements = parent.getElementsByTagName(tagName);
        return Array.from(elements) as Element[];
    }

    /**
     * Get first element by tag name (compatible with @xmldom/xmldom)
     */
    private getElement(parent: Document | Element, tagName: string): Element | null {
        const elements = parent.getElementsByTagName(tagName);
        return (elements[0] as Element) || null;
    }

    /**
     * Report progress to callback if set
     */
    private reportProgress(phase: ImportProgress['phase'], percent: number, message: string): void {
        if (this.onProgress) {
            this.onProgress({ phase, percent, message });
        }
    }

    /**
     * Get the navigation Y.Array from the document
     */
    private getNavigation(): Y.Array<unknown> {
        return this.ydoc.getArray('navigation');
    }

    /**
     * Get the metadata Y.Map from the document
     */
    private getMetadata(): Y.Map<unknown> {
        return this.ydoc.getMap('metadata');
    }

    /**
     * Import from a buffer (Uint8Array)
     * This is the main entry point for server-side usage
     * @param buffer - ELP/ELPX file as Uint8Array
     * @param options - Import options
     * @returns Import statistics
     */
    async importFromBuffer(buffer: Uint8Array, options: ElpxImportOptions = {}): Promise<ElpxImportResult> {
        const { clearExisting = true, parentId = null, onProgress = null } = options;

        if (onProgress) {
            this.onProgress = onProgress;
        }

        this.logger.log('[ElpxImporter] Starting import from buffer');

        // Phase 1: Decompressing (0-10%)
        this.reportProgress('decompress', 0, 'Decompressing...');

        // Decompress ZIP
        const zip = fflate.unzipSync(buffer);

        // Report decompression complete (10%)
        this.reportProgress('decompress', 10, 'File decompressed');

        // Check for nested ELP file
        let workingZip = zip;

        if (!zip['content.xml'] && !zip['contentv3.xml']) {
            const elpFiles = Object.keys(zip).filter(
                name =>
                    !name.includes('/') &&
                    (name.toLowerCase().endsWith('.elp') || name.toLowerCase().endsWith('.elpx')),
            );

            if (elpFiles.length === 1) {
                this.logger.log(`[ElpxImporter] Found nested ELP file: ${elpFiles[0]}, extracting...`);
                const nestedElpData = zip[elpFiles[0]];
                workingZip = fflate.unzipSync(nestedElpData);
            } else if (elpFiles.length > 1) {
                throw new Error('ZIP contains multiple ELP files. Please extract and open one at a time.');
            }
        }

        // Find content.xml
        let contentFile = workingZip['content.xml'];
        let isLegacyFormat = false;

        if (!contentFile) {
            contentFile = workingZip['contentv3.xml'];
            isLegacyFormat = true;
        }

        if (!contentFile) {
            throw new Error('No content.xml found in .elpx file');
        }

        const contentXml = new TextDecoder().decode(contentFile);

        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(contentXml, 'text/xml');

        // Check for parsing errors
        const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
        if (parseError) {
            throw new Error(`XML parsing error: ${parseError.textContent}`);
        }

        // Check if it's Python pickle format (legacy)
        const rootElement = xmlDoc.documentElement?.tagName;
        if (rootElement === 'instance' || rootElement === 'dictionary') {
            this.logger.log('[ElpxImporter] Legacy Python pickle format detected');
            // Use LegacyXmlParser to parse and import
            const legacyParser = new LegacyXmlParser(this.logger);
            const parsedData = legacyParser.parse(contentXml);
            const stats = await this.importLegacyStructure(parsedData, workingZip, { clearExisting, parentId });
            // Note: detailed stats already logged in importLegacyStructure
            return stats;
        }

        // Extract and import structure (modern format)
        const stats = await this.importStructure(xmlDoc, workingZip, { clearExisting, parentId });

        // Note: detailed stats already logged in importStructure
        return stats;
    }

    /**
     * Import from already-unzipped contents (for server-side use when files are already extracted)
     * @param zipContents - Object mapping file paths to their content as Uint8Array
     * @param options - Import options
     * @returns Import statistics
     */
    async importFromZipContents(
        zipContents: Record<string, Uint8Array>,
        options: ElpxImportOptions = {},
    ): Promise<ElpxImportResult> {
        const { clearExisting = true, parentId = null, onProgress = null } = options;

        if (onProgress) {
            this.onProgress = onProgress;
        }

        this.logger.log('[ElpxImporter] Starting import from zip contents');

        // Skip decompression phase since contents are already extracted
        this.reportProgress('decompress', 10, 'Files ready');

        // Find content.xml
        let contentFile = zipContents['content.xml'];
        let isLegacyFormat = false;

        if (!contentFile) {
            contentFile = zipContents['contentv3.xml'];
            isLegacyFormat = true;
        }

        if (!contentFile) {
            throw new Error('No content.xml found in provided files');
        }

        const contentXml = new TextDecoder().decode(contentFile);

        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(contentXml, 'text/xml');

        // Check for parsing errors
        const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
        if (parseError) {
            throw new Error(`XML parsing error: ${parseError.textContent}`);
        }

        // Check if it's Python pickle format (legacy)
        const rootElement = xmlDoc.documentElement?.tagName;
        if (rootElement === 'instance' || rootElement === 'dictionary') {
            this.logger.log('[ElpxImporter] Legacy Python pickle format detected');
            // Use LegacyXmlParser to parse and import
            const legacyParser = new LegacyXmlParser(this.logger);
            const parsedData = legacyParser.parse(contentXml);
            const stats = await this.importLegacyStructure(parsedData, zipContents, { clearExisting, parentId });
            // Note: detailed stats already logged in importLegacyStructure
            return stats;
        }

        // Extract and import structure (modern format)
        const stats = await this.importStructure(xmlDoc, zipContents, { clearExisting, parentId });

        // Note: detailed stats already logged in importStructure
        return stats;
    }

    /**
     * Import document structure from parsed XML
     */
    async importStructure(
        xmlDoc: Document,
        zip: Record<string, Uint8Array>,
        options: { clearExisting?: boolean; parentId?: string | null } = {},
    ): Promise<ElpxImportResult> {
        const { clearExisting = true, parentId = null } = options;
        const stats: ElpxImportResult = { pages: 0, blocks: 0, components: 0, assets: 0 };

        // Phase 2: Extracting assets (10-50%)
        this.reportProgress('assets', 10, 'Extracting assets...');

        // Extract assets FIRST to populate assetMap
        stats.assets = await this.importAssets(zip);

        // Assets extracted (50%)
        this.reportProgress('assets', 50, 'Assets extracted');

        // Get Y.Doc components
        const navigation = this.getNavigation();
        const metadata = this.getMetadata();

        // Extract pages (odeNavStructures)
        const odeNavStructures = this.findNavStructures(xmlDoc);

        this.logger.log('[ElpxImporter] Root element:', xmlDoc.documentElement?.tagName);
        this.logger.log('[ElpxImporter] Found odeNavStructure elements:', odeNavStructures.length);

        // Build a map of all pages by ID for hierarchy lookup
        const pageMap = new Map<string, Element>();
        for (const navNode of odeNavStructures) {
            const pageId = this.getPageId(navNode);
            if (pageId) {
                pageMap.set(pageId, navNode);
            }
        }

        // Filter to only root-level pages
        const rootNavStructures: Element[] = [];
        for (const navNode of odeNavStructures) {
            const navParentId = this.getParentPageId(navNode);
            if (!navParentId || navParentId === '' || navParentId === 'null') {
                rootNavStructures.push(navNode);
            }
        }

        // Sort root pages by order
        rootNavStructures.sort((a, b) => {
            const orderA = this.getNavOrder(a);
            const orderB = this.getNavOrder(b);
            return orderA - orderB;
        });

        this.logger.log('[ElpxImporter] Root-level pages to import:', rootNavStructures.length);

        // Extract metadata
        const odeProperties = this.getElement(xmlDoc, 'odeProperties');
        const metadataValues = this.extractMetadata(xmlDoc, odeProperties);

        // Calculate order offset for imported pages
        let orderOffset = 0;
        if (!clearExisting) {
            orderOffset = this.getNextAvailableOrder(parentId);
            this.logger.log('[ElpxImporter] Order offset for import:', orderOffset, 'at parent:', parentId);
        }

        // Build all page structures as a FLAT list
        const pageStructures: PageData[] = [];
        const idRemap = new Map<string, string>();
        this.buildFlatPageList(
            rootNavStructures,
            zip,
            odeNavStructures,
            pageStructures,
            parentId,
            orderOffset,
            idRemap,
            true,
        );
        this.logger.log(
            '[ElpxImporter] Built flat page list:',
            pageStructures.length,
            'pages, parentId:',
            parentId,
            'idRemap size:',
            idRemap.size,
        );

        // Phase 3: Importing structure (50-80%)
        this.reportProgress('structure', 50, 'Importing structure...');

        // Wrap all Yjs operations in a single transaction
        this.logger.log('[ElpxImporter] Starting Yjs transaction...');
        try {
            this.ydoc.transact(() => {
                this.logger.log('[ElpxImporter] Inside transaction');

                // Clear existing structure only if requested
                if (clearExisting) {
                    this.logger.log('[ElpxImporter] Clearing existing navigation, length:', navigation.length);
                    while (navigation.length > 0) {
                        navigation.delete(0);
                    }
                    this.logger.log('[ElpxImporter] Navigation cleared');
                }

                // Set metadata only if clearing (replacing) the document
                if (odeProperties && clearExisting) {
                    this.logger.log('[ElpxImporter] Setting metadata...');
                    this.setMetadata(metadata, metadataValues);
                    this.logger.log('[ElpxImporter] Metadata set');
                }

                // Create Y types and add to document inside the transaction
                this.logger.log('[ElpxImporter] Creating', pageStructures.length, 'page structures...');
                for (let i = 0; i < pageStructures.length; i++) {
                    const pageData = pageStructures[i];
                    this.logger.log(
                        `[ElpxImporter] Processing page ${i + 1}/${pageStructures.length}: ${pageData.pageName}`,
                    );

                    const pageYMap = this.createPageYMap(pageData, stats);
                    if (pageYMap) {
                        navigation.push([pageYMap]);
                        stats.pages++;
                    }
                }
                this.logger.log('[ElpxImporter] All pages created');
            });
            this.logger.log('[ElpxImporter] Transaction completed successfully');

            // Structure imported (80%)
            this.reportProgress('structure', 80, 'Structure imported');
        } catch (transactionErr) {
            this.logger.error('[ElpxImporter] TRANSACTION ERROR:', transactionErr);
            throw transactionErr;
        }

        // Phase 4: Precaching assets (80-100%)
        this.reportProgress('precache', 80, 'Precaching assets...');

        // Preload all assets for immediate rendering
        if (this.assetHandler?.preloadAllAssets) {
            await this.assetHandler.preloadAllAssets();
        }

        // Import complete (100%)
        this.reportProgress('precache', 100, 'Import complete');

        // Add theme to stats
        stats.theme = metadataValues.theme || null;

        // Cache zip contents for theme import (avoids re-unzipping)
        stats.zipContents = zip;

        const { zipContents: _zip, ...statsWithoutZip } = stats;
        this.logger.log('[ElpxImporter] Import complete:', statsWithoutZip);
        return stats;
    }

    /**
     * Import legacy structure from parsed LegacyXmlParser data
     */
    private async importLegacyStructure(
        parsedData: LegacyParseResult,
        zip: Record<string, Uint8Array>,
        options: { clearExisting?: boolean; parentId?: string | null } = {},
    ): Promise<ElpxImportResult> {
        const { clearExisting = true, parentId = null } = options;
        const stats: ElpxImportResult = { pages: 0, blocks: 0, components: 0, assets: 0 };

        // Phase 2: Extracting assets (10-50%)
        this.reportProgress('assets', 10, 'Extracting assets...');

        // Extract assets FIRST to populate assetMap
        stats.assets = await this.importAssets(zip);

        // Assets extracted (50%)
        this.reportProgress('assets', 50, 'Assets extracted');

        // Get Y.Doc components
        const navigation = this.getNavigation();
        const metadata = this.getMetadata();

        // Convert legacy pages to PageData format
        const pageStructures: PageData[] = this.convertLegacyPagesToPageData(parsedData.pages, parentId);

        this.logger.log('[ElpxImporter] Converted legacy pages:', pageStructures.length);

        // Phase 3: Importing structure (50-80%)
        this.reportProgress('structure', 50, 'Importing structure...');

        // Wrap all Yjs operations in a single transaction
        this.logger.log('[ElpxImporter] Starting Yjs transaction for legacy import...');
        try {
            this.ydoc.transact(() => {
                this.logger.log('[ElpxImporter] Inside legacy transaction');

                // Clear existing structure only if requested
                if (clearExisting) {
                    this.logger.log('[ElpxImporter] Clearing existing navigation, length:', navigation.length);
                    while (navigation.length > 0) {
                        navigation.delete(0);
                    }
                    this.logger.log('[ElpxImporter] Navigation cleared');
                }

                // Set metadata from legacy format (only if clearing)
                if (clearExisting) {
                    this.logger.log('[ElpxImporter] Setting legacy metadata...');
                    this.setLegacyMetadata(metadata, parsedData.meta);
                    this.logger.log('[ElpxImporter] Legacy metadata set');
                }

                // Create Y types and add to document inside the transaction
                this.logger.log('[ElpxImporter] Creating', pageStructures.length, 'page structures...');
                for (let i = 0; i < pageStructures.length; i++) {
                    const pageData = pageStructures[i];
                    this.logger.log(
                        `[ElpxImporter] Processing legacy page ${i + 1}/${pageStructures.length}: ${pageData.pageName}`,
                    );

                    const pageYMap = this.createPageYMap(pageData, stats);
                    if (pageYMap) {
                        navigation.push([pageYMap]);
                        stats.pages++;
                    }
                }
                this.logger.log('[ElpxImporter] All legacy pages created');
            });
            this.logger.log('[ElpxImporter] Legacy transaction completed successfully');

            // Structure imported (80%)
            this.reportProgress('structure', 80, 'Structure imported');
        } catch (transactionErr) {
            this.logger.error('[ElpxImporter] LEGACY TRANSACTION ERROR:', transactionErr);
            throw transactionErr;
        }

        // Phase 4: Precaching assets (80-100%)
        this.reportProgress('precache', 80, 'Precaching assets...');

        // Preload all assets for immediate rendering
        if (this.assetHandler?.preloadAllAssets) {
            await this.assetHandler.preloadAllAssets();
        }

        // Import complete (100%)
        this.reportProgress('precache', 100, 'Import complete');

        // Cache zip contents for theme import (avoids re-unzipping)
        stats.zipContents = zip;

        const { zipContents: _zipLegacy, ...legacyStatsWithoutZip } = stats;
        this.logger.log('[ElpxImporter] Legacy import complete:', legacyStatsWithoutZip);
        return stats;
    }

    /**
     * Convert legacy pages to PageData format
     */
    private convertLegacyPagesToPageData(legacyPages: LegacyPage[], rootParentId: string | null): PageData[] {
        const pageStructures: PageData[] = [];

        for (const legacyPage of legacyPages) {
            // Determine parent ID: use rootParentId for top-level pages, otherwise use the mapped parent
            const parentId = legacyPage.parent_id === null ? rootParentId : legacyPage.parent_id;

            const pageData: PageData = {
                id: legacyPage.id,
                pageId: legacyPage.id,
                pageName: legacyPage.title,
                title: legacyPage.title,
                parentId: parentId,
                order: legacyPage.position,
                createdAt: new Date().toISOString(),
                blocks: [],
                properties: {},
            };

            // Convert legacy blocks to BlockData format
            for (const legacyBlock of legacyPage.blocks) {
                const blockData = this.convertLegacyBlockToBlockData(legacyBlock);
                pageData.blocks.push(blockData);
            }

            pageStructures.push(pageData);
        }

        return pageStructures;
    }

    /**
     * Convert legacy block to BlockData format
     */
    private convertLegacyBlockToBlockData(legacyBlock: LegacyBlock): BlockData {
        const blockData: BlockData = {
            id: legacyBlock.id,
            blockId: legacyBlock.id,
            blockName: legacyBlock.name,
            iconName: legacyBlock.iconName,
            order: legacyBlock.position,
            createdAt: new Date().toISOString(),
            components: [],
            properties: legacyBlock.blockProperties || {},
        };

        // Convert legacy iDevices to ComponentData format
        for (const legacyIdevice of legacyBlock.idevices) {
            const componentData = this.convertLegacyIdeviceToComponentData(legacyIdevice);
            blockData.components.push(componentData);
        }

        return blockData;
    }

    /**
     * Convert legacy iDevice to ComponentData format
     */
    private convertLegacyIdeviceToComponentData(legacyIdevice: LegacyIdevice): ComponentData {
        // Build HTML view with feedback if present
        let htmlView = legacyIdevice.htmlView || '';

        // If there's feedback content, append feedback button and content
        // BUT only if the HTML doesn't already have feedback embedded (prevents duplication)
        if (legacyIdevice.feedbackHtml && !this.htmlHasFeedback(htmlView)) {
            const buttonText = legacyIdevice.feedbackButton || 'Show Feedback';
            htmlView += `<div class="iDevice_buttons feedback-button js-required">`;
            htmlView += `<input type="button" class="feedbacktooglebutton" value="${this.escapeHtmlAttr(buttonText)}" `;
            htmlView += `data-text-a="${this.escapeHtmlAttr(buttonText)}" data-text-b="${this.escapeHtmlAttr(buttonText)}">`;
            htmlView += `</div>`;
            htmlView += `<div class="feedback js-feedback js-hidden" style="display: none;">${legacyIdevice.feedbackHtml}</div>`;
        }

        // Convert {{context_path}} to asset:// URLs in htmlView
        if (this.assetHandler && this.assetMap.size > 0 && htmlView) {
            try {
                htmlView = this.assetHandler.convertContextPathToAssetRefs(htmlView, this.assetMap);
            } catch (convErr) {
                this.logger.warn(`[ElpxImporter] Error converting asset paths for ${legacyIdevice.id}:`, convErr);
            }
        }

        // For text iDevices, the editor expects the content in jsonProperties.textTextarea
        // So we need to populate it from htmlView
        let properties = legacyIdevice.properties || {};
        if (legacyIdevice.type === 'text' && htmlView) {
            properties = {
                ...properties,
                textTextarea: htmlView,
            };
        }

        const componentData: ComponentData = {
            id: legacyIdevice.id,
            ideviceId: legacyIdevice.id,
            ideviceType: legacyIdevice.type,
            type: legacyIdevice.type,
            order: legacyIdevice.position,
            createdAt: new Date().toISOString(),
            htmlView: htmlView,
            properties: properties,
            componentProps: {},
            structureProps: {},
        };

        // Apply cssClass if present
        if (legacyIdevice.cssClass) {
            componentData.structureProps.cssClass = legacyIdevice.cssClass;
        }

        // Convert {{context_path}} and resources/ paths in properties
        if (componentData.properties && this.assetHandler && this.assetMap.size > 0) {
            try {
                componentData.properties = this.convertAssetPathsInObject(componentData.properties) as Record<
                    string,
                    unknown
                >;
            } catch (convErr) {
                this.logger.warn(`[ElpxImporter] Error converting paths in props for ${legacyIdevice.id}:`, convErr);
            }
        }

        return componentData;
    }

    /**
     * Set metadata on the Yjs document from legacy format
     */
    private setLegacyMetadata(metadata: Y.Map<unknown>, legacyMeta: LegacyMetadata): void {
        metadata.set('title', legacyMeta.title);
        metadata.set('author', legacyMeta.author);
        metadata.set('language', legacyMeta.language || 'en');
        metadata.set('description', legacyMeta.description);
        metadata.set('license', legacyMeta.license);

        // Export settings from legacy format (pp_ prefixed in meta)
        metadata.set('addPagination', legacyMeta.pp_addPagination);
        metadata.set('addSearchBox', legacyMeta.pp_addSearchBox);
        metadata.set('addExeLink', legacyMeta.pp_addExeLink);
        metadata.set('addAccessibilityToolbar', legacyMeta.pp_addAccessibilityToolbar);
        metadata.set('exportSource', legacyMeta.exportSource);

        // Legacy files don't have addMathJax or globalFont - use defaults
        metadata.set('addMathJax', false);
        metadata.set('globalFont', 'default');

        if (legacyMeta.extraHeadContent) {
            metadata.set('extraHeadContent', legacyMeta.extraHeadContent);
        }
        if (legacyMeta.footer) {
            metadata.set('footer', legacyMeta.footer);
        }
    }

    /**
     * Escape HTML special characters for attribute values
     */
    private escapeHtmlAttr(str: string): string {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Check if HTML content already contains feedback button elements
     * This prevents duplicate feedback when the handler already embedded feedback in htmlView
     *
     * @param html - HTML content to check
     * @returns true if feedback button already exists
     */
    private htmlHasFeedback(html: string): boolean {
        if (!html) return false;
        // Check for various feedback button patterns used in legacy exports
        // - feedbacktooglebutton: standard class name (note the typo in original)
        // - feedbackbutton: alternative class name used in some versions
        // - iDevice_buttons feedback-button: container class pattern
        return (
            html.includes('feedbacktooglebutton') ||
            html.includes('feedbackbutton') ||
            html.includes('iDevice_buttons feedback-button') ||
            html.includes('class="feedback-button')
        );
    }

    /**
     * Extract metadata from XML
     */
    private extractMetadata(xmlDoc: Document, odeProperties: Element | null): OdeMetadata {
        // Extract theme from userPreferences or odeProperties
        let themeFromXml = '';
        const userPreferences = this.getElement(xmlDoc, 'userPreferences');
        if (userPreferences) {
            const themePrefs = this.getElements(userPreferences, 'userPreference');
            for (const pref of themePrefs) {
                const keyEl = this.getElement(pref, 'key');
                const valueEl = this.getElement(pref, 'value');
                if (keyEl?.textContent === 'theme' && valueEl) {
                    themeFromXml = valueEl.textContent || '';
                    break;
                }
            }
        }
        if (!themeFromXml && odeProperties) {
            themeFromXml = this.getPropertyValue(odeProperties, 'pp_style') || '';
        }

        return {
            title: this.getMetadataProperty(odeProperties, 'pp_title', 'Imported Project'),
            subtitle: this.getMetadataProperty(odeProperties, 'pp_subtitle'),
            author: this.getMetadataProperty(odeProperties, 'pp_author'),
            language: this.getMetadataProperty(odeProperties, 'pp_lang', 'en'),
            description: this.getMetadataProperty(odeProperties, 'pp_description'),
            license: this.getMetadataProperty(odeProperties, 'pp_license'),
            theme: themeFromXml,
            addPagination: this.getBooleanMetadataProperty(odeProperties, 'pp_addPagination', false),
            addSearchBox: this.getBooleanMetadataProperty(odeProperties, 'pp_addSearchBox', false),
            addExeLink: this.getBooleanMetadataProperty(odeProperties, 'pp_addExeLink', true),
            addAccessibilityToolbar: this.getBooleanMetadataProperty(
                odeProperties,
                'pp_addAccessibilityToolbar',
                false,
            ),
            exportSource: this.getBooleanMetadataProperty(odeProperties, 'exportSource', true),
            extraHeadContent: this.getMetadataProperty(odeProperties, 'pp_extraHeadContent'),
            footer: this.getMetadataProperty(odeProperties, 'footer'),
            addMathJax: this.getBooleanMetadataProperty(odeProperties, 'pp_addMathJax', false),
            globalFont: this.getMetadataProperty(odeProperties, 'pp_globalFont', 'default'),
        };
    }

    /**
     * Set metadata on the Yjs document
     */
    private setMetadata(metadata: Y.Map<unknown>, values: OdeMetadata): void {
        metadata.set('title', values.title);
        if (values.subtitle) {
            metadata.set('subtitle', values.subtitle);
        }
        metadata.set('author', values.author);
        metadata.set('language', values.language);
        metadata.set('description', values.description);
        metadata.set('license', values.license);
        if (values.theme) {
            metadata.set('theme', values.theme);
            this.logger.log('[ElpxImporter] Theme set:', values.theme);
        }
        // Export settings
        metadata.set('addPagination', values.addPagination);
        metadata.set('addSearchBox', values.addSearchBox);
        metadata.set('addExeLink', values.addExeLink);
        metadata.set('addAccessibilityToolbar', values.addAccessibilityToolbar);
        metadata.set('exportSource', values.exportSource);
        metadata.set('addMathJax', values.addMathJax);
        metadata.set('globalFont', values.globalFont);
        if (values.extraHeadContent) {
            metadata.set('extraHeadContent', values.extraHeadContent);
        }
        if (values.footer) {
            metadata.set('footer', values.footer);
        }
    }

    /**
     * Build a flat list of all pages (recursive helper)
     */
    private buildFlatPageList(
        navNodes: Element[],
        zip: Record<string, Uint8Array>,
        allNavStructures: Element[],
        flatList: PageData[],
        parentId: string | null,
        orderOffset: number,
        idRemap: Map<string, string>,
        isRootLevel: boolean,
    ): void {
        let siblingOrder = 0;

        for (const navNode of navNodes) {
            const originalPageId = this.getPageId(navNode);
            const newPageId = this.generateId('page');

            if (originalPageId) {
                idRemap.set(originalPageId, newPageId);
            }

            const calculatedOrder = isRootLevel ? orderOffset + siblingOrder : siblingOrder;
            const pageData = this.buildPageData(navNode, zip, parentId, newPageId, calculatedOrder);

            if (pageData) {
                flatList.push(pageData);
                siblingOrder++;

                // Find child pages using ORIGINAL XML ID
                const childNavNodes: Element[] = [];
                for (const childNav of allNavStructures) {
                    const childXmlParentId = this.getParentPageId(childNav);
                    if (childXmlParentId === originalPageId) {
                        childNavNodes.push(childNav);
                    }
                }

                // Sort children by order and recursively add them
                childNavNodes.sort((a, b) => this.getNavOrder(a) - this.getNavOrder(b));
                if (childNavNodes.length > 0) {
                    this.buildFlatPageList(
                        childNavNodes,
                        zip,
                        allNavStructures,
                        flatList,
                        newPageId,
                        0,
                        idRemap,
                        false,
                    );
                }
            }
        }
    }

    /**
     * Build plain JavaScript data structure from XML
     */
    private buildPageData(
        navNode: Element,
        zip: Record<string, Uint8Array>,
        parentId: string | null,
        newPageId: string,
        calculatedOrder: number,
    ): PageData {
        const pageId = newPageId;
        const pageName = this.getPageName(navNode);
        const order = calculatedOrder;
        const properties = this.getNavStructureProperties(navNode);

        const pageData: PageData = {
            id: pageId,
            pageId: pageId,
            pageName: pageName,
            title: pageName,
            parentId: parentId,
            order: order,
            createdAt: new Date().toISOString(),
            blocks: [],
            properties: properties,
        };

        // Extract blocks (odePagStructures)
        const pagStructures = this.findPagStructures(navNode);
        const sortedPagStructures = Array.from(pagStructures).sort((a, b) => {
            return this.getPagOrder(a) - this.getPagOrder(b);
        });

        for (const pagNode of sortedPagStructures) {
            const blockData = this.buildBlockData(pagNode, zip);
            if (blockData) {
                pageData.blocks.push(blockData);
            }
        }

        return pageData;
    }

    /**
     * Build plain JavaScript data structure for a block
     */
    private buildBlockData(pagNode: Element, zip: Record<string, Uint8Array>): BlockData {
        const blockId =
            pagNode.getAttribute('odePagStructureId') ||
            this.getTextContent(pagNode, 'odeBlockId') ||
            this.generateId('block');
        const blockName = pagNode.getAttribute('blockName') || this.getTextContent(pagNode, 'blockName') || '';
        const order = this.getPagOrder(pagNode);
        const iconName = pagNode.getAttribute('iconName') || this.getTextContent(pagNode, 'iconName') || '';
        const properties = this.getPagStructureProperties(pagNode);

        const blockData: BlockData = {
            id: blockId,
            blockId: blockId,
            blockName: blockName,
            iconName: iconName,
            order: order,
            createdAt: new Date().toISOString(),
            components: [],
            properties: properties,
        };

        // Extract components (odeComponents)
        const odeComponents = this.findOdeComponents(pagNode);
        const sortedComponents = Array.from(odeComponents).sort((a, b) => {
            return this.getComponentOrder(a) - this.getComponentOrder(b);
        });

        for (const compNode of sortedComponents) {
            const compData = this.buildComponentData(compNode, zip);
            if (compData) {
                blockData.components.push(compData);
            }
        }

        return blockData;
    }

    /**
     * Build plain JavaScript data structure for a component
     */
    private buildComponentData(compNode: Element, _zip: Record<string, Uint8Array>): ComponentData {
        const componentId =
            compNode.getAttribute('odeComponentId') ||
            this.getTextContent(compNode, 'odeIdeviceId') ||
            this.generateId('idevice');

        let ideviceType =
            compNode.getAttribute('odeIdeviceTypeDirName') ||
            compNode.getAttribute('odeIdeviceTypeName') ||
            this.getTextContent(compNode, 'odeIdeviceTypeName') ||
            'FreeTextIdevice';

        // Normalize legacy type names
        if (LEGACY_TYPE_ALIASES[ideviceType]) {
            ideviceType = LEGACY_TYPE_ALIASES[ideviceType];
        }

        const order = this.getComponentOrder(compNode);

        const compData: ComponentData = {
            id: componentId,
            ideviceId: componentId,
            ideviceType: ideviceType,
            type: ideviceType,
            order: order,
            createdAt: new Date().toISOString(),
            htmlView: '',
            properties: null,
            componentProps: {},
            structureProps: {},
        };

        // Extract HTML view content
        const htmlViewNode = this.getElement(compNode, 'htmlView');
        if (htmlViewNode) {
            let htmlContent = this.decodeHtmlContent(htmlViewNode.textContent || '') || '';

            // Convert {{context_path}} to asset:// URLs
            if (this.assetHandler && this.assetMap.size > 0 && htmlContent) {
                try {
                    const converted = this.assetHandler.convertContextPathToAssetRefs(htmlContent, this.assetMap);
                    htmlContent = typeof converted === 'string' ? converted : htmlContent;
                } catch (convErr) {
                    this.logger.warn(`[ElpxImporter] Error converting asset paths for ${componentId}:`, convErr);
                }
            }

            compData.htmlView = typeof htmlContent === 'string' ? htmlContent : '';
        }

        // Extract JSON properties
        const jsonPropsNode = this.getElement(compNode, 'jsonProperties');
        if (jsonPropsNode) {
            try {
                const jsonStr = this.decodeHtmlContent(jsonPropsNode.textContent || '{}') || '{}';
                let props: Record<string, unknown> = {};

                try {
                    props = JSON.parse(jsonStr);
                } catch (parseErr) {
                    this.logger.warn(`[ElpxImporter] Invalid JSON for ${componentId}, using empty object`);
                    props = {};
                }

                // Convert {{context_path}} in parsed JSON values
                if (this.assetHandler && this.assetMap.size > 0 && props && typeof props === 'object') {
                    try {
                        props = this.convertAssetPathsInObject(props) as Record<string, unknown>;
                    } catch (convErr) {
                        this.logger.warn(`[ElpxImporter] Error converting paths in JSON for ${componentId}:`, convErr);
                    }
                }

                compData.properties = props;
            } catch (e) {
                this.logger.warn(`[ElpxImporter] Failed to process JSON properties for ${componentId}:`, e);
            }
        }

        // Extract component properties (odeComponentProperty) - legacy format
        const componentProps = this.getElements(compNode, 'odeComponentProperty');
        for (const propNode of componentProps) {
            const key = propNode.getAttribute('key') || this.getTextContent(propNode, 'key');
            const value =
                propNode.getAttribute('value') || this.getTextContent(propNode, 'value') || propNode.textContent;
            if (key && value) {
                compData.componentProps[key] = value;
            }
        }

        // Extract component-level properties (odeComponentsProperties)
        const structureProps = this.getComponentsProperties(compNode);

        // Merge properties from jsonProperties that override structure props
        if (compData.properties && typeof compData.properties === 'object') {
            const propsToMerge = ['visibility', 'teacherOnly', 'identifier', 'cssClass'];
            for (const key of propsToMerge) {
                if ((compData.properties as Record<string, unknown>)[key] !== undefined) {
                    const value = (compData.properties as Record<string, unknown>)[key];
                    if (typeof value === 'boolean') {
                        structureProps[key] = value ? 'true' : 'false';
                    } else {
                        structureProps[key] = String(value);
                    }
                }
            }
        }

        compData.structureProps = structureProps;

        return compData;
    }

    /**
     * Create Y.Map from plain page data (called INSIDE transaction)
     */
    private createPageYMap(pageData: PageData, stats: ElpxImportResult): Y.Map<unknown> {
        const pageMap = new Y.Map();

        pageMap.set('id', pageData.id);
        pageMap.set('pageId', pageData.pageId);
        pageMap.set('pageName', pageData.pageName);
        pageMap.set('title', pageData.title);
        pageMap.set('parentId', pageData.parentId);
        pageMap.set('order', pageData.order);
        pageMap.set('createdAt', pageData.createdAt);

        // Create properties Y.Map if page has properties
        if (pageData.properties && Object.keys(pageData.properties).length > 0) {
            const propsMap = new Y.Map();
            for (const [key, value] of Object.entries(pageData.properties)) {
                if (value !== undefined && value !== null) {
                    // Yjs only accepts primitives - convert objects/arrays to JSON strings
                    if (typeof value === 'object') {
                        propsMap.set(key, JSON.stringify(value));
                    } else {
                        propsMap.set(key, value);
                    }
                }
            }
            pageMap.set('properties', propsMap);
        }

        // Create blocks array
        const blocksArray = new Y.Array();
        for (const blockData of pageData.blocks) {
            const blockMap = this.createBlockYMap(blockData, stats);
            if (blockMap) {
                blocksArray.push([blockMap]);
                stats.blocks++;
            }
        }
        pageMap.set('blocks', blocksArray);

        return pageMap;
    }

    /**
     * Create Y.Map from plain block data (called INSIDE transaction)
     */
    private createBlockYMap(blockData: BlockData, stats: ElpxImportResult): Y.Map<unknown> {
        const blockMap = new Y.Map();

        blockMap.set('id', blockData.id);
        blockMap.set('blockId', blockData.blockId);
        blockMap.set('blockName', blockData.blockName);
        blockMap.set('iconName', blockData.iconName || '');
        blockMap.set('order', blockData.order);
        blockMap.set('createdAt', blockData.createdAt);

        // Create properties Y.Map if block has properties
        if (blockData.properties && Object.keys(blockData.properties).length > 0) {
            const propsMap = new Y.Map();
            for (const [key, value] of Object.entries(blockData.properties)) {
                if (value !== undefined && value !== null) {
                    // Yjs only accepts primitives - convert objects/arrays to JSON strings
                    if (typeof value === 'object') {
                        propsMap.set(key, JSON.stringify(value));
                    } else {
                        propsMap.set(key, value);
                    }
                }
            }
            blockMap.set('properties', propsMap);
        }

        // Create components array
        const componentsArray = new Y.Array();
        for (const compData of blockData.components) {
            const compMap = this.createComponentYMap(compData);
            if (compMap) {
                componentsArray.push([compMap]);
                stats.components++;
            }
        }
        blockMap.set('components', componentsArray);

        return blockMap;
    }

    /**
     * Create Y.Map from plain component data (called INSIDE transaction)
     */
    private createComponentYMap(compData: ComponentData): Y.Map<unknown> {
        const compMap = new Y.Map();

        compMap.set('id', compData.id);
        compMap.set('ideviceId', compData.ideviceId);
        compMap.set('ideviceType', compData.ideviceType);
        compMap.set('type', compData.type);
        compMap.set('order', compData.order);
        compMap.set('createdAt', compData.createdAt);

        // Store htmlView as plain string
        if (compData.htmlView) {
            compMap.set('htmlView', compData.htmlView);
            this.logger.log(
                `[ElpxImporter] createComponentYMap: Stored htmlView for ${compData.id}, length=${compData.htmlView.length}`,
            );
        } else {
            this.logger.log(`[ElpxImporter] createComponentYMap: No htmlView for ${compData.id}`);
        }

        // Store jsonProperties as plain string
        if (compData.properties && typeof compData.properties === 'object') {
            try {
                const jsonStr = JSON.stringify(compData.properties);
                compMap.set('jsonProperties', jsonStr);
            } catch (err) {
                this.logger.error('[ElpxImporter] ERROR stringifying properties:', err);
            }
        }

        // Set component properties as flat values (legacy format)
        if (compData.componentProps) {
            for (const [key, value] of Object.entries(compData.componentProps)) {
                if (value != null && typeof value !== 'object') {
                    compMap.set(`prop_${key}`, String(value));
                }
            }
        }

        // Create properties Y.Map if component has structure properties
        if (compData.structureProps && Object.keys(compData.structureProps).length > 0) {
            const propsMap = new Y.Map();
            for (const [key, value] of Object.entries(compData.structureProps)) {
                if (value !== undefined && value !== null) {
                    // Yjs only accepts primitives - convert objects/arrays to JSON strings
                    if (typeof value === 'object') {
                        propsMap.set(key, JSON.stringify(value));
                    } else {
                        propsMap.set(key, value);
                    }
                }
            }
            compMap.set('properties', propsMap);
        }

        return compMap;
    }

    /**
     * Find all odeNavStructure elements using multiple strategies
     */
    private findNavStructures(xmlDoc: Document): Element[] {
        // Strategy 1: Direct query
        let structures = this.getElements(xmlDoc, 'odeNavStructure');
        if (structures.length > 0) return structures;

        // Strategy 2: Inside odeNavStructures container
        const container = this.getElement(xmlDoc, 'odeNavStructures');
        if (container) {
            structures = this.getElements(container, 'odeNavStructure');
            if (structures.length > 0) return structures;
        }

        this.logger.warn('[ElpxImporter] No odeNavStructure elements found');
        return [];
    }

    /**
     * Get page ID from nav structure
     */
    private getPageId(navNode: Element): string | null {
        const id = navNode.getAttribute('odeNavStructureId');
        if (id) return this.sanitizeId(id);

        const idEl = this.getElement(navNode, 'odePageId');
        if (idEl) return this.sanitizeId(idEl.textContent);

        return null;
    }

    /**
     * Get parent page ID from nav structure
     */
    private getParentPageId(navNode: Element): string | null {
        const parentId = navNode.getAttribute('parentOdeNavStructureId');
        if (parentId) return this.sanitizeId(parentId);

        const parentEl = this.getElement(navNode, 'odeParentPageId');
        if (parentEl) return this.sanitizeId(parentEl.textContent);

        return null;
    }

    /**
     * Get page name from nav structure
     */
    private getPageName(navNode: Element): string {
        let name = navNode.getAttribute('odePageName');
        if (name) return name;

        name = navNode.getAttribute('pageName');
        if (name) return name;

        const nameEl = this.getElement(navNode, 'pageName');
        if (nameEl?.textContent) return nameEl.textContent;

        const odeNameEl = this.getElement(navNode, 'odePageName');
        if (odeNameEl?.textContent) return odeNameEl.textContent;

        return 'Untitled Page';
    }

    /**
     * Get navigation order from nav structure
     */
    private getNavOrder(navNode: Element): number {
        return this.getOrderValue(navNode, ['odeNavStructureOrder'], 'odeNavStructureOrder');
    }

    /**
     * Generic helper to extract XML properties from a container element
     * Consolidates the common pattern used by page, block, and component property extraction
     *
     * @param parentNode - The parent element containing the properties container
     * @param containerTag - Tag name of the properties container (e.g., 'odeNavStructureProperties')
     * @param propertyTag - Tag name of individual property elements (e.g., 'odeNavStructureProperty')
     * @param defaults - Default property values to use as base
     * @returns Record of extracted properties with defaults applied
     */
    private extractXmlProperties(
        parentNode: Element,
        containerTag: string,
        propertyTag: string,
        defaults: Record<string, unknown>,
    ): Record<string, unknown> {
        const properties: Record<string, unknown> = { ...defaults };

        const propsContainer = this.getElement(parentNode, containerTag);
        if (!propsContainer) return properties;

        const propNodes = this.getElements(propsContainer, propertyTag);
        for (const propNode of propNodes) {
            const key = this.getTextContent(propNode, 'key');
            const value = this.getTextContent(propNode, 'value');
            if (key && value !== null) {
                properties[key] = value === 'true' || value === 'false' ? value === 'true' : value;
            }
        }
        return properties;
    }

    /**
     * Extract page properties from odeNavStructureProperties
     */
    private getNavStructureProperties(navNode: Element): Record<string, unknown> {
        return this.extractXmlProperties(
            navNode,
            'odeNavStructureProperties',
            'odeNavStructureProperty',
            PAGE_PROPERTY_DEFAULTS,
        );
    }

    /**
     * Extract block properties from odePagStructureProperties
     */
    private getPagStructureProperties(pagNode: Element): Record<string, unknown> {
        return this.extractXmlProperties(
            pagNode,
            'odePagStructureProperties',
            'odePagStructureProperty',
            BLOCK_PROPERTY_DEFAULTS,
        );
    }

    /**
     * Extract component properties from odeComponentsProperties
     */
    private getComponentsProperties(compNode: Element): Record<string, unknown> {
        return this.extractXmlProperties(
            compNode,
            'odeComponentsProperties',
            'odeComponentsProperty',
            COMPONENT_PROPERTY_DEFAULTS,
        );
    }

    /**
     * Find odePagStructure elements within a nav structure
     */
    private findPagStructures(navNode: Element): Element[] {
        // Strategy 1: Inside odePagStructures container
        const container = this.getElement(navNode, 'odePagStructures');
        if (container) {
            const structures = this.getElements(container, 'odePagStructure');
            if (structures.length > 0) return structures;
        }

        // Strategy 2: Any descendant
        return this.getElements(navNode, 'odePagStructure');
    }

    /**
     * Generic helper to extract order value from an element
     * Checks multiple attribute names and a child element for the order value
     *
     * @param node - The element to extract order from
     * @param attrNames - Array of attribute names to check (in order of priority)
     * @param childTagName - Child element tag name to check as fallback
     * @returns The order value or 0 if not found
     */
    private getOrderValue(node: Element, attrNames: string[], childTagName: string): number {
        for (const attrName of attrNames) {
            const order = node.getAttribute(attrName);
            if (order) return parseInt(order, 10) || 0;
        }

        const orderEl = this.getElement(node, childTagName);
        if (orderEl) return parseInt(orderEl.textContent || '0', 10) || 0;

        return 0;
    }

    /**
     * Get block order from pag structure
     */
    private getPagOrder(pagNode: Element): number {
        return this.getOrderValue(pagNode, ['odePagStructureOrder'], 'odePagStructureOrder');
    }

    /**
     * Find odeComponent elements within a pag structure
     */
    private findOdeComponents(pagNode: Element): Element[] {
        // Strategy 1: Inside odeComponents container
        const container = this.getElement(pagNode, 'odeComponents');
        if (container) {
            const components = this.getElements(container, 'odeComponent');
            if (components.length > 0) return components;
        }

        // Strategy 2: Any descendant
        return this.getElements(pagNode, 'odeComponent');
    }

    /**
     * Get component order
     */
    private getComponentOrder(compNode: Element): number {
        return this.getOrderValue(compNode, ['odeComponentOrder', 'odeComponentsOrder'], 'odeComponentsOrder');
    }

    /**
     * Import assets from ZIP file
     */
    private async importAssets(zip: Record<string, Uint8Array>): Promise<number> {
        if (!this.assetHandler) {
            this.logger.log('[ElpxImporter] No AssetHandler, skipping asset import');
            return 0;
        }

        // Pass progress callback to report asset extraction progress (10% to 50% range)
        this.assetMap = await this.assetHandler.extractAssetsFromZip(zip, (current, total, _filename) => {
            // Map progress from 10% to 50% (assets phase range)
            const percent = 10 + Math.round((current / total) * 40);
            this.reportProgress('assets', percent, 'Extracting assets...');
        });
        this.logger.log(`[ElpxImporter] Imported ${this.assetMap.size} assets`);

        // Also extract embedded theme files if present
        if (this.assetHandler.extractThemeFromZip) {
            try {
                const themeInfo = await this.assetHandler.extractThemeFromZip(zip);
                if (themeInfo.themeName) {
                    this.logger.log(
                        `[ElpxImporter] Extracted embedded theme: ${themeInfo.themeName} (downloadable: ${themeInfo.downloadable})`,
                    );
                }
            } catch (e) {
                this.logger.warn('[ElpxImporter] Error extracting theme:', e);
            }
        }

        return this.assetMap.size;
    }

    /**
     * Get property value from odeProperties container
     */
    private getPropertyValue(propsContainer: Element, key: string): string | null {
        // Try direct child element with the key name
        const directEl = this.getElement(propsContainer, key);
        if (directEl) return directEl.textContent;

        // Try odeProperty elements
        const props = this.getElements(propsContainer, 'odeProperty');
        for (const prop of props) {
            const keyEl = this.getElement(prop, 'key');
            const valueEl = this.getElement(prop, 'value');
            if (keyEl?.textContent === key && valueEl) {
                return valueEl.textContent;
            }
        }

        return null;
    }

    /**
     * Parse boolean property value from odeProperties container
     */
    private parseBooleanProperty(container: Element, key: string, defaultValue: boolean): boolean {
        const value = this.getPropertyValue(container, key);
        if (value === null || value === undefined || value === '') {
            return defaultValue;
        }
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1') return true;
            if (lower === 'false' || lower === '0') return false;
        }
        return defaultValue;
    }

    /**
     * Helper to extract a string metadata property with a default value
     * Simplifies the common pattern of checking for odeProperties existence
     *
     * @param odeProperties - The odeProperties container element (may be null)
     * @param key - Property key to extract
     * @param defaultValue - Default value if property not found
     * @returns Property value or default
     */
    private getMetadataProperty(odeProperties: Element | null, key: string, defaultValue: string = ''): string {
        if (!odeProperties) return defaultValue;
        return this.getPropertyValue(odeProperties, key) || defaultValue;
    }

    /**
     * Helper to extract a boolean metadata property with a default value
     * Simplifies the common pattern of checking for odeProperties existence
     *
     * @param odeProperties - The odeProperties container element (may be null)
     * @param key - Property key to extract
     * @param defaultValue - Default value if property not found
     * @returns Property value or default
     */
    private getBooleanMetadataProperty(odeProperties: Element | null, key: string, defaultValue: boolean): boolean {
        if (!odeProperties) return defaultValue;
        return this.parseBooleanProperty(odeProperties, key, defaultValue);
    }

    /**
     * Decode HTML-encoded content
     * Note: This is a simplified version for server-side use.
     * The browser version uses a textarea element for more complete decoding.
     */
    private decodeHtmlContent(text: string): string {
        if (!text) return '';

        // Decode common HTML entities
        return text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    }

    /**
     * Get text content from a child element
     */
    private getTextContent(parent: Element, tagName: string): string | null {
        const el = this.getElement(parent, tagName);
        return el ? el.textContent : null;
    }

    /**
     * Generate a unique ID
     */
    private generateId(prefix: string): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 11);
        return `${prefix}-${timestamp}-${random}`;
    }

    /**
     * Sanitize an ID string
     */
    private sanitizeId(id: string | null): string | null {
        if (!id || typeof id !== 'string') return null;
        const sanitized = id.trim();
        return sanitized || null;
    }

    /**
     * Calculate the next available order value at a given parent level
     */
    private getNextAvailableOrder(parentId: string | null): number {
        const navigation = this.getNavigation();
        let maxOrder = -1;

        for (let i = 0; i < navigation.length; i++) {
            const pageMap = navigation.get(i) as Y.Map<unknown>;
            const pageParentId = pageMap.get('parentId');

            const sameLevel = (parentId === null && !pageParentId) || parentId === pageParentId;

            if (sameLevel) {
                const order = (pageMap.get('order') as number) ?? 0;
                if (order > maxOrder) {
                    maxOrder = order;
                }
            }
        }

        return maxOrder + 1;
    }

    /**
     * Recursively convert {{context_path}} references and resources/ paths to asset:// URLs in an object
     */
    private convertAssetPathsInObject(obj: unknown): unknown {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj === 'string') {
            // Handle {{context_path}}/... references (in HTML content)
            if (obj.includes('{{context_path}}') && this.assetHandler) {
                return this.assetHandler.convertContextPathToAssetRefs(obj, this.assetMap);
            }

            // Handle resources/filename.jpg paths (legacy gallery/iDevice properties)
            // These are just path strings, not HTML, so we look them up directly
            if (obj.startsWith('resources/') && this.assetMap.size > 0) {
                const assetUrl = this.findAssetUrlForPath(obj);
                if (assetUrl) {
                    return assetUrl;
                }
            }

            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.convertAssetPathsInObject(item));
        }

        if (typeof obj === 'object') {
            const result: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = this.convertAssetPathsInObject(value);
            }
            return result;
        }

        return obj;
    }

    /**
     * Find asset URL for a given path, trying various lookup strategies
     * Handles legacy ELP files where assets are at root level (just filename in assetMap)
     * but referenced with resources/ prefix in iDevice properties
     */
    private findAssetUrlForPath(assetPath: string): string | null {
        // Helper to generate new format asset URL: asset://uuid.ext
        const buildAssetUrl = (assetId: string, filename: string): string => {
            const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';
            return ext ? `asset://${assetId}.${ext}` : `asset://${assetId}`;
        };

        // Try exact match first
        if (this.assetMap.has(assetPath)) {
            const assetId = this.assetMap.get(assetPath)!;
            const filename = assetPath.split('/').pop() || '';
            return buildAssetUrl(assetId, filename);
        }

        // Try without resources/ prefix (legacy format stores assets at root)
        if (assetPath.startsWith('resources/')) {
            const pathWithoutPrefix = assetPath.substring('resources/'.length);
            if (this.assetMap.has(pathWithoutPrefix)) {
                const assetId = this.assetMap.get(pathWithoutPrefix)!;
                const filename = pathWithoutPrefix.split('/').pop() || '';
                return buildAssetUrl(assetId, filename);
            }
        }

        // Try matching just the filename
        const filename = assetPath.split('/').pop();
        if (filename) {
            for (const [path, assetId] of this.assetMap.entries()) {
                if (path === filename || path.endsWith('/' + filename)) {
                    return buildAssetUrl(assetId, filename);
                }
            }
        }

        return null;
    }
}

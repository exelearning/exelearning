/**
 * BaseExporter
 *
 * Abstract base class for all export implementations.
 * Uses dependency injection for document, resources, and assets,
 * enabling the same export logic to work in both browser and server environments.
 */

import type {
    ExportDocument,
    ExportPage,
    ExportMetadata,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ExportOptions,
    ExportResult,
} from '../interfaces';
import { IdeviceRenderer } from '../renderers/IdeviceRenderer';
import { PageRenderer } from '../renderers/PageRenderer';
import { LibraryDetector } from '../utils/LibraryDetector';
import { generateOdeXml } from '../generators/OdeXmlGenerator';
import { deriveFilenameFromMime, getExtensionFromMimeType } from '../../../config';

/**
 * Abstract base class for exporters
 *
 * Provides common utilities for:
 * - Structure access (pages, blocks, components)
 * - String utilities (escaping, sanitizing)
 * - Navigation helpers
 * - Asset URL transformation
 */
export abstract class BaseExporter {
    protected document: ExportDocument;
    protected resources: ResourceProvider;
    protected assets: AssetProvider;
    protected zip: ZipProvider;

    protected ideviceRenderer: IdeviceRenderer;
    protected pageRenderer: PageRenderer;
    protected libraryDetector: LibraryDetector;

    // Cache for asset filename lookups
    protected assetFilenameMap: Map<string, string> | null = null;
    // Cache for asset export path lookups (folderPath-based)
    protected assetExportPathMap: Map<string, string> | null = null;

    constructor(document: ExportDocument, resources: ResourceProvider, assets: AssetProvider, zip: ZipProvider) {
        this.document = document;
        this.resources = resources;
        this.assets = assets;
        this.zip = zip;

        // Initialize renderers and detector
        this.ideviceRenderer = new IdeviceRenderer();
        this.pageRenderer = new PageRenderer(this.ideviceRenderer);
        this.libraryDetector = new LibraryDetector();
    }

    // =========================================================================
    // Abstract Methods (must be implemented by subclasses)
    // =========================================================================

    /**
     * Export the project - must be implemented by subclasses
     */
    abstract export(options?: ExportOptions): Promise<ExportResult>;

    /**
     * Get file extension for this export format (e.g., '.zip', '.epub')
     */
    abstract getFileExtension(): string;

    /**
     * Get file suffix for this export format (e.g., '_web', '_scorm')
     */
    abstract getFileSuffix(): string;

    // =========================================================================
    // i18n Content Generation
    // =========================================================================

    /**
     * Fetch the pre-built, pre-translated `common_i18n.js` content for the given language.
     * The file is generated at build time by `scripts/build-i18n-bundles.js` and contains
     * resolved string literals (no c_() calls) ready to include in the export ZIP.
     */
    protected async generateI18nContent(language: string): Promise<string> {
        return this.resources.fetchI18nFile(language);
    }

    /**
     * Fetch translated labels for the navigation buttons (Previous / Next).
     * Labels are resolved from XLF translations so the exported HTML already
     * contains the correct text for the content language — no runtime JS needed.
     */
    protected async fetchNavLabels(language: string): Promise<{ previous: string; next: string }> {
        const translations = await this.resources.fetchI18nTranslations(language);
        return {
            previous: translations.get('Previous') || 'Previous',
            next: translations.get('Next') || 'Next',
        };
    }

    // =========================================================================
    // Structure Access Methods
    // =========================================================================

    /**
     * Get project metadata
     */
    getMetadata(): ExportMetadata {
        return this.document.getMetadata();
    }

    /**
     * Get navigation structure (pages)
     */
    getNavigation(): ExportPage[] {
        return this.document.getNavigation();
    }

    /**
     * Build a flat list of pages from the navigation structure
     */
    buildPageList(): ExportPage[] {
        return this.getNavigation();
    }

    /**
     * Get list of unique iDevice types used in the project
     */
    getUsedIdevices(pages: ExportPage[]): string[] {
        const types = new Set<string>();

        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.type) {
                        types.add(component.type);
                    }
                }
            }
        }

        return Array.from(types);
    }

    /**
     * Get list of iDevice types used in a specific page
     */
    getUsedIdevicesForPage(page: ExportPage): string[] {
        const types = new Set<string>();

        for (const block of page.blocks || []) {
            for (const component of block.components || []) {
                if (component.type) {
                    types.add(component.type);
                }
            }
        }

        return Array.from(types);
    }

    /**
     * Get root pages (pages without parent)
     */
    getRootPages(pages: ExportPage[]): ExportPage[] {
        return pages.filter(p => !p.parentId);
    }

    /**
     * Get child pages of a given page
     */
    getChildPages(parentId: string, pages: ExportPage[]): ExportPage[] {
        return pages.filter(p => p.parentId === parentId);
    }

    // =========================================================================
    // Visibility Helpers
    // =========================================================================

    /**
     * Check if a page is visible in export
     * A page is visible if:
     * 1. It is the root page (always visible)
     * 2. Its visibility property is not set to false/ 'false'
     * 3. All its ancestors are visible
     */
    isPageVisible(page: ExportPage, allPages: ExportPage[]): boolean {
        // Root page (index 0) is always visible
        if (page.id === allPages[0]?.id) {
            return true;
        }

        // Check explicit visibility property
        const visibility = page.properties?.visibility;
        if (visibility === false || visibility === 'false') {
            return false;
        }

        // Check ancestor visibility
        if (page.parentId) {
            const parent = allPages.find(p => p.id === page.parentId);
            // If parent exists and is not visible, this page is not visible
            // Recursive check handles the entire hierarchy
            if (parent && !this.isPageVisible(parent, allPages)) {
                return false;
            }
        }

        return true;
    }

    // =========================================================================
    // String Utilities
    // =========================================================================

    /**
     * Escape XML special characters
     */
    escapeXml(str: string | null | undefined): string {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Escape content for use in CDATA sections
     * CDATA cannot contain the sequence ]]> as it closes the CDATA block.
     * We split it into multiple CDATA sections when this sequence appears.
     */
    escapeCdata(str: string | null | undefined): string {
        if (!str) return '';
        // Replace ]]> with ]]]]><![CDATA[> to split the CDATA section
        return String(str).replace(/\]\]>/g, ']]]]><![CDATA[>');
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(str: string | null | undefined): string {
        if (!str) return '';
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Sanitize string for use as filename (with accent normalization)
     */
    sanitizeFilename(str: string | null | undefined, maxLength = 50): string {
        if (!str) return 'export';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, maxLength);
    }

    /**
     * Sanitize page title for use as filename (with accent normalization)
     */
    sanitizePageFilename(title: string | null | undefined): string {
        if (!title) return 'page';
        return title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    }

    /**
     * Generate unique identifier with optional prefix
     */
    generateId(prefix = ''): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}${timestamp}${random}`.toUpperCase();
    }

    // =========================================================================
    // File Handling
    // =========================================================================

    /**
     * Build export filename from metadata
     */
    buildFilename(): string {
        const meta = this.getMetadata();
        const title = meta.title || 'export';
        const sanitized = this.sanitizeFilename(title);
        return `${sanitized}${this.getFileSuffix()}${this.getFileExtension()}`;
    }

    /**
     * Add assets to ZIP
     */
    async addAssetsToZip(prefix = ''): Promise<number> {
        let assetsAdded = 0;

        try {
            const assets = await this.assets.getAllAssets();

            for (const asset of assets) {
                const assetId = asset.id;
                const filename = asset.filename || `asset-${assetId}`;
                // Use originalPath if available, otherwise construct from id/filename
                const assetPath = asset.originalPath || `${assetId}/${filename}`;
                const zipPath = prefix ? `${prefix}${assetPath}` : assetPath;

                this.zip.addFile(zipPath, asset.data);
                assetsAdded++;
            }
        } catch (e) {
            console.warn('[BaseExporter] Failed to add assets to ZIP:', e);
        }

        return assetsAdded;
    }

    /**
     * Add assets to ZIP with content/resources/ prefix
     * Uses folderPath-based structure for cleaner exports
     * @param trackingList - Optional array to track added file paths (for ELPX manifest)
     */
    async addAssetsToZipWithResourcePath(trackingList?: string[] | null): Promise<number> {
        let assetsAdded = 0;

        try {
            const assets = await this.assets.getAllAssets();
            const exportPathMap = await this.buildAssetExportPathMap();

            for (const asset of assets) {
                const exportPath = exportPathMap.get(asset.id);
                if (!exportPath) {
                    console.warn(`[BaseExporter] No export path for asset: ${asset.id}`);
                    continue;
                }

                // Store in content/resources/{exportPath}
                const zipPath = `content/resources/${exportPath}`;

                this.zip.addFile(zipPath, asset.data);
                if (trackingList) trackingList.push(zipPath);
                assetsAdded++;
            }
        } catch (e) {
            console.warn('[BaseExporter] Failed to add assets to ZIP:', e);
        }

        return assetsAdded;
    }

    // =========================================================================
    // Navigation Helpers
    // =========================================================================

    /**
     * Check if a page is an ancestor of another page
     */
    isAncestorOf(potentialAncestor: ExportPage, childId: string, allPages: ExportPage[]): boolean {
        const child = allPages.find(p => p.id === childId);
        if (!child || !child.parentId) return false;
        if (child.parentId === potentialAncestor.id) return true;
        return this.isAncestorOf(potentialAncestor, child.parentId, allPages);
    }

    /**
     * Get page link (index.html for first page, id.html for others)
     */
    getPageLink(page: ExportPage, allPages: ExportPage[], extension = '.html'): string {
        if (page.id === allPages[0]?.id) {
            return `index${extension}`;
        }
        return `${page.id}${extension}`;
    }

    /**
     * Get previous page in flat list
     */
    getPreviousPage(currentPage: ExportPage, allPages: ExportPage[]): ExportPage | null {
        const currentIndex = allPages.findIndex(p => p.id === currentPage.id);
        return currentIndex > 0 ? allPages[currentIndex - 1] : null;
    }

    /**
     * Get next page in flat list
     */
    getNextPage(currentPage: ExportPage, allPages: ExportPage[]): ExportPage | null {
        const currentIndex = allPages.findIndex(p => p.id === currentPage.id);
        return currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
    }

    // =========================================================================
    // Asset URL Transformation
    // =========================================================================

    /**
     * Get file extension from MIME type
     */
    getExtensionFromMime(mime: string): string {
        return getExtensionFromMimeType(mime, true);
    }

    /**
     * Build asset filename map for URL transformation
     */
    async buildAssetFilenameMap(): Promise<Map<string, string>> {
        if (this.assetFilenameMap) {
            return this.assetFilenameMap;
        }

        this.assetFilenameMap = new Map<string, string>();

        try {
            const assets = await this.assets.getAllAssets();

            for (const asset of assets) {
                const id = asset.id;
                let filename = asset.filename;

                if (!filename) {
                    // Generate filename from mime type
                    const ext = this.getExtensionFromMime(asset.mime || 'application/octet-stream');
                    filename = `asset-${id.substring(0, 8)}${ext}`;
                }

                this.assetFilenameMap.set(id, filename);
            }
        } catch (e) {
            console.warn('[BaseExporter] Failed to build asset map:', e);
        }

        return this.assetFilenameMap;
    }

    /**
     * Build asset export path map for URL transformation
     * Uses folderPath instead of UUID for cleaner export structure
     * Handles filename collisions by appending counter
     *
     * @returns Map of asset UUID to export path (e.g., "images/photo.jpg" or "photo.jpg" for root)
     */
    async buildAssetExportPathMap(): Promise<Map<string, string>> {
        if (this.assetExportPathMap) {
            return this.assetExportPathMap;
        }

        this.assetExportPathMap = new Map<string, string>();
        const usedPaths = new Set<string>();

        try {
            const assets = await this.assets.getAllAssets();

            for (const asset of assets) {
                let folderPath = asset.folderPath || '';
                // Treat 'unknown' same as missing: derive a proper name with extension from MIME
                const filename =
                    asset.filename && asset.filename !== 'unknown'
                        ? asset.filename
                        : this._deriveFilenameFromMime(asset.id, asset.mime);

                // Fix duplicated filename pattern: if folderPath equals filename or ends with /filename,
                // the asset has been incorrectly stored with duplicated path (e.g., "file.pdf/file.pdf")
                // This can happen from corrupted ELPX files or bugs in asset saving
                if (folderPath === filename) {
                    // folderPath equals filename - remove the duplication
                    folderPath = '';
                } else if (folderPath.endsWith(`/${filename}`)) {
                    // folderPath ends with /filename - remove the trailing duplicate
                    folderPath = folderPath.slice(0, -(filename.length + 1));
                }

                const basePath = folderPath ? `${folderPath}/${filename}` : filename;

                // Handle filename collisions (case-insensitive for Windows compatibility)
                let finalPath = basePath;
                let counter = 1;
                while (usedPaths.has(finalPath.toLowerCase())) {
                    const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';
                    const nameWithoutExt = ext ? filename.slice(0, -ext.length) : filename;
                    finalPath = folderPath
                        ? `${folderPath}/${nameWithoutExt}_${counter}${ext}`
                        : `${nameWithoutExt}_${counter}${ext}`;
                    counter++;
                }

                usedPaths.add(finalPath.toLowerCase());
                this.assetExportPathMap.set(asset.id, finalPath);
            }
        } catch (e) {
            console.warn('[BaseExporter] Failed to build asset export path map:', e);
        }

        return this.assetExportPathMap;
    }

    /**
     * Derive a fallback export filename from MIME type and asset ID.
     * Used when an asset has no filename or has the placeholder value 'unknown'.
     */
    private _deriveFilenameFromMime(assetId: string, mime: string): string {
        return deriveFilenameFromMime(assetId, mime);
    }

    /**
     * Convert asset:// URLs directly to {{context_path}}/content/resources/ format
     * for XML export. This is the single transformation step.
     *
     * Supported input formats:
     * - asset://uuid.ext (new format with extension)
     * - asset://uuid (simple UUID without extension)
     *
     * Output: {{context_path}}/content/resources/{exportPath}
     *
     * Also fixes duplicated filename patterns that may exist in content
     * (e.g., content/resources/file.pdf/file.pdf → content/resources/file.pdf)
     */
    async addFilenamesToAssetUrls(content: string): Promise<string> {
        if (!content) return '';

        const assetMap = await this.buildAssetExportPathMap();

        // Transform asset://uuid or asset://uuid.ext to {{context_path}}/content/resources/path
        // Pattern matches: asset:// + 36-char UUID + optional extension
        let result = content.replace(/asset:\/\/([a-f0-9-]{36})(\.[a-z0-9]+)?/gi, (_match, uuid, ext) => {
            const exportPath = assetMap.get(uuid);
            if (exportPath) {
                // Resolved: use the proper export path from metadata
                return `{{context_path}}/content/resources/${exportPath}`;
            }
            // Unresolved: preserve UUID as filename for debugging
            return `{{context_path}}/content/resources/${uuid}${ext || ''}`;
        });

        // Transform asset://filename or asset://path/filename to {{context_path}}/content/resources/path
        // Pattern matches: asset:// + filename with optional path (NOT a 36-char UUID)
        // This handles filename-based asset IDs from legacy ELP imports
        result = result.replace(/asset:\/\/([^"'\s]+)/g, (_match, assetPath) => {
            // Skip if already processed (UUID format was already transformed)
            if (assetPath.includes('{{context_path}}')) {
                return _match;
            }

            // Look up in asset map using different key formats
            const exportPath = assetMap.get(assetPath) || assetMap.get(`resources/${assetPath}`);
            if (exportPath) {
                return `{{context_path}}/content/resources/${exportPath}`;
            }

            // For simple filenames, try direct lookup and use as-is
            const filename = assetPath.includes('/') ? assetPath.split('/').pop() : assetPath;
            const filenameExportPath = assetMap.get(filename);
            if (filenameExportPath) {
                return `{{context_path}}/content/resources/${filenameExportPath}`;
            }

            // Unresolved: use the asset path as-is
            return `{{context_path}}/content/resources/${assetPath}`;
        });

        // Fix duplicated filename patterns in existing content
        // Pattern: content/resources/{filename}/{filename} where both filenames are identical
        // This handles cases where the duplication is already in the source content.xml
        result = result.replace(/content\/resources\/([^/"]+)\/\1(?=["'\s>])/g, 'content/resources/$1');

        return result;
    }

    /**
     * Pre-process pages to add filenames to asset URLs in all component content
     * And converts internal links (exe-node:) to proper page URLs
     *
     * Note: exe-package:elp protocol transformation is now done in PageRenderer.renderPageContent()
     * so the XML content keeps the original protocol for re-import compatibility
     */
    async preprocessPagesForExport(pages: ExportPage[]): Promise<ExportPage[]> {
        // Deep clone pages to avoid mutating the original document
        // This ensures multiple exports on the same document work correctly
        const clonedPages: ExportPage[] = JSON.parse(JSON.stringify(pages));

        // Build page URL map for internal link conversion
        const pageUrlMap = this.buildPageUrlMap(clonedPages);

        for (let pageIndex = 0; pageIndex < clonedPages.length; pageIndex++) {
            const page = clonedPages[pageIndex];
            const isIndex = pageIndex === 0;

            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.content) {
                        // Add filenames to asset URLs in content
                        component.content = await this.addFilenamesToAssetUrls(component.content);
                        // Convert internal links to proper page URLs
                        component.content = this.replaceInternalLinks(component.content, pageUrlMap, isIndex);
                    }
                    // Also process properties (jsonProperties may contain asset URLs)
                    if (component.properties && Object.keys(component.properties).length > 0) {
                        const propsStr = JSON.stringify(component.properties);
                        const processedStr = await this.addFilenamesToAssetUrls(propsStr);
                        component.properties = JSON.parse(processedStr);
                    }
                }
            }
        }
        return clonedPages;
    }

    /**
     * Build a map of page IDs to unique filenames
     * Handles collisions by incrementing trailing numbers or appending -1, -2, etc.
     * First page is always index.html, others are {sanitized-title}.html
     *
     * For filenames ending with a number (e.g., "new-page-1"), collisions increment
     * that number (e.g., "new-page-2", "new-page-3") instead of appending another number.
     */
    protected buildPageFilenameMap(pages: ExportPage[]): Map<string, string> {
        const filenameMap = new Map<string, string>();
        const usedFilenames = new Set<string>();
        const maxAttempts = 20;

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];

            if (i === 0) {
                // First page is always index.html
                filenameMap.set(page.id, 'index.html');
                usedFilenames.add('index.html');
                continue;
            }

            const baseFilename = this.sanitizePageFilename(page.title);
            let filename = `${baseFilename}.html`;

            if (usedFilenames.has(filename)) {
                // Check if filename ends with a number pattern (e.g., "page-1" or "page1")
                const match = baseFilename.match(/^(.*?)-?(\d+)$/);

                if (match) {
                    // Has trailing number: increment from that number
                    const base = match[1] ? `${match[1]}-` : '';
                    const startNum = parseInt(match[2], 10);
                    let counter = startNum + 1;

                    while (counter <= startNum + maxAttempts) {
                        filename = `${base}${counter}.html`;
                        if (!usedFilenames.has(filename)) break;
                        counter++;
                    }
                } else {
                    // No trailing number: append -2, -3, etc. (first page is implicitly "1")
                    let counter = 2;
                    while (usedFilenames.has(filename) && counter <= maxAttempts + 1) {
                        filename = `${baseFilename}-${counter}.html`;
                        counter++;
                    }
                }
            }

            usedFilenames.add(filename);
            filenameMap.set(page.id, filename);
        }

        return filenameMap;
    }

    /**
     * Build a map of page IDs to their export URLs
     * Used for internal link (exe-node:) conversion
     */
    protected buildPageUrlMap(pages: ExportPage[]): Map<string, { url: string; urlFromSubpage: string }> {
        const map = new Map<string, { url: string; urlFromSubpage: string }>();
        const filenameMap = this.buildPageFilenameMap(pages);

        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const filename = filenameMap.get(page.id) || 'page.html';
            const isFirstPage = i === 0;

            if (isFirstPage) {
                // First page is index.html
                map.set(page.id, {
                    url: 'index.html',
                    urlFromSubpage: '../index.html',
                });
            } else {
                // Other pages are in html/ directory
                map.set(page.id, {
                    url: `html/${filename}`,
                    urlFromSubpage: filename,
                });
            }
        }

        return map;
    }

    /**
     * Replace exe-node: internal links with proper page URLs
     *
     * @param content - HTML content
     * @param pageUrlMap - Map of page IDs to their export URLs
     * @param isFromIndex - Whether the content is from the index page (affects relative paths)
     * @returns Content with internal links replaced
     */
    protected replaceInternalLinks(
        content: string,
        pageUrlMap: Map<string, { url: string; urlFromSubpage: string }>,
        isFromIndex: boolean,
    ): string {
        if (!content || !content.includes('exe-node:')) {
            return content;
        }

        // Replace href="exe-node:pageId" with actual page URLs
        return content.replace(/href=["']exe-node:([^"']+)["']/gi, (match, pageId) => {
            const pageUrls = pageUrlMap.get(pageId);
            if (pageUrls) {
                // Use the appropriate URL based on whether we're on index or subpage
                const url = isFromIndex ? pageUrls.url : pageUrls.urlFromSubpage;
                return `href="${url}"`;
            }
            // If page not found, leave the link unchanged (might be an external link or error)
            console.warn(`[BaseExporter] Internal link target not found: ${pageId}`);
            return match;
        });
    }

    /**
     * Replace exe-package:elp protocol with client-side download handler
     * This enables the download-source-file iDevice to generate ELPX files on-the-fly
     *
     * @param content - HTML content
     * @param projectTitle - Project title for the download filename
     * @returns Content with exe-package:elp replaced with onclick handler
     */
    replaceElpxProtocol(content: string, projectTitle: string): string {
        if (!content) return '';

        // Check if content contains the exe-package:elp protocol
        if (!content.includes('exe-package:elp')) {
            return content;
        }

        // Replace href="exe-package:elp" with onclick handler
        // Uses <a onclick> approach for styling compatibility
        let result = content.replace(
            /href="exe-package:elp"/g,
            'href="#" onclick="if(typeof downloadElpx===\'function\')downloadElpx();return false;"',
        );

        // Replace download="exe-package:elp-name" with actual filename
        const safeTitle = this.escapeXml(projectTitle);
        result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);

        return result;
    }

    /**
     * Collect all HTML content from all pages (for library detection)
     */
    collectAllHtmlContent(pages: ExportPage[]): string {
        const htmlParts: string[] = [];

        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.content) {
                        htmlParts.push(component.content);
                    }
                }
            }
        }

        return htmlParts.join('\n');
    }

    // =========================================================================
    // Download Source File iDevice Detection
    // =========================================================================

    /**
     * Check if any page contains the download-source-file iDevice
     * (needs ELPX manifest for client-side ZIP recreation)
     */
    protected needsElpxDownloadSupport(pages: ExportPage[]): boolean {
        return pages.some(page => this.pageHasDownloadSourceFile(page));
    }

    /**
     * Check if a specific page contains the download-source-file iDevice
     * or a manual link using exe-package:elp protocol
     */
    protected pageHasDownloadSourceFile(page: ExportPage): boolean {
        for (const block of page.blocks || []) {
            for (const component of block.components || []) {
                // Check by iDevice type
                const type = (component.type || '').toLowerCase();
                if (type.includes('download-source-file') || type.includes('downloadsourcefile')) {
                    return true;
                }
                // Check content for the CSS class (download-source-file iDevice)
                if (component.content?.includes('exe-download-package-link')) {
                    return true;
                }
                // Check for manual exe-package:elp links (in text iDevices, etc.)
                if (component.content?.includes('exe-package:elp')) {
                    return true;
                }
            }
        }
        return false;
    }

    // =========================================================================
    // ELPX Manifest Generation (for download-source-file iDevice)
    // =========================================================================

    /**
     * Generate ELPX manifest as a standalone JS file
     * Used for HTML5 exports where the manifest is a separate file
     *
     * @param fileList - List of file paths in the export
     * @returns JavaScript file content
     */
    protected generateElpxManifestFile(fileList: string[]): string {
        const manifest = {
            version: 1,
            files: fileList,
            projectTitle: this.getMetadata().title || 'eXeLearning-project',
        };

        return `/**
 * ELPX Manifest - Auto-generated for download-source-file iDevice
 * Used by exe_elpx_download.js to recreate the complete export package
 */
window.__ELPX_MANIFEST__=${JSON.stringify(manifest, null, 2)};
`;
    }

    // =========================================================================
    // Content XML Generation (for re-import capability)
    // =========================================================================

    /**
     * Generate content.xml from document structure
     * Uses unified OdeXmlGenerator for consistent output across all exporters
     *
     * @param preprocessedPages - Optional preprocessed pages (with asset URLs already transformed).
     *                            If not provided, uses raw navigation from document.
     */
    generateContentXml(preprocessedPages?: ExportPage[]): string {
        const metadata = this.getMetadata();
        const pages = preprocessedPages || this.getNavigation();
        return generateOdeXml(metadata, pages);
    }

    // =========================================================================
    // Fallback Styles (used when resources can't be fetched)
    // =========================================================================

    /**
     * Get fallback theme CSS
     */
    getFallbackThemeCss(): string {
        return `/* Default theme CSS */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}
`;
    }

    /**
     * Get fallback theme JS
     */
    getFallbackThemeJs(): string {
        return `// Default theme JS
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Theme initialization
    console.log('[Theme] Default theme loaded');
  });
})();
`;
    }
}

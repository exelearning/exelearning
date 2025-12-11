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
    ExportBlock,
    ExportComponent,
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
     * Sanitize string for use as filename
     */
    sanitizeFilename(str: string | null | undefined, maxLength = 50): string {
        if (!str) return 'export';
        return str
            .toLowerCase()
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
     */
    async addAssetsToZipWithResourcePath(): Promise<number> {
        let assetsAdded = 0;

        try {
            const assets = await this.assets.getAllAssets();

            for (const asset of assets) {
                // Use originalPath if available
                // Strip content/resources/ prefix if present (ELP files include it)
                let assetPath = asset.originalPath || `${asset.id}/${asset.filename || `asset-${asset.id}`}`;

                // Normalize: remove content/resources/ prefix if already present
                if (assetPath.startsWith('content/resources/')) {
                    assetPath = assetPath.substring('content/resources/'.length);
                }
                if (assetPath.startsWith('content/')) {
                    assetPath = assetPath.substring('content/'.length);
                }

                // Store in content/resources/{path}
                const zipPath = `content/resources/${assetPath}`;

                this.zip.addFile(zipPath, asset.data);
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
        const mimeToExt: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/svg+xml': '.svg',
            'image/bmp': '.bmp',
            'image/tiff': '.tiff',
            'image/x-icon': '.ico',
            'application/pdf': '.pdf',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/ogg': '.ogv',
            'video/quicktime': '.mov',
            'audio/mpeg': '.mp3',
            'audio/ogg': '.ogg',
            'audio/wav': '.wav',
            'audio/webm': '.weba',
            'application/zip': '.zip',
            'application/json': '.json',
            'text/plain': '.txt',
            'text/html': '.html',
            'text/css': '.css',
            'application/javascript': '.js',
            'application/octet-stream': '.bin',
        };
        return mimeToExt[mime] || '.bin';
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
                    const ext = this.getExtensionFromMime(asset.mimeType || 'application/octet-stream');
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
     * Add filenames to asset:// URLs without changing the protocol
     * Transforms asset://uuid to asset://uuid/filename.ext
     */
    async addFilenamesToAssetUrls(content: string): Promise<string> {
        if (!content) return '';

        const assetMap = await this.buildAssetFilenameMap();
        if (assetMap.size === 0) {
            return content;
        }

        // Transform asset://uuid to asset://uuid/filename (keeping asset:// protocol)
        return content.replace(/asset:\/\/([a-f0-9-]+)(?![/a-zA-Z0-9._-])/gi, (match, uuid) => {
            const filename = assetMap.get(uuid);
            if (filename) {
                return `asset://${uuid}/${filename}`;
            }
            return match;
        });
    }

    /**
     * Pre-process pages to add filenames to asset URLs in all component content
     */
    async preprocessPagesForExport(pages: ExportPage[]): Promise<ExportPage[]> {
        for (const page of pages) {
            for (const block of page.blocks || []) {
                for (const component of block.components || []) {
                    if (component.content) {
                        component.content = await this.addFilenamesToAssetUrls(component.content);
                    }
                }
            }
        }
        return pages;
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
    // Content XML Generation (for re-import capability)
    // =========================================================================

    /**
     * Generate content.xml from document structure
     */
    generateContentXml(): string {
        const metadata = this.getMetadata();
        const pages = this.getNavigation();

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
        xml += this.generatePropertiesXml(metadata);
        xml += '<odeNavStructures>\n';

        for (let i = 0; i < pages.length; i++) {
            xml += this.generatePageXml(pages[i], i);
        }

        xml += '</odeNavStructures>\n';
        xml += '</ode>';
        return xml;
    }

    /**
     * Generate properties XML section
     */
    protected generatePropertiesXml(metadata: ExportMetadata): string {
        let xml = '<odeProperties>\n';
        const props: Record<string, string> = {
            pp_title: metadata.title || 'Untitled',
            pp_author: metadata.author || '',
            pp_lang: metadata.language || 'en',
            pp_description: metadata.description || '',
            pp_license: metadata.license || '',
            pp_theme: metadata.theme || 'base',
        };

        for (const [key, value] of Object.entries(props)) {
            xml += `  <${key}>${this.escapeXml(value)}</${key}>\n`;
        }

        xml += '</odeProperties>\n';
        return xml;
    }

    /**
     * Generate page XML
     */
    protected generatePageXml(page: ExportPage, index: number): string {
        const pageId = page.id;
        const pageName = page.title || 'Page';
        const parentId = page.parentId || '';
        const order = page.order ?? index;

        let xml = `<odeNavStructure odeNavStructureId="${this.escapeXml(pageId)}" `;
        xml += `odePageName="${this.escapeXml(pageName)}" odeNavStructureOrder="${order}" `;
        if (parentId) {
            xml += `parentOdeNavStructureId="${this.escapeXml(parentId)}" `;
        }
        xml += `>\n`;

        for (let i = 0; i < (page.blocks || []).length; i++) {
            xml += this.generateBlockXml(page.blocks![i], i);
        }

        xml += '</odeNavStructure>\n';
        return xml;
    }

    /**
     * Generate block XML
     */
    protected generateBlockXml(block: ExportBlock, index: number): string {
        const blockId = block.id;
        const blockName = block.name || 'Block';
        const order = block.order ?? index;

        let xml = `  <odePagStructure odePagStructureId="${this.escapeXml(blockId)}" `;
        xml += `blockName="${this.escapeXml(blockName)}" odePagStructureOrder="${order}">\n`;

        for (let i = 0; i < (block.components || []).length; i++) {
            xml += this.generateComponentXml(block.components![i], i);
        }

        xml += '  </odePagStructure>\n';
        return xml;
    }

    /**
     * Generate component XML
     */
    protected generateComponentXml(component: ExportComponent, index: number): string {
        const compId = component.id;
        const ideviceType = component.type || 'FreeTextIdevice';
        const order = component.order ?? index;

        let xml = `    <odeComponent odeComponentId="${this.escapeXml(compId)}" `;
        xml += `odeIdeviceTypeDirName="${this.escapeXml(ideviceType)}" odeComponentOrder="${order}">\n`;

        if (component.content) {
            xml += `      <htmlView><![CDATA[${component.content}]]></htmlView>\n`;
        }

        if (component.properties && Object.keys(component.properties).length > 0) {
            xml += `      <jsonProperties><![CDATA[${JSON.stringify(component.properties)}]]></jsonProperties>\n`;
        }

        xml += '    </odeComponent>\n';
        return xml;
    }

    // =========================================================================
    // Fallback Styles (used when resources can't be fetched)
    // =========================================================================

    /**
     * Get base CSS content
     */
    getBaseCss(): string {
        return `.exe-content{
  background: #fff;
}
.exe-content .page-title{
  font-size: 1.45em;
}
.exe-content .box{
  margin-top: 20px;
  border: 1px solid #dbdbdb;
}
.exe-content a{
  color: #5a7f0c;
}
.exe-content a:hover,
.exe-content a:focus{
  color: #71a300;
}
.exe-content h2{ font-size: 1.45em; }
.exe-content h3{ font-size: 1.35em; }
.exe-content h4{ font-size: 1.25em; }
.exe-content h5{ font-size: 1.15em; }

/* iDevice styles */
.iDevice_wrapper {
  margin-bottom: 25px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: #fff;
}
.iDevice_content {
  line-height: 1.8;
}
.iDevice_content img {
  max-width: 100%;
  height: auto;
}

/* Navigation */
#siteNav {
  background: #34495e;
  color: #fff;
  padding: 15px 20px;
  min-width: 220px;
}
#siteNav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
#siteNav li {
  margin: 5px 0;
}
#siteNav a {
  color: #ecf0f1;
  text-decoration: none;
  display: block;
  padding: 5px 10px;
  border-radius: 4px;
}
#siteNav a:hover {
  background: rgba(255,255,255,0.1);
}
#siteNav .active > a,
#siteNav a.active {
  background: #3498db;
  font-weight: bold;
}
#siteNav ul ul {
  padding-left: 15px;
}

/* Pagination */
.pagination {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}
.pagination a {
  color: #3498db;
  text-decoration: none;
}
.pagination a:hover {
  text-decoration: underline;
}

/* Footer */
#packageLicense {
  margin-top: 30px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9em;
  color: #666;
}

/* Responsive */
@media (min-width: 768px) {
  .exe-content {
    display: flex;
    flex-direction: row;
  }
  #siteNav {
    width: 250px;
    flex-shrink: 0;
  }
  main.page {
    flex: 1;
    padding: 20px 30px;
    max-width: 900px;
  }
}
`;
    }

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

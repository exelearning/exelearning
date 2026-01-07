/**
 * Epub3Exporter
 *
 * Exports a document to EPUB3 ebook format.
 * Generates a standards-compliant EPUB3 archive with:
 * - mimetype (first entry, uncompressed)
 * - META-INF/container.xml
 * - EPUB/package.opf (OPF manifest)
 * - EPUB/nav.xhtml (navigation document)
 * - EPUB/*.xhtml (content pages)
 * - Assets, themes, and libraries
 *
 * EPUB3 is a ZIP archive with specific structure requirements.
 * Pages are XHTML (not HTML5) with self-closing void elements.
 */

import type { ExportPage, ExportMetadata, ExportOptions, ExportResult, Epub3ExportOptions } from '../interfaces';
import { BaseExporter } from './BaseExporter';

/**
 * EPUB3 XML namespaces
 */
export const EPUB3_NAMESPACES = {
    OPF: 'http://www.idpf.org/2007/opf',
    DC: 'http://purl.org/dc/elements/1.1/',
    XHTML: 'http://www.w3.org/1999/xhtml',
    EPUB: 'http://www.idpf.org/2007/ops',
    CONTAINER: 'urn:oasis:names:tc:opendocument:xmlns:container',
} as const;

/**
 * EPUB3 MIME type
 */
export const EPUB3_MIMETYPE = 'application/epub+zip';

/**
 * Void HTML elements that must be self-closed in XHTML
 */
const VOID_ELEMENTS = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
];

/**
 * MIME types for EPUB manifest
 */
const MIME_TYPES: Record<string, string> = {
    '.xhtml': 'application/xhtml+xml',
    '.html': 'application/xhtml+xml',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.ogg': 'audio/ogg',
    '.ogv': 'video/ogg',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
};

interface ManifestItem {
    id: string;
    href: string;
    mediaType: string;
    properties?: string;
}

interface SpineItem {
    idref: string;
    linear?: boolean;
}

export class Epub3Exporter extends BaseExporter {
    private manifestItems: ManifestItem[] = [];
    private spineItems: SpineItem[] = [];
    private usedIds: Set<string> = new Set();

    /**
     * Get file extension for EPUB3 format
     */
    getFileExtension(): string {
        return '.epub';
    }

    /**
     * Get file suffix for EPUB3 format
     */
    getFileSuffix(): string {
        return '';
    }

    /**
     * Export to EPUB3
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();
        const epub3Options = options as Epub3ExportOptions | undefined;

        try {
            // Reset state
            this.manifestItems = [];
            this.spineItems = [];
            this.usedIds = new Set();

            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = epub3Options?.theme || meta.theme || 'base';
            const bookId = epub3Options?.bookId || this.generateBookId();

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // 0. Pre-fetch theme to get the list of CSS/JS files for HTML includes
            const themeRootFiles: string[] = [];
            let themeFilesMap: Map<string, Uint8Array> | null = null;
            try {
                themeFilesMap = await this.resources.fetchTheme(themeName);
                for (const [filePath] of themeFilesMap) {
                    // Track root-level CSS/JS files (no path separator = root level)
                    if (!filePath.includes('/') && (filePath.endsWith('.css') || filePath.endsWith('.js'))) {
                        themeRootFiles.push(filePath);
                    }
                }
            } catch {
                // Will use fallback theme later
                themeRootFiles.push('style.css', 'style.js');
            }

            // 1. Add mimetype file (MUST be first, uncompressed)
            // Note: The ZIP provider should handle this specially
            this.zip.addFile('mimetype', EPUB3_MIMETYPE);

            // 2. Add container.xml
            this.zip.addFile('META-INF/container.xml', this.generateContainerXml());

            // 3. Generate navigation document
            const navXhtml = this.generateNavXhtml(pages, meta);
            this.zip.addFile('EPUB/nav.xhtml', navXhtml);
            this.addManifestItem('nav', 'nav.xhtml', 'application/xhtml+xml', 'nav');

            // 4. Generate XHTML pages
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const xhtml = this.generatePageXhtml(page, pages, meta, i === 0, themeRootFiles);
                const filename = i === 0 ? 'index.xhtml' : `html/${this.sanitizePageFilename(page.title)}.xhtml`;
                this.zip.addFile(`EPUB/${filename}`, xhtml);

                const pageId = this.generateUniqueId(`page-${i}`);
                this.addManifestItem(pageId, filename, 'application/xhtml+xml', 'scripted');
                this.spineItems.push({ idref: pageId });
            }

            // 5. Add base CSS (fetch from content/css, then add EPUB-specific)
            const contentCssFiles = await this.resources.fetchContentCss();
            const fetchedBaseCss = contentCssFiles.get('content/css/base.css');
            if (!fetchedBaseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            const baseCssContent =
                typeof fetchedBaseCss === 'string' ? fetchedBaseCss : new TextDecoder().decode(fetchedBaseCss);
            const baseCss = baseCssContent + '\n' + this.getEpubSpecificCss();
            this.zip.addFile('EPUB/content/css/base.css', baseCss);
            this.addManifestItem('css-base', 'content/css/base.css', 'text/css');

            // 5b. Add eXeLearning logo for "Made with eXeLearning" footer
            try {
                const logoData = await this.resources.fetchExeLogo();
                if (logoData) {
                    this.zip.addFile('EPUB/content/img/exe_powered_logo.png', logoData);
                    this.addManifestItem('exe-logo', 'content/img/exe_powered_logo.png', 'image/png');
                }
            } catch {
                // Logo not available
            }

            // 6. Add theme files (already pre-fetched in step 0)
            if (themeFilesMap) {
                for (const [filePath, content] of themeFilesMap) {
                    this.zip.addFile(`EPUB/theme/${filePath}`, content);
                    const ext = this.getFileExtensionFromPath(filePath);
                    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                    this.addManifestItem(this.generateUniqueId(`theme-${filePath}`), `theme/${filePath}`, mimeType);
                }
            } else {
                // Add fallback theme
                this.zip.addFile('EPUB/theme/style.css', this.getFallbackThemeCss());
                this.addManifestItem('theme-css', 'theme/style.css', 'text/css');
            }

            // 7. Detect and fetch required libraries
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
                allHtmlContent,
                {
                    includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                },
            );

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [path, content] of libFiles) {
                    this.zip.addFile(`EPUB/libs/${path}`, content);
                    const ext = this.getFileExtensionFromPath(path);
                    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                    this.addManifestItem(this.generateUniqueId(`lib-${path}`), `libs/${path}`, mimeType);
                }
            } catch {
                try {
                    const baseLibs = await this.resources.fetchBaseLibraries();
                    for (const [path, content] of baseLibs) {
                        this.zip.addFile(`EPUB/libs/${path}`, content);
                        const ext = this.getFileExtensionFromPath(path);
                        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                        this.addManifestItem(this.generateUniqueId(`lib-${path}`), `libs/${path}`, mimeType);
                    }
                } catch {
                    // No libraries available
                }
            }

            // 8. Fetch and add iDevice assets (skip .html templates - they're for JS rendering, not EPUB)
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [filePath, content] of ideviceFiles) {
                        // Skip .html template files - they contain placeholders like {scorm}
                        // that are invalid XML and can't be processed by EPUB readers
                        if (filePath.endsWith('.html')) {
                            continue;
                        }
                        // Skip test files
                        if (filePath.endsWith('.test.js') || filePath.endsWith('.spec.js')) {
                            continue;
                        }
                        this.zip.addFile(`EPUB/idevices/${idevice}/${filePath}`, content);
                        const ext = this.getFileExtensionFromPath(filePath);
                        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                        this.addManifestItem(
                            this.generateUniqueId(`idevice-${idevice}-${filePath}`),
                            `idevices/${idevice}/${filePath}`,
                            mimeType,
                        );
                    }
                } catch {
                    // Many iDevices don't have extra files
                }
            }

            // 9. Add project assets
            const _assetsAdded = await this.addEpubAssets();

            // 10. Generate package.opf (OPF manifest)
            const packageOpf = this.generatePackageOpf(meta, bookId);
            this.zip.addFile('EPUB/package.opf', packageOpf);

            // 11. Generate ZIP buffer
            const buffer = await this.zip.generateAsync();

            return {
                success: true,
                filename: exportFilename,
                data: buffer,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Generate unique book ID (URN UUID format)
     */
    private generateBookId(): string {
        return `urn:uuid:${crypto.randomUUID()}`;
    }

    /**
     * Generate unique manifest ID
     */
    private generateUniqueId(base: string): string {
        const sanitized = base
            .replace(/[^a-zA-Z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 50);

        if (!this.usedIds.has(sanitized)) {
            this.usedIds.add(sanitized);
            return sanitized;
        }

        let counter = 1;
        while (this.usedIds.has(`${sanitized}-${counter}`)) {
            counter++;
        }
        const uniqueId = `${sanitized}-${counter}`;
        this.usedIds.add(uniqueId);
        return uniqueId;
    }

    /**
     * Add item to manifest
     */
    private addManifestItem(id: string, href: string, mediaType: string, properties?: string): void {
        this.manifestItems.push({ id, href, mediaType, properties });
    }

    /**
     * Get file extension from path
     */
    private getFileExtensionFromPath(filePath: string): string {
        const lastDot = filePath.lastIndexOf('.');
        return lastDot > 0 ? filePath.substring(lastDot).toLowerCase() : '';
    }

    /**
     * Generate container.xml
     */
    private generateContainerXml(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="${EPUB3_NAMESPACES.CONTAINER}">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    }

    /**
     * Generate package.opf (OPF manifest)
     */
    private generatePackageOpf(meta: ExportMetadata, bookId: string): string {
        const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" unique-identifier="pub-id" xmlns="${EPUB3_NAMESPACES.OPF}">
  <metadata xmlns:dc="${EPUB3_NAMESPACES.DC}">
    <dc:identifier id="pub-id">${this.escapeXml(bookId)}</dc:identifier>
    <dc:title>${this.escapeXml(meta.title || 'eXeLearning')}</dc:title>
    <dc:language>${this.escapeXml(meta.language || 'en')}</dc:language>
    <dc:creator>${this.escapeXml(meta.author || '')}</dc:creator>`;

        if (meta.description) {
            xml += `
    <dc:description>${this.escapeXml(meta.description)}</dc:description>`;
        }

        if (meta.license) {
            xml += `
    <dc:rights>${this.escapeXml(meta.license)}</dc:rights>`;
        }

        xml += `
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>`;

        // Add all manifest items
        for (const item of this.manifestItems) {
            const props = item.properties ? ` properties="${item.properties}"` : '';
            xml += `
    <item id="${this.escapeXml(item.id)}" href="${this.escapeXml(item.href)}" media-type="${item.mediaType}"${props}/>`;
        }

        xml += `
  </manifest>
  <spine>`;

        // Add spine items
        for (const item of this.spineItems) {
            xml += `
    <itemref idref="${this.escapeXml(item.idref)}"/>`;
        }

        xml += `
  </spine>
</package>`;

        return xml;
    }

    /**
     * Generate nav.xhtml (EPUB3 navigation document)
     */
    private generateNavXhtml(pages: ExportPage[], meta: ExportMetadata): string {
        const lang = meta.language || 'en';

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="${EPUB3_NAMESPACES.XHTML}" xmlns:epub="${EPUB3_NAMESPACES.EPUB}" xml:lang="${lang}" lang="${lang}">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" href="content/css/base.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${this.escapeXml(meta.title || 'Table of Contents')}</h1>
    <ol>`;

        // Build hierarchical navigation
        xml += this.buildNavList(pages, pages);

        xml += `
    </ol>
  </nav>
</body>
</html>`;

        return xml;
    }

    /**
     * Build navigation list recursively
     */
    private buildNavList(pages: ExportPage[], allPages: ExportPage[], parentId: string | null = null): string {
        const children =
            parentId === null ? pages.filter(p => !p.parentId) : pages.filter(p => p.parentId === parentId);

        if (children.length === 0) return '';

        let html = '';
        for (const page of children) {
            const filename = this.getPageFilename(page, allPages);
            const grandchildren = pages.filter(p => p.parentId === page.id);

            html += `
      <li><a href="${filename}">${this.escapeXml(page.title)}</a>`;

            if (grandchildren.length > 0) {
                html += `
        <ol>${this.buildNavList(pages, allPages, page.id)}
        </ol>`;
            }

            html += `</li>`;
        }

        return html;
    }

    /**
     * Get page filename for navigation
     */
    private getPageFilename(page: ExportPage, allPages: ExportPage[]): string {
        const isFirst = page.id === allPages[0]?.id;
        if (isFirst) {
            return 'index.xhtml';
        }
        return `html/${this.sanitizePageFilename(page.title)}.xhtml`;
    }

    /**
     * Generate XHTML page
     * @param page - Page data
     * @param allPages - All pages in the project
     * @param meta - Project metadata
     * @param isIndex - Whether this is the index page
     * @param themeFiles - List of root-level theme CSS/JS files
     */
    private generatePageXhtml(
        page: ExportPage,
        allPages: ExportPage[],
        meta: ExportMetadata,
        isIndex: boolean,
        themeFiles?: string[],
    ): string {
        const lang = meta.language || 'en';
        const basePath = isIndex ? '' : '../';
        const usedIdevices = this.getUsedIdevicesForPage(page);

        // Generate page content HTML then convert to XHTML
        const pageHtml = this.pageRenderer.render(page, {
            projectTitle: meta.title || 'eXeLearning',
            projectSubtitle: meta.subtitle || '',
            language: lang,
            theme: meta.theme || 'base',
            customStyles: meta.customStyles || '',
            allPages,
            basePath,
            isIndex,
            usedIdevices,
            author: meta.author || '',
            license: meta.license || 'CC-BY-SA',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/',
            bodyClass: 'exe-export exe-epub',
            // Theme files for HTML head includes
            themeFiles: themeFiles || [],
        });

        // Convert HTML to XHTML
        return this.htmlToXhtml(pageHtml, lang);
    }

    /**
     * Convert HTML to XHTML
     */
    private htmlToXhtml(html: string, lang: string): string {
        let xhtml = html;

        // Add XML declaration if not present
        if (!xhtml.startsWith('<?xml')) {
            xhtml = `<?xml version="1.0" encoding="UTF-8"?>\n${xhtml}`;
        }

        // Add DOCTYPE if not present
        if (!xhtml.includes('<!DOCTYPE')) {
            xhtml = xhtml.replace(
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>',
            );
        }

        // Add XHTML namespace to html element
        // First, remove any existing lang/xml:lang attributes to avoid duplication
        xhtml = xhtml.replace(/<html([^>]*)>/i, (match, attrs) => {
            // Remove existing lang and xml:lang attributes
            const cleanAttrs = attrs
                .replace(/\s+xml:lang=["'][^"']*["']/gi, '')
                .replace(/\s+lang=["'][^"']*["']/gi, '');
            return `<html xmlns="${EPUB3_NAMESPACES.XHTML}" xml:lang="${lang}" lang="${lang}"${cleanAttrs}>`;
        });

        // Self-close void elements (use word boundary \b to avoid matching substrings like col matching colgroup)
        for (const element of VOID_ELEMENTS) {
            // Match <element ...> (without closing slash) - word boundary ensures exact element match
            const regex = new RegExp(`<(${element})\\b([^>]*[^/])>`, 'gi');
            xhtml = xhtml.replace(regex, '<$1$2/>');

            // Also handle <element> (no attributes)
            const simpleRegex = new RegExp(`<(${element})>`, 'gi');
            xhtml = xhtml.replace(simpleRegex, '<$1/>');
        }

        // Escape unescaped ampersands in attribute values (for URLs with query params like &download=false)
        // Match & not followed by a valid entity name and semicolon
        xhtml = xhtml.replace(/&(?!(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

        // Fix unquoted boolean attributes like scorm=false → scorm="false"
        // Match attribute=value where value has no quotes and is alphanumeric
        xhtml = xhtml.replace(/(\s)([a-zA-Z][a-zA-Z0-9-]*)=(true|false|[a-zA-Z0-9_-]+)(?=[\s>/])/g, '$1$2="$3"');

        // Fix malformed attributes like class=""value> → class="value">
        // This handles case where opening has double-quote and closing quote is missing before >
        // Exclude /> to avoid breaking self-closed void elements like alt=""/>
        xhtml = xhtml.replace(/(\s[a-zA-Z][a-zA-Z0-9-]*)=""([^"<>/]+)>/g, '$1="$2">');

        // Convert .html references to .xhtml
        xhtml = xhtml.replace(/\.html(['"#\s])/g, '.xhtml$1');
        xhtml = xhtml.replace(/\.html$/g, '.xhtml');

        // Remove empty style attributes
        xhtml = xhtml.replace(/\s+style=["']\s*["']/g, '');

        return xhtml;
    }

    /**
     * Add assets to EPUB with manifest entries
     */
    private async addEpubAssets(): Promise<number> {
        let assetsAdded = 0;

        try {
            const assets = await this.assets.getAllAssets();

            for (const asset of assets) {
                const assetId = asset.id;
                const filename = asset.filename || `asset-${assetId}`;
                const zipPath = `content/resources/${assetId}/${filename}`;

                this.zip.addFile(`EPUB/${zipPath}`, asset.data);

                // Add to manifest
                const ext = this.getFileExtensionFromPath(filename);
                const mimeType = MIME_TYPES[ext] || asset.mime || 'application/octet-stream';
                this.addManifestItem(this.generateUniqueId(`asset-${assetId}`), zipPath, mimeType);

                assetsAdded++;
            }
        } catch (e) {
            console.warn('[Epub3Exporter] Failed to add assets:', e);
        }

        return assetsAdded;
    }

    /**
     * Get EPUB-specific CSS additions
     */
    private getEpubSpecificCss(): string {
        return `
/* EPUB3 Specific Styles */
body {
  margin: 0;
  padding: 1em;
}

/* Page breaks */
.page-break-before {
  page-break-before: always;
}
.page-break-after {
  page-break-after: always;
}
.avoid-page-break {
  page-break-inside: avoid;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
}

/* Hide navigation in EPUB (handled by reader) */
#siteNav {
  display: none;
}

/* Pagination links hidden in EPUB */
.pagination {
  display: none;
}

/* Tables */
table {
  max-width: 100%;
  border-collapse: collapse;
}
td, th {
  padding: 0.5em;
  border: 1px solid #ccc;
}
`;
    }
}

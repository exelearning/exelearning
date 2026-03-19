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

import type {
    ExportAsset,
    ExportPage,
    ExportMetadata,
    ExportOptions,
    ExportResult,
    Epub3ExportOptions,
    FaviconInfo,
    ThemeData,
} from '../interfaces';
import { BaseExporter } from './BaseExporter';
import { GlobalFontGenerator } from '../utils/GlobalFontGenerator';
import { ODE_DTD_FILENAME, ODE_DTD_CONTENT } from '../constants';
import { VOID_ELEMENTS } from '../../utils/html-constants';

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

            // Build unique filename map for all pages (handles collisions)
            const pageFilenameMap = this.buildPageFilenameMap(pages);

            // 0. Pre-fetch theme to get the list of CSS/JS files for HTML includes and detect favicon
            const { themeFilesMap, themeRootFiles, faviconInfo } = await this.prepareThemeData(themeName);

            // 1. Add mimetype file (MUST be first, uncompressed)
            this.zip.addFile('mimetype', EPUB3_MIMETYPE);

            // 2. Add container.xml
            this.zip.addFile('META-INF/container.xml', this.generateContainerXml());

            // 3. Generate navigation document (pass filename map for collision handling)
            const navXhtml = this.generateNavXhtml(pages, meta, pageFilenameMap);
            this.zip.addFile('EPUB/nav.xhtml', navXhtml);
            this.addManifestItem('nav', 'nav.xhtml', 'application/xhtml+xml', 'nav');

            // 4. Generate XHTML pages (with optional LaTeX and Mermaid pre-rendering)
            let latexWasRendered = false;
            let mermaidWasRendered = false;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                let xhtml = this.generatePageXhtml(page, pages, meta, i === 0, i, themeRootFiles, faviconInfo);

                // Pre-render LaTeX ONLY if addMathJax is false
                // When MathJax is included, let it process LaTeX at runtime for full UX
                if (!meta.addMathJax) {
                    // Pre-render LaTeX in encrypted DataGame divs FIRST
                    if (options?.preRenderDataGameLatex) {
                        try {
                            const result = await options.preRenderDataGameLatex(xhtml);
                            if (result.count > 0) {
                                xhtml = result.html;
                                latexWasRendered = true;
                            }
                        } catch (error) {
                            // Fail silently for optional pre-rendering
                        }
                    }

                    // Pre-render visible LaTeX to SVG+MathML if hook is provided
                    if (options?.preRenderLatex) {
                        try {
                            const result = await options.preRenderLatex(xhtml);
                            if (result.latexRendered) {
                                xhtml = result.html;
                                latexWasRendered = true;
                            }
                        } catch (error) {
                            // Fail silently for optional pre-rendering
                        }
                    }
                }

                // Pre-render Mermaid diagrams to static SVG if hook is provided
                // This eliminates the need for the ~2.7MB Mermaid library in exports
                if (options?.preRenderMermaid) {
                    try {
                        const result = await options.preRenderMermaid(xhtml);
                        if (result.mermaidRendered) {
                            xhtml = result.html;
                            mermaidWasRendered = true;
                        }
                    } catch (error) {
                        // Fail silently for optional pre-rendering
                    }
                }

                // Use unique filename from the map (handles title collisions)
                // EPUB uses .xhtml extension instead of .html
                const mapFilename = pageFilenameMap.get(page.id) || 'page.html';
                const xhtmlFilename = mapFilename.replace(/\.html$/, '.xhtml');
                const filename = i === 0 ? 'index.xhtml' : `html/${xhtmlFilename}`;
                this.zip.addFile(`EPUB/${filename}`, xhtml);

                const pageId = this.generateUniqueId(`page-${i}`);
                this.addManifestItem(pageId, filename, 'application/xhtml+xml', 'scripted');
                this.spineItems.push({ idref: pageId });
            }

            // 5. Add base CSS (fetch from content/css, then add EPUB-specific + pre-rendered CSS)
            const contentCssFiles = await this.resources.fetchContentCss();
            const fetchedBaseCss = contentCssFiles.get('content/css/base.css');
            if (!fetchedBaseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            const baseCssContent =
                typeof fetchedBaseCss === 'string' ? fetchedBaseCss : new TextDecoder().decode(fetchedBaseCss);
            let baseCss = baseCssContent + '\n' + this.getEpubSpecificCss();
            // Append pre-rendered CSS if LaTeX or Mermaid was rendered
            if (latexWasRendered) {
                baseCss += '\n' + this.getPreRenderedLatexCss();
            }
            if (mermaidWasRendered) {
                baseCss += '\n' + this.getPreRenderedMermaidCss();
            }
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
            const { files: allRequiredFiles, patterns } = this.getRequiredLibraryFilesForPages(pages, {
                includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
            });

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [path, content] of libFiles) {
                    // Transform exe_abc_music.js to prevent duplicate execution errors in EPUB readers
                    const finalContent = this.transformForEpub(path, content);
                    this.zip.addFile(`EPUB/libs/${path}`, finalContent);
                    const ext = this.getFileExtensionFromPath(path);
                    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                    this.addManifestItem(this.generateUniqueId(`lib-${path}`), `libs/${path}`, mimeType);
                }
            } catch {
                try {
                    const baseLibs = await this.resources.fetchBaseLibraries();
                    for (const [path, content] of baseLibs) {
                        // Also transform scripts in fallback path
                        const finalContent = this.transformForEpub(path, content);
                        this.zip.addFile(`EPUB/libs/${path}`, finalContent);
                        const ext = this.getFileExtensionFromPath(path);
                        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                        this.addManifestItem(this.generateUniqueId(`lib-${path}`), `libs/${path}`, mimeType);
                    }
                } catch {
                    // No libraries available
                }
            }

            // 7.5. Generate localized i18n file
            const i18nContent = await this.generateI18nContent(meta.language || 'en');
            this.zip.addFile('EPUB/libs/common_i18n.js', i18nContent);
            this.addManifestItem('common-i18n', 'libs/common_i18n.js', 'application/javascript');

            // 7.5.1. Add EPUB guards script
            const guardsScript = this.generateEpubGuardsScript();
            this.zip.addFile('EPUB/libs/exe_epub_guards.js', guardsScript);
            this.addManifestItem('epub-guards', 'libs/exe_epub_guards.js', 'application/javascript');

            // 7.6. Always add base libraries (including favicon) - these are essential for any export
            // This ensures libs/favicon.ico is always present regardless of library detection results
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [path, content] of baseLibs) {
                    const zipPath = `EPUB/libs/${path}`;
                    if (!this.zip.hasFile(zipPath)) {
                        this.zip.addFile(zipPath, content);
                        const ext = this.getFileExtensionFromPath(path);
                        const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                        this.addManifestItem(this.generateUniqueId(`baselib-${path}`), `libs/${path}`, mimeType);
                    }
                }
            } catch {
                // Base libraries not available in this environment
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

            // 8.5. Fetch and add global font files (if selected)
            if (meta.globalFont && meta.globalFont !== 'default') {
                try {
                    const fontFiles = await this.resources.fetchGlobalFontFiles(meta.globalFont);
                    if (fontFiles) {
                        for (const [filePath, content] of fontFiles) {
                            this.zip.addFile(`EPUB/${filePath}`, content);
                            const ext = this.getFileExtensionFromPath(filePath);
                            const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
                            this.addManifestItem(this.generateUniqueId(`font-${filePath}`), filePath, mimeType);
                        }
                    }
                } catch {
                    // Fail silently for font fetching
                }
            }

            // 9. Add project assets
            const _assetsAdded = await this.addEpubAssets();

            // 9.5. Add content.xml (ODE format for re-import) - only if exportSource is enabled
            if (meta.exportSource !== false) {
                try {
                    const contentXml = await this.getContentXml();
                    if (contentXml) {
                        // In EPUB, content.xml goes inside EPUB/ directory
                        this.zip.addFile('EPUB/content.xml', contentXml);
                        this.addManifestItem('content-xml', 'content.xml', 'application/xml');
                        this.zip.addFile('EPUB/' + ODE_DTD_FILENAME, ODE_DTD_CONTENT);
                        this.addManifestItem('content-dtd', ODE_DTD_FILENAME, 'application/xml-dtd');
                    }
                } catch {
                    // content.xml is optional - fail silently
                }
            }

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
     * @param pages - All pages
     * @param meta - Export metadata
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     */
    private generateNavXhtml(pages: ExportPage[], meta: ExportMetadata, pageFilenameMap?: Map<string, string>): string {
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
        xml += this.buildNavList(pages, pages, null, pageFilenameMap);

        xml += `
    </ol>
  </nav>
</body>
</html>`;

        return xml;
    }

    /**
     * Build navigation list recursively
     * @param pages - All pages
     * @param allPages - All pages (for first page detection)
     * @param parentId - Parent page ID (null for root)
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     */
    private buildNavList(
        pages: ExportPage[],
        allPages: ExportPage[],
        parentId: string | null = null,
        pageFilenameMap?: Map<string, string>,
    ): string {
        const children =
            parentId === null ? pages.filter(p => !p.parentId) : pages.filter(p => p.parentId === parentId);

        if (children.length === 0) return '';

        let html = '';
        for (const page of children) {
            // Check visibility property (skip if explicitly set to false or "false")
            const visibility = page.properties?.visibility;
            if (visibility === false || visibility === 'false') {
                continue;
            }

            const filename = this.getPageFilename(page, allPages, pageFilenameMap);
            const grandchildren = pages.filter(p => p.parentId === page.id);

            html += `
      <li><a href="${filename}">${this.escapeXml(page.title)}</a>`;

            if (grandchildren.length > 0) {
                html += `
        <ol>${this.buildNavList(pages, allPages, page.id, pageFilenameMap)}
        </ol>`;
            }

            html += `</li>`;
        }

        return html;
    }

    /**
     * Get page filename for navigation
     * @param page - Page data
     * @param allPages - All pages (for first page detection)
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     */
    private getPageFilename(page: ExportPage, allPages: ExportPage[], pageFilenameMap?: Map<string, string>): string {
        const isFirst = page.id === allPages[0]?.id;
        if (isFirst) {
            return 'index.xhtml';
        }
        // Use unique filename from map if available (convert .html to .xhtml)
        const mapFilename = pageFilenameMap?.get(page.id);
        if (mapFilename) {
            return `html/${mapFilename.replace(/\.html$/, '.xhtml')}`;
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
     * @param faviconInfo - Favicon info for theme or default
     */
    private generatePageXhtml(
        page: ExportPage,
        allPages: ExportPage[],
        meta: ExportMetadata,
        isIndex: boolean,
        pageIndex: number,
        themeFiles?: string[],
        faviconInfo?: FaviconInfo | null,
    ): string {
        const lang = meta.language || 'en';
        const basePath = isIndex ? '' : '../';
        const usedIdevices = this.getUsedIdevicesForPage(page);

        // Generate global font CSS if a font is selected
        let customStyles = meta.customStyles || '';
        let bodyClass = 'exe-export exe-epub';
        if (meta.globalFont && meta.globalFont !== 'default') {
            const globalFontCss = GlobalFontGenerator.generateCss(meta.globalFont, basePath);
            if (globalFontCss) {
                // Prepend global font CSS to customStyles
                customStyles = globalFontCss + '\n' + customStyles;
            }
            // Add font-specific body class for CSS overrides
            const fontBodyClass = GlobalFontGenerator.getBodyClassName(meta.globalFont);
            if (fontBodyClass) {
                bodyClass += ` ${fontBodyClass}`;
            }
        }

        // Generate page content HTML then convert to XHTML
        const pageHtml = this.pageRenderer.render(page, {
            projectTitle: meta.title || 'eXeLearning',
            projectSubtitle: meta.subtitle || '',
            language: lang,
            theme: meta.theme || 'base',
            customStyles,
            allPages,
            basePath,
            isIndex,
            usedIdevices,
            author: meta.author || '',
            license: meta.license || '',
            description: meta.description || '',
            licenseUrl: meta.licenseUrl || '',
            bodyClass,
            // Theme files for HTML head includes
            themeFiles: themeFiles || [],
            // Favicon options
            faviconPath: faviconInfo?.path,
            faviconType: faviconInfo?.type,
            // Hide navigation - EPUB uses nav.xhtml for TOC, not embedded nav
            hideNavigation: true,
            // Hide nav buttons - EPUB reader handles navigation
            hideNavButtons: true,
            // Page counter (only if user has the option enabled)
            addPagination: meta.addPagination === true,
            totalPages: allPages.length,
            currentPageIndex: pageIndex,
            // Application version for generator meta tag
            version: meta.exelearningVersion,
            // EPUB-specific: load guard script for duplicate execution protection
            isEpub: true,
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
     * Uses buildAssetExportPathMap for clean paths (matching SCORM/Website exports)
     */
    private async addEpubAssets(): Promise<number> {
        let assetsAdded = 0;

        try {
            const exportPathMap = await this.buildAssetExportPathMap();

            const processAsset = async (asset: ExportAsset) => {
                const exportPath = exportPathMap.get(asset.id);
                if (!exportPath) {
                    return;
                }

                // Store in EPUB/content/resources/{exportPath} (matching HTML references)
                const zipPath = `content/resources/${exportPath}`;

                this.zip.addFile(`EPUB/${zipPath}`, asset.data);

                // Add to manifest
                const ext = this.getFileExtensionFromPath(exportPath);
                const mimeType = MIME_TYPES[ext] || asset.mime || 'application/octet-stream';
                this.addManifestItem(this.generateUniqueId(`asset-${asset.id}`), zipPath, mimeType);

                assetsAdded++;
            };

            await this.forEachAsset(processAsset);
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

    /**
     * Detect theme-specific favicon from theme files map
     * @param themeFilesMap - Map of theme files
     * @returns Favicon info or null if not found
     */
    protected detectFavicon(themeFilesMap: Map<string, Uint8Array>): FaviconInfo | null {
        if (themeFilesMap.has('img/favicon.ico')) {
            return { path: 'theme/img/favicon.ico', type: 'image/x-icon' };
        }
        if (themeFilesMap.has('img/favicon.png')) {
            return { path: 'theme/img/favicon.png', type: 'image/png' };
        }
        return null;
    }

    /**
     * Prepare theme data for export: fetch theme files, extract root-level CSS/JS, detect favicon
     * @param themeName - Name of the theme to fetch
     * @returns ThemeData with files, root files list, and favicon info
     */
    protected async prepareThemeData(themeName: string): Promise<ThemeData> {
        const themeRootFiles: string[] = [];
        let themeFilesMap: Map<string, Uint8Array> | null = null;
        let faviconInfo: FaviconInfo | null = null;

        try {
            themeFilesMap = await this.resources.fetchTheme(themeName);
            for (const [filePath] of themeFilesMap) {
                if (!filePath.includes('/') && (filePath.endsWith('.css') || filePath.endsWith('.js'))) {
                    themeRootFiles.push(filePath);
                }
            }
            faviconInfo = this.detectFavicon(themeFilesMap);
        } catch (e) {
            console.warn(`[Epub3Exporter] Failed to fetch theme: ${themeName}`, e);
            themeRootFiles.push('style.css', 'style.js');
        }

        // Configure iDevice renderer with theme files for icon resolution (SVG vs PNG)
        this.ideviceRenderer.setThemeIconFiles(themeFilesMap);

        return { themeFilesMap, themeRootFiles, faviconInfo };
    }

    /**
     * Get content.xml from the document for inclusion in EPUB package
     * This allows the package to be re-edited in eXeLearning
     */
    protected async getContentXml(): Promise<string | null> {
        // Try to get content.xml from the document adapter
        if ('getContentXml' in this.document && typeof this.document.getContentXml === 'function') {
            return (this.document as { getContentXml: () => Promise<string | null> }).getContentXml();
        }
        return null;
    }

    /**
     * Get CSS for pre-rendered LaTeX (SVG+MathML)
     * This CSS is needed when LaTeX is pre-rendered instead of using MathJax at runtime
     */
    protected getPreRenderedLatexCss(): string {
        return `/* Pre-rendered LaTeX (SVG+MathML) - MathJax not included */
.exe-math-rendered { display: inline-block; vertical-align: middle; }
.exe-math-rendered[data-display="block"] { display: block; text-align: center; margin: 1em 0; }
.exe-math-rendered svg { vertical-align: middle; max-width: 100%; height: auto; }
/* Fix for MathJax array/table borders - SVG has stroke-width:0 which hides lines */
.exe-math-rendered svg line.mjx-solid { stroke-width: 60 !important; }
.exe-math-rendered svg rect[data-frame="true"] { fill: none; stroke-width: 60 !important; }
/* Hide MathML visually but keep accessible for screen readers */
.exe-math-rendered math { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }`;
    }

    /**
     * Get CSS for pre-rendered Mermaid diagrams (static SVG)
     * This CSS is needed when Mermaid is pre-rendered instead of using the library at runtime
     */
    protected getPreRenderedMermaidCss(): string {
        return `/* Pre-rendered Mermaid (static SVG) - Mermaid library not included */
.exe-mermaid-rendered { display: block; text-align: center; margin: 1.5em 0; }
.exe-mermaid-rendered svg { max-width: 100%; height: auto; }`;
    }

    /**
     * Transform JavaScript files for EPUB compatibility
     * Some scripts need to be wrapped in guards to prevent duplicate execution errors
     * when EPUB readers re-execute scripts during page navigation.
     *
     * @param path - The file path
     * @param content - The file content (string or Uint8Array)
     * @returns Transformed content (same type as input)
     */
    private transformForEpub(path: string, content: string | Uint8Array): string | Uint8Array {
        // Extract filename, handling both forward and backslashes (Windows paths)
        const filename = path.split(/[/\\]/).pop() || path;

        // Transform abcjs-basic-min.js - the UMD pattern binds ABCJS to 'this' which may not be 'window' in EPUB
        if (filename === 'abcjs-basic-min.js') {
            const originalCode = typeof content === 'string' ? content : new TextDecoder().decode(content);

            // Replaces the UMD pattern with a forced window assignment
            // Original: !function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.abcjs=t():e.ABCJS=t()}(this,(function(){...
            const umdPattern =
                '!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.abcjs=t():e.ABCJS=t()}';
            const forcedBinding = '!function(e,t){window.ABCJS=t()}';

            let transformedCode = originalCode.replace(umdPattern, forcedBinding);

            // Add header comment if it's not the original code anymore
            if (transformedCode !== originalCode) {
                transformedCode = `// EPUB-safe version - forced window.ABCJS binding\n${transformedCode}`;
            } else {
                // Fallback if pattern doesn't match exactly (e.g. version change): append safety check
                transformedCode = `// EPUB-safe version - fallback binding\n${originalCode}\n`;
                transformedCode += `(function(){ if(typeof window!=='undefined' && !window.ABCJS && typeof ABCJS!=='undefined'){window.ABCJS=ABCJS;} })();`;
            }

            if (typeof content === 'string') {
                return transformedCode;
            }
            return new TextEncoder().encode(transformedCode);
        }

        // Transform exe_abc_music.js - it contains class declarations that fail on re-execution
        if (filename === 'exe_abc_music.js') {
            // Convert to string if needed
            let originalCode = typeof content === 'string' ? content : new TextDecoder().decode(content);

            // Enhance logging for debugging
            originalCode = originalCode.replace(
                'console.warn("Error loading abcjs");',
                'console.warn("Error loading abcjs", error); console.warn("window.ABCJS is:", typeof window.ABCJS);',
            );

            // EPUB Security Fix: Accessing parent.document throws SecurityError in sandboxed readers
            // We wrap it in try-catch to allow falling back to the local document selector
            originalCode = originalCode.replace(
                'var htmlSource = parent.document.querySelector("#htmlSource");',
                'var htmlSource = null; try { htmlSource = parent.document.querySelector("#htmlSource"); } catch(e) { console.warn("EPUB: Cannot access parent.document, using fallback"); }',
            );

            // Simple guard pattern: if already loaded, skip entire script
            // We don't use IIFE to preserve the original global variable behavior
            // Instead, we wrap just the class declaration that causes redeclaration errors
            const transformedCode = `// EPUB-safe version - guards against redeclaration error
if (typeof window.__exeABCmusicLoaded !== 'undefined') {
    // Script already loaded, skip re-execution to prevent CursorControl redeclaration error
} else {
    window.__exeABCmusicLoaded = true;
    // Original script follows - variables remain in global scope
${originalCode}
}
`;

            // Return in same format as input
            if (typeof content === 'string') {
                return transformedCode;
            }
            return new TextEncoder().encode(transformedCode);
        }

        // Transform exe_effects.js to fix Accordion in EPUB (href issue)
        if (filename === 'exe_effects.js') {
            const originalCode = typeof content === 'string' ? content : new TextDecoder().decode(content);

            // Patch the accordion click handler
            // The issue is that $(this).attr('href') falls back to the full URL or is sanitized in EPUBs
            // We need to derive the target ID from the element ID instead
            const searchFor = `var currentAttrValue = $(this).attr('href');

        // IE7 retrieves link#hash instead of #hash
        currentAttrValue = currentAttrValue.split("#");
        currentAttrValue = "#" + currentAttrValue[1];
        // / IE7`;

            const replaceWith = `// EPUB PATCH: Deduce target from ID because href might be void
        var targetId = this.id.replace("-trigger", "").replace(/_/g, "-");
        var currentAttrValue = "#" + targetId;`;

            // Allow for flexible whitespace in search
            const normalizedSearch = searchFor.replace(/\s+/g, ' ');
            const normalizedOriginal = originalCode.replace(/\s+/g, ' ');

            let transformedCode = originalCode;

            // Try exact replacement first
            if (originalCode.includes(searchFor)) {
                transformedCode = originalCode.replace(searchFor, replaceWith);
            } else {
                // Determine indentation and surrounding context for fallback
                const fallbackSearch = "var currentAttrValue = $(this).attr('href');";
                const fallbackReplace = `var currentAttrValue = "#" + this.id.replace("-trigger", "").replace(/_/g, "-"); /* EPUB PATCH */
        /* Original: var currentAttrValue = $(this).attr('href'); */`;

                if (originalCode.includes(fallbackSearch)) {
                    // We only replace the first line and comment out the rest manually if needed,
                    // or just rely on the fact that redefining currentAttrValue effectively overrides the subsequent logic
                    // IF we place it after.
                    // But simpler to just replace the line and handle the IE7 block if it exists next.

                    // Regex approach to match the block more robustly
                    const regex =
                        /var\s+currentAttrValue\s*=\s*\$\(this\)\.attr\('href'\);\s*\/\/ IE7[^/]*\/\/\s*\/ IE7/s;
                    if (regex.test(originalCode)) {
                        transformedCode = originalCode.replace(regex, replaceWith);
                    } else {
                        // Fallback: just replace the initialization line
                        transformedCode = originalCode.replace(fallbackSearch, fallbackReplace);
                    }
                } else {
                    console.warn('[Epub3Exporter] Could not find exe_effects.js click handler to patch');
                }
            }

            // Refinement: Prevent scroll-to-top by changing href="#" to href="javascript:void(0)"
            // in the HTML generation part.
            // Original: href="#' + id + '"
            const linkSearch = 'href="#\' + id + \'"';
            const linkReplace = 'href="javascript:void(0)"';

            if (transformedCode.includes(linkSearch)) {
                transformedCode = transformedCode.replace(linkSearch, linkReplace);
            } else {
                console.warn('[Epub3Exporter] Could not find exe_effects.js link generation to patch');
            }

            if (typeof content === 'string') {
                return transformedCode;
            }
            return new TextEncoder().encode(transformedCode);
        }

        // No transformation needed for other files
        return content;
    }

    /**
     * Generate EPUB guards script that prevents duplicate execution errors
     * This script runs BEFORE any libraries load and patches the global scope
     * to handle EPUB readers that re-execute scripts during page navigation.
     */
    protected generateEpubGuardsScript(): string {
        return `/**
 * EPUB Library Guards - eXeLearning
 * Prevents duplicate execution errors when EPUB readers re-execute scripts
 */
(function() {
    'use strict';
    if (window.__exeEpubGuardsLoaded) return;
    window.__exeEpubGuardsLoaded = true;
    
    // Pre-declare globals that would cause redeclaration errors
    if (typeof window.CursorControl === 'undefined') window.CursorControl = null;
    if (typeof window.$exeABCmusic === 'undefined') window.$exeABCmusic = null;
    if (typeof window.$exeExport === 'undefined') window.$exeExport = null;
    if (typeof window.synthControl === 'undefined') window.synthControl = undefined;
    if (typeof window.is_n_audio_ok === 'undefined') window.is_n_audio_ok = undefined;
    if (typeof window.abc === 'undefined') window.abc = [];
    
    console.log('[EPUB Guards] Library guards initialized');
})();`;
    }
}

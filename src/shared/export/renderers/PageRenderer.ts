/**
 * PageRenderer
 *
 * Renders complete HTML pages for export.
 * Generates full HTML5 pages matching legacy Symfony exports:
 * - Proper DOCTYPE and meta tags
 * - Scripts BEFORE CSS (legacy order requirement)
 * - CSS/JS includes for theme and iDevices
 * - Navigation menu structure with main-node class
 * - exe-client-search div with JSON data
 * - Page content with blocks and iDevices
 * - Pagination and license footer inside main
 *
 * This is a TypeScript port of public/app/yjs/exporters/renderers/PageHtmlRenderer.js
 */

import type { ExportPage, PageRenderOptions } from '../interfaces';
import { IdeviceRenderer } from './IdeviceRenderer';
import {
    LIBRARY_PATTERNS,
    getLicenseClass,
    formatLicenseText,
    shouldShowLicenseFooter,
    getLicenseUrl,
    formatShortLicenseText,
} from '../constants';
import { trans } from '../../../services/translation';
/**
 * PageRenderer class
 * Renders complete HTML pages for export
 */
export class PageRenderer {
    private ideviceRenderer: IdeviceRenderer;

    /**
     * @param ideviceRenderer - Renderer for iDevice content
     */
    constructor(ideviceRenderer: IdeviceRenderer | null = null) {
        this.ideviceRenderer = ideviceRenderer || new IdeviceRenderer();
    }

    /**
     * Check if a property value is truthy (handles both boolean and string "true")
     */
    private isTruthyProperty(value: unknown): boolean {
        return value === true || value === 'true';
    }

    /**
     * Check if a property value is falsy (handles both boolean and string "false")
     */
    private isFalsyProperty(value: unknown): boolean {
        return value === false || value === 'false';
    }

    /**
     * Render a complete HTML page
     * @param page - Page data
     * @param options - Rendering options
     * @returns Complete HTML document
     */
    render(page: ExportPage, options: PageRenderOptions): string {
        const {
            projectTitle = 'eXeLearning',
            language = 'en',
            customStyles = '',
            allPages = [],
            basePath = '',
            isIndex = false,
            usedIdevices = [],
            license = '',
            description = '',
            licenseUrl = '',
            // Page counter options
            totalPages,
            currentPageIndex,
            userFooterContent = '',
            // Export options (with defaults)
            addExeLink = true,
            addPagination = false,
            addSearchBox = false,
            addAccessibilityToolbar = false,
            addMathJax = false,
            // Custom head content
            extraHeadContent = '',
            // SCORM-specific options
            isScorm = false,
            scormVersion = '',
            bodyClass = '',
            extraHeadScripts = '',
            onLoadScript = '',
            onUnloadScript = '',
            detectedLibraries: providedDetectedLibraries,
            // Theme files (CSS/JS from theme root directory)
            themeFiles = [],
            // Navigation visibility options (for SCORM/IMS where LMS handles navigation)
            hideNavigation = false,
            hideNavButtons = false,
            // Asset URL transformation map
            assetExportPathMap,
            // Application version for generator meta tag
            version,
        } = options;

        const pageTitle = isIndex ? projectTitle : page.title || 'Page';

        // Detect libraries from ORIGINAL content (before transformation)
        // This is important for exe-package:elp links which get transformed during rendering
        const originalContent = this.collectPageContent(page);
        const detectedLibraries = providedDetectedLibraries ?? this.detectContentLibraries(originalContent);

        // Render page content (includes exe-package:elp → onclick transformation)
        const pageContent = this.renderPageContent(page, basePath, projectTitle, assetExportPathMap, {
            author: options.author,
            description: options.description,
            license: options.license,
            language: options.language,
        });

        // Calculate page counter values
        const total = totalPages ?? allPages.length;
        const currentIdx = currentPageIndex ?? allPages.findIndex(p => p.id === page.id);

        // Build body class
        const bodyClassStr = bodyClass || 'exe-export exe-web-site';
        const onLoadAttr = onLoadScript ? ` onload="${onLoadScript}"` : '';
        const onUnloadAttr = onUnloadScript ? ` onunload="${onUnloadScript}" onbeforeunload="${onUnloadScript}"` : '';

        // Build page header (with optional page counter)
        const pageHeaderHtml = this.renderPageHeader(page, {
            projectTitle,
            projectSubtitle: options.projectSubtitle,
            currentPageIndex: currentIdx,
            totalPages: total,
            addPagination,
            pageLabel: options.navLabels?.page,
        });

        // Build search box div (only if enabled)
        // Note: Search data is now in a separate search_index.js file, not embedded in the HTML
        const searchBoxHtml = addSearchBox
            ? `<div id="exe-client-search" data-block-order-string="Caja %e" data-no-results-string="Sin resultados.">
</div>`
            : '';

        // Build "Made with eXeLearning" link (only if enabled)
        const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe() : '';

        // Extract page filename map for navigation links (handles title collisions)
        const pageFilenameMap = options.pageFilenameMap;

        // Build navigation HTML (hidden for SCORM/IMS - LMS handles navigation)
        const navHtml = hideNavigation ? '' : this.renderNavigation(allPages, page.id, basePath, pageFilenameMap);

        // Build nav buttons HTML (hidden for SCORM/IMS - LMS handles navigation)
        const navButtonsHtml = hideNavButtons
            ? ''
            : this.renderNavButtons(page, allPages, basePath, options.navLabels, pageFilenameMap);

        return `<!DOCTYPE html>
<html lang="${language}" id="exe-${isIndex ? 'index' : page.id}">
<head>
${this.renderHead({ pageTitle, basePath, usedIdevices, customStyles, extraHeadScripts, isScorm, scormVersion, description, licenseUrl, addAccessibilityToolbar, addMathJax, extraHeadContent, addSearchBox, detectedLibraries, themeFiles, faviconPath: options.faviconPath, faviconType: options.faviconType, version })}
</head>
<body class="${bodyClassStr}"${onLoadAttr}${onUnloadAttr}>
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden"> ${navHtml}<main id="${page.id}" class="page"> ${searchBoxHtml}
${pageHeaderHtml}<div id="page-content-${page.id}" class="page-content">
${pageContent}
</div></main>${navButtonsHtml}
${this.renderFooterSection({ license, licenseUrl, userFooterContent, language })}
</div>
${madeWithExeHtml}
</body>
</html>`;
    }

    /**
     * Render HTML head section
     * Legacy order: SCRIPTS first, then CSS (required for proper initialization)
     * @param options - Head render options
     * @returns HTML head content
     */
    renderHead(options: {
        pageTitle: string;
        basePath: string;
        usedIdevices: string[];
        customStyles?: string;
        extraHeadScripts?: string;
        isScorm?: boolean;
        scormVersion?: string;
        description?: string;
        licenseUrl?: string;
        addAccessibilityToolbar?: boolean;
        addMathJax?: boolean;
        extraHeadContent?: string;
        addSearchBox?: boolean;
        detectedLibraries?: string[];
        themeFiles?: string[];
        faviconPath?: string;
        faviconType?: string;
        version?: string;
        isEpub?: boolean;
    }): string {
        const {
            pageTitle,
            basePath,
            usedIdevices,
            customStyles,
            extraHeadScripts = '',
            isScorm: _isScorm = false,
            description = '',
            licenseUrl = '',
            addAccessibilityToolbar = false,
            addMathJax = false,
            extraHeadContent = '',
            addSearchBox = false,
            detectedLibraries = [],
            themeFiles = [],
            faviconPath = 'libs/favicon.ico',
            faviconType = 'image/x-icon',
            version,
            isEpub = false,
        } = options;

        // Meta tags
        let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning${version ? ` ${version}` : ''}">
<meta name="viewport" content="width=device-width, initial-scale=1">
${licenseUrl ? `<link rel="license" type="text/html" href="${licenseUrl}">\n` : ''}<title>${this.escapeHtml(pageTitle)}</title>`;

        // Favicon
        head += `\n${this.renderFavicon(basePath, faviconPath, faviconType)}`;

        // Description meta if provided
        if (description) {
            head += `\n<meta name="description" content="${this.escapeAttr(description)}">`;
        }

        // SCRIPTS FIRST (legacy order requirement)
        head += `
<script>document.querySelector("html").classList.add("js");</script>`;

        // EPUB guard script (must load before any libraries to prevent duplicate execution errors)
        if (isEpub) {
            head += `<script src="${basePath}libs/exe_epub_guards.js"> </script>`;
        }

        // Core library scripts
        head += `<script src="${basePath}libs/jquery/jquery.min.js"> </script>`;
        head += `<script src="${basePath}libs/common_i18n.js"> </script>`;
        head += `<script src="${basePath}libs/common.js"> </script>`;
        head += `<script src="${basePath}libs/exe_export.js"> </script>`;

        // Search index script (loads before exe_export.js initializes)
        if (addSearchBox) {
            head += `<script src="${basePath}search_index.js"> </script>`;
        }

        head += `<script src="${basePath}libs/bootstrap/bootstrap.bundle.min.js"> </script>`;

        // CSS AFTER scripts (legacy order)
        head += `<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">`;

        // iDevice-specific scripts and CSS (script before CSS for each)
        const jsScripts = this.ideviceRenderer.getJsScripts(usedIdevices, basePath);
        const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, basePath);
        for (let i = 0; i < jsScripts.length; i++) {
            head += `\n${jsScripts[i]}`;
            if (cssLinks[i]) {
                head += cssLinks[i];
            }
        }

        // Content-detected libraries (e.g., exe_lightbox, exe_highlighter, etc.)
        for (const libName of detectedLibraries) {
            const libPattern = LIBRARY_PATTERNS.find(p => p.name === libName);
            if (!libPattern) continue;

            // Add JS files first, then CSS files (legacy order)
            const jsFiles = libPattern.files.filter(f => f.endsWith('.js'));
            const cssFiles = libPattern.files.filter(f => f.endsWith('.css'));

            for (const jsFile of jsFiles) {
                head += `\n<script src="${basePath}libs/${jsFile}"> </script>`;
            }
            for (const cssFile of cssFiles) {
                head += `\n<link rel="stylesheet" href="${basePath}libs/${cssFile}">`;
            }
        }
        // Accessibility toolbar (JS first, then CSS)
        if (addAccessibilityToolbar) {
            head += `\n<script src="${basePath}libs/exe_atools/exe_atools.js"> </script>`;
            head += `<link rel="stylesheet" href="${basePath}libs/exe_atools/exe_atools.css">`;
        }
        // Base CSS and theme
        head += `\n<link rel="stylesheet" href="${basePath}content/css/base.css">`;

        // Theme files: include all JS first, then all CSS, in alphabetical order
        // If themeFiles is empty, fall back to legacy names for backwards compatibility
        if (themeFiles.length > 0) {
            // Sort files alphabetically and separate JS from CSS
            const sortedFiles = [...themeFiles].sort();
            const jsFiles = sortedFiles.filter(f => f.endsWith('.js'));
            const cssFiles = sortedFiles.filter(f => f.endsWith('.css'));

            // JS first (legacy order: scripts before CSS)
            for (const jsFile of jsFiles) {
                head += `<script src="${basePath}theme/${jsFile}"> </script>`;
            }
            // Then CSS
            for (const cssFile of cssFiles) {
                head += `<link rel="stylesheet" href="${basePath}theme/${cssFile}">`;
            }
        } else {
            // Legacy fallback for backwards compatibility
            head += `<script src="${basePath}theme/default.js"> </script>`;
            head += `<link rel="stylesheet" href="${basePath}theme/content.css">`;
        }

        // Custom styles
        if (customStyles) {
            head += `\n<style>\n${customStyles}\n</style>`;
        }

        // MathJax library (for math formulas with accessibility features)
        if (addMathJax) {
            head += `\n<script src="${basePath}libs/exe_math/tex-mml-svg.js"> </script>`;
        }

        // Custom head content (from project properties)
        if (extraHeadContent) {
            head += `\n${extraHeadContent}`;
        }

        // SCORM-specific scripts in head
        if (extraHeadScripts) {
            head += `\n${extraHeadScripts}`;
        }

        return head;
    }

    /**
     * Render navigation menu
     * @param allPages - All pages in the project
     * @param currentPageId - ID of the current page
     * @param basePath - Base path for links
     * @returns Navigation HTML
     */
    renderNavigation(
        allPages: ExportPage[],
        currentPageId: string,
        basePath: string,
        pageFilenameMap?: Map<string, string>,
    ): string {
        const rootPages = allPages.filter(p => !p.parentId);

        let html = '<nav id="siteNav">\n<ul>\n';
        for (const page of rootPages) {
            html += this.renderNavItem(page, allPages, currentPageId, basePath, pageFilenameMap);
        }
        html += '</ul>\n</nav>';

        return html;
    }

    /**
     * Render a single navigation item (recursive for children)
     * @param page - Page to render
     * @param allPages - All pages
     * @param currentPageId - Current page ID
     * @param basePath - Base path
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional)
     * @returns Navigation item HTML
     */
    renderNavItem(
        page: ExportPage,
        allPages: ExportPage[],
        currentPageId: string,
        basePath: string,
        pageFilenameMap?: Map<string, string>,
    ): string {
        // Skip hidden pages (except we check at parent level to preserve hierarchy)
        if (!this.isPageVisible(page, allPages)) {
            return '';
        }

        // Filter children to only visible ones
        const children = allPages.filter(p => p.parentId === page.id && this.isPageVisible(p, allPages));
        const isCurrent = page.id === currentPageId;
        const hasChildren = children.length > 0;
        const isAncestor = this.isAncestorOf(page.id, currentPageId, allPages);
        const isFirstPage = page.id === allPages[0]?.id;

        // Build li class attribute
        const liClass = isCurrent ? ' class="active"' : isAncestor ? ' class="current-page-parent"' : '';
        const link = this.getPageLink(page, allPages, basePath, pageFilenameMap);

        // Build link classes: main-node for first page, daddy/no-ch for children, active if current
        const linkClasses: string[] = [];
        if (isCurrent) linkClasses.push('active');
        if (isFirstPage) linkClasses.push('main-node');
        linkClasses.push(hasChildren ? 'daddy' : 'no-ch');

        // Add highlighted-link class if page is highlighted
        if (this.isPageHighlighted(page)) {
            linkClasses.push('highlighted-link');
        }

        let html = `<li${liClass}>`;
        html += ` <a href="${link}" class="${linkClasses.join(' ')}">${this.escapeHtml(page.title)}</a>\n`;

        if (hasChildren) {
            html += '<ul class="other-section">\n';
            for (const child of children) {
                html += this.renderNavItem(child, allPages, currentPageId, basePath, pageFilenameMap);
            }
            html += '</ul>\n';
        }

        html += '</li>\n';
        return html;
    }

    /**
     * Check if a page is an ancestor of another
     * @param ancestorId - Potential ancestor ID
     * @param childId - Child ID
     * @param allPages - All pages
     * @returns True if ancestorId is an ancestor of childId
     */
    isAncestorOf(ancestorId: string, childId: string, allPages: ExportPage[]): boolean {
        const child = allPages.find(p => p.id === childId);
        if (!child || !child.parentId) return false;
        if (child.parentId === ancestorId) return true;
        return this.isAncestorOf(ancestorId, child.parentId, allPages);
    }

    /**
     * Check if a page is visible in export
     * First page is always visible regardless of visibility setting.
     * If a parent is hidden, all its children are also hidden.
     * @param page - Page to check
     * @param allPages - All pages
     * @returns True if page should be visible
     */
    isPageVisible(page: ExportPage, allPages: ExportPage[]): boolean {
        // First page is always visible
        if (page.id === allPages[0]?.id) {
            return true;
        }

        // Check this page's visibility property
        if (this.isFalsyProperty(page.properties?.visibility)) {
            return false;
        }

        // Check if any ancestor is hidden (recursive)
        if (page.parentId) {
            const parent = allPages.find(p => p.id === page.parentId);
            if (parent && !this.isPageVisible(parent, allPages)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Filter pages to only include visible ones
     * @param pages - All pages
     * @returns Pages that should be visible in navigation and exports
     */
    getVisiblePages(pages: ExportPage[]): ExportPage[] {
        return pages.filter(page => this.isPageVisible(page, pages));
    }

    /**
     * Check if a page has highlight property enabled
     * @param page - Page to check
     * @returns True if page should be highlighted in navigation
     */
    isPageHighlighted(page: ExportPage): boolean {
        return this.isTruthyProperty(page.properties?.highlight);
    }

    /**
     * Check if a page's title should be hidden
     * @param page - Page to check
     * @returns True if page title should be hidden
     */
    shouldHidePageTitle(page: ExportPage): boolean {
        return this.isTruthyProperty(page.properties?.hidePageTitle);
    }

    /**
     * Get effective page title (respects editableInPage + titlePage properties)
     * If editableInPage is true and titlePage is set, use titlePage
     * Otherwise use the default page title
     * @param page - Page to get title for
     * @returns Effective title string
     */
    getEffectivePageTitle(page: ExportPage): string {
        if (this.isTruthyProperty(page.properties?.editableInPage)) {
            const titlePage = page.properties?.titlePage as string;
            if (titlePage) return titlePage;
        }
        return page.title;
    }

    /**
     * Get page link URL
     * @param page - Page
     * @param allPages - All pages
     * @param basePath - Base path
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     * @returns Link URL
     */
    getPageLink(
        page: ExportPage,
        allPages: ExportPage[],
        basePath: string,
        pageFilenameMap?: Map<string, string>,
    ): string {
        const isFirstPage = page.id === allPages[0]?.id;
        if (isFirstPage) {
            return basePath ? `${basePath}index.html` : 'index.html';
        }
        // Use unique filename from map if available (already includes .html),
        // otherwise generate from title (need to add .html)
        const mapFilename = pageFilenameMap?.get(page.id);
        const filename = mapFilename || `${this.sanitizeFilename(page.title)}.html`;
        return `${basePath}html/${filename}`;
    }

    /**
     * Sanitize title for use as filename
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title: string): string {
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
     * Render page header with page counter, package title (h1), subtitle, and page title (h2)
     * @param page - Page
     * @param options - Header options including counter info
     * @returns Header HTML
     */
    renderPageHeader(
        page: ExportPage,
        options: {
            projectTitle: string;
            projectSubtitle?: string;
            currentPageIndex: number;
            totalPages: number;
            addPagination?: boolean;
            pageLabel?: string;
        },
    ): string {
        const { projectTitle, projectSubtitle, currentPageIndex, totalPages, addPagination, pageLabel } = options;

        // Page counter is only shown if addPagination is true
        const pageCounterHtml = addPagination
            ? ` <p class="page-counter"> <span class="page-counter-label">${pageLabel || 'Page'} </span><span class="page-counter-content"> <strong class="page-counter-current-page">${currentPageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalPages}</strong></span></p>\n`
            : '';

        // Check if page title should be hidden and get effective title
        const hideTitle = this.shouldHidePageTitle(page);
        const effectiveTitle = this.getEffectivePageTitle(page);
        // Use sr-av class on .page-title for hiding (matches legacy Symfony approach)
        // This ensures title stays hidden even when theme JS (flux, neo, nova, zen)
        // moves the .page-title element out of .page-header via movePageTitle()
        const pageTitleClass = hideTitle ? 'page-title sr-av' : 'page-title';

        // Render subtitle if present
        const subtitleHtml = projectSubtitle
            ? `\n<p class="package-subtitle">${this.escapeHtml(projectSubtitle)}</p>`
            : '';

        // Wrap headers in main-header so theme JS (e.g., flux movePageTitle) can find them
        // Theme JS looks for '.main-header .page-header' to move title into .page-content
        // Note: page-counter is inside main-header for CSS compatibility with legacy themes
        return `<header class="main-header">${pageCounterHtml}
<div class="package-header"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>${subtitleHtml}</div>
<div class="page-header"><h2 class="${pageTitleClass}">${this.escapeHtml(effectiveTitle)}</h2></div>
</header>`;
    }

    /**
     * Render page content (blocks with iDevices)
     * @param page - Page
     * @param basePath - Base path
     * @param projectTitle - Project title (for exe-package:elp transformation)
     * @param assetExportPathMap - Map of asset UUID to export path for URL transformation
     * @returns Content HTML
     */
    renderPageContent(
        page: ExportPage,
        basePath: string,
        projectTitle?: string,
        assetExportPathMap?: Map<string, string>,
        metadata?: { author?: string; description?: string; license?: string; language?: string },
    ): string {
        let html = '';

        for (const block of page.blocks || []) {
            html += this.ideviceRenderer.renderBlock(block, {
                basePath,
                includeDataAttributes: true,
                assetExportPathMap,
            });
        }

        // Transform exe-package:elp protocol to onclick handler (for download-source-file)
        // This is done here at render time, not during preprocessing, so the XML keeps the original protocol
        if (projectTitle) {
            html = this.replaceElpxProtocol(html, projectTitle);
        }

        // Sync project properties for download-source-file and similar iDevices
        if (html.includes('exe-prop-')) {
            const safeTitle = this.escapeHtml(projectTitle || '-');
            const safeAuthor = this.escapeHtml(metadata?.author || '-');
            const safeDesc = this.escapeHtml(metadata?.description || '-');
            const safeLicense = this.escapeHtml(metadata?.license ? formatShortLicenseText(metadata.license) : '-');

            let safeLicenseHtml = safeLicense;
            if (metadata?.license) {
                const shortText = formatShortLicenseText(metadata.license);
                const isStandardCC = shortText.startsWith('Creative Commons');

                if (isStandardCC) {
                    const licenseUrl = getLicenseUrl(metadata.license);
                    if (licenseUrl) {
                        const cssClass = getLicenseClass(metadata.license);
                        const classAttr = cssClass ? ` class="${cssClass}"` : '';
                        safeLicenseHtml = `<a href="${licenseUrl}" rel="license"${classAttr}><span></span>${safeLicense}</a>`;
                    }
                } else if (
                    ['propietary license', 'not appropriate', 'public domain'].includes(
                        metadata.license.toLowerCase().trim(),
                    )
                ) {
                    let displayName = metadata.license;
                    if (metadata.license.toLowerCase().trim() === 'propietary license')
                        displayName = 'Proprietary license';
                    if (metadata.license.toLowerCase().trim() === 'not appropriate') displayName = 'Not appropriate';
                    if (metadata.license.toLowerCase().trim() === 'public domain') displayName = 'Public domain';
                    safeLicenseHtml = this.escapeHtml(trans(displayName, {}, metadata.language));
                }
            }

            // Strip out the read-only classes from the <td> wrappers just in case they slipped through
            html = html.replace(/<td class="mceNonEditable exe-prop-locked\s*"[^>]*>/g, '<td>');

            html = html.replace(
                /<span class="exe-prop-title[^>]*>.*?<\/span>/g,
                `<span class="exe-prop-title">${safeTitle}</span>`,
            );
            html = html.replace(
                /<span class="exe-prop-author[^>]*>.*?<\/span>/g,
                `<span class="exe-prop-author">${safeAuthor}</span>`,
            );
            html = html.replace(
                /<span class="exe-prop-description[^>]*>.*?<\/span>/g,
                `<span class="exe-prop-description">${safeDesc}</span>`,
            );
            html = html.replace(
                /<span class="exe-prop-license[^>]*>[\s\S]*?(?=<\/td>|<\/p>|<\/div>|<\/li>|$)/g,
                `<span class="exe-prop-license">${safeLicenseHtml}</span>`,
            );
        }

        return html;
    }

    /**
     * Collect all content from a page's components (for library detection)
     * @param page - Page to collect content from
     * @returns Combined HTML content from all components
     */
    collectPageContent(page: ExportPage): string {
        const parts: string[] = [];
        for (const block of page.blocks || []) {
            for (const component of block.components || []) {
                if (component.content) {
                    parts.push(component.content);
                }
            }
        }
        return parts.join('\n');
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
        if (!content || !content.includes('exe-package:elp')) {
            return content;
        }

        // Replace href="exe-package:elp" with onclick handler
        let result = content.replace(
            /href="exe-package:elp"/g,
            'href="#" onclick="if(typeof downloadElpx===\'function\')downloadElpx();return false;"',
        );

        // Replace download="exe-package:elp-name" with actual filename
        const safeTitle = this.escapeHtml(projectTitle);
        result = result.replace(/download="exe-package:elp-name"/g, `download="${safeTitle}.elpx"`);

        return result;
    }

    /**
     * Render navigation buttons (prev/next links).
     * Uses pre-translated labels resolved at export time from XLF translations,
     * so the exported HTML already contains the correct text for the content language.
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @param navLabels - Translated labels ({ previous, next }); defaults to English
     * @param pageFilenameMap - Optional map for collision-safe filenames
     * @returns Navigation buttons HTML
     */
    renderNavButtons(
        page: ExportPage,
        allPages: ExportPage[],
        basePath: string,
        navLabels?: { previous: string; next: string },
        pageFilenameMap?: Map<string, string>,
    ): string {
        const prevLabel = navLabels?.previous || 'Previous';
        const nextLabel = navLabels?.next || 'Next';

        const currentIndex = allPages.findIndex(p => p.id === page.id);
        const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
        const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

        const parts: string[] = ['<div class="nav-buttons">'];

        if (prevPage) {
            const link = this.getPageLink(prevPage, allPages, basePath, pageFilenameMap);
            parts.push(
                `<a href="${link}" title="${prevLabel}" class="nav-button nav-button-left"><span>${prevLabel}</span></a>`,
            );
        } else {
            parts.push(`<span class="nav-button nav-button-left" aria-hidden="true"><span>${prevLabel}</span></span>`);
        }

        if (nextPage) {
            const link = this.getPageLink(nextPage, allPages, basePath, pageFilenameMap);
            parts.push(
                `<a href="${link}" title="${nextLabel}" class="nav-button nav-button-right"><span>${nextLabel}</span></a>`,
            );
        } else {
            parts.push(`<span class="nav-button nav-button-right" aria-hidden="true"><span>${nextLabel}</span></span>`);
        }

        parts.push('</div>');
        return parts.join('\n');
    }

    /**
     * Render pagination (prev/next links) - legacy method kept for backward compatibility
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @param language - Language for button text translation
     * @returns Pagination HTML
     * @deprecated Use renderNavButtons instead
     */
    renderPagination(page: ExportPage, allPages: ExportPage[], basePath: string): string {
        return this.renderNavButtons(page, allPages, basePath);
    }

    /**
     * Render complete footer section with license and optional user content
     * @param options - Footer options
     * @returns Footer HTML with siteFooter wrapper
     */
    renderFooterSection(options: {
        license: string;
        licenseUrl?: string;
        userFooterContent?: string;
        language?: string;
    }): string {
        const { license, licenseUrl = '', userFooterContent, language = 'en' } = options;

        let userFooterHtml = '';
        if (userFooterContent) {
            userFooterHtml = `<div id="siteUserFooter"> <div>${userFooterContent}</div>\n</div>`;
        }

        // Skip license section for:
        // - Empty license (no license specified, legacy content with unknown license)
        // - "propietary license" and "not appropriate" (no meaningful license to display)
        if (!shouldShowLicenseFooter(license)) {
            return `<footer id="siteFooter"><div id="siteFooterContent">${userFooterHtml}</div></footer>`;
        }

        const licenseText = formatLicenseText(license);
        const translatedLicenseText = trans(licenseText, {}, language);
        const licenseClass = getLicenseClass(license);

        // If there's a license URL, create a link; otherwise, just show the text
        const licenseContent = licenseUrl
            ? `<a href="${licenseUrl}" class="license">${translatedLicenseText}</a>`
            : `<span class="license">${translatedLicenseText}</span>`;

        return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="${licenseClass}"> <p> <span class="license-label">Licencia: </span>${licenseContent}</p>
</div>
${userFooterHtml}</div></footer>`;
    }

    /**
     * Render "Made with eXeLearning" credit
     * @returns Made with eXe HTML
     */
    renderMadeWithEXe(): string {
        return `<p id="made-with-eXe"> <a href="https://exelearning.net/" target="_blank" rel="noopener"> <span>Creado con eXeLearning <span>(nueva ventana)</span></span></a></p>`;
    }

    /**
     * Render license div (inside main, before pagination)
     * @param options - License options
     * @returns License HTML
     * @deprecated Use renderFooterSection instead
     */
    renderLicense(options: { author: string; license: string; licenseUrl?: string }): string {
        const { license, licenseUrl = '' } = options;

        // Skip license for empty, "propietary license", and "not appropriate"
        if (!shouldShowLicenseFooter(license)) {
            return '';
        }

        // If there's a license URL, create a link; otherwise, just show the text
        const licenseContent = licenseUrl
            ? `<a rel="license" href="${licenseUrl}">${this.escapeHtml(license)}</a>`
            : `<span>${this.escapeHtml(license)}</span>`;

        return `<div id="packageLicense" class="${getLicenseClass(license)}">
<p><span>Licensed under the</span> ${licenseContent}</p>
</div>`;
    }

    /**
     * Render footer section (legacy method, kept for backward compatibility)
     * @param options - Footer options
     * @returns Footer HTML
     * @deprecated Use renderFooterSection instead
     */
    renderFooter(options: { author: string; license: string }): string {
        return this.renderLicense({ ...options, licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' });
    }

    /**
     * Generate search data JSON for client-side search functionality
     * @param allPages - All pages in the project
     * @param _basePath - Base path for URLs (unused but kept for API compatibility)
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     * @returns JSON string with page structure
     */
    generateSearchData(allPages: ExportPage[], _basePath: string, pageFilenameMap?: Map<string, string>): string {
        const pagesData: Record<string, unknown> = {};

        for (let i = 0; i < allPages.length; i++) {
            const page = allPages[i];
            const isIndex = i === 0;
            const prevPage = i > 0 ? allPages[i - 1] : null;
            const nextPage = i < allPages.length - 1 ? allPages[i + 1] : null;

            // Use unique filename from map if available, otherwise generate from title
            const mapFilename = pageFilenameMap?.get(page.id);
            const fileName = isIndex ? 'index.html' : mapFilename || `${this.sanitizeFilename(page.title)}.html`;
            const fileUrl = isIndex ? 'index.html' : `html/${fileName}`;

            const blocksData: Record<string, unknown> = {};
            for (const block of page.blocks || []) {
                const idevicesData: Record<string, unknown> = {};
                for (let j = 0; j < (block.components || []).length; j++) {
                    const component = block.components[j];
                    idevicesData[component.id] = {
                        order: j + 1,
                        htmlView: component.content || '',
                        jsonProperties: JSON.stringify(component.properties || {}),
                    };
                }
                blocksData[block.id] = {
                    name: block.name || '',
                    order: block.order || 1,
                    idevices: idevicesData,
                };
            }

            pagesData[page.id] = {
                name: page.title,
                isIndex,
                fileName,
                fileUrl,
                prePageId: prevPage?.id || null,
                nextPageId: nextPage?.id || null,
                blocks: blocksData,
            };
        }

        return JSON.stringify(pagesData);
    }

    /**
     * Generate the content for search_index.js file
     * @param allPages - All pages in the project
     * @param basePath - Base path for URLs
     * @param pageFilenameMap - Map of page IDs to unique filenames (optional, handles title collisions)
     * @returns JavaScript file content with window.exeSearchData assignment
     */
    generateSearchIndexFile(allPages: ExportPage[], basePath: string, pageFilenameMap?: Map<string, string>): string {
        const searchDataJson = this.generateSearchData(allPages, basePath, pageFilenameMap);
        return `window.exeSearchData = ${searchDataJson};`;
    }

    /**
     * Render favicon link tag
     * @param basePath - Base path for links
     * @param faviconPath - Path to favicon file
     * @param faviconType - MIME type of favicon
     * @returns Link tag HTML
     */
    renderFavicon(
        basePath: string,
        faviconPath: string = 'libs/favicon.ico',
        faviconType: string = 'image/x-icon',
    ): string {
        const faviconHref = `${basePath}${faviconPath}`;
        return `<link rel="icon" type="${this.escapeAttr(faviconType)}" href="${this.escapeAttr(faviconHref)}">`;
    }

    /**
     * Render a single-page HTML document with all pages
     * @param allPages - All pages in the project
     * @param options - Rendering options
     * @returns Complete HTML document
     */
    renderSinglePage(
        allPages: ExportPage[],
        options: {
            projectTitle?: string;
            projectSubtitle?: string;
            language?: string;
            customStyles?: string;
            usedIdevices?: string[];
            author?: string;
            license?: string;
            licenseUrl?: string;
            description?: string;
            faviconPath?: string;
            faviconType?: string;
            detectedLibraries?: string[];
            addMathJax?: boolean;
            addAccessibilityToolbar?: boolean;
            version?: string;
            addExeLink?: boolean;
            userFooterContent?: string;
        } = {},
    ): string {
        const {
            projectTitle = 'eXeLearning',
            projectSubtitle = '',
            language = 'en',
            customStyles = '',
            usedIdevices = [],
            license = '',
            licenseUrl = '',
            description = '',
            faviconPath = 'libs/favicon.ico',
            faviconType = 'image/x-icon',
            addExeLink = true,
            userFooterContent = '',
            version,
            detectedLibraries = [],
            addMathJax = false,
            addAccessibilityToolbar = false,
        } = options;

        let contentHtml = '';
        const effectiveDetectedLibraries =
            detectedLibraries.length > 0 ? detectedLibraries : this.detectContentLibrariesForPages(allPages);

        for (const page of allPages) {
            // Check if page title should be hidden and get effective title
            const hideTitle = this.shouldHidePageTitle(page);
            const effectiveTitle = this.getEffectivePageTitle(page);
            // Use sr-av class on .page-title for hiding (matches legacy Symfony approach)
            // This ensures title stays hidden even when theme JS (flux, neo, nova, zen)
            // moves the .page-title element out of .page-header via movePageTitle()
            const pageTitleClass = hideTitle ? 'page-title sr-av' : 'page-title';

            // Single-page sections use main-header > page-header structure for CSS compatibility
            contentHtml += `<section id="section-${page.id}">
<header class="main-header">
<div class="page-header">
<h1 class="${pageTitleClass}">${this.escapeHtml(effectiveTitle)}</h1>
</div>
</header>
<div class="page-content">
${this.renderPageContent(page, '', projectTitle, undefined, {
    author: options.author,
    description: options.description,
    license: options.license,
    language: options.language,
})}
</div>
</section>\n`;
        }

        // Build head with scripts first, then CSS (legacy order)
        const jsScripts = this.ideviceRenderer.getJsScripts(usedIdevices, '');
        const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, '');

        let ideviceIncludes = '';
        for (let i = 0; i < jsScripts.length; i++) {
            ideviceIncludes += `\n${jsScripts[i]}`;
            if (cssLinks[i]) {
                ideviceIncludes += cssLinks[i];
            }
        }

        return `<!DOCTYPE html>
<html lang="${language}" id="exe-index">
<head>
<meta charset="utf-8">
<meta name="generator" content="eXeLearning${version ? ` ${version}` : ''}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)}</title>
<script>document.querySelector("html").classList.add("js");</script>
<script src="libs/jquery/jquery.min.js"> </script>
<script src="libs/common_i18n.js"> </script>
<script src="libs/common.js"> </script>
<script src="libs/exe_export.js"> </script>
<script src="libs/bootstrap/bootstrap.bundle.min.js"> </script>
<link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css">${ideviceIncludes}
<link rel="stylesheet" href="content/css/base.css">
<script src="theme/style.js"> </script>
<link rel="stylesheet" href="theme/style.css">
${this.renderFavicon('', faviconPath, faviconType)}
${customStyles ? `<style>\n${customStyles}\n</style>` : ''}
${this.renderDetectedLibraries(effectiveDetectedLibraries, '')}
${addAccessibilityToolbar ? `<script src="libs/exe_atools/exe_atools.js"> </script>\n<link rel="stylesheet" href="libs/exe_atools/exe_atools.css">` : ''}
${addMathJax ? `<script src="libs/exe_math/tex-mml-svg.js"> </script>` : ''}
</head>
<body class="exe-export exe-single-page">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden">
<main class="page">
<header class="package-header"><h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>${projectSubtitle ? `\n<p class="package-subtitle">${this.escapeHtml(projectSubtitle)}</p>` : ''}</header>
${contentHtml}
</main>
${this.renderFooterSection({ license, licenseUrl, userFooterContent })}
</div>
${addExeLink ? this.renderMadeWithEXe() : ''}
</body>
</html>`;
    }

    /**
     * Render navigation for single-page export (anchor links)
     * @param allPages - All pages
     * @returns Navigation HTML
     */
    renderSinglePageNav(allPages: ExportPage[]): string {
        const rootPages = allPages.filter(p => !p.parentId);

        let html = '<nav id="siteNav" class="single-page-nav">\n<ul>\n';
        for (const page of rootPages) {
            html += this.renderSinglePageNavItem(page, allPages);
        }
        html += '</ul>\n</nav>';

        return html;
    }

    /**
     * Render a single navigation item for single-page (anchor links)
     * @param page - Page
     * @param allPages - All pages
     * @returns Navigation item HTML
     */
    renderSinglePageNavItem(page: ExportPage, allPages: ExportPage[]): string {
        // Skip hidden pages
        if (!this.isPageVisible(page, allPages)) {
            return '';
        }

        // Filter children to only visible ones
        const children = allPages.filter(p => p.parentId === page.id && this.isPageVisible(p, allPages));
        const hasChildren = children.length > 0;

        // Build link classes
        const linkClasses: string[] = [];
        linkClasses.push(hasChildren ? 'daddy' : 'no-ch');

        // Add highlighted-link class if page is highlighted
        if (this.isPageHighlighted(page)) {
            linkClasses.push('highlighted-link');
        }

        let html = '<li>';
        html += ` <a href="#section-${page.id}" class="${linkClasses.join(' ')}">${this.escapeHtml(page.title)}</a>\n`;

        if (hasChildren) {
            html += '<ul class="other-section">\n';
            for (const child of children) {
                html += this.renderSinglePageNavItem(child, allPages);
            }
            html += '</ul>\n';
        }

        html += '</li>\n';
        return html;
    }

    /**
     * Detect content-based libraries from HTML content
     * Scans the content for patterns that indicate specific libraries are needed
     * @param html - HTML content to scan
     * @returns Array of library names detected
     */
    detectContentLibraries(html: string): string[] {
        const detectedLibs: Set<string> = new Set();

        for (const lib of LIBRARY_PATTERNS) {
            let found = false;

            switch (lib.type) {
                case 'class':
                    // Look for class="...pattern..." or class='...pattern...'
                    found =
                        html.includes(`class="${lib.pattern}"`) ||
                        html.includes(`class='${lib.pattern}'`) ||
                        new RegExp(`class="[^"]*\\b${lib.pattern}\\b[^"]*"`, 'i').test(html) ||
                        new RegExp(`class='[^']*\\b${lib.pattern}\\b[^']*'`, 'i').test(html);
                    break;

                case 'rel':
                    // Look for rel="pattern"
                    found = html.includes(`rel="${lib.pattern}"`) || html.includes(`rel='${lib.pattern}'`);
                    break;

                case 'regex':
                    // Use provided regex pattern (e.g., for exe-package:elp protocol)
                    found = (lib.pattern as RegExp).test(html);
                    break;
            }

            if (found) {
                detectedLibs.add(lib.name);
            }
        }

        return Array.from(detectedLibs);
    }

    private detectContentLibrariesForPages(pages: ExportPage[]): string[] {
        const detectedLibs = new Set<string>();
        for (const page of pages) {
            for (const libName of this.detectContentLibraries(this.collectPageContent(page))) {
                detectedLibs.add(libName);
            }
        }
        return Array.from(detectedLibs);
    }

    /**
     * Escape HTML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeHtml(str: string): string {
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
     * Escape attribute value for use in HTML attributes
     * @param str - String to escape
     * @returns Escaped string safe for attribute values
     */
    escapeAttr(str: string): string {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Render detected libraries scripts and CSS
     * @param detectedLibraries - List of detected library names
     * @param basePath - Base path for URLs
     * @returns HTML for library includes
     */
    private renderDetectedLibraries(detectedLibraries: string[], basePath: string): string {
        let html = '';
        for (const libName of detectedLibraries) {
            const libPattern = LIBRARY_PATTERNS.find(p => p.name === libName);
            if (!libPattern) continue;

            const jsFiles = libPattern.files.filter(f => f.endsWith('.js'));
            const cssFiles = libPattern.files.filter(f => f.endsWith('.css'));

            for (const jsFile of jsFiles) {
                html += `\n<script src="${basePath}libs/${jsFile}"> </script>`;
            }
            for (const cssFile of cssFiles) {
                html += `\n<link rel="stylesheet" href="${basePath}libs/${cssFile}">`;
            }
        }
        return html;
    }
}

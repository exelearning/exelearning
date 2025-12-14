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
            license = 'creative commons: attribution - share alike 4.0',
            description = '',
            licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/',
            // Page counter options
            totalPages,
            currentPageIndex,
            userFooterContent = '',
            // Export options (with defaults)
            addExeLink = true,
            addPagination = false,
            addSearchBox = false,
            addAccessibilityToolbar = false,
            // Custom head content
            extraHeadContent = '',
            // SCORM-specific options
            isScorm = false,
            scormVersion = '',
            bodyClass = '',
            extraHeadScripts = '',
            onLoadScript = '',
            onUnloadScript = '',
        } = options;

        const pageTitle = isIndex ? projectTitle : page.title || 'Page';

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
            currentPageIndex: currentIdx,
            totalPages: total,
            addPagination,
        });

        // Build search box div (only if enabled)
        // Note: Search data is now in a separate search_index.js file, not embedded in the HTML
        const searchBoxHtml = addSearchBox
            ? `<div id="exe-client-search" data-block-order-string="Caja %e" data-no-results-string="Sin resultados.">
</div>`
            : '';

        // Build "Made with eXeLearning" link (only if enabled)
        const madeWithExeHtml = addExeLink ? this.renderMadeWithEXe() : '';

        return `<!DOCTYPE html>
<html lang="${language}" id="exe-${isIndex ? 'index' : page.id}">
<head>
${this.renderHead({ pageTitle, basePath, usedIdevices, customStyles, extraHeadScripts, isScorm, scormVersion, description, licenseUrl, addAccessibilityToolbar, extraHeadContent, addSearchBox })}
</head>
<body class="${bodyClassStr}" lang="${language}"${onLoadAttr}${onUnloadAttr}>
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden"> ${this.renderNavigation(allPages, page.id, basePath)}${pageHeaderHtml}<div id="page-content-${page.id}" class="page-content"> <main id="${page.id}" class="page"> ${searchBoxHtml}
${this.renderPageContent(page, basePath)}
</main></div>${this.renderNavButtons(page, allPages, basePath)}
${this.renderFooterSection({ license, licenseUrl, userFooterContent })}
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
        extraHeadContent?: string;
        addSearchBox?: boolean;
    }): string {
        const {
            pageTitle,
            basePath,
            usedIdevices,
            customStyles,
            extraHeadScripts = '',
            isScorm: _isScorm = false,
            description = '',
            licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/',
            addAccessibilityToolbar = false,
            extraHeadContent = '',
            addSearchBox = false,
        } = options;

        // Meta tags
        let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning v3.0.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="license" type="text/html" href="${licenseUrl}">
<title>${this.escapeHtml(pageTitle)}</title>`;

        // Description meta if provided
        if (description) {
            head += `\n<meta name="description" content="${this.escapeAttr(description)}">`;
        }

        // SCRIPTS FIRST (legacy order requirement)
        head += `
<script>document.querySelector("html").classList.add("js");</script>`;

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
        head += `<script src="${basePath}libs/exe_lightbox/exe_lightbox.js"> </script>`;

        // CSS AFTER scripts (legacy order)
        head += `<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">`;
        head += `\n<link rel="stylesheet" href="${basePath}libs/exe_lightbox/exe_lightbox.css">`;

        // iDevice-specific scripts and CSS (script before CSS for each)
        const jsScripts = this.ideviceRenderer.getJsScripts(usedIdevices, basePath);
        const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, basePath);
        for (let i = 0; i < jsScripts.length; i++) {
            head += `\n${jsScripts[i]}`;
            if (cssLinks[i]) {
                head += cssLinks[i];
            }
        }

        // Base CSS and theme
        head += `\n<link rel="stylesheet" href="${basePath}content/css/base.css">`;
        head += `<script src="${basePath}theme/default.js"> </script>`;
        head += `<link rel="stylesheet" href="${basePath}theme/content.css">`;

        // Custom styles
        if (customStyles) {
            head += `\n<style>\n${customStyles}\n</style>`;
        }

        // Accessibility toolbar (JS first, then CSS)
        if (addAccessibilityToolbar) {
            head += `\n<script src="${basePath}libs/exe_atools/exe_atools.js"> </script>`;
            head += `<link rel="stylesheet" href="${basePath}libs/exe_atools/exe_atools.css">`;
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
    renderNavigation(allPages: ExportPage[], currentPageId: string, basePath: string): string {
        const rootPages = allPages.filter(p => !p.parentId);

        let html = '<nav id="siteNav">\n<ul>\n';
        for (const page of rootPages) {
            html += this.renderNavItem(page, allPages, currentPageId, basePath);
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
     * @returns Navigation item HTML
     */
    renderNavItem(page: ExportPage, allPages: ExportPage[], currentPageId: string, basePath: string): string {
        const children = allPages.filter(p => p.parentId === page.id);
        const isCurrent = page.id === currentPageId;
        const hasChildren = children.length > 0;
        const isAncestor = this.isAncestorOf(page.id, currentPageId, allPages);
        const isFirstPage = page.id === allPages[0]?.id;

        // Build li class attribute
        const liClass = isCurrent ? ' class="active"' : isAncestor ? ' class="current-page-parent"' : '';
        const link = this.getPageLink(page, allPages, basePath);

        // Build link classes: main-node for first page, daddy/no-ch for children, active if current
        const linkClasses: string[] = [];
        if (isCurrent) linkClasses.push('active');
        if (isFirstPage) linkClasses.push('main-node');
        linkClasses.push(hasChildren ? 'daddy' : 'no-ch');

        let html = `<li${liClass}>`;
        html += ` <a href="${link}" class="${linkClasses.join(' ')}">${this.escapeHtml(page.title)}</a>\n`;

        if (hasChildren) {
            html += '<ul class="other-section">\n';
            for (const child of children) {
                html += this.renderNavItem(child, allPages, currentPageId, basePath);
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
     * Get page link URL
     * @param page - Page
     * @param allPages - All pages
     * @param basePath - Base path
     * @returns Link URL
     */
    getPageLink(page: ExportPage, allPages: ExportPage[], basePath: string): string {
        const isFirstPage = page.id === allPages[0]?.id;
        if (isFirstPage) {
            return basePath ? `${basePath}index.html` : 'index.html';
        }
        const filename = this.sanitizeFilename(page.title);
        return `${basePath}html/${filename}.html`;
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
     * Render page header with page counter, package title (h1), and page title (h2)
     * @param page - Page
     * @param options - Header options including counter info
     * @returns Header HTML
     */
    renderPageHeader(
        page: ExportPage,
        options: {
            projectTitle: string;
            currentPageIndex: number;
            totalPages: number;
            addPagination?: boolean;
        },
    ): string {
        const { projectTitle, currentPageIndex, totalPages, addPagination } = options;

        // Page counter is only shown if addPagination is true
        const pageCounterHtml = addPagination
            ? ` <p class="page-counter"> <span class="page-counter-label">Página </span><span class="page-counter-content"> <strong class="page-counter-current-page">${currentPageIndex + 1}</strong><span class="page-counter-sep">/</span><strong class="page-counter-total">${totalPages}</strong></span></p>\n`
            : '';

        return `<header id="header-${page.id}" class="page-header">${pageCounterHtml}<h1 class="package-title">${this.escapeHtml(projectTitle)}</h1>
<h2 class="page-title">${this.escapeHtml(page.title)}</h2></header>`;
    }

    /**
     * Render page content (blocks with iDevices)
     * @param page - Page
     * @param basePath - Base path
     * @returns Content HTML
     */
    renderPageContent(page: ExportPage, basePath: string): string {
        let html = '';

        for (const block of page.blocks || []) {
            html += this.ideviceRenderer.renderBlock(block, {
                basePath,
                includeDataAttributes: true,
            });
        }

        return html;
    }

    /**
     * Render navigation buttons (prev/next links)
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @returns Navigation buttons HTML
     */
    renderNavButtons(page: ExportPage, allPages: ExportPage[], basePath: string): string {
        const currentIndex = allPages.findIndex(p => p.id === page.id);
        const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
        const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

        if (!prevPage && !nextPage) return '';

        let html = '<div class="nav-buttons">';

        if (prevPage) {
            const link = this.getPageLink(prevPage, allPages, basePath);
            html += ` <a href="${link}" title="Anterior" class="nav-button nav-button-left"> <span>Anterior</span></a>`;
        }

        if (nextPage) {
            const link = this.getPageLink(nextPage, allPages, basePath);
            html += `<a href="${link}" title="Siguiente" class="nav-button nav-button-right"> <span>Siguiente</span></a>`;
        }

        html += '\n</div>';
        return html;
    }

    /**
     * Render pagination (prev/next links) - legacy method kept for backward compatibility
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
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
    renderFooterSection(options: { license: string; licenseUrl?: string; userFooterContent?: string }): string {
        const { license, licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/', userFooterContent } = options;

        let userFooterHtml = '';
        if (userFooterContent) {
            userFooterHtml = `<div id="siteUserFooter"> <div>${userFooterContent}</div>\n</div>`;
        }

        return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${this.escapeHtml(license)}</a></p>
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
        const { license, licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/' } = options;

        return `<div id="packageLicense" class="cc cc-by-sa">
<p><span>Licensed under the</span> <a rel="license" href="${licenseUrl}">${this.escapeHtml(license)}</a></p>
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
     * @param basePath - Base path for URLs
     * @returns JSON string with page structure
     */
    generateSearchData(allPages: ExportPage[], _basePath: string): string {
        const pagesData: Record<string, unknown> = {};

        for (let i = 0; i < allPages.length; i++) {
            const page = allPages[i];
            const isIndex = i === 0;
            const prevPage = i > 0 ? allPages[i - 1] : null;
            const nextPage = i < allPages.length - 1 ? allPages[i + 1] : null;

            const fileName = isIndex ? 'index.html' : `${this.sanitizeFilename(page.title)}.html`;
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
     * @returns JavaScript file content with window.exeSearchData assignment
     */
    generateSearchIndexFile(allPages: ExportPage[], basePath: string): string {
        const searchDataJson = this.generateSearchData(allPages, basePath);
        return `window.exeSearchData = ${searchDataJson};`;
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
            language?: string;
            customStyles?: string;
            usedIdevices?: string[];
            author?: string;
            license?: string;
        } = {},
    ): string {
        const {
            projectTitle = 'eXeLearning',
            language = 'en',
            customStyles = '',
            usedIdevices = [],
            author = '',
            license = 'CC-BY-SA',
        } = options;

        let contentHtml = '';
        for (const page of allPages) {
            contentHtml += `<section id="section-${page.id}" class="single-page-section">
<header class="page-header">
<h2 class="page-title">${this.escapeHtml(page.title)}</h2>
</header>
<div class="page-content">
${this.renderPageContent(page, '')}
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
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="generator" content="eXeLearning v3.0.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)}</title>
<script>document.querySelector("html").classList.add("js");</script>
<script src="libs/jquery/jquery.min.js"> </script>
<script src="libs/common_i18n.js"> </script>
<script src="libs/common.js"> </script>
<script src="libs/exe_export.js"> </script>
<script src="libs/bootstrap/bootstrap.bundle.min.js"> </script>
<script src="libs/exe_lightbox/exe_lightbox.js"> </script>
<link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="libs/exe_lightbox/exe_lightbox.css">${ideviceIncludes}
<link rel="stylesheet" href="content/css/base.css">
<script src="theme/default.js"> </script>
<link rel="stylesheet" href="theme/content.css">
${customStyles ? `<style>\n${customStyles}\n</style>` : ''}
</head>
<body class="exe-export exe-single-page" lang="${language}">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js">
${this.renderSinglePageNav(allPages)}
<main class="single-page-content">
${contentHtml}
</main>
${this.renderLicense({ author, license })}
</div>
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
        const children = allPages.filter(p => p.parentId === page.id);
        const hasChildren = children.length > 0;

        let html = '<li>';
        html += ` <a href="#section-${page.id}" class="${hasChildren ? 'daddy' : 'no-ch'}">${this.escapeHtml(page.title)}</a>\n`;

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
}

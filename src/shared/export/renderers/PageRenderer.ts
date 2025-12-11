/**
 * PageRenderer
 *
 * Renders complete HTML pages for export.
 * Generates full HTML5 pages matching legacy Symfony exports:
 * - Proper DOCTYPE and meta tags
 * - CSS/JS includes for theme and iDevices
 * - Navigation menu structure
 * - Page content with blocks and iDevices
 * - Pagination and footer
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
            author = '',
            license = 'CC-BY-SA',
            // SCORM-specific options
            isScorm = false,
            scormVersion = '',
            bodyClass = '',
            extraHeadScripts = '',
            onLoadScript = '',
            onUnloadScript = '',
        } = options;

        const pageTitle = page.title || 'Page';
        const fullTitle = `${this.escapeHtml(pageTitle)} | ${this.escapeHtml(projectTitle)}`;

        // Build body class
        const bodyClassStr = bodyClass || 'exe-export exe-web-site';
        const onLoadAttr = onLoadScript ? ` onload="${onLoadScript}"` : '';
        const onUnloadAttr = onUnloadScript
            ? ` onunload="${onUnloadScript}" onbeforeunload="${onUnloadScript}"`
            : '';

        return `<!DOCTYPE html>
<html lang="${language}" id="exe-${isIndex ? 'index' : page.id}">
<head>
${this.renderHead({ pageTitle: fullTitle, basePath, usedIdevices, customStyles, extraHeadScripts, isScorm, scormVersion })}
</head>
<body class="${bodyClassStr}" lang="${language}"${onLoadAttr}${onUnloadAttr}>
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden">
${this.renderNavigation(allPages, page.id, basePath)}
<main id="${page.id}" class="page">
${this.renderPageHeader(page)}
<div id="page-content-${page.id}" class="page-content">
${this.renderPageContent(page, basePath)}
</div>
${this.renderPagination(page, allPages, basePath)}
</main>
${this.renderFooter({ author, license })}
</div>
${this.renderScripts(basePath, isScorm)}
</body>
</html>`;
    }

    /**
     * Render HTML head section
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
    }): string {
        const {
            pageTitle,
            basePath,
            usedIdevices,
            customStyles,
            extraHeadScripts = '',
            isScorm = false,
        } = options;

        let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<script>document.querySelector("html").classList.add("js");</script>
<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="${basePath}content/css/base.css">
<link rel="stylesheet" href="${basePath}theme/style.css">`;

        // Add iDevice-specific CSS
        const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, basePath);
        for (const link of cssLinks) {
            head += `\n${link}`;
        }

        // Add custom styles
        if (customStyles) {
            head += `\n<style>\n${customStyles}\n</style>`;
        }

        // Add SCORM-specific scripts in head (before body scripts)
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

        const classAttr = isCurrent ? ' class="active"' : isAncestor ? ' class="parent"' : '';
        const link = this.getPageLink(page, allPages, basePath);
        const linkClass = hasChildren ? 'daddy' : 'no-ch';

        let html = `<li${classAttr}>`;
        html += ` <a href="${link}" class="${isCurrent ? 'active ' : ''}${linkClass}">${this.escapeHtml(page.title)}</a>\n`;

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
     * Render page header with title
     * @param page - Page
     * @returns Header HTML
     */
    renderPageHeader(page: ExportPage): string {
        return `<header class="page-header">
<h2 class="page-title">${this.escapeHtml(page.title)}</h2>
</header>`;
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
     * Render pagination (prev/next links)
     * @param page - Current page
     * @param allPages - All pages
     * @param basePath - Base path
     * @returns Pagination HTML
     */
    renderPagination(page: ExportPage, allPages: ExportPage[], basePath: string): string {
        const currentIndex = allPages.findIndex(p => p.id === page.id);
        const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
        const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

        if (!prevPage && !nextPage) {
            return '';
        }

        let html = '<nav class="pagination">\n';

        if (prevPage) {
            const link = this.getPageLink(prevPage, allPages, basePath);
            html += `<a href="${link}" class="prev"><span>&laquo; </span>${this.escapeHtml(prevPage.title)}</a>`;
        }

        if (prevPage && nextPage) {
            html += ' | ';
        }

        if (nextPage) {
            const link = this.getPageLink(nextPage, allPages, basePath);
            html += `<a href="${link}" class="next">${this.escapeHtml(nextPage.title)}<span> &raquo;</span></a>`;
        }

        html += '\n</nav>';
        return html;
    }

    /**
     * Render footer section
     * @param options - Footer options
     * @returns Footer HTML
     */
    renderFooter(options: { author: string; license: string }): string {
        const { author, license } = options;

        let html = `<footer id="packageLicense" class="cc cc-by-sa">`;
        if (author) {
            html += `\n<p><span>Author:</span> ${this.escapeHtml(author)}</p>`;
        }
        html += `\n<p><span>License:</span> ${this.escapeHtml(license)}</p>`;
        html += '\n</footer>';
        return html;
    }

    /**
     * Render script tags for JS libraries
     * @param basePath - Base path
     * @param isScorm - Whether this is a SCORM export
     * @returns Scripts HTML
     */
    renderScripts(basePath: string, isScorm: boolean = false): string {
        return `<script type="text/javascript" src="${basePath}libs/jquery/jquery.min.js"></script>
<script type="text/javascript" src="${basePath}libs/exe_export.js"></script>
<script type="text/javascript" src="${basePath}libs/common_i18n.js"></script>
<script type="text/javascript" src="${basePath}libs/common.js"></script>
<script type="text/javascript" src="${basePath}theme/style.js"></script>`;
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
        } = {}
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
${this.renderPageHeader(page)}
<div class="page-content">
${this.renderPageContent(page, '')}
</div>
</section>\n`;
        }

        return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)}</title>
<script>document.querySelector("html").classList.add("js");</script>
<link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="content/css/base.css">
<link rel="stylesheet" href="theme/style.css">
${this.ideviceRenderer.getCssLinks(usedIdevices, '').join('\n')}
${customStyles ? `<style>\n${customStyles}\n</style>` : ''}
</head>
<body class="exe-export exe-single-page" lang="${language}">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js">
${this.renderSinglePageNav(allPages)}
<main class="single-page-content">
${contentHtml}
</main>
${this.renderFooter({ author, license })}
</div>
${this.renderScripts('')}
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
}

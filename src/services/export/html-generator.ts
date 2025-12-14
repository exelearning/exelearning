/**
 * HTML Generator Helper for Elysia
 * Generates HTML files for export (index.html, page files, etc.)
 *
 * Updated to match legacy Symfony export format:
 * - Scripts BEFORE CSS in head
 * - main-node class on first navigation item
 * - exe-client-search div with JSON data
 * - theme/content.css and theme/default.js naming
 */
import { ParsedOdeStructure, NormalizedPage, NormalizedComponent } from '../xml/interfaces';
import { Html5ExportOptions } from './interfaces';
import { normalizeHtmlPaths } from '../../utils/html-path-normalizer.util';

// Import shared iDevice configuration service
import { getIdeviceConfig } from '../idevice-config';

/**
 * Generate the full HTML for a page
 */
export function generatePageHtml(
    page: NormalizedPage,
    structure: ParsedOdeStructure,
    options: Html5ExportOptions,
    resourcesPrefix: string = '',
): string {
    const lang = structure.meta.language || 'en';
    const allPages = structure.pages;
    const isIndex = page.id === allPages[0]?.id;
    const projectTitle = structure.meta.title || 'eXeLearning';

    // Calculate page counter values
    const totalPages = allPages.length;
    const currentPageIndex = allPages.findIndex(p => p.id === page.id);

    // Collect used iDevice types for this page
    const usedIdevices = collectUsedIdevices(page);

    // Generate search data JSON
    const searchDataJson = generateSearchData(allPages);

    // Get license and user footer content
    const license = structure.meta.license || 'creative commons: attribution - share alike 4.0';
    const licenseUrl = structure.meta.licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/';
    const userFooterContent = structure.meta.userFooter || '';

    return `<!DOCTYPE html>
<html lang="${lang}" id="exe-${isIndex ? 'index' : page.id}">
<head>
${generateHead(page, structure, resourcesPrefix, usedIdevices)}
</head>
<body class="exe-export exe-web-site" lang="${lang}">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden"> ${generateNavigation(allPages, page.id, isIndex)}${generatePageHeader(page, { projectTitle, currentPageIndex, totalPages, addPagination: structure.meta.addPagination })}<div id="page-content-${page.id}" class="page-content"> <main id="${page.id}" class="page"> <div id="exe-client-search" data-block-order-string="Caja %e" data-no-results-string="Sin resultados." data-pages="${escapeAttr(searchDataJson)}">
</div>
${generatePageContent(page, resourcesPrefix)}
</main></div>${generateNavButtons(page, allPages)}
${generateFooterSection({ license, licenseUrl, userFooterContent })}
</div>
${generateMadeWithEXe()}
</body>
</html>`;
}

/**
 * Generate index.html content
 */
export function generateIndexHtml(
    structure: ParsedOdeStructure,
    options: Html5ExportOptions,
    resourcesPrefix: string = '',
): string {
    const firstPage = structure.pages[0];
    if (!firstPage) return '';

    return generatePageHtml(firstPage, structure, options, resourcesPrefix);
}

/**
 * Collect used iDevice types from a page
 */
function collectUsedIdevices(page: NormalizedPage): string[] {
    const types = new Set<string>();
    for (const component of page.components || []) {
        types.add(component.type || 'text');
    }
    return Array.from(types);
}

/**
 * Generate HTML Head section
 * Legacy order: SCRIPTS first, then CSS
 */
function generateHead(
    page: NormalizedPage,
    structure: ParsedOdeStructure,
    resourcesPrefix: string,
    usedIdevices: string[],
): string {
    const title = escapeHtml(structure.meta.title || 'eXeLearning');
    const description = structure.meta.description || '';
    const licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/';

    let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning v3.0.0">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="license" type="text/html" href="${licenseUrl}">
<title>${title}</title>`;

    if (description) {
        head += `\n<meta name="description" content="${escapeAttr(description)}">`;
    }

    // SCRIPTS FIRST (legacy order requirement)
    head += `
<script>document.querySelector("html").classList.add("js");</script>`;
    head += `<script src="${resourcesPrefix}libs/jquery/jquery.min.js"> </script>`;
    head += `<script src="${resourcesPrefix}libs/common_i18n.js"> </script>`;
    head += `<script src="${resourcesPrefix}libs/common.js"> </script>`;
    head += `<script src="${resourcesPrefix}libs/exe_export.js"> </script>`;
    head += `<script src="${resourcesPrefix}libs/bootstrap/bootstrap.bundle.min.js"> </script>`;
    head += `<script src="${resourcesPrefix}libs/exe_lightbox/exe_lightbox.js"> </script>`;

    // CSS AFTER scripts
    head += `<link rel="stylesheet" href="${resourcesPrefix}libs/bootstrap/bootstrap.min.css">`;
    head += `\n<link rel="stylesheet" href="${resourcesPrefix}libs/exe_lightbox/exe_lightbox.css">`;

    // iDevice-specific scripts and CSS
    const seen = new Set<string>();
    for (const type of usedIdevices) {
        const config = getIdeviceConfig(type);
        const typeName = config.cssClass || type.toLowerCase().replace('idevice', '');
        if (!seen.has(typeName)) {
            seen.add(typeName);
            head += `\n<script src="${resourcesPrefix}idevices/${typeName}/${typeName}.js"> </script>`;
            head += `<link rel="stylesheet" href="${resourcesPrefix}idevices/${typeName}/${typeName}.css">`;
        }
    }

    // Base CSS and theme (use legacy names)
    head += `\n<link rel="stylesheet" href="${resourcesPrefix}content/css/base.css">`;
    head += `<script src="${resourcesPrefix}theme/default.js"> </script>`;
    head += `<link rel="stylesheet" href="${resourcesPrefix}theme/content.css">`;

    // Custom styles from meta
    const customStyles = structure.meta.customStyles;
    if (customStyles) {
        head += `\n<style>\n${customStyles}\n</style>`;
    }

    return head;
}

/**
 * Generate Navigation Menu
 */
function generateNavigation(pages: NormalizedPage[], currentPageId: string, isCurrentIndex: boolean): string {
    const rootPages = pages.filter(p => p.parent_id === null);

    let html = '<nav id="siteNav">\n<ul>\n';
    for (const page of rootPages) {
        html += generateNavItem(page, pages, currentPageId, isCurrentIndex);
    }
    html += '</ul>\n</nav>';
    return html;
}

function generateNavItem(
    page: NormalizedPage,
    allPages: NormalizedPage[],
    currentPageId: string,
    isCurrentIndex: boolean,
): string {
    const children = allPages.filter(p => p.parent_id === page.id);
    const isCurrent = page.id === currentPageId;
    const isFirstPage = page.id === allPages[0]?.id;
    const hasChildren = children.length > 0;
    const isAncestor = isParentOf(page, currentPageId, allPages);

    // Build li class
    const liClass = isCurrent ? ' class="active"' : isAncestor ? ' class="current-page-parent"' : '';

    // Build link classes
    const linkClasses: string[] = [];
    if (isCurrent) linkClasses.push('active');
    if (isFirstPage) linkClasses.push('main-node');
    linkClasses.push(hasChildren ? 'daddy' : 'no-ch');

    const link = isFirstPage ? 'index.html' : `html/${sanitizeFilename(page.title)}.html`;

    let html = `<li${liClass}>`;
    html += ` <a href="${link}" class="${linkClasses.join(' ')}">${escapeHtml(page.title)}</a>\n`;

    if (children.length > 0) {
        html += '<ul class="other-section">\n';
        for (const child of children) {
            html += generateNavItem(child, allPages, currentPageId, isCurrentIndex);
        }
        html += '</ul>\n';
    }

    html += '</li>\n';
    return html;
}

function isParentOf(potentialParent: NormalizedPage, childId: string, allPages: NormalizedPage[]): boolean {
    const child = allPages.find(p => p.id === childId);
    if (!child || !child.parent_id) return false;
    if (child.parent_id === potentialParent.id) return true;
    return isParentOf(potentialParent, child.parent_id, allPages);
}

/**
 * Sanitize title for use as filename
 */
function sanitizeFilename(title: string): string {
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
 * Generate page header with page counter, package title (h1), and page title (h2)
 */
function generatePageHeader(
    page: NormalizedPage,
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

    return `<header id="header-${page.id}" class="page-header">${pageCounterHtml}<h1 class="package-title">${escapeHtml(projectTitle)}</h1>
<h2 class="page-title">${escapeHtml(page.title)}</h2></header>`;
}

/**
 * Generate Page Content (iDevices organized in blocks)
 */
function generatePageContent(page: NormalizedPage, resourcesPrefix: string = ''): string {
    if (!page.components || page.components.length === 0) {
        return '';
    }

    const sortedComponents = [...page.components].sort((a, b) => (a.order || 0) - (b.order || 0));
    const blocks = groupComponentsByBlock(sortedComponents);

    return blocks.map(block => renderBlock(block, resourcesPrefix)).join('\n');
}

/**
 * Group components by block name
 */
function groupComponentsByBlock(
    components: NormalizedComponent[],
): Array<{ name: string | null; id: string; components: NormalizedComponent[] }> {
    const blocks: Array<{
        name: string | null;
        id: string;
        components: NormalizedComponent[];
    }> = [];
    let currentBlock: {
        name: string | null;
        id: string;
        components: NormalizedComponent[];
    } | null = null;

    for (const component of components) {
        const blockName = component.blockName || null;

        if (!currentBlock || currentBlock.name !== blockName) {
            currentBlock = {
                name: blockName,
                id: `block-${component.id}`,
                components: [],
            };
            blocks.push(currentBlock);
        }

        currentBlock.components.push(component);
    }

    return blocks;
}

/**
 * Render a block with its iDevices
 */
function renderBlock(
    block: { name: string | null; id: string; components: NormalizedComponent[] },
    resourcesPrefix: string,
): string {
    const hasHeader = block.name && block.name.trim() !== '';
    const classes = ['box'];

    if (!hasHeader) {
        classes.push('no-header');
    }

    let headerHtml = '';
    if (hasHeader) {
        headerHtml = `<header class="box-head no-icon">
<h1 class="box-title">${escapeHtml(block.name || '')}</h1>
</header>`;
    } else {
        headerHtml = '<div class="box-head"></div>';
    }

    const contentHtml = block.components.map(component => renderIdevice(component, resourcesPrefix)).join('\n');

    return `<article id="${escapeAttr(block.id)}" class="${classes.join(' ')}">
${headerHtml}
<div class="box-content">
${contentHtml}
</div>
</article>`;
}

/**
 * Render a single iDevice component with proper wrapper structure
 */
function renderIdevice(component: NormalizedComponent, resourcesPrefix: string): string {
    const type = component.type || 'text';
    const config = getIdeviceConfig(type);
    const ideviceId = component.id;
    const properties = component.properties || {};

    const rawContent = normalizeHtmlPaths(component.content || '');

    const classes = ['idevice_node', config.cssClass];

    if (!rawContent) {
        classes.push('db-no-data');
    }
    if (properties.visibility === 'false' || properties.visible === false) {
        classes.push('novisible');
    }
    if (
        properties.teacherOnly === 'true' ||
        properties.teacherOnly === true ||
        properties.visibilityType === 'teacher'
    ) {
        classes.push('teacher-only');
    }
    if (properties.cssClass) {
        classes.push(String(properties.cssClass));
    }

    const idevicePath = `${resourcesPrefix}idevices/${type}/`;
    let dataAttrs = ` data-idevice-path="${escapeAttr(idevicePath)}"`;
    dataAttrs += ` data-idevice-type="${escapeAttr(type)}"`;

    if (config.componentType === 'json') {
        dataAttrs += ` data-idevice-component-type="json"`;

        const isText = isTextIdevice(type);
        if (!isText && Object.keys(properties).length > 0) {
            const jsonData = JSON.stringify(properties);
            dataAttrs += ` data-idevice-json-data="${escapeAttr(jsonData)}"`;
            dataAttrs += ` data-idevice-template="${escapeAttr(config.template)}"`;
        }
    }

    const fixedContent = fixAssetUrls(rawContent, resourcesPrefix);

    const isText = isTextIdevice(type);
    const contentHtml = isText && fixedContent ? `<div class="exe-text">${fixedContent}</div>` : fixedContent;

    return `<div id="${escapeAttr(ideviceId)}" class="${classes.join(' ')}"${dataAttrs}>
${contentHtml}
</div>`;
}

/**
 * Check if an iDevice type is a text-based iDevice
 */
function isTextIdevice(type: string): boolean {
    return type === 'text' || type === 'FreeTextIdevice' || type === 'TextIdevice';
}

/**
 * Fix asset URLs in HTML content
 */
function fixAssetUrls(content: string, basePath: string): string {
    if (!content) return '';

    let fixed = content;

    // Fix asset:// protocol URLs
    fixed = fixed.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
        return `${basePath}content/resources/${assetPath}`;
    });

    // Fix files/tmp/ paths
    fixed = fixed.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
        return `${basePath}content/resources/${relativePath}`;
    });

    // Fix relative paths that start with /files/
    fixed = fixed.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
        return `"${basePath}content/resources/${path}"`;
    });

    return fixed;
}

/**
 * Generate complete footer section with license and optional user content
 */
function generateFooterSection(options: { license: string; licenseUrl?: string; userFooterContent?: string }): string {
    const { license, licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/', userFooterContent } = options;

    let userFooterHtml = '';
    if (userFooterContent) {
        userFooterHtml = `<div id="siteUserFooter"> <div>${userFooterContent}</div>\n</div>`;
    }

    return `<footer id="siteFooter"><div id="siteFooterContent"> <div id="packageLicense" class="cc cc-by-sa"> <p> <span class="license-label">Licencia: </span><a href="${licenseUrl}" class="license">${escapeHtml(license)}</a></p>
</div>
${userFooterHtml}</div></footer>`;
}

/**
 * Generate "Made with eXeLearning" credit
 */
function generateMadeWithEXe(): string {
    return `<p id="made-with-eXe"> <a href="https://exelearning.net/" target="_blank" rel="noopener"> <span>Creado con eXeLearning <span>(nueva ventana)</span></span></a></p>`;
}

/**
 * Generate Navigation buttons (Prev/Next)
 */
function generateNavButtons(page: NormalizedPage, allPages: NormalizedPage[]): string {
    const currentIndex = allPages.findIndex(p => p.id === page.id);
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

    if (!prevPage && !nextPage) return '';

    let html = '<div class="nav-buttons">';

    if (prevPage) {
        const isFirst = prevPage.id === allPages[0]?.id;
        const link = isFirst ? '../index.html' : `${sanitizeFilename(prevPage.title)}.html`;
        html += ` <a href="${link}" title="Anterior" class="nav-button nav-button-left"> <span>Anterior</span></a>`;
    }

    if (nextPage) {
        const link = `${sanitizeFilename(nextPage.title)}.html`;
        html += `<a href="${link}" title="Siguiente" class="nav-button nav-button-right"> <span>Siguiente</span></a>`;
    }

    html += '\n</div>';
    return html;
}

/**
 * Generate search data JSON for client-side search
 */
function generateSearchData(pages: NormalizedPage[]): string {
    const pagesData: Record<string, unknown> = {};

    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const isIndex = i === 0;
        const prevPage = i > 0 ? pages[i - 1] : null;
        const nextPage = i < pages.length - 1 ? pages[i + 1] : null;

        const fileName = isIndex ? 'index.html' : `${sanitizeFilename(page.title)}.html`;
        const fileUrl = isIndex ? 'index.html' : `html/${fileName}`;

        const blocksData: Record<string, unknown> = {};
        const sortedComponents = [...(page.components || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
        const blocks = groupComponentsByBlock(sortedComponents);

        for (const block of blocks) {
            const idevicesData: Record<string, unknown> = {};
            for (let j = 0; j < block.components.length; j++) {
                const component = block.components[j];
                idevicesData[component.id] = {
                    order: j + 1,
                    htmlView: component.content || '',
                    jsonProperties: JSON.stringify(component.properties || {}),
                };
            }
            blocksData[block.id] = {
                name: block.name || '',
                order: 1,
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
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
    if (!text) return '';
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Escape attribute value
 */
function escapeAttr(str: string): string {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

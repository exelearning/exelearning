/**
 * HTML Generator Helper for Elysia
 * Generates HTML files for export (index.html, page files, etc.)
 */
import { ParsedOdeStructure, NormalizedPage, NormalizedComponent } from '../xml/interfaces';
import { Html5ExportOptions } from './interfaces';
import { normalizeHtmlPaths } from '../../utils/html-path-normalizer.util';

// Import shared iDevice configuration from constants
import { getIdeviceConfig } from '../../shared/export/constants';

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
    const title = page.title;
    const isPreview = options.preview === true;

    // Build class list for body
    const bodyClasses = ['exe-web-site'];
    if (isPreview) bodyClasses.push('exe-preview');
    if (options.includeNavigation !== false) bodyClasses.push('exe-search-bar');

    return `<!doctype html>
<html lang="${lang}">
<head>
${generateHead(page, structure, resourcesPrefix)}
</head>
<body class="${bodyClasses.join(' ')}">
<div id="content">
${generateHeader(structure)}
<div id="siteNav">
${generateNavigation(structure.pages, page.id)}
</div>
<div id="main">
<div id="nodeDecoration"><h1 id="nodeTitle">${escapeHtml(title)}</h1></div>
${generatePageContent(page, resourcesPrefix)}
${generatePagination(page, structure.pages)}
</div>
${generateFooter(structure)}
</div>
<script type="text/javascript" src="${resourcesPrefix}_style_js.js"></script></body></html>`;
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
 * Generate HTML Head section
 */
function generateHead(page: NormalizedPage, structure: ParsedOdeStructure, resourcesPrefix: string): string {
    const title = `${escapeHtml(page.title)} | ${escapeHtml(structure.meta.title || 'eXeLearning')}`;

    return `
<link rel="stylesheet" type="text/css" href="${resourcesPrefix}base.css" />
<link rel="stylesheet" type="text/css" href="${resourcesPrefix}theme/content.css" />
<link rel="stylesheet" type="text/css" href="${resourcesPrefix}content.css" />
<title>${title}</title>
<meta http-equiv="content-type" content="text/html;  charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="eXeLearning ${structure.meta.exelearning_version || ''} - exelearning.net" />
<!--[if lt IE 9]><script type="text/javascript" src="${resourcesPrefix}exe_html5.js"></script><![endif]-->
<script type="text/javascript" src="${resourcesPrefix}exe_jquery.js"></script>
<script type="text/javascript" src="${resourcesPrefix}common_i18n.js"></script>
<script type="text/javascript" src="${resourcesPrefix}common.js"></script>
<script type="text/javascript" src="${resourcesPrefix}theme/default.js"></script>
`;
}

/**
 * Generate Header
 */
function generateHeader(structure: ParsedOdeStructure): string {
    return `<header id="header" >
<div id="headerContent">${escapeHtml(structure.meta.title || '')}</div>
</header>`;
}

/**
 * Generate Navigation Menu
 */
function generateNavigation(pages: NormalizedPage[], currentPageId: string): string {
    const rootPages = pages.filter(p => p.parent_id === null);

    let html = '<ul>\n';

    for (const page of rootPages) {
        html += generateNavItem(page, pages, currentPageId, 0);
    }

    html += '</ul>';
    return html;
}

function generateNavItem(
    page: NormalizedPage,
    allPages: NormalizedPage[],
    currentPageId: string,
    level: number,
): string {
    const children = allPages.filter(p => p.parent_id === page.id);
    const isCurrent = page.id === currentPageId;
    const isParentOfCurrent = isParentOf(page, currentPageId, allPages);

    let classAttr = '';
    if (isCurrent) classAttr = ' class="active"';
    else if (isParentOfCurrent) classAttr = ' class="active"';

    const link = page.id === allPages[0].id ? 'index.html' : `${page.id}.html`;

    let html = `<li id="${isCurrent ? 'active' : ''}"><a href="${link}"${classAttr}>${escapeHtml(page.title)}</a>`;

    if (children.length > 0) {
        html += '\n<ul>\n';
        for (const child of children) {
            html += generateNavItem(child, allPages, currentPageId, level + 1);
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
 * Generate Pagination (Prev/Next buttons)
 */
function generatePagination(page: NormalizedPage, allPages: NormalizedPage[]): string {
    const currentIndex = allPages.findIndex(p => p.id === page.id);
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

    let html =
        '<div id="packageLicense" class="cc cc-by-sa">\n<p><span>Licensed under the</span> <a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution Share Alike License 4.0</a></p>\n</div>\n';

    if (prevPage || nextPage) {
        html += '<div class="pagination">\n';
        if (prevPage) {
            const link = prevPage.id === allPages[0].id ? 'index.html' : `${prevPage.id}.html`;
            html += `<a href="${link}" class="prev"><span>&laquo; </span>${escapeHtml(prevPage.title)}</a>`;
        }
        if (prevPage && nextPage) html += ' | ';
        if (nextPage) {
            const link = `${nextPage.id}.html`;
            html += `<a href="${link}" class="next">${escapeHtml(nextPage.title)}<span> &raquo;</span></a>`;
        }
        html += '\n</div>';
    }

    return html;
}

/**
 * Generate Footer
 */
function generateFooter(_structure: ParsedOdeStructure): string {
    return '';
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

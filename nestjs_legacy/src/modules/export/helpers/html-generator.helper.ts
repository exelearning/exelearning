import { Injectable } from '@nestjs/common';
import {
    ParsedOdeStructure,
    NormalizedPage,
    NormalizedComponent,
    OdeXmlMeta,
} from '../../xml/interfaces/ode-xml.interface';
import { Html5ExportOptions } from '../dto/export.dto';
import { normalizeHtmlPaths } from '../../../utils/html-path-normalizer.util';

/**
 * iDevice configuration mapping
 * Maps iDevice type names to their CSS class and component type
 */
interface IdeviceConfig {
    cssClass: string;
    componentType: string;
    template: string;
}

const IDEVICE_CONFIGS: Record<string, IdeviceConfig> = {
    // Text and content
    text: { cssClass: 'text', componentType: 'json', template: 'text.html' },
    FreeTextIdevice: { cssClass: 'text', componentType: 'json', template: 'text.html' },
    TextIdevice: { cssClass: 'text', componentType: 'json', template: 'text.html' },

    // Forms and quizzes
    form: { cssClass: 'form', componentType: 'json', template: 'form.html' },
    QuizActivity: { cssClass: 'form', componentType: 'json', template: 'form.html' },
    MultipleChoiceIdevice: { cssClass: 'form', componentType: 'json', template: 'form.html' },

    // Interactive activities
    guess: { cssClass: 'guess', componentType: 'json', template: 'guess.html' },
    checklist: { cssClass: 'checklist', componentType: 'json', template: 'checklist.html' },
    rubric: { cssClass: 'rubric', componentType: 'json', template: 'rubric.html' },
    casestudy: { cssClass: 'casestudy', componentType: 'json', template: 'casestudy.html' },
    challenge: { cssClass: 'challenge', componentType: 'json', template: 'challenge.html' },
    flipcards: { cssClass: 'flipcards', componentType: 'json', template: 'flipcards.html' },
    crossword: { cssClass: 'crossword', componentType: 'json', template: 'crossword.html' },
    trivial: { cssClass: 'trivial', componentType: 'json', template: 'trivial.html' },
    trueorfalse: { cssClass: 'trueorfalse', componentType: 'json', template: 'trueorfalse.html' },
    complete: { cssClass: 'complete', componentType: 'json', template: 'complete.html' },
    relate: { cssClass: 'relate', componentType: 'json', template: 'relate.html' },
    classify: { cssClass: 'classify', componentType: 'json', template: 'classify.html' },
    sort: { cssClass: 'sort', componentType: 'json', template: 'sort.html' },
    dragdrop: { cssClass: 'dragdrop', componentType: 'json', template: 'dragdrop.html' },
    identify: { cssClass: 'identify', componentType: 'json', template: 'identify.html' },

    // Media
    'image-gallery': {
        cssClass: 'image-gallery',
        componentType: 'json',
        template: 'image-gallery.html',
    },
    'interactive-video': {
        cssClass: 'interactive-video',
        componentType: 'json',
        template: 'interactive-video.html',
    },
    'select-media-files': {
        cssClass: 'select-media-files',
        componentType: 'json',
        template: 'select-media-files.html',
    },
    beforeafter: { cssClass: 'beforeafter', componentType: 'json', template: 'beforeafter.html' },
    magnifier: { cssClass: 'magnifier', componentType: 'json', template: 'magnifier.html' },

    // Games
    'az-quiz-game': {
        cssClass: 'az-quiz-game',
        componentType: 'json',
        template: 'az-quiz-game.html',
    },
    'word-search': { cssClass: 'word-search', componentType: 'json', template: 'word-search.html' },
    puzzle: { cssClass: 'puzzle', componentType: 'json', template: 'puzzle.html' },
    padlock: { cssClass: 'padlock', componentType: 'json', template: 'padlock.html' },
    'hidden-image': {
        cssClass: 'hidden-image',
        componentType: 'json',
        template: 'hidden-image.html',
    },
    'scrambled-list': {
        cssClass: 'scrambled-list',
        componentType: 'json',
        template: 'scrambled-list.html',
    },
    mathproblems: { cssClass: 'mathproblems', componentType: 'json', template: 'mathproblems.html' },
    mathematicaloperations: {
        cssClass: 'mathematicaloperations',
        componentType: 'json',
        template: 'mathematicaloperations.html',
    },

    // External content
    'external-website': {
        cssClass: 'external-website',
        componentType: 'json',
        template: 'external-website.html',
    },
    'geogebra-activity': {
        cssClass: 'geogebra-activity',
        componentType: 'json',
        template: 'geogebra-activity.html',
    },
    map: { cssClass: 'map', componentType: 'json', template: 'map.html' },
    'periodic-table': {
        cssClass: 'periodic-table',
        componentType: 'json',
        template: 'periodic-table.html',
    },
    'collaborative-editing': {
        cssClass: 'collaborative-editing',
        componentType: 'json',
        template: 'collaborative-editing.html',
    },

    // Utilities
    'attached-files': {
        cssClass: 'attached-files',
        componentType: 'json',
        template: 'attached-files.html',
    },
    'download-source-file': {
        cssClass: 'download-source-file',
        componentType: 'json',
        template: 'download-source-file.html',
    },
    'progress-report': {
        cssClass: 'progress-report',
        componentType: 'json',
        template: 'progress-report.html',
    },

    // Learning design
    'udl-content': { cssClass: 'udl-content', componentType: 'json', template: 'udl-content.html' },
    discover: { cssClass: 'discover', componentType: 'json', template: 'discover.html' },
    example: { cssClass: 'example', componentType: 'json', template: 'example.html' },

    // Quick questions
    'quick-questions': {
        cssClass: 'quick-questions',
        componentType: 'json',
        template: 'quick-questions.html',
    },
    'quick-questions-multiple-choice': {
        cssClass: 'quick-questions-multiple-choice',
        componentType: 'json',
        template: 'quick-questions-multiple-choice.html',
    },
    'quick-questions-video': {
        cssClass: 'quick-questions-video',
        componentType: 'json',
        template: 'quick-questions-video.html',
    },
};

@Injectable()
export class HtmlGeneratorHelper {
    /**
     * Generate the full HTML for a page
     */
    generatePageHtml(
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
${this.generateHead(page, structure, resourcesPrefix)}
</head>
<body class="${bodyClasses.join(' ')}">
<div id="content">
${this.generateHeader(structure)}
<div id="siteNav">
${this.generateNavigation(structure.pages, page.id)}
</div>
<div id="main">
<div id="nodeDecoration"><h1 id="nodeTitle">${this.escapeHtml(title)}</h1></div>
${this.generatePageContent(page, resourcesPrefix)}
${this.generatePagination(page, structure.pages)}
</div>
${this.generateFooter(structure)}
</div>
<script type="text/javascript" src="${resourcesPrefix}_style_js.js"></script></body></html>`;
    }

    /**
     * Generate index.html content
     */
    generateIndexHtml(
        structure: ParsedOdeStructure,
        options: Html5ExportOptions,
        resourcesPrefix: string = '',
    ): string {
        // For index, we usually use the first page or a specific structure
        // If structure has pages, use the first one as index content, but with index.html filename context
        const firstPage = structure.pages[0];
        if (!firstPage) return ''; // Should not happen for valid projects

        return this.generatePageHtml(firstPage, structure, options, resourcesPrefix);
    }

    /**
     * Generate HTML Head section
     */
    private generateHead(
        page: NormalizedPage,
        structure: ParsedOdeStructure,
        resourcesPrefix: string,
    ): string {
        const title = `${this.escapeHtml(page.title)} | ${this.escapeHtml(structure.meta.title || 'eXeLearning')}`;

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
    private generateHeader(structure: ParsedOdeStructure): string {
        return `<header id="header" >
<div id="headerContent">${this.escapeHtml(structure.meta.title || '')}</div>
</header>`;
    }

    /**
     * Generate Navigation Menu
     */
    private generateNavigation(pages: NormalizedPage[], currentPageId: string): string {
        // Filter root pages
        const rootPages = pages.filter((p) => p.parent_id === null);

        let html = '<ul>\n';

        for (const page of rootPages) {
            html += this.generateNavItem(page, pages, currentPageId, 0);
        }

        html += '</ul>';
        return html;
    }

    private generateNavItem(
        page: NormalizedPage,
        allPages: NormalizedPage[],
        currentPageId: string,
        level: number,
    ): string {
        const children = allPages.filter((p) => p.parent_id === page.id);
        const isCurrent = page.id === currentPageId;
        const isParentOfCurrent = this.isParentOf(page, currentPageId, allPages);

        let classAttr = '';
        if (isCurrent) classAttr = ' class="active"';
        else if (isParentOfCurrent) classAttr = ' class="active"'; // Keep parent open/active

        const link = page.id === allPages[0].id ? 'index.html' : `${page.id}.html`;

        let html = `<li id="${isCurrent ? 'active' : ''}"><a href="${link}"${classAttr}>${this.escapeHtml(page.title)}</a>`;

        if (children.length > 0) {
            html += '\n<ul>\n';
            for (const child of children) {
                html += this.generateNavItem(child, allPages, currentPageId, level + 1);
            }
            html += '</ul>\n';
        }

        html += '</li>\n';
        return html;
    }

    private isParentOf(
        potentialParent: NormalizedPage,
        childId: string,
        allPages: NormalizedPage[],
    ): boolean {
        const child = allPages.find((p) => p.id === childId);
        if (!child || !child.parent_id) return false;
        if (child.parent_id === potentialParent.id) return true;
        return this.isParentOf(potentialParent, child.parent_id, allPages);
    }

    /**
     * Generate Page Content (iDevices organized in blocks)
     * Matches the legacy Symfony export structure with proper iDevice wrappers
     */
    private generatePageContent(page: NormalizedPage, resourcesPrefix: string = ''): string {
        if (!page.components || page.components.length === 0) {
            return '';
        }

        // Sort components by order
        const sortedComponents = [...page.components].sort(
            (a, b) => (a.order || 0) - (b.order || 0),
        );

        // Group components by blockName if available
        const blocks = this.groupComponentsByBlock(sortedComponents);

        // Render each block
        return blocks
            .map((block) => this.renderBlock(block, resourcesPrefix))
            .join('\n');
    }

    /**
     * Group components by block name
     * Components without blockName go into their own single-component blocks
     */
    private groupComponentsByBlock(
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

            // If no current block or different block name, start new block
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
    private renderBlock(
        block: { name: string | null; id: string; components: NormalizedComponent[] },
        resourcesPrefix: string,
    ): string {
        const hasHeader = block.name && block.name.trim() !== '';
        const classes = ['box'];

        if (!hasHeader) {
            classes.push('no-header');
        }

        // Build block header
        let headerHtml = '';
        if (hasHeader) {
            headerHtml = `<header class="box-head no-icon">
<h1 class="box-title">${this.escapeHtml(block.name || '')}</h1>
</header>`;
        } else {
            headerHtml = '<div class="box-head"></div>';
        }

        // Render all iDevices in the block
        const contentHtml = block.components
            .map((component) => this.renderIdevice(component, resourcesPrefix))
            .join('\n');

        return `<article id="${this.escapeAttr(block.id)}" class="${classes.join(' ')}">
${headerHtml}
<div class="box-content">
${contentHtml}
</div>
</article>`;
    }

    /**
     * Render a single iDevice component with proper wrapper structure
     */
    private renderIdevice(component: NormalizedComponent, resourcesPrefix: string): string {
        const type = component.type || 'text';
        const config = this.getIdeviceConfig(type);
        const ideviceId = component.id;
        const properties = component.properties || {};

        // Normalize paths in content
        const rawContent = normalizeHtmlPaths(component.content || '');

        // Build CSS classes
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

        // Build data attributes for JS initialization
        const idevicePath = `${resourcesPrefix}idevices/${type}/`;
        let dataAttrs = ` data-idevice-path="${this.escapeAttr(idevicePath)}"`;
        dataAttrs += ` data-idevice-type="${this.escapeAttr(type)}"`;

        if (config.componentType === 'json') {
            dataAttrs += ` data-idevice-component-type="json"`;

            // Add JSON data for non-text iDevices that have properties
            const isTextIdevice = this.isTextIdevice(type);
            if (!isTextIdevice && Object.keys(properties).length > 0) {
                const jsonData = JSON.stringify(properties);
                dataAttrs += ` data-idevice-json-data="${this.escapeAttr(jsonData)}"`;
                dataAttrs += ` data-idevice-template="${this.escapeAttr(config.template)}"`;
            }
        }

        // Fix asset URLs in content
        const fixedContent = this.fixAssetUrls(rawContent, resourcesPrefix);

        // Wrap text iDevice content in exe-text div (legacy format)
        const isTextIdevice = this.isTextIdevice(type);
        const contentHtml =
            isTextIdevice && fixedContent ? `<div class="exe-text">${fixedContent}</div>` : fixedContent;

        return `<div id="${this.escapeAttr(ideviceId)}" class="${classes.join(' ')}"${dataAttrs}>
${contentHtml}
</div>`;
    }

    /**
     * Get iDevice configuration for a given type
     */
    private getIdeviceConfig(ideviceType: string): IdeviceConfig {
        if (IDEVICE_CONFIGS[ideviceType]) {
            return IDEVICE_CONFIGS[ideviceType];
        }

        // Fallback: derive from type name
        const typeName = ideviceType.toLowerCase().replace('idevice', '');
        return {
            cssClass: typeName,
            componentType: 'json',
            template: `${typeName}.html`,
        };
    }

    /**
     * Check if an iDevice type is a text-based iDevice
     */
    private isTextIdevice(type: string): boolean {
        return type === 'text' || type === 'FreeTextIdevice' || type === 'TextIdevice';
    }

    /**
     * Fix asset URLs in HTML content
     */
    private fixAssetUrls(content: string, basePath: string): string {
        if (!content) return '';

        let fixed = content;

        // Fix asset:// protocol URLs
        fixed = fixed.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
            return `${basePath}content/resources/${assetPath}`;
        });

        // Fix files/tmp/ paths (from server temp paths)
        fixed = fixed.replace(
            /files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g,
            (_match, relativePath) => {
                return `${basePath}content/resources/${relativePath}`;
            },
        );

        // Fix relative paths that start with /files/
        fixed = fixed.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
            return `"${basePath}content/resources/${path}"`;
        });

        return fixed;
    }

    /**
     * Escape attribute value
     */
    private escapeAttr(str: string): string {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Generate Pagination (Prev/Next buttons)
     */
    private generatePagination(page: NormalizedPage, allPages: NormalizedPage[]): string {
        const currentIndex = allPages.findIndex((p) => p.id === page.id);
        const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
        const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

        let html =
            '<div id="packageLicense" class="cc cc-by-sa">\n<p><span>Licensed under the</span> <a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution Share Alike License 4.0</a></p>\n</div>\n'; // Default license for now

        if (prevPage || nextPage) {
            html += '<div class="pagination">\n';
            if (prevPage) {
                const link = prevPage.id === allPages[0].id ? 'index.html' : `${prevPage.id}.html`;
                html += `<a href="${link}" class="prev"><span>&laquo; </span>${this.escapeHtml(prevPage.title)}</a>`;
            }
            if (prevPage && nextPage) html += ' | ';
            if (nextPage) {
                const link = `${nextPage.id}.html`;
                html += `<a href="${link}" class="next">${this.escapeHtml(nextPage.title)}<span> &raquo;</span></a>`;
            }
            html += '\n</div>';
        }

        return html;
    }

    /**
     * Generate Footer
     */
    private generateFooter(structure: ParsedOdeStructure): string {
        // TODO: Add custom footer content if defined in properties
        return '';
    }

    private escapeHtml(text: string): string {
        if (!text) return '';
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }
}

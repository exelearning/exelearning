import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseExportStrategy } from './base-export.strategy';
import {
    ExportContext,
    ExportFormatType,
} from '../../interfaces/export-strategy.interface';
import { ZipService } from '../../../file-management/services/zip.service';
import { HtmlGeneratorHelper } from '../../helpers/html-generator.helper';
import { AssetCopierService } from '../asset-copier.service';
import { FILE_EXTENSIONS, FILE_SUFFIXES, HTML } from '../../constants/export.constants';
import { NormalizedPage } from '../../../xml/interfaces/ode-xml.interface';

/**
 * Single Page export strategy
 * Generates a single HTML file containing all content with internal anchor navigation
 */
@Injectable()
export class PageExportStrategy extends BaseExportStrategy {
    readonly format = ExportFormatType.PAGE;
    readonly fileExtension = FILE_EXTENSIONS[ExportFormatType.PAGE];
    readonly fileSuffix = FILE_SUFFIXES[ExportFormatType.PAGE];

    constructor(
        zipService: ZipService,
        htmlGenerator: HtmlGeneratorHelper,
        private readonly assetCopier: AssetCopierService,
    ) {
        super(zipService, htmlGenerator);
    }

    /**
     * Override HTML generation to create single page
     */
    async generateHtmlFiles(context: ExportContext): Promise<void> {
        const { structure, exportDir, options } = context;
        const lang = structure.meta.language || 'en';
        const title = structure.meta.title || 'eXeLearning Export';

        // Generate single page HTML with all content
        const html = this.generateSinglePageHtml(context, lang, title);
        await fs.writeFile(path.join(exportDir, HTML.INDEX_FILE), html, 'utf-8');
    }

    /**
     * Generate format-specific files for Page export
     */
    async generateFormatSpecificFiles(context: ExportContext): Promise<void> {
        const { exportDir, sessionPath, options } = context;

        // Copy base assets
        await this.assetCopier.copyBaseAssets(exportDir, {
            format: this.format,
            customCss: options.customCss,
        });

        // Copy theme if specified
        if (options.theme) {
            await this.assetCopier.copyThemeAssets(exportDir, options.theme.name);
        }

        // Copy project resources
        await this.assetCopier.copyProjectResources(sessionPath, exportDir);

        // Copy iDevice assets
        const ideviceTypes = this.getUsedIdeviceTypes(context);
        if (ideviceTypes.length > 0) {
            await this.assetCopier.copyIdeviceAssets(exportDir, ideviceTypes);
        }
    }

    /**
     * Page export supports preview
     */
    supportsPreview(): boolean {
        return true;
    }

    /**
     * Get required assets
     */
    getRequiredAssets(): string[] {
        return [
            'base.css',
            'content.css',
            'exe_jquery.js',
            'common_i18n.js',
            'common.js',
            '_style_js.js',
        ];
    }

    /**
     * Generate single page HTML with all content and anchor navigation
     */
    private generateSinglePageHtml(
        context: ExportContext,
        lang: string,
        title: string,
    ): string {
        const { structure, options } = context;
        const resourcesPrefix = this.getResourcePrefix(context);

        // Build class list for body
        const bodyClasses = ['exe-single-page'];
        if (options.preview) bodyClasses.push('exe-preview');

        return `<!doctype html>
<html lang="${lang}">
<head>
${this.generateHead(title, structure.meta.exelearning_version, resourcesPrefix)}
</head>
<body class="${bodyClasses.join(' ')}">
<div id="content">
${this.generateHeader(title)}
<div id="siteNav">
${this.generateAnchorNavigation(structure.pages)}
</div>
<div id="main">
${this.generateAllPagesContent(structure.pages)}
${this.generateFooter(structure)}
</div>
</div>
<script type="text/javascript" src="${resourcesPrefix}_style_js.js"></script>
</body>
</html>`;
    }

    /**
     * Generate HTML head section
     */
    private generateHead(
        title: string,
        version: string | undefined,
        resourcesPrefix: string,
    ): string {
        return `
<link rel="stylesheet" type="text/css" href="${resourcesPrefix}base.css" />
<link rel="stylesheet" type="text/css" href="${resourcesPrefix}content.css" />
<title>${this.escapeHtml(title)}</title>
<meta http-equiv="content-type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="eXeLearning ${version || ''} - exelearning.net" />
<script type="text/javascript" src="${resourcesPrefix}exe_jquery.js"></script>
<script type="text/javascript" src="${resourcesPrefix}common_i18n.js"></script>
<script type="text/javascript" src="${resourcesPrefix}common.js"></script>
<style>
/* Single page specific styles */
.page-section { margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #ddd; }
.page-section:last-child { border-bottom: none; }
.page-section h2 { margin-top: 0; padding-top: 20px; }
#siteNav a { display: block; padding: 5px 0; }
</style>`;
    }

    /**
     * Generate header
     */
    private generateHeader(title: string): string {
        return `<header id="header">
<div id="headerContent">${this.escapeHtml(title)}</div>
</header>`;
    }

    /**
     * Generate navigation with anchor links
     */
    private generateAnchorNavigation(pages: NormalizedPage[]): string {
        // Filter root pages
        const rootPages = pages.filter((p) => p.parent_id === null);

        let html = '<nav id="anchorNav"><ul>\n';

        for (const page of rootPages) {
            html += this.generateNavAnchorItem(page, pages);
        }

        html += '</ul></nav>';
        return html;
    }

    /**
     * Generate anchor navigation item
     */
    private generateNavAnchorItem(
        page: NormalizedPage,
        allPages: NormalizedPage[],
    ): string {
        const children = allPages.filter((p) => p.parent_id === page.id);
        const anchorId = this.generateAnchorId(page.id);

        let html = `<li><a href="#${anchorId}">${this.escapeHtml(page.title)}</a>`;

        if (children.length > 0) {
            html += '\n<ul>\n';
            for (const child of children) {
                html += this.generateNavAnchorItem(child, allPages);
            }
            html += '</ul>\n';
        }

        html += '</li>\n';
        return html;
    }

    /**
     * Generate all pages content as sections
     */
    private generateAllPagesContent(pages: NormalizedPage[]): string {
        let html = '';

        for (const page of pages) {
            const anchorId = this.generateAnchorId(page.id);
            html += `<section class="page-section" id="${anchorId}">
<h2 class="page-title">${this.escapeHtml(page.title)}</h2>
${this.generatePageContent(page)}
</section>\n`;
        }

        return html;
    }

    /**
     * Generate page content (iDevices)
     */
    private generatePageContent(page: NormalizedPage): string {
        if (!page.components || page.components.length === 0) {
            return '';
        }

        return page.components
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((component) => {
                const content = component.content || '';
                const type = component.type || 'FreeTextIdevice';

                return `
<div class="iDevice_wrapper ${type}" id="id${component.id}">
<div class="iDevice_content">
${content}
</div>
</div>`;
            })
            .join('\n');
    }

    /**
     * Generate footer
     */
    private generateFooter(structure: any): string {
        return `<div id="packageLicense" class="cc cc-by-sa">
<p><span>Licensed under the</span> <a rel="license" href="http://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution Share Alike License 4.0</a></p>
</div>`;
    }

    /**
     * Generate anchor ID from page ID
     */
    private generateAnchorId(pageId: string): string {
        return `section-${pageId}`;
    }

    /**
     * Escape HTML special characters
     */
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

    /**
     * Get list of iDevice types used in the project
     */
    private getUsedIdeviceTypes(context: ExportContext): string[] {
        const types = new Set<string>();

        for (const page of context.structure.pages) {
            for (const component of page.components || []) {
                if (component.type) {
                    types.add(component.type);
                }
            }
        }

        return Array.from(types);
    }
}

/**
 * IdeviceRenderer
 *
 * Renders iDevice components to HTML for export.
 * Generates HTML structure matching legacy Symfony exports:
 * - <div class="idevice_node {cssClass}"> wrapper with data attributes
 * - Injects content and JSON properties for JS initialization
 *
 * This is a TypeScript port of public/app/yjs/exporters/renderers/IdeviceHtmlRenderer.js
 */

import type {
    ExportComponent,
    ExportBlock,
    ComponentRenderOptions,
    BlockRenderOptions,
    ExportBlockProperties,
} from '../interfaces';
import { IDEVICE_CONFIGS, getIdeviceConfig } from '../constants';

/**
 * CSS link for an iDevice
 */
export interface IdeviceCssLink {
    href: string;
    tag: string;
}

/**
 * JS script for an iDevice
 */
export interface IdeviceJsScript {
    src: string;
    tag: string;
}

/**
 * IdeviceRenderer class
 * Renders iDevice components to HTML for export
 */
export class IdeviceRenderer {
    /**
     * Render a single iDevice component to HTML
     * @param component - Component data
     * @param options - Rendering options
     * @returns HTML string
     */
    render(component: ExportComponent, options: ComponentRenderOptions = { basePath: '', includeDataAttributes: true }): string {
        const { basePath = '', includeDataAttributes = true } = options;

        const type = component.type || 'text';
        const config = getIdeviceConfig(type);
        const ideviceId = component.id;
        const htmlContent = component.content || '';
        const properties = component.properties || {};

        // Build CSS classes
        const classes = ['idevice_node', config.cssClass];
        if (!htmlContent) {
            classes.push('db-no-data');
        }
        if (properties.visibility === 'false') {
            classes.push('novisible');
        }
        if (properties.teacherOnly === 'true' || properties.visibilityType === 'teacher') {
            classes.push('teacher-only');
        }
        if (properties.cssClass && typeof properties.cssClass === 'string') {
            classes.push(properties.cssClass);
        }

        // Build data attributes
        let dataAttrs = '';
        if (includeDataAttributes) {
            // For preview mode (server paths), basePath already contains /files/perm/idevices/base/
            // For export mode (ZIP), basePath is empty or relative and we need to add idevices/
            const isPreviewPath = basePath.includes('/files/perm/idevices/base/');
            const idevicePath = isPreviewPath
                ? `${basePath}${type}/export/`
                : `${basePath}idevices/${type}/`;

            dataAttrs = ` data-idevice-path="${this.escapeAttr(idevicePath)}"`;
            dataAttrs += ` data-idevice-type="${this.escapeAttr(type)}"`;

            if (config.componentType === 'json') {
                dataAttrs += ` data-idevice-component-type="json"`;

                // Add JSON data for non-text iDevices
                if (type !== 'text' && Object.keys(properties).length > 0) {
                    const jsonData = JSON.stringify(properties);
                    dataAttrs += ` data-idevice-json-data="${this.escapeAttr(jsonData)}"`;
                    dataAttrs += ` data-idevice-template="${this.escapeAttr(config.template)}"`;
                }
            }
        }

        // Fix asset URLs in content
        const fixedContent = this.fixAssetUrls(htmlContent, basePath);

        // Wrap text iDevice content in exe-text div (as per legacy format)
        const isTextIdevice = type === 'text' || type === 'FreeTextIdevice' || type === 'TextIdevice';
        const contentHtml =
            isTextIdevice && fixedContent ? `<div class="exe-text">${fixedContent}</div>` : fixedContent;

        // Generate HTML
        return `<div id="${this.escapeAttr(ideviceId)}" class="${classes.join(' ')}"${dataAttrs}>
${contentHtml}
</div>`;
    }

    /**
     * Render a block with multiple iDevices
     * @param block - Block data
     * @param options - Rendering options
     * @returns HTML string
     */
    renderBlock(block: ExportBlock, options: BlockRenderOptions = { basePath: '', includeDataAttributes: true }): string {
        const { basePath = '', includeDataAttributes = true } = options;

        const blockId = block.id;
        const blockName = block.name || '';
        const components = block.components || [];
        const properties: ExportBlockProperties = block.properties || {};

        // Build CSS classes for block
        const classes = ['box'];
        const hasHeader = blockName && blockName.trim() !== '';

        if (!hasHeader) {
            classes.push('no-header');
        }
        if (properties.minimized === 'true') {
            classes.push('minimized');
        }
        if (properties.visibility === 'false') {
            classes.push('novisible');
        }
        if (properties.teacherOnly === 'true' || properties.visibilityType === 'teacher') {
            classes.push('teacher-only');
        }
        if (properties.cssClass) {
            classes.push(properties.cssClass);
        }

        // Build block header
        let headerHtml = '';
        if (hasHeader) {
            headerHtml = `<header class="box-head no-icon">
<h1 class="box-title">${this.escapeHtml(blockName)}</h1>
</header>`;
        } else {
            headerHtml = '<div class="box-head"></div>';
        }

        // Render all iDevices in the block
        let contentHtml = '';
        for (const component of components) {
            contentHtml += this.render(component, { basePath, includeDataAttributes });
        }

        return `<article id="${this.escapeAttr(blockId)}" class="${classes.join(' ')}">
${headerHtml}
<div class="box-content">
${contentHtml}
</div>
</article>`;
    }

    /**
     * Fix asset URLs in HTML content
     * @param content - HTML content
     * @param basePath - Base path prefix
     * @returns Fixed HTML content
     */
    fixAssetUrls(content: string, basePath: string): string {
        if (!content) return '';

        // Skip blob: URLs - they're already resolved display URLs (browser-only)
        // This prevents: basePath + "blob:http://..." = broken URL
        // Also skip data: URLs (base64 embedded)
        let result = content;

        // Fix {{context_path}} placeholders (from ODE XML format)
        // These are stored in ELP files and need to be resolved during export
        result = result.replace(/\{\{context_path\}\}\/([^"'\s]+)/g, (_match, assetPath) => {
            if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
                return _match;
            }
            return `${basePath}content/resources/${assetPath}`;
        });

        // Fix asset:// protocol URLs (filename can contain spaces)
        // Skip if the path starts with blob: or data: (shouldn't happen, but defensive)
        result = result.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
            if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
                return _match; // Keep original, don't transform
            }
            return `${basePath}content/resources/${assetPath}`;
        });

        // Fix files/tmp/ paths (from server temp paths)
        // Skip blob: URLs that might be embedded in paths
        result = result.replace(
            /files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g,
            (_match, relativePath) => {
                if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
                    return _match;
                }
                return `${basePath}content/resources/${relativePath}`;
            }
        );

        // Fix relative paths that start with /files/
        result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
            if (path.startsWith('blob:') || path.startsWith('data:')) {
                return _match;
            }
            return `"${basePath}content/resources/${path}"`;
        });

        return result;
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
     * Escape attribute value
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeAttr(str: string): string {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Get list of CSS link tags needed for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of CSS link tags as strings
     */
    getCssLinks(ideviceTypes: string[], basePath: string = ''): string[] {
        const links: string[] = [];
        const seen = new Set<string>();

        for (const type of ideviceTypes) {
            const config = getIdeviceConfig(type);
            const typeName = type.toLowerCase().replace('idevice', '') || config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                links.push(`<link rel="stylesheet" href="${basePath}idevices/${typeName}/${typeName}.css">`);
            }
        }

        return links;
    }

    /**
     * Get list of JS script tags needed for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of script tags as strings
     */
    getJsScripts(ideviceTypes: string[], basePath: string = ''): string[] {
        const scripts: string[] = [];
        const seen = new Set<string>();

        for (const type of ideviceTypes) {
            const config = getIdeviceConfig(type);
            const typeName = type.toLowerCase().replace('idevice', '') || config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                scripts.push(`<script src="${basePath}idevices/${typeName}/${typeName}.js"></script>`);
            }
        }

        return scripts;
    }

    /**
     * Get list of CSS link info (without full tag) for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of link info objects
     */
    getCssLinkInfo(ideviceTypes: string[], basePath: string = ''): IdeviceCssLink[] {
        const links: IdeviceCssLink[] = [];
        const seen = new Set<string>();

        for (const type of ideviceTypes) {
            const config = getIdeviceConfig(type);
            const typeName = type.toLowerCase().replace('idevice', '') || config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                const href = `${basePath}idevices/${typeName}/${typeName}.css`;
                links.push({
                    href,
                    tag: `<link rel="stylesheet" href="${href}">`,
                });
            }
        }

        return links;
    }

    /**
     * Get list of JS script info (without full tag) for given iDevice types
     * @param ideviceTypes - Array of iDevice type names
     * @param basePath - Base path prefix
     * @returns Array of script info objects
     */
    getJsScriptInfo(ideviceTypes: string[], basePath: string = ''): IdeviceJsScript[] {
        const scripts: IdeviceJsScript[] = [];
        const seen = new Set<string>();

        for (const type of ideviceTypes) {
            const config = getIdeviceConfig(type);
            const typeName = type.toLowerCase().replace('idevice', '') || config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                const src = `${basePath}idevices/${typeName}/${typeName}.js`;
                scripts.push({
                    src,
                    tag: `<script src="${src}"></script>`,
                });
            }
        }

        return scripts;
    }
}

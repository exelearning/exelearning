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
import { getIdeviceConfig, getIdeviceExportFiles } from '../../../services/idevice-config';

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
    render(
        component: ExportComponent,
        options: ComponentRenderOptions = { basePath: '', includeDataAttributes: true },
    ): string {
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
        // Handle both boolean and string values (Yjs stores booleans, ELP uses strings)
        if (properties.visibility === false || properties.visibility === 'false') {
            classes.push('novisible');
        }
        if (
            properties.teacherOnly === true ||
            properties.teacherOnly === 'true' ||
            properties.visibilityType === 'teacher'
        ) {
            classes.push('teacher-only');
        }
        if (properties.cssClass && typeof properties.cssClass === 'string') {
            classes.push(properties.cssClass);
        }

        // Build data attributes
        let dataAttrs = '';
        if (includeDataAttributes) {
            // For export mode: basePath is "" for index.html, "../" for subpages
            // Use relative paths: "idevices/{type}/" or "../idevices/{type}/"
            // For preview mode: basePath starts with "/" or contains "://" (absolute), use: "{basePath}{type}/export/"
            const isPreviewModeForPath = basePath.startsWith('/') || basePath.includes('://');
            // Use config.cssClass for path (normalized type, e.g., 'download-package' -> 'download-source-file')
            const normalizedType = config.cssClass;
            const idevicePath = isPreviewModeForPath
                ? `${basePath}${normalizedType}/export/`
                : `${basePath}idevices/${normalizedType}/`;

            dataAttrs = ` data-idevice-path="${this.escapeAttr(idevicePath)}"`;
            dataAttrs += ` data-idevice-type="${this.escapeAttr(normalizedType)}"`;

            // Determine mode early - needed for both properties and content URL transformation
            // In preview mode (basePath starts with '/' or contains '://'), keep asset:// URLs for later blob resolution
            // Export mode: basePath is '' or '../' (relative)
            // Preview mode: basePath is '/files/...' or 'http://...' (absolute)
            const isPreviewModeForUrls = basePath.startsWith('/') || basePath.includes('://');

            if (config.componentType === 'json') {
                dataAttrs += ` data-idevice-component-type="json"`;

                // Add JSON data for iDevices with properties
                // Transform asset URLs in properties the same way as content
                if (Object.keys(properties).length > 0) {
                    const transformedProps = this.transformPropertiesUrls(properties, basePath, isPreviewModeForUrls);
                    const jsonData = JSON.stringify(transformedProps);
                    dataAttrs += ` data-idevice-json-data="${this.escapeAttr(jsonData)}"`;
                }
                // Always add template for JSON components (including text)
                if (config.template) {
                    dataAttrs += ` data-idevice-template="${this.escapeAttr(config.template)}"`;
                }
            }
        }

        // Fix asset URLs in content (uses same mode detection as properties)
        const isPreviewMode = basePath.startsWith('/') || basePath.includes('://');
        const fixedContent = this.fixAssetUrls(htmlContent, basePath, isPreviewMode);

        // Escape HTML entities inside <pre><code> blocks to display code examples correctly
        const escapedContent = this.escapePreCodeContent(fixedContent);

        // Wrap text iDevice content in exe-text div (as per legacy format)
        const isTextIdevice = type === 'text' || type === 'FreeTextIdevice' || type === 'TextIdevice';
        const contentHtml =
            isTextIdevice && escapedContent ? `<div class="exe-text">${escapedContent}</div>` : escapedContent;

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
    renderBlock(
        block: ExportBlock,
        options: BlockRenderOptions = { basePath: '', includeDataAttributes: true },
    ): string {
        const { basePath = '', includeDataAttributes = true, themeIconBasePath } = options;

        const blockId = block.id;
        const blockName = block.name || '';
        const components = block.components || [];
        const properties: ExportBlockProperties = block.properties || {};
        const iconName = block.iconName || '';

        // Build CSS classes for block
        const classes = ['box'];
        const hasHeader = blockName && blockName.trim() !== '';

        if (!hasHeader) {
            classes.push('no-header');
        }
        // Handle both boolean and string values (Yjs stores booleans, ELP uses strings)
        if (properties.minimized === true || properties.minimized === 'true') {
            classes.push('minimized');
        }
        if (properties.visibility === false || properties.visibility === 'false') {
            classes.push('novisible');
        }
        if (
            properties.teacherOnly === true ||
            properties.teacherOnly === 'true' ||
            properties.visibilityType === 'teacher'
        ) {
            classes.push('teacher-only');
        }
        if (properties.cssClass) {
            classes.push(properties.cssClass);
        }

        // Build block header - always render icon and toggle if enabled, even without title text
        const hasIcon = iconName && iconName.trim() !== '';
        const headerClass = hasIcon ? 'box-head' : 'box-head no-icon';

        // Build icon HTML if iconName exists
        let iconHtml = '';
        if (hasIcon) {
            // Icon path: use themeIconBasePath if provided (for preview), otherwise use basePath + theme/icons/
            const iconPath = themeIconBasePath
                ? `${themeIconBasePath}${iconName}.png`
                : `${basePath}theme/icons/${iconName}.png`;
            iconHtml = `<div class="box-icon exe-icon">
<img src="${this.escapeAttr(iconPath)}" alt="">
</div>
`;
        }

        // Build toggle button if allowToggle is enabled (default: true when undefined)
        // allowToggle defaults to true for backwards compatibility - users must explicitly disable it
        let toggleHtml = '';
        const shouldShowToggle = properties.allowToggle !== false && properties.allowToggle !== 'false';
        if (shouldShowToggle) {
            const toggleClass =
                properties.minimized === true || properties.minimized === 'true'
                    ? 'box-toggle box-toggle-off'
                    : 'box-toggle box-toggle-on';
            // Static text - will be translated at runtime by exe_export.js using $exe_i18n.toggleContent
            const toggleText = 'Toggle content';
            toggleHtml = `<button class="${toggleClass}" title="${this.escapeAttr(toggleText)}">
<span>${this.escapeHtml(toggleText)}</span>
</button>`;
        }

        // Build title only if blockName has text
        const titleHtml = hasHeader
            ? `<h1 class="box-title">${this.escapeHtml(blockName)}</h1>
`
            : '';

        const headerHtml = `<header class="${headerClass}">
${iconHtml}${titleHtml}${toggleHtml}</header>`;

        // Render all iDevices in the block
        let contentHtml = '';
        for (const component of components) {
            contentHtml += this.render(component, { basePath, includeDataAttributes });
        }

        // Build additional attributes (identifier support)
        let extraAttrs = '';
        if (properties.identifier) {
            extraAttrs += ` identifier="${this.escapeAttr(properties.identifier)}"`;
        }

        return `<article id="${this.escapeAttr(blockId)}" class="${classes.join(' ')}"${extraAttrs}>
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
     * @param isPreviewMode - If true, skip asset:// transformation (keep for blob resolution)
     * @param assetExportPathMap - Optional map of asset UUID to export path (for new URL format)
     * @returns Fixed HTML content
     */
    fixAssetUrls(
        content: string,
        basePath: string,
        isPreviewMode: boolean = false,
        assetExportPathMap?: Map<string, string>,
    ): string {
        if (!content) return '';

        // Skip blob: URLs - they're already resolved display URLs (browser-only)
        // This prevents: basePath + "blob:http://..." = broken URL
        // Also skip data: URLs (base64 embedded)
        let result = content;

        // Fix {{context_path}} placeholders (from ODE XML format)
        // These are stored in ELP files and need to be resolved during export
        // In preview mode, keep these for blob resolution
        if (!isPreviewMode) {
            result = result.replace(/\{\{context_path\}\}\/([^"'\s]+)/g, (_match, assetPath) => {
                if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
                    return _match;
                }
                return `${basePath}content/resources/${assetPath}`;
            });
        }

        // Fix asset:// protocol URLs
        // Supports two formats:
        // 1. New format: asset://uuid.ext (e.g., asset://abc123.jpg) - lookup UUID in assetExportPathMap
        // 2. Legacy format: asset://uuid/path (e.g., asset://abc123/images/photo.jpg) - use path after UUID
        // Skip blob: and data: URLs that might be wrapped in asset://
        // In preview mode, keep asset:// URLs for later blob resolution
        if (!isPreviewMode) {
            result = result.replace(/asset:\/\/([^"']+)/gi, (_match, fullPath) => {
                // Skip blob: and data: URLs completely
                if (fullPath.startsWith('blob:') || fullPath.startsWith('data:')) {
                    return _match; // Keep original, don't transform
                }

                // Check for new format: uuid.ext (no slash, has dot for extension)
                // UUID pattern: 36 chars with hyphens, optionally followed by .extension
                const newFormatMatch = fullPath.match(/^([a-f0-9-]{36})(?:\.([a-z0-9]+))?$/i);
                if (newFormatMatch) {
                    const uuid = newFormatMatch[1];
                    // Look up export path in map
                    if (assetExportPathMap?.has(uuid)) {
                        const exportPath = assetExportPathMap.get(uuid);
                        return `${basePath}content/resources/${exportPath}`;
                    }
                    // No map or UUID not found - keep original for now
                    return _match;
                }

                // Legacy format: uuid/path - extract path after UUID
                const slashIndex = fullPath.indexOf('/');
                if (slashIndex === -1) {
                    // No path after UUID, keep original
                    return _match;
                }
                const exportPath = fullPath.substring(slashIndex + 1);
                return `${basePath}content/resources/${exportPath}`;
            });
        }

        // Fix files/tmp/ paths (from server temp paths)
        // Skip blob: URLs that might be embedded in paths
        result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
            if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
                return _match;
            }
            return `${basePath}content/resources/${relativePath}`;
        });

        // Fix relative paths that start with /files/
        result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
            if (path.startsWith('blob:') || path.startsWith('data:')) {
                return _match;
            }
            return `"${basePath}content/resources/${path}"`;
        });

        // Fix legacy ELP format: src="resources/filename.png"
        // These are relative paths without asset:// or {{context_path}} prefix
        // Must be transformed to content/resources/ path
        result = result.replace(/(src|href)=(["'])resources\/([^"']+)\2/g, (_match, attr, quote, assetPath) => {
            if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
                return _match;
            }
            return `${attr}=${quote}${basePath}content/resources/${assetPath}${quote}`;
        });

        // Fix hardcoded localhost URLs with development ports (legacy Symfony/PHP servers)
        // These occur when content was created on a dev server with a specific port
        // Pattern: http://localhost:XXXXX/files/... or http://localhost:XXXXX/scripts/...
        // Convert to relative paths for portability
        result = result.replace(
            /http:\/\/localhost:\d+\/(files|scripts)\/(perm\/)?([^"'\s]+)/g,
            (_match, prefix, _perm, path) => {
                // Both files/perm/ and scripts/ paths should go to /files/perm/
                return `${basePath}files/perm/${path}`;
            },
        );

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
     * Unescape HTML entities
     * @param str - String with HTML entities
     * @returns Unescaped string
     */
    unescapeHtml(str: string): string {
        if (!str) return '';
        const map: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#039;': "'",
            '&#39;': "'",
        };
        return String(str).replace(/&(amp|lt|gt|quot|#0?39);/gi, m => map[m.toLowerCase()] || m);
    }

    /**
     * Escape HTML entities inside <pre><code>...</code></pre> blocks
     * while preserving the rest of the HTML content.
     * This prevents script tags and other HTML from being executed
     * when shown as example code.
     *
     * @param content - HTML content string
     * @returns HTML with escaped content inside pre>code blocks
     */
    escapePreCodeContent(content: string): string {
        if (!content) return '';

        // Match <pre><code>...</code></pre> blocks (with optional attributes/whitespace)
        const PRE_CODE_REGEX = /(<pre[^>]*>\s*<code[^>]*>)([\s\S]*?)(<\/code>\s*<\/pre>)/gi;

        return content.replace(PRE_CODE_REGEX, (_match, openTags, innerContent, closeTags) => {
            if (!innerContent.trim()) return openTags + innerContent + closeTags;

            // First decode any existing entities to avoid double-escaping
            const decoded = this.unescapeHtml(innerContent);
            // Then escape properly
            const escaped = this.escapeHtml(decoded);
            return openTags + escaped + closeTags;
        });
    }

    /**
     * Escape attribute value
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeAttr(str: string): string {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /**
     * Transform asset URLs in properties object recursively
     * Applies same URL transformation as fixAssetUrls to all string values in the object
     * @param obj - Properties object (can contain nested objects and arrays)
     * @param basePath - Base path prefix
     * @param isPreviewMode - If true, skip asset:// transformation (keep for blob resolution)
     * @param assetExportPathMap - Optional map of asset UUID to export path (for new URL format)
     * @returns Transformed properties object with fixed URLs
     */
    transformPropertiesUrls(
        obj: Record<string, unknown>,
        basePath: string,
        isPreviewMode: boolean,
        assetExportPathMap?: Map<string, string>,
    ): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                result[key] = this.fixAssetUrls(value, basePath, isPreviewMode, assetExportPathMap);
            } else if (Array.isArray(value)) {
                result[key] = value.map(item => {
                    if (typeof item === 'string') {
                        return this.fixAssetUrls(item, basePath, isPreviewMode, assetExportPathMap);
                    } else if (typeof item === 'object' && item !== null) {
                        return this.transformPropertiesUrls(
                            item as Record<string, unknown>,
                            basePath,
                            isPreviewMode,
                            assetExportPathMap,
                        );
                    }
                    return item;
                });
            } else if (typeof value === 'object' && value !== null) {
                result[key] = this.transformPropertiesUrls(
                    value as Record<string, unknown>,
                    basePath,
                    isPreviewMode,
                    assetExportPathMap,
                );
            } else {
                result[key] = value;
            }
        }
        return result;
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
            // Use cssClass from config for consistent path generation
            // This handles type normalization (e.g., 'download-package' -> 'download-source-file')
            const typeName = config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                // Get ALL CSS files from export folder (main file first, then dependencies)
                const cssFiles = getIdeviceExportFiles(typeName, '.css');
                for (const cssFile of cssFiles) {
                    links.push(`<link rel="stylesheet" href="${basePath}idevices/${typeName}/${cssFile}">`);
                }
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
            // Use cssClass from config for consistent path generation
            // This handles type normalization (e.g., 'download-package' -> 'download-source-file')
            const typeName = config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                // Get ALL JS files from export folder (main file first, then dependencies)
                const jsFiles = getIdeviceExportFiles(typeName, '.js');
                for (const jsFile of jsFiles) {
                    scripts.push(`<script src="${basePath}idevices/${typeName}/${jsFile}"></script>`);
                }
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
            // Use cssClass from config for consistent path generation
            const typeName = config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                // Get ALL CSS files from export folder
                const cssFiles = getIdeviceExportFiles(typeName, '.css');
                for (const cssFile of cssFiles) {
                    const href = `${basePath}idevices/${typeName}/${cssFile}`;
                    links.push({
                        href,
                        tag: `<link rel="stylesheet" href="${href}">`,
                    });
                }
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
            // Use cssClass from config for consistent path generation
            const typeName = config.cssClass;

            if (!seen.has(typeName)) {
                seen.add(typeName);
                // Get ALL JS files from export folder (main file first, then dependencies)
                const jsFiles = getIdeviceExportFiles(typeName, '.js');
                for (const jsFile of jsFiles) {
                    const src = `${basePath}idevices/${typeName}/${jsFile}`;
                    scripts.push({
                        src,
                        tag: `<script src="${src}"></script>`,
                    });
                }
            }
        }

        return scripts;
    }
}

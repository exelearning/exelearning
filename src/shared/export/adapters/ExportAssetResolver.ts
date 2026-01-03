/**
 * ExportAssetResolver
 *
 * Resolves asset URLs for ZIP exports.
 * Transforms asset:// protocol URLs to relative paths for use in exported packages.
 *
 * Examples:
 * - asset://uuid/filename.jpg → content/resources/uuid/filename.jpg
 * - asset://uuid/filename.jpg → ../content/resources/uuid/filename.jpg (with basePath="../")
 */

import type { AssetResolver, AssetResolverOptions } from '../interfaces';

export class ExportAssetResolver implements AssetResolver {
    private basePath: string;
    private resourceDir: string;

    constructor(options: AssetResolverOptions = {}) {
        this.basePath = options.basePath ?? '';
        this.resourceDir = options.resourceDir ?? 'content/resources';
    }

    /**
     * Resolve a single asset URL
     */
    resolve(assetUrl: string): string {
        return this.resolveSync(assetUrl);
    }

    /**
     * Synchronous resolution
     */
    resolveSync(assetUrl: string): string {
        // Skip blob: and data: URLs
        if (assetUrl.startsWith('blob:') || assetUrl.startsWith('data:')) {
            return assetUrl;
        }

        // Handle asset:// protocol
        if (assetUrl.startsWith('asset://')) {
            const assetPath = assetUrl.slice('asset://'.length);
            return `${this.basePath}${this.resourceDir}/${assetPath}`;
        }

        // Handle {{context_path}} placeholders (from ODE XML)
        if (assetUrl.includes('{{context_path}}')) {
            return assetUrl.replace('{{context_path}}/', `${this.basePath}${this.resourceDir}/`);
        }

        // Return unchanged for other URLs
        return assetUrl;
    }

    /**
     * Process HTML content, resolving all asset URLs
     */
    processHtml(html: string): string {
        return this.processHtmlSync(html);
    }

    /**
     * Synchronous HTML processing
     */
    processHtmlSync(html: string): string {
        if (!html) return '';

        let result = html;

        // Fix {{context_path}} placeholders (from ODE XML format)
        result = result.replace(/\{\{context_path\}\}\/([^"'\s]+)/g, (_match, assetPath) => {
            if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
                return _match;
            }
            return `${this.basePath}${this.resourceDir}/${assetPath}`;
        });

        // Fix asset:// protocol URLs (filename can contain spaces)
        result = result.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
            if (assetPath.startsWith('blob:') || assetPath.startsWith('data:')) {
                return _match;
            }
            return `${this.basePath}${this.resourceDir}/${assetPath}`;
        });

        // Fix files/tmp/ paths (from server temp paths)
        result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
            if (relativePath.startsWith('blob:') || relativePath.startsWith('data:')) {
                return _match;
            }
            return `${this.basePath}${this.resourceDir}/${relativePath}`;
        });

        // Fix relative paths that start with /files/
        result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
            if (path.startsWith('blob:') || path.startsWith('data:')) {
                return _match;
            }
            return `"${this.basePath}${this.resourceDir}/${path}"`;
        });

        return result;
    }

    /**
     * Create a new resolver with a different base path
     */
    withBasePath(basePath: string): ExportAssetResolver {
        return new ExportAssetResolver({
            basePath,
            resourceDir: this.resourceDir,
        });
    }
}

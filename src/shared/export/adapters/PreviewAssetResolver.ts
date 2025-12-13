/**
 * PreviewAssetResolver
 *
 * Resolves asset URLs for browser preview mode.
 * Transforms asset:// protocol URLs to blob:// URLs using the browser's asset cache.
 *
 * This resolver works with the browser's AssetCacheManager to:
 * 1. Look up assets by UUID in IndexedDB
 * 2. Create blob URLs for display
 * 3. Return blob URLs for use in preview HTML
 *
 * Usage (browser only):
 * ```typescript
 * const assetManager = window.assetManager; // or AssetCacheManager instance
 * const resolver = new PreviewAssetResolver(assetManager);
 * const html = await resolver.processHtml(content);
 * ```
 */

import type { AssetResolver, AssetResolverOptions } from '../interfaces';

/**
 * Interface for asset cache manager (browser-side)
 * This mirrors the AssetCacheManager API from the frontend
 */
export interface AssetCacheManager {
    resolveAssetUrl(assetId: string): Promise<string>;
    getAssetBlobUrl(assetId: string): string | null;
}

export class PreviewAssetResolver implements AssetResolver {
    private assetManager: AssetCacheManager;
    private basePath: string;
    private resolvedUrls: Map<string, string>;

    constructor(assetManager: AssetCacheManager, options: AssetResolverOptions = {}) {
        this.assetManager = assetManager;
        this.basePath = options.basePath ?? '';
        this.resolvedUrls = new Map();
    }

    /**
     * Resolve a single asset URL (async)
     * Looks up the asset in the cache and returns a blob URL
     */
    async resolve(assetUrl: string): Promise<string> {
        // Skip blob: and data: URLs (already resolved)
        if (assetUrl.startsWith('blob:') || assetUrl.startsWith('data:')) {
            return assetUrl;
        }

        // Handle asset:// protocol
        if (assetUrl.startsWith('asset://')) {
            const assetPath = assetUrl.slice('asset://'.length);
            // Extract UUID from path (format: uuid/filename.ext)
            const slashIndex = assetPath.indexOf('/');
            const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;

            // Check cache first
            const cached = this.resolvedUrls.get(assetId);
            if (cached) {
                return cached;
            }

            // Try to resolve via asset manager
            try {
                const blobUrl = await this.assetManager.resolveAssetUrl(assetId);
                if (blobUrl) {
                    this.resolvedUrls.set(assetId, blobUrl);
                    return blobUrl;
                }
            } catch {
                // Fall through to return original URL
            }
        }

        // Return original URL if not an asset:// URL or resolution failed
        return assetUrl;
    }

    /**
     * Synchronous resolution (returns cached blob URL or original URL)
     * Use this when you need sync behavior and assets were pre-resolved
     */
    resolveSync(assetUrl: string): string {
        // Skip blob: and data: URLs
        if (assetUrl.startsWith('blob:') || assetUrl.startsWith('data:')) {
            return assetUrl;
        }

        // Handle asset:// protocol
        if (assetUrl.startsWith('asset://')) {
            const assetPath = assetUrl.slice('asset://'.length);
            const slashIndex = assetPath.indexOf('/');
            const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;

            // Check local cache
            const cached = this.resolvedUrls.get(assetId);
            if (cached) {
                return cached;
            }

            // Try sync method on asset manager
            const syncUrl = this.assetManager.getAssetBlobUrl?.(assetId);
            if (syncUrl) {
                this.resolvedUrls.set(assetId, syncUrl);
                return syncUrl;
            }
        }

        // Return original URL if not resolved
        return assetUrl;
    }

    /**
     * Process HTML content, resolving all asset URLs (async)
     */
    async processHtml(html: string): Promise<string> {
        if (!html) return '';

        // Extract all asset:// URLs from the HTML
        const assetUrlPattern = /asset:\/\/([^"']+)/g;
        const assetUrls = new Set<string>();
        let match;

        while ((match = assetUrlPattern.exec(html)) !== null) {
            assetUrls.add(match[0]); // Full asset:// URL
        }

        // Resolve all URLs in parallel
        const resolutions = await Promise.all(
            Array.from(assetUrls).map(async url => ({
                original: url,
                resolved: await this.resolve(url),
            })),
        );

        // Replace all URLs in the HTML
        let result = html;
        for (const { original, resolved } of resolutions) {
            if (original !== resolved) {
                result = result.split(original).join(resolved);
            }
        }

        return result;
    }

    /**
     * Synchronous HTML processing (uses cached URLs only)
     */
    processHtmlSync(html: string): string {
        if (!html) return '';

        // Replace asset:// URLs with cached blob URLs
        return html.replace(/asset:\/\/([^"']+)/g, (fullMatch, assetPath) => {
            const slashIndex = assetPath.indexOf('/');
            const assetId = slashIndex > 0 ? assetPath.slice(0, slashIndex) : assetPath;

            // Check cache
            const cached = this.resolvedUrls.get(assetId);
            if (cached) {
                return cached;
            }

            // Try sync resolution
            const syncUrl = this.assetManager.getAssetBlobUrl?.(assetId);
            if (syncUrl) {
                this.resolvedUrls.set(assetId, syncUrl);
                return syncUrl;
            }

            // Return original if not resolved
            return fullMatch;
        });
    }

    /**
     * Pre-resolve a list of asset IDs (call before processHtmlSync)
     */
    async preResolve(assetIds: string[]): Promise<void> {
        await Promise.all(
            assetIds.map(async assetId => {
                if (!this.resolvedUrls.has(assetId)) {
                    try {
                        const url = await this.assetManager.resolveAssetUrl(assetId);
                        if (url) {
                            this.resolvedUrls.set(assetId, url);
                        }
                    } catch {
                        // Ignore resolution failures
                    }
                }
            }),
        );
    }

    /**
     * Clear the resolution cache
     */
    clearCache(): void {
        this.resolvedUrls.clear();
    }
}

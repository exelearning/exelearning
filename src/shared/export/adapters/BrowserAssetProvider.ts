/**
 * BrowserAssetProvider
 *
 * Adapts AssetCacheManager (browser IndexedDB) to the unified AssetProvider interface.
 * Provides access to project assets stored in browser's IndexedDB.
 *
 * Usage:
 * ```typescript
 * import { BrowserAssetProvider } from './adapters/BrowserAssetProvider';
 *
 * const assetCache = new AssetCacheManager(projectId);
 * const provider = new BrowserAssetProvider(assetCache);
 * const imageData = await provider.getAsset('abc123/image.png');
 * ```
 */

import type { AssetProvider, ExportAsset } from '../interfaces';

/**
 * Interface for AssetCacheManager (browser class)
 */
interface AssetCacheManagerInterface {
    getAllAssets(): Promise<
        Array<{
            assetId: number | string;
            blob: Blob;
            metadata: {
                originalPath?: string;
                filename?: string;
                mimeType?: string;
            };
        }>
    >;
    getAssetByPath(path: string): Promise<{ blob: Blob; metadata: Record<string, unknown> } | null>;
    resolveAssetUrl(path: string): Promise<string | null>;
}

/**
 * Optional AssetManager interface for additional asset operations
 */
interface AssetManagerInterface {
    getAssetData?(assetId: string): Promise<Blob | null>;
    listAssets?(): Promise<Array<{ id: string; path: string }>>;
}

/**
 * BrowserAssetProvider class
 * Implements AssetProvider interface for browser-based exports
 */
export class BrowserAssetProvider implements AssetProvider {
    private assetCache: AssetCacheManagerInterface;
    private assetManager: AssetManagerInterface | null;

    /**
     * Create provider with AssetCacheManager instance
     * @param assetCache - AssetCacheManager instance
     * @param assetManager - Optional AssetManager for additional operations
     */
    constructor(assetCache: AssetCacheManagerInterface, assetManager: AssetManagerInterface | null = null) {
        this.assetCache = assetCache;
        this.assetManager = assetManager;
    }

    /**
     * Get asset data by path/id
     * @param assetId - Asset path or ID (e.g., 'abc123/image.png')
     * @returns ExportAsset or null if not found
     */
    async getAsset(assetId: string): Promise<ExportAsset | null> {
        try {
            const cached = await this.assetCache.getAssetByPath(assetId);
            if (cached && cached.blob) {
                const arrayBuffer = await cached.blob.arrayBuffer();
                const filename = (cached.metadata?.filename as string) || assetId.split('/').pop() || 'unknown';
                return {
                    id: assetId,
                    filename,
                    originalPath: assetId,
                    mime: (cached.metadata?.mimeType as string) || 'application/octet-stream',
                    data: new Uint8Array(arrayBuffer),
                };
            }
            return null;
        } catch (error) {
            console.warn(`[BrowserAssetProvider] Failed to get asset: ${assetId}`, error);
            return null;
        }
    }

    /**
     * Check if an asset exists
     * @param assetPath - Asset path
     * @returns true if asset exists
     */
    async hasAsset(assetPath: string): Promise<boolean> {
        try {
            const cached = await this.assetCache.getAssetByPath(assetPath);
            return cached !== null && cached.blob !== undefined;
        } catch {
            return false;
        }
    }

    /**
     * List all available assets
     * @returns Array of asset paths
     */
    async listAssets(): Promise<string[]> {
        try {
            const assets = await this.assetCache.getAllAssets();
            return assets.filter(a => a.metadata?.originalPath).map(a => a.metadata.originalPath as string);
        } catch (error) {
            console.warn('[BrowserAssetProvider] Failed to list assets:', error);
            return [];
        }
    }

    /**
     * Get all assets as ExportAsset array
     * @returns Array of ExportAsset
     */
    async getAllAssets(): Promise<ExportAsset[]> {
        const result: ExportAsset[] = [];

        try {
            const assets = await this.assetCache.getAllAssets();

            for (const asset of assets) {
                if (asset.blob) {
                    const arrayBuffer = await asset.blob.arrayBuffer();
                    const assetId = String(asset.assetId);
                    const filename = asset.metadata?.filename || `asset-${assetId}`;
                    const originalPath = asset.metadata?.originalPath || `${assetId}/${filename}`;

                    result.push({
                        id: assetId,
                        filename,
                        originalPath,
                        mime: asset.metadata?.mimeType || 'application/octet-stream',
                        data: new Uint8Array(arrayBuffer),
                    });
                }
            }
        } catch (error) {
            console.warn('[BrowserAssetProvider] Failed to get all assets:', error);
        }

        return result;
    }

    /**
     * Get all project assets (alias for getAllAssets)
     * @returns Array of ExportAsset
     */
    async getProjectAssets(): Promise<ExportAsset[]> {
        return this.getAllAssets();
    }

    /**
     * Resolve asset URL for preview (returns blob URL)
     * @param assetPath - Asset path
     * @returns Blob URL or null
     */
    async resolveAssetUrl(assetPath: string): Promise<string | null> {
        try {
            return await this.assetCache.resolveAssetUrl(assetPath);
        } catch {
            return null;
        }
    }
}

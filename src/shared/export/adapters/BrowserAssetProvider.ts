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

import type { AssetProvider } from '../interfaces';

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
    getAssetByPath(
        path: string
    ): Promise<{ blob: Blob; metadata: Record<string, unknown> } | null>;
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
    constructor(
        assetCache: AssetCacheManagerInterface,
        assetManager: AssetManagerInterface | null = null
    ) {
        this.assetCache = assetCache;
        this.assetManager = assetManager;
    }

    /**
     * Get asset data by path
     * @param assetPath - Asset path (e.g., 'abc123/image.png')
     * @returns Asset data as Buffer or null if not found
     */
    async getAsset(assetPath: string): Promise<Buffer | null> {
        try {
            const cached = await this.assetCache.getAssetByPath(assetPath);
            if (cached && cached.blob) {
                const arrayBuffer = await cached.blob.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }
            return null;
        } catch (error) {
            console.warn(
                `[BrowserAssetProvider] Failed to get asset: ${assetPath}`,
                error
            );
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
            return assets
                .filter((a) => a.metadata?.originalPath)
                .map((a) => a.metadata.originalPath as string);
        } catch (error) {
            console.warn(
                '[BrowserAssetProvider] Failed to list assets:',
                error
            );
            return [];
        }
    }

    /**
     * Get all assets as a Map
     * @returns Map of path -> Buffer
     */
    async getAllAssets(): Promise<Map<string, Buffer>> {
        const result = new Map<string, Buffer>();

        try {
            const assets = await this.assetCache.getAllAssets();

            for (const asset of assets) {
                if (asset.metadata?.originalPath && asset.blob) {
                    const arrayBuffer = await asset.blob.arrayBuffer();
                    result.set(
                        asset.metadata.originalPath,
                        Buffer.from(arrayBuffer)
                    );
                }
            }
        } catch (error) {
            console.warn(
                '[BrowserAssetProvider] Failed to get all assets:',
                error
            );
        }

        return result;
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

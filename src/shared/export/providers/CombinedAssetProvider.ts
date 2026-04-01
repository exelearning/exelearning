/**
 * CombinedAssetProvider
 *
 * Combines multiple AssetProviders, checking each in order until an asset is found.
 * Useful for server-side exports that need to search both database assets and
 * file system assets.
 *
 * Usage:
 * ```typescript
 * const dbProvider = new DatabaseAssetProvider(db, projectId);
 * const fsProvider = new FileSystemAssetProvider(tempDir);
 * const combined = new CombinedAssetProvider([dbProvider, fsProvider]);
 *
 * // Will search dbProvider first, then fsProvider
 * const asset = await combined.getAsset('uuid/image.png');
 * ```
 */

import type { AssetProvider, ExportAsset } from '../interfaces';

/**
 * CombinedAssetProvider class
 * Implements AssetProvider by delegating to multiple providers in order
 */
export class CombinedAssetProvider implements AssetProvider {
    private providers: AssetProvider[];

    /**
     * @param providers - Array of AssetProviders to search in order
     */
    constructor(providers: AssetProvider[]) {
        this.providers = providers;
    }

    /**
     * Get a single asset by searching all providers in order
     * @param assetPath - Asset path
     * @returns Export asset from the first provider that has it, or null
     */
    async getAsset(assetPath: string): Promise<ExportAsset | null> {
        for (const provider of this.providers) {
            try {
                const asset = await provider.getAsset(assetPath);
                if (asset) {
                    return asset;
                }
            } catch (error) {
                // Continue to next provider
                console.warn(`[CombinedAssetProvider] Provider error for ${assetPath}:`, error);
            }
        }
        return null;
    }

    /**
     * Get all assets from all providers (deduplicated by ID)
     * @returns Array of all export assets
     */
    async getAllAssets(): Promise<ExportAsset[]> {
        const seen = new Set<string>();
        const assets: ExportAsset[] = [];

        for (const provider of this.providers) {
            try {
                const providerAssets = await provider.getAllAssets();
                for (const asset of providerAssets) {
                    // Use id or originalPath for deduplication
                    const key = asset.id || asset.originalPath;
                    if (!seen.has(key)) {
                        seen.add(key);
                        assets.push(asset);
                    }
                }
            } catch (error) {
                console.warn('[CombinedAssetProvider] Provider error in getAllAssets:', error);
            }
        }

        return assets;
    }

    /**
     * Get all assets from the project (implements AssetProvider interface)
     * @returns Array of all export assets
     */
    async getProjectAssets(): Promise<ExportAsset[]> {
        return this.getAllAssets();
    }

    /**
     * Process assets one at a time via callback across all providers.
     * Deduplicates by asset ID.
     *
     * @returns Number of assets processed
     */
    async forEachAsset(callback: (asset: ExportAsset) => Promise<void>): Promise<number> {
        const seen = new Set<string>();
        let count = 0;

        for (const provider of this.providers) {
            if (provider.forEachAsset) {
                await provider.forEachAsset(async asset => {
                    const key = asset.id || asset.originalPath;
                    if (!seen.has(key)) {
                        seen.add(key);
                        await callback(asset);
                        count++;
                    }
                });
            } else {
                // Fallback to getAllAssets for providers without forEachAsset
                const providerAssets = await provider.getAllAssets();
                for (const asset of providerAssets) {
                    const key = asset.id || asset.originalPath;
                    if (!seen.has(key)) {
                        seen.add(key);
                        await callback(asset);
                        count++;
                    }
                }
            }
        }

        return count;
    }

    /**
     * List asset metadata without loading binary data, across all providers.
     * Deduplicates by asset ID.
     */
    async listAssetMetadata(): Promise<Array<{ id: string; filename: string; folderPath?: string; mime: string }>> {
        const seen = new Set<string>();
        const result: Array<{ id: string; filename: string; folderPath?: string; mime: string }> = [];

        for (const provider of this.providers) {
            if (provider.listAssetMetadata) {
                const metadata = await provider.listAssetMetadata();
                for (const item of metadata) {
                    if (!seen.has(item.id)) {
                        seen.add(item.id);
                        result.push(item);
                    }
                }
            } else {
                // Fallback to getAllAssets
                const assets = await provider.getAllAssets();
                for (const asset of assets) {
                    if (!seen.has(asset.id)) {
                        seen.add(asset.id);
                        result.push({
                            id: asset.id,
                            filename: asset.filename,
                            folderPath: asset.folderPath,
                            mime: asset.mime,
                        });
                    }
                }
            }
        }

        return result;
    }

    /**
     * Check if an asset exists in any provider
     * @param assetPath - Asset path
     * @returns True if asset exists in any provider
     */
    async exists(assetPath: string): Promise<boolean> {
        for (const provider of this.providers) {
            if (provider.exists && (await provider.exists(assetPath))) {
                return true;
            }
        }
        // Fallback: try to get the asset
        const asset = await this.getAsset(assetPath);
        return asset !== null;
    }

    /**
     * Get asset content as Buffer
     * @param assetPath - Asset path
     * @returns Buffer content or null
     */
    async getContent(assetPath: string): Promise<Buffer | null> {
        const asset = await this.getAsset(assetPath);
        if (!asset) return null;
        if (Buffer.isBuffer(asset.data)) {
            return asset.data;
        }
        return Buffer.from(asset.data as Uint8Array);
    }

    /**
     * Get asset MIME type (from first provider that has the method)
     * @param assetPath - Asset path
     * @returns MIME type string
     */
    getMimeType(assetPath: string): string {
        for (const provider of this.providers) {
            if (provider.getMimeType) {
                return provider.getMimeType(assetPath);
            }
        }
        return 'application/octet-stream';
    }

    /**
     * Clear cache on all providers that support it
     */
    clearCache(): void {
        for (const provider of this.providers) {
            if (provider.clearCache) {
                provider.clearCache();
            }
        }
    }

    /**
     * Get the list of providers
     * @returns Array of providers
     */
    getProviders(): AssetProvider[] {
        return [...this.providers];
    }

    /**
     * Add a provider to the end of the search list
     * @param provider - AssetProvider to add
     */
    addProvider(provider: AssetProvider): void {
        this.providers.push(provider);
    }

    /**
     * Add a provider to the beginning of the search list (highest priority)
     * @param provider - AssetProvider to add
     */
    prependProvider(provider: AssetProvider): void {
        this.providers.unshift(provider);
    }
}

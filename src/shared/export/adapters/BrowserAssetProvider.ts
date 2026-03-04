/**
 * BrowserAssetProvider
 *
 * Adapts AssetManager (browser) to the unified AssetProvider interface.
 * Provides access to project assets stored in browser's memory and Cache API.
 *
 * Usage:
 * ```typescript
 * import { BrowserAssetProvider } from './adapters/BrowserAssetProvider';
 *
 * const assetManager = window.eXeLearning.app.project._yjsBridge.assetManager;
 * const provider = new BrowserAssetProvider(assetManager);
 *
 * // Or with null when no AssetManager is available
 * const nullProvider = new BrowserAssetProvider(null);
 * ```
 */

import type { AssetProvider, ExportAsset } from '../interfaces';
import { deriveFilenameFromMime } from '../../../config';

/**
 * Interface for AssetManager (browser class)
 * Uses top-level properties and id
 */
interface AssetManagerInterface {
    getProjectAssets(): Promise<
        Array<{
            id: string;
            blob: Blob;
            mime: string;
            filename?: string;
            originalPath?: string;
            folderPath?: string;
            hash?: string;
            size?: number;
            projectId?: string;
        }>
    >;
    getAllAssetsRaw?(): Promise<
        Array<{
            id: string;
            blob: Blob;
            mime: string;
            filename?: string;
            originalPath?: string;
            folderPath?: string;
            hash?: string;
            size?: number;
            projectId?: string;
        }>
    >;
    getAsset?(assetId: string): Promise<{ id: string; blob: Blob; mime: string } | null>;
    resolveAssetURL?(assetUrl: string): Promise<string | null>;
}

/**
 * Return true when a filename should be treated as missing/unknown.
 */
function isUnknownFilename(filename: string | undefined): boolean {
    return !filename || filename === 'unknown';
}

/**
 * BrowserAssetProvider class
 * Implements AssetProvider interface for browser-based exports
 */
export class BrowserAssetProvider implements AssetProvider {
    private assetManager: AssetManagerInterface | null;

    /**
     * Create provider with AssetManager instance.
     *
     * Accepts one or two arguments for backward compatibility with call sites that
     * pass `(assetCache, assetManager)`. When two arguments are provided the second
     * one (the new AssetManager) is used; the first (legacy cache) is ignored.
     *
     * @param assetCacheOrManager - AssetManager, or legacy AssetCacheManager (ignored when assetManager is supplied)
     * @param assetManager - Preferred new AssetManager (optional)
     */
    constructor(assetCacheOrManager: AssetManagerInterface | null, assetManager?: AssetManagerInterface | null) {
        this.assetManager = assetManager !== undefined ? assetManager : assetCacheOrManager;
    }

    /**
     * Get asset data by path/id
     * @param assetId - Asset path or ID (e.g., 'abc123/image.png')
     * @returns ExportAsset or null if not found
     */
    async getAsset(assetId: string): Promise<ExportAsset | null> {
        try {
            if (this.assetManager?.getAsset) {
                const asset = await this.assetManager.getAsset(assetId);
                if (asset?.blob) {
                    const arrayBuffer = await asset.blob.arrayBuffer();
                    const assetFilename = (asset as unknown as { filename?: string }).filename;
                    const filename = !isUnknownFilename(assetFilename)
                        ? assetFilename!
                        : assetId.split('/').pop() || deriveFilenameFromMime(asset.id, asset.mime);
                    return {
                        id: asset.id,
                        filename,
                        originalPath: assetId,
                        mime: asset.mime || 'application/octet-stream',
                        data: new Uint8Array(arrayBuffer),
                    };
                }
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
            if (this.assetManager?.getAsset) {
                const asset = await this.assetManager.getAsset(assetPath);
                if (asset?.blob) {
                    return true;
                }
            }

            return false;
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
            if (this.assetManager) {
                const assets = await this.assetManager.getProjectAssets();
                return assets
                    .filter(a => a.originalPath || a.filename)
                    .map(a => a.originalPath || `${a.id}/${a.filename}`);
            }

            return [];
        } catch (error) {
            console.warn('[BrowserAssetProvider] Failed to list assets:', error);
            return [];
        }
    }

    /**
     * Get all assets as ExportAsset array
     * This is the main method used for exports - it retrieves all project assets
     * and converts them to the ExportAsset format.
     *
     * @returns Array of ExportAsset
     */
    async getAllAssets(): Promise<ExportAsset[]> {
        const result: ExportAsset[] = [];

        try {
            if (this.assetManager) {
                // Log projectId if available
                const projectId = (this.assetManager as unknown as { projectId?: string }).projectId;
                console.log(`[BrowserAssetProvider] AssetManager available, projectId: ${projectId}`);
                console.log(`[BrowserAssetProvider] Calling getProjectAssets...`);
                const assets = await this.assetManager.getProjectAssets();
                console.log(`[BrowserAssetProvider] Found ${assets.length} assets from AssetManager`);
                if (assets.length > 0) {
                    console.log(
                        `[BrowserAssetProvider] First asset:`,
                        JSON.stringify({
                            id: assets[0].id,
                            filename: assets[0].filename,
                            mime: assets[0].mime,
                            hasBlob: !!assets[0].blob,
                        }),
                    );
                }

                // Convert all blobs to ArrayBuffer in parallel for better performance
                const assetsWithBlob = assets.filter(asset => asset.blob);
                const conversions = await Promise.all(
                    assetsWithBlob.map(async asset => {
                        const arrayBuffer = await asset.blob!.arrayBuffer();
                        return { asset, arrayBuffer };
                    }),
                );

                for (const { asset, arrayBuffer } of conversions) {
                    const assetId = String(asset.id);
                    const filename = !isUnknownFilename(asset.filename)
                        ? asset.filename!
                        : deriveFilenameFromMime(assetId, asset.mime);

                    // Determine originalPath based on folderPath (folder support)
                    // Priority:
                    // 1. If folderPath is set, use folderPath/filename
                    // 2. If originalPath includes UUID, use it as-is
                    // 3. Fallback to uuid/filename
                    let originalPath: string;
                    if (asset.folderPath) {
                        // Use folder path for organized assets
                        originalPath = `${asset.folderPath}/${filename}`;
                    } else if (asset.originalPath?.includes(assetId)) {
                        // Path already includes UUID (e.g., "abc123/elcid.png" or "content/resources/abc123/elcid.png")
                        originalPath = asset.originalPath;
                    } else {
                        // Construct correct path with UUID folder
                        originalPath = `${assetId}/${filename}`;
                    }

                    result.push({
                        id: assetId,
                        filename,
                        originalPath,
                        folderPath: asset.folderPath || '',
                        mime: asset.mime || 'application/octet-stream',
                        data: new Uint8Array(arrayBuffer),
                    });
                }

                if (result.length > 0) {
                    console.log(`[BrowserAssetProvider] Converted ${result.length} assets for export`);
                    return result;
                } else {
                    console.log(`[BrowserAssetProvider] AssetManager returned 0 usable assets (no blobs)`);

                    // FALLBACK: If getProjectAssets returned 0, try getAllAssetsRaw
                    // This helps debug projectId mismatch issues
                    if (this.assetManager.getAllAssetsRaw) {
                        console.log(`[BrowserAssetProvider] Trying fallback: getAllAssetsRaw...`);
                        const allAssets = await this.assetManager.getAllAssetsRaw();
                        if (allAssets.length > 0) {
                            console.warn(
                                `[BrowserAssetProvider] FALLBACK: Found ${allAssets.length} assets in DB (different projectIds)`,
                            );
                            // Log the projectIds for debugging
                            const projectIds = [...new Set(allAssets.map(a => a.projectId))];
                            console.warn(`[BrowserAssetProvider] ProjectIds in DB: ${projectIds.join(', ')}`);
                            console.warn(`[BrowserAssetProvider] Expected projectId: ${projectId}`);

                            // Only use assets that match the expected projectId
                            // This prevents cross-project contamination in exports
                            const filteredAssets = allAssets.filter(a => a.projectId === projectId);
                            if (filteredAssets.length < allAssets.length) {
                                console.warn(
                                    `[BrowserAssetProvider] Filtered out ${allAssets.length - filteredAssets.length} assets from other projects`,
                                );
                            }
                            console.log(
                                `[BrowserAssetProvider] FALLBACK filtered to ${filteredAssets.length} assets matching projectId: ${projectId}`,
                            );

                            for (const asset of filteredAssets) {
                                if (asset.blob) {
                                    const arrayBuffer = await asset.blob.arrayBuffer();
                                    const assetId = String(asset.id);
                                    const filename = !isUnknownFilename(asset.filename)
                                        ? asset.filename!
                                        : deriveFilenameFromMime(assetId, asset.mime);

                                    // Same folderPath logic as above
                                    let originalPath: string;
                                    if (asset.folderPath) {
                                        originalPath = `${asset.folderPath}/${filename}`;
                                    } else if (asset.originalPath?.includes(assetId)) {
                                        originalPath = asset.originalPath;
                                    } else {
                                        originalPath = `${assetId}/${filename}`;
                                    }

                                    result.push({
                                        id: assetId,
                                        filename,
                                        originalPath,
                                        folderPath: asset.folderPath || '',
                                        mime: asset.mime || 'application/octet-stream',
                                        data: new Uint8Array(arrayBuffer),
                                    });
                                }
                            }
                            if (result.length > 0) {
                                console.log(
                                    `[BrowserAssetProvider] FALLBACK converted ${result.length} assets for export`,
                                );
                                return result;
                            }
                        }
                    }
                }
            } else {
                console.log(`[BrowserAssetProvider] AssetManager not available`);
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
            if (this.assetManager?.resolveAssetURL) {
                const url = await this.assetManager.resolveAssetURL(assetPath);
                if (url) return url;
            }

            return null;
        } catch {
            return null;
        }
    }
}

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
    getProjectAssets(options?: { includeBlobs?: boolean }): Promise<
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
    getAllAssetsMetadata?(): Array<{
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
        size?: number;
        hash?: string;
    }>;
    getAssetMetadata?(assetId: string): {
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
        size?: number;
        hash?: string;
    } | null;
    getBlob?(assetId: string, options?: { restoreToMemory?: boolean }): Promise<Blob | null>;
    getBlobForExport?(assetId: string): Promise<Blob | null>;
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
/** Default batch size for parallel blob→Uint8Array conversion. */
const CONVERSION_BATCH_SIZE = 20;

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

    /** Read the projectId from the AssetManager (not part of the formal interface). */
    private get projectId(): string | undefined {
        return (this.assetManager as unknown as { projectId?: string })?.projectId;
    }

    /**
     * Get asset data by path/id
     * @param assetId - Asset path or ID (e.g., 'abc123/image.png')
     * @returns ExportAsset or null if not found
     */
    async getAsset(assetId: string): Promise<ExportAsset | null> {
        try {
            const metadata = this.getMetadataById(assetId);
            if (metadata) {
                const blob = await this.getBlobWithoutPromoting(assetId);
                if (blob) {
                    return this.blobAssetToExportAsset({
                        id: metadata.id,
                        blob,
                        mime: metadata.mime || blob.type || 'application/octet-stream',
                        filename: metadata.filename,
                        folderPath: metadata.folderPath,
                    });
                }
            }

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
            if (!this.assetManager) return [];

            // Prefer metadata-only read (no blob loading)
            if (this.assetManager.getAllAssetsMetadata) {
                const metadata = this.assetManager.getAllAssetsMetadata();
                if (metadata.length > 0) {
                    return metadata
                        .filter(a => a.filename)
                        .map(a => {
                            const filename = a.filename!;
                            return a.folderPath ? `${a.folderPath}/${filename}` : `${a.id}/${filename}`;
                        });
                }
            }

            // Fallback: getProjectAssets
            const assets = await this.assetManager.getProjectAssets();
            return assets.filter(a => a.originalPath || a.filename).map(a => a.originalPath || `${a.id}/${a.filename}`);
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
        if (!this.assetManager) return [];

        try {
            const metadataAssets = await this.collectAssetsFromMetadata();
            if (metadataAssets.length > 0) {
                return metadataAssets;
            }

            const assets = await this.assetManager.getProjectAssets();
            const assetsWithBlob = assets.filter(asset => asset.blob);

            if (assetsWithBlob.length > 0) {
                return Promise.all(assetsWithBlob.map(asset => this.blobAssetToExportAsset(asset)));
            }

            // Fallback: getAllAssetsRaw filtered by projectId
            if (this.assetManager.getAllAssetsRaw) {
                const allAssets = await this.assetManager.getAllAssetsRaw();
                const filteredAssets = allAssets.filter(a => a.projectId === this.projectId && a.blob);
                if (filteredAssets.length > 0) {
                    return Promise.all(filteredAssets.map(a => this.blobAssetToExportAsset(a)));
                }
            }

            return [];
        } catch (error) {
            console.warn('[BrowserAssetProvider] Failed to get all assets:', error);
            return [];
        }
    }

    /**
     * Get all project assets (alias for getAllAssets)
     * @returns Array of ExportAsset
     */
    async getProjectAssets(): Promise<ExportAsset[]> {
        return this.getAllAssets();
    }

    /**
     * Process assets via callback with batched parallelism.
     * Converts blobs in batches of {@link CONVERSION_BATCH_SIZE} to balance
     * throughput (parallel I/O) against memory (not all buffers at once).
     *
     * @returns Number of assets processed
     */
    async forEachAsset(callback: (asset: ExportAsset) => Promise<void>): Promise<number> {
        if (!this.assetManager) return 0;

        try {
            const metadataCount = await this.processMetadataAssets(callback);
            if (metadataCount > 0) {
                return metadataCount;
            }

            const assets = await this.assetManager.getProjectAssets();
            const assetsWithBlob = assets.filter(a => a.blob);

            if (assetsWithBlob.length > 0) {
                return this.processAssetBatches(assetsWithBlob, callback);
            }

            // Fallback: getAllAssetsRaw filtered by projectId
            if (this.assetManager.getAllAssetsRaw) {
                const allAssets = await this.assetManager.getAllAssetsRaw();
                const filteredAssets = allAssets.filter(a => a.projectId === this.projectId && a.blob);
                if (filteredAssets.length > 0) {
                    return this.processAssetBatches(filteredAssets, callback);
                }
            }

            return 0;
        } catch (error) {
            console.warn('[BrowserAssetProvider] Failed in forEachAsset:', error);
            return 0;
        }
    }

    /**
     * List asset metadata without loading binary data.
     * Uses getAllAssetsMetadata() which reads only Yjs metadata — no blob loading.
     * Falls back to getProjectAssets() when getAllAssetsMetadata is not available.
     *
     * @returns Lightweight metadata array
     */
    async listAssetMetadata(): Promise<Array<{ id: string; filename: string; folderPath?: string; mime: string }>> {
        if (!this.assetManager) return [];

        const toMetadata = (asset: { id: string; mime?: string; filename?: string; folderPath?: string }) => {
            const assetId = String(asset.id);
            const mime = asset.mime || 'application/octet-stream';
            const filename = !isUnknownFilename(asset.filename)
                ? asset.filename!
                : deriveFilenameFromMime(assetId, mime);
            return {
                id: assetId,
                filename,
                folderPath: asset.folderPath || '',
                mime,
            };
        };

        try {
            // Prefer getAllAssetsMetadata() — reads Yjs Y.Map only, no blob loading
            if (this.assetManager.getAllAssetsMetadata) {
                const allMetadata = this.assetManager.getAllAssetsMetadata();
                const filtered = allMetadata.filter(a => a.filename || a.mime);
                if (filtered.length > 0) {
                    return filtered.map(toMetadata);
                }
            }

            // Fallback: use getProjectAssets (loads blobs but works everywhere)
            const assets = await this.assetManager.getProjectAssets();
            const assetsWithBlob = assets.filter(a => a.blob);

            if (assetsWithBlob.length > 0) {
                return assetsWithBlob.map(toMetadata);
            }

            // Last resort fallback: getAllAssetsRaw
            if (this.assetManager.getAllAssetsRaw) {
                const allAssets = await this.assetManager.getAllAssetsRaw();
                const filteredAssets = allAssets.filter(a => a.projectId === this.projectId && a.blob);
                return filteredAssets.map(toMetadata);
            }

            return [];
        } catch (error) {
            console.warn('[BrowserAssetProvider] Failed to list asset metadata:', error);
            return [];
        }
    }

    /**
     * Return metadata directly from Yjs when available.
     * This is the preferred source for export/preview because it avoids blob loading.
     */
    private getMetadataEntries(): Array<{
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
        size?: number;
        hash?: string;
    }> {
        if (!this.assetManager?.getAllAssetsMetadata) {
            return [];
        }

        return this.assetManager.getAllAssetsMetadata().filter(asset => asset.id);
    }

    /**
     * Resolve one metadata entry by id without falling back to blob-loading APIs.
     */
    private getMetadataById(assetId: string): {
        id: string;
        filename?: string;
        folderPath?: string;
        mime?: string;
        size?: number;
        hash?: string;
    } | null {
        if (this.assetManager?.getAssetMetadata) {
            return this.assetManager.getAssetMetadata(assetId);
        }

        const metadata = this.getMetadataEntries();
        return metadata.find(asset => asset.id === assetId) || null;
    }

    /**
     * Read blob data without rehydrating blobCache from Cache API.
     */
    private async getBlobWithoutPromoting(assetId: string): Promise<Blob | null> {
        if (!this.assetManager) {
            return null;
        }

        if (this.assetManager.getBlobForExport) {
            return this.assetManager.getBlobForExport(assetId);
        }

        if (this.assetManager.getBlob) {
            return this.assetManager.getBlob(assetId, { restoreToMemory: false });
        }

        return null;
    }

    /**
     * Convert all metadata-backed assets without calling getProjectAssets().
     */
    private async collectAssetsFromMetadata(): Promise<ExportAsset[]> {
        const result: ExportAsset[] = [];
        await this.processMetadataAssets(async asset => {
            result.push(asset);
        });
        return result;
    }

    /**
     * Process metadata-backed assets in bounded batches, loading blobs on demand.
     */
    private async processMetadataAssets(callback: (asset: ExportAsset) => Promise<void>): Promise<number> {
        const metadataEntries = this.getMetadataEntries();
        if (metadataEntries.length === 0) {
            return 0;
        }

        let count = 0;
        const missingIds: string[] = [];

        for (let i = 0; i < metadataEntries.length; i += CONVERSION_BATCH_SIZE) {
            const batch = metadataEntries.slice(i, i + CONVERSION_BATCH_SIZE);
            const converted = await Promise.all(
                batch.map(async metadata => {
                    const blob = await this.getBlobWithoutPromoting(metadata.id);
                    if (!blob) {
                        missingIds.push(metadata.id);
                        return null;
                    }

                    return this.blobAssetToExportAsset({
                        id: metadata.id,
                        blob,
                        mime: metadata.mime || blob.type || 'application/octet-stream',
                        filename: metadata.filename,
                        folderPath: metadata.folderPath,
                    });
                }),
            );

            for (const asset of converted) {
                if (!asset) {
                    continue;
                }
                await callback(asset);
                count++;
            }
        }

        if (missingIds.length > 0) {
            console.warn(
                `[BrowserAssetProvider] Export is missing ${missingIds.length}/${metadataEntries.length} assets (blob not in cache or server): ${missingIds.join(', ')}`,
            );
        }

        return count;
    }

    /**
     * Convert and process assets in batches.
     * Each batch converts blobs in parallel, then invokes callbacks sequentially.
     */
    private async processAssetBatches(
        assets: Array<{
            id: string;
            blob: Blob;
            mime: string;
            filename?: string;
            originalPath?: string;
            folderPath?: string;
        }>,
        callback: (asset: ExportAsset) => Promise<void>,
    ): Promise<number> {
        let count = 0;
        for (let i = 0; i < assets.length; i += CONVERSION_BATCH_SIZE) {
            const batch = assets.slice(i, i + CONVERSION_BATCH_SIZE);
            const converted = await Promise.all(batch.map(a => this.blobAssetToExportAsset(a)));
            for (const asset of converted) {
                await callback(asset);
                count++;
            }
        }
        return count;
    }

    /**
     * Convert a raw blob-bearing asset from AssetManager into an ExportAsset.
     * Shared by getAllAssets() and forEachAsset() to avoid duplicated logic.
     */
    private async blobAssetToExportAsset(asset: {
        id: string;
        blob: Blob;
        mime: string;
        filename?: string;
        originalPath?: string;
        folderPath?: string;
    }): Promise<ExportAsset> {
        const arrayBuffer = await asset.blob.arrayBuffer();
        const assetId = String(asset.id);
        const filename = !isUnknownFilename(asset.filename)
            ? asset.filename!
            : deriveFilenameFromMime(assetId, asset.mime);

        let originalPath: string;
        if (asset.folderPath) {
            originalPath = `${asset.folderPath}/${filename}`;
        } else if (asset.originalPath?.includes(assetId)) {
            originalPath = asset.originalPath;
        } else {
            originalPath = `${assetId}/${filename}`;
        }

        return {
            id: assetId,
            filename,
            originalPath,
            folderPath: asset.folderPath || '',
            mime: asset.mime || 'application/octet-stream',
            data: new Uint8Array(arrayBuffer),
        };
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

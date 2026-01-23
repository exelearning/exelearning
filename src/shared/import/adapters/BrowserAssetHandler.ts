/**
 * BrowserAssetHandler
 *
 * Implements the AssetHandler interface for browser environments.
 * Wraps the browser's AssetManager (IndexedDB-based) to provide
 * a compatible interface for the unified ElpxImporter.
 *
 * This adapter enables the TypeScript ElpxImporter to work in the browser
 * by translating between:
 * - AssetHandler interface (used by ElpxImporter)
 * - AssetManager class (browser IndexedDB implementation)
 */

import type { AssetHandler, AssetMetadata, Logger } from '../interfaces';

/**
 * Browser AssetManager interface (from public/app/yjs/AssetManager.js)
 */
interface BrowserAssetManager {
    /** Initialize the IndexedDB database */
    init(): Promise<void>;
    /** Store a blob with metadata */
    storeBlob(assetId: string, blob: Blob): Promise<string>;
    /** Set asset metadata in Yjs */
    setAssetMetadata(assetId: string, metadata: Record<string, unknown>): void;
    /** Get asset URL from ID and filename */
    getAssetUrl(assetId: string, filename: string): string;
    /** Calculate SHA-256 hash of blob */
    calculateHash(blob: Blob): Promise<string>;
    /** Convert hash to UUID format */
    hashToUUID(hash: string): string;
    /** Get existing asset by hash */
    getAssetByHash(hash: string): Promise<{ id: string; blob: Blob } | null>;
    /** Extract assets from ZIP object */
    extractAssetsFromZip(zip: Record<string, Uint8Array>): Promise<Map<string, string>>;
    /** Convert {{context_path}} references to asset:// URLs */
    convertContextPathToAssetRefs(html: string, assetMap: Map<string, string>): string;
    /** Preload all assets for immediate rendering */
    preloadAllAssets(): Promise<number>;
}

/**
 * Default logger for browser (uses window.Logger if available)
 */
function getBrowserLogger(): Logger {
    if (typeof window !== 'undefined' && (window as unknown as { Logger: Logger }).Logger) {
        return (window as unknown as { Logger: Logger }).Logger;
    }
    return {
        log: (...args: unknown[]) => console.log(...args),
        warn: (...args: unknown[]) => console.warn(...args),
        error: (...args: unknown[]) => console.error(...args),
    };
}

/**
 * Browser asset handler that wraps AssetManager
 */
export class BrowserAssetHandler implements AssetHandler {
    private assetManager: BrowserAssetManager;
    private logger: Logger;
    private initialized: boolean = false;

    /**
     * Create a new BrowserAssetHandler
     * @param assetManager - Browser AssetManager instance
     * @param logger - Logger instance (optional)
     */
    constructor(assetManager: BrowserAssetManager, logger?: Logger) {
        this.assetManager = assetManager;
        this.logger = logger || getBrowserLogger();
    }

    /**
     * Ensure AssetManager is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.assetManager.init();
            this.initialized = true;
        }
    }

    /**
     * Store an asset and return its ID
     * @param id - Asset identifier (UUID)
     * @param data - Asset binary data
     * @param metadata - Asset metadata
     * @returns Asset ID
     */
    async storeAsset(id: string, data: Uint8Array, metadata: AssetMetadata): Promise<string> {
        await this.ensureInitialized();

        // Convert Uint8Array to Blob
        const blob = new Blob([data], { type: metadata.mimeType });

        // Store blob in IndexedDB
        await this.assetManager.storeBlob(id, blob);

        // Store metadata in Yjs
        this.assetManager.setAssetMetadata(id, {
            filename: metadata.filename,
            folderPath: metadata.folderPath || '',
            mime: metadata.mimeType,
            size: data.length,
            hash: '', // Hash calculated elsewhere if needed
            uploaded: false,
            createdAt: new Date().toISOString(),
        });

        this.logger.log(`[BrowserAssetHandler] Stored asset ${id}: ${metadata.filename}`);
        return id;
    }

    /**
     * Extract all assets from a ZIP object
     * Delegates to AssetManager's existing implementation
     * @param zip - Extracted ZIP files object from fflate {path: Uint8Array}
     * @returns Map of original path to asset ID
     */
    async extractAssetsFromZip(zip: Record<string, Uint8Array>): Promise<Map<string, string>> {
        await this.ensureInitialized();
        return this.assetManager.extractAssetsFromZip(zip);
    }

    /**
     * Convert {{context_path}} references to asset:// URLs
     * Delegates to AssetManager's existing implementation
     * @param html - HTML content with {{context_path}} references
     * @param assetMap - Map of original paths to asset IDs
     * @returns HTML with asset:// URLs
     */
    convertContextPathToAssetRefs(html: string, assetMap: Map<string, string>): string {
        return this.assetManager.convertContextPathToAssetRefs(html, assetMap);
    }

    /**
     * Preload all assets for immediate rendering
     * Delegates to AssetManager's existing implementation
     */
    async preloadAllAssets(): Promise<void> {
        await this.ensureInitialized();
        await this.assetManager.preloadAllAssets();
    }

    /**
     * Clear all stored assets (optional)
     * Not implemented - AssetManager handles this differently
     */
    async clear(): Promise<void> {
        // Not implemented - asset cleanup is handled by AssetManager at a higher level
        this.logger.log('[BrowserAssetHandler] clear() called but not implemented');
    }
}

/**
 * Create a BrowserAssetHandler from window.AssetManager
 * Convenience factory for use in browser entry point
 */
export function createBrowserAssetHandler(assetManager: unknown): BrowserAssetHandler | null {
    if (!assetManager) {
        return null;
    }
    return new BrowserAssetHandler(assetManager as BrowserAssetManager);
}

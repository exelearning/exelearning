/**
 * DatabaseAssetProvider
 *
 * Backend provider that loads assets from the database and server storage.
 * Used for API/CLI exports where IndexedDB is not available.
 *
 * This provider reads assets that were uploaded via the web UI and stored
 * in the server's file system with metadata in the database.
 *
 * Usage:
 * ```typescript
 * const provider = new DatabaseAssetProvider(db, projectId, sessionPath);
 * const asset = await provider.getAsset('abc123-uuid/image.png');
 * const allAssets = await provider.getAllAssets();
 * ```
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { Kysely } from 'kysely';
import type { Database, Asset } from '../../../db/types';
import type { AssetProvider, ExportAsset } from '../interfaces';
import { EXTENSION_TO_MIME } from '../constants';
import {
    findAssetByClientId as findAssetByClientIdDefault,
    findAllAssetsForProject as findAllAssetsForProjectDefault,
} from '../../../db/queries/assets';

/**
 * Query functions interface for dependency injection
 */
export interface DatabaseAssetProviderQueries {
    findAssetByClientId: (db: Kysely<Database>, clientId: string, projectId?: number) => Promise<Asset | undefined>;
    findAllAssetsForProject: (db: Kysely<Database>, projectId: number) => Promise<Asset[]>;
}

/**
 * Default query implementations
 */
const defaultQueries: DatabaseAssetProviderQueries = {
    findAssetByClientId: findAssetByClientIdDefault,
    findAllAssetsForProject: findAllAssetsForProjectDefault,
};

/**
 * DatabaseAssetProvider class
 * Implements AssetProvider for API/CLI exports using server-stored assets
 */
export class DatabaseAssetProvider implements AssetProvider {
    private db: Kysely<Database>;
    private projectId: number;
    private sessionPath?: string;
    private assetCache: Map<string, ExportAsset>;
    private queries: DatabaseAssetProviderQueries;

    /**
     * @param db - Kysely database instance
     * @param projectId - Project ID in the database
     * @param sessionPath - Optional session temp directory path for session-specific assets
     * @param queries - Optional query implementations for dependency injection (testing)
     */
    constructor(
        db: Kysely<Database>,
        projectId: number,
        sessionPath?: string,
        queries?: Partial<DatabaseAssetProviderQueries>,
    ) {
        this.db = db;
        this.projectId = projectId;
        this.sessionPath = sessionPath;
        this.assetCache = new Map();
        this.queries = { ...defaultQueries, ...queries };
    }

    /**
     * Get a single asset by path or ID
     * @param assetPath - Asset path in format 'uuid/filename' or just 'uuid'
     * @returns Export asset or null if not found
     */
    async getAsset(assetPath: string): Promise<ExportAsset | null> {
        // Normalize path - remove leading slash and content/resources prefix
        let normalizedPath = assetPath.replace(/^\//, '');
        normalizedPath = normalizedPath.replace(/^content\/resources\//, '');

        // Check cache first
        if (this.assetCache.has(normalizedPath)) {
            return this.assetCache.get(normalizedPath)!;
        }

        // Extract UUID from path (format: uuid/filename or just uuid)
        const parts = normalizedPath.split('/');
        const clientId = parts[0];

        // Try to find in database
        const dbAsset = await this.queries.findAssetByClientId(this.db, clientId, this.projectId);

        if (dbAsset?.storage_path) {
            // Read from storage_path
            if (await fs.pathExists(dbAsset.storage_path)) {
                const content = await fs.readFile(dbAsset.storage_path);
                const asset: ExportAsset = {
                    id: dbAsset.client_id || normalizedPath,
                    filename: dbAsset.filename,
                    originalPath: normalizedPath,
                    mime: dbAsset.mime_type || 'application/octet-stream',
                    data: content,
                };
                this.assetCache.set(normalizedPath, asset);
                return asset;
            }
        }

        // Try session path assets directory
        if (this.sessionPath) {
            const asset = await this.findAssetInSessionPath(normalizedPath, clientId);
            if (asset) {
                this.assetCache.set(normalizedPath, asset);
                return asset;
            }
        }

        return null;
    }

    /**
     * Search for asset in session path directories
     */
    private async findAssetInSessionPath(normalizedPath: string, clientId: string): Promise<ExportAsset | null> {
        if (!this.sessionPath) return null;

        // Try common asset locations
        const searchPaths = [
            path.join(this.sessionPath, 'assets', clientId),
            path.join(this.sessionPath, 'assets', normalizedPath),
            path.join(this.sessionPath, 'resources', normalizedPath),
            path.join(this.sessionPath, normalizedPath),
        ];

        for (const searchPath of searchPaths) {
            // Check if it's a directory (clientId folder)
            if (await fs.pathExists(searchPath)) {
                const stat = await fs.stat(searchPath);

                if (stat.isDirectory()) {
                    // Find first file in the directory
                    const files = await fs.readdir(searchPath);
                    if (files.length > 0) {
                        const filePath = path.join(searchPath, files[0]);
                        const fileStat = await fs.stat(filePath);
                        if (fileStat.isFile()) {
                            const content = await fs.readFile(filePath);
                            const ext = path.extname(files[0]).toLowerCase();
                            return {
                                id: clientId,
                                filename: files[0],
                                originalPath: normalizedPath,
                                mime: EXTENSION_TO_MIME[ext] || 'application/octet-stream',
                                data: content,
                            };
                        }
                    }
                } else if (stat.isFile()) {
                    const content = await fs.readFile(searchPath);
                    const ext = path.extname(searchPath).toLowerCase();
                    const filename = path.basename(searchPath);
                    return {
                        id: clientId,
                        filename: filename,
                        originalPath: normalizedPath,
                        mime: EXTENSION_TO_MIME[ext] || 'application/octet-stream',
                        data: content,
                    };
                }
            }
        }

        return null;
    }

    /**
     * Get all assets from the project (implements AssetProvider interface)
     * @returns Array of all export assets
     */
    async getProjectAssets(): Promise<ExportAsset[]> {
        return this.getAllAssets();
    }

    /**
     * Get all assets from the database for this project
     * @returns Array of all export assets
     */
    async getAllAssets(): Promise<ExportAsset[]> {
        const assets: ExportAsset[] = [];

        // Get all assets from database
        const dbAssets = await this.queries.findAllAssetsForProject(this.db, this.projectId);

        for (const dbAsset of dbAssets) {
            if (dbAsset.storage_path && (await fs.pathExists(dbAsset.storage_path))) {
                try {
                    const content = await fs.readFile(dbAsset.storage_path);
                    const folderPath = dbAsset.folder_path || '';
                    // Build originalPath based on folderPath
                    const exportPath = folderPath ? `${folderPath}/${dbAsset.filename}` : dbAsset.filename;
                    const asset: ExportAsset = {
                        id: dbAsset.client_id || String(dbAsset.id),
                        filename: dbAsset.filename,
                        originalPath: exportPath,
                        folderPath: folderPath,
                        mime: dbAsset.mime_type || 'application/octet-stream',
                        data: content,
                    };
                    assets.push(asset);
                    this.assetCache.set(asset.originalPath, asset);
                } catch (error) {
                    // Skip assets that can't be read
                    console.warn(`[DatabaseAssetProvider] Could not read asset ${dbAsset.id}: ${error}`);
                }
            }
        }

        // Also scan session path if available
        if (this.sessionPath) {
            await this.collectSessionAssets(assets);
        }

        return assets;
    }

    /**
     * Collect assets from session path directories
     */
    private async collectSessionAssets(assets: ExportAsset[]): Promise<void> {
        if (!this.sessionPath) return;

        const assetsDir = path.join(this.sessionPath, 'assets');
        if (!(await fs.pathExists(assetsDir))) return;

        try {
            const entries = await fs.readdir(assetsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Asset stored in uuid/filename format
                    const assetDir = path.join(assetsDir, entry.name);
                    const files = await fs.readdir(assetDir);

                    for (const file of files) {
                        const filePath = path.join(assetDir, file);
                        const stat = await fs.stat(filePath);

                        if (stat.isFile()) {
                            const originalPath = `${entry.name}/${file}`;
                            // Check if already in cache (from database or previous call)
                            if (this.assetCache.has(originalPath)) {
                                // Still add to result from cache
                                assets.push(this.assetCache.get(originalPath)!);
                            } else {
                                const content = await fs.readFile(filePath);
                                const ext = path.extname(file).toLowerCase();
                                const asset: ExportAsset = {
                                    id: entry.name,
                                    filename: file,
                                    originalPath: originalPath,
                                    mime: EXTENSION_TO_MIME[ext] || 'application/octet-stream',
                                    data: content,
                                };
                                assets.push(asset);
                                this.assetCache.set(originalPath, asset);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(`[DatabaseAssetProvider] Error scanning session assets: ${error}`);
        }
    }

    /**
     * Process assets one at a time via callback.
     * Reads each file from disk sequentially.
     *
     * @returns Number of assets processed
     */
    async forEachAsset(callback: (asset: ExportAsset) => Promise<void>): Promise<number> {
        let count = 0;

        // Database assets
        const dbAssets = await this.queries.findAllAssetsForProject(this.db, this.projectId);
        for (const dbAsset of dbAssets) {
            if (dbAsset.storage_path && (await fs.pathExists(dbAsset.storage_path))) {
                try {
                    const content = await fs.readFile(dbAsset.storage_path);
                    const folderPath = dbAsset.folder_path || '';
                    const exportPath = folderPath ? `${folderPath}/${dbAsset.filename}` : dbAsset.filename;
                    await callback({
                        id: dbAsset.client_id || String(dbAsset.id),
                        filename: dbAsset.filename,
                        originalPath: exportPath,
                        folderPath,
                        mime: dbAsset.mime_type || 'application/octet-stream',
                        data: content,
                    });
                    count++;
                } catch (error) {
                    console.warn(`[DatabaseAssetProvider] Could not read asset ${dbAsset.id}: ${error}`);
                }
            }
        }

        // Session path assets
        if (this.sessionPath) {
            const assetsDir = path.join(this.sessionPath, 'assets');
            if (await fs.pathExists(assetsDir)) {
                try {
                    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
                    for (const entry of entries) {
                        if (entry.isDirectory()) {
                            const assetDir = path.join(assetsDir, entry.name);
                            const files = await fs.readdir(assetDir);
                            for (const file of files) {
                                const filePath = path.join(assetDir, file);
                                const stat = await fs.stat(filePath);
                                if (stat.isFile()) {
                                    const content = await fs.readFile(filePath);
                                    const ext = path.extname(file).toLowerCase();
                                    await callback({
                                        id: entry.name,
                                        filename: file,
                                        originalPath: `${entry.name}/${file}`,
                                        mime: EXTENSION_TO_MIME[ext] || 'application/octet-stream',
                                        data: content,
                                    });
                                    count++;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`[DatabaseAssetProvider] Error in forEachAsset session scan: ${error}`);
                }
            }
        }

        return count;
    }

    /**
     * List asset metadata without loading binary data.
     * Verifies each DB asset's storage_path exists on disk to filter out orphaned records.
     */
    async listAssetMetadata(): Promise<Array<{ id: string; filename: string; folderPath?: string; mime: string }>> {
        const result: Array<{ id: string; filename: string; folderPath?: string; mime: string }> = [];

        const dbAssets = await this.queries.findAllAssetsForProject(this.db, this.projectId);
        for (const dbAsset of dbAssets) {
            if (dbAsset.storage_path && (await fs.pathExists(dbAsset.storage_path))) {
                result.push({
                    id: dbAsset.client_id || String(dbAsset.id),
                    filename: dbAsset.filename,
                    folderPath: dbAsset.folder_path || '',
                    mime: dbAsset.mime_type || 'application/octet-stream',
                });
            }
        }

        // Also scan session path if available
        if (this.sessionPath) {
            const assetsDir = path.join(this.sessionPath, 'assets');
            if (await fs.pathExists(assetsDir)) {
                try {
                    const entries = await fs.readdir(assetsDir, { withFileTypes: true });
                    const seenIds = new Set(result.map(r => r.id));

                    for (const entry of entries) {
                        if (entry.isDirectory() && !seenIds.has(entry.name)) {
                            const assetDir = path.join(assetsDir, entry.name);
                            const files = await fs.readdir(assetDir);
                            for (const file of files) {
                                const filePath = path.join(assetDir, file);
                                const stat = await fs.stat(filePath);
                                if (stat.isFile()) {
                                    const ext = path.extname(file).toLowerCase();
                                    result.push({
                                        id: entry.name,
                                        filename: file,
                                        mime: EXTENSION_TO_MIME[ext] || 'application/octet-stream',
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`[DatabaseAssetProvider] Error scanning session assets metadata: ${error}`);
                }
            }
        }

        return result;
    }

    /**
     * Check if an asset exists
     * @param assetPath - Asset path
     * @returns True if asset exists
     */
    async exists(assetPath: string): Promise<boolean> {
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
     * Get asset MIME type
     * @param assetPath - Asset path
     * @returns MIME type string
     */
    getMimeType(assetPath: string): string {
        const ext = path.extname(assetPath).toLowerCase();
        return EXTENSION_TO_MIME[ext] || 'application/octet-stream';
    }

    /**
     * Clear the asset cache
     */
    clearCache(): void {
        this.assetCache.clear();
    }
}

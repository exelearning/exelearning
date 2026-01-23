/**
 * FileSystemAssetProvider
 *
 * Backend provider that loads assets (images, media, documents) from an extracted ELP file.
 * Used by CLI commands to access user content from the extracted project directory.
 *
 * FolderPath Extraction:
 * - For assets in content/resources/{folder}/{filename}, extracts folderPath from the path
 * - This determines where the asset is placed in the export (content/resources/{folderPath}/{filename})
 * - The content.xml references assets as {{context_path}}/{folderPath}/{filename}
 *
 * Usage:
 * ```typescript
 * const provider = new FileSystemAssetProvider('/tmp/session123/project');
 * const asset = await provider.getAsset('resources/images/photo.jpg');
 * const allAssets = await provider.getAllAssets();
 * ```
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type { AssetProvider, ExportAsset } from '../interfaces';
import { MIME_TO_EXTENSION } from '../constants';

/**
 * Reverse lookup: extension to MIME type
 */
const EXTENSION_TO_MIME: Record<string, string> = {};
for (const [mime, ext] of Object.entries(MIME_TO_EXTENSION)) {
    EXTENSION_TO_MIME[ext] = mime;
}

// Add common extensions
Object.assign(EXTENSION_TO_MIME, {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.zip': 'application/zip',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
});

/**
 * FileSystemAssetProvider class
 * Implements AssetProvider for backend/CLI usage
 */
export class FileSystemAssetProvider implements AssetProvider {
    private basePath: string;
    private assetCache: Map<string, ExportAsset>;

    /**
     * @param basePath - Path to extracted ELP directory (e.g., /tmp/session123/project)
     */
    constructor(basePath: string) {
        this.basePath = basePath;
        this.assetCache = new Map();
    }

    /**
     * Get a single asset by path or ID
     * @param assetPath - Relative path to asset (e.g., 'resources/images/photo.jpg') or asset ID
     * @returns Export asset or null if not found
     */
    async getAsset(assetPath: string): Promise<ExportAsset | null> {
        // Normalize path
        const normalizedPath = assetPath.replace(/^\//, '');

        // Check cache first
        if (this.assetCache.has(normalizedPath)) {
            return this.assetCache.get(normalizedPath)!;
        }

        const fullPath = path.join(this.basePath, normalizedPath);

        if (!(await fs.pathExists(fullPath))) {
            return null;
        }

        const stat = await fs.stat(fullPath);
        if (!stat.isFile()) {
            return null;
        }

        const content = await fs.readFile(fullPath);
        const ext = path.extname(normalizedPath).toLowerCase();
        const mimeType = EXTENSION_TO_MIME[ext] || 'application/octet-stream';
        const filename = path.basename(normalizedPath);

        // Extract folderPath from content/resources/{folder}/{filename} structure
        // This determines where the asset is placed in the export
        const folderPath = this.extractFolderPath(normalizedPath);

        // Use folderPath/filename as unique ID (handles multiple files in same folder)
        // If no folderPath, just use filename
        const assetId = folderPath ? `${folderPath}/${filename}` : filename;

        // Create asset conforming to ExportAsset interface
        const asset: ExportAsset = {
            id: assetId,
            filename: filename,
            originalPath: normalizedPath,
            folderPath,
            mime: mimeType,
            data: content,
        };

        this.assetCache.set(normalizedPath, asset);
        return asset;
    }

    /**
     * Extract folderPath from asset path
     * For content/resources/... paths, extracts the folder structure between content/resources/ and the filename
     *
     * Examples:
     * - content/resources/file.jpg → '' (root)
     * - content/resources/folder/file.jpg → 'folder'
     * - content/resources/a/b/c/file.jpg → 'a/b/c'
     * - content/resources/20251009090601DKVACR/file.jpg → '20251009090601DKVACR'
     * - resources/images/photo.jpg → 'resources/images' (backward compat)
     */
    private extractFolderPath(relativePath: string): string {
        // Handle content/resources/ prefix - extract folder relative to content/resources/
        if (relativePath.startsWith('content/resources/')) {
            const withoutPrefix = relativePath.slice('content/resources/'.length);
            const folderPath = path.dirname(withoutPrefix);
            return folderPath === '.' ? '' : folderPath;
        }

        // Handle content/img/ (for exe_powered_logo.png and similar)
        if (relativePath.startsWith('content/img/')) {
            const withoutPrefix = relativePath.slice('content/'.length);
            const folderPath = path.dirname(withoutPrefix);
            return folderPath === '.' ? '' : folderPath;
        }

        // For other paths (e.g., resources/images/photo.jpg), use full directory path
        // This maintains backward compatibility where id = originalPath
        const folderPath = path.dirname(relativePath);
        return folderPath === '.' ? '' : folderPath;
    }

    /**
     * Get all assets from the project (implements AssetProvider interface)
     * @returns Array of all export assets
     */
    async getProjectAssets(): Promise<ExportAsset[]> {
        return this.getAllAssets();
    }

    /**
     * Get all assets from the project
     * @returns Array of all export assets
     */
    async getAllAssets(): Promise<ExportAsset[]> {
        const assets: ExportAsset[] = [];

        // User assets are stored in content/resources/ (v3.0 format)
        // Other directories like content/css/, content/img/ are system files, not user assets
        const contentResourcesPath = path.join(this.basePath, 'content', 'resources');
        if (await fs.pathExists(contentResourcesPath)) {
            await this.collectAssetsFromDirectory(contentResourcesPath, 'content/resources', assets);
        }

        // Legacy asset directories (v2.x format)
        const legacyAssetDirs = ['resources', 'images', 'media', 'files'];
        for (const dir of legacyAssetDirs) {
            const dirPath = path.join(this.basePath, dir);
            if (await fs.pathExists(dirPath)) {
                await this.collectAssetsFromDirectory(dirPath, dir, assets);
            }
        }

        // Also scan root directory for legacy ELP format (assets at root level)
        await this.collectRootAssets(assets);

        return assets;
    }

    /**
     * Collect asset files from the root directory (for legacy ELP format)
     * Only collects known asset file types to avoid including XML, etc.
     */
    private async collectRootAssets(assets: ExportAsset[]): Promise<void> {
        const entries = await fs.readdir(this.basePath, { withFileTypes: true });
        const assetExtensions = new Set([
            '.jpg',
            '.jpeg',
            '.png',
            '.gif',
            '.webp',
            '.svg',
            '.bmp',
            '.ico',
            '.mp3',
            '.wav',
            '.ogg',
            '.aac',
            '.flac',
            '.m4a',
            '.mp4',
            '.webm',
            '.ogv',
            '.avi',
            '.mov',
            '.pdf',
            '.doc',
            '.docx',
            '.xls',
            '.xlsx',
            '.ppt',
            '.pptx',
            '.zip',
            '.rar',
            '.7z',
        ]);

        for (const entry of entries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (assetExtensions.has(ext)) {
                    const asset = await this.getAsset(entry.name);
                    if (asset) {
                        // Mark as root-level asset for proper path handling
                        assets.push(asset);
                    }
                }
            }
        }
    }

    /**
     * Get assets from a specific directory
     * @param directory - Directory path (relative or absolute)
     * @returns Array of export assets in that directory
     */
    async getAssetsFromDirectory(directory: string): Promise<ExportAsset[]> {
        const assets: ExportAsset[] = [];
        const dirPath = path.isAbsolute(directory) ? directory : path.join(this.basePath, directory);

        if (await fs.pathExists(dirPath)) {
            const relativePath = path.isAbsolute(directory) ? path.relative(this.basePath, directory) : directory;
            await this.collectAssetsFromDirectory(dirPath, relativePath, assets);
        }

        return assets;
    }

    /**
     * Recursively collect assets from a directory
     * @param dirPath - Absolute directory path
     * @param relativePath - Relative path for output
     * @param assets - Array to populate
     */
    private async collectAssetsFromDirectory(
        dirPath: string,
        relativePath: string,
        assets: ExportAsset[],
    ): Promise<void> {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const entryRelativePath = `${relativePath}/${entry.name}`;

            if (entry.isDirectory()) {
                await this.collectAssetsFromDirectory(fullPath, entryRelativePath, assets);
            } else if (entry.isFile()) {
                const asset = await this.getAsset(entryRelativePath);
                if (asset) {
                    assets.push(asset);
                }
            }
        }
    }

    /**
     * Check if an asset exists
     * @param assetPath - Relative path to asset
     * @returns True if asset exists
     */
    async exists(assetPath: string): Promise<boolean> {
        const normalizedPath = assetPath.replace(/^\//, '');
        const fullPath = path.join(this.basePath, normalizedPath);
        return fs.pathExists(fullPath);
    }

    /**
     * Get asset content as Buffer
     * @param assetPath - Relative path to asset
     * @returns Buffer content or null
     */
    async getContent(assetPath: string): Promise<Buffer | null> {
        const asset = await this.getAsset(assetPath);
        if (!asset) return null;
        // Handle both Buffer and Uint8Array
        if (Buffer.isBuffer(asset.data)) {
            return asset.data;
        }
        return Buffer.from(asset.data as Uint8Array);
    }

    /**
     * Get asset MIME type
     * @param assetPath - Relative path to asset
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

    /**
     * Get base path
     * @returns The base path for assets
     */
    getBasePath(): string {
        return this.basePath;
    }
}

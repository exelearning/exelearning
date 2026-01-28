/**
 * FileSystemAssetHandler
 *
 * Server-side implementation of AssetHandler that stores assets to the filesystem.
 * Used by CLI commands to extract assets during ELP import.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import type { AssetHandler, AssetMetadata, AssetProgressCallback } from './interfaces';

/**
 * Directories within an ELP that contain project assets
 * Can be top-level (resources/, images/) or nested (content/resources/)
 */
const ASSET_DIRECTORIES = ['resources', 'images', 'media', 'files', 'attachments'];

/**
 * Theme directory in ELP/ELPX files
 */
const THEME_DIRECTORY = 'theme';

/**
 * Media file extensions that should be treated as assets
 * Used to detect root-level assets in legacy ELP files
 */
const MEDIA_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.svg',
    '.webp',
    '.ico',
    '.bmp',
    '.mp3',
    '.wav',
    '.ogg',
    '.mp4',
    '.webm',
    '.ogv',
    '.avi',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.zip',
    '.swf',
    '.flv',
];

/**
 * System files that should not be treated as assets even if at root level
 */
const SYSTEM_FILES = ['content.xml', 'contentv3.xml', 'content.data', 'content.xsd', 'imsmanifest.xml'];

/**
 * Check if a path contains an asset directory
 * Supports both top-level (resources/file.jpg), nested (content/resources/id/file.jpg),
 * and root-level media files (legacy ELP format)
 */
function isAssetPath(zipPath: string): {
    isAsset: boolean;
    assetDir: string;
    relativePath: string;
    isRootLevel: boolean;
} {
    const pathParts = zipPath.split('/');

    // Skip directories
    if (zipPath.endsWith('/')) {
        return { isAsset: false, assetDir: '', relativePath: '', isRootLevel: false };
    }

    // Check for nested asset paths like content/resources/
    if (pathParts[0] === 'content' && pathParts.length > 2) {
        const contentSubdir = pathParts[1].toLowerCase();
        if (ASSET_DIRECTORIES.includes(contentSubdir)) {
            // Keep full path after 'content/' (e.g., resources/id/file.jpg)
            return {
                isAsset: true,
                assetDir: 'content',
                relativePath: pathParts.slice(1).join('/'),
                isRootLevel: false,
            };
        }
    }

    // Check for top-level asset directories
    if (pathParts.length > 1) {
        const topLevel = pathParts[0].toLowerCase();
        if (ASSET_DIRECTORIES.includes(topLevel)) {
            return {
                isAsset: true,
                assetDir: pathParts[0],
                relativePath: pathParts.join('/'),
                isRootLevel: false,
            };
        }
    }

    // Check for root-level media files (legacy ELP format)
    // These are files stored at the root but referenced as resources/filename in the XML
    if (pathParts.length === 1) {
        const filename = pathParts[0].toLowerCase();

        // Skip system files
        if (SYSTEM_FILES.includes(filename)) {
            return { isAsset: false, assetDir: '', relativePath: '', isRootLevel: false };
        }

        // Check if it's a media file by extension
        const ext = path.extname(filename);
        if (MEDIA_EXTENSIONS.includes(ext)) {
            // Store with just the filename - folder will be 'resources' from assetDir
            return {
                isAsset: true,
                assetDir: 'resources',
                relativePath: pathParts[0], // Just the filename, not resources/filename
                isRootLevel: true,
            };
        }
    }

    return { isAsset: false, assetDir: '', relativePath: '', isRootLevel: false };
}

/**
 * Get MIME type from filename extension
 */
function getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.bmp': 'image/bmp',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.ogv': 'video/ogg',
        '.avi': 'video/x-msvideo',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.ttf': 'font/ttf',
        '.otf': 'font/otf',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.eot': 'application/vnd.ms-fontobject',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * FileSystemAssetHandler class
 * Stores assets to the filesystem with UUID-based naming
 */
export class FileSystemAssetHandler implements AssetHandler {
    private extractPath: string;
    private assetIdMap: Map<string, string> = new Map();

    /**
     * Create a new FileSystemAssetHandler
     * @param extractPath - Base directory for asset storage
     */
    constructor(extractPath: string) {
        this.extractPath = extractPath;
    }

    /**
     * Store an asset to the filesystem
     * @param id - Asset identifier (UUID)
     * @param data - Asset binary data
     * @param metadata - Asset metadata
     * @returns Asset ID
     */
    async storeAsset(id: string, data: Uint8Array, metadata: AssetMetadata): Promise<string> {
        // Determine the full directory path including any subfolders
        let assetDir: string;
        if (metadata.folderPath) {
            assetDir = path.join(this.extractPath, metadata.folderPath);
        } else {
            assetDir = path.join(this.extractPath, 'resources');
        }

        if (!existsSync(assetDir)) {
            mkdirSync(assetDir, { recursive: true });
        }

        // Store the file with its original filename (preserving extension)
        const filename = metadata.filename;
        const filePath = path.join(assetDir, filename);

        // Handle duplicate filenames by appending a number
        let finalPath = filePath;
        let counter = 1;
        const ext = path.extname(filename);
        const basename = path.basename(filename, ext);

        while (existsSync(finalPath)) {
            finalPath = path.join(assetDir, `${basename}_${counter}${ext}`);
            counter++;
        }

        await fs.writeFile(finalPath, Buffer.from(data));

        // Store mapping for later reference
        this.assetIdMap.set(id, finalPath);

        return id;
    }

    /**
     * Extract all assets from a ZIP object
     * Preserves the directory structure from the ELP/ELPX file (e.g., content/resources/id/file.jpg)
     * Also handles legacy ELP files where assets are at root level but referenced as resources/filename
     *
     * IMPORTANT: Uses filename-based IDs (not UUIDs) to match what FileSystemAssetProvider expects.
     * This ensures the export can find assets by the ID used in HTML content.
     *
     * @param zip - Extracted ZIP files object from fflate {path: Uint8Array}
     * @param onAssetProgress - Optional callback for reporting extraction progress
     * @returns Map of original path to asset ID
     */
    async extractAssetsFromZip(
        zip: Record<string, Uint8Array>,
        onAssetProgress?: AssetProgressCallback,
    ): Promise<Map<string, string>> {
        const assetMap = new Map<string, string>();

        // Filter to only asset entries first for accurate progress reporting
        const assetEntries: [string, Uint8Array][] = [];
        for (const [zipPath, content] of Object.entries(zip)) {
            const assetInfo = isAssetPath(zipPath);
            if (assetInfo.isAsset) {
                assetEntries.push([zipPath, content]);
            }
        }

        const totalAssets = assetEntries.length;
        let currentAsset = 0;

        for (const [zipPath, content] of assetEntries) {
            currentAsset++;

            const filename = path.basename(zipPath);

            // Report progress if callback provided
            if (onAssetProgress) {
                onAssetProgress(currentAsset, totalAssets, filename);
            }

            // Get asset info (already filtered, but need the paths)
            const assetInfo = isAssetPath(zipPath);
            const mimeType = getMimeType(filename);

            // Determine the folder path (directory structure to preserve)
            // e.g., for content/resources/20251009090601DKVACR/01.jpg -> content/resources/20251009090601DKVACR
            const folderPath = path.dirname(assetInfo.relativePath);
            const fullFolderPath = assetInfo.assetDir === 'content' ? path.join('content', folderPath) : folderPath;

            // Use filename-based ID (not UUID) to match FileSystemAssetProvider expectations
            // For root-level assets, id is just the filename
            // For nested assets, id includes the folder path
            const assetId =
                fullFolderPath && fullFolderPath !== '.'
                    ? `${fullFolderPath.replace(/^(content\/)?/, '')}/${filename}`
                    : filename;

            // Store the asset with the full folder structure
            await this.storeAsset(assetId, content, {
                filename,
                mimeType,
                folderPath: fullFolderPath,
                originalPath: zipPath,
            });

            // Map original path to asset ID
            assetMap.set(zipPath, assetId);

            // Also map the filename alone for simpler lookups
            if (!assetMap.has(filename)) {
                assetMap.set(filename, assetId);
            }

            // For root-level legacy assets, also map the resources/filename path
            // since legacy XML content references images as src="resources/filename.png"
            if (assetInfo.isRootLevel) {
                const resourcesPath = `resources/${filename}`;
                if (!assetMap.has(resourcesPath)) {
                    assetMap.set(resourcesPath, assetId);
                }
            }
        }

        return assetMap;
    }

    /**
     * Convert {{context_path}} references and direct resource paths to asset:// URLs
     * This creates URLs that the export system can resolve back to file paths
     * The export system expects asset://UUID format (just UUID, no filename)
     * Handles both:
     * - Modern format: {{context_path}}/resources/image.png
     * - Legacy format: src="resources/image.png" (direct paths in HTML attributes)
     * @param html - HTML content with asset references
     * @param assetMap - Map of original paths to asset IDs
     * @returns HTML with asset:// URLs
     */
    convertContextPathToAssetRefs(html: string, assetMap: Map<string, string>): string {
        if (!html || typeof html !== 'string') return html;
        if (assetMap.size === 0) return html;

        let result = html;

        for (const [originalPath, assetId] of assetMap.entries()) {
            const filename = path.basename(originalPath);

            // Replace {{context_path}}/path patterns (modern format)
            // Use just asset://UUID - the export system will resolve the full path
            result = result.split(`{{context_path}}/${originalPath}`).join(`asset://${assetId}`);
            result = result.split(`{{context_path}}/resources/${filename}`).join(`asset://${assetId}`);

            // Replace direct resource paths in HTML attributes (legacy format)
            // Match src="resources/filename", href="resources/filename", url("resources/filename")
            // Avoid replacing if already converted to asset://
            if (originalPath.startsWith('resources/') || originalPath === filename) {
                const resourcePath = originalPath.startsWith('resources/') ? originalPath : `resources/${filename}`;

                // Replace in quoted attribute values - use just UUID
                result = result.split(`"${resourcePath}"`).join(`"asset://${assetId}"`);
                result = result.split(`'${resourcePath}'`).join(`'asset://${assetId}'`);

                // Also handle without quotes in some cases
                result = result.split(`src="${resourcePath}"`).join(`src="asset://${assetId}"`);
                result = result.split(`href="${resourcePath}"`).join(`href="asset://${assetId}"`);
            }
        }

        return result;
    }

    /**
     * Get the extraction path
     */
    getExtractPath(): string {
        return this.extractPath;
    }

    /**
     * Preload all assets (no-op for filesystem - assets are already on disk)
     */
    async preloadAllAssets(): Promise<void> {
        // No-op for filesystem implementation
    }

    /**
     * Clear all stored assets
     */
    async clear(): Promise<void> {
        // Clean up both possible asset directories
        const resourcesDir = path.join(this.extractPath, 'resources');
        const contentResourcesDir = path.join(this.extractPath, 'content', 'resources');
        const themeDir = path.join(this.extractPath, 'theme');

        if (existsSync(resourcesDir)) {
            await fs.rm(resourcesDir, { recursive: true, force: true });
        }
        if (existsSync(contentResourcesDir)) {
            await fs.rm(contentResourcesDir, { recursive: true, force: true });
        }
        if (existsSync(themeDir)) {
            await fs.rm(themeDir, { recursive: true, force: true });
        }
        this.assetIdMap.clear();
    }

    /**
     * Extract theme files from a ZIP object
     * Theme files are stored in the `theme/` directory in ELP/ELPX files.
     * This extracts them to the same `theme/` directory in the extraction path
     * so they can be used during export.
     *
     * @param zip - Extracted ZIP files object from fflate {path: Uint8Array}
     * @returns Theme info including name and whether it's downloadable
     */
    async extractThemeFromZip(zip: Record<string, Uint8Array>): Promise<{
        themeName: string | null;
        themeDir: string | null;
        downloadable: boolean;
    }> {
        const themeDir = path.join(this.extractPath, THEME_DIRECTORY);
        let themeName: string | null = null;
        let downloadable = false;
        let hasThemeFiles = false;

        for (const [zipPath, content] of Object.entries(zip)) {
            // Check if this is a theme file
            if (!zipPath.startsWith(`${THEME_DIRECTORY}/`) || zipPath.endsWith('/')) {
                continue;
            }

            hasThemeFiles = true;

            // Get relative path within theme directory
            const relativePath = zipPath.substring(THEME_DIRECTORY.length + 1);
            const fullPath = path.join(themeDir, relativePath);

            // Create directory if needed
            const fileDir = path.dirname(fullPath);
            if (!existsSync(fileDir)) {
                mkdirSync(fileDir, { recursive: true });
            }

            // Write the file
            await fs.writeFile(fullPath, Buffer.from(content));

            // Parse config.xml to get theme info
            if (relativePath === 'config.xml') {
                try {
                    const configXml = new TextDecoder().decode(content);

                    // Extract theme name
                    const nameMatch = configXml.match(/<name>([^<]+)<\/name>/);
                    if (nameMatch) {
                        themeName = nameMatch[1].trim();
                    }

                    // Extract downloadable flag
                    const downloadableMatch = configXml.match(/<downloadable>(\d)<\/downloadable>/);
                    if (downloadableMatch) {
                        downloadable = downloadableMatch[1] === '1';
                    }
                } catch {
                    // Ignore config parsing errors, use defaults
                }
            }
        }

        return {
            themeName,
            themeDir: hasThemeFiles ? themeDir : null,
            downloadable,
        };
    }
}

/**
 * Folder Manager Service
 * Handles folder operations for the file manager
 *
 * Uses Dependency Injection pattern for testability
 */
import type { Kysely } from 'kysely';
import type { Database, Asset, NewAsset } from '../db/types';
import * as assetQueries from '../db/queries/assets';
import { db as defaultDb } from '../db/client';
import * as fflateModule from 'fflate';
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';
import * as cryptoModule from 'crypto';
import { getProjectAssetsDir as defaultGetProjectAssetsDir } from './file-helper';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Dependencies that can be injected for testing
 */
export interface FolderManagerDeps {
    db?: Kysely<Database>;
    queries?: typeof assetQueries;
    fflate?: typeof fflateModule;
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    crypto?: typeof cryptoModule;
    getProjectAssetsDir?: (projectUuid: string) => string;
}

/**
 * Result of listing a folder's contents
 */
export interface FolderContents {
    currentPath: string;
    breadcrumbs: string[];
    folders: string[];
    files: Asset[];
}

/**
 * Result of a file operation
 */
export interface OperationResult {
    success: boolean;
    error?: string;
    affectedCount?: number;
}

/**
 * Result of ZIP extraction
 */
export interface ExtractZipResult {
    success: boolean;
    error?: string;
    extractedCount: number;
    folders: string[];
    assets: Asset[];
}

/**
 * Item to move (file or folder)
 */
export interface MoveItem {
    type: 'file' | 'folder';
    clientId?: string; // For files
    path?: string; // For folders
}

/**
 * Folder Manager service interface
 */
export interface FolderManagerService {
    // Validation
    isValidFolderName: (name: string) => boolean;
    isValidFolderPath: (path: string) => boolean;
    sanitizeFolderName: (name: string) => string;

    // Reading
    getFolderContents: (projectId: number, folderPath: string) => Promise<FolderContents>;
    folderExists: (projectId: number, folderPath: string) => Promise<boolean>;

    // Folder operations
    createFolder: (projectId: number, folderPath: string) => Promise<OperationResult>;
    renameFolder: (projectId: number, oldPath: string, newPath: string) => Promise<OperationResult>;
    moveFolder: (projectId: number, sourcePath: string, destinationPath: string) => Promise<OperationResult>;
    deleteFolder: (projectId: number, folderPath: string) => Promise<OperationResult>;

    // File operations
    moveAssets: (projectId: number, items: MoveItem[], destination: string) => Promise<OperationResult>;
    duplicateAsset: (
        projectId: number,
        projectUuid: string,
        assetId: number,
    ) => Promise<{ success: boolean; error?: string; newAsset?: Asset }>;

    // ZIP extraction
    extractZipAsset: (
        projectId: number,
        projectUuid: string,
        assetId: number,
        targetFolder: string,
    ) => Promise<ExtractZipResult>;
}

// ============================================================================
// Validation Helpers
// ============================================================================

// Invalid characters for folder names (cross-platform safe)
// Note: we check for control chars (0-31) separately to avoid regex escape issues
const INVALID_CHARS = /[<>:"|?*\\/]/;
const RESERVED_NAMES = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'LPT1', 'LPT2', 'LPT3', 'LPT4'];

/**
 * Check if a string contains control characters (ASCII 0-31)
 */
function hasControlChars(str: string): boolean {
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code < 32) return true;
    }
    return false;
}

/**
 * Remove control characters (ASCII 0-31) from a string
 */
function removeControlChars(str: string): string {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 32) result += str[i];
    }
    return result;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a FolderManagerService instance with injected dependencies
 */
export function createFolderManagerService(deps: FolderManagerDeps = {}): FolderManagerService {
    const db = deps.db ?? defaultDb;
    const queries = deps.queries ?? assetQueries;
    const fflate = deps.fflate ?? fflateModule;
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const crypto = deps.crypto ?? cryptoModule;
    const getProjectAssetsDir = deps.getProjectAssetsDir ?? defaultGetProjectAssetsDir;

    // ========================================================================
    // Validation Functions
    // ========================================================================

    const isValidFolderName = (name: string): boolean => {
        if (!name || name.trim() === '') return false;
        if (name.length > 255) return false;
        if (INVALID_CHARS.test(name)) return false;
        if (hasControlChars(name)) return false;
        if (name.startsWith('.') || name.startsWith(' ')) return false;
        if (name.endsWith('.') || name.endsWith(' ')) return false;
        if (RESERVED_NAMES.includes(name.toUpperCase())) return false;
        if (name === '.' || name === '..') return false;
        return true;
    };

    const isValidFolderPath = (folderPath: string): boolean => {
        // Empty path is valid (root)
        if (folderPath === '') return true;

        // Check each segment
        const segments = folderPath.split('/');
        return segments.every(segment => isValidFolderName(segment));
    };

    const sanitizeFolderName = (name: string): string => {
        // Remove control characters first
        let sanitized = removeControlChars(name);
        // Remove invalid characters
        sanitized = sanitized.replace(INVALID_CHARS, '_');
        // Remove leading/trailing dots and spaces
        sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '');
        // Truncate to max length
        if (sanitized.length > 255) {
            sanitized = sanitized.substring(0, 255);
        }
        // Replace reserved names
        if (RESERVED_NAMES.includes(sanitized.toUpperCase())) {
            sanitized = `_${sanitized}`;
        }
        return sanitized || 'folder';
    };

    // ========================================================================
    // Reading Functions
    // ========================================================================

    const getFolderContents = async (projectId: number, folderPath: string): Promise<FolderContents> => {
        // Get files in this folder
        const files = await queries.findAssetsInFolder(db, projectId, folderPath);

        // Get immediate subfolders
        const folders = await queries.getSubfolders(db, projectId, folderPath);

        // Build breadcrumbs
        const breadcrumbs = folderPath ? folderPath.split('/') : [];

        return {
            currentPath: folderPath,
            breadcrumbs,
            folders,
            files,
        };
    };

    const folderExists = async (projectId: number, folderPath: string): Promise<boolean> => {
        // A folder "exists" if there are any assets with that folder_path or any subfolder
        const count = await queries.countAssetsInFolderRecursive(db, projectId, folderPath);
        return count > 0;
    };

    // ========================================================================
    // Folder Operations
    // ========================================================================

    const createFolder = async (projectId: number, folderPath: string): Promise<OperationResult> => {
        // Validate path
        if (!isValidFolderPath(folderPath)) {
            return { success: false, error: 'Invalid folder path' };
        }

        // Since folders are virtual (derived from assets), creating a folder is a no-op
        // The folder will appear when assets are added to it
        // We just validate that the path is valid
        return { success: true };
    };

    const renameFolder = async (projectId: number, oldPath: string, newPath: string): Promise<OperationResult> => {
        // Validate paths
        if (!isValidFolderPath(oldPath) || !isValidFolderPath(newPath)) {
            return { success: false, error: 'Invalid folder path' };
        }

        if (oldPath === newPath) {
            return { success: true, affectedCount: 0 };
        }

        // Check if source folder has content
        const exists = await folderExists(projectId, oldPath);
        if (!exists) {
            return { success: false, error: 'Source folder does not exist or is empty' };
        }

        // Check if destination would conflict
        const destExists = await folderExists(projectId, newPath);
        if (destExists) {
            return { success: false, error: 'Destination folder already exists' };
        }

        // Update all asset paths
        const count = await queries.updateFolderPathPrefix(db, projectId, oldPath, newPath);

        return { success: true, affectedCount: count };
    };

    const moveFolder = async (
        projectId: number,
        sourcePath: string,
        destinationPath: string,
    ): Promise<OperationResult> => {
        // Validate paths
        if (!isValidFolderPath(sourcePath) || !isValidFolderPath(destinationPath)) {
            return { success: false, error: 'Invalid folder path' };
        }

        // Extract folder name from source path
        const folderName = sourcePath.includes('/') ? sourcePath.split('/').pop()! : sourcePath;

        // Build new full path
        const newPath = destinationPath ? `${destinationPath}/${folderName}` : folderName;

        // Check if source folder has content
        const exists = await folderExists(projectId, sourcePath);
        if (!exists) {
            return { success: false, error: 'Source folder does not exist or is empty' };
        }

        // Prevent moving a folder into itself
        if (newPath === sourcePath || newPath.startsWith(`${sourcePath}/`)) {
            return { success: false, error: 'Cannot move a folder into itself' };
        }

        // Check if destination would conflict
        const destExists = await folderExists(projectId, newPath);
        if (destExists) {
            return { success: false, error: 'A folder with this name already exists at destination' };
        }

        // Update all asset paths
        const count = await queries.updateFolderPathPrefix(db, projectId, sourcePath, newPath);

        return { success: true, affectedCount: count };
    };

    const deleteFolder = async (projectId: number, folderPath: string): Promise<OperationResult> => {
        // Validate path
        if (!isValidFolderPath(folderPath)) {
            return { success: false, error: 'Invalid folder path' };
        }

        // Don't allow deleting root
        if (folderPath === '') {
            return { success: false, error: 'Cannot delete root folder' };
        }

        // Delete all assets in folder recursively
        const count = await queries.deleteAssetsInFolderRecursive(db, projectId, folderPath);

        return { success: true, affectedCount: count };
    };

    // ========================================================================
    // File Operations
    // ========================================================================

    const moveAssets = async (projectId: number, items: MoveItem[], destination: string): Promise<OperationResult> => {
        // Validate destination
        if (!isValidFolderPath(destination)) {
            return { success: false, error: 'Invalid destination path' };
        }

        let totalMoved = 0;

        for (const item of items) {
            if (item.type === 'file' && item.clientId) {
                // Move single file
                const asset = await queries.findAssetByClientId(db, item.clientId, projectId);
                if (asset) {
                    // Check for conflicts
                    const conflict = await queries.findAssetByPath(db, projectId, destination, asset.filename);
                    if (conflict && conflict.id !== asset.id) {
                        return {
                            success: false,
                            error: `File "${asset.filename}" already exists in destination folder`,
                        };
                    }

                    await queries.updateAssetFolderPath(db, asset.id, destination);
                    totalMoved++;
                }
            } else if (item.type === 'folder' && item.path) {
                // Move folder
                const result = await moveFolder(projectId, item.path, destination);
                if (!result.success) {
                    return result;
                }
                totalMoved += result.affectedCount || 0;
            }
        }

        return { success: true, affectedCount: totalMoved };
    };

    const duplicateAsset = async (
        projectId: number,
        projectUuid: string,
        assetId: number,
    ): Promise<{ success: boolean; error?: string; newAsset?: Asset }> => {
        // Get the original asset
        const original = await queries.findAssetById(db, assetId);
        if (!original) {
            return { success: false, error: 'Asset not found' };
        }

        // Verify it belongs to the project
        if (original.project_id !== projectId) {
            return { success: false, error: 'Asset does not belong to this project' };
        }

        // Generate new filename with "(copy)" suffix
        const ext = path.extname(original.filename);
        const base = path.basename(original.filename, ext);
        let newFilename = `${base} (copy)${ext}`;

        // Check for conflicts and add numbers if needed
        let counter = 1;
        while (await queries.findAssetByPath(db, projectId, original.folder_path, newFilename)) {
            counter++;
            newFilename = `${base} (copy ${counter})${ext}`;
        }

        // Generate new UUID/client_id
        const newClientId = crypto.randomUUID();

        // Copy the physical file
        const projectAssetsDir = getProjectAssetsDir(projectUuid);
        const originalFilePath = original.storage_path;
        const newStoragePath = path.join(projectAssetsDir, newClientId, newFilename);

        try {
            await fs.ensureDir(path.dirname(newStoragePath));
            await fs.copy(originalFilePath, newStoragePath);
        } catch (err) {
            return { success: false, error: `Failed to copy file: ${(err as Error).message}` };
        }

        // Create new asset record
        const newAssetData: NewAsset = {
            project_id: projectId,
            filename: newFilename,
            storage_path: newStoragePath,
            mime_type: original.mime_type,
            file_size: original.file_size,
            client_id: newClientId,
            component_id: null, // New asset is not attached to any component
            content_hash: original.content_hash, // Same content
            folder_path: original.folder_path, // Same folder
        };

        const newAsset = await queries.createAsset(db, newAssetData);

        return { success: true, newAsset };
    };

    // ========================================================================
    // ZIP Extraction
    // ========================================================================

    const extractZipAsset = async (
        projectId: number,
        projectUuid: string,
        assetId: number,
        targetFolder: string,
    ): Promise<ExtractZipResult> => {
        // Validate target folder
        if (!isValidFolderPath(targetFolder)) {
            return {
                success: false,
                error: 'Invalid target folder path',
                extractedCount: 0,
                folders: [],
                assets: [],
            };
        }

        // Get the ZIP asset
        const zipAsset = await queries.findAssetById(db, assetId);
        if (!zipAsset) {
            return {
                success: false,
                error: 'ZIP asset not found',
                extractedCount: 0,
                folders: [],
                assets: [],
            };
        }

        // Verify it belongs to the project
        if (zipAsset.project_id !== projectId) {
            return {
                success: false,
                error: 'Asset does not belong to this project',
                extractedCount: 0,
                folders: [],
                assets: [],
            };
        }

        // Verify it's a ZIP file
        const mimeType = zipAsset.mime_type?.toLowerCase() || '';
        const filename = zipAsset.filename.toLowerCase();
        if (!mimeType.includes('zip') && !filename.endsWith('.zip')) {
            return {
                success: false,
                error: 'Asset is not a ZIP file',
                extractedCount: 0,
                folders: [],
                assets: [],
            };
        }

        // Read the ZIP file
        let zipData: Buffer;
        try {
            zipData = await fs.readFile(zipAsset.storage_path);
        } catch {
            return {
                success: false,
                error: 'Failed to read ZIP file',
                extractedCount: 0,
                folders: [],
                assets: [],
            };
        }

        // Extract ZIP contents
        const uint8ZipData = new Uint8Array(zipData);
        let unzipped: Record<string, Uint8Array>;
        try {
            unzipped = fflate.unzipSync(uint8ZipData);
        } catch {
            return {
                success: false,
                error: 'Failed to extract ZIP file - invalid or corrupted archive',
                extractedCount: 0,
                folders: [],
                assets: [],
            };
        }

        const projectAssetsDir = getProjectAssetsDir(projectUuid);
        const createdAssets: Asset[] = [];
        const foundFolders = new Set<string>();

        // Process each entry in the ZIP
        for (const [entryPath, data] of Object.entries(unzipped)) {
            // Skip directories
            if (entryPath.endsWith('/')) {
                continue;
            }

            // Skip __MACOSX and other hidden files
            if (entryPath.startsWith('__MACOSX/') || entryPath.includes('/._')) {
                continue;
            }

            // Calculate folder path within target
            const dirname = path.dirname(entryPath);
            const filename = path.basename(entryPath);

            // Skip hidden files
            if (filename.startsWith('.')) {
                continue;
            }

            // Build the full folder path
            const assetFolderPath =
                dirname === '.' ? targetFolder : targetFolder ? `${targetFolder}/${dirname}` : dirname;

            // Track folders
            if (dirname !== '.') {
                const folderParts = dirname.split('/');
                let accPath = targetFolder;
                for (const part of folderParts) {
                    accPath = accPath ? `${accPath}/${part}` : part;
                    foundFolders.add(accPath);
                }
            }

            // Check for filename conflicts
            const existingAsset = await queries.findAssetByPath(db, projectId, assetFolderPath, filename);
            if (existingAsset) {
                // Skip duplicates (could also rename, but skip is safer)
                continue;
            }

            // Generate client ID and storage path
            const clientId = crypto.randomUUID();
            const storagePath = path.join(projectAssetsDir, clientId, filename);

            // Write file to storage
            try {
                await fs.ensureDir(path.dirname(storagePath));
                await fs.writeFile(storagePath, Buffer.from(data));
            } catch {
                continue; // Skip files that fail to write
            }

            // Detect mime type from extension
            const ext = path.extname(filename).toLowerCase();
            const mimeTypes: Record<string, string> = {
                '.html': 'text/html',
                '.htm': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.xml': 'application/xml',
                '.txt': 'text/plain',
                '.md': 'text/markdown',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp',
                '.ico': 'image/x-icon',
                '.pdf': 'application/pdf',
                '.mp3': 'audio/mpeg',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf',
                '.eot': 'application/vnd.ms-fontobject',
            };
            const detectedMime = mimeTypes[ext] || 'application/octet-stream';

            // Calculate content hash
            const hash = crypto.createHash('sha256').update(data).digest('hex');

            // Create asset record
            const newAssetData: NewAsset = {
                project_id: projectId,
                filename,
                storage_path: storagePath,
                mime_type: detectedMime,
                file_size: data.length.toString(),
                client_id: clientId,
                component_id: null,
                content_hash: hash,
                folder_path: assetFolderPath,
            };

            const newAsset = await queries.createAsset(db, newAssetData);
            createdAssets.push(newAsset);
        }

        return {
            success: true,
            extractedCount: createdAssets.length,
            folders: Array.from(foundFolders).sort(),
            assets: createdAssets,
        };
    };

    // ========================================================================
    // Return FolderManagerService Interface
    // ========================================================================

    return {
        isValidFolderName,
        isValidFolderPath,
        sanitizeFolderName,
        getFolderContents,
        folderExists,
        createFolder,
        renameFolder,
        moveFolder,
        deleteFolder,
        moveAssets,
        duplicateAsset,
        extractZipAsset,
    };
}

// ============================================================================
// Default Instance
// ============================================================================

const defaultFolderManagerService = createFolderManagerService();

// Export all functions from the default instance
export const isValidFolderName = defaultFolderManagerService.isValidFolderName;
export const isValidFolderPath = defaultFolderManagerService.isValidFolderPath;
export const sanitizeFolderName = defaultFolderManagerService.sanitizeFolderName;
export const getFolderContents = defaultFolderManagerService.getFolderContents;
export const folderExists = defaultFolderManagerService.folderExists;
export const createFolder = defaultFolderManagerService.createFolder;
export const renameFolder = defaultFolderManagerService.renameFolder;
export const moveFolder = defaultFolderManagerService.moveFolder;
export const deleteFolder = defaultFolderManagerService.deleteFolder;
export const moveAssets = defaultFolderManagerService.moveAssets;
export const duplicateAsset = defaultFolderManagerService.duplicateAsset;
export const extractZipAsset = defaultFolderManagerService.extractZipAsset;

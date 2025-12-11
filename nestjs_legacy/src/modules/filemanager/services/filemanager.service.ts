import { Injectable, Logger } from '@nestjs/common';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { ZipService } from '../../file-management/services/zip.service';
import { FileItemDto } from '../dto/file-item.dto';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * FilemanagerService
 *
 * Service for managing files within project session directories.
 * Provides file operations for the FileGator Vue.js interface.
 *
 * Migrated from Symfony's FilemanagerService
 * @see symfony_legacy/src/Service/net/exelearning/Service/FilemanagerService/
 */
@Injectable()
export class FilemanagerService {
    private readonly logger = new Logger(FilemanagerService.name);

    // FileGator editable extensions
    private readonly editableExtensions = ['txt', 'css', 'js', 'ts', 'html', 'php', 'json', 'md'];

    // Max upload size (100MB)
    private readonly maxUploadSize = 100 * 1024 * 1024;

    constructor(
        private readonly fileHelper: FileHelperService,
        private readonly zipService: ZipService,
    ) {}

    /**
     * Get filemanager directory for a session
     * Creates the directory if it doesn't exist
     */
    async getFilemanagerDirectory(odeSessionId: string): Promise<string> {
        const sessionDir = this.fileHelper.getOdeSessionTempDir(odeSessionId);
        const filemanagerDir = path.join(sessionDir, 'file_manager');

        // Ensure directory exists
        await fs.ensureDir(filemanagerDir);

        return filemanagerDir;
    }

    /**
     * Get filemanager configuration
     * Returns config expected by FileGator Vue.js app
     */
    getConfig(): any {
        return {
            adapter: 'local',
            multiple_uploads: true,
            has_login: false,
            upload_max_size: this.maxUploadSize,
            upload_chunk_size: 1 * 1024 * 1024, // 1MB chunks
            guest_redirection: '',
            search_buffer_size: 20,
            overwrite_on_upload: false,
            // Extensions that can be edited in the text editor
            editable: this.editableExtensions,
            date_format: 'Y-m-d H:i:s',
            loaded: true,
        };
    }

    /**
     * List directory contents
     * Returns files and folders in FileGator format
     */
    async listDirectory(odeSessionId: string, relativePath: string = ''): Promise<any> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const targetDir = path.join(filemanagerDir, relativePath);

        // Security: validate path is within filemanager directory
        if (!this.fileHelper.isPathSafe(filemanagerDir, targetDir)) {
            throw new Error('Invalid path: Path traversal detected');
        }

        // Check if directory exists
        if (!(await fs.pathExists(targetDir))) {
            this.logger.warn(`Directory not found: ${targetDir}`);
            return {
                location: relativePath || '/',
                files: [],
            };
        }

        try {
            const items = await fs.readdir(targetDir);
            const fileList = [];

            for (const item of items) {
                const itemPath = path.join(targetDir, item);
                const stats = await fs.stat(itemPath);

                // Build item path - handle root directory (/ or empty)
                let itemRelativePath: string;
                if (!relativePath || relativePath === '/') {
                    itemRelativePath = item;
                } else {
                    itemRelativePath = `${relativePath}/${item}`;
                }

                fileList.push({
                    name: item,
                    path: itemRelativePath,
                    type: stats.isDirectory() ? 'dir' : 'file',
                    size: stats.size,
                    time: Math.floor(stats.mtime.getTime() / 1000),
                    permissions: stats.mode,
                });
            }

            return {
                location: relativePath || '/',
                files: fileList,
            };
        } catch (error) {
            this.logger.error(`Failed to list directory: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create new file or directory
     */
    async createNew(odeSessionId: string, itemPath: string, type: 'file' | 'dir'): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const targetPath = path.join(filemanagerDir, itemPath);

        // Security check
        if (!this.fileHelper.isPathSafe(filemanagerDir, targetPath)) {
            throw new Error('Invalid path: Path traversal detected');
        }

        if (type === 'dir') {
            await fs.ensureDir(targetPath);
        } else {
            await fs.ensureFile(targetPath);
        }
    }

    /**
     * Delete files or directories
     * Note: FileGator sends items as objects with {type, path} properties
     */
    async deleteItems(odeSessionId: string, items: FileItemDto[]): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);

        for (const item of items) {
            const targetPath = path.join(filemanagerDir, item.path);

            // Security check
            if (!this.fileHelper.isPathSafe(filemanagerDir, targetPath)) {
                throw new Error('Invalid path: Path traversal detected');
            }

            await fs.remove(targetPath);
        }
    }

    /**
     * Rename file or directory
     */
    async renameItem(odeSessionId: string, oldPath: string, newName: string): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const sourcePath = path.join(filemanagerDir, oldPath);
        const destPath = path.join(path.dirname(sourcePath), newName);

        // Security check
        if (
            !this.fileHelper.isPathSafe(filemanagerDir, sourcePath) ||
            !this.fileHelper.isPathSafe(filemanagerDir, destPath)
        ) {
            throw new Error('Invalid path: Path traversal detected');
        }

        await fs.move(sourcePath, destPath);
    }

    /**
     * Copy files or directories
     * Note: FileGator sends items as objects with {type, path} properties
     */
    async copyItems(
        odeSessionId: string,
        items: FileItemDto[],
        destination: string,
    ): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const destPath = path.join(filemanagerDir, destination);

        // Security check on destination
        if (!this.fileHelper.isPathSafe(filemanagerDir, destPath)) {
            throw new Error('Invalid destination path');
        }

        for (const item of items) {
            const sourcePath = path.join(filemanagerDir, item.path);
            const targetPath = path.join(destPath, path.basename(item.path));

            // Security check on source
            if (!this.fileHelper.isPathSafe(filemanagerDir, sourcePath)) {
                throw new Error('Invalid source path');
            }

            await fs.copy(sourcePath, targetPath);
        }
    }

    /**
     * Move files or directories
     * Note: FileGator sends items as objects with {type, path} properties
     */
    async moveItems(
        odeSessionId: string,
        items: FileItemDto[],
        destination: string,
    ): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const destPath = path.join(filemanagerDir, destination);

        // Security check on destination
        if (!this.fileHelper.isPathSafe(filemanagerDir, destPath)) {
            throw new Error('Invalid destination path');
        }

        for (const item of items) {
            const sourcePath = path.join(filemanagerDir, item.path);
            const targetPath = path.join(destPath, path.basename(item.path));

            // Security check on source
            if (!this.fileHelper.isPathSafe(filemanagerDir, sourcePath)) {
                throw new Error('Invalid source path');
            }

            await fs.move(sourcePath, targetPath);
        }
    }

    /**
     * Get absolute path for a relative path within filemanager
     */
    async getAbsolutePath(odeSessionId: string, relativePath: string): Promise<string> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const absolutePath = path.join(filemanagerDir, relativePath);

        // Security check
        if (!this.fileHelper.isPathSafe(filemanagerDir, absolutePath)) {
            throw new Error('Invalid path: Path traversal detected');
        }

        return absolutePath;
    }

    /**
     * Check if a file is editable (based on extension)
     */
    isEditable(filename: string): boolean {
        const ext = path.extname(filename).toLowerCase().slice(1);
        return this.editableExtensions.includes(ext);
    }

    /**
     * Get chunk file path for Resumable.js uploads
     * Pattern: multipart_{identifier}{filename}.part{chunkNumber}
     */
    private getChunkPath(
        odeSessionId: string,
        filename: string,
        identifier: string,
        chunkNumber: number,
    ): string {
        const filemanagerDir = this.fileHelper.getOdeSessionTempDir(odeSessionId);

        // Sanitize identifier (only alphanumeric and underscore)
        const sanitizedIdentifier = identifier.replace(/[^0-9a-zA-Z_]/g, '');

        // Build chunk filename
        const chunkFilename = `multipart_${sanitizedIdentifier}${filename}.part${chunkNumber}`;

        return path.join(filemanagerDir, chunkFilename);
    }

    /**
     * Check if a chunk exists (for Resumable.js)
     */
    async chunkExists(
        odeSessionId: string,
        filename: string,
        identifier: string,
        chunkNumber: number,
    ): Promise<boolean> {
        const chunkPath = this.getChunkPath(odeSessionId, filename, identifier, chunkNumber);
        return await fs.pathExists(chunkPath);
    }

    /**
     * Save a chunk for Resumable.js upload
     */
    async saveChunk(
        odeSessionId: string,
        filename: string,
        identifier: string,
        chunkNumber: number,
        chunkData: Buffer,
    ): Promise<void> {
        const chunkPath = this.getChunkPath(odeSessionId, filename, identifier, chunkNumber);
        await fs.writeFile(chunkPath, chunkData);
        this.logger.debug(`Saved chunk ${chunkNumber} for ${filename}`);
    }

    /**
     * Assemble chunks into final file and clean up
     */
    async assembleChunks(
        odeSessionId: string,
        filename: string,
        identifier: string,
        totalChunks: number,
        uploadPath: string,
    ): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const finalPath = path.join(filemanagerDir, uploadPath, filename);

        // Ensure destination directory exists
        await fs.ensureDir(path.dirname(finalPath));

        // Create write stream for final file
        const writeStream = fs.createWriteStream(finalPath);

        try {
            // Read and append each chunk in order
            for (let i = 1; i <= totalChunks; i++) {
                const chunkPath = this.getChunkPath(odeSessionId, filename, identifier, i);

                if (!(await fs.pathExists(chunkPath))) {
                    throw new Error(`Missing chunk ${i} of ${totalChunks}`);
                }

                const chunkData = await fs.readFile(chunkPath);
                writeStream.write(chunkData);
            }

            writeStream.end();

            // Wait for write to complete
            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', () => resolve());
                writeStream.on('error', (err) => reject(err));
            });

            // Clean up chunks
            for (let i = 1; i <= totalChunks; i++) {
                const chunkPath = this.getChunkPath(odeSessionId, filename, identifier, i);
                await fs.remove(chunkPath);
            }

            this.logger.log(`Assembled ${totalChunks} chunks into ${finalPath}`);
        } catch (error) {
            writeStream.destroy();
            throw error;
        }
    }

    /**
     * Zip multiple files or directories
     * Note: FileGator sends items as objects with {type, path} properties
     */
    async zipItems(
        odeSessionId: string,
        items: FileItemDto[],
        destination: string,
        name?: string,
    ): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const destDir = path.join(filemanagerDir, destination);

        // Security check on destination
        if (!this.fileHelper.isPathSafe(filemanagerDir, destDir)) {
            throw new Error('Invalid destination path');
        }

        // Ensure destination directory exists
        await fs.ensureDir(destDir);

        // Use provided name or generate from first item
        let zipFileName: string;
        if (name) {
            // Ensure .zip extension
            zipFileName = name.endsWith('.zip') ? name : `${name}.zip`;
        } else {
            // Fallback: generate from first item
            const firstItemPath = items[0]?.path || 'archive';
            const baseName = path.basename(firstItemPath, path.extname(firstItemPath));
            zipFileName = `${baseName}.zip`;
        }
        const zipFilePath = path.join(destDir, zipFileName);

        // Check if zip file already exists
        if (await fs.pathExists(zipFilePath)) {
            throw new Error(`File ${zipFileName} already exists`);
        }

        // Create temporary directory for zip contents
        const tempDir = path.join(filemanagerDir, '.temp-zip-' + Date.now());
        await fs.ensureDir(tempDir);

        try {
            // Copy all items to temp directory
            for (const item of items) {
                const sourcePath = path.join(filemanagerDir, item.path);

                // Security check on source
                if (!this.fileHelper.isPathSafe(filemanagerDir, sourcePath)) {
                    throw new Error('Invalid source path');
                }

                if (!(await fs.pathExists(sourcePath))) {
                    throw new Error(`Source not found: ${item.path}`);
                }

                const destPath = path.join(tempDir, path.basename(item.path));
                await fs.copy(sourcePath, destPath);
            }

            // Create zip file from temp directory
            await this.zipService.create(tempDir, zipFilePath);

            this.logger.log(`Created zip file: ${zipFilePath}`);
        } finally {
            // Clean up temp directory
            if (await fs.pathExists(tempDir)) {
                await fs.remove(tempDir);
            }
        }
    }

    /**
     * Unzip a file
     */
    async unzipItem(odeSessionId: string, itemPath: string, destination?: string): Promise<void> {
        const filemanagerDir = await this.getFilemanagerDirectory(odeSessionId);
        const sourcePath = path.join(filemanagerDir, itemPath);

        // Security check on source
        if (!this.fileHelper.isPathSafe(filemanagerDir, sourcePath)) {
            throw new Error('Invalid source path');
        }

        // Check if file exists and is a zip file
        if (!(await fs.pathExists(sourcePath))) {
            throw new Error(`File not found: ${itemPath}`);
        }

        const ext = path.extname(itemPath).toLowerCase();
        if (ext !== '.zip') {
            throw new Error('Only .zip files can be unzipped');
        }

        // Determine extraction directory
        let extractDir: string;
        if (destination) {
            extractDir = path.join(filemanagerDir, destination);
        } else {
            // Extract to parent directory of zip file (matches Symfony behavior)
            extractDir = path.dirname(sourcePath);
        }

        // Security check on extraction directory
        if (!this.fileHelper.isPathSafe(filemanagerDir, extractDir)) {
            throw new Error('Invalid extraction path');
        }

        // Ensure extraction directory exists (allows merge behavior)
        await fs.ensureDir(extractDir);

        // Extract zip file
        await this.zipService.extract(sourcePath, extractDir);

        this.logger.log(`Extracted zip file to: ${extractDir}`);
    }
}

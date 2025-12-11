import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileHelperService } from '../../file-management/services/file-helper.service';

export interface UsedFileInfo {
    usedFiles: string;
    usedFilesPath: string;
    usedFilesSize: string;
    pageNamesUsedFiles: string;
    blockNamesUsedFiles: string;
    typeComponentSyncUsedFiles: string;
    orderComponentSyncUsedFiles: string;
}

export interface UsedFilesResult {
    usedFiles: UsedFileInfo[];
}

export interface IdeviceContent {
    html: string;
    pageName?: string;
    blockName?: string;
    ideviceType?: string;
    order?: number;
}

@Injectable()
export class UsedFilesService {
    private readonly logger = new Logger(UsedFilesService.name);

    constructor(private readonly fileHelperService: FileHelperService) {}

    /**
     * Get all used files from idevices
     * Similar to Symfony's getBrokenLinks with resourceReport='true'
     * @param idevices Array of idevice content with HTML
     * @returns Used files result
     */
    async getUsedFiles(idevices: IdeviceContent[]): Promise<UsedFilesResult> {
        const allUsedFiles: UsedFileInfo[] = [];
        const filesDir = this.fileHelperService.getFilesDir();

        for (const idevice of idevices) {
            if (!idevice.html) continue;

            // Extract internal file links from HTML
            const fileLinks = this.extractInternalFileLinks(idevice.html);

            for (const fileLink of fileLinks) {
                // Get file info
                const fileInfo = await this.getFileInfo(
                    fileLink,
                    filesDir,
                    idevice,
                );

                if (fileInfo) {
                    allUsedFiles.push(fileInfo);
                }
            }
        }

        // If no used files found, return empty message
        if (allUsedFiles.length === 0) {
            return {
                usedFiles: [
                    {
                        usedFiles: 'No files found',
                        usedFilesPath: '',
                        usedFilesSize: '',
                        pageNamesUsedFiles: '',
                        blockNamesUsedFiles: '',
                        typeComponentSyncUsedFiles: '',
                        orderComponentSyncUsedFiles: '',
                    },
                ],
            };
        }

        return { usedFiles: allUsedFiles };
    }

    /**
     * Extract internal file links (files/...) from HTML
     * @param html HTML content
     * @returns Array of file paths
     */
    private extractInternalFileLinks(html: string): string[] {
        if (!html) return [];

        const links: string[] = [];
        // Match href and src attributes pointing to files/
        const regex = /(href|src)="(files\/[^"]*)"/gi;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(html)) !== null) {
            const url = match[2];
            if (url && !links.includes(url)) {
                links.push(url);
            }
        }

        // Also check for asset:// URLs (Yjs internal format)
        const assetRegex = /(href|src)="(asset:\/\/[^"]*)"/gi;
        while ((match = assetRegex.exec(html)) !== null) {
            const url = match[2];
            if (url && !links.includes(url)) {
                links.push(url);
            }
        }

        return links;
    }

    /**
     * Get file information
     * @param filePath File path from HTML
     * @param filesDir Base files directory
     * @param idevice Idevice info for location
     * @returns UsedFileInfo or null if file doesn't exist
     */
    private async getFileInfo(
        filePath: string,
        filesDir: string,
        idevice: IdeviceContent,
    ): Promise<UsedFileInfo | null> {
        try {
            // Handle asset:// URLs
            if (filePath.startsWith('asset://')) {
                // These are stored in IndexedDB, not on filesystem
                // Return info without size
                const fileName = filePath.split('/').pop() || filePath;
                return {
                    usedFiles: fileName,
                    usedFilesPath: filePath,
                    usedFilesSize: 'Stored in browser',
                    pageNamesUsedFiles: idevice.pageName || '',
                    blockNamesUsedFiles: idevice.blockName || '',
                    typeComponentSyncUsedFiles: idevice.ideviceType || '',
                    orderComponentSyncUsedFiles: String(idevice.order ?? ''),
                };
            }

            // Remove "files/" prefix for filesystem path
            const relativePath = filePath.startsWith('files/')
                ? filePath.substring(6)
                : filePath;
            const fullPath = path.join(filesDir, relativePath);

            // Check if file exists
            if (!(await fs.pathExists(fullPath))) {
                return null;
            }

            // Get file stats
            const stats = await fs.stat(fullPath);
            const fileSize = this.formatFileSize(stats.size);

            // Get filename from path
            const fileName = path.basename(filePath);

            return {
                usedFiles: fileName,
                usedFilesPath: filePath,
                usedFilesSize: fileSize,
                pageNamesUsedFiles: idevice.pageName || '',
                blockNamesUsedFiles: idevice.blockName || '',
                typeComponentSyncUsedFiles: idevice.ideviceType || '',
                orderComponentSyncUsedFiles: String(idevice.order ?? ''),
            };
        } catch (error) {
            this.logger.warn(`Error getting file info for ${filePath}: ${error.message}`);
            return null;
        }
    }

    /**
     * Format file size in human-readable format
     * Matches Symfony's FileUtil::formatFilesize
     * @param bytes File size in bytes
     * @returns Formatted size string
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';

        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
    }
}

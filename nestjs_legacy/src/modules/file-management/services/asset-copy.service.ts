import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { FileHelperService } from './file-helper.service';
import { ComponentIdMapping } from '../../xml/services/xml-builder.service';
import { FILE_STRUCTURE } from '../../../constants/file-structure.constants';

export interface AssetCopyResult {
    componentAssetsCopied: boolean;
    fileManagerAssetsCopied: boolean;
    cssAssetsCopied: boolean;
    errors: string[];
}

/**
 * AssetCopyService
 * Handles copying of assets from temp session directory to dist directory during save
 *
 * Copies three types of assets:
 * 1. Component/iDevice assets (with ID remapping)
 * 2. File manager uploads (custom files)
 * 3. CSS and icon files
 */
@Injectable()
export class AssetCopyService {
    private readonly logger = new Logger(AssetCopyService.name);

    constructor(private readonly fileHelper: FileHelperService) {}

    /**
     * Copy all assets for a session to dist directory
     *
     * @param odeSessionId Session ID
     * @param distPath Distribution directory path
     * @param componentIdMapping Old component ID -> New component ID mapping
     * @returns AssetCopyResult with success status and errors
     */
    async copyAllAssets(
        odeSessionId: string,
        distPath: string,
        componentIdMapping: ComponentIdMapping,
    ): Promise<AssetCopyResult> {
        const result: AssetCopyResult = {
            componentAssetsCopied: false,
            fileManagerAssetsCopied: false,
            cssAssetsCopied: false,
            errors: [],
        };

        try {
            // 1. Create directory structure in dist
            await this.createDistDirectoryStructure(distPath);

            // 2. Copy component assets (with ID remapping)
            result.componentAssetsCopied = await this.copyComponentAssets(
                odeSessionId,
                distPath,
                componentIdMapping,
            );

            // 3. Copy file manager uploads
            result.fileManagerAssetsCopied = await this.copyFileManagerAssets(
                odeSessionId,
                distPath,
            );

            // 4. Copy CSS and icons
            result.cssAssetsCopied = await this.copyCssAssets(distPath);

            this.logger.log(`Successfully copied all assets for session ${odeSessionId}`);
        } catch (error) {
            this.logger.error(`Failed to copy assets: ${error.message}`, error.stack);
            result.errors.push(error.message);
        }

        return result;
    }

    /**
     * Create directory structure in dist directory
     * Creates: custom/, content/css/, content/resources/
     *
     * @param distPath Distribution directory path
     */
    private async createDistDirectoryStructure(distPath: string): Promise<void> {
        const { DIR_NAMES } = FILE_STRUCTURE;

        await fs.ensureDir(path.join(distPath, DIR_NAMES.CUSTOM));
        await fs.ensureDir(path.join(distPath, DIR_NAMES.CONTENT, DIR_NAMES.CSS));
        await fs.ensureDir(path.join(distPath, DIR_NAMES.CONTENT, DIR_NAMES.RESOURCES));

        this.logger.debug(`Created directory structure in ${distPath}`);
    }

    /**
     * Copy component assets with ID remapping
     * For each component: tmp/resources/{oldId}/ -> dist/content/resources/{newId}/
     *
     * @param odeSessionId Session ID
     * @param distPath Distribution directory path
     * @param componentIdMapping Old ID -> New ID mapping
     * @returns boolean Success status
     */
    private async copyComponentAssets(
        odeSessionId: string,
        distPath: string,
        componentIdMapping: ComponentIdMapping,
    ): Promise<boolean> {
        try {
            const { DIR_NAMES } = FILE_STRUCTURE;
            const contentResourcesDir = path.join(distPath, DIR_NAMES.CONTENT, DIR_NAMES.RESOURCES);

            let copiedCount = 0;

            // Copy each component's assets
            for (const [oldId, newId] of Object.entries(componentIdMapping)) {
                const sourceDir = this.fileHelper.getOdeComponentsSyncDir(odeSessionId, oldId);
                const destDir = path.join(contentResourcesDir, newId);

                // Check if source directory exists and has files
                if (await fs.pathExists(sourceDir)) {
                    const files = await fs.readdir(sourceDir);

                    if (files.length > 0) {
                        // Copy directory
                        await fs.ensureDir(destDir);
                        await fs.copy(sourceDir, destDir, { overwrite: true });

                        copiedCount++;
                        this.logger.debug(
                            `Copied component assets: ${oldId} -> ${newId} (${files.length} files)`,
                        );
                    }
                }
            }

            this.logger.log(`Copied assets for ${copiedCount} components`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to copy component assets: ${error.message}`, error.stack);
            return false;
        }
    }

    /**
     * Copy file manager uploads
     * Copies: tmp/custom/ -> dist/custom/
     *
     * @param odeSessionId Session ID
     * @param distPath Distribution directory path
     * @returns boolean Success status
     */
    private async copyFileManagerAssets(odeSessionId: string, distPath: string): Promise<boolean> {
        try {
            const { DIR_NAMES } = FILE_STRUCTURE;
            const sourceDir = this.fileHelper.getOdeFilemanagerDir(odeSessionId);
            const destDir = path.join(distPath, DIR_NAMES.CUSTOM);

            // Check if source directory exists
            if (!(await fs.pathExists(sourceDir))) {
                this.logger.debug('No file manager assets to copy');
                return true; // Not an error, just no files
            }

            const files = await fs.readdir(sourceDir);

            if (files.length === 0) {
                this.logger.debug('File manager directory is empty');
                return true;
            }

            // Copy directory contents
            await fs.copy(sourceDir, destDir, { overwrite: true });

            this.logger.log(`Copied ${files.length} file manager assets`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to copy file manager assets: ${error.message}`, error.stack);
            return false;
        }
    }

    /**
     * Copy CSS and icon assets
     * Copies:
     * - public/style/workarea/base.css -> dist/content/css/base.css
     * - public/style/workarea/images/icons/ -> dist/content/css/icons/
     *
     * @param distPath Distribution directory path
     * @returns boolean Success status
     */
    private async copyCssAssets(distPath: string): Promise<boolean> {
        try {
            const { DIR_NAMES } = FILE_STRUCTURE;
            const styleWorkareaDir = this.fileHelper.getStyleWorkareaDir();
            const contentCssDir = path.join(distPath, DIR_NAMES.CONTENT, DIR_NAMES.CSS);

            // Copy base.css
            const baseCssSource = path.join(styleWorkareaDir, 'base.css');
            const baseCssDest = path.join(contentCssDir, 'base.css');

            if (await fs.pathExists(baseCssSource)) {
                await fs.copy(baseCssSource, baseCssDest, { overwrite: true });
                this.logger.debug('Copied base.css');
            } else {
                this.logger.warn('base.css not found in workarea directory');
            }

            // Copy icons directory
            const iconsSource = path.join(styleWorkareaDir, 'images', 'icons');
            const iconsDest = path.join(contentCssDir, 'icons');

            if (await fs.pathExists(iconsSource)) {
                await fs.copy(iconsSource, iconsDest, { overwrite: true });

                const iconFiles = await fs.readdir(iconsDest);
                this.logger.debug(`Copied ${iconFiles.length} icon files`);
            } else {
                this.logger.warn('Icons directory not found in workarea');
            }

            this.logger.log('Successfully copied CSS assets');
            return true;
        } catch (error) {
            this.logger.error(`Failed to copy CSS assets: ${error.message}`, error.stack);
            return false;
        }
    }

    /**
     * Check if a directory exists and is writable
     *
     * @param dirPath Directory path
     * @returns boolean True if writable
     */
    async isDirectoryWritable(dirPath: string): Promise<boolean> {
        try {
            await fs.access(dirPath, fs.constants.W_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get total size of copied assets
     *
     * @param distPath Distribution directory path
     * @returns number Size in bytes
     */
    async getTotalAssetsSize(distPath: string): Promise<number> {
        try {
            return await this.fileHelper.getDirectorySize(distPath);
        } catch (error) {
            this.logger.error(`Failed to calculate assets size: ${error.message}`);
            return 0;
        }
    }
}

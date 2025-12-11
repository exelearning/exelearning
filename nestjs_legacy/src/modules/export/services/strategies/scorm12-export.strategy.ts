import { Injectable } from '@nestjs/common';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseExportStrategy } from './base-export.strategy';
import {
    ExportContext,
    ExportFormatType,
} from '../../interfaces/export-strategy.interface';
import { ZipService } from '../../../file-management/services/zip.service';
import { HtmlGeneratorHelper } from '../../helpers/html-generator.helper';
import { AssetCopierService } from '../asset-copier.service';
import { Scorm12ManifestBuilder } from '../manifest-builders/scorm12-manifest.builder';
import {
    FILE_EXTENSIONS,
    FILE_SUFFIXES,
    SCORM12,
    EXPORT_DIRS,
} from '../../constants/export.constants';

/**
 * SCORM 1.2 export strategy
 * Generates a SCORM 1.2 compliant package with manifest and tracking support
 */
@Injectable()
export class Scorm12ExportStrategy extends BaseExportStrategy {
    readonly format = ExportFormatType.SCORM12;
    readonly fileExtension = FILE_EXTENSIONS[ExportFormatType.SCORM12];
    readonly fileSuffix = FILE_SUFFIXES[ExportFormatType.SCORM12];

    constructor(
        zipService: ZipService,
        htmlGenerator: HtmlGeneratorHelper,
        private readonly assetCopier: AssetCopierService,
        private readonly manifestBuilder: Scorm12ManifestBuilder,
    ) {
        super(zipService, htmlGenerator);
    }

    /**
     * Generate HTML files with SCORM-specific modifications
     */
    async generateHtmlFiles(context: ExportContext): Promise<void> {
        // First generate standard HTML files
        await super.generateHtmlFiles(context);

        // Create html subdirectory for non-index pages
        const htmlDir = path.join(context.exportDir, EXPORT_DIRS.HTML);
        await fs.ensureDir(htmlDir);

        // Move non-index files to html/ directory
        const files = await fs.readdir(context.exportDir);
        for (const file of files) {
            if (file.endsWith('.html') && file !== 'index.html') {
                const sourcePath = path.join(context.exportDir, file);
                const destPath = path.join(htmlDir, file);
                await fs.move(sourcePath, destPath);
            }
        }

        // Update links in HTML files to reflect new structure
        await this.updateHtmlLinks(context.exportDir);
    }

    /**
     * Generate SCORM-specific files
     */
    async generateFormatSpecificFiles(context: ExportContext): Promise<void> {
        const { exportDir, sessionPath, options } = context;

        // Generate imsmanifest.xml
        const manifest = await this.manifestBuilder.generateManifest(context);
        await fs.writeFile(
            path.join(exportDir, SCORM12.MANIFEST_FILE),
            manifest,
            'utf-8',
        );

        // Generate imslrm.xml (LOM metadata)
        const lomMetadata = await this.manifestBuilder.generateLomMetadata(context);
        await fs.writeFile(
            path.join(exportDir, SCORM12.LOM_FILE),
            lomMetadata,
            'utf-8',
        );

        // Copy base assets with SCORM JS files
        await this.assetCopier.copyBaseAssets(exportDir, {
            format: this.format,
            includeScormJs: true,
            includeSchemas: true,
            customCss: options.customCss,
        });

        // Copy theme if specified
        if (options.theme) {
            await this.assetCopier.copyThemeAssets(exportDir, options.theme.name);
        }

        // Copy project resources
        await this.assetCopier.copyProjectResources(sessionPath, exportDir);

        // Copy iDevice assets
        const ideviceTypes = this.getUsedIdeviceTypes(context);
        if (ideviceTypes.length > 0) {
            await this.assetCopier.copyIdeviceAssets(exportDir, ideviceTypes);
        }
    }

    /**
     * SCORM supports preview mode
     */
    supportsPreview(): boolean {
        return true;
    }

    /**
     * Get required assets for SCORM 1.2
     */
    getRequiredAssets(): string[] {
        return [
            'base.css',
            'content.css',
            'exe_jquery.js',
            'common_i18n.js',
            'common.js',
            '_style_js.js',
            'SCORM_API_wrapper.js',
            'SCOFunctions.js',
        ];
    }

    /**
     * Update HTML links to reflect SCORM directory structure
     */
    private async updateHtmlLinks(exportDir: string): Promise<void> {
        // Update index.html - links should point to html/
        const indexPath = path.join(exportDir, 'index.html');
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf-8');
            // Update links to point to html/ subdirectory
            content = content.replace(
                /href="([^"]+)\.html"/g,
                (match, filename) => {
                    if (filename === 'index') return match;
                    return `href="html/${filename}.html"`;
                },
            );
            await fs.writeFile(indexPath, content, 'utf-8');
        }

        // Update HTML files in html/ directory - links should point to same level
        const htmlDir = path.join(exportDir, EXPORT_DIRS.HTML);
        if (await fs.pathExists(htmlDir)) {
            const htmlFiles = await fs.readdir(htmlDir);
            for (const file of htmlFiles) {
                if (!file.endsWith('.html')) continue;

                const filePath = path.join(htmlDir, file);
                let content = await fs.readFile(filePath, 'utf-8');

                // Update resource paths to go up one level
                content = content.replace(
                    /src="([^"]+)"/g,
                    (match, src) => {
                        if (src.startsWith('http') || src.startsWith('//')) return match;
                        if (src.startsWith('../')) return match;
                        return `src="../${src}"`;
                    },
                );

                content = content.replace(
                    /href="([^"]+\.(?:css|js))"/g,
                    (match, href) => {
                        if (href.startsWith('http') || href.startsWith('//')) return match;
                        if (href.startsWith('../')) return match;
                        return `href="../${href}"`;
                    },
                );

                // Update page navigation links
                content = content.replace(
                    /href="index\.html"/g,
                    'href="../index.html"',
                );

                await fs.writeFile(filePath, content, 'utf-8');
            }
        }
    }

    /**
     * Get list of iDevice types used in the project
     */
    private getUsedIdeviceTypes(context: ExportContext): string[] {
        const types = new Set<string>();

        for (const page of context.structure.pages) {
            for (const component of page.components || []) {
                if (component.type) {
                    types.add(component.type);
                }
            }
        }

        return Array.from(types);
    }
}

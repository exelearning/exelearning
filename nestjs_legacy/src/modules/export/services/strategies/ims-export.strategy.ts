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
import { ImsManifestBuilder } from '../manifest-builders/ims-manifest.builder';
import {
    FILE_EXTENSIONS,
    FILE_SUFFIXES,
    IMS,
    EXPORT_DIRS,
} from '../../constants/export.constants';

/**
 * IMS Content Package export strategy
 * Generates an IMS CP compliant package without SCORM tracking
 */
@Injectable()
export class ImsExportStrategy extends BaseExportStrategy {
    readonly format = ExportFormatType.IMS;
    readonly fileExtension = FILE_EXTENSIONS[ExportFormatType.IMS];
    readonly fileSuffix = FILE_SUFFIXES[ExportFormatType.IMS];

    constructor(
        zipService: ZipService,
        htmlGenerator: HtmlGeneratorHelper,
        private readonly assetCopier: AssetCopierService,
        private readonly manifestBuilder: ImsManifestBuilder,
    ) {
        super(zipService, htmlGenerator);
    }

    /**
     * Generate HTML files with IMS-specific structure
     */
    async generateHtmlFiles(context: ExportContext): Promise<void> {
        // Generate standard HTML files
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

        // Update links in HTML files
        await this.updateHtmlLinks(context.exportDir);
    }

    /**
     * Generate IMS-specific files
     */
    async generateFormatSpecificFiles(context: ExportContext): Promise<void> {
        const { exportDir, sessionPath, options } = context;

        // Generate imsmanifest.xml
        const manifest = await this.manifestBuilder.generateManifest(context);
        await fs.writeFile(
            path.join(exportDir, IMS.MANIFEST_FILE),
            manifest,
            'utf-8',
        );

        // Copy base assets (without SCORM JS)
        await this.assetCopier.copyBaseAssets(exportDir, {
            format: this.format,
            includeScormJs: false, // IMS does not use SCORM tracking
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
     * IMS supports preview mode
     */
    supportsPreview(): boolean {
        return true;
    }

    /**
     * Get required assets for IMS (no SCORM JS)
     */
    getRequiredAssets(): string[] {
        return [
            'base.css',
            'content.css',
            'exe_jquery.js',
            'common_i18n.js',
            'common.js',
            '_style_js.js',
        ];
    }

    /**
     * Update HTML links for IMS directory structure
     */
    private async updateHtmlLinks(exportDir: string): Promise<void> {
        // Update index.html
        const indexPath = path.join(exportDir, 'index.html');
        if (await fs.pathExists(indexPath)) {
            let content = await fs.readFile(indexPath, 'utf-8');
            content = content.replace(
                /href="([^"]+)\.html"/g,
                (match, filename) => {
                    if (filename === 'index') return match;
                    return `href="html/${filename}.html"`;
                },
            );
            await fs.writeFile(indexPath, content, 'utf-8');
        }

        // Update HTML files in html/ directory
        const htmlDir = path.join(exportDir, EXPORT_DIRS.HTML);
        if (await fs.pathExists(htmlDir)) {
            const htmlFiles = await fs.readdir(htmlDir);
            for (const file of htmlFiles) {
                if (!file.endsWith('.html')) continue;

                const filePath = path.join(htmlDir, file);
                let content = await fs.readFile(filePath, 'utf-8');

                // Update resource paths
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

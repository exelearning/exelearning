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
import { FILE_EXTENSIONS, FILE_SUFFIXES } from '../../constants/export.constants';

/**
 * HTML5/Web export strategy
 * Generates a complete website export with all pages and assets
 */
@Injectable()
export class Html5ExportStrategy extends BaseExportStrategy {
    readonly format = ExportFormatType.HTML5;
    readonly fileExtension = FILE_EXTENSIONS[ExportFormatType.HTML5];
    readonly fileSuffix = FILE_SUFFIXES[ExportFormatType.HTML5];

    constructor(
        zipService: ZipService,
        htmlGenerator: HtmlGeneratorHelper,
        private readonly assetCopier: AssetCopierService,
    ) {
        super(zipService, htmlGenerator);
    }

    /**
     * Generate format-specific files for HTML5 export
     * For HTML5, this mainly involves copying assets
     */
    async generateFormatSpecificFiles(context: ExportContext): Promise<void> {
        const { exportDir, sessionPath, options } = context;

        // Copy base assets (JS, CSS)
        await this.assetCopier.copyBaseAssets(exportDir, {
            format: this.format,
            customCss: options.customCss,
        });

        // Copy theme if specified
        if (options.theme) {
            await this.assetCopier.copyThemeAssets(exportDir, options.theme.name);
        }

        // Copy project resources (images, media, etc.)
        await this.assetCopier.copyProjectResources(sessionPath, exportDir);

        // Copy iDevice assets if needed
        const ideviceTypes = this.getUsedIdeviceTypes(context);
        if (ideviceTypes.length > 0) {
            await this.assetCopier.copyIdeviceAssets(exportDir, ideviceTypes);
        }
    }

    /**
     * HTML5 supports preview mode
     */
    supportsPreview(): boolean {
        return true;
    }

    /**
     * Get required assets for HTML5 export
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

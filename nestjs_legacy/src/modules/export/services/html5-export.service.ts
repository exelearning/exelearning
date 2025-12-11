import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ZipService } from '../../file-management/services/zip.service';
import { FileHelperService } from '../../file-management/services/file-helper.service';
import { ProjectOpenService } from '../../project/services/project-open.service';
import { PreviewService } from './preview.service';
import { HtmlGeneratorHelper } from '../helpers/html-generator.helper';
import { ExportResult, Html5ExportOptions, ExportFormat } from '../dto/export.dto';
import { ParsedOdeStructure, NormalizedPage } from '../../xml/interfaces/ode-xml.interface';

@Injectable()
export class Html5ExportService {
    private readonly logger = new Logger(Html5ExportService.name);

    constructor(
        private readonly zipService: ZipService,
        private readonly fileHelper: FileHelperService,
        private readonly projectService: ProjectOpenService,
        private readonly configService: ConfigService,
        private readonly previewService: PreviewService,
        private readonly htmlGenerator: HtmlGeneratorHelper,
    ) {}

    /**
     * Export session to HTML5 format
     * Supports both preview mode (direct file serving) and download mode (ZIP)
     * @param odeSessionId Session ID
     * @param options HTML5 export options
     * @returns Export result with file path or preview URL
     */
    async exportToHtml5(
        odeSessionId: string,
        options: Html5ExportOptions = {},
    ): Promise<ExportResult> {
        try {
            const isPreviewMode = options.preview === true;
            this.logger.debug(
                `Exporting session ${odeSessionId} to HTML5 (${isPreviewMode ? 'preview' : 'download'} mode)`,
            );

            // Get session
            const session = this.projectService.getSession(odeSessionId);
            if (!session) {
                throw new Error(`Session not found: ${odeSessionId}`);
            }

            // Determine export directory based on mode
            let exportDir: string;

            if (isPreviewMode) {
                // Preview mode: use session temp directory with random subdirectory
                const tempPath = options.tempPath || this.previewService.generateRandomTempPath();
                exportDir = this.fileHelper.getPreviewExportPath(odeSessionId, tempPath);
                this.logger.debug(`Preview export directory: ${exportDir}`);
            } else {
                // Download mode: use temp path for ZIP creation
                exportDir = this.fileHelper.getTempPath(`html5-export-${odeSessionId}`);
                this.logger.debug(`Download export directory: ${exportDir}`);
            }

            await fs.ensureDir(exportDir);

            try {
                // Generate HTML5 files
                await this.generateHtml5Files(
                    exportDir,
                    session.structure,
                    session.sessionPath,
                    options,
                );

                if (isPreviewMode) {
                    // Preview mode: return preview URL (no ZIP, don't delete files)
                    const components = this.previewService.extractSessionPathComponents(
                        session.sessionPath,
                    );
                    if (!components) {
                        throw new Error('Failed to extract session path components');
                    }

                    const previewUrl = this.previewService.buildPreviewUrl(
                        odeSessionId,
                        options.tempPath || '',
                        'index.html',
                    );

                    this.logger.log(`Successfully generated preview at ${previewUrl}`);

                    return {
                        filePath: exportDir,
                        fileName: 'index.html',
                        fileSize: 0, // Not applicable for preview
                        format: ExportFormat.HTML5,
                    };
                } else {
                    // Download mode: create ZIP and return download path
                    const zipPath = `${exportDir}.zip`;
                    await this.zipService.create(exportDir, zipPath, {
                        compressionLevel: options.compressionLevel || 9,
                    });

                    // Get file size
                    const stats = await fs.stat(zipPath);

                    this.logger.log(`Successfully exported HTML5 to ${zipPath}`);

                    return {
                        filePath: zipPath,
                        fileName: `${session.structure.meta.title || 'export'}_html5.zip`,
                        fileSize: stats.size,
                        format: ExportFormat.HTML5,
                    };
                }
            } finally {
                // Only cleanup in download mode
                if (!isPreviewMode) {
                    await fs.remove(exportDir);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to export HTML5: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Generate HTML5 files in export directory
     * @param exportDir Export directory path
     * @param structure Parsed ODE structure
     * @param sessionPath Session directory path
     * @param options HTML5 options
     */
    private async generateHtml5Files(
        exportDir: string,
        structure: ParsedOdeStructure,
        sessionPath: string,
        options: Html5ExportOptions,
    ): Promise<void> {
        // Generate index.html
        await this.generateIndexHtml(exportDir, structure, options);

        // Generate page HTML files
        for (const page of structure.pages) {
            await this.generatePageHtml(exportDir, page, structure, options);
        }

        // Copy resources
        await this.copyResources(sessionPath, exportDir);

        // Copy theme files (uses theme from meta or defaults to 'base')
        const themeName = structure.meta?.theme || 'base';
        await this.copyThemeFiles(exportDir, themeName);

        // Create basic assets (CSS/JS) referenced by the generator
        await this.createBasicAssets(exportDir);
    }

    /**
     * Generate index.html
     * @param exportDir Export directory
     * @param structure ODE structure
     * @param options HTML5 options
     */
    private async generateIndexHtml(
        exportDir: string,
        structure: ParsedOdeStructure,
        options: Html5ExportOptions,
    ): Promise<void> {
        const html = this.htmlGenerator.generateIndexHtml(structure, options);
        await fs.writeFile(path.join(exportDir, 'index.html'), html, 'utf-8');
    }

    /**
     * Generate page HTML file
     * @param exportDir Export directory
     * @param page Page to generate
     * @param structure Full ODE structure
     * @param options HTML5 options
     */
    private async generatePageHtml(
        exportDir: string,
        page: NormalizedPage,
        structure: ParsedOdeStructure,
        options: Html5ExportOptions,
    ): Promise<void> {
        const html = this.htmlGenerator.generatePageHtml(page, structure, options);

        // Use ID.html as filename to match links generated by helper
        await fs.writeFile(path.join(exportDir, `${page.id}.html`), html, 'utf-8');
    }

    /**
     * Copy resources from session to export directory
     * @param sessionPath Session directory path
     * @param exportDir Export directory path
     */
    private async copyResources(sessionPath: string, exportDir: string): Promise<void> {
        // Copy all files except content.xml and export/preview directories
        const files = await fs.readdir(sessionPath);

        for (const file of files) {
            if (file === 'content.xml') continue;
            // Skip export and preview directories to prevent recursive copying
            if (file === 'export' || file === 'preview') continue;

            const sourcePath = path.join(sessionPath, file);
            const destPath = path.join(exportDir, file);

            // Safety check: don't copy if source is a parent of destination
            if (exportDir.startsWith(sourcePath)) {
                continue;
            }

            const stats = await fs.stat(sourcePath);
            if (stats.isDirectory()) {
                await fs.copy(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    /**
     * Copy theme files to export directory
     * Copies theme from public/files/perm/themes/base/{themeName}/
     * @param exportDir Export directory path
     * @param themeName Theme name (default: 'base')
     */
    private async copyThemeFiles(
        exportDir: string,
        themeName: string = 'base',
    ): Promise<void> {
        const themeSourceDir = path.join(
            process.cwd(),
            'public',
            'files',
            'perm',
            'themes',
            'base',
            themeName,
        );
        const themeDestDir = path.join(exportDir, 'theme');

        this.logger.debug(`Copying theme "${themeName}" from ${themeSourceDir}`);

        await fs.ensureDir(themeDestDir);

        if (await fs.pathExists(themeSourceDir)) {
            // Copy style.css as content.css (matches export format naming)
            const cssSource = path.join(themeSourceDir, 'style.css');
            if (await fs.pathExists(cssSource)) {
                await fs.copy(cssSource, path.join(themeDestDir, 'content.css'));
            }

            // Copy style.js as default.js (matches export format naming)
            const jsSource = path.join(themeSourceDir, 'style.js');
            if (await fs.pathExists(jsSource)) {
                await fs.copy(jsSource, path.join(themeDestDir, 'default.js'));
            }

            // Copy other theme files (config.xml, icons/, img/)
            const otherFiles = ['config.xml', 'icons', 'img'];
            for (const file of otherFiles) {
                const src = path.join(themeSourceDir, file);
                if (await fs.pathExists(src)) {
                    await fs.copy(src, path.join(themeDestDir, file));
                }
            }

            this.logger.debug(`Theme "${themeName}" copied successfully`);
        } else {
            this.logger.warn(`Theme not found: ${themeSourceDir}, using fallback styles`);
        }
    }

    /**
     * Create basic assets referenced by the HTML generator
     * Note: Main theme styles come from copyThemeFiles()
     */
    private async createBasicAssets(exportDir: string): Promise<void> {
        // Base CSS - minimal fallback, main styles come from theme/content.css
        const baseCss = `/* Base CSS fallback - See theme/content.css for main styles */
body { font-family: sans-serif; margin: 0; padding: 0; }
`;
        await fs.writeFile(path.join(exportDir, 'base.css'), baseCss);
        await fs.writeFile(path.join(exportDir, 'content.css'), '/* Additional content styles */');

        // Basic JS placeholders
        await fs.writeFile(path.join(exportDir, 'exe_jquery.js'), '// jQuery placeholder');
        await fs.writeFile(path.join(exportDir, 'common_i18n.js'), '// i18n placeholder');
        await fs.writeFile(path.join(exportDir, 'common.js'), '// common.js placeholder');
        await fs.writeFile(path.join(exportDir, '_style_js.js'), '// Style JS placeholder');
    }
}

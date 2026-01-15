/**
 * HTML5 Export Service for Elysia
 * Exports session to HTML5 format (ZIP download)
 *
 * Uses Dependency Injection pattern for testability
 */
import * as fsExtra from 'fs-extra';
import * as pathModule from 'path';
import { createZip as createZipDefault } from '../zip';
import { getTempPath as getTempPathDefault } from '../file-helper';
import { getSession as getSessionDefault } from '../session-manager';
import * as htmlGeneratorModule from './html-generator';
import { ExportResult, ExportFormat, Html5ExportOptions } from './interfaces';
import { ParsedOdeStructure, NormalizedPage } from '../xml/interfaces';

const DEBUG = process.env.APP_DEBUG === '1';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * HTML Generator module functions
 */
export interface HtmlGeneratorDeps {
    generateIndexHtml: typeof htmlGeneratorModule.generateIndexHtml;
    generatePageHtml: typeof htmlGeneratorModule.generatePageHtml;
    sanitizeFilename: typeof htmlGeneratorModule.sanitizeFilename;
}

/**
 * Dependencies that can be injected for testing
 */
export interface Html5ExportDeps {
    fs?: typeof fsExtra;
    path?: typeof pathModule;
    createZip?: typeof createZipDefault;
    getTempPath?: typeof getTempPathDefault;
    getSession?: typeof getSessionDefault;
    htmlGenerator?: HtmlGeneratorDeps;
    getCwd?: () => string;
}

/**
 * HTML5 Export service interface
 */
export interface Html5ExportService {
    exportToHtml5: (odeSessionId: string, options?: Html5ExportOptions) => Promise<ExportResult>;
    exportDownload: (sessionId: string, compressionLevel?: number) => Promise<ExportResult>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an Html5ExportService instance with injected dependencies
 */
export function createHtml5ExportService(deps: Html5ExportDeps = {}): Html5ExportService {
    const fs = deps.fs ?? fsExtra;
    const path = deps.path ?? pathModule;
    const createZip = deps.createZip ?? createZipDefault;
    const getTempPath = deps.getTempPath ?? getTempPathDefault;
    const getSession = deps.getSession ?? getSessionDefault;
    const htmlGenerator = deps.htmlGenerator ?? htmlGeneratorModule;
    const getCwd = deps.getCwd ?? (() => process.cwd());

    // ========================================================================
    // Internal Functions
    // ========================================================================

    /**
     * Generate index.html
     */
    async function generateIndexHtml(
        exportDir: string,
        structure: ParsedOdeStructure,
        options: Html5ExportOptions,
    ): Promise<void> {
        const html = htmlGenerator.generateIndexHtml(structure, options);
        await fs.writeFile(path.join(exportDir, 'index.html'), html, 'utf-8');
    }

    /**
     * Generate page HTML file
     */
    async function generatePageHtml(
        exportDir: string,
        page: NormalizedPage,
        structure: ParsedOdeStructure,
        options: Html5ExportOptions,
    ): Promise<void> {
        const htmlDir = path.join(exportDir, 'html');
        await fs.ensureDir(htmlDir);

        const html = htmlGenerator.generatePageHtml(page, structure, options, '../');
        const fileName = `${htmlGenerator.sanitizeFilename(page.title)}.html`;
        await fs.writeFile(path.join(htmlDir, fileName), html, 'utf-8');
    }

    /**
     * Copy resources from session to export directory
     */
    async function copyResources(sessionPath: string, exportDir: string): Promise<void> {
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
     */
    async function copyThemeFiles(exportDir: string, themeName: string = 'base'): Promise<void> {
        const themeSourceDir = path.join(getCwd(), 'public', 'files', 'perm', 'themes', 'base', themeName);
        const themeDestDir = path.join(exportDir, 'theme');

        if (DEBUG) console.log(`[Html5Export] Copying theme "${themeName}" from ${themeSourceDir}`);

        await fs.ensureDir(themeDestDir);

        if (await fs.pathExists(themeSourceDir)) {
            // Copy style.css preserving original name (issue #905)
            const cssSource = path.join(themeSourceDir, 'style.css');
            if (await fs.pathExists(cssSource)) {
                await fs.copy(cssSource, path.join(themeDestDir, 'style.css'));
            }

            // Copy style.js preserving original name (issue #905)
            const jsSource = path.join(themeSourceDir, 'style.js');
            if (await fs.pathExists(jsSource)) {
                await fs.copy(jsSource, path.join(themeDestDir, 'style.js'));
            }

            // Copy other theme files (config.xml, icons/, img/)
            const otherFiles = ['config.xml', 'icons', 'img'];
            for (const file of otherFiles) {
                const src = path.join(themeSourceDir, file);
                if (await fs.pathExists(src)) {
                    await fs.copy(src, path.join(themeDestDir, file));
                }
            }

            if (DEBUG) console.log(`[Html5Export] Theme "${themeName}" copied successfully`);
        } else {
            console.warn(`[Html5Export] Theme not found: ${themeSourceDir}, using fallback styles`);
        }
    }

    /**
     * Detect theme-specific favicon
     */
    async function detectFavicon(themeName: string): Promise<{ path: string; type: string } | null> {
        const themeSourceDir = path.join(getCwd(), 'public', 'files', 'perm', 'themes', 'base', themeName);

        // Check for theme-specific favicon in img folder
        const faviconIco = path.join(themeSourceDir, 'img', 'favicon.ico');
        if (await fs.pathExists(faviconIco)) {
            return { path: 'theme/img/favicon.ico', type: 'image/x-icon' };
        }

        const faviconPng = path.join(themeSourceDir, 'img', 'favicon.png');
        if (await fs.pathExists(faviconPng)) {
            return { path: 'theme/img/favicon.png', type: 'image/png' };
        }

        return null;
    }

    /**
     * Create basic assets referenced by the HTML generator
     */
    async function createBasicAssets(exportDir: string): Promise<void> {
        // Base CSS - minimal fallback, main styles come from theme/style.css
        const baseCss = `/* Base CSS fallback - See theme/style.css for main styles */
body { font-family: sans-serif; margin: 0; padding: 0; }
`;
        await fs.writeFile(path.join(exportDir, 'base.css'), baseCss);
        await fs.writeFile(path.join(exportDir, 'content.css'), '/* Additional content styles */');

        // Basic JS placeholders
        await fs.writeFile(path.join(exportDir, 'exe_jquery.js'), '// jQuery placeholder');
        await fs.writeFile(path.join(exportDir, 'common_i18n.js'), '// i18n placeholder');
        await fs.writeFile(path.join(exportDir, 'common.js'), '// common.js placeholder');
        await fs.writeFile(path.join(exportDir, '_style_js.js'), '// Style JS placeholder');

        // Favicon
        const faviconSrc = path.join(getCwd(), 'public', 'favicon.ico');
        const faviconDest = path.join(exportDir, 'favicon.ico');
        if (await fs.pathExists(faviconSrc)) {
            await fs.copy(faviconSrc, faviconDest);
        }
    }

    /**
     * Generate HTML5 files in export directory
     */
    async function generateHtml5Files(
        exportDir: string,
        structure: ParsedOdeStructure,
        sessionPath: string,
        options: Html5ExportOptions,
    ): Promise<void> {
        // Detect theme favicon
        const themeName = structure.meta?.theme || 'base';
        const favicon = await detectFavicon(themeName);
        if (favicon) {
            options.faviconPath = favicon.path;
            options.faviconType = favicon.type;
        }

        // Generate index.html
        await generateIndexHtml(exportDir, structure, options);

        // Generate page HTML files (skip first page as it is index.html)
        for (let i = 1; i < structure.pages.length; i++) {
            await generatePageHtml(exportDir, structure.pages[i], structure, options);
        }

        // Copy resources
        await copyResources(sessionPath, exportDir);

        // Copy theme files
        await copyThemeFiles(exportDir, themeName);

        // Create basic assets (CSS/JS) referenced by the generator
        await createBasicAssets(exportDir);
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Export session to HTML5 format (ZIP download or preview directory)
     */
    async function exportToHtml5(odeSessionId: string, options: Html5ExportOptions = {}): Promise<ExportResult> {
        try {
            const isPreview = options.preview === true;
            if (DEBUG) {
                console.log(
                    `[Html5Export] Exporting session ${odeSessionId} to HTML5 (${isPreview ? 'preview' : 'download'} mode)`,
                );
            }

            // Get session
            const session = getSession(odeSessionId);
            if (!session) {
                throw new Error(`Session not found: ${odeSessionId}`);
            }

            // Use temp path for export - use custom tempPath if provided (for tests)
            const exportDir = options.tempPath
                ? getTempPath(options.tempPath)
                : getTempPath(`html5-export-${odeSessionId}`);
            if (DEBUG) console.log(`[Html5Export] Export directory: ${exportDir}`);

            await fs.ensureDir(exportDir);

            // Generate HTML5 files
            await generateHtml5Files(exportDir, session.structure, session.sessionPath, options);

            // Preview mode: return directory path without zipping
            if (isPreview) {
                console.log(`[Html5Export] Successfully generated HTML5 preview at ${exportDir}`);
                return {
                    filePath: exportDir,
                    fileName: `${session.structure.meta.title || 'export'}_html5`,
                    fileSize: 0,
                    format: ExportFormat.HTML5,
                    success: true,
                };
            }

            // Download mode: create ZIP and cleanup
            try {
                const zipPath = `${exportDir}.zip`;
                await createZip(exportDir, zipPath, {
                    compressionLevel: options.compressionLevel || 9,
                });

                // Get file size
                const stats = await fs.stat(zipPath);

                console.log(`[Html5Export] Successfully exported HTML5 to ${zipPath}`);

                return {
                    filePath: zipPath,
                    fileName: `${session.structure.meta.title || 'export'}_html5.zip`,
                    fileSize: stats.size,
                    format: ExportFormat.HTML5,
                    success: true,
                };
            } finally {
                // Cleanup temp directory (only in download mode)
                await fs.remove(exportDir);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Html5Export] Failed to export HTML5: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Export download - convenience wrapper
     */
    async function exportDownload(sessionId: string, compressionLevel: number = 9): Promise<ExportResult> {
        return exportToHtml5(sessionId, {
            compressionLevel,
        });
    }

    // ========================================================================
    // Return Html5ExportService Interface
    // ========================================================================

    return {
        exportToHtml5,
        exportDownload,
    };
}

// ============================================================================
// Default Instance (for backwards compatibility)
// ============================================================================

const defaultService = createHtml5ExportService();

// Export all functions from the default instance for backwards compatibility
export const exportToHtml5 = defaultService.exportToHtml5;
export const exportDownload = defaultService.exportDownload;

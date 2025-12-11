import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ExportFormatType } from '../interfaces/export-strategy.interface';
import {
    EXPORT_DIRS,
    BASE_FILES,
    SCHEMA_PATHS,
    SCORM12,
} from '../constants/export.constants';

/**
 * Asset copy options
 */
export interface AssetCopyOptions {
    /** Export format */
    format: ExportFormatType;

    /** Include SCORM JavaScript files */
    includeScormJs?: boolean;

    /** Include schema files */
    includeSchemas?: boolean;

    /** Theme name/path */
    theme?: string;

    /** Custom CSS content */
    customCss?: string;
}

/**
 * Service responsible for copying assets to export directories
 */
@Injectable()
export class AssetCopierService {
    private readonly logger = new Logger(AssetCopierService.name);
    private readonly publicPath: string;

    constructor(private readonly configService: ConfigService) {
        // Path to public directory containing assets
        this.publicPath = path.join(process.cwd(), 'public');
    }

    /**
     * Copy all required base assets to export directory
     * @param exportDir Export directory path
     * @param options Copy options
     */
    async copyBaseAssets(
        exportDir: string,
        options: AssetCopyOptions,
    ): Promise<void> {
        this.logger.debug(`Copying base assets to ${exportDir}`);

        // Create libs directory
        const libsDir = path.join(exportDir, EXPORT_DIRS.LIBS);
        await fs.ensureDir(libsDir);

        // Copy JavaScript files
        await this.copyJavaScriptLibraries(libsDir, options);

        // Copy CSS files
        await this.copyCssFiles(exportDir, options);

        // Copy SCORM-specific files if needed
        if (
            options.format === ExportFormatType.SCORM12 ||
            options.includeScormJs
        ) {
            await this.copyScormFiles(libsDir);
        }

        // Copy schema files if needed
        if (
            options.includeSchemas &&
            (options.format === ExportFormatType.SCORM12 ||
                options.format === ExportFormatType.IMS)
        ) {
            await this.copySchemaFiles(exportDir, options.format);
        }
    }

    /**
     * Copy JavaScript libraries to libs directory
     */
    private async copyJavaScriptLibraries(
        libsDir: string,
        options: AssetCopyOptions,
    ): Promise<void> {
        const jsSourceDir = path.join(this.publicPath, 'libs');

        // Copy jQuery
        const jquerySource = path.join(jsSourceDir, 'jquery', 'jquery.min.js');
        const jqueryDest = path.join(libsDir, 'exe_jquery.js');
        if (await fs.pathExists(jquerySource)) {
            await fs.copyFile(jquerySource, jqueryDest);
        } else {
            // Write placeholder if not found
            await fs.writeFile(jqueryDest, '// jQuery library');
        }

        // Copy common JS files
        const commonSource = path.join(this.publicPath, 'app', 'common');
        if (await fs.pathExists(commonSource)) {
            const commonJsSource = path.join(commonSource, 'common.js');
            if (await fs.pathExists(commonJsSource)) {
                await fs.copyFile(commonJsSource, path.join(libsDir, 'common.js'));
            }

            const i18nSource = path.join(commonSource, 'common_i18n.js');
            if (await fs.pathExists(i18nSource)) {
                await fs.copyFile(i18nSource, path.join(libsDir, 'common_i18n.js'));
            }
        }

        // Create placeholder files if they don't exist
        const requiredFiles = ['common.js', 'common_i18n.js'];
        for (const file of requiredFiles) {
            const filePath = path.join(libsDir, file);
            if (!(await fs.pathExists(filePath))) {
                await fs.writeFile(filePath, `// ${file} placeholder`);
            }
        }
    }

    /**
     * Copy CSS files to export directory
     */
    private async copyCssFiles(
        exportDir: string,
        options: AssetCopyOptions,
    ): Promise<void> {
        // Base CSS
        const baseCss = `
/* Base styles for eXeLearning export */
body { font-family: sans-serif; margin: 0; padding: 0; }
#content { display: flex; flex-direction: column; min-height: 100vh; }
#header { background: #eee; padding: 20px; }
#headerContent { font-size: 1.5em; font-weight: bold; }
#siteNav { background: #333; color: #fff; padding: 20px; width: 250px; }
#siteNav ul { list-style: none; margin: 0; padding: 0; }
#siteNav a { color: #fff; text-decoration: none; display: block; padding: 5px 0; }
#siteNav a:hover, #siteNav .active { text-decoration: underline; }
#main { padding: 20px; flex: 1; }
#nodeDecoration h1 { margin-top: 0; }
.iDevice_wrapper { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
.iDevice_content { line-height: 1.6; }
.pagination { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ccc; }
.pagination a { margin-right: 15px; text-decoration: none; }
.pagination a:hover { text-decoration: underline; }
#packageLicense { margin-top: 20px; padding: 10px; background: #f5f5f5; font-size: 0.9em; }
`;
        await fs.writeFile(path.join(exportDir, 'base.css'), baseCss);

        // Content CSS (placeholder or from theme)
        let contentCss = '/* Content-specific styles */';
        if (options.customCss) {
            contentCss = options.customCss;
        }
        await fs.writeFile(path.join(exportDir, 'content.css'), contentCss);

        // Style JS placeholder
        await fs.writeFile(
            path.join(exportDir, '_style_js.js'),
            '// Style JavaScript placeholder\n',
        );
    }

    /**
     * Copy SCORM-specific JavaScript files
     */
    private async copyScormFiles(libsDir: string): Promise<void> {
        this.logger.debug('Copying SCORM JavaScript files');

        // SCORM API Wrapper
        const scormApiContent = this.getScormApiWrapper();
        await fs.writeFile(
            path.join(libsDir, 'SCORM_API_wrapper.js'),
            scormApiContent,
        );

        // SCO Functions
        const scoFunctionsContent = this.getScoFunctions();
        await fs.writeFile(
            path.join(libsDir, 'SCOFunctions.js'),
            scoFunctionsContent,
        );
    }

    /**
     * Copy schema files for SCORM or IMS
     */
    private async copySchemaFiles(
        exportDir: string,
        format: ExportFormatType,
    ): Promise<void> {
        this.logger.debug(`Copying schema files for ${format}`);

        let schemaConfig: { BASE: string; FILES: readonly string[] };

        if (format === ExportFormatType.SCORM12) {
            schemaConfig = SCHEMA_PATHS.SCORM12;
        } else if (format === ExportFormatType.IMS) {
            schemaConfig = SCHEMA_PATHS.IMS;
        } else {
            return;
        }

        // Try to copy from public/app/schemas
        const schemasSourceDir = path.join(
            this.publicPath,
            'app',
            schemaConfig.BASE,
        );

        if (await fs.pathExists(schemasSourceDir)) {
            for (const schemaFile of schemaConfig.FILES) {
                const sourceFile = path.join(schemasSourceDir, schemaFile);
                const destFile = path.join(exportDir, schemaFile);

                if (await fs.pathExists(sourceFile)) {
                    await fs.copyFile(sourceFile, destFile);
                } else {
                    this.logger.warn(`Schema file not found: ${sourceFile}`);
                }
            }
        } else {
            this.logger.warn(`Schema directory not found: ${schemasSourceDir}`);
        }
    }

    /**
     * Copy theme assets to export directory
     * @param exportDir Export directory path
     * @param themeName Theme name or path
     */
    async copyThemeAssets(exportDir: string, themeName?: string): Promise<void> {
        if (!themeName) {
            this.logger.debug('No theme specified, skipping theme copy');
            return;
        }

        this.logger.debug(`Copying theme assets: ${themeName}`);

        const themeDir = path.join(exportDir, EXPORT_DIRS.THEME);
        await fs.ensureDir(themeDir);

        // Look for theme in public/app/themes
        const themeSourceDir = path.join(
            this.publicPath,
            'app',
            'themes',
            themeName,
        );

        if (await fs.pathExists(themeSourceDir)) {
            await fs.copy(themeSourceDir, themeDir);
        } else {
            this.logger.warn(`Theme not found: ${themeName}`);
        }
    }

    /**
     * Copy iDevice assets (CSS/JS) to export directory
     * @param exportDir Export directory path
     * @param ideviceTypes Array of iDevice type names used in the project
     */
    async copyIdeviceAssets(
        exportDir: string,
        ideviceTypes: string[],
    ): Promise<void> {
        this.logger.debug(`Copying iDevice assets for: ${ideviceTypes.join(', ')}`);

        const idevicesDir = path.join(exportDir, EXPORT_DIRS.IDEVICES);
        await fs.ensureDir(idevicesDir);

        const idevicesSourceDir = path.join(this.publicPath, 'app', 'idevices');

        if (!(await fs.pathExists(idevicesSourceDir))) {
            this.logger.warn('iDevices source directory not found');
            return;
        }

        for (const ideviceType of ideviceTypes) {
            const sourceDir = path.join(idevicesSourceDir, ideviceType);
            const destDir = path.join(idevicesDir, ideviceType);

            if (await fs.pathExists(sourceDir)) {
                await fs.copy(sourceDir, destDir);
            }
        }
    }

    /**
     * Copy project resources from session to export
     * @param sessionPath Session directory path
     * @param exportDir Export directory path
     * @param excludePatterns Patterns to exclude
     */
    async copyProjectResources(
        sessionPath: string,
        exportDir: string,
        excludePatterns: string[] = [],
    ): Promise<void> {
        this.logger.debug(`Copying project resources from ${sessionPath}`);

        const defaultExcludes = [
            'content.xml',
            'contentv3.xml',
            'export',
            'preview',
            '.DS_Store',
            'Thumbs.db',
        ];

        const excludes = [...defaultExcludes, ...excludePatterns];

        if (!(await fs.pathExists(sessionPath))) {
            this.logger.warn(`Session path not found: ${sessionPath}`);
            return;
        }

        const entries = await fs.readdir(sessionPath);

        for (const entry of entries) {
            if (excludes.includes(entry)) continue;

            const sourcePath = path.join(sessionPath, entry);
            const destPath = path.join(exportDir, entry);

            // Safety check
            if (exportDir.startsWith(sourcePath)) continue;

            const stats = await fs.stat(sourcePath);
            if (stats.isDirectory()) {
                await fs.copy(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }

    /**
     * Get list of files in export directory recursively
     */
    async getExportFileList(exportDir: string): Promise<string[]> {
        const files: string[] = [];

        const walkDir = async (dir: string, basePath: string): Promise<void> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(basePath, fullPath);

                if (entry.isDirectory()) {
                    await walkDir(fullPath, basePath);
                } else {
                    files.push(relativePath.replace(/\\/g, '/'));
                }
            }
        };

        await walkDir(exportDir, exportDir);
        return files.sort();
    }

    /**
     * Get SCORM API Wrapper JavaScript content
     */
    private getScormApiWrapper(): string {
        return `/*
 * SCORM API Wrapper for eXeLearning
 * Based on the ADL SCORM Reference Implementation
 */

var SCORM_API = null;
var SCORM_INITIALIZED = false;

function findAPI(win) {
    var findAPITries = 0;
    while ((win.API == null) && (win.parent != null) && (win.parent != win)) {
        findAPITries++;
        if (findAPITries > 7) {
            return null;
        }
        win = win.parent;
    }
    return win.API;
}

function getAPI() {
    var theAPI = findAPI(window);
    if ((theAPI == null) && (window.opener != null) && (typeof(window.opener) != "undefined")) {
        theAPI = findAPI(window.opener);
    }
    return theAPI;
}

function initializeSCORM() {
    SCORM_API = getAPI();
    if (SCORM_API != null) {
        var result = SCORM_API.LMSInitialize("");
        SCORM_INITIALIZED = (result.toString() == "true");
        return SCORM_INITIALIZED;
    }
    return false;
}

function terminateSCORM() {
    if (SCORM_API != null && SCORM_INITIALIZED) {
        SCORM_API.LMSFinish("");
        SCORM_INITIALIZED = false;
    }
}

function setScore(score) {
    if (SCORM_API != null && SCORM_INITIALIZED) {
        SCORM_API.LMSSetValue("cmi.core.score.raw", score);
        SCORM_API.LMSCommit("");
    }
}

function setLessonStatus(status) {
    if (SCORM_API != null && SCORM_INITIALIZED) {
        SCORM_API.LMSSetValue("cmi.core.lesson_status", status);
        SCORM_API.LMSCommit("");
    }
}

function setSessionTime(time) {
    if (SCORM_API != null && SCORM_INITIALIZED) {
        SCORM_API.LMSSetValue("cmi.core.session_time", time);
        SCORM_API.LMSCommit("");
    }
}

// Auto-initialize on load
if (window.addEventListener) {
    window.addEventListener("load", initializeSCORM, false);
    window.addEventListener("unload", terminateSCORM, false);
} else if (window.attachEvent) {
    window.attachEvent("onload", initializeSCORM);
    window.attachEvent("onunload", terminateSCORM);
}
`;
    }

    /**
     * Get SCO Functions JavaScript content
     */
    private getScoFunctions(): string {
        return `/*
 * SCO Functions for eXeLearning SCORM export
 */

var startTime = new Date();

function getTimeSpent() {
    var now = new Date();
    var diff = now - startTime;
    var hours = Math.floor(diff / 3600000);
    var minutes = Math.floor((diff % 3600000) / 60000);
    var seconds = Math.floor((diff % 60000) / 1000);
    return padNumber(hours, 2) + ":" + padNumber(minutes, 2) + ":" + padNumber(seconds, 2);
}

function padNumber(num, size) {
    var s = "000000" + num;
    return s.substr(s.length - size);
}

function markComplete() {
    if (typeof setLessonStatus === 'function') {
        setLessonStatus("completed");
    }
}

function markIncomplete() {
    if (typeof setLessonStatus === 'function') {
        setLessonStatus("incomplete");
    }
}

function markPassed() {
    if (typeof setLessonStatus === 'function') {
        setLessonStatus("passed");
    }
}

function markFailed() {
    if (typeof setLessonStatus === 'function') {
        setLessonStatus("failed");
    }
}

function saveScore(score) {
    if (typeof setScore === 'function') {
        setScore(score);
    }
}

function saveSessionTime() {
    if (typeof setSessionTime === 'function') {
        setSessionTime(getTimeSpent());
    }
}

// Save session time on unload
if (window.addEventListener) {
    window.addEventListener("beforeunload", saveSessionTime, false);
} else if (window.attachEvent) {
    window.attachEvent("onbeforeunload", saveSessionTime);
}
`;
    }
}

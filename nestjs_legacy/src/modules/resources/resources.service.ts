import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';

/**
 * File info returned by the resources API
 */
export interface ResourceFile {
    /** Relative path within the resource */
    path: string;
    /** Full URL to fetch the file */
    url: string;
    /** File size in bytes */
    size: number;
    /** MIME type */
    mimeType: string;
}

/**
 * Resources Service
 * Provides file lists for themes, iDevices, and libraries used by client-side exports.
 */
@Injectable()
export class ResourcesService {
    private readonly logger = new Logger(ResourcesService.name);
    private readonly publicPath: string;

    constructor(private readonly configService: ConfigService) {
        this.publicPath = path.join(process.cwd(), 'public');
    }

    /**
     * Get list of files for a theme
     */
    async getThemeFileList(themeName: string): Promise<ResourceFile[]> {
        this.logger.debug(`Getting file list for theme: ${themeName}`);

        // Look for theme in multiple locations
        const themeLocations = [
            path.join(this.publicPath, 'files', 'perm', 'themes', 'base', themeName),
            path.join(this.publicPath, 'app', 'themes', themeName),
        ];

        let themeDir: string | null = null;
        for (const location of themeLocations) {
            if (await fs.pathExists(location)) {
                themeDir = location;
                break;
            }
        }

        if (!themeDir) {
            this.logger.warn(`Theme not found: ${themeName}`);
            throw new NotFoundException(`Theme not found: ${themeName}`);
        }

        const files = await this.walkDirectory(themeDir);
        return files.map(file => ({
            path: path.relative(themeDir!, file.path).replace(/\\/g, '/'),
            url: this.pathToUrl(file.path),
            size: file.size,
            mimeType: this.getMimeType(file.path),
        }));
    }

    /**
     * Get list of files for an iDevice
     */
    async getIdeviceFileList(ideviceType: string): Promise<ResourceFile[]> {
        this.logger.debug(`Getting file list for iDevice: ${ideviceType}`);

        const ideviceLocations = [
            path.join(this.publicPath, 'files', 'perm', 'idevices', 'base', ideviceType),
            path.join(this.publicPath, 'app', 'idevices', ideviceType),
        ];

        let ideviceDir: string | null = null;
        for (const location of ideviceLocations) {
            if (await fs.pathExists(location)) {
                ideviceDir = location;
                break;
            }
        }

        if (!ideviceDir) {
            // Many iDevices don't have additional files - return empty list
            this.logger.debug(`iDevice directory not found: ${ideviceType}`);
            throw new NotFoundException(`iDevice not found: ${ideviceType}`);
        }

        const files = await this.walkDirectory(ideviceDir);
        return files.map(file => ({
            path: path.relative(ideviceDir!, file.path).replace(/\\/g, '/'),
            url: this.pathToUrl(file.path),
            size: file.size,
            mimeType: this.getMimeType(file.path),
        }));
    }

    /**
     * Get list of base library files (jQuery, common.js, etc.)
     */
    async getBaseLibraryList(): Promise<ResourceFile[]> {
        this.logger.debug('Getting base library file list');

        const files: ResourceFile[] = [];

        // jQuery
        const jqueryPath = path.join(this.publicPath, 'libs', 'jquery', 'jquery.min.js');
        if (await fs.pathExists(jqueryPath)) {
            const stats = await fs.stat(jqueryPath);
            files.push({
                path: 'exe_jquery.js',
                url: '/libs/jquery/jquery.min.js',
                size: stats.size,
                mimeType: 'application/javascript',
            });
        }

        // Common JS files
        const commonFiles = [
            { src: 'app/common/common.js', dest: 'common.js' },
            { src: 'app/common/common_i18n.js', dest: 'common_i18n.js' },
        ];

        for (const commonFile of commonFiles) {
            const filePath = path.join(this.publicPath, commonFile.src);
            if (await fs.pathExists(filePath)) {
                const stats = await fs.stat(filePath);
                files.push({
                    path: commonFile.dest,
                    url: `/${commonFile.src}`,
                    size: stats.size,
                    mimeType: 'application/javascript',
                });
            }
        }

        // Bootstrap files (if needed)
        const bootstrapFiles = [
            { src: 'libs/bootstrap/bootstrap.bundle.min.js', dest: 'bootstrap.bundle.min.js' },
            { src: 'libs/bootstrap/bootstrap.min.css', dest: 'bootstrap.min.css' },
        ];

        for (const bsFile of bootstrapFiles) {
            const filePath = path.join(this.publicPath, bsFile.src);
            if (await fs.pathExists(filePath)) {
                const stats = await fs.stat(filePath);
                files.push({
                    path: bsFile.dest,
                    url: `/${bsFile.src}`,
                    size: stats.size,
                    mimeType: bsFile.dest.endsWith('.js')
                        ? 'application/javascript'
                        : 'text/css',
                });
            }
        }

        return files;
    }

    /**
     * Get list of SCORM JavaScript files
     */
    async getScormLibraryList(): Promise<ResourceFile[]> {
        this.logger.debug('Getting SCORM library file list');

        const files: ResourceFile[] = [];
        const scormDir = path.join(this.publicPath, 'app', 'common', 'scorm');

        if (!(await fs.pathExists(scormDir))) {
            this.logger.warn('SCORM directory not found');
            return files;
        }

        const scormFiles = ['SCORM_API_wrapper.js', 'SCOFunctions.js'];

        for (const filename of scormFiles) {
            const filePath = path.join(scormDir, filename);
            if (await fs.pathExists(filePath)) {
                const stats = await fs.stat(filePath);
                files.push({
                    path: filename,
                    url: `/app/common/scorm/${filename}`,
                    size: stats.size,
                    mimeType: 'application/javascript',
                });
            }
        }

        return files;
    }

    /**
     * Get list of EPUB-specific files
     */
    async getEpubLibraryList(): Promise<ResourceFile[]> {
        this.logger.debug('Getting EPUB library file list');

        const files: ResourceFile[] = [];
        const epubDir = path.join(this.publicPath, 'app', 'schemas', 'epub3');

        if (!(await fs.pathExists(epubDir))) {
            this.logger.warn('EPUB schemas directory not found');
            return files;
        }

        // Add container.xml and mimetype templates
        const epubFiles = await this.walkDirectory(epubDir);
        return epubFiles.map(file => ({
            path: path.relative(epubDir, file.path).replace(/\\/g, '/'),
            url: `/app/schemas/epub3/${path.relative(epubDir, file.path).replace(/\\/g, '/')}`,
            size: file.size,
            mimeType: this.getMimeType(file.path),
        }));
    }

    /**
     * Get list of schema files for a specific format
     */
    async getSchemaFileList(format: string): Promise<ResourceFile[]> {
        this.logger.debug(`Getting schema file list for format: ${format}`);

        const schemaDir = path.join(this.publicPath, 'app', 'schemas', format);

        if (!(await fs.pathExists(schemaDir))) {
            this.logger.warn(`Schema directory not found: ${format}`);
            throw new NotFoundException(`Schema directory not found: ${format}`);
        }

        const files = await this.walkDirectory(schemaDir);
        return files.map(file => ({
            path: path.relative(schemaDir, file.path).replace(/\\/g, '/'),
            url: `/app/schemas/${format}/${path.relative(schemaDir, file.path).replace(/\\/g, '/')}`,
            size: file.size,
            mimeType: this.getMimeType(file.path),
        }));
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    /**
     * Walk a directory recursively and return all files
     */
    private async walkDirectory(
        dir: string,
    ): Promise<Array<{ path: string; size: number }>> {
        const files: Array<{ path: string; size: number }> = [];

        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            // Skip hidden files and directories
            if (entry.name.startsWith('.')) continue;

            if (entry.isDirectory()) {
                const subFiles = await this.walkDirectory(fullPath);
                files.push(...subFiles);
            } else {
                const stats = await fs.stat(fullPath);
                files.push({ path: fullPath, size: stats.size });
            }
        }

        return files;
    }

    /**
     * Convert absolute path to URL
     */
    private pathToUrl(absolutePath: string): string {
        const relativePath = path.relative(this.publicPath, absolutePath);
        return '/' + relativePath.replace(/\\/g, '/');
    }

    /**
     * Get MIME type from file extension
     */
    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.htm': 'text/html',
            '.xhtml': 'application/xhtml+xml',
            '.xml': 'application/xml',
            '.xsd': 'application/xml',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.txt': 'text/plain',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

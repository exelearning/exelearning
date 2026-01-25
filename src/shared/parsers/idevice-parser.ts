/**
 * Shared iDevice Config Parser
 *
 * Parses iDevice config.xml files. Used by:
 * - Server routes (src/routes/idevices.ts)
 * - Static build script (scripts/build-static-bundle.ts)
 *
 * @module shared/parsers/idevice-parser
 */

/**
 * iDevice icon structure
 */
export interface IdeviceIcon {
    name: string;
    url: string;
    type: string;
}

/**
 * Parsed iDevice configuration
 */
export interface IdeviceConfig {
    id: string;
    name: string;
    title: string;
    cssClass: string;
    category: string;
    icon: IdeviceIcon;
    version: string;
    apiVersion: string;
    componentType: string;
    author: string;
    authorUrl: string;
    license: string;
    licenseUrl: string;
    description: string;
    downloadable: boolean;
    url: string;
    editionJs: string[];
    editionCss: string[];
    exportJs: string[];
    exportCss: string[];
    editionTemplateFilename: string;
    exportTemplateFilename: string;
    editionTemplateContent: string;
    exportTemplateContent: string;
    exportObject: string;
    location: string;
    locationType: string;
}

/**
 * File system abstraction for testing and platform independence
 */
export interface FileSystemReader {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: 'utf-8'): string;
    readdirSync(path: string): string[];
}

/**
 * Path utilities abstraction
 */
export interface PathUtils {
    join(...paths: string[]): string;
    extname(path: string): string;
    basename(path: string, ext?: string): string;
}

/**
 * Options for parsing iDevice config
 */
export interface ParseIdeviceOptions {
    /** The iDevice directory name (used as ID) */
    ideviceId: string;
    /** Base path to the iDevice directory */
    basePath: string;
    /** URL prefix for the iDevice (defaults to `/files/perm/idevices/base/{id}`) */
    urlPrefix?: string;
    /** File system reader (defaults to Node's fs) */
    fs?: FileSystemReader;
    /** Path utilities (defaults to Node's path) */
    path?: PathUtils;
}

/**
 * Extract a simple XML tag value
 */
function getValue(xmlContent: string, tag: string): string {
    const match = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1].trim() : '';
}

/**
 * Extract a nested XML tag value
 */
function getNestedValue(xmlContent: string, parent: string, child: string): string {
    const parentMatch = xmlContent.match(new RegExp(`<${parent}>([\\s\\S]*?)<\\/${parent}>`));
    if (!parentMatch) return '';
    const childMatch = parentMatch[1].match(new RegExp(`<${child}>([\\s\\S]*?)<\\/${child}>`));
    return childMatch ? childMatch[1].trim() : '';
}

/**
 * Read template file content safely
 */
function readTemplateContent(
    basePath: string,
    folder: string,
    filename: string,
    fs: FileSystemReader,
    pathUtils: PathUtils,
): string {
    if (!filename) return '';
    try {
        const templatePath = pathUtils.join(basePath, folder, filename);
        if (fs.existsSync(templatePath)) {
            return fs.readFileSync(templatePath, 'utf-8');
        }
    } catch {
        // Ignore errors, return empty string
    }
    return '';
}

/**
 * Parse list of filenames and verify they exist on disk
 */
function getValidFilenames(
    xmlContent: string,
    tag: string,
    subfolder: 'edition' | 'export',
    ideviceId: string,
    basePath: string,
    fs: FileSystemReader,
    pathUtils: PathUtils,
): string[] {
    const parentMatch = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    const extension = tag.includes('js') ? '.js' : '.css';

    let filenames: string[];
    if (!parentMatch) {
        // No explicit files specified - scan folder for all matching files
        const folderPath = pathUtils.join(basePath, subfolder);
        if (fs.existsSync(folderPath)) {
            try {
                filenames = fs
                    .readdirSync(folderPath)
                    .filter(
                        (file: string) =>
                            file.endsWith(extension) && !file.includes('.test.') && !file.includes('.spec.'),
                    )
                    .sort((a: string, b: string) => {
                        // Put main iDevice file first, then alphabetically
                        if (a === `${ideviceId}${extension}`) return -1;
                        if (b === `${ideviceId}${extension}`) return 1;
                        return a.localeCompare(b);
                    });
            } catch {
                filenames = [`${ideviceId}${extension}`];
            }
        } else {
            filenames = [`${ideviceId}${extension}`];
        }
    } else {
        filenames = [];
        const filenameMatches = parentMatch[1].matchAll(/<filename>([^<]+)<\/filename>/g);
        for (const match of filenameMatches) {
            filenames.push(match[1].trim());
        }
        if (filenames.length === 0) {
            filenames = [`${ideviceId}.${tag.includes('js') ? 'js' : 'css'}`];
        }
    }

    // Filter to only include files that actually exist on disk
    return filenames.filter((filename: string) => {
        const filePath = pathUtils.join(basePath, subfolder, filename);
        return fs.existsSync(filePath);
    });
}

/**
 * Parse icon from config.xml content
 */
function parseIcon(xmlContent: string, ideviceId: string): IdeviceIcon {
    const iconContent = getValue(xmlContent, 'icon');

    // Default icon
    let icon: IdeviceIcon = {
        name: `${ideviceId}-icon`,
        url: `${ideviceId}-icon.svg`,
        type: 'img',
    };

    if (iconContent && !iconContent.includes('<')) {
        // Simple icon name (like "lightbulb")
        icon = { name: iconContent, url: iconContent, type: 'icon' };
    } else if (iconContent) {
        // Nested icon structure
        icon = {
            name: getNestedValue(xmlContent, 'icon', 'name') || `${ideviceId}-icon`,
            url: getNestedValue(xmlContent, 'icon', 'url') || `${ideviceId}-icon.svg`,
            type: getNestedValue(xmlContent, 'icon', 'type') || 'img',
        };
    }

    return icon;
}

/**
 * Parse iDevice config.xml content
 *
 * @param xmlContent - The config.xml file content
 * @param options - Parsing options
 * @returns Parsed iDevice configuration or null if parsing fails
 *
 * @example
 * ```typescript
 * import { parseIdeviceConfig } from '@/shared/parsers/idevice-parser';
 * import * as fs from 'fs';
 * import * as path from 'path';
 *
 * const xmlContent = fs.readFileSync('config.xml', 'utf-8');
 * const config = parseIdeviceConfig(xmlContent, {
 *     ideviceId: 'text',
 *     basePath: '/path/to/idevice',
 *     fs: { existsSync: fs.existsSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync },
 *     path: { join: path.join, extname: path.extname, basename: path.basename },
 * });
 * ```
 */
export function parseIdeviceConfig(xmlContent: string, options: ParseIdeviceOptions): IdeviceConfig | null {
    const { ideviceId, basePath, urlPrefix, fs: fsReader, path: pathUtils } = options;

    // Default fs and path if not provided (Node.js)
    const fs = fsReader || {
        existsSync: (_path: string) => false,
        readFileSync: (_path: string, _encoding: 'utf-8') => '',
        readdirSync: (_path: string) => [],
    };
    const path = pathUtils || {
        join: (...paths: string[]) => paths.join('/'),
        extname: (p: string) => {
            const match = p.match(/\.[^.]+$/);
            return match ? match[0] : '';
        },
        basename: (p: string, ext?: string) => {
            const base = p.split('/').pop() || p;
            return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
        },
    };

    try {
        const icon = parseIcon(xmlContent, ideviceId);

        // Get template filenames
        const editionTemplateFilename = getValue(xmlContent, 'edition-template-filename') || '';
        const exportTemplateFilename = getValue(xmlContent, 'export-template-filename') || '';

        // Read template content from files
        const editionTemplateContent = readTemplateContent(basePath, 'edition', editionTemplateFilename, fs, path);
        const exportTemplateContent = readTemplateContent(basePath, 'export', exportTemplateFilename, fs, path);

        // exportObject is the global JS object name used for rendering (e.g., '$text')
        // Can be specified in config.xml or defaults to '$' + ideviceId (without dashes)
        const exportObject = getValue(xmlContent, 'export-object') || `$${ideviceId.split('-').join('')}`;

        // Build URL (default for static mode)
        const url = urlPrefix || `/files/perm/idevices/base/${ideviceId}`;

        return {
            id: ideviceId,
            name: ideviceId,
            title: getValue(xmlContent, 'title') || ideviceId,
            cssClass: getValue(xmlContent, 'css-class') || ideviceId,
            category: getValue(xmlContent, 'category') || 'Uncategorized',
            icon,
            version: getValue(xmlContent, 'version') || '1.0',
            apiVersion: getValue(xmlContent, 'api-version') || '3.0',
            componentType: getValue(xmlContent, 'component-type') || 'html',
            author: getValue(xmlContent, 'author') || '',
            authorUrl: getValue(xmlContent, 'author-url') || '',
            license: getValue(xmlContent, 'license') || '',
            licenseUrl: getValue(xmlContent, 'license-url') || '',
            description: getValue(xmlContent, 'description') || '',
            downloadable: getValue(xmlContent, 'downloadable') === '1',
            url,
            editionJs: getValidFilenames(xmlContent, 'edition-js', 'edition', ideviceId, basePath, fs, path),
            editionCss: getValidFilenames(xmlContent, 'edition-css', 'edition', ideviceId, basePath, fs, path),
            exportJs: getValidFilenames(xmlContent, 'export-js', 'export', ideviceId, basePath, fs, path),
            exportCss: getValidFilenames(xmlContent, 'export-css', 'export', ideviceId, basePath, fs, path),
            editionTemplateFilename,
            exportTemplateFilename,
            editionTemplateContent,
            exportTemplateContent,
            exportObject,
            location: getValue(xmlContent, 'location') || '',
            locationType: getValue(xmlContent, 'location-type') || '',
        };
    } catch {
        return null;
    }
}

/**
 * Parse iDevice config from XML string (simplified version without file system access)
 *
 * Use this when you only have the XML content and don't need to read template files
 * or validate file existence.
 *
 * @param xmlContent - The config.xml file content
 * @param ideviceId - The iDevice directory name
 * @returns Parsed basic iDevice configuration or null if parsing fails
 */
export function parseIdeviceConfigBasic(xmlContent: string, ideviceId: string): Partial<IdeviceConfig> | null {
    try {
        const icon = parseIcon(xmlContent, ideviceId);

        return {
            id: ideviceId,
            name: ideviceId,
            title: getValue(xmlContent, 'title') || ideviceId,
            cssClass: getValue(xmlContent, 'css-class') || ideviceId,
            category: getValue(xmlContent, 'category') || 'Uncategorized',
            icon,
            version: getValue(xmlContent, 'version') || '1.0',
            apiVersion: getValue(xmlContent, 'api-version') || '3.0',
            componentType: getValue(xmlContent, 'component-type') || 'html',
            author: getValue(xmlContent, 'author') || '',
            authorUrl: getValue(xmlContent, 'author-url') || '',
            license: getValue(xmlContent, 'license') || '',
            licenseUrl: getValue(xmlContent, 'license-url') || '',
            description: getValue(xmlContent, 'description') || '',
            downloadable: getValue(xmlContent, 'downloadable') === '1',
            location: getValue(xmlContent, 'location') || '',
            locationType: getValue(xmlContent, 'location-type') || '',
        };
    } catch {
        return null;
    }
}

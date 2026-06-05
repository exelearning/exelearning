/**
 * Shared Theme Config Parser
 *
 * Parses theme config.xml files. Used by:
 * - Server routes (src/routes/themes.ts)
 * - Static build script (scripts/build-static-bundle.ts)
 *
 * @module shared/parsers/theme-parser
 */

/**
 * Theme icon structure expected by the frontend
 */
export interface ThemeIcon {
    id: string;
    title: string;
    type: 'img';
    value: string;
}

/**
 * Parsed theme configuration
 */
export interface ThemeConfig {
    id: string;
    name: string;
    dirName: string;
    displayName: string;
    title: string;
    url: string;
    preview: string;
    type: 'base' | 'site' | 'user';
    version: string;
    compatibility: string;
    author: string;
    authorUrl: string;
    license: string;
    licenseUrl: string;
    description: string;
    downloadable: string;
    cssFiles: string[];
    js: string[];
    icons: Record<string, ThemeIcon>;
    valid: boolean;
    isDefault?: boolean;
}

/**
 * File system abstraction for testing and platform independence
 */
export interface ThemeFileSystemReader {
    existsSync(path: string): boolean;
    readFileSync(path: string, encoding: 'utf-8'): string;
    readdirSync(
        path: string,
        options?: { withFileTypes: boolean },
    ): Array<string | { isFile(): boolean; isDirectory(): boolean; name: string }>;
}

/**
 * Path utilities abstraction
 */
export interface ThemePathUtils {
    join(...paths: string[]): string;
    extname(path: string): string;
    basename(path: string, ext?: string): string;
}

/**
 * Options for parsing theme config
 */
export interface ParseThemeOptions {
    /** The theme directory name (used as ID) */
    themeId: string;
    /** Full path to the theme directory */
    themePath: string;
    /** Theme type: base (bundled), site (admin-uploaded), or user (user-imported) */
    type: 'base' | 'site' | 'user';
    /** URL path to the theme (for building URLs) */
    themeUrl: string;
    /** Preview image URL (defaults to {themeUrl}/preview.png) */
    previewUrl?: string;
    /** File system reader (defaults to Node's fs) */
    fs?: ThemeFileSystemReader;
    /** Path utilities (defaults to Node's path) */
    path?: ThemePathUtils;
}

/**
 * Extract a simple XML tag value
 */
function getValue(xmlContent: string, tag: string): string {
    const match = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    return match ? match[1].trim() : '';
}

/**
 * Scan theme directory for files with given extension
 */
function scanThemeFiles(
    themePath: string,
    extension: string,
    fs: ThemeFileSystemReader,
    pathUtils: ThemePathUtils,
): string[] {
    const files: string[] = [];
    if (!fs.existsSync(themePath)) {
        return files;
    }

    const entries = fs.readdirSync(themePath, { withFileTypes: true });
    for (const entry of entries) {
        if (typeof entry === 'string') {
            // Simple string array
            if (entry.endsWith(extension)) {
                files.push(entry);
            }
        } else if (entry.isFile?.() && entry.name.endsWith(extension)) {
            files.push(entry.name);
        }
    }
    return files;
}

/**
 * Scan theme directory for icon files
 */
function scanThemeIcons(
    themePath: string,
    themeUrl: string,
    fs: ThemeFileSystemReader,
    pathUtils: ThemePathUtils,
): Record<string, ThemeIcon> {
    const icons: Record<string, ThemeIcon> = {};
    const iconsPath = pathUtils.join(themePath, 'icons');

    if (!fs.existsSync(iconsPath)) {
        return icons;
    }

    const entries = fs.readdirSync(iconsPath, { withFileTypes: true });
    for (const entry of entries) {
        const name = typeof entry === 'string' ? entry : entry.name;
        const isFile = typeof entry === 'string' || entry.isFile?.();

        if (
            isFile &&
            (name.endsWith('.png') ||
                name.endsWith('.svg') ||
                name.endsWith('.gif') ||
                name.endsWith('.jpg') ||
                name.endsWith('.jpeg'))
        ) {
            const ext = pathUtils.extname(name);
            const iconId = pathUtils.basename(name, ext);
            icons[iconId] = {
                id: iconId,
                title: iconId,
                type: 'img',
                value: `${themeUrl}/icons/${name}`,
            };
        }
    }
    return icons;
}

/**
 * Parse theme config.xml content
 *
 * @param xmlContent - The config.xml file content
 * @param options - Parsing options
 * @returns Parsed theme configuration or null if parsing fails
 *
 * @example
 * ```typescript
 * import { parseThemeConfig } from '@/shared/parsers/theme-parser';
 * import * as fs from 'fs';
 * import * as path from 'path';
 *
 * const xmlContent = fs.readFileSync('config.xml', 'utf-8');
 * const config = parseThemeConfig(xmlContent, {
 *     themeId: 'base',
 *     themePath: '/path/to/theme',
 *     type: 'base',
 *     themeUrl: '/files/perm/themes/base/base',
 *     fs: { existsSync: fs.existsSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync },
 *     path: { join: path.join, extname: path.extname, basename: path.basename },
 * });
 * ```
 */
export function parseThemeConfig(xmlContent: string, options: ParseThemeOptions): ThemeConfig | null {
    const { themeId, themePath, type, themeUrl, previewUrl, fs: fsReader, path: pathUtils } = options;

    // Default fs and path if not provided
    const fs: ThemeFileSystemReader = fsReader || {
        existsSync: (_path: string) => false,
        readFileSync: (_path: string, _encoding: 'utf-8') => '',
        readdirSync: (_path: string, _options?: { withFileTypes: boolean }) => [],
    };
    const path: ThemePathUtils = pathUtils || {
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
        const name = getValue(xmlContent, 'name') || getValue(xmlContent, 'title') || themeId;

        // Scan for CSS files
        let cssFiles = scanThemeFiles(themePath, '.css', fs, path);
        if (cssFiles.length === 0) {
            cssFiles = ['style.css'];
        }

        // Scan for JS files
        const js = scanThemeFiles(themePath, '.js', fs, path);

        // Scan for icons
        const icons = scanThemeIcons(themePath, themeUrl, fs, path);

        return {
            id: themeId,
            name: themeId,
            dirName: themeId,
            displayName: name,
            title: name,
            url: themeUrl,
            preview: previewUrl || `${themeUrl}/preview.png`,
            type,
            version: getValue(xmlContent, 'version') || '1.0',
            compatibility: getValue(xmlContent, 'exe-version') || '3.0',
            author: getValue(xmlContent, 'author') || '',
            authorUrl: getValue(xmlContent, 'author-url') || '',
            license: getValue(xmlContent, 'license') || '',
            licenseUrl: getValue(xmlContent, 'license-url') || '',
            description: getValue(xmlContent, 'description') || '',
            downloadable: getValue(xmlContent, 'downloadable') || '1',
            cssFiles,
            js,
            icons,
            valid: true,
        };
    } catch {
        return null;
    }
}

/**
 * Parse theme config from XML string (simplified version without file system access)
 *
 * Use this when you only have the XML content and don't need to scan for files.
 *
 * @param xmlContent - The config.xml file content
 * @param themeId - The theme directory name
 * @param type - Theme type: base, site, or user
 * @returns Parsed basic theme configuration or null if parsing fails
 */
export function parseThemeConfigBasic(
    xmlContent: string,
    themeId: string,
    type: 'base' | 'site' | 'user' = 'base',
): Partial<ThemeConfig> | null {
    try {
        const name = getValue(xmlContent, 'name') || getValue(xmlContent, 'title') || themeId;

        return {
            id: themeId,
            name: themeId,
            dirName: themeId,
            displayName: name,
            title: name,
            type,
            version: getValue(xmlContent, 'version') || '1.0',
            compatibility: getValue(xmlContent, 'exe-version') || '3.0',
            author: getValue(xmlContent, 'author') || '',
            authorUrl: getValue(xmlContent, 'author-url') || '',
            license: getValue(xmlContent, 'license') || '',
            licenseUrl: getValue(xmlContent, 'license-url') || '',
            description: getValue(xmlContent, 'description') || '',
            downloadable: getValue(xmlContent, 'downloadable') || '1',
            valid: true,
        };
    } catch {
        return null;
    }
}

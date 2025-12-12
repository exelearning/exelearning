/**
 * Themes Routes for Elysia
 * Handles installed themes listing and management
 *
 * Ported from NestJS ThemeService to match frontend expectations
 */
import { Elysia } from 'elysia';
import * as fs from 'fs';
import * as path from 'path';

// Base path for themes
const THEMES_BASE_PATH = 'public/files/perm/themes/base';
const THEMES_USERS_PATH = 'public/files/perm/themes/users';

// Get app version for cache busting URLs
const getAppVersion = (): string => {
    if (process.env.APP_VERSION) {
        return process.env.APP_VERSION;
    }
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
        return `v${packageJson.version}`;
    } catch {
        return 'v0.0.0';
    }
};

interface ThemeIcon {
    id: string;
    title: string;
    type: string;
    value: string;
}

interface ThemeConfig {
    name: string;
    dirName: string;
    displayName: string;
    title: string;
    url: string;
    preview: string;
    type: 'base' | 'user';
    version: string;
    compatibility: string;
    author: string;
    license: string;
    licenseUrl: string;
    description: string;
    downloadable: string;
    cssFiles: string[];
    js: string[];
    icons: Record<string, ThemeIcon>;
    logoImg?: string;
    logoImgUrl?: string;
    headerImg?: string;
    headerImgUrl?: string;
    textColor?: string;
    linkColor?: string;
    valid: boolean;
}

/**
 * Scan theme directory for files with specific extension
 */
function scanThemeFiles(themePath: string, extension: string): string[] {
    try {
        const files: string[] = [];
        if (!fs.existsSync(themePath)) return files;

        const entries = fs.readdirSync(themePath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(extension)) {
                files.push(entry.name);
            }
        }
        return files;
    } catch {
        return [];
    }
}

/**
 * Scan theme directory for icon files
 */
function scanThemeIcons(themePath: string, themeUrl: string): Record<string, ThemeIcon> {
    try {
        const iconsPath = path.join(themePath, 'icons');
        if (!fs.existsSync(iconsPath)) return {};

        const entries = fs.readdirSync(iconsPath, { withFileTypes: true });
        const icons: Record<string, ThemeIcon> = {};

        for (const entry of entries) {
            if (
                entry.isFile() &&
                (entry.name.endsWith('.png') ||
                    entry.name.endsWith('.svg') ||
                    entry.name.endsWith('.gif') ||
                    entry.name.endsWith('.jpg') ||
                    entry.name.endsWith('.jpeg'))
            ) {
                const iconId = path.basename(entry.name, path.extname(entry.name));
                icons[iconId] = {
                    id: iconId,
                    title: iconId,
                    type: 'img',
                    value: `${themeUrl}/icons/${entry.name}`,
                };
            }
        }
        return icons;
    } catch {
        return {};
    }
}

/**
 * Parse theme config.xml
 */
function parseThemeConfig(
    xmlContent: string,
    themeId: string,
    themePath: string,
    type: 'base' | 'user',
): ThemeConfig | null {
    try {
        // Simple XML parsing
        const getValue = (tag: string): string => {
            const match = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
            return match ? match[1].trim() : '';
        };

        const version = getAppVersion();

        // Build URL paths with version for cache busting
        // NOTE: basePath is NOT included here because frontend adds it via symfonyURL in theme.js
        const themeBasePath =
            type === 'base'
                ? `/${version}/files/perm/themes/base/${themeId}`
                : `/${version}/files/perm/themes/users/${themeId}`;

        const previewPath =
            type === 'base' ? `/${version}/style/${themeId}/preview.png` : `${themeBasePath}/preview.png`;

        // Scan for CSS files
        const cssFiles = scanThemeFiles(themePath, '.css');
        if (cssFiles.length === 0) {
            cssFiles.push('style.css');
        }

        // Scan for JS files
        const js = scanThemeFiles(themePath, '.js');

        // Scan for icons
        const icons = scanThemeIcons(themePath, themeBasePath);

        // Build theme config matching NestJS format
        const config: ThemeConfig = {
            name: getValue('name') || themeId,
            dirName: themeId,
            displayName: getValue('title') || getValue('name') || themeId,
            title: getValue('title') || getValue('name') || themeId,
            url: themeBasePath,
            preview: previewPath,
            type: type,
            version: getValue('version') || '1.0',
            compatibility: getValue('compatibility') || '3.0',
            author: getValue('author') || '',
            license: getValue('license') || '',
            licenseUrl: getValue('license-url') || '',
            description: getValue('description') || '',
            downloadable: getValue('downloadable') || '0',
            cssFiles,
            js,
            icons,
            valid: true,
        };

        // Parse logo and header images
        const logoImg = getValue('logo-img');
        if (logoImg) {
            config.logoImg = logoImg;
            config.logoImgUrl = `${themeBasePath}/img/${logoImg}`;
        }

        const headerImg = getValue('header-img');
        if (headerImg) {
            config.headerImg = headerImg;
            config.headerImgUrl = `${themeBasePath}/img/${headerImg}`;
        }

        // Parse color configuration
        const textColor = getValue('text-color');
        if (textColor) {
            config.textColor = textColor;
        }

        const linkColor = getValue('link-color');
        if (linkColor) {
            config.linkColor = linkColor;
        }

        return config;
    } catch {
        return null;
    }
}

/**
 * Scan themes directory and return list
 */
function scanThemes(basePath: string, type: 'base' | 'user'): ThemeConfig[] {
    const themes: ThemeConfig[] = [];

    if (!fs.existsSync(basePath)) {
        return themes;
    }

    const entries = fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
            continue;
        }

        const configPath = path.join(basePath, entry.name, 'config.xml');
        if (fs.existsSync(configPath)) {
            const xmlContent = fs.readFileSync(configPath, 'utf-8');
            const config = parseThemeConfig(xmlContent, entry.name, path.join(basePath, entry.name), type);
            if (config) {
                themes.push(config);
            }
        }
    }

    return themes;
}

/**
 * Themes routes
 */
export const themesRoutes = new Elysia({ name: 'themes-routes' })
    // GET /api/themes/installed - Get list of installed themes
    .get('/api/themes/installed', () => {
        const baseThemes = scanThemes(THEMES_BASE_PATH, 'base');
        const userThemes = scanThemes(THEMES_USERS_PATH, 'user');

        // Combine all themes (no merging - user themes are separate)
        const allThemes = [...baseThemes, ...userThemes];

        // Sort by displayName
        allThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));

        // Frontend expects { themes: [...] } format
        return {
            themes: allThemes,
        };
    })

    // GET /api/themes/installed/:themeId - Get specific theme
    .get('/api/themes/installed/:themeId', ({ params, set }) => {
        const { themeId } = params;

        // Check user themes first
        let configPath = path.join(THEMES_USERS_PATH, themeId, 'config.xml');
        let themePath = path.join(THEMES_USERS_PATH, themeId);
        let type: 'base' | 'user' = 'user';

        if (!fs.existsSync(configPath)) {
            // Fall back to base themes
            configPath = path.join(THEMES_BASE_PATH, themeId, 'config.xml');
            themePath = path.join(THEMES_BASE_PATH, themeId);
            type = 'base';
        }

        if (!fs.existsSync(configPath)) {
            set.status = 404;
            return { error: 'Not Found', message: `Theme ${themeId} not found` };
        }

        const xmlContent = fs.readFileSync(configPath, 'utf-8');
        const config = parseThemeConfig(xmlContent, themeId, themePath, type);

        if (!config) {
            set.status = 500;
            return { error: 'Parse Error', message: 'Failed to parse theme config' };
        }

        return config;
    });

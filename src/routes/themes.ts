/**
 * Themes Routes for Elysia
 * Handles installed themes listing (base and site themes only)
 *
 * User themes imported from .elpx files are stored client-side in Yjs,
 * not on the server. This simplifies the architecture and allows
 * themes to sync automatically between collaborators.
 */
import { Elysia } from 'elysia';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client';
import { getEnabledSiteThemes, getDefaultTheme, getBaseThemes } from '../db/queries/themes';
import type { Theme } from '../db/types';

// Base path for themes (bundled with the app)
const THEMES_BASE_PATH = 'public/files/perm/themes/base';

// Get site themes directory (admin-uploaded themes)
const getSiteThemesPath = () => {
    const filesDir = process.env.ELYSIA_FILES_DIR || process.env.FILES_DIR || '/mnt/data';
    return path.join(filesDir, 'themes/site');
};

/**
 * Dependency injection for testing
 */
export interface ThemesRouteDependencies {
    fs: {
        existsSync: typeof fs.existsSync;
        readFileSync: typeof fs.readFileSync;
        readdirSync: typeof fs.readdirSync;
    };
    getEnv: (key: string) => string | undefined;
}

const defaultDeps: ThemesRouteDependencies = {
    fs: {
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
        readdirSync: fs.readdirSync,
    },
    getEnv: (key: string) => process.env[key],
};

let deps = defaultDeps;

export function configure(newDeps: Partial<ThemesRouteDependencies>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetDependencies(): void {
    deps = defaultDeps;
}

// Get app version for cache busting URLs
const getAppVersion = (): string => {
    const envVersion = deps.getEnv('APP_VERSION');
    if (envVersion) {
        return envVersion;
    }
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (deps.fs.existsSync(packageJsonPath)) {
            const content = deps.fs.readFileSync(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            return `v${pkg.version || '0.0.0'}`;
        }
    } catch {
        // Ignore parse errors
    }
    return 'v0.0.0';
};

/**
 * Supported icon extensions in priority order (highest priority first)
 * When multiple formats exist for the same icon, the highest priority format wins
 */
const ICON_EXTENSIONS = ['svg', 'png', 'gif', 'jpg', 'jpeg', 'webp'];
const ICON_EXTENSION_REGEX = /\.(svg|png|gif|jpe?g|webp)$/i;

/**
 * Theme icon structure expected by the frontend
 * The `id` field is the baseName WITHOUT extension (e.g., "share")
 * The `value` field contains the full URL with extension (e.g., "/v3.1/.../share.svg")
 */
interface ThemeIcon {
    id: string;
    title: string;
    type: string;
    value: string;
}

/**
 * Theme configuration interface
 */
interface ThemeConfig {
    id?: string;
    name: string;
    dirName: string;
    displayName: string;
    title: string;
    url: string;
    preview: string;
    type: 'base' | 'site';
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
    valid: boolean;
    isDefault?: boolean;
}

/**
 * Scan theme directory for CSS files
 */
function scanThemeFiles(themePath: string, extension: string): string[] {
    const files: string[] = [];
    if (!deps.fs.existsSync(themePath)) {
        return files;
    }

    const entries = deps.fs.readdirSync(themePath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(extension)) {
            files.push(entry.name);
        }
    }
    return files;
}

/**
 * Scan theme directory for icon files
 * Supports multiple formats with priority: svg > png > gif > jpg > jpeg > webp
 * When multiple formats exist for the same icon base name, the highest priority format wins
 *
 * Icons are keyed by baseName (e.g., "share") to allow cross-theme compatibility.
 * The iconName stored in blocks is the baseName without extension.
 */
function scanThemeIcons(themePath: string, themeUrl: string): Record<string, ThemeIcon> {
    const icons: Record<string, ThemeIcon> = {};
    const iconsPath = path.join(themePath, 'icons');

    if (!deps.fs.existsSync(iconsPath)) {
        return icons;
    }

    // Track best icon per base name (highest priority = lowest index)
    const bestByBaseName: Map<string, { filename: string; priority: number }> = new Map();

    const entries = deps.fs.readdirSync(iconsPath, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isFile()) continue;

        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (!ext || !ICON_EXTENSIONS.includes(ext)) continue;

        const baseName = entry.name.replace(ICON_EXTENSION_REGEX, '');
        const priority = ICON_EXTENSIONS.indexOf(ext);

        const existing = bestByBaseName.get(baseName);
        if (!existing || priority < existing.priority) {
            bestByBaseName.set(baseName, { filename: entry.name, priority });
        }
    }

    // Build icons record - keyed by baseName (e.g., "share")
    // This allows icon selection to persist when switching themes
    // (Theme A may have share.svg, Theme B may have share.png)
    for (const [baseName, { filename }] of bestByBaseName) {
        icons[baseName] = {
            id: baseName, // baseName without extension
            title: baseName,
            type: 'img',
            value: `${themeUrl}/icons/${filename}`, // Full URL with extension
        };
    }

    return icons;
}

/**
 * Parse theme config.xml
 */
function parseThemeConfig(
    xmlContent: string,
    themeId: string,
    themePath: string,
    type: 'base' | 'site',
    customUrlPrefix?: string,
): ThemeConfig | null {
    try {
        // Simple XML parsing
        const getValue = (tag: string): string => {
            const match = xmlContent.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
            return match ? match[1].trim() : '';
        };

        const version = getAppVersion();

        // Build URL paths with version for cache busting
        let themeBasePath: string;
        if (customUrlPrefix) {
            themeBasePath = `/${version}${customUrlPrefix}/${themeId}`;
        } else {
            themeBasePath = `/${version}/files/perm/themes/base/${themeId}`;
        }

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

        return {
            name: getValue('name') || themeId,
            dirName: themeId,
            displayName: getValue('name') || themeId,
            title: getValue('name') || themeId,
            url: themeBasePath,
            preview: previewPath,
            type,
            version: getValue('version') || '1.0',
            compatibility: getValue('exe-version') || '3.0',
            author: getValue('author') || '',
            license: getValue('license') || '',
            licenseUrl: getValue('license-url') || '',
            description: getValue('description') || '',
            downloadable: getValue('downloadable') || '1',
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
 * Scan themes directory and return list
 */
function scanThemes(basePath: string, type: 'base' | 'site', customUrlPrefix?: string): ThemeConfig[] {
    const themes: ThemeConfig[] = [];

    if (!deps.fs.existsSync(basePath)) {
        return themes;
    }

    const entries = deps.fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) {
            continue;
        }

        const configPath = path.join(basePath, entry.name, 'config.xml');
        if (deps.fs.existsSync(configPath)) {
            const xmlContent = deps.fs.readFileSync(configPath, 'utf-8');
            const config = parseThemeConfig(
                xmlContent,
                entry.name,
                path.join(basePath, entry.name),
                type,
                customUrlPrefix,
            );
            if (config) {
                themes.push(config);
            }
        }
    }

    return themes;
}

/**
 * Convert site theme from database to ThemeConfig format
 */
function siteThemeToConfig(siteTheme: Theme): ThemeConfig {
    const version = getAppVersion();
    const siteThemesPath = getSiteThemesPath();
    const themePath = path.join(siteThemesPath, siteTheme.dir_name);

    // Build URL paths - site themes are served from FILES_DIR
    const themeUrl = `/${version}/site-files/themes/${siteTheme.dir_name}`;

    // Scan for CSS, JS, and icons
    const cssFiles = deps.fs.existsSync(themePath) ? scanThemeFiles(themePath, '.css') : ['style.css'];
    const js = deps.fs.existsSync(themePath) ? scanThemeFiles(themePath, '.js') : [];
    const icons = deps.fs.existsSync(themePath) ? scanThemeIcons(themePath, themeUrl) : {};

    return {
        name: siteTheme.dir_name,
        dirName: siteTheme.dir_name,
        displayName: siteTheme.display_name,
        title: siteTheme.display_name,
        url: themeUrl,
        preview: `${themeUrl}/screenshot.png`,
        type: 'site',
        version: siteTheme.version || '1.0',
        compatibility: '3.0',
        author: siteTheme.author || '',
        license: siteTheme.license || '',
        licenseUrl: '',
        description: siteTheme.description || '',
        downloadable: '1',
        cssFiles,
        js,
        icons,
        valid: true,
    };
}

/**
 * Themes routes
 * Only serves base themes (bundled) and site themes (admin-uploaded).
 * User themes from .elpx files are stored client-side in Yjs.
 */
export const themesRoutes = new Elysia({ name: 'themes-routes' })
    // GET /api/themes/installed - Get list of installed themes (base + site)
    .get('/api/themes/installed', async () => {
        const baseThemes = scanThemes(THEMES_BASE_PATH, 'base');

        // Get enabled site themes from database
        let siteThemes: ThemeConfig[] = [];
        let defaultTheme = { type: 'base' as const, dirName: 'base' };
        let baseThemesFromDb: Theme[] = [];

        try {
            const siteThemesDb = await getEnabledSiteThemes(db);
            siteThemes = siteThemesDb.map(siteThemeToConfig);
        } catch (error) {
            // Silently ignore if themes table doesn't exist yet (migration pending)
            console.warn('[themes] Could not load site themes:', error instanceof Error ? error.message : error);
        }

        try {
            defaultTheme = await getDefaultTheme(db);
            baseThemesFromDb = await getBaseThemes(db);
        } catch (error) {
            // Silently ignore if themes table doesn't exist yet (migration pending)
            console.warn('[themes] Could not load theme settings:', error instanceof Error ? error.message : error);
        }

        // Create a map of disabled base themes (is_enabled=0)
        const disabledBaseThemes = new Set(baseThemesFromDb.filter(t => t.is_enabled === 0).map(t => t.dir_name));

        // Filter out disabled base themes
        const enabledBaseThemes = baseThemes.filter(t => !disabledBaseThemes.has(t.dirName));

        // Combine base + site themes
        const allThemes = [...enabledBaseThemes, ...siteThemes];

        // Mark the default theme
        for (const theme of allThemes) {
            if (defaultTheme.type === 'base' && theme.type === 'base' && theme.dirName === defaultTheme.dirName) {
                theme.isDefault = true;
            } else if (
                defaultTheme.type === 'site' &&
                theme.type === 'site' &&
                theme.dirName === defaultTheme.dirName
            ) {
                theme.isDefault = true;
            }
        }

        // Sort by displayName
        allThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));

        // Frontend expects { themes: [...] } format
        return {
            themes: allThemes,
            defaultTheme,
        };
    })

    // GET /api/themes/installed/:themeId - Get specific theme
    .get('/api/themes/installed/:themeId', ({ params, set }) => {
        const { themeId } = params;

        // Check base themes first
        let configPath = path.join(THEMES_BASE_PATH, themeId, 'config.xml');
        let themePath = path.join(THEMES_BASE_PATH, themeId);
        let type: 'base' | 'site' = 'base';

        if (!deps.fs.existsSync(configPath)) {
            // Check site themes
            const siteThemesPath = getSiteThemesPath();
            configPath = path.join(siteThemesPath, themeId, 'config.xml');
            themePath = path.join(siteThemesPath, themeId);
            type = 'site';
        }

        if (!deps.fs.existsSync(configPath)) {
            set.status = 404;
            return { error: 'Not Found', message: `Theme ${themeId} not found` };
        }

        const xmlContent = deps.fs.readFileSync(configPath, 'utf-8');
        const customUrlPrefix = type === 'site' ? '/site-files/themes' : undefined;
        const config = parseThemeConfig(xmlContent, themeId, themePath, type, customUrlPrefix);

        if (!config) {
            set.status = 500;
            return { error: 'Parse Error', message: 'Failed to parse theme config' };
        }

        return config;
    })

    // GET /api/resources/theme/:themeName/bundle - Get theme files as a bundle for export
    // This endpoint serves base and site themes for the exporter
    .get('/api/resources/theme/:themeName/bundle', async ({ params, set }) => {
        const { themeName } = params;

        // Check base themes first
        let themePath = path.join(THEMES_BASE_PATH, themeName);
        let found = deps.fs.existsSync(themePath);

        if (!found) {
            // Check site themes
            const siteThemesPath = getSiteThemesPath();
            themePath = path.join(siteThemesPath, themeName);
            found = deps.fs.existsSync(themePath);
        }

        if (!found) {
            set.status = 404;
            return { error: 'Not Found', message: `Theme ${themeName} not found` };
        }

        // Collect all files in the theme directory
        const files: Record<string, string> = {};

        function scanDir(dirPath: string, prefix = ''): void {
            if (!deps.fs.existsSync(dirPath)) return;

            const entries = deps.fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                    scanDir(fullPath, relativePath);
                } else if (entry.isFile()) {
                    // Read file and encode as base64
                    const content = deps.fs.readFileSync(fullPath);
                    files[relativePath] = content.toString('base64');
                }
            }
        }

        scanDir(themePath);

        return {
            themeName,
            files,
        };
    });

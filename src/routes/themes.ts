/**
 * Themes Routes for Elysia
 * Handles installed themes listing and management
 *
 * Ported from NestJS ThemeService to match frontend expectations
 */
import { Elysia, t } from 'elysia';
import * as fs from 'fs';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import { db } from '../db/client';
import { getEnabledSiteThemes, getDefaultTheme, getBaseThemes } from '../db/queries/themes';
import type { Theme } from '../db/types';
import { validateThemeZip, extractTheme, slugify, BASE_THEME_NAMES } from '../services/admin-upload-validator';

// Base path for themes
const THEMES_BASE_PATH = 'public/files/perm/themes/base';
const THEMES_USERS_PATH = 'public/files/perm/themes/users';

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
    fsExtra: {
        pathExists: typeof fsExtra.pathExists;
        remove: typeof fsExtra.remove;
    };
    getEnv: (key: string) => string | undefined;
    validateThemeZip: typeof validateThemeZip;
    extractTheme: typeof extractTheme;
}

const defaultDeps: ThemesRouteDependencies = {
    fs: {
        existsSync: fs.existsSync,
        readFileSync: fs.readFileSync,
        readdirSync: fs.readdirSync,
    },
    fsExtra: {
        pathExists: fsExtra.pathExists,
        remove: fsExtra.remove,
    },
    getEnv: (key: string) => process.env[key],
    validateThemeZip,
    extractTheme,
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
        const packageJson = JSON.parse(deps.fs.readFileSync('package.json', 'utf-8'));
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
    type: 'base' | 'user' | 'site';
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
    isDefault?: boolean;
}

/**
 * Scan theme directory for files with specific extension
 */
function scanThemeFiles(themePath: string, extension: string): string[] {
    try {
        const files: string[] = [];
        if (!deps.fs.existsSync(themePath)) return files;

        const entries = deps.fs.readdirSync(themePath, { withFileTypes: true });
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
        if (!deps.fs.existsSync(iconsPath)) return {};

        const entries = deps.fs.readdirSync(iconsPath, { withFileTypes: true });
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
 * @param xmlContent - XML content to parse
 * @param themeId - Theme directory name
 * @param themePath - Full path to theme directory
 * @param type - Theme type (base/user)
 * @param customUrlPrefix - Optional custom URL prefix for themes stored in FILES_DIR
 */
function parseThemeConfig(
    xmlContent: string,
    themeId: string,
    themePath: string,
    type: 'base' | 'user',
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
        // NOTE: basePath is NOT included here because frontend adds it via symfonyURL in theme.js
        let themeBasePath: string;
        if (customUrlPrefix) {
            // Use custom prefix for themes from FILES_DIR
            themeBasePath = `/${version}${customUrlPrefix}/${themeId}`;
        } else {
            themeBasePath =
                type === 'base'
                    ? `/${version}/files/perm/themes/base/${themeId}`
                    : `/${version}/files/perm/themes/users/${themeId}`;
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
 * @param basePath - Directory path to scan for themes
 * @param type - Theme type (base/user)
 * @param customUrlPrefix - Optional custom URL prefix for themes served from non-standard location
 */
function scanThemes(basePath: string, type: 'base' | 'user', customUrlPrefix?: string): ThemeConfig[] {
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

// Get files directory
const getFilesDir = () => process.env.ELYSIA_FILES_DIR || process.env.FILES_DIR || '/mnt/data';

/**
 * Themes routes
 */
export const themesRoutes = new Elysia({ name: 'themes-routes' })
    // GET /api/themes/installed - Get list of installed themes
    .get('/api/themes/installed', async () => {
        const baseThemes = scanThemes(THEMES_BASE_PATH, 'base');
        const userThemes = scanThemes(THEMES_USERS_PATH, 'user');

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

        // Also scan user themes from FILES_DIR (imported from ELP files)
        // These themes are served via /user-files/themes/ route
        const userThemesDir = path.join(getFilesDir(), 'themes', 'users');
        let additionalUserThemes: ThemeConfig[] = [];
        if (deps.fs.existsSync(userThemesDir)) {
            // Pass custom URL prefix so preview images and assets use /user-files/themes/ route
            additionalUserThemes = scanThemes(userThemesDir, 'user', '/user-files/themes');
        }

        // Combine all themes (base + user from public + user from FILES_DIR + site)
        const allThemes = [...enabledBaseThemes, ...userThemes, ...additionalUserThemes, ...siteThemes];

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

        // Check user themes first
        let configPath = path.join(THEMES_USERS_PATH, themeId, 'config.xml');
        let themePath = path.join(THEMES_USERS_PATH, themeId);
        let type: 'base' | 'user' = 'user';

        if (!deps.fs.existsSync(configPath)) {
            // Fall back to base themes
            configPath = path.join(THEMES_BASE_PATH, themeId, 'config.xml');
            themePath = path.join(THEMES_BASE_PATH, themeId);
            type = 'base';
        }

        if (!deps.fs.existsSync(configPath)) {
            set.status = 404;
            return { error: 'Not Found', message: `Theme ${themeId} not found` };
        }

        const xmlContent = deps.fs.readFileSync(configPath, 'utf-8');
        const config = parseThemeConfig(xmlContent, themeId, themePath, type);

        if (!config) {
            set.status = 500;
            return { error: 'Parse Error', message: 'Failed to parse theme config' };
        }

        return config;
    })

    /**
     * POST /api/themes/import - Import theme from ELP file
     * Allows users to install a theme from their .elpx file.
     *
     * SECURITY NOTE: Custom themes can contain JavaScript code that will be
     * executed in the exported content context. This feature is controlled
     * by the ONLINE_THEMES_INSTALL setting. The client-side code checks
     * this setting before offering to import themes. Administrators should
     * be aware that enabling ONLINE_THEMES_INSTALL allows users to run
     * custom JavaScript in exported content.
     */
    .post(
        '/api/themes/import',
        async ({ body, set, jwt, cookie }) => {
            try {
                const { themeZip, themeDirname } = body;

                if (!themeZip) {
                    set.status = 400;
                    return { responseMessage: 'ERROR', error: 'No theme file uploaded' };
                }

                if (!themeDirname) {
                    set.status = 400;
                    return { responseMessage: 'ERROR', error: 'No theme directory name provided' };
                }

                // Get file buffer
                const fileBuffer = Buffer.from(await themeZip.arrayBuffer());

                // Validate ZIP file
                const validation = await deps.validateThemeZip(fileBuffer);
                if (!validation.valid) {
                    set.status = 400;
                    return { responseMessage: 'ERROR', error: validation.error };
                }

                // Use provided dirname or generate from metadata
                const dirName = slugify(themeDirname) || slugify(validation.metadata!.name);
                if (!dirName) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: 'Could not generate valid directory name for theme',
                    };
                }

                // Check if theme already exists in base or admin (conflicts not allowed)
                // 1. Check base themes list
                if (BASE_THEME_NAMES.includes(dirName.toLowerCase())) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists on the server (base theme)`,
                    };
                }

                // 2. Check base themes directory
                const baseThemePath = path.join(THEMES_BASE_PATH, dirName);
                if (deps.fs.existsSync(baseThemePath)) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists on the server (base theme)`,
                    };
                }

                // 3. Check site themes directory
                const siteThemePath = path.join(getSiteThemesPath(), dirName);
                if (await deps.fsExtra.pathExists(siteThemePath)) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists on the server (site theme)`,
                    };
                }

                // Themes imported from ELP files ALWAYS go to user themes folder
                // Admin themes are only installed via the admin panel, not via ELP import
                // This applies to all users, including admins
                const targetDir = path.join(getFilesDir(), 'themes', 'users', dirName);

                // Check if theme already exists in user folder - if so, just return success
                // (user can re-import a theme they already have)
                if (await deps.fsExtra.pathExists(targetDir)) {
                    // Theme already exists, no need to import again
                    // Just return success with current theme list
                    const baseThemes = scanThemes(THEMES_BASE_PATH, 'base');
                    const userThemes = scanThemes(THEMES_USERS_PATH, 'user');

                    let siteThemes: ThemeConfig[] = [];
                    try {
                        const siteThemesDb = await getEnabledSiteThemes(db);
                        siteThemes = siteThemesDb.map(siteThemeToConfig);
                    } catch {
                        // Ignore if table doesn't exist
                    }

                    const userThemesDir = path.join(getFilesDir(), 'themes', 'users');
                    let additionalUserThemes: ThemeConfig[] = [];
                    if (await deps.fsExtra.pathExists(userThemesDir)) {
                        additionalUserThemes = scanThemes(userThemesDir, 'user', '/user-files/themes');
                    }

                    const allThemes = [...baseThemes, ...userThemes, ...additionalUserThemes, ...siteThemes];
                    allThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));

                    return {
                        responseMessage: 'OK',
                        themes: { themes: allThemes },
                    };
                }

                // Extract theme to user themes folder
                await deps.extractTheme(fileBuffer, targetDir);

                // Return updated theme list
                const baseThemes = scanThemes(THEMES_BASE_PATH, 'base');
                const userThemes = scanThemes(THEMES_USERS_PATH, 'user');

                // Get enabled site themes from database
                let siteThemes: ThemeConfig[] = [];
                try {
                    const siteThemesDb = await getEnabledSiteThemes(db);
                    siteThemes = siteThemesDb.map(siteThemeToConfig);
                } catch {
                    // Ignore if table doesn't exist
                }

                // Also scan user themes from FILES_DIR (served via /user-files/themes/ route)
                const userThemesDir = path.join(getFilesDir(), 'themes', 'users');
                let additionalUserThemes: ThemeConfig[] = [];
                if (await deps.fsExtra.pathExists(userThemesDir)) {
                    additionalUserThemes = scanThemes(userThemesDir, 'user', '/user-files/themes');
                }

                const allThemes = [...baseThemes, ...userThemes, ...additionalUserThemes, ...siteThemes];
                allThemes.sort((a, b) => a.displayName.localeCompare(b.displayName));

                return {
                    responseMessage: 'OK',
                    themes: {
                        themes: allThemes,
                    },
                };
            } catch (error) {
                console.error('[themes] Theme import error:', error);
                set.status = 500;
                const message = error instanceof Error ? error.message : 'Unknown error';
                return { responseMessage: 'ERROR', error: message };
            }
        },
        {
            body: t.Object({
                themeZip: t.File(),
                themeDirname: t.String(),
            }),
        },
    )

    /**
     * POST /api/themes/upload - Upload theme ZIP file (base64 encoded)
     * Used by the workarea styles panel "Import style" button.
     *
     * SECURITY NOTE: Custom themes can contain JavaScript code that will be
     * executed in the exported content context. This feature is controlled
     * by the ONLINE_THEMES_INSTALL setting. Administrators should be aware
     * that enabling ONLINE_THEMES_INSTALL allows users to run custom
     * JavaScript in exported content.
     */
    .post(
        '/api/themes/upload',
        async ({ body, set }) => {
            try {
                const { filename, file } = body;

                if (!file || !filename) {
                    set.status = 400;
                    return { responseMessage: 'ERROR', error: 'Missing file or filename' };
                }

                // Parse base64 data URL
                let fileBuffer: Buffer;
                if (file.startsWith('data:')) {
                    // Extract base64 part from data URL
                    const base64Data = file.split(',')[1];
                    if (!base64Data) {
                        set.status = 400;
                        return { responseMessage: 'ERROR', error: 'Invalid base64 data' };
                    }
                    fileBuffer = Buffer.from(base64Data, 'base64');
                } else {
                    // Assume raw base64
                    fileBuffer = Buffer.from(file, 'base64');
                }

                // Validate ZIP file
                const validation = await deps.validateThemeZip(fileBuffer);
                if (!validation.valid) {
                    set.status = 400;
                    return { responseMessage: 'ERROR', error: validation.error };
                }

                // Generate directory name from filename or config
                const baseName = filename.replace(/\.zip$/i, '');
                const dirName = slugify(baseName) || slugify(validation.metadata!.name);
                if (!dirName) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: 'Could not generate valid directory name for theme',
                    };
                }

                // Check if theme already exists in any location (base, admin, user)
                // 1. Check base themes
                if (BASE_THEME_NAMES.includes(dirName.toLowerCase())) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists on the server (base theme)`,
                    };
                }

                // 2. Check base themes directory
                const baseThemePath = path.join(THEMES_BASE_PATH, dirName);
                if (deps.fs.existsSync(baseThemePath)) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists on the server (base theme)`,
                    };
                }

                // 3. Check site themes directory
                const siteThemePath = path.join(getSiteThemesPath(), dirName);
                if (await deps.fsExtra.pathExists(siteThemePath)) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists on the server (site theme)`,
                    };
                }

                // 4. Check legacy user themes directory
                const legacyUserThemePath = path.join(THEMES_USERS_PATH, dirName);
                if (deps.fs.existsSync(legacyUserThemePath)) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists`,
                    };
                }

                // 5. Check user themes in FILES_DIR
                const targetDir = path.join(getFilesDir(), 'themes', 'users', dirName);
                if (await deps.fsExtra.pathExists(targetDir)) {
                    set.status = 400;
                    return {
                        responseMessage: 'ERROR',
                        error: `A theme with the name "${dirName}" already exists`,
                    };
                }

                // Extract theme to target directory
                await deps.extractTheme(fileBuffer, targetDir);

                // Read config.xml to get theme metadata
                const configPath = path.join(targetDir, 'config.xml');
                let themeConfig: ThemeConfig;

                if (deps.fs.existsSync(configPath)) {
                    const xmlContent = deps.fs.readFileSync(configPath, 'utf8');
                    // Use /user-files/themes/ prefix for user themes from FILES_DIR
                    const parsed = parseThemeConfig(xmlContent, dirName, targetDir, 'user', '/user-files/themes');
                    if (parsed) {
                        themeConfig = parsed;
                    } else {
                        // Fallback if config parse fails
                        const version = getAppVersion();
                        themeConfig = {
                            id: dirName,
                            dirName: dirName,
                            displayName: validation.metadata!.name,
                            version: validation.metadata!.version || '1.0',
                            author: validation.metadata!.author || '',
                            type: 'user',
                            url: `/${version}/user-files/themes/${dirName}`,
                            preview: `/${version}/user-files/themes/${dirName}/preview.png`,
                        } as ThemeConfig;
                    }
                } else {
                    // No config.xml, use validation metadata
                    const version = getAppVersion();
                    themeConfig = {
                        id: dirName,
                        dirName: dirName,
                        displayName: validation.metadata!.name,
                        version: validation.metadata!.version || '1.0',
                        author: validation.metadata!.author || '',
                        type: 'user',
                        url: `/${version}/user-files/themes/${dirName}`,
                        preview: `/${version}/user-files/themes/${dirName}/preview.png`,
                    } as ThemeConfig;
                }

                return {
                    responseMessage: 'OK',
                    theme: themeConfig,
                };
            } catch (error) {
                console.error('[Themes] Upload error:', error);
                set.status = 500;
                return {
                    responseMessage: 'ERROR',
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
        {
            body: t.Object({
                filename: t.String(),
                file: t.String(), // base64 encoded file
            }),
        },
    )

    /**
     * DELETE /api/themes/:themeId/delete - Delete a user theme
     * Only user-installed themes can be deleted, not base themes.
     */
    .delete('/api/themes/:themeId/delete', async ({ params, body, set }) => {
        try {
            // Get theme ID from path param or body
            // The client may send {themeId} literally if URL wasn't properly templated
            let themeId = params.themeId;
            if (themeId === '{themeId}' && body && typeof body === 'object' && 'id' in body) {
                themeId = (body as { id: string }).id;
            }

            if (!themeId || themeId === '{themeId}') {
                set.status = 400;
                return { responseMessage: 'ERROR', error: 'No theme ID provided' };
            }

            // Security: only allow deleting user themes, not base themes
            if (BASE_THEME_NAMES.includes(themeId.toLowerCase())) {
                set.status = 403;
                return {
                    responseMessage: 'ERROR',
                    error: 'Cannot delete built-in themes',
                };
            }

            // Check in user themes directory
            const userThemePath = path.join(getFilesDir(), 'themes', 'users', themeId);

            if (!(await deps.fsExtra.pathExists(userThemePath))) {
                // Also check in public/files/perm/themes/users (legacy location)
                const legacyPath = path.join('public/files/perm/themes/users', themeId);
                if (deps.fs.existsSync(legacyPath)) {
                    await deps.fsExtra.remove(legacyPath);
                    return {
                        responseMessage: 'OK',
                        deleted: { name: themeId },
                    };
                }

                set.status = 404;
                return {
                    responseMessage: 'ERROR',
                    error: `Theme "${themeId}" not found`,
                };
            }

            // Delete the theme directory
            await deps.fsExtra.remove(userThemePath);

            return {
                responseMessage: 'OK',
                deleted: { name: themeId },
            };
        } catch (error) {
            console.error('[Themes] Delete error:', error);
            set.status = 500;
            return {
                responseMessage: 'ERROR',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    });

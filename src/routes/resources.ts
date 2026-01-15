/**
 * Resources Routes for Elysia
 * Provides file listings for themes, iDevices, and libraries for client-side exports.
 * Used by ResourceFetcher.js to discover files that need to be included in exports.
 */
import { Elysia } from 'elysia';
import * as fs from 'fs';
import * as path from 'path';
import { LEGACY_IDEVICE_MAPPING } from '../shared/export/constants';

// Base paths for resources
const PUBLIC_PATH = 'public';
const THEMES_BASE_PATH = 'public/files/perm/themes/base';
// Note: User themes are stored client-side in IndexedDB, not on server
const IDEVICES_BASE_PATH = 'public/files/perm/idevices/base';
const IDEVICES_USERS_PATH = 'public/files/perm/idevices/users';
const LIBS_PATH = 'public/libs';
const COMMON_PATH = 'public/app/common';
const BUNDLES_PATH = 'public/bundles';

// Get site themes directory (from FILES_DIR)
const getSiteThemesPath = (): string => {
    const filesDir = deps.getEnv('ELYSIA_FILES_DIR') || deps.getEnv('FILES_DIR') || '/mnt/data';
    return path.join(filesDir, 'themes/site');
};

/**
 * Dependency injection for testing
 */
export interface ResourcesRouteDependencies {
    fs: {
        existsSync: typeof fs.existsSync;
        readdirSync: typeof fs.readdirSync;
        statSync: typeof fs.statSync;
        readFileSync: typeof fs.readFileSync;
    };
    getEnv: (key: string) => string | undefined;
}

const defaultDeps: ResourcesRouteDependencies = {
    fs: {
        existsSync: fs.existsSync,
        readdirSync: fs.readdirSync,
        statSync: fs.statSync,
        readFileSync: fs.readFileSync,
    },
    getEnv: (key: string) => process.env[key],
};

let deps = defaultDeps;

export function configure(newDeps: Partial<ResourcesRouteDependencies>): void {
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

// Get base path from environment (for subdirectory installs)
const getBasePath = (): string => {
    return deps.getEnv('BASE_PATH') || '';
};

interface ResourceFile {
    path: string; // Relative path for export (e.g., "style.css")
    url: string; // Full URL to fetch the file
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath: string, basePath: string = ''): string[] {
    const files: string[] = [];

    if (!deps.fs.existsSync(dirPath)) {
        return files;
    }

    try {
        const entries = deps.fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            // Skip hidden files and directories
            if (entry.name.startsWith('.')) continue;

            const fullPath = path.join(dirPath, entry.name);
            const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                // Recursively scan subdirectories
                files.push(...scanDirectory(fullPath, relativePath));
            } else if (entry.isFile()) {
                files.push(relativePath);
            }
        }
    } catch (e) {
        console.warn(`[Resources] Error scanning directory ${dirPath}:`, e);
    }

    return files;
}

/**
 * Build file list with URLs
 * @param dirPath - Directory to scan
 * @param urlPrefix - URL prefix for fetching files
 * @param pathPrefix - Optional prefix to add to file paths (e.g., library name for directory exports)
 */
function buildFileList(dirPath: string, urlPrefix: string, pathPrefix?: string): ResourceFile[] {
    const files = scanDirectory(dirPath);
    const version = getAppVersion();
    const basePath = getBasePath();

    return files.map(filePath => ({
        path: pathPrefix ? `${pathPrefix}/${filePath}` : filePath,
        url: `${basePath}/${version}${urlPrefix}/${filePath}`,
    }));
}

/**
 * Resources routes
 */
export const resourcesRoutes = new Elysia({ name: 'resources-routes' })
    // GET /api/resources/theme/:themeName - Get all files for a theme
    // Note: User themes are stored client-side in IndexedDB and served via ResourceFetcher
    .get('/api/resources/theme/:themeName', ({ params, set }) => {
        const { themeName } = params;
        const version = getAppVersion();
        const basePath = getBasePath();

        // Check base themes first
        let themePath = path.join(THEMES_BASE_PATH, themeName);
        const urlPrefix = `/files/perm/themes/base/${themeName}`;

        // Check site themes (from FILES_DIR)
        if (!deps.fs.existsSync(themePath)) {
            const siteThemesPath = getSiteThemesPath();
            themePath = path.join(siteThemesPath, themeName);
            if (deps.fs.existsSync(themePath)) {
                // Site themes are served via /site-files/themes/
                // Return file list with direct URLs (not through /files/ prefix)
                const files = scanDirectory(themePath);
                return files.map(filePath => ({
                    path: filePath,
                    url: `${basePath}/${version}/site-files/themes/${themeName}/${filePath}`,
                }));
            }
        }

        if (!deps.fs.existsSync(themePath)) {
            set.status = 404;
            return { error: 'Not Found', message: `Theme ${themeName} not found` };
        }

        return buildFileList(themePath, urlPrefix);
    })

    // GET /api/resources/idevice/:ideviceType - Get export files for an iDevice
    .get('/api/resources/idevice/:ideviceType', ({ params, set }) => {
        const { ideviceType } = params;

        // First check for legacy iDevice name mapping
        const mappedType = LEGACY_IDEVICE_MAPPING[ideviceType] || ideviceType;

        // Normalize iDevice type (remove 'Idevice' suffix if present)
        const normalizedType = mappedType.toLowerCase().replace(/idevice$/i, '');

        // Compute kebab-case variations BEFORE lowercasing (to detect camelCase)
        const kebabVariant = mappedType
            .replace(/Idevice$/i, '')
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .toLowerCase();

        // Check user iDevices first, then base iDevices
        let idevicePath = path.join(IDEVICES_USERS_PATH, normalizedType, 'export');
        let urlPrefix = `/files/perm/idevices/users/${normalizedType}/export`;

        if (!deps.fs.existsSync(idevicePath)) {
            idevicePath = path.join(IDEVICES_BASE_PATH, normalizedType, 'export');
            urlPrefix = `/files/perm/idevices/base/${normalizedType}/export`;
        }

        // Try with hyphenated version (e.g., 'FreeText' -> 'free-text')
        if (!deps.fs.existsSync(idevicePath)) {
            // Try common variations
            const variations = [
                kebabVariant, // camelCase to kebab (computed before lowercase)
                normalizedType.replace(/_/g, '-'), // snake_case to kebab
            ];

            for (const variant of variations) {
                idevicePath = path.join(IDEVICES_BASE_PATH, variant, 'export');
                if (deps.fs.existsSync(idevicePath)) {
                    urlPrefix = `/files/perm/idevices/base/${variant}/export`;
                    break;
                }
            }
        }

        if (!deps.fs.existsSync(idevicePath)) {
            // Not all iDevices have export files - this is normal
            set.status = 404;
            return [];
        }

        return buildFileList(idevicePath, urlPrefix);
    })

    // GET /api/resources/libs/base - Get base JavaScript libraries (jQuery, common, etc.)
    // Only truly essential libraries - others are conditionally included via LibraryDetector
    .get('/api/resources/libs/base', () => {
        const version = getAppVersion();
        const basePath = getBasePath();

        // Return only essential libraries for exports
        // Content-specific libraries (exe_lightbox, exe_tooltips, exe_effects, jquery-ui, etc.)
        // are detected and included via LibraryDetector based on actual content usage
        const baseLibs: Array<ResourceFile & { srcPath: string }> = [
            // jQuery (libs/)
            {
                path: 'jquery/jquery.min.js',
                srcPath: path.join(LIBS_PATH, 'jquery/jquery.min.js'),
                url: `${basePath}/${version}/libs/jquery/jquery.min.js`,
            },
            // Bootstrap (libs/)
            {
                path: 'bootstrap/bootstrap.bundle.min.js',
                srcPath: path.join(LIBS_PATH, 'bootstrap/bootstrap.bundle.min.js'),
                url: `${basePath}/${version}/libs/bootstrap/bootstrap.bundle.min.js`,
            },
            {
                path: 'bootstrap/bootstrap.min.css',
                srcPath: path.join(LIBS_PATH, 'bootstrap/bootstrap.min.css'),
                url: `${basePath}/${version}/libs/bootstrap/bootstrap.min.css`,
            },
            {
                path: 'bootstrap/bootstrap.bundle.min.js.map',
                srcPath: path.join(LIBS_PATH, 'bootstrap/bootstrap.bundle.min.js.map'),
                url: `${basePath}/${version}/libs/bootstrap/bootstrap.bundle.min.js.map`,
            },
            {
                path: 'bootstrap/bootstrap.min.css.map',
                srcPath: path.join(LIBS_PATH, 'bootstrap/bootstrap.min.css.map'),
                url: `${basePath}/${version}/libs/bootstrap/bootstrap.min.css.map`,
            },
            // Common JS files (app/common/)
            {
                path: 'common.js',
                srcPath: path.join(COMMON_PATH, 'common.js'),
                url: `${basePath}/${version}/app/common/common.js`,
            },
            {
                path: 'common_i18n.js',
                srcPath: path.join(COMMON_PATH, 'common_i18n.js'),
                url: `${basePath}/${version}/app/common/common_i18n.js`,
            },
            {
                path: 'exe_export.js',
                srcPath: path.join(COMMON_PATH, 'exe_export.js'),
                url: `${basePath}/${version}/app/common/exe_export.js`,
            },
            // Favicon (public/)
            {
                path: 'favicon.ico',
                srcPath: path.join(PUBLIC_PATH, 'favicon.ico'),
                url: `${basePath}/${version}/favicon.ico`,
            },
        ];

        // Check which files actually exist and return only path and url
        return baseLibs
            .filter(lib => deps.fs.existsSync(lib.srcPath))
            .map(({ path: libPath, url }) => ({ path: libPath, url }));
    })

    // GET /api/resources/libs/scorm - Get SCORM JavaScript files
    // Excludes test files (.test.js, .spec.js) from exports
    .get('/api/resources/libs/scorm', () => {
        const scormPath = path.join(COMMON_PATH, 'scorm');
        if (!deps.fs.existsSync(scormPath)) {
            return [];
        }
        const files = scanDirectory(scormPath).filter(f => !f.endsWith('.test.js') && !f.endsWith('.spec.js'));
        const version = getAppVersion();
        const basePath = getBasePath();
        return files.map(filePath => ({
            path: filePath,
            url: `${basePath}/${version}/app/common/scorm/${filePath}`,
        }));
    })

    // GET /api/resources/libs/epub - Get EPUB-specific files
    .get('/api/resources/libs/epub', () => {
        const epubPath = path.join(COMMON_PATH, 'epub');
        if (!deps.fs.existsSync(epubPath)) {
            return [];
        }
        return buildFileList(epubPath, '/app/common/epub');
    })

    // GET /api/resources/libs/directory/:libraryName - Get all files from a library directory
    .get('/api/resources/libs/directory/:libraryName', ({ params, set }) => {
        const { libraryName } = params;

        // Try common paths first, then libs
        let libPath = path.join(COMMON_PATH, libraryName);
        let urlPrefix = `/app/common/${libraryName}`;

        if (!deps.fs.existsSync(libPath)) {
            libPath = path.join(LIBS_PATH, libraryName);
            urlPrefix = `/libs/${libraryName}`;
        }

        if (!deps.fs.existsSync(libPath)) {
            set.status = 404;
            return { error: 'Not Found', message: `Library ${libraryName} not found` };
        }

        // Include libraryName as path prefix so files end up in libs/{libraryName}/ in exports
        return buildFileList(libPath, urlPrefix, libraryName);
    })

    // GET /api/resources/content-css - Get content CSS files (base.css, etc.)
    // Serves from workarea/ directory but exports use path content/css/ for compatibility
    .get('/api/resources/content-css', () => {
        const cssPath = 'public/style/workarea';
        if (!deps.fs.existsSync(cssPath)) {
            return [];
        }

        // Build list with full relative path (content/css/base.css) for exporter compatibility
        const files = scanDirectory(cssPath).filter(f => f.endsWith('.css'));
        const version = getAppVersion();
        const basePath = getBasePath();

        return files.map(filePath => ({
            path: `content/css/${filePath}`, // Full path expected by exporters
            url: `${basePath}/${version}/style/workarea/${filePath}`,
        }));
    })

    // =========================================================================
    // Bundle Endpoints (ZIP bundles for optimized fetching)
    // Note: Bundles are stored without version in path. Version is only used
    // in URLs as a virtual cache buster (controlled by APP_VERSION env var).
    // =========================================================================

    // GET /api/resources/bundle/manifest - Get bundle manifest with hashes
    .get('/api/resources/bundle/manifest', ({ set }) => {
        // Bundles stored at root of BUNDLES_PATH (no version in physical path)
        const manifestPath = path.join(BUNDLES_PATH, 'manifest.json');

        if (!deps.fs.existsSync(manifestPath)) {
            set.status = 404;
            return { error: 'Not Found', message: 'Bundle manifest not found. Run build:resource-bundles.' };
        }

        try {
            const manifest = JSON.parse(deps.fs.readFileSync(manifestPath, 'utf-8'));
            // Add current runtime version to manifest response (for cache coordination)
            return { ...manifest, runtimeVersion: getAppVersion() };
        } catch {
            set.status = 500;
            return { error: 'Internal Error', message: 'Failed to read bundle manifest' };
        }
    })

    // GET /api/resources/bundle/theme/:themeName - Get theme ZIP bundle
    .get('/api/resources/bundle/theme/:themeName', async ({ params, set }) => {
        const { themeName } = params;

        // Check for pre-built bundle (base themes) - no version in physical path
        const prebuiltPath = path.join(BUNDLES_PATH, 'themes', `${themeName}.zip`);

        if (deps.fs.existsSync(prebuiltPath)) {
            set.headers['content-type'] = 'application/zip';
            set.headers['cache-control'] = 'public, max-age=31536000, immutable';
            return Bun.file(prebuiltPath);
        }

        // Note: User themes are stored client-side in IndexedDB, not on server
        // Check if this is a site theme that needs on-demand ZIP generation
        const siteThemesPath = getSiteThemesPath();
        const siteThemePath = path.join(siteThemesPath, themeName);
        if (deps.fs.existsSync(siteThemePath)) {
            // Generate ZIP on-the-fly for site themes
            const files = scanDirectory(siteThemePath);
            if (files.length === 0) {
                set.status = 404;
                return { error: 'Not Found', message: `Theme ${themeName} is empty` };
            }

            // Use fflate to create ZIP dynamically
            const { zipSync } = await import('fflate');
            const zipData: { [key: string]: Uint8Array } = {};

            for (const filePath of files) {
                const fullPath = path.join(siteThemePath, filePath);
                try {
                    const content = deps.fs.readFileSync(fullPath) as Buffer;
                    zipData[filePath] = new Uint8Array(content);
                } catch {
                    // Skip files that can't be read
                }
            }

            const zipBuffer = zipSync(zipData, { level: 6 });

            set.headers['content-type'] = 'application/zip';
            set.headers['cache-control'] = 'private, max-age=3600'; // Shorter cache for admin themes
            return new Response(zipBuffer);
        }

        set.status = 404;
        return { error: 'Not Found', message: `Theme bundle ${themeName} not found` };
    })

    // GET /api/resources/bundle/idevices - Get all iDevices ZIP bundle
    .get('/api/resources/bundle/idevices', ({ set }) => {
        // No version in physical path - bundles stored at root
        const bundlePath = path.join(BUNDLES_PATH, 'idevices.zip');

        if (!deps.fs.existsSync(bundlePath)) {
            set.status = 404;
            return { error: 'Not Found', message: 'iDevices bundle not found. Run build:resource-bundles.' };
        }

        set.headers['content-type'] = 'application/zip';
        set.headers['cache-control'] = 'public, max-age=31536000, immutable';
        return Bun.file(bundlePath);
    })

    // GET /api/resources/bundle/libs - Get base libraries ZIP bundle
    .get('/api/resources/bundle/libs', ({ set }) => {
        // No version in physical path - bundles stored at root
        const bundlePath = path.join(BUNDLES_PATH, 'libs.zip');

        if (!deps.fs.existsSync(bundlePath)) {
            set.status = 404;
            return { error: 'Not Found', message: 'Libraries bundle not found. Run build:resource-bundles.' };
        }

        set.headers['content-type'] = 'application/zip';
        set.headers['cache-control'] = 'public, max-age=31536000, immutable';
        return Bun.file(bundlePath);
    })

    // GET /api/resources/bundle/common - Get common libraries ZIP bundle
    .get('/api/resources/bundle/common', ({ set }) => {
        // No version in physical path - bundles stored at root
        const bundlePath = path.join(BUNDLES_PATH, 'common.zip');

        if (!deps.fs.existsSync(bundlePath)) {
            set.status = 404;
            return { error: 'Not Found', message: 'Common libraries bundle not found. Run build:resource-bundles.' };
        }

        set.headers['content-type'] = 'application/zip';
        set.headers['cache-control'] = 'public, max-age=31536000, immutable';
        return Bun.file(bundlePath);
    })

    // GET /api/resources/bundle/content-css - Get content CSS ZIP bundle
    .get('/api/resources/bundle/content-css', ({ set }) => {
        // No version in physical path - bundles stored at root
        const bundlePath = path.join(BUNDLES_PATH, 'content-css.zip');

        if (!deps.fs.existsSync(bundlePath)) {
            set.status = 404;
            return { error: 'Not Found', message: 'Content CSS bundle not found. Run build:resource-bundles.' };
        }

        set.headers['content-type'] = 'application/zip';
        set.headers['cache-control'] = 'public, max-age=31536000, immutable';
        return Bun.file(bundlePath);
    });

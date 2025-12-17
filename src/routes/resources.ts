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
const THEMES_BASE_PATH = 'public/files/perm/themes/base';
const THEMES_USERS_PATH = 'public/files/perm/themes/users';
const IDEVICES_BASE_PATH = 'public/files/perm/idevices/base';
const IDEVICES_USERS_PATH = 'public/files/perm/idevices/users';
const LIBS_PATH = 'public/libs';
const COMMON_PATH = 'public/app/common';

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
 */
function buildFileList(dirPath: string, urlPrefix: string): ResourceFile[] {
    const files = scanDirectory(dirPath);
    const version = getAppVersion();
    const basePath = getBasePath();

    return files.map(filePath => ({
        path: filePath,
        url: `${basePath}/${version}${urlPrefix}/${filePath}`,
    }));
}

/**
 * Resources routes
 */
export const resourcesRoutes = new Elysia({ name: 'resources-routes' })
    // GET /api/resources/theme/:themeName - Get all files for a theme
    .get('/api/resources/theme/:themeName', ({ params, set }) => {
        const { themeName } = params;

        // Check user themes first, then base themes
        let themePath = path.join(THEMES_USERS_PATH, themeName);
        let urlPrefix = `/files/perm/themes/users/${themeName}`;

        if (!deps.fs.existsSync(themePath)) {
            themePath = path.join(THEMES_BASE_PATH, themeName);
            urlPrefix = `/files/perm/themes/base/${themeName}`;
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
    .get('/api/resources/libs/base', () => {
        const version = getAppVersion();
        const basePath = getBasePath();

        // Return essential libraries for exports
        const baseLibs: ResourceFile[] = [
            { path: 'jquery/jquery.min.js', url: `${basePath}/${version}/libs/jquery/jquery.min.js` },
            { path: 'jquery-ui/jquery-ui.min.js', url: `${basePath}/${version}/libs/jquery-ui/jquery-ui.min.js` },
        ];

        // Check which files actually exist
        return baseLibs.filter(lib => deps.fs.existsSync(path.join(LIBS_PATH, lib.path)));
    })

    // GET /api/resources/libs/scorm - Get SCORM JavaScript files
    .get('/api/resources/libs/scorm', () => {
        const scormPath = path.join(COMMON_PATH, 'scorm');
        if (!deps.fs.existsSync(scormPath)) {
            return [];
        }
        return buildFileList(scormPath, '/app/common/scorm');
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

        return buildFileList(libPath, urlPrefix);
    })

    // GET /api/resources/schemas/:format - Get XSD schemas for a format
    .get('/api/resources/schemas/:format', ({ params }) => {
        const { format } = params;

        // Schema files are typically in public/files/perm/schemas/
        const schemasPath = path.join('public/files/perm/schemas', format);
        if (!deps.fs.existsSync(schemasPath)) {
            return [];
        }

        return buildFileList(schemasPath, `/files/perm/schemas/${format}`);
    })

    // GET /api/resources/content-css - Get content CSS files (base.css, etc.)
    .get('/api/resources/content-css', () => {
        const cssPath = 'public/style/content/css';
        if (!deps.fs.existsSync(cssPath)) {
            return [];
        }

        // Build list with full relative path (content/css/base.css) for exporter compatibility
        const files = scanDirectory(cssPath);
        const version = getAppVersion();
        const basePath = getBasePath();

        return files.map(filePath => ({
            path: `content/css/${filePath}`, // Full path expected by exporters
            url: `${basePath}/${version}/style/content/css/${filePath}`,
        }));
    });

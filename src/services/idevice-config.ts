/**
 * iDevice Configuration Service
 * Loads iDevice configs from config.xml files and caches them in memory.
 * This is the single source of truth for iDevice configuration.
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { parseIdeviceConfig } from '../shared/parsers/idevice-parser';

export interface IdeviceConfigCache {
    cssClass: string;
    componentType: 'json' | 'html';
    template: string;
    /**
     * Absolute path to the iDevice directory on disk (the folder that contains
     * `config.xml`, `edition/`, `export/`). `null` for fallback configs that
     * were not loaded from disk.
     */
    sourcePath: string | null;
}

// In-memory cache - null means not loaded
let configCache: Map<string, IdeviceConfigCache> | null = null;

// Configured scan paths in priority order (later overrides earlier).
// `null` means "use defaults" (base + site).
let idevicesScanPaths: string[] | null = null;

/**
 * Default scan paths in priority order: base first, then site.
 * Site iDevices (admin-installed) override base iDevices with the same id.
 */
function getDefaultPaths(): string[] {
    const root = path.join(process.cwd(), 'public/files/perm/idevices');
    return [path.join(root, 'base'), path.join(root, 'site')];
}

/**
 * Set the scan paths for iDevices. Pass an array in priority order — later
 * paths override earlier ones for iDevices with the same id. Resets cache.
 *
 * Typical usage:
 *   - Server start: `setIdevicesPaths([base, site])` (the default if unset)
 *   - Per-user export: `setIdevicesPaths([base, site, users/{userId}])`
 *   - Tests: `setIdevicesPaths([testFixtureDir])`
 */
export function setIdevicesPaths(paths: string[]): void {
    idevicesScanPaths = [...paths];
    configCache = null;
}

/**
 * Set a single base path for iDevices directory. Equivalent to
 * `setIdevicesPaths([basePath])`. Kept for back-compat with tests and callers
 * that scoped the service to a single fixture directory.
 */
export function setIdevicesBasePath(basePath: string): void {
    setIdevicesPaths([basePath]);
}

/**
 * Get the configured scan paths, falling back to defaults (base + site).
 */
function getPaths(): string[] {
    return idevicesScanPaths ?? getDefaultPaths();
}

/**
 * Parse a single iDevice directory and return its cache entry, or `null` if
 * the directory does not contain a usable `config.xml`.
 */
function parseIdeviceDir(ideviceDir: string, dirName: string): { name: string; entry: IdeviceConfigCache } | null {
    const configPath = path.join(ideviceDir, 'config.xml');
    if (!fs.existsSync(configPath)) return null;

    try {
        const xmlContent = fs.readFileSync(configPath, 'utf-8');
        const config = parseIdeviceConfig(xmlContent, {
            ideviceId: dirName,
            basePath: ideviceDir,
            fs: {
                existsSync: fs.existsSync,
                readFileSync: fs.readFileSync,
                readdirSync: target => fs.readdirSync(target) as string[],
            },
            path,
        });
        if (!config) return null;

        const entry: IdeviceConfigCache = {
            cssClass: config.cssClass,
            componentType: config.componentType === 'json' ? 'json' : 'html',
            template: config.exportTemplateFilename || `${dirName}.html`,
            sourcePath: ideviceDir,
        };

        return { name: config.name, entry };
    } catch (err) {
        console.warn(`[IdeviceConfig] Failed to parse ${configPath}:`, err);
        return null;
    }
}

/**
 * Load all iDevice configs from `config.xml` files across the configured
 * scan paths. Later paths override earlier ones for the same id.
 *
 * @param customPaths Optional override:
 *   - `string`: single-path scan (back-compat for tests scoping to a fixture)
 *   - `string[]`: list of paths in priority order
 *   - `undefined`: use the configured scan paths (defaults to base + site)
 */
export function loadIdeviceConfigs(customPaths?: string | string[]): void {
    const paths: string[] = customPaths ? (Array.isArray(customPaths) ? customPaths : [customPaths]) : getPaths();

    configCache = new Map();
    let loaded = 0;
    const missing: string[] = [];

    for (const basePath of paths) {
        if (!fs.existsSync(basePath)) {
            missing.push(basePath);
            continue;
        }

        const entries = fs.readdirSync(basePath, { withFileTypes: true });
        for (const dirEntry of entries) {
            if (!dirEntry.isDirectory() || dirEntry.name.startsWith('.')) continue;

            const result = parseIdeviceDir(path.join(basePath, dirEntry.name), dirEntry.name);
            if (!result) continue;

            const { name, entry } = result;
            configCache.set(name, entry);
            configCache.set(name.toLowerCase(), entry);
            // Also store by directory name for legacy compatibility
            configCache.set(dirEntry.name, entry);
            configCache.set(dirEntry.name.toLowerCase(), entry);
            loaded += 1;
        }
    }

    if (missing.length > 0) {
        // Only warn if NO path exists; missing optional paths (e.g. site/ before
        // any admin install) are normal and should not be noisy.
        if (missing.length === paths.length) {
            console.warn(`[IdeviceConfig] No iDevices paths found: ${missing.join(', ')}`);
        }
    }

    console.log(`[IdeviceConfig] Loaded ${loaded} iDevice configs from ${paths.length - missing.length} paths`);
}

/**
 * Type name mappings for iDevices
 * Maps alternative names to canonical folder names
 */
const IDEVICE_TYPE_ALIASES: Record<string, string> = {
    // Text/FreeText variations
    freetext: 'text',
    freetextidevice: 'text',
    textidevice: 'text',
    // Legacy JsIdevice type normalization (matches browser ElpxImporter behavior)
    js: 'text',
    // Alternative names
    'download-package': 'download-source-file',
    // Spanish → English mappings
    adivina: 'guess',
    'adivina-activity': 'guess',
    listacotejo: 'checklist',
    'listacotejo-activity': 'checklist',
    ordena: 'sort',
    clasifica: 'classify',
    relaciona: 'relate',
    completa: 'complete',
    // Plural → singular
    rubrics: 'rubric',
};

/**
 * Normalize iDevice type name to canonical form
 */
function normalizeTypeName(type: string): string {
    if (!type) return 'text';
    const normalized = type.toLowerCase().replace(/-?idevice$/i, '');
    return IDEVICE_TYPE_ALIASES[normalized] || normalized;
}

/**
 * Get iDevice config by type name
 * Falls back to derived config if not found
 */
export function getIdeviceConfig(type: string): IdeviceConfigCache {
    // Lazy load if not initialized
    if (!configCache) {
        loadIdeviceConfigs();
    }

    // Try exact match first, then lowercase
    let config = configCache?.get(type) || configCache?.get(type.toLowerCase());
    if (config) return config;

    // Try normalized type name (handles aliases like 'download-package' -> 'download-source-file')
    const normalizedType = normalizeTypeName(type);
    config = configCache?.get(normalizedType);
    if (config) return config;

    // Fallback: derive config from normalized type name
    return {
        cssClass: normalizedType,
        componentType: 'html', // Default to HTML for unknown iDevices
        template: `${normalizedType}.html`,
        sourcePath: null,
    };
}

/**
 * Check if an iDevice type uses JSON properties
 */
export function isJsonIdevice(type: string): boolean {
    return getIdeviceConfig(type).componentType === 'json';
}

/**
 * Reset cache (for testing)
 */
export function resetIdeviceConfigCache(): void {
    configCache = null;
    idevicesScanPaths = null;
}

/**
 * Get all loaded iDevice configs (for debugging/testing)
 */
export function getAllIdeviceConfigs(): Map<string, IdeviceConfigCache> | null {
    return configCache;
}

/**
 * Resolve the on-disk `export/` folder for an iDevice type.
 *
 * Looks first at the cached `sourcePath` (set when the iDevice was loaded
 * from a real `config.xml`). Falls back to scanning the configured paths
 * for `{path}/{typeName}/export/` so callers don't need to load the cache
 * first.
 */
function resolveExportPath(typeName: string): string | null {
    if (!configCache) loadIdeviceConfigs();

    const cached = configCache?.get(typeName) ?? configCache?.get(typeName.toLowerCase());
    if (cached?.sourcePath) {
        const candidate = path.join(cached.sourcePath, 'export');
        if (fs.existsSync(candidate)) return candidate;
    }

    for (const basePath of getPaths()) {
        const candidate = path.join(basePath, typeName, 'export');
        if (fs.existsSync(candidate)) return candidate;
    }

    return null;
}

/**
 * Get all export files for an iDevice type (JS or CSS)
 * Scans the export folder and returns all files matching the extension,
 * with the main iDevice file first.
 *
 * This ensures dependencies like html2canvas.js are included.
 *
 * @param typeName - The iDevice type name (e.g., 'checklist')
 * @param extension - The file extension to look for ('.js' or '.css')
 * @returns Array of filenames (e.g., ['checklist.js', 'html2canvas.js'])
 */
export function getIdeviceExportFiles(typeName: string, extension: '.js' | '.css'): string[] {
    const exportPath = resolveExportPath(typeName);
    if (!exportPath) {
        // Fallback: return just the main file
        return [`${typeName}${extension}`];
    }

    try {
        const files = fs
            .readdirSync(exportPath)
            .filter(file => {
                // Include files with matching extension, but exclude test files
                if (!file.endsWith(extension)) return false;
                if (file.endsWith('.test.js') || file.endsWith('.spec.js')) return false;
                return true;
            })
            .sort((a, b) => {
                // Main file first, then alphabetically
                if (a === `${typeName}${extension}`) return -1;
                if (b === `${typeName}${extension}`) return 1;
                return a.localeCompare(b);
            });

        return files.length > 0 ? files : [`${typeName}${extension}`];
    } catch {
        return [`${typeName}${extension}`];
    }
}

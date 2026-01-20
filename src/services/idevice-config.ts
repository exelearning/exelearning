/**
 * iDevice Configuration Service
 * Loads iDevice configs from config.xml files and caches them in memory.
 * This is the single source of truth for iDevice configuration.
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

export interface IdeviceConfigCache {
    cssClass: string;
    componentType: 'json' | 'html';
    template: string;
}

// In-memory cache - null means not loaded
let configCache: Map<string, IdeviceConfigCache> | null = null;

// Base path for iDevices (can be overridden for testing)
let idevicesBasePath: string | null = null;

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
});

/**
 * Set the base path for iDevices directory
 * Used for testing or custom installations
 */
export function setIdevicesBasePath(basePath: string): void {
    idevicesBasePath = basePath;
    // Reset cache when path changes
    configCache = null;
}

/**
 * Get the base path for iDevices
 */
function getBasePath(): string {
    return idevicesBasePath || path.join(process.cwd(), 'public/files/perm/idevices/base');
}

/**
 * Load all iDevice configs from config.xml files
 */
export function loadIdeviceConfigs(customBasePath?: string): void {
    const basePath = customBasePath || getBasePath();
    configCache = new Map();

    if (!fs.existsSync(basePath)) {
        console.warn(`[IdeviceConfig] iDevices path not found: ${basePath}`);
        return;
    }

    const entries = fs.readdirSync(basePath, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

        const configPath = path.join(basePath, entry.name, 'config.xml');
        if (!fs.existsSync(configPath)) continue;

        try {
            const xmlContent = fs.readFileSync(configPath, 'utf-8');
            const parsed = parser.parse(xmlContent);
            const idevice = parsed.idevice || {};

            const getValue = (key: string): string => {
                const val = idevice[key];
                if (typeof val === 'string') return val;
                if (val && typeof val === 'object' && '#text' in val) return val['#text'];
                return '';
            };

            const config: IdeviceConfigCache = {
                cssClass: getValue('css-class') || entry.name,
                componentType: (getValue('component-type') || 'html') as 'json' | 'html',
                template: getValue('export-template-filename') || `${entry.name}.html`,
            };

            // Store by iDevice name (from config.xml)
            const name = getValue('name') || entry.name;
            configCache.set(name, config);
            configCache.set(name.toLowerCase(), config);

            // Also store by directory name (for legacy compatibility)
            configCache.set(entry.name, config);
            configCache.set(entry.name.toLowerCase(), config);
        } catch (err) {
            console.warn(`[IdeviceConfig] Failed to parse ${configPath}:`, err);
        }
    }

    console.log(`[IdeviceConfig] Loaded ${configCache.size} iDevice configs`);
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
}

/**
 * Get all loaded iDevice configs (for debugging/testing)
 */
export function getAllIdeviceConfigs(): Map<string, IdeviceConfigCache> | null {
    return configCache;
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
    const basePath = getBasePath();
    const exportPath = path.join(basePath, typeName, 'export');

    if (!fs.existsSync(exportPath)) {
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

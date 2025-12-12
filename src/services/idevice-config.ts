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
 * Get iDevice config by type name
 * Falls back to derived config if not found
 */
export function getIdeviceConfig(type: string): IdeviceConfigCache {
    // Lazy load if not initialized
    if (!configCache) {
        loadIdeviceConfigs();
    }

    // Try exact match first, then lowercase
    const config = configCache?.get(type) || configCache?.get(type.toLowerCase());
    if (config) return config;

    // Fallback: derive config from type name
    const baseName = type.replace(/Idevice$/i, '').toLowerCase();
    return {
        cssClass: baseName,
        componentType: 'html', // Default to HTML for unknown iDevices
        template: `${baseName}.html`,
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

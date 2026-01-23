/**
 * Unified Import System - TypeScript Interfaces
 *
 * These interfaces provide a common abstraction layer for the import system,
 * enabling the same import code to work in both:
 * - Frontend (browser): Using IndexedDB for assets
 * - Backend (CLI): Using filesystem for assets
 */

/**
 * Progress phases during import
 */
export type ImportPhase = 'decompress' | 'assets' | 'structure' | 'precache';

/**
 * Progress information reported during import
 */
export interface ImportProgress {
    phase: ImportPhase;
    percent: number;
    message: string;
}

/**
 * Asset metadata for storage
 */
export interface AssetMetadata {
    filename: string;
    mimeType: string;
    /** Folder path within the project (e.g., 'resources/', 'images/') */
    folderPath?: string;
    /** Original path from the ZIP file */
    originalPath?: string;
}

/**
 * Asset handler interface
 * Allows different implementations for browser (IndexedDB) and server (filesystem)
 */
export interface AssetHandler {
    /**
     * Store an asset and return its ID
     * @param id - Asset identifier (UUID)
     * @param data - Asset binary data
     * @param metadata - Asset metadata
     * @returns Asset ID (may be same as input or generated)
     */
    storeAsset(id: string, data: Uint8Array, metadata: AssetMetadata): Promise<string>;

    /**
     * Extract all assets from a ZIP object
     * @param zip - Extracted ZIP files object from fflate {path: Uint8Array}
     * @returns Map of original path to asset ID
     */
    extractAssetsFromZip(zip: Record<string, Uint8Array>): Promise<Map<string, string>>;

    /**
     * Convert {{context_path}} references to asset:// URLs
     * @param html - HTML content with {{context_path}} references
     * @param assetMap - Map of original paths to asset IDs
     * @returns HTML with asset:// URLs
     */
    convertContextPathToAssetRefs(html: string, assetMap: Map<string, string>): string;

    /**
     * Preload all assets for immediate rendering (optional)
     */
    preloadAllAssets?(): Promise<void>;

    /**
     * Clear all stored assets (optional)
     */
    clear?(): Promise<void>;
}

/**
 * Import options
 */
export interface ElpxImportOptions {
    /** If true, clears existing structure before import (default: true) */
    clearExisting?: boolean;
    /** Parent page ID to import under (null for root level) */
    parentId?: string | null;
    /** Progress callback */
    onProgress?: (progress: ImportProgress) => void;
    /** Clear IndexedDB before import (for testing) */
    clearIndexedDB?: boolean;
}

/**
 * Import result statistics
 */
export interface ElpxImportResult {
    pages: number;
    blocks: number;
    components: number;
    assets: number;
    /** Theme name from imported project (if any) */
    theme?: string | null;
}

/**
 * Logger interface for cross-environment logging
 */
export interface Logger {
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

/**
 * Default logger implementation (no-op for tests, console for runtime)
 */
export const defaultLogger: Logger = {
    log: (...args) => {
        if (process.env.DEBUG === '1' || process.env.APP_DEBUG === '1') {
            console.log(...args);
        }
    },
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};

/**
 * Block property defaults (from ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG)
 */
export const BLOCK_PROPERTY_DEFAULTS = {
    visibility: 'true',
    teacherOnly: 'false',
    allowToggle: 'true',
    minimized: 'false',
    identifier: '',
    cssClass: '',
} as const;

/**
 * Component property defaults
 */
export const COMPONENT_PROPERTY_DEFAULTS = {
    visibility: 'true',
    teacherOnly: 'false',
    identifier: '',
    cssClass: '',
} as const;

/**
 * Page property defaults
 */
export const PAGE_PROPERTY_DEFAULTS = {
    visibility: 'true',
    highlight: 'false',
    hidePageTitle: 'false',
    editableInPage: 'false',
    titlePage: '',
    titleNode: '',
} as const;

/**
 * Legacy iDevice type name aliases
 * Maps old type names to new standardized names
 */
export const LEGACY_TYPE_ALIASES: Record<string, string> = {
    'download-package': 'download-source-file',
};

/**
 * Plain JS data structure for a page (before Yjs conversion)
 */
export interface PageData {
    id: string;
    pageId: string;
    pageName: string;
    title: string;
    parentId: string | null;
    order: number;
    createdAt: string;
    blocks: BlockData[];
    properties: Record<string, unknown>;
}

/**
 * Plain JS data structure for a block (before Yjs conversion)
 */
export interface BlockData {
    id: string;
    blockId: string;
    blockName: string;
    iconName: string;
    order: number;
    createdAt: string;
    components: ComponentData[];
    properties: Record<string, unknown>;
}

/**
 * Plain JS data structure for a component (before Yjs conversion)
 */
export interface ComponentData {
    id: string;
    ideviceId: string;
    ideviceType: string;
    type: string;
    order: number;
    createdAt: string;
    htmlView: string;
    properties: Record<string, unknown> | null;
    componentProps: Record<string, string>;
    structureProps: Record<string, unknown>;
}

/**
 * Metadata extracted from ODE properties
 */
export interface OdeMetadata {
    title: string;
    subtitle: string;
    author: string;
    language: string;
    description: string;
    license: string;
    theme: string;
    addPagination: boolean;
    addSearchBox: boolean;
    addExeLink: boolean;
    addAccessibilityToolbar: boolean;
    exportSource: boolean;
    extraHeadContent: string;
    footer: string;
    /** Enable MathJax for LaTeX rendering (default: false) */
    addMathJax: boolean;
    /** Global font family (default: 'default') */
    globalFont: string;
}

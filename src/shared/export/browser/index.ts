/**
 * Browser Entry Point for Export System
 *
 * This module provides browser-compatible exports for the unified export system.
 * It wraps the TypeScript exporters and adapters for use with browser-based
 * Yjs documents, IndexedDB asset cache, and fetch-based resource loading.
 *
 * Bundle this file for browser use:
 *   bun build src/shared/export/browser/index.ts --outfile public/app/yjs/exporters.bundle.js --target browser
 *
 * Usage in browser:
 * ```javascript
 * const exporter = window.createExporter('html5', documentManager, assetCache, resourceFetcher);
 * await exporter.export();
 * ```
 */

// Import adapters
import { YjsDocumentAdapter } from '../adapters/YjsDocumentAdapter';
import { BrowserResourceProvider } from '../adapters/BrowserResourceProvider';
import { BrowserAssetProvider } from '../adapters/BrowserAssetProvider';
import { ExportAssetResolver } from '../adapters/ExportAssetResolver';

// Import providers
import { FflateZipProvider } from '../providers/FflateZipProvider';

// Import exporters
import { Html5Exporter } from '../exporters/Html5Exporter';
import { PageExporter } from '../exporters/PageExporter';
import { Scorm12Exporter } from '../exporters/Scorm12Exporter';
import { Scorm2004Exporter } from '../exporters/Scorm2004Exporter';
import { ImsExporter } from '../exporters/ImsExporter';
import { Epub3Exporter } from '../exporters/Epub3Exporter';
import { ElpxExporter } from '../exporters/ElpxExporter';
import { PrintPreviewExporter } from '../exporters/PrintPreviewExporter';
import type { PrintPreviewOptions, PrintPreviewResult } from '../exporters/PrintPreviewExporter';
import { ComponentExporter } from '../exporters/ComponentExporter';

// Import renderers
import { IdeviceRenderer } from '../renderers/IdeviceRenderer';
import { PageRenderer } from '../renderers/PageRenderer';

// Import generators
import { Scorm12ManifestGenerator } from '../generators/Scorm12Manifest';
import { Scorm2004ManifestGenerator } from '../generators/Scorm2004Manifest';
import { ImsManifestGenerator } from '../generators/ImsManifest';
import { LomMetadataGenerator } from '../generators/LomMetadata';

// Import utilities
import { LibraryDetector } from '../utils/LibraryDetector';

// Import types
import type { ExportOptions } from '../interfaces';

/**
 * Yjs Document Manager interface (browser class)
 */
interface YjsDocumentManagerLike {
    getMetadata(): unknown;
    getNavigation(): unknown;
    projectId: string | number;
}

/**
 * Asset Cache Manager interface (legacy browser class)
 */
interface AssetCacheManagerLike {
    getAllAssets(): Promise<unknown[]>;
    getAssetByPath(path: string): Promise<unknown>;
    resolveAssetUrl(path: string): Promise<string | null>;
}

/**
 * Asset Manager interface (new browser class - preferred for exports)
 * Contains actual imported assets in IndexedDB 'exelearning-assets-v2' database
 */
interface AssetManagerLike {
    getProjectAssets(): Promise<unknown[]>;
    getAsset?(assetId: string): Promise<unknown>;
    resolveAssetURL?(assetUrl: string): Promise<string | null>;
}

/**
 * Resource Fetcher interface (browser class)
 */
interface ResourceFetcherLike {
    fetchTheme(themeName: string): Promise<Map<string, Blob>>;
    fetchIdevice(ideviceType: string): Promise<Map<string, Blob>>;
    fetchBaseLibraries(): Promise<Map<string, Blob>>;
    fetchScormFiles(): Promise<Map<string, Blob>>;
    fetchLibraryFiles(paths: string[]): Promise<Map<string, Blob>>;
    fetchLibraryDirectory(libraryName: string): Promise<Map<string, Blob>>;
    fetchSchemas(format: string): Promise<Map<string, Blob>>;
}

/**
 * Export format type
 */
type ExportFormat = 'html5' | 'html5-sp' | 'page' | 'scorm12' | 'scorm2004' | 'ims' | 'epub3' | 'elpx' | 'component';

/**
 * Create a null-safe resource provider that returns empty results
 * Used when ResourceFetcher is not available
 */
function createNullResourceProvider() {
    return {
        fetchTheme: async () => new Map<string, Uint8Array>(),
        fetchIdeviceResources: async () => new Map<string, Uint8Array>(),
        fetchBaseLibraries: async () => new Map<string, Uint8Array>(),
        fetchScormFiles: async () => new Map<string, Uint8Array>(),
        fetchLibraryFiles: async () => new Map<string, Uint8Array>(),
        fetchLibraryDirectory: async () => new Map<string, Uint8Array>(),
        fetchSchemas: async () => new Map<string, Uint8Array>(),
        normalizeIdeviceType: (type: string) => type.toLowerCase().replace(/idevice$/i, '') || 'text',
    };
}

/**
 * Create a null-safe asset provider that returns empty results
 * Used when AssetCacheManager is not available
 */
function createNullAssetProvider() {
    return {
        getAsset: async () => null,
        hasAsset: async () => false,
        listAssets: async () => [],
        getAllAssets: async () => [],
        resolveAssetUrl: async () => null,
        getProjectAssets: async () => [],
    };
}

/**
 * Create an exporter instance for the specified format
 *
 * @param format - Export format (html5, html5-sp, scorm12, scorm2004, ims, epub3, elpx)
 * @param documentManager - YjsDocumentManager instance
 * @param assetCache - AssetCacheManager instance (legacy, optional)
 * @param resourceFetcher - ResourceFetcher instance (optional, but required for exports with themes)
 * @param assetManager - AssetManager instance (new, preferred for exports with assets)
 * @returns Exporter instance ready for export
 */
export function createExporter(
    format: ExportFormat | string,
    documentManager: YjsDocumentManagerLike,
    assetCache: AssetCacheManagerLike | null,
    resourceFetcher: ResourceFetcherLike | null,
    assetManager?: AssetManagerLike | null,
) {
    // Validate required dependencies
    if (!documentManager) {
        throw new Error('[SharedExporters] documentManager is required for export');
    }

    // Create adapters with null-safe wrappers
    const document = new YjsDocumentAdapter(documentManager as Parameters<typeof YjsDocumentAdapter>[0]);

    // Create resource provider with null-safe fallback
    const resources = resourceFetcher
        ? new BrowserResourceProvider(resourceFetcher as Parameters<typeof BrowserResourceProvider>[0])
        : createNullResourceProvider();

    // Create asset provider with null-safe fallback
    // BrowserAssetProvider now supports both assetCache and assetManager
    // assetManager is preferred as it contains actual imported assets
    const assets =
        assetCache || assetManager
            ? new BrowserAssetProvider(
                  assetCache as Parameters<typeof BrowserAssetProvider>[0],
                  assetManager as Parameters<typeof BrowserAssetProvider>[1],
              )
            : createNullAssetProvider();

    const zip = new FflateZipProvider();

    // Normalize format
    const normalizedFormat = format.toLowerCase().replace('-', '');

    // Create appropriate exporter
    switch (normalizedFormat) {
        case 'html5':
        case 'web':
            return new Html5Exporter(document, resources, assets, zip);

        case 'html5sp':
        case 'page':
            return new PageExporter(document, resources, assets, zip);

        case 'scorm12':
        case 'scorm':
            return new Scorm12Exporter(document, resources, assets, zip);

        case 'scorm2004':
            return new Scorm2004Exporter(document, resources, assets, zip);

        case 'ims':
        case 'imscp':
            return new ImsExporter(document, resources, assets, zip);

        case 'epub3':
        case 'epub':
            return new Epub3Exporter(document, resources, assets, zip);

        case 'elpx':
        case 'elp':
            return new ElpxExporter(document, resources, assets, zip);

        case 'component':
        case 'block':
        case 'idevice':
            return new ComponentExporter(document, resources, assets, zip);

        default:
            throw new Error(`Unknown export format: ${format}`);
    }
}

/**
 * LaTeX pre-renderer hooks interface
 */
interface LatexPreRendererHooks {
    preRenderLatex: (
        html: string,
    ) => Promise<{ html: string; hasLatex: boolean; latexRendered: boolean; count: number }>;
    preRenderDataGameLatex: (html: string) => Promise<{ html: string; count: number }>;
}

/**
 * Mermaid pre-renderer hooks interface
 */
interface MermaidPreRendererHooks {
    preRenderMermaid: (
        html: string,
    ) => Promise<{ html: string; hasMermaid: boolean; mermaidRendered: boolean; count: number }>;
}

/**
 * Get LaTeX pre-renderer hooks if available in browser context
 * @returns Object with preRenderLatex and preRenderDataGameLatex, or undefined
 */
function getLatexPreRendererHooks(): LatexPreRendererHooks | undefined {
    if (typeof window === 'undefined') return undefined;

    const windowLatexPreRenderer = (
        window as unknown as {
            LatexPreRenderer?: {
                preRender: (
                    html: string,
                ) => Promise<{ html: string; hasLatex: boolean; latexRendered: boolean; count: number }>;
                preRenderDataGameLatex: (html: string) => Promise<{ html: string; count: number }>;
            };
        }
    ).LatexPreRenderer;
    const windowMathJax = (window as unknown as { MathJax?: unknown }).MathJax;

    if (windowLatexPreRenderer && windowMathJax) {
        return {
            preRenderLatex: windowLatexPreRenderer.preRender.bind(windowLatexPreRenderer),
            preRenderDataGameLatex: windowLatexPreRenderer.preRenderDataGameLatex.bind(windowLatexPreRenderer),
        };
    }

    return undefined;
}

/**
 * Get Mermaid pre-renderer hooks if available in browser context
 *
 * Note: Only requires MermaidPreRenderer to be loaded (not mermaid library).
 * MermaidPreRenderer.preRender() will dynamically load mermaid if needed.
 *
 * @returns Object with preRenderMermaid, or undefined
 */
function getMermaidPreRendererHooks(): MermaidPreRendererHooks | undefined {
    if (typeof window === 'undefined') return undefined;

    const windowMermaidPreRenderer = (
        window as unknown as {
            MermaidPreRenderer?: {
                preRender: (
                    html: string,
                ) => Promise<{ html: string; hasMermaid: boolean; mermaidRendered: boolean; count: number }>;
            };
        }
    ).MermaidPreRenderer;

    // Only require MermaidPreRenderer to be loaded.
    // The preRender function will load mermaid library dynamically if needed.
    if (windowMermaidPreRenderer) {
        return {
            preRenderMermaid: windowMermaidPreRenderer.preRender.bind(windowMermaidPreRenderer),
        };
    }

    return undefined;
}

/**
 * Quick export function - creates exporter and runs export in one call
 *
 * @param format - Export format
 * @param documentManager - YjsDocumentManager instance
 * @param assetCache - AssetCacheManager instance (legacy, optional)
 * @param resourceFetcher - ResourceFetcher instance (optional)
 * @param options - Export options
 * @param assetManager - AssetManager instance (new, preferred for assets)
 * @returns Export result with data buffer
 */
export async function quickExport(
    format: ExportFormat | string,
    documentManager: YjsDocumentManagerLike,
    assetCache: AssetCacheManagerLike | null,
    resourceFetcher: ResourceFetcherLike | null,
    options?: ExportOptions,
    assetManager?: AssetManagerLike | null,
) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher, assetManager);

    // Wire up LaTeX pre-renderer hooks if available in browser context
    const latexHooks = getLatexPreRendererHooks();
    // Wire up Mermaid pre-renderer hooks if available in browser context
    const mermaidHooks = getMermaidPreRendererHooks();
    const exportOptions = { ...options, ...latexHooks, ...mermaidHooks };

    return exporter.export(exportOptions);
}

/**
 * Export and download - creates ZIP and triggers browser download
 *
 * @param format - Export format
 * @param documentManager - YjsDocumentManager instance
 * @param assetCache - AssetCacheManager instance (legacy, optional)
 * @param resourceFetcher - ResourceFetcher instance (optional)
 * @param filename - Download filename (without extension)
 * @param options - Export options
 * @param assetManager - AssetManager instance (new, preferred for assets)
 */
export async function exportAndDownload(
    format: ExportFormat | string,
    documentManager: YjsDocumentManagerLike,
    assetCache: AssetCacheManagerLike | null,
    resourceFetcher: ResourceFetcherLike | null,
    filename: string,
    options?: ExportOptions,
    assetManager?: AssetManagerLike | null,
) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher, assetManager);

    // Wire up LaTeX pre-renderer hooks if available in browser context
    const latexHooks = getLatexPreRendererHooks();
    // Wire up Mermaid pre-renderer hooks if available in browser context
    const mermaidHooks = getMermaidPreRendererHooks();
    const exportOptions = { ...options, ...latexHooks, ...mermaidHooks };

    const result = await exporter.export(exportOptions);

    if (!result.success || !result.data) {
        throw new Error(result.error || 'Export failed');
    }

    // Get file extension from exporter
    const extension = exporter.getFileExtension();
    const fullFilename = filename.endsWith(extension) ? filename : `${filename}${extension}`;

    // Create download
    const blob = new Blob([result.data], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fullFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return result;
}

/**
 * Generate print preview HTML from Yjs document
 * Creates a single-page HTML with all pages visible for printing
 *
 * @param documentManager - YjsDocumentManager instance
 * @param resourceFetcher - ResourceFetcher instance (optional, for theme info)
 * @param options - Preview options (baseUrl, basePath, version)
 * @returns Preview result with HTML string
 */
export async function generatePrintPreview(
    documentManager: YjsDocumentManagerLike,
    resourceFetcher: ResourceFetcherLike | null,
    options?: PrintPreviewOptions,
): Promise<PrintPreviewResult> {
    const document = new YjsDocumentAdapter(documentManager as Parameters<typeof YjsDocumentAdapter>[0]);
    const resources = resourceFetcher
        ? new BrowserResourceProvider(resourceFetcher as Parameters<typeof BrowserResourceProvider>[0])
        : createNullResourceProvider();
    const exporter = new PrintPreviewExporter(document, resources as Parameters<typeof PrintPreviewExporter>[1]);

    // Wire up LaTeX pre-renderer hooks if available in browser context
    const latexHooks = getLatexPreRendererHooks();
    // Wire up Mermaid pre-renderer hooks if available in browser context
    const mermaidHooks = getMermaidPreRendererHooks();

    options = {
        ...options,
        ...latexHooks,
        ...mermaidHooks,
    };

    return exporter.generatePreview(options);
}

/**
 * Create a print preview exporter for advanced usage
 *
 * @param documentManager - YjsDocumentManager instance
 * @param resourceFetcher - ResourceFetcher instance (optional)
 * @returns PrintPreviewExporter instance
 */
export function createPrintPreviewExporter(
    documentManager: YjsDocumentManagerLike,
    resourceFetcher: ResourceFetcherLike | null,
): PrintPreviewExporter {
    const document = new YjsDocumentAdapter(documentManager as Parameters<typeof YjsDocumentAdapter>[0]);
    const resources = resourceFetcher
        ? new BrowserResourceProvider(resourceFetcher as Parameters<typeof BrowserResourceProvider>[0])
        : createNullResourceProvider();
    return new PrintPreviewExporter(document, resources as Parameters<typeof PrintPreviewExporter>[1]);
}

/**
 * Preview files result for Service Worker-based preview
 */
export interface PreviewFilesResult {
    success: boolean;
    files?: Record<string, ArrayBuffer>;
    error?: string;
}

/**
 * Generate preview files for Service Worker-based preview
 *
 * Uses Html5Exporter to generate the same files as HTML export,
 * enabling unified preview/export rendering via the eXeViewer approach.
 *
 * @param documentManager - YjsDocumentManager instance
 * @param assetCache - AssetCacheManager instance (legacy, optional)
 * @param resourceFetcher - ResourceFetcher instance (optional)
 * @param assetManager - AssetManager instance (new, preferred for assets)
 * @param options - Export options (theme override, etc.)
 * @returns Preview files result with file map
 */
export async function generatePreviewForSW(
    documentManager: YjsDocumentManagerLike,
    assetCache: AssetCacheManagerLike | null,
    resourceFetcher: ResourceFetcherLike | null,
    assetManager?: AssetManagerLike | null,
    options?: ExportOptions,
): Promise<PreviewFilesResult> {
    try {
        // Validate required dependencies
        if (!documentManager) {
            throw new Error('[SharedExporters] documentManager is required for preview');
        }

        // Create adapters with null-safe wrappers
        const document = new YjsDocumentAdapter(documentManager as Parameters<typeof YjsDocumentAdapter>[0]);

        // Create resource provider with null-safe fallback
        const resources = resourceFetcher
            ? new BrowserResourceProvider(resourceFetcher as Parameters<typeof BrowserResourceProvider>[0])
            : createNullResourceProvider();

        // Create asset provider with null-safe fallback
        const assets =
            assetCache || assetManager
                ? new BrowserAssetProvider(
                      assetCache as Parameters<typeof BrowserAssetProvider>[0],
                      assetManager as Parameters<typeof BrowserAssetProvider>[1],
                  )
                : createNullAssetProvider();

        // Create a null zip provider (not needed for preview files)
        const zip = new FflateZipProvider();

        // Create Html5Exporter
        const exporter = new Html5Exporter(document, resources, assets, zip);

        // Wire up LaTeX pre-renderer hooks if available in browser context
        const latexHooks = getLatexPreRendererHooks();
        // Wire up Mermaid pre-renderer hooks if available in browser context
        const mermaidHooks = getMermaidPreRendererHooks();
        const exportOptions = { ...options, ...latexHooks, ...mermaidHooks };

        // Generate preview files (Map<string, Uint8Array | string>)
        const filesMap = await exporter.generateForPreview(exportOptions);

        // Convert to plain object with ArrayBuffer values for SW transfer
        const files: Record<string, ArrayBuffer> = {};
        for (const [path, content] of filesMap) {
            if (content instanceof Uint8Array) {
                files[path] = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
            } else if (typeof content === 'string') {
                const encoder = new TextEncoder();
                const encoded = encoder.encode(content);
                files[path] = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
            } else {
                files[path] = content as ArrayBuffer;
            }
        }

        console.log(`[SharedExporters] Generated ${Object.keys(files).length} preview files for SW`);

        return {
            success: true,
            files,
        };
    } catch (error) {
        console.error('[SharedExporters] generatePreviewForSW failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// Export classes for advanced usage
export {
    // Adapters
    YjsDocumentAdapter,
    BrowserResourceProvider,
    BrowserAssetProvider,
    ExportAssetResolver,
    // Providers
    FflateZipProvider,
    // Exporters
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    Epub3Exporter,
    ElpxExporter,
    PrintPreviewExporter,
    ComponentExporter,
    // Renderers
    IdeviceRenderer,
    PageRenderer,
    // Generators
    Scorm12ManifestGenerator,
    Scorm2004ManifestGenerator,
    ImsManifestGenerator,
    LomMetadataGenerator,
    // Utilities
    LibraryDetector,
};

// Export types for TypeScript consumers
export type { PrintPreviewOptions, PrintPreviewResult };

// Expose to window for browser use
if (typeof window !== 'undefined') {
    const windowExports = {
        // Factory functions
        createExporter,
        quickExport,
        exportAndDownload,
        // SW-based preview functions
        generatePreviewForSW,
        // Print preview functions
        generatePrintPreview,
        createPrintPreviewExporter,
        // Adapters
        YjsDocumentAdapter,
        BrowserResourceProvider,
        BrowserAssetProvider,
        ExportAssetResolver,
        // Providers
        FflateZipProvider,
        // Exporters
        Html5Exporter,
        PageExporter,
        Scorm12Exporter,
        Scorm2004Exporter,
        ImsExporter,
        Epub3Exporter,
        ElpxExporter,
        PrintPreviewExporter,
        ComponentExporter,
        // Renderers
        IdeviceRenderer,
        PageRenderer,
        // Generators
        Scorm12ManifestGenerator,
        Scorm2004ManifestGenerator,
        ImsManifestGenerator,
        LomMetadataGenerator,
        // Utilities
        LibraryDetector,
    };

    // Also expose PrintPreviewExporter at window level for direct access
    (window as unknown as { PrintPreviewExporter: typeof PrintPreviewExporter }).PrintPreviewExporter =
        PrintPreviewExporter;
    (window as unknown as { generatePrintPreview: typeof generatePrintPreview }).generatePrintPreview =
        generatePrintPreview;

    // Export as SharedExporters namespace
    (window as unknown as { SharedExporters: typeof windowExports }).SharedExporters = windowExports;

    // Also expose createExporter at window level for compatibility
    (window as unknown as { createSharedExporter: typeof createExporter }).createSharedExporter = createExporter;
    (window as unknown as { createExporter: typeof createExporter }).createExporter = createExporter;

    // Expose ElpxExporter at window level for legacy compatibility
    // This ensures the shared TypeScript ElpxExporter is used instead of the fallback in public/app/yjs/ElpxExporter.js
    (window as unknown as { ElpxExporter: typeof ElpxExporter }).ElpxExporter = ElpxExporter;

    console.log('[SharedExporters] Browser export system loaded');
}

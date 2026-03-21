/**
 * Browser Entry Point for Export System
 *
 * This module provides browser-compatible exports for the unified export system.
 * It wraps the TypeScript exporters and adapters for use with browser-based
 * Yjs documents, IndexedDB asset cache, and fetch-based resource loading.
 *
 * Bundle this file for browser use:
 *   bun run bundle:exporters (outputs to public/app/yjs/exporters.bundle.js)
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
import { PageElpxExporter } from '../exporters/PageElpxExporter';

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
import '../../../../public/app/common/LatexPreRenderer.js';

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
        fetchContentCss: async () => new Map<string, Uint8Array>(),
        normalizeIdeviceType: (type: string) => type.toLowerCase().replace(/idevice$/i, '') || 'text',
        fetchExeLogo: async () => null,
        fetchGlobalFontFiles: async () => new Map<string, Uint8Array>(),
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
    // biome-ignore lint/suspicious/noExplicitAny: legacy Yjs document manager compatibility
    const document = new YjsDocumentAdapter(documentManager as any);

    // Create resource provider with null-safe fallback
    // Create resource provider with null-safe fallback
    let resources;
    if (resourceFetcher) {
        // biome-ignore lint/suspicious/noExplicitAny: legacy resource fetcher compatibility
        resources = new BrowserResourceProvider(resourceFetcher as any);
    } else {
        resources = createNullResourceProvider();
    }

    // Create asset provider with null-safe fallback
    // BrowserAssetProvider now supports both assetCache and assetManager
    // assetManager is preferred as it contains actual imported assets
    // Create asset provider with null-safe fallback
    // BrowserAssetProvider now supports both assetCache and assetManager
    // assetManager is preferred as it contains actual imported assets
    let assets;
    if (assetCache || assetManager) {
        assets = new BrowserAssetProvider(
            // biome-ignore lint/suspicious/noExplicitAny: legacy asset cache compatibility
            assetCache as any,
            // biome-ignore lint/suspicious/noExplicitAny: legacy asset manager compatibility
            assetManager as any,
        );
    } else {
        assets = createNullAssetProvider();
    }

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

        case 'pageelpx':
        case 'pageelp':
            return new PageElpxExporter(document, resources, assets, zip);

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

interface LatexDebugEntry {
    step: string;
    timestamp: number;
    details?: Record<string, unknown>;
}

function pushLatexDebug(step: string, details?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    const w = window as unknown as {
        __latexExportDebug?: LatexDebugEntry[];
    };
    if (!w.__latexExportDebug) {
        w.__latexExportDebug = [];
    }
    w.__latexExportDebug.push({
        step,
        timestamp: Date.now(),
        details,
    });
}

let latexPreRendererLoadPromise: Promise<boolean> | null = null;

async function ensureLatexPreRendererLoaded(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const windowWithLatex = window as unknown as {
        LatexPreRenderer?: {
            preRender: (
                html: string,
            ) => Promise<{ html: string; hasLatex: boolean; latexRendered: boolean; count: number }>;
            preRenderDataGameLatex: (html: string) => Promise<{ html: string; count: number }>;
        };
    };

    if (windowWithLatex.LatexPreRenderer) {
        pushLatexDebug('ensureLatexPreRendererLoaded.alreadyLoaded');
        return true;
    }

    if (latexPreRendererLoadPromise) {
        pushLatexDebug('ensureLatexPreRendererLoaded.awaitExistingPromise');
        return latexPreRendererLoadPromise;
    }

    latexPreRendererLoadPromise = new Promise<boolean>(resolve => {
        const existing = Array.from(document.querySelectorAll('script[src]')).find(script =>
            script.getAttribute('src')?.includes('/app/common/LatexPreRenderer.js'),
        ) as HTMLScriptElement | undefined;

        if (existing) {
            pushLatexDebug('ensureLatexPreRendererLoaded.foundExistingScript', {
                src: existing.getAttribute('src') || '',
            });
            existing.addEventListener('load', () => resolve(!!windowWithLatex.LatexPreRenderer), { once: true });
            existing.addEventListener('error', () => resolve(false), { once: true });
            // If already loaded, resolve immediately.
            if (windowWithLatex.LatexPreRenderer) {
                resolve(true);
            }
            return;
        }

        const exportersScript = Array.from(document.querySelectorAll('script[src]')).find(script => {
            const src = script.getAttribute('src') || '';
            return src.includes('/app/yjs/exporters.bundle.js') || src.endsWith('exporters.bundle.js');
        }) as HTMLScriptElement | undefined;

        const exportersSrc = exportersScript?.getAttribute('src') || '';
        const latexSrc = exportersSrc
            ? exportersSrc.replace(/\/yjs\/exporters\.bundle\.js(\?.*)?$/, '/common/LatexPreRenderer.js')
            : '/app/common/LatexPreRenderer.js';

        const script = document.createElement('script');
        script.src = latexSrc;
        script.async = true;
        script.onload = () => {
            pushLatexDebug('ensureLatexPreRendererLoaded.injectedScriptLoaded', { src: latexSrc });
            resolve(!!windowWithLatex.LatexPreRenderer);
        };
        script.onerror = () => {
            pushLatexDebug('ensureLatexPreRendererLoaded.injectedScriptError', { src: latexSrc });
            resolve(false);
        };
        pushLatexDebug('ensureLatexPreRendererLoaded.injectedScript', { src: latexSrc });
        document.head.appendChild(script);
    });

    const loaded = await latexPreRendererLoadPromise;
    pushLatexDebug('ensureLatexPreRendererLoaded.resolved', { loaded });
    if (!loaded) {
        latexPreRendererLoadPromise = null;
    }
    return loaded;
}

/**
 * Get LaTeX pre-renderer hooks if available in browser context
 * @returns Object with preRenderLatex and preRenderDataGameLatex, or undefined
 */
async function ensureMathJaxForLatexPreRender(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const windowWithMath = window as unknown as {
        MathJax?: { tex2svg?: unknown };
        $exe?: {
            math?: {
                loadMathJax?: (cb?: () => void) => void;
            };
        };
    };

    if (typeof windowWithMath.MathJax?.tex2svg === 'function') {
        pushLatexDebug('ensureMathJaxForLatexPreRender.alreadyReady');
        return true;
    }

    const loadMathJax = windowWithMath.$exe?.math?.loadMathJax;
    if (typeof loadMathJax !== 'function') {
        const exportersScript = Array.from(document.querySelectorAll('script[src]')).find(script => {
            const src = script.getAttribute('src') || '';
            return src.includes('/app/yjs/exporters.bundle.js') || src.endsWith('exporters.bundle.js');
        }) as HTMLScriptElement | undefined;

        const exportersSrc = exportersScript?.getAttribute('src') || '';
        const mathJaxSrc = exportersSrc
            ? exportersSrc.replace(/\/yjs\/exporters\.bundle\.js(\?.*)?$/, '/common/exe_math/tex-mml-svg.js')
            : '/app/common/exe_math/tex-mml-svg.js';

        if (!document.querySelector(`script[src="${mathJaxSrc}"]`)) {
            // Minimal config for pre-rendering context (export/preview generation).
            windowWithMath.MathJax = windowWithMath.MathJax || {
                tex: {
                    inlineMath: [['\\(', '\\)']],
                    displayMath: [
                        ['$$', '$$'],
                        ['\\[', '\\]'],
                    ],
                    processEscapes: true,
                    tags: 'ams',
                },
            };

            await new Promise<void>(resolve => {
                const script = document.createElement('script');
                script.src = mathJaxSrc;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => resolve();
                pushLatexDebug('ensureMathJaxForLatexPreRender.injectScript', { src: mathJaxSrc });
                document.head.appendChild(script);
            });
        }
    } else {
        pushLatexDebug('ensureMathJaxForLatexPreRender.useLoadMathJax');
        await new Promise<void>(resolve => {
            try {
                loadMathJax(() => resolve());
            } catch {
                resolve();
            }
        });
    }

    // Wait briefly for tex2svg to become available after script load.
    const maxWaitMs = 5000;
    const intervalMs = 50;
    let elapsed = 0;
    while (elapsed < maxWaitMs) {
        if (typeof windowWithMath.MathJax?.tex2svg === 'function') {
            pushLatexDebug('ensureMathJaxForLatexPreRender.readyAfterWait', { elapsed });
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        elapsed += intervalMs;
    }

    pushLatexDebug('ensureMathJaxForLatexPreRender.failed');
    return false;
}

async function getLatexPreRendererHooks(): Promise<LatexPreRendererHooks | undefined> {
    if (typeof window === 'undefined') return undefined;

    const latexRendererReady = await ensureLatexPreRendererLoaded();
    if (!latexRendererReady) {
        pushLatexDebug('getLatexPreRendererHooks.rendererNotReady');
        return undefined;
    }

    pushLatexDebug('getLatexPreRendererHooks.rendererReady');
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
    if (!windowLatexPreRenderer) {
        return undefined;
    }

    return {
        preRenderLatex: async (html: string) => {
            const mathReady = await ensureMathJaxForLatexPreRender();
            const result = await windowLatexPreRenderer.preRender(html);
            pushLatexDebug('preRenderLatex.called', {
                mathReady,
                hasLatex: result.hasLatex,
                latexRendered: result.latexRendered,
                count: result.count,
            });
            return result;
        },
        preRenderDataGameLatex: async (html: string) => {
            const mathReady = await ensureMathJaxForLatexPreRender();
            const result = await windowLatexPreRenderer.preRenderDataGameLatex(html);
            pushLatexDebug('preRenderDataGameLatex.called', {
                mathReady,
                count: result.count,
            });
            return result;
        },
    };
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
    const latexHooks = await getLatexPreRendererHooks();
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
    const latexHooks = await getLatexPreRendererHooks();
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
    // biome-ignore lint/suspicious/noExplicitAny: legacy blob data compatibility
    const blob = new Blob([result.data as any], { type: 'application/zip' });
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
 * @param assetProvider - Optional AssetProvider (or manager/cache to create it)
 * @returns Preview result with HTML string
 */
export async function generatePrintPreview(
    documentManager: YjsDocumentManagerLike,
    resourceFetcher: ResourceFetcherLike | null,
    options?: PrintPreviewOptions,
    assetManager?: AssetManagerLike | AssetCacheManagerLike | null,
): Promise<PrintPreviewResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // biome-ignore lint/suspicious/noExplicitAny: legacy Yjs document manager compatibility
    const document = new YjsDocumentAdapter(documentManager as any);

    let resources;
    if (resourceFetcher) {
        // biome-ignore lint/suspicious/noExplicitAny: legacy resource fetcher compatibility
        resources = new BrowserResourceProvider(resourceFetcher as any);
    } else {
        resources = createNullResourceProvider();
    }

    // Construct AssetProvider
    let assets: BrowserAssetProvider | null = null;
    if (assetManager) {
        // Determine if it's the new Manager or old Cache based on property check
        const isNewManager = 'getProjectAssets' in assetManager;
        // biome-ignore lint/suspicious/noExplicitAny: legacy asset cache compatibility
        const cache = isNewManager ? null : (assetManager as any);
        // biome-ignore lint/suspicious/noExplicitAny: legacy asset manager compatibility
        const manager = isNewManager ? (assetManager as any) : null;

        assets = new BrowserAssetProvider(cache, manager);
    }

    const exporter = new PrintPreviewExporter(
        document,
        // biome-ignore lint/suspicious/noExplicitAny: legacy resource provider compatibility
        resources as any,
        assets,
    );

    // Wire up LaTeX pre-renderer hooks if available in browser context
    const latexHooks = await getLatexPreRendererHooks();
    // Wire up Mermaid pre-renderer hooks if available in browser context
    const mermaidHooks = getMermaidPreRendererHooks();

    const previewOptions = {
        ...options,
        ...latexHooks,
        ...mermaidHooks,
    };

    return exporter.generatePreview(previewOptions);
}

/**
 * Create a print preview exporter for advanced usage
 *
 * @param documentManager - YjsDocumentManager instance
 * @param resourceFetcher - ResourceFetcher instance (optional)
 * @param assetManager - AssetManager instance (optional)
 * @returns PrintPreviewExporter instance
 */
export function createPrintPreviewExporter(
    documentManager: YjsDocumentManagerLike,
    resourceFetcher: ResourceFetcherLike | null,
    assetManager?: AssetManagerLike | AssetCacheManagerLike | null,
): PrintPreviewExporter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // biome-ignore lint/suspicious/noExplicitAny: legacy Yjs document manager compatibility
    const document = new YjsDocumentAdapter(documentManager as any);

    let resources;
    if (resourceFetcher) {
        // biome-ignore lint/suspicious/noExplicitAny: legacy resource fetcher compatibility
        resources = new BrowserResourceProvider(resourceFetcher as any);
    } else {
        resources = createNullResourceProvider();
    }

    // Construct AssetProvider
    let assets: BrowserAssetProvider | null = null;
    if (assetManager) {
        const isNewManager = 'getProjectAssets' in assetManager;
        // biome-ignore lint/suspicious/noExplicitAny: legacy asset cache compatibility
        const cache = isNewManager ? null : (assetManager as any);
        // biome-ignore lint/suspicious/noExplicitAny: legacy asset manager compatibility
        const manager = isNewManager ? (assetManager as any) : null;

        assets = new BrowserAssetProvider(cache, manager);
    }

    return new PrintPreviewExporter(
        document,
        // biome-ignore lint/suspicious/noExplicitAny: resource provider compatibility
        resources as any,
        assets,
    );
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
        // biome-ignore lint/suspicious/noExplicitAny: legacy Yjs document manager compatibility
        const document = new YjsDocumentAdapter(documentManager as any);

        // Create resource provider with null-safe fallback
        // Create resource provider with null-safe fallback
        let resources;
        if (resourceFetcher) {
            // biome-ignore lint/suspicious/noExplicitAny: legacy resource fetcher compatibility
            resources = new BrowserResourceProvider(resourceFetcher as any);
        } else {
            resources = createNullResourceProvider();
        }

        // Create asset provider with null-safe fallback
        // Create asset provider with null-safe fallback
        let assets;
        if (assetCache || assetManager) {
            assets = new BrowserAssetProvider(
                // biome-ignore lint/suspicious/noExplicitAny: legacy asset cache compatibility
                assetCache as any,
                // biome-ignore lint/suspicious/noExplicitAny: legacy asset manager compatibility
                assetManager as any,
            );
        } else {
            assets = createNullAssetProvider();
        }

        // Create a null zip provider (not needed for preview files)
        const zip = new FflateZipProvider();

        // Create Html5Exporter
        const exporter = new Html5Exporter(document, resources, assets, zip);

        // Wire up LaTeX pre-renderer hooks if available in browser context
        const latexHooks = await getLatexPreRendererHooks();
        // Wire up Mermaid pre-renderer hooks if available in browser context
        const mermaidHooks = getMermaidPreRendererHooks();
        const exportOptions = { ...options, ...latexHooks, ...mermaidHooks };

        // Generate preview files (Map<string, ArrayBuffer>)
        const filesMap = await exporter.generateForPreview(exportOptions);

        // Preserve exporter-owned ArrayBuffers to avoid a second full copy before SW transfer.
        const files = Object.fromEntries(filesMap) as Record<string, ArrayBuffer>;

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
    PageElpxExporter,
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
        PageElpxExporter,
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

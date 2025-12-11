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

// Import providers
import { JSZipZipProvider } from '../providers/JSZipZipProvider';

// Import exporters
import { Html5Exporter } from '../exporters/Html5Exporter';
import { PageExporter } from '../exporters/PageExporter';
import { Scorm12Exporter } from '../exporters/Scorm12Exporter';
import { Scorm2004Exporter } from '../exporters/Scorm2004Exporter';
import { ImsExporter } from '../exporters/ImsExporter';

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
 * Asset Cache Manager interface (browser class)
 */
interface AssetCacheManagerLike {
    getAllAssets(): Promise<unknown[]>;
    getAssetByPath(path: string): Promise<unknown>;
    resolveAssetUrl(path: string): Promise<string | null>;
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
type ExportFormat = 'html5' | 'html5-sp' | 'page' | 'scorm12' | 'scorm2004' | 'ims' | 'epub3' | 'elpx';

/**
 * Create an exporter instance for the specified format
 *
 * @param format - Export format (html5, html5-sp, scorm12, scorm2004, ims, epub3, elpx)
 * @param documentManager - YjsDocumentManager instance
 * @param assetCache - AssetCacheManager instance
 * @param resourceFetcher - ResourceFetcher instance
 * @returns Exporter instance ready for export
 */
export function createExporter(
    format: ExportFormat | string,
    documentManager: YjsDocumentManagerLike,
    assetCache: AssetCacheManagerLike,
    resourceFetcher: ResourceFetcherLike,
) {
    // Create adapters
    const document = new YjsDocumentAdapter(documentManager as Parameters<typeof YjsDocumentAdapter>[0]);
    const resources = new BrowserResourceProvider(resourceFetcher as Parameters<typeof BrowserResourceProvider>[0]);
    const assets = new BrowserAssetProvider(assetCache as Parameters<typeof BrowserAssetProvider>[0]);
    const zip = new JSZipZipProvider();

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
            throw new Error('EPUB3 export not yet implemented in shared code');

        case 'elpx':
        case 'elp':
            throw new Error('ELPX export not yet implemented in shared code');

        default:
            throw new Error(`Unknown export format: ${format}`);
    }
}

/**
 * Quick export function - creates exporter and runs export in one call
 *
 * @param format - Export format
 * @param documentManager - YjsDocumentManager instance
 * @param assetCache - AssetCacheManager instance
 * @param resourceFetcher - ResourceFetcher instance
 * @param options - Export options
 * @returns Export result with data buffer
 */
export async function quickExport(
    format: ExportFormat | string,
    documentManager: YjsDocumentManagerLike,
    assetCache: AssetCacheManagerLike,
    resourceFetcher: ResourceFetcherLike,
    options?: ExportOptions,
) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher);
    return exporter.export(options);
}

/**
 * Export and download - creates ZIP and triggers browser download
 *
 * @param format - Export format
 * @param documentManager - YjsDocumentManager instance
 * @param assetCache - AssetCacheManager instance
 * @param resourceFetcher - ResourceFetcher instance
 * @param filename - Download filename (without extension)
 * @param options - Export options
 */
export async function exportAndDownload(
    format: ExportFormat | string,
    documentManager: YjsDocumentManagerLike,
    assetCache: AssetCacheManagerLike,
    resourceFetcher: ResourceFetcherLike,
    filename: string,
    options?: ExportOptions,
) {
    const exporter = createExporter(format, documentManager, assetCache, resourceFetcher);

    const result = await exporter.export(options);

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

// Export classes for advanced usage
export {
    // Adapters
    YjsDocumentAdapter,
    BrowserResourceProvider,
    BrowserAssetProvider,
    // Providers
    JSZipZipProvider,
    // Exporters
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
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

// Expose to window for browser use
if (typeof window !== 'undefined') {
    const windowExports = {
        // Factory functions
        createExporter,
        quickExport,
        exportAndDownload,
        // Adapters
        YjsDocumentAdapter,
        BrowserResourceProvider,
        BrowserAssetProvider,
        // Providers
        JSZipZipProvider,
        // Exporters
        Html5Exporter,
        PageExporter,
        Scorm12Exporter,
        Scorm2004Exporter,
        ImsExporter,
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

    // Export as SharedExporters namespace
    (window as unknown as { SharedExporters: typeof windowExports }).SharedExporters = windowExports;

    // Also expose createExporter at window level for compatibility
    (window as unknown as { createSharedExporter: typeof createExporter }).createSharedExporter = createExporter;

    console.log('[SharedExporters] Browser export system loaded');
}

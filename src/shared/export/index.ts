/**
 * Unified Export System
 *
 * Shared export code for both frontend (browser) and backend (CLI).
 *
 * Usage (Backend/CLI):
 * ```typescript
 * import { ElpDocumentAdapter, Html5Exporter } from './shared/export';
 * const doc = await ElpDocumentAdapter.fromElpFile('project.elp');
 * const exporter = new Html5Exporter(doc, resourceProvider, assetProvider);
 * const result = await exporter.export();
 * ```
 *
 * Usage (Frontend/Browser):
 * ```typescript
 * import { YjsDocumentAdapter, Html5Exporter } from './shared/export/browser';
 * const doc = new YjsDocumentAdapter(documentManager);
 * const exporter = new Html5Exporter(doc, resourceProvider, assetProvider);
 * const result = await exporter.export();
 * ```
 */

// Interfaces
export type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ExportBlock,
    ExportComponent,
    ExportBlockProperties,
    ResourceProvider,
    AssetProvider,
    ExportAsset,
    ZipProvider,
    ZipArchive,
    ExportOptions,
    Html5ExportOptions,
    ScormExportOptions,
    ImsExportOptions,
    Epub3ExportOptions,
    ElpxExportOptions,
    ExportResult,
    AssetResolver,
    AssetResolverOptions,
    PageRenderOptions,
    ComponentRenderOptions,
    BlockRenderOptions,
    IdeviceConfig,
    LibraryPattern,
    LibraryDetectionResult,
    LibraryDetectionOptions,
    ScormManifestOptions,
    ImsManifestOptions,
    LomMetadataOptions,
    Epub3PackageOptions,
    Exporter,
} from './interfaces';

// Constants
export {
    ExportFormat,
    EXPORT_FORMAT_INFO,
    getIdeviceConfig,
    LIBRARY_PATTERNS,
    BASE_LIBRARIES,
    SCORM_LIBRARIES,
    MIME_TO_EXTENSION,
    getExtensionFromMime,
    SCORM_12_NAMESPACES,
    SCORM_2004_NAMESPACES,
    IMS_NAMESPACES,
    LOM_NAMESPACES,
    EPUB3_NAMESPACES,
    EPUB3_MIMETYPE,
} from './constants';

// iDevice config service (re-exported for convenience)
export { getIdeviceConfig as getIdeviceConfigFromService, isJsonIdevice } from '../../services/idevice-config';

// Utils
export { LibraryDetector } from './utils/LibraryDetector';

// Renderers
export { IdeviceRenderer } from './renderers/IdeviceRenderer';
export type { IdeviceCssLink, IdeviceJsScript } from './renderers/IdeviceRenderer';
export { PageRenderer } from './renderers/PageRenderer';

// Generators
export { Scorm12ManifestGenerator } from './generators/Scorm12Manifest';
export type { PageFileInfo as Scorm12PageFileInfo, Scorm12GenerateOptions } from './generators/Scorm12Manifest';
export { Scorm2004ManifestGenerator } from './generators/Scorm2004Manifest';
export type { Scorm2004GenerateOptions } from './generators/Scorm2004Manifest';
export { ImsManifestGenerator } from './generators/ImsManifest';
export type { ImsGenerateOptions } from './generators/ImsManifest';
export { LomMetadataGenerator } from './generators/LomMetadata';

// Adapters
export { ElpDocumentAdapter } from './adapters/ElpDocumentAdapter';
export type {
    ParsedOdeStructure,
    OdeXmlMeta,
    NormalizedPage,
    NormalizedComponent,
} from './adapters/ElpDocumentAdapter';
export { YjsDocumentAdapter } from './adapters/YjsDocumentAdapter';
export { ServerYjsDocumentWrapper } from './adapters/ServerYjsDocumentWrapper';
export { BrowserResourceProvider } from './adapters/BrowserResourceProvider';
export { BrowserAssetProvider } from './adapters/BrowserAssetProvider';

// Asset Resolvers
export { ExportAssetResolver } from './adapters/ExportAssetResolver';
export { PreviewAssetResolver } from './adapters/PreviewAssetResolver';
export type { AssetCacheManager } from './adapters/PreviewAssetResolver';

// Providers
export { FileSystemResourceProvider } from './providers/FileSystemResourceProvider';
export { FileSystemAssetProvider } from './providers/FileSystemAssetProvider';
export { DatabaseAssetProvider } from './providers/DatabaseAssetProvider';
export { CombinedAssetProvider } from './providers/CombinedAssetProvider';
export {
    FflateZipProvider,
    unzipSync,
    zipSync,
    unzip,
    zip,
    listZipContents,
    readFileFromZip,
    fileExistsInZip,
} from './providers/FflateZipProvider';

// Exporters
export { BaseExporter } from './exporters/BaseExporter';
export { Html5Exporter } from './exporters/Html5Exporter';
export { PageExporter } from './exporters/PageExporter';
export { Scorm12Exporter } from './exporters/Scorm12Exporter';
export { Scorm2004Exporter } from './exporters/Scorm2004Exporter';
export { ImsExporter } from './exporters/ImsExporter';
export { Epub3Exporter } from './exporters/Epub3Exporter';
export { ElpxExporter } from './exporters/ElpxExporter';
export { WebsitePreviewExporter } from './exporters/WebsitePreviewExporter';
export type { PreviewOptions, PreviewResult } from './exporters/WebsitePreviewExporter';
export { PrintPreviewExporter } from './exporters/PrintPreviewExporter';
export type { PrintPreviewOptions, PrintPreviewResult } from './exporters/PrintPreviewExporter';
export { ComponentExporter } from './exporters/ComponentExporter';
export type { ComponentExportResult, ComponentExportOptions } from './exporters/ComponentExporter';

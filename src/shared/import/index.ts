/**
 * Unified Import System
 *
 * Shared import code for both frontend (browser) and backend (CLI).
 *
 * Usage (Backend/CLI):
 * ```typescript
 * import * as Y from 'yjs';
 * import { ElpxImporter, FileSystemAssetHandler } from './shared/import';
 * import { ServerYjsDocumentWrapper, YjsDocumentAdapter } from './shared/export';
 *
 * // Create Y.Doc and import ELP
 * const ydoc = new Y.Doc();
 * const assetHandler = new FileSystemAssetHandler('/tmp/extract');
 * const importer = new ElpxImporter(ydoc, assetHandler);
 * const elpBuffer = await fs.readFile('project.elp');
 * await importer.importFromBuffer(new Uint8Array(elpBuffer));
 *
 * // Use for export
 * const wrapper = new ServerYjsDocumentWrapper(ydoc, 'cli-export');
 * const document = new YjsDocumentAdapter(wrapper);
 * ```
 *
 * Usage (Frontend/Browser):
 * The browser version uses the bundled ElpxImporter with BrowserAssetHandler.
 */

// Interfaces
export type {
    AssetHandler,
    AssetMetadata,
    ElpxImportOptions,
    ElpxImportResult,
    ImportProgress,
    ImportPhase,
    Logger,
    PageData,
    BlockData,
    ComponentData,
    OdeMetadata,
} from './interfaces';

// Constants
export {
    BLOCK_PROPERTY_DEFAULTS,
    COMPONENT_PROPERTY_DEFAULTS,
    PAGE_PROPERTY_DEFAULTS,
    LEGACY_TYPE_ALIASES,
    defaultLogger,
} from './interfaces';

// Main importer
export { ElpxImporter } from './ElpxImporter';

// Legacy format parser
export { LegacyXmlParser } from './LegacyXmlParser';
export type {
    LegacyMetadata,
    LegacyBlockProperties,
    LegacyIdevice,
    LegacyBlock,
    LegacyPage,
    LegacyParseResult,
} from './LegacyXmlParser';

// Asset handlers
export { FileSystemAssetHandler } from './FileSystemAssetHandler';

// Legacy iDevice Handlers (for v2.x ELP format with contentv3.xml)
export type {
    IdeviceHandler,
    IdeviceHandlerContext,
    FeedbackResult,
    BlockProperties,
    ExtractedIdeviceData,
} from './legacy-handlers';
export { isIdeviceHandler } from './legacy-handlers';
export { BaseLegacyHandler } from './legacy-handlers';
export { LegacyHandlerRegistry, LEGACY_TYPE_MAP, getLegacyTypeName } from './legacy-handlers';
export { DefaultHandler } from './legacy-handlers';
export { FreeTextHandler } from './legacy-handlers';
export { MultichoiceHandler } from './legacy-handlers';
export { TrueFalseHandler } from './legacy-handlers';
export { GalleryHandler } from './legacy-handlers';
export { CaseStudyHandler } from './legacy-handlers';
export { FillHandler } from './legacy-handlers';
export { DropdownHandler } from './legacy-handlers';
export { ScormTestHandler } from './legacy-handlers';
export { ExternalUrlHandler } from './legacy-handlers';
export { FileAttachHandler } from './legacy-handlers';
export { ImageMagnifierHandler } from './legacy-handlers';
export { GeogebraHandler } from './legacy-handlers';
export { InteractiveVideoHandler } from './legacy-handlers';
export { GameHandler } from './legacy-handlers';
export { FpdSolvedExerciseHandler } from './legacy-handlers';
export { WikipediaHandler } from './legacy-handlers';
export { RssHandler } from './legacy-handlers';
export { NotaHandler } from './legacy-handlers';

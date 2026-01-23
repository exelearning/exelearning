/**
 * Browser Entry Point for Import System
 *
 * This module provides browser-compatible exports for the unified import system.
 * It exposes:
 * - ElpxImporter: Unified TypeScript importer for .elp/.elpx files
 * - LegacyHandlerRegistry: For legacy ELP file parsing (contentv3.xml)
 * - BrowserAssetHandler: Adapter for browser AssetManager
 *
 * Bundle this file for browser use:
 *   node scripts/build-importers-bundle.js
 *
 * Usage in browser:
 * ```javascript
 * // Create importer with browser managers
 * const importer = window.createBrowserImporter(documentManager, assetManager);
 * const stats = await importer.importFromFile(file);
 *
 * // Or use ElpxImporter directly with lower-level API
 * const ydoc = documentManager.getDoc();
 * const assetHandler = new window.BrowserAssetHandler(assetManager);
 * const importer = new window.ElpxImporter(ydoc, assetHandler);
 * ```
 */

// Import ElpxImporter
import { ElpxImporter } from '../ElpxImporter';

// Import types and interfaces
import type { AssetHandler, ElpxImportOptions, ElpxImportResult, ImportProgress, Logger } from '../interfaces';

// Import browser asset handler
import { BrowserAssetHandler, createBrowserAssetHandler } from '../adapters/BrowserAssetHandler';

// Import registry and type utilities
import { LegacyHandlerRegistry, LEGACY_TYPE_MAP, getLegacyTypeName } from '../legacy-handlers/HandlerRegistry';

// Import base class for handler type checking
import { BaseLegacyHandler } from '../legacy-handlers/BaseLegacyHandler';

// Import individual handlers for direct access if needed
import { DefaultHandler } from '../legacy-handlers/DefaultHandler';
import { FreeTextHandler } from '../legacy-handlers/FreeTextHandler';
import { MultichoiceHandler } from '../legacy-handlers/MultichoiceHandler';
import { TrueFalseHandler } from '../legacy-handlers/TrueFalseHandler';
import { GalleryHandler } from '../legacy-handlers/GalleryHandler';
import { CaseStudyHandler } from '../legacy-handlers/CaseStudyHandler';
import { FillHandler } from '../legacy-handlers/FillHandler';
import { DropdownHandler } from '../legacy-handlers/DropdownHandler';
import { ScormTestHandler } from '../legacy-handlers/ScormTestHandler';
import { ExternalUrlHandler } from '../legacy-handlers/ExternalUrlHandler';
import { FileAttachHandler } from '../legacy-handlers/FileAttachHandler';
import { ImageMagnifierHandler } from '../legacy-handlers/ImageMagnifierHandler';
import { GeogebraHandler } from '../legacy-handlers/GeogebraHandler';
import { InteractiveVideoHandler } from '../legacy-handlers/InteractiveVideoHandler';
import { GameHandler } from '../legacy-handlers/GameHandler';
import { FpdSolvedExerciseHandler } from '../legacy-handlers/FpdSolvedExerciseHandler';
import { WikipediaHandler } from '../legacy-handlers/WikipediaHandler';
import { RssHandler } from '../legacy-handlers/RssHandler';
import { NotaHandler } from '../legacy-handlers/NotaHandler';

// Import types for consumers
import type {
    IdeviceHandler,
    IdeviceHandlerContext,
    FeedbackResult,
    BlockProperties,
    ExtractedIdeviceData,
} from '../legacy-handlers/IdeviceHandler';

// ============================================================================
// Browser Adapter: YjsDocumentManager interface
// ============================================================================

/**
 * Interface matching YjsDocumentManager from public/app/yjs/YjsDocumentManager.js
 */
interface YjsDocumentManagerLike {
    getDoc(): unknown; // Returns Y.Doc
    getNavigation(): unknown; // Returns Y.Array
    getMetadata(): unknown; // Returns Y.Map
    projectId: string | number;
}

/**
 * Interface matching AssetManager from public/app/yjs/AssetManager.js
 */
interface AssetManagerLike {
    init(): Promise<void>;
    extractAssetsFromZip(zip: Record<string, Uint8Array>): Promise<Map<string, string>>;
    convertContextPathToAssetRefs(html: string, assetMap: Map<string, string>): string;
    preloadAllAssets(): Promise<number>;
}

/**
 * Browser logger that uses window.Logger if available
 */
function getBrowserLogger(): Logger {
    if (typeof window !== 'undefined') {
        const windowLogger = (window as unknown as { Logger?: Logger }).Logger;
        if (windowLogger) {
            return windowLogger;
        }
    }
    return {
        log: (...args: unknown[]) => console.log(...args),
        warn: (...args: unknown[]) => console.warn(...args),
        error: (...args: unknown[]) => console.error(...args),
    };
}

/**
 * Browser-compatible ElpxImporter adapter
 *
 * This class provides the same API as the old browser ElpxImporter.js
 * while using the unified TypeScript implementation under the hood.
 */
class BrowserElpxImporter {
    private manager: YjsDocumentManagerLike;
    private assetManager: AssetManagerLike | null;
    private importer: ElpxImporter | null = null;
    private logger: Logger;

    /**
     * @param documentManager - YjsDocumentManager instance
     * @param assetManager - AssetManager instance (optional)
     */
    constructor(documentManager: YjsDocumentManagerLike, assetManager: AssetManagerLike | null = null) {
        this.manager = documentManager;
        this.assetManager = assetManager;
        this.logger = getBrowserLogger();
    }

    /**
     * Initialize the underlying ElpxImporter with Y.Doc
     */
    private getImporter(): ElpxImporter {
        if (!this.importer) {
            const ydoc = this.manager.getDoc() as Parameters<typeof ElpxImporter>[0];
            const assetHandler = this.assetManager ? createBrowserAssetHandler(this.assetManager) : null;
            this.importer = new ElpxImporter(ydoc, assetHandler, this.logger);
        }
        return this.importer;
    }

    /**
     * Import an .elpx file (browser File API)
     * Compatible with the old ElpxImporter.importFromFile() API
     *
     * @param file - The .elpx file to import
     * @param options - Import options
     * @returns Import statistics
     */
    async importFromFile(
        file: File,
        options: ElpxImportOptions & { clearIndexedDB?: boolean } = {},
    ): Promise<ElpxImportResult> {
        const { clearExisting = true, parentId = null, onProgress = null, clearIndexedDB = false } = options;

        this.logger.log(`[BrowserElpxImporter] Importing ${file.name}...`);

        // Optional: Clear IndexedDB (for debugging)
        if (clearIndexedDB && this.assetManager && 'projectId' in this.manager) {
            const dbName = `exelearning-project-${this.manager.projectId}`;
            this.logger.log(`[BrowserElpxImporter] Clearing IndexedDB: ${dbName}`);
            try {
                await new Promise<void>((resolve, reject) => {
                    const request = indexedDB.deleteDatabase(dbName);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                    request.onblocked = () => setTimeout(resolve, 1000);
                });
            } catch (e) {
                console.warn('[BrowserElpxImporter] Failed to clear IndexedDB:', e);
            }
        }

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Get the importer and import
        const importer = this.getImporter();
        return importer.importFromBuffer(buffer, { clearExisting, parentId, onProgress });
    }
}

/**
 * Factory function to create a browser-compatible importer
 *
 * @param documentManager - YjsDocumentManager instance
 * @param assetManager - AssetManager instance (optional)
 * @returns BrowserElpxImporter instance
 */
function createBrowserImporter(
    documentManager: YjsDocumentManagerLike,
    assetManager: AssetManagerLike | null = null,
): BrowserElpxImporter {
    return new BrowserElpxImporter(documentManager, assetManager);
}

// ============================================================================
// Window Exposure
// ============================================================================

// Expose to window for browser use
if (typeof window !== 'undefined') {
    // Main registry - this is what LegacyXmlParser.js expects
    (window as unknown as { LegacyHandlerRegistry: typeof LegacyHandlerRegistry }).LegacyHandlerRegistry =
        LegacyHandlerRegistry;

    // Expose utilities
    (window as unknown as { LEGACY_TYPE_MAP: typeof LEGACY_TYPE_MAP }).LEGACY_TYPE_MAP = LEGACY_TYPE_MAP;
    (window as unknown as { getLegacyTypeName: typeof getLegacyTypeName }).getLegacyTypeName = getLegacyTypeName;

    // Expose ElpxImporter at window level (the unified TypeScript version)
    // This replaces the old browser ElpxImporter.js
    (window as unknown as { ElpxImporter: typeof BrowserElpxImporter }).ElpxImporter = BrowserElpxImporter;

    // Expose low-level TypeScript ElpxImporter for advanced usage
    (window as unknown as { ElpxImporterCore: typeof ElpxImporter }).ElpxImporterCore = ElpxImporter;

    // Expose BrowserAssetHandler for manual construction
    (window as unknown as { BrowserAssetHandler: typeof BrowserAssetHandler }).BrowserAssetHandler =
        BrowserAssetHandler;

    // Expose factory function
    (window as unknown as { createBrowserImporter: typeof createBrowserImporter }).createBrowserImporter =
        createBrowserImporter;

    // Also expose as a namespace for organization
    const windowExports = {
        // ElpxImporter
        ElpxImporter: BrowserElpxImporter,
        ElpxImporterCore: ElpxImporter,
        BrowserAssetHandler,
        createBrowserImporter,
        createBrowserAssetHandler,

        // Registry
        LegacyHandlerRegistry,
        LEGACY_TYPE_MAP,
        getLegacyTypeName,

        // Base class
        BaseLegacyHandler,

        // All handlers
        DefaultHandler,
        FreeTextHandler,
        MultichoiceHandler,
        TrueFalseHandler,
        GalleryHandler,
        CaseStudyHandler,
        FillHandler,
        DropdownHandler,
        ScormTestHandler,
        ExternalUrlHandler,
        FileAttachHandler,
        ImageMagnifierHandler,
        GeogebraHandler,
        InteractiveVideoHandler,
        GameHandler,
        FpdSolvedExerciseHandler,
        WikipediaHandler,
        RssHandler,
        NotaHandler,
    };

    (window as unknown as { SharedImporters: typeof windowExports }).SharedImporters = windowExports;

    console.log('[SharedImporters] Browser import system loaded (with unified ElpxImporter)');
}

// Export types for TypeScript consumers
export type { IdeviceHandler, IdeviceHandlerContext, FeedbackResult, BlockProperties, ExtractedIdeviceData };
export type { AssetHandler, ElpxImportOptions, ElpxImportResult, ImportProgress, Logger };

// Export ElpxImporter classes
export { ElpxImporter, BrowserAssetHandler, createBrowserAssetHandler };

// Export main registry and utilities
export { LegacyHandlerRegistry, LEGACY_TYPE_MAP, getLegacyTypeName };

// Export base class
export { BaseLegacyHandler };

// Export all handlers
export {
    DefaultHandler,
    FreeTextHandler,
    MultichoiceHandler,
    TrueFalseHandler,
    GalleryHandler,
    CaseStudyHandler,
    FillHandler,
    DropdownHandler,
    ScormTestHandler,
    ExternalUrlHandler,
    FileAttachHandler,
    ImageMagnifierHandler,
    GeogebraHandler,
    InteractiveVideoHandler,
    GameHandler,
    FpdSolvedExerciseHandler,
    WikipediaHandler,
    RssHandler,
    NotaHandler,
};

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
import { ElpxImporter, inspectZipArchive } from '../ElpxImporter';

// Import runtime policy: single source of truth for decompression limits and
// the desktop-compatibility check. See #2193.
import {
    CONSERVATIVE_ZIP_LIMITS,
    DESKTOP_ZIP_LIMITS,
    DESKTOP_CONFIRM_ENTRY_BYTES,
    getZipLimitsForRuntime,
    validateZipLimits,
    assertInspectionWithinLimits,
    getDesktopExportCompatibility,
    formatBytes,
    ZipLimitError,
    ImportCancelledError,
} from '../importPolicy';
import type { ZipDecompressionLimits } from '../importPolicy';

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
 * Details passed to an {@link ImportFromFileOptions.onConfirmLargeEntry}
 * callback when an archive contains an entry in the controlled large range.
 */
export interface LargeEntryConfirmInfo {
    /** Name of the largest entry (the one triggering confirmation). */
    entryName: string;
    /** Declared uncompressed size of that entry, in bytes. */
    entryBytes: number;
    /** Total declared uncompressed size of the archive, in bytes. */
    totalBytes: number;
    /** Number of entries in the archive. */
    entryCount: number;
    /** Threshold above which confirmation is required, in bytes. */
    confirmThreshold: number;
    /** Hard per-entry limit for this runtime, in bytes. */
    hardLimitBytes: number;
}

/** Options accepted by {@link BrowserElpxImporter.importFromFile}. */
export type ImportFromFileOptions = ElpxImportOptions & {
    clearIndexedDB?: boolean;
    /**
     * Explicit decompression limits for the current runtime. Injected by the
     * caller (desktop vs hosted); the adapter never detects the runtime itself.
     * Defaults to the conservative limits when omitted.
     */
    zipLimits?: Partial<ZipDecompressionLimits>;
    /** Per-entry size above which confirmation is requested. Defaults to the
     * resolved per-entry hard limit (i.e. no confirmation window). */
    confirmEntryThreshold?: number;
    /** Confirmation callback for a controlled large import (desktop only).
     * Returning false cancels the import before any mutation. */
    onConfirmLargeEntry?: (info: LargeEntryConfirmInfo) => Promise<boolean> | boolean;
    /** Hook run once the preflight gate passes but before inflation/mutation
     * (e.g. clearing the previous project's assets). Never runs on rejection or
     * cancellation, guaranteeing the current project is left unchanged. */
    beforeImport?: () => Promise<void> | void;
};

/**
 * Browser-compatible ElpxImporter adapter
 *
 * This class provides the same API as the old browser ElpxImporter.js
 * while using the unified TypeScript implementation under the hood.
 */
class BrowserElpxImporter {
    private manager: YjsDocumentManagerLike;
    private assetManager: AssetManagerLike | null;
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
     * Build the underlying core ElpxImporter with the resolved limits.
     *
     * A fresh instance is created for every import so a previously-used runtime
     * policy can never be retained (a cached importer bakes its limits in at
     * construction). Imports happen once per file open, so this has no
     * meaningful cost.
     */
    private buildImporter(limits: ZipDecompressionLimits): ElpxImporter {
        const ydoc = this.manager.getDoc() as ConstructorParameters<typeof ElpxImporter>[0];
        const assetHandler = this.assetManager ? createBrowserAssetHandler(this.assetManager) : null;
        return new ElpxImporter(ydoc, assetHandler, this.logger, limits);
    }

    /**
     * Import an .elpx file (browser File API)
     * Compatible with the old ElpxImporter.importFromFile() API
     *
     * The archive is inspected (central directory only, no inflation) and
     * validated against the resolved limits BEFORE anything is decompressed or
     * any project state is mutated. When the largest entry is in the controlled
     * range (above `confirmEntryThreshold` but within the hard limit) and a
     * confirmation callback is supplied, the user is asked before proceeding.
     *
     * @param file - The .elpx file to import
     * @param options - Import options (see {@link ImportFromFileOptions})
     * @returns Import statistics
     */
    async importFromFile(file: File, options: ImportFromFileOptions = {}): Promise<ElpxImportResult> {
        const { clearExisting = true, parentId = null, onProgress = null, clearIndexedDB = false } = options;

        this.logger.log(`[BrowserElpxImporter] Importing ${file.name}...`);

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Resolve and validate the runtime limits at this boundary.
        const label = 'ELP/ELPX archive';
        const limits = validateZipLimits({ ...CONSERVATIVE_ZIP_LIMITS, ...(options.zipLimits ?? {}) });

        // Preflight: read the central directory (no inflation) and reject an
        // over-limit archive with a structured error before any mutation.
        const inspection = inspectZipArchive(buffer, label);
        assertInspectionWithinLimits(inspection, limits, label);

        // Controlled large import: confirm before proceeding (desktop only —
        // hosted callers pass no callback and conservative limits already
        // rejected anything oversized above).
        const confirmThreshold = options.confirmEntryThreshold ?? limits.maxEntryBytes;
        if (
            inspection.largestEntry &&
            inspection.largestEntry.size > confirmThreshold &&
            typeof options.onConfirmLargeEntry === 'function'
        ) {
            const confirmed = await options.onConfirmLargeEntry({
                entryName: inspection.largestEntry.name,
                entryBytes: inspection.largestEntry.size,
                totalBytes: inspection.totalBytes,
                entryCount: inspection.entryCount,
                confirmThreshold,
                hardLimitBytes: limits.maxEntryBytes,
            });
            if (!confirmed) {
                throw new ImportCancelledError('Large ELPX import cancelled by user');
            }
        }

        // Optional: Clear IndexedDB (for debugging). Only after the gate passes.
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

        // Post-gate hook (e.g. clear previous project assets). Runs only when the
        // import is actually going to proceed, so a cancelled/rejected import
        // leaves the current project untouched.
        if (typeof options.beforeImport === 'function') {
            await options.beforeImport();
        }

        // Build a fresh importer with the resolved limits and import.
        const importer = this.buildImporter(limits);
        return importer.importFromBuffer(buffer, { clearExisting, parentId, onProgress: onProgress ?? undefined });
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

/**
 * Import-policy surface exposed to the frontend (as `window.ExeImportPolicy`
 * and `window.SharedImporters.importPolicy`). Bundles the shared limits, the
 * runtime selector, the preflight inspector, the desktop export-compatibility
 * check, the structured error / cancellation types, and the byte formatter so
 * the frontend uses ONE source of truth. See #2193.
 */
const importPolicyNamespace = {
    CONSERVATIVE_ZIP_LIMITS,
    DESKTOP_ZIP_LIMITS,
    DESKTOP_CONFIRM_ENTRY_BYTES,
    getZipLimitsForRuntime,
    validateZipLimits,
    inspectZipArchive,
    assertInspectionWithinLimits,
    getDesktopExportCompatibility,
    formatBytes,
    ZipLimitError,
    ImportCancelledError,
};

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

    // Expose the import policy so the frontend (YjsProjectBridge) can select the
    // runtime limits, run the preflight, and format sizes from ONE source of
    // truth shared with the core importer and the ELPX export warning (#2193).
    (window as unknown as { ExeImportPolicy: typeof importPolicyNamespace }).ExeImportPolicy = importPolicyNamespace;

    // Also expose as a namespace for organization
    const windowExports = {
        // ElpxImporter
        ElpxImporter: BrowserElpxImporter,
        ElpxImporterCore: ElpxImporter,
        BrowserAssetHandler,
        createBrowserImporter,
        createBrowserAssetHandler,

        // Import policy (single source of truth for limits + export warning)
        importPolicy: importPolicyNamespace,

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

// Export the browser import adapter, its factory, and its option types so they
// can be unit-tested and referenced by TypeScript consumers.
export { BrowserElpxImporter, createBrowserImporter };

// Re-export the import policy for TypeScript consumers of the browser barrel.
export {
    CONSERVATIVE_ZIP_LIMITS,
    DESKTOP_ZIP_LIMITS,
    DESKTOP_CONFIRM_ENTRY_BYTES,
    getZipLimitsForRuntime,
    getDesktopExportCompatibility,
    formatBytes,
    ZipLimitError,
    ImportCancelledError,
};

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

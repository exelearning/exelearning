/**
 * Browser Entry Point for Import System
 *
 * This module provides browser-compatible exports for the legacy import handlers.
 * It exposes the TypeScript LegacyHandlerRegistry for use in browser-based
 * legacy ELP file parsing (contentv3.xml Python pickle format).
 *
 * Bundle this file for browser use:
 *   node scripts/build-importers-bundle.js
 *
 * Usage in browser:
 * ```javascript
 * // LegacyHandlerRegistry is exposed globally for LegacyXmlParser.js
 * const handler = LegacyHandlerRegistry.getHandler('MultichoiceIdevice');
 * const properties = handler.extractProperties(dictElement, ideviceId);
 * ```
 */

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

// Expose to window for browser use
if (typeof window !== 'undefined') {
    // Main registry - this is what LegacyXmlParser.js expects
    (window as unknown as { LegacyHandlerRegistry: typeof LegacyHandlerRegistry }).LegacyHandlerRegistry =
        LegacyHandlerRegistry;

    // Expose utilities
    (window as unknown as { LEGACY_TYPE_MAP: typeof LEGACY_TYPE_MAP }).LEGACY_TYPE_MAP = LEGACY_TYPE_MAP;
    (window as unknown as { getLegacyTypeName: typeof getLegacyTypeName }).getLegacyTypeName = getLegacyTypeName;

    // Also expose as a namespace for organization
    const windowExports = {
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

    console.log('[SharedImporters] Browser import system loaded');
}

// Export types for TypeScript consumers
export type { IdeviceHandler, IdeviceHandlerContext, FeedbackResult, BlockProperties, ExtractedIdeviceData };

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

/**
 * Legacy iDevice Handlers
 *
 * Unified handlers for converting legacy eXeLearning v2.x iDevices
 * (from contentv3.xml Python pickle format) to modern structures.
 *
 * These handlers work in both browser and Node.js environments.
 */

// Interfaces
export type {
    IdeviceHandler,
    IdeviceHandlerContext,
    FeedbackResult,
    BlockProperties,
    ExtractedIdeviceData,
} from './IdeviceHandler';
export { isIdeviceHandler } from './IdeviceHandler';

// Base class
export { BaseLegacyHandler } from './BaseLegacyHandler';

// Registry
export { LegacyHandlerRegistry, LEGACY_TYPE_MAP, getLegacyTypeName } from './HandlerRegistry';

// Individual handlers
export { DefaultHandler } from './DefaultHandler';
export { FreeTextHandler } from './FreeTextHandler';
export { MultichoiceHandler } from './MultichoiceHandler';
export { TrueFalseHandler } from './TrueFalseHandler';
export { GalleryHandler } from './GalleryHandler';
export { CaseStudyHandler } from './CaseStudyHandler';
export { FillHandler } from './FillHandler';
export { DropdownHandler } from './DropdownHandler';
export { ScormTestHandler } from './ScormTestHandler';
export { ExternalUrlHandler } from './ExternalUrlHandler';
export { FileAttachHandler } from './FileAttachHandler';
export { ImageMagnifierHandler } from './ImageMagnifierHandler';
export { GeogebraHandler } from './GeogebraHandler';
export { InteractiveVideoHandler } from './InteractiveVideoHandler';
export { GameHandler } from './GameHandler';
export { FpdSolvedExerciseHandler } from './FpdSolvedExerciseHandler';
export { WikipediaHandler } from './WikipediaHandler';
export { RssHandler } from './RssHandler';
export { NotaHandler } from './NotaHandler';

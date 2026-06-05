/**
 * Legacy iDevice Handler Registry
 *
 * Maps legacy iDevice class names to their handlers.
 * Handlers are checked in order - first match wins.
 *
 * DefaultHandler is always last as fallback.
 */

import type { IdeviceHandler } from './IdeviceHandler';

// Import all handlers (will be created in subsequent files)
import { DefaultHandler } from './DefaultHandler';
import { FreeTextHandler } from './FreeTextHandler';
import { MultichoiceHandler } from './MultichoiceHandler';
import { TrueFalseHandler } from './TrueFalseHandler';
import { FillHandler } from './FillHandler';
import { DropdownHandler } from './DropdownHandler';
import { ScormTestHandler } from './ScormTestHandler';
import { CaseStudyHandler } from './CaseStudyHandler';
import { GalleryHandler } from './GalleryHandler';
import { ExternalUrlHandler } from './ExternalUrlHandler';
import { FileAttachHandler } from './FileAttachHandler';
import { ImageMagnifierHandler } from './ImageMagnifierHandler';
import { GeogebraHandler } from './GeogebraHandler';
import { InteractiveVideoHandler } from './InteractiveVideoHandler';
import { GameHandler } from './GameHandler';
import { FpdSolvedExerciseHandler } from './FpdSolvedExerciseHandler';
import { WikipediaHandler } from './WikipediaHandler';
import { RssHandler } from './RssHandler';
import { NotaHandler } from './NotaHandler';

/**
 * Legacy type name to modern type name mapping
 * Used for type normalization when handlers don't provide specific mapping
 */
export const LEGACY_TYPE_MAP: Record<string, string> = {
    // Text/Content iDevices -> text
    FreeTextIdevice: 'text',
    FreeTextfpdIdevice: 'text',
    ReflectionIdevice: 'text',
    ReflectionfpdIdevice: 'text',
    GenericIdevice: 'text',
    SolvedExerciseIdevice: 'text',
    EjercicioResueltoFpdIdevice: 'text',
    WikipediaIdevice: 'text',
    RssIdevice: 'text',

    // Quiz/Form iDevices -> form
    MultichoiceIdevice: 'form',
    MultiSelectIdevice: 'form',
    ListaIdevice: 'form',

    // TrueFalse -> trueorfalse (dedicated iDevice type)
    TrueFalseIdevice: 'trueorfalse',
    VerdaderoFalsoFPDIdevice: 'trueorfalse',
    ClozeIdevice: 'form',
    ClozeActivityIdevice: 'form',
    ClozeLanguageIdevice: 'form',
    ClozeLangIdevice: 'form',
    ScormTestIdevice: 'form',
    QuizTestIdevice: 'form',

    // Case Study
    CaseStudyIdevice: 'casestudy',

    // Media iDevices
    ImageGalleryIdevice: 'image-gallery',
    ImageMagnifierIdevice: 'magnifier',
    GalleryIdevice: 'image-gallery',

    // File iDevices -> text with links
    FileAttachIdevice: 'text',
    FileAttachIdeviceInc: 'text',
    AttachmentIdevice: 'text',

    // External content
    ExternalUrlIdevice: 'external-website',
    GeogebraIdevice: 'geogebra-activity',
    JavaAppIdevice: 'java-app',
};

/**
 * Get modern type name from legacy class name
 * Falls back to extracting type from class name
 *
 * @param className - Legacy class name
 * @returns Modern type name
 */
export function getLegacyTypeName(className: string): string {
    if (!className) return 'text';

    // Extract the iDevice name from class (e.g., 'exe.engine.freetextidevice.FreeTextIdevice' -> 'FreeTextIdevice')
    const parts = className.split('.');
    const ideviceName = parts[parts.length - 1];

    // Check mapping
    if (LEGACY_TYPE_MAP[ideviceName]) {
        return LEGACY_TYPE_MAP[ideviceName];
    }

    // Fallback: normalize the iDevice name
    // Remove 'Idevice' suffix and convert to kebab-case
    const normalized = ideviceName
        .replace(/Idevice$/i, '')
        .replace(/fpd$/i, '') // Remove FPD suffix
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase();

    return normalized || 'text';
}

/**
 * Singleton registry of legacy iDevice handlers
 */
class LegacyHandlerRegistryClass {
    private handlers: IdeviceHandler[] | null = null;

    /**
     * Initialize handlers (called once when needed)
     */
    private init(): void {
        if (this.handlers) return;

        this.handlers = [
            new MultichoiceHandler(), // MultichoiceIdevice, MultiSelectIdevice -> form
            new TrueFalseHandler(), // TrueFalseIdevice -> trueorfalse
            new FillHandler(), // ClozeIdevice, ClozeLanguageIdevice -> form (fill-in-blanks)
            new DropdownHandler(), // ListaIdevice -> form (dropdown questions)
            new ScormTestHandler(), // ScormTestIdevice, QuizTestIdevice -> form (SCORM quiz)
            new CaseStudyHandler(), // CaseStudyIdevice -> casestudy
            new GalleryHandler(), // ImageGalleryIdevice, GalleryIdevice -> image-gallery
            new ExternalUrlHandler(), // ExternalUrlIdevice -> external-website
            new FileAttachHandler(), // FileAttachIdevice, AttachmentIdevice -> text (with file links)
            new ImageMagnifierHandler(), // ImageMagnifierIdevice -> magnifier
            new GeogebraHandler(), // GeogebraIdevice -> geogebra-activity
            new InteractiveVideoHandler(), // JsIdevice interactive-video -> interactive-video
            new GameHandler(), // flipcards, selecciona, trivial, etc. -> game types
            new FpdSolvedExerciseHandler(), // SolvedExerciseIdevice -> text (with Q&A)
            new WikipediaHandler(), // WikipediaIdevice -> text (with wrapper)
            new RssHandler(), // RssIdevice -> text
            new NotaHandler(), // NotaIdevice -> text (with visibility=false block)
            new FreeTextHandler(), // FreeTextIdevice, ReflectionIdevice, GenericIdevice -> text
            new DefaultHandler(), // Fallback for unknown types (must be last)
        ];
    }

    /**
     * Get the appropriate handler for a legacy iDevice class
     *
     * @param className - Legacy class name (e.g., 'exe.engine.multichoiceidevice.MultichoiceIdevice')
     * @param ideviceType - Optional iDevice type (e.g., 'flipcards-activity') for JsIdevice handlers
     * @returns Handler instance
     */
    getHandler(className: string, ideviceType?: string): IdeviceHandler {
        this.init();
        for (const handler of this.handlers!) {
            if (handler.canHandle(className, ideviceType)) {
                return handler;
            }
        }
        // Should never reach here since DefaultHandler.canHandle() returns true
        return this.handlers![this.handlers!.length - 1];
    }

    /**
     * Get all registered handlers (for debugging/testing)
     *
     * @returns Array of handler instances
     */
    getAllHandlers(): IdeviceHandler[] {
        this.init();
        return [...this.handlers!];
    }

    /**
     * Reset handlers (useful for testing)
     */
    reset(): void {
        this.handlers = null;
    }
}

/**
 * Singleton instance of the handler registry
 */
export const LegacyHandlerRegistry = new LegacyHandlerRegistryClass();

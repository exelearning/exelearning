/**
 * Legacy iDevice Handler Interface
 *
 * Defines the contract for handlers that convert legacy iDevice formats
 * (from eXeLearning v2.x contentv3.xml) to modern iDevice structures.
 *
 * Each handler implements:
 * - canHandle(): Check if this handler supports the legacy class
 * - getTargetType(): Return the modern iDevice type name
 * - extractHtmlView(): Extract HTML content
 * - extractFeedback(): Extract feedback content
 * - extractProperties(): Extract iDevice-specific properties
 */

/**
 * Context information passed to extraction methods
 */
export interface IdeviceHandlerContext {
    /** Project language code (e.g., 'es', 'en', 'ca') */
    language: string;
    /** Generated iDevice ID */
    ideviceId: string;
    /** Legacy class name */
    className: string;
    /** Optional iDevice type from _iDeviceDir */
    ideviceType?: string;
}

/**
 * Feedback extraction result
 */
export interface FeedbackResult {
    /** Feedback HTML content */
    content: string;
    /** Feedback button caption */
    buttonCaption: string;
}

/**
 * Block-level properties that can be set by handlers
 */
export interface BlockProperties {
    visibility?: string;
    teacherOnly?: string;
    allowToggle?: string;
    minimized?: string;
    identifier?: string;
    cssClass?: string;
}

/**
 * Complete extraction result from a handler
 */
export interface ExtractedIdeviceData {
    /** Target modern iDevice type */
    type: string;
    /** iDevice title (block name) */
    title: string;
    /** HTML content for viewing */
    htmlView: string;
    /** Feedback HTML (if any) */
    feedbackHtml: string;
    /** Feedback button caption */
    feedbackButton: string;
    /** iDevice-specific properties (questionsData, etc.) */
    properties: Record<string, unknown>;
    /** Optional CSS class for the block */
    cssClass?: string;
    /** Optional block-level properties */
    blockProperties?: BlockProperties;
}

/**
 * Interface that all legacy iDevice handlers must implement
 */
export interface IdeviceHandler {
    /**
     * Check if this handler can process the given legacy class
     *
     * @param className - Legacy class name (e.g., 'exe.engine.multichoiceidevice.MultichoiceIdevice')
     * @param ideviceType - Optional iDevice type from _iDeviceDir (e.g., 'flipcards-activity')
     * @returns true if this handler can process this class
     */
    canHandle(className: string, ideviceType?: string): boolean;

    /**
     * Get the target modern iDevice type
     *
     * @returns Modern iDevice type name (e.g., 'form', 'text', 'trueorfalse')
     */
    getTargetType(): string;

    /**
     * Extract HTML content from the legacy format
     *
     * @param dict - Dictionary element from legacy XML
     * @param context - Context with language and metadata
     * @returns HTML content string
     */
    extractHtmlView(dict: Element, context?: IdeviceHandlerContext): string;

    /**
     * Extract feedback content from the legacy format
     *
     * @param dict - Dictionary element from legacy XML
     * @param context - Context with language info
     * @returns Feedback content and button caption
     */
    extractFeedback(dict: Element, context?: IdeviceHandlerContext): FeedbackResult;

    /**
     * Extract iDevice-specific properties from the dictionary
     *
     * @param dict - Dictionary element of the iDevice
     * @param ideviceId - Generated iDevice ID
     * @returns Properties object (e.g., { questionsData: [...] })
     */
    extractProperties(dict: Element, ideviceId?: string): Record<string, unknown>;

    /**
     * Get block-level properties (optional)
     * Some handlers may need to set specific block properties
     *
     * @returns Block properties or undefined
     */
    getBlockProperties?(): BlockProperties;
}

/**
 * Type guard to check if an object implements IdeviceHandler
 */
export function isIdeviceHandler(obj: unknown): obj is IdeviceHandler {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof (obj as IdeviceHandler).canHandle === 'function' &&
        typeof (obj as IdeviceHandler).getTargetType === 'function' &&
        typeof (obj as IdeviceHandler).extractHtmlView === 'function' &&
        typeof (obj as IdeviceHandler).extractFeedback === 'function' &&
        typeof (obj as IdeviceHandler).extractProperties === 'function'
    );
}

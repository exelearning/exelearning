/**
 * DefaultHandler
 *
 * Fallback handler for unknown legacy iDevice types.
 * Extracts basic HTML content and maps to 'text' iDevice.
 *
 * This handler should always be the LAST in the registry
 * as it accepts all class names.
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class DefaultHandler extends BaseLegacyHandler {
    /**
     * Always matches (fallback handler)
     */
    canHandle(_className: string, _ideviceType?: string): boolean {
        return true;
    }

    /**
     * Default to 'text' iDevice for unknown types
     */
    getTargetType(): string {
        return 'text';
    }

    /**
     * Try to extract HTML content from various common fields
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Strategy 1: Look for "fields" list (JsIdevice format)
        const fieldsResult = this.extractFieldsContent(dict);
        if (fieldsResult) {
            return this.stripLegacyExeTextWrapper(fieldsResult);
        }

        // Strategy 2: Direct content fields (older formats)
        const contentFields = ['content', '_content', '_html', 'htmlView', 'story', '_story', 'text', '_text'];
        for (const field of contentFields) {
            const content = this.extractRichTextContent(dict, field);
            if (content) {
                return this.stripLegacyExeTextWrapper(content);
            }
        }

        // Strategy 3: Any TextField or TextAreaField
        return this.stripLegacyExeTextWrapper(this.extractAnyTextFieldContent(dict));
    }

    /**
     * Try to extract feedback content
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    extractFeedback(dict: Element, context?: IdeviceHandlerContext): FeedbackResult {
        if (!dict) return { content: '', buttonCaption: '' };

        // Look for answerTextArea (ReflectionIdevice style)
        const answerTextArea = this.findDictInstance(dict, 'answerTextArea');
        if (answerTextArea) {
            const content = this.extractTextAreaFieldContent(answerTextArea);
            if (content) {
                return {
                    content,
                    buttonCaption: this.getLocalizedFeedbackText(context?.language),
                };
            }
        }

        return { content: '', buttonCaption: '' };
    }
}

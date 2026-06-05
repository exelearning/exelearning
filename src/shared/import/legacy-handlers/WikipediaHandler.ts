/**
 * WikipediaHandler
 *
 * Handles legacy WikipediaIdevice (Wikipedia article content).
 * Converts to modern 'text' iDevice with special wrapper.
 *
 * Legacy XML structure:
 * - exe.engine.wikipediaidevice.WikipediaIdevice
 *
 * Extracts:
 * - TextAreaField content wrapped in exe-wikipedia-content div
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class WikipediaHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('WikipediaIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'text';
    }

    /**
     * Extract HTML view from Wikipedia content
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Look for TextAreaField instances in dictionary
        const textAreas = this.getDirectChildrenByTagName(dict, 'instance').filter(inst =>
            (inst.getAttribute('class') || '').includes('TextAreaField'),
        );
        let html = '';

        for (const textArea of textAreas) {
            const content = this.extractTextAreaFieldContent(textArea);
            if (content) {
                // Clean up empty paragraphs as done in Symfony
                const cleanedContent = content.replace(/<p><\/p>/g, '');
                html += cleanedContent;
            }
        }

        // If no direct TextAreaFields found, try through fields list
        if (!html) {
            const fieldsList = this.findDictList(dict, 'fields');
            if (fieldsList) {
                const fields = this.getDirectChildrenByTagName(fieldsList, 'instance').filter(inst =>
                    (inst.getAttribute('class') || '').includes('TextAreaField'),
                );
                for (const field of fields) {
                    const content = this.extractTextAreaFieldContent(field);
                    if (content) {
                        const cleanedContent = content.replace(/<p><\/p>/g, '');
                        html += cleanedContent;
                    }
                }
            }
        }

        // Wrap in Wikipedia content div as done in Symfony
        if (html) {
            html = `<div class="exe-wikipedia-content">${html}</div>`;
        }

        return html;
    }

    /**
     * No feedback for Wikipedia iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties (none needed for text iDevice)
     */
    extractProperties(_dict: Element, _ideviceId?: string): Record<string, unknown> {
        return {};
    }
}

/**
 * RssHandler
 *
 * Handles legacy RssIdevice (RSS feed content).
 * Converts to modern 'text' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.rssidevice.RssIdevice
 *
 * Extracts:
 * - TextAreaField content with RSS feed rendered HTML
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class RssHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('RssIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'text';
    }

    /**
     * Extract HTML view from RSS content
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Look for TextAreaField instances in dictionary
        // RSS content is stored directly in TextAreaField
        const textAreas = this.getDirectChildrenByTagName(dict, 'instance').filter(inst =>
            (inst.getAttribute('class') || '').includes('TextAreaField'),
        );
        let html = '';

        for (const textArea of textAreas) {
            const content = this.extractTextAreaFieldContent(textArea);
            if (content) {
                html += content;
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
                        html += content;
                    }
                }
            }
        }

        return html;
    }

    /**
     * No feedback for RSS iDevice
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

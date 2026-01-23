/**
 * NotaHandler
 *
 * Handles legacy NotaIdevice and NotaInformacionIdevice.
 * These iDevices are text-based but should be imported with their
 * block visibility set to false (collapsed by default).
 *
 * Legacy XML classes:
 * - exe.engine.notaidevice.NotaIdevice
 * - exe.engine.notainformacionidevice.NotaInformacionIdevice
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult, BlockProperties } from './IdeviceHandler';

export class NotaHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('NotaIdevice') || className.includes('NotaInformacionIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'text';
    }

    /**
     * Get block properties for Nota iDevices
     * These iDevices should have their block collapsed by default
     *
     * @returns Block properties with visibility: 'false'
     */
    getBlockProperties(): BlockProperties {
        return {
            visibility: 'false',
        };
    }

    /**
     * Extract HTML content from the legacy format
     * Nota iDevices store content in commentTextArea
     *
     * @param dict - Dictionary element from legacy XML
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Look for commentTextArea (main content for NotaIdevice)
        const commentTextArea = this.findDictInstance(dict, 'commentTextArea');
        if (commentTextArea) {
            return this.extractTextAreaFieldContent(commentTextArea);
        }

        // Fallback: Look for "content" key
        const contentTextArea = this.findDictInstance(dict, 'content');
        if (contentTextArea) {
            return this.extractTextAreaFieldContent(contentTextArea);
        }

        // Fallback: Any TextAreaField in the dictionary
        const textAreaInst = this.getDirectChildrenByTagName(dict, 'instance').find(inst =>
            (inst.getAttribute('class') || '').includes('TextAreaField'),
        );
        if (textAreaInst) {
            return this.extractTextAreaFieldContent(textAreaInst);
        }

        return '';
    }

    /**
     * No feedback for Nota iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties for text iDevice
     */
    extractProperties(_dict: Element, _ideviceId?: string): Record<string, unknown> {
        return {};
    }
}

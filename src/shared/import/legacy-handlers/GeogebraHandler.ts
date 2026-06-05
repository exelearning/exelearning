/**
 * GeogebraHandler
 *
 * Handles legacy GeogebraIdevice (GeoGebra applet content).
 * Converts to modern 'geogebra-activity' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.geogebraidevice.GeogebraIdevice
 *
 * Extracts:
 * - HTML with embedded GeoGebra applet from fields list
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class GeogebraHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     * Also handles JsIdevice with geogebra-activity type
     *
     * @param className - Legacy class name
     * @param ideviceType - iDevice type from _iDeviceDir (for JsIdevice)
     */
    canHandle(className: string, ideviceType?: string): boolean {
        // Check legacy GeogebraIdevice class
        if (className.includes('GeogebraIdevice')) {
            return true;
        }
        // Check JsIdevice with geogebra-activity type
        if (ideviceType === 'geogebra-activity') {
            return true;
        }
        return false;
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'geogebra-activity';
    }

    /**
     * Extract HTML view from GeoGebra content
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // GeoGebra content is typically in a fields list with TextAreaField
        const fieldsList = this.findDictList(dict, 'fields');
        if (fieldsList) {
            const textAreas = this.getDirectChildrenByTagName(fieldsList, 'instance').filter(inst =>
                (inst.getAttribute('class') || '').includes('TextAreaField'),
            );
            for (const textArea of textAreas) {
                const content = this.extractTextAreaFieldContent(textArea);
                if (content) {
                    return content;
                }
            }
        }

        // Fallback: look for direct TextAreaField in dictionary
        const textAreas = this.getDirectChildrenByTagName(dict, 'instance').filter(inst =>
            (inst.getAttribute('class') || '').includes('TextAreaField'),
        );
        for (const textArea of textAreas) {
            const content = this.extractTextAreaFieldContent(textArea);
            if (content) {
                return content;
            }
        }

        return '';
    }

    /**
     * No feedback for geogebra iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties (none needed for geogebra-activity iDevice)
     */
    extractProperties(_dict: Element, _ideviceId?: string): Record<string, unknown> {
        return {};
    }
}

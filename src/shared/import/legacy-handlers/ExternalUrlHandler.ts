/**
 * ExternalUrlHandler
 *
 * Handles legacy ExternalUrlIdevice.
 * Converts to modern 'external-website' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.externalurlidevice.ExternalUrlIdevice
 *
 * Extracts:
 * - url - the external website URL
 * - height - iframe height
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class ExternalUrlHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('ExternalUrlIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'external-website';
    }

    /**
     * Generate HTML view with iframe containing the URL
     *
     * The external-website iDevice JavaScript expects htmlView to contain
     * an iframe with the src attribute set to the URL.
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        const url = this.extractUrl(dict);
        if (!url) return '';

        // Get height option (defaults to 300 = medium)
        const heightValue =
            this.findDictStringValue(dict, 'height') || this.findDictStringValue(dict, '_height') || '300';

        // Map numeric height to size option (1=small, 2=medium, 3=large, 4=super-size)
        let sizeOption = '2'; // default medium
        const height = parseInt(heightValue, 10);
        if (height <= 200) {
            sizeOption = '1';
        } else if (height <= 300) {
            sizeOption = '2';
        } else if (height <= 500) {
            sizeOption = '3';
        } else {
            sizeOption = '4';
        }

        // Generate iframe HTML (matches Symfony OdeOldXmlExternalUrlIdevice.php format)
        return `<div id="iframeWebsiteIdevice">
<iframe src="${url}" size="${sizeOption}" width="600" height="${height}" style="width:100%;"></iframe>
<div class="iframe-error-message" style="display:none;">Unable to display an iframe loaded over HTTP on a website that uses HTTPS.</div>
</div>`;
    }

    /**
     * No feedback for external URL iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties including URL
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        if (!dict) return {};

        const props: Record<string, unknown> = {};

        // Extract URL
        const url = this.extractUrl(dict);
        if (url) {
            props.url = url;
        }

        // Extract height
        const height = this.findDictStringValue(dict, 'height') || this.findDictStringValue(dict, '_height');
        if (height) {
            props.height = height;
        }

        return props;
    }

    /**
     * Extract URL from the legacy format
     *
     * @param dict - Dictionary element of the ExternalUrlIdevice
     * @returns The URL or null
     */
    private extractUrl(dict: Element): string | null {
        // Try various URL field names
        const urlFieldNames = ['url', '_url', 'urlField', '_urlField', 'websiteUrl'];

        for (const fieldName of urlFieldNames) {
            // Try direct string value
            const urlValue = this.findDictStringValue(dict, fieldName);
            if (urlValue) {
                return urlValue;
            }

            // Try as TextField instance
            const urlInst = this.findDictInstance(dict, fieldName);
            if (urlInst) {
                // Check for TextField content
                const urlDict = this.getDirectChildByTagName(urlInst, 'dictionary');
                if (urlDict) {
                    const content =
                        this.findDictStringValue(urlDict, 'content') ||
                        this.findDictStringValue(urlDict, '_content') ||
                        this.findDictStringValue(urlDict, 'value') ||
                        this.findDictStringValue(urlDict, '_value');
                    if (content) {
                        return content;
                    }
                }
            }
        }

        return null;
    }
}

/**
 * InteractiveVideoHandler
 *
 * Handles legacy Interactive Video iDevices (JsIdevice with interactive-video type).
 * Converts legacy format to modern 'interactive-video' iDevice.
 *
 * Legacy format:
 * - exe.engine.jsidevice.JsIdevice with _iDeviceDir = 'interactive-video'
 * - HTML contains: <div class="exe-interactive-video">
 *   - <script>var InteractiveVideo = {...}</script> with video configuration
 *   - Image assets referenced in slides
 *
 * The transformation (based on Symfony OdeXmlUtil.php lines 2441-2476):
 * 1. Detect exe-interactive-video class in HTML
 * 2. Find the script with 'var InteractiveVideo = {...}'
 * 3. Extract and parse the JavaScript object as JSON
 * 4. Convert to <script id="exe-interactive-video-contents" type="application/json">
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class InteractiveVideoHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     *
     * @param className - Legacy class name
     * @param ideviceType - iDevice type from _iDeviceDir
     */
    canHandle(className: string, ideviceType?: string): boolean {
        // Check for JsIdevice with interactive-video type
        if (ideviceType === 'interactive-video') {
            return true;
        }
        // Fallback: check if className contains interactive-video
        if (className?.toLowerCase().includes('interactive-video')) {
            return true;
        }
        return false;
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'interactive-video';
    }

    /**
     * Extract HTML content and transform the InteractiveVideo script to JSON format
     * Based on Symfony OdeXmlUtil.php lines 2441-2476
     *
     * @param dict - Dictionary element
     * @param _context - Context with language, etc.
     * @returns Transformed HTML content
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Get raw HTML from fields (JsIdevice format)
        const rawHtml = this.extractFieldsHtml(dict);
        if (!rawHtml) return '';

        // Check if this is an interactive video
        if (!rawHtml.includes('exe-interactive-video')) {
            return rawHtml;
        }

        // Transform the var InteractiveVideo = {...} script to JSON format
        return this.transformInteractiveVideoScript(rawHtml);
    }

    /**
     * No feedback for interactive video iDevice
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Transform the legacy var InteractiveVideo = {...} script to modern JSON format
     *
     * Legacy format:
     * <script>
     *   //<![CDATA[
     *   var InteractiveVideo = {"slides":[...],...}
     *   //]]>
     * </script>
     *
     * Modern format:
     * <script id="exe-interactive-video-contents" type="application/json">
     *   {"slides":[...],...}
     * </script>
     *
     * @param html - HTML content with legacy script
     * @returns HTML with transformed script
     */
    private transformInteractiveVideoScript(html: string): string {
        // First, decode HTML entities that might be encoding the script structure
        let decodedHtml = this.decodeHtmlEntities(html);

        // Also handle numeric entities for newlines
        decodedHtml = decodedHtml.replace(/&#10;/g, '\n').replace(/&#13;/g, '\r');

        // Find the position of var InteractiveVideo =
        const varPattern = /var\s+InteractiveVideo\s*=\s*/gi;
        const varMatch = varPattern.exec(decodedHtml);

        if (!varMatch) {
            return decodedHtml;
        }

        // Find the balanced JSON object starting after the =
        const jsonStartPos = varMatch.index + varMatch[0].length;
        const jsonContent = this.findBalancedJson(decodedHtml, jsonStartPos);

        if (!jsonContent) {
            return decodedHtml;
        }

        // Clean up and parse the JSON
        let decoded = jsonContent.trim();

        // Remove JavaScript comments (single-line)
        decoded = decoded.replace(/(^|\s)\/\/[^\n\r]*/gm, '$1');

        // Remove trailing commas before } or ]
        decoded = decoded.replace(/,\s*([}\]])/g, '$1');

        // Sanitize JSON to handle control characters from legacy versions
        decoded = this.sanitizeJsonString(decoded);

        // Try to parse as JSON
        let parsed: Record<string, unknown> | null = null;
        try {
            parsed = JSON.parse(decoded);
        } catch (_e) {
            // If parsing fails, try to fix common issues
            try {
                const fixed = this.fixJsonQuotes(decoded);
                parsed = JSON.parse(fixed);
            } catch (_e2) {
                // Failed to parse
                return decodedHtml;
            }
        }

        if (parsed) {
            // Find the full script tag to replace
            // Look backwards for <script and forwards for </script>
            const scriptStart = decodedHtml.lastIndexOf('<script', varMatch.index);
            let scriptEnd = decodedHtml.indexOf('</script>', jsonStartPos + jsonContent.length);

            if (scriptStart !== -1 && scriptEnd !== -1) {
                scriptEnd += '</script>'.length;
                const before = decodedHtml.substring(0, scriptStart);
                const after = decodedHtml.substring(scriptEnd);
                const jsonStr = JSON.stringify(parsed);
                return (
                    before +
                    `<script id="exe-interactive-video-contents" type="application/json">${jsonStr}</script>` +
                    after
                );
            }
        }

        return decodedHtml;
    }

    /**
     * Find a balanced JSON object starting from a position in the string
     * Handles nested braces properly
     *
     * @param str - The string to search in
     * @param startPos - Position to start searching from
     * @returns The balanced JSON object or null if not found
     */
    private findBalancedJson(str: string, startPos: number): string | null {
        let depth = 0;
        let start = -1;

        for (let i = startPos; i < str.length; i++) {
            const char = str[i];

            if (char === '{') {
                if (depth === 0) start = i;
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0 && start !== -1) {
                    return str.substring(start, i + 1);
                }
            }
        }

        return null;
    }

    /**
     * Decode HTML entities in string
     *
     * @param str - String with HTML entities
     * @returns Decoded string
     */
    private decodeHtmlEntities(str: string): string {
        if (!str) return '';
        return str
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
    }

    /**
     * Fix unescaped quotes inside JSON string values
     * Based on Symfony OdeXmlUtil.php lines 2456-2462
     *
     * @param jsonStr - JSON string with potential issues
     * @returns Fixed JSON string
     */
    private fixJsonQuotes(jsonStr: string): string {
        // Replace unescaped quotes inside string values
        return jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (_match, content) => {
            // Escape any unescaped internal quotes
            const fixed = content.replace(/([^\\])"/g, '$1\\"').replace(/^"/g, '\\"');
            return `"${fixed}"`;
        });
    }

    /**
     * Sanitize JSON string by escaping control characters inside string values.
     * Based on common.js sanitizeJSONString function.
     *
     * Control characters inside JSON string values must be escaped:
     * - 0x08 (backspace) -> \b
     * - 0x09 (tab) -> \t
     * - 0x0A (newline) -> \n
     * - 0x0C (form feed) -> \f
     * - 0x0D (carriage return) -> \r
     * - Other control chars -> \uXXXX
     *
     * @param jsonString - The JSON string to sanitize
     * @returns The sanitized JSON string
     */
    private sanitizeJsonString(jsonString: string): string {
        if (!jsonString) return jsonString;

        const BACKSPACE = 0x08;
        const TAB = 0x09;
        const NEWLINE = 0x0a;
        const FORM_FEED = 0x0c;
        const CARRIAGE_RETURN = 0x0d;
        const DELETE = 0x7f;
        const LINE_SEPARATOR = 0x2028;
        const PARAGRAPH_SEPARATOR = 0x2029;

        let inString = false;
        let result = '';

        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString[i];

            // Outside of a string value - just copy the character
            if (!inString) {
                if (char === '"') {
                    inString = true;
                }
                result += char;
                continue;
            }

            // Handle escape sequences - copy the backslash and next character as-is
            if (char === '\\') {
                const nextChar = jsonString[i + 1];
                if (nextChar !== undefined) {
                    result += char + nextChar;
                    i++;
                } else {
                    result += char;
                }
                continue;
            }

            // End of string value
            if (char === '"') {
                inString = false;
                result += char;
                continue;
            }

            // Inside a string value - escape control characters
            const charCode = char.charCodeAt(0);

            switch (charCode) {
                case BACKSPACE:
                    result += '\\b';
                    break;
                case TAB:
                    result += '\\t';
                    break;
                case NEWLINE:
                    result += '\\n';
                    break;
                case FORM_FEED:
                    result += '\\f';
                    break;
                case CARRIAGE_RETURN:
                    result += '\\r';
                    break;
                case LINE_SEPARATOR:
                case PARAGRAPH_SEPARATOR:
                    result += '\\u' + charCode.toString(16).padStart(4, '0');
                    break;
                default:
                    // Escape other control characters (C0, DEL, C1 control codes)
                    if (charCode < 0x20 || charCode === DELETE || (charCode >= 0x80 && charCode <= 0x9f)) {
                        result += '\\u' + charCode.toString(16).padStart(4, '0');
                    } else {
                        result += char;
                    }
            }
        }

        return result;
    }

    /**
     * Extract HTML content from fields list (JsIdevice format)
     * Uses a custom extraction that doesn't convert \n to newlines,
     * since the JSON inside the script tag uses \n as escape sequences.
     *
     * @param dict - Dictionary element
     * @returns HTML content
     */
    private extractFieldsHtml(dict: Element): string {
        const contents: string[] = [];
        const children = this.getChildElements(dict);

        // Find "fields" key and its list
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'fields'
            ) {
                const listEl = children[i + 1];
                if (listEl && listEl.tagName === 'list') {
                    // Extract content from each field
                    const fieldInstances = this.getChildElements(listEl).filter(el => el.tagName === 'instance');

                    for (const fieldInst of fieldInstances) {
                        const fieldClass = fieldInst.getAttribute('class') || '';
                        if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
                            // Use custom extraction that preserves \n sequences for JSON
                            const content = this.extractTextAreaFieldContentPreserveEscapes(fieldInst);
                            if (content) {
                                contents.push(content);
                            }
                        }
                    }
                }
                break;
            }
        }

        return contents.join('\n');
    }

    /**
     * Extract TextAreaField content without converting \n to newlines.
     * This is needed because Interactive Video content contains JSON
     * where \n is a valid escape sequence that must be preserved.
     *
     * @param fieldInst - TextAreaField instance element
     * @returns HTML content with \n preserved
     */
    private extractTextAreaFieldContentPreserveEscapes(fieldInst: Element | null): string {
        if (!fieldInst) return '';
        const dict = this.getDirectChildByTagName(fieldInst, 'dictionary');
        if (!dict) return '';

        const children = this.getChildElements(dict);
        const contentKeys = ['content_w_resourcePaths', '_content', 'content'];

        for (const targetKey of contentKeys) {
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (
                    child.tagName === 'string' &&
                    child.getAttribute('role') === 'key' &&
                    child.getAttribute('value') === targetKey
                ) {
                    const valueEl = children[i + 1];
                    if (valueEl && valueEl.tagName === 'unicode') {
                        const value = valueEl.getAttribute('value') || valueEl.textContent || '';
                        if (value.trim()) {
                            // Only decode HTML entities, NOT \n sequences
                            // The \n sequences are valid JSON escapes that must be preserved
                            return this.decodeHtmlEntities(value);
                        }
                    }
                }
            }
        }

        return '';
    }

    /**
     * Extract properties from the interactive video configuration
     * Parses the InteractiveVideo JSON and returns relevant properties
     *
     * @param dict - Dictionary element
     * @param ideviceId - ID of the iDevice
     * @param _context - Context with language, etc.
     * @returns Properties object
     */
    extractProperties(dict: Element, ideviceId?: string, _context?: IdeviceHandlerContext): Record<string, unknown> {
        if (!dict) return {};

        // Get the transformed HTML (which has the JSON script)
        const html = this.extractHtmlView(dict);
        if (!html) return {};

        // Extract JSON from the transformed script
        const jsonMatch = html.match(
            /<script[^>]*id="exe-interactive-video-contents"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i,
        );
        if (!jsonMatch || !jsonMatch[1]) {
            // Try extracting from legacy format if transform failed
            return this.extractLegacyProperties(html);
        }

        try {
            const config = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
            // Return the full configuration as properties
            return {
                slides: config.slides || [],
                title: config.title || '',
                description: config.description || '',
                coverType: config.coverType || 'text',
                i18n: config.i18n || {},
                scorm: config.scorm || {},
                scoreNIA: config.scoreNIA || false,
                evaluation: config.evaluation || false,
                evaluationID: config.evaluationID || '',
                ideviceID: config.ideviceID || ideviceId || '',
            };
        } catch (_e) {
            return {};
        }
    }

    /**
     * Extract properties from legacy format when transform fails
     *
     * @param html - HTML content
     * @returns Properties object
     */
    private extractLegacyProperties(html: string): Record<string, unknown> {
        // Try to extract from var InteractiveVideo = {...}
        const legacyMatch = html.match(/var\s+InteractiveVideo\s*=\s*(\{[\s\S]*?\});?\s*(?:\/\/|<\/script>)/i);
        if (!legacyMatch || !legacyMatch[1]) {
            return {};
        }

        try {
            // Clean up the JavaScript object to make it valid JSON
            let jsonStr = legacyMatch[1];
            jsonStr = this.decodeHtmlEntities(jsonStr);
            jsonStr = jsonStr.replace(/(^|\s)\/\/[^\n\r]*/gm, '$1');
            jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

            const config = JSON.parse(jsonStr) as Record<string, unknown>;
            return {
                slides: config.slides || [],
                title: config.title || '',
                description: config.description || '',
                coverType: config.coverType || 'text',
                i18n: config.i18n || {},
                scorm: config.scorm || {},
            };
        } catch (_e) {
            return {};
        }
    }
}

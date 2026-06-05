/**
 * FreeTextHandler
 *
 * Handles legacy FreeTextIdevice and related text iDevices.
 * Converts to modern 'text' iDevice.
 *
 * Legacy XML classes:
 * - exe.engine.freetextidevice.FreeTextIdevice
 * - exe.engine.freetextfpdidevice.FreeTextfpdIdevice (FPD variant)
 * - exe.engine.reflectionidevice.ReflectionIdevice
 * - exe.engine.reflectionfpdidevice.ReflectionfpdIdevice
 * - exe.engine.genericidevice.GenericIdevice
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class FreeTextHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return (
            className.includes('FreeTextIdevice') ||
            className.includes('FreeTextfpdIdevice') ||
            className.includes('ReflectionIdevice') ||
            className.includes('ReflectionfpdIdevice') ||
            className.includes('GenericIdevice')
        );
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'text';
    }

    /**
     * Extract HTML content from the legacy format
     * When feedback is present, wraps content in exe-text-activity structure
     *
     * @param dict - Dictionary element from legacy XML
     * @param context - Context with language info
     */
    extractHtmlView(dict: Element, context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        let content = '';

        // Strategy 1: Look for activityTextArea (main content)
        const activityTextArea = this.findDictInstance(dict, 'activityTextArea');
        if (activityTextArea) {
            content = this.extractTextAreaFieldContent(activityTextArea);
        }

        // Strategy 2: Look for "content" key
        if (!content) {
            const contentTextArea = this.findDictInstance(dict, 'content');
            if (contentTextArea) {
                content = this.extractTextAreaFieldContent(contentTextArea);
            }
        }

        // Strategy 3: Look for "fields" list (JsIdevice format)
        if (!content) {
            const fieldsContent = this.extractFieldsContent(dict);
            if (fieldsContent) {
                content = fieldsContent;
            }
        }

        // Strategy 4: Any TextAreaField in the dictionary
        if (!content) {
            const instances = this.getDirectChildrenByTagName(dict, 'instance');
            for (const inst of instances) {
                const className = inst.getAttribute('class') || '';
                if (className.includes('TextAreaField')) {
                    content = this.extractTextAreaFieldContent(inst);
                    if (content) break;
                }
            }
        }

        // Legacy eXe 2.9 exports may wrap text content in a top-level
        // <div class="exe-text">...</div>. Remove only that outer wrapper.
        content = this.stripLegacyExeTextWrapper(content);

        // Check if content already has feedback buttons embedded (legacy ELPs may have them in HTML)
        // This prevents duplicate feedback buttons when importing
        if (this.hasFeedbackButton(content)) {
            // Content already has feedback, wrap in exe-text-activity if not already wrapped
            if (!content.includes('exe-text-activity')) {
                return `<div class="exe-text-activity">${content}</div>`;
            }
            return content;
        }

        // Check for feedback in XML and add if present
        const feedback = this.extractFeedback(dict, context);
        if (feedback.content) {
            let html = content;
            html += '<div class="iDevice_buttons feedback-button js-required">';
            html += `<input type="button" class="feedbacktooglebutton" value="${this.escapeHtmlAttr(feedback.buttonCaption)}">`;
            html += '</div>';
            html += `<div class="feedback js-feedback js-hidden">${feedback.content}</div>`;
            return `<div class="exe-text-activity">${html}</div>`;
        }

        return content;
    }

    /**
     * Check if HTML content already contains feedback button elements
     * Legacy ELPs may have feedback buttons embedded in content_w_resourcePaths
     *
     * @param html - HTML content to check
     * @returns true if feedback button already exists
     */
    private hasFeedbackButton(html: string): boolean {
        if (!html) return false;
        // Check for various feedback button patterns used in legacy exports
        // - feedbacktooglebutton: standard class name (note the typo in original)
        // - feedbackbutton: alternative class name used in some versions
        // - iDevice_buttons feedback-button: container class pattern
        return (
            html.includes('feedbacktooglebutton') ||
            html.includes('feedbackbutton') ||
            html.includes('iDevice_buttons feedback-button') ||
            html.includes('class="feedback-button')
        );
    }

    /**
     * Extract the main content HTML from the dictionary (used to check for embedded feedback)
     */
    private extractMainContent(dict: Element): string {
        // Strategy 1: Look for activityTextArea (main content)
        const activityTextArea = this.findDictInstance(dict, 'activityTextArea');
        if (activityTextArea) {
            return this.extractTextAreaFieldContent(activityTextArea);
        }

        // Strategy 2: Look for "content" key
        const contentTextArea = this.findDictInstance(dict, 'content');
        if (contentTextArea) {
            return this.extractTextAreaFieldContent(contentTextArea);
        }

        // Strategy 3: Look for "fields" list (JsIdevice format)
        const fieldsContent = this.extractFieldsContent(dict);
        if (fieldsContent) {
            return fieldsContent;
        }

        // Strategy 4: Any TextAreaField in the dictionary
        const instances = this.getDirectChildrenByTagName(dict, 'instance');
        for (const inst of instances) {
            const className = inst.getAttribute('class') || '';
            if (className.includes('TextAreaField')) {
                const content = this.extractTextAreaFieldContent(inst);
                if (content) return content;
            }
        }

        return '';
    }

    /**
     * Extract feedback content (for Reflection iDevices and GenericIdevice with FeedbackField)
     * Returns empty if the main content HTML already has feedback embedded (prevents duplication)
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    extractFeedback(dict: Element, context?: IdeviceHandlerContext): FeedbackResult {
        if (!dict) return { content: '', buttonCaption: '' };

        // If the main content HTML already has feedback embedded, don't extract separate feedback
        // This prevents duplication when legacy ELPs have feedback in both places
        const mainContent = this.extractMainContent(dict);
        if (this.hasFeedbackButton(mainContent)) {
            return { content: '', buttonCaption: '' };
        }

        // Use project language for default caption (not UI locale)
        const defaultCaption = this.getLocalizedFeedbackText(context?.language);

        // Strategy 1: Look for answerTextArea (ReflectionIdevice style)
        const answerTextArea = this.findDictInstance(dict, 'answerTextArea');
        if (answerTextArea) {
            const answerDict = this.getDirectChildByTagName(answerTextArea, 'dictionary');
            if (answerDict) {
                // Get feedback content
                const content = this.extractTextAreaFieldContent(answerTextArea);

                // Get button caption - use stored value if available, otherwise use localized default
                const storedCaption = this.findDictStringValue(answerDict, 'buttonCaption');
                const buttonCaption = storedCaption || defaultCaption;

                if (content) {
                    return { content, buttonCaption };
                }
            }
        }

        // Strategy 2: Look for feedbackTextArea
        const feedbackTextArea = this.findDictInstance(dict, 'feedbackTextArea');
        if (feedbackTextArea) {
            const feedbackDict = this.getDirectChildByTagName(feedbackTextArea, 'dictionary');
            let buttonCaption = defaultCaption;
            if (feedbackDict) {
                const storedCaption = this.findDictStringValue(feedbackDict, 'buttonCaption');
                buttonCaption = storedCaption || defaultCaption;
            }
            const content = this.extractTextAreaFieldContent(feedbackTextArea);
            if (content) {
                return { content, buttonCaption };
            }
        }

        // Strategy 3: Look for FeedbackField inside "fields" list (GenericIdevice / Reading Activity style)
        const feedbackFromFields = this.extractFeedbackFromFieldsList(dict, context);
        if (feedbackFromFields.content) {
            return feedbackFromFields;
        }

        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract feedback from FeedbackField inside "fields" list
     * Used by GenericIdevice (Reading Activity, etc.)
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    private extractFeedbackFromFieldsList(dict: Element, context?: IdeviceHandlerContext): FeedbackResult {
        const defaultCaption = this.getLocalizedFeedbackText(context?.language);
        const children = this.getChildElements(dict);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'fields'
            ) {
                const listEl = children[i + 1];
                if (listEl && listEl.tagName === 'list') {
                    const fieldInstances = this.getDirectChildrenByTagName(listEl, 'instance');
                    for (const fieldInst of fieldInstances) {
                        const fieldClass = fieldInst.getAttribute('class') || '';
                        if (fieldClass.includes('FeedbackField')) {
                            const fieldDict = this.getDirectChildByTagName(fieldInst, 'dictionary');
                            if (fieldDict) {
                                // Get button caption from _buttonCaption
                                const storedCaption = this.findDictStringValue(fieldDict, '_buttonCaption');
                                const buttonCaption = storedCaption || defaultCaption;

                                // Get content from feedback or content_w_resourcePaths
                                let content = this.findDictStringValue(fieldDict, 'feedback');
                                if (!content) {
                                    content = this.findDictStringValue(fieldDict, 'content_w_resourcePaths');
                                }
                                if (content) {
                                    // Decode HTML entities if needed
                                    content = this.decodeHtmlContent(content);
                                    return { content, buttonCaption };
                                }
                            }
                        }
                    }
                }
                break;
            }
        }

        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties for text iDevice
     * Returns empty if the main content HTML already has feedback embedded (prevents duplication)
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        // If the main content HTML already has feedback embedded, don't return feedback properties
        // This prevents duplication when legacy ELPs have feedback in both places
        const mainContent = this.extractMainContent(dict);
        if (this.hasFeedbackButton(mainContent)) {
            return {};
        }

        const feedback = this.extractFeedback(dict);
        if (feedback.content) {
            return {
                textFeedbackTextarea: feedback.content,
                textFeedbackInput: feedback.buttonCaption,
            };
        }
        return {};
    }
}

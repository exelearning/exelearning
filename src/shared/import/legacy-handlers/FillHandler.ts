/**
 * FillHandler
 *
 * Handles legacy ClozeIdevice, ClozeActivityIdevice, and ClozeLanguageIdevice.
 * Converts to modern 'form' iDevice with fill-in-blanks questions.
 *
 * Legacy XML structure:
 * - exe.engine.clozeidevice.ClozeIdevice
 * - exe.engine.clozeactivityidevice.ClozeActivityIdevice
 * - exe.engine.clozelang.ClozeLanguageIdevice (FPD variant)
 *
 * Extracts:
 * - clozeText with gaps marked as {{answer}}
 * - autoCapitalize, strictMarking settings
 * - instantMarking setting
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Fill question data structure
 */
interface FillQuestion {
    activityType: 'fill';
    baseText: string;
    answers: string[];
}

/**
 * Parsed cloze text result
 */
interface ParsedClozeText {
    baseText: string;
    answers: string[];
}

export class FillHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return (
            className.includes('ClozeIdevice') ||
            className.includes('ClozeActivityIdevice') ||
            className.includes('ClozeLanguageIdevice') ||
            className.includes('ClozeLangIdevice') ||
            className.includes('ClozelangfpdIdevice')
        );
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'form';
    }

    /**
     * Extract the cloze text (instructions/content before gaps)
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Look for instructionsForLearners
        const instructionsArea = this.findDictInstance(dict, 'instructionsForLearners');
        if (instructionsArea) {
            return this.extractTextAreaFieldContent(instructionsArea);
        }

        return '';
    }

    /**
     * Extract feedback content from legacy format
     * Maps to eXeIdeviceTextAfter in modern form iDevice
     */
    extractFeedback(dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        if (!dict) return { content: '', buttonCaption: '' };

        // ClozeIdevice uses 'feedback' key (TextAreaField)
        const feedbackField =
            this.findDictInstance(dict, 'feedback') || this.findDictInstance(dict, 'feedbackTextArea');

        if (feedbackField) {
            return {
                content: this.extractTextAreaFieldContent(feedbackField),
                buttonCaption: '',
            };
        }

        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties including questionsData and eXeFormInstructions
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        const questionsData = this.extractClozeQuestions(dict);
        const instructions = this.extractHtmlView(dict);

        // Extract settings
        const autoCapitalize = !this.findDictBoolValue(dict, 'autoCapitalize');
        const strictMarking = this.findDictBoolValue(dict, 'strictMarking');
        const instantMarking = this.findDictBoolValue(dict, 'instantMarking');

        const props: Record<string, unknown> = {};

        if (questionsData.length > 0) {
            props.questionsData = questionsData;
        }

        // Add instructions if present
        if (instructions) {
            props.eXeFormInstructions = instructions;
        }

        // Add settings if present
        if (autoCapitalize !== undefined) {
            props.ignoreCaps = autoCapitalize;
        }
        if (strictMarking !== undefined) {
            props.strictMarking = strictMarking;
        }
        if (instantMarking !== undefined) {
            props.instantMarking = instantMarking;
        }

        // Extract feedback -> eXeIdeviceTextAfter
        const feedback = this.extractFeedback(dict);
        if (feedback.content) {
            props.eXeIdeviceTextAfter = feedback.content;
        }

        return props;
    }

    /**
     * Extract cloze questions from the legacy format
     *
     * Structure (Symfony OdeOldXmlFillIdevice.php):
     * - _content -> exe.engine.field.ClozeField
     * - ClozeField contains _encodedContent with the cloze text
     * - Gaps are marked with <u> tags
     *
     * @param dict - Dictionary element of the ClozeIdevice
     * @returns Array of question objects in form iDevice format
     */
    private extractClozeQuestions(dict: Element): FillQuestion[] {
        const questionsData: FillQuestion[] = [];

        // Try ClozeField via _content key first (Symfony approach)
        const contentInst = this.findDictInstance(dict, '_content');
        if (contentInst) {
            const clozeDict = this.getDirectChildByTagName(contentInst, 'dictionary');
            if (clozeDict) {
                // Symfony extracts from _encodedContent
                const encodedContent = this.findDictStringValue(clozeDict, '_encodedContent');
                if (encodedContent) {
                    const parsedText = this.parseClozeText(encodedContent);
                    if (parsedText.baseText) {
                        questionsData.push({
                            activityType: 'fill',
                            baseText: parsedText.baseText,
                            answers: parsedText.answers || [],
                        });
                        return questionsData;
                    }
                }
            }
        }

        // Try _cloze key
        const clozeInst = this.findDictInstance(dict, '_cloze');
        if (clozeInst) {
            const clozeDict = this.getDirectChildByTagName(clozeInst, 'dictionary');
            if (clozeDict) {
                const clozeText =
                    this.findDictStringValue(clozeDict, '_encodedContent') ||
                    this.findDictStringValue(clozeDict, '_clozeText') ||
                    this.findDictStringValue(clozeDict, 'clozeText');

                if (clozeText) {
                    const parsedText = this.parseClozeText(clozeText);
                    if (parsedText.baseText) {
                        questionsData.push({
                            activityType: 'fill',
                            baseText: parsedText.baseText,
                            answers: parsedText.answers || [],
                        });
                        return questionsData;
                    }
                }
            }
        }

        // Try ClozeField by class directly
        const clozeFieldByClass = this.getDirectChildrenByTagName(dict, 'instance').find(inst =>
            (inst.getAttribute('class') || '').includes('ClozeField'),
        );
        if (clozeFieldByClass) {
            const clozeDict = this.getDirectChildByTagName(clozeFieldByClass, 'dictionary');
            if (clozeDict) {
                const encodedContent = this.findDictStringValue(clozeDict, '_encodedContent');
                if (encodedContent) {
                    const parsedText = this.parseClozeText(encodedContent);
                    if (parsedText.baseText) {
                        questionsData.push({
                            activityType: 'fill',
                            baseText: parsedText.baseText,
                            answers: parsedText.answers || [],
                        });
                        return questionsData;
                    }
                }
            }
        }

        // Fallback to alternative structure
        return this.extractClozeFromFields(dict);
    }

    /**
     * Alternative extraction from fields list
     */
    private extractClozeFromFields(dict: Element): FillQuestion[] {
        const questionsData: FillQuestion[] = [];

        // Look for clozeTextArea
        const clozeTextArea = this.findDictInstance(dict, 'clozeTextArea');
        if (clozeTextArea) {
            const content = this.extractTextAreaFieldContent(clozeTextArea);
            if (content) {
                const parsedText = this.parseClozeText(content);
                if (parsedText.baseText) {
                    questionsData.push({
                        activityType: 'fill',
                        baseText: parsedText.baseText,
                        answers: parsedText.answers || [],
                    });
                }
            }
        }

        return questionsData;
    }

    /**
     * Parse cloze text to normalize format for the form iDevice renderer
     *
     * The form iDevice renderer (export/form.js getProcessTextFillQuestion)
     * expects <u>word</u> tags in baseText and converts them to <input> fields.
     *
     * Legacy formats that need normalization:
     * - <u class="exe-cloze-word">word</u> -> <u>word</u>
     * - <span class="cloze-blank">word</span> -> <u>word</u>
     * - <input data-answer="word"> -> <u>word</u>
     *
     * Simple <u>word</u> tags are kept as-is (already correct format).
     *
     * @param text - Raw cloze text
     * @returns { baseText, answers }
     */
    private parseClozeText(text: string): ParsedClozeText {
        if (!text) return { baseText: '', answers: [] };

        let baseText = text;

        // Step 1: Normalize all variant formats to simple <u>word</u>

        // <u class="exe-cloze-word">word</u> -> <u>word</u>
        baseText = baseText.replace(
            /<u[^>]*class="[^"]*exe-cloze-word[^"]*"[^>]*>([^<]+)<\/u>/gi,
            (_match, word) => '<u>' + word.trim() + '</u>',
        );

        // <span class="cloze-blank">word</span> -> <u>word</u>
        baseText = baseText.replace(
            /<span[^>]*class="[^"]*cloze-blank[^"]*"[^>]*>([^<]+)<\/span>/gi,
            (_match, word) => '<u>' + word.trim() + '</u>',
        );

        // <input data-answer="word"> -> <u>word</u>
        baseText = baseText.replace(
            /<input[^>]*data-answer="([^"]+)"[^>]*>/gi,
            (_match, word) => '<u>' + word + '</u>',
        );

        // Step 2: Extract all answers from normalized <u>word</u> tags
        const answers: string[] = [];
        baseText.replace(/<u>([^<]+)<\/u>/gi, (_match, word) => {
            answers.push(word.trim());
            return _match; // Don't modify, just extract
        });

        return { baseText, answers };
    }
}

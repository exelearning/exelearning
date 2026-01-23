/**
 * DropdownHandler
 *
 * Handles legacy ListaIdevice (dropdown/select questions).
 * Converts to modern 'form' iDevice with dropdown questions.
 *
 * Legacy XML structure:
 * - exe.engine.listaidevice.ListaIdevice
 *
 * Extracts:
 * - Questions with dropdown placeholders (uses <u> tags)
 * - Wrong answers (distractors)
 * - Instructions (instructionsForLearners -> eXeFormInstructions)
 * - Feedback (feedback field -> rendered as button + hidden div)
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Dropdown question data structure
 */
interface DropdownQuestion {
    activityType: 'dropdown';
    baseText: string;
    wrongAnswersValue: string;
}

export class DropdownHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('ListaIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'form';
    }

    /**
     * Extract instructions HTML
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
     * Extract feedback content from the legacy format
     *
     * Legacy ListaIdevice has a "feedback" key containing a TextAreaField
     * with content_w_resourcePaths for the feedback text.
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     * @returns { content, buttonCaption }
     */
    extractFeedback(dict: Element, context?: IdeviceHandlerContext): FeedbackResult {
        if (!dict) return { content: '', buttonCaption: '' };

        // Use project language for default caption
        const defaultCaption = this.getLocalizedFeedbackText(context?.language);

        // Look for feedback field (ListaIdevice uses "feedback" key)
        const feedbackField = this.findDictInstance(dict, 'feedback');
        if (feedbackField) {
            const feedbackDict = this.getDirectChildByTagName(feedbackField, 'dictionary');
            let buttonCaption = defaultCaption;
            if (feedbackDict) {
                const storedCaption = this.findDictStringValue(feedbackDict, 'buttonCaption');
                buttonCaption = storedCaption || defaultCaption;
            }
            const content = this.extractTextAreaFieldContent(feedbackField);
            if (content) {
                return { content, buttonCaption };
            }
        }

        // Alternative: Look for feedbackTextArea (other legacy formats)
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

        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties including questionsData, eXeFormInstructions, and feedback
     *
     * Based on Symfony OdeOldXmlDropdownIdevice.php:
     * - eXeFormInstructions comes from instructionsForLearners
     * - questionsData contains the dropdown questions with <u> tags preserved
     * - eXeIdeviceTextAfter contains the feedback content (form iDevice uses this field)
     *
     * @param dict - Dictionary element
     * @param _ideviceId - iDevice ID (unused)
     * @param context - Context with language info
     */
    extractProperties(dict: Element, _ideviceId?: string, context?: IdeviceHandlerContext): Record<string, unknown> {
        const questionsData = this.extractDropdownQuestions(dict);
        const instructions = this.extractHtmlView(dict);
        const feedback = this.extractFeedback(dict, context);

        if (questionsData.length > 0 || feedback.content) {
            const props: Record<string, unknown> = {};

            if (questionsData.length > 0) {
                props.questionsData = questionsData;
            }

            if (instructions) {
                props.eXeFormInstructions = instructions;
            }

            // Add feedback as eXeIdeviceTextAfter for form iDevice
            // (form.js uses eXeIdeviceTextAfter for "content after" section)
            if (feedback.content) {
                props.eXeIdeviceTextAfter = feedback.content;
            }

            return props;
        }
        return {};
    }

    /**
     * Extract dropdown questions from the legacy format
     *
     * Structure can be:
     * - Single ListaField in _content key (most common in real legacy files)
     * - List of ListaField instances
     * - Each has: _encodedContent/content_w_resourcePaths, otras (wrong answers)
     *
     * @param dict - Dictionary element of the ListaIdevice
     * @returns Array of question objects in form iDevice format
     */
    private extractDropdownQuestions(dict: Element): DropdownQuestion[] {
        const questionsData: DropdownQuestion[] = [];

        // First: Look for single ListaField in _content key (real legacy format)
        const contentField = this.findDictInstance(dict, '_content');
        if (contentField) {
            const className = contentField.getAttribute('class') || '';
            if (className.includes('ListaField')) {
                const question = this.extractSingleListaField(contentField);
                if (question) questionsData.push(question);
                return questionsData; // Single ListaField found, return
            }
        }

        // Fallback: Find the list containing ListaField instances
        const lists = this.getDirectChildrenByTagName(dict, 'list');
        let questionsList: Element | null = null;

        for (const list of lists) {
            const firstInst = this.getDirectChildByTagName(list, 'instance');
            if (firstInst) {
                const className = firstInst.getAttribute('class') || '';
                if (className.includes('ListaField')) {
                    questionsList = list;
                    break;
                }
            }
        }

        // Alternative: questions may be in a "questions" or "_questions" key
        if (!questionsList) {
            questionsList = this.findDictList(dict, 'questions') || this.findDictList(dict, '_questions');
        }

        if (!questionsList) return questionsData;

        // Iterate each ListaField
        const questionInstances = this.getDirectChildrenByTagName(questionsList, 'instance');
        for (const questionInst of questionInstances) {
            const question = this.extractSingleListaField(questionInst);
            if (question) questionsData.push(question);
        }

        return questionsData;
    }

    /**
     * Extract a single ListaField instance
     *
     * IMPORTANT: The baseText should preserve <u> tags as-is!
     * form.js (getProcessTextDropdownQuestion) will convert <u> tags to <select> elements.
     * See Symfony OdeOldXmlDropdownIdevice.php line 145 - it also keeps <u> tags.
     *
     * @param listaFieldInst - ListaField instance element
     * @returns Question object or null
     */
    private extractSingleListaField(listaFieldInst: Element): DropdownQuestion | null {
        const qDict = this.getDirectChildByTagName(listaFieldInst, 'dictionary');
        if (!qDict) return null;

        // Extract question text from _encodedContent or content_w_resourcePaths
        // Keep <u> tags intact - form.js will convert them to <select> elements
        let baseText =
            this.findDictStringValue(qDict, '_encodedContent') ||
            this.findDictStringValue(qDict, 'content_w_resourcePaths') ||
            '';

        // Fallback: check for questionTextArea field (some legacy formats)
        if (!baseText) {
            const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
            baseText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';
        }

        // Extract wrong answers from "otras" field (pipe-separated) or "wrongAnswers"
        const wrongAnswers =
            this.findDictStringValue(qDict, 'otras') ||
            this.findDictStringValue(qDict, 'wrongAnswers') ||
            this.findDictStringValue(qDict, '_wrongAnswers') ||
            '';

        // Return with <u> tags preserved - do NOT convert to {{placeholders}}
        if (baseText) {
            return {
                activityType: 'dropdown',
                baseText: baseText,
                wrongAnswersValue: wrongAnswers,
            };
        }

        return null;
    }
}

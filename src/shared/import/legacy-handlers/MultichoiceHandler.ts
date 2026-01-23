/**
 * MultichoiceHandler
 *
 * Handles legacy MultichoiceIdevice and MultiSelectIdevice.
 * Converts to modern 'form' iDevice with questionsData.
 *
 * Legacy XML structure:
 * - exe.engine.multichoiceidevice.MultichoiceIdevice (single choice)
 * - exe.engine.multiselectidevice.MultiSelectIdevice (multiple choice)
 *
 * Uses QuizQuestionField with QuizOptionField for options.
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Question answer format: [isCorrect, text, feedback?]
 */
type QuestionAnswer = [boolean, string] | [boolean, string, string];

/**
 * Question data structure for form iDevice
 */
interface QuestionData {
    activityType: string;
    selectionType: string;
    baseText: string;
    answers: QuestionAnswer[];
    hint?: string;
}

export class MultichoiceHandler extends BaseLegacyHandler {
    // Track the iDevice class to determine selection type
    private _isMultiSelect = false;

    /**
     * Check if this handler can process the given legacy class
     * Also stores whether this is a MultiSelect iDevice for later use
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        const canHandleThis = className.includes('MultichoiceIdevice') || className.includes('MultiSelectIdevice');
        if (canHandleThis) {
            // Store whether this is a multi-select iDevice
            // MultiSelectIdevice allows multiple answers (checkboxes)
            // MultichoiceIdevice allows only one answer (radio buttons)
            this._isMultiSelect = className.includes('MultiSelectIdevice');
        }
        return canHandleThis;
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'form';
    }

    /**
     * Extract instructions HTML (if present)
     * MultichoiceIdevice typically doesn't have instructionsForLearners,
     * but we check anyway for compatibility.
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // Look for instructionsForLearners (may not exist in Multichoice)
        const instructionsArea = this.findDictInstance(dict, 'instructionsForLearners');
        if (instructionsArea) {
            return this.extractTextAreaFieldContent(instructionsArea);
        }

        return '';
    }

    /**
     * Extract feedback from iDevice level (if present)
     * MultichoiceIdevice has per-option feedback, not iDevice-level,
     * but we check for compatibility with other formats.
     */
    extractFeedback(dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        if (!dict) return { content: '', buttonCaption: '' };

        // Look for feedback TextAreaField at iDevice level
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
     * Extract questionsData and optionally eXeFormInstructions from the legacy format
     * Only sets properties that have actual content - no defaults.
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        const questionsData = this.extractQuestions(dict);
        const instructions = this.extractHtmlView(dict);
        const feedback = this.extractFeedback(dict);

        const props: Record<string, unknown> = {};

        if (questionsData.length > 0) {
            props.questionsData = questionsData;
        }

        // Only set instructions if we have actual content
        if (instructions?.trim()) {
            props.eXeFormInstructions = instructions;
        }

        // Only set feedback if we have actual content
        if (feedback.content?.trim()) {
            props.eXeIdeviceTextAfter = feedback.content;
        }

        return props;
    }

    /**
     * Extract questions from legacy MultichoiceIdevice format
     *
     * Structure:
     * - questions -> list of QuizQuestionField
     * - QuizQuestionField.questionTextArea -> question text
     * - QuizQuestionField.hintTextArea -> hint for the question
     * - QuizQuestionField.options -> list of QuizOptionField
     * - QuizOptionField.answerTextArea -> option text
     * - QuizOptionField.isCorrect -> boolean
     * - QuizOptionField.feedbackTextArea -> feedback for this option
     *
     * @param dict - Dictionary element of the MultichoiceIdevice
     * @returns Array of question objects in form iDevice format
     */
    private extractQuestions(dict: Element): QuestionData[] {
        const questionsData: QuestionData[] = [];

        // Find "questions" list in dictionary
        const questionsList = this.findDictList(dict, 'questions');
        if (!questionsList) return questionsData;

        // Iterate each QuizQuestionField
        const questionFields = this.getDirectChildrenByTagName(questionsList, 'instance');
        for (const questionField of questionFields) {
            const qDict = this.getDirectChildByTagName(questionField, 'dictionary');
            if (!qDict) continue;

            // Extract question text from questionTextArea
            const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
            const questionText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';

            // Extract hint from hintTextArea
            const hintTextArea = this.findDictInstance(qDict, 'hintTextArea');
            const hint = hintTextArea ? this.extractTextAreaFieldContent(hintTextArea) : '';

            // Extract options from options list
            const optionsList = this.findDictList(qDict, 'options');
            const answers: QuestionAnswer[] = [];

            if (optionsList) {
                const optionFields = this.getDirectChildrenByTagName(optionsList, 'instance');
                for (const optionField of optionFields) {
                    const optDict = this.getDirectChildByTagName(optionField, 'dictionary');
                    if (!optDict) continue;

                    // Get answer text from answerTextArea
                    const answerTextArea = this.findDictInstance(optDict, 'answerTextArea');
                    const optionHtml = answerTextArea ? this.extractTextAreaFieldContent(answerTextArea) : '';
                    // Strip HTML tags to get plain text (matches Symfony's strip_tags())
                    const optionText = this.stripHtmlTags(optionHtml);

                    // Get isCorrect flag
                    const isCorrect = this.findDictBoolValue(optDict, 'isCorrect');

                    // Get per-option feedback
                    const feedbackTextArea = this.findDictInstance(optDict, 'feedbackTextArea');
                    const optionFeedback = feedbackTextArea ? this.extractTextAreaFieldContent(feedbackTextArea) : '';

                    // Include feedback if present (as third element)
                    if (optionFeedback?.trim()) {
                        answers.push([isCorrect, optionText, optionFeedback]);
                    } else {
                        answers.push([isCorrect, optionText]);
                    }
                }
            }

            // Only add if we have a question or answers
            if (questionText || answers.length > 0) {
                // Selection type is based on iDevice type, not number of correct answers:
                // - MultiSelectIdevice: 'multiple' (checkboxes, multiple answers allowed)
                // - MultichoiceIdevice: 'single' (radio buttons, only one answer)
                const questionData: QuestionData = {
                    activityType: 'selection',
                    selectionType: this._isMultiSelect ? 'multiple' : 'single',
                    baseText: questionText,
                    answers: answers,
                };

                // Add hint if present
                if (hint?.trim()) {
                    questionData.hint = hint;
                }

                questionsData.push(questionData);
            }
        }

        return questionsData;
    }
}

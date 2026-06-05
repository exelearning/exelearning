/**
 * ScormTestHandler
 *
 * Handles legacy ScormTestIdevice/QuizTestIdevice (SCORM quiz format).
 * Converts to modern 'form' iDevice with selection questions.
 *
 * Legacy XML structure:
 * - exe.engine.quiztestidevice.ScormTestIdevice
 * - exe.engine.quiztestidevice.QuizTestIdevice
 *
 * Extracts:
 * - passRate -> dropdownPassRate
 * - questions list with TestQuestion instances
 * - Each question has options (AnswerOption instances)
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Question answer format: [isCorrect, text]
 */
type ScormQuestionAnswer = [boolean, string];

/**
 * Question data structure for form iDevice
 */
interface ScormQuestionData {
    activityType: 'selection';
    selectionType: 'single' | 'multiple';
    baseText: string;
    answers: ScormQuestionAnswer[];
}

export class ScormTestHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('ScormTestIdevice') || className.includes('QuizTestIdevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'form';
    }

    /**
     * Extract HTML view - QuizTestIdevice doesn't have instructionsForLearners
     * per Symfony legacy which comments out eXeFormInstructions.
     */
    extractHtmlView(_dict: Element, _context?: IdeviceHandlerContext): string {
        // QuizTestIdevice/ScormTestIdevice doesn't have instructionsForLearners
        // Symfony's OdeOldXmlScormTestIdevice.php comments out eXeFormInstructions
        return '';
    }

    /**
     * No feedback at iDevice level for SCORM test
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties including questionsData, dropdownPassRate, etc.
     * Follows Symfony's OdeOldXmlScormTestIdevice.php pattern.
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        if (!dict) return {};

        const questionsData = this.extractQuestions(dict);

        if (questionsData.length === 0) {
            return {};
        }

        const props: Record<string, unknown> = {
            questionsData,
            checkAddBtnAnswers: true,
            userTranslations: {
                langTrueFalseHelp: 'Select whether the statement is true or false',
                langDropdownHelp: 'Choose the correct answer among the options proposed',
                langSingleSelectionHelp: 'Multiple choice with only one correct answer',
                langMultipleSelectionHelp: 'Multiple choice with multiple corrects answers',
                langFillHelp: 'Fill in the blanks with the appropriate word',
            },
        };

        // Extract passRate -> dropdownPassRate
        const passRate = this.findDictStringValue(dict, 'passRate');
        if (passRate) {
            props.dropdownPassRate = passRate;
        }

        return props;
    }

    /**
     * Extract questions from the legacy SCORM test format
     *
     * Structure:
     * - "questions" key contains a list of TestQuestion instances
     * - Each TestQuestion has: questionTextArea, options (list of AnswerOption)
     *
     * @param dict - Dictionary element of the ScormTestIdevice
     * @returns Array of question objects in form iDevice format
     */
    private extractQuestions(dict: Element): ScormQuestionData[] {
        const questionsData: ScormQuestionData[] = [];

        // Find questions list
        const questionsList = this.findDictList(dict, 'questions');
        if (!questionsList) return questionsData;

        // Iterate over TestQuestion instances
        const questions = this.getDirectChildrenByTagName(questionsList, 'instance').filter(inst =>
            (inst.getAttribute('class') || '').includes('TestQuestion'),
        );
        for (const q of questions) {
            const qDict = this.getDirectChildByTagName(q, 'dictionary');
            if (!qDict) continue;

            // Extract question text
            const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
            const baseText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : '';

            // Extract options/answers
            const answers = this.extractOptions(qDict);

            // Determine if multiple answers are correct
            const correctCount = answers.filter(a => a[0] === true).length;
            const selectionType = correctCount > 1 ? 'multiple' : 'single';

            if (baseText || answers.length > 0) {
                questionsData.push({
                    activityType: 'selection',
                    selectionType: selectionType,
                    baseText: baseText,
                    answers: answers,
                });
            }
        }

        return questionsData;
    }

    /**
     * Extract answer options from a question dictionary
     *
     * @param qDict - Question dictionary element
     * @returns Array of [isCorrect, answerText] pairs
     */
    private extractOptions(qDict: Element): ScormQuestionAnswer[] {
        const answers: ScormQuestionAnswer[] = [];

        // Look for options list
        const optionsList = this.findDictList(qDict, 'options');
        if (!optionsList) return answers;

        // Iterate over AnswerOption instances
        const options = this.getDirectChildrenByTagName(optionsList, 'instance').filter(inst =>
            (inst.getAttribute('class') || '').includes('AnswerOption'),
        );
        for (const opt of options) {
            const optDict = this.getDirectChildByTagName(opt, 'dictionary');
            if (!optDict) continue;

            // Extract answer text
            const answerTextArea = this.findDictInstance(optDict, 'answerTextArea');
            let answerText = '';
            if (answerTextArea) {
                answerText = this.extractTextAreaFieldContent(answerTextArea);
                // Strip HTML for answer text
                answerText = this.stripHtmlTags(answerText);
            }

            // Extract isCorrect
            const isCorrect = this.findDictBoolValue(optDict, 'isCorrect');

            if (answerText) {
                answers.push([isCorrect, answerText]);
            }
        }

        return answers;
    }
}

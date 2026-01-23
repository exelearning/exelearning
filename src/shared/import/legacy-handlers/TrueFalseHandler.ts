/**
 * TrueFalseHandler
 *
 * Handles legacy TrueFalseIdevice.
 * Converts to modern 'trueorfalse' iDevice with game-compatible format.
 *
 * Legacy XML structure:
 * - exe.engine.truefalseidevice.TrueFalseIdevice
 * - exe.engine.verdaderofalsofpdidevice.VerdaderoFalsoFPDIdevice (Spanish variant)
 *
 * Uses TrueFalseQuestion with isCorrect, hint, feedback fields.
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Question structure for true/false game format
 */
interface TrueFalseQuestionGame {
    question: string;
    feedback: string;
    suggestion: string;
    solution: number; // 1 for true, 0 for false
}

/**
 * Default messages for the true/false game
 */
interface TrueFalseMessages {
    msgStartGame: string;
    msgTime: string;
    msgNoImage: string;
    msgScoreScorm: string;
    msgEndGameScore: string;
    msgOnlySaveScore: string;
    msgOnlySave: string;
    msgYouScore: string;
    msgAuthor: string;
    msgOnlySaveAuto: string;
    msgSaveAuto: string;
    msgSeveralScore: string;
    msgYouLastScore: string;
    msgActityComply: string;
    msgPlaySeveralTimes: string;
    msgUncompletedActivity: string;
    msgSuccessfulActivity: string;
    msgUnsuccessfulActivity: string;
    msgTypeGame: string;
    msgFeedback: string;
    msgSuggestion: string;
    msgSolution: string;
    msgQuestion: string;
    msgTrue: string;
    msgFalse: string;
    msgOk: string;
    msgKO: string;
    msgShow: string;
    msgHide: string;
    msgCheck: string;
    msgReboot: string;
    msgScore: string;
    msgWeight: string;
    msgNext: string;
    msgPrevious: string;
}

export class TrueFalseHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return className.includes('TrueFalseIdevice') || className.includes('VerdaderoFalsoFPDIdevice');
    }

    /**
     * Get the target modern iDevice type
     * Matches Symfony: 'trueorfalse'
     */
    getTargetType(): string {
        return 'trueorfalse';
    }

    /**
     * Get default messages for the game
     * These match the messages used by edition/trueorfalse.js
     */
    private getDefaultMessages(): TrueFalseMessages {
        return {
            msgStartGame: 'Click here to start',
            msgTime: 'Time per question',
            msgNoImage: 'No picture question',
            msgScoreScorm: "The score can't be saved because this page is not part of a SCORM package.",
            msgEndGameScore: 'Please start the game before saving your score.',
            msgOnlySaveScore: 'You can only save the score once!',
            msgOnlySave: 'You can only save once',
            msgYouScore: 'Your score',
            msgAuthor: 'Authorship',
            msgOnlySaveAuto: 'Your score will be saved after each question. You can only play once.',
            msgSaveAuto: 'Your score will be automatically saved after each question.',
            msgSeveralScore: 'You can save the score as many times as you want',
            msgYouLastScore: 'The last score saved is',
            msgActityComply: 'You have already done this activity.',
            msgPlaySeveralTimes: 'You can do this activity as many times as you want',
            msgUncompletedActivity: 'Incomplete activity',
            msgSuccessfulActivity: 'Activity: Passed. Score: %s',
            msgUnsuccessfulActivity: 'Activity: Not passed. Score: %s',
            msgTypeGame: 'True or false',
            msgFeedback: 'Feedback',
            msgSuggestion: 'Suggestion',
            msgSolution: 'Solution',
            msgQuestion: 'Question',
            msgTrue: 'True',
            msgFalse: 'False',
            msgOk: 'Correct',
            msgKO: 'Incorrect',
            msgShow: 'Show',
            msgHide: 'Hide',
            msgCheck: 'Check',
            msgReboot: 'Try again!',
            msgScore: 'Score',
            msgWeight: 'Weight',
            msgNext: 'Next',
            msgPrevious: 'Previous',
        };
    }

    /**
     * Extract properties in the game-compatible format expected by the renderer.
     * This generates the full format with typeGame, questionsGame, msgs, etc.
     * to avoid the need for transformation at edit time.
     */
    extractProperties(dict: Element, ideviceId?: string): Record<string, unknown> {
        const questionsGame = this.extractQuestionsGame(dict);
        const instructions = this.extractHtmlView(dict);

        if (questionsGame.length > 0) {
            return {
                id: ideviceId || '',
                typeGame: 'TrueOrFalse',
                eXeGameInstructions: instructions || '',
                eXeIdeviceTextAfter: '',
                msgs: this.getDefaultMessages(),
                questionsRandom: false,
                percentageQuestions: 100,
                isTest: false,
                time: 0,
                questionsGame: questionsGame,
                isScorm: 0,
                textButtonScorm: 'Save score',
                repeatActivity: true,
                weighted: 100,
                evaluation: false,
                evaluationID: '',
                showSlider: false,
                ideviceId: ideviceId || '',
            };
        }
        return {};
    }

    /**
     * Extract questions from legacy TrueFalseIdevice format in game-compatible format.
     *
     * Structure:
     * - list of TrueFalseQuestion instances
     * - TrueFalseQuestion has: questionTextArea, isCorrect, hintTextArea, feedbackTextArea
     *
     * Output format matches what the renderer expects:
     * - question: HTML content
     * - feedback: HTML content
     * - suggestion: HTML content (from hint)
     * - solution: 1 for true, 0 for false
     *
     * @param dict - Dictionary element of the TrueFalseIdevice
     * @returns Array of question objects in game format
     */
    private extractQuestionsGame(dict: Element): TrueFalseQuestionGame[] {
        const questionsGame: TrueFalseQuestionGame[] = [];

        // Find the list containing TrueFalseQuestion instances
        // Look for <list> elements containing TrueFalseQuestion
        const lists = this.getDirectChildrenByTagName(dict, 'list');
        let questionsList: Element | null = null;

        for (const list of lists) {
            const firstInst = this.getDirectChildByTagName(list, 'instance');
            if (firstInst) {
                const className = firstInst.getAttribute('class') || '';
                if (className.includes('TrueFalseQuestion')) {
                    questionsList = list;
                    break;
                }
            }
        }

        // Alternative: questions may be in a "questions" key
        if (!questionsList) {
            questionsList = this.findDictList(dict, 'questions');
        }

        if (!questionsList) return questionsGame;

        // Iterate each TrueFalseQuestion
        const questionInstances = this.getDirectChildrenByTagName(questionsList, 'instance');
        for (const questionInst of questionInstances) {
            const qDict = this.getDirectChildByTagName(questionInst, 'dictionary');
            if (!qDict) continue;

            // Extract question text
            const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
            // Alternative key used in some versions - look for TextAreaField by class
            let altTextArea: Element | null | undefined = questionTextArea;
            if (!altTextArea) {
                const instances = this.getElementsByClassContains(qDict, 'instance', 'TextAreaField');
                altTextArea = instances[0];
            }
            const questionText = altTextArea ? this.extractTextAreaFieldContent(altTextArea) : '';

            // Get isCorrect flag (determines if statement is true or false)
            const isCorrect = this.findDictBoolValue(qDict, 'isCorrect');

            // Extract hint (optional) - maps to 'suggestion' in game format
            const hintTextArea = this.findDictInstance(qDict, 'hintTextArea');
            const suggestion = hintTextArea ? this.extractTextAreaFieldContent(hintTextArea) : '';

            // Extract feedback (optional)
            const feedbackTextArea = this.findDictInstance(qDict, 'feedbackTextArea');
            const feedback = feedbackTextArea ? this.extractTextAreaFieldContent(feedbackTextArea) : '';

            // Only add if we have question text
            if (questionText) {
                questionsGame.push({
                    question: questionText,
                    feedback: feedback,
                    suggestion: suggestion,
                    solution: isCorrect ? 1 : 0,
                });
            }
        }

        return questionsGame;
    }

    /**
     * Extract instructions HTML (optional intro text)
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        // TrueFalseIdevice may have instructionsForLearners
        const instructionsArea = this.findDictInstance(dict, 'instructionsForLearners');
        if (instructionsArea) {
            return this.extractTextAreaFieldContent(instructionsArea);
        }

        // Alternative: direct TextAreaField for instructions
        const instances = this.getDirectChildrenByTagName(dict, 'instance');
        const textArea = instances.find(inst => (inst.getAttribute('class') || '').includes('TextAreaField'));
        if (textArea) {
            return this.extractTextAreaFieldContent(textArea);
        }

        return '';
    }

    /**
     * No feedback at iDevice level for TrueFalse
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }
}

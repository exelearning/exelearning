/**
 * FpdSolvedExerciseHandler
 *
 * Handles legacy SolvedExerciseIdevice (FPD solved exercise format).
 * Converts to modern 'text' iDevice with story and question/feedback sections.
 *
 * Legacy XML structure:
 * - exe.engine.ejercicioresueltofpdidevice.SolvedExerciseIdevice
 * - exe.engine.ejercicioresueltofpdidevice.EjercicioResueltoFpdIdevice
 *
 * Extracts:
 * - storyTextArea (intro text)
 * - questions list with Question instances (questionTextArea + feedbackTextArea)
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

export class FpdSolvedExerciseHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        return (
            className.includes('SolvedExerciseIdevice') ||
            className.includes('EjercicioResueltoFpdIdevice') ||
            className.includes('ejercicioresueltofpdidevice')
        );
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'text';
    }

    /**
     * Extract HTML view combining story and questions with feedback
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    extractHtmlView(dict: Element, context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        let html = '';

        // Extract story text area (intro)
        const storyArea = this.findDictInstance(dict, 'storyTextArea');
        if (storyArea) {
            const storyContent = this.extractTextAreaFieldContent(storyArea);
            if (storyContent) {
                html += storyContent;
            }
        }

        // Extract questions with feedback
        const questionsList = this.findDictList(dict, 'questions');
        if (questionsList) {
            const questions = this.getDirectChildrenByTagName(questionsList, 'instance').filter(inst =>
                (inst.getAttribute('class') || '').includes('Question'),
            );
            for (const q of questions) {
                const qDict = this.getDirectChildByTagName(q, 'dictionary');
                if (!qDict) continue;

                // Extract question text
                const questionTextArea = this.findDictInstance(qDict, 'questionTextArea');
                if (questionTextArea) {
                    const questionContent = this.extractTextAreaFieldContent(questionTextArea);
                    if (questionContent) {
                        html += questionContent;
                    }
                }

                // Extract feedback and render button + hidden div (matching Symfony approach)
                const feedbackTextArea = this.findDictInstance(qDict, 'feedbackTextArea');
                if (feedbackTextArea) {
                    const feedbackContent = this.extractTextAreaFieldContent(feedbackTextArea);
                    if (feedbackContent) {
                        // Get button caption if available
                        const feedbackDict = this.getDirectChildByTagName(feedbackTextArea, 'dictionary');
                        const defaultCaption = this.getLocalizedFeedbackText(context?.language);
                        let buttonCaption = defaultCaption;
                        if (feedbackDict) {
                            const caption = this.findDictStringValue(feedbackDict, 'buttonCaption');
                            if (caption) {
                                buttonCaption = caption;
                            }
                        }
                        // Render feedback button and div (matching FreeTextHandler pattern)
                        html += `<div class="iDevice_buttons feedback-button js-required">
<input type="button" class="feedbacktooglebutton" value="${buttonCaption}" data-text-a="${buttonCaption}" data-text-b="${buttonCaption}">
</div>
<div class="feedback js-feedback js-hidden" style="display: none;">${feedbackContent}</div>`;
                    }
                }
            }
        }

        return html;
    }

    /**
     * No feedback for FPD solved exercise iDevice (feedback is inline)
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties (none needed for text iDevice)
     */
    extractProperties(_dict: Element, _ideviceId?: string): Record<string, unknown> {
        return {};
    }
}

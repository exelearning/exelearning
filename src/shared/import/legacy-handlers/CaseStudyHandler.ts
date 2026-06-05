/**
 * CaseStudyHandler
 *
 * Handles legacy CaseStudyIdevice and EjercicioresueltofpdIdevice.
 * Converts to modern 'casestudy' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.casestudyidevice.CaseStudyIdevice
 * - exe.engine.ejercicioresueltofpdidevice.EjercicioresueltofpdIdevice (Solved Exercises FPD)
 *
 * Both share the same structure:
 * - storyTextArea: main content (history)
 * - questions: list of Question instances with questionTextArea + feedbackTextArea
 *
 * Extracts:
 * - history (storyTextArea) - main content
 * - activities - list of activity/feedback pairs
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Activity structure for case study
 */
interface CaseStudyActivity {
    activity: string;
    feedback: string;
    buttonCaption: string;
}

export class CaseStudyHandler extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     * Case-insensitive match for CasestudyIdevice and EjercicioresueltofpdIdevice
     */
    canHandle(className: string, _ideviceType?: string): boolean {
        const lowerName = className.toLowerCase();
        return lowerName.includes('casestudyidevice') || lowerName.includes('ejercicioresueltofpdidevice');
    }

    /**
     * Get the target modern iDevice type
     */
    getTargetType(): string {
        return 'casestudy';
    }

    /**
     * Extract HTML view - returns empty for casestudy
     * All content goes in jsonProperties (history + activities)
     * because casestudy has componentType: 'json'
     */
    extractHtmlView(_dict: Element, _context?: IdeviceHandlerContext): string {
        // For casestudy iDevice, all content goes in jsonProperties
        // The editor expects { history: "...", activities: [...] }
        return '';
    }

    /**
     * No direct feedback for casestudy - activities have individual feedback
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Extract properties including history and activities
     * This populates jsonProperties for the casestudy editor
     *
     * @param dict - Dictionary element
     * @param _ideviceId - iDevice ID (unused)
     * @param context - Context with language info
     */
    extractProperties(dict: Element, _ideviceId?: string, context?: IdeviceHandlerContext): Record<string, unknown> {
        // Default structure with all required fields for modern casestudy iDevice
        // textInfo* fields are new in modern format - not in legacy, so default to empty
        const defaultProperties = {
            history: '',
            activities: [] as CaseStudyActivity[],
            // Task info fields (new in modern format, not in legacy)
            textInfoDurationInput: '',
            textInfoDurationTextInput: '',
            textInfoParticipantsInput: '',
            textInfoParticipantsTextInput: '',
        };

        if (!dict) return defaultProperties;

        const properties = { ...defaultProperties };

        // Extract story/history (main content)
        const storyTextArea = this.findDictInstance(dict, 'storyTextArea');
        if (storyTextArea) {
            properties.history = this.extractTextAreaFieldContent(storyTextArea);
        } else {
            // Alternative: Look for story key
            const storyInst = this.findDictInstance(dict, 'story');
            if (storyInst) {
                properties.history = this.extractTextAreaFieldContent(storyInst);
            }
        }

        // Extract activities (always an array, even if empty)
        properties.activities = this.extractActivities(dict, context);

        return properties;
    }

    /**
     * Extract activities from the legacy format
     *
     * Structure:
     * - "questions" key contains a list of exe.engine.casestudyidevice.Question instances
     * - Each Question has: questionTextArea, feedbackTextArea
     *
     * @param dict - Dictionary element of the CaseStudyIdevice
     * @param context - Context with language info
     * @returns Array of activity objects
     */
    private extractActivities(dict: Element, context?: IdeviceHandlerContext): CaseStudyActivity[] {
        const activities: CaseStudyActivity[] = [];

        // Primary: Look for "questions" list (legacy CasestudyIdevice format)
        let activitiesList = this.findDictList(dict, 'questions');

        // Fallback: Find list containing Question or CasestudyActivityField instances
        if (!activitiesList) {
            const lists = this.getDirectChildrenByTagName(dict, 'list');
            for (const list of lists) {
                const firstInst = this.getDirectChildByTagName(list, 'instance');
                if (firstInst) {
                    const className = firstInst.getAttribute('class') || '';
                    if (className.includes('Question') || className.includes('CasestudyActivityField')) {
                        activitiesList = list;
                        break;
                    }
                }
            }
        }

        // Alternative: activities may be in an "_activities" key
        if (!activitiesList) {
            activitiesList = this.findDictList(dict, '_activities');
        }

        if (!activitiesList) return activities;

        // Iterate each Question/Activity instance
        const activityInstances = this.getDirectChildrenByTagName(activitiesList, 'instance');
        for (const activityInst of activityInstances) {
            const aDict = this.getDirectChildByTagName(activityInst, 'dictionary');
            if (!aDict) continue;

            // Extract activity/question text (try both field names)
            let activityTextArea = this.findDictInstance(aDict, 'questionTextArea');
            if (!activityTextArea) {
                activityTextArea = this.findDictInstance(aDict, 'activityTextArea');
            }
            const activityText = activityTextArea ? this.extractTextAreaFieldContent(activityTextArea) : '';

            // Extract feedback - try multiple formats
            let feedbackText = '';
            let buttonCaption = '';

            // Strategy 1: Look for feedbackTextArea key (some legacy formats)
            const feedbackTextArea = this.findDictInstance(aDict, 'feedbackTextArea');
            if (feedbackTextArea) {
                feedbackText = this.extractTextAreaFieldContent(feedbackTextArea);
                const feedbackDict = this.getDirectChildByTagName(feedbackTextArea, 'dictionary');
                if (feedbackDict) {
                    buttonCaption = this.findDictStringValue(feedbackDict, 'buttonCaption') || '';
                }
            }

            // Strategy 2: Look for Feedback2Field instance (Symfony legacy format)
            // Structure: <instance class="exe.engine.field.Feedback2Field">
            if (!feedbackText) {
                const instances = this.getDirectChildrenByTagName(aDict, 'instance');
                const feedback2Field = instances.find(inst =>
                    (inst.getAttribute('class') || '').includes('Feedback2Field'),
                );
                if (feedback2Field) {
                    feedbackText = this.extractTextAreaFieldContent(feedback2Field);
                    const fbDict = this.getDirectChildByTagName(feedback2Field, 'dictionary');
                    if (fbDict) {
                        buttonCaption = this.findDictStringValue(fbDict, 'buttonCaption') || '';
                    }
                }
            }

            if (activityText || feedbackText) {
                // Use project language for localized default caption
                const defaultCaption = this.getLocalizedFeedbackText(context?.language);
                activities.push({
                    activity: activityText,
                    feedback: feedbackText,
                    buttonCaption: buttonCaption || defaultCaption,
                });
            }
        }

        return activities;
    }
}

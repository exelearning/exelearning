/**
 * CaseStudyHandler
 *
 * Handles legacy CaseStudyIdevice.
 * Converts to modern 'casestudy' iDevice.
 *
 * Legacy XML structure:
 * - exe.engine.casestudyidevice.CaseStudyIdevice
 *
 * Extracts:
 * - history (storyTextArea) - main content
 * - activities - list of activity/feedback pairs
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class CaseStudyHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   * Case-insensitive match: legacy files may have 'CasestudyIdevice' or 'CaseStudyIdevice'
   */
  canHandle(className) {
    return className.toLowerCase().includes('casestudyidevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'casestudy';
  }

  /**
   * Extract HTML view - returns empty for casestudy
   * All content goes in jsonProperties (history + activities)
   * because casestudy has componentType: 'json'
   */
  extractHtmlView(dict) {
    // For casestudy iDevice, all content goes in jsonProperties
    // The editor expects { history: "...", activities: [...] }
    return '';
  }

  /**
   * Extract properties including history and activities
   * This populates jsonProperties for the casestudy editor
   * @param {Element} dict - Dictionary element
   * @param {string} ideviceId - iDevice ID (unused)
   * @param {Object} context - Context with language info
   */
  extractProperties(dict, ideviceId, context = {}) {
    // Default structure with all required fields for modern casestudy iDevice
    // textInfo* fields are new in modern format - not in legacy, so default to empty
    const defaultProperties = {
      history: '',
      activities: [],
      // Task info fields (new in modern format, not in legacy)
      textInfoDurationInput: '',
      textInfoDurationTextInput: '',
      textInfoParticipantsInput: '',
      textInfoParticipantsTextInput: ''
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
   * @param {Element} dict - Dictionary element of the CaseStudyIdevice
   * @returns {Array} Array of activity objects
   */
  extractActivities(dict, context = {}) {
    const activities = [];

    // Primary: Look for "questions" list (legacy CasestudyIdevice format)
    let activitiesList = this.findDictList(dict, 'questions');

    // Fallback: Find list containing Question or CasestudyActivityField instances
    if (!activitiesList) {
      const lists = dict.querySelectorAll(':scope > list');
      for (const list of lists) {
        const firstInst = list.querySelector(':scope > instance');
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
    const activityInstances = activitiesList.querySelectorAll(':scope > instance');
    for (const activityInst of activityInstances) {
      const aDict = activityInst.querySelector(':scope > dictionary');
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
        const feedbackDict = feedbackTextArea.querySelector(':scope > dictionary');
        if (feedbackDict) {
          buttonCaption = this.findDictStringValue(feedbackDict, 'buttonCaption') || '';
        }
      }

      // Strategy 2: Look for Feedback2Field instance (Symfony legacy format)
      // Structure: <instance class="exe.engine.field.Feedback2Field">
      if (!feedbackText) {
        const feedback2Field = aDict.querySelector(':scope > instance[class*="Feedback2Field"]');
        if (feedback2Field) {
          feedbackText = this.extractTextAreaFieldContent(feedback2Field);
          const fbDict = feedback2Field.querySelector(':scope > dictionary');
          if (fbDict) {
            buttonCaption = this.findDictStringValue(fbDict, 'buttonCaption') || '';
          }
        }
      }

      if (activityText || feedbackText) {
        // Use project language for localized default caption
        const defaultCaption = this.getLocalizedFeedbackText(context.language);
        activities.push({
          activity: activityText,
          feedback: feedbackText,
          buttonCaption: buttonCaption || defaultCaption
        });
      }
    }

    return activities;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CaseStudyHandler;
} else {
  window.CaseStudyHandler = CaseStudyHandler;
}

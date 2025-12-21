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
   */
  canHandle(className) {
    return className.includes('CaseStudyIdevice');
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'casestudy';
  }

  /**
   * Extract the main story/history content
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    // Look for storyTextArea (main content)
    const storyTextArea = this.findDictInstance(dict, 'storyTextArea');
    if (storyTextArea) {
      return this.extractTextAreaFieldContent(storyTextArea);
    }

    // Alternative: Look for story key
    const storyInst = this.findDictInstance(dict, 'story');
    if (storyInst) {
      return this.extractTextAreaFieldContent(storyInst);
    }

    return '';
  }

  /**
   * Extract properties including activities
   */
  extractProperties(dict) {
    const activities = this.extractActivities(dict);
    if (activities.length > 0) {
      return { activities };
    }
    return {};
  }

  /**
   * Extract activities from the legacy format
   *
   * Structure:
   * - list of CasestudyActivityField instances
   * - Each has: activityTextArea, feedbackTextArea
   *
   * @param {Element} dict - Dictionary element of the CaseStudyIdevice
   * @returns {Array} Array of activity objects
   */
  extractActivities(dict) {
    const activities = [];

    // Find the list containing CasestudyActivityField instances
    const lists = dict.querySelectorAll(':scope > list');
    let activitiesList = null;

    for (const list of lists) {
      const firstInst = list.querySelector(':scope > instance');
      if (firstInst) {
        const className = firstInst.getAttribute('class') || '';
        if (className.includes('CasestudyActivityField')) {
          activitiesList = list;
          break;
        }
      }
    }

    // Alternative: activities may be in an "_activities" key
    if (!activitiesList) {
      activitiesList = this.findDictList(dict, '_activities');
    }

    if (!activitiesList) return activities;

    // Iterate each CasestudyActivityField
    const activityInstances = activitiesList.querySelectorAll(':scope > instance');
    for (const activityInst of activityInstances) {
      const aDict = activityInst.querySelector(':scope > dictionary');
      if (!aDict) continue;

      // Extract activity text
      const activityTextArea = this.findDictInstance(aDict, 'activityTextArea');
      const activityText = activityTextArea ? this.extractTextAreaFieldContent(activityTextArea) : '';

      // Extract feedback text
      const feedbackTextArea = this.findDictInstance(aDict, 'feedbackTextArea');
      const feedbackText = feedbackTextArea ? this.extractTextAreaFieldContent(feedbackTextArea) : '';

      // Get button caption (optional)
      let buttonCaption = '';
      if (feedbackTextArea) {
        const feedbackDict = feedbackTextArea.querySelector(':scope > dictionary');
        if (feedbackDict) {
          buttonCaption = this.findDictStringValue(feedbackDict, 'buttonCaption') || '';
        }
      }

      if (activityText) {
        activities.push({
          activity: activityText,
          feedback: feedbackText,
          buttonCaption: buttonCaption || 'Show Feedback'
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

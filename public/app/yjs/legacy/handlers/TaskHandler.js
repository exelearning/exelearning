/**
 * TaskHandler
 *
 * Handles legacy TaskIdevice.
 * Converts to modern 'text' iDevice but extracts Task Information
 * (Duration and Participants) to populate the metadata fields.
 *
 * Legacy XML structure:
 * - exe.engine.taskidevice.TaskIdevice
 *
 * Extracts:
 * - content (text/html)
 * - duration (opTime/duration)
 * - participants (grouping/participants)
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class TaskHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   */
  canHandle(className) {
    return className.includes('TaskIdevice');
  }

  /**
   * Get the target modern iDevice type
   * Maps to 'text' but with extra properties
   */
  getTargetType() {
    return 'text';
  }

  /**
   * Extract HTML view
   *
   * @param {Element} dict - Dictionary element
   * @param {Object} context - Context
   */
  extractHtmlView(dict, context = {}) {
    if (!dict) return '';

    // Strategy 1: Look for content field
    // TaskIdevice usually stores content in 'content' field
    const content = this.extractRichTextContent(dict, 'content');
    if (content) return content;

    // Fallback: Default extraction
    return this.extractAnyTextFieldContent(dict);
  }

  /**
   * Extract properties including Duration and Participants
   *
   * @param {Element} dict - Dictionary element
   * @param {string} ideviceId - iDevice ID
   * @param {Object} context - Context with language info
   */
  extractProperties(dict, ideviceId, context = {}) {
    if (!dict) return {};

    const properties = {
      // Task info fields (new in modern format)
      // Input: The actual value (e.g. "30 min")
      // TextInput: The label (e.g. "Duration:")
      textInfoDurationInput: '',
      textInfoDurationTextInput: '',
      textInfoParticipantsInput: '',
      textInfoParticipantsTextInput: ''
    };

    // Extract Duration
    // Legacy keys: 'opTime', 'duration'
    const duration = this.findDictStringValue(dict, 'opTime') || 
                     this.findDictStringValue(dict, 'duration');
    
    if (duration) {
      properties.textInfoDurationInput = duration;
    }

    // Extract Participants/Grouping
    // Legacy keys: 'grouping', 'participants'
    const participants = this.findDictStringValue(dict, 'grouping') || 
                         this.findDictStringValue(dict, 'participants');

    if (participants) {
      properties.textInfoParticipantsInput = participants;
    }

    return properties;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskHandler;
} else {
  window.TaskHandler = TaskHandler;
}

/**
 * TaskHandler Tests
 */

const BaseLegacyHandler = require('../BaseLegacyHandler');
global.BaseLegacyHandler = BaseLegacyHandler;
const TaskHandler = require('./TaskHandler');

// Helper to parse XML
const createXmlDoc = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

const parseDictionary = (xmlString) => {
  const doc = createXmlDoc(xmlString);
  return doc.querySelector('dictionary');
};

describe('TaskHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new TaskHandler();
  });

  describe('canHandle', () => {
    it('handles TaskIdevice', () => {
      expect(handler.canHandle('exe.engine.taskidevice.TaskIdevice')).toBe(true);
    });

    it('does not handle other idevices', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns text', () => {
      expect(handler.getTargetType()).toBe('text');
    });
  });

  describe('extractProperties', () => {
    it('extracts Duration and Participants into correct value fields', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="opTime"></string>
          <unicode value="30 min"></unicode>
          <string role="key" value="grouping"></string>
          <unicode value="Small group"></unicode>
        </dictionary>
      `);

      const props = handler.extractProperties(dict, 'test-id');
      
      // Corrected mapping:
      // textInfoDurationInput: Value field (e.g. "30 min")
      // textInfoDurationTextInput: Label field (e.g. "Duration:")
      expect(props.textInfoDurationInput).toBe('30 min');
      expect(props.textInfoDurationTextInput).toBe('');
      expect(props.textInfoParticipantsInput).toBe('Small group');
      expect(props.textInfoParticipantsTextInput).toBe('');
    });

    it('handles missing metadata gracefully', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict, 'test-id');
      expect(props.textInfoDurationInput).toBe('');
      expect(props.textInfoParticipantsInput).toBe('');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts content without appending metadata', () => {
      const dict = parseDictionary('<dictionary><string role="key" value="content"></string><unicode value="&lt;p&gt;Main task content&lt;/p&gt;"></unicode></dictionary>');

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Main task content</p>');
    });
  });
});
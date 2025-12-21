/**
 * CaseStudyHandler Tests
 *
 * Unit tests for CaseStudyHandler - handles CaseStudyIdevice.
 */

// Load BaseLegacyHandler first and make it global
global.BaseLegacyHandler = require('../BaseLegacyHandler');
const CaseStudyHandler = require('./CaseStudyHandler');

// Helper to parse XML
const createXmlDoc = (xmlString) => {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
};

const parseDictionary = (xmlString) => {
  const doc = createXmlDoc(xmlString);
  return doc.querySelector('dictionary');
};

// Escape XML special characters
const escapeXml = (str) => {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

describe('CaseStudyHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new CaseStudyHandler();
  });

  describe('canHandle', () => {
    it('returns true for CaseStudyIdevice', () => {
      expect(handler.canHandle('exe.engine.casestudyidevice.CaseStudyIdevice')).toBe(true);
    });

    it('returns false for other iDevice types', () => {
      expect(handler.canHandle('exe.engine.freetextidevice.FreeTextIdevice')).toBe(false);
    });
  });

  describe('getTargetType', () => {
    it('returns casestudy', () => {
      expect(handler.getTargetType()).toBe('casestudy');
    });
  });

  describe('extractHtmlView', () => {
    it('extracts content from storyTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="storyTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Case study story</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Case study story</p>');
    });

    it('extracts content from story key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="story"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Alternative story</p>')}"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);

      const html = handler.extractHtmlView(dict);
      expect(html).toBe('<p>Alternative story</p>');
    });

    it('returns empty string for null dict', () => {
      expect(handler.extractHtmlView(null)).toBe('');
    });

    it('returns empty string when no story found', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts activities array', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.casestudyidevice.CasestudyActivityField">
              <dictionary>
                <string role="key" value="activityTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Activity 1</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Feedback 1</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const props = handler.extractProperties(dict);

      expect(props.activities).toBeDefined();
      expect(props.activities.length).toBe(1);
    });

    it('returns empty object when no activities', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({});
    });
  });

  describe('extractActivities', () => {
    it('extracts activity and feedback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.casestudyidevice.CasestudyActivityField">
              <dictionary>
                <string role="key" value="activityTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Analyze the case</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Good analysis!</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);

      expect(activities.length).toBe(1);
      expect(activities[0].activity).toBe('<p>Analyze the case</p>');
      expect(activities[0].feedback).toBe('<p>Good analysis!</p>');
      expect(activities[0].buttonCaption).toBe('Show Feedback');
    });

    it('handles multiple activities', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="exe.engine.casestudyidevice.CasestudyActivityField">
              <dictionary>
                <string role="key" value="activityTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Activity 1</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.casestudyidevice.CasestudyActivityField">
              <dictionary>
                <string role="key" value="activityTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Activity 2</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);
      expect(activities.length).toBe(2);
    });

    it('looks for _activities key', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="_activities"></string>
          <list>
            <instance class="exe.engine.casestudyidevice.CasestudyActivityField">
              <dictionary>
                <string role="key" value="activityTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Activity</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);
      expect(activities.length).toBe(1);
    });

    it('skips activities without text', () => {
      const dict = parseDictionary(`
        <dictionary>
          <list>
            <instance class="CasestudyActivityField">
              <dictionary></dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);
      expect(activities).toEqual([]);
    });

    it('returns empty array when no activities list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const activities = handler.extractActivities(dict);
      expect(activities).toEqual([]);
    });
  });
});

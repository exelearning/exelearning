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
    it('returns true for CasestudyIdevice (lowercase s - actual legacy format)', () => {
      expect(handler.canHandle('exe.engine.casestudyidevice.CasestudyIdevice')).toBe(true);
    });

    it('returns true for CaseStudyIdevice (uppercase S - alternative format)', () => {
      expect(handler.canHandle('exe.engine.casestudyidevice.CaseStudyIdevice')).toBe(true);
    });

    it('returns true for mixed case variations', () => {
      expect(handler.canHandle('exe.engine.casestudyidevice.CASESTUDYIDEVICE')).toBe(true);
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
    it('returns empty string - casestudy uses jsonProperties for all content', () => {
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

      // extractHtmlView always returns empty for casestudy
      // Story content goes in properties.history instead
      const html = handler.extractHtmlView(dict);
      expect(html).toBe('');
    });

    it('returns empty string for any dict', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      expect(handler.extractHtmlView(dict)).toBe('');
    });
  });

  describe('extractProperties', () => {
    it('extracts history and activities', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="storyTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="${escapeXml('<p>Case study story</p>')}"></unicode>
            </dictionary>
          </instance>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.casestudyidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question 1</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="buttonCaption"></string>
                    <unicode value="Ver respuesta"></unicode>
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

      // Should extract history from storyTextArea
      expect(props.history).toBe('<p>Case study story</p>');

      // Should extract activities
      expect(props.activities).toBeDefined();
      expect(props.activities.length).toBe(1);
      expect(props.activities[0].activity).toBe('<p>Question 1</p>');
      expect(props.activities[0].feedback).toBe('<p>Feedback 1</p>');
      expect(props.activities[0].buttonCaption).toBe('Ver respuesta');
    });

    it('extracts history from story key (alternative)', () => {
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

      const props = handler.extractProperties(dict);
      expect(props.history).toBe('<p>Alternative story</p>');
    });

    it('returns default structure when no content', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const props = handler.extractProperties(dict);
      expect(props).toEqual({
        history: '',
        activities: [],
        textInfoDurationInput: '',
        textInfoDurationTextInput: '',
        textInfoParticipantsInput: '',
        textInfoParticipantsTextInput: ''
      });
    });

    it('returns default structure for null dict', () => {
      const props = handler.extractProperties(null);
      expect(props).toEqual({
        history: '',
        activities: [],
        textInfoDurationInput: '',
        textInfoDurationTextInput: '',
        textInfoParticipantsInput: '',
        textInfoParticipantsTextInput: ''
      });
    });

    it('includes textInfo fields with empty defaults', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="storyTextArea"></string>
          <instance class="exe.engine.field.TextAreaField">
            <dictionary>
              <string role="key" value="content_w_resourcePaths"></string>
              <unicode value="<p>Test</p>"></unicode>
            </dictionary>
          </instance>
        </dictionary>
      `);
      const props = handler.extractProperties(dict);
      expect(props.textInfoDurationInput).toBe('');
      expect(props.textInfoDurationTextInput).toBe('');
      expect(props.textInfoParticipantsInput).toBe('');
      expect(props.textInfoParticipantsTextInput).toBe('');
    });
  });

  describe('extractActivities', () => {
    it('extracts activity and feedback from Question format with questionTextArea', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.casestudyidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Analyze the case</p>')}"></unicode>
                  </dictionary>
                </instance>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="buttonCaption"></string>
                    <unicode value="Ver retroalimentación"></unicode>
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
      expect(activities[0].buttonCaption).toBe('Ver retroalimentación');
    });

    it('extracts activity and feedback from legacy CasestudyActivityField format', () => {
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

      // Pass Spanish context (default for legacy files)
      const activities = handler.extractActivities(dict, { language: 'es' });

      expect(activities.length).toBe(1);
      expect(activities[0].activity).toBe('<p>Analyze the case</p>');
      expect(activities[0].feedback).toBe('<p>Good analysis!</p>');
      // Uses project language for localized default caption
      expect(activities[0].buttonCaption).toBe('Mostrar retroalimentación');
    });

    it('handles multiple questions', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.casestudyidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question 1</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
            <instance class="exe.engine.casestudyidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Question 2</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);
      expect(activities.length).toBe(2);
      expect(activities[0].activity).toBe('<p>Question 1</p>');
      expect(activities[1].activity).toBe('<p>Question 2</p>');
    });

    it('extracts feedback even without activity text', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.casestudyidevice.Question">
              <dictionary>
                <string role="key" value="feedbackTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="buttonCaption"></string>
                    <unicode value="Show Info"></unicode>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Helpful information</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);
      expect(activities.length).toBe(1);
      expect(activities[0].activity).toBe('');
      expect(activities[0].feedback).toBe('<p>Helpful information</p>');
      expect(activities[0].buttonCaption).toBe('Show Info');
    });

    it('extracts feedback from Feedback2Field format (Symfony legacy)', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.casestudyidevice.Question">
              <dictionary>
                <string role="key" value="questionTextArea"></string>
                <instance class="exe.engine.field.TextAreaField">
                  <dictionary>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Activity question</p>')}"></unicode>
                  </dictionary>
                </instance>
                <instance class="exe.engine.field.Feedback2Field">
                  <dictionary>
                    <string role="key" value="buttonCaption"></string>
                    <unicode value="Ver retroalimentación"></unicode>
                    <string role="key" value="content_w_resourcePaths"></string>
                    <unicode value="${escapeXml('<p>Feedback content</p>')}"></unicode>
                  </dictionary>
                </instance>
              </dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);
      expect(activities.length).toBe(1);
      expect(activities[0].activity).toBe('<p>Activity question</p>');
      expect(activities[0].feedback).toBe('<p>Feedback content</p>');
      expect(activities[0].buttonCaption).toBe('Ver retroalimentación');
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

    it('skips questions without any text or feedback', () => {
      const dict = parseDictionary(`
        <dictionary>
          <string role="key" value="questions"></string>
          <list>
            <instance class="exe.engine.casestudyidevice.Question">
              <dictionary></dictionary>
            </instance>
          </list>
        </dictionary>
      `);

      const activities = handler.extractActivities(dict);
      expect(activities).toEqual([]);
    });

    it('returns empty array when no questions list', () => {
      const dict = parseDictionary('<dictionary></dictionary>');
      const activities = handler.extractActivities(dict);
      expect(activities).toEqual([]);
    });
  });
});

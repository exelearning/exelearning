/**
 * Unit tests for text iDevice (export/runtime)
 *
 * Tests configuration and basic functions.
 * Note: This file doesn't have auto-init call.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $text globally.
 * Note: This file doesn't have auto-init call.
 */
function loadExportIdevice(code) {
  // Mock $exe_i18n which is used at load time
  global.$exe_i18n = {
    showFeedback: 'Show feedback'
  };
  const modifiedCode = code.replace(/var\s+\$text\s*=/, 'global.$text =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$text;
}

describe('text iDevice export', () => {
  let $text;

  beforeEach(() => {
    global.$text = undefined;
    global.$exe_i18n = undefined;

    const filePath = join(__dirname, 'text.js');
    const code = readFileSync(filePath, 'utf-8');

    $text = loadExportIdevice(code);
  });

  describe('ideviceClass', () => {
    it('has expected class name', () => {
      expect($text.ideviceClass).toBe('textIdeviceContent');
    });
  });

  describe('working', () => {
    it('is initially false', () => {
      expect($text.working).toBe(false);
    });
  });

  describe('id constants', () => {
    it('has durationId', () => {
      expect($text.durationId).toBe('textInfoDurationInput');
    });

    it('has durationTextId', () => {
      expect($text.durationTextId).toBe('textInfoDurationTextInput');
    });

    it('has participantsId', () => {
      expect($text.participantsId).toBe('textInfoParticipantsInput');
    });

    it('has participantsTextId', () => {
      expect($text.participantsTextId).toBe('textInfoParticipantsTextInput');
    });

    it('has mainContentId', () => {
      expect($text.mainContentId).toBe('textTextarea');
    });

    it('has feedbackTitleId', () => {
      expect($text.feedbackTitleId).toBe('textFeedbackInput');
    });

    it('has feedbackContentId', () => {
      expect($text.feedbackContentId).toBe('textFeedbackTextarea');
    });
  });

  describe('renderView', () => {
    it('is a function', () => {
      expect(typeof $text.renderView).toBe('function');
    });

    it('replaces {content} with textTextarea in template', () => {
      global.c_ = (v) => v;
      const data = { textTextarea: '<p>Hello</p>', textFeedbackTextarea: '' };
      const result = $text.renderView(data, {}, '<div>{content}</div>');
      expect(result).toBe('<div><p>Hello</p></div>');
    });

    it('returns template with empty content when textTextarea is missing', () => {
      global.c_ = (v) => v;
      const data = { textFeedbackTextarea: '' };
      const result = $text.renderView(data, {}, '<div>{content}</div>');
      expect(result).toBe('<div></div>');
    });

    it('appends feedback HTML when feedbackContent exists and content has no feedback elements', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Main content</p>',
        textFeedbackTextarea: '<p>My feedback</p>',
        textFeedbackInput: 'Show Feedback',
      };
      const result = $text.renderView(data, {}, '<div>{content}</div>');
      expect(result).toContain('<p>Main content</p>');
      expect(result).toContain('feedbacktooglebutton');
      expect(result).toContain('Show Feedback');
      expect(result).toContain('My feedback');
    });

    it('does not duplicate feedback when content already has .feedback-button', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Text</p><div class="feedback-button"><input class="feedbackbutton" value="Btn"></div>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      // Should not contain a second feedbacktooglebutton from createFeedbackHTML
      const matches = result.match(/feedbacktooglebutton/g);
      expect(matches).toBeNull();
    });

    it('does not duplicate feedback when content already has .feedbacktooglebutton', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Text</p><input class="feedbacktooglebutton" value="Toggle">',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      // Only the original one, no extra from createFeedbackHTML appended
      const matches = result.match(/feedbacktooglebutton/g);
      expect(matches).toHaveLength(1);
    });

    it('does not duplicate feedback when content already has .feedback.js-feedback', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<div class="feedback js-feedback">Existing</div>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).not.toContain('feedbacktooglebutton');
    });

    it('does not duplicate feedback when content already has div.feedback', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<div class="feedback">Existing</div>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Show',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).not.toContain('feedbacktooglebutton');
    });

    it('uses defaultBtnFeedbackText when feedbackTitleId is empty', () => {
      global.c_ = (v) => v;
      const data = {
        textTextarea: '<p>Text</p>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: '',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).toContain('Show feedback');
    });

    it('uses c_() to translate the feedback button text', () => {
      global.c_ = (v) => `[translated] ${v}`;
      const data = {
        textTextarea: '<p>Text</p>',
        textFeedbackTextarea: '<p>Feedback</p>',
        textFeedbackInput: 'Mostrar',
      };
      const result = $text.renderView(data, {}, '{content}');
      expect(result).toContain('[translated] Mostrar');
    });
  });

  describe('getHTMLView', () => {
    it('is a function', () => {
      expect(typeof $text.getHTMLView).toBe('function');
    });

    it('extracts button text from feedbackbutton (legacy eXe 2.9) when textFeedbackInput is empty', () => {
      global.c_ = (v) => v;
      // eXe is provided by vitest.setup.js; patch only isInExe for this test
      const origIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = () => false;
      const data = {
        textTextarea: `<div class="exe-text"><p>Content</p></div>
<div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbackbutton" value="Evaluación" /></div>
<div class="feedback js-feedback js-hidden"><p>Feedback content</p></div>`,
        textFeedbackInput: '',
        textFeedbackTextarea: '',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textInfoDurationTextInput: '',
        textInfoParticipantsTextInput: '',
      };
      const result = $text.getHTMLView(data, '');
      eXe.app.isInExe = origIsInExe;
      expect(result).toContain('Evaluación');
      expect(result).toContain('Feedback content');
      expect(result).toContain('Content');
    });

    it('extracts button text from feedbacktooglebutton (eXe 4.0) when textFeedbackInput is empty', () => {
      global.c_ = (v) => v;
      const origIsInExe = eXe.app.isInExe;
      eXe.app.isInExe = () => false;
      const data = {
        textTextarea: `<p>Content</p>
<div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbacktooglebutton" value="Mostrar" /></div>
<div class="feedback js-feedback js-hidden"><p>Respuesta</p></div>`,
        textFeedbackInput: '',
        textFeedbackTextarea: '',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textInfoDurationTextInput: '',
        textInfoParticipantsTextInput: '',
      };
      const result = $text.getHTMLView(data, '');
      eXe.app.isInExe = origIsInExe;
      expect(result).toContain('Mostrar');
      expect(result).toContain('Respuesta');
    });
  });

  describe('createMainContent', () => {
    it('is a function', () => {
      expect(typeof $text.createMainContent).toBe('function');
    });
  });

  describe('createFeedbackHTML', () => {
    it('is a function', () => {
      expect(typeof $text.createFeedbackHTML).toBe('function');
    });

    it('returns HTML with feedback button and content', () => {
      const result = $text.createFeedbackHTML('Show Feedback', '<p>Feedback content</p>');
      expect(result).toContain('Show Feedback');
      expect(result).toContain('Feedback content');
      expect(result).toContain('feedbacktooglebutton');
    });
  });
});

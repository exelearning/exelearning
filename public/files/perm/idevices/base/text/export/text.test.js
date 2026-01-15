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
  });

  describe('getHTMLView', () => {
    it('is a function', () => {
      expect(typeof $text.getHTMLView).toBe('function');
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

  describe('getHTMLView with mermaid content', () => {
    beforeEach(() => {
      // Mock eXe.app.isInExe for getHTMLView
      global.eXe = { app: { isInExe: () => false } };
    });

    afterEach(() => {
      delete global.eXe;
    });

    it('preserves pre.mermaid elements with original code', () => {
      const data = {
        textTextarea: '<p>Some text</p><pre class="mermaid">graph TD\n    A[Start] --> B{Is it?}\n    B -->|Yes| C[Great!]</pre><p>More text</p>',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textFeedbackInput: '',
        textFeedbackTextarea: '',
      };

      const result = $text.getHTMLView(data);

      // The pre.mermaid element should be preserved
      expect(result).toContain('<pre class="mermaid">');
      expect(result).toContain('graph TD');
      expect(result).toContain('A[Start]');
    });

    it('preserves pre.mermaid with runtime-rendered SVG', () => {
      // Simulate what TinyMCE saves after mermaid.run() - SVG inside pre
      const data = {
        textTextarea: '<p>Text</p><pre class="mermaid" data-processed="true"><svg id="mermaid-123" viewBox="0 0 100 100"><g><rect></rect><text>Start</text></g></svg></pre>',
        textInfoDurationInput: '',
        textInfoParticipantsInput: '',
        textFeedbackInput: '',
        textFeedbackTextarea: '',
      };

      const result = $text.getHTMLView(data);

      // The pre.mermaid element should be preserved (even with SVG inside)
      expect(result).toContain('<pre class="mermaid"');
      expect(result).toContain('data-processed="true"');
    });
  });
});

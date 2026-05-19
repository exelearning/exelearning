/**
 * Unit tests for markdown-text iDevice (export/runtime)
 *
 * Tests configuration and basic functions.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $markdowntext globally.
 */
function loadExportIdevice(code) {
  // Mock $exe_i18n which is used at load time
  global.$exe_i18n = {
    showFeedback: 'Show feedback',
  };
  const modifiedCode = code.replace(/var\s+\$markdowntext\s*=/, 'global.$markdowntext =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$markdowntext;
}

describe('markdown-text iDevice export', () => {
  let $markdowntext;

  beforeEach(() => {
    global.$markdowntext = undefined;
    global.$exe_i18n = undefined;

    // Mock eXe.app.isInExe for getHTMLView tests
    if (!global.eXe) {
      global.eXe = { app: {} };
    }
    global.eXe.app.isInExe = vi.fn(() => true);

    // Mock c_ translation function
    global.c_ = vi.fn((str) => str);

    const filePath = join(__dirname, 'markdown-text.js');
    const code = readFileSync(filePath, 'utf-8');

    $markdowntext = loadExportIdevice(code);
  });

  describe('ideviceClass', () => {
    it('has expected class name', () => {
      expect($markdowntext.ideviceClass).toBe('markdownTextIdeviceContent');
    });
  });

  describe('working', () => {
    it('is initially false', () => {
      expect($markdowntext.working).toBe(false);
    });
  });

  describe('id constants', () => {
    it('has durationId', () => {
      expect($markdowntext.durationId).toBe('markdownInfoDurationInput');
    });

    it('has durationTextId', () => {
      expect($markdowntext.durationTextId).toBe('markdownInfoDurationTextInput');
    });

    it('has participantsId', () => {
      expect($markdowntext.participantsId).toBe('markdownInfoParticipantsInput');
    });

    it('has participantsTextId', () => {
      expect($markdowntext.participantsTextId).toBe('markdownInfoParticipantsTextInput');
    });

    it('has mainContentId', () => {
      expect($markdowntext.mainContentId).toBe('markdownTextarea');
    });

    it('has mainContentHtmlId', () => {
      expect($markdowntext.mainContentHtmlId).toBe('markdownTextareaHtml');
    });

    it('has feedbackTitleId', () => {
      expect($markdowntext.feedbackTitleId).toBe('markdownFeedbackInput');
    });

    it('has feedbackContentId', () => {
      expect($markdowntext.feedbackContentId).toBe('markdownFeedbackTextarea');
    });

    it('has feedbackContentHtmlId', () => {
      expect($markdowntext.feedbackContentHtmlId).toBe('markdownFeedbackTextareaHtml');
    });

    it('has defaultBtnFeedbackText from i18n', () => {
      expect($markdowntext.defaultBtnFeedbackText).toBe('Show feedback');
    });
  });

  describe('renderView', () => {
    it('replaces {content} in template', () => {
      const data = {
        markdownTextareaHtml: '<p>Test</p>',
      };
      const template = '<div class="wrapper">{content}</div>';

      const result = $markdowntext.renderView(data, false, template, 'idevice-1', null);

      expect(result).toContain('markdownTextIdeviceContent');
      expect(result).toContain('Test');
      expect(result).not.toContain('{content}');
    });
  });

  describe('getHTMLView', () => {
    it('returns HTML with ideviceClass', () => {
      const data = {
        markdownTextareaHtml: '<p>Content</p>',
      };

      const result = $markdowntext.getHTMLView(data, null);

      expect(result).toContain($markdowntext.ideviceClass);
    });

    it('includes main content', () => {
      const data = {
        markdownTextareaHtml: '<p>Main content here</p>',
      };

      const result = $markdowntext.getHTMLView(data, null);

      expect(result).toContain('Main content here');
    });

    it('includes feedback when provided', () => {
      const data = {
        markdownTextareaHtml: '<p>Content</p>',
        markdownFeedbackTextareaHtml: '<p>Feedback content</p>',
      };

      const result = $markdowntext.getHTMLView(data, null);

      expect(result).toContain('Feedback content');
      expect(result).toContain('feedbacktooglebutton');
    });

    it('uses default feedback button text when not provided', () => {
      const data = {
        markdownTextareaHtml: '<p>Content</p>',
        markdownFeedbackTextareaHtml: '<p>Feedback</p>',
      };

      const result = $markdowntext.getHTMLView(data, null);

      expect(result).toContain('Show feedback');
    });

    it('uses custom feedback button text when provided', () => {
      const data = {
        markdownTextareaHtml: '<p>Content</p>',
        markdownFeedbackTextareaHtml: '<p>Feedback</p>',
        markdownFeedbackInput: 'Custom Button',
      };

      const result = $markdowntext.getHTMLView(data, null);

      expect(result).toContain('Custom Button');
    });

    it('includes info section when duration is provided', () => {
      const data = {
        markdownTextareaHtml: '<p>Content</p>',
        markdownInfoDurationInput: '10 min',
        markdownInfoDurationTextInput: 'Duration',
      };

      const result = $markdowntext.getHTMLView(data, null);

      expect(result).toContain('10 min');
      expect(result).toContain('Duration');
    });

    it('includes info section when participants is provided', () => {
      const data = {
        markdownTextareaHtml: '<p>Content</p>',
        markdownInfoParticipantsInput: '2-4',
        markdownInfoParticipantsTextInput: 'Participants',
      };

      const result = $markdowntext.getHTMLView(data, null);

      expect(result).toContain('2-4');
      expect(result).toContain('Participants');
    });

    it('does not mutate the input data object', () => {
      const data = {
        markdownTextarea: '# raw',
        markdownTextareaHtml: '<h1>raw</h1>',
        markdownFeedbackTextarea: '> note',
        markdownFeedbackTextareaHtml: '<blockquote>note</blockquote>',
        markdownFeedbackInput: 'Show',
        markdownInfoDurationInput: '10',
        markdownInfoDurationTextInput: 'Duration',
        markdownInfoParticipantsInput: '2',
        markdownInfoParticipantsTextInput: 'People',
      };
      const snapshot = JSON.parse(JSON.stringify(data));

      $markdowntext.getHTMLView(data, null);

      expect(data).toEqual(snapshot);
    });
  });

  describe('init', () => {
    it('does not throw when called', () => {
      expect(() => $markdowntext.init({}, false)).not.toThrow();
    });
  });

  describe('extractMarkdownHtml', () => {
    it('returns pre-computed HTML when available', () => {
      const data = {
        markdownTextarea: '# Raw markdown',
        markdownTextareaHtml: '<h1>Pre-computed</h1>',
      };

      const result = $markdowntext.extractMarkdownHtml(data, 'markdownTextarea', 'markdownTextareaHtml');

      expect(result).toBe('<h1>Pre-computed</h1>');
    });

    it('falls back to escaped raw content when HTML is empty', () => {
      const data = {
        markdownTextarea: '# Raw markdown',
        markdownTextareaHtml: '',
      };

      const result = $markdowntext.extractMarkdownHtml(data, 'markdownTextarea', 'markdownTextareaHtml');

      expect(result).toBe('# Raw markdown');
    });

    it('falls back to escaped raw content when HTML is missing', () => {
      const data = {
        markdownTextarea: '<script>alert("xss")</script>',
      };

      const result = $markdowntext.extractMarkdownHtml(data, 'markdownTextarea', 'markdownTextareaHtml');

      expect(result).toContain('&lt;script&gt;');
    });

    it('falls back to escaped raw content when HTML is whitespace only', () => {
      const data = {
        markdownTextarea: '# Content',
        markdownTextareaHtml: '   ',
      };

      const result = $markdowntext.extractMarkdownHtml(data, 'markdownTextarea', 'markdownTextareaHtml');

      expect(result).toBe('# Content');
    });

    it('returns empty string when both raw and HTML are missing', () => {
      const data = {};

      const result = $markdowntext.extractMarkdownHtml(data, 'markdownTextarea', 'markdownTextareaHtml');

      expect(result).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($markdowntext.escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect($markdowntext.escapeHtml('1 < 2')).toBe('1 &lt; 2');
    });

    it('escapes greater than', () => {
      expect($markdowntext.escapeHtml('2 > 1')).toBe('2 &gt; 1');
    });

    it('escapes double quotes', () => {
      expect($markdowntext.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($markdowntext.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple special characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect($markdowntext.escapeHtml(input)).toBe(expected);
    });

    it('handles empty string', () => {
      expect($markdowntext.escapeHtml('')).toBe('');
    });

    it('handles null/undefined by converting to string', () => {
      expect($markdowntext.escapeHtml(null)).toBe('null');
      expect($markdowntext.escapeHtml(undefined)).toBe('undefined');
    });
  });

  describe('createMainContent', () => {
    it('wraps content in exe-markdown-activity div', () => {
      const result = $markdowntext.createMainContent('<p>Test</p>');

      expect(result).toContain('exe-markdown-activity');
    });

    it('wraps content in markdown-body div', () => {
      const result = $markdowntext.createMainContent('<p>Test</p>');

      expect(result).toContain('markdown-body');
    });

    it('includes the content', () => {
      const result = $markdowntext.createMainContent('<p>My content</p>');

      expect(result).toContain('My content');
    });
  });

  describe('createInfoHTML', () => {
    it('creates dl element with duration and participants', () => {
      const result = $markdowntext.createInfoHTML('Duration', '10 min', 'Participants', '2-4');

      expect(result).toContain('<dl>');
      expect(result).toContain('Duration');
      expect(result).toContain('10 min');
      expect(result).toContain('Participants');
      expect(result).toContain('2-4');
      expect(result).toContain('title="Duration"');
      expect(result).toContain('title="Participants"');
    });

    it('escapes quotes in label so attribute is not broken', () => {
      const result = $markdowntext.createInfoHTML('Say "hi"', '10 min', 'P', '2');

      expect(result).not.toContain('title="Say "hi""');
      expect(result).toContain('title="Say &quot;hi&quot;"');
    });

    it('escapes HTML in duration value so chrome cannot leak', () => {
      const result = $markdowntext.createInfoHTML('Duration', '<img src=x onerror=alert(1)>', 'P', '2');

      expect(result).not.toContain('<img src=x');
      expect(result).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
  });

  describe('createFeedbackHTML', () => {
    it('returns HTML with toggle button and hidden feedback panel', () => {
      const result = $markdowntext.createFeedbackHTML('Show Feedback', '<p>Feedback content</p>');

      expect(result).toContain('feedbacktooglebutton');
      expect(result).toContain('value="Show Feedback"');
      expect(result).toContain('Feedback content');
      expect(result).toContain('class="feedback js-feedback js-hidden"');
      expect(result).toContain('js-required');
    });

    it('escapes quotes in title so value attribute is not broken', () => {
      const result = $markdowntext.createFeedbackHTML('Click "me"', '<p>Feedback</p>');

      expect(result).not.toContain('value="Click "me""');
      expect(result).toContain('value="Click &quot;me&quot;"');
    });

    it('escapes HTML in title but preserves rendered feedback HTML', () => {
      const result = $markdowntext.createFeedbackHTML('<script>x</script>', '<p>Body</p>');

      expect(result).toContain('value="&lt;script&gt;x&lt;/script&gt;"');
      expect(result).toContain('<p>Body</p>');
    });
  });

  describe('replaceResourceDirectoryPaths', () => {
    it('replaces files/ paths in img src', () => {
      const html = '<img src="files/image.png" alt="test">';
      const result = $markdowntext.replaceResourceDirectoryPaths('resources/', html);

      expect(result).toContain('src="resources/image.png"');
    });

    it('replaces files/ paths in video src', () => {
      const html = '<video src="files/video.mp4"></video>';
      const result = $markdowntext.replaceResourceDirectoryPaths('media/', html);

      expect(result).toContain('src="media/video.mp4"');
    });

    it('replaces files/ paths in audio src', () => {
      const html = '<audio src="files/audio.mp3"></audio>';
      const result = $markdowntext.replaceResourceDirectoryPaths('sounds/', html);

      expect(result).toContain('src="sounds/audio.mp3"');
    });

    it('replaces files/ paths in a href', () => {
      const html = '<a href="files/document.pdf">Download</a>';
      const result = $markdowntext.replaceResourceDirectoryPaths('docs/', html);

      expect(result).toContain('href="docs/document.pdf"');
    });

    it('adds trailing slash to directory if missing', () => {
      const html = '<img src="files/image.png">';
      const result = $markdowntext.replaceResourceDirectoryPaths('resources', html);

      expect(result).toContain('src="resources/image.png"');
    });

    it('does not modify non-files paths', () => {
      const html = '<img src="https://example.com/image.png">';
      const result = $markdowntext.replaceResourceDirectoryPaths('resources/', html);

      expect(result).toContain('src="https://example.com/image.png"');
    });

    it('handles empty HTML string', () => {
      const result = $markdowntext.replaceResourceDirectoryPaths('resources/', '');

      expect(result).toBe('');
    });

    it('preserves other HTML content', () => {
      const html = '<p>Text content</p><img src="files/image.png"><span>More text</span>';
      const result = $markdowntext.replaceResourceDirectoryPaths('resources/', html);

      expect(result).toContain('Text content');
      expect(result).toContain('More text');
    });
  });
});

/**
 * Unit tests for markdown-text iDevice (edition)
 *
 * Tests with real jQuery DOM manipulation:
 * - init: Form creation and DOM structure
 * - loadPreviousValues: Loading saved data into form
 * - checkFormValues: Validation with eXe.app.alert history
 * - save: Full save cycle with markdown editors
 * - getDataJson: Data structure generation
 * - computeMarkdownHtml: Markdown to HTML conversion
 * - escapeHtml: HTML escaping
 * - HTML generation functions
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$exeDevice;
}

describe('markdown-text iDevice', () => {
  let $exeDevice;
  let mockElement;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Clear eXe.app history
    eXe.app.clearHistory();

    // Create mock element for the iDevice (simulates the DOM container)
    mockElement = document.createElement('div');
    mockElement.setAttribute('idevice-id', 'test-idevice-123');
    document.body.appendChild(mockElement);

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'markdown-text.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  afterEach(() => {
    // DOM cleanup is handled by vitest.setup.js afterEach
    mockElement = null;
  });

  describe('i18n and configuration', () => {
    it('has name defined', () => {
      expect($exeDevice.name).toBeDefined();
    });

    it('has textarea ID defined', () => {
      expect($exeDevice.textareaId).toBe('markdownTextarea');
    });

    it('has feedback ID defined', () => {
      expect($exeDevice.feedbackId).toBe('markdownFeedback');
    });

    it('has default feedback button value', () => {
      expect($exeDevice.feedbackInputValue).toBeDefined();
    });

    it('has prefix defined', () => {
      expect($exeDevice.prefix).toBe('markdown');
    });

    it('has htmlSuffix defined', () => {
      expect($exeDevice.htmlSuffix).toBe('Html');
    });

    it('has write and preview tab labels', () => {
      expect($exeDevice.writeTabLabel).toBeDefined();
      expect($exeDevice.previewTabLabel).toBeDefined();
    });
  });

  describe('init', () => {
    it('creates the form structure in ideviceBody', () => {
      $exeDevice.init(mockElement, {});

      // Verify form was created
      const form = mockElement.querySelector('#markdownTextForm');
      expect(form).toBeTruthy();
    });

    it('creates the main textarea element', () => {
      $exeDevice.init(mockElement, {});

      const textarea = mockElement.querySelector('#markdownTextarea');
      expect(textarea).toBeTruthy();
      expect(textarea.classList.contains('exe-markdown-editor__textarea')).toBe(true);
    });

    it('creates markdown editor container', () => {
      $exeDevice.init(mockElement, {});

      const editor = mockElement.querySelector('.exe-markdown-editor');
      expect(editor).toBeTruthy();
    });

    it('creates write and preview tabs', () => {
      $exeDevice.init(mockElement, {});

      const writeTab = mockElement.querySelector('[data-tab="write"]');
      const previewTab = mockElement.querySelector('[data-tab="preview"]');
      expect(writeTab).toBeTruthy();
      expect(previewTab).toBeTruthy();
    });

    it('creates preview pane', () => {
      $exeDevice.init(mockElement, {});

      const preview = mockElement.querySelector('.exe-markdown-preview');
      expect(preview).toBeTruthy();
    });

    it('creates feedback fieldset', () => {
      $exeDevice.init(mockElement, {});

      const feedbackFieldset = mockElement.querySelector('#markdownFeedback');
      expect(feedbackFieldset).toBeTruthy();
    });

    it('creates info fieldset', () => {
      $exeDevice.init(mockElement, {});

      const infoFieldset = mockElement.querySelector('#markdownInfo');
      expect(infoFieldset).toBeTruthy();
    });

    it('creates feedback input field', () => {
      $exeDevice.init(mockElement, {});

      const feedbackInput = mockElement.querySelector('#markdownFeedbackInput');
      expect(feedbackInput).toBeTruthy();
      expect(feedbackInput.type).toBe('text');
    });

    it('creates duration input fields', () => {
      $exeDevice.init(mockElement, {});

      const durationInput = mockElement.querySelector('#markdownInfoDurationInput');
      const durationTextInput = mockElement.querySelector('#markdownInfoDurationTextInput');

      expect(durationInput).toBeTruthy();
      expect(durationTextInput).toBeTruthy();
    });

    it('creates participants input fields', () => {
      $exeDevice.init(mockElement, {});

      const participantsInput = mockElement.querySelector('#markdownInfoParticipantsInput');
      const participantsTextInput = mockElement.querySelector('#markdownInfoParticipantsTextInput');

      expect(participantsInput).toBeTruthy();
      expect(participantsTextInput).toBeTruthy();
    });

    it('sets ideviceBody reference', () => {
      $exeDevice.init(mockElement, {});

      expect($exeDevice.ideviceBody).toBe(mockElement);
    });

    it('stores previousData reference', () => {
      const previousData = { test: 'data' };
      $exeDevice.init(mockElement, previousData);

      expect($exeDevice.idevicePreviousData).toBe(previousData);
    });

    it('initializes markdownEditors map', () => {
      $exeDevice.init(mockElement, {});

      expect($exeDevice.markdownEditors).toBeInstanceOf(Map);
      expect($exeDevice.markdownEditors.size).toBeGreaterThan(0);
    });
  });

  describe('loadPreviousValues', () => {
    it('loads previous textarea content into textarea value', () => {
      const previousData = {
        markdownTextarea: '# Hello World',
      };

      $exeDevice.init(mockElement, previousData);

      const textarea = mockElement.querySelector('#markdownTextarea');
      expect(textarea.value).toBe('# Hello World');
    });

    it('loads previous feedback input value', () => {
      const previousData = {
        markdownFeedbackInput: 'Custom Feedback Button',
      };

      $exeDevice.init(mockElement, previousData);

      const feedbackInput = mockElement.querySelector('#markdownFeedbackInput');
      expect(feedbackInput.value).toBe('Custom Feedback Button');
    });

    it('loads duration values', () => {
      const previousData = {
        markdownInfoDurationInput: '00:30',
        markdownInfoDurationTextInput: 'Time:',
      };

      $exeDevice.init(mockElement, previousData);

      const durationInput = mockElement.querySelector('#markdownInfoDurationInput');
      const durationTextInput = mockElement.querySelector('#markdownInfoDurationTextInput');

      expect(durationInput.value).toBe('00:30');
      expect(durationTextInput.value).toBe('Time:');
    });

    it('handles missing previousData gracefully', () => {
      $exeDevice.init(mockElement, undefined);

      // Should not throw
      const form = mockElement.querySelector('#markdownTextForm');
      expect(form).toBeTruthy();
    });

    it('uses default values when previousData has empty fields', () => {
      const previousData = {
        markdownInfoDurationTextInput: '', // Empty should use default
      };

      $exeDevice.init(mockElement, previousData);

      const durationTextInput = mockElement.querySelector('#markdownInfoDurationTextInput');
      // Should use default value
      expect(durationTextInput.value).toBe('Duration');
    });
  });

  describe('checkFormValues', () => {
    it('returns false and shows alert when textarea is empty string', () => {
      $exeDevice.init(mockElement, {});
      // Set empty content
      $exeDevice.markdownTextarea = '';

      const result = $exeDevice.checkFormValues();

      expect(result).toBe(false);
      expect(eXe.app.alert).toHaveBeenCalled();
      expect(eXe.app.getLastAlert()).toContain('write some text');
    });

    it('returns true when textarea has content', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.markdownTextarea = '# Some content';

      const result = $exeDevice.checkFormValues();

      expect(result).toBe(true);
    });

    it('returns false when textarea is only whitespace', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.markdownTextarea = '   ';

      const result = $exeDevice.checkFormValues();

      expect(result).toBe(false);
    });

    it('tracks multiple validation failures in alert history', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.markdownTextarea = '';

      $exeDevice.checkFormValues();
      $exeDevice.checkFormValues();

      expect(eXe.app._alertHistory.length).toBe(2);
    });
  });

  describe('save', () => {
    it('returns data object when form is valid', () => {
      $exeDevice.init(mockElement, {});

      // Set content in textarea
      const textarea = mockElement.querySelector('#markdownTextarea');
      textarea.value = '# Test content';

      const result = $exeDevice.save();

      expect(result).toBeDefined();
      expect(result).not.toBe(false);
      expect(result.ideviceId).toBe('test-idevice-123');
    });

    it('returns false when form is invalid', () => {
      $exeDevice.init(mockElement, {});

      // Empty content
      const textarea = mockElement.querySelector('#markdownTextarea');
      textarea.value = '';

      const result = $exeDevice.save();

      expect(result).toBe(false);
    });

    it('collects textarea content', () => {
      $exeDevice.init(mockElement, {});

      const textarea = mockElement.querySelector('#markdownTextarea');
      textarea.value = '# Markdown content';

      const result = $exeDevice.save();

      expect($exeDevice.dataIds).toContain('markdownTextarea');
      expect($exeDevice.markdownTextarea).toBe('# Markdown content');
    });

    it('saves computed HTML for markdown content', () => {
      $exeDevice.init(mockElement, {});

      const textarea = mockElement.querySelector('#markdownTextarea');
      textarea.value = '# Header';

      const result = $exeDevice.save();

      // Should have HTML version saved
      expect(result.markdownTextareaHtml).toBeDefined();
    });

    it('collects input values from DOM', () => {
      const previousData = {
        markdownFeedbackInput: 'Custom Button',
      };
      $exeDevice.init(mockElement, previousData);

      const textarea = mockElement.querySelector('#markdownTextarea');
      textarea.value = '# Content';

      const result = $exeDevice.save();

      expect($exeDevice.dataIds).toContain('markdownFeedbackInput');
      expect($exeDevice.markdownFeedbackInput).toBe('Custom Button');
    });
  });

  describe('getDataJson', () => {
    it('returns object with ideviceId', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.dataIds = ['markdownTextarea'];
      $exeDevice.markdownTextarea = '# Content';

      const result = $exeDevice.getDataJson();

      expect(result.ideviceId).toBe('test-idevice-123');
    });

    it('includes all dataIds in result', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.dataIds = ['markdownTextarea', 'markdownFeedbackInput'];
      $exeDevice.markdownTextarea = '# Content';
      $exeDevice.markdownFeedbackInput = 'Button';

      const result = $exeDevice.getDataJson();

      expect(result.markdownTextarea).toBe('# Content');
      expect(result.markdownFeedbackInput).toBe('Button');
    });

    it('includes computed HTML from markdown editors', () => {
      $exeDevice.init(mockElement, {});

      const textarea = mockElement.querySelector('#markdownTextarea');
      textarea.value = '**bold**';

      const result = $exeDevice.getDataJson();

      expect(result.markdownTextareaHtml).toBeDefined();
    });
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('1 < 2')).toBe('1 &lt; 2');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('2 > 1')).toBe('2 &gt; 1');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple special characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect($exeDevice.escapeHtml(input)).toBe(expected);
    });

    it('handles empty string', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });

    it('handles null/undefined by converting to string', () => {
      expect($exeDevice.escapeHtml(null)).toBe('null');
      expect($exeDevice.escapeHtml(undefined)).toBe('undefined');
    });
  });

  describe('getMarkdownConverter', () => {
    it('returns null when showdown is not available', () => {
      const originalShowdown = global.showdown;
      global.showdown = undefined;

      const result = $exeDevice.getMarkdownConverter();

      expect(result).toBeNull();

      global.showdown = originalShowdown;
    });

    it('returns converter when showdown is available', () => {
      // Mock showdown
      global.showdown = {
        Converter: class {
          setOption() {}
          makeHtml(text) {
            return `<p>${text}</p>`;
          }
        },
      };

      const result = $exeDevice.getMarkdownConverter();

      expect(result).not.toBeNull();
      expect(typeof result.makeHtml).toBe('function');

      delete global.showdown;
    });

    it('caches the converter instance', () => {
      global.showdown = {
        Converter: class {
          setOption() {}
          makeHtml(text) {
            return `<p>${text}</p>`;
          }
        },
      };

      const first = $exeDevice.getMarkdownConverter();
      const second = $exeDevice.getMarkdownConverter();

      expect(first).toBe(second);

      delete global.showdown;
    });
  });

  describe('computeMarkdownHtml', () => {
    it('uses eXe.app.common.markdownToHTML when available', () => {
      const mockResult = '<p>Converted</p>';
      eXe.app.common = {
        markdownToHTML: vi.fn().mockReturnValue(mockResult),
      };

      const result = $exeDevice.computeMarkdownHtml('# Test');

      expect(eXe.app.common.markdownToHTML).toHaveBeenCalledWith('# Test');
      expect(result).toBe(mockResult);

      delete eXe.app.common;
    });

    it('falls back to showdown converter', () => {
      delete eXe.app.common;

      global.showdown = {
        Converter: class {
          setOption() {}
          makeHtml(text) {
            return `<p>${text}</p>`;
          }
        },
      };

      const result = $exeDevice.computeMarkdownHtml('Hello');

      expect(result).toBe('<p>Hello</p>');

      delete global.showdown;
    });

    it('protects LaTeX delimiters from Showdown in fallback path', () => {
      delete eXe.app.common;

      global.showdown = {
        Converter: class {
          setOption() {}
          makeHtml(text) {
            // Pretend Showdown mangles underscores into <em>
            return `<p>${text.replace(/_([^_]+)_/g, '<em>$1</em>')}</p>`;
          }
        },
      };

      const result = $exeDevice.computeMarkdownHtml(
        'Result: \\(x_1 + y_1\\) end'
      );

      expect(result).toContain('\\(x_1 + y_1\\)');
      expect(result).not.toContain('<em>1 + y</em>');

      delete global.showdown;
    });

    it('falls back to escapeHtml when no converter available', () => {
      delete eXe.app.common;
      global.showdown = undefined;

      const result = $exeDevice.computeMarkdownHtml('<script>');

      expect(result).toBe('&lt;script&gt;');
    });

    it('handles empty content', () => {
      const result = $exeDevice.computeMarkdownHtml('');

      expect(result).toBeDefined();
    });

    it('handles null content', () => {
      delete eXe.app.common;
      global.showdown = undefined;

      const result = $exeDevice.computeMarkdownHtml(null);

      expect(result).toBe('');
    });
  });

  describe('createMarkdownEditorHTML', () => {
    it('creates container with correct id', () => {
      const html = $exeDevice.createMarkdownEditorHTML('myId', 'My Title');

      expect(html).toContain('id="myId"');
    });

    it('creates container with exe-markdown-editor class', () => {
      const html = $exeDevice.createMarkdownEditorHTML('myId', 'My Title');

      expect(html).toContain('exe-markdown-editor');
    });

    it('creates textarea with exe-markdown-editor__textarea class', () => {
      const html = $exeDevice.createMarkdownEditorHTML('myId', 'My Title');

      expect(html).toContain('exe-markdown-editor__textarea');
    });

    it('includes title in label', () => {
      const html = $exeDevice.createMarkdownEditorHTML('myId', 'My Title');

      expect(html).toContain('My Title');
      expect(html).toContain('<label');
    });

    it('creates write and preview tabs', () => {
      const html = $exeDevice.createMarkdownEditorHTML('myId', 'My Title');

      expect(html).toContain('data-tab="write"');
      expect(html).toContain('data-tab="preview"');
    });

    it('creates preview pane', () => {
      const html = $exeDevice.createMarkdownEditorHTML('myId', 'My Title');

      expect(html).toContain('exe-markdown-preview');
    });

    it('handles missing title', () => {
      const html = $exeDevice.createMarkdownEditorHTML('myId');

      expect(html).toContain('id="myId"');
      expect(html).toContain('<textarea');
    });
  });

  describe('createInputHTML', () => {
    it('creates input with correct id', () => {
      const html = $exeDevice.createInputHTML('inputId', 'Input Title');

      expect(html).toContain('id="inputId"');
      expect(html).toContain('name="inputId"');
    });

    it('creates input with title in label', () => {
      const html = $exeDevice.createInputHTML('inputId', 'Input Title');

      expect(html).toContain('Input Title');
      expect(html).toContain('<label');
    });

    it('includes instructions span when provided', () => {
      const html = $exeDevice.createInputHTML('inputId', 'Title', 'Help text');

      expect(html).toContain('exe-field-instructions');
      expect(html).toContain('Help text');
    });

    it('sets value attribute', () => {
      const html = $exeDevice.createInputHTML('inputId', 'Title', '', 'default value');

      expect(html).toContain('value="default value"');
    });

    it('sets placeholder attribute', () => {
      const html = $exeDevice.createInputHTML('inputId', 'Title', '', '', 'Placeholder');

      expect(html).toContain('placeholder="Placeholder"');
    });

    it('creates text type input', () => {
      const html = $exeDevice.createInputHTML('inputId', 'Title');

      expect(html).toContain('type="text"');
    });
  });

  describe('createFieldsetHTML', () => {
    it('creates fieldset with correct id', () => {
      const html = $exeDevice.createFieldsetHTML('fsId', 'Fieldset Title', '', '<p>Content</p>');

      expect(html).toContain('id="fsId"');
    });

    it('creates fieldset with title in legend', () => {
      const html = $exeDevice.createFieldsetHTML('fsId', 'Fieldset Title', '', '<p>Content</p>');

      expect(html).toContain('Fieldset Title');
      expect(html).toContain('<legend');
    });

    it('includes content inside fieldset', () => {
      const html = $exeDevice.createFieldsetHTML('fsId', 'Title', '', '<p>Inner content</p>');

      expect(html).toContain('<p>Inner content</p>');
    });

    it('adds exe-fieldset-closed class by default', () => {
      const html = $exeDevice.createFieldsetHTML('fsId', 'Title', '', 'Content');

      expect(html).toContain('exe-fieldset-closed');
    });

    it('appends affix to title', () => {
      const html = $exeDevice.createFieldsetHTML('fsId', 'Title', ' (Optional)', 'Content');

      expect(html).toContain('Title (Optional)');
    });
  });

  describe('createInformationFieldsetHTML', () => {
    it('creates fieldset with grid-container', () => {
      const html = $exeDevice.createInformationFieldsetHTML('infoId', 'Info Title', '', '<p>Content</p>');

      expect(html).toContain('grid-container');
    });

    it('creates fieldset with correct id', () => {
      const html = $exeDevice.createInformationFieldsetHTML('infoId', 'Info Title', '', 'Content');

      expect(html).toContain('id="infoId"');
    });

    it('creates fieldset with exe-advanced class', () => {
      const html = $exeDevice.createInformationFieldsetHTML('infoId', 'Info Title', '', 'Content');

      expect(html).toContain('exe-advanced');
    });
  });

  describe('createEditorGroup', () => {
    it('returns HTML with editor group parent', () => {
      const html = $exeDevice.createEditorGroup();

      expect(html).toContain($exeDevice.editorGroupId);
      expect(html).toContain('exe-parent');
    });

    it('includes info fieldset', () => {
      const html = $exeDevice.createEditorGroup();

      expect(html).toContain($exeDevice.infoId);
    });

    it('includes feedback fieldset', () => {
      const html = $exeDevice.createEditorGroup();

      expect(html).toContain($exeDevice.feedbackId);
    });

    it('includes main textarea', () => {
      const html = $exeDevice.createEditorGroup();

      expect(html).toContain($exeDevice.textareaId);
    });
  });

  describe('DOM integration with jQuery', () => {
    it('jQuery can find elements after init', () => {
      $exeDevice.init(mockElement, {});

      const $form = $('#markdownTextForm');
      expect($form.length).toBe(1);
    });

    it('jQuery can manipulate textarea value', () => {
      $exeDevice.init(mockElement, {});

      const $textarea = $('#markdownTextarea');
      $textarea.val('# jQuery set value');

      expect($textarea.val()).toBe('# jQuery set value');
    });

    it('jQuery can add/remove classes', () => {
      $exeDevice.init(mockElement, {});

      const $fieldset = $('#markdownFeedback');
      $fieldset.removeClass('exe-fieldset-closed');
      $fieldset.addClass('exe-fieldset-open');

      expect($fieldset.hasClass('exe-fieldset-open')).toBe(true);
      expect($fieldset.hasClass('exe-fieldset-closed')).toBe(false);
    });

    it('jQuery find works within container', () => {
      $exeDevice.init(mockElement, {});

      const $inputs = $(mockElement).find('input[type="text"]');
      expect($inputs.length).toBeGreaterThan(0);
    });
  });

  describe('Tab behavior', () => {
    it('write tab is active by default', () => {
      $exeDevice.init(mockElement, {});

      const writeTab = mockElement.querySelector('[data-tab="write"]');
      expect(writeTab.classList.contains('is-active')).toBe(true);
      expect(writeTab.getAttribute('aria-selected')).toBe('true');
    });

    it('textarea is visible by default', () => {
      $exeDevice.init(mockElement, {});

      const textarea = mockElement.querySelector('#markdownTextarea');
      expect(textarea.hidden).toBe(false);
    });

    it('preview is hidden by default', () => {
      $exeDevice.init(mockElement, {});

      const preview = mockElement.querySelector('.exe-markdown-preview');
      expect(preview.hidden).toBe(true);
    });

    it('clicking preview tab switches visibility', () => {
      $exeDevice.init(mockElement, {});

      const previewTab = mockElement.querySelector('[data-tab="preview"]');
      previewTab.click();

      const textarea = mockElement.querySelector('#markdownTextarea');
      const preview = mockElement.querySelector('.exe-markdown-preview');
      expect(textarea.hidden).toBe(true);
      expect(preview.hidden).toBe(false);
    });

    it('clicking write tab switches back', () => {
      $exeDevice.init(mockElement, {});

      const previewTab = mockElement.querySelector('[data-tab="preview"]');
      const writeTab = mockElement.querySelector('[data-tab="write"]');

      previewTab.click();
      writeTab.click();

      const textarea = mockElement.querySelector('#markdownTextarea');
      expect(textarea.hidden).toBe(false);
    });
  });

  describe('refreshMarkdownPreviews', () => {
    it('does not throw when markdownEditors is null', () => {
      $exeDevice.markdownEditors = null;

      expect(() => $exeDevice.refreshMarkdownPreviews()).not.toThrow();
    });

    it('updates preview content when called', () => {
      $exeDevice.init(mockElement, {});

      const textarea = mockElement.querySelector('#markdownTextarea');
      textarea.value = '# New content';

      $exeDevice.refreshMarkdownPreviews();

      const preview = mockElement.querySelector('.exe-markdown-preview');
      expect(preview.innerHTML).not.toBe('');
    });
  });
});

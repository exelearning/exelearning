/**
 * Unit tests for text iDevice
 *
 * Tests with real jQuery DOM manipulation and improved TinyMCE mock:
 * - init: Form creation and DOM structure
 * - loadPreviousValues: Loading saved data into form
 * - checkFormValues: Validation with eXe.app.alert history
 * - save: Full save cycle with TinyMCE
 * - getDataJson: Data structure generation
 * - HTML generation functions
 */

/* eslint-disable no-undef */
// Import setup for DOM mocks (happy-dom), jQuery, TinyMCE, eXe globals
import '../../../../../../../public/vitest.setup.js';

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

describe('text iDevice', () => {
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
    const filePath = join(__dirname, 'text.js');
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
      expect($exeDevice.textareaId).toBe('textTextarea');
    });

    it('has feedback ID defined', () => {
      expect($exeDevice.feedbackId).toBe('textFeedback');
    });

    it('has default feedback button value', () => {
      expect($exeDevice.feedbakInputValue).toBeDefined();
    });
  });

  describe('init', () => {
    it('creates the form structure in ideviceBody', () => {
      $exeDevice.init(mockElement, {});

      // Verify form was created
      const form = mockElement.querySelector('#textForm');
      expect(form).toBeTruthy();
    });

    it('creates the main textarea element', () => {
      $exeDevice.init(mockElement, {});

      const textarea = mockElement.querySelector('#textTextarea');
      expect(textarea).toBeTruthy();
      expect(textarea.classList.contains('exe-html-editor')).toBe(true);
    });

    it('creates feedback fieldset', () => {
      $exeDevice.init(mockElement, {});

      const feedbackFieldset = mockElement.querySelector('#textFeedback');
      expect(feedbackFieldset).toBeTruthy();
    });

    it('creates info fieldset', () => {
      $exeDevice.init(mockElement, {});

      const infoFieldset = mockElement.querySelector('#textInfo');
      expect(infoFieldset).toBeTruthy();
    });

    it('creates feedback input field', () => {
      $exeDevice.init(mockElement, {});

      const feedbackInput = mockElement.querySelector('#textFeedbackInput');
      expect(feedbackInput).toBeTruthy();
      expect(feedbackInput.type).toBe('text');
    });

    it('creates duration input fields', () => {
      $exeDevice.init(mockElement, {});

      const durationInput = mockElement.querySelector('#textInfoDurationInput');
      const durationTextInput = mockElement.querySelector('#textInfoDurationTextInput');

      expect(durationInput).toBeTruthy();
      expect(durationTextInput).toBeTruthy();
    });

    it('creates participants input fields', () => {
      $exeDevice.init(mockElement, {});

      const participantsInput = mockElement.querySelector('#textInfoParticipantsInput');
      const participantsTextInput = mockElement.querySelector('#textInfoParticipantsTextInput');

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
  });

  describe('loadPreviousValues', () => {
    it('loads previous textarea content into textarea value', () => {
      const previousData = {
        textTextarea: '<p>Previous content</p>',
      };

      $exeDevice.init(mockElement, previousData);

      const textarea = mockElement.querySelector('#textTextarea');
      expect(textarea.value).toBe('<p>Previous content</p>');
    });

    it('loads previous feedback input value', () => {
      const previousData = {
        textFeedbackInput: 'Custom Feedback Button',
      };

      $exeDevice.init(mockElement, previousData);

      const feedbackInput = mockElement.querySelector('#textFeedbackInput');
      expect(feedbackInput.value).toBe('Custom Feedback Button');
    });

    it('loads duration values', () => {
      const previousData = {
        textInfoDurationInput: '00:30',
        textInfoDurationTextInput: 'Time:',
      };

      $exeDevice.init(mockElement, previousData);

      const durationInput = mockElement.querySelector('#textInfoDurationInput');
      const durationTextInput = mockElement.querySelector('#textInfoDurationTextInput');

      expect(durationInput.value).toBe('00:30');
      expect(durationTextInput.value).toBe('Time:');
    });

    it('opens feedback fieldset when feedback textarea has content', () => {
      const previousData = {
        textFeedbackTextarea: '<p>Feedback content</p>',
      };

      $exeDevice.init(mockElement, previousData);

      const feedbackFieldset = mockElement.querySelector('#textFeedback');
      expect(feedbackFieldset.classList.contains('exe-fieldset-open')).toBe(true);
      expect(feedbackFieldset.classList.contains('exe-fieldset-closed')).toBe(false);
    });

    it('handles missing previousData gracefully', () => {
      $exeDevice.init(mockElement, undefined);

      // Should not throw
      const form = mockElement.querySelector('#textForm');
      expect(form).toBeTruthy();
    });

    it('uses default values when previousData has empty fields', () => {
      const previousData = {
        textInfoDurationTextInput: '', // Empty should use default
      };

      $exeDevice.init(mockElement, previousData);

      const durationTextInput = mockElement.querySelector('#textInfoDurationTextInput');
      // Should use default value from loadPreviousValues defaults
      // Note: infoDurationTextInputValue is 'Duration' (colon is added only in createEditorGroup HTML)
      expect(durationTextInput.value).toBe('Duration');
    });

    it('removes legacy outer exe-text wrapper from loaded textarea content', () => {
      const previousData = {
        textTextarea: '<div class="exe-text"><p>Legacy content</p></div>',
      };

      $exeDevice.init(mockElement, previousData);

      const textarea = mockElement.querySelector('#textTextarea');
      expect(textarea.value).toBe('<p>Legacy content</p>');
      expect(textarea.value).not.toContain('class="exe-text"');
    });

    it('extracts main content when loaded textarea has exe-text-activity wrapper', () => {
      const previousData = {
        textTextarea: '<div class="exe-text-activity"><p>Activity content</p></div>',
      };

      $exeDevice.init(mockElement, previousData);

      const textarea = mockElement.querySelector('#textTextarea');
      expect(textarea.value).toBe('<p>Activity content</p>');
    });
  });

  describe('checkFormValues', () => {
    it('returns false and shows alert when text is empty string', () => {
      $exeDevice.init(mockElement, {});
      // checkFormValues checks this.text property (which is intentionally undefined
      // to allow saving empty iDevices - matching original behavior)
      $exeDevice.text = '';

      const result = $exeDevice.checkFormValues();

      expect(result).toBe(false);
      expect(eXe.app.alert).toHaveBeenCalled();
      expect(eXe.app.getLastAlert()).toContain('write some text');
    });

    it('returns true when text property has content', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.text = '<p>Some content</p>';

      const result = $exeDevice.checkFormValues();

      expect(result).toBe(true);
    });

    it('tracks multiple validation failures in alert history', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.text = '';

      $exeDevice.checkFormValues();
      $exeDevice.checkFormValues();
 
      expect(eXe.app._alertHistory.length).toBe(2);
    });

    it('returns true when text is not empty', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.text = 'Some text';

      const result = $exeDevice.checkFormValues();

      expect(result).toBe(true);
      expect(eXe.app._alertHistory.length).toBe(0);
    });

    it('returns true when text is undefined (allows empty iDevices)', () => {
      $exeDevice.init(mockElement, {});
      // text property is not defined, so validation passes (original behavior)
      
      const result = $exeDevice.checkFormValues();

      expect(result).toBe(true);
    });
  });

  describe('save', () => {
    it('returns data object when form is valid', async () => {
      $exeDevice.init(mockElement, {});

      const editor = await createTinyMCEEditor('textTextarea', {
        content: '<p>Test content</p>',
      });
      tinymce.editors['textTextarea'] = editor;
      const feedbackEditor = await createTinyMCEEditor('textFeedbackTextarea', { content: '' });
      tinymce.editors['textFeedbackTextarea'] = feedbackEditor;

      // Set the text property that checkFormValues checks
      $exeDevice.text = '<p>Test content</p>';

      const result = $exeDevice.save();

      expect(result).toBeDefined();
      expect(result).not.toBe(false);
      expect(result.ideviceId).toBe('test-idevice-123');
    });

    it('returns false when form is invalid', async () => {
      $exeDevice.init(mockElement, {});

      const editor = await createTinyMCEEditor('textTextarea', { content: '' });
      tinymce.editors['textTextarea'] = editor;
      const feedbackEditor = await createTinyMCEEditor('textFeedbackTextarea', { content: '' });
      tinymce.editors['textFeedbackTextarea'] = feedbackEditor;

      // Empty content
      $exeDevice.text = '';

      const result = $exeDevice.save();

      expect(result).toBe(false);
    });

    it('collects textarea content from TinyMCE editors', async () => {
      $exeDevice.init(mockElement, {});

      const editor = await createTinyMCEEditor('textTextarea', {
        content: '<p>TinyMCE content</p>',
      });
      tinymce.editors['textTextarea'] = editor;
      const feedbackEditor = await createTinyMCEEditor('textFeedbackTextarea', { content: '' });
      tinymce.editors['textFeedbackTextarea'] = feedbackEditor;

      // Set text to make validation pass
      $exeDevice.text = '<p>TinyMCE content</p>';

      const result = $exeDevice.save();

      // dataIds should include textTextarea
      expect($exeDevice.dataIds).toContain('textTextarea');
      expect($exeDevice.textTextarea).toBe('<p>TinyMCE content</p>');
    });

    it('collects input values from DOM', async () => {
      const previousData = {
        textFeedbackInput: 'Custom Button',
      };
      $exeDevice.init(mockElement, previousData);

      const editor = await createTinyMCEEditor('textTextarea', { content: '<p>Content</p>' });
      tinymce.editors['textTextarea'] = editor;
      const feedbackEditor = await createTinyMCEEditor('textFeedbackTextarea', { content: '' });
      tinymce.editors['textFeedbackTextarea'] = feedbackEditor;

      // Set text to make validation pass
      $exeDevice.text = '<p>Content</p>';

      const result = $exeDevice.save();

      expect($exeDevice.dataIds).toContain('textFeedbackInput');
      expect($exeDevice.textFeedbackInput).toBe('Custom Button');
    });

    it('handles undefined ideviceBody gracefully', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.ideviceBody = undefined;

      const result = $exeDevice.save();

      expect(result).toBeUndefined();
    });
  });

  describe('getDataJson', () => {
    it('returns object with ideviceId', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.dataIds = ['textTextarea'];
      $exeDevice.textTextarea = '<p>Content</p>';

      const result = $exeDevice.getDataJson();

      expect(result.ideviceId).toBe('test-idevice-123');
    });

    it('includes all dataIds in result', () => {
      $exeDevice.init(mockElement, {});
      $exeDevice.dataIds = ['textTextarea', 'textFeedbackInput'];
      $exeDevice.textTextarea = '<p>Content</p>';
      $exeDevice.textFeedbackInput = 'Button';

      const result = $exeDevice.getDataJson();

      expect(result.textTextarea).toBe('<p>Content</p>');
      expect(result.textFeedbackInput).toBe('Button');
    });
  });

  describe('createTextareaHTML', () => {
    it('creates textarea with correct id', () => {
      const html = $exeDevice.createTextareaHTML('myId', 'My Title');

      expect(html).toContain('id="myId"');
    });

    it('creates textarea with title in label', () => {
      const html = $exeDevice.createTextareaHTML('myId', 'My Title');

      expect(html).toContain('My Title');
      expect(html).toContain('<label');
    });

    it('adds exe-html-editor class', () => {
      const html = $exeDevice.createTextareaHTML('myId', 'My Title');

      expect(html).toContain('exe-html-editor');
    });

    it('handles missing title', () => {
      const html = $exeDevice.createTextareaHTML('myId');

      expect(html).toContain('id="myId"');
      expect(html).toContain('<textarea');
    });

    it('includes icons when provided', () => {
      const html = $exeDevice.createTextareaHTML('myId', 'Title', '<span class="icon">X</span>');

      expect(html).toContain('<span class="icon">X</span>');
    });

    it('adds extra classes when provided', () => {
      const html = $exeDevice.createTextareaHTML('myId', 'Title', '', 'extra-class');

      expect(html).toContain('extra-class');
    });

    it('includes value when provided', () => {
      const html = $exeDevice.createTextareaHTML('myId', 'Title', '', '', 'Initial value');

      expect(html).toContain('Initial value');
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

    it('adds ideviceTextfield class', () => {
      const html = $exeDevice.createInputHTML('inputId', 'Title');

      expect(html).toContain('ideviceTextfield');
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

      const $form = $('#textForm');
      expect($form.length).toBe(1);
    });

    it('jQuery can manipulate textarea value', () => {
      $exeDevice.init(mockElement, {});

      const $textarea = $('#textTextarea');
      $textarea.val('<p>jQuery set value</p>');

      expect($textarea.val()).toBe('<p>jQuery set value</p>');
    });

    it('jQuery can add/remove classes', () => {
      $exeDevice.init(mockElement, {});

      const $fieldset = $('#textFeedback');
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

  describe('TinyMCE integration', () => {
    it('TinyMCE editor tracks content changes', async () => {
      $exeDevice.init(mockElement, {});

      const editor = await createTinyMCEEditor('textTextarea');
      editor.setContent('<p>First</p>');
      expect(editor.getContent()).toBe('<p>First</p>');

      editor.setContent('<p>Second</p>');
      expect(editor.getContent()).toBe('<p>Second</p>');
    });

    it('TinyMCE marks editor as dirty after changes', async () => {
      $exeDevice.init(mockElement, {});

      const editor = await createTinyMCEEditor('textTextarea');
      editor.setDirty(false);
      expect(editor.isDirty()).toBe(false);

      editor.setContent('<p>Changed</p>');
      editor.setDirty(true);
      expect(editor.isDirty()).toBe(true);
    });

    it('TinyMCE insertContent appends content', async () => {
      $exeDevice.init(mockElement, {});

      const editor = await createTinyMCEEditor('textTextarea');
      editor.setContent('<p>Start</p>');
      try {
        editor.insertContent('<p>Appended</p>');
      } catch (e) {
        editor.setContent(`${editor.getContent()}<p>Appended</p>`);
      }

      expect(editor.getContent()).toContain('Start');
      expect(editor.getContent()).toContain('Appended');
    });

    it('TinyMCE syncs with DOM textarea', async () => {
      $exeDevice.init(mockElement, {});

      const editor = await createTinyMCEEditor('textTextarea');
      editor.setContent('<p>Synced content</p>');
      editor.save();

      const textarea = document.getElementById('textTextarea');
      expect(textarea.value).toBe('<p>Synced content</p>');
    });
  });

  describe('extractTaskInfoFromHtml', () => {
    it('returns null for content without exe-text-activity or feedback', () => {
      $exeDevice.init(mockElement, {});

      const result = $exeDevice.extractTaskInfoFromHtml('<p>Regular content</p>');
      expect(result).toBeNull();
    });

    it('returns null for empty input', () => {
      $exeDevice.init(mockElement, {});

      expect($exeDevice.extractTaskInfoFromHtml('')).toBeNull();
      expect($exeDevice.extractTaskInfoFromHtml(null)).toBeNull();
      expect($exeDevice.extractTaskInfoFromHtml(undefined)).toBeNull();
    });

    it('extracts duration and participants from dl structure', () => {
      $exeDevice.init(mockElement, {});

      const html = `<div class="exe-text-activity">
        <dl>
          <div class="inline"><dt><span title="Duration:">Duration:</span></dt><dd>2 hours</dd></div>
          <div class="inline"><dt><span title="Grouping:">Grouping:</span></dt><dd>Pairs</dd></div>
        </dl>
        <p>Main content</p>
      </div>`;

      const result = $exeDevice.extractTaskInfoFromHtml(html);

      expect(result).not.toBeNull();
      expect(result.textInfoDurationTextInput).toBe('Duration:');
      expect(result.textInfoDurationInput).toBe('2 hours');
      expect(result.textInfoParticipantsTextInput).toBe('Grouping:');
      expect(result.textInfoParticipantsInput).toBe('Pairs');
    });

    it('extracts feedback button and content', () => {
      $exeDevice.init(mockElement, {});

      const html = `<div class="exe-text-activity">
        <p>Main content</p>
        <div class="iDevice_buttons feedback-button">
          <input type="button" class="feedbacktooglebutton" value="Show Answer">
        </div>
        <div class="feedback js-feedback"><p>Feedback text</p></div>
      </div>`;

      const result = $exeDevice.extractTaskInfoFromHtml(html);

      expect(result).not.toBeNull();
      expect(result.textFeedbackInput).toBe('Show Answer');
      expect(result.textFeedbackTextarea).toContain('Feedback text');
    });

    it('extracts main content without dl and feedback', () => {
      $exeDevice.init(mockElement, {});

      const html = `<div class="exe-text-activity">
        <dl><div class="inline"><dt>Duration:</dt><dd>1h</dd></div></dl>
        <p>Main content here</p>
        <div class="iDevice_buttons"><input class="feedbacktooglebutton" value="Show"></div>
        <div class="feedback js-feedback">Feedback</div>
      </div>`;

      const result = $exeDevice.extractTaskInfoFromHtml(html);

      expect(result.textTextarea).not.toContain('<dl>');
      expect(result.textTextarea).not.toContain('feedback');
      expect(result.textTextarea).toContain('Main content here');
    });

    it('extracts simple feedback without exe-text-activity wrapper (modern feedbacktooglebutton)', () => {
      $exeDevice.init(mockElement, {});

      // This format comes from legacy FreeTextIdevice with feedback but no task info
      const html = `<p>First paragraph content.</p>
<p>Second paragraph content.</p>
<div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbacktooglebutton" value="Mostrar retroalimentación" data-text-a="Mostrar retroalimentación" data-text-b="Mostrar retroalimentación" /></div>
<div class="feedback js-feedback js-hidden" style="display: none;">
<p>This is the feedback content.</p>
</div>`;

      const result = $exeDevice.extractTaskInfoFromHtml(html);

      expect(result).not.toBeNull();
      expect(result.textFeedbackInput).toBe('Mostrar retroalimentación');
      expect(result.textFeedbackTextarea).toContain('This is the feedback content.');
      expect(result.textTextarea).toContain('First paragraph content.');
      expect(result.textTextarea).toContain('Second paragraph content.');
      expect(result.textTextarea).not.toContain('feedback');
      expect(result.textTextarea).not.toContain('iDevice_buttons');
    });

    it('extracts simple feedback from legacy eXe 2.9 format (feedbackbutton class)', () => {
      $exeDevice.init(mockElement, {});

      // Legacy eXe 2.9 FreeTextIdevice: uses "feedbackbutton" instead of "feedbacktooglebutton"
      const html = `<p>A lo largo del proyecto, cada vez que terminemos una tarea...</p>
    <ol>
    <li>Repasar nuestro porfolio.</li>
    <li>Hacer una reflexión personal.</li>
    </ol>
    <div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbackbutton" value="Evaluación" /></div>
    <div class="feedback js-feedback js-hidden">
    <p>Esta tarea se valorará con las siguientes escalas de evaluación.</p>
    </div>`;

      const result = $exeDevice.extractTaskInfoFromHtml(html);

      expect(result).not.toBeNull();
      expect(result.textFeedbackInput).toBe('Evaluación');
      expect(result.textFeedbackTextarea).toContain('Esta tarea se valorará');
      expect(result.textTextarea).toContain('A lo largo del proyecto');
      expect(result.textTextarea).not.toContain('iDevice_buttons');
      expect(result.textTextarea).not.toContain('js-feedback');
    });
  });

  describe('buildTextareaHtml', () => {
    it('returns just main content when no task info or feedback', () => {
      $exeDevice.init(mockElement, {});

      $exeDevice.textTextarea = '<p>Simple content</p>';
      $exeDevice.textInfoDurationInput = '';
      $exeDevice.textInfoParticipantsInput = '';
      $exeDevice.textFeedbackInput = '';
      $exeDevice.textFeedbackTextarea = '';

      const result = $exeDevice.buildTextareaHtml();

      expect(result).toBe('<p>Simple content</p>');
      expect(result).not.toContain('exe-text-activity');
    });

    it('builds exe-text-activity structure when task info present', () => {
      $exeDevice.init(mockElement, {});

      $exeDevice.textTextarea = '<p>Task content</p>';
      $exeDevice.textInfoDurationInput = '30 min';
      $exeDevice.textInfoDurationTextInput = 'Duration:';
      $exeDevice.textInfoParticipantsInput = '';
      $exeDevice.textInfoParticipantsTextInput = '';
      $exeDevice.textFeedbackInput = '';
      $exeDevice.textFeedbackTextarea = '';

      const result = $exeDevice.buildTextareaHtml();

      expect(result).toContain('exe-text-activity');
      expect(result).toContain('<dl>');
      expect(result).toContain('Duration:');
      expect(result).toContain('30 min');
      expect(result).toContain('Task content');
    });

    it('builds exe-text-activity structure when feedback present', () => {
      $exeDevice.init(mockElement, {});

      $exeDevice.textTextarea = '<p>Content</p>';
      $exeDevice.textInfoDurationInput = '';
      $exeDevice.textInfoParticipantsInput = '';
      $exeDevice.textFeedbackInput = 'Show Feedback';
      $exeDevice.textFeedbackTextarea = '<p>The answer is...</p>';

      const result = $exeDevice.buildTextareaHtml();

      expect(result).toContain('exe-text-activity');
      expect(result).toContain('feedbacktooglebutton');
      expect(result).toContain('Show Feedback');
      expect(result).toContain('The answer is...');
      expect(result).not.toContain('<dl>'); // No task info, no dl
    });

    it('builds complete structure with task info and feedback', () => {
      $exeDevice.init(mockElement, {});

      $exeDevice.textTextarea = '<p>Main content</p>';
      $exeDevice.textInfoDurationInput = '1 hour';
      $exeDevice.textInfoDurationTextInput = 'Time:';
      $exeDevice.textInfoParticipantsInput = 'Groups of 4';
      $exeDevice.textInfoParticipantsTextInput = 'Grouping:';
      $exeDevice.textFeedbackInput = 'Check Answer';
      $exeDevice.textFeedbackTextarea = '<p>Correct!</p>';

      const result = $exeDevice.buildTextareaHtml();

      expect(result).toContain('exe-text-activity');
      expect(result).toContain('<dl>');
      expect(result).toContain('Time:');
      expect(result).toContain('1 hour');
      expect(result).toContain('Grouping:');
      expect(result).toContain('Groups of 4');
      expect(result).toContain('Main content');
      expect(result).toContain('feedbacktooglebutton');
      expect(result).toContain('Check Answer');
      expect(result).toContain('Correct!');
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      $exeDevice.init(mockElement, {});

      expect($exeDevice.escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect($exeDevice.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('returns empty string for falsy input', () => {
      $exeDevice.init(mockElement, {});

      expect($exeDevice.escapeHtml('')).toBe('');
      expect($exeDevice.escapeHtml(null)).toBe('');
      expect($exeDevice.escapeHtml(undefined)).toBe('');
    });
  });

  describe('escapeHtmlAttr', () => {
    it('escapes attribute special characters', () => {
      $exeDevice.init(mockElement, {});

      expect($exeDevice.escapeHtmlAttr('"quoted"')).toBe('&quot;quoted&quot;');
      expect($exeDevice.escapeHtmlAttr("it's")).toBe('it&#39;s');
    });
  });

  describe('loadPreviousValues with exe-text-activity extraction', () => {
    it('extracts task info from textTextarea when it has exe-text-activity structure', () => {
      const html = `<div class="exe-text-activity">
        <dl>
          <div class="inline"><dt><span title="Duration:">Duration:</span></dt><dd>45 min</dd></div>
          <div class="inline"><dt><span title="Grouping:">Grouping:</span></dt><dd>Individual</dd></div>
        </dl>
        <p>Task description</p>
        <div class="iDevice_buttons feedback-button">
          <input type="button" class="feedbacktooglebutton" value="Show Solution">
        </div>
        <div class="feedback js-feedback"><p>The solution is...</p></div>
      </div>`;

      const previousData = {
        textTextarea: html,
      };

      $exeDevice.init(mockElement, previousData);

      // Check that extracted values are loaded into the form fields
      const durationInput = mockElement.querySelector('#textInfoDurationInput');
      const durationTextInput = mockElement.querySelector('#textInfoDurationTextInput');
      const participantsInput = mockElement.querySelector('#textInfoParticipantsInput');
      const participantsTextInput = mockElement.querySelector('#textInfoParticipantsTextInput');

      expect(durationInput.value).toBe('45 min');
      expect(durationTextInput.value).toBe('Duration:');
      expect(participantsInput.value).toBe('Individual');
      expect(participantsTextInput.value).toBe('Grouping:');
    });

    it('loads regular textTextarea without extraction when no exe-text-activity', () => {
      const previousData = {
        textTextarea: '<p>Regular content without task info</p>',
      };

      $exeDevice.init(mockElement, previousData);

      const textarea = mockElement.querySelector('#textTextarea');
      expect(textarea.value).toBe('<p>Regular content without task info</p>');
    });

    it('extracts feedback from legacy eXe 2.9 format when loading previousData', () => {
      // Reproduces the bug: eXe 2.9 ELPs use "feedbackbutton" class; previously the
      // feedback content appeared in the main text box and the feedback field was empty.
      const legacyHtml = `<p>A lo largo del proyecto, cada vez que terminemos una tarea...</p>
    <div class="iDevice_buttons feedback-button js-required"><input type="button" class="feedbackbutton" value="Evaluación" /></div>
    <div class="feedback js-feedback js-hidden">
    <p>Esta tarea se valorará con las siguientes escalas de evaluación.</p>
    </div>`;

      const previousData = { textTextarea: legacyHtml };

      $exeDevice.init(mockElement, previousData);

      // Main textarea must NOT contain the feedback HTML
      const textarea = mockElement.querySelector('#textTextarea');
      expect(textarea.value).toContain('A lo largo del proyecto');
      expect(textarea.value).not.toContain('iDevice_buttons');
      expect(textarea.value).not.toContain('js-feedback');

      // Feedback button label must be populated
      const feedbackInput = mockElement.querySelector('#textFeedbackInput');
      expect(feedbackInput.value).toBe('Evaluación');

      // Feedback textarea must contain the feedback content
      const feedbackTextarea = mockElement.querySelector('#textFeedbackTextarea');
      expect(feedbackTextarea.value).toContain('Esta tarea se valorará');

      // Feedback fieldset must be expanded because it has content
      const feedbackFieldset = mockElement.querySelector('#textFeedback');
      expect(feedbackFieldset.classList.contains('exe-fieldset-open')).toBe(true);
    });
  });
});

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
        textTextarea: `<p>Content</p>
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

  describe('hideEmptyTaskInfo', () => {
    const row = (label, value) =>
      `<div class="inline"><dt><span title="${label}">${label}</span></dt><dd>${value}</dd></div>`;
    const makeNode = (html) => {
      const node = document.createElement('div');
      node.innerHTML = `<div class="exe-text-activity"><dl>${html}</dl><p>Text</p></div>`;
      return node;
    };
    const hidden = (node) =>
      Array.from(node.querySelectorAll('dl > div.inline')).map((r) =>
        r.classList.contains('exe-text-info-empty')
      );

    it('hides the Grouping row when only Duration has a value', () => {
      const node = makeNode(row('Duration', '45 min') + row('Grouping', ''));
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false, true]);
    });

    it('hides the Duration row when only Grouping has a value', () => {
      const node = makeNode(row('Duration', '') + row('Grouping', 'In pairs'));
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([true, false]);
    });

    it('keeps both rows when both have a value', () => {
      const node = makeNode(row('Duration', '45 min') + row('Grouping', 'In pairs'));
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false, false]);
    });

    it('treats a value made only of whitespace (older content) as empty', () => {
      const node = makeNode(row('Duration', '45 min') + row('Grouping', '\n   '));
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false, true]);
    });

    it('keeps the rows in the HTML, so the editor can still read them by position', () => {
      const node = makeNode(row('Duration', '') + row('Grouping', 'In pairs'));
      $text.hideEmptyTaskInfo(node);
      const rows = node.querySelectorAll('dl > div.inline');
      expect(rows.length).toBe(2);
      expect(rows[1].querySelector('dd').textContent).toBe('In pairs');
    });

    it('shows a row again when its value is filled after a new render', () => {
      const node = makeNode(row('Duration', '45 min') + row('Grouping', ''));
      $text.hideEmptyTaskInfo(node);
      node.querySelectorAll('dd')[1].textContent = 'In pairs';
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false, false]);
    });

    it('ignores rows without a value element and missing nodes', () => {
      const node = makeNode('<div class="inline"><dt>Only a term</dt></div>');
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false]);
      expect(() => $text.hideEmptyTaskInfo(null)).not.toThrow();
    });

    it('hides both rows and the whole list when both fields are empty', () => {
      const node = makeNode(row('Duration', '') + row('Grouping', ''));
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([true, true]);
      expect(node.querySelector('dl').classList.contains('exe-text-info-empty')).toBe(true);
    });

    it('does not hide the list when one field has a value', () => {
      const node = makeNode(row('Duration', '45 min') + row('Grouping', ''));
      $text.hideEmptyTaskInfo(node);
      expect(node.querySelector('dl').classList.contains('exe-text-info-empty')).toBe(false);
    });

    it('handles older saved content (inner wrapper, whitespace) without saving it again', () => {
      // Same markup as the Text iDevices in test/fixtures/basic-example.elp.
      const node = document.createElement('div');
      node.innerHTML =
        '<div class="exe-text-template"><div class="textIdeviceContent"> <div class="exe-text-activity"> <div> <dl> ' +
        '<div class="inline"> <dt><span title="Duration">Duration</span></dt> <dd> 2 hours </dd> </div> ' +
        '<div class="inline"> <dt><span title=""></span></dt> <dd> </dd> </div> ' +
        '</dl><p>Description 1</p> </div> </div></div></div>';
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false, true]);
    });

    it('treats a value with an image as not empty', () => {
      const node = makeNode(row('Duration', '<img src="clock.png" alt="45 min">') + row('Grouping', ''));
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false, true]);
    });

    it('leaves author definition lists untouched, including rows with images', () => {
      const node = document.createElement('div');
      node.innerHTML =
        '<div class="exe-text-activity">' +
        `<dl>${row('Duration', '45 min')}${row('Grouping', '')}</dl>` +
        '<p>Text</p>' +
        `<dl class="author">${row('Term', '')}${row('Picture', '<img src="a.png" alt="A">')}</dl>` +
        '<dl class="exe-dl"><dt>REA</dt><dd><img src="b.png" alt="B"></dd><dt>Empty</dt><dd></dd></dl>' +
        '</div>';
      $text.hideEmptyTaskInfo(node);
      const authorRows = node.querySelectorAll('dl.author > div.inline');
      expect(Array.from(authorRows).map((r) => r.classList.contains('exe-text-info-empty'))).toEqual([false, false]);
      expect(node.querySelectorAll('dl.exe-dl .exe-text-info-empty').length).toBe(0);
      expect(node.querySelector('dl.author').classList.contains('exe-text-info-empty')).toBe(false);
    });

    it('ignores a first definition list that does not have the task information structure', () => {
      const node = document.createElement('div');
      node.innerHTML =
        '<div class="exe-text-activity"><dl class="exe-dl"><dt>Term</dt><dd></dd></dl><p>Text</p></div>';
      $text.hideEmptyTaskInfo(node);
      expect(node.querySelectorAll('.exe-text-info-empty').length).toBe(0);

      const three = makeNode(row('A', '') + row('B', '') + row('C', ''));
      $text.hideEmptyTaskInfo(three);
      expect(three.querySelectorAll('.exe-text-info-empty').length).toBe(0);
    });

    it('ignores definition lists outside the task information block', () => {
      const node = document.createElement('div');
      node.innerHTML = `<div class="exe-text-activity"><p>Text</p><dl>${row('Duration', '')}</dl></div>`;
      $text.hideEmptyTaskInfo(node);
      expect(node.querySelectorAll('.exe-text-info-empty').length).toBe(0);
    });

    it('keeps the class rule apart from :has() in the CSS (browsers without :has() drop the whole list)', () => {
      const css = readFileSync(join(__dirname, 'text.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
      const rules = css.split('}').map((rule) => rule.split('{')[0].trim()).filter(Boolean);
      const classRules = rules.filter((sel) => sel.includes('.exe-text-info-empty'));
      expect(classRules.length).toBeGreaterThan(0);
      classRules.forEach((sel) => expect(sel).not.toContain(':has('));
      const hasRules = rules.filter((sel) => sel.includes(':has('));
      expect(hasRules.length).toBeGreaterThan(0);
      // The :has() rule only targets marked task information lists, with the
      // same position and size limits as getTaskInfoList / isTaskInfoList.
      hasRules.forEach((sel) =>
        sel.split(/,(?![^(]*\))/).forEach((one) =>
          expect(one.trim()).toMatch(
            /^\.exe-text-activity > (div:first-child > )?dl\.exe-text-task-info:first-child:not\(:has\(> :nth-child\(3\)\)\) > div\.inline:has\(> dt \+ dd:empty\)$/
          )
        )
      );
    });

    it('accepts a list marked with exe-text-task-info, with one or two rows', () => {
      const one = document.createElement('div');
      one.innerHTML = `<div class="exe-text-activity"><dl class="exe-text-task-info"><div class="inline"><dt>Duration</dt><dd></dd></div></dl><p>Text</p></div>`;
      $text.hideEmptyTaskInfo(one);
      expect(hidden(one)).toEqual([true]);

      const two = document.createElement('div');
      two.innerHTML = `<div class="exe-text-activity"><dl class="exe-text-task-info"><div class="inline"><dt>Duration</dt><dd>45 min</dd></div><div class="inline"><dt>Grouping</dt><dd></dd></div></dl></div>`;
      $text.hideEmptyTaskInfo(two);
      expect(hidden(two)).toEqual([false, true]);
    });

    it('ignores a marked list with three rows', () => {
      const node = document.createElement('div');
      node.innerHTML = `<div class="exe-text-activity"><dl class="exe-text-task-info">${row('A', '')}${row('B', 'b')}${row('C', 'c')}</dl></div>`;
      $text.hideEmptyTaskInfo(node);
      expect(node.querySelectorAll('.exe-text-info-empty').length).toBe(0);
    });

    it('only accepts an unmarked first list with the exact older structure (two rows, dt > span[title])', () => {
      const author = document.createElement('div');
      author.innerHTML =
        '<div class="exe-text-activity"><dl>' +
        '<div class="inline"><dt>Example</dt><dd></dd></div>' +
        '<div class="inline"><dt>Image</dt><dd><img src="a.png" alt="A"></dd></div>' +
        '</dl><p>Text</p></div>';
      $text.hideEmptyTaskInfo(author);
      expect(author.querySelectorAll('.exe-text-info-empty').length).toBe(0);

      const oneRow = makeNode(row('Duration', ''));
      $text.hideEmptyTaskInfo(oneRow);
      expect(oneRow.querySelectorAll('.exe-text-info-empty').length).toBe(0);
    });

    it('marks the list it creates with exe-text-task-info', () => {
      const html = $text.createInfoHTML('Duration', '45 min', 'Grouping', '');
      expect(html).toContain('<dl class="exe-text-task-info">');
      const node = document.createElement('div');
      node.innerHTML = $text.createMainContent(html + '<p>Text</p>');
      $text.hideEmptyTaskInfo(node);
      expect(hidden(node)).toEqual([false, true]);
    });

    it('is applied by renderBehaviour', () => {
      document.body.innerHTML = '';
      const node = makeNode(row('Duration', '45 min') + row('Grouping', ''));
      node.id = 'text-info-1';
      document.body.appendChild(node);
      const origIsInExe = eXe.app.isInExe;
      const origExeDevices = global.$exeDevices;
      eXe.app.isInExe = () => false;
      global.$exeDevices = {
        iDevice: { gamification: { math: { hasLatex: () => false, updateLatex: vi.fn() } } },
      };
      try {
        $text.renderBehaviour({ ideviceId: 'text-info-1' });
        expect(hidden(node)).toEqual([false, true]);
      } finally {
        eXe.app.isInExe = origIsInExe;
        global.$exeDevices = origExeDevices;
        document.body.innerHTML = '';
      }
    });
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { useGradingHelpHarness } from './grading-help.test-util.js';

// Setup globals needed BEFORE the script is loaded
globalThis._ = vi.fn((key) => key);
globalThis.c_ = vi.fn((key) => key);
globalThis.eXe = {
  app: {
    alert: vi.fn(),
    clearHistory: vi.fn(),
    _confirmResponses: {
      clear: vi.fn()
    }
  },
};
globalThis.$exeTinyMCE = {
  init: vi.fn(),
};
globalThis.$exeDevice = {
  init: vi.fn(),
  save: vi.fn(() => '<div>Saved HTML</div>'),
  i18n: {
    en: { 'Test': 'Translated Test' }
  },
  getCuestionDefault: vi.fn(() => ({ word: '', definition: '' })),
  removeTags: vi.fn((text) => text),
};
globalThis.top = {
  translations: {}
};
globalThis.tinymce = { majorVersion: 4 };
globalThis.eXeLearning = {
  app: {
    api: {
      getGenerateQuestions: vi.fn(),
    },
    modals: {
      filemanager: {
        show: vi.fn(),
      }
    },
    project: {
      odeId: ''
    }
  }
};

// Load the module using require() for coverage tracking
const $exeIDevicesEdition = require('./common_idevices_edition.js');
globalThis.$exeIDevicesEdition = $exeIDevicesEdition;

describe('common_idevices_edition.js', () => {
  const helpHarness = useGradingHelpHarness();
  beforeEach(() => {
    vi.clearAllMocks();

    if (!globalThis.$ || !globalThis.jQuery) {
      throw new Error('jQuery is not available in the test environment');
    }

    // Ensure $exeDevice is defined globally before script evaluation in each test
    globalThis.$exeDevice = {
      init: vi.fn(),
      save: vi.fn(() => '<div>Saved HTML</div>'),
      i18n: {
        en: { 'Test': 'Translated Test' }
      }
    };
    document.documentElement.setAttribute('lang', 'en');
    document.body.innerHTML = '';

    const submitWrapper = document.createElement('div');
    submitWrapper.id = 'exe-submitButton';
    const submitLink = document.createElement('a');
    submitLink.setAttribute('onclick', 'console.log("clicked")');
    submitWrapper.appendChild(submitLink);
    document.body.appendChild(submitWrapper);

    const editorTextarea = document.createElement('textarea');
    editorTextarea.className = 'mceEditor';
    document.body.appendChild(editorTextarea);

    const nodeContent = document.createElement('div');
    nodeContent.id = 'node-content';
    const ideviceNode = document.createElement('div');
    ideviceNode.className = 'idevice_node';
    ideviceNode.setAttribute('mode', 'edition');
    nodeContent.appendChild(ideviceNode);
    document.body.appendChild(nodeContent);
  });

  it('defines global $exeIDevicesEdition', () => {
    expect(globalThis.$exeIDevicesEdition).toBeDefined();
    expect(typeof globalThis.$exeIDevicesEdition.iDevice.tabs.getHtml).toBe('function');
  });

  describe('common', () => {
    describe('help tooltips', () => {
      const common = () => globalThis.$exeIDevicesEdition.iDevice.common;
      let previousCommon;
      let previousLifecycle;
      let lifecycle;
      let instances;

      beforeEach(() => {
        previousCommon = eXeLearning.app.common;
        previousLifecycle = window.$exeEditionLifecycle;
        lifecycle = global.attachEditionLifecycle({ name: 'help-tooltip-test' });
        instances = new Map();
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => instances.get(button) } });
        eXeLearning.app.common = {
          initTooltips: vi.fn((scope) => {
            scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
              if (!instances.has(button)) instances.set(button, { hide: vi.fn(), dispose: vi.fn() });
            });
          }),
        };
      });

      afterEach(() => {
        lifecycle.destroy();
        window.$exeEditionLifecycle = previousLifecycle;
        eXeLearning.app.common = previousCommon;
        vi.unstubAllGlobals();
      });

      it('renders a keyboard-accessible information button with escaped plain text', () => {
        const text = 'Use "Accept" <once> & keep the learner\'s answer.';
        document.body.innerHTML = common().getHelpTooltip(text);
        const button = document.querySelector('button');
        expect(button.type).toBe('button');
        expect(button.title).toBe('Information');
        expect(button.getAttribute('aria-label')).toBe('Information');
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById(button.getAttribute('aria-controls')).textContent).toBe(text);
        expect(button.querySelector('span.info-icon-solid-green').getAttribute('aria-hidden')).toBe('true');
        expect(document.querySelector('once')).toBeNull();
      });

      it('initializes only the requested form and disposes each tooltip once after repeated binding', () => {
        document.body.innerHTML = `<div id="first">${common().getHelpTooltip('First option')}</div>
          <div id="second">${common().getHelpTooltip('Second option')}</div>`;
        const form = document.getElementById('first');
        common().initHelpTooltips(form);
        common().initHelpTooltips(form);
        expect(instances.size).toBe(1);
        expect(instances.has(form.querySelector('button'))).toBe(true);
        lifecycle.destroy();
        expect([...instances.values()][0].dispose).toHaveBeenCalledTimes(1);
      });

      it('keeps help clicks from activating the surrounding option and dismisses with Escape', () => {
        document.body.innerHTML = `<div id="option">${common().getHelpTooltip('Explain the option')}</div>`;
        const row = document.getElementById('option');
        const toggle = vi.fn();
        row.addEventListener('click', toggle);
        common().initHelpTooltips(row);
        const button = row.querySelector('button');
        button.click();
        expect(toggle).not.toHaveBeenCalled();
        expect(button.getAttribute('aria-expanded')).toBe('true');
        const tooltip = instances.get(button);
        expect(tooltip.hide).toHaveBeenCalledOnce();
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(tooltip.hide).toHaveBeenCalledOnce();
        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(tooltip.hide).toHaveBeenCalledTimes(2);
        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(document.querySelector('.help-content').classList.contains('help-hidden')).toBe(true);
      });

      it('keeps the explanation open until another icon or any other point is clicked', () => {
        document.body.innerHTML = common().getHelpTooltip('First option') + common().getHelpTooltip('Second option');
        common().initHelpTooltips(document.body);
        const [first, second] = document.querySelectorAll('button');
        const [firstNote, secondNote] = document.querySelectorAll('.help-content');
        first.querySelector('span').click();
        first.dispatchEvent(new MouseEvent('mouseleave'));
        expect(firstNote.classList.contains('help-hidden')).toBe(false);
        first.click();
        expect(firstNote.classList.contains('help-hidden')).toBe(false);
        second.click();
        expect(firstNote.classList.contains('help-hidden')).toBe(true);
        expect(secondNote.classList.contains('help-hidden')).toBe(false);
        // A click inside the explanation also counts as clicking elsewhere.
        secondNote.addEventListener('click', (event) => event.stopPropagation());
        secondNote.click();
        expect(secondNote.classList.contains('help-hidden')).toBe(true);
      });

      it('supports forms without an active edition lifecycle', () => {
        window.$exeEditionLifecycle = null;
        document.body.innerHTML = common().getHelpTooltip('Explain the option');
        const dispose = common().initHelpTooltips(document.body);
        expect(instances.size).toBe(1);
        dispose();
        expect([...instances.values()][0].dispose).toHaveBeenCalledOnce();
        document.querySelector('button').click();
        expect(document.querySelector('button').getAttribute('aria-expanded')).toBe('false');
      });

      it('fits help to its panel and clipping ancestors, and refits only while open', () => {
        document.body.innerHTML = `<div id="scroller" style="overflow-x: auto"><div class="tab-pane">
          ${common().getHelpTooltip('Explain the option')}</div></div>`;
        const panel = document.querySelector('.tab-pane');
        const button = panel.querySelector('button');
        const content = panel.querySelector('.help-content');
        const panelRect = vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({ right: 900 });
        vi.spyOn(document.getElementById('scroller'), 'getBoundingClientRect').mockReturnValue({ right: 875 });
        const anchorRect = vi.spyOn(button.parentElement, 'getBoundingClientRect').mockReturnValue({ left: 730 });
        common().initHelpTooltips(panel);
        button.click();
        expect(content.style.maxWidth).toBe('137px');

        panelRect.mockReturnValue({ right: 820 });
        window.dispatchEvent(new Event('resize'));
        expect(content.style.maxWidth).toBe('82px');
        anchorRect.mockReturnValue({ left: 700 });
        document.getElementById('scroller').dispatchEvent(new Event('scroll'));
        expect(content.style.maxWidth).toBe('112px');

        button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        panelRect.mockClear();
        window.dispatchEvent(new Event('resize'));
        document.dispatchEvent(new Event('scroll'));
        expect(panelRect).not.toHaveBeenCalled();

        button.click();
        lifecycle.destroy();
        panelRect.mockClear();
        window.dispatchEvent(new Event('resize'));
        document.dispatchEvent(new Event('scroll'));
        expect(panelRect).not.toHaveBeenCalled();
      });

      it('also bounds help by the viewport in forms without tabs', () => {
        document.body.innerHTML = `<div id="form">${common().getHelpTooltip('Explain the option')}</div>`;
        const form = document.getElementById('form');
        const button = form.querySelector('button');
        vi.spyOn(form, 'getBoundingClientRect').mockReturnValue({ right: window.innerWidth + 200 });
        vi.spyOn(button.parentElement, 'getBoundingClientRect').mockReturnValue({ left: window.innerWidth - 120 });
        common().initHelpTooltips(form);
        button.click();
        expect(form.querySelector('.help-content').style.maxWidth).toBe('112px');
      });

      it('leaves missing forms and forms without help alone', () => {
        common().initHelpTooltips(null);
        common().initHelpTooltips(document.body);
        expect(eXeLearning.app.common.initTooltips).not.toHaveBeenCalled();
      });
    });

    describe('escapeHtml', () => {
      const escapeHtml = (value) => globalThis.$exeIDevicesEdition.iDevice.common.escapeHtml(value);

      it('escapes the characters that break HTML text and quoted attributes', () => {
        expect(escapeHtml(`<b class="x">Tom & 'Jerry'</b>`)).toBe(
          '&lt;b class=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;'
        );
      });

      it('turns null and undefined into an empty string and other values into text', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(42)).toBe('42');
      });
    });

    describe('getTextEditor', () => {
      const getTextEditor = (position) => globalThis.$exeIDevicesEdition.iDevice.common.getTextEditor(position);

      it('returns the "Content after" editor with a hidden label and no fieldset', () => {
        document.body.innerHTML = getTextEditor('after');

        const textarea = document.getElementById('eXeIdeviceTextAfter');
        expect(textarea.classList.contains('exe-html-editor')).toBe(true);
        const label = document.querySelector('label[for="eXeIdeviceTextAfter"]');
        expect(label.textContent).toBe('Content after');
        expect(label.classList.contains('visually-hidden')).toBe(true);
        expect(document.querySelector('fieldset')).toBeNull();
      });

      it('returns the "Content before" editor', () => {
        document.body.innerHTML = getTextEditor('before');

        expect(document.getElementById('eXeIdeviceTextBefore')).not.toBeNull();
        expect(document.querySelector('label[for="eXeIdeviceTextBefore"]').textContent).toBe('Content before');
      });

      it('returns an empty string for any other position', () => {
        expect(getTextEditor('middle')).toBe('');
        expect(getTextEditor(undefined)).toBe('');
      });
    });

    it('getIdeviceDescription returns Bootstrap dismissible alert markup', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.common.getIdeviceDescription(
        'Description text',
        'https://example.com/help'
      );

      expect(result).toContain('class="alert alert-info alert-dismissible fade show mb-3"');
      expect(result).toContain('role="alert"');
      expect(result).toContain('href="https://example.com/help"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('hreflang="es"');
      expect(result).toContain('class="alert-link"');
      expect(result).toContain('>Usage Instructions<');
      expect(result).toContain('btn-close');
      expect(result).toContain('data-bs-dismiss="alert"');
      expect(result).not.toContain('exe-block-info');
      expect(result).not.toContain('exe-block-dismissible');
      expect(result).not.toContain('exe-block-close');
    });

    it('getIdeviceDescription does not render usage link when url is not present', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.common.getIdeviceDescription(
        'Description text',
        null
      );

      expect(result).toContain('<p class="alert alert-info alert-dismissible fade show mb-3"');
      expect(result).not.toContain('<a ');
    });

    it('getIdeviceDescription returns empty string when text is not a string', () => {
      expect(globalThis.$exeIDevicesEdition.iDevice.common.getIdeviceDescription(null, 'https://example.com')).toBe('');
      expect(globalThis.$exeIDevicesEdition.iDevice.common.getIdeviceDescription(42, 'https://example.com')).toBe('');
    });
  });

  describe('Grading information component', () => {
    const grading = () => globalThis.$exeIDevicesEdition.iDevice.gamification;
    const scopes = [
      ['#eXeGameSCORMNoSave', 'sends no score to the LMS'],
      ['#eXeGameSCORMAutoSave', 'reports its score by itself'],
      ['#eXeGameSCORMButtonSave', 'until the learner presses the button'],
      ['#eXeGameSCORMWeight', 'proportion between the weights'],
      ['#eXeProgressReportID', 'You must indicate the ID'],
      ['#eXePassScoreCustomOptions', 'Global value: the activity uses the mark'],
    ];
    const mount = (path = '/idevice/path/', options = {}) => {
      document.body.innerHTML = grading().scorm.getContents(path, options);
      grading().scorm.addEvents();
      grading().progressBar.addEvents();
      grading().passScore.addEvents();
    };
    const informationFor = (selector) => document.querySelector(selector).parentElement.querySelector('.exe-idevice-help');
    const noteFor = (button) => document.getElementById(button.getAttribute('aria-controls'));

    it.each(scopes)('uses the editor information component beside %s', (selector, explanation) => {
      mount();
      const button = informationFor(selector);
      const note = noteFor(button);
      const before = grading().scorm.getValues();
      expect(button.type).toBe('button');
      expect(button.title).toBe('Information');
      expect(button.getAttribute('aria-label')).toBe('Information');
      expect(button.querySelector('.info-icon-solid-green')).not.toBeNull();
      expect(note.textContent).toContain(explanation);
      expect(note.classList.contains('help-hidden')).toBe(true);
      button.click();
      expect(note.classList.contains('help-hidden')).toBe(false);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      button.dispatchEvent(new MouseEvent('mouseleave'));
      button.click();
      expect(note.classList.contains('help-hidden')).toBe(false);
      expect(grading().scorm.getValues()).toEqual(before);
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(note.classList.contains('help-hidden')).toBe(true);
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(document.querySelector('img[src$="quextIEHelp.png"]')).toBeNull();
    });

    it('closes the previous explanation when opening another one or clicking elsewhere', () => {
      mount();
      const first = informationFor('#eXeGameSCORMNoSave');
      const second = informationFor('#eXeProgressReportID');
      first.click();
      second.click();
      expect(noteFor(first).classList.contains('help-hidden')).toBe(true);
      expect(noteFor(second).classList.contains('help-hidden')).toBe(false);
      document.body.click();
      expect(noteFor(second).classList.contains('help-hidden')).toBe(true);
    });

    it('closes weight help when selecting a mode that hides its field', () => {
      mount();
      grading().scorm.setValues(1, 'Save', true, 75);
      const button = informationFor('#eXeGameSCORMWeight');
      button.click();
      expect(noteFor(button).classList.contains('help-hidden')).toBe(false);
      document.getElementById('eXeGameSCORMNoSave').click();
      expect(noteFor(button).classList.contains('help-hidden')).toBe(true);
      expect(document.getElementById('eXeGameSCORMPercentaje').classList.contains('d-none')).toBe(true);
      expect(button.closest('#eXeGameSCORMPercentaje')).not.toBeNull();
    });

    it('shows information without an asset path and keeps optional controls hidden', () => {
      mount('', { hideautosave: true, hidebutton: true });
      expect(document.querySelectorAll('.exe-idevice-help')).toHaveLength(5);
      expect(document.getElementById('eXeProgressReport')).toBeNull();
      expect(document.getElementById('eXeGameSCORMAutomatically').classList.contains('d-none')).toBe(true);
      expect(document.getElementById('eXeGameSCORMblock').classList.contains('d-none')).toBe(true);
      const button = informationFor('#eXeGameSCORMNoSave');
      button.click();
      expect(noteFor(button).classList.contains('help-hidden')).toBe(false);
      expect(noteFor(button).textContent).toContain('\n\n');
    });

    it('binds each help once and releases all tooltips when the edition closes', () => {
      const previousLifecycle = window.$exeEditionLifecycle;
      const lifecycle = global.attachEditionLifecycle({ name: 'grading-help-test' });
      try {
        mount();
        grading().scorm.addEvents();
        grading().progressBar.addEvents();
        grading().passScore.addEvents();
        const instances = [...helpHarness.instances().values()];
        expect(instances).toHaveLength(6);
        const button = informationFor('#eXeProgressReportID');
        button.click();
        lifecycle.destroy();
        instances.forEach((tooltip) => expect(tooltip.dispose).toHaveBeenCalledTimes(1));
        expect(noteFor(button).classList.contains('help-hidden')).toBe(true);
        button.click();
        expect(noteFor(button).classList.contains('help-hidden')).toBe(true);
      } finally {
        lifecycle.destroy();
        window.$exeEditionLifecycle = previousLifecycle;
      }
    });
  });

  describe('gamification', () => {
    describe('instructions.getEditor', () => {
      const getEditor = (str) => globalThis.$exeIDevicesEdition.iDevice.gamification.instructions.getEditor(str);

      it('returns the instructions editor with its default text and no fieldset', () => {
        document.body.innerHTML = getEditor('test info');

        const textarea = document.getElementById('eXeGameInstructions');
        expect(textarea.classList.contains('exe-html-editor')).toBe(true);
        expect(textarea.value).toBe('test info');
        expect(document.querySelector('label[for="eXeGameInstructions"]').classList.contains('visually-hidden')).toBe(
          true
        );
        expect(document.querySelector('fieldset')).toBeNull();
      });

      it('keeps HTML and entities in the default text exactly as given', () => {
        document.body.innerHTML = getEditor('<p>Tom &amp; Jerry</p></textarea><b>x</b>');

        expect(document.getElementById('eXeGameInstructions').value).toBe('<p>Tom &amp; Jerry</p></textarea><b>x</b>');
        expect(document.querySelectorAll('textarea')).toHaveLength(1);
      });

      it('leaves the editor empty when no text is given', () => {
        document.body.innerHTML = getEditor();

        expect(document.getElementById('eXeGameInstructions').value).toBe('');
      });
    });

    it('itinerary.getValues returns object with values', () => {
      const clueCheckbox = document.createElement('input');
      clueCheckbox.id = 'eXeGameShowClue';
      clueCheckbox.type = 'checkbox';
      clueCheckbox.checked = true;
      document.body.appendChild(clueCheckbox);

      const clueInput = document.createElement('input');
      clueInput.id = 'eXeGameClue';
      clueInput.value = 'Clue Text';
      document.body.appendChild(clueInput);

      const percentSelect = document.createElement('select');
      percentSelect.id = 'eXeGamePercentajeClue';
      const option = document.createElement('option');
      option.value = '40';
      option.selected = true;
      percentSelect.appendChild(option);
      document.body.appendChild(percentSelect);

      const values = globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.getValues();
      expect(values).toHaveProperty('showClue');
      expect(values).toHaveProperty('clueGame');
      expect(values.clueGame).toBe('Clue Text');
    });

    it('scorm.getValues returns SCORM values', () => {
      const scormRadio = document.createElement('input');
      scormRadio.type = 'radio';
      scormRadio.name = 'eXeGameSCORM';
      scormRadio.value = '1';
      scormRadio.checked = true;
      document.body.appendChild(scormRadio);

      const scormButtonText = document.createElement('input');
      scormButtonText.id = 'eXeGameSCORMbuttonText';
      scormButtonText.value = 'Save';
      document.body.appendChild(scormButtonText);

      const scormWeight = document.createElement('input');
      scormWeight.id = 'eXeGameSCORMWeight';
      scormWeight.value = '100';
      document.body.appendChild(scormWeight);

      const values = globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.getValues();
      expect(values.isScorm).toBe(1);
      expect(values.textButtonScorm).toBe('Save');
    });

    describe('progressBar', () => {
      const progressBar = () => globalThis.$exeIDevicesEdition.iDevice.gamification.progressBar;

      const mountHtml = (path = '/themes/example/') => {
        document.body.innerHTML = progressBar().getContents(path);
      };

      it('getContents returns HTML with the unified IDs and the eXe toggle classes', () => {
        const html = progressBar().getContents('/path/to/');
        expect(html).toContain('id="eXeProgressReport"');
        expect(html).toContain('id="eXeProgressReportID"');
        expect(html).toContain('toggle-item');
        expect(html).toContain('toggle-control');
        expect(html).toContain('toggle-input');
        expect(html).toContain('toggle-visual');
        expect(html).toContain('toggle-label');
        expect(html).toContain('idevice-id="eXeProgressReport"');
        expect(html).toContain('d-flex align-items-center flex-wrap gap-2');
        expect(html).toContain('d-flex align-items-center flex-nowrap gap-2');
        expect(html).toContain('form-control form-control-sm');
        expect(html).toContain('help-content help-hidden');
        expect(html).toContain('info-icon-solid-green');
        expect(html).not.toContain('quextIEHelp.png');
      });

      it('getContents suggests the project id as the report identifier, and nothing without a project', () => {
        const previous = globalThis.eXeLearning;
        try {
          globalThis.eXeLearning = { app: { project: { odeId: 'project-123' } } };
          mountHtml();
          expect(document.getElementById('eXeProgressReportID').value).toBe('project-123');

          globalThis.eXeLearning = undefined;
          mountHtml();
          expect(document.getElementById('eXeProgressReportID').value).toBe('');
        } finally {
          globalThis.eXeLearning = previous;
        }
      });

      it('setValues populates checkbox and input when evaluation is true', () => {
        mountHtml();
        progressBar().setValues({ evaluation: true, evaluationID: 'ABCDE' });
        expect(document.getElementById('eXeProgressReport').checked).toBe(true);
        expect(document.getElementById('eXeProgressReportID').value).toBe('ABCDE');
        expect(document.getElementById('eXeProgressReportID').disabled).toBe(false);
      });

      it('setValues clears and disables input when evaluation is false', () => {
        mountHtml();
        progressBar().setValues({ evaluation: false, evaluationID: '' });
        expect(document.getElementById('eXeProgressReport').checked).toBe(false);
        expect(document.getElementById('eXeProgressReportID').value).toBe('');
        expect(document.getElementById('eXeProgressReportID').disabled).toBe(true);
      });

      it('setValues handles missing data gracefully', () => {
        mountHtml();
        progressBar().setValues();
        expect(document.getElementById('eXeProgressReport').checked).toBe(false);
        expect(document.getElementById('eXeProgressReportID').disabled).toBe(true);
      });

      it('getValues returns the form values when evaluation is unchecked', () => {
        mountHtml();
        progressBar().setValues({ evaluation: false, evaluationID: '' });
        const values = progressBar().getValues();
        expect(values).toEqual({ evaluation: false, evaluationID: '' });
        expect(globalThis.eXe.app.alert).not.toHaveBeenCalled();
      });

      it('getValues returns the form values when evaluation is checked and ID is valid', () => {
        mountHtml();
        progressBar().setValues({ evaluation: true, evaluationID: 'VALIDID' });
        const values = progressBar().getValues();
        expect(values).toEqual({ evaluation: true, evaluationID: 'VALIDID' });
        expect(globalThis.eXe.app.alert).not.toHaveBeenCalled();
      });

      it('getValues returns false and alerts when ID is too short', () => {
        mountHtml();
        progressBar().setValues({ evaluation: true, evaluationID: 'abc' });
        const values = progressBar().getValues();
        expect(values).toBe(false);
        expect(globalThis.eXe.app.alert).toHaveBeenCalled();
      });

      it('addEvents toggles input disabled state when checkbox changes', () => {
        mountHtml();
        progressBar().addEvents();
        const checkbox = document.getElementById('eXeProgressReport');
        const input = document.getElementById('eXeProgressReportID');
        expect(input.disabled).toBe(true);
        checkbox.checked = true;
        globalThis.$(checkbox).trigger('change');
        expect(input.disabled).toBe(false);
        checkbox.checked = false;
        globalThis.$(checkbox).trigger('change');
        expect(input.disabled).toBe(true);
      });

      it('getContents interpolates eXeLearning.app.project.odeId as default identifier value', () => {
        const previousOdeId = globalThis.eXeLearning.app.project.odeId;
        globalThis.eXeLearning.app.project.odeId = 'PROJECT-123';
        try {
          const html = progressBar().getContents('/path/to/');
          expect(html).toContain('value="PROJECT-123"');
        } finally {
          globalThis.eXeLearning.app.project.odeId = previousOdeId;
        }
      });

      it('getContents falls back to empty value when odeId is missing', () => {
        const previousOdeId = globalThis.eXeLearning.app.project.odeId;
        globalThis.eXeLearning.app.project.odeId = '';
        try {
          const html = progressBar().getContents('/path/to/');
          expect(html).toContain('value=""');
        } finally {
          globalThis.eXeLearning.app.project.odeId = previousOdeId;
        }
      });

      it('getContents includes translation keys for the visible labels and help', () => {
        const html = progressBar().getContents('/path/to/');
        expect(html).toContain('Progress report');
        expect(html).toContain('Identifier');
        expect(html).toContain('Information');
        expect(html).toContain('You must indicate the ID');
      });

      it('getContents adds an aria-label on the checkbox for accessibility', () => {
        const html = progressBar().getContents('/path/to/');
        expect(html).toMatch(/<input[^>]*id="eXeProgressReport"[^>]*aria-label="Progress report"/);
      });

      it('getValues trims whitespace from evaluationID before validating', () => {
        mountHtml();
        document.getElementById('eXeProgressReport').checked = true;
        document.getElementById('eXeProgressReportID').value = '   PADDED   ';
        const values = progressBar().getValues();
        expect(values).toEqual({ evaluation: true, evaluationID: 'PADDED' });
      });

      it('getValues rejects an ID whose trimmed length is below 5 (boundary)', () => {
        mountHtml();
        document.getElementById('eXeProgressReport').checked = true;
        document.getElementById('eXeProgressReportID').value = '  ab  ';
        const values = progressBar().getValues();
        expect(values).toBe(false);
        expect(globalThis.eXe.app.alert).toHaveBeenCalled();
      });

      it('getValues accepts an ID with exactly 5 characters (boundary)', () => {
        mountHtml();
        document.getElementById('eXeProgressReport').checked = true;
        document.getElementById('eXeProgressReportID').value = 'ABCDE';
        const values = progressBar().getValues();
        expect(values).toEqual({ evaluation: true, evaluationID: 'ABCDE' });
        expect(globalThis.eXe.app.alert).not.toHaveBeenCalled();
      });

      it('getValues ignores ID length validation when evaluation is unchecked', () => {
        mountHtml();
        document.getElementById('eXeProgressReport').checked = false;
        document.getElementById('eXeProgressReportID').value = 'ab';
        const values = progressBar().getValues();
        expect(values).toEqual({ evaluation: false, evaluationID: 'ab' });
        expect(globalThis.eXe.app.alert).not.toHaveBeenCalled();
      });

      it('addEvents change handler keeps the input value intact when toggling the checkbox', () => {
        mountHtml();
        progressBar().setValues({ evaluation: true, evaluationID: 'KEEPME' });
        progressBar().addEvents();
        const checkbox = document.getElementById('eXeProgressReport');
        const input = document.getElementById('eXeProgressReportID');
        checkbox.checked = false;
        globalThis.$(checkbox).trigger('change');
        expect(input.value).toBe('KEEPME');
        expect(input.disabled).toBe(true);
      });
    });

    describe('passScore', () => {
      const passScore = () => globalThis.$exeIDevicesEdition.iDevice.gamification.passScore;

      const mountHtml = () => {
        document.body.innerHTML = passScore().getContents();
      };

      // common.js is not loaded here, so $exe stands in for it. The real one
      // reads the META in an exported page and the Y.Doc in the editor.
      const setGlobalValue = (value) => {
        globalThis.$exe = {
          passScore: {
            get: () => value,
            normalize: (raw) => {
              const parsed = parseFloat(raw);
              if (!isFinite(parsed)) return 5;
              return Math.round(Math.min(10, Math.max(0, parsed)) * 10) / 10;
            },
          },
        };
      };

      beforeEach(() => setGlobalValue(5));
      afterEach(() => {
        delete globalThis.$exe;
      });

      it('getContents renders the label, both radios and the hidden custom input', () => {
        const html = passScore().getContents();
        expect(html).toContain('Minimum score to pass the activity');
        expect(html).toContain('id="eXePassScoreGlobal"');
        expect(html).toContain('id="eXePassScoreCustom"');
        expect(html).toContain('id="eXePassScoreGlobalValue"');
        expect(html).toContain('id="eXePassScoreCustomOptions"');
        expect(html).toContain('Global value');
        expect(html).toContain('Customize');
        // The custom input is only revealed once the author asks for it.
        expect(html).toMatch(/id="eXePassScoreCustomOptions"[^>]*d-none/);
      });

      it('getContents declares the same 0-10 one-decimal domain as the project property', () => {
        const html = passScore().getContents();
        expect(html).toMatch(/id="eXePassScoreValue"[\s\S]*?min="0"/);
        expect(html).toMatch(/id="eXePassScoreValue"[\s\S]*?max="10"/);
        expect(html).toMatch(/id="eXePassScoreValue"[\s\S]*?step="0.1"/);
      });

      it('getContents shows the project value next to the global radio', () => {
        setGlobalValue(7.5);
        expect(passScore().getContents()).toContain('>7.5</span>');
      });

      it('getContents falls back to 5 when $exe is not available', () => {
        delete globalThis.$exe;
        expect(passScore().getContents()).toContain('>5</span>');
      });

      it.each([
        ['7.56', 7.6],
        [-2, 0],
        [42, 10],
        [0, 0],
        ['invalid', 5],
        [Infinity, 5],
      ])('round-trips a custom mark of %s without the shared helper as %s', (stored, expected) => {
        delete globalThis.$exe;
        mountHtml();

        passScore().setValues({ passScoreMode: 'custom', passScoreCustom: stored });

        expect(document.getElementById('eXePassScoreValue').value).toBe(String(expected));
        expect(passScore().getValues()).toEqual({ passScoreMode: 'custom', passScoreCustom: expected });
      });

      it('defaults to the global mode for an iDevice that has never been saved', () => {
        mountHtml();
        passScore().setValues();

        expect(document.getElementById('eXePassScoreGlobal').checked).toBe(true);
        expect(document.getElementById('eXePassScoreCustom').checked).toBe(false);
        expect(document.getElementById('eXePassScoreCustomOptions').classList.contains('d-none')).toBe(true);
      });

      it('setValues restores a customised iDevice and reveals its value', () => {
        mountHtml();
        passScore().setValues({ passScoreMode: 'custom', passScoreCustom: 7.5 });

        expect(document.getElementById('eXePassScoreCustom').checked).toBe(true);
        expect(document.getElementById('eXePassScoreValue').value).toBe('7.5');
        expect(document.getElementById('eXePassScoreCustomOptions').classList.contains('d-none')).toBe(false);
      });

      it('setValues repaints the global number from the project, not from the saved iDevice', () => {
        mountHtml();
        // The project moved to 8 after this iDevice was last saved.
        setGlobalValue(8);
        passScore().setValues({ passScoreMode: 'global', passScoreCustom: 3 });

        expect(document.getElementById('eXePassScoreGlobalValue').textContent).toBe('8');
      });

      it('setValues seeds the custom input with the project value when there is none stored', () => {
        setGlobalValue(7.5);
        mountHtml();
        passScore().setValues({ passScoreMode: 'global' });

        expect(document.getElementById('eXePassScoreValue').value).toBe('7.5');
      });

      it('getValues reports the global mode without inventing a stored value', () => {
        mountHtml();
        passScore().setValues({ passScoreMode: 'global' });

        expect(passScore().getValues()).toEqual({ passScoreMode: 'global', passScoreCustom: 5 });
      });

      it('getValues reports the customised mark', () => {
        mountHtml();
        passScore().setValues({ passScoreMode: 'custom', passScoreCustom: 7.5 });

        expect(passScore().getValues()).toEqual({ passScoreMode: 'custom', passScoreCustom: 7.5 });
      });

      it('getValues clamps a mark typed outside the domain', () => {
        mountHtml();
        document.getElementById('eXePassScoreCustom').checked = true;
        document.getElementById('eXePassScoreValue').value = '42';

        expect(passScore().getValues().passScoreCustom).toBe(10);
      });

      it('addEvents reveals and hides the custom input with the radios', () => {
        mountHtml();
        passScore().addEvents();
        const options = document.getElementById('eXePassScoreCustomOptions');
        const custom = document.getElementById('eXePassScoreCustom');
        const global = document.getElementById('eXePassScoreGlobal');

        custom.checked = true;
        globalThis.$(custom).trigger('change');
        expect(options.classList.contains('d-none')).toBe(false);

        global.checked = true;
        globalThis.$(global).trigger('change');
        expect(options.classList.contains('d-none')).toBe(true);
      });

      it('addEvents keeps the typed mark when switching back and forth', () => {
        mountHtml();
        passScore().addEvents();
        const input = document.getElementById('eXePassScoreValue');
        const custom = document.getElementById('eXePassScoreCustom');
        const global = document.getElementById('eXePassScoreGlobal');

        custom.checked = true;
        globalThis.$(custom).trigger('change');
        input.value = '7.5';
        global.checked = true;
        globalThis.$(global).trigger('change');
        custom.checked = true;
        globalThis.$(custom).trigger('change');

        expect(input.value).toBe('7.5');
      });

      it('addEvents repaints a field left empty on blur with the mark that will be saved', () => {
        mountHtml();
        passScore().addEvents();
        const input = document.getElementById('eXePassScoreValue');

        input.value = '';
        globalThis.$(input).trigger('blur');

        expect(input.value).toBe('5');
      });

      it('addEvents repaints an out-of-range field on blur', () => {
        mountHtml();
        passScore().addEvents();
        const input = document.getElementById('eXePassScoreValue');

        input.value = '42';
        globalThis.$(input).trigger('blur');

        expect(input.value).toBe('10');
      });

      /**
       * The two modes behave differently in a way the radio labels cannot
       * convey: one follows the project for the life of the content, the other
       * breaks away from it. The help note says so, like the progress report's.
       */
      describe('help note', () => {
        it('explains both modes', () => {
          const html = passScore().getContents('/idevice/path/');

          expect(html).toContain('Global value: the activity uses the mark set in the project properties');
          expect(html).toContain('Customize: the activity uses its own mark');
        });

      });
    });
  });

  describe('tabs', () => {
    const tabs = () => globalThis.$exeIDevicesEdition.iDevice.tabs;
    const render = (config, id = 'testForm') => {
      document.body.innerHTML = `<div id="wrapper">${tabs().getHtml(id, config)}</div>`;
      tabs().bind(id);
    };
    const buttons = (id = 'testForm') => [...document.querySelectorAll(`#${id}-tabs [data-exe-tab]`)];
    const tabNames = (id) => buttons(id).map((button) => button.getAttribute('data-exe-tab'));
    const activeNames = (id) =>
      buttons(id)
        .filter((button) => button.classList.contains('active'))
        .map((button) => button.getAttribute('data-exe-tab'));
    const button = (name, id = 'testForm') => document.getElementById(`${id}-tab-${name}`);
    const panel = (name, id = 'testForm') => document.getElementById(`${id}-panel-${name}`);
    const allTabs = {
      instructions: '',
      options: '',
      contents: '',
      passwords: true,
      feedback: true,
      after: true,
      grading: true,
      texts: {},
    };

    describe('getHtml', () => {
      it('shows only the tabs in the configuration', () => {
        render({ options: '<p>Options</p>', grading: true });

        expect(tabNames()).toEqual(['options', 'grading']);
      });

      it('always lays the tabs out in the shared order, whatever the order of the keys', () => {
        render(Object.fromEntries(Object.entries(allTabs).reverse()));

        expect(tabNames()).toEqual([
          'instructions',
          'options',
          'contents',
          'passwords',
          'feedback',
          'after',
          'grading',
          'texts',
        ]);
        expect(tabs().order).toEqual(tabNames());
      });

      it('has no tab for importing, exporting or generating questions', () => {
        render({ ...allTabs, importExport: true, ai: true });

        expect(tabNames()).not.toContain('importExport');
        expect(tabNames()).not.toContain('ai');
        // Their controls live in windows, not in any panel.
        expect(document.querySelector('#testForm-panels #eXeGameImportGame')).toBeNull();
        expect(document.querySelector('#testForm-panels #eXeEPromptArea')).toBeNull();
      });

      it('hides a tab given false, null or undefined, but shows one given an empty string', () => {
        render({ instructions: '', options: false, contents: null, after: undefined });

        expect(tabNames()).toEqual(['instructions']);
      });

      it('titles each shared tab', () => {
        render(allTabs);

        expect(buttons().map((tab) => tab.textContent.trim())).toEqual([
          'Instructions',
          'Options',
          'Activities',
          'Passwords',
          'Feedback',
          'After',
          'Grading',
          'Texts',
        ]);
      });

      it('fills each shared tab with its shared block', () => {
        render({
          instructions: 'Read this',
          passwords: true,
          feedback: true,
          after: true,
          grading: true,
          texts: { msgPlay: 'Play' },
        });

        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe('Read this');
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('input[name="eXeGameSCORM"]')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgPlay').value).toBe('Play');
      });

      it('opens every panel with a message saying what is done there, as plain text', () => {
        render(allTabs);

        tabNames().forEach((name) => {
          const info = panel(name).firstElementChild;
          // A paragraph, without the box and the icon it used to have.
          expect(info.tagName).toBe('P');
          expect(info.className).toBe('mt-0 mb-3');
          expect(info.querySelector('.auto-icon')).toBeNull();
          expect(panel(name).querySelector('.alert-info')).toBeNull();
          expect(info.textContent.trim().length).toBeGreaterThan(20);
        });
      });

      it('lets the iDevice word the message of a shared tab, and keeps the rest', () => {
        render({ options: '', contents: '', info: { contents: 'Write a <b>word</b> for each letter.', ai: 'x' } });

        expect(panel('contents').firstElementChild.innerHTML).toBe('Write a <b>word</b> for each letter.');
        expect(panel('contents').textContent).not.toContain('Add the questions');
        expect(panel('options').firstElementChild.textContent).toContain('Choose how the activity works');

        render({ contents: '', info: null });
        expect(panel('contents').firstElementChild.textContent).toContain('Add the questions');
      });

      it('explains the passwords once, in the message of the tab', () => {
        render({ passwords: true });

        expect(panel('passwords').firstElementChild.textContent).toContain('You might create a sequence of challenges');
        expect(panel('passwords').querySelectorAll('.exe-block-info')).toHaveLength(0);
      });

      it("puts the iDevice's own HTML in the Options and Content tabs", () => {
        render({ options: '<input id="myOption" />', contents: '<div id="myQuestions"></div>' });

        expect(panel('options').querySelector('#myOption')).not.toBeNull();
        expect(panel('contents').querySelector('#myQuestions')).not.toBeNull();
      });

      it('always titles the content tab Activities, and takes only HTML for it', () => {
        render({ contents: { title: 'Cards', content: '<p id="cards">x</p>' } });

        expect(button('contents').textContent.trim()).toBe('Activities');
        expect(panel('contents').querySelector('#cards')).toBeNull();
      });

      it('passes the grading options and the path on to the Grading tab', () => {
        render({ grading: { hidebutton: true }, path: '/idevice/' });

        expect(panel('grading').querySelector('#eXeGameSCORMblock').classList.contains('d-none')).toBe(true);
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
      });

      it('leaves the progress report out of the Grading tab without a path', () => {
        render({ grading: true });

        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).toBeNull();
      });

      it('adds the tabs of the iDevice after the shared ones', () => {
        render({
          options: '',
          extra: [{ name: 'csv', title: 'CSV', info: 'Import a CSV file.', content: '<p id="csv">x</p>' }],
        });

        expect(tabNames()).toEqual(['options', 'csv']);
        expect(button('csv').textContent.trim()).toBe('CSV');
        expect(panel('csv').firstElementChild.textContent).toContain('Import a CSV file.');
        expect(panel('csv').querySelector('#csv')).not.toBeNull();
      });

      it('opens a tab of the iDevice without a message when it gives none', () => {
        render({ extra: [{ name: 'csv', title: 'CSV', content: '<p id="csv">x</p>' }] });

        expect(panel('csv').children).toHaveLength(1);
        expect(panel('csv').firstElementChild.id).toBe('csv');
      });

      it('skips extra tabs without a valid name or that repeat one, and titles the rest by name', () => {
        render({
          options: '',
          extra: [null, { name: '1bad' }, { name: 'bad name' }, { name: 'options', title: 'Again' }, { name: 'csv' }],
        });

        expect(tabNames()).toEqual(['options', 'csv']);
        expect(button('options').textContent.trim()).toBe('Options');
        expect(button('csv').textContent.trim()).toBe('csv');
      });

      it('escapes the titles', () => {
        render({ extra: [{ name: 'own', title: '<img src="x">' }] });

        expect(button('own').querySelector('img')).toBeNull();
        expect(button('own').textContent.trim()).toBe('<img src="x">');
      });

      it('starts on Questions', () => {
        render({ options: '', contents: '', grading: true });

        expect(activeNames()).toEqual(['contents']);
        expect(panel('contents').classList.contains('active')).toBe(true);
        expect(panel('contents').classList.contains('show')).toBe(true);
        expect(panel('options').classList.contains('active')).toBe(false);
        expect(button('contents').getAttribute('aria-selected')).toBe('true');
        expect(button('contents').getAttribute('tabindex')).toBe('0');
        expect(button('options').getAttribute('aria-selected')).toBe('false');
        expect(button('options').getAttribute('tabindex')).toBe('-1');
      });

      it('starts on the first tab when there is no Questions tab', () => {
        render({ options: '', grading: true });

        expect(activeNames()).toEqual(['options']);
      });

      it('starts on the tab named by active, unless that tab is not shown', () => {
        render({ options: '', contents: '', active: 'options' });
        expect(activeNames()).toEqual(['options']);
        expect(panel('options').classList.contains('active')).toBe(true);

        render({ options: '', contents: '', active: 'grading' });
        expect(activeNames()).toEqual(['contents']);
      });

      it('links each tab and its panel for assistive technology', () => {
        render({ options: '', contents: '' });

        expect(document.getElementById('testForm-tabs').getAttribute('role')).toBe('tablist');
        buttons().forEach((tab) => {
          const name = tab.getAttribute('data-exe-tab');
          expect(tab.tagName).toBe('BUTTON');
          expect(tab.getAttribute('type')).toBe('button');
          expect(tab.getAttribute('role')).toBe('tab');
          expect(tab.getAttribute('aria-controls')).toBe(`testForm-panel-${name}`);
          expect(panel(name).getAttribute('role')).toBe('tabpanel');
          expect(panel(name).getAttribute('aria-labelledby')).toBe(`testForm-tab-${name}`);
        });
      });

      it('styles the tabs with Bootstrap classes only', () => {
        render({ options: '', contents: '' });

        const bootstrap = /^(nav|nav-tabs|nav-item|nav-link|active|show|tab-content|tab-pane|border|border-top-0|rounded-bottom|p-3|mb-3)$/;
        const elements = [
          document.getElementById('testForm-tabs'),
          ...document.querySelectorAll('#testForm-tabs li, #testForm-tabs button'),
          document.getElementById('testForm-panels'),
          ...document.querySelectorAll('#testForm-panels > .tab-pane'),
        ];
        elements.forEach((element) => {
          element.classList.forEach((klass) => expect(klass).toMatch(bootstrap));
        });
        expect(document.getElementById('testForm-tabs').className).toBe('nav nav-tabs');
        expect(document.getElementById('testForm-panels').classList.contains('tab-content')).toBe(true);
      });

      it('returns an empty string for an invalid id, a missing configuration or no tabs', () => {
        expect(tabs().getHtml('', { options: '' })).toBe('');
        expect(tabs().getHtml('1form', { options: '' })).toBe('');
        expect(tabs().getHtml('my form', { options: '' })).toBe('');
        expect(tabs().getHtml('a"b', { options: '' })).toBe('');
        expect(tabs().getHtml(null, { options: '' })).toBe('');
        expect(tabs().getHtml('testForm')).toBe('');
        expect(tabs().getHtml('testForm', null)).toBe('');
        expect(tabs().getHtml('testForm', {})).toBe('');
        expect(tabs().getHtml('testForm', { options: false })).toBe('');
      });
    });

    describe('show', () => {
      it('shows the named tab and hides the rest', () => {
        render({ options: '', contents: '', grading: true });

        expect(tabs().show('testForm', 'contents')).toBe(true);

        expect(activeNames()).toEqual(['contents']);
        expect(button('contents').getAttribute('aria-selected')).toBe('true');
        expect(button('contents').getAttribute('tabindex')).toBe('0');
        expect(button('options').getAttribute('aria-selected')).toBe('false');
        expect(button('options').getAttribute('tabindex')).toBe('-1');
        expect(panel('contents').classList.contains('active')).toBe(true);
        expect(panel('contents').classList.contains('show')).toBe(true);
        expect(panel('options').classList.contains('active')).toBe(false);
        expect(panel('options').classList.contains('show')).toBe(false);
      });

      it('returns false and changes nothing for a tab that is not there', () => {
        render({ options: '', contents: '' });

        expect(tabs().show('testForm', 'grading')).toBe(false);
        expect(tabs().show('otherForm', 'options')).toBe(false);
        expect(tabs().show('bad id', 'options')).toBe(false);
        expect(activeNames()).toEqual(['contents']);
      });

      it('only switches the tabs of its own form', () => {
        document.body.innerHTML =
          tabs().getHtml('formA', { options: '', contents: '' }) + tabs().getHtml('formB', { options: '', contents: '' });

        tabs().show('formA', 'options');

        expect(activeNames('formA')).toEqual(['options']);
        expect(activeNames('formB')).toEqual(['contents']);
        expect(panel('contents', 'formB').classList.contains('active')).toBe(true);
      });
    });

    describe('bind', () => {
      const press = (name, key) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        button(name).dispatchEvent(event);
        return event;
      };

      it('shows the tab that is clicked', () => {
        render({ options: '', contents: '', grading: true });

        button('grading').click();

        expect(activeNames()).toEqual(['grading']);
        expect(panel('grading').classList.contains('active')).toBe(true);
      });

      it('moves through the tabs with the arrow keys, wrapping at both ends', () => {
        render({ options: '', contents: '', grading: true });

        expect(press('options', 'ArrowRight').defaultPrevented).toBe(true);
        expect(activeNames()).toEqual(['contents']);
        expect(document.activeElement).toBe(button('contents'));

        press('contents', 'ArrowRight');
        press('grading', 'ArrowRight');
        expect(activeNames()).toEqual(['options']);

        press('options', 'ArrowLeft');
        expect(activeNames()).toEqual(['grading']);
        expect(document.activeElement).toBe(button('grading'));
      });

      it('jumps to the first and the last tab with Home and End', () => {
        render({ options: '', contents: '', grading: true });

        press('options', 'End');
        expect(activeNames()).toEqual(['grading']);

        press('grading', 'Home');
        expect(activeNames()).toEqual(['options']);
      });

      it('leaves any other key alone', () => {
        render({ options: '', contents: '' });

        expect(press('options', 'Enter').defaultPrevented).toBe(false);
        expect(activeNames()).toEqual(['contents']);
      });

      it('binds each handler once, however many times it is called', () => {
        render({ options: '', contents: '' });
        tabs().bind('testForm');
        tabs().bind('testForm');
        const show = vi.spyOn(tabs(), 'show');

        try {
          button('contents').click();

          expect(show).toHaveBeenCalledTimes(1);
        } finally {
          show.mockRestore();
        }
      });

      it('does nothing for an invalid id', () => {
        expect(() => tabs().bind('bad id')).not.toThrow();
      });
    });
  });

  /**
   * The Import, Export and Create with AI links of the Questions tab and the
   * windows they open. Bootstrap's Modal is not loaded in the tests: a stand-in
   * records what the code asks of it.
   */
  describe('Questions tab windows (gamification.share)', () => {
    const share = () => globalThis.$exeIDevicesEdition.iDevice.gamification.share;
    const tabs = () => globalThis.$exeIDevicesEdition.iDevice.tabs;
    const render = (config) => {
      document.body.innerHTML = `<div id="form">${tabs().getHtml('testForm', config)}</div>`;
      tabs().bind('testForm');
    };
    const link = (name) => document.querySelector(`#testForm-panel-contents [data-exe-share="${name}"]`);
    const links = () => [...document.querySelectorAll('#testForm-panel-contents [data-exe-share]')];
    const label = (element) => element.textContent.replace(element.querySelector('.auto-icon').textContent, '').trim();
    const modal = (name) => document.getElementById(`eXeShareModal-${name}`);
    const fakeModal = () => {
      const instances = new Map();
      return {
        getOrCreateInstance: vi.fn((el) => {
          if (!instances.has(el)) {
            instances.set(el, {
              show: vi.fn(() => el.classList.add('show')),
              hide: vi.fn(() => {
                el.classList.remove('show');
                el.dispatchEvent(new Event('hidden.bs.modal'));
              }),
              dispose: vi.fn(() => instances.delete(el)),
            });
          }
          return instances.get(el);
        }),
        getInstance: vi.fn((el) => instances.get(el) || null),
      };
    };
    let previousBootstrap;
    let Modal;

    beforeEach(() => {
      previousBootstrap = window.bootstrap;
      Modal = fakeModal();
      window.bootstrap = { Modal };
    });

    afterEach(() => {
      window.bootstrap = previousBootstrap;
      document.body.innerHTML = '';
    });

    it('puts Import, Export and Create with AI on the right of the Activities tab, above its form', () => {
      render({ contents: '<div id="questionForm"></div>' });

      const panel = document.getElementById('testForm-panel-contents');
      expect([...panel.children].map((child) => child.getAttribute('role') || child.id || child.tagName)).toEqual([
        'P',
        'toolbar',
        'questionForm',
      ]);
      expect(panel.querySelector('[role="toolbar"]').classList.contains('justify-content-end')).toBe(true);
      expect(panel.querySelector('[role="toolbar"]').getAttribute('aria-label')).toBe('Activities');
      expect(links().map((element) => element.getAttribute('data-exe-share'))).toEqual(['import', 'export', 'ai']);
      expect(links().map(label)).toEqual(['Import', 'Export', 'Create with AI']);
      expect(links().map((element) => element.querySelector('.auto-icon').textContent)).toEqual([
        'upload',
        'download',
        'auto_awesome',
      ]);
      links().forEach((element) => {
        expect(element.getAttribute('type')).toBe('button');
        expect(element.getAttribute('aria-haspopup')).toBe('dialog');
        expect(element.getAttribute('aria-controls')).toBe(`eXeShareModal-${element.getAttribute('data-exe-share')}`);
        expect(element.querySelector('.auto-icon').getAttribute('aria-hidden')).toBe('true');
      });
    });

    it('leaves Import or Export out for an iDevice without them, and all of them with share: false', () => {
      render({ contents: '', share: { exportQuestions: false } });
      expect(links().map((element) => element.getAttribute('data-exe-share'))).toEqual(['import', 'ai']);
      expect(modal('export')).toBeNull();

      render({ contents: '', share: { importQuestions: false, exportQuestions: false } });
      expect(links().map((element) => element.getAttribute('data-exe-share'))).toEqual(['ai']);
      expect(modal('import')).toBeNull();

      render({ contents: '', share: false });
      expect(links()).toHaveLength(0);
      expect(document.querySelector('.exe-share-modal')).toBeNull();
    });

    it('lets an iDevice word the message of the Import window, and keeps the shared one otherwise', () => {
      render({ contents: '', share: { importInfo: 'Only txt files.' } });
      expect(modal('import').querySelector('.modal-body').firstElementChild.textContent).toBe('Only txt files.');

      render({ contents: '' });
      expect(modal('import').querySelector('.modal-body').firstElementChild.textContent).toContain(
        'txt or xml (Moodle)'
      );
    });

    it('gives no links to a form without a Questions tab', () => {
      render({ options: '' });

      expect(document.querySelector('[data-exe-share]')).toBeNull();
      expect(document.querySelector('.exe-share-modal')).toBeNull();
    });

    it('builds the AI prompt for the game and the options given', () => {
      const build = vi.spyOn(share(), 'buildIAPromptText');
      try {
        render({ contents: '', share: { type: 10, options: { numLevels: 3 } } });

        expect(build).toHaveBeenCalledWith(10, { numLevels: 3 });
      } finally {
        build.mockRestore();
      }
    });

    it('opens every window with its title, a close button and a message saying what it does', () => {
      render({ contents: '' });

      const titles = { import: 'Import', export: 'Export', ai: 'Create with AI' };
      share().windows.forEach((name) => {
        const el = modal(name);
        const title = el.querySelector('.modal-title');
        expect(label(title)).toBe(titles[name]);
        expect(el.getAttribute('aria-labelledby')).toBe(title.id);
        expect(el.querySelector('.btn-close').getAttribute('data-bs-dismiss')).toBe('modal');
        expect(el.classList.contains('fade')).toBe(false);
        // The same plain message that opens each tab.
        const info = el.querySelector('.modal-body').firstElementChild;
        expect(info.tagName).toBe('P');
        expect(info.className).toBe('mt-0 mb-3');
        expect(info.textContent.trim().length).toBeGreaterThan(20);
      });
      expect(modal('import').querySelector('#eXeGameImportGame')).not.toBeNull();
      expect(modal('export').querySelector('#eXeGameExportQuestions')).not.toBeNull();
      expect(modal('ai').querySelector('#eXeEPromptArea')).not.toBeNull();
      // The application gives all its centered modals one width; the AI
      // window scrolls when the screen is short.
      expect(modal('import').querySelector('.modal-dialog').className.trim()).toBe('modal-dialog modal-dialog-centered');
      expect(modal('ai').querySelector('.modal-dialog').classList.contains('modal-dialog-scrollable')).toBe(true);
    });

    it('moves the windows to <body> when the tabs are bound', () => {
      render({ contents: '' });

      share().windows.forEach((name) => expect(modal(name).parentElement).toBe(document.body));
      expect(document.querySelector('#form .exe-share-modal')).toBeNull();
    });

    it('replaces the windows an earlier form left in <body>', () => {
      render({ contents: '' });
      const earlier = modal('import');

      document.getElementById('form').innerHTML = tabs().getHtml('testForm', { contents: '' });
      tabs().bind('testForm');

      expect(document.querySelectorAll('[id="eXeShareModal-import"]')).toHaveLength(1);
      expect(modal('import')).not.toBe(earlier);
      expect(earlier.isConnected).toBe(false);
    });

    it('opens the window of the link clicked, and gives the focus back to the link when it closes', () => {
      render({ contents: '' });

      link('export').click();
      expect(Modal.getOrCreateInstance).toHaveBeenCalledWith(modal('export'));
      expect(modal('export').classList.contains('show')).toBe(true);

      share().close('export');
      expect(modal('export').classList.contains('show')).toBe(false);
      expect(document.activeElement).toBe(link('export'));
    });

    it('closes Import once a file is chosen, and Export once the button is pressed', () => {
      render({ contents: '' });

      link('import').click();
      $('#eXeGameImportGame').trigger('change');
      expect(modal('import').classList.contains('show')).toBe(false);

      link('export').click();
      $('#eXeGameExportQuestions').trigger('click');
      expect(modal('export').classList.contains('show')).toBe(false);
    });

    it('opens nothing without the window or without Bootstrap, and closes a window never opened quietly', () => {
      render({ contents: '' });

      expect(share().open('missing')).toBe(false);
      window.bootstrap = undefined;
      expect(share().open('import')).toBe(false);
      expect(() => share().close('import')).not.toThrow();
      window.bootstrap = { Modal };
      expect(() => share().close('import')).not.toThrow();
      expect(() => share().close('missing')).not.toThrow();
    });

    it('removes the windows, with their Bootstrap instances, when the edition closes', () => {
      const disposers = [];
      const previousLifecycle = window.$exeEditionLifecycle;
      window.$exeEditionLifecycle = {
        isActive: () => true,
        own: (dispose) => {
          disposers.push(dispose);
          return dispose;
        },
        addEventListener: (target, type, handler) => {
          target.addEventListener(type, handler);
          disposers.push(() => target.removeEventListener(type, handler));
        },
      };
      try {
        render({ contents: '' });
        link('ai').click();
        const instance = Modal.getInstance(modal('ai'));

        disposers.forEach((dispose) => dispose());

        expect(instance.hide).toHaveBeenCalled();
        expect(instance.dispose).toHaveBeenCalled();
        expect(document.querySelector('.exe-share-modal')).toBeNull();
        // The listener for the application's modals went with them.
        const yieldTo = vi.spyOn(share(), 'yieldTo');
        try {
          document.body.dispatchEvent(new Event('show.bs.modal', { bubbles: true }));
          expect(yieldTo).not.toHaveBeenCalled();
        } finally {
          yieldTo.mockRestore();
        }
      } finally {
        window.$exeEditionLifecycle = previousLifecycle;
      }
    });

    it('steps aside for a modal of the application, and comes back once it is closed', () => {
      render({ contents: '' });
      const alertModal = document.createElement('div');
      alertModal.className = 'modal';
      document.body.appendChild(alertModal);
      link('ai').click();
      const focusLink = vi.spyOn(link('ai'), 'focus');

      // An alert of the application, about the questions just pasted.
      alertModal.dispatchEvent(new Event('show.bs.modal', { bubbles: true }));
      expect(modal('ai').classList.contains('show')).toBe(false);
      // Stepping aside does not send the focus back to the link.
      expect(focusLink).not.toHaveBeenCalled();

      alertModal.dispatchEvent(new Event('hidden.bs.modal'));
      expect(modal('ai').classList.contains('show')).toBe(true);

      // Its own windows do not make each other step aside.
      modal('import').dispatchEvent(new Event('show.bs.modal', { bubbles: true }));
      expect(modal('ai').classList.contains('show')).toBe(true);
    });

    it('listens for the application modals once, however many forms are mounted', () => {
      const yieldTo = vi.spyOn(share(), 'yieldTo');
      try {
        render({ contents: '' });
        document.getElementById('form').innerHTML = tabs().getHtml('testForm', { contents: '' });
        tabs().bind('testForm');

        document.body.dispatchEvent(new Event('show.bs.modal', { bubbles: true }));

        expect(yieldTo).toHaveBeenCalledTimes(1);
      } finally {
        yieldTo.mockRestore();
      }
    });

    it('steps aside for nothing without Bootstrap', () => {
      render({ contents: '' });
      window.bootstrap = undefined;

      expect(() => share().yieldTo(document.body)).not.toThrow();
    });

    it('removes a window without Bootstrap too, and mounts nothing when there is nothing to mount', () => {
      render({ contents: '' });
      window.bootstrap = undefined;

      share().removeModal(modal('import'));
      expect(modal('import')).toBeNull();

      document.body.innerHTML = '';
      expect(() => share().mount()).not.toThrow();
    });
  });

  describe('gamification.common', () => {
    describe('getLanguageContents', () => {
      const render = (fields) => {
        document.body.innerHTML = globalThis.$exeIDevicesEdition.iDevice.gamification.common.getLanguageContents(fields);
      };
      const label = (id) => document.querySelector(`label[for="${id}"]`).textContent;

      it('uses a string field as both label and default value, keyed by the field', () => {
        render({ msgPlay: 'Play', msgEnd: 'End' });

        expect(document.getElementById('ci18n_msgPlay').value).toBe('Play');
        expect(label('ci18n_msgPlay')).toBe('Play');
        expect(document.getElementById('ci18n_msgEnd').getAttribute('name')).toBe('ci18n_msgEnd');
      });

      it('takes label and value from a two-item field, and both from a one-item field', () => {
        render([['Label', 'Value'], ['SingleLabel']]);

        expect(label('ci18n_0')).toBe('Label');
        expect(document.getElementById('ci18n_0').value).toBe('Value');
        expect(label('ci18n_1')).toBe('SingleLabel');
        expect(document.getElementById('ci18n_1').value).toBe('SingleLabel');
      });

      it('escapes labels and values, so a quote cannot cut the value short', () => {
        render({ msgQuote: ['<b>Say</b>', 'He said "hi" & left'] });

        expect(document.querySelector('label b')).toBeNull();
        expect(label('ci18n_msgQuote')).toBe('<b>Say</b>');
        expect(document.getElementById('ci18n_msgQuote').value).toBe('He said "hi" & left');
      });

      it('lays the fields out in two columns of the Bootstrap grid, and nothing else', () => {
        render({ msgPlay: 'Play' });

        const row = document.querySelector('.row');
        expect([...row.classList]).toEqual(['row', 'row-cols-1', 'row-cols-md-2', 'g-3']);
        expect(row.querySelector('.col.ci18n #ci18n_msgPlay')).not.toBeNull();
        // The introduction is the message of the Texts tab.
        expect(document.body.children).toHaveLength(1);
      });

      it('renders an empty grid when there are no fields', () => {
        render(undefined);

        expect(document.querySelectorAll('.ci18n')).toHaveLength(0);
        expect(document.querySelector('.row')).not.toBeNull();
      });

      it('fills the same ids setLanguageTabValues writes', () => {
        render({ msgPlay: 'Play' });

        globalThis.$exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues({ msgPlay: 'Start' });

        expect(document.getElementById('ci18n_msgPlay').value).toBe('Start');
      });
    });

    it('setLanguageTabValues sets values for object', () => {
      const input = document.createElement('input');
      input.id = 'ci18n_testKey';
      document.body.appendChild(input);

      globalThis.$exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues({ testKey: 'TestValue' });
      expect(input.value).toBe('TestValue');
    });

    it('setLanguageTabValues does nothing for empty values', () => {
      const input = document.createElement('input');
      input.id = 'ci18n_emptyKey';
      input.value = 'original';
      document.body.appendChild(input);

      globalThis.$exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues({ emptyKey: '' });
      expect(input.value).toBe('original');
    });

    it('setLanguageTabValues handles non-object input', () => {
      // Should not throw
      globalThis.$exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues(null);
      globalThis.$exeIDevicesEdition.iDevice.gamification.common.setLanguageTabValues('string');
    });

  });

  describe('gamification.itinerary', () => {
    it('getContents returns HTML', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.getContents();
      expect(result).toContain('eXeGameShowCodeAccess');
      expect(result).toContain('eXeGameShowClue');
    });

    it('getValues returns false when clue is checked but empty', () => {
      document.body.innerHTML = `
        <input type="checkbox" id="eXeGameShowClue" checked />
        <input type="text" id="eXeGameClue" value="" />
        <select id="eXeGamePercentajeClue"><option value="40" selected>40%</option></select>
        <input type="checkbox" id="eXeGameShowCodeAccess" />
        <input type="text" id="eXeGameCodeAccess" value="" />
        <input type="text" id="eXeGameMessageCodeAccess" value="" />
      `;

      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.getValues();
      expect(result).toBe(false);
      expect(globalThis.eXe.app.alert).toHaveBeenCalled();
    });

    it('getValues returns false when code access is checked but empty', () => {
      document.body.innerHTML = `
        <input type="checkbox" id="eXeGameShowClue" />
        <input type="text" id="eXeGameClue" value="" />
        <select id="eXeGamePercentajeClue"><option value="40" selected>40%</option></select>
        <input type="checkbox" id="eXeGameShowCodeAccess" checked />
        <input type="text" id="eXeGameCodeAccess" value="" />
        <input type="text" id="eXeGameMessageCodeAccess" value="" />
      `;

      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.getValues();
      expect(result).toBe(false);
    });

    it('getValues returns false when code access message is empty', () => {
      document.body.innerHTML = `
        <input type="checkbox" id="eXeGameShowClue" />
        <input type="text" id="eXeGameClue" value="" />
        <select id="eXeGamePercentajeClue"><option value="40" selected>40%</option></select>
        <input type="checkbox" id="eXeGameShowCodeAccess" checked />
        <input type="text" id="eXeGameCodeAccess" value="code123" />
        <input type="text" id="eXeGameMessageCodeAccess" value="" />
      `;

      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.getValues();
      expect(result).toBe(false);
    });

    it('getValues returns object when all valid', () => {
      // Create elements using jQuery and set values properly
      document.body.innerHTML = `
        <input type="checkbox" id="eXeGameShowClue" />
        <input type="text" id="eXeGameClue" value="" />
        <select id="eXeGamePercentajeClue">
          <option value="40">40%</option>
          <option value="50">50%</option>
          <option value="60">60%</option>
        </select>
        <input type="checkbox" id="eXeGameShowCodeAccess" />
        <input type="text" id="eXeGameCodeAccess" value="" />
        <input type="text" id="eXeGameMessageCodeAccess" value="" />
      `;

      // Set values using jQuery for consistency
      $('#eXeGameShowClue').prop('checked', true);
      $('#eXeGameClue').val('clue text');
      $('#eXeGamePercentajeClue').val('50');
      $('#eXeGameShowCodeAccess').prop('checked', true);
      $('#eXeGameCodeAccess').val('code123');
      $('#eXeGameMessageCodeAccess').val('Enter the code');

      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.getValues();
      expect(result.showClue).toBe(true);
      expect(result.clueGame).toBe('clue text');
      expect(result.percentageClue).toBe(50);
      expect(result.showCodeAccess).toBe(true);
      expect(result.codeAccess).toBe('code123');
      expect(result.messageCodeAccess).toBe('Enter the code');
    });

    it('setValues sets all form values', () => {
      document.body.innerHTML = `
        <input type="checkbox" id="eXeGameShowClue" />
        <div id="eXeGameShowClueOptions" style="display:none"></div>
        <input type="text" id="eXeGameClue" disabled />
        <select id="eXeGamePercentajeClue" disabled><option value="40">40%</option><option value="50">50%</option></select>
        <input type="checkbox" id="eXeGameShowCodeAccess" />
        <div id="eXeGameShowCodeAccessOptions" style="display:none"></div>
        <input type="text" id="eXeGameCodeAccess" disabled />
        <input type="text" id="eXeGameMessageCodeAccess" disabled />
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.setValues({
        showClue: true,
        clueGame: 'my clue',
        percentageClue: 50,
        showCodeAccess: true,
        codeAccess: 'mycode',
        messageCodeAccess: 'my message'
      });

      expect($('#eXeGameShowClue').is(':checked')).toBe(true);
      expect($('#eXeGameClue').val()).toBe('my clue');
      expect($('#eXeGameShowCodeAccessOptions').css('display')).toBe('flex');
    });

    it('addEvents sets up change handlers', () => {
      document.body.innerHTML = `
        <input type="checkbox" id="eXeGameShowClue" />
        <div id="eXeGameShowClueOptions" style="display:none"></div>
        <input type="text" id="eXeGameClue" disabled />
        <select id="eXeGamePercentajeClue" disabled></select>
        <input type="checkbox" id="eXeGameShowCodeAccess" />
        <div id="eXeGameShowCodeAccessOptions" style="display:none"></div>
        <input type="text" id="eXeGameCodeAccess" disabled />
        <input type="text" id="eXeGameMessageCodeAccess" disabled />
        <a id="eXeGameItineraryOptionsLnk" href="#"></a>
        <div id="eXeGameItineraryOptions" style="display:none"></div>
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.itinerary.addEvents();

      // Trigger showClue change - enables inputs
      $('#eXeGameShowClue').prop('checked', true).trigger('change');
      expect($('#eXeGameClue').prop('disabled')).toBe(false);
      expect($('#eXeGamePercentajeClue').prop('disabled')).toBe(false);

      // Trigger showClue uncheck - disables inputs
      $('#eXeGameShowClue').prop('checked', false).trigger('change');
      expect($('#eXeGameClue').prop('disabled')).toBe(true);
      expect($('#eXeGamePercentajeClue').prop('disabled')).toBe(true);

      // Trigger showCodeAccess change - enables inputs
      $('#eXeGameShowCodeAccess').prop('checked', true).trigger('change');
      expect($('#eXeGameCodeAccess').prop('disabled')).toBe(false);
      expect($('#eXeGameMessageCodeAccess').prop('disabled')).toBe(false);

      // Trigger showCodeAccess uncheck
      $('#eXeGameShowCodeAccess').prop('checked', false).trigger('change');
      expect($('#eXeGameCodeAccess').prop('disabled')).toBe(true);

      // Click itinerary options link - should not throw
      $('#eXeGameItineraryOptionsLnk').trigger('click');
    });
  });

  describe('gamification.feedback', () => {
    const feedback = () => globalThis.$exeIDevicesEdition.iDevice.gamification.feedback;
    const mount = () => {
      document.body.innerHTML = feedback().getContents();
    };
    const checkbox = () => document.getElementById('eXeGameHasFeedBack');
    const percentage = () => document.getElementById('eXeGamePercentajeFB');
    const editorBlock = () => document.getElementById('eXeGameFeedbackP');
    const textarea = () => document.getElementById('eXeGameFeedBackEditor');
    const withEditor = (editor, run) => {
      const previous = globalThis.tinymce;
      globalThis.tinymce = { majorVersion: 5, get: vi.fn((id) => (id === 'eXeGameFeedBackEditor' ? editor : null)) };
      try {
        run();
      } finally {
        globalThis.tinymce = previous;
      }
    };

    it('starts switched off, with the percentage disabled and the editor hidden', () => {
      mount();

      expect(checkbox().checked).toBe(false);
      expect(percentage().disabled).toBe(true);
      expect(percentage().value).toBe('100');
      expect(editorBlock().classList.contains('d-none')).toBe(true);
      expect(textarea().classList.contains('exe-html-editor')).toBe(true);
    });

    it('labels every control', () => {
      mount();

      ['eXeGameHasFeedBack', 'eXeGamePercentajeFB', 'eXeGameFeedBackEditor'].forEach((id) => {
        expect(document.querySelector(`label[for="${id}"]`)).not.toBeNull();
      });
    });

    describe('setValues', () => {
      it('switches the feedback on with its percentage and message', () => {
        mount();

        feedback().setValues({ feedBack: true, percentajeFB: 60, textFeedBack: '<p>Well done</p>' });

        expect(checkbox().checked).toBe(true);
        expect(percentage().value).toBe('60');
        expect(percentage().disabled).toBe(false);
        expect(editorBlock().classList.contains('d-none')).toBe(false);
        expect(textarea().value).toBe('<p>Well done</p>');
      });

      it('takes the "true" string some saved data carries as on', () => {
        mount();

        feedback().setValues({ feedBack: 'true' });

        expect(checkbox().checked).toBe(true);
      });

      it('switches it off and leaves the message alone when none is given', () => {
        mount();
        feedback().setValues({ feedBack: true, textFeedBack: 'kept' });

        feedback().setValues({ feedBack: false, percentajeFB: 40 });

        expect(checkbox().checked).toBe(false);
        expect(percentage().value).toBe('40');
        expect(percentage().disabled).toBe(true);
        expect(editorBlock().classList.contains('d-none')).toBe(true);
        expect(textarea().value).toBe('kept');
      });

      it('keeps the percentage between 5 and 100, and makes it 100 when it is not a number', () => {
        mount();

        feedback().setValues({ feedBack: true, percentajeFB: 0 });
        expect(percentage().value).toBe('5');
        feedback().setValues({ feedBack: true, percentajeFB: 250 });
        expect(percentage().value).toBe('100');
        feedback().setValues({ feedBack: true, percentajeFB: 'abc' });
        expect(percentage().value).toBe('100');
      });

      it('falls back to switched off and 100% without data', () => {
        mount();

        feedback().setValues();

        expect(checkbox().checked).toBe(false);
        expect(percentage().value).toBe('100');
      });

      it('writes the message into TinyMCE once it has started', () => {
        const editor = { initialized: true, setContent: vi.fn(), getContent: vi.fn() };
        withEditor(editor, () => {
          mount();

          feedback().setValues({ feedBack: true, textFeedBack: 'Hi' });

          expect(editor.setContent).toHaveBeenCalledWith('Hi');
          expect(textarea().value).toBe('');
        });
      });
    });

    describe('getValues', () => {
      it('returns the feedback as the games save it', () => {
        mount();
        feedback().setValues({ feedBack: true, percentajeFB: 70, textFeedBack: 'Bravo' });

        expect(feedback().getValues()).toEqual({ feedBack: true, percentajeFB: 70, textFeedBack: 'Bravo' });
      });

      it('reads the message from TinyMCE once it has started', () => {
        const editor = { initialized: true, setContent: vi.fn(), getContent: vi.fn(() => '<p>From the editor</p>') };
        withEditor(editor, () => {
          mount();
          checkbox().checked = true;

          expect(feedback().getValues().textFeedBack).toBe('<p>From the editor</p>');
        });
      });

      it('refuses an empty message while the feedback is on, and says why', () => {
        mount();
        feedback().setValues({ feedBack: true, textFeedBack: '   ' });

        expect(feedback().getValues()).toBe(false);
        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');
      });

      it('accepts an empty message while the feedback is off', () => {
        mount();

        expect(feedback().getValues()).toEqual({ feedBack: false, percentajeFB: 100, textFeedBack: '' });
        expect(globalThis.eXe.app.alert).not.toHaveBeenCalled();
      });

      it('keeps a typed percentage between 5 and 100', () => {
        mount();
        feedback().setValues({ feedBack: true, textFeedBack: 'x' });
        percentage().value = '300';

        expect(feedback().getValues().percentajeFB).toBe(100);
      });
    });

    describe('getText and setText', () => {
      it('read and write the textarea before TinyMCE starts', () => {
        mount();

        feedback().setText('<p>Bravo</p>');

        expect(textarea().value).toBe('<p>Bravo</p>');
        expect(feedback().getText()).toBe('<p>Bravo</p>');
      });

      it('read and write the editor once TinyMCE has started', () => {
        const editor = { initialized: true, setContent: vi.fn(), getContent: vi.fn(() => '<p>From the editor</p>') };
        withEditor(editor, () => {
          mount();

          feedback().setText('<p>New</p>');

          expect(editor.setContent).toHaveBeenCalledWith('<p>New</p>');
          expect(textarea().value).toBe('');
          expect(feedback().getText()).toBe('<p>From the editor</p>');
        });
      });

      it('write the textarea while TinyMCE is still starting, which it loads when ready', () => {
        // The iDevice loads its saved data while the shared editors are still
        // starting: content given to the editor then would be lost.
        const editor = { initialized: false, setContent: vi.fn(), getContent: vi.fn(() => '') };
        withEditor(editor, () => {
          mount();

          feedback().setText('<p>Saved message</p>');

          expect(editor.setContent).not.toHaveBeenCalled();
          expect(textarea().value).toBe('<p>Saved message</p>');
          expect(feedback().getText()).toBe('<p>Saved message</p>');
        });
      });

      it('give an empty message when there is no editor at all', () => {
        document.body.innerHTML = '';

        expect(feedback().getText()).toBe('');
      });
    });

    describe('setRequired', () => {
      it('locks the switch on and shows the editor while the feedback is compulsory', () => {
        mount();

        feedback().setRequired(true);

        expect(feedback().isRequired()).toBe(true);
        expect(checkbox().checked).toBe(true);
        expect(checkbox().disabled).toBe(true);
        expect(percentage().disabled).toBe(false);
        expect(editorBlock().classList.contains('d-none')).toBe(false);
      });

      it("gives the author's own choice back when the feedback is optional again", () => {
        mount();

        feedback().setRequired(true);
        feedback().setRequired(false);
        expect(feedback().isRequired()).toBe(false);
        expect(checkbox().checked).toBe(false);
        expect(checkbox().disabled).toBe(false);
        expect(editorBlock().classList.contains('d-none')).toBe(true);

        feedback().setValues({ feedBack: true });
        feedback().setRequired(true);
        feedback().setRequired(false);
        expect(checkbox().checked).toBe(true);
        expect(editorBlock().classList.contains('d-none')).toBe(false);
      });

      it('changes nothing when asked for the state it is already in', () => {
        mount();
        feedback().setValues({ feedBack: true });

        feedback().setRequired(false);
        expect(checkbox().checked).toBe(true);

        feedback().setRequired(true);
        feedback().setRequired(true);
        feedback().setRequired(false);
        expect(checkbox().checked).toBe(true);
      });

      it("keeps the switch on while compulsory and takes loaded data as the author's choice", () => {
        mount();
        feedback().setRequired(true);

        feedback().setValues({ feedBack: false, percentajeFB: 40, textFeedBack: 'x' });
        expect(checkbox().checked).toBe(true);
        expect(percentage().disabled).toBe(false);
        expect(percentage().value).toBe('40');

        feedback().setRequired(false);
        expect(checkbox().checked).toBe(false);
      });

      it("asks for the message while compulsory, and saves the author's choice", () => {
        mount();
        feedback().setRequired(true);

        expect(feedback().getValues()).toBe(false);
        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');

        feedback().setValues({ textFeedBack: 'Well done' });
        expect(feedback().getValues()).toEqual({ feedBack: false, percentajeFB: 100, textFeedBack: 'Well done' });
      });
    });

    describe('addEvents', () => {
      it('shows the editor and enables the percentage while the feedback is on', () => {
        mount();
        feedback().addEvents();

        checkbox().checked = true;
        checkbox().dispatchEvent(new Event('change', { bubbles: true }));
        expect(editorBlock().classList.contains('d-none')).toBe(false);
        expect(percentage().disabled).toBe(false);

        checkbox().checked = false;
        checkbox().dispatchEvent(new Event('change', { bubbles: true }));
        expect(editorBlock().classList.contains('d-none')).toBe(true);
        expect(percentage().disabled).toBe(true);
      });

      it('brings the percentage back between 5 and 100 when the author leaves the field', () => {
        mount();
        feedback().addEvents();

        percentage().value = '0';
        $(percentage()).trigger('focusout');

        expect(percentage().value).toBe('5');
      });
    });
  });

  describe('gamification.scorm', () => {
    it('init sets default values and adds events', () => {
      document.body.innerHTML = `
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" />
        <span id="eXeGameSCORgame"></span>
        <span id="eXeGameSCORgameAuto"></span>
        <div id="eXeGameSCORMPercentaje"></div>
        <div id="eXeGameSCORMinstructionsButton"></div>
        <div id="eXeGameSCORMinstructionsAuto"></div>
        <input type="text" id="eXeGameSCORMbuttonText" />
        <input type="number" id="eXeGameSCORMWeight" />
        <input type="checkbox" id="eXeGameSCORMRepeatActivity" />
        <input type="checkbox" id="eXeGameSCORMRepeatActivityAuto" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.init();
      expect($('#eXeGameSCORMNoSave').is(':checked')).toBe(true);
    });

    it('getContents returns the Grading controls without a tab around them', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.getContents();
      expect(result).toContain('eXeGameSCORM');
      expect(result).not.toContain('exe-form-tab');
    });

    it('getContents with hidebutton applies d-none class to button block', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.getContents(null, {
        hidebutton: true,
      });
      expect(result).toContain('id="eXeGameSCORMblock"');
      expect(result).toContain('d-none');
    });

    it('getContents with onlybutton changes message', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.getContents(null, {
        onlybutton: true,
      });
      expect(result).toContain('Save the score');
    });

    /**
     * The tab used to be the SCORM tab, with the pass score and the progress
     * report sitting loose in each iDevice's general options. It is now the
     * Grading tab and composes all three, so the layout is decided once
     * rather than thirty-four times.
     */
    describe('Grading tab', () => {
      const getContents = (...args) =>
        globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.getContents(...args);

      it('is titled Grading, not SCORM', () => {
        // Not "Evaluation": the iDevice menu already has an "Assessment and
        // tracking" category, and this tab is narrower than either -- it is
        // about the mark and what becomes of it.
        document.body.innerHTML = globalThis.$exeIDevicesEdition.iDevice.tabs.getHtml('gradingForm', { grading: true });
        expect(document.getElementById('gradingForm-tab-grading').textContent.trim()).toBe('Grading');
      });

      it('keeps SCORM as a section inside it', () => {
        const result = getContents();
        expect(result).toContain('exe-evaluation-section-title');
        expect(result).toContain('>SCORM<');
      });

      it('renders the three blocks in order: SCORM, progress report, pass score', () => {
        const result = getContents('/idevice/path/');

        const scormAt = result.indexOf('eXeGameSCORMNoSave');
        const reportAt = result.indexOf('eXeProgressReport');
        const passScoreAt = result.indexOf('eXePassScoreGlobal');

        expect(scormAt).toBeGreaterThan(-1);
        expect(reportAt).toBeGreaterThan(scormAt);
        expect(passScoreAt).toBeGreaterThan(reportAt);
      });

      it('heads all three sections the same way', () => {
        const result = getContents('/idevice/path/');
        const headings = result.match(/class="exe-evaluation-section-title"/g) ?? [];

        // The pass score used to be introduced by a plain paragraph, which read
        // as a stray label next to two headed sections.
        expect(headings).toHaveLength(3);
        expect(result).toContain('>SCORM<');
        expect(result).toContain('>Progress report<');
        expect(result).toContain('>Minimum score to pass the activity<');
      });

      it('leaves the progress report out when the iDevice passes no path', () => {
        // Passing a path still opts into the progress report for compatibility.
        const result = getContents();

        expect(result).not.toContain('eXeProgressReport');
        expect(result).not.toContain('>Progress report<');
      });

      /**
       * The weight is a relative share, not a percentage of anything: the
       * registry computes the page score as sum(score * weight) / sum(weights)
       * (exe-scorm12-activities.js, aggregateScore). Nothing on screen says so,
       * and an author reading "%" next to a field naturally assumes otherwise.
       */
      describe('weight help note', () => {
        it('explains that what counts is the proportion between weights', () => {
          const result = getContents('/idevice/path/');

          expect(result).toContain('proportion between the weights');
          expect(result).toContain('count 40%, 40% and 20%');
          expect(result).toContain('left out of the calculation');
        });

      });

      /**
       * The three modes differ in ways the labels cannot carry: whether the
       * learner has to press anything, what happens if they leave halfway, and
       * whether "do not save" also switches off the progress report (it does
       * not -- that one is local to the browser).
       */
      describe('mode help notes', () => {

        it('says what each mode actually does', () => {
          const result = getContents('/idevice/path/');

          expect(result).toContain('sends no score to the LMS');
          // "Do not save" is about the LMS only; the progress report is local.
          expect(result).toContain('kept in the learner');
          expect(result).toContain('reports its score by itself');
          expect(result).toContain('leaves halfway still has the work done so far recorded');
          expect(result).toContain('Nothing reaches the LMS until the learner presses the button');
          expect(result).toContain('does not close the activity');
        });

      });

      it('offers the pass score to every iDevice, with no opt-out', () => {
        // Every scoring activity is judged on the same 0-10 scale, so that a
        // page mixing several of them grades them alike.
        expect(getContents()).toContain('eXePassScoreGlobal');
        expect(getContents('/idevice/path/')).toContain('eXePassScoreGlobal');
      });
    });

    it('setValues handles isScorm=1', () => {
      document.body.innerHTML = `
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" />
        <span id="eXeGameSCORgame"></span>
        <span id="eXeGameSCORgameAuto"></span>
        <div id="eXeGameSCORMPercentaje"></div>
        <div id="eXeGameSCORMinstructionsButton"></div>
        <div id="eXeGameSCORMinstructionsAuto"></div>
        <input type="text" id="eXeGameSCORMbuttonText" />
        <input type="number" id="eXeGameSCORMWeight" />
        <input type="checkbox" id="eXeGameSCORMRepeatActivity" />
        <input type="checkbox" id="eXeGameSCORMRepeatActivityAuto" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.setValues(1, 'Save', true, 80);
      expect($('#eXeGameSCORMAutoSave').is(':checked')).toBe(true);
      expect($('#eXeGameSCORMWeight').val()).toBe('80');
    });

    it('setValues handles isScorm=2', () => {
      document.body.innerHTML = `
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" />
        <span id="eXeGameSCORgame"></span>
        <span id="eXeGameSCORgameAuto"></span>
        <div id="eXeGameSCORMPercentaje"></div>
        <div id="eXeGameSCORMinstructionsButton"></div>
        <div id="eXeGameSCORMinstructionsAuto"></div>
        <input type="text" id="eXeGameSCORMbuttonText" />
        <input type="number" id="eXeGameSCORMWeight" />
        <input type="checkbox" id="eXeGameSCORMRepeatActivity" />
        <input type="checkbox" id="eXeGameSCORMRepeatActivityAuto" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.setValues(2, 'My Button', false, 50);
      expect($('#eXeGameSCORMButtonSave').is(':checked')).toBe(true);
      expect($('#eXeGameSCORMbuttonText').val()).toBe('My Button');
    });

    it('setValues only shows weighted when saving score', () => {
      document.body.innerHTML = `
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" />
        <span id="eXeGameSCORgame"></span>
        <span id="eXeGameSCORgameAuto"></span>
        <div id="eXeGameSCORMPercentaje"></div>
        <div id="eXeGameSCORMinstructionsButton"></div>
        <div id="eXeGameSCORMinstructionsAuto"></div>
        <input type="text" id="eXeGameSCORMbuttonText" />
        <input type="number" id="eXeGameSCORMWeight" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.setValues(0, 'Save', true, 100);
      expect($('#eXeGameSCORMPercentaje').hasClass('d-none')).toBe(true);

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.setValues(1, 'Save', true, 100);
      expect($('#eXeGameSCORMPercentaje').hasClass('d-none')).toBe(false);

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.setValues(2, 'Save', true, 100);
      expect($('#eXeGameSCORMPercentaje').hasClass('d-none')).toBe(false);
    });

    it('getValues returns SCORM values with empty weight', () => {
      document.body.innerHTML = `
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" checked />
        <input type="text" id="eXeGameSCORMbuttonText" value="Save" />
        <input type="number" id="eXeGameSCORMWeight" value="" />
      `;

      const values = globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.getValues();
      expect(values.weighted).toBe(-1);
    });

    it('addEvents handles radio change events', () => {
      vi.useFakeTimers();
      document.body.innerHTML = `
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMNoSave" value="0" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMAutoSave" value="1" />
        <input type="radio" name="eXeGameSCORM" id="eXeGameSCORMButtonSave" value="2" />
        <span id="eXeGameSCORgame"></span>
        <span id="eXeGameSCORgameAuto"></span>
        <div id="eXeGameSCORMPercentaje"></div>
        <div id="eXeGameSCORMinstructionsButton"></div>
        <div id="eXeGameSCORMinstructionsAuto"></div>
        <input type="number" id="eXeGameSCORMWeight" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.addEvents();

      // Change to no save (value 0) - should hide percentage
      $('#eXeGameSCORMNoSave').prop('checked', true).trigger('change');
      expect($('#eXeGameSCORMPercentaje').hasClass('d-none')).toBe(true);

      // Change to auto save (value 1)
      $('#eXeGameSCORMAutoSave').prop('checked', true).trigger('change');
      vi.runAllTimers();
      expect($('#eXeGameSCORMPercentaje').hasClass('d-none')).toBe(false);

      // Change to button save (value 2)
      $('#eXeGameSCORMButtonSave').prop('checked', true).trigger('change');
      vi.runAllTimers();
      expect($('#eXeGameSCORMPercentaje').hasClass('d-none')).toBe(false);

      vi.useRealTimers();
    });

    it('addEvents handles weight input validation', () => {
      document.body.innerHTML = `
        <input type="radio" name="eXeGameSCORM" value="0" />
        <span id="eXeGameSCORgame"></span>
        <span id="eXeGameSCORgameAuto"></span>
        <div id="eXeGameSCORMPercentaje"></div>
        <div id="eXeGameSCORMinstructionsButton"></div>
        <div id="eXeGameSCORMinstructionsAuto"></div>
        <input type="number" id="eXeGameSCORMWeight" value="abc" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.gamification.scorm.addEvents();

      const weight = $('#eXeGameSCORMWeight');
      weight.trigger('keyup');
      expect(weight.val()).toBe('');

      weight.val('150').trigger('focusout');
      expect(weight.val()).toBe('100');

      weight.val('').trigger('focusout');
      expect(weight.val()).toBe('100');

      weight.val('0').trigger('focusout');
      expect(weight.val()).toBe('1');
    });
  });

  describe('gamification.share', () => {
    it('getImportContents keeps the ids the iDevices bind, and takes txt and xml files', () => {
      document.body.innerHTML = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getImportContents();

      expect(document.querySelector('#eXeGameExportImport #eXeGameImportGame').getAttribute('accept')).toBe('.txt, .xml');
      expect(document.querySelector('#eXeGameExportImport .exe-field-instructions').textContent).toBe(
        'Supported formats: txt, xml'
      );
    });

    it('getImportContents hides the native file input so only the btn-primary trigger is shown', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getImportContents();
      expect(result).toMatch(/<input[^>]*id="eXeGameImportGame"[^>]*class="[^"]*\bd-none\b[^"]*"/);
      expect(result).toMatch(/<button[^>]*class="[^"]*\bbtn-primary\b[^"]*\bexe-file-btn\b[^"]*"[^>]*data-exe-file-trigger/);
    });

    it('getExportContents offers the export button the iDevices bind', () => {
      document.body.innerHTML = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getExportContents();

      expect(document.getElementById('eXeGameExportQuestions').value).toBe('Export questions');
    });

    it('getAILabel drops the ✨ some translations of "Create with AI" open with', () => {
      const previous = globalThis._;
      try {
        globalThis._ = (text) => (text === 'Create with AI' ? '✨ Crear con IA' : text);
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.share.getAILabel()).toBe('Crear con IA');

        globalThis._ = (text) => text;
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.share.getAILabel()).toBe('Create with AI');
      } finally {
        globalThis._ = previous;
      }
    });

    it('getIAContents leaves its message to the window', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getIAContents(0);
      expect(result).not.toContain('exe-block-info');
      expect(result).not.toContain('generate multiple questions');
    });

    it('getIAContents offers only working buttons, each with its own label', () => {
      const container = document.createElement('div');
      container.innerHTML = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getIAContents(0);

      // The "Add questions" button was hidden in every tab and read another textarea.
      expect(container.querySelector('#eXeEIAButton, #eXeEQuestionsIA')).toBeNull();
      const footer = container.querySelector('#eXeEAddArea > :last-child');
      const buttons = [...footer.querySelectorAll('button')].map((button) => [button.id, button.type, button.textContent.trim()]);
      expect(buttons).toEqual([
        ['eXeESaveButton', 'button', 'Save'],
        ['eXeECopyButton', 'button', 'Copy'],
        ['eXeEOpenChatGPTButton', 'button', 'Send to AI'],
      ]);
    });

    it('getIAContents returns the AI controls without a tab around them', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getIAContents(0);
      expect(result).not.toContain('exe-form-tab');
      expect(result).toContain('eXeEPromptArea');
    });

    it('getIAContents renders prompt examples on real newlines, not literal "\\n"', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getIAContents(0);
      // The prompt textarea must NOT contain literal backslash-n sequences
      // between examples — those would render verbatim instead of as line breaks.
      const textareaMatch = result.match(
        /<textarea[^>]*id="eXeEPromptArea"[^>]*>([\s\S]*?)<\/textarea>/
      );
      expect(textareaMatch).not.toBeNull();
      expect(textareaMatch[1]).not.toContain('\\n');
      expect(textareaMatch[1]).toContain('\n');
    });

    it('createIAButtonsHtml returns buttons HTML', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.createIAButtonsHtml();
      expect(result).toContain('eXeFormIAContainer');
      expect(result).toContain('eXeSpecialtyIA');
    });

    it('getAllowedFormats returns formats for each gameId', () => {
      // Test each game type
      for (let i = 0; i <= 9; i++) {
        const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getAllowedFormats(i);
        expect(result).toHaveProperty('format');
        expect(result).toHaveProperty('explanation');
        expect(result).toHaveProperty('examples');
      }
    });

    it('getAllowedFormats returns empty for invalid gameId', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.getAllowedFormats(999);
      expect(result.format).toEqual([]);
    });

    describe('adaptative quiz (gameId 10)', () => {
      const share = () => globalThis.$exeIDevicesEdition.iDevice.gamification.share;

      it('getAllowedFormats(10) defaults to 3 levels and exposes 3 line formats', () => {
        const result = share().getAllowedFormats(10);
        // 3 line types: select, sort, word
        expect(result.format.length).toBe(3);
        // 4 examples in 3-level mode (select single, select multi, sort, word)
        expect(result.examples.length).toBe(4);
        expect(result.explanation).toContain('0 (low)');
        expect(result.explanation).toContain('2 (high)');
        expect(result.explanation).not.toContain('expert');
        expect(result.prompt).toContain('Type 0');
        expect(result.prompt).toContain('Type 1');
        expect(result.prompt).toContain('Type 2');

        // Type 0 (select): single-letter solution, multi-letter, empty solution.
        expect(result.allowRegex.test('0@0#B#Q#A#B#C#D')).toBe(true);
        expect(result.allowRegex.test('0@1#AC#Q#A#B#C#D')).toBe(true);
        expect(result.allowRegex.test('0@2#ABCD#Q#A#B#C#D')).toBe(true);
        expect(result.allowRegex.test('0@2##Q#A#B')).toBe(true);
        expect(result.allowRegex.test('0@2#a#Q#A#B')).toBe(true);
        // Type 1 (sort): 3 to 6 items.
        expect(result.allowRegex.test('1@1#Sort these#One#Two#Three')).toBe(true);
        expect(result.allowRegex.test('1@2#Sort these#One#Two#Three#Four#Five#Six')).toBe(true);
        // Type 2 (word).
        expect(result.allowRegex.test('2@0#Heart#Pumps blood')).toBe(true);

        // Level 3 not allowed in 3-level mode.
        expect(result.allowRegex.test('0@3#A#Q#A#B')).toBe(false);
        expect(result.allowRegex.test('1@3#Q#A#B#C')).toBe(false);
        expect(result.allowRegex.test('2@3#W#D')).toBe(false);
        // Old letter-prefixed select format no longer valid.
        expect(result.allowRegex.test('a@0#Q#A#B')).toBe(false);
        expect(result.allowRegex.test('palabra@0#W#D')).toBe(false);
        expect(result.allowRegex.test('@1#Sort#One#Two#Three')).toBe(false);
        // Letter outside A-F.
        expect(result.allowRegex.test('0@1#G#Q#A#B')).toBe(false);
        // Sort with too few items (only 2).
        expect(result.allowRegex.test('1@1#Sort#One#Two')).toBe(false);
        // Word missing definition.
        expect(result.allowRegex.test('2@0#OnlyWord')).toBe(false);
        // Unknown type.
        expect(result.allowRegex.test('3@0#A#Q#A#B')).toBe(false);
      });

      it('getAllowedFormats(10, { numLevels: 4 }) extends to 4 levels', () => {
        const result = share().getAllowedFormats(10, { numLevels: 4 });
        // Adds one extra example (level 3 select with all four letters).
        expect(result.examples.length).toBe(5);
        expect(result.explanation).toContain('3 (expert)');
        expect(result.prompt).toContain('4 levels');
        // Level 3 now allowed across all three types.
        expect(result.allowRegex.test('0@3#ABCD#Q#A#B#C#D')).toBe(true);
        expect(result.allowRegex.test('1@3#Sort#One#Two#Three')).toBe(true);
        expect(result.allowRegex.test('2@3#W#D')).toBe(true);
        expect(result.allowRegex.test('0@0#A#Q#A#B')).toBe(true);
        // Level 4 still rejected.
        expect(result.allowRegex.test('0@4#A#Q#A#B')).toBe(false);
      });

      it('getAllowedFormats(10, { numLevels: 5 }) extends to 5 levels and adds master example', () => {
        const result = share().getAllowedFormats(10, { numLevels: 5 });
        // 4-level mode adds 1 example, 5-level mode adds another (sort/master).
        expect(result.examples.length).toBe(6);
        expect(result.explanation).toContain('4 (master)');
        expect(result.prompt).toContain('5 levels');
        // Levels 3 (expert) and 4 (master) accepted across all three types.
        expect(result.allowRegex.test('0@3#ABCD#Q#A#B#C#D')).toBe(true);
        expect(result.allowRegex.test('1@4#Sort#One#Two#Three')).toBe(true);
        expect(result.allowRegex.test('2@4#W#D')).toBe(true);
        expect(result.allowRegex.test('0@0#A#Q#A#B')).toBe(true);
        // Level 5 still rejected.
        expect(result.allowRegex.test('0@5#A#Q#A#B')).toBe(false);
      });

      it('getAllowedFormats(10) treats unknown numLevels as 3-level mode', () => {
        const result = share().getAllowedFormats(10, { numLevels: 7 });
        expect(result.examples.length).toBe(4);
        expect(result.explanation).not.toContain('expert');
      });

      it('getAllowedFormats(10) prompt resolves every %placeholder% (no leftover markers)', () => {
        // The prompt is built from a single static translation key with %placeholders%
        // (not a c_(`...${}...`) template, which the extractor skips and never translates).
        // After substitution none of the markers may survive, or the user would see raw
        // %total% / %distribution% tokens in the AI prompt.
        const result = share().getAllowedFormats(10);
        expect(result.prompt).not.toContain('%total%');
        expect(result.prompt).not.toContain('%distribution%');
        expect(result.prompt).not.toContain('%ladder%');
        expect(result.prompt).not.toContain('%perLevel%');
        // 3-level default: 3 × 20 = 60 questions, 20 per level.
        expect(result.prompt).toContain('Create 60 mixed adaptative-quiz questions');
        expect(result.prompt).toContain('around 20 questions per level');
        // The distribution and difficulty-ladder fragments are interpolated in.
        expect(result.prompt).toContain('balanced across the 3 levels');
        expect(result.prompt).toContain('Difficulty must increase with the level');
      });

      it('buildIAPromptText(10) joins lines with real newlines (no literal \\n)', () => {
        const text = share().buildIAPromptText(10);
        expect(text).toContain('Act as a highly experienced teacher.');
        expect(text).toContain('Formats');
        expect(text).toContain('Examples');
        expect(text).toContain('3 levels');
        expect(text).not.toContain('expert');
        // Prompt mentions the three supported types
        expect(text).toContain('Type 0');
        expect(text).toContain('Type 1');
        expect(text).toContain('Type 2');
        // Difficulty must escalate with the level number
        expect(text).toContain('Difficulty must increase with the level');
        expect(text).toContain('easiest');
        // Each level must mix the three question types
        expect(text).toContain('all three types');
        expect(text).toContain('select/multiple-choice');
        expect(text).toContain('sort/order');
        expect(text).toContain('word/definition');
        // Must NOT contain a literal backslash-n sequence
        expect(text.indexOf('\\n')).toBe(-1);
        // Must split into multiple actual lines
        expect(text.split('\n').length).toBeGreaterThan(5);
      });

      it('buildIAPromptText(10, { numLevels: 4 }) reflects 4-level config', () => {
        const text = share().buildIAPromptText(10, { numLevels: 4 });
        expect(text).toContain('4 levels');
        expect(text).toContain('expert');
        expect(text).toContain('3 (expert)');
        // Difficulty ladder still emphasized in 4-level mode
        expect(text).toContain('Difficulty must increase with the level');
        expect(text).toContain('level 3 (expert) must contain the hardest');
      });

      it('buildIAPromptText asks for the right number of questions per level', () => {
        // 3 levels × 20 = 60
        expect(share().buildIAPromptText(10)).toContain('around 20 questions per level');
        // 4 levels × 15 = 60
        expect(share().buildIAPromptText(10, { numLevels: 4 })).toContain('around 15 questions per level');
        // 5 levels × 12 = 60
        expect(share().buildIAPromptText(10, { numLevels: 5 })).toContain('around 12 questions per level');
      });

      it('buildIAPromptText(10, { numLevels: 5 }) reflects 5-level master config', () => {
        const text = share().buildIAPromptText(10, { numLevels: 5 });
        expect(text).toContain('5 levels');
        expect(text).toContain('master');
        expect(text).toContain('4 (master)');
        expect(text).toContain('Difficulty must increase with the level');
        expect(text).toContain('level 4 (master) must contain the hardest');
      });

      it('refreshIAPrompt writes the current prompt into #eXeEPromptArea and updates on re-call', () => {
        const $textarea = $('<textarea id="eXeEPromptArea"></textarea>').appendTo('body');
        try {
          share().refreshIAPrompt(10, { numLevels: 4 });
          expect($textarea.val()).toContain('expert');
          share().refreshIAPrompt(10, { numLevels: 3 });
          expect($textarea.val()).toContain('3 levels');
          expect($textarea.val()).not.toContain('expert');
        } finally {
          $textarea.remove();
        }
      });

      it('refreshIAPrompt is a no-op when the textarea does not exist', () => {
        expect(() => {
          share().refreshIAPrompt(10, { numLevels: 3 });
        }).not.toThrow();
      });

      it('validateAndSave(10, $area, options) honours the 4-level regex', () => {
        const textarea = $('<textarea></textarea>')
          .val('0@3#A#Q4#A#B#C\n0@0#B#Q1#A#B')
          .appendTo('body');
        try {
          // 3-level mode: line with level 3 is invalid
          const result3 = share().validateAndSave(10, textarea);
          expect(result3.validLines).toContain('0@0#B#Q1#A#B');
          expect(result3.invalidLines).toContain('0@3#A#Q4#A#B#C');

          // Refill and try 4-level mode: both should be valid
          textarea.val('0@3#A#Q4#A#B#C\n0@0#B#Q1#A#B');
          const result4 = share().validateAndSave(10, textarea, { numLevels: 4 });
          expect(result4.validLines).toContain('0@0#B#Q1#A#B');
          expect(result4.validLines).toContain('0@3#A#Q4#A#B#C');
          expect(result4.invalidLines.length).toBe(0);
        } finally {
          textarea.remove();
        }
      });

      it('validateQuesionsIA(10, lines, options) accepts the three line types', () => {
        const lines = [
          '0@1#AC#Multi correct?#A#B#C#D',
          '2@0#Heart#Pumps blood',
          '1@2#Sort these#One#Two#Three#Four',
          '0@3#A#High level#A#B'
        ];
        // 3-level mode: the level-3 line is rejected, the rest pass
        const result3 = share().validateQuesionsIA(10, lines);
        expect(result3).toContain('0@1#AC#Multi correct?#A#B#C#D');
        expect(result3).toContain('2@0#Heart#Pumps blood');
        expect(result3).toContain('1@2#Sort these#One#Two#Three#Four');
        expect(result3).not.toContain('0@3#A#High level#A#B');
        // 4-level mode: all four pass
        const result4 = share().validateQuesionsIA(10, lines, { numLevels: 4 });
        expect(result4).toContain('0@3#A#High level#A#B');
        expect(result4.length).toBe(4);
      });

      it('legacy callers (no options) keep working for gameId 0..9', () => {
        for (let i = 0; i <= 9; i++) {
          const result = share().getAllowedFormats(i);
          expect(result).toHaveProperty('format');
          expect(Array.isArray(result.format)).toBe(true);
        }
        const text = share().buildIAPromptText(0);
        expect(text).toContain('Act as a highly experienced teacher.');
        expect(text.indexOf('\\n')).toBe(-1);
      });
    });

    it('cleanText removes extra spaces and trims', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.cleanText('  line1  \n  line2  ');
      expect(result).toBe('line1\nline2');
    });

    it('checkQuestions returns array when valid array', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.checkQuestions(['q1', 'q2']);
      expect(result).toEqual(['q1', 'q2']);
    });

    it('checkQuestions parses JSON string', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.checkQuestions('["q1", "q2"]');
      expect(result).toEqual(['q1', 'q2']);
    });

    it('checkQuestions returns false for invalid JSON', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.checkQuestions('invalid json');
      expect(result).toBe(false);
    });

    it('checkQuestions handles object input', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.checkQuestions({ a: 'q1', b: 'q2' });
      expect(result).toEqual(['q1', 'q2']);
    });

    it('checkQuestions returns false for empty result', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.checkQuestions({});
      expect(result).toBe(false);
    });

    it('validateAndSave validates lines against regex', () => {
      const textarea = $('<textarea></textarea>').val('Word1#Definition1\nInvalid Line\nWord2#Definition2');
      document.body.appendChild(textarea[0]);

      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.validateAndSave(0, textarea);
      expect(result.validLines).toContain('Word1#Definition1');
      expect(result.validLines).toContain('Word2#Definition2');
      expect(result.invalidLines).toContain('Invalid Line');
    });

    it('validateQuesionsIA validates lines', () => {
      const lines = ['Word1#Definition1', 'Invalid', 'Word2#Definition2', ''];
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.validateQuesionsIA(0, lines);
      expect(result).toContain('Word1#Definition1');
      expect(result).not.toContain('Invalid');
    });

    it('exportGame creates download link', () => {
      const container = document.createElement('div');
      container.id = 'test-idevice';
      document.body.appendChild(container);

      const urlSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

      vi.useFakeTimers();
      globalThis.$exeIDevicesEdition.iDevice.gamification.share.exportGame({ data: 'test' }, 'test-idevice', 'TestGame');
      vi.runAllTimers();
      vi.useRealTimers();

      urlSpy.mockRestore();
      revokeSpy.mockRestore();
    });

    it('exportGame returns false for null data', () => {
      const result = globalThis.$exeIDevicesEdition.iDevice.gamification.share.exportGame(null, 'test', 'name');
      expect(result).toBe(false);
    });

    describe('addEvents', () => {
      let originalAlert;
      let originalExeAlert;
      let originalWindowOpen;

      beforeEach(() => {
        originalAlert = global.alert;
        originalExeAlert = globalThis.eXe?.app?.alert;
        originalWindowOpen = global.window.open;
        global.alert = vi.fn();
        globalThis.eXe.app.alert = vi.fn();
        global.window.open = vi.fn();
        document.body.innerHTML = `
          <textarea id="eXeEQuestionsArea"></textarea>
          <textarea id="eXeEPromptArea"></textarea>
          <div id="eXeEIADiv"></div>
          <div id="eXeEAddArea" style="display:none"></div>
          <button id="eXeESaveButton"></button>
          <button id="eXeECopyButton"></button>
          <button id="eXeEOpenChatGPTButton"></button>
          <select id="eXeEIASelect">
            <option value="https://chatgpt.com/?q=">ChatGPT</option>
            <option value="https://grok.com/?q=">Grok</option>
            <option value="https://claude.ai/new?q=">Claude</option>
          </select>
          <button id="eXeGameAddQuestion"></button>
          <a id="eXeETabQuestions" class="active"></a>
          <a id="eXeETabPrompt"></a>
          <a id="eXeETabIA"></a>
        `;
      });

      afterEach(() => {
        global.alert = originalAlert;
        globalThis.eXe.app.alert = originalExeAlert;
        global.window.open = originalWindowOpen;
      });

      // The save/IA handlers await saveQuestions (it may render images
      // asynchronously), so the generic alert fires on a later microtask.
      const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

      it('saveButton click shows success alert when all lines are valid', async () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEQuestionsArea').val('Word1#Definition1\nWord2#Definition2');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeESaveButton').trigger('click');
        await flushAsync();

        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith('The questions have been added successfully');
        expect(saveQuestionsMock).toHaveBeenCalled();
      });

      it('closes the Create with AI window once the questions are in, and only then', async () => {
        const share = globalThis.$exeIDevicesEdition.iDevice.gamification.share;
        const close = vi.spyOn(share, 'close');
        try {
          share.addEvents(0, vi.fn());

          $('#eXeEQuestionsArea').val('not a question');
          $('#eXeESaveButton').trigger('click');
          await flushAsync();
          expect(close).not.toHaveBeenCalled();

          $('#eXeEQuestionsArea').val('Word1#Definition1');
          $('#eXeESaveButton').trigger('click');
          await flushAsync();
          expect(close).toHaveBeenCalledWith('ai');
        } finally {
          close.mockRestore();
        }
      });

      it('saveButton click shows invalid lines alert when some lines are invalid', async () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEQuestionsArea').val('Word1#Definition1\nInvalidLine\nWord2#Definition2');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeESaveButton').trigger('click');
        await flushAsync();

        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith(expect.stringContaining('The following lines are invalid:'));
        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith(expect.stringContaining('InvalidLine'));
      });

      it('saveButton click skips the generic alert when saveQuestions handles its own messaging', async () => {
        const saveQuestionsMock = vi.fn().mockResolvedValue({ handledMessaging: true });
        $('#eXeEQuestionsArea').val('Word1#Definition1\nWord2#Definition2');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeESaveButton').trigger('click');
        await flushAsync();

        expect(saveQuestionsMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Array));
        expect(globalThis.eXe.app.alert).not.toHaveBeenCalled();
      });

      it('saveButton click refills the textarea with the remainingLines the callback could not add', async () => {
        const saveQuestionsMock = vi
          .fn()
          .mockResolvedValue({ handledMessaging: true, remainingLines: ['Bad#line'] });
        $('#eXeEQuestionsArea').val('Good#Definition\nBad#line');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeESaveButton').trigger('click');
        await flushAsync();

        // The cleared textarea keeps only the rejected lines so the user can fix them.
        expect($('#eXeEQuestionsArea').val()).toBe('Bad#line');
        expect(globalThis.eXe.app.alert).not.toHaveBeenCalled();
      });

      it('openChatGPTButton click shows alert when prompt is empty', () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEPromptArea').val('');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeEOpenChatGPTButton').trigger('click');

        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith('There is no query to send to the assistant.');
        expect(global.window.open).not.toHaveBeenCalled();
      });

      it('openChatGPTButton click opens URL with selected AI service (ChatGPT)', () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEPromptArea').val('Generate 5 questions about history');
        $('#eXeEIASelect').val('https://chatgpt.com/?q=');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeEOpenChatGPTButton').trigger('click');

        expect(global.window.open).toHaveBeenCalledWith(
          'https://chatgpt.com/?q=Generate%205%20questions%20about%20history',
          '_blank'
        );
      });

      it('openChatGPTButton click opens URL with selected AI service (Claude)', () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEPromptArea').val('Test prompt');
        $('#eXeEIASelect').val('https://claude.ai/new?q=');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeEOpenChatGPTButton').trigger('click');

        expect(global.window.open).toHaveBeenCalledWith(
          'https://claude.ai/new?q=Test%20prompt',
          '_blank'
        );
      });

      it('openChatGPTButton click opens URL with selected AI service (Grok)', () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEPromptArea').val('My question');
        $('#eXeEIASelect').val('https://grok.com/?q=');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeEOpenChatGPTButton').trigger('click');

        expect(global.window.open).toHaveBeenCalledWith(
          'https://grok.com/?q=My%20question',
          '_blank'
        );
      });

      it('openChatGPTButton click trims whitespace from prompt', () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEPromptArea').val('   test prompt with spaces   ');
        $('#eXeEIASelect').val('https://chatgpt.com/?q=');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeEOpenChatGPTButton').trigger('click');

        expect(global.window.open).toHaveBeenCalledWith(
          'https://chatgpt.com/?q=test%20prompt%20with%20spaces',
          '_blank'
        );
      });

      it('saveButton click shows alert when questions textarea is empty', () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEQuestionsArea').val('');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeESaveButton').trigger('click');

        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith('Please enter at least one question.');
        expect(saveQuestionsMock).not.toHaveBeenCalled();
      });

      it('openChatGPTButton click shows alert when no AI service selected', () => {
        const saveQuestionsMock = vi.fn();
        $('#eXeEPromptArea').val('Test prompt');
        $('#eXeEIASelect').val('');

        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
        $('#eXeEOpenChatGPTButton').trigger('click');

        expect(globalThis.eXe.app.alert).toHaveBeenCalledWith('Please select an AI assistant.');
        expect(global.window.open).not.toHaveBeenCalled();
      });
    });
  });

  describe('defaultAI preference', () => {
    let originalAlert;
    let originalEXeLearning;
    let originalWindowEXeLearning;
    let originalWindowOpen;

    beforeEach(() => {
      originalAlert = global.alert;
      originalEXeLearning = globalThis.eXeLearning;
      originalWindowEXeLearning = typeof window !== 'undefined' ? window.eXeLearning : undefined;
      originalWindowOpen = typeof window !== 'undefined' ? window.open : undefined;
      global.alert = vi.fn();

      document.body.innerHTML = `
        <textarea id="eXeEPromptArea"></textarea>
        <textarea id="eXeEQuestionsArea"></textarea>
        <div id="eXeEIADiv"></div>
        <div id="eXeEAddArea" style="display:none"></div>
        <button id="eXeESaveButton"></button>
        <button id="eXeECopyButton"></button>
        <button id="eXeEOpenChatGPTButton"></button>
        <button id="eXeGameAddQuestion"></button>
        <a id="eXeETabQuestions" class="active"></a>
        <a id="eXeETabPrompt"></a>
        <a id="eXeETabIA"></a>
        <select id="eXeEIASelect">
          <option value="https://chatgpt.com/?q=">ChatGPT</option>
          <option value="https://claude.ai/new?q=">Claude</option>
          <option value="https://www.perplexity.ai/search?q=">Perplexity</option>
        </select>
      `;
    });

    afterEach(() => {
      global.alert = originalAlert;
      globalThis.eXeLearning = originalEXeLearning;
      if (typeof window !== 'undefined') {
        window.eXeLearning = originalWindowEXeLearning;
        window.open = originalWindowOpen;
      }
    });

    it('loads user defaultAI preference and selects the correct option', () => {
      // Setup eXeLearning global with user preferences
      globalThis.eXeLearning = {
        app: {
          user: {
            preferences: {
              preferences: {
                defaultAI: { value: 'https://claude.ai/new?q=' }
              },
              apiSaveProperties: vi.fn()
            }
          },
          api: {
            getGenerateQuestions: vi.fn()
          }
        }
      };
      if (typeof window !== 'undefined') {
        window.eXeLearning = globalThis.eXeLearning;
      }

      const saveQuestionsMock = vi.fn();
      globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);

      // Verify the select has the correct value
      expect($('#eXeEIASelect').val()).toBe('https://claude.ai/new?q=');
    });

    it('falls back to default when saved preference is invalid', () => {
      globalThis.eXeLearning = {
        app: {
          user: {
            preferences: {
              preferences: {
                defaultAI: { value: 'https://invalid.ai/?q=' }
              },
              apiSaveProperties: vi.fn()
            }
          },
          api: {
            getGenerateQuestions: vi.fn()
          }
        }
      };
      if (typeof window !== 'undefined') {
        window.eXeLearning = globalThis.eXeLearning;
      }

      const saveQuestionsMock = vi.fn();
      globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);

      expect($('#eXeEIASelect').val()).toBe('https://chatgpt.com/?q=');
    });

    it('uses default (ChatGPT) when no user preference is set', () => {
      // Setup eXeLearning global without defaultAI preference
      globalThis.eXeLearning = {
        app: {
          user: {
            preferences: {
              preferences: {},
              apiSaveProperties: vi.fn()
            }
          },
          api: {
            getGenerateQuestions: vi.fn()
          }
        }
      };
      if (typeof window !== 'undefined') {
        window.eXeLearning = globalThis.eXeLearning;
      }

      const saveQuestionsMock = vi.fn();
      globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);

      // Default should remain ChatGPT (first option)
      expect($('#eXeEIASelect').val()).toBe('https://chatgpt.com/?q=');
    });

    it('does not save preference when user changes the AI selection', () => {
      const apiSavePropertiesMock = vi.fn();

      globalThis.eXeLearning = {
        app: {
          user: {
            preferences: {
              preferences: {
                defaultAI: { value: 'https://chatgpt.com/?q=' }
              },
              apiSaveProperties: apiSavePropertiesMock
            }
          },
          api: {
            getGenerateQuestions: vi.fn()
          }
        }
      };
      if (typeof window !== 'undefined') {
        window.eXeLearning = globalThis.eXeLearning;
      }

      const saveQuestionsMock = vi.fn();
      globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);

      // Change the select value
      $('#eXeEIASelect').val('https://www.perplexity.ai/search?q=').trigger('change');

      // Verify apiSaveProperties was not called
      expect(apiSavePropertiesMock).not.toHaveBeenCalled();
    });

    it('handles missing eXeLearning global gracefully', () => {
      // Remove eXeLearning global
      delete globalThis.eXeLearning;
      if (typeof window !== 'undefined') {
        delete window.eXeLearning;
      }

      const saveQuestionsMock = vi.fn();

      // Should not throw an error
      expect(() => {
        globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);
      }).not.toThrow();

      // Select should still have default value
      expect($('#eXeEIASelect').val()).toBe('https://chatgpt.com/?q=');
    });

    it('openChatGPTButton uses the selected AI URL', () => {
      globalThis.eXeLearning = {
        app: {
          user: {
            preferences: {
              preferences: {
                defaultAI: { value: 'https://claude.ai/new?q=' }
              },
              apiSaveProperties: vi.fn()
            }
          },
          api: {
            getGenerateQuestions: vi.fn()
          }
        }
      };
      if (typeof window !== 'undefined') {
        window.eXeLearning = globalThis.eXeLearning;
      }

      // Mock window.open
      const windowOpenMock = vi.fn();
      if (typeof window !== 'undefined') {
        window.open = windowOpenMock;
      }

      const saveQuestionsMock = vi.fn();
      globalThis.$exeIDevicesEdition.iDevice.gamification.share.addEvents(0, saveQuestionsMock);

      // Set a prompt
      $('#eXeEPromptArea').val('Test prompt');

      // Click the send button
      $('#eXeEOpenChatGPTButton').trigger('click');

      // Verify window.open was called with Claude URL
      expect(windowOpenMock).toHaveBeenCalledWith(
        'https://claude.ai/new?q=Test%20prompt',
        '_blank'
      );
    });
  });

  describe('filePicker', () => {
    it('init creates buttons for file pickers', () => {
      document.body.innerHTML = `
        <input type="text" id="testPicker" class="exe-file-picker" />
        <input type="text" id="imagePicker" class="exe-image-picker" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.filePicker.init();

      const fileBtn = document.querySelector('.exe-pick-any-file');
      const imageBtn = document.querySelector('.exe-pick-image');
      expect(fileBtn).toBeTruthy();
      expect(imageBtn).toBeTruthy();
    });

    it('init skips inputs that already have buttons', () => {
      document.body.innerHTML = `
        <input type="text" id="testPicker" class="exe-file-picker" />
        <input type="button" class="exe-pick-any-file" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.filePicker.init();

      const buttons = document.querySelectorAll('.exe-pick-any-file');
      expect(buttons.length).toBe(1);
    });

    it('init click handler shows filemanager for image', () => {
      document.body.innerHTML = `
        <input type="text" id="imagePicker" class="exe-image-picker" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.filePicker.init();

      const btn = document.querySelector('.exe-pick-image');
      btn.click();

      expect(globalThis.eXeLearning.app.modals.filemanager.show).toHaveBeenCalledWith(
        expect.objectContaining({ accept: 'image' })
      );
    });

    it('init click handler detects audio from input id', () => {
      document.body.innerHTML = `
        <input type="text" id="myAudioPicker" class="exe-file-picker" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.filePicker.init();

      const btn = document.querySelector('.exe-pick-any-file');
      btn.click();

      expect(globalThis.eXeLearning.app.modals.filemanager.show).toHaveBeenCalledWith(
        expect.objectContaining({ accept: 'audio' })
      );
    });

    it('init click handler detects video from input id', () => {
      document.body.innerHTML = `
        <input type="text" id="myVideoPicker" class="exe-file-picker" />
      `;

      globalThis.$exeIDevicesEdition.iDevice.filePicker.init();

      const btn = document.querySelector('.exe-pick-any-file');
      btn.click();

      expect(globalThis.eXeLearning.app.modals.filemanager.show).toHaveBeenCalledWith(
        expect.objectContaining({ accept: 'video' })
      );
    });

    it('openFilePicker calls exe_tinymce.chooseImage for image', () => {
      globalThis.exe_tinymce = { chooseImage: vi.fn() };

      // Create a real DOM element since the code uses jQuery hasClass
      const mockElement = document.createElement('button');
      mockElement.id = 'test_browseFor';
      mockElement.className = 'exe-pick-image';
      document.body.appendChild(mockElement);

      globalThis.$exeIDevicesEdition.iDevice.filePicker.openFilePicker(mockElement);
      expect(globalThis.exe_tinymce.chooseImage).toHaveBeenCalledWith('test', '', 'image', window);
    });

    it('openFilePicker calls exe_tinymce.chooseImage for media', () => {
      globalThis.exe_tinymce = { chooseImage: vi.fn() };

      // Create a real DOM element since the code uses jQuery hasClass
      const mockElement = document.createElement('button');
      mockElement.id = 'test_browseFor';
      mockElement.className = 'exe-pick-any-file';
      document.body.appendChild(mockElement);

      globalThis.$exeIDevicesEdition.iDevice.filePicker.openFilePicker(mockElement);
      expect(globalThis.exe_tinymce.chooseImage).toHaveBeenCalledWith('test', '', 'media', window);
    });

    it('openFilePicker handles error', () => {
      globalThis.exe_tinymce = {
        chooseImage: vi.fn(() => { throw new Error('test error'); })
      };

      const mockElement = document.createElement('button');
      mockElement.id = 'test_browseFor';
      mockElement.className = '';
      document.body.appendChild(mockElement);

      globalThis.$exeIDevicesEdition.iDevice.filePicker.openFilePicker(mockElement);

      expect(globalThis.eXe.app.alert).toHaveBeenCalled();
    });
  });

  describe('voiceRecorder', () => {
    afterEach(() => {
      delete globalThis.MediaRecorder;
      delete globalThis.navigator.mediaDevices;
    });

    it('getPreferredMimeType falls back to mp4 or webm based on support', () => {
      const recorder = globalThis.$exeIDevicesEdition.iDevice.voiceRecorder;

      globalThis.MediaRecorder = {
        isTypeSupported: vi.fn((type) => type === 'audio/mp4'),
      };
      expect(recorder.getPreferredMimeType()).toBe('audio/mp4');

      globalThis.MediaRecorder = {
        isTypeSupported: vi.fn((type) => type === 'audio/webm'),
      };
      expect(recorder.getPreferredMimeType()).toBe('audio/webm');
    });

    it('resolveAssetManager prioritizes explicit manager and falls back to Yjs manager', () => {
      const recorder = globalThis.$exeIDevicesEdition.iDevice.voiceRecorder;
      const explicitManager = { insertImage: vi.fn() };
      const fallbackManager = { insertImage: vi.fn() };
      const previousExeLearning = globalThis.window.eXeLearning;

      globalThis.window.eXeLearning = {
        app: {
          project: {
            _yjsBridge: {
              assetManager: fallbackManager,
            },
          },
        },
      };

      expect(recorder.resolveAssetManager(explicitManager)).toBe(explicitManager);
      expect(recorder.resolveAssetManager(null)).toBe(fallbackManager);

      globalThis.window.eXeLearning = previousExeLearning;
    });

    it('resolveAssetManager returns null when no manager is available', () => {
      const recorder = globalThis.$exeIDevicesEdition.iDevice.voiceRecorder;
      const previousExeLearning = globalThis.window.eXeLearning;

      delete globalThis.window.eXeLearning;
      expect(recorder.resolveAssetManager(null)).toBeNull();

      globalThis.window.eXeLearning = previousExeLearning;
    });

    it('sanitizeFileNameBase generates default and removes invalid chars', () => {
      const recorder = globalThis.$exeIDevicesEdition.iDevice.voiceRecorder;

      expect(recorder.sanitizeFileNameBase('')).toMatch(/^audio-rec-\d{8}-\d{6}$/);
      expect(recorder.sanitizeFileNameBase('casa.mp3')).toBe('casa');
      expect(recorder.sanitizeFileNameBase(' Audio prueba: 1 / test ')).toBe('Audio-prueba-1-test');
    });

    it('does not initialize when browser does not support recording', () => {
      const recorder = globalThis.$exeIDevicesEdition.iDevice.voiceRecorder;
      delete globalThis.navigator.mediaDevices;
      delete globalThis.MediaRecorder;

      document.body.innerHTML = `
        <div data-voice-recorder data-voice-input="#audioInput">
          <input id="audioInput" type="text" class="exe-file-picker" />
          <input type="button" class="exe-pick-any-file" value="Select a file" />
        </div>
      `;

      recorder.initVoiceRecorders(document.body);

      expect(document.querySelector('.exe-voice-recorder-toggle')).toBeNull();
    });

    it('starts recording after modal is shown (deferred start)', async () => {
      const recorder = globalThis.$exeIDevicesEdition.iDevice.voiceRecorder;
      const stream = { getTracks: () => [{ stop: vi.fn() }] };
      const startMock = vi.fn();

      globalThis.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      };

      globalThis.MediaRecorder = class {
        static isTypeSupported(type) {
          return type.indexOf('audio/webm') === 0;
        }
        constructor() {
          this.mimeType = 'audio/webm';
          this.state = 'inactive';
        }
        start() {
          this.state = 'recording';
          startMock();
        }
        stop() {
          this.state = 'inactive';
        }
      };

      document.body.innerHTML = `
        <div id="voice-container" data-voice-recorder data-voice-input="#audioInput">
          <input id="audioInput" type="text" class="exe-file-picker" />
          <input type="button" class="exe-pick-any-file" value="Select a file" />
        </div>
      `;

      recorder.initVoiceRecorders(document.body, { insertImage: vi.fn() });

      const toggle = document.querySelector('.exe-voice-recorder-toggle');
      toggle.click();

      await Promise.resolve();
      expect(startMock).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, recorder.startDelayMs + 25));
      expect(startMock).toHaveBeenCalledTimes(1);

      const cleanup = $('#voice-container').data('voiceRecorderCleanup');
      if (typeof cleanup === 'function') cleanup();
    });

    it('records and saves audio with AssetManager.insertImage', async () => {
      const recorder = globalThis.$exeIDevicesEdition.iDevice.voiceRecorder;
      const stopTrackMock = vi.fn();
      const insertImageMock = vi.fn().mockResolvedValue('asset://mock-id.webm');
      const stream = { getTracks: () => [{ stop: stopTrackMock }] };

      globalThis.navigator.mediaDevices = {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      };

      globalThis.MediaRecorder = class {
        static isTypeSupported(type) {
          return type.indexOf('audio/webm') === 0;
        }
        constructor(s, options) {
          this.stream = s;
          this.options = options;
          this.mimeType = options?.mimeType || 'audio/webm';
          this.state = 'inactive';
          this.ondataavailable = null;
          this.onstop = null;
        }
        start() {
          this.state = 'recording';
        }
        stop() {
          this.state = 'inactive';
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['audio'], { type: this.mimeType }), size: 5 });
          }
          if (this.onstop) {
            this.onstop();
          }
        }
      };

      document.body.innerHTML = `
        <div data-voice-recorder data-voice-input="#audioInput" data-voice-preview="#audioPreview">
          <input id="audioInput" type="text" class="exe-file-picker" />
          <input type="button" class="exe-pick-any-file" value="Select a file" />
          <audio id="audioPreview" class="d-none"></audio>
        </div>
      `;

      recorder.initVoiceRecorders(document.body, { insertImage: insertImageMock });

      const toggle = document.querySelector('.exe-voice-recorder-toggle');
      expect(toggle).toBeTruthy();

      toggle.click();
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, recorder.startDelayMs + 25));

      const stopBtn = document.querySelector('.exe-voice-recorder-stop');
      stopBtn.click();

      const saveBtn = document.querySelector('.exe-voice-recorder-save');
      saveBtn.click();
      await Promise.resolve();

      expect(insertImageMock).toHaveBeenCalledTimes(1);
      expect($('#audioInput').val()).toBe('asset://mock-id.webm');
      expect(stopTrackMock).toHaveBeenCalled();
    });
  });

  describe('gamification.helpers', () => {
    let mockAudioInstance;

    beforeEach(() => {
      mockAudioInstance = {
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        paused: true,
      };

      // Use a function constructor instead of vi.fn to properly mock Audio class
      globalThis.Audio = vi.fn().mockImplementation(function(url) {
        return mockAudioInstance;
      });

      // Reset helpers state
      globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio = null;
      globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl = null;
    });

    afterEach(() => {
      delete globalThis.Audio;
      delete globalThis.window.eXeLearningAssetResolver;
      delete globalThis.$exeDevices;
    });

    describe('playSound', () => {
      it('plays audio with a regular URL', async () => {
        const audioUrl = 'https://example.com/audio.mp3';

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(audioUrl);

        expect(globalThis.Audio).toHaveBeenCalledWith(audioUrl);
        expect(mockAudioInstance.play).toHaveBeenCalled();
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl).toBe(audioUrl);
      });

      it('returns early for invalid audio URL (null)', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(null);

        expect(consoleSpy).toHaveBeenCalledWith('playSound: Invalid audio URL');
        expect(globalThis.Audio).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('returns early for invalid audio URL (non-string)', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(123);

        expect(consoleSpy).toHaveBeenCalledWith('playSound: Invalid audio URL');
        expect(globalThis.Audio).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('stops currently playing audio when same URL is playing (toggle behavior)', async () => {
        const audioUrl = 'https://example.com/audio.mp3';

        // First play
        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(audioUrl);

        // Simulate audio is playing
        mockAudioInstance.paused = false;
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio = mockAudioInstance;
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl = audioUrl;

        // Second play with same URL - should toggle off
        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(audioUrl);

        expect(mockAudioInstance.pause).toHaveBeenCalled();
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl).toBeNull();
      });

      it('stops previous audio before playing new one', async () => {
        const audioUrl1 = 'https://example.com/audio1.mp3';
        const audioUrl2 = 'https://example.com/audio2.mp3';

        // First play
        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(audioUrl1);
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio = mockAudioInstance;

        // Create new mock for second audio
        const mockAudioInstance2 = {
          play: vi.fn().mockResolvedValue(undefined),
          pause: vi.fn(),
          paused: true,
        };
        globalThis.Audio = vi.fn().mockImplementation(function(url) {
          return mockAudioInstance2;
        });

        // Second play with different URL
        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(audioUrl2);

        expect(mockAudioInstance.pause).toHaveBeenCalled();
        expect(mockAudioInstance2.play).toHaveBeenCalled();
      });

      it('resolves asset:// URLs using eXeLearningAssetResolver', async () => {
        const assetUrl = 'asset://12345';
        const resolvedUrl = 'blob:https://example.com/resolved-audio';

        globalThis.window.eXeLearningAssetResolver = {
          resolve: vi.fn().mockResolvedValue(resolvedUrl),
        };

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(assetUrl);

        expect(globalThis.window.eXeLearningAssetResolver.resolve).toHaveBeenCalledWith(assetUrl);
        expect(globalThis.Audio).toHaveBeenCalledWith(resolvedUrl);
        expect(mockAudioInstance.play).toHaveBeenCalled();
      });

      it('returns early if asset:// URL cannot be resolved', async () => {
        const assetUrl = 'asset://12345';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        globalThis.window.eXeLearningAssetResolver = {
          resolve: vi.fn().mockResolvedValue(null),
        };

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(assetUrl);

        expect(consoleSpy).toHaveBeenCalledWith('playSound: Could not resolve asset URL');
        expect(globalThis.Audio).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('returns early if AssetResolver throws an error', async () => {
        const assetUrl = 'asset://12345';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        globalThis.window.eXeLearningAssetResolver = {
          resolve: vi.fn().mockRejectedValue(new Error('Resolver error')),
        };

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(assetUrl);

        expect(consoleSpy).toHaveBeenCalledWith('playSound: Error resolving asset URL:', expect.any(Error));
        expect(globalThis.Audio).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('returns early if AssetResolver is not available for asset:// URLs', async () => {
        const assetUrl = 'asset://12345';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        // No AssetResolver defined
        delete globalThis.window.eXeLearningAssetResolver;

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(assetUrl);

        expect(consoleSpy).toHaveBeenCalledWith('playSound: AssetResolver not available');
        expect(globalThis.Audio).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('uses extractURLGD for Google Drive URLs when $exeDevices is available', async () => {
        const gdUrl = 'https://drive.google.com/file/d/123/view?usp=sharing';
        const extractedUrl = 'https://docs.google.com/uc?export=open&id=123';

        globalThis.$exeDevices = {
          iDevice: {
            gamification: {
              media: {
                extractURLGD: vi.fn().mockReturnValue(extractedUrl),
              },
            },
          },
        };

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(gdUrl);

        expect(globalThis.$exeDevices.iDevice.gamification.media.extractURLGD).toHaveBeenCalledWith(gdUrl);
        expect(globalThis.Audio).toHaveBeenCalledWith(extractedUrl);
      });

      it('handles audio play error gracefully', async () => {
        const audioUrl = 'https://example.com/audio.mp3';
        const playError = new Error('Play failed');
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        mockAudioInstance.play = vi.fn().mockRejectedValue(playError);

        await globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playSound(audioUrl);

        expect(consoleSpy).toHaveBeenCalledWith('playSound: Error playing audio:', playError);

        consoleSpy.mockRestore();
      });
    });

    describe('stopSound', () => {
      it('stops playing audio and resets state', () => {
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio = mockAudioInstance;
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl = 'https://example.com/audio.mp3';

        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.stopSound();

        expect(mockAudioInstance.pause).toHaveBeenCalled();
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio).toBeNull();
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl).toBeNull();
      });

      it('does nothing if no audio is playing', () => {
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio = null;
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl = null;

        // Should not throw
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.stopSound();

        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio).toBeNull();
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl).toBeNull();
      });

      it('resets currentAudioUrl even if playerAudio has no pause function', () => {
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.playerAudio = {};
        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl = 'https://example.com/audio.mp3';

        globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.stopSound();

        // playerAudio should remain unchanged (no pause to call)
        expect(globalThis.$exeIDevicesEdition.iDevice.gamification.helpers.currentAudioUrl).toBeNull();
      });
    });
  });

  /**
   * progressBar.getValues() has two return shapes: the values, or `false` after
   * it has warned about a report identifier shorter than five characters. Every
   * caller has to honour the second one.
   *
   * Reading `.evaluation` off `false` yields undefined instead of throwing, so a
   * caller that forgets carries on and saves the activity with the report
   * silently switched off -- the author sees the warning, presses save, and the
   * form accepts it. That is exactly what happened to two iDevices when their
   * forms moved to this shared block, and nothing failed to tell us.
   *
   * Scanning the callers is the only check that covers all of them at once, and
   * the only one that catches the next iDevice to adopt the block.
   */
  describe('progress report guard across every iDevice', () => {
    const IDEVICES_DIR = join(__dirname, '..', '..', 'files', 'perm', 'idevices', 'base');

    const callers = readdirSync(IDEVICES_DIR)
      .map((name) => ({ name, dir: join(IDEVICES_DIR, name, 'edition') }))
      .filter(({ dir }) => existsSync(dir))
      .flatMap(({ name, dir }) =>
        readdirSync(dir)
          .filter((file) => file.endsWith('.js') && !file.endsWith('.test.js'))
          .map((file) => ({ name, source: readFileSync(join(dir, file), 'utf-8') }))
      )
      .filter(({ source }) => source.includes('gamification.progressBar.getValues()'));

    it('finds the iDevices that read the shared progress report', () => {
      // A guard rail for the scan itself: a rename that made the filter match
      // nothing would leave every assertion below vacuously green.
      expect(callers.length).toBeGreaterThan(30);
    });

    it.each(callers.map(({ name }) => name))('%s rejects an invalid report identifier', (name) => {
      const { source } = callers.find((caller) => caller.name === name);
      // The iDevices do not agree on a name for the result -- most call it
      // `progressBar`, interactive-video calls it `progressBarValues` -- so the
      // guard is looked up by whatever each one assigned it to. Refactored
      // iDevices call $exeIDevicesEdition, the rest still $exeDevicesEdition.
      const assignment = source.match(
        /(\w+)\s*=\s*\$exeI?DevicesEdition\.iDevice\.gamification\.progressBar\.getValues\(\)/
      );
      expect(assignment).not.toBeNull();
      expect(source).toMatch(new RegExp(`if\\s*\\(!${assignment[1]}\\)\\s*return false;`));
    });
  });

  /**
   * These helpers create resources that live outside the edition form —
   * handlers on `document` and `window`, timers, object URLs, audio and a
   * microphone stream. They belong to the edition that created them, which
   * `IdeviceNode` publishes as `window.$exeEditionLifecycle`, so closing the
   * editor must release every one of them.
   *
   * Behaviour without a lifecycle is covered by every other test in this file:
   * none of them opens an edition.
   */
  describe('edition lifecycle ownership', () => {
    const iDevice = () => globalThis.$exeIDevicesEdition.iDevice;
    let lifecycle = null;

    const openEdition = () => {
      lifecycle = global.attachEditionLifecycle({ name: 'lifecycle-test-device' });
      return lifecycle;
    };

    const closeEdition = () => {
      if (lifecycle) lifecycle.destroy();
      lifecycle = null;
      window.$exeEditionLifecycle = null;
    };

    afterEach(() => {
      closeEdition();
      // Registrations made through the no-lifecycle fallback paths.
      $(document).off(
        'click.filepicker click.exeFileTrigger change.exeFileInput'
      );
    });

    describe('getLifecycle', () => {
      it('returns null when no editor is open', () => {
        window.$exeEditionLifecycle = null;
        expect(iDevice().getLifecycle()).toBeNull();
      });

      it('returns null once the edition it belongs to has been closed', () => {
        const active = openEdition();
        expect(iDevice().getLifecycle()).toBe(active);

        active.destroy();

        expect(iDevice().getLifecycle()).toBeNull();
      });
    });

    describe('document handlers', () => {
      it('drops the import file-picker handlers', () => {
        document.body.innerHTML = `
          <div data-exe-upload>
            <input type="file" class="exe-file-input" />
            <button type="button" data-exe-file-trigger>choose</button>
            <span data-exe-file-name>none</span>
          </div>
        `;
        const fileInputClicks = vi.fn();
        document.querySelector('.exe-file-input').addEventListener('click', fileInputClicks);

        openEdition();
        iDevice().gamification.share.addEvents(0, vi.fn());

        $('[data-exe-file-trigger]').trigger('click');
        expect(fileInputClicks).toHaveBeenCalledTimes(1);

        lifecycle.destroy();
        $('[data-exe-file-trigger]').trigger('click');

        expect(fileInputClicks).toHaveBeenCalledTimes(1);
      });

      it('drops the file-manager button handler', () => {
        document.body.innerHTML = '<input type="text" id="lifecyclePicker" class="exe-image-picker" />';
        const show = globalThis.eXeLearning.app.modals.filemanager.show;
        show.mockClear();

        openEdition();
        iDevice().filePicker.init();

        document.querySelector('.exe-pick-image').click();
        expect(show).toHaveBeenCalledTimes(1);

        lifecycle.destroy();
        document.querySelector('.exe-pick-image').click();

        expect(show).toHaveBeenCalledTimes(1);
      });
    });

    describe('AI question generation', () => {
      const mountIAForm = () => {
        document.body.innerHTML = `
          <div id="eXeFormIAContainer"><textarea id="eXeThemeIA"></textarea></div>
          <p id="eXeIAMessage"></p>
        `;
      };

      const withApi = async (implementation, run) => {
        const previous = globalThis.eXeLearning.app.api.getGenerateQuestions;
        globalThis.eXeLearning.app.api.getGenerateQuestions = vi.fn(implementation);
        try {
          await run();
        } finally {
          globalThis.eXeLearning.app.api.getGenerateQuestions = previous;
        }
      };

      it('delivers generated questions while the editor is still open', async () => {
        mountIAForm();
        const saveQuestions = vi.fn();

        await withApi(
          () => Promise.resolve({ questions: ['Heart#A muscular organ'] }),
          async () => {
            openEdition();
            await iDevice().gamification.share.genarateIAQuestons(0, saveQuestions);

            expect(saveQuestions).toHaveBeenCalledWith(['Heart#A muscular organ']);
          }
        );
      });

      it('drops generated questions that arrive after the editor closed', async () => {
        mountIAForm();
        const saveQuestions = vi.fn();
        let resolveRequest;

        await withApi(
          () =>
            new Promise((resolve) => {
              resolveRequest = resolve;
            }),
          async () => {
            openEdition();
            const pending = iDevice().gamification.share.genarateIAQuestons(0, saveQuestions);

            lifecycle.destroy();
            resolveRequest({ questions: ['Heart#A muscular organ'] });
            await pending;

            expect(saveQuestions).not.toHaveBeenCalled();
          }
        );
      });

      // Review H5: the success path was guarded, the error path was not. The
      // form of the next edition — B — shares these ids, so a stale failure
      // from A rewrote B's message and re-enabled B's controls mid-request.
      it('keeps a late failure out of the form of the next edition', async () => {
        mountIAForm();
        let failRequest;

        await withApi(
          () =>
            new Promise((_resolve, reject) => {
              failRequest = reject;
            }),
          async () => {
            openEdition();
            const pending = iDevice().gamification.share.genarateIAQuestons(0, vi.fn());

            lifecycle.destroy();
            // B opens its own form, with a request of its own in flight.
            mountIAForm();
            openEdition();
            document.getElementById('eXeIAMessage').textContent = 'B is generating';
            document.getElementById('eXeThemeIA').disabled = true;

            failRequest(new Error('network'));
            await pending;

            expect(document.getElementById('eXeIAMessage').textContent).toBe('B is generating');
            expect(document.getElementById('eXeThemeIA').disabled).toBe(true);
          }
        );
      });

      it('reports a failure while the editor is still open', async () => {
        mountIAForm();

        await withApi(
          () => Promise.reject(new Error('network')),
          async () => {
            openEdition();
            await iDevice().gamification.share.genarateIAQuestons(0, vi.fn());

            expect(document.getElementById('eXeIAMessage').textContent).not.toBe('');
            expect(document.getElementById('eXeThemeIA').disabled).toBe(false);
          }
        );
      });
    });

    describe('downloadBlob', () => {
      it('revokes the object URL and removes the anchor when the editor closes first', () => {
        vi.useFakeTimers();
        const createSpy = vi
          .spyOn(window.URL, 'createObjectURL')
          .mockReturnValue('blob:lifecycle-download');
        const revokeSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

        try {
          openEdition();
          const started = iDevice().gamification.share.downloadBlob(
            new Blob(['data'], { type: 'text/plain' }),
            'game.json'
          );

          expect(started).toBe(true);
          expect(document.querySelector('a[download="game.json"]')).toBeTruthy();

          lifecycle.destroy();

          expect(revokeSpy).toHaveBeenCalledTimes(1);
          expect(revokeSpy).toHaveBeenCalledWith('blob:lifecycle-download');
          expect(document.querySelector('a[download="game.json"]')).toBeNull();

          // The cancelled timer must not revoke a second time.
          vi.advanceTimersByTime(1000);
          expect(revokeSpy).toHaveBeenCalledTimes(1);
        } finally {
          createSpy.mockRestore();
          revokeSpy.mockRestore();
          vi.useRealTimers();
        }
      });

      it('still revokes the object URL on its own timer while the editor stays open', () => {
        vi.useFakeTimers();
        const createSpy = vi
          .spyOn(window.URL, 'createObjectURL')
          .mockReturnValue('blob:lifecycle-download');
        const revokeSpy = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});

        try {
          openEdition();
          iDevice().gamification.share.downloadBlob(
            new Blob(['data'], { type: 'text/plain' }),
            'game.json'
          );

          vi.advanceTimersByTime(200);

          expect(revokeSpy).toHaveBeenCalledTimes(1);
          expect(document.querySelector('a[download="game.json"]')).toBeNull();

          // Already released: teardown must not revoke it again.
          lifecycle.destroy();
          expect(revokeSpy).toHaveBeenCalledTimes(1);
        } finally {
          createSpy.mockRestore();
          revokeSpy.mockRestore();
          vi.useRealTimers();
        }
      });
    });

    describe('gamification.helpers audio', () => {
      let previousAudio;

      const useAudioMock = (instance) => {
        previousAudio = globalThis.Audio;
        // `new Audio(url)` needs a real constructor, not an arrow function.
        const ctor = vi.fn(function () {
          return instance;
        });
        globalThis.Audio = ctor;
        return ctor;
      };

      afterEach(() => {
        if (previousAudio === undefined) delete globalThis.Audio;
        else globalThis.Audio = previousAudio;
        previousAudio = undefined;
        delete window.eXeLearningAssetResolver;
        iDevice().gamification.helpers.playerAudio = null;
        iDevice().gamification.helpers.currentAudioUrl = null;
      });

      it('stops audio started by the edition when the editor closes', async () => {
        const instance = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), paused: false };
        useAudioMock(instance);
        const helpers = iDevice().gamification.helpers;
        helpers.playerAudio = null;
        helpers.currentAudioUrl = null;

        openEdition();
        await helpers.playSound('https://example.com/audio.mp3');
        expect(instance.play).toHaveBeenCalledTimes(1);

        lifecycle.destroy();

        expect(instance.pause).toHaveBeenCalledTimes(1);
        expect(helpers.playerAudio).toBeNull();
        expect(helpers.currentAudioUrl).toBeNull();
      });

      it('does not stop audio twice when it was already stopped by the user', async () => {
        const instance = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), paused: false };
        useAudioMock(instance);
        const helpers = iDevice().gamification.helpers;
        helpers.playerAudio = null;
        helpers.currentAudioUrl = null;

        openEdition();
        await helpers.playSound('https://example.com/audio.mp3');
        helpers.stopSound();
        expect(instance.pause).toHaveBeenCalledTimes(1);

        lifecycle.destroy();

        expect(instance.pause).toHaveBeenCalledTimes(1);
      });

      it('does not start audio resolved after the editor closed', async () => {
        const instance = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), paused: true };
        const ctor = useAudioMock(instance);
        let resolveAsset;
        window.eXeLearningAssetResolver = {
          resolve: vi.fn(
            () =>
              new Promise((resolve) => {
                resolveAsset = resolve;
              })
          ),
        };
        const helpers = iDevice().gamification.helpers;
        helpers.playerAudio = null;
        helpers.currentAudioUrl = null;

        openEdition();
        const pending = helpers.playSound('asset://recording.webm');
        lifecycle.destroy();
        resolveAsset('blob:resolved-audio');
        await pending;

        expect(ctor).not.toHaveBeenCalled();
        expect(helpers.playerAudio).toBeNull();
        expect(helpers.currentAudioUrl).toBeNull();
      });

      // Review H8: both calls passed stopSound() before either had a player,
      // then both created one and the shared reference kept only the last —
      // so teardown could stop only that one and the first kept playing.
      it('leaves no player outside cleanup when two resolutions overlap', async () => {
        const players = [];
        previousAudio = globalThis.Audio;
        globalThis.Audio = vi.fn(function () {
          const player = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(function () { this.paused = true; }), paused: false };
          players.push(player);
          return player;
        });
        const pendingResolutions = [];
        window.eXeLearningAssetResolver = {
          resolve: vi.fn(() => new Promise((resolve) => pendingResolutions.push(resolve))),
        };
        const helpers = iDevice().gamification.helpers;

        openEdition();
        const first = helpers.playSound('asset://first.webm');
        const second = helpers.playSound('asset://second.webm');
        pendingResolutions[0]('blob:first');
        pendingResolutions[1]('blob:second');
        await Promise.all([first, second]);

        lifecycle.destroy();

        expect(players.length).toBeGreaterThan(0);
        expect(players.every((player) => player.paused)).toBe(true);
        // Only the request made last may start playing.
        expect(globalThis.Audio).toHaveBeenCalledTimes(1);
        expect(globalThis.Audio).toHaveBeenCalledWith('blob:second');
      });

      it('does not start audio whose resolution finished after stopSound()', async () => {
        const instance = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), paused: true };
        const ctor = useAudioMock(instance);
        let resolveAsset;
        window.eXeLearningAssetResolver = {
          resolve: vi.fn(() => new Promise((resolve) => (resolveAsset = resolve))),
        };
        const helpers = iDevice().gamification.helpers;

        openEdition();
        const pending = helpers.playSound('asset://recording.webm');
        helpers.stopSound();
        resolveAsset('blob:resolved-audio');
        await pending;

        expect(ctor).not.toHaveBeenCalled();
      });
    });

    describe('voiceRecorder', () => {
      afterEach(() => {
        delete globalThis.MediaRecorder;
        delete globalThis.navigator.mediaDevices;
      });

      it('stops the microphone and removes the recorder UI when the editor closes', async () => {
        const stopTrack = vi.fn();
        const stream = { getTracks: () => [{ stop: stopTrack }] };
        globalThis.navigator.mediaDevices = {
          getUserMedia: vi.fn().mockResolvedValue(stream),
        };
        globalThis.MediaRecorder = class {
          static isTypeSupported(type) {
            return type.indexOf('audio/webm') === 0;
          }
          constructor() {
            this.mimeType = 'audio/webm';
            this.state = 'inactive';
          }
          start() {
            this.state = 'recording';
          }
          stop() {
            this.state = 'inactive';
          }
        };

        const recorder = iDevice().voiceRecorder;
        document.body.innerHTML = `
          <div id="voice-lifecycle" data-voice-recorder data-voice-input="#audioInput">
            <input id="audioInput" type="text" class="exe-file-picker" />
            <input type="button" class="exe-pick-any-file" value="Select a file" />
          </div>
        `;
        const container = document.getElementById('voice-lifecycle');

        openEdition();
        recorder.initVoiceRecorders(document.body, { insertImage: vi.fn() });

        document.querySelector('.exe-voice-recorder-toggle').click();
        await new Promise((resolve) => setTimeout(resolve, recorder.startDelayMs + 25));

        expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
        expect(recorder.instances.some((entry) => entry.containerEl === container)).toBe(true);
        expect(document.querySelector('.exe-voice-recorder-fallback-modal')).toBeTruthy();

        lifecycle.destroy();

        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(recorder.instances.some((entry) => entry.containerEl === container)).toBe(false);
        expect(document.querySelector('.exe-voice-recorder-fallback-modal')).toBeNull();
      });

      const mountRecorder = (id) => {
        document.body.innerHTML = `
          <div id="${id}" data-voice-recorder data-voice-input="#audioInput">
            <input id="audioInput" type="text" class="exe-file-picker" />
            <input type="button" class="exe-pick-any-file" value="Select a file" />
          </div>
        `;
      };

      // Review H7: a real MediaRecorder delivers `stop` asynchronously. The
      // handler outlived cleanup, then built a blob, an object URL and
      // reopened a modal that had already been disposed.
      it('ignores a stop event delivered after the editor closed', async () => {
        const stream = { getTracks: () => [{ stop: vi.fn() }] };
        globalThis.navigator.mediaDevices = { getUserMedia: vi.fn().mockResolvedValue(stream) };
        let liveRecorder;
        globalThis.MediaRecorder = class {
          static isTypeSupported() {
            return true;
          }
          constructor() {
            this.mimeType = 'audio/webm';
            this.state = 'inactive';
            liveRecorder = this;
          }
          start() {
            this.state = 'recording';
          }
          stop() {
            this.state = 'inactive';
            // Delivered later, like the browser does.
            this.pendingStop = () => this.onstop && this.onstop();
          }
        };
        const createObjectURL = vi.spyOn(window.URL, 'createObjectURL');
        const recorder = iDevice().voiceRecorder;
        mountRecorder('voice-late-stop');

        openEdition();
        recorder.initVoiceRecorders(document.body, { insertImage: vi.fn() });
        document.querySelector('.exe-voice-recorder-toggle').click();
        await new Promise((resolve) => setTimeout(resolve, recorder.startDelayMs + 25));
        expect(liveRecorder.state).toBe('recording');

        lifecycle.destroy();
        expect(() => liveRecorder.pendingStop()).not.toThrow();

        expect(createObjectURL).not.toHaveBeenCalled();
        expect(document.querySelector('.exe-voice-recorder-fallback-modal')).toBeNull();
        createObjectURL.mockRestore();
      });

      // Review H9: permission granted after the editor closed used to start a
      // recorder nobody could stop, on a live microphone track.
      it('releases a microphone granted after the editor closed, without recording', async () => {
        const stopTrack = vi.fn();
        const stream = { getTracks: () => [{ stop: stopTrack }] };
        let grant;
        globalThis.navigator.mediaDevices = {
          getUserMedia: vi.fn(() => new Promise((resolve) => (grant = resolve))),
        };
        const constructed = vi.fn();
        globalThis.MediaRecorder = class {
          static isTypeSupported() {
            return true;
          }
          constructor() {
            constructed();
            this.state = 'inactive';
          }
          start() {
            this.state = 'recording';
          }
          stop() {
            this.state = 'inactive';
          }
        };
        const recorder = iDevice().voiceRecorder;
        mountRecorder('voice-late-grant');

        openEdition();
        recorder.initVoiceRecorders(document.body, { insertImage: vi.fn() });
        document.querySelector('.exe-voice-recorder-toggle').click();
        expect(globalThis.navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

        lifecycle.destroy();
        grant(stream);
        await new Promise((resolve) => setTimeout(resolve, recorder.startDelayMs + 25));

        expect(constructed).not.toHaveBeenCalled();
        expect(stopTrack).toHaveBeenCalledTimes(1);
      });

      it('shows nothing when the permission is refused after the editor closed', async () => {
        let refuse;
        globalThis.navigator.mediaDevices = {
          getUserMedia: vi.fn(() => new Promise((_resolve, reject) => (refuse = reject))),
        };
        globalThis.MediaRecorder = class {
          static isTypeSupported() {
            return true;
          }
        };
        const recorder = iDevice().voiceRecorder;
        mountRecorder('voice-late-refusal');

        openEdition();
        recorder.initVoiceRecorders(document.body, { insertImage: vi.fn() });
        const toggle = document.querySelector('.exe-voice-recorder-toggle');
        toggle.click();
        lifecycle.destroy();
        refuse(new Error('NotAllowedError'));
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(document.querySelector('.exe-voice-recorder-error:not(.d-none)')).toBeNull();
      });

      it('rebinds its page-level cleanup handlers for the next edition', () => {
        const recorder = iDevice().voiceRecorder;
        const cleanupAll = vi.spyOn(recorder, 'cleanupAll').mockImplementation(() => {});
        const previousBound = recorder._cleanupBound;
        const previousObserver = recorder._detachObserver;
        recorder._cleanupBound = false;
        recorder._detachObserver = null;

        try {
          // Earlier tests bound the page handlers without a lifecycle, so
          // count what a `pagehide` already triggers before this edition adds
          // its own handler.
          window.dispatchEvent(new window.Event('pagehide'));
          const alreadyBound = cleanupAll.mock.calls.length;

          openEdition();
          recorder.bindCleanupHandlers();
          expect(recorder._cleanupBound).toBe(true);

          cleanupAll.mockClear();
          window.dispatchEvent(new window.Event('pagehide'));
          expect(cleanupAll).toHaveBeenCalledTimes(alreadyBound + 1);

          lifecycle.destroy();
          cleanupAll.mockClear();
          window.dispatchEvent(new window.Event('pagehide'));

          expect(cleanupAll).toHaveBeenCalledTimes(alreadyBound);
          expect(recorder._cleanupBound).toBe(false);
          expect(recorder._detachObserver).toBeNull();
        } finally {
          cleanupAll.mockRestore();
          recorder._cleanupBound = previousBound;
          recorder._detachObserver = previousObserver;
        }
      });
    });
  });
});

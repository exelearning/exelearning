/**
 * Unit tests for interactive-video iDevice (edition)
 *
 * The form is built with the real shared edition object; only the
 * application's tooltips and Bootstrap stand in.
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('interactive-video iDevice edition', () => {
  let $exeDevice;
  let previousApp;
  let tooltips;

  beforeEach(() => {
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
    previousApp = global.eXeLearning.app;
    tooltips = new Map();
    global.eXeLearning.app = {
      ...previousApp,
      common: {
        initTooltips: vi.fn((scope) => {
          scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
            if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
          });
        }),
      },
    };
    vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });

    $exeDevice = global.loadIdevice(join(__dirname, 'interactive-video.js'));
  });

  afterEach(() => {
    $exeDevice?.$lifecycle?.destroy();
    global.eXeLearning.app = previousApp;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
  });

  it('hands its asset path to the Grading tab, which offers the progress report with it', () => {
    const container = document.createElement('div');
    const path = '/files/perm/idevices/base/interactive-video/edition/';
    document.body.appendChild(container);

    $exeDevice.init(container, '', path);

    expect(
      document.querySelector('#interactiveVideoIdeviceForm-panel-grading .exe-progress-report-wrapper')
    ).not.toBeNull();
  });

  // The defect: loadPreviousValues called scorm.setValues with three
  // arguments, so the helper's own default (100) filled the weight field
  // instead of the stored value — and the next save read that 100 back out of
  // the form and overwrote what the author had chosen.
  describe('the SCORM weight reaches the form', () => {
    let setValues;
    let previousTop;

    /** The exported markup the editor parses, carrying just the SCORM block. */
    function previousDataWith(scorm) {
      const json = JSON.stringify({ slides: [], scorm });
      return `<div><script id="exe-interactive-video-contents" type="application/json">${json}</script></div>`;
    }

    beforeEach(() => {
      setValues = vi
        .spyOn($exeIDevicesEdition.iDevice.gamification.scorm, 'setValues')
        .mockImplementation(() => {});
      previousTop = global.top;
      global.top = { interactiveVideoEditor: {} };
    });

    afterEach(() => {
      global.top = previousTop;
    });

    it('hands over the weight the author stored', () => {
      $exeDevice.idevicePreviousData = previousDataWith({
        isScorm: 1,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 40,
      });

      $exeDevice.loadPreviousValues();

      expect(setValues).toHaveBeenCalledWith(1, 'Save score', true, 40);
    });

    it('passes a weight of 0 through instead of falling back to 100', () => {
      $exeDevice.idevicePreviousData = previousDataWith({
        isScorm: 1,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 0,
      });

      $exeDevice.loadPreviousValues();

      expect(setValues.mock.calls[0][3]).toBe(0);
    });

    // Saved before the field existed: undefined must reach the helper so its
    // own default applies, rather than the argument being dropped entirely.
    it('leaves the helper to default an activity with no stored weight', () => {
      $exeDevice.idevicePreviousData = previousDataWith({
        isScorm: 1,
        textButtonScorm: 'Save score',
        repeatActivity: true,
      });

      $exeDevice.loadPreviousValues();

      expect(setValues.mock.calls[0]).toHaveLength(4);
      expect(setValues.mock.calls[0][3]).toBeUndefined();
    });
  });

  /**
   * Saving a score needs something to score. The mark is hits over the number
   * of scorable slides, so with none of them the division has no denominator
   * and the activity could only ever report a zero the learner did nothing to
   * earn. This is the same criterion the export counts with, so the editor and
   * the runtime cannot disagree.
   */
  describe('shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/interactive-video/edition/';
    const panel = (name) => document.getElementById(`interactiveVideoIdeviceForm-panel-${name}`);
    const stored = `
      <div class="exe-interactive-video-content-before"><p>Watch carefully</p></div>
      <div class="exe-interactive-video exe-interactive-video-no-results">
        <p id="exe-interactive-video-file" class="js-hidden"><a href="files/tmp/video.mp4">mp4</a></p>
        <script id="exe-interactive-video-contents" type="application/json">{"slides":[],"scoreNIA":true}</script>
      </div>
      <div class="exe-interactive-video-content-after"><p>Well done</p></div>`;
    let previousTop;

    beforeEach(() => {
      previousTop = global.top;
      global.top = {};
    });

    afterEach(() => {
      global.top = previousTop;
    });

    const open = (previousData = '') => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      $exeDevice.init(container, previousData, PATH);
    };

    it('lays the form out in the shared tabs, and opens on the video', () => {
      open();
      const tabNames = [...document.querySelectorAll('#interactiveVideoIdeviceForm-tabs [data-exe-tab]')].map(
        (tab) => tab.getAttribute('data-exe-tab')
      );

      expect(tabNames).toEqual(['instructions', 'options', 'contents', 'after', 'grading', 'texts']);
      expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
      open();

      expect(panel('instructions').querySelector('#eXeGameInstructions')).not.toBeNull();
      expect(panel('options').querySelector('#interactiveVideoShowResults')).not.toBeNull();
      expect(panel('options').querySelector('#interactiveVideoScoreNIA')).not.toBeNull();
      expect(panel('contents').querySelector('#interactiveVideoType-youtube')).not.toBeNull();
      expect(panel('contents').querySelector('#interactiveVideoFile')).not.toBeNull();
      expect(panel('contents').querySelector('#interactiveVideoOpenEditor')).not.toBeNull();
      expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
      expect(panel('texts').querySelector('#ci18n_start').value).toBe('Start');
    });

    it('says what goes in the Instructions and Questions tabs, and offers no sharing', () => {
      open();

      expect(panel('instructions').firstElementChild.textContent).toContain(
        'Write the text the learners will read before the video.'
      );
      expect(panel('contents').firstElementChild.textContent).toContain(
        'Choose the video, then open the editor to add its slides'
      );
      expect(document.querySelectorAll('[data-exe-share], .exe-block-success, #interactiveVideoIdeviceForm fieldset')).toHaveLength(0);
    });

    it('provides one accessible information button at the end of each options row', () => {
      open();
      const helpButtons = [...panel('options').querySelectorAll('.exe-idevice-help')];

      expect(helpButtons).toHaveLength(2);
      for (const help of helpButtons) {
        const row = help.closest('.d-flex');
        expect(row.lastElementChild.contains(help)).toBe(true);
        expect(help.getAttribute('aria-label')).toBe(help.title);
        expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
        const input = row.querySelector('input');
        const checked = input.checked;
        help.click();
        document.getElementById(help.getAttribute('aria-controls')).click();
        expect(input.checked).toBe(checked);
      }
    });

    it('disposes all option tooltips when the edition closes', () => {
      open();

      expect(tooltips.size).toBe(document.querySelectorAll('#interactiveVideoIdeviceForm .exe-app-tooltip').length);
      expect(tooltips.size).toBeGreaterThanOrEqual(2);
      $exeDevice.$lifecycle.destroy();
      for (const tooltip of tooltips.values()) {
        expect(tooltip.dispose).toHaveBeenCalledTimes(1);
      }
    });

    it('leaves the state of each switch to its native checkbox', () => {
      open();

      document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

      expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('reopens the content before the video in the Instructions tab, and saves it where it was', () => {
      open(stored);
      expect(document.getElementById('eXeGameInstructions').value).toBe('<p>Watch carefully</p>');
      const editors = {
        eXeGameInstructions: '<p>Watch carefully</p>',
        eXeIdeviceTextAfter: '<p>Well done</p>',
      };
      vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
        id in editors ? { getContent: () => editors[id] } : null
      );

      const html = $exeDevice.save();

      expect(html).toContain('<div class="exe-interactive-video-content-before"><p>Watch carefully</p></div>');
      expect(html).toContain('<div class="exe-interactive-video-content-after"><p>Well done</p></div>');
      expect(html).not.toContain('exe-idevice-help');
    });
  });

  describe('hasScorableSlide', () => {
    const question = { type: 'singleChoice' };
    const picture = { type: 'image' };

    it.each([
      ['singleChoice'],
      ['multipleChoice'],
      ['dropdown'],
      ['matchElements'],
      ['sortableList'],
      ['cloze'],
    ])('counts a %s slide', type => {
      expect($exeDevice.hasScorableSlide([picture, { type }], false)).toBe(true);
    });

    it('does not count slides the learner cannot answer', () => {
      expect(
        $exeDevice.hasScorableSlide(
          [picture, { type: 'text' }, { type: 'pause' }],
          false
        )
      ).toBe(false);
    });

    // With "score every slide" ticked the export counts them all, so anything
    // at all gives the division a denominator.
    it('counts any slide when every slide scores', () => {
      expect($exeDevice.hasScorableSlide([picture], true)).toBe(true);
    });

    it.each([
      ['no slides', [], true],
      ['a missing list', undefined, true],
      ['no slides without the option', [], false],
    ])('answers false for %s', (_label, slides, scoreNIA) => {
      expect($exeDevice.hasScorableSlide(slides, scoreNIA)).toBe(false);
    });

    it('survives a malformed slide', () => {
      expect(() =>
        $exeDevice.hasScorableSlide([null, question], false)
      ).not.toThrow();
      expect($exeDevice.hasScorableSlide([null, question], false)).toBe(true);
    });
  });

  /**
   * The pass-score control is a shared block in common_edition.js, exercised by
   * its own tests. What is specific to this iDevice -- and what silently breaks
   * if someone edits the form -- is the wiring: all four call sites have to be
   * present, and the two saved fields have to reach the stored data. Reading
   * the source is how that is checked without standing up the whole edition
   * form.
   */
  describe('pass score wiring', () => {
    let source;

    beforeEach(() => {
      source = readFileSync(join(__dirname, 'interactive-video.js'), 'utf-8');
    });

    it('delegates the evaluation controls to the shared tab', () => {
        // The pass score and the progress report used to be rendered here,
        // loose in the general options. They now live in the Grading tab,
        // so rendering them again would show each control twice.
        expect(source).not.toContain('passScore.getContents(');
        expect(source).not.toContain('progressBar.getContents(');
        expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: true/);
    });

    it('restores the control when the iDevice is reopened', () => {
      expect(source).toContain('gamification.passScore.setValues(');
      expect(source).toContain('passScoreMode: InteractiveVideo.passScoreMode');
      expect(source).toContain('passScoreCustom: InteractiveVideo.passScoreCustom');
    });

    it('saves the mode and the customised mark into the serialised activity', () => {
      // This iDevice persists through activityToSave, which is JSON.stringified.
      expect(source).toContain('gamification.passScore.getValues()');
      expect(source).toContain('activityToSave.passScoreMode');
      expect(source).toContain('activityToSave.passScoreCustom');
      // The project value is never copied into the iDevice: it is read live, so
      // an iDevice on the global mode follows the project.
      expect(source).not.toContain('passScoreGlobal');
    });

    it('wires the radio and input handlers', () => {
      expect(source).toContain('gamification.passScore.addEvents()');
    });
  });

  describe('edition lifecycle teardown (#2293)', () => {
    let show;
    let hide;
    let dispose;
    let iframeLoading;

    beforeEach(() => {
      // The editor modal embeds the editor in an iframe. Let happy-dom create
      // the element without navigating to it: the test is about who owns the
      // modal, not about what the editor page does.
      iframeLoading = window.happyDOM.settings.disableIframePageLoading;
      window.happyDOM.settings.disableIframePageLoading = true;
      show = vi.fn();
      dispose = vi.fn();
      // Bootstrap's own `show()`/`hide()` put the scroll lock and the backdrop
      // on <body> and take them off again; the fake reproduces just that, which
      // is what teardown has to leave behind cleanly.
      hide = vi.fn(() => {
        document.body.classList.remove('modal-open');
        document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
      });
      window.__EXE_STATIC_MODE__ = true;
      global.bootstrap = {
        Tooltip: { getInstance: (button) => tooltips.get(button) },
        Modal: function () {
          return {
            show: vi.fn(() => {
              document.body.classList.add('modal-open');
              document.body.appendChild(
                Object.assign(document.createElement('div'), { className: 'modal-backdrop' })
              );
              document.getElementById('modalGenericIframeContainer')?.classList.add('show');
              show();
            }),
            hide,
            dispose,
          };
        },
      };
      // createForm reads `top.interactiveVideoEditor`. SCORM tests also set this
      // and must restore it, so this suite cannot rely on leftover global state.
      global.top = { interactiveVideoEditor: {} };

      const container = document.createElement('div');
      document.body.appendChild(container);
      $exeDevice.init(container, '', '/files/perm/idevices/base/interactive-video/edition/');
      $('#interactiveVideoFile').val('files/tmp/video.mp4');
    });

    afterEach(() => {
      window.happyDOM.settings.disableIframePageLoading = iframeLoading;
      delete window.__EXE_STATIC_MODE__;
      delete global.bootstrap;
      document.body.classList.remove('modal-open');
      document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
    });

    it('opens the editor modal with its stylesheet', () => {
      $exeDevice.editor.start();

      expect(show).toHaveBeenCalledTimes(1);
      expect(document.getElementById('modalGenericIframeContainer')).not.toBeNull();
      expect(document.getElementById('modalGenericIframeContainerCSS')).not.toBeNull();
    });

    it('disposes and removes the editor modal when the edition closes', () => {
      $exeDevice.editor.start();

      $exeDevice.$lifecycle.destroy();

      expect(dispose).toHaveBeenCalledTimes(1);
      expect(document.getElementById('modalGenericIframeContainer')).toBeNull();
      expect(document.getElementById('modalGenericIframeContainerCSS')).toBeNull();
    });

    /**
     * Bootstrap's `dispose()` drops the instance without hiding it, so a
     * teardown with the modal still open — a page switch — would leave the page
     * scroll-locked behind a backdrop with no modal to close.
     */
    it('hides the modal before disposing it, so the page is usable again', () => {
      $exeDevice.editor.start();
      expect(document.body.classList.contains('modal-open')).toBe(true);

      $exeDevice.$lifecycle.destroy();

      expect(hide).toHaveBeenCalledTimes(1);
      expect(hide.mock.invocationCallOrder[0]).toBeLessThan(dispose.mock.invocationCallOrder[0]);
      expect(document.body.classList.contains('modal-open')).toBe(false);
      expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(0);
    });

    /**
     * `hide()` is a no-op while Bootstrap is mid-transition, so what it may have
     * left behind is swept — but only once nothing else is on screen.
     */
    it('sweeps a scroll lock that hide() could not clear', () => {
      hide.mockImplementation(() => {});
      $exeDevice.editor.start();

      $exeDevice.$lifecycle.destroy();

      expect(document.body.classList.contains('modal-open')).toBe(false);
      expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(0);
    });

    it('leaves the scroll lock alone while another modal is still open', () => {
      hide.mockImplementation(() => {});
      $exeDevice.editor.start();
      const other = document.createElement('div');
      other.className = 'modal show';
      document.body.appendChild(other);

      $exeDevice.$lifecycle.destroy();

      expect(document.body.classList.contains('modal-open')).toBe(true);
      expect(document.querySelectorAll('.modal-backdrop')).toHaveLength(1);
    });
  });
});

describe('interactive-video minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'interactive-video.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

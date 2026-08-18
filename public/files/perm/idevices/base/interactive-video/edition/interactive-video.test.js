/**
 * Unit tests for interactive-video iDevice (edition)
 */

/* eslint-disable no-undef */

import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('interactive-video iDevice edition', () => {
  let $exeDevice;
  let originalCommon;
  let originalTabs;
  let originalGamificationCommon;
  let originalProgressBar;
  let originalScorm;

  beforeEach(() => {
    global.$exeDevice = undefined;
    document.body.innerHTML = '';

    originalCommon = $exeDevicesEdition.iDevice.common;
    originalTabs = $exeDevicesEdition.iDevice.tabs;
    originalGamificationCommon = $exeDevicesEdition.iDevice.gamification.common;
    originalProgressBar = $exeDevicesEdition.iDevice.gamification.progressBar;
    originalScorm = $exeDevicesEdition.iDevice.gamification.scorm;

    $exeDevicesEdition.iDevice.common = {
      getTextFieldset: vi.fn(() => ''),
    };
    $exeDevicesEdition.iDevice.tabs = {
      init: vi.fn(),
    };
    $exeDevicesEdition.iDevice.gamification.common = {
      ...originalGamificationCommon,
      getLanguageTab: vi.fn(() => ''),
    };
    $exeDevicesEdition.iDevice.gamification.progressBar = {
      ...originalProgressBar,
      getContents: vi.fn((path) => `<img id="progress-help-icon" src="${path}quextIEHelp.png">`),
      addEvents: vi.fn(),
    };
    $exeDevicesEdition.iDevice.gamification.scorm = {
      ...originalScorm,
      getTab: vi.fn(() => ''),
      init: vi.fn(),
    };

    $exeDevice = global.loadIdevice(join(__dirname, 'interactive-video.js'));
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.common = originalCommon;
    $exeDevicesEdition.iDevice.tabs = originalTabs;
    $exeDevicesEdition.iDevice.gamification.common = originalGamificationCommon;
    $exeDevicesEdition.iDevice.gamification.progressBar = originalProgressBar;
    $exeDevicesEdition.iDevice.gamification.scorm = originalScorm;
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
  });

  it('renders the progress report help icon from the iDevice edition assets', () => {
    const container = document.createElement('div');
    const path = '/files/perm/idevices/base/interactive-video/edition/';
    document.body.appendChild(container);

    $exeDevice.init(container, '', path);

    const helpIcon = document.getElementById('progress-help-icon');
    expect(helpIcon).not.toBeNull();
    expect(helpIcon.getAttribute('src')).toBe(`${path}quextIEHelp.png`);
    expect(existsSync(join(__dirname, 'quextIEHelp.png'))).toBe(true);
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
      setValues = vi.fn();
      $exeDevicesEdition.iDevice.gamification.scorm.setValues = setValues;
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

  describe('edition lifecycle teardown (#2293)', () => {
    let show;
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
      window.__EXE_STATIC_MODE__ = true;
      global.bootstrap = {
        Modal: function () {
          return { show, dispose };
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
  });
});

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

    /** The exported markup the editor parses, carrying just the SCORM block. */
    function previousDataWith(scorm) {
      const json = JSON.stringify({ slides: [], scorm });
      return `<div><script id="exe-interactive-video-contents" type="application/json">${json}</script></div>`;
    }

    beforeEach(() => {
      setValues = vi.fn();
      $exeDevicesEdition.iDevice.gamification.scorm.setValues = setValues;
      global.top = { interactiveVideoEditor: {} };
    });

    afterEach(() => {
      delete global.top;
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
});

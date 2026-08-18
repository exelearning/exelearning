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

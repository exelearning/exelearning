/**
 * Unit tests for the quick-questions iDevice editor.
 *
 * Cover numeric field limits on keyup, and the edition lifecycle teardown of
 * resources that outlive the form (YouTube players, polling clock, answer
 * sound, local video elements and game-import file readers).
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';


import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('quick-questions iDevice edition', () => {
  let $exeDevice;
  let previousItinerary;

  beforeEach(() => {
    global.$exeDevice = undefined;
    previousItinerary = $exeDevicesEdition.iDevice.gamification.itinerary;
    // addEvents wires the whole editor. The itinerary component lives outside
    // this iDevice's source, so it is stubbed rather than exercised here.
    $exeDevicesEdition.iDevice.gamification.itinerary = {
      addEvents: () => {},
      getTab: () => '',
      init: () => {},
      setValues: () => {},
    };
    document.body.innerHTML = `
      <script></script>
      <form id="gameQEIdeviceForm">
            <input id="quextETimeSilence" />
      </form>`;
    $exeDevice = global.loadIdevice(join(__dirname, 'quick-questions.js'));
    $exeDevice.addEvents();
  });

  afterEach(() => {
    $exeDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
    document.body.innerHTML = '';
  });

  describe('numeric field limits', () => {
    it('keeps a 3-digit silence time', () => {
      $('#quextETimeSilence').val('120').trigger('keyup');

      expect($('#quextETimeSilence').val()).toBe('120');
    });

    it('truncates the silence time beyond 3 digits and drops non-digits', () => {
      $('#quextETimeSilence').val('1a2345').trigger('keyup');

      expect($('#quextETimeSilence').val()).toBe('123');
    });
  });

    /**
     * The pass-score control is a shared block in common_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'quick-questions.js'), 'utf-8');
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
            expect(source).toContain('passScoreMode: game.passScoreMode');
            expect(source).toContain('passScoreCustom: game.passScoreCustom');
        });

        it('saves the mode and the customised mark, and nothing else', () => {
            expect(source).toContain('gamification.passScore.getValues()');
            expect(source).toContain('passScoreMode: passScore.passScoreMode');
            expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
            // The project value is never copied into the iDevice: it is read
            // live, so an iDevice on the global mode follows the project.
            expect(source).not.toContain('passScoreGlobal');
        });

        it('wires the radio and input handlers', () => {
            expect(source).toContain('gamification.passScore.addEvents()');
        });
    });
});

function buildForm() {
    document.body.innerHTML = `
        <div id="gameQEIdeviceForm">
            <div id="eXeGameExportImport">
                <p class="exe-field-instructions"></p>
                <input id="eXeGameImportGame" type="file" />
                <a href="#" id="eXeGameExportQuestions"></a>
            </div>
            <input id="quextEURLYoutube" type="text" value="" />
            <input id="quextEInitVideo" type="text" value="00:00:00" />
            <input id="quextEEndVideo" type="text" value="00:00:00" />
            <input id="quextESilenceVideo" type="text" value="00:00:00" />
            <input id="quextETimeSilence" type="text" value="0" />
            <input id="quextEScoreQuestion" type="text" value="1" />
            <input id="quextENumberQuestion" type="text" value="1" />
            <input id="quextEAlt" type="text" value="" />
            <video id="quextEVideoLocal"></video>
            <video id="quextEVILocal"></video>
        </div>`;
}

describe('quick-questions edition: lifecycle teardown (#2293)', () => {
    let $exeDevice;
    let players;
    let originalYT;
    let originalReady;
    let scriptTag;

    function fakeYouTubeApi() {
        players = [];
        global.YT = {
            Player: function (id, options) {
                this.id = id;
                this.options = options || {};
                this.destroy = vi.fn();
                players.push(this);
            },
        };
    }

    beforeEach(() => {
        vi.useFakeTimers();
        global.$exeDevice = undefined;
        buildForm();
        // loadYoutubeApi inserts its tag before the first script of the page.
        scriptTag = document.createElement('script');
        document.head.appendChild(scriptTag);
        originalYT = global.YT;
        originalReady = window.onYouTubeIframeAPIReady;
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn(url => url),
        };
        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(join(__dirname, 'quick-questions.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) {
            $exeDevice.$lifecycle.destroy();
        }
        global.YT = originalYT;
        window.onYouTubeIframeAPIReady = originalReady;
        scriptTag.remove();
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    describe('video clock', () => {
        it('stops ticking once the edition closes', () => {
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});

            $exeDevice.clockVideo.start('remote');
            vi.advanceTimersByTime(2000);
            expect(spy).toHaveBeenCalledTimes(2);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(5000);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('never drives the iDevice opened after it', () => {
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplayVILocal').mockImplementation(() => {});
            $exeDevice.clockVideo.start('localintro');

            const laterDevice = { updateTimerDisplayVILocal: vi.fn() };
            global.$exeDevice = laterDevice;
            vi.advanceTimersByTime(1000);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(laterDevice.updateTimerDisplayVILocal).not.toHaveBeenCalled();
        });

        it('stop() leaves the clock cancellable more than once', () => {
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});
            $exeDevice.clockVideo.start('remote');
            $exeDevice.clockVideo.stop();
            $exeDevice.clockVideo.stop();

            vi.advanceTimersByTime(3000);
            expect(spy).not.toHaveBeenCalled();
        });
    });

    describe('YouTube players', () => {
        it('destroys both players created by loadPlayerYoutube', () => {
            fakeYouTubeApi();
            $exeDevice.loadPlayerYoutube();
            expect(players).toHaveLength(2);

            $exeDevice.$lifecycle.destroy();
            players.forEach(player => expect(player.destroy).toHaveBeenCalledTimes(1));
        });

        it('ignores a player event delivered after the edition closed', () => {
            fakeYouTubeApi();
            const spy = vi.spyOn($exeDevice, 'clickPlay').mockImplementation(() => {});
            $exeDevice.loadPlayerYoutube();
            const onReady = players[0].options.events.onReady;

            onReady();
            expect(spy).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            onReady();
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('restores the global API ready callback on teardown', () => {
            const previous = vi.fn();
            window.onYouTubeIframeAPIReady = previous;
            global.YT = undefined;

            $exeDevice.loadYoutubeApi();
            expect(window.onYouTubeIframeAPIReady).not.toBe(previous);

            $exeDevice.$lifecycle.destroy();
            expect(window.onYouTubeIframeAPIReady).toBe(previous);
            expect(previous).not.toHaveBeenCalled();
        });
    });

    describe('media elements', () => {
        it('stops the answer sound and drops its listener on teardown', () => {
            $exeDevice.playSound('sound.mp3');
            const audio = $exeDevice.playerAudio;
            const play = vi.spyOn(audio, 'play').mockImplementation(() => {});
            const pause = vi.spyOn(audio, 'pause');

            audio.dispatchEvent(new Event('canplaythrough'));
            expect(play).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            expect(pause).toHaveBeenCalledTimes(1);
            expect(audio.getAttribute('src')).toBeNull();
            audio.dispatchEvent(new Event('canplaythrough'));
            expect(play).toHaveBeenCalledTimes(1);
        });

        it('stops both local video players on teardown', () => {
            $exeDevice.questionsGame = [{}];
            $exeDevice.initQuestions();

            const local = document.getElementById('quextEVideoLocal');
            const intro = document.getElementById('quextEVILocal');
            local.setAttribute('src', 'question.mp4');
            intro.setAttribute('src', 'intro.mp4');
            const pauseLocal = vi.spyOn(local, 'pause');
            const pauseIntro = vi.spyOn(intro, 'pause');

            $exeDevice.$lifecycle.destroy();

            expect(pauseLocal).toHaveBeenCalledTimes(1);
            expect(pauseIntro).toHaveBeenCalledTimes(1);
            expect(local.getAttribute('src')).toBeNull();
            expect(intro.getAttribute('src')).toBeNull();
        });
    });

    describe('game import', () => {
        it('aborts an in-flight read and ignores its late result', () => {
            $exeDevice.addEvents();
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});
            const input = document.getElementById('eXeGameImportGame');
            const file = new File(['question'], 'game.txt', {
                type: 'text/plain',
            });
            Object.defineProperty(input, 'files', {
                value: [file],
                configurable: true,
            });

            const readers = [];
            const realFileReader = global.FileReader;
            class FakeFileReader {
                constructor() {
                    this.readyState = 0;
                    this.onload = null;
                    this.aborted = false;
                    readers.push(this);
                }
                readAsText() {
                    this.readyState = 1;
                }
                abort() {
                    this.aborted = true;
                    this.readyState = 2;
                }
                fireLoad(result) {
                    this.readyState = 2;
                    this.onload({ target: { result } });
                }
            }
            global.FileReader = FakeFileReader;
            window.FileReader = FakeFileReader;

            try {
                $(input).trigger('change');
                readers[0].fireLoad('finished');
                expect(importGame).toHaveBeenCalledTimes(1);

                $(input).trigger('change');
                const pending = readers[1];
                $exeDevice.$lifecycle.destroy();

                expect(readers[0].aborted).toBe(false);
                expect(pending.aborted).toBe(true);
                pending.onload({ target: { result: 'late' } });
                expect(importGame).toHaveBeenCalledTimes(1);
            } finally {
                global.FileReader = realFileReader;
                window.FileReader = realFileReader;
            }
        });
    });

    describe('accessibility confirmation', () => {
        it('does not save a later iDevice when answered too late', () => {
            let confirmed;
            const originalConfirm = global.eXe.app.confirm;
            global.eXe.app.confirm = vi.fn((title, message, callback) => {
                confirmed = callback;
            });
            const saveButton = document.createElement('button');
            saveButton.className = 'button-save-idevice';
            const click = vi.spyOn(saveButton, 'click');
            document.body.appendChild(saveButton);

            try {
                $exeDevice.checkAltImage = true;
                $exeDevice.validateAlt();
                expect(typeof confirmed).toBe('function');

                $exeDevice.$lifecycle.destroy();
                confirmed();

                expect(click).not.toHaveBeenCalled();
                expect($exeDevice.checkAltImage).toBe(true);
            } finally {
                global.eXe.app.confirm = originalConfirm;
            }
        });
    });
});

describe('quick-questions minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'quick-questions.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('quick-questions edition: shared form tabs and feedback', () => {
  const PATH = '/files/perm/idevices/base/quick-questions/edition/';
  const edition = () => global.$exeIDevicesEdition.iDevice;
  const feedback = () => edition().gamification.feedback;
  const tabNames = () =>
    [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
      tab.getAttribute('data-exe-tab')
    );
  const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
  const game = (overrides = {}) => ({
    typeGame: 'Quext',
    itinerary: {
      showClue: false,
      clueGame: '',
      percentageClue: 40,
      showCodeAccess: false,
      codeAccess: '',
      messageCodeAccess: '',
    },
    questionsGame: [
      {
        type: 0,
        time: 0,
        numberOptions: 4,
        url: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
        soundVideo: 1,
        imageVideo: 1,
        iVideo: 0,
        fVideo: 0,
        eText: '',
        quextion: '',
        options: ['', '', '', ''],
        solution: 0,
        silentVideo: 0,
        tSilentVideo: 0,
        audio: '',
        msgHit: '',
        msgError: '',
      },
    ],
    gameMode: 1,
    feedBack: false,
    percentajeFB: 100,
    isScorm: 0,
    textButtonScorm: 'Save score',
    ...overrides,
  });
  const exportHelpers = {
    isJsonString: (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return false;
      }
    },
    decrypt: (text) => text,
    encrypt: (text) => text,
    secondsToHour: (sec) => '00:00:00',
    hourToSeconds: (time) => 0,
  };
  let device;
  let tinymceInit;
  let tinymceGet;
  let editorReady;
  let previousApp;
  let tooltips;

  beforeEach(() => {
    global.$exeDevice = undefined;
    previousApp = global.eXeLearning.app;
    editorReady = undefined;
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
    Object.assign(global.$exeDevices.iDevice.gamification.helpers, exportHelpers);
    let text = '';
    const editor = {
      initialized: true,
      getContent: () => text,
      setContent: (html) => (text = html),
      hide: vi.fn(),
      show: vi.fn(),
      on: (event, callback) => {
        if (event === 'init') editorReady = callback;
      },
    };
    tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) => id === 'quextEText' ? editor : null);
    tinymceInit = vi.spyOn(global.tinymce, 'init').mockImplementation((config) => {
      config.setup(editor);
      return Promise.resolve([editor]);
    });
    document.body.innerHTML = '<div id="quextBody"></div>';
    const filename = join(__dirname, 'quick-questions.js');
    runInThisContext(readFileSync(filename, 'utf8'), { filename });
    device = global.$exeDevice;
    global.attachEditionLifecycle(device);
    vi.spyOn(device, 'loadYoutubeApi').mockImplementation(() => {});
    vi.spyOn(device, 'enableForm');
    vi.spyOn(device, 'loadPreviousValues');
    vi.spyOn(device, 'addEvents');
    device.init(document.getElementById('quextBody'), {}, PATH);
    editorReady();
  });

  afterEach(() => {
    device.$lifecycle?.destroy();
    global.eXeLearning.app = previousApp;
    vi.unstubAllGlobals();
    tinymceInit.mockRestore();
    tinymceGet.mockRestore();
    Object.keys(exportHelpers).forEach((name) => delete global.$exeDevices.iDevice.gamification.helpers[name]);
    global.$exeDevice = undefined;
    document.body.innerHTML = '';
  });

  it('lays the form out in the shared tabs, and opens on its questions', () => {
    expect(device.enableForm).toHaveBeenCalledOnce();
    expect(device.loadPreviousValues).toHaveBeenCalledOnce();
    expect(device.addEvents).toHaveBeenCalledOnce();
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
    expect(document.getElementById('gameQEIdeviceForm-tab-contents').textContent.trim()).toBe('Activities');
    expect(panel('contents').classList.contains('active')).toBe(true);
  });

  it('puts each part of the form in its tab', () => {
    expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
      'Choose the right answer'
    );
    expect(panel('options').querySelector('#quextEOptions')).not.toBeNull();
    expect(panel('options').querySelector('#quextEVIDiv #quextEVILocal')).not.toBeNull();
    expect(panel('contents').querySelector('#quextEVIDiv')).toBeNull();
    expect(panel('contents').querySelector('#quextEPanel')).not.toBeNull();
    expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
    expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
    expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
    expect(panel('texts').querySelector('#ci18n_msgSubmit').value).toBe('Submit');
  });

  it('provides one accessible information button at the end of each options row', () => {
    const options = panel('options');
    const rows = [...options.querySelector('#quextEOptions').children];
    expect(rows).toHaveLength(10);
    for (const row of rows) {
      const buttons = row.querySelectorAll('.exe-idevice-help');
      expect(buttons).toHaveLength(1);
      const help = buttons[0];
      expect(row.lastElementChild.contains(help)).toBe(true);
      expect(help.tagName).toBe('BUTTON');
      expect(help.type).toBe('button');
      expect(help.getAttribute('aria-label')).toBe(help.title);
      expect(help.title).toBe('Information');
      expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
      expect(help.querySelector('[aria-hidden="true"].info-icon-solid-green')).not.toBeNull();
      const controls = [...row.querySelectorAll('input, select')];
      const checked = controls.map((control) => control.checked);
      help.click();
      expect(controls.map((control) => control.checked)).toEqual(checked);
    }
    expect(global.eXeLearning.app.common.initTooltips).toHaveBeenCalledWith(
      document.getElementById('gameQEIdeviceForm-panels')
    );
  });

  it('explains every control in each combined options row', () => {
    const groups = [
      ['quextEQuestionsRamdon', 'Random questions', 'Random options'],
      ['quextEShowSolution', 'Show solutions', 'Show solution time (seconds)'],
      ['quextETypeActivity', 'From 0 to 10', 'Points and lives', 'No score'],
      ['quextEUseLives', 'Use lives', 'Number of lives'],
    ];
    for (const [id, ...labels] of groups) {
      const row = [...document.querySelector('#quextEOptions').children].find((item) => item.querySelector(`#${id}`));
      const text = row.querySelector('.help-content').textContent;
      for (const label of labels) expect(text).toContain(`${label}:`);
      expect(text.split('\n\n')).toHaveLength(labels.length);
    }
  });

  it('handles option changes after TinyMCE initializes without toggling them from help', () => {
    const checkbox = document.getElementById('quextEShowMinimize');
    const row = checkbox.closest('.toggle-item');
    row.click();
    expect(checkbox.checked).toBe(true);
    row.querySelector('.exe-idevice-help').click();
    expect(checkbox.checked).toBe(true);
    row.click();
    expect(checkbox.checked).toBe(false);
    document.querySelector('input[name="qxtgamemode"][value="2"]').click();
    expect(feedback().isRequired()).toBe(true);
  });

  it('does not toggle an option when its open explanation is clicked', () => {
    // The explanation opens inside the row, so a click on its text reaches
    // the row's own handler too.
    for (const row of document.querySelector('#quextEOptions').children) {
      const controls = [...row.querySelectorAll('input, select')];
      const checked = controls.map((control) => control.checked);
      row.querySelector('.exe-idevice-help').click();
      row.querySelector('.help-content').click();
      expect(controls.map((control) => control.checked)).toEqual(checked);
    }
  });

  it('escapes translated help text in the explanation', () => {
    const text = 'Use "Accept" <once> & keep the learner\'s answer.';
    const container = document.createElement('div');
    container.innerHTML = edition().common.getHelpTooltip(text);
    const button = container.querySelector('button');
    expect(button.title).toBe('Information');
    expect(container.querySelector('.help-content').textContent).toBe(text);
    expect(container.querySelector('once')).toBeNull();
  });

  it('disposes all option tooltips when the edition closes', () => {
    expect(tooltips.size).toBe(16); // Options plus the six shared Grading helpers.
    device.$lifecycle.destroy();
    for (const tooltip of tooltips.values()) {
      expect(tooltip.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it('offers Import, Export and Create with AI on its Questions tab, in windows of their own', () => {
    const links = [...panel('contents').querySelectorAll('[data-exe-share]')];

    expect(links.map((link) => link.getAttribute('data-exe-share'))).toEqual(['import', 'export', 'ai']);
    expect(document.querySelector('body > #eXeShareModal-import #eXeGameImportGame')).not.toBeNull();
    expect(document.querySelector('body > #eXeShareModal-export #eXeGameExportQuestions')).not.toBeNull();
    expect(document.querySelector('body > #eXeShareModal-ai #eXeEPromptArea')).not.toBeNull();
  });

  it('leaves the feedback to the shared block, without controls of its own', () => {
    expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
    expect(document.getElementById('quextEHasFeedBack')).toBeNull();
    expect(document.getElementById('quextEPercentajeFB')).toBeNull();
    expect(document.getElementById('quextEFeedBackEditor')).toBeNull();
  });

  it('switches tabs when one is clicked', () => {
    document.getElementById('gameQEIdeviceForm-tab-options').click();

    expect(panel('options').classList.contains('active')).toBe(true);
    expect(panel('contents').classList.contains('active')).toBe(false);
  });

  it('makes the feedback compulsory in "No score" mode only', () => {
    device.updateGameMode(2, false);
    expect(feedback().isRequired()).toBe(true);
    expect(document.getElementById('eXeGameHasFeedBack').disabled).toBe(true);

    device.updateGameMode(0, true);
    expect(feedback().isRequired()).toBe(false);
    expect(document.getElementById('eXeGameHasFeedBack').disabled).toBe(false);
    expect(document.getElementById('quextEUseLives').disabled).toBe(false);
  });

  it('restores the feedback and its mode with the game', () => {
    device.updateFieldGame(game({ gameMode: 2, feedBack: false, percentajeFB: 60 }));

    expect(feedback().isRequired()).toBe(true);
    expect(document.getElementById('eXeGamePercentajeFB').value).toBe('60');

    device.updateFieldGame(game({ gameMode: 1, feedBack: true, percentajeFB: 80 }));

    expect(feedback().isRequired()).toBe(false);
    expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
    expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
  });

  it('loads the saved message into the shared editor', () => {
    device.idevicePreviousData = `
      <div class="quext-IDevice">
        <div class="quext-version js-hidden">2</div>
        <div class="quext-feedback-game"><p>Well done</p></div>
        <div class="quext-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
      </div>`;
    vi.spyOn(device, 'showQuestion').mockImplementation(() => {});

    device.loadPreviousValues();

    expect(feedback().getText()).toBe('<p>Well done</p>');
    expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
  });

  describe('saving', () => {
    let editors;
    let tinymceGet;

    beforeEach(() => {
      editors = {
        eXeGameInstructions: '<p>Instructions</p>',
        eXeIdeviceTextAfter: '',
        eXeGameFeedBackEditor: '',
      };
      tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
        id in editors ? { initialized: true, getContent: () => editors[id], setContent: (html) => (editors[id] = html) } : null
      );
      device.questionsGame = [{ ...device.getCuestionDefault(), quextion: 'Question 1', options: ['A', 'B', 'C', 'D'], solution: 0 }];
    });

    afterEach(() => {
      tinymceGet.mockRestore();
    });

    it('saves the feedback values the export reads', () => {
      device.updateFieldGame(game({ questionsGame: device.questionsGame, feedBack: true, percentajeFB: 70 }));
      editors.eXeGameFeedBackEditor = '<p>Bravo</p>';
      vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

      const data = device.validateData();

      expect(data.feedBack).toBe(true);
      expect(data.percentajeFB).toBe(70);
      expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
      expect(device.save()).toContain('<div class="quext-feedback-game"><p>Bravo</p></div>');
    });

    it('asks for the message in "No score" mode', () => {
      device.updateFieldGame(game({ questionsGame: device.questionsGame, gameMode: 2 }));

      expect(device.validateData()).toBe(false);
      expect(global.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');
    });
  });
});


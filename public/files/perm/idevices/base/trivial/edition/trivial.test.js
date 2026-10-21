/**
 * Unit tests for the trivial iDevice editor.
 *
 * Cover numeric field limits on keyup, and the edition lifecycle teardown of
 * resources that outlive the form (YouTube player, local video, polling
 * intervals and import file readers).
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('trivial iDevice edition', () => {
  let $exeDevice;
  let previousItinerary;

  beforeEach(() => {
    global.$exeDevice = undefined;
    previousItinerary = $exeIDevicesEdition.iDevice.gamification.itinerary;
    // addEvents wires the whole editor. The itinerary component lives outside
    // this iDevice's source, so it is stubbed rather than exercised here.
    $exeIDevicesEdition.iDevice.gamification.itinerary = {
      addEvents: () => {},
      getTab: () => '',
      init: () => {},
      setValues: () => {},
    };
    document.body.innerHTML = `
      <script></script>
      <form id="gameQEIdeviceForm">
            <input id="trivialETimeSilence" />
      </form>`;
    $exeDevice = global.loadIdevice(join(__dirname, 'trivial.js'));
    $exeDevice.addEvents();
  });

  afterEach(() => {
    $exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
    document.body.innerHTML = '';
  });

  describe('numeric field limits', () => {
    it('keeps a 3-digit silence time', () => {
      $('#trivialETimeSilence').val('120').trigger('keyup');

      expect($('#trivialETimeSilence').val()).toBe('120');
    });

    it('truncates the silence time beyond 3 digits and drops non-digits', () => {
      $('#trivialETimeSilence').val('1a2345').trigger('keyup');

      expect($('#trivialETimeSilence').val()).toBe('123');
    });
  });

    /**
     * The pass-score control is a shared block in common_idevices_edition.js, exercised
     * by its own tests. What is specific to this iDevice -- and what silently
     * breaks if someone edits the form -- is the wiring: all four call sites
     * have to be present, and the two saved fields have to reach the stored
     * data. Reading the source is how that is checked without standing up the
     * whole edition form.
     */
    describe('pass score wiring', () => {
        let source;

        beforeEach(() => {
            source = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading: \{ hidebutton: true \}/);
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

/**
 * FileReader double that never resolves on its own, so a test decides exactly
 * when (and whether) the load callback fires.
 */
class FakeFileReader {
    constructor() {
        FakeFileReader.instances.push(this);
        this.readyState = 0;
        this.onload = null;
        this.result = null;
        this.abort = vi.fn(() => {
            this.readyState = 2;
        });
    }

    readAsText() {
        this.readyState = 1;
    }

    /** Fire the load callback as the platform would. */
    fire(result) {
        this.result = result;
        this.readyState = 2;
        if (this.onload) this.onload({ target: { result } });
    }
}
FakeFileReader.instances = [];

/** Minimal YT.Player double: records construction options and destruction. */
class FakeYTPlayer {
    constructor(id, options) {
        FakeYTPlayer.instances.push(this);
        this.id = id;
        this.options = options;
        this.destroy = vi.fn();
        this.mute = vi.fn();
        this.unMute = vi.fn();
        this.pauseVideo = vi.fn();
        this.playVideo = vi.fn();
        this.loadVideoById = vi.fn();
        this.getCurrentTime = vi.fn(() => 0);
    }
}
FakeYTPlayer.instances = [];

describe('trivial iDevice edition lifecycle', () => {
    let $exeDevice;
    let originalFileReader;
    let originalYT;
    let originalItinerary;
    let originalStopSound;
    let originalVoiceRecorder;

    beforeEach(() => {
        FakeFileReader.instances = [];
        FakeYTPlayer.instances = [];

        originalFileReader = global.FileReader;
        originalYT = global.YT;
        originalItinerary = $exeIDevicesEdition.iDevice.gamification.itinerary;
        originalStopSound = $exeIDevicesEdition.iDevice.gamification.helpers.stopSound;
        originalVoiceRecorder = $exeIDevicesEdition.iDevice.voiceRecorder;

        global.FileReader = FakeFileReader;
        window.FileReader = FakeFileReader;
        $exeIDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };
        $exeIDevicesEdition.iDevice.gamification.helpers.stopSound = vi.fn();
        $exeIDevicesEdition.iDevice.voiceRecorder = { initVoiceRecorders: vi.fn() };

        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'trivial.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
        global.FileReader = originalFileReader;
        window.FileReader = originalFileReader;
        global.YT = originalYT;
        $exeIDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
        $exeIDevicesEdition.iDevice.gamification.helpers.stopSound = originalStopSound;
        $exeIDevicesEdition.iDevice.voiceRecorder = originalVoiceRecorder;
        vi.useRealTimers();
    });

    describe('video polling intervals', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('keeps refreshing the YouTube timer while the edition is open', () => {
            $exeDevice.player = new FakeYTPlayer('trivialEVideo', {});
            const refresh = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});

            $exeDevice.startVideo('abc', 5, 20, 0);
            vi.advanceTimersByTime(3000);

            expect(refresh).toHaveBeenCalledTimes(3);
            refresh.mockRestore();
        });

        it('stops refreshing the YouTube timer once the edition is closed', () => {
            $exeDevice.player = new FakeYTPlayer('trivialEVideo', {});
            const refresh = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});

            $exeDevice.startVideo('abc', 5, 20, 0);
            vi.advanceTimersByTime(1000);
            expect(refresh).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(10000);

            expect(refresh).toHaveBeenCalledTimes(1);
            refresh.mockRestore();
        });

        it('stops refreshing the local video timer once the edition is closed', () => {
            $exeDevice.localPlayer = { src: '', currentTime: 0, play: vi.fn(), pause: vi.fn() };
            const refresh = vi.spyOn($exeDevice, 'updateTimerDisplayLocal').mockImplementation(() => {});

            $exeDevice.startVideo('local.mp4', 1, 9, 1);
            vi.advanceTimersByTime(2000);
            expect(refresh).toHaveBeenCalledTimes(2);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(10000);

            expect(refresh).toHaveBeenCalledTimes(2);
            refresh.mockRestore();
        });

        it('stops the timer that playVideo starts once the edition is closed', () => {
            $exeDevice.player = new FakeYTPlayer('trivialEVideo', {});
            const refresh = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});

            $exeDevice.playVideo();
            vi.advanceTimersByTime(1000);
            expect(refresh).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(10000);

            expect(refresh).toHaveBeenCalledTimes(1);
            refresh.mockRestore();
        });

        it('still lets stopVideo cancel the running interval', () => {
            $exeDevice.player = new FakeYTPlayer('trivialEVideo', {});
            const refresh = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});

            $exeDevice.playVideo();
            vi.advanceTimersByTime(1000);
            $exeDevice.stopVideo();
            vi.advanceTimersByTime(5000);

            expect(refresh).toHaveBeenCalledTimes(1);
            expect($exeDevice.player.pauseVideo).toHaveBeenCalled();
            refresh.mockRestore();
        });

        /**
         * The defect this whole change is about: a timer created by edition A must
         * never call into the iDevice that replaces it.
         */
        it('never drives a later iDevice through the global', () => {
            $exeDevice.player = new FakeYTPlayer('trivialEVideo', {});
            const first = $exeDevice;
            const refresh = vi.spyOn(first, 'updateTimerDisplay').mockImplementation(() => {});

            first.startVideo('abc', 5, 20, 0);
            first.$lifecycle.destroy();

            // A different iDevice edition takes over the global.
            const second = { updateTimerDisplay: vi.fn() };
            global.$exeDevice = second;
            vi.advanceTimersByTime(10000);

            expect(second.updateTimerDisplay).not.toHaveBeenCalled();
            expect(refresh).not.toHaveBeenCalled();
            refresh.mockRestore();
            global.$exeDevice = first;
        });
    });

    describe('YouTube player', () => {
        beforeEach(() => {
            global.YT = { Player: FakeYTPlayer };
            window.YT = global.YT;
        });

        it('destroys the player created by youTubeReady when the edition closes', () => {
            $exeDevice.youTubeReady();

            const player = FakeYTPlayer.instances[0];
            expect(player).toBeDefined();
            expect(player.destroy).not.toHaveBeenCalled();

            $exeDevice.$lifecycle.destroy();

            expect(player.destroy).toHaveBeenCalledTimes(1);
        });

        it('destroys the player created by loadPlayerYoutube when the edition closes', () => {
            $exeDevice.loadPlayerYoutube();

            const player = FakeYTPlayer.instances[0];
            expect(player).toBeDefined();

            $exeDevice.$lifecycle.destroy();

            expect(player.destroy).toHaveBeenCalledTimes(1);
        });

        it('keeps the player events tied to the edition that created them', () => {
            const ready = vi.spyOn($exeDevice, 'onPlayerReady').mockImplementation(() => {});
            $exeDevice.youTubeReady();

            const player = FakeYTPlayer.instances[0];
            player.options.events.onReady({});
            expect(ready).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            player.options.events.onReady({});

            expect(ready).toHaveBeenCalledTimes(1);
            ready.mockRestore();
        });

        it('leaves the YouTube API ready callback inert after the edition closes', () => {
            // The API script is only injected when YT is not loaded yet.
            global.YT = undefined;
            window.YT = undefined;
            document.body.appendChild(document.createElement('script'));

            const ready = vi.spyOn($exeDevice, 'youTubeReady').mockImplementation(() => {});
            $exeDevice.loadYoutubeApi();

            const apiCallback = window.onYouTubeIframeAPIReady;
            expect(typeof apiCallback).toBe('function');

            apiCallback();
            expect(ready).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            apiCallback();

            expect(ready).toHaveBeenCalledTimes(1);
            ready.mockRestore();
        });

        it('restores the global API ready callback on teardown', () => {
            const previous = vi.fn();
            window.onYouTubeIframeAPIReady = previous;
            global.YT = undefined;
            window.YT = undefined;
            document.body.appendChild(document.createElement('script'));

            $exeDevice.loadYoutubeApi();
            expect(window.onYouTubeIframeAPIReady).not.toBe(previous);

            $exeDevice.$lifecycle.destroy();

            expect(window.onYouTubeIframeAPIReady).toBe(previous);
            expect(previous).not.toHaveBeenCalled();
        });

        /**
         * A later edition owns the global by the time this one closes, so
         * putting the old value back would undo the newer registration.
         */
        it('leaves a callback installed after it alone', () => {
            global.YT = undefined;
            window.YT = undefined;
            document.body.appendChild(document.createElement('script'));

            $exeDevice.loadYoutubeApi();
            const laterCallback = vi.fn();
            window.onYouTubeIframeAPIReady = laterCallback;

            $exeDevice.$lifecycle.destroy();

            expect(window.onYouTubeIframeAPIReady).toBe(laterCallback);
        });
    });

    describe('local video element', () => {
        it('stops the local player when the edition closes', () => {
            const video = document.createElement('video');
            video.id = 'trivialEVideoLocal';
            video.setAttribute('src', 'local.mp4');
            video.pause = vi.fn();
            video.load = vi.fn();
            document.body.appendChild(video);

            $exeDevice.initQuestions();
            expect($exeDevice.localPlayer).toBe(video);

            $exeDevice.$lifecycle.destroy();

            expect(video.pause).toHaveBeenCalledTimes(1);
            expect(video.load).toHaveBeenCalledTimes(1);
            expect(video.hasAttribute('src')).toBe(false);
        });
    });

    describe('game import file readers', () => {
        /** Builds the file input `addEvents` wires the reader to. */
        const buildImportInputs = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'trivialLoadGame';
            document.body.appendChild(input);
        };

        const selectFile = (id, file) => {
            const input = document.getElementById(id);
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            $(input).trigger('change');
        };

        beforeEach(() => {
            buildImportInputs();
            $exeDevice.questionsGame = [];
            $exeDevice.addEvents();
        });

        it('aborts an in-flight import read when the edition closes', () => {
            selectFile('trivialLoadGame', { name: 'game.json', type: 'application/json' });
            const reader = FakeFileReader.instances[0];
            expect(reader.readyState).toBe(1);

            $exeDevice.$lifecycle.destroy();

            expect(reader.abort).toHaveBeenCalledTimes(1);
        });

        it('adds a game file while the edition is open', () => {
            const gameAdd = vi.spyOn($exeDevice, 'gameAdd').mockImplementation(() => {});

            selectFile('trivialLoadGame', { name: 'game.json', type: 'application/json' });
            const reader = FakeFileReader.instances[0];
            reader.fire('{"b":2}');

            expect(gameAdd).toHaveBeenCalledWith('{"b":2}', 'application/json');
            gameAdd.mockRestore();
        });

        it('ignores a late gameAdd callback once the edition is closed', () => {
            const gameAdd = vi.spyOn($exeDevice, 'gameAdd').mockImplementation(() => {});

            selectFile('trivialLoadGame', { name: 'game.json', type: 'application/json' });
            const reader = FakeFileReader.instances[0];

            $exeDevice.$lifecycle.destroy();
            reader.fire('{"b":2}');

            expect(gameAdd).not.toHaveBeenCalled();
            gameAdd.mockRestore();
        });
    });
});

describe('trivial minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'trivial.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('trivial edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/trivial/edition/';
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
    let device;
    let previousApp;
    let tooltips;
    let previousHelpers;
    let tinymceInit;
    let previousMedia;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning?.app;
        tooltips = new Map();
        global.eXeLearning = {
            ...global.eXeLearning,
            app: {
                ...previousApp,
                common: {
                    initTooltips: vi.fn((scope) => {
                        scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                            if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                        });
                    }),
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        previousHelpers = { ...helpers() };
        Object.assign(helpers(), {
            isJsonString: (text) => {
                try {
                    return JSON.parse(text);
                } catch {
                    return false;
                }
            },
            sanitizeJSONString: (text) => text,
            hourToSeconds: () => 0,
            secondsToHour: () => '00:00:00',
        });
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: () => false,
            getURLVideoMediaTeca: () => false,
            extractURLGD: (url) => url,
        };
        tinymceInit = vi.spyOn(global.tinymce, 'init').mockImplementation(() => Promise.resolve([]));
        device = global.loadIdevice(join(__dirname, 'trivial.js'));
        vi.spyOn(device, 'loadYoutubeApi').mockImplementation(() => {});
        document.body.innerHTML = '<div id="trivialBody"></div>';
        device.init(document.getElementById('trivialBody'), {}, PATH);
        // The form is wired once its question editor is ready.
        const { setup } = tinymceInit.mock.calls.find(([config]) => config.setup)[0];
        let editorReady;
        setup({ on: (event, callback) => event === 'init' && (editorReady = callback) });
        editorReady();
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        for (const key of ['isJsonString', 'sanitizeJSONString', 'hourToSeconds', 'secondsToHour']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its questions', () => {
        expect(tabNames()).toEqual(['instructions', 'options', 'contents', 'passwords', 'after', 'grading', 'texts']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('sets the topics and their questions in Questions, and the game in Options', () => {
        expect(panel('contents').firstElementChild.textContent).toContain('Choose a topic, name it');
        expect(panel('contents').querySelector('#trivialEPanel #trivialNameTema')).not.toBeNull();
        expect(panel('contents').querySelector('#trivialEPanel #trivialLoadGame')).not.toBeNull();
        expect(panel('options').querySelector('#trivialEOptions #trivialNG6')).not.toBeNull();
        expect(panel('options').querySelector('#trivialEOptions #trivialModeBoard')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgReply')).not.toBeNull();
    });

    it('offers no share windows, no save score button and no clue percentage, as before', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
        expect(document.getElementById('eXeGameSCORMblock').classList.contains('d-none')).toBe(true);
        expect(document.getElementById('eXeGamePercentajeClue').style.display).toBe('none');
    });

    it('keeps its accessibility warning in view', () => {
        const warning = document.querySelector('#gameQEIdeviceForm > .alert-warning');

        expect(warning.textContent).toContain('This game may present accessibility problems');
        expect(document.querySelector('.exe-block-dismissible, .exe-block-close')).toBeNull();
    });

    it('explains each setting without changing any of them', () => {
        const helps = [...document.querySelectorAll('#trivialEOptions .exe-idevice-help, #trivialEPanel .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#gameQEIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(6);
        for (const help of helps) {
            expect(help.title).toBe('Information');
            const content = document.getElementById(help.getAttribute('aria-controls'));
            expect(content.textContent.length).toBeGreaterThan(15);
            help.click();
            help.querySelector('span').click();
            content.click();
        }
        expect(states()).toEqual(before);
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('disposes all tooltips when the edition closes', () => {
        // Every tooltip of the form, its own and those of the shared tabs.
        expect(tooltips.size).toBe(document.querySelectorAll('#gameQEIdeviceForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(6);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('counts a new question as soon as it is added', () => {
        vi.spyOn(global.tinymce, 'get').mockImplementation(() => ({
            initialized: true,
            getContent: () => '',
            setContent: () => {},
            hide: () => {},
            show: () => {},
        }));
        device.temas[0] = [
            { ...device.getCuestionDefault(), quextion: 'First', options: ['Right', 'Wrong', '', ''], numberOptions: 2, solution: 'A' },
        ];
        device.nombresTemas = ['Maths', 'History', '', '', '', ''];
        device.showTema(0);

        device.addQuestion();

        expect(document.getElementById('trivialENumQuestions').textContent).toBe('2');
    });

    it('names the loader, the topic name, the share of letters and the text', () => {
        for (const id of ['trivialLoadGame', 'trivialNameTema', 'trivialPercentageShow', 'trivialEText']) {
            expect(document.getElementById(id).labels, id).toHaveLength(1);
        }
        expect(document.getElementById('trivialNameTema').labels[0].textContent).toBe('Name');
    });

    it('restores the options and the access code of a saved game', () => {
        const itinerary = {
            showClue: true,
            clueGame: 'Next key: river',
            percentageClue: 100,
            showCodeAccess: true,
            codeAccess: '1234',
            messageCodeAccess: 'Code of the previous activity?',
        };
        device.updateFieldGame({
            showMinimize: true,
            showSolution: false,
            timeShowSolution: 3,
            modeBoard: true,
            numeroTemas: 3,
            nombresTemas: ['One', 'Two', 'Three', '', '', ''],
            temas: device.temas,
            itinerary,
            isScorm: 0,
            textButtonScorm: 'Save score',
            repeatActivity: true,
            weighted: 100,
            evaluation: false,
            evaluationID: '',
            globalTime: 0,
        });

        expect(document.getElementById('trivialEShowMinimize').checked).toBe(true);
        expect(document.getElementById('trivialModeBoard').checked).toBe(true);
        expect(document.getElementById('trivialNG3').checked).toBe(true);
        expect(document.getElementById('eXeGameCodeAccess').value).toBe('1234');
        expect(global.$exeIDevicesEdition.iDevice.gamification.itinerary.getValues()).toEqual(itinerary);
    });

    it('keeps the changes made to the question on screen after copying it', () => {
        // Each editor stands on its own textarea.
        vi.spyOn(global.tinymce, 'get').mockImplementation((id) => ({
            getContent: () => $(`#${id}`).val() || '',
            setContent: (html) => $(`#${id}`).val(html),
            hide: vi.fn(),
            show: vi.fn(),
        }));
        const topic = device.activeTema;
        document.getElementById('trivialNameTema').value = 'Geography';
        device.temas[topic] = [
            {
                ...device.getCuestionDefault(),
                quextion: 'Capital of France?',
                options: ['Paris', 'Rome', 'Madrid', 'Berlin'],
                solution: 'A',
            },
        ];
        device.activesQuestions[topic] = 0;
        device.showQuestion(0);
        device.copyQuestion();
        document.getElementById('trivialEQuestion').value = 'Capital of Spain?';

        device.pasteQuestion();

        expect(device.temas[topic].map((question) => question.quextion)).toEqual([
            'Capital of Spain?',
            'Capital of France?',
        ]);
    });
});

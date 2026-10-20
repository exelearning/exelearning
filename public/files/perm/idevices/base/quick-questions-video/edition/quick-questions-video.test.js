/**
 * Unit tests for Video test (quick-questions-video) iDevice edition.
 *
 * The workarea clears the global $exeDevice when the editor closes
 * (ideviceNode.js), but DOM event handlers bound by addEvents stay attached.
 * Late events must not throw (issue #2271).
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handlers whose callback is a single guarded call: [selector, event, method]
const delegatedHandlers = [
    ['.VDQXTE-EPanel input.VDQXTE-Number', 'click', 'showOptions'],
    ['.VDQXTE-EPanel input.VDQXTE-TypeQuestion', 'click', 'showTypeQuestion'],
    ['#vquextEAdd', 'click', 'addQuestion'],
    ['#vquextEFirst', 'click', 'firstQuestion'],
    ['#vquextEPrevious', 'click', 'previousQuestion'],
    ['#vquextENext', 'click', 'nextQuestion'],
    ['#vquextELast', 'click', 'lastQuestion'],
    ['#vquextEDelete', 'click', 'removeQuestion'],
    ['#vquextEPlayVideo', 'click', 'playQuestionVideo'],
    ['#vquextEPercentajeQuestions', 'keyup', 'updateQuestionsNumber'],
    ['#vquextEPercentajeQuestions', 'click', 'updateQuestionsNumber'],
    ['#vquextEPercentajeQuestions', 'focusout', 'updateQuestionsNumber'],
    ['#vquextQEIdeviceForm input.VDQXTE-TypeGame', 'click', 'updateGameMode'],
    ['#vquextECustomMessages', 'change', 'showSelectOrder'],
];

// Handlers with a guard clause at the top: [selector, event]
const guardedHandlers = [
    ['#vquextEVIStart', 'focusout'],
    ['#vquextPoint', 'click'],
    ['#vquextEVIStart', 'click'],
    ['#vquextEVIEnd', 'click'],
    ['#vquextEVITime', 'click'],
    ['#vquextEVIURL', 'change'],
    ['#vquextEPlayStart', 'click'],
    ['#vquextGlobalTimeButton', 'click'],
];

// The edition reads the shared itinerary of $exeIDevicesEdition: the tests
// stub it, and the real one comes back after each of them.
let sharedItinerary;
beforeEach(() => {
    sharedItinerary = global.$exeIDevicesEdition.iDevice.gamification.itinerary;
});
afterEach(() => {
    global.$exeIDevicesEdition.iDevice.gamification.itinerary = sharedItinerary;
});

function buildForm() {
    document.body.innerHTML = `
        <div id="vquextQEIdeviceForm">
            <div class="VDQXTE-EPanel">
                <input class="VDQXTE-Number" type="radio" value="3" />
                <input class="VDQXTE-TypeQuestion" type="radio" value="1" />
            </div>
            <input class="VDQXTE-TypeGame" type="radio" value="1" />
            <a href="#" id="vquextEAdd"></a>
            <a href="#" id="vquextEFirst"></a>
            <a href="#" id="vquextEPrevious"></a>
            <a href="#" id="vquextENext"></a>
            <a href="#" id="vquextELast"></a>
            <a href="#" id="vquextEDelete"></a>
            <a href="#" id="vquextEPlayVideo"></a>
            <input id="vquextEPercentajeQuestions" type="text" value="50" />
            <input id="vquextECustomMessages" type="checkbox" />
            <input id="vquextEUseLives" type="checkbox" />
            <input id="vquextPoint" type="text" value="00:00:00" />
            <input id="vquextEVIStart" type="text" value="00:00:00" />
            <input id="vquextEVIEnd" type="text" value="00:00:00" />
            <span id="vquextEVITime">00:01:00</span>
            <input id="vquextEVIURL" type="text" value="video.mp4" />
            <a href="#" id="vquextEPlayStart"></a>
            <a href="#" id="vquextGlobalTimeButton"></a>
            <input id="vquextEGlobalTimes" type="text" value="30" />
            <input id="vquextNumberQuestion" type="text" value="2" />
        </div>`;
}

describe('quick-questions-video edition: $exeDevice guards (#2271)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildForm();
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn(url => url),
        };
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(join(__dirname, 'quick-questions-video.js'));
        $exeDevice.addEvents();
    });

    afterEach(() => {
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    describe('after the editor cleared the global $exeDevice', () => {
        beforeEach(() => {
            global.$exeDevice = undefined;
        });

        it.each([...delegatedHandlers, ...guardedHandlers])('does not throw on %s %s', (selector, event) => {
            expect(() => $(selector).trigger(event)).not.toThrow();
        });

        it('does not throw on question number Enter keyup', () => {
            expect(() => $('#vquextNumberQuestion').trigger($.Event('keyup', { keyCode: 13 }))).not.toThrow();
        });

        it('does not throw in detached player/media callbacks', () => {
            const { clickPlay, onPlayerReady, onPlayerStateChange } = $exeDevice;
            const getDataVideoLocal = $exeDevice.getDataVideoLocal;
            expect(() => clickPlay()).not.toThrow();
            expect(() => onPlayerReady()).not.toThrow();
            expect(() => onPlayerStateChange()).not.toThrow();
            expect(() => getDataVideoLocal.call({ duration: 10 })).not.toThrow();
        });
    });

    describe('with $exeDevice still active', () => {
        it.each(delegatedHandlers)('%s %s still calls %s', (selector, event, method) => {
            const spy = vi.spyOn($exeDevice, method).mockImplementation(() => {});
            $(selector).trigger(event);
            expect(spy).toHaveBeenCalled();
        });

        it('start time click still records the focused field', () => {
            $('#vquextEVIStart').trigger('click');
            expect($exeDevice.timeVIFocus).toBe(1);
        });

        it('time display click still copies the time into the field', () => {
            $exeDevice.timeVIFocus = 1;
            $('#vquextEVITime').trigger('click');
            expect($('#vquextEVIStart').val()).toBe('00:01:00');
        });

        it('URL change still loads the video', () => {
            const spy = vi.spyOn($exeDevice, 'loadVideo').mockImplementation(() => {});
            $('#vquextEVIURL').trigger('change');
            expect(spy).toHaveBeenCalledWith('video.mp4');
        });

        it('play start click still loads the video', () => {
            const spy = vi.spyOn($exeDevice, 'loadVideo').mockImplementation(() => {});
            $('#vquextEPlayStart').trigger('click');
            expect(spy).toHaveBeenCalledWith('video.mp4');
        });

        it('focusout still validates the time format', () => {
            const spy = vi.spyOn($exeDevice, 'validTime').mockReturnValue(true);
            $('#vquextEVIStart').trigger('focusout');
            expect(spy).toHaveBeenCalledWith('00:00:00');
        });

        it('global time button still updates every question', () => {
            $exeDevice.questionsGame = [{ time: 0 }, { time: 5 }];
            $('#vquextGlobalTimeButton').trigger('click');
            expect($exeDevice.questionsGame.map(q => q.time)).toEqual([30, 30]);
        });

        it('question number Enter keyup still validates the question', () => {
            const spy = vi.spyOn($exeDevice, 'validateQuestion').mockReturnValue(false);
            $('#vquextNumberQuestion').trigger($.Event('keyup', { keyCode: 13 }));
            expect(spy).toHaveBeenCalled();
            expect($('#vquextNumberQuestion').val()).toBe('1');
        });
    });
});

// The defect: updateFieldGame called scorm.setValues with three arguments, so
// the helper's own default (100) reached the weight field instead of the stored
// value. getValues then read that 100 back out of the form, and saving the
// iDevice overwrote the author's weight.
describe('quick-questions-video edition: the SCORM weight survives a round trip', () => {
    let $exeDevice;
    let scormMock;

    /** The stored game, as loadDataGame leaves it before the form is filled. */
    function storedGame(overrides = {}) {
        return Object.assign(
            {
                isScorm: 1,
                textButtonScorm: 'Save score',
                repeatActivity: true,
                weighted: 40,
                itinerary: {},
                questionsGame: [],
                msgs: {},
            },
            overrides
        );
    }

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildForm();
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn((url) => url),
        };
        global.$exeDevices.iDevice.gamification.helpers.secondsToHour = vi.fn(
            () => '00:00:00'
        );
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        scormMock = global.$exeIDevicesEdition.iDevice.gamification.scorm;
        vi.spyOn(scormMock, 'setValues').mockImplementation(() => {});
        $exeDevice = global.loadIdevice(
            join(__dirname, 'quick-questions-video.js')
        );
        // Painting a question needs the whole editor panel; the weight does not.
        vi.spyOn($exeDevice, 'showQuestion').mockImplementation(() => {});
    });

    afterEach(() => {
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('hands the stored weight to the SCORM tab', () => {
        $exeDevice.updateFieldGame(storedGame({ weighted: 40 }));

        expect(scormMock.setValues).toHaveBeenCalledWith(
            1,
            'Save score',
            true,
            40
        );
    });

    it('passes a weight of 0 through instead of falling back to 100', () => {
        $exeDevice.updateFieldGame(storedGame({ weighted: 0 }));

        expect(scormMock.setValues.mock.calls[0][3]).toBe(0);
    });

    // loadDataGame defaults a game saved before the field existed to 100, and
    // that default must be the one that travels.
    it('carries the default when the stored game has no weight', () => {
        const game = storedGame();
        delete game.weighted;
        game.weighted = typeof game.weighted !== 'undefined' ? game.weighted : 100;

        $exeDevice.updateFieldGame(game);

        expect(scormMock.setValues.mock.calls[0][3]).toBe(100);
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
            source = readFileSync(join(__dirname, 'quick-questions-video.js'), 'utf-8');
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

/**
 * Edition lifecycle teardown (#2293).
 *
 * The YouTube player, the polling clock, the local <video> listeners and the
 * asset-resolution continuation all outlive the edition form unless the
 * lifecycle owns them.
 */
describe('quick-questions-video edition: lifecycle teardown (#2293)', () => {
    let $exeDevice;
    let players;
    let originalYT;
    let originalReady;
    let originalHelpers;
    let originalResolver;
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
        document.body.insertAdjacentHTML('beforeend', '<video id="vquextEVideoLocal"></video>');
        // loadYoutubeApi inserts its tag before the first script of the page.
        scriptTag = document.createElement('script');
        document.head.appendChild(scriptTag);
        originalYT = global.YT;
        originalReady = window.onYouTubeIframeAPIReady;
        originalResolver = window.eXeLearningAssetResolver;
        originalHelpers = global.$exeDevices.iDevice.gamification.helpers;
        global.$exeDevices.iDevice.gamification.helpers = {
            ...originalHelpers,
            hourToSeconds: vi.fn(() => 0),
            secondsToHour: vi.fn(seconds => String(seconds)),
        };
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn((url) => url),
        };
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(join(__dirname, 'quick-questions-video.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) {
            $exeDevice.$lifecycle.destroy();
        }
        global.YT = originalYT;
        window.onYouTubeIframeAPIReady = originalReady;
        window.eXeLearningAssetResolver = originalResolver;
        global.$exeDevices.iDevice.gamification.helpers = originalHelpers;
        scriptTag.remove();
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    describe('YouTube player', () => {
        it('destroys the player created by loadPlayerYoutube', () => {
            fakeYouTubeApi();
            $exeDevice.loadPlayerYoutube();
            expect(players).toHaveLength(1);

            $exeDevice.$lifecycle.destroy();
            expect(players[0].destroy).toHaveBeenCalledTimes(1);
        });

        it('destroys the player created when the API becomes ready', () => {
            fakeYouTubeApi();
            $exeDevice.youTubeReady();
            expect(players).toHaveLength(1);

            $exeDevice.$lifecycle.destroy();
            expect(players[0].destroy).toHaveBeenCalledTimes(1);
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
            const spy = vi.spyOn($exeDevice, 'youTubeReady').mockImplementation(() => {});

            $exeDevice.loadYoutubeApi();
            const bound = window.onYouTubeIframeAPIReady;
            expect(bound).not.toBe(previous);
            bound();
            expect(spy).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            expect(window.onYouTubeIframeAPIReady).toBe(previous);
            bound();
            expect(spy).toHaveBeenCalledTimes(1);
            expect(previous).not.toHaveBeenCalled();
        });
    });

    describe('clock', () => {
        it('stops polling the YouTube time when the edition closes', () => {
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplayYT').mockImplementation(() => {});
            $exeDevice.videoType = 0;
            $exeDevice.initClock(0);

            vi.advanceTimersByTime(2000);
            expect(spy).toHaveBeenCalledTimes(2);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(3000);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('never polls the iDevice opened after it', () => {
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplayYT').mockImplementation(() => {});
            $exeDevice.videoType = 0;
            $exeDevice.initClock(0);

            const laterDevice = { videoType: 0, updateTimerDisplayYT: vi.fn() };
            global.$exeDevice = laterDevice;
            vi.advanceTimersByTime(1000);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(laterDevice.updateTimerDisplayYT).not.toHaveBeenCalled();
        });

        it('detaches the local player listeners when the edition closes', () => {
            const player = document.getElementById('vquextEVideoLocal');
            $exeDevice.localPlayer = player;
            $exeDevice.videoType = 1;
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplayLocal').mockImplementation(() => {});
            $exeDevice.initClock(1);

            player.dispatchEvent(new Event('timeupdate'));
            expect(spy).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            player.dispatchEvent(new Event('timeupdate'));
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('keeps the media element as `this` for loadedmetadata', () => {
            const player = document.getElementById('vquextEVideoLocal');
            $exeDevice.localPlayer = player;
            $exeDevice.videoType = 1;
            Object.defineProperty(player, 'duration', {
                value: 42,
                configurable: true,
            });

            $exeDevice.initClock(1);
            player.dispatchEvent(new Event('loadedmetadata'));

            expect($exeDevice.durationVideo).toBe(42);
        });

        it('releaseClock detaches the listeners before teardown', () => {
            const player = document.getElementById('vquextEVideoLocal');
            $exeDevice.localPlayer = player;
            $exeDevice.videoType = 1;
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplayLocal').mockImplementation(() => {});
            $exeDevice.initClock(1);

            $exeDevice.releaseClock();
            player.dispatchEvent(new Event('timeupdate'));

            expect(spy).not.toHaveBeenCalled();
            expect($exeDevice.timeUpdateInterval).toBeNull();
        });
    });

    describe('local video', () => {
        it('stops the local player on teardown', () => {
            $exeDevice.questionsGame = [{}];
            vi.spyOn($exeDevice, 'showTypeQuestion').mockImplementation(() => {});
            $exeDevice.initQuestions();

            const player = $exeDevice.localPlayer;
            player.setAttribute('src', 'question.mp4');
            const pause = vi.spyOn(player, 'pause');

            $exeDevice.$lifecycle.destroy();

            expect(pause).toHaveBeenCalledTimes(1);
            expect(player.getAttribute('src')).toBeNull();
        });

        it('drops the canplay listener of a resolved asset on teardown', async () => {
            const player = document.getElementById('vquextEVideoLocal');
            $exeDevice.localPlayer = player;
            const play = vi.spyOn(player, 'play').mockImplementation(() => Promise.resolve());
            window.eXeLearningAssetResolver = {
                resolve: vi.fn(() => Promise.resolve('blob:ready')),
            };

            $exeDevice.startVideoLocal('asset://media/video.mp4', 5, 10);
            await Promise.resolve();
            await Promise.resolve();
            expect(player.getAttribute('src')).toBe('blob:ready');

            $exeDevice.$lifecycle.destroy();
            player.dispatchEvent(new Event('canplay'));
            expect(play).not.toHaveBeenCalled();
        });

        it('ignores an asset that resolves after the edition closed', async () => {
            const player = document.getElementById('vquextEVideoLocal');
            $exeDevice.localPlayer = player;
            let resolveAsset;
            window.eXeLearningAssetResolver = {
                resolve: vi.fn(
                    () =>
                        new Promise(resolve => {
                            resolveAsset = resolve;
                        }),
                ),
            };

            $exeDevice.startVideoLocal('asset://media/video.mp4', 5, 10);
            $exeDevice.$lifecycle.destroy();
            resolveAsset('blob:late');
            await Promise.resolve();
            await Promise.resolve();

            expect(player.getAttribute('src')).toBeNull();
        });
    });
});

describe('quick-questions-video minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'quick-questions-video.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('quick-questions-video edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/quick-questions-video/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const tabNames = () =>
        [...document.querySelectorAll('#vquextQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`vquextQEIdeviceForm-panel-${name}`);
    const question = (overrides = {}) => ({
        id: 'q1',
        typeQuestion: 0,
        type: 3,
        time: 0,
        numberOptions: 2,
        pointVideo: 10,
        quextion: 'Which colour?',
        options: ['Red', 'Blue', '', ''],
        solution: 0,
        solutionQuestion: '',
        msgHit: '',
        msgError: '',
        soundVideo: 1,
        imageVideo: 1,
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'VideoQuExt',
        idVideoQuExt: 'https://www.youtube.com/watch?v=abc',
        startVideoQuExt: 0,
        endVideoQuExt: 60,
        showMinimize: false,
        answersRamdon: false,
        showSolution: true,
        timeShowSolution: 3,
        useLives: true,
        numberLives: 3,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        questionsGame: [question()],
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        gameMode: 1,
        feedBack: false,
        percentajeFB: 100,
        videoType: 0,
        customMessages: false,
        isNavigable: false,
        percentajeQuestions: 100,
        evaluation: false,
        evaluationID: '',
        globalTime: 0,
        ...overrides,
    });
    let device;
    let previousApp;
    let tooltips;
    let previousMedia;
    let previousHelpers;

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
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn((url) => (url.includes('youtube') ? 'abc' : false)),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn((url) => url),
        };
        previousHelpers = global.$exeDevices.iDevice.gamification.helpers;
        global.$exeDevices.iDevice.gamification.helpers = {
            ...previousHelpers,
            hourToSeconds: (time) => time.split(':').reduce((total, part) => total * 60 + Number(part), 0),
            secondsToHour: (seconds) => (seconds === 60 ? '00:01:00' : '00:00:00'),
            isJsonString: (text) => {
                try {
                    return JSON.parse(text);
                } catch {
                    return false;
                }
            },
            decrypt: (text) => text,
        };
        device = global.loadIdevice(join(__dirname, 'quick-questions-video.js'));
        vi.spyOn(device, 'loadYoutubeApi').mockImplementation(() => {});
        document.body.innerHTML = '<div id="videoTestBody"></div>';
        device.init(document.getElementById('videoTestBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevices.iDevice.gamification.helpers = previousHelpers;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its questions', () => {
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
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('sets the video and its questions in Questions, and the game in Options', () => {
        expect(panel('contents').querySelector('#vquextEPanel #vquextEVIURL')).not.toBeNull();
        expect(panel('contents').querySelector('#vquextEPanel #vquextPoint')).not.toBeNull();
        expect(panel('options').querySelector('#vquextEOptions #vquextETypeReto')).not.toBeNull();
        expect(panel('options').querySelector('#vquextEOptions #vquextENavigable')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgReply')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of [
            'vquextEHasFeedBack',
            'vquextEPercentajeFB',
            'vquextEFeedbackP',
            'vquextEFeedBackEditor',
            'vquextEGameModeHelpLnk',
        ]) {
            expect(document.getElementById(id)).toBeNull();
        }
    });

    it('explains each option without changing any of them', () => {
        const helps = [...document.querySelectorAll('#vquextEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#vquextQEIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(13);
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
        expect(tooltips.size).toBe(19); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('makes the feedback compulsory while No score is chosen', () => {
        const feedbackSwitch = document.getElementById('eXeGameHasFeedBack');

        document.getElementById('vquextETypeReto').click();

        expect(feedbackSwitch.checked).toBe(true);
        expect(feedbackSwitch.disabled).toBe(true);

        document.getElementById('vquextETypeActivity').click();

        expect(feedbackSwitch.checked).toBe(false);
        expect(feedbackSwitch.disabled).toBe(false);
    });

    it('restores the game mode and the feedback with the game', () => {
        device.updateFieldGame(game({ gameMode: 0, useLives: false, feedBack: true, percentajeFB: 80 }));

        expect(document.getElementById('vquextEGameMode').checked).toBe(true);
        expect(document.getElementById('vquextEUseLives').disabled).toBe(false);
        expect(document.getElementById('vquextENumberLives').disabled).toBe(true);
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
    });

    it('loads the saved feedback message into the shared editor', () => {
        device.idevicePreviousData = `
            <div class="vquext-IDevice">
                <div class="vquext-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
                <div class="vquext-feedback-game"><p>Well done</p></div>
            </div>`;

        device.loadPreviousValues();

        expect(feedback().getText()).toBe('<p>Well done</p>');
    });

    describe('saving', () => {
        let editors;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '',
                eXeGameFeedBackEditor: '',
            };
            vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                      }
                    : null
            );
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ feedBack: true, percentajeFB: 70 }));
            device.questionsGame = [question()];
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
        });

        it('does not save a No score game without its message', () => {
            device.updateFieldGame(game({ gameMode: 2 }));
            device.questionsGame = [question()];

            expect(device.validateData()).toBe(false);
            expect(eXe.app.getLastAlert()).toBe('Message to display when passing the game');
        });
    });
});

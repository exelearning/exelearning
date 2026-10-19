/**
 * Unit tests for Quick multiple choice (quick-questions-multiple-choice)
 * iDevice edition.
 *
 * The workarea clears the global $exeDevice when the editor closes
 * (ideviceNode.js), but DOM event handlers bound by addEvents stay attached.
 * Late events must not throw (issue #2271).
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handlers whose callback is a single guarded call: [selector, event, method]
const delegatedHandlers = [
    ['.SLCNE-EPanel input.SLCNE-Type', 'click', 'changeTypeQuestion'],
    ['.SLCNE-EPanel input.SLCNE-TypeSelect', 'click', 'showTypeQuestion'],
    ['.SLCNE-EPanel input.SLCNE-Number', 'click', 'showOptions'],
    ['#seleccionaEAdd', 'click', 'addQuestion'],
    ['#seleccionaEFirst', 'click', 'firstQuestion'],
    ['#seleccionaEPrevious', 'click', 'previousQuestion'],
    ['#seleccionaENext', 'click', 'nextQuestion'],
    ['#seleccionaELast', 'click', 'lastQuestion'],
    ['#seleccionaEDelete', 'click', 'removeQuestion'],
    ['#seleccionaECopy', 'click', 'copyQuestion'],
    ['#seleccionaECut', 'click', 'cutQuestion'],
    ['#seleccionaEPaste', 'click', 'pasteQuestion'],
    ['#seleccionaEPlayVideo', 'click', 'playVideoQuestion'],
    ['#seleccionaECheckSoundVideo', 'change', 'playVideoQuestion'],
    ['#eXeGameExportQuestions', 'click', 'exportQuestions'],
    ['.SLCNE-ESolution', 'change', 'clickSolution'],
    ['#seleccionaEImage', 'click', 'clickImage'],
    ['#seleccionaEVideoIntroPlay', 'click', 'playVideoIntro1'],
    ['#seleccionaEVIPlayI', 'click', 'playVideoIntro2'],
    ['#seleccionaEVIClose', 'click', 'stopVideoIntro'],
    [
        '#quickMultipleQEIdeviceForm input.SLCNE-TypeGame',
        'click',
        'updateGameMode',
    ],
    ['.SLCNE-TypeOrder', 'click', 'showSelectOrder'],
    ['#seleccionaECustomMessages', 'change', 'showSelectOrder'],
    ['#seleccionaEPercentajeQuestionsValue', 'keyup', 'updateQuestionsNumber'],
    ['#seleccionaEPercentajeQuestionsValue', 'click', 'updateQuestionsNumber'],
    [
        '#seleccionaEPercentajeQuestionsValue',
        'focusout',
        'updateQuestionsNumber',
    ],
];

// Handlers with a guard clause at the top: [selector, event]
const guardedHandlers = [
    ['#seleccionaEInitVideo', 'focusout'],
    ['#seleccionaGlobalTimeButton', 'click'],
    ['#seleccionaEScoreQuestion', 'focusout'],
    ['#eXeGameImportGame', 'change'],
    ['#seleccionaEInitVideo', 'click'],
    ['#seleccionaEEndVideo', 'click'],
    ['#seleccionaESilenceVideo', 'click'],
    ['#seleccionaEVideoTime', 'click'],
    ['#seleccionaEVIStart', 'click'],
    ['#seleccionaEVIEnd', 'click'],
    ['#seleccionaEVITime', 'click'],
    ['#seleccionaEURLImage', 'change'],
    ['#seleccionaEPlayImage', 'click'],
];

function buildForm() {
    document.body.innerHTML = `
        <div id="quickMultipleQEIdeviceForm">
            <div class="SLCNE-EPanel">
                <input class="SLCNE-Type" type="radio" value="1" />
                <input class="SLCNE-TypeSelect" type="radio" value="1" />
                <input class="SLCNE-Number" type="radio" value="3" />
            </div>
            <input class="SLCNE-TypeGame" type="radio" value="1" />
            <input class="SLCNE-TypeOrder" type="radio" value="1" />
            <input class="SLCNE-ESolution" type="checkbox" value="A" />
            <a href="#" id="seleccionaEAdd"></a>
            <a href="#" id="seleccionaEFirst"></a>
            <a href="#" id="seleccionaEPrevious"></a>
            <a href="#" id="seleccionaENext"></a>
            <a href="#" id="seleccionaELast"></a>
            <a href="#" id="seleccionaEDelete"></a>
            <a href="#" id="seleccionaECopy"></a>
            <a href="#" id="seleccionaECut"></a>
            <a href="#" id="seleccionaEPaste"></a>
            <a href="#" id="seleccionaEPlayVideo"></a>
            <input id="seleccionaECheckSoundVideo" type="checkbox" />
            <input id="seleccionaECheckImageVideo" type="checkbox" />
            <div id="eXeGameExportImport">
                <p class="exe-field-instructions"></p>
                <input id="eXeGameImportGame" type="file" />
                <a href="#" id="eXeGameExportQuestions"></a>
            </div>
            <img id="seleccionaEImage" alt="" />
            <a href="#" id="seleccionaEVideoIntroPlay"></a>
            <a href="#" id="seleccionaEVIPlayI"></a>
            <a href="#" id="seleccionaEVIClose"></a>
            <input id="seleccionaECustomMessages" type="checkbox" />
            <input id="seleccionaECustomScore" type="checkbox" />
            <input id="seleccionaEHasFeedBack" type="checkbox" />
            <input id="seleccionaEUseLives" type="checkbox" />
            <input id="seleccionaEPercentajeQuestionsValue" type="text" value="50" />
            <input id="seleccionaEInitVideo" type="text" value="00:00:00" />
            <input id="seleccionaEEndVideo" type="text" value="00:00:00" />
            <input id="seleccionaESilenceVideo" type="text" value="00:00:00" />
            <span id="seleccionaEVideoTime">00:01:00</span>
            <input id="seleccionaEVIStart" type="text" value="00:00:00" />
            <input id="seleccionaEVIEnd" type="text" value="00:00:00" />
            <span id="seleccionaEVITime">00:02:00</span>
            <a href="#" id="seleccionaGlobalTimeButton"></a>
            <input id="seleccionaEGlobalTimes" type="text" value="30" />
            <input id="seleccionaEScoreQuestion" type="text" value="abc" />
            <input id="seleccionaEURLImage" type="text" value="picture.png" />
            <a href="#" id="seleccionaEPlayImage"></a>
            <input id="seleccionaEAlt" type="text" value="" />
            <input id="seleccionaEXImage" type="text" value="0" />
            <input id="seleccionaEYImage" type="text" value="0" />
            <input id="seleccionaENumberQuestion" type="text" value="2" />
            <input id="seleccionaEURLAudio" type="text" value="" />
        </div>`;
}

describe('quick-questions-multiple-choice edition: $exeDevice guards (#2271)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildForm();
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn((url) => url),
        };
        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(
            join(__dirname, 'quick-questions-multiple-choice.js')
        );
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

        it.each([...delegatedHandlers, ...guardedHandlers])(
            'does not throw on %s %s',
            (selector, event) => {
                expect(() => $(selector).trigger(event)).not.toThrow();
            }
        );

        it('does not throw on question number Enter keyup', () => {
            expect(() =>
                $('#seleccionaENumberQuestion').trigger(
                    $.Event('keyup', { keyCode: 13 })
                )
            ).not.toThrow();
        });

        it('does not throw on empty audio URL change', () => {
            expect(() =>
                $('#seleccionaEURLAudio').trigger('change')
            ).not.toThrow();
        });

        it('does not throw in detached player callbacks', () => {
            const { clickPlay, onPlayerReady } = $exeDevice;
            expect(() => clickPlay()).not.toThrow();
            expect(() => onPlayerReady()).not.toThrow();
        });

        it('does not throw when a question image finishes loading late', () => {
            global.$exeDevice = $exeDevice;
            $exeDevice.showImage('picture.png', 0, 0, 'alt', 1);
            global.$exeDevice = undefined;
            const img = document.getElementById('seleccionaEImage');
            Object.defineProperty(img, 'complete', { value: true });
            Object.defineProperty(img, 'naturalWidth', { value: 100 });
            Object.defineProperty(img, 'naturalHeight', { value: 50 });
            expect(() => $(img).trigger('load')).not.toThrow();
            expect(() => $(img).trigger('error')).not.toThrow();
        });
    });

    describe('with $exeDevice still active', () => {
        it.each(delegatedHandlers)(
            '%s %s still calls %s',
            (selector, event, method) => {
                const spy = vi
                    .spyOn($exeDevice, method)
                    .mockImplementation(() => {});
                $(selector).trigger(event);
                expect(spy).toHaveBeenCalled();
            }
        );

        it('init video click still records the focused field', () => {
            $('#seleccionaEInitVideo').trigger('click');
            expect($exeDevice.timeVideoFocus).toBe(0);
            $('#seleccionaEEndVideo').trigger('click');
            expect($exeDevice.timeVideoFocus).toBe(1);
        });

        it('video time click still copies the time into the field', () => {
            $exeDevice.timeVideoFocus = 1;
            $('#seleccionaEVideoTime').trigger('click');
            expect($('#seleccionaEEndVideo').val()).toBe('00:01:00');
        });

        it('focusout still validates the time format', () => {
            const spy = vi
                .spyOn($exeDevice, 'validTime')
                .mockReturnValue(true);
            $('#seleccionaEInitVideo').trigger('focusout');
            expect(spy).toHaveBeenCalledWith('00:00:00');
        });

        it('global time button still updates every question', () => {
            $exeDevice.selectsGame = [{ time: 0 }, { time: 5 }];
            $('#seleccionaGlobalTimeButton').trigger('click');
            expect($exeDevice.selectsGame.map((q) => q.time)).toEqual([
                30, 30,
            ]);
        });

        it('score focusout still validates and resets bad scores', () => {
            $('#seleccionaEScoreQuestion').trigger('focusout');
            expect($('#seleccionaEScoreQuestion').val()).toBe('1');
        });

        it('image URL change still shows the image', () => {
            const spy = vi
                .spyOn($exeDevice, 'showImage')
                .mockImplementation(() => {});
            $('#seleccionaEURLImage').trigger('change');
            expect(spy).toHaveBeenCalledWith('picture.png', 0, 0, '');
        });
    });

    // The field truncates on keyup. Capped at one digit, a silence of 10 seconds
    // or more was impossible to type: the second keystroke was dropped and the
    // author was left with a different activity than they intended.
    describe('silence time limit', () => {
        beforeEach(() => {
            $('#quickMultipleQEIdeviceForm').append(
                '<input id="seleccionaETimeSilence" />'
            );
            $exeDevice.addEvents();
        });

        it('keeps a three-digit silence time', () => {
            $('#seleccionaETimeSilence').val('120').trigger('keyup');

            expect($('#seleccionaETimeSilence').val()).toBe('120');
        });

        it('truncates beyond three digits and drops non-digits', () => {
            $('#seleccionaETimeSilence').val('1a2345').trigger('keyup');

            expect($('#seleccionaETimeSilence').val()).toBe('123');
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
            source = readFileSync(join(__dirname, 'quick-questions-multiple-choice.js'), 'utf-8');
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
 * Everything this editor creates that can outlive its form — YouTube players,
 * the polling clock, the answer sound, the local video elements and the import
 * file readers — must be released when the edition closes, and none of their
 * callbacks may reach a later edition.
 */
describe('quick-questions-multiple-choice edition: lifecycle teardown (#2293)', () => {
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
        document.body.insertAdjacentHTML(
            'beforeend',
            '<video id="seleccionaEVideoLocal"></video>' + '<video id="seleccionaEVILocal"></video>',
        );
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
        $exeDevice = global.loadIdevice(join(__dirname, 'quick-questions-multiple-choice.js'));
        $exeDevice.addEvents();
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
            const spy = vi.spyOn($exeDevice, 'updateTimerDisplayLocal').mockImplementation(() => {});
            $exeDevice.clockVideo.start('local');

            const laterDevice = { updateTimerDisplayLocal: vi.fn() };
            global.$exeDevice = laterDevice;
            vi.advanceTimersByTime(1000);

            expect(spy).toHaveBeenCalledTimes(1);
            expect(laterDevice.updateTimerDisplayLocal).not.toHaveBeenCalled();
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

        it('destroys both players created when the API becomes ready', () => {
            fakeYouTubeApi();
            $exeDevice.youTubeReady();
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
            $exeDevice.selectsGame = [{}];
            vi.spyOn($exeDevice, 'showTypeQuestion').mockImplementation(() => {});
            $exeDevice.initQuestions();

            const local = document.getElementById('seleccionaEVideoLocal');
            const intro = document.getElementById('seleccionaEVILocal');
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
});

describe('quick-questions-multiple-choice minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'quick-questions-multiple-choice.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('quick-questions-multiple-choice edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/quick-questions-multiple-choice/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const tabNames = () =>
        [...document.querySelectorAll('#quickMultipleQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`quickMultipleQEIdeviceForm-panel-${name}`);
    const game = (overrides = {}) => ({
        typeGame: 'Selecciona',
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        selectsGame: [
            {
                typeSelect: 0,
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
                solution: '0',
                silentVideo: 0,
                tSilentVideo: 0,
                solutionWord: '',
                audio: '',
                hit: -1,
                error: -1,
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
                        tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
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
        tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) => id === 'seleccionaEText' ? editor : null);
        tinymceInit = vi.spyOn(global.tinymce, 'init').mockImplementation((config) => {
            config.setup(editor);
            return Promise.resolve([editor]);
        });
        document.body.innerHTML = '<div id="seleccionaBody"></div>';
        const filename = join(__dirname, 'quick-questions-multiple-choice.js');
        runInThisContext(readFileSync(filename, 'utf8'), { filename });
        device = global.$exeDevice;
        global.attachEditionLifecycle(device);
        vi.spyOn(device, 'loadYoutubeApi').mockImplementation(() => {});
        vi.spyOn(device, 'enableForm');
        vi.spyOn(device, 'loadPreviousValues');
        vi.spyOn(device, 'addEvents');
        device.init(document.getElementById('seleccionaBody'), {}, PATH);
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
        expect(document.getElementById('quickMultipleQEIdeviceForm-tab-contents').textContent.trim()).toBe('Questions');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
            'Choose the right answers and click on the Check button.'
        );
        expect(panel('options').querySelector('#seleccionaEOptions')).not.toBeNull();
        expect(panel('options').querySelector('#seleccionaEVIDiv #seleccionaEVILocal')).not.toBeNull();
        expect(panel('contents').querySelector('#seleccionaEVIDiv')).toBeNull();
        expect(panel('contents').querySelector('#seleccionaEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit').value).toBe('Submit');
    });

    it('provides one accessible information button at the end of each options row', () => {
        const options = panel('options');
        const rows = [...options.querySelector('#seleccionaEOptions').children];
        expect(rows).toHaveLength(13);
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
            document.getElementById('quickMultipleQEIdeviceForm-panels')
        );
    });

    it('explains every control in each combined options row', () => {
        const groups = [
            ['seleccionaEOrderLinear', 'Default', 'Random', 'Tree'],
            ['seleccionaEShowSolution', 'Show solutions', 'Show solution time (seconds)'],
            ['seleccionaETypeActivity', 'From 0 to 10', 'Points and lives', 'No score'],
            ['seleccionaEUseLives', 'Use lives', 'Number of lives'],
        ];
        for (const [id, ...labels] of groups) {
            const row = [...document.querySelector('#seleccionaEOptions').children].find((item) => item.querySelector(`#${id}`));
            const text = row.querySelector('.help-content').textContent;
            for (const label of labels) expect(text).toContain(`${label}:`);
            expect(text.split('\n\n')).toHaveLength(labels.length);
        }
    });

    it('handles option changes after TinyMCE initializes without toggling them from help', () => {
        const checkbox = document.getElementById('seleccionaEShowMinimize');
        const row = checkbox.closest('.toggle-item');
        row.click();
        expect(checkbox.checked).toBe(true);
        row.querySelector('.exe-idevice-help').click();
        expect(checkbox.checked).toBe(true);
        row.click();
        expect(checkbox.checked).toBe(false);
        document.querySelector('input[name="slcgamemode"][value="2"]').click();
        expect(feedback().isRequired()).toBe(true);
    });

    it('does not switch an option when its help or open explanation is clicked', () => {
        const helps = [...document.querySelectorAll('.toggle-item .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('.toggle-input')].map((input) => input.checked);
        const before = states();

        expect(helps.length).toBeGreaterThan(0);
        for (const help of helps) {
            help.click();
            help.querySelector('span').click();
            document.getElementById(help.getAttribute('aria-controls')).click();
        }

        expect(states()).toEqual(before);
    });

    it('keeps a locked switch and its message when its row is clicked', () => {
        document.querySelector('input[name="slcgamemode"][value="2"]').click();
        const feedbackSwitch = document.getElementById('eXeGameHasFeedBack');

        feedbackSwitch.closest('.toggle-item').click();

        expect(feedbackSwitch.checked).toBe(true);
        expect(feedbackSwitch.disabled).toBe(true);
        expect(document.getElementById('eXeGameFeedbackP').classList.contains('d-none')).toBe(false);
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
        expect(tooltips.size).toBe(13);
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
        expect(document.getElementById('seleccionaEHasFeedBack')).toBeNull();
        expect(document.getElementById('seleccionaEPercentajeFB')).toBeNull();
        expect(document.getElementById('seleccionaEFeedBackEditor')).toBeNull();
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('quickMultipleQEIdeviceForm-tab-options').click();

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
        expect(document.getElementById('seleccionaEUseLives').disabled).toBe(false);
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
            <div class="selecciona-IDevice">
                <div class="selecciona-version js-hidden">3.1</div>
                <div class="selecciona-feedback-game"><p>Well done</p></div>
                <div class="selecciona-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
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
                seleccionaEText: '',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                          hide: vi.fn(),
                          show: vi.fn(),
                      }
                    : null
            );
            device.selectsGame = [
                {
                    ...device.getCuestionDefault(),
                    quextion: 'Question 1',
                    options: ['A', 'B', 'C', 'D'],
                    solution: 0,
                },
            ];
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ selectsGame: device.selectsGame, feedBack: true, percentajeFB: 70 }));
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';
            vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            expect(device.save()).toContain('<div class="selecciona-feedback-game"><p>Bravo</p></div>');
        });

        it('asks for the message in "No score" mode', () => {
            device.updateFieldGame(game({ selectsGame: device.selectsGame, gameMode: 2 }));

            expect(device.validateData()).toBe(false);
            expect(global.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');
        });
    });
});

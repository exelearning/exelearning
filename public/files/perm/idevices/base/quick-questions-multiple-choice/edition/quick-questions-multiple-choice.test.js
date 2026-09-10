/**
 * Unit tests for Quick multiple choice (quick-questions-multiple-choice)
 * iDevice edition.
 *
 * The workarea clears the global $exeDevice when the editor closes
 * (ideviceNode.js), but DOM event handlers bound by addEvents stay attached.
 * Late events must not throw (issue #2271).
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

/**
 * Unit tests for Quick questions (quick-questions) iDevice edition.
 *
 * The editor creates resources that outlive its form — YouTube players, the
 * polling clock, the answer sound, the local <video> elements and the game
 * import file readers. The edition lifecycle must release all of them when the
 * editor closes, and none of their callbacks may reach a later edition
 * (issue #2293).
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

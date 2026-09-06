/**
 * Edition lifecycle tests for the trivial iDevice.
 *
 * The trivial editor owns resources that easily outlive its form: a YouTube
 * player, a local `<video>`, one-second polling intervals and the file readers
 * behind the import controls. Every one of them used to reach the mutable
 * `$exeDevice` global from a deferred callback, so a callback created by one
 * edition could drive a completely different iDevice opened later.
 *
 * These tests close the edition with `$lifecycle.destroy()` and assert that the
 * deferred work stops there.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    beforeEach(() => {
        FakeFileReader.instances = [];
        FakeYTPlayer.instances = [];

        originalFileReader = global.FileReader;
        originalYT = global.YT;
        originalItinerary = $exeDevicesEdition.iDevice.gamification.itinerary;
        originalStopSound = $exeDevicesEdition.iDevice.gamification.helpers.stopSound;

        global.FileReader = FakeFileReader;
        window.FileReader = FakeFileReader;
        $exeDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };
        $exeDevicesEdition.iDevice.gamification.helpers.stopSound = vi.fn();
        $exeDevicesEdition.iDevice.voiceRecorder = { initVoiceRecorders: vi.fn() };

        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'trivial.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
        global.FileReader = originalFileReader;
        window.FileReader = originalFileReader;
        global.YT = originalYT;
        $exeDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
        $exeDevicesEdition.iDevice.gamification.helpers.stopSound = originalStopSound;
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
        /** Builds the two file inputs `addEvents` wires the readers to. */
        const buildImportInputs = () => {
            ['eXeGameImportGame', 'trivialLoadGame', 'eXeGameExportImport', 'eXeGameExportQuestions'].forEach(id => {
                const input = document.createElement('input');
                input.type = 'file';
                input.id = id;
                document.body.appendChild(input);
            });
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

        it('imports a game while the edition is open', () => {
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

            selectFile('eXeGameImportGame', { name: 'game.json', type: 'application/json' });
            const reader = FakeFileReader.instances[0];
            expect(reader).toBeDefined();
            reader.fire('{"a":1}');

            expect(importGame).toHaveBeenCalledWith('{"a":1}');
            importGame.mockRestore();
        });

        it('aborts an in-flight import read when the edition closes', () => {
            selectFile('eXeGameImportGame', { name: 'game.json', type: 'application/json' });
            const reader = FakeFileReader.instances[0];
            expect(reader.readyState).toBe(1);

            $exeDevice.$lifecycle.destroy();

            expect(reader.abort).toHaveBeenCalledTimes(1);
        });

        it('ignores a late import callback instead of importing into a closed edition', () => {
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

            selectFile('eXeGameImportGame', { name: 'game.json', type: 'application/json' });
            const reader = FakeFileReader.instances[0];

            $exeDevice.$lifecycle.destroy();
            reader.fire('{"a":1}');

            expect(importGame).not.toHaveBeenCalled();
            importGame.mockRestore();
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

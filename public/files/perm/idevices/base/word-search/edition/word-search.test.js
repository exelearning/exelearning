/**
 * Edition lifecycle tests for the word-search iDevice.
 *
 * The editor previews clue audio with `new Audio()` plus a `canplaythrough`
 * handler, and imports games with a FileReader. Both are deferred: the clip can
 * finish buffering, and the read can complete, long after the editor closed. In
 * both cases the callback used to resolve `$exeDevice` from the global, which by
 * then is whatever iDevice the author opened next.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Audio double with a real event target, so `canplaythrough` can be dispatched
 * the way the platform would.
 */
function createFakeAudioClass() {
    return class FakeAudio extends EventTarget {
        constructor(src) {
            super();
            FakeAudio.instances.push(this);
            this.src = src;
            this.pause = vi.fn();
            this.load = vi.fn();
            this.play = vi.fn();
        }

        removeAttribute() {
            this.src = '';
        }
    };
}

/** FileReader double that fires only when a test says so. */
class FakeFileReader {
    constructor() {
        FakeFileReader.instances.push(this);
        this.readyState = 0;
        this.onload = null;
        this.abort = vi.fn(() => {
            this.readyState = 2;
        });
    }

    readAsText() {
        this.readyState = 1;
    }

    fire(result) {
        this.readyState = 2;
        if (this.onload) this.onload({ target: { result } });
    }
}
FakeFileReader.instances = [];

describe('word-search iDevice edition lifecycle', () => {
    let $exeDevice;
    let FakeAudio;
    let originalAudio;
    let originalFileReader;
    let originalMedia;
    let originalItinerary;

    beforeEach(() => {
        FakeAudio = createFakeAudioClass();
        FakeAudio.instances = [];
        FakeFileReader.instances = [];

        originalAudio = global.Audio;
        originalFileReader = global.FileReader;
        originalMedia = $exeDevices.iDevice.gamification.media;
        originalItinerary = $exeDevicesEdition.iDevice.gamification.itinerary;

        global.Audio = FakeAudio;
        window.Audio = FakeAudio;
        global.FileReader = FakeFileReader;
        window.FileReader = FakeFileReader;
        $exeDevices.iDevice.gamification.media = { extractURLGD: u => u };
        $exeDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };

        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'word-search.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
        global.Audio = originalAudio;
        window.Audio = originalAudio;
        global.FileReader = originalFileReader;
        window.FileReader = originalFileReader;
        $exeDevices.iDevice.gamification.media = originalMedia;
        $exeDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
    });

    describe('audio preview', () => {
        it('plays the clip once it can play through while the edition is open', () => {
            $exeDevice.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];

            audio.dispatchEvent(new Event('canplaythrough'));

            expect(audio.play).toHaveBeenCalledTimes(1);
        });

        it('stops the clip when the edition closes', () => {
            $exeDevice.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];

            $exeDevice.$lifecycle.destroy();

            expect(audio.pause).toHaveBeenCalledTimes(1);
            expect(audio.load).toHaveBeenCalledTimes(1);
            expect(audio.src).toBe('');
        });

        it('never starts a clip that finished buffering after the edition closed', () => {
            $exeDevice.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];

            $exeDevice.$lifecycle.destroy();
            audio.dispatchEvent(new Event('canplaythrough'));

            expect(audio.play).not.toHaveBeenCalled();
        });

        it('never plays through the iDevice that replaced this one', () => {
            const first = $exeDevice;
            first.playSound('clue.mp3');
            const audio = FakeAudio.instances[0];
            first.$lifecycle.destroy();

            const secondAudio = { play: vi.fn() };
            global.$exeDevice = { playerAudio: secondAudio };
            audio.dispatchEvent(new Event('canplaythrough'));

            expect(secondAudio.play).not.toHaveBeenCalled();
            global.$exeDevice = first;
        });
    });

    describe('game import', () => {
        const selectFile = () => {
            const input = document.getElementById('eXeGameImportGame');
            Object.defineProperty(input, 'files', {
                value: [{ name: 'game.txt', type: 'text/plain' }],
                configurable: true,
            });
            $(input).trigger('change');
        };

        beforeEach(() => {
            ['eXeGameImportGame', 'eXeGameExportQuestions', 'eXeGameExportImport'].forEach(id => {
                const input = document.createElement('input');
                input.type = 'file';
                input.id = id;
                document.body.appendChild(input);
            });
            $exeDevice.questionsGame = [];
            $exeDevice.addEvents();
        });

        it('imports the game while the edition is open', () => {
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

            selectFile();
            FakeFileReader.instances[0].fire('word list');

            expect(importGame).toHaveBeenCalledWith('word list', 'text/plain');
            importGame.mockRestore();
        });

        it('aborts an in-flight read when the edition closes', () => {
            selectFile();
            const reader = FakeFileReader.instances[0];
            expect(reader.readyState).toBe(1);

            $exeDevice.$lifecycle.destroy();

            expect(reader.abort).toHaveBeenCalledTimes(1);
        });

        it('ignores a late read callback instead of importing into a closed edition', () => {
            const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

            selectFile();
            const reader = FakeFileReader.instances[0];
            $exeDevice.$lifecycle.destroy();
            reader.fire('word list');

            expect(importGame).not.toHaveBeenCalled();
            importGame.mockRestore();
        });

        it('never imports into the iDevice that replaced this one', () => {
            const first = $exeDevice;
            selectFile();
            const reader = FakeFileReader.instances[0];
            first.$lifecycle.destroy();

            const second = { importGame: vi.fn() };
            global.$exeDevice = second;
            reader.fire('word list');

            expect(second.importGame).not.toHaveBeenCalled();
            global.$exeDevice = first;
        });
    });
});

/**
 * Unit tests for the Relate iDevice edition script.
 *
 * Covers the resources the edition owns and that outlive the edition form
 * unless the edition lifecycle releases them: the import FileReader and the
 * audio preview player.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('relate iDevice', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        // `loadIdevice` also attaches the real EditionLifecycle, exactly as
        // IdeviceNode does before calling init() in the workarea.
        $exeDevice = global.loadIdevice(join(__dirname, 'relate.js'));
    });

    describe('classIdevice', () => {
        it('has correct class identifier', () => {
            expect($exeDevice.classIdevice).toBe('relate');
        });
    });

    describe('edition lifecycle', () => {
        let savedGamification;
        let savedMedia;

        beforeEach(() => {
            savedGamification = global.$exeDevicesEdition.iDevice.gamification;
            global.$exeDevicesEdition.iDevice.gamification = {
                ...savedGamification,
                progressBar: { addEvents: vi.fn() },
                itinerary: { addEvents: vi.fn() },
                share: { addEvents: vi.fn(), downloadBlob: vi.fn(() => true) },
                helpers: { stopSound: vi.fn(), playSound: vi.fn() },
            };
            savedMedia = global.$exeDevices.iDevice.gamification.media;
            global.$exeDevices.iDevice.gamification.media = {
                extractURLGD: url => url,
            };

            document.body.innerHTML = `
        <div id="relateQIdeviceForm">
          <input id="eXeGameImportGame" type="file">
        </div>
      `;

            $exeDevice.addEvents();
        });

        afterEach(() => {
            // Close the edition the test opened, so nothing it registered leaks
            // into the next one.
            $exeDevice.$lifecycle.destroy();
            document.body.innerHTML = '';
            global.$exeDevicesEdition.iDevice.gamification = savedGamification;
            global.$exeDevices.iDevice.gamification.media = savedMedia;
        });

        describe('import FileReader', () => {
            /**
             * Drive the file input the way a user picking a file does, and hand back
             * the FileReader the edition created for it.
             *
             * @returns {FileReader}
             */
            function pickFile() {
                const readers = [];
                const RealFileReader = global.FileReader;
                class TrackedFileReader extends RealFileReader {
                    constructor() {
                        super();
                        readers.push(this);
                    }
                }
                global.FileReader = TrackedFileReader;
                try {
                    const input = document.getElementById('eXeGameImportGame');
                    Object.defineProperty(input, 'files', {
                        configurable: true,
                        value: [new File(['card'], 'game.txt', { type: 'text/plain' })],
                    });
                    $(input).trigger('change');
                } finally {
                    global.FileReader = RealFileReader;
                }
                return readers[0];
            }

            it('aborts a read that is still in flight when the edition closes', () => {
                const reader = pickFile();
                expect(reader).toBeDefined();
                const abort = vi.spyOn(reader, 'abort');

                expect(reader.readyState).toBe(1);
                $exeDevice.$lifecycle.destroy();

                expect(abort).toHaveBeenCalledTimes(1);
                abort.mockRestore();
            });

            it('discards a load that resolves after the edition closed', () => {
                const reader = pickFile();
                const importGame = vi.fn();
                $exeDevice.importGame = importGame;

                $exeDevice.$lifecycle.destroy();
                reader.onload({ target: { result: 'card' } });

                expect(importGame).not.toHaveBeenCalled();
            });

            it('imports a load that resolves while the edition is open', () => {
                const reader = pickFile();
                const importGame = vi.fn();
                $exeDevice.importGame = importGame;

                reader.onload({ target: { result: 'card' } });

                expect(importGame).toHaveBeenCalledWith('card', 'text/plain');
            });
        });

        describe('preview audio', () => {
            it('stops playback and releases the stream when the edition closes', () => {
                $exeDevice.playSound('files/beep.mp3');
                const player = $exeDevice.playerAudio;
                const pause = vi.spyOn(player, 'pause');

                $exeDevice.$lifecycle.destroy();

                expect(pause).toHaveBeenCalledTimes(1);
                expect(player.hasAttribute('src')).toBe(false);
                pause.mockRestore();
            });

            it('plays on canplaythrough while open, and stays silent afterwards', () => {
                $exeDevice.playSound('files/beep.mp3');
                const player = $exeDevice.playerAudio;
                const play = vi.spyOn(player, 'play').mockReturnValue(undefined);

                player.dispatchEvent(new Event('canplaythrough'));
                expect(play).toHaveBeenCalledTimes(1);

                $exeDevice.$lifecycle.destroy();
                player.dispatchEvent(new Event('canplaythrough'));

                expect(play).toHaveBeenCalledTimes(1);
                play.mockRestore();
            });
        });
    });
});

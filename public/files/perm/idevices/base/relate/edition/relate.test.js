/**
 * Unit tests for the Relate iDevice edition script.
 *
 * Covers the resources the edition owns and that outlive the edition form
 * unless the edition lifecycle releases them: the import FileReader and the
 * audio preview player.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
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
            source = readFileSync(join(__dirname, 'relate.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toContain('gamification.scorm.getTab(');
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

describe('relate minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'relate.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

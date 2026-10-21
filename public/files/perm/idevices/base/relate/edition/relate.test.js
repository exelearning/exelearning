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
            savedGamification = global.$exeIDevicesEdition.iDevice.gamification;
            global.$exeIDevicesEdition.iDevice.gamification = {
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
            global.$exeIDevicesEdition.iDevice.gamification = savedGamification;
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
            source = readFileSync(join(__dirname, 'relate.js'), 'utf-8');
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

describe('relate minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'relate.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('relate edition: shared form tabs and share windows', () => {
    const PATH = '/files/perm/idevices/base/relate/edition/';
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#relateQIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`relateQIdeviceForm-panel-${name}`);
    const card = (front, back, overrides = {}) => ({
        id: '',
        type: 2,
        url: '',
        audio: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
        eText: encodeURIComponent(front),
        color: '#000000',
        backcolor: '#ffffff',
        correct: 0,
        urlBk: '',
        audioBk: '',
        xBk: 0,
        yBk: 0,
        authorBk: '',
        altBk: '',
        eTextBk: encodeURIComponent(back),
        colorBk: '#000000',
        backcolorBk: '#ffffff',
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'Relaciona',
        author: '',
        randomCards: true,
        instructions: '',
        showMinimize: false,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        cardsGame: [card('Sun', 'Sol')],
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        textAfter: '',
        version: 2,
        percentajeCards: 100,
        type: 0,
        showSolution: true,
        timeShowSolution: 3,
        time: 3,
        evaluation: false,
        evaluationID: '',
        ...overrides,
    });
    let device;
    let previousApp;
    let tooltips;
    let previousHelpers;
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
        });
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
        device = global.loadIdevice(join(__dirname, 'relate.js'));
        document.body.innerHTML = '<div id="relateBody"></div>';
        device.init(document.getElementById('relateBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        for (const key of ['isJsonString', 'sanitizeJSONString']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its cards', () => {
        expect(tabNames()).toEqual(['instructions', 'options', 'contents', 'passwords', 'after', 'grading', 'texts']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('edits the pairs in Questions and the game in Options', () => {
        expect(panel('contents').firstElementChild.textContent).toContain('Add the pairs of cards');
        expect(panel('contents').querySelector('#rclEPanel #rclEText')).not.toBeNull();
        expect(panel('contents').querySelector('#rclEPanel #rclETextBack')).not.toBeNull();
        expect(panel('options').querySelector('#rclEOptions #rclETypeIdentify')).not.toBeNull();
        expect(panel('options').querySelector('#rclEOptions #rclEPercentajeCards')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgCheck')).not.toBeNull();
    });

    it('offers importing, exporting and creating the pairs with AI', () => {
        expect(
            [...panel('contents').querySelectorAll('[data-exe-share]')].map((link) => link.dataset.exeShare)
        ).toEqual(['import', 'export', 'ai']);
    });

    it('explains each option without changing any of them', () => {
        const helps = [...document.querySelectorAll('#rclEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#relateQIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(4);
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
        expect(tooltips.size).toBe(10); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('asks for the time only in the Advanced level', () => {
        const time = document.getElementById('rclETimeDiv');
        expect(time.classList.contains('d-none')).toBe(true);

        document.getElementById('rclETypeIdentify').click();

        expect(time.classList.contains('d-none')).toBe(false);

        document.getElementById('rclETypeShow').click();

        expect(time.classList.contains('d-none')).toBe(true);
    });

    it('restores the options, the cards and the texts with the game', () => {
        device.idevicePreviousData = `
            <div class="relaciona-IDevice">
                <div class="relaciona-DataGame js-hidden">${JSON.stringify(
                    game({ type: 2, time: 5, showMinimize: true, msgs: { msgCheck: 'Verify' } })
                )}</div>
            </div>`;

        device.loadPreviousValues();

        expect(document.getElementById('rclETypeIdentify').checked).toBe(true);
        expect(document.getElementById('rclETimeDiv').classList.contains('d-none')).toBe(false);
        expect(document.getElementById('rclETime').value).toBe('5');
        expect(document.getElementById('rclEShowMinimize').checked).toBe(true);
        expect(document.getElementById('rclEText').value).toBe('Sun');
        expect(document.getElementById('ci18n_msgCheck').value).toBe('Verify');
    });

    it('starts the voice recorders of its own form only', () => {
        device.$lifecycle.destroy();
        const recorders = vi.spyOn(global.$exeIDevicesEdition.iDevice.voiceRecorder, 'initVoiceRecorders');
        device = global.loadIdevice(join(__dirname, 'relate.js'));
        document.body.innerHTML = '<div id="relateBody"></div>';
        device.init(document.getElementById('relateBody'), {}, PATH);

        expect(recorders).toHaveBeenCalledWith(document.getElementById('relateQIdeviceForm'));
        recorders.mockRestore();
    });

    it('counts the first card of a new activity', () => {
        expect(document.getElementById('rclENumCards').textContent).toBe('1');
    });

    it('names each text, colour, authorship and alternative text field', () => {
        for (const side of ['', 'Back']) {
            for (const field of ['rclEText', 'rclEColor', 'rclEBgColor', 'rclEAuthor', 'rclEAlt']) {
                expect(document.getElementById(`${field}${side}`).labels).toHaveLength(1);
            }
        }
    });

    it('stores imported and generated texts encoded, as the form does', () => {
        device.insertCards(['50% off#Half price']);

        const added = device.cardsGame[device.cardsGame.length - 1];
        expect(added.eText).toBe(device.encodeURIComponentSafe('50% off'));
        expect(device.decodeURIComponentSafe(added.eText)).toBe('50% off');
    });

    it('tells the author a file is not a relate text or Moodle file instead of failing', () => {
        expect(() => device.importGame(JSON.stringify(game()), 'application/json')).not.toThrow();
        expect(eXe.app.getLastAlert()).toBe('The selected file does not contain a valid game');
    });

    it('writes clean front#back lines, and no line for a pair without both texts', () => {
        const lines = device.getLinesQuestions([
            card('Sun # star', 'Sol'),
            card('Moon', ''),
            { eText: 'Plain 50%', eTextBk: 'Text' },
        ]);

        expect(lines).toEqual(['Sun star#Sol', 'Plain 50%#Text']);
    });

    it('shows the number of the card left after deleting the last one', () => {
        device.cardsGame = [card('A', 'a'), card('B', 'b'), card('C', 'c')];
        device.active = 2;

        device.removeCard();

        expect(device.active).toBe(1);
        expect(document.getElementById('rclENumberCard').value).toBe('2');
    });

    describe('saving', () => {
        let editors;

        beforeEach(() => {
            editors = { eXeGameInstructions: '<p>Instructions</p>', eXeIdeviceTextAfter: '' };
            vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors ? { initialized: true, getContent: () => editors[id] } : null
            );
            document.getElementById('rclEText').value = 'Sun';
            document.getElementById('rclETextBack').value = 'Sol';
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('keeps the cards where the export reads them', () => {
            const html = device.save();

            expect(html).toContain('relaciona-DataGame');
            expect(html).toContain('"eText":"Sun"');
            expect(html).toContain('"eTextBk":"Sol"');
            expect(html).not.toContain('exe-idevice-help');
        });

        it('keeps the access code and the clue when saving', () => {
            const itinerary = {
                showClue: true,
                clueGame: 'Next key: river',
                percentageClue: 60,
                showCodeAccess: true,
                codeAccess: '1234',
                messageCodeAccess: 'Code of the previous activity?',
            };
            device.updateFieldGame(game({ itinerary }));

            expect(device.validateData().itinerary).toEqual(itinerary);
        });

        it('counts a pasted copy in the pairs per game', () => {
            device.copyCard();
            device.pasteCard();

            expect(device.cardsGame).toHaveLength(2);
            expect(document.getElementById('rclENumeroPercentaje').textContent).toBe('2/2');
        });

        it('stops adding cards at the maximum', () => {
            device.cardsGame = Array.from({ length: 200 }, () => card('A', 'a'));

            document.getElementById('rclEAddC').click();

            expect(device.cardsGame).toHaveLength(200);
            expect(eXe.app.getLastAlert()).toBe('Maximum card number: 200.');
        });

        it('stays on a card that is not complete when its number is typed', () => {
            device.cardsGame = [card('A', 'a'), card('B', 'b')];
            device.active = 0;
            document.getElementById('rclEText').value = '';
            document.getElementById('rclETextBack').value = '';
            const number = document.getElementById('rclENumberCard');
            number.value = '2';

            $(number).trigger($.Event('keyup', { keyCode: 13 }));

            expect(device.active).toBe(0);
            expect(number.value).toBe('1');
        });

        it('exports the card on screen with the others', async () => {
            const blobs = [];
            vi.spyOn(global.$exeIDevicesEdition.iDevice.gamification.share, 'downloadBlob').mockImplementation(
                (blob) => {
                    blobs.push(blob);
                    return true;
                }
            );

            device.exportQuestions();

            expect(await blobs[0].text()).toBe('Sun#Sol');
        });
    });

    describe('adding cards to the one on screen', () => {
        // The author typed it in a new activity: it is on screen, not in the list yet.
        const typeOnScreen = (front, back) => {
            $('#rclEText').val(front);
            $('#rclETextBack').val(back);
        };
        const fronts = () => device.cardsGame.map((item) => decodeURIComponent(item.eText));

        it('keeps it when it is complete', () => {
            typeOnScreen('Sun', 'Sol');

            device.insertCards(['Moon#Luna']);

            expect(fronts()).toEqual(['Sun', 'Moon']);
        });

        it('leaves it out, without its warning, when it is incomplete', () => {
            typeOnScreen('', 'Sol');
            const before = eXe.app._alertHistory.length;

            device.insertCards(['Moon#Luna']);

            expect(fronts()).toEqual(['Moon']);
            expect(eXe.app._alertHistory.slice(before)).toEqual([]);
        });
    });
});

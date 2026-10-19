/**
 * Unit tests for the word-search iDevice editor.
 *
 * Cover numeric field limits on keyup, the edition lifecycle teardown of
 * clue-audio preview and game-import file readers, and the form laid out in
 * the shared tabs with the shared feedback.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runInThisContext } from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('word-search iDevice edition', () => {
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
            <input id="sopaETime" />
      </form>`;
    $exeDevice = global.loadIdevice(join(__dirname, 'word-search.js'));
    $exeDevice.addEvents();
  });

  afterEach(() => {
    $exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
    document.body.innerHTML = '';
  });

  describe('numeric field limits', () => {
    it('keeps a 2-digit time', () => {
      $('#sopaETime').val('45').trigger('keyup');

      expect($('#sopaETime').val()).toBe('45');
    });

    it('truncates the time beyond 2 digits and drops non-digits', () => {
      $('#sopaETime').val('1a234').trigger('keyup');

      expect($('#sopaETime').val()).toBe('12');
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
            source = readFileSync(join(__dirname, 'word-search.js'), 'utf-8');
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
        originalItinerary = $exeIDevicesEdition.iDevice.gamification.itinerary;

        global.Audio = FakeAudio;
        window.Audio = FakeAudio;
        global.FileReader = FakeFileReader;
        window.FileReader = FakeFileReader;
        $exeDevices.iDevice.gamification.media = { extractURLGD: u => u };
        $exeIDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };

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
        $exeIDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
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

describe('word-search minimum score text', () => {
  it('offers the notice of the minimum score among the custom texts', () => {
    global.$exeDevice = undefined;
    const device = global.loadIdevice(join(__dirname, 'word-search.js'));
    device.refreshTranslations();

    expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
  });
});

describe('word-search edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/word-search/edition/';
    const feedback = () => global.$exeIDevicesEdition.iDevice.gamification.feedback;
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#sopaQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`sopaQEIdeviceForm-panel-${name}`);
    const word = (text, definition) => ({
        word: text,
        definition,
        url: '',
        audio: '',
        x: 0,
        y: 0,
        author: '',
        alt: '',
        solution: '',
    });
    const game = (overrides = {}) => ({
        typeGame: 'Sopa',
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        wordsGame: [word('CASA', 'Hogar'), word('ARBOL', 'Planta con tronco')],
        feedBack: false,
        percentajeFB: 100,
        isScorm: 0,
        textButtonScorm: 'Save score',
        ...overrides,
    });
    let device;
    let previousApp;
    let previousHelpers;
    let previousMedia;
    let tooltips;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning.app;
        tooltips = new Map();
        global.eXeLearning.app = {
            ...previousApp,
            common: {
                initTooltips: vi.fn((scope) => {
                    scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                        if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                    });
                }),
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
            decrypt: (text) => text,
            encrypt: (text) => text,
        });
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
        document.body.innerHTML = '<div id="wordSearchBody"></div>';
        const filename = join(__dirname, 'word-search.js');
        runInThisContext(readFileSync(filename, 'utf8'), { filename });
        device = global.$exeDevice;
        global.attachEditionLifecycle(device);
        device.init(document.getElementById('wordSearchBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        global.eXeLearning.app = previousApp;
        vi.unstubAllGlobals();
        for (const key of ['isJsonString', 'decrypt', 'encrypt']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevices.iDevice.gamification.media = previousMedia;
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
        expect(document.getElementById('sopaQEIdeviceForm-tab-contents').textContent.trim()).toBe('Questions');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe('Find the hidden words.');
        expect(panel('options').querySelector('#sopaEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#sopaEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgReply').value).toBe('Reply');
    });

    it('explains what goes in the Questions tab', () => {
        const info = panel('contents').firstElementChild;

        expect(info.classList.contains('alert-info')).toBe(true);
        expect(info.textContent).toContain('Add the words and their definitions, and edit them one by one.');
    });

    it('provides one accessible information button at the end of each options row', () => {
        const helpButtons = [...panel('options').querySelectorAll('#sopaEOptions .exe-idevice-help')];

        expect(helpButtons).toHaveLength(5);
        for (const help of helpButtons) {
            const row = help.closest('.d-flex');
            expect(row.lastElementChild.contains(help)).toBe(true);
            expect(help.type).toBe('button');
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
            const controls = [...row.querySelectorAll('input')];
            const checked = controls.map((control) => control.checked);
            help.click();
            row.querySelector('.help-content')?.click();
            expect(controls.map((control) => control.checked)).toEqual(checked);
        }
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBe(document.querySelectorAll('#sopaQEIdeviceForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(5);

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

    it('asks the AI for words the game can hide', () => {
        expect(document.getElementById('eXeEPromptArea').value).toContain('maximum of 14 letters');
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(document.getElementById('sopaEHasFeedBack')).toBeNull();
        expect(document.getElementById('sopaEPercentajeFB')).toBeNull();
        expect(document.getElementById('sopaEFeedBackEditor')).toBeNull();
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('restores the feedback with the game', () => {
        device.updateFieldGame(game({ feedBack: true, percentajeFB: 80 }));

        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
    });

    it('loads the saved message into the shared editor', () => {
        device.idevicePreviousData = `
            <div class="sopa-IDevice">
                <div class="sopa-version js-hidden">2</div>
                <div class="sopa-feedback-game"><p>Well done</p></div>
                <div class="sopa-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
            </div>`;
        vi.spyOn(device, 'showQuestion').mockImplementation(() => {});

        device.loadPreviousValues();

        expect(feedback().getText()).toBe('<p>Well done</p>');
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
    });

    it('imports the words of a text file', () => {
        device.importGame('SOL#Estrella\nLUNA#Satelite', 'text/plain');

        expect(device.wordsGame.map((item) => item.word)).toEqual(['SOL', 'LUNA']);
        expect(document.getElementById('sopaENumQuestions').textContent).toBe('2');
    });

    it('counts the first word of a new activity', () => {
        expect(device.wordsGame).toHaveLength(1);
        expect(document.getElementById('sopaENumQuestions').textContent).toBe('1');
    });

    it('counts a pasted copy in the words per game', () => {
        device.wordsGame = [word('CASA', 'Hogar'), word('ARBOL', 'Planta con tronco')];
        device.active = 0;
        device.showQuestion(0);
        device.updateQuestionsNumber();

        device.copyQuestion();
        device.pasteQuestion();

        expect(device.wordsGame).toHaveLength(3);
        expect(document.getElementById('sopaENumeroPercentaje').textContent).toBe('3/3');
    });

    it('does not tell the author that the AI words were added when none fits the game', async () => {
        document.getElementById('eXeEQuestionsArea').value = 'SOLAR SYSTEM#The sun and its planets';

        document.getElementById('eXeESaveButton').click();
        await vi.waitFor(() =>
            expect(eXe.app.getLastAlert()).toBe('Sorry, there are no questions for this type of activity.')
        );
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(eXe.app.getLastAlert()).toBe('Sorry, there are no questions for this type of activity.');
        expect(device.wordsGame).toHaveLength(1);
    });

    describe('saving', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '',
                eXeGameFeedBackEditor: '',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? { initialized: true, getContent: () => editors[id], setContent: (html) => (editors[id] = html) }
                    : null
            );
            device.wordsGame = [word('CASA', 'Hogar'), word('ARBOL', 'Planta con tronco')];
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ feedBack: true, percentajeFB: 70 }));
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';
            vi.spyOn(device, 'validateQuestion').mockReturnValue(true);

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            const html = device.save();
            expect(html).toContain('<div class="sopa-feedback-game"><p>Bravo</p></div>');
            expect(html).not.toContain('exe-idevice-help');
        });

        it('does not save a feedback switched on without its message', () => {
            device.updateFieldGame(game({ feedBack: true }));
            editors.eXeGameFeedBackEditor = '';

            expect(device.validateData()).toBe(false);
            expect(global.eXe.app.alert).toHaveBeenCalledWith('Message to display when passing the game');
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

        it('exports the word on screen with the others', async () => {
            const blobs = [];
            const download = vi
                .spyOn(global.$exeIDevicesEdition.iDevice.gamification.share, 'downloadBlob')
                .mockImplementation((blob) => {
                    blobs.push(blob);
                    return true;
                });
            device.active = 0;
            document.getElementById('sopaESolutionWord').value = 'SUN';
            document.getElementById('sopaEDefinitionWord').value = 'The star of our system';

            device.exportQuestions();
            download.mockRestore();

            expect(blobs).toHaveLength(1);
            expect(await blobs[0].text()).toBe('SUN#The star of our system\nARBOL#Planta con tronco');
        });

        it('saves its options', () => {
            device.updateFieldGame(
                game({ showMinimize: true, showResolve: false, diagonals: true, reverses: true, time: 5 })
            );

            expect(device.validateData()).toMatchObject({
                showMinimize: true,
                showResolve: false,
                diagonals: true,
                reverses: true,
                time: 5,
            });
        });
    });
});

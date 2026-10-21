/**
 * Unit tests for the sort iDevice edition: the pass score wiring, and the
 * shared form tabs with their options, feedback and saving.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('sort iDevice edition', () => {
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
            source = readFileSync(join(__dirname, 'sort.js'), 'utf-8');
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

describe('sort minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'sort.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('sort edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/sort/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
    const shown = (id) => !document.getElementById(id).classList.contains('d-none');
    const card = (eText) => ({
        id: '',
        type: 2,
        x: 0,
        y: 0,
        author: '',
        alt: '',
        url: '',
        audio: '',
        eText,
        color: '#000000',
        backcolor: '#ffffff',
    });
    const phrase = (overrides = {}) => ({
        cards: [card('One')],
        msgError: '',
        msgHit: '',
        definition: '',
        phrase: 'The cat sleeps',
        audioDefinition: '',
        audioHit: '',
        audioError: '',
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'Ordena',
        author: '',
        instructions: '',
        showMinimize: false,
        showSolution: true,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        phrasesGame: [phrase()],
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        textFeedBack: '',
        textAfter: '',
        caseSensitive: false,
        feedBack: false,
        percentajeFB: 100,
        customMessages: false,
        percentajeQuestions: 100,
        timeShowSolution: 3,
        time: 0,
        version: 1,
        maxWidth: false,
        cardHeight: 200,
        startAutomatically: false,
        orderedColumns: false,
        gameColumns: 0,
        evaluation: false,
        evaluationID: '',
        wordBorder: true,
        type: 0,
        imgCard: '',
        ...overrides,
    });
    const stored = (data, extra = '') => `
        <div class="ordena-IDevice">
            ${extra}
            <div class="ordena-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;
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
            decrypt: (text) => text,
            encrypt: (text) => text,
            arrayMove: (list, from, to) => list.splice(to, 0, list.splice(from, 1)[0]),
        });
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
        device = global.loadIdevice(join(__dirname, 'sort.js'));
        device.phrasesGame = [];
        document.body.innerHTML = '<div id="sortBody"></div>';
        device.init(document.getElementById('sortBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        for (const key of ['isJsonString', 'decrypt', 'encrypt', 'arrayMove']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its activities', () => {
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

    it('edits the activities in Questions and the game in Options', () => {
        expect(panel('contents').firstElementChild.textContent).toContain('Add the activities to put in order');
        expect(panel('contents').querySelector('#ordenaEPanel #ordenaEPraseI')).not.toBeNull();
        expect(panel('options').querySelector('#ordenaEOptions #odntype1')).not.toBeNull();
        expect(panel('options').querySelector('#ordenaEOptions #ordenaEWordBorder')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of ['ordenaEHasFeedBack', 'ordenaEPercentajeFB', 'ordenaEFeedbackP', 'ordenaEFeedBackEditor']) {
            expect(document.getElementById(id)).toBeNull();
        }
    });

    it('explains each option without changing any of them', () => {
        const helps = [...document.querySelectorAll('#ordenaEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#gameQEIdeviceForm input')].map((input) => input.checked);
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

    it('shows the options of each type of activity', () => {
        expect(shown('ordenaEWordBorderDiv')).toBe(true);
        expect(shown('ordenaColumnsDiv')).toBe(false);

        $('#odntype1').prop('checked', true).trigger('change');

        expect(shown('ordenaColumnsDiv')).toBe(true);
        expect(shown('ordenaStartAutomaticallyDiv')).toBe(true);
        expect(shown('ordenaEWordBorderDiv')).toBe(false);

        $('#odntype0').prop('checked', true).trigger('change');

        expect(shown('ordenaColumnsDiv')).toBe(false);
        expect(shown('ordenaEWordBorderDiv')).toBe(true);
    });

    it('restores the options, the activities and the feedback with the game', () => {
        device.idevicePreviousData = stored(
            game({ showMinimize: true, wordBorder: false, feedBack: true, percentajeFB: 80 }),
            '<div class="ordena-feedback-game"><p>Well done</p></div>'
        );

        device.loadPreviousValues();

        expect(document.getElementById('ordenaEShowMinimize').checked).toBe(true);
        expect(document.getElementById('ordenaEWordBorder').checked).toBe(false);
        expect(document.getElementById('ordenaEPraseI').value).toBe('The cat sleeps');
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
        expect(feedback().getText()).toBe('<p>Well done</p>');
    });

    it('offers the card size and the fixed headers only with the columns they need', () => {
        $('#odntype1').prop('checked', true).trigger('change');

        expect(shown('ordenaCustomizeCard')).toBe(false);
        expect(shown('ordenaFixedHeaders')).toBe(false);

        $('#odn1').prop('checked', true).trigger('change');

        expect(shown('ordenaCustomizeCard')).toBe(true);
        expect(shown('ordenaFixedHeaders')).toBe(false);

        $('#odn3').prop('checked', true).trigger('change');

        expect(shown('ordenaFixedHeaders')).toBe(true);
    });

    it('keeps the form inside the iDevice when the cards go in columns', () => {
        $('#odntype1').prop('checked', true).trigger('change');
        $('#odn3').prop('checked', true).trigger('change');

        expect(document.getElementById('gameQEIdeviceForm').style.width).toBe('');
        expect(document.getElementById('ordenaEPhrase').style.maxWidth).toBe('100%');
    });

    it('shows the text of the card being typed in its own preview', () => {
        const input = document.querySelector('#ordenaEPhrase .ODNE-EText');
        const id = input.id.replace('ordenaEText-', '');
        device.activeID = 'another';

        input.value = 'Cat';
        $(input).trigger('keyup');

        expect(document.getElementById(`ordenaETextDiv-${id}`).style.display).not.toBe('none');
    });

    it('starts a new activity without the statement, audio and messages of the previous one', () => {
        const fields = [
            'ordenaEDefinition',
            'ordenaEURLAudioDefinition',
            'ordenaEMessageOK',
            'ordenaEMessageKO',
            'ordenaEURLAudioOK',
            'ordenaEURLAudioKO',
        ];
        for (const id of fields) document.getElementById(id).value = 'previous';

        device.clearPhrase();

        for (const id of fields) expect(document.getElementById(id).value).toBe('');
    });

    it('names every field of the activity and of its cards', () => {
        $('#odntype1').prop('checked', true).trigger('change');
        const fields = [
            ...document.querySelectorAll('#ordenaEPanel input[type="text"], #ordenaEPanel input[type="color"]'),
        ];

        expect(fields.length).toBeGreaterThan(10);
        for (const field of fields) expect(field.labels, field.id).toHaveLength(1);
    });

    it('accepts wav files from the project', () => {
        const play = vi.spyOn(edition().gamification.helpers, 'playSound').mockImplementation(() => {});

        device.loadAudio('files/sound.wav');

        expect(play).toHaveBeenCalledWith('files/sound.wav');
        play.mockRestore();
    });

    it('drops a stored image link too short to be a file', () => {
        device.idevicePreviousData = stored(game({ type: 1 }), '<a href="x" class="js-hidden ordena-LinkImages-0">0</a>');
        device.phrasesGame = [];

        device.loadPreviousValues();

        expect(device.phrasesGame[0].cards[0].url).toBe('');
    });

    it('shows the back image without leaking globals', () => {
        delete globalThis.$image;
        delete globalThis.$nimage;

        device.showImageCard('files/back.png');

        expect(globalThis.$image).toBeUndefined();
        expect(globalThis.$nimage).toBeUndefined();
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
            device.updateFieldGame(game());
            device.showPhrase(0, true);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ feedBack: true, percentajeFB: 70 }));
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            const html = device.save();
            expect(html).toContain('<div class="ordena-feedback-game"><p>Bravo</p></div>');
            expect(html).not.toContain('exe-idevice-help');
        });

        it('does not save when the feedback is on without a message', () => {
            device.updateFieldGame(game({ feedBack: true }));

            expect(device.save()).toBe(false);
            expect(eXe.app.getLastAlert()).toBe('Message to display when passing the game');
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

        it('moves an activity with the cut and paste buttons', () => {
            device.updateFieldGame(game({ phrasesGame: [phrase({ phrase: 'First one' }), phrase({ phrase: 'Second one' })] }));
            device.showPhrase(0, true);

            document.getElementById('ordenaECut').click();
            // Moved to the second one, as the arrows do.
            device.active = 1;
            device.showPhrase(1);
            document.getElementById('ordenaEPaste').click();

            expect(device.phrasesGame.map((p) => p.phrase)).toEqual(['Second one', 'First one']);
        });

        it('counts a pasted copy in the activities per game', () => {
            device.copyPhrase();
            device.pastePhrase();

            expect(device.phrasesGame).toHaveLength(2);
            expect(document.getElementById('ordenaENumeroPercentaje').textContent).toBe('2/2');
        });

        it('keeps the changes made to the activity on screen after copying it', () => {
            device.copyPhrase();
            const copied = device.phrasesGame[0].definition;
            document.getElementById('ordenaEDefinition').value = 'Edited after copying';

            device.pastePhrase();

            expect(device.phrasesGame.map((p) => p.definition)).toEqual(['Edited after copying', copied]);
        });
    });
});

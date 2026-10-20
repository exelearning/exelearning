/**
 * Unit tests for the periodic-table iDevice edition code.
 *
 * They check the pass score wiring and the shared form tabs: what each tab
 * holds, the inline help of each setting, the feedback and saving.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('periodic-table iDevice (edition)', () => {
    let $exeDevice;
    let previousItinerary;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'periodic-table.js'));

        previousItinerary = global.$exeIDevicesEdition.iDevice.gamification.itinerary;
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            addEvents: vi.fn(),
            setValues: vi.fn(),
        };

        document.body.innerHTML = `
            <form id="periodicTableQEIdeviceForm">
                <div id="ptCheckBoxesGroups"></div>
            </form>`;
    });

    afterEach(() => {
        if (!$exeDevice.$lifecycle.isDestroyed()) $exeDevice.$lifecycle.destroy();
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
        document.body.innerHTML = '';
    });

    describe('i18n', () => {
        it('has category and name defined', () => {
            expect($exeDevice.i18n.category).toBeDefined();
            expect($exeDevice.i18n.name).toBeDefined();
        });
    });

    describe('validTime', () => {
        it('accepts a full hh:mm:ss value', () => {
            expect($exeDevice.validTime('01:02:03')).toBe(true);
        });

        it('rejects a truncated value', () => {
            expect($exeDevice.validTime('1:2:3')).toBe(false);
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
            source = readFileSync(join(__dirname, 'periodic-table.js'), 'utf-8');
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

describe('periodic-table minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'periodic-table.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('periodic-table edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/periodic-table/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#ptQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`ptQEIdeviceForm-panel-${name}`);
    const shown = (id) => document.getElementById(id).style.display !== 'none';
    const game = (overrides = {}) => ({
        typeGame: 'Periodic table',
        types: [0, 0, 1, 0, 0, 0],
        groups: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
        number: '5',
        attempts: '1',
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        textFeedBack: '',
        textAfter: '',
        feedBack: false,
        percentajeFB: 100,
        version: 1,
        evaluation: false,
        evaluationID: '',
        mode: 0,
        gameType: 2,
        ...overrides,
    });
    let device;
    let previousApp;
    let tooltips;
    let previousHelpers;

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
        helpers().isJsonString = (text) => {
            try {
                return JSON.parse(text);
            } catch {
                return false;
            }
        };
        device = global.loadIdevice(join(__dirname, 'periodic-table.js'));
        document.body.innerHTML = '<div id="periodicTableBody"></div>';
        device.init(document.getElementById('periodicTableBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        if ('isJsonString' in previousHelpers) helpers().isJsonString = previousHelpers.isJsonString;
        else delete helpers().isJsonString;
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
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('sets what learners do in Questions and how the game behaves in Options', () => {
        expect(panel('contents').firstElementChild.textContent).toContain(
            'Choose what learners do with the periodic table'
        );
        expect(panel('contents').querySelector('#ptEPanel #ptEGame')).not.toBeNull();
        expect(panel('contents').querySelector('#ptEPanel #ptCheckBoxesGroups')).not.toBeNull();
        expect(panel('contents').querySelector('#ptEPanel #ptEQuestionNumber')).not.toBeNull();
        expect(panel('options').querySelector('#ptEOptions #ptEAttemptsNumber')).not.toBeNull();
        expect(panel('options').querySelector('#ptEOptions #ptEShowSolution')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgReply')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of ['ptEHasFeedBack', 'ptEPercentajeFB', 'ptEFeedbackP', 'ptEFeedBackEditor']) {
            expect(document.getElementById(id)).toBeNull();
        }
        expect(document.querySelector('.Games-Reportdiv')).toBeNull();
    });

    it('explains each setting without changing any of them', () => {
        const helps = [...document.querySelectorAll('#ptEPanel .exe-idevice-help, #ptEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#ptQEIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(8);
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
        expect(tooltips.size).toBe(14); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('shows the data to complete in the Complete mode, and the type in the others', () => {
        expect(shown('ptGameType')).toBe(true);
        expect(shown('ptCompleteData')).toBe(false);

        $('#ptEComplete').prop('checked', true).trigger('change');

        expect(shown('ptCompleteData')).toBe(true);
        expect(shown('ptGameType')).toBe(false);

        device.updateFieldGame(game({ mode: 2 }));

        expect(shown('ptGameType')).toBe(true);
        expect(shown('ptCompleteData')).toBe(false);
    });

    it('restores the options and the feedback with the game', () => {
        device.updateFieldGame(game({ mode: 1, showMinimize: true, feedBack: true, percentajeFB: 80 }));

        expect(document.getElementById('ptEComplete').checked).toBe(true);
        expect(shown('ptCompleteData')).toBe(true);
        expect(document.getElementById('ptEShowMinimize').checked).toBe(true);
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
    });

    it('saves and restores the oxidation states with the other data to complete', () => {
        device.setCheckboxesStatus([0, 0, 0, 0, 0, 1]);

        expect(document.getElementById('ptEoxidations').checked).toBe(true);
        expect(device.checkCheckboxesStatus()).toEqual([0, 0, 0, 0, 0, 1]);
    });

    it('names each group of elements on its switch, so clicking the name chooses it', () => {
        const groups = [...document.querySelectorAll('#ptCheckBoxesGroups .toggle-input')];

        expect(groups).toHaveLength(11);
        for (const input of groups) {
            expect(input.labels).toHaveLength(1);
            expect(input.labels[0].textContent.length).toBeGreaterThan(2);
        }
        groups[7].labels[0].click();

        expect(groups[7].checked).toBe(true);
        expect(groups[0].checked).toBe(false);
    });

    it('loads the saved feedback message into the shared editor', () => {
        device.idevicePreviousData = `
            <div class="periodic-table-IDevice">
                <div class="periodic-table-feedback-game"><p>Well done</p></div>
                <div class="periodic-table-DataGame js-hidden">${JSON.stringify(game({ feedBack: true }))}</div>
            </div>`;

        device.loadPreviousValues();

        expect(feedback().getText()).toBe('<p>Well done</p>');
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
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                      }
                    : null
            );
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ feedBack: true, percentajeFB: 70 }));
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            const html = device.save();
            expect(html).toContain('<div class="periodic-table-feedback-game"><p>Bravo</p></div>');
            expect(html).not.toContain('exe-idevice-help');
        });

        it('does not save when the feedback is on without a message', () => {
            device.updateFieldGame(game({ feedBack: true }));

            expect(device.validateData()).toBe(false);
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
    });
});

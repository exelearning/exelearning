/**
 * Unit tests for the mathproblems iDevice edition code.
 *
 * They exercise the edition lifecycle: the formula listener is delegated on
 * `document`, so it must be released when the editor closes rather than
 * surviving into a later edition.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('mathproblems iDevice (edition)', () => {
    let $exeDevice;
    let previousItinerary;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'mathproblems.js'));

        previousItinerary = global.$exeIDevicesEdition.iDevice.gamification.itinerary;
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            addEvents: vi.fn(),
            setValues: vi.fn(),
        };

        document.body.innerHTML = `
            <form id="mathproblemsQEIdeviceForm">
                <input type="text" id="eCQformula" />
                <div id="eQCVariablesContainer"></div>
                <div id="eCQAleaContainer"></div>
                <input type="checkbox" id="eCQDefinidedVariables" />
                <input type="text" id="eCQTime" />
                <button id="eCQAdd"></button>
                <button id="eCQPaste"></button>
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

    describe('updateVariables', () => {
        it('creates one input per placeholder found in the formula', () => {
            $('#eCQformula').val('{a} + {b} - {a}');

            $exeDevice.updateVariables();

            expect($('#eQCVariablesContainer .MTOE-ValuesInput').length).toBe(2);
        });
    });

    describe('edition lifecycle teardown', () => {
        it('rebuilds the variables while the edition is open', () => {
            $exeDevice.addEvents();

            $('#eCQformula').val('{x}').trigger('input');

            expect($('#eQCVariablesContainer .MTOE-VariableName').text()).toBe('x');
        });

        it('stops rebuilding the variables once the edition is closed', () => {
            $exeDevice.addEvents();
            $('#eCQformula').val('{x}').trigger('input');

            $exeDevice.$lifecycle.destroy();
            $('#eCQformula').val('{y}').trigger('input');

            expect($('#eQCVariablesContainer .MTOE-VariableName').text()).toBe('x');
        });

        it('leaves unrelated document handlers in place after teardown', () => {
            const unrelated = vi.fn();
            $(document).on('input.mtpUnrelated', '#eCQformula', unrelated);
            $exeDevice.addEvents();

            $exeDevice.$lifecycle.destroy();
            $('#eCQformula').trigger('input');

            expect(unrelated).toHaveBeenCalledTimes(1);
            $(document).off('input.mtpUnrelated');
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
            source = readFileSync(join(__dirname, 'mathproblems.js'), 'utf-8');
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

describe('mathproblems minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'mathproblems.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('mathproblems edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/mathproblems/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
    const question = (overrides = {}) => ({
        min: 1,
        max: 10,
        decimals: 0,
        wording: '<p>Area of a triangle of base {b} and height {h}</p>',
        formula: '{b}*{h}/2',
        textFeedBack: '',
        time: 180,
        domains: false,
        definedVariables: false,
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'MathProblems',
        instruccions: '',
        showMinimize: false,
        optionsRamdon: false,
        showSolution: true,
        timeShowSolution: 3,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        percentajeQuestions: 100,
        modeBoard: false,
        questions: [question()],
        feedBack: false,
        textFeedBack: '',
        percentajeFB: 100,
        scorm: { isScorm: 0, textButtonScorm: 'Save score', repeatActivity: true },
        weighted: 100,
        textAfter: '',
        version: 2,
        errorAbsolute: 0,
        errorRelative: 0,
        errorType: 0,
        evaluation: false,
        evaluationID: '',
        ...overrides,
    });
    const stored = (data, extra = '') => `
        <div class="mathproblems-IDevice">
            ${extra}
            <div class="mathproblems-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;
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
        device = global.loadIdevice(join(__dirname, 'mathproblems.js'));
        document.body.innerHTML = '<div id="mathProblemsBody"></div>';
        device.init(document.getElementById('mathProblemsBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        for (const key of ['isJsonString', 'decrypt', 'encrypt']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its problems', () => {
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

    it('puts the problems in the Questions tab and the rest in Options', () => {
        expect(panel('contents').querySelector('#eCQEPanel #eCQformula')).not.toBeNull();
        expect(panel('contents').querySelector('#eCQEPanel #eCQNumQuestions')).not.toBeNull();
        expect(panel('options').querySelector('#eCQEOptions #eCQShowSolution')).not.toBeNull();
        expect(panel('options').querySelector('#eCQEOptions #eCQPercentajeQuestions')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of ['eCQHasFeedBack', 'eCQPercentajeFB', 'eCQFeedbackP', 'eCQFeedBackEditor']) {
            expect(document.getElementById(id)).toBeNull();
        }
        expect(document.querySelector('.Games-Reportdiv')).toBeNull();
    });

    it('explains each setting without changing any of them', () => {
        const helps = [...document.querySelectorAll('#eCQEPanel .exe-idevice-help, #eCQEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#gameQEIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(11);
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
        expect(tooltips.size).toBe(17); // Options plus the six shared Grading helpers.
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('restores the options and the feedback with the game', () => {
        device.updateFieldGame(game({ optionsRamdon: true, errorType: 2, feedBack: true, percentajeFB: 80 }));

        expect(document.getElementById('eCQOptionsRamdon').checked).toBe(true);
        expect(document.getElementById('eCQAbsolute').checked).toBe(true);
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
    });

    it('loads the saved feedback message into the shared editor', () => {
        device.idevicePreviousData = stored(
            game({ feedBack: true }),
            '<div class="mathproblems-feedback-game js-hidden"><p>Well done</p></div>'
        );

        device.loadPreviousValues();

        expect(feedback().getText()).toBe('<p>Well done</p>');
    });

    it('restores the custom texts with the game', () => {
        device.idevicePreviousData = stored(game({ msgs: { msgSubmit: 'Check it' } }));

        device.loadPreviousValues();

        expect(document.getElementById('ci18n_msgSubmit').value).toBe('Check it');
    });

    it('loads the feedback of each problem from the block the export reads', () => {
        device.idevicePreviousData = stored(
            game({ questions: [question({ textFeedBack: '<p>Old</p>' })] }),
            '<div class="js-hidden mathproblems-LinkFeedBacks" data-id="0"><p>Linked</p></div>'
        );

        device.loadPreviousValues();

        expect(device.questions[0].textFeedBack).toBe('<p>Linked</p>');
    });

    it('counts the problems each game uses next to the percentage', () => {
        device.questions = [question(), question(), question(), question()];
        document.getElementById('eCQPercentajeQuestions').value = '50';

        device.updateQuestionsNumber();

        expect(document.getElementById('eCQNumeroPercentaje').textContent).toBe('2/4');
        expect(document.getElementById('eCQPercentajeQuestions').value).toBe('50');
    });

    it('lets the solution time be changed again once the solutions are shown', () => {
        const time = document.getElementById('eCQTimeShowSolution');
        device.updateFieldGame(game({ showSolution: false }));
        expect(time.disabled).toBe(true);

        document.getElementById('eCQShowSolution').click();

        expect(time.disabled).toBe(false);
    });

    it('fills the domain of each variable without leaking a global', () => {
        delete globalThis.value;
        document.getElementById('eCQformula').value = '{x}';
        device.updateVariables();

        device.updateVariablesValues([{ name: 'x', value: '1 - 5' }]);

        expect(document.querySelector('#eQCVariablesContainer .MTOE-ValuesInput').value).toBe('1 - 5');
        expect(globalThis.value).toBeUndefined();
    });

    describe('saving', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '',
                eXeGameFeedBackEditor: '',
                eCQwording: question().wording,
                eCQfeedbackQuestion: '',
            };
            tinymceGet = vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                          hide: vi.fn(),
                          show: vi.fn(),
                      }
                    : null
            );
            device.questions = [question()];
            device.active = 0;
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
            expect(data.textFeedBack).toBe('<p>Bravo</p>');
            const html = device.save();
            expect(html).toContain('<div class="mathproblems-feedback-game js-hidden"><p>Bravo</p></div>');
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

        it('reads the instructions and the text after before their editors start', () => {
            delete editors.eXeGameInstructions;
            delete editors.eXeIdeviceTextAfter;
            document.getElementById('eXeGameInstructions').value = '<p>Read me</p>';
            document.getElementById('eXeIdeviceTextAfter').value = '<p>The end</p>';

            const data = device.validateData();

            expect(data.instruccions).toBe('<p>Read me</p>');
            expect(data.textAfter).toBe('<p>The end</p>');
        });

        it('asks for the range when one of its numbers is missing', () => {
            document.getElementById('eCQmin').value = '';

            expect(device.validateQuestion()).toBe(false);
            expect(eXe.app.getLastAlert()).toBe('Only the Feedback is optional');
        });

        it('counts a pasted copy in the problems per game', () => {
            device.copyQuestion();
            device.pasteQuestion();

            expect(device.questions).toHaveLength(2);
            expect(document.getElementById('eCQNumQuestions').textContent).toBe('2');
            expect(document.getElementById('eCQNumeroPercentaje').textContent).toBe('2/2');
        });
    });
});

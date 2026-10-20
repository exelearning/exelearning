/**
 * Unit tests for the mathproblems iDevice edition code.
 *
 * They exercise the edition lifecycle: the formula listener is delegated on
 * `document` and the question importer owns a `FileReader`, so both must be
 * released when the editor closes rather than surviving into a later edition.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('mathproblems iDevice (edition)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'mathproblems.js'));

        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            addEvents: vi.fn(),
            setValues: vi.fn(),
        };

        document.body.innerHTML = `
            <form id="mathproblemsQEIdeviceForm">
                <div id="eXeGameExportImport">
                    <input type="file" id="eXeGameImportGame" />
                    <button id="eXeGameExportQuestions"></button>
                </div>
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
        delete global.$exeDevicesEdition.iDevice.gamification.itinerary;
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

        it('imports a game file read by the edition', async () => {
            const importGame = vi.fn();
            $exeDevice.importGame = importGame;
            $exeDevice.addEvents();

            const event = $.Event('change');
            event.target = {
                files: [new File(['{"a":1}'], 'game.json', { type: 'application/json' })],
            };
            $('#eXeGameImportGame').trigger(event);

            await vi.waitFor(() => expect(importGame).toHaveBeenCalledWith('{"a":1}'));
        });

        it('aborts an in-flight import read and never imports into a closed edition', async () => {
            const abortSpy = vi.spyOn(window.FileReader.prototype, 'abort');
            const importGame = vi.fn();
            $exeDevice.importGame = importGame;
            $exeDevice.addEvents();

            const event = $.Event('change');
            event.target = {
                files: [new File(['{"a":1}'], 'game.json', { type: 'application/json' })],
            };
            $('#eXeGameImportGame').trigger(event);

            $exeDevice.$lifecycle.destroy();
            await new Promise(resolve => setTimeout(resolve, 20));

            expect(abortSpy).toHaveBeenCalledTimes(1);
            expect(importGame).not.toHaveBeenCalled();
            abortSpy.mockRestore();
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
            source = readFileSync(join(__dirname, 'mathproblems.js'), 'utf-8');
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

describe('mathproblems minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'mathproblems.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

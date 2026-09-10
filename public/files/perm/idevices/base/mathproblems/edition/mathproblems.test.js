/**
 * Unit tests for the mathproblems iDevice edition code.
 *
 * They exercise the edition lifecycle: the formula listener is delegated on
 * `document` and the question importer owns a `FileReader`, so both must be
 * released when the editor closes rather than surviving into a later edition.
 */

/* eslint-disable no-undef */
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
});

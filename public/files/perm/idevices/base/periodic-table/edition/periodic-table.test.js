/**
 * Unit tests for the periodic-table iDevice edition code.
 *
 * They exercise the edition lifecycle: the accessibility toggles are wired
 * through a handler delegated on `document`, which must be released when the
 * editor closes so it can never drive a later iDevice edition.
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('periodic-table iDevice (edition)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'periodic-table.js'));

        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            addEvents: vi.fn(),
            setValues: vi.fn(),
        };

        document.body.innerHTML = `
            <form id="periodicTableQEIdeviceForm">
                <div class="toggle-item" role="switch">
                    <input type="checkbox" class="toggle-input" data-target="#ptToggleTarget" />
                </div>
                <div id="ptToggleTarget"></div>
                <input type="checkbox" id="ptEHasFeedBack" />
                <div id="ptEFeedbackP"></div>
                <input type="text" id="ptEPercentajeFB" />
                <input type="text" id="ptETime" />
                <div id="ptCheckBoxesGroups"></div>
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

    describe('validTime', () => {
        it('accepts a full hh:mm:ss value', () => {
            expect($exeDevice.validTime('01:02:03')).toBe(true);
        });

        it('rejects a truncated value', () => {
            expect($exeDevice.validTime('1:2:3')).toBe(false);
        });
    });

    describe('edition lifecycle teardown', () => {
        it('keeps the toggles in sync through the delegated document handler', () => {
            $exeDevice.addEvents();

            $('.toggle-input').prop('checked', true).trigger('change');

            expect($('.toggle-item').attr('aria-checked')).toBe('true');
            expect($('#ptToggleTarget').css('display')).toBe('flex');
        });

        it('stops handling toggle changes on document once the edition is closed', () => {
            $exeDevice.addEvents();

            $exeDevice.$lifecycle.destroy();
            $('.toggle-input').prop('checked', true).trigger('change');

            expect($('.toggle-item').attr('aria-checked')).toBe('false');
        });

        it('leaves unrelated document handlers in place after teardown', () => {
            const unrelated = vi.fn();
            $(document).on('change.ptUnrelated', '.toggle-input', unrelated);
            $exeDevice.addEvents();

            $exeDevice.$lifecycle.destroy();
            $('.toggle-input').trigger('change');

            expect(unrelated).toHaveBeenCalledTimes(1);
            $(document).off('change.ptUnrelated');
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
            source = readFileSync(join(__dirname, 'periodic-table.js'), 'utf-8');
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

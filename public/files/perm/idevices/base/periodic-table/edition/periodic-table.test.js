/**
 * Unit tests for the periodic-table iDevice edition code.
 *
 * They exercise the edition lifecycle: the accessibility toggles are wired
 * through a handler delegated on `document`, which must be released when the
 * editor closes so it can never drive a later iDevice edition.
 */

/* eslint-disable no-undef */
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
});

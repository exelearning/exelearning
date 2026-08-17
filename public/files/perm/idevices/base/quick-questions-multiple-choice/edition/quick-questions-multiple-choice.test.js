/**
 * Unit tests for Quick multiple choice (quick-questions-multiple-choice)
 * iDevice edition.
 *
 * The workarea clears the global $exeDevice when the editor closes
 * (ideviceNode.js), but DOM event handlers bound by addEvents stay attached.
 * Late events must not throw (issue #2271).
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handlers whose callback is a single guarded call: [selector, event, method]
const delegatedHandlers = [
    ['.SLCNE-EPanel input.SLCNE-Type', 'click', 'changeTypeQuestion'],
    ['.SLCNE-EPanel input.SLCNE-TypeSelect', 'click', 'showTypeQuestion'],
    ['.SLCNE-EPanel input.SLCNE-Number', 'click', 'showOptions'],
    ['#seleccionaEAdd', 'click', 'addQuestion'],
    ['#seleccionaEFirst', 'click', 'firstQuestion'],
    ['#seleccionaEPrevious', 'click', 'previousQuestion'],
    ['#seleccionaENext', 'click', 'nextQuestion'],
    ['#seleccionaELast', 'click', 'lastQuestion'],
    ['#seleccionaEDelete', 'click', 'removeQuestion'],
    ['#seleccionaECopy', 'click', 'copyQuestion'],
    ['#seleccionaECut', 'click', 'cutQuestion'],
    ['#seleccionaEPaste', 'click', 'pasteQuestion'],
    ['#seleccionaEPlayVideo', 'click', 'playVideoQuestion'],
    ['#seleccionaECheckSoundVideo', 'change', 'playVideoQuestion'],
    ['#eXeGameExportQuestions', 'click', 'exportQuestions'],
    ['.SLCNE-ESolution', 'change', 'clickSolution'],
    ['#seleccionaEImage', 'click', 'clickImage'],
    ['#seleccionaEVideoIntroPlay', 'click', 'playVideoIntro1'],
    ['#seleccionaEVIPlayI', 'click', 'playVideoIntro2'],
    ['#seleccionaEVIClose', 'click', 'stopVideoIntro'],
    [
        '#quickMultipleQEIdeviceForm input.SLCNE-TypeGame',
        'click',
        'updateGameMode',
    ],
    ['.SLCNE-TypeOrder', 'click', 'showSelectOrder'],
    ['#seleccionaECustomMessages', 'change', 'showSelectOrder'],
    ['#seleccionaEPercentajeQuestionsValue', 'keyup', 'updateQuestionsNumber'],
    ['#seleccionaEPercentajeQuestionsValue', 'click', 'updateQuestionsNumber'],
    [
        '#seleccionaEPercentajeQuestionsValue',
        'focusout',
        'updateQuestionsNumber',
    ],
];

// Handlers with a guard clause at the top: [selector, event]
const guardedHandlers = [
    ['#seleccionaEInitVideo', 'focusout'],
    ['#seleccionaGlobalTimeButton', 'click'],
    ['#seleccionaEScoreQuestion', 'focusout'],
    ['#eXeGameImportGame', 'change'],
    ['#seleccionaEInitVideo', 'click'],
    ['#seleccionaEEndVideo', 'click'],
    ['#seleccionaESilenceVideo', 'click'],
    ['#seleccionaEVideoTime', 'click'],
    ['#seleccionaEVIStart', 'click'],
    ['#seleccionaEVIEnd', 'click'],
    ['#seleccionaEVITime', 'click'],
    ['#seleccionaEURLImage', 'change'],
    ['#seleccionaEPlayImage', 'click'],
];

function buildForm() {
    document.body.innerHTML = `
        <div id="quickMultipleQEIdeviceForm">
            <div class="SLCNE-EPanel">
                <input class="SLCNE-Type" type="radio" value="1" />
                <input class="SLCNE-TypeSelect" type="radio" value="1" />
                <input class="SLCNE-Number" type="radio" value="3" />
            </div>
            <input class="SLCNE-TypeGame" type="radio" value="1" />
            <input class="SLCNE-TypeOrder" type="radio" value="1" />
            <input class="SLCNE-ESolution" type="checkbox" value="A" />
            <a href="#" id="seleccionaEAdd"></a>
            <a href="#" id="seleccionaEFirst"></a>
            <a href="#" id="seleccionaEPrevious"></a>
            <a href="#" id="seleccionaENext"></a>
            <a href="#" id="seleccionaELast"></a>
            <a href="#" id="seleccionaEDelete"></a>
            <a href="#" id="seleccionaECopy"></a>
            <a href="#" id="seleccionaECut"></a>
            <a href="#" id="seleccionaEPaste"></a>
            <a href="#" id="seleccionaEPlayVideo"></a>
            <input id="seleccionaECheckSoundVideo" type="checkbox" />
            <input id="seleccionaECheckImageVideo" type="checkbox" />
            <div id="eXeGameExportImport">
                <p class="exe-field-instructions"></p>
                <input id="eXeGameImportGame" type="file" />
                <a href="#" id="eXeGameExportQuestions"></a>
            </div>
            <img id="seleccionaEImage" alt="" />
            <a href="#" id="seleccionaEVideoIntroPlay"></a>
            <a href="#" id="seleccionaEVIPlayI"></a>
            <a href="#" id="seleccionaEVIClose"></a>
            <input id="seleccionaECustomMessages" type="checkbox" />
            <input id="seleccionaECustomScore" type="checkbox" />
            <input id="seleccionaEHasFeedBack" type="checkbox" />
            <input id="seleccionaEUseLives" type="checkbox" />
            <input id="seleccionaEPercentajeQuestionsValue" type="text" value="50" />
            <input id="seleccionaEInitVideo" type="text" value="00:00:00" />
            <input id="seleccionaEEndVideo" type="text" value="00:00:00" />
            <input id="seleccionaESilenceVideo" type="text" value="00:00:00" />
            <span id="seleccionaEVideoTime">00:01:00</span>
            <input id="seleccionaEVIStart" type="text" value="00:00:00" />
            <input id="seleccionaEVIEnd" type="text" value="00:00:00" />
            <span id="seleccionaEVITime">00:02:00</span>
            <a href="#" id="seleccionaGlobalTimeButton"></a>
            <input id="seleccionaEGlobalTimes" type="text" value="30" />
            <input id="seleccionaEScoreQuestion" type="text" value="abc" />
            <input id="seleccionaEURLImage" type="text" value="picture.png" />
            <a href="#" id="seleccionaEPlayImage"></a>
            <input id="seleccionaEAlt" type="text" value="" />
            <input id="seleccionaEXImage" type="text" value="0" />
            <input id="seleccionaEYImage" type="text" value="0" />
            <input id="seleccionaENumberQuestion" type="text" value="2" />
            <input id="seleccionaEURLAudio" type="text" value="" />
        </div>`;
}

describe('quick-questions-multiple-choice edition: $exeDevice guards (#2271)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildForm();
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn((url) => url),
        };
        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(
            join(__dirname, 'quick-questions-multiple-choice.js')
        );
        $exeDevice.addEvents();
    });

    afterEach(() => {
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    describe('after the editor cleared the global $exeDevice', () => {
        beforeEach(() => {
            global.$exeDevice = undefined;
        });

        it.each([...delegatedHandlers, ...guardedHandlers])(
            'does not throw on %s %s',
            (selector, event) => {
                expect(() => $(selector).trigger(event)).not.toThrow();
            }
        );

        it('does not throw on question number Enter keyup', () => {
            expect(() =>
                $('#seleccionaENumberQuestion').trigger(
                    $.Event('keyup', { keyCode: 13 })
                )
            ).not.toThrow();
        });

        it('does not throw on empty audio URL change', () => {
            expect(() =>
                $('#seleccionaEURLAudio').trigger('change')
            ).not.toThrow();
        });

        it('does not throw in detached player callbacks', () => {
            const { clickPlay, onPlayerReady } = $exeDevice;
            expect(() => clickPlay()).not.toThrow();
            expect(() => onPlayerReady()).not.toThrow();
        });

        it('does not throw when a question image finishes loading late', () => {
            global.$exeDevice = $exeDevice;
            $exeDevice.showImage('picture.png', 0, 0, 'alt', 1);
            global.$exeDevice = undefined;
            const img = document.getElementById('seleccionaEImage');
            Object.defineProperty(img, 'complete', { value: true });
            Object.defineProperty(img, 'naturalWidth', { value: 100 });
            Object.defineProperty(img, 'naturalHeight', { value: 50 });
            expect(() => $(img).trigger('load')).not.toThrow();
            expect(() => $(img).trigger('error')).not.toThrow();
        });
    });

    describe('with $exeDevice still active', () => {
        it.each(delegatedHandlers)(
            '%s %s still calls %s',
            (selector, event, method) => {
                const spy = vi
                    .spyOn($exeDevice, method)
                    .mockImplementation(() => {});
                $(selector).trigger(event);
                expect(spy).toHaveBeenCalled();
            }
        );

        it('init video click still records the focused field', () => {
            $('#seleccionaEInitVideo').trigger('click');
            expect($exeDevice.timeVideoFocus).toBe(0);
            $('#seleccionaEEndVideo').trigger('click');
            expect($exeDevice.timeVideoFocus).toBe(1);
        });

        it('video time click still copies the time into the field', () => {
            $exeDevice.timeVideoFocus = 1;
            $('#seleccionaEVideoTime').trigger('click');
            expect($('#seleccionaEEndVideo').val()).toBe('00:01:00');
        });

        it('focusout still validates the time format', () => {
            const spy = vi
                .spyOn($exeDevice, 'validTime')
                .mockReturnValue(true);
            $('#seleccionaEInitVideo').trigger('focusout');
            expect(spy).toHaveBeenCalledWith('00:00:00');
        });

        it('global time button still updates every question', () => {
            $exeDevice.selectsGame = [{ time: 0 }, { time: 5 }];
            $('#seleccionaGlobalTimeButton').trigger('click');
            expect($exeDevice.selectsGame.map((q) => q.time)).toEqual([
                30, 30,
            ]);
        });

        it('score focusout still validates and resets bad scores', () => {
            $('#seleccionaEScoreQuestion').trigger('focusout');
            expect($('#seleccionaEScoreQuestion').val()).toBe('1');
        });

        it('image URL change still shows the image', () => {
            const spy = vi
                .spyOn($exeDevice, 'showImage')
                .mockImplementation(() => {});
            $('#seleccionaEURLImage').trigger('change');
            expect(spy).toHaveBeenCalledWith('picture.png', 0, 0, '');
        });
    });
});

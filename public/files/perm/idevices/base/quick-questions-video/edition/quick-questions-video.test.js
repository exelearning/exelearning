/**
 * Unit tests for Video test (quick-questions-video) iDevice edition.
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
    ['.VDQXTE-EPanel input.VDQXTE-Number', 'click', 'showOptions'],
    ['.VDQXTE-EPanel input.VDQXTE-TypeQuestion', 'click', 'showTypeQuestion'],
    ['#vquextEAdd', 'click', 'addQuestion'],
    ['#vquextEFirst', 'click', 'firstQuestion'],
    ['#vquextEPrevious', 'click', 'previousQuestion'],
    ['#vquextENext', 'click', 'nextQuestion'],
    ['#vquextELast', 'click', 'lastQuestion'],
    ['#vquextEDelete', 'click', 'removeQuestion'],
    ['#vquextEPlayVideo', 'click', 'playQuestionVideo'],
    ['#vquextEPercentajeQuestions', 'keyup', 'updateQuestionsNumber'],
    ['#vquextEPercentajeQuestions', 'click', 'updateQuestionsNumber'],
    ['#vquextEPercentajeQuestions', 'focusout', 'updateQuestionsNumber'],
    ['#vquextQEIdeviceForm input.VDQXTE-TypeGame', 'click', 'updateGameMode'],
    ['#vquextECustomMessages', 'change', 'showSelectOrder'],
];

// Handlers with a guard clause at the top: [selector, event]
const guardedHandlers = [
    ['#vquextEVIStart', 'focusout'],
    ['#vquextPoint', 'click'],
    ['#vquextEVIStart', 'click'],
    ['#vquextEVIEnd', 'click'],
    ['#vquextEVITime', 'click'],
    ['#vquextEVIURL', 'change'],
    ['#vquextEPlayStart', 'click'],
    ['#vquextGlobalTimeButton', 'click'],
];

function buildForm() {
    document.body.innerHTML = `
        <div id="vquextQEIdeviceForm">
            <div class="VDQXTE-EPanel">
                <input class="VDQXTE-Number" type="radio" value="3" />
                <input class="VDQXTE-TypeQuestion" type="radio" value="1" />
            </div>
            <input class="VDQXTE-TypeGame" type="radio" value="1" />
            <a href="#" id="vquextEAdd"></a>
            <a href="#" id="vquextEFirst"></a>
            <a href="#" id="vquextEPrevious"></a>
            <a href="#" id="vquextENext"></a>
            <a href="#" id="vquextELast"></a>
            <a href="#" id="vquextEDelete"></a>
            <a href="#" id="vquextEPlayVideo"></a>
            <input id="vquextEPercentajeQuestions" type="text" value="50" />
            <input id="vquextECustomMessages" type="checkbox" />
            <input id="vquextEHasFeedBack" type="checkbox" />
            <input id="vquextEUseLives" type="checkbox" />
            <input id="vquextPoint" type="text" value="00:00:00" />
            <input id="vquextEVIStart" type="text" value="00:00:00" />
            <input id="vquextEVIEnd" type="text" value="00:00:00" />
            <span id="vquextEVITime">00:01:00</span>
            <input id="vquextEVIURL" type="text" value="video.mp4" />
            <a href="#" id="vquextEPlayStart"></a>
            <a href="#" id="vquextGlobalTimeButton"></a>
            <input id="vquextEGlobalTimes" type="text" value="30" />
            <input id="vquextNumberQuestion" type="text" value="2" />
        </div>`;
}

describe('quick-questions-video edition: $exeDevice guards (#2271)', () => {
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
            join(__dirname, 'quick-questions-video.js')
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
                $('#vquextNumberQuestion').trigger(
                    $.Event('keyup', { keyCode: 13 })
                )
            ).not.toThrow();
        });

        it('does not throw in detached player/media callbacks', () => {
            const { clickPlay, onPlayerReady, onPlayerStateChange } =
                $exeDevice;
            const getDataVideoLocal = $exeDevice.getDataVideoLocal;
            expect(() => clickPlay()).not.toThrow();
            expect(() => onPlayerReady()).not.toThrow();
            expect(() => onPlayerStateChange()).not.toThrow();
            expect(() =>
                getDataVideoLocal.call({ duration: 10 })
            ).not.toThrow();
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

        it('start time click still records the focused field', () => {
            $('#vquextEVIStart').trigger('click');
            expect($exeDevice.timeVIFocus).toBe(1);
        });

        it('time display click still copies the time into the field', () => {
            $exeDevice.timeVIFocus = 1;
            $('#vquextEVITime').trigger('click');
            expect($('#vquextEVIStart').val()).toBe('00:01:00');
        });

        it('URL change still loads the video', () => {
            const spy = vi
                .spyOn($exeDevice, 'loadVideo')
                .mockImplementation(() => {});
            $('#vquextEVIURL').trigger('change');
            expect(spy).toHaveBeenCalledWith('video.mp4');
        });

        it('play start click still loads the video', () => {
            const spy = vi
                .spyOn($exeDevice, 'loadVideo')
                .mockImplementation(() => {});
            $('#vquextEPlayStart').trigger('click');
            expect(spy).toHaveBeenCalledWith('video.mp4');
        });

        it('focusout still validates the time format', () => {
            const spy = vi
                .spyOn($exeDevice, 'validTime')
                .mockReturnValue(true);
            $('#vquextEVIStart').trigger('focusout');
            expect(spy).toHaveBeenCalledWith('00:00:00');
        });

        it('global time button still updates every question', () => {
            $exeDevice.questionsGame = [{ time: 0 }, { time: 5 }];
            $('#vquextGlobalTimeButton').trigger('click');
            expect($exeDevice.questionsGame.map((q) => q.time)).toEqual([
                30, 30,
            ]);
        });

        it('question number Enter keyup still validates the question', () => {
            const spy = vi
                .spyOn($exeDevice, 'validateQuestion')
                .mockReturnValue(false);
            $('#vquextNumberQuestion').trigger(
                $.Event('keyup', { keyCode: 13 })
            );
            expect(spy).toHaveBeenCalled();
            expect($('#vquextNumberQuestion').val()).toBe('1');
        });
    });
});

// The defect: updateFieldGame called scorm.setValues with three arguments, so
// the helper's own default (100) reached the weight field instead of the stored
// value. getValues then read that 100 back out of the form, and saving the
// iDevice overwrote the author's weight.
describe('quick-questions-video edition: the SCORM weight survives a round trip', () => {
    let $exeDevice;
    let scormMock;

    /** The stored game, as loadDataGame leaves it before the form is filled. */
    function storedGame(overrides = {}) {
        return Object.assign(
            {
                isScorm: 1,
                textButtonScorm: 'Save score',
                repeatActivity: true,
                weighted: 40,
                itinerary: {},
                questionsGame: [],
                msgs: {},
            },
            overrides
        );
    }

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildForm();
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn((url) => url),
        };
        global.$exeDevices.iDevice.gamification.helpers.secondsToHour = vi.fn(
            () => '00:00:00'
        );
        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        scormMock = global.$exeDevicesEdition.iDevice.gamification.scorm;
        scormMock.setValues.mockClear();
        $exeDevice = global.loadIdevice(
            join(__dirname, 'quick-questions-video.js')
        );
        // Painting a question needs the whole editor panel; the weight does not.
        vi.spyOn($exeDevice, 'showQuestion').mockImplementation(() => {});
    });

    afterEach(() => {
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('hands the stored weight to the SCORM tab', () => {
        $exeDevice.updateFieldGame(storedGame({ weighted: 40 }));

        expect(scormMock.setValues).toHaveBeenCalledWith(
            1,
            'Save score',
            true,
            40
        );
    });

    it('passes a weight of 0 through instead of falling back to 100', () => {
        $exeDevice.updateFieldGame(storedGame({ weighted: 0 }));

        expect(scormMock.setValues.mock.calls[0][3]).toBe(0);
    });

    // loadDataGame defaults a game saved before the field existed to 100, and
    // that default must be the one that travels.
    it('carries the default when the stored game has no weight', () => {
        const game = storedGame();
        delete game.weighted;
        game.weighted = typeof game.weighted !== 'undefined' ? game.weighted : 100;

        $exeDevice.updateFieldGame(game);

        expect(scormMock.setValues.mock.calls[0][3]).toBe(100);
    });
});

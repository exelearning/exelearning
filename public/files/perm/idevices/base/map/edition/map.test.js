/**
 * Unit tests for Interactive map (map) iDevice edition.
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
    ['.MQE-ESolution', 'change', 'clickSolution'],
    ['.MQE-PESolution', 'change', 'clickPointSolution'],
    ['#mapaTypePointSelect', 'change', 'changeTypePoint'],
    ['#mapaEAdd', 'click', 'addPoint'],
    ['#mapaEFirst', 'click', 'firstPoint'],
    ['#mapaEPrevious', 'click', 'previousPoint'],
    ['#mapaENext', 'click', 'nextPoint'],
    ['#mapaELast', 'click', 'lastPoint'],
    ['#mapaEDelete', 'click', 'removePoint'],
    ['#mapaECopy', 'click', 'copyPoint'],
    ['#mapaECut', 'click', 'cutPoint'],
    ['#mapaEPaste', 'click', 'pastePoint'],
    ['#mapaEAddSlide', 'click', 'addSlide'],
    ['#mapaEFirstSlide', 'click', 'firstSlide'],
    ['#mapaEPreviousSlide', 'click', 'previousSlide'],
    ['#mapaENextSlide', 'click', 'nextSlide'],
    ['#mapaELastSlide', 'click', 'lastSlide'],
    ['#mapaEDeleteSlide', 'click', 'removeSlide'],
    ['#mapaECopySlide', 'click', 'copySlide'],
    ['#mapaECutSlide', 'click', 'cutSlide'],
    ['#mapaEPasteSlide', 'click', 'pasteSlide'],
    ['#mapaEAddQ', 'click', 'addQuestion'],
    ['#mapaEFirstQ', 'click', 'firstQuestion'],
    ['#mapaEPreviousQ', 'click', 'previousQuestion'],
    ['#mapaENextQ', 'click', 'nextQuestion'],
    ['#mapaELastQ', 'click', 'lastQuestion'],
    ['#mapaEDeleteQ', 'click', 'removeQuestion'],
    ['#mapaECopyQ', 'click', 'copyQuestion'],
    ['#mapaECutQ', 'click', 'cutQuestion'],
    ['#mapaEPasteQ', 'click', 'pasteQuestion'],
    ['#mapaEAddQ1', 'click', 'addPointQuestion'],
    ['#mapaEFirstQ1', 'click', 'firstPointQuestion'],
    ['#mapaEPreviousQ1', 'click', 'previousPointQuestion'],
    ['#mapaENextQ1', 'click', 'nextPointQuestion'],
    ['#mapaELastQ1', 'click', 'lastPointQuestion'],
    ['#mapaEDeleteQ1', 'click', 'removePointQuestion'],
    ['#mapaECopyQ1', 'click', 'copyPointQuestion'],
    ['#mapaECutQ1', 'click', 'cutPointQuestion'],
    ['#mapaEPasteQ1', 'click', 'pastePointQuestion'],
    ['#mapaPercentajeIdentify', 'keyup', 'updateQuestionsNumber'],
    ['#mapaPercentajeIdentify', 'click', 'updateQuestionsNumber'],
    ['#mapaPercentajeIdentify', 'focusout', 'updateQuestionsNumber'],
    ['#mapaPercentajeShowQ', 'keyup', 'updateShowQ'],
    ['#mapaPercentajeShowQ', 'click', 'updateShowQ'],
    ['#mapaPercentajeShowQ', 'focusout', 'updateShowQ'],
    ['#mapaPercentajeQuestions', 'keyup', 'updateNumberQuestions'],
    ['#mapaPercentajeQuestions', 'click', 'updateNumberQuestions'],
    ['#mapaPercentajeQuestions', 'focusout', 'updateNumberQuestions'],
    ['#gameQEIdeviceForm input.MQE-Number', 'click', 'showOptions'],
    ['#gameQEIdeviceForm input.MQE-PNumber', 'click', 'showPointOptions'],
    ['#gameQEIdeviceForm input.MQE-TypeSelect', 'click', 'showTypeQuestion'],
    [
        '#gameQEIdeviceForm input.MQE-PTypeSelect',
        'click',
        'showTypePointQuestion',
    ],
    ['#gameQEIdeviceForm input.MQE-TypeEvaluation', 'click', 'loadIcon'],
    ['#mapaPClose', 'click', 'stopVideo'],
    ['#mapaCloseLevel', 'click', 'closeLevel'],
    ['#mapaEditPointsMap', 'click', 'addLevel'],
    ['#mapaEditSlide', 'click', 'showSlides'],
    ['#mapaEditPointTest', 'click', 'showPointTests'],
    ['#mapaSClose', 'click', 'closeSlide'],
    ['#mapaPTClose', 'click', 'closePointTest'],
];

// Handlers with a guard clause at the top: [selector, event]
const guardedHandlers = [
    ['#mapaPInitVideo', 'focusout'],
    ['#mapaPInitVideo', 'click'],
    ['#mapaPEndVideo', 'click'],
    ['#mapaPVideoTime', 'click'],
    ['#mapaURLImageMap', 'change'],
    ['#mapaShowImageMap', 'click'],
    ['#mapaShowImage', 'click'],
    ['#mapaSShowImage', 'click'],
    ['#mapaSURLImage', 'change'],
    ['#mapaProtector', 'mousedown'],
    ['#mapaProtector', 'mouseup'],
    ['#mapaURLImage', 'change'],
    ['#mapaPURLImage', 'change'],
    ['#mapaPShowImage', 'click'],
    ['#mapaPlayVideo', 'click'],
    ['#mapaPPlayVideo', 'click'],
    ['#mapaURLAudio', 'change'],
    ['#mapaURLAudioIdentify', 'change'],
    ['#mapaCanvas', 'click'],
    ['#mapaUndoButton', 'click'],
    ['#mapaRedoButton', 'click'],
    ['#mapaClearButton', 'click'],
    ['.MQP-DropdownContent li', 'click'],
];

function buildForm() {
    const navButtons = [
        'mapaEAdd',
        'mapaEFirst',
        'mapaEPrevious',
        'mapaENext',
        'mapaELast',
        'mapaEDelete',
        'mapaECopy',
        'mapaECut',
        'mapaEPaste',
        'mapaEAddSlide',
        'mapaEFirstSlide',
        'mapaEPreviousSlide',
        'mapaENextSlide',
        'mapaELastSlide',
        'mapaEDeleteSlide',
        'mapaECopySlide',
        'mapaECutSlide',
        'mapaEPasteSlide',
        'mapaEAddQ',
        'mapaEFirstQ',
        'mapaEPreviousQ',
        'mapaENextQ',
        'mapaELastQ',
        'mapaEDeleteQ',
        'mapaECopyQ',
        'mapaECutQ',
        'mapaEPasteQ',
        'mapaEAddQ1',
        'mapaEFirstQ1',
        'mapaEPreviousQ1',
        'mapaENextQ1',
        'mapaELastQ1',
        'mapaEDeleteQ1',
        'mapaECopyQ1',
        'mapaECutQ1',
        'mapaEPasteQ1',
        'mapaShowImageMap',
        'mapaShowImage',
        'mapaSShowImage',
        'mapaPShowImage',
        'mapaPClose',
        'mapaPlayVideo',
        'mapaPPlayVideo',
        'mapaCloseLevel',
        'mapaEditPointsMap',
        'mapaEditSlide',
        'mapaEditPointTest',
        'mapaSClose',
        'mapaPTClose',
        'mapaUndoButton',
        'mapaRedoButton',
        'mapaClearButton',
    ]
        .map((id) => `<a href="#" id="${id}"></a>`)
        .join('');
    document.body.innerHTML = `
        <div id="gameQEIdeviceForm">
            <input class="MQE-ESolution" type="checkbox" value="A" />
            <input class="MQE-PESolution" type="checkbox" value="A" />
            <select id="mapaTypePointSelect"><option value="0">0</option></select>
            ${navButtons}
            <input class="MQE-Number" type="radio" value="3" />
            <input class="MQE-PNumber" type="radio" value="3" />
            <input class="MQE-TypeSelect" type="radio" value="1" />
            <input class="MQE-PTypeSelect" type="radio" value="1" />
            <input class="MQE-TypeEvaluation" type="radio" value="0" />
            <input id="mapaPercentajeIdentify" type="text" value="50" />
            <input id="mapaPercentajeShowQ" type="text" value="50" />
            <input id="mapaPercentajeQuestions" type="text" value="50" />
            <input id="mapaPInitVideo" type="text" value="00:00:00" />
            <input id="mapaPEndVideo" type="text" value="00:00:00" />
            <span id="mapaPVideoTime">00:01:00</span>
            <input id="mapaURLImageMap" type="text" value="map.png" />
            <input id="mapaURLImage" type="text" value="point.png" />
            <input id="mapaPURLImage" type="text" value="point.png" />
            <input id="mapaSURLImage" type="text" value="slide.png" />
            <input id="mapaAltImageMap" type="text" value="" />
            <input id="mapaPAltImage" type="text" value="" />
            <input id="mapaSAltImage" type="text" value="" />
            <input id="mapaX" type="text" value="0" />
            <input id="mapaY" type="text" value="0" />
            <a href="#" id="mapaBtnDrop" data-value="0"></a>
            <div class="MQP-DropdownContent"><li data-value="1"></li></div>
            <div id="mapaProtector"></div>
            <canvas id="mapaCanvas"></canvas>
            <input id="mapaTitle" type="text" value="" />
            <input id="mapaFooter" type="text" value="" />
            <input id="mapaURLAudio" type="text" value="" />
            <input id="mapaURLAudioIdentify" type="text" value="" />
            <input id="mapaURLYoutube" type="text" value="" />
            <input id="mapaPURLYoutube" type="text" value="" />
            <input id="mapaNumberPoint" type="text" value="2" />
            <input id="mapaNumberPoint1" type="text" value="2" />
            <img id="mapaPImage" alt="" />
            <div id="mapaPNoImage"></div>
        </div>`;
}

describe('map edition: $exeDevice guards (#2271)', () => {
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
        global.$exeDevicesEdition.iDevice.gamification.helpers.playSound =
            vi.fn();
        global.$exeDevicesEdition.iDevice.gamification.helpers.stopSound =
            vi.fn();
        $exeDevice = global.loadIdevice(join(__dirname, 'map.js'));
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

        it('does not throw on point number Enter keyup', () => {
            expect(() =>
                $('#mapaNumberPoint').trigger(
                    $.Event('keyup', { keyCode: 13 })
                )
            ).not.toThrow();
            expect(() =>
                $('#mapaNumberPoint1').trigger(
                    $.Event('keyup', { keyCode: 13 })
                )
            ).not.toThrow();
        });

        it('does not throw in detached player callbacks', () => {
            const { clickPlay, onPlayerReady } = $exeDevice;
            expect(() => clickPlay()).not.toThrow();
            expect(() => onPlayerReady()).not.toThrow();
        });

        it('does not throw when a point image finishes loading late', () => {
            global.$exeDevice = $exeDevice;
            $exeDevice.showImage('point.png', 'alt');
            global.$exeDevice = undefined;
            const img = document.getElementById('mapaPImage');
            Object.defineProperty(img, 'complete', { value: true });
            Object.defineProperty(img, 'naturalWidth', { value: 100 });
            Object.defineProperty(img, 'naturalHeight', { value: 50 });
            expect(() => $(img).trigger('load')).not.toThrow();
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
            $('#mapaPInitVideo').trigger('click');
            expect($exeDevice.timeVideoFocus).toBe(0);
            $('#mapaPEndVideo').trigger('click');
            expect($exeDevice.timeVideoFocus).toBe(1);
        });

        it('focusout still validates the time format', () => {
            const spy = vi
                .spyOn($exeDevice, 'validTime')
                .mockReturnValue(true);
            $('#mapaPInitVideo').trigger('focusout');
            expect(spy).toHaveBeenCalledWith('00:00:00');
        });

        it('map image URL change still shows the map image', () => {
            const spy = vi
                .spyOn($exeDevice, 'showImageMap')
                .mockImplementation(() => {});
            $('#mapaURLImageMap').trigger('change');
            expect(spy).toHaveBeenCalled();
        });

        it('canvas click still records the drawn point', () => {
            $exeDevice.currentPoints = [];
            $exeDevice.redoPoints = [];
            vi.spyOn($exeDevice, 'drawCurrentArea').mockImplementation(
                () => {}
            );
            $('#mapaCanvas').trigger('click');
            expect($exeDevice.currentPoints.length).toBe(1);
        });

        it('undo click still moves the last point to the redo list', () => {
            $exeDevice.currentPoints = [{ x: 0.1, y: 0.2 }];
            $exeDevice.redoPoints = [];
            vi.spyOn($exeDevice, 'drawCurrentArea').mockImplementation(
                () => {}
            );
            $('#mapaUndoButton').trigger('click');
            expect($exeDevice.currentPoints.length).toBe(0);
            expect($exeDevice.redoPoints.length).toBe(1);
        });

        it('dropdown item click still sets the icon type', () => {
            const setIconType = vi
                .spyOn($exeDevice, 'setIconType')
                .mockImplementation(() => {});
            const loadIcon = vi
                .spyOn($exeDevice, 'loadIcon')
                .mockImplementation(() => {});
            $('.MQP-DropdownContent li').trigger('click');
            expect(setIconType).toHaveBeenCalledWith(1);
            expect(loadIcon).toHaveBeenCalled();
        });

        it('point image load still places the image', () => {
            $exeDevice.showImage('point.png', 'alt');
            const img = document.getElementById('mapaPImage');
            Object.defineProperty(img, 'complete', { value: true });
            Object.defineProperty(img, 'naturalWidth', { value: 100 });
            Object.defineProperty(img, 'naturalHeight', { value: 50 });
            const spy = vi
                .spyOn($exeDevice, 'placeImageWindows')
                .mockReturnValue({ w: 10, h: 5, x: 0, y: 0 });
            vi.spyOn($exeDevice, 'drawImage').mockImplementation(() => {});
            $(img).trigger('load');
            expect(spy).toHaveBeenCalledWith(img, 100, 50);
        });
    });
});

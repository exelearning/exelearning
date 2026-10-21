/**
 * Unit tests for Interactive map (map) iDevice edition.
 *
 * The workarea clears the global $exeDevice when the editor closes
 * (ideviceNode.js), but DOM event handlers bound by addEvents stay attached.
 * Late events must not throw (issue #2271).
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
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
            <img id="mapaPImage" alt="" />
            <div id="mapaPNoImage"></div>
            <video id="mapaEVideoLocal"></video>
        </div>`;
}

describe('map edition: $exeDevice guards (#2271)', () => {
    let $exeDevice;
    let previousItinerary;
    let previousPlaySound;
    let previousStopSound;

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildForm();
        const gamification = global.$exeIDevicesEdition.iDevice.gamification;
        previousItinerary = gamification.itinerary;
        previousPlaySound = gamification.helpers.playSound;
        previousStopSound = gamification.helpers.stopSound;
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: vi.fn(() => false),
            getURLVideoMediaTeca: vi.fn(() => false),
            extractURLGD: vi.fn((url) => url),
        };
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        global.$exeIDevicesEdition.iDevice.gamification.helpers.playSound =
            vi.fn();
        global.$exeIDevicesEdition.iDevice.gamification.helpers.stopSound =
            vi.fn();
        $exeDevice = global.loadIdevice(join(__dirname, 'map.js'));
        $exeDevice.addEvents();
    });

    afterEach(() => {
        // Close the edition as the workarea does, so nothing this test owns
        // (timers, players, media) survives into the next one.
        $exeDevice.$lifecycle.destroy();
        const gamification = global.$exeIDevicesEdition.iDevice.gamification;
        gamification.itinerary = previousItinerary;
        gamification.helpers.playSound = previousPlaySound;
        gamification.helpers.stopSound = previousStopSound;
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
            source = readFileSync(join(__dirname, 'map.js'), 'utf-8');
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

    describe('edition lifecycle teardown (#2293)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
            delete global.YT;
            window.onYouTubeIframeAPIReady = undefined;
        });

        it('stops the local video timer when the edition closes', () => {
            const player = document.getElementById('mapaEVideoLocal');
            vi.spyOn(player, 'play').mockImplementation(() => {});
            const tick = vi.spyOn($exeDevice, 'updateTimerDisplayLocal').mockImplementation(() => {});

            $exeDevice.startVideo('video.mp4', 0, 10, 1);
            vi.advanceTimersByTime(1000);
            expect(tick).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(5000);
            expect(tick).toHaveBeenCalledTimes(1);
        });

        it('stops the YouTube timer when the edition closes', () => {
            $exeDevice.player = { loadVideoById: vi.fn() };
            const tick = vi.spyOn($exeDevice, 'updateTimerDisplay').mockImplementation(() => {});

            $exeDevice.startVideo('abc123', 0, 10, 0);
            vi.advanceTimersByTime(2000);
            expect(tick).toHaveBeenCalledTimes(2);

            $exeDevice.$lifecycle.destroy();
            vi.advanceTimersByTime(5000);
            expect(tick).toHaveBeenCalledTimes(2);
        });

        it('stops the local video element when the edition closes', () => {
            const player = document.getElementById('mapaEVideoLocal');
            const pause = vi.spyOn(player, 'pause').mockImplementation(() => {});
            const load = vi.spyOn(player, 'load').mockImplementation(() => {});
            player.setAttribute('src', 'video.mp4');

            $exeDevice.$lifecycle.destroy();

            expect(pause).toHaveBeenCalledTimes(1);
            expect(player.hasAttribute('src')).toBe(false);
            expect(load).toHaveBeenCalledTimes(1);
        });

        it('destroys the YouTube player when the edition closes', () => {
            const destroy = vi.fn();
            global.YT = {
                Player: vi.fn(function () {
                    return { destroy };
                }),
            };

            $exeDevice.loadPlayerYoutube();
            expect(destroy).not.toHaveBeenCalled();

            $exeDevice.$lifecycle.destroy();
            expect(destroy).toHaveBeenCalledTimes(1);
        });

        it('does not run YouTube player events after the edition closes', () => {
            let options = null;
            global.YT = {
                Player: vi.fn(function (id, opts) {
                    options = opts;
                    return { destroy: vi.fn() };
                }),
            };
            const clickPlay = vi.spyOn($exeDevice, 'clickPlay').mockImplementation(() => {});

            $exeDevice.loadPlayerYoutube();
            options.events.onReady();
            expect(clickPlay).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            options.events.onReady();
            expect(clickPlay).toHaveBeenCalledTimes(1);
        });

        it('drops the YouTube API callback when the edition closes', () => {
            document.body.insertAdjacentHTML('afterbegin', '<script data-test="yt"></script>');
            const youTubeReady = vi.spyOn($exeDevice, 'youTubeReady').mockImplementation(() => {});

            $exeDevice.loadYoutubeApi();
            const onApiReady = window.onYouTubeIframeAPIReady;
            expect(typeof onApiReady).toBe('function');

            onApiReady();
            expect(youTubeReady).toHaveBeenCalledTimes(1);

            $exeDevice.$lifecycle.destroy();
            expect(window.onYouTubeIframeAPIReady).toBe(null);
            onApiReady();
            expect(youTubeReady).toHaveBeenCalledTimes(1);
        });
    });
});

describe('map minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'map.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('map edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/map/edition/';
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
    const chooseMode = (value) => $(`input.MQE-TypeEvaluation[value="${value}"]`).prop('checked', true).trigger('click');
    let device;
    let previousApp;
    let tooltips;
    let previousHelpers;
    let previousMedia;
    let tinymceInit;

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
            sanitizeJSONString: (text) => text,
            hourToSeconds: () => 0,
            secondsToHour: () => '00:00:00',
            arrayMove: (list, from, to) => list.splice(to, 0, list.splice(from, 1)[0]),
        });
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = {
            getIDYoutube: () => false,
            getURLVideoMediaTeca: () => false,
            extractURLGD: (url) => url,
        };
        tinymceInit = vi.spyOn(global.tinymce, 'init').mockImplementation(() => Promise.resolve([]));
        document.body.innerHTML = '<div id="mapBody"></div>';
        device = global.loadIdevice(join(__dirname, 'map.js'));
        vi.spyOn(device, 'loadYoutubeApi').mockImplementation(() => {});
        device.init(document.getElementById('mapBody'), {}, PATH);
        // The form is wired once the editor of the point text is ready.
        const { setup } = tinymceInit.mock.calls.find(([config]) => config.setup)[0];
        let editorReady;
        setup({ on: (event, callback) => event === 'init' && (editorReady = callback) });
        editorReady();
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        for (const key of ['isJsonString', 'sanitizeJSONString', 'hourToSeconds', 'secondsToHour', 'arrayMove']) {
            if (key in previousHelpers) helpers()[key] = previousHelpers[key];
            else delete helpers()[key];
        }
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its points', () => {
        expect(tabNames()).toEqual(['instructions', 'options', 'contents', 'passwords', 'after', 'grading', 'texts']);
        expect(document.getElementById('gameQEIdeviceForm-tab-contents').textContent.trim()).toBe('Activities');
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab', () => {
        expect(panel('instructions').querySelector('#eXeGameInstructions').value).toBe(
            'Click on the active areas or image icons.'
        );
        expect(panel('options').querySelector('#mapaEOptions #mapaEEvaluationTest')).not.toBeNull();
        expect(panel('contents').querySelector('.MQE-FieldPanel > #mapaEPanel')).not.toBeNull();
        expect(panel('contents').querySelector('#mapaFQuestions')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit').value).toBe('Submit');
        expect(document.querySelectorAll('#eXeIdeviceTextAfter')).toHaveLength(1);
    });

    it('explains the Questions tab, keeps the accessibility warning, and offers no sharing', () => {
        const info = panel('contents').firstElementChild;

        expect(info.tagName).toBe('P');
        expect(info.textContent).toContain('Choose the image of the map, add its points');
        expect(document.querySelector('#gameQEIdeviceForm > .alert-warning').textContent).toContain(
            'This game may present accessibility problems'
        );
        expect(document.querySelectorAll('.exe-block-dismissible, #gameQEIdeviceForm fieldset')).toHaveLength(0);
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('provides one accessible information button in each options row', () => {
        const options = panel('options');
        const helpButtons = [...options.querySelectorAll('#mapaEOptions .exe-idevice-help')];
        const state = () => [...options.querySelectorAll('input')].map((input) => `${input.checked}${input.value}`);

        expect(helpButtons).toHaveLength(12);
        for (const help of helpButtons) {
            expect(help.type).toBe('button');
            expect(help.getAttribute('aria-label')).toBe(help.title);
            expect(document.getElementById(help.getAttribute('aria-controls')).textContent.length).toBeGreaterThan(30);
            const before = state();
            help.click();
            document.getElementById(help.getAttribute('aria-controls')).click();
            expect(state()).toEqual(before);
        }
    });

    it('shows the options of each assessment mode only', () => {
        chooseMode(4);
        expect(document.getElementById('mapaEvaluationData').style.display).not.toBe('none');
        expect(document.getElementById('mapaFQuestions').style.display).not.toBe('none');
        expect(document.getElementById('mapaSolutionOrderDiv').style.display).toBe('none');

        chooseMode(5);
        expect(document.getElementById('mapaSolutionOrderDiv').style.display).toBe('flex');
        expect(document.getElementById('mapaFQuestions').style.display).toBe('none');

        chooseMode(1);
        expect(document.getElementById('mapaNumOptionsData').style.display).toBe('flex');
        expect(document.getElementById('mapaEAutoShowDiv').style.display).toBe('none');

        chooseMode(0);
        expect(document.getElementById('mapaEAutoShowDiv').style.display).not.toBe('none');
        expect(document.getElementById('mapaNumOptionsData').style.display).toBe('none');
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBe(document.querySelectorAll('#gameQEIdeviceForm .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(12);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('#mapaEOptions .toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
        expect(document.querySelectorAll('#mapaEOptions [data-target]')).toHaveLength(0);
    });

    it('names the icon and the drawing buttons in the language of the edition', () => {
        expect(document.querySelector('.MQP-Dropdown').textContent).toContain('Icon:');
        expect(document.getElementById('mapaClearButton').textContent).toBe('Clear');
        expect(document.getElementById('mapaRedoButton').textContent).toBe('Redo');
        expect(document.getElementById('mapaUndoButton').textContent).toBe('Undo');
    });

    it('offers the sound option of a new map, which starts in the Visited points mode', () => {
        expect(document.getElementById('mapaEEvaluationPoints').checked).toBe(true);
        expect(document.getElementById('mapaEAutoAudioDiv').classList.contains('MQE-EHide')).toBe(false);
    });

    it('hides the whole solutions switch where the mode does not offer it', () => {
        const toggle = document.getElementById('mapaEShowSolution').closest('.toggle-item');

        chooseMode(1);
        expect(toggle.style.display).toBe('none');

        chooseMode(4);
        expect(toggle.style.display).not.toBe('none');
    });

    describe('questionnaire', () => {
        const question = (text) => ({ ...device.getDefaultQuestion(), quextion: text });

        beforeEach(() => {
            chooseMode(4);
            vi.spyOn(device, 'validateQuestion').mockReturnValue(true);
        });

        it('counts the questions as they are added', () => {
            device.addQuestion();

            expect(document.getElementById('mapaENumQuestions').textContent).toBe('2');
        });

        it('copies the question on screen', () => {
            device.selectsGame = [question('First'), question('Second')];
            device.qActive = 1;
            device.active = 0;

            device.copyQuestion();

            expect(device.qClipBoard.quextion).toBe('Second');
        });

        it('moves a cut question when it is pasted', () => {
            device.selectsGame = [question('A'), question('B'), question('C')];
            device.qActive = 0;
            device.cutQuestion();
            device.qActive = 2;

            expect(() => device.pasteQuestion()).not.toThrow();
            expect(device.selectsGame.map((item) => item.quextion)).toEqual(['B', 'C', 'A']);
        });

        it('counts a pasted copy in the questions per game', () => {
            device.selectsGame = [question('A'), question('B')];
            device.qActive = 0;
            device.updateNumberQuestions();

            device.copyQuestion();
            device.pasteQuestion();

            expect(device.selectsGame).toHaveLength(3);
            expect(document.getElementById('mapaNumberQuestions').textContent).toBe('3/3');
        });

        it('goes to the question whose number is typed', () => {
            device.selectsGame = [question('A'), question('B'), question('C')];
            device.qActive = 0;
            const input = $('#mapaENumberQuestionQ');

            input.val('2').trigger($.Event('keyup', { keyCode: 13 }));
            expect(device.qActive).toBe(1);
            expect($('#mapaEQuestion').val()).toBe('B');

            input.val('9').trigger($.Event('keyup', { keyCode: 13 }));
            expect(device.qActive).toBe(2);
            expect(input.val()).toBe('3');

            input.val('x').trigger($.Event('keyup', { keyCode: 13 }));
            expect(device.qActive).toBe(2);
            expect(input.val()).toBe('3');
        });
    });

    describe('pasting after changing what is on screen', () => {
        const complete = (text) => ({
            ...device.getDefaultQuestion(),
            quextion: text,
            options: ['Paris', 'Rome', 'Madrid', 'Berlin'],
            solution: 'A',
        });

        it('keeps the changes made to a question of the game questionnaire', () => {
            chooseMode(4);
            device.selectsGame = [complete('Capital of France?')];
            device.qActive = 0;
            device.showQuestion(0);
            device.copyQuestion();
            $('#mapaEQuestion').val('Capital of Spain?');

            device.pasteQuestion();

            expect(device.selectsGame.map((item) => item.quextion)).toEqual(['Capital of Spain?', 'Capital of France?']);
        });

        it('keeps the changes made to a question of a point questionnaire', () => {
            device.tests = [complete('Capital of France?')];
            device.activeTest = 0;
            device.showPointQuestion(0);
            device.copyPointQuestion();
            $('#mapaEQuestion1').val('Capital of Spain?');

            device.pastePointQuestion();

            expect(device.tests.map((item) => item.quextion)).toEqual(['Capital of Spain?', 'Capital of France?']);
        });

        it('keeps the changes made to a slide', () => {
            device.slides = [{ ...device.getDefaultSlide(), title: 'Paris', url: 'images/paris.jpg' }];
            device.activeSlide = 0;
            device.showSlide(0);
            device.copySlide();
            $('#mapaSTitle').val('Rome');

            device.pasteSlide();

            expect(device.slides.map((slide) => slide.title)).toEqual(['Rome', 'Paris']);
        });

        it('keeps the point on screen as its check returns it', () => {
            const points = device.activeMap.pts;
            device.activeMap.active = 0;
            device.typeEdit = 0;
            device.clipBoard = { ...points[0], title: 'Copied' };
            vi.spyOn(device, 'validatePoint').mockImplementation((point) => ({ ...point, title: 'Edited' }));

            device.pastePoint();

            expect(device.activeMap.pts.slice(0, 2).map((point) => point.title)).toEqual(['Edited', 'Copied']);
        });
    });

    it('goes to the question of the point questionnaire whose number is typed', () => {
        vi.spyOn(device, 'validatePointQuestion').mockReturnValue(true);
        device.tests = ['A', 'B', 'C'].map((text) => ({ ...device.getDefaultQuestion(), quextion: text }));
        device.activeTest = 0;
        const input = $('#mapaENumberQuestionQ1');

        input.val('3').trigger($.Event('keyup', { keyCode: 13 }));
        expect(device.activeTest).toBe(2);
        expect($('#mapaEQuestion1').val()).toBe('C');

        input.val('0').trigger($.Event('keyup', { keyCode: 13 }));
        expect(device.activeTest).toBe(2);
        expect(input.val()).toBe('3');
    });
});

/**
 * Unit tests for the Drag and drop iDevice edition.
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handlers whose callback is a single guarded call: [selector, event, method]
const guardedEditionHandlers = [
    ['#dadEAddC', 'click', 'addCard'],
    ['#dadEDeleteC', 'click', 'removeCard'],
    ['#dadECopyC', 'click', 'copyCard'],
    ['#dadECutC', 'click', 'cutCard'],
    ['#dadEPasteC', 'click', 'pasteCard'],
    ['#dadEFirstC', 'click', 'firstCard'],
    ['#dadEPreviousC', 'click', 'previousCard'],
    ['#dadENextC', 'click', 'nextCard'],
    ['#dadELastC', 'click', 'lastCard'],
    ['#dadEPercentajeCards', 'keyup', 'updateCardsNumber'],
    ['#dadEPercentajeCards', 'click', 'updateCardsNumber'],
    ['#dadEPercentajeCards', 'focusout', 'updateCardsNumber'],
    ['#dadEURLImage', 'change', 'loadImage'],
    ['#dadEPlayImage', 'click', 'loadImage'],
    ['#dadEURLAudio', 'change', 'loadAudio'],
    ['#dadEPlayAudio', 'click', 'loadAudio'],
];

function buildEditionForm() {
    document.body.innerHTML = `
        <div id="dragdropQIdeviceForm">
            <a href="#" id="dadEAddC"></a>
            <a href="#" id="dadEDeleteC"></a>
            <a href="#" id="dadECopyC"></a>
            <a href="#" id="dadECutC"></a>
            <a href="#" id="dadEPasteC"></a>
            <a href="#" id="dadEFirstC"></a>
            <a href="#" id="dadEPreviousC"></a>
            <a href="#" id="dadENextC"></a>
            <a href="#" id="dadELastC"></a>
            <input id="dadEPercentajeCards" type="text" value="50" />
            <input id="dadEURLImage" type="text" value="picture.png" />
            <a href="#" id="dadEPlayImage"></a>
            <input id="dadEURLAudio" type="text" value="sound.mp3" />
            <a href="#" id="dadEPlayAudio"></a>
            <img id="dadEImage" alt="" />
            <input id="dadENumberCard" type="text" value="2" />
            <span class="toggle-item">
                <input class="toggle-input" type="checkbox" data-target="#dadEToggleTarget" />
            </span>
            <div id="dadEToggleTarget"></div>
        </div>`;
}

describe('dragdrop edition: $exeDevice guards (#2271)', () => {
    let $exeDevice;
    let previousItinerary;

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildEditionForm();
        // The itinerary block has its own tests; here it is a stand-in, and
        // afterEach puts the real one back.
        previousItinerary = global.$exeIDevicesEdition.iDevice.gamification.itinerary;
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = {
            getContents: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(join(__dirname, 'dragdrop.js'));
        $exeDevice.addEvents();
    });

    afterEach(() => {
        // Close the edition as the workarea does, so handlers this test bound
        // on shared targets such as `document` cannot reach the next one.
        $exeDevice.$lifecycle.destroy();
        global.$exeIDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    describe('after the editor cleared the global $exeDevice', () => {
        beforeEach(() => {
            global.$exeDevice = undefined;
        });

        it.each(guardedEditionHandlers)(
            'does not throw on %s %s',
            (selector, event) => {
                expect(() => $(selector).trigger(event)).not.toThrow();
            }
        );

        it('does not throw on card number Enter keyup', () => {
            expect(() =>
                $('#dadENumberCard').trigger($.Event('keyup', { keyCode: 13 }))
            ).not.toThrow();
        });

        it('does not throw when a card image finishes loading late', () => {
            global.$exeDevice = $exeDevice;
            $exeDevice.showImage();
            global.$exeDevice = undefined;
            const img = document.getElementById('dadEImage');
            Object.defineProperty(img, 'complete', { value: true });
            Object.defineProperty(img, 'naturalWidth', { value: 100 });
            Object.defineProperty(img, 'naturalHeight', { value: 50 });
            expect(() => $(img).trigger('load')).not.toThrow();
        });
    });

    describe('with $exeDevice still active', () => {
        it.each(guardedEditionHandlers)(
            '%s %s still calls %s',
            (selector, event, method) => {
                const spy = vi
                    .spyOn($exeDevice, method)
                    .mockImplementation(() => {});
                $(selector).trigger(event);
                expect(spy).toHaveBeenCalled();
            }
        );

        it('card number Enter keyup still shows the requested card', () => {
            $exeDevice.cardsGame = [{}, {}, {}];
            vi.spyOn($exeDevice, 'validateCard').mockReturnValue(true);
            const showCard = vi
                .spyOn($exeDevice, 'showCard')
                .mockImplementation(() => {});
            $('#dadENumberCard').trigger($.Event('keyup', { keyCode: 13 }));
            expect(showCard).toHaveBeenCalledWith(1);
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
            source = readFileSync(join(__dirname, 'dragdrop.js'), 'utf-8');
        });

        it('delegates the evaluation controls to the shared tab', () => {
            // The pass score and the progress report used to be rendered here,
            // loose in the general options. They now live in the Grading tab,
            // so rendering them again would show each control twice.
            expect(source).not.toContain('passScore.getContents(');
            expect(source).not.toContain('progressBar.getContents(');
            expect(source).toMatch(/tabs\.getHtml\([\s\S]*grading:\s*true/);
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
        it('releases the toggle handler delegated on document', () => {
            const target = document.getElementById('dadEToggleTarget');
            const input = document.querySelector('.toggle-input');
            const unrelated = vi.fn();
            $(document).on('change.dragdropUnrelated', '.toggle-input', unrelated);

            try {
                input.checked = true;
                $(input).trigger('change');
                expect(target.style.display).toBe('flex');
                expect(unrelated).toHaveBeenCalledTimes(1);

                $exeDevice.$lifecycle.destroy();
                input.checked = false;
                $(input).trigger('change');

                expect(target.style.display).toBe('flex');
                expect(unrelated).toHaveBeenCalledTimes(2);
            } finally {
                $(document).off('change.dragdropUnrelated');
            }
        });

        it('stops the preview audio when the edition closes', () => {
            const audio = {
                play: vi.fn(),
                pause: vi.fn(),
                load: vi.fn(),
                removeAttribute: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            };
            const audioSpy = vi.spyOn(global, 'Audio').mockImplementation(function () {
                return audio;
            });
            global.$exeDevices.iDevice.gamification.media = {
                ...global.$exeDevices.iDevice.gamification.media,
                extractURLGD: vi.fn(url => url),
            };

            try {
                $exeDevice.playSound('sound.mp3');
                const [type, handler] = audio.addEventListener.mock.calls[0];
                expect(type).toBe('canplaythrough');

                handler();
                expect(audio.play).toHaveBeenCalledTimes(1);

                $exeDevice.$lifecycle.destroy();
                expect(audio.pause).toHaveBeenCalledTimes(1);
                expect(audio.removeAttribute).toHaveBeenCalledWith('src');

                handler();
                expect(audio.play).toHaveBeenCalledTimes(1);
            } finally {
                audioSpy.mockRestore();
            }
        });
    });
});

describe('dragdrop minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'dragdrop.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('dragdrop edition: shared form tabs, options tooltips, and saving', () => {
    const PATH = 'files/perm/idevices/base/dragdrop/edition/';
    const jq = window.jQuery;
    let savedGlobals;
    let device;
    let previousApp;
    let tooltips;

    function panel(tab) {
        return document.getElementById(`dragdropQIdeviceForm-panel-${tab}`);
    }

    function tabNames() {
        return [...document.querySelectorAll('#dragdropQIdeviceForm-tabs [data-exe-tab]')].map(
            (tab) => tab.getAttribute('data-exe-tab')
        );
    }

    beforeEach(() => {
        savedGlobals = {
            $: global.$,
            jQuery: global.jQuery,
            exeDevices: global.$exeDevices,
        };
        global.$ = jq;
        global.jQuery = jq;
        global.$exeDevices = {
            ...global.$exeDevices,
            iDevice: {
                ...global.$exeDevices?.iDevice,
                gamification: {
                    ...global.$exeDevices?.iDevice?.gamification,
                    helpers: {
                        ...global.$exeDevices?.iDevice?.gamification?.helpers,
                        encrypt: (t) => t,
                        decrypt: (t) => t,
                        isJsonString: (t) => {
                            try {
                                return JSON.parse(t);
                            } catch {
                                return false;
                            }
                        },
                    },
                    media: {
                        extractURLGD: (url) => url,
                    },
                },
            },
        };
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
                            tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                        });
                    }),
                },
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });

        device = global.loadIdevice(join(__dirname, 'dragdrop.js'));
        document.body.innerHTML = '<div id="dragdropBody"></div>';
        device.init(document.getElementById('dragdropBody'), {}, PATH);
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        document.body.innerHTML = '';
        global.$ = savedGlobals.$;
        global.jQuery = savedGlobals.jQuery;
        global.$exeDevices = savedGlobals.exeDevices;
        if (global.eXeLearning) {
            global.eXeLearning.app = previousApp;
        }
        vi.unstubAllGlobals();
    });

    it('leaves the state of each switch to its native checkbox', () => {
        document.querySelectorAll('.toggle-input:not(:disabled)').forEach((input) => input.click());

        expect(document.querySelectorAll('[role="switch"], [aria-checked]')).toHaveLength(0);
    });

    it('organises the edition form into shared WAI-ARIA tabs', () => {
        expect(tabNames()).toEqual([
            'instructions',
            'options',
            'contents',
            'passwords',
            'after',
            'grading',
            'texts',
        ]);

        expect(panel('instructions').querySelector('#eXeGameInstructions')).not.toBeNull();
        expect(panel('options').querySelector('#dragdropEOptions')).not.toBeNull();
        expect(panel('contents').querySelector('#dadEPanel')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowClue')).not.toBeNull();
        expect(panel('after').querySelector('#eXeIdeviceTextAfter')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgSubmit')).not.toBeNull();
    });

    it('starts a new card without the alternative text of the previous one', () => {
        vi.spyOn(device, 'validateCard').mockReturnValue(true);
        document.getElementById('dadEAlt').value = 'A red apple';

        device.addCard();

        expect(document.getElementById('dadEAlt').value).toBe('');
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
        expect(document.getElementById('eXeGameImportGame')).toBeNull();
        expect(document.getElementById('eXeEQuestionsArea')).toBeNull();
    });

    it('provides accessible help tooltips for option rows', () => {
        const optionHelps = [...panel('options').querySelectorAll('#dragdropEOptions .exe-idevice-help')];
        expect(optionHelps.length).toBe(5);

        for (const help of optionHelps) {
            expect(help.tagName).toBe('BUTTON');
            expect(help.type).toBe('button');
            expect(help.title).toBe('Information');
            const targetId = help.getAttribute('aria-controls');
            expect(targetId).toBeTruthy();
            expect(document.getElementById(targetId)?.textContent.length).toBeGreaterThan(10);
        }
    });

    it('does not toggle switches when clicking help icons inside toggle-items', () => {
        const minimizeInput = document.getElementById('dadEShowMinimize');
        const minimizeHelp = minimizeInput.closest('div').querySelector('.exe-idevice-help');
        expect(minimizeHelp).not.toBeNull();
        expect(minimizeInput.checked).toBe(false);
        minimizeHelp.click();
        expect(minimizeInput.checked).toBe(false);
    });

    it('disposes all option tooltips when the edition closes', () => {
        expect(tooltips.size).toBeGreaterThanOrEqual(5);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('switches tabs when one is clicked', () => {
        document.getElementById('dragdropQIdeviceForm-tab-options').click();

        expect(panel('options').classList.contains('active')).toBe(true);
        expect(panel('instructions').classList.contains('active')).toBe(false);
    });

    it('restores form values and updates gamification modules on updateFieldGame', () => {
        device.updateFieldGame({
            showMinimize: true,
            percentajeCards: 80,
            author: 'Test Author',
            showSolution: true,
            timeShowSolution: 5,
            time: 25,
            type: 2,
            typeDrag: 1,
            itinerary: {},
            evaluation: true,
            evaluationID: 'eval-drag-1',
            passScoreMode: 1,
            passScoreCustom: 7,
            isScorm: 1,
            textButtonScorm: 'Submit',
            repeatActivity: true,
            weighted: 50,
            cardsGame: [{ eText: 'card1', definition: 'def1' }],
        });

        expect(document.getElementById('dadEShowMinimize').checked).toBe(true);
        expect(document.getElementById('dadEPercentajeCards').value).toBe('80');
        expect(document.getElementById('dadEAuthory').value).toBe('Test Author');
        expect(document.getElementById('dadEShowSolution').checked).toBe(true);
        expect(document.getElementById('dadETimeShowSolution').value).toBe('5');
        expect(document.getElementById('dadETime').value).toBe('25');
        expect(document.getElementById('dadEDragDefintion').checked).toBe(true);
        expect(document.getElementById('dadETypeIdentify').checked).toBe(true);
        expect(document.getElementById('dadETimeDiv').classList.contains('d-flex')).toBe(true);
    });

    describe('saving and validation', () => {
        let editors;
        let tinymceGet;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Drag each item</p>',
                eXeIdeviceTextAfter: '<p>Extra dragdrop info</p>',
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
        });

        afterEach(() => {
            tinymceGet.mockRestore();
        });

        it('saves valid data and outputs expected HTML structure', () => {
            device.updateFieldGame({
                showMinimize: true,
                percentajeCards: 100,
                author: 'Author Name',
                showSolution: true,
                timeShowSolution: 3,
                time: 0,
                type: 0,
                typeDrag: 0,
                itinerary: {},
                evaluation: false,
                evaluationID: '',
                passScoreMode: 0,
                passScoreCustom: 5,
                isScorm: 0,
                textButtonScorm: '',
                repeatActivity: false,
                weighted: 100,
                cardsGame: [
                    {
                        definition: 'target definition',
                        url: '',
                        author: '',
                        alt: '',
                        audio: '',
                    },
                ],
            });
            $('#dadEDefinition').val('target definition');

            const data = device.validateData();
            expect(data).not.toBe(false);
            expect(data.showMinimize).toBe(true);
            expect(data.instructions).toBe('<p>Drag each item</p>');
            expect(unescape(data.textAfter)).toBe('<p>Extra dragdrop info</p>');

            const savedHtml = device.save();
            expect(savedHtml).toContain('dragdrop-IDevice');
            expect(savedHtml).toContain('dragdrop-instructions');
            expect(savedHtml).toContain('dragdrop-DataGame');
            expect(savedHtml).toContain('dragdrop-extra-content');
        });
    });
});

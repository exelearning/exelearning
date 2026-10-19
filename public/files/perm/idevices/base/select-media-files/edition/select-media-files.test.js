/**
 * Unit tests for select-media-files iDevice
 *
 * Tests cover:
 * - hexToRgba: Color conversion utility
 * - escapeHtml: HTML character escaping
 * - removeTags: HTML tag stripping
 * - getCardDefault / getPhraseDefault: Default data structures
 * - validateCard: Card validation logic
 * - addPickerButton: The fixed file-picker flow (issue #1449)
 *   - Must use filemanager modal (NOT native <input type="file">)
 *   - Must infer correct accept filter from input ID / class
 *   - Must not add duplicate buttons (.initialized guard)
 *   - onSelect must write assetUrl + blobUrl and trigger 'change'
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('select-media-files iDevice', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(
            join(__dirname, 'select-media-files.js')
        );
    });

    // -------------------------------------------------------------------------
    // hexToRgba
    // -------------------------------------------------------------------------
    describe('hexToRgba', () => {
        it('converts a 6-digit hex color to rgba with given alpha', () => {
            expect($exeDevice.hexToRgba('#ff0000', 1)).toBe('rgba(255,0,0,1)');
        });

        it('converts a 6-digit hex with fractional alpha', () => {
            const result = $exeDevice.hexToRgba('#000000', 0.7);
            expect(result).toBe('rgba(0,0,0,0.7)');
        });

        it('converts a 3-digit hex color', () => {
            const result = $exeDevice.hexToRgba('#f00', 1);
            expect(result).toBe('rgba(255,0,0,1)');
        });

        it('handles hex without leading hash', () => {
            const result = $exeDevice.hexToRgba('00ff00', 1);
            expect(result).toBe('rgba(0,255,0,1)');
        });

        it('returns white rgba for empty string', () => {
            expect($exeDevice.hexToRgba('', 1)).toBe('rgba(255,255,255,1)');
        });

        it('returns white rgba for null', () => {
            expect($exeDevice.hexToRgba(null, 1)).toBe('rgba(255,255,255,1)');
        });

        it('returns white rgba for undefined', () => {
            expect($exeDevice.hexToRgba(undefined, 1)).toBe(
                'rgba(255,255,255,1)'
            );
        });

        it('returns rgba with NaN components for invalid hex value (no exception thrown)', () => {
            // #zzzzzz starts with '#' so the validation branch is skipped;
            // parseInt('zz', 16) = NaN — the function does not throw, it returns NaN components.
            const result = $exeDevice.hexToRgba('#zzzzzz', 1);
            expect(result).toBe('rgba(NaN,NaN,NaN,1)');
        });

        it('uses alpha = 1 when opacity is not finite', () => {
            const result = $exeDevice.hexToRgba('#ffffff', NaN);
            expect(result).toBe('rgba(255,255,255,1)');
        });
    });

    // -------------------------------------------------------------------------
    // escapeHtml
    // -------------------------------------------------------------------------
    describe('escapeHtml', () => {
        it('escapes ampersand', () => {
            expect($exeDevice.escapeHtml('a & b')).toBe('a &amp; b');
        });

        it('escapes less-than sign', () => {
            expect($exeDevice.escapeHtml('a < b')).toBe('a &lt; b');
        });

        it('escapes greater-than sign', () => {
            expect($exeDevice.escapeHtml('a > b')).toBe('a &gt; b');
        });

        it('escapes double quotes', () => {
            expect($exeDevice.escapeHtml('say "hi"')).toBe(
                'say &quot;hi&quot;'
            );
        });

        it('escapes single quotes', () => {
            expect($exeDevice.escapeHtml("it's")).toBe("it&#39;s");
        });

        it('escapes a full XSS payload', () => {
            const input = '<script>alert("xss")</script>';
            const expected =
                '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
            expect($exeDevice.escapeHtml(input)).toBe(expected);
        });

        it('returns empty string for empty input', () => {
            expect($exeDevice.escapeHtml('')).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // removeTags
    // -------------------------------------------------------------------------
    describe('removeTags', () => {
        it('strips simple HTML tags', () => {
            expect($exeDevice.removeTags('<p>Hello</p>')).toBe('Hello');
        });

        it('strips nested tags', () => {
            expect(
                $exeDevice.removeTags('<div><strong>Text</strong></div>')
            ).toBe('Text');
        });

        it('returns plain text unchanged', () => {
            expect($exeDevice.removeTags('plain text')).toBe('plain text');
        });

        it('returns empty string for empty input', () => {
            expect($exeDevice.removeTags('')).toBe('');
        });
    });

    // -------------------------------------------------------------------------
    // getCardDefault
    // -------------------------------------------------------------------------
    describe('getCardDefault', () => {
        it('returns an object with id as empty string', () => {
            expect($exeDevice.getCardDefault().id).toBe('');
        });

        it('returns type 2', () => {
            expect($exeDevice.getCardDefault().type).toBe(2);
        });

        it('returns empty url, audio, author, alt, eText', () => {
            const c = $exeDevice.getCardDefault();
            expect(c.url).toBe('');
            expect(c.audio).toBe('');
            expect(c.author).toBe('');
            expect(c.alt).toBe('');
            expect(c.eText).toBe('');
        });

        it('returns default color values', () => {
            const c = $exeDevice.getCardDefault();
            expect(c.color).toBe('#000000');
            expect(c.backcolor).toBe('#ffffff');
        });

        it('returns state as false', () => {
            expect($exeDevice.getCardDefault().state).toBe(false);
        });

        it('returns a new object each call', () => {
            expect($exeDevice.getCardDefault()).not.toBe(
                $exeDevice.getCardDefault()
            );
        });
    });

    // -------------------------------------------------------------------------
    // getPhraseDefault
    // -------------------------------------------------------------------------
    describe('getPhraseDefault', () => {
        it('returns an empty cards array', () => {
            const p = $exeDevice.getPhraseDefault();
            expect(Array.isArray(p.cards)).toBe(true);
            expect(p.cards.length).toBe(0);
        });

        it('returns empty string fields', () => {
            const p = $exeDevice.getPhraseDefault();
            expect(p.msgError).toBe('');
            expect(p.msgHit).toBe('');
            expect(p.definition).toBe('');
            expect(p.audioDefinition).toBe('');
            expect(p.audioHit).toBe('');
            expect(p.audioError).toBe('');
            expect(p.url).toBe('');
            expect(p.alt).toBe('');
            expect(p.author).toBe('');
        });

        it('returns a new object each call', () => {
            expect($exeDevice.getPhraseDefault()).not.toBe(
                $exeDevice.getPhraseDefault()
            );
        });
    });

    // -------------------------------------------------------------------------
    // validateCard
    // -------------------------------------------------------------------------
    describe('validateCard', () => {
        beforeEach(() => {
            // showMessage delegates to eXe.app.alert; mock it so it doesn't throw
            $exeDevice.showMessage = vi.fn();
        });

        it('returns true (invalid) when card has no url, no audio, no text', () => {
            const card = { url: '', audio: '', eText: '' };
            expect($exeDevice.validateCard(card)).toBe(true);
        });

        it('returns false (valid) when card has an image url', () => {
            const card = {
                url: 'files/assets/image.jpg',
                audio: '',
                eText: '',
            };
            expect($exeDevice.validateCard(card)).toBe(false);
        });

        it('returns false (valid) when card has audio', () => {
            const card = { url: '', audio: 'files/assets/audio.mp3', eText: '' };
            expect($exeDevice.validateCard(card)).toBe(false);
        });

        it('returns false (valid) when card has text', () => {
            const card = { url: '', audio: '', eText: 'Some text' };
            expect($exeDevice.validateCard(card)).toBe(false);
        });

        it('calls showMessage when card is invalid', () => {
            const card = { url: '', audio: '', eText: '' };
            $exeDevice.validateCard(card);
            expect($exeDevice.showMessage).toHaveBeenCalledOnce();
        });

        it('does not call showMessage when card is valid', () => {
            const card = { url: 'files/image.jpg', audio: '', eText: '' };
            $exeDevice.validateCard(card);
            expect($exeDevice.showMessage).not.toHaveBeenCalled();
        });

        it('treats url shorter than 5 chars as absent', () => {
            // e.g. url = 'a' → length < 5 → treated as no url
            const card = { url: 'a', audio: '', eText: '' };
            expect($exeDevice.validateCard(card)).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // addPickerButton — the core fix for issue #1449
    // -------------------------------------------------------------------------
    describe('addPickerButton', () => {
        let filemanagerShowMock;
        let cardId;
        let container;

        /**
         * Creates a card container in the DOM with the given inputs,
         * sets up the filemanager mock, and returns the container element.
         */
        function createCardContainer(inputs) {
            container = document.createElement('div');
            container.id = `slcmEDatosCarta-${cardId}`;

            inputs.forEach(({ id, classes }) => {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = id;
                input.className = classes || 'exe-file-picker';
                container.appendChild(input);
            });

            document.body.appendChild(container);
            return container;
        }

        beforeEach(() => {
            cardId = 'testcard123';
            filemanagerShowMock = vi.fn();

            // Inject filemanager mock into eXeLearning.app.modals
            window.eXeLearning = {
                ...window.eXeLearning,
                app: {
                    modals: {
                        filemanager: {
                            show: filemanagerShowMock,
                        },
                    },
                },
            };
        });

        afterEach(() => {
            // Clean up DOM
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
            container = null;
            // Remove filemanager mock
            if (window.eXeLearning?.app) {
                delete window.eXeLearning.app;
            }
        });

        it('does NOT create any <input type="file"> (no native file dialog)', () => {
            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const nativeInputs = container.querySelectorAll('input[type="file"]');
            expect(nativeInputs.length).toBe(0);
        });

        it('creates a button element for each file-picker input', () => {
            createCardContainer([
                { id: `slcmEURLImage-${cardId}` },
                { id: `slcmEURLAudio-${cardId}` },
            ]);
            $exeDevice.addPickerButton(cardId);

            const buttons = container.querySelectorAll('input[type="button"]');
            expect(buttons.length).toBe(2);
        });

        it('marks inputs as initialized to prevent duplicate buttons', () => {
            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);
            $exeDevice.addPickerButton(cardId); // second call must be idempotent

            const buttons = container.querySelectorAll('input[type="button"]');
            expect(buttons.length).toBe(1);
        });

        it('adds the .initialized class to processed inputs', () => {
            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const input = container.querySelector(`#slcmEURLImage-${cardId}`);
            expect(input.classList.contains('initialized')).toBe(true);
        });

        it('calls filemanager.show() with accept="image" for image inputs (id contains urlimage)', () => {
            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            btn.click();

            expect(filemanagerShowMock).toHaveBeenCalledOnce();
            expect(filemanagerShowMock.mock.calls[0][0].accept).toBe('image');
        });

        it('calls filemanager.show() with accept="audio" for audio inputs (id contains audio)', () => {
            createCardContainer([{ id: `slcmEURLAudio-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            btn.click();

            expect(filemanagerShowMock).toHaveBeenCalledOnce();
            expect(filemanagerShowMock.mock.calls[0][0].accept).toBe('audio');
        });

        it('calls filemanager.show() with accept=null for generic file inputs', () => {
            createCardContainer([{ id: `slcmEURLFile-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            btn.click();

            expect(filemanagerShowMock).toHaveBeenCalledOnce();
            expect(filemanagerShowMock.mock.calls[0][0].accept).toBeNull();
        });

        it('calls filemanager.show() with accept="image" for exe-image-picker class', () => {
            createCardContainer([
                {
                    id: `slcmECustomImage-${cardId}`,
                    classes: 'exe-image-picker',
                },
            ]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            btn.click();

            expect(filemanagerShowMock.mock.calls[0][0].accept).toBe('image');
        });

        it('assigns exe-pick-image CSS class to button for image inputs', () => {
            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            expect(btn.classList.contains('exe-pick-image')).toBe(true);
        });

        it('assigns exe-pick-any-file CSS class to button for audio inputs', () => {
            createCardContainer([{ id: `slcmEURLAudio-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            expect(btn.classList.contains('exe-pick-any-file')).toBe(true);
        });

        it('onSelect callback writes assetUrl to the input value', () => {
            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            btn.click();

            // Simulate filemanager calling onSelect
            const onSelect = filemanagerShowMock.mock.calls[0][0].onSelect;
            onSelect({ assetUrl: 'asset://test-uuid/image.jpg', blobUrl: 'blob:http://localhost/1234' });

            const input = container.querySelector(`#slcmEURLImage-${cardId}`);
            expect(input.value).toBe('asset://test-uuid/image.jpg');
        });

        it('onSelect callback writes blobUrl to dataset.blobUrl', () => {
            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            btn.click();

            const onSelect = filemanagerShowMock.mock.calls[0][0].onSelect;
            onSelect({ assetUrl: 'asset://test-uuid/img.jpg', blobUrl: 'blob:http://localhost/5678' });

            const input = container.querySelector(`#slcmEURLImage-${cardId}`);
            expect(input.dataset.blobUrl).toBe('blob:http://localhost/5678');
        });

        it('onSelect callback triggers a change event on the input', () => {
            createCardContainer([{ id: `slcmEURLAudio-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const input = container.querySelector(`#slcmEURLAudio-${cardId}`);
            const changeHandler = vi.fn();
            // Use jQuery's .on() because addPickerButton uses $input.trigger('change'),
            // which dispatches a jQuery synthetic event that happy-dom native listeners may not catch.
            $(input).on('change', changeHandler);

            const btn = container.querySelector('input[type="button"]');
            btn.click();

            const onSelect = filemanagerShowMock.mock.calls[0][0].onSelect;
            onSelect({ assetUrl: 'asset://test/audio.mp3', blobUrl: 'blob:http://localhost/9999' });

            expect(changeHandler).toHaveBeenCalledOnce();
        });

        it('does nothing when the container does not exist in the DOM', () => {
            // No DOM setup — must not throw
            expect(() => $exeDevice.addPickerButton('nonexistent')).not.toThrow();
            expect(filemanagerShowMock).not.toHaveBeenCalled();
        });

        it('does nothing when filemanager is not available', () => {
            // Remove filemanager from global
            delete window.eXeLearning.app;

            createCardContainer([{ id: `slcmEURLImage-${cardId}` }]);
            $exeDevice.addPickerButton(cardId);

            const btn = container.querySelector('input[type="button"]');
            // Must not throw when clicking without filemanager
            expect(() => btn.click()).not.toThrow();
        });
    });

    // -------------------------------------------------------------------------
    // placeImageWindows
    // -------------------------------------------------------------------------
    describe('placeImageWindows', () => {
        // happy-dom does not compute CSS layout so jQuery .width()/.height() return 0
        // and the function falls back to wDiv=1/hDiv=1. Tests verify shape and
        // the dimension-calculation branches via direct object structure assertions.

        function createImageInContainer() {
            const parent = document.createElement('div');
            const img = document.createElement('img');
            parent.appendChild(img);
            document.body.appendChild(parent);
            return { img, cleanup: () => parent.remove() };
        }

        it('returns an object with w, h, x, y properties', () => {
            const { img, cleanup } = createImageInContainer();
            const result = $exeDevice.placeImageWindows(img, 400, 300);
            expect(result).toHaveProperty('w');
            expect(result).toHaveProperty('h');
            expect(result).toHaveProperty('x');
            expect(result).toHaveProperty('y');
            cleanup();
        });

        it('returns numeric values for all dimension properties', () => {
            const { img, cleanup } = createImageInContainer();
            const result = $exeDevice.placeImageWindows(img, 400, 300);
            expect(typeof result.w).toBe('number');
            expect(typeof result.h).toBe('number');
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
            cleanup();
        });

        it('returns a new object each call', () => {
            const { img, cleanup } = createImageInContainer();
            const r1 = $exeDevice.placeImageWindows(img, 400, 300);
            const r2 = $exeDevice.placeImageWindows(img, 400, 300);
            expect(r1).not.toBe(r2);
            cleanup();
        });
    });

    // -------------------------------------------------------------------------
    // Structure checks
    // -------------------------------------------------------------------------
    describe('structure', () => {
        it('exports validated data through the edition share helper', () => {
            const dataGame = { phrasesGame: [] };
            const exportGame = vi.fn();

            document.body.innerHTML = `
                <div id="eXeGameExportImport">
                    <input id="eXeGameImportGame" type="file" />
                    <button id="eXeGameExportQuestions" type="button"></button>
                </div>
            `;
            const gamification = global.$exeIDevicesEdition.iDevice.gamification;
            const saved = { ...gamification };
            gamification.share = { exportGame };
            gamification.itinerary = { addEvents: vi.fn() };
            vi.spyOn($exeDevice, 'validateData').mockReturnValue(dataGame);

            $exeDevice.addEvents();
            $('#eXeGameExportQuestions').trigger('click');
            Object.assign(gamification, saved);

            expect(exportGame).toHaveBeenCalledWith(
                dataGame,
                'gameQEIdeviceForm',
                'Select media files'
            );
        });

        it('exposes i18n with name and category', () => {
            expect($exeDevice.i18n).toBeDefined();
            expect($exeDevice.i18n.name).toBeDefined();
            expect($exeDevice.i18n.category).toBeDefined();
        });

        it('exposes phrasesGame as an empty array', () => {
            expect(Array.isArray($exeDevice.phrasesGame)).toBe(true);
        });

        it('exposes version as a number', () => {
            expect(typeof $exeDevice.version).toBe('number');
        });

        it('exposes required methods', () => {
            const methods = [
                'init', 'save', 'addPickerButton', 'addCard',
                'validateCard', 'validatePhrase', 'validateData',
                'showMessage', 'hexToRgba', 'escapeHtml',
                'getCardDefault', 'getPhraseDefault',
            ];
            methods.forEach((m) => {
                expect(typeof $exeDevice[m], `${m} should be a function`).toBe('function');
            });
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
            source = readFileSync(join(__dirname, 'select-media-files.js'), 'utf-8');
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

    // -------------------------------------------------------------------------
    // Edition lifecycle teardown
    // -------------------------------------------------------------------------
    /**
     * The editor previews audio with `new Audio()` and imports games with a
     * FileReader. Both used to survive the form: the sound kept playing after
     * the editor closed, and a late `onload` resolved `$exeDevice` from the
     * global — by then a different iDevice.
     */
    describe('edition lifecycle teardown', () => {
        /** Audio double: the platform element does nothing useful under happy-dom. */
        class FakeAudio {
            constructor(src) {
                FakeAudio.instances.push(this);
                this.src = src;
                this.pause = vi.fn();
                this.load = vi.fn();
                this.removeAttribute = vi.fn(() => {
                    this.src = '';
                });
                this.play = vi.fn(() => Promise.resolve());
            }
        }

        /** FileReader double that only fires when a test says so. */
        class FakeFileReader {
            constructor() {
                FakeFileReader.instances.push(this);
                this.readyState = 0;
                this.onload = null;
                this.abort = vi.fn(() => {
                    this.readyState = 2;
                });
            }

            readAsText() {
                this.readyState = 1;
            }

            fire(result) {
                this.readyState = 2;
                if (this.onload) this.onload({ target: { result } });
            }
        }

        let originalAudio;
        let originalFileReader;
        let originalMedia;
        let originalItinerary;

        beforeEach(() => {
            FakeAudio.instances = [];
            FakeFileReader.instances = [];

            originalAudio = global.Audio;
            originalFileReader = global.FileReader;
            originalMedia = $exeDevices.iDevice.gamification.media;
            originalItinerary = $exeIDevicesEdition.iDevice.gamification.itinerary;

            global.Audio = FakeAudio;
            window.Audio = FakeAudio;
            global.FileReader = FakeFileReader;
            window.FileReader = FakeFileReader;
            $exeDevices.iDevice.gamification.media = { extractURLGD: u => u };
            $exeIDevicesEdition.iDevice.gamification.itinerary = { addEvents: vi.fn() };
        });

        afterEach(() => {
            global.Audio = originalAudio;
            window.Audio = originalAudio;
            global.FileReader = originalFileReader;
            window.FileReader = originalFileReader;
            $exeDevices.iDevice.gamification.media = originalMedia;
            $exeIDevicesEdition.iDevice.gamification.itinerary = originalItinerary;
        });

        it('stops the audio preview when the edition closes', () => {
            $exeDevice.playSound('song.mp3');
            const audio = FakeAudio.instances[0];
            expect(audio.play).toHaveBeenCalled();
            expect(audio.pause).not.toHaveBeenCalled();

            $exeDevice.$lifecycle.destroy();

            expect(audio.pause).toHaveBeenCalledTimes(1);
            expect(audio.removeAttribute).toHaveBeenCalledWith('src');
            expect(audio.load).toHaveBeenCalledTimes(1);
        });

        it('stops every audio preview the edition created', () => {
            $exeDevice.playSound('one.mp3');
            $exeDevice.playSound('two.mp3');

            $exeDevice.$lifecycle.destroy();

            expect(FakeAudio.instances).toHaveLength(2);
            FakeAudio.instances.forEach(audio => {
                expect(audio.pause).toHaveBeenCalledTimes(1);
            });
        });

        describe('game import', () => {
            const selectFile = () => {
                const input = document.getElementById('eXeGameImportGame');
                Object.defineProperty(input, 'files', {
                    value: [{ name: 'game.json', type: 'application/json' }],
                    configurable: true,
                });
                $(input).trigger('change');
            };

            beforeEach(() => {
                ['eXeGameImportGame', 'eXeGameExportQuestions', 'eXeGameExportImport'].forEach(id => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.id = id;
                    document.body.appendChild(input);
                });
                $exeDevice.phrasesGame = [];
                $exeDevice.addEvents();
            });

            it('imports the game while the edition is open', () => {
                const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

                selectFile();
                FakeFileReader.instances[0].fire('{"x":1}');

                expect(importGame).toHaveBeenCalledWith('{"x":1}');
                importGame.mockRestore();
            });

            it('aborts an in-flight read when the edition closes', () => {
                selectFile();
                const reader = FakeFileReader.instances[0];
                expect(reader.readyState).toBe(1);

                $exeDevice.$lifecycle.destroy();

                expect(reader.abort).toHaveBeenCalledTimes(1);
            });

            it('ignores a late read callback instead of importing into a closed edition', () => {
                const importGame = vi.spyOn($exeDevice, 'importGame').mockImplementation(() => {});

                selectFile();
                const reader = FakeFileReader.instances[0];
                $exeDevice.$lifecycle.destroy();
                reader.fire('{"x":1}');

                expect(importGame).not.toHaveBeenCalled();
                importGame.mockRestore();
            });

            it('never imports into the iDevice that replaced this one', () => {
                const first = $exeDevice;
                selectFile();
                const reader = FakeFileReader.instances[0];
                first.$lifecycle.destroy();

                const second = { importGame: vi.fn() };
                global.$exeDevice = second;
                reader.fire('{"x":1}');

                expect(second.importGame).not.toHaveBeenCalled();
                global.$exeDevice = first;
            });
        });
    });
});

describe('select-media-files minimum score text', () => {
    it('offers the notice of the minimum score among the custom texts', () => {
        global.$exeDevice = undefined;
        const device = global.loadIdevice(join(__dirname, 'select-media-files.js'));
        device.refreshTranslations();

        expect(device.ci18n.msgPassScore).toBe('Minimum score needed to pass this activity: %s');
    });
});

describe('select-media-files edition: shared form tabs and feedback', () => {
    const PATH = '/files/perm/idevices/base/select-media-files/edition/';
    const edition = () => global.$exeIDevicesEdition.iDevice;
    const feedback = () => edition().gamification.feedback;
    const helpers = () => global.$exeDevices.iDevice.gamification.helpers;
    const tabNames = () =>
        [...document.querySelectorAll('#gameQEIdeviceForm-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );
    const panel = (name) => document.getElementById(`gameQEIdeviceForm-panel-${name}`);
    const card = (eText, state = false) => ({
        id: '',
        type: 2,
        url: '',
        audio: '',
        author: '',
        alt: '',
        eText,
        color: '#000000',
        backcolor: '#ffffff',
        state,
    });
    const phrase = (overrides = {}) => ({
        cards: [card('Cat', true), card('Car')],
        msgError: '',
        msgHit: '',
        definition: 'Choose the animal',
        audioDefinition: '',
        audioHit: '',
        audioError: '',
        url: '',
        alt: '',
        author: '',
        ...overrides,
    });
    const game = (overrides = {}) => ({
        typeGame: 'SeleccionaMedias',
        author: '',
        instructions: '',
        showMinimize: false,
        showSolution: true,
        itinerary: {
            showClue: false,
            clueGame: '',
            percentageClue: 40,
            showCodeAccess: false,
            codeAccess: '',
            messageCodeAccess: '',
        },
        phrasesGame: [phrase()],
        isScorm: 0,
        textButtonScorm: 'Save score',
        repeatActivity: true,
        weighted: 100,
        textFeedBack: '',
        textAfter: '',
        feedBack: false,
        percentajeFB: 100,
        customMessages: false,
        percentajeQuestions: 100,
        timeShowSolution: 4,
        time: 0,
        version: 1.5,
        evaluation: false,
        evaluationID: '',
        attempsNumber: 1,
        numberMaxCards: 30,
        modeTable: false,
        ...overrides,
    });
    const stored = (data, extra = '') => `
        <div class="seleccionamedias-IDevice">
            ${extra}
            <div class="seleccionamedias-DataGame js-hidden">${JSON.stringify(data)}</div>
        </div>`;
    let device;
    let previousApp;
    let tooltips;
    let previousHelpers;
    let previousMedia;

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
                            tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
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
        previousMedia = global.$exeDevices.iDevice.gamification.media;
        global.$exeDevices.iDevice.gamification.media = { extractURLGD: (url) => url };
        device = global.loadIdevice(join(__dirname, 'select-media-files.js'));
        device.phrasesGame = [];
        document.body.innerHTML = '<div id="selectMediaBody"></div>';
        device.init(document.getElementById('selectMediaBody'), {}, PATH);
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
        global.$exeDevices.iDevice.gamification.media = previousMedia;
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    it('lays the form out in the shared tabs, and opens on its activities', () => {
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

    it('edits the activities in Questions and the game in Options', () => {
        expect(panel('contents').firstElementChild.textContent).toContain('Add the activities and their cards');
        expect(panel('contents').querySelector('#slcmEPanel #slcmEDefinition')).not.toBeNull();
        expect(panel('contents').querySelector('#slcmEPanel .SLCME-EDatosCarta')).not.toBeNull();
        expect(panel('options').querySelector('#slcmEOptions #slcmEModeTable')).not.toBeNull();
        expect(panel('options').querySelector('#slcmEOptions #slcmEANumberMaxCard')).not.toBeNull();
        expect(panel('passwords').querySelector('#eXeGameShowCodeAccess')).not.toBeNull();
        expect(panel('feedback').querySelector('#eXeGameHasFeedBack')).not.toBeNull();
        expect(panel('grading').querySelector('.exe-progress-report-wrapper')).not.toBeNull();
        expect(panel('texts').querySelector('#ci18n_msgCheck')).not.toBeNull();
    });

    it('offers no import, export or AI windows', () => {
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('leaves the feedback to the shared block, without controls of its own', () => {
        for (const id of ['slcmEHasFeedBack', 'slcmEPercentajeFB', 'slcmEFeedbackP', 'slcmEFeedBackEditor']) {
            expect(document.getElementById(id)).toBeNull();
        }
        expect(document.querySelector('.Games-Reportdiv')).toBeNull();
    });

    it('explains each option without changing any of them', () => {
        const helps = [...document.querySelectorAll('#slcmEOptions .exe-idevice-help')];
        const states = () => [...document.querySelectorAll('#gameQEIdeviceForm input')].map((input) => input.checked);
        const before = states();

        expect(helps).toHaveLength(9);
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
        expect(tooltips.size).toBe(9);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('restores the options, the activities and the feedback with the game', () => {
        device.idevicePreviousData = stored(
            game({ modeTable: true, attempsNumber: 3, feedBack: true, percentajeFB: 80 }),
            '<div class="seleccionamedias-feedback-game"><p>Well done</p></div>'
        );

        device.loadPreviousValues();

        expect(document.getElementById('slcmEModeTable').checked).toBe(true);
        expect(document.getElementById('slcmEAttemptsNumber').value).toBe('3');
        expect(document.getElementById('slcmEDefinition').value).toBe('Choose the animal');
        expect(document.querySelectorAll('#slcmEPhrase .SLCME-EDatosCarta')).toHaveLength(2);
        expect(document.getElementById('eXeGameHasFeedBack').checked).toBe(true);
        expect(document.getElementById('eXeGamePercentajeFB').value).toBe('80');
        expect(feedback().getText()).toBe('<p>Well done</p>');
    });

    describe('saving', () => {
        let editors;

        beforeEach(() => {
            editors = {
                eXeGameInstructions: '<p>Instructions</p>',
                eXeIdeviceTextAfter: '',
                eXeGameFeedBackEditor: '',
            };
            vi.spyOn(global.tinymce, 'get').mockImplementation((id) =>
                id in editors
                    ? {
                          initialized: true,
                          getContent: () => editors[id],
                          setContent: (html) => (editors[id] = html),
                      }
                    : null
            );
            device.updateFieldGame(game());
            device.showPhrase(0, true);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('saves the feedback values the export reads', () => {
            device.updateFieldGame(game({ feedBack: true, percentajeFB: 70 }));
            editors.eXeGameFeedBackEditor = '<p>Bravo</p>';

            const data = device.validateData();

            expect(data.feedBack).toBe(true);
            expect(data.percentajeFB).toBe(70);
            expect(unescape(data.textFeedBack)).toBe('<p>Bravo</p>');
            const html = device.save();
            expect(html).toContain('<div class="seleccionamedias-feedback-game"><p>Bravo</p></div>');
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
    });
});

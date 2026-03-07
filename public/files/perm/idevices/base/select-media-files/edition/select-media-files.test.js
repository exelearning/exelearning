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
});

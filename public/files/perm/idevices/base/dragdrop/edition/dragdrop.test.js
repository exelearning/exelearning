/**
 * Unit tests for Drag and drop iDevice export helpers.
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('dragdrop iDevice export helpers', () => {
    let $exeDevice;
    let downloadBlob;

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'dragdrop.js'));
        downloadBlob = vi.fn(() => true);
        global.$exeDevicesEdition.iDevice.gamification.share = { downloadBlob };
    });

    it('exports question text with the dragdrop filename and container', () => {
        vi.spyOn($exeDevice, 'validateData').mockReturnValue({
            wordsGame: [{ word: 'Source', definition: 'Target' }],
        });

        expect($exeDevice.exportQuestions()).toBe(true);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(downloadBlob.mock.calls[0][1]).toBe('words-dragdrop.txt');
        expect(downloadBlob.mock.calls[0][2]).toBe('dragdropQIdeviceForm');
    });

    it('exports game JSON with the dragdrop filename and container', () => {
        const dataGame = { wordsGame: [{ word: 'Source', definition: 'Target' }] };
        vi.spyOn($exeDevice, 'validateData').mockReturnValue(dataGame);

        expect($exeDevice.exportGame()).toBe(true);
        expect(downloadBlob).toHaveBeenCalledTimes(1);
        expect(downloadBlob.mock.calls[0][1]).toBe('Activity-DragDrop.json');
        expect(downloadBlob.mock.calls[0][2]).toBe('dragdropQIdeviceForm');
    });
});

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
    ['#eXeGameExportQuestions', 'click', 'exportQuestions'],
    ['#dadEPercentajeCards', 'keyup', 'updateCardsNumber'],
    ['#dadEPercentajeCards', 'click', 'updateCardsNumber'],
    ['#dadEPercentajeCards', 'focusout', 'updateCardsNumber'],
    ['#dadEURLAudioDefinition', 'change', 'loadAudio'],
    ['#dadEURLImage', 'change', 'loadImage'],
    ['#dadEPlayImage', 'click', 'loadImage'],
    ['#dadEURLImageBack', 'change', 'loadImage'],
    ['#dadEPlayImageBack', 'click', 'loadImage'],
    ['#dadEURLAudio', 'change', 'loadAudio'],
    ['#dadEPlayAudio', 'click', 'loadAudio'],
    ['#dadEPlayAudioBack', 'click', 'loadAudio'],
    ['#dadEImage', 'click', 'clickImage'],
    ['#dadEImageBack', 'click', 'clickImageBack'],
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
            <div id="eXeGameExportImport">
                <p class="exe-field-instructions"></p>
                <input id="eXeGameImportGame" type="file" />
                <a href="#" id="eXeGameExportQuestions"></a>
            </div>
            <input id="dadEPercentajeCards" type="text" value="50" />
            <input id="dadEURLAudioDefinition" type="text" value="sound.mp3" />
            <input id="dadEURLImage" type="text" value="picture.png" />
            <a href="#" id="dadEPlayImage"></a>
            <input id="dadEURLImageBack" type="text" value="picture.png" />
            <a href="#" id="dadEPlayImageBack"></a>
            <input id="dadEURLAudio" type="text" value="sound.mp3" />
            <a href="#" id="dadEPlayAudio"></a>
            <a href="#" id="dadEPlayAudioBack"></a>
            <img id="dadEImage" alt="" />
            <img id="dadEImageBack" alt="" />
            <input id="dadENumberCard" type="text" value="2" />
        </div>`;
}

describe('dragdrop edition: $exeDevice guards (#2271)', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        buildEditionForm();
        global.$exeDevicesEdition.iDevice.gamification.itinerary = {
            getTab: vi.fn(() => ''),
            addEvents: vi.fn(),
            getValues: vi.fn(() => ({})),
            setValues: vi.fn(),
        };
        $exeDevice = global.loadIdevice(join(__dirname, 'dragdrop.js'));
        $exeDevice.addEvents();
        $exeDevice.addEventCard();
    });

    afterEach(() => {
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
});

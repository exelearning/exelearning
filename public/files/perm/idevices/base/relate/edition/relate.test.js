/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadIdevice(code) {
    const modifiedCode = code.replace(
        /var\s+\$exeDevice\s*=/,
        'global.$exeDevice ='
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

describe('relate iDevice edition', () => {
    let $exeDevice;

    beforeEach(() => {
        global.$exeDevice = undefined;
        const code = readFileSync(join(__dirname, 'relate.js'), 'utf-8');
        $exeDevice = loadIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('validTime', () => {
        it('returns true for valid hh:mm:ss values', () => {
            expect($exeDevice.validTime('00:00:00')).toBe(true);
            expect($exeDevice.validTime('12:30:45')).toBe(true);
            expect($exeDevice.validTime('23:59:59')).toBe(true);
        });

        it('returns false for invalid or incomplete time values', () => {
            expect($exeDevice.validTime('24:00:00')).toBe(false);
            expect($exeDevice.validTime('12:60:00')).toBe(false);
            expect($exeDevice.validTime('12:30:60')).toBe(false);
            expect($exeDevice.validTime('12:30')).toBe(false);
            expect($exeDevice.validTime('aa:bb:cc')).toBe(false);
        });
    });

    describe('hexToRgba', () => {
        it('converts hex colors to rgba values', () => {
            expect($exeDevice.hexToRgba('#ffffff', 0.7)).toBe(
                'rgba(255,255,255,0.7)'
            );
            expect($exeDevice.hexToRgba('#0f0', 1)).toBe('rgba(0,255,0,1)');
        });

        it('uses full opacity when opacity is not finite', () => {
            expect($exeDevice.hexToRgba('#000000')).toBe('rgba(0,0,0,1)');
        });
    });

    describe('getDefaultCard', () => {
        it('returns the full front and back card structure', () => {
            expect($exeDevice.getDefaultCard()).toEqual({
                id: '',
                type: 2,
                url: '',
                audio: '',
                x: 0,
                y: 0,
                author: '',
                alt: '',
                eText: '',
                color: '#000000',
                backcolor: '#ffffff',
                correct: 0,
                urlBk: '',
                audioBk: '',
                xBk: 0,
                yBk: 0,
                authorBk: '',
                altBk: '',
                eTextBk: '',
                colorBk: '#000000',
                backcolorBk: '#ffffff',
            });
        });

        it('returns a new object each time', () => {
            const first = $exeDevice.getDefaultCard();
            const second = $exeDevice.getDefaultCard();

            first.eText = 'changed';

            expect(first).not.toBe(second);
            expect(second.eText).toBe('');
        });
    });

    describe('placeImageWindows', () => {
        function createMockImage(parentWidth, parentHeight) {
            const parent = document.createElement('div');
            Object.defineProperty(parent, 'offsetWidth', {
                configurable: true,
                value: parentWidth,
            });
            Object.defineProperty(parent, 'offsetHeight', {
                configurable: true,
                value: parentHeight,
            });
            parent.style.width = `${parentWidth}px`;
            parent.style.height = `${parentHeight}px`;
            const image = document.createElement('img');
            parent.appendChild(image);
            document.body.appendChild(parent);
            return image;
        }

        it('fits a landscape image in a square container', () => {
            const image = createMockImage(200, 200);

            expect($exeDevice.placeImageWindows(image, 400, 300)).toEqual({
                h: 150,
                w: 200,
                x: 0,
                y: 25,
            });
        });

        it('fits a portrait image in a square container', () => {
            const image = createMockImage(200, 200);

            expect($exeDevice.placeImageWindows(image, 300, 400)).toEqual({
                h: 200,
                w: 150,
                x: 25,
                y: 0,
            });
        });
    });

    describe('removeTags', () => {
        it('strips HTML and returns plain text', () => {
            expect($exeDevice.removeTags('<p>Hello <strong>world</strong></p>')).toBe(
                'Hello world'
            );
        });
    });
});

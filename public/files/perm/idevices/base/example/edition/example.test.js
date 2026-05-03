/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('example iDevice', () => {
    let $exeDevice;
    let sanitizeTextMock;

    beforeEach(() => {
        global.$exeDevice = undefined;

        sanitizeTextMock = vi.fn((value) =>
            String(value || '').replace(/<[^>]*>/g, '')
        );

        global.$exeDevicesEdition = global.$exeDevicesEdition || {
            iDevice: {},
        };
        global.$exeDevicesEdition.iDevice =
            global.$exeDevicesEdition.iDevice || {};
        global.$exeDevicesEdition.iDevice.common = {
            ...(global.$exeDevicesEdition.iDevice.common || {}),
            sanitizeText: sanitizeTextMock,
        };

        global.eXe = global.eXe || {};
        global.eXe.app = global.eXe.app || {};
        global.eXe.app.alert = vi.fn();

        $exeDevice = global.loadIdevice(join(__dirname, 'example.js'));
    });

    it('save sanitizes and normalizes user input', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        $exeDevice.init(root, {});

        root.querySelector('#exampleText').value = '<b>Sample</b>';
        root.querySelector('#exampleDataList').value = 'not_allowed<script>';
        root.querySelector('#exampleNumber').value = '999';
        root.querySelector('#exampleColor').value = 'invalid-color';
        root.querySelector('#exampleSwitch').checked = true;
        root.querySelector('#element_2').checked = true;

        const result = $exeDevice.save();

        expect(result.text).toBe('Sample');
        expect(result.dataList).toBe('element_1');
        expect(result.number).toBe(5);
        expect(result.color).toBe('#000000');
        expect(result.switch).toBe(true);
        expect(result.radio).toBe('element_2');

        root.remove();
    });

    it('falls back to default color for non-hex values', () => {
        expect($exeDevice.getSafeColorValue('javascript:alert(1)')).toBe(
            '#fbbf3c'
        );
    });

    it('loadPreviousValues keeps false switch and sanitizes invalid radio', () => {
        const root = document.createElement('div');
        document.body.appendChild(root);

        $exeDevice.init(root, {
            text: '<i>Unsafe</i>',
            dataList: 'element_2',
            number: '-100',
            color: '#112233',
            switch: false,
            radio: 'invalid-radio',
        });

        expect(root.querySelector('#exampleText').value).toBe('Unsafe');
        expect(root.querySelector('#exampleDataList').value).toBe('element_2');
        expect(root.querySelector('#exampleNumber').value).toBe('1');
        expect(root.querySelector('#exampleColor').value).toBe('#112233');
        expect(root.querySelector('#exampleSwitch').checked).toBe(false);
        expect(root.querySelector('#element_1').checked).toBe(true);

        root.remove();
    });
});

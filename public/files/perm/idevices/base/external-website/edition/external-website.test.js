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

describe('external-website iDevice', () => {
    let $exeDevice;
    let sanitizeTextMock;
    let sanitizeHtmlMock;
    let sanitizeUrlMock;

    beforeEach(() => {
        global.$exeDevice = undefined;
        global._ = global._ || ((value) => value);
        global.c_ = global.c_ || ((value) => value);

        sanitizeTextMock = vi.fn((value) => String(value || '').replace(/<[^>]*>/g, ''));
        sanitizeHtmlMock = vi.fn((value) => String(value || '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ''));
        sanitizeUrlMock = vi.fn((value) => {
            const trimmed = String(value || '').trim();
            if (/^\s*(javascript:|data:|vbscript:)/i.test(trimmed)) {
                return '';
            }
            return trimmed;
        });

        global.$exeDevicesEdition = global.$exeDevicesEdition || { iDevice: {} };
        global.$exeDevicesEdition.iDevice = global.$exeDevicesEdition.iDevice || {};
        global.$exeDevicesEdition.iDevice.common = {
            ...(global.$exeDevicesEdition.iDevice.common || {}),
            sanitizeText: sanitizeTextMock,
            sanitizeHtml: sanitizeHtmlMock,
            sanitizeUrl: sanitizeUrlMock,
        };

        global.eXe = global.eXe || {};
        global.eXe.app = global.eXe.app || {};
        global.eXe.app.alert = vi.fn();

        const filePath = join(__dirname, 'external-website.js');
        const code = readFileSync(filePath, 'utf-8');
        $exeDevice = loadIdevice(code);

        document.body.innerHTML = '<div id="external-website-root"></div>';
        $exeDevice.init(document.getElementById('external-website-root'), '', '');
    });

    it('loadPreviousValues uses sanitized iframe source', () => {
        $exeDevice.idevicePreviousData =
            '<div><iframe src="javascript:alert(1)" size="3"></iframe></div>';

        $exeDevice.loadPreviousValues();

        expect($('#websiteUrl').val()).toBe('');
        expect($('#sizeSelector').val()).toBe('3');
    });

    it('save rejects unsafe URLs after sanitization', () => {
        $('#websiteUrl').val('javascript:alert(1)');
        $('#sizeSelector').val('2');

        const result = $exeDevice.save();

        expect(result).toBe(false);
        expect(global.eXe.app.alert).toHaveBeenCalled();
    });
});

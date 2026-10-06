/* eslint-disable no-undef */
import '../../../../../../vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEditionIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$exeDevice;
}

function attachment(overrides = {}) {
    return {
        url: 'asset://aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf',
        filename: 'worksheet.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        title: '',
        description: '',
        ...overrides,
    };
}

describe('file-attachment edition has no per-file link-target option', () => {
    let $exeDevice;
    let body;

    function init(previousData = {}) {
        body = document.createElement('div');
        body.setAttribute('idevice-id', 'idev-target');
        document.body.appendChild(body);
        $exeDevice.init(body, previousData, '/path/');
    }

    beforeEach(() => {
        global.$exeDevice = undefined;
        const code = readFileSync(join(__dirname, 'file-attachment.js'), 'utf-8');
        $exeDevice = loadEditionIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('does not render an open-in-new-window checkbox', () => {
        init({ attachments: [attachment()] });

        expect(body.querySelector('.fileAttachment-edit-open-new-window')).toBeNull();
    });

    it('does not render the checkbox even when older data stored the flag', () => {
        init({ attachments: [attachment({ openInNewWindow: true })] });

        expect(body.querySelector('.fileAttachment-edit-open-new-window')).toBeNull();
    });

    it('drops a stored openInNewWindow flag on save', () => {
        init({ attachments: [attachment({ openInNewWindow: true })] });

        const saved = $exeDevice.save().attachments[0];
        expect('openInNewWindow' in saved).toBe(false);
    });

    it('does not persist the flag for newly selected Media Library files', () => {
        init();
        $exeDevice.addAttachmentFromAsset({
            assetUrl: 'asset://bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.pdf',
            asset: { filename: 'new.pdf', mime: 'application/pdf', size: 10 },
        });

        const saved = $exeDevice.save().attachments[0];
        expect('openInNewWindow' in saved).toBe(false);
    });
});

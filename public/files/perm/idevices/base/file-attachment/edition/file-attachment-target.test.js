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

describe('file-attachment per-file target option', () => {
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

    it('defaults existing attachments without the property to the same browsing context', () => {
        init({ attachments: [attachment()] });

        const checkbox = body.querySelector('.fileAttachment-edit-open-new-window');
        expect(checkbox).not.toBeNull();
        expect(checkbox.checked).toBe(false);
        expect($exeDevice.save().attachments[0].openInNewWindow).toBe(false);
    });

    it('restores and persists the enabled state', () => {
        init({ attachments: [attachment({ openInNewWindow: true })] });

        const checkbox = body.querySelector('.fileAttachment-edit-open-new-window');
        expect(checkbox.checked).toBe(true);
        expect($exeDevice.save().attachments[0].openInNewWindow).toBe(true);
    });

    it('restores and persists the disabled state', () => {
        init({ attachments: [attachment({ openInNewWindow: false })] });

        const checkbox = body.querySelector('.fileAttachment-edit-open-new-window');
        expect(checkbox.checked).toBe(false);
        expect($exeDevice.save().attachments[0].openInNewWindow).toBe(false);
    });

    it('uses the disabled state for newly selected Media Library files', () => {
        init();
        $exeDevice.addAttachmentFromAsset({
            assetUrl: 'asset://bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.pdf',
            asset: { filename: 'new.pdf', mime: 'application/pdf', size: 10 },
        });

        const checkbox = body.querySelector('.fileAttachment-edit-open-new-window');
        expect(checkbox.checked).toBe(false);
        expect($exeDevice.save().attachments[0].openInNewWindow).toBe(false);
    });

    it('keeps the author choice when the checkbox is ticked before saving', () => {
        init({ attachments: [attachment()] });

        const checkbox = body.querySelector('.fileAttachment-edit-open-new-window');
        checkbox.checked = true;

        expect($exeDevice.save().attachments[0].openInNewWindow).toBe(true);
    });
});

/* eslint-disable no-undef */
import '../../../../../../vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code.replace(/var\s+\$fileattachment\s*=/, 'global.$fileattachment =');
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$fileattachment;
}

function attachment(overrides = {}) {
    return {
        url: 'asset://11111111-1111-1111-1111-111111111111.pdf',
        filename: 'worksheet.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        title: '',
        description: '',
        ...overrides,
    };
}

describe('file-attachment exported link target', () => {
    let $fileattachment;

    beforeEach(() => {
        global.$fileattachment = undefined;
        const code = readFileSync(join(__dirname, 'file-attachment.js'), 'utf-8');
        $fileattachment = loadExportIdevice(code);
    });

    it('adds a secure blank target by default for existing attachment data', () => {
        const html = $fileattachment.renderItem(attachment(), true);

        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
    });

    it('omits target and rel attributes when the option is disabled', () => {
        const html = $fileattachment.renderItem(attachment({ openInNewWindow: false }), true);

        expect(html).not.toContain('target="_blank"');
        expect(html).not.toContain('rel="noopener noreferrer"');
    });

    it('does not add target attributes to missing-file placeholders', () => {
        const html = $fileattachment.renderItem(attachment({ url: '' }), true);

        expect(html).not.toContain('target="_blank"');
        expect(html).not.toContain('rel="noopener noreferrer"');
    });
});

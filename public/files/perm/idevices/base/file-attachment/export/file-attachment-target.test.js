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

describe('file-attachment exported links always stay in the same browsing context', () => {
    let $fileattachment;

    beforeEach(() => {
        global.$fileattachment = undefined;
        const code = readFileSync(join(__dirname, 'file-attachment.js'), 'utf-8');
        $fileattachment = loadExportIdevice(code);
    });

    it('renders a plain download link without target or rel attributes', () => {
        const html = $fileattachment.renderItem(attachment(), true);

        expect(html).toContain('download="worksheet.pdf"');
        expect(html).not.toContain('target=');
        expect(html).not.toContain('rel=');
    });

    it('ignores a stored openInNewWindow flag from older documents', () => {
        const html = $fileattachment.renderItem(attachment({ openInNewWindow: true }), true);

        expect(html).toContain('download="worksheet.pdf"');
        expect(html).not.toContain('target=');
        expect(html).not.toContain('rel=');
    });

    it('never emits target attributes for missing-file placeholders', () => {
        const html = $fileattachment.renderItem(attachment({ url: '', openInNewWindow: true }), true);

        expect(html).not.toContain('target=');
        expect(html).not.toContain('rel=');
    });
});

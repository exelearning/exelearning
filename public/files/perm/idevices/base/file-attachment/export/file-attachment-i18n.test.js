/* eslint-disable no-undef */
/**
 * Regression tests for the exported-site runtime environment.
 *
 * The editor-only `c_()` / `_()` translation helpers do NOT exist in an exported
 * HTML5 site: exports ship `libs/common_i18n.js`, which defines the resolved
 * `$exe_i18n` string bundle instead. Calling `c_()` from export code therefore
 * threw `ReferenceError: c_ is not defined` inside `renderView()`, which
 * `exe_export.js` swallowed as "[exe_export] Could not load template" and the
 * iDevice never rendered.
 *
 * These tests deliberately run with `c_` removed from the global scope so the
 * exported-site environment is reproduced faithfully (the shared vitest setup
 * defines a `c_` mock that hid this bug).
 */
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

const TEMPLATE = '<div class="exe-file-attachment-template">{content}</div>';

function makeAttachment(overrides = {}) {
    return {
        url: 'asset://11111111-1111-1111-1111-111111111111.pdf',
        title: '',
        description: '',
        filename: 'worksheet.pdf',
        mimeType: 'application/pdf',
        size: 123456,
        ...overrides,
    };
}

describe('file-attachment export runtime without the editor translation helpers', () => {
    let $fa;
    let savedC;
    let savedUnderscore;

    beforeEach(() => {
        // Reproduce the exported site: no c_(), no _(), no $exe_i18n yet.
        savedC = global.c_;
        savedUnderscore = global._;
        delete global.c_;
        delete global._;
        if (typeof window !== 'undefined') {
            delete window.c_;
            delete window._;
            delete window.$exe_i18n;
        }
        delete global.$exe_i18n;

        global.$fileattachment = undefined;
        const code = readFileSync(join(__dirname, 'file-attachment.js'), 'utf-8');
        $fa = loadExportIdevice(code);
    });

    afterEach(() => {
        global.c_ = savedC;
        global._ = savedUnderscore;
        if (typeof window !== 'undefined') {
            window.c_ = savedC;
            window._ = savedUnderscore;
            delete window.$exe_i18n;
        }
        delete global.$exe_i18n;
        document.body.innerHTML = '';
    });

    it('renders the empty state without throwing ReferenceError', () => {
        const html = $fa.renderView({ ideviceId: 'x', attachments: [] }, 0, TEMPLATE);

        expect(html).toContain('fileAttachment-empty');
        expect(html).toContain('No files attached.');
    });

    it('renders a download link without throwing ReferenceError', () => {
        const html = $fa.renderView({ ideviceId: 'x', attachments: [makeAttachment()] }, 0, TEMPLATE);

        expect(html).toContain('class="fileAttachment-link"');
        expect(html).toContain('Download');
        expect(html).toContain('worksheet.pdf');
    });

    it('renders the unnamed-attachment label without throwing ReferenceError', () => {
        const html = $fa.renderItem(makeAttachment({ filename: '', title: '' }), true);

        expect(html).toContain('Attachment');
    });

    it('renders the missing-file placeholder without throwing ReferenceError', () => {
        const html = $fa.renderItem(makeAttachment({ url: '' }), true);

        expect(html).toContain('fileAttachment-link--missing');
        expect(html).toContain('File unavailable');
    });

    it('uses the exported $exe_i18n bundle when it is available', () => {
        global.$exe_i18n = {
            download: 'Descargar',
            attachment: 'Adjunto',
            noFilesAttached: 'No hay archivos adjuntos.',
            fileUnavailable: 'Archivo no disponible',
        };
        if (typeof window !== 'undefined') window.$exe_i18n = global.$exe_i18n;

        expect($fa.renderView({ ideviceId: 'x', attachments: [] }, 0, TEMPLATE)).toContain(
            'No hay archivos adjuntos.',
        );
        expect($fa.renderItem(makeAttachment(), true)).toContain('Descargar');
        expect($fa.renderItem(makeAttachment({ url: '' }), true)).toContain('Archivo no disponible');
        expect($fa.renderItem(makeAttachment({ filename: '', title: '' }), true)).toContain('Adjunto');
    });

    it('falls back to English when reading the bundle throws', () => {
        Object.defineProperty(window, '$exe_i18n', {
            configurable: true,
            get() {
                throw new Error('bundle access denied');
            },
        });

        expect($fa.renderItem(makeAttachment(), true)).toContain('Download');

        delete window.$exe_i18n;
    });

    it('falls back to English when a bundle key is missing or blank', () => {
        global.$exe_i18n = { download: '   ' };
        if (typeof window !== 'undefined') window.$exe_i18n = global.$exe_i18n;

        expect($fa.renderItem(makeAttachment(), true)).toContain('Download');
        expect($fa.renderView({ ideviceId: 'x', attachments: [] }, 0, TEMPLATE)).toContain('No files attached.');
    });
});

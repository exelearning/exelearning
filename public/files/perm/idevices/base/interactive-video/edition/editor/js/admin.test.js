/**
 * Unit tests for the Interactive Video editor (admin.js).
 *
 * The editor runs inside an iframe owned by the iDevice edition, so almost
 * everything it creates dies with that iframe. The exception is what it binds
 * on the host document: those registrations belong to the host edition's
 * lifecycle and must be released when the editor closes (issue #2293).
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load admin.js the way the editor page does: as a classic script whose `var`
 * declarations land on the global object.
 *
 * @returns {Object} The `iAdmin` object the file defines.
 */
function loadAdmin() {
    const code = readFileSync(join(__dirname, 'admin.js'), 'utf-8');
    // eslint-disable-next-line no-eval
    (0, eval)(code);
    return global.iAdmin;
}

describe('interactive video editor: host document ownership (#2293)', () => {
    let iAdmin;
    let lifecycle;
    let editorModal;
    let fileManager;
    let originalSymfony;
    let originalApp;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="modalGenericIframeContainer" class="modal show"></div>
            <div id="modalFileManager"></div>`;

        global.$i18n = {};
        global.tinymce = { init: vi.fn() };

        originalSymfony = global.eXeLearning.symfony;
        originalApp = global.eXeLearning.app;
        global.eXeLearning.symfony = { fullURL: 'http://localhost' };
        fileManager = { show: vi.fn() };
        global.eXeLearning.app = { modals: { filemanager: fileManager } };

        editorModal = { show: vi.fn(), hide: vi.fn() };
        global.bootstrap = { Modal: { getInstance: vi.fn(() => editorModal) } };

        // The host edition publishes its lifecycle for helpers that have no
        // `this`, exactly as `IdeviceNode.initExeDeviceEdition()` does.
        lifecycle = global.attachEditionLifecycle({});

        iAdmin = loadAdmin();
    });

    afterEach(() => {
        lifecycle.destroy();
        global.eXeLearning.symfony = originalSymfony;
        global.eXeLearning.app = originalApp;
        delete global.bootstrap;
        delete global.tinymce;
        delete global.$i18n;
        document.body.innerHTML = '';
    });

    /**
     * Open the image picker of a TinyMCE editor, which is what registers the
     * listener on the host's File Manager modal.
     */
    function openFilePicker() {
        iAdmin.editors.enable('image-block-content');
        const options = global.tinymce.init.mock.calls[0][0];
        options.file_picker_callback(vi.fn(), '', { filetype: 'image' });
    }

    it('reopens the editor modal when the File Manager closes', () => {
        openFilePicker();

        expect(fileManager.show).toHaveBeenCalledTimes(1);
        expect(editorModal.hide).toHaveBeenCalledTimes(1);

        document.getElementById('modalFileManager').dispatchEvent(new Event('hidden.bs.modal'));

        expect(editorModal.show).toHaveBeenCalledTimes(1);
    });

    it('does not reopen the editor modal after the edition closed', () => {
        const unrelated = vi.fn();
        const fileManagerModalEl = document.getElementById('modalFileManager');
        fileManagerModalEl.addEventListener('hidden.bs.modal', unrelated);

        openFilePicker();
        lifecycle.destroy();

        fileManagerModalEl.dispatchEvent(new Event('hidden.bs.modal'));

        expect(editorModal.show).not.toHaveBeenCalled();
        expect(unrelated).toHaveBeenCalledTimes(1);
    });
});

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

function asset(overrides = {}) {
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

describe('file-attachment iDevice edition', () => {
    let $exeDevice;
    let body;

    function init(previousData = {}) {
        body = document.createElement('div');
        body.setAttribute('idevice-id', 'idev-123');
        document.body.appendChild(body);
        $exeDevice.init(body, previousData, '/path/');
        return body;
    }

    beforeEach(() => {
        global.$exeDevice = undefined;
        const code = readFileSync(join(__dirname, 'file-attachment.js'), 'utf-8');
        $exeDevice = loadEditionIdevice(code);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('initial render', () => {
        it('renders the form with the add button and an empty state', () => {
            init();
            expect(body.querySelector('#fileAttachmentAddButton')).not.toBeNull();
            expect(body.querySelector('#fileAttachmentList').children.length).toBe(0);
            const empty = body.querySelector('#fileAttachmentEmpty');
            expect(empty).not.toBeNull();
            expect(empty.style.display).toBe('');
        });

        it('defaults showDescriptions to checked', () => {
            init();
            expect(body.querySelector('#fileAttachmentShowDescriptions').checked).toBe(true);
        });
    });

    describe('adding attachments', () => {
        it('adds a row and hides the empty state', () => {
            init();
            $exeDevice.addAttachment(asset());
            expect(body.querySelectorAll('.fileAttachment-edit-item').length).toBe(1);
            expect(body.querySelector('#fileAttachmentEmpty').style.display).toBe('none');
            expect(body.querySelector('.fileAttachment-edit-filename').textContent).toContain('worksheet.pdf');
        });

        it('maps a Media Library result into a stored attachment reference', () => {
            init();
            $exeDevice.addAttachmentFromAsset({
                assetUrl: 'asset://bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png',
                blobUrl: 'blob:whatever',
                asset: { filename: 'diagram.png', mime: 'image/png', size: 999 },
            });
            const row = body.querySelector('.fileAttachment-edit-item');
            expect(row.getAttribute('data-url')).toBe('asset://bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb.png');
            expect(row.getAttribute('data-filename')).toBe('diagram.png');
            expect(row.getAttribute('data-mime')).toBe('image/png');
            expect(row.getAttribute('data-size')).toBe('999');
        });

        it('ignores a null asset result', () => {
            init();
            $exeDevice.addAttachmentFromAsset(null);
            expect(body.querySelectorAll('.fileAttachment-edit-item').length).toBe(0);
        });

        it('adds multiple attachments', () => {
            init();
            $exeDevice.addAttachment(asset({ filename: 'a.pdf' }));
            $exeDevice.addAttachment(asset({ filename: 'b.pdf' }));
            expect(body.querySelectorAll('.fileAttachment-edit-item').length).toBe(2);
        });
    });

    describe('collapsible title/description', () => {
        it('starts collapsed and toggles open/closed', () => {
            init();
            $exeDevice.addAttachment(asset());
            const details = body.querySelector('.fileAttachment-edit-details');
            const toggle = body.querySelector('.fileAttachment-edit-details-toggle');

            expect(details.classList.contains('fileAttachment-edit-details-closed')).toBe(true);
            expect(toggle.getAttribute('aria-expanded')).toBe('false');

            toggle.click();
            expect(details.classList.contains('fileAttachment-edit-details-closed')).toBe(false);
            expect(toggle.getAttribute('aria-expanded')).toBe('true');

            toggle.click();
            expect(details.classList.contains('fileAttachment-edit-details-closed')).toBe(true);
            expect(toggle.getAttribute('aria-expanded')).toBe('false');
        });

        it('still saves title/description edited while collapsed', () => {
            init();
            $exeDevice.addAttachment(asset());
            // Fields remain in the DOM even while visually collapsed.
            body.querySelector('.fileAttachment-edit-title').value = 'Worksheet';
            body.querySelector('.fileAttachment-edit-description').value = 'Do this first';
            const data = $exeDevice.save();
            expect(data.attachments[0].title).toBe('Worksheet');
            expect(data.attachments[0].description).toBe('Do this first');
        });
    });

    describe('removing and reordering', () => {
        it('removes a row and restores the empty state when the last is removed', () => {
            init();
            $exeDevice.addAttachment(asset());
            body.querySelector('.fileAttachment-edit-remove').click();
            expect(body.querySelectorAll('.fileAttachment-edit-item').length).toBe(0);
            expect(body.querySelector('#fileAttachmentEmpty').style.display).toBe('');
        });

        it('moves an attachment up', () => {
            init();
            $exeDevice.addAttachment(asset({ filename: 'first.pdf', title: 'First' }));
            $exeDevice.addAttachment(asset({ filename: 'second.pdf', title: 'Second' }));
            const rows = body.querySelectorAll('.fileAttachment-edit-item');
            rows[1].querySelector('.fileAttachment-edit-up').click();
            const data = $exeDevice.save();
            expect(data.attachments[0].filename).toBe('second.pdf');
            expect(data.attachments[1].filename).toBe('first.pdf');
        });

        it('moves an attachment down', () => {
            init();
            $exeDevice.addAttachment(asset({ filename: 'first.pdf' }));
            $exeDevice.addAttachment(asset({ filename: 'second.pdf' }));
            const rows = body.querySelectorAll('.fileAttachment-edit-item');
            rows[0].querySelector('.fileAttachment-edit-down').click();
            const data = $exeDevice.save();
            expect(data.attachments[0].filename).toBe('second.pdf');
        });

        it('keeps order stable at the boundaries', () => {
            init();
            $exeDevice.addAttachment(asset({ filename: 'only.pdf' }));
            const row = body.querySelector('.fileAttachment-edit-item');
            row.querySelector('.fileAttachment-edit-up').click();
            row.querySelector('.fileAttachment-edit-down').click();
            expect($exeDevice.save().attachments[0].filename).toBe('only.pdf');
        });
    });

    describe('save', () => {
        it('returns the full state object', () => {
            init();
            $exeDevice.addAttachment(asset());
            const data = $exeDevice.save();
            expect(data.ideviceId).toBe('idev-123');
            expect(data).toHaveProperty('intro');
            expect(data).toHaveProperty('showDescriptions');
            expect(Array.isArray(data.attachments)).toBe(true);
            expect(data.attachments[0].url).toBe(asset().url);
        });

        it('captures per-attachment title and description edited in the form', () => {
            init();
            $exeDevice.addAttachment(asset());
            body.querySelector('.fileAttachment-edit-title').value = '  Activity sheet  ';
            body.querySelector('.fileAttachment-edit-description').value = '  Download me  ';
            const data = $exeDevice.save();
            expect(data.attachments[0].title).toBe('Activity sheet');
            expect(data.attachments[0].description).toBe('Download me');
        });

        it('reflects the showDescriptions toggle', () => {
            init();
            body.querySelector('#fileAttachmentShowDescriptions').checked = false;
            expect($exeDevice.save().showDescriptions).toBe(false);
        });

        it('reads the intro from the textarea when no TinyMCE editor is active', () => {
            init();
            body.querySelector('#fileAttachmentIntro').value = '<p>Some instructions</p>';
            expect($exeDevice.save().intro).toBe('<p>Some instructions</p>');
        });
    });

    describe('loadPreviousValues round-trip', () => {
        it('restores attachments, flags and intro from saved data', () => {
            init({
                intro: '<p>Read first</p>',
                showDescriptions: false,
                attachments: [
                    asset({ filename: 'one.pdf', title: 'One', description: 'desc one' }),
                    asset({ filename: 'two.png', mimeType: 'image/png', title: 'Two' }),
                ],
            });

            expect(body.querySelector('#fileAttachmentShowDescriptions').checked).toBe(false);

            const data = $exeDevice.save();
            expect(data.intro).toBe('<p>Read first</p>');
            expect(data.showDescriptions).toBe(false);
            expect(data.attachments.length).toBe(2);
            expect(data.attachments[0].title).toBe('One');
            expect(data.attachments[0].description).toBe('desc one');
            expect(data.attachments[1].filename).toBe('two.png');
        });

        it('expands the instructions panel when there is intro content', () => {
            init({ intro: '<p>Read first</p>', attachments: [asset()] });
            const fieldset = body.querySelector('#fileAttachmentIntroFieldset');
            expect(fieldset.classList.contains('exe-fieldset-closed')).toBe(false);
        });

        it('keeps the instructions panel collapsed when there is no intro content', () => {
            init({ attachments: [asset()] });
            const fieldset = body.querySelector('#fileAttachmentIntroFieldset');
            expect(fieldset.classList.contains('exe-fieldset-closed')).toBe(true);
        });
    });

    describe('missing asset handling', () => {
        it('flags a row whose asset reference is missing and preserves the empty url on save', () => {
            init({ attachments: [asset({ url: '', filename: 'gone.pdf', title: 'Gone' })] });
            const row = body.querySelector('.fileAttachment-edit-item');
            expect(row.classList.contains('fileAttachment-edit-item--missing')).toBe(true);
            expect(row.querySelector('.fileAttachment-edit-warning')).not.toBeNull();
            expect($exeDevice.save().attachments[0].url).toBe('');
        });
    });

    describe('escaping', () => {
        it('round-trips a title containing HTML/quotes without breaking the row', () => {
            init({ attachments: [asset({ title: 'A "B" <c> & d' })] });
            const titleInput = body.querySelector('.fileAttachment-edit-title');
            // The browser decodes the escaped attribute back to the original value.
            expect(titleInput.value).toBe('A "B" <c> & d');
            expect($exeDevice.save().attachments[0].title).toBe('A "B" <c> & d');
        });

        it('escapes a malicious filename in the rendered row markup', () => {
            init();
            $exeDevice.addAttachment(asset({ filename: '<img src=x onerror=alert(1)>.pdf' }));
            const list = body.querySelector('#fileAttachmentList');
            expect(list.querySelector('img')).toBeNull();
            expect(list.innerHTML).toContain('&lt;img');
        });
    });

    describe('native upload fallback', () => {
        it('uploads through the AssetManager and adds an attachment', async () => {
            init();
            const assetManager = {
                insertImage: vi.fn(() => Promise.resolve('asset://cccccccc-cccc-cccc-cccc-cccccccccccc.txt')),
                extractAssetId: (url) => url.replace('asset://', '').split('.')[0],
                getAssetMetadata: () => ({ filename: 'notes.txt', mime: 'text/plain', size: 12 }),
            };
            global.eXeLearning.app = { project: { _yjsBridge: { assetManager } } };

            await $exeDevice.uploadFile(new File(['hi'], 'notes.txt', { type: 'text/plain' }));

            const row = body.querySelector('.fileAttachment-edit-item');
            expect(assetManager.insertImage).toHaveBeenCalled();
            expect(row.getAttribute('data-url')).toBe('asset://cccccccc-cccc-cccc-cccc-cccccccccccc.txt');
            expect(row.getAttribute('data-filename')).toBe('notes.txt');

            delete global.eXeLearning.app;
        });

        it('alerts when no AssetManager is available', async () => {
            init();
            await $exeDevice.uploadFile(new File(['hi'], 'notes.txt', { type: 'text/plain' }));
            expect(eXe.app.alert).toHaveBeenCalled();
        });
    });

    describe('openFileManager', () => {
        it('opens the Media Library and adds each selected asset', () => {
            init();
            const fileManager = {
                show: vi.fn((opts) => {
                    opts.onSelect([
                        { assetUrl: 'asset://d1.pdf', asset: { filename: 'd1.pdf', mime: 'application/pdf', size: 1 } },
                        { assetUrl: 'asset://d2.pdf', asset: { filename: 'd2.pdf', mime: 'application/pdf', size: 2 } },
                    ]);
                }),
            };
            global.eXeLearning.app = { modals: { filemanager: fileManager } };

            $exeDevice.openFileManager();

            expect(fileManager.show).toHaveBeenCalled();
            expect(body.querySelectorAll('.fileAttachment-edit-item').length).toBe(2);

            delete global.eXeLearning.app;
        });

        it('falls back to the native input when the Media Library is unavailable', () => {
            init();
            const nativeInput = body.querySelector('#fileAttachmentNativeInput');
            const clickSpy = vi.spyOn(nativeInput, 'click');
            $exeDevice.openFileManager();
            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('Media Library sync (rename / delete)', () => {
        // Controllable mock of the AssetManager's asset metadata Yjs map.
        function installAssetManager(initialMeta = {}) {
            const meta = new Map(Object.entries(initialMeta));
            const observers = [];
            const assetsMap = {
                observe: (h) => observers.push(h),
                unobserve: (h) => {
                    const i = observers.indexOf(h);
                    if (i >= 0) observers.splice(i, 1);
                },
                _fire: () => observers.slice().forEach((h) => h()),
                _observerCount: () => observers.length,
            };
            const assetManager = {
                getAssetsYMap: () => assetsMap,
                extractAssetId: (url) => url.replace('asset://', '').split('.')[0],
                getAssetMetadata: (id) => (meta.has(id) ? { ...meta.get(id), id } : null),
                getAssetUrl: (id, filename) => {
                    const ext = filename && filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
                    return ext ? `asset://${id}.${ext}` : `asset://${id}`;
                },
            };
            global.eXeLearning.app = { project: { _yjsBridge: { assetManager } } };
            return { meta, assetsMap };
        }

        afterEach(() => {
            delete global.eXeLearning.app;
        });

        const UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

        it('uses the live filename when an asset was renamed since the last save', () => {
            installAssetManager({ [UUID]: { filename: 'current.pdf', mime: 'application/pdf', size: 100 } });
            init();
            // Saved snapshot still has the stale name.
            $exeDevice.addAttachment(asset({ url: `asset://${UUID}.pdf`, filename: 'stale.pdf' }));
            const row = body.querySelector('.fileAttachment-edit-item');
            expect(row.getAttribute('data-filename')).toBe('current.pdf');
            expect(row.querySelector('.fileAttachment-edit-filename').textContent).toBe('current.pdf');
        });

        it('updates the row when a referenced asset is renamed in the Media Library', () => {
            const { meta, assetsMap } = installAssetManager({
                [UUID]: { filename: 'report.pdf', mime: 'application/pdf', size: 100 },
            });
            init();
            $exeDevice.addAttachment(asset({ url: `asset://${UUID}.pdf`, filename: 'report.pdf' }));

            meta.set(UUID, { filename: 'final-report.pdf', mime: 'application/pdf', size: 100 });
            assetsMap._fire();

            const row = body.querySelector('.fileAttachment-edit-item');
            expect(row.getAttribute('data-filename')).toBe('final-report.pdf');
            expect(row.querySelector('.fileAttachment-edit-filename').textContent).toBe('final-report.pdf');
            expect($exeDevice.save().attachments[0].filename).toBe('final-report.pdf');
        });

        it('updates the stored asset URL when a rename changes the extension', () => {
            const { meta, assetsMap } = installAssetManager({
                [UUID]: { filename: 'photo.jpg', mime: 'image/jpeg', size: 100 },
            });
            init();
            $exeDevice.addAttachment(asset({ url: `asset://${UUID}.jpg`, filename: 'photo.jpg' }));

            meta.set(UUID, { filename: 'photo.png', mime: 'image/png', size: 100 });
            assetsMap._fire();

            expect($exeDevice.save().attachments[0].url).toBe(`asset://${UUID}.png`);
        });

        it('flags the row as missing when a referenced asset is deleted', () => {
            const { meta, assetsMap } = installAssetManager({
                [UUID]: { filename: 'doc.pdf', mime: 'application/pdf', size: 100 },
            });
            init();
            $exeDevice.addAttachment(asset({ url: `asset://${UUID}.pdf`, filename: 'doc.pdf' }));
            const row = body.querySelector('.fileAttachment-edit-item');
            expect(row.classList.contains('fileAttachment-edit-item--missing')).toBe(false);

            meta.delete(UUID);
            assetsMap._fire();

            expect(row.classList.contains('fileAttachment-edit-item--missing')).toBe(true);
            expect(row.querySelector('.fileAttachment-edit-warning')).not.toBeNull();
            // The reference is preserved so the author can re-add or remove it.
            expect($exeDevice.save().attachments[0].url).toBe(`asset://${UUID}.pdf`);
        });

        it('clears the missing flag when the asset becomes available again', () => {
            const { meta, assetsMap } = installAssetManager({});
            init();
            $exeDevice.addAttachment(asset({ url: `asset://${UUID}.pdf`, filename: 'doc.pdf' }));
            const row = body.querySelector('.fileAttachment-edit-item');
            expect(row.classList.contains('fileAttachment-edit-item--missing')).toBe(true);

            meta.set(UUID, { filename: 'doc.pdf', mime: 'application/pdf', size: 100 });
            assetsMap._fire();

            expect(row.classList.contains('fileAttachment-edit-item--missing')).toBe(false);
            expect(row.querySelector('.fileAttachment-edit-warning')).toBeNull();
        });

        it('keeps syncing after the core resets the global $exeDevice', () => {
            const { meta, assetsMap } = installAssetManager({
                [UUID]: { filename: 'doc.pdf', mime: 'application/pdf', size: 100 },
            });
            init();
            const device = $exeDevice;
            device.addAttachment(asset({ url: `asset://${UUID}.pdf`, filename: 'doc.pdf' }));

            // ideviceNode.js sets `$exeDevice = undefined` when edition ends, but the
            // iDevice node stays on the page, so the observer's detach branch does not
            // run. Reading the global from the callback threw a TypeError that Yjs
            // propagated into the Media Library rename/delete caller.
            global.$exeDevice = undefined;
            meta.set(UUID, { filename: 'renamed.pdf', mime: 'application/pdf', size: 100 });

            expect(() => assetsMap._fire()).not.toThrow();

            const row = body.querySelector('.fileAttachment-edit-item');
            expect(row.getAttribute('data-filename')).toBe('renamed.pdf');
        });

        it('stops observing once the iDevice DOM is detached', () => {
            const { assetsMap } = installAssetManager({ [UUID]: { filename: 'doc.pdf' } });
            init();
            expect(assetsMap._observerCount()).toBe(1);

            body.remove();
            assetsMap._fire();

            expect(assetsMap._observerCount()).toBe(0);
        });
    });

    describe('helpers', () => {
        it('classifies file categories', () => {
            expect($exeDevice.getFileCategory('application/pdf', 'x.pdf')).toBe('pdf');
            expect($exeDevice.getFileCategory('', 'a.mp3')).toBe('audio');
        });

        it('builds an SVG icon labelled with the extension', () => {
            const svg = $exeDevice.getFileIconSvg('application/pdf', 'x.pdf');
            expect(svg).toContain('<svg');
            expect(svg).toContain('PDF');
        });
    });
});

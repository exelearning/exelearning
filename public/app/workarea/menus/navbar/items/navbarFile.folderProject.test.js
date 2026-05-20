/**
 * Tests for the advanced folder-project actions added in
 * setFolderProjectActionsEvents / openProjectFromFolderEvent /
 * saveProjectToFolderEvent.
 *
 * The existing navbarFile.test.js exercises the rest of the class with
 * a heavy global stub. These tests instead use happy-dom directly with
 * a small per-test setup so the code paths added by this feature can be
 * driven precisely (Electron vs browser vs neither).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NavbarFile from './navbarFile.js';

const buildNavbarDOM = ({ withFolderEntries = true } = {}) => {
    const navbar = document.createElement('nav');

    const ids = [
        'dropdownFile',
        'navbar-button-new',
        'navbar-button-new-from-template',
        'navbar-button-save',
        'navbar-button-settings',
        'navbar-button-share',
        'navbar-button-uploadtoplatform',
        'navbar-button-openuserodefiles',
        'navbar-button-open-offline',
        'navbar-button-save-offline',
        'navbar-button-dropdown-recent-projects',
        'navbar-button-download-project',
        'navbar-button-download-project-as',
        'navbar-button-export-html5',
        'navbar-button-exportas-html5',
        'navbar-button-exportas-html5-folder',
        'navbar-button-export-html5-sp',
        'navbar-button-exportas-html5-sp',
        'navbar-button-export-print',
        'navbar-button-export-scorm12',
        'navbar-button-exportas-scorm12',
        'navbar-button-export-scorm2004',
        'navbar-button-exportas-scorm2004',
        'navbar-button-export-ims',
        'navbar-button-exportas-ims',
        'navbar-button-export-epub3',
        'navbar-button-exportas-epub3',
        'navbar-button-export-xml-properties',
        'navbar-button-exportas-xml-properties',
        'navbar-button-import-xml-properties',
        'navbar-button-import-elp',
        'exe-panels-toggler',
    ];
    for (const id of ids) {
        const btn = document.createElement('button');
        btn.id = id;
        navbar.appendChild(btn);
    }

    const recent = document.createElement('ul');
    recent.id = 'navbar-dropdown-menu-recent-projects';
    navbar.appendChild(recent);

    if (withFolderEntries) {
        const wrapOpen = document.createElement('li');
        wrapOpen.classList.add('d-none', 'exe-folder-project-action');
        const openBtn = document.createElement('a');
        openBtn.id = 'navbar-button-open-folder-offline';
        wrapOpen.appendChild(openBtn);
        navbar.appendChild(wrapOpen);

        const wrapSave = document.createElement('li');
        wrapSave.classList.add('d-none', 'exe-folder-project-action');
        const saveBtn = document.createElement('a');
        saveBtn.id = 'navbar-button-save-folder-offline';
        wrapSave.appendChild(saveBtn);
        navbar.appendChild(wrapSave);
    }

    document.body.appendChild(navbar);
    return navbar;
};

describe('NavbarFile — folder project actions', () => {
    let navbar;
    let alertShow;
    let toastBody;
    let toast;
    let largeFilesUpload;
    let docManagerMarkClean;
    let originalShowDirectoryPicker;
    let originalElectronAPI;
    let originalSharedExporters;
    let originalEnableFolderProjects;

    beforeEach(() => {
        vi.useFakeTimers();
        navbar = buildNavbarDOM();

        alertShow = vi.fn();
        largeFilesUpload = vi.fn().mockResolvedValue();
        docManagerMarkClean = vi.fn();
        toastBody = { innerHTML: '', classList: { add: vi.fn() } };
        toast = { toastBody, remove: vi.fn() };

        // Real happy-dom window stays in place; we only patch the bits the
        // code under test reaches into.
        originalShowDirectoryPicker = window.showDirectoryPicker;
        originalElectronAPI = window.electronAPI;
        originalSharedExporters = window.SharedExporters;
        delete window.showDirectoryPicker;
        delete window.electronAPI;
        delete window.SharedExporters;

        originalEnableFolderProjects = window.eXeLearning?.config?.enableFolderProjects;

        window.eXeLearning = {
            app: {
                project: {
                    checkOpenIdevice: vi.fn(() => false),
                    _yjsBridge: {
                        documentManager: { markClean: docManagerMarkClean },
                        assetCache: null,
                        assetManager: null,
                        resourceFetcher: null,
                    },
                },
                modals: {
                    alert: { show: alertShow },
                    openuserodefiles: { largeFilesUpload },
                },
                toasts: {
                    createToast: vi.fn(() => toast),
                },
            },
            config: { enableFolderProjects: false },
        };

        window._ = vi.fn((s) => s);
        global._ = window._;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        if (originalShowDirectoryPicker === undefined) delete window.showDirectoryPicker;
        else window.showDirectoryPicker = originalShowDirectoryPicker;
        if (originalElectronAPI === undefined) delete window.electronAPI;
        else window.electronAPI = originalElectronAPI;
        if (originalSharedExporters === undefined) delete window.SharedExporters;
        else window.SharedExporters = originalSharedExporters;
        if (window.eXeLearning?.config) {
            window.eXeLearning.config.enableFolderProjects = originalEnableFolderProjects;
        }
        document.body.innerHTML = '';
    });

    // ─── setFolderProjectActionsEvents ───────────────────────────────

    describe('setFolderProjectActionsEvents', () => {
        it('returns silently when folder entries are not in the DOM', () => {
            document.body.innerHTML = '';
            navbar = buildNavbarDOM({ withFolderEntries: false });
            const nav = new NavbarFile({ navbar });
            // Should not throw and entries remain absent.
            expect(() => nav.setFolderProjectActionsEvents()).not.toThrow();
            expect(nav.folderProjectActionItems).toHaveLength(0);
        });

        it('keeps entries hidden when no backing runtime is available and the flag is off', () => {
            const nav = new NavbarFile({ navbar });
            nav.setFolderProjectActionsEvents();
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(true);
            }
        });

        it('reveals entries unconditionally when the feature flag is set', () => {
            window.eXeLearning.config.enableFolderProjects = true;
            const nav = new NavbarFile({ navbar });
            nav.setFolderProjectActionsEvents();
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(false);
            }
        });

        it('toggles visibility on Alt key down/up when a backing runtime is available', () => {
            window.electronAPI = { openProjectFolder: vi.fn() };
            const nav = new NavbarFile({ navbar });
            nav.setFolderProjectActionsEvents();

            // Initially hidden.
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(true);
            }

            // Alt down → visible.
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }));
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(false);
            }

            // Alt up → hidden.
            document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', altKey: false }));
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(true);
            }
        });

        it('reveals entries on Alt keydown even when altKey is unset (Linux regression)', () => {
            // Some Linux builds of Chromium/Firefox dispatch the keydown for
            // Alt itself with `altKey === false`. The reveal must still trigger
            // on the key name alone.
            window.electronAPI = { openProjectFolder: vi.fn() };
            const nav = new NavbarFile({ navbar });
            nav.setFolderProjectActionsEvents();

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: false }));
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(false);
            }
        });

        it('hides entries when the File dropdown closes', () => {
            window.electronAPI = { openProjectFolder: vi.fn() };
            const nav = new NavbarFile({ navbar });
            nav.setFolderProjectActionsEvents();

            // Reveal first.
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(false);
            }

            // Bootstrap fires `hide.bs.dropdown` on the toggle when the menu
            // closes. The previous `window.blur` listener mis-fired on Linux
            // when Alt briefly grabbed focus; this assertion guards against a
            // regression to that approach.
            nav.button.dispatchEvent(new Event('hide.bs.dropdown'));
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(true);
            }
        });

        it('does not hide entries when the window blurs (Linux Alt-tap)', () => {
            window.electronAPI = { openProjectFolder: vi.fn() };
            const nav = new NavbarFile({ navbar });
            nav.setFolderProjectActionsEvents();

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }));
            window.dispatchEvent(new Event('blur'));
            for (const item of nav.folderProjectActionItems) {
                expect(item.classList.contains('d-none')).toBe(false);
            }
        });

        it('wires the Electron click handler when present', () => {
            window.electronAPI = {
                openProjectFolder: vi.fn().mockResolvedValue({ ok: false, canceled: true }),
            };
            const nav = new NavbarFile({ navbar });
            const spy = vi.spyOn(nav, 'openProjectFromFolderEvent').mockResolvedValue();
            nav.setFolderProjectActionsEvents();

            const openButton = navbar.querySelector('#navbar-button-open-folder-offline');
            openButton.dispatchEvent(new Event('click'));
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('wires the Save click handler when present', () => {
            window.electronAPI = { openProjectFolder: vi.fn() };
            const nav = new NavbarFile({ navbar });
            const spy = vi.spyOn(nav, 'saveProjectToFolderEvent').mockResolvedValue();
            nav.setFolderProjectActionsEvents();

            const saveButton = navbar.querySelector('#navbar-button-save-folder-offline');
            saveButton.dispatchEvent(new Event('click'));
            expect(spy).toHaveBeenCalledTimes(1);
        });

        it('skips events when Open iDevice is in progress', () => {
            window.electronAPI = { openProjectFolder: vi.fn() };
            window.eXeLearning.app.project.checkOpenIdevice = vi.fn(() => true);
            const nav = new NavbarFile({ navbar });
            const spy = vi.spyOn(nav, 'openProjectFromFolderEvent').mockResolvedValue();
            nav.setFolderProjectActionsEvents();

            const openButton = navbar.querySelector('#navbar-button-open-folder-offline');
            openButton.dispatchEvent(new Event('click'));
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ─── openProjectFromFolderEvent ──────────────────────────────────

    describe('openProjectFromFolderEvent', () => {
        it('feeds the Electron payload into largeFilesUpload', async () => {
            const base64 = btoa('hello-world');
            window.electronAPI = {
                openProjectFolder: vi.fn().mockResolvedValue({
                    ok: true,
                    base64,
                    suggestedName: 'demo.elpx',
                }),
            };
            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();

            expect(window.electronAPI.openProjectFolder).toHaveBeenCalledTimes(1);
            expect(largeFilesUpload).toHaveBeenCalledTimes(1);
            const file = largeFilesUpload.mock.calls[0][0];
            expect(file).toBeInstanceOf(File);
            expect(file.name).toBe('demo.elpx');
            expect(file.size).toBe('hello-world'.length);
        });

        it('treats Electron cancel silently (no alert, no upload)', async () => {
            window.electronAPI = {
                openProjectFolder: vi.fn().mockResolvedValue({ ok: false, canceled: true }),
            };
            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();
            expect(largeFilesUpload).not.toHaveBeenCalled();
            expect(alertShow).not.toHaveBeenCalled();
        });

        it('shows a friendly message when the folder is not a valid project', async () => {
            window.electronAPI = {
                openProjectFolder: vi.fn().mockResolvedValue({
                    ok: false,
                    error: 'not-a-project-folder',
                }),
            };
            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();
            expect(alertShow).toHaveBeenCalledTimes(1);
            expect(alertShow.mock.calls[0][0].body).toMatch(/not a valid eXeLearning project/);
            expect(largeFilesUpload).not.toHaveBeenCalled();
        });

        it('surfaces unexpected Electron errors via the alert modal', async () => {
            window.electronAPI = {
                openProjectFolder: vi.fn().mockResolvedValue({
                    ok: false,
                    error: 'eperm',
                }),
            };
            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();
            expect(alertShow).toHaveBeenCalledWith(
                expect.objectContaining({ body: 'eperm' })
            );
        });

        it('falls back to the browser File System Access API when Electron is absent', async () => {
            const fakeFile = new File([new Uint8Array([1, 2, 3])], 'browser.elpx');
            const fakeHandle = {};
            window.showDirectoryPicker = vi.fn().mockResolvedValue(fakeHandle);
            // Mock the helper module's openProjectFolderInBrowser by stubbing
            // showDirectoryPicker + a minimal directory handle that yields a
            // single content.xml entry. Easier: monkey-patch the imported
            // helper via the module cache.
            const ProjectFolderStorage = await import('../../../../core/ProjectFolderStorage.js');
            const openSpy = vi.spyOn(ProjectFolderStorage, 'openProjectFolderInBrowser')
                .mockResolvedValue({ file: fakeFile, dirHandle: fakeHandle, format: 'modern', entryCount: 1 });
            // Force feature detection to true so the navbar dispatches to the
            // helper even though happy-dom does not implement showDirectoryPicker.
            vi.spyOn(ProjectFolderStorage, 'supportsFileSystemAccess').mockReturnValue(true);

            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();

            expect(openSpy).toHaveBeenCalledTimes(1);
            expect(largeFilesUpload).toHaveBeenCalledWith(fakeFile);
        });

        it('shows an explicit "not supported" message when neither runtime is present', async () => {
            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();
            expect(alertShow).toHaveBeenCalledTimes(1);
            expect(alertShow.mock.calls[0][0].title).toMatch(/Not supported/i);
        });

        it('swallows AbortError (user dismissed the picker)', async () => {
            window.electronAPI = {
                openProjectFolder: vi.fn().mockRejectedValue(
                    Object.assign(new Error('abort'), { name: 'AbortError' })
                ),
            };
            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();
            expect(alertShow).not.toHaveBeenCalled();
        });

        it('alerts on unexpected exceptions', async () => {
            window.electronAPI = {
                openProjectFolder: vi.fn().mockRejectedValue(new Error('disk on fire')),
            };
            const nav = new NavbarFile({ navbar });
            await nav.openProjectFromFolderEvent();
            expect(alertShow).toHaveBeenCalledWith(
                expect.objectContaining({ body: 'disk on fire' })
            );
        });
    });

    // ─── saveProjectToFolderEvent ───────────────────────────────────

    describe('saveProjectToFolderEvent', () => {
        const successResult = () => ({
            success: true,
            data: new Uint8Array([0x50, 0x4b, 0x05, 0x06]).buffer,
            filename: 'demo.elpx',
        });

        it('alerts when SharedExporters is not loaded', async () => {
            const nav = new NavbarFile({ navbar });
            await nav.saveProjectToFolderEvent();
            expect(alertShow).toHaveBeenCalledWith(
                expect.objectContaining({ body: expect.stringMatching(/Yjs export pipeline/) })
            );
        });

        it('alerts when the Yjs document manager is unavailable', async () => {
            window.SharedExporters = { quickExport: vi.fn() };
            window.eXeLearning.app.project._yjsBridge = null;
            const nav = new NavbarFile({ navbar });
            await nav.saveProjectToFolderEvent();
            expect(alertShow).toHaveBeenCalledWith(
                expect.objectContaining({ body: expect.stringMatching(/Yjs export pipeline/) })
            );
        });

        it('writes via Electron and marks the document clean on success', async () => {
            window.SharedExporters = { quickExport: vi.fn().mockResolvedValue(successResult()) };
            window.electronAPI = { saveProjectFolder: vi.fn().mockResolvedValue({ ok: true, dir: '/tmp/x' }) };

            const nav = new NavbarFile({ navbar });
            const promise = nav.saveProjectToFolderEvent();
            await promise;

            expect(window.SharedExporters.quickExport).toHaveBeenCalledWith(
                'ELPX',
                expect.any(Object),
                null,
                null,
                {},
                null
            );
            expect(window.electronAPI.saveProjectFolder).toHaveBeenCalledTimes(1);
            const [base64, suggestedDir] = window.electronAPI.saveProjectFolder.mock.calls[0];
            expect(typeof base64).toBe('string');
            expect(suggestedDir).toBe('demo');
            expect(docManagerMarkClean).toHaveBeenCalledTimes(1);
            expect(toastBody.innerHTML).toBe('Folder saved.');
        });

        it('exits silently when the Electron save dialog is canceled', async () => {
            window.SharedExporters = { quickExport: vi.fn().mockResolvedValue(successResult()) };
            window.electronAPI = { saveProjectFolder: vi.fn().mockResolvedValue({ ok: false, canceled: true }) };

            const nav = new NavbarFile({ navbar });
            await nav.saveProjectToFolderEvent();

            expect(toast.remove).toHaveBeenCalled();
            expect(docManagerMarkClean).not.toHaveBeenCalled();
            expect(alertShow).not.toHaveBeenCalled();
        });

        it('reports Electron save failures via the alert modal', async () => {
            window.SharedExporters = { quickExport: vi.fn().mockResolvedValue(successResult()) };
            window.electronAPI = { saveProjectFolder: vi.fn().mockResolvedValue({ ok: false, error: 'eperm' }) };

            const nav = new NavbarFile({ navbar });
            await nav.saveProjectToFolderEvent();

            expect(alertShow).toHaveBeenCalledWith(
                expect.objectContaining({ body: 'eperm' })
            );
        });

        it('falls back to the browser File System Access path when Electron is absent', async () => {
            window.SharedExporters = { quickExport: vi.fn().mockResolvedValue(successResult()) };
            const ProjectFolderStorage = await import('../../../../core/ProjectFolderStorage.js');
            const browserSpy = vi.spyOn(ProjectFolderStorage, 'saveProjectFolderInBrowser')
                .mockResolvedValue({ entryCount: 1 });
            vi.spyOn(ProjectFolderStorage, 'supportsFileSystemAccess').mockReturnValue(true);

            const nav = new NavbarFile({ navbar });
            await nav.saveProjectToFolderEvent();

            expect(browserSpy).toHaveBeenCalledTimes(1);
            expect(docManagerMarkClean).toHaveBeenCalledTimes(1);
        });

        it('reports SharedExporters failures', async () => {
            window.SharedExporters = {
                quickExport: vi.fn().mockResolvedValue({ success: false, error: 'boom' }),
            };
            window.electronAPI = { saveProjectFolder: vi.fn() };

            const nav = new NavbarFile({ navbar });
            await nav.saveProjectToFolderEvent();

            expect(alertShow).toHaveBeenCalledWith(
                expect.objectContaining({ body: 'boom' })
            );
            expect(docManagerMarkClean).not.toHaveBeenCalled();
        });

        it('swallows AbortError thrown by the picker', async () => {
            window.SharedExporters = { quickExport: vi.fn().mockResolvedValue(successResult()) };
            const ProjectFolderStorage = await import('../../../../core/ProjectFolderStorage.js');
            vi.spyOn(ProjectFolderStorage, 'supportsFileSystemAccess').mockReturnValue(true);
            vi.spyOn(ProjectFolderStorage, 'saveProjectFolderInBrowser')
                .mockRejectedValue(Object.assign(new Error('abort'), { name: 'AbortError' }));

            const nav = new NavbarFile({ navbar });
            await nav.saveProjectToFolderEvent();

            expect(toast.remove).toHaveBeenCalled();
            expect(alertShow).not.toHaveBeenCalled();
        });
    });
});

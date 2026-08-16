import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectFolderActionsMixin } from './projectFolderActions.js';

class FakeModalBase {
    show() {}
}

class TestHost extends ProjectFolderActionsMixin(FakeModalBase) {
    constructor() {
        super();
        this.modal = this;
        this.folders = [];
        this.currentFolderUuid = null;
        this.UNFILED_FOLDER_VALUE = '__unfiled__';
        this.refreshList = vi.fn().mockResolvedValue();
        this.applyFolderFilter = vi.fn();
        this._renderFolderTree = vi.fn();
    }
}

describe('ProjectFolderActionsMixin', () => {
    let host;

    beforeEach(() => {
        window.eXeLearning.app = {
            api: {
                createProjectFolder: vi
                    .fn()
                    .mockResolvedValue({ success: true, folder: { uuid: 'folder-new', name: 'New Folder', projectCount: 0 } }),
                renameProjectFolder: vi
                    .fn()
                    .mockResolvedValue({ success: true, folder: { uuid: 'folder-1', name: 'Renamed', projectCount: 0 } }),
                deleteProjectFolder: vi.fn().mockResolvedValue({ success: true }),
            },
            modals: {
                alert: { show: vi.fn() },
                confirm: {
                    modalElement: document.createElement('div'),
                    show: vi.fn(function (data) {
                        // Simulate ModalConfirm.setBody(): render the body HTML so
                        // confirmExec can query the input(s) it created.
                        if (data && data.body) {
                            this.modalElement.innerHTML = data.body;
                        }
                    }),
                },
            },
        };
        host = new TestHost();
    });

    describe('_escapeHtml', () => {
        it('escapes HTML-significant characters', () => {
            expect(host._escapeHtml('<img src=x onerror=alert(1)>')).not.toContain('<img src=x');
        });
    });

    describe('_foldersExcludingSubtree', () => {
        beforeEach(() => {
            host.folders = [
                { uuid: 'root', name: 'Root', depth: 0 },
                { uuid: 'child', name: 'Child', depth: 1 },
                { uuid: 'grandchild', name: 'Grandchild', depth: 2 },
                { uuid: 'other-root', name: 'Other Root', depth: 0 },
            ];
        });

        it('returns every folder unchanged when excludeUuid is null', () => {
            expect(host._foldersExcludingSubtree(null)).toEqual(host.folders);
        });

        it('excludes a folder and its whole subtree', () => {
            const result = host._foldersExcludingSubtree('root');
            expect(result.map((f) => f.uuid)).toEqual(['other-root']);
        });

        it('excludes only the leaf when it has no descendants', () => {
            const result = host._foldersExcludingSubtree('grandchild');
            expect(result.map((f) => f.uuid)).toEqual(['root', 'child', 'other-root']);
        });

        it('returns every folder unchanged when excludeUuid is not found', () => {
            expect(host._foldersExcludingSubtree('missing')).toEqual(host.folders);
        });
    });

    describe('_buildParentFolderSelectHtml', () => {
        it('always includes a "no parent" option', () => {
            host.folders = [];
            const html = host._buildParentFolderSelectHtml('select-id', null);
            const container = document.createElement('div');
            container.innerHTML = html;
            const options = container.querySelectorAll('option');
            expect(options.length).toBe(1);
            expect(options[0].value).toBe('');
            expect(options[0].selected).toBe(true);
        });

        it('indents candidate folders and preselects the given uuid', () => {
            host.folders = [
                { uuid: 'root', name: 'Root', depth: 0 },
                { uuid: 'child', name: 'Child', depth: 1 },
            ];
            const html = host._buildParentFolderSelectHtml('select-id', 'child');
            const container = document.createElement('div');
            container.innerHTML = html;
            const options = container.querySelectorAll('option');
            expect(options.length).toBe(3);
            expect(options[2].value).toBe('child');
            expect(options[2].hasAttribute('selected')).toBe(true);
            expect(options[2].textContent).toBe('  Child');
        });

        it('escapes folder names to avoid HTML injection', () => {
            host.folders = [{ uuid: 'f1', name: '<img src=x onerror=alert(1)>', depth: 0 }];
            const html = host._buildParentFolderSelectHtml('select-id', null);
            expect(html).not.toContain('<img src=x');
        });

        it('excludes the given folder and its subtree from the candidates', () => {
            host.folders = [
                { uuid: 'root', name: 'Root', depth: 0 },
                { uuid: 'child', name: 'Child', depth: 1 },
            ];
            const html = host._buildParentFolderSelectHtml('select-id', null, 'root');
            const container = document.createElement('div');
            container.innerHTML = html;
            expect(container.querySelectorAll('option')).toHaveLength(1);
        });
    });

    describe('promptCreateFolder', () => {
        it('creates the folder with the trimmed input value on confirm', async () => {
            const createSpy = vi.spyOn(host, 'createFolder').mockResolvedValue();
            host.promptCreateFolder();
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];
            window.eXeLearning.app.modals.confirm.modalElement.querySelector('#input-new-ode-folder').value = '  Math  ';
            await config.confirmExec();
            expect(createSpy).toHaveBeenCalledWith('Math', null);
        });

        it('does not create a folder for a blank name', async () => {
            const createSpy = vi.spyOn(host, 'createFolder').mockResolvedValue();
            host.promptCreateFolder();
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];
            window.eXeLearning.app.modals.confirm.modalElement.querySelector('#input-new-ode-folder').value = '   ';
            await config.confirmExec();
            expect(createSpy).not.toHaveBeenCalled();
        });

        it('re-shows the dashboard modal when cancelled or closed', () => {
            // Regression test: modalConfirm.show() closes every other open
            // modal; only a successful confirmExec used to re-show it, so
            // Cancel/Escape/backdrop-click left the dashboard modal closed.
            const showSpy = vi.spyOn(host, 'show');
            host.promptCreateFolder();
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];

            config.cancelExec();
            expect(showSpy).toHaveBeenCalled();

            showSpy.mockClear();
            config.closeExec();
            expect(showSpy).toHaveBeenCalled();
        });
    });

    describe('createFolder', () => {
        it('refreshes the list and selects the new folder on success', async () => {
            await host.createFolder('Math');
            expect(window.eXeLearning.app.api.createProjectFolder).toHaveBeenCalledWith('Math', null);
            expect(host.refreshList).toHaveBeenCalled();
            expect(host.applyFolderFilter).toHaveBeenCalledWith('folder-new');
        });

        it('shows an alert and does not refresh on failure', async () => {
            window.eXeLearning.app.api.createProjectFolder.mockResolvedValueOnce({
                success: false,
                message: 'A folder with this name already exists',
            });
            await host.createFolder('Dup');
            expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            expect(host.refreshList).not.toHaveBeenCalled();
        });
    });

    describe('promptRenameFolder', () => {
        it('does nothing when no folder is given', () => {
            host.promptRenameFolder(null);
            expect(window.eXeLearning.app.modals.confirm.show).not.toHaveBeenCalled();
        });

        it('renames the folder with the trimmed input value on confirm', async () => {
            const folder = { uuid: 'f1', name: 'Old Name', parentUuid: null, depth: 0, projectCount: 0 };
            const renameSpy = vi.spyOn(host, 'renameFolder').mockResolvedValue();

            host.promptRenameFolder(folder);
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];
            window.eXeLearning.app.modals.confirm.modalElement.querySelector('#input-rename-ode-folder').value =
                '  New Name  ';
            await config.confirmExec();

            expect(renameSpy).toHaveBeenCalledWith('f1', 'New Name', null);
        });

        it('re-shows the dashboard modal when cancelled or closed', () => {
            const folder = { uuid: 'f1', name: 'Old Name', parentUuid: null, depth: 0, projectCount: 0 };
            const showSpy = vi.spyOn(host, 'show');
            host.promptRenameFolder(folder);
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];

            config.cancelExec();
            expect(showSpy).toHaveBeenCalled();

            showSpy.mockClear();
            config.closeExec();
            expect(showSpy).toHaveBeenCalled();
        });
    });

    describe('renameFolder', () => {
        it('refreshes the list and reselects the folder on success', async () => {
            await host.renameFolder('f1', 'New Name');
            expect(window.eXeLearning.app.api.renameProjectFolder).toHaveBeenCalledWith('f1', 'New Name', undefined);
            expect(host.refreshList).toHaveBeenCalled();
            expect(host.applyFolderFilter).toHaveBeenCalledWith('f1');
        });

        it('shows an alert on failure', async () => {
            window.eXeLearning.app.api.renameProjectFolder.mockResolvedValueOnce({ success: false, message: 'Nope' });
            await host.renameFolder('f1', 'New Name');
            expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        });
    });

    describe('confirmDeleteFolder', () => {
        it('does nothing when no folder is given', () => {
            host.confirmDeleteFolder(null);
            expect(window.eXeLearning.app.modals.confirm.show).not.toHaveBeenCalled();
        });

        it('deletes the given folder on confirm', async () => {
            const deleteSpy = vi.spyOn(host, 'deleteFolderAction').mockResolvedValue();
            host.confirmDeleteFolder({ uuid: 'f1', name: 'Doomed' });
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];
            await config.confirmExec();
            expect(deleteSpy).toHaveBeenCalledWith('f1');
        });

        it('re-shows the dashboard modal when cancelled or closed', () => {
            const showSpy = vi.spyOn(host, 'show');
            host.confirmDeleteFolder({ uuid: 'f1', name: 'Doomed' });
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];

            config.cancelExec();
            expect(showSpy).toHaveBeenCalled();

            showSpy.mockClear();
            config.closeExec();
            expect(showSpy).toHaveBeenCalled();
        });
    });

    describe('deleteFolderAction', () => {
        it('refreshes the list and resets the filter to "All projects" on success', async () => {
            await host.deleteFolderAction('f1');
            expect(window.eXeLearning.app.api.deleteProjectFolder).toHaveBeenCalledWith('f1');
            expect(host.refreshList).toHaveBeenCalled();
            expect(host.applyFolderFilter).toHaveBeenCalledWith('');
        });

        it('shows an alert on failure', async () => {
            window.eXeLearning.app.api.deleteProjectFolder.mockResolvedValueOnce({ success: false, message: 'Nope' });
            await host.deleteFolderAction('f1');
            expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
        });
    });
});

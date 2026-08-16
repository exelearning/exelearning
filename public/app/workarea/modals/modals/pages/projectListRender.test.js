import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectListRenderMixin } from './projectListRender.js';

// Minimal stand-in for the Modal base class, providing only what the mixin
// itself needs to be instantiated (no real modal chrome).
class FakeModalBase {
    close() {}
}

class TestHost extends ProjectListRenderMixin(FakeModalBase) {
    constructor() {
        super();
        this.modalElementBodyContent = document.createElement('div');
        this.modalElement = document.createElement('div');
        this.confirmButton = document.createElement('button');
        this.odeFiles = [];
        this.currentTab = 'my-projects';
        this.currentFolderUuid = null;
        this.UNFILED_FOLDER_VALUE = '__unfiled__';
        this.selectedProjectUuid = null;
        this.timeMax = 0;
        this.allOdeFilesData = null;
        this.removeDeleteButtonFooter = vi.fn();
        this.setBodyElement = vi.fn();
        this.typesetTitles = vi.fn();
        this.updateDeleteButtonState = vi.fn();
        this.updateSelectAllCheckbox = vi.fn();
        this.renameOdeFileEvent = vi.fn();
        this.duplicateOdeFileEvent = vi.fn();
        this.showInlineDeleteConfirmation = vi.fn();
        this.openUserOdeFilesEvent = vi.fn();
        this.setConfirmExec = vi.fn();
        this.folders = [];
        this.folderTreeContainer = null;
        this.expandedFolderUuids = new Set();
        this.modal = { show: vi.fn() };
    }
}

function makeOde(overrides = {}) {
    return {
        odeId: 'ode-1',
        fileName: 'my-project',
        title: 'My Project',
        role: 'owner',
        versionName: '0',
        sizeFormatted: '1 KB',
        updatedAt: '2026-01-01T00:00:00.000Z',
        visibility: 'private',
        isManualSave: true,
        folderId: null,
        ...overrides,
    };
}

describe('ProjectListRenderMixin', () => {
    let host;

    beforeEach(() => {
        host = new TestHost();
    });

    describe('matchesFolderFilter', () => {
        it('matches everything when no folder filter is active', () => {
            expect(host.matchesFolderFilter(makeOde({ folderId: 'folder-1' }))).toBe(true);
            expect(host.matchesFolderFilter(makeOde({ folderId: null }))).toBe(true);
        });

        it('matches only unfiled projects for the unfiled sentinel', () => {
            host.currentFolderUuid = host.UNFILED_FOLDER_VALUE;
            expect(host.matchesFolderFilter(makeOde({ folderId: null }))).toBe(true);
            expect(host.matchesFolderFilter(makeOde({ folderId: 'folder-1' }))).toBe(false);
        });

        it('matches only the selected folder', () => {
            host.currentFolderUuid = 'folder-1';
            expect(host.matchesFolderFilter(makeOde({ folderId: 'folder-1' }))).toBe(true);
            expect(host.matchesFolderFilter(makeOde({ folderId: 'folder-2' }))).toBe(false);
        });
    });

    describe('getEmptyStateMessage', () => {
        it('varies by folder filter and tab', () => {
            host.currentFolderUuid = host.UNFILED_FOLDER_VALUE;
            expect(host.getEmptyStateMessage()).toBe('No unfiled projects.');

            host.currentFolderUuid = 'folder-1';
            expect(host.getEmptyStateMessage()).toBe('No projects in this folder.');

            host.currentFolderUuid = null;
            host.currentTab = 'my-projects';
            expect(host.getEmptyStateMessage()).toBe('No recent projects found.');

            host.currentTab = 'shared-with-me';
            expect(host.getEmptyStateMessage()).toBe('No projects have been shared with you yet.');
        });
    });

    describe('makeElementListOdeFiles', () => {
        it('renders an empty-state alert when there is no data', () => {
            const el = host.makeElementListOdeFiles(null);
            expect(el.className).toContain('alert-info');
        });

        it('renders an empty-state alert when the folder filter matches nothing', () => {
            host.currentFolderUuid = 'folder-1';
            const el = host.makeElementListOdeFiles({
                odeFilesSync: { a: makeOde({ folderId: 'folder-2' }) },
            });
            expect(el.className).toContain('alert-info');
        });

        it('renders a grouped project list when data matches the current tab/folder', () => {
            const el = host.makeElementListOdeFiles({
                odeFilesSync: { a: makeOde() },
            });
            expect(el.classList.contains('ode-files-list-container')).toBe(true);
            expect(el.querySelectorAll('.ode-group').length).toBe(1);
        });
    });

    describe('renderOdeRow', () => {
        it('renders a delete button only for owned projects', () => {
            const ownedRow = host.renderOdeRow(makeOde({ role: 'owner' }), { principal: true }, false);
            expect(ownedRow.querySelector('.open-user-ode-file-action-delete')).toBeTruthy();

            const sharedRow = host.renderOdeRow(makeOde({ role: 'viewer' }), { principal: true }, false);
            expect(sharedRow.querySelector('.open-user-ode-file-action-delete')).toBeFalsy();
        });

        it('selects the project and calls the _onProjectSelected hook on click', () => {
            const row = host.renderOdeRow(makeOde(), { principal: true }, false);
            const onSelectedSpy = vi.spyOn(host, '_onProjectSelected');
            row.dispatchEvent(new Event('click', { bubbles: true }));

            expect(host.selectedProjectUuid).toBe('ode-1');
            expect(onSelectedSpy).toHaveBeenCalledWith('ode-1');
        });
    });

    describe('_rerenderList', () => {
        it('clears selection and delegates to setBodyElement with the rendered list', () => {
            host.odeFiles = ['ode-1'];
            host._rerenderList();

            expect(host.odeFiles).toEqual([]);
            expect(host.removeDeleteButtonFooter).toHaveBeenCalled();
            expect(host.setBodyElement).toHaveBeenCalled();
            expect(host.typesetTitles).toHaveBeenCalled();
        });
    });

    describe('default hook implementations', () => {
        // These hooks exist so a host can customize the shared confirm-button
        // behavior without forking the methods that call them. modalOpenUserOdeFiles
        // ("Abrir") overrides all of them; these tests cover the safe defaults
        // a host gets for free if it doesn't (as "Gestionar proyectos" mostly won't).
        it('_onProjectSelected does nothing by default', () => {
            expect(() => host._onProjectSelected('ode-1')).not.toThrow();
        });

        it('_resetConfirmButtonToDefault just disables the button by default', () => {
            host.confirmButton.disabled = false;
            host._resetConfirmButtonToDefault();
            expect(host.confirmButton.disabled).toBe(true);
            expect(host.confirmButton.classList.contains('disabled')).toBe(true);
        });

        it('_isDraggableFolderTree is false by default', () => {
            expect(host._isDraggableFolderTree()).toBe(false);
        });

        it('_afterFolderTreeRender does nothing by default', () => {
            expect(() => host._afterFolderTreeRender(document.createElement('div'))).not.toThrow();
        });
    });

    describe('makeFolderTree / _renderFolderTree / applyFolderFilter', () => {
        it('builds a tree honoring _isDraggableFolderTree and calls _afterFolderTreeRender', () => {
            host.folders = [{ uuid: 'f1', name: 'Math', parentUuid: null, depth: 0, projectCount: 0 }];
            const afterSpy = vi.spyOn(host, '_afterFolderTreeRender');
            const wrap = host.makeFolderTree();

            const row = wrap.querySelector('[data-folder-value="f1"] .project-folder-tree-row');
            expect(row.getAttribute('draggable')).toBeNull(); // _isDraggableFolderTree() is false by default
            expect(afterSpy).toHaveBeenCalled();
        });

        it('applyFolderFilter updates currentFolderUuid and re-renders the tree and list', () => {
            host.allOdeFilesData = { odeFilesSync: {} };
            host.makeFolderTree();
            const rerenderSpy = vi.spyOn(host, '_rerenderList');

            host.applyFolderFilter('f1');

            expect(host.currentFolderUuid).toBe('f1');
            expect(rerenderSpy).toHaveBeenCalled();
        });
    });

    describe('makeFolderSidebar', () => {
        it('wraps the folder tree into a .modal-dashboard-sidebar', () => {
            const sidebar = host.makeFolderSidebar();
            expect(sidebar.classList.contains('modal-dashboard-sidebar')).toBe(true);
            expect(sidebar.querySelector('.project-folder-tree-wrap')).toBeTruthy();
        });

        it('appends optional extra content after the tree', () => {
            const extra = document.createElement('button');
            extra.className = 'probe-extra';
            const sidebar = host.makeFolderSidebar(extra);
            expect(sidebar.querySelector('.probe-extra')).toBe(extra);
            expect(sidebar.lastElementChild).toBe(extra);
        });
    });

    describe('showFolderPicker / closeFolderPicker / moveProjectToFolder', () => {
        // Regression coverage: this trio previously lived only on
        // modalOpenUserOdeFiles.js even though renderOdeRow() (shared) wires
        // every project row's move button to this.showFolderPicker(...) —
        // modalManageProjects.js never got its own copy, so clicking "Move to
        // folder" on a project row in "Gestionar proyectos" silently threw
        // (this.showFolderPicker is not a function) and did nothing visible.
        it('renders unfiled plus each folder, marking the current one selected', () => {
            host.folders = [
                { uuid: 'f1', name: 'Math', projectCount: 1 },
                { uuid: 'f2', name: 'Science', projectCount: 0 },
            ];
            const anchor = document.createElement('button');
            const wrap = document.createElement('div');
            wrap.append(anchor);
            document.body.append(wrap);

            host.showFolderPicker(anchor, { odeId: 'a', folderId: 'f1' });

            // Portalled to document.body (see showFolderPicker's doc
            // comment), not appended next to the anchor button.
            const options = document.querySelectorAll('.ode-folder-picker-option');
            expect(options.length).toBe(3); // Unfiled + 2 folders
            expect(options[1].classList.contains('selected')).toBe(true); // Math is current
            host.closeFolderPicker();
        });

        it('moveProjectToFolder calls the API and refreshes the list on success', async () => {
            const assignProjectFolder = vi.fn().mockResolvedValue({ success: true });
            window.eXeLearning.app = { api: { assignProjectFolder } };
            const refreshSpy = vi.spyOn(host, 'refreshList').mockResolvedValue();

            await host.moveProjectToFolder('ode-1', 'f2');

            expect(assignProjectFolder).toHaveBeenCalledWith('ode-1', 'f2');
            expect(refreshSpy).toHaveBeenCalled();
        });

        it('moveProjectToFolder shows an alert and does not refresh on failure', async () => {
            const alertShow = vi.fn();
            window.eXeLearning.app = {
                api: { assignProjectFolder: vi.fn().mockResolvedValue({ success: false, message: 'nope' }) },
                modals: { alert: { show: alertShow } },
            };
            const refreshSpy = vi.spyOn(host, 'refreshList').mockResolvedValue();

            await host.moveProjectToFolder('ode-1', 'f2');

            expect(alertShow).toHaveBeenCalledWith(expect.objectContaining({ body: 'nope' }));
            expect(refreshSpy).not.toHaveBeenCalled();
        });

        it('closeFolderPicker removes the open picker, if any', () => {
            host.folders = [];
            const anchor = document.createElement('button');
            const wrap = document.createElement('div');
            wrap.append(anchor);
            document.body.append(wrap);

            host.showFolderPicker(anchor, { odeId: 'a', folderId: null });
            expect(document.querySelector('.ode-folder-picker')).toBeTruthy();

            host.closeFolderPicker();
            expect(document.querySelector('.ode-folder-picker')).toBeNull();
        });

        it('close() also closes any open folder picker', () => {
            // Regression coverage: the picker is portalled to document.body
            // (see showFolderPicker's doc comment), so closing the modal
            // wouldn't hide it along with the rest of the modal's DOM
            // subtree unless close() explicitly closes it too.
            host.folders = [];
            const anchor = document.createElement('button');
            document.body.append(anchor);

            host.showFolderPicker(anchor, { odeId: 'a', folderId: null });
            expect(document.querySelector('.ode-folder-picker')).toBeTruthy();

            host.close();

            expect(document.querySelector('.ode-folder-picker')).toBeNull();
        });
    });

    describe('refreshList', () => {
        it('updates folders/tabs/list and resets selection on success', async () => {
            window.eXeLearning.app = {
                api: {
                    getUserOdeFiles: vi.fn().mockResolvedValue({
                        odeFiles: { odeFilesSync: {}, folders: [{ uuid: 'f1', name: 'Math', parentUuid: null, depth: 0, projectCount: 0 }] },
                    }),
                },
            };
            host.makeFolderTree();
            host.selectedProjectUuid = 'ode-1';
            const resetSpy = vi.spyOn(host, '_resetConfirmButtonToDefault');

            await host.refreshList();

            expect(host.folders).toEqual([{ uuid: 'f1', name: 'Math', parentUuid: null, depth: 0, projectCount: 0 }]);
            expect(host.selectedProjectUuid).toBeNull();
            expect(resetSpy).toHaveBeenCalled();
            expect(host.removeDeleteButtonFooter).toHaveBeenCalled();
        });

        it('logs an error and does not throw on failure', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            window.eXeLearning.app = { api: { getUserOdeFiles: vi.fn().mockRejectedValue(new Error('network')) } };

            await host.refreshList();

            expect(errorSpy).toHaveBeenCalled();
        });
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildProjectFolderTree } from './projectTreeCompose.js';
import { ProjectFolderActionsMixin } from './projectFolderActions.js';
import { attachManageProjectsTreeActions, promptMoveFolder, moveFolderToParent } from './manageProjectsTreeActions.js';

const UNFILED = '__unfiled__';

class FakeModalBase {
    show() {}
}

class TestHost extends ProjectFolderActionsMixin(FakeModalBase) {
    constructor() {
        super();
        this.modal = this;
        this.folders = [
            { uuid: 'root', name: 'Root', parentUuid: null, depth: 0, projectCount: 0 },
            { uuid: 'child', name: 'Child', parentUuid: 'root', depth: 1, projectCount: 0 },
        ];
        this.UNFILED_FOLDER_VALUE = UNFILED;
        this.refreshList = vi.fn().mockResolvedValue();
        this.applyFolderFilter = vi.fn();
    }
}

function mountTree(host) {
    const root = buildProjectFolderTree({
        folders: host.folders,
        selectedValue: '',
        unfiledValue: UNFILED,
        expandedUuids: new Set(['root']),
        draggable: true,
    });
    document.body.append(root);
    return root;
}

describe('manageProjectsTreeActions', () => {
    let host;

    beforeEach(() => {
        window.eXeLearning.app = {
            api: {
                renameProjectFolder: vi
                    .fn()
                    .mockResolvedValue({ success: true, folder: { uuid: 'root', name: 'Root', projectCount: 0 } }),
            },
            modals: {
                alert: { show: vi.fn() },
                confirm: {
                    modalElement: document.createElement('div'),
                    show: vi.fn(function (data) {
                        if (data && data.body) {
                            this.modalElement.innerHTML = data.body;
                        }
                    }),
                },
            },
        };
        host = new TestHost();
    });

    describe('attachManageProjectsTreeActions', () => {
        it('makes real folder rows draggable but not the pseudo-items', () => {
            const root = mountTree(host);
            attachManageProjectsTreeActions(root, host);

            expect(root.querySelector('[data-folder-value="root"] .project-folder-tree-row').getAttribute('draggable')).toBe(
                'true',
            );
            expect(root.querySelector('[data-folder-value=""] .project-folder-tree-row').getAttribute('draggable')).toBeNull();
            expect(
                root.querySelector(`[data-folder-value="${UNFILED}"] .project-folder-tree-row`).getAttribute('draggable'),
            ).toBeNull();
        });

        it('adds Move/Rename/Delete buttons only to real folder rows', () => {
            const root = mountTree(host);
            attachManageProjectsTreeActions(root, host);

            for (const cls of ['move', 'rename', 'delete']) {
                expect(
                    root.querySelector(`[data-folder-value="root"] .project-folder-tree-${cls}-button`),
                ).toBeTruthy();
                expect(
                    root.querySelector(`[data-folder-value=""] .project-folder-tree-${cls}-button`),
                ).toBeFalsy();
            }
        });

        it('clicking the rename button opens the rename dialog for that folder', () => {
            const root = mountTree(host);
            attachManageProjectsTreeActions(root, host);
            const renameSpy = vi.spyOn(host, 'promptRenameFolder');

            root.querySelector('[data-folder-value="child"] .project-folder-tree-rename-button').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );

            expect(renameSpy).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'child' }));
        });

        it('clicking the delete button opens the delete confirmation for that folder', () => {
            const root = mountTree(host);
            attachManageProjectsTreeActions(root, host);
            const deleteSpy = vi.spyOn(host, 'confirmDeleteFolder');

            root.querySelector('[data-folder-value="root"] .project-folder-tree-delete-button').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );

            expect(deleteSpy).toHaveBeenCalledWith(expect.objectContaining({ uuid: 'root' }));
        });

        it('dragging a folder onto another folder moves it there', async () => {
            const root = mountTree(host);
            attachManageProjectsTreeActions(root, host);

            const draggedRow = root.querySelector('[data-folder-value="child"] .project-folder-tree-row');
            const targetRow = root.querySelector('[data-folder-value=""] .project-folder-tree-row');

            draggedRow.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
            targetRow.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
            expect(targetRow.classList.contains('drag-over')).toBe(true);

            await draggedRow.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
            // dragend's handler is async; flush microtasks
            await Promise.resolve();
            await Promise.resolve();

            expect(window.eXeLearning.app.api.renameProjectFolder).toHaveBeenCalledWith('child', undefined, null);
            expect(host.refreshList).toHaveBeenCalled();
        });

        it('dropping onto the Unfiled pseudo-item does not trigger a move', async () => {
            const root = mountTree(host);
            attachManageProjectsTreeActions(root, host);

            const draggedRow = root.querySelector('[data-folder-value="root"] .project-folder-tree-row');
            const unfiledRow = root.querySelector(`[data-folder-value="${UNFILED}"] .project-folder-tree-row`);

            draggedRow.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
            unfiledRow.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }));
            expect(unfiledRow.classList.contains('drag-over')).toBe(false);

            await draggedRow.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
            await Promise.resolve();

            expect(window.eXeLearning.app.api.renameProjectFolder).not.toHaveBeenCalled();
        });

        it('clicking "Move to…" opens a dialog that moves the folder on confirm', async () => {
            const root = mountTree(host);
            attachManageProjectsTreeActions(root, host);

            root.querySelector('[data-folder-value="child"] .project-folder-tree-move-button').dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            );

            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];
            const select = window.eXeLearning.app.modals.confirm.modalElement.querySelector(
                '#select-move-ode-folder-parent',
            );
            select.value = '';
            await config.confirmExec();

            expect(window.eXeLearning.app.api.renameProjectFolder).toHaveBeenCalledWith('child', undefined, null);
        });
    });

    describe('promptMoveFolder', () => {
        it('excludes the folder\'s own subtree from the destination choices', () => {
            promptMoveFolder(host, { uuid: 'root', name: 'Root', parentUuid: null });
            const html = window.eXeLearning.app.modals.confirm.modalElement.innerHTML;
            expect(html).not.toContain('value="child"');
        });

        it('re-shows the dashboard modal when cancelled or closed', () => {
            // Regression test: modalConfirm.show() closes every other open
            // modal; only a successful confirmExec used to re-show it, so
            // Cancel/Escape/backdrop-click left the dashboard modal closed.
            const showSpy = vi.spyOn(host, 'show');
            promptMoveFolder(host, { uuid: 'root', name: 'Root', parentUuid: null });
            const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];

            config.cancelExec();
            expect(showSpy).toHaveBeenCalled();

            showSpy.mockClear();
            config.closeExec();
            expect(showSpy).toHaveBeenCalled();
        });
    });

    describe('moveFolderToParent', () => {
        it('shows an alert and does not refresh on failure', async () => {
            window.eXeLearning.app.api.renameProjectFolder.mockResolvedValueOnce({ success: false, message: 'Nope' });
            await moveFolderToParent(host, 'child', 'root');
            expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
            expect(host.refreshList).not.toHaveBeenCalled();
        });
    });
});

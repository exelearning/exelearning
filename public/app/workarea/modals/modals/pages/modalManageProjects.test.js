import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import modalManageProjects from './modalManageProjects.js';

describe('modalManageProjects', () => {
    let modal;
    let mockManager;
    let mockElement;
    let mockBootstrapModal;

    beforeEach(() => {
        window._ = vi.fn((key) => key);

        window.eXeLearning = {
            app: {
                api: {
                    getUserOdeFiles: vi.fn().mockResolvedValue({ odeFiles: { odeFilesSync: {} } }),
                    getProjectFolders: vi.fn().mockResolvedValue({ success: true, folders: [] }),
                    createProjectFolder: vi
                        .fn()
                        .mockResolvedValue({ success: true, folder: { uuid: 'folder-new', name: 'New Folder', projectCount: 0 } }),
                    renameProjectFolder: vi.fn().mockResolvedValue({ success: true, folder: { uuid: 'f1', name: 'Renamed', projectCount: 0 } }),
                    deleteProjectFolder: vi.fn().mockResolvedValue({ success: true }),
                    assignProjectFolder: vi.fn().mockResolvedValue({ success: true }),
                    renameProject: vi.fn().mockResolvedValue({ success: true }),
                    duplicateProject: vi.fn().mockResolvedValue({ success: true }),
                    deleteProject: vi.fn().mockResolvedValue({ success: true }),
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
                config: {},
            },
            config: { isOfflineInstallation: false },
        };

        mockElement = document.createElement('div');
        mockElement.id = 'modalManageProjects';
        mockElement.innerHTML = `
      <button class="move-selected-button btn button-secondary d-none">Move to folder</button>
      <button class="confirm btn btn-primary d-none">Delete</button>
      <div class="modal-header"><h5 class="modal-title"></h5></div>
      <div class="modal-body">
        <div class="modal-body-content"></div>
      </div>
      <div class="modal-footer"></div>
    `;
        document.body.appendChild(mockElement);

        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'modalManageProjects') return mockElement;
            return null;
        });

        mockBootstrapModal = { show: vi.fn(), hide: vi.fn() };
        window.bootstrap = {
            Modal: vi.fn().mockImplementation(function () {
                return mockBootstrapModal;
            }),
        };

        const mockInteractable = { draggable: vi.fn().mockReturnThis() };
        window.interact = vi.fn().mockImplementation(() => mockInteractable);
        window.interact.modifiers = { restrictRect: vi.fn() };

        mockManager = { closeModals: vi.fn(() => false) };

        modal = new modalManageProjects(mockManager);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('initializes dashboard/folder state with no project selected', () => {
            expect(modal.currentTab).toBe('my-projects');
            expect(modal.selectedProjectUuid).toBeNull();
            expect(modal.folders).toEqual([]);
            expect(modal.currentFolderUuid).toBeNull();
            expect(modal.expandedFolderUuids).toEqual(new Set());
        });
    });

    describe('show', () => {
        it('fetches projects/folders, renders the body, and shows the modal', async () => {
            window.eXeLearning.app.api.getUserOdeFiles.mockResolvedValueOnce({
                odeFiles: { odeFilesSync: {}, folders: [{ uuid: 'f1', name: 'Math', parentUuid: null, depth: 0, projectCount: 0 }] },
            });

            modal.show();
            await vi.waitFor(() => expect(modal.folders).toEqual([{ uuid: 'f1', name: 'Math', parentUuid: null, depth: 0, projectCount: 0 }]));

            expect(mockBootstrapModal.show).toHaveBeenCalled();
            expect(modal.modalElementBodyContent.querySelector('.project-folder-tree')).toBeTruthy();
            expect(modal.modalElementBodyContent.querySelector('.ode-project-tabs')).toBeTruthy();
        });
    });

    describe('setBodyElement', () => {
        it('appends the given element to the modal body content', () => {
            const el = document.createElement('div');
            el.className = 'probe';
            modal.setBodyElement(el);
            expect(modal.modalElementBodyContent.querySelector('.probe')).toBe(el);
        });
    });

    describe('makeModalActions', () => {
        it('includes tabs and the search filter', () => {
            const actions = modal.makeModalActions();
            expect(actions.querySelector('.ode-project-tabs')).toBeTruthy();
            expect(actions.querySelector('.ode-filter-input')).toBeTruthy();
        });
    });

    describe('folder sidebar', () => {
        it('makeFolderSidebar includes the tree and the "New folder" button', () => {
            const sidebar = modal.makeFolderSidebar(modal._makeNewFolderButton());
            expect(sidebar.classList.contains('modal-dashboard-sidebar')).toBe(true);
            expect(sidebar.querySelector('.project-folder-tree')).toBeTruthy();
            expect(sidebar.querySelector('.ode-new-folder-button')).toBeTruthy();
        });

        it('wires the "New folder" button to promptCreateFolder', () => {
            const promptSpy = vi.spyOn(modal, 'promptCreateFolder').mockImplementation(() => {});
            const newFolderBtn = modal._makeNewFolderButton();
            newFolderBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(promptSpy).toHaveBeenCalled();
        });
    });

    describe('folder tree drag-and-drop wiring', () => {
        it('_isDraggableFolderTree is true (unlike "Abrir")', () => {
            expect(modal._isDraggableFolderTree()).toBe(true);
        });

        it('renders folder rows as draggable with move/rename/delete buttons', () => {
            modal.folders = [{ uuid: 'f1', name: 'Math', parentUuid: null, depth: 0, projectCount: 0 }];
            const wrap = modal.makeFolderTree();
            const row = wrap.querySelector('[data-folder-value="f1"] .project-folder-tree-row');

            expect(row.getAttribute('draggable')).toBe('true');
            expect(wrap.querySelector('[data-folder-value="f1"] .project-folder-tree-move-button')).toBeTruthy();
            expect(wrap.querySelector('[data-folder-value="f1"] .project-folder-tree-rename-button')).toBeTruthy();
            expect(wrap.querySelector('[data-folder-value="f1"] .project-folder-tree-delete-button')).toBeTruthy();
        });
    });

    describe('project row "move to folder" action', () => {
        // Regression test: showFolderPicker/closeFolderPicker/moveProjectToFolder
        // used to live only on modalOpenUserOdeFiles.js, so clicking a project
        // row's move button here threw "this.showFolderPicker is not a
        // function" and did nothing. They're now on the shared mixin.
        it('clicking a project row\'s move button opens the folder picker', () => {
            modal.folders = [{ uuid: 'f1', name: 'Math', projectCount: 0 }];
            const row = modal.renderOdeRow({ odeId: 'p1', title: 'Untitled', role: 'owner', folderId: null }, { principal: true }, false);
            document.body.append(row);

            row.querySelector('.open-user-ode-file-action-move').dispatchEvent(new MouseEvent('click', { bubbles: true }));

            expect(document.querySelector('.ode-folder-picker')).toBeTruthy();
            modal.closeFolderPicker();
        });
    });

    describe('bulk "Move to folder" action', () => {
        describe('_updateBulkMoveButtonState', () => {
            it('shows the button when there is a selection', () => {
                modal._updateBulkMoveButtonState(['p1', 'p2']);
                expect(modal.moveSelectedButton.classList.contains('d-none')).toBe(false);
            });

            it('hides the button when the selection is empty', () => {
                modal._updateBulkMoveButtonState([]);
                expect(modal.moveSelectedButton.classList.contains('d-none')).toBe(true);
            });
        });

        describe('_buildBulkMoveFolderSelectHtml', () => {
            it('includes an Unfiled option plus every folder, indented by depth', () => {
                modal.folders = [
                    { uuid: 'root', name: 'Root', depth: 0, projectCount: 0 },
                    { uuid: 'child', name: 'Child', depth: 1, projectCount: 0 },
                ];
                const html = modal._buildBulkMoveFolderSelectHtml('select-bulk-move-folder');
                expect(html).toContain('id="select-bulk-move-folder"');
                expect(html).toContain('<option value="">Unfiled</option>');
                expect(html).toContain('value="root"');
                expect(html).toContain('value="child"');
            });
        });

        describe('promptMoveSelectedToFolder', () => {
            it('does nothing when no projects are selected', () => {
                modal.promptMoveSelectedToFolder([]);
                expect(window.eXeLearning.app.modals.confirm.show).not.toHaveBeenCalled();
            });

            it('moves the selected projects to the chosen folder on confirm', async () => {
                modal.folders = [{ uuid: 'f1', name: 'Math', depth: 0, projectCount: 0 }];
                const moveSpy = vi.spyOn(modal, 'moveSelectedToFolder').mockResolvedValue();

                modal.promptMoveSelectedToFolder(['p1', 'p2']);
                const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];
                window.eXeLearning.app.modals.confirm.modalElement.querySelector('#select-bulk-move-folder').value = 'f1';
                await config.confirmExec();

                expect(moveSpy).toHaveBeenCalledWith(['p1', 'p2'], 'f1');
            });

            it('re-shows the dashboard modal when cancelled or closed', () => {
                modal.promptMoveSelectedToFolder(['p1']);
                const config = window.eXeLearning.app.modals.confirm.show.mock.calls.at(-1)[0];

                mockBootstrapModal.show.mockClear();
                config.cancelExec();
                expect(mockBootstrapModal.show).toHaveBeenCalled();

                mockBootstrapModal.show.mockClear();
                config.closeExec();
                expect(mockBootstrapModal.show).toHaveBeenCalled();
            });
        });

        describe('moveSelectedToFolder', () => {
            it('files every project into the folder and refreshes the list', async () => {
                const refreshSpy = vi.spyOn(modal, 'refreshList').mockResolvedValue();

                await modal.moveSelectedToFolder(['p1', 'p2'], 'f1');

                expect(window.eXeLearning.app.api.assignProjectFolder).toHaveBeenCalledWith('p1', 'f1');
                expect(window.eXeLearning.app.api.assignProjectFolder).toHaveBeenCalledWith('p2', 'f1');
                expect(refreshSpy).toHaveBeenCalled();
            });

            it('passes null to unfile the selected projects', async () => {
                vi.spyOn(modal, 'refreshList').mockResolvedValue();
                await modal.moveSelectedToFolder(['p1'], null);
                expect(window.eXeLearning.app.api.assignProjectFolder).toHaveBeenCalledWith('p1', null);
            });

            it('shows an alert when at least one move fails, but still refreshes', async () => {
                window.eXeLearning.app.api.assignProjectFolder
                    .mockResolvedValueOnce({ success: true })
                    .mockResolvedValueOnce({ success: false, message: 'nope' });
                const refreshSpy = vi.spyOn(modal, 'refreshList').mockResolvedValue();

                await modal.moveSelectedToFolder(['p1', 'p2'], 'f1');

                expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalledWith(
                    expect.objectContaining({ title: 'Error' }),
                );
                expect(refreshSpy).toHaveBeenCalled();
            });
        });
    });
});

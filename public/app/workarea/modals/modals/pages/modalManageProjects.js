import Modal from '../modal.js';
import { ProjectListRenderMixin } from './projectListRender.js';
import { ProjectFolderActionsMixin } from './projectFolderActions.js';
import { attachManageProjectsTreeActions } from './manageProjectsTreeActions.js';

/**
 * "Gestionar proyectos" — the full project-management surface: the same
 * folder-navigable project list as "Abrir" (modalOpenUserOdeFiles.js), plus
 * full folder management (create/rename/delete/reparent via drag-and-drop
 * or "Move to…") that "Abrir" deliberately does not have. See the ADR for
 * the split rationale: "Abrir"'s job is opening a project; this modal's job
 * is organizing them.
 */
export default class modalManageProjects extends ProjectFolderActionsMixin(ProjectListRenderMixin(Modal)) {
    constructor(manager) {
        super(manager, 'modalManageProjects', undefined, false);

        this.modalElementBodyContent = this.modalElementBody.querySelector('.modal-body-content');
        this.modalFooterContent = this.modalElement.querySelector('.modal-footer');
        this.confirmButton = this.modalElement.querySelector('button.btn.btn-primary');
        this.moveSelectedButton = this.modalElement.querySelector('.move-selected-button');
        this.moveSelectedButton?.addEventListener('click', () =>
            this.promptMoveSelectedToFolder([...this.odeFiles]),
        );

        this.odeFiles = [];
        this.allOdeFilesData = null;
        this.currentTab = 'my-projects';
        this.selectedProjectUuid = null;
        this.folders = [];
        this.currentFolderUuid = null;
        this.UNFILED_FOLDER_VALUE = '__unfiled__';
        this.folderTreeContainer = null;
        this.expandedFolderUuids = new Set();
        this._openFolderPicker = null;
    }

    /**
     * @param {Object} [data]
     */
    show(data = {}) {
        this.titleDefault = _('Manage projects');
        this.odeFiles = [];
        this.removeDeleteButtonFooter(this.odeFiles);
        this.currentTab = 'my-projects';
        this.selectedProjectUuid = null;
        this.currentFolderUuid = null;

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        this.modalElementBodyContent.innerHTML = '';
        setTimeout(async () => {
            this.setTitle(this.titleDefault);

            const response = await eXeLearning.app.api.getUserOdeFiles();
            this.allOdeFilesData = response?.odeFiles || { odeFilesSync: {} };
            this.folders = this.allOdeFilesData.folders || [];

            this.setBodyElement(this.makeFolderSidebar(this._makeNewFolderButton()));
            const modalActions = this.makeModalActions();
            this.setBodyElement(modalActions);
            const bodyContent = this.makeElementListOdeFiles(this.allOdeFilesData);
            this.setBodyElement(bodyContent);

            this.modal.show();
            this.typesetTitles();
        }, time);
    }

    setBodyElement(bodyElement) {
        this.modalElementBodyContent.append(bodyElement);
    }

    makeModalActions() {
        const modalActions = document.createElement('div');
        modalActions.classList.add('modal-actions');

        modalActions.append(this.makeProjectTabs());
        modalActions.append(this.makeFilterForList('.ode-title', _('Search saved projects...')));

        return modalActions;
    }

    /**
     * Folder creation has no per-row affordance — it's not "create inside
     * this row" — so it lives in the sidebar beside the tree instead of
     * inside manageProjectsTreeActions.js.
     * @returns {HTMLElement}
     */
    _makeNewFolderButton() {
        const newFolderBtn = document.createElement('button');
        newFolderBtn.type = 'button';
        newFolderBtn.classList.add('btn', 'button-secondary', 'ode-new-folder-button');
        newFolderBtn.textContent = _('New folder');
        newFolderBtn.addEventListener('click', () => this.promptCreateFolder());
        return newFolderBtn;
    }

    /**
     * Show/hide the bulk "Move to folder" footer button alongside "Abrir"'s
     * shared bulk-delete button (see the hook doc in projectListRender.js).
     * @param {string[]} odeFiles
     */
    _updateBulkMoveButtonState(odeFiles) {
        if (!this.moveSelectedButton) return;
        this.moveSelectedButton.classList.toggle('d-none', odeFiles.length === 0);
    }

    /**
     * Build the "destination folder" <select> for the bulk-move dialog: an
     * "Unfiled" option (moves the selection out of any folder) plus every
     * folder, indented by depth. Unlike projectFolderActions.js's
     * _buildParentFolderSelectHtml (choosing a *parent folder*, so it
     * excludes a folder's own subtree and labels the root option "No parent"),
     * every folder is a valid destination here — projects, not folders, are
     * being filed.
     * @param {string} id
     * @returns {string}
     */
    _buildBulkMoveFolderSelectHtml(id) {
        const optionsHtml = this.folders
            .map((folder) => {
                const indent = '  '.repeat(folder.depth ?? 0);
                return `<option value="${folder.uuid}">${indent}${this._escapeHtml(folder.name)}</option>`;
            })
            .join('');
        return `<select id="${id}" class="form-control exe-input"><option value="">${_('Unfiled')}</option>${optionsHtml}</select>`;
    }

    /**
     * Prompt for a destination folder and file every given project into it
     * in one go.
     * @param {string[]} odeFiles
     */
    promptMoveSelectedToFolder(odeFiles) {
        if (odeFiles.length === 0) {
            return;
        }
        const modalConfirm = eXeLearning.app.modals.confirm;
        const count = odeFiles.length;
        const message =
            count === 1 ? _('Move this project to:') : _('Move %s projects to:').replace('%s', count);
        const selectHtml = this._buildBulkMoveFolderSelectHtml('select-bulk-move-folder');
        modalConfirm.show({
            title: _('Move to folder'),
            contentId: 'bulk-move-projects-modal',
            body: `<p>${message}</p><p>${selectHtml}</p>`,
            confirmButtonText: _('Move'),
            cancelButtonText: _('Cancel'),
            confirmExec: async () => {
                const select = modalConfirm.modalElement.querySelector('#select-bulk-move-folder');
                const folderUuid = select && select.value !== '' ? select.value : null;
                await this.moveSelectedToFolder(odeFiles, folderUuid);
            },
            cancelExec: () => this.modal.show(),
            closeExec: () => this.modal.show(),
        });
    }

    /**
     * File every given project into the given folder (or unfile them, when
     * folderUuid is null) via the API, then refresh the list.
     * @param {string[]} odeFiles
     * @param {string|null} folderUuid
     */
    async moveSelectedToFolder(odeFiles, folderUuid) {
        // See the comment in projectFolderActions.js's createFolder(): the
        // confirm prompt closed this dashboard modal, so it must be re-shown
        // before we keep operating on it.
        this.modal.show();
        let anyFailed = false;
        for (const odeId of odeFiles) {
            const result = await eXeLearning.app.api.assignProjectFolder(odeId, folderUuid);
            if (!result.success) {
                anyFailed = true;
            }
        }
        if (anyFailed) {
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: _('An error occurred while moving one or more projects.'),
                contentId: 'error',
            });
        }
        await this.refreshList();
    }

    /**
     * Folder rows are draggable in this modal (reparenting), unlike "Abrir"'s
     * navigation-only tree.
     * @returns {boolean}
     */
    _isDraggableFolderTree() {
        return true;
    }

    /**
     * Layer drag-and-drop reparenting and the "Move to…"/rename/delete
     * row buttons onto the freshly-(re)built tree.
     * @param {HTMLElement} treeRoot
     */
    _afterFolderTreeRender(treeRoot) {
        attachManageProjectsTreeActions(treeRoot, this);
    }
}

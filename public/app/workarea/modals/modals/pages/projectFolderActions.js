/**
 * Mixin providing folder management (create/rename/delete, with an indented
 * "parent folder" picker for reparenting) exclusive to "Gestionar proyectos"
 * — "Abrir" only navigates folders that already exist (see
 * projectTreeCompose.js/projectTreeNavigate.js), it never manages them.
 *
 * Reparenting via drag-and-drop and the "Mover a…" context action live in
 * manageProjectsTreeActions.js, which calls the same create/rename API
 * surface as this file's dialogs.
 *
 * Usage: `class SomeModal extends ProjectFolderActionsMixin(Base) { ... }`.
 * The consuming class must provide: this.folders, this.currentFolderUuid,
 * and the methods refreshList, applyFolderFilter, _renderFolderTree.
 * (this.modal.show() comes from the Modal base class itself.)
 *
 * @param {typeof import('../modal.js').default} Base
 */
export const ProjectFolderActionsMixin = (Base) =>
    class extends Base {
        /**
         * Escape a string for safe embedding inside an HTML attribute/text
         * position that is built via string concatenation (rather than DOM
         * APIs like textContent, which escape automatically).
         * @param {string} text
         * @returns {string}
         */
        _escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text ?? '';
            return div.innerHTML;
        }

        /**
         * this.folders minus a folder and its whole subtree, by index range —
         * relies on this.folders already being in tree (depth-first) order, so a
         * node's descendants are exactly the contiguous run right after it whose
         * depth is greater than its own.
         * @param {string|null} excludeUuid
         * @returns {Array<Object>}
         */
        _foldersExcludingSubtree(excludeUuid) {
            if (!excludeUuid) {
                return this.folders;
            }
            const startIndex = this.folders.findIndex((f) => f.uuid === excludeUuid);
            if (startIndex === -1) {
                return this.folders;
            }
            const excludeDepth = this.folders[startIndex].depth ?? 0;
            let endIndex = startIndex + 1;
            while (endIndex < this.folders.length && (this.folders[endIndex].depth ?? 0) > excludeDepth) {
                endIndex++;
            }
            return [...this.folders.slice(0, startIndex), ...this.folders.slice(endIndex)];
        }

        /**
         * Build the HTML for an indented "parent folder" <select>, used by the
         * new-folder and rename-folder dialogs, and by the "Mover a…" action.
         * Always includes a "no parent" option. When excludeUuid is given
         * (reparenting an existing folder), that folder and its own subtree are
         * left out so a folder can never become its own ancestor.
         * @param {string} id - Element id for the generated <select>
         * @param {string|null} selectedUuid - Folder uuid to preselect, or null for "no parent"
         * @param {string|null} [excludeUuid] - Folder (and subtree) to omit from the options
         * @returns {string}
         */
        _buildParentFolderSelectHtml(id, selectedUuid, excludeUuid = null) {
            const candidates = this._foldersExcludingSubtree(excludeUuid);
            const optionsHtml = candidates
                .map((folder) => {
                    const indent = '  '.repeat(folder.depth ?? 0);
                    const selectedAttr = folder.uuid === selectedUuid ? ' selected' : '';
                    return `<option value="${folder.uuid}"${selectedAttr}>${indent}${this._escapeHtml(folder.name)}</option>`;
                })
                .join('');
            const rootSelectedAttr = !selectedUuid ? ' selected' : '';
            return (
                `<select id="${id}" class="form-control exe-input">` +
                `<option value=""${rootSelectedAttr}>${_('No parent (top level)')}</option>` +
                optionsHtml +
                `</select>`
            );
        }

        /**
         * Prompt for a name (and optional parent folder) and create a new
         * dashboard folder. Defaults the parent to the currently filtered
         * folder, when one is selected, for a "new subfolder here" shortcut.
         */
        promptCreateFolder() {
            const modalConfirm = eXeLearning.app.modals.confirm;
            const defaultParentUuid =
                this.currentFolderUuid && this.currentFolderUuid !== this.UNFILED_FOLDER_VALUE
                    ? this.currentFolderUuid
                    : null;
            const nameInputHtml = `<input id="input-new-ode-folder" class="exe-input" type="text" value="">`;
            const parentSelectHtml = this._buildParentFolderSelectHtml('select-new-ode-folder-parent', defaultParentUuid);
            const body =
                `<p>${_('Name')}:</p><p>${nameInputHtml}</p>` + `<p>${_('Parent folder')}:</p><p>${parentSelectHtml}</p>`;
            modalConfirm.show({
                title: _('New folder'),
                contentId: 'new-ode-folder-modal',
                body,
                confirmButtonText: _('Save'),
                cancelButtonText: _('Cancel'),
                focusFirstInputText: true,
                confirmExec: async () => {
                    const input = modalConfirm.modalElement.querySelector('#input-new-ode-folder');
                    const parentSelect = modalConfirm.modalElement.querySelector('#select-new-ode-folder-parent');
                    const name = input.value.trim();
                    if (!name) {
                        return;
                    }
                    const parentFolderUuid = parentSelect && parentSelect.value !== '' ? parentSelect.value : null;
                    await this.createFolder(name, parentFolderUuid);
                },
                // Cancelling or closing (X button, Escape, backdrop click) never
                // runs confirmExec, so without this the dashboard modal closed by
                // modalConfirm.show() above would just stay closed.
                cancelExec: () => this.modal.show(),
                closeExec: () => this.modal.show(),
            });
        }

        /**
         * Create a folder via the API, refresh the list, and switch the filter
         * to the newly created folder
         * @param {string} name
         * @param {string|null} [parentFolderUuid]
         */
        async createFolder(name, parentFolderUuid = null) {
            const result = await eXeLearning.app.api.createProjectFolder(name, parentFolderUuid);
            if (!result.success) {
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: result.message || _('An error occurred while creating the folder.'),
                    contentId: 'error',
                });
                return;
            }
            // eXeLearning.app.modals.confirm.show() (used to prompt for the name)
            // closes every other open modal first (Modal.show() always calls
            // manager.closeModals()), so this dashboard modal must be re-shown
            // before we keep operating on it.
            this.modal.show();
            await this.refreshList();
            this.applyFolderFilter(result.folder.uuid);
        }

        /**
         * Prompt for a new name and/or a new parent folder for the given folder
         * @param {Object} folder - A folder entry from this.folders
         */
        promptRenameFolder(folder) {
            if (!folder) {
                return;
            }
            const modalConfirm = eXeLearning.app.modals.confirm;
            const nameInputHtml = `<input id="input-rename-ode-folder" class="exe-input" type="text" value="${this._escapeHtml(folder.name)}">`;
            const parentSelectHtml = this._buildParentFolderSelectHtml(
                'select-rename-ode-folder-parent',
                folder.parentUuid,
                folder.uuid,
            );
            const body =
                `<p>${_('New name')}:</p><p>${nameInputHtml}</p>` +
                `<p>${_('Parent folder')}:</p><p>${parentSelectHtml}</p>`;
            modalConfirm.show({
                title: _('Rename folder'),
                contentId: 'rename-ode-folder-modal',
                body,
                confirmButtonText: _('Save'),
                cancelButtonText: _('Cancel'),
                focusFirstInputText: true,
                confirmExec: async () => {
                    const input = modalConfirm.modalElement.querySelector('#input-rename-ode-folder');
                    const parentSelect = modalConfirm.modalElement.querySelector('#select-rename-ode-folder-parent');
                    const name = input.value.trim();
                    if (!name) {
                        return;
                    }
                    const parentFolderUuid = parentSelect && parentSelect.value !== '' ? parentSelect.value : null;
                    await this.renameFolder(folder.uuid, name, parentFolderUuid);
                },
                cancelExec: () => this.modal.show(),
                closeExec: () => this.modal.show(),
            });
        }

        /**
         * Rename and/or reparent a folder via the API and refresh the list
         * @param {string} folderUuid
         * @param {string} name
         * @param {string|null} [parentFolderUuid] - Omit to leave the current parent unchanged
         */
        async renameFolder(folderUuid, name, parentFolderUuid) {
            const result = await eXeLearning.app.api.renameProjectFolder(folderUuid, name, parentFolderUuid);
            if (!result.success) {
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: result.message || _('An error occurred while renaming the folder.'),
                    contentId: 'error',
                });
                return;
            }
            // See the comment in createFolder(): the confirm prompt closed this
            // dashboard modal, so it must be re-shown before we keep using it.
            this.modal.show();
            await this.refreshList();
            this.applyFolderFilter(folderUuid);
        }

        /**
         * Ask for confirmation before deleting a folder. Projects filed in it
         * (and its subfolders) become unfiled — they are never deleted.
         * @param {Object} folder - A folder entry from this.folders
         */
        confirmDeleteFolder(folder) {
            if (!folder) {
                return;
            }
            eXeLearning.app.modals.confirm.show({
                title: _('Delete folder'),
                body: `<p>${_('Are you sure you want to delete this folder? Its projects will not be deleted; they will become unfiled.')}</p>`,
                confirmButtonText: _('Delete'),
                cancelButtonText: _('Cancel'),
                confirmExec: async () => {
                    await this.deleteFolderAction(folder.uuid);
                },
                cancelExec: () => this.modal.show(),
                closeExec: () => this.modal.show(),
            });
        }

        /**
         * Delete a folder via the API and refresh the list, resetting the
         * filter back to "All projects"
         * @param {string} folderUuid
         */
        async deleteFolderAction(folderUuid) {
            const result = await eXeLearning.app.api.deleteProjectFolder(folderUuid);
            if (!result.success) {
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: result.message || _('An error occurred while deleting the folder.'),
                    contentId: 'error',
                });
                return;
            }
            // See the comment in createFolder(): the confirm prompt closed this
            // dashboard modal, so it must be re-shown before we keep using it.
            this.modal.show();
            await this.refreshList();
            this.applyFolderFilter('');
        }
    };

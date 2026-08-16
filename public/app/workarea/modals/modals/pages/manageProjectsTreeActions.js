/**
 * Decorates the read-only folder tree with "Gestionar proyectos"-only
 * folder-management affordances, per folder row: drag-and-drop reparenting
 * (drag a folder onto another, or onto "All projects" to move it to
 * top-level), a "Move to…" button (the keyboard/touch-accessible
 * alternative — built from the start, not an afterthought, since native
 * HTML5 drag-and-drop has no keyboard equivalent and poor touch support),
 * and rename/delete buttons that open the same dialogs as
 * projectFolderActions.js's promptRenameFolder/confirmDeleteFolder.
 *
 * Drag-and-drop mirrors the event wiring already used by the page
 * navigation tree (menuStructureBehaviour.js: dragstart marks the dragged
 * node, dragover marks the hovered drop target, dragend reads back whichever
 * element currently has the drag-over class to perform the move) rather than
 * using a `drop` handler.
 *
 * Reparenting (drag-and-drop or "Move to…") goes through the existing
 * rename-folder API endpoint with only `parentFolderUuid` set (name
 * omitted, which JSON.stringify drops entirely, so the backend's `hasName`
 * check is false and only the parent changes) — a lighter path than
 * projectFolderActions.js's renameFolder(), which always sends a name too.
 *
 * @param {HTMLElement} root - The tree root returned by buildProjectFolderTree.
 * @param {Object} host - The modal instance. Must provide: this.folders,
 *   this.UNFILED_FOLDER_VALUE, this.modal, this.refreshList, this.applyFolderFilter,
 *   this._escapeHtml, this._buildParentFolderSelectHtml, this.promptRenameFolder,
 *   this.confirmDeleteFolder (all from projectFolderActions.js).
 */
export function attachManageProjectsTreeActions(root, host) {
    let draggedFolderUuid = null;

    const items = Array.from(root.querySelectorAll('.project-folder-tree-item[data-folder-value]'));

    for (const item of items) {
        const value = item.getAttribute('data-folder-value');
        const row = item.querySelector(':scope > .project-folder-tree-row');
        if (!row) continue;

        // Every item (including "All projects") is a valid drop target, but
        // only real folders (not "All projects"/"Unfiled") can be dragged.
        const isRealFolder = !!value && value !== host.UNFILED_FOLDER_VALUE;

        row.addEventListener('dragover', (ev) => {
            ev.stopPropagation();
            clearDragOverClasses(root);
            if (draggedFolderUuid && draggedFolderUuid !== value && value !== host.UNFILED_FOLDER_VALUE) {
                ev.preventDefault();
                row.classList.add('drag-over');
            }
        });

        if (!isRealFolder) {
            continue;
        }

        row.setAttribute('draggable', 'true');

        row.addEventListener('dragstart', (ev) => {
            ev.stopPropagation();
            draggedFolderUuid = value;
            row.classList.add('dragging');
        });

        row.addEventListener('dragend', async (ev) => {
            ev.stopPropagation();
            row.classList.remove('dragging');
            const target = root.querySelector('.project-folder-tree-row.drag-over');
            clearDragOverClasses(root);
            if (target && draggedFolderUuid) {
                const targetItem = target.closest('.project-folder-tree-item');
                const targetUuid = targetItem?.getAttribute('data-folder-value') ?? '';
                if (targetUuid !== draggedFolderUuid) {
                    await moveFolderToParent(host, draggedFolderUuid, targetUuid === '' ? null : targetUuid);
                }
            }
            draggedFolderUuid = null;
        });

        const folder = host.folders.find((f) => f.uuid === value);
        const moveBtn = document.createElement('button');
        moveBtn.type = 'button';
        moveBtn.classList.add('exe-icon', 'project-folder-tree-move-button');
        moveBtn.title = _('Move to…');
        moveBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none">\n' +
            '  <path d="M1.33333 4.13333C1.33333 3.3866 1.33333 3.01323 1.47866 2.72801C1.60649 2.47713 1.81047 2.27316 2.06135 2.14532C2.34656 2 2.71993 2 3.46667 2H5.24693C5.62308 2 5.81115 2 5.98814 2.04256C6.14507 2.08031 6.29511 2.14205 6.4327 2.2256C6.58809 2.32001 6.72186 2.45312 6.98941 2.71933L7.66667 3.39444C7.93422 3.66065 8.06799 3.79376 8.22338 3.88818C8.36097 3.97172 8.51101 4.03346 8.66794 4.07121C8.84493 4.11378 9.033 4.11378 9.40915 4.11378H12.5333C13.2801 4.11378 13.6534 4.11378 13.9387 4.25911C14.1895 4.38694 14.3935 4.59092 14.5213 4.8418C14.6667 5.12701 14.6667 5.50038 14.6667 6.24711V10.5333C14.6667 11.2801 14.6667 11.6534 14.5213 11.9387C14.3935 12.1895 14.1895 12.3935 13.9387 12.5213C13.6534 12.6667 13.2801 12.6667 12.5333 12.6667H3.46667C2.71993 12.6667 2.34656 12.6667 2.06135 12.5213C1.81047 12.3935 1.60649 12.1895 1.47866 11.9387C1.33333 11.6534 1.33333 11.2801 1.33333 10.5333V4.13333Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
            '</svg>';
        moveBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            promptMoveFolder(host, folder ?? { uuid: value, name: value, parentUuid: null });
        });
        row.append(moveBtn);

        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.classList.add('exe-icon', 'project-folder-tree-rename-button');
        renameBtn.title = _('Rename folder');
        renameBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none">\n' +
            '  <path d="M8 13.3333H14M1.33334 13.3333H2.55954C2.90876 13.3333 3.08337 13.3333 3.24756 13.2942C3.39312 13.2596 3.53229 13.2026 3.66029 13.1252C3.80463 13.0379 3.92847 12.9141 4.17615 12.6664L12.6667 4.17588C13.1389 3.70363 13.1389 2.93811 12.6667 2.46587L11.5341 1.33334C11.0619 0.861095 10.2964 0.861095 9.82411 1.33334L1.33358 9.82388C1.08589 10.0716 0.962048 10.1954 0.874735 10.3397C0.797317 10.4677 0.740357 10.6069 0.705708 10.7525C0.666672 10.9166 0.666672 11.0912 0.666672 11.4405V13.3333Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
            '</svg>';
        renameBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            host.promptRenameFolder(folder ?? { uuid: value, name: value, parentUuid: null });
        });
        row.append(renameBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.classList.add('exe-icon', 'project-folder-tree-delete-button');
        deleteBtn.title = _('Delete folder');
        deleteBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none">\n' +
            '  <path d="M6 2H10M2 4H14M12.6667 4L12.1991 11.0129C12.129 12.065 12.0939 12.5911 11.8667 12.99C11.6666 13.3412 11.3648 13.6235 11.0011 13.7998C10.588 14 10.0607 14 9.00623 14H6.99377C5.93927 14 5.41202 14 4.99889 13.7998C4.63517 13.6235 4.33339 13.3412 4.13332 12.99C3.90607 12.5911 3.871 12.065 3.80086 11.0129L3.33333 4M6.66667 7V10.3333M9.33333 7V10.3333" stroke="#C64143" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
            '</svg>';
        deleteBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            host.confirmDeleteFolder(folder ?? { uuid: value, name: value, parentUuid: null });
        });
        row.append(deleteBtn);
    }
}

function clearDragOverClasses(root) {
    root.querySelectorAll('.project-folder-tree-row.drag-over').forEach((el) => el.classList.remove('drag-over'));
}

/**
 * Prompt for a destination folder (or top-level) and move a folder there.
 * The keyboard/touch-accessible alternative to dragging the folder's row.
 * @param {Object} host
 * @param {Object} folder - {uuid, name, parentUuid}
 */
export function promptMoveFolder(host, folder) {
    const modalConfirm = eXeLearning.app.modals.confirm;
    const selectHtml = host._buildParentFolderSelectHtml('select-move-ode-folder-parent', folder.parentUuid, folder.uuid);
    const body = `<p>${_('Move')} "${host._escapeHtml(folder.name)}" ${_('to')}:</p><p>${selectHtml}</p>`;
    modalConfirm.show({
        title: _('Move to…'),
        contentId: 'move-ode-folder-modal',
        body,
        confirmButtonText: _('Move'),
        cancelButtonText: _('Cancel'),
        confirmExec: async () => {
            const select = modalConfirm.modalElement.querySelector('#select-move-ode-folder-parent');
            const newParentUuid = select && select.value !== '' ? select.value : null;
            await moveFolderToParent(host, folder.uuid, newParentUuid);
        },
        // Cancelling or closing (X button, Escape, backdrop click) never runs
        // confirmExec, so without this the dashboard modal closed by
        // modalConfirm.show() above would just stay closed.
        cancelExec: () => host.modal.show(),
        closeExec: () => host.modal.show(),
    });
}

/**
 * Move a folder to a new parent (or top-level) via the API and refresh.
 * @param {Object} host
 * @param {string} folderUuid
 * @param {string|null} newParentFolderUuid
 */
export async function moveFolderToParent(host, folderUuid, newParentFolderUuid) {
    const result = await eXeLearning.app.api.renameProjectFolder(folderUuid, undefined, newParentFolderUuid);
    if (!result.success) {
        eXeLearning.app.modals.alert.show({
            title: _('Error'),
            body: result.message || _('An error occurred while moving the folder.'),
            contentId: 'error',
        });
        return;
    }
    // See the equivalent comment in projectFolderActions.js: the confirm
    // prompt (when this was reached via promptMoveFolder) closed the
    // dashboard modal, so it must be re-shown. Calling this unconditionally
    // (even for the pure drag-and-drop path, which never opened a confirm
    // dialog) is harmless — showing an already-visible modal is a no-op.
    host.modal.show();
    await host.refreshList();
    host.applyFolderFilter(folderUuid);
}

import { buildProjectFolderTree } from './projectTreeCompose.js';
import { attachProjectTreeBehaviour } from './projectTreeNavigate.js';

/**
 * Mixin providing everything modalOpenUserOdeFiles ("Abrir") and
 * modalManageProjects ("Gestionar proyectos") show identically: the
 * tab+folder-filtered project list itself (rows/version groups), the tabs,
 * the search filter, bulk checkbox selection and its delete footer, the
 * per-project actions (rename/duplicate/delete, single or bulk), the
 * read-only folder navigation tree, and opening a project. The only things
 * that differ between the two modals are folder *management*
 * (create/rename/delete/drag-and-drop, exclusive to "Gestionar proyectos",
 * see projectFolderActions.js/manageProjectsTreeActions.js) and each modal's
 * own body layout/footer chrome. Extracted from modalOpenUserOdeFiles.js so
 * both modals share one implementation instead of two copies.
 *
 * Usage: `class SomeModal extends ProjectListRenderMixin(Modal) { ... }`.
 * The consuming class must provide: this.currentTab, this.currentFolderUuid,
 * this.UNFILED_FOLDER_VALUE, this.folders, this.odeFiles, this.modalElement,
 * this.confirmButton, this.selectedProjectUuid, this.timeMax,
 * this.expandedFolderUuids, this.allOdeFilesData, and the methods
 * setBodyElement, setConfirmExec, typesetTitles. Three small hooks let each
 * modal customize the shared confirm-button behavior without forking the
 * methods that use them: _onProjectSelected(uuid) (called when a row is
 * selected outside a direct click, e.g. after duplicating),
 * _resetConfirmButtonToDefault() (called when the bulk-selection footer goes
 * back to empty), and _updateBulkMoveButtonState(odeFiles) (called whenever
 * the bulk-selection footer's visibility changes; "Gestionar proyectos" uses
 * it to show/hide its "Move to folder" bulk-action button). Gestionar
 * proyectos additionally provides
 * this._isDraggableFolderTree()/this._afterFolderTreeRender(treeRoot) to
 * layer drag-and-drop onto the same tree-building code.
 *
 * @param {typeof import('../modal.js').default} Base
 */
export const ProjectListRenderMixin = (Base) =>
    class extends Base {
        /**
         * Clear the current selection, remove the rendered list/empty-state, and
         * re-render from this.allOdeFilesData applying the current tab and folder
         * filters. Shared by tab switches and folder-filter changes so both stay
         * in sync with a single rendering path.
         */
        _rerenderList() {
            // Clear selection
            this.odeFiles = [];
            this.removeDeleteButtonFooter(this.odeFiles);

            // Remove existing list container
            const existingList = this.modalElementBodyContent.querySelector('.ode-files-list-container');
            if (existingList) {
                existingList.remove();
            }

            // Also remove empty alert if present
            const existingAlert = this.modalElementBodyContent.querySelector('.alert.alert-info');
            if (existingAlert) {
                existingAlert.remove();
            }

            // Re-render the project list with filtered data
            const bodyContent = this.makeElementListOdeFiles(this.allOdeFilesData);
            this.setBodyElement(bodyContent);
            // Typeset LaTeX in project titles after re-render
            this.typesetTitles();
        }

        /**
         * Whether a project entry matches the currently selected folder filter.
         * `null` folder filter means "All projects" (no filtering).
         * @param {Object} ode - The project list entry (has a `folderId` field)
         * @returns {boolean}
         */
        matchesFolderFilter(ode) {
            if (!this.currentFolderUuid) {
                return true;
            }
            if (this.currentFolderUuid === this.UNFILED_FOLDER_VALUE) {
                return !ode.folderId;
            }
            return ode.folderId === this.currentFolderUuid;
        }

        /**
         * Empty-state copy for the current tab + folder filter combination.
         * @returns {string}
         */
        getEmptyStateMessage() {
            if (this.currentFolderUuid === this.UNFILED_FOLDER_VALUE) {
                return _('No unfiled projects.');
            }
            if (this.currentFolderUuid) {
                return _('No projects in this folder.');
            }
            return this.currentTab === 'my-projects'
                ? _('No recent projects found.')
                : _('No projects have been shared with you yet.');
        }

        makeElementListOdeFiles(data) {
            if (!data || !data.odeFilesSync || Object.keys(data.odeFilesSync).length === 0) {
                const empty = document.createElement('div');
                empty.className = 'alert alert-info mt-3';
                empty.innerHTML =
                    this.currentTab === 'my-projects'
                        ? _('No recent projects found.')
                        : _('No projects have been shared with you yet.');
                return empty;
            }

            // Filter projects based on current tab and folder filter
            const filteredOdeFilesSync = {};
            for (const [key, ode] of Object.entries(data.odeFilesSync)) {
                const isOwner = ode.role === 'owner';
                const matchesTab =
                    (this.currentTab === 'my-projects' && isOwner) ||
                    (this.currentTab === 'shared-with-me' && !isOwner);
                if (!matchesTab || !this.matchesFolderFilter(ode)) {
                    continue;
                }
                filteredOdeFilesSync[key] = ode;
            }

            // Check if filtered list is empty
            if (Object.keys(filteredOdeFilesSync).length === 0) {
                const empty = document.createElement('div');
                empty.className = 'alert alert-info mt-3';
                empty.innerHTML = this.getEmptyStateMessage();
                return empty;
            }

            const wrap = document.createElement('div');
            wrap.classList.add('ode-files-list-container');

            const list = document.createElement('div');
            list.classList.add('ode-files-list');
            wrap.append(list);

            const groups = {};
            for (const [, ode] of Object.entries(filteredOdeFilesSync)) {
                if (!groups[ode.odeId]) groups[ode.odeId] = [];
                groups[ode.odeId].push(ode);
            }
            for (const odes of Object.values(groups)) {
                odes.sort((a, b) => parseInt(b.versionName || '0') - parseInt(a.versionName || '0'));
                const principal = odes[0];
                const others = odes.slice(1);

                const groupEl = this.renderOdeGroup(principal, others);
                list.append(groupEl);
            }

            return wrap;
        }

        renderOdeGroup(principal, others) {
            const group = document.createElement('section');
            group.classList.add('ode-group');
            group.setAttribute('ode-id', principal.odeId);

            const row = this.renderOdeRow(principal, { principal: true }, others.length !== 0);
            group.append(row);

            const versions = document.createElement('div');
            versions.classList.add('ode-versions');
            versions.hidden = true;

            for (const ode of others) {
                versions.append(this.renderOdeRow(ode, { principal: false }, false));
            }
            group.append(versions);

            const toggle = row.querySelector('.ode-toggle');
            if (toggle) {
                toggle.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const open = versions.hidden;
                    versions.hidden = !open;
                    toggle.classList.toggle('unblock-others-show', open);
                    toggle.classList.toggle('block-others-show', !open);
                    toggle.setAttribute('aria-expanded', String(open));
                });
            }

            return group;
        }

        renderOdeRow(ode, { principal }, hasOthers) {
            const row = document.createElement('article');
            row.classList.add('ode-row');
            if (principal) row.classList.add('principal-version');
            else row.classList.add('subversion-show');

            row.setAttribute('version-name', ode.versionName || '0');
            row.setAttribute('ode-id', ode.odeId);

            const isOwner = ode.role === 'owner';

            const checkWrap = document.createElement('div');
            checkWrap.classList.add('ode-check-wrap');

            // Only render checkboxes for owned projects - shared projects must not have multi-select/delete
            if (isOwner) {
                const check = document.createElement('input');
                check.type = 'checkbox';
                check.id = 'check-' + ode.odeId;
                check.setAttribute('name', check.id);
                check.classList.add('ode-check');
                check.addEventListener('change', () => {
                    // Use odeId (UUID) for delete operations
                    const projectUuid = ode.odeId;
                    if (check.checked) {
                        if (!this.odeFiles.includes(projectUuid)) this.odeFiles.push(projectUuid);
                    } else {
                        this.odeFiles = this.odeFiles.filter((id) => id !== projectUuid);
                    }
                    // Update button state based on selection
                    this.updateDeleteButtonState();
                    // Update the Select All checkbox state
                    this.updateSelectAllCheckbox();
                });

                let label = document.createElement('label');
                label.setAttribute('for', check.id);
                label.classList.add('visually-hidden');
                label.textContent = _('Upload iDevice file');
                checkWrap.append(label, check);
            }

            const icon = document.createElement('span');
            icon.className = 'exe-logo content';
            icon.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">\n' +
                '  <path d="M14 2.26953V6.40007C14 6.96012 14 7.24015 14.109 7.45406C14.2049 7.64222 14.3578 7.7952 14.546 7.89108C14.7599 8.00007 15.0399 8.00007 15.6 8.00007H19.7305M14 17H8M16 13H8M20 9.98823V17.2C20 18.8802 20 19.7202 19.673 20.362C19.3854 20.9265 18.9265 21.3854 18.362 21.673C17.7202 22 16.8802 22 15.2 22H8.8C7.11984 22 6.27976 22 5.63803 21.673C5.07354 21.3854 4.6146 20.9265 4.32698 20.362C4 19.7202 4 18.8802 4 17.2V6.8C4 5.11984 4 4.27976 4.32698 3.63803C4.6146 3.07354 5.07354 2.6146 5.63803 2.32698C6.27976 2 7.11984 2 8.8 2H12.0118C12.7455 2 13.1124 2 13.4577 2.08289C13.7638 2.15638 14.0564 2.27759 14.3249 2.44208C14.6276 2.6276 14.887 2.88703 15.4059 3.40589L18.5941 6.59411C19.113 7.11297 19.3724 7.3724 19.5579 7.67515C19.7224 7.94356 19.8436 8.2362 19.9171 8.54231C20 8.88757 20 9.25445 20 9.98823Z" stroke="#1D1D1D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>\n' +
                '</svg>';

            const info = document.createElement('div');
            info.classList.add('ode-info');

            const title = document.createElement('div');
            title.classList.add('ode-title', 'ode-file-title');
            title.id = ode.odeId; // Use UUID for Yjs projects
            title.setAttribute('data-filename', ode.fileName);
            title.textContent = ode.title && ode.title !== '' ? ode.title : ode.fileName;

            const meta = document.createElement('div');
            meta.classList.add('ode-meta');
            const size = ode.sizeFormatted;

            // Get ODE date
            const ISOdate = ode.updatedAt;
            const date = new Date(ISOdate);
            const lang = document.documentElement.lang || 'en';
            // Keep a consistent format
            const opciones = {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false, // No AM/PM
            };
            let formattedDate = date.toLocaleString(lang, opciones);
            // Some langs use a comma to separate date and hour
            formattedDate = formattedDate.replace(',', ' -');
            // No " -";
            formattedDate = formattedDate.replace(' -', '');

            const version = ode.versionName || '0';

            // Get visibility badge
            const isPublic = ode.visibility === 'public';
            const visibilityLabel = isPublic ? _('Public') : _('Private');
            const visibilityClass = isPublic ? 'ode-badge-public' : 'ode-badge-private';

            // Build meta info based on ownership
            let metaContent = `
            <span class="ode-badge">v${version}</span>
            <span class="ode-badge ${visibilityClass}">${visibilityLabel}</span>
            <span class="dot">•</span>
            <span>${size}</span>
            <span class="dot">•</span>
            <span>${formattedDate}</span>
        `;

            // Show owner email for shared projects
            if (!isOwner && ode.ownerEmail) {
                metaContent += `
                <span class="dot">•</span>
                <span class="ode-owner-info" title="${_('Shared by')} ${ode.ownerEmail}">
                    <span class="auto-icon">person</span>
                    ${ode.ownerEmail}
                </span>
            `;
            } else {
                metaContent += `
                <span class="dot">•</span>
                <span>${ode.isManualSave ? _('Manual') : _('Autosaved')}</span>
            `;
            }

            meta.innerHTML = metaContent;

            info.append(title, meta);

            const actions = document.createElement('div');
            actions.classList.add('ode-actions');

            if (principal && hasOthers) {
                const toggle = document.createElement('button');
                toggle.className = 'ode-toggle block-others-show';
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('title', _('Show other versions'));
                toggle.innerHTML =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">\n' +
                    '  <path d="M1 1V7.8C1 8.92011 1 9.48016 1.21799 9.90798C1.40973 10.2843 1.71569 10.5903 2.09202 10.782C2.51984 11 3.0799 11 4.2 11H9M9 11C9 12.1046 9.89543 13 11 13C12.1046 13 13 12.1046 13 11C13 9.89543 12.1046 9 11 9C9.89543 9 9 9.89543 9 11ZM1 4.33333L9 4.33333M9 4.33333C9 5.4379 9.89543 6.33333 11 6.33333C12.1046 6.33333 13 5.4379 13 4.33333C13 3.22876 12.1046 2.33333 11 2.33333C9.89543 2.33333 9 3.22876 9 4.33333Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
                    '</svg>';
                actions.append(toggle);
            } else if (principal === false) {
                row.classList.add('ode-row--indented');
            }

            // Rename button - shown for all projects the user has access to
            // (owner, collaborator, or a public project anyone can view),
            // matching the dashboard rename route's permission model.
            const renameBtn = document.createElement('button');
            renameBtn.className = 'exe-icon open-user-ode-file-action open-user-ode-file-action-rename';
            renameBtn.title = _('Rename');
            renameBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">\n' +
                '  <path d="M8 13.3333H14M1.33334 13.3333H2.55954C2.90876 13.3333 3.08337 13.3333 3.24756 13.2942C3.39312 13.2596 3.53229 13.2026 3.66029 13.1252C3.80463 13.0379 3.92847 12.9141 4.17615 12.6664L12.6667 4.17588C13.1389 3.70363 13.1389 2.93811 12.6667 2.46587L11.5341 1.33334C11.0619 0.861095 10.2964 0.861095 9.82411 1.33334L1.33358 9.82388C1.08589 10.0716 0.962048 10.1954 0.874735 10.3397C0.797317 10.4677 0.740357 10.6069 0.705708 10.7525C0.666672 10.9166 0.666672 11.0912 0.666672 11.4405V13.3333Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
                '</svg>';
            renameBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.renameOdeFileEvent(ode);
            });
            actions.append(renameBtn);

            // Copy/Duplicate button - shown for all projects
            const copyBtn = document.createElement('button');
            copyBtn.className = 'exe-icon open-user-ode-file-action open-user-ode-file-action-copy';
            copyBtn.title = isOwner ? _('Duplicate') : _('Clone to my projects');
            copyBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">\n' +
                '  <path d="M5.33333 5.33333V3.46667C5.33333 2.71993 5.33333 2.34656 5.47866 2.06135C5.60649 1.81047 5.81047 1.60649 6.06135 1.47866C6.34656 1.33333 6.71993 1.33333 7.46667 1.33333H12.5333C13.2801 1.33333 13.6534 1.33333 13.9387 1.47866C14.1895 1.60649 14.3935 1.81047 14.5213 2.06135C14.6667 2.34656 14.6667 2.71993 14.6667 3.46667V8.53333C14.6667 9.28007 14.6667 9.65344 14.5213 9.93865C14.3935 10.1895 14.1895 10.3935 13.9387 10.5213C13.6534 10.6667 13.2801 10.6667 12.5333 10.6667H10.6667M3.46667 14.6667H8.53333C9.28007 14.6667 9.65344 14.6667 9.93865 14.5213C10.1895 14.3935 10.3935 14.1895 10.5213 13.9387C10.6667 13.6534 10.6667 13.2801 10.6667 12.5333V7.46667C10.6667 6.71993 10.6667 6.34656 10.5213 6.06135C10.3935 5.81047 10.1895 5.60649 9.93865 5.47866C9.65344 5.33333 9.28007 5.33333 8.53333 5.33333H3.46667C2.71993 5.33333 2.34656 5.33333 2.06135 5.47866C1.81047 5.60649 1.60649 5.81047 1.47866 6.06135C1.33333 6.34656 1.33333 6.71993 1.33333 7.46667V12.5333C1.33333 13.2801 1.33333 13.6534 1.47866 13.9387C1.60649 14.1895 1.81047 14.3935 2.06135 14.5213C2.34656 14.6667 2.71993 14.6667 3.46667 14.6667Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
                '</svg>';
            copyBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.duplicateOdeFileEvent(ode.odeId);
            });
            actions.append(copyBtn);

            // Move to folder button - shown for all projects (owned or shared):
            // filing into a personal folder only needs read access to the project.
            const moveBtn = document.createElement('button');
            moveBtn.className = 'exe-icon open-user-ode-file-action open-user-ode-file-action-move';
            moveBtn.title = _('Move to folder');
            moveBtn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">\n' +
                '  <path d="M1.33333 4.13333C1.33333 3.3866 1.33333 3.01323 1.47866 2.72801C1.60649 2.47713 1.81047 2.27316 2.06135 2.14532C2.34656 2 2.71993 2 3.46667 2H5.24693C5.62308 2 5.81115 2 5.98814 2.04256C6.14507 2.08031 6.29511 2.14205 6.4327 2.2256C6.58809 2.32001 6.72186 2.45312 6.98941 2.71933L7.66667 3.39444C7.93422 3.66065 8.06799 3.79376 8.22338 3.88818C8.36097 3.97172 8.51101 4.03346 8.66794 4.07121C8.84493 4.11378 9.033 4.11378 9.40915 4.11378H12.5333C13.2801 4.11378 13.6534 4.11378 13.9387 4.25911C14.1895 4.38694 14.3935 4.59092 14.5213 4.8418C14.6667 5.12701 14.6667 5.50038 14.6667 6.24711V10.5333C14.6667 11.2801 14.6667 11.6534 14.5213 11.9387C14.3935 12.1895 14.1895 12.3935 13.9387 12.5213C13.6534 12.6667 13.2801 12.6667 12.5333 12.6667H3.46667C2.71993 12.6667 2.34656 12.6667 2.06135 12.5213C1.81047 12.3935 1.60649 12.1895 1.47866 11.9387C1.33333 11.6534 1.33333 11.2801 1.33333 10.5333V4.13333Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
                '</svg>';
            moveBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.showFolderPicker(moveBtn, ode);
            });
            actions.append(moveBtn);

            // Delete button - only shown for owned projects
            if (isOwner) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'exe-icon open-user-ode-file-action open-user-ode-file-action-delete';
                deleteBtn.title = _('Delete');
                deleteBtn.innerHTML =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">\n' +
                    '  <path d="M6 2H10M2 4H14M12.6667 4L12.1991 11.0129C12.129 12.065 12.0939 12.5911 11.8667 12.99C11.6666 13.3412 11.3648 13.6235 11.0011 13.7998C10.588 14 10.0607 14 9.00623 14H6.99377C5.93927 14 5.41202 14 4.99889 13.7998C4.63517 13.6235 4.33339 13.3412 4.13332 12.99C3.90607 12.5911 3.871 12.065 3.80086 11.0129L3.33333 4M6.66667 7V10.3333M9.33333 7V10.3333" stroke="#C64143" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
                    '</svg>';
                deleteBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.showInlineDeleteConfirmation(row, ode);
                });
                actions.append(deleteBtn);
            }

            row.addEventListener('click', (ev) => {
                if (ev.target.closest('.ode-actions')) {
                    return;
                }
                this.modalElement.querySelectorAll('.ode-row').forEach((r) => r.classList.remove('selected'));
                row.classList.add('selected');

                this.selectedProjectUuid = ode.odeId;
                this._onProjectSelected(ode.odeId);
            });
            row.addEventListener('dblclick', () => {
                setTimeout(() => this.openUserOdeFilesEvent(ode.odeId), this.timeMax);
            });

            row.append(checkWrap, icon, info, actions);
            return row;
        }

        /**
         * Create tabs for filtering projects by ownership
         * @returns {HTMLElement}
         */
        makeProjectTabs() {
            const tabsContainer = document.createElement('div');
            tabsContainer.classList.add('ode-project-tabs');

            const counts = this.countProjectsByRole();

            const myProjectsTab = document.createElement('button');
            myProjectsTab.type = 'button';
            myProjectsTab.classList.add('ode-project-tab', 'active');
            myProjectsTab.setAttribute('data-tab', 'my-projects');
            myProjectsTab.innerHTML = `${_('My Projects')} <span class="ode-tab-count">(${counts.owned})</span>`;
            myProjectsTab.addEventListener('click', () => this.switchTab('my-projects'));

            const sharedTab = document.createElement('button');
            sharedTab.type = 'button';
            sharedTab.classList.add('ode-project-tab');
            sharedTab.setAttribute('data-tab', 'shared-with-me');
            sharedTab.innerHTML = `${_('Shared with me')} <span class="ode-tab-count">(${counts.shared})</span>`;
            sharedTab.addEventListener('click', () => this.switchTab('shared-with-me'));

            tabsContainer.append(myProjectsTab, sharedTab);
            return tabsContainer;
        }

        /**
         * Count projects by role (owner vs shared)
         * @returns {{owned: number, shared: number}}
         */
        countProjectsByRole() {
            const counts = { owned: 0, shared: 0 };
            if (!this.allOdeFilesData?.odeFilesSync) {
                return counts;
            }
            const groups = {};
            for (const [, ode] of Object.entries(this.allOdeFilesData.odeFilesSync)) {
                if (!groups[ode.odeId]) {
                    groups[ode.odeId] = ode;
                }
            }
            for (const ode of Object.values(groups)) {
                if (ode.role === 'owner') {
                    counts.owned++;
                } else {
                    counts.shared++;
                }
            }
            return counts;
        }

        /**
         * Switch to a different tab and refresh the project list
         * @param {string} tabName - 'my-projects' or 'shared-with-me'
         */
        switchTab(tabName) {
            this.currentTab = tabName;

            const tabs = this.modalElementBodyContent.querySelectorAll('.ode-project-tab');
            tabs.forEach((tab) => {
                tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
            });

            const selectAllWrap = this.modalElementBodyContent.querySelector('.ode-select-all-wrap');
            if (selectAllWrap) {
                selectAllWrap.style.display = tabName === 'my-projects' ? 'flex' : 'none';
            }

            const selectAllCheckbox = this.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            }

            this._rerenderList();
        }

        /**
         * Build the search input (plus, on the "My Projects" tab, the Select
         * All checkbox) that filters/highlights rendered project rows.
         * @param {string} selector - CSS selector of the text to search/highlight
         * @param {string} [placeholder]
         * @returns {HTMLElement}
         */
        makeFilterForList(selector, placeholder) {
            const wrap = document.createElement('div');
            wrap.classList.add('ode-filter-wrap');

            const selectAllWrap = document.createElement('div');
            selectAllWrap.classList.add('ode-select-all-wrap');
            selectAllWrap.style.display = this.currentTab === 'my-projects' ? 'flex' : 'none';

            const selectAllCheckbox = document.createElement('input');
            selectAllCheckbox.type = 'checkbox';
            selectAllCheckbox.id = 'ode-select-all-checkbox';
            selectAllCheckbox.classList.add('ode-select-all-checkbox');
            selectAllCheckbox.title = _('Select all');
            selectAllCheckbox.setAttribute('aria-label', _('Select all'));
            selectAllCheckbox.addEventListener('change', () => this.toggleSelectAll(selectAllCheckbox.checked));

            selectAllWrap.append(selectAllCheckbox);
            wrap.append(selectAllWrap);

            const input = document.createElement('input');
            input.type = 'text';
            input.classList.add('form-control', 'ode-filter-input');
            input.placeholder = placeholder || _('Search...');
            input.setAttribute('aria-label', _('Search'));

            const field = document.createElement('div');
            field.classList.add('ode-search-field');
            const icon = document.createElement('span');
            icon.classList.add('medium-icon', 'search-icon');
            field.append(icon, input);
            wrap.append(field);

            const clearMarks = () => {
                let container = document.querySelector('.ode-files-list-container');
                container.querySelectorAll('.ode-title mark').forEach((m) => {
                    const parent = m.parentNode;
                    parent.replaceChild(document.createTextNode(m.textContent), m);
                    parent.normalize();
                });
            };

            const highlight = (el, q) => {
                const txt = el.textContent;
                const idx = txt.toLowerCase().indexOf(q.toLowerCase());
                if (idx === -1 || !q) return;
                const before = document.createTextNode(txt.slice(0, idx));
                const mark = document.createElement('mark');
                mark.textContent = txt.slice(idx, idx + q.length);
                const after = document.createTextNode(txt.slice(idx + q.length));
                el.textContent = '';
                el.append(before, mark, after);
            };

            input.addEventListener('input', () => {
                let container = document.querySelector('.ode-files-list-container');
                const q = input.value.trim().toLowerCase();
                clearMarks();

                const groups = container.querySelectorAll('.ode-group');
                groups.forEach((group) => {
                    const titles = group.querySelectorAll('.ode-title');
                    let matchAny = false;
                    titles.forEach((t) => {
                        const text = t.textContent.trim().toLowerCase();
                        const ok = q === '' || text.includes(q);
                        if (ok) matchAny = true;
                    });

                    group.style.display = matchAny ? '' : 'none';

                    const versions = group.querySelector('.ode-versions');
                    const toggle = group.querySelector('.ode-toggle');
                    if (versions && toggle) {
                        const shouldOpen = !!q && matchAny;
                        versions.hidden = !shouldOpen;
                        toggle.classList.toggle('unblock-others-show', shouldOpen);
                        toggle.classList.toggle('block-others-show', !shouldOpen);
                        toggle.setAttribute('aria-expanded', String(shouldOpen));
                    }

                    if (matchAny && q) {
                        titles.forEach((t) => highlight(t, q));
                    }
                });
            });

            wrap.append(input);
            return wrap;
        }

        updateTabCounts() {
            const counts = this.countProjectsByRole();
            const tabs = this.modalElementBodyContent.querySelectorAll('.ode-project-tab');
            tabs.forEach((tab) => {
                const tabName = tab.getAttribute('data-tab');
                const countSpan = tab.querySelector('.ode-tab-count');
                if (countSpan) {
                    if (tabName === 'my-projects') {
                        countSpan.textContent = `(${counts.owned})`;
                    } else if (tabName === 'shared-with-me') {
                        countSpan.textContent = `(${counts.shared})`;
                    }
                }
            });
        }

        /**
         * Toggle selection of all projects in the current tab
         * Only works for "My Projects" tab (owned projects)
         * @param {boolean} checked
         */
        toggleSelectAll(checked) {
            if (this.currentTab !== 'my-projects') {
                return;
            }

            const checkboxes = this.modalElementBodyContent.querySelectorAll(
                '.ode-files-list .ode-row.principal-version .ode-check',
            );

            this.odeFiles = [];

            checkboxes.forEach((checkbox) => {
                checkbox.checked = checked;
                if (checked) {
                    const row = checkbox.closest('.ode-row');
                    const projectUuid = row?.getAttribute('ode-id');
                    if (projectUuid && !this.odeFiles.includes(projectUuid)) {
                        this.odeFiles.push(projectUuid);
                    }
                }
            });

            this.updateDeleteButtonState();
        }

        /**
         * Update the delete/default button state based on current selection
         */
        updateDeleteButtonState() {
            // Never show bulk delete on the shared-with-me tab
            if (this.currentTab === 'shared-with-me') {
                this.odeFiles = [];
                this.removeDeleteButtonFooter(this.odeFiles);
                return;
            }
            if (this.odeFiles.length > 0) {
                this.makeDeleteButtonFooter([...this.odeFiles]); // Pass a copy to avoid reference issues
            } else {
                this.removeDeleteButtonFooter(this.odeFiles);
            }
        }

        /**
         * Update the Select All checkbox state based on individual selections
         */
        updateSelectAllCheckbox() {
            const selectAllCheckbox = this.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
            if (!selectAllCheckbox) return;

            const checkboxes = this.modalElementBodyContent.querySelectorAll(
                '.ode-files-list .ode-row.principal-version .ode-check',
            );
            const checkedCount = Array.from(checkboxes).filter((cb) => cb.checked).length;

            if (checkedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (checkedCount === checkboxes.length) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }

        /**
         * Select a project in the list by its UUID (e.g. after duplicating it)
         * @param {string} projectUuid
         */
        selectProjectByUuid(projectUuid) {
            const row = this.modalElementBodyContent.querySelector(`.ode-row[ode-id="${projectUuid}"]`);
            if (!row) {
                return;
            }
            this.modalElement.querySelectorAll('.ode-row').forEach((r) => r.classList.remove('selected'));
            row.classList.add('selected');

            this.selectedProjectUuid = projectUuid;
            this._onProjectSelected(projectUuid);

            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        /**
         * Called when a project becomes selected outside of a direct row
         * click (e.g. programmatically, after duplicating a project). No-op
         * by default; "Abrir" overrides this to enable its "Open" button.
         * @param {string} _projectUuid
         */
        _onProjectSelected(_projectUuid) {}

        /**
         * Escape a string for safe embedding inside an HTML attribute/text
         * position that is built via string concatenation.
         * @param {string} text
         * @returns {string}
         */
        _escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text ?? '';
            return div.innerHTML;
        }

        /**
         * Prompt for a new title and rename a project via the dashboard rename
         * endpoint (distinct from the in-editor live title, edited via Yjs
         * while the project is actually open). Available for any project the
         * user has access to — see PATCH /api/projects/uuid/:uuid/title.
         * @param {Object} ode - The project list entry
         */
        renameOdeFileEvent(ode) {
            const modalConfirm = eXeLearning.app.modals.confirm;
            const currentTitle = ode.title && ode.title !== '' ? ode.title : ode.fileName;
            const nameInputHtml = `<input id="input-rename-ode-project" class="exe-input" type="text" value="${this._escapeHtml(currentTitle)}">`;
            modalConfirm.show({
                title: _('Rename'),
                contentId: 'rename-ode-project-modal',
                body: `<p>${_('New name')}:</p><p>${nameInputHtml}</p>`,
                confirmButtonText: _('Save'),
                cancelButtonText: _('Cancel'),
                focusFirstInputText: true,
                confirmExec: async () => {
                    const input = modalConfirm.modalElement.querySelector('#input-rename-ode-project');
                    const title = input.value.trim();
                    if (!title) {
                        return;
                    }
                    const result = await eXeLearning.app.api.renameProject(ode.odeId, title);
                    if (!result.success) {
                        eXeLearning.app.modals.alert.show({
                            title: _('Error'),
                            body: result.message || _('An error occurred while renaming the project.'),
                            contentId: 'error',
                        });
                        return;
                    }
                    // eXeLearning.app.modals.confirm.show() (used to prompt for the
                    // name) closes every other open modal first (Modal.show() always
                    // calls manager.closeModals()), so this dashboard modal must be
                    // re-shown before we keep operating on it.
                    this.modal.show();
                    await this.refreshList();
                },
                // Cancelling or closing (X button, Escape, backdrop click) never
                // runs confirmExec, so without this the dashboard modal closed by
                // modalConfirm.show() above would just stay closed.
                cancelExec: () => this.modal.show(),
                closeExec: () => this.modal.show(),
            });
        }

        /**
         * Show inline delete confirmation in a project row
         * @param {HTMLElement} row
         * @param {Object} ode
         */
        showInlineDeleteConfirmation(row, ode) {
            if (row.classList.contains('ode-row--confirming')) {
                return;
            }

            const originalContent = row.innerHTML;
            row.classList.add('ode-row--confirming');

            const confirmContent = document.createElement('div');
            confirmContent.classList.add('ode-delete-confirm');
            confirmContent.innerHTML = `
            <span class="ode-delete-confirm-text">${_('Delete this project?')}</span>
            <div class="ode-delete-confirm-actions">
                <button type="button" class="btn btn-sm btn-danger ode-delete-confirm-yes">${_('Delete')}</button>
                <button type="button" class="btn btn-sm btn-secondary ode-delete-confirm-no">${_('Cancel')}</button>
            </div>
        `;

            row.innerHTML = '';
            row.append(confirmContent);

            const confirmBtn = confirmContent.querySelector('.ode-delete-confirm-yes');
            confirmBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                confirmBtn.disabled = true;
                confirmBtn.textContent = _('Deleting...');
                await this.deleteOdeFileEvent(ode.odeId);
            });

            const cancelBtn = confirmContent.querySelector('.ode-delete-confirm-no');
            cancelBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                row.classList.remove('ode-row--confirming');
                row.innerHTML = originalContent;
                this.switchTab(this.currentTab);
            });
        }

        /**
         * Duplicate a project by UUID
         * @param {string} projectUuid
         */
        async duplicateOdeFileEvent(projectUuid) {
            try {
                const resp = await eXeLearning.app.api.duplicateProject(projectUuid);
                if (resp.responseMessage === 'OK' || resp.success) {
                    const newProjectUuid = resp.project?.uuid || resp.newProjectId;

                    await this.refreshList();
                    this.switchTab('my-projects');

                    if (newProjectUuid) {
                        this.selectProjectByUuid(newProjectUuid);
                    }
                } else {
                    console.error('[ProjectList] Duplicate error:', resp.message);
                    eXeLearning.app.modals.alert.show({
                        title: _('Error'),
                        body: resp.message || _('An error occurred while duplicating the project.'),
                        contentId: 'error',
                    });
                }
            } catch (error) {
                console.error('[ProjectList] Duplicate error:', error);
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: _('An error occurred while duplicating the project.'),
                    contentId: 'error',
                });
            }
        }

        /**
         * Delete a project by UUID
         * @param {string} projectUuid
         */
        async deleteOdeFileEvent(projectUuid) {
            try {
                const resp = await eXeLearning.app.api.deleteProject(projectUuid);
                if (resp.responseMessage === 'OK' || resp.success) {
                    await this.refreshList();
                }
            } catch (error) {
                console.error('[ProjectList] Delete error:', error);
            }
        }

        /**
         * Show a small popover listing folders (plus "Unfiled") for moving a
         * single project, anchored next to the button that triggered it.
         * Portalled to document.body with fixed positioning (see
         * _positionFolderPicker) rather than appended next to the anchor
         * button: the project list scrolls (.ode-files-list has
         * overflow: auto), and a position: absolute descendant is clipped to
         * a scrollable ancestor's bounds regardless of z-index, so an
         * in-place popover got cut off instead of overlaying on top.
         * @param {HTMLElement} anchorEl
         * @param {Object} ode - The project list entry
         */
        showFolderPicker(anchorEl, ode) {
            this.closeFolderPicker();

            const picker = document.createElement('div');
            picker.classList.add('ode-folder-picker');

            const unfiledOption = document.createElement('button');
            unfiledOption.type = 'button';
            unfiledOption.classList.add('ode-folder-picker-option');
            if (!ode.folderId) {
                unfiledOption.classList.add('selected');
            }
            unfiledOption.textContent = _('Unfiled');
            unfiledOption.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this.moveProjectToFolder(ode.odeId, null);
            });
            picker.append(unfiledOption);

            for (const folder of this.folders) {
                const option = document.createElement('button');
                option.type = 'button';
                option.classList.add('ode-folder-picker-option');
                if (ode.folderId === folder.uuid) {
                    option.classList.add('selected');
                }
                const indent = '  '.repeat(folder.depth ?? 0);
                option.textContent = `${indent}${folder.name}`;
                option.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    this.moveProjectToFolder(ode.odeId, folder.uuid);
                });
                picker.append(option);
            }

            document.body.append(picker);
            this._openFolderPicker = picker;
            this._positionFolderPicker(picker, anchorEl);

            // Close on outside click, deferred so this same click doesn't close it immediately
            setTimeout(() => {
                document.addEventListener('click', () => this.closeFolderPicker(), { once: true });
            }, 0);

            // The picker's position is computed once, at open time. If the
            // (scrollable) project list scrolls underneath it, close it
            // rather than let it visually drift away from the row it
            // belongs to.
            const scrollParent = this.modalElementBodyContent?.querySelector('.ode-files-list');
            scrollParent?.addEventListener('scroll', () => this.closeFolderPicker(), { once: true });
        }

        /**
         * Position the folder picker as a fixed-position element anchored to
         * the button that opened it: right-aligned under the button, or
         * above it if it wouldn't fit below the viewport.
         * @param {HTMLElement} picker
         * @param {HTMLElement} anchorEl
         */
        _positionFolderPicker(picker, anchorEl) {
            const anchorRect = anchorEl.getBoundingClientRect();
            const pickerRect = picker.getBoundingClientRect();
            const margin = 4;

            let top = anchorRect.bottom + margin;
            if (top + pickerRect.height > window.innerHeight) {
                top = anchorRect.top - pickerRect.height - margin;
            }

            let left = anchorRect.right - pickerRect.width;
            if (left < margin) {
                left = margin;
            }

            picker.style.top = `${top}px`;
            picker.style.left = `${left}px`;
        }

        /**
         * Remove the open folder picker popover, if any
         */
        closeFolderPicker() {
            if (this._openFolderPicker) {
                this._openFolderPicker.remove();
                this._openFolderPicker = null;
            }
        }

        /**
         * Also close any open per-project folder-filing picker when the
         * modal itself closes — it's portalled to document.body (see
         * showFolderPicker), so it wouldn't otherwise be hidden along with
         * the rest of the modal's DOM subtree.
         * @param {boolean} [confirm]
         */
        close(confirm) {
            this.closeFolderPicker();
            super.close(confirm);
        }

        /**
         * File (or unfile, when folderUuid is null) a project via the API and
         * refresh the list
         * @param {string} projectUuid
         * @param {string|null} folderUuid
         */
        async moveProjectToFolder(projectUuid, folderUuid) {
            this.closeFolderPicker();
            const result = await eXeLearning.app.api.assignProjectFolder(projectUuid, folderUuid);
            if (!result.success) {
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: result.message || _('An error occurred while moving the project.'),
                    contentId: 'error',
                });
                return;
            }
            await this.refreshList();
        }

        /**
         * Delete multiple projects by UUID
         * @param {string[]} projectUuids
         */
        async massiveDeleteOdeFileEvent(projectUuids) {
            try {
                for (const uuid of projectUuids) {
                    await eXeLearning.app.api.deleteProject(uuid);
                }
                await this.refreshList();
            } catch (error) {
                console.error('[ProjectList] Massive delete error:', error);
            }
        }

        makeDeleteButtonFooter(odeFiles) {
            this.confirmButton.innerHTML = _('Delete');
            this.confirmButton.disabled = false;
            this.confirmButton.classList.remove('disabled');
            // No-op for "Abrir" (never has this class); reveals "Gestionar
            // proyectos"'s confirm button, which is d-none until something is
            // selected, since it has no "Open" role to fall back to.
            this.confirmButton.classList.remove('d-none');
            this.setConfirmExec(() => this.showMassDeleteConfirmation(odeFiles));
            this._updateBulkMoveButtonState(odeFiles);
        }

        /**
         * Show confirmation dialog before mass deleting projects
         * @param {string[]} projectUuids
         */
        showMassDeleteConfirmation(projectUuids) {
            const count = projectUuids.length;
            const message =
                count === 1
                    ? _('Are you sure you want to delete this project?')
                    : _('Are you sure you want to delete %s projects?').replace('%s', count);

            eXeLearning.app.modals.confirm.show({
                title: _('Delete projects'),
                body: `<p>${message}</p><p class="text-danger"><strong>${_('This action cannot be undone.')}</strong></p>`,
                confirmExec: async () => {
                    // See the comment in renameOdeFileEvent(): modalConfirm.show()
                    // closed this dashboard modal, so it must be re-shown before we
                    // keep operating on it.
                    this.modal.show();
                    await this.massiveDeleteOdeFileEvent(projectUuids);
                    const selectAllCheckbox = this.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = false;
                        selectAllCheckbox.indeterminate = false;
                    }
                },
                cancelExec: () => this.modal.show(),
                closeExec: () => this.modal.show(),
                confirmLabel: _('Delete'),
                confirmClass: 'btn-danger',
            });
        }

        removeDeleteButtonFooter(odeFiles) {
            if (odeFiles.length === 0) {
                this._resetConfirmButtonToDefault();
            }
            this._updateBulkMoveButtonState(odeFiles);
        }

        /**
         * Hook: called whenever the bulk checkbox selection changes (shown or
         * hidden alongside the delete footer button). No-op by default;
         * "Gestionar proyectos" overrides this to show/hide its "Move to
         * folder" bulk-action button — bulk reorganization is management,
         * which "Abrir" deliberately doesn't do.
         * @param {string[]} _odeFiles
         */
        _updateBulkMoveButtonState(_odeFiles) {}

        /**
         * Restore the confirm button to its default (nothing selected) state.
         * Safe default: just disable it. "Abrir" overrides this to restore its
         * "Open" label/handler.
         */
        _resetConfirmButtonToDefault() {
            this.confirmButton.disabled = true;
            this.confirmButton.classList.add('disabled');
        }

        /**
         * Open a project by its UUID, respecting unsaved changes in the
         * currently-open document (if any).
         * @param {string} projectUuid
         */
        async openUserOdeFilesEvent(projectUuid) {
            const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
            const hasUnsaved = yjsBridge?.documentManager?.hasUnsavedChanges?.() || false;

            if (hasUnsaved) {
                this.close();
                eXeLearning.app.modals.sessionlogout.show({
                    title: _('Open project'),
                    forceOpen: _('Open without saving'),
                    pendingAction: { action: 'open', projectUuid },
                });
                return;
            }

            this.close();

            if (eXeLearning.app.project?.transitionToProject) {
                await eXeLearning.app.project.transitionToProject({
                    action: 'open',
                    projectUuid,
                    skipSave: true,
                });
            } else {
                window.UnsavedChangesHelper?.removeBeforeUnloadHandler();
                window.onbeforeunload = null;
                const basePath = window.eXeLearning?.config?.basePath || '';
                window.location.href = `${basePath}/workarea?project=${projectUuid}`;
            }
        }

        typesetTitles() {
            if (typeof MathJax === 'undefined' || !MathJax.typesetPromise) {
                return;
            }

            const titles = this.modalElementBodyContent.querySelectorAll('.ode-file-title');
            if (titles.length === 0) {
                return;
            }

            const latexPattern = /\\[()[\]]|\\begin\{/;
            const titlesWithLatex = Array.from(titles).filter((el) => latexPattern.test(el.textContent));

            if (titlesWithLatex.length > 0) {
                MathJax.typesetPromise(titlesWithLatex).catch((err) => {
                    console.warn('[ProjectList] MathJax typeset error:', err);
                });
            }
        }

        /**
         * Build the read-only folder navigation tree. Folder *management*
         * (create/rename/delete) is never wired here — see
         * projectFolderActions.js/manageProjectsTreeActions.js for that,
         * layered on top via _afterFolderTreeRender in "Gestionar proyectos".
         * @returns {HTMLElement}
         */
        makeFolderTree() {
            const wrap = document.createElement('div');
            wrap.classList.add('project-folder-tree-wrap');
            this.folderTreeContainer = wrap;
            this._renderFolderTree();
            return wrap;
        }

        /**
         * Wrap the folder tree into the dashboard's left sidebar column,
         * pinned to the full height of the dialog (the two-pane
         * .modal-dashboard-* layout in _modals.scss stretches it to match
         * whichever of the tabs/search header or the project list ends up
         * taller). Optional extra content — "Gestionar proyectos"'s "New
         * folder" button — is appended below the tree.
         * @param {HTMLElement} [extraContent]
         * @returns {HTMLElement}
         */
        makeFolderSidebar(extraContent) {
            const sidebar = document.createElement('div');
            sidebar.classList.add('modal-dashboard-sidebar');
            sidebar.append(this.makeFolderTree());
            if (extraContent) {
                sidebar.append(extraContent);
            }
            return sidebar;
        }

        /**
         * Rebuild the folder tree DOM from this.folders, preserving expand
         * state (this.expandedFolderUuids) and the current selection.
         */
        _renderFolderTree() {
            if (!this.folderTreeContainer) {
                return;
            }
            this.folderTreeContainer.innerHTML = '';
            const tree = buildProjectFolderTree({
                folders: this.folders,
                selectedValue: this.currentFolderUuid ?? '',
                unfiledValue: this.UNFILED_FOLDER_VALUE,
                expandedUuids: this.expandedFolderUuids,
                draggable: this._isDraggableFolderTree(),
            });
            attachProjectTreeBehaviour(tree, {
                onSelect: (value) => this.applyFolderFilter(value),
                onToggleExpand: (uuid, expanded) => {
                    if (expanded) {
                        this.expandedFolderUuids.add(uuid);
                    } else {
                        this.expandedFolderUuids.delete(uuid);
                    }
                    this._renderFolderTree();
                },
            });
            this.folderTreeContainer.append(tree);
            this._afterFolderTreeRender(tree);
        }

        /**
         * Whether folder rows should be draggable. False by default;
         * "Gestionar proyectos" overrides this to enable reparenting by drag.
         * @returns {boolean}
         */
        _isDraggableFolderTree() {
            return false;
        }

        /**
         * Called after the folder tree DOM is (re)built. No-op by default;
         * "Gestionar proyectos" overrides this to wire drag-and-drop and the
         * "Move to…" action (see manageProjectsTreeActions.js).
         * @param {HTMLElement} _treeRoot
         */
        _afterFolderTreeRender(_treeRoot) {}

        /**
         * Apply a folder filter value coming from the tree ('' = all,
         * UNFILED_FOLDER_VALUE = unfiled, otherwise a folder uuid) and re-render.
         * @param {string} value
         */
        applyFolderFilter(value) {
            this.currentFolderUuid = value === '' ? null : value;
            this._renderFolderTree();
            this._rerenderList();
        }

        /**
         * Refresh the project list without closing the modal: fetches
         * updated data from the API and re-renders the tabs, folder tree,
         * and list.
         */
        async refreshList() {
            try {
                const response = await eXeLearning.app.api.getUserOdeFiles();
                if (response && response.odeFiles) {
                    this.allOdeFilesData = response.odeFiles;
                    this.folders = this.allOdeFilesData.folders || [];
                    this._renderFolderTree();
                    this.updateTabCounts();
                    this.switchTab(this.currentTab);
                    this.selectedProjectUuid = null;
                    this._resetConfirmButtonToDefault();
                    this.odeFiles = [];
                    this.removeDeleteButtonFooter(this.odeFiles);
                }
            } catch (error) {
                console.error('[ProjectList] Error refreshing list:', error);
            }
        }
    };

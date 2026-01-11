import Modal from '../modal.js';
import ImportProgress from '../../../interface/importProgress.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class modalOpenUserOdeFiles extends Modal {
    constructor(manager) {
        super(manager, 'modalOpenUserOdeFiles', undefined, false);

        this.modalElementBodyContent = this.modalElementBody.querySelector(
            '.modal-body-content'
        );
        this.modalFooterContent =
            this.modalElement.querySelector('.modal-footer');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );

        this.odeFiles = [];
        this.uploadLimits = null; // Cache for upload limits
        this.allOdeFilesData = null; // Store all projects data for tab filtering
        this.currentTab = 'my-projects'; // Current active tab
        this.selectedProjectUuid = null; // Currently selected project UUID

        // Load upload limits when modal is created
        this.loadUploadLimits();
    }

    /**
     * Load upload limits from server
     * This is cached to avoid repeated API calls
     */
    async loadUploadLimits() {
        try {
            this.uploadLimits = await eXeLearning.app.api.getUploadLimits();
        } catch (error) {
            console.error('Failed to load upload limits:', error);
            // Set a reasonable default if API call fails
            this.uploadLimits = {
                maxFileSize: 100 * 1024 * 1024, // 100MB default
                maxFileSizeFormatted: '100 MB',
            };
        }
    }

    /**
     * Validate file size before upload
     *
     * @param {File} file - The file to validate
     * @returns {boolean} - true if file is valid, false otherwise
     */
    validateFileSize(file) {
        if (!this.uploadLimits) {
            console.warn('Upload limits not loaded yet, skipping validation');
            return true; // Allow upload if limits not loaded yet
        }

        if (file.size > this.uploadLimits.maxFileSize) {
            const fileSizeFormatted = this.formatBytes(file.size);
            const errorMessage = _(
                'File size ({fileSize}) exceeds the maximum allowed size ({maxSize}).'
            )
                .replace('{fileSize}', fileSizeFormatted)
                .replace('{maxSize}', this.uploadLimits.maxFileSizeFormatted);

            eXeLearning.app.modals.alert.show({
                title: _('File too large'),
                body: errorMessage,
                contentId: 'error',
            });

            return false;
        }

        return true;
    }

    /**
     * Format bytes to human-readable format
     *
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size (e.g., "512 MB")
     */
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        bytes = Math.max(bytes, 0);
        const pow = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
        const powCapped = Math.min(pow, units.length - 1);
        const value = bytes / Math.pow(1024, powCapped);

        return `${value.toFixed(2)} ${units[powCapped]}`;
    }

    show(data = {}) {
        this.titleDefault = _('Open project');
        this.odeFiles = [];
        this.removeDeleteButtonFooter(this.odeFiles);
        this.currentTab = 'my-projects'; // Reset to default tab
        this.selectedProjectUuid = null; // Reset selection

        // Disable Open button until a project is selected
        this.confirmButton.disabled = true;
        this.confirmButton.classList.add('disabled');

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        this.modalElementBodyContent.innerHTML = '';
        setTimeout(() => {
            data = data || {};
            this.setTitle(this.titleDefault);

            // Store all projects data for tab filtering
            this.allOdeFilesData = data['odeFiles'];

            const modalActions = this.makeModalActions();
            this.setBodyElement(modalActions);
            const bodyContent = this.makeElementListOdeFiles(this.allOdeFilesData);
            this.setBodyElement(bodyContent);

            const footerContent = this.makeFooterElement(data);
            if (eXeLearning.config.isOfflineInstallation === false) {
                this.setFooterElement(footerContent);
            }
            this.modal.show();
            // Typeset LaTeX in project titles after modal is shown
            this.typesetTitles();
        }, time);
    }

    setBodyElement(bodyElement) {
        this.modalElementBodyContent.append(bodyElement);
    }

    setFooterElement(footerElement) {
        const firstChild =
            this.modalFooterContent.querySelector('.btn-primary');
        const old = this.modalFooterContent.querySelector('.progress-bar-div');
        if (old) old.remove();
        this.modalFooterContent.insertBefore(footerElement, firstChild);
    }

    /*******************************************************************************
     * COMPOSE
     *******************************************************************************/

    makeModalActions() {
        const modalActions = document.createElement('div');
        modalActions.classList.add('modal-actions');

        // Add tabs for "My Projects" and "Shared with me"
        const tabsContainer = this.makeProjectTabs();
        modalActions.append(tabsContainer);

        modalActions.append(
            this.makeFilterForList('.ode-title', _('Search saved projects...'))
        );
        modalActions.append(this.makeUploadInput());
        return modalActions;
    }

    /**
     * Create tabs for filtering projects by ownership
     * @returns {HTMLElement}
     */
    makeProjectTabs() {
        const tabsContainer = document.createElement('div');
        tabsContainer.classList.add('ode-project-tabs');

        // Count projects by role
        const counts = this.countProjectsByRole();

        // "My Projects" tab
        const myProjectsTab = document.createElement('button');
        myProjectsTab.type = 'button';
        myProjectsTab.classList.add('ode-project-tab', 'active');
        myProjectsTab.setAttribute('data-tab', 'my-projects');
        myProjectsTab.innerHTML = `${_('My Projects')} <span class="ode-tab-count">(${counts.owned})</span>`;
        myProjectsTab.addEventListener('click', () => this.switchTab('my-projects'));

        // "Shared with me" tab
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

        // Group by odeId first (to count unique projects, not versions)
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

        // Update tab button states
        const tabs = this.modalElementBodyContent.querySelectorAll('.ode-project-tab');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });

        // Show/hide Select All checkbox based on tab
        const selectAllWrap = this.modalElementBodyContent.querySelector('.ode-select-all-wrap');
        if (selectAllWrap) {
            selectAllWrap.style.display = tabName === 'my-projects' ? 'flex' : 'none';
        }

        // Reset Select All checkbox state
        const selectAllCheckbox = this.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }

        // Clear selection when switching tabs
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
        // Typeset LaTeX in project titles after tab switch
        this.typesetTitles();
    }

    makeFooterElement(data) {
        return this.showFreeDiskSpace(data['odeFiles']);
    }

    makeElementListOdeFiles(data) {
        if (
            !data ||
            !data.odeFilesSync ||
            Object.keys(data.odeFilesSync).length === 0
        ) {
            const empty = document.createElement('div');
            empty.className = 'alert alert-info mt-3';
            empty.innerHTML = this.currentTab === 'my-projects'
                ? _('No recent projects found.')
                : _('No projects have been shared with you yet.');
            return empty;
        }

        // Filter projects based on current tab
        const filteredOdeFilesSync = {};
        for (const [key, ode] of Object.entries(data.odeFilesSync)) {
            const isOwner = ode.role === 'owner';
            if (this.currentTab === 'my-projects' && isOwner) {
                filteredOdeFilesSync[key] = ode;
            } else if (this.currentTab === 'shared-with-me' && !isOwner) {
                filteredOdeFilesSync[key] = ode;
            }
        }

        // Check if filtered list is empty
        if (Object.keys(filteredOdeFilesSync).length === 0) {
            const empty = document.createElement('div');
            empty.className = 'alert alert-info mt-3';
            empty.innerHTML = this.currentTab === 'my-projects'
                ? _('No recent projects found.')
                : _('No projects have been shared with you yet.');
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
            odes.sort(
                (a, b) =>
                    parseInt(b.versionName || '0') -
                    parseInt(a.versionName || '0')
            );
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

        const row = this.renderOdeRow(
            principal,
            { principal: true },
            others.length !== 0
        );
        group.append(row);

        const versions = document.createElement('div');
        versions.classList.add('ode-versions');
        versions.hidden = true;

        for (const ode of others) {
            versions.append(
                this.renderOdeRow(ode, { principal: false }, false)
            );
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

        const checkWrap = document.createElement('div');
        checkWrap.classList.add('ode-check-wrap');
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
        title.textContent =
            ode.title && ode.title !== '' ? ode.title : ode.fileName;

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
        if (ode.role && ode.role !== 'owner' && ode.ownerEmail) {
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

        // Check if this is a shared project (user is not owner)
        const isSharedProject = ode.role && ode.role !== 'owner';

        // Copy/Duplicate button - shown for all projects
        const copyBtn = document.createElement('button');
        copyBtn.className =
            'exe-icon open-user-ode-file-action open-user-ode-file-action-copy';
        copyBtn.title = isSharedProject ? _('Clone to my projects') : _('Duplicate');
        copyBtn.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">\n' +
            '  <path d="M5.33333 5.33333V3.46667C5.33333 2.71993 5.33333 2.34656 5.47866 2.06135C5.60649 1.81047 5.81047 1.60649 6.06135 1.47866C6.34656 1.33333 6.71993 1.33333 7.46667 1.33333H12.5333C13.2801 1.33333 13.6534 1.33333 13.9387 1.47866C14.1895 1.60649 14.3935 1.81047 14.5213 2.06135C14.6667 2.34656 14.6667 2.71993 14.6667 3.46667V8.53333C14.6667 9.28007 14.6667 9.65344 14.5213 9.93865C14.3935 10.1895 14.1895 10.3935 13.9387 10.5213C13.6534 10.6667 13.2801 10.6667 12.5333 10.6667H10.6667M3.46667 14.6667H8.53333C9.28007 14.6667 9.65344 14.6667 9.93865 14.5213C10.1895 14.3935 10.3935 14.1895 10.5213 13.9387C10.6667 13.6534 10.6667 13.2801 10.6667 12.5333V7.46667C10.6667 6.71993 10.6667 6.34656 10.5213 6.06135C10.3935 5.81047 10.1895 5.60649 9.93865 5.47866C9.65344 5.33333 9.28007 5.33333 8.53333 5.33333H3.46667C2.71993 5.33333 2.34656 5.33333 2.06135 5.47866C1.81047 5.60649 1.60649 5.81047 1.47866 6.06135C1.33333 6.34656 1.33333 6.71993 1.33333 7.46667V12.5333C1.33333 13.2801 1.33333 13.6534 1.47866 13.9387C1.60649 14.1895 1.81047 14.3935 2.06135 14.5213C2.34656 14.6667 2.71993 14.6667 3.46667 14.6667Z" stroke="#1D1D1D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>\n' +
            '</svg>';
        copyBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            this.duplicateOdeFileEvent(ode.odeId);
        });
        actions.append(copyBtn);

        // Delete button - only shown for owned projects
        if (!isSharedProject) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className =
                'exe-icon open-user-ode-file-action open-user-ode-file-action-delete';
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
            this.modalElement
                .querySelectorAll('.ode-row')
                .forEach((r) => r.classList.remove('selected'));
            row.classList.add('selected');

            // Enable the Open button and store selected project
            this.selectedProjectUuid = ode.odeId;
            this.confirmButton.disabled = false;
            this.confirmButton.classList.remove('disabled');
        });
        row.addEventListener('dblclick', () => {
            setTimeout(
                () => this.openUserOdeFilesEvent(ode.odeId),
                this.timeMax
            );
        });

        row.append(checkWrap, icon, info, actions);
        return row;
    }

    makeFilterForList(selector, placeholder) {
        const wrap = document.createElement('div');
        wrap.classList.add('ode-filter-wrap');

        // Select All checkbox (only visible for "My Projects" tab)
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
            Logger.log(groups);
            groups.forEach((group) => {
                const titles = group.querySelectorAll('.ode-title');
                Logger.log(titles);
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

    showFreeDiskSpace(data) {
        const progressBarDiv = document.createElement('div');
        const fullBarDiv = document.createElement('div');
        const textElementBarDiv = document.createElement('p');
        fullBarDiv.classList.add('progress-bar-div');

        // Handle case where disk space info is not available (Yjs projects)
        if (!data || !data.maxDiskSpaceFormatted || data.maxDiskSpace === 0) {
            // Return empty element - disk space not applicable for Yjs architecture
            return fullBarDiv;
        }

        const maxValue = data.maxDiskSpaceFormatted;
        const valueNow = data.usedSpaceFormatted;
        const percentage = (data.usedSpace * 100) / data.maxDiskSpace;

        progressBarDiv.classList.add('progress');

        let baseBarText = _('%s of %s used');
        baseBarText = baseBarText.replace('%s', valueNow);
        baseBarText = baseBarText.replace('%s', maxValue);
        textElementBarDiv.innerHTML = baseBarText;

        textElementBarDiv.append(progressBarDiv);
        fullBarDiv.appendChild(textElementBarDiv);

        const progressBar = this.makeProgressBar(
            maxValue,
            valueNow,
            percentage
        );
        progressBarDiv.appendChild(progressBar);

        return fullBarDiv;
    }

    makeProgressBar(maxValue, valueNow, percentage) {
        const progressBar = document.createElement('div');
        if (percentage > 85) {
            progressBar.setAttribute(
                'class',
                'progress-bar progress-bar-striped bg-danger'
            );
        } else if (percentage > 50) {
            progressBar.setAttribute(
                'class',
                'progress-bar progress-bar-striped bg-warning'
            );
        } else {
            progressBar.setAttribute(
                'class',
                'progress-bar progress-bar-striped bg-success'
            );
        }
        progressBar.setAttribute('role', 'progressbar');
        progressBar.setAttribute('style', 'width:' + percentage + '%');
        progressBar.setAttribute('aria-valuenow', valueNow);
        progressBar.setAttribute('aria-valuemin', '0');
        progressBar.setAttribute('aria-valuemax', maxValue);
        return progressBar;
    }

    openSelectedOdeFile() {
        const selected = this.modalElementBody.querySelector(
            '.ode-row.selected .ode-file-title'
        );
        const odeFileName = selected ? selected.id : null;
        if (odeFileName) {
            setTimeout(
                () => this.openUserOdeFilesEvent(odeFileName),
                this.timeMax
            );
        }
    }

    /**
     * Open a project by its UUID
     * For Yjs projects: redirects to /workarea?project={uuid}
     * @param {string} projectUuid - The project UUID
     */
    async openUserOdeFilesEvent(projectUuid) {
        // Check for unsaved changes using Yjs mechanism
        const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
        const hasUnsaved =
            yjsBridge?.documentManager?.hasUnsavedChanges?.() || false;

        if (hasUnsaved) {
            // Close the open files modal first
            this.close();

            // Show confirmation modal with save option
            const data = {
                title: _('Open project'),
                forceOpen: _('Open without saving'),
                openYjsProject: true,
                projectUuid: projectUuid,
            };
            eXeLearning.app.modals.sessionlogout.show(data);
            return;
        }

        // No unsaved changes, proceed with navigation
        // Close modal
        this.close();

        // Clear beforeunload handler to prevent browser dialog
        window.onbeforeunload = null;

        // Redirect to workarea with project UUID
        Logger.log(`[OpenProject] Opening project: ${projectUuid}`);
        const basePath = window.eXeLearning?.config?.basePath || '';
        window.location.href = `${basePath}/workarea?project=${projectUuid}`;
    }

    /**
     * Get auth token from available sources
     * @returns {string|null}
     */
    getAuthToken() {
        return eXeLearning?.app?.project?._yjsBridge?.authToken ||
               eXeLearning?.app?.auth?.getToken?.() ||
               eXeLearning?.config?.token ||
               localStorage.getItem('authToken');
    }

    /**
     * Refresh the project list without closing the modal
     * Fetches updated data from API and re-renders the list
     */
    async refreshList() {
        try {
            const response = await eXeLearning.app.api.getUserOdeFiles();
            if (response && response.odeFiles) {
                this.allOdeFilesData = response.odeFiles;
                // Update tab counts
                this.updateTabCounts();
                // Re-render the current tab
                this.switchTab(this.currentTab);
                // Clear selection and disable Open button
                this.selectedProjectUuid = null;
                this.confirmButton.disabled = true;
                this.confirmButton.classList.add('disabled');
                // Clear checkboxes selection
                this.odeFiles = [];
                this.removeDeleteButtonFooter(this.odeFiles);
            }
        } catch (error) {
            console.error('[OpenProject] Error refreshing list:', error);
        }
    }

    /**
     * Update the tab counts without re-rendering the tabs
     */
    updateTabCounts() {
        const counts = this.countProjectsByRole();

        const tabs = this.modalElementBodyContent.querySelectorAll('.ode-project-tab');
        tabs.forEach(tab => {
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
     * @param {boolean} checked - Whether to select or deselect all
     */
    toggleSelectAll(checked) {
        // Only allow selection in "My Projects" tab
        if (this.currentTab !== 'my-projects') {
            return;
        }

        const checkboxes = this.modalElementBodyContent.querySelectorAll(
            '.ode-files-list .ode-row.principal-version .ode-check'
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

        // Update button state
        this.updateDeleteButtonState();
    }

    /**
     * Update the delete/open button state based on current selection
     * This ensures the button always reflects the current odeFiles array
     */
    updateDeleteButtonState() {
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
            '.ode-files-list .ode-row.principal-version .ode-check'
        );
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

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
     * Select a project in the list by its UUID
     * @param {string} projectUuid - The project UUID to select
     */
    selectProjectByUuid(projectUuid) {
        // Find the row with this UUID
        const row = this.modalElementBodyContent.querySelector(
            `.ode-row[ode-id="${projectUuid}"]`
        );

        if (row) {
            // Remove selection from all rows
            this.modalElement
                .querySelectorAll('.ode-row')
                .forEach((r) => r.classList.remove('selected'));

            // Select this row
            row.classList.add('selected');

            // Update state and enable Open button
            this.selectedProjectUuid = projectUuid;
            this.confirmButton.disabled = false;
            this.confirmButton.classList.remove('disabled');

            // Scroll the row into view
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Delete a project by UUID
     * @param {string} projectUuid - The project UUID to delete
     */
    async deleteOdeFileEvent(projectUuid) {
        try {
            const apiUrl = eXeLearning.app.api.apiUrlBase + eXeLearning.app.api.apiUrlBasePath;
            const authToken = this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/projects/uuid/${projectUuid}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
            });
            const resp = await response.json();
            if (resp.responseMessage === 'OK' || resp.success) {
                // Refresh the list without closing the modal
                await this.refreshList();
            }
        } catch (error) {
            console.error('[OpenProject] Delete error:', error);
        }
    }

    /**
     * Show inline delete confirmation in a project row
     * @param {HTMLElement} row - The project row element
     * @param {Object} ode - The project data
     */
    showInlineDeleteConfirmation(row, ode) {
        // Check if already showing confirmation
        if (row.classList.contains('ode-row--confirming')) {
            return;
        }

        // Store original content
        const originalContent = row.innerHTML;
        row.classList.add('ode-row--confirming');

        // Create confirmation UI
        const confirmContent = document.createElement('div');
        confirmContent.classList.add('ode-delete-confirm');
        confirmContent.innerHTML = `
            <span class="ode-delete-confirm-text">${_('Delete this project?')}</span>
            <div class="ode-delete-confirm-actions">
                <button type="button" class="btn btn-sm btn-danger ode-delete-confirm-yes">${_('Delete')}</button>
                <button type="button" class="btn btn-sm btn-secondary ode-delete-confirm-no">${_('Cancel')}</button>
            </div>
        `;

        // Clear row and add confirmation
        row.innerHTML = '';
        row.append(confirmContent);

        // Handle confirm
        const confirmBtn = confirmContent.querySelector('.ode-delete-confirm-yes');
        confirmBtn.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            // Show loading state
            confirmBtn.disabled = true;
            confirmBtn.textContent = _('Deleting...');
            await this.deleteOdeFileEvent(ode.odeId);
        });

        // Handle cancel
        const cancelBtn = confirmContent.querySelector('.ode-delete-confirm-no');
        cancelBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            row.classList.remove('ode-row--confirming');
            row.innerHTML = originalContent;
            // Re-bind event listeners by refreshing the list
            this.switchTab(this.currentTab);
        });
    }

    /**
     * Duplicate a project by UUID
     * @param {string} projectUuid - The project UUID to duplicate
     */
    async duplicateOdeFileEvent(projectUuid) {
        try {
            const apiUrl = eXeLearning.app.api.apiUrlBase + eXeLearning.app.api.apiUrlBasePath;
            const authToken = this.getAuthToken();

            const response = await fetch(`${apiUrl}/api/projects/uuid/${projectUuid}/duplicate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
                },
                credentials: 'include',
            });
            const resp = await response.json();
            if (resp.responseMessage === 'OK' || resp.success) {
                // Get the new project UUID from the response
                const newProjectUuid = resp.data?.uuid;

                // Refresh the list without closing the modal
                await this.refreshList();

                // Switch to "My Projects" tab since the duplicate is owned by the user
                if (this.currentTab !== 'my-projects') {
                    this.switchTab('my-projects');
                }

                // Select the newly duplicated project
                if (newProjectUuid) {
                    this.selectProjectByUuid(newProjectUuid);
                }
            } else {
                console.error('[OpenProject] Duplicate error:', resp.message);
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: resp.message || _('An error occurred while duplicating the project.'),
                    contentId: 'error',
                });
            }
        } catch (error) {
            console.error('[OpenProject] Duplicate error:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                body: _('An error occurred while duplicating the project.'),
                contentId: 'error',
            });
        }
    }

    /**
     * Delete multiple projects by UUID
     * @param {string[]} projectUuids - Array of project UUIDs to delete
     */
    async massiveDeleteOdeFileEvent(projectUuids) {
        try {
            const apiUrl = eXeLearning.app.api.apiUrlBase + eXeLearning.app.api.apiUrlBasePath;
            const authToken = this.getAuthToken();

            // Delete each project sequentially
            for (const uuid of projectUuids) {
                await fetch(`${apiUrl}/api/projects/uuid/${uuid}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
                    },
                    credentials: 'include',
                });
            }
            // Refresh the list without closing the modal
            await this.refreshList();
        } catch (error) {
            console.error('[OpenProject] Massive delete error:', error);
        }
    }

    async openUserOdeFilesWithOpenSession(id) {
        const params = {
            elpFileName: id,
            forceCloseOdeUserPreviousSession: '1',
            odeSessionId: eXeLearning.app.project.odeSession,
        };
        const response = await eXeLearning.app.api.postSelectedOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeId = response.odeId;
            await eXeLearning.app.project.openLoad();
            this.loadOdeTheme(response);
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Error opening'),
                    body: response.responseMessage || _('An error occurred while opening the file.'),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    makeDeleteButtonFooter(odeFiles) {
        this.confirmButton.innerHTML = _('Delete');
        this.confirmButton.disabled = false;
        this.confirmButton.classList.remove('disabled');
        this.setConfirmExec(() => this.showMassDeleteConfirmation(odeFiles));
    }

    /**
     * Show confirmation dialog before mass deleting projects
     * @param {string[]} projectUuids - Array of project UUIDs to delete
     */
    showMassDeleteConfirmation(projectUuids) {
        const count = projectUuids.length;
        const message = count === 1
            ? _('Are you sure you want to delete this project?')
            : _('Are you sure you want to delete %s projects?').replace('%s', count);

        eXeLearning.app.modals.confirm.show({
            title: _('Delete projects'),
            body: `<p>${message}</p><p class="text-danger"><strong>${_('This action cannot be undone.')}</strong></p>`,
            confirmExec: async () => {
                await this.massiveDeleteOdeFileEvent(projectUuids);
                // Reset Select All checkbox after deletion
                const selectAllCheckbox = this.modalElementBodyContent.querySelector('#ode-select-all-checkbox');
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = false;
                    selectAllCheckbox.indeterminate = false;
                }
            },
            confirmLabel: _('Delete'),
            confirmClass: 'btn-danger',
        });
    }

    removeDeleteButtonFooter(odeFiles) {
        if (odeFiles.length === 0) {
            this.confirmButton.innerHTML = _('Open');
            this.setConfirmExec(() => this.openSelectedOdeFile());
            // Disable the button if no project is selected for opening
            if (!this.selectedProjectUuid) {
                this.confirmButton.disabled = true;
                this.confirmButton.classList.add('disabled');
            }
        }
    }

    makeUploadInput() {
        const uploadDiv = document.createElement('div');
        uploadDiv.id = 'local-ode-file-upload-div';

        const inputUpload = document.createElement('input');
        inputUpload.classList.add('local-ode-file-upload-input', 'd-none');
        inputUpload.type = 'file';
        inputUpload.name = 'local-ode-file-upload';
        inputUpload.id = 'local-ode-modal-file-upload';
        inputUpload.accept = '.' + eXeLearning.extension + ',.elpx,.elp,.zip,.epub';
        inputUpload.addEventListener('change', () => {
            const file = inputUpload.files[0];
            if (file) {
                // Validate file size BEFORE attempting upload
                if (!this.validateFileSize(file)) {
                    // Clear the input so user can select a different file
                    inputUpload.value = '';
                    return;
                }
                this.largeFilesUpload(file);
            }
        });

        let label = document.createElement('label');
        label.setAttribute('for', inputUpload.id);
        label.classList.add('visually-hidden');
        label.textContent = _('Upload iDevice file');

        const buttonUpload = document.createElement('button');
        buttonUpload.classList.add(
            'ode-files-button-upload',
            'btn',
            'button-secondary',
            'd-flex',
            'align-items-center',
            'justify-content-start'
        );
        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'import-icon');
        buttonUpload.append(icon, _('Select a file from your device'));
        buttonUpload.addEventListener('click', () => inputUpload.click());

        const inputMultiple = document.createElement('input');
        inputMultiple.classList.add(
            'multiple-local-ode-file-upload-input',
            'd-none'
        );
        inputMultiple.type = 'file';
        inputMultiple.multiple = true;
        inputMultiple.name = 'multiple-local-ode-file-upload';
        inputMultiple.id = 'multiple-local-modal-ode-file-upload';
        inputMultiple.accept = '.elpx,.elp,.zip';
        inputMultiple.addEventListener('change', () => {
            if (inputMultiple.files?.length) {
                // Validate each file size BEFORE attempting upload
                const invalidFiles = [];
                for (const file of inputMultiple.files) {
                    if (!this.validateFileSize(file)) {
                        invalidFiles.push(file.name);
                    }
                }

                if (invalidFiles.length > 0) {
                    // Clear the input so user can select different files
                    inputMultiple.value = '';
                    return;
                }

                this.uploadOdeFilesToServer(inputMultiple.files);
            }
        });

        let labelMultiple = document.createElement('label');
        labelMultiple.setAttribute('for', inputMultiple.id);
        labelMultiple.classList.add('visually-hidden');
        labelMultiple.textContent = _('Upload iDevice file');

        uploadDiv.append(
            label,
            inputUpload,
            labelMultiple,
            inputMultiple,
            buttonUpload
        );
        return uploadDiv;
    }

    async largeFilesUpload(
        odeFile,
        isImportIdevices = false,
        isImportProperties = false,
        skipSessionCheck = false,
        forceCloseSession = false
    ) {
        let response = [];
        let odeFileName = odeFile.name;

        if (isImportIdevices) {
            if (
                !odeFileName.includes('.idevice') &&
                !odeFileName.includes('.block')
            ) {
                return setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: _('The content is not a box or an iDevice'),
                        contentId: 'error',
                    });
                }, this.timeMax);
            }

            // === CLIENT-SIDE IMPORT: Process .idevice/.block files directly in browser ===
            try {
                Logger.log(`[ComponentImport] Importing ${odeFileName} client-side...`);

                // Get document manager and asset manager from Yjs bridge
                const documentManager = eXeLearning.app.project._yjsBridge?.getDocumentManager();
                const assetManager = eXeLearning.app.project._yjsBridge?.assetManager;

                if (!documentManager) {
                    throw new Error('Yjs document manager not available');
                }

                // Create ComponentImporter instance
                const ComponentImporter = window.ComponentImporter;
                if (!ComponentImporter) {
                    throw new Error('ComponentImporter not loaded');
                }

                const importer = new ComponentImporter(documentManager, assetManager);

                // Get current page ID from selected node
                const currentPageId = eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected?.getAttribute('nav-id');
                if (!currentPageId) {
                    throw new Error('No page selected');
                }

                // Close modal before processing
                if (this.modal && this.modal._isShown) {
                    this.close();
                }

                // Import the component file
                const result = await importer.importComponent(odeFile, currentPageId);

                if (result.success) {
                    Logger.log(`[ComponentImport] Import successful, block ID: ${result.blockId}`);
                    // Refresh only the page content (blocks/idevices) - stays on current page
                    await eXeLearning.app.project.idevices.loadApiIdevicesInPage(true);
                } else {
                    throw new Error(result.error || 'Import failed');
                }

                return; // Skip the server upload flow
            } catch (error) {
                console.error('[ComponentImport] Client-side import failed:', error);
                setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: error.message || _('An error occurred while importing the component.'),
                        contentId: 'error',
                    });
                }, this.timeMax);
                return;
            }
            // === END CLIENT-SIDE IMPORT ===
        }

        const hasPreUploadedData =
            skipSessionCheck &&
            forceCloseSession &&
            odeFile &&
            odeFile._preUploadedOdeData &&
            odeFile._preUploadedOdeData.odeFileName &&
            odeFile._preUploadedOdeData.odeFilePath;

        if (hasPreUploadedData) {
            if (this.modal && this.modal._isShown) {
                this.close();
            }

            const progressModal = eXeLearning.app.modals.uploadprogress;
            progressModal.show({
                fileName: odeFile.name,
                fileSize: odeFile.size,
            });
            progressModal.setProcessingPhase('extracting');

            await this.openLocalElpFile(
                odeFile._preUploadedOdeData.odeFileName,
                odeFile._preUploadedOdeData.odeFilePath,
                isImportIdevices,
                progressModal,
                forceCloseSession,
                odeFile
            );
            this.ensureModalBackdropCleared(350);

            return;
        }

        // Check for unsaved changes BEFORE uploading (only for large files and not imports)
        if (!skipSessionCheck && !isImportIdevices && !isImportProperties) {
            // Check for unsaved changes using Yjs mechanism
            const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
            const hasUnsaved =
                yjsBridge?.documentManager?.hasUnsavedChanges?.() || false;

            if (hasUnsaved) {
                // There are unsaved changes - show confirmation modal
                const data = {
                    title: _('Open project'),
                    forceOpen: _('Open without saving'),
                    openOdeFile: true,
                    localOdeFile: true,
                    odeFile: odeFile, // Pass the file object
                    isLargeFile: true,
                };

                // Close open files modal
                if (this.modal && this.modal._isShown) {
                    this.close();
                }

                // Show session logout modal and return (don't upload yet)
                eXeLearning.app.modals.sessionlogout.show(data);
                return;
            }
        }

        // Close the open files modal before showing progress (if it's open)
        if (this.modal && this.modal._isShown) {
            this.close();
        }

        // Show progress modal
        const progressModal = eXeLearning.app.modals.uploadprogress;
        progressModal.show({
            fileName: odeFileName,
            fileSize: odeFile.size,
        });

        // === DIRECT IN-MEMORY PROCESSING: Process file without upload or redirect ===
        // Only for opening ELP files (not import idevices or import properties)
        if (!isImportIdevices && !isImportProperties) {
            try {
                progressModal.setProcessingPhase('extracting');

                // Static mode: skip API call and use ElpxImporter directly
                // Note: Only trigger static mode if capabilities are available AND remote is explicitly false
                const capabilities = eXeLearning?.app?.capabilities;
                if (capabilities && !capabilities.storage.remote) {
                    progressModal.hide();
                    this.cleanupOrphanedBackdrops();

                    // Use YjsBridge.importFromElpx directly (client-side, no server APIs)
                    const yjsBridge = eXeLearning.app.project._yjsBridge;
                    if (!yjsBridge) {
                        throw new Error('Yjs bridge not initialized.');
                    }

                    Logger.log('[OpenFile] Static mode - importing file:', odeFileName);
                    await yjsBridge.importFromElpx(odeFile);

                    // Refresh UI after import (without server calls)
                    if (eXeLearning.app.project?.refreshAfterDirectImport) {
                        await eXeLearning.app.project.refreshAfterDirectImport();
                    }

                    Logger.log('[OpenFile] Static mode import complete:', odeFileName);
                    return;
                }

                // Create a new project via API to get UUID
                const projectTitle = odeFileName.replace(/\.(elp|elpx)$/i, '') || 'Imported Project';
                const basePath = window.eXeLearning?.config?.basePath || '';
                const authToken = this.getAuthToken();
                const createResponse = await fetch(`${basePath}/api/project/create-quick`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
                    },
                    credentials: 'include',
                    body: JSON.stringify({ title: projectTitle })
                });

                const responseText = await createResponse.text();
                let projectData;

                try {
                    projectData = JSON.parse(responseText);
                } catch (e) {
                    console.error('[OpenFile] Failed to parse response:', responseText);
                    throw new Error('Invalid server response');
                }

                if (!createResponse.ok) {
                    console.error('[OpenFile] Failed to create project:', createResponse.status, projectData);
                    throw new Error(projectData.message || `Failed to create project: ${createResponse.status}`);
                }

                Logger.log('[OpenFile] Project data received:', projectData);

                const projectUuid = projectData.uuid;
                if (!projectUuid) {
                    console.error('[OpenFile] No UUID in response:', projectData);
                    throw new Error('Server did not return a project UUID');
                }

                Logger.log(`[OpenFile] Created project ${projectUuid}, processing ELP directly in memory...`);

                // Clear beforeunload handler to prevent browser dialog
                window.onbeforeunload = null;

                // Process file directly in memory without redirect
                try {
                    // Reinitialize Yjs with the new project (keeps everything in memory)
                    // Skip sync wait to avoid delay when opening local ELP files
                    await eXeLearning.app.project.reinitializeWithProject(projectUuid, {
                        skipSyncWait: true,
                    });
                    Logger.log(`[OpenFile] Yjs reinitialized for project ${projectUuid}`);

                    // Hide progress modal before showing inline progress
                    progressModal.hide();
                    this.cleanupOrphanedBackdrops();

                    // Show inline progress in workarea
                    const importProgress = new ImportProgress();
                    importProgress.show();

                    // Import the ELP file directly with progress callback
                    const stats = await eXeLearning.app.project.importElpDirectly(odeFile, {
                        onProgress: (progress) => importProgress.update(progress)
                    });
                    Logger.log(`[OpenFile] Import complete:`, stats);

                    // Hide inline progress
                    importProgress.hide();

                    // Update URL without page reload (wrapped in try-catch to handle browser extensions blocking pushState)
                    try {
                        const basePath = window.eXeLearning?.config?.basePath || '';
                        window.history.pushState({}, '', `${basePath}/workarea?project=${projectUuid}`);
                    } catch (pushStateError) {
                        // Some browser extensions (security/privacy) block pushState - this is non-critical
                        console.warn('[OpenFile] pushState blocked (likely by browser extension):', pushStateError.message);
                    }

                    // Refresh UI to show imported content (WITHOUT reset/reload from API)
                    // Don't call openLoad() as it would reset and clear the imported content
                    await eXeLearning.app.project.refreshAfterDirectImport();

                    Logger.log(`[OpenFile] Successfully opened ${odeFileName}`);
                } catch (err) {
                    console.error('[OpenFile] Error processing file in memory:', err);
                    // Ensure progress is hidden on error
                    const importProgress = document.querySelector('#import-progress-overlay');
                    if (importProgress) importProgress.remove();
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: err.message || _('An error occurred while opening the file.'),
                        contentId: 'error',
                    });
                }
                return;
            } catch (err) {
                console.error('[OpenFile] Error in direct client processing:', err);
                // Fall back to legacy upload flow
                Logger.log('[OpenFile] Falling back to legacy upload flow...');
            }
        }
        // === END DIRECT IN-MEMORY PROCESSING ===

        const length = 1024 * 1024 * 15; // 15MB
        const totalSize = odeFile.size;
        let start = 0;
        let end = start + length;
        let uploadedBytes = 0;

        try {
            while (start < totalSize) {
                const fd = new FormData();
                const blob = odeFile.slice(start, end);
                fd.append('odeFilePart', blob);
                fd.append('odeFileName', [odeFileName]);
                fd.append('odeSessionId', [eXeLearning.app.project.odeSession]);

                response = await eXeLearning.app.api.postLocalLargeOdeFile(fd);

                if (response['responseMessage'] !== 'OK') {
                    break;
                }

                // Update odeSession with the ID from server response (generated on first chunk)
                if (response['odeSessionId']) {
                    eXeLearning.app.project.odeSession = response['odeSessionId'];
                }

                // Update progress
                uploadedBytes += blob.size;
                const percentage = (uploadedBytes / totalSize) * 100;
                progressModal.updateUploadProgress(
                    percentage,
                    uploadedBytes,
                    totalSize
                );

                start = end;
                end = start + length;
            }

            if (response['responseMessage'] === 'OK') {
                // Upload complete, now processing
                progressModal.setProcessingPhase('extracting');

                odeFileName = response['odeFileName'];
                const odeFilePath = response['odeFilePath'];

                if (odeFile) {
                    odeFile._preUploadedOdeData = {
                        odeFileName,
                        odeFilePath,
                    };
                }

                if (isImportProperties) {
                    await this.openLocalXmlPropertiesFile(
                        odeFileName,
                        odeFilePath
                    );
                    // Hide progress modal after processing
                    progressModal.hide();
                } else {
                    await this.openLocalElpFile(
                        odeFileName,
                        odeFilePath,
                        isImportIdevices,
                        progressModal,
                        forceCloseSession,
                        odeFile
                    );
                    // Modal is closed inside openLocalElpFile
                }
            } else {
                this.ensureModalBackdropCleared(350);
                // Show error
                progressModal.showError(
                    response['responseMessage'] ||
                        _('Error while uploading the project.')
                );

                setTimeout(() => {
                    progressModal.hide();
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: response['responseMessage']
                            ? response.responseMessage
                            : _('Error while uploading the project.'),
                        contentId: 'error',
                    });
                }, 2000);
            }
        } catch (error) {
            console.error('Upload error:', error);
            progressModal.showError(_('Unexpected error during upload'));

            setTimeout(() => {
                progressModal.hide();
                eXeLearning.app.modals.alert.show({
                    title: _('Error'),
                    body: _(
                        'An unexpected error occurred while processing the file.'
                    ),
                    contentId: 'error',
                });
            }, 2000);
        }
    }

    async openLocalXmlPropertiesFile(odeFileName, odeFilePath) {
        const selectedNavId =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );
        const data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            localOdeFile: true,
            odeFileName,
            odeFilePath,
            odeNavStructureSyncId: selectedNavId,
        };
        const response =
            await eXeLearning.app.api.postLocalXmlPropertiesFile(data);
        if (response.responseMessage === 'OK') {
            eXeLearning.app.project.properties.loadPropertiesFromYjs();
            await eXeLearning.app.project.openLoad();
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Import error'),
                    body: response.responseMessage
                        ? _(response.responseMessage)
                        : _('An error occurred while importing properties.'),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    async openLocalElpFile(
        odeFileName,
        odeFilePath,
        isImportIdevices,
        progressModal = null,
        forceCloseSession = false,
        originalFile = null
    ) {
        const selectedNavId =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );

        const odeParams = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
        };
        const forceCloseFlag = forceCloseSession ? '1' : '0';
        const data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            localOdeFile: true,
            odeFileName,
            odeFilePath,
            odeNavStructureSyncId: selectedNavId,
            forceCloseOdeUserPreviousSession: forceCloseFlag,
        };
        const clearPreUploadedData = () => {
            if (originalFile && originalFile._preUploadedOdeData) {
                delete originalFile._preUploadedOdeData;
            }
        };

        let response;
        response = !isImportIdevices
            ? await eXeLearning.app.api.postLocalOdeFile(data)
            : await eXeLearning.app.api.postLocalOdeComponents(data);

        if (response.responseMessage == 'OK') {
            // Close progress modal before loading project
            // Wait for Bootstrap to fully close the modal via hidden.bs.modal event
            if (progressModal) {
                await progressModal.hide();
                this.cleanupOrphanedBackdrops();
            }

            if (!isImportIdevices) {
                eXeLearning.app.project.odeSession = response.odeSessionId;
                eXeLearning.app.project.odeVersion = response.odeVersionId;
                eXeLearning.app.project.odeId = response.odeId;
                // Ensure Electron saves target under current project key immediately
                try {
                    window.__currentProjectId = response.odeId;
                } catch (_e) {
                    // Intentional: Electron global may not exist
                }
                // Remember the chosen local ELP path (prefer original local path if available)
                try {
                    const originalPath = window.__originalElpPath;
                    if (
                        window.electronAPI &&
                        typeof window.electronAPI.setSavedPath === 'function' &&
                        (originalPath || odeFilePath)
                    ) {
                        const key =
                            response.odeId ||
                            window.__currentProjectId ||
                            'default';
                        window.electronAPI.setSavedPath(
                            key,
                            originalPath || odeFilePath
                        );
                    }
                } catch (_e) {
                    // Intentional: Electron API call may fail in browser
                }

                // If server returned a Yjs project UUID, redirect to the new URL-based workarea
                // with import parameter so frontend can use ElpxImporter
                if (response.projectUuid && response.elpImportPath) {
                    Logger.log(`[OpenFile] Redirecting to Yjs project: ${response.projectUuid}`);
                    Logger.log(`[OpenFile] Import path: ${response.elpImportPath}`);
                    // Clear beforeunload handler to prevent browser "Leave site?" dialog
                    window.onbeforeunload = null;
                    window._skipLeaveSessionModal = true;
                    const importParam = encodeURIComponent(response.elpImportPath);
                    const basePath = window.eXeLearning?.config?.basePath || '';
                    window.location.href = `${basePath}/workarea?project=${response.projectUuid}&import=${importParam}`;
                    return; // Stop here - page will reload
                }

                // Legacy flow: Load project without redirect
                await eXeLearning.app.project.openLoad();
                this.loadOdeTheme(response);
                clearPreUploadedData();

                // Show warning if file was created with a newer version
                if (response.newerVersionWarning) {
                    setTimeout(() => {
                        eXeLearning.app.modals.alert.show({
                            title: _('Warning'),
                            body: response.newerVersionWarning,
                            contentId: 'warning',
                        });
                    }, 500);
                }
            } else {
                try {
                    const newOdeBlockSync =
                        await eXeLearning.app.api.postObtainOdeBlockSync({
                            odeBlockId: response.odeBlockId,
                        });
                    if (newOdeBlockSync && newOdeBlockSync.blockId) {
                        await eXeLearning.app.project.addOdeBlock(
                            newOdeBlockSync
                        );
                    } else {
                        eXeLearning.app.project.updateUserPage(selectedNavId);
                    }
                } catch (_e) {
                    eXeLearning.app.project.updateUserPage(selectedNavId);
                }
                clearPreUploadedData();
            }
        } else {
            if (isImportIdevices) {
                setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: response.responseMessage
                            ? _(response.responseMessage)
                            : _('An error occurred while importing the file.'),
                        contentId: 'error',
                    });
                }, this.timeMax);
            } else {
                // If we already checked the session (progressModal present), just show error
                if (progressModal) {
                    await progressModal.hide();
                    this.cleanupOrphanedBackdrops();
                    const message =
                        typeof response.responseMessage === 'string'
                            ? response.responseMessage.toLowerCase()
                            : '';

                    if (message.includes('user already has an open session')) {
                        eXeLearning.app.modals.sessionlogout.show({
                            title: _('Open project'),
                            forceOpen: _('Open without saving'),
                            openOdeFile: true,
                            localOdeFile: true,
                            isLargeFile: true,
                            odeFile: originalFile,
                            odeFileName,
                            odeFilePath,
                        });

                        return;
                    }

                    setTimeout(() => {
                        eXeLearning.app.modals.alert.show({
                            title: _('Import error'),
                            body: response.responseMessage
                                ? _(response.responseMessage)
                                : _('An error occurred while opening the file.'),
                            contentId: 'error',
                        });
                    }, this.timeMax);
                } else {
                    // For regular files, check for unsaved changes using Yjs mechanism
                    const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
                    const hasUnsaved =
                        yjsBridge?.documentManager?.hasUnsavedChanges?.() || false;

                    if (hasUnsaved) {
                        eXeLearning.app.modals.sessionlogout.show(data);
                    } else {
                        this.openUserLocalOdeFilesWithOpenSession(
                            odeFileName,
                            odeFilePath
                        );
                    }
                }
            }
        }
    }

    async openUserLocalOdeFilesWithOpenSession(odeFileName, odeFilePath) {
        const params = {
            odeFileName,
            odeFilePath,
            forceCloseOdeUserPreviousSession: '1',
        };
        const response = await eXeLearning.app.api.postLocalOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeId = response.odeId;
            // Ensure Electron saves target under current project key immediately
            try {
                window.__currentProjectId = response.odeId;
            } catch (_e) {
                // Intentional: Electron global may not exist
            }
            // Remember the chosen local ELP path (prefer original local path if available)
            try {
                const originalPath = window.__originalElpPath;
                if (
                    window.electronAPI &&
                    typeof window.electronAPI.setSavedPath === 'function' &&
                    (originalPath || odeFilePath)
                ) {
                    const key =
                        response.odeId ||
                        window.__currentProjectId ||
                        'default';
                    window.electronAPI.setSavedPath(
                        key,
                        originalPath || odeFilePath
                    );
                }
            } catch (_e) {
                // Intentional: Electron API call may fail in browser
            }

            // If server returned a Yjs project UUID, redirect with import param
            if (response.projectUuid && response.elpImportPath) {
                Logger.log(`[OpenFile] Redirecting to Yjs project: ${response.projectUuid}`);
                Logger.log(`[OpenFile] Import path: ${response.elpImportPath}`);
                // Clear beforeunload handler to prevent browser "Leave site?" dialog
                window.onbeforeunload = null;
                const importParam = encodeURIComponent(response.elpImportPath);
                const basePath = window.eXeLearning?.config?.basePath || '';
                window.location.href = `${basePath}/workarea?project=${response.projectUuid}&import=${importParam}`;
                return;
            }

            // Legacy flow: Load project without redirect
            await eXeLearning.app.project.openLoad();
            this.loadOdeTheme(response);
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Error opening'),
                    body: response.responseMessage || _('An error occurred while opening the file.'),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    /**
     * Clean up orphaned modal backdrops
     * Called after Bootstrap's hidden.bs.modal event fires
     * This is the preferred method - use instead of ensureModalBackdropCleared
     */
    cleanupOrphanedBackdrops() {
        // Remove all backdrops - they should have been cleaned by Bootstrap
        // but sometimes get orphaned during async operations
        document
            .querySelectorAll('.modal-backdrop')
            .forEach((backdrop) => backdrop.remove());

        // Only remove modal-open class if no modals are actually showing
        if (!document.querySelector('.modal.show')) {
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * @deprecated Use cleanupOrphanedBackdrops() after awaiting modal.hide() instead
     * This method uses unreliable timeouts. Kept for backwards compatibility.
     */
    ensureModalBackdropCleared(delay = 0) {
        const removeBackdrops = () => {
            if (document.querySelector('.modal.show')) {
                return;
            }
            document
                .querySelectorAll('.modal-backdrop')
                .forEach((backdrop) => backdrop.remove());
            document.body.classList.remove('modal-open');
        };

        if (delay > 0) {
            setTimeout(removeBackdrops, delay);
        } else {
            removeBackdrops();
        }
    }

    loadOdeTheme(response) {
        if (response.theme && response.themeDir && response.authorized) {
            if (
                Object.keys(eXeLearning.app.themes.list.installed).includes(
                    response.theme
                )
            ) {
                eXeLearning.app.themes.selectTheme(response.theme);
            } else {
                this.showModalLoadOdeTheme(response);
            }
        }
    }

    showModalLoadOdeTheme(response) {
        // For projects opened from server (legacy flow), we don't have access
        // to the original ELP file to extract theme files. Show info message
        // and use default theme.
        // Note: Theme import for local .elpx files is handled by YjsProjectBridge.
        let text = '';
        text +=
            '<p>' +
            _("You don't have the style used by this project.") +
            '</p>';
        text +=
            '<p>' +
            _('The default style will be used instead.') +
            '</p>';
        eXeLearning.app.modals.alert.show({
            title: _('Style not available'),
            body: text,
            confirmExec: () => {
                // Select default theme
                const defaultTheme = eXeLearning.config?.defaultTheme || 'base';
                eXeLearning.app.themes.selectTheme(defaultTheme, false);
            },
        });
    }

    /**
     * Typeset LaTeX in project titles using MathJax
     * Called after rendering the project list to render any LaTeX formulas in titles
     */
    typesetTitles() {
        if (typeof MathJax === 'undefined' || !MathJax.typesetPromise) {
            return;
        }

        // Find all title elements in the modal
        const titles = this.modalElementBodyContent.querySelectorAll('.ode-file-title');
        if (titles.length === 0) {
            return;
        }

        // Check if any title contains LaTeX patterns
        const latexPattern = /\\[()[\]]|\\begin\{/;
        const titlesWithLatex = Array.from(titles).filter(
            (el) => latexPattern.test(el.textContent)
        );

        if (titlesWithLatex.length > 0) {
            // Use MathJax to typeset the elements
            MathJax.typesetPromise(titlesWithLatex).catch((err) => {
                console.warn('[OpenProject] MathJax typeset error:', err);
            });
        }
    }

}

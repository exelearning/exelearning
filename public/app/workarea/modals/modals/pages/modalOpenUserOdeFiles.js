import Modal from '../modal.js';

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
    }

    show(data = {}) {
        this.titleDefault = _('Open project');
        this.odeFiles = [];
        this.removeDeleteButtonFooter(this.odeFiles);

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        this.modalElementBodyContent.innerHTML = '';
        setTimeout(() => {
            data = data || {};
            this.setTitle(this.titleDefault);

            const modalActions = this.makeModalActions();
            this.setBodyElement(modalActions);
            const bodyContent = this.makeElementListOdeFiles(data['odeFiles']);
            this.setBodyElement(bodyContent);

            const footerContent = this.makeFooterElement(data);
            if (eXeLearning.config.isOfflineInstallation === false) {
                this.setFooterElement(footerContent);
            }
            this.modal.show();
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
        modalActions.append(
            this.makeFilterForList('.ode-title', _('Search saved projects...'))
        );
        modalActions.append(this.makeUploadInput());
        return modalActions;
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
            empty.innerHTML = _('No recent projects found.');
            return empty;
        }

        const wrap = document.createElement('div');
        wrap.classList.add('ode-files-list-container');

        const list = document.createElement('div');
        list.classList.add('ode-files-list');
        wrap.append(list);

        const groups = {};
        for (const [, ode] of Object.entries(data.odeFilesSync)) {
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
        check.id = ode.odeId + ode.id;
        check.setAttribute('name', check.id);
        check.classList.add('ode-check');
        check.addEventListener('change', () => {
            if (check.checked) {
                if (!this.odeFiles.includes(ode.id)) this.odeFiles.push(ode.id);
                this.makeDeleteButtonFooter(this.odeFiles);
            } else {
                this.odeFiles = this.odeFiles.filter((id) => id !== ode.id);
                this.removeDeleteButtonFooter(this.odeFiles);
            }
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
        title.id = ode.fileName;
        title.textContent =
            ode.title && ode.title !== '' ? ode.title : ode.fileName;

        const meta = document.createElement('div');
        meta.classList.add('ode-meta');
        const size = ode.sizeFormatted;
        const date = new Date(ode.updatedAt.timestamp * 1000).toLocaleString(
            'es-ES'
        );
        const version = ode.versionName || '0';
        meta.innerHTML = `
            <span class="ode-badge">v${version}</span>
            <span class="dot">•</span>
            <span>${size}</span>
            <span class="dot">•</span>
            <span>${date}</span>
            <span class="dot">•</span>
            <span>${ode.isManualSave ? _('Manual') : _('Autosaved')}</span>
        `;

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
            eXeLearning.app.modals.confirm.show({
                title: _('Delete project'),
                body: _(
                    'Do you want to delete the project (elp)? This cannot be undone.'
                ),
                confirmButtonText: _('Delete'),
                cancelButtonText: _('Cancel'),
                confirmExec: () => this.deleteOdeFileEvent(ode.id),
                closeExec: () =>
                    setTimeout(
                        () =>
                            eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent(),
                        this.timeMax
                    ),
                cancelExec: () =>
                    setTimeout(
                        () =>
                            eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent(),
                        this.timeMax
                    ),
            });
        });
        actions.append(deleteBtn);

        row.addEventListener('click', (ev) => {
            if (ev.target.closest('.ode-actions')) {
                return;
            }
            this.modalElement
                .querySelectorAll('.ode-row')
                .forEach((r) => r.classList.remove('selected'));
            row.classList.add('selected');
        });
        row.addEventListener('dblclick', () => {
            setTimeout(
                () => this.openUserOdeFilesEvent(ode.fileName),
                this.timeMax
            );
        });

        row.append(checkWrap, icon, info, actions);
        return row;
    }

    makeFilterForList(selector, placeholder) {
        const wrap = document.createElement('div');
        wrap.classList.add('ode-filter-wrap');

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
            console.log(groups);
            groups.forEach((group) => {
                const titles = group.querySelectorAll('.ode-title');
                console.log(titles);
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

    async openUserOdeFilesEvent(id) {
        const params = {
            elpFileName: id,
            odeSessionId: eXeLearning.app.project.odeSession,
        };
        const odeParams = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
        };
        const data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            id,
        };

        const response = await eXeLearning.app.api.postSelectedOdeFile(params);
        if (response.responseMessage === 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.versionName = response.odeVersionName;
            await eXeLearning.app.project.openLoad();
        } else {
            eXeLearning.app.api
                .postCheckCurrentOdeUsers(odeParams)
                .then((response) => {
                    if (response['leaveSession'] || response['askSave']) {
                        eXeLearning.app.modals.sessionlogout.show(data);
                    } else if (response['leaveEmptySession']) {
                        this.openUserOdeFilesWithOpenSession(id);
                    }
                });
        }
    }

    async deleteOdeFileEvent(id) {
        const resp = await eXeLearning.app.api.postDeleteOdeFile({ id });
        if (resp.responseMessage == 'OK') {
            setTimeout(
                () => eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent(),
                this.timeMax
            );
        }
    }

    async massiveDeleteOdeFileEvent(odeFiles) {
        const resp = await eXeLearning.app.api.postDeleteOdeFile({
            odeFilesId: odeFiles,
        });
        if (resp.responseMessage == 'OK') {
            setTimeout(
                () => eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent(),
                this.timeMax
            );
        }
    }

    async openUserOdeFilesWithOpenSession(id) {
        const params = {
            elpFileName: id,
            forceCloseOdeUserPreviousSession: true,
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
                    body: response.responseMessage,
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    makeDeleteButtonFooter(odeFiles) {
        this.confirmButton.innerHTML = 'Delete';
        this.setConfirmExec(() => this.massiveDeleteOdeFileEvent(odeFiles));
    }

    removeDeleteButtonFooter(odeFiles) {
        if (odeFiles.length === 0) {
            this.confirmButton.innerHTML = _('Open');
            this.setConfirmExec(() => this.openSelectedOdeFile());
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
        inputUpload.accept = '.elp,.zip';
        inputUpload.addEventListener('change', () => {
            const file = inputUpload.files[0];
            if (file) this.largeFilesUpload(file);
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
        inputMultiple.accept = '.elp,.zip';
        inputMultiple.addEventListener('change', () => {
            if (inputMultiple.files?.length)
                this.uploadOdeFilesToServer(inputMultiple.files);
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
        isImportProperties = false
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
        }

        const length = 1024 * 1024 * 15; // 15MB
        const totalSize = odeFile.size;
        let start = 0;
        let end = start + length;

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
            start = end;
            end = start + length;
        }

        if (response['responseMessage'] === 'OK') {
            odeFileName = response['odeFileName'];
            const odeFilePath = response['odeFilePath'];
            if (isImportProperties) {
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    'root',
                    null,
                    null,
                    'EDIT'
                );
                this.openLocalXmlPropertiesFile(odeFileName, odeFilePath);
            } else {
                this.openLocalElpFile(
                    odeFileName,
                    odeFilePath,
                    isImportIdevices
                );
            }
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Import error'),
                    body: response['responseMessage']
                        ? response.responseMessage
                        : _('Error while uploading the project.'),
                    contentId: 'error',
                });
            }, this.timeMax);
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
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                response.odeBlockId,
                null,
                'ADD',
                null
            );
            eXeLearning.app.project.properties.apiLoadProperties();
            await eXeLearning.app.project.openLoad();
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Import error'),
                    body: _(response.responseMessage),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    async openLocalElpFile(odeFileName, odeFilePath, isImportIdevices) {
        const selectedNavId =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );

        const odeParams = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
        };
        const data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            localOdeFile: true,
            odeFileName,
            odeFilePath,
            odeNavStructureSyncId: selectedNavId,
        };

        let response;
        response = !isImportIdevices
            ? await eXeLearning.app.api.postLocalOdeFile(data)
            : await eXeLearning.app.api.postLocalOdeComponents(data);

        if (response.responseMessage == 'OK') {
            if (!isImportIdevices) {
                eXeLearning.app.project.odeSession = response.odeSessionId;
                eXeLearning.app.project.odeVersion = response.odeVersionId;
                eXeLearning.app.project.odeId = response.odeId;
                // Ensure Electron saves target under current project key immediately
                try {
                    window.__currentProjectId = response.odeId;
                } catch (_e) {}
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
                } catch (_e) {}
                // Load project
                await eXeLearning.app.project.openLoad();
                this.loadOdeTheme(response);
            } else {
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    response.odeBlockId,
                    null,
                    'ADD',
                    null
                );
                eXeLearning.app.project.updateUserPage(selectedNavId);
            }
        } else {
            if (isImportIdevices) {
                setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: _(response.responseMessage),
                        contentId: 'error',
                    });
                }, this.timeMax);
            } else {
                eXeLearning.app.api
                    .postCheckCurrentOdeUsers(odeParams)
                    .then((response2) => {
                        if (response2['leaveSession'] || response2['askSave']) {
                            eXeLearning.app.modals.sessionlogout.show(data);
                        } else if (response2['leaveEmptySession']) {
                            this.openUserLocalOdeFilesWithOpenSession(
                                odeFileName,
                                odeFilePath
                            );
                        }
                    });
            }
        }
    }

    async openUserLocalOdeFilesWithOpenSession(odeFileName, odeFilePath) {
        const params = {
            odeFileName,
            odeFilePath,
            forceCloseOdeUserPreviousSession: true,
        };
        const response = await eXeLearning.app.api.postLocalOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeId = response.odeId;
            // Ensure Electron saves target under current project key immediately
            try {
                window.__currentProjectId = response.odeId;
            } catch (_e) {}
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
            } catch (_e) {}
            // Load project
            await eXeLearning.app.project.openLoad();
            this.loadOdeTheme(response);
        } else {
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Error opening'),
                    body: response.responseMessage,
                    contentId: 'error',
                });
            }, this.timeMax);
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
        let text = '';
        text +=
            '<p>' +
            _("You don't have the style used by this project.") +
            '</p>';
        text += '<p>' + _('Do you want to install it?') + '</p>';
        eXeLearning.app.modals.confirm.show({
            title: _('Import style'),
            body: text,
            confirmExec: () => {
                const params = {
                    odeSessionId: eXeLearning.app.project.odeSession,
                    themeDirname: response.theme,
                };
                eXeLearning.app.api
                    .postOdeImportTheme(params)
                    .then((responseTheme) => {
                        if (
                            responseTheme.responseMessage == 'OK' &&
                            responseTheme.themes
                        ) {
                            eXeLearning.app.project.app.themes.list.loadThemes(
                                responseTheme.themes.themes
                            );
                            eXeLearning.app.project.app.themes.selectTheme(
                                response.theme,
                                true
                            );
                        }
                    });
            },
        });
    }
}

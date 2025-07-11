import Modal from '../modal.js';

export default class modalOpenUserOdeFiles extends Modal {
    constructor(manager) {
        let id = 'modalOpenUserOdeFiles';
        let titleDefault;
        super(manager, id, titleDefault, false);
        // Modal body content element
        this.modalElementBodyContent = this.modalElementBody.querySelector(
            '.modal-body-content'
        );
        // Modal footer content element
        this.modalFooterContent =
            this.modalElement.querySelector('.modal-footer');
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        // Ode files
        this.odeFiles = [];
    }

    /**
     *
     * @param {*} data
     */
    show(data = {}) {
        // Set title
        this.titleDefault = _('Open project');
        this.odeFiles = [];
        this.removeDeleteButtonFooter(this.odeFiles);
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            data = data ? data : {};
            this.setTitle(this.titleDefault);
            let bodyContent = this.makeBodyElement(data['odeFiles']);
            this.setBodyElement(bodyContent);
            this.hideTableElements(data['odeFiles']);
            let footerContent = this.makeFooterElement(data);
            if (eXeLearning.config.isOfflineInstallation === false) {
                this.setFooterElement(footerContent);
            }
            this.modal.show();
        }, time);
    }

    /**
     * Set body element
     *
     * @param {*} bodyElement
     */
    setBodyElement(bodyElement) {
        this.modalElementBodyContent.innerHTML = '';
        this.modalElementBodyContent.append(bodyElement);
    }

    /**
     *
     * @param {*} footeElement
     */
    setFooterElement(footerElement) {
        let firstChild = this.modalFooterContent.querySelector('.btn-primary');
        if (this.modalFooterContent.querySelector('.progress-bar-div')) {
            this.modalFooterContent.querySelector('.progress-bar-div').remove();
        }
        this.modalFooterContent.insertBefore(footerElement, firstChild);
    }

    /*******************************************************************************
     * COMPOSE
     *******************************************************************************/

    /**
     * Generate body element
     *
     * @returns {Element}
     */
    makeBodyElement(data) {
        let element = document.createElement('div');
        if (Object.keys(data).length !== 0) {
            element.append(this.makeUploadInput());
            element.append(
                this.makeFilterTable(
                    element,
                    '.ode-file-title',
                    _('Search saved projects...')
                )
            );

            element.append(this.makeElementTableOdeFiles(data));
        } else {
            element.append(this.makeElementTableOdeFiles(data));
        }

        return element;
    }

    /**
     *
     * @param {*} data
     */
    hideTableElements(data) {
        let odeFiles = [];
        // Add all the ode files to the array
        for (let [id, odeFile] of Object.entries(data.odeFilesSync)) {
            odeFiles.push(odeFile.odeId);
        }
        // Return an array with repeated odeId
        odeFiles = this.find_duplicate_in_array(odeFiles);
        // Return an array with the ode files repeated, the last version of each ode file repeated and odeId repeated
        this.selectOdeFilesWithRepeatedOdeId(odeFiles, data).then(
            (response) => {
                // Hide ode files with repeated odeId except last version
                this.tableTrMinorVersionOcult(response);
            }
        );
    }

    /**
     * Generate footer element
     *
     * @returns {Element}
     */
    makeFooterElement(data) {
        let element = this.showFreeDiskSpace(data['odeFiles']);
        return element;
    }

    /**
     * Make element table ode files
     *
     * @param {*} data
     * @returns {Element}
     */
    makeElementTableOdeFiles(data) {
        // Check if there are OdeFiles
        if (Object.keys(data).length === 0 || data.usedSpace === 0) {
            let emptyContainer = document.createElement('div');
            emptyContainer.className = 'alert alert-info mt-3';
            emptyContainer.innerHTML = _('No recent projects found.');
            return emptyContainer;
        }
        // Table container element
        let tableContainer = document.createElement('div');
        tableContainer.classList.add('ode-files-table-container');
        // Table rows container
        let tableRowsContainer = document.createElement('div');
        tableRowsContainer.classList.add('ode-files-table-rows-container');
        // Table rows element
        let table = document.createElement('table');
        table.classList.add('table');
        table.classList.add('ode-files-table');
        // Thead
        let tableThead = document.createElement('thead');
        table.append(tableThead);
        // Table titles element
        let thColumns = [
            _(''),
            _('Title'),
            _('Version'),
            _('Size'),
            _('Date'),
            _('Autosaved'),
            _('Actions'),
        ];
        let thColumnsTypes = [
            'checkbox',
            'string',
            'float',
            'float',
            'date',
            'string',
            '',
        ];
        let tableTr = document.createElement('tr');
        for (let thCount = 0; thCount < thColumns.length; thCount++) {
            let row = this.makeRowTableThElements(
                table,
                thColumns[thCount],
                thColumnsTypes[thCount],
                thCount
            );
            tableTr.appendChild(row);
        }
        tableThead.append(tableTr);
        // Table body
        let tableBody = document.createElement('tbody');
        table.append(tableBody);
        // Table td list
        for (let [id, odeFile] of Object.entries(data.odeFilesSync)) {
            let row = this.makeRowTableOdeFilesElement(odeFile);
            tableBody.append(row);
        }
        tableRowsContainer.append(table);
        tableContainer.append(tableRowsContainer);
        return tableContainer;
    }

    /**
     *
     * @param {*} odeFile
     * @returns {Element}
     */
    makeRowTableOdeFilesElement(odeFile) {
        // Row element
        let row = document.createElement('tr');
        // Classes
        row.classList.add('ode-file-row');
        row.setAttribute('ode-id', odeFile.odeId);
        row.setAttribute('version-name', odeFile.versionName);
        // Case autosave
        if (odeFile.isManualSave == false) {
            row.classList.add('ode-file-not-manual-save');
        }
        // Title
        row.append(this.makeCheckboxTd(odeFile));
        row.append(this.makeTitleOdeFileTd(odeFile));
        row.append(this.makeVersionNameOdeFileTd(odeFile));
        row.append(this.makeSizeTd(odeFile));
        row.append(this.makeDateTd(odeFile));
        row.append(this.makeAutosaveTd(odeFile));
        row.append(this.makeDeleteButtonTd(odeFile));

        return row;
    }

    /**
     *
     * @param {*} table
     * @param {*} thElement
     * @param {*} thType
     * @param {*} thCount
     * @returns
     */
    makeRowTableThElements(table, thElement, thType, thCount) {
        let column = document.createElement('th');
        column.classList.add('ode-file-title-row');
        column.classList.add('ode-file-title-row-' + thCount);
        column.setAttribute('scope', 'col');
        column.addEventListener('click', () => {
            this.sorTable(table, thCount, thType);
        });
        column.innerHTML = thElement;
        return column;
    }

    /**
     *
     * @param {*} odeFile
     * @returns
     */
    makeCheckboxTd(odeFile) {
        let checkboxVisibleTd = document.createElement('td');
        checkboxVisibleTd.classList.add('ode-file-check');
        let checkboxInput = document.createElement('input');
        checkboxInput.setAttribute('type', 'checkbox');
        checkboxInput.addEventListener('change', () => {
            if (checkboxInput.checked) {
                if (!this.odeFiles.includes(odeFile.id)) {
                    this.odeFiles.push(odeFile.id);
                }
                this.makeDeleteButtonFooter(this.odeFiles);
            } else {
                this.odeFiles = this.odeFiles.filter(
                    function (value, index, arr) {
                        return value !== odeFile.id;
                    }
                );
                this.removeDeleteButtonFooter(this.odeFiles);
            }
        });
        checkboxVisibleTd.append(checkboxInput);
        return checkboxVisibleTd;
    }

    /**
     *
     * @param {*} odeFiles
     */
    makeDeleteButtonFooter(odeFiles) {
        this.confirmButton.innerHTML = 'Delete';
        this.setConfirmExec(() => {
            this.massiveDeleteOdeFileEvent(odeFiles);
        });
    }

    /**
     *
     * @param {*} odeFiles
     */
    removeDeleteButtonFooter(odeFiles) {
        if (odeFiles.length == 0) {
            this.confirmButton.innerHTML = _('Open');
            this.setConfirmExec(() => {
                this.openSelectedOdeFile();
            });
        }
    }

    /**
     *
     * @param {*} odeFile
     * @returns
     */
    makeTitleOdeFileTd(odeFile) {
        let titleTd = document.createElement('td');
        titleTd.classList.add('ode-file-title');
        titleTd.setAttribute('id', odeFile.fileName);
        titleTd.appendChild(this.makeImgLogoTdTitle());
        let spanTitleText = document.createElement('span');
        spanTitleText.classList.add('title-text');
        titleTd.append(spanTitleText);
        if (odeFile.title == '' || odeFile.title == null) {
            spanTitleText.innerHTML = odeFile.fileName;
        } else {
            spanTitleText.innerHTML = odeFile.title;
        }

        return titleTd;
    }

    /**
     *
     * @param {*} odeFile
     * @returns
     */
    makeVersionNameOdeFileTd(odeFile) {
        let titleTd = document.createElement('td');
        titleTd.classList.add('ode-file-version-name');
        let spanTitleText = document.createElement('span');
        spanTitleText.classList.add('title-text');
        titleTd.append(spanTitleText);

        if (odeFile.versionName == '' || odeFile.versionName == null) {
            spanTitleText.innerHTML = '0';
        } else {
            spanTitleText.innerHTML = odeFile.versionName;
        }

        // Set "size" for sorting in table
        titleTd.setAttribute('size', spanTitleText.innerHTML);

        return titleTd;
    }

    /**
     *
     * @param {*} odeFile
     * @returns
     */
    makeSizeTd(odeFile) {
        let titleTd = document.createElement('td');
        let odeFileSize = odeFile.size;
        let convertedOdeFileSize = odeFile.sizeFormatted;
        titleTd.classList.add('ode-file-size');
        titleTd.setAttribute('size', odeFileSize);
        titleTd.innerHTML = convertedOdeFileSize;
        return titleTd;
    }

    /**
     *
     * @param {*} odeFile
     * @returns
     */
    makeDateTd(odeFile) {
        let titleTd = document.createElement('td');
        titleTd.classList.add('ode-file-date');
        // multiplied by 1000 so that the argument is in milliseconds, not seconds.
        var timestamp = odeFile.updatedAt.timestamp * 1000;
        var date = new Date(timestamp);
        titleTd.setAttribute('id', timestamp);
        titleTd.innerHTML = date.toLocaleString('es-ES');

        return titleTd;
    }

    /**
     *
     * @param {*} odeFile
     * @returns
     */
    makeAutosaveTd(odeFile) {
        let titleTd = document.createElement('td');
        titleTd.classList.add('ode-file-autosave');
        if (odeFile.isManualSave == true) {
            titleTd.innerHTML = _('No');
        } else {
            titleTd.innerHTML = _('Yes');
        }
        return titleTd;
    }

    /**
     *
     * @param {*} odeFile
     * @returns
     */
    makeDeleteButtonTd(odeFile) {
        let deleteTd = document.createElement('td');
        deleteTd.setAttribute('class', 'ode-file-actions');
        let deleteButton = document.createElement('div');
        deleteButton.setAttribute(
            'class',
            'exe-icon open-user-ode-file-action open-user-ode-file-action-delete'
        );
        deleteButton.setAttribute('title', _('Delete'));
        deleteButton.innerHTML = 'delete_forever';
        // Add event
        deleteButton.addEventListener('click', () => {
            eXeLearning.app.modals.confirm.show({
                title: _('Delete project'),
                body: _(
                    'Do you want to delete the project (elp)? This cannot be undone.'
                ),
                confirmButtonText: _('Delete'),
                cancelButtonText: _('Cancel'),
                confirmExec: () => {
                    // Delete ode file
                    this.deleteOdeFileEvent(odeFile.id);
                },
                closeExec: () => {
                    // Return to ode files list
                    setTimeout(() => {
                        eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent();
                    }, this.timeMax);
                },
                cancelExec: () => {
                    // Return to ode files list
                    setTimeout(() => {
                        eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent();
                    }, this.timeMax);
                },
            });
        });
        deleteTd.appendChild(deleteButton);

        return deleteTd;
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    makeImgLogoTdTitle() {
        let logoOdeFile = document.createElement('img');
        logoOdeFile.setAttribute('class', 'exe-logo content');
        logoOdeFile.setAttribute(
            'src',
            'style/workarea/images/exelearning.png'
        );

        return logoOdeFile;
    }

    /**
     * Make a progress bar to show the disk space
     *
     * @param {*} data
     * @returns
     */
    showFreeDiskSpace(data) {
        let progressBarDiv = document.createElement('div');
        let fullBarDiv = document.createElement('div');
        let textElementBarDiv = document.createElement('p');
        fullBarDiv.classList.add('progress-bar-div');
        // Values to make bar width
        let maxValue = data.maxDiskSpaceFormatted;
        let valueNow = data.usedSpaceFormatted;
        let percentage = (data.usedSpace * 100) / data.maxDiskSpace;
        progressBarDiv.classList.add('progress');
        // Make text element
        let baseBarText = _('%s of %s used');
        baseBarText = baseBarText.replace('%s', valueNow);
        baseBarText = baseBarText.replace('%s', maxValue);
        textElementBarDiv.innerHTML = baseBarText;
        // Append progressbar to text element to put after
        textElementBarDiv.append(progressBarDiv);
        fullBarDiv.appendChild(textElementBarDiv);
        // Make bar
        let progressBar = this.makeProgressBar(maxValue, valueNow, percentage);
        progressBarDiv.appendChild(progressBar);

        return fullBarDiv;
    }

    /**
     *
     * @param {*} maxValue
     * @param {*} valueNow
     * @param {*} percentage
     * @returns
     */
    makeProgressBar(maxValue, valueNow, percentage) {
        let progressBar = document.createElement('div');
        // Change color in case 50% or more
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

    /*******************************************************************************
     * EVENTS
     *******************************************************************************/

    /**
     * Open ode file selected in table
     *
     */
    openSelectedOdeFile() {
        var selected = this.modalElementBody.querySelector(
            '.ode-file-row.selected'
        );
        var odeFileName = null;
        if (selected != null) {
            for (var i = 0; i < selected.childNodes.length; i++) {
                if (selected.childNodes[i].className == 'ode-file-title') {
                    odeFileName = selected.childNodes[i].id;
                    break;
                }
            }
            if (odeFileName !== null) {
                setTimeout(() => {
                    // Show modal
                    this.openUserOdeFilesEvent(odeFileName);
                }, this.timeMax);
            }
        }
    }

    /**
     * Get session and Version Id and try to open
     *
     * @param {*} id
     */
    async openUserOdeFilesEvent(id) {
        let params = {
            elpFileName: id,
            odeSessionId: eXeLearning.app.project.odeSession,
        };
        let odeParams = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
        };
        let data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            id: id,
        };
        let response = await eXeLearning.app.api.postSelectedOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.versionName = response.odeVersionName;
            // Load project
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

    /**
     * Delete the project file from disk and from the database
     *
     * @param {*} id
     */
    async deleteOdeFileEvent(id) {
        let params = { id: id };
        let response = await eXeLearning.app.api.postDeleteOdeFile(params);
        if (response.responseMessage == 'OK') {
            setTimeout(() => {
                eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent();
            }, this.timeMax);
        }
    }

    /**
     *
     * @param {*} odeFiles
     */
    async massiveDeleteOdeFileEvent(odeFiles) {
        let params = { odeFilesId: odeFiles };
        let response = await eXeLearning.app.api.postDeleteOdeFile(params);
        if (response.responseMessage == 'OK') {
            setTimeout(() => {
                eXeLearning.app.menus.navbar.file.openUserOdeFilesEvent();
            }, this.timeMax);
        }
    }

    /**
     * Get session and Version Id and try to open
     *
     * @param {*} id
     */
    async openUserOdeFilesWithOpenSession(id) {
        let params = {
            elpFileName: id,
            forceCloseOdeUserPreviousSession: true,
            odeSessionId: eXeLearning.app.project.odeSession,
        };
        let response = await eXeLearning.app.api.postSelectedOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeId = response.odeId;
            // Load project
            await eXeLearning.app.project.openLoad();
            // Check ode theme
            this.loadOdeTheme(response);
        } else {
            // Open eXe alert modal
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Error opening'),
                    body: response.responseMessage,
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    /*******************************************************************************
     * UPLOAD INPUT
     *******************************************************************************/

    /**
     * Make a upload button
     *
     * @returns
     */
    makeUploadInput() {
        // Make a div with the button
        let uploadDiv = document.createElement('div');
        uploadDiv.id = 'local-ode-file-upload-div';

        // Single elp upload
        let inputUpload = document.createElement('input');
        inputUpload.classList.add('local-ode-file-upload-input');
        inputUpload.setAttribute('type', 'file');
        inputUpload.setAttribute('name', 'local-ode-file-upload');
        inputUpload.setAttribute('accept', '.elp,.zip');
        inputUpload.classList.add('d-none');
        inputUpload.addEventListener('change', (e) => {
            let uploadOdeFile = this.modalElementBody.querySelector(
                '.local-ode-file-upload-input'
            );
            let odeFile = uploadOdeFile.files[0];
            this.largeFilesUpload(odeFile);
        });

        let buttonUploadOdeFile = document.createElement('button');
        buttonUploadOdeFile.classList.add('ode-files-button-upload');
        buttonUploadOdeFile.classList.add('btn');
        buttonUploadOdeFile.classList.add('btn-secondary');
        buttonUploadOdeFile.innerHTML = _('Select a file from your device');
        // Add event
        buttonUploadOdeFile.addEventListener('click', (event) => {
            this.modalElementBody
                .querySelector('input.local-ode-file-upload-input')
                .click();
        });

        // Multiple elp upload
        let inputMultipleUpload = document.createElement('input');
        inputMultipleUpload.classList.add(
            'multiple-local-ode-file-upload-input'
        );
        inputMultipleUpload.setAttribute('type', 'file');
        inputMultipleUpload.setAttribute('multiple', 'multiple');
        inputMultipleUpload.setAttribute(
            'name',
            'multiple-local-ode-file-upload'
        );
        inputMultipleUpload.setAttribute('accept', '.elp,.zip');
        inputMultipleUpload.classList.add('hidden');
        inputMultipleUpload.addEventListener('change', (e) => {
            let uploadOdeFiles = this.modalElement.querySelector(
                '.multiple-local-ode-file-upload-input'
            );
            let odeFiles = uploadOdeFiles.files;
            let response = this.uploadOdeFilesToServer(odeFiles);
        });

        /* To review (no 'Open multiple files' button)
        let buttonMultipleUploadOdeFile = document.createElement('button');
        buttonMultipleUploadOdeFile.classList.add('ode-files-button-upload');
        buttonMultipleUploadOdeFile.classList.add('btn');
        buttonMultipleUploadOdeFile.classList.add('btn-secondary');
        buttonMultipleUploadOdeFile.classList.add('exe-advanced');
        buttonMultipleUploadOdeFile.innerHTML = _('Open multiple files');
        // Add event
        buttonMultipleUploadOdeFile.addEventListener('click', (event) => {
            this.modalElementBody
                .querySelector('input.multiple-local-ode-file-upload-input')
                .click();
        });
        */

        uploadDiv.append(inputUpload);
        uploadDiv.append(inputMultipleUpload);
        uploadDiv.append(buttonUploadOdeFile);
        /* To review (no 'Open multiple files' button)
        uploadDiv.append(buttonMultipleUploadOdeFile);
        */

        return uploadDiv;
    }

    /*******************************************************************************
     * UPLOAD EVENT
     *******************************************************************************/

    /**
     * Slice file into parts and upload
     *
     * @param {*} odeFile
     * @param {*} isImportIdevices
     *
     */
    async largeFilesUpload(
        odeFile,
        isImportIdevices = false,
        isImportProperties = false
    ) {
        let response = [];
        let odeFileName = odeFile.name;

        // In case of idevices check if is a block or an idevice elp
        if (isImportIdevices) {
            if (
                !odeFileName.includes('.idevice') &&
                !odeFileName.includes('.block')
            ) {
                // Open eXe alert modal
                return setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: _('The content is not a box or an iDevice'),
                        contentId: 'error',
                    });
                }, this.timeMax);
            }
        }

        // Size of each upload
        let length = 1024 * 1024 * 1; // 1MB
        let totalSize = odeFile.size;
        let start = 0;
        let end = start + length;

        // FormData and sliced file
        let fd = null;
        let blob = null;
        while (start < totalSize) {
            fd = new FormData();
            blob = odeFile.slice(start, end);

            fd.append('odeFilePart', blob);
            fd.append('odeFileName', [odeFileName]);
            fd.append('odeSessionId', [eXeLearning.app.project.odeSession]);
            response = await eXeLearning.app.api.postLocalLargeOdeFile(fd);

            if (response['responseMessage'] != 'OK') break;

            start = end;
            end = start + length;
        }

        if (response['responseMessage'] == 'OK') {
            odeFileName = response['odeFileName'];
            let odeFilePath = response['odeFilePath'];
            // Differences 2 cases: open elp or import idevices
            if (isImportProperties) {
                // Send update sync change to the BBDD
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    'root',
                    null,
                    null,
                    'EDIT'
                );
                // Load properties
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

    /**
     * Open a local ode file
     *
     * @param {*} odeFileName
     * @param {*} odeFilePath
     */
    async openLocalXmlPropertiesFile(odeFileName, odeFilePath) {
        let response;
        let selectedNavId =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );
        let odeParams = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
        };
        let data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            localOdeFile: true,
            odeFileName: odeFileName,
            odeFilePath: odeFilePath,
            odeNavStructureSyncId: selectedNavId,
        };

        response = await eXeLearning.app.api.postLocalXmlPropertiesFile(data);
        if (response.responseMessage == 'OK') {
            // Update synchronize flag to update current users
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                response.odeBlockId,
                null,
                'ADD',
                null
            );
            // Load project properties
            eXeLearning.app.project.properties.apiLoadProperties();
            await eXeLearning.app.project.openLoad();
        } else {
            // Open eXe alert modal
            return setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Import error'),
                    body: _(response.responseMessage),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    /**
     * Open a local ode file
     *
     * @param {*} odeFileName
     * @param {*} odeFilePath
     */
    async openLocalElpFile(odeFileName, odeFilePath, isImportIdevices) {
        let response;
        let selectedNavId =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.nodeSelected.getAttribute(
                'nav-id'
            );
        let odeParams = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeVersion: eXeLearning.app.project.odeVersion,
            odeId: eXeLearning.app.project.odeId,
        };
        let data = {
            title: _('Open project'),
            forceOpen: _('Open without saving changes'),
            openOdeFile: true,
            localOdeFile: true,
            odeFileName: odeFileName,
            odeFilePath: odeFilePath,
            odeNavStructureSyncId: selectedNavId,
        };
        if (!isImportIdevices) {
            response = await eXeLearning.app.api.postLocalOdeFile(data);
        } else {
            response = await eXeLearning.app.api.postLocalOdeComponents(data);
        }
        if (response.responseMessage == 'OK') {
            if (!isImportIdevices) {
                eXeLearning.app.project.odeSession = response.odeSessionId;
                eXeLearning.app.project.odeVersion = response.odeVersionId;
                eXeLearning.app.project.odeId = response.odeId;
                // Load project
                await eXeLearning.app.project.openLoad();
                // Check ode theme
                this.loadOdeTheme(response);
            } else {
                // Update synchronize flag to update current users
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    response.odeBlockId,
                    null,
                    'ADD',
                    null
                );
                // Update user nav structure
                eXeLearning.app.project.updateUserPage(selectedNavId);
            }
        } else {
            if (isImportIdevices) {
                // Open eXe alert modal
                return setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: _(response.responseMessage),
                        contentId: 'error',
                    });
                }, this.timeMax);
            } else {
                eXeLearning.app.api
                    .postCheckCurrentOdeUsers(odeParams)
                    .then((response) => {
                        if (response['leaveSession'] || response['askSave']) {
                            eXeLearning.app.modals.sessionlogout.show(data);
                        } else if (response['leaveEmptySession']) {
                            this.openUserLocalOdeFilesWithOpenSession(
                                odeFileName,
                                odeFilePath
                            );
                        }
                    });
            }
        }
    }

    /**
     * Open a local ode file with an open session
     *
     * @param {*} odeFileName
     * @param {*} odeFilePath
     */
    async openUserLocalOdeFilesWithOpenSession(odeFileName, odeFilePath) {
        let params = {
            odeFileName: odeFileName,
            odeFilePath: odeFilePath,
            forceCloseOdeUserPreviousSession: true,
        };
        let response = await eXeLearning.app.api.postLocalOdeFile(params);
        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.odeSession = response.odeSessionId;
            eXeLearning.app.project.odeVersion = response.odeVersionId;
            eXeLearning.app.project.odeId = response.odeId;
            // Load project
            await eXeLearning.app.project.openLoad();
            // Check ode theme
            this.loadOdeTheme(response);
        } else {
            // Open eXe alert modal
            setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Error opening'),
                    body: response.responseMessage,
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    /*******************************************************************************
     * MULTIPLE UPLOAD
     *******************************************************************************/

    /**
     * Check and upload files to open
     *
     * @param {*} files
     * @returns
     */
    async uploadOdeFilesToServer(files) {
        let odeFilesUpload = { odeFileName: [], odeFilePath: [] };
        // Check ode files, extension and name
        for (let file of files) {
            let odeFileName = file.name;
            let odeFileNameExtensionPosition = odeFileName.lastIndexOf('.');
            let odeFileNameExtension = odeFileName.substring(
                odeFileNameExtensionPosition
            );
            if (
                !odeFileNameExtension.includes('.elp') &&
                !odeFileNameExtension.includes('.zip')
            ) {
                // Open eXe alert modal
                return setTimeout(() => {
                    eXeLearning.app.modals.alert.show({
                        title: _('Import error'),
                        body: _('Could not open the file.'),
                        contentId: 'error',
                    });
                }, this.timeMax);
            }
        }
        // Upload ode file
        for (let file of files) {
            let response = await this.multipleLargeFilesUpload(file);
            if (response.responseMessage == 'OK') {
                let odeFileName = response['odeFileName'];
                let odeFilePath = response['odeFilePath'];
                odeFilesUpload.odeFileName.push(odeFileName);
                odeFilesUpload.odeFilePath.push(odeFilePath);
            }
        }
        this.multipleOdeFilesUpload(odeFilesUpload);
    }

    /**
     * Try to open the multiple elp and apply on the session
     *
     * @param {*} odeFilesUpload
     * @returns
     */
    async multipleOdeFilesUpload(odeFilesUpload) {
        // Get selected page
        let nodeSelected =
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour
                .nodeSelected;
        let selectedNavId = nodeSelected.getAttribute('nav-id');
        let selectedPageId = nodeSelected.getAttribute('page-id');

        let data = {
            odeFiles: odeFilesUpload,
            odeNavStructureSyncId: selectedNavId,
        };

        let response =
            await eXeLearning.app.api.postMultipleLocalOdeFiles(data);

        if (response.responseMessage == 'OK') {
            eXeLearning.app.project.updateUserPage(selectedNavId);
            // Close the actual modal
            eXeLearning.app.modals.openuserodefiles.close();
            // Update flag to synchronize users
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                selectedPageId,
                null,
                null,
                'RELOAD_NAV_MAP'
            );
        } else {
            // Open eXe alert modal
            return setTimeout(() => {
                eXeLearning.app.modals.alert.show({
                    title: _('Import error'),
                    body: response.responseMessage
                        ? response.responseMessage
                        : _('Could not read all files.'),
                    contentId: 'error',
                });
            }, this.timeMax);
        }
    }

    /**
     * Slice file into parts and upload
     *
     * @param {*} odeFile
     *
     */
    async multipleLargeFilesUpload(odeFile) {
        let response = [];
        let odeFileName = odeFile.name;

        // Size of each upload
        let length = 1024 * 1024 * 1; // 1MB
        let totalSize = odeFile.size;
        let start = 0;
        let end = start + length;

        // FormData and sliced file
        let fd = null;
        let blob = null;

        while (start < totalSize) {
            fd = new FormData();
            blob = odeFile.slice(start, end);

            fd.append('odeFilePart', blob);
            fd.append('odeFileName', [odeFileName]);
            fd.append('odeSessionId', [eXeLearning.app.project.odeSession]);
            response = await eXeLearning.app.api.postLocalLargeOdeFile(fd);

            if (response['responseMessage'] != 'OK') break;

            start = end;
            end = start + length;
        }

        return response;
    }

    /*******************************************************************************
     * LOAD THEME
     *******************************************************************************/

    /**
     * Check and load theme if you don't already have it installed
     *
     * @param {*} response
     */
    loadOdeTheme(response) {
        if (response.theme && response.themeDir) {
            if (
                Object.keys(eXeLearning.app.themes.list.installed).includes(
                    response.theme
                )
            ) {
                // Select theme
                eXeLearning.app.themes.selectTheme(response.theme);
            } else {
                // Show modal to import theme
                this.showModalLoadOdeTheme(response);
            }
        }
    }

    /**
     * Show a modal to confirm if you want to import the ode theme
     *
     * @param {*} response
     */
    showModalLoadOdeTheme(response) {
        // Show modal to import theme
        let text = '';
        text +=
            '<p>' +
            _("You don't have the style used by this project.") +
            '</p>';
        //text += "<ul><li><label>" + _("Theme") + "</label>: " + response.theme + "</li></ul>";
        text += '<p>' + _('Do you want to install it?') + '</p>';
        eXeLearning.app.modals.confirm.show({
            title: _('Import style'),
            body: text,
            confirmExec: () => {
                let params = {
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
                            // Load themes
                            eXeLearning.app.project.app.themes.list.loadThemes(
                                responseTheme.themes.themes
                            );
                            // Select theme
                            eXeLearning.app.project.app.themes.selectTheme(
                                response.theme,
                                true
                            );
                        }
                    });
            },
        });
    }

    /*******************************************************************************
     * SHOW OTHER VERSIONS BUTTON
     *******************************************************************************/

    /**
     *
     * @param {*} array
     * @returns
     */
    find_duplicate_in_array(array) {
        const count = {};
        const result = [];

        array.forEach((item) => {
            if (count[item]) {
                count[item] += 1;
                return;
            }
            count[item] = 1;
        });

        for (let prop in count) {
            if (count[prop] >= 2) {
                result.push(prop);
            }
        }
        return result;
    }

    /**
     *
     * @param {*} odeFiles
     * @param {*} data
     * @returns
     */
    async selectOdeFilesWithRepeatedOdeId(odeFiles, data) {
        let array = [];

        // Push ode files with repeated ode id
        for (let item of odeFiles) {
            array[item] = [];
            for (let [id, odeFile] of Object.entries(data.odeFilesSync)) {
                if (item == odeFile.odeId) {
                    array[item].push(odeFile);
                }
            }
        }

        let reduceOdes = this.getLastVersionOdeFiles(array, odeFiles);
        return reduceOdes;
    }

    /**
     *
     * @param {*} array
     * @param {*} odeFiles
     * @returns
     */
    getLastVersionOdeFiles(array, odeFiles) {
        let array2 = [];

        // Get last version of the repeated ode files and push to array
        for (let item of odeFiles) {
            array2[item] = [];
            for (var i = 0; i < array[item].length - 1; i++) {
                // Compare values
                let x = array[item][i];
                let y = array[item][i + 1];
                // Add item with the key set by odeId
                if (parseInt(x.versionName) >= parseInt(y.versionName)) {
                    if (array2[item].length > 0) {
                        if (
                            parseInt(array2[item][0].versionName) <
                            parseInt(x.versionName)
                        ) {
                            array2[item].push(array[item][i]);
                        }
                    } else {
                        array2[item].push(array[item][i]);
                    }
                }
            }
        }

        // Return an array with the result and the other params
        let odeFilesWithLastVersion = [odeFiles, array, array2];
        return odeFilesWithLastVersion;
    }

    /**
     *
     * @param {*} odeFilesReduced
     */
    tableTrMinorVersionOcult(odeFilesReduced) {
        let tableOdeFilesElements =
            this.modalElement.querySelectorAll('.ode-file-row');
        let odeFiles = odeFilesReduced[0];
        let odeFilesByOdeId = odeFilesReduced[1];
        let showOdeFiles = odeFilesReduced[2];
        for (let element of tableOdeFilesElements) {
            let elementOdeId = element.getAttribute('ode-id');
            var showOdeFilesArray = odeFilesByOdeId[elementOdeId];

            // In case repeated odeId add class
            if (showOdeFilesArray) {
                element.classList.add('ode-file-with-subversions');
            }

            // Select element td action and add button
            let odeFileActionTd = element.querySelector('.ode-file-actions');
            let showOdeFilesButton = this.makeShowOtherVersionsButtton(
                element,
                odeFilesByOdeId,
                elementOdeId
            );

            // Event select ode file
            element.addEventListener('click', () => {
                var rows = this.modalElement.querySelectorAll('tr');
                for (let i = 0; i < rows.length; i++) {
                    rows[i].classList.remove('selected');
                }
                // add selected
                element.classList.add('selected');
            });

            // Show button if have different versions
            if (showOdeFilesArray) {
                odeFileActionTd.appendChild(showOdeFilesButton);
            }

            // Add class subversion to display none to the repeated odeId
            if (odeFiles.includes(elementOdeId)) {
                element.classList.add('subversion');
            } else {
                element.classList.add('principal-version');
            }
        }

        // Add principal version to the last version of the repeated ode files
        for (let item of odeFiles) {
            for (var i = 0; i < showOdeFiles[item].length; i++) {
                let odeVersionName = showOdeFiles[item][i].versionName;
                let odeId = showOdeFiles[item][i].odeId;
                let tableShowOdeFile = this.modalElement.querySelector(
                    `[ode-id="${odeId}"][version-name="${odeVersionName}"]`
                );
                tableShowOdeFile.classList.remove('subversion');
                tableShowOdeFile.classList.add('principal-version');
            }
        }
    }

    /**
     *
     * @param {*} element
     * @param {*} odeFilesByOdeId
     * @param {*} elementOdeId
     * @returns
     */
    makeShowOtherVersionsButtton(element, odeFilesByOdeId, elementOdeId) {
        let showOdeFilesButton = document.createElement('div');
        showOdeFilesButton.setAttribute(
            'class',
            'exe-icon open-user-ode-file-action open-user-ode-file-action-show-ode-files'
        );
        showOdeFilesButton.setAttribute('title', _('Show other versions'));
        showOdeFilesButton.innerHTML = 'add_circle';
        showOdeFilesButton.classList.add('block-others-show');
        // Event click button show files
        showOdeFilesButton.addEventListener('click', () => {
            this.showOtherVersionsButttonEvent(
                showOdeFilesButton,
                element,
                odeFilesByOdeId,
                elementOdeId
            );
        });

        return showOdeFilesButton;
    }

    /**
     *
     * @param {*} showOdeFilesButton
     * @param {*} element
     * @param {*} odeFilesByOdeId
     * @param {*} elementOdeId
     */
    showOtherVersionsButttonEvent(
        showOdeFilesButton,
        element,
        odeFilesByOdeId,
        elementOdeId
    ) {
        var rows = this.modalElement.querySelectorAll(`.subversion-show`);
        if (rows.length > 0) {
            for (let i = 0; i < rows.length; i++) {
                rows[i].remove();
            }
            showOdeFilesButton.classList.remove('unblock-others-show');
            showOdeFilesButton.classList.add('block-others-show');
            showOdeFilesButton.innerHTML = 'add_circle';
            let odeFilesShowBlock =
                this.modalElement.querySelectorAll('.block-others-show');
            for (let odeFile of odeFilesShowBlock) {
                odeFile.setAttribute('openFolder', 'true');
            }
        } else {
            showOdeFilesButton.innerHTML = 'remove_circle';
            showOdeFilesButton.classList.remove('block-others-show');
            showOdeFilesButton.classList.add('unblock-others-show');

            let odeFilesShowBlock =
                this.modalElement.querySelectorAll('.block-others-show');
            for (let odeFile of odeFilesShowBlock) {
                odeFile.setAttribute('openFolder', 'false');
            }

            var showOdeFilesArray = odeFilesByOdeId[elementOdeId];
            if (showOdeFilesArray) {
                for (var i = showOdeFilesArray.length - 1; i > 0; i--) {
                    let odeFileElement = this.makeRowTableOdeFilesElement(
                        showOdeFilesArray[i]
                    );
                    let siblingElement = element.parentNode.insertBefore(
                        odeFileElement,
                        element.nextSibling
                    );
                    siblingElement.classList.add('principal-version');
                    siblingElement.classList.add('subversion-show');
                    siblingElement.addEventListener('click', () => {
                        this.showedOdeFilesEvent(siblingElement);
                    });
                }
            }
        }
    }

    /**
     *
     * @param {*} siblingElement
     */
    showedOdeFilesEvent(siblingElement) {
        var rows = this.modalElement.querySelectorAll('tr');
        for (let i = 0; i < rows.length; i++) {
            rows[i].classList.remove('selected');
        }
        // add selected
        siblingElement.classList.add('selected');
    }
}

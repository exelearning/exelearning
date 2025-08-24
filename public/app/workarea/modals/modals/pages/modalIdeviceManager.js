import Modal from '../modal.js';

export default class ModalIdeviceManager extends Modal {
    constructor(manager) {
        let id = 'modalIdeviceManager';
        let titleDefault;
        super(manager, id, titleDefault, false);
        // Modal body content element
        this.modalElementBodyContent = this.modalElementBody.querySelector(
            '.modal-body-content'
        );
        // Modal footer
        this.modalFooter = this.modalElement.querySelector('.modal-footer');
        // Modal buttons
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.cancelButton = this.modalElement.querySelector(
            'button.close.btn.btn-secondary'
        );
        // Modal alert element
        this.modalElementAlert = this.modalElementBody.querySelector(
            '.alert.alert-danger'
        );
        this.modalElementAlertText =
            this.modalElementBody.querySelector('.text');
        this.modalElementAlertCloseButton =
            this.modalElementAlert.querySelector('.close-alert');
        this.addBehaviourButtonCloseAlert();
        // Input readers
        this.readers = [];
    }

    /**
     *
     * @param {*} buttonText
     */
    setConfirmButtonText(buttonText) {
        this.confirmButton.innerHTML = buttonText;
    }

    /**
     *
     */
    hideConfirmButtonText() {
        this.confirmButton.style.display = 'none';
    }

    /**
     *
     */
    showConfirmButtonText() {
        this.confirmButton.style.display = 'flex';
    }

    /**
     *
     * @param {*} buttonText
     */
    setCancelButtonText(buttonText) {
        this.cancelButton.innerHTML = buttonText;
    }

    /**
     *
     */
    hideCancelButtonText() {
        this.cancelButton.style.display = 'none';
    }

    /**
     *
     */
    showCancelButtonText() {
        this.cancelButton.style.display = 'flex';
    }

    /**
     *
     */
    generateButtonBack() {
        this.buttonBack = document.createElement('button');
        this.buttonBack.classList.add('back');
        this.buttonBack.classList.add('btn');
        this.buttonBack.classList.add('btn-secondary');
        this.buttonBack.setAttribute('type', 'button');
        this.buttonBack.innerHTML = _('Back');
        // Add event
        this.buttonBack.addEventListener('click', (event) => {
            this.backExecEvent();
        });
        // Add button to modal
        this.modalFooter.append(this.buttonBack);

        return this.buttonBack;
    }

    /**
     *
     */
    removeButtonBack() {
        if (this.buttonBack) {
            this.buttonBack.remove();
        }
    }

    /**
     *
     */
    backExecEvent() {
        this.setBodyElement(this.makeBodyElement(this.idevices));
        this.addBehaviourExeTabs();
        this.clickSelectedTab();
        this.showButtonsConfirmCancel();
    }

    /**
     *
     */
    showButtonsConfirmCancel() {
        this.removeButtonBack();
        this.showConfirmButtonText();
        this.showCancelButtonText();
    }

    /**
     *
     */
    clickSelectedTab() {
        if (this.tabSelectedLink) {
            this.modalElementBody
                .querySelector(`a[href="${this.tabSelectedLink}"]`)
                .click();
        }
    }

    /**
     * Show modal
     *
     * @param {*} idevices
     */
    show(idevices) {
        // Set title
        this.titleDefault = _('iDevice manager');
        // Parameters of a idevice that we will show in the information
        this.paramsInfo = JSON.parse(
            JSON.stringify(
                eXeLearning.app.api.parameters.ideviceInfoFieldsConfig
            )
        );
        // Installed idevices
        if (idevices) this.idevices = idevices;
        this.idevicesBase = this.getBaseIdevices(this.idevices.installed);
        this.idevicesUser = this.getUserIdevices(this.idevices.installed);
        let bodyContent = this.makeBodyElement();
        if (Object.keys(this.idevicesUser).length == 0)
            bodyContent.classList.add('only-base-idevices');
        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.setBodyElement(bodyContent);
            this.showButtonsConfirmCancel();
            this.addBehaviourExeTabs();
            this.setConfirmExec(() => {
                this.saveIdevicesVisibility();
            });
            if (idevices) this.modalElementAlert.classList.remove('show');
            this.modal.show();
        }, time);
    }

    /**
     * Show modal alert
     *
     * @param {*} text
     */
    showAlert(text) {
        this.modalElementAlert.innerHTML = text;
        this.modalElementAlert.classList.add('show');
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
     */
    saveIdevicesVisibility() {
        let preferences = {};
        let ideviceListInputVisibility = this.modalElementBody.querySelectorAll(
            '.idevice-row .idevice-visible input'
        );
        ideviceListInputVisibility.forEach((input) => {
            let ideviceName = input.getAttribute('idevice');
            let ideviceVisibilityPreference =
                eXeLearning.symfony.ideviceVisibilityPreferencePre +
                ideviceName;
            // Add to dict param
            preferences[ideviceVisibilityPreference] = input.checked;
            // Update base idevices preferences
            this.updateIdeviceVisibility(ideviceName, input.checked);
        });
        // Save idevice visibility in user preferences
        eXeLearning.app.api
            .putSaveUserPreferences(preferences)
            .then((response) => {
                // Update preferences
                eXeLearning.app.user.preferences.setPreferences(response);
                // Compose idevices menu
                eXeLearning.app.menus.menuIdevices.compose();
                eXeLearning.app.menus.menuIdevices.behaviour();
                eXeLearning.app.project.idevices.behaviour();
            });
    }

    /*******************************************************************************
     * IDEVICES LIST
     *******************************************************************************/

    /**
     * Get base idevices from dict
     *
     * @param {*} idevices
     */
    getBaseIdevices(idevices) {
        let baseIdevices = {};
        for (let [key, value] of Object.entries(idevices)) {
            if (value.type == eXeLearning.symfony.ideviceTypeBase) {
                baseIdevices[key] = value;
            }
        }
        return baseIdevices;
    }

    /**
     * Get user idevices from dict
     *
     * @param {*} idevices
     */
    getUserIdevices(idevices) {
        let userIdevices = {};
        for (let [key, value] of Object.entries(idevices)) {
            if (value.type == eXeLearning.symfony.ideviceTypeUser) {
                userIdevices[key] = value;
            }
        }
        return userIdevices;
    }

    /**
     * Update idevice visibility
     *
     * @param {*} ideviceName
     * @param {*} visible
     */
    updateIdeviceVisibility(ideviceName, visible) {
        if (this.idevicesBase[ideviceName]) {
            this.idevicesBase[ideviceName].visible = visible;
        }
        if (this.idevicesUser[ideviceName]) {
            this.idevicesUser[ideviceName].visible = visible;
        }
        eXeLearning.app.idevices.list.installed[ideviceName].visible = visible;
    }

    /*******************************************************************************
     * COMPOSE
     *******************************************************************************/

    /**
     * Generate body element
     *
     * @returns {Element}
     */
    makeBodyElement() {
        let bodyContainer = document.createElement('div');
        bodyContainer.classList.add('body-idevices-container');
        // Head buttons
        bodyContainer.append(this.makeElementToButtons());
        // Filter
        let filterTable = this.makeFilterTable(
            bodyContainer,
            '.idevice-title',
            _('Search iDevices')
        );
        bodyContainer.append(filterTable);
        // Idevices list
        let idevicesListContainer = document.createElement('div');
        idevicesListContainer.classList.add('idevices-list-container');
        bodyContainer.append(idevicesListContainer);
        // Tables
        let defaultIdevicesTabData = {
            title: _('Default iDevices'),
            id: 'base-idevices-tab',
            active: true,
        };
        if (Object.keys(this.idevicesUser).length > 0) {
            // Generate tabs
            let userIdevicesTabData = {
                title: _('My iDevices'),
                id: 'user-idevices-tab',
            };
            let tabs = [defaultIdevicesTabData, userIdevicesTabData];
            idevicesListContainer.append(this.makeIdevicesFormTabs(tabs));
            idevicesListContainer.append(
                this.makeElementTableIdevices(
                    this.idevicesBase,
                    defaultIdevicesTabData
                )
            );
            idevicesListContainer.append(
                this.makeElementTableIdevices(
                    this.idevicesUser,
                    userIdevicesTabData
                )
            );
        } else {
            // Only show base idevices
            idevicesListContainer.append(
                this.makeElementTableIdevices(
                    this.idevicesBase,
                    defaultIdevicesTabData
                )
            );
            idevicesListContainer.classList.add('no-tabs');
        }
        return bodyContainer;
    }

    /**
     * Generate button container
     *
     * @returns {Element}
     */
    makeElementToButtons() {
        // Buttons container element
        let buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('idevices-button-container');
        // Button import style
        buttonsContainer.append(this.makeElementInputFileImportIdevice());
        buttonsContainer.append(this.makeElementButtonImportIdevice());

        return buttonsContainer;
    }

    /**
     * Generate input file import
     *
     * @returns {Element}
     */
    makeElementInputFileImportIdevice() {
        let inputFile = document.createElement('input');
        inputFile.setAttribute('type', 'file');
        inputFile.setAttribute('accept', '.zip');
        inputFile.classList.add('hidden');
        inputFile.classList.add('idevice-file-import');
        // Add event
        inputFile.addEventListener('change', (event) => {
            Array.from(inputFile.files).forEach((idevice) => {
                // Add new file reader
                this.addNewReader(idevice);
            });
            inputFile.value = null;
        });

        return inputFile;
    }

    /**
     * Generate import button
     *
     * @returns
     */
    makeElementButtonImportIdevice() {
        let buttonImportIdevice = document.createElement('button');
        buttonImportIdevice.classList.add('idevices-button-import');
        buttonImportIdevice.classList.add('btn');
        buttonImportIdevice.classList.add('btn-secondary');
        buttonImportIdevice.innerHTML = _('Import iDevice');
        // Add event
        buttonImportIdevice.addEventListener('click', (event) => {
            this.modalElementBody
                .querySelector('input.idevice-file-import')
                .click();
        });

        return buttonImportIdevice;
    }

    /**
     *
     * @param {Array} tabs
     * @returns {Element}
     */
    makeIdevicesFormTabs(tabs) {
        let formTabs = document.createElement('ul');
        formTabs.classList.add('exe-form-tabs');
        tabs.forEach((data) => {
            let li = document.createElement('li');
            let link = document.createElement('a');
            link.setAttribute('href', `#${data.id}`);
            link.classList.add('exe-tab');
            if (data.active) link.classList.add('exe-form-active-tab');
            link.innerText = data.title;
            li.append(link);
            formTabs.append(li);
        });

        return formTabs;
    }

    /**
     * Make element table idevices
     *
     * @param {*} idevices
     * @param {*} dataTab
     * @returns {Element}
     */
    makeElementTableIdevices(idevices, dataTab) {
        // Table rows container
        let tableContainer = document.createElement('div');
        tableContainer.classList.add('idevices-table-rows-container');
        tableContainer.classList.add('exe-form-content');
        if (dataTab.active)
            tableContainer.classList.add('exe-form-active-content');
        if (dataTab.id) tableContainer.id = dataTab.id;
        // Table rows element
        let table = document.createElement('table');
        tableContainer.append(table);
        table.classList.add('table');
        table.classList.add('idevices-table');
        table.classList.add('table-striped');
        // Thead
        let tableThead = this.makeRowTableTheadElements(table, dataTab.id);
        table.append(tableThead);
        // Rows
        let tableBody = document.createElement('tbody');
        table.append(tableBody);
        for (let [id, idevice] of Object.entries(idevices)) {
            let row = this.makeRowTableIdevicesElement(idevice);
            tableBody.append(row);
        }

        // Sort by default
        tableThead.querySelector('th[th-id="title"]').click();

        return tableContainer;
    }

    /**
     * Make element table Thead
     *
     */
    makeRowTableTheadElements(table, id) {
        let actions = id == 'base-idevices-tab' ? 2 : 3;
        let tableThead = document.createElement('thead');
        let tableTheadRow = document.createElement('tr');
        tableThead.append(tableTheadRow);
        // Th columns data
        let thDataList = [
            { id: 'visibility', title: _('Visibility'), type: 'checkbox' },
            { id: 'title', title: _('Title'), type: 'string' },
            { id: 'category', title: _('Category'), type: 'string' },
            {
                id: 'actions',
                title: _('Actions'),
                type: null,
                colspan: actions,
            },
        ];
        // Make columns
        for (let i = 0; i < thDataList.length; i++) {
            let data = thDataList[i];
            let th = document.createElement('th');
            th.setAttribute('scope', 'col');
            if (data.id) th.setAttribute('th-id', data.id);
            if (data.colspan) th.setAttribute('colspan', data.colspan);
            if (data.type) th.classList.add('sortable');
            th.innerText = data.title;
            th.addEventListener('click', () => {
                this.sorTable(table, i, data.type);
            });
            tableTheadRow.append(th);
        }

        return tableThead;
    }

    /**
     *
     * @param {*} idevice
     * @returns {Node}
     */
    makeRowTableIdevicesElement(idevice) {
        // Row element
        let row = document.createElement('tr');
        // Attributes
        row.setAttribute('idevice-id', idevice.id);
        // Classes
        row.classList.add('idevice-row');
        if (eXeLearning.app.idevices.selected) {
            if (idevice.id == eXeLearning.app.idevices.selected.id) {
                row.classList.add('selected');
            }
        }
        // Visible checkbox
        row.append(this.makeCheckboxVisibleIdeviceTd(idevice));
        // Title
        row.append(this.makeTitleIdeviceTd(idevice));
        // Category
        row.append(this.makeCategoryIdeviceTd(idevice));
        // Actions
        if (idevice.type == 'user')
            row.append(this.makeActionRemoveIdeviceTd(idevice));
        row.append(this.makeActionExportIdeviceTd(idevice));
        row.append(this.makeActionInfoIdeviceTd(idevice));

        return row;
    }

    /**
     *
     * @param {*} idevice
     * @returns
     */
    makeTitleIdeviceTd(idevice) {
        let titleTd = document.createElement('td');
        titleTd.classList.add('idevice-title');
        titleTd.innerHTML = idevice.title;
        titleTd.addEventListener('click', (event) => {
            this.modalElementBodyContent
                .querySelector(`#${idevice.name}-idevice-visibility-checkbox`)
                .click();
        });

        return titleTd;
    }

    /**
     *
     * @param {*} idevice
     * @returns
     */
    makeCategoryIdeviceTd(idevice) {
        let categoryTd = document.createElement('td');
        categoryTd.classList.add('idevice-category');
        categoryTd.innerHTML = idevice.category;
        categoryTd.addEventListener('click', (event) => {
            this.modalElementBodyContent
                .querySelector(`#${idevice.name}-idevice-visibility-checkbox`)
                .click();
        });

        return categoryTd;
    }

    /**
     *
     * @param {*} idevice
     * @returns
     */
    makeCheckboxVisibleIdeviceTd(idevice) {
        let checkboxVisibleTd = document.createElement('td');
        checkboxVisibleTd.classList.add('idevice-visible');
        let checkboxInput = document.createElement('input');
        checkboxInput.setAttribute('type', 'checkbox');
        checkboxInput.setAttribute('idevice', idevice.name);
        checkboxInput.id = `${idevice.name}-idevice-visibility-checkbox`;
        if (idevice.visible) {
            checkboxInput.setAttribute('checked', 'checked');
        }
        checkboxVisibleTd.append(checkboxInput);
        return checkboxVisibleTd;
    }

    /**
     *
     * @param {*} idevice
     * @returns
     */
    makeActionRemoveIdeviceTd(idevice) {
        let actionRemoveTd = document.createElement('td');
        actionRemoveTd.classList.add('exe-icon');
        actionRemoveTd.classList.add('idevice-action');
        actionRemoveTd.classList.add('idevice-action-remove');
        actionRemoveTd.title = _('Delete');
        actionRemoveTd.innerHTML = 'delete_forever';
        // Click event
        actionRemoveTd.addEventListener('click', (event) => {
            eXeLearning.app.modals.confirm.show({
                title: _('Delete iDevice'),
                body: _('Delete this iDevice: %s?').replace('%s', idevice.id),
                confirmButtonText: _('Delete'),
                cancelButtonText: _('Cancel'),
                confirmExec: () => {
                    // Delete idevice dir
                    this.removeIdevice(idevice.id);
                },
            });
        });

        return actionRemoveTd;
    }

    /**
     *
     * @param {*} idevice
     * @returns
     */
    makeActionExportIdeviceTd(idevice) {
        let actionExportTd = document.createElement('td');
        actionExportTd.classList.add('exe-icon');
        actionExportTd.classList.add('idevice-action');
        actionExportTd.classList.add('idevice-action-export');
        actionExportTd.title = _('Download');
        actionExportTd.innerHTML = 'download';
        // Downloadable
        if (idevice.downloadable) {
            actionExportTd.setAttribute('downloadable', true);
        } else {
            actionExportTd.setAttribute('downloadable', false);
        }
        // Click event
        actionExportTd.addEventListener('click', (event) => {
            this.downloadIdeviceZip(idevice);
        });

        return actionExportTd;
    }

    /**
     *
     * @param {*} idevice
     * @returns
     */
    makeActionInfoIdeviceTd(idevice) {
        let actionInfoTd = document.createElement('td');
        actionInfoTd.classList.add('exe-icon');
        actionInfoTd.classList.add('idevice-action');
        actionInfoTd.classList.add('idevice-action-info');
        actionInfoTd.title = _('Info');
        actionInfoTd.innerHTML = 'info';
        // Click event
        actionInfoTd.addEventListener('click', (event) => {
            this.modalElementBodyContent.innerHTML = '';
            this.modalElementBodyContent.append(
                this.makeElementInfoIdevice(idevice)
            );
            this.generateButtonBack();
            this.hideConfirmButtonText();
            this.hideCancelButtonText();
        });

        return actionInfoTd;
    }

    /**
     *
     * @param {*} idevice
     * @returns {Node}
     */
    makeElementInfoIdevice(idevice) {
        // Container
        let infoIdeviceContainer = document.createElement('div');
        infoIdeviceContainer.classList.add('info-idevice-container');
        // Head text
        let infoIdeviceText = document.createElement('p');
        infoIdeviceText.classList.add('idevice-properties-title');
        infoIdeviceText.innerHTML =
            _('iDevice properties') + ': ' + idevice.title;
        infoIdeviceContainer.append(infoIdeviceText);
        // Table
        infoIdeviceContainer.append(this.makeElementInfoIdeviceTable(idevice));

        return infoIdeviceContainer;
    }

    /**
     *
     * @param {*} idevice
     */
    makeElementInfoIdeviceTable(idevice) {
        let tableInfoIdevice = document.createElement('table');
        tableInfoIdevice.classList.add('info-idevice-table');
        for (let [param, config] of Object.entries(this.paramsInfo)) {
            if (idevice[param]) {
                tableInfoIdevice.append(
                    this.makeElementInfoIdeviceTableRow(
                        param,
                        idevice[param],
                        config
                    )
                );
            }
        }
        return tableInfoIdevice;
    }

    /**
     *
     * @param {*} key
     * @param {*} value
     * @returns
     */
    makeElementInfoIdeviceTableRow(key, value, config) {
        let rowTableInfo = document.createElement('tr');
        rowTableInfo.classList.add('row-table-info-idevice');
        rowTableInfo.append(
            this.makeElementInfoIdeviceTableRowKey(key, config)
        );
        rowTableInfo.append(
            this.makeElementInfoIdeviceTableRowValue(value, config)
        );

        return rowTableInfo;
    }

    /**
     *
     * @param {*} text
     * @returns
     */
    makeElementInfoIdeviceTableRowKey(text, config) {
        let rowTdKeyTableInfo = document.createElement('td');
        rowTdKeyTableInfo.classList.add('idevice-info-key');
        rowTdKeyTableInfo.innerHTML = `${config.title}:`;
        return rowTdKeyTableInfo;
    }

    /**
     *
     * @param {*} text
     * @returns
     */
    makeElementInfoIdeviceTableRowValue(text, config) {
        let rowTdValueTableInfo = document.createElement('td');
        rowTdValueTableInfo.classList.add('idevice-info-value');
        switch (config.tag) {
            case 'text':
                let input = document.createElement('input');
                input.classList.add('idevice-info-value-text');
                input.setAttribute('type', 'text');
                input.setAttribute('disabled', 'disabled');
                input.setAttribute('value', text);
                rowTdValueTableInfo.append(input);
                break;
            case 'textarea':
                let textarea = document.createElement('textarea');
                textarea.classList.add('idevice-info-value-text');
                textarea.setAttribute('disabled', 'disabled');
                textarea.innerHTML = text;
                rowTdValueTableInfo.append(textarea);
                break;
        }
        return rowTdValueTableInfo;
    }

    /**
     *
     */
    showElementAlert(txt, response) {
        let defErrorText = txt;
        let resErrorText = response && response.error ? response.error : '';
        let errorText = resErrorText
            ? `<p>${defErrorText}:</p><p>&nbsp;${resErrorText}</p>`
            : `<p>${defErrorText}</p>`;
        this.modalElementAlertText.innerHTML = errorText;
        this.modalElementAlert.classList.add('show');
    }

    /*******************************************************************************
     * EVENTS
     *******************************************************************************/

    /**
     * Add click event to close alert button
     *
     */
    addBehaviourButtonCloseAlert() {
        this.modalElementAlertCloseButton.addEventListener('click', (event) => {
            // Hide modal
            this.modalElementAlertText.innerHTML = '';
            this.modalElementAlert.classList.remove('show');
        });
    }

    /**
     * Select idevice in style manager
     *
     * @param {*} id
     */
    selectIdevice(id) {
        eXeLearning.app.idevices.selectIdevice(id, true);
        this.addClassSelectIdeviceRow(id);
    }

    /**
     * Add class selected to row
     *
     * @param {*} id
     */
    addClassSelectIdeviceRow(id) {
        this.modalElementBody
            .querySelectorAll('.idevices-table .idevice-row')
            .forEach((row) => {
                if (row.getAttribute('idevice-id') == id) {
                    row.classList.add('selected');
                } else {
                    row.classList.remove('selected');
                }
            });
    }

    /**
     * Reader of upload idevice input
     *
     * @param {*} file
     */
    addNewReader(file) {
        // New reader
        let reader = new FileReader();
        this.readers.push(reader);
        // Closure to capture the file information.
        reader.onload = (event) => {
            this.uploadIdevice(file.name, event.target.result);
        };
        // Read in the image file as a data URL.
        reader.readAsDataURL(file);
    }

    /*******************************************************************************
     * API
     *******************************************************************************/

    /**
     * Upload/Import idevice to app
     *
     */
    uploadIdevice(fileName, fileData) {
        let params = {};
        params.filename = fileName;
        params.file = fileData;
        eXeLearning.app.api.postUploadIdevice(params).then((response) => {
            if (response && response.responseMessage == 'OK') {
                // Load idevice in client
                this.idevices.loadIdevice(response.idevice);
                this.idevicesBase = this.getBaseIdevices(
                    this.idevices.installed
                );
                this.idevicesUser = this.getUserIdevices(
                    this.idevices.installed
                );
                // Make body element idevices table
                let bodyContent = this.makeBodyElement();
                this.setBodyElement(bodyContent);
                if (Object.keys(this.idevicesUser).length == 0)
                    bodyContent.classList.add('only-base-idevices');
                // Set visibility in installed idevice
                let newIdeviceInput = this.modalElementBody.querySelector(
                    `tr[idevice-id="${response.idevice.name}"] input`
                );
                if (newIdeviceInput) newIdeviceInput.click();
                // Tab events
                this.addBehaviourExeTabs();
                // Save idevice visibility
                this.saveIdevicesVisibility();
            } else {
                // Show alert
                this.showElementAlert(
                    _('Failed to install the new iDevice'),
                    response
                );
            }
        });
    }

    /**
     * Delete idevice and load modal again
     *
     * @param {*} id
     */
    removeIdevice(id) {
        let params = {};
        params.id = id;
        eXeLearning.app.api.deleteIdeviceInstalled(params).then((response) => {
            if (
                response &&
                response.responseMessage == 'OK' &&
                response.deleted &&
                response.deleted.name
            ) {
                // Load idevices in client
                this.idevices.removeIdevice(response.deleted.name);
                // Show modal
                setTimeout(() => {
                    if (!this.modal._isShown) this.show(false);
                }, this.timeMax);
            } else {
                // Show modal width alert
                setTimeout(() => {
                    if (!this.modal._isShown) this.show(false);
                    this.showElementAlert(
                        _('Could not remove the iDevice'),
                        response
                    );
                }, this.timeMax);
            }
        });
    }

    /**
     * Download/Export idevice
     *
     * @param {*} idevice
     */
    downloadIdeviceZip(idevice) {
        eXeLearning.app.api
            .getIdeviceInstalledZip(
                eXeLearning.app.project.odeSession,
                idevice.dirName
            )
            .then((response) => {
                if (response && response.zipFileName && response.zipBase64) {
                    let link = document.createElement('a');
                    link.setAttribute('type', 'hidden');
                    link.href = 'data:text/plain;base64,' + response.zipBase64;
                    link.download = response.zipFileName;
                    link.click();
                    link.remove();
                }
            });
    }
}

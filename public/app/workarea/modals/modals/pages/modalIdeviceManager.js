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

        let time = this.manager.closeModals() ? this.timeMax : this.timeMin;
        setTimeout(() => {
            this.setTitle(this.titleDefault);
            this.setBodyElement(bodyContent);
            this.showButtonsConfirmCancel();
            this.addBehaviourExeTabs();
            this.setConfirmExec(() => {
                //this.saveIdevicesVisibility();
            });
            if (idevices) this.modalElementAlert.classList.remove('show');
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
     */
    saveIdevicesVisibility() {
        let preferences = {};
        let ideviceListInputVisibility = this.modalElementBody.querySelectorAll(
            '.idevice-row .idevice-visible input'
        );
        ideviceListInputVisibility.forEach((input) => {
            let ideviceName = input.getAttribute('idevice');
            let ideviceVisibilityPreference =
                eXeLearning.config.ideviceVisibilityPreferencePre +
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
            if (value.type === eXeLearning.config.ideviceTypeBase) {
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
            if (value.type == eXeLearning.config.ideviceTypeUser) {
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
        // Filter
        let filterTable = this.makeFilterTableIdevices(
            bodyContainer,
            '.idevice-title',
            _('Search iDevices')
        );
        bodyContainer.append(filterTable);
        // Search icon
        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'search-icon');
        bodyContainer.append(icon);
        // Head buttons
        bodyContainer.append(this.makeElementToButtons());
        // Idevices list
        let idevicesListContainer = document.createElement('div');
        idevicesListContainer.classList.add('idevices-list-container');
        bodyContainer.append(idevicesListContainer);
        const header = this.makeRowTableTheadElements();
        if (header) bodyContainer.prepend(header);
        let defaultIdevicesTabData = {
            title: _('Default iDevices'),
            id: 'base-idevices-tab',
            active: true,
        };
        idevicesListContainer.append(
            this.makeElementTableIdevices(
                this.idevices.installed,
                defaultIdevicesTabData
            )
        );
        idevicesListContainer.classList.add('no-tabs');
        return bodyContainer;
    }

    makeFilterTableIdevices(container, filterTdClass, placeholder) {
        let inputFilter = document.createElement('input');
        inputFilter.classList.add('table-filter');
        inputFilter.classList.add('form-control');
        inputFilter.setAttribute('type', 'text');
        inputFilter.setAttribute('placeholder', placeholder);
        inputFilter.setAttribute('name', 'idevice-searcher');
        inputFilter.id = 'idevice-searcher';
        inputFilter.addEventListener('keyup', () => {
            let filter = inputFilter.value.toUpperCase();
            container.querySelectorAll('.toggle-item').forEach((tr) => {
                let td = tr.querySelector(filterTdClass);
                if (td) {
                    let txtValue = td.textContent || td.innerText;
                    if (txtValue.toUpperCase().indexOf(filter) > -1) {
                        tr.style.display = '';
                    } else {
                        tr.style.display = 'none';
                    }
                }
            });
        });

        const label = document.createElement('label');
        label.setAttribute('for', 'idevice-searcher');
        label.classList.add('visually-hidden');
        label.textContent = placeholder || _('Filter items');

        const wrapper = document.createElement('div');
        wrapper.classList.add('table-filter-group');
        wrapper.append(label, inputFilter);

        return wrapper;
    }

    /**
     * Generate button container
     *
     * @returns {Element}
     */
    makeElementToButtons() {
        let buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('idevices-button-container');
        buttonsContainer.append(this.makeElementInputFileImportIdevice());
        let importButton = this.makeElementButtonImportIdevice();
        if (importButton != false) buttonsContainer.append(importButton);

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
        inputFile.id = 'modal-idevice-file-import';
        inputFile.setAttribute('name', 'modal-idevice-file-import');
        inputFile.classList.add('hidden');
        inputFile.classList.add('idevice-file-import');
        inputFile.addEventListener('change', (event) => {
            Array.from(inputFile.files).forEach((idevice) => {
                this.addNewReader(idevice);
            });
            inputFile.value = null;
        });

        let label = document.createElement('label');
        label.setAttribute('for', 'modal-idevice-file-import');
        label.classList.add('visually-hidden');
        label.textContent = _('Upload iDevice file');

        const wrapper = document.createElement('div');
        wrapper.append(label, inputFile);

        return wrapper;
    }

    /**
     * Generate import button
     *
     * @returns
     */
    makeElementButtonImportIdevice() {
        if (
            eXeLearning.config.isOfflineInstallation == false &&
            eXeLearning.config.userIdevices == false
        )
            return false;
        let buttonImportIdevice = document.createElement('button');
        buttonImportIdevice.classList.add(
            'idevices-button-import',
            'btn',
            'button-secondary',
            'd-flex',
            'align-items-center',
            'justify-content-start'
        );
        buttonImportIdevice.innerHTML = _('Import iDevice');

        const icon = document.createElement('span');
        icon.classList.add('small-icon', 'import-icon');
        buttonImportIdevice.prepend(icon);
        // Add event
        buttonImportIdevice.addEventListener('click', (event) => {
            this.modalElementBody
                .querySelector('input.idevice-file-import')
                .click();
        });

        return buttonImportIdevice;
    }

    /**
     * Make element table idevices
     *
     * @param {*} idevices
     * @param {*} dataTab
     * @returns {Element}
     */
    makeElementTableIdevices(idevices, dataTab) {
        const container = document.createElement('div');
        container.classList.add(
            'idevices-toggle-container',
            'exe-form-content'
        );
        if (dataTab?.active) container.classList.add('exe-form-active-content');
        if (dataTab?.id) container.id = dataTab.id;
        const grid = document.createElement('div');
        grid.className = 'toggle-grid';
        container.append(grid);
        this.getUserListIdevices().then((userPreferencesIdevices) => {
            for (const [, idevice] of Object.entries(idevices)) {
                if (idevice.id != 'example') {
                    const row = this.makeRowTableIdevicesElement(
                        idevice,
                        userPreferencesIdevices
                    );
                    grid.append(row);
                }
            }
        });

        return container;
    }

    async getUserListIdevices() {
        const db = await this.openDB();
        const tx = db.transaction('idevicesSettings', 'readonly');
        const store = tx.objectStore('idevicesSettings');
        const key = eXeLearning.app.user.name;
        return new Promise((resolve) => {
            const request = store.get(key);
            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };
            request.onerror = () => {
                resolve(null);
            };
        });
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('exelearning', 1);
            request.onupgradeneeded = function (event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('idevicesSettings')) {
                    db.createObjectStore('idevicesSettings', { keyPath: 'id' });
                }
            };
            request.onsuccess = function (event) {
                resolve(event.target.result);
            };
            request.onerror = function (event) {
                reject(event.target.error);
            };
        });
    }

    async saveIdevices(array) {
        const db = await this.openDB();
        const tx = db.transaction('idevicesSettings', 'readwrite');
        const store = tx.objectStore('idevicesSettings');
        const key = eXeLearning.app.user.name;
        store.put({ id: key, value: array });
        await tx.complete;
    }

    /**
     * Make element table Thead
     *
     */
    makeRowTableTheadElements(table, id) {
        this.alertFiveIdevices = document.createElement('div');
        this.alertFiveIdevices.className =
            'alert alert-info align-items-start fade';
        this.alertFiveIdevices.setAttribute('role', 'alert');
        return this.alertFiveIdevices;
    }

    /**
     *
     * @param {*} idevice
     * @param userPreferencesIdevices
     * @returns {Node}
     */
    makeRowTableIdevicesElement(idevice, userPreferencesIdevices) {
        const row = document.createElement('div');
        row.classList.add('toggle-item');
        row.setAttribute('idevice-id', idevice.id);

        const label = document.createElement('label');
        label.classList.add('toggle-label', 'idevice-title');
        label.setAttribute('for', `tgl-${idevice.id}`);
        label.textContent = idevice.title || idevice.id;
        if (idevice.type === eXeLearning.config.ideviceTypeUser) {
            label.textContent = label.textContent + ' *';
        }

        const control = document.createElement('div');
        control.className = 'toggle-control';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `tgl-${idevice.id}`;
        input.className = 'toggle-input';
        input.checked = userPreferencesIdevices.includes(idevice.name);
        input.setAttribute(
            'aria-label',
            `${_('Activate')} ${idevice.title || idevice.id}`
        );

        const visual = document.createElement('span');
        visual.className = 'toggle-visual';
        visual.addEventListener('click', () => {
            input.checked = !input.checked;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const showLimitMessage = () => {
            if (this.alertFiveIdevices) {
                this.alertFiveIdevices.textContent = _(
                    'You can only select 5 iDevices as favourites. Please remove an iDevice so you can add another one.'
                );
                this.alertFiveIdevices.classList.add('show');
            }
        };
        const hideLimitMessage = () => {
            if (this.alertFiveIdevices) {
                this.alertFiveIdevices.classList.remove('show');
            }
        };
        const countChecked = () => {
            const listContainer = row.parentElement || document;
            return listContainer.querySelectorAll('.toggle-input:checked')
                .length;
        };

        input.addEventListener('change', () => {
            if (input.checked) {
                const checkedNow = countChecked();
                if (checkedNow > 5) {
                    input.checked = false;
                    showLimitMessage();
                    return;
                } else {
                    hideLimitMessage();
                }
            } else {
                hideLimitMessage();
            }
            idevice.visible = input.checked;
            this.getUserListIdevices()
                .then((idevicesArray) => {
                    if (!Array.isArray(idevicesArray)) idevicesArray = [];
                    const index = idevicesArray.indexOf(idevice.name);
                    if (input.checked) {
                        if (index === -1) idevicesArray.push(idevice.name);
                    } else {
                        if (index !== -1) idevicesArray.splice(index, 1);
                    }
                    this.saveIdevices(idevicesArray).then(() => {
                        eXeLearning.app.menus.menuIdevices.menuIdevicesBottomContent.innerHTML =
                            '';
                        eXeLearning.app.menus.menuIdevices.menuIdevicesBottom.init();
                    });
                })
                .catch((err) => {
                    console.error('Error updating idevices:', err);
                });
        });

        control.append(input, visual);
        row.append(control, label);

        return row;
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
        let reader = new FileReader();
        this.readers.push(reader);
        reader.onload = (event) => {
            this.uploadIdevice(file.name, event.target.result);
        };
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
}

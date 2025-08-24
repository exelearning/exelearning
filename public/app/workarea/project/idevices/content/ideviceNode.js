import RealTimeEventNotifier from '../../../../RealTimeEventNotifier/RealTimeEventNotifier.js';
/**
 * eXeLearning
 *
 * content Idevice
 */

export default class IdeviceNode {
    constructor(parent, data) {
        this.engine = parent;
        this.id = data.id ? data.id : null;
        this.odeIdeviceId = data.odeIdeviceId
            ? data.odeIdeviceId
            : this.engine.generateId();
        this.odeIdeviceTypeName = data.odeIdeviceTypeName
            ? data.odeIdeviceTypeName
            : '';
        // Idevice type data class
        this.idevice = eXeLearning.app.idevices.getIdeviceInstalled(
            this.odeIdeviceTypeName
        );
        // Set api params
        this.setParams(data);
        // Control parameters
        this.accesibility = 1;
        this.loading = data.loading ? data.loading : this.id ? false : true;
        this.visibility = true;
        this.haveEdition = true;
        this.canHaveHeirs = false;
        this.isSync = data.isSync ? data.isSync : false;
        // Loading files
        this.scriptsElements = [];
        this.stylesElements = [];
        // Content parameters
        this.ideviceContent = null;
        this.ideviceBody = null;
        this.ideviceButtons = null;
        // Time lapse waiting to load idevice
        this.checkDeviceLoadInterval = null;
        // Time (ms) of loop
        this.interval = 100;
        // Number of loops
        this.checkDeviceLoadNumMax = Math.round(
            this.engine.clientCallWaitingTime / this.interval
        );
        // Check if is valid
        this.checkIsValid();

        this.offlineInstallation = eXeLearning.config.isOfflineInstallation;

        if (!this.offlineInstallation) {
            this.realTimeEventNotifier = new RealTimeEventNotifier(
                eXeLearning.mercure.url,
                eXeLearning.mercure.jwtSecretKey
            );
        }
    }

    /**
     * Idevice properties
     */
    properties = JSON.parse(
        JSON.stringify(
            eXeLearning.app.api.parameters.odeComponentsSyncPropertiesConfig
        )
    );

    /**
     * Api params
     */
    params = [
        'odeNavStructureSyncId',
        'odePagStructureSyncId',
        'odeSessionId',
        'odeVersionId',
        'blockId',
        'parent',
        'order',
        'mode',
        'htmlView',
        'jsonProperties',
    ];

    /**
     * Default values of params
     */
    default = { order: 0, mode: 'edition', htmlView: '', jsonProperties: '{}' };

    /**
     * Parameters that need to be parsed
     */
    parseParams = ['jsonProperties'];

    /**
     * Set values of api object
     *
     * @param {Array} data
     */
    setParams(data) {
        for (let [i, param] of Object.entries(this.params)) {
            let defaultValue =
                this.default[param] != undefined ? this.default[param] : null;
            let value = data[param] ? data[param] : defaultValue;
            this[param] = this.parseParams.includes(param)
                ? JSON.parse(value)
                : value;
        }
        if (data.odeComponentsSyncProperties) {
            this.setProperties(data.odeComponentsSyncProperties);
        }
    }

    /**
     * Set values of api properties
     *
     * @param {Array} properties
     * @param {Boolean} onlyHeritable
     */
    setProperties(properties, onlyHeritable) {
        for (let [key, value] of Object.entries(this.properties)) {
            if (onlyHeritable) {
                if (properties[key].heritable)
                    value.value = properties[key].value;
            } else {
                value.value = properties[key].value;
            }
        }
        // Set properties attributes/classes
        if (this.ideviceContent) this.setPropertiesClassesToElement();
    }

    /*******************************************************************************
     * IDEVICE CONTENT
     *******************************************************************************/

    /**
     * Generate idevice content element
     *
     * @param {Boolean} newNode New element
     * @returns {Node}
     */
    makeIdeviceContentNode(newNode) {
        // Generate iDevice div
        if (newNode) {
            this.ideviceContent = document.createElement('div');
        } else {
            // Remove classes
            this.ideviceContent.classList.remove(
                ...this.ideviceContent.classList
            );
            // Remove attributes
            while (this.ideviceContent.attributes.length > 0) {
                this.ideviceContent.removeAttribute(
                    this.ideviceContent.attributes[0].name
                );
            }
        }
        this.ideviceContent.id = this.odeIdeviceId;
        // Idevice classes
        this.ideviceContent.classList.add('idevice_node');
        this.ideviceContent.classList.add('idevice-element-in-content');
        this.ideviceContent.classList.add('draggable');
        if (this.idevice && this.idevice.name)
            this.ideviceContent.classList.add(this.idevice.name);
        // Idevice attributes
        this.ideviceContent.setAttribute('mode', this.mode);
        this.ideviceContent.setAttribute('loading', this.loading);
        this.ideviceContent.setAttribute('order', this.order);
        this.ideviceContent.setAttribute('drag', 'idevice');
        // Idevice elements
        // - Body
        if (newNode) {
            this.ideviceContent.appendChild(this.makeIdeviceBodyElement());
        }
        // - Action buttons
        this.ideviceContent.appendChild(this.makeIdeviceButtonsElement());
        // Properties attributes/classes
        this.setPropertiesClassesToElement();

        return this.ideviceContent;
    }

    /**
     * Add atributes and classes to idevice content element based in properties
     *
     */
    setPropertiesClassesToElement() {
        // identifier
        if (this.properties.identifier.value != '') {
            this.ideviceContent.setAttribute(
                'identifier',
                this.properties.identifier.value
            );
        }
        // visibility
        if (this.properties.visibility.value != '') {
            this.ideviceContent.setAttribute(
                'export-view',
                this.properties.visibility.value
            );
        }
        // css class
        if (this.properties.cssClass.value != '') {
            let cssClasses = this.properties.cssClass.value
                ? this.properties.cssClass.value.split(' ')
                : [];
            cssClasses.forEach((cls) => {
                this.ideviceContent.classList.add(cls);
            });
        }
    }

    /**
     *
     * @returns
     */
    makeIdeviceBodyElement() {
        this.ideviceBody = document.createElement('div');
        this.ideviceBody.classList.add('idevice_body');
        this.ideviceBody.classList.add('idevice-element-in-content');
        if (this.idevice && this.idevice.cssClass) {
            this.ideviceBody.classList.add(`${this.idevice.cssClass}Idevice`);
        }
        this.ideviceBody.setAttribute('idevice-id', this.odeIdeviceId);
        // Add events
        this.addBehaviourEditionIdeviceDoubleClick();

        return this.ideviceBody;
    }

    /*********************************
     * BUTTONS GENERATION FUNCTIONS */

    /**
     * Generate the idevice button container element
     *
     * @returns
     */
    makeIdeviceButtonsElement() {
        if (!this.ideviceContent.querySelector('.idevice_actions')) {
            // Create the idevice button container base element
            this.ideviceButtons = document.createElement('div');
            this.ideviceButtons.classList.add('idevice_actions');
            this.ideviceButtons.classList.add('idevice-element-in-content');
            this.ideviceButtons.setAttribute('drag', 'idevice');
            this.ideviceButtons.setAttribute('idevice-id', this.odeIdeviceId);
            this.engine.addEventDragStartToContentIdevice(this.ideviceButtons);
            this.engine.addEventDragEndToContentIdevice(this.ideviceButtons);
        } else {
            // Remove the buttons from the container to re-create them based on the mode
            this.ideviceButtons
                .querySelectorAll('.button-action-idevice')
                .forEach((button) => {
                    button.remove();
                });
        }
        // Generate the buttons according to the mode of the idevice
        let id = this.odeIdeviceId;
        let blockButtonsHTML;

        // Get the iDevice height to check if the menu requires columns
        let dropdownColumns = '';
        let iH = $('#' + this.odeIdeviceId).height();
        if (!isNaN(iH)) {
            if (iH < 200) dropdownColumns = ' dropdown-menu-with-cols';
        }

        switch (this.mode) {
            case 'edition':
                blockButtonsHTML = `
                <div class="exe-actions-menu">
                    <button class="btn-action-menu btn btn-light btn-save-idevice" type="button" id=saveIdevice${id} title="${_('Save')}"><span class="auto-icon" aria-hidden="true">save</span><span class="visually-hidden">${_('Save')}</span></button>
                    <button class="btn-action-menu btn btn-light btn-delete-idevice exe-advanced" type="button" id=deleteIdevice${id} title="${_('Delete')}"><span class="auto-icon" aria-hidden="true">delete_forever</span><span class="visually-hidden">${_('Delete')}</span></button>
                    <button class="btn-action-menu btn btn-light btn-undo-idevice" type="button" id=undoIdevice${id} title="${_('Discard changes')}"><span class="auto-icon" aria-hidden="true">undo</span><span class="visually-hidden">${_('Discard changes')}</span></button>
                </div>`;
                // Check links (disabled) <li><button class="dropdown-item button-action-block" id="checkLinksIdevice${id}"><span class="auto-icon" aria-hidden="true">links</span>${_('Check links')}</button></li>
                this.ideviceButtons.innerHTML = blockButtonsHTML;
                // drag&drop
                this.ideviceButtons.setAttribute('draggable', false);
                // Event listeners
                this.addBehaviourSaveIdeviceButton();
                this.addBehaviourUndoIdeviceButton();
                this.addBehaviourDeleteIdeviceButton();
                this.addNoTranslateForGoogle();
                // Check links (disabled) this.addBehaviouCheckBrokenLinksIdeviceButton();
                break;
            case 'export':
                // action edition
                let blockButtonEditClass = ' disabled';
                if (this.haveEdition && this.valid) {
                    // In some cases the idevice will not be able to be edited
                    blockButtonEditClass = '';
                }
                blockButtonsHTML = `
                <div class="dropdown dropup exe-actions-menu">
                    <button class="btn-action-menu btn btn-light btn-edit-idevice${blockButtonEditClass}" type="button" id=editIdevice${id} title="${_('Edit')}" ${blockButtonEditClass}><span class="auto-icon" aria-hidden="true">edit</span><span class="visually-hidden">${_('Edit')}</span></button>
                    <button class="btn-action-menu btn btn-light btn-move-up-idevice" type="button" id=moveUpIdevice${id} title="${_('Move up')}"><span class="auto-icon" aria-hidden="true">keyboard_arrow_up</span><span class="visually-hidden">${_('Move up')}</span></button>
                    <button class="btn-action-menu btn btn-light btn-move-down-idevice" type="button" id=moveDownIdevice${id} title="${_('Move down')}"><span class="auto-icon" aria-hidden="true">keyboard_arrow_down</span><span class="visually-hidden">${_('Move down')}</span></button>
                    <button class="btn-action-menu btn btn-light btn-delete-idevice" type="button" id=deleteIdevice${id} title="${_('Delete')}"><span class="auto-icon" aria-hidden="true">delete_forever</span><span class="visually-hidden">${_('Delete')}</span></button>                    
                    <button class="btn-action-menu btn btn-light exe-advanced" type="button" id="dropdownMenuButtonIdevice${id}" data-bs-toggle="dropdown" aria-expanded="false" title="${_('Actions')}"><span class="auto-icon" aria-hidden="true">more_horiz</span><span class="visually-hidden">${_('Actions')}</span></button>
                    <ul class="dropdown-menu${dropdownColumns} button-action-block exe-advanced" aria-labelledby="dropdownMenuButtonIdevice${id}">
                        <li><button class="dropdown-item button-action-block" id="propertiesIdevice${id}"><span class="auto-icon" aria-hidden="true">settings</span>${_('Properties')}</button></li>
                        <li><button class="dropdown-item button-action-block" id="cloneIdevice${id}"><span class="auto-icon" aria-hidden="true">content_copy</span>${_('Clone')}</button></li>
                        <li><button class="dropdown-item button-action-block" id="moveIdevice${id}"><span class="auto-icon" aria-hidden="true">flip_to_back</span>${_('Move to')}</button></li>
                        <li class="exe-advanced"><button class="dropdown-item button-action-block" id="exportIdevice${id}"><span class="auto-icon" aria-hidden="true">file_download</span>${_('Export')}</button></li>
                     </ul>
                </div>`;
                // Check links (disabled) <li><button class="dropdown-item button-action-block" id="checkLinksIdevice${id}"><span class="auto-icon" aria-hidden="true">links</span>${_('Check links')}</button></li>
                this.ideviceButtons.innerHTML = blockButtonsHTML;
                // drag&drop
                this.ideviceButtons.setAttribute('draggable', true);
                // Event listeners
                this.addBehaviourEditionIdeviceButton();
                this.addBehaviourMoveUpIdeviceButton();
                this.addBehaviourMoveDownIdeviceButton();
                this.addBehaviourDeleteIdeviceButton();
                this.addBehaviourPropertiesIdeviceButton();
                this.addBehaviouCloneIdeviceButton();
                this.addBehaviourMoveToPageIdeviceButton();
                this.addBehaviourExportIdeviceButton();
                this.addNoTranslateForGoogle();
                // Check links (disabled) this.addBehaviouCheckBrokenLinksIdeviceButton();
                break;
        }
        this.addTooltips();
        return this.ideviceButtons;
    }

    /**
     * Toggle the idevice buttons action state
     *
     * @returns
     */
    toogleIdeviceButtonsState(disable) {
        if (!this.ideviceButtons) return;
        this.ideviceButtons
            .querySelectorAll('.button-action-idevice')
            .forEach((button) => {
                button.disabled = disable;
            });
    }

    /**
     * Create a button to add a Text iDevice
     */
    createAddTextBtn() {
        eXeLearning.app.menus.menuStructure.engine.menuStructureBehaviour.createAddTextBtn();
    }

    /*********************************
     * BUTTONS EVENTS */

    /**
     *
     */
    addBehaviourSaveIdeviceButton() {
        this.ideviceButtons
            .querySelector('#saveIdevice' + this.odeIdeviceId)
            .addEventListener('click', (e) => {
                if (e.target.disabled) return;
                this.toogleIdeviceButtonsState(true);
                // Save and desactivate component flag
                this.save(true);
                // Create the "Add Text" button
                this.createAddTextBtn();
                // Activate update flag
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    this.blockId,
                    this.odeIdeviceId,
                    'EDIT',
                    null
                );
            });
    }

    /**
     *
     */
    addBehaviourPropertiesIdeviceButton() {
        this.ideviceButtons
            .querySelector('#propertiesIdevice' + this.odeIdeviceId)
            .addEventListener('click', (e) => {
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, this.odeIdeviceId)
                    .then((response) => {
                        const parent = e.target.closest('.idevice_node');
                        if (
                            parent &&
                            parent.getAttribute('mode') === 'export'
                        ) {
                            if (eXeLearning.app.project.checkOpenIdevice())
                                return;
                        }
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            eXeLearning.app.modals.properties.show({
                                node: this,
                                title: _('iDevice properties'),
                                contentId: 'idevice-properties',
                                properties: this.properties,
                            });
                        }
                    });
            });
    }

    /**
     *
     */
    addBehaviourEditionIdeviceButton() {
        this.ideviceButtons
            .querySelector('#editIdevice' + this.odeIdeviceId)
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (e.target.disabled) return;
                this.toogleIdeviceButtonsState(true);
                eXeLearning.app.project
                    .changeUserFlagOnEdit(
                        true,
                        this.odeNavStructureSyncId,
                        this.blockId,
                        this.odeIdeviceId
                    )
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Send operation log action to bbdd
                            let additionalData = {
                                blockId: this.blockId,
                                odeIdeviceId: this.odeIdeviceId,
                            };
                            eXeLearning.app.project.sendOdeOperationLog(
                                this.block.pageId,
                                this.block.pageId,
                                'EDIT_IDEVICE',
                                additionalData
                            );
                            this.edition();
                        }
                    });
            });
    }

    /**
     *
     */
    addBehaviourEditionIdeviceDoubleClick() {
        this.ideviceBody.addEventListener('dblclick', (element) => {
            if (this.mode == 'export') {
                eXeLearning.app.project
                    .changeUserFlagOnEdit(
                        true,
                        this.odeNavStructureSyncId,
                        this.blockId,
                        this.odeIdeviceId
                    )
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Send operation log action to bbdd
                            let additionalData = {
                                blockId: this.blockId,
                                odeIdeviceId: this.odeIdeviceId,
                            };
                            eXeLearning.app.project.sendOdeOperationLog(
                                this.block.pageId,
                                this.block.pageId,
                                'EDIT_IDEVICE',
                                additionalData
                            );
                            this.edition();
                            this.clearSelection();
                        }
                    });
            }
        });
    }

    /**
     *
     */
    addBehaviourDeleteIdeviceButton() {
        this.ideviceButtons
            .querySelector('#deleteIdevice' + this.odeIdeviceId)
            .addEventListener('click', (e) => {
                const parent = e.target.closest('.idevice_node');
                if (parent && parent.getAttribute('mode') === 'export') {
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                }
                // Create the "Add Text" button
                this.createAddTextBtn();
                // Update current ode user (current_component, current_ block)
                eXeLearning.app.project
                    .changeUserFlagOnEdit(
                        false,
                        this.odeNavStructureSyncId,
                        this.blockId,
                        this.odeIdeviceId,
                        true
                    )
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            eXeLearning.app.modals.confirm.show({
                                title: _('Delete iDevice'),
                                body: _(
                                    'Delete iDevice? This cannot be undone.'
                                ),
                                confirmButtonText: _('Yes'),
                                confirmExec: () => {
                                    eXeLearning.app.project
                                        .updateCurrentOdeUsersUpdateFlag(
                                            false,
                                            null,
                                            this.blockId,
                                            this.odeIdeviceId,
                                            'DELETE',
                                            null
                                        )
                                        .then((response) => {
                                            // Send operation log action to bbdd
                                            let additionalData = {
                                                blockId: this.blockId,
                                                odeIdeviceId: this.odeIdeviceId,
                                            };
                                            eXeLearning.app.project.sendOdeOperationLog(
                                                this.block.pageId,
                                                this.block.pageId,
                                                'REMOVE_IDEVICE',
                                                additionalData
                                            );
                                            this.remove(true);
                                        });
                                },
                            });
                        }
                    });
            });
    }

    /**
     *
     */
    addBehaviourUndoIdeviceButton() {
        this.ideviceButtons
            .querySelector('#undoIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                eXeLearning.app.modals.confirm.show({
                    title: _('Discard changes'),
                    body: _('Discard all changes?'),
                    confirmButtonText: _('Yes'),
                    confirmExec: () => {
                        // Create the "Add Text" button
                        this.createAddTextBtn();
                        eXeLearning.app.project.changeUserFlagOnEdit(
                            false,
                            this.odeNavStructureSyncId,
                            this.blockId,
                            this.odeIdeviceId
                        );
                        let idevicesExceptionsList = [];
                        this.engine.components.idevices.forEach((idevice) => {
                            if (idevice.id != this.id) {
                                idevicesExceptionsList.push(idevice.id);
                            }
                        });
                        this.loadInitScriptIdevice('export');
                        this.engine.resetCurrentIdevicesExportView([]);
                    },
                });
            });
    }

    /**
     *
     */
    addBehaviouCloneIdeviceButton() {
        this.ideviceButtons
            .querySelector('#cloneIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                this.apiCloneIdevice();
            });
    }

    /**
     * Get broken links in ode idevice
     * @returns
     */
    async getOdeIdeviceBrokenLinksEvent(ideviceId) {
        let odeIdeviceBrokenLinks =
            await eXeLearning.app.api.getOdeIdeviceBrokenLinks(ideviceId);
        return odeIdeviceBrokenLinks;
    }

    /**
     *
     */
    addBehaviourMoveUpIdeviceButton() {
        this.ideviceButtons
            .querySelector('#moveUpIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // check component Flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, this.odeIdeviceId)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Previous order idevice
                            let idevicePreviousOrder = this.order;
                            // Not move the idevice if it is already moving
                            if (
                                !this.ideviceContent.classList.contains(
                                    'moving'
                                )
                            ) {
                                // Check if there is an idevice in the previous position
                                let previousIdevice =
                                    this.getContentPrevIdevice();
                                if (previousIdevice) {
                                    // Add a temporary class to handle display effects
                                    this.ideviceContent.classList.add('moving');
                                    // Change order
                                    this.order--;
                                    // Update in database
                                    this.apiUpdateOrder().then((response) => {
                                        if (response.responseMessage == 'OK') {
                                            // Move element
                                            this.block.blockContent.insertBefore(
                                                this.ideviceContent,
                                                previousIdevice
                                            );
                                            // Send operation log action to bbdd
                                            let additionalData = {
                                                blockId: this.blockId,
                                                odeIdeviceId: this.odeIdeviceId,
                                                previousOrder:
                                                    idevicePreviousOrder,
                                            };
                                            eXeLearning.app.project.sendOdeOperationLog(
                                                this.block.pageId,
                                                this.block.pageId,
                                                'MOVE_IDEVICE_ON',
                                                additionalData
                                            );
                                        }
                                    });
                                }
                            }
                        }
                    });
            });
    }

    /**
     *
     */
    addBehaviourMoveDownIdeviceButton() {
        this.ideviceButtons
            .querySelector('#moveDownIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, this.odeIdeviceId)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Previous order idevice
                            let idevicePreviousOrder = this.order;
                            // Not move the idevice if it is already moving
                            if (
                                !this.ideviceContent.classList.contains(
                                    'moving'
                                )
                            ) {
                                // Check if there is an idevice in the previous position
                                let nextIdevice = this.getContentNextIdevice();
                                if (nextIdevice) {
                                    // Add a temporary class to handle display effects
                                    this.ideviceContent.classList.add('moving');
                                    // Change order
                                    this.order++;
                                    // Update in database
                                    this.apiUpdateOrder().then((response) => {
                                        if (response.responseMessage == 'OK') {
                                            // Move element
                                            this.block.blockContent.insertBefore(
                                                this.ideviceContent,
                                                nextIdevice.nextSibling
                                            );
                                            // Send operation log action to bbdd
                                            let additionalData = {
                                                blockId: this.blockId,
                                                odeIdeviceId: this.odeIdeviceId,
                                                previousOrder:
                                                    idevicePreviousOrder,
                                            };
                                            eXeLearning.app.project.sendOdeOperationLog(
                                                this.block.pageId,
                                                this.block.pageId,
                                                'MOVE_IDEVICE_ON',
                                                additionalData
                                            );
                                        }
                                    });
                                }
                            }
                        }
                    });
            });
    }

    /**
     *
     */
    addBehaviourMoveToPageIdeviceButton() {
        this.ideviceButtons
            .querySelector('#moveIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, this.odeIdeviceId)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Generate body modal
                            let bodyElement =
                                this.generateModalMoveToPageBody();
                            // Show modal
                            eXeLearning.app.modals.confirm.show({
                                title: _('Move iDevice to page'),
                                body: bodyElement.innerHTML,
                                contentId: 'modal-move-to-page',
                                confirmButtonText: _('Move'),
                                cancelButtonText: _('Cancel'),
                                confirmExec: () => {
                                    let select =
                                        eXeLearning.app.modals.confirm.modalElementBody.querySelector(
                                            '.select-move-to-page'
                                        );
                                    let selectPage = select.item(
                                        select.selectedIndex
                                    );
                                    let newPageId =
                                        selectPage.getAttribute('value');
                                    // Get odePageId
                                    let workareaElement =
                                        document.querySelector(
                                            '#main #workarea'
                                        );
                                    let menuNav =
                                        workareaElement.querySelector(
                                            '#menu_nav_content'
                                        );
                                    let pageElement = menuNav.querySelector(
                                        `[nav-id="${newPageId}"]`
                                    );
                                    let odePageId =
                                        pageElement.getAttribute('page-id');

                                    // Get page id before update
                                    let previousPageId =
                                        this.odeNavStructureSyncId;
                                    let previousOdePageId =
                                        eXeLearning.app.project.structure.getSelectNodePageId();
                                    // Get blockId before update
                                    let previousBlockId = this.blockId;
                                    this.apiUpdatePage(newPageId);
                                    if (
                                        parseInt(newPageId) !==
                                        this.odeNavStructureSyncId
                                    ) {
                                        eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                                            false,
                                            null,
                                            null,
                                            this.odeIdeviceId,
                                            'MOVE_TO_PAGE',
                                            odePageId
                                        );
                                        // Send operation log action to bbdd
                                        let additionalData = {
                                            previousPageId: previousPageId,
                                            newPageId: newPageId,
                                            blockId: previousBlockId,
                                            odeIdeviceId: this.odeIdeviceId,
                                            previousOrder: this.order,
                                        };
                                        eXeLearning.app.project.sendOdeOperationLog(
                                            previousOdePageId,
                                            odePageId,
                                            'MOVE_IDEVICE_TO',
                                            additionalData
                                        );
                                    }
                                },
                            });
                        }
                    });
            });
    }

    /**
     *
     */
    addBehaviourExportIdeviceButton() {
        this.ideviceButtons
            .querySelector('#exportIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, this.odeIdeviceId)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            this.downloadIdeviceSelected(
                                this.blockId,
                                this.odeIdeviceId
                            );
                        }
                    });
            });
    }

    /**
     *
     */
    addNoTranslateForGoogle() {
        $('.auto-icon', this.ideviceButtons).addClass('notranslate');
    }

    /**
     *
     */
    addTooltips() {
        $('button.btn-action-menu', this.ideviceButtons).addClass(
            'exe-app-tooltip'
        );
        eXeLearning.app.common.initTooltips(this.ideviceButtons);
    }

    /**
     *
     */
    /* To review (disabled)
    addBehaviouCheckBrokenLinksIdeviceButton() {
        this.ideviceButtons
            .querySelector('#checkLinksIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                let ideviceId = this.odeIdeviceId;
                this.getOdeIdeviceBrokenLinksEvent(ideviceId).then(
                    (response) => {
                        if (!response.responseMessage) {
                            // Show eXe OdeBrokenList modal
                            eXeLearning.app.modals.odebrokenlinks.show(
                                response,
                            );
                        } else {
                            // Open eXe alert modal
                            eXeLearning.app.modals.alert.show({
                                title: _('Broken Links'),
                                body: "There aren't broken links",
                            });
                        }
                    },
                );
            },
        );
    }
    */

    /**
     *
     * @param {*} odeBlockId
     * @param {*} odeIdeviceId
     */
    async downloadIdeviceSelected(odeBlockId, odeIdeviceId) {
        let odeSessionId = eXeLearning.app.project.odeSession;

        let response = await eXeLearning.app.api.getOdeIdevicesDownload(
            odeSessionId,
            odeBlockId,
            odeIdeviceId
        );
        if (response['response'].includes('responseMessage')) {
            // Response to show always on 3
            let bodyResponse = response['response'].split('"');
            eXeLearning.app.modals.alert.show({
                title: _('Download error'),
                body: bodyResponse[3],
                contentId: 'error',
            });
        } else {
            window.open(response['url']);
        }
    }

    /*********************************
     * MODALS BODY */

    /**
     *
     * @returns {Node}
     */
    generateModalMoveToPageBody() {
        let bodyElement = document.createElement('div');
        let textElement = document.createElement('p');
        let selectElement = document.createElement('select');
        textElement.innerHTML = _(
            'Select the page you want to move the idevice to. This will be at the end of it.'
        );
        textElement.classList.add('text-info-move-to-page');
        selectElement.classList.add('select-move-to-page');
        bodyElement.append(textElement);
        bodyElement.append(selectElement);
        // Add pages to select
        let pages = eXeLearning.app.project.structure.getAllNodesOrderByView();
        pages.forEach((page) => {
            let option = document.createElement('option');
            option.value = page.id;
            option.innerHTML = `${'&nbsp;&nbsp;'.repeat(page.deep)} ${page.pageName}`;
            if (page.id == this.block.odeNavStructureSyncId)
                option.setAttribute('selected', 'selected');
            selectElement.append(option);
        });
        return bodyElement;
    }

    /*******************************************************************************
     * IDEVICE LOAD VIEWS
     *******************************************************************************/

    /**
     *
     * @param {*} mode
     */
    async loadInitScriptIdevice(mode) {
        switch (mode) {
            case 'edition':
                this.loadEditionIdevice();
                await this.ideviceInitEdition();
                break;
            case 'export':
                this.restartExeIdeviceValue();
                await this.ideviceInitExport();
                break;
        }
        this.updateMode(mode);
        this.engine.updateMode();
        setTimeout(() => {
            this.makeIdeviceButtonsElement();
        }, 100);
    }

    /*********************************
     * EDITION */

    /**
     *
     */
    async loadEditionIdevice() {
        // Remove head scripts/styles elements
        this.clearFilesElements();
        // Restart $exeDevice value
        if (typeof $exeDevice !== 'undefined') {
            $exeDevice = undefined;
        }
        // Load idevice edition files
        this.loadScriptsEdition();
        await this.loadStylesEdition();
    }

    /**
     * Initialize edition scripts of idevice
     *
     */
    async ideviceInitEdition() {
        let checkDeviceLoadNum = this.checkDeviceLoadNumMax;
        eXeLearning.app.idevices.setIdeviceActive(this);
        // Generate interval
        this.checkDeviceLoadInterval = setInterval(() => {
            if (typeof $exeDevice !== 'undefined') {
                this.ideviceInitEditionLoadSuccess();
            } else {
                checkDeviceLoadNum--;
                if (checkDeviceLoadNum <= 0) {
                    this.ideviceInitEditionLoadError();
                }
            }
        }, this.interval);
    }

    /**
     * ideviceInitEdition
     * In case the idevice edition loads correctly
     *
     */
    ideviceInitEditionLoadSuccess() {
        clearInterval(this.checkDeviceLoadInterval);
        // In case the idevice does not exist in the database, we create it
        if (!this.id) {
            this.apiSaveIdevice().then((response) => {
                this.ideviceInitEditionLoadSuccessInitScript();
            });
        } else {
            this.ideviceInitEditionLoadSuccessInitScript();
        }
    }

    /**
     * ideviceInitEdition
     * Init edition idevice script process
     *
     */
    ideviceInitEditionLoadSuccessInitScript() {
        this.loading = false;
        this.ideviceContent.setAttribute('loading', false);
        this.initExeDeviceEdition();
        this.loadLegacyExeFunctionalitiesEdition();
    }

    /**
     * ideviceInitEdition
     * In case the idevice edition fails to load
     *
     */
    ideviceInitEditionLoadError() {
        clearInterval(this.checkDeviceLoadInterval);
        this.editionLoadedError();
    }

    /*********************************************
  * EXPORT
  /*********************************************/

    /**
     * Get html view
     *
     */
    exportHtmlView() {
        let html;
        if (
            eXeLearning.app.themes.selected &&
            eXeLearning.app.themes.selected.templateIdevice
        ) {
            html = eXeLearning.app.themes.selected.templateIdevice;
            html = html.replace('{idevice-content}', this.htmlView);
        } else {
            html = this.htmlView;
        }
        return html;
    }

    /**
     * Restart $exeDevice value (idevice edition class)
     *
     */
    restartExeIdeviceValue() {
        // Check sync idevice
        if (this.isSync == true) {
            this.isSync = false;
        } else {
            if (typeof $exeDevice !== 'undefined') {
                $exeDevice = undefined;
            }
        }
    }

    /**
     * Initialize export scripts of idevice
     *
     */
    async ideviceInitExport() {
        let exportLoad;
        let componentType =
            this.idevice && this.idevice.componentType
                ? this.idevice.componentType
                : null;
        switch (componentType) {
            case 'json':
                let checkDeviceLoadNum = this.checkDeviceLoadNumMax;
                // We try to load the idevice object several times asynchronously
                do {
                    if (
                        typeof window[this.idevice.exportObject] !== 'undefined'
                    ) {
                        exportLoad = await this.ideviceInitExportLoadSuccess();
                    } else {
                        await eXeLearning.app.common.timer(this.interval);
                    }
                    checkDeviceLoadNum--;
                } while (!exportLoad && checkDeviceLoadNum > 0);
                // In case of not having been able to load the object, we return an error
                if (!exportLoad) this.ideviceInitExportLoadError();
                break;
            case 'html':
            default:
                exportLoad = await this.ideviceInitExportLoadSuccess();
                break;
        }
        return exportLoad;
    }

    /**
     * ideviceInitExport
     * In case the idevice export loads correctly
     *
     */
    async ideviceInitExportLoadSuccess() {
        clearInterval(this.checkDeviceLoadInterval);
        return await this.generateContentExportView();
    }

    /**
     * ideviceInitExport
     * In case the idevice export fails to load
     *
     */
    ideviceInitExportLoadError() {
        clearInterval(this.checkDeviceLoadInterval);
        this.exportLoadedError();
    }

    /**
     * Load htmlView of idevice in idevice body
     *
     */
    async generateContentExportView() {
        let response;
        let componentType =
            this.idevice && this.idevice.componentType
                ? this.idevice.componentType
                : null;
        switch (componentType) {
            case 'json':
                response = await this.exportProcessIdeviceJson();
                break;
            case 'html':
            default:
                response = await this.exportProcessIdeviceHtml();
                break;
        }
        return response;
    }

    /**
     * Export process of idevice html
     * In html type idevices just assign the html saved of the idevice to the body
     *
     */
    async exportProcessIdeviceHtml() {
        let response = new Promise((resolve, reject) => {
            this.ideviceBody.innerHTML = this.exportHtmlView();
            resolve({ init: 'true' });
        });
        return response;
    }

    /**
     * Export process of the idevice using the class defined in its js.
     * In json type idevices the export process also involves saving the generated html.
     *
     */
    async exportProcessIdeviceJson() {
        let response = {};
        this.exportObject = window[this.idevice.exportObject];
        // Check that the idevice has save data
        if (
            this.jsonProperties &&
            Object.keys(this.jsonProperties).length > 0
        ) {
            // Get export html template
            let htmlTemplate = this.idevice.exportTemplateContent;
            // Idevice export function 1: renderView
            this.htmlView = this.exportObject.renderView(
                this.jsonProperties,
                this.accesibility,
                htmlTemplate,
                this.odeIdeviceId
            );
            this.ideviceBody.innerHTML = this.exportHtmlView();
            // Idevice export function 2: renderBehaviour
            this.exportObject.renderBehaviour(
                this.jsonProperties,
                this.accesibility,
                this.odeIdeviceId
            );
            // Idevice export function 3: init
            this.exportObject.init(this.jsonProperties, this.accesibility);
            // In case the idevice is in edition we must save the viewHTML
            if (this.mode == 'edition') {
                let saveIdeviceResponse = await this.apiSaveIdeviceViewHTML();
                return saveIdeviceResponse;
            } else {
                response.responseMessage = 'OK';
                return response;
            }
        }
        // The idevice hasn't saved data
        else {
            response = new Promise((resolve, reject) => {
                // In case the idevice has no json data, We try to load the viewhtml of it
                this.ideviceBody.innerHTML = this.exportHtmlView();
                this.exportObject.renderBehaviour({}, this.accesibility);
                this.exportObject.init({}, this.accesibility);
                resolve({ init: 'true' });
            });
            return response;
        }
    }

    /*******************************************************************************
     * API
     *******************************************************************************/

    /**
     *
     * @returns
     */
    async saveIdeviceProcess() {
        let saveOK;
        let componentType =
            this.idevice && this.idevice.componentType
                ? this.idevice.componentType
                : null;
        switch (componentType) {
            case 'json':
                saveOK = await this.apiSaveIdeviceJson(true);
                break;
            case 'html':
            default:
                saveOK = await this.apiSaveIdeviceViewHTML(true);
                break;
        }
        return saveOK;
    }

    /**
     * Save new idevice in database
     *
     * @returns {Array}
     */
    async apiSaveIdevice() {
        let params = [
            'odeVersionId',
            'odeSessionId',
            'odeNavStructureSyncId',
            'odePagStructureSyncId',
            'odePageId',
            'odeBlockId',
            'iconName',
            'blockName',
            'odeIdeviceId',
            'odeIdeviceTypeName',
        ];
        // If there are already idevices in the block, it is necessary to establish an order value
        let currentOrder = this.getCurrentOrder();
        if (currentOrder >= 0) {
            this.order = currentOrder;
            params.push('order');
        }
        // Save new idevice in database
        let response = await this.apiSendDataService(
            'putSaveIdevice',
            params,
            true
        );
        if (response.responseMessage == 'OK') {
            // Set properties of idevice
            this.setProperties(
                response.odeComponentsSync.odeComponentsSyncProperties
            );
            // Creating a new idevice also generates a new box
            if (response.newOdePagStructureSync) {
                // Set properties of block
                this.block.setProperties(
                    response.odePagStructureSync.odePagStructureSyncProperties
                );
                // Send box order
                this.block.apiUpdateOrder(true).then((response) => {});
            }
        }
        // Error saving idevice
        else {
            this.toogleIdeviceButtonsState(false);
            let defaultErrorMessage = _(
                'An error occurred while save component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultErrorMessage);
        }
        return response;
    }

    /**
     * Save properties in database
     *
     * @param {*} properties
     */
    async apiSaveProperties(properties) {
        // Uptate array of properties
        for (let [key, value] of Object.entries(properties)) {
            this.properties[key].value = value;
        }
        // Generate params array
        let params = { odeComponentsSyncId: this.id };
        for (let [key, value] of Object.entries(this.properties)) {
            params[key] = value.value;
        }
        // Save in database
        eXeLearning.app.api
            .putSavePropertiesIdevice(params)
            .then((response) => {
                if (
                    response.responseMessage &&
                    response.responseMessage == 'OK'
                ) {
                    // Reset idevice content
                    this.makeIdeviceContentNode(false);
                    // Synchronize current users
                    eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                        false,
                        null,
                        this.blockId,
                        this.odeIdeviceId,
                        'EDIT',
                        null
                    );
                } else {
                    eXeLearning.app.modals.alert.show({
                        title: _('iDevice error'),
                        body: _(
                            "An error occurred while saving idevice's properties in database"
                        ),
                        contentId: 'error',
                    });
                }
            });
    }

    /**
     * Save htmlView in database
     *
     * @returns {String}
     */
    async apiSaveIdeviceViewHTML(saveIdevice) {
        let params = ['odeComponentsSyncId', 'htmlView'];
        // Get idevice html
        if (saveIdevice && typeof $exeDevice !== 'undefined' && $exeDevice) {
            this.htmlView = $exeDevice.save();
            // Add class error to idevice
            if (this.htmlView == false) {
                this.ideviceBody.classList.add('save-error');
            }
        }
        // Save idevice
        if (this.htmlView && this.htmlView != 'undefined') {
            let response = await this.apiSendDataService(
                'putSaveHtmlView',
                params,
                false
            );
            return response;
        } else {
            return false;
        }
    }

    /**
     * Save jsonProperties in database
     *
     * @returns {Array}
     */
    async apiSaveIdeviceJson(saveIdevice) {
        let params = ['odeComponentsSyncId', 'jsonProperties'];
        if (saveIdevice && typeof $exeDevice !== 'undefined' && $exeDevice) {
            this.jsonProperties = $exeDevice.save();
            // Add class error to idevice
            if (this.jsonProperties == false) {
                this.ideviceBody.classList.add('save-error');
            }
        }
        if (this.jsonProperties && this.jsonProperties != 'undefined') {
            this.htmlView = this.htmlView ? this.htmlView : '';
            let response = await this.apiSendDataService(
                'putSaveIdevice',
                params,
                false
            );
            return response;
        } else {
            return false;
        }
    }

    /**
     * Update odePagStructureSyncId of idevice in database
     *
     * @returns {Array}
     */
    async apiUpdateBlock() {
        let params2 = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeIdeviceId: this.odeIdeviceId,
            odeNavStructureSyncId: this.odeNavStructureSyncId,
            actionType: 'MOVE_ON_PAGE',
            odeComponentFlag: false,
        };
        eXeLearning.app.api.postActivateCurrentOdeUsersUpdateFlag(params2);
        let params = ['odeComponentsSyncId', 'odePagStructureSyncId'];
        // Check if new block (not yet saved in the database)
        if (
            this.block.id == eXeLearning.app.api.parameters.generateNewItemKey
        ) {
            params = params.concat([
                'odeVersionId',
                'odeSessionId',
                'odeNavStructureSyncId',
                'odePagStructureSyncOrder',
                'odePageId',
                'odeBlockId',
                'blockName',
                'iconName',
            ]);
        }
        // If there are already idevices in the block, it is necessary to establish an order value
        let currentOrder = this.getCurrentOrder();
        if (currentOrder >= 0) {
            this.order = currentOrder;
            params.push('order');
        }
        // Save idevice in database
        let response = await this.apiSendDataService(
            'putSaveIdevice',
            params,
            true
        );
        if (response.responseMessage == 'OK') {
            // Update list of components to assign the idevices to their respective blocks
            this.engine.setParentsAndChildrenIdevicesBlocks(true);
        }
        // Error saving idevice
        else {
            this.toogleIdeviceButtonsState(false);
            let defaultErrorMessage = _(
                'An error occurred while update component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultErrorMessage);
        }
        return response;
    }

    /**
     * Update page of idevice in database
     *
     * @return {Array}
     */
    async apiUpdatePage(odeNavStructureSyncId) {
        // Can't move component to current page
        if (this.odeNavStructureSyncId == odeNavStructureSyncId) return false;
        // Required parameters
        let params = [
            'odeComponentsSyncId',
            'odeNavStructureSyncId',
            'odePagStructureSyncId',
            'odeVersionId',
            'odeSessionId',
            'odePageId',
            'odeBlockId',
            'blockName',
            'iconName',
        ];
        // Generate new block
        let blockData = {
            odePagStructureSyncId:
                eXeLearning.app.api.parameters.generateNewItemKey,
            iconName: '', //this.idevice.icon.name,
            blockName: this.idevice.title,
        };
        this.block = this.engine.newBlockNode(blockData, false);
        this.odeNavStructureSyncId = odeNavStructureSyncId;
        this.odePagStructureSyncId = this.block.odePagStructureSyncId;
        this.blockId = this.block.blockId;
        // Update page in database
        let response = await this.apiSendDataService(
            'putSaveIdevice',
            params,
            true
        );
        if (response.responseMessage == 'OK') {
            // Remove idevice view
            this.remove();
            // Update list of components to assign the idevices to their respective blocks
            this.engine.setParentsAndChildrenIdevicesBlocks(true);
        }
        // Error saving idevice in database
        else {
            this.toogleIdeviceButtonsState(false);
            let defaultErrorMessage = _(
                'An error occurred while update component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultErrorMessage);
        }
    }

    /**
     * Update order of idevice in database
     *
     * @return {Array}
     */
    async apiUpdateOrder() {
        let params = ['odeComponentsSyncId', 'order'];
        // Update order in database
        let response = await this.apiSendDataService(
            'putReorderIdevice',
            params,
            true
        );
        if (response.responseMessage == 'OK') {
            // Activate Update flag to the others current users
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                null,
                this.odeIdeviceId,
                'MOVE_ON_PAGE',
                null
            );
            // Update the order of other components if necessary
            this.engine.updateComponentsIdevices(response.odeComponentsSyncs, [
                'order',
            ]);
            // Remove class moving of idevice
            setTimeout(() => {
                this.ideviceContent.classList.remove('moving');
            }, this.engine.movingClassDuration);
        }
        // Error saving idevice in database
        else {
            this.toogleIdeviceButtonsState(false);
            let defaultErrorMessage = _(
                'An error occurred while update component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultErrorMessage);
        }
        // this.sendPublishedNotification();
        return response;
    }

    /**
     * Clone the idevice
     *
     */
    async apiCloneIdevice() {
        let params = ['odeComponentsSyncId'];
        let response = await this.apiSendDataService(
            'postCloneIdevice',
            params,
            true
        );
        if (response.responseMessage == 'OK') {
            await this.engine.cloneIdeviceInContent(
                this,
                response.odeComponentsSync
            );
            // Activate Update flag to the others current users
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                this.blockId,
                response.odeComponentsSync.odeIdeviceId,
                'ADD',
                null
            );
            // Send operation log action to bbdd
            let additionalData = {
                blockId: this.blockId,
                odeIdeviceId: response.odeComponentsSync.odeIdeviceId,
            };
            eXeLearning.app.project.sendOdeOperationLog(
                this.block.pageId,
                this.block.pageId,
                'CLONE_IDEVICE',
                additionalData
            );
            eXeLearning.app.modals.alert.show({
                title: _('Information'),
                body: _(
                    'Identical contents in the same page might cause errors. Edit the new one or move it to another page.'
                ),
            });
        } else {
            let defaultErrorMessage = _(
                'An error occurred while clone component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultErrorMessage);
        }
        return response;
    }

    /**
     * Delete the idevice from the database
     *
     */
    async apiDeleteIdevice() {
        eXeLearning.app.api.deleteIdevice(this.id).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // All idevices that have been modified
                if (response.odeComponentsSyncs) {
                    // update the order of other idevices
                    this.engine.updateComponentsIdevices(
                        response.odeComponentsSyncs,
                        ['order']
                    );
                    // this.sendPublishedNotification();
                }
                // Checks if the parent should be removed or a warning should be displayed
                //this.removeBlockParentProcess();
            }
            // Error saving idevice in database
            else {
                let defaultErrorMessage = _(
                    'An error occurred while removing the component from the database'
                );
                this.showModalMessageErrorDatabase(
                    response,
                    defaultErrorMessage
                );
            }
        });
    }

    /**
     *
     * @param {File} file
     * @param {String} filename
     * @returns {Boolean}
     */
    async apiUploadFile(file, filename) {
        let params = {
            odeIdeviceId: this.odeIdeviceId,
            file: file,
            filename: filename,
            createThumbnail: true,
        };
        let response = await eXeLearning.app.api.postUploadFileResource(params);

        return response;
    }

    /**
     *
     * @param {File} file
     * @param {String} filename
     * @returns {Boolean}
     */
    async apiUploadLargeFile(formData) {
        formData.append('odeIdeviceId', [this.odeIdeviceId]);
        formData.append('createThumbnail', [true]);
        let response =
            await eXeLearning.app.api.postUploadLargeFileResource(formData);

        if (typeof response === 'string') {
            if (
                response.includes('Allowed memory') ||
                response.includes('Out of memory')
            ) {
                response = {
                    code: _('File is too large'),
                };
            } else {
                response = {
                    code: _('Error uploading file'),
                };
            }
        }

        return response;
    }

    /**
     * Call service to get idevice in bbdd
     *
     */
    async apiGetHtmlView() {
        let response = await eXeLearning.app.api.getSaveHtmlView(this.id);
        this.ideviceBody.innerHTML = response.htmlView;
        this.htmlView = response.htmlView;
        return this.htmlView;
    }

    /**
     * Call service to get idevice html template (json idevices)
     *
     */
    async apiGetComponentHtmlTemplate() {
        let response = await eXeLearning.app.api.getComponentHtmlTemplate(
            this.id
        );
        return response.htmlTemplate;
    }

    /**
     * Call service to save/update idevice in bbdd
     *
     * @param {String} service
     * @param {Array} params
     * @param {Boolean} params
     * @returns {Object}
     */
    async apiSendDataService(service, params, propagation) {
        let data = this.generateDataObject(params);
        let response = await eXeLearning.app.api[service].call(
            eXeLearning.app.api,
            data
        );
        if (response && response.responseMessage == 'OK') {
            // New idevice
            if (response.newOdeComponentsSync) {
                this.updateParam('id', response.odeComponentsSync.id);
                this.updateParam(
                    'odeNavStructureSyncId',
                    response.odePagStructureSync.odeNavStructureSyncId
                );
                this.updateParam('pageId', response.odeComponentsSync.pageId);
            }
            // New block
            if (response.newOdePagStructureSync) {
                this.block.updateParam('id', response.odePagStructureSyncId);
                this.block.updateParam(
                    'odeNavStructureSyncId',
                    response.odePagStructureSync.odeNavStructureSyncId
                );
                this.block.updateParam(
                    'pageId',
                    response.odePagStructureSync.pageId
                );
            }
            // Add idevice to block idevices
            if (!this.block.idevices.includes(this)) {
                this.block.idevices.push(this);
            }
            // All Idevices that have been modified
            if (propagation && response.odeComponentsSyncs) {
                // update the order of other idevices
                this.engine.updateComponentsIdevices(
                    response.odeComponentsSyncs,
                    ['order']
                );
            }
            // All Blocks that have been modified
            if (propagation && response.odePagStructureSyncs) {
                // update the order of other idevices
                this.engine.updateComponentsBlocks(
                    response.odeComponentsSyncs,
                    ['order']
                );
            }
            return response;
        } else {
            return false;
        }
    }

    /**
     * Generate array data to send to api
     *
     * @param {*} params
     */
    generateDataObject(params) {
        let baseDataDict = this.getDictBaseValuesData();
        let data = {};
        params.forEach((param) => {
            data[param] = baseDataDict[param];
        });

        return data;
    }

    /**
     * Generate array base api values
     *
     */
    getDictBaseValuesData() {
        let defaultVersion = eXeLearning.app.project.odeVersion;
        let defaultSession = eXeLearning.app.project.odeSession;
        let defaultOdeNavStructureSyncId =
            eXeLearning.app.project.structure.getSelectNodeNavId();
        let defaultOdePageId =
            eXeLearning.app.project.structure.getSelectNodePageId();
        return {
            odeComponentsSyncId: this.id,
            odeVersionId: defaultVersion,
            odeSessionId: defaultSession,
            odeNavStructureSyncId: this.odeNavStructureSyncId
                ? this.odeNavStructureSyncId
                : defaultOdeNavStructureSyncId,
            odePageId: this.pageId ? this.pageId : defaultOdePageId,
            odePagStructureSyncId: this.block ? this.block.id : null,
            odePagStructureSyncOrder:
                this.block && this.block.getCurrentOrder
                    ? this.block.getCurrentOrder()
                    : null,
            odeBlockId: this.block ? this.block.blockId : null,
            blockName: this.block ? this.block.blockName : null,
            iconName: this.block ? this.block.iconName : null,
            odeIdeviceId: this.odeIdeviceId,
            odeIdeviceTypeName: this.idevice.name,
            jsonProperties: this.getJsonProperties(true),
            htmlView: this.getViewHTML(),
            order: this.order,
        };
    }

    /**
     * Show modal with response error
     *
     */
    showModalMessageErrorDatabase(response, defaultMessage) {
        let titleText, bodyText;
        titleText = _('iDevice error');
        if (response & response.message) {
            bodyText = response.message;
        } else {
            bodyText = defaultMessage;
        }
        setTimeout(() => {
            eXeLearning.app.modals.alert.show({
                title: titleText,
                body: bodyText,
                contentId: 'error',
            });
        }, 300);
    }

    /*******************************************************************************
     * GET
     *******************************************************************************/

    /**
     * Get the value of order based on the top and bottom idevices
     *
     * @returns {Number}
     */
    getCurrentOrder() {
        let previousIdevice, nextIdevice;
        if ((previousIdevice = this.getContentPrevIdevice())) {
            this.order = parseInt(previousIdevice.getAttribute('order')) + 1;
            return this.order;
        } else if ((nextIdevice = this.getContentNextIdevice())) {
            this.order = parseInt(nextIdevice.getAttribute('order')) - 1;
            return this.order;
        }
        return -1;
    }

    /**
     *
     * @returns
     */
    getBodyHTML() {
        if (this.ideviceBody) {
            return this.ideviceBody.getInnerHTML();
        } else {
            return '';
        }
    }

    /**
     *
     * @returns
     */
    getSavedData() {
        let data = null;
        let componentType =
            this.idevice && this.idevice.componentType
                ? this.idevice.componentType
                : null;
        switch (componentType) {
            case 'json':
                data = this.getJsonProperties();
                break;
            case 'html':
            default:
                data = this.getViewHTML();
                break;
        }

        return data;
    }

    /**
     *
     * @returns {String}
     */
    getViewHTML() {
        if (
            this.htmlView &&
            !['undefined', 'null', 'false'].includes(this.htmlView)
        ) {
            return this.htmlView;
        } else {
            return '';
        }
    }

    /**
     *
     * @returns {Array}
     */
    getJsonProperties(json) {
        let data = {};
        if (this.jsonProperties) {
            data = this.jsonProperties;
        }
        if (json) {
            return JSON.stringify(this.jsonProperties);
        } else {
            return this.jsonProperties;
        }
    }

    /**
     *
     * @returns {String}
     */
    getPathEdition() {
        return this.idevice.pathEdition;
    }

    /**
     *
     * @returns {String}
     */
    getPathExport() {
        return this.idevice.pathExport;
    }

    /**
     *
     * @returns {Node}
     */
    getContentPrevIdevice() {
        let previousElement = this.ideviceContent.previousSibling;
        if (
            previousElement &&
            previousElement.classList &&
            previousElement.classList.contains('idevice_node')
        ) {
            return previousElement;
        }
        return false;
    }

    /**
     *
     * @returns {Node}
     */
    getContentNextIdevice() {
        let nextElement = this.ideviceContent.nextSibling;
        if (
            nextElement &&
            nextElement.classList &&
            nextElement.classList.contains('idevice_node')
        ) {
            return nextElement;
        }
        return false;
    }

    /**
     * Get block that contains the idevice
     *
     */
    getBlock() {
        return this.engine.getBlockById(this.blockId);
    }

    /*******************************************************************************
     * ACTIONS
     *******************************************************************************/

    /**
     * Edition -> Export
     */
    async save(loadPage) {
        clearInterval(this.checkDeviceLoadInterval);
        // Save data of idevice in database
        let saveOk = await this.saveIdeviceProcess();
        // Desactivate user flags
        await eXeLearning.app.project.changeUserFlagOnEdit(
            false,
            this.odeNavStructureSyncId,
            this.blockId,
            this.odeIdeviceId
        );
        if (saveOk) {
            // this.sendPublishedNotification();

            this.resetWindowHash();
            this.goWindowToIdevice(100);
            if (loadPage) {
                // Reload all components in page
                this.engine.resetCurrentIdevicesExportView([this.id]);
                await this.loadInitScriptIdevice('export');
            } else {
                // Only load current idevice
                await this.loadInitScriptIdevice('export');
                // Load plugins
                setTimeout(
                    () => this.loadLegacyExeFunctionalitiesExport(),
                    100
                );
            }
            this.engine.unsetIdeviceActive();
        } else {
            this.toogleIdeviceButtonsState(false);
            setTimeout(() => {
                if (
                    !eXeLearning.app.modals.alert.modal._isShown &&
                    !eXeLearning.app.modals.confirm.modal._isShown
                ) {
                    eXeLearning.app.modals.alert.show({
                        title: _('Error saving the iDevice'),
                        body: _('Failed to save the iDevice to database'),
                        contentId: 'error',
                    });
                }
            }, 500);
        }

        return saveOk;
    }

    /**
     * Export -> Edition
     */
    edition() {
        clearInterval(this.checkDeviceLoadInterval);
        if (this.engine.mode == 'view') {
            this.goWindowToIdevice(100);
            this.loadInitScriptIdevice('edition');
            this.engine.updateMode();
        } else {
            eXeLearning.app.modals.alert.show({
                title: _('Not allowed'),
                body: _(
                    'You cannot edit another idevice until you save the current one'
                ),
            });
        }
    }

    /**
     * Remove idevice
     *
     * @param {Boolean} bbdd Indicates if it is deleted in the database
     */
    remove(bbdd) {
        clearInterval(this.checkDeviceLoadInterval);
        if (this.mode == 'edition') {
            if (typeof $exeDevice !== 'undefined') {
                $exeDevice = undefined;
            }
        }
        // Remove content element
        this.ideviceContent.remove();
        // Remove head scripts/styles elements
        this.clearFilesElements();
        // Remove idevice in engine components
        this.engine.removeIdeviceOfComponentList(this.id);
        // Remove idevice in block
        this.block.removeIdeviceOfListById(this.id);
        // Update engine mode
        this.engine.updateMode();
        // Delete idevice in database
        if (bbdd) {
            this.apiDeleteIdevice();
        }
        // Delete the parent block if there are no children left
        if (bbdd) this.removeBlockParentProcess(true);
    }

    /**
     * Manage removal of parent block when deleting idevice
     *
     * @returns
     */
    removeBlockParentProcess(bbdd) {
        // Check if the block has more idevices
        if (this.block.idevices.length == 0) {
            // Delete or ask if they want to delete the block
            if (this.block.removeIfEmpty) {
                this.block.remove(bbdd);
            } else if (this.block.askForRemoveIfEmpty) {
                setTimeout(() => {
                    eXeLearning.app.modals.confirm.show({
                        title: _('Remove Block'),
                        body: _(
                            'iDevice deleted. Now the box is empty. Delete the box too?'
                        ),
                        confirmButtonText: _('Yes'),
                        confirmExec: () => {
                            this.block.remove(true);
                        },
                    });
                }, 300);
            }
        }
    }

    /*******************************************************************************
     * IDEVICE LOAD FILES
     *******************************************************************************/

    /**
     * Load idevice edition js scripts
     *
     */
    loadScriptsEdition() {
        let newScriptsElements = this.idevice
            ? this.idevice.loadScriptsEdition()
            : [];
        this.scriptsElements = this.stylesElements.concat(newScriptsElements);
    }

    /**
     * Load idevice export js scripts
     *
     */
    loadScriptsExport() {
        let newScriptsElements = this.idevice
            ? this.idevice.loadScriptsExport()
            : [];
        this.scriptsElements = this.stylesElements.concat(newScriptsElements);
    }

    /**
     * Load idevice edition styles files
     *
     */
    async loadStylesEdition() {
        let newStylesElements = this.idevice
            ? await this.idevice.loadStylesEdition()
            : [];
        this.stylesElements = this.stylesElements.concat(newStylesElements);
    }

    /**
     * Load idevice export styles files
     *
     */
    async loadStylesExport() {
        let newStylesElements = this.idevice
            ? await this.idevice.loadStylesExport()
            : [];
        this.stylesElements = this.stylesElements.concat(newStylesElements);
    }

    /**
     * Reset tinyMCE editors and init $exeDevice
     *
     */
    initExeDeviceEdition() {
        // Remove tinymce active editors
        tinymce.remove();
        // Init idevice edition script
        $exeDevice.init(
            this.ideviceBody,
            this.getSavedData(),
            this.getPathEdition()
        );
        // Init tinymce editors
        $exeTinyMCE.init('multiple-visible', '.exe-html-editor');
    }

    /**
     * Clear files (scripts & styles) of idevice
     *
     */
    clearFilesElements() {
        this.clearScriptsElements();
        this.clearStylesElements();
    }

    /**
     * Clear idevice's scripts files
     *
     */
    clearScriptsElements() {
        this.scriptsElements.forEach((script) => {
            script.remove();
        });
        if (this.idevice && this.idevice.exportObject) {
            if (window[this.idevice.exportObject]) {
                // TODO: only if there are no more such components left
                //window[this.idevice.exportObject] == "undefined";
            }
        }
    }

    /**
     * Clear idevice's styles files
     *
     */
    clearStylesElements() {
        this.stylesElements.forEach((styles) => {
            styles.remove();
        });
    }

    /**
     * Check if idevice is valid
     *
     * @returns {Boolean}
     */
    checkIsValid() {
        this.valid = true;
        if (!this.odeIdeviceId || !this.odeIdeviceTypeName || !this.idevice) {
            this.valid = false;
        }
        return this.valid;
    }

    /**
     * Idevice edition load error
     *
     * @returns string
     */
    editionLoadedError() {
        this.loading = false;
        this.ideviceContent.setAttribute('loading', false);
        /*this.remove(false);*/
        /*this.engine.unsetIdeviceActive();*/
        /*this.engine.updateMode();*/
        eXeLearning.app.modals.alert.show({
            title: this.idevice.title,
            body: _('Failed to load the iDevice.'),
            contentId: 'error',
        });
    }

    /**
     * Idevice export load error
     *
     * @returns string
     */
    exportLoadedError() {
        this.engine.updateMode();
        eXeLearning.app.modals.alert.show({
            title: this.idevice.title,
            body: _('Failed to load the iDevice view.'),
            contentId: 'error',
        });
    }

    /**
     * Functionalities that are executed after the loading of the idevice export.
     * Necessary for the correct functioning of the idevices
     *
     */
    loadLegacyExeFunctionalitiesExport() {
        // Legacy $exeABCmusic object
        $exeABCmusic.init();
    }

    /**
     * Functionalities that are executed after the loading of the idevice edition.
     * Necessary for the correct functioning of the idevices
     *
     */
    loadLegacyExeFunctionalitiesEdition() {
        // Fieldset action
        this.legacyExeFieldsetAction();
        // Idevices file picker
        this.legacyExeIdevicesFilePicker();
    }

    /**
     * eXe fieldset functionality
     *
     */
    legacyExeFieldsetAction() {
        this.ideviceBody
            .querySelectorAll('fieldset.exe-fieldset')
            .forEach((fieldset) => {
                let legend = fieldset.querySelector('legend a');
                if (legend) {
                    if (!fieldset.classList.contains('exe-fieldset-closed')) {
                        fieldset.classList.add('exe-fieldset-open');
                    }
                    legend.addEventListener('click', (event) => {
                        event.preventDefault();
                        if (
                            fieldset.classList.contains('exe-fieldset-closed')
                        ) {
                            fieldset.classList.remove('exe-fieldset-closed');
                            fieldset.classList.add('exe-fieldset-open');
                        } else {
                            fieldset.classList.remove('exe-fieldset-open');
                            fieldset.classList.add('exe-fieldset-closed');
                        }
                    });
                }
            });
    }

    /**
     * eXe filepicker/imagepicker functionality
     *
     */
    legacyExeIdevicesFilePicker() {
        this.ideviceBody
            .querySelectorAll('.exe-file-picker,.exe-image-picker')
            .forEach((e) => {
                let id = e.id;
                let css = e.classList.contains('exe-image-picker')
                    ? 'exe-pick-image'
                    : 'exe-pick-any-file';
                let type = css == 'exe-pick-image' ? 'image' : 'media';
                // Input file element
                let inputElement = document.createElement('input');
                inputElement.id = '_browseFor' + id;
                inputElement.setAttribute('type', 'file');
                if (type == 'image')
                    inputElement.setAttribute('accept', 'image/*');
                inputElement.addEventListener('change', (field) => {
                    this.processFile(field.target.files[0], id, type);
                });
                // Input button element
                let buttontElement = document.createElement('input');
                buttontElement.classList.add(css);
                buttontElement.setAttribute('type', 'button');
                buttontElement.setAttribute('value', _('Select a file'));
                buttontElement.addEventListener('click', (event) => {
                    inputElement.click();
                });
                // Append inputs
                e.parentNode.insertBefore(buttontElement, e.nextSibling);
            });
    }

    /**
     * Process the selected file in the input
     *
     * @param {*} file
     * @param {*} id
     * @param {*} type
     */
    async processFile(file, id, type) {
        try {
            // let buffer = await this.readFile(file);
            // await this.addUploadImage(buffer, file.name, id, type);
            await this.addUploadImage(file, file.name, id, type);
        } catch (err) {}
    }

    /**
     * Read file
     *
     * @param {*} file
     * @returns
     */
    async readFile(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (field) => {
                resolve(field.target.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Upload image and add value to input
     *
     * @param {*} imageData
     * @param {*} imageName
     * @param {*} id
     * @param {*} type
     */
    async addUploadImage(imageData, imageName, id, type) {
        var fd = new FormData();
        fd.append('file', imageData);
        fd.append('filename', [imageName]);
        fd.append('odeSessionId', [eXeLearning.app.project.odeSession]);
        this.lockScreen();
        let lockStartTime = new Date();

        let response = await eXe.app.uploadLargeFile(fd);
        let loadTime = new Date().getTime() - lockStartTime;

        if (response && response.savedPath && response.savedFilename) {
            let fileUrl = `${response.savedPath}/${response.savedFilename}`;
            let fileContainerField = this.ideviceBody.querySelector(`#${id}`);
            if (fileContainerField) {
                fileContainerField.value = fileUrl;
                fileContainerField.dispatchEvent(new Event('change'));
            }
        } else {
            eXe.app.alert(_(response.code));
        }
        this.unlockScreen(loadTime);
    }

    lockScreen() {
        const loadScreen = document.getElementById('load-screen-node-content');
        loadScreen.style.zIndex = '9999';
        loadScreen.style.position = 'fixed';
        loadScreen.style.top = '0';
        loadScreen.style.left = '0';
        loadScreen.classList.remove('hide', 'hidden');
        loadScreen.classList.add('loading');
    }

    unlockScreen(delay = 1000) {
        delay = delay > 1000 ? 400 : 0;
        const loadScreen = document.getElementById('load-screen-node-content');
        loadScreen.classList.remove('loading');
        loadScreen.classList.add('hidding');
        setTimeout(() => {
            loadScreen.classList.add('hide', 'hidden');
            loadScreen.classList.remove('hidding');
            loadScreen.style.zIndex = '990';
            loadScreen.style.position = 'absolute';
            delete loadScreen.style.top;
            delete loadScreen.style.left;
        }, delay);
    }

    /*******************************************************************************
     * UPDATE
     *******************************************************************************/

    /**
     * Change value of idevice param
     *
     * @param {*} param
     * @param {*} newValue
     */
    updateParam(param, newValue) {
        this[param] = newValue;
        // Modifying some parameters have certain implications
        switch (param) {
            case 'order':
                this.ideviceContent.setAttribute('order', this.order);
                break;
        }
    }

    /**
     * Change idevice mode
     *
     * @param {String} mode
     */
    updateMode(mode) {
        if (mode) this.mode = mode;
        this.updateModeParentBlock();
        switch (this.mode) {
            case 'edition':
                this.ideviceContent.classList.remove('eXeLearning-content');
                this.ideviceContent.classList.remove('draggable');
                this.ideviceContent.removeAttribute('draggable');
                break;
            case 'export':
                this.ideviceContent.classList.add('eXeLearning-content');
                this.ideviceContent.classList.add('draggable');
                this.ideviceBody.classList.remove('save-error');
                break;
        }
        this.ideviceContent.setAttribute('mode', this.mode);
    }

    /**
     * Update mode of block that contains the idevice
     *
     */
    updateModeParentBlock() {
        this.block = this.getBlock();
        if (this.block) {
            this.block.updateMode(this.mode);
        }
    }

    /*******************************************************************************
     * WINDOW
     *******************************************************************************/

    /**
     * Reset window hash
     *
     */
    resetWindowHash() {
        window.location.hash = 'node-content';
    }

    /**
     * Move window to idevice node
     *
     * @param {Number} time
     */
    goWindowToIdevice(time) {
        let hashId;
        if (
            this.block &&
            this.block.idevices.length > 0 &&
            this.block.idevices[0].odeIdeviceId == this.odeIdeviceId
        ) {
            hashId = this.block.blockId;
        } else {
            hashId = this.odeIdeviceId;
        }
        setTimeout(() => {
            window.location.hash = hashId;
        }, time);
    }

    /**
     * Clear text selection
     *
     */
    clearSelection() {
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        } else if (document.selection) {
            document.selection.empty();
        }
    }

    /*******************************************************************************
     * SYNC
     *******************************************************************************/

    activateUpdateFlag() {
        let params2 = {
            odeSessionId: eXeLearning.app.project.odeSession,
            odeIdeviceId: this.odeIdeviceId,
        };

        eXeLearning.app.api.postActivateCurrentOdeUsersUpdateFlag(params2);
    }

    activateComponentFlag() {}

    sendPublishedNotification() {
        if (!this.offlineInstallation) {
            this.realTimeEventNotifier.notify(
                eXeLearning.app.project.odeSession,
                {
                    name: 'new-content-published',
                }
            );
        }
    }
}

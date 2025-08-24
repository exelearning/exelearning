import RealTimeEventNotifier from '../../../../RealTimeEventNotifier/RealTimeEventNotifier.js';
/**
 * eXeLearning
 *
 * content Idevices Block
 */

export default class IdeviceBlockNode {
    constructor(parent, data) {
        this.engine = parent;
        this.id = data.id
            ? data.id
            : eXeLearning.app.api.parameters.generateNewItemKey;
        this.blockId = data.blockId ? data.blockId : this.engine.generateId();
        // Set api params
        this.setParams(data);
        // Idevices
        this.idevices = [];
        // Control parameters
        this.removeIfEmpty = false;
        this.askForRemoveIfEmpty = true;
        this.canHaveHeirs = true;
        // Content parameters
        this.blockContent = null;
        this.headElement = null;
        this.idevicesContainerElement = null;
        this.iconElement = null;
        this.blockNameElementText = null;
        this.toggleElement = null;
        this.blockButtons = null;
        this.offlineInstallation = eXeLearning.config.isOfflineInstallation;

        if (!this.offlineInstallation) {
            this.realTimeEventNotifier = new RealTimeEventNotifier(
                eXeLearning.mercure.url,
                eXeLearning.mercure.jwtSecretKey
            );
        }
    }

    /**
     * Empty icon
     */
    emptyIcon = 'block';

    /**
     * Idevice properties
     */
    properties = JSON.parse(
        JSON.stringify(
            eXeLearning.app.api.parameters.odePagStructureSyncPropertiesConfig
        )
    );

    /**
     * Api params
     */
    params = [
        'odeNavStructureSyncId',
        'odeSessionId',
        'odeVersionId',
        'pageId',
        'mode',
        'blockName',
        'iconName',
        'order',
    ];

    /**
     * Default values of params
     */
    default = {
        mode: 'export',
        blockName: '',
        iconName: '',
        order: 0,
    };

    /**
     * Set values of api object
     *
     * @param {Array} data
     */
    setParams(data) {
        for (let [i, param] of Object.entries(this.params)) {
            let defaultValue = this.default[param] ? this.default[param] : null;
            this[param] = data[param] ? data[param] : defaultValue;
        }
        if (data.odePagStructureSyncProperties) {
            this.setProperties(data.odePagStructureSyncProperties);
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
        if (this.blockContent) this.setPropertiesClassesToElement();
    }

    /*******************************************************************************
     * BLOCK CONTENT
     *******************************************************************************/

    /**
     *
     * @param {Boolean} newNode
     * @returns {Node}
     */
    generateBlockContentNode(newNode) {
        // Generate Block div
        if (newNode) {
            this.blockContent = document.createElement('article');
        } else {
            // Remove classes
            this.blockContent.classList.remove(...this.blockContent.classList);
            // Remove attributes
            while (this.blockContent.attributes.length > 0) {
                this.blockContent.removeAttribute(
                    this.blockContent.attributes[0].name
                );
            }
            this.toggleElement.removeAttribute('disabled');
        }
        this.blockContent.id = this.blockId;
        // Block classes
        this.blockContent.classList.add('box');
        this.blockContent.classList.add('idevice-element-in-content');
        this.blockContent.classList.add('draggable');
        // Block attributes
        if (this.id) this.blockContent.setAttribute('sym-id', this.id);
        this.blockContent.setAttribute('order', this.order);
        this.blockContent.setAttribute('drag', 'box');
        this.blockContent.setAttribute('drop', '["idevice"]');
        // Head
        if (newNode) {
            this.blockContent.appendChild(this.makeBlockHeadElement());
            this.addBehaviourChangeIcon();
            this.addBehaviourChangeTitle();
        }
        // Properties attributes/classes
        this.setPropertiesClassesToElement();
        // Attribute mode
        this.updateMode();

        return this.blockContent;
    }

    /**
     * Add atributes and classes to block content element based in properties
     *
     */
    setPropertiesClassesToElement() {
        // identifier
        if (this.properties.identifier.value != '') {
            this.blockContent.setAttribute(
                'identifier',
                this.properties.identifier.value
            );
        }
        // visibility
        if (this.properties.visibility.value == 'true') {
            this.blockContent.setAttribute(
                'export-view',
                this.properties.visibility.value
            );
        }
        // css classes
        if (this.properties.cssClass.value != '') {
            let cssClasses = this.properties.cssClass.value
                ? this.properties.cssClass.value.split(' ')
                : [];
            cssClasses.forEach((cls) => {
                this.blockContent.classList.add(cls);
            });
        }
        // allow toggle
        if (this.properties.allowToggle.value != 'true') {
            // This should always be available while editing:
            // this.toggleElement.setAttribute('disabled', true);
        }
        // minimized
        if (this.properties.minimized.value == 'true') {
            this.toggleOff();
        }
    }

    /**
     * Generate HTML of block head
     *
     * @returns
     */
    makeBlockHeadElement() {
        this.headElement = document.createElement('header');
        this.headElement.classList.add('box-head');
        this.headElement.classList.add('draggable');
        this.headElement.classList.add('idevice-element-in-content');
        this.headElement.setAttribute('draggable', true);
        this.headElement.setAttribute('drag', 'box');
        this.headElement.setAttribute('block-id', this.blockId);
        this.headElement.appendChild(this.makeIconNameElement());
        this.headElement.appendChild(this.makeBlockTitleElementText());
        this.headElement.appendChild(this.makeBlockButtonsElement());
        // Drag event
        this.engine.addEventDragStartToContentBlock(this.headElement);
        this.engine.addEventDragEndToContentBlock(this.headElement);

        return this.headElement;
    }

    /**
     * Generate HTML of block icon
     *
     * @returns
     */
    makeIconNameElement() {
        this.iconElement = this.iconElement
            ? this.iconElement
            : document.createElement('button');
        this.iconElement.classList.add('exe-icon');
        this.iconElement.classList.add('box-icon');
        // Get actual theme icon based in icon-id
        let iconData = false;
        // Get icon id
        if (this.iconName) {
            // Get theme icon
            iconData = eXeLearning.app.themes.getThemeIcons()[this.iconName];
            if (iconData) {
                // Icon exists in actual theme
                let newIconValue = this.makeIconValueElement(iconData);
                this.iconElement.innerHTML = newIconValue.outerHTML;
                this.iconElement.classList.remove('exe-no-icon');
                this.iconElement.setAttribute('title', _('Select an icon'));
            }
        }
        // Check if icon is valid
        if (!iconData) {
            this.iconElement.innerHTML = this.emptyIcon;
            this.iconElement.classList.add('exe-no-icon');
            this.iconElement.setAttribute('title', _('No icon'));
        }

        return this.iconElement;
    }

    /**
     * Box icon (image)
     *
     * @param {*} icon
     */
    makeIconValueElement(icon) {
        let iconValue = document.createElement('img');
        iconValue.setAttribute('src', icon.value);
        iconValue.setAttribute('alt', icon.title);
        /* To review (icon.type?)
        switch (icon.type) {
            case 'exe':
                iconValue.innerHTML = icon.value;
                break;
            case 'img':
                iconValue.style.backgroundImage = `url("${icon.value}")`;
                break;
        }
        */
        return iconValue;
    }

    /**
     * Generate HTML of block title (text)
     *
     * @returns
     */
    makeBlockTitleElementText() {
        this.blockNameElementText = document.createElement('h1');
        this.blockNameElementText.classList.add('box-title');
        this.blockNameElementText.classList.add('idevice-element-in-content');
        this.blockNameElementText.innerHTML = this.blockName;
        // Add event
        this.addBehaviourChangeIcon();

        return this.blockNameElementText;
    }

    /**
     * TEST
     *
     */
    test() {
        console.log('click');
    }

    /**
     * Generate HTML of block buttons
     *
     * @returns {Node}
     */

    makeBlockButtonsElement() {
        let id = this.blockId;
        let blockButtonsHTML = `
        <div class="dropdown exe-actions-menu">
            <button class="btn-action-menu btn btn-light btn-move-up" type="button" id=moveUp${id} title="${_('Move up')}"><span class="auto-icon" aria-hidden="true">keyboard_arrow_up</span><span class="visually-hidden">${_('Move up')}</span></button>
            <button class="btn-action-menu btn btn-light btn-move-down" type="button" id=moveDown${id} title="${_('Move down')}"><span class="auto-icon" aria-hidden="true">keyboard_arrow_down</span><span class="visually-hidden">${_('Move down')}</span></button>
            <button class="btn-action-menu btn btn-light btn-delete" type="button" id=deleteBlock${id} title="${_('Delete')}"><span class="auto-icon" aria-hidden="true">delete_forever</span><span class="visually-hidden">${_('Delete')}</span></button>
            <button class="btn-action-menu btn btn-light exe-advanced" type="button" id="dropdownMenuButton${id}" data-bs-toggle="dropdown" aria-expanded="false" title="${_('Actions')}"><span class="auto-icon" aria-hidden="true">more_horiz</span><span class="visually-hidden">${_('Actions')}</span></button>
            <ul class="dropdown-menu button-action-block exe-advanced" aria-labelledby="dropdownMenuButton${id}">
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-properties${id}"><span class="auto-icon" aria-hidden="true">settings</span>${_('Properties')}</button></li>
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-clone${id}"><span class="auto-icon" aria-hidden="true">content_copy</span>${_('Clone')}</button></li>
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-move${id}"><span class="auto-icon" aria-hidden="true">flip_to_back</span>${_('Move to')}</button></li>
                <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-export${id}"><span class="auto-icon" aria-hidden="true">file_download</span>${_('Export')}</button></li>
             </ul>
            <button class="btn-action-menu btn btn-light btn-toggle box-toggler box-toggle-on" type="button" id=toggleBox${id} title="${_('Hide')}"><span class="auto-icon" aria-hidden="true">compress</span><span class="visually-hidden">${_('Hide')}</span></button>
        </div>`;
        // Check links (disabled) <li><button class="dropdown-item button-action-block" id="dropdownBlockMore-button-checkLinks${id}"><span class="auto-icon" aria-hidden="true">links</span>${_('Check links')}</button></li>

        this.blockButtons = document.createElement('div');
        this.blockButtons.classList.add('box_actions');
        this.blockButtons.classList.add('idevice-element-in-content');
        this.blockButtons.insertAdjacentHTML('beforeend', blockButtonsHTML);

        /*********************** */
        /* Event listeners */
        /*******************/
        this.addBehaviourButtonDropDown();
        this.addBehaviourButtonMoveUpBlock();
        this.addBehaviourButtonMoveDownBlock();
        this.addBehaviourButtonDeleteBlock();
        this.addBehaviourButtonPropertiesBlock();
        this.addBehaviourButtonCloneBlock();
        this.addBehaviourMoveToPageBlockButton();
        this.addBehaviourExportBlockButton();
        this.addBehaviourToggleBlockButton();
        this.addTooltips();
        this.addNoTranslateForGoogle();
        // Check links (disabled) this.addBehaviourCheckBlockLinksButton();

        return this.blockButtons;
    }

    /**
     * Event to show modal to change icon
     *
     */
    addBehaviourChangeIcon() {
        this.iconElement.addEventListener('click', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            // Check odeComponent flag
            eXeLearning.app.project
                .isAvalaibleOdeComponent(this.blockId, null)
                .then((response) => {
                    if (response.responseMessage !== 'OK') {
                        eXeLearning.app.modals.alert.show({
                            title: _('iDevice error'),
                            body: _(response.responseMessage),
                            contentId: 'error',
                        });
                    } else {
                        this.showModalChangeIcon();
                    }
                });
        });
    }

    /**
     * Event to show modal to change title
     *
     */
    addBehaviourChangeTitle() {
        this.blockNameElementText.addEventListener('click', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) return;
            // Check odeComponent flag
            eXeLearning.app.project
                .isAvalaibleOdeComponent(this.blockId, null)
                .then((response) => {
                    if (response.responseMessage !== 'OK') {
                        eXeLearning.app.modals.alert.show({
                            title: _('iDevice error'),
                            body: _(response.responseMessage),
                            contentId: 'error',
                        });
                    } else {
                        this.showModalChangeTitle();
                    }
                });
        });
    }

    /**
     * Event check broken links
     *
     */
    addBehaviourButtonCheckBrokenLinksBlock() {
        this.blockButtonCheckBrokenLinks.addEventListener(
            'click',
            (element) => {
                let blockId = this.blockId;
                this.getOdeBlockBrokenLinksEvent(blockId).then((response) => {
                    if (!response.responseMessage) {
                        // Show eXe OdeBrokenList modal
                        eXeLearning.app.modals.odebrokenlinks.show(response);
                    } else {
                        // Open eXe alert modal
                        eXeLearning.app.modals.alert.show({
                            title: _('Broken Links'),
                            body: "There aren't broken links",
                        });
                    }
                });
            }
        );
    }

    /**
     * Event toggle block
     *
     */
    addBehaviourButtonDropDown() {
        this.blockButtons
            .querySelector('#dropdownMenuButton' + this.blockId)
            .addEventListener('click', (element) => {
                var btn = document.getElementById(
                    'dropdownMenuButton' + this.blockId
                );
                var e = document.getElementById(this.blockId);
                if (btn && e) {
                    var list = btn.classList;
                    if (btn.classList.contains('show')) {
                        if (e.classList.contains('hidden-idevices')) {
                            this.toggleOn();
                        }
                    }
                }
            });
    }

    /**
     * Event move up
     *
     */
    addBehaviourButtonMoveUpBlock() {
        this.blockButtons
            .querySelector('#moveUp' + this.blockId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Not move the box if it is already moving
                            if (
                                !this.blockContent.classList.contains('moving')
                            ) {
                                // Check if there is a block in the previous position
                                let previousBlock = this.getContentPrevBlock();
                                let previousOrder = this.order;
                                if (previousBlock) {
                                    // Add a temporary class to handle display effects
                                    this.blockContent.classList.add('moving');
                                    // Change order
                                    this.order--;
                                    // Update in database
                                    this.apiUpdateOrder().then((response) => {
                                        if (response.responseMessage == 'OK') {
                                            // Move element
                                            this.engine.nodeContentElement.insertBefore(
                                                this.blockContent,
                                                previousBlock
                                            );
                                            // Send operation log action to bbdd
                                            let additionalData = {
                                                blockId: this.blockId,
                                                previousOrder: previousOrder,
                                            };
                                            eXeLearning.app.project.sendOdeOperationLog(
                                                this.pageId,
                                                this.pageId,
                                                'MOVE_BLOCK_ON',
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
     * Event move down
     *
     */
    addBehaviourButtonMoveDownBlock() {
        this.blockButtons
            .querySelector('#moveDown' + this.blockId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            // Not move the box if it is already moving
                            if (
                                !this.blockContent.classList.contains('moving')
                            ) {
                                // Check if there is a block in the previous position
                                let nextBlock = this.getContentNextBlock();
                                let previousOrder = this.order;
                                if (nextBlock) {
                                    // Add a temporary class to handle display effects
                                    this.blockContent.classList.add('moving');
                                    // Change order
                                    this.order++;
                                    // Update in database
                                    this.apiUpdateOrder().then((response) => {
                                        if (response.responseMessage == 'OK') {
                                            // Move element
                                            this.engine.nodeContentElement.insertBefore(
                                                this.blockContent,
                                                nextBlock.nextSibling
                                            );
                                            // Send operation log action to bbdd
                                            let additionalData = {
                                                blockId: this.blockId,
                                                previousOrder: previousOrder,
                                            };
                                            eXeLearning.app.project.sendOdeOperationLog(
                                                this.pageId,
                                                this.pageId,
                                                'MOVE_BLOCK_ON',
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
     * Event delete
     *
     */
    addBehaviourButtonDeleteBlock() {
        this.blockButtons
            .querySelector('#deleteBlock' + this.blockId)
            .addEventListener('click', (element) => {
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            eXeLearning.app.modals.confirm.show({
                                title: _('Delete box'),
                                body: _(
                                    'Delete the box and all its iDevices? This cannot be undone.'
                                ),
                                confirmButtonText: _('Yes'),
                                confirmExec: () => {
                                    this.remove(true);
                                },
                            });
                        }
                    });
            });
    }

    /**
     * Event properties
     *
     */
    addBehaviourButtonPropertiesBlock() {
        this.blockButtons
            .querySelector(
                '#dropdownBlockMore-button-properties' + this.blockId
            )
            .addEventListener('click', (element) => {
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            eXeLearning.app.modals.properties.show({
                                node: this,
                                title: _('Box properties'),
                                contentId: 'block-properties',
                                properties: this.properties,
                            });
                        }
                    });
            });
    }

    /**
     * Event clone
     *
     */
    addBehaviourButtonCloneBlock() {
        this.blockButtons
            .querySelector('#dropdownBlockMore-button-clone' + this.blockId)
            .addEventListener('click', (element) => {
                this.apiCloneBlock();
            });
    }

    /**
     * Event move to
     *
     */
    addBehaviourMoveToPageBlockButton() {
        this.blockButtons
            .querySelector('#dropdownBlockMore-button-move' + this.blockId)
            .addEventListener('click', (element) => {
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
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
                                title: _('Move Block to page'),
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
                                    this.apiUpdatePage(newPageId);
                                    if (
                                        parseInt(newPageId) !==
                                        this.odeNavStructureSyncId
                                    ) {
                                        eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                                            false,
                                            null,
                                            this.blockId,
                                            null,
                                            'MOVE_TO_PAGE',
                                            odePageId
                                        );
                                        // Send operation log action to bbdd
                                        let additionalData = {
                                            previousPageId: previousPageId,
                                            newPageId: newPageId,
                                            blockId: this.blockId,
                                            previousOrder: this.order,
                                        };
                                        eXeLearning.app.project.sendOdeOperationLog(
                                            previousOdePageId,
                                            odePageId,
                                            'MOVE_BLOCK_TO',
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
     * Event export
     *
     */
    addBehaviourExportBlockButton() {
        this.blockButtons
            .querySelector('#dropdownBlockMore-button-export' + this.blockId)
            .addEventListener('click', (element) => {
                // Check odeComponent flag
                eXeLearning.app.project
                    .isAvalaibleOdeComponent(this.blockId, null)
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            this.downloadBlockSelected(this.blockId);
                        }
                    });
            });
    }

    /**
     * Toggle block
     *
     */
    addBehaviourToggleBlockButton() {
        this.toggleElement = this.blockButtons.querySelector(
            '#toggleBox' + this.blockId
        );

        // Add event
        this.toggleElement.addEventListener('click', (element) => {
            if (this.toggleElement.classList.contains('box-toggle-on')) {
                // Hide the actions menu if needed
                var elm = $('#dropdownMenuButton' + this.blockId);
                if (elm.attr('aria-expanded') == 'true') elm.trigger('click');
                this.toggleOff();
            } else {
                this.toggleOn();
            }
        });
    }

    /**
     * Add tooltips
     *
     */
    addTooltips() {
        $('button.btn-action-menu', this.blockButtons).addClass(
            'exe-app-tooltip'
        );
        eXeLearning.app.common.initTooltips(this.blockButtons);
    }

    /**
     * Icons should not be translated
     *
     */
    addNoTranslateForGoogle() {
        $('.auto-icon', this.ideviceButtons).addClass('notranslate');
    }

    /**
     * Event check links
     *
     */
    /* To review (disabled)
    addBehaviourCheckBlockLinksButton() {
        this.blockButtons
            .querySelector("#dropdownBlockMore-button-checkLinks"+this.blockId)
            .addEventListener("click", element => {
                let blockId = this.blockId;
                console.log("check links");
                this.getOdeBlockBrokenLinksEvent(blockId).then(response => {
                    if (!response.responseMessage) {
                        // Show eXe OdeBrokenList modal
                        eXeLearning.app.modals.odebrokenlinks.show(response);
                    } else {
                        // Open eXe alert modal
                        eXeLearning.app.modals.alert.show({
                            title: _("Broken Links"),
                            body: "There aren't broken links",
                        })
                    }
                })
            });
    }
    */

    /**
     *
     * @param {*} odeBlockId
     */
    async downloadBlockSelected(odeBlockId) {
        let odeSessionId = eXeLearning.app.project.odeSession;

        let response = await eXeLearning.app.api.getOdeIdevicesDownload(
            odeSessionId,
            odeBlockId,
            null
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
     * TOGGLE EVENTS*/

    /**
     * Hide block idevices
     *
     */
    toggleOff() {
        this.blockContent.classList.add('hidden-idevices');
        this.blockContent.classList.remove('dropdown-menu-on');
        this.toggleElement.classList.add('box-toggle-off');
        this.toggleElement.classList.remove('box-toggle-on');
        this.toggleElement.setAttribute('title', _('Show'));
        this.toggleElement.querySelector('span').innerHTML = 'expand';
    }

    /**
     * Show block idevices
     *
     */
    toggleOn() {
        this.blockContent.classList.remove('hidden-idevices');
        this.toggleElement.classList.remove('box-toggle-off');
        this.toggleElement.classList.add('box-toggle-on');
        this.toggleElement.setAttribute('title', _('Hide'));
        this.toggleElement.querySelector('span').innerHTML = 'compress';
    }

    /*********************************
     * MODALS BODY */

    /**
     * Make body of "move to page" modal element
     *
     * @returns {Node}
     */
    generateModalMoveToPageBody() {
        let bodyElement = document.createElement('div');
        let textElement = document.createElement('p');
        let selectElement = document.createElement('select');
        textElement.innerHTML = _(
            'Select the page you want to move the block to. This will be at the end of it.'
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
            if (page.id == this.odeNavStructureSyncId)
                option.setAttribute('selected', 'selected');
            selectElement.append(option);
        });
        return bodyElement;
    }

    /*********************************
     * MODAL CHANGE ICON */

    /**
     * Modal change icon (show)
     *
     */
    showModalChangeIcon() {
        eXeLearning.app.modals.confirm.show({
            title: _('Select icon'),
            body: this.makeModalChangeIconBody().outerHTML,
            confirmButtonText: _('Save'),
            cancelButtonText: _('Cancel'),
            confirmExec: () => {
                this.saveIconAction();
            },
            behaviour: () => {
                this.addBehaviourToModalChangeIconBody();
            },
        });
    }

    /**
     * Modal change icon (confirmExec)
     *
     */
    saveIconAction() {
        let modalBody = eXeLearning.app.modals.confirm.modalElementBody;
        let iconElement = modalBody.querySelector(
            '.option-block-icon[selected="true"]'
        );
        // Get icon value
        let iconValue = '';
        if (iconElement) {
            let iconId = iconElement.getAttribute('icon-id');
            iconValue = iconId ? iconId : iconElement.innerHTML;
        }
        // No icon
        if (iconValue == '0' || iconValue == this.emptyIcon) {
            iconValue = '';
        }
        this.apiUpdateIcon(iconValue);
    }

    /**
     * Modal change icon (body)
     *
     */
    makeModalChangeIconBody() {
        let modalBody = document.createElement('div');
        modalBody.id = 'change-block-icon-modal-content';
        // Add empty block icon element to content
        modalBody.appendChild(this.makeEmptyIcon());
        // Add icons
        for (let [id, icon] of Object.entries(
            eXeLearning.app.themes.getThemeIcons()
        )) {
            let iconElement = document.createElement('div');
            iconElement.classList.add('exe-icon');
            iconElement.classList.add('option-block-icon');
            iconElement.setAttribute('tabindex', 0);
            iconElement.setAttribute('icon-id', icon.id);
            let iconValue = this.makeIconValueElement(icon);
            iconElement.append(iconValue);
            // Check if selected
            if (
                this.iconName == icon.value ||
                this.iconName == iconValue.getAttribute('icon-id')
            ) {
                iconElement.setAttribute('selected', true);
                if (this.iconName == icon.value) {
                    iconElement.classList.add('selected-provisional');
                }
            }
            // Add icon element to content
            modalBody.appendChild(iconElement);
        }
        return modalBody;
    }

    /**
     *
     * @returns {Node}
     */
    makeEmptyIcon() {
        let emptyIconElement = document.createElement('div');
        let emptyIconValue = this.emptyIcon;
        let emptyIconTitle = _('Empty');
        emptyIconElement.classList.add('exe-icon');
        emptyIconElement.classList.add('option-block-icon');
        emptyIconElement.classList.add('empty-block-icon');
        emptyIconElement.setAttribute('tabindex', 0);
        emptyIconElement.setAttribute('icon-id', 0);
        emptyIconElement.title = emptyIconTitle;
        emptyIconElement.innerHTML = emptyIconValue;
        // Check if selected
        emptyIconElement.setAttribute('selected', !this.iconName);
        return emptyIconElement;
    }

    /**
     * Modal change icon (body events)
     *
     */
    addBehaviourToModalChangeIconBody() {
        let modalBody = eXeLearning.app.modals.confirm.modalElementBody;
        let iconsElements = modalBody.querySelectorAll(
            '#change-block-icon-modal-content .option-block-icon'
        );
        iconsElements.forEach((icon) => {
            // One click to select
            icon.addEventListener('click', (event) => {
                iconsElements.forEach((option) => {
                    option.setAttribute('selected', 'false');
                });
                icon.setAttribute('selected', true);
            });
            // Double click to select and save
            icon.addEventListener('dblclick', (event) => {
                iconsElements.forEach((option) => {
                    option.setAttribute('selected', 'false');
                });
                icon.setAttribute('selected', true);
                this.saveIconAction();
                eXeLearning.app.modals.confirm.close();
            });
            // Press enter
            icon.addEventListener('keyup', (event) => {
                if (event.key == 'Enter') {
                    iconsElements.forEach((option) => {
                        option.setAttribute('selected', 'false');
                    });
                    icon.setAttribute('selected', true);
                    this.saveIconAction();
                    eXeLearning.app.modals.confirm.close();
                }
            });
        });
    }

    /*********************************
     * MODAL CHANGE TITLE */

    /**
     *
     */
    showModalChangeTitle() {
        eXeLearning.app.modals.confirm.show({
            title: _('Change title'),
            body: this.makeModalChangeTitleBody().outerHTML,
            confirmButtonText: _('Save'),
            cancelButtonText: _('Cancel'),
            focusFirstInputText: true,
            confirmExec: () => {
                this.saveTitleAction();
            },
            behaviour: () => {
                this.addBehaviourToModalChangeTitleBody();
            },
        });
    }

    /**
     *
     */
    saveTitleAction() {
        let modalBody = eXeLearning.app.modals.confirm.modalElementBody;
        let inputElement = modalBody.querySelector('#change-block-title-input');
        let inputText = inputElement.value.trim();
        this.apiUpdateTitle(inputText);
    }

    /**
     *
     */
    makeModalChangeTitleBody() {
        // Modal body
        let modalBody = document.createElement('div');
        modalBody.id = 'change-block-title-modal-content';
        // Modal text
        let modalText = document.createElement('p');
        modalText.classList.add('text-info-change-title');
        modalText.innerHTML = _('Write new title of the block:');
        // Input
        let input = document.createElement('input');
        input.id = 'change-block-title-input';
        input.setAttribute('type', 'text');
        let titleText = this.blockName ? this.blockName : '';
        input.setAttribute('value', titleText);

        modalBody.appendChild(modalText);
        modalBody.appendChild(input);

        return modalBody;
    }

    /**
     *
     */
    addBehaviourToModalChangeTitleBody() {
        let modalBody = eXeLearning.app.modals.confirm.modalElementBody;
        let inputElement = modalBody.querySelector('#change-block-title-input');
        // Focus input title
        setTimeout(() => {
            this.focusTextInput(inputElement);
        }, 500);
    }

    /*******************************************************************************
     * GET
     *******************************************************************************/

    /**
     * Get the value of order based on the top and bottom blocks
     *
     * @returns {Number}
     */
    getCurrentOrder() {
        let previousBlock, nextBlock;
        if ((previousBlock = this.getContentPrevBlock())) {
            this.order = parseInt(previousBlock.getAttribute('order')) + 1;
            return this.order;
        } else if ((nextBlock = this.getContentNextBlock())) {
            this.order = parseInt(nextBlock.getAttribute('order')) - 1;
            return this.order;
        }
        return -1;
    }

    /**
     *
     * @returns {Node}
     */
    getContentPrevBlock() {
        let previousBlock = this.blockContent.previousElementSibling;
        if (
            previousBlock &&
            previousBlock.classList &&
            previousBlock.classList.contains('box')
        ) {
            return previousBlock;
        }
        return false;
    }

    /**
     *
     * @returns {Node}
     */
    getContentNextBlock() {
        let nextBlock = this.blockContent.nextSibling;
        if (
            nextBlock &&
            nextBlock.classList &&
            nextBlock.classList.contains('box')
        ) {
            return nextBlock;
        }
        return false;
    }

    /*******************************************************************************
     * API
     *******************************************************************************/

    /**
     *
     * @param {*} icon
     */
    apiUpdateIcon(icon) {
        let params = ['odePagStructureSyncId', 'iconName'];
        // Save new icon text
        this.iconName = icon;
        // If block exist save in bbdd
        if (this.id) {
            this.apiSendDataService('putSaveBlock', params).then((response) => {
                // Generate icon from theme icons
                this.makeIconNameElement();
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    response.odePagStructureSync.blockId,
                    null,
                    'EDIT',
                    null
                );
            });
        }
    }

    /**
     *
     * @param {*} title
     */
    apiUpdateTitle(title) {
        let params = ['odePagStructureSyncId', 'blockName'];
        // Save new title text
        this.blockName = title;
        this.blockNameElementText.innerHTML = title;
        // If block exist save in bbdd
        if (this.id) {
            this.apiSendDataService('putSaveBlock', params).then((response) => {
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    response.odePagStructureSync.blockId,
                    null,
                    'EDIT',
                    null
                );
            });
        }
    }

    /**
     * Save properties in database
     *
     * @param {Array} properties
     * @param {Boolean} inherit
     */
    async apiSaveProperties(properties, inherit) {
        // Uptate array of properties
        for (let [key, value] of Object.entries(properties)) {
            this.properties[key].value = value;
        }
        // Generate params array
        let params = {
            odePagStructureSyncId: this.id,
        };
        if (inherit) params.updateChildsProperties = 'true';
        for (let [key, value] of Object.entries(this.properties)) {
            params[key] = value.value;
        }
        // Save in database
        eXeLearning.app.api.putSavePropertiesBlock(params).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // Reset block content
                this.generateBlockContentNode(false);
                // Reset idevices content
                if (
                    inherit &&
                    response.odePagStructureSync.odeComponentsSyncs
                ) {
                    response.odePagStructureSync.odeComponentsSyncs.forEach(
                        (ideviceData) => {
                            let idevice = this.engine.getIdeviceById(
                                ideviceData.odeIdeviceId
                            );
                            idevice.setProperties(this.properties, true);
                            idevice.makeIdeviceContentNode(false);
                        }
                    );
                }
                // Synchronize current users
                eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    response.odePagStructureSync.blockId,
                    null,
                    'EDIT',
                    null
                );
            } else {
                eXeLearning.app.modals.alert.show({
                    title: _('Block error'),
                    body: _(
                        "An error occurred while saving block's properties in database"
                    ),
                    contentId: 'error',
                });
            }
        });
    }

    /**
     *
     * @param {*} odeNavStructureSyncId
     */
    async apiUpdatePage(odeNavStructureSyncId) {
        // Can't move component to current page
        if (this.odeNavStructureSyncId == odeNavStructureSyncId) return false;
        // Required parameters
        let params = ['odePagStructureSyncId', 'odeNavStructureSyncId'];
        this.odeNavStructureSyncId = odeNavStructureSyncId;
        // Update page in database
        let response = await this.apiSendDataService('putSaveBlock', params);
        if (response.responseMessage == 'OK') {
            this.remove();
        }
        // Error saving block in database
        else {
            let defaultModalMessage = _(
                'An error occurred while update component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
    }

    /**
     * Update order of block in database
     *
     * @return {Array}
     */
    async apiUpdateOrder(getCurrentOrder) {
        let params = ['odePagStructureSyncId', 'order'];
        // If indicated, obtains the new order of the neighboring blocks
        if (getCurrentOrder) {
            let currentOrder = this.getCurrentOrder();
            if (currentOrder >= 0) {
                this.order = currentOrder;
            }
        }
        // Update order in database
        let response = await this.apiSendDataService('putReorderBlock', params);
        if (response.responseMessage == 'OK') {
            // Remove class moving of block
            setTimeout(() => {
                this.blockContent.classList.remove('moving');
            }, this.engine.movingClassDuration);
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                this.blockId,
                null,
                'MOVE_ON_PAGE',
                null
            );
        }
        // Error saving block in database
        else {
            let defaultModalMessage = _(
                'An error occurred while update component in database'
            );
            this.showModalMessageErrorDatabase(response, defaultModalMessage);
        }
        // this.sendPublishedNotification();
        return response;
    }

    /**
     * Clone the block
     *
     */
    async apiCloneBlock() {
        let params = ['odePagStructureSyncId'];
        let response = await this.apiSendDataService(
            'postCloneBlock',
            params,
            true
        );
        if (response.responseMessage == 'OK') {
            await this.engine.cloneBlockInContent(
                this,
                response.odePagStructureSync
            );
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                response.odePagStructureSync.blockId,
                null,
                'ADD',
                null
            );
            let additionalData = {
                blockId: response.odePagStructureSync.blockId,
            };
            eXeLearning.app.project.sendOdeOperationLog(
                response.odePagStructureSync.pageId,
                response.odePagStructureSync.pageId,
                'CLONE_BLOCK',
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
     * Delete the block from the database
     *
     * @returns {Object}
     */
    async apiDeleteBlock() {
        eXeLearning.app.api.deleteBlock(this.id).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // All blocks that have been modified
                if (response.odePagStructureSyncs) {
                    // Update the order of other blocks
                    this.engine.updateComponentsBlocks(
                        response.odePagStructureSyncs,
                        ['order']
                    );
                    // this.sendPublishedNotification();
                }
            }
            // Error saving block in database
            else {
                let defaultModalMessage = _(
                    'An error occurred while removing the component from the database'
                );
                this.showModalMessageErrorDatabase(
                    response,
                    defaultModalMessage
                );
            }
        });
    }

    /**
     * Call service to save/update block in bbdd
     *
     * @param {Array} params
     * @returns {Object}
     */
    async apiSendDataService(service, params) {
        let data = this.generateDataObject(params);
        let response = await eXeLearning.app.api[service].call(
            eXeLearning.app.api,
            data
        );
        if (response && response.responseMessage == 'OK') {
            // All blocks that have been modified
            if (response.odePagStructureSyncs) {
                // Update the order of other components if necessary
                this.engine.updateComponentsBlocks(
                    response.odePagStructureSyncs,
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
            odePagStructureSyncId: this.id,
            odeVersionId: defaultVersion,
            odeSessionId: defaultSession,
            odeNavStructureSyncId: this.odeNavStructureSyncId
                ? this.odeNavStructureSyncId
                : defaultOdeNavStructureSyncId,
            odePageId: this.pageId ? this.pageId : defaultOdePageId,
            iconName: this.iconName,
            blockName: this.blockName,
            order: this.order,
        };
    }

    /**
     * Show modal with response error
     *
     */
    showModalMessageErrorDatabase(response, defaultMessage) {
        let titleText, bodyText;
        titleText = _('Block error');
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
     * REMOVE
     *******************************************************************************/

    /**
     * Remove block
     *
     * @param {Boolean} bbdd Indicates if it is deleted in the database
     */
    remove(bbdd) {
        // Remove content element
        this.blockContent.remove();
        // Remove block in engine components
        this.engine.removeBlockOfComponentList(this.id);
        // Remove idevices of block
        this.removeIdevices();
        // Update engine mode
        this.engine.updateMode();
        // Delete block in database
        if (bbdd) {
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                null,
                this.blockId,
                null,
                'DELETE',
                null
            );
            let additionalData = {
                blockId: this.blockId,
            };
            eXeLearning.app.project.sendOdeOperationLog(
                this.pageId,
                this.pageId,
                'REMOVE_BLOCK',
                additionalData
            );
            this.apiDeleteBlock();
        }
    }

    /**
     * Remove idevices of block
     *
     */
    removeIdevices() {
        this.idevices.forEach((idevice) => {
            idevice.remove(false);
        });
    }

    /**
     * Remove idevice from the idevice list
     *
     */
    removeIdeviceOfListById(id) {
        this.clearIdevicesOfList();
        this.idevices = this.idevices.filter((idevice, index, arr) => {
            return idevice.id != id;
        });
    }

    /**
     * Removes from the list of idevices those that no longer exist
     *
     */
    clearIdevicesOfList() {
        this.idevices.forEach((idevice) => {
            if (!this.engine.components.idevices.includes(idevice)) {
                idevice.hasBeenDeleted = true;
            }
        });
        this.idevices = this.idevices.filter((idevice, index, arr) => {
            return !idevice.hasBeenDeleted;
        });
    }

    /**
     * Remove class loading of block content
     *
     */
    removeClassLoading() {
        this.blockContent.classList.remove('loading');
    }

    /*******************************************************************************
     * UPDATE
     *******************************************************************************/

    /**
     * Change value of block param
     *
     * @param {*} param
     * @param {*} newValue
     */
    updateParam(param, newValue) {
        this[param] = newValue;
        // Modifying some parameters have certain implications
        switch (param) {
            case 'order':
                this.blockContent.setAttribute('order', this.order);
                break;
            case 'id':
                this.blockContent.setAttribute('sym-id', this.id);
        }
    }

    /**
     *
     * @param {*} mode
     */
    updateMode(mode) {
        if (mode) this.mode = mode;
        this.blockContent.setAttribute('mode', this.mode);
        switch (this.mode) {
            case 'edition':
                this.headElement.setAttribute('draggable', false);
                this.headElement.classList.remove('draggable');
                break;
            case 'export':
                this.headElement.setAttribute('draggable', true);
                this.headElement.classList.add('draggable');
                break;
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
     * Move window to block node
     *
     * @param {Number} time
     */
    goWindowToBlock(time) {
        let hashId = this.blockId;
        setTimeout(() => {
            window.location.hash = hashId;
        }, time);
    }

    /*******************************************************************************
     * AUX
     *******************************************************************************/

    /**
     * Focus element
     *
     * @param {*} input
     */
    focusTextInput(input) {
        input.focus();
        let inputElementValue = input.value;
        input.value = '';
        input.value = inputElementValue;
    }

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

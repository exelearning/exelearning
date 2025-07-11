/**
 * eXeLearning
 *
 * Set the events in the nav menu
 */

export default class MenuStructureBehaviour {
    constructor(structureEngine) {
        this.structureEngine = structureEngine;
        this.menuNav = document.querySelector('#main #menu_nav');
        this.menuNavList = this.menuNav.querySelector('#main #nav_list');
        this.nodeSelected = null;
        this.nodeDrag = null;
        this.enterDragMenuStructureCount = 0;
        this.dbclickNode = false;
        // Add object to engine
        this.structureEngine.menuStructureBehaviour = this;
    }

    /**
     *
     */
    behaviour(firtsTime) {
        // Button related events are only loaded once
        if (firtsTime) {
            this.addEventNavNewNodeOnclick();
            this.addEventNavPropertiesNodeOnclick();
            this.addEventNavRemoveNodeOnclick();
            this.addEventNavCloneNodeOnclick();
            this.addEventNavImportIdevicesOnclick();
            //this.addEventNavCheckOdePageBrokenLinksOnclick();
            this.addEventNavMovPrevOnClick();
            this.addEventNavMovNextOnClick();
            this.addEventNavMovUpOnClick();
            this.addEventNavMovDownOnClick();
        }
        // Nav elements drag&drop events
        this.addEventNavElementOnclick();
        this.addEventNavElementOnDbclick();
        this.addEventNavElementIconOnclick();
        this.addDragAndDropFunctionalityToNavElements();
    }

    /*******************************************************************************
     * EVENTS
     *******************************************************************************/

    /**
     *
     */
    addEventNavElementOnclick() {
        var navLabelElements = this.menuNav.querySelectorAll(
            `.nav-element > .nav-element-text`
        );
        navLabelElements.forEach((element) => {
            element.addEventListener('click', (event) => {
                event.stopPropagation();
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                this.selectNode(element.parentElement).then((nodeElement) => {
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                    // Check dbclick
                    if (nodeElement && this.dbclickNode) {
                        this.showModalPropertiesNode();
                        this.dbclickNode = false;
                    }
                });
            });
        });
    }

    /**
     *
     */
    addEventNavElementOnDbclick() {
        var navLabelElements = this.menuNav.querySelectorAll(
            `.nav-element:not([nav-id="root"]) > .nav-element-text`
        );
        navLabelElements.forEach((element) => {
            element.addEventListener('dblclick', (event) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                event.stopPropagation();
                this.dbclickNode = true;
            });
        });
    }

    /**
     *
     */
    addEventNavElementIconOnclick() {
        var navIconsElements = this.menuNav.querySelectorAll(
            `.nav-element > .exe-icon`
        );
        navIconsElements.forEach((element) => {
            element.addEventListener('click', (event) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                event.stopPropagation();
                let navElement = element.parentElement;
                let node = this.structureEngine.getNode(
                    navElement.getAttribute('nav-id')
                );
                if (navElement.classList.contains('toggle-on')) {
                    navElement.classList.remove('toggle-on');
                    navElement.classList.add('toggle-off');
                    element.innerHTML = 'add';
                    node.open = false;
                } else {
                    navElement.classList.remove('toggle-off');
                    navElement.classList.add('toggle-on');
                    element.innerHTML = 'remove';
                    node.open = true;
                }
            });
        });
    }

    /**
     *
     */
    addEventNavNewNodeOnclick() {
        this.menuNav
            .querySelector('.button_nav_action.action_add')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                this.showModalNewNode();
            });
    }

    /**
     *
     */
    addEventNavPropertiesNodeOnclick() {
        this.menuNav
            .querySelector('.button_nav_action.action_properties')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    this.showModalPropertiesNode();
                }
            });
    }

    /**
     *
     */
    addEventNavRemoveNodeOnclick() {
        let params = { odeSessionId: eXeLearning.app.project.odeSession };
        this.menuNav
            .querySelector('.button_nav_action.action_delete')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    eXeLearning.app.api
                        .postCheckUsersOdePage(params)
                        .then((response) => {
                            if (response.isAvailable == true) {
                                this.showModalRemoveNode();
                            } else {
                                eXeLearning.app.modals.alert.show({
                                    title: _('multiple users on page'),
                                    body: _(response.responseMessage),
                                    contentId: 'error',
                                });
                            }
                        });
                }
            });
    }

    /**
     *
     */
    addEventNavCloneNodeOnclick() {
        this.menuNav
            .querySelector('.button_nav_action.action_clone')
            .addEventListener('click', async (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    await this.structureEngine.cloneNodeAndReload(
                        this.nodeSelected.getAttribute('nav-id')
                    );
                    this.showModalRenameNode();
                }
            });
    }

    /**
     *
     * @returns
     */
    createIdevicesUploadInput() {
        let inputUpload = document.createElement('input');
        inputUpload.classList.add('local-ode-file-upload-input');
        inputUpload.setAttribute('type', 'file');
        inputUpload.setAttribute('name', 'local-ode-file-upload');
        inputUpload.setAttribute('accept', '.block,.idevice');
        inputUpload.classList.add('d-none');
        inputUpload.addEventListener('change', (e) => {
            let uploadOdeFile = document.querySelector(
                '.local-ode-file-upload-input'
            );
            let odeFile = uploadOdeFile.files[0];

            // Create new input and remove older (prevents files cache)
            let newUploadInput = this.createIdevicesUploadInput();
            inputUpload.remove();
            this.menuNav.append(newUploadInput);

            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                odeFile,
                true
            );
        });
        this.menuNav.append(inputUpload);
        return inputUpload;
    }

    /**
     *
     */
    addEventNavImportIdevicesOnclick() {
        this.createIdevicesUploadInput();
        this.menuNav
            .querySelector('.button_nav_action.action_import_idevices')
            .addEventListener('click', async (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    this.menuNav
                        .querySelector('input.local-ode-file-upload-input')
                        .click();
                }
            });
    }

    /**
     * Get broken links in all ode on page
     * @returns
     */
    async getOdePageBrokenLinksEvent(pageId) {
        let odePageBrokenLinks =
            await eXeLearning.app.api.getOdePageBrokenLinks(pageId);
        return odePageBrokenLinks;
    }

    /**
     *
     */
    addEventNavCheckOdePageBrokenLinksOnclick() {
        this.menuNav
            .querySelector('.button_nav_action.action_check_broken_links')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    let selectedNav = this.menuNav.querySelector(
                        '#main .toggle-on .selected'
                    );
                    let pageId = selectedNav.getAttribute('page-id');
                    this.getOdePageBrokenLinksEvent(pageId).then((response) => {
                        if (!response.responseMessage) {
                            // Show eXe OdeBrokenList modal
                            eXeLearning.app.modals.odebrokenlinks.show(
                                response
                            );
                        } else {
                            // Open eXe alert modal
                            eXeLearning.app.modals.alert.show({
                                title: _('Broken links'),
                                body: 'No broken links found.',
                            });
                        }
                    });
                }
            });
    }

    /**
     *
     */
    addEventNavMovPrevOnClick() {
        this.menuNav
            .querySelector('.button_nav_action.action_move_prev')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    this.structureEngine.moveNodePrev(
                        this.nodeSelected.getAttribute('nav-id')
                    );
                }
            });
    }

    /**
     *
     */
    addEventNavMovNextOnClick() {
        this.menuNav
            .querySelector('.button_nav_action.action_move_next')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    this.structureEngine.moveNodeNext(
                        this.nodeSelected.getAttribute('nav-id')
                    );
                }
            });
    }

    /**
     *
     */
    addEventNavMovUpOnClick() {
        this.menuNav
            .querySelector('.button_nav_action.action_move_up')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    this.structureEngine.moveNodeUp(
                        this.nodeSelected.getAttribute('nav-id')
                    );
                }
            });
    }

    /**
     *
     */
    addEventNavMovDownOnClick() {
        this.menuNav
            .querySelector('.button_nav_action.action_move_down')
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    this.structureEngine.moveNodeDown(
                        this.nodeSelected.getAttribute('nav-id')
                    );
                }
            });
    }

    /*******************************************************************************
     * MODALS
     *******************************************************************************/

    /**
     *
     */
    showModalNewNode() {
        let parentNodeId = this.nodeSelected
            ? this.nodeSelected.getAttribute('nav-id')
            : null;
        let bodyText = _('Name');
        let bodyInput = `<input id="input-new-node" class="exe-input" type='text' value='' >`;
        let body = `<p>${bodyText}:</p><p>${bodyInput}</p>`;
        let modalConfirm = eXeLearning.app.modals.confirm;
        modalConfirm.show({
            title: _('New page'),
            contentId: 'new-node-modal',
            body: body,
            confirmButtonText: _('Save'),
            cancelButtonText: _('Cancel'),
            focusFirstInputText: true,
            confirmExec: () => {
                let title =
                    modalConfirm.modalElement.querySelector(
                        '#input-new-node'
                    ).value;
                if (!title || !title.replaceAll(' ', '')) title = _('New page');
                this.structureEngine.createNodeAndReload(parentNodeId, title);
            },
            behaviour: () => {
                let inputElement =
                    modalConfirm.modalElementBody.querySelector('input');
                this.addBehaviourToInputTextModal(inputElement, () => {
                    modalConfirm.confirm();
                });
            },
        });
    }

    /**
     *
     */
    showModalRenameNode() {
        let node = this.structureEngine.getNode(
            this.nodeSelected.getAttribute('nav-id')
        );
        let bodyText = _('New name');
        let bodyInput = `<input id="input-rename-node" class="exe-input" type='text' value='${node.pageName}' >`;
        let body = `<p>${bodyText}:</p><p>${bodyInput}</p>`;
        let modalConfirm = eXeLearning.app.modals.confirm;
        modalConfirm.show({
            title: _('Rename page'),
            contentId: 'rename-node-modal',
            body: body,
            confirmButtonText: _('Save'),
            cancelButtonText: _('Cancel'),
            confirmExec: () => {
                let newTitle =
                    eXeLearning.app.modals.confirm.modalElement.querySelector(
                        '#input-rename-node'
                    ).value;
                this.structureEngine.renameNodeAndReload(node.id, newTitle);
            },
            behaviour: () => {
                let inputElement =
                    modalConfirm.modalElementBody.querySelector('input');
                this.addBehaviourToInputTextModal(inputElement, () => {
                    modalConfirm.confirm();
                });
            },
        });
    }

    /**
     *
     */
    showModalPropertiesNode() {
        let node = this.structureEngine.getNode(
            this.nodeSelected.getAttribute('nav-id')
        );
        node.showModalProperties();

        const observer = new MutationObserver((mutations, obs) => {
            const checkbox = document.querySelector(
                '.property-value[property="editableInPage"]'
            );
            const input = document.querySelector(
                '.property-value[property="titlePage"]'
            );
            const titleInput = document.querySelector(
                '.property-value[property="titleNode"]'
            );
            const titlePageWrapper = document.querySelector('#titlePage');

            if (checkbox && input && titleInput && titlePageWrapper) {
                const syncInputState = () => {
                    const isChecked = checkbox.checked;
                    input.disabled = !isChecked;
                    if (!isChecked) {
                        // Menu item and page have the same title
                        input.value = titleInput.value || '';
                        titlePageWrapper.style.display = 'none';
                    } else {
                        // Different title in page
                        titlePageWrapper.style.display = 'block';
                    }
                };

                syncInputState();

                checkbox.addEventListener('change', syncInputState);
                titleInput.addEventListener('input', syncInputState);

                obs.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     *
     */
    showModalRemoveNode() {
        let modalConfirm = eXeLearning.app.modals.confirm;
        modalConfirm.show({
            title: _('Delete page'),
            contentId: 'delete-node-modal',
            body: _('Do you want to delete the page? This cannot be undone.'),
            confirmButtonText: _('Yes'),
            confirmExec: () => {
                this.structureEngine.removeNodeCompleteAndReload(
                    this.nodeSelected.getAttribute('nav-id')
                );
            },
        });
    }

    /**
     *
     */
    showModalCloneNode() {
        let modalConfirm = eXeLearning.app.modals.confirm;
        modalConfirm.show({
            title: _('Clone page'),
            contentId: 'clone-node-modal',
            body: _('Do you want to clone the page?'),
            confirmButtonText: _('Yes'),
            confirmExec: () => {
                this.structureEngine.cloneNodeAndReload(
                    this.nodeSelected.getAttribute('nav-id')
                );
            },
        });
    }

    /*******************************************************************************
     * DRAG & DROP
     *******************************************************************************/

    /**
     *
     */
    addDragAndDropFunctionalityToNavElements() {
        var navLabelElements = this.menuNav.querySelectorAll(
            `.nav-element:not([nav-id="root"]) > .nav-element-text`
        );
        navLabelElements.forEach((element) => {
            this.addDragAndDropFunctionalityToNode(element);
        });
    }

    /**
     *
     * @param {*} node
     */
    addDragAndDropFunctionalityToNode(node) {
        this.addEventDragOver(node);
        this.addEventDragStart(node);
        this.addEventDragEnd(node);
    }

    /**
     *
     * @param {*} node
     */
    addEventDragOver(node) {
        node.addEventListener('dragover', (event) => {
            event.stopPropagation();
            // Clear elements
            this.clearMenuNavDragOverClasses();
            // Drag node page
            if (this.nodeDrag) {
                event.preventDefault();
                if (this.nodeDrag != node.parentElement) {
                    node.classList.add('drag-over');
                }
            }
            // Drag idevice/block component
            else if (eXeLearning.app.project.idevices.draggedElement) {
                let componentDragged =
                    eXeLearning.app.project.idevices.draggedElement;
                // Idevice of content
                if (
                    componentDragged &&
                    componentDragged.classList.contains('idevice_actions')
                ) {
                    event.preventDefault();
                    node.classList.add('drag-over');
                    node.classList.add('idevice-content-over');
                }
                // Block of content
                else if (
                    componentDragged &&
                    componentDragged.classList.contains('box-head')
                ) {
                    event.preventDefault();
                    node.classList.add('drag-over');
                    node.classList.add('block-content-over');
                }
            }
        });
    }

    /**
     *
     * @param {*} node
     */
    addEventDragStart(node) {
        node.addEventListener('dragstart', async (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) {
                event.preventDefault();
                return;
            }
            event.stopPropagation();
            node.classList.add('dragging');
            let parent = node.parentElement;
            this.nodeDrag = parent;
            await this.selectNode(parent);
        });
    }

    /**
     *
     * @param {*} node
     */
    addEventDragEnd(node) {
        node.addEventListener('dragend', (event) => {
            event.stopPropagation();
            if (this.nodeDrag) {
                let nodeBase = this.menuNav.querySelector(
                    '.nav-element > .nav-element-text.drag-over'
                );
                if (nodeBase) {
                    let nodeBaseId =
                        nodeBase.parentElement.getAttribute('nav-id');
                    let nodeMovId = this.nodeDrag.getAttribute('nav-id');
                    this.structureEngine.moveNodeToNode(nodeMovId, nodeBaseId);
                }
                // Reset
                this.clearMenuNavDragOverClasses();
                node.classList.remove('dragging');
                this.nodeDrag = null;
            }
        });
    }

    /*******************************************************************************
     * TOOLTIPS
     *******************************************************************************/

    /**
     *
     */
    addTooltips() {
        $('#nav_list .nav-element-text', this.menuNav)
            .eq(0)
            .attr('title', _('Content properties'))
            .addClass('exe-app-tooltip');
        $('button.button_nav_action', this.menuNav).addClass('exe-app-tooltip');
        eXeLearning.app.common.initTooltips(this.menuNav);
    }

    /*******************************************************************************
     * NODE SELECTION
     *******************************************************************************/

    /**
     * Remove class "selected" in node elements
     *
     */
    deselectNodes() {
        let navElements = this.menuNav.querySelectorAll('.nav-element');
        navElements.forEach((e) => {
            e.classList.remove('selected');
        });
    }

    /**
     * Select first node
     *
     */
    async selectFirst() {
        let navElements = this.menuNav.querySelectorAll('.nav-element');
        if (navElements.length >= 1) {
            return await this.selectNode(navElements[0]);
        }
    }

    /**
     * Select node
     *
     * @param {Element} element
     * @returns {Promise<Element>}
     */
    async selectNode(element) {
        return new Promise(async (resolve, reject) => {
            let response = false;
            let time = 50;
            // We do not reload the page in case the node is already selected
            if (
                this.nodeSelected &&
                element.getAttribute('nav-id') ==
                    this.nodeSelected.getAttribute('nav-id')
            ) {
                this.setNodeSelected(element);
                response = element;
            } else {
                // Load the page components from the api
                let loadPageProcessOk =
                    await eXeLearning.app.project.idevices.loadApiIdevicesInPage(
                        true,
                        element
                    );
                if (loadPageProcessOk) {
                    this.deselectNodes();
                    this.setNodeSelected(element);
                    time = 100;
                    response = element;
                }
            }
            setTimeout(() => {
                // Add the Properties tooltip
                this.addTooltips();
                resolve(response);
            }, time);
        });
    }

    /**
     * Set node selected
     *
     * @param {Node} element
     */
    setNodeSelected(element) {
        this.nodeSelected = element;
        this.nodeSelected.classList.add('selected');
        this.structureEngine.nodeSelected = this.nodeSelected;
        this.setNodeIdToNodeContentElement();
        this.createAddTextBtn();
        this.enabledActionButtons();
    }

    /**
     * Set attribute node id to node content
     *
     */
    setNodeIdToNodeContentElement() {
        document
            .querySelector('#node-content')
            .removeAttribute('node-selected');
        if (this.nodeSelected) {
            let node = this.structureEngine.getNode(
                this.nodeSelected.getAttribute('nav-id')
            );
            document
                .querySelector('#node-content')
                .setAttribute('node-selected', node.pageId);
        }
    }

    /**
     * Create a button to add a Text iDevice
     *
     */
    createAddTextBtn() {
        // Hide any visible tooltips
        $('body > .tooltip').hide();
        // Remove the button
        $('#eXeAddContentBtnWrapper').remove();
        if ($('#properties-node-content-form').is(':visible')) {
            return;
        }
        // Create the button in the right place
        let txt = _('Add Text');
        let bgImage = $('#list_menu_idevices #text .idevice_icon').css(
            'background-image'
        );
        var addTextBtn = `
            <div class="text-center" id="eXeAddContentBtnWrapper">
                <button>${txt}</button>
            </div>
        `;
        $('#node-content').append(addTextBtn);
        // Click the button to add a Text iDevice
        $('#eXeAddContentBtnWrapper button')
            .off('click')
            .on('click', function (event) {
                if ($('#properties-node-content-form').is(':visible')) {
                    return;
                }
                $('#list_menu_idevices #text').trigger('click');
                $('#eXeAddContentBtnWrapper').remove();
            })
            .css('background-image', bgImage);
    }

    /**
     * Enable action buttons by node selected
     *
     */
    enabledActionButtons() {
        this.disableActionButtons();
        if (this.nodeSelected) {
            let node = this.structureEngine.getNode(
                this.nodeSelected.getAttribute('nav-id')
            );
            if (node.id == 'root') {
                // Enabled only "New node" button
                this.menuNav.querySelector(
                    '.button_nav_action.action_add'
                ).disabled = false;
            } else {
                // Enabled all buttons
                this.menuNav.querySelector(
                    '.button_nav_action.action_add'
                ).disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_properties'
                ).disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_delete'
                ).disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_clone'
                ).disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_import_idevices'
                ).disabled = false;
                //this.menuNav.querySelector(".button_nav_action.action_check_broken_links").disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_move_prev'
                ).disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_move_next'
                ).disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_move_up'
                ).disabled = false;
                this.menuNav.querySelector(
                    '.button_nav_action.action_move_down'
                ).disabled = false;
            }
        }
    }

    /**
     * Disable all action buttons
     *
     */
    disableActionButtons() {
        this.menuNav
            .querySelectorAll('#nav_actions .button_nav_action')
            .forEach((button) => {
                button.disabled = true;
            });
    }

    /*******************************************************************************
     * AUX
     *******************************************************************************/

    /**
     *
     */
    clearMenuNavDragOverClasses() {
        this.menuNav
            .querySelectorAll('.nav-element > .nav-element-text')
            .forEach((element) => {
                element.classList.remove('drag-over');
                element.classList.remove('idevice-content-over');
                element.classList.remove('block-content-over');
            });
    }

    /**
     *
     * @param {*} inputElement
     * @param {*} callback
     */
    addBehaviourToInputTextModal(inputElement, callback) {
        // Focus input title
        setTimeout(() => {
            this.focusTextInput(inputElement);
        }, 500);
    }

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
}

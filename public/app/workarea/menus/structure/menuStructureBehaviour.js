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
    behaviour(firstTime) {
        // Button related events are only loaded once
        if (firstTime) {
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
        this.addNavTestIds();
        // Nav elements drag&drop events
        this.addEventNavElementOnclick();
        this.addEventNavElementOnDbclick();
        this.addEventNavElementIconOnclick();
        this.addEventNavElementOnMenuIconClic();
        this.addDragAndDropFunctionalityToNavElements();
    }

    /**
     * Add data-testid attributes to nav nodes after they are rendered.
     */
    addNavTestIds() {
        const nodes = this.menuNav.querySelectorAll('.nav-element[nav-id]');
        nodes.forEach((nav) => {
            const id = nav.getAttribute('nav-id');
            nav.setAttribute('data-testid', 'nav-node');
            nav.setAttribute('data-node-id', id);
            const textBtn = nav.querySelector('.nav-element-text');
            if (textBtn) {
                textBtn.setAttribute('data-testid', 'nav-node-text');
                textBtn.setAttribute('data-node-id', id);
            }
            const menuBtn = nav.querySelector('.node-menu-button');
            if (menuBtn) {
                menuBtn.setAttribute('data-testid', 'nav-node-menu');
                menuBtn.setAttribute('data-node-id', id);
            }
            const toggle = nav.querySelector('.exe-icon');
            if (toggle) {
                toggle.setAttribute('data-testid', 'nav-node-toggle');
                toggle.setAttribute('data-node-id', id);
            }
        });
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

    addEventNavElementOnMenuIconClic() {
        var navLabelMenuElements = this.menuNav.querySelectorAll(
            `.nav-element:not([nav-id="root"]) > .nav-element-text .node-menu-button`
        );
        navLabelMenuElements.forEach((element) => {
            element.addEventListener('click', (event) => {
                event.stopPropagation();
                let node = this.structureEngine.getNode(
                    element.getAttribute('data-menunavid')
                );
                node.showModalProperties();
                this.mutationForModalProperties();
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
                    element.innerHTML = 'keyboard_arrow_right';
                    node.open = false;
                    // Testing: explicit expanded state
                    navElement.setAttribute('data-expanded', 'false');
                    if (navElement.getAttribute('is-parent') === 'true') {
                        navElement.setAttribute('aria-expanded', 'false');
                    }
                } else {
                    navElement.classList.remove('toggle-off');
                    navElement.classList.add('toggle-on');
                    element.innerHTML = 'keyboard_arrow_down';
                    node.open = true;
                    // Testing: explicit expanded state
                    navElement.setAttribute('data-expanded', 'true');
                    if (navElement.getAttribute('is-parent') === 'true') {
                        navElement.setAttribute('aria-expanded', 'true');
                    }
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
        inputUpload.classList.add('local-ode-file-upload-input', 'd-none');
        inputUpload.setAttribute('type', 'file');
        inputUpload.setAttribute('name', 'local-ode-file-upload');
        inputUpload.setAttribute('accept', '.block,.idevice');
        inputUpload.id = 'local-ode-file-upload';
        let label = document.createElement('label');
        label.setAttribute('for', inputUpload.id);
        label.classList.add('visually-hidden');
        label.textContent = _('Upload iDevice file');

        inputUpload.addEventListener('change', (e) => {
            let uploadOdeFile = document.querySelector(
                '.local-ode-file-upload-input'
            );
            let odeFile = uploadOdeFile.files[0];
            let newUploadInput = this.createIdevicesUploadInput();
            inputUpload.remove();
            this.menuNav.append(newUploadInput);

            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                odeFile,
                true
            );
        });

        this.menuNav.append(label);
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
        this.mutationForModalProperties();
    }

    mutationForModalProperties() {
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
                if (element?.getAttribute('page-id') === 'root') {
                    // Collaborative
                    this.hideIdevicesBotton();
                } else {
                    this.showIdevicesBotton();
                }
                this.checkIfEmptyNode();
            }
            setTimeout(() => {
                // Add the Properties tooltip
                this.addTooltips();
                resolve(response);
            }, time);
        });
    }

    hideIdevicesBotton() {
        document
            .getElementById('node-content-container')
            .classList.add('properties-page');
        document.getElementById('idevices-bottom').style.display = 'none';
    }

    showIdevicesBotton() {
        document
            .getElementById('node-content-container')
            .classList.remove('properties-page');
        document.getElementById('idevices-bottom').style.display =
            'inline-flex';
    }

    checkIfEmptyNode() {
        this.nodeContent = document.getElementById('node-content');
        const validArticles = this.nodeContent.querySelectorAll(
            'article:not(#empty_articles), #properties-node-content-form'
        );
        const emptyArticles = this.nodeContent.querySelector('#empty_articles');
        if (validArticles.length === 0) {
            if (!emptyArticles) {
                const emptyContainer = document.createElement('article');
                emptyContainer.id = 'empty_articles';
                emptyContainer.classList.add('empty-node-message');
                emptyContainer.classList.add('box');

                const messageBox = document.createElement('div');
                messageBox.classList.add('empty-block-message-box');

                const icon = document.createElement('div');
                icon.classList.add('empty-block-message-icon');
                icon.innerHTML = `<svg width="40" height="43" viewBox="0 0 44 43" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M39.1868 35.9629C35.6342 39.784 30.8046 41.995 25.5952 42.1831L18.464 42.4445C16.1025 42.5289 13.8529 41.6904 12.1261 40.0849L9.32699 37.4826C7.60006 35.877 6.60184 33.696 6.5145 31.3381L6.38961 27.8635L2.15279 23.9245C0.114043 22.0291 -0.000700807 18.8319 1.89309 16.7949C2.59843 16.0363 3.48747 15.542 4.42833 15.322C3.46248 13.4778 3.70373 11.1412 5.19977 9.53209C6.69582 7.92294 9.00695 7.51072 10.9149 8.34157C11.0676 7.38883 11.4943 6.46793 12.2012 5.70754C13.6973 4.09839 16.0084 3.68617 17.9163 4.51703C18.069 3.56428 18.4957 2.64338 19.2027 1.88299C21.0981 -0.155753 24.2953 -0.270499 26.3322 1.62329L38.3411 12.7881C44.9633 18.9448 45.3434 29.3407 39.1868 35.9629ZM9.00125 30.2913L9.03608 31.2473C9.09909 32.9302 9.81348 34.489 11.0468 35.6356L13.8459 38.238C15.0775 39.3829 16.6841 39.9821 18.3705 39.9224L25.5016 39.6609C30.0392 39.4973 34.243 37.5739 37.3366 34.2464C42.5463 28.6428 42.2293 19.8454 36.6239 14.634L24.6134 3.47092C23.5949 2.52401 21.9954 2.5806 21.0469 3.60084C20.0984 4.62107 20.1583 6.22042 21.1768 7.16734L22.1016 8.02393C22.6109 8.49737 22.64 9.29623 22.1665 9.80547C21.6932 10.318 20.8944 10.3471 20.3834 9.87209L17.612 7.29547C16.5935 6.34856 14.994 6.40514 14.0455 7.42538C13.0969 8.44562 13.1569 10.045 14.1754 10.9919L16.9484 13.5668C17.4576 14.0402 17.4867 14.8391 17.0133 15.3483C16.54 15.8609 15.7411 15.89 15.2302 15.4149L10.6123 11.1217C9.59379 10.1748 7.99432 10.2313 7.0458 11.2516C6.09727 12.2718 6.1572 13.8712 7.17571 14.8181L11.7952 19.1096C12.3044 19.5831 12.3335 20.3819 11.8601 20.8912C11.3868 21.4037 10.5879 21.4328 10.0769 20.9578L7.3055 18.3812C6.28699 17.4342 4.68752 17.4908 3.739 18.5111C2.79047 19.5313 2.8504 21.1307 3.86891 22.0776L8.48676 26.3708C8.49011 26.3707 8.49011 26.3707 8.49184 26.3723L12.1847 29.8057C12.694 30.2791 12.7231 31.078 12.2496 31.5872C11.7763 32.0998 10.9775 32.1289 10.4665 31.6538L9.00125 30.2913Z" fill="#474747"/>
</svg>`;

                const title = document.createElement('h2');
                title.classList.add('empty-block-message-title');
                title.textContent = _('Drag an iDevice in and start building');

                const description = document.createElement('p');
                description.classList.add('empty-block-message-text');
                description.innerHTML = _(
                    'Just drag an iDevice onto this page to start designing your content.'
                );

                messageBox.appendChild(icon);
                messageBox.appendChild(title);
                messageBox.appendChild(description);

                const arrow = document.createElement('div');
                arrow.classList.add('empty-block-arrow-icon');
                arrow.innerHTML = `<svg width="84" height="129" viewBox="0 0 84 129" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M0.531071 16.7299C0.0906242 18.1471 0.343717 18.6096 0.281161 18.7143C0.281161 18.7143 15.5 -2.80225 37.151 10.6978C58.8021 24.1978 54.151 51.8564 54.151 51.8564C54.151 51.8564 44.5 49.324 37.151 51.8564C13.2532 60.0916 19.625 84.949 38.776 81.5469C48.7026 79.7835 54.151 74.074 58.3749 59.5738C58.3749 59.5738 70.1473 67.5449 72.875 82.324C75.3863 95.9307 63.4011 121.266 63.4011 121.266L65.6511 122.381C65.6511 122.381 80.5651 94.863 77.0261 78.1986C74 63.949 59.401 54.3684 59.401 54.3684C63.4011 26.1978 49.009 -0.554479 25.0625 0.324034C8.02323 0.949144 1.535 13.4995 0.531071 16.7299ZM53.3749 56.6989C53.3749 56.6989 51.75 77.199 35.401 75.9686C19.0521 74.7382 33.7499 50.0739 53.3749 56.6989Z" fill="#333333"/>
<path d="M59.8282 121.433L61.1831 106.61C61.255 105.824 62.154 105.444 62.7235 105.991C63.1168 106.368 63.5256 106.798 63.8472 107.223C65.5756 109.507 65.6905 112.348 66.8159 114.885C66.8159 114.885 70.9813 112.254 75.6249 108.199C80.1036 104.288 82.9927 102.946 83.1923 102.856C83.2003 102.852 83.207 102.848 83.2143 102.843C83.6213 102.567 84.1018 103.063 83.8095 103.458C82.3025 105.496 79.7961 108.868 76.9256 112.658C75.7708 114.183 65.6777 130.254 60.9667 128.225C59.2269 127.475 59.8282 121.433 59.8282 121.433Z" fill="#333333"/>
<path d="M70.7033 111.919C70.6039 111.815 71.0924 110.561 71.0924 110.561L69.0834 115.037L72.3437 110.918C72.3437 110.918 70.8026 112.024 70.7033 111.919Z" fill="#333333"/>
<path d="M66.4858 113.823C66.6295 113.813 67.1081 112.555 67.1081 112.555L65.5966 117.223L66.0218 112.687C66.0218 112.687 66.3422 113.834 66.4858 113.823Z" fill="#333333"/>
</svg>`;

                emptyContainer.appendChild(messageBox);
                emptyContainer.appendChild(arrow);

                this.nodeContent.appendChild(emptyContainer);
                this.initSimulatedOver(emptyContainer);
            }
        } else {
            if (emptyArticles) {
                emptyArticles.remove();
            }
        }
    }

    initSimulatedOver(target) {
        const state = { dragging: false, html5: false, raf: false };
        const check = (x, y) => {
            const r = target.getBoundingClientRect();
            const over =
                x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
            target.classList.toggle('is-over', over);
        };
        const schedule = (x, y) => {
            if (state.raf) return;
            state.raf = true;
            requestAnimationFrame(() => {
                state.raf = false;
                check(x, y);
            });
        };
        document.addEventListener(
            'dragstart',
            () => {
                state.dragging = true;
                state.html5 = true;
            },
            true
        );
        document.addEventListener(
            'dragend',
            () => {
                state.dragging = false;
                target.classList.remove('is-over');
            },
            true
        );
        document.addEventListener(
            'dragover',
            (e) => {
                if (!state.dragging || !state.html5) return;
                e.preventDefault();
                schedule(e.clientX, e.clientY);
            },
            { passive: false, capture: true }
        );
        const startSelectors = [
            '[draggable="true"]',
            '.draggable',
            '[drag]',
            '[data-drag]',
            '.idevice-element-in-content',
        ];
        document.addEventListener(
            'pointerdown',
            (e) => {
                if (e.button !== 0) return;
                if (e.target.closest(startSelectors.join(','))) {
                    state.dragging = true;
                    state.html5 = false;
                }
            },
            true
        );
        const end = () => {
            if (!state.dragging || state.html5) return;
            state.dragging = false;
            target.classList.remove('is-over');
        };
        document.addEventListener(
            'pointermove',
            (e) => {
                if (!state.dragging || state.html5) return;
                schedule(e.clientX, e.clientY);
            },
            true
        );
        document.addEventListener('pointerup', end, true);
        document.addEventListener('pointercancel', end, true);
    }

    /**
     * Set node selected
     *
     * @param {Node} element
     */
    setNodeSelected(element) {
        this.nodeSelected = element;
        this.nodeSelected?.classList.add('selected'); // Collaborative
        this.structureEngine.nodeSelected = this.nodeSelected;
        this.setNodeIdToNodeContentElement();
        this.createAddTextBtn();
        this.enabledActionButtons();

        // Testing: explicit selected state on nav nodes and ARIA sync
        const allNodes = this.menuNav.querySelectorAll('.nav-element[nav-id]');
        allNodes.forEach((n) => {
            const isSel = n === this.nodeSelected;
            n.setAttribute('data-selected', isSel ? 'true' : 'false');
            n.setAttribute('aria-selected', isSel ? 'true' : 'false');
        });
    }

    /**
     * Set attribute node id to node content
     *
     */
    setNodeIdToNodeContentElement() {
        const nodeContent = document.querySelector('#node-content');
        if (!nodeContent) return;

        nodeContent.removeAttribute('node-selected');

        if (this.nodeSelected) {
            const node = this.structureEngine.getNode(
                this.nodeSelected.getAttribute('nav-id')
            );

            // Avoid crash when node is undefined (deleted or not yet loaded)
            if (!node || typeof node.pageId === 'undefined') {
                return;
            }

            nodeContent.setAttribute('node-selected', node.pageId);
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
                <button data-testid="add-text-quick">${txt}</button>
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
            if (node) {
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

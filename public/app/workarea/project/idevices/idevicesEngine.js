/**
 * eXeLearning
 *
 */

import IdeviceNode from './content/ideviceNode.js';
import IdeviceBlockNode from './content/blockNode.js';

export default class IdevicesEngine {
    constructor(project) {
        this.project = project;
        this.workareaElement = document.querySelector('#main #workarea');
        this.nodeContainerElement = this.workareaElement.querySelector(
            '#node-content-container'
        );
        this.nodeContentLoadScreenElement =
            this.nodeContainerElement.querySelector(
                '#load-screen-node-content'
            );
        this.nodeContentElement =
            this.nodeContainerElement.querySelector('#node-content');
        this.loadingPage = false;
        this.hideNodeContanerLoadScreenTimeout = null;
        this.mode = 'view';
        this.draggedElement = null;
        this.ideviceActive = null;
        this.menuIdevicesDraggableElements = null;
        this.clickIdeviceMenuEnabled = null;
        this.intervalTime = 100;
        this.movingClassDuration = 200;
        this.clientCallWaitingTime =
            this.project.app.eXeLearning.config.clientCallWaitingTime;
        this.ideviceScriptsElements = [];
        this.components = { blocks: [], idevices: [] };
    }

    /**
     *
     */
    behaviour() {
        // Get elements of menus
        this.clickIdeviceMenuEnabled = true;
        this.menuIdevicesElement =
            this.project.app.menus.menuIdevices.menuIdevices;
        this.menuIdevicesDraggableElements =
            this.menuIdevicesElement.querySelectorAll(
                '.idevice_item.draggable'
            );
        // Set mode to node-content
        this.updateMode();
        // Node container drag&drop events
        this.addEventDragEnterToContainer(this.nodeContentElement);
        this.addEventDragLeaveToContainer(this.nodeContentElement);
        this.addEventDropToContainer(this.nodeContentElement);
        this.addEventDragOverToContainer(this.nodeContentElement);
        // Menu idevices events
        this.addEventDragStartToMenuIdevices();
        this.addEventClickIdevice();
    }

    /**
     * Generate random id
     */
    generateId() {
        return this.project.app.common.generateId();
    }

    /*******************************************************************************
     * DRAG & DROPS MOVEMENT
     *******************************************************************************/

    /**
     * Move idevice from menu to content
     *
     * @param {*} container
     * @param {*} ypos
     */
    moveIdeviceMenuToContent(container, ypos) {
        // Check if current page is document root
        if (
            this.project.app.project.structure.nodeSelected.getAttribute(
                'nav-id'
            ) == 'root'
        )
            return false;
        // Add class to dragged element
        this.draggedElement.classList.add('idevice-content-block');
        this.draggedElement.classList.add('idevice-element-in-content');
        // Element after draggable element
        let query = '.idevice-element-in-content.draggable:not(.dragging)';
        let otherElements = [...container.querySelectorAll(query)];
        let afterElement = this.getDragAfterElement(ypos, otherElements);
        if (afterElement) {
            // Insert before element of container
            if (container == afterElement.parentNode) {
                container.insertBefore(this.draggedElement, afterElement);
            } else {
                container.insertBefore(
                    this.draggedElement,
                    afterElement.parentNode
                );
            }
        } else {
            // Insert in last position of container
            container.append(this.draggedElement);
        }
    }

    /**
     * Move idevice from content to content
     *
     * @param {*} container
     * @param {*} ypos
     */
    moveIdeviceContentToContent(container, ypos) {
        // Element after draggable element
        let query = '.idevice-element-in-content.draggable:not(.dragging)';
        let otherElements = [...container.querySelectorAll(query)];
        let afterElement = this.getDragAfterElement(ypos, otherElements);
        if (afterElement) {
            // Insert before element of container
            if (container == afterElement.parentNode) {
                afterElement = afterElement;
            } else {
                afterElement = afterElement.parentNode;
            }
            container.insertBefore(this.draggedElement, afterElement);
        } else {
            // Insert in last position of container
            container.append(this.draggedElement);
        }
    }

    /**
     * Move block from content to content
     *
     * @param {*} container
     * @param {*} ypos
     */
    moveBlockContentToContent(container, ypos) {
        // Element after draggable element
        let query = '.box.idevice-element-in-content.draggable:not(.dragging)';
        let otherElements = [...container.querySelectorAll(query)];
        let afterElement = this.getDragAfterElement(ypos, otherElements);
        if (afterElement) {
            // Insert before element of container
            container.insertBefore(this.draggedElement, afterElement);
        } else {
            // Insert in last position of container
            container.append(this.draggedElement);
        }
    }

    /*********************************
     * EVENTS DRAG & DROP GENERIC  */

    /**
     * Drag over container node event
     *
     * @param {Node} container
     */
    addEventDragOverToContainer(container) {
        container.addEventListener('dragover', (event) => {
            event.stopPropagation();
            // Check if dragabble element is valid
            if (this.isDragableInside(this.draggedElement, container)) {
                event.preventDefault();
                // Move idevices of menu elements into -> node-content, blocks
                if (this.draggedElement.classList.contains('idevice_item')) {
                    this.moveIdeviceMenuToContent(container, event.clientY);
                }
                // Move idevices of content node into -> node-content, blocks
                else if (
                    this.draggedElement.classList.contains('idevice_actions')
                ) {
                    this.moveIdeviceContentToContent(container, event.clientY);
                }
                // Move block of content node into -> node-content
                else if (this.draggedElement.classList.contains('box-head')) {
                    this.moveBlockContentToContent(container, event.clientY);
                }
            }
        });
    }

    /**
     * Drag enter container node event
     *
     */
    addEventDragEnterToContainer(container) {
        container.addEventListener('dragenter', (event) => {
            event.preventDefault();
            if (this.draggedElement) {
                // Node content
                if (container.id == 'node-content') {
                    // Add/Remove class to dragged element
                    this.draggedElement.classList.add('in');
                    this.draggedElement.classList.remove('out');
                    // Count enter/leave
                    this.draggedElement.inNodeContent++;
                    // Add class to container
                    container.classList.add('component-inside');
                    // Clear menu stucture selection dragover
                    this.project.app.project.structure.menuStructureBehaviour.clearMenuNavDragOverClasses();
                }
                // Blocks
                else if (container.classList.contains('box')) {
                    // Classes of other containers
                    this.components.blocks.forEach((block) => {
                        if (container.id != block.blockId) {
                            if (
                                block.blockContent.classList.contains(
                                    'component-inside'
                                )
                            ) {
                                block.blockContent.classList.remove(
                                    'component-inside'
                                );
                            }
                        }
                    });
                    // Count enter/leave
                    this.draggedElement.inBlockContent++;
                    // Add class to container
                    if (this.draggedElement.inBlockContent > 0) {
                        container.classList.add('component-inside');
                    }
                }
            }
        });
    }

    /**
     * Drag leave container node event
     *
     */
    addEventDragLeaveToContainer(container) {
        container.addEventListener('dragleave', (event) => {
            event.preventDefault();
            if (this.draggedElement) {
                // Node content
                if (container.id == 'node-content') {
                    // Count enter/leave
                    this.draggedElement.inNodeContent--;
                    if (this.draggedElement.inNodeContent <= 0) {
                        // Set count enter/leave to 0
                        this.draggedElement.inNodeContent = 0;
                        // Add/Remove class to dragged element
                        this.draggedElement.classList.add('out');
                        this.draggedElement.classList.remove('in');
                        // Remove class to container
                        container.classList.remove('component-inside');
                    }
                }
                // Blocks
                else if (container.classList.contains('box')) {
                    this.draggedElement.inBlockContent--;
                    if (this.draggedElement.inBlockContent <= 0) {
                        // Set count enter/leave to 0
                        this.draggedElement.inBlockContent = 0;
                        // Remove class to container
                        container.classList.remove('component-inside');
                    }
                }
            }
        });
    }

    /**
     * Add event drop to containers
     *
     */
    addEventDropToContainer(container) {
        container.addEventListener('drop', async (event) => {
            event.stopPropagation();
            if (this.draggedElement) {
                // Idevices of menu
                if (this.draggedElement.classList.contains('idevice_item')) {
                    this.dropIdeviceMenuInContent(container);
                }
                // Idevice of content
                else if (
                    this.draggedElement.classList.contains('idevice_actions')
                ) {
                    this.dropIdeviceContentInContent(container);
                }
                // Block of content
                else if (this.draggedElement.classList.contains('box-head')) {
                    this.dropBlockContentInContent(container);
                }
            }
        });
    }

    /*********************************
     * EVENTS DRAG & DROP MENU IDEVICES  */

    /**
     * Add event drag start to menu idevices
     *
     */
    addEventDragStartToMenuIdevices() {
        this.menuIdevicesDraggableElements.forEach((element) => {
            element.addEventListener('dragstart', (event) => {
                event.stopPropagation();
                element.classList.add('dragging');
                element.setAttribute('hexid', this.generateId());
                this.addEventDragEndToMenuIdevice(element);
                this.draggedElement = element.cloneNode();
                this.draggedElement.inNodeContent = 0;
                this.draggedElement.inBlockContent = 0;
            });
        });
    }

    /**
     * Add event drag end to element
     *
     */
    addEventDragEndToMenuIdevice(element) {
        element.addEventListener('dragend', (event) => {
            event.stopPropagation();
            element.classList.remove('dragging');
            document
                .querySelectorAll('.idevice-content-block')
                .forEach((ideviceBlock) => {
                    ideviceBlock.remove();
                });
            this.resetDragElement();
        });
    }

    /**
     * Action when dropping an idevice from the menu on the content
     *
     * @param {*} container
     */
    async dropIdeviceMenuInContent(container) {
        // Check if container is valid for element
        if (this.isDragableInside(this.draggedElement, container)) {
            let ideviceData = { odeIdeviceTypeName: this.draggedElement.id };
            let ideviceNode = await this.createIdeviceInContent(
                ideviceData,
                container
            );
        }
        // Remove dragged element
        this.resetDragElement(true);
        this.resetDragOverClasses();
    }

    /*********************************
     * EVENTS DRAG & DROP CONTENT IDEVICES  */

    /**
     * Add event drag start to idevice element
     *
     */
    addEventDragStartToContentIdevice(element) {
        element.addEventListener('dragstart', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) {
                event.preventDefault();
                return;
            }
            event.stopPropagation();
            this.clearSelection();
            let ideviceNode = this.getIdeviceById(
                element.getAttribute('idevice-id')
            );
            let ideviceContent = ideviceNode.ideviceContent;
            if (!ideviceContent) return;
            // Set dragged element
            this.draggedElement = element;
            // Check odeComponent flag
            eXeLearning.app.project
                .isAvalaibleOdeComponent(null, ideviceContent.id)
                .then((response) => {
                    if (
                        response.responseMessage == 'OK' &&
                        this.draggedElement
                    ) {
                        if (ideviceContent.getAttribute('mode') == 'export') {
                            // Add class dragging
                            element.classList.add('dragging');
                            element.classList.add('dragging-start');
                            // Dragged element
                            this.draggedElement.inNodeContent = 0;
                            this.draggedElement.inBlockContent = 0;
                            // In Chrome, if you don't put a small delay in the drag, it may fail
                            setTimeout(() => {
                                if (this.draggedElement) {
                                    // Add class dragging
                                    ideviceContent.classList.add('dragging');
                                    // Remove class dragging start
                                    element.classList.remove('dragging-start');
                                }
                            }, 10);
                        }
                    }
                });
        });
    }

    /**
     * Add event drag end to idevice element
     *
     */
    addEventDragEndToContentIdevice(element) {
        element.addEventListener('dragend', (event) => {
            event.stopPropagation();
            if (this.draggedElement) {
                this.structureMenuList =
                    this.project.app.menus.menuStructure.menuStructureCompose.menuNavList;
                let menuPageDownIdevice = this.structureMenuList.querySelector(
                    '.idevice-content-over'
                );
                // Drop into Menu Structure Page
                if (menuPageDownIdevice) {
                    this.dragEndIdeviceInStructureMenu(menuPageDownIdevice);
                }
                // Drop out
                else {
                    this.dragEndIdeviceOutOffContainer();
                }
            }
        });
    }

    /**
     * DragEnd Idevice
     * The idevice ends the drag over into a node of the structure
     *
     */
    dragEndIdeviceInStructureMenu(pageNodeElement) {
        let pageId = pageNodeElement.parentNode.getAttribute('nav-id');
        let destinationOdePageId =
            pageNodeElement.parentNode.getAttribute('page-id');
        let ideviceNode = this.getIdeviceById(
            this.draggedElement.getAttribute('idevice-id')
        );
        let ideviceNodePreviousPageId = ideviceNode.odeNavStructureSyncId;
        let ideviceNodeBlockId = ideviceNode.blockId;
        let ideviceNodePreviousOrder = ideviceNode.order;
        let blockNode = this.getBlockById(ideviceNodeBlockId);
        let blockNodePreviousOdePageId = blockNode.pageId;
        // Move idevice to new page
        if (
            pageId &&
            ideviceNode &&
            ideviceNode.odeNavStructureSyncId != pageId
        ) {
            // Remove dragged element
            this.resetDragElement(true);
            this.resetDragOverClasses();
            // Update page in database
            ideviceNode.apiUpdatePage(pageId).then((response) => {
                this.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    null,
                    ideviceNode.odeIdeviceId,
                    'MOVE_TO_PAGE',
                    destinationOdePageId
                );
                // Send operation log action to bbdd
                let additionalData = {
                    previousPageId: ideviceNodePreviousPageId,
                    newPageId: pageId,
                    blockId: ideviceNodeBlockId,
                    odeIdeviceId: ideviceNode.odeIdeviceId,
                    previousOrder: ideviceNodePreviousOrder,
                };
                eXeLearning.app.project.sendOdeOperationLog(
                    blockNodePreviousOdePageId,
                    destinationOdePageId,
                    'MOVE_IDEVICE_TO',
                    additionalData
                );
            });
        }
        // The idevice page has not been updated
        else {
            // Reset idevice content
            this.dragEndIdeviceOutOffContainer();
        }
        // Clear menu structure classes
        this.project.app.project.structure.menuStructureBehaviour.clearMenuNavDragOverClasses();
    }

    /**
     * DragEnd Idevice
     * The idevice ends the drag over outside element that we must take into account
     *
     */
    dragEndIdeviceOutOffContainer() {
        let ideviceNode = this.getIdeviceById(
            this.draggedElement.getAttribute('idevice-id')
        );
        // Remove dragged element
        this.resetDragElement(true);
        this.resetDragOverClasses();
        // Reset idevice content
        ideviceNode.makeIdeviceContentNode(false);
        setTimeout(() => {
            ideviceNode.ideviceContent.classList.remove('dragging');
        }, 10);
        setTimeout(() => {
            ideviceNode.ideviceContent.classList.remove('dragging');
        }, 10);
        // We add the class to generate movement effect
        ideviceNode.ideviceContent.classList.add('moving');
        setTimeout(() => {
            ideviceNode.ideviceContent.classList.remove('moving');
        }, this.movingClassDuration);
    }

    /**
     * Action when dropping an idevice from the content on the content
     *
     * @param {*} container
     */
    async dropIdeviceContentInContent(container) {
        // Check if current page is document root
        if (
            this.project.app.project.structure.nodeSelected.getAttribute(
                'nav-id'
            ) == 'root'
        )
            return false;
        // Check if container is valid for element
        if (this.isDragableInside(this.draggedElement, container)) {
            let ideviceNode = this.getIdeviceById(
                this.draggedElement.getAttribute('idevice-id')
            );
            if (ideviceNode) {
                let ideviceNodePreviousBlockId = ideviceNode.blockId;
                let idevicePreviousOrder = ideviceNode.order;
                // Add idevice content to container (main container or block)
                this.addIdeviceNodeToContainer(ideviceNode, container);
                // Add idevice to components list in case there isn't
                if (!this.getIdeviceById(ideviceNode.odeIdeviceId)) {
                    this.addIdeviceToComponentsList(
                        ideviceNode,
                        ideviceNode.blockId
                    );
                }
                // Remove dragging class
                setTimeout(() => {
                    ideviceNode.ideviceContent.classList.remove('dragging');
                }, 10);
                setTimeout(() => {
                    ideviceNode.ideviceButtons.classList.remove('dragging');
                }, 10);
                // Remove dragged element
                this.resetDragElement(true);
                this.resetDragOverClasses();
                // We add the class to generate movement effect
                ideviceNode.ideviceContent.classList.add('moving');
                // Update the order of the idevice (change the parent block if necessary)
                ideviceNode.apiUpdateBlock().then((response) => {
                    setTimeout(() => {
                        ideviceNode.ideviceContent.classList.remove('moving');
                    }, this.movingClassDuration);
                    // Send operation log action to bbdd
                    let additionalData = {
                        blockId: ideviceNodePreviousBlockId,
                        odeIdeviceId: ideviceNode.odeIdeviceId,
                        previousOrder: idevicePreviousOrder,
                    };
                    let ideviceNodePageId =
                        this.project.app.project.structure.nodeSelected.getAttribute(
                            'page-id'
                        );
                    eXeLearning.app.project.sendOdeOperationLog(
                        ideviceNodePageId,
                        ideviceNodePageId,
                        'MOVE_IDEVICE_ON',
                        additionalData
                    );
                });
            }
        }
    }

    /*********************************
     * EVENTS DRAG & DROP CONTENT BLOCKS  */

    /**
     * Add event drag start to block element
     *
     */
    addEventDragStartToContentBlock(element) {
        element.addEventListener('dragstart', (event) => {
            if (eXeLearning.app.project.checkOpenIdevice()) {
                event.preventDefault();
                return;
            }
            event.stopPropagation();
            this.clearSelection();
            let blockContent = element.parentNode;
            let blockNode = this.getBlockById(blockContent.id);
            if (!blockNode) return;
            // Set dragged element
            this.draggedElement = element;
            // Check odeComponent flag
            eXeLearning.app.project
                .isAvalaibleOdeComponent(blockNode.blockId, null)
                .then((response) => {
                    if (
                        response.responseMessage == 'OK' &&
                        this.draggedElement
                    ) {
                        if (blockContent.getAttribute('mode') == 'export') {
                            // Add class dragging
                            element.classList.add('dragging-start');
                            // Dragged element
                            this.draggedElement.inNodeContent = 0;
                            // In Chrome, if you don't put a small delay in the drag, it may fail
                            setTimeout(() => {
                                if (this.draggedElement) {
                                    // Add class dragging
                                    element.classList.add('dragging');
                                    element.classList.add('dragging-start');
                                    // Move box-head out of box
                                    this.nodeContentElement.insertBefore(
                                        element,
                                        blockContent
                                    );
                                    this.nodeContentElement.insertBefore(
                                        blockContent,
                                        element
                                    );
                                    // Add class dragging
                                    blockContent.classList.add('dragging');
                                    // Toggle off block content
                                    if (
                                        !blockContent.classList.contains(
                                            'hidden-idevices'
                                        )
                                    ) {
                                        if (this.draggedElement)
                                            this.draggedElement.toggle = true;
                                        blockNode.toggleOff();
                                    }
                                    // Remove class dragging-start
                                    element.classList.remove('dragging-start');
                                }
                            }, 10);
                        }
                    }
                });
        });
    }

    /**
     * Add event drag end to block element
     *
     */
    addEventDragEndToContentBlock(element) {
        element.addEventListener('dragend', (event) => {
            event.stopPropagation();
            if (this.draggedElement) {
                this.structureMenuList =
                    this.project.app.menus.menuStructure.menuStructureCompose.menuNavList;
                let menuPageDownBlock = this.structureMenuList.querySelector(
                    '.block-content-over'
                );
                // Drop into Menu Structure Page
                if (menuPageDownBlock) {
                    this.dragEndBlockInStructureMenu(menuPageDownBlock);
                }
                // Drop out
                else {
                    // Reset block content
                    this.dragEndBlockOutOffContainer();
                }
                // Clear menu structure classes
                this.project.app.project.structure.menuStructureBehaviour.clearMenuNavDragOverClasses();
            }
        });
    }

    /**
     * DragEnd Block
     * The block ends the drag over into a node of the structure
     *
     */
    dragEndBlockInStructureMenu(pageNodeElement) {
        let pageId = pageNodeElement.parentNode.getAttribute('nav-id');
        let destinationOdePageId =
            pageNodeElement.parentNode.getAttribute('page-id');
        let blockNode = this.getBlockById(
            this.draggedElement.getAttribute('block-id')
        );
        let blockNodePreviousPageId = blockNode.odeNavStructureSyncId;
        let blockNodePreviousOdePageId = blockNode.pageId;
        let blockNodePreviousOder = blockNode.order;
        // Move block to new page
        if (pageId && blockNode && pageId != blockNode.odeNavStructureSyncId) {
            // Reset dragged element
            this.resetDragElement(true);
            this.resetDragOverClasses();
            // Update page in database
            blockNode.apiUpdatePage(pageId).then((response) => {
                this.project.updateCurrentOdeUsersUpdateFlag(
                    false,
                    null,
                    blockNode.blockId,
                    null,
                    'MOVE_TO_PAGE',
                    destinationOdePageId
                );
                // Send operation log action to bbdd
                let additionalData = {
                    previousPageId: blockNodePreviousPageId,
                    newPageId: pageId,
                    blockId: blockNode.blockId,
                    previousOrder: blockNodePreviousOder,
                };
                eXeLearning.app.project.sendOdeOperationLog(
                    blockNodePreviousOdePageId,
                    destinationOdePageId,
                    'MOVE_BLOCK_TO',
                    additionalData
                );
            });
        }
        // The block page has not been updated
        else {
            this.dragEndBlockOutOffContainer();
        }
    }

    /**
     * DragEnd Block
     * The block ends the drag over outside element that we must take into account
     *
     */
    dragEndBlockOutOffContainer() {
        let blockNode = this.getBlockById(
            this.draggedElement.getAttribute('block-id')
        );
        if (blockNode) {
            // Move box-head inside of block position
            if (blockNode.headElement.parentNode != blockNode.blockContent) {
                blockNode.blockContent.prepend(blockNode.headElement);
            }
            // Remove dragging class
            setTimeout(() => {
                blockNode.blockContent.classList.remove('dragging');
            }, 10);
            setTimeout(() => {
                blockNode.headElement.classList.remove('dragging');
            }, 10);
            setTimeout(() => {
                blockNode.headElement.classList.remove('dragging-start');
            }, 10);
            // We add the class to generate movement effect
            blockNode.blockContent.classList.add('moving');
            // Toggle On
            if (this.draggedElement.toggle) blockNode.toggleOn();
            // Reset dragged element
            this.resetDragElement();
            this.resetDragOverClasses();
            // Update order in database
            blockNode.apiUpdateOrder(true).then((response) => {
                setTimeout(() => {
                    blockNode.blockContent.classList.remove('moving');
                }, this.movingClassDuration);
            });
        }
    }

    /**
     * Action when dropping a block from the content on the content
     *
     * @param {*} container
     */
    async dropBlockContentInContent(container) {
        // Check if container is valid for element
        if (this.isDragableInside(this.draggedElement, container)) {
            let blockNode = this.getBlockById(
                this.draggedElement.getAttribute('block-id')
            );
            let previousOrder = blockNode.order;
            let blockNodePageId = blockNode.pageId;
            if (blockNode) {
                // Move block to box-head position and reset box-head position
                if (
                    blockNode.headElement.parentNode != blockNode.blockContent
                ) {
                    this.nodeContentElement.insertBefore(
                        blockNode.blockContent,
                        blockNode.headElement
                    );
                    blockNode.blockContent.prepend(blockNode.headElement);
                }
                // Remove dragging class
                setTimeout(() => {
                    blockNode.blockContent.classList.remove('dragging');
                }, 10);
                setTimeout(() => {
                    blockNode.headElement.classList.remove('dragging');
                }, 10);
                // We add the class to generate movement effect
                blockNode.blockContent.classList.add('moving');
                // Toggle On
                if (this.draggedElement.toggle) blockNode.toggleOn();
                // Reset dragged element
                this.resetDragElement();
                this.resetDragOverClasses();
                // Update order in database
                blockNode.apiUpdateOrder(true).then((response) => {
                    setTimeout(() => {
                        blockNode.blockContent.classList.remove('moving');
                    }, this.movingClassDuration);
                    // Send operation log action to bbdd
                    let additionalData = {
                        blockId: blockNode.blockId,
                        previousOrder: previousOrder,
                    };
                    eXeLearning.app.project.sendOdeOperationLog(
                        blockNodePageId,
                        blockNodePageId,
                        'MOVE_BLOCK_ON',
                        additionalData
                    );
                });
            }
        }
    }

    /*********************************
     * DRAG & DROP AUX  */

    /**
     *
     * @param {*} remove
     */
    resetDragElement(remove) {
        if (this.draggedElement) {
            // Classes of dragged element
            this.draggedElement.classList.remove('in');
            this.draggedElement.classList.remove('out');
            // Remove dragged element
            if (remove) this.draggedElement.remove();
            this.draggedElement = null;
        }
    }

    /**
     *
     */
    resetDragOverClasses() {
        // Classes of containers
        this.nodeContentElement.classList.remove('component-inside');
        this.components.blocks.forEach((block) => {
            block.blockContent.classList.remove('component-inside');
        });
        this.project.app.project.structure.menuStructureBehaviour.createAddTextBtn();
    }

    /**
     * checks if an element can be moved inside container
     *
     * @param {*} element
     * @param {*} container
     */
    isDragableInside(element, container) {
        if (element && container && element != container) {
            // In case the dragged element and the container are both boxes, it is not allowed to drop
            if (
                !(
                    element.classList.contains('box-head') &&
                    container.classList.contains('box')
                )
            ) {
                let dragElementType = element.getAttribute('drag');
                let dropListContainer = [];
                if (container.getAttribute('drop')) {
                    dropListContainer = JSON.parse(
                        container.getAttribute('drop')
                    );
                }
                // Only if the attribute is equal is the element allowed to be dropped in the container
                if (dropListContainer.includes(dragElementType)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Gets the element after the current one
     *
     * @param {*} y
     * @param {*} draggableElementsContent
     */
    getDragAfterElement(ypos, draggableElementsContent) {
        return draggableElementsContent.reduce(
            (closest, child) => {
                let block = child.getBoundingClientRect();
                let offset = ypos - block.top;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            },
            { offset: Number.NEGATIVE_INFINITY }
        ).element;
    }

    /*******************************************************************************
     * COMPONENTS CREATION
     *******************************************************************************/

    /**
     * Add event click to idevices menu elements
     *
     */
    addEventClickIdevice() {
        this.menuIdevicesDraggableElements.forEach((element) => {
            element.addEventListener('click', async (event) => {
                if (this.clickIdeviceMenuEnabled) {
                    let ideviceData = { odeIdeviceTypeName: element.id };
                    let ideviceNode = await this.createIdeviceInContent(
                        ideviceData,
                        this.nodeContentElement
                    );
                    // Send operation log action to bbdd
                    let additionalData = {};
                    eXeLearning.app.project.sendOdeOperationLog(
                        null,
                        ideviceNode.blockId,
                        'ADD_IDEVICE',
                        additionalData
                    );
                    this.clickIdeviceMenuEnabled = false;
                    setTimeout(() => {
                        this.clickIdeviceMenuEnabled = true;
                    }, this.intervalTime);
                }
            });
        });
    }

    /**
     *
     * @param {*} originalBlock
     * @param {*} cloneBlockData
     */
    async cloneBlockInContent(originalBlock, cloneBlockData) {
        // Reload page
        let loadOk = await this.loadApiIdevicesInPage(true);
        if (loadOk) {
            let cloneBlockNode = this.getBlockById(cloneBlockData.blockId);
            // Move screen view to clone block
            cloneBlockNode.goWindowToBlock(100);
            // Moving effect
            cloneBlockNode.blockContent.classList.add('moving');
            setTimeout(
                () => {
                    cloneBlockNode.blockContent.classList.remove('moving');
                },
                this.movingClassDuration * 2 +
                    5 * this.components.idevices.length
            );
        }
    }

    /**
     *
     * @param {*} originalIdevice
     * @param {*} cloneIdeviceData
     */
    async cloneIdeviceInContent(originalIdevice, cloneIdeviceData) {
        // Get block content
        let blockNode = this.getBlockById(cloneIdeviceData.blockId);
        let blockContent = blockNode.blockContent;
        // Get new idevice data
        cloneIdeviceData.mode = 'export';
        cloneIdeviceData.loading = true;
        // Create and append new idevice in block
        let cloneIdeviceNode = await this.createIdeviceInContent(
            cloneIdeviceData,
            blockContent
        );
        // Move
        blockContent.insertBefore(
            cloneIdeviceNode.ideviceContent,
            originalIdevice.ideviceContent.nextSibling
        );
        // Move screen view to clone idevice
        cloneIdeviceNode.resetWindowHash();
        cloneIdeviceNode.goWindowToIdevice(100);
        // Reset components view
        this.resetCurrentIdevicesExportView([cloneIdeviceNode.id]);
        // Moving effect
        cloneIdeviceNode.ideviceContent.classList.add('moving');
        setTimeout(() => {
            cloneIdeviceNode.ideviceContent.classList.remove('moving');
        }, this.movingClassDuration * 2);
    }

    /**
     *  Create idevice in container and set behaviour
     *
     * @param {*} ideviceData
     * @param {*} container
     * @returns
     */
    async createIdeviceInContent(ideviceData, container, ideviceOnEdit = null) {
        // Check if current page is document root
        if (container.getAttribute('node-selected') == 'root') {
            eXeLearning.app.modals.alert.show({
                title: _('Problem adding iDevice'),
                body: _("You can't add an iDevice on the root page"),
            });
            return false;
        }

        if (
            container.querySelector('div.idevice_node[mode="edition"]') !== null
        ) {
            eXeLearning.app.modals.alert.show({
                title: _('Info'),
                body: _(
                    'You are currently editing another iDevice. Please close it before continuing'
                ),
            });
            return false;
        }

        // Hide the user instructions
        $('#eXeAddContentInstructions').remove();

        // New idevice node
        let ideviceNode = await this.newIdeviceNode(ideviceData, ideviceOnEdit);
        // Check if the component was able to load successfully
        if (ideviceNode) {
            // Add and initialize the idevice
            this.addIdeviceNodeToContainer(ideviceNode, container);
            await ideviceNode.loadInitScriptIdevice(ideviceNode.mode);
            // If the idevice is in edit mode, the engine is changed to edit mode
            if (ideviceNode.mode == 'edition') {
                this.updateMode();
            }
        }
        return ideviceNode;
    }

    /**
     * Insert HTML of idevice into node-content
     *
     * @param {*} ideviceNode
     * @param {*} container
     */
    addIdeviceNodeToContainer(ideviceNode, container) {
        let ideviceNodeContent;
        // In case the idevice already exists
        if (ideviceNode.ideviceContent) {
            // Regenerate the idevice buttons
            ideviceNode.ideviceContent.append(
                ideviceNode.makeIdeviceButtonsElement()
            );
            ideviceNodeContent = ideviceNode.ideviceContent;
        } else {
            ideviceNodeContent = ideviceNode.makeIdeviceContentNode(true);
        }
        // Append idevice content into container
        if (container.id == 'node-content') {
            // It is necessary to add a block and idevice inside
            let iconName = ''; // The icons of the idevices will not be shown in the content
            let blockData = { iconName, blockName: ideviceNode.idevice.title };
            // Generate new block
            let ideviceBlockNode = this.newBlockNode(blockData, true);
            let ideviceBlockNodeContent = ideviceBlockNode.blockContent;
            ideviceBlockNodeContent.append(ideviceNodeContent);
            // Set block data to idevice
            this.setBlockDataToIdeviceNode(ideviceNode, ideviceBlockNode);
            // Insert block into node content
            container.insertBefore(
                ideviceBlockNodeContent,
                this.draggedElement
            );
        } else {
            // Add only the idevice
            let ideviceBlockNode = this.getBlockById(container.id);
            if (ideviceBlockNode) {
                if (ideviceNode.mode == 'edition') {
                    ideviceBlockNode.toggleOn();
                }
                // Set block ids
                this.setBlockDataToIdeviceNode(ideviceNode, ideviceBlockNode);
                // Insert idevice into block
                container.insertBefore(ideviceNodeContent, this.draggedElement);
            }
        }
        // Move window to idevice element
        if (ideviceNode.mode == 'edition') {
            // Set true Component flag
            eXeLearning.app.project.changeUserFlagOnEdit(
                true,
                this.project.app.project.structure.nodeSelected.getAttribute(
                    'nav-id'
                ),
                ideviceNode.blockId,
                ideviceNode.ideviceContent.id
            );
            ideviceNode.goWindowToIdevice();
        }
    }

    /**
     * Make and get new block element
     *
     * @returns {Object}
     * @returns {Boolean}
     *    true: Add the block to the component list
     *    false: Does not add the block to the component list
     */
    newBlockNode(blockData, addToComponents) {
        let ideviceBlockNode = new IdeviceBlockNode(this, blockData);
        let ideviceBlockContent =
            ideviceBlockNode.generateBlockContentNode(true);
        // Add events to make the block work as a container
        this.addEventDragEnterToContainer(ideviceBlockContent);
        this.addEventDragLeaveToContainer(ideviceBlockContent);
        this.addEventDropToContainer(ideviceBlockContent);
        this.addEventDragOverToContainer(ideviceBlockContent);
        // Add block to components list
        if (addToComponents) this.components.blocks.push(ideviceBlockNode);
        return ideviceBlockNode;
    }

    /**
     * Make and get new idevice content class
     *
     * @param {Array} ideviceData
     *
     * @returns class
     */
    async newIdeviceNode(ideviceData, ideviceOnEdit = null) {
        let appendNewIdeviceSuccess = false;
        let ideviceNode = new IdeviceNode(this, ideviceData);
        // We check if the idevice is valid
        appendNewIdeviceSuccess = await this.appendNewIdeviceProcess(
            ideviceNode,
            ideviceOnEdit
        );
        // We check if the idevice could be correctly added to the content
        if (appendNewIdeviceSuccess) {
            return ideviceNode;
        } else {
            setTimeout(() => {
                if (!this.project.app.modals.alert.modal._isShown) {
                    let IdeviceErrorTitle = _('iDevice error');
                    IdeviceErrorTitle += ideviceNode.odeIdeviceTypeName
                        ? ` (${ideviceNode.odeIdeviceTypeName})`
                        : '';
                    this.project.app.modals.alert.show({
                        title: IdeviceErrorTitle,
                        body: _('An error occurred while loading the iDevice.'),
                        contentId: 'error',
                    });
                }
            }, 500);
            return false;
        }
    }

    /**
     * Save idevices in edition mode and add new idevice to components list
     *
     * @param {*} ideviceNode
     */
    async appendNewIdeviceProcess(ideviceNode, ideviceOnEdit = null) {
        let saveIdevicesSuccess = await this.saveEditionIdevices(ideviceOnEdit);
        if (saveIdevicesSuccess) {
            this.components.idevices.push(ideviceNode);
        }
        return saveIdevicesSuccess;
    }

    /*******************************************************************************
     * COMPONENTS VIEW
     *******************************************************************************/

    /**
     * Reload export view of idevices
     *
     * @param {*} exceptionsIds
     */
    async resetCurrentIdevicesExportView(exceptionsIds) {
        // Remove scripts/styles tags
        this.clearNeedlessScripts();
        // Load styles of idevices
        await this.loadIdevicesExportStyles();
        // Reload body of components
        this.components.idevices.forEach(async (idevice) => {
            if (!exceptionsIds.includes(idevice.id)) {
                // Reload export html
                await idevice.generateContentExportView();
            }
        });
        // Load scripts of idevices
        this.loadIdevicesExportScripts();
        // Load legacy functions
        this.loadLegacyExeFunctionalitiesExport();
        // Resets the "loading" attribute for the display effect
        setTimeout(() => {
            this.components.idevices.forEach((idevice) => {
                idevice.ideviceContent.setAttribute('loading', false);
            });
        }, 500);
    }

    /**
     * Load all components of current page
     *
     * @param {Boolean} loadScreen sets whether to show the loading screen
     * @param {Node} pageElement
     * @returns {Boolean}
     */
    async loadApiIdevicesInPage(loadScreen, pageElement) {
        if (this.loadingPage) return false;
        this.loadingPage = true;
        // Save idevices, clean node content and load components
        let loadedComponents = await this.cleanNodeAndLoadPage(
            loadScreen,
            pageElement
        );
        return loadedComponents;
    }

    /**
     * Save idevices and clean node content
     *
     * @param {*} loadScreen
     * @param {*} pageElement
     * @returns
     */
    async cleanNodeAndLoadPage(loadScreen, pageElement) {
        let saveIdevicesOk,
            loadedComponents = false;
        // Get pageId
        let idNode;
        if (pageElement) {
            idNode = pageElement.getAttribute('nav-id');
        } else {
            if (this.project.app.project.structure.nodeSelected) {
                idNode =
                    this.project.app.project.structure.nodeSelected.getAttribute(
                        'nav-id'
                    );
            } else {
                idNode = false;
            }
        }
        // Save iDevices
        saveIdevicesOk = await this.cleanNodeContent();
        // Load components
        loadedComponents = await this.loadingComponentsProcess(
            saveIdevicesOk,
            pageElement,
            loadScreen
        );
        // Load page theme template
        this.loadThemePageTemplate(idNode);

        return loadedComponents;
    }

    /**
     * Load page template if required
     *
     * @param {*} idNode
     */
    loadThemePageTemplate(idNode) {
        let templatePageContainerElement, templatePageContentElement;
        // Reset template
        this.resetNodeTemplate();
        // Get template
        let themeSelected = eXeLearning.app.themes.selected;
        if (!themeSelected) return;
        let themeTemplatePage = themeSelected.getPageTemplateElement();
        let templatePageClass = themeSelected.templatePageClass;
        // Load template
        if (idNode && idNode != 'root' && themeTemplatePage) {
            if (
                this.nodeContentElement.parentNode &&
                this.nodeContentElement.parentNode == this.nodeContainerElement
            ) {
                // Create a new page element that will contain the current content
                templatePageContainerElement = themeTemplatePage;
                templatePageContentElement =
                    templatePageContainerElement.querySelector(
                        `.${templatePageClass}`
                    );
                templatePageContentElement.append(this.nodeContentElement);
                this.nodeContainerElement.append(templatePageContainerElement);
            }
        }
    }

    /**
     * Remove page template
     *
     */
    resetNodeTemplate() {
        let themeSelected = eXeLearning.app.themes.selected;
        let templatePageContainerClass =
            themeSelected.templatePageContainerClass;
        if (
            this.nodeContentElement.parentNode &&
            this.nodeContentElement.parentNode != this.nodeContainerElement
        ) {
            this.nodeContainerElement.append(this.nodeContentElement);
            let templatePageContainerElement =
                this.nodeContainerElement.querySelector(
                    `.${templatePageContainerClass}`
                );
            if (templatePageContainerElement)
                templatePageContainerElement.remove();
        }
    }

    /**
     * Remove page template
     *
     */
    resetThemePageTemplate() {
        let pageContentTemplate = this.workareaElement.querySelector(
            '.page-content-template'
        );
        if (pageContentTemplate) {
            this.workareaElement.append(this.nodeContentElement);
            pageContentTemplate.remove();
        }
    }

    /**
     * Get page id and load components
     *
     * @param {*} saveIdevicesOk
     * @param {*} pageElement
     * @param {*} loadScreen loadScreen sets whether to show the loading screen
     */
    async loadingComponentsProcess(saveIdevicesOk, pageElement, loadScreen) {
        let loaded = false;
        if (saveIdevicesOk) {
            // Get components of new selected node
            let idNode;
            if (pageElement) {
                idNode = pageElement.getAttribute('nav-id');
            } else {
                if (this.project.app.project.structure.nodeSelected) {
                    idNode =
                        this.project.app.project.structure.nodeSelected.getAttribute(
                            'nav-id'
                        );
                } else {
                    idNode = false;
                }
            }
            // Show loading screen
            if (loadScreen) this.showNodeContainerLoadScreen();
            // Load components in page
            loaded = await this.loadApiComponentsInContentByPage(idNode);
        }
        this.loadingPage = false;
        return loaded;
    }

    /**
     * Add all compontents to page and and initializes them
     *
     * @param {*} idPage
     */
    async loadApiComponentsInContentByPage(idPage) {
        // Remove node content title
        this.removeNodeContentPageTitle();
        // Remove node content attribute lang
        this.removeNodeContentLangAttribute();
        // In case it is the root node
        if (idPage) {
            if (idPage == 'root') {
                // Remove node content header
                this.removeNodeContentHeader();
                // Load root node
                await this.getAndLoadComponentsRootNode(idPage);
                return true;
            } else {
                // Load node
                let loaded = await this.getAndLoadComponentsPageNode(idPage);
                return loaded;
            }
        } else {
            return false;
        }
    }

    /**
     * Load root node
     *
     * @param {*} idPage
     */
    async getAndLoadComponentsRootNode(idPage) {
        let data = await this.project.app.api.getComponentsByPage(idPage);
        // Show ode properties form
        this.project.properties.formProperties.show();
        // Hide load screen
        this.hideNodeContainerLoadScreen(500);
    }

    /**
     * Get and load page components
     *
     * @param {*} idPage
     * @returns
     */
    async getAndLoadComponentsPageNode(idPage) {
        // Remove node content form properties
        this.removeNodeContentFormProperties();
        // Get page components data
        let data = await this.project.app.api.getComponentsByPage(idPage);
        if (data && data.odePagStructureSyncs) {
            // Load components in page content
            await this.loadComponentsPage(data.odePagStructureSyncs);
            // Load idevices styles files
            await this.loadIdevicesExportStyles();
            // Load idevices script files
            this.loadIdevicesExportScripts();
            // Set parents and children (blocks and idevices)
            this.setParentsAndChildrenIdevicesBlocks();
            // Promise to delay content loading
            let promise = new Promise((resolve, reject) => {
                setTimeout(
                    () => {
                        // Hide load screen
                        this.hideNodeContainerLoadScreen(500);
                        this.removeClassLoadingBlocks();
                        // Load legacy functions
                        this.loadLegacyExeFunctionalitiesExport();
                        // Enable internal links
                        this.enableInternalLinks();
                        // Set header
                        this.setNodeContentHeader();
                        // Set page title
                        this.setNodeContentPageTitle(
                            data.odeNavStructureSyncProperties
                        );
                        // Resolve
                        resolve(true);
                    },
                    100 + 10 * this.components.idevices.length
                );
            });
            return promise;
        }
        return false;
    }

    /**
     * Set header in node content
     *
     */
    setNodeContentHeader() {
        let headerElement = this.nodeContainerElement.querySelector(
            '#header-node-content'
        );
        headerElement.innerHTML = '';
        if (headerElement) {
            let theme = eXeLearning.app.themes.selected;
            if (theme.logoImg) {
                let logoImgContainer = document.createElement('div');
                logoImgContainer.classList.add('logo-img-container');
                logoImgContainer.style.backgroundImage = `url("${theme.getLogoImgUrl()}?v=${Date.now()}")`;
                headerElement.append(logoImgContainer);
            }
            if (theme.headerImg) {
                let headerImgContainer = document.createElement('div');
                headerImgContainer.classList.add('header-img-container');
                headerImgContainer.style.backgroundImage = `url("${theme.getHeaderImgUrl()}?v=${Date.now()}")`;
                headerElement.append(headerImgContainer);
            }
            if (theme.headerImg || theme.logoImg) {
                headerElement.classList.remove('hidden');
            } else {
                headerElement.classList.add('hidden');
            }
        }
    }

    /**
     * Set page title in node content
     *
     */
    setNodeContentPageTitle(properties) {
        let pageTitleElement = this.nodeContainerElement.querySelector(
            '#page-title-node-content'
        );
        if (pageTitleElement) {
            if (
                properties &&
                properties.titlePage &&
                properties.titlePage.value != ''
            ) {
                pageTitleElement.innerText = properties.titlePage.value;
                pageTitleElement.classList.remove('hidden');
            }
            // Add case for empty value
            if (
                properties &&
                properties.titlePage &&
                properties.titlePage.value == ''
            ) {
                pageTitleElement.innerText = properties.titlePage.value;
                pageTitleElement.classList.add('hidden');
            }
        }
    }

    /**
     * Remove header in node content
     *
     */
    removeNodeContentHeader() {
        let headerElement = this.nodeContainerElement.querySelector(
            '#header-node-content'
        );
        headerElement.innerHTML = '';
        headerElement.classList.add('hidden');
    }

    /**
     * Remove page title in node content
     *
     */
    removeNodeContentPageTitle() {
        let pageTitleElement = this.nodeContainerElement.querySelector(
            '#page-title-node-content'
        );
        pageTitleElement.innerHTML = '';
        pageTitleElement.classList.add('hidden');
    }

    /**
     * Remove page lang attribute in node content
     *
     */
    removeNodeContentLangAttribute() {
        this.nodeContentElement.removeAttribute('lang');
    }

    /**
     * Remove form properties in node content
     *
     */
    removeNodeContentFormProperties() {
        let formProperties = this.nodeContentElement.querySelector(
            '#properties-node-content-form'
        );
        if (formProperties) formProperties.remove();
    }

    /**
     * Create components in page
     *
     * @param {Object} components
     */
    async loadComponentsPage(pagStructure) {
        // Load components
        pagStructure.forEach(async (block) => {
            // Create block
            let blockNode = this.newBlockNode(block, true);
            let blockContent = blockNode.blockContent;
            // Add class loading to block element
            blockContent.classList.add('loading');
            // Add block element to node container
            this.nodeContentElement.append(blockContent);
            // Load Idevices in block
            await block.odeComponentsSyncs.forEach(async (idevice) => {
                idevice.mode = 'export';
                let ideviceNode = await this.createIdeviceInContent(
                    idevice,
                    blockContent
                );
            });
        });
    }

    /**
     * Removes elements from content, scripts and temporary variables
     *
     * @returns boolean
     */
    async cleanNodeContent(force) {
        let saveOk = true;
        if (!force) saveOk = await this.saveEditionIdevices();
        if (saveOk) {
            // Remove scripts that are not needed by the application base
            this.clearNeedlessScripts();
            // Clear html of node_content
            this.nodeContentElement
                .querySelectorAll('.box.idevice-element-in-content')
                .forEach((boxElement) => {
                    boxElement.remove();
                });
            // Reset array compontents
            this.components.blocks = [];
            this.components.idevices = [];
            // Update engine mode
            this.updateMode();
        }
        return saveOk;
    }

    /**
     * Show page content loading screen
     *
     */
    showNodeContainerLoadScreen() {
        // Add class loading to node content load screen
        this.nodeContentLoadScreenElement.classList.add('loading');
        this.nodeContentLoadScreenElement.classList.remove('hidden');
        this.nodeContentLoadScreenElement.classList.remove('hiding');
        // Clear timeout loading screen
        if (this.hideNodeContanerLoadScreenTimeout) {
            clearTimeout(this.hideNodeContanerLoadScreenTimeout);
        }
    }

    /**
     * Hide page content loading screen
     *
     */
    hideNodeContainerLoadScreen(ms) {
        this.nodeContentLoadScreenElement.classList.add('hiding');
        this.nodeContentLoadScreenElement.classList.remove('loading');
        this.hideNodeContanerLoadScreenTimeout = setTimeout(() => {
            this.nodeContentLoadScreenElement.classList.add('hidden');
            this.nodeContentLoadScreenElement.classList.remove('hiding');
        }, ms);
    }

    /**
     * Removes the class from the blocks that indicates they were being loaded
     *
     */
    removeClassLoadingBlocks() {
        this.components.blocks.forEach((block) => {
            block.removeClassLoading();
        });
    }

    /**
     * Force saving idevices in edit mode
     *
     * @returns boolean
     */
    async saveEditionIdevices(ideviceOnEdit = null) {
        var saveIdevicesSuccess = true;
        if (!ideviceOnEdit) {
            this.components.idevices.forEach((idevice) => {
                if (idevice.mode == 'edition') {
                    if (idevice.loading) {
                        idevice.remove();
                    } else {
                        let saveOk = idevice.save();
                        saveIdevicesSuccess = saveOk;
                    }
                }
            });
        }

        return saveIdevicesSuccess;
    }

    /**
     * Update mode of node_container depending on the mode of the idevices
     * - edition: At least one idevice is being edited
     * - view: No idevice is being edited
     *
     */
    updateMode() {
        let ideviceEdition = this.isIdeviceInEdition();
        if (ideviceEdition) {
            this.mode = 'edition';
        } else {
            this.mode = 'view';
        }
        this.nodeContentElement.setAttribute('mode', this.mode);
    }

    /*******************************************************************************
     * COMPONENTS LIST
     *******************************************************************************/

    /**
     * Check if any idevice is in edit mode
     *
     * @returns {Object}
     */
    isIdeviceInEdition() {
        let inEdition = false;
        this.components.idevices.forEach((idevice) => {
            if (idevice.mode == 'edition') {
                inEdition = idevice;
            }
        });
        return inEdition;
    }

    /**
     * Get the idevice being edited
     *
     * @returns
     */
    getIdeviceActive() {
        return this.ideviceActive;
    }

    /**
     * Get the idevice from the 20 character id
     *
     * @param {String} id
     * @returns {Object}
     */
    getIdeviceById(id) {
        var ideviceReturn = null;
        this.components.idevices.forEach((idevice) => {
            if (idevice.odeIdeviceId == id) {
                ideviceReturn = idevice;
            }
        });
        return ideviceReturn;
    }

    /**
     * Get the block from the 20 character id
     *
     * @param {String} id
     * @returns {Object}
     */
    getBlockById(id) {
        var blockReturn = null;
        this.components.blocks.forEach((idevice) => {
            if (idevice.blockId == id) {
                blockReturn = idevice;
            }
        });
        return blockReturn;
    }

    /**
     * Add idevice to components list and block idevices list
     *
     * @param {*} idevice
     * @param {*} idBlock
     */
    addIdeviceToComponentsList(idevice, idBlock) {
        this.components.idevices.push(idevice);
        let block;
        if ((block = this.getBlockById(idBlock))) {
            block.idevices.push(idevice);
        }
    }

    /**
     * Remove idevice in components list
     *
     * @param {*} id
     */
    removeIdeviceOfComponentList(id) {
        this.components.idevices = this.components.idevices.filter(
            (idevice, index, arr) => {
                return idevice.id != id;
            }
        );
    }

    /**
     * Remove block in components list
     *
     * @param {*} id
     */
    removeBlockOfComponentList(id) {
        // Create a button to add a Text iDevice
        this.project.app.project.structure.menuStructureBehaviour.createAddTextBtn();
        this.components.blocks = this.components.blocks.filter(
            (block, index, arr) => {
                return block.id != id;
            }
        );
    }

    /**
     * Go through the list of components to assign the idevices to their respective blocks
     *
     */
    setParentsAndChildrenIdevicesBlocks(checkEmptyBlock) {
        this.components.blocks.forEach((block) => {
            block.idevices = [];
        });
        this.components.idevices.forEach((idevice) => {
            let block = this.getBlockById(idevice.blockId);
            if (block) {
                block.idevices.push(idevice);
            }
        });
        // Check empty blocks if required
        if (checkEmptyBlock) {
            this.components.blocks.forEach((block) => {
                // Delete or ask if they want to delete the block
                if (block.idevices.length == 0) {
                    if (block.removeIfEmpty) {
                        block.remove(true);
                    } else if (block.askForRemoveIfEmpty) {
                        setTimeout(() => {
                            eXeLearning.app.modals.confirm.show({
                                title: _('Delete box'),
                                body: _(
                                    'The box is empty. Do you want to delete it?'
                                ),
                                confirmButtonText: _('Yes'),
                                confirmExec: () => {
                                    block.remove(true);
                                },
                            });
                        }, 300);
                    }
                }
            });
        }
    }

    /*******************************************************************************
     * UPDATE COMPONENTS PARAMS
     *******************************************************************************/

    /**
     * Update the parameters of the current blocks based on the parameters passed in the array objects
     *
     * @param {*} idevices
     * @param {*} params
     */
    updateComponentsBlocks(blocks, params) {
        for (let [id, block] of Object.entries(blocks)) {
            let currentBlock = this.getBlockById(block.blockId);
            if (currentBlock) {
                params.forEach((paramName) => {
                    currentBlock.updateParam(paramName, block[paramName]);
                });
            }
        }
    }

    /**
     * Update the parameters of the current idevices based on the parameters passed in the array objects
     *
     * @param {*} idevices
     * @param {*} params
     */
    updateComponentsIdevices(idevices, params) {
        for (let [id, idevice] of Object.entries(idevices)) {
            let currentIdevice = this.getIdeviceById(idevice.odeIdeviceId);
            if (currentIdevice) {
                params.forEach((paramName) => {
                    currentIdevice.updateParam(paramName, idevice[paramName]);
                });
            }
        }
    }

    /**
     * Updates the idevice parameters based on the selected block
     *
     * @param {*} ideviceNode
     * @param {*} blockNode
     */
    setBlockDataToIdeviceNode(ideviceNode, blockNode) {
        ideviceNode.block = blockNode; // Block node
        ideviceNode.blockId = blockNode.blockId; // Block client id
        ideviceNode.odePagStructureSyncId = blockNode.id; // Block server id
        ideviceNode.odeNavStructureSyncId = blockNode.odeNavStructureSyncId; // Page id
    }

    /**
     * Indicates that the idevice is the one currently being edited
     *
     * @param {*} idevice
     */
    setIdeviceActive(idevice) {
        this.ideviceActive = idevice;
    }

    /**
     * Indicates that no idevice is being edited
     *
     * @returns
     */
    unsetIdeviceActive() {
        return this.setIdeviceActive(null);
    }

    /*******************************************************************************
     * SCRIPTS
     *******************************************************************************/

    /**
     * Imports the export scripts based on the different idevice types on the page
     *
     */
    loadIdevicesExportScripts() {
        // Unique idevices per page
        var idevicesPerPage = {};
        this.components.idevices.forEach((ideviceComponent) => {
            if (ideviceComponent.idevice) {
                idevicesPerPage[ideviceComponent.idevice.id] =
                    ideviceComponent.idevice;
            }
        });
        // Load styles and script by unique idevice
        for (let [id, idevice] of Object.entries(idevicesPerPage)) {
            idevice.loadScriptsExport();
        }
    }

    /**
     * Imports the export styles based on the different idevice types on the page
     *
     */
    async loadIdevicesExportStyles() {
        // Unique idevices per page
        var idevicesPerPage = {};
        this.components.idevices.forEach((ideviceComponent) => {
            if (ideviceComponent.idevice) {
                idevicesPerPage[ideviceComponent.idevice.id] =
                    ideviceComponent.idevice;
            }
        });
        // Load styles and script by unique idevice
        for (let [id, idevice] of Object.entries(idevicesPerPage)) {
            await idevice.loadStylesExport();
        }
    }

    /**
     * Execute script for different functionalities of eXe
     *
     */
    loadLegacyExeFunctionalitiesExport() {
        // Legacy $exe_effects object
        $exeFX.init();
        // Legacy $exe_games object
        $exeGames.init();
        // Legacy $exe_highlighter object
        $exeHighlighter.init();
        // Legacy $exeABCmusic object
        $exeABCmusic.init();
        // Legacy $exe object
        $exe.init();
    }

    /**
     * Enable internal links
     *
     */
    enableInternalLinks() {
        let eXeNodeLinks = document.querySelectorAll("a[href^='exe-node']");
        if (eXeNodeLinks.length > 0) {
            let pages = eXeLearning.app.project.structure.data;
            let buttonsPages = document.querySelectorAll(
                'span.nav-element-text'
            );

            eXeNodeLinks.forEach((link) => {
                let pageElement = null;
                let pageName = 'nopage';
                let pageId = link.href.replace('exe-node:', '');

                pages.forEach((page) => {
                    if (page.pageId === pageId) {
                        pageName = page.pageName;
                    }
                });

                buttonsPages.forEach((button) => {
                    if (button.innerText.includes(pageName)) {
                        pageElement = button;
                    }
                });

                if (pageElement) {
                    link.onclick = function (event) {
                        event.preventDefault();
                        pageElement.click();
                    };
                }
            });
        }
    }

    /**
     * Import a script to the page
     *
     * @param {*} path
     * @returns {Node}
     */
    loadScriptDynamically(path, newVersion) {
        let script = document.createElement('script');
        script.id = this.generateId();
        script.setAttribute('type', 'text/javascript');
        if (newVersion) {
            script.src = `${path}?t=${Date.now()}`;
        } else {
            script.src = path;
        }
        document.querySelector('head').append(script);
        this.onloadedScriptCallback(path, script, false);
        return script;
    }

    /**
     * Import a style to the page
     *
     * @param {*} path
     * @returns {Node}
     */
    loadStyleDynamically(path, newVersion) {
        let style = document.createElement('link');
        style.id = this.generateId();
        style.setAttribute('rel', 'stylesheet');
        if (newVersion) {
            style.href = `${path}?t=${Date.now()}`;
        } else {
            style.href = path;
        }
        document.querySelector('head').append(style);
        this.onloadedScriptCallback(path, style, false);
        return style;
    }

    /**
     * Import a style and inserting it in the page
     *
     * @param {*} path
     * @param {*} idevice
     * @param {*} status
     */
    async loadStyleByInsertingIt(path, idevice, status) {
        let style = document.createElement('style');
        style.id = `idevice-style-${this.generateId()}`;
        style.setAttribute('idevice', idevice.id);
        style.setAttribute('status', status);
        let idevicePath =
            status == 'edition' ? idevice.pathEdition : idevice.pathExport;
        // Get css
        let cssText = await eXeLearning.app.api.func.getText(path);
        // Replace idevice style urls
        cssText = cssText.replace(/url\((?:(?!http))/gm, `url(${idevicePath}`);
        style.innerHTML = cssText;
        document.querySelector('head').append(style);
        return style;
    }

    /**
     * Generic function to load script/css. Used in idevices.
     *
     * @param {*} url
     */
    loadScript(url, callback) {
        let ext = url.split('.').pop();
        let tag;
        switch (ext) {
            case 'css':
                tag = document.createElement('link');
                tag.id = this.generateId();
                tag.setAttribute('rel', 'stylesheet');
                tag.href = `${url}?t=${Date.now()}`;
                this.ideviceScriptsElements.push(tag);
                break;
            case 'js':
                tag = document.createElement('script');
                tag.id = this.generateId();
                tag.setAttribute('type', 'text/javascript');
                tag.src = `${url}?t=${Date.now()}`;
                this.ideviceScriptsElements.push(tag);
                break;
            default:
                return;
        }
        document.querySelector('head').append(tag);
        this.onloadedScriptCallback(url, tag, callback);
    }

    /**
     * Clean idevice scripts dynamically loaded by them
     *
     */
    clearIdevicesScripts() {
        this.ideviceScriptsElements.forEach((scriptElement) => {
            scriptElement.remove();
        });
        this.ideviceScriptsElements = [];
    }

    /**
     * Clean all scripts that are not base of the application
     *
     */
    clearNeedlessScripts() {
        document
            .querySelectorAll('head > script:not(.exe)')
            .forEach((scriptElement) => {
                scriptElement.remove();
            });
        /* At the moment we do not remove the styles
    document.querySelectorAll("head > link:not(.exe)").forEach((linkElement) => {
      linkElement.remove();
    })
    document.querySelectorAll("head > style:not(.exe)").forEach((styleElement) => {
      styleElement.remove();
    })
    */
    }

    /**
     * Execute callback after script is loaded
     *
     * @param {*} url
     * @param {*} element
     * @param {*} callback
     */
    onloadedScriptCallback(url, element, callback) {
        if (element.readyState) {
            element.onreadystatechange = function () {
                if (
                    element.readyState == 'loaded' ||
                    element.readyState == 'complete'
                ) {
                    element.onreadystatechange = null;
                    if (callback) {
                        eval(callback);
                    }
                }
            };
        } else {
            element.onload = function () {
                if (callback) {
                    eval(callback);
                }
            };
        }
    }

    /*******************************************************************************
     * WINDOW
     *******************************************************************************/

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
}

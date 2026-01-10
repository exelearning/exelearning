/**
 * eXeLearning
 *
 */

import IdeviceNode from './content/ideviceNode.js';
import IdeviceBlockNode from './content/blockNode.js';
import { getInitials, generateGravatarUrl } from '../../../utils/avatarUtils.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

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
        this.menuIdevicesElementBottom =
            this.project.app.menus.menuIdevices.menuIdevicesBottomContent;
        this.menuIdevicesDraggableElements = [
            ...this.menuIdevicesElement.querySelectorAll(
                '.idevice_item.draggable'
            ),
            ...this.menuIdevicesElementBottom.querySelectorAll(
                '.idevice_item.draggable'
            ),
        ];
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
        eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
        // Initialize iDevice presence tracking for collaborative editing
        this.initIdevicePresence();
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
            if (container !== afterElement.parentNode) {
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
            ideviceNode.apiUpdatePage(pageId);
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
            blockNode.apiUpdatePage(pageId);
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
                if (
                    event.target.classList.contains('ideviceMenu') ||
                    event.target.classList.contains('userIdeviceExport') ||
                    event.target.classList.contains('userIdeviceDelete')
                ) {
                    return;
                }
                if (this.clickIdeviceMenuEnabled) {
                    let ideviceData = { odeIdeviceTypeName: element.id };
                    let ideviceNode = await this.createIdeviceInContent(
                        ideviceData,
                        this.nodeContentElement
                    );
                    this.clickIdeviceMenuEnabled = false;
                    setTimeout(() => {
                        this.clickIdeviceMenuEnabled = true;
                    }, this.intervalTime);
                }
                let categoriesIdevices = document.querySelectorAll(
                    '#menu_idevices .idevice_category'
                );
                categoriesIdevices.forEach((element) => {
                    element.classList.remove('last-open');
                    element.classList.remove('on');
                    element.classList.add('off');
                });
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
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
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
            ideviceNode.ideviceContent.prepend(
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
                if (ideviceNode.mode === 'edition') {
                    ideviceBlockNode.toggleOn();
                }
                // Set block ids
                this.setBlockDataToIdeviceNode(ideviceNode, ideviceBlockNode);
                // Insert idevice into block
                container.insertBefore(ideviceNodeContent, this.draggedElement);
            }
        }
        // Move window to idevice element
        if (ideviceNode.mode === 'edition') {
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

        // Sync the new iDevice to Yjs for real-time collaboration
        this.syncNewIdeviceToYjs(ideviceNode);
    }

    /**
     * Sync a newly created iDevice to Yjs
     * This enables real-time collaboration - other clients will see the new iDevice
     *
     * @param {IdeviceNode} ideviceNode
     */
    syncNewIdeviceToYjs(ideviceNode) {
        const bridge = this.project._yjsBridge;
        if (!bridge) {
            console.debug('[IdevicesEngine] No YjsBridge available, skipping Yjs sync');
            return;
        }

        const pageId = this.project.app.project.structure.nodeSelected?.getAttribute('nav-id');
        if (!pageId) {
            console.warn('[IdevicesEngine] No pageId available for Yjs sync');
            return;
        }

        // ROBUST CHECK: Verify if this component ALREADY EXISTS in Yjs by searching ALL blocks
        // This prevents duplicates regardless of flags or block ID mismatches
        const allBlocks = bridge.structureBinding.getBlocks(pageId);
        for (const block of allBlocks) {
            const components = bridge.structureBinding.getComponents(pageId, block.id);
            if (components && components.some(c => c.id === ideviceNode.odeIdeviceId)) {
                console.debug(`[IdevicesEngine] Component ${ideviceNode.odeIdeviceId} already exists in Yjs (block: ${block.id}), skipping sync`);
                // Update the ideviceNode with the correct Yjs references
                ideviceNode.yjsComponentId = ideviceNode.odeIdeviceId;
                ideviceNode.fromYjs = true;
                return;
            }
        }

        // Also check via flags as a secondary measure
        if (ideviceNode.fromYjs || ideviceNode.yjsComponentId) {
            console.debug(`[IdevicesEngine] Skipping Yjs sync for ${ideviceNode.odeIdeviceId} (fromYjs flag set)`);
            return;
        }

        // Get or create block in Yjs
        let blockId = ideviceNode.blockId;

        // Check if this block already exists in Yjs, if not create it
        const pageData = bridge.structureBinding.getPage(pageId);
        if (pageData) {
            const existingBlock = allBlocks.find(b => b.id === blockId || b.blockId === blockId);

            if (!existingBlock) {
                // Create the block in Yjs with the SAME ID as the frontend
                // This ensures frontend block ID matches Yjs block ID for future updates
                const blockNode = this.getBlockById(blockId);
                const blockName = blockNode?.blockName || '';
                const frontendBlockId = blockId; // Save original blockId before addBlock might change it

                // Calculate block order based on actual DOM position (counting siblings)
                // This is more reliable than using the 'order' attribute which may be stale
                let blockOrder = null;
                if (blockNode?.blockContent) {
                    const parent = blockNode.blockContent.parentElement;
                    if (parent) {
                        const siblings = Array.from(parent.querySelectorAll(':scope > .box'));
                        const domIndex = siblings.indexOf(blockNode.blockContent);
                        if (domIndex >= 0) {
                            blockOrder = domIndex;
                        }
                    }
                }
                // Fallback: try getCurrentOrder (uses sibling order attributes)
                if (blockOrder === null && typeof blockNode?.getCurrentOrder === 'function') {
                    const calculatedOrder = blockNode.getCurrentOrder();
                    if (calculatedOrder >= 0) {
                        blockOrder = calculatedOrder;
                    }
                }
                // Final fallback: count existing blocks in Yjs
                if (blockOrder === null || blockOrder < 0) {
                    blockOrder = allBlocks.length;
                }

                blockId = bridge.addBlock(pageId, blockName, frontendBlockId, blockOrder);
                // Update the ideviceNode with the Yjs blockId
                if (blockId && blockNode) {
                    blockNode.yjsBlockId = blockId;
                }
            } else {
                // Use the existing block's ID
                blockId = existingBlock.id;
            }
        }

        // Use the correct iDevice type name (e.g., "text" not "FreeTextIdevice")
        // idevice.id contains the actual type name used in the iDevices menu
        const ideviceTypeName = ideviceNode.idevice?.id || ideviceNode.odeIdeviceTypeName || 'text';

        // Calculate correct order based on actual DOM position (counting siblings)
        // This is more reliable than using the 'order' attribute which may be stale
        let componentOrder = null;
        if (ideviceNode.ideviceContent) {
            const parent = ideviceNode.ideviceContent.parentElement;
            if (parent) {
                const siblings = Array.from(parent.querySelectorAll(':scope > .idevice_node'));
                const domIndex = siblings.indexOf(ideviceNode.ideviceContent);
                if (domIndex >= 0) {
                    componentOrder = domIndex;
                }
            }
        }
        // Fallback: try getCurrentOrder (uses sibling order attributes)
        if (componentOrder === null && typeof ideviceNode.getCurrentOrder === 'function') {
            const calculatedOrder = ideviceNode.getCurrentOrder();
            if (calculatedOrder >= 0) {
                componentOrder = calculatedOrder;
            }
        }
        // Final fallback: count existing components in Yjs to append at end
        if (componentOrder === null || componentOrder < 0) {
            const existingComponents = bridge.structureBinding.getComponents(pageId, blockId);
            componentOrder = existingComponents ? existingComponents.length : 0;
        }

        // Create component in Yjs (this will also request the lock for the creator)
        // Include jsonProperties so remote clients can render JSON-type iDevices
        const componentId = bridge.addComponent(
            pageId,
            blockId,
            ideviceTypeName,
            {
                id: ideviceNode.odeIdeviceId,
                htmlContent: ideviceNode.htmlView || '',
                title: ideviceNode.idevice?.title || '',
                jsonProperties: JSON.stringify(ideviceNode.jsonProperties || {}),
                order: componentOrder,
            }
        );

        if (componentId) {
            ideviceNode.yjsComponentId = componentId;
            Logger.log(`[IdevicesEngine] Synced iDevice to Yjs: ${componentId} (type: ${ideviceTypeName})`);
        }
    }

    /**
     * Render an iDevice that comes from a remote Yjs client
     * Called when the Yjs observer detects a new component from another user
     *
     * @param {Object} componentData - Component data from Yjs
     * @param {string} pageId - Page ID where the component should be rendered
     * @param {string} blockId - Block ID where the component should be rendered
     */
    async renderRemoteIdevice(componentData, pageId, blockId) {
        // Only render if we're on the same page
        const currentPageId = this.project.app.project.structure.nodeSelected?.getAttribute('nav-id');
        if (currentPageId !== pageId) {
            console.debug('[IdevicesEngine] Remote iDevice is on different page, skipping render');
            return;
        }

        // Check if this iDevice already exists in the DOM
        const existingIdevice = document.getElementById(componentData.id);
        if (existingIdevice) {
            console.debug('[IdevicesEngine] Remote iDevice already exists in DOM, skipping');
            return;
        }

        // Check if this iDevice already exists in our components list
        const existingInComponents = this.components.idevices.find(
            i => i.odeIdeviceId === componentData.id || i.yjsComponentId === componentData.id
        );
        if (existingInComponents) {
            console.debug('[IdevicesEngine] Remote iDevice already exists in components list, skipping');
            return;
        }

        Logger.log(`[IdevicesEngine] Rendering remote iDevice: ${componentData.id}`, componentData);

        // Validate iDevice type is installed before rendering
        let ideviceTypeName = componentData.ideviceType;
        if (!ideviceTypeName) {
            console.warn('[IdevicesEngine] Remote iDevice has no type, skipping render');
            return;
        }

        // Map legacy/alternative names to actual iDevice IDs
        const typeMapping = {
            'FreeTextIdevice': 'text',
            'FreeText': 'text',
            'freetext': 'text',
            'TextIdevice': 'text',
        };
        if (typeMapping[ideviceTypeName]) {
            ideviceTypeName = typeMapping[ideviceTypeName];
        }

        let installedIdevice = eXeLearning.app.idevices.getIdeviceInstalled(ideviceTypeName);
        // Try without suffix if not found
        if (!installedIdevice) {
            const nameWithoutSuffix = ideviceTypeName.replace(/Idevice$/i, '').toLowerCase();
            installedIdevice = eXeLearning.app.idevices.getIdeviceInstalled(nameWithoutSuffix);
            if (installedIdevice) ideviceTypeName = nameWithoutSuffix;
        }

        if (!installedIdevice) {
            console.warn(`[IdevicesEngine] iDevice type not installed: ${componentData.ideviceType}, skipping render`);
            return;
        }

        // Find or create the block container
        let blockContainer = document.querySelector(`article[sym-id="${blockId}"]`);
        if (!blockContainer) {
            // Block doesn't exist yet, need to create it
            console.debug('[IdevicesEngine] Block not found, creating new block for remote iDevice');
            const nodeContent = document.getElementById('node-content');
            if (!nodeContent) return;

            // Pass the Yjs blockId to ensure consistency across clients
            const blockNode = this.newBlockNode({ blockName: '', iconName: '', blockId: blockId }, true);
            blockNode.yjsBlockId = blockId;
            blockContainer = blockNode.blockContent;
            nodeContent.appendChild(blockContainer);
        }

        // Process jsonProperties - ensure it's a string for IdeviceNode.setParams()
        let jsonPropertiesStr = '{}';
        if (componentData.jsonProperties) {
            jsonPropertiesStr = typeof componentData.jsonProperties === 'string'
                ? componentData.jsonProperties
                : JSON.stringify(componentData.jsonProperties);
        }

        // Create iDevice data for rendering with all required properties
        const ideviceData = {
            odeIdeviceTypeName: ideviceTypeName,
            odeIdeviceId: componentData.id,
            htmlView: componentData.htmlContent || '',
            jsonProperties: jsonPropertiesStr,
            odeComponentsSyncProperties: componentData.odeComponentsSyncProperties || {},
            order: componentData.order || 0,
            mode: 'export', // Remote iDevices start in view mode
            loading: false, // Don't show loading state for remote iDevices
        };

        // Create the iDevice node
        const ideviceNode = new IdeviceNode(this, ideviceData);
        ideviceNode.mode = 'export'; // Force view mode for remote iDevices
        ideviceNode.yjsComponentId = componentData.id;

        // Mark as locked by remote user
        if (componentData.lockedBy || componentData.lockUserName) {
            ideviceNode.lockedByRemote = true;
            ideviceNode.lockUserName = componentData.lockUserName || 'Another user';
            ideviceNode.lockUserColor = componentData.lockUserColor || '#999';
        }

        // Add to components list
        this.components.idevices.push(ideviceNode);

        // Generate content and add to DOM
        const ideviceContent = ideviceNode.makeIdeviceContentNode(true);
        const blockBody = blockContainer.querySelector('.box-body') || blockContainer;
        blockBody.appendChild(ideviceContent);

        // Set block reference
        const blockNode = this.getBlockById(blockContainer.id);
        if (blockNode) {
            this.setBlockDataToIdeviceNode(ideviceNode, blockNode);
        }

        // Initialize the iDevice
        await ideviceNode.loadInitScriptIdevice('export');

        // Hide empty node message since we now have content
        if (eXeLearning?.app?.menus?.menuStructure?.menuStructureBehaviour) {
            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
        }

        Logger.log(`[IdevicesEngine] Remote iDevice rendered: ${componentData.id}`);
    }

    /**
     * Update an existing iDevice's content from remote Yjs changes
     * Called when another client saves content for a component we already have rendered
     *
     * @param {Object} componentData - Updated component data from Yjs
     */
    async updateRemoteIdeviceContent(componentData) {
        // Find the existing iDevice node
        const ideviceNode = this.components.idevices.find(
            i => i.odeIdeviceId === componentData.id || i.yjsComponentId === componentData.id
        );

        if (!ideviceNode) {
            console.debug('[IdevicesEngine] Component not found for update:', componentData.id);
            return;
        }

        Logger.log(`[IdevicesEngine] Updating remote iDevice content: ${componentData.id}`);

        // Update the HTML content
        ideviceNode.htmlView = componentData.htmlContent || '';

        // Remove lock status since content was saved
        ideviceNode.lockedByRemote = false;
        ideviceNode.lockUserName = null;
        ideviceNode.lockUserColor = null;

        // Remove loading attribute from the iDevice container
        if (ideviceNode.ideviceContent) {
            ideviceNode.ideviceContent.setAttribute('loading', 'false');
        }

        // Re-render the iDevice body with new content
        if (ideviceNode.ideviceBody) {
            // For simple HTML content, just update the body
            if (ideviceNode.idevice?.componentType !== 'json' || componentData.htmlContent) {
                // Remove placeholder if present
                const placeholder = ideviceNode.ideviceBody.querySelector('.idevice-locked-placeholder');
                if (placeholder) {
                    placeholder.remove();
                }

                // Update content based on iDevice type
                if (ideviceNode.mode === 'export') {
                    // In view mode, update the displayed content
                    ideviceNode.ideviceBody.innerHTML = componentData.htmlContent || '';
                    await ideviceNode.loadInitScriptIdevice('export');
                }
            }
        }

        // Update the lock indicator in the header
        ideviceNode.updateLockIndicator();

        Logger.log(`[IdevicesEngine] Remote iDevice content updated: ${componentData.id}`);
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
        // Enable internal links
        this.enableInternalLinks();
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
        if (!themeSelected) return; // Check if theme is selected before accessing properties

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
        // Skip legacy API call for Yjs - components are loaded from Yjs document
        if (!this.project?._yjsEnabled) {
            let data = await this.project.app.api.getComponentsByPage(idPage);
        }
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
                        // Set page title - use pageId for Yjs, or legacy properties
                        if (this.project?._yjsEnabled) {
                            this.setNodeContentPageTitle(idPage);
                            // Initialize observer for remote property changes
                            this.initPagePropertiesObserver(idPage);
                        } else {
                            this.setNodeContentPageTitle(data.odeNavStructureSyncProperties);
                        }
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
            if (theme && theme.logoImg) {
                let logoImgContainer = document.createElement('div');
                logoImgContainer.classList.add('logo-img-container');
                logoImgContainer.style.backgroundImage = `url("${theme.getLogoImgUrl()}?v=${Date.now()}")`;
                headerElement.append(logoImgContainer);
            }
            if (theme && theme.headerImg) {
                let headerImgContainer = document.createElement('div');
                headerImgContainer.classList.add('header-img-container');
                headerImgContainer.style.backgroundImage = `url("${theme.getHeaderImgUrl()}?v=${Date.now()}")`;
                headerElement.append(headerImgContainer);
            }
            if (theme && (theme.headerImg || theme.logoImg)) {
                headerElement.classList.remove('hidden');
            } else {
                headerElement.classList.add('hidden');
            }
        }
    }

    /**
     * Set page title in node content
     * Reads properties from Yjs if available, otherwise uses legacy properties
     * @param {string|Object} pageIdOrProperties - Page ID (for Yjs) or legacy properties object
     */
    setNodeContentPageTitle(pageIdOrProperties) {
        const pageTitleElement = this.nodeContainerElement.querySelector(
            '#page-title-node-content'
        );
        if (!pageTitleElement) return;

        // Get properties - from Yjs or legacy format
        const props = this.getPageTitleProperties(pageIdOrProperties);

        // Check hidePageTitle
        const hidePageTitle = props.hidePageTitle === true || props.hidePageTitle === 'true';

        Logger.log('[IdevicesEngine] setNodeContentPageTitle - props:', props);
        Logger.log('[IdevicesEngine] setNodeContentPageTitle - hidePageTitle:', hidePageTitle, '(raw:', props.hidePageTitle, ')');

        if (hidePageTitle) {
            Logger.log('[IdevicesEngine] Hiding page title');
            pageTitleElement.innerText = '';
            pageTitleElement.classList.add('hidden');
            return;
        }

        // Determine which title to use
        const useEditableTitle = props.editableInPage === true || props.editableInPage === 'true';
        const title = useEditableTitle ? (props.titlePage || '') : (props.titleNode || '');

        // Set title and visibility
        pageTitleElement.innerText = title;
        pageTitleElement.classList.toggle('hidden', !title);

        // Typeset LaTeX in page title if detected
        // The properties panel input shows raw text for editing - only the display is rendered
        if (title && /(?:\\\(|\\\[|\\begin\{)/.test(title)) {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                MathJax.typesetPromise([pageTitleElement]).catch(err => {
                    Logger.log('[IdevicesEngine] MathJax typeset error:', err);
                });
            }
            if (typeof $exe !== 'undefined' && $exe.math && $exe.math.refresh) {
                $exe.math.refresh(pageTitleElement);
            }
        }
    }

    /**
     * Get page title properties from Yjs or legacy format
     * @param {string|Object} pageIdOrProperties
     * @returns {Object} Properties object with hidePageTitle, editableInPage, titlePage, titleNode
     */
    getPageTitleProperties(pageIdOrProperties) {
        // If it's a string, treat as pageId and get from Yjs
        if (typeof pageIdOrProperties === 'string') {
            const project = this.project;
            if (project?._yjsBridge?.structureBinding) {
                const yjsProps = project._yjsBridge.structureBinding.getPageProperties(pageIdOrProperties);
                if (yjsProps) {
                    return {
                        hidePageTitle: yjsProps.hidePageTitle,
                        editableInPage: yjsProps.editableInPage,
                        titlePage: yjsProps.titlePage || '',
                        titleNode: yjsProps.titleNode || '',
                    };
                }
            }
            // Fallback: try to get from structure node (if getNodeById method exists)
            const node =
                typeof project?.structure?.getNodeById === 'function'
                    ? project.structure.getNodeById(pageIdOrProperties)
                    : null;
            if (node?.properties) {
                return {
                    hidePageTitle: node.properties.hidePageTitle?.value,
                    editableInPage: node.properties.editableInPage?.value,
                    titlePage: node.properties.titlePage?.value || '',
                    titleNode: node.properties.titleNode?.value || '',
                };
            }
            return {};
        }

        // Legacy format: properties object with .value structure
        if (pageIdOrProperties && typeof pageIdOrProperties === 'object') {
            return {
                hidePageTitle: pageIdOrProperties.hidePageTitle?.value,
                editableInPage: pageIdOrProperties.editableInPage?.value,
                titlePage: pageIdOrProperties.titlePage?.value || '',
                titleNode: pageIdOrProperties.titleNode?.value || '',
            };
        }

        return {};
    }

    /**
     * Initialize observer for remote page property changes
     * Updates page title when properties change via Yjs
     * @param {string} pageId
     */
    initPagePropertiesObserver(pageId) {
        // Cleanup previous observer
        this.cleanupPagePropertiesObserver();

        if (!this.project?._yjsBridge?.structureBinding) return;

        const structureBinding = this.project._yjsBridge.structureBinding;
        const pageMap = structureBinding.getPageMap(pageId);
        if (!pageMap) return;

        // Store current page ID and pageMap for the observer
        this._observedPageId = pageId;
        this._observedPageMap = pageMap;

        // Relevant property keys for title display
        const relevantKeys = ['hidePageTitle', 'editableInPage', 'titlePage', 'titleNode'];

        // Create deep observer for pageMap to catch all properties changes
        // (including when properties Y.Map is created for the first time)
        this._pagePropertiesObserver = (events, transaction) => {
            // Only react to remote changes
            if (transaction.origin === 'user') return;

            // Check if any relevant property changed
            let shouldUpdate = false;

            for (const event of events) {
                // Check if this is a change in the properties map
                if (event.path.length > 0 && event.path[0] === 'properties') {
                    event.changes.keys.forEach((change, key) => {
                        if (relevantKeys.includes(key)) {
                            shouldUpdate = true;
                        }
                    });
                }
            }

            if (shouldUpdate) {
                const currentProps = structureBinding.getPageProperties(this._observedPageId);
                Logger.log('[IdevicesEngine] Remote page properties changed:', currentProps);
                Logger.log('[IdevicesEngine] hidePageTitle:', currentProps?.hidePageTitle, typeof currentProps?.hidePageTitle);
                this.setNodeContentPageTitle(this._observedPageId);
            }
        };

        pageMap.observeDeep(this._pagePropertiesObserver);
        Logger.log('[IdevicesEngine] Page properties observer initialized for:', pageId);
    }

    /**
     * Cleanup page properties observer
     */
    cleanupPagePropertiesObserver() {
        if (this._pagePropertiesObserver && this._observedPageMap) {
            try {
                this._observedPageMap.unobserveDeep(this._pagePropertiesObserver);
            } catch (e) {
                // Ignore if already unobserved
            }
        }
        this._pagePropertiesObserver = null;
        this._observedPageId = null;
        this._observedPageMap = null;
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
        headerElement.classList.add('sr-av');
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
        // Load components - use for...of to properly await async operations
        // (forEach with async callbacks doesn't wait for completion)
        for (const block of pagStructure) {
            // Create block
            let blockNode = this.newBlockNode(block, true);
            let blockContent = blockNode.blockContent;
            // Add class loading to block element
            blockContent.classList.add('loading');
            // Add block element to node container
            this.nodeContentElement.append(blockContent);
            // Load Idevices in block - await each iDevice creation
            for (const idevice of block.odeComponentsSyncs) {
                idevice.mode = 'export';
                let ideviceNode = await this.createIdeviceInContent(
                    idevice,
                    blockContent
                );
            }
        }
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
        // Testing: explicit visibility flag and content readiness
        this.nodeContentLoadScreenElement.setAttribute('data-visible', 'true');
        this.nodeContentElement?.setAttribute('data-ready', 'false');
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
            // Testing: explicit visibility flag and content readiness
            this.nodeContentLoadScreenElement.setAttribute(
                'data-visible',
                'false'
            );
            this.nodeContentElement?.setAttribute('data-ready', 'true');
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
            let buttonsPages = document.querySelectorAll('.nav-element-text');

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
                    if (
                        button.className == 'nav-element-text' &&
                        button.innerText == pageName
                    ) {
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
        // Debug logging for iDevice script loading
        Logger.log('[iDevice] Loading script:', script.src);

        // Add error handler to catch script load failures
        script.onerror = (error) => {
            console.error('[iDevice] Failed to load script:', script.src, error);
        };

        // Add load handler for debugging
        script.onload = () => {
            Logger.log('[iDevice] Script loaded successfully:', script.src);
        };

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
        // Rewrite relative URLs to absolute, preserving quotes
        // Skip absolute URLs (http:, https:, data:, blob:) and root-relative paths (/)
        cssText = cssText.replace(
            /url\(\s*(['"]?)(?!data:|http:|https:|blob:|\/)([^'")]+)\1\s*\)/g,
            (match, quote, path) => `url(${quote}${idevicePath}${path}${quote})`
        );
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
        const executeCallback = () => {
            if (callback) {
                if (typeof callback === 'function') {
                    callback();
                } else {
                    // Legacy string callbacks (used by tooltips, etc.)
                    new Function(callback)();
                }
            }
        };

        if (element.readyState) {
            element.onreadystatechange = function () {
                if (
                    element.readyState == 'loaded' ||
                    element.readyState == 'complete'
                ) {
                    element.onreadystatechange = null;
                    executeCallback();
                }
            };
        } else {
            element.onload = function () {
                executeCallback();
            };
        }
    }

    /*******************************************************************************
     * IDEVICE EDITOR PRESENCE
     *******************************************************************************/

    /**
     * Initialize iDevice presence tracking
     * Subscribes to user changes to show who is editing each iDevice
     */
    initIdevicePresence() {
        const checkReady = () => {
            if (this.project?._yjsEnabled && this.project?._yjsBridge?.getDocumentManager()) {
                const documentManager = this.project._yjsBridge.getDocumentManager();
                this._presenceUnsubscribe = documentManager.onUsersChange(({ users }) => {
                    this._updateIdevicePresence(users);
                });
            } else {
                // Retry in 500ms if not ready
                setTimeout(checkReady, 500);
            }
        };
        checkReady();
    }

    /**
     * Update presence avatars on all iDevices
     * @param {Array} users - Array of online users from awareness
     */
    _updateIdevicePresence(users) {
        // Group users by editingComponentId
        const usersByComponent = {};
        users.forEach(user => {
            if (user.editingComponentId && !user.isLocal) {
                if (!usersByComponent[user.editingComponentId]) {
                    usersByComponent[user.editingComponentId] = [];
                }
                usersByComponent[user.editingComponentId].push(user);
            }
        });

        // Update all iDevice avatar containers and lock states
        const containers = document.querySelectorAll('.idevice-editor-avatar');
        containers.forEach(container => {
            const componentId = container.getAttribute('data-component-id');
            const editingUsers = usersByComponent[componentId] || [];
            this._renderIdeviceEditorAvatar(container, editingUsers);

            // Update lock state on the iDevice node
            const ideviceNode = this.components.idevices.find(
                i => i.odeIdeviceId === componentId || i.yjsComponentId === componentId
            );
            if (ideviceNode) {
                const wasLocked = ideviceNode.lockedByRemote;
                const isNowLocked = editingUsers.length > 0;

                // Update lock state if changed
                if (wasLocked !== isNowLocked) {
                    if (isNowLocked) {
                        ideviceNode.lockedByRemote = true;
                        ideviceNode.lockUserName = editingUsers[0].name || 'Another user';
                        ideviceNode.lockUserColor = editingUsers[0].color || '#999';
                    } else {
                        ideviceNode.lockedByRemote = false;
                        ideviceNode.lockUserName = null;
                        ideviceNode.lockUserColor = null;
                    }
                    // Re-render buttons to update disabled state
                    ideviceNode.updateLockIndicator();
                }
            }
        });
    }

    /**
     * Render editor avatar(s) in an iDevice header
     * @param {HTMLElement} container - The .idevice-editor-avatar container
     * @param {Array} users - Array of users editing this iDevice
     */
    _renderIdeviceEditorAvatar(container, users) {
        // Clear existing avatars
        container.innerHTML = '';

        if (users.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        // Show only first user (typically only one edits at a time)
        const user = users[0];
        const avatar = document.createElement('div');
        avatar.classList.add('idevice-user-avatar');
        // Tooltip with email
        avatar.title = user.email || `${_('Editing by')} ${user.name || 'User'}`;

        if (user.color) {
            avatar.style.borderColor = user.color;
            avatar.style.backgroundColor = user.color + '20'; // Add transparency
        }

        const fallbackInitials = user.initials || getInitials(user.name || user.email);

        // Get or generate Gravatar URL
        const gravatarUrl = user.gravatarUrl || generateGravatarUrl(user.email, 24);

        if (gravatarUrl) {
            const img = document.createElement('img');
            img.src = gravatarUrl;
            img.alt = user.name || '';

            // Fallback to initials on error
            img.onerror = function () {
                this.style.display = 'none';
                avatar.textContent = fallbackInitials;
            };

            avatar.appendChild(img);
        } else {
            avatar.textContent = fallbackInitials;
        }

        container.appendChild(avatar);

        // Show +N if more users
        if (users.length > 1) {
            const more = document.createElement('div');
            more.classList.add('idevice-user-avatar', 'idevice-user-more');
            more.textContent = `+${users.length - 1}`;
            container.appendChild(more);
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

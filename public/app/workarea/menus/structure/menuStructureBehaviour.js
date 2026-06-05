/**
 * eXeLearning
 *
 * Set the events in the nav menu
 */

import ImportProgress from '../../interface/importProgress.js';
import { exportPageAndDownload } from './pageExportHelper.js';

// Use global AppLogger for debug-controlled logging
// Use global AppLogger for debug-controlled logging
const Logger = (typeof window !== 'undefined' && window.AppLogger) || console;

// Module-level flag to ensure only one document-level context menu listener is added
let _contextMenuDelegationAdded = false;
// Store the current handler reference so it can be called with the active instance
let _contextMenuHandler = null;
let _activeMenuStructureBehaviour = null;

/**
 * Reset the context menu delegation state (for testing purposes)
 */
export function resetContextMenuDelegation() {
    if (_contextMenuHandler) {
        document.removeEventListener('click', _contextMenuHandler);
        _contextMenuHandler = null;
    }
    _contextMenuDelegationAdded = false;
    _activeMenuStructureBehaviour = null;
}

export default class MenuStructureBehaviour {
    constructor(structureEngine) {
        this.structureEngine = structureEngine;
        this.menuNav = document.querySelector('#main #menu_nav');
        this.menuNavList = this.menuNav.querySelector('#main #nav_list');
        this.nodeSelected = null;
        this.selectedNodeIds = new Set();
        this.lastRangeAnchorId = null;
        this.nodeDrag = null;
        this.enterDragMenuStructureCount = 0;
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
        this.addEventNavElementIconOnclick();
        this.addEventNavElementOnMenuIconClic();
        this.addEventNavElementOnAddIconClick();
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
                // Ignore clicks from dropdown menu or trigger (let them bubble to menuNav delegation)
                if (event.target.closest('.dropdown-menu') || event.target.closest('.page-settings-trigger')) return;
                
                // Ignore clicks when inline editing is active
                if (event.target.closest('.node-text-span[contenteditable="true"]')) return;

                // Close any open dropdowns before checking iDevice or stopping propagation
                const openDropdowns = document.querySelectorAll('.dropdown-menu.show');
                openDropdowns.forEach(menu => {
                     const toggle = menu.parentElement.querySelector('[data-bs-toggle="dropdown"]');
                     if (toggle && typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                         const dd = bootstrap.Dropdown.getInstance(toggle);
                         if (dd) dd.hide();
                     }
                });

                event.stopPropagation();
                if (eXeLearning.app.project.checkOpenIdevice()) return;

                const navElement = element.parentElement;
                const isRangeSelection = event.shiftKey;
                const isToggleSelection = event.ctrlKey || event.metaKey;

                if (isRangeSelection || isToggleSelection) {
                    this.handleMultiSelectionClick(navElement, event);
                    return;
                }

                const wasAlreadySelected = this.nodeSelected &&
                    navElement.getAttribute('nav-id') === this.nodeSelected.getAttribute('nav-id');

                this.selectNode(navElement).then((nodeElement) => {
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                    if (wasAlreadySelected && nodeElement) {
                        this.startInlinePageRename(nodeElement);
                    }
                });
            });
        });
    }

    /**
     * Handle Shift/Ctrl/Cmd click selection for multi-select.
     *
     * @param {Element} navElement
     * @param {MouseEvent} event
     */
    handleMultiSelectionClick(navElement, event) {
        if (!navElement) return;

        const clickedId = navElement.getAttribute('nav-id');
        if (!clickedId) return;

        const isRangeSelection = event.shiftKey;
        const isAdditiveSelection = event.ctrlKey || event.metaKey;
        const currentSelection = new Set(this.getSelectedNodeIds({ excludeRoot: false }));
        let nextSelection = new Set(currentSelection);

        if (isRangeSelection) {
            const anchorId =
                this.lastRangeAnchorId ||
                this.nodeSelected?.getAttribute('nav-id') ||
                clickedId;
            const rangeIds = this.getNavIdsInRange(anchorId, clickedId);
            nextSelection = isAdditiveSelection ? new Set([...currentSelection, ...rangeIds]) : new Set(rangeIds);
        } else if (isAdditiveSelection) {
            if (nextSelection.has(clickedId)) {
                // Keep at least one selected element to avoid an unusable empty state.
                if (nextSelection.size > 1) {
                    nextSelection.delete(clickedId);
                }
            } else {
                nextSelection.add(clickedId);
            }
        }

        if (nextSelection.size === 0) {
            nextSelection.add(clickedId);
        }

        this.lastRangeAnchorId = clickedId;
        this.setNodeSelected(navElement, nextSelection);
    }

    /**
     * Get nav IDs between two nodes following current visible DOM order.
     *
     * @param {string} anchorId
     * @param {string} targetId
     * @returns {Array<string>}
     */
    getNavIdsInRange(anchorId, targetId) {
        const navElements = Array.from(this.menuNav.querySelectorAll('.nav-element[nav-id]'));
        const navIds = navElements.map((el) => el.getAttribute('nav-id')).filter(Boolean);
        const anchorIndex = navIds.indexOf(anchorId);
        const targetIndex = navIds.indexOf(targetId);

        if (anchorIndex === -1 || targetIndex === -1) {
            return [targetId];
        }

        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        return navIds.slice(start, end + 1);
    }

    addEventNavElementOnMenuIconClic() {
        // 1. Handle Trigger Button (Toggle Dropdown)
        var navTriggers = this.menuNav.querySelectorAll(
            `.nav-element .page-settings-trigger`
        );
        navTriggers.forEach((element) => {
            // FIX: Handle Z-Index dynamically on show/hide to prevent overlap by subsequent elements
            const container = element.closest('.dropdown');
            if (container) {
                container.addEventListener('show.bs.dropdown', () => {
                    const navEl = container.closest('.nav-element');
                    if (navEl) navEl.style.zIndex = '1005'; // Higher than siblings (next rows)
                    
                    // FIX: Also elevate this container (textElement) so it sits above its own 
                    // 'children-container' (which follows it in DOM).
                    container.style.position = 'relative'; 
                    container.style.zIndex = '1006';
                });
                container.addEventListener('hide.bs.dropdown', () => {
                    const navEl = container.closest('.nav-element');
                    if (navEl) navEl.style.zIndex = '';

                    container.style.zIndex = '';
                    container.style.position = '';
                });
            }

            element.addEventListener('click', (event) => {
                // We rely on Bootstrap's data-bs-toggle="dropdown" to handle the toggle.
                // We ONLY need to stop propagation so the row doesn't get selected.
                event.stopPropagation();
            });
            // Prevent double click on trigger
            // Prevent double click on trigger
            element.addEventListener('dblclick', (event) => {
                event.stopPropagation();
            });
        });

        // 2. Handle Properties Menu Item (and any legacy buttons)
        // Note: The new Properties item has class 'node-menu-button' and 'page-settings'
        var navPropertiesItems = this.menuNav.querySelectorAll(
            `.nav-element .node-menu-button`
        );
        navPropertiesItems.forEach((element) => {
            // Avoid adding this handler to the trigger itself if it still has node-menu-button class (it does, but we can check)
            if (element.classList.contains('page-settings-trigger')) return;

            element.addEventListener('click', (event) => {
                event.stopPropagation();
                let node = this.structureEngine.getNode(
                    element.getAttribute('data-menunavid')
                );
                if (node) {
                    node.showModalProperties();
                    this.mutationForModalProperties();
                }
                // Close dropdown if open (Bootstrap usually does this, but good to ensure)
            });
        });

        // 3. Delegation for other Context Menu Actions (Import, Clone, Delete)
        // Using document-level listener since dropdown menus are appended to body (data-bs-container="body")
        // Update the active instance reference so the handler always uses the current behaviour
        _activeMenuStructureBehaviour = this;

        if (!_contextMenuDelegationAdded) {
            _contextMenuHandler = (e) => {
                // Only handle dropdown items from nav page menus (identified by aria-labelledby pattern)
                const target = e.target.closest('.dropdown-item');
                if (!target) return;

                // Check if this dropdown menu belongs to a nav page menu
                const dropdownMenu = target.closest('.dropdown-menu[aria-labelledby^="dropdownMenuButtonPage"]');
                if (!dropdownMenu) return;

                // Use the active behaviour instance
                const self = _activeMenuStructureBehaviour;
                if (!self) return;

                // Stop propagation immediately if we hit a dropdown item!
                e.stopPropagation();

                // Helper to close dropdown - find button via aria-labelledby
                const closeDropdown = () => {
                    const labelledBy = dropdownMenu.getAttribute('aria-labelledby');
                    const dropdownBtn = labelledBy ? document.getElementById(labelledBy) : null;
                    if (dropdownBtn && typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
                        const dd = bootstrap.Dropdown.getInstance(dropdownBtn);
                        if (dd) dd.hide();
                    }
                };

                // Import Page
                if (target.classList.contains('action_import_idevices')) {
                    e.stopPropagation();
                    closeDropdown();
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                    const nodeId = target.getAttribute('data-nav-id');
                    if (nodeId) {
                        self.importTargetNodeId = nodeId;
                        const input = self.menuNav.querySelector('input.local-ode-file-upload-input');
                        if (input) input.click();
                    }
                }

                // Clone Page
                if (target.classList.contains('action_clone')) {
                    e.stopPropagation();
                    closeDropdown();
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                    const nodeId = target.getAttribute('data-nav-id');
                    if (nodeId) {
                         // User requested revert: Clone directly, then Rename.
                         self.structureEngine.cloneNodeAndReload(nodeId).then(() => {
                             self.showModalRenameNode();
                         });
                    }
                }

                // Export Page (client-side export to include IndexedDB assets)
                if (target.classList.contains('action_export_page')) {
                    e.stopPropagation();
                    closeDropdown();
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                    const nodeId = target.getAttribute('data-nav-id');
                    if (nodeId) {
                        exportPageAndDownload(nodeId, self.structureEngine).catch(
                            (error) => {
                                console.error(
                                    '[MenuStructure] Page export failed:',
                                    error
                                );
                                eXeLearning.app.modals.alert.show({
                                    title: _('Download error'),
                                    body: error.message,
                                    contentId: 'error',
                                });
                            }
                        );
                    }
                }


                // Delete Page
                if (target.classList.contains('action_delete')) {
                    e.stopPropagation();
                    closeDropdown();
                    if (eXeLearning.app.project.checkOpenIdevice()) return;
                    const nodeId = target.getAttribute('data-nav-id');
                    if (nodeId) {
                        self.showModalRemoveNode(nodeId);
                    }
                }

                // Properties
                if (target.classList.contains('page-settings')) {
                     e.stopPropagation();
                     closeDropdown();
                     const nodeId = target.getAttribute('data-menunavid');
                     let node = self.structureEngine.getNode(nodeId);
                     if (node) {
                        node.showModalProperties();
                        self.mutationForModalProperties();
                     }
                }

                // Add Subpage
                if (target.classList.contains('page-add')) {
                     e.stopPropagation();
                     closeDropdown();
                     if (eXeLearning.app.project.checkOpenIdevice()) return;
                     const parentNodeId = target.getAttribute('data-parentnavid');
                     self.showModalNewNode(parentNodeId);
                }
            };
            document.addEventListener('click', _contextMenuHandler);
            _contextMenuDelegationAdded = true;
        }
    }

    /**
     * Add click event to "+" buttons on nodes for adding subpages
     */
    addEventNavElementOnAddIconClick() {
        // Select ALL "+" buttons including the one on root
        var navAddButtons = this.menuNav.querySelectorAll(
            `.nav-element > .nav-element-text .node-add-button`
        );
        navAddButtons.forEach((element) => {
            element.addEventListener('click', (event) => {
                event.stopPropagation();
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                let parentNodeId = element.getAttribute('data-parentnavid');
                // For root, parentNodeId='root' should become null (top-level page)
                if (parentNodeId === 'root') parentNodeId = null;
                this.showModalNewNode(parentNodeId);
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
    /**
     * Add click event for main "New page" button - always creates at root level
     */
    addEventNavNewNodeOnclick() {
        const btn = this.menuNav.querySelector('.button_nav_action.action_add');
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // Always create at root level (pass null explicitly)
                this.showModalNewNode(null);
            });
        }
    }

    /**
     *
     */
    addEventNavPropertiesNodeOnclick() {
        const btn = this.menuNav.querySelector(
            '.button_nav_action.action_properties'
        );
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    this.showModalPropertiesNode();
                }
            });
        }
    }

    /**
     * Add click event to delete node button
     * Uses Yjs Awareness to check for other users on the page
     */
    addEventNavRemoveNodeOnclick() {
        const btn = this.menuNav.querySelector('.button_nav_action.action_delete');
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.getSelectedNodeIds({ excludeRoot: true }).length > 0) {
                    this.showModalRemoveNode();
                }
            });
        }
    }

    /**
     *
     */
    addEventNavCloneNodeOnclick() {
        const btn = this.menuNav.querySelector('.button_nav_action.action_clone');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    await this.structureEngine.cloneNodeAndReload(
                        this.nodeSelected.getAttribute('nav-id')
                    );
                    this.showModalRenameNode();
                }
            });
        }
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
        inputUpload.setAttribute('accept', '.elpx,.block,.idevice,.elp,.zip');
        inputUpload.id = 'local-ode-file-upload';
        let label = document.createElement('label');
        label.setAttribute('for', inputUpload.id);
        label.classList.add('visually-hidden');
        label.textContent = _('Upload iDevice file');

        inputUpload.addEventListener('change', async (e) => {
            let uploadOdeFile = document.querySelector(
                '.local-ode-file-upload-input'
            );
            let file = uploadOdeFile.files[0];
            let newUploadInput = this.createIdevicesUploadInput();
            inputUpload.remove();
            this.menuNav.append(newUploadInput);

            if (!file) return;

            const fileName = file.name.toLowerCase();

            const isProjectFile =
                fileName.endsWith('.elpx') ||
                fileName.endsWith('.elp') ||
                fileName.endsWith('.zip');

            if (isProjectFile) {
                // Get selected node to use as parent
                const selectedNav =
                    this.nodeSelected &&
                    this.nodeSelected.getAttribute('nav-id');
                // Use importTargetNodeId if set (from context menu), otherwise fallback to selection
                const targetNodeId = this.importTargetNodeId || selectedNav;
                // If root or no selection, parentId is null (import at root level)
                const parentId = (!targetNodeId || targetNodeId === 'root') ? null : targetNodeId;
                
                // Reset target
                this.importTargetNodeId = null;

                Logger.log('[MenuStructure] Importing via Yjs, parentId:', parentId);

                // Show inline progress
                const importProgress = new ImportProgress();
                importProgress.show();

                try {
                    // Get Yjs bridge
                    const bridge = window.YjsModules?.getBridge();
                    if (!bridge || !bridge.documentManager || !bridge.initialized) {
                        throw new Error(_('Please wait for the project to fully load before importing.'));
                    }

                    // Use centralized import method with progress callback
                    const stats = await bridge.importFromElpx(file, {
                        clearExisting: false,  // Don't clear, we're adding to existing
                        parentId: parentId,    // Import as child of selected node
                        onProgress: (progress) => importProgress.update(progress)
                    });

                    Logger.log('[MenuStructure] Import complete:', stats);

                    // Hide progress
                    importProgress.hide();

                    // Refresh structure
                    if (this.structureEngine &&
                        typeof this.structureEngine.resetDataAndStructureData === 'function') {
                        this.structureEngine.resetDataAndStructureData(parentId || false);
                    } else {
                        eXeLearning.app.project.openLoad();
                    }

                } catch (err) {
                    console.error('[MenuStructure] Import error:', err);
                    // Ensure progress is hidden on error
                    importProgress.hide();
                    eXeLearning.app.modals.alert.show({
                        title: _('Error'),
                        body: err?.message || _('Unexpected error importing file.'),
                    });
                }

                return;
            }

            eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                file,
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
        const btn = this.menuNav.querySelector(
            '.button_nav_action.action_import_idevices'
        );
        if (btn) {
            btn.addEventListener('click', async (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                // If main button clicked, use selected node
                if (this.nodeSelected) {
                    this.importTargetNodeId = this.nodeSelected.getAttribute(
                        'nav-id'
                    );
                    const input = this.menuNav.querySelector(
                        'input.local-ode-file-upload-input'
                    );
                    if (input) input.click();
                }
            });
        }
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
        // Safe check in case element is missing
        const btn = this.menuNav.querySelector(
            '.button_nav_action.action_check_broken_links'
        );
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (this.nodeSelected) {
                    let selectedNav = this.menuNav.querySelector(
                        '.toggle-on .selected'
                    );
                    if (!selectedNav) return; // robustness
                    let pageId = selectedNav.getAttribute('page-id');
                    this.getOdePageBrokenLinksEvent(pageId).then((response) => {
                        if (!response.responseMessage) {
                            // Show eXe OdeBrokenList modal
                            eXeLearning.app.modals.odebrokenlinks.show(response);
                        } else {
                            // Open eXe alert modal
                            eXeLearning.app.modals.alert.show({
                                title: _('Broken links'),
                                body: _('No broken links found.'),
                            });
                        }
                    });
                }
            });
        }
    }

    /**
     *
     */
    addEventNavMovPrevOnClick() {
        const btn = this.menuNav.querySelector(
            '.button_nav_action.action_move_prev'
        );
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                const selectedIds = this.getSelectedNodeIds({ excludeRoot: true });
                if (selectedIds.length > 0) {
                    this.moveSelectedNodes('prev', selectedIds);
                }
            });
        }
    }

    /**
     *
     */
    addEventNavMovNextOnClick() {
        const btn = this.menuNav.querySelector(
            '.button_nav_action.action_move_next'
        );
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                const selectedIds = this.getSelectedNodeIds({ excludeRoot: true });
                if (selectedIds.length > 0) {
                    this.moveSelectedNodes('next', selectedIds);
                }
            });
        }
    }

    /**
     *
     */
    addEventNavMovUpOnClick() {
        const btn = this.menuNav.querySelector(
            '.button_nav_action.action_move_up'
        );
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                const selectedIds = this.getSelectedNodeIds({ excludeRoot: true });
                if (selectedIds.length > 0) {
                    this.moveSelectedNodes('left', selectedIds);
                }
            });
        }
    }

    /**
     *
     */
    addEventNavMovDownOnClick() {
        const btn = this.menuNav.querySelector(
            '.button_nav_action.action_move_down'
        );
        if (btn) {
            btn.addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                const selectedIds = this.getSelectedNodeIds({ excludeRoot: true });
                if (selectedIds.length > 0) {
                    this.moveSelectedNodes('right', selectedIds);
                }
            });
        }
    }

    /**
     * Move all selected nodes in a direction with one final structure refresh.
     *
     * @param {'prev'|'next'|'left'|'right'} direction
     * @param {Array<string>} selectedIds
     */
    moveSelectedNodes(direction, selectedIds) {
        const binding = eXeLearning.app.project?._yjsBridge?.structureBinding;
        const topMostIds = this.filterTopMostNodeIds(selectedIds);
        const orderedIds = this.orderSelectedIdsForMove(topMostIds);
        const primarySelectionId =
            this.nodeSelected?.getAttribute('nav-id') ||
            orderedIds[0] ||
            false;
        let moved = false;

        const bindingMoves = {
            prev: 'movePagePrev',
            next: 'movePageNext',
            left: 'movePageLeft',
            right: 'movePageRight',
        };
        const bindingGroupMoves = {
            prev: 'movePageGroupPrev',
            next: 'movePageGroupNext',
            left: 'movePageGroupLeft',
            right: 'movePageGroupRight',
        };
        const engineMoves = {
            prev: 'moveNodePrev',
            next: 'moveNodeNext',
            left: 'moveNodeUp',
            right: 'moveNodeDown',
        };
        const legacyOrderedIds =
            direction === 'next' || direction === 'right'
                ? [...orderedIds].reverse()
                : [...orderedIds];

        if (binding && typeof binding[bindingGroupMoves[direction]] === 'function') {
            moved = binding[bindingGroupMoves[direction]](orderedIds) === true;
            if (moved && typeof this.structureEngine.resetStructureData === 'function') {
                this.structureEngine.resetStructureData(primarySelectionId);
            }
            return;
        }

        if (binding && typeof binding[bindingMoves[direction]] === 'function') {
            orderedIds.forEach((id) => {
                if (binding[bindingMoves[direction]](id)) {
                    moved = true;
                }
            });
            if (moved && typeof this.structureEngine.resetStructureData === 'function') {
                this.structureEngine.resetStructureData(primarySelectionId);
            }
            return;
        }

        // Legacy fallback (non-Yjs): execute existing single-node engine methods
        legacyOrderedIds.forEach((id) => {
            if (typeof this.structureEngine[engineMoves[direction]] === 'function') {
                this.structureEngine[engineMoves[direction]](id);
                moved = true;
            }
        });
    }

    /**
     * Stable ordering for multi-move operations.
     * For moving down/right we reverse to keep relative ordering.
     *
     * @param {Array<string>} selectedIds
     * @returns {Array<string>}
     */
    orderSelectedIdsForMove(selectedIds) {
        const domOrder = Array.from(
            this.menuNav.querySelectorAll('.nav-element[nav-id]')
        ).map((el) => el.getAttribute('nav-id'));

        const orderMap = new Map(domOrder.map((id, index) => [id, index]));
        const sorted = [...selectedIds].sort((a, b) => {
            const orderA = orderMap.get(a) ?? Number.MAX_SAFE_INTEGER;
            const orderB = orderMap.get(b) ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
        });

        return sorted;
    }

    /*******************************************************************************
     * MODALS
     *******************************************************************************/

    /**
     *
     */
    /**
     * Show modal to create a new page/subpage
     * @param {string|null} explicitParentId - If provided, use this as parent. If undefined, use selected node.
     */
    showModalNewNode(explicitParentId) {
        // If explicitParentId is explicitly passed (including null), use it
        // Otherwise fall back to selected node behavior
        let parentNodeId = explicitParentId !== undefined
            ? explicitParentId
            : (this.nodeSelected ? this.nodeSelected.getAttribute('nav-id') : null);
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
     * Activate inline contenteditable editing on a page title in the navigation tree.
     * Follows the same pattern as block title editing (IdeviceBlockNode.makeBlockTitleElementText).
     *
     * @param {Element} navElement - The .nav-element to rename
     */
    startInlinePageRename(navElement) {
        const navId = navElement.getAttribute('nav-id');
        if (navId === 'root') return;

        const textSpan = navElement.querySelector('.node-text-span');
        if (!textSpan || textSpan.getAttribute('contenteditable') === 'true') return;

        const node = this.structureEngine.getNode(navId);
        if (!node) return;

        const originalText = node.pageName;
        const textElement = navElement.querySelector('.nav-element-text');

        // Restore raw title text before editing (the span may contain rendered MathJax DOM)
        const rawTitle = textElement?.getAttribute('title') || originalText;
        textSpan.textContent = rawTitle;

        textSpan.setAttribute('contenteditable', 'true');
        textSpan.focus();

        const range = document.createRange();
        range.selectNodeContents(textSpan);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        if (textElement) {
            textElement.setAttribute('draggable', 'false');
        }

        let finished = false;

        const finishEditing = (save) => {
            if (finished) return;
            finished = true;

            const newTitle = textSpan.textContent.trim();
            textSpan.removeAttribute('contenteditable');
            textSpan.removeEventListener('blur', onBlur);
            textSpan.removeEventListener('keydown', onKeydown);

            if (textElement) {
                textElement.setAttribute('draggable', 'true');
            }

            if (save && newTitle && newTitle !== rawTitle) {
                this.structureEngine.renameNodeAndReload(navId, newTitle);
                // Eagerly update in-memory property so the modal shows the new title
                if (node.properties?.titleNode) {
                    node.properties.titleNode.value = newTitle;
                }
                // Only update page title h1 if "Título diferente en la página" is NOT active
                const editableInPage = node.properties?.editableInPage?.value;
                const isEditableInPage = editableInPage === true || editableInPage === 'true';
                const pageTitle = document.querySelector('#page-title-node-content');
                if (pageTitle && !isEditableInPage) {
                    pageTitle.textContent = newTitle;
                }
                if (textElement) {
                    textElement.setAttribute('title', newTitle);
                }
                // Update properties modal input if it exists
                const propInput = document.querySelector('input[property="titleNode"]');
                if (propInput) {
                    propInput.value = newTitle;
                }
                // Typeset LaTeX in both page title and nav span
                if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                    const elementsToTypeset = [textSpan];
                    if (pageTitle && !isEditableInPage) elementsToTypeset.push(pageTitle);
                    MathJax.typesetPromise(elementsToTypeset).catch(() => {});
                }
            } else {
                textSpan.textContent = originalText;
                // Re-typeset nav span to restore rendered LaTeX
                if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                    MathJax.typesetPromise([textSpan]).catch(() => {});
                }
            }
        };

        const onBlur = () => finishEditing(true);

        const onKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEditing(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishEditing(false);
            }
        };

        textSpan.addEventListener('blur', onBlur);
        textSpan.addEventListener('keydown', onKeydown);
    }

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
     * Show confirmation modal for removing a node
     * Checks for other users via Yjs Awareness and shows appropriate warning
     */
    showModalRemoveNode(explicitNodeId = null) {
        const selectedIds = explicitNodeId
            ? [explicitNodeId]
            : this.getSelectedNodeIds({ excludeRoot: true });
        const nodeIds = this.filterTopMostNodeIds(selectedIds);
        if (nodeIds.length === 0) return;

        const isBatchDelete = !explicitNodeId && nodeIds.length > 1;
        const firstNodeElement = this.menuNav.querySelector(
            `.nav-element[nav-id="${nodeIds[0]}"]`
        );
        const firstNodeName =
            firstNodeElement?.querySelector('.node-text-span')?.textContent ||
            _('this page');
        const hasDescendants = nodeIds.some((id) => this._nodeHasDescendants(id));

        const affectedUsersByEmail = new Map();
        nodeIds.forEach((id) => {
            const element = this.menuNav.querySelector(`.nav-element[nav-id="${id}"]`);
            if (!element) return;
            const pageId = element.getAttribute('page-id') || id;
            this._getAffectedUsersForDeletion(pageId).forEach((user) => {
                const userKey = user.email || user.name || JSON.stringify(user);
                affectedUsersByEmail.set(userKey, user);
            });
        });

        const affectedUsers = Array.from(affectedUsersByEmail.values());
        const userNames = affectedUsers.map((u) => u.name || _('Unknown user')).join(', ');

        let modalBody = '';
        if (isBatchDelete) {
            modalBody = `<p>${_('Do you want to delete')} <strong>${nodeIds.length}</strong> ${_(
                'selected pages'
            )}${hasDescendants ? ' ' + _('and their children') : ''}?</p>
                <p class="text-muted small">${_('You can undo this action.')}</p>`;
        } else if (hasDescendants) {
            modalBody = `<p>${_('Do you want to delete')} "<strong>${firstNodeName}</strong>" ${_('and all its children')}?</p>
                <p class="text-muted small">${_('You can undo this action.')}</p>`;
        } else {
            modalBody = `<p>${_('Do you want to delete')} "<strong>${firstNodeName}</strong>"?</p>
                <p class="text-muted small">${_('You can undo this action.')}</p>`;
        }

        if (affectedUsers.length > 0) {
            modalBody =
                `<p><strong>${_('Warning')}:</strong> ${
                    affectedUsers.length === 1
                        ? _('Another user is viewing this page or its children')
                        : _('Other users are viewing this page or its children')
                }:</p>
                <p class="text-primary fw-bold">${userNames}</p>
                <p>${_('They will be automatically redirected to the parent page.')}</p>` +
                modalBody;
        }

        eXeLearning.app.modals.confirm.show({
            title: _('Delete page'),
            contentId: 'delete-node-modal',
            body: modalBody,
            confirmButtonText: _('Delete'),
            cancelButtonText: _('Cancel'),
            focusCancelButton: affectedUsers.length > 0,
            confirmExec: () => {
                if (
                    nodeIds.length > 1 &&
                    typeof this.structureEngine.removeNode === 'function' &&
                    typeof this.structureEngine.resetStructureData === 'function'
                ) {
                    nodeIds.forEach((id) => this.structureEngine.removeNode(id));
                    this.structureEngine.resetStructureData(false);
                    return;
                }
                nodeIds.forEach((id) =>
                    this.structureEngine.removeNodeCompleteAndReload(id)
                );
            },
        });
    }

    /**
     * Get other users affected by deleting a node (on page or descendants)
     * @param {string} pageId - Page ID to check
     * @returns {Array} Array of affected user objects
     */
    _getAffectedUsersForDeletion(pageId) {
        try {
            const project = eXeLearning?.app?.project;
            if (!project?._yjsEnabled || !project?._yjsBridge) return [];

            const documentManager = project._yjsBridge.getDocumentManager();
            if (!documentManager) return [];

            const structureData = this.structureEngine.data || {};
            const result = documentManager.getOtherUsersOnPageAndDescendants(pageId, structureData);

            return result.allAffectedUsers || [];
        } catch (error) {
            console.warn('[MenuStructureBehaviour] Failed to get affected users:', error);
            return [];
        }
    }

    /**
     * Check if a node has any descendants
     * @param {string} nodeId - Node ID to check
     * @returns {boolean}
     */
    _nodeHasDescendants(nodeId) {
        const structureData = this.structureEngine.data || {};
        for (const [id, node] of Object.entries(structureData)) {
            if (node.parent === nodeId) {
                return true;
            }
        }
        return false;
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
                this.structureEngine.cloneNodeAndReload(nodeId).then(() => {
                    // After cloning, we might want to rename the NEW node, but cloneNodeAndReload 
                    // usually selects the new node. We can call showModalRenameNode then.
                    // Ideally we should catch the new ID from cloneNodeAndReload but it might not return it directly.
                    // For now, let's just clone as per original logic. User asked for "confirm then clone".
                    // The renaming issue described by user ("clones directly") is fixed by this modal.
                    // If they want to rename AFTER, they can use the rename option on the new node.
                });
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
            e.setAttribute('data-selected', 'false');
            e.setAttribute('aria-selected', 'false');
        });
        this.selectedNodeIds.clear();
    }

    /**
     * Select first node
     *
     */
    async selectFirst() {
        let navElements = this.menuNav.querySelectorAll('.nav-element');
        if (navElements.length >= 1 && navElements[0]) {
            return await this.selectNode(navElements[0]);
        }
        // No elements found - return null gracefully
        console.warn('[MenuStructureBehaviour] No nav elements found to select');
        return null;
    }

    /**
     * Select node
     *
     * @param {Element} element
     * @returns {Promise<Element>}
     */
    async selectNode(element) {
        // Guard against null/undefined element
        if (!element) {
            console.warn('[MenuStructureBehaviour] selectNode called with null element');
            return Promise.resolve(null);
        }
        eXeLearning.app.project.unlockIdevices();
        // eslint-disable-next-line no-async-promise-executor
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

                // Boost priority for assets on this page (P2P priority queue)
                const pageId = element.getAttribute('nav-id');
                if (pageId && eXeLearning.app.project.bridge) {
                    eXeLearning.app.project.bridge.onPageNavigation(pageId);
                }

                // ALWAYS apply visual selection (even if idevices load fails for new Yjs nodes)
                Logger.log('[MenuStructureBehaviour] About to setNodeSelected, element nav-id:', element?.getAttribute('nav-id'));
                this.deselectNodes();
                this.setNodeSelected(element);
                Logger.log('[MenuStructureBehaviour] setNodeSelected completed, nodeSelected:', this.nodeSelected?.getAttribute('nav-id'));
                response = element;

                // Scroll to top when changing pages (instant, no animation)
                const nodeContentContainer = document.getElementById('node-content-container');
                if (nodeContentContainer) {
                    nodeContentContainer.scrollTo({ top: 0, behavior: 'instant' });
                }

                if (loadPageProcessOk) {
                    time = 100;
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

                // Re-render any pending Mermaid diagrams on this page
                // This handles diagrams that couldn't render initially because the page was hidden
                if (typeof $exe !== 'undefined' && $exe.mermaid && $exe.mermaid.initialized) {
                    $exe.mermaid.renderDiagrams();
                }

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
                icon.innerHTML = `<svg width="46" height="42" viewBox="0 0 46 42" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9.89385 27.3114C8.85228 28.4826 7.59713 30.1241 7.44197 31.7537C7.18594 34.4428 10.5275 36.5047 10.5275 36.5047C10.5275 36.5047 15.0356 39.3023 18.2758 40.084C21.7996 40.934 27.5554 40.2998 27.5554 40.2998C36.6375 40.2998 44 32.9372 44 23.8551C44 18.308 40.426 12.553 37.339 10.4815L26.0974 2.04022C24.446 0.800213 22.102 1.13373 20.862 2.78515C20.1718 3.70441 19.9691 4.83827 20.2099 5.87685C20.4016 6.70367 20.8669 7.49457 21.5985 8.04429M7.71786 16.3253C6.06645 15.0853 3.72249 15.4188 2.48248 17.0702C1.79223 17.9895 1.58955 19.1233 1.83035 20.1619C2.02214 20.9891 2.49525 21.7558 3.22741 22.3056L14.469 30.7468M12.1623 10.309L10.0412 8.71632C8.3898 7.47632 6.04584 7.80983 4.80583 9.46125C4.11558 10.3805 3.9129 11.5144 4.15371 12.553C4.3455 13.3801 4.81861 14.1469 5.55076 14.6966L16.7924 23.1379M12.1623 10.309C12.1897 10.3308 12.2175 10.3523 12.2456 10.3734M12.1623 10.309C11.4775 9.76457 11.033 9.02509 10.8486 8.22974C10.6078 7.19115 10.8104 6.0573 11.5007 5.13803C12.7407 3.48661 15.0847 3.1531 16.7361 4.3931L21.5985 8.04429M12.1623 10.309L19.0194 15.458M21.5985 8.04429L24.7881 10.4393" stroke="#474747" stroke-width="2.33219" stroke-linecap="round"/>
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
    setNodeSelected(element, selectedIds = null) {
        Logger.log('[MenuStructureBehaviour] setNodeSelected START, element:', element?.getAttribute('nav-id'));
        if (!element) return;

        const selectedIdSet = new Set(
            selectedIds ? Array.from(selectedIds) : [element.getAttribute('nav-id')]
        );
        const selectedNavId = element.getAttribute('nav-id');
        selectedIdSet.add(selectedNavId);
        this.selectedNodeIds = new Set(
            Array.from(selectedIdSet).filter((id) =>
                this.menuNav.querySelector(`.nav-element[nav-id="${id}"]`)
            )
        );
        this.nodeSelected = element;
        this.nodeSelected?.classList.add('selected'); // Collaborative
        Logger.log('[MenuStructureBehaviour] Added selected class, classList:', this.nodeSelected?.classList.toString());
        this.structureEngine.nodeSelected = this.nodeSelected;
        this.lastRangeAnchorId = selectedNavId;
        this.setNodeIdToNodeContentElement();
        this.createAddTextBtn();
        this.enabledActionButtons();

        // Testing: explicit selected state on nav nodes and ARIA sync
        // Compare by nav-id instead of object reference (elements may be recreated by compose())
        const allNodes = this.menuNav.querySelectorAll('.nav-element[nav-id]');
        const selNavId = this.nodeSelected?.getAttribute('nav-id');
        Logger.log('[MenuStructureBehaviour] Found', allNodes.length, 'nodes to update data-selected, selNavId:', selNavId);
        allNodes.forEach((n) => {
            const isSel = this.selectedNodeIds.has(n.getAttribute('nav-id'));
            n.setAttribute('data-selected', isSel ? 'true' : 'false');
            n.setAttribute('aria-selected', isSel ? 'true' : 'false');
            // Also update CSS class (elements may be recreated by compose())
            if (isSel) {
                n.classList.add('selected');
            } else {
                n.classList.remove('selected');
            }
        });
        Logger.log('[MenuStructureBehaviour] setNodeSelected END, nodeSelected data-selected:', this.nodeSelected?.getAttribute('data-selected'));

        // Update Yjs Awareness with selected page for user presence
        this._updateAwarenessSelectedPage();
    }

    /**
     * Update Yjs Awareness with the currently selected page
     * This allows other users to see which page we're viewing
     */
    _updateAwarenessSelectedPage() {
        try {
            const project = eXeLearning?.app?.project;
            if (!project?._yjsEnabled || !project?._yjsBridge) return;

            const documentManager = project._yjsBridge.getDocumentManager();
            if (!documentManager) return;

            // Get the pageId from the selected node
            let pageId = null;
            if (this.nodeSelected) {
                pageId = this.nodeSelected.getAttribute('page-id') ||
                         this.nodeSelected.getAttribute('nav-id');
            }

            documentManager.setSelectedPage(pageId);
        } catch (error) {
            console.warn('[MenuStructureBehaviour] Failed to update awareness:', error);
        }
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
     * Movement buttons are enabled/disabled based on actual movement possibilities
     */
    enabledActionButtons() {
        this.disableActionButtons();
        const selectedIds = this.getSelectedNodeIds({ excludeRoot: false });
        const nonRootSelectedIds = selectedIds.filter((id) => id !== 'root');
        const topMostNonRootSelectedIds = this.filterTopMostNodeIds(nonRootSelectedIds);

        // "Add" button is always enabled
        this.menuNav.querySelector('.button_nav_action.action_add').disabled = false;

        if (selectedIds.length === 0 || nonRootSelectedIds.length === 0) {
            return;
        }

        const isSingleNonRootSelection = nonRootSelectedIds.length === 1 && selectedIds.length === 1;
        this.menuNav.querySelector('.button_nav_action.action_properties').disabled = !isSingleNonRootSelection;
        this.menuNav.querySelector('.button_nav_action.action_delete').disabled = false;
        this.menuNav.querySelector('.button_nav_action.action_clone').disabled = !isSingleNonRootSelection;
        this.menuNav.querySelector('.button_nav_action.action_import_idevices').disabled = !isSingleNonRootSelection;

        // Movement buttons: enable based on actual possibilities via Yjs
        const binding = eXeLearning.app.project?._yjsBridge?.structureBinding;
        if (binding) {
            const canMoveGroup = (groupMethodName, fallbackMethodName) => {
                if (typeof binding[groupMethodName] === 'function') {
                    return binding[groupMethodName](topMostNonRootSelectedIds);
                }
                return topMostNonRootSelectedIds.every(
                    (id) => typeof binding[fallbackMethodName] === 'function' && binding[fallbackMethodName](id)
                );
            };
            this.menuNav.querySelector('.button_nav_action.action_move_prev').disabled = !canMoveGroup('canMoveGroupPrev', 'canMoveUp');
            this.menuNav.querySelector('.button_nav_action.action_move_next').disabled = !canMoveGroup('canMoveGroupNext', 'canMoveDown');
            this.menuNav.querySelector('.button_nav_action.action_move_up').disabled = !canMoveGroup('canMoveGroupLeft', 'canMoveLeft');
            this.menuNav.querySelector('.button_nav_action.action_move_down').disabled = !canMoveGroup('canMoveGroupRight', 'canMoveRight');
        } else {
            const noMovableSelection = topMostNonRootSelectedIds.length === 0;
            this.menuNav.querySelector('.button_nav_action.action_move_prev').disabled = noMovableSelection;
            this.menuNav.querySelector('.button_nav_action.action_move_next').disabled = noMovableSelection;
            this.menuNav.querySelector('.button_nav_action.action_move_up').disabled = noMovableSelection;
            this.menuNav.querySelector('.button_nav_action.action_move_down').disabled = noMovableSelection;
        }
    }

    /**
     * Get currently selected node IDs, falling back to primary selection.
     *
     * @param {{excludeRoot?: boolean}} options
     * @returns {Array<string>}
     */
    getSelectedNodeIds({ excludeRoot = true } = {}) {
        let ids = Array.from(this.selectedNodeIds);
        if (ids.length === 0 && this.nodeSelected) {
            const selectedId = this.nodeSelected.getAttribute('nav-id');
            if (selectedId) ids = [selectedId];
        }
        if (excludeRoot) {
            ids = ids.filter((id) => id !== 'root');
        }
        return ids;
    }

    /**
     * Remove selected descendants when an ancestor is already selected.
     *
     * @param {Array<string>} ids
     * @returns {Array<string>}
     */
    filterTopMostNodeIds(ids) {
        const selectedSet = new Set(ids);
        const structureData = this.structureEngine.data || {};
        return ids.filter((id) => {
            let currentParent = structureData[id]?.parent;
            while (currentParent) {
                if (selectedSet.has(currentParent)) {
                    return false;
                }
                currentParent = structureData[currentParent]?.parent;
            }
            return true;
        });
    }

    /**
     * Disable all action buttons (including movement buttons)
     */
    disableActionButtons() {
        // Disable action buttons (delete, clone, import, etc.)
        this.menuNav
            .querySelectorAll('#nav_actions .button_nav_action')
            .forEach((button) => {
                button.disabled = true;
            });
        // Disable movement buttons (up, down, left, right)
        this.menuNav
            .querySelectorAll('.buttons_action_container_right .button_nav_action')
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

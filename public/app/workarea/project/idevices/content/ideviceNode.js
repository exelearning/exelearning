import {
    downloadComponentFile,
    buildComponentFileName,
    buildComponentStorageKey,
} from './componentDownloadHelper.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;
/**
 * eXeLearning
 *
 * content Idevice
 */

export default class IdeviceNode {
    constructor(parent, data) {
        this.engine = parent;
        this.id = data.id ? data.id : null;
        // Use Yjs-style IDs when Yjs is enabled for consistency with Yjs structure
        const yjsEnabled = eXeLearning?.app?.project?._yjsEnabled;
        this.odeIdeviceId = data.odeIdeviceId
            ? data.odeIdeviceId
            : yjsEnabled
                ? `idevice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                : this.engine.generateId();
        this.odeIdeviceTypeName = data.odeIdeviceTypeName
            ? data.odeIdeviceTypeName
            : '';
        // Idevice type data class - try multiple name variants
        this.idevice = this.findInstalledIdevice(this.odeIdeviceTypeName);
        // Set api params
        this.setParams(data);
        // Yjs collaboration flags
        this.fromYjs = data.fromYjs || false;
        this.yjsComponentId = data.yjsComponentId || null;
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
        // Number of loops (default to 5000ms / 100ms = 50 iterations if not configured)
        const waitingTime = this.engine.clientCallWaitingTime || 5000;
        this.checkDeviceLoadNumMax = Math.round(waitingTime / this.interval);
        // Check if is valid
        this.checkIsValid();

        this.offlineInstallation = eXeLearning.config.isOfflineInstallation;

        this.nodeContainer = document.querySelector('#node-content-container');

        this.timeIdeviceEditing = null;
        this.editUnlockDevice = null;
        this.inactivityCleanup = null;
        this.inactivityTimer = null; // To save the timer directly

        document.addEventListener(
            'DOMContentLoaded',
            this.checkIdeviceIsEditing()
        );
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
     * Check if Yjs collaborative mode is enabled
     * @returns {boolean}
     */
    isYjsEnabled() {
        return eXeLearning.app?.project?._yjsEnabled === true;
    }

    /**
     * Load properties from Yjs
     * Updates local properties object with values from Yjs
     * Should be called before showing the properties modal to get latest values
     */
    loadPropertiesFromYjs() {
        if (!this.isYjsEnabled()) return;

        const project = eXeLearning.app.project;
        const bridge = project._yjsBridge;

        if (!bridge || !bridge.structureBinding) return;

        const yjsProperties = bridge.structureBinding.getComponentProperties(this.odeIdeviceId);
        if (yjsProperties) {
            for (let [key, value] of Object.entries(yjsProperties)) {
                if (this.properties[key]) {
                    // Convert booleans back to strings for compatibility with modal
                    if (typeof value === 'boolean') {
                        this.properties[key].value = value ? 'true' : 'false';
                    } else {
                        this.properties[key].value = value;
                    }
                }
            }
            Logger.log('[IdeviceNode] Loaded properties from Yjs:', this.odeIdeviceId, yjsProperties);
        }
    }

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
        // Debug: Log htmlView to verify it's being set
        if (data.htmlView !== undefined) {
            console.debug(`[IdeviceNode] setParams: Component ${data.odeIdeviceId || data.id} htmlView length: ${this.htmlView?.length || 0}`);
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
            // Check if property exists in the data from backend
            if (!properties || !properties[key]) {
                continue;
            }

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
        this.ideviceContent.prepend(this.makeIdeviceButtonsElement());
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
        this.ideviceBody.id = this.odeIdeviceId;
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
                    <button class="btn-action-menu btn button-secondary secondary-green button-square button-combo combo-left d-flex justify-content-center align-items-center btn-save-idevice" type="button" id=saveIdevice${id} title="${_('Save')}"><span class="small-icon save-icon-green" aria-hidden="true"></span>${_('Save')}</button>
                    <button class="btn-action-menu btn button-secondary secondary-green button-square button-combo combo-center d-flex justify-content-center align-items-center btn-delete-idevice exe-advanced" type="button" id=deleteIdevice${id} title="${_('Delete')}"><span class="small-icon delete-icon-green" aria-hidden="true"></span><span class='visually-hidden'>${_('Delete')}</span></button>
                    <button class="btn-action-menu btn button-secondary secondary-green button-square button-combo combo-right d-flex justify-content-center align-items-center btn-undo-idevice" type="button" id=undoIdevice${id} title="${_('Discard changes')}"><span class="small-icon undo-icon-green" aria-hidden="true"></span><span class='visually-hidden'>${_('Discard changes')}</span></button>
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
                let lockIndicator = '';

                // Check if locked by another user via Yjs
                const isLockedByOther = this.isLockedByOtherUser();

                if (this.haveEdition && this.valid && !isLockedByOther) {
                    // In some cases the idevice will not be able to be edited
                    blockButtonEditClass = '';
                }

                // If locked by another user, show who has it locked
                if (isLockedByOther) {
                    const lockInfo = this.getLockInfo();
                    const lockUserName = lockInfo?.lockUserName || this.lockUserName || _('Another user');
                    const lockUserColor = lockInfo?.lockUserColor || this.lockUserColor || '#999';
                    lockIndicator = `<span class="lock-indicator" style="color: ${lockUserColor}; font-size: 10px; margin-left: 4px;" title="${_('Editing by')} ${lockUserName}">🔒 ${lockUserName}</span>`;
                }
                // Set the Minify iDevice icon
                let minifyIdeviceIcon = 'chevron-down-icon-green';
                const iDevice = $(
                    "div.idevice_body[idevice-id='" + this.odeIdeviceId + "']"
                );
                if (iDevice.is(':hidden')) {
                    minifyIdeviceIcon = 'chevron-up-icon-green';
                }
                // Build iDevice type icon
                const ideviceTypeIcon = this._getIdeviceTypeIconHtml();
                blockButtonsHTML = `
                <div class="dropdown exe-actions-menu">
                    <div class="idevice-editor-avatar" data-component-id="${id}"></div>
                    ${ideviceTypeIcon}
                    <button class="btn-action-menu btn button-secondary secondary-green button-narrow button-combo combo-left d-flex justify-content-center align-items-center btn-move-up-idevice" type="button" id=moveUpIdevice${id} title="${_('Move up')}"><span class="small-icon arrow-up-icon-green" aria-hidden="true"></span><span class='visually-hidden'>${_('Move up')}</span></button>
                    <button class="btn-action-menu btn button-secondary secondary-green button-narrow button-combo combo-right d-flex justify-content-center align-items-center btn-move-down-idevice" type="button" id=moveDownIdevice${id} title="${_('Move down')}"><span class="small-icon arrow-down-icon-green" aria-hidden="true"></span><span class='visually-hidden'>${_('Move down')}</span></button>
                    <button class="btn-action-menu btn button-secondary secondary-green button-square button-combo combo-left d-flex justify-content-center align-items-center btn-edit-idevice ${blockButtonEditClass}" type="button" id=editIdevice${id} title="${_('Edit')}" ${blockButtonEditClass}><span class="small-icon edit-icon-green" aria-hidden="true"></span>${_('Edit')}${lockIndicator}</button>
                    <button class="btn-action-menu btn-action-menu btn button-secondary secondary-green button-square button-combo combo-center d-flex justify-content-center align-items-center btn-delete-idevice" type="button" id=deleteIdevice${id} title="${_('Delete')}"><span class="small-icon delete-icon-green" aria-hidden="true"></span><span class='visually-hidden'>${_('Delete')}</span></button>                    
                    <button class="btn-action-menu btn-action-menu btn button-secondary secondary-green button-square button-combo combo-right d-flex justify-content-center align-items-center exe-advanced" type="button" id="dropdownMenuButtonIdevice${id}" data-bs-toggle="dropdown" aria-expanded="false" title="${_('Actions')}"><span class="micro-icon dots-menu-horizontal-icon-green" aria-hidden="true"></span><span class='visually-hidden'>${_('Actions')}</span></button>
                    <ul class="dropdown-menu${dropdownColumns} button-action-block exe-advanced" aria-labelledby="dropdownMenuButtonIdevice${id}">
                        <li><button class="dropdown-item button-action-block" id="propertiesIdevice${id}"><span class="small-icon settings-icon-green" aria-hidden="true"></span>${_('Properties')}</button></li>
                        <li><button class="dropdown-item button-action-block" id="cloneIdevice${id}"><span class="small-icon duplicate-icon-green" aria-hidden="true"></span>${_('Clone')}</button></li>
                        <li><button class="dropdown-item button-action-block" id="moveIdevice${id}"><span class="small-icon move-icon-green" aria-hidden="true"></span>${_('Move to')}</button></li>
                        <li class="exe-advanced"><button class="dropdown-item button-action-block" id="exportIdevice${id}"><span class="small-icon download-icon-green" aria-hidden="true"></span>${_('Export')}</span></button></li>
                    </ul>
                    <button class="btn-action-menu btn button-secondary secondary-green button-narrow button-combo combo-left d-flex justify-content-center align-items-center btn-minify-idevice" type="button" id=minifyIdevice${id} title="${_('Toggle content')}"><span id="minifyIdevice${id}icon" class="small-icon ${minifyIdeviceIcon}" aria-hidden="true"></span><span class='visually-hidden'>${_('Toggle content')}</span></button>
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
                this.addBehaviourMinifyIdeviceButton();
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
     * Check if this iDevice is locked by another user via Yjs
     * @returns {boolean}
     */
    isLockedByOtherUser() {
        // Check if marked as locked by remote (set during remote rendering)
        if (this.lockedByRemote) {
            return true;
        }

        // Check via Yjs lockManager
        const lockManager = this.getLockManager();
        if (!lockManager) {
            return false;
        }

        const componentId = this.yjsComponentId || this.odeIdeviceId;
        return lockManager.isLocked(componentId);
    }

    /**
     * Get lock info for this iDevice from Yjs
     * @returns {Object|null} Lock info with userName, userColor, etc.
     */
    getLockInfo() {
        // If locked by remote, use stored info
        if (this.lockedByRemote) {
            return {
                lockUserName: this.lockUserName || _('Another user'),
                lockUserColor: this.lockUserColor || '#999',
            };
        }

        // Get from Yjs lockManager
        const lockManager = this.getLockManager();
        if (!lockManager) {
            return null;
        }

        const componentId = this.yjsComponentId || this.odeIdeviceId;
        const lockInfo = lockManager.getLockInfo(componentId);

        if (lockInfo) {
            return {
                lockUserName: lockInfo.user?.name || _('Another user'),
                lockUserColor: lockInfo.user?.color || '#999',
                clientId: lockInfo.clientId,
                timestamp: lockInfo.timestamp,
            };
        }

        // Try to get from Yjs component data
        const bridge = this.engine?.project?._yjsBridge;
        if (bridge) {
            const compMap = bridge.structureBinding?.getComponentMap(componentId);
            if (compMap) {
                return {
                    lockUserName: compMap.get('lockUserName') || _('Another user'),
                    lockUserColor: compMap.get('lockUserColor') || '#999',
                };
            }
        }

        return null;
    }

    /**
     * Get the Yjs lock manager
     * @returns {YjsLockManager|null}
     */
    getLockManager() {
        return this.engine?.project?._yjsBridge?.lockManager || null;
    }

    /**
     * Update the lock indicator in the iDevice header
     * Called when lock status changes (e.g., when content is saved by remote user)
     */
    updateLockIndicator() {
        // Simply re-render the buttons which includes the lock indicator
        if (this.ideviceButtons) {
            this.makeIdeviceButtonsElement();
        }
    }

    /**
     * Create a button to add a Text iDevice
     */
    createAddTextBtn() {
        eXeLearning.app.menus.menuStructure.engine.menuStructureBehaviour.createAddTextBtn();
    }

    /*********************************
     BUTTONS EVENTS
     *********************************/
    /**
     * Tracks inactivity in a DOM element
     * @param {string} elementId - ID of element to monitor
     * @param {number} timeoutSeconds - Seconds of inactivity to wait
     * @param {function} callback - Function to execute after inactivity
     * @returns {function} Cleanup function to stop tracking
     */
    inactivityInElement(elementId, timeoutSeconds, callback) {
        // Debug
        Logger.log(`Setting up inactivity tracker for ${elementId}`);

        // Debug
        if (!elementId) {
            console.error('Element ID is undefined');
            return () => {};
        }

        // Cancel any existing timer first
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }

        const element = document.getElementById(elementId);

        if (!element) {
            Logger.log(`Element with ID ${elementId} not found`);
            return () => {};
        }

        // Create storage for multiple iDevices if it doesn't exist
        if (!this.inactivityTimers) this.inactivityTimers = {};
        if (!this.inactiveStates) this.inactiveStates = {};

        // Clears any previous timers for that item
        if (this.inactivityTimers[elementId]) {
            clearTimeout(this.inactivityTimers[elementId]);
        }

        const resetTimer = () => {
            // Logger.log(`[Inactivity] Event triggered on ${elementId}`);

            // If inactive ? now active ? send HIDE_UNLOCK
            if (this.inactiveStates[elementId]) {
                Logger.log(
                    `[Inactivity] User is active again, sending HIDE_UNLOCK for ${elementId}`
                );
                this.updateResourceLockStatus({
                    odeIdeviceId: this.odeIdeviceId,
                    blockId: this.blockId,
                    actionType: 'HIDE_UNLOCK_BUTTON',
                    destinationPageId: this.block?.pageId ?? '',
                });
                this.inactiveStates[elementId] = false;
            }

            // Reset the timer
            clearTimeout(this.inactivityTimers[elementId]);
            this.inactivityTimers[elementId] = setTimeout(() => {
                const now = new Date();
                const odeElementSave = document.getElementById(
                    'saveIdevice' + elementId
                );

                Logger.log(
                    `[${now.toLocaleTimeString()}] Inactivity timeout for ${elementId}. Sending FORCE_UNLOCK...`
                );

                this.inactiveStates[elementId] = true; // Now inactive

                if (odeElementSave) callback(); // Show unlock button
                this.updateResourceLockStatus({
                    odeIdeviceId: this.odeIdeviceId,
                    blockId: this.blockId,
                    actionType: 'FORCE_UNLOCK',
                    destinationPageId: this.block?.pageId ?? '',
                });
                if (odeElementSave) {
                    callback();
                }
            }, timeoutSeconds * 1000);
        };

        const events = [
            'mousedown',
            'mousemove',
            'mouseover',
            'scroll',
            'touchstart',
            'click',
        ];
        events.forEach((event) => {
            element.addEventListener(event, resetTimer);
        });

        // Main keyboard events for each idevice block
        eXeLearning.app.project.idevices.components.blocks.forEach(
            (blockNode) => {
                const blockElement = blockNode.blockContent;
                if (!blockElement) return;

                // Main block level events
                const keyEvents = ['keydown', 'keypress'];

                keyEvents.forEach((event) => {
                    blockElement.addEventListener(event, resetTimer, true);
                });

                // Also in the TinyMCE iframe
                const iframe = blockElement.querySelector(
                    'iframe.tox-edit-area__iframe'
                );
                if (iframe?.contentDocument?.body) {
                    keyEvents.forEach((event) => {
                        iframe.contentDocument.body.addEventListener(
                            event,
                            resetTimer,
                            true
                        );
                    });
                }
            }
        );

        // Init tracking
        resetTimer();

        // Returns cleanup function
        return () => {
            clearTimeout(this.inactivityTimers[elementId]);
            delete this.inactivityTimers[elementId];
            delete this.inactiveStates[elementId];
            Logger.log(`Inactivity tracker cleaned for ${elementId}`);

            events.forEach((event) => {
                element.removeEventListener(event, resetTimer);
            });
        };
    }

    /**
     * Updates the resource lock status with the specified parameters
     * @param {Object} params - Configuration object
     * @param {boolean} [params.odeSessionId=false] - Session ID (default: false)
     * @param {string|null} [params.odeNavStructureSyncId=null] - Navigation sync ID (default: null)
     * @param {string} params.odeIdeviceId - The ID of the iDevice element
     * @param {string} params.blockId - The ID of the containing block
     * @param {string} params.actionType - Action type ('EDIT_BLOCK', 'FORCE_UNLOCK', etc.)
     * @param {string} [params.destinationPageId=''] - Destination page ID (default: empty string)
     * @example
     * // Minimal usage
     * updateResourceLockStatus({
     *   odeIdeviceId: 'idevice123',
     *   blockId: 'block456',
     *   actionType: 'FORCE_UNLOCK'
     * });
     *
     * // Full usage
     * updateResourceLockStatus({
     *   odeSessionId: true,
     *   odeNavStructureSyncId: 'nav789',
     *   odeIdeviceId: 'idevice123',
     *   blockId: 'block456',
     *   actionType: 'EDIT_BLOCK',
     *   destinationPageId: 'page101'
     * });
     */
    updateResourceLockStatus({
        odeSessionId = false,
        odeNavStructureSyncId = null,
        odeIdeviceId,
        blockId,
        actionType,
        destinationPageId = '',
        pageId = '', // Collaborative
    } = {}) {
        // No-op: Yjs handles synchronization now
    }

    /**
     * Configures the inactivity tracker with proper cleanup
     */
    addBehaviourSaveIdeviceButton() {
        this.timeIdeviceEditing = new Date().getTime();

        const element = document.getElementById(this.odeIdeviceId);

        const handleTimeout = () => {
            this.editUnlockDevice = 'FORCE_UNLOCK';
            this.updateResourceLockStatus({
                odeIdeviceId: this.odeIdeviceId,
                blockId: this.blockId,
                actionType: 'FORCE_UNLOCK',
            });
        };

        const setupInactivityTracker = (timeout) => {
            // Clean previous tracker if exists
            if (this.inactivityCleanup) {
                this.inactivityCleanup();
            }

            // Setup new tracker
            this.inactivityCleanup = this.inactivityInElement(
                this.odeIdeviceId,
                timeout,
                handleTimeout
            );
        };

        // Initialize with API timeout or fallback
        const initializeTracker = () => {
            try {
                eXeLearning.app.api
                    .getResourceLockTimeout()
                    .then((timeout) => {
                        Logger.log('Lock timeout:', timeout);
                        setupInactivityTracker(timeout);
                    })
                    .catch((error) => {
                        console.error('Timeout API error:', error);
                        setupInactivityTracker(900000); // 15 min fallback
                    });
            } catch (error) {
                console.error('Error:', error);
                setupInactivityTracker(900000); // 15 min fallback
            }
        };

        // Save button handler
        this.ideviceButtons
            .querySelector('#saveIdevice' + this.odeIdeviceId)
            .addEventListener('click', (e) => {
                if (e.target.disabled) return;

                this.toogleIdeviceButtonsState(true);
                // Save and desactivate component flag
                this.save(true);
                // Create the "Add Text" button
                this.createAddTextBtn();

                this.updateResourceLockStatus({
                    odeIdeviceId: this.odeIdeviceId,
                    blockId: this.blockId,
                    actionType: 'SAVE_BLOCK',
                    pageId:
                        this.block?.pageId ??
                        eXeLearning.app.project.structure.getSelectNodePageId(), // Collaborative
                });

                // Reset inactivity timer on save
                setupInactivityTracker(900000); // Reuse current timeout or fallback
            });

        // Initial setup
        initializeTracker();
    }

    /**
     * Cleanup resources when needed
     */
    cleanupInactivityTracker() {
        // Debug
        Logger.log('Attempting to clean up timer');

        if (this.inactivityCleanup) {
            Logger.log('Cleaning up inactivity timer');
            this.inactivityCleanup();
            this.inactivityCleanup = null;
        } else {
            Logger.log('No inactivityCleanup function to call');
        }

        // Clear the timer directly
        if (this.inactivityTimer) {
            Logger.log('Clearing inactivity timer directly');
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = null;
        }
    }

    checkIdeviceIsEditing() {
        this.updateResourceLockStatus({
            odeIdeviceId: this.odeIdeviceId,
            blockId: this.blockId,
            actionType: 'LOADING',
            pageId:
                this.block?.pageId ??
                eXeLearning.app.project.structure.getSelectNodePageId(),
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
                            // Load latest properties from Yjs before showing modal
                            this.loadPropertiesFromYjs();
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
        this.timeIdeviceEditing = new Date().getTime();
        this.ideviceButtons
            .querySelector('#editIdevice' + this.odeIdeviceId)
            .addEventListener('click', (e) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                if (e.target.disabled) return;
                // Check if locked by another user - don't allow editing
                if (this.isLockedByOtherUser()) {
                    const lockInfo = this.getLockInfo();
                    const lockUserName = lockInfo?.lockUserName || this.lockUserName || _('Another user');
                    eXeLearning.app.modals.alert.show({
                        title: _('iDevice locked'),
                        body: _('This iDevice is being edited by') + ' ' + lockUserName,
                        contentId: 'warning',
                    });
                    return;
                }
                this.toogleIdeviceButtonsState(true);
                eXeLearning.app.project
                    .changeUserFlagOnEdit(
                        true,
                        this.odeNavStructureSyncId,
                        this.blockId,
                        this.odeIdeviceId,
                        null,
                        this.timeIdeviceEditing,
                        'EDIT_IDEVICE',
                        this.block?.pageId ??
                            eXeLearning.app.project.structure.getSelectNodePageId() // Collaborative
                    )
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
                            this.edition();
                        }
                    });
            });
    }

    /**
     *
     */
    addBehaviourEditionIdeviceDoubleClick() {
        this.timeIdeviceEditing = new Date().getTime();
        this.ideviceBody.addEventListener('dblclick', (element) => {
            if (this.mode == 'export') {
                // Check if locked by another user - don't allow editing
                if (this.isLockedByOtherUser()) {
                    const lockInfo = this.getLockInfo();
                    const lockUserName = lockInfo?.lockUserName || this.lockUserName || _('Another user');
                    eXeLearning.app.modals.alert.show({
                        title: _('iDevice locked'),
                        body: _('This iDevice is being edited by') + ' ' + lockUserName,
                        contentId: 'warning',
                    });
                    return;
                }
                eXeLearning.app.project
                    .changeUserFlagOnEdit(
                        true,
                        this.odeNavStructureSyncId,
                        this.blockId,
                        this.odeIdeviceId,
                        null,
                        this.timeIdeviceEditing,
                        'EDIT_IDEVICE',
                        this.block?.pageId ??
                            eXeLearning.app.project.structure.getSelectNodePageId() // Collaborative
                    )
                    .then((response) => {
                        if (response.responseMessage !== 'OK') {
                            eXeLearning.app.modals.alert.show({
                                title: _('iDevice error'),
                                body: _(response.responseMessage),
                                contentId: 'error',
                            });
                        } else {
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
                        true,
                        null
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
                                    this.remove(true);
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
                        // Clear the inactivity timer
                        this.cleanupInactivityTracker();

                        // Create the "Add Text" button
                        this.createAddTextBtn();
                        eXeLearning.app.project.changeUserFlagOnEdit(
                            false,
                            this.odeNavStructureSyncId,
                            this.blockId,
                            this.odeIdeviceId,
                            null,
                            this.timeIdeviceEditing,
                            'UNDO_IDEVICE',
                            this.block?.pageId ??
                                eXeLearning.app.project.structure.getSelectNodePageId() // Collaborative
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
                                        // Yjs handles undo/redo
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
    addBehaviourMinifyIdeviceButton() {
        this.ideviceButtons
            .querySelector('#minifyIdevice' + this.odeIdeviceId)
            .addEventListener('click', (element) => {
                if (eXeLearning.app.project.checkOpenIdevice()) return;
                const iDevice = $(
                    "div.idevice_body[idevice-id='" + this.odeIdeviceId + "']"
                );
                if (iDevice.length != 1) return false;
                const icn = this.ideviceButtons.querySelector(
                    '#minifyIdevice' + this.odeIdeviceId + 'icon'
                );
                if (icn.classList.contains('chevron-down-icon-green')) {
                    icn.classList.remove('chevron-down-icon-green');
                    icn.classList.add('chevron-up-icon-green');
                    iDevice.hide();
                } else {
                    icn.classList.remove('chevron-up-icon-green');
                    icn.classList.add('chevron-down-icon-green');
                    iDevice.show();
                }
                return false;
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
        $(
            'button.btn-action-menu:not([data-bs-toggle="dropdown"]):not(.btn-edit-idevice):not(.btn-save-idevice)',
            this.ideviceButtons
        ).addClass('exe-app-tooltip');
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
                                body: _('No broken links found.'),
                            });
                        }
                    },
                );
            },
        );
    }
    */

    /**
     * Download iDevice as .idevice file
     * @param {*} odeBlockId
     * @param {*} odeIdeviceId
     */
    async downloadIdeviceSelected(odeBlockId, odeIdeviceId) {
        try {
            // Get the Yjs bridge and document manager
            const yjsBridge = eXeLearning.app.project._yjsBridge;
            if (!yjsBridge) {
                throw new Error('Yjs bridge not initialized');
            }
            const documentManager = yjsBridge.documentManager;
            const assetCache = eXeLearning.app.project._assetCache || null;
            const assetManager = yjsBridge.assetManager || null;

            const exporter = window.createExporter(
                'COMPONENT',
                documentManager,
                assetCache,
                null,
                assetManager
            );
            const result = await exporter.exportAndDownload(odeBlockId, odeIdeviceId);
            if (!result.success) {
                eXeLearning.app.modals.alert.show({
                    title: _('Download error'),
                    body: result.error || _('Failed to export iDevice'),
                    contentId: 'error',
                });
            }
        } catch (error) {
            console.error('[ideviceNode] Export failed:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Download error'),
                body: error.message,
                contentId: 'error',
            });
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
            'Select the page where you want to move the iDevice. It will be placed at the end of the page.'
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
                await this.loadExportIdevice();
                await this.ideviceInitExport();
                break;
        }
        this.updateMode(mode);
        this.engine.updateMode();
        setTimeout(() => {
            this.makeIdeviceButtonsElement();
        }, 100);
    }

    /**
     * Load export scripts and styles for this iDevice
     * Similar to loadEditionIdevice() but for export mode
     */
    async loadExportIdevice() {
        // Load idevice export files (scripts and styles)
        this.loadScriptsExport();
        await this.loadStylesExport();
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
     * Resolves {{context_path}} URLs to blob URLs from IndexedDB cache
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

        // Escape HTML entities inside <pre><code> blocks to display code examples correctly
        if (typeof window.escapePreCodeContent === 'function') {
            html = window.escapePreCodeContent(html);
        }

        // Add MIME types to media elements BEFORE resolving URLs
        // (while asset:// URLs still contain filename with extension)
        if (typeof window.addMediaTypes === 'function') {
            html = window.addMediaTypes(html);
        }

        // Simplify MediaElement.js structures to native HTML5 video/audio
        // (fixes playback issues with large videos)
        if (typeof window.simplifyMediaElements === 'function') {
            html = window.simplifyMediaElements(html);
        }

        // Resolve asset:// URLs to blob URLs from cache
        if (typeof window.resolveAssetUrls === 'function') {
            html = window.resolveAssetUrls(html);
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
        // Check if this iDevice is locked by another user (remote editing)
        // For JSON-type iDevices without content, show placeholder instead of failing
        if (this.isLockedByOtherUser()) {
            const hasNoContent = !this.htmlView || this.htmlView.trim() === '';
            const isJsonType = this.idevice?.componentType === 'json';

            // For JSON iDevices without content, show placeholder
            // (the export object won't load without content)
            if (isJsonType && hasNoContent) {
                Logger.log(`[IdeviceNode] Remote JSON iDevice ${this.odeIdeviceId} locked without content, showing placeholder`);
                return this.showLockedPlaceholder();
            }

            // For HTML iDevices without content, also show placeholder
            if (!isJsonType && hasNoContent) {
                Logger.log(`[IdeviceNode] Remote HTML iDevice ${this.odeIdeviceId} locked without content, showing placeholder`);
                return this.showLockedPlaceholder();
            }
        }

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
     * Show a placeholder for iDevices being edited by another user
     * Used when a remote iDevice is locked and cannot be rendered normally
     *
     * @returns {Object} Response indicating placeholder was shown
     */
    showLockedPlaceholder() {
        const lockInfo = this.getLockInfo();
        const userName = lockInfo?.lockUserName || _('Another user');
        const userColor = lockInfo?.lockUserColor || '#999';

        // Create placeholder HTML
        const placeholderHtml = `
            <div class="idevice-locked-placeholder" style="
                background-color: #f8f9fa;
                border: 2px dashed ${userColor};
                border-radius: 8px;
                padding: 30px 20px;
                text-align: center;
                min-height: 100px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 10px;
            ">
                <span style="font-size: 24px;">🔒</span>
                <p style="margin: 0; color: #666; font-size: 14px;">
                    ${_('Being edited by')}
                    <strong style="color: ${userColor};">${userName}</strong>
                </p>
                <p style="margin: 0; color: #999; font-size: 12px;">
                    ${_('Content will appear when saved')}
                </p>
            </div>
        `;

        // Set the placeholder in the body
        if (this.ideviceBody) {
            this.ideviceBody.innerHTML = placeholderHtml;
        }

        Logger.log(`[IdeviceNode] Showing locked placeholder for ${this.odeIdeviceId}, locked by ${userName}`);
        return { init: 'locked', lockedBy: userName };
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

        // Typeset LaTeX in iDevice content after loading
        this.typesetLatexInContent();

        return response;
    }

    /**
     * Typeset LaTeX formulas in the iDevice content using MathJax
     * Called after content is loaded into the DOM
     */
    typesetLatexInContent() {
        if (!this.ideviceBody) return;

        // Check if content contains LaTeX delimiters
        const content = this.ideviceBody.textContent || '';
        if (/(?:\\\(|\\\[|\\begin\{|\$\$)/.test(content)) {
            if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
                MathJax.typesetPromise([this.ideviceBody]).catch(err => {
                    Logger.log('[IdeviceNode] MathJax typeset error:', err);
                });
            }
        }
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
            // Ensure ideviceId is in jsonProperties for renderBehaviour selectors
            this.jsonProperties.ideviceId = this.odeIdeviceId;
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
                // Pass ideviceId even when jsonProperties is empty - needed for renderBehaviour selectors
                const fallbackData = { ideviceId: this.odeIdeviceId };
                this.exportObject.renderBehaviour(fallbackData, this.accesibility);
                this.exportObject.init(fallbackData, this.accesibility);
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
        Logger.log(params);
        let response = await this.apiSendDataService(
            'putSaveIdevice',
            params,
            true
        );

        /*await eXeLearning.app.project.changeUserFlagOnEdit(
            false,
            this.odeNavStructureSyncId,
            this.blockId,
            this.odeIdeviceId,
            null,
            this.timeIdeviceEditing,
            'UNDO_IDEVICE',
            this.block?.pageId ?? eXeLearning.app.project.structure.getSelectNodePageId() // Collaborative
        );*/

        if (response.responseMessage == 'OK') {
            // Store the component ID from response (important for Yjs mode)
            if (response.odeComponentsSyncId) {
                this.odeComponentsSyncId = response.odeComponentsSyncId;
                this.id = response.odeComponentsSyncId;
            }
            if (response.odeComponentsSync?.id) {
                this.odeComponentsSyncId = this.odeComponentsSyncId || response.odeComponentsSync.id;
                this.id = this.id || response.odeComponentsSync.id;
            }
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
                } else {
                    eXeLearning.app.modals.alert.show({
                        title: _('iDevice error'),
                        body: _(
                            'An error occurred while saving the iDevice’s properties to the database.'
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
        // Use Yjs for moving to different block when enabled
        if (this.isYjsEnabled()) {
            return await this.moveToBlockViaYjs();
        }

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
     * Move component to different block via Yjs
     * @returns {Object} Mock response object
     */
    async moveToBlockViaYjs() {
        try {
            const bridge = eXeLearning.app?.project?._yjsBridge;
            const structureBinding = bridge?.structureBinding;

            if (!structureBinding) {
                console.warn('[IdeviceNode] Cannot move to block via Yjs: structureBinding not available');
                return { responseMessage: 'ERROR' };
            }

            // Try with multiple component IDs
            const componentIds = [this.yjsComponentId, this.odeIdeviceId, this.id].filter(Boolean);
            // Try with multiple block IDs
            const blockIds = [this.block?.blockId, this.blockId, this.block?.id].filter(Boolean);

            let success = false;
            for (const componentId of componentIds) {
                for (const targetBlockId of blockIds) {
                    success = structureBinding.moveComponentToBlock(componentId, targetBlockId, this.order);
                    if (success) {
                        Logger.log('[IdeviceNode] Move to block succeeded with compId:', componentId, 'blockId:', targetBlockId);
                        break;
                    }
                }
                if (success) break;
            }

            if (success) {
                // Update list of components to assign the idevices to their respective blocks
                this.engine.setParentsAndChildrenIdevicesBlocks(true);
                return { responseMessage: 'OK' };
            }

            return { responseMessage: 'ERROR' };
        } catch (error) {
            console.error('[IdeviceNode] Error moving to block via Yjs:', error);
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Update page of idevice in database
     *
     * @return {Array}
     */
    async apiUpdatePage(odeNavStructureSyncId) {
        // Can't move component to current page
        if (this.odeNavStructureSyncId == odeNavStructureSyncId) return false;

        // Use Yjs for moving to different page when enabled
        if (this.isYjsEnabled()) {
            return await this.moveToPageViaYjs(odeNavStructureSyncId);
        }

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
            'odeIdeviceId',
            'odeIdeviceTypeName',
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
     * Move component to different page via Yjs
     * @param {string} targetPageId - Target page ID
     * @returns {Object} Mock response object
     */
    async moveToPageViaYjs(targetPageId) {
        try {
            const blockName = this.idevice?.title || '';
            const bridge = eXeLearning.app?.project?._yjsBridge;
            const structureBinding = bridge?.structureBinding;

            if (!structureBinding) {
                console.warn('[IdeviceNode] Cannot move to page via Yjs: structureBinding not available');
                return { responseMessage: 'ERROR' };
            }

            // Try with multiple component IDs
            const componentIds = [this.yjsComponentId, this.odeIdeviceId, this.id].filter(Boolean);
            let result = null;
            for (const componentId of componentIds) {
                result = structureBinding.moveComponentToPage(componentId, targetPageId, blockName);
                if (result) {
                    Logger.log('[IdeviceNode] Move to page succeeded with compId:', componentId);
                    break;
                }
            }

            if (result) {
                // Update internal references
                this.odeNavStructureSyncId = targetPageId;
                this.blockId = result.blockId;

                // Remove idevice view
                this.remove();
                // Update list of components to assign the idevices to their respective blocks
                this.engine.setParentsAndChildrenIdevicesBlocks(true);
                return { responseMessage: 'OK' };
            }

            return { responseMessage: 'ERROR' };
        } catch (error) {
            console.error('[IdeviceNode] Error moving to page via Yjs:', error);
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Update order of idevice in database
     *
     * @return {Array}
     */
    async apiUpdateOrder() {
        // Use Yjs for reordering when enabled
        if (this.isYjsEnabled()) {
            return await this.reorderViaYjs();
        }

        let params = ['odeComponentsSyncId', 'order'];
        // Update order in database
        let response = await this.apiSendDataService(
            'putReorderIdevice',
            params,
            true
        );
        if (response.responseMessage == 'OK') {
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
     * Reorder component via Yjs
     * @returns {Object} Mock response object
     */
    async reorderViaYjs() {
        try {
            const bridge = eXeLearning.app?.project?._yjsBridge;
            const structureBinding = bridge?.structureBinding;

            if (!structureBinding) {
                console.warn('[IdeviceNode] Cannot reorder via Yjs: structureBinding not available');
                return { responseMessage: 'ERROR' };
            }

            // Try with multiple IDs: yjsComponentId, odeIdeviceId, id
            const idsToTry = [this.yjsComponentId, this.odeIdeviceId, this.id].filter(Boolean);
            let success = false;
            for (const componentId of idsToTry) {
                success = structureBinding.reorderComponent(componentId, this.order);
                if (success) {
                    Logger.log('[IdeviceNode] Reorder succeeded with id:', componentId);
                    break;
                }
            }

            if (success) {
                // Remove class moving of idevice
                setTimeout(() => {
                    this.ideviceContent?.classList.remove('moving');
                }, this.engine.movingClassDuration);
                return { responseMessage: 'OK' };
            }

            return { responseMessage: 'ERROR' };
        } catch (error) {
            console.error('[IdeviceNode] Error reordering via Yjs:', error);
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Clone the idevice
     *
     */
    async apiCloneIdevice() {
        // Use Yjs for cloning (legacy API removed)
        return await this.cloneViaYjs();
    }

    /**
     * Delete the idevice from the database
     *
     */
    async apiDeleteIdevice() {
        // Check if Yjs mode is enabled
        if (this.isYjsEnabled() && eXeLearning.app.project.deleteComponentViaYjs) {
            return await this.deleteViaYjs();
        }

        // Legacy: Delete via API
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
     * Delete idevice via Yjs collaborative editing
     * @returns {Object}
     */
    async deleteViaYjs() {
        try {
            const project = eXeLearning.app.project;

            // Delete via Yjs - syncs to other clients automatically
            const success = project.deleteComponentViaYjs(this.id);

            if (success) {
                Logger.log('[IdeviceNode] Deleted component via Yjs:', this.id);
                return { responseMessage: 'OK' };
            } else {
                throw new Error('Failed to delete component via Yjs');
            }
        } catch (error) {
            console.error('[IdeviceNode] Yjs delete error:', error);
            let defaultErrorMessage = _(
                'An error occurred while removing the component'
            );
            this.showModalMessageErrorDatabase(
                { responseMessage: 'ERROR' },
                defaultErrorMessage
            );
            return false;
        }
    }

    /**
     * Clone idevice via Yjs collaborative editing
     * @returns {Object}
     */
    async cloneViaYjs() {
        try {
            const project = eXeLearning.app.project;
            // Try multiple sources for pageId (same pattern as other methods)
            const pageId =
                this.block?.pageId ??
                this.odeNavStructureSyncId ??
                this.pageId ??
                project.structure?.getSelectNodePageId?.() ??
                project.structure?.nodeSelected?.id;
            // Try multiple sources for blockId
            const blockId = this.block?.blockId ?? this.blockId ?? this.block?.id;

            if (!pageId || !blockId) {
                console.error('[IdeviceNode] cloneViaYjs missing IDs:', { pageId, blockId, block: this.block });
                throw new Error('Missing pageId or blockId for clone');
            }

            // Clone via Yjs - syncs to other clients automatically
            const clonedComponent = project.cloneComponentViaYjs(pageId, blockId, this.id);

            if (clonedComponent) {
                Logger.log('[IdeviceNode] Cloned component via Yjs:', this.id, '→', clonedComponent.id);

                // Reload page content to show the cloned idevice
                await this.engine.loadApiIdevicesInPage(true);

                return { responseMessage: 'OK', clonedComponent };
            } else {
                throw new Error('Failed to clone component via Yjs');
            }
        } catch (error) {
            console.error('[IdeviceNode] Yjs clone error:', error);
            let defaultErrorMessage = _(
                'An error occurred while cloning the component'
            );
            this.showModalMessageErrorDatabase(
                { responseMessage: 'ERROR' },
                defaultErrorMessage
            );
            return { responseMessage: 'ERROR' };
        }
    }

    /**
     * Convert base64 data URL to File object
     * @param {string} base64 - Data URL (e.g., data:image/jpeg;base64,...)
     * @param {string} filename - Filename
     * @returns {File} File object
     */
    base64ToFile(base64, filename) {
        // Extract MIME type and base64 data
        const match = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
            throw new Error('Invalid base64 data URL');
        }
        const mimeType = match[1];
        const base64Data = match[2];

        // Decode base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Create File object
        return new File([bytes], filename, { type: mimeType });
    }

    /**
     * Upload file and also create asset for client-side display
     *
     * @param {string} file - Base64 data URL
     * @param {String} filename
     * @returns {Object} Response with asset:// URLs
     */
    async apiUploadFile(file, filename) {
        let params = {
            odeIdeviceId: this.odeIdeviceId,
            file: file,
            filename: filename,
            createThumbnail: true,
        };
        let response = await eXeLearning.app.api.postUploadFileResource(params);

        // Also create asset for client-side display (preview, blob URLs)
        const assetManager = eXeLearning.app?.project?._yjsBridge?.assetManager;
        if (assetManager && response?.savedPath) {
            try {
                // Convert base64 to File object
                const fileObj = this.base64ToFile(file, filename);

                // Create asset using AssetManager
                const assetUrl = await assetManager.insertImage(fileObj);

                // Parse the asset URL: asset://uuid/filename
                const assetMatch = assetUrl.match(/^asset:\/\/([^/]+)\/(.+)$/);
                if (assetMatch) {
                    const assetId = assetMatch[1];
                    const assetFilename = assetMatch[2];

                    // Update response to use asset:// URLs
                    // savedPath ends with / so savedPath + savedFilename = asset://uuid/filename
                    response.savedPath = `asset://${assetId}/`;
                    response.savedFilename = assetFilename;
                    // Use same asset for thumbnail (full image works as thumbnail)
                    response.savedThumbnailName = assetFilename;

                    // Provide a blob URL for preview in dialogs (audio/video players can't use asset:// directly)
                    const blobUrl = await assetManager.resolveAssetURL(assetUrl);
                    if (blobUrl) {
                        response.previewUrl = blobUrl;
                    }

                    Logger.log(`[IdeviceNode] Created asset for upload: ${assetUrl}`);
                }
            } catch (e) {
                Logger.warn('[IdeviceNode] Failed to create asset from upload:', e);
                // Fallback to server paths if asset creation fails
            }
        }

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
            if (!this.block?.idevices?.includes(this)) {
                // Collaborative
                this.block?.idevices?.push(this);
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

        let safeBlockOrder = null;
        if (this.block && this.block.getCurrentOrder) {
            let bo = this.block.getCurrentOrder();
            if (bo >= 0) {
                safeBlockOrder = bo;
            } else if (typeof this.block.getFallbackPageOrder === 'function') {
                safeBlockOrder = this.block.getFallbackPageOrder();
            }
        }
        return {
            odeComponentsSyncId: this.id,
            odeVersionId: defaultVersion,
            odeSessionId: defaultSession,
            odeNavStructureSyncId: this.odeNavStructureSyncId
                ? this.odeNavStructureSyncId
                : defaultOdeNavStructureSyncId,
            odePageId: this.pageId ? this.pageId : defaultOdePageId,
            odePagStructureSyncId: this.block ? this.block.id : null,
            odePagStructureSyncOrder: safeBlockOrder,
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
        console.debug(`[IdeviceNode] getViewHTML: Component ${this.odeIdeviceId} htmlView length: ${this.htmlView?.length || 0}`);
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

        // Release the lock and clear editing state in Yjs
        if (this.isYjsEnabled()) {
            const componentId = this.yjsComponentId || this.odeIdeviceId;
            const bridge = this.engine?.project?._yjsBridge;

            // Release the lock
            const lockManager = this.getLockManager();
            if (lockManager) {
                lockManager.releaseLock(componentId);
            }

            // Clear lock info from the component in Yjs
            if (bridge?.structureBinding) {
                bridge.structureBinding.updateComponent(componentId, {
                    lockedBy: null,
                    lockUserName: null,
                    lockUserColor: null
                });
            }

            // Clear editing component in awareness
            const documentManager = bridge?.getDocumentManager();
            if (documentManager?.setEditingComponent) {
                documentManager.setEditingComponent(null);
            }
        }

        if (saveOk) {
            // this.sendPublishedNotification();
            // Note: generateContentExportView is called by loadInitScriptIdevice('export')
            // through ideviceInitExportLoadSuccess after ensuring export scripts are loaded

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
            }
            setTimeout(() => this.loadLegacyExeFunctionalitiesExport(), 100);
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

            // Set editing component in Yjs awareness
            if (this.isYjsEnabled()) {
                const componentId = this.yjsComponentId || this.odeIdeviceId;
                const bridge = this.engine?.project?._yjsBridge;
                const documentManager = bridge?.getDocumentManager();
                if (documentManager?.setEditingComponent) {
                    documentManager.setEditingComponent(componentId);
                }
            }
        } else {
            eXeLearning.app.modals.alert.show({
                title: _('Not allowed'),
                body: _(
                    'You cannot edit another iDevice until you save the current one'
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
        this.block?.removeIdeviceOfListById?.(this.id); // Collaborative
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
        if (this.block?.idevices?.length == 0) {
            // Collaborative
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
                            eXeLearning.app.menus.menuStructure.menuStructureBehaviour.checkIfEmptyNode();
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
    /**
     * Find installed iDevice by type name with fallbacks
     * Handles different naming conventions (e.g., "text", "FreeTextIdevice", "FreeText")
     * @param {string} typeName - The type name to search for
     * @returns {Object|null} - The installed iDevice or null
     */
    findInstalledIdevice(typeName) {
        if (!typeName) return null;

        const idevicesManager = eXeLearning.app.idevices;

        // Try direct match first
        let idevice = idevicesManager.getIdeviceInstalled(typeName);
        if (idevice) return idevice;

        // Map of legacy/alternative names to actual iDevice IDs
        const typeMapping = {
            'FreeTextIdevice': 'text',
            'FreeText': 'text',
            'freetext': 'text',
            'TextIdevice': 'text',
        };

        // Try mapped name
        const mappedName = typeMapping[typeName];
        if (mappedName) {
            idevice = idevicesManager.getIdeviceInstalled(mappedName);
            if (idevice) {
                // Update our type name to the correct one
                this.odeIdeviceTypeName = mappedName;
                return idevice;
            }
        }

        // Try removing common suffixes
        const nameWithoutSuffix = typeName.replace(/Idevice$/i, '').toLowerCase();
        idevice = idevicesManager.getIdeviceInstalled(nameWithoutSuffix);
        if (idevice) {
            this.odeIdeviceTypeName = nameWithoutSuffix;
            return idevice;
        }

        // Fallback: search all installed iDevices by cssClass
        // This helps find iDevices when the type name doesn't match the id but matches the cssClass
        const installedNames = Object.keys(idevicesManager.installed || {});
        for (const name of installedNames) {
            const installed = idevicesManager.installed[name];
            if (installed && installed.cssClass === typeName) {
                console.log(`[IdeviceNode] Found iDevice by cssClass match: ${typeName} -> ${installed.name}`);
                this.odeIdeviceTypeName = installed.name;
                return installed;
            }
        }

        console.warn(`[IdeviceNode] Could not find installed iDevice for type: ${typeName}`);
        return null;
    }

    /**
     * Generate HTML for the iDevice type icon in the toolbar
     * @returns {string} HTML string for the icon
     */
    _getIdeviceTypeIconHtml() {
        if (!this.idevice || !this.idevice.icon) {
            return '';
        }

        const icon = this.idevice.icon;
        const title = this.idevice.title || this.odeIdeviceTypeName;

        if (icon.type === 'exe-icon') {
            // exe-icon type: inline SVG content in icon.name
            return `<div class="idevice-type-icon exe-app-tooltip" title="${title}">${icon.name}</div>`;
        } else if (icon.type === 'img' && icon.url) {
            // img type: background image from file
            const iconUrl = `${this.idevice.path}/${icon.url}`;
            return `<div class="idevice-type-icon idevice-img-icon exe-app-tooltip" style="background-image: url('${iconUrl}')" title="${title}"></div>`;
        }

        return '';
    }

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

        $exeFX.init();

        // Render mermaid diagrams after save
        $exe.mermaid.init();
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
     * Uses the filemanager modal to select assets from the media library
     */
    legacyExeIdevicesFilePicker() {
        const filemanager = window.eXeLearning?.app?.modals?.filemanager;

        this.ideviceBody
            .querySelectorAll('.exe-file-picker,.exe-image-picker')
            .forEach((e) => {
                let id = e.id;
                let isImage = e.classList.contains('exe-image-picker');
                let css = isImage ? 'exe-pick-image' : 'exe-pick-any-file';

                // Determine accept filter based on class and id
                let accept = null;
                if (isImage) {
                    accept = 'image';
                } else if (id.toLowerCase().includes('audio')) {
                    accept = 'audio';
                } else if (id.toLowerCase().includes('video')) {
                    accept = 'video';
                }
                // If generic exe-file-picker, accept = null (show all files)

                // Input button element
                let buttonElement = document.createElement('input');
                buttonElement.classList.add(css);
                buttonElement.setAttribute('type', 'button');
                buttonElement.setAttribute('value', _('Select a file'));
                buttonElement.addEventListener('click', () => {
                    if (filemanager) {
                        filemanager.show({
                            accept: accept,
                            onSelect: async (result) => {
                                // Store asset:// URL in input for persistence
                                e.value = result.assetUrl;
                                // Store blob URL as data attribute for display
                                e.dataset.blobUrl = result.blobUrl;
                                // Dispatch change event for iDevice to react
                                e.dispatchEvent(new Event('change'));
                            },
                        });
                    }
                });

                // Append button
                e.parentNode.insertBefore(buttonElement, e.nextSibling);
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
        } catch (_err) {
            /* Silently ignore upload errors */
        }
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
        // Testing: explicit visibility flag and content readiness
        loadScreen.setAttribute('data-visible', 'true');
        document
            .getElementById('node-content')
            ?.setAttribute('data-ready', 'false');
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
            // Testing: explicit visibility flag and content readiness
            loadScreen.setAttribute('data-visible', 'false');
            document
                .getElementById('node-content')
                ?.setAttribute('data-ready', 'true');
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
        this.nodeContainer.scrollTop = this.nodeContainer.offsetTop;
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
        let element = document.getElementById(hashId);
        setTimeout(() => {
            this.nodeContainer.scrollTop = element.offsetTop;
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

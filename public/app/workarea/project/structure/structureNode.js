// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class StructureNode {
    constructor(structure, data) {
        this.structure = structure;
        this.id = data.id;
        this.children = [];
        this.moving = false;
        // Set api params
        this.setParams(data);
        // Control parameters
        this.canHaveHeirs = true;
    }

    /**
     * Node properties
     */
    properties = JSON.parse(
        JSON.stringify(
            eXeLearning.app.api.parameters.odeNavStructureSyncPropertiesConfig
        )
    );

    /**
     * Api params
     */
    params = [
        'odePagStructureSyncs',
        'odeSessionId',
        'odeVersionId',
        'pageId',
        'pageName',
        'parent',
        'order',
        'open',
    ];

    /**
     * Default values of params
     */
    default = { order: 0 };

    /**
     * Set values of api object
     *
     * @param {Array} data
     */
    setParams(data) {
        // Guard against undefined/null data
        if (!data) {
            return;
        }

        for (let [i, param] of Object.entries(this.params)) {
            let defaultValue = this.default[param] ? this.default[param] : null;
            this[param] = data[param] ? data[param] : defaultValue;
        }
        if (data.odeNavStructureSyncProperties) {
            this.setProperties(data.odeNavStructureSyncProperties);
        }
        // Set property titleNode
        this.properties.titleNode.value = this.pageName;
    }

    /**
     * Set values of api properties
     *
     * @param {Array} properties
     * @param {Boolean} onlyHeritable
     */
    setProperties(properties, onlyHeritable) {
        for (let [key, value] of Object.entries(this.properties)) {
            // skip if missing
            if (!properties[key]) {
                console.warn(
                    `Missing property '${key}' in odeNavStructureSyncProperties`
                );
                continue;
            }
            if (onlyHeritable) {
                if (properties[key].heritable)
                    value.value = properties[key].value;
            } else {
                value.value = properties[key].value;
            }
        }
    }

    /*******************************************************************************
     * API ACTIONS
     *******************************************************************************/

    /**
     * Check if Yjs collaborative mode is enabled
     * @returns {boolean}
     */
    isYjsEnabled() {
        return eXeLearning.app?.project?._yjsEnabled === true;
    }

    /**
     *
     */
    async create() {
        // Check if Yjs mode is enabled - use Yjs for collaborative editing
        if (this.isYjsEnabled() && eXeLearning.app.project.addPageViaYjs) {
            return await this.createViaYjs();
        }

        // Legacy: Save new node in database via REST API
        let params = this.getDictBaseValuesData();
        // Add params
        params.pageName = this.pageName;
        params.odeNavStructureSyncIdParent = this.parent;
        // Call api
        let response = await eXeLearning.app.api.putSavePage(params);
        if (response.responseMessage && response.responseMessage == 'OK') {
            // Set params
            this.id = response.odeNavStructureSyncId;
            this.setParams(response.odeNavStructureSync);
            // Add estructure node to array
            this.structure.data.push(this);
            // Other nodes that have been modifications
            if (response.odeNavStructureSyncs) {
                // Update order of pages
                this.structure.updateNodesStructure(
                    response.odeNavStructureSyncs,
                    ['order']
                );
            }
        } else {
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while saving the node in database'),
                contentId: 'error',
            });
            return false;
        }
        return response;
    }

    /**
     * Create page via Yjs collaborative editing
     * @returns {Object}
     */
    async createViaYjs() {
        try {
            const project = eXeLearning.app.project;

            // Use parent ID or 'root' for top-level pages
            const parentId = this.parent === 'root' ? null : this.parent;

            // Create page via Yjs - this syncs automatically to other clients
            const page = project.addPageViaYjs(this.pageName, parentId);

            if (page) {
                // Update local state with Yjs-generated data
                this.id = page.id;
                this.pageId = page.id;
                this.order = page.order || 0;

                // Add to structure data
                this.structure.data.push(this);

                Logger.log('[StructureNode] Created page via Yjs:', page.id);

                return {
                    responseMessage: 'OK',
                    odeNavStructureSyncId: page.id,
                    odeNavStructureSync: {
                        id: page.id,
                        pageId: page.id,
                        pageName: page.title,
                        parent: page.parentId,
                        order: page.order,
                    },
                };
            } else {
                throw new Error('Failed to create page via Yjs');
            }
        } catch (error) {
            console.error('[StructureNode] Yjs create error:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while creating the page'),
                contentId: 'error',
            });
            return false;
        }
    }

    /**
     *
     */
    async clone() {
        // Check if Yjs mode is enabled
        if (this.isYjsEnabled() && eXeLearning.app.project.clonePageViaYjs) {
            return await this.cloneViaYjs();
        }

        // Legacy: Clone via API
        let params = ['odeNavStructureSyncId'];
        let data = this.generateDataObject(params);
        let response = await eXeLearning.app.api.postClonePage(data);
        if (response.responseMessage !== 'OK') {
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while cloning the node in database'),
                contentId: 'error',
            });
            return false;
        }
        return response;
    }

    /**
     * Clone page via Yjs collaborative editing
     * @returns {Object}
     */
    async cloneViaYjs() {
        try {
            const project = eXeLearning.app.project;

            // Clone via Yjs - syncs to other clients automatically
            const clonedPage = project.clonePageViaYjs(this.id);

            if (clonedPage) {
                Logger.log('[StructureNode] Cloned page via Yjs:', clonedPage.id);
                return {
                    responseMessage: 'OK',
                    odeNavStructureSync: {
                        id: clonedPage.id,
                        pageId: clonedPage.pageId,
                        pageName: clonedPage.pageName,
                        parent: clonedPage.parentId,
                        order: clonedPage.order,
                    },
                };
            } else {
                throw new Error('Failed to clone page via Yjs');
            }
        } catch (error) {
            console.error('[StructureNode] Yjs clone error:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while cloning the page'),
                contentId: 'error',
            });
            return false;
        }
    }

    /**
     *
     * @param {*} newName
     */
    async rename(newName) {
        // Check if Yjs mode is enabled
        if (this.isYjsEnabled() && eXeLearning.app.project.renamePageViaYjs) {
            return await this.renameViaYjs(newName);
        }

        // Legacy: Rename Element
        this.pageName = newName;
        // Save in database
        let params = ['odeNavStructureSyncId'];
        let data = this.generateDataObject(params);
        // Add params
        data.pageName = this.pageName;
        // Call api
        let response = await eXeLearning.app.api.putSavePage(data);
        if (response.responseMessage && response.responseMessage == 'OK') {
            // Set property title node
            this.properties.titleNode.value =
                response.odeNavStructureSync.odeNavStructureSyncProperties.titleNode.value;
        } else {
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _(
                    'An error occurred while updating the node in database'
                ),
                contentId: 'error',
            });
            return false;
        }
        return response;
    }

    /**
     * Rename page via Yjs collaborative editing
     * @param {string} newName
     * @returns {Object}
     */
    async renameViaYjs(newName) {
        try {
            const project = eXeLearning.app.project;

            // Update local state
            this.pageName = newName;
            this.properties.titleNode.value = newName;

            // Rename via Yjs - syncs to other clients automatically
            const success = project.renamePageViaYjs(this.id, newName);

            if (success) {
                Logger.log('[StructureNode] Renamed page via Yjs:', this.id);
                return {
                    responseMessage: 'OK',
                    odeNavStructureSync: {
                        id: this.id,
                        pageName: newName,
                        odeNavStructureSyncProperties: {
                            titleNode: { value: newName },
                        },
                    },
                };
            } else {
                throw new Error('Failed to rename page via Yjs');
            }
        } catch (error) {
            console.error('[StructureNode] Yjs rename error:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while renaming the page'),
                contentId: 'error',
            });
            return false;
        }
    }

    /**
     *
     */
    async remove() {
        // Check if Yjs mode is enabled
        if (this.isYjsEnabled() && eXeLearning.app.project.deletePageViaYjs) {
            return await this.removeViaYjs();
        }

        // Legacy: Remove node in structure list
        this.structure.data = this.structure.data.filter((node, index, arr) => {
            return node.id != this.id;
        });
        // Call api to remove node in database
        let response = await eXeLearning.app.api.deletePage(this.id);
        if (response.responseMessage !== 'OK') {
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while remove the node in database'),
                contentId: 'error',
            });
            return false;
        }
        return response;
    }

    /**
     * Remove page via Yjs collaborative editing
     * @returns {Object}
     */
    async removeViaYjs() {
        try {
            const project = eXeLearning.app.project;
            const pageId = this.id;

            // Delete via Yjs first - syncs to other clients automatically
            // This also deletes all descendants recursively
            const success = project.deletePageViaYjs(pageId);

            if (success) {
                // Only remove from local structure if Yjs deletion succeeded
                // Also remove all descendants from local structure
                const descendantIds = this._collectLocalDescendantIds(pageId);
                const idsToRemove = new Set([pageId, ...descendantIds]);

                this.structure.data = this.structure.data.filter((node) => {
                    return !idsToRemove.has(node.id);
                });

                Logger.log('[StructureNode] Removed page via Yjs:', pageId);
                return { responseMessage: 'OK' };
            } else {
                throw new Error(`Page ${pageId} not found in Yjs document`);
            }
        } catch (error) {
            console.error('[StructureNode] Yjs remove error:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while removing the page'),
                contentId: 'error',
            });
            return false;
        }
    }

    /**
     * Collect all descendant page IDs from local structure data
     * @param {string} parentId
     * @returns {string[]}
     */
    _collectLocalDescendantIds(parentId) {
        const descendants = [];
        for (const node of this.structure.data) {
            if (node.parent === parentId) {
                descendants.push(node.id);
                descendants.push(...this._collectLocalDescendantIds(node.id));
            }
        }
        return descendants;
    }

    /**
     *
     * @param {*} parentId
     */
    async apiUpdateParent(parentId, newOrder) {
        // Check if Yjs mode is enabled
        if (this.isYjsEnabled() && eXeLearning.app.project.movePageViaYjs) {
            return await this.updateParentViaYjs(parentId, newOrder);
        }

        // Legacy: Update via API
        this.structure.movingNode = true;
        this.updateParam('moving', true);
        // Modify parent in object
        this.parent = parentId;
        if (newOrder) this.order = newOrder;
        // Update parent in database
        let params = ['odeNavStructureSyncId'];
        let data = this.generateDataObject(params);
        // Add params
        data.odeNavStructureSyncIdParent = this.parent;
        if (newOrder) data.order = this.order;
        // Call api
        eXeLearning.app.api.putSavePage(data).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                //
            } else {
                eXeLearning.app.modals.alert.show({
                    title: _('Structure node error'),
                    body: _(
                        'An error occurred while saving the node in database'
                    ),
                    contentId: 'error',
                });
            }
        });
    }

    /**
     * Update parent via Yjs collaborative editing
     * @param {string} parentId
     * @param {number} newOrder
     */
    async updateParentViaYjs(parentId, newOrder) {
        // Store original values for rollback
        const originalParent = this.parent;
        const originalOrder = this.order;

        try {
            this.structure.movingNode = true;
            this.updateParam('moving', true);

            // Modify local object
            this.parent = parentId;
            if (newOrder !== undefined && newOrder !== null) this.order = newOrder;

            // Move via Yjs - syncs to other clients automatically
            const project = eXeLearning.app.project;
            const result = project.movePageViaYjs(this.id, parentId, newOrder);

            if (!result) {
                // Rollback local changes if Yjs update failed
                console.warn('[StructureNode] Yjs updateParent failed, rolling back:', this.id);
                this.parent = originalParent;
                this.order = originalOrder;

                // Refresh structure to show correct state
                this.structure.movingNode = false;
                this.updateParam('moving', false);
                this.structure.reloadStructureMenu();
                return false;
            }

            this.structure.movingNode = false;
            this.updateParam('moving', false);

            Logger.log('[StructureNode] Updated parent via Yjs:', this.id, '->', parentId);
            return true;
        } catch (error) {
            console.error('[StructureNode] Yjs updateParent error:', error);
            // Rollback on error
            this.parent = originalParent;
            this.order = originalOrder;
            this.structure.movingNode = false;
            this.updateParam('moving', false);
            return false;
        }
    }

    /**
     *
     * @param {*} newOrder
     */
    async apiUpdateOrder(newOrder) {
        // Check if Yjs mode is enabled
        if (this.isYjsEnabled() && eXeLearning.app.project.movePageViaYjs) {
            return await this.updateOrderViaYjs(newOrder);
        }

        // Legacy: Update via API
        this.structure.movingNode = true;
        this.updateParam('moving', true);
        // Modify order in object
        this.updateOrderByParam(newOrder);
        // Update order in database
        let params = ['odeNavStructureSyncId'];
        let data = this.generateDataObject(params);
        // Add params
        data.order = this.order;
        // Call api
        eXeLearning.app.api.putReorderPage(data).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                //
            } else {
                eXeLearning.app.modals.alert.show({
                    title: _('Structure node error'),
                    body: _(
                        'An error occurred while saving the node in database'
                    ),
                    contentId: 'error',
                });
            }
        }).catch((error) => {
            console.error('Failed to reorder page:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _('An error occurred while reordering the page. Please try again.'),
                contentId: 'error',
            });
        });
    }

    /**
     * Update order via Yjs collaborative editing
     * @param {*} newOrder - Can be '+', '-', or a number
     */
    async updateOrderViaYjs(newOrder) {
        // Store original order for rollback
        const originalOrder = this.order;

        try {
            this.structure.movingNode = true;
            this.updateParam('moving', true);

            // Calculate new order
            this.updateOrderByParam(newOrder);

            // Move via Yjs - syncs to other clients automatically
            const project = eXeLearning.app.project;
            const result = project.movePageViaYjs(this.id, this.parent, this.order);

            if (!result) {
                // Rollback local order if Yjs update failed
                console.warn('[StructureNode] Yjs updateOrder failed, rolling back:', this.id);
                this.order = originalOrder;

                // Refresh structure to show correct state
                this.structure.movingNode = false;
                this.updateParam('moving', false);
                this.structure.reloadStructureMenu();
                return false;
            }

            this.structure.movingNode = false;
            this.updateParam('moving', false);

            Logger.log('[StructureNode] Updated order via Yjs:', this.id, '->', this.order);
            return true;
        } catch (error) {
            console.error('[StructureNode] Yjs updateOrder error:', error);
            // Rollback on error
            this.order = originalOrder;
            this.structure.movingNode = false;
            this.updateParam('moving', false);
            return false;
        }
    }

    /**
     * Save properties in database or Yjs
     *
     * @param {*} properties
     * @param {*} inherit
     */
    async apiSaveProperties(properties, inherit) {
        // Update local array of properties
        for (let [key, value] of Object.entries(properties)) {
            if (this.properties[key]) {
                this.properties[key].value = value;
            }
        }

        // Check if Yjs mode is enabled
        if (this.isYjsEnabled()) {
            return await this.savePropertiesViaYjs(properties);
        }

        // Legacy: Save via API
        let params = { odeNavStructureSyncId: this.id };
        if (inherit) params.updateChildsProperties = 'true';
        for (let [key, value] of Object.entries(this.properties)) {
            params[key] = value.value;
        }
        // Save in database
        eXeLearning.app.api.putSavePropertiesPage(params).then((response) => {
            if (response.responseMessage && response.responseMessage == 'OK') {
                // Rename and reload node
                this.structure.renameNodeAndReload(this.id, params.titleNode);
                // Reload page content
                this.structure.project.idevices.loadApiIdevicesInPage(true);
            } else {
                eXeLearning.app.modals.alert.show({
                    title: _('Structure node error'),
                    body: _(
                        "An error occurred while saving node's properties in database"
                    ),
                    contentId: 'error',
                });
            }
        });
    }

    /**
     * Save properties via Yjs
     * @param {Object} properties - Properties to save
     */
    async savePropertiesViaYjs(properties) {
        try {
            const project = eXeLearning.app.project;
            const bridge = project._yjsBridge;

            if (!bridge || !bridge.structureBinding) {
                console.warn('[StructureNode] Yjs structure binding not available');
                return false;
            }

            // Save properties to Yjs
            const success = bridge.structureBinding.updatePageProperties(this.id, properties);

            if (success) {
                Logger.log('[StructureNode] Saved properties via Yjs:', this.id);

                // Rename node if titleNode changed
                if (properties.titleNode) {
                    this.pageName = properties.titleNode;
                    this.structure.renameNodeAndReload(this.id, properties.titleNode);
                }

                // Reload page content to reflect changes
                this.structure.project.idevices.loadApiIdevicesInPage(true);

                return { responseMessage: 'OK' };
            } else {
                throw new Error('Failed to save properties via Yjs');
            }
        } catch (error) {
            console.error('[StructureNode] Yjs saveProperties error:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Structure node error'),
                body: _("An error occurred while saving page properties"),
                contentId: 'error',
            });
            return false;
        }
    }

    /**
     * Load properties from Yjs
     * Updates local properties object with values from Yjs
     */
    loadPropertiesFromYjs() {
        if (!this.isYjsEnabled()) return;

        const project = eXeLearning.app.project;
        const bridge = project._yjsBridge;

        if (!bridge || !bridge.structureBinding) return;

        const yjsProperties = bridge.structureBinding.getPageProperties(this.id);
        if (yjsProperties) {
            for (let [key, value] of Object.entries(yjsProperties)) {
                if (this.properties[key]) {
                    // Convert booleans back to strings for compatibility
                    if (typeof value === 'boolean') {
                        this.properties[key].value = value ? 'true' : 'false';
                    } else {
                        this.properties[key].value = value;
                    }
                }
            }
            Logger.log('[StructureNode] Loaded properties from Yjs:', this.id);
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
        return {
            odeNavStructureSyncId: this.id ? this.id : null,
            odePageId: this.pageId,
            odeVersionId: eXeLearning.app.project.odeVersion,
            odeSessionId: eXeLearning.app.project.odeSession,
        };
    }

    /*******************************************************************************
     * UPDATE PARAMS
     *******************************************************************************/

    /**
     *
     * @param {*} param
     */
    updateOrderByParam(newOrder) {
        switch (newOrder) {
            case '+':
                this.order++;
                break;
            case '-':
                this.order--;
                break;
            default:
                this.order = newOrder;
                break;
        }
    }

    /**
     * Change value of node param
     *
     * @param {*} param
     * @param {*} newValue
     */
    updateParam(param, newValue) {
        this[param] = newValue;
        switch (param) {
            case 'moving':
                let element = this.getElement();
                if (element) element.setAttribute('moving', newValue);
                break;
        }
    }

    /*******************************************************************************
     * GET
     *******************************************************************************/

    /**
     *
     */
    getElement() {
        return this.structure.menuStructureCompose.menuNav.querySelector(
            `.nav-element[nav-id="${this.id}"]`
        );
    }

    /**
     *
     * @returns {String}
     */
    getPos() {
        for (let i = 0; i < this.structure.data.length; i++) {
            if (this.structure.data[i].id == this.id) {
                return i;
            }
        }
        return false;
    }

    /*******************************************************************************
     * MODALS
     *******************************************************************************/

    /*********************************
     * PROPERTIES */

    /**
     * Show modal for editing page properties
     */
    showModalProperties() {
        // Load properties from Yjs if available (ensures we have latest values)
        this.loadPropertiesFromYjs();

        eXeLearning.app.modals.properties.show({
            node: this,
            title: _('Page properties'),
            contentId: 'page-properties',
            properties: this.properties,
        });
    }
}

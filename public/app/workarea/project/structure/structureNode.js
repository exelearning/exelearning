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
     *
     */
    async create() {
        // Save new node in database
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
            // Synchronize others users
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                params.odePageId,
                null,
                null,
                'ADD'
            );
            // Send operation log to bbdd
            let additionalData = {
                pageId: params.odePageId,
                navId: response.odeNavStructureSyncId,
            };
            eXeLearning.app.project.sendOdeOperationLog(
                null,
                null,
                'ADD_PAGE',
                additionalData
            );
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
     *
     */
    async clone() {
        let params = ['odeNavStructureSyncId'];
        let data = this.generateDataObject(params);
        let response = await eXeLearning.app.api.postClonePage(data);
        if (response.responseMessage && response.responseMessage == 'OK') {
            //
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                response.odeNavStructureSync.pageId,
                null,
                null,
                'ADD'
            );
            // Send operation log to bbdd
            let additionalData = { navId: response.odeNavStructureSync.id };
            eXeLearning.app.project.sendOdeOperationLog(
                response.odeNavStructureSync.pageId,
                response.odeNavStructureSync.pageId,
                'CLONE_PAGE',
                additionalData
            );
        } else {
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
     *
     * @param {*} newName
     */
    async rename(newName) {
        // Rename Element
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
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                this.pageId,
                null,
                null,
                'EDIT'
            );
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
     *
     */
    async remove() {
        // Remove node in structure list
        this.structure.data = this.structure.data.filter((node, index, arr) => {
            return node.id != this.id;
        });
        // Call api to remove node in database
        let response = await eXeLearning.app.api.deletePage(this.id);
        if (response.responseMessage && response.responseMessage == 'OK') {
            // update current ode users update flag
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                this.pageId,
                null,
                null,
                'DELETE'
            );
            // Send ode operation log to bbdd
            let additionalData = {};
            eXeLearning.app.project.sendOdeOperationLog(
                this.pageId,
                this.pageId,
                'REMOVE_PAGE',
                additionalData
            );
        } else {
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
     *
     * @param {*} parentId
     */
    async apiUpdateParent(parentId, newOrder) {
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
     *
     * @param {*} newOrder
     */
    async apiUpdateOrder(newOrder) {
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
        });
    }

    /**
     * Save properties in database
     *
     * @param {*} properties
     * @param {*} inherit
     */
    async apiSaveProperties(properties, inherit) {
        // Update array of properties
        for (let [key, value] of Object.entries(properties)) {
            this.properties[key].value = value;
        }
        // Generate params array
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
     *
     */
    showModalProperties() {
        eXeLearning.app.modals.properties.show({
            node: this,
            title: _('Page properties'),
            contentId: 'page-properties',
            properties: this.properties,
        });
    }
}

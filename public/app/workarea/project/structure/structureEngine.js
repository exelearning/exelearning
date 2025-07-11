import StructureNode from './structureNode.js';

export default class structureEngine {
    constructor(project) {
        this.project = project;
        this.data = null;
        this.dataJson = null;
        this.dataGroupByParent = null;
        this.nodeSelected = null;
        this.nodeContainer = document.querySelector(
            '#main > #workarea > #node-content'
        );
        this.movingNode = false;
    }

    rootNodeData = {
        id: 'root',
        pageId: 'root',
        pageName: '',
        icon: 'edit_note',
        parent: null,
        order: 1,
    };

    /**
     * Load project structure from api and process data
     *
     */
    async loadData() {
        this.dataJson = await this.getOdeStructure();
        this.processStructureData(this.dataJson);
    }

    /**
     * Get project structure from api
     *
     */
    async getOdeStructure() {
        let odeVersion = this.project.odeVersion;
        let odeSession = this.project.odeSession;
        let response = await this.project.app.api.getOdeStructure(
            odeVersion,
            odeSession
        );
        let dataJson = response.structure ? response.structure : [];
        return dataJson;
    }

    /**
     * Update element params of page elements
     *
     */
    async updateDataFromApi() {
        this.dataJson = await this.getOdeStructure();
        this.dataJson.forEach((node) => {
            let currentNode = this.getNode(node.id);
            // Update params
            if (currentNode) {
                currentNode.updateParam('order', node.order);
                currentNode.updateParam('parent', node.parent);
                currentNode.updateParam('moving', false);
            }
        });
        this.movingNode = false;
        return this.data;
    }

    /**
     * Reload menu nodes based in api nodes
     *
     * @param {String} idSelect
     */
    async resetStructureData(idSelect) {
        let data = await this.updateDataFromApi();
        this.data = this.orderStructureData(data);
        this.openNode(idSelect);
        await this.reloadStructureMenu(idSelect);
    }

    /**
     * Reload data and reload menu nodes
     *
     * @param {String} idSelect
     */
    async resetDataAndStructureData(idSelect) {
        this.loadData();
        let data = await this.updateDataFromApi();
        this.data = this.orderStructureData(data);
        this.openNode(idSelect);
        await this.reloadStructureMenu(idSelect);
    }

    /**
     * Reload menu nodes
     *
     * @param {String} idToSelect
     */
    async reloadStructureMenu(idToSelect) {
        this.menuStructureCompose.compose();
        this.menuStructureBehaviour.behaviour(false);
        if (idToSelect) {
            await this.selectNode(idToSelect);
        } else {
            await this.selectFirst();
        }
    }

    /**
     * Generate structure nodes, add params and order structure data
     *
     * @param {Array} data
     */
    processStructureData(data) {
        let newData = [];
        // Add root node
        let propertiesTitle =
            eXeLearning.app.project.properties.properties.pp_title.value;
        let rootNode = new StructureNode(this, this.rootNodeData);
        rootNode.pageName = propertiesTitle
            ? propertiesTitle
            : _('Untitled document');
        rootNode.icon = this.rootNodeData.icon;
        newData.push(rootNode);
        // Add project nodes
        data.forEach((nodeArray) => {
            let structureNode = new StructureNode(this, nodeArray);
            newData.push(structureNode);
        });
        // Order data
        newData = this.orderStructureData(newData);
        // Add param "open" to structure data
        newData = this.addOpenParamToStructureData(newData);

        this.data = newData;
    }

    /**
     * Get structure nodes order by view
     *
     * @param {*} data
     */
    addParentRootToData(data) {
        data.forEach((node) => {
            if (node.id != 'root' && node.parent == null) {
                node.parent = 'root';
            }
        });
        return data;
    }

    /**
     * Set title to node root
     *
     */
    setTitleToNodeRoot() {
        let propertiesTitle =
            eXeLearning.app.project.properties.properties.pp_title.value;
        let rootNode = this.data[0];
        rootNode.pageName = propertiesTitle
            ? propertiesTitle
            : _('Untitled document');
        this.reloadStructureMenu();
    }

    /**
     * Get structure nodes order by view
     *
     * @param {*} data
     */
    orderStructureData(data) {
        // Set parent root to parent database nodes
        data = this.addParentRootToData(data);
        // Group data
        this.dataGroupByParent = this.groupDataByParent(data);
        // Add index to nodes
        this.setIndexToStructureData();
        // Add nodes to array
        let orderData = [];
        let parentsToCheck = [null];
        while (parentsToCheck.length > 0) {
            let searchedParent = parentsToCheck.pop();
            this.dataGroupByParent[searchedParent].children.forEach((node) => {
                orderData.push(node);
                parentsToCheck.push(node.id);
            });
        }
        return orderData;
    }

    /**
     * Group structure nodes by parent
     *
     * @returns {Array}
     */
    groupDataByParent(data) {
        let processedData = { null: { children: [] } };
        let parentsToCheck = [null];
        while (parentsToCheck.length > 0) {
            let searchedParent = parentsToCheck.pop();
            data.forEach((node) => {
                if (node.parent == searchedParent) {
                    processedData[node.id] = node;
                    processedData[node.id].children = [];
                    processedData[searchedParent].children.push(node);
                    // Sort children
                    processedData[searchedParent].children.sort(
                        this.compareNodesSort
                    );
                    // Add id to future check
                    parentsToCheck.push(node.id);
                }
            });
        }
        return processedData;
    }

    /**
     * Set index params to structure nodes
     *
     */
    setIndexToStructureData() {
        let mainParent = 'root';
        let indexOrder = [0];
        this.setIndexToChildrenNodesRecursive(
            this.dataGroupByParent[mainParent].children,
            indexOrder
        );
    }

    /**
     * setIndexToStructureData
     * Set index param to structure node
     *
     * @param {*} nodes
     * @param {*} index
     */
    setIndexToChildrenNodesRecursive(nodes, index) {
        nodes.forEach((node) => {
            index[index.length - 1]++;
            node.index = index.join('.');
            node.deep = index.length - 1;
            if (node.children.length > 0) {
                index.push(0);
                this.setIndexToChildrenNodesRecursive(node.children, index);
            }
        });
        index.pop();
    }

    /**
     * Add open param to structure nodes
     *
     * @param {Array} data
     * @returns {Array}
     */
    addOpenParamToStructureData(data) {
        data.forEach((node) => {
            if (node.children.length > 0) {
                if (node.open == null) {
                    node.open = true;
                }
            } else {
                node.open = null;
            }
        });
        return data;
    }

    /**
     *
     * @param {*} a
     * @param {*} b
     */
    compareNodesSort(a, b) {
        if (a.order < b.order) return -1;
        if (a.order > b.order) return 1;
        return 0;
    }

    /**
     *
     * @param {String} id
     */
    async moveNodePrev(id) {
        let moved = await this.moveNode(id, 'prev');
        if (moved) {
            this.resetStructureData(id);
        }
    }

    /**
     *
     * @param {String} id
     */
    async moveNodeNext(id) {
        let moved = await this.moveNode(id, 'next');
        if (moved) {
            this.resetStructureData(id);
        }
    }

    /**
     *
     * @param {String} id
     */
    async moveNodeUp(id) {
        let moved = await this.moveNode(id, 'up');
        if (moved) {
            this.resetStructureData(id);
        }
    }

    /**
     *
     * @param {String} id
     */
    async moveNodeDown(id) {
        let moved = await this.moveNode(id, 'down');
        if (moved) {
            this.resetStructureData(id);
        }
    }

    /**
     *
     * @param {String} id
     * @param {*} mov
     */
    async moveNode(id, mov, isUndoMove = false) {
        let moved = false;
        let node = this.getNode(id);
        let siblings = this.dataGroupByParent[node.parent].children;
        if (this.movingNode) return false;
        // Updates the order according to the movement indicated in the argument
        switch (mov) {
            case 'prev':
                if (node.order > 1) {
                    await node.apiUpdateOrder('-');
                    moved = true;
                }
                break;
            case 'next':
                if (node.order < siblings.length) {
                    await node.apiUpdateOrder('+');
                    moved = true;
                }
                break;
            case 'up':
                if (node.parent) {
                    let parentNode = this.getNode(node.parent);
                    await node.apiUpdateParent(
                        parentNode.parent,
                        parentNode.order + 1
                    );
                    moved = true;
                }
                break;
            case 'down':
                let prevSibling = siblings[node.order - 2];
                if (prevSibling) {
                    await node.apiUpdateParent(
                        siblings[node.order - 2].id,
                        siblings.length + 1
                    );
                    moved = true;
                }
                break;
        }
        eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
            false,
            node.pageId,
            null,
            null,
            'RELOAD_NAV_MAP'
        );
        // Check that isn't undo
        if (!isUndoMove) {
            // Send operation log to bbdd
            let additionalData = {
                navId: node.id,
                previousMov: mov,
                isUndoMove: true,
                isMovePageButton: true,
            };
            eXeLearning.app.project.sendOdeOperationLog(
                node.pageId,
                node.pageId,
                'MOVE_PAGE',
                additionalData
            );
        }
        return moved;
    }

    /**
     *
     * @param {String} idMov
     * @param {String} idBase
     */
    async moveNodeToNode(idMov, idBase, isUndoMove = false) {
        let nodeMov = this.getNode(idMov);
        let nodeBase = this.getNode(idBase);
        // Get Nodes without changes
        let previousNodeMovParent = nodeMov.parent;
        let previousNodeBaseParent = nodeBase.parent;
        // Set nodebaseId in case of is parent
        if (
            previousNodeBaseParent == 'root' ||
            (nodeBase.children.length > 0 && nodeMov.parent == nodeBase.id)
        ) {
            previousNodeBaseParent = nodeBase.id;
        }
        let previousNodeMovOrder = nodeMov.order;
        // Get nodemov before element id to return when undo, in case that not exist the id of the parent
        let nodeMovElementOrder = document
            .querySelector(`[nav-id="${nodeMov.id}"]`)
            .getAttribute('order');
        let nodeMovElementParent = document.querySelector(
            `[nav-id="${nodeMov.id}"]`
        ).parentElement;
        let nodeMovBeforeElementId = 'root';
        if (nodeMovElementOrder != 'root' && nodeMov.parent !== 'root') {
            if (nodeMovElementOrder == '1') {
                nodeMovBeforeElementId =
                    nodeMovElementParent.parentElement.getAttribute('nav-id');
            } else {
                nodeMovBeforeElementId =
                    nodeMovElementParent.childNodes[
                        parseInt(nodeMovElementOrder) - 2
                    ].getAttribute('nav-id');
            }
        }
        // You cannot put a node inside one of its descendants
        if (
            !this.movingNode &&
            !this.getDecendents(nodeMov.id).includes(nodeBase)
        ) {
            // Receiver node is parent of moving node
            if (nodeMov.parent == nodeBase.id) {
                await nodeMov.apiUpdateOrder(1);
            }
            // Receiver node is parent
            else if (this.getChildren(nodeBase.id).length > 0) {
                await nodeMov.apiUpdateParent(nodeBase.id, 1);
            }
            // Receiver node isn't parent and nodes are siblings
            else if (nodeMov.parent == nodeBase.parent) {
                await nodeMov.apiUpdateOrder(nodeBase.order + 1);
            }
            // Receiver node isn't parent
            else {
                await nodeMov.apiUpdateParent(
                    nodeBase.parent,
                    nodeBase.order + 1
                );
            }
            eXeLearning.app.project.updateCurrentOdeUsersUpdateFlag(
                false,
                nodeBase.pageId,
                null,
                null,
                'RELOAD_NAV_MAP'
            );
            if (!isUndoMove) {
                // Send operation log action to bbdd
                let additionalData = {
                    previousNodeMovOrder: previousNodeMovOrder,
                    previousNodeMovParent: previousNodeMovParent,
                    previousNodeBaseParent: previousNodeBaseParent,
                    navId: nodeMov.id,
                    baseNavId: nodeMovBeforeElementId,
                    isUndoMove: true,
                    isMovePageButton: false,
                };
                eXeLearning.app.project.sendOdeOperationLog(
                    nodeBase.pageId,
                    nodeBase.pageId,
                    'MOVE_PAGE',
                    additionalData
                );
            }
            // Reload data
            if (!isUndoMove) {
                this.resetStructureData(nodeMov.id);
            }
        }
    }

    /**
     *
     * @param {String} id
     * @returns {number}
     */
    getPosNode(id) {
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].id == id) {
                return i;
            }
        }
        return false;
    }

    /**
     *
     * @param {*} parentId
     * @param {*} title
     */
    createNodeAndReload(parentId, title) {
        this.createNode(parentId, title).then((response) => {
            if (response && response.responseMessage == 'OK') {
                this.resetStructureData(response.odeNavStructureSyncId);
            }
        });
    }

    /**
     *
     * @param {*} parentId
     * @param {*} title
     *
     * @returns {Object}
     */
    async createNode(parentId, title) {
        let newPageId = this.generateNodeId();
        let newNodeData = {
            pageId: newPageId,
            pageName: title,
            parent: parentId,
            order: -1,
        };
        let newNode = new StructureNode(this, newNodeData);
        let response = await newNode.create();
        return response;
    }

    /**
     *
     * @param {*} id
     */
    async cloneNodeAndReload(id) {
        let cloneNode = await this.cloneNode(id);
        await this.resetStructureData(cloneNode.id);
    }

    /**
     *
     * @param {*} id
     * @returns
     */
    async cloneNode(id) {
        let cloneNodeData = await this.getNode(id).clone();
        let cloneNode = new StructureNode(
            this,
            cloneNodeData.odeNavStructureSync
        );
        this.data.push(cloneNode);
        return cloneNode;
    }

    /**
     *
     * @param {*} id
     * @returns
     */
    async cloneNodeNav(odeNavStructureSync) {
        //let cloneNodeData = await this.getNode(id).clone();
        let cloneNode = new StructureNode(this, odeNavStructureSync);
        this.data.push(cloneNode);
        return cloneNode;
    }

    /**
     * Update the parameters of the current pages based on the parameters passed in the array objects
     *
     * @param {*} nodes
     * @param {*} params
     */
    updateNodesStructure(nodes, params) {
        for (let [id, node] of Object.entries(nodes)) {
            let currentNode = this.getNode(node.id);
            if (currentNode) {
                params.forEach((paramName) => {
                    currentNode.updateParam(paramName, node[paramName]);
                });
            }
        }
    }

    /**
     *
     * @param {String} id
     * @param {*} title
     */
    renameNodeAndReload(id, title) {
        this.renameNode(id, title);
        this.resetStructureData(id);
    }

    /**
     *
     * @param {String} id
     * @param {*} title
     */
    renameNode(id, title) {
        this.getNode(id).rename(title);
    }

    /**
     *
     * @param {String} id
     */
    removeNodeCompleteAndReload(id) {
        this.removeNode(id);
        this.resetStructureData(false);
    }

    /**
     *
     * @param {number} id
     */
    removeNode(id) {
        this.getNode(id).remove();
    }

    /**
     *
     * @param {Array} nodeList
     */
    removeNodes(nodeList) {
        nodeList.forEach((id) => {
            this.getNode(id).remove();
        });
    }

    /**
     *
     * @param {String} id
     */
    removeChildren(id) {
        this.data = this.data.filter((node, index, arr) => {
            return node.parent != id;
        });
    }

    /**
     *
     * @param {String} id
     */
    removeDecendents(id) {
        let descendents = this.getDecendents(id);
        let descendentsId = descendents.map((node) => {
            return node.id;
        });
        this.removeNodes(descendentsId);
    }

    /**
     *
     * @param {String} id
     */
    cleanOrphans() {
        var pendingOrphans = true;
        while (pendingOrphans) {
            pendingOrphans = false;
            for (let i = 0; i < this.data.length; i++) {
                if (
                    this.data[i].parent != null &&
                    !this.hasChildren(this.data[i].parent)
                ) {
                    pendingOrphans = true;
                    this.removeNode(this.data[i].id);
                }
            }
        }
    }

    /**
     *
     * @param {*} parentId
     * @returns {boolean}
     */
    hasChildren(parentId) {
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].id == parentId) {
                return true;
            }
        }
        return false;
    }

    /**
     *
     * @param {String} id
     */
    openNode(id) {
        if (id) {
            var ancestors = this.getAncestors(id);
            this.data.forEach((node) => {
                if (node.children.length > 0 && ancestors.includes(node.id)) {
                    node.open = true;
                }
            });
        }
    }

    /**
     *
     * @param {String} id
     * @returns
     */
    getNode(id) {
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i].id == id) {
                return this.data[i];
            }
        }
    }

    /**
     *
     * @param {String} id
     * @returns {Array}
     */
    getChildren(id, dict) {
        let node = this.getNode(id);
        let children = dict ? {} : [];
        this.data.forEach((e) => {
            if (e.parent == id) {
                if (dict) {
                    children[e.id] = e;
                } else {
                    children.push(e);
                }
            }
        });
        return children;
    }

    /**
     *
     * @param {String} id
     * @return {Array}
     */
    getDecendents(id) {
        var parentsToCheck = [id];
        var descendensts = [];
        while (parentsToCheck.length > 0) {
            let parentId = parentsToCheck.pop();
            let children = this.getChildren(parentId);
            children.forEach((node) => {
                descendensts.push(node);
                parentsToCheck.push(node.id);
            });
        }
        return descendensts;
    }

    /**
     *
     * @param {String} id
     * @returns {Array}
     */
    getAncestors(id) {
        var ancestors = [];
        var node = this.getNode(id);
        if (node) {
            ancestors.push(node.parent);
            while (ancestors[ancestors.length - 1]) {
                let lastAncestor = this.getNode(
                    ancestors[ancestors.length - 1]
                );
                ancestors.push(lastAncestor.parent);
            }
        }
        return ancestors;
    }

    /**
     *
     * @returns {Array}
     */
    getAllNodesOrderByView() {
        this.nodesOrderByView = [];
        let pagesElements =
            this.menuStructureCompose.menuNavList.querySelectorAll(
                '.nav-element'
            );
        pagesElements.forEach((pageElement) => {
            let pageNode = this.getNode(pageElement.getAttribute('nav-id'));
            if (pageNode.id != 'root') {
                this.nodesOrderByView.push(pageNode);
            }
        });
        return this.nodesOrderByView;
    }

    /**
     *
     * @param {*} id
     */
    getPosInNodesOrderByView(id) {
        for (let i = 0; i < this.nodesOrderByView.length; i++) {
            if (this.nodesOrderByView[i].id == node.id) {
                return i;
            }
        }
        return false;
    }

    /**
     *
     * @param {String} id
     *
     * @returns {Node}
     */
    getNodeElement(id) {
        return this.menuStructureCompose.menuNav.querySelector(
            `.nav-element[nav-id="${id}"]`
        );
    }

    /**
     *
     * @param {String} id
     */
    async selectNode(id) {
        await this.menuStructureBehaviour.selectNode(this.getNodeElement(id));
    }

    /**
     *
     */
    async selectFirst() {
        await this.menuStructureBehaviour.selectFirst();
    }

    /**
     *
     * @returns {String}
     */
    getSelectNodeNavId() {
        return this.getSelectedNode().id;
    }

    /**
     *
     * @returns {String}
     */
    getSelectNodePageId() {
        return this.getSelectedNode().pageId;
    }

    /**
     *
     * @returns {Node}
     */
    getSelectedNode() {
        if (this.menuStructureBehaviour.nodeSelected) {
            return this.getNode(
                this.menuStructureBehaviour.nodeSelected.getAttribute('nav-id')
            );
        } else {
            return false;
        }
    }

    /**
     *
     * @returns {string}
     */
    generateNodeId() {
        return this.project.app.common.generateId();
    }
}

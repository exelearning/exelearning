import StructureNode from './structureNode.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

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
        this._structureLoaded = false; // Track if structure was already loaded
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
     * Check if Yjs collaborative mode is enabled
     * @returns {boolean}
     */
    isYjsEnabled() {
        return this.project?._yjsEnabled === true;
    }

    /**
     * Load project structure from api (or Yjs if enabled) and process data
     *
     */
    async loadData() {
        this.dataJson = await this.getOdeStructure();
        this.processStructureData(this.dataJson);
    }

    /**
     * Get project structure from api or Yjs
     * When Yjs is enabled but empty (or force import flag is set), fetches from API and imports into Yjs
     */
    async getOdeStructure() {
        // Check if Yjs mode is enabled
        if (this.isYjsEnabled() && this.project._yjsBridge) {
            const bridge = this.project._yjsBridge;
            const navigation = bridge.documentManager?.getNavigation();
            const forceImport = this.project._forceStructureImport === true;

            // If force import flag is set, always fetch from API and import
            if (forceImport) {
                Logger.log('[StructureEngine] Force import flag set - clearing Yjs and fetching from API...');

                // Clear the flag immediately to prevent loops
                this.project._forceStructureImport = false;

                // Clear existing Yjs data
                if (bridge.clearNavigation) {
                    bridge.clearNavigation();
                }

                // Fetch from API
                const apiData = await this.fetchStructureFromApi();

                if (apiData && apiData.length > 0) {
                    bridge.importStructure(apiData);
                    Logger.log('[StructureEngine] Force imported', apiData.length, 'pages into Yjs');
                }

                return this.getStructureFromYjs();
            }

            // Check if Yjs has data
            if (navigation && navigation.length > 0) {
                Logger.log('[StructureEngine] Loading structure from Yjs (has data)');
                return this.getStructureFromYjs();
            }

            // Yjs is empty - fetch from API and import
            Logger.log('[StructureEngine] Yjs empty, fetching from API and importing...');
            const apiData = await this.fetchStructureFromApi();

            if (apiData && apiData.length > 0) {
                // Import API data into Yjs
                bridge.importStructure(apiData);
                Logger.log('[StructureEngine] Imported', apiData.length, 'pages into Yjs');
            }

            // Now read back from Yjs (source of truth)
            return this.getStructureFromYjs();
        }

        // No Yjs - get directly from API
        return await this.fetchStructureFromApi();
    }

    /**
     * Fetch structure data from backend API
     * @returns {Array} Structure data array
     */
    async fetchStructureFromApi() {
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
     * Get structure data from Yjs document
     * Returns data in API-compatible format including blocks and components
     * @returns {Array}
     */
    getStructureFromYjs() {
        const bridge = this.project._yjsBridge;
        if (!bridge || !bridge.structureBinding) {
            console.warn('[StructureEngine] Yjs bridge not available');
            return [];
        }

        const binding = bridge.structureBinding;
        const pages = binding.getPages();
        const structureData = pages.map((page) => {
            // Get blocks for this page
            const blocks = binding.getBlocks(page.id);
            const odePagStructureSyncs = blocks.map((block) => {
                // Get components for this block
                const components = binding.getComponents(page.id, block.id);
                const odeComponentsSyncs = components.map((comp) => ({
                    odeComponentSyncId: comp.id,
                    odeIdeviceTypeName: comp.ideviceType || comp.type,
                    htmlView: comp.htmlContent || '',
                    jsonProperties: comp.jsonProperties || '{}',
                    order: comp.order,
                    // Include all additional properties
                    ...comp.properties,
                }));

                return {
                    blockId: block.id,
                    blockName: block.blockName || block.name,
                    order: block.order,
                    odeComponentsSyncs: odeComponentsSyncs,
                };
            });

            // Ensure order is a valid number
            let pageOrder = page.order;
            if (typeof pageOrder !== 'number' || isNaN(pageOrder) || !isFinite(pageOrder)) {
                pageOrder = 0;
            }

            // Convert Yjs properties to expected format: { key: { value: X } }
            let odeNavStructureSyncProperties = null;
            if (page.properties && typeof page.properties === 'object') {
                odeNavStructureSyncProperties = {};
                for (const [key, value] of Object.entries(page.properties)) {
                    odeNavStructureSyncProperties[key] = { value: value };
                }
            }

            return {
                id: page.id,
                pageId: page.pageId || page.id,
                pageName: page.pageName,
                parent: page.parentId || 'root', // Frontend expects 'root' for null parent
                order: pageOrder,
                odePagStructureSyncs: odePagStructureSyncs,
                odeNavStructureSyncProperties: odeNavStructureSyncProperties,
            };
        });

        Logger.log('[StructureEngine] Loaded', structureData.length, 'pages from Yjs');
        this._structureLoaded = true;
        return structureData;
    }

    /**
     * Set structure data from Yjs (called by YjsProjectBridge on sync)
     * @param {Array} data
     */
    setDataFromYjs(data) {
        // Preserve current selection before re-rendering
        // Guard: Ensure nodeSelected is a DOM element before calling getAttribute
        const nodeSelected = this.menuStructureBehaviour?.nodeSelected;
        const selectedNavId = (nodeSelected && typeof nodeSelected.getAttribute === 'function')
            ? nodeSelected.getAttribute('nav-id')
            : null;

        this.dataJson = data;
        this.processStructureData(this.dataJson);
        // Re-render the structure menu if available, preserving selection
        if (this.menuStructureCompose) {
            this.reloadStructureMenu(selectedNavId);
        }
    }

    /**
     * Update element params of page elements
     *
     */
    async updateDataFromApi() {
        // Get fresh data (from Yjs or API depending on mode)
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
     * Subscribe to Yjs structure changes
     * Call this after Yjs is enabled to keep structure in sync
     */
    subscribeToYjsChanges() {
        if (!this.isYjsEnabled() || !this.project._yjsBridge) {
            return;
        }

        // Listen for structure changes from Yjs
        this.project._yjsBridge.onStructureChange(async (events, transaction) => {
            // Skip LOCAL changes - they are handled by the operation that triggered them
            // (e.g., createNodeAndReload calls resetStructureData which handles selection)
            // In Yjs, transaction.local is true for local changes, false for remote
            const isRemote = transaction?.local === false;
            if (!isRemote) {
                Logger.log('[StructureEngine] Skipping local change (local:', transaction?.local, ')');
                return;
            }

            Logger.log('[StructureEngine] Yjs structure changed (remote), reloading...');

            // PRESERVE SELECTION: Save current selection for remote changes
            const selectedNavId = this.menuStructureBehaviour?.nodeSelected?.getAttribute('nav-id');
            const selectedNode = selectedNavId ? this.getNode(selectedNavId) : null;
            const parentNavId = selectedNode?.parent || null;

            // Refresh from Yjs data
            const structureData = this.getStructureFromYjs();
            this.processStructureData(structureData);

            // Re-render the menu
            if (this.menuStructureCompose) {
                this.menuStructureCompose.compose();
                this.menuStructureBehaviour.behaviour(false);

                // RESTORE SELECTION after re-render (await for visual update)
                let pageToReload = null;
                if (selectedNavId && this.getNode(selectedNavId)) {
                    // Node still exists → re-select it
                    await this.selectNode(selectedNavId);
                    pageToReload = selectedNavId;
                } else if (parentNavId && this.getNode(parentNavId)) {
                    // Node was deleted → go to parent
                    await this.selectNode(parentNavId);
                    pageToReload = parentNavId;
                } else if (selectedNavId) {
                    // Both node and parent gone → select first available
                    await this.selectFirst();
                }
                // If no node was selected before, don't auto-select

                // FORCE RELOAD page content for remote changes (boxes/iDevices moved in/out)
                if (pageToReload) {
                    const pageElement = this.menuStructureBehaviour?.menuNav?.querySelector(
                        `.nav-element[nav-id="${pageToReload}"]`
                    );
                    if (pageElement) {
                        Logger.log('[StructureEngine] Forcing page content reload for remote changes');
                        await eXeLearning.app.project.idevices.loadApiIdevicesInPage(false, pageElement);
                    }
                }
            }
        });

        // Load initial structure from Yjs immediately (only if not already loaded)
        // This prevents double-loading when getOdeStructure() was already called
        if (!this.data || this.data.length === 0) {
            const structureData = this.getStructureFromYjs();
            if (structureData && structureData.length > 0) {
                Logger.log(`[StructureEngine] Loading initial ${structureData.length} pages from Yjs`);
                this.processStructureData(structureData);
                // Re-render the menu with initial data
                if (this.menuStructureCompose) {
                    this.menuStructureCompose.compose();
                    this.menuStructureBehaviour.behaviour(false);
                    this.menuStructureBehaviour.selectFirst();
                }
            }
        } else {
            Logger.log(`[StructureEngine] Structure already loaded (${this.data.length} pages), skipping reload`);
        }

        Logger.log('[StructureEngine] Subscribed to Yjs changes');
    }

    /**
     * Reload menu nodes based in api nodes
     *
     * @param {String} idSelect
     */
    async resetStructureData(idSelect) {
        Logger.log('[StructureEngine] resetStructureData called with idSelect:', idSelect);
        // In Yjs mode, fully reload structure from Yjs document
        if (this.isYjsEnabled()) {
            const structureData = this.getStructureFromYjs();
            this.processStructureData(structureData);
            this.openNode(idSelect);
            Logger.log('[StructureEngine] About to call reloadStructureMenu with:', idSelect);
            await this.reloadStructureMenu(idSelect);
            Logger.log('[StructureEngine] reloadStructureMenu completed');
            return;
        }

        // Legacy API mode
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
        // In Yjs mode, fully reload structure from Yjs document
        if (this.isYjsEnabled()) {
            const structureData = this.getStructureFromYjs();
            this.processStructureData(structureData);
            this.openNode(idSelect);
            await this.reloadStructureMenu(idSelect);
            return;
        }

        // Legacy API mode
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
        Logger.log('[StructureEngine] reloadStructureMenu called with:', idToSelect);
        this.menuStructureCompose.compose();
        this.menuStructureBehaviour.behaviour(false);
        if (idToSelect) {
            Logger.log('[StructureEngine] Calling selectNode with:', idToSelect);
            await this.selectNode(idToSelect);
            Logger.log('[StructureEngine] selectNode completed');
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
     * Preserves current selection to avoid navigating users when title changes
     * Updated: Only updates DOM text directly to avoid form recreation cascade
     */
    setTitleToNodeRoot() {
        let propertiesTitle =
            eXeLearning.app.project.properties.properties.pp_title.value;
        let rootNode = this.data[0];
        rootNode.pageName = propertiesTitle
            ? propertiesTitle
            : _('Untitled document');

        // Update the root node title directly in the DOM without rebuilding the menu
        // This avoids the cascade that causes form recreation
        const rootNodeElement = this.menuNav?.querySelector('.nav-element[nav-id="root"] .node-text');
        if (rootNodeElement) {
            rootNodeElement.textContent = rootNode.pageName;
        }

        // NOTE: reloadStructureMenu() removed - it was causing form recreation cascade
        // Just updating the text is sufficient for title changes
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
            const group = this.dataGroupByParent[searchedParent];
            if (!group || !Array.isArray(group.children)) {
                continue;
            }
            group.children.forEach((node) => {
                if (!node || !node.id) {
                    return;
                }
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
        // Validate input data
        if (!Array.isArray(data)) {
            console.warn('[StructureEngine] groupDataByParent: Invalid data (not an array)');
            return { null: { children: [] }, root: { children: [] } };
        }

        let processedData = { null: { children: [] }, root: { children: [] } };
        let parentsToCheck = [null, 'root'];
        let processedIds = new Set(); // Prevent infinite loops

        while (parentsToCheck.length > 0) {
            let searchedParent = parentsToCheck.pop();
            data.forEach((node) => {
                // Skip invalid nodes
                if (!node || !node.id) {
                    return;
                }
                // Prevent processing the same node twice (circular references)
                if (processedIds.has(node.id)) {
                    return;
                }
                // Check if node belongs to this parent
                const nodeParent = node.parent === 'root' ? 'root' : (node.parent || null);
                if (nodeParent == searchedParent) {
                    processedIds.add(node.id);
                    // Preserve any existing children that were added before this node was processed
                    const existingChildren = processedData[node.id]?.children || [];
                    processedData[node.id] = node;
                    processedData[node.id].children = existingChildren;

                    // Ensure parent exists in processedData
                    if (!processedData[searchedParent]) {
                        processedData[searchedParent] = { children: [] };
                    }

                    processedData[searchedParent].children.push(node);
                    // Sort children with safe comparison
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
        // Handle undefined/null/invalid order values safely
        const orderA = (typeof a?.order === 'number' && isFinite(a.order)) ? a.order : 0;
        const orderB = (typeof b?.order === 'number' && isFinite(b.order)) ? b.order : 0;
        if (orderA < orderB) return -1;
        if (orderA > orderB) return 1;
        return 0;
    }

    // ===== SIMPLIFIED NODE MOVEMENT (via Yjs) =====

    /**
     * Get YjsStructureBinding instance
     * @returns {Object|null}
     */
    getYjsBinding() {
        return this.project._yjsBridge?.structureBinding || null;
    }

    /**
     * Move node UP (↑) - swap with previous sibling
     * @param {String} id
     */
    moveNodePrev(id) {
        const binding = this.getYjsBinding();
        if (binding?.movePagePrev(id)) {
            this.resetStructureData(id);
        }
    }

    /**
     * Move node DOWN (↓) - swap with next sibling
     * @param {String} id
     */
    moveNodeNext(id) {
        const binding = this.getYjsBinding();
        if (binding?.movePageNext(id)) {
            this.resetStructureData(id);
        }
    }

    /**
     * Move node LEFT (←) - move to grandparent
     * @param {String} id
     */
    moveNodeUp(id) {
        const binding = this.getYjsBinding();
        if (binding?.movePageLeft(id)) {
            this.resetStructureData(id);
        }
    }

    /**
     * Move node RIGHT (→) - become child of previous sibling
     * @param {String} id
     */
    moveNodeDown(id) {
        const binding = this.getYjsBinding();
        if (binding?.movePageRight(id)) {
            this.resetStructureData(id);
        }
    }

    /**
     * Move node to another node (drag & drop)
     * @param {String} idMov - Node to move
     * @param {String} idBase - Target node
     */
    moveNodeToNode(idMov, idBase) {
        const binding = this.getYjsBinding();
        if (binding?.movePageToTarget(idMov, idBase)) {
            this.resetStructureData(idMov);
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
        // Local Yjs changes are skipped in onStructureChange (transaction.local = true)
        // resetStructureData handles re-render and selection of new node
        Logger.log('[StructureEngine] createNodeAndReload called, parentId:', parentId, 'title:', title);
        this.createNode(parentId, title).then((response) => {
            Logger.log('[StructureEngine] createNode response:', response);
            if (response && response.responseMessage == 'OK') {
                Logger.log('[StructureEngine] Calling resetStructureData with ID:', response.odeNavStructureSyncId);
                this.resetStructureData(response.odeNavStructureSyncId);
            }
        }).catch((error) => {
            console.error('[StructureEngine] Error creating node:', error);
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
        // Defensive: ignore invalid/unknown ids to avoid runtime errors
        if (!id) {
            return;
        }
        const node = this.getNode(id);
        if (node && typeof node.remove === 'function') {
            this.removeNode(id);
        }
        // Always refresh structure to reflect current state
        this.resetStructureData(false);
    }

    /**
     *
     * @param {number} id
     */
    removeNode(id) {
        const node = this.getNode(id);
        if (!node || typeof node.remove !== 'function') {
            return false;
        }
        node.remove();
        return true;
    }

    /**
     *
     * @param {Array} nodeList
     */
    removeNodes(nodeList) {
        nodeList.forEach((id) => {
            const node = this.getNode(id);
            if (node && typeof node.remove === 'function') {
                node.remove();
            }
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
                const lastId = ancestors[ancestors.length - 1];
                const lastAncestor = this.getNode(lastId);
                if (!lastAncestor) {
                    break;
                }
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
            if (pageNode && pageNode.id !== 'root') {
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
        if (!Array.isArray(this.nodesOrderByView)) {
            return false;
        }
        for (let i = 0; i < this.nodesOrderByView.length; i++) {
            const item = this.nodesOrderByView[i];
            if (item && item.id === id) {
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
        Logger.log('[StructureEngine] selectNode called with id:', id);
        const element = this.getNodeElement(id);
        Logger.log('[StructureEngine] getNodeElement returned:', element ? 'FOUND' : 'NOT FOUND', element);
        if (element) {
            Logger.log('[StructureEngine] Calling menuStructureBehaviour.selectNode...');
            await this.menuStructureBehaviour.selectNode(element);
            Logger.log('[StructureEngine] menuStructureBehaviour.selectNode completed');
        } else {
            // Fallback to selectFirst if the specific node is not found in DOM
            console.warn(`[StructureEngine] Node ${id} not found in DOM, selecting first`);
            await this.selectFirst();
        }
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
        const selected = this.getSelectedNode();
        return selected ? selected.id : null;
    }

    /**
     *
     * @returns {String}
     */
    getSelectNodePageId() {
        const selected = this.getSelectedNode();
        return selected ? selected.pageId : null;
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

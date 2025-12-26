/**
 * YjsStructureBinding
 * Binds the Yjs document structure to eXeLearning's navigation UI.
 * Provides utilities for manipulating the document hierarchy:
 * - Navigation (pages)
 * - Blocks (containers within pages)
 * - Components (iDevices within blocks)
 */
class YjsStructureBinding {
  /**
   * @param {YjsDocumentManager} documentManager - The document manager instance
   */
  constructor(documentManager) {
    this.manager = documentManager;
    this.Y = window.Y;
    this.changeCallbacks = [];
  }

  /**
   * Subscribe to structure changes
   * @param {Function} callback - Called when structure changes with (events, transaction)
   *   - transaction.local: true if change originated from this client
   */
  onStructureChange(callback) {
    this.changeCallbacks.push(callback);

    // Subscribe to navigation array changes
    const navigation = this.manager.getNavigation();
    navigation.observeDeep((events, transaction) => {
      this.changeCallbacks.forEach((cb) => cb(events, transaction));
    });
  }

  /**
   * Subscribe specifically to block/component changes (moves, reorders, adds, deletes)
   * @param {Function} callback - Called when blocks or components change with (events, transaction, affectedPageIds)
   */
  onBlocksComponentsChange(callback) {
    if (!this.blocksComponentsCallbacks) {
      this.blocksComponentsCallbacks = [];
    }
    this.blocksComponentsCallbacks.push(callback);

    // If already observing, don't add another observer
    if (this._blocksComponentsObserverSet) return;
    this._blocksComponentsObserverSet = true;

    const navigation = this.manager.getNavigation();
    navigation.observeDeep((events, transaction) => {
      // Check if any event involves blocks or components
      let hasBlockOrComponentChange = false;
      const affectedPageIds = new Set();

      for (const event of events) {
        const pathStr = event.path.join('/');
        // Changes in blocks or components arrays
        if (pathStr.includes('blocks') || pathStr.includes('components')) {
          hasBlockOrComponentChange = true;

          // Try to find the affected page ID from the path
          // Path looks like: [0, 'blocks', 1, 'components', 0]
          // where 0 is the page index
          if (event.path.length > 0 && typeof event.path[0] === 'number') {
            const pageIndex = event.path[0];
            const pageMap = navigation.get(pageIndex);
            if (pageMap) {
              const pageId = pageMap.get('id') || pageMap.get('pageId');
              if (pageId) affectedPageIds.add(pageId);
            }
          }
        }
      }

      if (hasBlockOrComponentChange && this.blocksComponentsCallbacks) {
        Logger.log('[YjsStructureBinding] Block/component change detected, affected pages:', Array.from(affectedPageIds));
        this.blocksComponentsCallbacks.forEach((cb) => cb(events, transaction, Array.from(affectedPageIds)));
      }
    });
  }

  // ===== Navigation (Pages) =====

  /**
   * Get all pages (top-level navigation items)
   * @returns {Array}
   */
  getPages() {
    const navigation = this.manager.getNavigation();
    return navigation.toArray().map((pageMap, index) => this.mapToPage(pageMap, index));
  }

  /**
   * Get a page by ID
   * @param {string} pageId
   * @returns {Object|null}
   */
  getPage(pageId) {
    const navigation = this.manager.getNavigation();
    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      if (pageMap.get('id') === pageId) {
        return this.mapToPage(pageMap, i);
      }
    }
    return null;
  }

  /**
   * Create a new page (alias: addPage)
   * @param {string} pageName
   * @param {string} parentId - Parent page ID for sub-pages (optional)
   * @returns {Object} - The new page object with id and other properties
   */
  addPage(pageName, parentId = null) {
    return this.createPage(pageName, parentId);
  }

  /**
   * Create a new page
   * @param {string} pageName
   * @param {string} parentId - Parent page ID for sub-pages (optional)
   * @returns {Object} - The new page object with id and other properties
   */
  createPage(pageName, parentId = null) {
    const pageId = this.generateId('page');
    const navigation = this.manager.getNavigation();
    const order = navigation.length;
    const createdAt = new Date().toISOString();

    const pageMap = new this.Y.Map();

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      pageMap.set('id', pageId);
      pageMap.set('pageId', pageId);
      pageMap.set('pageName', pageName);
      pageMap.set('parentId', parentId);
      pageMap.set('order', order);
      pageMap.set('blocks', new this.Y.Array());
      pageMap.set('createdAt', createdAt);

      navigation.push([pageMap]);
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Created page: ${pageName} (${pageId})`);

    // Return page object (not just ID)
    return {
      id: pageId,
      pageId: pageId,
      pageName: pageName,
      parentId: parentId,
      order: order,
      blockCount: 0,
      createdAt: createdAt,
      _ymap: pageMap,
    };
  }

  /**
   * Update a page
   * @param {string} pageId
   * @param {Object} updates - { pageName, properties: {...}, etc. }
   */
  updatePage(pageId, updates) {
    const navigation = this.manager.getNavigation();
    const Y = window.Y;

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      if (pageMap.get('id') === pageId || pageMap.get('pageId') === pageId) {
        // Use a transaction to batch all changes
        this.manager.getDoc().transact(() => {
          Object.entries(updates).forEach(([key, value]) => {
            if (key === 'properties' && typeof value === 'object') {
              // Handle properties as a Y.Map
              let propsMap = pageMap.get('properties');
              // Check if propsMap exists and has a 'set' method (Y.Map behavior)
              if (!propsMap || typeof propsMap.set !== 'function') {
                propsMap = new Y.Map();
                pageMap.set('properties', propsMap);
              }
              // Update each property, converting checkbox values properly
              Object.entries(value).forEach(([propKey, propValue]) => {
                // Convert string booleans to actual booleans for checkbox fields
                let finalValue = propValue;
                if (propValue === 'true' || propValue === '1') {
                  finalValue = true;
                } else if (propValue === 'false' || propValue === '0' || propValue === '') {
                  finalValue = false;
                }
                propsMap.set(propKey, finalValue);
              });
              Logger.log(`[YjsStructureBinding] Updated page ${pageId} properties:`, value);
            } else {
              pageMap.set(key, value);
            }
          });
        }, this.manager.getDoc().clientID);
        Logger.log(`[YjsStructureBinding] Updated page: ${pageId}`);
        return true;
      }
    }
    console.warn(`[YjsStructureBinding] Page ${pageId} not found for update`);
    return false;
  }

  /**
   * Delete a page and all its descendants
   * @param {string} pageId
   * @returns {boolean} true if page was found and deleted
   */
  deletePage(pageId) {
    const navigation = this.manager.getNavigation();
    let deleted = false;

    this.manager.getDoc().transact(() => {
      // First, collect all page IDs to delete (this page and all descendants)
      const pageIdsToDelete = this._collectDescendantIds(pageId, navigation);
      pageIdsToDelete.push(pageId); // Add the page itself

      Logger.log(
        `[YjsStructureBinding] Deleting page ${pageId} and ${pageIdsToDelete.length - 1} descendants`
      );

      // Delete in reverse order (children first, then parents)
      // This is safer for maintaining consistency
      for (const idToDelete of pageIdsToDelete) {
        for (let i = navigation.length - 1; i >= 0; i--) {
          const pageMap = navigation.get(i);
          if (pageMap.get('id') === idToDelete) {
            navigation.delete(i, 1);
            Logger.log(`[YjsStructureBinding] Deleted page: ${idToDelete}`);
            if (idToDelete === pageId) {
              deleted = true;
            }
            break;
          }
        }
      }

      if (!deleted) {
        console.warn(`[YjsStructureBinding] Page ${pageId} NOT FOUND for deletion`);
      }
    }, this.manager.getDoc().clientID);

    return deleted;
  }

  /**
   * Collect all descendant page IDs recursively
   * @param {string} parentId
   * @param {Y.Array} navigation
   * @returns {string[]}
   */
  _collectDescendantIds(parentId, navigation) {
    const descendants = [];

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      if (pageMap.get('parentId') === parentId) {
        const childId = pageMap.get('id');
        descendants.push(childId);
        // Recursively collect grandchildren
        descendants.push(...this._collectDescendantIds(childId, navigation));
      }
    }

    return descendants;
  }

  /**
   * Reorder pages
   * @param {number} fromIndex
   * @param {number} toIndex
   */
  reorderPage(fromIndex, toIndex) {
    const navigation = this.manager.getNavigation();
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= navigation.length) return;
    if (toIndex < 0 || toIndex >= navigation.length) return;

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      const pageMap = navigation.get(fromIndex);
      const clonedPage = this.clonePageMapForMove(pageMap);
      navigation.delete(fromIndex, 1);
      navigation.insert(toIndex, [clonedPage]);

      // Update order fields
      for (let i = 0; i < navigation.length; i++) {
        navigation.get(i).set('order', i);
      }
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Reordered page from ${fromIndex} to ${toIndex}`);
  }

  /**
   * Clone a page with all its blocks, components, and child pages
   * @param {string} pageId - Page to clone
   * @param {string} newName - Name for the cloned page (optional)
   * @param {string} overrideParentId - Override parent ID for the clone (used for recursive child cloning)
   * @returns {Object} - The cloned page object
   */
  clonePage(pageId, newName = null, overrideParentId = undefined) {
    const sourcePageMap = this.getPageMap(pageId);
    if (!sourcePageMap) {
      console.warn(`[YjsStructureBinding] Cannot clone: page ${pageId} not found`);
      return null;
    }

    const navigation = this.manager.getNavigation();
    const newPageId = this.generateId('page');
    const order = navigation.length;
    const createdAt = new Date().toISOString();
    const pageName = newName || `${sourcePageMap.get('pageName')} (copy)`;
    // Use overrideParentId if provided (for child cloning), otherwise use source's parent
    const parentId = overrideParentId !== undefined ? overrideParentId : sourcePageMap.get('parentId');

    // Create new page map
    const newPageMap = new this.Y.Map();
    const newBlocks = new this.Y.Array();

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      newPageMap.set('id', newPageId);
      newPageMap.set('pageId', newPageId);
      newPageMap.set('pageName', pageName);
      newPageMap.set('parentId', parentId);
      newPageMap.set('order', order);
      newPageMap.set('createdAt', createdAt);

      // Clone blocks array
      const sourceBlocks = sourcePageMap.get('blocks');

      if (sourceBlocks && sourceBlocks.length > 0) {
        for (let i = 0; i < sourceBlocks.length; i++) {
          const sourceBlock = sourceBlocks.get(i);
          const clonedBlock = this.cloneBlockMap(sourceBlock);
          newBlocks.push([clonedBlock]);
        }
      }

      newPageMap.set('blocks', newBlocks);
      navigation.push([newPageMap]);
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Cloned page ${pageId} to ${newPageId}`);

    // Recursively clone all child pages
    this.cloneChildPages(pageId, newPageId);

    return {
      id: newPageId,
      pageId: newPageId,
      pageName: pageName,
      parentId: parentId,
      order: order,
      blockCount: newBlocks.length,
      createdAt: createdAt,
      _ymap: newPageMap,
    };
  }

  /**
   * Clone all child pages recursively
   * @param {string} originalParentId - Original parent page ID
   * @param {string} newParentId - New parent page ID for cloned children
   */
  cloneChildPages(originalParentId, newParentId) {
    const navigation = this.manager.getNavigation();

    // Find all pages that have originalParentId as parent
    // Collect them first to avoid modifying array while iterating
    const childPages = [];
    for (let i = 0; i < navigation.length; i++) {
      const page = navigation.get(i);
      if (page.get('parentId') === originalParentId) {
        childPages.push({
          id: page.get('id'),
          pageName: page.get('pageName'),
        });
      }
    }

    // Clone each child page with the new parent
    for (const child of childPages) {
      Logger.log(`[YjsStructureBinding] Cloning child page ${child.id} with new parent ${newParentId}`);
      // Pass the child's original name (without " (copy)") and the new parent ID
      this.clonePage(child.id, child.pageName, newParentId);
    }
  }

  /**
   * Move a page to a new parent or position
   * @param {string} pageId - Page to move
   * @param {string} newParentId - New parent page ID (null for root)
   * @param {number} newIndex - New position index
   */
  movePage(pageId, newParentId = null, newIndex = null) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) {
        console.warn(`[YjsStructureBinding] Cannot move: navigation not available`);
        return false;
      }

      let currentIndex = -1;
      let pageMap = null;

      // Search by 'id', 'pageId', and also by pageName as fallback
      for (let i = 0; i < navigation.length; i++) {
        const page = navigation.get(i);
        const id = page.get('id');
        const pId = page.get('pageId');
        if (id === pageId || pId === pageId) {
          currentIndex = i;
          pageMap = page;
          break;
        }
      }

      if (currentIndex === -1) {
        // Debug: Log all available page IDs to help diagnose mismatch
        const availableIds = [];
        for (let i = 0; i < navigation.length; i++) {
          const page = navigation.get(i);
          availableIds.push({
            index: i,
            id: page.get('id'),
            pageId: page.get('pageId'),
            pageName: page.get('pageName')
          });
        }
        console.warn(`[YjsStructureBinding] Cannot move: page ${pageId} not found. Available pages:`, availableIds);
        return false;
      }

      // Normalize parent ID
      const normalizedParentId = (newParentId === 'root' || newParentId === null || newParentId === undefined) ? null : newParentId;

      // Use a transaction to batch all changes atomically
      this.manager.getDoc().transact(() => {
        // Update parent if changed
        const currentParent = pageMap.get('parentId');
        if (newParentId !== undefined && normalizedParentId !== currentParent) {
          pageMap.set('parentId', normalizedParentId);
          Logger.log(`[YjsStructureBinding] Updated page ${pageId} parent from ${currentParent} to ${normalizedParentId}`);
        }

        // Handle order update - just update the order field, don't move in array
        // Yjs Y.Map items become invalid after deletion, so we use order fields for sorting
        // IMPORTANT: Only update order for siblings (same parentId) - different groups have independent ordering
        if (newIndex !== null && typeof newIndex === 'number' && isFinite(newIndex) && newIndex >= 0) {
          const currentOrder = pageMap.get('order') ?? currentIndex;

          if (newIndex !== currentOrder) {
            // Update order fields for affected pages WITHIN THE SAME PARENT GROUP ONLY
            // If moving down (newIndex > currentOrder), decrement orders in between
            // If moving up (newIndex < currentOrder), increment orders in between
            for (let i = 0; i < navigation.length; i++) {
              const page = navigation.get(i);
              const pageParentId = page.get('parentId') || null;

              // Skip pages that are not siblings (different parent)
              if (pageParentId !== normalizedParentId) {
                continue;
              }

              const pageOrder = page.get('order') ?? i;

              if (page === pageMap) {
                // This is the page being moved
                page.set('order', newIndex);
              } else if (newIndex < currentOrder) {
                // Moving up: increment orders of pages between newIndex and currentOrder
                if (pageOrder >= newIndex && pageOrder < currentOrder) {
                  page.set('order', pageOrder + 1);
                }
              } else {
                // Moving down: decrement orders of pages between currentOrder and newIndex
                if (pageOrder > currentOrder && pageOrder <= newIndex) {
                  page.set('order', pageOrder - 1);
                }
              }
            }
            Logger.log(`[YjsStructureBinding] Updated page ${pageId} order from ${currentOrder} to ${newIndex}`);
          }
        }
      }, this.manager.getDoc().clientID);

      Logger.log(`[YjsStructureBinding] Moved page ${pageId} to parent ${normalizedParentId}, index ${newIndex}`);
      return true;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error moving page ${pageId}:`, error);
      return false;
    }
  }

  // ===== SIMPLIFIED MOVEMENT FUNCTIONS =====

  /**
   * Get siblings of a page (pages with same parent), sorted by order
   * @param {string} pageId
   * @returns {Array} Array of {id, order, pageMap} sorted by order
   */
  getSiblings(pageId) {
    const navigation = this.manager.getNavigation();
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) return [];

    const parentId = pageMap.get('parentId');
    const siblings = [];

    for (let i = 0; i < navigation.length; i++) {
      const page = navigation.get(i);
      if (page.get('parentId') === parentId) {
        siblings.push({
          id: page.get('id'),
          order: page.get('order') ?? i,
          pageMap: page
        });
      }
    }

    return siblings.sort((a, b) => a.order - b.order);
  }

  /**
   * Check if page can move up (has previous sibling)
   */
  canMoveUp(pageId) {
    const siblings = this.getSiblings(pageId);
    const index = siblings.findIndex(s => s.id === pageId);
    return index > 0;
  }

  /**
   * Check if page can move down (has next sibling)
   */
  canMoveDown(pageId) {
    const siblings = this.getSiblings(pageId);
    const index = siblings.findIndex(s => s.id === pageId);
    return index >= 0 && index < siblings.length - 1;
  }

  /**
   * Check if page can move left (has parent that is not root)
   */
  canMoveLeft(pageId) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) return false;
    const parentId = pageMap.get('parentId');
    return parentId !== null && parentId !== undefined;
  }

  /**
   * Check if page can move right (has previous sibling to become child of)
   */
  canMoveRight(pageId) {
    return this.canMoveUp(pageId); // Same condition: needs a previous sibling
  }

  /**
   * Move page UP (↑) - swap with previous sibling
   * @param {string} pageId
   * @returns {boolean}
   */
  movePagePrev(pageId) {
    const siblings = this.getSiblings(pageId);
    const index = siblings.findIndex(s => s.id === pageId);

    if (index <= 0) {
      console.warn(`[YjsStructureBinding] Cannot move up: page ${pageId} is first sibling`);
      return false;
    }

    const current = siblings[index];
    const previous = siblings[index - 1];

    // Swap orders
    this.manager.getDoc().transact(() => {
      const tempOrder = current.order;
      current.pageMap.set('order', previous.order);
      previous.pageMap.set('order', tempOrder);
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Moved page ${pageId} up (swapped with ${previous.id})`);
    return true;
  }

  /**
   * Move page DOWN (↓) - swap with next sibling
   * @param {string} pageId
   * @returns {boolean}
   */
  movePageNext(pageId) {
    const siblings = this.getSiblings(pageId);
    const index = siblings.findIndex(s => s.id === pageId);

    if (index < 0 || index >= siblings.length - 1) {
      console.warn(`[YjsStructureBinding] Cannot move down: page ${pageId} is last sibling`);
      return false;
    }

    const current = siblings[index];
    const next = siblings[index + 1];

    // Swap orders
    this.manager.getDoc().transact(() => {
      const tempOrder = current.order;
      current.pageMap.set('order', next.order);
      next.pageMap.set('order', tempOrder);
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Moved page ${pageId} down (swapped with ${next.id})`);
    return true;
  }

  /**
   * Move page LEFT (←) - move to grandparent (after current parent)
   * @param {string} pageId
   * @returns {boolean}
   */
  movePageLeft(pageId) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) return false;

    const parentId = pageMap.get('parentId');
    if (!parentId) {
      console.warn(`[YjsStructureBinding] Cannot move left: page ${pageId} has no parent`);
      return false;
    }

    const parentMap = this.getPageMap(parentId);
    if (!parentMap) {
      console.warn(`[YjsStructureBinding] Cannot move left: parent ${parentId} not found`);
      return false;
    }

    const grandparentId = parentMap.get('parentId');
    const parentOrder = parentMap.get('order') ?? 0;

    // Move to grandparent, positioned after parent
    this.manager.getDoc().transact(() => {
      pageMap.set('parentId', grandparentId);
      // Set order to be after the parent among its new siblings
      const newSiblings = this.getSiblings(parentId); // siblings of the original parent
      pageMap.set('order', parentOrder + 1);

      // Increment order of siblings that come after
      const navigation = this.manager.getNavigation();
      for (let i = 0; i < navigation.length; i++) {
        const page = navigation.get(i);
        if (page !== pageMap && page.get('parentId') === grandparentId) {
          const order = page.get('order') ?? 0;
          if (order > parentOrder) {
            page.set('order', order + 1);
          }
        }
      }
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Moved page ${pageId} left (to parent ${grandparentId})`);
    return true;
  }

  /**
   * Move page RIGHT (→) - become child of previous sibling
   * @param {string} pageId
   * @returns {boolean}
   */
  movePageRight(pageId) {
    const siblings = this.getSiblings(pageId);
    const index = siblings.findIndex(s => s.id === pageId);

    if (index <= 0) {
      console.warn(`[YjsStructureBinding] Cannot move right: page ${pageId} has no previous sibling`);
      return false;
    }

    const current = siblings[index];
    const newParent = siblings[index - 1];

    // Get children count of new parent to determine order
    const newParentChildren = this.getSiblings(newParent.id).filter(s =>
      this.getPageMap(s.id)?.get('parentId') === newParent.id
    );

    // Actually get direct children
    const navigation = this.manager.getNavigation();
    let childCount = 0;
    for (let i = 0; i < navigation.length; i++) {
      const page = navigation.get(i);
      if (page.get('parentId') === newParent.id) {
        childCount++;
      }
    }

    this.manager.getDoc().transact(() => {
      current.pageMap.set('parentId', newParent.id);
      current.pageMap.set('order', childCount + 1); // Add as last child
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Moved page ${pageId} right (now child of ${newParent.id})`);
    return true;
  }

  /**
   * Move page to another page (for drag & drop)
   * @param {string} pageId - Page to move
   * @param {string} targetId - Target page (becomes sibling after, or parent if has children)
   * @returns {boolean}
   */
  movePageToTarget(pageId, targetId) {
    if (pageId === targetId) return false;

    const pageMap = this.getPageMap(pageId);
    const targetMap = this.getPageMap(targetId);
    if (!pageMap || !targetMap) return false;

    // Check for circular reference - can't move to descendant
    if (this.isDescendant(targetId, pageId)) {
      console.warn(`[YjsStructureBinding] Cannot move: ${targetId} is descendant of ${pageId}`);
      return false;
    }

    const targetParentId = targetMap.get('parentId');
    const targetOrder = targetMap.get('order') ?? 0;

    // Check if target has children - if so, become first child
    const navigation = this.manager.getNavigation();
    let targetHasChildren = false;
    for (let i = 0; i < navigation.length; i++) {
      const page = navigation.get(i);
      if (page.get('parentId') === targetId) {
        targetHasChildren = true;
        break;
      }
    }

    this.manager.getDoc().transact(() => {
      if (targetHasChildren) {
        // Become first child of target
        pageMap.set('parentId', targetId);
        pageMap.set('order', 0);
        // Increment order of existing children
        for (let i = 0; i < navigation.length; i++) {
          const page = navigation.get(i);
          if (page !== pageMap && page.get('parentId') === targetId) {
            page.set('order', (page.get('order') ?? 0) + 1);
          }
        }
      } else {
        // Become sibling after target
        pageMap.set('parentId', targetParentId);
        pageMap.set('order', targetOrder + 1);
        // Increment order of siblings after target
        for (let i = 0; i < navigation.length; i++) {
          const page = navigation.get(i);
          if (page !== pageMap && page.get('parentId') === targetParentId) {
            const order = page.get('order') ?? 0;
            if (order > targetOrder) {
              page.set('order', order + 1);
            }
          }
        }
      }
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Moved page ${pageId} to target ${targetId}`);
    return true;
  }

  /**
   * Check if checkId is a descendant of pageId
   */
  isDescendant(checkId, pageId) {
    const navigation = this.manager.getNavigation();
    let currentId = checkId;

    while (currentId) {
      const pageMap = this.getPageMap(currentId);
      if (!pageMap) break;

      const parentId = pageMap.get('parentId');
      if (parentId === pageId) return true;
      currentId = parentId;
    }

    return false;
  }

  /**
   * Clone a block Y.Map (internal helper)
   * Creates a deep copy with new IDs, including all properties and components
   * @private
   */
  cloneBlockMap(sourceBlock) {
    const newBlockId = this.generateId('block');
    const newBlock = new this.Y.Map();

    // Copy all properties from source block generically (like cloneBlockMapForMove)
    sourceBlock.forEach((value, key) => {
      if (key === 'components') {
        // Handle components separately below
        return;
      } else if (key === 'id' || key === 'blockId') {
        // Skip - we'll set new IDs
        return;
      } else if (key === 'createdAt') {
        // Skip - we'll set new timestamp
        return;
      } else if (key === 'properties' && value && typeof value.forEach === 'function') {
        // Clone Y.Map properties
        const newProps = new this.Y.Map();
        value.forEach((v, k) => newProps.set(k, v));
        newBlock.set(key, newProps);
      } else if (value !== null && value !== undefined) {
        // Copy primitive values directly (including iconName, blockType, blockName, order, etc.)
        newBlock.set(key, value);
      }
    });

    // Set new IDs and timestamp
    newBlock.set('id', newBlockId);
    newBlock.set('blockId', newBlockId);
    newBlock.set('createdAt', new Date().toISOString());

    // Clone components with full content
    const sourceComponents = sourceBlock.get('components');
    const newComponents = new this.Y.Array();

    if (sourceComponents && sourceComponents.length > 0) {
      for (let i = 0; i < sourceComponents.length; i++) {
        const sourceComp = sourceComponents.get(i);
        const clonedComp = this.cloneComponentMap(sourceComp);
        newComponents.push([clonedComp]);
      }
    }

    newBlock.set('components', newComponents);
    return newBlock;
  }

  /**
   * Clone a block Y.Map for move operation (preserves original IDs)
   * Copies ALL properties to ensure empty blocks work correctly
   * @private
   */
  cloneBlockMapForMove(sourceBlock) {
    const newBlock = new this.Y.Map();

    // Copy all properties from source block generically
    sourceBlock.forEach((value, key) => {
      if (key === 'components') {
        // Handle components separately below
        return;
      } else if (key === 'properties' && value && typeof value.forEach === 'function') {
        // Clone Y.Map properties
        const newProps = new this.Y.Map();
        value.forEach((v, k) => newProps.set(k, v));
        newBlock.set(key, newProps);
      } else if (value !== null && value !== undefined) {
        // Copy primitive values directly (including iconName, blockType, etc.)
        newBlock.set(key, value);
      }
    });

    // Always ensure essential properties exist
    if (!newBlock.has('id')) newBlock.set('id', sourceBlock.get('id'));
    if (!newBlock.has('blockId')) newBlock.set('blockId', sourceBlock.get('blockId'));

    // Clone components (or create empty array for empty blocks)
    const sourceComponents = sourceBlock.get('components');
    const newComponents = new this.Y.Array();

    if (sourceComponents && sourceComponents.length > 0) {
      for (let i = 0; i < sourceComponents.length; i++) {
        const sourceComp = sourceComponents.get(i);
        const clonedComp = this.cloneComponentMapForMove(sourceComp);
        newComponents.push([clonedComp]);
      }
    }

    newBlock.set('components', newComponents);
    return newBlock;
  }

  /**
   * Clone a page Y.Map for move operation (preserves original IDs)
   * @private
   */
  clonePageMapForMove(sourcePage) {
    const newPage = new this.Y.Map();

    // Copy all properties from source page generically
    sourcePage.forEach((value, key) => {
      if (key === 'blocks') {
        return;
      } else if (key === 'properties' && value && typeof value.forEach === 'function') {
        const newProps = new this.Y.Map();
        value.forEach((v, k) => newProps.set(k, v));
        newPage.set(key, newProps);
      } else if (value !== null && value !== undefined) {
        newPage.set(key, value);
      }
    });

    // Ensure essential properties exist
    if (!newPage.has('id')) newPage.set('id', sourcePage.get('id'));
    if (!newPage.has('pageId')) newPage.set('pageId', sourcePage.get('pageId'));
    if (!newPage.has('pageName')) newPage.set('pageName', sourcePage.get('pageName'));

    // Clone blocks
    const sourceBlocks = sourcePage.get('blocks');
    const newBlocks = new this.Y.Array();

    if (sourceBlocks && sourceBlocks.length > 0) {
      for (let i = 0; i < sourceBlocks.length; i++) {
        const sourceBlock = sourceBlocks.get(i);
        const clonedBlock = this.cloneBlockMapForMove(sourceBlock);
        newBlocks.push([clonedBlock]);
      }
    }

    newPage.set('blocks', newBlocks);
    return newPage;
  }

  /**
   * Clone a component Y.Map for move operation (preserves original IDs)
   * @private
   */
  cloneComponentMapForMove(sourceComp) {
    const newComp = new this.Y.Map();

    // Preserve original IDs
    newComp.set('id', sourceComp.get('id'));
    newComp.set('ideviceId', sourceComp.get('ideviceId'));
    newComp.set('ideviceType', sourceComp.get('ideviceType'));
    newComp.set('order', sourceComp.get('order'));
    newComp.set('createdAt', sourceComp.get('createdAt'));
    newComp.set('updatedAt', sourceComp.get('updatedAt'));
    newComp.set('blockId', sourceComp.get('blockId'));
    newComp.set('pageId', sourceComp.get('pageId'));

    // Clone HTML content as Y.Text
    const sourceHtml = sourceComp.get('htmlContent');
    if (sourceHtml) {
      const newHtml = new this.Y.Text();
      let htmlStr = '';
      if (sourceHtml instanceof this.Y.Text) {
        htmlStr = sourceHtml.toString() || '';
      } else if (typeof sourceHtml === 'string') {
        htmlStr = sourceHtml;
      }
      newHtml.insert(0, htmlStr);
      newComp.set('htmlContent', newHtml);
    }

    // Clone htmlView if exists
    const htmlView = sourceComp.get('htmlView');
    if (htmlView) {
      newComp.set('htmlView', htmlView);
    }

    // Clone properties if exist
    const sourceProps = sourceComp.get('properties');
    if (sourceProps && typeof sourceProps.forEach === 'function') {
      const newProps = new this.Y.Map();
      sourceProps.forEach((value, key) => {
        newProps.set(key, value);
      });
      newComp.set('properties', newProps);
    }

    // Clone jsonProperties - handle both Y.Map and string storage
    const jsonProps = sourceComp.get('jsonProperties');
    if (jsonProps) {
      if (typeof jsonProps.forEach === 'function') {
        // It's a Y.Map, clone it
        const newJsonProps = new this.Y.Map();
        jsonProps.forEach((value, key) => {
          newJsonProps.set(key, value);
        });
        newComp.set('jsonProperties', newJsonProps);
      } else if (typeof jsonProps === 'string') {
        // It's a string (most common case), just copy it
        newComp.set('jsonProperties', jsonProps);
      }
    }

    // Clone other simple properties
    const keysToClone = ['title', 'subtitle', 'instructions', 'feedback', 'lockedBy', 'lockUserName', 'lockUserColor'];
    for (const key of keysToClone) {
      const value = sourceComp.get(key);
      if (value !== undefined) {
        newComp.set(key, value);
      }
    }

    return newComp;
  }

  /**
   * Clone a component Y.Map (internal helper)
   * Creates a deep copy with new IDs, including all content and properties
   * @private
   */
  cloneComponentMap(sourceComp) {
    const newCompId = this.generateId('idevice');
    const newComp = new this.Y.Map();

    newComp.set('id', newCompId);
    newComp.set('ideviceId', newCompId);
    newComp.set('ideviceType', sourceComp.get('ideviceType'));
    newComp.set('order', sourceComp.get('order'));
    newComp.set('createdAt', new Date().toISOString());

    // Clone HTML content as Y.Text
    const sourceHtml = sourceComp.get('htmlContent');
    if (sourceHtml) {
      const newHtml = new this.Y.Text();
      // Safely convert to string, ensuring we never pass null to insert()
      let htmlStr = '';
      if (sourceHtml instanceof this.Y.Text) {
        htmlStr = sourceHtml.toString() || '';
      } else if (typeof sourceHtml === 'string') {
        htmlStr = sourceHtml;
      } else if (sourceHtml != null) {
        htmlStr = String(sourceHtml) || '';
      }
      newHtml.insert(0, htmlStr);
      newComp.set('htmlContent', newHtml);
    }

    // Clone htmlView if exists (fallback content)
    const htmlView = sourceComp.get('htmlView');
    if (htmlView) {
      newComp.set('htmlView', htmlView);
    }

    // Clone properties Y.Map if exists (visibility, teacherOnly, etc.)
    const sourceProps = sourceComp.get('properties');
    if (sourceProps && typeof sourceProps.forEach === 'function') {
      const newProps = new this.Y.Map();
      sourceProps.forEach((value, key) => {
        newProps.set(key, value);
      });
      newComp.set('properties', newProps);
    }

    // Clone jsonProperties - handle both Y.Map and string storage
    // CRITICAL for JSON-type iDevices like text, crosswords, MC, etc.
    const jsonProps = sourceComp.get('jsonProperties');
    if (jsonProps) {
      if (typeof jsonProps.forEach === 'function') {
        // It's a Y.Map, clone it
        const newJsonProps = new this.Y.Map();
        jsonProps.forEach((value, key) => {
          newJsonProps.set(key, value);
        });
        newComp.set('jsonProperties', newJsonProps);
      } else if (typeof jsonProps === 'string') {
        // It's a string (most common case), just copy it
        newComp.set('jsonProperties', jsonProps);
      }
    }

    // Clone other simple properties
    const keysToClone = ['title', 'subtitle', 'instructions', 'feedback'];
    for (const key of keysToClone) {
      const value = sourceComp.get(key);
      if (value !== undefined) {
        newComp.set(key, value);
      }
    }

    return newComp;
  }

  // ===== Blocks =====

  /**
   * Get all blocks for a page
   * @param {string} pageId
   * @returns {Array}
   */
  getBlocks(pageId) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) return [];

    const blocks = pageMap.get('blocks');
    if (!blocks) return [];

    const result = blocks.toArray().map((blockMap, index) => this.mapToBlock(blockMap, index));
    // Sort blocks by order property to ensure correct rendering order
    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * Create a new block in a page
   * @param {string} pageId
   * @param {string} blockName
   * @param {string} existingBlockId - Optional existing block ID to use (for syncing with frontend)
   * @param {number} order - Optional order position (defaults to end)
   * @returns {string} - The new block ID
   */
  createBlock(pageId, blockName = 'Block', existingBlockId = null, order = null) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) return null;

    // Use existing ID if provided (ensures frontend and Yjs have same block ID)
    const blockId = existingBlockId || this.generateId('block');
    const blockMap = new this.Y.Map();

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      let blocks = pageMap.get('blocks');
      if (!blocks) {
        blocks = new this.Y.Array();
        pageMap.set('blocks', blocks);
      }

      // Determine target order/position
      const targetOrder = (order !== undefined && order !== null) ? order : blocks.length;

      blockMap.set('id', blockId);
      blockMap.set('blockId', blockId);
      blockMap.set('blockName', blockName);
      blockMap.set('iconName', '');
      blockMap.set('blockType', 'default');
      blockMap.set('order', targetOrder);
      blockMap.set('components', new this.Y.Array());
      blockMap.set('createdAt', new Date().toISOString());

      // Initialize properties with defaults
      const propsMap = new this.Y.Map();
      propsMap.set('visibility', 'true');
      propsMap.set('teacherOnly', 'false');
      propsMap.set('allowToggle', 'true');
      propsMap.set('minimized', 'false');
      propsMap.set('identifier', '');
      propsMap.set('cssClass', '');
      blockMap.set('properties', propsMap);

      // Insert at correct position and shift existing blocks' order values
      const insertIndex = Math.min(Math.max(0, targetOrder), blocks.length);

      for (let i = insertIndex; i < blocks.length; i++) {
        const existingBlock = blocks.get(i);
        const currentOrder = existingBlock.get('order') ?? i;
        existingBlock.set('order', currentOrder + 1);
      }

      blocks.insert(insertIndex, [blockMap]);
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Created block: ${blockName} (${blockId}) in page ${pageId}`);
    return blockId;
  }

  /**
   * Delete a block
   * @param {string} pageId - Page ID hint (searches all pages if not found)
   * @param {string} blockId - Block ID to delete
   * @returns {boolean} - true if deleted successfully
   */
  deleteBlock(pageId, blockId) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) return false;

      // Search all pages for the block (pageId is a hint but we search all for robustness)
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const blockMap = blocks.get(j);
          // Search by both id and blockId for robustness
          if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
            this.manager.getDoc().transact(() => {
              blocks.delete(j, 1);
              // Update order of remaining blocks
              for (let k = 0; k < blocks.length; k++) {
                blocks.get(k).set('order', k);
              }
            }, this.manager.getDoc().clientID);
            Logger.log(`[YjsStructureBinding] Deleted block: ${blockId}`);
            return true;
          }
        }
      }

      console.warn(`[YjsStructureBinding] Block ${blockId} not found for deletion`);
      return false;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error deleting block:`, error);
      return false;
    }
  }

  /**
   * Update a block's order by physically reordering it in the Y.Array
   * @param {string} blockId - Block ID
   * @param {number} newOrder - New order value (0-based index)
   * @returns {boolean} - true if updated successfully
   */
  updateBlockOrder(blockId, newOrder) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) return false;

      // Search all pages for the block
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const blockMap = blocks.get(j);
          if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
            const currentIndex = j;

            // If already at the target position, just update the order property
            if (currentIndex === newOrder) {
              this.manager.getDoc().transact(() => {
                blockMap.set('order', newOrder);
              }, this.manager.getDoc().clientID);
              Logger.log(`[YjsStructureBinding] Block ${blockId} already at order ${newOrder}`);
              return true;
            }

            // Actually reorder in Y.Array - clone, delete, insert
            this.manager.getDoc().transact(() => {
              // Clone the block before removing (Yjs can't reuse deleted Y.Maps)
              const clonedBlock = this.cloneBlockMapForMove(blockMap);

              // Delete from current position
              blocks.delete(currentIndex, 1);

              // Calculate insert position (adjust if moving down since we just deleted)
              const insertIndex = newOrder > currentIndex ? newOrder : newOrder;

              // Clamp to valid range
              const finalIndex = Math.min(Math.max(0, insertIndex), blocks.length);

              // Insert at new position
              blocks.insert(finalIndex, [clonedBlock]);

              // Update order property on the moved block
              const movedBlock = blocks.get(finalIndex);
              if (movedBlock) {
                movedBlock.set('order', finalIndex);
              }

              // Update order properties of all blocks to match their array positions
              for (let k = 0; k < blocks.length; k++) {
                const b = blocks.get(k);
                if (b && b.get('order') !== k) {
                  b.set('order', k);
                }
              }
            }, this.manager.getDoc().clientID);

            Logger.log(`[YjsStructureBinding] Reordered block ${blockId} from ${currentIndex} to ${newOrder}`);
            return true;
          }
        }
      }

      console.warn(`[YjsStructureBinding] Block ${blockId} not found for order update`);
      return false;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error updating block order:`, error);
      return false;
    }
  }

  /**
   * Update a block's properties
   * @param {string} blockId - Block ID
   * @param {Object} updates - Properties to update (blockName, iconName, etc.)
   * @returns {boolean} - true if updated successfully
   */
  updateBlock(blockId, updates) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) return false;
      const Y = window.Y;

      // Checkbox fields that should be converted to boolean
      const checkboxFields = ['visibility', 'teacherOnly', 'allowToggle', 'minimized'];

      // Search all pages for the block
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const blockMap = blocks.get(j);
          if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
            // Use transaction with clientID origin for UndoManager tracking
            this.manager.getDoc().transact(() => {
              Object.entries(updates).forEach(([key, value]) => {
                if (key === 'properties' && typeof value === 'object') {
                  // Handle properties as a Y.Map
                  let propsMap = blockMap.get('properties');
                  if (!propsMap || typeof propsMap.set !== 'function') {
                    propsMap = new Y.Map();
                    blockMap.set('properties', propsMap);
                  }
                  // Update each property, converting checkbox values properly
                  Object.entries(value).forEach(([propKey, propValue]) => {
                    let finalValue = propValue;
                    if (checkboxFields.includes(propKey)) {
                      finalValue = propValue === true || propValue === 'true' || propValue === '1';
                    }
                    propsMap.set(propKey, finalValue);
                  });
                } else {
                  blockMap.set(key, value);
                }
              });
            }, this.manager.getDoc().clientID);
            Logger.log(`[YjsStructureBinding] Updated block ${blockId}:`, Object.keys(updates));
            return true;
          }
        }
      }

      console.warn(`[YjsStructureBinding] Block ${blockId} not found for update`);
      return false;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error updating block:`, error);
      return false;
    }
  }

  /**
   * Clone a block within the same page
   * @param {string} pageId
   * @param {string} blockId
   * @returns {Object} - The cloned block object
   */
  cloneBlock(pageId, blockId) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) {
      console.warn(`[YjsStructureBinding] Cannot clone block: page ${pageId} not found`);
      return null;
    }

    const blocks = pageMap.get('blocks');
    if (!blocks) return null;

    let sourceBlock = null;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks.get(i).get('id') === blockId) {
        sourceBlock = blocks.get(i);
        break;
      }
    }

    if (!sourceBlock) {
      console.warn(`[YjsStructureBinding] Cannot clone: block ${blockId} not found`);
      return null;
    }

    const clonedBlock = this.cloneBlockMap(sourceBlock);

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      clonedBlock.set('order', blocks.length);
      blocks.push([clonedBlock]);
    }, this.manager.getDoc().clientID);

    const newBlockId = clonedBlock.get('id');
    Logger.log(`[YjsStructureBinding] Cloned block ${blockId} to ${newBlockId}`);

    return {
      id: newBlockId,
      blockId: newBlockId,
      blockName: clonedBlock.get('blockName'),
      order: clonedBlock.get('order'),
      componentCount: clonedBlock.get('components')?.length || 0,
      createdAt: clonedBlock.get('createdAt'),
      _ymap: clonedBlock,
    };
  }

  /**
   * Clone a component within the same block
   * @param {string} pageId
   * @param {string} blockId
   * @param {string} componentId
   * @returns {Object} - The cloned component object
   */
  cloneComponent(pageId, blockId, componentId) {
    const blockMap = this.getBlockMap(pageId, blockId);
    if (!blockMap) {
      console.warn(`[YjsStructureBinding] Cannot clone component: block ${blockId} not found`);
      return null;
    }

    const components = blockMap.get('components');
    if (!components) return null;

    let sourceComp = null;
    for (let i = 0; i < components.length; i++) {
      if (components.get(i).get('id') === componentId) {
        sourceComp = components.get(i);
        break;
      }
    }

    if (!sourceComp) {
      console.warn(`[YjsStructureBinding] Cannot clone: component ${componentId} not found`);
      return null;
    }

    const clonedComp = this.cloneComponentMap(sourceComp);

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      clonedComp.set('order', components.length);
      components.push([clonedComp]);
    }, this.manager.getDoc().clientID);

    const newCompId = clonedComp.get('id');
    Logger.log(`[YjsStructureBinding] Cloned component ${componentId} to ${newCompId}`);

    return this.mapToComponent(clonedComp, clonedComp.get('order'));
  }

  // ===== Components (iDevices) =====

  /**
   * Get all components for a block
   * @param {string} pageId
   * @param {string} blockId
   * @returns {Array}
   */
  getComponents(pageId, blockId) {
    const blockMap = this.getBlockMap(pageId, blockId);
    if (!blockMap) return [];

    const components = blockMap.get('components');
    if (!components) return [];

    const result = components.toArray().map((compMap, index) => this.mapToComponent(compMap, index));
    // Sort components by order property to ensure correct rendering order
    return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * Get a component by ID
   * @param {string} componentId
   * @returns {Object|null}
   */
  getComponent(componentId) {
    const navigation = this.manager.getNavigation();

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      const blocks = pageMap.get('blocks');
      if (!blocks) continue;

      for (let j = 0; j < blocks.length; j++) {
        const blockMap = blocks.get(j);
        const components = blockMap.get('components');
        if (!components) continue;

        for (let k = 0; k < components.length; k++) {
          const compMap = components.get(k);
          if (compMap.get('id') === componentId) {
            return this.mapToComponent(compMap, k);
          }
        }
      }
    }
    return null;
  }

  /**
   * Create a new component (iDevice) in a block
   * @param {string} pageId
   * @param {string} blockId
   * @param {string} ideviceType - e.g., 'FreeTextIdevice', 'MultiChoiceIdevice'
   * @param {Object} initialData - Initial properties
   * @returns {string} - The new component ID
   */
  createComponent(pageId, blockId, ideviceType, initialData = {}) {
    const blockMap = this.getBlockMap(pageId, blockId);
    if (!blockMap) return null;

    // Use provided ID or generate a new one
    const componentId = initialData.id || this.generateId('idevice');
    const compMap = new this.Y.Map();

    // Get current user info for lock
    const clientId = this.manager.getDoc().clientID.toString();
    const lockManager = this.manager.lockManager;
    const userInfo = lockManager?.getCurrentUser() || { name: 'Unknown', color: '#999' };

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      let components = blockMap.get('components');
      if (!components) {
        components = new this.Y.Array();
        blockMap.set('components', components);
      }

      // Determine the target order/position
      const targetOrder = (initialData.order !== undefined && initialData.order !== null)
        ? initialData.order
        : components.length;

      compMap.set('id', componentId);
      compMap.set('ideviceId', componentId);
      compMap.set('ideviceType', ideviceType);
      compMap.set('order', targetOrder);
      compMap.set('createdAt', new Date().toISOString());

      // Set lock info - creator starts with the lock
      compMap.set('lockedBy', clientId);
      compMap.set('lockUserName', userInfo.name || 'Unknown');
      compMap.set('lockUserColor', userInfo.color || '#999');

      // Set initial data (except 'order' which was already set)
      Object.entries(initialData).forEach(([key, value]) => {
        if (key === 'order') return; // Already handled above
        if (typeof value === 'string') {
          // Use Y.Text for rich text content
          if (key === 'htmlContent' || key === 'content') {
            const ytext = new this.Y.Text();
            // Prepare HTML for sync: convert blob:// and data-asset-url to asset:// refs
            let safeValue = value || '';
            const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
            if (assetManager && safeValue && typeof assetManager.prepareHtmlForSync === 'function') {
              safeValue = assetManager.prepareHtmlForSync(safeValue);
            }
            ytext.insert(0, safeValue);
            compMap.set(key, ytext);
          } else {
            compMap.set(key, value);
          }
        } else if (typeof value === 'object' && value !== null) {
          const ymap = new this.Y.Map();
          Object.entries(value).forEach(([k, v]) => ymap.set(k, v));
          compMap.set(key, ymap);
        } else {
          compMap.set(key, value);
        }
      });

      // Insert at the correct position in Y.Array and update orders
      const insertIndex = Math.min(Math.max(0, targetOrder), components.length);

      // Shift order values of existing components that come after insert position
      for (let i = insertIndex; i < components.length; i++) {
        const existingComp = components.get(i);
        const currentOrder = existingComp.get('order') ?? i;
        existingComp.set('order', currentOrder + 1);
      }

      // Insert at the correct position
      components.insert(insertIndex, [compMap]);
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Created component: ${ideviceType} (${componentId}) in block ${blockId}`);
    return componentId;
  }

  /**
   * Update a component's properties
   * @param {string} componentId
   * @param {Object} updates
   */
  updateComponent(componentId, updates) {
    const compMap = this.getComponentMap(componentId);
    if (!compMap) return;

    // Checkbox fields that should be converted to boolean for iDevices
    // visibility and teacherOnly are checkbox fields from ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG
    const checkboxFields = ['visibility', 'teacherOnly'];

    // Use transaction with clientID origin for UndoManager tracking
    this.manager.getDoc().transact(() => {
      Object.entries(updates).forEach(([key, value]) => {
        if (key === 'htmlContent' || key === 'content') {
          // Handle Y.Text updates
          let ytext = compMap.get(key);
          // Ensure we never insert null - use empty string as fallback
          let safeValue = (value != null && typeof value === 'string') ? value : '';

          // Prepare HTML for sync: convert blob:// and data-asset-url to asset:// refs
          const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
          if (assetManager && safeValue && typeof assetManager.prepareHtmlForSync === 'function') {
            safeValue = assetManager.prepareHtmlForSync(safeValue);
          }

          if (!(ytext instanceof this.Y.Text)) {
            // IMPORTANT: Create Y.Text and insert content BEFORE setting on map
            ytext = new this.Y.Text();
            ytext.insert(0, safeValue);
            compMap.set(key, ytext);
          } else {
            // Y.Text already exists and is integrated - safe to modify
            ytext.delete(0, ytext.length);
            ytext.insert(0, safeValue);
          }
        } else if (key === 'properties' && typeof value === 'object') {
          // Handle properties as a Y.Map with checkbox conversion
          let propsMap = compMap.get('properties');
          if (!propsMap || typeof propsMap.set !== 'function') {
            propsMap = new this.Y.Map();
            compMap.set('properties', propsMap);
          }
          // Update each property, converting checkbox values properly
          Object.entries(value).forEach(([propKey, propValue]) => {
            let finalValue = propValue;
            if (checkboxFields.includes(propKey)) {
              finalValue = propValue === true || propValue === 'true' || propValue === '1';
            }
            propsMap.set(propKey, finalValue);
          });
        } else {
          compMap.set(key, value);
        }
      });

      compMap.set('updatedAt', new Date().toISOString());
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Updated component: ${componentId}`);
  }

  // ===== Component Movement Methods =====

  /**
   * Reorder a component within its block
   * Uses clone-delete-insert pattern to physically move the component in Y.Array
   * @param {string} componentId - Component to reorder
   * @param {number} newOrder - New order value
   * @returns {boolean} true if successful
   */
  reorderComponent(componentId, newOrder) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) return false;

      // Find the component and its block
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const blockMap = blocks.get(j);
          const components = blockMap.get('components');
          if (!components) continue;

          for (let k = 0; k < components.length; k++) {
            const compMap = components.get(k);
            if (compMap.get('id') === componentId || compMap.get('ideviceId') === componentId) {
              const currentIndex = k;

              // Don't do anything if already at the target position
              if (currentIndex === newOrder) return true;

              this.manager.getDoc().transact(() => {
                // Clone the component before removing (Y.Maps can't be reused after deletion)
                const clonedComp = this.cloneComponentMapForMove(compMap);

                // Delete from current position
                components.delete(currentIndex, 1);

                // Calculate final index (account for deletion)
                const finalIndex = Math.min(Math.max(0, newOrder), components.length);

                // Insert at new position
                components.insert(finalIndex, [clonedComp]);

                // Update order property for all components
                for (let m = 0; m < components.length; m++) {
                  components.get(m).set('order', m);
                }
              }, this.manager.getDoc().clientID);

              Logger.log(`[YjsStructureBinding] Reordered component ${componentId} from index ${currentIndex} to ${newOrder}`);
              return true;
            }
          }
        }
      }

      console.warn(`[YjsStructureBinding] Component ${componentId} not found for reorder`);
      return false;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error reordering component:`, error);
      return false;
    }
  }

  /**
   * Move a component to a different block within the same page
   * @param {string} componentId - Component to move
   * @param {string} targetBlockId - Target block ID
   * @param {number} newOrder - Order in the new block (optional, defaults to end)
   * @returns {boolean} true if successful
   */
  moveComponentToBlock(componentId, targetBlockId, newOrder = null) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) return false;

      let sourceBlockMap = null;
      let sourceComponents = null;
      let compMap = null;
      let compIndex = -1;
      let targetBlockMap = null;

      // Find source component and target block
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const blockMap = blocks.get(j);
          const blockId = blockMap.get('id') || blockMap.get('blockId');

          // Check if this is target block
          if (blockId === targetBlockId) {
            targetBlockMap = blockMap;
          }

          // Search for component
          const components = blockMap.get('components');
          if (components) {
            for (let k = 0; k < components.length; k++) {
              const comp = components.get(k);
              if (comp.get('id') === componentId) {
                sourceBlockMap = blockMap;
                sourceComponents = components;
                compMap = comp;
                compIndex = k;
              }
            }
          }
        }
      }

      if (!compMap || !targetBlockMap) {
        console.warn(`[YjsStructureBinding] Component ${componentId} or target block ${targetBlockId} not found`);
        return false;
      }

      // If same block, just reorder
      if (sourceBlockMap === targetBlockMap) {
        if (newOrder !== null) {
          return this.reorderComponent(componentId, newOrder);
        }
        return true;
      }

      this.manager.getDoc().transact(() => {
        // Clone component before removing (Yjs can't reuse deleted Y.Maps)
        const clonedComp = this.cloneComponentMapForMove(compMap);

        // Add to target block first
        let targetComponents = targetBlockMap.get('components');
        if (!targetComponents) {
          targetComponents = new this.Y.Array();
          targetBlockMap.set('components', targetComponents);
        }

        // Calculate max order to place at end (not array length, which may differ from orders)
        let maxOrder = -1;
        for (let i = 0; i < targetComponents.length; i++) {
          const existingOrder = targetComponents.get(i).get('order') ?? 0;
          if (existingOrder > maxOrder) maxOrder = existingOrder;
        }
        const finalOrder = newOrder !== null ? newOrder : maxOrder + 1;
        clonedComp.set('order', finalOrder);
        clonedComp.set('blockId', targetBlockId);

        targetComponents.push([clonedComp]);

        // Now remove from source block
        sourceComponents.delete(compIndex, 1);

        // Update orders in source block
        for (let k = 0; k < sourceComponents.length; k++) {
          sourceComponents.get(k).set('order', k);
        }
      }, this.manager.getDoc().clientID);

      Logger.log(`[YjsStructureBinding] Moved component ${componentId} to block ${targetBlockId}`);
      return true;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error moving component to block:`, error);
      return false;
    }
  }

  /**
   * Move a component to a different page (creates new block if needed)
   * @param {string} componentId - Component to move
   * @param {string} targetPageId - Target page ID
   * @param {string} blockName - Name for the new block (optional)
   * @returns {Object|null} { blockId, componentId } if successful
   */
  moveComponentToPage(componentId, targetPageId, blockName = 'Block') {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) return null;

      let sourceBlockMap = null;
      let sourceComponents = null;
      let compMap = null;
      let compIndex = -1;
      let targetPageMap = null;

      // Find source component and target page
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const pageId = pageMap.get('id') || pageMap.get('pageId');

        if (pageId === targetPageId) {
          targetPageMap = pageMap;
        }

        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const blockMap = blocks.get(j);
          const components = blockMap.get('components');
          if (!components) continue;

          for (let k = 0; k < components.length; k++) {
            const comp = components.get(k);
            if (comp.get('id') === componentId) {
              sourceBlockMap = blockMap;
              sourceComponents = components;
              compMap = comp;
              compIndex = k;
            }
          }
        }
      }

      if (!compMap || !targetPageMap) {
        console.warn(`[YjsStructureBinding] Component ${componentId} or target page ${targetPageId} not found`);
        return null;
      }

      let newBlockId = null;

      this.manager.getDoc().transact(() => {
        // Clone component before removing (Yjs can't reuse deleted Y.Maps)
        const clonedComp = this.cloneComponentMapForMove(compMap);

        // Create new block on target page
        let targetBlocks = targetPageMap.get('blocks');
        if (!targetBlocks) {
          targetBlocks = new this.Y.Array();
          targetPageMap.set('blocks', targetBlocks);
        }

        newBlockId = this.generateId('block');
        const newBlockMap = new this.Y.Map();
        const newComponents = new this.Y.Array();

        // Calculate max order to place at end (not array length, which may differ from orders)
        let maxBlockOrder = -1;
        for (let i = 0; i < targetBlocks.length; i++) {
          const existingOrder = targetBlocks.get(i).get('order') ?? 0;
          if (existingOrder > maxBlockOrder) maxBlockOrder = existingOrder;
        }

        newBlockMap.set('id', newBlockId);
        newBlockMap.set('blockId', newBlockId);
        newBlockMap.set('blockName', blockName);
        newBlockMap.set('order', maxBlockOrder + 1);
        newBlockMap.set('createdAt', new Date().toISOString());

        // Update cloned component with new block reference
        clonedComp.set('order', 0);
        clonedComp.set('blockId', newBlockId);
        clonedComp.set('pageId', targetPageId);
        newComponents.push([clonedComp]);

        newBlockMap.set('components', newComponents);
        targetBlocks.push([newBlockMap]);

        // Now remove from source block
        sourceComponents.delete(compIndex, 1);

        // Update orders in source block
        for (let k = 0; k < sourceComponents.length; k++) {
          sourceComponents.get(k).set('order', k);
        }
      }, this.manager.getDoc().clientID);

      Logger.log(`[YjsStructureBinding] Moved component ${componentId} to page ${targetPageId} in new block ${newBlockId}`);
      return { blockId: newBlockId, componentId };
    } catch (error) {
      console.error(`[YjsStructureBinding] Error moving component to page:`, error);
      return null;
    }
  }

  /**
   * Move a block to a different page
   * @param {string} blockId - Block to move
   * @param {string} targetPageId - Target page ID
   * @param {number} newOrder - Order in target page (optional)
   * @returns {boolean} true if successful
   */
  moveBlockToPage(blockId, targetPageId, newOrder = null) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) return false;

      let sourcePageMap = null;
      let sourceBlocks = null;
      let blockMap = null;
      let blockIndex = -1;
      let targetPageMap = null;

      // Find source block and target page
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const pageId = pageMap.get('id') || pageMap.get('pageId');

        if (pageId === targetPageId) {
          targetPageMap = pageMap;
        }

        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const block = blocks.get(j);
          const bId = block.get('id') || block.get('blockId');
          if (bId === blockId) {
            sourcePageMap = pageMap;
            sourceBlocks = blocks;
            blockMap = block;
            blockIndex = j;
          }
        }
      }

      if (!blockMap || !targetPageMap) {
        console.warn(`[YjsStructureBinding] Block ${blockId} or target page ${targetPageId} not found`);
        return false;
      }

      // Don't move to same page
      const sourcePageId = sourcePageMap.get('id') || sourcePageMap.get('pageId');
      if (sourcePageId === targetPageId) {
        console.warn(`[YjsStructureBinding] Block ${blockId} is already on page ${targetPageId}`);
        return false;
      }

      this.manager.getDoc().transact(() => {
        // Clone the block data before removing (Yjs can't reuse deleted Y.Maps)
        const clonedBlock = this.cloneBlockMapForMove(blockMap);

        // Add to target page first (before deleting from source)
        let targetBlocks = targetPageMap.get('blocks');
        if (!targetBlocks) {
          targetBlocks = new this.Y.Array();
          targetPageMap.set('blocks', targetBlocks);
        }

        // Calculate max order to place at end (not array length, which may differ from orders)
        let maxBlockOrder = -1;
        for (let i = 0; i < targetBlocks.length; i++) {
          const existingOrder = targetBlocks.get(i).get('order') ?? 0;
          if (existingOrder > maxBlockOrder) maxBlockOrder = existingOrder;
        }
        const finalOrder = newOrder !== null ? newOrder : maxBlockOrder + 1;
        clonedBlock.set('order', finalOrder);
        clonedBlock.set('pageId', targetPageId);

        // Update component references in the clone
        const clonedComponents = clonedBlock.get('components');
        if (clonedComponents) {
          for (let k = 0; k < clonedComponents.length; k++) {
            clonedComponents.get(k).set('pageId', targetPageId);
          }
        }

        targetBlocks.push([clonedBlock]);

        // Now remove from source page
        sourceBlocks.delete(blockIndex, 1);

        // Update orders in source page
        for (let k = 0; k < sourceBlocks.length; k++) {
          sourceBlocks.get(k).set('order', k);
        }
      }, this.manager.getDoc().clientID);

      Logger.log(`[YjsStructureBinding] Moved block ${blockId} to page ${targetPageId}`);
      return true;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error moving block to page:`, error);
      return false;
    }
  }

  /**
   * Delete a component
   * @param {string} componentId
   * @returns {boolean} true if deleted, false if not found or error
   */
  deleteComponent(componentId) {
    try {
      const navigation = this.manager.getNavigation();
      if (!navigation) {
        console.warn('[YjsStructureBinding] Cannot delete component: navigation is null');
        return false;
      }

      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        if (!pageMap) continue;

        const blocks = pageMap.get('blocks');
        if (!blocks) continue;

        for (let j = 0; j < blocks.length; j++) {
          const blockMap = blocks.get(j);
          if (!blockMap) continue;

          const components = blockMap.get('components');
          if (!components) continue;

          for (let k = 0; k < components.length; k++) {
            const compMap = components.get(k);
            if (!compMap) continue;

            if (compMap.get('id') === componentId) {
              // Use transaction with clientID origin for UndoManager tracking
              this.manager.getDoc().transact(() => {
                components.delete(k, 1);
              }, this.manager.getDoc().clientID);
              Logger.log(`[YjsStructureBinding] Deleted component: ${componentId}`);
              return true;
            }
          }
        }
      }

      console.warn(`[YjsStructureBinding] Component not found for deletion: ${componentId}`);
      return false;
    } catch (error) {
      console.error(`[YjsStructureBinding] Error deleting component ${componentId}:`, error);
      return false;
    }
  }

  // ===== Helper Methods =====

  getPageMap(pageId) {
    const navigation = this.manager.getNavigation();
    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      if (pageMap.get('id') === pageId) {
        return pageMap;
      }
    }
    return null;
  }

  /**
   * Get properties for a page
   * @param {string} pageId
   * @returns {Object|null} Properties object or null if not found
   */
  getPageProperties(pageId) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) return null;

    let result = {};
    const propsMap = pageMap.get('properties');
    if (propsMap && typeof propsMap.toJSON === 'function') {
      result = propsMap.toJSON();
    } else if (propsMap && typeof propsMap === 'object') {
      result = { ...propsMap };
    }

    // Include pageName as titleNode if not already set in properties
    // pageName is stored at the pageMap level, not inside properties
    if (!result.titleNode) {
      result.titleNode = pageMap.get('pageName') || '';
    }

    return result;
  }

  /**
   * Get properties for a block
   * @param {string} blockId - Block ID to get properties from
   * @returns {Object|null} Properties object or null if not found
   */
  getBlockProperties(blockId) {
    // Find the block in any page
    const navigation = this.manager.getNavigation();

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      const blocks = pageMap.get('blocks');
      if (!blocks) continue;

      for (let j = 0; j < blocks.length; j++) {
        const blockMap = blocks.get(j);
        if (blockMap.get('id') === blockId || blockMap.get('blockId') === blockId) {
          const propsMap = blockMap.get('properties');
          if (propsMap && typeof propsMap.toJSON === 'function') {
            return propsMap.toJSON();
          } else if (propsMap && typeof propsMap === 'object') {
            return { ...propsMap };
          }
          return {};
        }
      }
    }
    return null;
  }

  /**
   * Get properties for a component (iDevice)
   * @param {string} componentId - Component ID to get properties from
   * @returns {Object|null} Properties object or null if not found
   */
  getComponentProperties(componentId) {
    const navigation = this.manager.getNavigation();

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      const blocks = pageMap.get('blocks');
      if (!blocks) continue;

      for (let j = 0; j < blocks.length; j++) {
        const blockMap = blocks.get(j);
        const components = blockMap.get('components');
        if (!components) continue;

        for (let k = 0; k < components.length; k++) {
          const compMap = components.get(k);
          if (compMap.get('id') === componentId || compMap.get('ideviceId') === componentId) {
            const propsMap = compMap.get('properties');
            if (propsMap && typeof propsMap.toJSON === 'function') {
              return propsMap.toJSON();
            } else if (propsMap && typeof propsMap === 'object') {
              return { ...propsMap };
            }
            return {};
          }
        }
      }
    }
    return null;
  }

  /**
   * Update properties for a page
   * @param {string} pageId
   * @param {Object} properties - Properties to update
   * @returns {boolean} true if updated successfully
   */
  updatePageProperties(pageId, properties) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) {
      console.warn(`[YjsStructureBinding] Cannot update properties: page ${pageId} not found`);
      return false;
    }

    const Y = window.Y;

    // Checkbox fields that should be converted to boolean
    const checkboxFields = ['hidePageTitle', 'editableInPage', 'visibility', 'highlight'];

    this.manager.getDoc().transact(() => {
      let propsMap = pageMap.get('properties');
      if (!propsMap || typeof propsMap.set !== 'function') {
        propsMap = new Y.Map();
        pageMap.set('properties', propsMap);
      }

      // Update each property
      Object.entries(properties).forEach(([key, value]) => {
        let finalValue = value;

        // Only convert to boolean for checkbox fields
        if (checkboxFields.includes(key)) {
          if (value === 'true' || value === '1' || value === true) {
            finalValue = true;
          } else {
            finalValue = false;
          }
        }

        propsMap.set(key, finalValue);
      });
    }, this.manager.getDoc().clientID);

    Logger.log(`[YjsStructureBinding] Updated page ${pageId} properties:`, properties);
    return true;
  }

  getBlockMap(pageId, blockId) {
    const pageMap = this.getPageMap(pageId);
    if (!pageMap) return null;

    const blocks = pageMap.get('blocks');
    if (!blocks) return null;

    for (let i = 0; i < blocks.length; i++) {
      const blockMap = blocks.get(i);
      if (blockMap.get('id') === blockId) {
        return blockMap;
      }
    }
    return null;
  }

  getComponentMap(componentId) {
    const navigation = this.manager.getNavigation();

    for (let i = 0; i < navigation.length; i++) {
      const pageMap = navigation.get(i);
      const blocks = pageMap.get('blocks');
      if (!blocks) continue;

      for (let j = 0; j < blocks.length; j++) {
        const blockMap = blocks.get(j);
        const components = blockMap.get('components');
        if (!components) continue;

        for (let k = 0; k < components.length; k++) {
          const compMap = components.get(k);
          if (compMap.get('id') === componentId) {
            return compMap;
          }
        }
      }
    }
    return null;
  }

  mapToPage(pageMap, index) {
    // Extract properties from Y.Map if present
    const propsMap = pageMap.get('properties');
    let properties = null;
    if (propsMap && typeof propsMap.toJSON === 'function') {
      properties = propsMap.toJSON();
    } else if (propsMap && typeof propsMap === 'object') {
      // Handle case where properties is already a plain object
      properties = { ...propsMap };
    }

    return {
      id: pageMap.get('id'),
      pageId: pageMap.get('pageId'),
      pageName: pageMap.get('pageName'),
      parentId: pageMap.get('parentId'),
      order: pageMap.get('order') ?? index,
      blockCount: pageMap.get('blocks')?.length || 0,
      createdAt: pageMap.get('createdAt'),
      properties: properties,
      _ymap: pageMap,
    };
  }

  mapToBlock(blockMap, index) {
    return {
      id: blockMap.get('id'),
      blockId: blockMap.get('blockId'),
      blockName: blockMap.get('blockName'),
      iconName: blockMap.get('iconName'),
      blockType: blockMap.get('blockType'),
      order: blockMap.get('order') ?? index,
      componentCount: blockMap.get('components')?.length || 0,
      createdAt: blockMap.get('createdAt'),
      properties: blockMap.get('properties'),
      _ymap: blockMap,
    };
  }

  mapToComponent(compMap, index) {
    // Try htmlContent (Y.Text) first, then fall back to htmlView (plain string)
    const rawHtmlContent = compMap.get('htmlContent');
    const rawHtmlView = compMap.get('htmlView');
    let htmlContent;

    if (rawHtmlContent instanceof this.Y.Text) {
      htmlContent = rawHtmlContent.toString();
    } else if (typeof rawHtmlContent === 'string' && rawHtmlContent) {
      htmlContent = rawHtmlContent;
    } else if (typeof rawHtmlView === 'string' && rawHtmlView) {
      // Fallback to htmlView (used during import when Y.Text is not created)
      htmlContent = rawHtmlView;
    } else {
      htmlContent = '';
    }

    // Get jsonProperties - handle both Y.Map and string storage
    let jsonProperties;
    const rawJsonProps = compMap.get('jsonProperties');
    // Check if it's a Y.Map-like object (has forEach method, not a string)
    const isYMapLike = rawJsonProps &&
      typeof rawJsonProps === 'object' &&
      typeof rawJsonProps.forEach === 'function' &&
      !(rawJsonProps instanceof Array);

    if (isYMapLike) {
      // Convert Y.Map back to JSON string (for consistency with ElpxImporter)
      const obj = {};
      rawJsonProps.forEach((value, key) => {
        obj[key] = value;
      });
      jsonProperties = JSON.stringify(obj);
    } else if (typeof rawJsonProps === 'string') {
      jsonProperties = rawJsonProps;
    } else {
      jsonProperties = '{}';
    }

    // Add MIME types to media elements BEFORE resolving URLs
    // (while asset:// URLs still contain filename with extension)
    if (typeof window.addMediaTypes === 'function') {
      if (htmlContent && (htmlContent.includes('<audio') || htmlContent.includes('<video'))) {
        htmlContent = window.addMediaTypes(htmlContent);
      }
    }

    // Resolve asset:// URLs to blob:// URLs for browser rendering
    // The asset:// URLs are kept in Yjs for cross-client sync
    if (typeof window.resolveAssetUrls === 'function') {
      if (htmlContent && htmlContent.includes('asset://')) {
        htmlContent = window.resolveAssetUrls(htmlContent);
      }
      if (jsonProperties && jsonProperties.includes('asset://')) {
        jsonProperties = window.resolveAssetUrls(jsonProperties);
      }
    }

    return {
      id: compMap.get('id'),
      ideviceId: compMap.get('ideviceId'),
      ideviceType: compMap.get('ideviceType'),
      order: compMap.get('order') ?? index,
      htmlContent: htmlContent,
      jsonProperties: jsonProperties,
      createdAt: compMap.get('createdAt'),
      updatedAt: compMap.get('updatedAt'),
      _ymap: compMap,
    };
  }

  generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== Import from API Structure =====

  /**
   * Clear all navigation data from Yjs document
   * Call this before importing a new project
   */
  clearNavigation() {
    const navigation = this.manager.getNavigation();
    const length = navigation.length;

    if (length > 0) {
      navigation.delete(0, length);
      Logger.log(`[YjsStructureBinding] Cleared ${length} pages from navigation`);
    }
  }

  /**
   * Import structure from API response into Yjs document
   * This is called when opening an ELP/ELPX file
   *
   * @param {Array} apiStructure - Array of pages from API response
   * Structure expected:
   * [{
   *   id: number,
   *   pageId: string,
   *   pageName: string,
   *   parent: string|null,
   *   order: number,
   *   odePagStructureSyncs: [{
   *     blockId: string,
   *     blockName: string,
   *     order: number,
   *     odeComponentsSyncs: [{
   *       odeIdeviceId: string,
   *       odeIdeviceTypeName: string,
   *       htmlView: string,
   *       jsonProperties: string,
   *       order: number
   *     }]
   *   }]
   * }]
   */
  importFromApiStructure(apiStructure) {
    if (!apiStructure || !Array.isArray(apiStructure)) {
      console.warn('[YjsStructureBinding] Invalid API structure to import');
      return;
    }

    const ydoc = this.manager.getDoc();
    const navigation = this.manager.getNavigation();

    // Use a transaction for all changes (atomic, single undo step)
    ydoc.transact(() => {
      // Clear existing navigation
      if (navigation.length > 0) {
        navigation.delete(0, navigation.length);
      }

      // Import each page
      for (const apiPage of apiStructure) {
        const pageMap = this.createPageMapFromApi(apiPage);
        navigation.push([pageMap]);
      }
    }, 'import');

    Logger.log(`[YjsStructureBinding] Imported ${apiStructure.length} pages from API`);
  }

  /**
   * Create a Y.Map page from API page data
   * @private
   */
  createPageMapFromApi(apiPage) {
    const pageMap = new this.Y.Map();

    // Use original pageId or generate one
    const pageId = apiPage.pageId || apiPage.id?.toString() || this.generateId('page');

    pageMap.set('id', pageId);
    pageMap.set('pageId', pageId);
    pageMap.set('pageName', apiPage.pageName || 'Untitled');
    // Handle parent: 'root', null, undefined → null; otherwise use the parent ID
    pageMap.set('parentId', (apiPage.parent === 'root' || !apiPage.parent) ? null : apiPage.parent);
    pageMap.set('order', apiPage.order ?? 0);
    pageMap.set('createdAt', new Date().toISOString());

    // Import page properties if available
    if (apiPage.odeNavStructureSyncProperties) {
      const propsMap = new this.Y.Map();
      for (const [key, propData] of Object.entries(apiPage.odeNavStructureSyncProperties)) {
        if (propData && propData.value !== undefined) {
          propsMap.set(key, propData.value);
        }
      }
      pageMap.set('properties', propsMap);
    }

    // Import blocks
    const blocksArray = new this.Y.Array();
    if (apiPage.odePagStructureSyncs && Array.isArray(apiPage.odePagStructureSyncs)) {
      for (const apiBlock of apiPage.odePagStructureSyncs) {
        const blockMap = this.createBlockMapFromApi(apiBlock);
        blocksArray.push([blockMap]);
      }
    }
    pageMap.set('blocks', blocksArray);

    return pageMap;
  }

  /**
   * Create a Y.Map block from API block data
   * @private
   */
  createBlockMapFromApi(apiBlock) {
    const blockMap = new this.Y.Map();

    const blockId = apiBlock.blockId || apiBlock.id?.toString() || this.generateId('block');

    blockMap.set('id', blockId);
    blockMap.set('blockId', blockId);
    blockMap.set('blockName', apiBlock.blockName ?? '');  // Preserve empty string
    blockMap.set('blockType', apiBlock.blockType || 'default');
    blockMap.set('order', apiBlock.order ?? 0);
    blockMap.set('createdAt', new Date().toISOString());

    // Import block properties if available
    if (apiBlock.odePagStructureSyncProperties) {
      const propsMap = new this.Y.Map();
      for (const [key, propData] of Object.entries(apiBlock.odePagStructureSyncProperties)) {
        if (propData && propData.value !== undefined) {
          propsMap.set(key, propData.value);
        }
      }
      blockMap.set('properties', propsMap);
    }

    // Import components (iDevices)
    const componentsArray = new this.Y.Array();
    if (apiBlock.odeComponentsSyncs && Array.isArray(apiBlock.odeComponentsSyncs)) {
      for (const apiComp of apiBlock.odeComponentsSyncs) {
        const compMap = this.createComponentMapFromApi(apiComp);
        componentsArray.push([compMap]);
      }
    }
    blockMap.set('components', componentsArray);

    return blockMap;
  }

  /**
   * Create a Y.Map component from API component data
   * @private
   */
  createComponentMapFromApi(apiComp) {
    const compMap = new this.Y.Map();

    const compId = apiComp.odeIdeviceId || apiComp.id?.toString() || this.generateId('idevice');

    compMap.set('id', compId);
    compMap.set('ideviceId', compId);
    compMap.set('ideviceType', apiComp.odeIdeviceTypeName || 'FreeTextIdevice');
    compMap.set('order', apiComp.order ?? 0);
    compMap.set('createdAt', new Date().toISOString());

    // Store HTML content as plain string - Y.Text will be created on-demand when TinyMCE binds
    // This avoids Y.Text integration errors during import
    const htmlContent = (apiComp.htmlView != null && typeof apiComp.htmlView === 'string')
      ? apiComp.htmlView
      : '';
    compMap.set('htmlView', htmlContent);

    // Store JSON properties as string (consistent with ElpxImporter)
    // This ensures mapToComponent can handle it properly
    if (apiComp.jsonProperties) {
      const jsonStr = typeof apiComp.jsonProperties === 'string'
        ? apiComp.jsonProperties
        : JSON.stringify(apiComp.jsonProperties);
      compMap.set('jsonProperties', jsonStr);
    }

    // Import component properties if available
    if (apiComp.odeComponentsSyncProperties) {
      const propsMap = new this.Y.Map();
      for (const [key, propData] of Object.entries(apiComp.odeComponentsSyncProperties)) {
        if (propData && propData.value !== undefined) {
          propsMap.set(key, propData.value);
        }
      }
      compMap.set('properties', propsMap);
    }

    // Store additional fields
    if (apiComp.blockId) compMap.set('blockId', apiComp.blockId);
    if (apiComp.pageId) compMap.set('pageId', apiComp.pageId);

    return compMap;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YjsStructureBinding;
} else {
  window.YjsStructureBinding = YjsStructureBinding;
}

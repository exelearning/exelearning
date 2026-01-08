/**
 * YjsStructureTreeAdapter
 * Adapts Yjs structure changes to the legacy tree UI (jsTree or similar).
 * Provides bidirectional sync between Yjs Y.Array and the DOM-based tree.
 *
 * Usage:
 *   const adapter = new YjsStructureTreeAdapter(structureBinding, treeContainerId);
 *   adapter.initialize();
 */
class YjsStructureTreeAdapter {
  /**
   * @param {YjsStructureBinding} structureBinding - Yjs structure binding
   * @param {string} treeContainerId - ID of the tree container element
   */
  constructor(structureBinding, treeContainerId) {
    this.structureBinding = structureBinding;
    this.containerId = treeContainerId;
    this.container = null;
    this.tree = null;
    this._observers = [];
    this._isUpdating = false;
    this._selectedPageId = null;
  }

  /**
   * Initialize the adapter
   */
  initialize() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.warn(`[YjsStructureTreeAdapter] Container #${this.containerId} not found`);
      return;
    }

    // Initial render
    this.renderTree();

    // Observe Yjs changes
    this.observeYjsChanges();

    Logger.log('[YjsStructureTreeAdapter] Initialized');
  }

  /**
   * Observe Yjs structure changes
   */
  observeYjsChanges() {
    const navigation = this.structureBinding.manager.getNavigation();

    const observer = () => {
      if (this._isUpdating) return;
      this.renderTree();
    };

    navigation.observeDeep(observer);
    this._observers.push(() => navigation.unobserveDeep(observer));
  }

  /**
   * Render the tree from Yjs data
   */
  renderTree() {
    const pages = this.structureBinding.getPages();
    const treeData = this.buildTreeData(pages);

    // If using jsTree
    if (this.container.jstree) {
      this.updateJsTree(treeData);
    } else {
      // Fallback to simple HTML tree
      this.renderHtmlTree(treeData);
    }
  }

  /**
   * Build hierarchical tree data from flat pages array
   * @param {Array} pages - Flat array of pages
   * @returns {Array} Hierarchical tree data
   */
  buildTreeData(pages) {
    const map = new Map();
    const roots = [];

    // Create map
    for (const page of pages) {
      map.set(page.id, {
        id: page.id,
        text: page.pageName || _('Untitled'),
        parentId: page.parentId,
        order: page.order ?? 0,
        children: [],
        data: page,
      });
    }

    // Build hierarchy
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort by order
    const sortChildren = (nodes) => {
      nodes.sort((a, b) => a.order - b.order);
      for (const node of nodes) {
        sortChildren(node.children);
      }
    };
    sortChildren(roots);

    return roots;
  }

  /**
   * Update jsTree instance
   * @param {Array} treeData - Tree data
   */
  updateJsTree(treeData) {
    const jstreeData = this.convertToJsTreeFormat(treeData);

    try {
      const jsTree = this.container.jstree(true);
      if (jsTree) {
        // Refresh with new data
        jsTree.settings.core.data = jstreeData;
        jsTree.refresh();

        // Restore selection
        if (this._selectedPageId) {
          jsTree.select_node(this._selectedPageId);
        }
      }
    } catch (e) {
      console.error('[YjsStructureTreeAdapter] jsTree update error:', e);
    }
  }

  /**
   * Convert tree data to jsTree format
   * @param {Array} nodes - Tree nodes
   * @returns {Array} jsTree format nodes
   */
  convertToJsTreeFormat(nodes) {
    return nodes.map((node) => ({
      id: node.id,
      text: node.text,
      icon: 'material-icons-outlined edit_note',
      state: { opened: true },
      children: this.convertToJsTreeFormat(node.children),
      data: node.data,
    }));
  }

  /**
   * Render simple HTML tree (fallback)
   * @param {Array} treeData - Tree data
   */
  renderHtmlTree(treeData) {
    const html = this.buildHtmlTreeNodes(treeData, 0);
    this.container.innerHTML = `<ul class="yjs-tree-root">${html}</ul>`;

    // Add click handlers
    this.container.querySelectorAll('.yjs-tree-node').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const pageId = el.dataset.pageId;
        this.selectPage(pageId);
      });
    });

    // Add drag-drop handlers
    this.setupDragDrop();
  }

  /**
   * Build HTML for tree nodes recursively
   * @param {Array} nodes - Tree nodes
   * @param {number} depth - Current depth
   * @returns {string} HTML string
   */
  buildHtmlTreeNodes(nodes, depth) {
    return nodes
      .map((node) => {
        const hasChildren = node.children.length > 0;
        const isSelected = node.id === this._selectedPageId;
        const childrenHtml = hasChildren
          ? `<ul class="yjs-tree-children">${this.buildHtmlTreeNodes(node.children, depth + 1)}</ul>`
          : '';

        return `
          <li class="yjs-tree-item ${hasChildren ? 'has-children' : ''}" data-page-id="${node.id}">
            <div class="yjs-tree-node ${isSelected ? 'selected' : ''}"
                 data-page-id="${node.id}"
                 draggable="true"
                 style="padding-left: ${depth * 20}px">
              <span class="yjs-tree-icon material-icons-outlined">
                ${hasChildren ? 'folder_open' : 'description'}
              </span>
              <span class="yjs-tree-text">${this.escapeHtml(node.text)}</span>
              <span class="yjs-tree-actions">
                <button class="yjs-tree-btn yjs-add-child" title="${_('Add child page')}">+</button>
                <button class="yjs-tree-btn yjs-rename" title="${_('Rename')}">✏️</button>
                <button class="yjs-tree-btn yjs-delete" title="${_('Delete')}">×</button>
              </span>
            </div>
            ${childrenHtml}
          </li>
        `;
      })
      .join('');
  }

  /**
   * Set up drag and drop for tree nodes
   */
  setupDragDrop() {
    let draggedEl = null;
    let draggedPageId = null;

    this.container.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('yjs-tree-node')) {
        draggedEl = e.target;
        draggedPageId = e.target.dataset.pageId;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });

    this.container.addEventListener('dragend', (e) => {
      if (draggedEl) {
        draggedEl.classList.remove('dragging');
        draggedEl = null;
        draggedPageId = null;
      }
      this.container.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    });

    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      const targetNode = e.target.closest('.yjs-tree-node');
      if (targetNode && targetNode !== draggedEl) {
        this.container.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
        targetNode.classList.add('drag-over');
      }
    });

    this.container.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetNode = e.target.closest('.yjs-tree-node');
      if (targetNode && draggedPageId) {
        const targetPageId = targetNode.dataset.pageId;
        if (targetPageId !== draggedPageId) {
          this.movePageToParent(draggedPageId, targetPageId);
        }
      }
    });
  }

  /**
   * Move a page to be a child of another
   * @param {string} pageId - Page to move
   * @param {string} newParentId - New parent page ID
   */
  movePageToParent(pageId, newParentId) {
    this._isUpdating = true;
    try {
      // Get current pages under new parent to determine order
      const siblings = this.structureBinding.getPages().filter((p) => p.parentId === newParentId);
      const newOrder = siblings.length;

      this.structureBinding.movePage(pageId, newOrder, newParentId);
      Logger.log(`[YjsStructureTreeAdapter] Moved page ${pageId} under ${newParentId}`);
    } finally {
      this._isUpdating = false;
      this.renderTree();
    }
  }

  /**
   * Select a page
   * @param {string} pageId - Page ID
   */
  selectPage(pageId) {
    this._selectedPageId = pageId;

    // Update UI
    this.container.querySelectorAll('.yjs-tree-node.selected').forEach((el) => el.classList.remove('selected'));
    const node = this.container.querySelector(`.yjs-tree-node[data-page-id="${pageId}"]`);
    if (node) {
      node.classList.add('selected');
    }

    // Emit event
    this.container.dispatchEvent(
      new CustomEvent('pageSelected', {
        detail: { pageId },
        bubbles: true,
      })
    );

    // Call legacy structure engine if available
    if (window.eXeLearning?.app?.project?.structure?.selectNode) {
      window.eXeLearning.app.project.structure.selectNode(pageId);
    }
  }

  /**
   * Add a new page
   * @param {string} parentId - Parent page ID (null for root)
   * @param {string} pageName - Page name
   * @returns {Object} Created page
   */
  addPage(parentId = null, pageName = _('New Page')) {
    this._isUpdating = true;
    try {
      const page = this.structureBinding.addPage(pageName, parentId);
      Logger.log(`[YjsStructureTreeAdapter] Added page: ${page.id}`);
      return page;
    } finally {
      this._isUpdating = false;
      this.renderTree();
    }
  }

  /**
   * Rename a page
   * @param {string} pageId - Page ID
   * @param {string} newName - New name
   */
  renamePage(pageId, newName) {
    this._isUpdating = true;
    try {
      this.structureBinding.updatePage(pageId, { pageName: newName });
      Logger.log(`[YjsStructureTreeAdapter] Renamed page ${pageId} to "${newName}"`);
    } finally {
      this._isUpdating = false;
      this.renderTree();
    }
  }

  /**
   * Delete a page
   * @param {string} pageId - Page ID
   */
  deletePage(pageId) {
    this._isUpdating = true;
    try {
      this.structureBinding.deletePage(pageId);
      Logger.log(`[YjsStructureTreeAdapter] Deleted page ${pageId}`);

      // Clear selection if deleted page was selected
      if (this._selectedPageId === pageId) {
        this._selectedPageId = null;
      }
    } finally {
      this._isUpdating = false;
      this.renderTree();
    }
  }

  /**
   * Get the currently selected page ID
   * @returns {string|null}
   */
  getSelectedPageId() {
    return this._selectedPageId;
  }

  /**
   * Escape HTML entities
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Add CSS styles for the tree
   * @deprecated Styles are now in assets/styles/components/_collaborative.scss
   */
  addStyles() {
    // No-op: styles moved to _collaborative.scss
  }

  /**
   * Destroy the adapter
   */
  destroy() {
    for (const cleanup of this._observers) {
      try {
        cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this._observers = [];
    Logger.log('[YjsStructureTreeAdapter] Destroyed');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YjsStructureTreeAdapter;
} else {
  window.YjsStructureTreeAdapter = YjsStructureTreeAdapter;
}

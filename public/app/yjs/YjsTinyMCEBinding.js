/**
 * YjsTinyMCEBinding
 * Binds TinyMCE editor instances to Y.Text for real-time collaborative editing.
 * Handles cursor positions, selections, and content synchronization.
 *
 * Usage:
 *   const binding = new YjsTinyMCEBinding(editor, yText, awareness);
 *   // When done editing:
 *   binding.destroy();
 */
class YjsTinyMCEBinding {
  /**
   * @param {TinyMCE.Editor} editor - TinyMCE editor instance
   * @param {Y.Text} yText - Yjs Text type to bind
   * @param {Object} options - Options
   */
  constructor(editor, yText, options = {}) {
    this.editor = editor;
    this.yText = yText;
    this.awareness = options.awareness || null;
    this.userId = options.userId || 'unknown';
    this.userColor = options.userColor || this.generateUserColor();
    this.userName = options.userName || 'User';

    this._isUpdating = false;
    this._observers = [];
    this._editorListeners = [];

    this.init();
  }

  /**
   * Initialize the binding
   */
  init() {
    // Set initial content from Y.Text
    this.syncToEditor();

    // Observe Y.Text changes
    this._yTextObserver = (event, transaction) => {
      if (transaction.local) return; // Skip local changes
      this.syncToEditor();
    };
    this.yText.observe(this._yTextObserver);
    this._observers.push(() => this.yText.unobserve(this._yTextObserver));

    // Listen to TinyMCE changes
    this.bindEditorEvents();

    // Set up awareness for cursor positions
    if (this.awareness) {
      this.setupAwareness();
    }

    Logger.log('[YjsTinyMCEBinding] Initialized');
  }

  /**
   * Bind TinyMCE editor events
   */
  bindEditorEvents() {
    const editor = this.editor;

    // Input event for character-by-character changes
    const onInput = () => {
      if (this._isUpdating) return;
      this.syncFromEditor();
    };

    // Change event for larger changes
    const onChange = () => {
      if (this._isUpdating) return;
      this.syncFromEditor();
    };

    // Selection change for cursor awareness
    const onSelectionChange = () => {
      this.updateAwarenessSelection();
    };

    // Bind events
    editor.on('input', onInput);
    editor.on('change', onChange);
    editor.on('NodeChange', onChange);
    editor.on('SelectionChange', onSelectionChange);

    this._editorListeners.push(
      () => editor.off('input', onInput),
      () => editor.off('change', onChange),
      () => editor.off('NodeChange', onChange),
      () => editor.off('SelectionChange', onSelectionChange)
    );
  }

  /**
   * Sync Y.Text content to TinyMCE editor
   */
  syncToEditor() {
    this._isUpdating = true;

    try {
      const content = this.yText.toString();
      const currentContent = this.editor.getContent();

      if (content !== currentContent) {
        // Save cursor position
        const bookmark = this.editor.selection?.getBookmark(2, true);

        // Update content
        this.editor.setContent(content);

        // Restore cursor position
        if (bookmark) {
          try {
            this.editor.selection.moveToBookmark(bookmark);
          } catch (e) {
            // Bookmark may be invalid after content change
          }
        }
      }
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * Sync TinyMCE editor content to Y.Text
   */
  syncFromEditor() {
    const content = this.editor.getContent();
    const currentYText = this.yText.toString();

    if (content === currentYText) return;

    // Use diff to apply minimal changes
    const diff = this.computeDiff(currentYText, content);

    this.yText.doc.transact(() => {
      let offset = 0;
      for (const op of diff) {
        if (op.type === 'delete') {
          this.yText.delete(op.index + offset, op.length);
          offset -= op.length;
        } else if (op.type === 'insert' && op.text != null) {
          // Ensure op.text is valid before insert
          const safeText = typeof op.text === 'string' ? op.text : '';
          this.yText.insert(op.index + offset, safeText);
          offset += safeText.length;
        }
      }
    });
  }

  /**
   * Compute minimal diff between two strings
   * @param {string} oldStr - Old string
   * @param {string} newStr - New string
   * @returns {Array} Array of operations
   */
  computeDiff(oldStr, newStr) {
    const ops = [];

    // Simple diff algorithm: find common prefix and suffix
    let prefixLen = 0;
    while (prefixLen < oldStr.length && prefixLen < newStr.length && oldStr[prefixLen] === newStr[prefixLen]) {
      prefixLen++;
    }

    let oldSuffixStart = oldStr.length;
    let newSuffixStart = newStr.length;
    while (
      oldSuffixStart > prefixLen &&
      newSuffixStart > prefixLen &&
      oldStr[oldSuffixStart - 1] === newStr[newSuffixStart - 1]
    ) {
      oldSuffixStart--;
      newSuffixStart--;
    }

    // Delete removed portion
    if (oldSuffixStart > prefixLen) {
      ops.push({
        type: 'delete',
        index: prefixLen,
        length: oldSuffixStart - prefixLen,
      });
    }

    // Insert new portion
    if (newSuffixStart > prefixLen) {
      ops.push({
        type: 'insert',
        index: prefixLen,
        text: newStr.slice(prefixLen, newSuffixStart),
      });
    }

    return ops;
  }

  /**
   * Set up awareness for cursor positions
   */
  setupAwareness() {
    // Update local cursor state
    this.awareness.setLocalStateField('cursor', {
      userId: this.userId,
      userName: this.userName,
      color: this.userColor,
      anchor: null,
      head: null,
    });

    // Observe remote cursor changes
    this._awarenessObserver = () => {
      this.renderRemoteCursors();
    };
    this.awareness.on('change', this._awarenessObserver);
    this._observers.push(() => this.awareness.off('change', this._awarenessObserver));
  }

  /**
   * Update awareness with current selection
   */
  updateAwarenessSelection() {
    if (!this.awareness) return;

    const selection = this.editor.selection;
    if (!selection) return;

    const range = selection.getRng();
    if (!range) return;

    // Get cursor position as text offset
    const content = this.editor.getContent({ format: 'text' });
    const anchor = this.getTextOffset(range.startContainer, range.startOffset);
    const head = this.getTextOffset(range.endContainer, range.endOffset);

    this.awareness.setLocalStateField('cursor', {
      userId: this.userId,
      userName: this.userName,
      color: this.userColor,
      anchor,
      head,
    });
  }

  /**
   * Get text offset from DOM position
   * @param {Node} node - DOM node
   * @param {number} offset - Offset within node
   * @returns {number} Text offset
   */
  getTextOffset(node, offset) {
    const walker = document.createTreeWalker(
      this.editor.getBody(),
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let totalOffset = 0;
    let currentNode;

    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return totalOffset + offset;
      }
      totalOffset += currentNode.textContent.length;
    }

    return totalOffset;
  }

  /**
   * Render remote user cursors
   */
  renderRemoteCursors() {
    if (!this.awareness) return;

    // Remove existing cursor elements
    const existingCursors = this.editor.getBody().querySelectorAll('.yjs-remote-cursor');
    existingCursors.forEach((el) => el.remove());

    // Get all awareness states
    const states = this.awareness.getStates();

    states.forEach((state, clientId) => {
      if (clientId === this.awareness.clientID) return; // Skip local

      const cursor = state.cursor;
      if (!cursor || cursor.anchor === null) return;

      // Create cursor element
      const cursorEl = document.createElement('span');
      cursorEl.className = 'yjs-remote-cursor';
      cursorEl.style.cssText = `
        position: absolute;
        width: 2px;
        background-color: ${cursor.color};
        pointer-events: none;
      `;

      // Create label
      const labelEl = document.createElement('span');
      labelEl.className = 'yjs-cursor-label';
      labelEl.textContent = cursor.userName;
      labelEl.style.cssText = `
        position: absolute;
        top: -18px;
        left: 0;
        font-size: 10px;
        background-color: ${cursor.color};
        color: white;
        padding: 1px 4px;
        border-radius: 2px;
        white-space: nowrap;
      `;
      cursorEl.appendChild(labelEl);

      // Position cursor (simplified - would need more work for accurate positioning)
      try {
        const range = this.createRangeFromOffset(cursor.anchor);
        if (range) {
          const rect = range.getBoundingClientRect();
          const bodyRect = this.editor.getBody().getBoundingClientRect();
          cursorEl.style.left = `${rect.left - bodyRect.left}px`;
          cursorEl.style.top = `${rect.top - bodyRect.top}px`;
          cursorEl.style.height = `${rect.height || 16}px`;
          this.editor.getBody().appendChild(cursorEl);
        }
      } catch (e) {
        // Ignore positioning errors
      }
    });
  }

  /**
   * Create a DOM range from text offset
   * @param {number} offset - Text offset
   * @returns {Range|null} DOM range
   */
  createRangeFromOffset(offset) {
    const walker = document.createTreeWalker(
      this.editor.getBody(),
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentOffset = 0;
    let currentNode;

    while ((currentNode = walker.nextNode())) {
      const nodeLen = currentNode.textContent.length;
      if (currentOffset + nodeLen >= offset) {
        const range = document.createRange();
        range.setStart(currentNode, offset - currentOffset);
        range.collapse(true);
        return range;
      }
      currentOffset += nodeLen;
    }

    return null;
  }

  /**
   * Generate a random user color
   * @returns {string} Hex color
   */
  generateUserColor() {
    const colors = [
      '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
      '#2196f3', '#03a9f4', '#00bcd4', '#009688',
      '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
      '#ffc107', '#ff9800', '#ff5722', '#795548',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get the current Y.Text content
   * @returns {string}
   */
  getContent() {
    return this.yText.toString();
  }

  /**
   * Set content (replaces all)
   * @param {string} content - New content
   */
  setContent(content) {
    this.yText.delete(0, this.yText.length);
    // Ensure we never insert null - use empty string as fallback
    const safeContent = (content != null && typeof content === 'string') ? content : '';
    this.yText.insert(0, safeContent);
  }

  /**
   * Destroy the binding
   */
  destroy() {
    // Remove observers
    for (const cleanup of this._observers) {
      try {
        cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Remove editor listeners
    for (const cleanup of this._editorListeners) {
      try {
        cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Remove cursor elements
    const cursors = this.editor.getBody()?.querySelectorAll('.yjs-remote-cursor');
    cursors?.forEach((el) => el.remove());

    this._observers = [];
    this._editorListeners = [];

    Logger.log('[YjsTinyMCEBinding] Destroyed');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YjsTinyMCEBinding;
} else {
  window.YjsTinyMCEBinding = YjsTinyMCEBinding;
}

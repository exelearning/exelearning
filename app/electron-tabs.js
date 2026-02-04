/**
 * Tab Manager for eXeLearning on Windows/Linux
 * Implements iframe-based tabs since native tabs are only available on macOS
 */

class TabManager {
    constructor() {
        this.tabs = new Map(); // id -> { iframe, tabBtn, title, projectId }
        this.activeTabId = null;
        this.nextId = 1;
        this.draggedTab = null;
    }

    /**
     * Create a new tab
     * @param {string} [filePath] - Optional file path to open
     * @returns {number} The new tab ID
     */
    createTab(filePath = null) {
        const id = this.nextId++;

        // Create iframe that loads index.html (workarea)
        const iframe = document.createElement('iframe');
        iframe.src = 'index.html';
        iframe.className = 'tab-iframe';
        iframe.dataset.tabId = id;
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
        document.getElementById('tab-container').appendChild(iframe);

        // Create tab button
        const tabBtn = this._createTabButton(id, 'New Project');
        document.getElementById('tab-list').appendChild(tabBtn);

        this.tabs.set(id, { iframe, tabBtn, title: 'New Project', projectId: null, filePath: null });

        // If file path provided, send it to the iframe once loaded
        if (filePath) {
            iframe.addEventListener('load', () => {
                // Wait a bit for the app to initialize
                setTimeout(() => {
                    iframe.contentWindow.postMessage({
                        type: 'OPEN_FILE',
                        filePath: filePath
                    }, '*');
                }, 1500);
            }, { once: true });
        }

        this.switchTab(id);
        return id;
    }

    /**
     * Create a tab button element
     * @private
     */
    _createTabButton(id, title) {
        const btn = document.createElement('div');
        btn.className = 'tab-btn';
        btn.dataset.tabId = id;
        btn.draggable = true;

        btn.innerHTML = `
            <span class="tab-title">${this._escapeHtml(title)}</span>
            <button class="close-btn" title="Close">×</button>
        `;

        // Click on title to switch tab
        btn.querySelector('.tab-title').addEventListener('click', () => this.switchTab(id));

        // Close button
        btn.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(id);
        });

        // Drag and drop for tab reordering
        btn.addEventListener('dragstart', (e) => {
            this.draggedTab = id;
            btn.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
            this.draggedTab = null;
        });

        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.draggedTab === null || this.draggedTab === id) return;

            const tabList = document.getElementById('tab-list');
            const draggingBtn = this.tabs.get(this.draggedTab)?.tabBtn;
            if (!draggingBtn) return;

            const rect = btn.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;

            if (e.clientX < midpoint) {
                tabList.insertBefore(draggingBtn, btn);
            } else {
                tabList.insertBefore(draggingBtn, btn.nextSibling);
            }
        });

        // Double-click to rename (future feature)
        btn.addEventListener('dblclick', () => {
            // Could implement tab renaming here
        });

        return btn;
    }

    /**
     * Switch to a tab
     * @param {number} id - Tab ID
     */
    switchTab(id) {
        this.tabs.forEach((tab, tabId) => {
            const isActive = tabId === id;
            tab.iframe.classList.toggle('active', isActive);
            tab.tabBtn.classList.toggle('active', isActive);
        });
        this.activeTabId = id;
    }

    /**
     * Close a tab
     * @param {number} id - Tab ID
     */
    closeTab(id) {
        const tab = this.tabs.get(id);
        if (!tab) return;

        // Ask the iframe if it has unsaved changes
        // For now, just close (Yjs auto-saves to IndexedDB)

        tab.iframe.remove();
        tab.tabBtn.remove();
        this.tabs.delete(id);

        if (this.tabs.size === 0) {
            // Create empty tab if last one is closed
            this.createTab();
        } else if (this.activeTabId === id) {
            // Activate another tab
            const nextId = this.tabs.keys().next().value;
            this.switchTab(nextId);
        }
    }

    /**
     * Update tab title
     * @param {number} tabId - Tab ID
     * @param {string} title - New title
     */
    updateTitle(tabId, title) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.title = title;
            tab.tabBtn.querySelector('.tab-title').textContent = title;
        }
    }

    /**
     * Get the active iframe
     * @returns {HTMLIFrameElement|null}
     */
    getActiveIframe() {
        const tab = this.tabs.get(this.activeTabId);
        return tab?.iframe || null;
    }

    /**
     * Open a file in a new tab
     * @param {string} filePath - Path to the file
     */
    openFileInNewTab(filePath) {
        // Check if file is already open in another tab
        for (const [id, tab] of this.tabs) {
            if (tab.filePath === filePath) {
                // File already open, switch to that tab
                this.switchTab(id);
                return;
            }
        }

        this.createTab(filePath);
    }

    /**
     * Find tab by iframe contentWindow
     * @param {Window} contentWindow
     * @returns {number|null} Tab ID or null
     */
    findTabByWindow(contentWindow) {
        for (const [id, tab] of this.tabs) {
            if (tab.iframe.contentWindow === contentWindow) {
                return id;
            }
        }
        return null;
    }

    /**
     * Create a preview tab
     * @param {string} url - URL to load in the preview (e.g., /viewer/index.html)
     * @param {number} sourceTabId - The tab that requested the preview
     * @returns {number} The new tab ID
     */
    createPreviewTab(url, sourceTabId) {
        const id = this.nextId++;
        const sourceTab = this.tabs.get(sourceTabId);
        const sourceTitle = sourceTab?.title || 'Preview';

        // Create iframe that loads the preview URL
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.className = 'tab-iframe';
        iframe.dataset.tabId = id;
        iframe.dataset.isPreview = 'true';
        iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
        document.getElementById('tab-container').appendChild(iframe);

        // Create tab button with preview indicator
        const tabBtn = this._createTabButton(id, `📄 ${sourceTitle}`);
        tabBtn.classList.add('preview-tab');
        document.getElementById('tab-list').appendChild(tabBtn);

        this.tabs.set(id, {
            iframe,
            tabBtn,
            title: `📄 ${sourceTitle}`,
            projectId: null,
            filePath: null,
            isPreview: true,
            sourceTabId: sourceTabId
        });

        this.switchTab(id);
        return id;
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     */
    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize tab manager
const tabManager = new TabManager();

// Create initial empty tab
tabManager.createTab();

// New tab button click
document.getElementById('new-tab-btn').addEventListener('click', () => {
    tabManager.createTab();
});

// Listen for files opened from the main process
if (window.electronAPI?.onOpenFile) {
    window.electronAPI.onOpenFile((filePath) => {
        console.log('[TabManager] Received file to open:', filePath);
        tabManager.openFileInNewTab(filePath);
    });
}

// Listen for messages from iframes
window.addEventListener('message', (e) => {
    // Only accept messages from our iframes
    if (!e.source) return;

    const tabId = tabManager.findTabByWindow(e.source);
    if (tabId === null) return;

    if (e.data?.type === 'TAB_TITLE_UPDATE') {
        tabManager.updateTitle(tabId, e.data.title || 'Untitled');
    } else if (e.data?.type === 'TAB_FILE_PATH') {
        // Store the file path for duplicate detection
        const tab = tabManager.tabs.get(tabId);
        if (tab) {
            tab.filePath = e.data.filePath;
        }
    } else if (e.data?.type === 'OPEN_PREVIEW_TAB') {
        // Open preview in a new tab instead of new window
        // This shares the same Service Worker context, so the preview content will be available
        const url = e.data.url;
        if (url) {
            console.log('[TabManager] Opening preview in new tab:', url);
            tabManager.createPreviewTab(url, tabId);
        }
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + T: New tab
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        tabManager.createTab();
    }

    // Ctrl/Cmd + W: Close current tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (tabManager.activeTabId !== null) {
            tabManager.closeTab(tabManager.activeTabId);
        }
    }

    // Ctrl/Cmd + Tab: Next tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        const tabIds = Array.from(tabManager.tabs.keys());
        const currentIndex = tabIds.indexOf(tabManager.activeTabId);
        const nextIndex = e.shiftKey
            ? (currentIndex - 1 + tabIds.length) % tabIds.length
            : (currentIndex + 1) % tabIds.length;
        tabManager.switchTab(tabIds[nextIndex]);
    }

    // Ctrl/Cmd + 1-9: Switch to tab by number
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabIds = Array.from(tabManager.tabs.keys());
        const index = parseInt(e.key, 10) - 1;
        if (index < tabIds.length) {
            tabManager.switchTab(tabIds[index]);
        }
    }
});

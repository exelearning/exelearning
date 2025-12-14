/**
 * PreviewPanelManager
 * Manages the preview panel (slide-out and pinned modes)
 * with auto-refresh capability when content changes.
 */

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class PreviewPanelManager {
    constructor() {
        // DOM Elements - Slide-out panel
        this.panel = document.getElementById('previewsidenav');
        this.overlay = document.getElementById('preview-sidenav-overlay');
        this.closeButton = document.getElementById('previewsidenavclose');
        this.pinButton = document.getElementById('preview-pin-button');
        this.refreshButton = document.getElementById('preview-refresh-button');
        this.iframe = document.getElementById('preview-iframe');

        // DOM Elements - Pinned mode
        this.pinnedContainer = document.getElementById('preview-pinned-container');
        this.pinnedIframe = document.getElementById('preview-pinned-iframe');
        this.unpinButton = document.getElementById('preview-unpin-button');
        this.pinnedRefreshButton = document.getElementById('preview-pinned-refresh-button');

        // State
        this.isOpen = false;
        this.isPinned = false;
        this.isLoading = false;
        this.autoRefreshEnabled = true;
        this.refreshDebounceTimer = null;
        this.refreshDebounceDelay = 500; // 500ms debounce for responsive updates

        // Store unsubscribe function for Yjs observers
        this._unsubscribeStructure = null;
        this._onYdocUpdate = null;
    }

    /**
     * Initialize the preview panel
     */
    init() {
        this.bindEvents();
        this.subscribeToChanges();
        this.restorePinnedState();
        Logger.log('[PreviewPanel] Initialized');
    }

    /**
     * Bind DOM events
     */
    bindEvents() {
        // Slide-out panel events
        this.closeButton?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', () => this.close());
        this.pinButton?.addEventListener('click', () => this.pin());
        this.refreshButton?.addEventListener('click', () => this.refresh());

        // Keyboard on close button
        this.closeButton?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.close();
            }
        });

        // Pinned mode events
        this.unpinButton?.addEventListener('click', () => this.unpin());
        this.pinnedRefreshButton?.addEventListener('click', () => this.refresh());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close panel (not pinned)
            if (e.key === 'Escape' && this.isOpen && !this.isPinned) {
                this.close();
            }
            // Ctrl+Shift+P to toggle preview
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Subscribe to Yjs changes for auto-refresh
     * Uses both structure changes and ydoc.on('update') to capture ALL changes
     * including text edits in iDevices, titles, and collaborative updates
     */
    subscribeToChanges() {
        const project = eXeLearning?.app?.project;
        if (!project?._yjsEnabled || !project._yjsBridge) {
            Logger.log('[PreviewPanel] Yjs not enabled, auto-refresh disabled');
            return;
        }

        const bridge = project._yjsBridge;
        const documentManager = bridge.documentManager;

        // 1. Subscribe to structure changes (pages, blocks, components add/remove)
        this._unsubscribeStructure = bridge.onStructureChange(() => {
            if (this.isOpen || this.isPinned) {
                this.scheduleRefresh();
            }
        });

        // 2. Subscribe to ALL document changes (captures text edits, title changes, etc.)
        // This is essential for detecting content changes within iDevices
        if (documentManager?.ydoc) {
            this._onYdocUpdate = (update, origin) => {
                // Only refresh if panel is visible
                if (!this.isOpen && !this.isPinned) return;

                // Skip system-originated updates (initial sync, etc.)
                if (origin === 'system' || origin === 'initial') return;

                this.scheduleRefresh();
            };
            documentManager.ydoc.on('update', this._onYdocUpdate);
            Logger.log('[PreviewPanel] Subscribed to Yjs document updates');
        }

        Logger.log('[PreviewPanel] Subscribed to Yjs changes (structure + content)');
    }

    /**
     * Schedule a debounced refresh
     */
    scheduleRefresh() {
        if (!this.autoRefreshEnabled) return;

        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
        }

        this.refreshDebounceTimer = setTimeout(() => {
            this.refresh();
        }, this.refreshDebounceDelay);
    }

    /**
     * Toggle the preview panel (open/close)
     */
    async toggle() {
        if (this.isPinned) {
            // If pinned, unpin first
            this.unpin();
        } else if (this.isOpen) {
            this.close();
        } else {
            await this.open();
        }
    }

    /**
     * Open the preview panel
     */
    async open() {
        if (this.isPinned) return; // Already showing in pinned mode

        // Check for open idevice first
        if (eXeLearning?.app?.project?.checkOpenIdevice()) {
            return;
        }

        this.isOpen = true;
        this.panel?.classList.add('active');
        this.overlay?.classList.add('active');

        // Generate and load preview
        await this.refresh();

        Logger.log('[PreviewPanel] Panel opened');
    }

    /**
     * Close the preview panel
     */
    close() {
        if (this.isPinned) return; // Can't close when pinned

        this.isOpen = false;
        this.panel?.classList.remove('active');
        this.overlay?.classList.remove('active');

        Logger.log('[PreviewPanel] Panel closed');
    }

    /**
     * Pin the preview to the layout (3-panel mode)
     */
    async pin() {
        if (this.isPinned) return;

        // Close slide-out panel first
        this.panel?.classList.remove('active');
        this.overlay?.classList.remove('active');

        // Enable pinned mode
        this.isPinned = true;
        this.isOpen = true;

        const workarea = document.getElementById('workarea');
        workarea?.setAttribute('data-preview-pinned', 'true');

        // Refresh content in pinned iframe
        await this.refresh();

        // Store preference
        this.savePinnedPreference(true);

        Logger.log('[PreviewPanel] Preview pinned to layout');
    }

    /**
     * Unpin the preview (back to slide-out mode)
     */
    unpin() {
        if (!this.isPinned) return;

        this.isPinned = false;

        const workarea = document.getElementById('workarea');
        workarea?.setAttribute('data-preview-pinned', 'false');

        // Open slide-out panel with current content
        this.isOpen = true;
        this.panel?.classList.add('active');
        this.overlay?.classList.add('active');

        // Refresh content
        this.refresh();

        // Store preference
        this.savePinnedPreference(false);

        Logger.log('[PreviewPanel] Preview unpinned');
    }

    /**
     * Refresh the preview content
     */
    async refresh() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoadingState();

        try {
            const html = await this.generatePreviewHtml();
            if (html) {
                this.injectHtmlToIframe(html);
            }
        } catch (error) {
            Logger.error('[PreviewPanel] Error generating preview:', error);
            this.showError(error.message);
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    /**
     * Generate preview HTML using SharedExporters
     * @returns {Promise<string|null>} HTML string or null on error
     */
    async generatePreviewHtml() {
        const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            Logger.warn('[PreviewPanel] Yjs document manager not available');
            return null;
        }

        const SharedExporters = window.SharedExporters;
        if (!SharedExporters?.generatePreview) {
            Logger.error('[PreviewPanel] SharedExporters not loaded');
            return null;
        }

        const documentManager = yjsBridge.documentManager;

        // Get resource fetcher if available
        let resourceFetcher = null;
        if (typeof window.ResourceFetcher !== 'undefined') {
            resourceFetcher = new window.ResourceFetcher();
        }

        // Build preview options
        const previewOptions = {
            baseUrl: window.location.origin,
            basePath: eXeLearning.app.config?.basePath || '',
            version: eXeLearning.app.config?.version || 'v1',
        };

        // Generate preview
        const result = await SharedExporters.generatePreview(
            documentManager,
            resourceFetcher,
            previewOptions
        );

        if (!result.success || !result.html) {
            throw new Error(result.error || 'Failed to generate preview');
        }

        // Resolve asset URLs to blob URLs
        let html = result.html;
        if (typeof window.resolveAssetUrlsAsync === 'function') {
            try {
                html = await window.resolveAssetUrlsAsync(html);
            } catch (error) {
                Logger.warn('[PreviewPanel] Failed to resolve asset URLs:', error);
            }
        }

        return html;
    }

    /**
     * Inject HTML content into the active iframe
     * @param {string} html - HTML content to inject
     */
    injectHtmlToIframe(html) {
        const targetIframe = this.isPinned ? this.pinnedIframe : this.iframe;

        if (!targetIframe) {
            Logger.error('[PreviewPanel] No iframe available');
            return;
        }

        // Create blob URL for the HTML content
        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        // Revoke previous blob URL if exists
        if (targetIframe._blobUrl) {
            URL.revokeObjectURL(targetIframe._blobUrl);
        }
        targetIframe._blobUrl = blobUrl;

        // Load the blob URL
        targetIframe.src = blobUrl;

        Logger.log('[PreviewPanel] Preview content injected');
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const container = this.isPinned
            ? this.pinnedContainer?.querySelector('.preview-pinned-body')
            : this.panel?.querySelector('.preview-panel-body');
        container?.classList.add('preview-loading');
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        const container = this.isPinned
            ? this.pinnedContainer?.querySelector('.preview-pinned-body')
            : this.panel?.querySelector('.preview-panel-body');
        container?.classList.remove('preview-loading');
    }

    /**
     * Show error message in preview
     * @param {string} message - Error message
     */
    showError(message) {
        const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Inter, system-ui, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        background: #fafafa;
                        color: #666;
                    }
                    .error {
                        text-align: center;
                        padding: 40px;
                    }
                    h2 { color: #dc3545; margin-bottom: 16px; }
                    p { margin: 0; }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Preview Error</h2>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            </body>
            </html>
        `;
        this.injectHtmlToIframe(errorHtml);
    }

    /**
     * Save pinned preference to localStorage
     * @param {boolean} isPinned - Pinned state
     */
    savePinnedPreference(isPinned) {
        try {
            localStorage.setItem('exe-preview-pinned', isPinned ? 'true' : 'false');
        } catch (e) {
            // localStorage not available
        }
    }

    /**
     * Load pinned preference from localStorage
     * @returns {boolean} Stored pinned state
     */
    loadPinnedPreference() {
        try {
            return localStorage.getItem('exe-preview-pinned') === 'true';
        } catch (e) {
            return false;
        }
    }

    /**
     * Restore pinned state on load (if preference was saved)
     */
    async restorePinnedState() {
        if (this.loadPinnedPreference()) {
            // Wait for project to be ready
            const waitForProject = () => {
                return new Promise((resolve) => {
                    const check = () => {
                        if (eXeLearning?.app?.project?._yjsBridge?.documentManager) {
                            resolve();
                        } else {
                            setTimeout(check, 500);
                        }
                    };
                    check();
                });
            };

            await waitForProject();
            await this.pin();
        }
    }

    /**
     * Toggle auto-refresh
     * @param {boolean} enabled - Enable/disable auto-refresh
     */
    setAutoRefresh(enabled) {
        this.autoRefreshEnabled = enabled;
        Logger.log('[PreviewPanel] Auto-refresh:', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Unsubscribe from structure changes
        if (this._unsubscribeStructure) {
            this._unsubscribeStructure();
            this._unsubscribeStructure = null;
        }

        // Unsubscribe from ydoc updates
        if (this._onYdocUpdate) {
            const documentManager = eXeLearning?.app?.project?._yjsBridge?.documentManager;
            if (documentManager?.ydoc) {
                documentManager.ydoc.off('update', this._onYdocUpdate);
            }
            this._onYdocUpdate = null;
        }

        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }

        // Revoke blob URLs
        [this.iframe, this.pinnedIframe].forEach((iframe) => {
            if (iframe?._blobUrl) {
                URL.revokeObjectURL(iframe._blobUrl);
            }
        });

        Logger.log('[PreviewPanel] Destroyed');
    }
}

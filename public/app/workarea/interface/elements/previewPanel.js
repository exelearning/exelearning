/**
 * PreviewPanelManager
 * Manages the preview panel (slide-out and pinned modes)
 * with auto-refresh capability when content changes.
 */

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class PreviewPanelManager {
    /** Timeout for Service Worker status check (ms) */
    static SW_STATUS_TIMEOUT = 2000;

    constructor() {
        // DOM Elements - Slide-out panel
        this.panel = document.getElementById('previewsidenav');
        this.overlay = document.getElementById('preview-sidenav-overlay');
        this.closeButton = document.getElementById('previewsidenavclose');
        this.extractButton = document.getElementById('preview-extract-button');
        this.pinButton = document.getElementById('preview-pin-button');
        this.refreshButton = document.getElementById('preview-refresh-button');
        this.iframe = document.getElementById('preview-iframe');

        // DOM Elements - Pinned mode
        this.pinnedContainer = document.getElementById('preview-pinned-container');
        this.pinnedIframe = document.getElementById('preview-pinned-iframe');
        this.pinnedExtractButton = document.getElementById('preview-pinned-extract-button');
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
        this._setupVisibilityHandler();
        Logger.log('[PreviewPanel] Initialized');
    }

    /**
     * Setup visibility change handler for tab switch recovery
     * When the tab becomes visible after being hidden, the Service Worker
     * may have lost its in-memory content (SW can be terminated by browser).
     * This handler detects visibility changes and recovers the preview.
     */
    _setupVisibilityHandler() {
        if (typeof document === 'undefined') return;

        this._visibilityChangeHandler = async () => {
            if (document.visibilityState === 'visible') {
                Logger.log('[PreviewPanel] Tab became visible, checking preview state...');
                await this._checkAndRecoverPreview();
            }
        };

        document.addEventListener('visibilitychange', this._visibilityChangeHandler);
        Logger.log('[PreviewPanel] Visibility handler installed');
    }

    /**
     * Check if preview is currently visible (open or pinned)
     * @returns {boolean}
     */
    _isPreviewVisible() {
        return this.isOpen || this.isPinned;
    }

    /**
     * Check if preview needs recovery and recover it if needed
     * Called when tab becomes visible after being hidden
     */
    async _checkAndRecoverPreview() {
        if (!this._isPreviewVisible()) {
            Logger.log('[PreviewPanel] Preview not open, skipping recovery');
            return;
        }

        // Check if Service Worker has content
        const hasContent = await this._checkServiceWorkerContent();
        if (hasContent) {
            Logger.log('[PreviewPanel] Service Worker has content, no recovery needed');
            return;
        }

        Logger.log('[PreviewPanel] Service Worker lost content, recovering preview...');
        await this.refresh();
    }

    /**
     * Check if Service Worker has content loaded
     * @returns {Promise<boolean>} True if SW has content
     */
    async _checkServiceWorkerContent() {
        try {
            const sw = eXeLearning?.app?.getPreviewServiceWorker?.();
            if (!sw) {
                Logger.log('[PreviewPanel] No Service Worker available');
                return false;
            }
            return await this._querySWStatus(sw);
        } catch (error) {
            Logger.error('[PreviewPanel] Error checking SW content:', error);
            return false;
        }
    }

    /**
     * Query Service Worker for content status via MessageChannel
     * @param {ServiceWorker} sw - The Service Worker to query
     * @returns {Promise<boolean>} True if SW has content loaded
     */
    _querySWStatus(sw) {
        return new Promise((resolve) => {
            const channel = new MessageChannel();
            const timeout = setTimeout(() => {
                Logger.log('[PreviewPanel] SW status check timed out');
                resolve(false);
            }, PreviewPanelManager.SW_STATUS_TIMEOUT);

            channel.port1.onmessage = (event) => {
                clearTimeout(timeout);
                const { ready, fileCount } = event.data || {};
                Logger.log(`[PreviewPanel] SW status: ready=${ready}, fileCount=${fileCount}`);
                resolve(ready && fileCount > 0);
            };

            sw.postMessage({ type: 'GET_STATUS' }, [channel.port2]);
        });
    }

    /**
     * Bind DOM events
     */
    bindEvents() {
        // Slide-out panel events
        this.closeButton?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', () => this.close());
        this.extractButton?.addEventListener('click', () => this.extractToNewTab());
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
        this.pinnedExtractButton?.addEventListener('click', () => this.extractToNewTab());
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

        // Listen for postMessage from preview iframe and Service Worker
        // NOTE: Legacy PDF blob and HTML link handlers removed in Phase 4 cleanup
        // (Service Worker serves content via HTTP, eliminating blob:// context issues)
        window.addEventListener('message', async (event) => {
            // Handle ELPX download requests from preview iframe (download-source-file iDevice)
            if (event.data?.type === 'exe-download-elpx') {
                Logger.log('[PreviewPanel] Received exe-download-elpx request');
                try {
                    const project = eXeLearning?.app?.project;
                    if (project?.exportToElpxViaYjs) {
                        await project.exportToElpxViaYjs({ saveAs: true });
                    } else {
                        Logger.error('[PreviewPanel] exportToElpxViaYjs not available');
                        alert(_('ELPX export not available. Please save your project first.'));
                    }
                } catch (err) {
                    Logger.error('[PreviewPanel] ELPX export failed:', err);
                    alert(_('Error generating ELPX file:') + ' ' + err.message);
                }
                return;
            }

            // Handle CONTENT_NEEDED requests from Service Worker
            // This happens when the SW terminates and restarts without content
            if (event.data?.type === 'CONTENT_NEEDED') {
                Logger.log('[PreviewPanel] Service Worker requested content refresh:', event.data.reason);
                if (this._isPreviewVisible()) {
                    // Debounce to avoid multiple refreshes from multiple requests
                    if (this._contentNeededRefreshTimer) {
                        clearTimeout(this._contentNeededRefreshTimer);
                    }
                    this._contentNeededRefreshTimer = setTimeout(() => {
                        this._contentNeededRefreshTimer = null;
                        this.refresh();
                    }, 100);
                }
                return;
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
            if (this._isPreviewVisible()) {
                this.scheduleRefresh();
            }
        });

        // 2. Subscribe to ALL document changes (captures text edits, title changes, etc.)
        // This is essential for detecting content changes within iDevices
        if (documentManager?.ydoc) {
            this._onYdocUpdate = (update, origin) => {
                // Only refresh if panel is visible
                if (!this._isPreviewVisible()) return;

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
     * Check if Service Worker-based preview is available
     * @returns {boolean} True if SW preview is available
     */
    isServiceWorkerPreviewAvailable() {
        const app = eXeLearning?.app;
        // Use app.getPreviewServiceWorker() which handles BASE_PATH correctly
        // by falling back to registration.active when controller is null
        const hasSW = typeof app?.getPreviewServiceWorker === 'function' && app.getPreviewServiceWorker() !== null;
        return (
            'serviceWorker' in navigator &&
            hasSW &&
            typeof app?.sendContentToPreviewSW === 'function' &&
            typeof window.SharedExporters?.generatePreviewForSW === 'function'
        );
    }

    /**
     * Refresh the preview content
     * Uses Service Worker approach for unified export/preview rendering
     */
    async refresh() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoadingState();

        try {
            // Wait for SW to be ready if not immediately available
            const app = eXeLearning?.app;
            if (!navigator.serviceWorker?.controller && typeof app?.waitForPreviewServiceWorker === 'function') {
                Logger.log('[PreviewPanel] Waiting for Service Worker to be ready...');
                await app.waitForPreviewServiceWorker();
            }

            // Check if SW-based preview is available
            if (!this.isServiceWorkerPreviewAvailable()) {
                throw new Error('Preview Service Worker not available. Please reload the page.');
            }
            await this.refreshWithServiceWorker();
        } catch (error) {
            Logger.error('[PreviewPanel] Error generating preview:', error);
            this.showError(error.message);
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    /**
     * Refresh preview using Service Worker approach
     * Generates HTML export files and sends them to the SW for serving
     */
    async refreshWithServiceWorker() {
        const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            throw new Error('Yjs document manager not available');
        }

        const SharedExporters = window.SharedExporters;
        if (!SharedExporters?.generatePreviewForSW) {
            throw new Error('SharedExporters.generatePreviewForSW not available');
        }

        const documentManager = yjsBridge.documentManager;
        const resourceFetcher = yjsBridge.resourceFetcher || null;
        const assetManager = yjsBridge.assetManager || null;

        // Get theme for export
        const selectedTheme = eXeLearning.app?.themes?.selected;
        const theme = selectedTheme?.id || selectedTheme?.name || 'base';

        // Generate preview files using Html5Exporter
        Logger.log('[PreviewPanel] Generating preview files for SW...');
        const result = await SharedExporters.generatePreviewForSW(
            documentManager,
            null, // assetCache (legacy)
            resourceFetcher,
            assetManager,
            { theme }
        );

        if (!result.success || !result.files) {
            throw new Error(result.error || 'Failed to generate preview files');
        }

        Logger.log(
            `[PreviewPanel] Generated ${Object.keys(result.files).length} files, sending to SW...`
        );

        // Send files to Service Worker
        const app = eXeLearning.app;
        await app.sendContentToPreviewSW(result.files, {
            openExternalLinksInNewWindow: true,
        });

        // Load preview from Service Worker
        this.loadPreviewFromServiceWorker();

        Logger.log('[PreviewPanel] Preview loaded via Service Worker');
    }

    /**
     * Load preview content from Service Worker
     * Sets iframe src to /viewer/index.html which is served by the SW
     */
    loadPreviewFromServiceWorker() {
        const targetIframe = this.isPinned ? this.pinnedIframe : this.iframe;

        if (!targetIframe) {
            Logger.error('[PreviewPanel] No iframe available');
            return;
        }

        // Revoke previous blob URL if exists (from legacy approach)
        if (targetIframe._blobUrl) {
            URL.revokeObjectURL(targetIframe._blobUrl);
            targetIframe._blobUrl = null;
        }

        // Get base path for the viewer URL
        const basePath = eXeLearning.app?.getBasePath?.() || '';
        const viewerUrl = `${basePath}/viewer/index.html`;

        // Force reload by clearing src first if it's the same URL
        if (targetIframe.src.endsWith('/viewer/index.html')) {
            targetIframe.src = 'about:blank';
            // Use setTimeout to ensure the blank page loads first
            setTimeout(() => {
                targetIframe.src = viewerUrl;
            }, 50);
        } else {
            targetIframe.src = viewerUrl;
        }

        targetIframe.removeAttribute('srcdoc');
        Logger.log('[PreviewPanel] Preview iframe src set to:', viewerUrl);
    }

    /**
     * Extract preview to a new browser tab
     * Opens the SW-served preview in a new tab
     */
    async extractToNewTab() {
        try {
            Logger.log('[PreviewPanel] Extracting preview to new tab...');

            // Ensure SW has the latest content
            if (!this.isServiceWorkerPreviewAvailable()) {
                Logger.error('[PreviewPanel] Service Worker not available for preview');
                return;
            }

            // Refresh SW content before opening new tab
            await this.refreshWithServiceWorker();

            // Build the viewer URL - derive base path from current URL for subdirectory deployments
            const pathname = window.location.pathname;
            // Remove trailing 'workarea', 'workarea.html', or 'workarea/' to get base directory
            // Also remove any trailing slash to avoid double slashes
            const basePath = pathname.replace(/\/workarea(\.html)?\/?$/, '').replace(/\/$/, '');
            const viewerUrl = `${window.location.origin}${basePath}/viewer/index.html`;

            // Open in new tab
            const newTab = window.open(viewerUrl, '_blank');

            if (newTab) {
                Logger.log('[PreviewPanel] Preview opened in new tab');
            } else {
                Logger.warn('[PreviewPanel] Popup blocked - trying fallback');
                // Fallback: create a link and click it
                const a = document.createElement('a');
                a.href = viewerUrl;
                a.target = '_blank';
                a.click();
            }
        } catch (error) {
            Logger.error('[PreviewPanel] Error extracting to new tab:', error);
        }
    }

    // NOTE: The following legacy methods have been removed as part of Phase 4 cleanup:
    // - generateStandalonePreviewHtml(): Replaced by SW-based extractToNewTab()
    // - resolveHtmlIframeAssetsForStandalone(): No longer needed with SW approach
    // - injectPdfBlobUrlConverter(): PDF.js workaround for blob:// context - no longer needed with SW
    // - injectHtmlLinkHandler(): HTML link forwarding - no longer needed with SW
    // The Service Worker-based preview serves content via HTTP, eliminating blob:// context issues.

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

        // Revoke previous blob URL if exists
        if (targetIframe._blobUrl) {
            URL.revokeObjectURL(targetIframe._blobUrl);
            targetIframe._blobUrl = null;
        }

        // Use blob URL for preview - this gives proper origin (http://localhost:...)
        // which allows popups to use window.opener to access parent window data
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        targetIframe._blobUrl = blobUrl;
        targetIframe.removeAttribute('srcdoc');
        targetIframe.src = blobUrl;

        Logger.log('[PreviewPanel] Preview content injected via blob URL');
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

    // NOTE: The following legacy methods have been removed as part of Phase 4 cleanup:
    // - processUserThemeCssUrls(): CSS url() to data URL conversion - no longer needed
    //   since the Service Worker serves theme files directly via HTTP.
    // - blobToDataUrl(): Helper for processUserThemeCssUrls - also removed.

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

        // Remove visibility change handler
        if (this._visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', this._visibilityChangeHandler);
            this._visibilityChangeHandler = null;
        }

        if (this.refreshDebounceTimer) {
            clearTimeout(this.refreshDebounceTimer);
            this.refreshDebounceTimer = null;
        }

        // Clear content needed refresh timer
        if (this._contentNeededRefreshTimer) {
            clearTimeout(this._contentNeededRefreshTimer);
            this._contentNeededRefreshTimer = null;
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

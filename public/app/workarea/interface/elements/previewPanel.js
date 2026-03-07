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

        // Blob URL navigation state
        this._blobUrlFiles = null;
        this._blobUrlCurrentPage = null;

        // Popup window tracking
        this._popupWindow = null;
        this._popupMonitorTimer = null;
        this._recoveryChannel = null;
    }

    /**
     * Initialize the preview panel
     */
    init() {
        this.bindEvents();
        this.subscribeToChanges();
        this.resetToDefaultState();
        this._setupVisibilityHandler();
        this._setupBroadcastChannelListener();
        this._setupServiceWorkerListener();
        Logger.log('[PreviewPanel] Initialized');
    }

    /**
     * Reset preview state to default (closed + unpinned)
     * This is used on app startup and project open.
     */
    resetToDefaultState() {
        this.isPinned = false;
        this.isOpen = false;
        this.panel?.classList.remove('active');
        this.overlay?.classList.remove('active');

        // Clean up popup tracking
        this._popupWindow = null;
        this._clearPopupMonitor();

        const workarea = document.getElementById('workarea');
        workarea?.setAttribute('data-preview-pinned', 'false');
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
     * Setup BroadcastChannel listener for popup recovery.
     * The popup's PREVIEW_REFRESH_SCRIPT relays CONTENT_NEEDED from the SW
     * as PREVIEW_CONTENT_LOST via BroadcastChannel. This listener picks it up
     * and triggers a content refresh so the popup can recover.
     */
    _setupBroadcastChannelListener() {
        if (typeof BroadcastChannel === 'undefined') return;

        this._recoveryChannel = new BroadcastChannel('exe-preview-recovery');
        this._recoveryChannel.onmessage = (event) => {
            if (event.data?.type === 'PREVIEW_CONTENT_LOST') {
                Logger.log('[PreviewPanel] Popup reported content lost, refreshing SW content...');
                this.refreshWithServiceWorker().catch((err) => {
                    Logger.error('[PreviewPanel] Failed to recover popup content:', err);
                });
            }
        };
        Logger.log('[PreviewPanel] BroadcastChannel listener installed');
    }

    /**
     * Listen for CONTENT_NEEDED messages directly from the Service Worker.
     * SW client.postMessage() arrives on navigator.serviceWorker, NOT window.
     * This ensures the main window can respond to SW recovery requests
     * even when no preview iframe or popup has the relay script loaded.
     */
    _setupServiceWorkerListener() {
        if (typeof navigator === 'undefined' || !navigator.serviceWorker?.addEventListener) return;

        this._swMessageHandler = (event) => {
            if (event.data?.type === 'CONTENT_NEEDED' && this._isPreviewVisible()) {
                Logger.log('[PreviewPanel] SW requested content refresh (direct):', event.data.reason);
                // Debounce to avoid multiple refreshes
                if (this._swContentNeededTimer) {
                    clearTimeout(this._swContentNeededTimer);
                }
                this._swContentNeededTimer = setTimeout(() => {
                    this._swContentNeededTimer = null;
                    this.refreshWithServiceWorker().catch((err) => {
                        Logger.error('[PreviewPanel] Failed to resend content to SW:', err);
                    });
                }, 100);
            }
        };

        navigator.serviceWorker.addEventListener('message', this._swMessageHandler);
        Logger.log('[PreviewPanel] Service Worker message listener installed');
    }

    /**
     * Start polling to detect when popup window closes.
     * When closed, clean up the reference and stop polling.
     */
    _setupPopupMonitor() {
        this._clearPopupMonitor();
        this._popupMonitorTimer = setInterval(() => {
            if (!this._isPopupOpen()) {
                Logger.log('[PreviewPanel] Popup window closed');
                this._popupWindow = null;
                this._clearPopupMonitor();
            }
        }, 2000);
    }

    /**
     * Clear popup monitor interval
     */
    _clearPopupMonitor() {
        if (this._popupMonitorTimer) {
            clearInterval(this._popupMonitorTimer);
            this._popupMonitorTimer = null;
        }
    }

    /**
     * Check if preview is currently visible (open, pinned, or popup open)
     * @returns {boolean}
     */
    _isPreviewVisible() {
        return this.isOpen || this.isPinned || this._isPopupOpen();
    }

    /**
     * Check if a popup preview window is currently open
     * @returns {boolean}
     */
    _isPopupOpen() {
        return this._popupWindow != null && !this._popupWindow.closed;
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
            const fromPreviewIframe = this._isPreviewIframeSource(event.source);

            // Handle ELPX download requests from preview iframe (download-source-file iDevice)
            if (event.data?.type === 'exe-download-elpx' && fromPreviewIframe) {
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



            // Handle blob URL document open requests from preview iframe
            if (event.data?.type === 'exe-blob-open-document' && fromPreviewIframe && this._blobUrlFiles) {
                const href = event.data.href;
                const currentDir = event.data.currentPage?.includes('/')
                    ? event.data.currentPage.substring(0, event.data.currentPage.lastIndexOf('/') + 1)
                    : '';
                let targetPath = currentDir ? this._resolveRelativePath(currentDir + href) : href;
                Logger.log(`[PreviewPanel] Blob URL document open: ${href} → ${targetPath}`);

                const fileContent = this._findFileContent(this._blobUrlFiles, targetPath);
                if (fileContent) {
                    const bytes = fileContent instanceof ArrayBuffer
                        ? new Uint8Array(fileContent)
                        : fileContent instanceof Uint8Array
                            ? fileContent
                            : new TextEncoder().encode(fileContent);
                    const ext = targetPath.split('.').pop()?.toLowerCase() || '';
                    const mimeMap = {
                        pdf: 'application/pdf', doc: 'application/msword',
                        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        xls: 'application/vnd.ms-excel',
                        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        ppt: 'application/vnd.ms-powerpoint',
                        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                        odt: 'application/vnd.oasis.opendocument.text',
                        ods: 'application/vnd.oasis.opendocument.spreadsheet',
                        odp: 'application/vnd.oasis.opendocument.presentation',
                        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                        gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
                        avif: 'image/avif', ico: 'image/x-icon',
                        mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm',
                        ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
                        zip: 'application/zip', rar: 'application/x-rar-compressed',
                    };
                    const mime = mimeMap[ext] || 'application/octet-stream';
                    const blob = new Blob([bytes], { type: mime });
                    if (ext === 'pdf') {
                        // PDF: render with PDF.js in a new tab.
                        // Chrome blocks PDFium for ALL SW-served and blob: PDF content.
                        // PDF.js parses the PDF and renders each page to <canvas>, bypassing restrictions.
                        const pdfBlobUrl = URL.createObjectURL(blob);
                        const rawName = targetPath.split('/').pop() || 'document.pdf';
                        const fileName = rawName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        const dlName = rawName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                        const bp = (window.eXeLearning?.app?.getBasePath?.() || '') + '/';
                        const wrapperHtml = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
                            '<title>' + fileName + '</title>' +
                            '<style>' +
                            '*{margin:0;padding:0;box-sizing:border-box}' +
                            'body{background:#474747}' +
                            '#tb{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:4px;' +
                            'padding:4px 8px;background:#323232;color:#d1d1d1;font:13px/1.4 system-ui;' +
                            'box-shadow:0 1px 4px rgba(0,0,0,.5);user-select:none}' +
                            '#tb button{background:none;border:1px solid #555;color:#d1d1d1;' +
                            'padding:2px 8px;border-radius:3px;cursor:pointer;font:inherit;line-height:1.2}' +
                            '#tb button:hover{background:#444;border-color:#777}' +
                            '#tb .sp{width:1px;height:20px;background:#555;margin:0 2px}' +
                            '#pages{display:flex;flex-direction:column;align-items:center;padding:16px 0;gap:8px}' +
                            'canvas{display:block;box-shadow:0 2px 8px rgba(0,0,0,0.4)}' +
                            '#loading{color:#ccc;font-family:system-ui;text-align:center;padding:2rem;font-size:1.1rem}' +
                            '#error{color:#ff6b6b;font-family:system-ui;text-align:center;padding:2rem;display:none}' +
                            '</style></head><body>' +
                            '<div id="tb" style="display:none">' +
                            '<button id="prev" title="Previous">\u25C0</button>' +
                            '<span><span id="pn">1</span> / <span id="pc">-</span></span>' +
                            '<button id="next" title="Next">\u25B6</button>' +
                            '<span class="sp"></span>' +
                            '<button id="zo" title="Zoom out">\u2212</button>' +
                            '<span id="zl">100%</span>' +
                            '<button id="zi" title="Zoom in">+</button>' +
                            '<button id="fw" title="Fit width">\u2194</button>' +
                            '<span class="sp"></span>' +
                            '<button id="dl" title="Download">\u2913</button>' +
                            '</div>' +
                            '<div id="loading">Loading PDF\u2026</div>' +
                            '<div id="pages"></div>' +
                            '<div id="error"></div>' +
                            '<script type="module">' +
                            'try{' +
                            'var m=await import("' + bp + 'libs/pdfjs/pdf.min.mjs");' +
                            'm.GlobalWorkerOptions.workerSrc="' + bp + 'libs/pdfjs/pdf.worker.min.mjs";' +
                            'var pdf=await m.getDocument("' + pdfBlobUrl + '").promise;' +
                            'document.getElementById("loading").style.display="none";' +
                            'var tb=document.getElementById("tb");tb.style.display="flex";' +
                            'document.getElementById("pc").textContent=pdf.numPages;' +
                            'var fp=await pdf.getPage(1);var uv=fp.getViewport({scale:1});' +
                            'var isc=Math.min((window.innerWidth-32)/uv.width,2);var sc=isc;' +
                            'var pgs=document.getElementById("pages");var cs=[];' +
                            'async function render(s){sc=s;' +
                            'document.getElementById("zl").textContent=Math.round(s/isc*100)+"%";' +
                            'var scrollRatio=0;if(cs.length){' +
                            'var st=document.documentElement.scrollTop||document.body.scrollTop;' +
                            'var sh=document.documentElement.scrollHeight-window.innerHeight;' +
                            'if(sh>0)scrollRatio=st/sh;}' +
                            'pgs.innerHTML="";cs=[];' +
                            'for(var i=1;i<=pdf.numPages;i++){var pg=await pdf.getPage(i);' +
                            'var vp=pg.getViewport({scale:s});' +
                            'var c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;' +
                            'pgs.appendChild(c);cs.push(c);' +
                            'await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;}' +
                            'var newSh=document.documentElement.scrollHeight-window.innerHeight;' +
                            'if(newSh>0)window.scrollTo(0,scrollRatio*newSh);}' +
                            'await render(sc);' +
                            'window.addEventListener("scroll",function(){var th=tb.offsetHeight+10;' +
                            'for(var i=0;i<cs.length;i++){if(cs[i].getBoundingClientRect().bottom>th){' +
                            'document.getElementById("pn").textContent=i+1;break;}}});' +
                            'document.getElementById("prev").onclick=function(){' +
                            'var n=+document.getElementById("pn").textContent;' +
                            'if(n>1&&cs[n-2])cs[n-2].scrollIntoView({behavior:"smooth"})};' +
                            'document.getElementById("next").onclick=function(){' +
                            'var n=+document.getElementById("pn").textContent;' +
                            'if(n<pdf.numPages&&cs[n])cs[n].scrollIntoView({behavior:"smooth"})};' +
                            'document.getElementById("zi").onclick=function(){render(sc*1.25)};' +
                            'document.getElementById("zo").onclick=function(){render(sc/1.25)};' +
                            'document.getElementById("fw").onclick=function(){' +
                            'render(Math.min((window.innerWidth-32)/uv.width,2))};' +
                            'document.getElementById("dl").onclick=async function(){' +
                            'var d=await pdf.getData();var b=new Blob([d],{type:"application/pdf"});' +
                            'var u=URL.createObjectURL(b);var a=document.createElement("a");' +
                            'a.href=u;a.download="' + dlName + '";a.click();' +
                            'setTimeout(function(){URL.revokeObjectURL(u)},60000)};' +
                            '}catch(e){' +
                            'document.getElementById("loading").style.display="none";' +
                            'var el=document.getElementById("error");' +
                            'el.style.display="block";' +
                            'el.textContent="Error loading PDF: "+e.message;' +
                            '}' +
                            '</script></body></html>';
                        const wrapperBlob = new Blob([wrapperHtml], { type: 'text/html' });
                        const wrapperUrl = URL.createObjectURL(wrapperBlob);
                        window.open(wrapperUrl, '_blank');
                        setTimeout(() => {
                            URL.revokeObjectURL(wrapperUrl);
                            URL.revokeObjectURL(pdfBlobUrl);
                        }, 60000);
                    } else {
                        const blobUrl = URL.createObjectURL(blob);
                        window.open(blobUrl, '_blank');
                        // Clean up after a delay to allow the browser to open the URL
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                    }
                } else {
                    Logger.warn(`[PreviewPanel] Document not found in files: ${targetPath}`);
                }
                return;
            }

            // Handle blob URL navigation requests from preview iframe
            if (event.data?.type === 'exe-blob-navigate' && fromPreviewIframe && this._blobUrlFiles) {
                const href = event.data.href;
                const currentDir = event.data.currentPage?.includes('/')
                    ? event.data.currentPage.substring(0, event.data.currentPage.lastIndexOf('/') + 1)
                    : '';
                // Resolve relative path against current page directory
                let targetPage = currentDir ? this._resolveRelativePath(currentDir + href) : href;
                Logger.log(`[PreviewPanel] Blob URL navigation: ${href} → ${targetPage}`);
                this._loadBlobPage(targetPage);
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
                try { await app.waitForPreviewServiceWorker(); } catch { /* SW not available */ }
            }

            if (this.isServiceWorkerPreviewAvailable()) {
                await this.refreshWithServiceWorker();
            } else {
                // Fallback for cross-origin iframes where SW can't register
                Logger.log('[PreviewPanel] SW not available, using blob URL fallback');
                await this.refreshWithBlobUrl();
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
     * Refresh preview using Service Worker approach
     * Generates HTML export files and sends them to the SW for serving
     */
    async refreshWithServiceWorker() {
        Logger.log('[PreviewPanel] Generating preview files for SW...');
        const result = await this._generatePreviewFiles();

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
     * Refresh preview using blob URL approach (fallback when SW not available).
     * Generates preview HTML, inlines resources, creates a blob URL for the iframe.
     * Used in cross-origin iframe environments where Service Workers can't register.
     */
    async refreshWithBlobUrl() {
        const result = await this._generatePreviewFiles();

        if (!result.success || !result.files) {
            throw new Error(result.error || 'Failed to generate preview');
        }

        if (!result.files['index.html']) {
            throw new Error('No index.html in generated files');
        }

        // Store files for multi-page navigation
        this._blobUrlFiles = result.files;

        // Load the first page
        this._loadBlobPage('index.html');

        Logger.log('[PreviewPanel] Preview loaded via blob URL fallback');
    }

    /**
     * Generate preview export files used by both SW and blob URL modes.
     * @returns {Promise<{success: boolean, files?: Object, error?: string}>}
     * @private
     */
    async _generatePreviewFiles() {
        const yjsBridge = eXeLearning?.app?.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            throw new Error('Yjs document manager not available');
        }

        const SharedExporters = window.SharedExporters;
        if (!SharedExporters?.generatePreviewForSW) {
            throw new Error('SharedExporters.generatePreviewForSW not available');
        }

        const selectedTheme = eXeLearning.app?.themes?.selected;
        const theme = selectedTheme?.id || selectedTheme?.name || 'base';

        return SharedExporters.generatePreviewForSW(
            yjsBridge.documentManager,
            null, // assetCache (legacy)
            yjsBridge.resourceFetcher || null,
            yjsBridge.assetManager || null,
            { theme },
        );
    }

    /**
     * Load a specific page in blob URL mode.
     * Resolves the page from the stored files map, inlines resources,
     * injects navigation handler, and loads via blob URL.
     * @param {string} pagePath - Path to the page (e.g., 'index.html', 'html/page2.html')
     */
    _loadBlobPage(pagePath) {
        if (!this._blobUrlFiles) {
            Logger.error('[PreviewPanel] No files available for blob URL navigation');
            return;
        }

        let html = this._decodeFileContent(this._blobUrlFiles[pagePath]);
        if (!html) {
            Logger.error(`[PreviewPanel] Page not found in files: ${pagePath}`);
            return;
        }

        this._blobUrlCurrentPage = pagePath;
        html = this._inlineResources(html, this._blobUrlFiles);
        html = this._replacePdfEmbedsForBlob(html, this._blobUrlFiles);
        html = this._injectBlobNavigationHandler(html, pagePath);
        this._loadBlobUrlInIframe(html);

        Logger.log(`[PreviewPanel] Blob URL page loaded: ${pagePath}`);
    }

    /**
     * Inject a navigation handler script into HTML for blob URL mode.
     * External links open directly in a new tab. Document/media links and
     * internal page links send postMessage to parent for handling.
     * @param {string} html - The HTML content
     * @param {string} currentPage - Current page path for relative resolution
     * @returns {string} HTML with navigation handler injected
     */
    _injectBlobNavigationHandler(html, currentPage) {
        const script = `<script>
(function() {
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;
        var href = link.getAttribute('href');
        if (!href) return;

        // Allow anchors, mailto, javascript, blob, data
        if (/^(#|mailto:|javascript:|blob:|data:)/i.test(href)) return;

        // External links: open directly in new tab
        if (/^https?:\\/\\//i.test(href)) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer external');
            return;
        }

        // Non-HTML resources (PDF, documents, media, etc.): ask parent to open as blob
        // Skip images — they may be handled by lightbox/gallery scripts
        var extMatch = href.match(/\\.([a-z0-9]+)(?:\\?[^#]*)?(#.*)?$/i);
        if (extMatch && !/^html?$/i.test(extMatch[1]) && !/^(jpe?g|png|gif|svg|webp|avif|ico|bmp|tiff?)$/i.test(extMatch[1])) {
            e.preventDefault();
            window.parent.postMessage({
                type: 'exe-blob-open-document',
                href: href,
                currentPage: ${JSON.stringify(currentPage)}
            }, '*');
            return;
        }

        // Internal HTML page: navigate via parent
        e.preventDefault();
        window.parent.postMessage({
            type: 'exe-blob-navigate',
            href: href,
            currentPage: ${JSON.stringify(currentPage)}
        }, '*');
    }, true);
})();
</script>`;
        // PDF.js embed rendering for blob URL mode: renders [data-exe-pdf-src] placeholders
        const bp = (window.eXeLearning?.app?.getBasePath?.() || '') + '/';
        const pdfScript = `<script>
(function() {
    function initPdfEmbeds() {
        var embeds = document.querySelectorAll('[data-exe-pdf-src]');
        if (embeds.length === 0) return;
        import(${JSON.stringify(bp)}+'libs/pdfjs/pdf.min.mjs').then(function(m) {
            m.GlobalWorkerOptions.workerSrc = ${JSON.stringify(bp)}+'libs/pdfjs/pdf.worker.min.mjs';
            for (var i = 0; i < embeds.length; i++) renderPdfEmbed(m, embeds[i]);
        }).catch(function(err) {
            console.warn('[Preview] PDF.js load failed:', err);
        });
    }
    function renderPdfEmbed(pdfjsLib, el) {
        var src = el.getAttribute('data-exe-pdf-src');
        if (!src) return;
        var container = document.createElement('div');
        container.style.cssText = 'width:'+el.style.width+';height:'+el.style.height+';overflow:auto;background:#525659;position:relative';
        if (el.className) container.className = el.className;

        var tb = document.createElement('div');
        tb.className = 'exe-pdf-tb';
        tb.style.cssText = 'position:sticky;top:0;z-index:10;display:none;align-items:center;gap:4px;' +
            'padding:4px 8px;background:#323232;color:#d1d1d1;font:13px/1.4 system-ui;' +
            'box-shadow:0 1px 4px rgba(0,0,0,.5);user-select:none';
        var btnCss = 'background:none;border:1px solid #555;color:#d1d1d1;padding:2px 8px;border-radius:3px;cursor:pointer;font:inherit;line-height:1.2';
        var spCss = 'width:1px;height:20px;background:#555;margin:0 2px';
        tb.innerHTML = '<button class="ep" style="' + btnCss + '" title="Previous">\\u25C0</button>' +
            '<span><span class="epn">1</span> / <span class="epc">-</span></span>' +
            '<button class="en" style="' + btnCss + '" title="Next">\\u25B6</button>' +
            '<span style="' + spCss + '"></span>' +
            '<button class="ezo" style="' + btnCss + '" title="Zoom out">\\u2212</button>' +
            '<span class="ezl">100%</span>' +
            '<button class="ezi" style="' + btnCss + '" title="Zoom in">+</button>' +
            '<button class="efw" style="' + btnCss + '" title="Fit width">\\u2194</button>' +
            '<span style="' + spCss + '"></span>' +
            '<button class="edl" style="' + btnCss + '" title="Download">\\u2913</button>';
        container.appendChild(tb);

        var pages = document.createElement('div');
        pages.style.cssText = 'display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:4px';
        container.appendChild(pages);
        var loading = document.createElement('div');
        loading.textContent = 'Loading PDF\\u2026';
        loading.style.cssText = 'color:#ccc;font-family:system-ui;text-align:center;padding:1rem';
        pages.appendChild(loading);
        el.parentNode.replaceChild(container, el);
        pdfjsLib.getDocument(src).promise.then(function(pdf) {
            loading.remove();
            tb.style.display = 'flex';
            tb.querySelector('.epc').textContent = pdf.numPages;

            var fp, uv, isc, sc, cs = [];
            pdf.getPage(1).then(function(page) {
                fp = page; uv = page.getViewport({scale:1});
                isc = Math.min((container.clientWidth - 16) / uv.width, 2);
                sc = isc;
                return renderAll(sc);
            });

            function renderAll(s) {
                sc = s;
                tb.querySelector('.ezl').textContent = Math.round(s / isc * 100) + '%';
                var scrollRatio = 0;
                if (cs.length) {
                    var sh = container.scrollHeight - container.clientHeight;
                    if (sh > 0) scrollRatio = container.scrollTop / sh;
                }
                pages.innerHTML = ''; cs = [];
                var chain = Promise.resolve();
                for (var j = 1; j <= pdf.numPages; j++) {
                    (function(num) {
                        chain = chain.then(function() {
                            return pdf.getPage(num).then(function(pg) {
                                var vp = pg.getViewport({scale: s});
                                var c = document.createElement('canvas');
                                c.style.cssText = 'display:block;box-shadow:0 1px 4px rgba(0,0,0,0.3)';
                                c.width = vp.width; c.height = vp.height;
                                pages.appendChild(c); cs.push(c);
                                return pg.render({canvasContext: c.getContext('2d'), viewport: vp}).promise;
                            });
                        });
                    })(j);
                }
                return chain.then(function() {
                    var newSh = container.scrollHeight - container.clientHeight;
                    if (newSh > 0) container.scrollTop = scrollRatio * newSh;
                });
            }

            container.addEventListener('scroll', function() {
                var th = tb.offsetHeight + 8;
                for (var j = 0; j < cs.length; j++) {
                    if (cs[j].getBoundingClientRect().bottom - container.getBoundingClientRect().top > th) {
                        tb.querySelector('.epn').textContent = j + 1; break;
                    }
                }
            });
            tb.querySelector('.ep').onclick = function() {
                var n = +tb.querySelector('.epn').textContent;
                if (n > 1 && cs[n - 2]) cs[n - 2].scrollIntoView({behavior:'smooth', block:'start'});
            };
            tb.querySelector('.en').onclick = function() {
                var n = +tb.querySelector('.epn').textContent;
                if (n < pdf.numPages && cs[n]) cs[n].scrollIntoView({behavior:'smooth', block:'start'});
            };
            tb.querySelector('.ezi').onclick = function() { renderAll(sc * 1.25); };
            tb.querySelector('.ezo').onclick = function() { renderAll(sc / 1.25); };
            tb.querySelector('.efw').onclick = function() {
                renderAll(Math.min((container.clientWidth - 16) / uv.width, 2));
            };
            tb.querySelector('.edl').onclick = function() {
                pdf.getData().then(function(d) {
                    var b = new Blob([d], {type:'application/pdf'});
                    var u = URL.createObjectURL(b);
                    var a = document.createElement('a');
                    a.href = u;
                    var name = decodeURIComponent((src.split('/').pop() || 'document.pdf').split('?')[0].split('#')[0]);
                    a.download = name;
                    a.click();
                    setTimeout(function() { URL.revokeObjectURL(u); }, 60000);
                });
            };
        }).catch(function(err) {
            loading.textContent = 'Error loading PDF: ' + err.message;
            loading.style.color = '#ff6b6b';
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPdfEmbeds);
    } else {
        initPdfEmbeds();
    }
})();
</script>`;
        const allScripts = script + pdfScript;
        // Replace the LAST </body> to avoid matching inside inlined JS string literals
        const lastIndex = html.lastIndexOf('</body>');
        if (lastIndex !== -1) {
            return html.substring(0, lastIndex) + allScripts + html.substring(lastIndex);
        }
        // Fallback: append before closing html tag or at end
        return html + allScripts;
    }

    /**
     * Resolve relative path segments (../, ./) in a path.
     * @param {string} path - Path to resolve
     * @returns {string} Resolved path
     */
    _resolveRelativePath(path) {
        const parts = path.split('/');
        const resolved = [];
        for (const part of parts) {
            if (part === '..') {
                resolved.pop();
            } else if (part !== '.' && part !== '') {
                resolved.push(part);
            }
        }
        return resolved.join('/');
    }

    /**
     * Decode file content (ArrayBuffer/Uint8Array) to string
     * @param {ArrayBuffer|Uint8Array|string} content - File content
     * @returns {string|null} Decoded string or null
     */
    _decodeFileContent(content) {
        if (!content) return null;
        if (typeof content === 'string') return content;
        const decoder = new TextDecoder();
        return decoder.decode(content);
    }

    /**
     * Look up a resource path in the files map with multiple fallback strategies:
     * 1. Direct match
     * 2. Remove leading ../ segments
     * 3. Extract content/resources/... from absolute URLs
     * 4. Match by filename against content/resources/ entries
     * @param {Object} files - Map of file paths to content
     * @param {string} path - The resource path to look up
     * @returns {*} The file content or undefined
     */
    _findFileContent(files, path) {
        // 1. Direct match
        if (files[path] !== undefined) return files[path];

        // 2. Remove leading ../ segments
        const normalized = path.replace(/^(\.\.\/)+/, '');
        if (files[normalized] !== undefined) return files[normalized];

        // 3. Extract content/resources/... from absolute URLs
        const resourceMatch = path.match(/content\/resources\/(.+)$/);
        if (resourceMatch) {
            const resourcePath = `content/resources/${resourceMatch[1]}`;
            if (files[resourcePath] !== undefined) return files[resourcePath];

            // 3b. Try matching just the filename against all content/resources/ entries
            const filename = resourceMatch[1].split('/').pop();
            if (filename) {
                for (const key of Object.keys(files)) {
                    if (key.startsWith('content/resources/') && key.endsWith('/' + filename)) {
                        return files[key];
                    }
                    // Also match direct filename (no subfolder)
                    if (key === `content/resources/${filename}`) {
                        return files[key];
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Inline CSS and JS resources into HTML.
     * Replaces <link rel="stylesheet" href="..."> with <style> blocks
     * and <script src="..."> with inline <script> blocks.
     * Also converts <img src="..."> to data URIs when the file is available.
     * @param {string} html - The HTML content
     * @param {Object} files - Map of file paths to content
     * @returns {string} HTML with inlined resources
     */
    _inlineResources(html, files) {
        // Inline CSS: <link rel="stylesheet" href="path"> (any attribute order)
        html = html.replace(
            /<link\s+(?=[^>]*rel=["']stylesheet["'])(?=[^>]*href=["']([^"']+)["'])[^>]*\/?>/gi,
            (match, href) => {
                const content = this._decodeFileContent(this._findFileContent(files, href));
                if (content) {
                    const escaped = content.replace(/<\/style/gi, '<\\/style');
                    const safeHref = href.replace(/\*\//g, '* /');
                    return `<style>/* ${safeHref} */\n${escaped}</style>`;
                }
                return match;
            },
        );

        // Inline JS: <script src="path"> </script> (note: space inside tag is common)
        html = html.replace(
            /<script\s+[^>]*src=["']([^"']+)["'][^>]*>[^<]*<\/script>/gi,
            (match, src) => {
                const content = this._decodeFileContent(this._findFileContent(files, src));
                if (content) {
                    // Escape </script> inside JS to prevent premature tag closing
                    const escaped = content.replace(/<\/script/gi, '<\\/script');
                    const safeSrc = src.replace(/\*\//g, '* /');
                    return `<script>/* ${safeSrc} */\n${escaped}</script>`;
                }
                return match;
            },
        );

        // Inline images: <img src="path">
        html = html.replace(
            /(<img\s+[^>]*src=["'])([^"']+)(["'][^>]*>)/gi,
            (match, prefix, src, suffix) => {
                // Skip data URIs and blob URLs
                if (src.startsWith('data:') || src.startsWith('blob:')) return match;
                const content = this._findFileContent(files, src);
                if (content && (content instanceof ArrayBuffer || content instanceof Uint8Array)) {
                    const bytes = content instanceof ArrayBuffer ? new Uint8Array(content) : content;
                    const ext = src.split('.').pop()?.toLowerCase() || 'png';
                    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
                    const mime = mimeMap[ext] || 'application/octet-stream';
                    const chunks = [];
                    const chunkSize = 8192;
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
                    }
                    const binary = chunks.join('');
                    const dataUri = `data:${mime};base64,${btoa(binary)}`;
                    return `${prefix}${dataUri}${suffix}`;
                }
                return match;
            },
        );

        return html;
    }

    /**
     * Replace embedded PDF elements with blob URL placeholder divs for blob URL mode.
     * In blob URL mode, relative PDF paths can't resolve from a blob: context.
     * This creates blob URLs for each PDF and replaces the embed with a
     * <div data-exe-pdf-src="blob:..."> placeholder that the PDF.js embed script renders.
     * @param {string} html - The HTML content
     * @param {Object} files - Files map from blob URL mode
     * @returns {string} HTML with PDF embeds replaced
     */
    _replacePdfEmbedsForBlob(html, files) {
        // Replace <object data="*.pdf"...>...</object>
        html = html.replace(
            /<object([^>]*?)data=(["'])([^"']*\.pdf(?:[?#][^"']*)?)\2([^>]*)>[\s\S]*?<\/object>/gi,
            (match, pre, _q, src, post) => this._createPdfBlobPlaceholder(files, src, match),
        );

        // Replace <embed src="*.pdf"...>
        html = html.replace(
            /<embed([^>]*?)src=(["'])([^"']*\.pdf(?:[?#][^"']*)?)\2([^>]*?)\/?>/gi,
            (match, pre, _q, src, post) => this._createPdfBlobPlaceholder(files, src, match),
        );

        // Replace <iframe src="*.pdf"...>...</iframe>
        html = html.replace(
            /<iframe([^>]*?)src=(["'])([^"']*\.pdf(?:[?#][^"']*)?)\2([^>]*)>[\s\S]*?<\/iframe>/gi,
            (match, pre, _q, src, post) => this._createPdfBlobPlaceholder(files, src, match),
        );

        return html;
    }

    /**
     * Create a blob URL placeholder div for a PDF embed element.
     * @param {Object} files - Files map
     * @param {string} src - PDF source path
     * @param {string} originalHtml - Original element HTML (for dimension extraction)
     * @returns {string} Placeholder div HTML or original HTML if file not found
     * @private
     */
    _createPdfBlobPlaceholder(files, src, originalHtml) {
        const content = this._findFileContent(files, src);
        if (!content) return originalHtml;

        const bytes = content instanceof ArrayBuffer ? new Uint8Array(content)
            : content instanceof Uint8Array ? content : null;
        if (!bytes) return originalHtml;

        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        if (!this._pdfEmbedBlobUrls) this._pdfEmbedBlobUrls = [];
        this._pdfEmbedBlobUrls.push(blobUrl);

        // Extract dimensions from original element
        const wMatch = originalHtml.match(/width=(["']?)(\d+(?:px|%)?)\1/i);
        const hMatch = originalHtml.match(/height=(["']?)(\d+(?:px|%)?)\1/i);
        const w = wMatch ? wMatch[2] : '100%';
        const h = hMatch ? hMatch[2] : '600px';

        return `<div data-exe-pdf-src="${blobUrl}" style="width:${w};height:${h}"></div>`;
    }

    /**
     * Load HTML content via blob URL in the active iframe.
     * Revokes any previous blob URL before creating a new one.
     * @param {string} html - The HTML content to load
     */
    _loadBlobUrlInIframe(html) {
        const targetIframe = this.isPinned ? this.pinnedIframe : this.iframe;
        if (!targetIframe) {
            Logger.error('[PreviewPanel] No iframe available');
            return;
        }

        // Revoke previous blob URL
        if (targetIframe._blobUrl) {
            URL.revokeObjectURL(targetIframe._blobUrl);
        }

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        targetIframe._blobUrl = blobUrl;
        targetIframe.removeAttribute('srcdoc');
        targetIframe.src = blobUrl;

        Logger.log('[PreviewPanel] Preview content loaded via blob URL');
    }

    /**
     * Check whether a MessageEvent source matches one of the preview iframes.
     * @param {*} source
     * @returns {boolean}
     * @private
     */
    _isPreviewIframeSource(source) {
        if (!source) return true;
        const previewSource = this.iframe?.contentWindow || null;
        const pinnedSource = this.pinnedIframe?.contentWindow || null;
        return source === previewSource || source === pinnedSource;
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
                this._popupWindow = newTab;
                this._setupPopupMonitor();
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

        // Clean up popup tracking
        this._popupWindow = null;
        this._clearPopupMonitor();

        // Close recovery BroadcastChannel
        if (this._recoveryChannel) {
            this._recoveryChannel.close();
            this._recoveryChannel = null;
        }

        // Remove SW message listener
        if (this._swMessageHandler) {
            navigator.serviceWorker?.removeEventListener('message', this._swMessageHandler);
            this._swMessageHandler = null;
        }
        if (this._swContentNeededTimer) {
            clearTimeout(this._swContentNeededTimer);
            this._swContentNeededTimer = null;
        }

        // Revoke blob URLs
        [this.iframe, this.pinnedIframe].forEach((iframe) => {
            if (iframe?._blobUrl) {
                URL.revokeObjectURL(iframe._blobUrl);
            }
        });

        // Revoke PDF embed blob URLs (from blob URL mode)
        if (this._pdfEmbedBlobUrls) {
            this._pdfEmbedBlobUrls.forEach(url => URL.revokeObjectURL(url));
            this._pdfEmbedBlobUrls = null;
        }

        Logger.log('[PreviewPanel] Destroyed');
    }
}

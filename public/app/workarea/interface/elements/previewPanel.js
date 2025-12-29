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

        // Listen for postMessage from preview iframe to request PDF blobs
        // The preview iframe requests the blob, we send it back, and the preview
        // creates a blob URL in its own context - this works in Chrome
        window.addEventListener('message', async (event) => {
            // Handle PDF blob requests (for embedding in preview iframe)
            if (event.data?.type === 'requestPdfBlob') {
                const { assetId, requestId } = event.data;
                Logger.log(`[PreviewPanel] Received requestPdfBlob for ${assetId}`);

                try {
                    const assetManager = eXeLearning?.app?.project?._yjsBridge?.assetManager;
                    if (!assetManager) {
                        throw new Error('AssetManager not available');
                    }

                    const asset = await assetManager.getAsset(assetId);
                    if (!asset?.blob) {
                        throw new Error('Asset not found in IndexedDB');
                    }

                    // Send blob back to preview iframe (Blobs are cloneable via postMessage)
                    event.source.postMessage({
                        type: 'pdfBlobResponse',
                        requestId: requestId,
                        blob: asset.blob,
                        success: true
                    }, '*');

                    Logger.log(`[PreviewPanel] Sent PDF blob for ${assetId}`);
                } catch (err) {
                    Logger.error('[PreviewPanel] Failed to get PDF blob:', err);
                    event.source.postMessage({
                        type: 'pdfBlobResponse',
                        requestId: requestId,
                        error: err.message,
                        success: false
                    }, '*');
                }
                return;
            }

            // Handle ELPX download requests from preview iframe (download-source-file iDevice)
            if (event.data?.type === 'exe-download-elpx') {
                Logger.log('[PreviewPanel] Received exe-download-elpx request');
                try {
                    const project = eXeLearning?.app?.project;
                    if (project?.exportToElpxViaYjs) {
                        await project.exportToElpxViaYjs({ saveAs: true });
                    } else {
                        Logger.error('[PreviewPanel] exportToElpxViaYjs not available');
                        alert('ELPX export not available. Please save your project first.');
                    }
                } catch (err) {
                    Logger.error('[PreviewPanel] ELPX export failed:', err);
                    alert('Error generating ELPX file: ' + err.message);
                }
                return;
            }

            // Handle PDF popup requests (fallback for clicking cards)
            if (event.data?.type === 'openPdfPopup') {
                const { assetId } = event.data;
                Logger.log(`[PreviewPanel] Received openPdfPopup request for ${assetId}`);

                try {
                    const assetManager = eXeLearning?.app?.project?._yjsBridge?.assetManager;
                    if (!assetManager) {
                        throw new Error('AssetManager not available');
                    }

                    const asset = await assetManager.getAsset(assetId);
                    if (!asset?.blob) {
                        throw new Error('Asset not found in IndexedDB');
                    }

                    // Create blob URL in parent window context (has proper http: origin)
                    const blobUrl = URL.createObjectURL(asset.blob);

                    // Open popup from parent window - this works in Chrome
                    const popup = window.open(blobUrl, '_blank', 'width=900,height=700');
                    if (!popup) {
                        window.open(blobUrl, '_blank');
                    }

                    Logger.log(`[PreviewPanel] Opened PDF popup for ${assetId}`);
                } catch (err) {
                    Logger.error('[PreviewPanel] Failed to open PDF popup:', err);
                }
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

        // Get resource fetcher from yjsBridge (already initialized with bundle manifest)
        const resourceFetcher = yjsBridge.resourceFetcher || null;

        // Build preview options
        // Get theme URL from currently selected theme (handles admin vs builtin themes)
        // Ensure it's an absolute URL (blob: contexts don't resolve relative URLs correctly)
        const selectedTheme = eXeLearning.app?.themes?.selected;
        let themeUrl = selectedTheme?.path || null;
        if (themeUrl && !themeUrl.startsWith('http')) {
            themeUrl = window.location.origin + themeUrl;
        }

        const previewOptions = {
            baseUrl: window.location.origin,
            basePath: eXeLearning.app.config?.basePath || '',
            version: eXeLearning.app.config?.version || 'v1',
            themeUrl: themeUrl, // Full absolute theme URL (e.g., 'http://localhost:8081/v1/site-files/themes/chiquito/')
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

        // Add MIME types to media elements BEFORE resolving URLs
        // (while asset:// URLs still contain filename with extension)
        let html = typeof window.addMediaTypes === 'function'
            ? window.addMediaTypes(result.html)
            : result.html;

        // Simplify MediaElement.js structures to native HTML5 video/audio
        // (fixes playback issues with large videos)
        if (typeof window.simplifyMediaElements === 'function') {
            html = window.simplifyMediaElements(html);
        }

        // Resolve asset URLs to blob URLs
        // Note: We keep blob URLs for audio/video (don't convert to data URLs) because:
        // 1. Large videos as data URLs cause memory issues and MediaElement.js problems
        // We skip iframe asset URLs (PDFs) - they will be handled by the injected script
        // which accesses AssetManager directly and creates blob URLs in the preview's context
        if (typeof window.resolveAssetUrlsAsync === 'function') {
            try {
                html = await window.resolveAssetUrlsAsync(html, {
                    convertBlobUrls: false,       // Keep blob URLs for audio/video
                    convertIframeBlobUrls: false, // Don't convert iframes
                    skipIframeSrc: true           // Keep asset:// URLs in iframes for preview script
                });
            } catch (error) {
                Logger.warn('[PreviewPanel] Failed to resolve asset URLs:', error);
            }
        }

        // Inject script to handle PDF asset:// URLs inside the preview
        // The script will:
        // 1. Find PDF iframes with asset:// URLs
        // 2. Replace them with clickable cards
        // 3. On click, fetch asset data from parent window's AssetManager (IndexedDB)
        // 4. Create blob URL in preview's context and open in popup
        html = this.injectPdfBlobUrlConverter(html);

        return html;
    }

    /**
     * Inject a script that renders PDF iframes using PDF.js.
     *
     * ## Why PDF.js is needed (only for internal asset:// PDFs in Chrome)
     *
     * Chrome has a security limitation where its native PDF viewer cannot render
     * PDFs inside nested iframes when the parent document is loaded via blob URL.
     *
     * The preview panel loads content as a blob URL for proper isolation:
     *   - Main window (http://localhost:8080)
     *     └── Preview iframe (blob:http://localhost:8080/...)  ← blob URL
     *           └── PDF iframe (asset://uuid/file.pdf)         ← BLOCKED in Chrome
     *
     * This affects ONLY:
     *   - Chrome browser (Firefox handles this fine)
     *   - Internal assets with asset:// URLs (stored in IndexedDB)
     *   - When the preview container is a blob URL
     *
     * This does NOT affect:
     *   - External PDFs (http/https URLs) - these work fine
     *   - Firefox browser - no such limitation
     *   - Exported content - uses real URLs, not blob containers
     *
     * ## Solution: PDF.js
     *
     * PDF.js (Mozilla) renders PDFs to canvas using pure JavaScript, bypassing
     * the browser's native PDF viewer entirely. This works regardless of the
     * blob URL context.
     *
     * For asset:// URLs, we:
     * 1. Load PDF.js library dynamically
     * 2. Request the PDF blob from parent window via postMessage
     * 3. Render to canvas with navigation/zoom controls
     * 4. Fall back to clickable card if PDF.js fails
     *
     * @param {string} html - HTML content
     * @returns {string} HTML with injected script
     */
    injectPdfBlobUrlConverter(html) {
        const basePath = eXeLearning?.app?.config?.basePath || '';
        // In blob URL context, relative imports don't work - need full absolute URL
        const origin = window.location.origin;
        const pdfJsUrl = `${origin}${basePath}/libs/pdfjs/pdf.min.mjs`;
        const pdfJsWorkerUrl = `${origin}${basePath}/libs/pdfjs/pdf.worker.min.mjs`;

        // Script to render PDFs using PDF.js
        const converterScript = `
<script type="module">
(async function() {
    // Load PDF.js
    let pdfjsLib = null;
    try {
        const pdfjs = await import('${pdfJsUrl}');
        pdfjsLib = pdfjs;
        pdfjsLib.GlobalWorkerOptions.workerSrc = '${pdfJsWorkerUrl}';
        console.log('[PreviewPanel] PDF.js loaded successfully');
    } catch (e) {
        console.warn('[PreviewPanel] Failed to load PDF.js:', e.message);
    }

    // Map to track pending blob requests
    var pendingRequests = {};
    var requestIdCounter = 0;

    // Listen for blob responses from parent
    window.addEventListener('message', function(event) {
        if (event.data?.type !== 'pdfBlobResponse') return;

        var requestId = event.data.requestId;
        var pending = pendingRequests[requestId];
        if (!pending) return;

        delete pendingRequests[requestId];

        if (event.data.success && event.data.blob) {
            pending.resolve(event.data.blob);
        } else {
            pending.reject(new Error(event.data.error || 'Failed to get blob'));
        }
    });

    // Request blob from parent and return promise
    function requestBlobFromParent(assetId) {
        return new Promise(function(resolve, reject) {
            var requestId = 'req_' + (++requestIdCounter);
            pendingRequests[requestId] = { resolve: resolve, reject: reject };

            window.parent.postMessage({
                type: 'requestPdfBlob',
                assetId: assetId,
                requestId: requestId
            }, '*');

            setTimeout(function() {
                if (pendingRequests[requestId]) {
                    delete pendingRequests[requestId];
                    reject(new Error('Timeout requesting blob'));
                }
            }, 15000);
        });
    }

    // Zoom levels
    var ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

    // Create PDF viewer with controls
    function createPdfViewer(iframe, assetUrl) {
        var width = iframe.width || iframe.style.width || '100%';
        var height = iframe.height || iframe.style.height || '400px';
        if (typeof width === 'number' || !width.includes('%')) width = width + 'px';
        if (typeof height === 'number' || !height.includes('%')) height = height + 'px';

        var container = document.createElement('div');
        container.className = 'exe-pdf-viewer';
        container.setAttribute('data-asset-url', assetUrl);
        container.style.cssText = 'width:' + width + ';height:' + height + ';' +
            'display:flex;flex-direction:column;border:1px solid #ccc;border-radius:4px;' +
            'background:#525659;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;';

        // Toolbar
        var toolbar = document.createElement('div');
        toolbar.className = 'exe-pdf-toolbar';
        toolbar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;' +
            'padding:6px 12px;background:#323639;border-bottom:1px solid #1a1a1a;flex-shrink:0;';

        // Navigation buttons
        var prevBtn = document.createElement('button');
        prevBtn.innerHTML = '◀';
        prevBtn.title = 'Previous page';
        prevBtn.style.cssText = 'background:#525659;border:none;color:#fff;padding:4px 8px;' +
            'border-radius:3px;cursor:pointer;font-size:12px;';
        prevBtn.disabled = true;

        var pageInfo = document.createElement('span');
        pageInfo.className = 'exe-pdf-page-info';
        pageInfo.textContent = 'Loading...';
        pageInfo.style.cssText = 'color:#fff;font-size:12px;min-width:80px;text-align:center;';

        var nextBtn = document.createElement('button');
        nextBtn.innerHTML = '▶';
        nextBtn.title = 'Next page';
        nextBtn.style.cssText = prevBtn.style.cssText;
        nextBtn.disabled = true;

        // Separator
        var sep1 = document.createElement('span');
        sep1.style.cssText = 'width:1px;height:16px;background:#666;margin:0 4px;';

        // Zoom controls
        var zoomOutBtn = document.createElement('button');
        zoomOutBtn.innerHTML = '−';
        zoomOutBtn.title = 'Zoom out';
        zoomOutBtn.style.cssText = prevBtn.style.cssText + 'font-size:16px;font-weight:bold;';

        var zoomInfo = document.createElement('span');
        zoomInfo.className = 'exe-pdf-zoom-info';
        zoomInfo.textContent = '100%';
        zoomInfo.style.cssText = 'color:#fff;font-size:12px;min-width:45px;text-align:center;';

        var zoomInBtn = document.createElement('button');
        zoomInBtn.innerHTML = '+';
        zoomInBtn.title = 'Zoom in';
        zoomInBtn.style.cssText = zoomOutBtn.style.cssText;

        var fitBtn = document.createElement('button');
        fitBtn.innerHTML = '⛶';
        fitBtn.title = 'Fit to width';
        fitBtn.style.cssText = prevBtn.style.cssText + 'font-size:14px;';

        // Separator
        var sep2 = document.createElement('span');
        sep2.style.cssText = sep1.style.cssText;

        // Open in popup button
        var popupBtn = document.createElement('button');
        popupBtn.innerHTML = '↗';
        popupBtn.title = 'Open in new window';
        popupBtn.style.cssText = prevBtn.style.cssText + 'font-size:14px;';

        toolbar.appendChild(prevBtn);
        toolbar.appendChild(pageInfo);
        toolbar.appendChild(nextBtn);
        toolbar.appendChild(sep1);
        toolbar.appendChild(zoomOutBtn);
        toolbar.appendChild(zoomInfo);
        toolbar.appendChild(zoomInBtn);
        toolbar.appendChild(fitBtn);
        toolbar.appendChild(sep2);
        toolbar.appendChild(popupBtn);

        // Canvas container with scroll
        var canvasContainer = document.createElement('div');
        canvasContainer.className = 'exe-pdf-canvas-container';
        canvasContainer.style.cssText = 'flex:1;overflow:auto;display:flex;justify-content:center;' +
            'align-items:flex-start;padding:10px;';

        var canvas = document.createElement('canvas');
        canvas.className = 'exe-pdf-canvas';
        canvas.style.cssText = 'box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#fff;';
        canvasContainer.appendChild(canvas);

        container.appendChild(toolbar);
        container.appendChild(canvasContainer);

        // Store references for later use
        container._elements = {
            canvas: canvas,
            canvasContainer: canvasContainer,
            prevBtn: prevBtn,
            nextBtn: nextBtn,
            pageInfo: pageInfo,
            zoomOutBtn: zoomOutBtn,
            zoomInBtn: zoomInBtn,
            zoomInfo: zoomInfo,
            fitBtn: fitBtn,
            popupBtn: popupBtn
        };
        container._state = {
            pdfDoc: null,
            currentPage: 1,
            totalPages: 0,
            scale: 1.0,
            zoomIndex: 3, // Index of 1.0 in ZOOM_LEVELS
            assetUrl: assetUrl,
            rendering: false
        };

        return container;
    }

    // Render a page
    async function renderPage(container) {
        var state = container._state;
        var els = container._elements;

        if (!state.pdfDoc || state.rendering) return;
        state.rendering = true;

        try {
            var page = await state.pdfDoc.getPage(state.currentPage);
            var viewport = page.getViewport({ scale: state.scale });

            els.canvas.width = viewport.width;
            els.canvas.height = viewport.height;

            var ctx = els.canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            // Update UI
            els.pageInfo.textContent = state.currentPage + ' / ' + state.totalPages;
            els.prevBtn.disabled = state.currentPage <= 1;
            els.nextBtn.disabled = state.currentPage >= state.totalPages;
            els.zoomInfo.textContent = Math.round(state.scale * 100) + '%';
            els.zoomOutBtn.disabled = state.zoomIndex <= 0;
            els.zoomInBtn.disabled = state.zoomIndex >= ZOOM_LEVELS.length - 1;
        } catch (e) {
            console.error('[PreviewPanel] Failed to render page:', e);
            els.pageInfo.textContent = 'Error';
        }

        state.rendering = false;
    }

    // Fit to container width
    async function fitToWidth(container) {
        var state = container._state;
        var els = container._elements;

        if (!state.pdfDoc) return;

        var page = await state.pdfDoc.getPage(state.currentPage);
        var containerWidth = els.canvasContainer.clientWidth - 20; // padding
        var viewport = page.getViewport({ scale: 1.0 });
        var newScale = containerWidth / viewport.width;

        // Find closest zoom level
        var closestIndex = 0;
        var minDiff = Math.abs(ZOOM_LEVELS[0] - newScale);
        for (var i = 1; i < ZOOM_LEVELS.length; i++) {
            var diff = Math.abs(ZOOM_LEVELS[i] - newScale);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }

        state.scale = newScale;
        state.zoomIndex = closestIndex;
        await renderPage(container);
    }

    // Setup event handlers
    function setupControls(container) {
        var state = container._state;
        var els = container._elements;

        els.prevBtn.onclick = async function() {
            if (state.currentPage > 1) {
                state.currentPage--;
                await renderPage(container);
            }
        };

        els.nextBtn.onclick = async function() {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                await renderPage(container);
            }
        };

        els.zoomOutBtn.onclick = async function() {
            if (state.zoomIndex > 0) {
                state.zoomIndex--;
                state.scale = ZOOM_LEVELS[state.zoomIndex];
                await renderPage(container);
            }
        };

        els.zoomInBtn.onclick = async function() {
            if (state.zoomIndex < ZOOM_LEVELS.length - 1) {
                state.zoomIndex++;
                state.scale = ZOOM_LEVELS[state.zoomIndex];
                await renderPage(container);
            }
        };

        els.fitBtn.onclick = function() {
            fitToWidth(container);
        };

        els.popupBtn.onclick = function() {
            var assetUrl = state.assetUrl;
            if (assetUrl.startsWith('asset://')) {
                var match = assetUrl.match(/^asset:\\/\\/([^\\/]+)/);
                if (match) {
                    window.parent.postMessage({
                        type: 'openPdfPopup',
                        assetId: match[1],
                        assetUrl: assetUrl
                    }, '*');
                }
            }
        };
    }

    // Load PDF into viewer
    async function loadPdf(container, blob) {
        var state = container._state;
        var els = container._elements;

        try {
            var arrayBuffer = await blob.arrayBuffer();
            state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            state.totalPages = state.pdfDoc.numPages;
            state.currentPage = 1;

            setupControls(container);
            await fitToWidth(container);

            console.log('[PreviewPanel] PDF loaded with', state.totalPages, 'pages');
        } catch (e) {
            console.error('[PreviewPanel] Failed to load PDF:', e);
            els.pageInfo.textContent = 'Error loading PDF';
        }
    }

    // Create fallback card (when PDF.js not available)
    function createPdfCard(iframe, assetUrl) {
        var card = document.createElement('div');
        card.className = 'exe-pdf-preview-card';
        card.setAttribute('data-asset-url', assetUrl);
        card.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
            'width:' + (iframe.width || '300') + 'px;height:' + (iframe.height || '150') + 'px;' +
            'background:linear-gradient(135deg,#f5f5f5 0%,#e0e0e0 100%);' +
            'border:1px solid #ccc;border-radius:8px;cursor:pointer;' +
            'font-family:system-ui,-apple-system,sans-serif;transition:all 0.2s ease;';

        var icon = document.createElement('div');
        icon.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 11h6"/></svg>';
        icon.style.cssText = 'margin-bottom:8px;';

        var label = document.createElement('div');
        label.textContent = 'PDF';
        label.style.cssText = 'font-size:14px;font-weight:600;color:#dc3545;margin-bottom:4px;';

        var hint = document.createElement('div');
        hint.textContent = 'Click to open';
        hint.style.cssText = 'font-size:12px;color:#666;';

        card.appendChild(icon);
        card.appendChild(label);
        card.appendChild(hint);

        card.onmouseenter = function() {
            card.style.background = 'linear-gradient(135deg,#e8e8e8 0%,#d0d0d0 100%)';
            card.style.transform = 'scale(1.02)';
        };
        card.onmouseleave = function() {
            card.style.background = 'linear-gradient(135deg,#f5f5f5 0%,#e0e0e0 100%)';
            card.style.transform = 'scale(1)';
        };

        card.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            var url = card.getAttribute('data-asset-url');
            if (url.startsWith('asset://')) {
                var match = url.match(/^asset:\\/\\/([^\\/]+)/);
                if (match) {
                    window.parent.postMessage({
                        type: 'openPdfPopup',
                        assetId: match[1],
                        assetUrl: url
                    }, '*');
                }
            } else {
                window.open(url, '_blank', 'width=900,height=700');
            }
        };

        return card;
    }

    // Process PDF iframes and render with PDF.js when needed.
    //
    // Why we only use PDF.js for asset:// URLs:
    // - External URLs (http/https): Chrome's native PDF viewer works fine
    // - asset:// URLs: These are internal assets stored in IndexedDB. Chrome
    //   cannot render them with its native viewer because:
    //   1. The preview is loaded as a blob URL for isolation
    //   2. Chrome blocks nested PDF rendering in blob URL contexts
    //   3. We need to fetch the blob via postMessage and render with PDF.js
    // - data: URLs: Also use PDF.js since Chrome may block in blob context
    // - blob: URLs (same context): Keep as-is, should work
    async function resolvePdfIframes() {
        var iframes = Array.from(document.querySelectorAll('iframe'));

        for (var i = 0; i < iframes.length; i++) {
            var iframe = iframes[i];
            try {
                var src = iframe.getAttribute('src') || '';

                // Skip external URLs (http://, https://) - Chrome's native PDF viewer works
                // fine for these even inside blob URL context
                if (src.startsWith('http://') || src.startsWith('https://')) {
                    continue;
                }

                // Check for PDF indicators
                var isPdf = src.includes('.pdf') ||
                           iframe.getAttribute('type') === 'application/pdf' ||
                           iframe.getAttribute('data-type') === 'application/pdf' ||
                           src.startsWith('data:application/pdf');

                // For asset:// URLs, check file extension
                if (src.startsWith('asset://') && !isPdf) {
                    if (src.toLowerCase().includes('.pdf')) {
                        isPdf = true;
                    }
                }

                if (!isPdf) continue;

                // Handle asset:// URLs for PDFs
                // These are internal assets stored in IndexedDB. Chrome cannot load them
                // directly because: (1) asset:// is not a registered protocol, and (2) even
                // if we converted to blob URL, Chrome's native PDF viewer doesn't work in
                // nested blob URL contexts. Solution: use PDF.js to render to canvas.
                if (src.startsWith('asset://')) {
                    var match = src.match(/^asset:\\/\\/([^\\/]+)/);
                    if (!match) continue;
                    var assetId = match[1];

                    // If PDF.js loaded successfully, render inline with full viewer controls
                    if (pdfjsLib) {
                        var viewer = createPdfViewer(iframe, src);
                        iframe.parentNode.replaceChild(viewer, iframe);

                        try {
                            var blob = await requestBlobFromParent(assetId);
                            await loadPdf(viewer, blob);
                            console.log('[PreviewPanel] Rendered PDF with PDF.js');
                        } catch (e) {
                            console.error('[PreviewPanel] Failed to load PDF:', e);
                            viewer._elements.pageInfo.textContent = 'Error: ' + e.message;
                        }
                    } else {
                        // Fallback to card
                        var card = createPdfCard(iframe, src);
                        iframe.parentNode.replaceChild(card, iframe);
                        console.log('[PreviewPanel] PDF.js not available, using card fallback');
                    }
                    continue;
                }

                // Handle blob:// URLs for PDFs (in same context)
                if (src.startsWith('blob:')) {
                    console.log('[PreviewPanel] PDF iframe with blob URL, keeping as-is');
                    continue;
                }

                // Handle data:application/pdf URLs
                if (src.startsWith('data:application/pdf') && pdfjsLib) {
                    var base64Match = src.match(/^data:application\\/pdf;base64,(.+)$/);
                    if (base64Match) {
                        var binaryString = atob(base64Match[1]);
                        var bytes = new Uint8Array(binaryString.length);
                        for (var j = 0; j < binaryString.length; j++) {
                            bytes[j] = binaryString.charCodeAt(j);
                        }
                        var dataBlob = new Blob([bytes], { type: 'application/pdf' });

                        var viewer = createPdfViewer(iframe, src);
                        iframe.parentNode.replaceChild(viewer, iframe);
                        await loadPdf(viewer, dataBlob);
                        console.log('[PreviewPanel] Rendered data URL PDF with PDF.js');
                    }
                }
            } catch (e) {
                console.error('[PreviewPanel] Failed to resolve PDF iframe:', e);
            }
        }
    }

    // Run on DOMContentLoaded or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolvePdfIframes);
    } else {
        resolvePdfIframes();
    }
})();
</script>`;

        // Inject before </body> or at the end
        if (html.includes('</body>')) {
            return html.replace('</body>', converterScript + '</body>');
        }
        return html + converterScript;
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

/**
 * PreviewPanelManager
 * Manages the preview panel (slide-out and pinned modes)
 * with auto-refresh capability when content changes.
 *
 * Transport (how generated files reach the sandboxed iframe) is delegated to
 * a preview provider (./preview/): HTTP sessions in server mode, srcdoc in
 * static/embedded mode, and the legacy same-origin Service Worker only for
 * Electron or explicit opt-in. The panel owns the DOM and the message
 * contract with the (untrusted, opaque-origin) preview content.
 */
import { MSG, PreviewSessionExpiredError, sanitizePagePath } from './preview/providerContract.js';
import { selectPreviewProvider } from './preview/selectPreviewProvider.js';
import { PreviewMediaHost } from './preview/previewMediaHost.js';
import { documentMimeFor } from './preview/previewFileMap.js';

// Use global AppLogger for debug-controlled logging
const Logger = window.AppLogger || console;

export default class PreviewPanelManager {
    /** Timeout for Service Worker status check (ms) */
    static SW_STATUS_TIMEOUT = 2000;

    /**
     * Sandbox tokens for opaque-safe transports. The absence of
     * allow-same-origin is what isolates untrusted authored content; matches
     * the plugin ecosystem's secure token set and the backend response CSP.
     */
    static OPAQUE_SANDBOX = 'allow-scripts allow-popups allow-forms';

    /** Historical token set, applied only for the legacy SW transport. */
    static LEGACY_SANDBOX =
        'allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-popups allow-presentation';

    constructor() {
        // DOM Elements - Slide-out panel
        this.panel = document.getElementById('previewsidenav');
        this.overlay = document.getElementById('preview-sidenav-overlay');
        this.closeButton = document.getElementById('previewsidenavclose');
        this.extractButton = document.getElementById('preview-extract-button');
        this.pinButton = document.getElementById('preview-pin-button');
        this.refreshButton = document.getElementById('preview-refresh-button');
        this.mobileButton = document.getElementById('preview-mobile-button');
        this.iframe = document.getElementById('preview-iframe');

        // DOM Elements - Pinned mode
        this.pinnedContainer = document.getElementById('preview-pinned-container');
        this.pinnedIframe = document.getElementById('preview-pinned-iframe');
        this.pinnedExtractButton = document.getElementById('preview-pinned-extract-button');
        this.unpinButton = document.getElementById('preview-unpin-button');
        this.pinnedRefreshButton = document.getElementById('preview-pinned-refresh-button');
        this.pinnedMobileButton = document.getElementById('preview-pinned-mobile-button');

        // State
        this.isOpen = false;
        this.isPinned = false;
        this.isLoading = false;
        this.isMobileViewport = this._readStoredViewport() === 'mobile';
        this.autoRefreshEnabled = true;
        this.refreshDebounceTimer = null;
        this.refreshDebounceDelay = 500; // 500ms debounce for responsive updates

        // Store unsubscribe function for Yjs observers
        this._unsubscribeStructure = null;
        this._onYdocUpdate = null;

        // Preview transport provider state
        this._provider = null;
        this._session = null;
        this._currentPagePath = null;
        this._mediaHost = null;
        this._basePath = '';
        this._pageHideHandler = null;

        // Popup window tracking
        this._popupWindow = null;
        this._popupMonitorTimer = null;
        this._previewTabHandoff = null;
        this._recoveryChannel = null;
    }

    /**
     * Initialize the preview panel
     */
    init() {
        this._initProvider();
        this.bindEvents();
        this.applyViewport();
        this.subscribeToChanges();
        this.resetToDefaultState();
        // SW recovery machinery only applies to the legacy transport: opaque
        // transports have no Service Worker to lose content from.
        if (this._isLegacyServiceWorkerTransport()) {
            this._setupVisibilityHandler();
            this._setupBroadcastChannelListener();
            this._setupServiceWorkerListener();
        }
        this._setupDisposeLifecycle();
        Logger.log('[PreviewPanel] Initialized');
    }

    /**
     * Select and configure the preview transport provider for this runtime,
     * enforce the matching iframe sandbox, and attach the external-media
     * relay when the transport is opaque-safe.
     */
    _initProvider() {
        const app = eXeLearning?.app;
        const basePath = app?.getBasePath?.() || '';
        this._basePath = basePath;
        try {
            this._provider = selectPreviewProvider({
                runtimeConfig: app?.runtimeConfig || null,
                hasElectronApi: typeof window !== 'undefined' && !!window.electronAPI,
                deps: {
                    basePath,
                    app,
                    pdfUnavailableMessage: _('PDF preview is not available here.'),
                },
            });
        } catch (error) {
            // No silent downgrade: without a valid transport the preview
            // surfaces an error instead of rendering same-origin.
            Logger.error('[PreviewPanel] Preview transport selection failed:', error);
            this._provider = null;
            return;
        }

        for (const iframe of [this.iframe, this.pinnedIframe]) {
            if (iframe) this._applySandboxForProvider(iframe);
        }

        if (this._provider.opaqueSafe) {
            this._mediaHost = new PreviewMediaHost({ basePath });
            for (const iframe of [this.iframe, this.pinnedIframe]) {
                if (!iframe) continue;
                this._mediaHost.attach(iframe).catch((error) => {
                    Logger.warn('[PreviewPanel] Media bridge attach failed:', error);
                });
            }
        }

        // Extract-to-new-tab needs a real URL; srcdoc sessions have none.
        if (app?.capabilities?.preview?.extractToNewTab === false) {
            for (const button of [this.extractButton, this.pinnedExtractButton]) {
                button?.classList.add('hidden');
                button?.setAttribute('aria-hidden', 'true');
            }
        }
    }

    /** @returns {boolean} */
    _isLegacyServiceWorkerTransport() {
        return this._provider?.mode === 'service-worker';
    }

    /**
     * Enforce the sandbox attribute the active transport requires. Opaque
     * transports get exactly the opaque token set; only the legacy Service
     * Worker transport (Electron interim / explicit opt-in) keeps the
     * historical same-origin tokens — loudly.
     * @param {HTMLIFrameElement} iframe
     */
    _applySandboxForProvider(iframe) {
        const opaqueTokens = window.SharedExporters?.PREVIEW_SANDBOX || PreviewPanelManager.OPAQUE_SANDBOX;
        const tokens = this._provider?.opaqueSafe ? opaqueTokens : PreviewPanelManager.LEGACY_SANDBOX;
        if (!this._provider?.opaqueSafe) {
            Logger.warn(
                '[PreviewPanel] Legacy same-origin preview transport active (Service Worker); ' +
                    'untrusted content isolation relies on the Y.Doc sanitizer only.',
            );
        }
        if (iframe.getAttribute('sandbox') !== tokens) {
            iframe.setAttribute('sandbox', tokens);
        }
    }

    /** Release the backend preview session when the page goes away. */
    _setupDisposeLifecycle() {
        if (typeof window === 'undefined') return;
        this._pageHideHandler = () => {
            this._provider?.dispose({ keepalive: true })?.catch?.(() => {});
        };
        window.addEventListener('pagehide', this._pageHideHandler);
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

    /** sessionStorage key used to persist the viewport choice for the session */
    static VIEWPORT_STORAGE_KEY = 'exe-preview-viewport';

    /**
     * Read the stored viewport preference for the session.
     * @returns {string|null} 'mobile', 'desktop', or null when unavailable
     */
    _readStoredViewport() {
        try {
            return window.sessionStorage?.getItem(PreviewPanelManager.VIEWPORT_STORAGE_KEY) ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Toggle the preview iframe between desktop (full width) and mobile
     * (phone-sized, centered) viewports. The choice persists for the session.
     */
    toggleViewport() {
        this.isMobileViewport = !this.isMobileViewport;
        try {
            window.sessionStorage?.setItem(
                PreviewPanelManager.VIEWPORT_STORAGE_KEY,
                this.isMobileViewport ? 'mobile' : 'desktop',
            );
        } catch {
            // sessionStorage may be unavailable (private mode); ignore.
        }
        this.applyViewport();
    }

    /**
     * Apply the current viewport state to the preview bodies and toolbar
     * buttons in both slide-out and pinned modes.
     */
    applyViewport() {
        const bodies = [
            this.iframe?.closest('.preview-panel-body'),
            this.pinnedIframe?.closest('.preview-pinned-body'),
        ];
        for (const body of bodies) {
            body?.classList.toggle('preview-mobile-viewport', this.isMobileViewport);
        }

        const buttons = [this.mobileButton, this.pinnedMobileButton];
        for (const button of buttons) {
            button?.setAttribute('aria-pressed', this.isMobileViewport ? 'true' : 'false');
            button?.classList.toggle('is-active', this.isMobileViewport);
        }
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
                Logger.log('[PreviewPanel] Popup reported content lost, refreshing preview content...');
                this.refresh().catch((err) => {
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
                    this.refresh().catch((err) => {
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
                this._teardownPreviewTabHandoff();
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
        this.mobileButton?.addEventListener('click', () => this.toggleViewport());

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
        this.pinnedMobileButton?.addEventListener('click', () => this.toggleViewport());

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

        // Listen for postMessage from the preview iframes. The preview renders
        // untrusted authored content in an opaque-origin sandbox, so every
        // message is gated on the browser-enforced source identity (never on
        // event.origin, which is 'null' for opaque frames) and every payload
        // field is validated before use.
        window.addEventListener('message', async (event) => {
            if (!this._isPreviewIframeSource(event.source)) return;
            const data = event.data;
            if (!data || typeof data.type !== 'string') return;

            // ELPX download requests (download-source-file iDevice)
            if (data.type === MSG.DOWNLOAD_ELPX) {
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

            // Page-path report from the rendered page (all transports): lets
            // auto-refresh reload the SAME page the author is looking at.
            if (data.type === MSG.NAV_REPORT) {
                const page = sanitizePagePath(data.page);
                if (page) {
                    this._currentPagePath = page;
                    const targetIframe = this.isPinned ? this.pinnedIframe : this.iframe;
                    if (targetIframe) targetIframe.dataset.previewPage = page;
                }
                return;
            }

            // Internal page navigation (srcdoc transport: pages have no URLs)
            if (data.type === MSG.NAVIGATE) {
                await this._handlePreviewNavigate(data);
                return;
            }



            // Non-HTML document open requests (PDF, office docs, media): the
            // opaque frame can neither render PDFs nor download files, so the
            // trusted parent opens them (PDF.js wrapper tab for PDFs, blob
            // tab otherwise).
            if (data.type === MSG.OPEN_DOC) {
                await this._handlePreviewOpenDocument(data);
                return;
            }

            // Legacy SW transport only: the Service Worker terminated and
            // restarted without content and asks for a refresh.
            if (data.type === 'CONTENT_NEEDED' && this._isLegacyServiceWorkerTransport()) {
                Logger.log('[PreviewPanel] Service Worker requested content refresh:', data.reason);
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
     * Resolve an href posted by the preview against the page that posted it.
     * Both values are attacker-controlled (the preview renders untrusted
     * authored content): protocol URLs and root-escaping paths are rejected.
     * @param {*} href
     * @param {string} currentPage
     * @returns {string|null}
     */
    _resolvePreviewHref(href, currentPage) {
        if (typeof href !== 'string' || !href || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) {
            return null;
        }
        const clean = href.split('?')[0].split('#')[0];
        if (!clean) return null;
        if (clean.startsWith('/')) return sanitizePagePath(clean.replace(/^\/+/, ''));
        const currentDir = currentPage.includes('/')
            ? currentPage.substring(0, currentPage.lastIndexOf('/') + 1)
            : '';
        return sanitizePagePath(currentDir + clean);
    }

    /**
     * MSG.NAVIGATE (srcdoc transport): render another page of the preview.
     * @param {{href: *, page: *}} data
     */
    async _handlePreviewNavigate(data) {
        const currentPage = sanitizePagePath(data.page) || this._currentPagePath || 'index.html';
        const targetPage = this._resolvePreviewHref(data.href, currentPage);
        if (!targetPage) {
            Logger.warn('[PreviewPanel] Rejected preview navigation request:', data.href);
            return;
        }
        if (typeof this._provider?.hasPage === 'function' && !this._provider.hasPage(targetPage)) {
            Logger.warn(`[PreviewPanel] Preview page not found: ${targetPage}`);
            return;
        }
        try {
            const target = await this._provider.resolvePage(targetPage);
            this._currentPagePath = targetPage;
            const targetIframe = this.isPinned ? this.pinnedIframe : this.iframe;
            this._applyRenderTarget(targetIframe, target, targetPage);
        } catch (error) {
            Logger.warn('[PreviewPanel] Preview navigation failed:', error);
        }
    }

    /**
     * MSG.OPEN_DOC: fetch the document bytes through the provider and open
     * them from the trusted parent context.
     * @param {{href: *, page: *}} data
     */
    async _handlePreviewOpenDocument(data) {
        const currentPage = sanitizePagePath(data.page) || this._currentPagePath || 'index.html';
        const targetPath = this._resolvePreviewHref(data.href, currentPage);
        if (!targetPath) {
            Logger.warn('[PreviewPanel] Rejected preview document request:', data.href);
            return;
        }
        const bytes = await this._provider?.getFile?.(targetPath);
        if (!bytes) {
            Logger.warn(`[PreviewPanel] Document not found in preview: ${targetPath}`);
            return;
        }
        this._openDocumentBytes(targetPath, bytes);
    }

    /**
     * Open document bytes outside the preview: PDFs render in a PDF.js
     * wrapper tab (browsers refuse the native viewer for sandbox-adjacent
     * content), everything else opens as a blob URL tab.
     * @param {string} targetPath
     * @param {Uint8Array} bytes
     */
    _openDocumentBytes(targetPath, bytes) {
        const ext = targetPath.split('.').pop()?.toLowerCase() || '';
        const mime = documentMimeFor(targetPath);
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
    }

    /**
     * Subscribe to Yjs changes for auto-refresh
     * Uses both structure changes and ydoc.on('update') to capture ALL changes
     * including text edits in iDevices, titles, and collaborative updates
     */
    subscribeToChanges() {
        // Idempotent: init() calls this before the project's Yjs bridge exists
        // (projectManager.load() runs loadInterface() before initializeYjs()),
        // so the first call bails; open()/pin() call it again once the bridge is
        // ready. Guard against double-subscribing after it succeeds once.
        if (this._onYdocUpdate || this._unsubscribeStructure) return;

        const project = eXeLearning?.app?.project;
        if (!project?._yjsEnabled || !project._yjsBridge) {
            Logger.log('[PreviewPanel] Yjs not ready yet; auto-refresh will subscribe on preview open');
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

        // Ensure auto-refresh is wired (the Yjs bridge is ready by the time the
        // user opens the preview; init() ran before it existed).
        this.subscribeToChanges();

        // Generate and load preview
        await this.refresh();
        this._scheduleEmbedReflow();

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
        // The panel only slides away (transform), so the iframe keeps a live rect and
        // the relay's video overlay would otherwise stay floating over the editor.
        this._mediaHost?.hideEmbedOverlays();

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
        // Drop overlays over the slide-out iframe; refresh() rebuilds them over the
        // pinned iframe once it reloads.
        this._mediaHost?.hideEmbedOverlays();

        // Enable pinned mode
        this.isPinned = true;
        this.isOpen = true;

        const workarea = document.getElementById('workarea');
        workarea?.setAttribute('data-preview-pinned', 'true');

        // Ensure auto-refresh is wired (see open()).
        this.subscribeToChanges();

        // Refresh content in pinned iframe
        await this.refresh();
        this._scheduleEmbedReflow();

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
        // Drop overlays over the pinned iframe; refresh() rebuilds them over the
        // slide-out iframe once it reloads.
        this._mediaHost?.hideEmbedOverlays();

        // Open slide-out panel with current content
        this.isOpen = true;
        this.panel?.classList.add('active');
        this.overlay?.classList.add('active');

        // Refresh content
        this.refresh();
        this._scheduleEmbedReflow();

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
     * Refresh the preview content through the active transport provider.
     *
     * The client generates the preview files (unchanged), the provider syncs
     * them to its transport, and the panel renders the current page. There is
     * NO cross-transport fallback: a provider failure surfaces as an error
     * state, never a silent downgrade to a same-origin preview.
     */
    async refresh() {
        if (this.isLoading) return;
        if (!this._provider) {
            this.showError(_('Preview is not available in this environment.'));
            return;
        }

        this.isLoading = true;
        this.showLoadingState();

        try {
            const app = eXeLearning?.app;
            // Legacy SW transport: wait for the Service Worker registration.
            if (this._isLegacyServiceWorkerTransport() && typeof app?.waitForPreviewServiceWorker === 'function') {
                if (!navigator.serviceWorker?.controller) {
                    try {
                        await app.waitForPreviewServiceWorker();
                    } catch {
                        /* SW not available */
                    }
                }
            }

            const result = await this._generatePreviewFiles();
            if (!result.success || !result.files) {
                throw new Error(result.error || 'Failed to generate preview files');
            }

            await this._syncProvider(result.files);

            const pagePath = this._currentPagePath ?? 'index.html';
            const target = await this._provider.resolvePage(pagePath);
            const targetIframe = this.isPinned ? this.pinnedIframe : this.iframe;
            this._applyRenderTarget(targetIframe, target, pagePath);

            Logger.log(`[PreviewPanel] Preview refreshed via ${this._provider.mode} transport`);
        } catch (error) {
            Logger.error('[PreviewPanel] Error generating preview:', error);
            this.showError(error.message);
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    /**
     * Sync generated files into the provider, transparently recreating an
     * expired backend session (the client remains the source of truth).
     * @param {Object<string, ArrayBuffer|Uint8Array|string>} files
     */
    async _syncProvider(files) {
        if (!this._session) {
            this._session = await this._provider.prepare(files);
            return;
        }
        try {
            await this._provider.update(files);
        } catch (error) {
            if (error instanceof PreviewSessionExpiredError) {
                Logger.log('[PreviewPanel] Preview session expired, recreating');
                this._session = await this._provider.prepare(files);
                return;
            }
            throw error;
        }
    }

    /**
     * Apply a provider render target to an iframe. URL targets set src (and
     * clear any srcdoc); srcdoc targets set srcdoc (and clear src). The
     * sandbox is (re)asserted first so an opaque transport can never load
     * same-origin.
     * @param {HTMLIFrameElement} iframe
     * @param {{kind: 'url', url: string} | {kind: 'srcdoc', html: string}} target
     * @param {string} pagePath
     */
    _applyRenderTarget(iframe, target, pagePath) {
        if (!iframe) {
            Logger.error('[PreviewPanel] No iframe available');
            return;
        }
        this._applySandboxForProvider(iframe);
        this._currentPagePath = pagePath;
        iframe.dataset.previewPage = pagePath;

        if (target.kind === 'srcdoc') {
            iframe.removeAttribute('src');
            iframe.srcdoc = target.html;
        } else {
            iframe.removeAttribute('srcdoc');
            iframe.src = target.url;
        }
    }

    /**
     * Generate preview export files (shared by every transport).
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
     * Whether a MessageEvent source is one of the preview iframes.
     *
     * The preview renders untrusted authored content, so a null/foreign
     * source is rejected (unlike the old blob path, a null source is NOT
     * trusted). Origin is deliberately not checked: it is 'null' for opaque
     * frames; the source-window identity is the browser-enforced, unforgeable
     * signal.
     * @param {*} source
     * @returns {boolean}
     * @private
     */
    _isPreviewIframeSource(source) {
        if (!source) return false;
        return source === (this.iframe?.contentWindow || null) || source === (this.pinnedIframe?.contentWindow || null);
    }

    /**
     * Open the preview in a new browser tab.
     *
     * Only available for URL-based transports (the response CSP keeps the
     * standalone document opaque). The srcdoc transport has no URL, so the
     * button is hidden via capabilities and this becomes a no-op.
     */
    async extractToNewTab() {
        try {
            if (!this._provider || !this._session) {
                Logger.warn('[PreviewPanel] Extract-to-new-tab is unavailable: no active preview');
                return;
            }

            Logger.log('[PreviewPanel] Extracting preview to new tab...');
            const result = await this._generatePreviewFiles();
            if (result.success && result.files) {
                await this._syncProvider(result.files);
            }

            // Open the same-origin "preview host" page (public/preview-tab.html) rather
            // than the content directly. A top-level opaque document has no parent, so the
            // embed shim self-disables and external video is blocked; the host page frames
            // the opaque content and runs the relay as the trusted parent, so video plays
            // in-place. HTTP frames the capability URL via ?session; srcdoc has no URL, so
            // the editor pushes rendered page HTML to the host tab (handoff below). The
            // legacy service-worker transport is not opaque and keeps its /viewer URL.
            const base = this._basePath || '';
            const mode = this._provider.mode;
            let target;
            if (mode === 'http') {
                target = `${base}/preview-tab.html?session=${encodeURIComponent(this._session.id)}`;
            } else if (mode === 'srcdoc') {
                target = `${base}/preview-tab.html`;
            } else {
                target = this._session.entryUrl;
            }
            if (!target) {
                Logger.warn('[PreviewPanel] Extract-to-new-tab is unavailable for this transport');
                return;
            }

            const url = new URL(target, window.location.href).href;
            const newTab = window.open(url, '_blank');
            if (newTab) {
                this._popupWindow = newTab;
                if (mode === 'srcdoc') {
                    this._startPreviewTabHandoff(newTab);
                }
                this._setupPopupMonitor();
                Logger.log('[PreviewPanel] Preview opened in new tab');
            } else if (mode !== 'srcdoc') {
                // Only the self-sufficient URL transports can fall back to a link click;
                // srcdoc needs the window handle to push content.
                Logger.warn('[PreviewPanel] Popup blocked - trying fallback');
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.click();
            } else {
                Logger.warn('[PreviewPanel] Popup blocked - cannot open the preview in a new tab');
            }
        } catch (error) {
            Logger.error('[PreviewPanel] Error extracting to new tab:', error);
        }
    }

    /**
     * Feed the opaque preview-host tab (srcdoc transport) with rendered page HTML.
     * The tab has no project in memory, so this editor — which owns the preview
     * provider — resolves each page and pushes the HTML; the tab forwards navigation
     * and document-open requests back here. Same-origin postMessage only.
     * @param {Window} popup
     */
    _startPreviewTabHandoff(popup) {
        this._teardownPreviewTabHandoff();
        const origin = window.location.origin;
        let popupPage = this._currentPagePath || 'index.html';

        const sendRender = async (page) => {
            try {
                const target = await this._provider?.resolvePage(page);
                if (target?.kind === 'srcdoc' && popup && !popup.closed) {
                    popup.postMessage({ type: 'exe-preview-tab:render', html: target.html }, origin);
                }
            } catch (error) {
                Logger.warn('[PreviewPanel] Preview-tab render failed:', error);
            }
        };

        const onMessage = (event) => {
            if (event.origin !== origin || event.source !== popup) return;
            const data = event.data;
            if (!data || typeof data.type !== 'string') return;
            if (data.type === 'exe-preview-tab:ready') {
                sendRender(popupPage);
                return;
            }
            if (data.type === 'exe-preview-tab:forward' && data.payload && typeof data.payload.type === 'string') {
                const payload = data.payload;
                if (payload.type === MSG.NAVIGATE) {
                    const targetPage = this._resolvePreviewHref(
                        payload.href,
                        sanitizePagePath(payload.page) || popupPage,
                    );
                    if (
                        targetPage &&
                        (typeof this._provider?.hasPage !== 'function' || this._provider.hasPage(targetPage))
                    ) {
                        popupPage = targetPage;
                        sendRender(targetPage);
                    }
                } else if (payload.type === MSG.OPEN_DOC) {
                    this._handlePreviewOpenDocument(payload);
                }
            }
        };
        window.addEventListener('message', onMessage);
        this._previewTabHandoff = onMessage;
    }

    /**
     * Re-place the embed video overlays once the panel finishes sliding/pinning. The
     * panel moves via a CSS transform, which fires no scroll/resize, so an overlay
     * placed while the panel is still animating would sit at the wrong X. Reflowing
     * after the transform settles snaps it back over its embed. Timers (not
     * transitionend) so it works with reduced motion / no transition too, and a
     * late-arriving overlay created after the animation is already correctly placed.
     */
    _scheduleEmbedReflow() {
        const run = () => this._mediaHost?.reflowEmbedOverlays();
        setTimeout(run, 400);
        setTimeout(run, 900);
    }

    /** Remove the preview-host tab handoff listener (popup closed / panel destroyed). */
    _teardownPreviewTabHandoff() {
        if (this._previewTabHandoff) {
            window.removeEventListener('message', this._previewTabHandoff);
            this._previewTabHandoff = null;
        }
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
     * Show an error message in the preview iframe.
     *
     * Rendered via srcdoc (trusted, script-free markup): an opaque-origin
     * iframe cannot load a parent-created blob: URL, so the old blob path
     * would leave a blank frame.
     * @param {string} message - Error message
     */
    showError(message) {
        const errorHtml = `<!DOCTYPE html>
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
                    <h2>${this.escapeHtml(_('Preview Error'))}</h2>
                    <p>${this.escapeHtml(message)}</p>
                </div>
            </body>
            </html>`;
        const targetIframe = this.isPinned ? this.pinnedIframe : this.iframe;
        if (!targetIframe) {
            Logger.error('[PreviewPanel] No iframe available');
            return;
        }
        this._applySandboxForProvider(targetIframe);
        targetIframe.removeAttribute('src');
        targetIframe.srcdoc = errorHtml;
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
        this._teardownPreviewTabHandoff();

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

        // Remove the dispose lifecycle handler
        if (this._pageHideHandler) {
            window.removeEventListener('pagehide', this._pageHideHandler);
            this._pageHideHandler = null;
        }

        // Detach the external-media relay from the preview iframes
        this._mediaHost?.detachAll();
        this._mediaHost = null;

        // Dispose the preview session (no keepalive: destroy is synchronous teardown)
        this._provider?.dispose()?.catch?.(() => {});
        this._session = null;

        Logger.log('[PreviewPanel] Destroyed');
    }
}

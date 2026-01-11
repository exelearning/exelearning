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
        Logger.log('[PreviewPanel] Initialized');
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
                        alert(_('ELPX export not available. Please save your project first.'));
                    }
                } catch (err) {
                    Logger.error('[PreviewPanel] ELPX export failed:', err);
                    alert(_('Error generating ELPX file:') + ' ' + err.message);
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

            // Handle HTML link resolution requests forwarded from preview iframe
            // The preview iframe receives messages from embedded HTML iframes and forwards them here
            if (event.data?.type === 'exe-resolve-html-link-forward') {
                const { requestId, href, baseFolder } = event.data;
                Logger.log(`[PreviewPanel] Received HTML link resolution request: ${href}`);

                try {
                    const assetManager = eXeLearning?.app?.project?._yjsBridge?.assetManager;
                    if (!assetManager) {
                        throw new Error('AssetManager not available');
                    }

                    // Find the linked HTML asset by relative path
                    const linkedAsset = assetManager.findAssetByRelativePath(baseFolder, href);
                    if (!linkedAsset) {
                        throw new Error(`Asset not found: ${href} from ${baseFolder}`);
                    }

                    // Resolve the linked HTML with all its internal assets
                    const resolvedUrl = await assetManager.resolveHtmlWithAssets(linkedAsset.id);
                    if (!resolvedUrl) {
                        throw new Error(`Failed to resolve HTML asset: ${linkedAsset.id}`);
                    }

                    // Send resolved URL back to the preview iframe
                    event.source.postMessage({
                        type: 'exe-html-link-resolved',
                        requestId: requestId,
                        resolvedUrl: resolvedUrl
                    }, '*');

                    Logger.log(`[PreviewPanel] Resolved HTML link: ${href} -> blob URL`);
                } catch (err) {
                    Logger.error('[PreviewPanel] Failed to resolve HTML link:', err);
                    // Send failure response
                    event.source.postMessage({
                        type: 'exe-html-link-resolved',
                        requestId: requestId,
                        resolvedUrl: null,
                        error: err.message
                    }, '*');
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
     * Extract preview to a new browser tab
     * Generates a standalone HTML preview and opens it in a new tab
     */
    async extractToNewTab() {
        try {
            Logger.log('[PreviewPanel] Extracting preview to new tab...');

            // Generate HTML using the standalone exporter (different from inline preview)
            const html = await this.generateStandalonePreviewHtml();
            if (!html) {
                Logger.error('[PreviewPanel] Failed to generate standalone preview HTML');
                return;
            }

            // Create a blob URL for the HTML
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const blobUrl = URL.createObjectURL(blob);

            // Open in new tab
            const newTab = window.open(blobUrl, '_blank');

            if (newTab) {
                Logger.log('[PreviewPanel] Preview opened in new tab');
                // Revoke blob URL after a delay to allow the new tab to load
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 5000);
            } else {
                Logger.warn('[PreviewPanel] Popup blocked - trying fallback');
                // Fallback: create a download link
                const a = document.createElement('a');
                a.href = blobUrl;
                a.target = '_blank';
                a.click();
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 5000);
            }
        } catch (error) {
            Logger.error('[PreviewPanel] Error extracting to new tab:', error);
        }
    }

    /**
     * Generate standalone preview HTML (for new tab extraction)
     * Unlike inline preview, this version converts all assets to data URLs
     * so the page works independently without the parent window
     * @returns {Promise<string|null>} HTML string or null on error
     */
    async generateStandalonePreviewHtml() {
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
        const resourceFetcher = yjsBridge.resourceFetcher || null;

        // Check if we're in static mode (no remote storage capability)
        const capabilities = eXeLearning.app?.capabilities;
        const isStaticMode = !capabilities?.storage?.remote;

        // Get the static base path from current URL (handles subdirectory deployments)
        // e.g., /exelearning/pr-preview/pr-17/ -> /exelearning/pr-preview/pr-17
        const staticBasePath = isStaticMode
            ? window.location.pathname.replace(/\/?(index\.html)?$/, '')
            : '';

        // Get theme URL (same logic as generatePreviewHtml)
        const selectedTheme = eXeLearning.app?.themes?.selected;
        let themeUrl = selectedTheme?.path || null;
        let userThemeCss = null;
        let userThemeJs = null;

        // Check if it's a user theme (imported from ELPX, stored in IndexedDB)
        const isUserTheme = selectedTheme?.isUserTheme || themeUrl?.startsWith('user-theme://');

        if (isUserTheme) {
            // For user themes, get the CSS and JS content directly from ResourceFetcher
            try {
                const themeName = selectedTheme?.id || themeUrl?.replace('user-theme://', '');
                if (themeName && resourceFetcher) {
                    let themeFiles = resourceFetcher.getUserTheme(themeName);
                    if (!themeFiles && resourceFetcher.getUserThemeAsync) {
                        themeFiles = await resourceFetcher.getUserThemeAsync(themeName);
                    }

                    if (themeFiles) {
                        // Get CSS
                        const styleCssBlob = themeFiles.get('style.css') || themeFiles.get(`${themeName}/style.css`);
                        if (styleCssBlob) {
                            let cssText = await styleCssBlob.text();
                            cssText = await this.processUserThemeCssUrls(cssText, themeFiles, themeName);
                            userThemeCss = cssText;
                            Logger.log(`[PreviewPanel] Loaded user theme CSS for standalone preview (${userThemeCss.length} chars)`);
                        }

                        // Get JS
                        const styleJsBlob = themeFiles.get('style.js') || themeFiles.get(`${themeName}/style.js`);
                        if (styleJsBlob) {
                            userThemeJs = await styleJsBlob.text();
                            Logger.log(`[PreviewPanel] Loaded user theme JS for standalone preview (${userThemeJs.length} chars)`);
                        }
                    }
                }
            } catch (error) {
                Logger.warn('[PreviewPanel] Failed to load user theme CSS/JS for standalone:', error);
            }
            themeUrl = null;
        } else if (themeUrl && !themeUrl.startsWith('http') && !themeUrl.startsWith('blob:') && !themeUrl.startsWith('exe:')) {
            // Make theme URL absolute for standalone preview (blob URL context)
            const cleanThemeUrl = themeUrl.startsWith('./') ? themeUrl.slice(2) :
                                  themeUrl.startsWith('/') ? themeUrl.slice(1) : themeUrl;
            const base = isStaticMode
                ? `${window.location.origin}${staticBasePath}`
                : window.location.origin;
            themeUrl = `${base}/${cleanThemeUrl}`;
        }

        const previewOptions = {
            baseUrl: window.location.origin,
            // basePath MUST start with '/' to trigger isPreviewMode=true in the exporter
            basePath: isStaticMode ? '/' : (eXeLearning.app.config?.basePath || '/'),
            version: window.eXeLearning?.config?.version || 'v1.0.0',
            isStaticMode: isStaticMode,
            themeUrl: themeUrl,
            userThemeCss: userThemeCss,
            userThemeJs: userThemeJs,
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

        // In static mode, convert relative URLs to absolute URLs
        // This is essential for standalone preview (new tab) to work correctly
        // because blob URLs cannot resolve relative paths
        let generatedHtml = result.html;
        if (isStaticMode) {
            const fullBase = `${window.location.origin}${staticBasePath}`;
            // Convert URLs starting with / to absolute URLs
            // Matches: href="/path" or src="/path" (but not href="//..." or href="http...")
            generatedHtml = generatedHtml.replace(
                /((?:href|src)=["'])(\/(?!\/|[a-z]+:))([^"']+)(["'])/gi,
                (match, prefix, slash, path, quote) => {
                    // /v1/libs/... -> fullBase/libs/... (strip version prefix if present)
                    let cleanPath = path;
                    cleanPath = cleanPath.replace(/^v[^/]*\//, '');
                    return `${prefix}${fullBase}/${cleanPath}${quote}`;
                }
            );
            Logger.log('[PreviewPanel] Converted relative URLs to absolute for standalone preview, base:', fullBase);
        }

        // Add MIME types to media elements
        let html = typeof window.addMediaTypes === 'function'
            ? window.addMediaTypes(generatedHtml)
            : generatedHtml;

        // Simplify MediaElement.js structures
        if (typeof window.simplifyMediaElements === 'function') {
            html = window.simplifyMediaElements(html);
        }

        // Resolve HTML iframes with their internal assets (CSS, JS, images) as data URLs
        // This must happen BEFORE resolveAssetUrlsAsync so the HTML content is self-contained
        html = await this.resolveHtmlIframeAssetsForStandalone(html);

        // For standalone preview, convert ALL assets to data URLs (including PDFs)
        // so the page works independently without needing the parent window
        if (typeof window.resolveAssetUrlsAsync === 'function') {
            try {
                html = await window.resolveAssetUrlsAsync(html, {
                    convertBlobUrls: true,      // Convert to data URLs for portability
                    convertIframeBlobUrls: true, // Include iframe PDFs
                    skipIframeSrc: false         // Don't skip iframes - convert them too
                });
            } catch (error) {
                Logger.warn('[PreviewPanel] Failed to resolve asset URLs for standalone:', error);
            }
        }

        return html;
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
        // Check if we're in static mode (no remote storage capability)
        const capabilities = eXeLearning.app?.capabilities;
        const isStaticMode = !capabilities?.storage?.remote;
        let themeUrl = selectedTheme?.path || null;
        let userThemeCss = null;
        let userThemeJs = null;

        // For preview (loaded via blob URL), we ALWAYS need absolute URLs
        // because blob URLs cannot resolve relative paths.
        // In static mode:
        //   - Files may be in a subdirectory (e.g., /exelearning/pr-preview/pr-17/)
        //   - We need the full base including pathname, not just origin
        //   - basePath should be the pathname directory
        // In server mode:
        //   - Files use versioned paths (/v1/libs/bootstrap.min.css)
        //   - baseUrl is origin, basePath may be set

        // Get the static base path from current URL (handles subdirectory deployments)
        // e.g., /exelearning/pr-preview/pr-17/ -> /exelearning/pr-preview/pr-17
        const staticBasePath = isStaticMode
            ? window.location.pathname.replace(/\/?(index\.html)?$/, '')
            : '';

        // Check if it's a user theme (imported from ELPX, stored in IndexedDB)
        // User themes use the 'user-theme://' pseudo-protocol which isn't a valid HTTP URL
        const isUserTheme = selectedTheme?.isUserTheme || themeUrl?.startsWith('user-theme://');

        if (isUserTheme) {
            // For user themes, get the CSS and JS content directly from ResourceFetcher
            // and pass them as inline styles/scripts to the exporter
            console.log(`[PreviewPanel] Detected USER THEME, loading CSS/JS inline...`);
            try {
                const themeName = selectedTheme?.id || themeUrl?.replace('user-theme://', '');
                console.log(`[PreviewPanel] Theme name: ${themeName}, resourceFetcher available: ${!!resourceFetcher}`);
                if (themeName && resourceFetcher) {
                    // Try async method that fetches from IndexedDB if needed
                    let themeFiles = resourceFetcher.getUserTheme(themeName);
                    console.log(`[PreviewPanel] getUserTheme sync result: ${themeFiles ? themeFiles.size + ' files' : 'null'}`);
                    if (!themeFiles && resourceFetcher.getUserThemeAsync) {
                        themeFiles = await resourceFetcher.getUserThemeAsync(themeName);
                        console.log(`[PreviewPanel] getUserThemeAsync result: ${themeFiles ? themeFiles.size + ' files' : 'null'}`);
                    }

                    if (themeFiles) {
                        // Find style.css in theme files
                        const styleCssBlob = themeFiles.get('style.css') || themeFiles.get(`${themeName}/style.css`);
                        console.log(`[PreviewPanel] style.css found: ${!!styleCssBlob}`);
                        if (styleCssBlob) {
                            let cssText = await styleCssBlob.text();
                            // Process CSS to convert url() references to data URLs
                            // (fonts, icons, images referenced in CSS won't load without this)
                            cssText = await this.processUserThemeCssUrls(cssText, themeFiles, themeName);
                            userThemeCss = cssText;
                            console.log(`[PreviewPanel] Loaded user theme CSS for '${themeName}' (${userThemeCss.length} chars)`);
                        }

                        // Find style.js in theme files (handles togglers, dark mode, etc.)
                        const styleJsBlob = themeFiles.get('style.js') || themeFiles.get(`${themeName}/style.js`);
                        console.log(`[PreviewPanel] style.js found: ${!!styleJsBlob}`);
                        if (styleJsBlob) {
                            userThemeJs = await styleJsBlob.text();
                            console.log(`[PreviewPanel] Loaded user theme JS for '${themeName}' (${userThemeJs.length} chars)`);
                        }
                    }
                }
            } catch (error) {
                console.error('[PreviewPanel] Failed to load user theme CSS/JS:', error);
            }
            themeUrl = null; // Don't use invalid user-theme:// URL
        } else if (themeUrl && !themeUrl.startsWith('http') && !themeUrl.startsWith('blob:') && !themeUrl.startsWith('exe:')) {
            // Make theme URL absolute for blob URL context
            // Remove leading ./ if present and make absolute
            const cleanThemeUrl = themeUrl.startsWith('./') ? themeUrl.slice(2) :
                                  themeUrl.startsWith('/') ? themeUrl.slice(1) : themeUrl;
            const base = isStaticMode
                ? `${window.location.origin}${staticBasePath}`
                : window.location.origin;
            themeUrl = `${base}/${cleanThemeUrl}`;
        }

        const previewOptions = {
            // Always use absolute URLs for preview (blob URL context)
            baseUrl: window.location.origin,
            // basePath MUST start with '/' to trigger isPreviewMode=true in the exporter
            // This ensures asset:// URLs are preserved (not converted to server paths)
            // and will be resolved to blob URLs from IndexedDB by resolveAssetUrlsAsync
            basePath: isStaticMode ? '/' : (eXeLearning.app.config?.basePath || '/'),
            version: window.eXeLearning?.config?.version || 'v1.0.0',
            isStaticMode: isStaticMode,
            themeUrl: themeUrl, // Absolute theme URL (e.g., 'http://localhost:8081/v1/site-files/themes/chiquito/')
            userThemeCss: userThemeCss, // Inline CSS for user themes (from IndexedDB)
            userThemeJs: userThemeJs, // Inline JS for user themes (from IndexedDB)
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

        // In static mode, the exporter generates URLs with basePath='/'
        // These need to be converted to absolute URLs for blob URL context
        // Important: Use full base path including pathname for subdirectory deployments
        let generatedHtml = result.html;
        if (isStaticMode) {
            const fullBase = `${window.location.origin}${staticBasePath}`;
            // Convert URLs starting with / to absolute URLs
            // Matches: href="/path" or src="/path" (but not href="//..." or href="http...")
            generatedHtml = generatedHtml.replace(
                /((?:href|src)=["'])(\/(?!\/|[a-z]+:))([^"']+)(["'])/gi,
                (match, prefix, slash, path, quote) => {
                    // /v1/libs/... -> fullBase/libs/... (strip version prefix if present)
                    // /libs/... -> fullBase/libs/...
                    let cleanPath = path;
                    // Remove version prefix if present (e.g., /v1/, /v0.0.0-alpha/)
                    cleanPath = cleanPath.replace(/^v[^/]*\//, '');
                    return `${prefix}${fullBase}/${cleanPath}${quote}`;
                }
            );
            Logger.log('[PreviewPanel] Converted relative URLs to absolute for static mode, base:', fullBase);
        }

        // Add MIME types to media elements BEFORE resolving URLs
        // (while asset:// URLs still contain filename with extension)
        let html = typeof window.addMediaTypes === 'function'
            ? window.addMediaTypes(generatedHtml)
            : generatedHtml;

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

        // Resolve HTML iframes with asset:// URLs
        // (similar to PDF handling, but processes relative URLs in the HTML content)
        html = await this.resolveHtmlIframeAssets(html);

        // Inject script to handle PDF asset:// URLs inside the preview
        // The script will:
        // 1. Find PDF iframes with asset:// URLs
        // 2. Replace them with clickable cards
        // 3. On click, fetch asset data from parent window's AssetManager (IndexedDB)
        // 4. Create blob URL in preview's context and open in popup
        html = this.injectPdfBlobUrlConverter(html);

        // Inject script to handle HTML link navigation inside embedded iframes
        // When a user clicks a relative link inside an HTML iframe, the iframe's
        // injected script sends postMessage to window.parent (the preview iframe).
        // This handler receives the message and forwards to main window for resolution.
        html = this.injectHtmlLinkHandler(html);

        return html;
    }

    /**
     * Resolve HTML iframes with asset:// URLs by pre-processing the HTML content
     * and resolving all relative URLs within the HTML file.
     *
     * This is needed because HTML files from extracted ZIPs have relative URLs
     * (e.g., ./libs/jquery.min.js) that can't be resolved in the blob:// context.
     *
     * @param {string} html - Preview HTML content
     * @returns {Promise<string>} HTML with resolved iframe URLs
     */
    async resolveHtmlIframeAssets(html) {
        const assetManager = eXeLearning?.app?.project?._yjsBridge?.assetManager;
        if (!assetManager) {
            Logger.warn('[PreviewPanel] AssetManager not available for HTML iframe resolution');
            return html;
        }

        // Find all iframes with asset:// URLs that point to HTML files
        const iframePattern = /<iframe([^>]*)src=["'](asset:\/\/[^"']+)["']([^>]*)>/gi;
        const matches = [...html.matchAll(iframePattern)];

        if (matches.length === 0) {
            return html;
        }

        let result = html;

        for (const match of matches) {
            const [fullMatch, beforeSrc, assetUrl, afterSrc] = match;

            // Extract asset ID from URL: asset://uuid or asset://uuid.ext
            const assetIdMatch = assetUrl.match(/asset:\/\/([a-f0-9-]+)/i);
            if (!assetIdMatch) continue;

            const assetId = assetIdMatch[1];

            // Check if this asset is an HTML file
            const metadata = assetManager.getAssetMetadata(assetId);
            if (!metadata) continue;

            const isHtml = assetManager._isHtmlAsset(metadata.mime, metadata.filename);
            if (!isHtml) continue;

            // Resolve the HTML with all its relative URLs
            try {
                const resolvedBlobUrl = await assetManager.resolveHtmlWithAssets(assetId);
                if (resolvedBlobUrl) {
                    // Replace the iframe src with the resolved blob URL
                    // Keep the original asset:// URL in data-asset-src for saving
                    const newIframe = `<iframe${beforeSrc}src="${resolvedBlobUrl}" data-asset-src="${assetUrl}"${afterSrc}>`;
                    result = result.replace(fullMatch, newIframe);
                    Logger.log(`[PreviewPanel] Resolved HTML iframe: ${assetId} -> ${resolvedBlobUrl.substring(0, 30)}...`);
                }
            } catch (error) {
                Logger.warn(`[PreviewPanel] Failed to resolve HTML iframe ${assetId}:`, error);
            }
        }

        return result;
    }

    /**
     * Resolve HTML iframes for standalone preview (using data URLs instead of blob URLs).
     *
     * For standalone export (open in new tab), we need all assets as data URLs
     * so the page works independently. This method resolves HTML iframes by:
     * 1. Getting the HTML content with all internal assets (CSS, JS, images) resolved
     * 2. Converting the resolved HTML to a data URL
     * 3. Replacing the iframe src with the data URL
     *
     * @param {string} html - Preview HTML content
     * @returns {Promise<string>} HTML with resolved iframe URLs as data URLs
     */
    async resolveHtmlIframeAssetsForStandalone(html) {
        const assetManager = eXeLearning?.app?.project?._yjsBridge?.assetManager;
        if (!assetManager) {
            Logger.warn('[PreviewPanel] AssetManager not available for standalone HTML iframe resolution');
            return html;
        }

        // Find all iframes with asset:// URLs that point to HTML files
        const iframePattern = /<iframe([^>]*)src=["'](asset:\/\/[^"']+)["']([^>]*)>/gi;
        const matches = [...html.matchAll(iframePattern)];

        if (matches.length === 0) {
            return html;
        }

        let result = html;

        for (const match of matches) {
            const [fullMatch, beforeSrc, assetUrl, afterSrc] = match;

            // Extract asset ID from URL: asset://uuid or asset://uuid.ext
            const assetIdMatch = assetUrl.match(/asset:\/\/([a-f0-9-]+)/i);
            if (!assetIdMatch) continue;

            const assetId = assetIdMatch[1];

            // Check if this asset is an HTML file
            const metadata = assetManager.getAssetMetadata(assetId);
            if (!metadata) continue;

            const isHtml = assetManager._isHtmlAsset(metadata.mime, metadata.filename);
            if (!isHtml) continue;

            // Resolve the HTML with all its relative URLs as data URLs
            try {
                const resolvedHtml = await assetManager.resolveHtmlWithAssetsAsDataUrls(assetId);
                if (resolvedHtml) {
                    // Use srcdoc instead of data URL to avoid Chrome's 2MB data URL limit
                    // srcdoc has no size limit and works when the HTML is saved to disk
                    // We need to escape the HTML for use in an attribute value
                    const escapedHtml = resolvedHtml
                        .replace(/&/g, '&amp;')
                        .replace(/"/g, '&quot;');

                    // Replace the iframe src with srcdoc - remove the src attribute and add srcdoc
                    const newIframe = `<iframe${beforeSrc}srcdoc="${escapedHtml}"${afterSrc}>`;
                    result = result.replace(fullMatch, newIframe);
                    Logger.log(`[PreviewPanel] Resolved HTML iframe for standalone: ${assetId} -> srcdoc (${resolvedHtml.length} bytes)`);
                }
            } catch (error) {
                Logger.warn(`[PreviewPanel] Failed to resolve HTML iframe for standalone ${assetId}:`, error);
            }
        }

        return result;
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
                    // Extract asset ID from asset:// URL
                    // Handles multiple formats:
                    // - New format: asset://uuid.ext (e.g., asset://abc123.pdf)
                    // - Legacy format: asset://uuid/filename (e.g., asset://abc123/doc.pdf)
                    var path = src.replace('asset://', '');
                    var uuidMatch = path.match(/^([a-f0-9-]{36})(?:\\.[a-z0-9]+)?$/i);
                    var legacyMatch = path.match(/^([a-f0-9-]+)\\//);
                    var assetId = uuidMatch ? uuidMatch[1] : (legacyMatch ? legacyMatch[1] : null);
                    if (!assetId) continue;

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
     * Inject a script that handles HTML link navigation in embedded iframes.
     *
     * ## Why this is needed
     *
     * When an HTML file is embedded in an iframe (from extracted ZIP), it may contain
     * navigation links to other HTML pages in the same package. The injected link handler
     * script (in AssetManager._generateLinkHandlerScript) intercepts these clicks and
     * sends a postMessage to request navigation.
     *
     * However, in preview mode:
     * - The preview panel loads content as a blob URL for isolation
     * - The embedded HTML iframe's window.parent is the preview iframe (blob URL), not main window
     * - The listener in asset_url_resolver.js is in main window, not preview iframe
     *
     * Solution: Inject a handler in the preview that:
     * 1. Receives 'exe-resolve-html-link' from embedded iframes
     * 2. Forwards to main window which has access to AssetManager
     * 3. Receives resolved blob URL and updates the embedded iframe
     *
     * @param {string} html - HTML content
     * @returns {string} HTML with injected handler
     */
    injectHtmlLinkHandler(html) {
        // Get translated warning message for HTML asset links in preview
        // Using typeof check since _() may not be available in all contexts
        const warningMessage = typeof window._ === 'function'
            ? window._('HTML websites from the Resources folder cannot be navigated in preview. Please export the project to view this content correctly.')
            : 'HTML websites from the Resources folder cannot be navigated in preview. Please export the project to view this content correctly.';

        // Escape the message for safe embedding in JavaScript string
        const escapedWarningMessage = warningMessage.replace(/'/g, "\\'").replace(/\n/g, '\\n');

        const handlerScript = `
<script>
(function() {
    // Map to track pending resolve requests
    var pendingResolves = {};
    var resolveIdCounter = 0;

    // Warning message for HTML asset links in preview (translated from main window)
    var htmlLinkWarningMessage = '${escapedWarningMessage}';

    // Intercept clicks on ALL HTML asset links in preview
    // Internal navigation won't work because blob URLs can't resolve relative paths
    // Use capture phase to intercept before navigation happens
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a[href]');
        if (!link) return;

        var href = link.getAttribute('href');
        var dataAssetUrl = link.getAttribute('data-asset-url');

        // Check if it's an HTML asset link
        // In preview, asset:// URLs are resolved to blob:// URLs
        // We detect HTML links by checking the data-asset-url attribute for .html extension
        var isHtmlLink = dataAssetUrl && /\\.html?$/i.test(dataAssetUrl);

        // Block ALL HTML asset links - internal navigation won't work in preview
        if (isHtmlLink) {
            e.preventDefault();
            e.stopPropagation();
            alert(htmlLinkWarningMessage);
        }
    }, true); // Use capture phase

    // Listen for messages from embedded HTML iframes
    window.addEventListener('message', function(event) {
        // Handle link resolution requests from embedded iframes
        if (event.data?.type === 'exe-resolve-html-link') {
            var reqId = 'htmlResolve_' + (++resolveIdCounter);

            // Store the source iframe so we can update it later
            pendingResolves[reqId] = {
                source: event.source,
                href: event.data.href,
                baseFolder: event.data.baseFolder
            };

            // Forward to main window with our request ID
            window.parent.postMessage({
                type: 'exe-resolve-html-link-forward',
                requestId: reqId,
                href: event.data.href,
                assetId: event.data.assetId,
                baseFolder: event.data.baseFolder
            }, '*');
            return;
        }

        // Handle response from main window with resolved URL
        if (event.data?.type === 'exe-html-link-resolved') {
            var reqId = event.data.requestId;
            var pending = pendingResolves[reqId];
            if (!pending) return;

            delete pendingResolves[reqId];

            var resolvedUrl = event.data.resolvedUrl;
            if (!resolvedUrl) {
                console.warn('[PreviewPanel] Failed to resolve HTML link:', pending.href);
                return;
            }

            // Find the iframe that sent the original request and update its src
            // The source is the contentWindow of the embedded iframe
            var iframes = document.querySelectorAll('iframe[data-asset-src], iframe[data-mce-html]');
            for (var i = 0; i < iframes.length; i++) {
                var iframe = iframes[i];
                if (iframe.contentWindow === pending.source) {
                    iframe.src = resolvedUrl;
                    break;
                }
            }
            return;
        }
    });
})();
</script>`;

        // Inject before </body> or at the end
        if (html.includes('</body>')) {
            return html.replace('</body>', handlerScript + '</body>');
        }
        return html + handlerScript;
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
     * Process user theme CSS to convert url() references to data URLs.
     * Theme assets (fonts, icons, images) are stored in IndexedDB and need to be
     * embedded as data URLs for the inline CSS to work in the preview.
     *
     * @param {string} cssText - The CSS content
     * @param {Map<string, Blob>} themeFiles - Map of theme file paths to Blobs
     * @param {string} themeName - Theme directory name (for path resolution)
     * @returns {Promise<string>} CSS with url() references converted to data URLs
     */
    async processUserThemeCssUrls(cssText, themeFiles, themeName) {
        // Log available theme files for debugging (use console.log to always show)
        const availableFiles = Array.from(themeFiles.keys());
        console.log(`[PreviewPanel] Theme '${themeName}' files available (${availableFiles.length}):`, availableFiles);

        // Find all url() references in the CSS
        // Matches: url("path"), url('path'), url(path)
        const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi;

        // Collect all unique URLs and their replacements
        const urlReplacements = new Map();
        let match;

        while ((match = urlRegex.exec(cssText)) !== null) {
            const originalUrl = match[0];
            const urlPath = match[2];

            // Skip if already processed, or if it's an absolute URL, data URL, or blob URL
            if (urlReplacements.has(originalUrl)) continue;
            if (urlPath.startsWith('http://') || urlPath.startsWith('https://')) continue;
            if (urlPath.startsWith('data:') || urlPath.startsWith('blob:')) continue;
            if (urlPath.startsWith('#')) continue; // SVG references

            // Normalize the path (remove leading ./ or ../)
            let normalizedPath = urlPath
                .replace(/^\.\//, '')           // ./path -> path
                .replace(/^\.\.\//, '');        // ../path -> path (relative to theme root)

            // Try to find the file in themeFiles with various path combinations
            // Theme CSS references like url(fonts/file.woff2), url(img/icons.png)
            // Files are stored without theme/ prefix: fonts/file.woff2, img/icons.png
            const pathsToTry = [
                normalizedPath,                                    // Direct match: fonts/file.woff2
                `${themeName}/${normalizedPath}`,                  // With theme prefix
                normalizedPath.replace(/^fonts\//, 'fonts/'),      // Ensure fonts/ stays
                normalizedPath.replace(/^img\//, 'img/'),          // Ensure img/ stays
                normalizedPath.replace(/^icons\//, 'icons/'),      // Ensure icons/ stays
                normalizedPath.replace(/^images\//, 'images/'),    // Alternative folder name
            ];

            let blob = null;
            let foundPath = null;
            for (const tryPath of pathsToTry) {
                blob = themeFiles.get(tryPath);
                if (blob) {
                    foundPath = tryPath;
                    break;
                }
            }

            if (blob) {
                try {
                    // Convert blob to data URL
                    const dataUrl = await this.blobToDataUrl(blob);
                    urlReplacements.set(originalUrl, `url("${dataUrl}")`);
                    console.log(`[PreviewPanel] ✓ Converted: ${foundPath}`);
                } catch (error) {
                    console.warn(`[PreviewPanel] ✗ Failed to convert ${urlPath}:`, error);
                }
            } else {
                // Only warn for files that might exist (not external resources)
                const isLikelyMissing = normalizedPath.match(/\.(woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp)$/i);
                if (isLikelyMissing) {
                    console.warn(`[PreviewPanel] ✗ NOT FOUND: "${urlPath}" (normalized: "${normalizedPath}")`);
                }
            }
        }

        // Apply all replacements
        let processedCss = cssText;
        for (const [original, replacement] of urlReplacements) {
            // Use split/join for global replacement (escaping regex special chars)
            processedCss = processedCss.split(original).join(replacement);
        }

        console.log(`[PreviewPanel] Processed ${urlReplacements.size} CSS url() references`);
        return processedCss;
    }

    /**
     * Convert a Blob to a data URL
     * @param {Blob} blob - The blob to convert
     * @returns {Promise<string>} Data URL
     */
    blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
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

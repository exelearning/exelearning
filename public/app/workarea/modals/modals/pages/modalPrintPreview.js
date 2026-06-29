/**
 * Print Preview Overlay
 *
 * Simple fullscreen overlay for print preview (no Bootstrap dependency)
 */
export default class ModalPrintPreview {
    constructor(manager) {
        this.manager = manager;
        this.overlay = document.getElementById('printPreviewOverlay');
        this.iframe = this.overlay?.querySelector('.print-preview-iframe');
        this.loadingEl = this.overlay?.querySelector('.print-preview-loading');
        this.printBtn = this.overlay?.querySelector('.print-preview-print-btn');
        this.closeBtn = this.overlay?.querySelector('.print-preview-close-btn');
        this.blobUrl = null;
    }

    /**
     * Initialize behavior
     */
    behaviour() {
        if (!this.overlay) return;

        // Print button
        this.printBtn?.addEventListener('click', () => {
            this.print();
        });

        // Close button
        this.closeBtn?.addEventListener('click', () => {
            this.close();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.close();
            }
        });
    }

    /**
     * Check if overlay is visible
     */
    isVisible() {
        return this.overlay?.getAttribute('data-visible') === 'true';
    }

    /**
     * Show the print preview
     */
    async show() {
        if (!this.overlay) {
            console.error('[PrintPreview] Overlay element not found');
            return;
        }

        // Show overlay with loading
        this.showLoading(true);
        this.overlay.setAttribute('data-visible', 'true');

        try {
            await this.generatePreview();
        } catch (error) {
            console.error('[PrintPreview] Error:', error);
            this.showError(error.message || 'An error occurred');
        }
    }

    /**
     * Close the overlay
     */
    close() {
        if (this.overlay) {
            this.overlay.setAttribute('data-visible', 'false');
        }
        this.cleanup();
    }

    /**
     * Generate and load the print preview
     */
    async generatePreview() {
        // Check Yjs mode
        if (!eXeLearning.app.project?._yjsEnabled) {
            throw new Error(_('Print preview requires server mode'));
        }

        const yjsBridge = eXeLearning.app.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            throw new Error(_('Document manager not available'));
        }

        console.log('[ModalPrintPreview] yjsBridge available:', !!yjsBridge);
        console.log('[ModalPrintPreview] AssetManager available:', !!yjsBridge?.assetManager);
        if (yjsBridge?.assetManager) {
             console.log('[ModalPrintPreview] AssetManager details:', yjsBridge.assetManager);
        } else {
             console.warn('[ModalPrintPreview] AssetManager is MISSING in yjsBridge');
        }

        // Get generatePrintPreview function
        const generatePrintPreviewFn =
            window.generatePrintPreview || window.SharedExporters?.generatePrintPreview;

        if (typeof generatePrintPreviewFn !== 'function') {
            throw new Error(_('Print preview not available'));
        }

        // Generate preview (use resourceFetcher from yjsBridge, already initialized with bundle manifest)
        const result = await generatePrintPreviewFn(
            yjsBridge.documentManager,
            yjsBridge.resourceFetcher || null,
            {
                // Static mode requires absolute URLs for Blob compatibility
                baseUrl: window.eXeLearning?.config?.isStaticMode 
                    ? window.location.origin 
                    : (window.eXeLearning?.config?.baseURL || window.location.origin),
                basePath: window.eXeLearning?.config?.basePath || '',
                version: window.eXeLearning?.config?.isStaticMode ? '' : (window.eXeLearning?.config?.version || 'v1.0.0'),
            },
            yjsBridge.assetManager || null
        );

        if (!result.success || !result.html) {
            throw new Error(result.error || _('Failed to generate preview'));
        }

        // Resolve asset URLs if available
        const html = result.html;

        // Render the (untrusted) author content in an OPAQUE sandboxed iframe via srcdoc.
        // srcdoc keeps an opaque origin without the cross-origin-blob load problem (a
        // parent-created blob: URL cannot be loaded by an opaque-origin frame). The parent
        // cannot call print() across the opaque boundary, so a tiny in-frame bridge triggers
        // window.print() on a postMessage (the iframe keeps allow-modals only for printing).
        this.cleanup();
        const printBridge =
            '<script>(function(){window.addEventListener("message",function(e){' +
            'if(e&&e.data&&e.data.type==="exe-print"){try{window.focus();}catch(x){}window.print();}});}());<' +
            '/script>';
        const srcdoc = /<\/body>/i.test(html)
            ? html.replace(/<\/body>/i, printBridge + '</body>')
            : html + printBridge;

        // Load into iframe
        if (this.iframe) {
            this.iframe.removeAttribute('src');
            this.iframe.srcdoc = srcdoc;
            this.iframe.onload = () => {
                this.showLoading(false);
            };
        }
    }

    /**
     * Print the preview content
     */
    print() {
        // The print-preview iframe is opaque (no allow-same-origin), so the parent cannot
        // call contentWindow.print() across the boundary. Trigger printing from inside the
        // frame via the injected bridge (see generatePreview()).
        if (this.iframe?.contentWindow) {
            this.iframe.contentWindow.postMessage({ type: 'exe-print' }, '*');
        }
    }

    /**
     * Show or hide loading indicator
     */
    showLoading(show) {
        if (this.loadingEl) {
            this.loadingEl.classList.toggle('hidden', !show);
        }
        if (this.iframe) {
            this.iframe.classList.toggle('hidden', show);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.loadingEl) {
            this.loadingEl.innerHTML = `
                <div class="print-preview-error">
                    <span class="exe-icon">error</span>
                    <p>${message}</p>
                </div>
            `;
        }
        if (this.iframe) {
            this.iframe.classList.add('hidden');
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
        if (this.iframe) {
            this.iframe.removeAttribute('srcdoc');
            this.iframe.src = 'about:blank';
            this.iframe.classList.add('hidden');
        }
        // Reset loading indicator
        if (this.loadingEl) {
            this.loadingEl.classList.remove('hidden');
            this.loadingEl.innerHTML = `
                <div class="spinner-border" role="status"></div>
                <p>${_('Generating preview...')}</p>
            `;
        }
    }
}

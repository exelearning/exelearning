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
            throw new Error(_('Print preview requires Yjs mode'));
        }

        const yjsBridge = eXeLearning.app.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            throw new Error(_('Document manager not available'));
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
                baseUrl: window.eXeLearning?.config?.baseURL || window.location.origin,
                basePath: window.eXeLearning?.config?.basePath || '',
                version: window.eXeLearning?.config?.version || 'v1.0.0',
            }
        );

        if (!result.success || !result.html) {
            throw new Error(result.error || _('Failed to generate preview'));
        }

        // Resolve asset URLs if available
        let html = result.html;
        const assetManager = yjsBridge.assetManager;

        if (assetManager && typeof assetManager.resolveAssetUrlsAsync === 'function') {
            html = await assetManager.resolveAssetUrlsAsync(html);
        }

        // Create blob URL and load into iframe
        this.cleanup();
        const blob = new Blob([html], { type: 'text/html' });
        this.blobUrl = URL.createObjectURL(blob);

        // Load into iframe
        if (this.iframe) {
            this.iframe.src = this.blobUrl;
            this.iframe.onload = () => {
                this.showLoading(false);
            };
        }
    }

    /**
     * Print the preview content
     */
    print() {
        if (this.iframe?.contentWindow) {
            this.iframe.contentWindow.print();
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

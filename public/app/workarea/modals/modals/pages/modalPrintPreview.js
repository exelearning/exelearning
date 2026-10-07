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

        // Link URLs option: regenerate so the preview reflects it
        this.overlay.querySelector('#printOptLinkUrls')?.addEventListener('change', () => {
            if (!this.isVisible()) return;
            this.showLoading(true);
            this.generatePreview().catch((error) => {
                console.error('[PrintPreview] Error:', error);
                this.showError(error.message || 'An error occurred');
            });
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
     * Read the current state of the print option checkbox.
     * Returns the default if the checkbox doesn't exist in the DOM.
     * @returns {{ showLinkUrls: boolean }}
     */
    getPrintOptions() {
        const linkUrls = this.overlay?.querySelector('#printOptLinkUrls');
        return { showLinkUrls: linkUrls ? linkUrls.checked : true };
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
     * Build the options object for generatePrintPreview from current config.
     * @returns {object}
     */
    buildPreviewOptions() {
        return {
            baseUrl: window.eXeLearning?.config?.isStaticMode
                ? window.location.origin
                : (window.eXeLearning?.config?.baseURL || window.location.origin),
            basePath: window.eXeLearning?.config?.basePath || '',
            version: window.eXeLearning?.config?.isStaticMode ? '' : (window.eXeLearning?.config?.version || 'v1.0.0'),
            ...this.getPrintOptions(),
        };
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
            this.buildPreviewOptions(),
            yjsBridge.assetManager || null
        );

        if (!result.success || !result.html) {
            throw new Error(result.error || _('Failed to generate preview'));
        }

        // Resolve asset URLs if available
        const html = result.html;

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
     * Print the preview iframe itself, so what the user changed in the
     * preview (e.g. collapsed boxes) is what gets printed.
     */
    print() {
        this.iframe?.contentWindow?.print();
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

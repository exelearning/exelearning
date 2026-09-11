/**
 * Print Preview Overlay
 *
 * Simple fullscreen overlay for print preview (no Bootstrap dependency).
 * Uses window.open for printing to ensure @media print CSS is applied correctly.
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
        this.printWindowUrl = null;
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
     * Read the current state of print option checkboxes.
     * Returns defaults if the checkboxes don't exist in the DOM.
     * @returns {{ showPageNumbers: boolean, showWatermark: boolean, showLinkUrls: boolean }}
     */
    getPrintOptions() {
        const getChecked = (selector, defaultValue) => {
            const el = this.overlay?.querySelector(selector);
            return el ? el.checked : defaultValue;
        };

        return {
            showPageNumbers: getChecked('#printOptPageNumbers', true),
            showWatermark: getChecked('#printOptWatermark', false),
            showLinkUrls: getChecked('#printOptLinkUrls', true),
        };
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
     * @param {object} [extraOptions] - Additional options to merge (e.g., printMode).
     * @returns {object}
     */
    buildPreviewOptions(extraOptions) {
        return {
            baseUrl: window.eXeLearning?.config?.isStaticMode
                ? window.location.origin
                : (window.eXeLearning?.config?.baseURL || window.location.origin),
            basePath: window.eXeLearning?.config?.basePath || '',
            version: window.eXeLearning?.config?.isStaticMode ? '' : (window.eXeLearning?.config?.version || 'v1.0.0'),
            ...this.getPrintOptions(),
            ...extraOptions,
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
     * Print the preview content.
     * Opens a new window with printMode enabled so @media print CSS is applied correctly.
     * Falls back to iframe.contentWindow.print() if the window cannot be opened.
     */
    async print() {
        try {
            await this.openPrintWindow();
        } catch (error) {
            console.warn('[PrintPreview] window.open print failed, falling back to iframe print:', error);
            if (this.iframe?.contentWindow) {
                this.iframe.contentWindow.print();
            }
        }
    }

    /**
     * Open a standalone browser window with printMode=true and trigger window.print().
     * This ensures @media print CSS rules are applied correctly, unlike iframe printing.
     */
    async openPrintWindow() {
        if (!eXeLearning.app.project?._yjsEnabled) {
            throw new Error(_('Print preview requires server mode'));
        }

        const yjsBridge = eXeLearning.app.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            throw new Error(_('Document manager not available'));
        }

        const generatePrintPreviewFn =
            window.generatePrintPreview || window.SharedExporters?.generatePrintPreview;

        if (typeof generatePrintPreviewFn !== 'function') {
            throw new Error(_('Print preview not available'));
        }

        // Generate with printMode: true for auto-print on load
        const result = await generatePrintPreviewFn(
            yjsBridge.documentManager,
            yjsBridge.resourceFetcher || null,
            this.buildPreviewOptions({ printMode: true }),
            yjsBridge.assetManager || null
        );

        if (!result.success || !result.html) {
            throw new Error(result.error || _('Failed to generate print preview'));
        }

        // Cleanup previous print window URL
        if (this.printWindowUrl) {
            URL.revokeObjectURL(this.printWindowUrl);
        }

        const blob = new Blob([result.html], { type: 'text/html' });
        this.printWindowUrl = URL.createObjectURL(blob);

        // Open in new window — the injected onload script will call window.print()
        const printWindow = window.open(this.printWindowUrl, '_blank');
        if (!printWindow) {
            URL.revokeObjectURL(this.printWindowUrl);
            this.printWindowUrl = null;
            throw new Error(_('Could not open print window. Please allow pop-ups.'));
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
        if (this.printWindowUrl) {
            URL.revokeObjectURL(this.printWindowUrl);
            this.printWindowUrl = null;
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

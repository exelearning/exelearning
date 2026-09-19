/**
 * Print Preview Overlay
 *
 * Simple fullscreen overlay for print preview (no Bootstrap dependency).
 *
 * Serves two modes over the same chrome, since only the source of the HTML differs:
 * - 'document' prints the project as the browser renders it (generatePrintPreview).
 * - 'idevices' prints a worksheet rebuilt from each activity's stored data (generateWorksheet).
 */

/** Preview modes this overlay can display. */
export const PREVIEW_MODE_DOCUMENT = 'document';
export const PREVIEW_MODE_IDEVICES = 'idevices';

export default class ModalPrintPreview {
    constructor(manager) {
        this.manager = manager;
        this.overlay = document.getElementById('printPreviewOverlay');
        this.iframe = this.overlay?.querySelector('.print-preview-iframe');
        this.loadingEl = this.overlay?.querySelector('.print-preview-loading');
        this.printBtn = this.overlay?.querySelector('.print-preview-print-btn');
        this.closeBtn = this.overlay?.querySelector('.print-preview-close-btn');
        this.titleEl = this.overlay?.querySelector('.print-preview-title-text');
        this.blobUrl = null;
        this.mode = PREVIEW_MODE_DOCUMENT;
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
     *
     * @param {string} mode - PREVIEW_MODE_DOCUMENT (default) or PREVIEW_MODE_IDEVICES
     */
    async show(mode = PREVIEW_MODE_DOCUMENT) {
        if (!this.overlay) {
            console.error('[PrintPreview] Overlay element not found');
            return;
        }

        this.mode = mode;
        this.applyTitle();

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
     * Put the heading in step with the current mode.
     */
    applyTitle() {
        if (!this.titleEl) return;

        this.titleEl.textContent =
            this.mode === PREVIEW_MODE_IDEVICES ? _('Print iDevices') : _('Print preview');
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
     * Resolve the Yjs bridge, or explain why the preview cannot run.
     *
     * @returns {object} The bridge, guaranteed to carry a documentManager
     */
    requireYjsBridge() {
        if (!eXeLearning.app.project?._yjsEnabled) {
            throw new Error(_('Print preview requires server mode'));
        }

        const yjsBridge = eXeLearning.app.project?._yjsBridge;
        if (!yjsBridge?.documentManager) {
            throw new Error(_('Document manager not available'));
        }

        return yjsBridge;
    }

    /**
     * Work out where the iDevice export files are served from.
     *
     * Some activities fall back to a picture shipped with their iDevice rather than one stored in
     * the project. The worksheet is a standalone document, so it needs an absolute URL to reach
     * one. Mirrors the path PrintPreviewExporter builds for the same files.
     *
     * @returns {string} Base URL ending in a slash
     */
    getIdeviceBasePath() {
        const config = window.eXeLearning?.config || {};
        const baseUrl = config.isStaticMode
            ? window.location.origin
            : config.baseURL || window.location.origin;
        const basePath = (config.basePath || '').replace(/\/$/, '');
        const version = config.isStaticMode ? '' : config.version || '';
        // v1.0.0 is the unversioned development default, which is not part of the path.
        const versionSegment = version && version !== 'v1.0.0' ? `/${version}` : '';

        return `${baseUrl}${basePath}${versionSegment}/files/perm/idevices/base/`;
    }

    /**
     * Build the worksheet from the activities in the project.
     *
     * The shared export code does not translate, so the user-visible strings are wrapped here
     * and handed over.
     *
     * @returns {Promise<object>} Result carrying the worksheet HTML
     */
    async generateIdevicesWorksheet() {
        const yjsBridge = this.requireYjsBridge();
        const generateWorksheetFn =
            window.generateWorksheet || window.SharedExporters?.generateWorksheet;

        if (typeof generateWorksheetFn !== 'function') {
            throw new Error(_('Print iDevices is not available.'));
        }

        return generateWorksheetFn(
            yjsBridge.documentManager,
            {
                labels: {
                    studentName: _('Name'),
                    date: _('Date'),
                    empty: _('This project has no printable activities yet.'),
                    unsupportedHeading: _('Activities that cannot be printed yet'),
                },
                ideviceTitles: {
                    guess: _('Guess'),
                    crossword: _('Crossword'),
                    'quick-questions': _('Test'),
                    'quick-questions-multiple-choice': _('Select'),
                    complete: _('Complete'),
                },
                ideviceBasePath: this.getIdeviceBasePath(),
            },
            yjsBridge.assetManager || null
        );
    }

    /**
     * Render the project the way the browser shows it.
     *
     * @returns {Promise<object>} Result carrying the preview HTML
     */
    async generateDocumentPreview() {
        const yjsBridge = this.requireYjsBridge();
        const generatePrintPreviewFn =
            window.generatePrintPreview || window.SharedExporters?.generatePrintPreview;

        if (typeof generatePrintPreviewFn !== 'function') {
            throw new Error(_('Print preview not available'));
        }

        // Use resourceFetcher from yjsBridge, already initialized with bundle manifest
        return generatePrintPreviewFn(
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
    }

    /**
     * Generate and load the preview for the current mode
     */
    async generatePreview() {
        const result =
            this.mode === PREVIEW_MODE_IDEVICES
                ? await this.generateIdevicesWorksheet()
                : await this.generateDocumentPreview();

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

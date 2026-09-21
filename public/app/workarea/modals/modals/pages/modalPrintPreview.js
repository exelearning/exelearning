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

/**
 * What the document preview does with the project's interactive activities.
 *
 * These match the modes the shared exporter understands. Printing only the activities is not one
 * of them: that is PREVIEW_MODE_IDEVICES, which produces the worksheet on its own.
 */
export const ACTIVITY_MODE_OMIT = 'omit';
export const ACTIVITY_MODE_IN_PLACE = 'in-place';
export const ACTIVITY_MODE_APPENDIX = 'appendix';

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
        /** Null means print the document untouched, as it did before there was a choice. */
        this.activityMode = null;
        this.requestId = 0;
        this.disposePreview = null;
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
     * @param {string|null} activityMode - What to do with the interactive activities, for the
     *     document mode. Null prints the document untouched.
     */
    async show(mode = PREVIEW_MODE_DOCUMENT, activityMode = null) {
        if (!this.overlay) {
            console.error('[PrintPreview] Overlay element not found');
            return;
        }

        this.mode = mode;
        this.activityMode = activityMode;
        const requestId = ++this.requestId;
        this.cleanup();
        this.applyTitle();

        // Show overlay with loading
        this.showLoading(true);
        this.overlay.setAttribute('data-visible', 'true');

        try {
            await this.generatePreview(requestId);
        } catch (error) {
            if (requestId !== this.requestId) return;
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
        this.requestId++;
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
     * User-visible strings the printable activities need.
     *
     * The shared export code does not translate, so they are wrapped here and handed over. Both
     * printing paths draw the same exercises, so both read them from here.
     *
     * @returns {object} Translated worksheet labels
     */
    getWorksheetLabels() {
        return {
            across: _('Across'),
            down: _('Down'),
            mediaRequired: _('Requires multimedia'),
            invalidData: _('Invalid or empty activity data'),
            unplacedWords: _('Words that could not be placed'),
            studentName: _('Name'),
            date: _('Date'),
            empty: _('This project has no printable activities yet.'),
            unsupportedHeading: _('Activities that cannot be printed yet'),
            notAvailableInPrint: _('Not available in print'),
            before: _('Before'),
            after: _('After'),
            operation: _('Operation'),
            result: _('Result'),
        };
    }

    /**
     * Translated heading for each activity, keyed by iDevice type.
     *
     * @returns {object} Titles keyed by iDevice type
     */
    getIdeviceTitles() {
        return {
            guess: _('Guess'),
            crossword: _('Crossword'),
            'quick-questions': _('Test'),
            'quick-questions-multiple-choice': _('Select'),
            complete: _('Complete'),
            classify: _('Classify'),
            dragdrop: _('Drag and drop'),
            'az-quiz-game': _('A-Z quiz'),
            sort: _('Sort'),
            'word-search': _('Word search'),
            mathproblems: _('Math problems'),
            mathematicaloperations: _('Math operations'),
            relate: _('Relate'),
            discover: _('Discover'),
            flipcards: _('Flip cards'),
            'hidden-image': _('Hidden image'),
            beforeafter: _('Before/After'),
            'electrical-circuits': _('Electrical circuits'),
        };
    }

    /**
     * Build the worksheet from the activities in the project.
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
                labels: this.getWorksheetLabels(),
                ideviceTitles: this.getIdeviceTitles(),
                ideviceBasePath: this.getIdeviceBasePath(),
            },
            yjsBridge.assetManager || null
        );
    }

    /**
     * What the exporter should do with the interactive activities.
     *
     * Absent when no mode was chosen, which leaves the document printing exactly as it always
     * has.
     *
     * @returns {object} An options fragment, empty when there is nothing to do
     */
    getActivityOptions() {
        if (!this.activityMode) return {};

        return {
            activities: {
                mode: this.activityMode,
                labels: {
                    ...this.getWorksheetLabels(),
                    appendixTitle: _('Appendix'),
                    // %s is the activity's number in the appendix.
                    appendixReference: _('See appendix, activity %s'),
                    notPrintable: _('This activity cannot be printed yet.'),
                    notAvailable: _('Not available in print.'),
                },
                ideviceTitles: this.getIdeviceTitles(),
                ideviceBasePath: this.getIdeviceBasePath(),
            },
        };
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
                ...this.getActivityOptions(),
            },
            yjsBridge.assetManager || null
        );
    }

    /**
     * Generate and load the preview for the current mode
     */
    async generatePreview(requestId = ++this.requestId) {
        const result =
            this.mode === PREVIEW_MODE_IDEVICES
                ? await this.generateIdevicesWorksheet()
                : await this.generateDocumentPreview();

        if (requestId !== this.requestId) {
            result.dispose?.();
            return;
        }
        if (!result.success || !result.html) {
            result.dispose?.();
            throw new Error(result.error || _('Failed to generate preview'));
        }

        // Resolve asset URLs if available
        const html = result.html;

        // Create blob URL and load into iframe
        this.cleanup();
        this.disposePreview = result.dispose || null;
        const blob = new Blob([html], { type: 'text/html' });
        try {
            this.blobUrl = URL.createObjectURL(blob);
        } catch (error) {
            this.cleanup();
            throw error;
        }

        // Load into iframe
        if (this.iframe) {
            this.iframe.src = this.blobUrl;
            this.iframe.onload = () => {
                if (requestId === this.requestId) this.showLoading(false);
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
        this.disposePreview?.();
        this.disposePreview = null;
        if (this.blobUrl) {
            URL.revokeObjectURL(this.blobUrl);
            this.blobUrl = null;
        }
        if (this.iframe) {
            this.iframe.onload = null;
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

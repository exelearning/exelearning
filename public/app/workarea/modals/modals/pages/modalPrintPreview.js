/**
 * Print Preview Overlay
 *
 * Simple fullscreen overlay for print preview (no Bootstrap dependency).
 *
 * Serves two modes over the same chrome, since only the source of the HTML differs:
 * - 'document' prints the project as the browser renders it (generatePrintPreview).
 * - 'idevices' prints a worksheet rebuilt from each activity's stored data (generateWorksheet).
 *
 * A panel beside the preview offers the print options: whether to write the URL of each link,
 * whether folded blocks print unfolded or as the preview shows them, and, when the project has
 * interactive activities, the choices about them (print them where they are, in an appendix, only
 * them, or not at all, and which of them). Those that can never be printed are left out unless the
 * user asks for their titles; the panel does it by leaving them out of the selection it reports.
 * The preview is drawn again whenever one of those changes, except how folded blocks print, which
 * the loaded preview takes in place.
 */
import PrintOptionsPanel, { PRINT_UNFOLD_BLOCKS_FIELD } from './printOptionsPanel.js';

/**
 * Class on the <html> of the preview that keeps folded blocks folded on paper, so the page prints
 * as the preview shows it. Without it the print style sheet unfolds them (see base.css).
 */
export const PRINT_AS_SHOWN_CLASS = 'exe-print-as-shown';

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

/**
 * What printing does with the interactive activities until the user chooses otherwise: the
 * document keeps a pointer where each one was, and the exercises are gathered in an appendix.
 */
export const DEFAULT_ACTIVITY_MODE = ACTIVITY_MODE_APPENDIX;

/**
 * How long to wait after an option changes before drawing the preview again, so that ticking a
 * handful of activities in a row draws it once.
 */
export const REGENERATE_DELAY_MS = 250;

export default class ModalPrintPreview {
    constructor(manager) {
        this.manager = manager;
        this.overlay = document.getElementById('printPreviewOverlay');
        this.iframe = this.overlay?.querySelector('.print-preview-iframe');
        this.loadingEl = this.overlay?.querySelector('.print-preview-loading');
        this.printBtn = this.overlay?.querySelector('.print-preview-print-btn');
        this.closeBtn = this.overlay?.querySelector('.print-preview-close-btn');
        this.optionsBtn = this.overlay?.querySelector('.print-preview-options-btn');
        this.titleEl = this.overlay?.querySelector('.print-preview-title-text');
        const panelEl = this.overlay?.querySelector('.print-options-panel');
        /** The choices beside the preview. Null where the page has no markup for them. */
        this.panel = panelEl
            ? new PrintOptionsPanel(panelEl, {
                  toggleButton: this.optionsBtn,
                  onChange: (state, changed) => this.onOptionsChange(state, changed),
              })
            : null;
        this.blobUrl = null;
        this.mode = PREVIEW_MODE_DOCUMENT;
        /** Null means print the document untouched, as it did before there was a choice. */
        this.activityMode = null;
        /** Ids of the activities to print. Null prints every one of them. */
        this.selectedActivities = null;
        /** The interactive activities of the project, which the panel lets the user choose from. */
        this.activities = [];
        /** Write each external link's URL after it in the document. */
        this.showLinkUrls = true;
        /** Print folded blocks unfolded; false prints them as the preview shows them. */
        this.unfoldBlocks = true;
        this.requestId = 0;
        this.disposePreview = null;
        this.regenerateTimer = null;
        /** The exporter currently running; later requests wait for it and keep only the latest. */
        this.generationPromise = null;
        /** True only after the current document has loaded successfully. */
        this.ready = false;
        /** True while a preview is being drawn. */
        this.busy = false;
        /** False while the options ask for something that cannot be printed. */
        this.valid = true;
    }

    /**
     * Initialize behavior
     */
    behaviour() {
        if (!this.overlay) return;

        this.panel?.bind();

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
     * @param {string[]|null} selectedActivities - Ids of the activities to print, in either mode.
     *     Null prints every one of them.
     * @param {Array<object>} activities - The interactive activities of the project, as the
     *     exporter lists them. With any, the options panel offers the choices about them, and
     *     what it shows is what the preview draws.
     */
    async show(mode = PREVIEW_MODE_DOCUMENT, activityMode = null, selectedActivities = null, activities = []) {
        if (!this.overlay) {
            console.error('[PrintPreview] Overlay element not found');
            return;
        }

        this.mode = mode;
        this.activityMode = activityMode;
        this.selectedActivities = selectedActivities;
        this.activities = Array.isArray(activities) ? activities : [];
        const requestId = ++this.requestId;
        this.cleanup();
        this.configurePanel();
        this.applyTitle();

        // Show overlay with loading
        this.showLoading(true);
        this.overlay.setAttribute('data-visible', 'true');

        await this.loadPreview(requestId);
    }

    /**
     * Draw the preview for a request, and say so if it fails.
     *
     * @param {number} requestId - The request this belongs to; a newer one makes it stale
     */
    async loadPreview(requestId) {
        // Wait for the active exporter without retaining its result or starting another one.
        // Requests invalidated by more recent options (or closing) never reach the exporter.
        if (this.generationPromise) await this.generationPromise;
        if (requestId !== this.requestId) return;

        const generation = this.generatePreview(requestId).catch((error) => {
            if (requestId !== this.requestId) return;
            console.error('[PrintPreview] Error:', error);
            this.showError(error.message || 'An error occurred');
        });
        this.generationPromise = generation;
        try {
            await generation;
        } finally {
            if (this.generationPromise === generation) this.generationPromise = null;
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
        this.setBusy(false);
    }

    /**
     * Fill the options panel for the project that is about to be previewed.
     *
     * Whatever the panel then shows becomes what the preview draws, however the arguments of show
     * were given: they only say where the choices start.
     */
    configurePanel() {
        this.valid = true;
        if (!this.panel) return;

        this.panel.configure({
            activities: this.activities,
            choices: this.getChoices(),
            choice:
                this.mode === PREVIEW_MODE_IDEVICES
                    ? PREVIEW_MODE_IDEVICES
                    : this.activityMode || DEFAULT_ACTIVITY_MODE,
            selectedActivities: this.selectedActivities,
            labels: this.getPanelLabels(),
            ideviceName: (type) => this.ideviceName(type),
        });

        this.takePanelState(this.panel.getState());
    }

    /**
     * Take what the options panel shows as what the preview draws.
     *
     * The activity choices only count when the project has activities to choose about; without
     * them the mode stays as it was asked for, so printing only the activities of a project that
     * has none still shows the worksheet that says so.
     *
     * @param {{choice: string|null, selectedActivities: string[]|null, valid: boolean,
     *     showLinkUrls: boolean, unfoldBlocks: boolean}} state - As the panel gives it
     */
    takePanelState(state) {
        if (this.panel.hasActivities()) {
            this.applyPanelState(state);
            this.valid = state.valid;
        }
        this.showLinkUrls = state.showLinkUrls;
        this.unfoldBlocks = state.unfoldBlocks;
        // The document options act on the document preview; the worksheet has neither links to
        // show nor blocks to fold.
        this.panel.setDocumentOptionsEnabled(this.mode === PREVIEW_MODE_DOCUMENT);
    }

    /**
     * Tell the print style sheet of the loaded preview how to print folded blocks.
     *
     * Applied to the document in place, never by drawing the preview again: that would bring back
     * the folds the author left and lose those the user changed, which is exactly what printing
     * the preview as it is shown has to keep.
     */
    applyFolding() {
        let root = null;
        try {
            root = this.iframe?.contentDocument?.documentElement ?? null;
        } catch {
            // A document from another origin cannot be reached; it prints as it was built.
            return;
        }
        root?.classList.toggle(PRINT_AS_SHOWN_CLASS, !this.unfoldBlocks);
    }

    /**
     * Take what the options panel says as the mode, the activity mode and the activities to print.
     *
     * Printing only the activities is a different preview, not a way of treating them in the
     * document, so the choice is split between the two.
     *
     * @param {{choice: string|null, selectedActivities: string[]|null}} state - As the panel gives it
     */
    applyPanelState(state) {
        if (state.choice === PREVIEW_MODE_IDEVICES) {
            this.mode = PREVIEW_MODE_IDEVICES;
            this.activityMode = null;
        } else {
            this.mode = PREVIEW_MODE_DOCUMENT;
            this.activityMode = state.choice;
        }
        this.selectedActivities = state.selectedActivities;
    }

    /**
     * An option changed: draw the preview again for it, unless it only says how folded blocks
     * print, which the loaded preview takes in place.
     *
     * @param {{choice: string|null, selectedActivities: string[]|null, valid: boolean}} state
     * @param {string} [changed] - Id of the document option that changed, if one did
     */
    onOptionsChange(state, changed) {
        if (!this.isVisible()) return;

        this.takePanelState(state);
        if (changed === PRINT_UNFOLD_BLOCKS_FIELD) {
            this.applyFolding();
            return;
        }
        this.applyTitle();
        this.scheduleRegeneration();
    }

    /**
     * Draw the preview again shortly, once the user has stopped changing options.
     *
     * Whatever was being drawn belongs to the options as they were, so it is dropped at once, and
     * the preview is marked as busy from now rather than from when the drawing starts.
     */
    scheduleRegeneration() {
        this.cancelRegeneration();
        this.requestId++;
        this.showLoading(true);
        this.regenerateTimer = setTimeout(() => {
            this.regenerateTimer = null;
            this.regenerate();
        }, REGENERATE_DELAY_MS);
    }

    /**
     * Forget a regeneration that was waiting to start.
     */
    cancelRegeneration() {
        if (this.regenerateTimer === null) return;

        clearTimeout(this.regenerateTimer);
        this.regenerateTimer = null;
    }

    /**
     * Draw the preview again with the options as they are now.
     */
    async regenerate() {
        await this.loadPreview(++this.requestId);
    }

    /**
     * The choices about the interactive activities, in the order they are offered.
     *
     * @returns {Array<{value: string, label: string, prints: boolean}>} `prints` is false for the
     *     choice that leaves the activities out, which makes picking among them pointless
     */
    getChoices() {
        return [
            { value: ACTIVITY_MODE_OMIT, label: _('Do not print them'), prints: false },
            { value: ACTIVITY_MODE_IN_PLACE, label: _('Print them where they are'), prints: true },
            { value: ACTIVITY_MODE_APPENDIX, label: _('Print them in an appendix'), prints: true },
            { value: PREVIEW_MODE_IDEVICES, label: _('Print only the activities'), prints: true },
        ];
    }

    /**
     * Strings the options panel shows.
     *
     * @returns {object} Translated headings and messages
     */
    getPanelLabels() {
        return {
            choicesHeading: _('Interactive activities'),
            selectionHeading: _('Select the interactive activities you want to print'),
            selectAll: _('Select all'),
            noneSelected: _('Select at least one activity to print.'),
        };
    }

    /**
     * Translated name of an iDevice type, as the iDevice menu shows it.
     *
     * @param {string} type - iDevice type, e.g. 'guess'
     * @returns {string} The name, or empty when the iDevice is not installed
     */
    ideviceName(type) {
        return window.eXeLearning?.app?.idevices?.getIdeviceInstalled?.(type)?.title || '';
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
            '3dmol': _('3D molecules'),
            challenge: _('Challenge'),
            identify: _('Identify'),
            rubric: _('Rubric'),
            'select-media-files': _('Select multimedia'),
            'periodic-table': _('Periodic table'),
            form: _('Form'),
            'scrambled-list': _('Scrambled list'),
            trueorfalse: _('True or false'),
            'adaptative-quiz': _('Adaptative quiz'),
            padlock: _('Padlock'),
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
                ...this.getSelectionOptions(),
            },
            yjsBridge.assetManager || null
        );
    }

    /**
     * Which activities to print, when the user chose some rather than all.
     *
     * @returns {object} An options fragment, empty when every activity is to be printed
     */
    getSelectionOptions() {
        return this.selectedActivities ? { selectedActivities: this.selectedActivities } : {};
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
                ...this.getSelectionOptions(),
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
            this.buildPreviewOptions(),
            yjsBridge.assetManager || null
        );
    }

    /**
     * The print options the document preview applies, as the options panel left them.
     *
     * @returns {{ showLinkUrls: boolean }}
     */
    getPrintOptions() {
        return { showLinkUrls: this.showLinkUrls };
    }

    /**
     * Build the options object for generatePrintPreview from current config.
     *
     * @returns {object}
     */
    buildPreviewOptions() {
        // Static mode requires absolute URLs for Blob compatibility
        const baseUrl = window.eXeLearning?.config?.isStaticMode
            ? window.location.origin
            : (window.eXeLearning?.config?.baseURL || window.location.origin);

        return {
            baseUrl,
            basePath: window.eXeLearning?.config?.basePath || '',
            version: window.eXeLearning?.config?.isStaticMode ? '' : (window.eXeLearning?.config?.version || 'v1.0.0'),
            ...this.getThemeOptions(baseUrl),
            ...this.getPrintOptions(),
            ...this.getActivityOptions(),
        };
    }

    /**
     * Where the style the editor shows is served from, for the preview to load the same one.
     *
     * Without it the exporter looks for the style among the base ones, which misses a style an
     * administrator installed: its stylesheet, its script and its icons are served from
     * elsewhere. The URL is made absolute because the preview is a blob: document, against which
     * no other kind resolves. A style the user imported is not served from anywhere, so there is
     * no URL to give for it.
     *
     * @param {string} baseUrl - What the style's path is resolved against
     * @returns {{themeUrl?: string}} An options fragment, empty when there is no URL to give
     */
    getThemeOptions(baseUrl) {
        const theme = window.eXeLearning?.app?.themes?.selected;
        const path = theme?.path;
        if (!path || theme.isUserTheme || path.startsWith('user-theme://')) return {};

        try {
            return { themeUrl: new URL(path, baseUrl).href };
        } catch {
            return {};
        }
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
                if (requestId === this.requestId) {
                    this.ready = true;
                    this.applyFolding();
                    this.showLoading(false);
                }
            };
        }
    }

    /**
     * Print the preview content
     */
    print() {
        if (!this.canPrint()) return;
        if (this.iframe?.contentWindow) {
            this.iframe.contentWindow.print();
        }
    }

    /**
     * Show or hide loading indicator
     */
    showLoading(show) {
        if (show) {
            this.ready = false;
            this.resetLoadingIndicator();
        }
        if (this.loadingEl) {
            this.loadingEl.classList.toggle('hidden', !show);
        }
        if (this.iframe) {
            this.iframe.classList.toggle('hidden', show);
        }
        this.setBusy(show);
    }

    /**
     * Record whether a preview is being drawn.
     *
     * Printing waits for it, so a page half-drawn is never what reaches the printer, and the
     * overlay says so for anything outside that needs to know.
     *
     * @param {boolean} busy - true while a preview is being drawn
     */
    setBusy(busy) {
        this.busy = busy;
        this.overlay?.setAttribute('data-busy', busy ? 'true' : 'false');
        this.syncPrintButton();
    }

    /**
     * Allow printing only when there is a finished preview of something that can be printed.
     */
    canPrint() {
        return this.isVisible() && this.ready && !this.busy && this.valid;
    }

    syncPrintButton() {
        if (this.printBtn) this.printBtn.disabled = !this.canPrint();
    }

    /**
     * Show error message
     */
    showError(message) {
        this.cleanup();
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
        this.setBusy(false);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.ready = false;
        this.syncPrintButton();
        this.cancelRegeneration();
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
        this.resetLoadingIndicator();
    }

    /** Restore the loading message after an error or a previous preview. */
    resetLoadingIndicator() {
        if (this.loadingEl) {
            this.loadingEl.classList.remove('hidden');
            this.loadingEl.innerHTML = `
                <div class="spinner-border" role="status"></div>
                <p>${_('Generating preview...')}</p>
            `;
        }
    }
}

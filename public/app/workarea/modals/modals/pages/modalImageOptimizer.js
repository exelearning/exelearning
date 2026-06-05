import Modal from '../modal.js';
import ImageOptimizerManager, { STATUS } from '../../../utils/ImageOptimizerManager.js';

/**
 * View state configurations for applyViewState()
 * Each key maps to visibility settings for panels, footers, and interactive state
 */
const VIEW_STATE_CONFIG = {
    normal: {
        confirmPanel: false,
        progressPanel: false,
        settingsPanel: true,
        footerNormal: true,
        footerConfirm: false,
        footerProgress: false,
        closeBtn: true,
        rowsInteractive: true,
    },
    confirm: {
        confirmPanel: true,
        progressPanel: false,
        settingsPanel: false,
        footerNormal: false,
        footerConfirm: true,
        footerProgress: false,
        closeBtn: true,
        rowsInteractive: false,
    },
    progress: {
        confirmPanel: false,
        progressPanel: true,
        settingsPanel: false,
        footerNormal: false,
        footerConfirm: false,
        footerProgress: true,
        closeBtn: false,
        rowsInteractive: false,
    },
};

/**
 * Status badge configurations mapping status to badge HTML
 */
const STATUS_BADGE_CONFIG = {
    [STATUS.PENDING]: () => `<span class="badge bg-secondary">${_('Queued')}</span>`,
    [STATUS.ESTIMATING]: () => `<span class="badge bg-info"><span class="spinner-border spinner-border-sm me-1" style="width: 0.75rem; height: 0.75rem;"></span>${_('Estimating...')}</span>`,
    [STATUS.READY]: () => `<span class="badge bg-primary">${_('Ready')}</span>`,
    [STATUS.OPTIMIZING]: () => `<span class="badge bg-warning text-dark"><span class="spinner-border spinner-border-sm me-1" style="width: 0.75rem; height: 0.75rem;"></span>${_('Optimizing...')}</span>`,
    [STATUS.DONE]: () => `<span class="badge bg-success">${_('Done')}</span>`,
    [STATUS.FAILED]: (error) => `<span class="badge bg-danger" title="${error || _('Error')}">${_('Failed')}</span>`,
};

const ALREADY_OPTIMIZED_MIN_SAVINGS_PERCENT = 1;
const STATUS_ALREADY_OPTIMIZED = 'already_optimized';

/**
 * ModalImageOptimizer
 *
 * Modal for optimizing project images (PNG/JPEG).
 * Loads images from the project's asset library, allows selection,
 * estimates and applies compression, then replaces the originals.
 */
export default class ModalImageOptimizer extends Modal {
    constructor(manager) {
        const id = 'modalImageOptimizer';
        super(manager, id, undefined, false);

        this.titleDefault = _('Image Optimizer');

        // DOM references
        this.loadingEl = null;
        this.emptyEl = null;
        this.contentEl = null;
        this.tbodyEl = null;
        this.summaryEl = null;
        this.presetSelect = null;
        this.qualityContainer = null;
        this.qualitySlider = null;
        this.qualityValue = null;
        this.toggleAllCheckbox = null;
        this.optimizeBtn = null;

        // Confirmation and progress elements
        this.confirmPanel = null;
        this.progressPanel = null;
        this.progressBar = null;
        this.progressText = null;
        this.progressPercent = null;
        this.progressDetail = null;
        this.footerNormal = null;
        this.footerConfirm = null;
        this.footerProgress = null;
        this.confirmBtn = null;
        this.cancelBtn = null;
        this.closeBtn = null;
        this.settingsPanel = null;

        // State
        /** @type {ImageOptimizerManager} */
        this.optimizerManager = null;

        /** @type {Map<string, HTMLElement>} */
        this.rowElements = new Map();

        /** @type {Set<string>} */
        this.selectedAssets = new Set();

        /** @type {boolean} */
        this.hasJpegs = false;

        /** @type {'normal'|'confirm'|'progress'|'done'} */
        this.viewState = 'normal';

        /** @type {Promise|null} Tracks the active estimateSelected promise for cancellation */
        this._estimatePromise = null;

        /** @type {number|null} Debounce timer for quality slider re-estimation */
        this._reEstimateTimeout = null;
    }

    /**
     * Get the AssetManager from the project
     * @returns {Object|null}
     */
    get assetManager() {
        return eXeLearning.app.project?._yjsBridge?.assetManager ?? null;
    }

    /**
     * Initialize DOM references after modal is available
     */
    initElements() {
        this.loadingEl = this.modalElement.querySelector('.image-optimizer-loading');
        this.emptyEl = this.modalElement.querySelector('.image-optimizer-empty');
        this.contentEl = this.modalElement.querySelector('.image-optimizer-content');
        this.tbodyEl = this.modalElement.querySelector('.image-optimizer-tbody');
        this.summaryEl = this.modalElement.querySelector('.image-optimizer-summary');

        this.presetSelect = this.modalElement.querySelector('.image-optimizer-preset');
        this.qualityContainer = this.modalElement.querySelector('.image-optimizer-quality-container');
        this.qualitySlider = this.modalElement.querySelector('.image-optimizer-quality');
        this.qualityValue = this.modalElement.querySelector('.image-optimizer-quality-value');
        this.toggleAllCheckbox = this.modalElement.querySelector('.image-optimizer-toggle-all');
        this.settingsPanel = this.modalElement.querySelector('.image-optimizer-settings');

        this.optimizeBtn = this.modalElement.querySelector('.image-optimizer-optimize-btn');

        this.selectAllBtn = this.modalElement.querySelector('.image-optimizer-select-all');
        this.deselectAllBtn = this.modalElement.querySelector('.image-optimizer-deselect-all');

        // Confirmation and progress elements
        this.confirmPanel = this.modalElement.querySelector('.image-optimizer-confirm-panel');
        this.progressPanel = this.modalElement.querySelector('.image-optimizer-progress-panel');
        this.progressBar = this.modalElement.querySelector('.image-optimizer-progress-bar');
        this.progressText = this.modalElement.querySelector('.image-optimizer-progress-text');
        this.progressPercent = this.modalElement.querySelector('.image-optimizer-progress-percent');
        this.progressDetail = this.modalElement.querySelector('.image-optimizer-progress-detail');

        // Footer sections
        this.footerNormal = this.modalElement.querySelector('.image-optimizer-footer-normal');
        this.footerConfirm = this.modalElement.querySelector('.image-optimizer-footer-confirm');
        this.footerProgress = this.modalElement.querySelector('.image-optimizer-footer-progress');
        this.confirmBtn = this.modalElement.querySelector('.image-optimizer-confirm-btn');
        this.cancelBtn = this.modalElement.querySelector('.image-optimizer-cancel-btn');
        this.closeBtn = this.modalElement.querySelector('.image-optimizer-close-btn');
    }

    /**
     * Set up event handlers
     */
    initBehaviour() {
        // Preset change
        if (this.presetSelect) {
            this.presetSelect.addEventListener('change', () => this.onPresetChange());
        }

        // Quality slider
        if (this.qualitySlider) {
            this.qualitySlider.addEventListener('input', () => this.onQualityChange());
        }

        // Toggle all checkbox
        if (this.toggleAllCheckbox) {
            this.toggleAllCheckbox.addEventListener('change', () => {
                if (this.toggleAllCheckbox.checked) {
                    this.selectAll();
                } else {
                    this.deselectAll();
                }
            });
        }

        // Select/Deselect all buttons
        if (this.selectAllBtn) {
            this.selectAllBtn.addEventListener('click', () => this.selectAll());
        }
        if (this.deselectAllBtn) {
            this.deselectAllBtn.addEventListener('click', () => this.deselectAll());
        }

        // Optimize button - shows confirmation
        if (this.optimizeBtn) {
            this.optimizeBtn.addEventListener('click', () => this.applyViewState('confirm'));
        }

        // Confirm button - starts optimization
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.startOptimization());
        }

        // Cancel button - goes back to normal view
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.applyViewState('normal'));
        }
    }

    /**
     * Called once when the modal behavior is initialized
     */
    behaviour() {
        super.behaviour();
        this.initElements();
        this.initBehaviour();
    }

    /**
     * Show the modal and load project images
     */
    async show() {
        this.setTitle(this.titleDefault);

        // Reset state
        this.selectedAssets.clear();
        this.rowElements.clear();
        this.hasJpegs = false;
        this.viewState = 'normal';

        // Reset view to normal state
        this.applyViewState('normal');

        // Create optimizer manager
        this.optimizerManager = new ImageOptimizerManager();
        this.optimizerManager.onAssetUpdate = (assetId, data) => this.updateImageRow(assetId, data);
        this.optimizerManager.onProgress = (current, total, phase) => this.onProgress(current, total, phase);
        this.optimizerManager.onEstimateComplete = () => this.onEstimateComplete();
        this.optimizerManager.onOptimizeComplete = () => this.onOptimizeComplete();
        this.optimizerManager.onError = (assetId, error) => this.onError(assetId, error);

        // Show modal with loading state
        this.setContentState('loading');
        this.modal.show();

        // Load project images
        try {
            await this.loadProjectImages();
        } catch (error) {
            console.error('[ModalImageOptimizer] Error loading images:', error);
            this.setContentState('empty');
        }
    }

    /**
     * Set the content state (loading, empty, or content)
     * @param {'loading'|'empty'|'content'} state - Content state to apply
     */
    setContentState(state) {
        const isLoading = state === 'loading';
        const isEmpty = state === 'empty';
        const isContent = state === 'content';

        if (this.loadingEl) this.loadingEl.classList.toggle('d-none', !isLoading);
        if (this.emptyEl) this.emptyEl.classList.toggle('d-none', !isEmpty);
        if (this.contentEl) this.contentEl.classList.toggle('d-none', !isContent);

        if (isLoading && this.optimizeBtn) {
            this.optimizeBtn.disabled = true;
        }
    }

    /**
     * Load all PNG/JPEG images from the project
     */
    async loadProjectImages() {
        if (!this.assetManager) {
            console.error('[ModalImageOptimizer] AssetManager not available');
            this.setContentState('empty');
            return;
        }

        // Get all project assets with blobs (more reliable than getAllAssetsMetadata)
        let allAssets;
        try {
            allAssets = await this.assetManager.getProjectAssets({ includeBlobs: true });
            console.log('[ModalImageOptimizer] Loaded assets:', allAssets.length, allAssets.map((a) => ({ id: a.id?.substring(0, 8), mime: a.mime, filename: a.filename })));
        } catch (error) {
            console.error('[ModalImageOptimizer] Failed to get project assets:', error);
            this.setContentState('empty');
            return;
        }

        // Filter to PNG/JPEG only
        const imageAssets = allAssets.filter((asset) => {
            const mime = asset.mime || '';
            return mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg';
        });

        console.log('[ModalImageOptimizer] Found image assets:', imageAssets.length, imageAssets.map((a) => a.filename));

        if (imageAssets.length === 0) {
            this.setContentState('empty');
            return;
        }

        // Check if we have JPEGs (to show quality slider)
        this.hasJpegs = imageAssets.some((asset) => {
            const mime = asset.mime || '';
            return mime === 'image/jpeg' || mime === 'image/jpg';
        });

        // Show/hide quality slider based on JPEG presence
        if (this.qualityContainer) {
            this.qualityContainer.classList.toggle('d-none', !this.hasJpegs);
        }

        // Clear table and add rows
        if (this.tbodyEl) {
            this.tbodyEl.innerHTML = '';
        }

        // Process each image asset
        for (const asset of imageAssets) {
            try {
                // Get blob - either from asset or fetch it
                let blob = asset.blob;
                if (!blob) {
                    blob = await this.fetchAssetBlob(asset.id);
                }
                if (!blob) {
                    console.warn(`[ModalImageOptimizer] No blob for asset ${asset.id}`);
                    continue;
                }

                // Add to manager
                this.optimizerManager.addAsset(asset.id, blob, {
                    filename: asset.filename,
                    mime: asset.mime,
                    size: asset.size || blob.size,
                });

                // Create row (selected by default)
                const row = this.buildImageRow(asset, blob, true);
                if (this.tbodyEl) {
                    this.tbodyEl.appendChild(row);
                }
                this.rowElements.set(asset.id, row);

                // Auto-select all assets
                this.selectedAssets.add(asset.id);
            } catch (error) {
                console.warn(`[ModalImageOptimizer] Failed to load asset ${asset.id}:`, error);
            }
        }

        // Show content
        this.setContentState('content');
        this.updateToggleAllState();
        this.updateSummary();

        // Auto-estimate all images in background
        if (this.selectedAssets.size > 0) {
            this.startAutoEstimate();
        }
    }

    /**
     * Start automatic estimation in background
     */
    async startAutoEstimate() {
        const selectedIds = Array.from(this.selectedAssets);
        console.log('[ModalImageOptimizer] Starting auto-estimate for', selectedIds.length, 'images');

        let p = null;
        try {
            p = this.optimizerManager.estimateSelected(selectedIds);
            this._estimatePromise = p;
            await p;
            // Enable optimize button after estimation completes
            this.updateButtons();
        } catch (error) {
            console.error('[ModalImageOptimizer] Auto-estimate error:', error);
        } finally {
            if (this._estimatePromise === p) {
                this._estimatePromise = null;
            }
        }
    }

    /**
     * Fetch asset blob from AssetManager
     * @param {string} assetId - Asset UUID
     * @returns {Promise<Blob|null>}
     */
    async fetchAssetBlob(assetId) {
        if (!this.assetManager) {
            return null;
        }

        try {
            // Try to get from IndexedDB first
            const blob = await this.assetManager.getBlob(assetId);
            if (blob) {
                return blob;
            }

            // Fallback: resolve asset URL and fetch
            const metadata = this.assetManager.getAssetMetadata(assetId);
            if (!metadata) {
                return null;
            }

            const assetUrl = this.assetManager.getAssetUrl(assetId, metadata.filename);
            const blobUrl = await this.assetManager.resolveAssetURL(assetUrl);
            if (!blobUrl) {
                return null;
            }

            const response = await fetch(blobUrl);
            return await response.blob();
        } catch (error) {
            console.warn(`[ModalImageOptimizer] Failed to fetch blob for ${assetId}:`, error);
            return null;
        }
    }

    /**
     * Build a table row for an image
     * @param {Object} asset - Asset metadata
     * @param {Blob} blob - Image blob
     * @param {boolean} selected - Initial selection state
     * @returns {HTMLElement}
     */
    buildImageRow(asset, blob, selected = false) {
        const tr = document.createElement('tr');
        tr.dataset.assetId = asset.id;

        // Checkbox cell
        const checkTd = document.createElement('td');
        checkTd.className = 'text-center';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'form-check-input image-optimizer-row-checkbox';
        checkbox.dataset.assetId = asset.id;
        checkbox.checked = selected;
        checkbox.addEventListener('change', () => this.onRowCheckboxChange(asset.id, checkbox.checked));
        checkTd.appendChild(checkbox);
        tr.appendChild(checkTd);

        // Thumbnail cell
        const thumbTd = document.createElement('td');
        const thumbImg = document.createElement('img');
        thumbImg.className = 'image-optimizer-thumbnail';
        thumbImg.style.cssText = 'width: 48px; height: 48px; object-fit: cover; border-radius: 4px;';
        thumbImg.src = URL.createObjectURL(blob);
        thumbImg.alt = asset.filename;
        thumbTd.appendChild(thumbImg);
        tr.appendChild(thumbTd);

        // Filename cell
        const nameTd = document.createElement('td');
        nameTd.className = 'image-optimizer-filename';
        nameTd.textContent = asset.filename;
        nameTd.title = asset.filename;
        nameTd.style.cssText = 'max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
        tr.appendChild(nameTd);

        // Type cell
        const typeTd = document.createElement('td');
        typeTd.className = 'image-optimizer-type';
        typeTd.textContent = asset.mime === 'image/png' ? 'PNG' : 'JPEG';
        tr.appendChild(typeTd);

        // Original size cell
        const sizeTd = document.createElement('td');
        sizeTd.className = 'image-optimizer-original-size';
        sizeTd.textContent = this.formatSize(asset.size || blob.size);
        tr.appendChild(sizeTd);

        // Estimated size cell
        const estimatedTd = document.createElement('td');
        estimatedTd.className = 'image-optimizer-estimated-size text-muted';
        estimatedTd.textContent = '-';
        tr.appendChild(estimatedTd);

        // Savings cell
        const savingsTd = document.createElement('td');
        savingsTd.className = 'image-optimizer-savings';
        savingsTd.textContent = '-';
        tr.appendChild(savingsTd);

        // Status cell
        const statusTd = document.createElement('td');
        statusTd.className = 'image-optimizer-status';
        statusTd.innerHTML = this.getStatusBadge(STATUS.PENDING);
        tr.appendChild(statusTd);

        return tr;
    }

    /**
     * Update a table row with new data
     * @param {string} assetId - Asset UUID
     * @param {Object} data - Updated data
     */
    updateImageRow(assetId, data) {
        const row = this.rowElements.get(assetId);
        if (!row) return;
        const isAlreadyOptimized = this.isAlreadyOptimized(data);
        const estimatedCell = row.querySelector('.image-optimizer-estimated-size');
        const savingsCell = row.querySelector('.image-optimizer-savings');

        // Update estimated size
        if (data.estimatedSize !== null && data.estimatedSize !== undefined) {
            if (estimatedCell) {
                estimatedCell.textContent = this.formatSize(data.estimatedSize);
                estimatedCell.classList.remove('text-muted');
            }
        }

        // Update optimized size (after optimization)
        if (data.optimizedSize !== null && data.optimizedSize !== undefined) {
            if (estimatedCell) {
                estimatedCell.textContent = this.formatSize(data.optimizedSize);
                estimatedCell.classList.add('fw-bold');
            }
        }

        // Update savings
        if (savingsCell) {
            const originalSize = data.originalSize || 0;
            const finalSize = data.optimizedSize || data.estimatedSize;
            if (finalSize !== null && finalSize !== undefined) {
                const savedBytes = originalSize - finalSize;
                const savedPercent = originalSize > 0 ? ((savedBytes / originalSize) * 100).toFixed(1) : 0;
                if (savedBytes > 0) {
                    savingsCell.innerHTML = `<span class="text-success">${this.formatSize(savedBytes)} (${savedPercent}%)</span>`;
                } else if (savedBytes < 0) {
                    savingsCell.innerHTML = `<span class="text-warning">+${this.formatSize(Math.abs(savedBytes))}</span>`;
                } else {
                    savingsCell.textContent = '0%';
                }
            }
        }

        if (isAlreadyOptimized) {
            if (estimatedCell) {
                estimatedCell.textContent = _('N/A');
                estimatedCell.classList.add('text-muted');
                estimatedCell.classList.remove('fw-bold');
            }
            if (savingsCell) {
                savingsCell.textContent = _('N/A');
            }
        }

        // Update status
        const statusCell = row.querySelector('.image-optimizer-status');
        if (statusCell) {
            const status = isAlreadyOptimized ? STATUS_ALREADY_OPTIMIZED : data.status;
            statusCell.innerHTML = this.getStatusBadge(status, data.error);
        }

        this.setAssetSelectable(assetId, !isAlreadyOptimized);

        // Highlight row when optimizing starts
        if (data.status === STATUS.OPTIMIZING && this.viewState === 'progress') {
            this.setCurrentProcessingItem(assetId, data.filename);
        }

        // Remove highlight when done
        if (data.status === STATUS.DONE || data.status === STATUS.FAILED) {
            row.classList.remove('table-warning');
        }

        // Update summary
        this.updateSummary();
    }

    /**
     * Get HTML for a status badge
     * @param {string} status - Status constant
     * @param {string|null} error - Error message if failed
     * @returns {string}
     */
    getStatusBadge(status, error = null) {
        if (status === STATUS_ALREADY_OPTIMIZED) {
            return `<span class="badge bg-secondary">${_('Already optimized')}</span>`;
        }
        const badgeGenerator = STATUS_BADGE_CONFIG[status];
        return badgeGenerator ? badgeGenerator(error) : '';
    }

    isAlreadyOptimized(data) {
        const originalSize = data.originalSize || 0;
        const finalSize = data.optimizedSize || data.estimatedSize;
        if (!originalSize || finalSize === null || finalSize === undefined) {
            return false;
        }

        const savedBytes = originalSize - finalSize;
        if (savedBytes <= 0) {
            return true;
        }

        const savedPercent = (savedBytes / originalSize) * 100;
        return savedPercent < ALREADY_OPTIMIZED_MIN_SAVINGS_PERCENT;
    }

    setAssetSelectable(assetId, selectable) {
        const row = this.rowElements.get(assetId);
        if (!row) return;

        row.dataset.selectable = selectable ? 'true' : 'false';
        const checkbox = row.querySelector('.image-optimizer-row-checkbox');
        if (!checkbox) return;

        if (!selectable) {
            checkbox.checked = false;
            this.selectedAssets.delete(assetId);
        }

        const canInteract = this.viewState === 'normal';
        checkbox.disabled = !selectable || !canInteract;
        this.updateSelectionState();
    }

    isAssetSelectable(assetId) {
        const row = this.rowElements.get(assetId);
        if (!row) return true;
        return row.dataset.selectable !== 'false';
    }

    /**
     * Format bytes to human readable size
     * @param {number} bytes - Size in bytes
     * @returns {string}
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    }

    /**
     * Handle row checkbox change
     * @param {string} assetId - Asset UUID
     * @param {boolean} checked - Whether checked
     */
    onRowCheckboxChange(assetId, checked) {
        if (!this.isAssetSelectable(assetId)) {
            this.setRowCheckboxState(assetId, false);
            this.selectedAssets.delete(assetId);
            this.updateSelectionState();
            return;
        }

        if (checked) {
            this.selectedAssets.add(assetId);
        } else {
            this.selectedAssets.delete(assetId);
        }
        this.updateSelectionState();
    }

    /**
     * Update all selection-dependent UI state
     */
    updateSelectionState() {
        this.updateToggleAllState();
        this.updateSummary();
        this.updateButtons();
    }

    /**
     * Select all images
     */
    selectAll() {
        for (const assetId of this.optimizerManager.queue.keys()) {
            if (!this.isAssetSelectable(assetId)) {
                continue;
            }
            this.selectedAssets.add(assetId);
            this.setRowCheckboxState(assetId, true);
        }
        this.updateSelectionState();
    }

    /**
     * Deselect all images
     */
    deselectAll() {
        this.selectedAssets.clear();
        for (const assetId of this.rowElements.keys()) {
            this.setRowCheckboxState(assetId, false);
        }
        this.updateSelectionState();
    }

    /**
     * Set the checkbox state for a row
     * @param {string} assetId - Asset UUID
     * @param {boolean} checked - Whether to check the checkbox
     */
    setRowCheckboxState(assetId, checked) {
        const row = this.rowElements.get(assetId);
        if (row) {
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');
            if (checkbox) checkbox.checked = checked;
        }
    }

    /**
     * Update the "toggle all" checkbox state
     */
    updateToggleAllState() {
        if (!this.toggleAllCheckbox) return;
        const queueKeys = this.optimizerManager?.queue?.keys?.();
        const assetIds = queueKeys ? Array.from(queueKeys) : Array.from(this.rowElements.keys());

        let total = 0;
        let selected = 0;
        for (const assetId of assetIds) {
            if (!this.isAssetSelectable(assetId)) {
                continue;
            }
            total++;
            if (this.selectedAssets.has(assetId)) {
                selected++;
            }
        }
        this.toggleAllCheckbox.checked = total > 0 && selected === total;
        this.toggleAllCheckbox.indeterminate = selected > 0 && selected < total;
    }

    /**
     * Update button states
     */
    updateButtons() {
        const hasSelection = this.selectedAssets.size > 0;
        const isProcessing = typeof this.optimizerManager?.isInProgress === 'function'
            ? this.optimizerManager.isInProgress()
            : false;

        // Optimize only enabled if at least one selected item is READY (estimated)
        let hasReadyItems = false;
        for (const assetId of this.selectedAssets) {
            const item = this.optimizerManager?.getQueueItem(assetId);
            if (item && item.status === STATUS.READY) {
                hasReadyItems = true;
                break;
            }
        }

        if (this.optimizeBtn) {
            this.optimizeBtn.disabled = !hasSelection || isProcessing || !hasReadyItems;
        }
    }

    /**
     * Update summary panel
     */
    updateSummary() {
        if (!this.summaryEl) return;

        const selectedIds = Array.from(this.selectedAssets);
        const stats = this.optimizerManager?.getStatsForSelection(selectedIds) || {
            selected: 0,
            totalOriginal: 0,
            totalEstimated: 0,
            savings: 0,
            savingsPercent: 0,
        };

        const selectedEl = this.summaryEl.querySelector('.summary-selected');
        const originalEl = this.summaryEl.querySelector('.summary-original');
        const estimatedEl = this.summaryEl.querySelector('.summary-estimated');
        const savingsEl = this.summaryEl.querySelector('.summary-savings');

        if (selectedEl) selectedEl.textContent = stats.selected;
        if (originalEl) originalEl.textContent = this.formatSize(stats.totalOriginal);
        if (estimatedEl) {
            estimatedEl.textContent = stats.totalEstimated > 0
                ? this.formatSize(stats.totalEstimated)
                : '-';
        }
        if (savingsEl) {
            if (stats.savings > 0) {
                savingsEl.textContent = `${this.formatSize(stats.savings)} (${stats.savingsPercent}%)`;
                savingsEl.className = 'summary-savings fs-5 text-success';
            } else {
                savingsEl.textContent = '-';
                savingsEl.className = 'summary-savings fs-5 text-success';
            }
        }
    }

    /**
     * Handle preset change
     */
    onPresetChange() {
        const preset = this.presetSelect?.value || 'medium';
        this.optimizerManager?.setPreset(preset);

        // Update quality slider to match preset
        const presetQualities = { light: 90, medium: 85, strong: 75 };
        if (this.qualitySlider && presetQualities[preset]) {
            this.qualitySlider.value = presetQualities[preset];
            if (this.qualityValue) {
                this.qualityValue.textContent = presetQualities[preset];
            }
        }

        // Re-analyze immediately with new settings
        this.reEstimate();
    }

    /**
     * Handle quality slider change
     */
    onQualityChange() {
        const quality = parseInt(this.qualitySlider?.value || '85', 10);
        if (this.qualityValue) {
            this.qualityValue.textContent = quality;
        }
        this.optimizerManager?.setJpegQuality(quality / 100);

        // Debounce re-analysis to avoid re-running on every slider tick
        clearTimeout(this._reEstimateTimeout);
        this._reEstimateTimeout = setTimeout(() => this.reEstimate(), 500);
    }

    /**
     * Cancel any ongoing estimation, reset all estimates, and re-estimate
     * with the current settings. Called when preset or quality settings change.
     */
    async reEstimate() {
        if (this.viewState !== 'normal') return;
        if (!this.optimizerManager) return;

        // Cancel and wait for any ongoing estimation to finish
        if (this.optimizerManager.isInProgress()) {
            this.optimizerManager.cancel();
            if (this._estimatePromise) {
                try {
                    await this._estimatePromise;
                } catch (_) {
                    // Ignore errors from cancelled estimation
                }
            }
        }

        // Reset all estimated/failed items back to PENDING
        this.optimizerManager.resetEstimates();

        // Re-enable items previously disabled as "already optimized" and re-add to selection,
        // since new settings may make them optimizable
        for (const [assetId, row] of this.rowElements.entries()) {
            if (row.dataset.selectable === 'false') {
                this.selectedAssets.add(assetId);
                const checkbox = row.querySelector('.image-optimizer-row-checkbox');
                if (checkbox) {
                    checkbox.checked = true;
                }
            }
        }

        // Update all rows to show PENDING state
        for (const assetId of this.rowElements.keys()) {
            const item = this.optimizerManager.getQueueItem(assetId);
            if (item) {
                this.updateImageRow(assetId, { ...item });
            }
        }

        this.updateSelectionState();

        // Restart estimation for all selected assets
        if (this.selectedAssets.size > 0) {
            this.startAutoEstimate();
        }
    }

    /**
     * Apply a view state configuration
     * @param {'normal'|'confirm'|'progress'} state - View state to apply
     */
    applyViewState(state) {
        // For confirm state, require selection
        if (state === 'confirm' && this.selectedAssets.size === 0) {
            return;
        }

        this.viewState = state;
        const config = VIEW_STATE_CONFIG[state];
        if (!config) return;

        // Apply visibility to panels
        if (this.confirmPanel) this.confirmPanel.classList.toggle('d-none', !config.confirmPanel);
        if (this.progressPanel) this.progressPanel.classList.toggle('d-none', !config.progressPanel);
        if (this.settingsPanel) this.settingsPanel.classList.toggle('d-none', !config.settingsPanel);

        // Apply visibility to footers
        if (this.footerNormal) this.footerNormal.classList.toggle('d-none', !config.footerNormal);
        if (this.footerConfirm) this.footerConfirm.classList.toggle('d-none', !config.footerConfirm);
        if (this.footerProgress) this.footerProgress.classList.toggle('d-none', !config.footerProgress);

        // Apply visibility to close button
        if (this.closeBtn) this.closeBtn.classList.toggle('d-none', !config.closeBtn);

        // Apply interactive state to rows
        this.setRowsInteractive(config.rowsInteractive);

        // Reset progress bar when entering progress state
        if (state === 'progress') {
            this.updateProgressBar(0, 1);
        }
    }

    /**
     * Set rows interactive state (checkboxes enabled/disabled)
     * @param {boolean} interactive - Whether rows should be interactive
     */
    setRowsInteractive(interactive) {
        for (const [assetId, row] of this.rowElements.entries()) {
            const checkbox = row.querySelector('.image-optimizer-row-checkbox');
            if (checkbox) {
                checkbox.disabled = !interactive || !this.isAssetSelectable(assetId);
            }
        }
        if (this.toggleAllCheckbox) {
            this.toggleAllCheckbox.disabled = !interactive;
        }
        if (this.selectAllBtn) {
            this.selectAllBtn.disabled = !interactive;
        }
        if (this.deselectAllBtn) {
            this.deselectAllBtn.disabled = !interactive;
        }
    }

    /**
     * Update progress bar
     * @param {number} current - Current item (1-based)
     * @param {number} total - Total items
     */
    updateProgressBar(current, total) {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;

        if (this.progressBar) {
            this.progressBar.style.width = `${percent}%`;
            this.progressBar.setAttribute('aria-valuenow', percent);
        }
        if (this.progressPercent) {
            this.progressPercent.textContent = `${percent}%`;
        }
    }

    /**
     * Set the current item being processed (highlight row)
     * @param {string|null} assetId - Asset being processed, or null to clear
     * @param {string} filename - Filename for display
     */
    setCurrentProcessingItem(assetId, filename = '') {
        // Remove highlight from all rows
        for (const row of this.rowElements.values()) {
            row.classList.remove('table-warning');
        }

        // Highlight current row
        if (assetId) {
            const row = this.rowElements.get(assetId);
            if (row) {
                row.classList.add('table-warning');
                // Scroll row into view
                row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }

        // Update progress detail text
        if (this.progressDetail) {
            this.progressDetail.textContent = filename ? `${_('Processing')}: ${filename}` : '';
        }
    }

    /**
     * Start the optimization process
     */
    async startOptimization() {
        const selectedIds = Array.from(this.selectedAssets);
        if (selectedIds.length === 0) return;

        // Show progress view
        this.applyViewState('progress');

        try {
            await this.optimizerManager.optimizeSelected(selectedIds);

            // Replace assets with optimized versions
            if (this.progressText) {
                this.progressText.textContent = _('Saving changes...');
            }
            await this.replaceOptimizedAssets(selectedIds);

            // Clear row highlight
            this.setCurrentProcessingItem(null);

            // Show success and return to normal view
            this.applyViewState('normal');

            eXeLearning.app.alerts?.showToast({
                type: 'success',
                message: _('Images optimized successfully'),
            });
        } catch (error) {
            console.error('[ModalImageOptimizer] Optimization error:', error);

            // Clear row highlight
            this.setCurrentProcessingItem(null);

            // Return to normal view on error
            this.applyViewState('normal');

            eXeLearning.app.alerts?.showToast({
                type: 'error',
                message: _('Error optimizing images'),
            });
        }

        this.updateButtons();
    }

    /**
     * Replace original assets with optimized versions
     * @param {string[]} assetIds - Asset IDs to replace
     */
    async replaceOptimizedAssets(assetIds) {
        if (!this.assetManager) {
            throw new Error('AssetManager not available');
        }

        let replacedAssetsCount = 0;

        for (const assetId of assetIds) {
            const item = this.optimizerManager.getQueueItem(assetId);
            if (!item || item.status !== STATUS.DONE || !item.optimizedBlob) {
                continue;
            }

            try {
                // Get current metadata
                const metadata = this.assetManager.getAssetMetadata(assetId);
                if (!metadata) continue;

                // Update filename extension if format changed
                let newFilename = metadata.filename;
                if (item.outputFormat === 'image/jpeg' && !newFilename.toLowerCase().endsWith('.jpg') && !newFilename.toLowerCase().endsWith('.jpeg')) {
                    // Changed from PNG to JPEG
                    newFilename = newFilename.replace(/\.png$/i, '.jpg');
                }

                // Replace the blob in IndexedDB
                await this.assetManager.putBlob(assetId, item.optimizedBlob);

                // Update metadata
                const newHash = await this.computeHash(item.optimizedBlob);
                this.assetManager.setAssetMetadata(assetId, {
                    ...metadata,
                    filename: newFilename,
                    mime: item.outputFormat,
                    size: item.optimizedBlob.size,
                    hash: newHash,
                    uploaded: false, // Mark as needing upload
                });

                // Invalidate blob URL cache and create new one
                const oldBlobURL = this.assetManager.blobURLCache.get(assetId);
                if (oldBlobURL) {
                    URL.revokeObjectURL(oldBlobURL);
                    this.assetManager.blobURLCache.delete(assetId);
                    this.assetManager.reverseBlobCache.delete(oldBlobURL);
                }
                // Create new blob URL for immediate availability
                const newBlobURL = URL.createObjectURL(item.optimizedBlob);
                this.assetManager.blobURLCache.set(assetId, newBlobURL);
                this.assetManager.reverseBlobCache.set(newBlobURL, assetId);

                // Refresh any already-rendered elements referencing this asset.
                if (typeof this.assetManager.updateDomImagesForAsset === 'function') {
                    await this.assetManager.updateDomImagesForAsset(assetId);
                }

                // Upload to server
                await this.uploadAsset(assetId, item.optimizedBlob, newFilename, item.outputFormat);
                replacedAssetsCount++;

            } catch (error) {
                console.error(`[ModalImageOptimizer] Failed to replace asset ${assetId}:`, error);
            }
        }

        // Notify peers once at the end so they can request updated blobs if needed.
        if (replacedAssetsCount > 0) {
            const bridge = eXeLearning?.app?.project?._yjsBridge;
            if (bridge && typeof bridge.announceAssets === 'function') {
                await bridge.announceAssets();
            }
        }
    }

    /**
     * Upload optimized asset to server
     * @param {string} assetId - Asset UUID
     * @param {Blob} blob - Optimized blob
     * @param {string} filename - Filename
     * @param {string} mime - MIME type
     */
    async uploadAsset(assetId, blob, filename, mime) {
        const projectUuid = eXeLearning.app.project?.getProjectUuid();
        if (!projectUuid) {
            throw new Error('Project UUID not available');
        }

        const formData = new FormData();
        formData.append('file', blob, filename);
        formData.append('clientId', assetId);

        const basePath = eXeLearning.basePath || '';
        const response = await fetch(`${basePath}/api/projects/${projectUuid}/assets`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        // Mark as uploaded in Yjs
        if (this.assetManager) {
            const metadata = this.assetManager.getAssetMetadata(assetId);
            if (metadata) {
                this.assetManager.setAssetMetadata(assetId, {
                    ...metadata,
                    uploaded: true,
                });
            }
        }
    }

    /**
     * Compute SHA-256 hash of blob
     * @param {Blob} blob - Blob to hash
     * @returns {Promise<string>}
     */
    async computeHash(blob) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Handle progress updates
     * @param {number} current - Current item (1-based count of completed items)
     * @param {number} total - Total items
     * @param {string} phase - 'estimate' or 'optimize'
     */
    onProgress(current, total, phase) {
        console.log(`[ModalImageOptimizer] ${phase}: ${current}/${total}`);

        // Only show visual progress during optimization (not estimation)
        if (phase === 'optimize' && this.viewState === 'progress') {
            // Update progress bar (current is count of completed items)
            this.updateProgressBar(current, total);
        }
    }

    /**
     * Handle estimation complete
     */
    onEstimateComplete() {
        this.updateButtons();
        this.updateSummary();
    }

    /**
     * Handle optimization complete
     */
    onOptimizeComplete() {
        this.updateButtons();
        this.updateSummary();
    }

    /**
     * Handle errors
     * @param {string|null} assetId - Asset that failed
     * @param {string} error - Error message
     */
    onError(assetId, error) {
        console.error(`[ModalImageOptimizer] Error for ${assetId}:`, error);
    }

    /**
     * Clean up when modal is hidden
     */
    onHide() {
        // Clear any pending re-estimate timeout
        clearTimeout(this._reEstimateTimeout);
        this._reEstimateTimeout = null;

        // Terminate worker
        if (this.optimizerManager) {
            this.optimizerManager.cancel();
            this.optimizerManager.terminateWorker();
            this.optimizerManager = null;
        }

        // Revoke thumbnail URLs
        for (const row of this.rowElements.values()) {
            const img = row.querySelector('.image-optimizer-thumbnail');
            if (img && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
            }
        }

        this.rowElements.clear();
        this.selectedAssets.clear();
        this.viewState = 'normal';

        // Reset view state for next open
        this.applyViewState('normal');
    }
}

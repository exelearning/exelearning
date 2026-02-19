/**
 * ImageOptimizerManager
 *
 * Manages the image optimization queue and coordinates with the Web Worker.
 * Handles state transitions for each asset:
 * pending -> estimating -> ready -> optimizing -> done/failed
 *
 * @example
 * const manager = new ImageOptimizerManager();
 * manager.onAssetUpdate = (assetId, data) => updateUI(assetId, data);
 * manager.onProgress = (current, total, phase) => updateProgress(current, total);
 * await manager.addAsset(assetId, blob, metadata);
 * await manager.estimateSelected([assetId]);
 * await manager.optimizeSelected([assetId]);
 */

// Preset quality mappings
const PRESET_SETTINGS = {
    light: { pngQuality: 0.95, jpegQuality: 0.90 },
    medium: { pngQuality: 0.85, jpegQuality: 0.85 },
    strong: { pngQuality: 0.70, jpegQuality: 0.75 },
};

/**
 * Status constants for queue items
 */
export const STATUS = {
    PENDING: 'pending',
    ESTIMATING: 'estimating',
    READY: 'ready',
    OPTIMIZING: 'optimizing',
    DONE: 'done',
    FAILED: 'failed',
};

/**
 * Worker message handlers mapping message type to handler function
 * Each handler receives (item, rest) and mutates the item
 */
const WORKER_MESSAGE_HANDLERS = {
    estimated: (item, rest) => {
        if (rest.success) {
            item.status = STATUS.READY;
            item.estimatedSize = rest.estimatedSize;
            item.hasAlpha = rest.hasAlpha;
            item.outputFormat = rest.outputFormat;
        } else {
            item.status = STATUS.FAILED;
            item.error = rest.error;
        }
    },
    optimized: (item, rest) => {
        if (rest.success) {
            item.status = STATUS.DONE;
            item.optimizedSize = rest.optimizedSize;
            item.optimizedBlob = rest.optimizedBlob;
            item.hasAlpha = rest.hasAlpha;
            item.outputFormat = rest.outputFormat;
        } else {
            item.status = STATUS.FAILED;
            item.error = rest.error;
        }
    },
    error: (item, rest) => {
        item.status = STATUS.FAILED;
        item.error = rest.error;
    },
};

/**
 * ImageOptimizerManager class
 */
export default class ImageOptimizerManager {
    constructor() {
        /** @type {Map<string, QueueItem>} */
        this.queue = new Map();

        /** @type {Worker|null} */
        this.worker = null;

        /** @type {boolean} */
        this.workerReady = false;

        /** @type {Object} */
        this.settings = {
            preset: 'medium',
            jpegQuality: 0.85,
        };

        /** @type {boolean} */
        this.isProcessing = false;

        /** @type {boolean} */
        this.cancelled = false;

        // Callbacks (set by modal)
        /** @type {Function|null} */
        this.onAssetUpdate = null;

        /** @type {Function|null} */
        this.onProgress = null;

        /** @type {Function|null} */
        this.onEstimateComplete = null;

        /** @type {Function|null} */
        this.onOptimizeComplete = null;

        /** @type {Function|null} */
        this.onError = null;

        // Pending worker messages (waiting for worker response)
        /** @type {Map<string, {resolve: Function, reject: Function}>} */
        this.pendingMessages = new Map();
    }

    /**
     * Initialize the Web Worker
     * @returns {Promise<void>}
     */
    async initWorker() {
        if (this.worker) {
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                // Get base path, handling static mode subdirectory deployments
                let basePath = window.eXeLearning?.basePath || '';
                if (!basePath) {
                    // In static mode, derive basePath from current document location
                    // This handles subdirectory deployments like /pr-preview/pr-20/
                    const pathname = window.location.pathname;
                    // Remove workarea.html or workarea/ to get the base directory
                    basePath = pathname.replace(/\/workarea(\.html)?\/?$/, '').replace(/\/$/, '');
                }
                const workerUrl = `${basePath}/app/workarea/utils/ImageOptimizerWorker.js`;
                this.worker = new Worker(workerUrl);

                this.worker.onmessage = (event) => {
                    this.handleWorkerMessage(event.data);
                };

                this.worker.onerror = (error) => {
                    console.error('[ImageOptimizerManager] Worker error:', error);
                    if (this.onError) {
                        this.onError(null, error.message);
                    }
                    reject(error);
                };

                // Wait for worker ready signal
                const readyHandler = (event) => {
                    if (event.data.type === 'ready') {
                        this.workerReady = true;
                        resolve();
                    }
                };
                this.worker.addEventListener('message', readyHandler, { once: true });

                // Timeout after 5 seconds
                setTimeout(() => {
                    if (!this.workerReady) {
                        reject(new Error('Worker initialization timeout'));
                    }
                }, 5000);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Terminate the Web Worker
     */
    terminateWorker() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.workerReady = false;
        }
    }

    /**
     * Handle messages from the worker
     * @param {Object} data - Message data
     */
    handleWorkerMessage(data) {
        const { type, assetId, ...rest } = data;

        if (type === 'ready') {
            return;
        }

        const item = this.queue.get(assetId);
        if (!item) {
            console.warn(`[ImageOptimizerManager] Unknown assetId: ${assetId}`);
            return;
        }

        // Apply the handler for this message type
        const handler = WORKER_MESSAGE_HANDLERS[type];
        if (handler) {
            handler(item, rest);

            // Trigger error callback for error type
            if (type === 'error' && this.onError) {
                this.onError(assetId, rest.error);
            }
        }

        // Notify callback
        if (this.onAssetUpdate) {
            this.onAssetUpdate(assetId, { ...item });
        }

        // Resolve pending promise
        const pending = this.pendingMessages.get(assetId);
        if (pending) {
            this.pendingMessages.delete(assetId);
            pending.resolve(item);
        }
    }

    /**
     * Send a message to the worker and wait for response
     * @param {string} type - Message type
     * @param {string} assetId - Asset ID
     * @param {Blob} blob - Image blob
     * @returns {Promise<Object>}
     */
    async processInWorker(type, assetId, blob) {
        if (!this.worker || !this.workerReady) {
            await this.initWorker();
        }

        return new Promise((resolve, reject) => {
            this.pendingMessages.set(assetId, { resolve, reject });

            const settings = {
                preset: this.settings.preset,
                ...PRESET_SETTINGS[this.settings.preset],
                jpegQuality: this.settings.jpegQuality,
            };

            this.worker.postMessage({
                type,
                assetId,
                blob,
                settings,
            });
        });
    }

    /**
     * Add an asset to the queue
     * @param {string} assetId - Asset UUID
     * @param {Blob} blob - Image blob data
     * @param {Object} metadata - Asset metadata (filename, mime, size)
     */
    addAsset(assetId, blob, metadata) {
        this.queue.set(assetId, {
            assetId,
            filename: metadata.filename,
            mime: metadata.mime,
            blob,
            status: STATUS.PENDING,
            originalSize: metadata.size || blob.size,
            estimatedSize: null,
            optimizedSize: null,
            optimizedBlob: null,
            error: null,
            hasAlpha: null,
            outputFormat: null,
        });
    }

    /**
     * Remove an asset from the queue
     * @param {string} assetId - Asset UUID
     */
    removeAsset(assetId) {
        this.queue.delete(assetId);
    }

    /**
     * Clear all assets from the queue
     */
    clearQueue() {
        this.queue.clear();
    }

    /**
     * Get a queue item by asset ID
     * @param {string} assetId - Asset UUID
     * @returns {Object|undefined}
     */
    getQueueItem(assetId) {
        return this.queue.get(assetId);
    }

    /**
     * Get all queue items
     * @returns {Array<Object>}
     */
    getAllItems() {
        return Array.from(this.queue.values());
    }

    /**
     * Set compression preset
     * @param {string} preset - 'light' | 'medium' | 'strong'
     */
    setPreset(preset) {
        if (PRESET_SETTINGS[preset]) {
            this.settings.preset = preset;
            this.settings.jpegQuality = PRESET_SETTINGS[preset].jpegQuality;
        }
    }

    /**
     * Set JPEG quality (overrides preset)
     * @param {number} quality - Quality 0-1 or 0-100
     */
    setJpegQuality(quality) {
        // Normalize to 0-1 range
        this.settings.jpegQuality = quality > 1 ? quality / 100 : quality;
    }

    /**
     * Reset estimation results for items that have been estimated (READY/FAILED/ESTIMATING)
     * back to PENDING state, so they can be re-estimated with new settings.
     * Items in DONE or OPTIMIZING state are left unchanged.
     */
    resetEstimates() {
        for (const item of this.queue.values()) {
            if (item.status === STATUS.READY || item.status === STATUS.FAILED || item.status === STATUS.ESTIMATING) {
                item.status = STATUS.PENDING;
                item.estimatedSize = null;
                item.hasAlpha = null;
                item.outputFormat = null;
                item.error = null;
            }
        }
    }

    /**
     * Get current settings
     * @returns {Object}
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Process items sequentially (shared logic for estimate and optimize)
     * @param {string[]} assetIds - Array of asset IDs to process
     * @param {string} workerType - Worker message type ('estimate' or 'optimize')
     * @param {string} processingStatus - Status to set during processing
     * @param {string} phase - Phase name for progress callback
     * @returns {Promise<void>}
     */
    async processItems(assetIds, workerType, processingStatus, phase) {
        if (this.isProcessing) {
            throw new Error('Already processing');
        }

        this.isProcessing = true;
        this.cancelled = false;

        let processed = 0;
        const total = assetIds.length;

        try {
            for (const assetId of assetIds) {
                if (this.cancelled) {
                    break;
                }

                const item = this.queue.get(assetId);
                if (!item) {
                    continue;
                }

                // Update status
                item.status = processingStatus;
                if (this.onAssetUpdate) {
                    this.onAssetUpdate(assetId, { ...item });
                }

                // Process in worker
                await this.processInWorker(workerType, assetId, item.blob);

                processed++;
                if (this.onProgress) {
                    this.onProgress(processed, total, phase);
                }
            }
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Estimate selected assets sequentially
     * @param {string[]} assetIds - Array of asset IDs to estimate
     * @returns {Promise<Object>} - Stats after estimation
     */
    async estimateSelected(assetIds) {
        await this.processItems(assetIds, 'estimate', STATUS.ESTIMATING, 'estimate');

        const stats = this.getStats();
        if (this.onEstimateComplete) {
            this.onEstimateComplete(stats);
        }

        return stats;
    }

    /**
     * Optimize selected assets sequentially
     * @param {string[]} assetIds - Array of asset IDs to optimize
     * @returns {Promise<Object>} - Stats after optimization
     */
    async optimizeSelected(assetIds) {
        await this.processItems(assetIds, 'optimize', STATUS.OPTIMIZING, 'optimize');

        const stats = this.getStats();
        if (this.onOptimizeComplete) {
            this.onOptimizeComplete(stats);
        }

        return stats;
    }

    /**
     * Cancel current processing
     */
    cancel() {
        this.cancelled = true;
    }

    /**
     * Check if processing is in progress
     * @returns {boolean}
     */
    isInProgress() {
        return this.isProcessing;
    }

    /**
     * Get statistics for the queue
     * @returns {Object}
     */
    getStats() {
        let total = 0;
        let estimated = 0;
        let optimized = 0;
        let failed = 0;
        let totalOriginal = 0;
        let totalEstimated = 0;
        let totalOptimized = 0;

        for (const item of this.queue.values()) {
            total++;
            totalOriginal += item.originalSize;

            switch (item.status) {
                case STATUS.READY:
                    estimated++;
                    totalEstimated += item.estimatedSize || 0;
                    break;
                case STATUS.DONE:
                    optimized++;
                    totalOptimized += item.optimizedSize || 0;
                    break;
                case STATUS.FAILED:
                    failed++;
                    break;
            }
        }

        const savings = totalOriginal - (totalOptimized || totalEstimated);
        const savingsPercent = totalOriginal > 0
            ? ((savings / totalOriginal) * 100).toFixed(1)
            : 0;

        return {
            total,
            estimated,
            optimized,
            failed,
            totalOriginal,
            totalEstimated,
            totalOptimized,
            savings,
            savingsPercent,
        };
    }

    /**
     * Get stats for selected assets only
     * @param {string[]} assetIds - Array of asset IDs
     * @returns {Object}
     */
    getStatsForSelection(assetIds) {
        let totalOriginal = 0;
        let totalEstimated = 0;

        for (const assetId of assetIds) {
            const item = this.queue.get(assetId);
            if (item) {
                totalOriginal += item.originalSize;
                if (item.estimatedSize !== null) {
                    totalEstimated += item.estimatedSize;
                }
            }
        }

        const savings = totalEstimated > 0 ? totalOriginal - totalEstimated : 0;
        const savingsPercent = totalOriginal > 0 && totalEstimated > 0
            ? ((savings / totalOriginal) * 100).toFixed(1)
            : 0;

        return {
            selected: assetIds.length,
            totalOriginal,
            totalEstimated,
            savings,
            savingsPercent,
        };
    }
}

/**
 * LinkValidationManager
 *
 * Manages progressive link validation state and coordinates
 * between the API and the UI.
 */

import SSEClient from '../../rest/SSEClient.js';

/**
 * @typedef {'pending' | 'validating' | 'valid' | 'broken'} LinkStatus
 */

/**
 * @typedef {Object} LinkState
 * @property {string} id - Unique link ID
 * @property {string} url - The link URL
 * @property {number} count - Number of occurrences
 * @property {string} pageName - Page where link appears
 * @property {string} blockName - Block where link appears
 * @property {string} ideviceType - Type of iDevice
 * @property {string} order - Order in block
 * @property {LinkStatus} status - Current validation status
 * @property {string|null} error - Error message if broken
 */

/**
 * @typedef {Object} ValidationStats
 * @property {number} total - Total number of links
 * @property {number} validated - Number of validated links
 * @property {number} valid - Number of valid links
 * @property {number} broken - Number of broken links
 * @property {number} pending - Number of pending links
 */

export default class LinkValidationManager {
    constructor() {
        /** @type {Map<string, LinkState>} */
        this.links = new Map();

        /** @type {Object|null} */
        this.streamHandle = null;

        /** @type {boolean} */
        this.isValidating = false;

        /** @type {boolean} */
        this.isCancelled = false;

        // Callbacks
        /** @type {Function|null} */
        this.onLinksExtracted = null;

        /** @type {Function|null} */
        this.onLinkUpdate = null;

        /** @type {Function|null} */
        this.onProgress = null;

        /** @type {Function|null} */
        this.onComplete = null;

        /** @type {Function|null} */
        this.onError = null;
    }

    /**
     * Start the validation process
     *
     * @param {Array<Object>} idevices - Array of idevice content objects
     * @returns {Promise<void>}
     */
    async startValidation(idevices) {
        if (this.isValidating) {
            console.warn('[LinkValidationManager] Validation already in progress');
            return;
        }

        this.isValidating = true;
        this.isCancelled = false;
        this.links.clear();

        try {
            // Step 1: Extract links from idevices (fast)
            const extractResponse = await this._extractLinks(idevices);

            if (!extractResponse || !extractResponse.links) {
                throw new Error('Failed to extract links');
            }

            // Initialize link states as pending
            for (const link of extractResponse.links) {
                this.links.set(link.id, {
                    ...link,
                    status: 'pending',
                    error: null,
                });
            }

            // Notify UI that links are ready to display
            if (this.onLinksExtracted) {
                this.onLinksExtracted(this.getAllLinks(), this.getStats());
            }

            // If no links to validate, complete immediately
            if (extractResponse.links.length === 0) {
                this.isValidating = false;
                if (this.onComplete) {
                    this.onComplete(this.getStats(), this.isCancelled);
                }
                return;
            }

            // Step 2: Start streaming validation
            await this._validateLinksStream(extractResponse.links);
        } catch (error) {
            this.isValidating = false;
            if (this.onError) {
                this.onError(error);
            } else {
                console.error('[LinkValidationManager] Error:', error);
            }
        }
    }

    /**
     * Extract links from idevices via API
     *
     * @param {Array<Object>} idevices
     * @returns {Promise<Object>}
     * @private
     */
    async _extractLinks(idevices) {
        const sessionId = eXeLearning?.app?.project?.odeSession;
        return await eXeLearning.app.api.extractLinksForValidation({
            odeSessionId: sessionId,
            idevices,
        });
    }

    /**
     * Start streaming validation via SSE
     *
     * @param {Array<Object>} links
     * @returns {Promise<void>}
     * @private
     */
    async _validateLinksStream(links) {
        return new Promise((resolve, reject) => {
            const streamUrl = eXeLearning.app.api.getLinkValidationStreamUrl();

            // If no stream URL available (static mode), skip validation
            // and mark all links as "unvalidated" (not broken, just not checked)
            if (!streamUrl) {
                console.log('[LinkValidationManager] No validation stream URL available - skipping server validation');
                this.isValidating = false;

                // Mark links as "valid" (unvalidated) since we can't check them
                // In static mode, we just show the links without validation status
                for (const link of this.links.values()) {
                    link.status = 'valid'; // Show as valid (green checkmark)
                    link.error = null;

                    if (this.onLinkUpdate) {
                        this.onLinkUpdate(link.id, link.status, link.error, link);
                    }

                    if (this.onProgress) {
                        this.onProgress(this.getStats());
                    }
                }

                if (this.onComplete) {
                    this.onComplete(this.getStats(), false);
                }
                resolve();
                return;
            }

            this.streamHandle = SSEClient.createStream(
                streamUrl,
                { links },
                {
                    onEvent: (event) => this._handleStreamEvent(event),
                    onComplete: (result) => {
                        this.isValidating = false;
                        this.streamHandle = null;

                        if (result?.cancelled) {
                            this.isCancelled = true;
                        }

                        if (this.onComplete) {
                            this.onComplete(this.getStats(), this.isCancelled);
                        }
                        resolve();
                    },
                    onError: (error) => {
                        this.isValidating = false;
                        this.streamHandle = null;
                        reject(error);
                    },
                }
            );
        });
    }

    /**
     * Handle a stream event
     *
     * @param {Object} event
     * @private
     */
    _handleStreamEvent(event) {
        if (event.event === 'link-validated') {
            const { id, status, error } = event.data;
            const link = this.links.get(id);

            if (link) {
                link.status = status;
                link.error = error;

                if (this.onLinkUpdate) {
                    this.onLinkUpdate(id, status, error, link);
                }

                if (this.onProgress) {
                    this.onProgress(this.getStats());
                }
            }
        } else if (event.event === 'done') {
            // Will be handled by onComplete callback
        }
    }

    /**
     * Cancel the validation process
     */
    cancel() {
        if (this.streamHandle) {
            this.streamHandle.cancel();
            this.streamHandle = null;
        }
        this.isCancelled = true;
    }

    /**
     * Get validation statistics
     *
     * @returns {ValidationStats}
     */
    getStats() {
        let valid = 0;
        let broken = 0;
        let pending = 0;

        for (const link of this.links.values()) {
            switch (link.status) {
                case 'valid':
                    valid++;
                    break;
                case 'broken':
                    broken++;
                    break;
                case 'pending':
                case 'validating':
                    pending++;
                    break;
            }
        }

        const total = this.links.size;
        const validated = valid + broken;

        return { total, validated, valid, broken, pending };
    }

    /**
     * Get all links as an array
     *
     * @returns {Array<LinkState>}
     */
    getAllLinks() {
        return Array.from(this.links.values());
    }

    /**
     * Get only broken links
     *
     * @returns {Array<LinkState>}
     */
    getBrokenLinks() {
        return this.getAllLinks().filter((link) => link.status === 'broken');
    }

    /**
     * Get only valid links
     *
     * @returns {Array<LinkState>}
     */
    getValidLinks() {
        return this.getAllLinks().filter((link) => link.status === 'valid');
    }

    /**
     * Get a single link by ID
     *
     * @param {string} id
     * @returns {LinkState|undefined}
     */
    getLinkById(id) {
        return this.links.get(id);
    }

    /**
     * Check if validation is in progress
     *
     * @returns {boolean}
     */
    isInProgress() {
        return this.isValidating;
    }

    /**
     * Check if validation was cancelled
     *
     * @returns {boolean}
     */
    wasCancelled() {
        return this.isCancelled;
    }

    /**
     * Reset the manager state
     */
    reset() {
        this.cancel();
        this.links.clear();
        this.isValidating = false;
        this.isCancelled = false;
    }

    /**
     * Convert links to CSV format for download
     *
     * @param {boolean} onlyBroken - If true, only include broken links
     * @returns {Array<Object>}
     */
    toExportFormat(onlyBroken = true) {
        const links = onlyBroken ? this.getBrokenLinks() : this.getAllLinks();

        return links.map((link) => ({
            brokenLinks: link.url,
            brokenLinksError: link.error || '',
            nTimesBrokenLinks: link.count,
            pageNamesBrokenLinks: link.pageName,
            blockNamesBrokenLinks: link.blockName,
            typeComponentSyncBrokenLinks: link.ideviceType,
            orderComponentSyncBrokenLinks: link.order,
        }));
    }
}

/**
 * EmbeddingBridge
 * Provides postMessage API for embedding eXeLearning in iframes.
 *
 * Enables parent windows (WordPress, Moodle, etc.) to:
 * - Open project files
 * - Request save/export
 * - Receive editor status updates
 *
 * Security:
 * - Only accepts messages from trusted origins
 * - Validates message structure before processing
 * - Responds only to the origin that sent the request
 *
 * Usage:
 *   const bridge = new EmbeddingBridge(app);
 *   bridge.init();
 */

// Use global AppLogger for debug-controlled logging
const getLogger = () => window.AppLogger || console;

export default class EmbeddingBridge {
    /**
     * @param {App} app - The main eXeLearning App instance
     * @param {Object} options - Configuration options
     * @param {string[]} [options.trustedOrigins=[]] - List of trusted origins (empty = trust all)
     */
    constructor(app, options = {}) {
        this.app = app;
        this.trustedOrigins = options.trustedOrigins || [];
        this.parentOrigin = null;
        this.version = window.eXeLearning?.version || 'unknown';
        this.messageHandler = null;

        // Pending requests awaiting response
        this.pendingRequests = new Map();
    }

    /**
     * Initialize the embedding bridge
     * Sets up message listener and announces ready state
     */
    init() {
        // Only initialize if we're in an iframe
        if (window.parent === window) {
            getLogger().log('[EmbeddingBridge] Not in iframe, skipping initialization');
            return;
        }

        // Setup message handler
        this.messageHandler = this.handleMessage.bind(this);
        window.addEventListener('message', this.messageHandler);

        // Announce ready state to parent (use '*' since we don't know origin yet)
        window.parent.postMessage({
            type: 'EXELEARNING_READY',
            version: this.version,
            capabilities: this.getCapabilities(),
        }, '*');

        getLogger().log('[EmbeddingBridge] Initialized, announced ready to parent');
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
        this.pendingRequests.clear();
    }

    /**
     * Get supported capabilities
     * @returns {string[]}
     */
    getCapabilities() {
        return [
            'OPEN_FILE',         // Open .elpx file from bytes
            'REQUEST_SAVE',      // Get current project as bytes
            'GET_PROJECT_INFO',  // Get project metadata
        ];
    }

    /**
     * Handle incoming postMessage
     * @param {MessageEvent} event
     */
    async handleMessage(event) {
        // Security: Check origin if trusted origins are configured
        if (this.trustedOrigins.length > 0) {
            if (!this.trustedOrigins.includes(event.origin)) {
                getLogger().warn('[EmbeddingBridge] Rejected message from untrusted origin:', event.origin);
                return;
            }
        }

        // Validate message structure
        const { type, data, requestId } = event.data || {};
        if (!type) {
            return; // Ignore messages without type
        }

        // Store parent origin for responses
        this.parentOrigin = event.origin;

        getLogger().log(`[EmbeddingBridge] Received message: ${type}`);

        try {
            switch (type) {
                case 'SET_TRUSTED_ORIGINS':
                    this.handleSetTrustedOrigins(data, requestId);
                    break;

                case 'OPEN_FILE':
                    await this.handleOpenFile(data, requestId);
                    break;

                case 'REQUEST_SAVE':
                    await this.handleSaveRequest(requestId);
                    break;

                case 'GET_PROJECT_INFO':
                    await this.handleGetProjectInfo(requestId);
                    break;

                default:
                    // Unknown message type, ignore
                    break;
            }
        } catch (error) {
            getLogger().error(`[EmbeddingBridge] Error handling ${type}:`, error);
            this.postToParent({
                type: `${type}_ERROR`,
                requestId,
                error: error.message || 'Unknown error',
            });
        }
    }

    /**
     * Handle SET_TRUSTED_ORIGINS message
     * @param {Object} data
     * @param {string} requestId
     */
    handleSetTrustedOrigins(data, requestId) {
        if (data?.origins && Array.isArray(data.origins)) {
            this.trustedOrigins = data.origins;
            getLogger().log('[EmbeddingBridge] Trusted origins updated:', this.trustedOrigins);
        }

        this.postToParent({
            type: 'SET_TRUSTED_ORIGINS_SUCCESS',
            requestId,
        });
    }

    /**
     * Handle OPEN_FILE message
     * Opens a project from provided file bytes
     * @param {Object} data - { bytes: ArrayBuffer, filename: string }
     * @param {string} requestId
     */
    async handleOpenFile(data, requestId) {
        if (!data?.bytes) {
            throw new Error('Missing file bytes');
        }

        const filename = data.filename || 'project.elpx';
        const file = new File([data.bytes], filename, { type: 'application/zip' });

        // Generate project UUID
        const uuid = crypto.randomUUID();
        window.eXeLearning.projectId = uuid;

        // Import the file
        const project = this.app.project;
        if (project && typeof project.importElpxFile === 'function') {
            await project.importElpxFile(file);
        } else if (project?._yjsBridge?.importer) {
            await project._yjsBridge.importer.importFromFile(file);
        } else {
            throw new Error('Project import not available');
        }

        this.postToParent({
            type: 'OPEN_FILE_SUCCESS',
            requestId,
            projectId: uuid,
        });
    }

    /**
     * Handle REQUEST_SAVE message
     * Exports current project and sends bytes to parent
     * @param {string} requestId
     */
    async handleSaveRequest(requestId) {
        const project = this.app.project;

        // Try to export using available methods
        let blob;
        let filename;

        if (project && typeof project.exportToElpxBlob === 'function') {
            blob = await project.exportToElpxBlob();
            filename = project.getExportFilename?.() || 'project.elpx';
        } else if (project?._yjsBridge?.exporter) {
            blob = await project._yjsBridge.exporter.exportToBlob();
            filename = project._yjsBridge.exporter.buildFilename?.() || 'project.elpx';
        } else {
            throw new Error('Export not available');
        }

        // Convert blob to ArrayBuffer
        const bytes = await blob.arrayBuffer();

        this.postToParent({
            type: 'SAVE_FILE',
            requestId,
            bytes,
            filename,
            size: bytes.byteLength,
        });
    }

    /**
     * Handle GET_PROJECT_INFO message
     * Returns metadata about the current project
     * @param {string} requestId
     */
    async handleGetProjectInfo(requestId) {
        const project = this.app.project;
        const documentManager = project?._yjsBridge?.documentManager;

        if (!documentManager) {
            throw new Error('No project loaded');
        }

        const metadata = documentManager.getMetadata();
        const navigation = documentManager.getNavigation();

        this.postToParent({
            type: 'PROJECT_INFO',
            requestId,
            projectId: project._yjsBridge.projectId,
            title: metadata?.get('title') || 'Untitled',
            author: metadata?.get('author') || '',
            description: metadata?.get('description') || '',
            language: metadata?.get('language') || 'en',
            theme: metadata?.get('theme') || 'base',
            pageCount: navigation?.length || 0,
            modifiedAt: metadata?.get('modifiedAt'),
        });
    }

    /**
     * Post message to parent window
     * @param {Object} message - Message to send
     */
    postToParent(message) {
        if (window.parent !== window && this.parentOrigin) {
            try {
                window.parent.postMessage(message, this.parentOrigin);
            } catch (e) {
                // If origin validation fails, try with '*' for same-origin iframes
                if (e.name === 'DataCloneError') {
                    getLogger().error('[EmbeddingBridge] Cannot serialize message:', e);
                } else {
                    window.parent.postMessage(message, '*');
                }
            }
        }
    }

    /**
     * Notify parent of project state change
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    notifyParent(event, data = {}) {
        this.postToParent({
            type: 'EXELEARNING_EVENT',
            event,
            data,
        });
    }

    /**
     * Notify parent that the project has been modified
     */
    notifyDirty() {
        this.notifyParent('PROJECT_DIRTY', { isDirty: true });
    }

    /**
     * Notify parent that the project was saved
     */
    notifySaved() {
        this.notifyParent('PROJECT_SAVED', { isDirty: false });
    }
}

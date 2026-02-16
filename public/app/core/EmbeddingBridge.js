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

import { applyHideUI } from './ui-visibility.js';

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

        this._documentReadyHandler = null;
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

        // Listen for document ready and announce DOCUMENT_LOADED to parent
        this._listenForDocumentReady();

        getLogger().log('[EmbeddingBridge] Initialized, announced ready to parent');
    }

    /**
     * Listen for window.eXeLearning.documentReady and send DOCUMENT_LOADED to parent
     * @private
     */
    _listenForDocumentReady() {
        this._documentReadyHandler = this._announceDocumentLoaded.bind(this);

        const documentReady = window.eXeLearning?.documentReady;
        if (!documentReady || typeof documentReady.then !== 'function') {
            window.addEventListener('EXE_DOCUMENT_READY', this._documentReadyHandler);
            return;
        }

        documentReady.then(() => this._announceDocumentLoaded());
        window.addEventListener('EXE_DOCUMENT_READY', this._documentReadyHandler);
    }

    /**
     * Announce document readiness to the parent window
     * @private
     */
    _announceDocumentLoaded() {
        const bridge = this.app.project?._yjsBridge;
        const documentManager = bridge?.documentManager;
        const navigation = documentManager?.getNavigation?.();

        window.parent.postMessage({
            type: 'DOCUMENT_LOADED',
            projectId: bridge?.projectId || null,
            isDirty: documentManager?.isDirty || false,
            pageCount: navigation?.length || 0,
        }, this.parentOrigin || '*');

        getLogger().log('[EmbeddingBridge] Announced DOCUMENT_LOADED to parent');
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
        if (this._documentReadyHandler) {
            window.removeEventListener('EXE_DOCUMENT_READY', this._documentReadyHandler);
            this._documentReadyHandler = null;
        }
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
            'REQUEST_EXPORT',    // Export project in any format
            'GET_STATE',         // Get editor state (dirty, page count)
            'CONFIGURE',         // Runtime UI configuration
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

                case 'REQUEST_EXPORT':
                    await this.handleExportRequest(data, requestId);
                    break;

                case 'GET_STATE':
                    this.handleGetState(requestId);
                    break;

                case 'CONFIGURE':
                    this.handleConfigure(data, requestId);
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

        // Import the file using the current ProjectManager API, with legacy fallbacks.
        const project = this.app.project;
        if (project && typeof project.importElpDirectly === 'function') {
            await project.importElpDirectly(file, { clearExisting: true });
        } else if (project && typeof project.importFromElpxViaYjs === 'function') {
            await project.importFromElpxViaYjs(file, { clearExisting: true });
        } else if (project && typeof project.importElpxFile === 'function') {
            await project.importElpxFile(file);
        } else if (project?._yjsBridge?.importer) {
            await project._yjsBridge.importer.importFromFile(file, { clearExisting: true });
        } else {
            throw new Error('Project import not available');
        }

        // OPEN_FILE runs outside the standard "open file" modal flow, so refresh UI explicitly.
        if (project && typeof project.refreshAfterDirectImport === 'function') {
            await project.refreshAfterDirectImport();
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
     * Handle REQUEST_EXPORT message
     * Exports the project in any supported format via SharedExporters.quickExport()
     * @param {Object} data - { format: string, filename: string }
     * @param {string} requestId
     */
    async handleExportRequest(data, requestId) {
        const format = data?.format || 'elpx';
        const project = this.app.project;
        if (!project?._yjsBridge) {
            throw new Error('No project loaded');
        }

        const SharedExporters = window.SharedExporters;
        if (!SharedExporters?.quickExport) {
            throw new Error('Export system not available');
        }

        const bridge = project._yjsBridge;
        const exportOptions = { ...(data?.options || {}) };
        if (data?.filename && !exportOptions.filename) {
            exportOptions.filename = data.filename;
        }

        const result = await SharedExporters.quickExport(
            format,
            bridge.documentManager,
            null,  // assetCache (legacy)
            bridge.resourceFetcher,
            exportOptions,
            bridge.assetManager,
        );

        if (!result.success || !result.data) {
            throw new Error(result.error || 'Export failed');
        }

        const { bytes, mimeType } = await this.normalizeExportData(result.data);
        const filename = data?.filename || result.filename || this.getDefaultExportFilename(format);

        this.postToParent({
            type: 'EXPORT_FILE',
            requestId,
            bytes,
            filename,
            format,
            mimeType,
            size: bytes.byteLength,
        });
    }

    /**
     * Normalize export payload to ArrayBuffer
     * @param {ArrayBuffer|Blob|TypedArray} data
     * @returns {Promise<{bytes: ArrayBuffer, mimeType: string}>}
     */
    async normalizeExportData(data) {
        if (data instanceof Blob) {
            return {
                bytes: await data.arrayBuffer(),
                mimeType: data.type || 'application/octet-stream',
            };
        }
        if (data instanceof ArrayBuffer) {
            return { bytes: data, mimeType: 'application/octet-stream' };
        }
        if (ArrayBuffer.isView(data)) {
            return {
                bytes: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
                mimeType: 'application/octet-stream',
            };
        }
        throw new Error('Unsupported export data format');
    }

    /**
     * Get default export filename by format
     * @param {string} format
     * @returns {string}
     */
    getDefaultExportFilename(format) {
        const normalized = String(format || '').toLowerCase().replace('-', '');
        const extensionByFormat = {
            elp: 'elpx',
            elpx: 'elpx',
            epub: 'epub',
            epub3: 'epub',
            component: 'elp',
            block: 'elp',
            idevice: 'elp',
        };
        const ext = extensionByFormat[normalized] || 'zip';
        return `project.${ext}`;
    }

    /**
     * Handle GET_STATE message
     * Returns current editor state (dirty flag, project loaded, page count)
     * @param {string} requestId
     */
    handleGetState(requestId) {
        const bridge = this.app.project?._yjsBridge;
        this.postToParent({
            type: 'STATE',
            requestId,
            isDirty: bridge?.documentManager?.isDirty || false,
            hasProject: !!bridge,
            pageCount: bridge?.documentManager?.getNavigation()?.length || 0,
        });
    }

    /**
     * Handle CONFIGURE message
     * Allows runtime UI configuration (show/hide elements)
     * @param {Object} data - { hideUI: { fileMenu: bool, saveButton: bool, ... } }
     * @param {string} requestId
     */
    handleConfigure(data, requestId) {
        if (data?.hideUI) {
            applyHideUI(data.hideUI);
        }
        this.postToParent({ type: 'CONFIGURE_SUCCESS', requestId });
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

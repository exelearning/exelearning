/**
 * EmbeddedFileSystem - File system adapter for embedded mode (iframe).
 *
 * Uses postMessage to communicate file operations with the parent window.
 * This enables eXeLearning to be embedded in LMS platforms (Moodle, WordPress, etc.)
 * where file operations are handled by the host application.
 *
 * Communication protocol:
 * - Save: Posts EXELEARNING_SAVE_REQUEST, expects EXELEARNING_SAVE_RESPONSE
 * - Open: Posts EXELEARNING_OPEN_REQUEST, expects EXELEARNING_OPEN_RESPONSE
 * - Export: Posts EXELEARNING_EXPORT_REQUEST, expects EXELEARNING_EXPORT_RESPONSE
 *
 * @module core/adapters/EmbeddedFileSystem
 */

import { FileSystemAdapter } from './FileSystemAdapter.js';

/**
 * File system adapter for embedded iframe mode.
 * Communicates with parent window via postMessage.
 */
export class EmbeddedFileSystem extends FileSystemAdapter {
    /**
     * @param {Object} options
     * @param {string} [options.parentOrigin='*'] - Target origin for postMessage
     * @param {number} [options.timeout=30000] - Timeout for responses in ms
     */
    constructor(options = {}) {
        super();
        this.parentOrigin = options.parentOrigin || '*';
        this.timeout = options.timeout || 30000;
        this.pendingRequests = new Map();
        this.messageHandler = null;
        this._initialize();
    }

    /**
     * Initialize message listener
     * @private
     */
    _initialize() {
        this.messageHandler = this._handleMessage.bind(this);
        window.addEventListener('message', this.messageHandler);
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
        // Reject all pending requests
        for (const [requestId, { reject }] of this.pendingRequests) {
            reject(new Error('FileSystem destroyed'));
        }
        this.pendingRequests.clear();
    }

    /**
     * Handle incoming messages from parent
     * @param {MessageEvent} event
     * @private
     */
    _handleMessage(event) {
        // Validate origin if configured
        if (this.parentOrigin !== '*' && event.origin !== this.parentOrigin) {
            return;
        }

        const { type, requestId, ...data } = event.data || {};
        if (!requestId || !this.pendingRequests.has(requestId)) {
            return;
        }

        const { resolve, reject, timeoutId } = this.pendingRequests.get(requestId);
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);

        if (type?.endsWith('_ERROR')) {
            reject(new Error(data.error || 'Operation failed'));
        } else {
            resolve(data);
        }
    }

    /**
     * Send request to parent window
     * @param {string} type - Message type
     * @param {Object} data - Message data
     * @returns {Promise<Object>}
     * @private
     */
    _sendRequest(type, data = {}) {
        return new Promise((resolve, reject) => {
            if (window.parent === window) {
                reject(new Error('Not in iframe'));
                return;
            }

            const requestId = crypto.randomUUID();
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request ${type} timed out`));
            }, this.timeout);

            this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

            window.parent.postMessage(
                { type, requestId, ...data },
                this.parentOrigin
            );
        });
    }

    /**
     * Save data via parent window
     * @param {Uint8Array|Blob|ArrayBuffer} data - Data to save
     * @param {string} _projectKey - Project key (unused in embedded mode)
     * @param {string} suggestedName - Suggested filename
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async save(data, _projectKey, suggestedName) {
        try {
            const buffer = await this._toArrayBuffer(data);

            const response = await this._sendRequest('EXELEARNING_SAVE_REQUEST', {
                bytes: buffer,
                filename: suggestedName,
                operation: 'save',
            });

            return {
                success: true,
                path: response.path || suggestedName,
            };
        } catch (error) {
            console.error('[EmbeddedFileSystem] Save failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Save As via parent window
     * @param {Uint8Array|Blob|ArrayBuffer} data - Data to save
     * @param {string} suggestedName - Suggested filename
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async saveAs(data, suggestedName) {
        try {
            const buffer = await this._toArrayBuffer(data);

            const response = await this._sendRequest('EXELEARNING_SAVE_REQUEST', {
                bytes: buffer,
                filename: suggestedName,
                operation: 'saveAs',
            });

            return {
                success: true,
                path: response.path || response.filename,
            };
        } catch (error) {
            console.error('[EmbeddedFileSystem] SaveAs failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Open file via parent window
     * @param {string[]} _extensions - Accepted file extensions (unused, parent decides)
     * @returns {Promise<{success: boolean, data?: Uint8Array, name?: string, error?: string}>}
     */
    async open(_extensions = []) {
        try {
            const response = await this._sendRequest('EXELEARNING_OPEN_REQUEST', {
                extensions: _extensions,
            });

            if (!response.bytes) {
                return { success: false, error: 'No file data received' };
            }

            return {
                success: true,
                data: new Uint8Array(response.bytes),
                name: response.filename || 'project.elpx',
                path: response.path,
            };
        } catch (error) {
            if (error.message?.includes('canceled') || error.message?.includes('cancelled')) {
                return { success: false, error: 'Canceled by user' };
            }
            console.error('[EmbeddedFileSystem] Open failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Read file by path - not supported in embedded mode
     * Parent window must provide file data via open()
     * @param {string} _filePath - File path (unused)
     * @returns {Promise<{success: boolean, error: string}>}
     */
    async readFile(_filePath) {
        return {
            success: false,
            error: 'Reading files by path is not supported in embedded mode. Use open() instead.',
        };
    }

    /**
     * Export to folder via parent window
     * @param {Uint8Array|Blob|ArrayBuffer} zipData - ZIP data to export
     * @param {string} suggestedName - Suggested folder/filename
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async exportToFolder(zipData, suggestedName) {
        try {
            const buffer = await this._toArrayBuffer(zipData);

            const response = await this._sendRequest('EXELEARNING_EXPORT_REQUEST', {
                bytes: buffer,
                filename: suggestedName.endsWith('.zip') ? suggestedName : `${suggestedName}.zip`,
                format: 'folder',
            });

            return {
                success: true,
                path: response.path || suggestedName,
            };
        } catch (error) {
            console.error('[EmbeddedFileSystem] Export failed:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Check if a capability is supported
     * @param {string} capability - Capability name
     * @returns {boolean}
     */
    supports(capability) {
        const supported = {
            saveToPath: false, // Parent handles path
            exportToFolder: true, // Via parent
            readFile: false, // Not supported
            nativeDialogs: false, // Parent handles dialogs
            postMessage: true, // Always in embedded mode
        };
        return supported[capability] || false;
    }

    /**
     * Convert data to ArrayBuffer for postMessage
     * @param {Uint8Array|Blob|ArrayBuffer} data
     * @returns {Promise<ArrayBuffer>}
     * @private
     */
    async _toArrayBuffer(data) {
        if (data instanceof ArrayBuffer) {
            return data;
        }
        if (data instanceof Uint8Array) {
            return data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength
            );
        }
        if (data instanceof Blob) {
            return await data.arrayBuffer();
        }
        throw new Error('Unsupported data type');
    }
}

export default EmbeddedFileSystem;

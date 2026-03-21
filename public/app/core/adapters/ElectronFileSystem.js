/**
 * ElectronFileSystem - File system adapter for Electron environment.
 *
 * Uses window.electronAPI for native file operations, enabling:
 * - Save to specific path (remember last save location)
 * - Export to folder (extract ZIP)
 * - Read files by path
 * - Native save/open dialogs
 *
 * @extends FileSystemAdapter
 */

import { FileSystemAdapter } from './FileSystemAdapter.js';

export class ElectronFileSystem extends FileSystemAdapter {
    constructor() {
        super();
        if (!window.electronAPI) {
            throw new Error('ElectronFileSystem requires window.electronAPI');
        }
        this.api = window.electronAPI;
    }

    /**
     * Save data with save-as dialog
     * @param {Uint8Array|Blob|ArrayBuffer} data - File data
     * @param {string} suggestedName - Suggested filename
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async saveAs(data, suggestedName, options = {}) {
        try {
            const buffer = await this._toBuffer(data);
            const result = await this.api.saveBufferAs(buffer, suggestedName);
            const normalized = typeof result === 'object' && result !== null
                ? result
                : { saved: result === true, canceled: result !== true, filePath: undefined };
            const saved =
                normalized.saved === true ||
                (!normalized.canceled && typeof normalized.filePath === 'string' && normalized.filePath.length > 0);

            if (normalized.canceled) {
                return { success: false, error: 'Canceled by user' };
            }

            return {
                success: saved,
                path: normalized.filePath,
            };
        } catch (error) {
            console.error('[ElectronFileSystem] saveAs error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save data to known location (or save-as if first save)
     * @param {Uint8Array|Blob|ArrayBuffer} data - File data
     * @param {string} projectKey - Project identifier for path lookup
     * @param {string} suggestedName - Suggested filename
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async save(data, projectKey, suggestedName, options = {}) {
        try {
            const buffer = await this._toBuffer(data);
            const result = await this.api.saveBuffer(buffer, projectKey, suggestedName);
            const normalized = typeof result === 'object' && result !== null
                ? result
                : { saved: result === true, canceled: result !== true, filePath: undefined };
            const saved =
                normalized.saved === true ||
                (!normalized.canceled && typeof normalized.filePath === 'string' && normalized.filePath.length > 0);

            if (normalized.canceled) {
                return { success: false, error: 'Canceled by user' };
            }

            return {
                success: saved,
                path: normalized.filePath,
            };
        } catch (error) {
            console.error('[ElectronFileSystem] save error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Open file with dialog
     * @param {string[]} extensions - Allowed extensions
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, data?: Uint8Array, name?: string, path?: string, error?: string}>}
     */
    async open(extensions, options = {}) {
        try {
            const result = await this.api.openElp();

            if (!result || result.canceled) {
                return { success: false, error: 'Canceled by user' };
            }

            return {
                success: true,
                data: new Uint8Array(result.data),
                name: result.name,
                path: result.path,
            };
        } catch (error) {
            console.error('[ElectronFileSystem] open error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Read file by path
     * @param {string} filePath - Path to file
     * @returns {Promise<{success: boolean, data?: Uint8Array, error?: string}>}
     */
    async readFile(filePath) {
        try {
            const result = await this.api.readFile(filePath);

            if (!result || !result.data) {
                return { success: false, error: 'Failed to read file' };
            }

            return {
                success: true,
                data: new Uint8Array(result.data),
                name: result.name,
            };
        } catch (error) {
            console.error('[ElectronFileSystem] readFile error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Export ZIP to folder (extract)
     * @param {Uint8Array|Blob|ArrayBuffer} zipData - ZIP file data
     * @param {string} suggestedName - Suggested folder name
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async exportToFolder(zipData, suggestedName, options = {}) {
        try {
            const buffer = await this._toBuffer(zipData);
            const result = await this.api.exportBufferToFolder(buffer, suggestedName);

            if (result.canceled) {
                return { success: false, error: 'Canceled by user' };
            }

            return {
                success: true,
                path: result.folderPath,
            };
        } catch (error) {
            console.error('[ElectronFileSystem] exportToFolder error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check if this adapter supports a specific capability
     * @param {string} capability - Capability name
     * @returns {boolean}
     */
    supports(capability) {
        const capabilities = {
            saveToPath: true,
            exportToFolder: true,
            readFile: true,
            nativeDialogs: true,
        };
        return capabilities[capability] || false;
    }

    /**
     * Convert various data types to buffer
     * @private
     */
    async _toBuffer(data) {
        if (data instanceof Uint8Array) {
            return data;
        }
        if (data instanceof Blob) {
            const arrayBuffer = await data.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        }
        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }
        throw new Error('Unsupported data type');
    }
}

export default ElectronFileSystem;

/**
 * WebFileSystem - File system adapter for web browser environment.
 *
 * Uses browser APIs for file operations:
 * - Blob URLs for downloads
 * - File input for opens
 * - No folder export support (downloads ZIP instead)
 *
 * @extends FileSystemAdapter
 */

import { FileSystemAdapter } from './FileSystemAdapter.js';

export class WebFileSystem extends FileSystemAdapter {
    constructor() {
        super();
    }

    /**
     * Save data with download (browser has no save dialog access)
     * @param {Uint8Array|Blob|ArrayBuffer} data - File data
     * @param {string} suggestedName - Suggested filename
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async saveAs(data, suggestedName, options = {}) {
        return this._download(data, suggestedName, options);
    }

    /**
     * Save data (same as saveAs in web - no path persistence)
     * @param {Uint8Array|Blob|ArrayBuffer} data - File data
     * @param {string} projectKey - Ignored in web version
     * @param {string} suggestedName - Suggested filename
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async save(data, projectKey, suggestedName, options = {}) {
        // Web can't save to a specific path, always downloads
        return this._download(data, suggestedName, options);
    }

    /**
     * Open file with file input dialog
     * @param {string[]} extensions - Allowed extensions
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, data?: Uint8Array, name?: string, error?: string}>}
     */
    async open(extensions, options = {}) {
        return new Promise((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';

            // Build accept string from extensions
            if (extensions && extensions.length > 0) {
                input.accept = extensions.map(ext =>
                    ext.startsWith('.') ? ext : `.${ext}`
                ).join(',');
            }

            input.onchange = async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                    resolve({ success: false, error: 'No file selected' });
                    return;
                }

                try {
                    const arrayBuffer = await file.arrayBuffer();
                    resolve({
                        success: true,
                        data: new Uint8Array(arrayBuffer),
                        name: file.name,
                    });
                } catch (error) {
                    console.error('[WebFileSystem] open error:', error);
                    resolve({ success: false, error: error.message });
                }
            };

            input.oncancel = () => {
                resolve({ success: false, error: 'Canceled by user' });
            };

            // Trigger file dialog
            input.click();
        });
    }

    /**
     * Read file by path - NOT SUPPORTED in web
     * @param {string} filePath - Path to file
     * @returns {Promise<{success: boolean, error: string}>}
     */
    async readFile(filePath) {
        return {
            success: false,
            error: 'readFile is not supported in web browser',
        };
    }

    /**
     * Export to folder - NOT SUPPORTED in web (downloads ZIP instead)
     * @param {Uint8Array|Blob|ArrayBuffer} zipData - ZIP file data
     * @param {string} suggestedName - Suggested folder name
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async exportToFolder(zipData, suggestedName, options = {}) {
        // Web can't extract to folder, download ZIP instead
        const zipName = suggestedName.endsWith('.zip')
            ? suggestedName
            : `${suggestedName}.zip`;

        return this._download(zipData, zipName, options);
    }

    /**
     * Check if this adapter supports a specific capability
     * @param {string} capability - Capability name
     * @returns {boolean}
     */
    supports(capability) {
        const capabilities = {
            saveToPath: false,      // Web can't save to specific path
            exportToFolder: false,  // Web can only download ZIP
            readFile: false,        // Web can't read by path
            nativeDialogs: false,   // Uses browser dialogs
        };
        return capabilities[capability] || false;
    }

    /**
     * Internal download helper
     * @private
     */
    async _download(data, filename, options = {}) {
        try {
            const blob = await this._toBlob(data, options.mimeType);
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Cleanup blob URL after a delay
            setTimeout(() => URL.revokeObjectURL(url), 10000);

            return { success: true };
        } catch (error) {
            console.error('[WebFileSystem] download error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Convert various data types to Blob
     * @private
     */
    async _toBlob(data, mimeType = 'application/octet-stream') {
        if (data instanceof Blob) {
            return data;
        }
        if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
            return new Blob([data], { type: mimeType });
        }
        throw new Error('Unsupported data type');
    }
}

export default WebFileSystem;

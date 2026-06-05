/**
 * FileSystemAdapter - Abstract interface for file system operations.
 *
 * This abstraction allows code to work with different file system implementations:
 * - ElectronFileSystem: Uses Electron IPC for native file operations
 * - WebFileSystem: Uses browser download API for file operations
 *
 * All adapters implement the same interface, allowing consumer code
 * to perform file operations regardless of platform.
 *
 * Usage:
 *   // Get adapter based on platform
 *   const adapter = app.fileSystem;
 *
 *   // Save file (shows save dialog)
 *   await adapter.saveAs(data, 'project.elpx');
 *
 *   // Open file (shows open dialog)
 *   const fileData = await adapter.open(['elpx', 'elp']);
 */

export class FileSystemAdapter {
    /**
     * Save data to a file with save dialog
     * @param {Uint8Array|Blob|ArrayBuffer} data - File data to save
     * @param {string} suggestedName - Suggested filename
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async saveAs(data, suggestedName, options = {}) {
        throw new Error('FileSystemAdapter.saveAs() must be implemented by subclass');
    }

    /**
     * Save data to a known location (without dialog)
     * Only available in Electron - web version falls back to saveAs
     * @param {Uint8Array|Blob|ArrayBuffer} data - File data to save
     * @param {string} projectKey - Key to identify save location
     * @param {string} suggestedName - Suggested filename
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async save(data, projectKey, suggestedName, options = {}) {
        throw new Error('FileSystemAdapter.save() must be implemented by subclass');
    }

    /**
     * Open file with open dialog
     * @param {string[]} extensions - Allowed file extensions (e.g., ['elpx', 'elp'])
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, data?: Uint8Array, name?: string, path?: string, error?: string}>}
     */
    async open(extensions, options = {}) {
        throw new Error('FileSystemAdapter.open() must be implemented by subclass');
    }

    /**
     * Read a file by path (Electron only)
     * @param {string} filePath - Path to file
     * @returns {Promise<{success: boolean, data?: Uint8Array, error?: string}>}
     */
    async readFile(filePath) {
        throw new Error('FileSystemAdapter.readFile() must be implemented by subclass');
    }

    /**
     * Export to a folder (unzipped) - Electron only
     * @param {Uint8Array|Blob|ArrayBuffer} zipData - ZIP file data to extract
     * @param {string} suggestedName - Suggested folder name
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, path?: string, error?: string}>}
     */
    async exportToFolder(zipData, suggestedName, options = {}) {
        throw new Error('FileSystemAdapter.exportToFolder() must be implemented by subclass');
    }

    /**
     * Check if this adapter supports a specific capability
     * @param {string} capability - Capability name ('saveToPath', 'exportToFolder', 'readFile')
     * @returns {boolean}
     */
    supports(capability) {
        return false;
    }

    /**
     * Get the current working directory path (Electron only)
     * @returns {Promise<string|null>}
     */
    async getCurrentPath() {
        return null;
    }
}

export default FileSystemAdapter;

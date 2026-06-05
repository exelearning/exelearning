/**
 * File system adapters for different runtime environments.
 *
 * Usage:
 *   import { ElectronFileSystem, WebFileSystem, EmbeddedFileSystem } from './adapters/index.js';
 *
 *   // Select adapter based on environment
 *   const adapter = window.electronAPI
 *     ? new ElectronFileSystem()
 *     : window.parent !== window
 *       ? new EmbeddedFileSystem()
 *       : new WebFileSystem();
 *
 *   // Use unified API
 *   await adapter.saveAs(data, 'file.elpx');
 */

export { FileSystemAdapter } from './FileSystemAdapter.js';
export { ElectronFileSystem } from './ElectronFileSystem.js';
export { WebFileSystem } from './WebFileSystem.js';
export { EmbeddedFileSystem } from './EmbeddedFileSystem.js';

/**
 * Create the appropriate file system adapter based on environment
 * @param {Object} [options] - Adapter options
 * @param {boolean} [options.forceEmbedded=false] - Force embedded mode
 * @param {string} [options.parentOrigin='*'] - Parent origin for embedded mode
 * @returns {FileSystemAdapter}
 */
export function createFileSystemAdapter(options = {}) {
    // Electron mode takes priority
    if (window.electronAPI) {
        const { ElectronFileSystem } = require('./ElectronFileSystem.js');
        return new ElectronFileSystem();
    }

    // Check for embedded mode (in iframe)
    const isEmbedded = options.forceEmbedded || (window.parent !== window);
    if (isEmbedded) {
        const { EmbeddedFileSystem } = require('./EmbeddedFileSystem.js');
        return new EmbeddedFileSystem({
            parentOrigin: options.parentOrigin || '*',
        });
    }

    // Default to web mode
    const { WebFileSystem } = require('./WebFileSystem.js');
    return new WebFileSystem();
}

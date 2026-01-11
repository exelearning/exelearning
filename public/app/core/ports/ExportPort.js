/**
 * ExportPort - Domain interface for export operations.
 * Implemented by ServerExportAdapter and StaticExportAdapter.
 */
export class ExportPort {
    /**
     * Export a project in the specified format.
     * @param {string} format - Export format (html5, scorm12, scorm2004, epub3, etc.)
     * @param {Object} projectData - Project data to export
     * @param {Object} [options] - Export options
     * @returns {Promise<Blob|string>} - Exported content (Blob for download, string for URL)
     */
    async exportAs(format, projectData, options = {}) {
        throw new Error('ExportPort.exportAs() not implemented');
    }

    /**
     * Get supported export formats.
     * @returns {Promise<Array<{id: string, name: string, extension: string}>>}
     */
    async getSupportedFormats() {
        throw new Error('ExportPort.getSupportedFormats() not implemented');
    }

    /**
     * Check if a format is supported.
     * @param {string} format - Format ID
     * @returns {Promise<boolean>}
     */
    async isFormatSupported(format) {
        throw new Error('ExportPort.isFormatSupported() not implemented');
    }

    /**
     * Generate preview HTML for a project.
     * @param {Object} projectData - Project data
     * @returns {Promise<string>} - HTML content or URL
     */
    async generatePreview(projectData) {
        throw new Error('ExportPort.generatePreview() not implemented');
    }

    /**
     * Export project as ELPX package.
     * @param {Object} projectData - Project data
     * @param {Object} assets - Project assets
     * @returns {Promise<Blob>}
     */
    async exportAsElpx(projectData, assets) {
        throw new Error('ExportPort.exportAsElpx() not implemented');
    }

    /**
     * Get preview URL for a session.
     * @param {string} sessionId - Session ID
     * @returns {Promise<{url: string}|{clientSidePreview: boolean}>}
     */
    async getPreviewUrl(sessionId) {
        throw new Error('ExportPort.getPreviewUrl() not implemented');
    }

    /**
     * Download iDevice/block content as file.
     * @param {string} sessionId - Session ID
     * @param {string} blockId - Block ID
     * @param {string} ideviceId - iDevice ID
     * @returns {Promise<{url: string, response: string}>}
     */
    async downloadIDevice(sessionId, blockId, ideviceId) {
        throw new Error('ExportPort.downloadIDevice() not implemented');
    }
}

export default ExportPort;

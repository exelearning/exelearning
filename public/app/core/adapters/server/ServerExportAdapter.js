/**
 * ServerExportAdapter - Server-side implementation of ExportPort.
 * Handles export operations via HTTP API.
 */
import { ExportPort } from '../../ports/ExportPort.js';

export class ServerExportAdapter extends ExportPort {
    /**
     * @param {import('../../HttpClient').HttpClient} httpClient
     * @param {Object} endpoints - API endpoints
     * @param {string} basePath - API base path
     */
    constructor(httpClient, endpoints = {}, basePath = '') {
        super();
        this.http = httpClient;
        this.endpoints = endpoints;
        this.basePath = basePath;
    }

    /**
     * Get endpoint URL by name.
     * @private
     */
    _getEndpoint(name) {
        return this.endpoints[name]?.path || null;
    }

    /**
     * @inheritdoc
     */
    async exportAs(format, projectData, options = {}) {
        const url = `${this.basePath}/api/export/${format}`;
        return this.http.post(url, { projectData, ...options });
    }

    /**
     * @inheritdoc
     */
    async getSupportedFormats() {
        const formats = [
            { id: 'html5', name: 'Website (HTML5)', extension: 'zip' },
            { id: 'scorm12', name: 'SCORM 1.2', extension: 'zip' },
            { id: 'scorm2004', name: 'SCORM 2004', extension: 'zip' },
            { id: 'ims', name: 'IMS Content Package', extension: 'zip' },
            { id: 'epub3', name: 'ePub 3', extension: 'epub' },
            { id: 'xliff', name: 'XLIFF', extension: 'xliff' },
        ];
        return formats;
    }

    /**
     * @inheritdoc
     */
    async isFormatSupported(format) {
        const formats = await this.getSupportedFormats();
        return formats.some(f => f.id === format);
    }

    /**
     * @inheritdoc
     */
    async generatePreview(projectData) {
        const url = `${this.basePath}/api/preview/generate`;
        return this.http.post(url, projectData);
    }

    /**
     * @inheritdoc
     */
    async exportAsElpx(projectData, assets) {
        const url = `${this.basePath}/api/export/elpx`;
        return this.http.post(url, { projectData, assets });
    }

    /**
     * Export and download in specified format.
     * @param {string} projectId
     * @param {string} format
     * @returns {Promise<Blob>}
     */
    async downloadExport(projectId, format) {
        const url = `${this.basePath}/api/export/${projectId}/${format}/download`;
        return this.http.downloadBlob(url);
    }

    /**
     * Get export status (for async exports).
     * @param {string} exportId
     * @returns {Promise<{status: string, progress: number}>}
     */
    async getExportStatus(exportId) {
        const url = `${this.basePath}/api/export/status/${exportId}`;
        return this.http.get(url);
    }

    /**
     * Cancel an ongoing export.
     * @param {string} exportId
     * @returns {Promise<void>}
     */
    async cancelExport(exportId) {
        const url = `${this.basePath}/api/export/cancel/${exportId}`;
        return this.http.post(url, {});
    }

    /**
     * Get preview URL for a session.
     * @inheritdoc
     */
    async getPreviewUrl(sessionId) {
        let url = this._getEndpoint('api_ode_export_preview');
        if (!url) {
            url = `${this.basePath}/api/ode/${sessionId}/preview`;
        } else {
            url = url.replace('{odeSessionId}', sessionId);
        }
        return this.http.get(url);
    }

    /**
     * Download iDevice/block content as file.
     * @inheritdoc
     */
    async downloadIDevice(sessionId, blockId, ideviceId) {
        let url = this._getEndpoint('api_idevices_download_ode_components');
        if (!url) {
            url = `${this.basePath}/api/ode/${sessionId}/block/${blockId}/idevice/${ideviceId}/download`;
        } else {
            url = url.replace('{odeSessionId}', sessionId);
            url = url.replace('{odeBlockId}', blockId);
            url = url.replace('{odeIdeviceId}', ideviceId);
        }
        const response = await this.http.getText(url);
        return { url, response };
    }
}

export default ServerExportAdapter;

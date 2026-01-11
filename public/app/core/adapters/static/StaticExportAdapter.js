/**
 * StaticExportAdapter - Static/offline implementation of ExportPort.
 * Uses client-side export (JSZip) for all operations.
 */
import { ExportPort } from '../../ports/ExportPort.js';

export class StaticExportAdapter extends ExportPort {
    /**
     * @param {Object} [options]
     * @param {Function} [options.getExporter] - Function to get ElpxExporter instance
     */
    constructor(options = {}) {
        super();
        this.getExporter = options.getExporter || (() => window.eXeLearning?.app?.elpxExporter);
    }

    /**
     * @inheritdoc
     */
    async exportAs(format, projectData, options = {}) {
        const exporter = this.getExporter();
        if (!exporter) {
            throw new Error('Exporter not available');
        }

        // Delegate to the existing client-side exporter
        switch (format) {
            case 'html5':
                return exporter.exportToHtml5(projectData, options);
            case 'scorm12':
                return exporter.exportToScorm12(projectData, options);
            case 'scorm2004':
                return exporter.exportToScorm2004(projectData, options);
            case 'ims':
                return exporter.exportToIms(projectData, options);
            case 'epub3':
                return exporter.exportToEpub3(projectData, options);
            case 'xliff':
                return exporter.exportToXliff(projectData, options);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * @inheritdoc
     */
    async getSupportedFormats() {
        return [
            { id: 'html5', name: 'Website (HTML5)', extension: 'zip' },
            { id: 'scorm12', name: 'SCORM 1.2', extension: 'zip' },
            { id: 'scorm2004', name: 'SCORM 2004', extension: 'zip' },
            { id: 'ims', name: 'IMS Content Package', extension: 'zip' },
            { id: 'epub3', name: 'ePub 3', extension: 'epub' },
            { id: 'xliff', name: 'XLIFF', extension: 'xliff' },
        ];
    }

    /**
     * @inheritdoc
     */
    async isFormatSupported(format) {
        const formats = await this.getSupportedFormats();
        return formats.some((f) => f.id === format);
    }

    /**
     * @inheritdoc
     */
    async generatePreview(projectData) {
        // In static mode, preview is generated client-side
        const exporter = this.getExporter();
        if (!exporter) {
            throw new Error('Exporter not available');
        }

        return exporter.generatePreviewHtml(projectData);
    }

    /**
     * @inheritdoc
     */
    async exportAsElpx(projectData, assets) {
        const exporter = this.getExporter();
        if (!exporter) {
            throw new Error('Exporter not available');
        }

        return exporter.exportToElpx(projectData, assets);
    }

    /**
     * Get preview URL for a session.
     * In static mode, preview is generated client-side.
     * @inheritdoc
     */
    async getPreviewUrl(sessionId) {
        return {
            responseMessage: 'OK',
            clientSidePreview: true,
        };
    }

    /**
     * Download iDevice/block content as file.
     * Not supported in static mode.
     * @inheritdoc
     */
    async downloadIDevice(sessionId, blockId, ideviceId) {
        console.warn('[StaticExportAdapter] iDevice download not supported in static mode');
        return { url: '', response: '', responseMessage: 'NOT_SUPPORTED_IN_STATIC_MODE' };
    }
}

export default StaticExportAdapter;

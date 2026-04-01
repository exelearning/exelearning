/**
 * eXeLearning
 *
 * Helper for exporting a page subtree as .elpx file
 * Follows the same pattern as componentDownloadHelper.js
 */

import { downloadComponentFile } from '../../project/idevices/content/componentDownloadHelper.js';

/**
 * Get the createExporter function from window.
 * Checks both window.createExporter and window.SharedExporters.
 * @returns {Function|null} The createExporter function or null if not available
 */
function getCreateExporter() {
    // Try direct window.createExporter first
    if (typeof window.createExporter === 'function') {
        return window.createExporter;
    }
    // Fallback to SharedExporters namespace
    if (
        window.SharedExporters &&
        typeof window.SharedExporters.createExporter === 'function'
    ) {
        return window.SharedExporters.createExporter;
    }
    return null;
}

/**
 * Get the sanitizePageFilename function for generating safe filenames.
 * @returns {Function|null} The sanitizePageFilename function or null
 */
function getSanitizePageFilename() {
    if (
        window.SharedExporters?.Html5Exporter?.prototype?.sanitizePageFilename
    ) {
        return window.SharedExporters.Html5Exporter.prototype
            .sanitizePageFilename;
    }
    return null;
}

/**
 * Build filename for page export.
 * Uses sanitizePageFilename if available, otherwise falls back to basic sanitization.
 *
 * @param {string} nodeId - Navigation node ID
 * @param {object} structureEngine - Structure engine instance
 * @returns {string} Safe filename with .elpx extension
 */
export function buildPageFileName(nodeId, structureEngine) {
    const node = structureEngine?.getNode?.(nodeId);
    if (!node?.pageName) {
        return 'page_export.elpx';
    }

    const sanitizer = getSanitizePageFilename();
    if (sanitizer) {
        const safeName = sanitizer.call(null, node.pageName);
        return `${safeName}.elpx`;
    }

    // Fallback: basic sanitization
    const safeName = node.pageName.replace(/[^a-zA-Z0-9-_\u00C0-\u024F]/g, '_');
    return `${safeName}.elpx`;
}

/**
 * Export a page subtree as .elpx file and trigger download.
 *
 * @param {string} nodeId - Navigation node ID to export
 * @param {object} structureEngine - Structure engine instance (for getting page name)
 * @returns {Promise<{success: boolean, error?: string}>}
 * @throws {Error} If exporter is not available or export fails
 */
export async function exportPageAndDownload(nodeId, structureEngine) {
    // Check if exporter is available
    const createExporter = getCreateExporter();
    if (!createExporter) {
        console.error(
            '[pageExportHelper] SharedExporters not loaded - ensure exporters.bundle.js is included'
        );
        throw new Error(
            _('Export functionality not available. Please reload the page.')
        );
    }

    // Get Yjs bridge and dependencies
    const yjsBridge = eXeLearning.app.project._yjsBridge;
    if (!yjsBridge) {
        throw new Error(_('Collaboration service not ready'));
    }

    const documentManager = yjsBridge.documentManager;
    const assetCache = eXeLearning.app.project._assetCache || null;
    const assetManager = yjsBridge.assetManager || null;
    // Get resource fetcher from yjsBridge (already initialized with bundle manifest)
    const resourceFetcher = yjsBridge.resourceFetcher || null;

    // Create page ELPX exporter (client-side, has access to IndexedDB assets)
    const exporter = createExporter(
        'pageelpx',
        documentManager,
        assetCache,
        resourceFetcher,
        assetManager
    );

    // Export with rootPageId to get only the subtree
    const result = await exporter.export({ rootPageId: nodeId });

    if (!result.success || !result.data) {
        throw new Error(result.error || _('Export failed'));
    }

    // Generate filename
    const filename = buildPageFileName(nodeId, structureEngine);

    // Create blob URL and download
    const blob = new Blob([result.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);

    try {
        // alwaysAskLocation: true - In Electron, always show "Save As" dialog for page exports
        await downloadComponentFile(url, filename, { typeKeySuffix: 'page', alwaysAskLocation: true });
    } finally {
        window.URL.revokeObjectURL(url);
    }

    return { success: true };
}

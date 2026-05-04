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
    return `${buildSafePageName(nodeId, structureEngine, 'page_export')}.elpx`;
}

/**
 * Build filename for page SCORM export.
 *
 * @param {string} nodeId - Navigation node ID
 * @param {object} structureEngine - Structure engine instance
 * @returns {string} Safe filename with .zip extension
 */
export function buildPageScormFileName(nodeId, structureEngine) {
    return `${buildSafePageName(nodeId, structureEngine, 'page_export')}_scorm12.zip`;
}

function buildSafePageName(nodeId, structureEngine, fallbackName) {
    const node = structureEngine?.getNode?.(nodeId);
    if (!node?.pageName) {
        return fallbackName;
    }

    const sanitizer = getSanitizePageFilename();
    if (sanitizer) {
        return sanitizer.call(null, node.pageName);
    }

    // Fallback: basic sanitization
    return node.pageName.replace(/[^a-zA-Z0-9-_\u00C0-\u024F]/g, '_');
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

/**
 * Export a single page as a minimal SCORM 1.2 package and trigger download.
 *
 * @param {string} nodeId - Navigation node ID to export
 * @param {object} structureEngine - Structure engine instance (for getting page name)
 * @returns {Promise<{success: boolean, error?: string}>}
 * @throws {Error} If exporter is not available or export fails
 */
export async function exportPageScormAndDownload(nodeId, structureEngine) {
    const createExporter = getCreateExporter();
    if (!createExporter) {
        console.error(
            '[pageExportHelper] SharedExporters not loaded - ensure exporters.bundle.js is included'
        );
        throw new Error(
            _('Export functionality not available. Please reload the page.')
        );
    }

    const yjsBridge = eXeLearning.app.project._yjsBridge;
    if (!yjsBridge) {
        throw new Error(_('Collaboration service not ready'));
    }

    const documentManager = yjsBridge.documentManager;
    const assetCache = eXeLearning.app.project._assetCache || null;
    const assetManager = yjsBridge.assetManager || null;
    const resourceFetcher = yjsBridge.resourceFetcher || null;
    const filename = buildPageScormFileName(nodeId, structureEngine);

    const exporter = createExporter(
        'pagescorm12',
        documentManager,
        assetCache,
        resourceFetcher,
        assetManager
    );

    const result = await exporter.export({ pageId: nodeId, filename });

    if (!result.success || !result.data) {
        throw new Error(result.error || _('Export failed'));
    }

    const blob = new Blob([result.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);

    try {
        await downloadComponentFile(url, filename, {
            typeKeySuffix: 'page-scorm12',
            alwaysAskLocation: true,
        });
    } finally {
        window.URL.revokeObjectURL(url);
    }

    return { success: true };
}

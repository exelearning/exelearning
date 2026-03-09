/**
 * RegenerateProjectService
 *
 * Provides methods to regenerate a project by re-exporting it as a clean .elpx file.
 * Optionally flattens resource folder paths and detects broken asset references.
 */

/**
 * Scan all HTML content and JSON properties for asset:// references
 * that do not exist in the asset map.
 *
 * @returns {Array<{assetUrl: string, pageName: string, ideviceType: string, componentId: string}>}
 */
export function scanBrokenAssetReferences() {
    const bridge = eXeLearning.app.project._yjsBridge;
    const docManager = bridge.documentManager;
    const assetManager = bridge.assetManager;

    const allAssets = assetManager.getAllAssetsMetadata();
    const assetIds = new Set(Object.keys(allAssets));

    const broken = [];
    const assetUrlRegex = /asset:\/\/([a-f0-9-]+)/gi;

    const navigation = docManager.getNavigation();
    if (!navigation) return broken;

    for (const page of navigation) {
        const pageName = page.title || page.id;
        const blocks = page.blocks || [];

        for (const block of blocks) {
            const components = block.components || block.idevices || [];

            for (const component of components) {
                const componentId = component.id || '';
                const ideviceType = component.type || component.ideviceType || '';

                // Collect all string content from the component
                const textsToScan = [];
                if (component.html) textsToScan.push(component.html);
                if (component.content) textsToScan.push(component.content);

                // Scan JSON fields
                const jsonStr = JSON.stringify(component);
                textsToScan.push(jsonStr);

                for (const text of textsToScan) {
                    let match;
                    assetUrlRegex.lastIndex = 0;
                    while ((match = assetUrlRegex.exec(text)) !== null) {
                        const assetId = match[1];
                        if (!assetIds.has(assetId)) {
                            // Avoid duplicate entries for the same assetUrl in the same component
                            const alreadyFound = broken.some(
                                (b) => b.assetUrl === match[0] && b.componentId === componentId
                            );
                            if (!alreadyFound) {
                                broken.push({
                                    assetUrl: match[0],
                                    pageName,
                                    ideviceType,
                                    componentId,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return broken;
}

/**
 * Regenerate the project by exporting a clean .elpx file.
 *
 * @param {Object} options
 * @param {boolean} [options.flattenResources=false] - Remove subfolders from asset paths
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function regenerate(options = {}) {
    const bridge = eXeLearning.app.project._yjsBridge;
    const docManager = bridge.documentManager;
    const assetCache = bridge.assetCache;
    const resourceFetcher = bridge.resourceFetcher;
    const assetManager = bridge.assetManager;

    if (!window.SharedExporters?.createExporter) {
        throw new Error(_('Export system not available. Please reload the page.'));
    }

    // Update version metadata before export
    if (docManager._updateVersionMetadata) {
        await docManager._updateVersionMetadata();
    }

    const exporter = window.SharedExporters.createExporter(
        'elpx',
        docManager,
        assetCache,
        resourceFetcher,
        assetManager
    );

    const exportOptions = {
        flattenResources: options.flattenResources || false,
    };

    // Add Mermaid pre-renderer if available
    if (window.MermaidPreRenderer) {
        exportOptions.preRenderMermaid = window.MermaidPreRenderer.preRender.bind(window.MermaidPreRenderer);
    }

    const result = await exporter.export(exportOptions);

    if (!result.success || !result.data) {
        throw new Error(result.error || _('Export failed'));
    }

    // Build filename
    const meta = docManager.getMetadata();
    const title = meta?.title || 'project';
    const sanitized = title
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .toLowerCase();
    const exportFilename = `${sanitized}_regenerated.elpx`;

    // Download
    if (eXeLearning?.config?.isOfflineInstallation && window.electronAPI?.saveBuffer) {
        const uint8Array = new Uint8Array(result.data);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);
        const key = window.__currentProjectId || 'default';
        await window.electronAPI.saveBuffer(base64Data, key, exportFilename);
    } else {
        const blob = new Blob([result.data], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    return { success: true };
}

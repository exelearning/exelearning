/**
 * ComponentExporter
 *
 * Exports a single iDevice or block to .idevice or .block format.
 * Uses the Yjs document in memory (no server call).
 *
 * This exporter allows users to download individual components for reuse
 * in other projects. The exported file is a ZIP containing:
 * - content.xml (ODE format with component structure)
 * - Assets referenced by the component
 */

import type { ExportBlock, ExportComponent, ExportOptions, ExportResult } from '../interfaces';
import { BaseExporter } from './BaseExporter';

/**
 * Result of a component export operation
 */
export interface ComponentExportResult extends ExportResult {
    filename?: string;
}

/**
 * Options for component export
 */
export interface ComponentExportOptions extends ExportOptions {
    blockId: string;
    ideviceId?: string | null;
}

/**
 * ComponentExporter - exports individual blocks or iDevices
 */
export class ComponentExporter extends BaseExporter {
    /**
     * Get file extension for component export
     */
    getFileExtension(): string {
        return '.elp';
    }

    /**
     * Get file suffix for component export
     */
    getFileSuffix(): string {
        return '';
    }

    /**
     * Standard export method (not typically used for components)
     * Use exportComponent() instead for targeted exports
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const componentOptions = options as ComponentExportOptions;
        if (!componentOptions?.blockId) {
            return {
                success: false,
                error: 'blockId is required for component export',
            };
        }
        return this.exportComponent(componentOptions.blockId, componentOptions.ideviceId);
    }

    /**
     * Export a single component (iDevice) or entire block
     * @param blockId - Block ID to export
     * @param ideviceId - iDevice ID (null or 'null' = export whole block)
     * @returns Export result with data buffer
     */
    async exportComponent(blockId: string, ideviceId?: string | null): Promise<ComponentExportResult> {
        const isIdevice = ideviceId && ideviceId !== 'null';
        const filename = isIdevice ? `${ideviceId}.idevice` : `${blockId}.block`;

        console.log(`[ComponentExporter] Exporting ${isIdevice ? 'iDevice' : 'block'}: ${filename}`);

        try {
            // Find the block and component in Yjs document
            const { block, component, pageId } = this.findComponent(blockId, ideviceId);

            if (!block) {
                console.log(`[ComponentExporter] Block not found: ${blockId}`);
                return { success: false, error: 'Block not found' };
            }

            if (isIdevice && !component) {
                console.log(`[ComponentExporter] Component not found: ${ideviceId}`);
                return { success: false, error: 'Component not found' };
            }

            // Generate component XML
            const contentXml = this.generateComponentExportXml(block, component, pageId!);
            this.zip.addFile('content.xml', new TextEncoder().encode(contentXml));

            // Add component assets
            await this.addComponentAssetsToZip(block, component);

            // Generate ZIP
            const data = await this.zip.generate();

            console.log(`[ComponentExporter] Export complete: ${filename}`);
            return { success: true, data, filename };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[ComponentExporter] Export failed:', error);
            return { success: false, error: message };
        }
    }

    /**
     * Export and trigger browser download
     * @param blockId - Block ID to export
     * @param ideviceId - iDevice ID (null = export whole block)
     * @returns Export result
     */
    async exportAndDownload(blockId: string, ideviceId?: string | null): Promise<ComponentExportResult> {
        const result = await this.exportComponent(blockId, ideviceId);

        if (result.success && result.data && result.filename) {
            this.downloadBlob(result.data, result.filename);
        }

        return result;
    }

    /**
     * Find block and component in document navigation structure
     * @param blockId - Block ID to find
     * @param ideviceId - Optional iDevice ID to find within block
     */
    private findComponent(
        blockId: string,
        ideviceId?: string | null,
    ): { block: ExportBlock | null; component: ExportComponent | null; pageId: string | null } {
        const pages = this.buildPageList();

        for (const page of pages) {
            for (const block of page.blocks || []) {
                if (block.id === blockId) {
                    if (ideviceId && ideviceId !== 'null') {
                        const component = (block.components || []).find(c => c.id === ideviceId);
                        return { block, component: component || null, pageId: page.id };
                    }
                    return { block, component: null, pageId: page.id };
                }
            }
        }

        return { block: null, component: null, pageId: null };
    }

    /**
     * Generate XML for component export (ODE format)
     * @param block - Block data
     * @param component - Single component to export (null = all components in block)
     * @param pageId - Page ID containing the block
     */
    private generateComponentExportXml(block: ExportBlock, component: ExportComponent | null, pageId: string): string {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';

        // Mark as component resources (required for import to recognize this as a component)
        xml += '<odeResources>\n';
        xml += '  <odeResource>\n';
        xml += '    <key>odeComponentsResources</key>\n';
        xml += '    <value>true</value>\n';
        xml += '  </odeResource>\n';
        xml += '</odeResources>\n';

        // Block structure with components
        xml += '<odePagStructures>\n';
        xml += this.generateBlockExportXml(block, component, pageId);
        xml += '</odePagStructures>\n';

        xml += '</ode>';
        return xml;
    }

    /**
     * Generate XML for the block structure
     * @param block - Block data
     * @param singleComponent - Single component to include (null = all)
     * @param pageId - Page ID
     */
    private generateBlockExportXml(
        block: ExportBlock,
        singleComponent: ExportComponent | null,
        pageId: string,
    ): string {
        let xml = '  <odePagStructure>\n';
        xml += `    <odeBlockId>${this.escapeXml(block.id)}</odeBlockId>\n`;
        xml += `    <blockName>${this.escapeXml(block.name || 'Block')}</blockName>\n`;
        xml += `    <iconName></iconName>\n`;
        xml += `    <odePagStructureOrder>0</odePagStructureOrder>\n`;
        xml += `    <odePagStructureProperties>${this.escapeXml(JSON.stringify(block.properties || {}))}</odePagStructureProperties>\n`;
        xml += '    <odeComponents>\n';

        // If single component, export only that one; otherwise export all
        const components = singleComponent ? [singleComponent] : block.components || [];
        for (const comp of components) {
            xml += this.generateIdeviceExportXml(comp, block.id, pageId);
        }

        xml += '    </odeComponents>\n';
        xml += '  </odePagStructure>\n';
        return xml;
    }

    /**
     * Generate XML for a single iDevice/component
     * @param comp - Component data
     * @param blockId - Parent block ID
     * @param pageId - Parent page ID
     */
    private generateIdeviceExportXml(comp: ExportComponent, blockId: string, pageId: string): string {
        let xml = '      <odeComponent>\n';
        xml += `        <odeIdeviceId>${this.escapeXml(comp.id)}</odeIdeviceId>\n`;
        xml += `        <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
        xml += `        <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>\n`;
        xml += `        <odeIdeviceTypeName>${this.escapeXml(comp.type || 'FreeTextIdevice')}</odeIdeviceTypeName>\n`;
        xml += `        <ideviceSrcType>json</ideviceSrcType>\n`;
        xml += `        <userIdevice>0</userIdevice>\n`;
        xml += `        <htmlView><![CDATA[${this.escapeCdata(comp.content || '')}]]></htmlView>\n`;
        xml += `        <jsonProperties><![CDATA[${this.escapeCdata(JSON.stringify(comp.properties || {}))}]]></jsonProperties>\n`;
        xml += `        <odeComponentsOrder>${comp.order || 0}</odeComponentsOrder>\n`;
        xml += `        <odeComponentsProperties></odeComponentsProperties>\n`;
        xml += '      </odeComponent>\n';
        return xml;
    }

    /**
     * Add only assets used by this component to ZIP
     * Scans component content for asset:// URLs and includes only those assets
     * @param block - Block data
     * @param singleComponent - Single component (null = all in block)
     */
    private async addComponentAssetsToZip(block: ExportBlock, singleComponent: ExportComponent | null): Promise<void> {
        try {
            const allAssets = await this.assets.getAllAssets();
            const components = singleComponent ? [singleComponent] : block.components || [];

            // Extract asset IDs from component content (asset://uuid pattern)
            const usedAssetIds = new Set<string>();
            for (const comp of components) {
                const content = comp.content || '';
                const matches = content.matchAll(/asset:\/\/([a-f0-9-]+)/gi);
                for (const match of matches) {
                    usedAssetIds.add(match[1]);
                }
            }

            console.log(`[ComponentExporter] Found ${usedAssetIds.size} referenced assets`);

            // Add only used assets
            let addedCount = 0;
            for (const asset of allAssets) {
                const assetId = asset.id;
                if (usedAssetIds.has(assetId)) {
                    const filename = asset.filename || `asset-${assetId}`;
                    const originalPath = asset.originalPath || `content/resources/${assetId}/${filename}`;
                    this.zip.addFile(originalPath, asset.data);
                    console.log(`[ComponentExporter] Added asset: ${originalPath}`);
                    addedCount++;
                }
            }

            console.log(`[ComponentExporter] Added ${addedCount} assets to ZIP`);
        } catch (e) {
            console.warn('[ComponentExporter] Failed to add assets:', e);
        }
    }

    /**
     * Trigger browser download of blob data
     * @param data - ZIP data buffer
     * @param filename - Download filename
     */
    private downloadBlob(data: Uint8Array, filename: string): void {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            console.warn('[ComponentExporter] downloadBlob only works in browser environment');
            return;
        }

        const blob = new Blob([data], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

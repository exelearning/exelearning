/**
 * ComponentExporter
 * Exports a single iDevice or block to .idevice or .block format.
 * Uses the Yjs document in memory (no server call).
 *
 * This exporter allows users to download individual components for reuse
 * in other projects. The exported file is a ZIP containing:
 * - content.xml (ODE format with component structure)
 * - Assets referenced by the component
 *
 * @extends BaseExporter
 */
class ComponentExporter extends BaseExporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   */
  constructor(documentManager, assetCacheManager = null) {
    super(documentManager, assetCacheManager);
  }

  /**
   * Get file extension for component export
   * @returns {string}
   */
  getFileExtension() {
    return '.elp';
  }

  /**
   * Get file suffix for component export
   * @returns {string}
   */
  getFileSuffix() {
    return '.idevice';
  }

  /**
   * Export a single component (iDevice) or entire block
   * @param {string} blockId - Block ID to export
   * @param {string|null} ideviceId - iDevice ID (null or 'null' = export whole block)
   * @returns {Promise<{success: boolean, filename?: string, error?: string}>}
   */
  async exportComponent(blockId, ideviceId = null) {
    const isIdevice = ideviceId && ideviceId !== 'null';
    const filename = isIdevice
      ? `${ideviceId}.idevice`
      : `${blockId}.block`;

    Logger.log(`[ComponentExporter] Exporting ${isIdevice ? 'iDevice' : 'block'}: ${filename}`);

    try {
      const zip = this.createZip();

      // Find the block and component in Yjs document
      const { block, component, pageId } = this.findComponent(blockId, ideviceId);

      if (!block) {
        Logger.log(`[ComponentExporter] Block not found: ${blockId}`);
        return { success: false, error: 'Block not found' };
      }

      if (isIdevice && !component) {
        Logger.log(`[ComponentExporter] Component not found: ${ideviceId}`);
        return { success: false, error: 'Component not found' };
      }

      // Generate component XML
      const contentXml = this.generateComponentXml(block, component, pageId);
      zip.file('content.xml', contentXml);

      // Add component assets
      await this.addComponentAssetsToZip(zip, block, component);

      // Generate ZIP blob
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Trigger download
      this.downloadBlob(blob, filename);

      Logger.log(`[ComponentExporter] Export complete: ${filename}`);
      return { success: true, filename };
    } catch (error) {
      console.error('[ComponentExporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Find block and component in Yjs navigation structure
   * @param {string} blockId - Block ID to find
   * @param {string|null} ideviceId - Optional iDevice ID to find within block
   * @returns {{block: Object|null, component: Object|null, pageId: string|null}}
   */
  findComponent(blockId, ideviceId) {
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
   * @param {Object} block - Block data
   * @param {Object|null} component - Single component to export (null = all components in block)
   * @param {string} pageId - Page ID containing the block
   * @returns {string} XML content
   */
  generateComponentXml(block, component, pageId) {
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
    xml += this.generateBlockXml(block, component, pageId);
    xml += '</odePagStructures>\n';

    xml += '</ode>';
    return xml;
  }

  /**
   * Generate XML for the block structure
   * @param {Object} block - Block data
   * @param {Object|null} singleComponent - Single component to include (null = all)
   * @param {string} pageId - Page ID
   * @returns {string} XML fragment
   */
  generateBlockXml(block, singleComponent, pageId) {
    let xml = '  <odePagStructure>\n';
    xml += `    <odeBlockId>${this.escapeXml(block.id)}</odeBlockId>\n`;
    xml += `    <blockName>${this.escapeXml(block.name || 'Block')}</blockName>\n`;
    xml += `    <iconName></iconName>\n`;
    xml += `    <odePagStructureOrder>0</odePagStructureOrder>\n`;
    xml += `    <odePagStructureProperties>{}</odePagStructureProperties>\n`;
    xml += '    <odeComponents>\n';

    // If single component, export only that one; otherwise export all
    const components = singleComponent ? [singleComponent] : (block.components || []);
    for (const comp of components) {
      xml += this.generateIdeviceXml(comp, block.id, pageId);
    }

    xml += '    </odeComponents>\n';
    xml += '  </odePagStructure>\n';
    return xml;
  }

  /**
   * Generate XML for a single iDevice/component
   * @param {Object} comp - Component data
   * @param {string} blockId - Parent block ID
   * @param {string} pageId - Parent page ID
   * @returns {string} XML fragment
   */
  generateIdeviceXml(comp, blockId, pageId) {
    let xml = '      <odeComponent>\n';
    xml += `        <odeIdeviceId>${this.escapeXml(comp.id)}</odeIdeviceId>\n`;
    xml += `        <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
    xml += `        <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>\n`;
    xml += `        <odeIdeviceTypeName>${this.escapeXml(comp.type || 'FreeTextIdevice')}</odeIdeviceTypeName>\n`;
    xml += `        <ideviceSrcType>json</ideviceSrcType>\n`;
    xml += `        <userIdevice>0</userIdevice>\n`;
    xml += `        <htmlView><![CDATA[${comp.content || ''}]]></htmlView>\n`;
    xml += `        <jsonProperties><![CDATA[${JSON.stringify(comp.properties || {})}]]></jsonProperties>\n`;
    xml += `        <odeComponentsOrder>${comp.order || 0}</odeComponentsOrder>\n`;
    xml += `        <odeComponentsProperties></odeComponentsProperties>\n`;
    xml += '      </odeComponent>\n';
    return xml;
  }

  /**
   * Add only assets used by this component to ZIP
   * Scans component content for asset:// URLs and includes only those assets
   * @param {JSZip} zip - ZIP instance
   * @param {Object} block - Block data
   * @param {Object|null} singleComponent - Single component (null = all in block)
   */
  async addComponentAssetsToZip(zip, block, singleComponent) {
    if (!this.assetManager) {
      Logger.log('[ComponentExporter] No AssetManager, skipping assets');
      return;
    }

    try {
      const assets = await this.assetManager.getProjectAssets();
      const components = singleComponent ? [singleComponent] : (block.components || []);

      // Extract asset IDs from component content (asset://uuid pattern)
      const usedAssetIds = new Set();
      for (const comp of components) {
        const content = comp.content || '';
        const matches = content.matchAll(/asset:\/\/([a-f0-9-]+)/gi);
        for (const match of matches) {
          usedAssetIds.add(match[1]);
        }
      }

      Logger.log(`[ComponentExporter] Found ${usedAssetIds.size} referenced assets`);

      // Add only used assets
      let addedCount = 0;
      for (const asset of assets) {
        const assetId = asset.id || asset.assetId;
        if (usedAssetIds.has(assetId)) {
          const filename = asset.filename || asset.originalFilename || `asset-${assetId}`;
          const originalPath = asset.originalPath || `content/resources/${assetId}/${filename}`;
          zip.file(originalPath, asset.blob);
          Logger.log(`[ComponentExporter] Added asset: ${originalPath}`);
          addedCount++;
        }
      }

      Logger.log(`[ComponentExporter] Added ${addedCount} assets to ZIP`);
    } catch (e) {
      console.warn('[ComponentExporter] Failed to add assets:', e);
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentExporter;
} else {
  window.ComponentExporter = ComponentExporter;
}

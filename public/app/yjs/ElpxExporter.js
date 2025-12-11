/**
 * ElpxExporter (Compatibility Layer)
 *
 * This file maintains backwards compatibility for code that imports from this location.
 * The actual implementation is now in ./exporters/ElpxExporter.js
 *
 * IMPORTANT: This file requires BaseExporter to be loaded first!
 * Load order:
 *   1. exporters/BaseExporter.js
 *   2. exporters/ElpxExporter.js (or this file)
 *
 * Usage:
 *   const exporter = new ElpxExporter(yjsDocumentManager, assetCacheManager);
 *   await exporter.export('my-project.elpx');
 *   // or legacy method:
 *   await exporter.exportToFile('my-project.elpx');
 */

// Check if the new ElpxExporter is already loaded
if (typeof window !== 'undefined' && window.ElpxExporter) {
  // Already loaded from exporters directory
  Logger.log('[ElpxExporter] Using exporter from exporters/ directory');
} else {
  // Fallback: provide standalone implementation for backwards compatibility
  // This code should ideally not run if scripts are loaded in correct order

  class ElpxExporter {
    constructor(documentManager, assetCacheManager = null) {
      this.manager = documentManager;
      this.assetCache = assetCacheManager;
    }

    getFileExtension() { return '.elpx'; }
    getFileSuffix() { return ''; }

    async export(filename = null) {
      const exportFilename = filename || this.buildFilename();
      return this.exportToFile(exportFilename);
    }

    buildFilename() {
      const meta = this.manager.getMetadata();
      const title = meta.get('title') || 'export';
      const sanitized = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
      return `${sanitized}.elpx`;
    }

    async exportToFile(filename = 'project.elpx') {
      Logger.log(`[ElpxExporter] Exporting to ${filename}...`);

      const JSZip = window.JSZip;
      if (!JSZip) {
        throw new Error('JSZip library not loaded');
      }

      const zip = new JSZip();
      const contentXml = this.generateContentXml();
      zip.file('content.xml', contentXml);

      if (this.assetCache) {
        await this.addAssetsToZip(zip);
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      this.downloadBlob(blob, filename);
      Logger.log(`[ElpxExporter] Export complete: ${filename}`);
      return { success: true, filename };
    }

    async exportToBlob() {
      const JSZip = window.JSZip;
      if (!JSZip) throw new Error('JSZip library not loaded');

      const zip = new JSZip();
      zip.file('content.xml', this.generateContentXml());
      if (this.assetCache) await this.addAssetsToZip(zip);

      return zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
    }

    generateContentXml() {
      const metadata = this.manager.getMetadata();
      const navigation = this.manager.getNavigation();

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';
      xml += this.generatePropertiesXml(metadata);
      xml += '<odeNavStructures>\n';
      for (let i = 0; i < navigation.length; i++) {
        xml += this.generatePageXml(navigation.get(i), i);
      }
      xml += '</odeNavStructures>\n</ode>';
      return xml;
    }

    generatePropertiesXml(metadata) {
      let xml = '<odeProperties>\n';
      const props = {
        pp_title: metadata.get('title') || 'Untitled',
        pp_author: metadata.get('author') || '',
        pp_lang: metadata.get('language') || 'en',
        pp_description: metadata.get('description') || '',
        pp_license: metadata.get('license') || '',
        pp_createdAt: metadata.get('createdAt') || new Date().toISOString(),
      };
      for (const [key, value] of Object.entries(props)) {
        xml += `  <${key}>${this.escapeXml(value)}</${key}>\n`;
      }
      xml += '</odeProperties>\n';
      return xml;
    }

    generatePageXml(pageMap, index) {
      const pageId = pageMap.get('id') || pageMap.get('pageId');
      const pageName = pageMap.get('pageName') || 'Page';
      const parentId = pageMap.get('parentId') || '';
      const order = pageMap.get('order') ?? index;

      let xml = `<odeNavStructure odeNavStructureId="${this.escapeXml(pageId)}" `;
      xml += `odePageName="${this.escapeXml(pageName)}" odeNavStructureOrder="${order}" `;
      if (parentId) xml += `parentOdeNavStructureId="${this.escapeXml(parentId)}" `;
      xml += `>\n`;

      const blocks = pageMap.get('blocks');
      if (blocks) {
        for (let i = 0; i < blocks.length; i++) {
          xml += this.generateBlockXml(blocks.get(i), i);
        }
      }
      xml += '</odeNavStructure>\n';
      return xml;
    }

    generateBlockXml(blockMap, index) {
      const blockId = blockMap.get('id') || blockMap.get('blockId');
      const blockName = blockMap.get('blockName') || 'Block';
      const order = blockMap.get('order') ?? index;

      let xml = `  <odePagStructure odePagStructureId="${this.escapeXml(blockId)}" `;
      xml += `blockName="${this.escapeXml(blockName)}" odePagStructureOrder="${order}">\n`;

      const components = blockMap.get('components');
      if (components) {
        for (let i = 0; i < components.length; i++) {
          xml += this.generateComponentXml(components.get(i), i);
        }
      }
      xml += '  </odePagStructure>\n';
      return xml;
    }

    generateComponentXml(compMap, index) {
      const compId = compMap.get('id') || compMap.get('ideviceId');
      const ideviceType = compMap.get('ideviceType') || 'FreeTextIdevice';
      const order = compMap.get('order') ?? index;

      let xml = `    <odeComponent odeComponentId="${this.escapeXml(compId)}" `;
      xml += `odeIdeviceTypeDirName="${this.escapeXml(ideviceType)}" odeComponentOrder="${order}">\n`;

      const htmlContent = compMap.get('htmlContent');
      if (htmlContent) {
        const content = htmlContent.toString ? htmlContent.toString() : String(htmlContent);
        xml += `      <htmlView><![CDATA[${content}]]></htmlView>\n`;
      }

      const properties = compMap.get('properties');
      if (properties) {
        const propsObj = {};
        properties.forEach((v, k) => { propsObj[k] = v; });
        xml += `      <jsonProperties><![CDATA[${JSON.stringify(propsObj)}]]></jsonProperties>\n`;
      }

      compMap.forEach((value, key) => {
        if (key.startsWith('prop_')) {
          xml += `      <odeComponentProperty key="${this.escapeXml(key.substring(5))}">${this.escapeXml(String(value))}</odeComponentProperty>\n`;
        }
      });

      xml += '    </odeComponent>\n';
      return xml;
    }

    async addAssetsToZip(zip) {
      const assets = await this.assetCache.getAllAssets();
      for (const asset of assets) {
        try {
          const path = asset.metadata?.originalPath || asset.metadata?.filename || `asset-${asset.assetId}`;
          zip.file(path, asset.blob);
        } catch (e) {
          console.warn('[ElpxExporter] Failed to add asset:', e);
        }
      }
    }

    escapeXml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ElpxExporter;
  } else {
    window.ElpxExporter = ElpxExporter;
  }
}

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
      // Normalize: lowercase, remove accents, keep only alphanumeric/space/hyphen, spaces to hyphens
      const sanitized = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
      return `${sanitized}.elpx`;
    }

    async exportToFile(filename = 'project.elpx') {
      Logger.log(`[ElpxExporter] Exporting to ${filename}...`);

      const fflateLib = window.fflate;
      if (!fflateLib) {
        throw new Error('fflate library not loaded');
      }

      const files = {};
      const contentXml = this.generateContentXml();
      files['content.xml'] = fflateLib.strToU8(contentXml);

      if (this.assetCache) {
        await this.addAssetsToFiles(files);
      }

      const blob = await this.generateZipBlob(files);

      this.downloadBlob(blob, filename);
      Logger.log(`[ElpxExporter] Export complete: ${filename}`);
      return { success: true, filename };
    }

    async exportToBlob() {
      const fflateLib = window.fflate;
      if (!fflateLib) throw new Error('fflate library not loaded');

      const files = {};
      files['content.xml'] = fflateLib.strToU8(this.generateContentXml());
      if (this.assetCache) await this.addAssetsToFiles(files);

      return this.generateZipBlob(files);
    }

    async generateZipBlob(files) {
      const fflateLib = window.fflate;
      return new Promise((resolve, reject) => {
        // Convert files to fflate format with compression options
        const zippable = {};
        for (const [path, data] of Object.entries(files)) {
          zippable[path] = [data, { level: 6 }];
        }
        fflateLib.zip(zippable, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(new Blob([data], { type: 'application/zip' }));
          }
        });
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
        pp_theme: metadata.get('theme') || 'base',
        pp_addPagination: metadata.get('addPagination'),
        pp_addSearchBox: metadata.get('addSearchBox'),
        pp_addExeLink: metadata.get('addExeLink'),
        pp_addAccessibilityToolbar: metadata.get('addAccessibilityToolbar'),
        pp_extraHeadContent: metadata.get('extraHeadContent') || '',
        footer: metadata.get('footer') || '',
        exportSource: metadata.get('exportSource'),
        pp_exelearning_version: metadata.get('exelearning_version') || 'v0.0.0-alpha',
      };
      for (const [key, value] of Object.entries(props)) {
        if (value !== undefined && value !== null && value !== '') {
          xml += '  <odeProperty>\n';
          xml += `    <key>${this.escapeXml(key)}</key>\n`;
          xml += `    <value>${this.escapeXml(String(value))}</value>\n`;
          xml += '  </odeProperty>\n';
        }
      }
      xml += '</odeProperties>\n';
      return xml;
    }

    generatePageXml(pageMap, index) {
      const pageId = pageMap.get('id') || pageMap.get('pageId');
      const pageName = pageMap.get('pageName') || 'Page';
      const parentId = pageMap.get('parentId') || '';
      const order = pageMap.get('order') ?? index;

      let xml = '<odeNavStructure>\n';
      xml += `  <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
      xml += `  <odeParentPageId>${this.escapeXml(parentId)}</odeParentPageId>\n`;
      xml += `  <pageName>${this.escapeXml(pageName)}</pageName>\n`;
      xml += `  <odeNavStructureOrder>${order}</odeNavStructureOrder>\n`;

      // Export page properties (odeNavStructureProperties)
      xml += this.generatePagePropertiesXml(pageMap);

      xml += '  <odePagStructures>\n';
      const blocks = pageMap.get('blocks');
      if (blocks) {
        for (let i = 0; i < blocks.length; i++) {
          xml += this.generateBlockXml(blocks.get(i), i, pageId);
        }
      }
      xml += '  </odePagStructures>\n';
      xml += '</odeNavStructure>\n';
      return xml;
    }

    generatePagePropertiesXml(pageMap) {
      let xml = '  <odeNavStructureProperties>\n';
      const properties = pageMap.get('properties');
      if (properties) {
        const propsToExport = ['visibility', 'highlight', 'hidePageTitle', 'editableInPage', 'titlePage', 'titleNode'];
        for (const key of propsToExport) {
          const value = properties.get ? properties.get(key) : properties[key];
          if (value !== undefined && value !== null && value !== '') {
            xml += '    <odeNavStructureProperty>\n';
            xml += `      <key>${this.escapeXml(key)}</key>\n`;
            xml += `      <value>${this.escapeXml(String(value))}</value>\n`;
            xml += '    </odeNavStructureProperty>\n';
          }
        }
      }
      xml += '  </odeNavStructureProperties>\n';
      return xml;
    }

    generateBlockXml(blockMap, index, pageId = '') {
      const blockId = blockMap.get('id') || blockMap.get('blockId');
      const blockName = blockMap.get('blockName') || '';
      const iconName = blockMap.get('iconName') || '';
      const order = blockMap.get('order') ?? index;

      let xml = '    <odePagStructure>\n';
      xml += `      <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
      xml += `      <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>\n`;
      xml += `      <blockName>${this.escapeXml(blockName)}</blockName>\n`;
      xml += `      <iconName>${this.escapeXml(iconName)}</iconName>\n`;
      xml += `      <odePagStructureOrder>${order}</odePagStructureOrder>\n`;

      // Export block properties (odePagStructureProperties)
      xml += this.generateBlockPropertiesXml(blockMap);

      xml += '      <odeComponents>\n';
      const components = blockMap.get('components');
      if (components) {
        for (let i = 0; i < components.length; i++) {
          xml += this.generateComponentXml(components.get(i), i, pageId, blockId);
        }
      }
      xml += '      </odeComponents>\n';
      xml += '    </odePagStructure>\n';
      return xml;
    }

    generateBlockPropertiesXml(blockMap) {
      let xml = '      <odePagStructureProperties>\n';
      const properties = blockMap.get('properties');
      if (properties) {
        const propsToExport = ['visibility', 'teacherOnly', 'allowToggle', 'minimized', 'identifier', 'cssClass'];
        for (const key of propsToExport) {
          const value = properties.get ? properties.get(key) : properties[key];
          if (value !== undefined && value !== null) {
            xml += '        <odePagStructureProperty>\n';
            xml += `          <key>${this.escapeXml(key)}</key>\n`;
            xml += `          <value>${this.escapeXml(String(value))}</value>\n`;
            xml += '        </odePagStructureProperty>\n';
          }
        }
      }
      xml += '      </odePagStructureProperties>\n';
      return xml;
    }

    generateComponentXml(compMap, index, pageId = '', blockId = '') {
      const compId = compMap.get('id') || compMap.get('ideviceId');
      const ideviceType = compMap.get('ideviceType') || 'FreeTextIdevice';
      const order = compMap.get('order') ?? index;

      let xml = '        <odeComponent>\n';
      xml += `          <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
      xml += `          <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>\n`;
      xml += `          <odeIdeviceId>${this.escapeXml(compId)}</odeIdeviceId>\n`;
      xml += `          <odeIdeviceTypeName>${this.escapeXml(ideviceType)}</odeIdeviceTypeName>\n`;

      const htmlContent = compMap.get('htmlContent');
      if (htmlContent) {
        const content = htmlContent.toString ? htmlContent.toString() : String(htmlContent);
        xml += `          <htmlView><![CDATA[${content}]]></htmlView>\n`;
      }

      // Export jsonProperties (iDevice-specific properties)
      const ideviceProperties = compMap.get('ideviceProperties');
      if (ideviceProperties) {
        const propsObj = {};
        if (ideviceProperties.forEach) {
          ideviceProperties.forEach((v, k) => { propsObj[k] = v; });
        }
        xml += `          <jsonProperties><![CDATA[${JSON.stringify(propsObj)}]]></jsonProperties>\n`;
      } else {
        xml += '          <jsonProperties></jsonProperties>\n';
      }

      xml += `          <odeComponentsOrder>${order}</odeComponentsOrder>\n`;

      // Export component structure properties (odeComponentsProperties)
      xml += this.generateComponentPropertiesXml(compMap);

      compMap.forEach((value, key) => {
        if (key.startsWith('prop_')) {
          xml += `          <odeComponentProperty key="${this.escapeXml(key.substring(5))}">${this.escapeXml(String(value))}</odeComponentProperty>\n`;
        }
      });

      xml += '        </odeComponent>\n';
      return xml;
    }

    generateComponentPropertiesXml(compMap) {
      let xml = '          <odeComponentsProperties>\n';
      const properties = compMap.get('properties');
      if (properties) {
        const propsToExport = ['visibility', 'teacherOnly', 'identifier', 'cssClass'];
        for (const key of propsToExport) {
          const value = properties.get ? properties.get(key) : properties[key];
          if (value !== undefined && value !== null) {
            xml += '            <odeComponentsProperty>\n';
            xml += `              <key>${this.escapeXml(key)}</key>\n`;
            xml += `              <value>${this.escapeXml(String(value))}</value>\n`;
            xml += '            </odeComponentsProperty>\n';
          }
        }
      }
      xml += '          </odeComponentsProperties>\n';
      return xml;
    }

    async addAssetsToFiles(files) {
      const assets = await this.assetCache.getAllAssets();
      for (const asset of assets) {
        try {
          const filePath = asset.metadata?.originalPath || asset.metadata?.filename || `asset-${asset.assetId}`;
          // Convert Blob to Uint8Array
          const arrayBuffer = await asset.blob.arrayBuffer();
          files[filePath] = new Uint8Array(arrayBuffer);
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

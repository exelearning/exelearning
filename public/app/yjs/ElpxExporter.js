/**
 * ElpxExporter
 *
 * Exports a document to ELPX (eXeLearning Project) format.
 * ELPX files contain content.xml in exe_document format for re-import.
 *
 * Usage:
 *   const exporter = new ElpxExporter(yjsDocumentManager, assetCacheManager);
 *   await exporter.export('my-project.elpx');
 *   // or legacy method:
 *   await exporter.exportToFile('my-project.elpx');
 */

// DTD content for exe_document format
const EXE_DOCUMENT_DTD = `<!--
    eXeLearning Document DTD
    Document Type Definition for eXeLearning content.xml format
    Version: 3.0
    Copyright (C) 2025 eXeLearning - License: AGPL-3.0
-->

<!-- Root element -->
<!ELEMENT exe_document (meta, navigation)>

<!-- Metadata Section -->
<!ELEMENT meta (author?, title?, subtitle?, description?, language?, license?, keywords?, taxonomy?, aggregationLevel?, structure?, semanticDensity?, difficulty?, typicalLearningTime?, context?, endUser?, interactivityType?, interactivityLevel?, cognitiveProcess?, intendedEducationalUse?, version?, exelearning_version?, created?, modified?, theme?, addExeLink?, addPagination?, addSearchBox?, addAccessibilityToolbar?, addMathJax?, exportSource?, extraHeadContent?, footer?)>

<!ELEMENT author (#PCDATA)>
<!ELEMENT title (#PCDATA)>
<!ELEMENT subtitle (#PCDATA)>
<!ELEMENT description (#PCDATA)>
<!ELEMENT language (#PCDATA)>
<!ELEMENT license (#PCDATA)>
<!ELEMENT keywords (#PCDATA)>
<!ELEMENT taxonomy (#PCDATA)>
<!ELEMENT aggregationLevel (#PCDATA)>
<!ELEMENT structure (#PCDATA)>
<!ELEMENT semanticDensity (#PCDATA)>
<!ELEMENT difficulty (#PCDATA)>
<!ELEMENT typicalLearningTime (#PCDATA)>
<!ELEMENT context (#PCDATA)>
<!ELEMENT endUser (#PCDATA)>
<!ELEMENT interactivityType (#PCDATA)>
<!ELEMENT interactivityLevel (#PCDATA)>
<!ELEMENT cognitiveProcess (#PCDATA)>
<!ELEMENT intendedEducationalUse (#PCDATA)>
<!ELEMENT version (#PCDATA)>
<!ELEMENT exelearning_version (#PCDATA)>
<!ELEMENT created (#PCDATA)>
<!ELEMENT modified (#PCDATA)>
<!ELEMENT theme (#PCDATA)>
<!ELEMENT addExeLink (#PCDATA)>
<!ELEMENT addPagination (#PCDATA)>
<!ELEMENT addSearchBox (#PCDATA)>
<!ELEMENT addAccessibilityToolbar (#PCDATA)>
<!ELEMENT addMathJax (#PCDATA)>
<!ELEMENT exportSource (#PCDATA)>
<!ELEMENT extraHeadContent (#PCDATA)>
<!ELEMENT footer (#PCDATA)>

<!-- Navigation Section -->
<!ELEMENT navigation (page+)>

<!ELEMENT page (component*, page*)>
<!ATTLIST page
    id CDATA #REQUIRED
    title CDATA #REQUIRED>

<!-- Components (iDevices) -->
<!ELEMENT component (content?, properties?, data?)>
<!ATTLIST component
    type CDATA #REQUIRED
    id CDATA #REQUIRED
    position CDATA #IMPLIED>

<!ELEMENT content (#PCDATA)>
<!ELEMENT properties ANY>
<!ELEMENT data ANY>
`;

// Check if the new ElpxExporter is already loaded
if (typeof window !== 'undefined' && window.ElpxExporter) {
  // Already loaded from exporters directory
  Logger.log('[ElpxExporter] Using exporter from exporters/ directory');
} else {
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
      files['content.dtd'] = fflateLib.strToU8(EXE_DOCUMENT_DTD);

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
      files['content.dtd'] = fflateLib.strToU8(EXE_DOCUMENT_DTD);
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

    /**
     * Generate content.xml in exe_document format
     */
    generateContentXml() {
      const metadata = this.manager.getMetadata();
      const navigation = this.manager.getNavigation();

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<!DOCTYPE exe_document SYSTEM "content.dtd">\n';
      xml += '<exe_document>\n';
      xml += this.generateMetaXml(metadata);
      xml += this.generateNavigationXml(navigation);
      xml += '</exe_document>';
      return xml;
    }

    /**
     * Generate meta section with direct element children
     */
    generateMetaXml(metadata) {
      let xml = '  <meta>\n';

      const metaFields = {
        author: metadata.get('author') || '',
        title: metadata.get('title') || 'Untitled',
        subtitle: metadata.get('subtitle') || '',
        description: metadata.get('description') || '',
        language: metadata.get('language') || 'en',
        license: metadata.get('license') || '',
        keywords: metadata.get('keywords') || '',
        theme: metadata.get('theme') || 'base',
        version: '3.0',
        exelearning_version: metadata.get('exelearning_version') || 'v0.0.0-alpha',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        addExeLink: metadata.get('addExeLink'),
        addPagination: metadata.get('addPagination'),
        addSearchBox: metadata.get('addSearchBox'),
        addAccessibilityToolbar: metadata.get('addAccessibilityToolbar'),
        addMathJax: metadata.get('addMathJax'),
        exportSource: metadata.get('exportSource'),
        extraHeadContent: metadata.get('extraHeadContent') || '',
        footer: metadata.get('footer') || '',
      };

      for (const [key, value] of Object.entries(metaFields)) {
        if (value !== undefined && value !== null && value !== '') {
          xml += `    <${key}>${this.escapeXml(String(value))}</${key}>\n`;
        }
      }

      xml += '  </meta>\n';
      return xml;
    }

    /**
     * Generate navigation section with nested page elements
     */
    generateNavigationXml(navigation) {
      let xml = '  <navigation>\n';

      // Build page tree from flat navigation
      const pageTree = this.buildPageTree(navigation);

      for (const page of pageTree) {
        xml += this.generatePageXml(page, 2);
      }

      xml += '  </navigation>\n';
      return xml;
    }

    /**
     * Build hierarchical page tree from flat navigation list
     */
    buildPageTree(navigation) {
      const pages = [];
      const pageById = new Map();

      // First pass: collect all pages
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        const pageId = pageMap.get('id') || pageMap.get('pageId');
        const page = {
          id: pageId,
          title: pageMap.get('pageName') || 'Page',
          parentId: pageMap.get('parentId') || '',
          order: pageMap.get('order') ?? i,
          blocks: pageMap.get('blocks'),
          children: []
        };
        pages.push(page);
        pageById.set(pageId, page);
      }

      // Second pass: build hierarchy
      const rootPages = [];
      for (const page of pages) {
        if (page.parentId && pageById.has(page.parentId)) {
          pageById.get(page.parentId).children.push(page);
        } else {
          rootPages.push(page);
        }
      }

      // Sort by order
      rootPages.sort((a, b) => a.order - b.order);
      for (const page of pages) {
        page.children.sort((a, b) => a.order - b.order);
      }

      return rootPages;
    }

    /**
     * Generate page element with attributes and nested content
     */
    generatePageXml(page, indent) {
      const indentStr = '  '.repeat(indent);
      let xml = `${indentStr}<page id="${this.escapeXml(page.id)}" title="${this.escapeXml(page.title)}">\n`;

      // Add components from blocks
      if (page.blocks) {
        for (let i = 0; i < page.blocks.length; i++) {
          const block = page.blocks.get(i);
          const components = block.get('components');
          if (components) {
            for (let j = 0; j < components.length; j++) {
              xml += this.generateComponentXml(components.get(j), j, indent + 1);
            }
          }
        }
      }

      // Add child pages
      for (const child of page.children) {
        xml += this.generatePageXml(child, indent + 1);
      }

      xml += `${indentStr}</page>\n`;
      return xml;
    }

    /**
     * Generate component element with attributes
     */
    generateComponentXml(compMap, index, indent) {
      const indentStr = '  '.repeat(indent);
      const compId = compMap.get('id') || compMap.get('ideviceId');
      const ideviceType = compMap.get('ideviceType') || 'FreeTextIdevice';
      const order = compMap.get('order') ?? index;

      let xml = `${indentStr}<component type="${this.escapeXml(ideviceType)}" id="${this.escapeXml(compId)}" position="${order}">\n`;

      // Content (HTML)
      const htmlContent = compMap.get('htmlContent');
      if (htmlContent) {
        const content = htmlContent.toString ? htmlContent.toString() : String(htmlContent);
        xml += `${indentStr}  <content><![CDATA[${content}]]></content>\n`;
      }

      // Properties (iDevice-specific)
      const ideviceProperties = compMap.get('ideviceProperties');
      if (ideviceProperties) {
        const propsObj = {};
        if (ideviceProperties.forEach) {
          ideviceProperties.forEach((v, k) => { propsObj[k] = v; });
        }
        if (Object.keys(propsObj).length > 0) {
          xml += `${indentStr}  <properties><![CDATA[${JSON.stringify(propsObj)}]]></properties>\n`;
        }
      }

      xml += `${indentStr}</component>\n`;
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

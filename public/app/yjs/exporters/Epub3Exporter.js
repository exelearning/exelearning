/**
 * Epub3Exporter
 * Exports a Yjs document to EPUB3 format (.epub).
 *
 * EPUB3 export creates:
 * - mimetype (must be first, uncompressed)
 * - META-INF/container.xml
 * - OEBPS/content.opf (OPF package file)
 * - OEBPS/toc.ncx (NCX for EPUB2 compatibility)
 * - OEBPS/nav.xhtml (EPUB3 navigation)
 * - OEBPS/*.xhtml (chapter files)
 * - OEBPS/images/ (embedded images)
 * - OEBPS/css/style.css (stylesheet)
 *
 * @extends BaseExporter
 */

class Epub3Exporter extends BaseExporter {
  /**
   * @param {YjsDocumentManager} documentManager - The Yjs document manager
   * @param {AssetCacheManager} assetCacheManager - Asset cache manager for retrieving assets
   * @param {ResourceFetcher} resourceFetcher - Resource fetcher for server resources
   */
  constructor(documentManager, assetCacheManager = null, resourceFetcher = null) {
    super(documentManager, assetCacheManager, resourceFetcher);
    this.bookId = this.generateBookId();
    this.manifestItems = [];
    this.spineItems = [];
    this.navPoints = [];
    this.playOrder = 0;
  }

  /**
   * Get file extension for EPUB3 format
   * @returns {string}
   */
  getFileExtension() {
    return '.epub';
  }

  /**
   * Get file suffix for EPUB3 format
   * @returns {string}
   */
  getFileSuffix() {
    return '_epub3';
  }

  /**
   * Generate unique book ID
   * @returns {string}
   */
  generateBookId() {
    return 'urn:uuid:' + this.generateUUID();
  }

  /**
   * Generate UUID v4
   * @returns {string}
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Export to EPUB3 file and trigger download
   * @param {string} filename - Optional filename override
   * @returns {Promise<{success: boolean, filename: string}>}
   */
  async export(filename = null) {
    const exportFilename = filename || this.buildFilename();
    Logger.log(`[Epub3Exporter] Exporting to ${exportFilename}...`);

    try {
      const zip = this.createZip();
      let pages = this.buildPageList();
      const meta = this.getMetadata();

      // Pre-process pages: add filenames to asset URLs
      Logger.log('[Epub3Exporter] Pre-processing asset URLs...');
      pages = await this.preprocessPagesForExport(pages);

      // Reset tracking
      this.manifestItems = [];
      this.spineItems = [];
      this.navPoints = [];
      this.playOrder = 0;

      // 1. Add mimetype (MUST be first and uncompressed)
      // Note: JSZip doesn't support storing files uncompressed at specific positions,
      // but most EPUB readers tolerate this. For strict compliance, use a native ZIP library.
      zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

      // 2. Add META-INF/container.xml
      zip.file('META-INF/container.xml', this.generateContainerXml());

      // 3. Add CSS
      const cssContent = this.generateEpubCss();
      zip.file('OEBPS/css/style.css', cssContent);
      this.manifestItems.push({
        id: 'style-css',
        href: 'css/style.css',
        mediaType: 'text/css',
      });

      // 4. Generate XHTML chapters
      Logger.log(`[Epub3Exporter] Generating ${pages.length} chapters...`);
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const chapterFilename = `chapter_${i + 1}.xhtml`;
        const chapterId = `chapter-${i + 1}`;
        const xhtml = this.generateChapterXhtml(page, meta);
        zip.file(`OEBPS/${chapterFilename}`, xhtml);

        this.manifestItems.push({
          id: chapterId,
          href: chapterFilename,
          mediaType: 'application/xhtml+xml',
        });

        this.spineItems.push(chapterId);

        // Add to nav points for NCX
        this.playOrder++;
        this.navPoints.push({
          id: `navpoint-${this.playOrder}`,
          playOrder: this.playOrder,
          label: page.title || `Chapter ${i + 1}`,
          src: chapterFilename,
        });
      }

      // 5. Add images from asset cache
      Logger.log('[Epub3Exporter] Adding images...');
      await this.addImagesToEpub(zip);

      // 6. Generate nav.xhtml (EPUB3 navigation)
      const navXhtml = this.generateNavXhtml(pages, meta);
      zip.file('OEBPS/nav.xhtml', navXhtml);
      this.manifestItems.push({
        id: 'nav',
        href: 'nav.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: 'nav',
      });

      // 7. Generate toc.ncx (EPUB2 compatibility)
      const tocNcx = this.generateTocNcx(meta);
      zip.file('OEBPS/toc.ncx', tocNcx);
      this.manifestItems.push({
        id: 'ncx',
        href: 'toc.ncx',
        mediaType: 'application/x-dtbncx+xml',
      });

      // 8. Generate content.opf (OPF package)
      const contentOpf = this.generateContentOpf(meta);
      zip.file('OEBPS/content.opf', contentOpf);

      // 9. Generate and download EPUB
      Logger.log('[Epub3Exporter] Generating EPUB...');
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
        // Set mimetype to be stored (not compressed) - JSZip 3.x supports this per-file
      });

      this.downloadBlob(blob, exportFilename);

      Logger.log(`[Epub3Exporter] Export complete: ${exportFilename}`);
      return { success: true, filename: exportFilename };
    } catch (error) {
      console.error('[Epub3Exporter] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate container.xml
   * @returns {string}
   */
  generateContainerXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  }

  /**
   * Generate content.opf (OPF package file)
   * @param {Y.Map} meta - Project metadata
   * @returns {string}
   */
  generateContentOpf(meta) {
    const title = meta.get('title') || 'eXeLearning';
    const author = meta.get('author') || 'Unknown';
    const language = meta.get('language') || 'en';
    const description = meta.get('description') || '';
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="bookid">${this.escapeXml(this.bookId)}</dc:identifier>
    <dc:title>${this.escapeXml(title)}</dc:title>
    <dc:creator>${this.escapeXml(author)}</dc:creator>
    <dc:language>${this.escapeXml(language)}</dc:language>
    <meta property="dcterms:modified">${now}</meta>`;

    if (description) {
      xml += `\n    <dc:description>${this.escapeXml(description)}</dc:description>`;
    }

    xml += `
  </metadata>
  <manifest>`;

    // Add manifest items
    for (const item of this.manifestItems) {
      let itemXml = `\n    <item id="${this.escapeXml(item.id)}" href="${this.escapeXml(item.href)}" media-type="${this.escapeXml(item.mediaType)}"`;
      if (item.properties) {
        itemXml += ` properties="${this.escapeXml(item.properties)}"`;
      }
      itemXml += '/>';
      xml += itemXml;
    }

    xml += `
  </manifest>
  <spine toc="ncx">`;

    // Add spine items
    for (const itemRef of this.spineItems) {
      xml += `\n    <itemref idref="${this.escapeXml(itemRef)}"/>`;
    }

    xml += `
  </spine>
</package>`;

    return xml;
  }

  /**
   * Generate toc.ncx (NCX navigation for EPUB2 compatibility)
   * @param {Y.Map} meta - Project metadata
   * @returns {string}
   */
  generateTocNcx(meta) {
    const title = meta.get('title') || 'eXeLearning';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${this.escapeXml(this.bookId)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${this.escapeXml(title)}</text>
  </docTitle>
  <navMap>`;

    // Add nav points
    for (const navPoint of this.navPoints) {
      xml += `
    <navPoint id="${this.escapeXml(navPoint.id)}" playOrder="${navPoint.playOrder}">
      <navLabel>
        <text>${this.escapeXml(navPoint.label)}</text>
      </navLabel>
      <content src="${this.escapeXml(navPoint.src)}"/>
    </navPoint>`;
    }

    xml += `
  </navMap>
</ncx>`;

    return xml;
  }

  /**
   * Generate nav.xhtml (EPUB3 navigation document)
   * @param {Array} pages - All pages
   * @param {Y.Map} meta - Project metadata
   * @returns {string}
   */
  generateNavXhtml(pages, meta) {
    const title = meta.get('title') || 'Table of Contents';
    const language = meta.get('language') || 'en';

    let tocHtml = '';
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      tocHtml += `      <li><a href="chapter_${i + 1}.xhtml">${this.escapeXml(page.title || `Chapter ${i + 1}`)}</a></li>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}" lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <title>${this.escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${tocHtml}    </ol>
  </nav>
</body>
</html>`;
  }

  /**
   * Generate XHTML chapter for a page
   * @param {Object} page - Page data
   * @param {Y.Map} meta - Project metadata
   * @returns {string}
   */
  generateChapterXhtml(page, meta) {
    const title = page.title || 'Untitled';
    const language = meta.get('language') || 'en';

    // Render blocks content
    let contentHtml = '';
    for (const block of page.blocks || []) {
      contentHtml += this.renderBlockForEpub(block);
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${language}" lang="${language}">
<head>
  <meta charset="UTF-8"/>
  <title>${this.escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="chapter">
    <h1>${this.escapeXml(title)}</h1>
${contentHtml}
  </section>
</body>
</html>`;
  }

  /**
   * Render a block for EPUB (simplified HTML)
   * @param {Object} block - Block data
   * @returns {string}
   */
  renderBlockForEpub(block) {
    let html = '';

    // Process components (iDevices)
    for (const component of block.components || []) {
      html += this.renderComponentForEpub(component);
    }

    return html;
  }

  /**
   * Render a component (iDevice) for EPUB
   * @param {Object} component - Component data
   * @returns {string}
   */
  renderComponentForEpub(component) {
    let html = `    <div class="idevice">\n`;

    // Add title if present
    if (component.title) {
      html += `      <h2>${this.escapeXml(component.title)}</h2>\n`;
    }

    // Render fields
    for (const field of component.fields || []) {
      html += this.renderFieldForEpub(field);
    }

    html += `    </div>\n`;
    return html;
  }

  /**
   * Render a field for EPUB
   * @param {Object} field - Field data
   * @returns {string}
   */
  renderFieldForEpub(field) {
    const type = field.type || 'text';
    let content = field.content || '';

    // Convert asset:// URLs to relative paths (filename can contain spaces)
    content = content.replace(/asset:\/\/([a-f0-9-]+)\/([^"']+)/gi, 'images/$1_$2');
    // Also handle content/resources/ format
    content = content.replace(/content\/resources\/([a-f0-9-]+)\/([^"']+)/gi, 'images/$1_$2');

    // Clean up HTML for EPUB (remove scripts, iframes, etc.)
    content = this.cleanHtmlForEpub(content);

    return `      <div class="field field-${type}">\n        ${content}\n      </div>\n`;
  }

  /**
   * Clean HTML content for EPUB compatibility
   * @param {string} html
   * @returns {string}
   */
  cleanHtmlForEpub(html) {
    // Remove script tags
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    // Remove iframe tags
    html = html.replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '');
    // Remove video/audio tags (not well supported in EPUB readers)
    html = html.replace(/<video\b[^>]*>.*?<\/video>/gi, '[Video content]');
    html = html.replace(/<audio\b[^>]*>.*?<\/audio>/gi, '[Audio content]');
    // Remove style attributes with complex values
    html = html.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');
    // Convert data attributes
    html = html.replace(/\s*data-[a-z-]+\s*=\s*["'][^"']*["']/gi, '');

    return html;
  }

  /**
   * Add images from asset cache to EPUB
   * @param {Object} zip - JSZip instance
   */
  async addImagesToEpub(zip) {
    let assetsAdded = 0;

    // 1. Try AssetManager first (primary source - IndexedDB)
    if (this.assetManager) {
      try {
        const assets = await this.assetManager.getProjectAssets();
        Logger.log(`[Epub3Exporter] Found ${assets.length} assets in AssetManager`);

        for (const asset of assets) {
          try {
            const assetId = asset.id || asset.assetId;
            const filename = asset.filename || asset.originalFilename || `asset-${assetId}`;
            const mimeType = asset.mimeType || asset.type || this.getMimeType(filename);
            const epubFilename = `${assetId}_${filename}`;

            if (asset.blob) {
              zip.file(`OEBPS/images/${epubFilename}`, asset.blob);

              // Add to manifest
              this.manifestItems.push({
                id: `img-${assetId.substring(0, 8)}`,
                href: `images/${epubFilename}`,
                mediaType: mimeType,
              });
              assetsAdded++;
            }
          } catch (e) {
            console.warn('[Epub3Exporter] Failed to add asset:', e);
          }
        }
      } catch (e) {
        console.warn('[Epub3Exporter] Failed to get assets from AssetManager:', e);
      }
    }

    // 2. Try assetCacheManager as fallback
    if (assetsAdded === 0 && this.assetCacheManager) {
      try {
        const assets = await this.assetCacheManager.getAllAssets();
        Logger.log(`[Epub3Exporter] Found ${assets.length} assets in assetCacheManager`);

        for (const asset of assets) {
          try {
            const assetId = asset.assetId || asset.metadata?.assetId;
            const filename = asset.metadata?.filename || `asset-${assetId}`;
            const mimeType = asset.metadata?.mimeType || this.getMimeType(filename);
            const epubFilename = `${assetId}_${filename}`;

            if (asset.blob) {
              zip.file(`OEBPS/images/${epubFilename}`, asset.blob);

              // Add to manifest
              this.manifestItems.push({
                id: `img-${assetId.substring(0, 8)}`,
                href: `images/${epubFilename}`,
                mediaType: mimeType,
              });
              assetsAdded++;
            }
          } catch (e) {
            console.warn('[Epub3Exporter] Failed to add asset from cache:', e);
          }
        }
      } catch (e) {
        console.warn('[Epub3Exporter] Failed to get assets from cache:', e);
      }
    }

    Logger.log(`[Epub3Exporter] Added ${assetsAdded} images to EPUB`);
  }

  /**
   * Get MIME type from filename
   * @param {string} filename
   * @returns {string}
   */
  getMimeType(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Generate EPUB CSS
   * @returns {string}
   */
  generateEpubCss() {
    return `/* EPUB3 Stylesheet */
body {
  font-family: serif;
  font-size: 1em;
  line-height: 1.6;
  margin: 1em;
  padding: 0;
}

h1 {
  font-size: 1.8em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}

h2 {
  font-size: 1.4em;
  margin-top: 1em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}

h3 {
  font-size: 1.2em;
  margin-top: 1em;
  margin-bottom: 0.5em;
}

p {
  margin: 0.5em 0;
  text-align: justify;
}

img {
  max-width: 100%;
  height: auto;
}

.chapter {
  page-break-before: always;
}

.idevice {
  margin: 1em 0;
  padding: 0.5em;
  border-left: 3px solid #ccc;
}

.field {
  margin: 0.5em 0;
}

/* Table of Contents */
nav#toc ol {
  list-style-type: none;
  padding-left: 0;
}

nav#toc li {
  margin: 0.5em 0;
}

nav#toc a {
  text-decoration: none;
  color: #0066cc;
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

th, td {
  border: 1px solid #ccc;
  padding: 0.5em;
  text-align: left;
}

th {
  background-color: #f0f0f0;
}

/* Lists */
ul, ol {
  margin: 0.5em 0 0.5em 1.5em;
  padding: 0;
}

li {
  margin: 0.25em 0;
}

/* Blockquote */
blockquote {
  margin: 1em 2em;
  padding-left: 1em;
  border-left: 3px solid #ccc;
  font-style: italic;
}

/* Code */
code, pre {
  font-family: monospace;
  font-size: 0.9em;
  background-color: #f5f5f5;
}

pre {
  padding: 1em;
  overflow-x: auto;
  white-space: pre-wrap;
}
`;
  }

  /**
   * Escape XML special characters
   * @param {string} str
   * @returns {string}
   */
  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Epub3Exporter;
} else {
  window.Epub3Exporter = Epub3Exporter;
}

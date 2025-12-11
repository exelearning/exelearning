/**
 * ImsManifestGenerator
 * Generates imsmanifest.xml for IMS Content Package (CP) format.
 *
 * IMS CP manifest structure:
 * - manifest (xmlns imscp_v1p1, imsmd_v1p2)
 *   - metadata (schema=IMS Content, schemaversion=1.1.3)
 *   - organizations
 *     - organization
 *       - title
 *       - item (hierarchical structure)
 *   - resources
 */
class ImsManifestGenerator {
  /**
   * @param {string} projectId - Unique project identifier
   * @param {Array} pages - Pages from buildPageList()
   * @param {Object} metadata - Project metadata
   */
  constructor(projectId, pages, metadata) {
    this.projectId = projectId || this.generateId();
    this.pages = pages || [];
    this.metadata = metadata || {};
  }

  /**
   * Generate a unique ID for the project
   * @returns {string}
   */
  generateId() {
    return 'exe-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  /**
   * Generate complete imsmanifest.xml content
   * @param {Object} options - Generation options
   * @param {string[]} options.commonFiles - List of common files to include
   * @param {Object} options.pageFiles - Map of pageId to file info
   * @returns {string}
   */
  generate(options = {}) {
    const { commonFiles = [], pageFiles = {} } = options;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += this.generateManifestOpen();
    xml += this.generateMetadata();
    xml += this.generateOrganizations();
    xml += this.generateResources(commonFiles, pageFiles);
    xml += '</manifest>\n';

    return xml;
  }

  /**
   * Generate manifest opening tag with IMS CP namespaces
   * @returns {string}
   */
  generateManifestOpen() {
    return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:imsmd="http://www.imsglobal.org/xsd/imsmd_v1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
    http://www.imsglobal.org/xsd/imsmd_v1p2 imsmd_v1p2p2.xsd">
`;
  }

  /**
   * Generate metadata section
   * @returns {string}
   */
  generateMetadata() {
    const title = this.metadata.title || 'eXeLearning';
    const description = this.metadata.description || '';
    const language = this.metadata.language || 'en';
    const author = this.metadata.author || '';

    let xml = '  <metadata>\n';
    xml += '    <schema>IMS Content</schema>\n';
    xml += '    <schemaversion>1.1.3</schemaversion>\n';

    // Inline LOM metadata
    xml += '    <imsmd:lom>\n';
    xml += '      <imsmd:general>\n';
    xml += `        <imsmd:title>\n`;
    xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(title)}</imsmd:langstring>\n`;
    xml += `        </imsmd:title>\n`;
    if (description) {
      xml += `        <imsmd:description>\n`;
      xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(description)}</imsmd:langstring>\n`;
      xml += `        </imsmd:description>\n`;
    }
    xml += `        <imsmd:language>${this.escapeXml(language)}</imsmd:language>\n`;
    xml += '      </imsmd:general>\n';

    if (author) {
      xml += '      <imsmd:lifecycle>\n';
      xml += '        <imsmd:contribute>\n';
      xml += '          <imsmd:role>\n';
      xml += '            <imsmd:value>Author</imsmd:value>\n';
      xml += '          </imsmd:role>\n';
      xml += '          <imsmd:centity>\n';
      xml += `            <imsmd:vcard>BEGIN:VCARD\\nFN:${this.escapeXml(author)}\\nEND:VCARD</imsmd:vcard>\n`;
      xml += '          </imsmd:centity>\n';
      xml += '        </imsmd:contribute>\n';
      xml += '      </imsmd:lifecycle>\n';
    }

    xml += '    </imsmd:lom>\n';
    xml += '  </metadata>\n';
    return xml;
  }

  /**
   * Generate organizations section
   * @returns {string}
   */
  generateOrganizations() {
    const orgId = `eXe-${this.projectId}`;
    const title = this.metadata.title || 'eXeLearning';

    let xml = `  <organizations default="${this.escapeXml(orgId)}">\n`;
    xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">\n`;
    xml += `      <title>${this.escapeXml(title)}</title>\n`;

    // Build page hierarchy
    xml += this.generateItems();

    xml += '    </organization>\n';
    xml += '  </organizations>\n';
    return xml;
  }

  /**
   * Generate item elements for pages in hierarchical structure
   * @returns {string}
   */
  generateItems() {
    // Build a map of pages by ID for quick lookup
    const pageMap = new Map();
    this.pages.forEach((page) => {
      pageMap.set(page.id, page);
    });

    // Find root pages (no parent)
    const rootPages = this.pages.filter((p) => !p.parentId);

    // Generate items recursively
    let xml = '';
    rootPages.forEach((page) => {
      xml += this.generateItemRecursive(page, pageMap, 3);
    });

    return xml;
  }

  /**
   * Generate item element recursively for nested pages
   * @param {Object} page - Page object
   * @param {Map} pageMap - Map of all pages by ID
   * @param {number} indent - Indentation level
   * @returns {string}
   */
  generateItemRecursive(page, pageMap, indent) {
    const indentStr = '  '.repeat(indent);
    const isVisible = page.visible !== false ? 'true' : 'false';
    const children = this.pages.filter((p) => p.parentId === page.id);

    let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">\n`;
    xml += `${indentStr}  <title>${this.escapeXml(page.title || 'Page')}</title>\n`;

    // Generate children
    children.forEach((child) => {
      xml += this.generateItemRecursive(child, pageMap, indent + 1);
    });

    xml += `${indentStr}</item>\n`;
    return xml;
  }

  /**
   * Generate resources section
   * @param {string[]} commonFiles - List of common file paths
   * @param {Object} pageFiles - Map of pageId to { fileUrl, files }
   * @returns {string}
   */
  generateResources(commonFiles, pageFiles) {
    let xml = '  <resources>\n';

    // Generate resource for each page
    this.pages.forEach((page) => {
      const pageFile = pageFiles[page.id] || {};
      xml += this.generatePageResource(page, pageFile);
    });

    // Generate COMMON_FILES resource
    xml += this.generateCommonFilesResource(commonFiles);

    xml += '  </resources>\n';
    return xml;
  }

  /**
   * Generate resource element for a page
   * @param {Object} page - Page object
   * @param {Object} pageFile - Page file info { fileUrl, files }
   * @returns {string}
   */
  generatePageResource(page, pageFile) {
    const pageId = page.id;
    const isIndex = this.pages.indexOf(page) === 0;
    const fileUrl = pageFile.fileUrl || (isIndex ? 'index.html' : `html/${this.sanitizeFilename(page.title)}.html`);

    let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" href="${this.escapeXml(fileUrl)}">\n`;

    // Add the main HTML file
    xml += `      <file href="${this.escapeXml(fileUrl)}"/>\n`;

    // Add resource files if available
    const files = pageFile.files || [];
    files.forEach((file) => {
      xml += `      <file href="${this.escapeXml(file)}"/>\n`;
    });

    // Add dependency on COMMON_FILES
    xml += '      <dependency identifierref="COMMON_FILES"/>\n';
    xml += '    </resource>\n';

    return xml;
  }

  /**
   * Generate COMMON_FILES resource for shared assets
   * @param {string[]} commonFiles - List of common file paths
   * @returns {string}
   */
  generateCommonFilesResource(commonFiles) {
    let xml = '    <resource identifier="COMMON_FILES" type="webcontent">\n';

    // Add all common files
    commonFiles.forEach((file) => {
      xml += `      <file href="${this.escapeXml(file)}"/>\n`;
    });

    xml += '    </resource>\n';
    return xml;
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

  /**
   * Sanitize filename for use in paths
   * @param {string} title
   * @returns {string}
   */
  sanitizeFilename(title) {
    if (!title) return 'page';
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImsManifestGenerator;
} else {
  window.ImsManifestGenerator = ImsManifestGenerator;
}

/**
 * Scorm2004ManifestGenerator
 * Generates imsmanifest.xml for SCORM 2004 (3rd/4th Edition) packages.
 *
 * SCORM 2004 manifest structure:
 * - manifest (xmlns imscp, adlcp, adlseq, adlnav, imsss)
 *   - metadata (schema=ADL SCORM, schemaversion=2004 4th Edition)
 *   - organizations
 *     - organization
 *       - title
 *       - item (with sequencing rules)
 *         - imsss:sequencing
 *   - resources
 */
class Scorm2004ManifestGenerator {
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
   * Generate manifest opening tag with SCORM 2004 namespaces
   * @returns {string}
   */
  generateManifestOpen() {
    return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
    http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
    http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
    http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
    http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
`;
  }

  /**
   * Generate metadata section
   * @returns {string}
   */
  generateMetadata() {
    let xml = '  <metadata>\n';
    xml += '    <schema>ADL SCORM</schema>\n';
    xml += '    <schemaversion>2004 4th Edition</schemaversion>\n';
    xml += '    <adlcp:location>imslrm.xml</adlcp:location>\n';
    xml += '  </metadata>\n';
    return xml;
  }

  /**
   * Generate organizations section with sequencing
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

    // Add default sequencing for organization
    xml += this.generateOrganizationSequencing();

    xml += '    </organization>\n';
    xml += '  </organizations>\n';
    return xml;
  }

  /**
   * Generate organization-level sequencing rules
   * @returns {string}
   */
  generateOrganizationSequencing() {
    return `      <imsss:sequencing>
        <imsss:controlMode choice="true" choiceExit="true" flow="true" forwardOnly="false"/>
      </imsss:sequencing>
`;
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
    const hasChildren = children.length > 0;

    let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">\n`;
    xml += `${indentStr}  <title>${this.escapeXml(page.title || 'Page')}</title>\n`;

    // Generate children
    children.forEach((child) => {
      xml += this.generateItemRecursive(child, pageMap, indent + 1);
    });

    // Add sequencing for items with children (clusters)
    if (hasChildren) {
      xml += this.generateItemSequencing(indentStr + '  ');
    }

    xml += `${indentStr}</item>\n`;
    return xml;
  }

  /**
   * Generate sequencing rules for a parent item (cluster)
   * @param {string} indentStr
   * @returns {string}
   */
  generateItemSequencing(indentStr) {
    return `${indentStr}<imsss:sequencing>
${indentStr}  <imsss:controlMode choice="true" choiceExit="true" flow="true"/>
${indentStr}</imsss:sequencing>
`;
  }

  /**
   * Generate resources section
   * @param {string[]} commonFiles - List of common file paths
   * @param {Object} pageFiles - Map of pageId to { fileUrl, files }
   * @returns {string}
   */
  generateResources(commonFiles, pageFiles) {
    let xml = '  <resources>\n';

    // Generate resource for each page (SCO type)
    this.pages.forEach((page) => {
      const pageFile = pageFiles[page.id] || {};
      xml += this.generatePageResource(page, pageFile);
    });

    // Generate COMMON_FILES resource (asset type)
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

    // SCORM 2004 uses adlcp:scormType (capital T) instead of adlcp:scormtype
    let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormType="sco" href="${this.escapeXml(fileUrl)}">\n`;

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
    let xml = '    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormType="asset">\n';

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
  module.exports = Scorm2004ManifestGenerator;
} else {
  window.Scorm2004ManifestGenerator = Scorm2004ManifestGenerator;
}

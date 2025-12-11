/**
 * LomMetadataGenerator
 * Generates imslrm.xml (Learning Object Metadata) for SCORM packages.
 *
 * LOM structure follows IEEE LOM standard with LOM-ES extensions:
 * - lom
 *   - general (identifier, title, language, description, aggregationLevel)
 *   - lifeCycle (contribute with role, entity, date)
 *   - metaMetadata (contribute, metadataSchema, language)
 *   - technical (otherPlatformRequirements)
 *   - educational (language)
 *   - rights (copyrightAndOtherRestrictions, access)
 */
class LomMetadataGenerator {
  /**
   * @param {string} projectId - Unique project identifier
   * @param {Object} metadata - Project metadata
   */
  constructor(projectId, metadata) {
    this.projectId = projectId || this.generateId();
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
   * Generate complete imslrm.xml content
   * @returns {string}
   */
  generate() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += this.generateLomOpen();
    xml += this.generateGeneral();
    xml += this.generateLifeCycle();
    xml += this.generateMetaMetadata();
    xml += this.generateTechnical();
    xml += this.generateEducational();
    xml += this.generateRights();
    xml += '</lom>\n';

    return xml;
  }

  /**
   * Generate lom opening tag with namespaces
   * @returns {string}
   */
  generateLomOpen() {
    return `<lom xmlns="http://ltsc.ieee.org/xsd/LOM"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://ltsc.ieee.org/xsd/LOM lomCustom.xsd">
`;
  }

  /**
   * Generate general section
   * @returns {string}
   */
  generateGeneral() {
    const title = this.metadata.title || 'eXe-p-' + this.projectId;
    const lang = this.metadata.language || 'en';
    const description = this.metadata.description || '';
    const catalogName = this.metadata.catalogName || 'none';
    const catalogEntry = this.metadata.catalogEntry || 'ODE-' + this.projectId;

    let xml = '  <general uniqueElementName="general">\n';

    // Identifier
    xml += '    <identifier>\n';
    xml += `      <catalog uniqueElementName="catalog">${this.escapeXml(catalogName)}</catalog>\n`;
    xml += `      <entry uniqueElementName="entry">${this.escapeXml(catalogEntry)}</entry>\n`;
    xml += '    </identifier>\n';

    // Title
    xml += '    <title>\n';
    xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(title)}</string>\n`;
    xml += '    </title>\n';

    // Language
    xml += `    <language>${this.escapeXml(lang)}</language>\n`;

    // Description
    xml += '    <description>\n';
    xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(description)}</string>\n`;
    xml += '    </description>\n';

    // Aggregation Level
    xml += '    <aggregationLevel uniqueElementName="aggregationLevel">\n';
    xml += '      <source uniqueElementName="source">LOM-ESv1.0</source>\n';
    xml += '      <value uniqueElementName="value">2</value>\n';
    xml += '    </aggregationLevel>\n';

    xml += '  </general>\n';
    return xml;
  }

  /**
   * Generate lifeCycle section
   * @returns {string}
   */
  generateLifeCycle() {
    const author = this.metadata.author || '';
    const lang = this.metadata.language || 'en';
    const dateTime = this.getCurrentDateTime();

    let xml = '  <lifeCycle>\n';
    xml += '    <contribute>\n';

    // Role
    xml += '      <role uniqueElementName="role">\n';
    xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
    xml += '        <value uniqueElementName="value">author</value>\n';
    xml += '      </role>\n';

    // Entity (vCard format)
    const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
    xml += `      <entity>${this.escapeXml(vcard)}</entity>\n`;

    // Date
    xml += '      <date>\n';
    xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>\n`;
    xml += '        <description>\n';
    xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString('Metadata creation date', lang)}</string>\n`;
    xml += '        </description>\n';
    xml += '      </date>\n';

    xml += '    </contribute>\n';
    xml += '  </lifeCycle>\n';
    return xml;
  }

  /**
   * Generate metaMetadata section
   * @returns {string}
   */
  generateMetaMetadata() {
    const author = this.metadata.author || '';
    const lang = this.metadata.language || 'en';
    const dateTime = this.getCurrentDateTime();

    let xml = '  <metaMetadata uniqueElementName="metaMetadata">\n';
    xml += '    <contribute>\n';

    // Role
    xml += '      <role uniqueElementName="role">\n';
    xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
    xml += '        <value uniqueElementName="value">creator</value>\n';
    xml += '      </role>\n';

    // Entity (vCard format)
    const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
    xml += `      <entity>${this.escapeXml(vcard)}</entity>\n`;

    // Date
    xml += '      <date>\n';
    xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>\n`;
    xml += '        <description>\n';
    xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString('Metadata creation date', lang)}</string>\n`;
    xml += '        </description>\n';
    xml += '      </date>\n';

    xml += '    </contribute>\n';

    // Metadata Schema
    xml += '    <metadataSchema>LOM-ESv1.0</metadataSchema>\n';
    xml += `    <language>${this.escapeXml(lang)}</language>\n`;

    xml += '  </metaMetadata>\n';
    return xml;
  }

  /**
   * Generate technical section
   * @returns {string}
   */
  generateTechnical() {
    const lang = this.metadata.language || 'en';

    let xml = '  <technical uniqueElementName="technical">\n';
    xml += '    <otherPlatformRequirements>\n';
    xml += `      <string language="${this.escapeXml(lang)}">editor: eXe Learning</string>\n`;
    xml += '    </otherPlatformRequirements>\n';
    xml += '  </technical>\n';
    return xml;
  }

  /**
   * Generate educational section
   * @returns {string}
   */
  generateEducational() {
    const lang = this.metadata.language || 'en';

    let xml = '  <educational>\n';
    xml += `    <language>${this.escapeXml(lang)}</language>\n`;
    xml += '  </educational>\n';
    return xml;
  }

  /**
   * Generate rights section
   * @returns {string}
   */
  generateRights() {
    const license = this.metadata.license || '';

    let xml = '  <rights uniqueElementName="rights">\n';

    // Copyright and other restrictions
    xml += '    <copyrightAndOtherRestrictions uniqueElementName="copyrightAndOtherRestrictions">\n';
    xml += '      <source uniqueElementName="source">LOM-ESv1.0</source>\n';
    xml += `      <value uniqueElementName="value">${this.escapeXml(license)}</value>\n`;
    xml += '    </copyrightAndOtherRestrictions>\n';

    // Access
    xml += '    <access uniqueElementName="access">\n';
    xml += '      <accessType uniqueElementName="accessType">\n';
    xml += '        <source uniqueElementName="source">LOM-ESv1.0</source>\n';
    xml += '        <value uniqueElementName="value">universal</value>\n';
    xml += '      </accessType>\n';
    xml += '      <description>\n';
    xml += '        <string language="en">Default</string>\n';
    xml += '      </description>\n';
    xml += '    </access>\n';

    xml += '  </rights>\n';
    return xml;
  }

  /**
   * Get current date/time in ISO format
   * @returns {string}
   */
  getCurrentDateTime() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offset / 60))
      .toString()
      .padStart(2, '0');
    const offsetMinutes = Math.abs(offset % 60)
      .toString()
      .padStart(2, '0');
    const offsetSign = offset <= 0 ? '+' : '-';

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.00${offsetSign}${offsetHours}:${offsetMinutes}`;
  }

  /**
   * Get localized string (basic implementation)
   * @param {string} key - Translation key
   * @param {string} lang - Language code
   * @returns {string}
   */
  getLocalizedString(key, lang) {
    const translations = {
      'Metadata creation date': {
        en: 'Metadata creation date',
        es: 'Fecha de creaci\u00f3n de los metadatos',
        fr: 'Date de cr\u00e9ation des m\u00e9tadonn\u00e9es',
        de: 'Erstellungsdatum der Metadaten',
        pt: 'Data de cria\u00e7\u00e3o dos metadados',
        ca: 'Data de creaci\u00f3 de les metadades',
        eu: 'Metadatuen sorrera data',
        gl: 'Data de creaci\u00f3n dos metadatos',
      },
    };

    const langShort = lang.substring(0, 2).toLowerCase();
    if (translations[key] && translations[key][langShort]) {
      return translations[key][langShort];
    }
    return translations[key]?.en || key;
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
  module.exports = LomMetadataGenerator;
} else {
  window.LomMetadataGenerator = LomMetadataGenerator;
}

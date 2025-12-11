/**
 * Scorm2004ManifestGenerator
 *
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
 *
 * This is a TypeScript port of public/app/yjs/exporters/generators/Scorm2004ManifestGenerator.js
 */

import type { ExportPage, ScormManifestOptions } from '../interfaces';
import { SCORM_2004_NAMESPACES } from '../constants';

/**
 * Page file info for resource generation
 */
export interface PageFileInfo {
    fileUrl?: string;
    files?: string[];
}

/**
 * Options for manifest generation
 */
export interface Scorm2004GenerateOptions {
    /** List of common files to include */
    commonFiles?: string[];
    /** Map of pageId to file info */
    pageFiles?: Record<string, PageFileInfo>;
}

/**
 * Scorm2004ManifestGenerator class
 * Generates imsmanifest.xml for SCORM 2004 packages
 */
export class Scorm2004ManifestGenerator {
    private projectId: string;
    private pages: ExportPage[];
    private metadata: ScormManifestOptions;

    /**
     * @param projectId - Unique project identifier
     * @param pages - Pages from navigation structure
     * @param metadata - Project metadata
     */
    constructor(projectId: string, pages: ExportPage[], metadata: ScormManifestOptions = {}) {
        this.projectId = projectId || this.generateId();
        this.pages = pages || [];
        this.metadata = metadata;
    }

    /**
     * Generate a unique ID for the project
     * @returns Unique ID string
     */
    generateId(): string {
        return 'exe-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    }

    /**
     * Generate complete imsmanifest.xml content
     * @param options - Generation options
     * @returns Complete XML string
     */
    generate(options: Scorm2004GenerateOptions = {}): string {
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
     * @returns Manifest opening XML
     */
    generateManifestOpen(): string {
        return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_2004_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_2004_NAMESPACES.adlcp}"
  xmlns:adlseq="${SCORM_2004_NAMESPACES.adlseq}"
  xmlns:adlnav="${SCORM_2004_NAMESPACES.adlnav}"
  xmlns:imsss="${SCORM_2004_NAMESPACES.imsss}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCORM_2004_NAMESPACES.imscp} imscp_v1p1.xsd
    ${SCORM_2004_NAMESPACES.adlcp} adlcp_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlseq} adlseq_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlnav} adlnav_v1p3.xsd
    ${SCORM_2004_NAMESPACES.imsss} imsss_v1p0.xsd">
`;
    }

    /**
     * Generate metadata section
     * @returns Metadata XML
     */
    generateMetadata(): string {
        let xml = '  <metadata>\n';
        xml += '    <schema>ADL SCORM</schema>\n';
        xml += '    <schemaversion>2004 4th Edition</schemaversion>\n';
        xml += '    <adlcp:location>imslrm.xml</adlcp:location>\n';
        xml += '  </metadata>\n';
        return xml;
    }

    /**
     * Generate organizations section with sequencing
     * @returns Organizations XML
     */
    generateOrganizations(): string {
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
     * @returns Sequencing XML
     */
    generateOrganizationSequencing(): string {
        return `      <imsss:sequencing>
        <imsss:controlMode choice="true" choiceExit="true" flow="true" forwardOnly="false"/>
      </imsss:sequencing>
`;
    }

    /**
     * Generate item elements for pages in hierarchical structure
     * @returns Items XML
     */
    generateItems(): string {
        // Build a map of pages by ID for quick lookup
        const pageMap = new Map<string, ExportPage>();
        for (const page of this.pages) {
            pageMap.set(page.id, page);
        }

        // Find root pages (no parent)
        const rootPages = this.pages.filter(p => !p.parentId);

        // Generate items recursively
        let xml = '';
        for (const page of rootPages) {
            xml += this.generateItemRecursive(page, pageMap, 3);
        }

        return xml;
    }

    /**
     * Generate item element recursively for nested pages
     * @param page - Page object
     * @param pageMap - Map of all pages by ID
     * @param indent - Indentation level
     * @returns Item XML
     */
    generateItemRecursive(page: ExportPage, pageMap: Map<string, ExportPage>, indent: number): string {
        const indentStr = '  '.repeat(indent);
        const isVisible = 'true'; // Default visibility
        const children = this.pages.filter(p => p.parentId === page.id);
        const hasChildren = children.length > 0;

        let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">\n`;
        xml += `${indentStr}  <title>${this.escapeXml(page.title || 'Page')}</title>\n`;

        // Generate children
        for (const child of children) {
            xml += this.generateItemRecursive(child, pageMap, indent + 1);
        }

        // Add sequencing for items with children (clusters)
        if (hasChildren) {
            xml += this.generateItemSequencing(indentStr + '  ');
        }

        xml += `${indentStr}</item>\n`;
        return xml;
    }

    /**
     * Generate sequencing rules for a parent item (cluster)
     * @param indentStr - Indentation string
     * @returns Sequencing XML
     */
    generateItemSequencing(indentStr: string): string {
        return `${indentStr}<imsss:sequencing>
${indentStr}  <imsss:controlMode choice="true" choiceExit="true" flow="true"/>
${indentStr}</imsss:sequencing>
`;
    }

    /**
     * Generate resources section
     * @param commonFiles - List of common file paths
     * @param pageFiles - Map of pageId to file info
     * @returns Resources XML
     */
    generateResources(commonFiles: string[], pageFiles: Record<string, PageFileInfo>): string {
        let xml = '  <resources>\n';

        // Generate resource for each page (SCO type)
        for (const page of this.pages) {
            const pageFile = pageFiles[page.id] || {};
            xml += this.generatePageResource(page, pageFile);
        }

        // Generate COMMON_FILES resource (asset type)
        xml += this.generateCommonFilesResource(commonFiles);

        xml += '  </resources>\n';
        return xml;
    }

    /**
     * Generate resource element for a page
     * @param page - Page object
     * @param pageFile - Page file info
     * @returns Resource XML
     */
    generatePageResource(page: ExportPage, pageFile: PageFileInfo): string {
        const pageId = page.id;
        const isIndex = this.pages.indexOf(page) === 0;
        const fileUrl = pageFile.fileUrl || (isIndex ? 'index.html' : `html/${this.sanitizeFilename(page.title)}.html`);

        // SCORM 2004 uses adlcp:scormType (capital T) instead of adlcp:scormtype
        let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormType="sco" href="${this.escapeXml(fileUrl)}">\n`;

        // Add the main HTML file
        xml += `      <file href="${this.escapeXml(fileUrl)}"/>\n`;

        // Add resource files if available
        const files = pageFile.files || [];
        for (const file of files) {
            xml += `      <file href="${this.escapeXml(file)}"/>\n`;
        }

        // Add dependency on COMMON_FILES
        xml += '      <dependency identifierref="COMMON_FILES"/>\n';
        xml += '    </resource>\n';

        return xml;
    }

    /**
     * Generate COMMON_FILES resource for shared assets
     * @param commonFiles - List of common file paths
     * @returns Resource XML
     */
    generateCommonFilesResource(commonFiles: string[]): string {
        let xml = '    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormType="asset">\n';

        // Add all common files
        for (const file of commonFiles) {
            xml += `      <file href="${this.escapeXml(file)}"/>\n`;
        }

        xml += '    </resource>\n';
        return xml;
    }

    /**
     * Escape XML special characters
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeXml(str: string): string {
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
     * @param title - Title to sanitize
     * @returns Sanitized filename
     */
    sanitizeFilename(title: string): string {
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

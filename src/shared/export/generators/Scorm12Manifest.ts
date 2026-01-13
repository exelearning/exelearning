/**
 * Scorm12ManifestGenerator
 *
 * Generates imsmanifest.xml for SCORM 1.2 packages.
 *
 * SCORM 1.2 manifest structure:
 * - manifest (xmlns imscp_rootv1p1p2, adlcp_rootv1p2, imsmd_v1p2)
 *   - metadata (schema, schemaversion, adlcp:location)
 *   - organizations (default)
 *     - organization (identifier, structure=hierarchical)
 *       - title
 *       - item (identifier, identifierref, isvisible)
 *   - resources
 *     - resource (identifier, type=webcontent, adlcp:scormtype=sco, href)
 *       - file (href)
 *       - dependency (identifierref)
 *     - resource (identifier=COMMON_FILES, adlcp:scormtype=asset)
 *
 * This is a TypeScript port of public/app/yjs/exporters/generators/Scorm12ManifestGenerator.js
 */

import type { ExportPage, ScormManifestOptions } from '../interfaces';
import { SCORM_12_NAMESPACES } from '../constants';

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
export interface Scorm12GenerateOptions {
    /** List of common files to include (legacy, used if allZipFiles not provided) */
    commonFiles?: string[];
    /** Map of pageId to file info */
    pageFiles?: Record<string, PageFileInfo>;
    /**
     * Complete list of all files in the ZIP archive.
     * When provided, the generator will automatically categorize files:
     * - Page HTML files go in their respective page resources
     * - All other files go in COMMON_FILES
     * This ensures the manifest contains ALL files in the export.
     */
    allZipFiles?: string[];
}

/**
 * Scorm12ManifestGenerator class
 * Generates imsmanifest.xml for SCORM 1.2 packages
 */
export class Scorm12ManifestGenerator {
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
    generate(options: Scorm12GenerateOptions = {}): string {
        const { commonFiles = [], pageFiles = {}, allZipFiles } = options;

        // If allZipFiles is provided, use it to build complete file lists
        let effectiveCommonFiles = commonFiles;
        if (allZipFiles && allZipFiles.length > 0) {
            effectiveCommonFiles = this.categorizeFilesForCommon(allZipFiles, pageFiles);
        }

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += this.generateManifestOpen();
        xml += this.generateMetadata();
        xml += this.generateOrganizations();
        xml += this.generateResources(effectiveCommonFiles, pageFiles);
        xml += '</manifest>\n';

        return xml;
    }

    /**
     * Categorize files into COMMON_FILES based on complete ZIP file list.
     * All files except page HTML files and imsmanifest.xml go into COMMON_FILES.
     * @param allFiles - Complete list of files in the ZIP
     * @param pageFiles - Map of page file info (to identify page HTML files)
     * @returns List of files for COMMON_FILES resource
     */
    protected categorizeFilesForCommon(allFiles: string[], pageFiles: Record<string, PageFileInfo>): string[] {
        // Build set of page HTML files
        const pageHtmlFiles = new Set<string>();
        for (const page of this.pages) {
            const pageFile = pageFiles[page.id];
            if (pageFile?.fileUrl) {
                pageHtmlFiles.add(pageFile.fileUrl);
            } else {
                // Default file URL
                const isIndex = this.pages.indexOf(page) === 0;
                const defaultUrl = isIndex ? 'index.html' : `html/${this.sanitizeFilename(page.title)}.html`;
                pageHtmlFiles.add(defaultUrl);
            }
        }

        // Files that should be excluded from COMMON_FILES:
        // - Page HTML files (they go in their own resource)
        // - imsmanifest.xml (it's the manifest itself)
        // Note: imslrm.xml IS included in COMMON_FILES (it's a valid resource file
        // referenced by adlcp:location in metadata)
        const excludedFiles = new Set([...pageHtmlFiles, 'imsmanifest.xml']);

        // All other files go to COMMON_FILES
        return allFiles.filter(file => !excludedFiles.has(file)).sort();
    }

    /**
     * Generate manifest opening tag with namespaces
     * @returns Manifest opening XML
     */
    generateManifestOpen(): string {
        return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_12_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_12_NAMESPACES.adlcp}"
  xmlns:imsmd="${SCORM_12_NAMESPACES.imsmd}">
`;
    }

    /**
     * Generate metadata section
     * @returns Metadata XML
     */
    generateMetadata(): string {
        let xml = '  <metadata>\n';
        xml += '    <schema>ADL SCORM</schema>\n';
        xml += '    <schemaversion>1.2</schemaversion>\n';
        xml += '    <adlcp:location>imslrm.xml</adlcp:location>\n';
        xml += '  </metadata>\n';
        return xml;
    }

    /**
     * Generate organizations section with hierarchical structure
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

        xml += '    </organization>\n';
        xml += '  </organizations>\n';
        return xml;
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

        let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">\n`;
        xml += `${indentStr}  <title>${this.escapeXml(page.title || 'Page')}</title>\n`;

        // Find children
        const children = this.pages.filter(p => p.parentId === page.id);
        for (const child of children) {
            xml += this.generateItemRecursive(child, pageMap, indent + 1);
        }

        xml += `${indentStr}</item>\n`;
        return xml;
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

        let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormtype="sco" href="${this.escapeXml(fileUrl)}">\n`;

        // Add the main HTML file
        xml += `      <file href="${this.escapeXml(fileUrl)}"/>\n`;

        // Add iDevice resource files if available
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
        let xml = '    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormtype="asset">\n';

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

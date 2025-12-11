import { Injectable } from '@nestjs/common';
import {
    ExportContext,
    IManifestBuilder,
    ManifestMetadata,
} from '../../interfaces/export-strategy.interface';
import { SCORM12 } from '../../constants/export.constants';
import { NormalizedPage } from '../../../xml/interfaces/ode-xml.interface';

/**
 * SCORM 1.2 manifest builder
 * Generates imsmanifest.xml for SCORM 1.2 packages
 */
@Injectable()
export class Scorm12ManifestBuilder implements IManifestBuilder {
    /**
     * Generate SCORM 1.2 manifest XML
     */
    async generateManifest(context: ExportContext): Promise<string> {
        const manifestId = this.generateId('eXe-MANIFEST-');
        const orgId = this.generateId('eXe-');
        const metadata = this.extractMetadata(context);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<manifest identifier="${manifestId}" `;
        xml += `xmlns="${SCORM12.NAMESPACES.DEFAULT}" `;
        xml += `xmlns:adlcp="${SCORM12.NAMESPACES.ADLCP}" `;
        xml += `xmlns:imsmd="${SCORM12.NAMESPACES.IMS}" `;
        xml += `xmlns:xsi="${SCORM12.NAMESPACES.XSI}" `;
        xml += `xsi:schemaLocation="${SCORM12.SCHEMA_LOCATION}">`;

        // Metadata section
        xml += this.generateMetadataSection();

        // Organizations section
        xml += this.generateOrganizationsSection(context, orgId);

        // Resources section
        xml += this.generateResourcesSection(context);

        xml += '</manifest>\n';

        return xml;
    }

    /**
     * Get manifest filename
     */
    getManifestFilename(): string {
        return SCORM12.MANIFEST_FILE;
    }

    /**
     * Generate LOM metadata XML (imslrm.xml)
     */
    async generateLomMetadata(context: ExportContext): Promise<string> {
        const metadata = this.extractMetadata(context);

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<lom xmlns="http://www.imsglobal.org/xsd/imsmd_v1p2" `;
        xml += `xmlns:xsi="${SCORM12.NAMESPACES.XSI}">\n`;

        // General section
        xml += '  <general>\n';
        xml += `    <title><langstring xml:lang="${metadata.language || 'en'}">${this.escapeXml(metadata.title)}</langstring></title>\n`;
        if (metadata.description) {
            xml += `    <description><langstring xml:lang="${metadata.language || 'en'}">${this.escapeXml(metadata.description)}</langstring></description>\n`;
        }
        if (metadata.keywords && metadata.keywords.length > 0) {
            xml += '    <keyword>\n';
            for (const kw of metadata.keywords) {
                xml += `      <langstring xml:lang="${metadata.language || 'en'}">${this.escapeXml(kw)}</langstring>\n`;
            }
            xml += '    </keyword>\n';
        }
        xml += '  </general>\n';

        // Lifecycle section
        xml += '  <lifecycle>\n';
        if (metadata.author) {
            xml += '    <contribute>\n';
            xml += '      <role><value>Author</value></role>\n';
            xml += `      <centity><vcard>BEGIN:VCARD\\nFN:${this.escapeXml(metadata.author)}\\nEND:VCARD</vcard></centity>\n`;
            xml += '    </contribute>\n';
        }
        xml += '  </lifecycle>\n';

        // Technical section
        xml += '  <technical>\n';
        xml += '    <format>text/html</format>\n';
        xml += '  </technical>\n';

        // Rights section
        if (metadata.rights) {
            xml += '  <rights>\n';
            xml += `    <description><langstring xml:lang="${metadata.language || 'en'}">${this.escapeXml(metadata.rights)}</langstring></description>\n`;
            xml += '  </rights>\n';
        }

        xml += '</lom>\n';

        return xml;
    }

    /**
     * Generate metadata section of manifest
     */
    private generateMetadataSection(): string {
        return `<metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion><adlcp:location>${SCORM12.LOM_FILE}</adlcp:location></metadata>`;
    }

    /**
     * Generate organizations section
     */
    private generateOrganizationsSection(
        context: ExportContext,
        orgId: string,
    ): string {
        const title = context.structure.meta.title || 'eXeLearning Content';
        const pages = context.structure.pages;

        let xml = `<organizations default="${orgId}">`;
        xml += `<organization identifier="${orgId}" structure="hierarchical">`;
        xml += `<title>${this.escapeXml(title)}</title>`;

        // Generate items for root pages
        const rootPages = pages.filter((p) => p.parent_id === null);
        for (const page of rootPages) {
            xml += this.generateOrganizationItem(page, pages);
        }

        xml += '</organization>';
        xml += '</organizations>';

        return xml;
    }

    /**
     * Generate organization item (recursive for children)
     */
    private generateOrganizationItem(
        page: NormalizedPage,
        allPages: NormalizedPage[],
    ): string {
        const itemId = this.generateId('ITEM-');
        const resId = this.generateResourceId(page.id);

        let xml = `<item identifier="${itemId}" identifierref="${resId}" isvisible="true">`;
        xml += `<title>${this.escapeXml(page.title)}</title>`;

        // Child pages
        const children = allPages.filter((p) => p.parent_id === page.id);
        for (const child of children) {
            xml += this.generateOrganizationItem(child, allPages);
        }

        xml += '</item>';
        return xml;
    }

    /**
     * Generate resources section
     */
    private generateResourcesSection(context: ExportContext): string {
        const pages = context.structure.pages;
        let xml = '<resources>';

        // Generate resource for each page
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const resId = this.generateResourceId(page.id);
            const href = i === 0 ? 'index.html' : `html/${this.sanitizeFilename(page.title)}.html`;

            xml += `<resource identifier="${resId}" type="${SCORM12.RESOURCE_TYPE}" adlcp:scormtype="${SCORM12.SCO_TYPE}" href="${href}">`;
            xml += `<file href="${href}"/>`;

            // Add dependency on common files
            xml += `<dependency identifierref="${SCORM12.COMMON_FILES_ID}"/>`;
            xml += '</resource>';
        }

        // Generate COMMON_FILES resource
        xml += this.generateCommonFilesResource();

        xml += '</resources>';
        return xml;
    }

    /**
     * Generate common files resource
     */
    private generateCommonFilesResource(): string {
        let xml = `<resource identifier="${SCORM12.COMMON_FILES_ID}" type="${SCORM12.RESOURCE_TYPE}" adlcp:scormtype="asset">`;

        // Common JavaScript files
        const commonFiles = [
            'libs/jquery/jquery.min.js',
            'libs/SCORM_API_wrapper.js',
            'libs/SCOFunctions.js',
            'libs/common.js',
            'libs/common_i18n.js',
            'libs/exe_export.js',
            'libs/bootstrap/bootstrap.bundle.min.js',
            'libs/bootstrap/bootstrap.min.css',
            'content/css/base.css',
            'theme/content.css',
            'theme/default.js',
        ];

        for (const file of commonFiles) {
            xml += `<file href="${file}"/>`;
        }

        // Schema files
        const schemaFiles = [
            'adlcp_rootv1p2.xsd',
            'imscp_rootv1p1p2.xsd',
            'imsmd_rootv1p2p1.xsd',
            'ims_xml.xsd',
        ];

        for (const file of schemaFiles) {
            xml += `<file href="${file}"/>`;
        }

        // Manifest files
        xml += `<file href="content.xml"/>`;
        xml += `<file href="${SCORM12.LOM_FILE}"/>`;

        xml += '</resource>';
        return xml;
    }

    /**
     * Extract metadata from context
     */
    private extractMetadata(context: ExportContext): ManifestMetadata {
        const meta = context.structure.meta;

        return {
            title: meta.title || 'eXeLearning Content',
            description: meta.description,
            author: meta.author,
            language: meta.language || 'en',
            keywords: meta.keywords?.split(',').map((k) => k.trim()),
            rights: meta.license,
            exeVersion: meta.exelearning_version,
        };
    }

    /**
     * Generate unique ID with prefix
     */
    private generateId(prefix: string): string {
        const timestamp = new Date()
            .toISOString()
            .replace(/[-:T.Z]/g, '')
            .substring(0, 14);
        const random = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }

    /**
     * Generate resource ID from page ID
     */
    private generateResourceId(pageId: string): string {
        return `RES-${pageId.toUpperCase()}`;
    }

    /**
     * Sanitize string for filename
     */
    private sanitizeFilename(str: string): string {
        return str
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    }

    /**
     * Escape XML special characters
     */
    private escapeXml(str: string): string {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

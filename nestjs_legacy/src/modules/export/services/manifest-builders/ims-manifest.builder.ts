import { Injectable } from '@nestjs/common';
import {
    ExportContext,
    IManifestBuilder,
    ManifestMetadata,
} from '../../interfaces/export-strategy.interface';
import { IMS } from '../../constants/export.constants';
import { NormalizedPage } from '../../../xml/interfaces/ode-xml.interface';

/**
 * IMS Content Package manifest builder
 * Generates imsmanifest.xml for IMS CP packages (without SCORM tracking)
 */
@Injectable()
export class ImsManifestBuilder implements IManifestBuilder {
    /**
     * Generate IMS Content Package manifest XML
     */
    async generateManifest(context: ExportContext): Promise<string> {
        const manifestId = this.generateId('eXe-MANIFEST-');
        const orgId = this.generateId('eXe-');

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<manifest identifier="${manifestId}" `;
        xml += `xmlns="${IMS.NAMESPACES.DEFAULT}" `;
        xml += `xmlns:imsmd="${IMS.NAMESPACES.IMS}" `;
        xml += `xmlns:xsi="${IMS.NAMESPACES.XSI}" `;
        xml += `xsi:schemaLocation="${IMS.SCHEMA_LOCATION}">`;

        // Metadata section with inline LOM
        xml += this.generateMetadataSection(context);

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
        return IMS.MANIFEST_FILE;
    }

    /**
     * Generate metadata section with inline LOM
     */
    private generateMetadataSection(context: ExportContext): string {
        const metadata = this.extractMetadata(context);

        let xml = '<metadata>';
        xml += '<schema>IMS Content</schema>';
        xml += '<schemaversion>1.1.3</schemaversion>';

        // Inline LOM metadata
        xml += '<imsmd:lom>';
        xml += '<imsmd:general>';
        xml += `<imsmd:title><imsmd:langstring xml:lang="${metadata.language}">${this.escapeXml(metadata.title)}</imsmd:langstring></imsmd:title>`;

        if (metadata.description) {
            xml += `<imsmd:description><imsmd:langstring xml:lang="${metadata.language}">${this.escapeXml(metadata.description)}</imsmd:langstring></imsmd:description>`;
        }

        if (metadata.keywords && metadata.keywords.length > 0) {
            for (const kw of metadata.keywords) {
                xml += `<imsmd:keyword><imsmd:langstring xml:lang="${metadata.language}">${this.escapeXml(kw)}</imsmd:langstring></imsmd:keyword>`;
            }
        }

        xml += '</imsmd:general>';

        // Lifecycle
        if (metadata.author) {
            xml += '<imsmd:lifecycle>';
            xml += '<imsmd:contribute>';
            xml += '<imsmd:role><imsmd:value>Author</imsmd:value></imsmd:role>';
            xml += `<imsmd:centity><imsmd:vcard>BEGIN:VCARD\\nFN:${this.escapeXml(metadata.author)}\\nEND:VCARD</imsmd:vcard></imsmd:centity>`;
            xml += '</imsmd:contribute>';
            xml += '</imsmd:lifecycle>';
        }

        // Technical
        xml += '<imsmd:technical>';
        xml += '<imsmd:format>text/html</imsmd:format>';
        xml += '</imsmd:technical>';

        // Rights
        if (metadata.rights) {
            xml += '<imsmd:rights>';
            xml += `<imsmd:description><imsmd:langstring xml:lang="${metadata.language}">${this.escapeXml(metadata.rights)}</imsmd:langstring></imsmd:description>`;
            xml += '</imsmd:rights>';
        }

        xml += '</imsmd:lom>';
        xml += '</metadata>';

        return xml;
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
     * Generate organization item
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
     * Generate resources section (without SCORM attributes)
     */
    private generateResourcesSection(context: ExportContext): string {
        const pages = context.structure.pages;
        let xml = '<resources>';

        // Generate resource for each page
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const resId = this.generateResourceId(page.id);
            const href =
                i === 0
                    ? 'index.html'
                    : `html/${this.sanitizeFilename(page.title)}.html`;

            xml += `<resource identifier="${resId}" type="${IMS.RESOURCE_TYPE}" href="${href}">`;
            xml += `<file href="${href}"/>`;
            xml += `<dependency identifierref="COMMON_FILES"/>`;
            xml += '</resource>';
        }

        // Generate COMMON_FILES resource (without SCORM JS)
        xml += this.generateCommonFilesResource();

        xml += '</resources>';
        return xml;
    }

    /**
     * Generate common files resource (without SCORM JavaScript)
     */
    private generateCommonFilesResource(): string {
        let xml = `<resource identifier="COMMON_FILES" type="${IMS.RESOURCE_TYPE}">`;

        // Common files (no SCORM JS)
        const commonFiles = [
            'libs/jquery/jquery.min.js',
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

        // IMS schema files
        const schemaFiles = [
            'imscp_rootv1p1p2.xsd',
            'imsmd_rootv1p2p1.xsd',
            'ims_xml.xsd',
        ];

        for (const file of schemaFiles) {
            xml += `<file href="${file}"/>`;
        }

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
     * Generate unique ID
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

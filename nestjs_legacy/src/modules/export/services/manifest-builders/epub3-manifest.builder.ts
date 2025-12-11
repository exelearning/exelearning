import { Injectable } from '@nestjs/common';
import {
    ExportContext,
    IManifestBuilder,
    ManifestMetadata,
} from '../../interfaces/export-strategy.interface';
import { EPUB3 } from '../../constants/export.constants';
import { NormalizedPage } from '../../../xml/interfaces/ode-xml.interface';

/**
 * EPUB3 manifest builder
 * Generates package.opf, nav.xhtml, and container.xml for EPUB3 packages
 */
@Injectable()
export class Epub3ManifestBuilder implements IManifestBuilder {
    /**
     * Generate EPUB3 package.opf
     */
    async generateManifest(context: ExportContext): Promise<string> {
        const metadata = this.extractMetadata(context);
        const pubId = this.generateId('ODE-');
        const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

        let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
        xml += `<package version="${EPUB3.VERSION}" unique-identifier="pub-id" xmlns="${EPUB3.NAMESPACES.OPF}">`;

        // Metadata section
        xml += this.generateMetadataSection(metadata, pubId, modified);

        // Manifest section (items)
        xml += this.generateManifestSection(context);

        // Spine section (reading order)
        xml += this.generateSpineSection(context);

        xml += '</package>\n';

        return xml;
    }

    /**
     * Get manifest filename
     */
    getManifestFilename(): string {
        return 'package.opf';
    }

    /**
     * Generate container.xml for META-INF
     */
    generateContainerXml(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="${EPUB3.NAMESPACES.CONTAINER}">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
    }

    /**
     * Generate nav.xhtml (navigation document)
     */
    generateNavXhtml(context: ExportContext): string {
        const title = context.structure.meta.title || 'Table of Contents';
        const lang = context.structure.meta.language || 'en';
        const pages = context.structure.pages;

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<!DOCTYPE html>\n`;
        xml += `<html xmlns="${EPUB3.NAMESPACES.XHTML}" xmlns:epub="${EPUB3.NAMESPACES.EPUB}" lang="${lang}">\n`;
        xml += `<head>\n`;
        xml += `  <meta charset="UTF-8"/>\n`;
        xml += `  <title>${this.escapeXml(title)}</title>\n`;
        xml += `</head>\n`;
        xml += `<body>\n`;
        xml += `  <nav epub:type="toc" id="toc">\n`;
        xml += `    <h1>Table of Contents</h1>\n`;
        xml += `    <ol>\n`;

        // Generate navigation items
        const rootPages = pages.filter((p) => p.parent_id === null);
        for (const page of rootPages) {
            xml += this.generateNavItem(page, pages, 3);
        }

        xml += `    </ol>\n`;
        xml += `  </nav>\n`;
        xml += `</body>\n`;
        xml += `</html>\n`;

        return xml;
    }

    /**
     * Generate mimetype file content
     */
    getMimetypeContent(): string {
        return EPUB3.MIMETYPE;
    }

    /**
     * Generate metadata section
     */
    private generateMetadataSection(
        metadata: ManifestMetadata,
        pubId: string,
        modified: string,
    ): string {
        let xml = `<metadata xmlns:dc="${EPUB3.NAMESPACES.DC}">`;

        xml += `<dc:language>${metadata.language || 'en'}</dc:language>`;
        xml += `<dc:identifier id="pub-id">${pubId}</dc:identifier>`;
        xml += `<dc:title lang="${metadata.language}">${this.escapeXml(metadata.title)}</dc:title>`;

        if (metadata.description) {
            xml += `<dc:description lang="${metadata.language}">${this.escapeXml(metadata.description)}</dc:description>`;
        }

        if (metadata.author) {
            xml += `<dc:creator>${this.escapeXml(metadata.author)}</dc:creator>`;
        }

        if (metadata.rights) {
            xml += `<dc:license lang="${metadata.language}">${this.escapeXml(metadata.rights)}</dc:license>`;
        }

        xml += `<meta property="dcterms:modified">${modified}</meta>`;
        xml += `</metadata>`;

        return xml;
    }

    /**
     * Generate manifest section (items)
     */
    private generateManifestSection(context: ExportContext): string {
        const pages = context.structure.pages;
        let xml = '<manifest>';

        // Navigation document
        xml += `<item id="nav" href="nav.xhtml" properties="nav" media-type="${EPUB3.MEDIA_TYPES.XHTML}"/>`;

        // Page items
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            const pageId = `PAGE-${page.id.toUpperCase()}`;
            const href = i === 0 ? 'index.xhtml' : `html/${this.sanitizeFilename(page.title)}.xhtml`;

            xml += `<item id="${pageId}" href="${href}" media-type="${EPUB3.MEDIA_TYPES.XHTML}" properties="scripted"/>`;
        }

        // Common CSS
        xml += `<item id="base-css" href="content/css/base.css" media-type="${EPUB3.MEDIA_TYPES.CSS}"/>`;
        xml += `<item id="content-css" href="theme/content.css" media-type="${EPUB3.MEDIA_TYPES.CSS}"/>`;

        // Fallback item for non-core media types
        xml += `<item id="fallback" href="fallback.xhtml" media-type="${EPUB3.MEDIA_TYPES.XHTML}"/>`;

        xml += '</manifest>';
        return xml;
    }

    /**
     * Generate spine section (reading order)
     */
    private generateSpineSection(context: ExportContext): string {
        const pages = context.structure.pages;
        let xml = '<spine>';

        for (const page of pages) {
            const pageId = `PAGE-${page.id.toUpperCase()}`;
            xml += `<itemref idref="${pageId}"/>`;
        }

        xml += '</spine>';
        return xml;
    }

    /**
     * Generate navigation item (recursive for children)
     */
    private generateNavItem(
        page: NormalizedPage,
        allPages: NormalizedPage[],
        indent: number,
    ): string {
        const spaces = ' '.repeat(indent * 2);
        const href =
            page === allPages[0]
                ? 'index.xhtml'
                : `html/${this.sanitizeFilename(page.title)}.xhtml`;

        let xml = `${spaces}<li>\n`;
        xml += `${spaces}  <a href="${href}">${this.escapeXml(page.title)}</a>\n`;

        // Child pages
        const children = allPages.filter((p) => p.parent_id === page.id);
        if (children.length > 0) {
            xml += `${spaces}  <ol>\n`;
            for (const child of children) {
                xml += this.generateNavItem(child, allPages, indent + 2);
            }
            xml += `${spaces}  </ol>\n`;
        }

        xml += `${spaces}</li>\n`;
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

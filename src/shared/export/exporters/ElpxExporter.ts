/**
 * ElpxExporter
 *
 * Exports a document to ELPX (eXeLearning Project) format.
 * Generates a ZIP archive containing the ODE XML structure and all assets.
 *
 * ELPX files are the native project format for eXeLearning 4.x and contain:
 * - content.xml (ODE format with full project structure)
 * - idevices/ (iDevice-specific CSS/JS/templates)
 * - libs/ (shared JavaScript libraries)
 * - content/resources/ (project assets: images, media, etc.)
 *
 * The ODE XML format is a hierarchical structure:
 * - odeProperties (metadata)
 * - odeResources (version info, identifiers)
 * - odeNavStructures (pages)
 *   - odePagStructures (blocks)
 *     - odeComponents (iDevices)
 */

import type {
    ExportDocument,
    ExportPage,
    ExportBlock,
    ExportComponent,
    ExportMetadata,
    ResourceProvider,
    AssetProvider,
    ZipProvider,
    ExportOptions,
    ExportResult,
    ElpxExportOptions,
} from '../interfaces';
import { BaseExporter } from './BaseExporter';

/**
 * ODE XML version identifier
 */
const ODE_VERSION = '4.0';

export class ElpxExporter extends BaseExporter {
    constructor(
        document: ExportDocument,
        resources: ResourceProvider,
        assets: AssetProvider,
        zip: ZipProvider
    ) {
        super(document, resources, assets, zip);
    }

    /**
     * Get file extension for ELPX format
     */
    getFileExtension(): string {
        return '.elpx';
    }

    /**
     * Get file suffix for ELPX format
     */
    getFileSuffix(): string {
        return '';
    }

    /**
     * Export to ELPX format
     */
    async export(options?: ExportOptions): Promise<ExportResult> {
        const exportFilename = options?.filename || this.buildFilename();
        const elpxOptions = options as ElpxExportOptions | undefined;

        try {
            let pages = this.buildPageList();
            const meta = this.getMetadata();
            // Theme priority: 1º parameter > 2º ELP metadata > 3º default
            const themeName = elpxOptions?.theme || meta.theme || 'base';

            // Pre-process pages: add filenames to asset URLs
            pages = await this.preprocessPagesForExport(pages);

            // 1. Generate content.xml (ODE format)
            const contentXml = this.generateOdeXml(meta, pages);
            this.zip.addFile('content.xml', contentXml);

            // 2. Fetch and add theme files
            try {
                const themeFiles = await this.resources.fetchTheme(themeName);
                for (const [path, content] of themeFiles) {
                    this.zip.addFile(`style/${themeName}/${path}`, content);
                }
            } catch {
                // Theme fetch failed - continue without theme
                console.warn(`[ElpxExporter] Failed to fetch theme: ${themeName}`);
            }

            // 3. Fetch and add iDevice resources
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [path, content] of ideviceFiles) {
                        this.zip.addFile(`idevices/${idevice}/${path}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files - this is normal
                }
            }

            // 4. Fetch and add base libraries
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [path, content] of baseLibs) {
                    this.zip.addFile(`libs/${path}`, content);
                }
            } catch {
                // Libraries fetch failed - continue without
            }

            // 5. Add project assets
            await this.addAssetsToZipWithResourcePath();

            // 6. Generate ZIP buffer
            const buffer = await this.zip.generateAsync();

            return {
                success: true,
                filename: exportFilename,
                data: buffer,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Generate complete ODE XML document
     */
    private generateOdeXml(meta: ExportMetadata, pages: ExportPage[]): string {
        const odeId = meta.odeIdentifier || this.generateOdeId();
        const versionId = this.generateOdeId();

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';

        // User preferences (theme selection)
        xml += this.generateUserPreferencesXml(meta);

        // ODE resources (version info, IDs)
        xml += this.generateOdeResourcesXml(odeId, versionId);

        // ODE properties (metadata)
        xml += this.generateOdePropertiesXml(meta);

        // Navigation structures (pages with blocks and components)
        xml += '<odeNavStructures>\n';
        for (let i = 0; i < pages.length; i++) {
            xml += this.generateOdeNavStructureXml(pages[i], i);
        }
        xml += '</odeNavStructures>\n';

        xml += '</ode>';
        return xml;
    }

    /**
     * Generate user preferences section
     */
    private generateUserPreferencesXml(meta: ExportMetadata): string {
        let xml = '<userPreferences>\n';

        xml += this.generateUserPreferenceEntry('theme', meta.theme || 'base');

        xml += '</userPreferences>\n';
        return xml;
    }

    /**
     * Generate single user preference entry
     */
    private generateUserPreferenceEntry(key: string, value: string): string {
        return `  <userPreference>
    <key>${this.escapeXml(key)}</key>
    <value>${this.escapeXml(value)}</value>
  </userPreference>\n`;
    }

    /**
     * Generate ODE resources section (identifiers, version)
     */
    private generateOdeResourcesXml(odeId: string, versionId: string): string {
        let xml = '<odeResources>\n';

        xml += this.generateOdeResourceEntry('odeId', odeId);
        xml += this.generateOdeResourceEntry('odeVersionId', versionId);
        xml += this.generateOdeResourceEntry('exe_version', ODE_VERSION);

        xml += '</odeResources>\n';
        return xml;
    }

    /**
     * Generate single ODE resource entry
     */
    private generateOdeResourceEntry(key: string, value: string): string {
        return `  <odeResource>
    <key>${this.escapeXml(key)}</key>
    <value>${this.escapeXml(value)}</value>
  </odeResource>\n`;
    }

    /**
     * Generate ODE properties section (metadata)
     */
    private generateOdePropertiesXml(meta: ExportMetadata): string {
        let xml = '<odeProperties>\n';

        // Core properties
        const properties: Record<string, string | boolean | undefined> = {
            pp_title: meta.title,
            pp_author: meta.author,
            pp_lang: meta.language,
            pp_description: meta.description,
            pp_license: meta.license,
            pp_theme: meta.theme,
            pp_keywords: meta.keywords,
            pp_category: meta.category,
            pp_addAccessibilityToolbar: meta.addAccessibilityToolbar,
            pp_customStyles: meta.customStyles,
        };

        for (const [key, value] of Object.entries(properties)) {
            if (value !== undefined && value !== null && value !== '') {
                const strValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
                xml += this.generateOdePropertyEntry(key, strValue);
            }
        }

        xml += '</odeProperties>\n';
        return xml;
    }

    /**
     * Generate single ODE property entry
     */
    private generateOdePropertyEntry(key: string, value: string): string {
        return `  <odeProperty>
    <key>${this.escapeXml(key)}</key>
    <value>${this.escapeXml(value)}</value>
  </odeProperty>\n`;
    }

    /**
     * Generate odeNavStructure for a page
     */
    private generateOdeNavStructureXml(page: ExportPage, order: number): string {
        const pageId = page.id;
        const parentId = page.parentId || '';

        let xml = `<odeNavStructure>\n`;
        xml += `  <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
        xml += `  <odeParentPageId>${this.escapeXml(parentId)}</odeParentPageId>\n`;
        xml += `  <pageName>${this.escapeXml(page.title || 'Page')}</pageName>\n`;
        xml += `  <odeNavStructureOrder>${page.order ?? order}</odeNavStructureOrder>\n`;

        // Page-level properties
        xml += '  <odeNavStructureProperties>\n';
        xml += this.generateNavStructurePropertyEntry('titlePage', page.title || '');
        if (page.properties) {
            for (const [key, value] of Object.entries(page.properties)) {
                if (value !== undefined && value !== null) {
                    xml += this.generateNavStructurePropertyEntry(key, String(value));
                }
            }
        }
        xml += '  </odeNavStructureProperties>\n';

        // Blocks (odePagStructures)
        xml += '  <odePagStructures>\n';
        for (let i = 0; i < (page.blocks || []).length; i++) {
            xml += this.generateOdePagStructureXml(page.blocks![i], pageId, i);
        }
        xml += '  </odePagStructures>\n';

        xml += '</odeNavStructure>\n';
        return xml;
    }

    /**
     * Generate navigation structure property entry
     */
    private generateNavStructurePropertyEntry(key: string, value: string): string {
        return `    <odeNavStructureProperty>
      <key>${this.escapeXml(key)}</key>
      <value>${this.escapeXml(value)}</value>
    </odeNavStructureProperty>\n`;
    }

    /**
     * Generate odePagStructure for a block
     */
    private generateOdePagStructureXml(block: ExportBlock, pageId: string, order: number): string {
        const blockId = block.id;

        let xml = `    <odePagStructure>\n`;
        xml += `      <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
        xml += `      <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>\n`;
        xml += `      <blockName>${this.escapeXml(block.name || '')}</blockName>\n`;
        xml += `      <iconName></iconName>\n`;
        xml += `      <odePagStructureOrder>${block.order ?? order}</odePagStructureOrder>\n`;

        // Block-level properties
        xml += '      <odePagStructureProperties>\n';
        if (block.properties) {
            const props = block.properties;
            if (props.visibility !== undefined) {
                xml += this.generatePagStructurePropertyEntry('visibility', String(props.visibility));
            }
            if (props.minimized !== undefined) {
                xml += this.generatePagStructurePropertyEntry('minimized', String(props.minimized));
            }
            if (props.teacherOnly !== undefined) {
                xml += this.generatePagStructurePropertyEntry('teacherOnly', String(props.teacherOnly));
            }
            if (props.cssClass !== undefined) {
                xml += this.generatePagStructurePropertyEntry('cssClass', String(props.cssClass));
            }
        }
        xml += '      </odePagStructureProperties>\n';

        // Components (odeComponents)
        xml += '      <odeComponents>\n';
        for (let i = 0; i < (block.components || []).length; i++) {
            xml += this.generateOdeComponentXml(block.components![i], pageId, blockId, i);
        }
        xml += '      </odeComponents>\n';

        xml += `    </odePagStructure>\n`;
        return xml;
    }

    /**
     * Generate page structure property entry
     */
    private generatePagStructurePropertyEntry(key: string, value: string): string {
        return `        <odePagStructureProperty>
          <key>${this.escapeXml(key)}</key>
          <value>${this.escapeXml(value)}</value>
        </odePagStructureProperty>\n`;
    }

    /**
     * Generate odeComponent for an iDevice
     */
    private generateOdeComponentXml(
        component: ExportComponent,
        pageId: string,
        blockId: string,
        order: number
    ): string {
        const componentId = component.id;
        const ideviceType = component.type || 'FreeTextIdevice';

        let xml = `        <odeComponent>\n`;
        xml += `          <odePageId>${this.escapeXml(pageId)}</odePageId>\n`;
        xml += `          <odeBlockId>${this.escapeXml(blockId)}</odeBlockId>\n`;
        xml += `          <odeIdeviceId>${this.escapeXml(componentId)}</odeIdeviceId>\n`;
        xml += `          <odeIdeviceTypeName>${this.escapeXml(ideviceType)}</odeIdeviceTypeName>\n`;

        // HTML content (wrapped in CDATA)
        const htmlContent = component.content || '';
        xml += `          <htmlView><![CDATA[${htmlContent}]]></htmlView>\n`;

        // JSON properties (wrapped in CDATA)
        if (component.properties && Object.keys(component.properties).length > 0) {
            const jsonStr = JSON.stringify(component.properties);
            xml += `          <jsonProperties><![CDATA[${jsonStr}]]></jsonProperties>\n`;
        } else {
            xml += `          <jsonProperties></jsonProperties>\n`;
        }

        xml += `          <odeComponentsOrder>${component.order ?? order}</odeComponentsOrder>\n`;

        // Component-level properties
        xml += '          <odeComponentsProperties>\n';
        xml += this.generateComponentPropertyEntry('visibility', 'true');
        xml += '          </odeComponentsProperties>\n';

        xml += `        </odeComponent>\n`;
        return xml;
    }

    /**
     * Generate component property entry
     */
    private generateComponentPropertyEntry(key: string, value: string): string {
        return `            <odeComponentsProperty>
              <key>${this.escapeXml(key)}</key>
              <value>${this.escapeXml(value)}</value>
            </odeComponentsProperty>\n`;
    }

    /**
     * Generate ODE identifier
     * Format: YYYYMMDDHHmmss + 6 random alphanumeric chars
     */
    private generateOdeId(): string {
        const now = new Date();
        const timestamp =
            now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let random = '';
        for (let i = 0; i < 6; i++) {
            random += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return timestamp + random;
    }
}

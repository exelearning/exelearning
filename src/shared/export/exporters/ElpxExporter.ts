/**
 * ElpxExporter
 *
 * Exports a document to ELPX (eXeLearning Project) format.
 * ELPX is a complete HTML5 export + content.xml for re-import.
 *
 * ELPX files contain everything HTML5 exports have, plus:
 * - content.xml (ODE format with full project structure for re-import)
 * - ode-content.dtd (DTD for XML validation)
 * - custom/ directory
 *
 * Structure:
 * - index.html (main page)
 * - html/*.html (individual pages)
 * - content/css/ (base CSS + icons)
 * - content/resources/ (project assets)
 * - libs/ (shared JavaScript libraries)
 * - theme/ (theme CSS/JS)
 * - idevices/ (iDevice-specific CSS/JS)
 * - content.xml (ODE format)
 * - ode-content.dtd
 * - custom/
 *
 * The ODE XML format is a hierarchical structure:
 * - odeProperties (metadata)
 * - odeResources (version info, identifiers)
 * - odeNavStructures (pages)
 *   - odePagStructures (blocks)
 *     - odeComponents (iDevices)
 */

import type {
    ExportPage,
    ExportBlock,
    ExportComponent,
    ExportMetadata,
    ExportOptions,
    ExportResult,
    ElpxExportOptions,
} from '../interfaces';
import { Html5Exporter } from './Html5Exporter';
import { validateXml, formatValidationErrors } from '../../../services/xml/xml-parser';

/**
 * ODE XML version identifier
 */
const ODE_VERSION = '4.0';

/**
 * ODE DTD filename (included in ELPX exports)
 */
const ODE_DTD_FILENAME = 'ode-content.dtd';

/**
 * ODE Content DTD
 * Embedded DTD for ELPX exports - validates content.xml structure
 */
const ODE_DTD_CONTENT = `<!--
    ODE Content DTD
    Document Type Definition for eXeLearning ODE XML format (content.xml)
    Version: 2.0
    Namespace: http://www.intef.es/xsd/ode
    Copyright (C) 2025 eXeLearning - License: AGPL-3.0
-->

<!ELEMENT ode (userPreferences?, odeResources?, odeProperties?, odeNavStructures)>
<!ATTLIST ode
    xmlns CDATA #FIXED "http://www.intef.es/xsd/ode"
    version CDATA #IMPLIED>

<!-- User Preferences -->
<!ELEMENT userPreferences (userPreference*)>
<!ELEMENT userPreference (key, value)>

<!-- ODE Resources -->
<!ELEMENT odeResources (odeResource*)>
<!ELEMENT odeResource (key, value)>

<!-- ODE Properties -->
<!ELEMENT odeProperties (odeProperty*)>
<!ELEMENT odeProperty (key, value)>

<!-- Shared Key-Value Elements -->
<!ELEMENT key (#PCDATA)>
<!ELEMENT value (#PCDATA)>

<!-- Navigation Structures (Pages) -->
<!ELEMENT odeNavStructures (odeNavStructure+)>
<!ELEMENT odeNavStructure (odePageId, odeParentPageId, pageName, odeNavStructureOrder, odeNavStructureProperties?, odePagStructures?)>

<!ELEMENT odePageId (#PCDATA)>
<!ELEMENT odeParentPageId (#PCDATA)>
<!ELEMENT pageName (#PCDATA)>
<!ELEMENT odeNavStructureOrder (#PCDATA)>

<!ELEMENT odeNavStructureProperties (odeNavStructureProperty*)>
<!ELEMENT odeNavStructureProperty (key, value)>

<!-- Block Structures -->
<!ELEMENT odePagStructures (odePagStructure*)>
<!ELEMENT odePagStructure (odePageId, odeBlockId, blockName, iconName?, odePagStructureOrder, odePagStructureProperties?, odeComponents?)>

<!ELEMENT odeBlockId (#PCDATA)>
<!ELEMENT blockName (#PCDATA)>
<!ELEMENT iconName (#PCDATA)>
<!ELEMENT odePagStructureOrder (#PCDATA)>

<!ELEMENT odePagStructureProperties (odePagStructureProperty*)>
<!ELEMENT odePagStructureProperty (key, value)>

<!-- Components (iDevices) -->
<!ELEMENT odeComponents (odeComponent*)>
<!ELEMENT odeComponent (odePageId, odeBlockId, odeIdeviceId, odeIdeviceTypeName, htmlView?, jsonProperties?, odeComponentsOrder, odeComponentsProperties?)>

<!ELEMENT odeIdeviceId (#PCDATA)>
<!ELEMENT odeIdeviceTypeName (#PCDATA)>
<!ELEMENT htmlView (#PCDATA)>
<!ELEMENT jsonProperties (#PCDATA)>
<!ELEMENT odeComponentsOrder (#PCDATA)>

<!ELEMENT odeComponentsProperties (odeComponentsProperty*)>
<!ELEMENT odeComponentsProperty (key, value)>
`;

export class ElpxExporter extends Html5Exporter {
    /**
     * Get file extension for ELPX format
     */
    getFileExtension(): string {
        return '.elpx';
    }

    /**
     * Get file suffix for ELPX format (no suffix for ELPX)
     */
    getFileSuffix(): string {
        return '';
    }

    /**
     * Export to ELPX format
     *
     * ELPX is a complete HTML5 export + content.xml (ODE format) + DTD for re-import.
     * This method generates all HTML5 content (index.html, html/*.html, libs/, theme/, etc.)
     * and then adds the content.xml with full ODE structure and DTD.
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

            // =========================================================================
            // SECTION 1: Generate HTML5 content (same as Html5Exporter)
            // =========================================================================

            // 1.1 Generate HTML pages
            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const html = this.generatePageHtml(page, pages, meta, i === 0, i);
                // First page is index.html, others go in html/ directory
                const pageFilename = i === 0 ? 'index.html' : `html/${this.sanitizePageFilename(page.title)}.html`;
                this.zip.addFile(pageFilename, html);
            }

            // 1.2 Add search_index.js if search box is enabled
            if (meta.addSearchBox) {
                const searchIndexContent = this.pageRenderer.generateSearchIndexFile(pages, '');
                this.zip.addFile('search_index.js', searchIndexContent);
            }

            // 1.3 Add base CSS (fetch from content/css)
            const contentCssFiles = await this.resources.fetchContentCss();
            const baseCss = contentCssFiles.get('content/css/base.css');
            if (!baseCss) {
                throw new Error('Failed to fetch content/css/base.css');
            }
            this.zip.addFile('content/css/base.css', baseCss);

            // 1.4 Add eXeLearning logo for "Made with eXeLearning" footer
            try {
                const logoData = await this.resources.fetchExeLogo();
                if (logoData) {
                    this.zip.addFile('content/img/exe_powered_logo.png', logoData);
                }
            } catch {
                // Logo not available - footer will still render but without background image
            }

            // 1.5 Fetch and add theme (renaming style.css -> content.css, style.js -> default.js)
            try {
                const themeFiles = await this.resources.fetchTheme(themeName);
                for (const [filePath, content] of themeFiles) {
                    // Rename theme files to legacy export format
                    let exportPath = filePath;
                    if (filePath === 'style.css') {
                        exportPath = 'content.css';
                    } else if (filePath === 'style.js') {
                        exportPath = 'default.js';
                    }
                    this.zip.addFile(`theme/${exportPath}`, content);
                }
            } catch (e) {
                // Add fallback theme if fetch fails (use legacy names)
                console.warn(`[ElpxExporter] Failed to fetch theme: ${themeName}`, e);
                this.zip.addFile('theme/content.css', this.getFallbackThemeCss());
                this.zip.addFile('theme/default.js', this.getFallbackThemeJs());
            }

            // 1.6 Fetch base libraries (always included - jQuery, Bootstrap, exe_lightbox, etc.)
            try {
                const baseLibs = await this.resources.fetchBaseLibraries();
                for (const [libPath, content] of baseLibs) {
                    this.zip.addFile(`libs/${libPath}`, content);
                }
            } catch {
                // Base libraries not available - continue anyway
            }

            // 1.7 Detect and fetch additional required libraries based on content
            const allHtmlContent = this.collectAllHtmlContent(pages);
            const { files: allRequiredFiles, patterns } = this.libraryDetector.getAllRequiredFilesWithPatterns(
                allHtmlContent,
                {
                    includeAccessibilityToolbar: meta.addAccessibilityToolbar === true,
                },
            );

            try {
                const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles, patterns);
                for (const [libPath, content] of libFiles) {
                    // Only add if not already added by base libraries
                    const zipPath = `libs/${libPath}`;
                    if (!this.zip.hasFile(zipPath)) {
                        this.zip.addFile(zipPath, content);
                    }
                }
            } catch {
                // Additional libraries not available - continue anyway
            }

            // 1.8 Fetch and add iDevice assets
            const usedIdevices = this.getUsedIdevices(pages);
            for (const idevice of usedIdevices) {
                try {
                    // Normalize iDevice type to directory name (e.g., 'FreeTextIdevice' -> 'text')
                    const normalizedType = this.resources.normalizeIdeviceType(idevice);
                    const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
                    for (const [filePath, content] of ideviceFiles) {
                        // Use normalized type for ZIP path
                        this.zip.addFile(`idevices/${normalizedType}/${filePath}`, content);
                    }
                } catch {
                    // Many iDevices don't have extra files - this is normal
                }
            }

            // 1.9 Add project assets
            await this.addAssetsToZipWithResourcePath();

            // =========================================================================
            // SECTION 2: Add ELPX-specific files (content.xml with ODE format + DTD)
            // =========================================================================

            // 2.1 Generate content.xml with full ODE format (for re-import)
            const contentXml = this.generateOdeXml(meta, pages);

            // Validate generated XML
            const validation = validateXml(contentXml);
            if (!validation.valid) {
                const errorMsg = formatValidationErrors(validation);
                console.error(`[ElpxExporter] Generated XML failed validation:\n${errorMsg}`);
                throw new Error(`Generated content.xml is invalid:\n${errorMsg}`);
            }
            if (validation.warnings.length > 0) {
                console.warn(`[ElpxExporter] XML validation warnings:\n${formatValidationErrors(validation)}`);
            }

            this.zip.addFile('content.xml', contentXml);

            // 2.2 Add DTD file
            this.zip.addFile(ODE_DTD_FILENAME, ODE_DTD_CONTENT);

            // 2.3 Add custom/ directory (empty marker file)
            this.zip.addFile('custom/.gitkeep', '');

            // =========================================================================
            // SECTION 3: Generate final ZIP
            // =========================================================================
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
        xml += `<!DOCTYPE ode SYSTEM "${ODE_DTD_FILENAME}">\n`;
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
            pp_addMathJax: meta.addMathJax,
            pp_customStyles: meta.customStyles,
            pp_exelearning_version: meta.exelearningVersion,
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
        xml += `      <iconName>${this.escapeXml(block.iconName || '')}</iconName>\n`;
        xml += `      <odePagStructureOrder>${block.order ?? order}</odePagStructureOrder>\n`;

        // Block-level properties - export ALL properties
        xml += '      <odePagStructureProperties>\n';
        if (block.properties) {
            const props = block.properties;
            // Export all 6 block properties
            if (props.visibility !== undefined) {
                xml += this.generatePagStructurePropertyEntry('visibility', String(props.visibility));
            }
            if (props.teacherOnly !== undefined) {
                xml += this.generatePagStructurePropertyEntry('teacherOnly', String(props.teacherOnly));
            }
            if (props.allowToggle !== undefined) {
                xml += this.generatePagStructurePropertyEntry('allowToggle', String(props.allowToggle));
            }
            if (props.minimized !== undefined) {
                xml += this.generatePagStructurePropertyEntry('minimized', String(props.minimized));
            }
            if (props.identifier !== undefined) {
                xml += this.generatePagStructurePropertyEntry('identifier', String(props.identifier));
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
        order: number,
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
        xml += `          <htmlView><![CDATA[${this.escapeCdata(htmlContent)}]]></htmlView>\n`;

        // JSON properties (wrapped in CDATA)
        if (component.properties && Object.keys(component.properties).length > 0) {
            const jsonStr = JSON.stringify(component.properties);
            xml += `          <jsonProperties><![CDATA[${this.escapeCdata(jsonStr)}]]></jsonProperties>\n`;
        } else {
            xml += `          <jsonProperties></jsonProperties>\n`;
        }

        xml += `          <odeComponentsOrder>${component.order ?? order}</odeComponentsOrder>\n`;

        // Component-level structure properties - export all 4 properties
        xml += '          <odeComponentsProperties>\n';
        if (component.structureProperties) {
            const props = component.structureProperties;
            if (props.visibility !== undefined) {
                xml += this.generateComponentPropertyEntry('visibility', String(props.visibility));
            }
            if (props.teacherOnly !== undefined) {
                xml += this.generateComponentPropertyEntry('teacherOnly', String(props.teacherOnly));
            }
            if (props.identifier !== undefined) {
                xml += this.generateComponentPropertyEntry('identifier', String(props.identifier));
            }
            if (props.cssClass !== undefined) {
                xml += this.generateComponentPropertyEntry('cssClass', String(props.cssClass));
            }
        } else {
            // Default visibility if no structure properties
            xml += this.generateComponentPropertyEntry('visibility', 'true');
        }
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

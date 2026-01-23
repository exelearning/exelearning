/**
 * OdeXmlGenerator
 *
 * Unified generator for ODE XML format (content.xml).
 * Used by all exporters: ELPX, HTML5, EPUB3, SCORM 1.2/2004.
 *
 * Generates XML with structure:
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * <!DOCTYPE ode SYSTEM "content.dtd">
 * <ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
 *   <userPreferences>...</userPreferences>
 *   <odeResources>...</odeResources>
 *   <odeProperties>...</odeProperties>
 *   <odeNavStructures>...</odeNavStructures>
 * </ode>
 * ```
 */

import type { ExportMetadata, ExportPage, ExportBlock, ExportComponent } from '../interfaces';
import { ODE_DTD_FILENAME, ODE_VERSION } from '../constants';
import { isExcludedFromXml, getXmlKeyForProperty, valueToXmlString } from '../metadata-properties';

/**
 * Options for ODE XML generation
 */
export interface OdeXmlOptions {
    /** ODE identifier (auto-generated if not provided) */
    odeId?: string;
    /** Version identifier (auto-generated if not provided) */
    versionId?: string;
    /**
     * Whether to include DOCTYPE declaration referencing content.dtd
     * Set to false for IMS/SCORM exports where DTD is not included
     * Default: true (for ELPX which includes content.dtd)
     */
    includeDoctype?: boolean;
}

/**
 * Generate complete ODE XML document
 */
export function generateOdeXml(meta: ExportMetadata, pages: ExportPage[], options?: OdeXmlOptions): string {
    const odeId = options?.odeId || meta.odeIdentifier || generateOdeId();
    const versionId = options?.versionId || generateOdeId();
    const includeDoctype = options?.includeDoctype ?? true;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    if (includeDoctype) {
        xml += `<!DOCTYPE ode SYSTEM "${ODE_DTD_FILENAME}">\n`;
    }
    xml += '<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">\n';

    // User preferences (theme selection)
    xml += generateUserPreferencesXml(meta);

    // ODE resources (version info, IDs)
    xml += generateOdeResourcesXml(odeId, versionId);

    // ODE properties (metadata)
    xml += generateOdePropertiesXml(meta);

    // Navigation structures (pages with blocks and components)
    xml += '<odeNavStructures>\n';
    for (let i = 0; i < pages.length; i++) {
        xml += generateOdeNavStructureXml(pages[i], i);
    }
    xml += '</odeNavStructures>\n';

    xml += '</ode>';
    return xml;
}

/**
 * Generate user preferences section
 */
function generateUserPreferencesXml(meta: ExportMetadata): string {
    let xml = '<userPreferences>\n';
    xml += generateUserPreferenceEntry('theme', meta.theme || 'base');
    xml += '</userPreferences>\n';
    return xml;
}

/**
 * Generate single user preference entry
 */
function generateUserPreferenceEntry(key: string, value: string): string {
    return `  <userPreference>
    <key>${escapeXml(key)}</key>
    <value>${escapeXml(value)}</value>
  </userPreference>\n`;
}

/**
 * Generate ODE resources section (identifiers, version)
 */
function generateOdeResourcesXml(odeId: string, versionId: string): string {
    let xml = '<odeResources>\n';
    xml += generateOdeResourceEntry('odeId', odeId);
    xml += generateOdeResourceEntry('odeVersionId', versionId);
    xml += generateOdeResourceEntry('exe_version', ODE_VERSION);
    xml += '</odeResources>\n';
    return xml;
}

/**
 * Generate single ODE resource entry
 */
function generateOdeResourceEntry(key: string, value: string): string {
    return `  <odeResource>
    <key>${escapeXml(key)}</key>
    <value>${escapeXml(value)}</value>
  </odeResource>\n`;
}

/**
 * Generate ODE properties section (metadata)
 * Automatically exports all ExportMetadata properties except those excluded in the centralized config.
 * Property names and XML keys are managed by metadata-properties.ts
 */
function generateOdePropertiesXml(meta: ExportMetadata): string {
    let xml = '<odeProperties>\n';

    for (const [key, value] of Object.entries(meta)) {
        // Skip excluded properties (internal or belong in other sections)
        if (isExcludedFromXml(key)) continue;

        // Skip undefined, null, or empty values
        if (value === undefined || value === null || value === '') continue;

        // Convert value to string using centralized helper (booleans become 'true'/'false')
        const strValue = valueToXmlString(key, value);
        const xmlKey = getXmlKeyForProperty(key);
        xml += generateOdePropertyEntry(xmlKey, strValue);
    }

    xml += '</odeProperties>\n';
    return xml;
}

/**
 * Generate single ODE property entry
 */
function generateOdePropertyEntry(key: string, value: string): string {
    return `  <odeProperty>
    <key>${escapeXml(key)}</key>
    <value>${escapeXml(value)}</value>
  </odeProperty>\n`;
}

/**
 * Generate odeNavStructure for a page
 */
function generateOdeNavStructureXml(page: ExportPage, order: number): string {
    const pageId = page.id;
    const parentId = page.parentId || '';

    let xml = `<odeNavStructure>\n`;
    xml += `  <odePageId>${escapeXml(pageId)}</odePageId>\n`;
    xml += `  <odeParentPageId>${escapeXml(parentId)}</odeParentPageId>\n`;
    xml += `  <pageName>${escapeXml(page.title || 'Page')}</pageName>\n`;
    xml += `  <odeNavStructureOrder>${page.order ?? order}</odeNavStructureOrder>\n`;

    // Page-level properties
    xml += '  <odeNavStructureProperties>\n';
    xml += generateNavStructurePropertyEntry('titlePage', page.title || '');
    if (page.properties) {
        for (const [key, value] of Object.entries(page.properties)) {
            if (value !== undefined && value !== null) {
                xml += generateNavStructurePropertyEntry(key, String(value));
            }
        }
    }
    xml += '  </odeNavStructureProperties>\n';

    // Blocks (odePagStructures)
    xml += '  <odePagStructures>\n';
    for (let i = 0; i < (page.blocks || []).length; i++) {
        xml += generateOdePagStructureXml(page.blocks![i], pageId, i);
    }
    xml += '  </odePagStructures>\n';

    xml += '</odeNavStructure>\n';
    return xml;
}

/**
 * Generate navigation structure property entry
 */
function generateNavStructurePropertyEntry(key: string, value: string): string {
    return `    <odeNavStructureProperty>
      <key>${escapeXml(key)}</key>
      <value>${escapeXml(value)}</value>
    </odeNavStructureProperty>\n`;
}

/**
 * Generate odePagStructure for a block
 */
function generateOdePagStructureXml(block: ExportBlock, pageId: string, order: number): string {
    const blockId = block.id;

    let xml = `    <odePagStructure>\n`;
    xml += `      <odePageId>${escapeXml(pageId)}</odePageId>\n`;
    xml += `      <odeBlockId>${escapeXml(blockId)}</odeBlockId>\n`;
    xml += `      <blockName>${escapeXml(block.name || '')}</blockName>\n`;
    xml += `      <iconName>${escapeXml(block.iconName || '')}</iconName>\n`;
    xml += `      <odePagStructureOrder>${block.order ?? order}</odePagStructureOrder>\n`;

    // Block-level properties
    xml += '      <odePagStructureProperties>\n';
    if (block.properties) {
        const blockPropKeys = [
            'visibility',
            'teacherOnly',
            'allowToggle',
            'minimized',
            'identifier',
            'cssClass',
        ] as const;
        for (const key of blockPropKeys) {
            if (block.properties[key] !== undefined) {
                xml += generatePagStructurePropertyEntry(key, String(block.properties[key]));
            }
        }
    }
    xml += '      </odePagStructureProperties>\n';

    // Components (odeComponents)
    xml += '      <odeComponents>\n';
    for (let i = 0; i < (block.components || []).length; i++) {
        xml += generateOdeComponentXml(block.components![i], pageId, blockId, i);
    }
    xml += '      </odeComponents>\n';

    xml += `    </odePagStructure>\n`;
    return xml;
}

/**
 * Generate page structure property entry
 */
function generatePagStructurePropertyEntry(key: string, value: string): string {
    return `        <odePagStructureProperty>
          <key>${escapeXml(key)}</key>
          <value>${escapeXml(value)}</value>
        </odePagStructureProperty>\n`;
}

/**
 * Transform asset:// URLs to {{context_path}}/content/resources/ format.
 *
 * Note: In the current architecture, all asset URLs are converted by
 * BaseExporter.addFilenamesToAssetUrls() during preprocessing.
 * This function is kept for backward compatibility but should not
 * find any asset:// URLs to transform.
 */
export function transformAssetUrlsForXml(content: string): string {
    return content || '';
}

/**
 * Generate odeComponent for an iDevice
 */
function generateOdeComponentXml(component: ExportComponent, pageId: string, blockId: string, order: number): string {
    const componentId = component.id;
    const ideviceType = component.type || 'FreeTextIdevice';

    let xml = `        <odeComponent>\n`;
    xml += `          <odePageId>${escapeXml(pageId)}</odePageId>\n`;
    xml += `          <odeBlockId>${escapeXml(blockId)}</odeBlockId>\n`;
    xml += `          <odeIdeviceId>${escapeXml(componentId)}</odeIdeviceId>\n`;
    xml += `          <odeIdeviceTypeName>${escapeXml(ideviceType)}</odeIdeviceTypeName>\n`;

    // HTML content - transform asset:// URLs to content/resources/ (wrapped in CDATA)
    const htmlContent = transformAssetUrlsForXml(component.content || '');
    xml += `          <htmlView><![CDATA[${escapeCdata(htmlContent)}]]></htmlView>\n`;

    // JSON properties - transform asset:// URLs to content/resources/ (wrapped in CDATA)
    if (component.properties && Object.keys(component.properties).length > 0) {
        const jsonStr = transformAssetUrlsForXml(JSON.stringify(component.properties));
        xml += `          <jsonProperties><![CDATA[${escapeCdata(jsonStr)}]]></jsonProperties>\n`;
    } else {
        xml += `          <jsonProperties></jsonProperties>\n`;
    }

    xml += `          <odeComponentsOrder>${component.order ?? order}</odeComponentsOrder>\n`;

    // Component-level structure properties
    xml += '          <odeComponentsProperties>\n';
    if (component.structureProperties) {
        const componentPropKeys = ['visibility', 'teacherOnly', 'identifier', 'cssClass'] as const;
        for (const key of componentPropKeys) {
            if (component.structureProperties[key] !== undefined) {
                xml += generateComponentPropertyEntry(key, String(component.structureProperties[key]));
            }
        }
    } else {
        // Default visibility if no structure properties
        xml += generateComponentPropertyEntry('visibility', 'true');
    }
    xml += '          </odeComponentsProperties>\n';

    xml += `        </odeComponent>\n`;
    return xml;
}

/**
 * Generate component property entry
 */
function generateComponentPropertyEntry(key: string, value: string): string {
    return `            <odeComponentsProperty>
              <key>${escapeXml(key)}</key>
              <value>${escapeXml(value)}</value>
            </odeComponentsProperty>\n`;
}

/**
 * Generate ODE identifier
 * Format: YYYYMMDDHHmmss + 6 random alphanumeric chars
 */
export function generateOdeId(): string {
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

/**
 * Escape XML special characters
 */
export function escapeXml(str: string | null | undefined): string {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Escape content for use in CDATA sections
 * CDATA cannot contain the sequence ]]> as it closes the CDATA block.
 * We split it into multiple CDATA sections when this sequence appears.
 */
export function escapeCdata(str: string | null | undefined): string {
    if (!str) return '';
    // Replace ]]> with ]]]]><![CDATA[> to split the CDATA section
    return String(str).replace(/\]\]>/g, ']]]]><![CDATA[>');
}

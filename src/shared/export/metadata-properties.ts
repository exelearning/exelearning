/**
 * Centralized Metadata Properties Configuration
 *
 * Defines all project metadata properties with their XML keys, types, and defaults.
 * This configuration is the single source of truth used by:
 * - OdeXmlGenerator.ts (for XML export)
 * - xml-parser.ts (for XML parsing)
 * - ElpxImporter.js (for import into Yjs)
 * - YjsPropertiesBinding.js (for UI binding)
 *
 * When adding new metadata properties, only update this file.
 */

/**
 * Property type for metadata values
 */
export type MetadataPropertyType = 'string' | 'boolean';

/**
 * Configuration for a single metadata property
 */
export interface MetadataPropertyConfig {
    /** Internal property name (used in Yjs metadata and ExportMetadata interface) */
    key: string;
    /** XML key name for content.xml (with or without pp_ prefix) */
    xmlKey: string;
    /** Property type */
    type: MetadataPropertyType;
    /** Default value (used when property is missing) */
    defaultValue: string | boolean;
    /** Whether this property is excluded from XML export (internal only) */
    excludeFromXml?: boolean;
    /** Category for grouping in UI */
    category: 'core' | 'export' | 'content' | 'internal' | 'scorm';
}

/**
 * All metadata properties configuration
 *
 * IMPORTANT: When adding new properties:
 * 1. Add the property here with its configuration
 * 2. Add it to the ExportMetadata interface in interfaces.ts
 * 3. The property will automatically be:
 *    - Exported to XML by OdeXmlGenerator
 *    - Parsed from XML by xml-parser
 *    - Imported by ElpxImporter
 */
export const METADATA_PROPERTIES: MetadataPropertyConfig[] = [
    // =========================================================================
    // Core Metadata
    // =========================================================================
    {
        key: 'title',
        xmlKey: 'pp_title',
        type: 'string',
        defaultValue: 'eXeLearning',
        category: 'core',
    },
    {
        key: 'subtitle',
        xmlKey: 'pp_subtitle',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'author',
        xmlKey: 'pp_author',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'description',
        xmlKey: 'pp_description',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'language',
        xmlKey: 'pp_lang',
        type: 'string',
        defaultValue: 'en',
        category: 'core',
    },
    {
        key: 'license',
        xmlKey: 'pp_license',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'licenseUrl',
        xmlKey: 'pp_licenseUrl',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'keywords',
        xmlKey: 'pp_keywords',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'category',
        xmlKey: 'pp_category',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'theme',
        xmlKey: 'pp_theme',
        type: 'string',
        defaultValue: 'base',
        category: 'core',
    },
    {
        key: 'customStyles',
        xmlKey: 'pp_customStyles',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },
    {
        key: 'exelearningVersion',
        xmlKey: 'pp_exelearning_version',
        type: 'string',
        defaultValue: '',
        category: 'core',
    },

    // =========================================================================
    // Export Options
    // =========================================================================
    {
        key: 'addExeLink',
        xmlKey: 'pp_addExeLink',
        type: 'boolean',
        defaultValue: true,
        category: 'export',
    },
    {
        key: 'addPagination',
        xmlKey: 'pp_addPagination',
        type: 'boolean',
        defaultValue: false,
        category: 'export',
    },
    {
        key: 'addSearchBox',
        xmlKey: 'pp_addSearchBox',
        type: 'boolean',
        defaultValue: false,
        category: 'export',
    },
    {
        key: 'addAccessibilityToolbar',
        xmlKey: 'pp_addAccessibilityToolbar',
        type: 'boolean',
        defaultValue: false,
        category: 'export',
    },
    {
        key: 'addMathJax',
        xmlKey: 'pp_addMathJax',
        type: 'boolean',
        defaultValue: false,
        category: 'export',
    },
    {
        key: 'exportSource',
        xmlKey: 'exportSource', // No pp_ prefix for legacy compatibility
        type: 'boolean',
        defaultValue: true,
        category: 'export',
    },
    {
        key: 'globalFont',
        xmlKey: 'pp_globalFont',
        type: 'string',
        defaultValue: 'default',
        category: 'export',
    },

    // =========================================================================
    // Custom Content
    // =========================================================================
    {
        key: 'extraHeadContent',
        xmlKey: 'pp_extraHeadContent',
        type: 'string',
        defaultValue: '',
        category: 'content',
    },
    {
        key: 'footer',
        xmlKey: 'footer', // No pp_ prefix for legacy compatibility
        type: 'string',
        defaultValue: '',
        category: 'content',
    },

    // =========================================================================
    // Internal Properties (excluded from XML export)
    // =========================================================================
    {
        key: 'odeIdentifier',
        xmlKey: 'odeIdentifier',
        type: 'string',
        defaultValue: '',
        excludeFromXml: true,
        category: 'internal',
    },
    {
        key: 'createdAt',
        xmlKey: 'createdAt',
        type: 'string',
        defaultValue: '',
        excludeFromXml: true,
        category: 'internal',
    },
    {
        key: 'modifiedAt',
        xmlKey: 'modifiedAt',
        type: 'string',
        defaultValue: '',
        excludeFromXml: true,
        category: 'internal',
    },

    // =========================================================================
    // SCORM-specific Properties (go in manifest, not odeProperties)
    // =========================================================================
    {
        key: 'scormIdentifier',
        xmlKey: 'scormIdentifier',
        type: 'string',
        defaultValue: '',
        excludeFromXml: true,
        category: 'scorm',
    },
    {
        key: 'masteryScore',
        xmlKey: 'masteryScore',
        type: 'string',
        defaultValue: '',
        excludeFromXml: true,
        category: 'scorm',
    },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get property configuration by internal key
 */
export function getPropertyConfig(key: string): MetadataPropertyConfig | undefined {
    return METADATA_PROPERTIES.find(p => p.key === key);
}

/**
 * Get property configuration by XML key (case-insensitive)
 */
export function getPropertyConfigByXmlKey(xmlKey: string): MetadataPropertyConfig | undefined {
    const lowerXmlKey = xmlKey.toLowerCase();
    return METADATA_PROPERTIES.find(p => p.xmlKey.toLowerCase() === lowerXmlKey);
}

/**
 * Get XML key for a property
 */
export function getXmlKeyForProperty(key: string): string {
    const config = getPropertyConfig(key);
    return config?.xmlKey ?? `pp_${key}`;
}

/**
 * Get internal key for an XML key (case-insensitive)
 */
export function getInternalKeyForXmlKey(xmlKey: string): string | undefined {
    const config = getPropertyConfigByXmlKey(xmlKey);
    return config?.key;
}

/**
 * Get default value for a property
 */
export function getDefaultValue(key: string): string | boolean {
    const config = getPropertyConfig(key);
    return config?.defaultValue ?? '';
}

/**
 * Check if a property should be excluded from XML export
 */
export function isExcludedFromXml(key: string): boolean {
    const config = getPropertyConfig(key);
    return config?.excludeFromXml === true;
}

/**
 * Get all properties that should be exported to XML
 */
export function getExportableProperties(): MetadataPropertyConfig[] {
    return METADATA_PROPERTIES.filter(p => !p.excludeFromXml);
}

/**
 * Get properties by category
 */
export function getPropertiesByCategory(category: MetadataPropertyConfig['category']): MetadataPropertyConfig[] {
    return METADATA_PROPERTIES.filter(p => p.category === category);
}

/**
 * Check if a property is a boolean type
 */
export function isBooleanProperty(key: string): boolean {
    const config = getPropertyConfig(key);
    return config?.type === 'boolean';
}

/**
 * Parse a value according to property type
 */
export function parsePropertyValue(key: string, value: unknown): string | boolean {
    const config = getPropertyConfig(key);
    if (!config) {
        return typeof value === 'string' ? value : String(value ?? '');
    }

    if (config.type === 'boolean') {
        if (value === undefined || value === null) return config.defaultValue as boolean;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'true';
        return config.defaultValue as boolean;
    }

    // String type
    if (value === undefined || value === null) return config.defaultValue as string;
    return String(value);
}

/**
 * Convert a value to string for XML export
 */
export function valueToXmlString(key: string, value: unknown): string {
    const config = getPropertyConfig(key);
    if (config?.type === 'boolean') {
        return value === true || value === 'true' ? 'true' : 'false';
    }
    return String(value ?? '');
}

/**
 * Build a map from XML keys to internal keys (for parsing)
 * Keys are lowercased for case-insensitive matching
 */
export function buildXmlKeyToInternalKeyMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const prop of METADATA_PROPERTIES) {
        map.set(prop.xmlKey.toLowerCase(), prop.key);
    }
    return map;
}

/**
 * Build a map from internal keys to XML keys (for export)
 */
export function buildInternalKeyToXmlKeyMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const prop of METADATA_PROPERTIES) {
        map.set(prop.key, prop.xmlKey);
    }
    return map;
}

/**
 * Build a map for UI property binding (pp_key -> internal key)
 * This is compatible with YjsPropertiesBinding.js propertyKeyMap format
 */
export function buildPropertyKeyMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const prop of METADATA_PROPERTIES) {
        // Only include properties that have different XML keys than internal keys
        // and are not excluded from XML
        if (!prop.excludeFromXml) {
            map[prop.xmlKey] = prop.key;
        }
    }
    return map;
}

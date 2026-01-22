/**
 * TypeScript interfaces for ODE XML structure
 * Based on Symfony's XML format used in content.xml files
 */

/**
 * Main ODE XML document structure
 */
export interface OdeXmlDocument {
    exe_document: {
        meta: OdeXmlMeta;
        navigation: OdeXmlNavigation;
    };
}

/**
 * Metadata section of ODE XML
 */
export interface OdeXmlMeta {
    author?: string;
    title?: string;
    subtitle?: string;
    description?: string;
    language?: string;
    license?: string;
    keywords?: string;
    taxonomy?: string;
    aggregationLevel?: string;
    structure?: string;
    semanticDensity?: string;
    difficulty?: string;
    typicalLearningTime?: string;
    context?: string;
    endUser?: string;
    interactivityType?: string;
    interactivityLevel?: string;
    cognitiveProcess?: string;
    intendedEducationalUse?: string;
    version?: string;
    exelearning_version?: string;
    created?: string;
    modified?: string;
    theme?: string;

    // Export options
    addExeLink?: boolean;
    addPagination?: boolean;
    addSearchBox?: boolean;
    addAccessibilityToolbar?: boolean;
    addMathJax?: boolean;
    exportSource?: boolean;

    // Custom content
    extraHeadContent?: string;
    footer?: string;
}

/**
 * Navigation section containing the page tree
 */
export interface OdeXmlNavigation {
    page: OdeXmlPage | OdeXmlPage[];
}

/**
 * Page structure in the navigation tree
 */
export interface OdeXmlPage {
    id: string;
    title: string;
    level?: number;
    parent_id?: string;
    component?: OdeXmlComponent | OdeXmlComponent[];
    page?: OdeXmlPage | OdeXmlPage[]; // Nested child pages
}

/**
 * Property value types allowed in component/page properties
 */
export type PropertyValue = string | number | boolean | null | PropertyValue[] | { [key: string]: PropertyValue };

/**
 * Component structure within a page
 */
export interface OdeXmlComponent {
    id?: string;
    type: string;
    position?: number;
    properties?: Record<string, PropertyValue>;
    content?: string;
    data?: Record<string, unknown>;
}

/**
 * Normalized page structure for database storage
 */
export interface NormalizedPage {
    id: string;
    title: string;
    components: NormalizedComponent[];
    children?: NormalizedPage[]; // For legacy hierarchy reconstruction
    level: number;
    parent_id: string | null;
    position: number;
    properties?: Record<string, PropertyValue>; // Page-level properties
}

export interface NormalizedComponent {
    id: string;
    title?: string; // Component title
    type: string;
    content: string | Record<string, unknown>; // HTML or structured content
    blockName?: string; // Block name for legacy support
    blockIconName?: string; // Block icon name for export
    blockId?: string; // Block ID for grouping
    blockProperties?: Record<string, PropertyValue>; // Block-level properties
    order?: number; // Order within the page
    position?: number; // Position within the page
    properties?: Record<string, PropertyValue>; // Component properties
    data?: Record<string, unknown>; // Additional JSON data
}

/**
 * Complete parsed ODE structure
 */
export interface ParsedOdeStructure {
    meta: OdeXmlMeta;
    pages: NormalizedPage[];
    navigation: OdeXmlNavigation;
    raw: RealOdeXmlDocument; // Preserve raw XML structure for database persistence
    srcRoutes?: string[]; // Array of resource paths (for legacy .elp file copying)
}

/**
 * Legacy XML format support
 */
export interface LegacyXmlFormat {
    version: string;
    format: 'ode' | 'exe_old' | 'unknown';
    requiresConversion: boolean;
}

/**
 * ODE Resources structure
 */
export interface OdeResourcesStructure {
    odeResource?: OdeResource | OdeResource[];
}

export interface OdeResource {
    resourceId: string;
    resourcePath?: string;
    resourceType?: string;
}

/**
 * Real ODE XML format (from actual ELP files)
 */
export interface RealOdeXmlDocument {
    ode: {
        odeProperties?: {
            odeProperty: Array<{
                key: string;
                value: string;
            }>;
        };
        odeNavStructures?: {
            odeNavStructure: RealOdeNavStructure | RealOdeNavStructure[];
        };
        odeResources?: OdeResourcesStructure;
        userPreferences?: {
            userPreference: { key: string; value: string } | Array<{ key: string; value: string }>;
        };
    };
}

export interface RealOdeNavStructure {
    odePageId: string;
    odeParentPageId?: string;
    pageName: string;
    odeNavStructureOrder?: number;
    odeNavStructureProperties?: {
        odeNavStructureProperty: Array<{
            key: string;
            value: string;
        }>;
    };
    odePagStructures?: {
        odePagStructure: RealOdePagStructure | RealOdePagStructure[];
    };
}

/**
 * Structure properties map (key-value pairs)
 */
export interface StructurePropertiesMap {
    odeProperty?: Array<{ key: string; value: string }>;
}

export interface RealOdePagStructure {
    odePageId: string;
    odeBlockId: string;
    blockName?: string;
    iconName?: string;
    odePagStructureOrder?: number;
    odePagStructureProperties?: StructurePropertiesMap;
    odeComponents?: {
        odeComponent: RealOdeComponent | RealOdeComponent[];
    };
}

export interface RealOdeComponent {
    odePageId: string;
    odeBlockId: string;
    odeIdeviceId?: string;
    odeIdeviceTypeDirName?: string; // Preferred type identifier (matches browser ElpxImporter behavior)
    odeIdeviceTypeName?: string;
    htmlView?: string;
    jsonProperties?: string;
    odeComponentsOrder?: number;
    odeComponentsProperties?: StructurePropertiesMap;
}

/**
 * Legacy Instance XML format (from old .elp files with contentv3.xml)
 */
export interface LegacyInstanceXmlDocument {
    instance: LegacyInstanceNode;
}

/**
 * Legacy value types from old XML format
 */
export interface LegacyBoolNode {
    '@_value': string; // "True" or "False"
}

export interface LegacyIntNode {
    '@_value': string; // Numeric string
}

export interface LegacyReferenceNode {
    '@_reference': string;
}

export interface LegacyInstanceNode {
    '@_class': string;
    '@_reference'?: string;
    dictionary?: {
        string?: LegacyValueNode | LegacyValueNode[];
        instance?: LegacyInstanceNode | LegacyInstanceNode[];
        list?: LegacyListNode | LegacyListNode[];
        unicode?: LegacyValueNode | LegacyValueNode[];
        dictionary?: Record<string, unknown>; // Nested dictionary support
        bool?: LegacyBoolNode | LegacyBoolNode[];
        int?: LegacyIntNode | LegacyIntNode[];
        reference?: LegacyReferenceNode | LegacyReferenceNode[];
        none?: Record<string, never>; // Empty placeholder
    };
}

export interface LegacyValueNode {
    '@_value': string;
    '@_role'?: string;
}

export interface LegacyListNode {
    instance?: LegacyInstanceNode | LegacyInstanceNode[];
}

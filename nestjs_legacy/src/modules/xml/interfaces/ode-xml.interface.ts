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
 * Component structure within a page
 */
export interface OdeXmlComponent {
    id?: string;
    type: string;
    position?: number;
    properties?: Record<string, any>;
    content?: string;
    data?: any;
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
}

export interface NormalizedComponent {
    id: string;
    title?: string; // Component title
    type: string;
    content: any; // HTML or structured content
    blockName?: string; // Block name for legacy support
    order?: number; // Order within the page
    position?: number; // Position within the page
    properties?: Record<string, any>; // Component properties
    data?: any; // Additional JSON data
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
        odeResources?: any;
        userPreferences?: any;
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

export interface RealOdePagStructure {
    odePageId: string;
    odeBlockId: string;
    blockName?: string;
    iconName?: string;
    odePagStructureOrder?: number;
    odePagStructureProperties?: any;
    odeComponents?: {
        odeComponent: RealOdeComponent | RealOdeComponent[];
    };
}

export interface RealOdeComponent {
    odePageId: string;
    odeBlockId: string;
    odeIdeviceId?: string;
    odeIdeviceTypeName?: string;
    htmlView?: string;
    jsonProperties?: string;
    odeComponentsOrder?: number;
    odeComponentsProperties?: any;
}

/**
 * Legacy Instance XML format (from old .elp files with contentv3.xml)
 */
export interface LegacyInstanceXmlDocument {
    instance: LegacyInstanceNode;
}

export interface LegacyInstanceNode {
    '@_class': string;
    '@_reference'?: string;
    dictionary?: {
        string?: LegacyValueNode | LegacyValueNode[];
        instance?: LegacyInstanceNode | LegacyInstanceNode[];
        list?: LegacyListNode | LegacyListNode[];
        unicode?: LegacyValueNode | LegacyValueNode[];
        dictionary?: any; // Nested dictionary support
        bool?: any;
        int?: any;
        reference?: any;
        none?: any;
    };
}

export interface LegacyValueNode {
    '@_value': string;
    '@_role'?: string;
}

export interface LegacyListNode {
    instance?: LegacyInstanceNode | LegacyInstanceNode[];
}

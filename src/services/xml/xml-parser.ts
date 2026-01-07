/**
 * XML Parser Service for Elysia
 * Parses ODE XML files from ELP packages
 */
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as fs from 'fs-extra';
import {
    OdeXmlDocument,
    OdeXmlMeta,
    OdeXmlNavigation,
    OdeXmlPage,
    NormalizedPage,
    NormalizedComponent,
    ParsedOdeStructure,
    RealOdeXmlDocument,
    RealOdeNavStructure,
    LegacyInstanceXmlDocument,
} from './interfaces';
import { generateId } from '../../utils/id-generator.util';
import * as legacyParser from './legacy-xml-parser';
import { isJsonIdevice } from '../idevice-config';
import { validateOdeXml, formatValidationErrors, type ValidationResult } from './ode-xml-validator';

export interface XmlParseOptions {
    preserveOrder?: boolean;
    ignoreAttributes?: boolean;
    parseTagValue?: boolean;
    trimValues?: boolean;
}

// Configure fast-xml-parser with appropriate options
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
    cdataPropName: '__cdata',
    ignoreDeclaration: true,
    ignorePiTags: true,
    commentPropName: false,
    allowBooleanAttributes: true,
});

const DEBUG = process.env.APP_DEBUG === '1';

/**
 * Parse ODE XML from file
 */
export async function parseFromFile(xmlPath: string, sessionId?: string): Promise<ParsedOdeStructure> {
    if (DEBUG) console.log(`[XmlParser] Parsing XML file: ${xmlPath}`);

    if (!(await fs.pathExists(xmlPath))) {
        throw new Error(`XML file not found: ${xmlPath}`);
    }

    const xmlContent = await fs.readFile(xmlPath, 'utf-8');
    return parseFromString(xmlContent, sessionId);
}

/**
 * Parse options for XML parsing
 */
export interface ParseOptions {
    /** Skip DTD validation (default: false) */
    skipValidation?: boolean;
    /** Throw error on validation warnings (default: false) */
    strictValidation?: boolean;
}

/**
 * Parse ODE XML from string
 */
export function parseFromString(xmlContent: string, sessionId?: string, options?: ParseOptions): ParsedOdeStructure {
    if (DEBUG) console.log('[XmlParser] Parsing XML from string');

    const parsed = parser.parse(xmlContent);

    if (DEBUG) {
        console.log(`[XmlParser] Parsed object keys: ${JSON.stringify(Object.keys(parsed))}`);
        console.log(
            `[XmlParser] Has ode: ${!!parsed.ode}, Has exe_document: ${!!parsed.exe_document}, Has instance: ${!!parsed.instance}`,
        );
    }

    // Validate ODE XML structure (for real ODE format)
    if (parsed.ode && !options?.skipValidation) {
        const validation = validateOdeXml(parsed);
        if (!validation.valid) {
            const errorMsg = formatValidationErrors(validation);
            console.error(`[XmlParser] XML validation failed:\n${errorMsg}`);
            throw new Error(`Invalid ODE XML structure:\n${errorMsg}`);
        }
        if (validation.warnings.length > 0 && options?.strictValidation) {
            const errorMsg = formatValidationErrors(validation);
            console.warn(`[XmlParser] XML validation warnings:\n${errorMsg}`);
            throw new Error(`ODE XML has validation warnings:\n${errorMsg}`);
        }
        if (validation.warnings.length > 0 && DEBUG) {
            console.warn(`[XmlParser] XML validation warnings:\n${formatValidationErrors(validation)}`);
        }
    }

    // Check format and parse accordingly
    if (parsed.ode) {
        if (DEBUG) console.log('[XmlParser] Detected real ODE XML format');
        return parseRealOdeFormat(parsed as RealOdeXmlDocument);
    }

    if (parsed.exe_document) {
        if (DEBUG) console.log('[XmlParser] Detected exe_document XML format');
        return parseExeDocumentFormat(parsed as OdeXmlDocument);
    }

    if (parsed.instance) {
        if (DEBUG) console.log('[XmlParser] Detected legacy instance XML format');
        return legacyParser.parse(parsed as LegacyInstanceXmlDocument, xmlContent, sessionId);
    }

    throw new Error('Invalid ODE XML: Missing ode or exe_document root element');
}

/**
 * Validate ODE XML content without parsing
 * @param xmlContent - XML string to validate
 * @returns Validation result
 */
export function validateXml(xmlContent: string): ValidationResult {
    const parsed = parser.parse(xmlContent);
    return validateOdeXml(parsed);
}

// Re-export formatValidationErrors for convenience
export { formatValidationErrors } from './ode-xml-validator';

/**
 * Parse exe_document format
 */
function parseExeDocumentFormat(parsed: OdeXmlDocument): ParsedOdeStructure {
    const meta = extractMetadata(parsed.exe_document.meta || {});
    const pages = normalizePagesFromNavigation(parsed.exe_document.navigation);

    console.log(`[XmlParser] Parsed ${pages.length} pages from exe_document XML`);

    const raw: RealOdeXmlDocument = { ode: {} };

    return {
        meta,
        pages,
        navigation: parsed.exe_document.navigation,
        raw,
    };
}

/**
 * Parse real ODE format (from actual ELP files)
 */
function parseRealOdeFormat(parsed: RealOdeXmlDocument): ParsedOdeStructure {
    const meta = extractMetadataFromOdeProperties(parsed.ode.odeProperties?.odeProperty || []);

    // Also check userPreferences for theme (overrides odeProperties if found)
    const userPrefs = parsed.ode.userPreferences?.userPreference;
    if (userPrefs) {
        const prefsArray = Array.isArray(userPrefs) ? userPrefs : [userPrefs];
        for (const pref of prefsArray) {
            if (pref.key === 'theme' && pref.value) {
                meta.theme = pref.value;
            }
        }
    }

    const pages = normalizePagesFromOdeNavStructures(parsed.ode.odeNavStructures?.odeNavStructure || []);

    console.log(`[XmlParser] Parsed ${pages.length} pages from real ODE XML`);

    const navigation: OdeXmlNavigation = { page: [] };

    return {
        meta,
        pages,
        navigation,
        raw: parsed,
    };
}

/**
 * Normalized metadata type
 */
interface NormalizedMetadata {
    title: string;
    subtitle: string;
    author: string;
    description: string;
    license: string;
    locale: string;
    theme: string;
    version: string;
    // Export options
    addExeLink?: boolean;
    addPagination?: boolean;
    addSearchBox?: boolean;
    addAccessibilityToolbar?: boolean;
    exportSource?: boolean;
    // Custom content
    extraHeadContent?: string;
    footer?: string;
}

/**
 * Extract metadata from exe_document format
 */
function extractMetadata(meta: OdeXmlMeta): NormalizedMetadata {
    return {
        title: meta.title || 'Untitled',
        subtitle: meta.subtitle || '',
        author: meta.author || '',
        description: meta.description || '',
        license: meta.license || '',
        locale: meta.locale || 'en',
        theme: meta.theme || 'base',
        version: meta.version || '1.0',
    };
}

/**
 * Parse boolean value from string or boolean
 * fast-xml-parser may return booleans for "true"/"false" values
 */
function parseBoolean(value: string | boolean | undefined, defaultValue: boolean): boolean {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
}

/**
 * Extract metadata from odeProperties
 * Note: fast-xml-parser may parse values as boolean/number, so value type is flexible
 */
function extractMetadataFromOdeProperties(
    properties: Array<{ key: string; value: string | boolean | number }>,
): NormalizedMetadata {
    const meta: NormalizedMetadata = {
        title: 'Untitled',
        subtitle: '',
        author: '',
        description: '',
        license: '',
        locale: 'en',
        theme: 'base',
        version: '1.0',
    };

    const propArray = Array.isArray(properties) ? properties : [properties];

    for (const prop of propArray) {
        if (!prop || !prop.key) continue;

        // Ensure key is string (fast-xml-parser may parse numeric/boolean keys)
        const key = String(prop.key).toLowerCase();
        // raw value may be string, boolean, number - convert to string for text fields
        const rawValue = prop.value;
        const stringValue = rawValue !== null && rawValue !== undefined ? String(rawValue) : '';

        if (key === 'pp_title' || (key.includes('title') && !key.includes('subtitle'))) {
            meta.title = stringValue || meta.title;
        } else if (key === 'pp_subtitle' || key.includes('subtitle')) {
            meta.subtitle = stringValue;
        } else if (key.includes('author')) {
            meta.author = stringValue;
        } else if (key.includes('description')) {
            meta.description = stringValue;
        } else if (key.includes('license')) {
            meta.license = stringValue;
        } else if (key.includes('locale') || key.includes('language')) {
            meta.locale = stringValue || meta.locale;
        } else if (key.includes('style') || key.includes('theme')) {
            meta.theme = stringValue || meta.theme;
        }
        // Export options - use rawValue directly for booleans
        else if (key === 'pp_addexelink') {
            meta.addExeLink = parseBoolean(rawValue, true);
        } else if (key === 'pp_addpagination') {
            meta.addPagination = parseBoolean(rawValue, false);
        } else if (key === 'pp_addsearchbox') {
            meta.addSearchBox = parseBoolean(rawValue, false);
        } else if (key === 'pp_addaccessibilitytoolbar') {
            meta.addAccessibilityToolbar = parseBoolean(rawValue, false);
        } else if (key === 'exportsource') {
            meta.exportSource = parseBoolean(rawValue, true);
        }
        // Custom content
        else if (key === 'pp_extraheadcontent') {
            meta.extraHeadContent = stringValue;
        } else if (key === 'footer') {
            meta.footer = stringValue;
        }
    }

    return meta;
}

/**
 * Normalize pages from navigation structure
 */
function normalizePagesFromNavigation(navigation: OdeXmlNavigation): NormalizedPage[] {
    const pages: NormalizedPage[] = [];

    if (!navigation?.page) return pages;

    const pageList = Array.isArray(navigation.page) ? navigation.page : [navigation.page];

    function processPage(page: OdeXmlPage, parentId: string | null, level: number, position: number): void {
        const pageId = page['@_id'] || generateId();

        const components: NormalizedComponent[] = [];
        if (page.component) {
            const compList = Array.isArray(page.component) ? page.component : [page.component];
            compList.forEach((comp, idx) => {
                components.push({
                    id: comp['@_id'] || generateId(),
                    type: comp['@_type'] || 'unknown',
                    order: idx,
                    content: comp.content || '',
                    data: comp.data || {},
                });
            });
        }

        pages.push({
            id: pageId,
            title: page['@_title'] || page.title || 'Untitled',
            level,
            position,
            parent_id: parentId,
            components,
        });

        // Process children
        if (page.page) {
            const children = Array.isArray(page.page) ? page.page : [page.page];
            children.forEach((child, idx) => {
                processPage(child, pageId, level + 1, idx);
            });
        }
    }

    pageList.forEach((page, idx) => {
        processPage(page, null, 0, idx);
    });

    return pages;
}

/**
 * Parse block-level properties from odePagStructureProperties
 */
function parseBlockProperties(props?: {
    odeProperty?: Array<{ key: string; value: string }>;
}): Record<string, string | boolean> {
    const result: Record<string, string | boolean> = {};
    if (!props?.odeProperty) return result;

    const propArray = Array.isArray(props.odeProperty) ? props.odeProperty : [props.odeProperty];
    for (const prop of propArray) {
        if (!prop || !prop.key) continue;
        const key = prop.key;
        const value = prop.value;

        // Parse boolean values
        if (value === 'true' || value === 'false') {
            result[key] = value === 'true';
        } else {
            result[key] = value;
        }
    }
    return result;
}

/**
 * Normalize pages from OdeNavStructures
 */
function normalizePagesFromOdeNavStructures(navStructures: RealOdeNavStructure[]): NormalizedPage[] {
    const pages: NormalizedPage[] = [];
    const navArray = Array.isArray(navStructures) ? navStructures : [navStructures];

    // Build parent map
    const parentMap = new Map<string, string>();
    for (const nav of navArray) {
        if (nav.odeParentPageId) {
            parentMap.set(nav.odePageId, nav.odeParentPageId);
        }
    }

    // Calculate levels
    function getLevel(pageId: string): number {
        let level = 0;
        let current = pageId;
        while (parentMap.has(current)) {
            level++;
            current = parentMap.get(current)!;
        }
        return level;
    }

    for (const nav of navArray) {
        const pageId = nav.odePageId;
        const level = getLevel(pageId);

        // Extract components
        const components: NormalizedComponent[] = [];
        const pagStructures = nav.odePagStructures?.odePagStructure;

        if (pagStructures) {
            const pagArray = Array.isArray(pagStructures) ? pagStructures : [pagStructures];

            for (const pag of pagArray) {
                const odeComponents = pag.odeComponents?.odeComponent;
                if (odeComponents) {
                    const compArray = Array.isArray(odeComponents) ? odeComponents : [odeComponents];

                    // Extract block-level properties
                    const blockProperties = parseBlockProperties(pag.odePagStructureProperties);

                    for (const comp of compArray) {
                        const type = comp.odeIdeviceTypeName || 'unknown';
                        const isJson = isJsonIdevice(type);

                        components.push({
                            id: comp.odeIdeviceId || generateId(),
                            type,
                            order: comp.odeComponentsOrder || 0,
                            // Always use htmlView for content - it contains pre-rendered HTML
                            // JSON iDevices also have htmlView populated with their rendered output
                            content: comp.htmlView || '',
                            data: isJson && comp.jsonProperties ? JSON.parse(comp.jsonProperties) : {},
                            // Include blockName from parent pagStructure for proper block grouping
                            blockName: pag.blockName || '',
                            // Include block icon name for export rendering
                            blockIconName: pag.iconName || '',
                            // Include block ID for proper grouping
                            blockId: pag.odeBlockId || '',
                            // Include block-level properties
                            blockProperties,
                        });
                    }
                }
            }
        }

        pages.push({
            id: pageId,
            title: nav.pageName || 'Untitled',
            level,
            position: nav.odeNavStructureOrder || 0,
            parent_id: nav.odeParentPageId || null,
            components,
        });
    }

    return pages;
}

/**
 * Parse raw XML string
 */
export function parseRawXml(xmlContent: string): unknown {
    return parser.parse(xmlContent);
}

/**
 * Build XML from object
 */
export function buildXml(obj: unknown): string {
    const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        format: true,
        indentBy: '  ',
    });
    return builder.build(obj);
}

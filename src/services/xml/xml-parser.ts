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
import {
    buildXmlKeyToInternalKeyMap,
    getDefaultValue,
    parsePropertyValue,
} from '../../shared/export/metadata-properties';

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
 * Note: Uses same property names as OdeXmlMeta for compatibility
 */
interface NormalizedMetadata {
    title: string;
    subtitle: string;
    author: string;
    description: string;
    license: string;
    language: string; // Uses 'language' to match OdeXmlMeta
    theme: string;
    version: string;
    // Export options
    addExeLink?: boolean;
    addPagination?: boolean;
    addSearchBox?: boolean;
    addAccessibilityToolbar?: boolean;
    addMathJax?: boolean;
    exportSource?: boolean;
    globalFont?: string;
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
        language: meta.language || 'en',
        theme: meta.theme || 'base',
        version: meta.version || '1.0',
    };
}

// Build XML key to internal key map once at module load time
const xmlKeyToInternalKeyMap = buildXmlKeyToInternalKeyMap();

/**
 * Extract metadata from odeProperties using centralized property configuration.
 * Note: fast-xml-parser may parse values as boolean/number, so value type is flexible.
 *
 * The function uses the centralized metadata-properties.ts configuration for:
 * - Mapping XML keys (pp_title, pp_lang, etc.) to internal keys (title, language, etc.)
 * - Determining property types (boolean vs string)
 * - Getting default values
 *
 * Legacy key patterns (e.g., 'author' without 'pp_' prefix) are still supported
 * for backward compatibility with older ELP files.
 */
function extractMetadataFromOdeProperties(
    properties: Array<{ key: string; value: string | boolean | number }>,
): NormalizedMetadata {
    const meta: NormalizedMetadata = {
        title: getDefaultValue('title') as string,
        subtitle: getDefaultValue('subtitle') as string,
        author: getDefaultValue('author') as string,
        description: getDefaultValue('description') as string,
        license: getDefaultValue('license') as string,
        language: getDefaultValue('language') as string,
        theme: getDefaultValue('theme') as string,
        version: '1.0',
    };

    const propArray = Array.isArray(properties) ? properties : [properties];

    for (const prop of propArray) {
        if (!prop || !prop.key) continue;

        // Ensure key is string (fast-xml-parser may parse numeric/boolean keys)
        const xmlKey = String(prop.key).toLowerCase();
        const rawValue = prop.value;

        // First, try exact match using centralized configuration
        const internalKey = xmlKeyToInternalKeyMap.get(xmlKey);
        if (internalKey) {
            // Use centralized parsing based on property type
            const parsedValue = parsePropertyValue(internalKey, rawValue);
            (meta as Record<string, unknown>)[internalKey] = parsedValue;
            continue;
        }

        // Legacy fallback: handle old key patterns for backward compatibility
        // This supports ELP files that may use non-standard key names
        const stringValue = rawValue !== null && rawValue !== undefined ? String(rawValue) : '';

        if (xmlKey.includes('title') && !xmlKey.includes('subtitle')) {
            meta.title = stringValue || meta.title;
        } else if (xmlKey.includes('subtitle')) {
            meta.subtitle = stringValue;
        } else if (xmlKey.includes('author')) {
            meta.author = stringValue;
        } else if (xmlKey.includes('description')) {
            meta.description = stringValue;
        } else if (xmlKey.includes('license') && !xmlKey.includes('url')) {
            meta.license = stringValue;
        } else if (xmlKey.includes('locale') || xmlKey.includes('lang')) {
            meta.language = stringValue || meta.language;
        } else if (xmlKey.includes('style') || xmlKey.includes('theme')) {
            meta.theme = stringValue || meta.theme;
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
 * Extract string content from CDATA wrapper
 * fast-xml-parser with cdataPropName: '__cdata' wraps CDATA content in an object
 * This helper extracts the actual string content from either format.
 *
 * @param value - Can be a plain string, an object with __cdata, or undefined
 * @returns The extracted string content or empty string
 */
function extractCdataContent(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'object' && '__cdata' in (value as Record<string, unknown>)) {
        return String((value as Record<string, unknown>).__cdata || '');
    }
    return '';
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
                        // Read odeIdeviceTypeDirName first to match browser behavior (ElpxImporter.js:583-586)
                        const type = comp.odeIdeviceTypeDirName || comp.odeIdeviceTypeName || 'unknown';
                        const isJson = isJsonIdevice(type);

                        // Extract CDATA content (handles both plain strings and __cdata wrapper objects)
                        const htmlContent = extractCdataContent(comp.htmlView);
                        const jsonPropsStr = extractCdataContent(comp.jsonProperties);

                        components.push({
                            id: comp.odeIdeviceId || generateId(),
                            type,
                            order: comp.odeComponentsOrder || 0,
                            // Always use htmlView for content - it contains pre-rendered HTML
                            // JSON iDevices also have htmlView populated with their rendered output
                            content: htmlContent,
                            data: isJson && jsonPropsStr ? JSON.parse(jsonPropsStr) : {},
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

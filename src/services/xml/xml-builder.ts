/**
 * XML Builder Service for Elysia
 * Builds ODE XML documents from structured data
 */
import { XMLBuilder } from 'fast-xml-parser';
import * as fs from 'fs-extra';
import * as path from 'path';
import { OdeXmlDocument, OdeXmlMeta, OdeXmlNavigation, NormalizedPage, ParsedOdeStructure } from './interfaces';

export interface XmlBuildOptions {
    format?: boolean;
    indentBy?: string;
    suppressEmptyNode?: boolean;
}

// Configure fast-xml-parser builder
const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
    cdataPropName: '__cdata',
    suppressBooleanAttributes: false,
    attributeValueProcessor: (_attrName, attrValue) => String(attrValue),
});

const DEBUG = process.env.APP_DEBUG === '1';

/**
 * Build ODE XML from parsed structure
 */
export function buildFromStructure(structure: ParsedOdeStructure): string {
    if (DEBUG) console.log('[XmlBuilder] Building XML from structure');

    // Build navigation tree from flat pages array
    const navigation = buildNavigationFromPages(structure.pages);

    // Create complete document structure
    const document: OdeXmlDocument = {
        exe_document: {
            meta: structure.meta,
            navigation,
        },
    };

    // Generate XML
    const xml = builder.build(document);

    // Add XML declaration
    const xmlWithDeclaration = `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;

    console.log('[XmlBuilder] Successfully built XML document');
    return xmlWithDeclaration;
}

/**
 * Build navigation tree from flat pages array
 */
function buildNavigationFromPages(pages: NormalizedPage[]): OdeXmlNavigation {
    // Find root pages (level 0 or no parent)
    const rootPages = pages.filter(page => page.level === 0 || page.parent_id === null);

    if (rootPages.length === 0) {
        throw new Error('No root pages found in structure');
    }

    // Build page tree
    const pageTree = rootPages.map(rootPage => buildPageTree(rootPage, pages));

    return {
        page: pageTree.length === 1 ? pageTree[0] : pageTree,
    };
}

/**
 * XML page structure for builder output
 */
interface XmlPageElement {
    '@_id': string;
    '@_title': string;
    component?: unknown;
    page?: unknown;
}

/**
 * Recursively build page tree
 */
function buildPageTree(page: NormalizedPage, allPages: NormalizedPage[]): XmlPageElement {
    // Find child pages
    const children = allPages.filter(p => p.parent_id === page.id).sort((a, b) => a.position - b.position);

    // Build page structure with attributes using @_ prefix
    const xmlPage: XmlPageElement = {
        '@_id': page.id,
        '@_title': page.title,
    };

    // Add components if any
    if (page.components && page.components.length > 0) {
        const components = page.components.map(comp => ({
            '@_type': comp.type,
            '@_id': comp.id,
            '@_position': comp.order || 0,
            content: comp.content || undefined,
            properties: comp.data || undefined,
            data: comp.data || undefined,
        }));

        xmlPage.component = components.length === 1 ? components[0] : components;
    }

    // Add child pages recursively
    if (children.length > 0) {
        const childPages = children.map(child => buildPageTree(child, allPages));
        xmlPage.page = childPages.length === 1 ? childPages[0] : childPages;
    }

    return xmlPage;
}

/**
 * Write XML to file
 */
export async function writeToFile(structure: ParsedOdeStructure, outputPath: string): Promise<string> {
    if (DEBUG) console.log(`[XmlBuilder] Writing XML to file: ${outputPath}`);

    const xml = buildFromStructure(structure);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.ensureDir(outputDir);

    // Write file
    await fs.writeFile(outputPath, xml, 'utf-8');

    console.log(`[XmlBuilder] Successfully wrote XML to ${outputPath}`);
    return outputPath;
}

/**
 * Create default metadata structure
 */
export function createDefaultMetadata(title: string, author: string = ''): OdeXmlMeta {
    return {
        author,
        title,
        description: '',
        language: 'en',
        license: '',
        keywords: '',
        taxonomy: '',
        aggregationLevel: '2',
        structure: 'hierarchical',
        semanticDensity: 'medium',
        difficulty: 'medium',
        typicalLearningTime: '',
        context: '',
        endUser: '',
        interactivityType: 'mixed',
        interactivityLevel: 'medium',
        cognitiveProcess: '',
        intendedEducationalUse: '',
        version: '3.0',
        exelearning_version: '3.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
    };
}

/**
 * Create a simple single-page structure
 */
export function createSimpleStructure(title: string, content: string = ''): ParsedOdeStructure {
    const meta = createDefaultMetadata(title);

    const pages: NormalizedPage[] = [
        {
            id: '0',
            title,
            level: 0,
            parent_id: null,
            position: 0,
            components: [
                {
                    id: 'component_0',
                    type: 'TextComponent',
                    order: 0,
                    content,
                    data: null,
                },
            ],
        },
    ];

    return {
        meta,
        pages,
        navigation: {
            page: {
                id: '0',
                title,
                level: 0,
                component: {
                    id: 'component_0',
                    type: 'TextComponent',
                    content,
                },
            },
        },
        raw: {
            ode: {
                odeProperties: {
                    odeProperty: [{ propertyKey: 'pp_title', propertyValue: title }],
                },
            },
        },
    };
}

/**
 * Build raw XML string from object
 */
export function buildRaw(obj: unknown): string {
    return builder.build(obj);
}

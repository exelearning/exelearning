import { Injectable, Logger } from '@nestjs/common';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import * as fs from 'fs-extra';
import {
    OdeXmlDocument,
    OdeXmlMeta,
    OdeXmlNavigation,
    OdeXmlPage,
    OdeXmlComponent,
    NormalizedPage,
    NormalizedComponent,
    ParsedOdeStructure,
    LegacyXmlFormat,
    RealOdeXmlDocument,
    RealOdeNavStructure,
    RealOdePagStructure,
    RealOdeComponent,
    LegacyInstanceXmlDocument,
    LegacyInstanceNode,
    LegacyValueNode,
    LegacyListNode,
} from '../interfaces/ode-xml.interface';
import { generateId } from '../../../utils/id-generator.util';
import { LegacyXmlParserService } from './legacy-xml-parser.service';

export interface XmlParseOptions {
    preserveOrder?: boolean;
    ignoreAttributes?: boolean;
    parseTagValue?: boolean;
    trimValues?: boolean;
}

@Injectable()
export class XmlParserService {
    private readonly logger = new Logger(XmlParserService.name);
    private readonly parser: XMLParser;

    constructor(private readonly legacyXmlParserService: LegacyXmlParserService) {
        // Configure fast-xml-parser with appropriate options
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseTagValue: true,
            parseAttributeValue: true,
            trimValues: true,
            cdataPropName: '__cdata',
            ignoreDeclaration: true,
            ignorePiTags: true,
            commentPropName: false, // Ignore comments
            allowBooleanAttributes: true,
        });
    }

    /**
     * Parse ODE XML from file
     * @param xmlPath Path to XML file
     * @param sessionId Optional session ID for legacy format path generation
     * @returns Parsed ODE structure
     */
    async parseFromFile(xmlPath: string, sessionId?: string): Promise<ParsedOdeStructure> {
        try {
            this.logger.debug(`Parsing XML file: ${xmlPath}`);

            // Read file content
            if (!(await fs.pathExists(xmlPath))) {
                throw new Error(`XML file not found: ${xmlPath}`);
            }

            const xmlContent = await fs.readFile(xmlPath, 'utf-8');
            return this.parseFromString(xmlContent, sessionId);
        } catch (error) {
            this.logger.error(`Failed to parse XML file: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Parse ODE XML from string
     * @param xmlContent XML content as string
     * @param sessionId Optional session ID for legacy format path generation
     * @returns Parsed ODE structure
     */
    parseFromString(xmlContent: string, sessionId?: string): ParsedOdeStructure {
        try {
            this.logger.debug('Parsing XML from string');

            // Parse XML
            const parsed = this.parser.parse(xmlContent);

            // Debug logging
            this.logger.debug(`Parsed object keys: ${JSON.stringify(Object.keys(parsed))}`);
            this.logger.debug(
                `Has ode: ${!!parsed.ode}, Has exe_document: ${!!parsed.exe_document}, Has instance: ${!!parsed.instance}`,
            );

            // Check if it's the real ODE format
            if (parsed.ode) {
                this.logger.debug('Detected real ODE XML format');
                return this.parseRealOdeFormat(parsed as RealOdeXmlDocument);
            }

            // Check if it's the exe_document format
            if (parsed.exe_document) {
                this.logger.debug('Detected exe_document XML format');
                return this.parseExeDocumentFormat(parsed as OdeXmlDocument);
            }

            // Check if it's the legacy instance format (contentv3.xml)
            if (parsed.instance) {
                this.logger.debug('Detected legacy instance XML format');
                return this.parseLegacyInstanceFormat(
                    parsed as LegacyInstanceXmlDocument,
                    xmlContent,
                    sessionId,
                );
            }

            this.logger.error(
                `XML parsing failed. Object: ${JSON.stringify(parsed, null, 2).substring(0, 500)}`,
            );
            throw new Error('Invalid ODE XML: Missing ode or exe_document root element');
        } catch (error) {
            this.logger.error(`Failed to parse XML string: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Parse exe_document format
     * @param parsed Parsed XML document
     * @returns Parsed ODE structure
     */
    private parseExeDocumentFormat(parsed: OdeXmlDocument): ParsedOdeStructure {
        // Extract metadata
        const meta = this.extractMetadata(parsed.exe_document.meta || {});

        // Extract and normalize pages
        const pages = this.normalizePagesFromNavigation(parsed.exe_document.navigation);

        this.logger.log(`Parsed ${pages.length} pages from exe_document XML`);

        // Create empty raw structure (exe_document format doesn't have raw ODE structure)
        const raw: RealOdeXmlDocument = { ode: {} };

        return {
            meta,
            pages,
            navigation: parsed.exe_document.navigation,
            raw, // Empty raw for exe_document format
        };
    }

    /**
     * Parse real ODE format (from actual ELP files)
     * @param parsed Parsed real ODE document
     * @returns Parsed ODE structure
     */
    private parseRealOdeFormat(parsed: RealOdeXmlDocument): ParsedOdeStructure {
        // Extract metadata from odeProperties
        const meta = this.extractMetadataFromOdeProperties(
            parsed.ode.odeProperties?.odeProperty || [],
        );

        // Extract and normalize pages from odeNavStructures
        const pages = this.normalizePagesFromOdeNavStructures(
            parsed.ode.odeNavStructures?.odeNavStructure || [],
        );

        this.logger.log(`Parsed ${pages.length} pages from real ODE XML`);

        // Create a mock navigation structure for compatibility
        const navigation: OdeXmlNavigation = { page: [] };

        return {
            meta,
            pages,
            navigation,
            raw: parsed, // Preserve raw XML structure for database persistence
        };
    }

    /**
     * Parse legacy instance format (contentv3.xml)
     * @param parsed Parsed legacy instance document
     * @param xmlContent Original XML content
     * @param sessionId Optional session ID for per-iDevice path generation
     * @returns Parsed ODE structure
     */
    private parseLegacyInstanceFormat(
        parsed: LegacyInstanceXmlDocument,
        xmlContent: string,
        sessionId?: string,
    ): ParsedOdeStructure {
        this.logger.debug('Parsing legacy instance format');
        return this.legacyXmlParserService.parse(parsed, xmlContent, sessionId);
    }

    /**
     * Convert normalized pages to RealOdeNavStructure for DB persistence
     */
    private convertPagesToRealOdeNavStructures(pages: NormalizedPage[]): RealOdeNavStructure[] {
        return pages.map((page) => {
            // Convert components to RealOdeComponent
            const odeComponents = {
                odeComponent: page.components.map((comp) => ({
                    odePageId: page.id,
                    odeBlockId: generateId(), // We need a block ID, generate one
                    odeIdeviceId: comp.id,
                    odeIdeviceTypeName: comp.type,
                    htmlView: comp.content,
                    jsonProperties: comp.data ? JSON.stringify(comp.data) : undefined,
                    odeComponentsOrder: comp.order || 1,
                })),
            };

            return {
                odePageId: page.id,
                odeParentPageId: page.parent_id || undefined,
                pageName: page.title,
                odeNavStructureOrder: page.position,
                odePagStructures: {
                    odePagStructure: [
                        {
                            odePageId: page.id,
                            odeBlockId: generateId(),
                            blockName: page.title,
                            odePagStructureOrder: 0,
                            odeComponents:
                                odeComponents.odeComponent.length > 0 ? odeComponents : undefined,
                        },
                    ],
                },
            };
        });
    }

    /**
     * Recursively extract pages from legacy instance structure
     */
    private extractLegacyPages(
        node: LegacyInstanceNode,
        parentId: string | null,
        level: number,
        pages: NormalizedPage[],
    ): void {
        let currentParentId = parentId;
        let currentLevel = level;

        // Check if this is a Node (page)
        if (node['@_class'] === 'exe.engine.node.Node') {
            const pageId = node['@_reference'] || `legacy_page_${pages.length}`;

            // Extract title
            let title = 'Untitled Page';
            if (node.dictionary && node.dictionary.string) {
                // Try to find title by value or context (simplified)
                // In many cases, the title is the first unicode string or associated with 'title' key
                // We'll try to find a unicode value that looks like a title.
                if (node.dictionary.unicode) {
                    const unicodes = Array.isArray(node.dictionary.unicode)
                        ? node.dictionary.unicode
                        : [node.dictionary.unicode];
                    if (unicodes.length > 0) {
                        title = unicodes[0]['@_value'];
                    }
                }
            }

            // Extract components (iDevices)
            const components: NormalizedComponent[] = [];
            if (node.dictionary && node.dictionary.list) {
                const lists = Array.isArray(node.dictionary.list)
                    ? node.dictionary.list
                    : [node.dictionary.list];
                lists.forEach((list) => {
                    if (list.instance) {
                        const instances = Array.isArray(list.instance)
                            ? list.instance
                            : [list.instance];
                        instances.forEach((inst, idx) => {
                            if (inst['@_class'] && inst['@_class'].includes('Idevice')) {
                                components.push({
                                    id: inst['@_reference'] || `legacy_comp_${pageId}_${idx}`,
                                    type: this.mapLegacyIdeviceType(inst['@_class']),
                                    order: idx,
                                    content: this.extractLegacyContent(inst),
                                    data: {},
                                });
                            }
                        });
                    }
                });
            }

            pages.push({
                id: pageId,
                title,
                level,
                parent_id: parentId,
                position: pages.length,
                components,
            });

            // Update parent for children
            currentParentId = pageId;
            currentLevel = level + 1;
        }

        // Recursively search for children in dictionary and list
        if (node.dictionary) {
            // Check direct instances in dictionary
            if (node.dictionary.instance) {
                const instances = Array.isArray(node.dictionary.instance)
                    ? node.dictionary.instance
                    : [node.dictionary.instance];
                instances.forEach((inst) =>
                    this.extractLegacyPages(inst, currentParentId, currentLevel, pages),
                );
            }

            // Check instances in lists within dictionary
            if (node.dictionary.list) {
                const lists = Array.isArray(node.dictionary.list)
                    ? node.dictionary.list
                    : [node.dictionary.list];
                lists.forEach((list) => {
                    if (list.instance) {
                        const instances = Array.isArray(list.instance)
                            ? list.instance
                            : [list.instance];
                        instances.forEach((inst) =>
                            this.extractLegacyPages(inst, currentParentId, currentLevel, pages),
                        );
                    }
                });
            }

            // Check nested dictionaries
            if (node.dictionary.dictionary) {
                // If there are nested dictionaries, we might need to look inside them
                // The structure of nested dictionary in XML is usually <dictionary><dictionary>...</dictionary></dictionary>
                // which fast-xml-parser might map to { dictionary: { dictionary: ... } }
                // However, without a clear type definition of what's inside the nested dictionary,
                // we should check if it contains instances or lists of instances.
                // For now, let's treat it as a potential container of instances if it matches the structure
                const dicts = Array.isArray(node.dictionary.dictionary)
                    ? node.dictionary.dictionary
                    : [node.dictionary.dictionary];
                dicts.forEach((dict) => {
                    if (dict.instance) {
                        const instances = Array.isArray(dict.instance)
                            ? dict.instance
                            : [dict.instance];
                        instances.forEach((inst) =>
                            this.extractLegacyPages(inst, currentParentId, currentLevel, pages),
                        );
                    }
                    if (dict.list) {
                        const lists = Array.isArray(dict.list) ? dict.list : [dict.list];
                        lists.forEach((list) => {
                            if (list.instance) {
                                const instances = Array.isArray(list.instance)
                                    ? list.instance
                                    : [list.instance];
                                instances.forEach((inst) =>
                                    this.extractLegacyPages(
                                        inst,
                                        currentParentId,
                                        currentLevel,
                                        pages,
                                    ),
                                );
                            }
                        });
                    }
                });
            }
        }
    }

    private mapLegacyIdeviceType(legacyClass: string): string {
        if (legacyClass.includes('FreeTextIdevice')) return 'text';
        if (legacyClass.includes('ListIdevice')) return 'list';
        // Add more mappings as needed
        return 'unknown';
    }

    private extractLegacyContent(inst: LegacyInstanceNode): string {
        // Try to find content in dictionary
        if (inst.dictionary && inst.dictionary.unicode) {
            const unicodes = Array.isArray(inst.dictionary.unicode)
                ? inst.dictionary.unicode
                : [inst.dictionary.unicode];
            // Return the longest string as a heuristic for content
            return unicodes.reduce(
                (prev, curr) => (curr['@_value']?.length > prev.length ? curr['@_value'] : prev),
                '',
            );
        }
        return '';
    }

    /**
     * Extract metadata from XML
     * @param metaData Raw metadata object
     * @returns Normalized metadata
     */
    private extractMetadata(metaData: any): OdeXmlMeta {
        return {
            author: String(metaData.author || ''),
            title: String(metaData.title || ''),
            description: String(metaData.description || ''),
            language: String(metaData.language || 'en'),
            license: String(metaData.license || ''),
            keywords: String(metaData.keywords || ''),
            taxonomy: String(metaData.taxonomy || ''),
            aggregationLevel: String(metaData.aggregationLevel || ''),
            structure: String(metaData.structure || ''),
            semanticDensity: String(metaData.semanticDensity || ''),
            difficulty: String(metaData.difficulty || ''),
            typicalLearningTime: String(metaData.typicalLearningTime || ''),
            context: String(metaData.context || ''),
            endUser: String(metaData.endUser || ''),
            interactivityType: String(metaData.interactivityType || ''),
            interactivityLevel: String(metaData.interactivityLevel || ''),
            cognitiveProcess: String(metaData.cognitiveProcess || ''),
            intendedEducationalUse: String(metaData.intendedEducationalUse || ''),
            version:
                metaData.version !== undefined && metaData.version !== null
                    ? typeof metaData.version === 'number'
                        ? metaData.version.toFixed(1) // Convert 3 to "3.0"
                        : String(metaData.version)
                    : '1.0',
            exelearning_version: String(metaData.exelearning_version || ''),
            created: String(metaData.created || new Date().toISOString()),
            modified: String(metaData.modified || new Date().toISOString()),
        };
    }

    /**
     * Normalize pages from navigation tree into flat array
     * @param navigation Navigation structure
     * @returns Array of normalized pages
     */
    private normalizePagesFromNavigation(navigation: OdeXmlNavigation): NormalizedPage[] {
        const pages: NormalizedPage[] = [];

        if (!navigation || !navigation.page) {
            this.logger.warn('Navigation structure is empty');
            return pages;
        }

        // Handle single page or array of pages
        const rootPages = Array.isArray(navigation.page) ? navigation.page : [navigation.page];

        // Recursively process pages
        rootPages.forEach((page, index) => {
            this.processPage(page, null, 0, index, pages);
        });

        return pages;
    }

    /**
     * Recursively process a page and its children
     * @param page Page to process
     * @param parentId Parent page ID
     * @param level Nesting level
     * @param position Position among siblings
     * @param pages Accumulator array
     */
    private processPage(
        page: any,
        parentId: string | null,
        level: number,
        position: number,
        pages: NormalizedPage[],
    ): void {
        // Extract attributes (with @_ prefix from parser)
        // Try @_id first (attribute), then fallback to id (element), then auto-generate
        const pageId =
            page['@_id'] !== undefined
                ? page['@_id']
                : page.id !== undefined
                  ? page.id
                  : `page_${pages.length}`;
        const pageTitle =
            page['@_title'] !== undefined
                ? page['@_title']
                : page.title !== undefined
                  ? page.title
                  : 'Untitled Page';

        // Extract components
        const components = this.extractComponents(page.component);

        // Add current page
        pages.push({
            id: String(pageId),
            title: String(pageTitle),
            level,
            parent_id: parentId,
            position,
            components,
        });

        // Process child pages recursively
        if (page.page) {
            const childPages = Array.isArray(page.page) ? page.page : [page.page];
            childPages.forEach((childPage, index) => {
                this.processPage(childPage, String(pageId), level + 1, index, pages);
            });
        }
    }

    /**
     * Extract components from page
     * @param componentData Component data (single or array)
     * @returns Array of components
     */
    private extractComponents(componentData: any | any[] | undefined): NormalizedComponent[] {
        if (!componentData) {
            return [];
        }

        const components = Array.isArray(componentData) ? componentData : [componentData];

        return components.map((comp, index) => ({
            id: String(
                comp['@_id'] !== undefined
                    ? comp['@_id']
                    : comp.id !== undefined
                      ? comp.id
                      : `component_${index}`,
            ),
            type: String(
                comp['@_type'] !== undefined
                    ? comp['@_type']
                    : comp.type !== undefined
                      ? comp.type
                      : 'unknown',
            ),
            order:
                comp['@_position'] !== undefined
                    ? comp['@_position']
                    : comp.position !== undefined
                      ? comp.position
                      : index,
            position:
                comp['@_position'] !== undefined
                    ? comp['@_position']
                    : comp.position !== undefined
                      ? comp.position
                      : index,
            title: comp.properties?.title || '',
            content: comp.content || '',
            data: comp.data || null,
        }));
    }

    /**
     * Extract metadata from ODE properties array
     * @param properties Array of odeProperty objects
     * @returns Normalized metadata
     */
    private extractMetadataFromOdeProperties(
        properties: Array<{ key: string; value: string }>,
    ): OdeXmlMeta {
        // Convert array to key-value map
        const propsMap = new Map<string, string>();
        properties.forEach((prop) => {
            if (prop.key && prop.value !== undefined) {
                propsMap.set(prop.key, prop.value);
            }
        });

        return {
            author: propsMap.get('pp_author') || '',
            title: propsMap.get('pp_title') || '',
            description: propsMap.get('pp_description') || '',
            language: propsMap.get('pp_lang') || 'en',
            license: propsMap.get('license') || '',
            keywords: propsMap.get('pp_keywords') || '',
            taxonomy: propsMap.get('pp_taxonomy') || '',
            aggregationLevel: '',
            structure: '',
            semanticDensity: '',
            difficulty: '',
            typicalLearningTime: '',
            context: '',
            endUser: '',
            interactivityType: '',
            interactivityLevel: '',
            cognitiveProcess: '',
            intendedEducationalUse: '',
            version: '3.0',
            exelearning_version: '',
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
        };
    }

    /**
     * Normalize pages from ODE nav structures
     * @param navStructures Array of odeNavStructure objects
     * @returns Array of normalized pages
     */
    private normalizePagesFromOdeNavStructures(
        navStructures: RealOdeNavStructure | RealOdeNavStructure[],
    ): NormalizedPage[] {
        const pages: NormalizedPage[] = [];
        const structures = Array.isArray(navStructures) ? navStructures : [navStructures];

        // Build parent-child relationship map
        const childrenMap = new Map<string, RealOdeNavStructure[]>();
        structures.forEach((struct) => {
            const parentId = struct.odeParentPageId || '';
            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, []);
            }
            childrenMap.get(parentId)!.push(struct);
        });

        // Process root structures (no parent)
        const rootStructures = structures.filter(
            (s) => !s.odeParentPageId || s.odeParentPageId === '',
        );

        rootStructures.forEach((struct, index) => {
            this.processOdeNavStructure(struct, null, 0, index, pages, childrenMap);
        });

        return pages;
    }

    /**
     * Process a single ODE nav structure recursively
     * @param structure ODE nav structure
     * @param parentId Parent page ID
     * @param level Nesting level
     * @param position Position among siblings
     * @param pages Accumulator array
     * @param childrenMap Map of parent ID to children
     */
    private processOdeNavStructure(
        structure: RealOdeNavStructure,
        parentId: string | null,
        level: number,
        position: number,
        pages: NormalizedPage[],
        childrenMap: Map<string, RealOdeNavStructure[]>,
    ): void {
        const pageId = structure.odePageId;
        const title = structure.pageName || 'Untitled Page';

        // Extract components from odePagStructures
        const components = this.extractComponentsFromOdePagStructures(
            structure.odePagStructures?.odePagStructure,
        );

        // Add current page
        pages.push({
            id: pageId,
            title,
            level,
            parent_id: parentId,
            position,
            components,
        });

        // Process children
        const children = childrenMap.get(pageId) || [];
        children.forEach((child, index) => {
            this.processOdeNavStructure(child, pageId, level + 1, index, pages, childrenMap);
        });
    }

    /**
     * Extract components from ODE pag structures
     * @param pagStructures odePagStructure or array of them
     * @returns Array of components
     */
    private extractComponentsFromOdePagStructures(
        pagStructures: RealOdePagStructure | RealOdePagStructure[] | undefined,
    ): NormalizedComponent[] {
        if (!pagStructures) {
            return [];
        }

        const structures = Array.isArray(pagStructures) ? pagStructures : [pagStructures];

        const allComponents: NormalizedComponent[] = [];

        structures.forEach((struct) => {
            if (struct.odeComponents) {
                const components = Array.isArray(struct.odeComponents.odeComponent)
                    ? struct.odeComponents.odeComponent
                    : [struct.odeComponents.odeComponent];

                components.forEach((comp, index) => {
                    // Safely parse JSON properties
                    let parsedData = null;
                    if (comp.jsonProperties) {
                        try {
                            parsedData = JSON.parse(comp.jsonProperties);
                        } catch (error) {
                            this.logger.warn(
                                `Failed to parse jsonProperties for component ${index}: ${error.message}`,
                            );
                        }
                    }

                    allComponents.push({
                        id: comp.odeIdeviceId || comp.odeBlockId || `component_${index}`,
                        title: struct.blockName || '',
                        type: comp.odeIdeviceTypeName || 'unknown',
                        blockName: struct.blockName,
                        order: comp.odeComponentsOrder || index,
                        position: comp.odeComponentsOrder || index,
                        content: comp.htmlView || '',
                        data: parsedData,
                    });
                });
            }
        });

        return allComponents;
    }

    /**
     * Detect XML format and version
     * @param xmlContent XML content
     * @returns Format information
     */
    detectFormat(xmlContent: string): LegacyXmlFormat {
        try {
            // Check for ODE format
            if (xmlContent.includes('<exe_document>')) {
                return {
                    version: '3.0',
                    format: 'ode',
                    requiresConversion: false,
                };
            }

            // Check for old EXE format
            if (xmlContent.includes('<content>') && xmlContent.includes('<node>')) {
                return {
                    version: '2.x',
                    format: 'exe_old',
                    requiresConversion: true,
                };
            }

            // Check for instance format
            if (xmlContent.includes('<instance')) {
                return {
                    version: '2.x',
                    format: 'exe_old',
                    requiresConversion: true,
                };
            }

            return {
                version: 'unknown',
                format: 'unknown',
                requiresConversion: true,
            };
        } catch (error) {
            this.logger.error(`Failed to detect format: ${error.message}`);
            return {
                version: 'unknown',
                format: 'unknown',
                requiresConversion: true,
            };
        }
    }

    /**
     * Validate ODE XML structure
     * @param xmlContent XML content
     * @returns True if valid
     */
    async validateOdeXml(xmlContent: string): Promise<boolean> {
        try {
            const parsed = this.parser.parse(xmlContent);

            // Check for real ODE format (preferred)
            if (parsed.ode) {
                // Real ODE format is valid if it has odeNavStructures
                return true;
            }

            // Check for exe_document format (legacy)
            if (parsed.exe_document) {
                if (!parsed.exe_document.navigation) {
                    this.logger.warn('Missing navigation element');
                    return false;
                }

                if (!parsed.exe_document.navigation.page) {
                    this.logger.warn('Missing page elements in navigation');
                    return false;
                }

                return true;
            }

            // Check for legacy instance format
            if (parsed.instance) {
                return true;
            }

            this.logger.warn('Missing ode or exe_document root element');
            return false;
        } catch (error) {
            this.logger.error(`XML validation failed: ${error.message}`);
            return false;
        }
    }
}

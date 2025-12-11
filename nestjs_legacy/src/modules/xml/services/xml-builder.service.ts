import { Injectable, Logger } from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';
import * as fs from 'fs-extra';
import {
    OdeXmlDocument,
    OdeXmlMeta,
    OdeXmlNavigation,
    NormalizedPage,
    ParsedOdeStructure,
} from '../interfaces/ode-xml.interface';

export interface XmlBuildOptions {
    format?: boolean;
    indentBy?: string;
    suppressEmptyNode?: boolean;
}

export interface ComponentIdMapping {
    [oldIdeviceId: string]: string; // old ID -> new ID
}

export interface BuildFromDatabaseResult {
    xml: string;
    componentIdMapping: ComponentIdMapping;
}

/**
 * XmlBuilderService
 *
 * Builds ODE XML documents from structured data.
 *
 * NOTE: With Yjs as the source of truth, the `buildFromDatabaseSession` method
 * has been removed. XML export is now handled client-side from Yjs documents.
 * This service now only provides utility methods for building XML from structures.
 */
@Injectable()
export class XmlBuilderService {
    private readonly logger = new Logger(XmlBuilderService.name);
    private readonly builder: XMLBuilder;

    constructor() {
        // Configure fast-xml-parser builder
        this.builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            format: true,
            indentBy: '  ',
            suppressEmptyNode: true,
            cdataPropName: '__cdata',
            suppressBooleanAttributes: false,
            attributeValueProcessor: (attrName, attrValue) => String(attrValue),
        });
    }

    /**
     * Build ODE XML from parsed structure
     * @param structure Parsed ODE structure
     * @returns XML string
     */
    buildFromStructure(structure: ParsedOdeStructure): string {
        try {
            this.logger.debug('Building XML from structure');

            // Build navigation tree from flat pages array
            const navigation = this.buildNavigationFromPages(structure.pages);

            // Create complete document structure
            const document: OdeXmlDocument = {
                exe_document: {
                    meta: structure.meta,
                    navigation,
                },
            };

            // Generate XML
            const xml = this.builder.build(document);

            // Add XML declaration
            const xmlWithDeclaration = `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;

            this.logger.log('Successfully built XML document');
            return xmlWithDeclaration;
        } catch (error) {
            this.logger.error(`Failed to build XML: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Build navigation tree from flat pages array
     * @param pages Array of normalized pages
     * @returns Navigation structure
     */
    private buildNavigationFromPages(pages: NormalizedPage[]): OdeXmlNavigation {
        // Find root pages (level 0 or no parent)
        const rootPages = pages.filter((page) => page.level === 0 || page.parent_id === null);

        if (rootPages.length === 0) {
            throw new Error('No root pages found in structure');
        }

        // Build page tree
        const pageTree = rootPages.map((rootPage) => this.buildPageTree(rootPage, pages));

        return {
            page: pageTree.length === 1 ? pageTree[0] : pageTree,
        };
    }

    /**
     * Recursively build page tree
     * @param page Current page
     * @param allPages All pages array
     * @returns ODE XML page structure
     */
    private buildPageTree(page: NormalizedPage, allPages: NormalizedPage[]): any {
        // Find child pages
        const children = allPages
            .filter((p) => p.parent_id === page.id)
            .sort((a, b) => a.position - b.position);

        // Build page structure with attributes using @_ prefix
        const xmlPage: any = {
            '@_id': page.id,
            '@_title': page.title,
        };

        // Add components if any
        if (page.components && page.components.length > 0) {
            const components = page.components.map((comp) => ({
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
            const childPages = children.map((child) => this.buildPageTree(child, allPages));
            xmlPage.page = childPages.length === 1 ? childPages[0] : childPages;
        }

        return xmlPage;
    }

    /**
     * Write XML to file
     * @param structure Parsed ODE structure
     * @param outputPath Output file path
     * @returns Promise<string> Path to written file
     */
    async writeToFile(structure: ParsedOdeStructure, outputPath: string): Promise<string> {
        try {
            this.logger.debug(`Writing XML to file: ${outputPath}`);

            // Build XML
            const xml = this.buildFromStructure(structure);

            // Ensure output directory exists
            const outputDir = require('path').dirname(outputPath);
            await fs.ensureDir(outputDir);

            // Write file
            await fs.writeFile(outputPath, xml, 'utf-8');

            this.logger.log(`Successfully wrote XML to ${outputPath}`);
            return outputPath;
        } catch (error) {
            this.logger.error(`Failed to write XML file: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Create default metadata structure
     * @param title Project title
     * @param author Author name
     * @returns Default metadata
     */
    createDefaultMetadata(title: string, author: string = ''): OdeXmlMeta {
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
     * @param title Page title
     * @param content Page content
     * @returns Complete ODE structure
     */
    createSimpleStructure(title: string, content: string = ''): ParsedOdeStructure {
        const meta = this.createDefaultMetadata(title);

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
                        position: 0,
                        content,
                        properties: {},
                        data: null,
                    },
                },
            },
            raw: { ode: {} },
        };
    }

    /**
     * Update metadata in existing structure
     * @param structure Existing structure
     * @param updates Metadata updates
     * @returns Updated structure
     */
    updateMetadata(
        structure: ParsedOdeStructure,
        updates: Partial<OdeXmlMeta>,
    ): ParsedOdeStructure {
        return {
            ...structure,
            meta: {
                ...structure.meta,
                ...updates,
                modified: new Date().toISOString(),
            },
        };
    }
}

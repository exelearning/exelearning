import { Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { YjsPersistenceService } from './yjs-persistence.service';
import { YjsSnapshotService } from './yjs-snapshot.service';
import {
    ParsedOdeStructure,
    OdeXmlMeta,
    NormalizedPage,
    NormalizedComponent,
    RealOdeNavStructure,
    RealOdePagStructure,
    RealOdeComponent,
} from '../../xml/interfaces/ode-xml.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * ElpToYjsService
 * Converts ELP/XML structure to Yjs document format.
 * Creates and persists Yjs documents from parsed ODE structures.
 */
@Injectable()
export class ElpToYjsService {
    private readonly logger = new Logger(ElpToYjsService.name);

    constructor(
        private readonly persistenceService: YjsPersistenceService,
        private readonly snapshotService: YjsSnapshotService,
    ) {}

    /**
     * Convert a parsed ODE structure to a Yjs document and persist it
     * @param projectId The project ID to associate with the document
     * @param parsedOde The parsed ODE structure from XML
     * @returns The encoded Yjs document state
     */
    async createYjsDocumentFromOde(
        projectId: number,
        parsedOde: ParsedOdeStructure,
    ): Promise<Uint8Array> {
        const ydoc = new Y.Doc();

        // Create document structure within a transaction for consistency
        ydoc.transact(() => {
            this.populateMetadata(ydoc, parsedOde.meta);
            this.populateNavigationFromParsed(ydoc, parsedOde);
        }, 'create-from-parsed');

        // Encode and persist
        const state = Y.encodeStateAsUpdate(ydoc);
        await this.persistenceService.storeUpdate(projectId, state, 'system');
        await this.persistenceService.forceFlush(projectId);
        await this.snapshotService.createSnapshot(projectId);

        this.logger.log(
            `Created Yjs document for project ${projectId} with ${parsedOde.pages.length} pages`,
        );

        return state;
    }

    /**
     * Create an empty Yjs document for a new project
     * @param projectId The project ID
     * @param title Optional project title
     * @returns The encoded Yjs document state
     */
    async createEmptyYjsDocument(projectId: number, title?: string): Promise<Uint8Array> {
        const ydoc = new Y.Doc();

        // Create metadata
        const metadata = ydoc.getMap('metadata');
        metadata.set('title', title || 'Untitled document');
        metadata.set('author', '');
        metadata.set('description', '');
        metadata.set('language', 'en');
        metadata.set('license', '');
        metadata.set('createdAt', Date.now());
        metadata.set('modifiedAt', Date.now());

        // Create navigation with a single root page
        const navigation = ydoc.getArray('navigation');
        const rootPageId = uuidv4();
        const rootPage = new Y.Map();
        rootPage.set('id', rootPageId);
        rootPage.set('pageId', rootPageId);
        rootPage.set('title', 'New page');
        rootPage.set('pageName', 'New page');
        rootPage.set('parentId', null);
        rootPage.set('order', 0);
        rootPage.set('blocks', new Y.Array());
        rootPage.set('children', new Y.Array());
        navigation.push([rootPage]);

        // Encode and persist
        const state = Y.encodeStateAsUpdate(ydoc);
        await this.persistenceService.storeUpdate(projectId, state, 'system');
        await this.persistenceService.forceFlush(projectId);
        await this.snapshotService.createSnapshot(projectId);

        this.logger.log(`Created empty Yjs document for project ${projectId}`);

        return state;
    }

    /**
     * Populate metadata in the Yjs document
     */
    private populateMetadata(ydoc: Y.Doc, meta: OdeXmlMeta): void {
        const metadata = ydoc.getMap('metadata');

        metadata.set('title', meta.title || 'Untitled');
        metadata.set('author', meta.author || '');
        metadata.set('description', meta.description || '');
        metadata.set('language', meta.language || 'en');
        metadata.set('license', meta.license || '');
        metadata.set('keywords', meta.keywords || '');
        metadata.set('theme', meta.theme || 'base');
        metadata.set('version', meta.version || '');
        metadata.set('exelearningVersion', meta.exelearning_version || '');
        metadata.set('createdAt', meta.created ? Date.parse(meta.created) : Date.now());
        metadata.set('modifiedAt', meta.modified ? Date.parse(meta.modified) : Date.now());
    }

    /**
     * Populate navigation from parsed ODE structure (using NormalizedPage format)
     */
    private populateNavigationFromParsed(ydoc: Y.Doc, parsedOde: ParsedOdeStructure): void {
        const navigation = ydoc.getArray('navigation');

        // Check if pages already have children populated (hierarchical structure)
        // or if we need to build hierarchy from flat array using parent_id
        const hasPrePopulatedChildren = parsedOde.pages.some(
            (p) => p.children && p.children.length > 0,
        );

        if (hasPrePopulatedChildren) {
            // Pages already have hierarchical structure - use as-is
            for (const page of parsedOde.pages.filter((p) => !p.parent_id)) {
                const yPage = this.createYjsPage(ydoc, page);
                navigation.push([yPage]);
            }
        } else {
            // Build hierarchy from flat pages array using parent_id
            const pageMap = new Map<string, NormalizedPage>();
            for (const page of parsedOde.pages) {
                pageMap.set(page.id, { ...page, children: [] });
            }

            // Populate children arrays based on parent_id
            for (const page of parsedOde.pages) {
                if (page.parent_id) {
                    const parentPage = pageMap.get(page.parent_id);
                    if (parentPage) {
                        parentPage.children = parentPage.children || [];
                        parentPage.children.push(pageMap.get(page.id)!);
                    }
                }
            }

            // Sort children by position/order
            for (const page of pageMap.values()) {
                if (page.children && page.children.length > 0) {
                    page.children.sort((a, b) => (a.position || 0) - (b.position || 0));
                }
            }

            // Add only root pages to navigation
            for (const page of parsedOde.pages.filter((p) => !p.parent_id)) {
                const hierarchicalPage = pageMap.get(page.id)!;
                const yPage = this.createYjsPage(ydoc, hierarchicalPage);
                navigation.push([yPage]);
            }
        }
    }

    /**
     * Create a Yjs page from a normalized page
     */
    private createYjsPage(ydoc: Y.Doc, page: NormalizedPage): Y.Map<any> {
        const yPage = new Y.Map();

        yPage.set('id', page.id);
        yPage.set('pageId', page.id);
        yPage.set('title', page.title);
        yPage.set('pageName', page.title);
        yPage.set('parentId', page.parent_id);
        yPage.set('order', page.position || 0);
        yPage.set('level', page.level || 0);

        // Create blocks array for iDevices
        const blocks = new Y.Array();
        for (const component of page.components) {
            const yBlock = this.createYjsBlock(ydoc, component, page.id);
            blocks.push([yBlock]);
        }
        yPage.set('blocks', blocks);

        // Create children array for nested pages
        const children = new Y.Array();
        if (page.children && page.children.length > 0) {
            for (const childPage of page.children) {
                const yChildPage = this.createYjsPage(ydoc, childPage);
                children.push([yChildPage]);
            }
        }
        yPage.set('children', children);

        return yPage;
    }

    /**
     * Create a Yjs block (iDevice) from a normalized component
     */
    private createYjsBlock(
        ydoc: Y.Doc,
        component: NormalizedComponent,
        pageId: string,
    ): Y.Map<any> {
        const yBlock = new Y.Map();

        const blockId = component.id || uuidv4();
        yBlock.set('id', blockId);
        yBlock.set('blockId', blockId);
        yBlock.set('pageId', pageId);
        yBlock.set('type', component.type);
        yBlock.set('blockName', component.blockName || component.type);
        yBlock.set('order', component.order || component.position || 0);
        yBlock.set('title', component.title || '');

        // Store content as Y.Text for collaborative editing
        const content = new Y.Text();
        if (typeof component.content === 'string') {
            content.insert(0, component.content);
        } else if (component.content) {
            content.insert(0, JSON.stringify(component.content));
        }
        yBlock.set('content', content);

        // Store properties as Y.Map
        const properties = new Y.Map();
        if (component.properties) {
            for (const [key, value] of Object.entries(component.properties)) {
                properties.set(key, value);
            }
        }
        yBlock.set('properties', properties);

        // Store additional data
        if (component.data) {
            yBlock.set('data', JSON.stringify(component.data));
        }

        return yBlock;
    }

    /**
     * Convert raw ODE XML structure (from RealOdeXmlDocument) to Yjs document
     * This handles the actual ELP file format directly
     */
    async createYjsDocumentFromRawOde(
        projectId: number,
        rawOde: any,
        meta: OdeXmlMeta,
    ): Promise<Uint8Array> {
        const ydoc = new Y.Doc();

        // Populate metadata
        this.populateMetadata(ydoc, meta);

        // Get navigation structures from raw ODE
        const navigation = ydoc.getArray('navigation');
        const navStructures = rawOde?.ode?.odeNavStructures?.odeNavStructure;

        if (navStructures) {
            const structures = Array.isArray(navStructures) ? navStructures : [navStructures];

            // Use transaction to ensure Y.Map/Y.Array references are maintained
            ydoc.transact(() => {
                // Build hierarchy map: parentId -> list of child structures
                const childrenMap = new Map<string | null, RealOdeNavStructure[]>();
                for (const navStruct of structures) {
                    const parentId = navStruct.odeParentPageId || null;
                    if (!childrenMap.has(parentId)) {
                        childrenMap.set(parentId, []);
                    }
                    childrenMap.get(parentId)!.push(navStruct);
                }

                // Sort children by order
                for (const children of childrenMap.values()) {
                    children.sort((a, b) => (a.odeNavStructureOrder || 0) - (b.odeNavStructureOrder || 0));
                }

                // Recursively build page with its children (children first, then parent)
                const buildPageWithChildren = (navStruct: RealOdeNavStructure): Y.Map<any> => {
                    const yPage = this.createYjsPageFromNavStructureWithChildren(
                        ydoc,
                        navStruct,
                        childrenMap,
                        buildPageWithChildren,
                    );
                    return yPage;
                };

                // Build and add root pages to navigation
                const rootStructures = childrenMap.get(null) || [];
                for (const rootStruct of rootStructures) {
                    const yPage = buildPageWithChildren(rootStruct);
                    navigation.push([yPage]);
                }
            }, 'create-from-raw');
        }

        // Encode and persist
        const state = Y.encodeStateAsUpdate(ydoc);
        await this.persistenceService.storeUpdate(projectId, state, 'system');
        await this.persistenceService.forceFlush(projectId);
        await this.snapshotService.createSnapshot(projectId);

        this.logger.log(`Created Yjs document from raw ODE for project ${projectId}`);

        return state;
    }

    /**
     * Create a Yjs page from a RealOdeNavStructure with pre-populated children
     * This builds children first, then assigns them to the parent (required by Yjs)
     */
    private createYjsPageFromNavStructureWithChildren(
        ydoc: Y.Doc,
        navStruct: RealOdeNavStructure,
        childrenMap: Map<string | null, RealOdeNavStructure[]>,
        buildPageWithChildren: (navStruct: RealOdeNavStructure) => Y.Map<any>,
    ): Y.Map<any> {
        const yPage = new Y.Map();

        yPage.set('id', navStruct.odePageId);
        yPage.set('pageId', navStruct.odePageId);
        yPage.set('title', navStruct.pageName);
        yPage.set('pageName', navStruct.pageName);
        yPage.set('parentId', navStruct.odeParentPageId || null);
        yPage.set('order', navStruct.odeNavStructureOrder || 0);

        // Create blocks from odePagStructures
        const blocks = new Y.Array();
        const pagStructures = navStruct.odePagStructures?.odePagStructure;

        if (pagStructures) {
            const structures = Array.isArray(pagStructures) ? pagStructures : [pagStructures];

            for (const pagStruct of structures) {
                // Each pagStructure can have multiple components
                const components = pagStruct.odeComponents?.odeComponent;
                if (components) {
                    const comps = Array.isArray(components) ? components : [components];
                    for (const comp of comps) {
                        const yBlock = this.createYjsBlockFromComponent(ydoc, comp, pagStruct);
                        blocks.push([yBlock]);
                    }
                }
            }
        }
        yPage.set('blocks', blocks);

        // Build children array with pre-populated child pages
        // This is the key fix: populate children BEFORE assigning to parent
        const children = new Y.Array();
        const childStructures = childrenMap.get(navStruct.odePageId) || [];
        for (const childStruct of childStructures) {
            const yChildPage = buildPageWithChildren(childStruct);
            children.push([yChildPage]);
        }
        yPage.set('children', children);

        return yPage;
    }

    /**
     * Create a Yjs block from a RealOdeComponent
     */
    private createYjsBlockFromComponent(
        ydoc: Y.Doc,
        comp: RealOdeComponent,
        pagStruct: RealOdePagStructure,
    ): Y.Map<any> {
        const yBlock = new Y.Map();

        const blockId = comp.odeBlockId || pagStruct.odeBlockId || uuidv4();
        yBlock.set('id', blockId);
        yBlock.set('blockId', blockId);
        yBlock.set('pageId', comp.odePageId);
        yBlock.set('ideviceId', comp.odeIdeviceId || '');
        yBlock.set('type', comp.odeIdeviceTypeName || 'unknown');
        yBlock.set('blockName', pagStruct.blockName || comp.odeIdeviceTypeName || '');
        yBlock.set('iconName', pagStruct.iconName || '');
        yBlock.set('order', comp.odeComponentsOrder || pagStruct.odePagStructureOrder || 0);

        // Store HTML content as Y.Text
        const content = new Y.Text();
        if (comp.htmlView) {
            content.insert(0, comp.htmlView);
        }
        yBlock.set('content', content);

        // Store JSON properties
        if (comp.jsonProperties) {
            try {
                const props = JSON.parse(comp.jsonProperties);
                const properties = new Y.Map();
                for (const [key, value] of Object.entries(props)) {
                    properties.set(key, value);
                }
                yBlock.set('properties', properties);
            } catch (e) {
                yBlock.set('jsonProperties', comp.jsonProperties);
            }
        }

        return yBlock;
    }
}

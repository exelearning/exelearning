import { Injectable, Logger } from '@nestjs/common';
import {
    ParsedOdeStructure,
    OdeXmlMeta,
    NormalizedPage,
    NormalizedComponent,
    LegacyInstanceXmlDocument,
    LegacyInstanceNode,
} from '../interfaces/ode-xml.interface';
import { generateId } from '../../../utils/id-generator.util';

@Injectable()
export class LegacyXmlParserService {
    private readonly logger = new Logger(LegacyXmlParserService.name);
    private xmlContent: string; // Store original XML for xpath-like queries
    private parentRefMap: Map<string, string | null> = new Map(); // nodeRef -> parentRef
    private srcRoutes: string[] = []; // Track all resource paths for file copying
    private sessionId: string = ''; // Current session ID for path generation

    public parse(
        parsed: LegacyInstanceXmlDocument,
        xmlContent?: string,
        sessionId?: string,
    ): ParsedOdeStructure {
        this.logger.debug('Parsing legacy instance format using LegacyXmlParserService');
        this.xmlContent = xmlContent || '';
        this.sessionId = sessionId || '';
        this.srcRoutes = []; // Reset for each parse

        // Build parent reference map from XML before processing nodes
        this.buildParentReferenceMap();

        // 1. Find all pages (Nodes)
        const allNodes = this.findAllNodes(parsed.instance);
        this.logger.debug(`Found ${allNodes.length} legacy nodes`);

        // 2. Extract Metadata
        const meta = this.extractMetadata(parsed.instance);

        // 3. Build Page Hierarchy
        const pages = this.buildPageHierarchy(allNodes);

        // 4. Convert to Raw Structure (for persistence)
        const navStructures = this.convertPagesToRealOdeNavStructures(pages);
        const raw = {
            ode: {
                odeNavStructures: {
                    odeNavStructure: navStructures,
                },
                odeProperties: {
                    odeProperty: [
                        { key: 'pp_title', value: meta.title },
                        { key: 'pp_author', value: meta.author },
                        { key: 'pp_description', value: meta.description },
                    ],
                },
            },
        };

        // Build navigation object for compatibility
        const navigation = {
            page: pages, // Use the normalized pages
        };

        this.logger.debug(`Collected ${this.srcRoutes.length} resource paths for copying`);

        return {
            meta,
            pages,
            navigation,
            raw,
            srcRoutes: this.srcRoutes,
        };
    }

    /**
     * Build a map of nodeRef -> parentRef by extracting all node declarations
     * and their parent relationships from the raw XML
     */
    private buildParentReferenceMap(): void {
        if (!this.xmlContent) {
            return;
        }

        // Find ALL node declarations in the XML
        // Pattern: <instance class="exe.engine.node.Node" reference="X">
        const nodePattern =
            /<instance[^>]*class="exe\.engine\.node\.Node"[^>]*reference="(\d+)"[^>]*>/g;
        const nodes: Array<{ ref: string; startIndex: number }> = [];

        let match;
        while ((match = nodePattern.exec(this.xmlContent)) !== null) {
            nodes.push({
                ref: match[1],
                startIndex: match.index,
            });
        }

        this.logger.debug(`Found ${nodes.length} node declarations in XML`);

        // For each node, find its parent declaration
        for (const node of nodes) {
            // Search forward from this node's start position
            const searchStart = node.startIndex;
            const searchEnd = Math.min(searchStart + 100000, this.xmlContent.length);
            const searchRegion = this.xmlContent.slice(searchStart, searchEnd);

            // Look for: <string role="key" value="parent"></string> followed by value
            const parentPattern =
                /<string[^>]*role="key"[^>]*value="parent"[^>]*><\/string>\s*(?:<none><\/none>|<reference[^>]*key="(\d+)"[^>]*>|<instance[^>]*class="exe\.engine\.node\.Node"[^>]*reference="(\d+)"[^>]*>)/;
            const parentMatch = parentPattern.exec(searchRegion);

            if (parentMatch) {
                // Check if it's <none/> (group 0 contains <none>)
                if (parentMatch[0].includes('<none>')) {
                    this.parentRefMap.set(node.ref, null);
                    this.logger.debug(`  Node ${node.ref}: parent = null (root)`);
                } else if (parentMatch[1]) {
                    // <reference key="X"/>
                    this.parentRefMap.set(node.ref, parentMatch[1]);
                    this.logger.debug(`  Node ${node.ref}: parent = ${parentMatch[1]} (reference)`);
                } else if (parentMatch[2]) {
                    // <instance ... reference="X">
                    this.parentRefMap.set(node.ref, parentMatch[2]);
                    this.logger.debug(`  Node ${node.ref}: parent = ${parentMatch[2]} (instance)`);
                }
            } else {
                this.logger.warn(`  Node ${node.ref}: parent declaration not found`);
            }
        }
    }

    /**
     * Generate session-based path for a given iDevice
     * Format: files/tmp/YYYY/MM/DD/sessionId/ideviceId/
     */
    private getSessionPath(ideviceId: string): string {
        if (!this.sessionId || this.sessionId.length < 8) {
            this.logger.warn('Session ID too short or missing, using fallback path');
            return `files/tmp/session/${ideviceId}/`;
        }

        // Extract date from sessionId (format: YYYYMMDDHHMMSSXXXXX)
        const year = this.sessionId.substring(0, 4);
        const month = this.sessionId.substring(4, 6);
        const day = this.sessionId.substring(6, 8);

        return `files/tmp/${year}/${month}/${day}/${this.sessionId}/${ideviceId}/`;
    }

    /**
     * Extract image src paths from HTML content
     */
    private extractImagePaths(html: string): string[] {
        const imagePaths: string[] = [];

        // Match img src attributes with resources/
        const imgRegex = /<img[^>]+src=["']resources\/([^"']+)["']/g;
        let match;

        while ((match = imgRegex.exec(html)) !== null) {
            imagePaths.push(`resources/${match[1]}`);
        }

        return imagePaths;
    }

    private findAllNodes(root: LegacyInstanceNode): LegacyInstanceNode[] {
        const nodes: LegacyInstanceNode[] = [];
        this.traverseForNodes(root, nodes);
        this.logger.debug(`Found ${nodes.length} nodes total`);
        nodes.forEach((n) => {
            this.logger.debug(`  Node reference: ${n['@_reference']}`);
        });
        return nodes;
    }

    private traverseForNodes(node: any, nodes: LegacyInstanceNode[]) {
        if (!node) return;

        // If array, traverse each item
        if (Array.isArray(node)) {
            node.forEach((item) => this.traverseForNodes(item, nodes));
            return;
        }

        // If object, check if it's a Node
        if (typeof node === 'object') {
            if (node['@_class'] === 'exe.engine.node.Node') {
                nodes.push(node);
            }

            // Traverse children (dictionary, list, instance)
            const keys = Object.keys(node);
            for (const key of keys) {
                if (key === 'dictionary' || key === 'list' || key === 'instance') {
                    this.traverseForNodes(node[key], nodes);
                }
            }
        }
    }

    private extractMetadata(root: LegacyInstanceNode): OdeXmlMeta {
        // Extract metadata from the root package dictionary
        let title = 'Legacy Project';
        let author = '';
        let description = '';

        if (!root.dictionary) {
            this.logger.debug('No dictionary found in root');
            return { title, author, description };
        }

        // fast-xml-parser groups elements by tag name, losing original order
        // We need to find specific keys and their associated values
        // Strategy: search for the key string, then count to find matching value
        const dict = root.dictionary;

        const strings = Array.isArray(dict.string) ? dict.string : dict.string ? [dict.string] : [];
        const unicodes = Array.isArray(dict.unicode)
            ? dict.unicode
            : dict.unicode
              ? [dict.unicode]
              : [];

        // Build a map of key -> value index
        // Count how many unicode values appear before each key
        let unicodeIndex = 0;
        for (const str of strings) {
            if (str['@_role'] === 'key' && str['@_value']) {
                const key = str['@_value'];

                // The value is the next unicode in the original order
                // We need to count based on the original XML order
                // For now, we'll use a simple heuristic: look for the unicode at the same index
                if (key === '_title' && unicodes.length > unicodeIndex) {
                    const value = unicodes[unicodeIndex]['@_value'];
                    if (typeof value === 'string') {
                        title = value;
                    }
                    unicodeIndex++;
                } else if (key === '_author' && unicodes.length > unicodeIndex) {
                    // Skip non-unicode values in between (like lists, bools, etc.)
                    // Count back from strings to find the right unicode
                    // Actually, let's search through all unicodes for matching pattern
                    for (let i = 0; i < unicodes.length; i++) {
                        const val = unicodes[i]['@_value'];
                        // Look for a value that looks like an author name (has spaces and capital letters)
                        if (
                            typeof val === 'string' &&
                            val.includes(' ') &&
                            /[A-Z]/.test(val) &&
                            val !== title
                        ) {
                            author = val;
                            break;
                        }
                    }
                } else if (key === '_description' && unicodes.length > unicodeIndex) {
                    // Similar approach for description
                    for (let i = 0; i < unicodes.length; i++) {
                        const val = unicodes[i]['@_value'];
                        // Look for a longer text that's not title or author
                        if (
                            typeof val === 'string' &&
                            val.length > 20 &&
                            val !== title &&
                            val !== author
                        ) {
                            description = val;
                            break;
                        }
                    }
                }
            }
        }

        this.logger.debug(
            `Extracted metadata: title="${title}", author="${author}", description="${description}"`,
        );
        return { title, author, description };
    }

    private buildPageHierarchy(nodes: LegacyInstanceNode[]): NormalizedPage[] {
        const pageMap = new Map<string, NormalizedPage>();
        const parentMap = new Map<string, string>(); // childRef -> parentRef
        const rootPages: NormalizedPage[] = [];

        // 1. Create NormalizedPage for each node
        nodes.forEach((node, index) => {
            const ref = node['@_reference'];
            if (!ref) return;

            const refStr = String(ref); // Ensure string type for consistency

            const page: NormalizedPage = {
                id: refStr, // Use reference as ID initially
                title: this.extractNodeTitle(node),
                components: this.extractNodeComponents(node),
                children: [],
                level: 0, // Will be calculated after hierarchy is built
                parent_id: null, // Will be set after hierarchy is built
                position: index, // Temporary position, will be recalculated
            };
            pageMap.set(refStr, page);

            // Find parent reference
            const parentRef = this.findParentReference(node);
            this.logger.debug(`Page ${refStr} (${page.title}): parentRef = ${parentRef}`);

            if (parentRef) {
                parentMap.set(refStr, String(parentRef));
            }
        });

        // 2. Link children to parents and set parent_id
        this.logger.debug(`parentMap has ${parentMap.size} entries`);

        pageMap.forEach((page, ref) => {
            const parentRef = parentMap.get(ref);
            if (parentRef && pageMap.has(parentRef)) {
                const parent = pageMap.get(parentRef);
                parent.children.push(page);
                page.parent_id = parent.id; // Set parent_id
                this.logger.debug(
                    `Linked ${page.title} (${ref}) to parent ${parent.title} (${parentRef})`,
                );
            } else {
                rootPages.push(page);
                page.parent_id = null; // Root pages have no parent
                if (parentRef) {
                    this.logger.warn(
                        `Parent ${parentRef} not found for page ${page.title} (${ref})`,
                    );
                }
            }
        });

        // 3. Flatten the tree into a single array with correct levels and positions
        const flatPages: NormalizedPage[] = [];
        this.flattenPageTree(rootPages, flatPages, 0);

        return flatPages;
    }

    /**
     * Recursively flatten page tree into array, setting levels and positions
     */
    private flattenPageTree(
        pages: NormalizedPage[],
        result: NormalizedPage[],
        level: number,
    ): void {
        pages.forEach((page, index) => {
            page.level = level;
            page.position = result.length; // Global position in flat array

            result.push(page);

            // Process children recursively
            if (page.children && page.children.length > 0) {
                this.flattenPageTree(page.children, result, level + 1);
            }
        });
    }

    private extractNodeTitle(node: LegacyInstanceNode): string {
        // Logic to extract title from node dictionary
        // PHP: $node->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");
        if (node.dictionary) {
            const dict = node.dictionary;
            const strings = Array.isArray(dict.string)
                ? dict.string
                : dict.string
                  ? [dict.string]
                  : [];
            const unicodes = Array.isArray(dict.unicode)
                ? dict.unicode
                : dict.unicode
                  ? [dict.unicode]
                  : [];

            // Find the _title key
            const titleKeyIndex = strings.findIndex(
                (str) => str['@_role'] === 'key' && str['@_value'] === '_title',
            );

            // If found, get the first unicode (which should be the title)
            if (titleKeyIndex !== -1 && unicodes.length > 0) {
                const value = unicodes[0]['@_value'];
                if (typeof value === 'string' && value.trim()) {
                    return value;
                }
            }
        }
        return 'Untitled';
    }

    private findParentReference(node: LegacyInstanceNode): string | null {
        // Use the pre-built parent reference map
        const nodeRef = node['@_reference'];
        if (!nodeRef) {
            return null;
        }

        return this.parentRefMap.get(String(nodeRef)) || null;
    }

    private extractNodeComponents(node: LegacyInstanceNode): NormalizedComponent[] {
        const components: NormalizedComponent[] = [];

        if (!node.dictionary) {
            return components;
        }

        const dict = node.dictionary;

        // fast-xml-parser groups by tag name
        // Look for "idevices" key in the strings array
        const strings = Array.isArray(dict.string) ? dict.string : dict.string ? [dict.string] : [];
        const lists = Array.isArray(dict.list) ? dict.list : dict.list ? [dict.list] : [];

        // Find index of "idevices" key
        const idevicesKeyIndex = strings.findIndex(
            (str) => str['@_role'] === 'key' && str['@_value'] === 'idevices',
        );

        if (idevicesKeyIndex === -1 || lists.length === 0) {
            return components;
        }

        // The list corresponding to "idevices" key
        // Usually it's at the same relative position or we need to find it
        // For simplicity, let's look for the first list with instances
        for (const list of lists) {
            if (list.instance) {
                const instances = Array.isArray(list.instance) ? list.instance : [list.instance];

                for (const idevice of instances) {
                    // Check if it's an iDevice (not a Node)
                    if (idevice['@_class'] && idevice['@_class'].includes('Idevice')) {
                        const component = this.extractIdeviceComponent(idevice);
                        if (component) {
                            components.push(component);
                        }
                    }
                }

                // Found idevices list, break
                if (components.length > 0) {
                    break;
                }
            }
        }

        return components;
    }

    private extractIdeviceComponent(idevice: any): NormalizedComponent | null {
        const ideviceClass = idevice['@_class'];

        // Check if it's a JsIdevice
        if (ideviceClass !== 'exe.engine.jsidevice.JsIdevice') {
            this.logger.debug(`Skipping non-JsIdevice: ${ideviceClass}`);
            return null;
        }

        if (!idevice.dictionary) {
            return null;
        }

        const dict = idevice.dictionary;
        const strings = Array.isArray(dict.string) ? dict.string : dict.string ? [dict.string] : [];
        const unicodes = Array.isArray(dict.unicode)
            ? dict.unicode
            : dict.unicode
              ? [dict.unicode]
              : [];
        const lists = Array.isArray(dict.list) ? dict.list : dict.list ? [dict.list] : [];

        let ideviceType = 'text';
        let ideviceId = '';
        let blockName = '';
        let htmlContent = '';

        // Extract _iDeviceDir (type)
        const iDeviceDirIdx = strings.findIndex(
            (s) => s['@_role'] === 'key' && s['@_value'] === '_iDeviceDir',
        );
        if (iDeviceDirIdx !== -1 && strings.length > iDeviceDirIdx + 1) {
            // Next string value should be the dir
            const nextString = strings[iDeviceDirIdx + 1];
            if (nextString && nextString['@_value']) {
                ideviceType = nextString['@_value'];
            }
        }

        // Extract id
        const idIdx = strings.findIndex((s) => s['@_role'] === 'key' && s['@_value'] === 'id');
        if (idIdx !== -1 && unicodes.length > 0) {
            // Find corresponding unicode
            for (const unicode of unicodes) {
                const val = unicode['@_value'];
                if (typeof val === 'string' && /^\d+$/.test(val)) {
                    ideviceId = val;
                    break;
                }
            }
        }

        // Extract _title (blockName)
        const titleIdx = strings.findIndex(
            (s) => s['@_role'] === 'key' && s['@_value'] === '_title',
        );
        if (titleIdx !== -1 && unicodes.length > 0) {
            const val = unicodes[0]['@_value'];
            if (typeof val === 'string') {
                blockName = val;
            }
        }

        // Extract fields (content)
        const fieldsIdx = strings.findIndex(
            (s) => s['@_role'] === 'key' && s['@_value'] === 'fields',
        );
        if (fieldsIdx !== -1 && lists.length > 0) {
            // Find the list with field instances
            for (const list of lists) {
                if (list.instance) {
                    htmlContent = this.extractFieldContent(list);
                    if (htmlContent) break;
                }
            }
        }

        // Generate component ID if not found
        if (!ideviceId) {
            ideviceId = generateId();
        }

        // Replace resources/ paths with per-iDevice session paths
        let updatedContent = htmlContent;
        if (htmlContent && this.sessionId) {
            const sessionPath = this.getSessionPath(ideviceId);

            // Replace all resources/ with full session path
            updatedContent = htmlContent.replace(/resources\//g, sessionPath);

            // Extract image paths and add to srcRoutes for file copying
            const imagePaths = this.extractImagePaths(htmlContent);
            imagePaths.forEach((imgPath) => {
                // Convert resources/image.png -> files/tmp/.../sessionId/ideviceId/image.png
                const filename = imgPath.replace('resources/', '');
                const fullPath = sessionPath + filename;
                if (!this.srcRoutes.includes(fullPath)) {
                    this.srcRoutes.push(fullPath);
                }
            });
        }

        return {
            id: ideviceId,
            title: blockName,
            type: ideviceType,
            content: updatedContent,
            blockName,
            order: 1,
        };
    }

    private extractFieldContent(fieldList: any): string {
        const instances = fieldList.instance;
        if (!instances) {
            return '';
        }

        const fieldArray = Array.isArray(instances) ? instances : [instances];

        for (const field of fieldArray) {
            // Check if it's a TextAreaField
            const fieldClass = field['@_class'];
            if (fieldClass === 'exe.engine.field.TextAreaField' && field.dictionary) {
                const dict = field.dictionary;
                const strings = Array.isArray(dict.string)
                    ? dict.string
                    : dict.string
                      ? [dict.string]
                      : [];
                const unicodes = Array.isArray(dict.unicode)
                    ? dict.unicode
                    : dict.unicode
                      ? [dict.unicode]
                      : [];

                // Look for content_w_resourcePaths key
                const contentKeyIdx = strings.findIndex(
                    (s) => s['@_role'] === 'key' && s['@_value'] === 'content_w_resourcePaths',
                );

                if (contentKeyIdx !== -1 && unicodes.length > 0) {
                    // Find the unicode with @_content="true" (the HTML content)
                    for (const unicode of unicodes) {
                        if (unicode['@_content'] === 'true' || unicode['@_content'] === true) {
                            const value = unicode['@_value'];
                            if (typeof value === 'string' && value.trim()) {
                                return value;
                            }
                        }
                    }

                    // Fallback: if no @_content="true", try first unicode
                    const value = unicodes[0]['@_value'];
                    if (typeof value === 'string' && value.trim()) {
                        return value;
                    }
                }
            }
        }

        return '';
    }

    private convertPagesToRealOdeNavStructures(pages: NormalizedPage[]): any[] {
        const result: any[] = [];

        // Process each page and its children recursively
        pages.forEach((page, index) => {
            this.convertPageToNavStructure(page, null, index + 1, result);
        });

        return result;
    }

    private convertPageToNavStructure(
        page: NormalizedPage,
        parentId: string | null,
        order: number,
        result: any[],
    ): void {
        // Convert components to blocks and components structure
        const odePagStructures: any[] = [];

        page.components.forEach((comp, compIndex) => {
            const blockId = generateId();

            odePagStructures.push({
                odePageId: page.id,
                odeBlockId: blockId,
                blockName: comp.blockName || '',
                odePagStructureSyncOrder: compIndex + 1,
                odeComponents: {
                    odeComponent: [
                        {
                            odePageId: page.id,
                            odeBlockId: blockId,
                            odeIdeviceId: comp.id,
                            odeIdeviceTypeName: comp.type,
                            htmlView: comp.content,
                            jsonProperties: comp.data ? JSON.stringify(comp.data) : undefined,
                            odeComponentsOrder: comp.order || 1,
                        },
                    ],
                },
            });
        });

        // Create nav structure
        const navStructure: any = {
            odePageId: page.id,
            odeParentPageId: parentId || undefined,
            pageName: page.title,
            odeNavStructureOrder: order,
        };

        if (odePagStructures.length > 0) {
            navStructure.odePagStructures = {
                odePagStructure: odePagStructures,
            };
        }

        result.push(navStructure);

        // Process children recursively
        if (page.children && page.children.length > 0) {
            page.children.forEach((child, childIndex) => {
                this.convertPageToNavStructure(child, page.id, childIndex + 1, result);
            });
        }
    }
}

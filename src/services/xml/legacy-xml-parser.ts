/**
 * Legacy XML Parser for contentv3.xml (eXe 2.x format)
 * Simplified version for Elysia migration
 */
import {
    ParsedOdeStructure,
    NormalizedPage,
    NormalizedComponent,
    LegacyInstanceXmlDocument,
    LegacyInstanceNode,
    RealOdeNavStructure,
} from './interfaces';
import { generateId } from '../../utils/id-generator.util';

const DEBUG = process.env.APP_DEBUG === '1';

// State for current parsing session
let xmlContent = '';
let parentRefMap = new Map<string, string | null>();
let srcRoutes: string[] = [];
let sessionId = '';

/**
 * Parse legacy instance format (contentv3.xml)
 */
export function parse(
    parsed: LegacyInstanceXmlDocument,
    rawXmlContent?: string,
    currentSessionId?: string,
): ParsedOdeStructure {
    if (DEBUG) console.log('[LegacyParser] Parsing legacy instance format');

    xmlContent = rawXmlContent || '';
    sessionId = currentSessionId || '';
    srcRoutes = [];
    parentRefMap = new Map();

    // Build parent reference map from parsed structure
    buildParentReferenceMap(parsed.instance);

    // Find all nodes
    const allNodes = findAllNodes(parsed.instance);
    if (DEBUG) console.log(`[LegacyParser] Found ${allNodes.length} legacy nodes`);

    // Extract metadata
    const meta = extractMetadata(parsed.instance);

    // Build page hierarchy
    const pages = buildPageHierarchy(allNodes);

    // Convert to raw structure
    const navStructures = convertPagesToRealOdeNavStructures(pages);
    const raw = {
        ode: {
            odeNavStructures: {
                odeNavStructure: navStructures,
            },
            odeProperties: {
                odeProperty: [
                    { propertyKey: 'pp_title', propertyValue: meta.title },
                    { propertyKey: 'pp_author', propertyValue: meta.author },
                    { propertyKey: 'pp_description', propertyValue: meta.description },
                ],
            },
        },
    };

    const navigation = { page: pages };

    if (DEBUG) console.log(`[LegacyParser] Collected ${srcRoutes.length} resource paths`);

    return {
        meta,
        pages,
        navigation,
        raw,
        srcRoutes,
    };
}

function buildParentReferenceMap(instance: any): void {
    parentRefMap = new Map();

    function traverse(obj: any, parentRef: string | null): void {
        if (!obj || typeof obj !== 'object') return;

        // If this is a Node, record its parent
        if (obj['@_class'] === 'exe.engine.node.Node') {
            const ref = obj['@_reference'];
            if (ref) {
                parentRefMap.set(ref, parentRef);
            }
            // Its children will have this node as parent
            parentRef = ref || parentRef;
        }

        // Recurse into arrays and objects
        if (Array.isArray(obj)) {
            obj.forEach((item) => traverse(item, parentRef));
        } else {
            Object.values(obj).forEach((val) => traverse(val, parentRef));
        }
    }

    traverse(instance, null);
}

function findAllNodes(instance: any): LegacyInstanceNode[] {
    const nodes: LegacyInstanceNode[] = [];

    function traverse(obj: any): void {
        if (!obj || typeof obj !== 'object') return;

        if (obj['@_class'] === 'exe.engine.node.Node') {
            nodes.push(obj);
        }

        // Recurse into arrays
        if (Array.isArray(obj)) {
            obj.forEach(traverse);
        } else {
            Object.values(obj).forEach(traverse);
        }
    }

    traverse(instance);
    return nodes;
}

function extractMetadata(instance: any): Record<string, any> {
    const meta: Record<string, any> = {
        title: 'Untitled',
        author: '',
        description: '',
        license: '',
        locale: 'en',
        theme: 'base',
        version: '1.0',
    };

    function findValue(obj: any, key: string): string | undefined {
        if (!obj || typeof obj !== 'object') return undefined;

        if (obj.string && obj.unicode) {
            const strings = Array.isArray(obj.string) ? obj.string : [obj.string];
            const unicodes = Array.isArray(obj.unicode) ? obj.unicode : [obj.unicode];

            for (let i = 0; i < strings.length; i++) {
                if (strings[i] === key && unicodes[i]) {
                    return unicodes[i]['@_value'] || unicodes[i];
                }
            }
        }

        for (const v of Object.values(obj)) {
            const found = findValue(v, key);
            if (found) return found;
        }

        return undefined;
    }

    // Try to find title
    const title = findValue(instance, 'title') || findValue(instance, '_title');
    if (title) meta.title = title;

    const author = findValue(instance, 'author') || findValue(instance, '_author');
    if (author) meta.author = author;

    return meta;
}

function buildPageHierarchy(nodes: LegacyInstanceNode[]): NormalizedPage[] {
    const pages: NormalizedPage[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const pageId = node['@_reference'] || generateId();

        // Extract title
        let title = 'Untitled Page';
        if (node.dictionary?.unicode) {
            const unicodes = Array.isArray(node.dictionary.unicode)
                ? node.dictionary.unicode
                : [node.dictionary.unicode];
            if (unicodes.length > 0 && unicodes[0]?.['@_value']) {
                title = unicodes[0]['@_value'];
            }
        }

        // Extract components (iDevices)
        const components = extractComponents(node, pageId);

        // Get parent from map
        const parentId = parentRefMap.get(pageId) || null;

        // Calculate level based on parent chain
        let level = 0;
        let current = parentId;
        while (current && level < 10) {
            level++;
            current = parentRefMap.get(current) || null;
        }

        pages.push({
            id: pageId,
            title,
            level,
            position: i,
            parent_id: parentId,
            components,
        });
    }

    return pages;
}

function extractComponents(node: LegacyInstanceNode, pageId: string): NormalizedComponent[] {
    const components: NormalizedComponent[] = [];

    if (!node.dictionary?.list) return components;

    const lists = Array.isArray(node.dictionary.list)
        ? node.dictionary.list
        : [node.dictionary.list];

    for (const list of lists) {
        if (!list.instance) continue;

        const instances = Array.isArray(list.instance)
            ? list.instance
            : [list.instance];

        for (let idx = 0; idx < instances.length; idx++) {
            const inst = instances[idx];
            if (!inst['@_class']?.includes('Idevice')) continue;

            const content = extractIdeviceContent(inst);
            const resourcePaths = extractResourcePaths(inst);
            srcRoutes.push(...resourcePaths);

            components.push({
                id: inst['@_reference'] || generateId(),
                type: mapIdeviceType(inst['@_class']),
                order: idx,
                content,
                data: {},
            });
        }
    }

    return components;
}

function extractIdeviceContent(inst: any): string {
    let content = '';

    function findContent(obj: any): void {
        if (!obj || typeof obj !== 'object') return;

        // Look for content_w_resourcePaths or similar fields
        if (obj.unicode?.['@_value']) {
            const val = obj.unicode['@_value'];
            if (typeof val === 'string' && val.includes('<') && val.includes('>')) {
                content = val;
                return;
            }
        }

        if (obj.__cdata) {
            content = obj.__cdata;
            return;
        }

        for (const v of Object.values(obj)) {
            findContent(v);
            if (content) return;
        }
    }

    findContent(inst);
    return content;
}

function extractResourcePaths(inst: any): string[] {
    const paths: string[] = [];

    function findPaths(obj: any): void {
        if (!obj || typeof obj !== 'object') return;

        if (typeof obj === 'string') {
            // Look for resource paths
            const matches = obj.match(/resources\/[^\s"'<>]+/g);
            if (matches) paths.push(...matches);
        }

        if (Array.isArray(obj)) {
            obj.forEach(findPaths);
        } else {
            Object.values(obj).forEach(findPaths);
        }
    }

    findPaths(inst);
    return [...new Set(paths)]; // Deduplicate
}

function mapIdeviceType(className: string): string {
    const typeMap: Record<string, string> = {
        'FreeTextIdevice': 'free-text',
        'MultichoiceIdevice': 'multichoice',
        'TrueFalseIdevice': 'true-false',
        'ClozeIdevice': 'cloze',
        'ImageMagnifierIdevice': 'image-magnifier',
        'GalleryIdevice': 'gallery',
        'MultiSelectIdevice': 'multi-select',
        'QuizTestIdevice': 'quiz',
    };

    for (const [key, value] of Object.entries(typeMap)) {
        if (className.includes(key)) return value;
    }

    // Extract type from class name
    const match = className.match(/(\w+)Idevice/);
    return match ? match[1].toLowerCase() : 'unknown';
}

function convertPagesToRealOdeNavStructures(pages: NormalizedPage[]): RealOdeNavStructure[] {
    return pages.map((page) => ({
        odePageId: page.id,
        odeParentPageId: page.parent_id || undefined,
        pageName: page.title,
        odeNavStructureOrder: page.position,
        odePagStructures: {
            odePagStructure: [{
                odePageId: page.id,
                odeBlockId: generateId(),
                blockName: page.title,
                odePagStructureOrder: 0,
                odeComponents: page.components.length > 0 ? {
                    odeComponent: page.components.map((comp) => ({
                        odePageId: page.id,
                        odeBlockId: generateId(),
                        odeIdeviceId: comp.id,
                        odeIdeviceTypeName: comp.type,
                        htmlView: comp.content,
                        jsonProperties: comp.data ? JSON.stringify(comp.data) : undefined,
                        odeComponentsOrder: comp.order,
                    })),
                } : undefined,
            }],
        },
    }));
}

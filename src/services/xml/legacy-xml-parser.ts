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
let _xmlContent = '';
let parentRefMap = new Map<string, string | null>();
let srcRoutes: string[] = [];
let _sessionId = '';

/**
 * Parse legacy instance format (contentv3.xml)
 */
export function parse(
    parsed: LegacyInstanceXmlDocument,
    rawXmlContent?: string,
    currentSessionId?: string,
): ParsedOdeStructure {
    if (DEBUG) console.log('[LegacyParser] Parsing legacy instance format');

    _xmlContent = rawXmlContent || '';
    _sessionId = currentSessionId || '';
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

function buildParentReferenceMap(instance: unknown): void {
    parentRefMap = new Map();

    function traverse(obj: unknown, parentRef: string | null): void {
        if (!obj || typeof obj !== 'object') return;
        const record = obj as Record<string, unknown>;

        // If this is a Node, record its parent
        if (record['@_class'] === 'exe.engine.node.Node') {
            const ref = record['@_reference'] as string | undefined;
            if (ref) {
                parentRefMap.set(ref, parentRef);
            }
            // Its children will have this node as parent
            parentRef = ref || parentRef;
        }

        // Recurse into arrays and objects
        if (Array.isArray(obj)) {
            obj.forEach(item => traverse(item, parentRef));
        } else {
            Object.values(record).forEach(val => traverse(val, parentRef));
        }
    }

    traverse(instance, null);
}

function findAllNodes(instance: unknown): LegacyInstanceNode[] {
    const nodes: LegacyInstanceNode[] = [];

    function traverse(obj: unknown): void {
        if (!obj || typeof obj !== 'object') return;
        const record = obj as Record<string, unknown>;

        if (record['@_class'] === 'exe.engine.node.Node') {
            nodes.push(obj as LegacyInstanceNode);
        }

        // Recurse into arrays
        if (Array.isArray(obj)) {
            obj.forEach(traverse);
        } else {
            Object.values(record).forEach(traverse);
        }
    }

    traverse(instance);
    return nodes;
}

/**
 * Metadata structure
 */
interface LegacyMetadata {
    title: string;
    author: string;
    description: string;
    license: string;
    locale: string;
    theme: string;
    version: string;
}

function extractMetadata(instance: unknown): LegacyMetadata {
    const meta: LegacyMetadata = {
        title: 'Untitled',
        author: '',
        description: '',
        license: '',
        locale: 'en',
        theme: 'base',
        version: '1.0',
    };

    function findValue(obj: unknown, key: string): string | undefined {
        if (!obj || typeof obj !== 'object') return undefined;
        const record = obj as Record<string, unknown>;

        if (record.string && record.unicode) {
            const strings = Array.isArray(record.string) ? record.string : [record.string];
            const unicodes = Array.isArray(record.unicode) ? record.unicode : [record.unicode];

            for (let i = 0; i < strings.length; i++) {
                const strItem = strings[i] as Record<string, unknown> | string;
                // Legacy format: <string role="key" value="_title"></string>
                // Parsed as: { "@_role": "key", "@_value": "_title" }
                const strValue = typeof strItem === 'object' && strItem !== null ? strItem['@_value'] : strItem;

                if (strValue === key && unicodes[i]) {
                    const unicodeItem = unicodes[i] as Record<string, unknown>;
                    return typeof unicodeItem === 'object' && unicodeItem !== null
                        ? (unicodeItem['@_value'] as string)
                        : String(unicodeItem);
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

/**
 * LEGACY V2.X ROOT NODE FLATTENING CONVENTION
 *
 * Legacy contentv3.xml files from eXeLearning 2.x often have a single root node
 * that acts as a container, with all meaningful content pages as children.
 * This does NOT match the target content model where multiple top-level pages are expected.
 *
 * This function detects if we have a single root node with children that should be flattened.
 *
 * See doc/conventions.md for full documentation.
 *
 * @returns true if the structure has a single root with children that should be flattened
 */
function shouldFlattenRootChildren(): { shouldFlatten: boolean; rootRef: string | null } {
    // Find all root nodes (nodes with no parent)
    const rootRefs: string[] = [];
    for (const [nodeRef, parentRef] of parentRefMap.entries()) {
        if (parentRef === null) {
            rootRefs.push(nodeRef);
        }
    }

    // Only flatten if there's exactly one root
    if (rootRefs.length !== 1) {
        return { shouldFlatten: false, rootRef: null };
    }

    const rootRef = rootRefs[0];

    // Check if root has direct children
    let hasDirectChildren = false;
    for (const [_nodeRef, parentRef] of parentRefMap.entries()) {
        if (parentRef === rootRef) {
            hasDirectChildren = true;
            break;
        }
    }

    return { shouldFlatten: hasDirectChildren, rootRef };
}

/**
 * LEGACY V2.X ROOT NODE FLATTENING CONVENTION
 *
 * Promotes the direct children of the root node to top-level pages.
 * Deeper descendants keep their parent relationships but have their levels recalculated.
 *
 * Transformation:
 *   Legacy:                    After Flattening:
 *   Root                       Root (level 0, no parent)
 *    ├─ Child A                Child A (level 0, no parent) ← promoted
 *    │   └─ Grandchild A1      Grandchild A1 (level 1, parent: Child A) ← preserved
 *    ├─ Child B                Child B (level 0, no parent) ← promoted
 *    └─ Child C                Child C (level 0, no parent) ← promoted
 *
 * This behavior is INTENTIONAL and applies ONLY to legacy v2.x imports.
 * See doc/conventions.md for full documentation.
 *
 * @param pages - The pages with original parent-child relationships
 * @param rootRef - The reference ID of the single root node
 * @returns Pages with flattened root children
 */
function flattenRootChildren(pages: NormalizedPage[], rootRef: string): NormalizedPage[] {
    // Identify direct children of root (nodes whose parent is the root)
    const directChildIds = new Set<string>();
    for (const page of pages) {
        if (page.parent_id === rootRef) {
            directChildIds.add(page.id);
        }
    }

    // Create a map of page IDs to pages for level recalculation
    const pageMap = new Map<string, NormalizedPage>();
    for (const page of pages) {
        pageMap.set(page.id, page);
    }

    // Helper to recalculate level based on new parent chain
    function calculateNewLevel(pageId: string): number {
        const page = pageMap.get(pageId);
        if (!page) return 0;

        // Root and direct children of original root are now level 0
        if (page.parent_id === null || directChildIds.has(page.id)) {
            return 0;
        }

        // For other nodes, count parent chain depth
        // but stop at direct children (which are now level 0)
        let level = 0;
        let currentParentId = page.parent_id;
        while (currentParentId && level < 10) {
            if (directChildIds.has(currentParentId) || currentParentId === rootRef) {
                // Parent is now a top-level page
                level++;
                break;
            }
            level++;
            const parentPage = pageMap.get(currentParentId);
            currentParentId = parentPage?.parent_id || null;
        }
        return level;
    }

    // Transform pages: promote direct children to top-level, recalculate levels
    return pages.map(page => {
        // Direct children of root become top-level pages (no parent)
        if (page.parent_id === rootRef) {
            return {
                ...page,
                parent_id: null,
                level: 0,
            };
        }

        // Root stays at level 0 with no parent
        if (page.id === rootRef) {
            return {
                ...page,
                parent_id: null,
                level: 0,
            };
        }

        // Other pages: recalculate level, keep parent relationship
        return {
            ...page,
            level: calculateNewLevel(page.id),
        };
    });
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

        // Extract components (iDevices) - all go in one block named after the page
        const components = extractComponents(node, pageId, title);

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

    // LEGACY V2.X ROOT NODE FLATTENING CONVENTION
    // If there's a single root with children, flatten the structure by promoting
    // the root's direct children to top-level pages.
    // This is INTENTIONAL behavior for legacy imports. See doc/conventions.md.
    const { shouldFlatten, rootRef } = shouldFlattenRootChildren();
    if (shouldFlatten && rootRef) {
        if (DEBUG) console.log('[LegacyParser] Applying root node flattening convention for v2.x import');
        return flattenRootChildren(pages, rootRef);
    }

    return pages;
}

/**
 * LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
 *
 * Extracts the title from a legacy iDevice instance.
 * Legacy iDevices store their title in the dictionary under '_title' or 'title'.
 *
 * See doc/conventions.md for full documentation.
 *
 * @param inst - The iDevice instance node
 * @returns The iDevice title or empty string if not found
 */
function extractIdeviceTitle(inst: LegacyInstanceNode): string {
    if (!inst.dictionary) return '';

    // Look for _title or title in the dictionary
    const dict = inst.dictionary;

    // Check for string/unicode pairs
    if (dict.string && dict.unicode) {
        const strings = Array.isArray(dict.string) ? dict.string : [dict.string];
        const unicodes = Array.isArray(dict.unicode) ? dict.unicode : [dict.unicode];

        for (let i = 0; i < strings.length; i++) {
            const strItem = strings[i] as Record<string, unknown> | string;
            const strValue = typeof strItem === 'object' && strItem !== null ? strItem['@_value'] : strItem;

            if ((strValue === '_title' || strValue === 'title') && unicodes[i]) {
                const unicodeItem = unicodes[i] as Record<string, unknown>;
                const title =
                    typeof unicodeItem === 'object' && unicodeItem !== null
                        ? (unicodeItem['@_value'] as string)
                        : String(unicodeItem);
                if (title?.trim()) {
                    return title;
                }
            }
        }
    }

    return '';
}

/**
 * LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
 *
 * Extracts components (iDevices) from a legacy Node.
 * Each iDevice is assigned its own unique blockName based on its title.
 * This ensures that when imported, each iDevice gets its own box,
 * preventing loss of individual iDevice titles.
 *
 * This behavior applies ONLY to legacy .elp imports (contentv3.xml).
 * See doc/conventions.md for full documentation.
 *
 * @param node - The legacy Node instance
 * @param _pageId - The page ID (unused but kept for API compatibility)
 * @param _defaultBlockName - Default block name (unused - each iDevice gets its own)
 * @returns Array of normalized components, each with its own blockName
 */
function extractComponents(
    node: LegacyInstanceNode,
    _pageId: string,
    _defaultBlockName: string,
): NormalizedComponent[] {
    const components: NormalizedComponent[] = [];

    if (!node.dictionary?.list) return components;

    const lists = Array.isArray(node.dictionary.list) ? node.dictionary.list : [node.dictionary.list];

    for (const list of lists) {
        if (!list.instance) continue;

        const instances = Array.isArray(list.instance) ? list.instance : [list.instance];

        for (let idx = 0; idx < instances.length; idx++) {
            const inst = instances[idx];
            if (!inst['@_class']?.includes('Idevice')) continue;

            const content = extractIdeviceContent(inst);
            const resourcePaths = extractResourcePaths(inst);
            srcRoutes.push(...resourcePaths);

            // LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
            // Each iDevice gets its own blockName based on its title.
            // This ensures each iDevice is placed in its own box during import,
            // preserving individual iDevice titles.
            const ideviceTitle = extractIdeviceTitle(inst);
            // Filter out default "Free Text" title - should show empty block name instead
            const blockName = ideviceTitle === 'Free Text' ? '' : ideviceTitle;

            components.push({
                id: inst['@_reference'] || generateId(),
                type: mapIdeviceType(inst['@_class']),
                title: ideviceTitle,
                order: idx,
                content,
                blockName, // Each iDevice gets its own block with its filtered title
                data: {},
            });
        }
    }

    return components;
}

function extractIdeviceContent(inst: unknown): string {
    let content = '';

    function findContent(obj: unknown): void {
        if (!obj || typeof obj !== 'object') return;
        if (content) return; // Already found

        const record = obj as Record<string, unknown>;

        // Look for unicode elements - can be array or single object
        // Legacy format: <unicode content="true" value="<html>...">
        const unicode = record.unicode;
        if (unicode) {
            // Handle array of unicode elements
            if (Array.isArray(unicode)) {
                for (const u of unicode) {
                    if (u && typeof u === 'object') {
                        const uObj = u as Record<string, unknown>;
                        // Prefer elements with content="true" attribute (can be string or boolean)
                        if ((uObj['@_content'] === 'true' || uObj['@_content'] === true) && uObj['@_value']) {
                            const val = uObj['@_value'];
                            if (typeof val === 'string' && val.includes('<')) {
                                content = val;
                                return;
                            }
                        }
                    }
                }
            }
            // Handle single unicode object
            else if (typeof unicode === 'object') {
                const uObj = unicode as Record<string, unknown>;
                if (uObj['@_value']) {
                    const val = uObj['@_value'];
                    if (typeof val === 'string' && val.includes('<') && val.includes('>')) {
                        content = val;
                        return;
                    }
                }
            }
        }

        // Check for CDATA content
        if (typeof record.__cdata === 'string') {
            content = record.__cdata;
            return;
        }

        // Recurse into child objects
        for (const v of Object.values(record)) {
            findContent(v);
            if (content) return;
        }
    }

    findContent(inst);
    return content;
}

function extractResourcePaths(inst: unknown): string[] {
    const paths: string[] = [];

    function findPaths(obj: unknown): void {
        if (typeof obj === 'string') {
            // Look for resource paths
            const matches = obj.match(/resources\/[^\s"'<>]+/g);
            if (matches) paths.push(...matches);
            return;
        }

        if (!obj || typeof obj !== 'object') return;

        if (Array.isArray(obj)) {
            obj.forEach(findPaths);
        } else {
            Object.values(obj as Record<string, unknown>).forEach(findPaths);
        }
    }

    findPaths(inst);
    return [...new Set(paths)]; // Deduplicate
}

/**
 * LEGACY V2.X IDEVICE TYPE CONVERSION CONVENTION
 *
 * Maps legacy iDevice class names to modern iDevice type names.
 * This is critical for ensuring that imported legacy iDevices are EDITABLE
 * in the modern editor.
 *
 * HISTORICAL CONTEXT:
 * In eXeLearning 2.x, many iDevices were implemented as specialized variants
 * of a Text iDevice, distinguished mainly by:
 *   - An icon (e.g., lightbulb for Reflection, document for Activity)
 *   - A semantic label (e.g., "Prior Knowledge", "Objectives")
 *
 * These iDevices were technically Text-based and used the legacy editor.
 * They do NOT have direct editable equivalents in modern eXeLearning.
 *
 * If imported verbatim (without conversion), they would:
 *   - Appear visually but with Edit button DISABLED
 *   - Have identifier="undefined" in the DOM
 *   - Be effectively READ-ONLY, frustrating users
 *
 * CONVERSION STRATEGY (from Symfony legacy implementation):
 * All text-based legacy iDevices are converted to the modern 'text' iDevice.
 * This preserves:
 *   - The original HTML content
 *   - The iDevice title
 *   - Full editability in the modern editor
 *
 * AFFECTED IDEVICE TYPES:
 *
 * Text-based iDevices (convert to 'text'):
 *   - FreeTextIdevice, FreeTextfpdIdevice
 *   - GenericIdevice
 *   - ReflectionIdevice, ReflectionfpdIdevice, ReflectionfpdmodifIdevice
 *   - TareasIdevice (Tasks)
 *   - ListaApartadosIdevice (List sections)
 *   - ComillasIdevice (Quotes)
 *   - NotaInformacionIdevice, NotaIdevice (Notes)
 *   - CasopracticofpdIdevice (Case study FPD)
 *   - CitasparapensarfpdIdevice (Quotes to think)
 *   - DebesconocerfpdIdevice (Must know)
 *   - DestacadofpdIdevice (Highlighted)
 *   - OrientacionestutoriafpdIdevice (Teacher guidelines)
 *   - OrientacionesalumnadofpdIdevice (Student guidelines)
 *   - ParasabermasfpdIdevice (To learn more)
 *   - RecomendacionfpdIdevice (Recommendation)
 *   - WikipediaIdevice, RssIdevice (external content, no modern equivalent)
 *   - AppletIdevice (Java applets, no modern support)
 *   - EjercicioresueltofpdIdevice (Solved exercises)
 *
 * Interactive iDevices (have modern equivalents):
 *   - TrueFalseIdevice, VerdaderofalsofpdIdevice → trueorfalse
 *   - MultichoiceIdevice, EleccionmultiplefpdIdevice → quick-questions-multiple-choice
 *   - MultiSelectIdevice, SeleccionmultiplefpdIdevice → quick-questions-multiple-choice
 *   - ClozeIdevice, ClozefpdIdevice, ClozelangfpdIdevice → complete
 *   - ImageMagnifierIdevice → magnifier
 *   - GalleryIdevice → image-gallery
 *   - CasestudyIdevice → casestudy
 *   - FileAttachIdevice, AttachmentIdevice → text (for editability)
 *   - ExternalUrlIdevice → external-website
 *   - QuizTestIdevice → quick-questions
 *
 * Modern iDevices (keep as-is):
 *   - JsIdevice → This IS the modern JSON-based iDevice system
 *
 * See doc/conventions.md for full documentation.
 *
 * @param className - The legacy iDevice class name (e.g., 'exe.engine.freetextidevice.FreeTextIdevice')
 * @returns The modern iDevice type name (e.g., 'text')
 */
function mapIdeviceType(className: string): string {
    // LEGACY TEXT-BASED IDEVICES → Convert to 'text' for editability
    // These iDevices were essentially text containers with different icons/styling.
    // Converting to 'text' preserves content AND enables editing in modern editor.
    const textBasedIdevices = [
        // Core text iDevices
        'FreeTextIdevice',
        'FreeTextfpdIdevice',
        'GenericIdevice',
        // Reflection variants
        'ReflectionIdevice',
        'ReflectionfpdIdevice',
        'ReflectionfpdmodifIdevice',
        // Spanish FPD variants (Formación Profesional a Distancia)
        'TareasIdevice', // Tasks
        'ListaApartadosIdevice', // List sections
        'ComillasIdevice', // Quotes
        'NotaInformacionIdevice', // Note/Information
        'NotaIdevice', // Note
        'CasopracticofpdIdevice', // Case study FPD
        'CitasparapensarfpdIdevice', // Quotes to think
        'DebesconocerfpdIdevice', // Must know
        'DestacadofpdIdevice', // Highlighted
        'OrientacionestutoriafpdIdevice', // Teacher guidelines
        'OrientacionesalumnadofpdIdevice', // Student guidelines
        'ParasabermasfpdIdevice', // To learn more / Step ahead
        'RecomendacionfpdIdevice', // Recommendation
        'EjercicioresueltofpdIdevice', // Solved exercises
        // External content iDevices (no modern equivalent, fallback to text)
        'WikipediaIdevice',
        'RssIdevice',
        'AppletIdevice', // Java applets - no modern support
        // File attachment iDevices → text (as per Symfony OdeOldXmlFileAttachIdevice.php)
        // The attached-files iDevice type has no editor, so we convert to editable 'text'
        'FileAttachIdevice', // Matches FileAttachIdevice and FileAttachIdeviceInc
        'AttachmentIdevice',
    ];

    // Check if this is a text-based iDevice that should convert to 'text'
    for (const textType of textBasedIdevices) {
        if (className.includes(textType)) {
            if (DEBUG) console.log(`[LegacyParser] Converting ${textType} to 'text' for editability`);
            return 'text';
        }
    }

    // INTERACTIVE IDEVICES → Map to modern equivalents
    // These iDevices have structured content that requires specific handling.
    const interactiveTypeMap: Record<string, string> = {
        // True/False quiz
        'TrueFalseIdevice': 'trueorfalse',
        'VerdaderofalsofpdIdevice': 'trueorfalse',
        // Multiple choice (single answer)
        'MultichoiceIdevice': 'quick-questions-multiple-choice',
        'EleccionmultiplefpdIdevice': 'quick-questions-multiple-choice',
        // Multiple select (multiple answers)
        'MultiSelectIdevice': 'quick-questions-multiple-choice',
        'SeleccionmultiplefpdIdevice': 'quick-questions-multiple-choice',
        // Fill in the blanks / Cloze
        'ClozeIdevice': 'complete',
        'ClozefpdIdevice': 'complete',
        'ClozelangfpdIdevice': 'complete',
        // Image magnifier
        'ImageMagnifierIdevice': 'magnifier',
        // Image gallery
        'GalleryIdevice': 'image-gallery',
        // Case study
        'CasestudyIdevice': 'casestudy',
        // Note: FileAttachIdevice moved to textBasedIdevices (converts to 'text' for editability)
        // External URL / website
        'ExternalUrlIdevice': 'external-website',
        // SCORM quiz/test
        'QuizTestIdevice': 'quick-questions',
    };

    // Check for interactive iDevice mappings
    for (const [legacyType, modernType] of Object.entries(interactiveTypeMap)) {
        if (className.includes(legacyType)) {
            if (DEBUG) console.log(`[LegacyParser] Mapping ${legacyType} to '${modernType}'`);
            return modernType;
        }
    }

    // MODERN JS IDEVICE → Keep the type from the iDevice itself
    // JsIdevice is the modern JSON-based iDevice system. The actual type
    // is stored within the iDevice's JSON properties.
    if (className.includes('JsIdevice')) {
        if (DEBUG) console.log(`[LegacyParser] Detected JsIdevice (modern format)`);
        // Return 'js' to indicate this needs special handling to extract the actual type
        return 'js';
    }

    // FALLBACK: Unknown iDevice types → Convert to 'text' for editability
    // This ensures that ANY unrecognized legacy iDevice becomes editable
    // rather than being rendered as a read-only, disabled component.
    // Editable content takes precedence over preserving obsolete iDevice types.
    const match = className.match(/(\w+)Idevice/);
    const extractedType = match ? match[1].toLowerCase() : 'unknown';

    if (DEBUG) console.log(`[LegacyParser] Unknown iDevice '${extractedType}' → converting to 'text' for editability`);

    // Convert unknown types to 'text' to ensure editability
    return 'text';
}

/**
 * LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
 *
 * Converts normalized pages to RealOdeNavStructures format.
 * For legacy imports, each iDevice is placed in its own block (odePagStructure),
 * with the block name set to the iDevice's title.
 *
 * This ensures that iDevice titles are preserved as box titles when imported,
 * rather than being lost by grouping all iDevices into a single box.
 *
 * This behavior applies ONLY to legacy .elp imports (contentv3.xml).
 * Modern .elpx files have their box structure preserved as-is.
 * See doc/conventions.md for full documentation.
 *
 * @param pages - Normalized pages with components
 * @returns RealOdeNavStructure array with one block per iDevice
 */
function convertPagesToRealOdeNavStructures(pages: NormalizedPage[]): RealOdeNavStructure[] {
    return pages.map(page => ({
        odePageId: page.id,
        odeParentPageId: page.parent_id || undefined,
        pageName: page.title,
        odeNavStructureOrder: page.position,
        odePagStructures: {
            // LEGACY V2.X IDEVICE BOX SPLITTING CONVENTION
            // Each iDevice gets its own block (odePagStructure) to preserve its title.
            // This prevents loss of iDevice titles that would occur if all were in one block.
            odePagStructure:
                page.components.length > 0
                    ? page.components.map((comp, idx) => ({
                          odePageId: page.id,
                          odeBlockId: generateId(),
                          // Use the iDevice's title as the block name
                          blockName: comp.blockName || comp.title || '',
                          odePagStructureOrder: idx,
                          odeComponents: {
                              odeComponent: [
                                  {
                                      odePageId: page.id,
                                      odeBlockId: generateId(),
                                      odeIdeviceId: comp.id,
                                      odeIdeviceTypeName: comp.type,
                                      htmlView: comp.content,
                                      jsonProperties: comp.data ? JSON.stringify(comp.data) : undefined,
                                      odeComponentsOrder: 0, // Always 0 since there's only one iDevice per block
                                  },
                              ],
                          },
                      }))
                    : [
                          {
                              odePageId: page.id,
                              odeBlockId: generateId(),
                              blockName: page.title,
                              odePagStructureOrder: 0,
                              odeComponents: undefined,
                          },
                      ],
        },
    }));
}

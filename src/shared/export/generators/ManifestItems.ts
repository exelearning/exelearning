/**
 * ManifestItems
 *
 * Shared `<organization>` item-tree builder for the SCORM 1.2, SCORM 2004 and
 * IMS CP manifests. Before this module the three generators carried three
 * byte-identical copies of `generateItems()` / `generateItemRecursive()`.
 *
 * ## Why every page hangs from a root cluster item
 *
 * eXeLearning 4 models the outline as a *forest*: `Home`, `Topic 1`, `Topic 2`…
 * are all root pages (`parentId === null`). Emitting them as sibling top-level
 * `<item>` elements is valid SCORM, but Moodle's stock `mod_scorm` cannot
 * navigate it (exelearning/exelearning#2222):
 *
 * 1. `player.php` builds the navigation JSON via `scorm_get_toc_object()`
 *    *without* the organization SCO, so `scorm_get_toc_get_parent_child()`
 *    has nothing to attach the 2nd..Nth top-level `<item>` to. It pushes each
 *    one into its own `$level` and returns several disconnected trees whose
 *    roots carry no `parentscoid`.
 * 2. `scorm_get_adlnav_json()` only links `prevsibling`/`nextsibling` between
 *    SCOs that are adjacent in depth-first order *and* share a parent, so a
 *    page that has sub-pages never gets a `nextsibling`.
 * 3. `scorm_update_siblings()` in `module.js` repairs (2) by grouping SCOs that
 *    share a `parentscoid` — which the roots from (1) do not have.
 *
 * The net effect is that `#nav_skipnext`, `#nav_skipprev` and `#nav_up` are
 * disabled for every top-level page. eXeLearning 2.9 never hit this because its
 * outline had a single root node, so every other page had a parent.
 *
 * Wrapping the whole outline in one non-launchable cluster `<item>` restores
 * sibling navigation in stock `mod_scorm` while keeping the authored hierarchy
 * intact (`Home` stays a sibling of `Topic 1`, not its parent). See
 * ADR-2222-01.
 */

import type { ExportPage } from '../interfaces';

/**
 * Options for {@link generateManifestItems}.
 */
export interface ManifestItemsOptions {
    /** Pages in reading order, already filtered for visibility. */
    pages: ExportPage[];
    /** Bare project identifier, used to build a stable root item identifier. */
    projectId: string;
    /** Title of the root cluster item (the project title). */
    rootTitle: string;
    /** Indentation depth of the root item, in two-space units. Defaults to 3. */
    baseIndent?: number;
    /**
     * Per-format hook rendering extra children for cluster items (items that
     * have child items, including the root). SCORM 2004 uses it to inject
     * `<imsss:sequencing>`; SCORM 1.2 and IMS CP leave it undefined.
     */
    renderClusterExtras?: (indentStr: string) => string;
}

/**
 * Build the identifier of the root cluster item.
 *
 * Derived from the project identifier so that re-exporting the same project
 * yields the same identifier and the LMS keeps tracking it (see #1785).
 *
 * @param projectId - Bare project identifier
 * @returns Root item identifier
 */
export function buildRootItemIdentifier(projectId: string): string {
    return `ITEM-ROOT-${projectId}`;
}

/**
 * Escape XML special characters.
 *
 * @param str - String to escape
 * @returns Escaped string
 */
export function escapeXml(str: string): string {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Group pages by their parent id, preserving the incoming order.
 *
 * @param pages - Flat page list
 * @returns Map of parent id (null for roots) to ordered children
 */
function buildChildrenMap(pages: ExportPage[]): Map<string | null, ExportPage[]> {
    const childrenMap = new Map<string | null, ExportPage[]>();

    for (const page of pages) {
        const parentId = page.parentId || null;
        const siblings = childrenMap.get(parentId);
        if (siblings) {
            siblings.push(page);
        } else {
            childrenMap.set(parentId, [page]);
        }
    }

    return childrenMap;
}

/**
 * Render a single page `<item>` and, recursively, its descendants.
 *
 * @param page - Page to render
 * @param childrenMap - Parent id to children index
 * @param indent - Indentation depth in two-space units
 * @param visited - Ids already rendered, guarding against cyclic hierarchies
 * @param renderClusterExtras - Optional per-format cluster hook
 * @returns Item XML
 */
function renderItem(
    page: ExportPage,
    childrenMap: Map<string | null, ExportPage[]>,
    indent: number,
    visited: Set<string>,
    renderClusterExtras?: (indentStr: string) => string,
): string {
    if (visited.has(page.id)) {
        // Cyclic parent/child reference: render the page once and stop.
        return '';
    }
    visited.add(page.id);

    const indentStr = '  '.repeat(indent);
    const children = childrenMap.get(page.id) || [];

    let xml = `${indentStr}<item identifier="ITEM-${escapeXml(page.id)}" identifierref="RES-${escapeXml(page.id)}" isvisible="true">\n`;
    xml += `${indentStr}  <title>${escapeXml(page.title || 'Page')}</title>\n`;

    for (const child of children) {
        xml += renderItem(child, childrenMap, indent + 1, visited, renderClusterExtras);
    }

    if (children.length > 0 && renderClusterExtras) {
        xml += renderClusterExtras(`${indentStr}  `);
    }

    xml += `${indentStr}</item>\n`;
    return xml;
}

/**
 * Generate the `<item>` tree of an organization.
 *
 * Every page hangs from a single non-launchable root cluster item (no
 * `identifierref`) titled with the project title. Returns an empty string when
 * there are no pages, so an empty project does not get a dangling cluster.
 *
 * @param options - Generation options
 * @returns Items XML
 */
export function generateManifestItems(options: ManifestItemsOptions): string {
    const { pages, projectId, rootTitle, baseIndent = 3, renderClusterExtras } = options;

    if (!pages || pages.length === 0) {
        return '';
    }

    const childrenMap = buildChildrenMap(pages);
    const rootPages = childrenMap.get(null) || [];

    if (rootPages.length === 0) {
        // Every page claims a parent that is not in the list (all ancestors
        // filtered out); nothing can be rendered without inventing a hierarchy.
        return '';
    }

    const indentStr = '  '.repeat(baseIndent);
    const visited = new Set<string>();

    let xml = `${indentStr}<item identifier="${escapeXml(buildRootItemIdentifier(projectId))}" isvisible="true">\n`;
    xml += `${indentStr}  <title>${escapeXml(rootTitle || 'eXeLearning')}</title>\n`;

    for (const page of rootPages) {
        xml += renderItem(page, childrenMap, baseIndent + 1, visited, renderClusterExtras);
    }

    if (renderClusterExtras) {
        xml += renderClusterExtras(`${indentStr}  `);
    }

    xml += `${indentStr}</item>\n`;
    return xml;
}

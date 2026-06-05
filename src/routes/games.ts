/**
 * Games Routes for Elysia
 * Provides endpoints used by game iDevices (progress-report, etc.)
 *
 * The progress-report iDevice needs to list all components in a project
 * to display a report of student progress across all evaluable activities.
 */
import { Elysia, t } from 'elysia';
import * as Y from 'yjs';
import { getSession as getSessionDefault, type ProjectSession } from '../services/session-manager';
import { getDb as getDbDefault } from '../db/client';
import {
    findProjectByUuid as findProjectByUuidDefault,
    findSnapshotByProjectId as findSnapshotByProjectIdDefault,
} from '../db/queries';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface GamesRoutesDeps {
    getSession: (sessionId: string) => ProjectSession | undefined;
    getDb: typeof getDbDefault;
    findProjectByUuid: typeof findProjectByUuidDefault;
    findSnapshotByProjectId: typeof findSnapshotByProjectIdDefault;
}

const defaultDeps: GamesRoutesDeps = {
    getSession: getSessionDefault,
    getDb: getDbDefault,
    findProjectByUuid: findProjectByUuidDefault,
    findSnapshotByProjectId: findSnapshotByProjectIdDefault,
};

let deps = defaultDeps;

export function configureGamesRoutes(newDeps: Partial<GamesRoutesDeps>): void {
    deps = { ...defaultDeps, ...newDeps };
}

export function resetGamesRoutesDeps(): void {
    deps = defaultDeps;
}

/**
 * Response item structure for getIdevicesBySessionId
 * Matches the format expected by progress-report.js
 */
interface SessionIdeviceItem {
    odePageId: string;
    odeParentPageId: string | null;
    pageName: string;
    navId: string;
    ode_nav_structure_sync_id: string;
    ode_session_id: string;
    ode_nav_structure_sync_order: number;
    navIsActive: number;
    componentId: string | null;
    htmlViewer: string | null;
    jsonProperties: string | null;
    ode_idevice_id: string | null;
    odeIdeviceTypeName: string | null;
    ode_pag_structure_sync_id: string | null;
    componentSessionId: string | null;
    componentPageId: string | null;
    ode_block_id: string | null;
    ode_components_sync_order: number | null;
    componentIsActive: number | null;
    blockName: string | null;
    blockOrder: number | null;
}

/**
 * Type guard to check if structure has raw ODE format
 */
interface RawOdeStructure {
    raw: {
        ode: {
            odeNavStructures: {
                odeNavStructure: unknown;
            };
        };
    };
}

interface SimplifiedStructure {
    pages: unknown[];
}

/**
 * Helper type for simplified page/block/component objects
 */
type DynamicObject = Record<string, unknown>;

/**
 * Helper function to safely get a string property from a dynamic object
 */
function getString(obj: unknown, key: string, fallback: string = ''): string {
    if (typeof obj !== 'object' || obj === null) return fallback;
    const value = (obj as DynamicObject)[key];
    return typeof value === 'string' ? value : fallback;
}

/**
 * Helper function to safely get an array property from a dynamic object
 */
function getArray(obj: unknown, key: string): unknown[] {
    if (typeof obj !== 'object' || obj === null) return [];
    const value = (obj as DynamicObject)[key];
    return Array.isArray(value) ? value : [];
}

function hasRawOdeStructure(structure: unknown): structure is RawOdeStructure {
    return (
        typeof structure === 'object' &&
        structure !== null &&
        'raw' in structure &&
        typeof (structure as RawOdeStructure).raw === 'object' &&
        (structure as RawOdeStructure).raw !== null &&
        'ode' in (structure as RawOdeStructure).raw
    );
}

function hasSimplifiedStructure(structure: unknown): structure is SimplifiedStructure {
    return (
        typeof structure === 'object' &&
        structure !== null &&
        'pages' in structure &&
        Array.isArray((structure as SimplifiedStructure).pages)
    );
}

/**
 * Extract iDevices from session structure
 * Flattens the hierarchy: pages -> blocks -> components into a single array
 */
function extractIdevicesFromStructure(sessionId: string, structure: unknown): SessionIdeviceItem[] {
    const items: SessionIdeviceItem[] = [];

    if (!hasRawOdeStructure(structure) || !structure.raw.ode.odeNavStructures?.odeNavStructure) {
        // Also check for simplified structure (pages array)
        if (hasSimplifiedStructure(structure)) {
            return extractFromPagesArray(sessionId, structure.pages);
        }
        return items;
    }

    // Handle both single item and array
    const navStructures = Array.isArray(structure.raw.ode.odeNavStructures.odeNavStructure)
        ? structure.raw.ode.odeNavStructures.odeNavStructure
        : [structure.raw.ode.odeNavStructures.odeNavStructure];

    for (const nav of navStructures) {
        const pageId = nav.odePageId || nav.id || '';
        const pageName = nav.pageName || nav.title || '';
        const parentPageId = nav.odeParentPageId || nav.parentId || null;
        const navOrder = nav.odeNavStructureOrder ?? nav.position ?? 0;

        // If no blocks/components, add just the page entry
        const pagStructures = nav.odePagStructures?.odePagStructure;
        if (!pagStructures) {
            items.push({
                odePageId: pageId,
                odeParentPageId: parentPageId,
                pageName: pageName,
                navId: nav.id || pageId,
                ode_nav_structure_sync_id: nav.id || pageId,
                ode_session_id: sessionId,
                ode_nav_structure_sync_order: navOrder,
                navIsActive: 1,
                componentId: null,
                htmlViewer: null,
                jsonProperties: null,
                ode_idevice_id: null,
                odeIdeviceTypeName: null,
                ode_pag_structure_sync_id: null,
                componentSessionId: null,
                componentPageId: null,
                ode_block_id: null,
                ode_components_sync_order: null,
                componentIsActive: null,
                blockName: null,
                blockOrder: null,
            });
            continue;
        }

        // Handle blocks
        const blocks = Array.isArray(pagStructures) ? pagStructures : [pagStructures];
        for (const block of blocks) {
            const blockId = block.odeBlockId || block.id || '';
            const blockName = block.blockName || block.name || '';
            const blockOrder = block.odePagStructureSyncOrder ?? block.position ?? 0;

            // If no components, add just the block entry
            const components = block.odeComponents?.odeComponent;
            if (!components) {
                items.push({
                    odePageId: pageId,
                    odeParentPageId: parentPageId,
                    pageName: pageName,
                    navId: nav.id || pageId,
                    ode_nav_structure_sync_id: nav.id || pageId,
                    ode_session_id: sessionId,
                    ode_nav_structure_sync_order: navOrder,
                    navIsActive: 1,
                    componentId: null,
                    htmlViewer: null,
                    jsonProperties: null,
                    ode_idevice_id: null,
                    odeIdeviceTypeName: null,
                    ode_pag_structure_sync_id: block.id || blockId,
                    componentSessionId: null,
                    componentPageId: null,
                    ode_block_id: blockId,
                    ode_components_sync_order: null,
                    componentIsActive: null,
                    blockName: blockName,
                    blockOrder: blockOrder,
                });
                continue;
            }

            // Handle components
            const comps = Array.isArray(components) ? components : [components];
            for (const comp of comps) {
                const componentId = comp.odeComponentId || comp.id || '';
                const ideviceId = comp.odeIdeviceId || '';
                const ideviceType = comp.odeIdeviceTypeName || comp.type || '';
                const htmlViewer = comp.htmlView || comp.htmlViewer || '';
                const jsonProperties = comp.jsonProperties || '';
                const componentOrder = comp.odeComponentsSyncOrder ?? comp.position ?? 0;
                const isActive = comp.isActive !== undefined ? (comp.isActive ? 1 : 0) : 1;

                items.push({
                    odePageId: pageId,
                    odeParentPageId: parentPageId,
                    pageName: pageName,
                    navId: nav.id || pageId,
                    ode_nav_structure_sync_id: nav.id || pageId,
                    ode_session_id: sessionId,
                    ode_nav_structure_sync_order: navOrder,
                    navIsActive: 1,
                    componentId: componentId,
                    htmlViewer: typeof htmlViewer === 'string' ? htmlViewer : JSON.stringify(htmlViewer),
                    jsonProperties:
                        typeof jsonProperties === 'string' ? jsonProperties : JSON.stringify(jsonProperties),
                    ode_idevice_id: ideviceId,
                    odeIdeviceTypeName: ideviceType,
                    ode_pag_structure_sync_id: block.id || blockId,
                    componentSessionId: sessionId,
                    componentPageId: pageId,
                    ode_block_id: blockId,
                    ode_components_sync_order: componentOrder,
                    componentIsActive: isActive,
                    blockName: blockName,
                    blockOrder: blockOrder,
                });
            }
        }
    }

    return items;
}

/**
 * Extract from simplified pages array structure
 */
function extractFromPagesArray(sessionId: string, pages: unknown[]): SessionIdeviceItem[] {
    const items: SessionIdeviceItem[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const page = pages[pageIdx];
        const pageId = getString(page, 'id') || `page_${pageIdx}`;
        const pageName = getString(page, 'title') || getString(page, 'name');
        const parentPageId = getString(page, 'parentId') || null;

        const blocks = getArray(page, 'blocks');
        if (blocks.length === 0) {
            items.push({
                odePageId: pageId,
                odeParentPageId: parentPageId,
                pageName: pageName,
                navId: pageId,
                ode_nav_structure_sync_id: pageId,
                ode_session_id: sessionId,
                ode_nav_structure_sync_order: pageIdx,
                navIsActive: 1,
                componentId: null,
                htmlViewer: null,
                jsonProperties: null,
                ode_idevice_id: null,
                odeIdeviceTypeName: null,
                ode_pag_structure_sync_id: null,
                componentSessionId: null,
                componentPageId: null,
                ode_block_id: null,
                ode_components_sync_order: null,
                componentIsActive: null,
                blockName: null,
                blockOrder: null,
            });
            continue;
        }

        for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
            const block = blocks[blockIdx];
            const blockId = getString(block, 'id') || `block_${blockIdx}`;
            const blockName = getString(block, 'name') || getString(block, 'title');

            const components = getArray(block, 'components');
            if (components.length === 0) {
                items.push({
                    odePageId: pageId,
                    odeParentPageId: parentPageId,
                    pageName: pageName,
                    navId: pageId,
                    ode_nav_structure_sync_id: pageId,
                    ode_session_id: sessionId,
                    ode_nav_structure_sync_order: pageIdx,
                    navIsActive: 1,
                    componentId: null,
                    htmlViewer: null,
                    jsonProperties: null,
                    ode_idevice_id: null,
                    odeIdeviceTypeName: null,
                    ode_pag_structure_sync_id: blockId,
                    componentSessionId: null,
                    componentPageId: null,
                    ode_block_id: blockId,
                    ode_components_sync_order: null,
                    componentIsActive: null,
                    blockName: blockName,
                    blockOrder: blockIdx,
                });
                continue;
            }

            for (let compIdx = 0; compIdx < components.length; compIdx++) {
                const comp = components[compIdx] as DynamicObject | null;
                const compId = getString(comp, 'id') || `comp_${compIdx}`;
                const htmlView = getString(comp, 'htmlView') || getString(comp, 'content') || null;
                const jsonPropsRaw = comp?.jsonProperties;
                const jsonProperties = jsonPropsRaw ? JSON.stringify(jsonPropsRaw) : null;
                items.push({
                    odePageId: pageId,
                    odeParentPageId: parentPageId,
                    pageName: pageName,
                    navId: pageId,
                    ode_nav_structure_sync_id: pageId,
                    ode_session_id: sessionId,
                    ode_nav_structure_sync_order: pageIdx,
                    navIsActive: 1,
                    componentId: compId,
                    htmlViewer: htmlView,
                    jsonProperties: jsonProperties,
                    ode_idevice_id: getString(comp, 'ideviceId') || compId || null,
                    odeIdeviceTypeName: getString(comp, 'type') || null,
                    ode_pag_structure_sync_id: blockId,
                    componentSessionId: sessionId,
                    componentPageId: pageId,
                    ode_block_id: blockId,
                    ode_components_sync_order: compIdx,
                    componentIsActive: 1,
                    blockName: blockName,
                    blockOrder: blockIdx,
                });
            }
        }
    }

    return items;
}

/**
 * Extract iDevices from Yjs document snapshot
 * Reads navigation array -> pages -> blocks -> components structure
 */
function extractIdevicesFromYjsDoc(sessionId: string, ydoc: Y.Doc): SessionIdeviceItem[] {
    const items: SessionIdeviceItem[] = [];

    // Get navigation array (contains all pages)
    const navigation = ydoc.getArray('navigation');
    if (!navigation || navigation.length === 0) {
        return items;
    }

    for (let pageIdx = 0; pageIdx < navigation.length; pageIdx++) {
        const page = navigation.get(pageIdx) as Y.Map<unknown> | undefined;
        if (!page || !(page instanceof Y.Map)) {
            continue;
        }

        const pageId = (page.get('id') as string) || (page.get('pageId') as string) || '';
        const pageTitle = (page.get('title') as string) || (page.get('pageName') as string) || '';
        const parentId = (page.get('parentId') as string) || null;

        // Get blocks array
        const blocks = page.get('blocks') as Y.Array<unknown> | undefined;

        if (!blocks || blocks.length === 0) {
            // Page without blocks
            items.push({
                odePageId: pageId,
                odeParentPageId: parentId,
                pageName: pageTitle,
                navId: pageId,
                ode_nav_structure_sync_id: pageId,
                ode_session_id: sessionId,
                ode_nav_structure_sync_order: pageIdx,
                navIsActive: 1,
                componentId: null,
                htmlViewer: null,
                jsonProperties: null,
                ode_idevice_id: null,
                odeIdeviceTypeName: null,
                ode_pag_structure_sync_id: null,
                componentSessionId: null,
                componentPageId: null,
                ode_block_id: null,
                ode_components_sync_order: null,
                componentIsActive: null,
                blockName: null,
                blockOrder: null,
            });
            continue;
        }

        for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
            const block = blocks.get(blockIdx) as Y.Map<unknown> | undefined;
            if (!block || !(block instanceof Y.Map)) {
                continue;
            }

            const blockId = (block.get('id') as string) || (block.get('blockId') as string) || '';
            const blockName = (block.get('blockName') as string) || (block.get('name') as string) || '';
            const blockOrder = (block.get('order') as number) ?? blockIdx;

            // Get components/idevices array
            const components = (block.get('components') || block.get('idevices')) as Y.Array<unknown> | undefined;

            if (!components || components.length === 0) {
                // Block without idevices
                items.push({
                    odePageId: pageId,
                    odeParentPageId: parentId,
                    pageName: pageTitle,
                    navId: pageId,
                    ode_nav_structure_sync_id: pageId,
                    ode_session_id: sessionId,
                    ode_nav_structure_sync_order: pageIdx,
                    navIsActive: 1,
                    componentId: null,
                    htmlViewer: null,
                    jsonProperties: null,
                    ode_idevice_id: null,
                    odeIdeviceTypeName: null,
                    ode_pag_structure_sync_id: blockId,
                    componentSessionId: null,
                    componentPageId: null,
                    ode_block_id: blockId,
                    ode_components_sync_order: null,
                    componentIsActive: null,
                    blockName: blockName,
                    blockOrder: blockOrder,
                });
                continue;
            }

            for (let compIdx = 0; compIdx < components.length; compIdx++) {
                const component = components.get(compIdx) as Y.Map<unknown> | undefined;
                if (!component || !(component instanceof Y.Map)) {
                    continue;
                }

                const componentId = (component.get('id') as string) || (component.get('ideviceId') as string) || '';
                const ideviceType = (component.get('type') as string) || (component.get('ideviceType') as string) || '';
                // Check multiple possible property names for HTML content
                const htmlView = component.get('content') || component.get('htmlContent') || component.get('htmlView');
                const componentOrder = (component.get('order') as number) ?? compIdx;

                // Convert htmlView to string if needed
                let htmlViewStr = '';
                if (htmlView && typeof htmlView === 'object' && 'toString' in htmlView) {
                    htmlViewStr = String(htmlView);
                } else if (typeof htmlView === 'string') {
                    htmlViewStr = htmlView;
                }

                items.push({
                    odePageId: pageId,
                    odeParentPageId: parentId,
                    pageName: pageTitle,
                    navId: pageId,
                    ode_nav_structure_sync_id: pageId,
                    ode_session_id: sessionId,
                    ode_nav_structure_sync_order: pageIdx,
                    navIsActive: 1,
                    componentId: componentId,
                    htmlViewer: htmlViewStr,
                    jsonProperties: null,
                    ode_idevice_id: componentId,
                    odeIdeviceTypeName: ideviceType,
                    ode_pag_structure_sync_id: blockId,
                    componentSessionId: sessionId,
                    componentPageId: pageId,
                    ode_block_id: blockId,
                    ode_components_sync_order: componentOrder,
                    componentIsActive: 1,
                    blockName: blockName,
                    blockOrder: blockOrder,
                });
            }
        }
    }

    return items;
}

/**
 * Games routes - endpoints used by game iDevices
 */
export const gamesRoutes = new Elysia({ prefix: '/api/games' })
    /**
     * GET /api/games/:odeSessionId/idevices
     *
     * Returns all iDevices in a session with their navigation structure.
     * Used by the progress-report iDevice to display all evaluable activities.
     *
     * Response format matches the legacy Symfony/NestJS implementation.
     */
    .get(
        '/:odeSessionId/idevices',
        async ({ params }) => {
            const { odeSessionId } = params;

            // Get session from memory (using DI)
            const session = deps.getSession(odeSessionId);

            // First try to extract from session.structure (legacy/simplified)
            let data = session ? extractIdevicesFromStructure(odeSessionId, session.structure) : [];

            // If no data found, try loading from Yjs snapshot in database
            if (data.length === 0) {
                try {
                    const db = deps.getDb();
                    // The sessionId is the project UUID
                    const project = await deps.findProjectByUuid(db, odeSessionId);

                    if (project) {
                        const snapshot = await deps.findSnapshotByProjectId(db, project.id);

                        if (snapshot?.snapshot_data) {
                            const ydoc = new Y.Doc();
                            Y.applyUpdate(ydoc, new Uint8Array(snapshot.snapshot_data));
                            data = extractIdevicesFromYjsDoc(odeSessionId, ydoc);
                            ydoc.destroy();
                            console.log(
                                `[Games] Loaded ${data.length} items from Yjs snapshot for session ${odeSessionId}`,
                            );
                        }
                    }
                } catch (error) {
                    console.error(`[Games] Failed to load from Yjs snapshot:`, error);
                    // Fall through with empty data
                }
            }

            if (data.length === 0 && !session) {
                console.log(`[Games] Session not found: ${odeSessionId}`);
            } else {
                console.log(`[Games] Returning ${data.length} items for session ${odeSessionId}`);
            }

            return {
                success: true,
                data,
            };
        },
        {
            params: t.Object({
                odeSessionId: t.String(),
            }),
        },
    );

// Export internal functions for testing
export { extractIdevicesFromYjsDoc };

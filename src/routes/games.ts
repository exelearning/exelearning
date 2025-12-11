/**
 * Games Routes for Elysia
 * Provides endpoints used by game iDevices (progress-report, etc.)
 *
 * The progress-report iDevice needs to list all components in a project
 * to display a report of student progress across all evaluable activities.
 */
import { Elysia, t } from 'elysia';
import { getSession as getSessionDefault, type ProjectSession } from '../services/session-manager';

// ============================================================================
// DEPENDENCY INJECTION
// ============================================================================

export interface GamesRoutesDeps {
    getSession: (sessionId: string) => ProjectSession | undefined;
}

const defaultDeps: GamesRoutesDeps = {
    getSession: getSessionDefault,
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
 * Extract iDevices from session structure
 * Flattens the hierarchy: pages -> blocks -> components into a single array
 */
function extractIdevicesFromStructure(
    sessionId: string,
    structure: any
): SessionIdeviceItem[] {
    const items: SessionIdeviceItem[] = [];

    if (!structure?.raw?.ode?.odeNavStructures?.odeNavStructure) {
        // Also check for simplified structure (pages array)
        if (structure?.pages && Array.isArray(structure.pages)) {
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
                    jsonProperties: typeof jsonProperties === 'string' ? jsonProperties : JSON.stringify(jsonProperties),
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
function extractFromPagesArray(sessionId: string, pages: any[]): SessionIdeviceItem[] {
    const items: SessionIdeviceItem[] = [];

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        const page = pages[pageIdx];
        const pageId = page.id || `page_${pageIdx}`;
        const pageName = page.title || page.name || '';
        const parentPageId = page.parentId || null;

        const blocks = page.blocks || [];
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
            const blockId = block.id || `block_${blockIdx}`;
            const blockName = block.name || block.title || '';

            const components = block.components || [];
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
                const comp = components[compIdx];
                items.push({
                    odePageId: pageId,
                    odeParentPageId: parentPageId,
                    pageName: pageName,
                    navId: pageId,
                    ode_nav_structure_sync_id: pageId,
                    ode_session_id: sessionId,
                    ode_nav_structure_sync_order: pageIdx,
                    navIsActive: 1,
                    componentId: comp.id || `comp_${compIdx}`,
                    htmlViewer: comp.htmlView || comp.content || null,
                    jsonProperties: comp.jsonProperties ? JSON.stringify(comp.jsonProperties) : null,
                    ode_idevice_id: comp.ideviceId || comp.id || null,
                    odeIdeviceTypeName: comp.type || null,
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
    .get('/:odeSessionId/idevices', async ({ params, set }) => {
        const { odeSessionId } = params;

        // Get session from memory (using DI)
        const session = deps.getSession(odeSessionId);

        if (!session) {
            // Session not found - return empty data (not an error)
            // This can happen if the session expired or was never created
            console.log(`[Games] Session not found: ${odeSessionId}`);
            return {
                success: true,
                data: [],
            };
        }

        // Extract iDevices from session structure
        const data = extractIdevicesFromStructure(odeSessionId, session.structure);

        console.log(`[Games] Returning ${data.length} items for session ${odeSessionId}`);

        return {
            success: true,
            data,
        };
    }, {
        params: t.Object({
            odeSessionId: t.String(),
        }),
    });

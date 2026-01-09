/**
 * Yjs Persistence Service for Elysia
 * Handles storage and retrieval of Yjs document state using Kysely.
 *
 * Architecture:
 * - Supports both full state replacement AND incremental updates
 * - Incremental mode: saves small updates, compacts to snapshot when threshold reached
 * - Full state mode: replaces all data (simpler but slower for large docs)
 *
 * For large documents (>1MB), use incremental mode:
 * - saveIncrementalUpdate() for saving
 * - loadDocumentEfficient() for loading
 *
 * The client (browser) is the source of truth and decides when to save.
 */
import * as Y from 'yjs';
import {
    saveFullState as yjsSaveFullStateDefault,
    loadDocumentState as loadDocumentStateDefault,
    findUpdatesByProjectId as findUpdatesByProjectIdDefault,
    findUpdatesSince as yjsFindUpdatesSinceDefault,
    deleteAllUpdates as yjsDeleteAllUpdatesDefault,
    deleteUpdatesBefore as deleteUpdatesBeforeDefault,
    countUpdates as countUpdatesDefault,
    getLatestVersion as yjsGetLatestVersionDefault,
    findProjectByUuid as findProjectByUuidDefault,
    markProjectAsSaved as markProjectAsSavedDefault,
    getAllUpdateBuffers as getAllUpdateBuffersDefault,
    documentExists as yjsDocumentExistsDefault,
    // Incremental update functions
    saveIncrementalUpdate as yjsSaveIncrementalUpdateDefault,
    loadDocumentWithUpdates as loadDocumentWithUpdatesDefault,
    upsertSnapshot as upsertSnapshotDefault,
    deleteUpdatesUpToVersion as deleteUpdatesUpToVersionDefault,
    findSnapshotByProjectId as findSnapshotByProjectIdDefault,
} from '../db/queries';
import { db as defaultDb } from '../db/client';
import { getConfig, DEBUG } from './config';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { getLogger } from '../contexts/logger.context';

// Create logger for Yjs persistence
const logger = getLogger().child({ component: 'yjs-persistence' });

// ============================================================================
// DEPENDENCY INJECTION INTERFACES
// ============================================================================

/**
 * Query dependencies for Yjs persistence
 */
export interface YjsPersistenceQueries {
    saveFullState: typeof yjsSaveFullStateDefault;
    loadDocumentState: typeof loadDocumentStateDefault;
    findUpdatesByProjectId: typeof findUpdatesByProjectIdDefault;
    findUpdatesSince: typeof yjsFindUpdatesSinceDefault;
    deleteAllUpdates: typeof yjsDeleteAllUpdatesDefault;
    deleteUpdatesBefore: typeof deleteUpdatesBeforeDefault;
    countUpdates: typeof countUpdatesDefault;
    getLatestVersion: typeof yjsGetLatestVersionDefault;
    findProjectByUuid: typeof findProjectByUuidDefault;
    markProjectAsSaved: typeof markProjectAsSavedDefault;
    getAllUpdateBuffers: typeof getAllUpdateBuffersDefault;
    documentExists: typeof yjsDocumentExistsDefault;
    saveIncrementalUpdate: typeof yjsSaveIncrementalUpdateDefault;
    loadDocumentWithUpdates: typeof loadDocumentWithUpdatesDefault;
    upsertSnapshot: typeof upsertSnapshotDefault;
    deleteUpdatesUpToVersion: typeof deleteUpdatesUpToVersionDefault;
    findSnapshotByProjectId: typeof findSnapshotByProjectIdDefault;
}

/**
 * Full dependencies for Yjs persistence service
 */
export interface YjsPersistenceDependencies {
    db: Kysely<Database>;
    queries: YjsPersistenceQueries;
}

// Default queries using real implementations
const defaultQueries: YjsPersistenceQueries = {
    saveFullState: yjsSaveFullStateDefault,
    loadDocumentState: loadDocumentStateDefault,
    findUpdatesByProjectId: findUpdatesByProjectIdDefault,
    findUpdatesSince: yjsFindUpdatesSinceDefault,
    deleteAllUpdates: yjsDeleteAllUpdatesDefault,
    deleteUpdatesBefore: deleteUpdatesBeforeDefault,
    countUpdates: countUpdatesDefault,
    getLatestVersion: yjsGetLatestVersionDefault,
    findProjectByUuid: findProjectByUuidDefault,
    markProjectAsSaved: markProjectAsSavedDefault,
    getAllUpdateBuffers: getAllUpdateBuffersDefault,
    documentExists: yjsDocumentExistsDefault,
    saveIncrementalUpdate: yjsSaveIncrementalUpdateDefault,
    loadDocumentWithUpdates: loadDocumentWithUpdatesDefault,
    upsertSnapshot: upsertSnapshotDefault,
    deleteUpdatesUpToVersion: deleteUpdatesUpToVersionDefault,
    findSnapshotByProjectId: findSnapshotByProjectIdDefault,
};

// Default dependencies
const defaultDependencies: YjsPersistenceDependencies = {
    db: defaultDb,
    queries: defaultQueries,
};

// ============================================================================
// MODULE-LEVEL DEPENDENCIES (set via configure function)
// ============================================================================

let deps: YjsPersistenceDependencies = defaultDependencies;

/**
 * Configure dependencies for this module
 * Call this before using any persistence functions in tests
 */
export function configure(newDeps: Partial<YjsPersistenceDependencies>): void {
    deps = {
        ...defaultDependencies,
        ...newDeps,
        queries: {
            ...defaultQueries,
            ...(newDeps.queries || {}),
        },
    };
}

/**
 * Reset to default dependencies
 */
export function resetDependencies(): void {
    deps = defaultDependencies;
}

/**
 * Save full document state for a project
 * Replaces any existing state (not incremental)
 *
 * @param projectId - The project ID
 * @param state - Full Yjs document state (Y.encodeStateAsUpdate)
 * @param clientId - Optional client identifier
 */
export async function saveFullState(projectId: number, state: Uint8Array, clientId?: string): Promise<void> {
    try {
        const buffer = Buffer.from(state);
        await deps.queries.saveFullState(deps.db, projectId, buffer, clientId);

        if (DEBUG) {
            logger.debug('Saved full state', { projectId, bytes: buffer.length });
        }
    } catch (error: unknown) {
        logger.error('Failed to save', error instanceof Error ? error : null, { projectId });
        throw error;
    }
}

/**
 * Store a Yjs update for a project (immediate, no debounce)
 * For compatibility with existing code that uses incremental updates
 *
 * @deprecated Use saveFullState instead for explicit saves
 */
export async function storeUpdate(projectId: number, updateData: Uint8Array, clientId?: string): Promise<void> {
    await saveFullState(projectId, updateData, clientId);
}

/**
 * Load document state for a project
 * Returns the combined state as a single Uint8Array
 *
 * @param projectId - The project ID
 * @returns Document state or null if not found
 */
export async function loadDocument(projectId: number): Promise<Uint8Array | null> {
    try {
        const state = await deps.queries.loadDocumentState(deps.db, projectId);

        if (!state) {
            if (DEBUG) logger.debug('No document found', { projectId });
            return null;
        }

        if (DEBUG) logger.debug('Loaded project', { projectId, bytes: state.length });
        return state;
    } catch (error: unknown) {
        logger.error('Failed to load project', error instanceof Error ? error : null, { projectId });
        return null;
    }
}

/**
 * Load all updates for a project since a specific version
 *
 * @param projectId - The project ID
 * @param sinceVersion - Version to start from (exclusive)
 * @returns Array of update buffers
 */
export async function loadUpdatesSince(projectId: number, sinceVersion: string = '0'): Promise<Uint8Array[]> {
    try {
        const updates = await deps.queries.findUpdatesSince(deps.db, projectId, sinceVersion);

        if (DEBUG) {
            logger.debug('Loaded updates', { projectId, count: updates.length, sinceVersion });
        }

        return updates.map(update => new Uint8Array(update.update_data));
    } catch (error: unknown) {
        logger.error('Failed to load updates', error instanceof Error ? error : null, { projectId });
        throw error;
    }
}

/**
 * Load all updates for a project
 */
export async function loadAllUpdates(projectId: number): Promise<Uint8Array[]> {
    return loadUpdatesSince(projectId, '0');
}

/**
 * Get the latest version number for a project
 */
export async function getLatestVersion(projectId: number): Promise<string> {
    return deps.queries.getLatestVersion(deps.db, projectId);
}

/**
 * Reconstruct a Y.Doc from stored updates
 * Useful for server-side operations
 *
 * @param projectId - The project ID
 * @returns Reconstructed Y.Doc
 */
export async function reconstructDocument(projectId: number): Promise<Y.Doc> {
    const state = await loadDocument(projectId);
    const ydoc = new Y.Doc();

    if (state) {
        Y.applyUpdate(ydoc, state);
        if (DEBUG) logger.debug('Reconstructed Y.Doc', { projectId });
    }

    return ydoc;
}

/**
 * Delete all updates for a project
 *
 * @param projectId - The project ID
 * @returns Number of deleted updates
 */
export async function deleteAllUpdates(projectId: number): Promise<number> {
    try {
        await deps.queries.deleteAllUpdates(deps.db, projectId);
        const deletedCount = 1; // Kysely doesn't return changes count easily
        if (DEBUG) logger.debug('Deleted updates', { projectId });
        return deletedCount;
    } catch (error: unknown) {
        logger.error('Failed to delete updates', error instanceof Error ? error : null, { projectId });
        throw error;
    }
}

/**
 * Check if a document exists for a project
 */
export async function documentExists(projectId: number): Promise<boolean> {
    return deps.queries.documentExists(deps.db, projectId);
}

/**
 * Prune old updates before a specific version
 *
 * @param projectId - The project ID
 * @param beforeVersion - Version threshold (exclusive)
 * @returns Number of deleted updates
 */
export async function pruneUpdatesBefore(projectId: number, beforeVersion: string): Promise<number> {
    try {
        await deps.queries.deleteUpdatesBefore(deps.db, projectId, beforeVersion);

        if (DEBUG) {
            logger.debug('Pruned updates', { projectId, beforeVersion });
        }

        return 1; // Kysely doesn't return changes count easily
    } catch (error: unknown) {
        logger.error('Failed to prune', error instanceof Error ? error : null, { projectId });
        throw error;
    }
}

/**
 * Save document state by project UUID
 * Also marks project as savedOnce=true so it appears in project list
 */
export async function saveFullStateByUuid(projectUuid: string, state: Uint8Array, clientId?: string): Promise<boolean> {
    const project = await deps.queries.findProjectByUuid(deps.db, projectUuid);

    if (!project) {
        logger.warn('Project not found', { projectUuid });
        return false;
    }

    await saveFullState(project.id, state, clientId);

    // NOTE: We do NOT mark project as saved here.
    // Auto-persistence of Yjs documents is not the same as explicit user save.
    // Projects are marked as saved only when:
    // 1. User explicitly clicks "Save" button
    // 2. Collaboration starts (handled in yjs-websocket.ts)

    return true;
}

/**
 * Load document state by project UUID
 */
export async function loadDocumentByUuid(projectUuid: string): Promise<Uint8Array | null> {
    const project = await deps.queries.findProjectByUuid(deps.db, projectUuid);

    if (!project) {
        logger.warn('Project not found', { projectUuid });
        return null;
    }

    return loadDocument(project.id);
}

/**
 * No-op for backwards compatibility
 * In stateless relay mode, there's no debounce to flush
 */
export function forceFlush(_projectId: number): void {
    // No-op - no debounce in stateless relay mode
}

// ============================================================================
// INCREMENTAL UPDATE MODE (Optimized for large documents)
// ============================================================================

/**
 * Result of saving an incremental update
 */
export interface IncrementalSaveResult {
    success: boolean;
    compacted: boolean;
    bytesStored: number;
}

/**
 * Save an incremental Yjs update
 * Automatically compacts to snapshot when thresholds are reached
 *
 * @param projectId - The project ID
 * @param update - Yjs update binary data (Y.encodeStateAsUpdate or delta)
 * @param clientId - Optional client identifier
 * @returns Result with compaction status
 */
export async function saveIncrementalUpdate(
    projectId: number,
    update: Uint8Array,
    clientId?: string,
): Promise<IncrementalSaveResult> {
    try {
        const config = getConfig();

        // Save the incremental update
        const result = await deps.queries.saveIncrementalUpdate(
            deps.db,
            projectId,
            update,
            clientId,
            config.compactThresholdUpdates,
            config.compactThresholdBytes,
        );

        if (DEBUG) {
            logger.debug('Saved incremental update', {
                projectId,
                bytes: update.length,
                totalUpdates: result.stats.count,
            });
        }

        // If compaction is needed, do it now
        if (result.compacted) {
            await compactToSnapshot(projectId);
            if (DEBUG) {
                logger.debug('Compacted to snapshot', { projectId });
            }
        }

        return {
            success: true,
            compacted: result.compacted,
            bytesStored: update.length,
        };
    } catch (error: unknown) {
        logger.error('Failed to save incremental update', error instanceof Error ? error : null, { projectId });
        throw error;
    }
}

/**
 * Save an incremental update by project UUID
 */
export async function saveIncrementalUpdateByUuid(
    projectUuid: string,
    update: Uint8Array,
    clientId?: string,
): Promise<IncrementalSaveResult | null> {
    const project = await deps.queries.findProjectByUuid(deps.db, projectUuid);

    if (!project) {
        logger.warn('Project not found', { projectUuid });
        return null;
    }

    const result = await saveIncrementalUpdate(project.id, update, clientId);

    // NOTE: We do NOT mark project as saved here.
    // Auto-persistence of Yjs updates is not the same as explicit user save.
    // Projects are marked as saved only when:
    // 1. User explicitly clicks "Save" button
    // 2. Collaboration starts (handled in yjs-websocket.ts)

    return result;
}

/**
 * Compact all incremental updates into a snapshot
 * This merges all updates into a single snapshot for efficient loading
 *
 * @param projectId - The project ID
 */
export async function compactToSnapshot(projectId: number): Promise<void> {
    try {
        // Load current snapshot and all updates
        const { snapshot, updates } = await deps.queries.loadDocumentWithUpdates(deps.db, projectId);

        if (updates.length === 0 && !snapshot) {
            if (DEBUG) logger.debug('Nothing to compact', { projectId });
            return;
        }

        // Create Y.Doc and apply all data
        const doc = new Y.Doc();

        // Apply existing snapshot if any
        if (snapshot?.snapshot_data) {
            Y.applyUpdate(doc, new Uint8Array(snapshot.snapshot_data));
        }

        // Apply all incremental updates
        for (const update of updates) {
            Y.applyUpdate(doc, new Uint8Array(update.update_data));
        }

        // Encode full state
        const fullState = Y.encodeStateAsUpdate(doc);
        const newVersion = Date.now().toString();

        // Save as snapshot
        await deps.queries.upsertSnapshot(deps.db, projectId, fullState, newVersion);

        // Delete old updates (now included in snapshot)
        if (updates.length > 0) {
            const latestUpdateVersion = updates[updates.length - 1].version;
            await deps.queries.deleteUpdatesUpToVersion(deps.db, projectId, latestUpdateVersion);
        }

        // Cleanup
        doc.destroy();

        if (DEBUG) {
            logger.debug('Compacted updates into snapshot', {
                projectId,
                updatesCount: updates.length,
                bytes: fullState.length,
            });
        }
    } catch (error: unknown) {
        logger.error('Failed to compact', error instanceof Error ? error : null, { projectId });
        throw error;
    }
}

/**
 * Load document state efficiently
 * Uses snapshot + incremental updates for optimal performance
 *
 * @param projectId - The project ID
 * @returns Combined document state as Uint8Array
 */
export async function loadDocumentEfficient(projectId: number): Promise<Uint8Array | null> {
    try {
        const { snapshot, updates } = await deps.queries.loadDocumentWithUpdates(deps.db, projectId);

        // No data at all
        if (!snapshot && updates.length === 0) {
            if (DEBUG) logger.debug('No document found', { projectId });
            return null;
        }

        // Only snapshot, no updates - return directly
        if (snapshot && updates.length === 0) {
            if (DEBUG) {
                logger.debug('Loaded from snapshot', { projectId, bytes: snapshot.snapshot_data.length });
            }
            return new Uint8Array(snapshot.snapshot_data);
        }

        // Need to merge snapshot and updates
        const doc = new Y.Doc();

        if (snapshot?.snapshot_data) {
            Y.applyUpdate(doc, new Uint8Array(snapshot.snapshot_data));
        }

        for (const update of updates) {
            Y.applyUpdate(doc, new Uint8Array(update.update_data));
        }

        const state = Y.encodeStateAsUpdate(doc);
        doc.destroy();

        if (DEBUG) {
            logger.debug('Loaded merged snapshot + updates', {
                projectId,
                updatesCount: updates.length,
                bytes: state.length,
            });
        }

        return state;
    } catch (error: unknown) {
        logger.error('Failed to load project', error instanceof Error ? error : null, { projectId });
        return null;
    }
}

/**
 * Load document efficiently by project UUID
 */
export async function loadDocumentEfficientByUuid(projectUuid: string): Promise<Uint8Array | null> {
    const project = await deps.queries.findProjectByUuid(deps.db, projectUuid);

    if (!project) {
        logger.warn('Project not found', { projectUuid });
        return null;
    }

    return loadDocumentEfficient(project.id);
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { YjsUpdate } from '../../../entities/yjs-update.entity';
import * as Y from 'yjs';

/**
 * YjsPersistenceService - Stateless Relay Architecture
 *
 * Handles storage and retrieval of Yjs document state.
 * In the stateless relay architecture:
 * - No auto-save or debouncing
 * - Explicit saves from client via REST API
 * - Server stores full document state (not incremental updates)
 *
 * The client (browser) is the source of truth and decides when to save.
 */
@Injectable()
export class YjsPersistenceService {
    private readonly logger = new Logger(YjsPersistenceService.name);

    constructor(
        @InjectRepository(YjsUpdate)
        private readonly yjsUpdateRepository: Repository<YjsUpdate>,
    ) {}

    /**
     * Save full document state for a project
     * Replaces any existing state (not incremental)
     *
     * @param projectId - The project ID
     * @param state - Full Yjs document state (Y.encodeStateAsUpdate)
     * @param clientId - Optional client identifier
     */
    async saveFullState(projectId: number, state: Uint8Array, clientId?: string): Promise<void> {
        try {
            const buffer = Buffer.from(state);

            // Delete old updates for this project (we're saving full state)
            await this.yjsUpdateRepository
                .createQueryBuilder()
                .delete()
                .from(YjsUpdate)
                .where('projectId = :projectId', { projectId })
                .execute();

            // Save new full state as version 1
            const entity = new YjsUpdate();
            entity.projectId = projectId;
            entity.updateData = buffer;
            entity.version = '1';
            entity.clientId = clientId || null;

            await this.yjsUpdateRepository.save(entity);

            this.logger.log(
                `Saved full document state for project ${projectId} (${buffer.length} bytes)`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to save document state for project ${projectId}:`,
                error.message,
            );
            throw error;
        }
    }

    /**
     * Store a Yjs update for a project (immediate, no debounce)
     * For compatibility with existing code that uses incremental updates
     *
     * @deprecated Use saveFullState instead for explicit saves
     */
    async storeUpdate(projectId: number, updateData: Uint8Array, clientId?: string): Promise<void> {
        // In stateless relay mode, treat any update as a full state save
        await this.saveFullState(projectId, updateData, clientId);
    }

    /**
     * Load document state for a project
     * Returns the combined state as a single Uint8Array
     *
     * @param projectId - The project ID
     * @returns Document state or null if not found
     */
    async loadDocument(projectId: number): Promise<Uint8Array | null> {
        try {
            const updates = await this.yjsUpdateRepository.find({
                where: { projectId },
                order: { version: 'ASC' },
            });

            if (updates.length === 0) {
                this.logger.debug(`No document found for project ${projectId}`);
                return null;
            }

            // If only one update (full state), return it directly
            if (updates.length === 1) {
                const state = new Uint8Array(updates[0].updateData);
                this.logger.log(`Loaded document for project ${projectId}: ${state.length} bytes`);
                return state;
            }

            // Multiple updates - merge them into a single Y.Doc
            const ydoc = new Y.Doc();
            updates.forEach((update) => {
                Y.applyUpdate(ydoc, new Uint8Array(update.updateData));
            });

            const state = Y.encodeStateAsUpdate(ydoc);
            this.logger.log(
                `Loaded document for project ${projectId}: ${state.length} bytes from ${updates.length} updates`,
            );

            return state;
        } catch (error) {
            this.logger.error(`Failed to load document for project ${projectId}:`, error.message);
            return null;
        }
    }

    /**
     * Load all updates for a project since a specific version
     * Used for incremental sync scenarios
     *
     * @param projectId - The project ID
     * @param sinceVersion - Version to start from (exclusive)
     * @returns Array of update buffers
     */
    async loadUpdatesSince(projectId: number, sinceVersion: string = '0'): Promise<Buffer[]> {
        try {
            const updates = await this.yjsUpdateRepository.find({
                where: {
                    projectId,
                    version: MoreThan(sinceVersion),
                },
                order: { version: 'ASC' },
            });

            this.logger.log(
                `Loaded ${updates.length} updates for project ${projectId} since version ${sinceVersion}`,
            );

            return updates.map((update) => update.updateData);
        } catch (error) {
            this.logger.error(`Failed to load updates for project ${projectId}:`, error.message);
            throw error;
        }
    }

    /**
     * Load all updates for a project
     */
    async loadAllUpdates(projectId: number): Promise<Buffer[]> {
        return this.loadUpdatesSince(projectId, '0');
    }

    /**
     * Get the latest version number for a project
     */
    async getLatestVersion(projectId: number): Promise<string> {
        const result = await this.yjsUpdateRepository
            .createQueryBuilder('update')
            .select('MAX(CAST(update.version AS INTEGER))', 'maxVersion')
            .where('update.projectId = :projectId', { projectId })
            .getRawOne();

        const maxVersion = result?.maxVersion ? parseInt(result.maxVersion, 10) : 0;
        return maxVersion.toString();
    }

    /**
     * Reconstruct a Y.Doc from stored updates
     * Useful for server-side operations
     *
     * @param projectId - The project ID
     * @returns Reconstructed Y.Doc
     */
    async reconstructDocument(projectId: number): Promise<Y.Doc> {
        const state = await this.loadDocument(projectId);
        const ydoc = new Y.Doc();

        if (state) {
            Y.applyUpdate(ydoc, state);
            this.logger.log(`Reconstructed Y.Doc for project ${projectId}`);
        }

        return ydoc;
    }

    /**
     * Delete all updates for a project
     * Used when deleting a project
     *
     * @param projectId - The project ID
     * @returns Number of deleted updates
     */
    async deleteAllUpdates(projectId: number): Promise<number> {
        try {
            const result = await this.yjsUpdateRepository
                .createQueryBuilder()
                .delete()
                .from(YjsUpdate)
                .where('projectId = :projectId', { projectId })
                .execute();

            const deletedCount = result.affected || 0;
            this.logger.log(`Deleted ${deletedCount} updates for project ${projectId}`);

            return deletedCount;
        } catch (error) {
            this.logger.error(`Failed to delete updates for project ${projectId}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if a document exists for a project
     *
     * @param projectId - The project ID
     * @returns true if document exists
     */
    async documentExists(projectId: number): Promise<boolean> {
        const count = await this.yjsUpdateRepository.count({
            where: { projectId },
        });
        return count > 0;
    }

    /**
     * Prune old updates before a specific version
     * Called after snapshot creation to free up space
     *
     * @param projectId - The project ID
     * @param beforeVersion - Version threshold (exclusive)
     * @returns Number of deleted updates
     */
    async pruneUpdatesBefore(projectId: number, beforeVersion: string): Promise<number> {
        try {
            const result = await this.yjsUpdateRepository
                .createQueryBuilder()
                .delete()
                .from(YjsUpdate)
                .where('projectId = :projectId', { projectId })
                .andWhere('CAST(version AS INTEGER) < :beforeVersion', {
                    beforeVersion: parseInt(beforeVersion, 10),
                })
                .execute();

            const deletedCount = result.affected || 0;

            this.logger.log(
                `Pruned ${deletedCount} updates for project ${projectId} before version ${beforeVersion}`,
            );

            return deletedCount;
        } catch (error) {
            this.logger.error(`Failed to prune updates for project ${projectId}:`, error.message);
            throw error;
        }
    }

    /**
     * No-op for backwards compatibility
     * In stateless relay mode, there's no debounce to flush
     *
     * @deprecated No longer needed in stateless relay mode
     */
    async forceFlush(projectId: number): Promise<void> {
        // No-op - no debounce in stateless relay mode
        this.logger.debug(`forceFlush called for project ${projectId} - no-op in stateless mode`);
    }

    /**
     * No-op for backwards compatibility
     * In stateless relay mode, there's no pending updates to flush
     *
     * @deprecated No longer needed in stateless relay mode
     */
    async onModuleDestroy() {
        // No-op - nothing to flush
        this.logger.log('YjsPersistenceService shutdown - no pending updates in stateless mode');
    }
}

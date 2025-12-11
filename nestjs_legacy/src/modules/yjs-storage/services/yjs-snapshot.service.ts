import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YjsDocument } from '../../../entities/yjs-document.entity';
import { YjsPersistenceService } from './yjs-persistence.service';
import * as Y from 'yjs';

/**
 * YjsSnapshotService
 * Handles creation and management of Yjs document snapshots.
 * Snapshots are periodically created to allow fast document loading
 * without replaying all updates from the beginning.
 */
@Injectable()
export class YjsSnapshotService {
    private readonly logger = new Logger(YjsSnapshotService.name);

    constructor(
        @InjectRepository(YjsDocument)
        private readonly yjsDocumentRepository: Repository<YjsDocument>,
        private readonly persistenceService: YjsPersistenceService,
    ) {}

    /**
     * Create or update a snapshot for a project
     * Consolidates all updates into a single snapshot
     */
    async createSnapshot(projectId: number): Promise<YjsDocument> {
        try {
            this.logger.log(`Creating snapshot for project ${projectId}...`);

            // Reconstruct the document from all updates
            const ydoc = await this.persistenceService.reconstructDocument(projectId);

            // Get the current version
            const latestVersion = await this.persistenceService.getLatestVersion(projectId);

            // Encode the entire document state as a snapshot
            const snapshotData = Y.encodeStateAsUpdate(ydoc);
            const snapshotBuffer = Buffer.from(snapshotData);

            // Check if a snapshot already exists for this project
            let yjsDocument = await this.yjsDocumentRepository.findOne({
                where: { projectId },
            });

            if (yjsDocument) {
                // Update existing snapshot
                yjsDocument.snapshotData = snapshotBuffer;
                yjsDocument.snapshotVersion = latestVersion;
            } else {
                // Create new snapshot
                yjsDocument = new YjsDocument();
                yjsDocument.projectId = projectId;
                yjsDocument.snapshotData = snapshotBuffer;
                yjsDocument.snapshotVersion = latestVersion;
            }

            // Save the snapshot
            await this.yjsDocumentRepository.save(yjsDocument);

            this.logger.log(
                `Snapshot created for project ${projectId} at version ${latestVersion} (size: ${snapshotBuffer.length} bytes)`,
            );

            // Prune old updates before this snapshot
            const prunedCount = await this.persistenceService.pruneUpdatesBefore(
                projectId,
                latestVersion,
            );

            this.logger.log(
                `Pruned ${prunedCount} updates before version ${latestVersion} for project ${projectId}`,
            );

            return yjsDocument;
        } catch (error) {
            this.logger.error(`Failed to create snapshot for project ${projectId}:`, error.message);
            throw error;
        }
    }

    /**
     * Load the latest snapshot for a project
     * Returns null if no snapshot exists
     */
    async loadSnapshot(projectId: number): Promise<Buffer | null> {
        try {
            const yjsDocument = await this.yjsDocumentRepository.findOne({
                where: { projectId },
            });

            if (!yjsDocument) {
                this.logger.log(`No snapshot found for project ${projectId}`);
                return null;
            }

            this.logger.log(
                `Loaded snapshot for project ${projectId} (version: ${yjsDocument.snapshotVersion}, size: ${yjsDocument.snapshotData.length} bytes)`,
            );

            return yjsDocument.snapshotData;
        } catch (error) {
            this.logger.error(`Failed to load snapshot for project ${projectId}:`, error.message);
            throw error;
        }
    }

    /**
     * Load a complete Y.Doc for a project
     * Combines snapshot (if exists) with incremental updates
     */
    async loadCompleteDocument(projectId: number): Promise<Y.Doc> {
        const ydoc = new Y.Doc();

        try {
            // Load snapshot if exists
            const snapshot = await this.loadSnapshot(projectId);
            let snapshotVersion = '0';

            if (snapshot) {
                Y.applyUpdate(ydoc, new Uint8Array(snapshot));

                // Get snapshot version
                const yjsDocument = await this.yjsDocumentRepository.findOne({
                    where: { projectId },
                });
                snapshotVersion = yjsDocument?.snapshotVersion || '0';

                this.logger.log(
                    `Applied snapshot for project ${projectId} at version ${snapshotVersion}`,
                );
            }

            // Load and apply updates since snapshot
            const updates = await this.persistenceService.loadUpdatesSince(
                projectId,
                snapshotVersion,
            );

            updates.forEach((updateBuffer) => {
                Y.applyUpdate(ydoc, new Uint8Array(updateBuffer));
            });

            if (updates.length > 0) {
                this.logger.log(
                    `Applied ${updates.length} incremental updates for project ${projectId} since version ${snapshotVersion}`,
                );
            }

            return ydoc;
        } catch (error) {
            this.logger.error(
                `Failed to load complete document for project ${projectId}:`,
                error.message,
            );
            throw error;
        }
    }

    /**
     * Get snapshot metadata for a project
     */
    async getSnapshotInfo(projectId: number): Promise<{
        exists: boolean;
        version?: string;
        size?: number;
        createdAt?: Date;
        updatedAt?: Date;
    }> {
        const yjsDocument = await this.yjsDocumentRepository.findOne({
            where: { projectId },
        });

        if (!yjsDocument) {
            return { exists: false };
        }

        return {
            exists: true,
            version: yjsDocument.snapshotVersion,
            size: yjsDocument.snapshotData.length,
            createdAt: yjsDocument.createdAt || undefined,
            updatedAt: yjsDocument.updatedAt || undefined,
        };
    }

    /**
     * Delete a snapshot for a project
     * Usually called when deleting a project
     */
    async deleteSnapshot(projectId: number): Promise<void> {
        try {
            await this.yjsDocumentRepository.delete({ projectId });
            this.logger.log(`Deleted snapshot for project ${projectId}`);
        } catch (error) {
            this.logger.error(`Failed to delete snapshot for project ${projectId}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if a project needs a snapshot
     * Returns true if update count exceeds threshold
     */
    async needsSnapshot(projectId: number, threshold: number = 100): Promise<boolean> {
        const snapshotInfo = await this.getSnapshotInfo(projectId);

        if (!snapshotInfo.exists) {
            // No snapshot exists, check if we have any updates
            const latestVersion = await this.persistenceService.getLatestVersion(projectId);
            return parseInt(latestVersion, 10) >= threshold;
        }

        // Snapshot exists, check updates since snapshot
        const latestVersion = await this.persistenceService.getLatestVersion(projectId);
        const updatesSinceSnapshot =
            parseInt(latestVersion, 10) - parseInt(snapshotInfo.version!, 10);

        return updatesSinceSnapshot >= threshold;
    }
}

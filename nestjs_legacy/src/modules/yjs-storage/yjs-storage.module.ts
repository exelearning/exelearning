import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YjsDocument } from '../../entities/yjs-document.entity';
import { YjsUpdate } from '../../entities/yjs-update.entity';
import { YjsPersistenceService } from './services/yjs-persistence.service';
import { YjsSnapshotService } from './services/yjs-snapshot.service';
import { ElpToYjsService } from './services/elp-to-yjs.service';

/**
 * YjsStorageModule
 * Provides services for storing and retrieving Yjs documents.
 * Supports incremental update storage and periodic snapshot creation.
 */
@Module({
    imports: [TypeOrmModule.forFeature([YjsDocument, YjsUpdate])],
    providers: [YjsPersistenceService, YjsSnapshotService, ElpToYjsService],
    exports: [YjsPersistenceService, YjsSnapshotService, ElpToYjsService],
})
export class YjsStorageModule {}

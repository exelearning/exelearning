import { Module } from '@nestjs/common';
import { FilemanagerController } from './controllers/filemanager.controller';
import { FilemanagerService } from './services/filemanager.service';
import { FileManagementModule } from '../file-management/file-management.module';

/**
 * FilemanagerModule
 *
 * Provides FileGator-based file management interface for session directories.
 * Allows users to upload, download, organize, and manage files within their project sessions.
 *
 * Migrated from Symfony's FilemanagerMethodController
 * @see symfony_legacy/src/Controller/net/exelearning/Controller/Filemanager/FilemanagerMethodController.php
 */
@Module({
    imports: [FileManagementModule],
    controllers: [FilemanagerController],
    providers: [FilemanagerService],
    exports: [FilemanagerService],
})
export class FilemanagerModule {}

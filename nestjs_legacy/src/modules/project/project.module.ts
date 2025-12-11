import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileManagementModule } from '../file-management/file-management.module';
import { XmlModule } from '../xml/xml.module';
import { ExportModule } from '../export/export.module';
import { SessionModule } from '../session/session.module';
import { IDeviceModule } from '../idevice/idevice.module';
import { ProjectsModule } from '../projects/projects.module';
import { YjsStorageModule } from '../yjs-storage/yjs-storage.module';
import { ThemeModule } from '../theme/theme.module';
import { ProjectOpenService } from './services/project-open.service';
import { ProjectImportService } from './services/project-import.service';
import { LinkValidatorService } from './services/link-validator.service';
import { UsedFilesService } from './services/used-files.service';
import { ProjectController } from './controllers/project.controller';
import { SymfonyCompatController } from './controllers/symfony-compat.controller';

@Module({
    imports: [
        ConfigModule,
        FileManagementModule,
        XmlModule,
        forwardRef(() => SessionModule),
        forwardRef(() => IDeviceModule),
        forwardRef(() => ExportModule),
        forwardRef(() => ProjectsModule),
        YjsStorageModule,
        ThemeModule,
    ],
    controllers: [ProjectController, SymfonyCompatController],
    providers: [ProjectOpenService, ProjectImportService, LinkValidatorService, UsedFilesService],
    exports: [ProjectOpenService, ProjectImportService, LinkValidatorService, UsedFilesService],
})
export class ProjectModule {}

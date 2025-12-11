import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../entities/project.entity';
import { User } from '../../entities/user.entity';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectsService } from './services/projects.service';
import { YjsStorageModule } from '../yjs-storage/yjs-storage.module';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

/**
 * ProjectsModule
 * Handles project CRUD operations and Yjs document management
 * for the new Yjs-based architecture.
 *
 * Note: This is a new module separate from the legacy ProjectModule
 * which handles the old ODE-based project structure.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Project, User]),
        YjsStorageModule,
        forwardRef(() => AuthModule),
    ],
    controllers: [ProjectsController],
    providers: [ProjectsService, OptionalJwtAuthGuard],
    exports: [ProjectsService],
})
export class ProjectsModule {}

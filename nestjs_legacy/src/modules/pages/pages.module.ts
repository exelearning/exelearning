import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
    imports: [AuthModule, ProjectsModule],
    controllers: [PagesController],
})
export class PagesModule {}

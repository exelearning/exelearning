import { Module } from '@nestjs/common';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

/**
 * Resources Module
 * Provides API endpoints for listing resource files (themes, iDevices, libraries)
 * used by client-side exports.
 */
@Module({
    controllers: [ResourcesController],
    providers: [ResourcesService],
    exports: [ResourcesService],
})
export class ResourcesModule {}

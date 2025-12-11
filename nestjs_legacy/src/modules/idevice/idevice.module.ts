import { Module, forwardRef } from '@nestjs/common';
import { IDeviceService } from './services/idevice.service';
import { FileManagementModule } from '../file-management/file-management.module';
import { ProjectModule } from '../project/project.module';

/**
 * IDeviceModule - Manages iDevice definitions (installed iDevices)
 * NOTE: IDeviceCrudService, DtoTransformerService, and IDeviceCrudController were removed
 * as they depended on ODE*Sync entities which are now replaced by Yjs
 * iDevice data is now managed via Yjs documents, not the database
 */
@Module({
    imports: [
        FileManagementModule,
        forwardRef(() => ProjectModule),
    ],
    providers: [IDeviceService],
    exports: [IDeviceService],
})
export class IDeviceModule {}

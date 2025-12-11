import { Module, forwardRef } from '@nestjs/common';
import { SessionManagerService } from './session-manager.service';
import { ProjectModule } from '../project/project.module';

/**
 * SessionModule
 *
 * Centralized module for session management.
 * Provides SessionManagerService to handle all session lifecycle operations.
 *
 * NOTE: With Yjs as the source of truth, ODE*Sync modules are no longer needed.
 * Session management now relies on in-memory sessions and Yjs awareness.
 */
@Module({
    imports: [forwardRef(() => ProjectModule)],
    providers: [SessionManagerService],
    exports: [SessionManagerService],
})
export class SessionModule {}

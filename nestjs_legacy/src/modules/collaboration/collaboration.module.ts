import { Module, forwardRef } from '@nestjs/common';
import { YjsWebSocketService } from './services/yjs-websocket.service';
import { AssetCoordinatorService } from './services/asset-coordinator.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { AssetsModule } from '../assets/assets.module';

/**
 * CollaborationModule
 *
 * Provides WebSocket-based real-time collaboration using Yjs.
 *
 * Architecture (Stateless Relay):
 * - YjsWebSocketService runs on the same port as NestJS (3001 by default)
 * - Server is a pure relay - NO Y.Doc in memory
 * - Simply forwards messages between connected clients
 * - Persistence handled by clients via REST API
 *
 * Security:
 * - JWT token required in WebSocket connection query string (?token=...)
 * - Project access validated before allowing connection
 *
 * Asset Coordination:
 * - AssetCoordinatorService handles peer-to-peer asset prefetching
 * - Tracks which clients have which assets
 * - Routes upload requests between peers
 * - Triggers background prefetch when collaboration detected
 *
 * Clients connect using y-websocket's WebsocketProvider:
 * ws://localhost:3001/yjs/<documentName>?token=<jwt>
 *
 * Document naming convention: project-<uuid>
 */
@Module({
    imports: [
        forwardRef(() => AuthModule),
        forwardRef(() => ProjectsModule),
        forwardRef(() => AssetsModule),
    ],
    providers: [YjsWebSocketService, AssetCoordinatorService],
    exports: [YjsWebSocketService, AssetCoordinatorService],
})
export class CollaborationModule {}

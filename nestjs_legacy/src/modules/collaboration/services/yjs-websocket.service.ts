import { Injectable, Logger, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import { AuthService } from '../../auth/auth.service';
import { ProjectsService } from '../../projects/services/projects.service';
import { AssetCoordinatorService, AssetMessage } from './asset-coordinator.service';
import { getBasePath } from '../../../utils/basepath.util';

/**
 * Client metadata stored per connection
 */
interface ClientMeta {
    userId: number;
    projectUuid: string;
    clientId: string;
    connectedAt: Date;
}

/**
 * Room - tracks connected clients for a document
 * No Y.Doc in memory - just connection tracking
 */
interface Room {
    name: string;
    conns: Set<WsWebSocket>;
    projectUuid: string;
}

/**
 * YjsWebSocketService - Stateless Relay Architecture with Authentication
 *
 * A pure WebSocket relay for Yjs synchronization.
 * The server does NOT maintain Y.Doc in memory - it simply relays messages.
 *
 * Key characteristics:
 * - No server-side Y.Doc (zero memory per document)
 * - No server-side persistence (client saves via REST API)
 * - Just forwards messages between connected clients
 * - Client is the source of truth (IndexedDB + in-memory Y.Doc)
 *
 * Security:
 * - JWT token required in query string (?token=...)
 * - Project access validated before allowing connection
 * - User ID tracked per connection for audit/coordination
 *
 * Protocol:
 * - Binary messages: Yjs sync/awareness (relayed to room)
 * - JSON messages: Asset coordination protocol (handled separately)
 *
 * Clients connect using y-websocket's WebsocketProvider:
 * ws://localhost:3001/yjs/project-<uuid>?token=<jwt>
 *
 * Document naming convention: project-<uuid>
 */
@Injectable()
export class YjsWebSocketService implements OnModuleDestroy {
    private readonly logger = new Logger(YjsWebSocketService.name);
    private wss: WebSocketServer | null = null;
    private initialized = false;

    /**
     * Room store - just tracks connections per document
     * No Y.Doc, no state, no persistence
     */
    private readonly rooms = new Map<string, Room>();

    /**
     * Client metadata store - tracks user info per connection
     */
    private readonly clientMeta = new WeakMap<WsWebSocket, ClientMeta>();

    /**
     * Generate unique client ID
     */
    private generateClientId(): string {
        return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    constructor(
        private readonly configService: ConfigService,
        private readonly httpAdapterHost: HttpAdapterHost,
        @Inject(forwardRef(() => AuthService))
        private readonly authService: AuthService,
        @Inject(forwardRef(() => ProjectsService))
        private readonly projectsService: ProjectsService,
        @Inject(forwardRef(() => AssetCoordinatorService))
        private readonly assetCoordinator: AssetCoordinatorService,
    ) {}

    /**
     * Initialize the WebSocket server attached to the HTTP server
     * Called from main.ts after the app starts listening
     */
    initialize(httpServer: Server): void {
        if (this.initialized) {
            this.logger.warn('YjsWebSocketService already initialized');
            return;
        }

        this.logger.log('YjsWebSocketService.initialize() - attaching to HTTP server...');
        try {
            this.startServer(httpServer);
            this.initialized = true;
        } catch (error) {
            this.logger.error('Failed to start WebSocket relay server:', error.message);
            this.logger.error('Stack trace:', error.stack);
        }
    }

    /**
     * Cleanup on module shutdown
     */
    async onModuleDestroy(): Promise<void> {
        await this.stopServer();
    }

    /**
     * Start the WebSocket server attached to the HTTP server
     * Handles upgrade requests on paths starting with /yjs/
     */
    private startServer(httpServer: Server): void {
        this.logger.log('Creating WebSocket relay server attached to HTTP server...');

        // Create WebSocket server without a port - we'll handle upgrades manually
        this.wss = new WebSocketServer({ noServer: true, perMessageDeflate: true });

        this.wss.on('connection', (conn: WsWebSocket, req: IncomingMessage) => {
            this.handleConnection(conn, req);
        });

        this.wss.on('error', (error: Error) => {
            this.logger.error('WebSocket server error:', error.message);
        });

        // Handle HTTP upgrade requests for {basePath}/yjs/ paths
        httpServer.on('upgrade', async (request, socket, head) => {
            const pathname = request.url?.split('?')[0] || '';
            const basePath = getBasePath();
            const yjsPathPrefix = basePath ? `${basePath}/yjs/` : '/yjs/';

            // Only handle {basePath}/yjs/ paths
            if (!pathname.startsWith(yjsPathPrefix)) {
                socket.destroy();
                return;
            }

            // Parse URL and extract parameters
            const url = new URL(request.url || '', `http://${request.headers.host}`);
            const token = url.searchParams.get('token');
            const yjsPrefixRegex = new RegExp(`^${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/yjs/`);
            const docName = pathname.replace(yjsPrefixRegex, '').replace(/^\/+/, '');

            // Extract project UUID from document name (format: project-<uuid>)
            const projectUuid = this.extractProjectUuid(docName);
            if (!projectUuid) {
                this.logger.warn(`Invalid document name format: ${docName}`);
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
                socket.destroy();
                return;
            }

            // Validate JWT token
            if (!token) {
                this.logger.warn(`WebSocket connection without token for ${docName}`);
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            const user = await this.authService.validateToken(token);
            if (!user) {
                this.logger.warn(`Invalid token for WebSocket connection to ${docName}`);
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            // Check project access
            const access = await this.projectsService.checkAccessByUuid(projectUuid, user.id);
            if (!access.hasAccess) {
                this.logger.warn(
                    `User ${user.id} denied access to project ${projectUuid}: ${access.reason}`,
                );
                socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                socket.destroy();
                return;
            }

            // Store auth info for use in connection handler
            (request as any)._authUser = user;
            (request as any)._projectUuid = projectUuid;

            this.wss?.handleUpgrade(request, socket, head, (ws) => {
                this.wss?.emit('connection', ws, request);
            });
        });

        const port = this.configService.get<number>('NEST_PORT') || 3001;
        const basePath = getBasePath();
        this.logger.log(`y-websocket relay server attached to HTTP server on port ${port}`);
        this.logger.log(`Clients should connect to: ws://localhost:${port}${basePath}/yjs/<documentName>`);
        this.logger.log('Server is STATELESS - no Y.Doc in memory, pure relay');
    }

    /**
     * Stop the WebSocket server and cleanup all resources
     */
    private async stopServer(): Promise<void> {
        this.logger.log('Stopping WebSocket relay server...');

        // Close all connections
        if (this.wss) {
            this.wss.clients.forEach((client) => {
                client.close();
            });
            this.wss.close();
            this.wss = null;
        }

        // Clear room store
        this.rooms.clear();
        this.initialized = false;

        this.logger.log('WebSocket relay server stopped');
    }

    /**
     * Extract project UUID from document name
     * Expected format: project-<uuid>
     */
    private extractProjectUuid(docName: string): string | null {
        const match = docName.match(/^project-([0-9a-f-]{36})$/i);
        return match ? match[1] : null;
    }

    /**
     * Handle new WebSocket connection
     *
     * Protocol:
     * 1. Extract auth info from request (set by upgrade handler)
     * 2. Get or create room for the document
     * 3. Store client metadata
     * 4. Setup message handlers for relay
     */
    private handleConnection(conn: WsWebSocket, req: IncomingMessage): void {
        // Extract document name from URL path
        const docName = this.getDocNameFromUrl(req.url);
        if (!docName) {
            this.logger.warn('Connection without document name, closing');
            conn.close(4000, 'Document name required');
            return;
        }

        // Get auth info set by upgrade handler
        const user = (req as any)._authUser;
        const projectUuid = (req as any)._projectUuid;

        if (!user || !projectUuid) {
            this.logger.warn('Connection without auth info, closing');
            conn.close(4001, 'Authentication required');
            return;
        }

        // Generate client ID and store metadata
        const clientId = this.generateClientId();
        const meta: ClientMeta = {
            userId: user.id,
            projectUuid,
            clientId,
            connectedAt: new Date(),
        };
        this.clientMeta.set(conn, meta);

        this.logger.log(`User ${user.id} (${user.email}) connecting to project ${projectUuid}`);

        // Get or create room
        const room = this.getOrCreateRoom(docName, projectUuid);
        room.conns.add(conn);

        // Register with asset coordinator
        this.assetCoordinator.registerClient(projectUuid, clientId, conn);

        // Setup message handler - route JSON to coordinator, relay binary to room
        conn.on('message', (message: Buffer) => {
            this.handleMessage(conn, room, meta, message);
        });

        // Handle connection close
        conn.on('close', () => {
            this.handleClose(conn, room, docName, meta);
        });

        // Handle errors
        conn.on('error', (error: Error) => {
            this.logger.error(`Connection error for ${docName}:`, error.message);
            room.conns.delete(conn);
            this.assetCoordinator.unregisterClient(projectUuid, clientId);
        });

        const clientCount = room.conns.size;
        this.logger.log(
            `Client ${clientId} connected to ${docName} (${clientCount} total connections)`,
        );

        // Detect collaboration (2nd+ client) and trigger asset prefetch
        if (clientCount > 1) {
            this.logger.log(
                `Collaboration detected in project ${projectUuid}, triggering asset sync`,
            );
            // Async - don't block connection
            this.assetCoordinator.onCollaborationDetected(projectUuid).catch((err) => {
                this.logger.error('Error in collaboration detection:', err);
            });
        }
    }

    /**
     * Get or create a room for a document name
     * Just tracks connections - no Y.Doc
     */
    private getOrCreateRoom(docName: string, projectUuid?: string): Room {
        let room = this.rooms.get(docName);

        if (!room) {
            room = {
                name: docName,
                conns: new Set(),
                projectUuid: projectUuid || this.extractProjectUuid(docName) || docName,
            };
            this.rooms.set(docName, room);
            this.logger.log(`Created new room: ${docName} for project ${room.projectUuid}`);
        }

        return room;
    }

    /**
     * Handle incoming message
     * Routes JSON messages to asset coordinator, relays binary Yjs updates
     */
    private handleMessage(
        sender: WsWebSocket,
        room: Room,
        meta: ClientMeta,
        message: Buffer,
    ): void {
        // Try to detect if it's a JSON message (asset coordination)
        // JSON messages start with { and are valid UTF-8
        if (message.length > 0 && message[0] === 0x7b) {
            // 0x7b = '{'
            try {
                const jsonStr = message.toString('utf8');
                const parsed = JSON.parse(jsonStr) as AssetMessage;

                // Check if it's an asset-related message
                if (this.assetCoordinator.isAssetMessage(parsed.type)) {
                    this.assetCoordinator
                        .handleMessage(meta.projectUuid, meta.clientId, parsed)
                        .catch((err) => {
                            this.logger.error('Error handling asset message:', err);
                        });
                    return; // Don't relay asset messages
                }
            } catch {
                // Not valid JSON, treat as binary Yjs message
            }
        }

        // Relay binary Yjs message to other clients
        this.relayMessage(sender, room, message);
    }

    /**
     * Relay message to all other clients in the room
     * No interpretation of Yjs protocol - just forward the bytes
     */
    private relayMessage(sender: WsWebSocket, room: Room, message: Buffer): void {
        // Forward to all other clients in the room
        for (const conn of room.conns) {
            if (conn !== sender && conn.readyState === conn.OPEN) {
                conn.send(message);
            }
        }
    }

    /**
     * Handle connection close
     * Cleanup and remove empty rooms
     */
    private handleClose(conn: WsWebSocket, room: Room, docName: string, meta?: ClientMeta): void {
        room.conns.delete(conn);

        // Unregister from asset coordinator
        if (meta) {
            this.assetCoordinator.unregisterClient(meta.projectUuid, meta.clientId);
        }

        this.logger.log(
            `Client ${meta?.clientId || 'unknown'} disconnected from ${docName} (${room.conns.size} remaining)`,
        );

        // If no more connections, schedule room cleanup
        if (room.conns.size === 0) {
            this.scheduleRoomCleanup(docName, room.projectUuid);
        }
    }

    /**
     * Schedule room cleanup when no clients are connected
     * Wait a bit in case clients reconnect
     */
    private scheduleRoomCleanup(docName: string, projectUuid?: string): void {
        const CLEANUP_DELAY = 30000; // 30 seconds

        setTimeout(() => {
            const room = this.rooms.get(docName);
            // Check if still no connections
            if (room && room.conns.size === 0) {
                this.logger.log(`Cleaning up room ${docName} (no connections)`);
                this.rooms.delete(docName);

                // Cleanup asset coordinator for this project
                if (projectUuid || room.projectUuid) {
                    this.assetCoordinator.cleanupProject(projectUuid || room.projectUuid);
                }
            }
        }, CLEANUP_DELAY);
    }

    /**
     * Extract document name from WebSocket URL
     * URL format: ws://host:port/yjs/<docName> or ws://host:port/yjs/<docName>?params
     */
    private getDocNameFromUrl(url: string | undefined): string | null {
        if (!url) return null;

        // Remove query params
        const pathOnly = url.split('?')[0];

        // Remove /yjs/ prefix and leading slashes
        const docName = pathOnly.replace(/^\/yjs\//, '').replace(/^\/+/, '');

        return docName || null;
    }

    /**
     * Get server info for debugging/monitoring
     */
    getServerInfo(): {
        port: number;
        isRunning: boolean;
        roomsCount: number;
        totalConnections: number;
        mode: string;
    } {
        let totalConnections = 0;
        for (const room of this.rooms.values()) {
            totalConnections += room.conns.size;
        }

        const port = this.configService.get<number>('NEST_PORT') || 3001;
        return {
            port,
            isRunning: !!this.wss,
            roomsCount: this.rooms.size,
            totalConnections,
            mode: 'stateless-relay',
        };
    }

    /**
     * Get room names currently active
     */
    getActiveRooms(): string[] {
        return Array.from(this.rooms.keys());
    }
}

/**
 * MCP HTTP Routes
 *
 * HTTP endpoints for MCP (Model Context Protocol) server.
 * Supports both HTTP Streamable and WebSocket transports.
 */
import { Elysia } from 'elysia';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer, closeSession } from '../mcp/server';
import { authenticateRequest, errorResponse } from './api/v1/types';
import { verifyToken } from './auth';
import { WebSocketServerTransport, type McpWebSocketData } from '../mcp/websocket-transport';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Map of session ID to HTTP transport for managing persistent HTTP connections.
 */
const sessionTransports = new Map<string, WebStandardStreamableHTTPServerTransport>();

/**
 * Map of session ID to WebSocket transport for managing persistent WS connections.
 */
const wsTransports = new Map<string, { transport: WebSocketServerTransport; server: McpServer }>();

// ============================================================================
// ROUTES
// ============================================================================

export const mcpRoutes = new Elysia({ prefix: '/mcp' })
    /**
     * Handle CORS preflight for MCP endpoint.
     * OPTIONS requests don't include auth headers, so we handle them separately.
     */
    .options('/', ({ set }) => {
        set.status = 204;
        return '';
    })

    /**
     * MCP Streamable HTTP endpoint.
     *
     * Handles all MCP communication via HTTP:
     * - POST: Send messages (initialize, tool calls, resource reads)
     * - GET: Server-Sent Events stream for server-to-client messages
     * - DELETE: Close session
     */
    .all('/', async ({ request, headers, set }) => {
        // Authenticate the request
        const authResult = await authenticateRequest(headers);
        if (!authResult.success) {
            set.status = authResult.status;
            return authResult.response;
        }
        const auth = authResult.user;

        // Get or generate session ID
        const mcpSessionHeader = headers['mcp-session-id'];
        const sessionId = typeof mcpSessionHeader === 'string' ? mcpSessionHeader : crypto.randomUUID();

        // Get or create transport for this session
        let transport = sessionTransports.get(sessionId);

        if (!transport) {
            transport = new WebStandardStreamableHTTPServerTransport({
                sessionIdGenerator: () => sessionId,
                enableJsonResponse: true,
                onsessioninitialized: id => {
                    console.log(`[MCP] Session initialized: ${id}`);
                },
                onsessionclosed: id => {
                    console.log(`[MCP] Session closed: ${id}`);
                    sessionTransports.delete(id);
                },
            });

            sessionTransports.set(sessionId, transport);

            // Create and connect MCP server for this session
            const server = createMcpServer({
                authToken: headers['authorization'] || '',
                user: {
                    userId: auth.userId,
                    email: auth.email,
                    roles: auth.roles,
                },
            });

            // Wait for server to connect before handling requests
            try {
                await server.connect(transport);
            } catch (err) {
                console.error('[MCP] Failed to connect server:', err);
                sessionTransports.delete(sessionId);
                set.status = 500;
                return errorResponse('MCP_INIT_ERROR', 'Failed to initialize MCP server');
            }
        }

        // Handle the request
        try {
            return await transport.handleRequest(request);
        } catch (error) {
            console.error('[MCP] Request handling error:', error);
            set.status = 500;
            return errorResponse('MCP_ERROR', error instanceof Error ? error.message : 'MCP request failed');
        }
    })

    /**
     * Session info endpoint.
     */
    .get('/info', async ({ headers, set }) => {
        const authResult = await authenticateRequest(headers);
        if (!authResult.success) {
            set.status = authResult.status;
            return authResult.response;
        }

        return {
            success: true,
            data: {
                name: 'exelearning-mcp-server',
                version: '1.0.0',
                transports: ['streamable-http', 'websocket'],
                endpoints: {
                    http: '/mcp',
                    websocket: '/mcp/ws',
                    info: '/mcp/info',
                },
                tools: [
                    'projects.list',
                    'projects.create',
                    'projects.get',
                    'projects.update',
                    'projects.delete',
                    'projects.duplicate',
                    'pages.list',
                    'pages.create',
                    'pages.get',
                    'pages.update',
                    'pages.delete',
                    'pages.move',
                    'blocks.list',
                    'blocks.create',
                    'blocks.get',
                    'blocks.update',
                    'blocks.delete',
                    'blocks.move',
                    'components.list',
                    'components.create',
                    'components.get',
                    'components.update',
                    'components.setHtml',
                    'components.delete',
                    'metadata.get',
                    'metadata.update',
                    'export.formats',
                    'export.generate',
                ],
                resources: [
                    'project://{uuid}/structure',
                    'project://{uuid}/metadata',
                    'exelearning://idevices',
                    'exelearning://themes',
                    'exelearning://export-formats',
                ],
                prompts: ['create-course', 'add-content', 'export-for-lms', 'review-project', 'translate-project'],
            },
        };
    })

    /**
     * Health check endpoint.
     */
    .get('/health', () => ({
        success: true,
        data: {
            status: 'healthy',
            activeSessions: sessionTransports.size,
            wsActiveSessions: wsTransports.size,
        },
    }))

    /**
     * MCP WebSocket endpoint.
     *
     * Allows MCP clients to connect via WebSocket instead of HTTP Streamable.
     * This is useful for clients like LM Studio that prefer WebSocket connections.
     *
     * Connect to: ws://localhost:8081/mcp/ws?token=<jwt>
     * Authentication is required via query string token.
     */
    .ws('/ws', {
        async open(ws) {
            const sessionId = crypto.randomUUID();

            // Extract token from query string
            const url = new URL(ws.data?.url || '', 'http://localhost');
            const token = url.searchParams.get('token');

            if (!token) {
                ws.close(4001, 'Authentication required: token query parameter missing');
                return;
            }

            // Verify token
            const payload = await verifyToken(token);
            if (!payload) {
                ws.close(4001, 'Invalid or expired token');
                return;
            }

            // Guests are not allowed
            if (payload.isGuest) {
                ws.close(4003, 'Guest users are not allowed to use MCP');
                return;
            }

            // Create transport
            const transport = new WebSocketServerTransport(sessionId);
            transport.attachWebSocket(ws as unknown as import('bun').ServerWebSocket<McpWebSocketData>);

            // Create MCP server for this session
            const server = createMcpServer({
                authToken: token,
                user: {
                    userId: payload.sub,
                    email: payload.email,
                    roles: payload.roles || [],
                },
            });

            // Store transport and server
            wsTransports.set(sessionId, { transport, server });

            // Update WebSocket data
            ws.data = { sessionId, transport };

            // Connect server to transport
            server
                .connect(transport)
                .then(() => {
                    console.log(`[MCP-WS] Session initialized: ${sessionId}`);
                })
                .catch(err => {
                    console.error('[MCP-WS] Failed to connect server:', err);
                    ws.close(1011, 'Failed to initialize MCP server');
                });
        },

        message(ws, message) {
            const { transport } = ws.data;
            if (transport) {
                const data = typeof message === 'string' ? message : Buffer.from(message).toString('utf-8');
                transport.handleMessage(data);
            }
        },

        close(ws) {
            const { sessionId, transport } = ws.data;
            if (transport) {
                transport.handleClose();
            }
            if (sessionId) {
                const session = wsTransports.get(sessionId);
                if (session) {
                    session.server.close().catch(() => {});
                }
                wsTransports.delete(sessionId);
                console.log(`[MCP-WS] Session closed: ${sessionId}`);
            }
        },

        error(ws, error) {
            const { transport } = ws.data;
            if (transport) {
                transport.handleError(error instanceof Error ? error : new Error(String(error)));
            }
        },
    });

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Close all MCP sessions (call on server shutdown).
 */
export async function closeMcpSessions(): Promise<void> {
    // Close HTTP sessions
    const httpPromises = Array.from(sessionTransports.keys()).map(async sessionId => {
        try {
            const transport = sessionTransports.get(sessionId);
            if (transport) {
                await transport.close();
            }
            await closeSession(sessionId);
        } catch {
            // Ignore errors during cleanup
        }
    });

    // Close WebSocket sessions
    const wsPromises = Array.from(wsTransports.keys()).map(async sessionId => {
        try {
            const session = wsTransports.get(sessionId);
            if (session) {
                await session.transport.close();
                await session.server.close();
            }
        } catch {
            // Ignore errors during cleanup
        }
    });

    await Promise.all([...httpPromises, ...wsPromises]);
    sessionTransports.clear();
    wsTransports.clear();
}

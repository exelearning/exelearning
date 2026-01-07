/**
 * MCP HTTP Routes
 *
 * HTTP endpoints for MCP (Model Context Protocol) server.
 * Uses Streamable HTTP transport for AI agent integration.
 */
import { Elysia } from 'elysia';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer, closeSession } from '../mcp/server';
import { authenticateRequest, errorResponse } from './api/v1/types';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Map of session ID to transport for managing persistent connections.
 */
const sessionTransports = new Map<string, WebStandardStreamableHTTPServerTransport>();

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
                transport: 'streamable-http',
                endpoints: {
                    mcp: '/mcp',
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
        },
    }));

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Close all MCP sessions (call on server shutdown).
 */
export async function closeMcpSessions(): Promise<void> {
    const promises = Array.from(sessionTransports.keys()).map(async sessionId => {
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
    await Promise.all(promises);
    sessionTransports.clear();
}

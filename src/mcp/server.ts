/**
 * MCP Server for eXeLearning
 *
 * High-level MCP server that provides tools for managing eXeLearning projects,
 * resources for accessing project data, and prompts for common workflows.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { McpDependencies } from './types';
import { registerProjectTools } from './tools/projects';
import { registerPageTools } from './tools/pages';
import { registerBlockTools } from './tools/blocks';
import { registerComponentTools } from './tools/components';
import { registerMetadataTools } from './tools/metadata';
import { registerExportTools } from './tools/export';
import { registerProjectResources, registerCatalogResources } from './resources';
import { registerPrompts } from './prompts';

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

const SERVER_INFO = {
    name: 'exelearning-server',
    version: '1.0.0',
};

// ============================================================================
// SERVER FACTORY
// ============================================================================

/**
 * Creates a new MCP server instance with all tools, resources, and prompts registered.
 *
 * @param deps - Dependencies including auth token and user info
 * @returns Configured McpServer instance
 */
export function createMcpServer(deps: McpDependencies): McpServer {
    const server = new McpServer(SERVER_INFO);

    // Register all tools
    registerProjectTools(server, deps);
    registerPageTools(server, deps);
    registerBlockTools(server, deps);
    registerComponentTools(server, deps);
    registerMetadataTools(server, deps);
    registerExportTools(server, deps);

    // Register resources
    registerProjectResources(server, deps);
    registerCatalogResources(server, deps);

    // Register prompts
    registerPrompts(server);

    return server;
}

// ============================================================================
// TRANSPORT FACTORY
// ============================================================================

/**
 * Creates a new Streamable HTTP transport for the MCP server.
 *
 * @param options - Optional configuration for the transport
 * @returns Transport instance
 */
export function createMcpTransport(options?: {
    sessionIdGenerator?: () => string;
    enableJsonResponse?: boolean;
}): WebStandardStreamableHTTPServerTransport {
    return new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: options?.sessionIdGenerator ?? (() => crypto.randomUUID()),
        enableJsonResponse: options?.enableJsonResponse ?? false,
    });
}

// ============================================================================
// SESSION MANAGER
// ============================================================================

interface McpSession {
    server: McpServer;
    transport: WebStandardStreamableHTTPServerTransport;
    deps: McpDependencies;
    createdAt: number;
}

const sessions = new Map<string, McpSession>();

/**
 * Get or create an MCP session for the given session ID.
 *
 * @param sessionId - The session ID
 * @param deps - Dependencies for creating a new session
 * @returns The MCP session
 */
export function getOrCreateSession(sessionId: string, deps: McpDependencies): McpSession {
    let session = sessions.get(sessionId);

    if (!session) {
        const transport = createMcpTransport({
            sessionIdGenerator: () => sessionId,
        });

        const server = createMcpServer(deps);

        session = {
            server,
            transport,
            deps,
            createdAt: Date.now(),
        };

        sessions.set(sessionId, session);

        // Connect server to transport
        server.connect(transport).catch(err => {
            console.error('[MCP] Failed to connect server to transport:', err);
        });
    }

    return session;
}

/**
 * Get an existing MCP session by ID.
 *
 * @param sessionId - The session ID
 * @returns The MCP session or undefined
 */
export function getSession(sessionId: string): McpSession | undefined {
    return sessions.get(sessionId);
}

/**
 * Close and remove an MCP session.
 *
 * @param sessionId - The session ID to close
 */
export async function closeSession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);
    if (session) {
        await session.server.close();
        sessions.delete(sessionId);
    }
}

/**
 * Get all active session IDs.
 *
 * @returns Array of session IDs
 */
export function getActiveSessions(): string[] {
    return Array.from(sessions.keys());
}

/**
 * Close all active sessions.
 */
export async function closeAllSessions(): Promise<void> {
    const promises = Array.from(sessions.keys()).map(closeSession);
    await Promise.all(promises);
}

// ============================================================================
// DEPENDENCY INJECTION FOR TESTING
// ============================================================================

interface McpServerDependencies {
    createMcpServer: typeof createMcpServer;
    createMcpTransport: typeof createMcpTransport;
}

const defaultDeps: McpServerDependencies = {
    createMcpServer,
    createMcpTransport,
};

let currentDeps = defaultDeps;

/**
 * Configure dependencies for testing.
 */
export function configureMcpDeps(deps: Partial<McpServerDependencies>): void {
    currentDeps = { ...defaultDeps, ...deps };
}

/**
 * Reset dependencies to defaults.
 */
export function resetMcpDeps(): void {
    currentDeps = defaultDeps;
}

/**
 * Get current dependencies.
 */
export function getMcpDeps(): McpServerDependencies {
    return currentDeps;
}

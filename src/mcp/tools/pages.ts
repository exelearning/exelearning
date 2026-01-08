/**
 * MCP Tools for Page Management
 *
 * Tools for creating, listing, updating, and deleting pages in a project.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import type { McpDependencies } from '../types';
import { db } from '../../db/client';
import { findProjectByUuid } from '../../db/queries';
import { withDocument, readDocument, getPages, getPage, addPage, updatePage, deletePage, movePage } from '../../yjs';

// ============================================================================
// HELPERS
// ============================================================================

async function checkProjectAccess(
    uuid: string,
    deps: McpDependencies,
): Promise<
    | { success: true; project: NonNullable<Awaited<ReturnType<typeof findProjectByUuid>>> }
    | { success: false; error: { code: string; message: string } }
> {
    const project = await findProjectByUuid(db, uuid);

    if (!project) {
        return { success: false, error: { code: 'NOT_FOUND', message: `Project not found: ${uuid}` } };
    }

    if (project.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
        return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this project' } };
    }

    return { success: true, project };
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register page management tools with the MCP server.
 */
export function registerPageTools(server: McpServer, deps: McpDependencies): void {
    // List pages
    server.registerTool(
        'pages.list',
        {
            title: 'List Pages',
            description: 'List all pages in a project. Returns the page hierarchy with parent-child relationships.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
            }),
        },
        async args => {
            try {
                const accessResult = await checkProjectAccess(args.projectUuid, deps);
                if (!accessResult.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({ success: false, error: accessResult.error }),
                            },
                        ],
                        isError: true,
                    };
                }

                const pages = await readDocument(args.projectUuid, ydoc => getPages(ydoc));

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: pages }, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'LIST_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to list pages',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Create page
    server.registerTool(
        'pages.create',
        {
            title: 'Create Page',
            description: 'Create a new page in the project. Can be placed at root level or as a child of another page.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                name: z.string().min(1).describe('The name of the new page'),
                parentId: z.string().nullable().optional().describe('Parent page ID (null for root level)'),
                order: z.number().optional().describe('Position in the page list'),
            }),
        },
        async args => {
            try {
                const accessResult = await checkProjectAccess(args.projectUuid, deps);
                if (!accessResult.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({ success: false, error: accessResult.error }),
                            },
                        ],
                        isError: true,
                    };
                }

                const { result } = await withDocument(
                    args.projectUuid,
                    { source: 'mcp', userId: deps.user.userId },
                    ydoc => addPage(ydoc, { name: args.name, parentId: args.parentId ?? null, order: args.order }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'CREATE_FAILED', message: result.error || 'Failed to create page' },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify({ success: true, data: result.data }, null, 2) },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'CREATE_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to create page',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Get page
    server.registerTool(
        'pages.get',
        {
            title: 'Get Page',
            description: 'Get details of a specific page by its ID.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                pageId: z.string().describe('The ID of the page'),
            }),
        },
        async args => {
            try {
                const accessResult = await checkProjectAccess(args.projectUuid, deps);
                if (!accessResult.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({ success: false, error: accessResult.error }),
                            },
                        ],
                        isError: true,
                    };
                }

                const page = await readDocument(args.projectUuid, ydoc => getPage(ydoc, args.pageId));

                if (!page) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'NOT_FOUND', message: `Page not found: ${args.pageId}` },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: page }, null, 2) }],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'GET_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to get page',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Update page
    server.registerTool(
        'pages.update',
        {
            title: 'Update Page',
            description: 'Update a page name or properties.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                pageId: z.string().describe('The ID of the page to update'),
                name: z.string().optional().describe('New name for the page'),
                properties: z.record(z.unknown()).optional().describe('Properties to update'),
            }),
        },
        async args => {
            try {
                const accessResult = await checkProjectAccess(args.projectUuid, deps);
                if (!accessResult.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({ success: false, error: accessResult.error }),
                            },
                        ],
                        isError: true,
                    };
                }

                const { result } = await withDocument(
                    args.projectUuid,
                    { source: 'mcp', userId: deps.user.userId },
                    ydoc => updatePage(ydoc, { pageId: args.pageId, name: args.name, properties: args.properties }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'UPDATE_FAILED', message: result.error || 'Failed to update page' },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify({ success: true, data: result.data }, null, 2) },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'UPDATE_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to update page',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Delete page
    server.registerTool(
        'pages.delete',
        {
            title: 'Delete Page',
            description: 'Delete a page and all its child pages, blocks, and components.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                pageId: z.string().describe('The ID of the page to delete'),
            }),
        },
        async args => {
            try {
                const accessResult = await checkProjectAccess(args.projectUuid, deps);
                if (!accessResult.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({ success: false, error: accessResult.error }),
                            },
                        ],
                        isError: true,
                    };
                }

                const { result } = await withDocument(
                    args.projectUuid,
                    { source: 'mcp', userId: deps.user.userId },
                    ydoc => deletePage(ydoc, args.pageId),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'DELETE_FAILED', message: result.error || 'Failed to delete page' },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ success: true, data: { deleted: true, pageId: args.pageId } }),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'DELETE_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to delete page',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Move page
    server.registerTool(
        'pages.move',
        {
            title: 'Move Page',
            description: 'Move a page to a different parent or position.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                pageId: z.string().describe('The ID of the page to move'),
                newParentId: z.string().nullable().describe('The new parent page ID (null for root level)'),
                position: z.number().optional().describe("Position within the parent's children"),
            }),
        },
        async args => {
            try {
                const accessResult = await checkProjectAccess(args.projectUuid, deps);
                if (!accessResult.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({ success: false, error: accessResult.error }),
                            },
                        ],
                        isError: true,
                    };
                }

                const { result } = await withDocument(
                    args.projectUuid,
                    { source: 'mcp', userId: deps.user.userId },
                    ydoc =>
                        movePage(ydoc, { pageId: args.pageId, newParentId: args.newParentId, position: args.position }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'MOVE_FAILED', message: result.error || 'Failed to move page' },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify({ success: true, data: result.data }, null, 2) },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: 'MOVE_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to move page',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );
}

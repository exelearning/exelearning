/**
 * MCP Tools for Block Management
 *
 * Tools for creating, listing, updating, and deleting blocks (iDevice containers).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpDependencies } from '../types';
import { db } from '../../db/client';
import { findProjectByUuid } from '../../db/queries';
import {
    withDocument,
    readDocument,
    getBlocks,
    getBlock,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
} from '../../yjs';

// ============================================================================
// HELPERS
// ============================================================================

async function checkProjectAccess(
    uuid: string,
    deps: McpDependencies,
): Promise<{ success: true } | { success: false; error: { code: string; message: string } }> {
    const project = await findProjectByUuid(db, uuid);

    if (!project) {
        return { success: false, error: { code: 'NOT_FOUND', message: `Project not found: ${uuid}` } };
    }

    if (project.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
        return { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this project' } };
    }

    return { success: true };
}

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register block management tools with the MCP server.
 */
export function registerBlockTools(server: McpServer, deps: McpDependencies): void {
    // List blocks
    server.registerTool(
        'blocks.list',
        {
            title: 'List Blocks',
            description: 'List all blocks in a page. Blocks are containers for components (iDevices).',
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

                const blocks = await readDocument(args.projectUuid, ydoc => getBlocks(ydoc, args.pageId));

                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify({ success: true, data: blocks }, null, 2) },
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
                                    code: 'LIST_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to list blocks',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Create block
    server.registerTool(
        'blocks.create',
        {
            title: 'Create Block',
            description: 'Create a new block in a page. Blocks contain components (iDevices).',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                pageId: z.string().describe('The ID of the page'),
                name: z.string().optional().describe('Name for the block'),
                order: z.number().optional().describe('Position in the page'),
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
                    ydoc => createBlock(ydoc, { pageId: args.pageId, name: args.name, order: args.order }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'CREATE_FAILED', message: result.error || 'Failed to create block' },
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
                                    message: error instanceof Error ? error.message : 'Failed to create block',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Get block
    server.registerTool(
        'blocks.get',
        {
            title: 'Get Block',
            description: 'Get details of a specific block by its ID.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                blockId: z.string().describe('The ID of the block'),
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

                const block = await readDocument(args.projectUuid, ydoc => getBlock(ydoc, args.blockId));

                if (!block) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'NOT_FOUND', message: `Block not found: ${args.blockId}` },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify({ success: true, data: block }, null, 2) }],
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
                                    message: error instanceof Error ? error.message : 'Failed to get block',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Update block
    server.registerTool(
        'blocks.update',
        {
            title: 'Update Block',
            description: 'Update block name, icon, or properties.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                blockId: z.string().describe('The ID of the block to update'),
                name: z.string().optional().describe('New name for the block'),
                iconName: z.string().optional().describe('New icon name'),
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
                    ydoc =>
                        updateBlock(ydoc, {
                            blockId: args.blockId,
                            name: args.name,
                            iconName: args.iconName,
                            properties: args.properties,
                        }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'UPDATE_FAILED', message: result.error || 'Failed to update block' },
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
                                    message: error instanceof Error ? error.message : 'Failed to update block',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Delete block
    server.registerTool(
        'blocks.delete',
        {
            title: 'Delete Block',
            description: 'Delete a block and all its components.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                blockId: z.string().describe('The ID of the block to delete'),
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
                    ydoc => deleteBlock(ydoc, args.blockId),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'DELETE_FAILED', message: result.error || 'Failed to delete block' },
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
                            text: JSON.stringify({ success: true, data: { deleted: true, blockId: args.blockId } }),
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
                                    message: error instanceof Error ? error.message : 'Failed to delete block',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Move block
    server.registerTool(
        'blocks.move',
        {
            title: 'Move Block',
            description: 'Move a block to a different page or position.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                blockId: z.string().describe('The ID of the block to move'),
                targetPageId: z.string().describe('The target page ID'),
                position: z.number().optional().describe('Position within the target page'),
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
                        moveBlock(ydoc, {
                            blockId: args.blockId,
                            targetPageId: args.targetPageId,
                            position: args.position,
                        }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'MOVE_FAILED', message: result.error || 'Failed to move block' },
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
                                    message: error instanceof Error ? error.message : 'Failed to move block',
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

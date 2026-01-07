/**
 * MCP Tools for Component (iDevice) Management
 *
 * Tools for creating, listing, updating, and deleting components (iDevices).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpDependencies } from '../types';
import { db } from '../../db/client';
import { findProjectByUuid } from '../../db/queries';
import {
    withDocument,
    readDocument,
    getComponents,
    getComponent,
    createComponent,
    updateComponent,
    setComponentHtml,
    deleteComponent,
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
 * Register component management tools with the MCP server.
 */
export function registerComponentTools(server: McpServer, deps: McpDependencies): void {
    // List components
    server.registerTool(
        'components.list',
        {
            title: 'List Components',
            description: 'List all components (iDevices) in a block.',
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

                const components = await readDocument(args.projectUuid, ydoc => getComponents(ydoc, args.blockId));

                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify({ success: true, data: components }, null, 2) },
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
                                    message: error instanceof Error ? error.message : 'Failed to list components',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Create component
    server.registerTool(
        'components.create',
        {
            title: 'Create Component',
            description:
                'Create a new component (iDevice) in a block. Available types include: text, question, reflection, gallery, etc.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                blockId: z.string().describe('The ID of the block'),
                ideviceType: z.string().describe('The type of iDevice (text, question, reflection, gallery, etc.)'),
                initialData: z
                    .object({
                        title: z.string().optional().describe('Title for the component'),
                        htmlContent: z.string().optional().describe('Initial HTML content'),
                        instructions: z.string().optional().describe('Instructions text'),
                    })
                    .optional()
                    .describe('Initial data for the component'),
                order: z.number().optional().describe('Position in the block'),
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
                        createComponent(ydoc, {
                            blockId: args.blockId,
                            ideviceType: args.ideviceType,
                            initialData: args.initialData,
                            order: args.order,
                        }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'CREATE_FAILED',
                                        message: result.error || 'Failed to create component',
                                    },
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
                                    message: error instanceof Error ? error.message : 'Failed to create component',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Get component
    server.registerTool(
        'components.get',
        {
            title: 'Get Component',
            description: 'Get details of a specific component by its ID.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                componentId: z.string().describe('The ID of the component'),
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

                const component = await readDocument(args.projectUuid, ydoc => getComponent(ydoc, args.componentId));

                if (!component) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'NOT_FOUND', message: `Component not found: ${args.componentId}` },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify({ success: true, data: component }, null, 2) },
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
                                    code: 'GET_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to get component',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Update component
    server.registerTool(
        'components.update',
        {
            title: 'Update Component',
            description: 'Update component content and properties.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                componentId: z.string().describe('The ID of the component to update'),
                htmlContent: z.string().optional().describe('New HTML content'),
                htmlView: z.string().optional().describe('HTML view content'),
                properties: z.record(z.unknown()).optional().describe('Properties to update'),
                jsonProperties: z
                    .union([z.string(), z.record(z.unknown())])
                    .optional()
                    .describe('JSON properties'),
                title: z.string().optional().describe('New title'),
                subtitle: z.string().optional().describe('New subtitle'),
                instructions: z.string().optional().describe('New instructions'),
                feedback: z.string().optional().describe('New feedback text'),
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
                        updateComponent(ydoc, {
                            componentId: args.componentId,
                            htmlContent: args.htmlContent,
                            htmlView: args.htmlView,
                            properties: args.properties,
                            jsonProperties: args.jsonProperties,
                            title: args.title,
                            subtitle: args.subtitle,
                            instructions: args.instructions,
                            feedback: args.feedback,
                        }),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'UPDATE_FAILED',
                                        message: result.error || 'Failed to update component',
                                    },
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
                                    message: error instanceof Error ? error.message : 'Failed to update component',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Set component HTML
    server.registerTool(
        'components.setHtml',
        {
            title: 'Set Component HTML',
            description: 'Update only the HTML content of a component.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                componentId: z.string().describe('The ID of the component'),
                html: z.string().describe('The new HTML content'),
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
                    ydoc => setComponentHtml(ydoc, args.componentId, args.html),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'UPDATE_FAILED', message: result.error || 'Failed to update HTML' },
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
                            text: JSON.stringify({
                                success: true,
                                data: { updated: true, componentId: args.componentId },
                            }),
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
                                    code: 'UPDATE_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to update HTML',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Delete component
    server.registerTool(
        'components.delete',
        {
            title: 'Delete Component',
            description: 'Delete a component (iDevice).',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                componentId: z.string().describe('The ID of the component to delete'),
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
                    ydoc => deleteComponent(ydoc, args.componentId),
                );

                if (!result.success) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'DELETE_FAILED',
                                        message: result.error || 'Failed to delete component',
                                    },
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
                            text: JSON.stringify({
                                success: true,
                                data: { deleted: true, componentId: args.componentId },
                            }),
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
                                    message: error instanceof Error ? error.message : 'Failed to delete component',
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

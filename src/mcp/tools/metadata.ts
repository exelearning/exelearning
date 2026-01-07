/**
 * MCP Tools for Metadata Management
 *
 * Tools for getting and updating project metadata.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpDependencies } from '../types';
import { db } from '../../db/client';
import { findProjectByUuid } from '../../db/queries';
import { withDocument, readDocument, getMetadataData, updateMetadataData } from '../../yjs';

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
 * Register metadata management tools with the MCP server.
 */
export function registerMetadataTools(server: McpServer, deps: McpDependencies): void {
    // Get metadata
    server.registerTool(
        'metadata.get',
        {
            title: 'Get Metadata',
            description: 'Get project metadata including title, author, description, language, and other settings.',
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

                const metadata = await readDocument(args.projectUuid, ydoc => getMetadataData(ydoc));

                return {
                    content: [
                        { type: 'text' as const, text: JSON.stringify({ success: true, data: metadata }, null, 2) },
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
                                    message: error instanceof Error ? error.message : 'Failed to get metadata',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Update metadata
    server.registerTool(
        'metadata.update',
        {
            title: 'Update Metadata',
            description: 'Update project metadata fields like title, author, description, language, etc.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project'),
                title: z.string().optional().describe('Project title'),
                subtitle: z.string().optional().describe('Project subtitle'),
                author: z.string().optional().describe('Author name'),
                description: z.string().optional().describe('Project description'),
                language: z.string().optional().describe('Language code (en, es, fr, etc.)'),
                license: z.string().optional().describe('License information'),
                footer: z.string().optional().describe('Footer text'),
                addExeLink: z.boolean().optional().describe('Show eXeLearning link'),
                addPagination: z.boolean().optional().describe('Show pagination'),
                addSearchBox: z.boolean().optional().describe('Show search box'),
                addAccessibilityToolbar: z.boolean().optional().describe('Show accessibility toolbar'),
                extraHeadContent: z.string().optional().describe('Extra content for HTML head'),
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

                // Extract only metadata fields (exclude projectUuid)
                const { projectUuid: _, ...metadataUpdates } = args;

                const { result } = await withDocument(
                    args.projectUuid,
                    { source: 'mcp', userId: deps.user.userId },
                    ydoc => updateMetadataData(ydoc, metadataUpdates),
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
                                        message: result.error || 'Failed to update metadata',
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Get updated metadata
                const updatedMetadata = await readDocument(args.projectUuid, ydoc => getMetadataData(ydoc));

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ success: true, data: updatedMetadata }, null, 2),
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
                                    message: error instanceof Error ? error.message : 'Failed to update metadata',
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

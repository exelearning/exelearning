/**
 * MCP Tools for Project Management
 *
 * Tools for creating, listing, updating, and deleting eXeLearning projects.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { McpDependencies, ProjectInfo } from '../types';
import { db } from '../../db/client';
import {
    findAllProjectsForUser,
    findProjectByUuid,
    createProject,
    updateProject,
    hardDeleteProject,
} from '../../db/queries';
import { ensureDocument } from '../../yjs';

// ============================================================================
// TOOL REGISTRATION
// ============================================================================

/**
 * Register project management tools with the MCP server.
 *
 * @param server - The MCP server instance
 * @param deps - Dependencies including auth token and user info
 */
export function registerProjectTools(server: McpServer, deps: McpDependencies): void {
    // List projects
    server.registerTool(
        'projects.list',
        {
            title: 'List Projects',
            description:
                'List all eXeLearning projects for the authenticated user. Returns an array of projects with their basic information (uuid, title, dates).',
            inputSchema: z.object({
                limit: z
                    .number()
                    .min(1)
                    .max(100)
                    .optional()
                    .describe('Maximum number of projects to return (default: 50, max: 100)'),
                offset: z.number().min(0).optional().describe('Number of projects to skip for pagination'),
                search: z.string().optional().describe('Filter projects by title (case-insensitive search)'),
            }),
        },
        async args => {
            try {
                const projects = await findAllProjectsForUser(db, deps.user.userId);

                let filtered = projects;

                // Apply search filter
                if (args.search) {
                    const searchLower = args.search.toLowerCase();
                    filtered = filtered.filter(p => p.title?.toLowerCase().includes(searchLower));
                }

                // Apply pagination
                const offset = args.offset ?? 0;
                const limit = args.limit ?? 50;
                const paginated = filtered.slice(offset, offset + limit);

                const result: ProjectInfo[] = paginated.map(p => ({
                    id: p.id,
                    uuid: p.uuid,
                    title: p.title,
                    owner_id: p.owner_id,
                    created_at: p.created_at,
                    updated_at: p.updated_at,
                    saved_once: Boolean(p.saved_once),
                }));

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(
                                {
                                    success: true,
                                    data: result,
                                    total: filtered.length,
                                    offset,
                                    limit,
                                },
                                null,
                                2,
                            ),
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
                                    code: 'LIST_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to list projects',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Create project
    server.registerTool(
        'projects.create',
        {
            title: 'Create Project',
            description:
                'Create a new eXeLearning project. Returns the created project with its UUID that can be used for subsequent operations.',
            inputSchema: z.object({
                title: z.string().min(1).describe('The title of the new project'),
            }),
        },
        async args => {
            try {
                const uuid = crypto.randomUUID();

                const project = await createProject(db, {
                    uuid,
                    title: args.title,
                    owner_id: deps.user.userId,
                });

                // Initialize Yjs document for the project
                await ensureDocument(uuid);

                const result: ProjectInfo = {
                    id: Number(project.insertId),
                    uuid,
                    title: args.title,
                    owner_id: deps.user.userId,
                    created_at: Date.now(),
                    updated_at: null,
                    saved_once: false,
                };

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ success: true, data: result }, null, 2),
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
                                    code: 'CREATE_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to create project',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Get project
    server.registerTool(
        'projects.get',
        {
            title: 'Get Project',
            description:
                'Get details of a specific project by its UUID. Returns the project information including title, dates, and status.',
            inputSchema: z.object({
                uuid: z.string().describe('The UUID of the project to retrieve'),
            }),
        },
        async args => {
            try {
                const project = await findProjectByUuid(db, args.uuid);

                if (!project) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'NOT_FOUND',
                                        message: `Project not found: ${args.uuid}`,
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Check ownership
                if (project.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'FORBIDDEN',
                                        message: 'You do not have access to this project',
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                const result: ProjectInfo = {
                    id: project.id,
                    uuid: project.uuid,
                    title: project.title,
                    owner_id: project.owner_id,
                    created_at: project.created_at,
                    updated_at: project.updated_at,
                    saved_once: Boolean(project.saved_once),
                };

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ success: true, data: result }, null, 2),
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
                                    code: 'GET_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to get project',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Update project
    server.registerTool(
        'projects.update',
        {
            title: 'Update Project',
            description: "Update a project's title. Returns the updated project information.",
            inputSchema: z.object({
                uuid: z.string().describe('The UUID of the project to update'),
                title: z.string().min(1).describe('The new title for the project'),
            }),
        },
        async args => {
            try {
                const project = await findProjectByUuid(db, args.uuid);

                if (!project) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'NOT_FOUND',
                                        message: `Project not found: ${args.uuid}`,
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Check ownership
                if (project.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'FORBIDDEN',
                                        message: 'You do not have access to this project',
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                await updateProject(db, project.id, { title: args.title });

                const updated = await findProjectByUuid(db, args.uuid);

                const result: ProjectInfo = {
                    id: updated!.id,
                    uuid: updated!.uuid,
                    title: updated!.title,
                    owner_id: updated!.owner_id,
                    created_at: updated!.created_at,
                    updated_at: updated!.updated_at,
                    saved_once: Boolean(updated!.saved_once),
                };

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ success: true, data: result }, null, 2),
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
                                    message: error instanceof Error ? error.message : 'Failed to update project',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Delete project
    server.registerTool(
        'projects.delete',
        {
            title: 'Delete Project',
            description: 'Delete a project and all its content. This action cannot be undone.',
            inputSchema: z.object({
                uuid: z.string().describe('The UUID of the project to delete'),
            }),
        },
        async args => {
            try {
                const project = await findProjectByUuid(db, args.uuid);

                if (!project) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'NOT_FOUND',
                                        message: `Project not found: ${args.uuid}`,
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Check ownership
                if (project.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'FORBIDDEN',
                                        message: 'You do not have access to this project',
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                await hardDeleteProject(db, project.id);

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({
                                success: true,
                                data: { deleted: true, uuid: args.uuid },
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
                                    message: error instanceof Error ? error.message : 'Failed to delete project',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Duplicate project
    server.registerTool(
        'projects.duplicate',
        {
            title: 'Duplicate Project',
            description:
                'Create a copy of an existing project. The new project will have a new UUID and can have a different title.',
            inputSchema: z.object({
                uuid: z.string().describe('The UUID of the project to duplicate'),
                newTitle: z
                    .string()
                    .optional()
                    .describe('Optional title for the new project (defaults to "Original Title (copy)")'),
            }),
        },
        async args => {
            try {
                const sourceProject = await findProjectByUuid(db, args.uuid);

                if (!sourceProject) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'NOT_FOUND',
                                        message: `Project not found: ${args.uuid}`,
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Check ownership
                if (sourceProject.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: {
                                        code: 'FORBIDDEN',
                                        message: 'You do not have access to this project',
                                    },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                const newUuid = crypto.randomUUID();
                const newTitle = args.newTitle || `${sourceProject.title} (copy)`;

                const newProject = await createProject(db, {
                    uuid: newUuid,
                    title: newTitle,
                    owner_id: deps.user.userId,
                });

                // Initialize Yjs document for the project
                // TODO: Copy Yjs document state from source
                await ensureDocument(newUuid);

                const result = {
                    id: Number(newProject.insertId),
                    uuid: newUuid,
                    title: newTitle,
                    owner_id: deps.user.userId,
                    created_at: Date.now(),
                    updated_at: null,
                    saved_once: false,
                    sourceUuid: args.uuid,
                };

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ success: true, data: result }, null, 2),
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
                                    code: 'DUPLICATE_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to duplicate project',
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

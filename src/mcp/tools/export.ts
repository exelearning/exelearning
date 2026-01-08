/**
 * MCP Tools for Export Operations
 *
 * Tools for exporting projects to various formats.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v3';
import type { McpDependencies, ExportFormat, ExportFormatInfo } from '../types';
import { db } from '../../db/client';
import { findProjectByUuid } from '../../db/queries';

// ============================================================================
// CONSTANTS
// ============================================================================

const EXPORT_FORMATS: Record<ExportFormat, ExportFormatInfo> = {
    html5: {
        id: 'html5',
        name: 'HTML5 Website',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    'html5-sp': {
        id: 'html5-sp',
        name: 'HTML5 Single Page',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    scorm12: {
        id: 'scorm12',
        name: 'SCORM 1.2 Package',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    scorm2004: {
        id: 'scorm2004',
        name: 'SCORM 2004 Package',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    ims: {
        id: 'ims',
        name: 'IMS Content Package',
        extension: '.zip',
        mimeType: 'application/zip',
    },
    epub3: {
        id: 'epub3',
        name: 'EPUB 3 eBook',
        extension: '.epub',
        mimeType: 'application/epub+zip',
    },
    elp: {
        id: 'elp',
        name: 'eXeLearning Legacy Project',
        extension: '.elp',
        mimeType: 'application/x-elp',
    },
    elpx: {
        id: 'elpx',
        name: 'eXeLearning Project',
        extension: '.elpx',
        mimeType: 'application/x-elpx',
    },
};

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
 * Register export tools with the MCP server.
 */
export function registerExportTools(server: McpServer, deps: McpDependencies): void {
    // List export formats
    server.registerTool(
        'export.formats',
        {
            title: 'List Export Formats',
            description: 'List all available export formats for projects.',
            inputSchema: z.object({}),
        },
        async () => {
            try {
                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify({ success: true, data: Object.values(EXPORT_FORMATS) }, null, 2),
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
                                    message: error instanceof Error ? error.message : 'Failed to list formats',
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
        },
    );

    // Export project
    server.registerTool(
        'export.generate',
        {
            title: 'Export Project',
            description:
                'Export a project to the specified format. Returns a download URL that can be used to download the exported file. The URL is valid for a limited time.',
            inputSchema: z.object({
                projectUuid: z.string().describe('The UUID of the project to export'),
                format: z
                    .enum(['html5', 'html5-sp', 'scorm12', 'scorm2004', 'ims', 'epub3', 'elp', 'elpx'])
                    .describe('Export format'),
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

                const formatInfo = EXPORT_FORMATS[args.format];
                if (!formatInfo) {
                    return {
                        content: [
                            {
                                type: 'text' as const,
                                text: JSON.stringify({
                                    success: false,
                                    error: { code: 'INVALID_FORMAT', message: `Invalid export format: ${args.format}` },
                                }),
                            },
                        ],
                        isError: true,
                    };
                }

                // Generate the export URL - clients can use this to download the export
                // The actual export is done by the REST API endpoint
                const downloadUrl = `/api/v1/export/projects/${args.projectUuid}/export/${args.format}`;

                return {
                    content: [
                        {
                            type: 'text' as const,
                            text: JSON.stringify(
                                {
                                    success: true,
                                    data: {
                                        downloadUrl,
                                        format: args.format,
                                        formatInfo,
                                        message: `Use the downloadUrl with your JWT token to download the exported file. Example: curl -H "Authorization: Bearer YOUR_TOKEN" "${downloadUrl}" -o export${formatInfo.extension}`,
                                    },
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
                                    code: 'EXPORT_ERROR',
                                    message: error instanceof Error ? error.message : 'Failed to generate export',
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

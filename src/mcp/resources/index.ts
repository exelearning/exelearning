/**
 * MCP Resources
 *
 * Resources provide data that AI agents can read to understand the context.
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpDependencies } from '../types';
import { db } from '../../db/client';
import { findProjectByUuid, findAllProjectsForUser } from '../../db/queries';
import { readDocument, getPages, getMetadataData } from '../../yjs';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// EXPORT FORMAT INFO
// ============================================================================

const EXPORT_FORMATS = [
    { id: 'html5', name: 'HTML5 Website', extension: '.zip', description: 'Standard HTML5 website package' },
    { id: 'html5-sp', name: 'HTML5 Single Page', extension: '.zip', description: 'Single page HTML5 website' },
    { id: 'scorm12', name: 'SCORM 1.2', extension: '.zip', description: 'SCORM 1.2 compliant package for LMS' },
    { id: 'scorm2004', name: 'SCORM 2004', extension: '.zip', description: 'SCORM 2004 compliant package for LMS' },
    { id: 'ims', name: 'IMS Content Package', extension: '.zip', description: 'IMS Content Package standard' },
    { id: 'epub3', name: 'EPUB 3', extension: '.epub', description: 'EPUB 3 ebook format' },
    { id: 'elp', name: 'ELP (Legacy)', extension: '.elp', description: 'Legacy eXeLearning project format' },
    { id: 'elpx', name: 'ELPX', extension: '.elpx', description: 'Current eXeLearning project format' },
];

// ============================================================================
// PROJECT RESOURCES
// ============================================================================

/**
 * Register project-related resources.
 */
export function registerProjectResources(server: McpServer, deps: McpDependencies): void {
    // Project structure resource template
    server.registerResource(
        'project-structure',
        new ResourceTemplate('project://{uuid}/structure', {
            list: async () => {
                // List all projects for the user
                const projects = await findAllProjectsForUser(db, deps.user.userId);
                return {
                    resources: projects.map(p => ({
                        uri: `project://${p.uuid}/structure`,
                        name: `Structure: ${p.title || 'Untitled'}`,
                        description: `Page hierarchy and content structure for project ${p.uuid}`,
                        mimeType: 'application/json',
                    })),
                };
            },
        }),
        {
            description: 'Project structure with page hierarchy, blocks, and components',
            mimeType: 'application/json',
        },
        async (uri, variables) => {
            const uuid = variables.uuid;

            // Check access
            const project = await findProjectByUuid(db, uuid);
            if (!project) {
                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: 'application/json',
                            text: JSON.stringify({ error: 'Project not found' }),
                        },
                    ],
                };
            }

            if (project.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: 'application/json',
                            text: JSON.stringify({ error: 'Access denied' }),
                        },
                    ],
                };
            }

            // Get project structure
            const pages = await readDocument(uuid, ydoc => getPages(ydoc));

            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify(
                            {
                                uuid,
                                title: project.title,
                                pages,
                            },
                            null,
                            2,
                        ),
                    },
                ],
            };
        },
    );

    // Project metadata resource template
    server.registerResource(
        'project-metadata',
        new ResourceTemplate('project://{uuid}/metadata', {
            list: async () => {
                const projects = await findAllProjectsForUser(db, deps.user.userId);
                return {
                    resources: projects.map(p => ({
                        uri: `project://${p.uuid}/metadata`,
                        name: `Metadata: ${p.title || 'Untitled'}`,
                        description: `Title, author, description, and settings for project ${p.uuid}`,
                        mimeType: 'application/json',
                    })),
                };
            },
        }),
        {
            description: 'Project metadata including title, author, description, language, and settings',
            mimeType: 'application/json',
        },
        async (uri, variables) => {
            const uuid = variables.uuid;

            // Check access
            const project = await findProjectByUuid(db, uuid);
            if (!project) {
                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: 'application/json',
                            text: JSON.stringify({ error: 'Project not found' }),
                        },
                    ],
                };
            }

            if (project.owner_id !== deps.user.userId && !deps.user.roles.includes('ROLE_ADMIN')) {
                return {
                    contents: [
                        {
                            uri: uri.toString(),
                            mimeType: 'application/json',
                            text: JSON.stringify({ error: 'Access denied' }),
                        },
                    ],
                };
            }

            // Get metadata
            const metadata = await readDocument(uuid, ydoc => getMetadataData(ydoc));

            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify({ uuid, ...metadata }, null, 2),
                    },
                ],
            };
        },
    );
}

// ============================================================================
// CATALOG RESOURCES
// ============================================================================

/**
 * Register catalog resources (idevices, themes, formats).
 */
export function registerCatalogResources(server: McpServer, _deps: McpDependencies): void {
    // iDevices catalog
    server.registerResource(
        'idevices-catalog',
        'exelearning://idevices',
        {
            description: 'List of available iDevice types that can be added to blocks',
            mimeType: 'application/json',
        },
        async uri => {
            // Get idevices from public/files/perm/idevices
            const idevicesPath = path.join(process.cwd(), 'public', 'files', 'perm', 'idevices', 'base');
            let idevices: Array<{ id: string; name: string; category: string }> = [];

            try {
                if (fs.existsSync(idevicesPath)) {
                    const dirs = fs.readdirSync(idevicesPath, { withFileTypes: true }).filter(d => d.isDirectory());

                    for (const dir of dirs) {
                        const configPath = path.join(idevicesPath, dir.name, 'config.xml');
                        if (fs.existsSync(configPath)) {
                            const configXml = fs.readFileSync(configPath, 'utf-8');
                            // Simple extraction of name from config
                            const nameMatch = configXml.match(/<name[^>]*>([^<]+)<\/name>/);
                            const categoryMatch = configXml.match(/<category[^>]*>([^<]+)<\/category>/);
                            idevices.push({
                                id: dir.name,
                                name: nameMatch?.[1] || dir.name,
                                category: categoryMatch?.[1] || 'Other',
                            });
                        }
                    }
                }
            } catch {
                // Fallback to common idevices
                idevices = [
                    { id: 'text', name: 'Text', category: 'Text' },
                    { id: 'question', name: 'Question', category: 'Assessment' },
                    { id: 'reflection', name: 'Reflection', category: 'Activities' },
                    { id: 'gallery', name: 'Gallery', category: 'Media' },
                    { id: 'video', name: 'Video', category: 'Media' },
                    { id: 'audio', name: 'Audio', category: 'Media' },
                ];
            }

            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify({ idevices }, null, 2),
                    },
                ],
            };
        },
    );

    // Themes catalog
    server.registerResource(
        'themes-catalog',
        'exelearning://themes',
        {
            description: 'List of available visual themes for projects',
            mimeType: 'application/json',
        },
        async uri => {
            // Get themes from public/files/perm/themes
            const themesPath = path.join(process.cwd(), 'public', 'files', 'perm', 'themes');
            let themes: Array<{ id: string; name: string }> = [];

            try {
                if (fs.existsSync(themesPath)) {
                    const dirs = fs.readdirSync(themesPath, { withFileTypes: true }).filter(d => d.isDirectory());

                    for (const dir of dirs) {
                        const configPath = path.join(themesPath, dir.name, 'config.xml');
                        if (fs.existsSync(configPath)) {
                            const configXml = fs.readFileSync(configPath, 'utf-8');
                            const nameMatch = configXml.match(/<name[^>]*>([^<]+)<\/name>/);
                            themes.push({
                                id: dir.name,
                                name: nameMatch?.[1] || dir.name,
                            });
                        } else {
                            themes.push({
                                id: dir.name,
                                name: dir.name.charAt(0).toUpperCase() + dir.name.slice(1),
                            });
                        }
                    }
                }
            } catch {
                // Fallback to common themes
                themes = [
                    { id: 'base', name: 'Base' },
                    { id: 'default', name: 'Default' },
                ];
            }

            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify({ themes }, null, 2),
                    },
                ],
            };
        },
    );

    // Export formats catalog
    server.registerResource(
        'export-formats-catalog',
        'exelearning://export-formats',
        {
            description: 'List of available export formats for projects',
            mimeType: 'application/json',
        },
        async uri => {
            return {
                contents: [
                    {
                        uri: uri.toString(),
                        mimeType: 'application/json',
                        text: JSON.stringify({ formats: EXPORT_FORMATS }, null, 2),
                    },
                ],
            };
        },
    );
}

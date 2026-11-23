// Project-level tool definitions
export const projectTools = [
    {
        name: 'exe.context.current',
        description: 'Get current editor context: bridge readiness, selected page id, project metadata snapshot.',
        inputSchema: { type: 'object', properties: {} },
        handlerName: 'getCurrentContext',
        writes: false,
        annotations: { idempotentHint: true, openWorldHint: false },
        category: 'project',
    },
    {
        name: 'exe.project.get_metadata',
        description: 'Read current project metadata and the list of required fields that are still empty.',
        inputSchema: { type: 'object', properties: {} },
        handlerName: 'getProjectMetadataStatus',
        writes: false,
        annotations: { idempotentHint: true, openWorldHint: false },
        category: 'project',
    },
    {
        name: 'exe.project.ensure_metadata',
        description:
            'Set the project title, author and/or description (pass only the fields to change). Without arguments, check that all three are set; the result lists the fields still missing.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Project title shown in the editor and exports.' },
                author: { type: 'string', description: 'Project author shown in metadata and exports.' },
                description: { type: 'string', description: 'Short project description used in exports and search.' },
            },
        },
        handlerName: 'ensureProjectMetadata',
        writes: true,
        annotations: { idempotentHint: true, openWorldHint: false },
        category: 'project',
    },
    {
        name: 'exe.project.save',
        description: 'Persist the current project Yjs state to the server.',
        inputSchema: { type: 'object', properties: {} },
        handlerName: 'saveProject',
        writes: true,
        annotations: { idempotentHint: true, openWorldHint: false },
        category: 'project',
    },
];

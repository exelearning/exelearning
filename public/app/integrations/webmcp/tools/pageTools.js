export const pageTools = [
    {
        name: 'exe.pages.create',
        description: 'Create a new page in the project tree.',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Visible page title.' },
                parentId: { type: 'string', description: 'Optional nav-id of the parent page; omit to create a root page.' },
                order: { type: 'number', description: 'Optional zero-based position among siblings.' },
            },
            required: ['name'],
        },
        handlerName: 'createPage',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'pages',
    },
    {
        name: 'exe.pages.move',
        description: 'Move a page to another parent or reorder it among its siblings.',
        inputSchema: {
            type: 'object',
            properties: {
                pageId: { type: 'string', description: 'nav-id of the page to move.' },
                parentId: { type: 'string', description: 'Optional new parent nav-id; omit to keep the current parent.' },
                position: { type: 'number', description: 'Optional zero-based position among siblings.' },
            },
            required: ['pageId'],
        },
        handlerName: 'movePage',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'pages',
    },
    {
        name: 'exe.pages.delete',
        description: 'Delete a page and all of its descendants. Destructive — cannot be undone from MCP.',
        inputSchema: {
            type: 'object',
            properties: {
                pageId: { type: 'string', description: 'nav-id of the page to delete.' },
            },
            required: ['pageId'],
        },
        handlerName: 'deletePage',
        writes: true,
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
        category: 'pages',
    },
];

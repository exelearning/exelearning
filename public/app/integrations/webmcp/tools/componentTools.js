export const componentTools = [
    {
        name: 'exe.components.create',
        description: 'Create a generic iDevice component (use specialised idevices.* tools when possible).',
        inputSchema: {
            type: 'object',
            properties: {
                pageId: { type: 'string', description: 'nav-id of the page; defaults to the currently selected page when omitted.' },
                blockId: { type: 'string', description: 'Optional block id; a new block is created when omitted.' },
                ideviceType: { type: 'string', description: 'iDevice technical type (e.g. text, az_quiz_game, image_gallery, form).' },
                title: { type: 'string', description: 'Optional component title.' },
                html: { type: 'string', description: 'Optional initial HTML body.' },
                jsonProperties: { type: 'string', description: 'Optional JSON properties payload, either an object or a JSON string.' },
                order: { type: 'number', description: 'Optional zero-based position within the block.' },
            },
            required: ['ideviceType'],
        },
        handlerName: 'createComponent',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'components',
    },
    {
        name: 'exe.components.set_html',
        description: 'Replace the HTML body of a component (overwrites previous content).',
        inputSchema: {
            type: 'object',
            properties: {
                componentId: { type: 'string', description: 'Identifier of the component to update.' },
                html: { type: 'string', description: 'New HTML content.' },
            },
            required: ['componentId', 'html'],
        },
        handlerName: 'setComponentHtml',
        writes: true,
        annotations: { idempotentHint: true, openWorldHint: false },
        category: 'components',
    },
    {
        name: 'exe.components.delete',
        description: 'Delete a component from its block. Destructive — cannot be undone from MCP.',
        inputSchema: {
            type: 'object',
            properties: {
                componentId: { type: 'string', description: 'Identifier of the component to delete.' },
            },
            required: ['componentId'],
        },
        handlerName: 'deleteComponent',
        writes: true,
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
        category: 'components',
    },
];

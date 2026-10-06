export const blockTools = [
    {
        name: 'exe.blocks.create',
        description: 'Create a content block on a page.',
        inputSchema: {
            type: 'object',
            properties: {
                pageId: { type: 'string', description: 'nav-id of the page; defaults to the currently selected page when omitted.' },
                name: { type: 'string', description: 'Visible block title.' },
                order: { type: 'number', description: 'Optional zero-based position among siblings.' },
            },
            required: ['name'],
        },
        handlerName: 'createBlock',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'blocks',
    },
    {
        name: 'exe.blocks.move',
        description: 'Move a block to another page or reorder blocks within a page.',
        inputSchema: {
            type: 'object',
            properties: {
                blockId: { type: 'string', description: 'Identifier of the block to move.' },
                targetPageId: { type: 'string', description: 'Optional destination page nav-id; omit to reorder within the same page.' },
                order: { type: 'number', description: 'Optional zero-based target position among blocks.' },
            },
            required: ['blockId'],
        },
        handlerName: 'moveBlock',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'blocks',
    },
];

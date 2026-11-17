import { AI_IDEVICE_TYPES } from '../ideviceAiContent.js';

const ideviceType = {
    type: 'string',
    enum: AI_IDEVICE_TYPES,
    description: 'Game iDevice type that has an AI tab.',
};

export const ideviceAiTools = [
    {
        name: 'exe.idevices.ai_prompt.get',
        description:
            "Get the prompt and line format an iDevice's AI tab uses to generate its items (questions, words, clues...). " +
            'Adapt topic and amount to the request, keep the format, and pass the lines to exe.idevices.ai_content.import.',
        inputSchema: {
            type: 'object',
            properties: {
                ideviceType,
                numLevels: {
                    type: 'number',
                    enum: [3, 4, 5],
                    description: 'adaptative-quiz only: number of difficulty levels (default 3).',
                },
            },
            required: ['ideviceType'],
        },
        handlerName: 'getIdeviceAiPrompt',
        writes: false,
        annotations: { idempotentHint: true, openWorldHint: false },
        category: 'idevices.ai',
    },
    {
        name: 'exe.idevices.ai_content.import',
        description:
            "Add items to a game iDevice from lines in its AI format (see exe.idevices.ai_prompt.get), using the iDevice's own importer. " +
            'Appends to componentId, or creates the iDevice in a new or existing block. Invalid lines are returned, not added.',
        inputSchema: {
            type: 'object',
            properties: {
                ideviceType,
                lines: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'One item per line, fields separated by #, exactly as the format describes.',
                },
                componentId: { type: 'string', description: 'Existing iDevice to append to; omit to create one.' },
                pageId: { type: 'string', description: 'nav-id of the target page; defaults to the currently selected page.' },
                blockId: { type: 'string', description: 'New iDevice only: existing block id; omit to create a block named blockName.' },
                blockName: { type: 'string', description: 'New iDevice only: visible block title (required without componentId).' },
                iconName: { type: 'string', description: 'New iDevice only: theme icon (see exe.idevices.icons.list).' },
                title: { type: 'string', description: 'New iDevice only: component title.' },
            },
            required: ['ideviceType', 'lines'],
        },
        handlerName: 'importIdeviceAiContent',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'idevices.ai',
    },
];

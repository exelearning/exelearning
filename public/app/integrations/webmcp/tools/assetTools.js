export const assetTools = [
    {
        name: 'exe.assets.list',
        description: 'List file-manager assets and subfolders, optionally scoped to a folderPath.',
        inputSchema: {
            type: 'object',
            properties: {
                folderPath: { type: 'string', description: 'Optional subfolder relative to the project file manager root.' },
            },
        },
        handlerName: 'listAssets',
        writes: false,
        annotations: { idempotentHint: true, openWorldHint: false },
        category: 'assets',
    },
    {
        name: 'exe.assets.upload_base64',
        description: 'Add a base64-encoded asset to the file manager.',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string', description: 'Target filename in the file manager.' },
                base64: { type: 'string', description: 'Base64 payload (with or without data URL prefix).' },
                mimeType: { type: 'string', description: 'Optional MIME type; auto-detected from filename when omitted.' },
                folderPath: { type: 'string', description: 'Optional subfolder relative to the file manager root.' },
            },
            required: ['filename', 'base64'],
        },
        handlerName: 'uploadAssetFromBase64',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'assets',
    },
    {
        name: 'exe.assets.upload_data_url',
        description: 'Add a data-URL asset (data:<mime>;base64,...) to the file manager.',
        inputSchema: {
            type: 'object',
            properties: {
                filename: { type: 'string', description: 'Target filename in the file manager.' },
                dataUrl: { type: 'string', description: 'data:<mime>;base64,... payload.' },
                folderPath: { type: 'string', description: 'Optional subfolder relative to the file manager root.' },
            },
            required: ['filename', 'dataUrl'],
        },
        handlerName: 'uploadAssetFromDataUrl',
        writes: true,
        annotations: { openWorldHint: false },
        category: 'assets',
    },
    {
        name: 'exe.assets.import_image_url',
        description: 'Fetch an image from an http/https URL and store it in the file manager. Output contains content from a third-party origin.',
        inputSchema: {
            type: 'object',
            properties: {
                imageUrl: { type: 'string', description: 'Absolute http/https URL of the image.' },
                picsumSeed: { type: 'string', description: 'Optional picsum.photos seed; used when imageUrl is missing.' },
                picsumWidth: { type: 'number', description: 'Optional picsum width in pixels (64-4096).' },
                picsumHeight: { type: 'number', description: 'Optional picsum height in pixels (64-4096).' },
                filename: { type: 'string', description: 'Optional asset filename; auto-derived when omitted.' },
                mimeType: { type: 'string', description: 'Optional MIME type override.' },
                folderPath: { type: 'string', description: 'Optional subfolder relative to the file manager root.' },
            },
        },
        handlerName: 'importAssetFromUrl',
        writes: true,
        annotations: { openWorldHint: true, untrustedContentHint: true },
        category: 'assets',
    },
];

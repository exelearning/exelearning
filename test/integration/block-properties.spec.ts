/**
 * Integration tests for Block Properties functionality
 *
 * Verifies that block properties (teacherOnly, visibility, minimized, identifier, cssClass)
 * flow correctly from Yjs document through export pipeline to final HTML output.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'path';
import { Html5Exporter } from '../../src/shared/export/exporters/Html5Exporter';
import { FflateZipProvider } from '../../src/shared/export/providers/FflateZipProvider';
import { IdeviceRenderer } from '../../src/shared/export/renderers/IdeviceRenderer';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
    AssetProvider,
    ExportBlock,
} from '../../src/shared/export/interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../src/services/idevice-config';

// Path to real iDevices
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

// Create mock document with blocks having various properties
const createMockDocumentWithBlockProperties = (blockProperties: ExportBlock['properties']): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with Block Properties',
        author: 'Test',
        description: '',
        language: 'es',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'default',
        version: '4.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
    }),
    getNavigation: (): ExportPage[] => [
        {
            id: 'page-1',
            title: 'Test Page',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Test Block',
                    order: 0,
                    properties: blockProperties,
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: '<p>Block content</p>',
                            properties: {},
                        },
                    ],
                },
            ],
        },
    ],
});

// Create mock document with multiple blocks for combined tests
const createMockDocumentWithMultipleBlocks = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with Multiple Blocks',
        author: 'Test',
        description: '',
        language: 'es',
        license: 'CC-BY-SA',
        keywords: '',
        theme: 'default',
        version: '4.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
    }),
    getNavigation: (): ExportPage[] => [
        {
            id: 'page-1',
            title: 'Test Page',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-teacher',
                    name: 'Teacher Block',
                    order: 0,
                    properties: { teacherOnly: 'true' },
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: '<p>Teacher only content</p>',
                            properties: {},
                        },
                    ],
                },
                {
                    id: 'block-hidden',
                    name: 'Hidden Block',
                    order: 1,
                    properties: { visibility: 'false' },
                    components: [
                        {
                            id: 'text-2',
                            type: 'text',
                            order: 0,
                            content: '<p>Hidden content</p>',
                            properties: {},
                        },
                    ],
                },
                {
                    id: 'block-custom',
                    name: 'Custom Block',
                    order: 2,
                    properties: {
                        identifier: 'my-custom-block',
                        cssClass: 'highlight featured',
                        minimized: 'true',
                    },
                    components: [
                        {
                            id: 'text-3',
                            type: 'text',
                            order: 0,
                            content: '<p>Custom styled content</p>',
                            properties: {},
                        },
                    ],
                },
            ],
        },
    ],
});

// Mock resource provider
const createMockResourceProvider = (): ResourceProvider => ({
    fetchTheme: async () => new Map(),
    fetchIdeviceResources: async () => new Map(),
    fetchBaseLibraries: async () => new Map(),
    fetchScormFiles: async () => new Map(),
    fetchLibraryFiles: async () => new Map(),
    fetchExeLogo: async () => null,
    fetchContentCss: async () => new Map(),
    normalizeIdeviceType: (type: string) => type.toLowerCase().replace(/idevice$/i, '') || 'text',
});

// Mock asset provider
const createMockAssetProvider = (): AssetProvider => ({
    getAsset: async () => null,
    getProjectAssets: async () => [],
    getAllAssets: async () => [],
});

// Helper to extract HTML from preview files
const getHtmlFromPreviewFiles = (files: Map<string, Uint8Array | string>, filename: string): string => {
    const content = files.get(filename);
    if (!content) return '';
    if (typeof content === 'string') return content;
    return new TextDecoder().decode(content);
};

describe('Block Properties Integration', () => {
    beforeAll(() => {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    describe('teacherOnly property', () => {
        it('should render block with teacher-only class in IdeviceRenderer', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Teacher Block',
                order: 0,
                properties: { teacherOnly: 'true' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('class="box teacher-only"');
        });

        it('should render block with teacher-only class in preview', async () => {
            const document = createMockDocumentWithBlockProperties({ teacherOnly: 'true' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('teacher-only');
        });

        it('should include content CSS file reference in preview', async () => {
            const document = createMockDocumentWithBlockProperties({ teacherOnly: 'true' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            // Html5Exporter references external CSS file for styling (including teacher-only rules)
            expect(html).toContain('content/css/base.css');
        });
    });

    describe('visibility property', () => {
        it('should render block with novisible class when visibility=false', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Hidden Block',
                order: 0,
                properties: { visibility: 'false' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should render block with novisible class in preview', async () => {
            const document = createMockDocumentWithBlockProperties({ visibility: 'false' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('novisible');
        });
    });

    describe('minimized property', () => {
        it('should render block with minimized class when minimized=true', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Minimized Block',
                order: 0,
                properties: { minimized: 'true' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('minimized');
        });

        it('should render block with minimized class in preview', async () => {
            const document = createMockDocumentWithBlockProperties({ minimized: 'true' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('minimized');
        });
    });

    describe('identifier property', () => {
        it('should render block with identifier attribute', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Custom ID Block',
                order: 0,
                properties: { identifier: 'my-custom-id' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('identifier="my-custom-id"');
        });

        it('should render block with identifier attribute in preview', async () => {
            const document = createMockDocumentWithBlockProperties({ identifier: 'preview-block-id' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('identifier="preview-block-id"');
        });

        it('should not add identifier attribute when empty', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Block',
                order: 0,
                properties: { identifier: '' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).not.toContain('identifier=');
        });
    });

    describe('cssClass property', () => {
        it('should render block with custom CSS classes', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Styled Block',
                order: 0,
                properties: { cssClass: 'highlight featured' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('highlight');
            expect(html).toContain('featured');
        });

        it('should render block with custom CSS classes in preview', async () => {
            const document = createMockDocumentWithBlockProperties({ cssClass: 'custom-style important' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('custom-style');
            expect(html).toContain('important');
        });
    });

    describe('combined properties', () => {
        it('should render all block properties correctly together', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Full Block',
                order: 0,
                properties: {
                    teacherOnly: 'true',
                    minimized: 'true',
                    identifier: 'special-block',
                    cssClass: 'featured',
                },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
            expect(html).toContain('minimized');
            expect(html).toContain('identifier="special-block"');
            expect(html).toContain('featured');
        });

        it('should render multiple blocks with different properties in preview', async () => {
            const document = createMockDocumentWithMultipleBlocks();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // Teacher block
            expect(html).toContain('teacher-only');

            // Hidden block
            expect(html).toContain('novisible');

            // Custom block
            expect(html).toContain('identifier="my-custom-block"');
            expect(html).toContain('highlight');
            expect(html).toContain('featured');
            expect(html).toContain('minimized');
        });

        it('should preserve all properties through export pipeline', async () => {
            const document = createMockDocumentWithBlockProperties({
                visibility: 'false',
                teacherOnly: 'true',
                minimized: 'true',
                identifier: 'test-id',
                cssClass: 'test-class',
            });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // All properties should be present
            expect(html).toContain('novisible');
            expect(html).toContain('teacher-only');
            expect(html).toContain('minimized');
            expect(html).toContain('identifier="test-id"');
            expect(html).toContain('test-class');
        });
    });

    describe('iDevice properties', () => {
        it('should render iDevice with teacher-only class', async () => {
            const document: ExportDocument = {
                getMetadata: (): ExportMetadata => ({
                    title: 'Test',
                    author: '',
                    description: '',
                    language: 'en',
                    license: '',
                    keywords: '',
                    theme: 'default',
                    version: '4.0',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                }),
                getNavigation: (): ExportPage[] => [
                    {
                        id: 'page-1',
                        title: 'Page',
                        parentId: null,
                        order: 0,
                        blocks: [
                            {
                                id: 'block-1',
                                name: '',
                                order: 0,
                                components: [
                                    {
                                        id: 'idevice-teacher',
                                        type: 'text',
                                        order: 0,
                                        content: '<p>Teacher only iDevice</p>',
                                        properties: {},
                                        structureProperties: { teacherOnly: 'true' },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('idevice_node text teacher-only');
        });

        it('should render iDevice with novisible class', async () => {
            const document: ExportDocument = {
                getMetadata: (): ExportMetadata => ({
                    title: 'Test',
                    author: '',
                    description: '',
                    language: 'en',
                    license: '',
                    keywords: '',
                    theme: 'default',
                    version: '4.0',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                }),
                getNavigation: (): ExportPage[] => [
                    {
                        id: 'page-1',
                        title: 'Page',
                        parentId: null,
                        order: 0,
                        blocks: [
                            {
                                id: 'block-1',
                                name: '',
                                order: 0,
                                components: [
                                    {
                                        id: 'idevice-hidden',
                                        type: 'text',
                                        order: 0,
                                        content: '<p>Hidden iDevice</p>',
                                        properties: {},
                                        structureProperties: { visibility: 'false' },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('novisible');
        });
    });

    describe('Boolean values (Yjs format)', () => {
        it('should render block with teacher-only class when teacherOnly=true (boolean)', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Teacher Block',
                order: 0,
                properties: { teacherOnly: true as unknown as string },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should render block with novisible class when visibility=false (boolean)', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Hidden Block',
                order: 0,
                properties: { visibility: false as unknown as string },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should render block with novisible class in preview when visibility=false (boolean)', async () => {
            const document = createMockDocumentWithBlockProperties({ visibility: false as unknown as string });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('novisible');
        });

        it('should render block with teacher-only class in preview when teacherOnly=true (boolean)', async () => {
            const document = createMockDocumentWithBlockProperties({ teacherOnly: true as unknown as string });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('teacher-only');
        });

        it('should render iDevice with novisible class when visibility=false (boolean)', async () => {
            const document: ExportDocument = {
                getMetadata: (): ExportMetadata => ({
                    title: 'Test',
                    author: '',
                    description: '',
                    language: 'en',
                    license: '',
                    keywords: '',
                    theme: 'default',
                    version: '4.0',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                }),
                getNavigation: (): ExportPage[] => [
                    {
                        id: 'page-1',
                        title: 'Page',
                        parentId: null,
                        order: 0,
                        blocks: [
                            {
                                id: 'block-1',
                                name: '',
                                order: 0,
                                components: [
                                    {
                                        id: 'idevice-hidden',
                                        type: 'text',
                                        order: 0,
                                        content: '<p>Hidden iDevice</p>',
                                        properties: {},
                                        structureProperties: { visibility: false as unknown as string },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('novisible');
        });

        it('should render iDevice with teacher-only class when teacherOnly=true (boolean)', async () => {
            const document: ExportDocument = {
                getMetadata: (): ExportMetadata => ({
                    title: 'Test',
                    author: '',
                    description: '',
                    language: 'en',
                    license: '',
                    keywords: '',
                    theme: 'default',
                    version: '4.0',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                }),
                getNavigation: (): ExportPage[] => [
                    {
                        id: 'page-1',
                        title: 'Page',
                        parentId: null,
                        order: 0,
                        blocks: [
                            {
                                id: 'block-1',
                                name: '',
                                order: 0,
                                components: [
                                    {
                                        id: 'idevice-teacher',
                                        type: 'text',
                                        order: 0,
                                        content: '<p>Teacher only</p>',
                                        properties: {},
                                        structureProperties: { teacherOnly: true as unknown as string },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('teacher-only');
        });

        it('should combine boolean and string properties correctly in preview', async () => {
            const document: ExportDocument = {
                getMetadata: (): ExportMetadata => ({
                    title: 'Test',
                    author: '',
                    description: '',
                    language: 'en',
                    license: '',
                    keywords: '',
                    theme: 'default',
                    version: '4.0',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                }),
                getNavigation: (): ExportPage[] => [
                    {
                        id: 'page-1',
                        title: 'Page',
                        parentId: null,
                        order: 0,
                        blocks: [
                            {
                                id: 'block-mixed',
                                name: 'Mixed Block',
                                order: 0,
                                properties: {
                                    teacherOnly: true as unknown as string,
                                    minimized: true as unknown as string,
                                    identifier: 'my-block',
                                    cssClass: 'custom-style',
                                },
                                components: [
                                    {
                                        id: 'text-1',
                                        type: 'text',
                                        order: 0,
                                        content: '<p>Mixed content</p>',
                                        properties: {},
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('teacher-only');
            expect(html).toContain('minimized');
            expect(html).toContain('identifier="my-block"');
            expect(html).toContain('custom-style');
        });
    });
});

/**
 * Integration tests for iDevice Properties functionality
 *
 * Verifies that iDevice structure properties (teacherOnly, visibility, cssClass, identifier)
 * flow correctly from Yjs document through export pipeline to final HTML output.
 *
 * These properties are stored in component.structureProperties (not component.properties which
 * contains jsonProperties for iDevice-specific config like rubric settings).
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
    ExportComponent,
    ExportComponentProperties,
} from '../../src/shared/export/interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../src/services/idevice-config';

// Path to real iDevices
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

// Create mock document with iDevice having various structure properties
const createMockDocumentWithIdeviceProperties = (structureProperties: ExportComponentProperties): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with iDevice Properties',
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
                    properties: {},
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: '<p>iDevice content</p>',
                            properties: {},
                            structureProperties,
                        },
                    ],
                },
            ],
        },
    ],
});

// Create mock document with multiple iDevices for combined tests
const createMockDocumentWithMultipleIdevices = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with Multiple iDevices',
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
                    properties: {},
                    components: [
                        {
                            id: 'text-teacher',
                            type: 'text',
                            order: 0,
                            content: '<p>Teacher only iDevice content</p>',
                            properties: {},
                            structureProperties: { teacherOnly: 'true' },
                        },
                        {
                            id: 'text-hidden',
                            type: 'text',
                            order: 1,
                            content: '<p>Hidden iDevice content</p>',
                            properties: {},
                            structureProperties: { visibility: 'false' },
                        },
                        {
                            id: 'text-custom',
                            type: 'text',
                            order: 2,
                            content: '<p>Custom styled iDevice</p>',
                            properties: {},
                            structureProperties: {
                                cssClass: 'highlight featured',
                            },
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
    fetchGlobalFontFiles: async (_fontName: string) => null,
    fetchI18nFile: async (_language: string) => '',
    fetchI18nTranslations: async (_language: string) => new Map<string, string>(),
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

describe('iDevice Properties Integration', () => {
    beforeAll(() => {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    describe('teacherOnly property', () => {
        it('should render iDevice with teacher-only class in IdeviceRenderer', () => {
            const renderer = new IdeviceRenderer();

            const component: ExportComponent = {
                id: 'text-1',
                type: 'text',
                order: 0,
                content: '<p>Teacher only content</p>',
                properties: {},
                structureProperties: { teacherOnly: 'true' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should render iDevice with teacher-only class when boolean true', () => {
            const renderer = new IdeviceRenderer();

            const component: ExportComponent = {
                id: 'text-1',
                type: 'text',
                order: 0,
                content: '<p>Teacher only content</p>',
                properties: {},
                structureProperties: { teacherOnly: true as unknown as string },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should render iDevice with teacher-only class in preview', async () => {
            const document = createMockDocumentWithIdeviceProperties({ teacherOnly: 'true' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            // Look for the iDevice div with teacher-only class
            expect(html).toMatch(/idevice_node[^"]*teacher-only/);
        });

        it('should include content CSS file reference for teacher mode toggle', async () => {
            const document = createMockDocumentWithIdeviceProperties({ teacherOnly: 'true' });
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
        it('should render iDevice with novisible class when visibility=false', () => {
            const renderer = new IdeviceRenderer();

            const component: ExportComponent = {
                id: 'text-1',
                type: 'text',
                order: 0,
                content: '<p>Hidden content</p>',
                properties: {},
                structureProperties: { visibility: 'false' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should render iDevice with novisible class when boolean false', () => {
            const renderer = new IdeviceRenderer();

            const component: ExportComponent = {
                id: 'text-1',
                type: 'text',
                order: 0,
                content: '<p>Hidden content</p>',
                properties: {},
                structureProperties: { visibility: false as unknown as string },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should render iDevice with novisible class in preview', async () => {
            const document = createMockDocumentWithIdeviceProperties({ visibility: 'false' });
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

    describe('cssClass property', () => {
        it('should render iDevice with custom CSS classes', () => {
            const renderer = new IdeviceRenderer();

            const component: ExportComponent = {
                id: 'text-1',
                type: 'text',
                order: 0,
                content: '<p>Styled content</p>',
                properties: {},
                structureProperties: { cssClass: 'highlight featured' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('highlight');
            expect(html).toContain('featured');
        });

        it('should render iDevice with custom CSS classes in preview', async () => {
            const document = createMockDocumentWithIdeviceProperties({ cssClass: 'my-custom-style' });
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            expect(html).toContain('my-custom-style');
        });
    });

    describe('combined properties', () => {
        it('should render all iDevices with correct properties in preview', async () => {
            const document = createMockDocumentWithMultipleIdevices();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);
            // Teacher-only iDevice should have teacher-only class
            expect(html).toMatch(/idevice_node[^"]*teacher-only/);
            // Hidden iDevice should have novisible class
            expect(html).toContain('novisible');
            // Custom iDevice should have custom classes
            expect(html).toContain('highlight');
            expect(html).toContain('featured');
        });

        it('should render multiple iDevices with different properties correctly', () => {
            const renderer = new IdeviceRenderer();

            const teacherComponent: ExportComponent = {
                id: 'text-teacher',
                type: 'text',
                order: 0,
                content: '<p>Teacher</p>',
                properties: {},
                structureProperties: { teacherOnly: 'true' },
            };

            const hiddenComponent: ExportComponent = {
                id: 'text-hidden',
                type: 'text',
                order: 1,
                content: '<p>Hidden</p>',
                properties: {},
                structureProperties: { visibility: 'false' },
            };

            const customComponent: ExportComponent = {
                id: 'text-custom',
                type: 'text',
                order: 2,
                content: '<p>Custom</p>',
                properties: {},
                structureProperties: { cssClass: 'note' },
            };

            const teacherHtml = renderer.render(teacherComponent, {
                basePath: '',
                includeDataAttributes: true,
            });
            const hiddenHtml = renderer.render(hiddenComponent, {
                basePath: '',
                includeDataAttributes: true,
            });
            const customHtml = renderer.render(customComponent, { basePath: '', includeDataAttributes: true });

            expect(teacherHtml).toContain('teacher-only');
            expect(hiddenHtml).toContain('novisible');
            expect(customHtml).toContain('note');
        });
    });

    describe('legacy visibilityType property', () => {
        it('should render iDevice with teacher-only class when visibilityType=teacher (legacy)', () => {
            const renderer = new IdeviceRenderer();

            // Legacy format where visibilityType is in jsonProperties
            const component: ExportComponent = {
                id: 'text-1',
                type: 'text',
                order: 0,
                content: '<p>Teacher only content</p>',
                properties: { visibilityType: 'teacher' },
                structureProperties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });
    });
});

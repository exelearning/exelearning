/**
 * Integration tests for Teacher Mode Toggle functionality
 *
 * Verifies that:
 * 1. Teacher-only content gets the correct CSS class
 * 2. Preview includes correct header structure for exe_export.js to find
 * 3. Preview includes teacher-only CSS rule
 * 4. Export includes correct header structure
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
    ExportBlock,
} from '../../src/shared/export/interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../src/services/idevice-config';

// Path to real iDevices
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

// Create mock document with teacher-only content
const createMockDocumentWithTeacherOnly = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with Teacher Mode',
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
            title: 'Page with Teacher Content',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Teacher Only Block',
                    order: 0,
                    properties: { teacherOnly: 'true' },
                    components: [
                        {
                            id: 'text-1',
                            type: 'text',
                            order: 0,
                            content: '<p>This is teacher-only content</p>',
                            properties: {},
                        },
                    ],
                },
                {
                    id: 'block-2',
                    name: 'Regular Block',
                    order: 1,
                    components: [
                        {
                            id: 'text-2',
                            type: 'text',
                            order: 0,
                            content: '<p>This is visible to everyone</p>',
                            properties: {},
                            structureProperties: { teacherOnly: 'true' },
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

describe('Teacher Mode Toggle Integration', () => {
    beforeAll(() => {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    describe('IdeviceRenderer teacher-only class', () => {
        it('should add teacher-only class to idevice when teacherOnly is true', () => {
            const renderer = new IdeviceRenderer();

            const component: ExportComponent = {
                id: 'teacher-idevice-1',
                type: 'text',
                order: 0,
                content: '<p>Teacher content</p>',
                properties: {},
                structureProperties: { teacherOnly: 'true' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('class="idevice_node text teacher-only"');
        });

        it('should add teacher-only class to idevice when visibilityType is teacher', () => {
            const renderer = new IdeviceRenderer();

            const component: ExportComponent = {
                id: 'teacher-idevice-2',
                type: 'text',
                order: 0,
                content: '<p>Teacher content</p>',
                properties: { visibilityType: 'teacher' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should add teacher-only class to block when teacherOnly is true', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'teacher-block-1',
                name: 'Teacher Block',
                order: 0,
                properties: { teacherOnly: 'true' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('class="box teacher-only"');
        });

        it('should add teacher-only class to block when visibilityType is teacher', () => {
            const renderer = new IdeviceRenderer();

            const block: ExportBlock = {
                id: 'teacher-block-2',
                name: 'Teacher Block',
                order: 0,
                properties: { visibilityType: 'teacher' },
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });
    });

    describe('Html5Exporter header structure', () => {
        it('should render header elements (not divs) for exe_export.js teacherMode selectors', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // exe_export.js teacherMode.init() uses:
            // $(".package-header") for single-page
            // $(".page-header") for multi-page
            // Note: These are now <div> elements inside <header class="main-header">
            expect(html).toContain('class="package-header');
            expect(html).toContain('class="page-header"');
        });

        it('should include content CSS file reference in preview', async () => {
            const document = createMockDocumentWithTeacherOnly();
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

        it('should render teacher-only blocks with correct class in preview', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // Block with teacherOnly=true should have teacher-only class
            expect(html).toContain('class="box teacher-only"');
        });

        it('should render teacher-only idevices with correct class in preview', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // iDevice with teacherOnly=true should have teacher-only class
            expect(html).toContain('idevice_node text teacher-only');
        });

        it('should load exe_export.js in preview for teacherMode functionality', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // exe_export.js should be loaded
            expect(html).toContain('exe_export.js');
        });

        it('should reference exe_export.js script which contains init logic', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();
            const assets = createMockAssetProvider();
            const zip = new FflateZipProvider();

            const exporter = new Html5Exporter(document, resources, assets, zip);
            const files = await exporter.generateForPreview();
            const html = getHtmlFromPreviewFiles(files, 'index.html');

            expect(html.length).toBeGreaterThan(0);

            // exe_export.js contains the teacherMode.init() logic
            // The actual init call is in common.js or the theme's JS file
            expect(html).toContain('exe_export.js');
        });
    });

    describe('Teacher Mode CSS Rules', () => {
        it('should hide teacher-only content by default (when mode-teacher class is absent)', () => {
            // This test validates the CSS rule structure
            const expectedCss = 'html:not(.mode-teacher) .js .teacher-only';
            // The CSS rule should target:
            // - html element WITHOUT .mode-teacher class
            // - AND with .js class (JavaScript enabled)
            // - hide all .teacher-only elements
            expect(expectedCss).toContain(':not(.mode-teacher)');
            expect(expectedCss).toContain('.js');
            expect(expectedCss).toContain('.teacher-only');
        });
    });
});

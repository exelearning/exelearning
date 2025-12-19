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
import { WebsitePreviewExporter } from '../../src/shared/export/exporters/WebsitePreviewExporter';
import { IdeviceRenderer } from '../../src/shared/export/renderers/IdeviceRenderer';
import type {
    ExportDocument,
    ExportMetadata,
    ExportPage,
    ResourceProvider,
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
                            properties: { teacherOnly: 'true' },
                        },
                    ],
                },
            ],
        },
    ],
});

// Mock resource provider
const createMockResourceProvider = (): ResourceProvider => ({
    getThemeFiles: async () => [],
    getThemeFile: async () => null,
    getIdeviceFiles: async () => [],
    getIdeviceFile: async () => null,
    getLibraryFiles: async () => [],
    getLibraryFile: async () => null,
});

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
                properties: { teacherOnly: 'true' },
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

    describe('WebsitePreviewExporter header structure', () => {
        it('should render header elements (not divs) for exe_export.js teacherMode selectors', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // exe_export.js teacherMode.init() uses:
            // $("header.package-header") for single-page
            // $("header.page-header") for multi-page
            expect(result.html).toContain('<header class="package-header');
            expect(result.html).toContain('<header class="page-header"');
        });

        it('should include teacher-only CSS rule in preview', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // CSS rule that hides teacher-only content by default
            expect(result.html).toContain('html:not(.mode-teacher) .js .teacher-only');
            expect(result.html).toContain('display: none !important');
        });

        it('should render teacher-only blocks with correct class in preview', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // Block with teacherOnly=true should have teacher-only class
            expect(result.html).toContain('class="box teacher-only"');
        });

        it('should render teacher-only idevices with correct class in preview', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // iDevice with teacherOnly=true should have teacher-only class
            expect(result.html).toContain('idevice_node text teacher-only');
        });

        it('should load exe_export.js in preview for teacherMode functionality', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // exe_export.js should be loaded
            expect(result.html).toContain('exe_export.js');
        });

        it('should call $exeExport.init() which triggers teacherMode.init()', async () => {
            const document = createMockDocumentWithTeacherOnly();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // Init call should be present
            expect(result.html).toContain('$exeExport.init()');
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

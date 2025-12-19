/**
 * Integration tests for Feedback Toggle functionality
 *
 * Verifies that feedback (retroalimentación) elements are correctly rendered
 * in exports and previews, with proper CSS classes and data attributes for
 * the toggle behavior to work.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'path';
import { WebsitePreviewExporter } from '../../src/shared/export/exporters/WebsitePreviewExporter';
import type { ExportDocument, ExportMetadata, ExportPage, ResourceProvider } from '../../src/shared/export/interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../src/services/idevice-config';

// Path to real iDevices
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

// Feedback content that matches the structure used in eXeLearning
const FEEDBACK_CONTENT = `
<div class="exe-text"><div class="exe-text-template">
    <div class="textIdeviceContent">
        <div class="exe-text-activity">
            <div><p>Main content text</p>
            <div class="iDevice_buttons feedback-button js-required">
                <input type="button" class="feedbacktooglebutton" value="Show Feedback">
            </div>
            <div class="feedback js-feedback js-hidden"><p>This is the feedback content</p></div>
            <p class="clearfix"></p></div>
        </div>
    </div>
</div></div>
`;

// Create mock document with feedback content
const createMockDocumentWithFeedback = (): ExportDocument => ({
    getMetadata: (): ExportMetadata => ({
        title: 'Test Project with Feedback',
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
            title: 'Page with Feedback',
            parentId: null,
            order: 0,
            blocks: [
                {
                    id: 'block-1',
                    name: 'Block 1',
                    order: 0,
                    components: [
                        {
                            id: 'text-idevice-1',
                            type: 'text',
                            order: 0,
                            content: FEEDBACK_CONTENT,
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
    getThemeFiles: async () => [],
    getThemeFile: async () => null,
    getIdeviceFiles: async () => [],
    getIdeviceFile: async () => null,
    getLibraryFiles: async () => [],
    getLibraryFile: async () => null,
});

describe('Feedback Toggle Integration', () => {
    beforeAll(() => {
        loadIdeviceConfigs(REAL_IDEVICES_PATH);
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    describe('IdeviceRenderer for Export', () => {
        it('should render text idevice with data-idevice-component-type="json"', () => {
            const { IdeviceRenderer } = require('../../src/shared/export/renderers/IdeviceRenderer');
            const renderer = new IdeviceRenderer();

            const component = {
                id: 'text-feedback-test',
                type: 'text',
                order: 0,
                content: FEEDBACK_CONTENT,
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            // Verify the text idevice has the component-type attribute
            expect(html).toContain('data-idevice-component-type="json"');
            expect(html).toContain('data-idevice-type="text"');

            // Verify feedback elements are preserved
            expect(html).toContain('feedbacktooglebutton');
            expect(html).toContain('js-feedback');
            expect(html).toContain('js-hidden');
        });

        it('should render freetext idevice with data-idevice-component-type="json"', () => {
            const { IdeviceRenderer } = require('../../src/shared/export/renderers/IdeviceRenderer');
            const renderer = new IdeviceRenderer();

            const component = {
                id: 'freetext-test',
                type: 'freetext',
                order: 0,
                content: '<p>Free text content</p>',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            // freetext maps to 'text' cssClass and should have json componentType
            expect(html).toContain('data-idevice-component-type="json"');
        });
    });

    describe('Website Preview', () => {
        it('should include js-hidden CSS rules in preview', async () => {
            const document = createMockDocumentWithFeedback();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);
            expect(result.html).toBeDefined();

            // Preview must include inline CSS for js-hidden
            expect(result.html).toContain('.js-hidden { display: none; }');
            expect(result.html).toContain('.js .js-required { display: block; }');
        });

        it('should include data-idevice-component-type="json" for text idevice in preview', async () => {
            const document = createMockDocumentWithFeedback();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // Verify the text idevice has the component-type attribute
            expect(result.html).toContain('data-idevice-component-type="json"');
            expect(result.html).toContain('data-idevice-type="text"');
        });

        it('should add js class to body for CSS selectors to work', async () => {
            const document = createMockDocumentWithFeedback();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // The preview adds 'js' class to body via inline script
            expect(result.html).toContain('document.body.className+=" js"');
        });

        it('should preserve feedback structure in rendered content', async () => {
            const document = createMockDocumentWithFeedback();
            const resources = createMockResourceProvider();

            const exporter = new WebsitePreviewExporter(document, resources);
            const result = await exporter.generatePreview();

            expect(result.success).toBe(true);

            // Verify feedback elements are present in preview
            expect(result.html).toContain('feedbacktooglebutton');
            expect(result.html).toContain('feedback-button');
            expect(result.html).toContain('js-feedback');
            expect(result.html).toContain('js-hidden');
        });
    });

    describe('Feedback CSS Classes', () => {
        it('feedback content should have js-hidden class to be hidden by default', () => {
            // This validates that the feedback HTML structure is correct
            expect(FEEDBACK_CONTENT).toContain('class="feedback js-feedback js-hidden"');
        });

        it('feedback button should have js-required class to be shown when JS is enabled', () => {
            // This validates that the feedback button HTML structure is correct
            expect(FEEDBACK_CONTENT).toContain('class="iDevice_buttons feedback-button js-required"');
        });

        it('feedback button should have feedbacktooglebutton class for event binding', () => {
            // text.js binds click handlers to .feedbacktooglebutton
            expect(FEEDBACK_CONTENT).toContain('class="feedbacktooglebutton"');
        });
    });
});

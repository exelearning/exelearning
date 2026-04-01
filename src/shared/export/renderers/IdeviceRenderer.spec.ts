/**
 * Tests for IdeviceRenderer
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IdeviceRenderer } from './IdeviceRenderer';
import type { ExportComponent, ExportBlock } from '../interfaces';
import { loadIdeviceConfigs, resetIdeviceConfigCache } from '../../../services/idevice-config';

// Path to real iDevices for integration testing
const REAL_IDEVICES_PATH = path.join(process.cwd(), 'public/files/perm/idevices/base');

describe('IdeviceRenderer', () => {
    let renderer: IdeviceRenderer;

    // Load real iDevice configs before all tests
    beforeAll(() => {
        if (fs.existsSync(REAL_IDEVICES_PATH)) {
            loadIdeviceConfigs(REAL_IDEVICES_PATH);
        }
    });

    afterAll(() => {
        resetIdeviceConfigCache();
    });

    beforeEach(() => {
        renderer = new IdeviceRenderer();
    });

    describe('render', () => {
        it('should render a text iDevice without extra content wrapper', () => {
            // Use 'text' iDevice which exists in config.xml and is a JSON type
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Hello World</p>',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('id="comp-1"');
            expect(html).toContain('class="idevice_node text"');
            expect(html).toContain('<p>Hello World</p>');
        });

        it('should render with correct data attributes', () => {
            // Use 'form' iDevice which exists in config.xml and is a JSON type
            const component: ExportComponent = {
                id: 'form-1',
                type: 'form',
                order: 0,
                content: '',
                properties: { question: 'What is 2+2?', answers: ['3', '4', '5'] },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('data-idevice-path="idevices/form/"');
            expect(html).toContain('data-idevice-type="form"');
            expect(html).toContain('data-idevice-component-type="json"');
            expect(html).toContain('data-idevice-json-data="');
        });

        it('should include data-idevice-component-type="json" for text idevice (feedback toggle support)', () => {
            // Text iDevice needs componentType="json" so that exe_export.js
            // calls $text.renderBehaviour() to attach feedback toggle handlers
            const component: ExportComponent = {
                id: 'text-feedback-test',
                type: 'text',
                order: 0,
                content: '<p>Content with feedback</p>',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('data-idevice-path="idevices/text/"');
            expect(html).toContain('data-idevice-type="text"');
            expect(html).toContain('data-idevice-component-type="json"');
        });

        it('should include only ideviceId in data-idevice-json-data for text idevice', () => {
            // Text iDevices should only have ideviceId in JSON data, not full properties
            // This reduces HTML size and avoids exposing unnecessary data
            const component: ExportComponent = {
                id: 'text-minimal-json',
                type: 'text',
                order: 0,
                content: '<p>Some text content</p>',
                properties: {
                    someProperty: 'should not appear',
                    anotherProperty: 123,
                },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            // Should contain data-idevice-json-data with only ideviceId
            expect(html).toContain('data-idevice-json-data="');
            // Extract and parse the JSON data
            const jsonMatch = html.match(/data-idevice-json-data="([^"]+)"/);
            expect(jsonMatch).not.toBeNull();
            const jsonData = JSON.parse(jsonMatch![1].replace(/&quot;/g, '"'));
            expect(jsonData).toEqual({ ideviceId: 'text-minimal-json' });
            // Should NOT contain the other properties
            expect(jsonData.someProperty).toBeUndefined();
            expect(jsonData.anotherProperty).toBeUndefined();
        });

        it('should include full properties in data-idevice-json-data for non-text idevices', () => {
            // Non-text iDevices should have full properties in JSON data
            const component: ExportComponent = {
                id: 'form-full-json',
                type: 'form',
                order: 0,
                content: '',
                properties: {
                    questionsData: [{ question: 'Test?' }],
                    exportScorm: { saveScore: true },
                },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('data-idevice-json-data="');
            // Extract and parse the JSON data
            const jsonMatch = html.match(/data-idevice-json-data="([^"]+)"/);
            expect(jsonMatch).not.toBeNull();
            const jsonData = JSON.parse(
                jsonMatch![1]
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>'),
            );
            // Should contain the full properties
            expect(jsonData.questionsData).toBeDefined();
            expect(jsonData.exportScorm).toBeDefined();
        });

        it('should not include data-idevice-template for text idevice', () => {
            // Text iDevices don't need template attribute
            const component: ExportComponent = {
                id: 'text-no-template',
                type: 'text',
                order: 0,
                content: '<p>Text content</p>',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).not.toContain('data-idevice-template');
        });

        it('should not include data attributes when disabled', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Test</p>',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: false });

            expect(html).not.toContain('data-idevice-path');
            expect(html).not.toContain('data-idevice-type');
        });

        it('should add db-no-data class when content is empty', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('db-no-data');
        });

        it('should add novisible class when visibility is false', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Hidden</p>',
                properties: {},
                structureProperties: { visibility: 'false' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should add teacher-only class when teacherOnly is true', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Teacher only</p>',
                properties: {},
                structureProperties: { teacherOnly: 'true' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should add custom cssClass from structureProperties', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Custom styled</p>',
                properties: {},
                structureProperties: { cssClass: 'my-custom-class' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('my-custom-class');
        });

        it('should apply basePath to idevice path', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'crossword',
                order: 0,
                content: '',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '../', includeDataAttributes: true });

            expect(html).toContain('data-idevice-path="../idevices/crossword/"');
        });

        it('should handle preview mode paths', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'crossword',
                order: 0,
                content: '',
                properties: {},
            };

            const html = renderer.render(component, {
                basePath: '/files/perm/idevices/base/',
                includeDataAttributes: true,
            });

            expect(html).toContain('data-idevice-path="/files/perm/idevices/base/crossword/export/"');
        });

        // Tests for boolean values (Yjs stores booleans, not strings)
        it('should add novisible class when visibility is false (boolean)', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Hidden</p>',
                properties: {},
                structureProperties: { visibility: false as unknown as string },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should add teacher-only class when teacherOnly is true (boolean)', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Teacher only</p>',
                properties: {},
                structureProperties: { teacherOnly: true as unknown as string },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        // Test for legacy visibilityType in jsonProperties
        it('should add teacher-only class when visibilityType is teacher (legacy format)', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Teacher only via legacy</p>',
                properties: { visibilityType: 'teacher' },
                structureProperties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        // Test when structureProperties is undefined
        it('should render without structureProperties (undefined fallback)', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>No structure props</p>',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('class="idevice_node text"');
            expect(html).not.toContain('novisible');
            expect(html).not.toContain('teacher-only');
        });

        // Test combining multiple structureProperties
        it('should apply multiple structureProperties together', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Multiple props</p>',
                properties: {},
                structureProperties: {
                    visibility: 'false',
                    teacherOnly: 'true',
                    cssClass: 'highlight important',
                },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
            expect(html).toContain('teacher-only');
            expect(html).toContain('highlight');
            expect(html).toContain('important');
        });

        // Test cssClass not being a string (should be ignored)
        it('should ignore cssClass when not a string', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Invalid cssClass</p>',
                properties: {},
                structureProperties: { cssClass: 123 as unknown as string },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            // Should have basic classes but not the invalid cssClass
            expect(html).toContain('class="idevice_node text"');
            expect(html).not.toContain('123');
        });

        // Test visibility true should NOT add novisible class
        it('should not add novisible class when visibility is true', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Visible content</p>',
                properties: {},
                structureProperties: { visibility: 'true' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).not.toContain('novisible');
        });

        // Test teacherOnly false should NOT add teacher-only class
        it('should not add teacher-only class when teacherOnly is false', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Not teacher only</p>',
                properties: {},
                structureProperties: { teacherOnly: 'false' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).not.toContain('teacher-only');
        });

        // Test empty cssClass should not add extra spaces
        it('should handle empty cssClass gracefully', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Empty cssClass</p>',
                properties: {},
                structureProperties: { cssClass: '' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('class="idevice_node text"');
            // Should not have trailing space or empty class
            expect(html).not.toContain('class="idevice_node text "');
        });
    });

    describe('renderBlock', () => {
        it('should render a block with header', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Introduction',
                order: 0,
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('id="block-1"');
            expect(html).toContain('class="box"');
            expect(html).toContain('<h1 class="box-title">Introduction</h1>');
        });

        it('should render a block without header when name is empty', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: '',
                order: 0,
                components: [],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('no-header');
            expect(html).not.toContain('box-title');
        });

        it('should render block with components', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test Block',
                order: 0,
                components: [
                    {
                        id: 'comp-1',
                        type: 'text',
                        order: 0,
                        content: '<p>First</p>',
                        properties: {},
                    },
                    {
                        id: 'comp-2',
                        type: 'text',
                        order: 1,
                        content: '<p>Second</p>',
                        properties: {},
                    },
                ],
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('id="comp-1"');
            expect(html).toContain('id="comp-2"');
            expect(html).toContain('<p>First</p>');
            expect(html).toContain('<p>Second</p>');
        });

        it('should add minimized class when block is minimized', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test',
                order: 0,
                components: [],
                properties: { minimized: 'true' },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('minimized');
        });

        it('should add teacher-only class when block has teacherOnly=true', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Teacher Block',
                order: 0,
                components: [],
                properties: { teacherOnly: 'true' },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should add novisible class when block has visibility=false', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Hidden Block',
                order: 0,
                components: [],
                properties: { visibility: 'false' },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should add custom cssClass to block', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Styled Block',
                order: 0,
                components: [],
                properties: { cssClass: 'highlight important' },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('highlight');
            expect(html).toContain('important');
        });

        it('should combine multiple block properties correctly', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Full Block',
                order: 0,
                components: [],
                properties: {
                    teacherOnly: 'true',
                    minimized: 'true',
                    cssClass: 'featured',
                },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
            expect(html).toContain('minimized');
            expect(html).toContain('featured');
        });

        // Tests for boolean values (Yjs stores booleans, not strings)
        it('should add teacher-only class when block has teacherOnly=true (boolean)', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Teacher Block',
                order: 0,
                components: [],
                properties: { teacherOnly: true as unknown as string },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should add novisible class when block has visibility=false (boolean)', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Hidden Block',
                order: 0,
                components: [],
                properties: { visibility: false as unknown as string },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('novisible');
        });

        it('should add minimized class when block has minimized=true (boolean)', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Minimized Block',
                order: 0,
                components: [],
                properties: { minimized: true as unknown as string },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('minimized');
        });

        it('should combine boolean and string properties correctly', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Mixed Block',
                order: 0,
                components: [],
                properties: {
                    teacherOnly: true as unknown as string,
                    visibility: false as unknown as string,
                    minimized: true as unknown as string,
                    cssClass: 'custom-class',
                },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
            expect(html).toContain('novisible');
            expect(html).toContain('minimized');
            expect(html).toContain('custom-class');
        });
    });

    describe('fixAssetUrls', () => {
        it('should convert asset:// URLs to content/resources/ (skipping UUID)', () => {
            // New format: asset://uuid/exportPath → content/resources/exportPath
            // The UUID is the first path segment and should be skipped
            const content = '<img src="asset://uuid-123/image.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="content/resources/image.png">');
        });

        it('should apply basePath to asset URLs (skipping UUID)', () => {
            const content = '<img src="asset://uuid-123/image.png">';
            const fixed = renderer.fixAssetUrls(content, '../');

            expect(fixed).toBe('<img src="../content/resources/image.png">');
        });

        it('should preserve folder structure after UUID in asset URLs', () => {
            // asset://uuid/folder/subfolder/file.png → content/resources/folder/subfolder/file.png
            const content = '<img src="asset://abc123/images/photos/vacation.jpg">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="content/resources/images/photos/vacation.jpg">');
        });

        it('should handle files/tmp/ paths', () => {
            const content = '<img src="files/tmp/2024/01/01/session-123/abc/image.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="content/resources/abc/image.png">');
        });

        it('should handle /files/ paths (preserves leading slash)', () => {
            // Note: The regex matches files/tmp/ (without leading /), so the / is preserved
            const content = '<img src="/files/tmp/2024/01/session/images/photo.jpg">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="/content/resources/images/photo.jpg">');
        });

        it('should handle empty content', () => {
            expect(renderer.fixAssetUrls('', '')).toBe('');
        });

        it('should convert legacy resources/ URLs to content/resources/', () => {
            const content = '<img src="resources/elcid.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="content/resources/elcid.png">');
        });

        it('should apply basePath to legacy resources/ URLs', () => {
            const content = '<img src="resources/imagen.jpg">';
            const fixed = renderer.fixAssetUrls(content, '../');

            expect(fixed).toBe('<img src="../content/resources/imagen.jpg">');
        });

        it('should handle resources/ URLs with spaces in filename', () => {
            const content = '<img src="resources/my image file.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="content/resources/my image file.png">');
        });

        it('should handle href attributes with resources/ URLs', () => {
            const content = '<a href="resources/document.pdf">Download</a>';
            const fixed = renderer.fixAssetUrls(content, '../');

            expect(fixed).toBe('<a href="../content/resources/document.pdf">Download</a>');
        });

        it('should handle single quotes in resources/ URLs', () => {
            const content = "<img src='resources/photo.jpg'>";
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe("<img src='content/resources/photo.jpg'>");
        });

        it('should handle multiple resources/ URLs in content', () => {
            const content = '<img src="resources/image1.png"><img src="resources/image2.jpg">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="content/resources/image1.png"><img src="content/resources/image2.jpg">');
        });

        // Preview mode tests
        it('should preserve asset:// URLs in preview mode', () => {
            const content = '<img src="asset://uuid-123/image.png">';
            const fixed = renderer.fixAssetUrls(content, '', true); // isPreviewMode = true

            expect(fixed).toBe('<img src="asset://uuid-123/image.png">');
        });

        it('should preserve {{context_path}} in preview mode', () => {
            const content = '<img src="{{context_path}}/images/photo.jpg">';
            const fixed = renderer.fixAssetUrls(content, '', true); // isPreviewMode = true

            expect(fixed).toBe('<img src="{{context_path}}/images/photo.jpg">');
        });

        it('should still transform files/tmp/ paths in preview mode', () => {
            // files/tmp/ are server-side temp paths that don't work in preview either
            const content = '<img src="files/tmp/session123/uuid/image.jpg">';
            const fixed = renderer.fixAssetUrls(content, '', true);

            // These are still transformed because they're server-side paths, not asset references
            expect(fixed).toContain('content/resources/');
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(renderer.escapeHtml('<script>')).toBe('&lt;script&gt;');
            expect(renderer.escapeHtml('a & b')).toBe('a &amp; b');
            expect(renderer.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
            expect(renderer.escapeHtml("it's")).toBe('it&#039;s');
        });

        it('should handle empty string', () => {
            expect(renderer.escapeHtml('')).toBe('');
        });
    });

    describe('escapeAttr', () => {
        it('should escape attribute values', () => {
            expect(renderer.escapeAttr('<tag>')).toBe('&lt;tag&gt;');
            expect(renderer.escapeAttr('"value"')).toBe('&quot;value&quot;');
        });

        it('should handle empty string', () => {
            expect(renderer.escapeAttr('')).toBe('');
        });
    });

    describe('getCssLinks', () => {
        it('should return CSS link tags for iDevice types', () => {
            const links = renderer.getCssLinks(['crossword', 'puzzle'], '');

            // Each iDevice gets at least its main CSS file
            expect(links.length).toBeGreaterThanOrEqual(2);
            expect(links.some(l => l.includes('crossword/crossword.css'))).toBe(true);
            expect(links.some(l => l.includes('puzzle/puzzle.css'))).toBe(true);
        });

        it('should apply basePath', () => {
            const links = renderer.getCssLinks(['text'], '../');

            expect(links[0]).toBe('<link rel="stylesheet" href="../idevices/text/text.css">');
        });

        it('should deduplicate types', () => {
            const links = renderer.getCssLinks(['crossword', 'crossword', 'Crossword'], '');

            // Should only have one entry for crossword (deduplication by type)
            expect(links.filter(l => l.includes('crossword/crossword.css')).length).toBe(1);
        });

        it('should normalize iDevice names', () => {
            const links = renderer.getCssLinks(['FreeTextIdevice'], '');

            // FreeTextIdevice normalizes to 'text' via config cssClass
            expect(links[0]).toContain('text');
        });

        it('should include CSS dependencies for image-gallery', () => {
            const links = renderer.getCssLinks(['image-gallery'], '');

            // image-gallery has simple-lightbox.min.css as a dependency
            expect(links.some(l => l.includes('image-gallery/image-gallery.css'))).toBe(true);
            expect(links.some(l => l.includes('image-gallery/simple-lightbox.min.css'))).toBe(true);
        });
    });

    describe('getJsScripts', () => {
        it('should return script tags for iDevice types', () => {
            const scripts = renderer.getJsScripts(['crossword', 'puzzle'], '');

            expect(scripts).toHaveLength(2);
            expect(scripts[0]).toBe('<script src="idevices/crossword/crossword.js"></script>');
            expect(scripts[1]).toBe('<script src="idevices/puzzle/puzzle.js"></script>');
        });

        it('should apply basePath', () => {
            const scripts = renderer.getJsScripts(['text'], '../');

            expect(scripts[0]).toBe('<script src="../idevices/text/text.js"></script>');
        });
    });

    describe('getCssLinkInfo', () => {
        it('should return link info objects', () => {
            const links = renderer.getCssLinkInfo(['crossword'], '');

            expect(links).toHaveLength(1);
            expect(links[0].href).toBe('idevices/crossword/crossword.css');
            expect(links[0].tag).toBe('<link rel="stylesheet" href="idevices/crossword/crossword.css">');
        });
    });

    describe('getJsScriptInfo', () => {
        it('should return script info objects', () => {
            const scripts = renderer.getJsScriptInfo(['crossword'], '');

            expect(scripts).toHaveLength(1);
            expect(scripts[0].src).toBe('idevices/crossword/crossword.js');
            expect(scripts[0].tag).toBe('<script src="idevices/crossword/crossword.js"></script>');
        });
    });

    describe('unescapeHtml', () => {
        it('should unescape HTML entities', () => {
            expect(renderer.unescapeHtml('&lt;script&gt;')).toBe('<script>');
            expect(renderer.unescapeHtml('&amp;')).toBe('&');
            expect(renderer.unescapeHtml('&quot;')).toBe('"');
            expect(renderer.unescapeHtml('&#039;')).toBe("'");
            expect(renderer.unescapeHtml('&#39;')).toBe("'");
        });

        it('should handle multiple entities in one string', () => {
            expect(renderer.unescapeHtml('&lt;div class=&quot;test&quot;&gt;')).toBe('<div class="test">');
        });

        it('should handle empty string', () => {
            expect(renderer.unescapeHtml('')).toBe('');
        });

        it('should handle null/undefined safely', () => {
            expect(renderer.unescapeHtml(null as unknown as string)).toBe('');
            expect(renderer.unescapeHtml(undefined as unknown as string)).toBe('');
        });

        it('should preserve unknown entities', () => {
            expect(renderer.unescapeHtml('&nbsp;')).toBe('&nbsp;');
            expect(renderer.unescapeHtml('&copy;')).toBe('&copy;');
        });

        it('should handle mixed content', () => {
            expect(renderer.unescapeHtml('Hello &lt;world&gt; &amp; friends')).toBe('Hello <world> & friends');
        });
    });

    describe('escapePreCodeContent', () => {
        it('should escape script tags inside pre>code blocks', () => {
            const input = '<pre><code><script src="test.js"></script></code></pre>';
            const expected = '<pre><code>&lt;script src=&quot;test.js&quot;&gt;&lt;/script&gt;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should NOT escape content outside pre>code blocks', () => {
            const input = '<p>Hello <strong>world</strong></p><pre><code><div>test</div></code></pre>';
            const expected = '<p>Hello <strong>world</strong></p><pre><code>&lt;div&gt;test&lt;/div&gt;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should NOT escape inline code tags (without pre)', () => {
            const input = '<p>Use <code><script></code> tag</p>';
            expect(renderer.escapePreCodeContent(input)).toBe(input);
        });

        it('should handle multiple pre>code blocks', () => {
            const input = '<pre><code><a></code></pre><p>text</p><pre><code><b></code></pre>';
            const expected = '<pre><code>&lt;a&gt;</code></pre><p>text</p><pre><code>&lt;b&gt;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should handle attributes on pre and code tags', () => {
            const input = '<pre class="highlighted"><code class="lang-js"><script></script></code></pre>';
            const expected =
                '<pre class="highlighted"><code class="lang-js">&lt;script&gt;&lt;/script&gt;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should handle whitespace between tags', () => {
            const input = '<pre>\n  <code>\n    <div>\n  </code>\n</pre>';
            const expected = '<pre>\n  <code>\n    &lt;div&gt;\n  </code>\n</pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should handle empty pre>code blocks', () => {
            const input = '<pre><code></code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(input);
        });

        it('should handle pre>code blocks with only whitespace', () => {
            const input = '<pre><code>   </code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(input);
        });

        it('should not double-escape already escaped content', () => {
            const input = '<pre><code>&lt;script&gt;</code></pre>';
            const expected = '<pre><code>&lt;script&gt;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should handle ampersands correctly', () => {
            const input = '<pre><code>a & b && c</code></pre>';
            const expected = '<pre><code>a &amp; b &amp;&amp; c</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should handle quotes correctly', () => {
            const input = '<pre><code>let x = "hello";</code></pre>';
            const expected = '<pre><code>let x = &quot;hello&quot;;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should handle tikzjax example from bug report', () => {
            const input = '<pre><code>\n<script src="https://tikzjax.com/v1/tikzjax.js"></script>\n</code></pre>';
            const expected =
                '<pre><code>\n&lt;script src=&quot;https://tikzjax.com/v1/tikzjax.js&quot;&gt;&lt;/script&gt;\n</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should handle empty content', () => {
            expect(renderer.escapePreCodeContent('')).toBe('');
        });

        it('should handle null/undefined safely', () => {
            expect(renderer.escapePreCodeContent(null as unknown as string)).toBe('');
            expect(renderer.escapePreCodeContent(undefined as unknown as string)).toBe('');
        });

        it('should handle content with no pre>code blocks', () => {
            const input = '<p>Just some <em>normal</em> HTML</p>';
            expect(renderer.escapePreCodeContent(input)).toBe(input);
        });

        it('should handle complex nested HTML in code blocks', () => {
            const input = '<pre><code><div class="container"><p id="test">Hello</p></div></code></pre>';
            const expected =
                '<pre><code>&lt;div class=&quot;container&quot;&gt;&lt;p id=&quot;test&quot;&gt;Hello&lt;/p&gt;&lt;/div&gt;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });

        it('should preserve content between multiple code blocks', () => {
            const input = '<pre><code><a></code></pre><script>alert("real")</script><pre><code><b></code></pre>';
            const expected =
                '<pre><code>&lt;a&gt;</code></pre><script>alert("real")</script><pre><code>&lt;b&gt;</code></pre>';
            expect(renderer.escapePreCodeContent(input)).toBe(expected);
        });
    });

    describe('renderBlock with icon', () => {
        it('should render block header with icon when iconName is provided', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test Block',
                order: 0,
                components: [],
                iconName: 'lightbulb.png', // iconName includes extension
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('box-icon');
            expect(html).toContain('theme/icons/lightbulb.png');
        });

        it('should use themeIconBasePath when provided for icon (preview mode)', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Preview Block',
                order: 0,
                components: [],
                iconName: 'check.svg', // iconName includes extension
            };

            const html = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
                themeIconBasePath: '/preview/icons/',
            });

            expect(html).toContain('/preview/icons/check.svg');
            expect(html).not.toContain('theme/icons/');
        });

        it('should add no-icon class when iconName is empty', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'No Icon Block',
                order: 0,
                components: [],
                iconName: '', // iconName is on block, not properties
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('no-icon');
            expect(html).not.toContain('box-icon');
        });

        it('should render toggle button when allowToggle is true', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Toggle Block',
                order: 0,
                components: [],
                properties: { allowToggle: true },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('box-toggle');
            expect(html).toContain('box-toggle-on');
        });

        it('should render toggle button with off state when minimized', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Minimized Toggle Block',
                order: 0,
                components: [],
                properties: { allowToggle: true, minimized: true },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('box-toggle-off');
        });

        it('should render toggle button when allowToggle is string "true"', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Toggle String Block',
                order: 0,
                components: [],
                properties: { allowToggle: 'true' as unknown as boolean },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('box-toggle');
        });

        it('should render toggle button when allowToggle is undefined (default behavior)', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Default Toggle Block',
                order: 0,
                components: [],
                properties: {}, // allowToggle is undefined - should default to true
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('box-toggle');
            expect(html).toContain('box-toggle-on');
        });

        it('should NOT render toggle button when allowToggle is false', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'No Toggle Block',
                order: 0,
                components: [],
                properties: { allowToggle: false },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).not.toContain('box-toggle');
        });

        it('should NOT render toggle button when allowToggle is string "false"', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'No Toggle String Block',
                order: 0,
                components: [],
                properties: { allowToggle: 'false' as unknown as boolean },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            expect(html).not.toContain('box-toggle');
        });

        it('should render icon and toggle button even when block has no title', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: '', // No title
                order: 0,
                components: [],
                iconName: 'check.png', // iconName includes extension
                properties: { allowToggle: 'true' as unknown as boolean },
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            // Should have icon even without title
            expect(html).toContain('box-icon');
            expect(html).toContain('check.png');
            // Should have toggle button even without title
            expect(html).toContain('box-toggle');
            expect(html).toContain('box-toggle-on');
            // Should NOT have title h1 since name is empty
            expect(html).not.toContain('box-title');
            // Should have no-header class
            expect(html).toContain('no-header');
        });

        it('should render toggle button even when block has no title and no icon', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: '', // No title
                order: 0,
                components: [],
                iconName: '', // No icon
                properties: {}, // allowToggle defaults to true
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });

            // Should have toggle button even without title or icon
            expect(html).toContain('box-toggle');
            expect(html).toContain('box-toggle-on');
            // Should have no-icon class
            expect(html).toContain('no-icon');
            // Should have no-header class
            expect(html).toContain('no-header');
        });

        it('should render toggle button with static English text (i18n applied at runtime)', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test Block',
                order: 0,
                components: [],
                properties: {},
            };

            const html = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
            });

            // Toggle text is always English in HTML - translated at runtime by exe_export.js
            expect(html).toContain('title="Toggle content"');
            expect(html).toContain('<span>Toggle content</span>');
        });

        it('should resolve icon baseName to filename with extension using setThemeIconFiles', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test Block',
                order: 0,
                components: [],
                iconName: 'activity', // baseName without extension
            };

            // Configure renderer with theme files that maps 'activity' → 'activity.svg'
            const themeFilesMap = new Map<string, unknown>();
            themeFilesMap.set('icons/activity.svg', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMap);

            const html = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
            });

            // Should use resolved name with extension
            expect(html).toContain('theme/icons/activity.svg');
            // Should not have just the baseName without extension
            expect(html).not.toMatch(/theme\/icons\/activity["']/);
        });

        it('should fall back to iconName when theme does not contain the icon', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test Block',
                order: 0,
                components: [],
                iconName: 'unknown-icon', // Icon not in theme
            };

            // Configure renderer with theme files without 'unknown-icon'
            const themeFilesMap = new Map<string, unknown>();
            themeFilesMap.set('icons/activity.svg', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMap);

            const html = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
            });

            // Should use iconName as-is since it's not in the theme
            expect(html).toContain('theme/icons/unknown-icon');
        });

        it('should use iconName as-is when setThemeIconFiles is not called', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test Block',
                order: 0,
                components: [],
                iconName: 'share', // baseName without extension
            };

            // Note: setThemeIconFiles not called, so internal map is empty

            const html = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
            });

            // Should fall back to .png extension when setThemeIconFiles is not called
            expect(html).toContain('theme/icons/share.png');
        });

        it('should resolve icon and apply themeIconBasePath together', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Preview Block',
                order: 0,
                components: [],
                iconName: 'check', // baseName without extension
            };

            // Configure renderer with theme files
            const themeFilesMap = new Map<string, unknown>();
            themeFilesMap.set('icons/check.png', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMap);

            const html = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
                themeIconBasePath: '/preview/icons/',
            });

            // Should use themeIconBasePath with resolved filename
            expect(html).toContain('/preview/icons/check.png');
            expect(html).not.toContain('theme/icons/');
        });

        it('should resolve icon with different file extensions based on theme', () => {
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test Block',
                order: 0,
                components: [],
                iconName: 'info', // Same baseName
            };

            // Theme A: SVG format
            const themeFilesMapA = new Map<string, unknown>();
            themeFilesMapA.set('icons/info.svg', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMapA);

            const htmlThemeA = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
            });
            expect(htmlThemeA).toContain('theme/icons/info.svg');

            // Theme B: PNG format (reconfigure renderer)
            const themeFilesMapB = new Map<string, unknown>();
            themeFilesMapB.set('icons/info.png', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMapB);

            const htmlThemeB = renderer.renderBlock(block, {
                basePath: '',
                includeDataAttributes: true,
            });
            expect(htmlThemeB).toContain('theme/icons/info.png');
        });
    });

    describe('fixAssetUrls edge cases', () => {
        it('should skip blob: URLs in {{context_path}}', () => {
            // Tests lines 257-260
            const content = '<img src="{{context_path}}/blob:http://localhost/abc">';
            const fixed = renderer.fixAssetUrls(content, '');

            // Should keep original since it contains blob:
            expect(fixed).toBe('<img src="{{context_path}}/blob:http://localhost/abc">');
        });

        it('should skip data: URLs in {{context_path}}', () => {
            const content = '<img src="{{context_path}}/data:image/png;base64,abc">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="{{context_path}}/data:image/png;base64,abc">');
        });

        it('should skip blob: URLs in asset:// protocol', () => {
            // Tests line 270
            const content = '<img src="asset://blob:http://localhost/xyz">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="asset://blob:http://localhost/xyz">');
        });

        it('should skip data: URLs in asset:// protocol', () => {
            const content = '<img src="asset://data:image/gif;base64,xyz">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="asset://data:image/gif;base64,xyz">');
        });

        it('should skip blob: URLs in files/tmp/ paths', () => {
            // Tests line 280 - blob: URLs in relativePath capture group
            // Pattern: files/tmp/[sessionPath]/[relativePath with blob:]
            const content = '<img src="files/tmp/session123/blob:something/image.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            // The regex captures relativePath, and if it starts with blob: it returns original
            expect(fixed).toContain('files/tmp/');
        });

        it('should skip data: URLs in files/tmp/ paths', () => {
            // Pattern: files/tmp/[sessionPath]/[relativePath with data:]
            const content = '<img src="files/tmp/session123/data:something/image.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toContain('files/tmp/');
        });

        it('should skip blob: URLs in /files/tmp/ quoted paths', () => {
            // Tests lines 286-289
            const content = '<img src="/files/tmp/session/blob:something">';
            const fixed = renderer.fixAssetUrls(content, '');

            // Should keep original when blob: is in path
            expect(fixed).toContain('/files/tmp/');
        });

        it('should skip data: URLs in /files/tmp/ quoted paths', () => {
            const content = '<img src="/files/tmp/session/data:something">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toContain('/files/tmp/');
        });

        it('should skip blob: URLs in resources/ paths', () => {
            // Tests line 298
            const content = '<img src="resources/blob:http://localhost/abc">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="resources/blob:http://localhost/abc">');
        });

        it('should skip data: URLs in resources/ paths', () => {
            const content = '<img src="resources/data:image/png;base64,abc">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="resources/data:image/png;base64,abc">');
        });

        it('should convert localhost URLs to relative paths', () => {
            // Tests lines 309-310
            const content = '<img src="http://localhost:8080/files/perm/idevices/text/icon.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="files/perm/idevices/text/icon.png">');
        });

        it('should convert localhost scripts URLs to relative paths', () => {
            const content = '<script src="http://localhost:3000/scripts/perm/common.js"></script>';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<script src="files/perm/common.js"></script>');
        });

        it('should apply basePath to localhost URL conversions', () => {
            const content = '<img src="http://localhost:5000/files/perm/image.png">';
            const fixed = renderer.fixAssetUrls(content, '../');

            expect(fixed).toBe('<img src="../files/perm/image.png">');
        });
    });

    describe('transformPropertiesUrls', () => {
        it('should transform URLs in nested object arrays (skipping UUID)', () => {
            // New format: asset://uuid/path → content/resources/path (UUID skipped)
            const props = {
                items: [
                    { image: 'asset://uuid/images/photo.png', text: 'Item 1' },
                    { image: 'asset://uuid/photos/image.jpg', text: 'Item 2' },
                ],
            };

            // Access private method via any
            const transformed = (renderer as any).transformPropertiesUrls(props, '', false);

            expect(transformed.items[0].image).toBe('content/resources/images/photo.png');
            expect(transformed.items[1].image).toBe('content/resources/photos/image.jpg');
        });

        it('should handle arrays with mixed types (skipping UUID)', () => {
            const props = {
                data: ['asset://uuid/docs/file.png', 123, { url: 'asset://uuid/images/nested.jpg' }, null],
            };

            const transformed = (renderer as any).transformPropertiesUrls(props, '../', false);

            expect(transformed.data[0]).toBe('../content/resources/docs/file.png');
            expect(transformed.data[1]).toBe(123);
            expect(transformed.data[2].url).toBe('../content/resources/images/nested.jpg');
            expect(transformed.data[3]).toBeNull();
        });

        it('should handle deeply nested objects (skipping UUID)', () => {
            const props = {
                level1: {
                    level2: {
                        // asset://uuid/path → content/resources/path
                        image: 'asset://deep/folders/nested.png',
                    },
                },
            };

            const transformed = (renderer as any).transformPropertiesUrls(props, '', false);

            expect(transformed.level1.level2.image).toBe('content/resources/folders/nested.png');
        });

        it('should preserve non-URL values', () => {
            const props = {
                count: 42,
                active: true,
                name: 'Test',
                empty: null,
            };

            const transformed = (renderer as any).transformPropertiesUrls(props, '', false);

            expect(transformed.count).toBe(42);
            expect(transformed.active).toBe(true);
            expect(transformed.name).toBe('Test');
            expect(transformed.empty).toBeNull();
        });
    });

    describe('setThemeIconFiles', () => {
        it('should build icon resolution map from theme files', () => {
            const themeFilesMap = new Map<string, unknown>();
            themeFilesMap.set('icons/activity.svg', new Uint8Array(0));
            themeFilesMap.set('icons/check.png', new Uint8Array(0));
            themeFilesMap.set('icons/info.gif', new Uint8Array(0));
            themeFilesMap.set('style.css', 'css content'); // Non-icon file

            renderer.setThemeIconFiles(themeFilesMap);

            // Test that icons are resolved correctly
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test',
                order: 0,
                components: [],
                iconName: 'activity',
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });
            expect(html).toContain('theme/icons/activity.svg');
        });

        it('should handle null theme files map', () => {
            renderer.setThemeIconFiles(null);

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test',
                order: 0,
                components: [],
                iconName: 'activity',
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });
            // Should use iconName as-is since no resolution map
            expect(html).toContain('theme/icons/activity');
        });

        it('should clear previous icon resolution map when called again', () => {
            // First call with activity.svg
            const themeFilesMap1 = new Map<string, unknown>();
            themeFilesMap1.set('icons/activity.svg', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMap1);

            // Second call with activity.png (different extension)
            const themeFilesMap2 = new Map<string, unknown>();
            themeFilesMap2.set('icons/activity.png', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMap2);

            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test',
                order: 0,
                components: [],
                iconName: 'activity',
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });
            // Should use the second configuration (png)
            expect(html).toContain('theme/icons/activity.png');
            expect(html).not.toContain('activity.svg');
        });

        it('should handle various image extensions', () => {
            const themeFilesMap = new Map<string, unknown>();
            themeFilesMap.set('icons/icon1.svg', new Uint8Array(0));
            themeFilesMap.set('icons/icon2.png', new Uint8Array(0));
            themeFilesMap.set('icons/icon3.gif', new Uint8Array(0));
            themeFilesMap.set('icons/icon4.jpg', new Uint8Array(0));
            themeFilesMap.set('icons/icon5.jpeg', new Uint8Array(0));
            themeFilesMap.set('icons/icon6.webp', new Uint8Array(0));
            renderer.setThemeIconFiles(themeFilesMap);

            // Test each extension
            const testIcon = (iconName: string, expectedExt: string) => {
                const block: ExportBlock = {
                    id: `block-${iconName}`,
                    name: 'Test',
                    order: 0,
                    components: [],
                    iconName,
                };
                const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });
                expect(html).toContain(`theme/icons/${iconName}.${expectedExt}`);
            };

            testIcon('icon1', 'svg');
            testIcon('icon2', 'png');
            testIcon('icon3', 'gif');
            testIcon('icon4', 'jpg');
            testIcon('icon5', 'jpeg');
            testIcon('icon6', 'webp');
        });

        it('should ignore non-icon files in theme', () => {
            const themeFilesMap = new Map<string, unknown>();
            themeFilesMap.set('icons/activity.svg', new Uint8Array(0));
            themeFilesMap.set('style.css', 'css content');
            themeFilesMap.set('script.js', 'js content');
            themeFilesMap.set('img/logo.png', new Uint8Array(0)); // Not in icons/ folder
            renderer.setThemeIconFiles(themeFilesMap);

            // 'logo' should not be resolved from img/ folder because only icons/ is scanned
            // But it should fall back to .png extension for backwards compatibility
            const block: ExportBlock = {
                id: 'block-1',
                name: 'Test',
                order: 0,
                components: [],
                iconName: 'logo',
            };

            const html = renderer.renderBlock(block, { basePath: '', includeDataAttributes: true });
            // Should use iconName with .png fallback (not from img/ folder)
            expect(html).toContain('theme/icons/logo.png');
        });
    });

    describe('render with pre>code escaping', () => {
        it('should escape pre>code content in rendered output', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Example:</p><pre><code><script src="test.js"></script></code></pre>',
                properties: {},
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('&lt;script src=&quot;test.js&quot;&gt;&lt;/script&gt;');
            expect(html).not.toContain('<script src="test.js">');
        });
    });
});

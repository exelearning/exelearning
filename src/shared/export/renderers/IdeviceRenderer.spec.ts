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
        it('should render a text iDevice with exe-text wrapper', () => {
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
            expect(html).toContain('<div class="exe-text">');
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
                properties: { visibility: 'false' },
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
                properties: { teacherOnly: 'true' },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('teacher-only');
        });

        it('should add custom cssClass from properties', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'text',
                order: 0,
                content: '<p>Custom styled</p>',
                properties: { cssClass: 'my-custom-class' },
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
    });

    describe('fixAssetUrls', () => {
        it('should convert asset:// URLs to content/resources/', () => {
            const content = '<img src="asset://uuid-123/image.png">';
            const fixed = renderer.fixAssetUrls(content, '');

            expect(fixed).toBe('<img src="content/resources/uuid-123/image.png">');
        });

        it('should apply basePath to asset URLs', () => {
            const content = '<img src="asset://uuid-123/image.png">';
            const fixed = renderer.fixAssetUrls(content, '../');

            expect(fixed).toBe('<img src="../content/resources/uuid-123/image.png">');
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

            expect(links).toHaveLength(2);
            expect(links[0]).toBe('<link rel="stylesheet" href="idevices/crossword/crossword.css">');
            expect(links[1]).toBe('<link rel="stylesheet" href="idevices/puzzle/puzzle.css">');
        });

        it('should apply basePath', () => {
            const links = renderer.getCssLinks(['text'], '../');

            expect(links[0]).toBe('<link rel="stylesheet" href="../idevices/text/text.css">');
        });

        it('should deduplicate types', () => {
            const links = renderer.getCssLinks(['crossword', 'crossword', 'Crossword'], '');

            // Should only have one entry for crossword
            expect(links.filter(l => l.includes('crossword')).length).toBe(1);
        });

        it('should normalize iDevice names', () => {
            const links = renderer.getCssLinks(['FreeTextIdevice'], '');

            // FreeTextIdevice normalizes to 'text' via config cssClass
            expect(links[0]).toContain('text');
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
});

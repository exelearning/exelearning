/**
 * Tests for IdeviceRenderer
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { IdeviceRenderer } from './IdeviceRenderer';
import type { ExportComponent, ExportBlock } from '../interfaces';

describe('IdeviceRenderer', () => {
    let renderer: IdeviceRenderer;

    beforeEach(() => {
        renderer = new IdeviceRenderer();
    });

    describe('render', () => {
        it('should render a text iDevice with exe-text wrapper', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'FreeTextIdevice',
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
            const component: ExportComponent = {
                id: 'quiz-1',
                type: 'QuizActivity',
                order: 0,
                content: '',
                properties: { question: 'What is 2+2?', answers: ['3', '4', '5'] },
            };

            const html = renderer.render(component, { basePath: '', includeDataAttributes: true });

            expect(html).toContain('data-idevice-path="idevices/QuizActivity/"');
            expect(html).toContain('data-idevice-type="QuizActivity"');
            expect(html).toContain('data-idevice-component-type="json"');
            expect(html).toContain('data-idevice-json-data="');
        });

        it('should not include data attributes when disabled', () => {
            const component: ExportComponent = {
                id: 'comp-1',
                type: 'FreeTextIdevice',
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

            expect(links[0]).toContain('freetext');
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

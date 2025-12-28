/**
 * Tests for MermaidPreRenderer
 *
 * Note: These tests run without Mermaid library, so they test the detection logic
 * but not the actual rendering (which requires Mermaid in a browser context).
 */
import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { Window } from 'happy-dom';

// Setup DOM environment before importing MermaidPreRenderer
const window = new Window();
globalThis.DOMParser = window.DOMParser;
globalThis.Node = window.Node;
globalThis.document = window.document;

// Import the module (it will attach to globalThis in Node/Bun context)
import './MermaidPreRenderer.js';

describe('MermaidPreRenderer', () => {
    let MermaidPreRenderer;

    beforeEach(() => {
        // Get the global instance
        MermaidPreRenderer = globalThis.MermaidPreRenderer || window?.MermaidPreRenderer;
    });

    describe('hasMermaid', () => {
        test('returns false for empty string', () => {
            expect(MermaidPreRenderer.hasMermaid('')).toBe(false);
        });

        test('returns false for null/undefined', () => {
            expect(MermaidPreRenderer.hasMermaid(null)).toBe(false);
            expect(MermaidPreRenderer.hasMermaid(undefined)).toBe(false);
        });

        test('returns false for HTML without Mermaid', () => {
            const html = '<div><p>Hello world</p></div>';
            expect(MermaidPreRenderer.hasMermaid(html)).toBe(false);
        });

        test('returns true for HTML with pre.mermaid', () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            expect(MermaidPreRenderer.hasMermaid(html)).toBe(true);
        });

        test('returns true for pre.mermaid with other classes', () => {
            const html = '<pre class="mermaid other-class">graph TD; A-->B</pre>';
            expect(MermaidPreRenderer.hasMermaid(html)).toBe(true);
        });

        test('returns false for regular pre tag', () => {
            const html = '<pre>Just some code</pre>';
            expect(MermaidPreRenderer.hasMermaid(html)).toBe(false);
        });

        test('returns false for div.mermaid (only pre.mermaid is valid)', () => {
            const html = '<div class="mermaid">graph TD; A-->B</div>';
            expect(MermaidPreRenderer.hasMermaid(html)).toBe(false);
        });
    });

    describe('_escapeHtmlAttribute', () => {
        test('escapes ampersand', () => {
            expect(MermaidPreRenderer._escapeHtmlAttribute('A & B')).toBe('A &amp; B');
        });

        test('escapes double quotes', () => {
            expect(MermaidPreRenderer._escapeHtmlAttribute('say "hello"')).toBe('say &quot;hello&quot;');
        });

        test('escapes less than', () => {
            expect(MermaidPreRenderer._escapeHtmlAttribute('a < b')).toBe('a &lt; b');
        });

        test('escapes greater than', () => {
            expect(MermaidPreRenderer._escapeHtmlAttribute('a > b')).toBe('a &gt; b');
        });

        test('handles complex mermaid code', () => {
            const code = 'graph TD; A["Start"] --> B{"Decision"}';
            const escaped = MermaidPreRenderer._escapeHtmlAttribute(code);
            expect(escaped).toBe('graph TD; A[&quot;Start&quot;] --&gt; B{&quot;Decision&quot;}');
        });
    });

    describe('getOriginalCode', () => {
        test('returns null for null element', () => {
            expect(MermaidPreRenderer.getOriginalCode(null)).toBe(null);
        });

        test('returns null for element without exe-mermaid-rendered class', () => {
            const div = document.createElement('div');
            div.className = 'other-class';
            expect(MermaidPreRenderer.getOriginalCode(div)).toBe(null);
        });

        test('returns data-mermaid attribute value', () => {
            const div = document.createElement('div');
            div.className = 'exe-mermaid-rendered';
            div.setAttribute('data-mermaid', 'graph TD; A-->B');
            expect(MermaidPreRenderer.getOriginalCode(div)).toBe('graph TD; A-->B');
        });

        test('returns null when data-mermaid is missing', () => {
            const div = document.createElement('div');
            div.className = 'exe-mermaid-rendered';
            expect(MermaidPreRenderer.getOriginalCode(div)).toBe(null);
        });
    });

    describe('preRender without Mermaid', () => {
        test('returns hasMermaid: false for non-Mermaid content', async () => {
            const html = '<p>Hello world</p>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.hasMermaid).toBe(false);
            expect(result.mermaidRendered).toBe(false);
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        test('returns hasMermaid: true but mermaidRendered: false when Mermaid not available', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.hasMermaid).toBe(true);
            expect(result.mermaidRendered).toBe(false);
            expect(result.count).toBe(0);
            // Original HTML should be preserved when Mermaid is not available
            expect(result.html).toBe(html);
        });

        test('handles empty string', async () => {
            const result = await MermaidPreRenderer.preRender('');

            expect(result.hasMermaid).toBe(false);
            expect(result.html).toBe('');
        });

        test('handles null gracefully', async () => {
            const result = await MermaidPreRenderer.preRender(null);

            expect(result.hasMermaid).toBe(false);
            expect(result.html).toBe(null);
        });
    });

    describe('preRender with mock Mermaid', () => {
        let originalMermaid;

        beforeEach(() => {
            // Save original mermaid if exists
            originalMermaid = globalThis.mermaid;

            // Create mock Mermaid
            globalThis.mermaid = {
                initialize: vi.fn(),
                render: vi.fn(async (id, code) => ({
                    svg: `<svg data-mermaid-id="${id}"><g>${code}</g></svg>`,
                })),
            };
        });

        afterEach(() => {
            // Restore original mermaid
            if (originalMermaid !== undefined) {
                globalThis.mermaid = originalMermaid;
            } else {
                delete globalThis.mermaid;
            }
        });

        test('renders Mermaid diagram when library is available', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.hasMermaid).toBe(true);
            expect(result.mermaidRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toContain('exe-mermaid-rendered');
            expect(result.html).toContain('data-mermaid');
            expect(result.html).toContain('<svg');
        });

        test('renders multiple diagrams', async () => {
            const html = `
                <pre class="mermaid">graph TD; A-->B</pre>
                <pre class="mermaid">graph LR; C-->D</pre>
            `;
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.count).toBe(2);
            expect(result.html.match(/exe-mermaid-rendered/g).length).toBe(2);
        });

        test('preserves original code in data-mermaid attribute', async () => {
            // Use simpler diagram without HTML-like characters that happy-dom may mangle
            const html = '<pre class="mermaid">graph TD; Start to End</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            // Check that data-mermaid contains the diagram code
            expect(result.html).toContain('data-mermaid=');
            expect(result.html).toContain('graph TD');
            expect(result.html).toContain('Start to End');
        });

        test('replaces pre element with div wrapper', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.html).toContain('<div class="exe-mermaid-rendered"');
            expect(result.html).not.toContain('<pre class="mermaid">');
        });

        test('handles Mermaid render errors gracefully', async () => {
            // Make mermaid.render throw an error
            globalThis.mermaid.render = vi.fn(async () => {
                throw new Error('Mermaid syntax error');
            });

            const html = '<pre class="mermaid">invalid mermaid</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.hasMermaid).toBe(true);
            expect(result.mermaidRendered).toBe(false);
            expect(result.count).toBe(0);
            // Original should be preserved on error
            expect(result.html).toContain('<pre class="mermaid">');
        });

        test('initializes Mermaid with correct options', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            await MermaidPreRenderer.preRender(html);

            expect(globalThis.mermaid.initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    startOnLoad: false,
                    suppressErrorRendering: true,
                    logLevel: 'fatal',
                })
            );
        });

        test('skips elements with data-processed attribute', async () => {
            const html = '<pre class="mermaid" data-processed="true">graph TD; A-->B</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.count).toBe(0);
            expect(result.mermaidRendered).toBe(false);
        });

        test('handles empty pre.mermaid element', async () => {
            const html = '<pre class="mermaid">   </pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.count).toBe(0);
        });

        test('escapes special characters in data-mermaid', async () => {
            const html = '<pre class="mermaid">graph TD; A["Label"] --> B</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            // Quotes should be escaped
            expect(result.html).toContain('data-mermaid=');
            expect(result.html).toContain('&quot;');
        });

        test('preserves surrounding content', async () => {
            const html = '<div class="container"><p>Before</p><pre class="mermaid">graph TD; A-->B</pre><p>After</p></div>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.html).toContain('<p>Before</p>');
            expect(result.html).toContain('<p>After</p>');
            expect(result.html).toContain('exe-mermaid-rendered');
        });

        test('handles various diagram types', async () => {
            const diagrams = [
                'graph TD; A-->B',
                'sequenceDiagram\n    Alice->>Bob: Hello',
                'gantt\n    title A Gantt Diagram\n    section Section\n    A task :a1, 2024-01-01, 30d',
                'classDiagram\n    Class01 <|-- Class02',
                'pie title Pets\n    "Dogs" : 386\n    "Cats" : 85',
            ];

            for (const diagram of diagrams) {
                const html = `<pre class="mermaid">${diagram}</pre>`;
                const result = await MermaidPreRenderer.preRender(html);

                expect(result.mermaidRendered).toBe(true);
                expect(result.count).toBe(1);
            }
        });

        test('preserves HTML structure in iDevice', async () => {
            const html = `
                <article class="idevice_node">
                    <div class="idevice_body">
                        <pre class="mermaid">graph TD; A-->B</pre>
                    </div>
                </article>
            `;
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.html).toContain('idevice_node');
            expect(result.html).toContain('idevice_body');
            expect(result.html).toContain('exe-mermaid-rendered');
        });
    });

    describe('preRender with full document', () => {
        let originalMermaid;

        beforeEach(() => {
            originalMermaid = globalThis.mermaid;
            globalThis.mermaid = {
                initialize: vi.fn(),
                render: vi.fn(async () => ({
                    svg: '<svg><g>test</g></svg>',
                })),
            };
        });

        afterEach(() => {
            if (originalMermaid !== undefined) {
                globalThis.mermaid = originalMermaid;
            } else {
                delete globalThis.mermaid;
            }
        });

        test('handles full HTML document with doctype', async () => {
            const html = '<!DOCTYPE html><html><head></head><body><pre class="mermaid">graph TD; A-->B</pre></body></html>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.mermaidRendered).toBe(true);
            expect(result.html).toContain('<!DOCTYPE html>');
            expect(result.html).toContain('<html');
            expect(result.html).toContain('exe-mermaid-rendered');
        });

        test('handles full HTML document without doctype but with <html> tag', async () => {
            const html = '<html><body><pre class="mermaid">graph TD; A-->B</pre></body></html>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.mermaidRendered).toBe(true);
            expect(result.html).toContain('<html');
            expect(result.html).not.toContain('<!DOCTYPE');
        });

        test('handles HTML fragment', async () => {
            const html = '<div><pre class="mermaid">graph TD; A-->B</pre></div>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.mermaidRendered).toBe(true);
            // Should not wrap in html/body for fragments
            expect(result.html).not.toMatch(/^<!DOCTYPE/);
            expect(result.html).toContain('<div>');
        });
    });

    describe('_initMermaid', () => {
        let originalMermaid;

        afterEach(() => {
            if (originalMermaid !== undefined) {
                globalThis.mermaid = originalMermaid;
            } else {
                delete globalThis.mermaid;
            }
        });

        test('throws when Mermaid not available', async () => {
            originalMermaid = globalThis.mermaid;
            delete globalThis.mermaid;

            await expect(MermaidPreRenderer._initMermaid())
                .rejects.toThrow('Mermaid library not loaded');
        });

        test('calls mermaid.initialize with correct options', async () => {
            originalMermaid = globalThis.mermaid;
            globalThis.mermaid = {
                initialize: vi.fn(),
            };

            await MermaidPreRenderer._initMermaid();

            expect(globalThis.mermaid.initialize).toHaveBeenCalledWith(
                expect.objectContaining({
                    startOnLoad: false,
                    suppressErrorRendering: true,
                    logLevel: 'fatal',
                    securityLevel: 'loose',
                    theme: 'default',
                })
            );
        });
    });

    describe('_renderMermaidToSvg', () => {
        let originalMermaid;

        afterEach(() => {
            if (originalMermaid !== undefined) {
                globalThis.mermaid = originalMermaid;
            } else {
                delete globalThis.mermaid;
            }
        });

        test('throws when Mermaid not available', async () => {
            originalMermaid = globalThis.mermaid;
            delete globalThis.mermaid;

            await expect(MermaidPreRenderer._renderMermaidToSvg('graph TD; A-->B'))
                .rejects.toThrow('Mermaid library not loaded');
        });

        test('returns SVG from mermaid.render', async () => {
            originalMermaid = globalThis.mermaid;
            globalThis.mermaid = {
                render: vi.fn(async () => ({
                    svg: '<svg><g>rendered</g></svg>',
                })),
            };

            const svg = await MermaidPreRenderer._renderMermaidToSvg('graph TD; A-->B');

            expect(svg).toContain('<svg>');
            expect(svg).toContain('rendered');
        });

        test('generates unique IDs for each render', async () => {
            originalMermaid = globalThis.mermaid;
            const renderCalls = [];
            globalThis.mermaid = {
                render: vi.fn(async (id, code) => {
                    renderCalls.push(id);
                    return { svg: `<svg id="${id}"></svg>` };
                }),
            };

            await MermaidPreRenderer._renderMermaidToSvg('graph TD; A');
            await MermaidPreRenderer._renderMermaidToSvg('graph TD; B');

            expect(renderCalls[0]).not.toBe(renderCalls[1]);
        });

        test('propagates errors from mermaid.render', async () => {
            originalMermaid = globalThis.mermaid;
            globalThis.mermaid = {
                render: vi.fn(async () => {
                    throw new Error('Syntax error');
                }),
            };

            await expect(MermaidPreRenderer._renderMermaidToSvg('invalid'))
                .rejects.toThrow('Syntax error');
        });
    });

    describe('mixed content handling', () => {
        let originalMermaid;

        beforeEach(() => {
            originalMermaid = globalThis.mermaid;
            globalThis.mermaid = {
                initialize: vi.fn(),
                render: vi.fn(async () => ({
                    svg: '<svg><g>test</g></svg>',
                })),
            };
        });

        afterEach(() => {
            if (originalMermaid !== undefined) {
                globalThis.mermaid = originalMermaid;
            } else {
                delete globalThis.mermaid;
            }
        });

        test('does not affect LaTeX content', async () => {
            const html = '<p>\\(x^2\\)</p><pre class="mermaid">graph TD; A-->B</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.html).toContain('\\(x^2\\)');
            expect(result.html).toContain('exe-mermaid-rendered');
        });

        test('does not affect code blocks', async () => {
            const html = '<pre><code>function test() {}</code></pre><pre class="mermaid">graph TD; A-->B</pre>';
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.html).toContain('<code>function test() {}</code>');
            expect(result.html).toContain('exe-mermaid-rendered');
        });

        test('handles multiple pre tags - only processes mermaid ones', async () => {
            const html = `
                <pre>Regular pre</pre>
                <pre class="mermaid">graph TD; A-->B</pre>
                <pre class="code">Code pre</pre>
            `;
            const result = await MermaidPreRenderer.preRender(html);

            expect(result.count).toBe(1);
            expect(result.html).toContain('<pre>Regular pre</pre>');
            expect(result.html).toContain('<pre class="code">Code pre</pre>');
            expect(result.html).toContain('exe-mermaid-rendered');
        });
    });
});

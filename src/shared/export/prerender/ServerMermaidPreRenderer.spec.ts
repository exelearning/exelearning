/**
 * ServerMermaidPreRenderer Unit Tests
 *
 * jsdom measures nothing, so the renderer supplies the SVG measuring Mermaid relies on. These tests
 * render real diagrams with it, as well as checking the detection logic and the fallback.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'path';
import { JSDOM } from 'jsdom';
import { ServerMermaidPreRenderer, estimateBBox } from './ServerMermaidPreRenderer';

describe('ServerMermaidPreRenderer', () => {
    let renderer: ServerMermaidPreRenderer;

    // initialize() imports jsdom and mermaid, which can take several seconds on
    // a cold or busy machine: pay for it once here rather than inside the first
    // preRender test's timeout.
    beforeAll(async () => {
        renderer = new ServerMermaidPreRenderer();
        await renderer.initialize();
    }, 60_000);

    afterAll(() => {
        // Clean up resources
        if (renderer) {
            renderer.destroy();
        }
    });

    describe('hasMermaid', () => {
        it('should detect <pre class="mermaid">', () => {
            expect(renderer.hasMermaid('<pre class="mermaid">graph TD; A-->B</pre>')).toBe(true);
        });

        it('should detect mermaid with other classes', () => {
            expect(renderer.hasMermaid('<pre class="code mermaid">graph TD; A-->B</pre>')).toBe(true);
        });

        it('should detect mermaid with attributes', () => {
            expect(renderer.hasMermaid('<pre id="diagram" class="mermaid">graph TD; A-->B</pre>')).toBe(true);
        });

        it('should return false for plain text', () => {
            expect(renderer.hasMermaid('Hello world')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(renderer.hasMermaid('')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(renderer.hasMermaid(null as unknown as string)).toBe(false);
            expect(renderer.hasMermaid(undefined as unknown as string)).toBe(false);
        });

        it('should return false for pre without mermaid class', () => {
            expect(renderer.hasMermaid('<pre class="code">some code</pre>')).toBe(false);
        });

        it('should return false for mermaid in text', () => {
            expect(renderer.hasMermaid('This is a mermaid diagram')).toBe(false);
        });
    });

    describe('preRender', () => {
        it('should detect mermaid in HTML and set hasMermaid flag', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            const result = await renderer.preRender(html);

            // hasMermaid should be true even if rendering fails
            expect(result.hasMermaid).toBe(true);
            // mermaidRendered may be true or false depending on SVG support
            // In jsdom, it will likely fail and return false
        });

        it('should return unchanged HTML if no mermaid diagrams', async () => {
            const html = '<p>Hello world</p>';
            const result = await renderer.preRender(html);

            expect(result.hasMermaid).toBe(false);
            expect(result.mermaidRendered).toBe(false);
            expect(result.count).toBe(0);
            expect(result.html).toBe(html);
        });

        it('should preserve original HTML when rendering fails', async () => {
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            const result = await renderer.preRender(html);

            // If rendering fails (due to jsdom limitations), HTML should be preserved
            if (!result.mermaidRendered) {
                expect(result.html).toBe(html);
            }
        });

        it('should handle already processed diagrams', async () => {
            const html = '<pre class="mermaid" data-processed="true">graph TD; A-->B</pre>';
            const result = await renderer.preRender(html);

            // Already processed diagrams should be skipped
            expect(result.mermaidRendered).toBe(false);
        });

        it('should detect mermaid in JSON data attributes', async () => {
            // Create HTML with mermaid in JSON data attribute
            const jsonData = {
                textContent: '<pre class="mermaid">graph TD; X-->Y</pre>',
            };
            const encodedJson = JSON.stringify(jsonData)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const html = `<div data-idevice-json-data="${encodedJson}">Content</div>`;
            const result = await renderer.preRender(html);

            expect(result.hasMermaid).toBe(true);
        });

        it('draws a flowchart, with its labels and a box that fits it', async () => {
            const result = await renderer.preRender('<pre class="mermaid">graph TD\n  A[Inicio] --> B[Fin]</pre>');

            expect(result.mermaidRendered).toBe(true);
            expect(result.count).toBe(1);
            expect(result.html).toMatch(/<div class="exe-mermaid-rendered"[^>]*><svg/);
            expect(result.html).not.toContain('<pre class="mermaid"');
            // As SVG text: an HTML label would sit in a box jsdom gives no size.
            expect(result.html).not.toContain('<foreignObject');
            expect(result.html).toContain('Inicio');
            expect(result.html).toContain('Fin');
            // Measured from the shapes drawn. Measured by the length of all its text, the diagram's
            // own stylesheet included, it came out tens of thousands of pixels wide.
            const [, , width, height] = (result.html.match(/viewBox="([^"]+)"/)?.[1] ?? '').split(' ').map(Number);
            for (const side of [width, height]) {
                expect(side).toBeGreaterThan(50);
                expect(side).toBeLessThan(500);
            }
        });

        it.each([
            ['HTML breaks', 'One<br/>Two<br/>Three<br/>Four<br/>Five<br/>Six'],
            ['Markdown lines', '`One\nTwo\nThree\nFour\nFive\nSix`'],
        ])('gives a multiline node enough height for %s', async (_kind, label) => {
            const result = await renderer.preRender(`<pre class="mermaid">graph TD\nA[Begin] --> B["${label}"]</pre>`);
            expect(result.mermaidRendered).toBe(true);
            const dom = new JSDOM(result.html);
            try {
                const node = dom.window.document.querySelectorAll('g.node')[1];
                expect(node.textContent).toBe('OneTwoThreeFourFiveSix');
                const rect = node.querySelector('rect.label-container')!;
                // Six 16px lines need more than the single-line node's 46px. Their short words
                // must not be laid out as one long line either.
                expect(Number(rect.getAttribute('height'))).toBeGreaterThan(100);
                expect(Number(rect.getAttribute('width'))).toBeLessThan(150);
            } finally {
                dom.window.close();
            }
        });

        it.each([
            ['directive', '%%{init: {"htmlLabels": true}}%%\n'],
            ['frontmatter', '---\nconfig:\n  htmlLabels: true\n---\n'],
            ['legacy option', '%%{init: {"flowchart": {"htmlLabels": true}}}%%\n'],
            ['protected settings', '%%{init: {"secure": [], "maxTextSize": 1, "htmlLabels": true}}%%\n'],
        ])('keeps SVG labels when a diagram requests HTML labels through %s', async (_kind, config) => {
            const result = await renderer.preRender(
                `<pre class="mermaid">${config}graph TD\nA[Start] --> B[End]</pre>`,
            );
            expect(result.mermaidRendered).toBe(true);
            expect(result.html).not.toContain('<foreignObject');
            const dom = new JSDOM(result.html);
            try {
                const labels = Array.from(
                    dom.window.document.querySelectorAll('g.node text'),
                    node => node.textContent,
                );
                expect(labels).toEqual(['Start', 'End']);
            } finally {
                dom.window.close();
            }
        });

        it('should handle multiple mermaid diagrams', async () => {
            const html = `
                <pre class="mermaid">graph TD; A-->B</pre>
                <pre class="mermaid">graph TD; C-->D</pre>
            `;
            const result = await renderer.preRender(html);

            expect(result.hasMermaid).toBe(true);
            // Count may be 0 if rendering fails, or 2 if it succeeds
            expect(result.count).toBeGreaterThanOrEqual(0);
        });
    });

    describe('destroy', () => {
        it('should clean up resources without error', () => {
            const localRenderer = new ServerMermaidPreRenderer();
            expect(() => localRenderer.destroy()).not.toThrow();
        });

        it('should allow multiple destroy calls', () => {
            const localRenderer = new ServerMermaidPreRenderer();
            expect(() => {
                localRenderer.destroy();
                localRenderer.destroy();
            }).not.toThrow();
        });
    });

    describe('estimateBBox', () => {
        /** An SVG element built from markup, in a document of its own. */
        const element = (markup: string, selector: string) =>
            new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`).window.document.querySelector(
                selector,
            ) as Element;

        it('measures text by its length, from its baseline', () => {
            expect(estimateBBox(element('<text x="10" y="20">Inicio</text>', 'text'))).toEqual({
                x: 10,
                y: 8,
                width: 48,
                height: 16,
            });
        });

        it('measures positioned rows in em units, keeping inline spans on the same line', () => {
            const box = estimateBBox(
                element(
                    '<text y="-10.1">' +
                        '<tspan x="0" y="-0.1em" dy="1.1em"><tspan>First</tspan><tspan> line</tspan></tspan>' +
                        '<tspan x="0" y="1em" dy="1.1em">Second line</tspan>' +
                        '<tspan x="0" y="2.1em" dy="1.1em">Third</tspan></text>',
                    'text',
                ),
            );
            expect(box?.x).toBe(0);
            expect(box?.y).toBeCloseTo(4);
            expect(box?.width).toBe(88);
            expect(box?.height).toBeCloseTo(51.2);
        });

        it('continues inline text and applies relative offsets and explicit line starts', () => {
            expect(
                estimateBBox(
                    element(
                        '<text x="10" y="20">A<tspan dx="2" dy="10">BC</tspan><tspan x="5" dy="10">D</tspan></text>',
                        'text',
                    ),
                ),
            ).toEqual({ x: 5, y: 8, width: 31, height: 36 });
        });

        it('ignores empty text and metadata inside text elements', () => {
            expect(estimateBBox(element('<text>   </text>', 'text'))).toBeNull();
            expect(
                estimateBBox(element('<text><title>A description</title><!-- comment --></text>', 'text')),
            ).toBeNull();
        });

        it('takes a shape from its own attributes', () => {
            expect(estimateBBox(element('<rect x="-30" y="-15" width="60" height="30"/>', 'rect'))).toEqual({
                x: -30,
                y: -15,
                width: 60,
                height: 30,
            });
            expect(estimateBBox(element('<path d="M10,20L30,60"/>', 'path'))).toEqual({
                x: 10,
                y: 20,
                width: 20,
                height: 40,
            });
        });

        it('unites what a group draws, each part where its translation puts it', () => {
            const group = element(
                '<g id="all"><style>.node { fill: red; } /* a long stylesheet draws nothing */</style>' +
                    '<g transform="translate(100, 50)"><rect x="-10" y="-5" width="20" height="10"/></g>' +
                    '<g transform="translate(0 0)"><circle cx="0" cy="0" r="5"/></g></g>',
                '#all',
            );

            expect(estimateBBox(group)).toEqual({ x: -5, y: -5, width: 115, height: 60 });
        });

        it('finds nothing in an element that draws nothing', () => {
            expect(estimateBBox(element('<defs><rect width="10" height="10"/></defs>', 'defs'))).toBeNull();
            expect(estimateBBox(element('<g id="empty"></g>', '#empty'))).toBeNull();
        });
    });

    describe('graceful fallback', () => {
        it('should handle initialization failure gracefully', async () => {
            // Force a new renderer to test initialization
            const newRenderer = new ServerMermaidPreRenderer();

            // Attempt to render - should not throw even if SVG rendering fails
            const html = '<pre class="mermaid">graph TD; A-->B</pre>';
            let error: Error | null = null;

            try {
                await newRenderer.preRender(html);
            } catch (e) {
                error = e as Error;
            }

            // Should not throw - graceful fallback
            expect(error).toBeNull();

            newRenderer.destroy();
        });
    });

    describe('module loading', () => {
        // In a fresh process: this file has already loaded jsdom, and only the
        // order of a first load reproduces the failure. The server imports the
        // pre-renderers before the worksheet code that imports the ESM parse5.
        it('loads before a module that imports the ESM parse5', () => {
            const result = Bun.spawnSync({
                cmd: [
                    process.execPath,
                    '-e',
                    "import './src/shared/export/prerender/ServerMermaidPreRenderer.ts';" +
                        "import './src/shared/export/worksheet/sanitizeHtml.ts';",
                ],
                cwd: path.resolve(import.meta.dir, '../../../..'),
                stderr: 'pipe',
            });

            expect(result.stderr.toString()).not.toContain('require() async module');
            expect(result.exitCode).toBe(0);
        }, 30_000);
    });
});

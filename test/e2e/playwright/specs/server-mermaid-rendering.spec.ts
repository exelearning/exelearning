import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const diagrams = [
    {
        name: 'HTML line breaks',
        code: 'graph TD\nA[Begin] --> B["One<br/>Two<br/>Three<br/>Four<br/>Five<br/>Six"]',
        labels: ['Begin', 'OneTwoThreeFourFiveSix'],
    },
    {
        name: 'Markdown line breaks',
        code: 'graph TD\nA[Begin] --> B["`One\nTwo\nThree\nFour\nFive\nSix`"]',
        labels: ['Begin', 'OneTwoThreeFourFiveSix'],
    },
    {
        name: 'HTML labels requested in a directive',
        code: '%%{init: {"htmlLabels": true}}%%\ngraph TD\nA[Start] --> B[End]',
        labels: ['Start', 'End'],
    },
    {
        name: 'HTML labels requested in frontmatter',
        code: '---\nconfig:\n  htmlLabels: true\n---\ngraph TD\nA[Start] --> B[End]',
        labels: ['Start', 'End'],
    },
];

test.describe('Server-rendered Mermaid labels (Pele)', () => {
    let rendered: string[];

    test.beforeAll(() => {
        // Use the same Bun renderer as CLI and server exports (Pele's npm package), in a Bun
        // process like they do. The browser then measures the saved SVG with real font metrics,
        // independently of the sizes Pele computed for the labels.
        rendered = JSON.parse(
            execFileSync(
                'bun',
                [
                    '-e',
                    `import { render } from 'pele';
                    import { MermaidPreRenderer } from './src/shared/export/prerender/MermaidPreRenderer.ts';
                    const renderer = new MermaidPreRenderer(render);
                    const html = [];
                    for (const code of JSON.parse(await Bun.stdin.text())) {
                        const result = await renderer.preRender('<pre class="mermaid">' + code + '</pre>');
                        if (!result.mermaidRendered) throw new Error('Server did not render the diagram');
                        html.push(result.html);
                    }
                    process.stdout.write(JSON.stringify(html));`,
                ],
                {
                    cwd: path.resolve(__dirname, '../../../..'),
                    input: JSON.stringify(diagrams.map(diagram => diagram.code)),
                    encoding: 'utf8',
                    timeout: 60_000,
                },
            ),
        );
    });

    for (const [index, diagram] of diagrams.entries()) {
        test(`keeps every label visible with ${diagram.name}`, async ({ page }) => {
            await page.setContent(rendered[index]);
            await page.evaluate(() => document.fonts.ready);
            // Labels must be SVG text, never HTML in a <foreignObject>, whatever the diagram asks.
            await expect(page.locator('svg foreignObject')).toHaveCount(0);
            await expect(page.locator('g.pele-node text')).toHaveText(diagram.labels);

            const geometry = await page.locator('svg').evaluate((svg: SVGSVGElement) => {
                const view = svg.viewBox.baseVal;
                const contents = svg.getBBox();
                return {
                    view: { x: view.x, y: view.y, right: view.x + view.width, bottom: view.y + view.height },
                    contents: {
                        x: contents.x,
                        y: contents.y,
                        right: contents.x + contents.width,
                        bottom: contents.y + contents.height,
                    },
                    nodes: Array.from(svg.querySelectorAll('g.pele-node'), node => {
                        const text = node.querySelector('text')!.getBoundingClientRect();
                        const box = node.querySelector(':scope > rect')!.getBoundingClientRect();
                        return {
                            text: { left: text.left, top: text.top, right: text.right, bottom: text.bottom },
                            box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
                        };
                    }),
                };
            });
            expect(geometry.contents.x).toBeGreaterThanOrEqual(geometry.view.x);
            expect(geometry.contents.y).toBeGreaterThanOrEqual(geometry.view.y);
            expect(geometry.contents.right).toBeLessThanOrEqual(geometry.view.right);
            expect(geometry.contents.bottom).toBeLessThanOrEqual(geometry.view.bottom);
            for (const { text, box } of geometry.nodes) {
                expect(text.left).toBeGreaterThanOrEqual(box.left);
                expect(text.top).toBeGreaterThanOrEqual(box.top);
                expect(text.right).toBeLessThanOrEqual(box.right);
                expect(text.bottom).toBeLessThanOrEqual(box.bottom);
            }
        });
    }
});

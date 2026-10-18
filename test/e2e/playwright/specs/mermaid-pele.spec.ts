import { test, expect } from '../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { waitForAppReady, gotoWorkarea } from '../helpers/workarea-helpers';

/**
 * Mermaid diagrams rendered with Pele in the browser.
 *
 * #2490: with Mermaid.js, Chrome and Edge cut long node labels at some display
 * scales (0.9, 0.984375 and 1.75 among them), and the cut was saved into previews
 * and exports. Pele wraps labels from its own text measurement and draws them as
 * SVG text, so each label must wrap and fit its box at every scale.
 */

const LONG_LABEL = 'El alumnado entrega el trabajo a través de la plataforma del centro';
const DIAGRAM_2490 = `flowchart TD\n  A[${LONG_LABEL}] --> B[Se corrige]`;

interface LabelBox {
    lines: string[];
    labelWidth: number;
    shapeWidth: number;
    labelHeight: number;
    shapeHeight: number;
}

/** Measures node A's label against its box inside the given container. */
async function measureLabel(page: Page, selector: string): Promise<LabelBox> {
    return page.evaluate(sel => {
        const node = document.querySelector(`${sel} .pele-node[data-id="A"]`) as SVGGElement;
        const text = node.querySelector('text') as SVGTextElement;
        const shape = node.querySelector('rect') as SVGRectElement;
        const label = text.getBBox();
        const box = shape.getBBox();
        return {
            lines: Array.from(text.querySelectorAll('tspan')).map(tspan => tspan.textContent || ''),
            labelWidth: label.width,
            shapeWidth: box.width,
            labelHeight: label.height,
            shapeHeight: box.height,
        };
    }, selector);
}

function expectLabelToFit(box: LabelBox): void {
    expect(box.lines.length).toBeGreaterThan(1);
    expect(box.lines.join(' ')).toBe(LONG_LABEL);
    expect(box.labelWidth).toBeLessThanOrEqual(box.shapeWidth);
    expect(box.labelHeight).toBeLessThanOrEqual(box.shapeHeight);
}

async function openWorkarea(page: Page, createProject: (page: Page, title?: string) => Promise<string>) {
    const projectUuid = await createProject(page, 'Mermaid Pele Test');
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);
}

for (const deviceScaleFactor of [0.9, 1, 1.75]) {
    test.describe(`Mermaid with Pele at device scale factor ${deviceScaleFactor}`, () => {
        test.use({ deviceScaleFactor });

        test('wraps long labels inside their box in exports and previews (#2490)', async ({
            authenticatedPage: page,
            createProject,
        }) => {
            await openWorkarea(page, createProject);

            // The hook that browser exports and previews use
            const result = await page.evaluate(async source => {
                const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const hooks = (window as any).SharedExporters.getMermaidPreRendererHooks();
                const rendered = await hooks.preRenderMermaid(`<pre class="mermaid">${escaped}</pre>`);
                const host = document.createElement('div');
                host.id = 'pele-export-test';
                host.style.width = '800px';
                host.innerHTML = rendered.html;
                document.body.appendChild(host);
                return { count: rendered.count, failures: rendered.failures };
            }, DIAGRAM_2490);

            expect(result).toEqual({ count: 1, failures: [] });
            expectLabelToFit(await measureLabel(page, '#pele-export-test .exe-mermaid-rendered'));
        });

        test('wraps long labels inside their box in the editor (#2490)', async ({
            authenticatedPage: page,
            createProject,
        }) => {
            await openWorkarea(page, createProject);

            await page.evaluate(source => {
                const host = document.createElement('div');
                host.id = 'pele-editor-test';
                const pre = document.createElement('pre');
                pre.className = 'mermaid';
                pre.textContent = source;
                host.appendChild(pre);
                document.body.appendChild(host);
                (window as any).$exe.mermaid.init();
            }, DIAGRAM_2490);

            await expect(page.locator('#pele-editor-test pre.mermaid[data-processed="true"] svg.pele')).toBeAttached();
            expectLabelToFit(await measureLabel(page, '#pele-editor-test'));
        });
    });
}

test.describe('Mermaid with Pele in the editor', () => {
    test('renders a diagram that is hidden when the page loads', async ({ authenticatedPage: page, createProject }) => {
        await openWorkarea(page, createProject);

        await page.evaluate(source => {
            const host = document.createElement('div');
            host.id = 'pele-hidden-test';
            host.style.display = 'none';
            host.innerHTML = `<pre class="mermaid">${source.replace(/>/g, '&gt;')}</pre>`;
            document.body.appendChild(host);
            (window as any).$exe.mermaid.init();
        }, DIAGRAM_2490);
        await expect(page.locator('#pele-hidden-test pre.mermaid[data-processed="true"] svg.pele')).toBeAttached();

        await page.evaluate(() => {
            (document.getElementById('pele-hidden-test') as HTMLElement).style.display = 'block';
        });
        const svg = page.locator('#pele-hidden-test svg.pele');
        const box = await svg.boundingBox();
        expect(box?.width).toBeGreaterThan(100);
        expect(box?.height).toBeGreaterThan(100);
        expectLabelToFit(await measureLabel(page, '#pele-hidden-test'));
    });

    test('shows why an invalid diagram was not drawn and keeps its source', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        await openWorkarea(page, createProject);

        await page.evaluate(() => {
            const host = document.createElement('div');
            host.id = 'pele-error-test';
            host.innerHTML = '<pre class="mermaid">flowchart LR\n  A --&gt;</pre>';
            document.body.appendChild(host);
            (window as any).$exe.mermaid.init();
        });

        const message = page.locator('#pele-error-test .exe-mermaid-error[role="alert"]');
        await expect(message).toContainText('Parse error on line 3');
        await expect(page.locator('#pele-error-test pre.mermaid')).toHaveText('flowchart LR\n  A -->');
    });
});

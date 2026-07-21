import { test, expect, skipInStaticMode } from '../fixtures/auth.fixture';
import * as path from 'path';
import * as fs from 'fs';
import type { Download, Page } from '@playwright/test';
import { unzipSync } from '../../../../src/shared/export';
import {
    waitForAppReady,
    gotoWorkarea,
    selectFirstPage,
    addTextIdevice,
    waitForTinyMCEReady,
    saveProject,
    reloadPage,
    waitForPreviewContent,
    getPreviewFrame,
} from '../helpers/workarea-helpers';

/**
 * E2E regression for issue #2191 — "LaTeX rendering issue in FX Tabs".
 *
 * A text iDevice with an FX Tabs block whose tab headings contain LaTeX used to
 * render the equations everywhere except the tab navigation labels, which showed
 * the flattened MathML characters (e.g. "sumn=110n"). Root cause: $exeFX.tabs.rft()
 * built the labels from h2.text(), discarding the rendered <span class="exe-math-rendered">
 * (SVG + assistive MathML).
 *
 * This spec drives the full user workflow: create the iDevice, save, verify the
 * rendered equation survives in the visible tab label, switch to an initially
 * hidden tab and verify its content renders, switch back, reload for persistence,
 * verify Preview, and verify the HTML5 export.
 */

// FX Tabs with LaTeX in both the tab headings (labels) and the panel content.
// The second tab is initially hidden.
const FX_TABS_CONTENT = `
    <p>Inline outside FX: \\(x^2\\)</p>
    <div class="exe-fx exe-tabs">
        <h2>\\(\\alpha+\\beta\\)</h2>
        <p>First panel inline \\(\\sqrt{a}\\)</p>
        <p>First panel display \\[\\int_0^1 x\\,dx\\]</p>
        <h2>\\(\\gamma^2\\)</h2>
        <p>Second (hidden) panel inline \\(\\frac{1}{2}\\)</p>
    </div>
`;

/**
 * Add a text iDevice whose content is the FX Tabs block above and save it.
 */
async function addFxTabsIdevice(page: Page): Promise<void> {
    await addTextIdevice(page);
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.waitFor({ timeout: 15000 });
    await waitForTinyMCEReady(page);

    await page.evaluate(content => {
        const editor = (window as any).tinymce?.activeEditor;
        if (editor) {
            editor.setContent(content);
            editor.fire('change');
            editor.fire('input');
            editor.setDirty(true);
        }
    }, FX_TABS_CONTENT);

    const saveBtn = block.locator('.btn-save-idevice');
    await saveBtn.click();

    await page.waitForFunction(
        () => {
            const idevice = document.querySelector('#node-content article .idevice_node.text');
            return idevice && idevice.getAttribute('mode') !== 'edition';
        },
        undefined,
        { timeout: 20000 },
    );
}

/**
 * Wait until the FX Tabs block has been built and its first navigation label
 * carries a rendered equation (pre-rendered wrapper, MathJax container, or SVG).
 */
async function waitForRenderedTabLabel(page: Page): Promise<void> {
    await page.waitForFunction(
        () => {
            const nav = document.querySelector('#node-content .exe-fx.exe-tabs ul.fx-tabs');
            if (!nav) return false;
            const firstLabel = nav.querySelector('li a');
            if (!firstLabel) return false;
            return !!firstLabel.querySelector('.exe-math-rendered, mjx-container, svg');
        },
        undefined,
        { timeout: 20000 },
    );
}

/**
 * Export the current project as an HTML5 website and return the download.
 */
async function exportHtml5Website(page: Page): Promise<Download> {
    await page.locator('#dropdownFile').click();
    await page.waitForTimeout(300);

    const exportSubmenuToggle = page.locator('#dropdownExportAs:visible, #dropdownExportAsOffline:visible').first();
    if ((await exportSubmenuToggle.count()) > 0) {
        await exportSubmenuToggle.click();
        await page.waitForTimeout(300);
    }

    const exportOption = page
        .locator('#navbar-button-export-html5:visible, #navbar-button-exportas-html5:visible')
        .first();
    await exportOption.waitFor({ state: 'visible', timeout: 10000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
    await exportOption.click();
    return downloadPromise;
}

test.describe('FX Tabs LaTeX rendering (#2191)', () => {
    test('renders LaTeX in tab labels and hidden panels, and preserves it through reload, preview and export', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        // Creating a project, adding an iDevice and driving Preview/export is a
        // server-backed authoring workflow (same reason as block-icons.spec.ts).
        // The fix itself (exe_effects.js) is covered elsewhere: the colocated
        // Vitest suite exercises $exeFX.tabs.rft() directly, and the static build
        // ships the same exe_effects.js used here.
        skipInStaticMode(test, testInfo, 'Requires server to create projects, add iDevices, and drive Preview/export');

        const page = authenticatedPage;

        // Fail the test on uncaught page errors related to FX/MathJax.
        const pageErrors: string[] = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        const projectUuid = await createProject(page, 'FX Tabs LaTeX #2191');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addFxTabsIdevice(page);

        // 1) The FX tab controls must be built and the first (visible) label must
        //    carry the rendered equation, not the flattened MathML text.
        await waitForRenderedTabLabel(page);

        const workareaState = await page.evaluate(() => {
            const fx = document.querySelector('#node-content .exe-fx.exe-tabs');
            const nav = fx?.querySelector('ul.fx-tabs');
            const labels = Array.from(nav?.querySelectorAll(':scope > li > a') ?? []);
            const rendered = (a: Element | undefined) => !!a?.querySelector('.exe-math-rendered, mjx-container, svg');
            return {
                tabCount: labels.length,
                firstLabelRendered: rendered(labels[0]),
                secondLabelRendered: rendered(labels[1]),
                // The label must NOT be the flattened MathML string.
                firstLabelText: (labels[0]?.textContent ?? '').trim(),
            };
        });

        expect(workareaState.tabCount).toBe(2);
        expect(workareaState.firstLabelRendered).toBe(true);
        expect(workareaState.secondLabelRendered).toBe(true);

        // 2) Switch to the second (initially hidden) tab and verify its content
        //    renders the equation. Use dispatchEvent so the tab's click handler
        //    fires deterministically: a label whose only content is an inline
        //    (aria-hidden) SVG can be reported as "not visible" by Playwright's
        //    strict actionability check in the static build. The assertion below
        //    still verifies the real DOM outcome (panel activates and renders).
        await page.locator('#node-content .exe-fx.exe-tabs ul.fx-tabs > li').nth(1).locator('a').dispatchEvent('click');
        await page.waitForFunction(
            () => {
                const panels = document.querySelectorAll('#node-content .exe-fx.exe-tabs .fx-tab-content');
                const second = panels[1] as HTMLElement | undefined;
                if (!second || !second.classList.contains('fx-current')) return false;
                return !!second.querySelector('.exe-math-rendered, mjx-container, svg');
            },
            undefined,
            { timeout: 15000 },
        );

        // 3) Switch back to the first tab; it must still be rendered and active.
        await page.locator('#node-content .exe-fx.exe-tabs ul.fx-tabs > li').nth(0).locator('a').dispatchEvent('click');
        await page.waitForFunction(
            () => {
                const panels = document.querySelectorAll('#node-content .exe-fx.exe-tabs .fx-tab-content');
                const first = panels[0] as HTMLElement | undefined;
                return !!first && first.classList.contains('fx-current');
            },
            undefined,
            { timeout: 15000 },
        );

        // 4) No raw LaTeX delimiters should remain visible anywhere in the FX block.
        const afterSwitch = await page.evaluate(() => {
            const fx = document.querySelector('#node-content .exe-fx.exe-tabs') as HTMLElement | null;
            const text = fx?.textContent ?? '';
            return { hasRawInline: text.includes('\\('), hasRawDisplay: text.includes('\\[') };
        });
        expect(afterSwitch.hasRawInline).toBe(false);
        expect(afterSwitch.hasRawDisplay).toBe(false);

        // 5) Persistence: save + reload, then the rendered tab label must survive.
        await saveProject(page);
        await reloadPage(page);
        await waitForAppReady(page);
        await waitForRenderedTabLabel(page);

        // 6) Preview must render the tab label equation as well.
        await waitForPreviewContent(page);
        const iframe = getPreviewFrame(page);
        await iframe.locator('.exe-fx.exe-tabs ul.fx-tabs li a').first().waitFor({ state: 'attached', timeout: 20000 });
        const previewState = await iframe.locator('body').evaluate((body: HTMLElement) => {
            const fx = body.querySelector('.exe-fx.exe-tabs');
            const labels = Array.from(fx?.querySelectorAll('ul.fx-tabs > li > a') ?? []);
            const rendered = (a: Element | undefined) => !!a?.querySelector('.exe-math-rendered, mjx-container, svg');
            return {
                tabCount: labels.length,
                firstLabelRendered: rendered(labels[0]),
                hasRawInline: (fx as HTMLElement)?.textContent?.includes('\\(') ?? false,
            };
        });
        expect(previewState.tabCount).toBe(2);
        expect(previewState.firstLabelRendered).toBe(true);
        expect(previewState.hasRawInline).toBe(false);

        // 7) HTML5 export: the FX tab heading must ship pre-rendered math and no
        //    raw inline delimiters must remain in the exported markup.
        await saveProject(page);
        const download = await exportHtml5Website(page);
        const tmpDir = path.join('/tmp', `fx-tabs-latex-${projectUuid}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        const exportPath = path.join(tmpDir, download.suggestedFilename());
        await download.saveAs(exportPath);
        expect(fs.existsSync(exportPath)).toBe(true);

        const zipMap = unzipSync(fs.readFileSync(exportPath));
        const htmlFiles = Object.keys(zipMap).filter(f => f.endsWith('.html') || f.endsWith('.xhtml'));
        expect(htmlFiles.length).toBeGreaterThan(0);
        const decodedHtml = htmlFiles.map(f => Buffer.from(zipMap[f]).toString('utf8')).join('\n');

        // The exported FX tabs heading ships pre-rendered math.
        expect(decodedHtml).toContain('class="exe-fx exe-tabs"');
        expect(decodedHtml).toContain('class="exe-math-rendered"');
        // No raw inline LaTeX delimiters directly between tags in the export.
        const rawVisibleInline = (decodedHtml.match(/>\s*\\\([^<]*\\\)\s*</g) || []).length;
        expect(rawVisibleInline).toBe(0);
        // exe_effects.js must be bundled so the tabs are built at runtime.
        expect(Object.keys(zipMap).some(f => f.endsWith('exe_effects.js'))).toBe(true);

        // No relevant uncaught page errors during the whole flow.
        const relevantErrors = pageErrors.filter(m => /fx|tab|mathjax|latex|typeset/i.test(m));
        expect(relevantErrors).toEqual([]);
    });
});

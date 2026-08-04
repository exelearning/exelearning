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
 * Two tests:
 *  1) Workarea — the tab labels render the equation, switching to an initially
 *     hidden tab renders its content, switching back keeps the first tab active,
 *     and no raw LaTeX delimiters remain visible.
 *  2) HTML5 export — the FX tab heading ships the pre-rendered math and exe_effects.js
 *     is bundled so the tabs (and their labels) are built at runtime in the viewer.
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
    test('renders LaTeX in tab labels and in an initially hidden tab', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        // Creating a project and adding an iDevice is a server-backed authoring
        // workflow (same reason as block-icons.spec.ts). The fix in exe_effects.js
        // is exercised identically in the static build, which ships the same script.
        skipInStaticMode(test, testInfo, 'Requires server to create projects and add iDevices');

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
            };
        });

        expect(workareaState.tabCount).toBe(2);
        expect(workareaState.firstLabelRendered).toBe(true);
        expect(workareaState.secondLabelRendered).toBe(true);

        // 2) Switch to the second (initially hidden) tab and verify its content
        //    renders the equation. dispatchEvent fires the tab handler
        //    deterministically: a label whose only content is an inline
        //    (aria-hidden) SVG can be reported as "not visible" by Playwright's
        //    strict actionability check. The assertion still verifies the real
        //    DOM outcome (panel activates and renders).
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

        // 3) Switch back to the first tab; it must still be active.
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

        // No relevant uncaught page errors during the flow.
        const relevantErrors = pageErrors.filter(m => /fx|tab|mathjax|latex|typeset/i.test(m));
        expect(relevantErrors).toEqual([]);
    });

    test('HTML5 export ships pre-rendered FX-tabs LaTeX and bundles exe_effects.js', async ({
        authenticatedPage,
        createProject,
    }, testInfo) => {
        skipInStaticMode(test, testInfo, 'Requires server to create projects, add iDevices, and export');

        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'FX Tabs LaTeX export #2191');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await selectFirstPage(page);
        await addFxTabsIdevice(page);
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

        // The exported FX tabs block ships pre-rendered math (built into labels at runtime).
        expect(decodedHtml).toContain('class="exe-fx exe-tabs"');
        expect(decodedHtml).toContain('class="exe-math-rendered"');
        // No raw inline LaTeX delimiters directly between tags in the export.
        const rawVisibleInline = (decodedHtml.match(/>\s*\\\([^<]*\\\)\s*</g) || []).length;
        expect(rawVisibleInline).toBe(0);
        // exe_effects.js must be bundled so the tabs are built at runtime.
        expect(Object.keys(zipMap).some(f => f.endsWith('exe_effects.js'))).toBe(true);
    });
});

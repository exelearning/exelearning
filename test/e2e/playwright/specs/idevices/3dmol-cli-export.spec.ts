/** Issue #2543: run an unmodified CLI export, including its runtime-created resource URLs. */
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { lookup } from 'mime-types';
import type { Page } from '@playwright/test';
import { test, expect, isStaticProject } from '../../fixtures/auth.fixture';
import {
    addPage,
    downloadProject,
    expandIdeviceCategory,
    gotoWorkarea,
    saveIdevice,
    selectNavNode,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

const runFile = promisify(execFile);
const ORIGIN = 'http://3dmol-cli-export.test';

async function addMolecule(page: Page): Promise<void> {
    await expandIdeviceCategory(page, /Science|Ciencia/i);
    // A leading digit is valid in an HTML class, but not in a native CSS selector.
    await page.locator('.idevice_item[id="3dmol"]').click();
    const form = page.locator('#dMoleIdeviceForm');
    await expect(form).toBeVisible();
    // Use the actual edition lifecycle and its bundled molecule instead of an empty runtime container.
    await expect(page.locator('#dmoleModelFileName')).not.toBeEmpty({ timeout: 20000 });
    const id = await form.locator('xpath=ancestor::*[contains(@class, "idevice_node")]').getAttribute('id');
    expect(id).toBeTruthy();
    await saveIdevice(page, id!);
}

test('CLI export starts 3DMol and loads its resources on the home page and subpage', async ({
    authenticatedPage: page,
    createProject,
    browser,
}, testInfo) => {
    test.setTimeout(120000);
    // Static mode already has an isolated local project from authenticatedPage.
    if (!isStaticProject(testInfo)) {
        const uuid = await createProject(page, '3DMol CLI resources');
        await gotoWorkarea(page, uuid);
    }
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addMolecule(page);
    const moleculePageId = await addPage(page, 'Molecules');
    await selectNavNode(page, moleculePageId);
    await addMolecule(page);

    await mkdir(testInfo.outputDir, { recursive: true });
    const input = testInfo.outputPath('molecules.elpx');
    await (await downloadProject(page)).saveAs(input);
    const output = testInfo.outputPath('molecules.zip');
    await runFile('bun', ['src/cli/index.ts', 'elp:export', input, output, '--format=html5'], {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 60000,
    });
    const files = unzipSync(await readFile(output));
    expect(files['index.html']).toBeDefined();
    expect(files['html/molecules.html']).toBeDefined();

    // A fresh context has no editor globals, cached resources or service workers.
    const context = await browser.newContext({ serviceWorkers: 'block' });
    try {
        const exportedPage = await context.newPage();
        const missing: string[] = [];
        const errors: string[] = [];
        exportedPage.on('pageerror', error => errors.push(error.message));
        exportedPage.on('requestfailed', request => missing.push(request.url()));
        await exportedPage.route(`${ORIGIN}/**`, async route => {
            const key = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
            const bytes = files[key];
            if (!bytes) missing.push(key);
            await route.fulfill({
                status: bytes ? 200 : 404,
                contentType: lookup(key) || 'application/octet-stream',
                body: bytes ? Buffer.from(bytes) : `Missing from export: ${key}`,
            });
        });

        for (const [pagePath, idevicePath] of [
            ['index.html', 'idevices/3dmol/'],
            ['html/molecules.html', '../idevices/3dmol/'],
        ]) {
            await exportedPage.goto(`${ORIGIN}/${pagePath}`);
            await expect(exportedPage.locator('#dmolpMainContainer-0')).toBeVisible();
            await expect
                .poll(() =>
                    exportedPage.evaluate(() => {
                        const game = (window as any).$eXe3Dmol;
                        return {
                            path: game?.idevicePath,
                            activities: game?.options?.length,
                            library: typeof (window as any).$3Dmol?.createViewer,
                        };
                    }),
                )
                .toEqual({ path: idevicePath, activities: 1, library: 'function' });

            // These URLs are built by the running iDevice, so ZIP-link inspection alone cannot check them.
            for (const filename of ['dmolpHome.png', 'dmolpIcon.png', 'exequextwon.png']) {
                const img = exportedPage.locator(`.dmole-IDevice img[src$="/${filename}"]`).first();
                await expect(img).toHaveAttribute('src', `${idevicePath}${filename}`);
                await expect
                    .poll(() =>
                        img.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
                    )
                    .toBe(true);
            }
            expect(missing, pagePath).toEqual([]);
            expect(errors, pagePath).toEqual([]);
        }
    } finally {
        await context.close();
    }
});

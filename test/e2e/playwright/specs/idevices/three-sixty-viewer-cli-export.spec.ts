/** Issue #2705: the 360 viewer export must load Three.js before OrbitControls. */
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { lookup } from 'mime-types';
import { test, expect, isStaticProject } from '../../fixtures/auth.fixture';
import {
    downloadProject,
    expandIdeviceCategory,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

const runFile = promisify(execFile);
const ORIGIN = 'http://three-sixty-cli-export.test';

test('CLI export loads Three.js before OrbitControls in the 360 viewer', async ({
    authenticatedPage: page,
    createProject,
    browser,
}, testInfo) => {
    test.setTimeout(180000);

    // Static mode already has an isolated local project from authenticatedPage.
    if (!isStaticProject(testInfo)) {
        const uuid = await createProject(page, '360 CLI export');
        await gotoWorkarea(page, uuid);
    }
    await waitForAppReady(page);
    await selectFirstPage(page);

    await expandIdeviceCategory(page, /Information|Información/i);
    await page.locator('.idevice_item[id="three-sixty-viewer"]').click();
    await expect(page.locator('#threeSixtyAlt')).toBeVisible({ timeout: 15000 });
    const ideviceId = await page
        .locator('#node-content article .idevice_node.three-sixty-viewer')
        .last()
        .getAttribute('id');
    expect(ideviceId).toBeTruthy();
    await saveIdevice(page, ideviceId!);

    await mkdir(testInfo.outputDir, { recursive: true });
    const input = testInfo.outputPath('panorama.elpx');
    await (await downloadProject(page)).saveAs(input);
    const output = testInfo.outputPath('panorama.zip');
    await runFile('bun', ['src/cli/index.ts', 'elp:export', input, output, '--format=html5'], {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 60000,
    });

    // The ZIP must reference the three files in config.xml order.
    const files = unzipSync(await readFile(output));
    expect(files['index.html']).toBeDefined();
    const indexHtml = new TextDecoder().decode(files['index.html']);
    const scripts = ['three.min.js', 'OrbitControls.js', 'three-sixty-viewer.js'].map(file =>
        indexHtml.indexOf(`idevices/three-sixty-viewer/${file}`),
    );
    expect(scripts[0]).toBeGreaterThan(-1);
    expect(scripts[0]).toBeLessThan(scripts[1]);
    expect(scripts[1]).toBeLessThan(scripts[2]);

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

        await exportedPage.goto(`${ORIGIN}/index.html`);
        await expect
            .poll(() => exportedPage.evaluate(() => typeof (window as any).THREE?.OrbitControls))
            .toBe('function');
        expect(errors).toEqual([]);
        expect(missing).toEqual([]);
    } finally {
        await context.close();
    }
});

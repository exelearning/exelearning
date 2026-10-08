import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FrameLocator, Page } from '@playwright/test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * The print preview loads the project's style from wherever it is served: a base style from the
 * application, a style an administrator installed from the site files. The preview is a blob:
 * document, which resolves no relative path, so the stylesheet, the script and the icons blocks
 * are given all have to come from that address.
 */

/** Give the project a page with one block showing the given icon from the style. */
async function addBlockWithStyleIcon(page: Page, icon: string) {
    await page.evaluate(value => {
        const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
        const parent = binding.createPage('Style');
        const block = binding.createBlock(parent.id, 'Block with a style icon');
        binding.updateBlock(block, { icon: { source: 'theme', value } });
        binding.createComponent(parent.id, block, 'text', { htmlContent: '<p>Some text</p>' });
    }, icon);
}

/** Open the print preview and wait until its document has been drawn. */
async function openPreview(page: Page): Promise<FrameLocator> {
    await page.evaluate(() => (window as any).eXeLearning.app.modals.printpreview.show());
    const overlay = page.locator('#printPreviewOverlay');
    await expect(overlay).toHaveAttribute('data-visible', 'true', { timeout: 15000 });
    await expect(overlay).toHaveAttribute('data-busy', 'false', { timeout: 60000 });
    return page.frameLocator('.print-preview-iframe');
}

/** Whether the block's icon has loaded: one that failed, or was never requested, has no width. */
async function iconLoaded(frame: FrameLocator): Promise<boolean> {
    const icon = frame.locator('.box-icon img');
    await expect(icon).toHaveCount(1);
    return icon.evaluate(img => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0);
}

test.describe('Print preview: the style', () => {
    test('loads the icons of a base style', async ({ authenticatedPage: page, createProject }) => {
        const uuid = await createProject(page, 'Print a base style');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await addBlockWithStyleIcon(page, 'activity');

        const frame = await openPreview(page);

        await expect.poll(() => iconLoaded(frame), { timeout: 15000 }).toBe(true);
    });

    test('loads a style an administrator installed: its stylesheet and its icons', async ({
        authenticatedPage: page,
        createProject,
    }, testInfo) => {
        test.skip(testInfo.project.name === 'static', 'Site styles are installed through the server');

        const login = await page.request.post('/api/auth/login', {
            data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
        });
        expect(login.ok()).toBeTruthy();

        // A style of its own, so that nothing else installed during the run can answer for it.
        const name = `print-site-style-${Date.now()}`;
        const fixture = unzipSync(readFileSync(path.resolve('test/fixtures/test-theme-with-icons.zip')));
        const zip = zipSync({
            'config.xml': strToU8(
                `<?xml version="1.0" encoding="UTF-8"?><theme><name>${name}</name><title>${name}</title><version>1.0</version></theme>`,
            ),
            'style.css': strToU8('.exe-content { outline: 3px solid rgb(1, 2, 3); }'),
            'icons/info.png': fixture['icons/info.png'],
        });
        const upload = await page.request.post('/api/admin/themes/upload', {
            multipart: { file: { name: `${name}.zip`, mimeType: 'application/zip', buffer: Buffer.from(zip) } },
        });
        expect(upload.ok()).toBeTruthy();
        const style = await upload.json();

        try {
            const uuid = await createProject(page, 'Print a site style');
            await gotoWorkarea(page, uuid);
            await waitForAppReady(page);
            await page.evaluate(
                async id => (window as any).eXeLearning.app.themes.selectTheme(id, true, true),
                style.dirName,
            );
            await addBlockWithStyleIcon(page, 'info');

            const frame = await openPreview(page);

            // The style's own stylesheet applies, and its icon loads from the same place.
            await expect
                .poll(
                    () =>
                        frame
                            .locator('.exe-content')
                            .first()
                            .evaluate(el => getComputedStyle(el).outlineColor),
                    {
                        timeout: 15000,
                    },
                )
                .toBe('rgb(1, 2, 3)');
            await expect.poll(() => iconLoaded(frame), { timeout: 15000 }).toBe(true);
        } finally {
            await page.request.delete(`/api/admin/themes/${style.id}`);
        }
    });
});

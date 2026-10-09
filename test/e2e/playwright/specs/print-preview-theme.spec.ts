import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FrameLocator, Page } from '@playwright/test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady } from '../helpers/workarea-helpers';

/**
 * The print preview loads the project's style from wherever it is: a base style from the
 * application, a style an administrator installed from the site files, and a style the user
 * imported from its own files, kept with the project. The preview is a blob: document, which
 * resolves no relative path, so the stylesheet, the script and the icons blocks are given all
 * have to come from there.
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

/** The outline of the page's content, which each test style sets to a colour of its own. */
function contentOutline(frame: FrameLocator): Promise<string> {
    return frame
        .locator('.exe-content')
        .first()
        .evaluate(el => getComputedStyle(el).outlineColor);
}

/** An icon a style can ship, taken from a fixture style. */
function fixtureIcon(): Uint8Array {
    return unzipSync(readFileSync(path.resolve('test/fixtures/test-theme-with-icons.zip')))['icons/info.png'];
}

/** A style of its own, so that nothing else installed during the run can answer for it. */
function styleZip(name: string, css: string, files: Record<string, Uint8Array>): Buffer {
    return Buffer.from(
        zipSync({
            'config.xml': strToU8(
                `<?xml version="1.0" encoding="UTF-8"?><theme><name>${name}</name><title>${name}</title><version>1.0</version></theme>`,
            ),
            'style.css': strToU8(css),
            'style.js': strToU8('document.documentElement.dataset.printThemeScript = "loaded";'),
            ...files,
        }),
    );
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

        const name = `print-site-style-${Date.now()}`;
        const zip = styleZip(name, '.exe-content { outline: 3px solid rgb(1, 2, 3); }', {
            'icons/info.png': fixtureIcon(),
        });
        const upload = await page.request.post('/api/admin/themes/upload', {
            multipart: { file: { name: `${name}.zip`, mimeType: 'application/zip', buffer: zip } },
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
            await expect.poll(() => contentOutline(frame), { timeout: 15000 }).toBe('rgb(1, 2, 3)');
            await expect.poll(() => iconLoaded(frame), { timeout: 15000 }).toBe(true);
            await expect(frame.locator('html')).toHaveAttribute('data-print-theme-script', 'loaded');
        } finally {
            await page.request.delete(`/api/admin/themes/${style.id}`);
        }
    });

    test('loads a style the user imported: its stylesheet, what the stylesheet refers to, and its icons', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, 'Print an imported style');
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);

        const name = `print-user-style-${Date.now()}`;
        const zip = styleZip(
            name,
            '@import "css/extra.css"; @import "css/print.css" print; ' +
                '.exe-content { outline: 3px solid rgb(4, 5, 6); } ' +
                '.box-head { background-image: url("img/stripe(1).png"); } ' +
                '.box:has(.box-icon img[src*="eng_"]) .box-title { color: rgb(65, 130, 17); } ' +
                '.box-icon img { filter: url("img/filters.svg#identity"); }',
            {
                'img/stripe(1).png': fixtureIcon(),
                'icons/eng_info.png': fixtureIcon(),
                'css/extra.css': strToU8(
                    '.box-title { font-style: normal; } .box-head { outline: 3px solid rgb(7, 8, 9); }',
                ),
                'css/print.css': strToU8('.box-title { font-style: italic; }'),
                'img/filters.svg': strToU8(
                    '<svg xmlns="http://www.w3.org/2000/svg"><filter id="identity"><feColorMatrix type="saturate" values="1"/></filter></svg>',
                ),
            },
        );
        await page.locator('#dropdownStyles').click();
        await page.waitForSelector('#stylessidenav.active', { timeout: 5000 });
        await page.locator('#importedstylescontent-tab').click();
        await page
            .locator('#theme-file-import')
            .setInputFiles({ name: `${name}.zip`, mimeType: 'application/zip', buffer: zip });
        const id = await page
            .waitForFunction(
                prefix => {
                    const installed = (window as any).eXeLearning?.app?.themes?.list?.installed || {};
                    return (
                        Object.keys(installed).find(key => key.startsWith(prefix) && installed[key]?.isUserTheme) ||
                        null
                    );
                },
                name,
                { timeout: 15000 },
            )
            .then(handle => handle.jsonValue() as Promise<string>);
        await page.evaluate(async theme => (window as any).eXeLearning.app.themes.selectTheme(theme, true, true), id);
        await addBlockWithStyleIcon(page, 'eng_info');

        const frame = await openPreview(page);

        // Taken from its own files: the stylesheet applies, what the stylesheet refers to is
        // handed over with it instead of resolving to nothing, and the icon loads.
        await expect.poll(() => contentOutline(frame), { timeout: 15000 }).toBe('rgb(4, 5, 6)');
        await expect(frame.locator('html')).toHaveAttribute('data-print-theme-script', 'loaded');
        const heading = frame.locator('.box-head').first();
        await expect(heading).toHaveCSS('outline-color', 'rgb(7, 8, 9)');
        const title = heading.locator('.box-title');
        await expect(title).toHaveCSS('color', 'rgb(65, 130, 17)');
        await expect(title).toHaveCSS('font-style', 'normal');
        // A computed blob URL alone also passes for a revoked or invalid resource. Decode it
        // in the iframe that owns it to establish that the image is actually available.
        expect(
            await heading.evaluate(async el => {
                const reference = getComputedStyle(el).backgroundImage.match(/^url\("(blob:[^"]+)"\)$/)?.[1];
                if (!reference) return false;
                const image = new Image();
                image.src = reference;
                await image.decode();
                return image.naturalWidth > 0;
            }),
        ).toBe(true);
        await expect.poll(() => iconLoaded(frame), { timeout: 15000 }).toBe(true);
        await expect(frame.locator('.box-icon img')).toHaveCSS('filter', /^url\("blob:[^"]+#identity"\)$/);
        await page.emulateMedia({ media: 'print' });
        await expect(title).toHaveCSS('font-style', 'italic');
        await expect(title).toHaveCSS('color', 'rgb(65, 130, 17)');
        await page.emulateMedia({ media: null });
    });
});

import type { Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { unzipSync } from '../../../../../src/shared/export';
import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    exportProjectAs,
    openPreviewAndWaitForContent,
    getPreviewFrame,
} from '../../helpers/workarea-helpers';

/**
 * E2E Tests for the Text iDevice fullscreen button.
 *
 * The button is added at runtime by the export script, so it appears in the
 * preview (and in exported pages) without being saved in the iDevice HTML.
 * In preview, the whole block (title included) goes fullscreen. Two paths are
 * checked separately: the native Fullscreen API, and the CSS fallback used
 * when the browser refuses it (e.g. an iframe without allowfullscreen).
 * A Web Site (HTML) export is also opened from file:// to check the button
 * works in standalone pages.
 */

// 16x16 PNG. The author gives it a width of 240: that size must be kept
// (and scaled with the rest of the content), not replaced by its natural size.
const IMAGE =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGM4Y2xMEmIY1TCqYfhqAABHizIQlvhFxwAAAABJRU5ErkJggg==';

type Parts = {
    box: Locator;
    wrap: Locator;
    button: Locator;
};

/**
 * Create a project with a Text iDevice whose content has a plain paragraph, a
 * paragraph with an explicit rem font size (as set by the editor font size
 * menu), an image with an explicit width and a link.
 */
async function createTextProject(page: Page, createProject: (page: Page, title: string) => Promise<string>) {
    const projectUuid = await createProject(page, 'Text Fullscreen Test');
    await gotoWorkarea(page, projectUuid);
    await waitForAppReady(page);

    await addTextIdevice(page);
    // Write into the main text editor explicitly: the Text iDevice form
    // also has a TinyMCE editor for the feedback, which may be the active one.
    await page.waitForFunction(
        () => {
            const editor = (window as any).tinymce?.get('textTextarea');
            return !!editor && editor.initialized && !editor.removed;
        },
        undefined,
        { timeout: 15000 },
    );
    await page.evaluate(image => {
        (window as any).tinymce
            .get('textTextarea')
            .setContent(
                '<p class="fs-plain">Plain fullscreen text</p>' +
                    '<p><span class="fs-big" style="font-size: 1.5rem;">Text at 150%</span></p>' +
                    `<p><img class="fs-img" src="${image}" width="240" height="240" alt="Square"></p>` +
                    '<p><a href="#somewhere">A link</a></p>',
            );
    }, IMAGE);
    const block = page.locator('#node-content article .idevice_node.text').last();
    await block.locator('.btn-save-idevice').click();
    await expect(block).not.toHaveAttribute('mode', 'edition', { timeout: 20000 });
}

/** Locate the block, the wrapper and the button of the Text iDevice. */
async function getParts(scope: Page | ReturnType<typeof getPreviewFrame>): Promise<Parts> {
    const idevice = scope.locator('.idevice_node.text').filter({ hasText: 'Plain fullscreen text' }).first();
    await expect(idevice).toBeVisible({ timeout: 15000 });
    await expect
        .poll(() => idevice.locator('img.fs-img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
        .toBe(16);
    const box = scope.locator('article.box', { has: idevice }).first();
    const wrap = idevice.locator('.text-fullscreen-wrap').first();
    const button = wrap.locator('> .text-fullscreen-btn');
    await expect(box).toHaveClass(/text-fullscreen-target/);
    await expect(button).toHaveCount(1);
    await expect(button).toHaveAttribute('aria-label', 'Full screen');
    await expect(button).not.toHaveAttribute('aria-pressed', /.*/);
    return { box, wrap, button };
}

/** Create the project and open the preview. */
async function setupPreview(page: Page, createProject: (page: Page, title: string) => Promise<string>) {
    await createTextProject(page, createProject);
    await openPreviewAndWaitForContent(page);
    return getParts(getPreviewFrame(page));
}

/** Rendered sizes (in CSS px on screen) of the parts of the content. */
async function measure(box: Locator) {
    return box.evaluate(el => {
        const height = (sel: string) => (el.querySelector(sel) as HTMLElement).getBoundingClientRect().height;
        return {
            plain: height('.fs-plain'),
            big: height('.fs-big'),
            title: height('.box-title'),
            image: (el.querySelector('img.fs-img') as HTMLElement).getBoundingClientRect().width,
        };
    });
}

/** Everything grows by the same factor, so the proportions are kept. */
function expectProportionalGrowth(before: Record<string, number>, after: Record<string, number>) {
    const factor = after.plain / before.plain;
    expect(factor).toBeGreaterThan(1.2);
    for (const key of ['big', 'title', 'image']) {
        expect(after[key] / before[key]).toBeCloseTo(factor, 1);
    }
    // The paragraph with an explicit rem size stays bigger than plain text.
    expect(after.big).toBeGreaterThan(after.plain);
}

test.describe('Text iDevice fullscreen', () => {
    test('native fullscreen scales the whole block, keeping its proportions', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await page.setViewportSize({ width: 1600, height: 900 });
        const { box, wrap, button } = await setupPreview(page, createProject);

        const before = await measure(box);
        expect(before.image).toBeCloseTo(240, 0);

        await wrap.hover();
        await button.click();
        await expect
            .poll(() => box.evaluate(el => el.ownerDocument.fullscreenElement === el), { timeout: 5000 })
            .toBe(true);
        await expect(box).not.toHaveClass(/text-fs-active/);
        await expect(button).toHaveAttribute('aria-label', 'Exit Full Screen');

        expectProportionalGrowth(before, await measure(box));

        // Leave fullscreen with the same button: sizes go back to normal.
        await button.click();
        await expect
            .poll(() => box.evaluate(el => el.ownerDocument.fullscreenElement === el), { timeout: 5000 })
            .toBe(false);
        await expect(button).toHaveAttribute('aria-label', 'Full screen');
        const restored = await measure(box);
        expect(restored.plain).toBeCloseTo(before.plain, 0);
        expect(restored.image).toBeCloseTo(before.image, 0);
    });

    test('CSS fallback scales the block, keeps focus inside and restores the page', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        await page.setViewportSize({ width: 1600, height: 900 });
        const { box, wrap, button } = await setupPreview(page, createProject);

        // Simulate a browser or an embedding iframe that refuses fullscreen.
        await box.evaluate(el => {
            (el as any).requestFullscreen = undefined;
            el.ownerDocument.body.style.overflow = 'auto';
        });
        const before = await measure(box);

        await wrap.hover();
        await button.click();
        await expect(box).toHaveClass(/text-fs-active/);
        await expect(button).toHaveAttribute('aria-label', 'Exit Full Screen');
        await expect(button).toBeFocused();
        expect(await box.evaluate(el => el.ownerDocument.body.style.overflow)).toBe('hidden');

        expectProportionalGrowth(before, await measure(box));

        // Tab cycles inside the block: button -> link -> back to the button.
        const link = box.locator('a[href="#somewhere"]');
        await page.keyboard.press('Tab');
        await expect(link).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(link).toBeFocused();

        // Escape leaves, restores the page overflow and returns the focus.
        await page.keyboard.press('Escape');
        await expect(box).not.toHaveClass(/text-fs-active/);
        await expect(button).toHaveAttribute('aria-label', 'Full screen');
        await expect(button).toBeFocused();
        expect(await box.evaluate(el => el.ownerDocument.body.style.overflow)).toBe('auto');
        const restored = await measure(box);
        expect(restored.plain).toBeCloseTo(before.plain, 0);
    });

    test('works in a Web Site export opened from file://', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        await createTextProject(page, createProject);

        const download = await exportProjectAs(page, 'html5');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-fullscreen-html5-'));
        try {
            const zipPath = path.join(dir, 'package.zip');
            await download.saveAs(zipPath);
            const entries = unzipSync(fs.readFileSync(zipPath));
            for (const [name, data] of Object.entries(entries)) {
                if (name.endsWith('/')) continue;
                const target = path.join(dir, 'out', name);
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.writeFileSync(target, data);
            }
            // The button is added at runtime: it is not saved in the page HTML.
            const indexHtml = fs.readFileSync(path.join(dir, 'out', 'index.html'), 'utf-8');
            expect(indexHtml).toContain('Plain fullscreen text');
            expect(indexHtml).not.toContain('text-fullscreen-btn');

            const exported = await page.context().newPage();
            await exported.setViewportSize({ width: 1600, height: 900 });
            await exported.goto(pathToFileURL(path.join(dir, 'out', 'index.html')).href);
            const { box, wrap, button } = await getParts(exported);
            await expect(button).toHaveAttribute('aria-label', 'Full screen');

            const before = await measure(box);
            await wrap.hover();
            await button.click();
            await expect
                .poll(() => box.evaluate(el => el.ownerDocument.fullscreenElement === el), { timeout: 5000 })
                .toBe(true);
            await expect(button).toHaveAttribute('aria-label', 'Exit Full Screen');
            expectProportionalGrowth(before, await measure(box));

            await button.click();
            await expect(button).toHaveAttribute('aria-label', 'Full screen');
            await exported.close();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

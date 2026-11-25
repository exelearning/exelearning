import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    addTextIdevice,
    openPreviewAndWaitForContent,
    getPreviewFrame,
} from '../../helpers/workarea-helpers';

/**
 * E2E Tests for the Text iDevice fullscreen button.
 *
 * The button is added at runtime by the export script, so it appears in the
 * preview (and in exported pages) without being saved in the iDevice HTML.
 * Headless browsers may refuse the Fullscreen API inside the preview iframe;
 * in that case the CSS fallback (.text-fs-active) is used. Both paths must
 * scale the content up.
 */

test.describe('Text iDevice fullscreen', () => {
    test('shows a fullscreen button in preview that enlarges the text', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;

        const projectUuid = await createProject(page, 'Text Fullscreen Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        const content = `Fullscreen text ${Date.now()}`;
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
        await page.evaluate(text => {
            (window as any).tinymce.get('textTextarea').setContent(`<p>${text}</p>`);
        }, content);
        const block = page.locator('#node-content article .idevice_node.text').last();
        await block.locator('.btn-save-idevice').click();
        await expect(block).not.toHaveAttribute('mode', 'edition', { timeout: 20000 });

        await openPreviewAndWaitForContent(page);
        const frame = getPreviewFrame(page);

        const idevice = frame.locator('.idevice_node.text').filter({ hasText: content }).first();
        await expect(idevice).toBeVisible({ timeout: 15000 });

        const wrap = idevice.locator('.text-fullscreen-wrap').first();
        const button = wrap.locator('> .text-fullscreen-btn');
        await expect(button).toHaveCount(1);
        await expect(button).toHaveAttribute('aria-label', /.+/);

        const paragraph = wrap.getByText(content).first();
        await expect(paragraph).toBeVisible();
        const sizeBefore = await paragraph.evaluate(el => parseFloat(getComputedStyle(el).fontSize));

        await wrap.hover();
        await button.click();

        // Native fullscreen or the CSS fallback, whichever the browser allows.
        await expect
            .poll(
                () =>
                    wrap.evaluate(
                        el => el.ownerDocument.fullscreenElement === el || el.classList.contains('text-fs-active'),
                    ),
                { timeout: 5000 },
            )
            .toBe(true);
        await expect(button).toHaveAttribute('aria-pressed', 'true');

        const sizeAfter = await paragraph.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
        expect(sizeAfter).toBeGreaterThan(sizeBefore);

        // Leave fullscreen with the same button.
        await button.click();
        await expect
            .poll(
                () =>
                    wrap.evaluate(
                        el => el.ownerDocument.fullscreenElement === el || el.classList.contains('text-fs-active'),
                    ),
                { timeout: 5000 },
            )
            .toBe(false);
        await expect(button).toHaveAttribute('aria-pressed', 'false');
    });
});

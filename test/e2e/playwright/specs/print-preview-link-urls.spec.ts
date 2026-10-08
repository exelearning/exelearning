import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady, selectFirstPage, addIdevice } from '../helpers/workarea-helpers';

/**
 * The "Show link URLs" print option lives in the options panel beside the print preview, and must
 * show in the preview, not only in the printed output: toggling it draws the preview again.
 * Printing prints that same preview, the document as the user left it.
 */
test.describe('Print preview', () => {
    test('shows link URLs as an option and prints the preview as the user left it', async ({
        authenticatedPage: page,
        createProject,
    }, testInfo) => {
        test.setTimeout(120000);

        const projectUuid = await createProject(page, 'Print link URLs');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await selectFirstPage(page);

        await addIdevice(page, 'text');
        const node = page.locator('.idevice_node.text').first();
        await node.waitFor({ timeout: 15000 });
        const ideviceId = await node.getAttribute('id');
        const editorId = await page
            .waitForFunction(
                nodeId => {
                    const ta = document.querySelector(`#${nodeId} textarea[id*="textTextarea"]`);
                    const ed = ta && (window as any).tinymce?.get(ta.id);
                    return ed?.initialized && !ed.destroyed ? ta.id : null;
                },
                ideviceId,
                { timeout: 20000, polling: 200 },
            )
            .then(h => h.jsonValue());
        await page.evaluate(eid => {
            const ed = (window as any).tinymce.get(eid);
            ed.setContent('<p>Visit <a href="https://cedec.intef.es/">Cedec</a> for more.</p>');
            ed.save();
            (window as any).tinymce.triggerSave();
        }, editorId);
        await node.locator('.btn-save-idevice').click();
        await expect(node.locator('.btn-save-idevice')).toBeHidden({ timeout: 15000 });

        await page.evaluate(() => (window as any).eXeLearning.app.modals.printpreview.show());
        const overlay = page.locator('#printPreviewOverlay');
        await expect(overlay).toHaveAttribute('data-visible', 'true');

        // A text has no interactive activity: the panel offers only the document options.
        const panel = page.locator('#printOptionsPanel');
        await expect(panel).toBeVisible();
        await expect(panel.locator('input[name="print-activity-mode"]')).toHaveCount(0);
        const linkUrls = panel.locator('#printOptLinkUrls');
        await expect(linkUrls).toBeChecked();

        const link = page.frameLocator('.print-preview-iframe').locator('a[href="https://cedec.intef.es/"]');
        const afterContent = () => link.evaluate(a => getComputedStyle(a, '::after').content);
        // Chromium resolves attr(href); Firefox reports the declared value unresolved.
        const showsUrl = /\[(https:\/\/cedec\.intef\.es\/|" attr\(href\) ")\]/;

        await expect(link).toBeVisible({ timeout: 30000 });
        await expect.poll(afterContent).toMatch(showsUrl);
        await overlay.screenshot({ path: testInfo.outputPath('print-preview-urls-on.png') });

        await linkUrls.uncheck();
        await expect.poll(afterContent, { timeout: 30000 }).toBe('none');
        await overlay.screenshot({ path: testInfo.outputPath('print-preview-urls-off.png') });

        await linkUrls.check();
        await expect.poll(afterContent, { timeout: 30000 }).toMatch(showsUrl);
        await expect(overlay).toHaveAttribute('data-busy', 'false', { timeout: 30000 });

        // Print prints the preview itself — the same document, as the user left it — rather than
        // drawing another one or opening a window.
        const frame = page.frameLocator('.print-preview-iframe');
        await frame.locator('article.box .box-toggle').first().click();
        await expect(frame.locator('article.box').first()).toHaveClass(/minimized/);
        await frame.locator('body').evaluate(() => {
            window.print = () => {
                (window as any).__printedMinimized = !!document.querySelector('article.box.minimized');
            };
        });
        await page.evaluate(() => {
            window.open = () => {
                (window as any).__opened = true;
                return null;
            };
        });
        await page.locator('.print-preview-print-btn').click();
        await expect.poll(() => frame.locator('body').evaluate(() => (window as any).__printedMinimized)).toBe(true);
        expect(await page.evaluate(() => (window as any).__opened)).toBeUndefined();
    });

    test('does not offer link URLs for the worksheet, which has no links to show', async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const projectUuid = await createProject(page, 'Print link URLs worksheet');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        await page.evaluate(() => (window as any).eXeLearning.app.modals.printpreview.show('idevices'));
        const overlay = page.locator('#printPreviewOverlay');
        await expect(overlay).toHaveAttribute('data-visible', 'true');

        await expect(page.locator('#printOptLinkUrls')).toBeDisabled();
    });
});

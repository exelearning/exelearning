import { test, expect } from '../fixtures/auth.fixture';
import { gotoWorkarea, waitForAppReady, selectFirstPage, addIdevice } from '../helpers/workarea-helpers';

/**
 * The "Show link URLs" print option must be visible in the print preview,
 * not only in the printed output, and toggling it must update the preview.
 */
test.describe('Print preview: link URLs option', () => {
    test('shows the link URL in the preview and hides it when unchecked', async ({
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

        const link = page.frameLocator('.print-preview-iframe').locator('a[href="https://cedec.intef.es/"]');
        const afterContent = () => link.evaluate(a => getComputedStyle(a, '::after').content);

        await expect(link).toBeVisible({ timeout: 30000 });
        await expect.poll(afterContent).toBe('" [https://cedec.intef.es/]"');
        await overlay.screenshot({ path: testInfo.outputPath('print-preview-urls-on.png') });

        await page.locator('#printOptLinkUrls').uncheck();
        await expect.poll(afterContent, { timeout: 30000 }).toBe('none');
        await overlay.screenshot({ path: testInfo.outputPath('print-preview-urls-off.png') });

        await page.locator('#printOptLinkUrls').check();
        await expect.poll(afterContent, { timeout: 30000 }).toBe('" [https://cedec.intef.es/]"');
    });
});

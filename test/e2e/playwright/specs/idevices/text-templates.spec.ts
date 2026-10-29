import { test, expect } from '../../fixtures/auth.fixture';
import { waitForAppReady, gotoWorkarea, addTextIdevice } from '../../helpers/workarea-helpers';

/**
 * The "2 videos" TinyMCE template must insert editable media placeholders:
 * selecting one opens the media dialog (not the image one), and nothing in
 * the template is fetched from a remote host.
 */
test.describe('Text iDevice templates', () => {
    test('2 videos template inserts local media placeholders that open the media dialog', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const remoteRequests: string[] = [];
        // Template content only ever lives in the editor and preview iframes,
        // so watch those (the workarea itself may load e.g. a Gravatar avatar).
        page.on('request', request => {
            if (request.frame() === page.mainFrame()) return;
            const { protocol, hostname } = new URL(request.url());
            if (/^https?:$/.test(protocol) && !['localhost', '127.0.0.1'].includes(hostname)) {
                remoteRequests.push(request.url());
            }
        });

        const projectUuid = await createProject(page, '2 videos template test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addTextIdevice(page);
        await page.waitForSelector('.tox-menubar', { timeout: 15000 });

        // Insert the template through the editor's own Insert > Template dialog.
        await page.locator('.tox-menubar .tox-mbtn', { hasText: 'Insert' }).first().click();
        await page
            .locator('.tox-menu .tox-collection__item', { hasText: /Template/i })
            .first()
            .click();
        const templateDialog = page.locator('.tox-dialog');
        await expect(templateDialog).toBeVisible({ timeout: 10000 });
        await templateDialog.locator('select').first().selectOption({ label: '2 videos' });
        await expect(templateDialog.frameLocator('iframe').locator('figure.exe-media video')).toHaveCount(2, {
            timeout: 10000,
        });
        await templateDialog
            .locator('.tox-dialog__footer button', { hasText: /Save|Insert/i })
            .first()
            .click();
        await expect(templateDialog).toBeHidden();

        const editorFrame = page.frameLocator('.tox-edit-area iframe').first();
        const placeholders = editorFrame.locator('figure.exe-media .mce-object-video');
        await expect(placeholders).toHaveCount(2);
        await expect(editorFrame.locator('figure.exe-image')).toHaveCount(0);
        await expect(editorFrame.locator('figure.exe-media figcaption .author').first()).toBeVisible();

        await placeholders.first().click();
        const mediaBtn = page.locator('.tox-tbtn[aria-label*="media" i]').first();
        await expect(mediaBtn).toHaveAttribute('aria-pressed', 'true');
        await mediaBtn.click();

        const dialog = page.locator('.tox-dialog');
        await expect(dialog).toBeVisible({ timeout: 10000 });
        await expect(dialog.locator('.tox-dialog__title')).toHaveText('Insert/Edit Media');
        // The dialog is editing the selected placeholder, not a blank insert.
        await expect(dialog.locator('input').nth(1)).toHaveValue('560');
        // It also read the attribution caption of the selected media figure.
        await dialog.locator('.tox-dialog__body-nav-item', { hasText: 'Title and Attribution' }).click();
        const values = await dialog
            .locator('input:visible')
            .evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
        expect(values).toContain('Author name');
        expect(values).toContain('Video title');

        expect(remoteRequests).toEqual([]);
    });
});

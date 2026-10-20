import { test, expect } from '../../fixtures/auth.fixture';
import { waitForEditor } from '../../helpers/editor-helpers';
import {
    addIdevice,
    editIdevice,
    gotoWorkarea,
    reloadPage,
    saveIdevice,
    saveProject,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

test('Interactive video explains its options inline and keeps the text before the video', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Interactive video option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'interactive-video');
    const device = page.locator('.idevice_node.interactive-video').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await expect(page.locator('#interactiveVideoIdeviceForm-tab-contents')).toHaveAttribute('aria-selected', 'true');
    // The form has no description above its tabs, so the notice of a development
    // version would sit over them.
    const dismissNotice = async () => {
        const notice = page.getByRole('alert').filter({ hasText: 'development version' });
        if (await notice.isVisible()) await notice.getByRole('button', { name: 'Accept' }).click();
    };
    await dismissNotice();

    await page.locator('#interactiveVideoIdeviceForm-tab-options').click();
    const help = page.locator('#interactiveVideoOptions .exe-idevice-help:visible');
    await expect(help).toHaveCount(2);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const button of await help.all()) {
            await button.hover();
            await expect(page.getByRole('tooltip')).toHaveText('Information');
            const sameLine = await button.evaluate(element => {
                const row = element.closest('.d-flex')!;
                const control = row.querySelector('input')!;
                const a = element.getBoundingClientRect();
                const b = control.getBoundingClientRect();
                const previous = element.parentElement!.previousElementSibling!.getBoundingClientRect();
                const gap = a.left - previous.right;
                return a.top < b.bottom && b.top < a.bottom && gap >= 0 && gap <= 24;
            });
            expect(sameLine).toBe(true);
            await button.click();
            await expect(page.getByRole('tooltip')).toHaveCount(0);
            const content = page.locator(`#${await button.getAttribute('aria-controls')}`);
            await expect(content).toBeVisible();
            const fitsInThePanel = await content.evaluate(element => {
                const rect = element.getBoundingClientRect();
                const icon = element.parentElement!.querySelector('button')!.getBoundingClientRect();
                const panel = element.closest('.tab-pane')!.getBoundingClientRect();
                return (
                    Math.abs(rect.left - icon.left) < 2 &&
                    rect.left >= panel.left &&
                    rect.right <= Math.min(panel.right, window.innerWidth) &&
                    element.scrollWidth <= element.clientWidth
                );
            });
            expect(fitsInThePanel).toBe(true);
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }

    // Reading the help, or its open explanation, leaves the option as it was.
    const resultsHelp = page
        .locator('#interactiveVideoOptions .d-flex')
        .filter({ has: page.locator('#interactiveVideoShowResults') })
        .locator('.exe-idevice-help');
    await resultsHelp.click();
    await page.locator(`#${await resultsHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#interactiveVideoShowResults')).toBeChecked();
    await resultsHelp.press('Escape');

    // The text before the video is written in the Instructions tab.
    const write = (editor: string, html: string) =>
        page.evaluate(
            ([editorId, content]) => (window as any).tinymce.get(editorId).setContent(content),
            [editor, html],
        );
    await page.locator('#interactiveVideoIdeviceForm-tab-instructions').click();
    await waitForEditor(page, 'eXeGameInstructions');
    await write('eXeGameInstructions', '<p>Watch carefully</p>');

    await page.locator('#interactiveVideoIdeviceForm-tab-contents').click();
    await page.locator('label[for="interactiveVideoType-youtube"]').click();
    await page.locator('#interactiveVideoYoutubeURL').fill('https://www.youtube.com/watch?v=g9gPKSGGkEk');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('interactive-video');
    expect(stored.html).toContain('<div class="exe-interactive-video-content-before"><p>Watch carefully</p></div>');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await dismissNotice();

    await expect(page.locator('#interactiveVideoType-youtube')).toBeChecked();
    await expect(page.locator('#interactiveVideoYoutubeURL')).toHaveValue(
        'https://www.youtube.com/watch?v=g9gPKSGGkEk',
    );
    await page.locator('#interactiveVideoIdeviceForm-tab-instructions').click();
    await waitForEditor(page, 'eXeGameInstructions');
    expect(await page.evaluate(() => (window as any).tinymce.get('eXeGameInstructions').getContent())).toBe(
        '<p>Watch carefully</p>',
    );
});

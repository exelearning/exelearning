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

test('UDL content explains its type inline and keeps it with its blocks and texts', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'UDL content option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    // The form has no description above its tabs, so the notice of a development
    // version would sit over them.
    const dismissNotice = async () => {
        const notice = page.getByRole('alert').filter({ hasText: 'development version' });
        if (await notice.isVisible()) await notice.getByRole('button', { name: 'Accept' }).click();
    };
    await dismissNotice();
    await addIdevice(page, 'udl-content');
    const device = page.locator('.idevice_node.udl-content').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();
    await waitForEditor(page, 'udlContentFormTxt-0');
    await expect(page.locator('#udlContentEditorWrapper-tab-contents')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-exe-share]')).toHaveCount(0);

    // The type leads the blocks in Activities, as in main: there is no Options tab.
    await expect(page.locator('#udlContentEditorWrapper-tabs [data-exe-tab]')).toHaveCount(2);
    await expect(page.locator('#udlContentEditorWrapper-panel-contents #udlContentTypeOptions')).toBeVisible();
    const help = page.locator('#udlContentTypeOptions .exe-idevice-help');
    await expect(help).toHaveCount(1);
    for (const width of [1280, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await help.hover();
        await expect(page.getByRole('tooltip')).toHaveText('Information');
        const sameLine = await help.evaluate(element => {
            const row = element.closest('#udlContentTypeOptions')!;
            const control = row.querySelector('input')!;
            const a = element.getBoundingClientRect();
            const b = control.getBoundingClientRect();
            const previous = element.parentElement!.previousElementSibling!.getBoundingClientRect();
            const gap = a.left - previous.right;
            return a.top < b.bottom && b.top < a.bottom && gap >= 0 && gap <= 24;
        });
        expect(sameLine).toBe(true);
        await help.click();
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        const content = page.locator(`#${await help.getAttribute('aria-controls')}`);
        await expect(content).toBeVisible();
        const fitsInThePanel = await content.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const panel = element.closest('.tab-pane')!.getBoundingClientRect();
            return (
                rect.left >= panel.left &&
                rect.right <= Math.min(panel.right, window.innerWidth) &&
                element.scrollWidth <= element.clientWidth
            );
        });
        expect(fitsInThePanel).toBe(true);
        // Reading the explanation leaves the type as it was.
        await content.click();
        await expect(page.locator('#udlContentType-engagement')).toBeChecked();
        await help.press('Escape');
        await expect(content).toBeHidden();
    }

    await page.locator('label[for="udlContentType-expression"]').click();
    await expect(page.locator('label[for="udlContentType-expression"]')).toHaveClass(/active/);

    await page.locator('#udlContentEditorWrapper-tab-texts').click();
    await page.locator('#ci18n_simplified').fill('Plain words');

    await page.locator('#udlContentEditorWrapper-tab-contents').click();
    await page.evaluate(() => (window as any).tinymce.get('udlContentFormTxt-0').setContent('<p>The main text</p>'));
    await page.locator('#udlContentFormTabs-0 .udl-a-1').click();
    await expect(page.locator('#udlContentFormTabs-0 .udl-a-1')).toHaveClass(/active/);
    await page.evaluate(() => (window as any).tinymce.get('udlContentFormTxt-0').setContent('<p>The easy text</p>'));
    await page.locator('#udlContentFormBlockButtonTxt-0').fill('Read more');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return component.htmlContent as string;
    }, id!);
    expect(stored).toContain('exe-udlContent-expression');
    expect(stored).toContain('<h2>Plain words</h2>');
    expect(stored).toContain('The easy text');
    expect(stored).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await dismissNotice();
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await waitForEditor(page, 'udlContentFormTxt-0');
    await expect(page.locator('#udlContentFormBlockButtonTxt-0')).toHaveValue('Read more');
    await expect
        .poll(() => page.evaluate(() => (window as any).tinymce.get('udlContentFormTxt-0').getContent()))
        .toContain('The main text');
    await expect(page.locator('#udlContentType-expression')).toBeChecked();
    await page.locator('#udlContentEditorWrapper-tab-texts').click();
    await expect(page.locator('#ci18n_simplified')).toHaveValue('Plain words');
});

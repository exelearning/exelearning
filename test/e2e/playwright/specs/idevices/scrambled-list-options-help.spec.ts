import { test, expect } from '../../fixtures/auth.fixture';
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

test('Scrambled list explains its options inline and imports its elements', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Scrambled list option help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'scrambled-list');
    const device = page.locator('.idevice_node.scrambled-list').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    await page.locator('#scrambledlistIdeviceForm-tab-options').click();
    const help = page.locator('#sortableListOptions .exe-idevice-help:visible');
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
                const panel = element.closest('.tab-pane')!.getBoundingClientRect();
                return (
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
    const solutionsHelp = page
        .locator('#sortableListOptions .d-flex')
        .filter({ has: page.locator('#sortableShowSolutions') })
        .locator('.exe-idevice-help');
    await solutionsHelp.click();
    await page.locator(`#${await solutionsHelp.getAttribute('aria-controls')}`).click();
    await expect(page.locator('#sortableShowSolutions')).toBeChecked();
    await solutionsHelp.press('Escape');
    await page.locator('#sortableShowSolutions').uncheck();
    await page.locator('#sortableAttemptsNumber').fill('3');

    // Import a real text file: its list replaces the elements.
    await page.locator('#scrambledlistIdeviceForm-tab-contents').click();
    await page.locator('[data-exe-share="import"]').click();
    await page.locator('#eXeGameImportGame').setInputFiles({
        name: 'list.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Wake up#Have breakfast#Go to school\n'),
    });
    await expect(page.locator('#eXeShareModal-import')).toBeHidden();
    await expect(page.locator('#sortableListFormList0')).toHaveValue('Wake up');
    await expect(page.locator('#sortableListFormList2')).toHaveValue('Go to school');

    // The AI window does the same with the lines it is given.
    await page.locator('[data-exe-share="ai"]').click();
    await page.locator('#eXeETabQuestions').click();
    await page.locator('#eXeEQuestionsArea').fill('Seed#Sprout#Plant#Flower');
    await page.locator('#eXeESaveButton').click();
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText('The questions have been added successfully');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
    await expect(page.locator('#sortableListFormList3')).toHaveValue('Flower');

    await saveIdevice(page, id!);
    await expect(page.getByRole('tooltip')).toHaveCount(0);

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);

    await expect(page.locator('#sortableListFormList0')).toHaveValue('Seed');
    await page.locator('#scrambledlistIdeviceForm-tab-options').click();
    await expect(page.locator('#sortableShowSolutions')).not.toBeChecked();
    await expect(page.locator('#sortableAttemptsNumber')).toHaveValue('3');
});

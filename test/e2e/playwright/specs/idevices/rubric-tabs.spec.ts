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

test('Rubric lays its form out in the shared tabs and keeps CSV import and export in a tab of its own', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Rubric tabs');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'rubric');
    const device = page.locator('.idevice_node.rubric').first();
    const id = await device.getAttribute('id');
    expect(id).toBeTruthy();

    const tabs = page.locator('#ri_IdeviceForm-tabs [data-exe-tab]');
    await expect(tabs).toHaveCount(6);
    await expect(page.locator('#ri_IdeviceForm-tab-contents')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#ri_IdeviceForm-tab-contents')).toHaveText('Activities');
    await expect(page.locator('#ri_IdeviceForm-panel-contents #ri_CreateNewRubric')).toBeVisible();

    // Import a CSV from its own tab: the rubric is shown in Activities. The
    // tab opens with its message as plain text, without a box.
    await page.locator('#ri_IdeviceForm-tab-csv').click();
    const info = page.locator('#ri_IdeviceForm-panel-csv > p').first();
    await expect(info).toContainText('You can import rubric data from CSV files.');
    await expect(page.locator('#ri_IdeviceForm-panel-csv .alert')).toHaveCount(0);
    await page.locator('#ri_CsvFile').setInputFiles({
        name: 'rubric.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Criterion,Description,Good,Poor\nVoice,Speaks to the class,Clear,Unclear\n'),
    });
    const alert = page.locator('#modalAlert.show');
    await expect(alert).toContainText('CSV imported successfully.');
    await alert.locator('.close').first().click();
    await expect(alert).toBeHidden();
    await page.locator('#ri_IdeviceForm-tab-contents').click();
    await expect(page.locator('#ri_Table thead th input[type="text"]').nth(1)).toHaveValue('Good');
    await expect(page.locator('#ri_Table tbody th input[type="text"]').first()).toHaveValue('Voice');

    // Export writes the rubric on screen.
    await page.locator('#ri_IdeviceForm-tab-csv').click();
    const downloading = page.waitForEvent('download');
    await page.locator('#ri_ExportCsv').click();
    const download = await downloading;
    const stream = await download.createReadStream();
    let exported = '';
    for await (const chunk of stream) exported += chunk.toString();
    expect(exported).toContain('Voice');
    expect(exported).toContain('Clear');

    await page.locator('#ri_IdeviceForm-tab-contents').click();
    await page.locator('#ri_Table caption input[type="text"]').first().fill('Oral presentation');
    await saveIdevice(page, id!);
    const stored = await page.evaluate(componentId => {
        const component = (window as any).eXeLearning.app.project._yjsBridge.structureBinding.getComponent(componentId);
        return { type: component.ideviceType, html: component.htmlContent };
    }, id!);
    expect(stored.type).toBe('rubric');
    expect(stored.html).toContain('exe-rubrics-DataGame');
    expect(stored.html).not.toContain('exe-idevice-help');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id!);
    await expect(page.locator('#ri_IdeviceForm-tab-contents')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#ri_Table caption input[type="text"]').first()).toHaveValue('Oral presentation');
    await expect(page.locator('#ri_Table tbody th input[type="text"]').first()).toHaveValue('Voice');
});

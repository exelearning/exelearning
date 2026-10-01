import { test, expect } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    editIdevice,
    expandIdeviceCategory,
    getPreviewFrame,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';

for (const device of [
    { name: '3dmol', form: '#dMoleIdeviceForm' },
    { name: 'electrical-circuits', form: '#electricalCircuitsIdeviceForm' },
]) {
    test(`${device.name} opens progress report help without changing report settings`, async ({
        authenticatedPage: page,
        createProject,
    }) => {
        const uuid = await createProject(page, `${device.name} progress report help`);
        await gotoWorkarea(page, uuid);
        await waitForAppReady(page);
        await selectFirstPage(page);
        if (device.name === '3dmol') {
            // The generic helper uses a class selector, which cannot start with a digit.
            await expandIdeviceCategory(page, /Science|Ciencia/i);
            await page.locator('.idevice_item[id="3dmol"]').click();
            await expect(page.locator('#dmoleModelFileName')).not.toBeEmpty({ timeout: 20000 });
        } else {
            await addIdevice(page, device.name);
        }
        const form = page.locator(device.form);
        await form
            .locator('.exe-form-tabs a')
            .filter({ hasText: /^Grading$/ })
            .click();
        const report = form.locator('#eXeProgressReport');
        const identifier = form.locator('#eXeProgressReportID');
        const help = form.locator('#eXeProgressReportHelp');
        const link = form.locator('#eXeProgressReportHelpLnk');
        const reportId = await identifier.inputValue();

        for (const enabled of [false, true]) {
            await report.setChecked(enabled);
            await expect(help).toBeHidden();
            await link.locator('img').click();
            await expect(help).toBeVisible();
            await link.click();
            await expect(help).toBeHidden();
            await expect(report).toBeChecked({ checked: enabled });
            await expect(identifier).toBeEnabled({ enabled });
            await expect(identifier).toHaveValue(reportId);
        }
    });
}

test('rubric reports its custom pass mark in the workarea and preview', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'Rubric progress report');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'rubric');
    await page.locator('#ri_CreateNewRubric').click();
    await expect(page.locator('#ri_Table')).toBeVisible();
    const rubric = page.locator('#node-content .idevice_node.rubric');
    const rubricId = (await rubric.getAttribute('id'))!;
    const rows = page.locator('#ri_Table tbody tr');
    for (let index = 0; index < (await rows.count()); index++) {
        await rows.nth(index).locator('input.ri_Weight').nth(0).fill('4');
        await rows.nth(index).locator('input.ri_Weight').nth(1).fill('3');
    }
    await page
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Grading$/ })
        .click();
    await page.locator('#eXeProgressReport').check();
    const reportId = await page.locator('#eXeProgressReportID').inputValue();
    await page.locator('#eXePassScoreCustom').check();
    await page.locator('#eXePassScoreValue').fill('8');
    await saveIdevice(page, rubricId);
    await expect(rubric.locator('.Games-ReportIconDiv')).toBeVisible();
    await expect
        .poll(() =>
            rubric
                .locator('.Games-ReportIconDiv img')
                .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);

    await addIdevice(page, 'progress-report');
    await expect(page.locator('#informeEEvaluationID')).toHaveValue(reportId);
    await expect(page.locator(`#informeEPages [data-component-id="${rubricId}"]`)).toHaveAttribute(
        'data-is-evaluable',
        'true',
    );
    const reportNodeId = (await page.locator('#node-content .idevice_node.progress-report').getAttribute('id'))!;
    await saveIdevice(page, reportNodeId);

    expect(await waitForPreviewContent(page, 30000)).toBe(true);
    const frame = getPreviewFrame(page);
    const previewRubric = frame.locator('.idevice_node.rubric');
    await previewRubric.waitFor({ state: 'visible', timeout: 30000 });
    const previewRows = previewRubric.locator('tbody tr');
    await expect(previewRows.first().locator('input[type="checkbox"]').nth(1)).toBeVisible();
    for (let index = 0; index < (await previewRows.count()); index++) {
        await previewRows.nth(index).locator('input[type="checkbox"]').nth(1).check();
    }
    await expect(previewRubric.locator('.Games-ReportIconDiv')).toContainText('7.50');
    await expect(previewRubric.locator('.Games-ReportIconDiv img')).toHaveAttribute('src', /exequextrerrors\.svg$/);
    await expect
        .poll(() =>
            previewRubric
                .locator('.Games-ReportIconDiv img')
                .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
    const reportRow = frame.locator(`.IFPP-ComponentItem[data-component-id="${rubricId}"]`);
    await expect(reportRow).toHaveAttribute('data-is-evaluable', 'true');
    await expect(reportRow.locator('.IFPP-ComponentScore')).toHaveText('7.50');
    await expect(reportRow.locator('.IFPP-IdiviceIconFail')).toBeVisible();

    for (let index = 0; index < (await previewRows.count()); index++) {
        await previewRows.nth(index).locator('input[type="checkbox"]').first().check();
    }
    await expect(previewRubric.locator('.Games-ReportIconDiv')).toContainText('10.00');
    await expect(previewRubric.locator('.Games-ReportIconDiv img')).toHaveAttribute('src', /exequexthits\.svg$/);
    await expect
        .poll(() =>
            previewRubric
                .locator('.Games-ReportIconDiv img')
                .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
    await expect(reportRow.locator('.IFPP-ComponentScore')).toHaveText('10');
    await expect(reportRow.locator('.IFPP-IdiviceIconPass')).toBeVisible();
});

test('new true-or-false activities offer a report only in test mode', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const uuid = await createProject(page, 'True or false report availability');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'trueorfalse');
    const nodeId = (await page.locator('#node-content .idevice_node.trueorfalse').getAttribute('id'))!;
    await expect(page.locator('#tofEIsTest')).not.toBeChecked();
    await page
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Grading$/ })
        .click();
    await expect(page.locator('.exe-progress-report-wrapper')).toBeHidden();

    await page.locator('.exe-form-tabs a').first().click();
    await page.getByRole('link', { name: 'Options', exact: true }).click();
    await page.locator('#tofEIsTest').check();
    await page.waitForFunction(() => (window as any).tinymce?.get('tofEQuestionEditor')?.initialized);
    await page.evaluate(() =>
        (window as any).tinymce.get('tofEQuestionEditor').setContent('<p>The Earth is a planet.</p>'),
    );
    await page
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Grading$/ })
        .click();
    await expect(page.locator('.exe-progress-report-wrapper')).toBeVisible();
    await page.locator('#eXeProgressReport').check();
    const reportId = await page.locator('#eXeProgressReportID').inputValue();
    await saveIdevice(page, nodeId);

    await editIdevice(page, nodeId);
    await expect(page.locator('#tofEIsTest')).toBeChecked();
    await page
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Grading$/ })
        .click();
    await expect(page.locator('.exe-progress-report-wrapper')).toBeVisible();
    await expect(page.locator('#eXeProgressReport')).toBeChecked();
    await expect(page.locator('#eXeProgressReportID')).toHaveValue(reportId);
    await page.locator('.exe-form-tabs a').first().click();
    await page.getByRole('link', { name: 'Options', exact: true }).click();
    await page.locator('#tofEIsTest').uncheck();
    await page
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Grading$/ })
        .click();
    await expect(page.locator('.exe-progress-report-wrapper')).toBeHidden();
    await saveIdevice(page, nodeId);
    expect(await waitForPreviewContent(page, 30000)).toBe(true);
    const activity = getPreviewFrame(page).locator('.idevice_node.trueorfalse');
    await expect(activity).toBeVisible({ timeout: 30000 });
    await expect(activity.locator('.Games-ReportIconDiv')).toHaveCount(0);
});

test('true-or-false tells the learner its minimum score, in quiz mode only', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(150000);
    const uuid = await createProject(page, 'True or false minimum score notice');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'trueorfalse');
    const nodeId = (await page.locator('#node-content .idevice_node.trueorfalse').getAttribute('id'))!;
    const form = page.locator('#trueorfalseIdeviceForm');
    const optionsTab = async () => {
        await form.locator('.exe-form-tabs a').first().click();
        await form.getByRole('link', { name: 'Options', exact: true }).click();
    };

    await optionsTab();
    await page.locator('#tofEIsTest').check();
    await page.waitForFunction(() => (window as any).tinymce?.get('tofEQuestionEditor')?.initialized);
    await page.evaluate(() =>
        (window as any).tinymce.get('tofEQuestionEditor').setContent('<p>The Earth is a planet.</p>'),
    );
    await form
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Grading$/ })
        .click();
    await page.locator('#eXeProgressReport').check();
    await page.locator('#eXePassScoreCustom').check();
    await page.locator('#eXePassScoreValue').fill('7');
    await saveIdevice(page, nodeId);

    // Below the instructions, right above the activity.
    const activity = page.locator('#node-content .idevice_node.trueorfalse');
    const notice = activity.locator('.exe-pass-score-notice');
    await expect(notice).toHaveText('Minimum score needed to pass this activity: 7');
    await expect(notice).toHaveClass(/text-danger/);
    await expect(notice).toHaveClass(/text-center/);
    expect(await notice.evaluate(element => element.nextElementSibling?.id)).toBe(`tofPMainContainer-${nodeId}`);
    expect(await notice.evaluate(element => element.previousElementSibling?.className)).toContain('TOFP-instructions');

    // Outside quiz mode nothing judges the mark, so nothing announces it.
    await editIdevice(page, nodeId);
    await optionsTab();
    await page.locator('#tofEIsTest').uncheck();
    await saveIdevice(page, nodeId);
    await expect(activity.locator('#tofPMainContainer-' + nodeId)).toBeVisible();
    await expect(activity.locator('.exe-pass-score-notice')).toHaveCount(0);

    // Saving outside quiz mode also saved the report as off, and without its
    // identifier, so back in quiz mode the author turns it on and names it again
    // before anything judges the mark.
    await editIdevice(page, nodeId);
    await optionsTab();
    await page.locator('#tofEIsTest').check();
    await form
        .locator('.exe-form-tabs a')
        .filter({ hasText: /^Grading$/ })
        .click();
    await page.locator('#eXeProgressReport').check();
    await page.locator('#eXeProgressReportID').fill('tof-report');
    await saveIdevice(page, nodeId);
    await expect(notice).toHaveText('Minimum score needed to pass this activity: 7');

    expect(await waitForPreviewContent(page, 30000)).toBe(true);
    await expect(getPreviewFrame(page).locator('.idevice_node.trueorfalse .exe-pass-score-notice')).toHaveText(
        'Minimum score needed to pass this activity: 7',
        { timeout: 30000 },
    );
});

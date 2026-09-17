import { test, expect } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    editIdevice,
    getPreviewFrame,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
    waitForPreviewContent,
} from '../../helpers/workarea-helpers';

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

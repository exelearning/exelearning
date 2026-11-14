import { test, expect } from '../../fixtures/auth.fixture';
import {
    addIdevice,
    editIdevice,
    gotoWorkarea,
    saveIdevice,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';

/**
 * The Grading tab of the iDevice forms: SCORM, Progress report and Minimum score to pass the activity are groups
 * that fold (common.getGroup). A new activity shows SCORM unfolded and the other two folded; reopened, a group also
 * unfolds when the activity has something of its own in it. Checked on Math operations, which saves without
 * anything to fill in.
 */
test('The groups of Grading fold and unfold, and a warning unfolds the group of its field', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Grading groups');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'mathematicaloperations');
    const id = await page.locator('.idevice_node.mathematicaloperations').first().getAttribute('id');
    expect(id).toBeTruthy();
    const grading = page.locator('#gameQEIdeviceForm-panel-grading');
    const gradingTab = page.locator('#gameQEIdeviceForm-tab-grading');
    await gradingTab.click();

    // Each one is a group named by its title. In a new activity, only SCORM is unfolded.
    const toggle = (name: string) => grading.getByRole('button', { name, exact: true });
    const scorm = toggle('SCORM');
    const report = toggle('Progress report');
    const passScore = toggle('Minimum score to pass the activity');
    for (const [name, expanded] of [
        ['SCORM', 'true'],
        ['Progress report', 'false'],
        ['Minimum score to pass the activity', 'false'],
    ]) {
        await expect(grading.getByRole('group', { name, exact: true })).toBeVisible();
        await expect(toggle(name)).toHaveAttribute('aria-expanded', expanded);
    }
    const noSave = page.locator('#eXeGameSCORMNoSave');
    const reportSwitch = page.locator('#eXeProgressReport');
    await expect(noSave).toBeVisible();
    await expect(reportSwitch).toBeHidden();
    await expect(page.locator('#eXePassScoreGlobal')).toBeHidden();

    // A click unfolds one, and only that one; another folds it.
    await passScore.click();
    await expect(passScore).toHaveAttribute('aria-expanded', 'true');
    await expect(grading.getByRole('radiogroup', { name: 'Minimum score to pass the activity' })).toBeVisible();
    await expect(reportSwitch).toBeHidden();
    await passScore.click();
    await expect(page.locator('#eXePassScoreGlobal')).toBeHidden();
    // And so do Enter and Space.
    await scorm.press('Enter');
    await expect(scorm).toHaveAttribute('aria-expanded', 'false');
    await expect(noSave).toBeHidden();
    await scorm.press('Space');
    await expect(noSave).toBeVisible();
    await expect(noSave).toBeChecked();

    // The report on with too short an identifier, its group folded, and saved from another tab, as an author does.
    await report.click();
    await reportSwitch.check();
    await page.locator('#eXeProgressReportID').fill('abc');
    await report.click();
    await expect(page.locator('#eXeProgressReportID')).toBeHidden();
    await page.locator('#gameQEIdeviceForm-tab-options').click();
    await page.locator(`.idevice_node[id="${id}"] .btn-save-idevice`).click();
    const alert = page.locator('.modal.show');
    await expect(alert).toContainText('The report identifier must have at least 5 characters');
    await alert.getByRole('button', { name: 'Accept' }).click();
    // Behind the warning, the field: its tab shown and its group unfolded.
    await expect(gradingTab).toHaveAttribute('aria-selected', 'true');
    await expect(report).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#eXeProgressReportID')).toBeVisible();
    await expect(page.locator('#eXeProgressReportID')).toHaveValue('abc');

    // Saved with the report on and the project's mark: reopened, the report shows and the mark stays folded.
    await page.locator('#eXeProgressReportID').fill('grading-groups');
    await saveIdevice(page, id!);
    await editIdevice(page, id!);
    await gradingTab.click();
    await expect(scorm).toHaveAttribute('aria-expanded', 'true');
    await expect(report).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#eXeProgressReportID')).toHaveValue('grading-groups');
    await expect(passScore).toHaveAttribute('aria-expanded', 'false');

    // With a mark of its own, the mark shows too.
    await passScore.click();
    await page.locator('#eXePassScoreCustom').check();
    await page.locator('#eXePassScoreValue').fill('7');
    await saveIdevice(page, id!);
    await editIdevice(page, id!);
    await gradingTab.click();
    await expect(passScore).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#eXePassScoreValue')).toHaveValue('7');
});

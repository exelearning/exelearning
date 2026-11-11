import type { Page } from '@playwright/test';
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
import { waitForEditor } from '../../helpers/editor-helpers';
import { exportText } from '../../helpers/idevice-share-helpers';

/**
 * The Feedback tab of the iDevice forms (gamification.feedback): the feedback on needs its message. An activity saved
 * with the feedback on and no message, which gave its learners an empty box, opens with the feedback off.
 */

type CreateProject = (page: Page, title: string) => Promise<string>;

/** Add a Math operations iDevice, which saves without anything to fill in, and open its Feedback tab. */
async function addActivity(page: Page, createProject: CreateProject, title: string): Promise<string> {
    const uuid = await createProject(page, title);
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'mathematicaloperations');
    const id = await page.locator('.idevice_node.mathematicaloperations').first().getAttribute('id');
    expect(id).toBeTruthy();
    await page.locator('#gameQEIdeviceForm-tab-feedback').click();
    await waitForEditor(page, 'eXeGameFeedBackEditor');
    return id!;
}

test('An activity saved with the feedback on and no message opens with the feedback off', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const id = await addActivity(page, createProject, 'Feedback saved without a message');
    const feedback = page.locator('#eXeGameHasFeedBack');
    await feedback.check();
    await page.frameLocator('#eXeGameFeedBackEditor_ifr').locator('body').fill('Well done');
    await saveIdevice(page, id);

    // Leave it as older versions could save it: the feedback on, with an empty message.
    const saved = await page.evaluate(componentId => {
        const binding = (window as any).eXeLearning.app.project._yjsBridge.structureBinding;
        const html = binding.getComponent(componentId).htmlContent.toString();
        const emptied = html.replace(/(<div class="mathoperations-feedback-game">)[\s\S]*?(<\/div>)/, '$1$2');
        binding.updateComponent(componentId, { htmlContent: emptied });
        return emptied;
    }, id);
    expect(saved).toContain('<div class="mathoperations-feedback-game"></div>');
    expect(saved).toContain('"feedBack":true');

    await saveProject(page);
    await reloadPage(page);
    await selectFirstPage(page);
    await editIdevice(page, id);
    await page.locator('#gameQEIdeviceForm-tab-feedback').click();
    await expect(feedback).not.toBeChecked();
    await expect(page.locator('#eXeGamePercentajeFB')).toBeDisabled();

    // It saves as it is, now with the feedback off.
    await saveIdevice(page, id);
    const stored = await page.evaluate(
        componentId =>
            (window as any).eXeLearning.app.project._yjsBridge.structureBinding
                .getComponent(componentId)
                .htmlContent.toString(),
        id,
    );
    expect(stored).toContain('"feedBack":false');
});

test('The feedback the author switches on asks for its message when saving, on its own tab', async ({
    authenticatedPage: page,
    createProject,
}) => {
    test.setTimeout(120000);
    const id = await addActivity(page, createProject, 'Feedback switched on without a message');
    await page.locator('#eXeGameHasFeedBack').check();
    // Saved from another tab, as an author does.
    const feedbackTab = page.locator('#gameQEIdeviceForm-tab-feedback');
    await page.locator('#gameQEIdeviceForm-tab-contents').click();
    await expect(feedbackTab).toHaveAttribute('aria-selected', 'false');

    await page.locator(`.idevice_node[id="${id}"] .btn-save-idevice`).click();

    const alert = page.locator('.modal.show');
    await expect(alert).toContainText('Message to display when passing the game');
    await alert.getByRole('button', { name: 'Accept' }).click();
    await expect(page.locator(`.idevice_node[id="${id}"] .btn-save-idevice`)).toBeVisible();
    await expect(page.locator('#eXeGameHasFeedBack')).toBeChecked();
    // Behind the warning, the tab where the message is written.
    await expect(feedbackTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#eXeGameFeedbackP')).toBeVisible();
});

test('Export saves the questions while the feedback has no message, and stays on its tab', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Export with the feedback unfinished');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'guess');
    // The form is built when its question editor starts: wait, or what is typed first is lost.
    await waitForEditor(page, 'adivinaEText');
    await page.locator('#adivinaESolutionWord').fill('planet');
    await page.locator('#adivinaEDefinitionWord').fill('A world orbiting a star');

    // The feedback on, its message still to write: saving would ask for it.
    await page.locator('#gameQEIdeviceForm-tab-feedback').click();
    await waitForEditor(page, 'eXeGameFeedBackEditor');
    await page.locator('#eXeGameHasFeedBack').check();

    // Export writes the questions only, so the feedback is none of its business.
    const activities = page.locator('#gameQEIdeviceForm-tab-contents');
    await activities.click();
    expect(await exportText(page)).toBe('planet#A world orbiting a star');
    await expect(page.locator('#modalAlert.show')).toHaveCount(0);
    await expect(activities).toHaveAttribute('aria-selected', 'true');
});

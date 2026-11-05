import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';
import { waitForEditor } from '../../helpers/editor-helpers';

/**
 * The Create with AI window of the iDevice forms (gamification.share): its Prompt and Questions are tabs with the
 * WAI-ARIA tabs pattern, each showing its own text box and buttons. Its Generate tab is hidden for now.
 */
test('The tabs of the Create with AI window are accessible and work with the keyboard', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Create with AI tabs');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'guess');
    await waitForEditor(page, 'adivinaEText');

    await page.locator('[data-exe-share="ai"]').click();
    const ai = page.locator('#eXeShareModal-ai');
    await expect(ai).toBeVisible();
    const prompt = ai.getByRole('tab', { name: 'Prompt' });
    const questions = ai.getByRole('tab', { name: 'Questions' });
    await expect(ai.getByRole('tab')).toHaveCount(2);
    await expect(prompt).toHaveAttribute('aria-selected', 'true');
    await expect(ai.getByRole('tabpanel', { name: 'Prompt' }).getByRole('textbox', { name: 'Prompt' })).toBeVisible();
    await expect(ai.getByRole('button', { name: 'Send to AI' })).toBeVisible();
    await expect(ai.getByRole('button', { name: 'Save' })).toBeHidden();

    await prompt.focus();
    await page.keyboard.press('ArrowRight');
    await expect(questions).toBeFocused();
    await expect(questions).toHaveAttribute('aria-selected', 'true');
    await expect(prompt).toHaveAttribute('tabindex', '-1');
    await expect(
        ai.getByRole('tabpanel', { name: 'Questions' }).getByRole('textbox', { name: 'Questions' }),
    ).toBeVisible();
    await expect(ai.getByRole('textbox', { name: 'Prompt' })).toBeHidden();
    await expect(ai.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(ai.getByRole('button', { name: 'Send to AI' })).toBeHidden();

    // The hidden Generate tab is skipped: the keyboard goes round the two tabs.
    await page.keyboard.press('ArrowRight');
    await expect(prompt).toBeFocused();
    await expect(prompt).toHaveAttribute('aria-selected', 'true');
});

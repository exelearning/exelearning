import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';
import { waitForEditor } from '../../helpers/editor-helpers';

/**
 * The share windows of the iDevice forms (gamification.share). The buttons that open Import, Export and Create with
 * AI are a plain row, each one reached with Tab. In the Create with AI window, Prompt and Questions are tabs with the
 * WAI-ARIA tabs pattern, each showing its own text box and buttons. Its Generate tab is hidden for now.
 */
test('The buttons that open Import, Export and Create with AI are each reached with Tab', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const uuid = await createProject(page, 'Share buttons');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'guess');
    await waitForEditor(page, 'adivinaEText');

    const tools = page.locator('.exe-share-tools');
    await expect(tools).toBeVisible();
    await expect(tools).not.toHaveAttribute('role');
    const importButton = tools.getByRole('button', { name: 'Import' });
    const exportButton = tools.getByRole('button', { name: 'Export' });
    const aiButton = tools.getByRole('button', { name: 'Create with AI' });

    await importButton.focus();
    await page.keyboard.press('Tab');
    await expect(exportButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(aiButton).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(exportButton).toBeFocused();
    // No arrow keys: they belong to a toolbar, and these buttons are not one.
    await page.keyboard.press('ArrowRight');
    await expect(exportButton).toBeFocused();
});

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

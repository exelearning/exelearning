import type { Locator } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';
import { waitForEditor } from '../../helpers/editor-helpers';

/**
 * The share windows of the iDevice forms (gamification.share). The buttons that open Import, Export and Create with
 * AI are a plain row above the message of Activities, each one reached with Tab. In the Create with AI window, Prompt
 * and Questions are tabs with the WAI-ARIA tabs pattern, each showing its own text box and buttons, laid out as in the
 * Share dialog. Its Generate tab is hidden for now.
 */
test('The Import, Export and Create with AI buttons are each reached with Tab', async ({
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

    // They open the tab, above its message, so they sit in the same place in every iDevice.
    const panel = page.locator('#gameQEIdeviceForm-panel-contents');
    await expect(panel.locator(':scope > *').first()).toHaveClass(/\bexe-share-tools\b/);
    // Import and Export, the input and output of the same file, are a pair; Create with AI stands apart.
    await expect(tools.locator('.btn-group > button')).toHaveText([/Import/, /Export/]);
    await expect(tools.locator(':scope > .exe-share-ai')).toHaveText(/Create with AI/);

    // No tooltip: it would only repeat the labels.
    await importButton.focus();
    await page.keyboard.press('Tab');
    await expect(exportButton).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(aiButton).toBeFocused();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
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

    // As in the Share dialog, the AI picker is joined to Send to AI, and the buttons are all of one height.
    const box = async (locator: Locator) => {
        const found = await locator.boundingBox();
        expect(found).not.toBeNull();
        return found!;
    };
    const [copy, picker, send] = await Promise.all(
        [
            ai.getByRole('button', { name: 'Copy' }),
            ai.locator('.input-group').getByRole('combobox', { name: 'AI assistant' }),
            ai.locator('.input-group').getByRole('button', { name: 'Send to AI' }),
        ].map(box),
    );
    expect(Math.abs(picker.x + picker.width - send.x)).toBeLessThanOrEqual(1);
    expect(new Set([copy.height, picker.height, send.height]).size).toBe(1);

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
    expect((await box(ai.getByRole('button', { name: 'Save' }))).height).toBe(send.height);
    await expect(ai.getByRole('button', { name: 'Send to AI' })).toBeHidden();
    await expect(ai.getByRole('combobox')).toBeHidden();

    // The hidden Generate tab is skipped: the keyboard goes round the two tabs.
    await page.keyboard.press('ArrowRight');
    await expect(prompt).toBeFocused();
    await expect(prompt).toHaveAttribute('aria-selected', 'true');
});

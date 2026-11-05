import { test, expect } from '../../fixtures/auth.fixture';
import type { Page } from '@playwright/test';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';
import { waitForEditor } from '../../helpers/editor-helpers';

/**
 * The shared help of the iDevice forms (common.getHelpTooltip), checked once on Guess, whose Options tab has
 * ten of them. Each iDevice's own spec checks where its help sits and that reading it leaves its options alone.
 */
async function openGuessOptions(page: Page, createProject: (page: Page, title: string) => Promise<string>) {
    const uuid = await createProject(page, 'Shared iDevice help');
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, 'guess');
    // The form is built when its question editor starts.
    await waitForEditor(page, 'adivinaEText');
    await page.locator('#gameQEIdeviceForm-tab-options').click();
    return page.locator('#adivinaEOptions .exe-idevice-help:visible');
}

test('An open help stays under the modals and their backdrop', async ({ authenticatedPage: page, createProject }) => {
    const help = (await openGuessOptions(page, createProject)).first();
    await help.click();
    const content = page.locator(`#${await help.getAttribute('aria-controls')}`);
    await expect(content).toBeVisible();
    const layers = await content.evaluate(element => {
        const zIndex = (className: string) => {
            const probe = document.createElement('div');
            probe.className = className;
            document.body.appendChild(probe);
            const value = Number(getComputedStyle(probe).zIndex);
            probe.remove();
            return value;
        };
        return { help: Number(getComputedStyle(element).zIndex), backdrop: zIndex('modal-backdrop') };
    });
    expect(layers.backdrop).toBeGreaterThan(0);
    expect(layers.help).toBeLessThan(layers.backdrop);
});

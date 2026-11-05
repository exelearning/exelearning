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

test('An open help keeps its width near the right edge, also on a phone', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const help = await openGuessOptions(page, createProject);
    let moved = 0;
    for (const width of [1024, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const button of await help.all()) {
            await button.click();
            const content = page.locator(`#${await button.getAttribute('aria-controls')}`);
            await expect(content).toBeVisible();
            const fit = await content.evaluate(element => {
                const rect = element.getBoundingClientRect();
                const icon = element.parentElement!.getBoundingClientRect();
                const pane = element.closest('.tab-pane')!;
                const panel = pane.getBoundingClientRect();
                // The part of the panel on screen: the window and the scrolling boxes around it cut it.
                let left = Math.max(0, panel.left);
                let right = Math.min(panel.right, document.documentElement.clientWidth);
                for (let parent = pane.parentElement; parent; parent = parent.parentElement) {
                    if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowX)) {
                        const clip = parent.getBoundingClientRect();
                        left = Math.max(left, clip.left);
                        right = Math.min(right, clip.right);
                    }
                }
                return {
                    inside: rect.left >= left - 1 && rect.right <= right + 1,
                    // As wide as its CSS says (300px), or as all that is seen of the panel when that is narrower.
                    wide: rect.width >= Math.min(300, right - left - 8) - 1,
                    unbroken: element.scrollWidth <= element.clientWidth,
                    moved: rect.left < icon.left - 1,
                };
            });
            expect(fit).toMatchObject({ inside: true, wide: true, unbroken: true });
            if (fit.moved) moved++;
            await button.press('Escape');
            await expect(content).toBeHidden();
        }
    }
    // Some icon is close enough to the right edge for its help to open to the left.
    expect(moved).toBeGreaterThan(0);
});

test('An open help closes when the focus moves on, and with Escape from its explanation', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const help = (await openGuessOptions(page, createProject)).first();
    const content = page.locator(`#${await help.getAttribute('aria-controls')}`);
    await help.focus();
    await page.keyboard.press('Enter');
    await expect(content).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(content).toBeHidden();
    await expect(help).toHaveAttribute('aria-expanded', 'false');

    // A click on the explanation, to read or select it, takes the focus there.
    await help.click();
    await content.click();
    await expect(content).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(content).toBeHidden();
    await expect(help).toBeFocused();
});

test('Each help is named after the option it explains, and describes it', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const help = await openGuessOptions(page, createProject);
    const names = new Set<string>();
    for (const button of await help.all()) {
        await expect(button).toHaveAccessibleName(/^Information about \S/);
        names.add((await button.getAttribute('aria-label'))!);
    }
    // A screen reader lists ten different helps, not ten "Information".
    expect(names.size).toBe(await help.count());

    const minimize = page.locator('#adivinaEShowMinimize');
    await expect(help.first()).toHaveAccessibleName('Information about Show minimized');
    await expect(minimize).toHaveAccessibleDescription(/^Start with the game collapsed/);
    // The hover label stays short.
    await help.first().hover();
    await expect(page.getByRole('tooltip')).toHaveText('Information');
});

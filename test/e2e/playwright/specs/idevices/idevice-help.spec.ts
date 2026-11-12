import { test, expect } from '../../fixtures/auth.fixture';
import type { Locator, Page } from '@playwright/test';
import {
    addIdevice,
    gotoWorkarea,
    openLeftPanels,
    selectFirstPage,
    waitForAppReady,
} from '../../helpers/workarea-helpers';
import { waitForEditor } from '../../helpers/editor-helpers';

/**
 * The shared help of the iDevice forms (common.getHelpTooltip), checked once on Guess, whose Options tab has
 * ten of them. idevice-options-help.spec.ts checks, for each iDevice, where its helps sit and that reading
 * them leaves its options alone.
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

test('A help opens on a click and stays open until a second click, another help or its tab closes it', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const help = await openGuessOptions(page, createProject);
    const tab = page.locator('#gameQEIdeviceForm-tab-options');
    const open = page.locator('#adivinaEOptions .help-content:visible');
    const first = help.first();
    const content = page.locator(`#${await first.getAttribute('aria-controls')}`);
    // Pointing at it only names it.
    await first.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Information');
    await expect(open).toHaveCount(0);

    await first.click();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(content).toBeVisible();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    // Moving the pointer away to read it leaves it open.
    await tab.hover();
    await expect(content).toBeVisible();
    // A second click on its icon closes it, as in the project properties.
    await first.click();
    await expect(content).toBeHidden();
    await expect(first).toHaveAttribute('aria-expanded', 'false');

    // One open at a time (the one below, so that the first one opened does not cover it).
    const second = page.locator(`#${await help.nth(1).getAttribute('aria-controls')}`);
    await help.nth(1).click();
    await expect(second).toBeVisible();
    await first.click();
    await expect(second).toBeHidden();
    await expect(open).toHaveCount(1);
    await tab.click();
    await expect(open).toHaveCount(0);

    // Reaching it with the keyboard names it too.
    await help.nth(2).focus();
    await expect(page.getByRole('tooltip')).toHaveText('Information');
    await expect(open).toHaveCount(0);
});

test('Enter and Space open and close a help, and leave its option as it was', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const help = (await openGuessOptions(page, createProject)).first();
    const content = page.locator(`#${await help.getAttribute('aria-controls')}`);
    const options = page.locator('#adivinaEOptions input');
    const before = await options.evaluateAll(inputs =>
        inputs.map(input => [(input as HTMLInputElement).value, (input as HTMLInputElement).checked]),
    );
    await help.focus();
    for (const key of ['Enter', 'Space']) {
        for (const expanded of [true, false]) {
            await help.press(key);
            await expect(content).toBeVisible({ visible: expanded });
            await expect(help).toHaveAttribute('aria-expanded', String(expanded));
            await expect(help).toBeFocused();
        }
    }
    expect(
        await options.evaluateAll(inputs =>
            inputs.map(input => [(input as HTMLInputElement).value, (input as HTMLInputElement).checked]),
        ),
    ).toEqual(before);
});

test('By the right edge a help moves left to keep its width, and back as the window grows', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const help = await openGuessOptions(page, createProject);
    // Below 1200px the panels collapse, which leaves the explanations room at 1024px: open them.
    await page.setViewportSize({ width: 1024, height: 900 });
    await openLeftPanels(page);
    const offsetOf = (content: Locator) =>
        content.evaluate(
            element => element.getBoundingClientRect().left - element.parentElement!.getBoundingClientRect().left,
        );
    let moved: Locator | undefined;
    let narrowOffset = 0;
    for (const button of await help.all()) {
        await button.click();
        const content = page.locator(`#${await button.getAttribute('aria-controls')}`);
        await expect(content).toBeVisible();
        narrowOffset = await offsetOf(content);
        if (narrowOffset < 0) {
            moved = content;
            break;
        }
        await button.press('Escape');
    }
    expect(moved, 'a help by the right edge').toBeDefined();
    await expect(moved!).toHaveCSS('max-width', '300px');
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(() => offsetOf(moved!)).toBeGreaterThan(narrowOffset);
});

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

test('A help that explains a group of options is named after it and describes each option', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await openGuessOptions(page, createProject);
    const score = page.getByRole('radiogroup', { name: 'Score:' });
    await expect(score.getByRole('button')).toHaveAccessibleName('Information about Score');
    const choices = score.getByRole('radio');
    await expect(choices).toHaveCount(3);
    // Each one: a screen reader reads the description of the choice it lands on.
    for (const choice of await choices.all()) {
        await expect(choice).toHaveAccessibleDescription(/^From 0 to 10: No lives.*No score: No score and no lives/);
    }
});

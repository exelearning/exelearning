import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';
import { addIdevice, gotoWorkarea, selectFirstPage, waitForAppReady } from '../../helpers/workarea-helpers';

/**
 * The Options tab of the iDevice forms (tabs.getHtml), whose rows are laid out on one line for a wide form: on a
 * narrow one they go on in the next line, and a long label wraps, instead of pushing the form sideways.
 */

type CreateProject = (page: Page, title: string) => Promise<string>;

/** Open the Options tab of a new iDevice of this type, then give the window this width. */
async function openOptions(page: Page, createProject: CreateProject, type: string, width: number) {
    const uuid = await createProject(page, `Narrow options ${type}`);
    await gotoWorkarea(page, uuid);
    await waitForAppReady(page);
    await selectFirstPage(page);
    await addIdevice(page, type);
    await page.locator('[id$="-tab-options"]').first().click();
    await page.setViewportSize({ width, height: 900 });
    const panel = page.locator('.tab-pane.active[id$="-panel-options"]');
    await expect(panel).toBeVisible();
    return panel;
}

/** How far the content of the panel sticks out of it, sideways. */
const overflow = (panel: ReturnType<Page['locator']>) =>
    panel.evaluate((element: HTMLElement) => element.scrollWidth - element.clientWidth);

// One iDevice for each kind of row that pushed the form sideways.
const rows: Array<[string, string]> = [
    ['guess', 'a label, its field and its help, and the score options'],
    ['complete', 'a switch with a long label'],
    ['discover', 'the image for the back of the cards'],
    ['classify', 'a file to pick'],
    ['quick-questions-multiple-choice', 'the score options in a group of their own'],
    ['map', 'switches with long labels and their help'],
    ['padlock', 'a long label before its field'],
];

for (const [type, row] of rows) {
    test(`The Options tab of ${type} fits a phone: ${row}`, async ({ authenticatedPage: page, createProject }) => {
        const panel = await openOptions(page, createProject, type, 390);
        expect(await overflow(panel)).toBeLessThanOrEqual(0);
    });
}

test('On a phone, the help of a switch with a long label stays beside it', async ({
    authenticatedPage: page,
    createProject,
}) => {
    await openOptions(page, createProject, 'map', 390);
    const besideIt = await page.locator('#mapaEAutoShowDiv').evaluate(row => {
        const panel = row.closest('.tab-pane')!.getBoundingClientRect();
        const item = row.querySelector('.toggle-item')!.getBoundingClientRect();
        const help = row.querySelector('.exe-idevice-help-container')!.getBoundingClientRect();
        return help.left >= item.right && help.right <= panel.right && help.top < item.bottom && item.top < help.bottom;
    });
    expect(besideIt).toBe(true);
});

test('With the side panel open, a long switch label wraps beside its switch', async ({
    authenticatedPage: page,
    createProject,
}) => {
    const panel = await openOptions(page, createProject, 'complete', 1280);
    expect(await overflow(panel)).toBeLessThanOrEqual(0);
    const layout = await page.locator('#cmptEWordsLimitDiv').evaluate(row => {
        const control = row.querySelector('.toggle-control')!.getBoundingClientRect();
        const label = row.querySelector('.toggle-label')!;
        const box = label.getBoundingClientRect();
        return {
            beside: box.left >= control.right && box.top < control.bottom,
            lines: Math.round(box.height / parseFloat(getComputedStyle(label).lineHeight)),
        };
    });
    expect(layout.beside).toBe(true);
    expect(layout.lines).toBeGreaterThan(1);
});

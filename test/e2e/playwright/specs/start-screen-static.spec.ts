import path from 'path';
import { test, expect, type Page } from '@playwright/test';

/**
 * Start screen in the static app (#1469), which is also what the desktop app
 * loads: a dialog over the blank in-memory project on a fresh launch.
 */

const FIXTURE = path.resolve(__dirname, '../../../fixtures/basic-example.elp');

// The static project starts every other spec with the "skip" preference set.
test.use({ storageState: { cookies: [], origins: [] } });

async function launch(page: Page, url = '/'): Promise<void> {
    await page.goto(url);
    await page.waitForFunction(() => (window as any).eXeLearning?.app !== undefined, undefined, { timeout: 30000 });
    await page.waitForFunction(
        () => document.querySelector('#load-screen-main')?.getAttribute('data-visible') === 'false',
        undefined,
        { timeout: 30000 },
    );
}

async function pageCount(page: Page): Promise<number> {
    return page.evaluate(() => {
        const manager = (window as any).eXeLearning?.app?.project?._yjsBridge?.getDocumentManager?.();
        return manager?.getDoc()?.getArray('navigation')?.length ?? 0;
    });
}

test.describe('Start screen (static)', () => {
    test('opens as a modal dialog on a fresh launch, focused on New project', async ({ page }) => {
        await launch(page);

        const dialog = page.locator('dialog.exe-start');
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveJSProperty('open', true);
        expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
        await expect(dialog.getByRole('button', { name: 'New project' })).toBeFocused();
        // No account, no server: there is no project list to show here.
        await expect(dialog.locator('.exe-start__main')).toHaveCount(0);
    });

    test('New project keeps the blank project and is not asked again after a reload', async ({ page }) => {
        await launch(page);

        await page.getByRole('button', { name: 'New project' }).click();

        await expect(page.locator('dialog.exe-start')).toHaveCount(0);
        await expect.poll(() => pageCount(page)).toBe(1);

        await launch(page);
        await expect(page.locator('dialog.exe-start')).toHaveCount(0);
    });

    test('Escape dismisses it and leaves the editor usable', async ({ page }) => {
        await launch(page);
        await expect(page.locator('dialog.exe-start')).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(page.locator('dialog.exe-start')).toHaveCount(0);
        await expect(page.locator('#workarea')).toBeVisible();
    });

    test('a file picked from the computer replaces the blank project', async ({ page }) => {
        await launch(page);

        await page.locator('dialog.exe-start input[type=file]').setInputFiles(FIXTURE);

        await expect(page.locator('dialog.exe-start')).toHaveCount(0);
        await expect.poll(() => pageCount(page), { timeout: 90000 }).toBeGreaterThanOrEqual(2);
    });

    test('"Skip this" is remembered for the next launch', async ({ page, context }) => {
        await launch(page);
        await page.getByLabel('Skip this and start with a new project').check();
        await page.keyboard.press('Escape');

        // A new tab is a new launch: its session has not seen the dialog yet.
        const next = await context.newPage();
        await launch(next);

        await expect(next.locator('dialog.exe-start')).toHaveCount(0);
    });

    test('stays out of the way when the launch names a project by URL', async ({ page }) => {
        await launch(page, '/?url=https://example.invalid/missing.elpx');

        await expect(page.locator('dialog.exe-start')).toHaveCount(0);
    });
});

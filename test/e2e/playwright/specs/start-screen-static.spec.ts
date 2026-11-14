import { readFileSync } from 'fs';
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
        // No account, no server, and (in this project) no browser file picker: no list.
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

    test('a file picked with the browser picker is listed as recent in the next launch and reopens', async ({
        page,
        context,
    }) => {
        // Playwright cannot drive the native file picker, so it is replaced by one that
        // answers with a real file handle: a copy of the fixture in the origin's private
        // file system. Storing it, listing it and reading it back are the real thing.
        const base64 = readFileSync(FIXTURE).toString('base64');
        await context.addInitScript(base64 => {
            (window as any).showOpenFilePicker = async () => {
                const root = await navigator.storage.getDirectory();
                const handle = await root.getFileHandle('water-cycle.elp', { create: true });
                const writable = await (handle as any).createWritable();
                await writable.write(Uint8Array.from(atob(base64), char => char.charCodeAt(0)));
                await writable.close();
                return [handle];
            };
        }, base64);

        await launch(page);
        const dialog = page.locator('dialog.exe-start');
        await expect(dialog.locator('.exe-start__list-title')).toHaveText('Recent projects');
        await expect(dialog.locator('.exe-start__item')).toHaveCount(0);

        await dialog.getByRole('button', { name: 'Open from this computer…' }).click();

        await expect(dialog).toHaveCount(0);
        await expect.poll(() => pageCount(page), { timeout: 90000 }).toBeGreaterThanOrEqual(2);

        // A new tab is a new launch; the list is kept by the browser, not by the tab.
        const next = await context.newPage();
        await launch(next);
        const item = next.locator('dialog.exe-start .exe-start__item');
        await expect(item).toHaveCount(1);
        await expect(item.locator('.exe-start__item-title')).toHaveText('water-cycle.elp');
        await expect(item.locator('.exe-start__item-meta')).toHaveText('On this device');

        await item.click();

        await expect(next.locator('dialog.exe-start')).toHaveCount(0);
        await expect.poll(() => pageCount(next), { timeout: 90000 }).toBeGreaterThanOrEqual(2);
    });

    test('a file opened with File > Open is remembered too', async ({ page, context }) => {
        const base64 = readFileSync(FIXTURE).toString('base64');
        await context.addInitScript(base64 => {
            (window as any).showOpenFilePicker = async () => {
                const root = await navigator.storage.getDirectory();
                const handle = await root.getFileHandle('from-file-menu.elp', { create: true });
                const writable = await (handle as any).createWritable();
                await writable.write(Uint8Array.from(atob(base64), char => char.charCodeAt(0)));
                await writable.close();
                return [handle];
            };
        }, base64);
        await launch(page);
        await page.keyboard.press('Escape');

        await page.locator('#dropdownFile').click();
        await page.locator('#navbar-button-open-offline').click();

        await expect.poll(() => pageCount(page), { timeout: 90000 }).toBeGreaterThanOrEqual(2);

        const next = await context.newPage();
        await launch(next);
        await expect(next.locator('dialog.exe-start .exe-start__item-title')).toHaveText('from-file-menu.elp');
    });

    test('stays out of the way when the launch names a project by URL', async ({ page }) => {
        await launch(page, '/?url=https://example.invalid/missing.elpx');

        await expect(page.locator('dialog.exe-start')).toHaveCount(0);
    });
});

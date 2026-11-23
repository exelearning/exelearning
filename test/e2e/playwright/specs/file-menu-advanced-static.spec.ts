import { test, expect } from '../fixtures/static.fixture';

test('File > Advanced offers the folder actions without holding Alt', async ({ staticPage }) => {
    await staticPage.locator('#dropdownFile').click();

    const advanced = staticPage.locator('#dropdownAdvancedOffline');
    await expect(advanced).toBeVisible();

    await advanced.click();
    await expect(staticPage.locator('#navbar-button-open-folder-offline')).toBeVisible();
    await expect(staticPage.locator('#navbar-button-save-folder-offline')).toBeVisible();
    await staticPage.screenshot({ path: test.info().outputPath('file-menu-advanced.png') });

    await staticPage.keyboard.press('Escape');
    await staticPage.keyboard.press('Escape');
    await expect(staticPage.locator('#dropdownFile')).toHaveAttribute('aria-expanded', 'false');
});

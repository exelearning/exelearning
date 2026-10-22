import { test, expect } from '../fixtures/static.fixture';

test('folder actions follow repeated Alt presses without handing focus to the native menu', async ({ staticPage }) => {
    await staticPage.locator('#dropdownFile').click();
    const actions = staticPage.locator('.exe-folder-project-action');
    await expect(actions).toHaveCount(2);

    for (let press = 0; press < 3; press++) {
        await staticPage.keyboard.down('Alt');
        for (const action of await actions.all()) {
            await expect(action).toBeVisible();
        }
        await expect(staticPage.locator('#dropdownFile')).toHaveAttribute('aria-expanded', 'true');

        await staticPage.keyboard.up('Alt');
        for (const action of await actions.all()) {
            await expect(action).toBeHidden();
        }
    }

    await staticPage.keyboard.down('Alt');
    await expect(staticPage.locator('#navbar-button-open-folder-offline')).toBeVisible();
    await staticPage.screenshot({ path: test.info().outputPath('folder-actions-alt.png') });
    await staticPage.keyboard.up('Alt');
    await staticPage.keyboard.press('Escape');
    await expect(staticPage.locator('#dropdownFile')).toHaveAttribute('aria-expanded', 'false');
});

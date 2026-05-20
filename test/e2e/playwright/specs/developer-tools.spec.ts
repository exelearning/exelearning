import { test, expect } from '@playwright/test';

test.describe('Developer Tools — dev mode', () => {
    test.beforeEach(async (_, testInfo) => {
        if (testInfo.project.name === 'static') {
            test.skip(true, 'Developer routes require the dynamic server');
        }
    });

    test('GET /developer redirects to /developer/style-lab', async ({ page }) => {
        const response = await page.goto('/developer');
        expect(page.url()).toMatch(/\/developer\/style-lab$/);
        expect(response).not.toBeNull();
    });

    test('Style Lab loads, populates themes + fixtures, and renders a preview', async ({ page }) => {
        await page.goto('/developer/style-lab');
        await expect(page.getByTestId('style-lab-root')).toBeVisible();

        const themes = page.getByTestId('style-lab-theme-item');
        await expect(themes.first()).toBeVisible({ timeout: 10000 });
        expect(await themes.count()).toBeGreaterThan(0);

        const fixtureSelect = page.getByTestId('style-lab-fixture-select');
        await expect(fixtureSelect).toBeVisible();
        await expect(fixtureSelect.locator('option')).not.toHaveCount(0);

        // The preview iframe eventually navigates away from about:blank.
        await expect
            .poll(() => page.locator('#preview-desktop').getAttribute('src'), { timeout: 15000 })
            .toMatch(/\/developer\/preview\//);

        // Switching viewport changes data-layout immediately.
        await page.getByTestId('style-lab-viewport-mobile').click();
        await expect(page.locator('#canvas-body')).toHaveAttribute('data-layout', 'mobile');
    });

    test('iDevice Lab loads selectors and renders a preview', async ({ page }) => {
        await page.goto('/developer/idevice-lab');
        await expect(page.getByTestId('idevice-lab-root')).toBeVisible();
        await expect(page.getByTestId('idevice-lab-theme-select')).toBeVisible();
        await expect(page.getByTestId('idevice-lab-fixture-select')).toBeVisible();
        const items = page.getByTestId('idevice-lab-item');
        await expect(items.first()).toBeVisible({ timeout: 10000 });
        await expect
            .poll(() => page.locator('#preview-desktop').getAttribute('src'), { timeout: 15000 })
            .toMatch(/\/developer\/preview\//);
    });

    test('redirects /developer/api to the API docs', async ({ page }) => {
        await page.goto('/developer/api');
        expect(page.url()).toMatch(/\/api\/v1\/docs/);
    });
});

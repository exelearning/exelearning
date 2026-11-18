import { test, expect } from '@playwright/test';

/**
 * The public read-only link feature is switched on or off for the whole site from
 * /admin > Sharing. The E2E server starts with PUBLIC_VIEW_ENABLED=true, so the toggle
 * must reflect that value. Saving keeps the same value: flipping a site-wide setting here
 * would race with the share-modal specs running in parallel on the same server.
 */
test.describe('Admin public view setting', () => {
    test('shows the PUBLIC_VIEW_ENABLED toggle in the Sharing section and saves it', async ({ page }, testInfo) => {
        if (testInfo.project.name.includes('static')) {
            test.skip(true, 'The admin panel requires server routes');
        }

        const loginResponse = await page.request.post('/api/auth/login', {
            data: { email: 'admin@exelearning.test', password: 'AdminPass123!' },
        });
        expect(loginResponse.ok()).toBeTruthy();

        await page.goto('/admin');
        await page.waitForLoadState('domcontentloaded');

        await page.locator('.admin-nav-link[data-section="sharing"]').click();
        const section = page.locator('#sharing');
        await expect(section).toBeVisible();
        await expect(page.locator('#sectionTitle')).toHaveText('Sharing');

        const toggle = section.locator('#publicViewToggle');
        await expect(toggle).toBeChecked();
        await expect(section.getByText('PUBLIC_VIEW_ENABLED')).toBeVisible();

        const saved = page.waitForResponse(
            res => res.url().includes('/api/admin/settings') && res.request().method() === 'PUT',
        );
        await section.locator('#sharingSaveBtn').click();
        const response = await saved;
        expect(response.ok()).toBeTruthy();
        expect(response.request().postDataJSON()).toEqual({
            settings: [{ key: 'PUBLIC_VIEW_ENABLED', value: 'true', type: 'boolean' }],
        });
        await expect(section.locator('#sharingSaveStatus')).toHaveText('Saved');
    });
});
